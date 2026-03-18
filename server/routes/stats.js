const express = require('express');
const router = express.Router();
const { db } = require('../data/store');

// Lấy tổng thống kê token
router.get('/tokens', async (req, res) => {
  try {
    const totals = await db.execute(`
      SELECT
        COALESCE(SUM(input_tokens),  0) AS total_input,
        COALESCE(SUM(output_tokens), 0) AS total_output,
        COALESCE(SUM(total_tokens),  0) AS total_all,
        COUNT(*) AS total_calls
      FROM token_usage
    `);

    const byType = await db.execute(`
      SELECT
        type,
        COALESCE(SUM(input_tokens),  0) AS input_tokens,
        COALESCE(SUM(output_tokens), 0) AS output_tokens,
        COALESCE(SUM(total_tokens),  0) AS total_tokens,
        COUNT(*) AS calls
      FROM token_usage
      GROUP BY type
    `);

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

// Reset thống kê
router.delete('/tokens', async (req, res) => {
  try {
    await db.execute('DELETE FROM token_usage');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi khi reset thống kê' });
  }
});

module.exports = router;
