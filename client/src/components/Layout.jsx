import React from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Search, Building2, Zap, Settings, HelpCircle, Sun, Moon, Cpu, TrendingUp, Layers, Users, LogOut, BarChart3 } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useToken } from '../context/TokenContext';
import { useAuth } from '../context/AuthContext';

const pageTitles = {
  '/keywords':     'SEO Keywords',
  '/companies':    'Website & Công Ty',
  '/batch-jobs':   'Batch Jobs',
  '/token-stats':  'Token & Chi Phí',
  '/settings':     'Cài Đặt',
  '/help':         'Trợ Giúp',
  '/users':        'Quản Lý Users',
};

// Format số token lớn cho dễ đọc: 1234567 → 1.23M, 12345 → 12.3K
const formatTokens = (n) => {
  if (!n) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
};

const Layout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { tokenStats } = useToken();
  const { user, logout, authEnabled } = useAuth();
  const currentTitle = pageTitles[location.pathname] || 'Dashboard';

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isAdmin = user?.role === 'admin';
  const displayName = user?.full_name || user?.username || 'Admin';
  const avatarChar = displayName.charAt(0).toUpperCase();
  return (
    <div className="app-container">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo">
            <div className="logo-icon">
              <Zap size={17} color="white" />
            </div>
            <span className="logo-text">AutoSEO</span>
            <span className="logo-badge">PRO</span>
          </div>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-label">Chức năng</div>
          <NavLink to="/keywords" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Search size={17} className="nav-icon" /> Từ Khóa SEO
          </NavLink>
          <NavLink to="/companies" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Building2 size={17} className="nav-icon" /> Website / Công Ty
          </NavLink>
          <NavLink to="/batch-jobs" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Layers size={17} className="nav-icon" /> Batch Jobs
          </NavLink>
          <NavLink to="/token-stats" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <BarChart3 size={17} className="nav-icon" /> Token & Chi Phí
          </NavLink>
        </div>

        <div style={{ marginTop: 'auto' }}>
          <div className="sidebar-section">
            {/* Menu Users — chỉ admin và khi AUTH bật */}
            {authEnabled && isAdmin && (
              <NavLink to="/users" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <Users size={17} className="nav-icon" /> Quản lý Users
              </NavLink>
            )}
            <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Settings size={17} className="nav-icon" /> Cài đặt
            </NavLink>
            <NavLink to="/help" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <HelpCircle size={17} className="nav-icon" /> Trợ giúp
            </NavLink>
          </div>

          <div className="sidebar-footer">
            <div className="sidebar-footer-avatar">{avatarChar}</div>
            <div className="sidebar-footer-info">
              <div className="sidebar-footer-name">{displayName}</div>
              <div className="sidebar-footer-role">{isAdmin ? 'Admin' : 'User'}</div>
            </div>
            {/* Nút Logout — chỉ hiện khi AUTH bật */}
            {authEnabled && (
              <button
                onClick={handleLogout}
                title="Đăng xuất"
                style={{
                  marginLeft: 'auto',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '4px',
                  borderRadius: '6px',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <div className="main-wrapper">
        {/* TOPBAR */}
        <div className="topbar">
          <div className="topbar-breadcrumb">
            <span style={{ color: 'var(--text-secondary)' }}>AutoSEO</span>
            <span className="topbar-breadcrumb-sep">/</span>
            <span>{currentTitle}</span>
          </div>

          <div className="topbar-right">
            {/* TOKEN STATS */}
            <div className="topbar-token-stats">
              <div className="topbar-token-item" title={`Input: ${tokenStats.total_input?.toLocaleString() || 0} | Output: ${tokenStats.total_output?.toLocaleString() || 0}`}>
                <Cpu size={13} style={{ opacity: 0.7 }} />
                <span className="topbar-token-label">Tokens</span>
                <span className="topbar-token-value">{formatTokens(tokenStats.total_tokens)}</span>
              </div>
              <div className="topbar-token-divider" />
              <div className="topbar-token-item" title="Tổng số lần gọi API">
                <TrendingUp size={13} style={{ opacity: 0.7 }} />
                <span className="topbar-token-label">Lần gọi</span>
                <span className="topbar-token-value">{tokenStats.total_calls || 0}</span>
              </div>
            </div>

            <div className="topbar-badge">Server Online</div>

            {/* THEME TOGGLE */}
            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
                background: 'var(--bg-panel)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '500',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {theme === 'dark' ? (
                <><Sun size={15} color="#f59e0b" /> Sáng</>
              ) : (
                <><Moon size={15} color="#6366f1" /> Tối</>
              )}
            </button>
          </div>
        </div>

        {/* PAGE CONTENT */}
        <div className="page-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default Layout;
