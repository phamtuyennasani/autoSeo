const express = require('express');
const router = express.Router();
const { db } = require('../data/store');
const { analyzeKeywords } = require('../services/keywordPlanner');
const { isRoot, getVisibleUserIds } = require('../services/permissions');

// ─── Helper: tạo ID ngắn ────────────────────────────────────────────────────
const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

// ─── GET / — Danh sách tất cả plans ─────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const user = req.user || { id: 'admin', role: 'root' };
    const conditions = [];
    const args = [];

    if (!isRoot(user)) {
      const visibleIds = await getVisibleUserIds(user.id, user.role);
      if (visibleIds !== null) {
        const placeholders = visibleIds.map(() => '?').join(',');
        conditions.push(`p.createdBy IN (${placeholders})`);
        args.push(...visibleIds);
      }
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const result = await db.execute({
      sql: `SELECT p.*, c.name as companyName,
              (SELECT COUNT(*) FROM keyword_plan_items WHERE planId = p.id) as totalItems,
              (SELECT COUNT(*) FROM keyword_plan_items WHERE planId = p.id AND status != 'draft') as createdItems,
              (SELECT COUNT(*) FROM keyword_plan_items WHERE planId = p.id AND status = 'published') as publishedItems
            FROM keyword_plans p
            LEFT JOIN companies c ON p.companyId = c.id
            ${where}
            ORDER BY p.createdAt DESC`,
      args,
    });
    res.json(result.rows);
  } catch (err) {
    console.error('[keyword-plans] GET /', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST / — Tạo plan mới ───────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const user = req.user || { id: 'admin', role: 'root' };
    const { name, description, companyId, keywords } = req.body;
    if (!name || !keywords || !Array.isArray(keywords) || keywords.length === 0)
      return res.status(400).json({ error: 'Thiếu tên plan hoặc danh sách keyword' });

    const id = makeId();
    const now = new Date().toISOString();
    await db.execute({
      sql: 'INSERT INTO keyword_plans (id, name, description, companyId, status, keywords, createdBy, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      args: [id, name, description || '', companyId || null, 'draft', JSON.stringify(keywords), user.id, now, now],
    });

    const plan = await db.execute({ sql: 'SELECT * FROM keyword_plans WHERE id = ?', args: [id] });
    res.json(plan.rows[0]);
  } catch (err) {
    console.error('[keyword-plans] POST /', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /:id — Chi tiết plan + items ───────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const planResult = await db.execute({
      sql: `SELECT p.*, c.name as companyName FROM keyword_plans p
            LEFT JOIN companies c ON p.companyId = c.id
            WHERE p.id = ?`,
      args: [req.params.id],
    });
    const plan = planResult.rows[0];
    if (!plan) return res.status(404).json({ error: 'Không tìm thấy plan' });

    const itemsResult = await db.execute({
      sql: `SELECT i.*, a.title as articleTitle, a.publish_status
            FROM keyword_plan_items i
            LEFT JOIN articles a ON i.articleId = a.id
            WHERE i.planId = ?
            ORDER BY i.cluster_idx ASC, i.item_type DESC, i.rowid ASC`,
      args: [req.params.id],
    });

    res.json({ ...plan, items: itemsResult.rows });
  } catch (err) {
    console.error('[keyword-plans] GET /:id', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /:id — Cập nhật plan ────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const { name, description, companyId, keywords, status } = req.body;
    const updates = [];
    const args = [];
    if (name !== undefined)        { updates.push('name = ?');        args.push(name); }
    if (description !== undefined) { updates.push('description = ?'); args.push(description); }
    if (companyId !== undefined)   { updates.push('companyId = ?');   args.push(companyId); }
    if (keywords !== undefined)    { updates.push('keywords = ?');    args.push(JSON.stringify(keywords)); }
    if (status !== undefined)      { updates.push('status = ?');      args.push(status); }
    updates.push('updatedAt = ?');
    args.push(new Date().toISOString());
    args.push(req.params.id);

    await db.execute({ sql: `UPDATE keyword_plans SET ${updates.join(', ')} WHERE id = ?`, args });
    const plan = await db.execute({ sql: 'SELECT * FROM keyword_plans WHERE id = ?', args: [req.params.id] });
    res.json(plan.rows[0]);
  } catch (err) {
    console.error('[keyword-plans] PUT /:id', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /:id — Xóa plan (không xóa articles) ────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    await db.execute({ sql: 'DELETE FROM keyword_plan_items WHERE planId = ?', args: [req.params.id] });
    await db.execute({ sql: 'DELETE FROM keyword_plans WHERE id = ?', args: [req.params.id] });
    res.json({ success: true });
  } catch (err) {
    console.error('[keyword-plans] DELETE /:id', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /:id/duplicate — Nhân bản plan ────────────────────────────────────
router.post('/:id/duplicate', async (req, res) => {
  try {
    const user = req.user || { id: 'admin', role: 'root' };
    const originalResult = await db.execute({ sql: 'SELECT * FROM keyword_plans WHERE id = ?', args: [req.params.id] });
    const original = originalResult.rows[0];
    if (!original) return res.status(404).json({ error: 'Không tìm thấy plan' });

    const newId = makeId();
    const now = new Date().toISOString();
    await db.execute({
      sql: 'INSERT INTO keyword_plans (id, name, description, companyId, status, keywords, createdBy, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      args: [newId, `${original.name} (copy)`, original.description, original.companyId, 'draft', original.keywords, user.id, now, now],
    });
    const newPlan = await db.execute({ sql: 'SELECT * FROM keyword_plans WHERE id = ?', args: [newId] });
    res.json(newPlan.rows[0]);
  } catch (err) {
    console.error('[keyword-plans] duplicate', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /:id/analyze — Chạy AI phân tích keyword ──────────────────────────
router.post('/:id/analyze', async (req, res) => {
  try {
    const user = req.user || { id: 'admin', role: 'root' };
    const planResult = await db.execute({ sql: 'SELECT * FROM keyword_plans WHERE id = ?', args: [req.params.id] });
    const plan = planResult.rows[0];
    if (!plan) return res.status(404).json({ error: 'Không tìm thấy plan' });

    let keywords;
    try { keywords = JSON.parse(plan.keywords); } catch { keywords = []; }
    if (!keywords.length) return res.status(400).json({ error: 'Plan không có keyword nào' });

    // Gọi AI phân tích
    const { clusters, usage } = await analyzeKeywords(keywords, user.id);

    // Xóa items cũ và insert items mới
    await db.execute({ sql: 'DELETE FROM keyword_plan_items WHERE planId = ?', args: [req.params.id] });

    const now = new Date().toISOString();
    for (let ci = 0; ci < clusters.length; ci++) {
      const cluster = clusters[ci];
      for (const item of cluster.items) {
        const itemId = makeId();
        await db.execute({
          sql: 'INSERT INTO keyword_plan_items (id, planId, keyword, cluster_name, cluster_idx, item_type, search_intent, content_angle, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          args: [itemId, req.params.id, item.keyword, cluster.name, ci, item.item_type || 'cluster', item.search_intent || '', item.content_angle || '', 'draft', now],
        });
      }
    }

    // Lưu token usage nếu có
    if (usage) {
      await db.execute({
        sql: 'INSERT INTO token_usage (id, type, model, input_tokens, output_tokens, total_tokens, keyword, createdAt, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        args: [makeId(), 'keyword-plan', usage.model, usage.input_tokens, usage.output_tokens, usage.total_tokens, plan.name, now, user.id],
      });
    }

    // Cập nhật trạng thái plan
    await db.execute({
      sql: "UPDATE keyword_plans SET status = 'analyzed', updatedAt = ? WHERE id = ?",
      args: [now, req.params.id],
    });

    // Trả về plan với items mới
    const updatedPlan = await db.execute({ sql: 'SELECT * FROM keyword_plans WHERE id = ?', args: [req.params.id] });
    const items = await db.execute({ sql: 'SELECT * FROM keyword_plan_items WHERE planId = ? ORDER BY cluster_idx ASC, item_type DESC', args: [req.params.id] });
    res.json({ ...updatedPlan.rows[0], items: items.rows, clusters_count: clusters.length });
  } catch (err) {
    console.error('[keyword-plans] analyze', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /:id/items/:itemId — Cập nhật 1 item ──────────────────────────────
router.put('/:id/items/:itemId', async (req, res) => {
  try {
    const { cluster_name, cluster_idx, item_type, search_intent, content_angle, status } = req.body;
    const updates = [];
    const args = [];
    if (cluster_name !== undefined)  { updates.push('cluster_name = ?');  args.push(cluster_name); }
    if (cluster_idx !== undefined)   { updates.push('cluster_idx = ?');   args.push(cluster_idx); }
    if (item_type !== undefined)     { updates.push('item_type = ?');     args.push(item_type); }
    if (search_intent !== undefined) { updates.push('search_intent = ?'); args.push(search_intent); }
    if (content_angle !== undefined) { updates.push('content_angle = ?'); args.push(content_angle); }
    if (status !== undefined)        { updates.push('status = ?');        args.push(status); }
    if (!updates.length) return res.status(400).json({ error: 'Không có gì để cập nhật' });

    args.push(req.params.itemId);
    await db.execute({ sql: `UPDATE keyword_plan_items SET ${updates.join(', ')} WHERE id = ?`, args });

    const item = await db.execute({ sql: 'SELECT * FROM keyword_plan_items WHERE id = ?', args: [req.params.itemId] });
    res.json(item.rows[0]);
  } catch (err) {
    console.error('[keyword-plans] PUT item', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /:id/items/:itemId — Xóa 1 item ──────────────────────────────────
router.delete('/:id/items/:itemId', async (req, res) => {
  try {
    await db.execute({ sql: 'DELETE FROM keyword_plan_items WHERE id = ?', args: [req.params.itemId] });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /:id/items — Thêm keyword thủ công vào plan ───────────────────────
router.post('/:id/items', async (req, res) => {
  try {
    const { keyword, cluster_name, cluster_idx, item_type, search_intent, content_angle } = req.body;
    if (!keyword) return res.status(400).json({ error: 'Thiếu keyword' });

    const itemId = makeId();
    const now = new Date().toISOString();
    await db.execute({
      sql: 'INSERT INTO keyword_plan_items (id, planId, keyword, cluster_name, cluster_idx, item_type, search_intent, content_angle, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      args: [itemId, req.params.id, keyword, cluster_name || '', cluster_idx || 0, item_type || 'cluster', search_intent || '', content_angle || '', 'draft', now],
    });
    const item = await db.execute({ sql: 'SELECT * FROM keyword_plan_items WHERE id = ?', args: [itemId] });
    res.json(item.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /:id/items/:itemId/create-article — Tạo bài cho 1 item ───────────
router.post('/:id/items/:itemId/create-article', async (req, res) => {
  try {
    const user = req.user || { id: 'admin', role: 'root' };
    const itemResult = await db.execute({ sql: 'SELECT * FROM keyword_plan_items WHERE id = ?', args: [req.params.itemId] });
    const item = itemResult.rows[0];
    if (!item) return res.status(404).json({ error: 'Không tìm thấy item' });

    const planResult = await db.execute({ sql: 'SELECT * FROM keyword_plans WHERE id = ?', args: [req.params.id] });
    const plan = planResult.rows[0];
    if (!plan) return res.status(404).json({ error: 'Không tìm thấy plan' });

    const companyId = req.body.companyId || plan.companyId;
    const title = req.body.title || item.keyword;

    if (!companyId) return res.status(400).json({ error: 'Chưa chọn công ty cho plan' });

    // Gọi generateAndSave từ articles.js
    const { generateAndSave } = require('./articles');
    const { getEffectiveApiConfig } = require('../services/apiConfig');

    const compResult = await db.execute({ sql: 'SELECT * FROM companies WHERE id = ?', args: [companyId] });
    const company = compResult.rows[0];
    if (!company) return res.status(404).json({ error: 'Không tìm thấy công ty' });

    const apiConfig = await getEffectiveApiConfig(user.id);
    if (apiConfig.blocked) return res.status(403).json({ error: apiConfig.message, type: 'no_api_key' });

    const article = await generateAndSave(item.keyword, title, companyId, company, user.id, apiConfig, null, null);

    // Cập nhật item: liên kết với article
    await db.execute({
      sql: "UPDATE keyword_plan_items SET status = 'created', articleId = ? WHERE id = ?",
      args: [article.id, req.params.itemId],
    });

    res.json({ article, item: { ...item, status: 'created', articleId: article.id } });
  } catch (err) {
    console.error('[keyword-plans] create-article', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /:id/batch-create — Tạo bài hàng loạt (fire-and-forget) ───────────
router.post('/:id/batch-create', async (req, res) => {
  try {
    const user = req.user || { id: 'admin', role: 'root' };
    const { itemIds } = req.body;
    if (!Array.isArray(itemIds) || itemIds.length === 0)
      return res.status(400).json({ error: 'Thiếu danh sách itemIds' });

    const planResult = await db.execute({ sql: 'SELECT * FROM keyword_plans WHERE id = ?', args: [req.params.id] });
    const plan = planResult.rows[0];
    if (!plan) return res.status(404).json({ error: 'Không tìm thấy plan' });
    if (!plan.companyId) return res.status(400).json({ error: 'Plan chưa chọn công ty' });

    const compResult = await db.execute({ sql: 'SELECT * FROM companies WHERE id = ?', args: [plan.companyId] });
    const company = compResult.rows[0];
    if (!company) return res.status(404).json({ error: 'Không tìm thấy công ty' });

    const { generateAndSave } = require('./articles');
    const { getEffectiveApiConfig } = require('../services/apiConfig');
    const apiConfig = await getEffectiveApiConfig(user.id);
    if (apiConfig.blocked) return res.status(403).json({ error: apiConfig.message, type: 'no_api_key' });

    // Chỉ lấy items ở trạng thái draft
    const validItems = [];
    for (const itemId of itemIds) {
      const r = await db.execute({ sql: "SELECT * FROM keyword_plan_items WHERE id = ? AND planId = ? AND status = 'draft'", args: [itemId, req.params.id] });
      if (r.rows[0]) validItems.push(r.rows[0]);
    }
    if (validItems.length === 0) return res.status(400).json({ error: 'Không có keyword nào ở trạng thái draft' });

    // Đánh dấu in_queue ngay, trả về cho client
    for (const item of validItems) {
      await db.execute({ sql: "UPDATE keyword_plan_items SET status = 'in_queue' WHERE id = ?", args: [item.id] });
    }
    res.json({ queued: validItems.length, total: itemIds.length });

    // Xử lý nền — không block request
    (async () => {
      for (const item of validItems) {
        try {
          const article = await generateAndSave(item.keyword, item.keyword, plan.companyId, company, user.id, apiConfig, null, null);
          await db.execute({
            sql: "UPDATE keyword_plan_items SET status = 'created', articleId = ? WHERE id = ?",
            args: [article.id, item.id],
          });
        } catch (err) {
          await db.execute({ sql: "UPDATE keyword_plan_items SET status = 'error' WHERE id = ?", args: [item.id] });
          console.error(`[batch-create] item ${item.id} (${item.keyword}) lỗi:`, err.message);
        }
      }
      console.log(`[batch-create] Hoàn thành plan ${req.params.id}: ${validItems.length} keyword`);
    })().catch(err => console.error('[batch-create] background lỗi:', err.message));

  } catch (err) {
    console.error('[keyword-plans] batch-create', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /:id/schedule — Lên lịch publish items ─────────────────────────────
router.post('/:id/schedule', async (req, res) => {
  try {
    const { itemIds, interval_hours = 24, start_at } = req.body;
    if (!Array.isArray(itemIds) || itemIds.length === 0)
      return res.status(400).json({ error: 'Thiếu danh sách itemIds' });

    const planResult = await db.execute({ sql: 'SELECT * FROM keyword_plans WHERE id = ?', args: [req.params.id] });
    if (!planResult.rows[0]) return res.status(404).json({ error: 'Không tìm thấy plan' });

    const startDate = start_at ? new Date(start_at) : new Date();
    const scheduled = [];

    for (let i = 0; i < itemIds.length; i++) {
      const scheduledAt = new Date(startDate.getTime() + i * interval_hours * 3600 * 1000).toISOString();
      await db.execute({
        sql: "UPDATE keyword_plan_items SET status = 'scheduled', scheduled_at = ? WHERE id = ? AND planId = ?",
        args: [scheduledAt, itemIds[i], req.params.id],
      });
      scheduled.push({ itemId: itemIds[i], scheduled_at: scheduledAt });
    }

    await db.execute({
      sql: "UPDATE keyword_plans SET status = 'publishing', updatedAt = ? WHERE id = ?",
      args: [new Date().toISOString(), req.params.id],
    });

    res.json({ scheduled, total: scheduled.length });
  } catch (err) {
    console.error('[keyword-plans] schedule', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /:id/progress — Tiến độ plan ───────────────────────────────────────
router.get('/:id/progress', async (req, res) => {
  try {
    const planResult = await db.execute({ sql: 'SELECT * FROM keyword_plans WHERE id = ?', args: [req.params.id] });
    const plan = planResult.rows[0];
    if (!plan) return res.status(404).json({ error: 'Không tìm thấy plan' });

    const items = await db.execute({
      sql: 'SELECT * FROM keyword_plan_items WHERE planId = ?',
      args: [req.params.id],
    });

    const rows = items.rows;
    const total = rows.length;
    const byStatus = { draft: 0, created: 0, scheduled: 0, published: 0, error: 0 };
    const byIntent = { Informational: 0, Commercial: 0, Navigational: 0, Transactional: 0, '': 0 };
    const byCluster = {};

    for (const item of rows) {
      byStatus[item.status] = (byStatus[item.status] || 0) + 1;
      byIntent[item.search_intent || ''] = (byIntent[item.search_intent || ''] || 0) + 1;
      const cn = item.cluster_name || 'Chưa phân nhóm';
      if (!byCluster[cn]) byCluster[cn] = { total: 0, created: 0, published: 0 };
      byCluster[cn].total++;
      if (item.status !== 'draft') byCluster[cn].created++;
      if (item.status === 'published') byCluster[cn].published++;
    }

    const progress = total > 0 ? Math.round(((byStatus.created + byStatus.scheduled + byStatus.published) / total) * 100) : 0;
    res.json({ plan, total, byStatus, byIntent, byCluster, progress });
  } catch (err) {
    console.error('[keyword-plans] progress', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /:id/export — Xuất CSV hoặc JSON ───────────────────────────────────
router.get('/:id/export', async (req, res) => {
  try {
    const { format = 'csv' } = req.query;
    const planResult = await db.execute({ sql: 'SELECT * FROM keyword_plans WHERE id = ?', args: [req.params.id] });
    const plan = planResult.rows[0];
    if (!plan) return res.status(404).json({ error: 'Không tìm thấy plan' });

    const items = await db.execute({
      sql: `SELECT i.*, a.title as articleTitle, a.publish_status, a.publish_external_id
            FROM keyword_plan_items i
            LEFT JOIN articles a ON i.articleId = a.id
            WHERE i.planId = ?
            ORDER BY i.cluster_idx ASC, i.item_type DESC`,
      args: [req.params.id],
    });

    if (format === 'json') {
      res.setHeader('Content-Disposition', `attachment; filename="keyword-plan-${req.params.id}.json"`);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.json({ plan, items: items.rows });
    }

    // CSV
    const csvLines = ['keyword,cluster,type,search_intent,content_angle,status,article_title,publish_status,publish_id'];
    for (const item of items.rows) {
      const row = [
        `"${(item.keyword || '').replace(/"/g, '""')}"`,
        `"${(item.cluster_name || '').replace(/"/g, '""')}"`,
        item.item_type || '',
        item.search_intent || '',
        `"${(item.content_angle || '').replace(/"/g, '""')}"`,
        item.status || '',
        `"${(item.articleTitle || '').replace(/"/g, '""')}"`,
        item.publish_status || '',
        item.publish_external_id || '',
      ];
      csvLines.push(row.join(','));
    }
    res.setHeader('Content-Disposition', `attachment; filename="keyword-plan-${req.params.id}.csv"`);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.send('\uFEFF' + csvLines.join('\n')); // BOM for Excel
  } catch (err) {
    console.error('[keyword-plans] export', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
