const express = require('express');
const router = express.Router();
const { db } = require('../data/store');
const { isRoot, getVisibleUserIds, canManageUsers } = require('../services/permissions');

// Lấy danh sách website/công ty
router.get('/', async (req, res) => {
  try {
    const user = req.user || { id: 'admin', role: 'root' };

    let sql  = `SELECT c.*, u.email AS creatorEmail FROM companies c
                LEFT JOIN users u ON u.id = c.createdBy`;
    const args = [];

    // Filter theo userId (chỉ cho manager trở lên)
    if (req.query.userId && canManageUsers(user)) {
      sql += ' WHERE c.createdBy = ?';
      args.push(req.query.userId);
    } else {
      const visibleIds = await getVisibleUserIds(user.id, user.role);
      if (visibleIds !== null) {
        const placeholders = visibleIds.map(() => '?').join(',');
        sql += ` WHERE c.createdBy IN (${placeholders})`;
        args.push(...visibleIds);
      }
    }

    sql += ' ORDER BY createdAt DESC';

    const result = await db.execute({ sql, args });
    const rows = result.rows.map(r => ({
      ...r,
      article_styles: r.article_styles ? JSON.parse(r.article_styles) : null,
    }));
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Thêm mới
router.post('/', async (req, res) => {
  try {
    const user = req.user || { id: 'admin', role: 'admin' };
    const { name, url, info, contract_code, industry, publish_api_url, auto_publish, internal_links_enabled, internal_links_max, article_styles } = req.body;
    if (!name || !url) return res.status(400).json({ error: 'Name and url are required' });

    const id           = Date.now().toString();
    const createdAt    = new Date().toISOString();
    const createdBy    = user.id;
    const ilMax        = Math.max(1, Math.min(10, parseInt(internal_links_max || 3, 10)));
    const stylesJson   = article_styles ? JSON.stringify(article_styles) : null;

    await db.execute({
      sql:  'INSERT INTO companies (id, name, url, info, contract_code, industry, publish_api_url, auto_publish, internal_links_enabled, internal_links_max, article_styles, createdAt, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      args: [id, name, url, info || '', contract_code || '', industry || '', publish_api_url || '', auto_publish ? 1 : 0, internal_links_enabled ? 1 : 0, ilMax, stylesJson, createdAt, createdBy],
    });

    res.json({ id, name, url, info, contract_code, industry, publish_api_url, auto_publish: auto_publish ? 1 : 0, internal_links_enabled: internal_links_enabled ? 1 : 0, internal_links_max: ilMax, article_styles, createdAt, createdBy });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Cập nhật thông tin công ty
router.put('/:id', async (req, res) => {
  try {
    const user = req.user || { id: 'admin', role: 'admin' };
    const { id } = req.params;
    const { name, url, info, contract_code, industry, publish_api_url, auto_publish, internal_links_enabled, internal_links_max, article_styles } = req.body;
    if (!name || !url) return res.status(400).json({ error: 'Name and url are required' });

    // Kiểm tra ownership (admin bypass)
    const check = await db.execute({ sql: 'SELECT createdBy FROM companies WHERE id = ?', args: [id] });
    if (!check.rows[0]) return res.status(404).json({ error: 'Không tìm thấy công ty' });
    if (!isRoot(user) && check.rows[0].createdBy !== user.id) {
      if (canManageUsers(user)) {
        const visibleIds = await getVisibleUserIds(user.id, user.role);
        if (visibleIds && !visibleIds.includes(check.rows[0].createdBy)) {
          return res.status(403).json({ error: 'Bạn không có quyền chỉnh sửa công ty này.' });
        }
      } else {
        return res.status(403).json({ error: 'Bạn không có quyền chỉnh sửa công ty này.' });
      }
    }

    const ilMax      = Math.max(1, Math.min(10, parseInt(internal_links_max || 3, 10)));
    const stylesJson = article_styles ? JSON.stringify(article_styles) : null;

    await db.execute({
      sql:  'UPDATE companies SET name = ?, url = ?, info = ?, contract_code = ?, industry = ?, publish_api_url = ?, auto_publish = ?, internal_links_enabled = ?, internal_links_max = ?, article_styles = ? WHERE id = ?',
      args: [name, url, info || '', contract_code || '', industry || '', publish_api_url || '', auto_publish ? 1 : 0, internal_links_enabled ? 1 : 0, ilMax, stylesJson, id],
    });

    res.json({ id, name, url, info, contract_code, industry, publish_api_url, auto_publish: auto_publish ? 1 : 0, internal_links_enabled: internal_links_enabled ? 1 : 0, internal_links_max: ilMax, article_styles });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Xóa công ty
router.delete('/:id', async (req, res) => {
  try {
    const user = req.user || { id: 'admin', role: 'admin' };
    const { id } = req.params;

    // Kiểm tra ownership (admin bypass)
    const check = await db.execute({ sql: 'SELECT createdBy FROM companies WHERE id = ?', args: [id] });
    if (!check.rows[0]) return res.status(404).json({ error: 'Không tìm thấy công ty' });
    if (!isRoot(user) && check.rows[0].createdBy !== user.id) {
      if (canManageUsers(user)) {
        const visibleIds = await getVisibleUserIds(user.id, user.role);
        if (visibleIds && !visibleIds.includes(check.rows[0].createdBy)) {
          return res.status(403).json({ error: 'Bạn không có quyền xóa công ty này.' });
        }
      } else {
        return res.status(403).json({ error: 'Bạn không có quyền xóa công ty này.' });
      }
    }

    // Cascade xóa dữ liệu liên quan trước (tránh FK constraint)
    await db.execute({ sql: 'DELETE FROM articles   WHERE companyId = ?', args: [id] });
    await db.execute({ sql: 'DELETE FROM batch_jobs WHERE companyId = ?', args: [id] });
    await db.execute({ sql: 'DELETE FROM keywords   WHERE companyId = ?', args: [id] });
    await db.execute({ sql: 'DELETE FROM companies  WHERE id = ?',        args: [id] });

    res.json({ success: true });
  } catch (err) {
    console.error('[companies] DELETE/:id', err.message);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

module.exports = router;
