const express = require('express');
const router = express.Router();
const { db } = require('../data/store');

// Giá Gemini theo model (USD per 1M tokens) — nguồn: https://ai.google.dev/gemini-api/docs/pricing
// Cập nhật: 2025-03
const MODEL_PRICING = {
  // Gemini 2.5
  'gemini-2.5-pro':              { input: 1.25,   output: 10.00, inputOver200k: 2.50,  outputOver200k: 15.00, note: 'Tiered: >200K ctx tính $2.5/$15' },
  'gemini-2.5-flash':            { input: 0.30,   output: 2.50,  note: 'Thinking output: $3.50/1M' },
  'gemini-2.5-flash-lite':       { input: 0.10,   output: 0.40  },
  'gemini-2.5-flash-preview':    { input: 0.30,   output: 2.50  },
  // Gemini 2.0
  'gemini-2.0-flash':            { input: 0.10,   output: 0.40  },
  'gemini-2.0-flash-lite':       { input: 0.075,  output: 0.30  },
  // Gemini 1.5 (legacy)
  'gemini-1.5-flash':            { input: 0.075,  output: 0.30  },
  'gemini-1.5-flash-8b':         { input: 0.0375, output: 0.15  },
  'gemini-1.5-pro':              { input: 1.25,   output: 5.00  },
};
const DEFAULT_PRICING = { input: 0.10, output: 0.40 };

function getPricing(modelName) {
  if (!modelName) return DEFAULT_PRICING;
  // Match by prefix (e.g. "gemini-2.5-flash-preview-..." → "gemini-2.5-flash")
  for (const key of Object.keys(MODEL_PRICING)) {
    if (modelName.startsWith(key)) return MODEL_PRICING[key];
  }
  return DEFAULT_PRICING;
}

function calcCost(inputTokens, outputTokens, modelName) {
  const p = getPricing(modelName);
  return (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output;
}

// ─── Truy vấn thống kê tổng hợp ──────────────────────────────────────────────
// GET /api/stats/tokens?period=today|week|month|all&userId=...
router.get('/tokens', async (req, res) => {
  try {
    const user   = req.user || { id: 'admin', role: 'admin' };
    const isAdmin = user.role === 'admin';
    const { period = 'all', userId } = req.query;

    // Xác định điều kiện lọc thời gian
    let dateFilter = '';
    const now = new Date();
    if (period === 'today') {
      const todayStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
      dateFilter = `AND date(createdAt) = '${todayStr}'`;
    } else if (period === 'week') {
      const weekAgo = new Date(now - 7 * 86400000).toISOString();
      dateFilter = `AND createdAt >= '${weekAgo}'`;
    } else if (period === 'month') {
      const monthAgo = new Date(now - 30 * 86400000).toISOString();
      dateFilter = `AND createdAt >= '${monthAgo}'`;
    }

    // Xác định điều kiện lọc user
    let userFilter = '';
    const filterArgs = [];
    if (isAdmin && userId && userId !== 'all') {
      userFilter = 'WHERE createdBy = ?';
      filterArgs.push(userId);
    } else if (!isAdmin) {
      userFilter = 'WHERE createdBy = ?';
      filterArgs.push(user.id);
    } else {
      // admin xem tất cả — không filter user
      userFilter = 'WHERE 1=1';
    }

    const baseWhere = `${userFilter} ${dateFilter}`;

    // 1. Tổng hợp chung
    const totals = await db.execute({
      sql: `SELECT
              COALESCE(SUM(input_tokens),  0) AS total_input,
              COALESCE(SUM(output_tokens), 0) AS total_output,
              COALESCE(SUM(total_tokens),  0) AS total_all,
              COUNT(*) AS total_calls
            FROM token_usage ${baseWhere}`,
      args: filterArgs,
    });

    // 2. Thống kê theo model
    const byModel = await db.execute({
      sql: `SELECT
              COALESCE(model, 'unknown') AS model,
              COALESCE(SUM(input_tokens),  0) AS input_tokens,
              COALESCE(SUM(output_tokens), 0) AS output_tokens,
              COALESCE(SUM(total_tokens),  0) AS total_tokens,
              COUNT(*) AS calls
            FROM token_usage ${baseWhere}
            GROUP BY model
            ORDER BY total_tokens DESC`,
      args: filterArgs,
    });

    // 3. Thống kê theo type (titles / article / article-batch)
    const byType = await db.execute({
      sql: `SELECT
              type,
              COALESCE(model, 'unknown') AS model,
              COALESCE(SUM(input_tokens),  0) AS input_tokens,
              COALESCE(SUM(output_tokens), 0) AS output_tokens,
              COALESCE(SUM(total_tokens),  0) AS total_tokens,
              COUNT(*) AS calls
            FROM token_usage ${baseWhere}
            GROUP BY type, model
            ORDER BY type, total_tokens DESC`,
      args: filterArgs,
    });

    // 4. Thống kê theo ngày (30 ngày gần nhất, dùng cho chart)
    const dailyArgs = isAdmin && userId && userId !== 'all'
      ? [userId]
      : !isAdmin ? [user.id] : [];
    const dailyWhere = isAdmin && userId && userId !== 'all'
      ? 'WHERE createdBy = ?'
      : !isAdmin ? 'WHERE createdBy = ?' : 'WHERE 1=1';

    const daily = await db.execute({
      sql: `SELECT
              date(createdAt) AS day,
              COALESCE(SUM(input_tokens),  0) AS input_tokens,
              COALESCE(SUM(output_tokens), 0) AS output_tokens,
              COALESCE(SUM(total_tokens),  0) AS total_tokens,
              COUNT(*) AS calls
            FROM token_usage
            ${dailyWhere}
            AND createdAt >= date('now', '-30 days')
            GROUP BY day
            ORDER BY day ASC`,
      args: dailyArgs,
    });

    // 5. Danh sách users (chỉ admin và khi AUTH bật)
    const authEnabled = process.env.AUTH_ENABLED === 'true';
    let users = [];
    if (isAdmin && authEnabled) {
      const usersResult = await db.execute({
        sql: `SELECT u.id, u.username, u.role,
                COALESCE(SUM(tu.total_tokens), 0) AS total_tokens,
                COALESCE(SUM(tu.input_tokens), 0) AS input_tokens,
                COALESCE(SUM(tu.output_tokens), 0) AS output_tokens,
                COUNT(tu.id) AS calls
              FROM users u
              LEFT JOIN token_usage tu ON u.id = tu.createdBy
              GROUP BY u.id
              ORDER BY total_tokens DESC`,
        args: [],
      });
      users = usersResult.rows;
    }

    // 6. Tính chi phí theo model
    const byModelWithCost = byModel.rows.map(row => {
      const cost = calcCost(Number(row.input_tokens), Number(row.output_tokens), row.model);
      const pricing = getPricing(row.model);
      return {
        ...row,
        input_tokens:  Number(row.input_tokens),
        output_tokens: Number(row.output_tokens),
        total_tokens:  Number(row.total_tokens),
        calls:         Number(row.calls),
        cost_usd:      cost,
        pricing,
      };
    });

    const totalCost = byModelWithCost.reduce((sum, r) => sum + r.cost_usd, 0);

    const t = totals.rows[0] || {};
    res.json({
      total_input:   Number(t.total_input  || 0),
      total_output:  Number(t.total_output || 0),
      total_tokens:  Number(t.total_all    || 0),
      total_calls:   Number(t.total_calls  || 0),
      total_cost_usd: totalCost,
      by_model: byModelWithCost,
      by_type:  byType.rows.map(r => ({
        ...r,
        input_tokens:  Number(r.input_tokens),
        output_tokens: Number(r.output_tokens),
        total_tokens:  Number(r.total_tokens),
        calls:         Number(r.calls),
        cost_usd: calcCost(Number(r.input_tokens), Number(r.output_tokens), r.model),
      })),
      daily:   daily.rows.map(r => ({
        ...r,
        input_tokens:  Number(r.input_tokens),
        output_tokens: Number(r.output_tokens),
        total_tokens:  Number(r.total_tokens),
        calls:         Number(r.calls),
      })),
      users:   users.map(u => ({
        ...u,
        total_tokens:  Number(u.total_tokens),
        input_tokens:  Number(u.input_tokens),
        output_tokens: Number(u.output_tokens),
        calls:         Number(u.calls),
        cost_usd: calcCost(Number(u.input_tokens), Number(u.output_tokens), null),
      })),
      model_pricing: MODEL_PRICING,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi khi đọc thống kê token' });
  }
});

// Reset thống kê (admin reset tất cả, user chỉ reset của mình)
router.delete('/tokens', async (req, res) => {
  try {
    const user = req.user || { id: 'admin', role: 'admin' };
    if (user.role === 'admin') {
      await db.execute('DELETE FROM token_usage');
    } else {
      await db.execute({ sql: 'DELETE FROM token_usage WHERE createdBy = ?', args: [user.id] });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi khi reset thống kê' });
  }
});

module.exports = router;
