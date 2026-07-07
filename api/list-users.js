/**
 * /api/list-users — 管理员查看用户列表
 */
const { requireAdmin, SERVICE_ROLE_KEY } = require('./_auth');
const SUPABASE_URL = 'https://bnlougymtspqmujrolwh.supabase.co';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // 认证检查：仅管理员可查看
  const auth = await requireAdmin(req);
  if (!auth.authorized) return res.status(401).json({ error: auth.error });

  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // 列出所有用户
    const { data, error } = await supabase.from('user_roles').select('id,username,role,approved,created_at');
    if (error) return res.status(500).json({ error: error.message });

    // 修复旧数据中 role='user' 的用户
    const fixes = [];
    for (const u of data) {
      if (u.role === 'user') {
        const { error: e2 } = await supabase.from('user_roles').update({ role: 'editor' }).eq('id', u.id);
        fixes.push({
          id: u.id, username: u.username,
          success: !e2,
          error: e2 ? (e2.message || e2.code || JSON.stringify(e2)) : null,
        });
      }
    }

    return res.status(200).json({ users: data, fixes });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
