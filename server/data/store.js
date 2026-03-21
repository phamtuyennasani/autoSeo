/**
 * store.js — Turso / LibSQL client.
 *
 * Cấu hình qua .env:
 *   TURSO_DATABASE_URL=file:./database.db   (local)
 *   TURSO_DATABASE_URL=libsql://<db>-<org>.turso.io  (cloud)
 *   TURSO_AUTH_TOKEN=<token>                (cloud only)
 *
 * Export: { db, initDb }
 *   db      — LibSQL client (dùng await db.execute(...))
 *   initDb  — async function tạo tables + migrations (gọi trong index.js)
 */

require('dotenv').config();
const { createClient } = require('@libsql/client');

const db = createClient({
  url:       process.env.TURSO_DATABASE_URL || 'file:./database.db',
  authToken: process.env.TURSO_AUTH_TOKEN  || undefined,
});

// ─── Helper: chạy nhiều câu SQL init liên tiếp ───────────────────────────────
async function exec(sql) {
  // Turso không hỗ trợ multi-statement trong 1 execute → tách từng câu
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);
  for (const stmt of statements) {
    await db.execute(stmt);
  }
}

// ─── Khởi tạo schema + migrations ────────────────────────────────────────────
async function initDb() {
  // ── CREATE tables ──
  await exec(`
    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      info TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS keywords (
      id TEXT PRIMARY KEY,
      keyword TEXT NOT NULL,
      titles TEXT NOT NULL,
      companyId TEXT,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (companyId) REFERENCES companies(id)
    );

    CREATE TABLE IF NOT EXISTS articles (
      id TEXT PRIMARY KEY,
      keyword TEXT NOT NULL,
      title TEXT NOT NULL,
      companyId TEXT NOT NULL,
      content TEXT NOT NULL,
      seo_title TEXT,
      seo_description TEXT,
      image_prompts TEXT,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (companyId) REFERENCES companies(id)
    );

    CREATE TABLE IF NOT EXISTS token_usage (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      total_tokens INTEGER NOT NULL DEFAULT 0,
      keyword TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS batch_jobs (
      id TEXT PRIMARY KEY,
      gemini_job_name TEXT NOT NULL,
      keyword TEXT NOT NULL,
      companyId TEXT NOT NULL,
      titles TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      gemini_state TEXT,
      total INTEGER NOT NULL DEFAULT 0,
      succeeded INTEGER NOT NULL DEFAULT 0,
      failed INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      completedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS article_versions (
      id TEXT PRIMARY KEY,
      articleId TEXT NOT NULL,
      content TEXT,
      seo_title TEXT,
      seo_description TEXT,
      savedAt TEXT NOT NULL,
      savedBy TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      label TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      is_active INTEGER NOT NULL DEFAULT 1,
      daily_token_limit INTEGER NOT NULL DEFAULT 0,
      daily_article_limit INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      lastLoginAt TEXT
    );
  `);

  // ── Migration: Thêm cột nếu thiếu ──
  const migrations = [
    // keywords
    { table: 'keywords',   col: 'companyId',      ddl: 'ALTER TABLE keywords ADD COLUMN companyId TEXT' },
    { table: 'keywords',   col: 'createdBy',       ddl: 'ALTER TABLE keywords ADD COLUMN createdBy TEXT' },
    // articles
    { table: 'articles',   col: 'seo_title',       ddl: 'ALTER TABLE articles ADD COLUMN seo_title TEXT' },
    { table: 'articles',   col: 'seo_description', ddl: 'ALTER TABLE articles ADD COLUMN seo_description TEXT' },
    { table: 'articles',   col: 'image_prompts',   ddl: 'ALTER TABLE articles ADD COLUMN image_prompts TEXT' },
    { table: 'articles',   col: 'createdBy',       ddl: 'ALTER TABLE articles ADD COLUMN createdBy TEXT' },
    { table: 'articles',   col: 'keywordId',       ddl: 'ALTER TABLE articles ADD COLUMN keywordId TEXT' },
    { table: 'batch_jobs', col: 'keywordId',       ddl: 'ALTER TABLE batch_jobs ADD COLUMN keywordId TEXT' },
    // companies
    { table: 'companies',  col: 'contract_code',   ddl: 'ALTER TABLE companies ADD COLUMN contract_code TEXT' },
    { table: 'companies',  col: 'industry',        ddl: 'ALTER TABLE companies ADD COLUMN industry TEXT' },
    { table: 'companies',  col: 'createdBy',       ddl: 'ALTER TABLE companies ADD COLUMN createdBy TEXT' },
    // batch_jobs
    { table: 'batch_jobs', col: 'createdBy',    ddl: 'ALTER TABLE batch_jobs ADD COLUMN createdBy TEXT' },
    { table: 'batch_jobs', col: 'scheduled_at', ddl: 'ALTER TABLE batch_jobs ADD COLUMN scheduled_at TEXT' },
    // token_usage
    { table: 'token_usage', col: 'createdBy', ddl: 'ALTER TABLE token_usage ADD COLUMN createdBy TEXT' },
    { table: 'token_usage', col: 'model',     ddl: 'ALTER TABLE token_usage ADD COLUMN model TEXT' },
    // users — per-user API keys
    { table: 'users', col: 'gemini_api_key',  ddl: 'ALTER TABLE users ADD COLUMN gemini_api_key TEXT' },
    { table: 'users', col: 'gemini_model',    ddl: 'ALTER TABLE users ADD COLUMN gemini_model TEXT' },
    { table: 'users', col: 'serpapi_api_key', ddl: 'ALTER TABLE users ADD COLUMN serpapi_api_key TEXT' },
    { table: 'users', col: 'use_system_key',  ddl: 'ALTER TABLE users ADD COLUMN use_system_key INTEGER NOT NULL DEFAULT 0' },
    { table: 'users', col: 'full_name',       ddl: 'ALTER TABLE users ADD COLUMN full_name TEXT' },
    { table: 'users', col: 'email',           ddl: 'ALTER TABLE users ADD COLUMN email TEXT' },
    { table: 'users', col: 'phone',           ddl: 'ALTER TABLE users ADD COLUMN phone TEXT' },
    // users — google oauth
    { table: 'users', col: 'google_id',        ddl: 'ALTER TABLE users ADD COLUMN google_id TEXT' },
    { table: 'users', col: 'publish_api_url',   ddl: 'ALTER TABLE users ADD COLUMN publish_api_url TEXT' },
    // companies — publish API
    { table: 'companies', col: 'publish_api_url', ddl: 'ALTER TABLE companies ADD COLUMN publish_api_url TEXT' },
    { table: 'companies', col: 'auto_publish',    ddl: 'ALTER TABLE companies ADD COLUMN auto_publish INTEGER NOT NULL DEFAULT 0' },
    // articles — publish tracking
    { table: 'articles', col: 'publish_status',      ddl: "ALTER TABLE articles ADD COLUMN publish_status TEXT NOT NULL DEFAULT 'unpublished'" },
    { table: 'articles', col: 'published_at',         ddl: 'ALTER TABLE articles ADD COLUMN published_at TEXT' },
    { table: 'articles', col: 'publish_external_id',  ddl: 'ALTER TABLE articles ADD COLUMN publish_external_id TEXT' },
  ];

  for (const m of migrations) {
    try {
      const info = await db.execute(`PRAGMA table_info(${m.table})`);
      const cols = info.rows.map(r => r.name);
      if (!cols.includes(m.col)) {
        await db.execute(m.ddl);
        console.log(`Migration: Đã thêm cột ${m.table}.${m.col}`);
      }
    } catch (e) {
      console.warn(`Migration ${m.table}.${m.col}: ${e.message}`);
    }
  }

  // ── Seed admin mặc định ──
  try {
    const bcrypt = require('bcryptjs');
    const adminHash = await bcrypt.hash('admin123', 10);
    await db.execute({
      sql: `INSERT OR IGNORE INTO users (id, username, password_hash, role, is_active, createdAt)
            VALUES ('admin', 'admin', ?, 'admin', 1, ?)`,
      args: [adminHash, new Date().toISOString()],
    });
  } catch (e) {
    console.warn('[store] Seed admin:', e.message);
  }

  // ── Seed settings mặc định ──
  const seedSettings = [
    { key: 'daily_token_limit',   value: '0',                              label: 'Giới hạn token/ngày (0 = không giới hạn)' },
    { key: 'daily_article_limit', value: '0',                              label: 'Giới hạn số bài viết/ngày (0 = không giới hạn)' },
    { key: 'last_batch_check',    value: '',                               label: 'Thời điểm check batch job gần nhất' },
    { key: 'gemini_api_key',        value: process.env.GEMINI_API_KEY  || '', label: 'Gemini API Key' },
    { key: 'gemini_model',          value: process.env.GEMINI_MODEL    || 'gemini-2.5-flash', label: 'Gemini Model' },
    { key: 'serpapi_api_key',       value: process.env.SERPAPI_API_KEY || '', label: 'SerpAPI Key' },
    { key: 'batch_schedule_time',   value: '', label: 'Giờ chạy batch tự động (HH:MM, để trống = tắt)' },
    { key: 'batch_schedule_lastrun',value: '', label: 'Ngày chạy batch theo lịch lần cuối' },
    { key: 'publish_api_url',        value: '', label: 'URL API đăng bài mặc định (bên thứ 3)' },
  ];
  for (const s of seedSettings) {
    await db.execute({
      sql: 'INSERT OR IGNORE INTO settings (key, value, label, updatedAt) VALUES (?, ?, ?, ?)',
      args: [s.key, s.value, s.label, new Date().toISOString()],
    });
  }

  // Sync API config từ DB → process.env (DB là nguồn sự thật sau lần đầu cấu hình)
  const apiCfg = await db.execute(
    `SELECT key, value FROM settings WHERE key IN ('gemini_api_key', 'gemini_model', 'serpapi_api_key')`
  );
  const envMap = { gemini_api_key: 'GEMINI_API_KEY', gemini_model: 'GEMINI_MODEL', serpapi_api_key: 'SERPAPI_API_KEY' };
  for (const row of apiCfg.rows) {
    if (row.value) process.env[envMap[row.key]] = row.value;
  }

  console.log('[store] DB initialized ✅');
}

module.exports = { db, initDb };
