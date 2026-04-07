const express = require('express');
const router = express.Router();
const { db } = require('../data/store');
const requireAdmin = require('../middleware/requireAdmin');
const { isRoot } = require('../services/permissions');
const { encrypt, decrypt, isEncrypted } = require('../utils/crypto');
const { maskKey } = require('../utils/func');
const { getSetting } = require('../services/settingsService');

// ─── GET / ────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const user  = req.user || { id: 'admin', role: 'admin' };
    const today  = new Date().toISOString().slice(0, 10);
    const rows   = await db.execute('SELECT * FROM settings ORDER BY key');

    const tokResult = await db.execute({
      sql: `SELECT COALESCE(SUM(total_tokens), 0) AS total FROM token_usage WHERE createdAt LIKE ? AND (createdBy = ? OR createdBy IS NULL AND ? = 'admin')`,
      args: [`${today}%`, user.id, user.role],
    });
    const artResult = await db.execute({
      sql: `SELECT COUNT(*) AS total FROM token_usage WHERE (type = 'article' OR type = 'article-batch') AND createdAt LIKE ? AND (createdBy = ? OR createdBy IS NULL AND ? = 'admin')`,
      args: [`${today}%`, user.id, user.role],
    });

    res.json({
      settings: rows.rows,
      today: {
        tokens:   Number(tokResult.rows[0]?.total || 0),
        articles: Number(artResult.rows[0]?.total || 0),
        date: today,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT / ────────────────────────────────────────────────────────────────────
router.put('/', requireAdmin, async (req, res) => {
  try {
    const updatedAt = new Date().toISOString();
    const changes = {};

    // Numeric settings
    for (const key of ['daily_token_limit', 'daily_article_limit']) {
      if (key in req.body) {
        const val = Math.max(0, parseInt(req.body[key], 10) || 0);
        await db.execute({
          sql: 'UPDATE settings SET value = ?, updatedAt = ? WHERE key = ?',
          args: [String(val), updatedAt, key],
        });
        changes[key] = val;
      }
    }

    // Publish API URL mặc định
    if ('publish_api_url' in req.body) {
      const val = String(req.body.publish_api_url || '').trim();
      await db.execute({
        sql: `INSERT INTO settings (key, value, label, updatedAt) VALUES ('publish_api_url', ?, 'URL API đăng bài mặc định (bên thứ 3)', ?)
              ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt`,
        args: [val, updatedAt],
      });
      changes.publish_api_url = val;
    }

    // Tự động đăng bài sau khi viết xong (system-wide)
    if ('auto_publish_enabled' in req.body) {
      const val = req.body.auto_publish_enabled ? '1' : '0';
      await db.execute({
        sql: `INSERT INTO settings (key, value, label, updatedAt) VALUES ('auto_publish_enabled', ?, 'Tự động đăng bài sau khi viết xong', ?)
              ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt`,
        args: [val, updatedAt],
      });
      changes.auto_publish_enabled = val;
    }

    // Chatbot enable/disable
    if ('chat_enabled' in req.body) {
      const val = req.body.chat_enabled ? '1' : '0';
      await db.execute({
        sql: `INSERT INTO settings (key, value, label, updatedAt) VALUES ('chat_enabled', ?, 'Bật chatbot trợ lý AI ở giao diện', ?)
              ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt`,
        args: [val, updatedAt],
      });
      changes.chat_enabled = val;
    }

    // Lịch chạy batch (HH:MM hoặc chuỗi rỗng để tắt)
    if ('batch_schedule_time' in req.body) {
      const val = String(req.body.batch_schedule_time || '').trim();
      if (val && !/^\d{2}:\d{2}$/.test(val)) {
        return res.status(400).json({ error: 'Định dạng giờ không hợp lệ. Dùng HH:MM (ví dụ: 02:00).' });
      }
      await db.execute({
        sql: `INSERT INTO settings (key, value, label, updatedAt) VALUES ('batch_schedule_time', ?, 'Giờ chạy batch tự động (HH:MM, để trống = tắt)', ?)
              ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt`,
        args: [val, updatedAt],
      });
      changes.batch_schedule_time = val;
    }

    res.json({ success: true, updated: changes, updatedAt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api-config ──────────────────────────────────────────────────────────
// AUTH off → trả system key (admin only)
// AUTH on  → admin → system key; user thường → key của chính mình
router.get('/api-config', async (req, res) => {
  try {
    const user        = req.user || { id: 'admin', role: 'admin' };
    const authEnabled = process.env.AUTH_ENABLED === 'true';

    // User thường khi AUTH bật → đọc key cá nhân từ bảng users (giải mã trước khi mask)
    if (authEnabled && !isRoot(user)) {
      const result = await db.execute({
        sql: 'SELECT gemini_api_key, gemini_model, openai_api_key, openai_model, serpapi_api_key, publish_api_url, ai_provider, claude_api_key, claude_model FROM users WHERE id = ?',
        args: [user.id],
      });
      const row = result.rows[0] || {};
      // Decrypt nếu là encrypted, giữ nguyên nếu là legacy plain text
      const rawGemini  = row.gemini_api_key  ? decrypt(row.gemini_api_key)  : '';
      const rawOpenAI  = row.openai_api_key  ? decrypt(row.openai_api_key)  : '';
      const rawClaude = row.claude_api_key   ? decrypt(row.claude_api_key)  : '';
      const rawSerp    = row.serpapi_api_key  ? decrypt(row.serpapi_api_key)  : '';
      return res.json({
        gemini_api_key:      rawGemini   ? maskKey(rawGemini)   : '',
        gemini_api_key_set:  !!rawGemini,
        gemini_model:        row.gemini_model || 'gemini-2.5-flash',
        openai_api_key:      rawOpenAI   ? maskKey(rawOpenAI)   : '',
        openai_api_key_set:  !!rawOpenAI,
        openai_model:        row.openai_model || 'gpt-4o-mini',
        claude_api_key:      rawClaude   ? maskKey(rawClaude)   : '',
        claude_api_key_set:  !!rawClaude,
        claude_model:        row.claude_model || 'claude-sonnet-4-20250514',
        serpapi_api_key:     rawSerp     ? maskKey(rawSerp)     : '',
        serpapi_api_key_set: !!rawSerp,
        default_ai_provider: row.ai_provider || process.env.DEFAULT_AI_PROVIDER || 'gemini',
        scope: 'user',
      });
    }

    // Admin hoặc AUTH tắt → đọc system key từ settings table
    const result = await db.execute(
      `SELECT key, value FROM settings WHERE key IN ('gemini_api_key', 'gemini_model', 'openai_api_key', 'openai_model', 'claude_api_key', 'claude_model', 'serpapi_api_key', 'default_ai_provider', 'open_key_mode')`
    );
    const map = {};
    for (const row of result.rows) map[row.key] = row.value;
    res.json({
      gemini_api_key:      map.gemini_api_key      ? maskKey(map.gemini_api_key)      : '',
      gemini_api_key_set:  !!map.gemini_api_key,
      gemini_model:        map.gemini_model    || 'gemini-2.5-flash',
      openai_api_key:      map.openai_api_key  ? maskKey(map.openai_api_key)  : '',
      openai_api_key_set:  !!map.openai_api_key,
      openai_model:        map.openai_model    || 'gpt-4o-mini',
      claude_api_key:      map.claude_api_key  ? maskKey(map.claude_api_key)  : '',
      claude_api_key_set:  !!map.claude_api_key,
      claude_model:        map.claude_model    || 'claude-sonnet-4-20250514',
      serpapi_api_key:     map.serpapi_api_key ? maskKey(map.serpapi_api_key) : '',
      serpapi_api_key_set: !!map.serpapi_api_key,
      default_ai_provider: map.default_ai_provider || process.env.DEFAULT_AI_PROVIDER || 'gemini',
      open_key_mode:       map.open_key_mode === '1',
      scope: 'system',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api-config ──────────────────────────────────────────────────────────
// Admin → lưu vào settings table + process.env (system key)
// User thường (AUTH on) → lưu vào users table (key cá nhân)
router.put('/api-config', async (req, res) => {
  try {
    const user        = req.user || { id: 'admin', role: 'admin' };
    const authEnabled = process.env.AUTH_ENABLED === 'true';
    const { gemini_api_key, gemini_model, openai_api_key, openai_model, claude_api_key, claude_model, serpapi_api_key, default_ai_provider } = req.body;

    // User thường khi AUTH bật → lưu vào users table (encrypt trước khi lưu)
    if (authEnabled && !isRoot(user)) {
      const updates = [];
      const args    = [];
      /* Bỏ qua key bị mask (•••) → giữ nguyên key cũ trong DB */
      const skipMasked = (v) => !v || String(v).includes('•••');

      if (gemini_api_key !== undefined && !skipMasked(gemini_api_key)) {
        updates.push('gemini_api_key = ?');
        args.push(encrypt(String(gemini_api_key).trim()));
      }
      if (gemini_model !== undefined) { updates.push('gemini_model = ?'); args.push(String(gemini_model).trim()); }
      if (openai_api_key !== undefined && !skipMasked(openai_api_key)) {
        updates.push('openai_api_key = ?');
        args.push(encrypt(String(openai_api_key).trim()));
      }
      if (openai_model !== undefined) { updates.push('openai_model = ?'); args.push(String(openai_model).trim()); }
      if (claude_api_key !== undefined && !skipMasked(claude_api_key)) {
        updates.push('claude_api_key = ?');
        args.push(encrypt(String(claude_api_key).trim()));
      }
      if (claude_model !== undefined) { updates.push('claude_model = ?'); args.push(String(claude_model).trim()); }
      if (serpapi_api_key !== undefined && !skipMasked(serpapi_api_key)) {
        updates.push('serpapi_api_key = ?');
        args.push(encrypt(String(serpapi_api_key).trim()));
      }
      if (default_ai_provider !== undefined) { updates.push('ai_provider = ?'); args.push(String(default_ai_provider).trim()); }

      if (updates.length > 0) {
        args.push(user.id);
        await db.execute({
          sql: `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
          args,
        });
      }
      return res.json({ success: true, scope: 'user' });
    }

    // Root hoặc AUTH tắt → chỉ root được lưu system key
    if (!isRoot(user)) {
      return res.status(403).json({ error: 'Chỉ root mới được chỉnh sửa cấu hình hệ thống.' });
    }

    const updatedAt = new Date().toISOString();
    const { open_key_mode, ...rest } = req.body;
    const fields = {
      gemini_api_key:  rest.gemini_api_key,
      gemini_model:    rest.gemini_model,
      openai_api_key:  rest.openai_api_key,
      openai_model:    rest.openai_model,
      claude_api_key:  rest.claude_api_key,
      claude_model:    rest.claude_model,
      serpapi_api_key: rest.serpapi_api_key,
    };
    const envMap = {
      gemini_api_key:  'GEMINI_API_KEY',
      gemini_model:    'GEMINI_MODEL',
      openai_api_key:  'OPENAI_API_KEY',
      openai_model:    'OPENAI_MODEL',
      claude_api_key:  'ANTHROPIC_API_KEY',
      claude_model:    'CLAUDE_MODEL',
      serpapi_api_key: 'SERPAPI_API_KEY',
    };

    for (const [key, value] of Object.entries(fields)) {
      if (value === undefined) continue;
      const val = String(value).trim();
      /* Bỏ qua key bị mask (•••) → giữ nguyên key cũ trong DB */
      if (!val || val.includes('•••')) continue;

      // Encrypt API keys khi lưu vào settings table
      const dbValue = (key === 'gemini_api_key' || key === 'serpapi_api_key' || key === 'claude_api_key' || key === 'openai_api_key')
        ? encrypt(val)
        : val;

      await db.execute({
        sql: 'INSERT INTO settings (key, value, label, updatedAt) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt',
        args: [key, dbValue, key, updatedAt],
      });
      // process.env giữ plain text để AI providers đọc trực tiếp
      process.env[envMap[key]] = val;
    }

    // default_ai_provider — lưu riêng vì không cần encrypt
    if (rest.default_ai_provider !== undefined) {
      await db.execute({
        sql: `INSERT INTO settings (key, value, label, updatedAt) VALUES ('default_ai_provider', ?, 'AI Provider mặc định', ?)
              ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt`,
        args: [String(rest.default_ai_provider).trim(), updatedAt],
      });
    }

    // Open Key mode
    if (open_key_mode !== undefined) {
      const val = open_key_mode ? '1' : '0';
      await db.execute({
        sql: `INSERT INTO settings (key, value, label, updatedAt) VALUES ('open_key_mode', ?, 'Chế độ Open Key — gom key toàn user và xoay vòng', ?)
              ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt`,
        args: [val, updatedAt],
      });
    }

    res.json({ success: true, scope: 'system' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
module.exports.getSetting = getSetting;
