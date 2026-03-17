import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Search, Building2, Zap, Settings, HelpCircle, Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const pageTitles = {
  '/keywords': 'SEO Keywords',
  '/companies': 'Website & Công Ty',
};

const Layout = () => {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
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
        </div>

        <div style={{ marginTop: 'auto' }}>
          <div className="sidebar-section">
            <a href="#" className="nav-item" style={{ textDecoration: 'none' }}>
              <Settings size={17} className="nav-icon" /> Cài đặt
            </a>
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
