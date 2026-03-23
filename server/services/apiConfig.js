/**
 * apiConfig.js — Resolve API config hiệu quả cho một user.
 *
 * Thứ tự xoay key khi tạo bài / batch:
 *  1. Key cá nhân của user (gemini_api_key)
 *  2. Key của manager trực tiếp (nếu use_manager_key = 1 và manager có key)
 *  3. Key của senior_manager (manager của manager, tối đa 2 cấp)
 *  4. Key hệ thống của root (nếu use_system_key = 1)
 *
 * Giới hạn bài/token chỉ áp dụng khi dùng key hệ thống (usingSystemKey: true),
 * tức là khi user KHÔNG có key cá nhân và KHÔNG có key manager.
 *
 * AUTH_ENABLED=false hoặc role root → luôn dùng system key, usingSystemKey: true
 */

const { db } = require('../data/store');

async function getEffectiveApiConfig(userId) {
  const authEnabled = process.env.AUTH_ENABLED === 'true';

  const systemConfig = {
    apiKey:         process.env.GEMINI_API_KEY  || '',
    modelName:      process.env.GEMINI_MODEL    || 'gemini-2.5-flash',
    serpApiKey:     process.env.SERPAPI_API_KEY || '',
    usingSystemKey: true,
    blocked:        false,
  };

  if (!authEnabled || !userId) return systemConfig;

  try {
    const result = await db.execute({
      sql: `SELECT gemini_api_key, gemini_model, serpapi_api_key,
                   use_system_key, use_manager_key, manager_id, role
            FROM users WHERE id = ?`,
      args: [userId],
    });
    const row = result.rows[0];
    if (!row) return systemConfig;

    // Root luôn dùng system key, không bị chặn hay giới hạn
    if (row.role === 'root' || row.role === 'admin') return systemConfig;

    const keys     = [];
    const serpKeys = [];

    // ── 1. Key cá nhân của user ───────────────────────────────────────────────
    if (row.gemini_api_key) {
      keys.push(row.gemini_api_key);
      if (row.serpapi_api_key) serpKeys.push(row.serpapi_api_key);
    }

    // ── 2–3. Key từ manager chain (tối đa 2 cấp) ─────────────────────────────
    if (row.use_manager_key && row.manager_id) {
      let currentManagerId = row.manager_id;
      for (let level = 0; level < 2 && currentManagerId; level++) {
        const mgrRes = await db.execute({
          sql: `SELECT gemini_api_key, serpapi_api_key, gemini_model, manager_id
                FROM users WHERE id = ?`,
          args: [currentManagerId],
        });
        const mgr = mgrRes.rows[0];
        if (!mgr || !mgr.gemini_api_key) break;

        keys.push(mgr.gemini_api_key);
        if (mgr.serpapi_api_key) serpKeys.push(mgr.serpapi_api_key);

        // Tiếp tục lên cấp trên (senior_manager)
        currentManagerId = mgr.manager_id || null;
      }
    }

    // ── 4. Key hệ thống (nếu được cấp quyền) ─────────────────────────────────
    if (row.use_system_key && systemConfig.apiKey) {
      keys.push(systemConfig.apiKey);
      if (systemConfig.serpApiKey) serpKeys.push(systemConfig.serpApiKey);
    }

    // ── Blocked: không có key nào ─────────────────────────────────────────────
    if (keys.length === 0) {
      return {
        blocked: true,
        message: 'Bạn chưa cấu hình API key. Vui lòng thêm Gemini API key cá nhân trong Cài đặt hoặc liên hệ admin để được cấp quyền dùng key hệ thống.',
      };
    }

    // usingSystemKey = true chỉ khi user không có key cá nhân và không có key manager
    // (tức là toàn bộ key đang dùng đều là key hệ thống)
    const hasOwnOrManagerKey = keys.some(k => k !== systemConfig.apiKey);

    // SerpAPI: dùng key của user/manager trước, fallback key hệ thống
    if (systemConfig.serpApiKey && !serpKeys.includes(systemConfig.serpApiKey)) {
      serpKeys.push(systemConfig.serpApiKey);
    }

    return {
      apiKey:         [...new Set(keys)].join(','),
      modelName:      row.gemini_model || systemConfig.modelName,
      serpApiKey:     [...new Set(serpKeys)].join(','),
      usingSystemKey: !hasOwnOrManagerKey,
      blocked:        false,
    };
  } catch {
    return systemConfig;
  }
}

module.exports = { getEffectiveApiConfig };
