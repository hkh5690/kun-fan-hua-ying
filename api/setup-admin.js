/**
 * /api/setup-admin — 创建或提升管理员账号
 * 需要 MASTER_SETUP_KEY 环境变量才能使用
 */
const SUPABASE_URL = 'https://bnlougymtspqmujrolwh.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJubG91Z3ltdHNwcW11anJvbHdoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mjk5NzQzOCwiZXhwIjoyMDk4NTczNDM4fQ.hywUEdWq1IxRxfN1SUtYXgHrke3K3YJ-dKljFcNRrn4';
const MASTER_SETUP_KEY = process.env.MASTER_SETUP_KEY || '';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { masterKey, email, password, username } = req.body || {};

  if (!MASTER_SETUP_KEY) {
    return res.status(403).json({ error: '此端点已禁用。请在 Vercel 设置 MASTER_SETUP_KEY 环境变量。' });
  }
  if (masterKey !== MASTER_SETUP_KEY) {
    return res.status(401).json({ error: '无效的 master key' });
  }
  if (!email || !password) {
    return res.status(400).json({ error: 'email 和 password 为必填项' });
  }

  const results = [];
  try {
    const listRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      headers: { 'apikey': SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SERVICE_ROLE_KEY}` },
    });
    const users = await listRes.json();
    const existingUser = (users.users || users || []).find(u => u.email === email);
    let userId;

    if (existingUser) {
      userId = existingUser.id;
      results.push({ step: 'found', userId, email });
      const pwdRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'apikey': SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, email_confirm: true }),
      });
      results.push({ step: 'password-updated', ok: pwdRes.ok });
    } else {
      const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: 'POST',
        headers: { 'apikey': SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { username: username || '管理员', role: 'admin' } }),
      });
      const newUser = await createRes.json();
      if (!createRes.ok) return res.status(500).json({ error: 'Create failed', detail: newUser });
      userId = newUser.id;
      results.push({ step: 'created', userId, email });
    }

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
