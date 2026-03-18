import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Search, Building2, Zap, Settings, HelpCircle, Sun, Moon, Cpu, TrendingUp, Layers } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useToken } from '../context/TokenContext';

const pageTitles = {
  '/keywords':   'SEO Keywords',
  '/companies':  'Website & Công Ty',
  '/batch-jobs': 'Batch Jobs',
  '/settings':   'Cài Đặt',
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
  const { theme, toggleTheme } = useTheme();
  const { tokenStats } = useToken();
  const currentTitle = pageTitles[location.pathname] || 'Dashboard';

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
        </div>

        <div style={{ marginTop: 'auto' }}>
          <div className="sidebar-section">
          <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Settings size={17} className="nav-icon" /> Cài đặt
            </NavLink>
            <a href="#" className="nav-item" style={{ textDecoration: 'none' }}>
              <HelpCircle size={17} className="nav-icon" /> Trợ giúp
            </a>
          </div>
          <div className="sidebar-footer">
            <div className="sidebar-footer-avatar">A</div>
            <div className="sidebar-footer-info">
              <div className="sidebar-footer-name">Admin</div>
              <div className="sidebar-footer-role">SEO Manager</div>
            </div>
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
