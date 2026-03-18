const express = require('express');
const router = express.Router();
const { db } = require('../data/store');

// Lấy thống kê token — chỉ của user hiện tại
router.get('/tokens', async (req, res) => {
  try {
    const user    = req.user || { id: 'admin', role: 'admin' };
    const userId  = user.id;

    // Admin vẫn chỉ thấy số của chính mình (thống kê tổng sẽ có trang riêng)
    const totals = await db.execute({
      sql: `SELECT
              COALESCE(SUM(input_tokens),  0) AS total_input,
              COALESCE(SUM(output_tokens), 0) AS total_output,
              COALESCE(SUM(total_tokens),  0) AS total_all,
              COUNT(*) AS total_calls
            FROM token_usage
            WHERE createdBy = ? OR createdBy IS NULL AND ? = 'admin'`,
      args: [userId, user.role],
    });

    const byType = await db.execute({
      sql: `SELECT
              type,
              COALESCE(SUM(input_tokens),  0) AS input_tokens,
              COALESCE(SUM(output_tokens), 0) AS output_tokens,
              COALESCE(SUM(total_tokens),  0) AS total_tokens,
              COUNT(*) AS calls
            FROM token_usage
            WHERE createdBy = ? OR createdBy IS NULL AND ? = 'admin'
            GROUP BY type`,
      args: [userId, user.role],
    });

    const t = totals.rows[0] || {};
    res.json({
      total_input:  Number(t.total_input  || 0),
      total_output: Number(t.total_output || 0),
      total_tokens: Number(t.total_all    || 0),
      total_calls:  Number(t.total_calls  || 0),
      by_type: byType.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi khi đọc thống kê token' });
  }
});

// Reset thống kê (chỉ của user hiện tại)
router.delete('/tokens', async (req, res) => {
  try {
    const user = req.user || { id: 'admin', role: 'admin' };
    await db.execute({
      sql:  'DELETE FROM token_usage WHERE createdBy = ?',
      args: [user.id],
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi khi reset thống kê' });
  }
});

module.exports = router;
