/**
 * /api/change-role — 管理员修改用户角色
 */
const { requireAdmin, SERVICE_ROLE_KEY } = require('./_auth');
const SUPABASE_URL = 'https://bnlougymtspqmujrolwh.supabase.co';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // 认证检查：仅管理员可操作
  const auth = await requireAdmin(req);
  if (!auth.authorized) return res.status(401).json({ error: auth.error });

  try {
    const { userId, role, approved } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId required' });

    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const updates = {};
    if (role && ['admin', 'editor', 'cs'].includes(role)) updates.role = role;
    if (typeof approved === 'boolean') {
      try { updates.approved = approved; } catch {}
    }
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'role or approved required' });

    const { error } = await supabase.from('user_roles').update(updates).eq('id', userId);
    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
