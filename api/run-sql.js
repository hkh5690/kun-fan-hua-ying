/**
 * /api/run-sql — 执行数据库迁移（仅管理员可用）
 */
const { requireAdmin } = require('./_auth');
const { Pool } = require('pg');

const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD || '';

const CONFIGS = [
  { host: 'db.bnlougymtspqmujrolwh.supabase.co', port: 5432, user: 'postgres', label: 'direct' },
  { host: 'aws-0-us-east-1.pooler.supabase.com', port: 6543, user: 'postgres.bnlougymtspqmujrolwh', label: 'pooler' },
];

async function tryConnect(config) {
  const pool = new Pool({
    ...config,
    database: 'postgres',
    password: DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
  });
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

  // 认证检查：仅管理员可执行 SQL
  const auth = await requireAdmin(req);
  if (!auth.authorized) return res.status(401).json({ error: auth.error });

  const { sql } = req.body || {};
  if (!sql) return res.status(400).json({ error: 'sql required' });

  if (!DB_PASSWORD) {
    return res.status(500).json({ error: 'SUPABASE_DB_PASSWORD 环境变量未设置。请在 Supabase Dashboard → Settings → Database → Connection Pooling 获取密码，并在 Vercel 环境变量中设置。' });
  }

  // 禁止危险操作
  const upperSql = sql.toUpperCase();
  const dangerousOps = ['DROP ', 'TRUNCATE', 'DELETE FROM', 'ALTER TABLE'];
  for (const op of dangerousOps) {
    if (upperSql.includes(op)) {
      // 只允许特定的 ALTER TABLE（如 setup.sql 中的）
      if (op === 'ALTER TABLE' && (upperSql.includes('ADD COLUMN') || upperSql.includes('DROP CONSTRAINT') || upperSql.includes('ADD CONSTRAINT'))) {
        continue;
      }
      return res.status(403).json({ error: `禁止执行 ${op} 操作。如有需要请直接在 Supabase SQL Editor 中执行。` });
    }
  }

  let conn = null;
  for (const cfg of CONFIGS) {
    const result = await tryConnect(cfg);
    if (result.ok) { conn = result; break; }
  }

  if (!conn) {
    return res.status(500).json({ error: 'All connection attempts failed. 请确认 SUPABASE_DB_PASSWORD 环境变量已正确设置。' });
  }

  try {
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

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
      success: errors.length === 0,
      total: results.length,
      errors: errors.length,
      failed: errors.map(e => e.error),
    });
  } catch (e) {
    try { conn.client.release(); await conn.pool.end(); } catch {}
    return res.status(500).json({ error: e.message });
  }
};
