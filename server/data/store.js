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
const { decrypt } = require('../utils/crypto');

const db = createClient({
  url:       process.env.TURSO_DATABASE_URL,
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
      short_content TEXT,
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
      short_content TEXT,
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

    CREATE TABLE IF NOT EXISTS hop_dong (
      id TEXT PRIMARY KEY,
      ma_hd TEXT UNIQUE NOT NULL,
      ten_hd TEXT,
      ten_mien TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      createdAt TEXT NOT NULL,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS webhook_events (
      id TEXT PRIMARY KEY,
      ma_hd TEXT,
      payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      error TEXT,
      createdAt TEXT NOT NULL,
      processedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS keyword_queue (
      id         TEXT PRIMARY KEY,
      keyword    TEXT NOT NULL,
      so_tieude  INTEGER NOT NULL DEFAULT 10,
      company_id TEXT NOT NULL,
      hop_dong_id TEXT,
      chuki      TEXT,
      created_by TEXT,
      status     TEXT NOT NULL DEFAULT 'pending',
      retries    INTEGER NOT NULL DEFAULT 0,
      worker_id  TEXT,
      error      TEXT,
      keyword_ref TEXT,
      created_at TEXT NOT NULL,
      started_at TEXT,
      done_at    TEXT
    );

    CREATE TABLE IF NOT EXISTS title_queue (
      id           TEXT PRIMARY KEY,
      keyword_q_id TEXT NOT NULL,
      keyword      TEXT NOT NULL,
      titles_json  TEXT NOT NULL,
      company_id   TEXT NOT NULL,
      hop_dong_id  TEXT,
      chuki        TEXT,
      created_by   TEXT,
      status       TEXT NOT NULL DEFAULT 'pending',
      retries      INTEGER NOT NULL DEFAULT 0,
      worker_id    TEXT,
      error        TEXT,
      created_at   TEXT NOT NULL,
      started_at   TEXT,
      done_at      TEXT
    );

    CREATE TABLE IF NOT EXISTS keyword_plans (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      description TEXT,
      companyId   TEXT,
      status      TEXT NOT NULL DEFAULT 'draft',
      keywords    TEXT NOT NULL DEFAULT '[]',
      createdBy   TEXT,
      createdAt   TEXT NOT NULL,
      updatedAt   TEXT
    );

    CREATE TABLE IF NOT EXISTS website_analyses (
      id          TEXT PRIMARY KEY,
      companyId   TEXT,
      url         TEXT NOT NULL,
      status      TEXT NOT NULL DEFAULT 'pending',
      totalPages  INTEGER DEFAULT 0,
      config      TEXT,
      summary     TEXT,
      createdAt   TEXT NOT NULL,
      createdBy   TEXT,
      finishedAt  TEXT
    );

    CREATE TABLE IF NOT EXISTS website_analysis_pages (
      id          TEXT PRIMARY KEY,
      analysisId  TEXT NOT NULL,
      url         TEXT NOT NULL,
      title       TEXT,
      h1          TEXT,
      h2s         TEXT,
      metaDesc    TEXT,
      wordCount   INTEGER DEFAULT 0,
      depth       INTEGER DEFAULT 0,
      statusCode  INTEGER DEFAULT 200,
      crawledAt   TEXT NOT NULL,
      FOREIGN KEY (analysisId) REFERENCES website_analyses(id)
    );

    CREATE TABLE IF NOT EXISTS website_analysis_keywords (
      id          TEXT PRIMARY KEY,
      analysisId  TEXT NOT NULL,
      keyword     TEXT NOT NULL,
      reason      TEXT,
      intent      TEXT,
      priority    TEXT DEFAULT 'medium',
      cluster     TEXT,
      FOREIGN KEY (analysisId) REFERENCES website_analyses(id)
    );

    CREATE TABLE IF NOT EXISTS keyword_plan_items (
      id            TEXT PRIMARY KEY,
      planId        TEXT NOT NULL,
      keyword       TEXT NOT NULL,
      cluster_name  TEXT,
      cluster_idx   INTEGER DEFAULT 0,
      item_type     TEXT NOT NULL DEFAULT 'cluster',
      search_intent TEXT,
      content_angle TEXT,
      status        TEXT NOT NULL DEFAULT 'draft',
      articleId     TEXT,
      scheduled_at  TEXT,
      createdAt     TEXT NOT NULL,
      FOREIGN KEY (planId) REFERENCES keyword_plans(id)
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
    { table: 'articles',   col: 'short_content',   ddl: 'ALTER TABLE articles ADD COLUMN short_content TEXT' },
    {table: 'articles',   col: 'slug',         ddl: 'ALTER TABLE articles ADD COLUMN slug TEXT' },
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
    // users — hierarchy
    { table: 'users', col: 'manager_id',      ddl: 'ALTER TABLE users ADD COLUMN manager_id TEXT' },
    { table: 'users', col: 'use_manager_key', ddl: 'ALTER TABLE users ADD COLUMN use_manager_key INTEGER NOT NULL DEFAULT 0' },
    // articles — audit trail (ai viết thay)
    { table: 'articles', col: 'writtenBy', ddl: 'ALTER TABLE articles ADD COLUMN writtenBy TEXT' },
    { table: 'batch_jobs', col: 'writtenBy', ddl: 'ALTER TABLE batch_jobs ADD COLUMN writtenBy TEXT' },
    // companies — liên kết hợp đồng
    { table: 'companies', col: 'hop_dong_id',           ddl: 'ALTER TABLE companies ADD COLUMN hop_dong_id TEXT' },
    { table: 'companies', col: 'internal_links_enabled', ddl: 'ALTER TABLE companies ADD COLUMN internal_links_enabled INTEGER NOT NULL DEFAULT 0' },
    { table: 'companies', col: 'internal_links_max',     ddl: 'ALTER TABLE companies ADD COLUMN internal_links_max INTEGER NOT NULL DEFAULT 3' },
    // chuki — chu kỳ từ CRM1, dùng để gửi lại CRM2 khi publish
    { table: 'batch_jobs', col: 'chuki', ddl: 'ALTER TABLE batch_jobs ADD COLUMN chuki TEXT' },
    { table: 'articles',   col: 'chuki', ddl: 'ALTER TABLE articles ADD COLUMN chuki TEXT' },
    { table: 'article_versions', col: 'short_content', ddl: 'ALTER TABLE article_versions ADD COLUMN short_content TEXT' },
    // source — 'webhook' nếu tạo từ CRM1, null nếu tạo thủ công
    { table: 'batch_jobs',     col: 'source', ddl: "ALTER TABLE batch_jobs ADD COLUMN source TEXT" },
    { table: 'keywords',       col: 'source',        ddl: "ALTER TABLE keywords ADD COLUMN source TEXT" },
    { table: 'keywords',       col: 'content_type',  ddl: "ALTER TABLE keywords ADD COLUMN content_type TEXT DEFAULT 'blog'" },
    // yeucau — yêu cầu từ CRM1, dùng làm hint cho AI khi viết bài
    { table: 'title_queue',   col: 'yeucau',        ddl: 'ALTER TABLE title_queue ADD COLUMN yeucau TEXT' },
    // webhook_events — lưu email CRM1 gửi lên để tìm user
    { table: 'webhook_events', col: 'email',  ddl: 'ALTER TABLE webhook_events ADD COLUMN email TEXT' },
    // webhook_events — auto-retry sau 5 phút khi failed
    { table: 'webhook_events', col: 'retry_count',  ddl: 'ALTER TABLE webhook_events ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0' },
    { table: 'webhook_events', col: 'retry_at',    ddl: 'ALTER TABLE webhook_events ADD COLUMN retry_at TEXT' },
    // AI provider — hỗ trợ multi-provider (openai, gemini, ...)
    { table: 'users', col: 'ai_provider',    ddl: 'ALTER TABLE users ADD COLUMN ai_provider TEXT' },
    { table: 'users', col: 'openai_api_key', ddl: 'ALTER TABLE users ADD COLUMN openai_api_key TEXT' },
    { table: 'users', col: 'openai_model',   ddl: 'ALTER TABLE users ADD COLUMN openai_model TEXT' },
    // users — Nasani integration (từ API xác thực Google login)
    { table: 'users', col: 'employee_code',    ddl: 'ALTER TABLE users ADD COLUMN employee_code TEXT' },
    { table: 'users', col: 'department_name',  ddl: 'ALTER TABLE users ADD COLUMN department_name TEXT' },
    { table: 'users', col: 'manager_name',     ddl: 'ALTER TABLE users ADD COLUMN manager_name TEXT' },
    { table: 'users', col: 'manager_email',    ddl: 'ALTER TABLE users ADD COLUMN manager_email TEXT' },
    { table: 'users', col: 'nasani_permission',ddl: 'ALTER TABLE users ADD COLUMN nasani_permission TEXT' },
    { table: 'users', col: 'manager_code',     ddl: 'ALTER TABLE users ADD COLUMN manager_code TEXT' },
    { table: 'users', col: 'custom_prompt',    ddl: 'ALTER TABLE users ADD COLUMN custom_prompt TEXT' },
    // companies — per-website article style config
    { table: 'companies', col: 'article_styles', ddl: 'ALTER TABLE companies ADD COLUMN article_styles TEXT' },
    { table: 'keyword_plan_items', col: 'variants', ddl: "ALTER TABLE keyword_plan_items ADD COLUMN variants TEXT NOT NULL DEFAULT '[]'" },
    { table: 'keyword_plan_items', col: 'recommended_word_count', ddl: 'ALTER TABLE keyword_plan_items ADD COLUMN recommended_word_count INTEGER NOT NULL DEFAULT 0' },
    { table: 'articles',          col: 'thumbnail_prompt', ddl: 'ALTER TABLE articles ADD COLUMN thumbnail_prompt TEXT' },
    { table: 'website_analyses', col: 'progress_log',     ddl: 'ALTER TABLE website_analyses ADD COLUMN progress_log TEXT' },
    // keyword_queue — batch webhook (nhiều từ khóa 1 lần)
    { table: 'keyword_queue', col: 'yeucau',           ddl: 'ALTER TABLE keyword_queue ADD COLUMN yeucau TEXT' },
    { table: 'keyword_queue', col: 'tieudecodinh_json', ddl: 'ALTER TABLE keyword_queue ADD COLUMN tieudecodinh_json TEXT' },
    { table: 'keyword_queue', col: 'content_type',    ddl: "ALTER TABLE keyword_queue ADD COLUMN content_type TEXT NOT NULL DEFAULT 'blog'" },
    // title_queue — content_type từ webhook
    { table: 'title_queue',   col: 'content_type',    ddl: "ALTER TABLE title_queue ADD COLUMN content_type TEXT NOT NULL DEFAULT 'blog'" },
    // title_queue — publish_external_id: giữ nguyên ID cũ khi viết lại (retry), truyền sang CRM2 để cập nhật
    { table: 'title_queue',   col: 'publish_external_id', ddl: 'ALTER TABLE title_queue ADD COLUMN publish_external_id TEXT' },
    // articles — content_type từ webhook CRM1
    { table: 'articles',       col: 'content_type',    ddl: "ALTER TABLE articles ADD COLUMN content_type TEXT NOT NULL DEFAULT 'blog'" },
    // batch_jobs — content_type cho batch article generation
    { table: 'batch_jobs',     col: 'content_type',    ddl: "ALTER TABLE batch_jobs ADD COLUMN content_type TEXT NOT NULL DEFAULT 'blog'" },
    // keyword_queue + title_queue — retry_after: job lỗi → chờ đến thời điểm này rồi retry tự động
    { table: 'keyword_queue',   col: 'retry_after',     ddl: 'ALTER TABLE keyword_queue ADD COLUMN retry_after TEXT' },
    { table: 'title_queue',     col: 'retry_after',     ddl: 'ALTER TABLE title_queue ADD COLUMN retry_after TEXT' },
    // users — Claude/Anthropic provider
    { table: 'users', col: 'anthropic_api_key', ddl: 'ALTER TABLE users ADD COLUMN anthropic_api_key TEXT' },
    { table: 'users', col: 'anthropic_model',    ddl: 'ALTER TABLE users ADD COLUMN anthropic_model TEXT' },
  ];

  // ── DLQ (Dead Letter Queue) tables ─────────────────────────────────────────
  await exec(`
    CREATE TABLE IF NOT EXISTS keyword_queue_dlq (
      id           TEXT PRIMARY KEY,
      original_id  TEXT NOT NULL,
      keyword      TEXT NOT NULL,
      so_tieude    INTEGER NOT NULL DEFAULT 10,
      company_id   TEXT NOT NULL,
      hop_dong_id  TEXT,
      chuki        TEXT,
      created_by   TEXT,
      retries      INTEGER NOT NULL DEFAULT 0,
      error        TEXT NOT NULL,
      failed_at    TEXT NOT NULL,
      payload_json TEXT,
      replayed_at  TEXT,
      created_at   TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS title_queue_dlq (
      id           TEXT PRIMARY KEY,
      original_id  TEXT NOT NULL,
      keyword_q_id TEXT NOT NULL,
      keyword      TEXT NOT NULL,
      titles_json  TEXT NOT NULL,
      company_id   TEXT NOT NULL,
      hop_dong_id  TEXT,
      chuki        TEXT,
      created_by   TEXT,
      retries      INTEGER NOT NULL DEFAULT 0,
      error        TEXT NOT NULL,
      failed_at    TEXT NOT NULL,
      payload_json TEXT,
      replayed_at  TEXT,
      created_at   TEXT NOT NULL
    );
  `);

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

  // ── Seed admin mặc định (role = 'root') ──
  try {
    const bcrypt = require('bcryptjs');
    const adminHash = await bcrypt.hash('admin123', 10);
    await db.execute({
      sql: `INSERT OR IGNORE INTO users (id, username, password_hash, role, is_active, createdAt)
            VALUES ('admin', 'admin', ?, 'root', 1, ?)`,
      args: [adminHash, new Date().toISOString()],
    });
    // One-time migration: đổi role cũ → role mới
    await db.execute(`UPDATE users SET role = 'root'     WHERE role = 'admin'`);
    await db.execute(`UPDATE users SET role = 'director' WHERE role = 'senior_manager'`);
    await db.execute(`UPDATE users SET role = 'user'     WHERE role = 'employee'`);
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
    { key: 'publish_api_url',           value: '', label: 'URL API đăng bài mặc định (bên thứ 3)' },
    // AI Provider
    { key: 'default_ai_provider', value: process.env.DEFAULT_AI_PROVIDER || 'gemini', label: 'AI Provider mặc định (gemini | openai)' },
    { key: 'claude_api_key',      value: process.env.ANTHROPIC_API_KEY || '', label: 'Claude API Key' },
    { key: 'claude_model',        value: process.env.CLAUDE_MODEL     || 'claude-sonnet-4-6', label: 'Claude Model' },
    { key: 'claude_base_url',      value: process.env.CLAUDE_BASE_URL || '', label: 'Claude Base URL proxy (để trống = dùng API chính thức)' },
    { key: 'openai_api_key',      value: process.env.OPENAI_API_KEY      || '',       label: 'OpenAI API Key' },
    { key: 'openai_model',        value: process.env.OPENAI_MODEL        || 'gpt-4o-mini', label: 'OpenAI Model' },
    { key: 'open_key_mode',       value: '0',                                          label: 'Chế độ Open Key — gom key toàn user và xoay vòng' },
  ];
  for (const s of seedSettings) {
    await db.execute({
      sql: 'INSERT OR IGNORE INTO settings (key, value, label, updatedAt) VALUES (?, ?, ?, ?)',
      args: [s.key, s.value, s.label, new Date().toISOString()],
    });
  }

  // Sync API config từ DB → process.env (DB là nguồn sự thật sau lần đầu cấu hình)
  const apiCfg = await db.execute(
    `SELECT key, value FROM settings WHERE key IN ('gemini_api_key', 'gemini_model', 'serpapi_api_key', 'openai_api_key', 'openai_model', 'default_ai_provider', 'claude_api_key', 'claude_model', 'claude_base_url')`
  );
  const envMap = {
    gemini_api_key:      'GEMINI_API_KEY',
    gemini_model:        'GEMINI_MODEL',
    serpapi_api_key:     'SERPAPI_API_KEY',
    openai_api_key:      'OPENAI_API_KEY',
    openai_model:        'OPENAI_MODEL',
    default_ai_provider: 'DEFAULT_AI_PROVIDER',
    claude_api_key:      'ANTHROPIC_API_KEY',
    claude_model:        'CLAUDE_MODEL',
    claude_base_url:     'CLAUDE_BASE_URL',
  };
  for (const row of apiCfg.rows) {
    if (!row.value) continue;
    // Decrypt API keys before loading into process.env for AI providers
    const isApiKey = ['gemini_api_key', 'serpapi_api_key', 'openai_api_key', 'claude_api_key'].includes(row.key);
    process.env[envMap[row.key]] = isApiKey ? decrypt(row.value) : row.value;
  }
  console.log('[store] DB initialized ✅');
}

module.exports = { db, initDb };
