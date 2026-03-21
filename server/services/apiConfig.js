/**
 * apiConfig.js — Resolve API config hiệu quả cho một user.
 *
 * Logic (AUTH_ENABLED=true, non-admin user):
 *  1. User có gemini_api_key riêng → dùng key đó, usingSystemKey: false, không bị giới hạn
 *  2. User không có key nhưng use_system_key=1 → dùng key hệ thống, usingSystemKey: true, bị giới hạn
 *  3. User không có key và use_system_key=0 → blocked: true (không thể viết)
 *
 * AUTH_ENABLED=false hoặc admin → luôn dùng system key, usingSystemKey: true
 */

const { db } = require('../data/store');

async function getEffectiveApiConfig(userId) {
  const authEnabled = process.env.AUTH_ENABLED === 'true';

  const systemConfig = {
    apiKey:         process.env.GEMINI_API_KEY   || '',
    modelName:      process.env.GEMINI_MODEL     || 'gemini-2.5-flash',
    serpApiKey:     process.env.SERPAPI_API_KEY  || '',
    usingSystemKey: true,
    blocked:        false,
  };

  if (!authEnabled || !userId) return systemConfig;

  try {
    const result = await db.execute({
      sql: 'SELECT gemini_api_key, gemini_model, serpapi_api_key, use_system_key, role FROM users WHERE id = ?',
      args: [userId],
    });
    const row = result.rows[0];
    if (!row) return systemConfig;

    // Root luôn dùng system key, không bị chặn hay giới hạn
    if (row.role === 'root' || row.role === 'admin') return systemConfig;

    // User có API key riêng → dùng key đó, không bị giới hạn
    if (row.gemini_api_key) {
      // Nếu admin cũng bật use_system_key → gộp key hệ thống vào rotation
      let apiKey = row.gemini_api_key;
      if (row.use_system_key && systemConfig.apiKey) {
        apiKey = [systemConfig.apiKey, row.gemini_api_key].filter(Boolean).join(',');
      }
      // SerpAPI: kết hợp key user + key hệ thống để fallback (user key ưu tiên hơn)
      const serpKeys = [row.serpapi_api_key, systemConfig.serpApiKey].filter(Boolean);
      return {
        apiKey,
        modelName:      row.gemini_model || systemConfig.modelName,
        serpApiKey:     serpKeys.join(','),
        usingSystemKey: false, // có key riêng → không tính giới hạn bài/ngày
        blocked:        false,
      };
    }

    // User không có key riêng → kiểm tra quyền dùng key hệ thống
    if (row.use_system_key) {
      return { ...systemConfig, usingSystemKey: true, blocked: false };
    }

    // Bị chặn: không có key riêng, không được dùng key hệ thống
    return {
      blocked: true,
      message: 'Bạn chưa cấu hình API key. Vui lòng thêm Gemini API key cá nhân trong Cài đặt hoặc liên hệ admin để được cấp quyền dùng key hệ thống.',
    };
  } catch {
    return systemConfig;
  }
}

module.exports = { getEffectiveApiConfig };
