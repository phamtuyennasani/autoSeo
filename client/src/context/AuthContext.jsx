/**
 * AuthContext.jsx — Quản lý trạng thái xác thực toàn cục.
 *
 * State: user, token, loading, authEnabled
 * Methods: login(username, password), logout()
 * Auto-restore từ localStorage khi load app.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import apiClient from '../config/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authEnabled, setAuthEnabled] = useState(false);

  // Auto-restore từ localStorage
  useEffect(() => {
    const savedToken = localStorage.getItem('autoseo_token');
    const savedUser  = localStorage.getItem('autoseo_user');

    // Kiểm tra server có bật AUTH không (thử gọi /me không cần token)
    const init = async () => {
      try {
        // Test nhanh: gọi /api/auth/me để biết server đang ở mode nào
        const headers = savedToken ? { Authorization: `Bearer ${savedToken}` } : {};
        const res = await apiClient.get('/api/auth/me', { headers });
        // Nếu không cần token (bypass mode) → AUTH_ENABLED=false
        setAuthEnabled(false);
        setUser(res.data);
        setToken(null);
      } catch (err) {
        if (err.response?.status === 401 && !savedToken) {
          // Server bật AUTH và chưa đăng nhập
          setAuthEnabled(true);
          setUser(null);
          setToken(null);
        } else if (savedToken) {
          // Có token, thử restore
          try {
            const res = await apiClient.get('/api/auth/me', {
              headers: { Authorization: `Bearer ${savedToken}` },
            });
            setUser(res.data);
            setToken(savedToken);
            setAuthEnabled(true);
          } catch {
            // Token hết hạn → clear
            localStorage.removeItem('autoseo_token');
            localStorage.removeItem('autoseo_user');
            setAuthEnabled(true);
            setUser(null);
            setToken(null);
          }
        } else {
          setAuthEnabled(false);
          setUser(null);
        }
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  const login = async (username, password) => {
    const res = await apiClient.post('/api/auth/login', { username, password });
    const { token: newToken, user: newUser } = res.data;
    setToken(newToken);
    setUser(newUser);
    setAuthEnabled(true);
    localStorage.setItem('autoseo_token', newToken);
    localStorage.setItem('autoseo_user', JSON.stringify(newUser));
    return newUser;
  };

  const logout = async () => {
    try {
      await apiClient.post('/api/auth/logout');
    } catch { /* ignore */ }
    setToken(null);
    setUser(null);
    localStorage.removeItem('autoseo_token');
    localStorage.removeItem('autoseo_user');
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, authEnabled, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth phải dùng trong AuthProvider');
  return ctx;
}
