/**
 * api.js — Axios instance với interceptors Auth.
 *
 * - Tự gắn Authorization: Bearer <token> từ localStorage
 * - Nếu server trả 401 → xóa token, redirect /login
 */

import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// URLs thuần (không dùng axios, giữ lại cho compatibility)
export const API = {
  base:       BASE_URL,
  keywords:   `${BASE_URL}/api/keywords`,
  companies:  `${BASE_URL}/api/companies`,
  articles:   `${BASE_URL}/api/articles`,
  batchJobs:  `${BASE_URL}/api/batch-jobs`,
  stats:      `${BASE_URL}/api/stats`,
  settings:   `${BASE_URL}/api/settings`,
  writeQueue: `${BASE_URL}/api/write-queue`,
  auth:       `${BASE_URL}/api/auth`,
  users:      `${BASE_URL}/api/users`,
  keywordPlans:    `${BASE_URL}/api/keyword-plans`,
  websiteAnalysis: `${BASE_URL}/api/website-analysis`,
};

// Axios instance mặc định
const apiClient = axios.create({ baseURL: BASE_URL });

// Request interceptor: gắn token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('autoseo_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: 401 → auto logout
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Chỉ redirect nếu không phải đang ở trang login
      const isLoginPath = window.location.pathname === '/login';
      const isPublicPath = error.config?.url?.includes('/api/auth/');
      if (!isLoginPath && !isPublicPath) {
        localStorage.removeItem('autoseo_token');
        localStorage.removeItem('autoseo_user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
