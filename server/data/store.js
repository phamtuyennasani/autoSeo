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

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      label TEXT,
      updatedAt TEXT
    );
  `);

  // ── Migration: Thêm cột nếu thiếu ──
  const migrations = [
    // keywords
    { table: 'keywords',  col: 'companyId',      ddl: 'ALTER TABLE keywords ADD COLUMN companyId TEXT' },
    // articles
    { table: 'articles',  col: 'seo_title',       ddl: 'ALTER TABLE articles ADD COLUMN seo_title TEXT' },
    { table: 'articles',  col: 'seo_description', ddl: 'ALTER TABLE articles ADD COLUMN seo_description TEXT' },
    { table: 'articles',  col: 'image_prompts',   ddl: 'ALTER TABLE articles ADD COLUMN image_prompts TEXT' },
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

  // ── Seed settings mặc định ──
  const seedSettings = [
    { key: 'daily_token_limit',   value: '0', label: 'Giới hạn token/ngày (0 = không giới hạn)' },
    { key: 'daily_article_limit', value: '0', label: 'Giới hạn số bài viết/ngày (0 = không giới hạn)' },
  ];
  for (const s of seedSettings) {
    await db.execute({
      sql: 'INSERT OR IGNORE INTO settings (key, value, label, updatedAt) VALUES (?, ?, ?, ?)',
      args: [s.key, s.value, s.label, new Date().toISOString()],
    });
  }

  console.log('[store] DB initialized ✅');
}

module.exports = { db, initDb };
