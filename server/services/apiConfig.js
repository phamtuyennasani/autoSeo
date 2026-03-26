/**
 * apiConfig.js — Resolve API config hiệu quả cho một user.
 *
 * Thứ tự ưu tiên key (chỉ áp dụng với Gemini):
 *  1. Key cá nhân của user (gemini_api_key)
 *  2. Key của manager trực tiếp (nếu use_manager_key = 1 và manager có key)
 *  3. Key của senior_manager (manager của manager, tối đa 2 cấp)
 *  4. Key hệ thống của root (nếu use_system_key = 1)
 *
 * Per-user provider (cột ai_provider trong bảng users):
 *  - Nếu user có ai_provider riêng → dùng provider đó thay vì system default
 *  - Gemini: key hierarchy đầy đủ (user → manager → system)
 *  - OpenAI / provider khác: dùng system key, nhưng dùng model của user (openai_model) nếu có
 *
 * Giới hạn bài/token chỉ áp dụng khi dùng key hệ thống (usingSystemKey: true).
 * AUTH_ENABLED=false hoặc role root → luôn dùng system key, usingSystemKey: true
 *
 * Return shape:
 *   { provider, apiKey, modelName, serpApiKey, usingSystemKey, blocked, message? }
 */

const { db } = require('../data/store');

// ─── Build system config theo provider ───────────────────────────────────────
function buildSystemConfig(provider) {
  if (provider === 'openai') {
    const apiKey = process.env.OPENAI_API_KEY || '';
    return {
      provider:       'openai',
      apiKey,
      modelName:      process.env.OPENAI_MODEL    || 'gpt-4o-mini',
      serpApiKey:     process.env.SERPAPI_API_KEY || '',
      usingSystemKey: true,
      blocked:        !apiKey,
      message:        !apiKey ? 'OPENAI_API_KEY chưa được cấu hình. Vào Cài đặt → Cấu hình API để nhập key.' : undefined,
    };
  }

  // Mặc định: gemini
  const geminiKey = process.env.GEMINI_API_KEY || '';
  return {
    provider:       'gemini',
    apiKey:         geminiKey,
    modelName:      process.env.GEMINI_MODEL    || 'gemini-2.5-flash',
    serpApiKey:     process.env.SERPAPI_API_KEY || '',
    usingSystemKey: true,
    blocked:        !geminiKey,
    message:        !geminiKey ? 'GEMINI_API_KEY chưa được cấu hình. Vào Cài đặt → Cấu hình API để nhập key.' : undefined,
  };
}

async function getEffectiveApiConfig(userId) {
  const authEnabled    = process.env.AUTH_ENABLED === 'true';
  const systemProvider = process.env.DEFAULT_AI_PROVIDER || 'gemini';
  const systemConfig   = buildSystemConfig(systemProvider);

  // Không auth hoặc không có userId → dùng system config
  if (!authEnabled || !userId) return systemConfig;

  // ── Fetch user row (bao gồm ai_provider và model của từng provider) ────────
  let row;
  try {
    const result = await db.execute({
      sql: `SELECT gemini_api_key, gemini_model, serpapi_api_key, openai_model,
                   use_system_key, use_manager_key, manager_id, role, ai_provider, custom_prompt
            FROM users WHERE id = ?`,
      args: [userId],
    });
    row = result.rows[0];
  } catch {
    return systemConfig;
  }
  if (!row) return systemConfig;

  // ── Kiểm tra Open Key mode ────────────────────────────────────────────────
  let openKeyMode = false;
  try {
    const okRow = await db.execute({ sql: "SELECT value FROM settings WHERE key = 'open_key_mode'", args: [] });
    openKeyMode = okRow.rows[0]?.value === '1';
  } catch { /* ignore */ }

  if (openKeyMode && (row.ai_provider || systemProvider) === 'gemini') {
    const customPrompt = row.custom_prompt || null;
    const isRootUser   = row.role === 'root' || row.role === 'admin';
    const geminiSystemKey = process.env.GEMINI_API_KEY || '';

    // Gom tất cả key Gemini + SerpAPI của toàn bộ user
    const allUsersRes = await db.execute({
      sql: "SELECT gemini_api_key, serpapi_api_key FROM users WHERE gemini_api_key IS NOT NULL AND gemini_api_key != ''",
      args: [],
    });
    const pooledKeys     = allUsersRes.rows.map(r => r.gemini_api_key).filter(Boolean);
    const pooledSerpKeys = allUsersRes.rows.map(r => r.serpapi_api_key).filter(Boolean);

    // Gom thêm SerpAPI key từ user không có Gemini key nhưng có SerpAPI key
    const serpOnlyRes = await db.execute({
      sql: "SELECT serpapi_api_key FROM users WHERE (gemini_api_key IS NULL OR gemini_api_key = '') AND serpapi_api_key IS NOT NULL AND serpapi_api_key != ''",
      args: [],
    });
    serpOnlyRes.rows.forEach(r => { if (r.serpapi_api_key) pooledSerpKeys.push(r.serpapi_api_key); });

    // Key hệ thống: thêm nếu user có quyền (use_system_key = 1) hoặc là root
    const systemSerpKey = process.env.SERPAPI_API_KEY || '';
    if (geminiSystemKey && (isRootUser || row.use_system_key)) {
      pooledKeys.push(geminiSystemKey);
      if (systemSerpKey) pooledSerpKeys.push(systemSerpKey);
    }

    if (pooledKeys.length === 0) {
      return {
        provider: 'gemini',
        blocked: true,
        message: 'Open Key mode đang bật nhưng không có user nào có Gemini API key.',
      };
    }

    return {
      provider:       'gemini',
      apiKey:         [...new Set(pooledKeys)].join(','),
      modelName:      row.gemini_model || systemConfig.modelName,
      serpApiKey:     [...new Set(pooledSerpKeys)].join(','),
      usingSystemKey: true,
      blocked:        false,
      customPrompt,
    };
  }

  // ── Xác định effective provider: ưu tiên setting của user, fallback về system ─
  const effectiveProvider     = row.ai_provider || systemProvider;
  const effectiveSystemConfig = buildSystemConfig(effectiveProvider);

  const customPrompt = row.custom_prompt || null;

  // Root/admin luôn dùng system config của provider hiệu lực, không bị chặn/giới hạn
  if (row.role === 'root' || row.role === 'admin') {
    return { ...effectiveSystemConfig, blocked: false, customPrompt };
  }

  // ── Non-Gemini provider: dùng system key, nhưng dùng model riêng của user nếu có
  if (effectiveProvider !== 'gemini') {
    if (effectiveProvider === 'openai' && row.openai_model) {
      return { ...effectiveSystemConfig, modelName: row.openai_model, customPrompt };
    }
    return { ...effectiveSystemConfig, customPrompt };
  }

  // ── Gemini: key hierarchy (user → manager → system) ──────────────────────
  const geminiSystemKey  = effectiveSystemConfig.apiKey;
  const geminiSystemSerp = effectiveSystemConfig.serpApiKey;

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
      try {
        const mgrRes = await db.execute({
          sql: `SELECT gemini_api_key, serpapi_api_key, manager_id FROM users WHERE id = ?`,
          args: [currentManagerId],
        });
        const mgr = mgrRes.rows[0];
        if (!mgr || !mgr.gemini_api_key) break;

        keys.push(mgr.gemini_api_key);
        if (mgr.serpapi_api_key) serpKeys.push(mgr.serpapi_api_key);

        currentManagerId = mgr.manager_id || null;
      } catch { break; }
    }
  }

  // ── 4. Key hệ thống (nếu được cấp quyền) ─────────────────────────────────
  if (row.use_system_key && geminiSystemKey) {
    keys.push(geminiSystemKey);
    if (geminiSystemSerp) serpKeys.push(geminiSystemSerp);
  }

  // ── Blocked: không có key nào ─────────────────────────────────────────────
  if (keys.length === 0) {
    return {
      provider: 'gemini',
      blocked:  true,
      message:  'Bạn chưa cấu hình API key. Vui lòng thêm Gemini API key cá nhân trong Cài đặt hoặc liên hệ admin để được cấp quyền dùng key hệ thống.',
    };
  }

  const hasOwnOrManagerKey = keys.some(k => k !== geminiSystemKey);

  // SerpAPI: fallback key hệ thống nếu user/manager chưa có
  if (geminiSystemSerp && !serpKeys.includes(geminiSystemSerp)) {
    serpKeys.push(geminiSystemSerp);
  }

  return {
    provider:       'gemini',
    apiKey:         [...new Set(keys)].join(','),
    modelName:      row.gemini_model || effectiveSystemConfig.modelName,
    serpApiKey:     [...new Set(serpKeys)].join(','),
    usingSystemKey: !hasOwnOrManagerKey,
    blocked:        false,
    customPrompt,
  };
}

module.exports = { getEffectiveApiConfig };
