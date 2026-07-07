/**
 * /api/setup-admin — 创建或提升管理员账号
 * 仅首次部署时使用，需要 master_key 验证
 */
const { SERVICE_ROLE_KEY } = require('./_auth');
const SUPABASE_URL = 'https://bnlougymtspqmujrolwh.supabase.co';

// 安全码从环境变量读取，不硬编码
const MASTER_SETUP_KEY = process.env.MASTER_SETUP_KEY || '';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // 需要 master key 或已有 admin 的 JWT 才能调用
  const { masterKey, email, password, username } = req.body || {};

  // 如果有 master key 验证
  if (MASTER_SETUP_KEY && masterKey === MASTER_SETUP_KEY) {
    // 允许通过
  } else if (MASTER_SETUP_KEY) {
    return res.status(401).json({ error: '无效的 master key' });
  }
  // 如果没有设置 MASTER_SETUP_KEY，拒绝请求（防止滥用）
  else {
    return res.status(403).json({ error: '此端点已被禁用。请在 Vercel 环境变量中设置 MASTER_SETUP_KEY 后重试。' });
  }

  if (!email || !password) {
    return res.status(400).json({ error: 'email 和 password 为必填项' });
  }

  const results = [];

  try {
    // 1. 检查用户是否已存在
    const listRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      },
    });
    const users = await listRes.json();
    const existingUser = (users.users || users || []).find(u => u.email === email);

    let userId;

    if (existingUser) {
      userId = existingUser.id;
      results.push({ step: 'found', userId, email });

      const pwdRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
        method: 'PUT',
        headers: {
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password, email_confirm: true }),
      });
      results.push({ step: 'password-updated', ok: pwdRes.ok });
    } else {
      const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          email_confirm: true,
          user_metadata: { username: username || '管理员', role: 'admin' },
        }),
      });
      const newUser = await createRes.json();
      if (!createRes.ok) {
        return res.status(500).json({ error: 'Create failed', detail: newUser });
      }
      userId = newUser.id;
      results.push({ step: 'created', userId, email });
    }

    // 2. 确保 user_roles 中有 admin 记录
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: existingRole } = await supabase.from('user_roles').select('*').eq('id', userId).single();

    if (existingRole) {
      const { error: updateErr } = await supabase.from('user_roles').update({ role: 'admin', approved: true }).eq('id', userId);
      results.push({ step: 'role-updated', ok: !updateErr, error: updateErr?.message });
    } else {
      const { error: insertErr } = await supabase.from('user_roles').insert({ id: userId, username: username || '管理员', role: 'admin', approved: true });
      results.push({ step: 'role-inserted', ok: !insertErr, error: insertErr?.message });
    }

    return res.status(200).json({ success: true, results });

  } catch (e) {
    return res.status(500).json({ error: e.message, results });
  }
};
