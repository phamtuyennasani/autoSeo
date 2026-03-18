const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '../database.sqlite');
const db = new Database(DB_PATH, { verbose: console.log });

// Initialize database tables
function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS keywords (
      id TEXT PRIMARY KEY,
      keyword TEXT NOT NULL,
      titles TEXT NOT NULL,
      companyId TEXT,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (companyId) REFERENCES companies(id)
    );

    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      info TEXT,
      createdAt TEXT NOT NULL
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
  `);
}

initDb();

// Migration: Thêm bảng token_usage nếu chưa có
try {
  db.exec(`CREATE TABLE IF NOT EXISTS token_usage (
    id TEXT PRIMARY KEY, type TEXT NOT NULL,
    input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0, keyword TEXT, createdAt TEXT NOT NULL
  );`);
} catch (e) { console.log('Lỗi migration token_usage:', e.message); }

  // Migration: Thêm bảng batch_jobs nếu chưa có
try {
  db.exec(`CREATE TABLE IF NOT EXISTS batch_jobs (
    id TEXT PRIMARY KEY, gemini_job_name TEXT NOT NULL,
    keyword TEXT NOT NULL, companyId TEXT NOT NULL, titles TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', gemini_state TEXT,
    total INTEGER NOT NULL DEFAULT 0, succeeded INTEGER NOT NULL DEFAULT 0,
    failed INTEGER NOT NULL DEFAULT 0, createdAt TEXT NOT NULL, completedAt TEXT
  );`);
} catch (e) { console.log('Lỗi migration batch_jobs:', e.message); }

// Migration: Thêm bảng settings nếu chưa có + seed giá trị mặc định
try {
  db.exec(`CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    label TEXT,
    updatedAt TEXT
  );`);
  // Seed mặc định (chỉ insert nếu chưa có)
  const seedSettings = [
    { key: 'daily_token_limit',   value: '0', label: 'Giới hạn token/ngày (0 = không giới hạn)' },
    { key: 'daily_article_limit', value: '0', label: 'Giới hạn số bài viết/ngày (0 = không giới hạn)' },
  ];
  const insertSetting = db.prepare(
    `INSERT OR IGNORE INTO settings (key, value, label, updatedAt) VALUES (?, ?, ?, ?)`
  );
  for (const s of seedSettings) {
    insertSetting.run(s.key, s.value, s.label, new Date().toISOString());
  }
  console.log('Migration settings: OK');
} catch (e) { console.log('Lỗi migration settings:', e.message); }



// Migration: Thêm cột companyId nếu chưa có
try {
  const tableInfo = db.prepare("PRAGMA table_info('keywords')").all();
  const hasCompanyId = tableInfo.some(col => col.name === 'companyId');
  if (!hasCompanyId) {
    db.exec('ALTER TABLE keywords ADD COLUMN companyId TEXT');
    console.log("Migration: Đã thêm cột companyId vào bảng keywords");
  }
} catch (e) {
  console.log("Lỗi migration keywords:", e.message);
}

// Migration: Thêm cột SEO fields vào bảng articles nếu chưa có
try {
  const articleInfo = db.prepare("PRAGMA table_info('articles')").all();
  const cols = articleInfo.map(c => c.name);
  if (!cols.includes('seo_title')) {
    db.exec('ALTER TABLE articles ADD COLUMN seo_title TEXT');
    console.log("Migration: Đã thêm cột seo_title vào bảng articles");
  }
  if (!cols.includes('seo_description')) {
    db.exec('ALTER TABLE articles ADD COLUMN seo_description TEXT');
    console.log("Migration: Đã thêm cột seo_description vào bảng articles");
  }
  if (!cols.includes('image_prompts')) {
    db.exec('ALTER TABLE articles ADD COLUMN image_prompts TEXT');
    console.log("Migration: Đã thêm cột image_prompts vào bảng articles");
  }
} catch (e) {
  console.log("Lỗi migration articles:", e.message);
}

module.exports = db;
