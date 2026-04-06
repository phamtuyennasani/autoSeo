/**
 * settingsService.js — Shared settings helpers
 *
 * Gom getSetting + setSetting vào đây để tránh trùng lặp.
 * Dùng bởi: routes/settings.js, jobs/batchJobChecker.js, và bất kỳ file nào cần.
 */

const { db } = require('../data/store');

/**
 * Đọc 1 setting từ DB.
 * @param {string} key - key của setting
 * @returns {Promise<string|null>}
 */
async function getSetting(key) {
  const result = await db.execute({ sql: 'SELECT value FROM settings WHERE key = ?', args: [key] });
  return result.rows[0]?.value ?? null;
}

/**
 * Ghi hoặc cập nhật 1 setting vào DB (upsert).
 * @param {string} key
 * @param {string} value
 * @param {string} [label] - mô tả (chỉ dùng khi INSERT lần đầu)
 */
async function setSetting(key, value, label = '') {
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO settings (key, value, label, updatedAt) VALUES (?, ?, ?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt`,
    args: [key, String(value ?? ''), label, now],
  });
}

module.exports = { getSetting, setSetting };
