/**
 * Supabase 客户端初始化
 * 请在 Supabase Dashboard → Settings → API 中找到以下两个值
 * 部署时通过环境变量注入（Vercel 支持）
 */

// 这些值在部署时需要替换为你自己的 Supabase 项目信息
// ── 开发环境: 直接修改这里的值 ──────────────────
const SUPABASE_URL = 'https://bnlougymtspqmujrolwh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJubG91Z3ltdHNwcW11anJvbHdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5OTc0MzgsImV4cCI6MjA5ODU3MzQzOH0._ArFEkE3aVWEkPJnD28r71rJwq3JBq70AW5kHltQW7o';

// ── 生产环境: 可以通过以下方式注入 ──────────────
// Vercel 部署时设置环境变量 SUPABASE_URL 和 SUPABASE_ANON_KEY
// 如果检测到全局 SUPABASE_CONFIG，优先使用（由 vercel 注入）
if (typeof SUPABASE_CONFIG !== 'undefined') {
  // 会被 Vercel 环境变量替换
}

// 初始化 Supabase 客户端
const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
