/**
 * Vercel Serverless Function — 删除用户（仅 admin）
 * 用 service_role key 通过 Admin API 彻底删除用户（auth.users + user_roles）
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
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId required' });

    // 不能删除自己
    if (userId === auth.userId) return res.status(400).json({ error: '不能删除自己' });

    const apiRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: 'DELETE',
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      },
    });

    if (!apiRes.ok) {
      const err = await apiRes.json().catch(() => ({}));
      return res.status(apiRes.status).json({ error: err.msg || err.message || '删除失败' });
    }

    return res.status(200).json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
