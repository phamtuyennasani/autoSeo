/**
 * routes/website-analysis.js — API phân tích website & gợi ý keyword.
 *
 * POST   /api/website-analysis          Bắt đầu crawl + phân tích (background)
 * GET    /api/website-analysis          Danh sách phân tích (của user)
 * GET    /api/website-analysis/:id      Chi tiết 1 phân tích
 * GET    /api/website-analysis/:id/pages     Danh sách trang đã crawl
 * GET    /api/website-analysis/:id/keywords  Keyword gợi ý
 * DELETE /api/website-analysis/:id      Xóa phân tích
 */

const express = require('express');
const router  = express.Router();
const { db }  = require('../data/store');
const { runAnalysis } = require('../services/websiteAnalyzer');

// ─── POST / — Tạo & bắt đầu phân tích ────────────────────────────────────
router.post('/', async (req, res) => {
  const { url, companyId, maxPages = 100, maxDepth = 3, delayMs = 300 } = req.body;

  if (!url || !url.trim()) {
    return res.status(400).json({ error: 'URL không được để trống.' });
  }

  // Validate URL
  try { new URL(url); } catch {
    return res.status(400).json({ error: 'URL không hợp lệ.' });
  }

  const userId    = req.user?.id || null;
  const id        = `wa-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const createdAt = new Date().toISOString();

  // Lấy thông tin company nếu có
  let companyInfo = null;
  if (companyId) {
    const r = await db.execute({ sql: 'SELECT name, info FROM companies WHERE id = ?', args: [companyId] });
    if (r.rows[0]) companyInfo = r.rows[0];
  }

  // Insert record ngay lập tức
  await db.execute({
    sql:  `INSERT INTO website_analyses (id, companyId, url, status, config, createdAt, createdBy)
           VALUES (?, ?, ?, 'pending', ?, ?, ?)`,
    args: [id, companyId || null, url.trim(), JSON.stringify({ maxPages, maxDepth, delayMs }), createdAt, userId],
  });

  // Trả về ngay, chạy background
  res.json({ id, status: 'pending', message: 'Đang bắt đầu phân tích...' });

  // Chạy crawl + AI trong background
  runAnalysis(id, url.trim(), companyInfo, {
    maxPages: Math.min(maxPages, 500),
    maxDepth: Math.min(maxDepth, 5),
    delayMs:  Math.max(delayMs, 100),
    userId,
  }).catch(err => console.error('[website-analysis] Background error:', err.message));
});

// ─── GET / — Danh sách phân tích ──────────────────────────────────────────
router.get('/', async (req, res) => {
  const userId = req.user?.id;
  const { companyId } = req.query;

  let sql  = 'SELECT wa.*, c.name as companyName FROM website_analyses wa LEFT JOIN companies c ON wa.companyId = c.id';
  const args = [];

  const conditions = [];
  if (companyId) { conditions.push('wa.companyId = ?'); args.push(companyId); }

  // Non-root chỉ thấy của mình
  const { isRoot } = require('../services/permissions');
  if (!(await isRoot(userId))) {
    conditions.push('wa.createdBy = ?');
    args.push(userId);
  }

  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY wa.createdAt DESC LIMIT 50';

  const result = await db.execute({ sql, args });
  res.json(result.rows.map(r => ({
    ...r,
    config:  r.config  ? JSON.parse(r.config)  : {},
    summary: r.summary ? JSON.parse(r.summary) : {},
  })));
});

// ─── GET /:id — Chi tiết 1 phân tích ──────────────────────────────────────
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const result = await db.execute({
    sql:  'SELECT wa.*, c.name as companyName FROM website_analyses wa LEFT JOIN companies c ON wa.companyId = c.id WHERE wa.id = ?',
    args: [id],
  });
  if (!result.rows[0]) return res.status(404).json({ error: 'Không tìm thấy.' });

  const row = result.rows[0];
  res.json({
    ...row,
    config:  row.config  ? JSON.parse(row.config)  : {},
    summary: row.summary ? JSON.parse(row.summary) : {},
  });
});

// ─── GET /:id/pages — Danh sách trang đã crawl ────────────────────────────
router.get('/:id/pages', async (req, res) => {
  const { id }   = req.params;
  const { sort = 'wordCount', order = 'desc' } = req.query;

  const allowedSort = ['wordCount', 'depth', 'url', 'crawledAt'];
  const col  = allowedSort.includes(sort) ? sort : 'wordCount';
  const dir  = order === 'asc' ? 'ASC' : 'DESC';

  const result = await db.execute({
    sql:  `SELECT * FROM website_analysis_pages WHERE analysisId = ? ORDER BY ${col} ${dir} LIMIT 200`,
    args: [id],
  });

  res.json(result.rows.map(r => ({
    ...r,
    h2s: r.h2s ? JSON.parse(r.h2s) : [],
  })));
});

// ─── GET /:id/keywords — Keyword gợi ý ────────────────────────────────────
router.get('/:id/keywords', async (req, res) => {
  const { id } = req.params;
  const { priority, intent, cluster } = req.query;

  let sql  = 'SELECT * FROM website_analysis_keywords WHERE analysisId = ?';
  const args = [id];

  if (priority) { sql += ' AND priority = ?'; args.push(priority); }
  if (intent)   { sql += ' AND intent = ?';   args.push(intent); }
  if (cluster)  { sql += ' AND cluster = ?';  args.push(cluster); }

  sql += " ORDER BY CASE priority WHEN 'Cao' THEN 1 WHEN 'Trung bình' THEN 2 ELSE 3 END";

  const result = await db.execute({ sql, args });
  res.json(result.rows);
});

// ─── DELETE /:id — Xóa phân tích ──────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  await db.execute({ sql: 'DELETE FROM website_analysis_keywords WHERE analysisId = ?', args: [id] });
  await db.execute({ sql: 'DELETE FROM website_analysis_pages WHERE analysisId = ?',    args: [id] });
  await db.execute({ sql: 'DELETE FROM website_analyses WHERE id = ?',                  args: [id] });
  res.json({ success: true });
});

module.exports = router;
