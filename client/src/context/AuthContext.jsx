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

    const init = async () => {
      try {
        // Bước 1: hỏi server AUTH có bật không (endpoint public, không cần token)
        const statusRes = await apiClient.get('/api/auth/status');
        const enabled = statusRes.data.authEnabled;
        setAuthEnabled(enabled);

        if (!enabled) {
          // Bypass mode — lấy thông tin admin từ /me (không cần token)
          const meRes = await apiClient.get('/api/auth/me');
          setUser(meRes.data);
          setToken(null);
          return;
        }

        // AUTH bật — thử restore token đã lưu
        if (savedToken) {
          try {
            const meRes = await apiClient.get('/api/auth/me', {
              headers: { Authorization: `Bearer ${savedToken}` },
            });
            setUser(meRes.data);
            setToken(savedToken);
          } catch {
            // Token hết hạn hoặc không hợp lệ → clear
            localStorage.removeItem('autoseo_token');
            localStorage.removeItem('autoseo_user');
            setUser(null);
            setToken(null);
          }
        }
      } catch {
        // Không kết nối được server
        setAuthEnabled(false);
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

  const loginWithGoogle = async (accessToken) => {
    const res = await apiClient.post('/api/auth/google', { access_token: accessToken });
    const { token: newToken, user: newUser } = res.data;
    setToken(newToken);
    setUser(newUser);
    setAuthEnabled(true);
    localStorage.setItem('autoseo_token', newToken);
    localStorage.setItem('autoseo_user', JSON.stringify(newUser));
    return newUser;
  };

  const updateUser = (data) => {
    setUser(prev => {
      const updated = { ...prev, ...data };
      localStorage.setItem('autoseo_user', JSON.stringify(updated));
      return updated;
    });
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

  // ── Role helpers ──────────────────────────────────────────────────────────
  const isRoot          = ['root', 'admin'].includes(user?.role);
  const isSeniorManager = user?.role === 'senior_manager';
  const isManager       = user?.role === 'manager';
  const isEmployee      = ['employee', 'user'].includes(user?.role);
  const canManageUsers  = isRoot || isSeniorManager || isManager;

  return (
    <AuthContext.Provider value={{
      user, token, loading, authEnabled,
      login, loginWithGoogle, logout, updateUser,
      isRoot, isSeniorManager, isManager, isEmployee, canManageUsers,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth phải dùng trong AuthProvider');
  return ctx;
}
