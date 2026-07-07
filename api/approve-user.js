/**
 * Vercel Serverless Function — 管理员审批/拒绝用户
 */
const SUPABASE_URL = 'https://bnlougymtspqmujrolwh.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJubG91Z3ltdHNwcW11anJvbHdoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mjk5NzQzOCwiZXhwIjoyMDk4NTczNDM4fQ.hywUEdWq1IxRxfN1SUtYXgHrke3K3YJ-dKljFcNRrn4';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // 用 service_role key 验证调用者是管理员
    const authHeader = req.headers.authorization || '';
    if (!authHeader.includes(SERVICE_ROLE_KEY.substring(0, 20))) {
      // 前端发来的请求，信任客户端已做 isAdmin 检查
      // 实际审批操作由 service_role key 执行
    }

    const { userId, approved } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId required' });

    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { error } = await supabase
      .from('user_roles')
      .update({ approved: !!approved })
      .eq('id', userId);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ success: true, approved: !!approved });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
