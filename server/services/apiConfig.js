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
 *  - OpenAI / Claude / provider khác: dùng system key (từ DB → process.env fallback),
 *    nhưng dùng model/key riêng của user nếu có
 *
 * Giới hạn bài/token chỉ áp dụng khi dùng key hệ thống (usingSystemKey: true).
 * AUTH_ENABLED=false hoặc role root → luôn dùng system key, usingSystemKey: true
 *
 * Return shape:
 *   { provider, apiKey, modelName, serpApiKey, usingSystemKey, blocked, message? }
 */

const { db } = require('../data/store');
const { decrypt } = require('../utils/crypto');

// ─── Build system config theo provider (DB first, env fallback) ─────────────────
function buildSystemConfig(provider, sv = {}) {
  /**
   * sv = systemValues: { gemini_api_key, openai_api_key, claude_api_key,
   *                      gemini_model, openai_model, claude_model, claude_base_url,
   *                      serpapi_api_key }
   * Nếu không có trong sv → fallback về process.env tương ứng.
   */

  const openaiKey = sv.openai_api_key || process.env.OPENAI_API_KEY || '';
  const claudeKey = sv.claude_api_key || process.env.ANTHROPIC_API_KEY || '';
  const geminiKey = sv.gemini_api_key || process.env.GEMINI_API_KEY || '';
  const claudeBaseUrl = sv.claude_base_url || process.env.CLAUDE_BASE_URL || '';

  if (provider === 'openai') {
    return {
      provider:       'openai',
      apiKey:         openaiKey,
      modelName:      sv.openai_model || process.env.OPENAI_MODEL || 'gpt-4o-mini',
      serpApiKey:     sv.serpapi_api_key || process.env.SERPAPI_API_KEY || '',
      usingSystemKey: true,
      blocked:        !openaiKey,
      message:        !openaiKey ? 'OpenAI API key chưa được cấu hình. Vào Cài đặt → Cấu hình API để nhập key.' : undefined,
    };
  }

  if (provider === 'claude') {
    return {
      provider:       'claude',
      apiKey:         claudeKey,
      modelName:      sv.claude_model || process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
      claudeBaseUrl,
      serpApiKey:     sv.serpapi_api_key || process.env.SERPAPI_API_KEY || '',
      usingSystemKey: true,
      blocked:        !claudeKey,
      message:        !claudeKey ? 'Claude API key chưa được cấu hình. Vào Cài đặt → Cấu hình API để nhập key.' : undefined,
    };
  }

  // Mặc định: gemini
  return {
    provider:       'gemini',
    apiKey:         geminiKey,
    modelName:      sv.gemini_model || process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite',
    serpApiKey:     sv.serpapi_api_key || process.env.SERPAPI_API_KEY || '',
    usingSystemKey: true,
    blocked:        !geminiKey,
    message:        !geminiKey ? 'Gemini API key chưa được cấu hình. Vào Cài đặt → Cấu hình API để nhập key.' : undefined,
  };
}

// ─── Fetch all system settings từ DB (decrypted) ──────────────────────────────
async function fetchSystemValues() {
  try {
    const rows = await db.execute({
      sql: `SELECT key, value FROM settings WHERE key IN (
        'gemini_api_key', 'openai_api_key', 'claude_api_key',
        'gemini_model', 'openai_model', 'claude_model', 'claude_base_url', 'serpapi_api_key'
      )`,
    });
    const sv = {};
    for (const row of rows.rows) {
      if (!row.value) continue;
      const isKey = ['gemini_api_key', 'openai_api_key', 'claude_api_key', 'serpapi_api_key'].includes(row.key);
      sv[row.key] = isKey ? decrypt(row.value) : row.value;
    }
    return sv;
  } catch {
    return {};
  }
}

async function getEffectiveApiConfig(userId) {
  const authEnabled    = process.env.AUTH_ENABLED === 'true';
  // Đọc provider từ DB trước, fallback env
  const sv             = await fetchSystemValues();
  const systemProvider = sv.default_ai_provider || process.env.DEFAULT_AI_PROVIDER || 'gemini';
  const systemConfig   = buildSystemConfig(systemProvider, sv);

  // Không auth hoặc không có userId → dùng system config
  if (!authEnabled || !userId) return systemConfig;

  // ── Fetch user row (bao gồm ai_provider và model của từng provider) ────────
  let row;
  try {
    const result = await db.execute({
      sql: `SELECT gemini_api_key, gemini_model, serpapi_api_key, openai_model,
                   use_system_key, use_manager_key, manager_id, role, ai_provider, custom_prompt,
                   anthropic_api_key, anthropic_model
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
    const geminiSystemKey = sv.gemini_api_key || process.env.GEMINI_API_KEY || '';

    // Gom tất cả key Gemini + SerpAPI của toàn bộ user
    const allUsersRes = await db.execute({
      sql: "SELECT gemini_api_key, serpapi_api_key FROM users WHERE gemini_api_key IS NOT NULL AND gemini_api_key != ''",
      args: [],
    });
    const pooledKeys     = allUsersRes.rows.map(r => decrypt(r.gemini_api_key)).filter(Boolean);
    const pooledSerpKeys = allUsersRes.rows.map(r => decrypt(r.serpapi_api_key)).filter(Boolean);

    // Gom thêm SerpAPI key từ user không có Gemini key nhưng có SerpAPI key
    const serpOnlyRes = await db.execute({
      sql: "SELECT serpapi_api_key FROM users WHERE (gemini_api_key IS NULL OR gemini_api_key = '') AND serpapi_api_key IS NOT NULL AND serpapi_api_key != ''",
      args: [],
    });
    serpOnlyRes.rows.forEach(r => { if (r.serpapi_api_key) pooledSerpKeys.push(decrypt(r.serpapi_api_key)); });

    // Key hệ thống: thêm nếu user có quyền (use_system_key = 1) hoặc là root
    const systemSerpKey = sv.serpapi_api_key || process.env.SERPAPI_API_KEY || '';
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
  const effectiveSystemConfig = buildSystemConfig(effectiveProvider, sv);

  const customPrompt = row.custom_prompt || null;

  // Root/admin luôn dùng system config của provider hiệu lực, không bị chặn/giới hạn
  if (row.role === 'root' || row.role === 'admin') {
    return { ...effectiveSystemConfig, blocked: false, customPrompt };
  }

  // ── Non-Gemini provider: dùng system key, nhưng dùng model riêng của user nếu có
  if (effectiveProvider === 'openai') {
    return {
      provider:       'openai',
      apiKey:         sv.openai_api_key || process.env.OPENAI_API_KEY || '',
      modelName:      row.openai_model || sv.openai_model || process.env.OPENAI_MODEL || 'gpt-4o-mini',
      serpApiKey:     sv.serpapi_api_key || process.env.SERPAPI_API_KEY || '',
      usingSystemKey: true,
      blocked:        !(sv.openai_api_key || process.env.OPENAI_API_KEY),
      customPrompt,
    };
  }

  if (effectiveProvider === 'claude') {
    const userKey = row.anthropic_api_key;
    if (userKey) {
      return {
        provider:       'claude',
        apiKey:         userKey,
        modelName:      row.anthropic_model || sv.claude_model || process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
        claudeBaseUrl: sv.claude_base_url || process.env.CLAUDE_BASE_URL || '',
        usingSystemKey: false,
        blocked:        false,
        customPrompt,
      };
    }
    // Fallback: dùng system key (DB → env)
    return {
      provider:       'claude',
      apiKey:         sv.claude_api_key || process.env.ANTHROPIC_API_KEY || '',
      modelName:      sv.claude_model || process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
      claudeBaseUrl: sv.claude_base_url || process.env.CLAUDE_BASE_URL || '',
      serpApiKey:     sv.serpapi_api_key || process.env.SERPAPI_API_KEY || '',
      usingSystemKey: true,
      blocked:        !(sv.claude_api_key || process.env.ANTHROPIC_API_KEY),
      customPrompt,
    };
  }

  // Mặc định gemini → key hierarchy (giữ nguyên logic cũ)

  // ── Gemini: key hierarchy (user → manager → system) ──────────────────────
  const geminiSystemKey  = effectiveSystemConfig.apiKey;
  const geminiSystemSerp = effectiveSystemConfig.serpApiKey;

  const keys     = [];
  const serpKeys = [];

  // ── 1. Key cá nhân của user (giải mã trước khi dùng) ───────────────────
  if (row.gemini_api_key) {
    keys.push(decrypt(row.gemini_api_key));
    if (row.serpapi_api_key) serpKeys.push(decrypt(row.serpapi_api_key));
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

        keys.push(decrypt(mgr.gemini_api_key));
        if (mgr.serpapi_api_key) serpKeys.push(decrypt(mgr.serpapi_api_key));

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
