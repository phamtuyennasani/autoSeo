/**
 * apiConfig.js — Resolve API config hiệu quả cho một user.
 *
 * NGUYÊN TẮC:
 *  - process.env (GEMINI_API_KEY, OPENAI_API_KEY, etc.) → CHỈ dành cho root/admin
 *  - Non-root muốn dùng system key → phải từ bảng settings trong DB, KHÔNG dùng env
 *  - use_system_key = 1 cho non-root → chỉ thêm key từ settings DB, không thêm env key
 *
 * Thứ tự ưu tiên key Gemini cho non-root (chỉ dùng settings DB):
 *  1. Key cá nhân của user (users.gemini_api_key, decrypted)
 *  2. Key của manager chain (tối đa 2 cấp) — chỉ khi use_manager_key = 1
 *  3. Key hệ thống từ settings DB (settings.gemini_api_key) — chỉ khi use_system_key = 1
 *
 * Root/admin → luôn dùng settings DB → env fallback (env chỉ là backup cho root)
 *
 * Return shape:
 *   { provider, apiKey, modelName, serpApiKey, usingSystemKey, blocked, message? }
 */

const { db } = require('../data/store');
const { decrypt } = require('../utils/crypto');

// ─── Kiểm tra user có phải root/admin không ───────────────────────────────────
function isRootRole(row) {
  return row?.role === 'root' || row?.role === 'admin';
}

// ─── Build system config theo provider ─────────────────────────────────────────
// For root: DB → process.env fallback (env là backup cho root)
// For non-root: DB only (KHÔNG dùng env)
function buildSystemConfig(provider, sv = {}, forRoot = false) {
  /**
   * sv = systemValues: key/value từ bảng settings (đã decrypt)
   * forRoot = true: dùng process.env làm fallback (root mới được phép)
   * forRoot = false: KHÔNG dùng process.env — non-root phải lấy từ DB
   */

  const openaiKey   = forRoot ? (sv.openai_api_key   || process.env.OPENAI_API_KEY   || '') : (sv.openai_api_key   || '');
  const claudeKey   = forRoot ? (sv.claude_api_key   || process.env.ANTHROPIC_API_KEY || '') : (sv.claude_api_key   || '');
  const geminiKey   = forRoot ? (sv.gemini_api_key   || process.env.GEMINI_API_KEY   || '') : (sv.gemini_api_key   || '');
  const serpKey     = forRoot ? (sv.serpapi_api_key  || process.env.SERPAPI_API_KEY  || '') : (sv.serpapi_api_key  || '');
  const claudeBase  = forRoot ? (sv.claude_base_url  || process.env.CLAUDE_BASE_URL  || '') : (sv.claude_base_url  || '');

  if (provider === 'openai') {
    return {
      provider:       'openai',
      apiKey:         openaiKey,
      modelName:      sv.openai_model || (forRoot ? process.env.OPENAI_MODEL : '') || 'gpt-4o-mini',
      serpApiKey:     serpKey,
      usingSystemKey: true,
      blocked:        !openaiKey,
      message:        !openaiKey ? 'OpenAI API key chưa được cấu hình. Vào Cài đặt → Cấu hình API để nhập key.' : undefined,
    };
  }

  if (provider === 'claude') {
    return {
      provider:       'claude',
      apiKey:         claudeKey,
      modelName:      sv.claude_model || (forRoot ? process.env.CLAUDE_MODEL : '') || 'claude-sonnet-4-20250514',
      claudeBaseUrl:  claudeBase,
      serpApiKey:     serpKey,
      usingSystemKey: true,
      blocked:        !claudeKey,
      message:        !claudeKey ? 'Claude API key chưa được cấu hình. Vào Cài đặt → Cấu hình API để nhập key.' : undefined,
    };
  }

  // Mặc định: gemini
  return {
    provider:       'gemini',
    apiKey:         geminiKey,
    modelName:      sv.gemini_model || (forRoot ? process.env.GEMINI_MODEL : '') || 'gemini-2.5-flash-lite',
    serpApiKey:     serpKey,
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
  const sv             = await fetchSystemValues();
  const systemProvider = sv.default_ai_provider || process.env.DEFAULT_AI_PROVIDER || 'gemini';

  // Không auth hoặc không có userId → dùng system config (root fallback)
  if (!authEnabled || !userId) {
    return buildSystemConfig(systemProvider, sv, true); // forRoot=true → env fallback
  }

  // ── Fetch user row ─────────────────────────────────────────────────────────
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
    return buildSystemConfig(systemProvider, sv, true); // forRoot=true → env fallback
  }
  if (!row) {
    return buildSystemConfig(systemProvider, sv, true);
  }

  const customPrompt = row.custom_prompt || null;
  const rootUser    = isRootRole(row);

  // ── Open Key mode: gom key từ tất cả user (root-only system key) ───────────
  let openKeyMode = false;
  try {
    const okRow = await db.execute({ sql: "SELECT value FROM settings WHERE key = 'open_key_mode'", args: [] });
    openKeyMode = okRow.rows[0]?.value === '1';
  } catch { /* ignore */ }

  if (openKeyMode && (row.ai_provider || systemProvider) === 'gemini') {
    const allUsersRes = await db.execute({
      sql: "SELECT gemini_api_key, serpapi_api_key FROM users WHERE gemini_api_key IS NOT NULL AND gemini_api_key != ''",
      args: [],
    });
    const pooledKeys     = allUsersRes.rows.map(r => decrypt(r.gemini_api_key)).filter(Boolean);
    const pooledSerpKeys = allUsersRes.rows.map(r => decrypt(r.serpapi_api_key)).filter(Boolean);

    // SerpAPI-only users
    const serpOnlyRes = await db.execute({
      sql: "SELECT serpapi_api_key FROM users WHERE (gemini_api_key IS NULL OR gemini_api_key = '') AND serpapi_api_key IS NOT NULL AND serpapi_api_key != ''",
      args: [],
    });
    serpOnlyRes.rows.forEach(r => { if (r.serpapi_api_key) pooledSerpKeys.push(decrypt(r.serpapi_api_key)); });

    // Open Key mode: nếu user có quyền dùng system key → chỉ trả system key (KHÔNG pool user key)
    // Nếu không có quyền system key → pool tất cả user key (combo mode cũ)
    if (rootUser) {
      // Root: pool user keys + env key
      const envGeminiKey = process.env.GEMINI_API_KEY || '';
      const envSerpKey   = process.env.SERPAPI_API_KEY  || '';
      if (envGeminiKey)  pooledKeys.push(envGeminiKey);
      if (envSerpKey)    pooledSerpKeys.push(envSerpKey);
    } else if (row.use_system_key) {
      // Non-root dùng system key: KHÔNG pool user key, chỉ trả system key (DB)
      const dbKey  = sv.gemini_api_key   || '';
      const dbSerp = sv.serpapi_api_key  || '';
      if (dbKey) {
        return {
          provider:       'gemini',
          apiKey:         dbKey,
          serpApiKey:     dbSerp || '',
          modelName:      row.gemini_model || buildSystemConfig(systemProvider, sv, true).modelName,
          usingSystemKey: true,
          blocked:        false,
          customPrompt,
        };
      }
      // System key chưa có trong DB → blocked
      return {
        provider: 'gemini',
        blocked: true,
        message: 'Open Key mode đang bật nhưng System Settings chưa có Gemini API key.',
      };
    }
    // Non-root KHÔNG có quyền system key → pool tất cả user key

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
      modelName:      row.gemini_model || buildSystemConfig(systemProvider, sv, true).modelName,
      serpApiKey:     [...new Set(pooledSerpKeys)].join(','),
      usingSystemKey: true,
      blocked:        false,
      customPrompt,
    };
  }

  // ── Xác định effective provider ───────────────────────────────────────────
  const effectiveProvider = row.ai_provider || systemProvider;

  // Root: DB → process.env fallback
  if (rootUser) {
    const rootConfig = buildSystemConfig(effectiveProvider, sv, true);
    return { ...rootConfig, blocked: false, customPrompt };
  }

  // ── Non-root: KHÔNG dùng process.env ──────────────────────────────────────
  const sysCfg = buildSystemConfig(effectiveProvider, sv, false); // forRoot=false

  if (effectiveProvider === 'openai') {
    // Non-root: key phải từ settings DB, không env
    return {
      provider:       'openai',
      apiKey:         sv.openai_api_key || '',
      modelName:      row.openai_model || sv.openai_model || 'gpt-4o-mini',
      serpApiKey:     sv.serpapi_api_key || '',
      usingSystemKey: !!sv.openai_api_key,
      blocked:        !sv.openai_api_key,
      message:        !sv.openai_api_key ? 'OpenAI API key chưa được cấu hình trong System Settings.' : undefined,
      customPrompt,
    };
  }

  if (effectiveProvider === 'claude') {
    if (row.anthropic_api_key) {
      return {
        provider:       'claude',
        apiKey:         row.anthropic_api_key,
        modelName:      row.anthropic_model || sv.claude_model || 'claude-sonnet-4-20250514',
        claudeBaseUrl:  sv.claude_base_url || '',
        usingSystemKey: false,
        blocked:        false,
        customPrompt,
      };
    }
    // Non-root: system key từ DB settings, không env
    return {
      provider:       'claude',
      apiKey:         sv.claude_api_key || '',
      modelName:      row.anthropic_model || sv.claude_model || 'claude-sonnet-4-20250514',
      claudeBaseUrl:  sv.claude_base_url || '',
      serpApiKey:     sv.serpapi_api_key || '',
      usingSystemKey: !!sv.claude_api_key,
      blocked:        !sv.claude_api_key,
      message:        !sv.claude_api_key ? 'Claude API key chưa được cấu hình trong System Settings.' : undefined,
      customPrompt,
    };
  }

  // ── Gemini non-root: key hierarchy DB-only ───────────────────────────────────
  // NGUYÊN TẮC:
  //   use_system_key = 1  → CHỈ system key từ settings DB, KHÔNG dùng key cá nhân
  //   use_system_key = 0  → CHỈ key cá nhân/manager, KHÔNG dùng system key
  // System key KHÔNG bao giờ là "fallback" — không pool chung với user key.
  const geminiSystemKey  = sysCfg.apiKey;
  const geminiSystemSerp = sysCfg.serpApiKey;

  if (row.use_system_key) {
    // Mode "dùng system key" — chỉ trả system key, KHÔNG pool thêm user key
    if (!geminiSystemKey) {
      return {
        provider: 'gemini',
        blocked:  true,
        message:  'Bạn được cấp quyền dùng key hệ thống nhưng System Settings chưa có Gemini API key.',
      };
    }
    return {
      provider:       'gemini',
      apiKey:         geminiSystemKey,
      serpApiKey:     geminiSystemSerp || '',
      modelName:      row.gemini_model || sysCfg.modelName,
      usingSystemKey: true,
      blocked:        false,
      customPrompt,
    };
  }

  // Mode "dùng key cá nhân" — KHÔNG thêm system key
  const keys     = [];
  const serpKeys = [];

  // 1. Key cá nhân
  if (row.gemini_api_key) {
    keys.push(decrypt(row.gemini_api_key));
    if (row.serpapi_api_key) serpKeys.push(decrypt(row.serpapi_api_key));
  }

  // 2–3. Manager chain (chỉ khi có quyền)
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

  if (keys.length === 0) {
    return {
      provider: 'gemini',
      blocked:  true,
      message:  'Bạn chưa cấu hình Gemini API key cá nhân và chưa được cấp quyền dùng key hệ thống.',
    };
  }

  return {
    provider:       'gemini',
    apiKey:         [...new Set(keys)].join(','),
    serpApiKey:     serpKeys.length > 0 ? [...new Set(serpKeys)].join(',') : '',
    modelName:      row.gemini_model || sysCfg.modelName,
    usingSystemKey: false,
    blocked:        false,
    customPrompt,
  };
}

module.exports = { getEffectiveApiConfig };
