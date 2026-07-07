/**
 * /api/change-role — 管理员修改用户角色
 */
const SUPABASE_URL = 'https://bnlougymtspqmujrolwh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJubG91Z3ltdHNwcW11anJvbHdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5OTc0MzgsImV4cCI6MjA5ODU3MzQzOH0._ArFEkE3aVWEkPJnD28r71rJwq3JBq70AW5kHltQW7o';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJubG91Z3ltdHNwcW11anJvbHdoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mjk5NzQzOCwiZXhwIjoyMDk4NTczNDM4fQ.hywUEdWq1IxRxfN1SUtYXgHrke3K3YJ-dKljFcNRrn4';

async function checkAdmin(req) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return null;
  try {
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${token}` }
    });
    if (!userRes.ok) return null;
    const user = await userRes.json();
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: roleData } = await supabase.from('user_roles').select('role').eq('id', user.id).single();
    if (!roleData || roleData.role !== 'admin') return null;
    return user.id;
  } catch { return null; }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const adminId = await checkAdmin(req);
  if (!adminId) return res.status(401).json({ error: '未登录或权限不足' });

  try {
    const { userId, role, approved } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId required' });

    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const updates = {};
    if (role && ['admin', 'editor', 'cs'].includes(role)) updates.role = role;
    if (typeof approved === 'boolean') updates.approved = approved;
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'role or approved required' });

    const { error } = await supabase.from('user_roles').update(updates).eq('id', userId);
    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
