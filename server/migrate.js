const fs = require('fs');
const path = require('path');
const db = require('./data/store');

const DB_JSON_PATH = path.join(__dirname, 'database.json');

function importData() {
  if (!fs.existsSync(DB_JSON_PATH)) {
    console.log("Không tìm thấy database.json, bỏ qua bước migrate dữ liệu.");
    return;
  }

  const rawData = fs.readFileSync(DB_JSON_PATH, 'utf8');
  const data = JSON.parse(rawData);

  const insertCompany = db.prepare('INSERT OR IGNORE INTO companies (id, name, url, info, createdAt) VALUES (?, ?, ?, ?, ?)');
  const insertKeyword = db.prepare('INSERT OR IGNORE INTO keywords (id, keyword, titles, createdAt) VALUES (?, ?, ?, ?)');
  const insertArticle = db.prepare('INSERT OR IGNORE INTO articles (id, keyword, title, companyId, content, createdAt) VALUES (?, ?, ?, ?, ?, ?)');

  const importTx = db.transaction(() => {
    let companyCount = 0;
    let keywordCount = 0;
    let articleCount = 0;

    for (const comp of data.companies || []) {
      const info = comp.info || '';
      const changes = insertCompany.run(comp.id, comp.name, comp.url, info, comp.createdAt).changes;
      if (changes > 0) companyCount++;
    }

    for (const keyw of data.keywords || []) {
      const titlesStr = JSON.stringify(keyw.titles);
      const changes = insertKeyword.run(keyw.id, keyw.keyword, titlesStr, keyw.createdAt).changes;
      if (changes > 0) keywordCount++;
    }

    for (const art of data.articles || []) {
      const changes = insertArticle.run(art.id, art.keyword, art.title, art.companyId, art.content, art.createdAt).changes;
      if (changes > 0) articleCount++;
    }

    console.log(`Đã import thành công: ${companyCount} Companies, ${keywordCount} Keywords, ${articleCount} Articles từ JSON cũ sang SQLite.`);
  });

  try {
    importTx();
    // Rename old file to prevent running again accidentally
    fs.renameSync(DB_JSON_PATH, path.join(__dirname, 'database.json.bak'));
  } catch (err) {
    console.error("Lỗi trong quá trình migrate data:", err);
  }
}

importData();
