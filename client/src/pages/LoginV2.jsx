/**
 * LoginV2.jsx — Trang đăng nhập pixel-perfect theo mẫu https://nsn4.nasani.vn/member/login
 * Chuyển VITE_LOGIN_THEME=nasani trong .env để sử dụng giao diện này.
 *
 * CSS gốc được tái hiện:
 * - .wrap-user { max-width: 500px, border-radius: 20px, padding: 20px 30px }
 * - .title-user span { background: #e2efff, color: #0056AA, border-radius: 30px, font-size: 14px, font-weight: 600 }
 * - .btn-login { background: #0256aa, border-radius: 10px, padding: 8px 30px, font-size: 16px }
 * - #inptlogin { background: #0056AA, border-radius: 8px }
 * - .linkSupp { color: #0056AA }
 * - input { border-radius: 0 !important (right), border-top-right-radius: 5px !important, border-bottom-right-radius: 5px !important }
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';

// Inline SVG icons — no external dependency needed
const IconUser = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="gray" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-user-circle"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M9 10a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" /><path d="M6.168 18.849a4 4 0 0 1 3.832 -2.849h4a4 4 0 0 1 3.834 2.855" /></svg>
);

const IconLock = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="gray" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-lock-password"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M5 13a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2l0 -6" /><path d="M8 11v-4a4 4 0 1 1 8 0v4" /><path d="M15 16h.01" /><path d="M12.01 16h.01" /><path d="M9.02 16h.01" /></svg>
);

// IconEye rendered inline — uses Eye/EyeOff from lucide
const PasswordToggle = ({ show, onToggle }) => (
  <span
    onClick={onToggle}
    style={{
      position: 'absolute',
      right: '0', top: '0',
      height: '100%', width: '41px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer', zIndex: 10,
    }}
  >
    {show ? <Eye size={16} color="#b5b5b5" /> : <EyeOff size={16} color="#b5b5b5" />}
  </span>
);

const version = import.meta.env.VITE_APP_VERSION || 'version 0.0.1';
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

const LoginV2 = () => {
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
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

  // ── Styles ──────────────────────────────────────────────────────────────────

  const wrapUser = {
    width: '100%',
    maxWidth: '500px',
    margin: '0 auto',
    borderRadius: '20px',
    background: '#fff',
    padding: '20px 30px',
  };

  const titleUser = {
    padding: '20px 15px 12px',
    display: 'block',
    textAlign: 'center',
  };

  const titleSpan = {
    display: 'inline-block',
    padding: '6px 25px',
    backgroundColor: '#e2efff',
    color: '#0056AA',
    borderRadius: '30px',
    fontSize: '14px',
    fontWeight: 600,
  };

  const inputGroup = {
    marginBottom: '12px',
    display: 'flex',
    alignItems: 'center',
  };

  const inputPrepend = {
    display: 'flex',
    alignItems: 'center',
    padding: '10px',
    color: '#b5b5b5',
    background: 'none',
    border: '1px solid #e5e5e5',
    borderRight: 0,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    fontSize: '14px',
    height: '46px',
  };

  const inputField = (hasError) => ({
    flex: 1,
    height: '46px',
    padding: '0 12px',
    fontSize: '14px',
    border: '1px solid #e5e5e5',
    borderLeft: 0,
    borderRadius: 0,
    borderTopRightRadius: '5px',
    borderBottomRightRadius: '5px',
    outline: 'none',
    boxShadow: 'none',
    background: '#ffffff',
    color: '#333',
    fontFamily: '"Open Sans", sans-serif',
    boxSizing: 'border-box',
  });

  const btnLogin = {
    background: '#0256aa',
    color: '#fff',
    border: '1px solid #0256aa',
    padding: '8px 30px',
    fontSize: '16px',
    borderRadius: '10px',
    cursor: 'pointer',
    fontFamily: '"Open Sans", sans-serif',
    fontWeight: 600,
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    margin: '0 auto',
  };

  const btnWrapper = {
    paddingLeft: '0',
    paddingRight: '0',
    position: 'relative',
    background: '#0056AA',
    borderRadius: '8px',
    margin: '0 auto',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 'auto',
    minWidth: '160px',
  };

  const btnWrapperSvg = {
    fill: '#fff',
    width: '16px',
    position: 'absolute',
    left: '12px',
    top: '12px',
  };

  const linkSupp = {
    color: '#0056AA',
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
    fontWeight: 'bold',
    textDecoration: 'none',
    fontSize: '14px',
  };

  const phoneSvg = {
    fill: '#0056AA',
    width: '16px',
    display: 'inline-block',
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'url(https://nsn4.nasani.vn/assets/images/bg_login-FXTxC1fK.jpg) no-repeat center center / cover',
      fontFamily: '"Open Sans", sans-serif',
      padding: '20px',
    }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .login-v2-input::placeholder { color: #999 !important; }
        .login-v2-input:focus {
          box-shadow: none !important;
          background: #ffffff !important;
          outline: none !important;
          border-color: #e5e5e5 !important;
        }

      `}</style>

      {/* ── Form card ── */}
      <div style={{
        ...wrapUser,
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(16px)',
        transition: 'all 0.55s ease 0.1s',
        animation: mounted ? 'fadeInUp 0.55s ease 0.1s forwards' : 'none',
      }}>

        {/* Title */}
        <div style={titleUser}>
          <p style={{ display: 'block', textAlign: 'center' }}>
            <img
              src="https://store.nasani.vn/assets/images/Logo-NSN.png"
              alt="login"
              style={{ display: 'inline-block', height: '50px' }}
              onError={e => { e.target.style.display = 'none'; }}
            />
          </p>
          <span style={titleSpan}> Auto Write Content Demo</span>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: '10px',
            padding: '12px 14px',
            background: '#fff2d9',
            border: '1px solid #ffeeba',
            borderRadius: '6px',
            marginBottom: '16px',
            color: '#856404',
            fontSize: '13px',
            animation: 'slideIn 0.25s ease',
          }}>
            <AlertCircle size={15} style={{ marginTop: '1px', flexShrink: 0 }} />
            {error}
          </div>
        )}

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          style={{ padding: '0', borderTop: 'none' }}
        >
          {/* Username */}
          <div style={inputGroup}>
            <div style={ {...inputPrepend, borderTopLeftRadius: '5px', borderBottomLeftRadius: '5px',backgroundColor: '#e9ecef' } }>
              <IconUser />
              </div>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Email..."
                autoFocus
                required
                className="login-v2-input"
                style={inputField()}
                onFocus={e => {
                  e.target.style.borderColor = '#0256aa';
                  e.target.style.boxShadow = 'none';
                }}
                onBlur={e => {
                  e.target.style.borderColor = '#e5e5e5';
                }}
              />
            </div>

            {/* Password */}
            <div style={{ ...inputGroup, position: 'relative', }}>
              <div style={ {...inputPrepend, borderTopLeftRadius: '5px', borderBottomLeftRadius: '5px',backgroundColor: '#e9ecef' } }>
                <IconLock />
              </div>
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Mật khẩu"
                required
                className="login-v2-input"
                style={{ ...inputField(), paddingRight: '44px' }}
                onFocus={e => {
                  e.target.style.borderColor = '#0256aa';
                }}
                onBlur={e => {
                  e.target.style.borderColor = '#e5e5e5';
                }}
              />
              {/* Show/hide password — styled like the original */}
              <PasswordToggle show={showPw} onToggle={() => setShowPw(!showPw)} />
            </div>

            {/* Button wrapper */}
            <div style={{
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <div style={btnWrapper}>
                {/* Lock SVG — matching original #inptlogin svg */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 512 512"
                  style={btnWrapperSvg}
                >
                  <path d="M352 96l64 0c17.7 0 32 14.3 32 32l0 256c0 17.7-14.3 32-32 32l-64 0c-17.7 0-32 14.3-32 32s14.3 32 32 32l64 0c53 0 96-43 96-96l0-256c0-53-43-96-96-96l-64 0c-17.7 0-32 14.3-32 32s14.3 32 32 32zm-9.4 182.6c12.5-12.5 12.5-32.8 0-45.3l-128-128c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L242.7 224 32 224c-17.7 0-32 14.3-32 32s14.3 32 32 32l210.7 0-73.4 73.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l128-128z"/>
                </svg>

                {loading ? (
                  <>
                    <div style={{
                      width: '16px', height: '16px',
                      border: '2px solid rgba(255,255,255,0.4)',
                      borderTopColor: 'white',
                      borderRadius: '50%',
                      animation: 'spin 0.75s linear infinite',
                    }} />
                    <span style={{ color: 'white', fontSize: '16px', fontWeight: 600, paddingLeft: '8px' }}>
                      Đang đăng nhập...
                    </span>
                  </>
                ) : (
                  <input
                    type="submit"
                    name="login-user"
                    value="Đăng nhập"
                    disabled={loading || !username || !password}
                    className="login-v2-btn"
                    style={{
                      ...btnLogin,
                      background: (!username || !password)
                        ? 'rgba(2,86,170,0.6)'
                        : '#0256aa',
                      cursor: (!username || !password) ? 'not-allowed' : 'pointer',
                      paddingLeft: '28px',
                    }}
                  />
                )}
              </div>
            </div>

            {/* Support link */}
            <div style={{
              display: 'flex', justifyContent: 'center', marginTop: '16px',
            }}>
              <a
                href="tel:02837154879"
                style={linkSupp}
              >
                <svg
                  id="phone"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 512 512"
                  style={phoneSvg}
                >
                  <path d="M160.2 25C152.3 6.1 131.7-3.9 112.1 1.4l-5.5 1.5c-64.6 17.6-119.8 80.2-103.7 156.4 37.1 175 174.8 312.7 349.8 349.8 76.3 16.2 138.8-39.1 156.4-103.7l1.5-5.5c5.4-19.7-4.7-40.3-23.5-48.1l-97.3-40.5c-16.5-6.9-35.6-2.1-47 11.8l-38.6 47.2C233.9 335.4 177.3 277 144.8 205.3L189 169.3c13.9-11.3 18.6-30.4 11.8-47L160.2 25z"/>
                </svg>
                Hỗ trợ khách hàng 028.3715.4879
              </a>
            </div>
          </form>

          {/* Divider */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            margin: '20px 0 0',
          }}>
            <div style={{ flex: 1, height: '1px', background: '#e5e5e5' }} />
            <span style={{ fontSize: '12px', color: '#999', whiteSpace: 'nowrap' }}>hoặc đăng nhập bằng</span>
            <div style={{ flex: 1, height: '1px', background: '#e5e5e5' }} />
          </div>

          {/* Google */}
          <button
            type="button"
            onClick={handleGoogleClick}
            disabled={googleLoading}
            style={{
              marginTop: '16px',
              width: '100%',
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              fontSize: '14px',
              fontWeight: 600,
              color: '#333',
              background: 'white',
              border: '1px solid #e5e5e5',
              borderRadius: '5px',
              cursor: googleLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              fontFamily: '"Open Sans", sans-serif',
              opacity: googleLoading ? 0.6 : 1,
            }}
            onMouseEnter={e => {
              if (!googleLoading) {
                e.currentTarget.style.borderColor = '#0256aa';
                e.currentTarget.style.color = '#0256aa';
              }
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = '#e5e5e5';
              e.currentTarget.style.color = '#333';
            }}
          >
            {googleLoading ? (
              <div style={{
                width: '16px', height: '16px',
                border: '2px solid #e5e5e5',
                borderTopColor: '#0256aa',
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

         
        </div>
    </div>
  );
};

export default LoginV2;
