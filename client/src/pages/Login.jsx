/**
 * Login.jsx — Trang đăng nhập. Modern split-screen design.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Zap, Eye, EyeOff, ArrowRight, AlertCircle, TrendingUp, Search, BarChart3, Globe } from 'lucide-react';

const FEATURES = [
  { icon: Search, text: 'Tối ưu từ khoá tự động' },
  { icon: TrendingUp, text: 'Phân tích thứ hạng realtime' },
  { icon: BarChart3, text: 'Báo cáo hiệu suất chi tiết' },
  { icon: Globe, text: 'Hỗ trợ đa ngôn ngữ & thị trường' },
];

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focusedField, setFocusedField] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Tên đăng nhập hoặc mật khẩu không đúng.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = (field) => ({
    width: '100%',
    padding: '13px 16px',
    background: focusedField === field
      ? 'rgba(99,102,241,0.07)'
      : 'rgba(255,255,255,0.04)',
    border: `1.5px solid ${focusedField === field ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.08)'}`,
    borderRadius: '12px',
    color: 'var(--text-primary)',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'Inter, sans-serif',
    transition: 'all 0.2s ease',
    boxShadow: focusedField === field ? '0 0 0 3px rgba(99,102,241,0.12)' : 'none',
  });

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      background: '#0b0d14',
      fontFamily: 'Inter, sans-serif',
      overflow: 'hidden',
    }}>

      {/* ── Left panel — branding ── */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '48px',
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(145deg, #0f1120 0%, #0b0d14 60%)',
      }}>
        {/* Ambient blobs */}
        <div style={{
          position: 'absolute', top: '-80px', left: '-80px',
          width: '400px', height: '400px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%)',
          filter: 'blur(40px)', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: '40px', right: '-60px',
          width: '320px', height: '320px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139,92,246,0.14) 0%, transparent 70%)',
          filter: 'blur(50px)', pointerEvents: 'none',
        }} />

        {/* Logo */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(-12px)',
          transition: 'all 0.5s ease',
        }}>
          <div style={{
            width: '42px', height: '42px', borderRadius: '12px',
            background: 'var(--accent-gradient)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 20px rgba(99,102,241,0.4)',
          }}>
            <Zap size={22} color="white" fill="white" />
          </div>
          <span style={{ fontSize: '22px', fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.5px' }}>
            Auto<span style={{ color: 'var(--accent)' }}>SEO</span>
          </span>
        </div>

        {/* Headline */}
        <div style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all 0.6s ease 0.1s',
        }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '6px 14px', borderRadius: '100px',
            background: 'rgba(99,102,241,0.1)',
            border: '1px solid rgba(99,102,241,0.25)',
            marginBottom: '24px',
          }}>
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#6366f1', boxShadow: '0 0 8px #6366f1' }} />
            <span style={{ fontSize: '12px', color: '#a5b4fc', fontWeight: 500 }}>Nền tảng SEO thế hệ mới</span>
          </div>

          <h1 style={{
            fontSize: '42px', fontWeight: 800, lineHeight: 1.2,
            color: '#f1f5f9', margin: '0 0 16px',
            letterSpacing: '-1px',
          }}>
            Tăng hạng Google<br />
            <span style={{
              background: 'linear-gradient(135deg, #6366f1, #a78bfa)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>tự động & thông minh</span>
          </h1>

          <p style={{ fontSize: '15px', color: '#64748b', lineHeight: 1.7, margin: 0, maxWidth: '380px' }}>
            Hệ thống AI phân tích, tối ưu và theo dõi SEO toàn diện — giúp website bạn vượt đối thủ một cách bền vững.
          </p>

          {/* Features */}
          <div style={{ marginTop: '40px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {FEATURES.map(({ icon: Icon, text }, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                opacity: mounted ? 1 : 0,
                transform: mounted ? 'translateX(0)' : 'translateX(-16px)',
                transition: `all 0.5s ease ${0.2 + i * 0.08}s`,
              }}>
                <div style={{
                  width: '34px', height: '34px', borderRadius: '10px',
                  background: 'rgba(99,102,241,0.1)',
                  border: '1px solid rgba(99,102,241,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Icon size={15} color="#818cf8" />
                </div>
                <span style={{ fontSize: '14px', color: '#94a3b8' }}>{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          fontSize: '12px', color: '#334155',
          opacity: mounted ? 1 : 0, transition: 'opacity 0.5s ease 0.5s',
        }}>
          © 2025 AutoSEO. All rights reserved.
        </div>
      </div>

      {/* ── Right panel — form ── */}
      <div style={{
        width: '480px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px',
        borderLeft: '1px solid rgba(255,255,255,0.05)',
        background: 'rgba(255,255,255,0.015)',
        backdropFilter: 'blur(24px)',
        position: 'relative',
      }}>
        <div style={{
          width: '100%', maxWidth: '360px',
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(24px)',
          transition: 'all 0.55s ease 0.15s',
        }}>
          {/* Header */}
          <div style={{ marginBottom: '36px' }}>
            <h2 style={{
              fontSize: '26px', fontWeight: 700, color: '#f1f5f9',
              margin: '0 0 8px', letterSpacing: '-0.5px',
            }}>
              Chào mừng trở lại
            </h2>
            <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
              Đăng nhập để tiếp tục quản lý SEO của bạn
            </p>
          </div>

          {/* Error banner */}
          {error && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: '10px',
              padding: '13px 15px',
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: '12px',
              marginBottom: '24px',
              color: '#fca5a5',
              fontSize: '13px',
              animation: 'slideIn 0.25s ease',
            }}>
              <AlertCircle size={15} style={{ marginTop: '1px', flexShrink: 0 }} />
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Username */}
            <div>
              <label style={{
                display: 'block', fontSize: '13px', fontWeight: 500,
                color: '#94a3b8', marginBottom: '8px', letterSpacing: '0.01em',
              }}>
                Tên đăng nhập
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                onFocus={() => setFocusedField('username')}
                onBlur={() => setFocusedField(null)}
                placeholder="Nhập tên đăng nhập..."
                autoFocus
                required
                style={inputStyle('username')}
              />
            </div>

            {/* Password */}
            <div>
              <label style={{
                display: 'block', fontSize: '13px', fontWeight: 500,
                color: '#94a3b8', marginBottom: '8px', letterSpacing: '0.01em',
              }}>
                Mật khẩu
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Nhập mật khẩu..."
                  required
                  style={{ ...inputStyle('password'), paddingRight: '44px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  style={{
                    position: 'absolute', right: '12px', top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#475569', padding: '4px',
                    display: 'flex', alignItems: 'center',
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = '#818cf8'}
                  onMouseLeave={e => e.currentTarget.style.color = '#475569'}
                >
                  {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !username || !password}
              style={{
                marginTop: '4px',
                width: '100%',
                padding: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '9px',
                fontSize: '14px',
                fontWeight: 600,
                color: 'white',
                background: (loading || !username || !password)
                  ? 'rgba(99,102,241,0.35)'
                  : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                border: 'none',
                borderRadius: '12px',
                cursor: (loading || !username || !password) ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: (!loading && username && password)
                  ? '0 4px 24px rgba(99,102,241,0.35)'
                  : 'none',
                fontFamily: 'Inter, sans-serif',
                letterSpacing: '0.01em',
              }}
              onMouseEnter={e => {
                if (!loading && username && password) {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 8px 30px rgba(99,102,241,0.45)';
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = (!loading && username && password)
                  ? '0 4px 24px rgba(99,102,241,0.35)' : 'none';
              }}
            >
              {loading ? (
                <>
                  <div style={{
                    width: '16px', height: '16px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: 'white',
                    borderRadius: '50%',
                    animation: 'spin 0.75s linear infinite',
                  }} />
                  Đang đăng nhập...
                </>
              ) : (
                <>
                  Đăng nhập
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Divider & hint */}
          <div style={{
            marginTop: '32px',
            padding: '18px',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '12px',
            textAlign: 'center',
          }}>
            <span style={{ fontSize: '13px', color: '#334155' }}>
              Liên hệ quản trị viên nếu bạn chưa có tài khoản
            </span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 768px) {
          .login-left { display: none !important; }
          .login-right { width: 100% !important; }
        }
      `}</style>
    </div>
  );
};

export default Login;
