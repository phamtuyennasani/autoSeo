const express = require('express');
const router = express.Router();
const db = require('../data/store');

// Lấy tổng thống kê token
router.get('/tokens', (req, res) => {
  try {
    const totals = db.prepare(`
      SELECT 
        SUM(input_tokens)  AS total_input,
        SUM(output_tokens) AS total_output,
        SUM(total_tokens)  AS total_all,
        COUNT(*)           AS total_calls
      FROM token_usage
    `).get();

    const byType = db.prepare(`
      SELECT 
        type,
        SUM(input_tokens)  AS input_tokens,
        SUM(output_tokens) AS output_tokens,
        SUM(total_tokens)  AS total_tokens,
        COUNT(*)           AS calls
      FROM token_usage
      GROUP BY type
    `).all();

    res.json({
      total_input:  totals.total_input  || 0,
      total_output: totals.total_output || 0,
      total_tokens: totals.total_all    || 0,
      total_calls:  totals.total_calls  || 0,
      by_type: byType,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi khi đọc thống kê token' });
  }
});

// Reset thống kê (tuỳ chọn)
router.delete('/tokens', (req, res) => {
  try {
    db.prepare('DELETE FROM token_usage').run();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi khi reset thống kê' });
  }
});

module.exports = router;
