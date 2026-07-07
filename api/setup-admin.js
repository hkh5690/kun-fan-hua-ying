/**
 * /api/setup-admin — 创建或提升管理员账号
 * 仅在首次部署时使用，之后可删除
 */
const SUPABASE_URL = 'https://bnlougymtspqmujrolwh.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJubG91Z3ltdHNwcW11anJvbHdoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mjk5NzQzOCwiZXhwIjoyMDk4NTczNDM4fQ.hywUEdWq1IxRxfN1SUtYXgHrke3K3YJ-dKljFcNRrn4';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const ADMIN_EMAIL = '2283419043@qq.com';
  const ADMIN_PASSWORD = 'hkh5858258666';

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
    const existingUser = (users.users || users || []).find(u => u.email === ADMIN_EMAIL);

    let userId;

    if (existingUser) {
      // 用户已存在，更新密码
      userId = existingUser.id;
      results.push({ step: 'found', userId, email: ADMIN_EMAIL });

      const pwdRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
        method: 'PUT',
        headers: {
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password: ADMIN_PASSWORD, email_confirm: true }),
      });
      results.push({ step: 'password-updated', ok: pwdRes.ok });
    } else {
      // 创建新用户
      const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: ADMIN_EMAIL,
          password: ADMIN_PASSWORD,
          email_confirm: true,
          user_metadata: { username: '管理员', role: 'admin' },
        }),
      });
      const newUser = await createRes.json();
      if (!createRes.ok) {
        return res.status(500).json({ error: 'Create failed', detail: newUser });
      }
      userId = newUser.id;
      results.push({ step: 'created', userId, email: ADMIN_EMAIL });
    }

    // 2. 确保 user_roles 中有 admin 记录
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // 检查 user_roles 中是否存在
    const { data: existingRole } = await supabase.from('user_roles').select('*').eq('id', userId).single();

    if (existingRole) {
      // 更新角色为 admin
      const updateData = { role: 'admin' };
      const { error: updateErr } = await supabase.from('user_roles').update(updateData).eq('id', userId);
      results.push({ step: 'role-updated', ok: !updateErr, error: updateErr?.message });
    } else {
      // 插入新记录
      const insertData = { id: userId, username: '管理员', role: 'admin' };
      const { error: insertErr } = await supabase.from('user_roles').insert(insertData);
      results.push({ step: 'role-inserted', ok: !insertErr, error: insertErr?.message });
    }

    return res.status(200).json({ success: true, results });

  } catch (e) {
    return res.status(500).json({ error: e.message, results });
  }
};
