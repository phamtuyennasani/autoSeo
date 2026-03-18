/**
 * api.js — Cấu hình base URL cho toàn bộ client.
 *
 * Cách hoạt động:
 *   - `npm run dev`   → đọc .env.development  → VITE_API_URL=http://localhost:3001
 *   - `npm run build` → đọc .env.production   → VITE_API_URL=https://your-server.com
 *
 * Để thay đổi URL prod: chỉ cần sửa .env.production (không chạm vào code)
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const API = {
  base:       BASE_URL,
  keywords:   `${BASE_URL}/api/keywords`,
  companies:  `${BASE_URL}/api/companies`,
  articles:   `${BASE_URL}/api/articles`,
  batchJobs:  `${BASE_URL}/api/batch-jobs`,
  stats:      `${BASE_URL}/api/stats`,
  settings:   `${BASE_URL}/api/settings`,
};

export default API;
