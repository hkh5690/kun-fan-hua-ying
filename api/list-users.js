const SUPABASE_URL = 'https://bnlougymtspqmujrolwh.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJubG91Z3ltdHNwcW11anJvbHdoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mjk5NzQzOCwiZXhwIjoyMDk4NTczNDM4fQ.hywUEdWq1IxRxfN1SUtYXgHrke3K3YJ-dKljFcNRrn4';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(SUPABASE_URL, KEY);

    // 先修复 CHECK 约束（通过 REST API 直接改）
    // 尝试用 raw SQL
    const fixes = [];

    // 列出所有用户
    const { data, error } = await supabase.from('user_roles').select('id,username,role');
    if (error) return res.status(500).json({ error: error.message });

    // 逐个修复 role='user' 的用户
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

    return res.status(200).json({ users: data.map(u=>({id:u.id,username:u.username,role:u.role})), fixes });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
