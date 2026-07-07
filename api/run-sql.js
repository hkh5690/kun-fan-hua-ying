/**
 * /api/run-sql — 执行数据库迁移（仅管理员可用）
 */
const { Pool } = require('pg');
const SUPABASE_URL = 'https://bnlougymtspqmujrolwh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJubG91Z3ltdHNwcW11anJvbHdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5OTc0MzgsImV4cCI6MjA5ODU3MzQzOH0._ArFEkE3aVWEkPJnD28r71rJwq3JBq70AW5kHltQW7o';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJubG91Z3ltdHNwcW11anJvbHdoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mjk5NzQzOCwiZXhwIjoyMDk4NTczNDM4fQ.hywUEdWq1IxRxfN1SUtYXgHrke3K3YJ-dKljFcNRrn4';
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD || '';

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

const CONFIGS = [
  { host: 'db.bnlougymtspqmujrolwh.supabase.co', port: 5432, user: 'postgres', label: 'direct' },
  { host: 'aws-0-us-east-1.pooler.supabase.com', port: 6543, user: 'postgres.bnlougymtspqmujrolwh', label: 'pooler' },
];

async function tryConnect(config) {
  const pool = new Pool({ ...config, database: 'postgres', password: DB_PASSWORD, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 5000 });
  try {
    const client = await pool.connect();
    return { client, pool, ok: true };
  } catch (e) {
    try { await pool.end(); } catch {}
    return { ok: false, error: e.message };
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const adminId = await checkAdmin(req);
  if (!adminId) return res.status(401).json({ error: '未登录或权限不足' });

  const { sql } = req.body || {};
  if (!sql) return res.status(400).json({ error: 'sql required' });
  if (!DB_PASSWORD) return res.status(500).json({ error: 'SUPABASE_DB_PASSWORD 环境变量未设置' });

  // 安全限制：禁止危险操作
  const upperSql = sql.toUpperCase();
  for (const op of ['DROP ', 'TRUNCATE', 'DELETE FROM']) {
    if (upperSql.includes(op)) return res.status(403).json({ error: `禁止执行 ${op.trim()} 操作` });
  }

  let conn = null;
  for (const cfg of CONFIGS) {
    const result = await tryConnect(cfg);
    if (result.ok) { conn = result; break; }
  }
  if (!conn) return res.status(500).json({ error: '数据库连接失败，请确认 SUPABASE_DB_PASSWORD 已设置' });

  try {
    const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0 && !s.startsWith('--'));
    const results = [];
    for (const stmt of statements) {
      try {
        await conn.client.query(stmt + ';');
        results.push({ ok: true });
      } catch (err) {
        if (err.message.includes('already exists') || err.message.includes('duplicate') || err.code === '42710' || err.code === '42P07') {
          results.push({ ok: true, skipped: true });
        } else {
          results.push({ ok: false, error: err.message.substring(0, 120) });
        }
      }
    }
    conn.client.release();
    await conn.pool.end();

    const errors = results.filter(r => !r.ok);
    return res.status(errors.length ? 500 : 200).json({
      success: errors.length === 0, total: results.length, errors: errors.length, failed: errors.map(e => e.error),
    });
  } catch (e) {
    try { conn.client.release(); await conn.pool.end(); } catch {}
    return res.status(500).json({ error: e.message });
  }
};
