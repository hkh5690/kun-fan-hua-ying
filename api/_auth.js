/**
 * API 共享认证模块
 * 验证调用者是否为管理员
 */
const SUPABASE_URL = 'https://bnlougymtspqmujrolwh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJubG91Z3ltdHNwcW11anJvbHdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5OTc0MzgsImV4cCI6MjA5ODU3MzQzOH0._ArFEkE3aVWEkPJnD28r71rJwq3JBq70AW5kHltQW7o';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJubG91Z3ltdHNwcW11anJvbHdoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mjk5NzQzOCwiZXhwIjoyMDk4NTczNDM4fQ.hywUEdWq1IxRxfN1SUtYXgHrke3K3YJ-dKljFcNRrn4';

/**
 * 验证请求是否来自管理员
 * @returns {{ authorized: boolean, userId?: string, error?: string }}
 */
async function requireAdmin(req) {
  const authHeader = (req.headers.authorization || '').replace('Bearer ', '');
  if (!authHeader) return { authorized: false, error: '未登录：请先登录' };

  try {
    // 用 Supabase 验证 JWT
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${authHeader}`
      }
    });
    if (!userRes.ok) return { authorized: false, error: '登录已过期，请重新登录' };

    const user = await userRes.json();

    // 检查是否为管理员
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (roleError || !roleData || roleData.role !== 'admin') {
      return { authorized: false, error: '权限不足：仅管理员可操作' };
    }

    return { authorized: true, userId: user.id };
  } catch (e) {
    return { authorized: false, error: '认证失败: ' + e.message };
  }
}

module.exports = { requireAdmin, SUPABASE_URL, SERVICE_ROLE_KEY };
