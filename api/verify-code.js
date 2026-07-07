/**
 * /api/verify-code — 验证邮箱验证码并创建账号
 */
const crypto = require('crypto');
const SUPABASE_URL = 'https://bnlougymtspqmujrolwh.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJubG91Z3ltdHNwcW11anJvbHdoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mjk5NzQzOCwiZXhwIjoyMDk4NTczNDM4fQ.hywUEdWq1IxRxfN1SUtYXgHrke3K3YJ-dKljFcNRrn4';
const HMAC_KEY = process.env.VERIFY_HMAC_KEY || crypto.randomBytes(32).toString('hex');

function verifyToken(token) {
  try {
    const raw = JSON.parse(Buffer.from(token, 'base64url').toString());
    const { data, hmac } = raw;
    const expected = crypto.createHmac('sha256', HMAC_KEY).update(data).digest('hex');
    if (hmac !== expected) return null;
    return JSON.parse(data);
  } catch { return null; }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { token, code, password, username, role } = req.body || {};
    if (!token || !code || !password) return res.status(400).json({ error: '缺少参数' });

    const payload = verifyToken(token);
    if (!payload) return res.status(400).json({ error: '验证码已过期或无效，请重新获取' });
    if (payload.code !== code) return res.status(400).json({ error: '验证码错误' });
    if (Date.now() > payload.exp) return res.status(400).json({ error: '验证码已过期，请重新获取' });
    if (password.length < 6) return res.status(400).json({ error: '密码至少6位' });

    const apiRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: { 'apikey': SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: payload.email, password, email_confirm: true,
        user_metadata: { username: username || payload.email.split('@')[0], role: role || 'editor' },
      }),
    });

    const data = await apiRes.json();
    if (!apiRes.ok) {
      const msg = data.msg || data.message || '注册失败';
      if (msg.includes('already') || msg.includes('already exists')) return res.status(409).json({ error: '该邮箱已被注册' });
      return res.status(apiRes.status).json({ error: msg });
    }

    return res.status(200).json({ success: true, user: { id: data.id, email: data.email } });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
