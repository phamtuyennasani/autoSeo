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
  `);
}

initDb();

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
