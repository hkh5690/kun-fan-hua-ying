/**
 * Vercel Serverless Function — 确认用户邮箱
 *
 * 纯 fetch 实现，无外部依赖，无需 package.json。
 * service_role key 仅在服务端使用，不暴露到前端。
 */

const SUPABASE_URL = 'https://bnlougymtspqmujrolwh.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJubG91Z3ltdHNwcW11anJvbHdoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mjk5NzQzOCwiZXhwIjoyMDk4NTczNDM4fQ.hywUEdWq1IxRxfN1SUtYXgHrke3K3YJ-dKljFcNRrn4';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId } = req.body || {};
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // 直接调用 Supabase Admin API（无需 supabase-js 库）
    const apiRes = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users/${userId}`,
      {
        method: 'PUT',
        headers: {
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email_confirm: true }),
      }
    );

    if (!apiRes.ok) {
      const err = await apiRes.json().catch(() => ({}));
      console.error('confirm-user error:', err);
      return res.status(apiRes.status).json({ error: err.message || err.msg || 'Unknown error' });
    }

    return res.status(200).json({ success: true });
  } catch (e) {
    console.error('confirm-user exception:', e);
    return res.status(500).json({ error: e.message });
  }
};
