/**
 * Login.jsx — Trang đăng nhập. Modern split-screen design.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import { Zap, Eye, EyeOff, ArrowRight, AlertCircle, TrendingUp, Search, BarChart3, Globe } from 'lucide-react';

const FEATURES = [
  { icon: Search, text: 'Tối ưu từ khoá tự động' },
  { icon: TrendingUp, text: 'Phân tích thứ hạng realtime' },
  { icon: BarChart3, text: 'Báo cáo hiệu suất chi tiết' },
  { icon: Globe, text: 'Hỗ trợ đa ngôn ngữ & thị trường' },
];
const version = import.meta.env.VITE_APP_VERSION || 'version 0.0.1';
const environment = import.meta.env.VITE_APP_ENVONMENT || 'development';
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

const Login = () => {
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [focusedField, setFocusedField] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setError('');
      setGoogleLoading(true);
      try {
        await loginWithGoogle(tokenResponse.access_token);
        navigate('/');
      } catch (err) {
        setError(err.response?.data?.error || 'Đăng nhập Google thất bại.');
      } finally {
        setGoogleLoading(false);
      }
    },
    onError: () => {
      setError('Đăng nhập Google thất bại hoặc bị huỷ.');
      setGoogleLoading(false);
    },
    flow: 'implicit',
    scope: 'openid email profile',
  });

  const handleGoogleClick = () => {
    if (!GOOGLE_CLIENT_ID) {
      setError('Chưa cấu hình Google Client ID. Liên hệ quản trị viên.');
      return;
    }
    setError('');
    googleLogin();
  };

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
            {environment !== 'production' && (
              <span style={{ fontSize: '10px', color: '#ffffff',opacity: 0.5, marginLeft: '5px',fontWeight: 'normal' }}>
                (Demo Version)
              </span>
            )}
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
            <span style={{ fontSize: '12px', color: '#a5b4fc', fontWeight: 500 }}>Nền tảng viết SEO thế hệ mới</span>
          </div>

          <h1 style={{
            fontSize: '42px', fontWeight: 800, lineHeight: 1.2,
            color: '#f1f5f9', margin: '0 0 16px',
            letterSpacing: '-1px',
          }}>
            Tối ưu thời gian<br />
            <span style={{
              background: 'linear-gradient(135deg, #6366f1, #a78bfa)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>tự động & thông minh</span>
          </h1>

          <p style={{ fontSize: '15px', color: '#64748b', lineHeight: 1.7, margin: 0, maxWidth: '380px' }}>
            Hệ thống AI phân tích, tối ưu và viết bài SEO toàn diện — giúp website bạn vượt đối thủ một cách bền vững.
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
          © 2026 AutoSEO. All rights reserved. <span style={{fontSize:'10px'}}>{version}</span>
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
              Đăng nhập để tiếp tục quản lý bài viết SEO của bạn
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

          {/* Google Sign-In */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            margin: '24px 0 0',
          }}>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.07)' }} />
            <span style={{ fontSize: '12px', color: '#475569', whiteSpace: 'nowrap' }}>hoặc đăng nhập bằng</span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.07)' }} />
          </div>

          <button
            type="button"
            onClick={handleGoogleClick}
            disabled={googleLoading}
            style={{
              marginTop: '16px',
              width: '100%',
              padding: '13px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              fontSize: '14px',
              fontWeight: 500,
              color: '#e2e8f0',
              background: 'rgba(255,255,255,0.04)',
              border: '1.5px solid rgba(255,255,255,0.1)',
              borderRadius: '12px',
              cursor: googleLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              fontFamily: 'Inter, sans-serif',
              opacity: googleLoading ? 0.6 : 1,
            }}
            onMouseEnter={e => {
              if (!googleLoading) {
                e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
              }
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
            }}
          >
            {googleLoading ? (
              <div style={{
                width: '16px', height: '16px',
                border: '2px solid rgba(255,255,255,0.2)',
                borderTopColor: 'white',
                borderRadius: '50%',
                animation: 'spin 0.75s linear infinite',
              }} />
            ) : (
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                <path fill="none" d="M0 0h48v48H0z"/>
              </svg>
            )}
            Đăng nhập bằng Google
          </button>

          {/* Hint */}
          <div style={{
            marginTop: '24px',
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
