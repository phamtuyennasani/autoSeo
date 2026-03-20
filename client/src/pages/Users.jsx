/**
 * Users.jsx — Quản lý users (Admin only)
 * Danh sách dạng table + modal thêm/sửa với LimitInput giống Settings
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  UserPlus, Trash2, Lock, Unlock, Edit2, X,
  RefreshCw, Shield, User, Crown, Loader2,
  Eye, EyeOff, Zap, FileText, AlertCircle, Activity,
  KeyRound, Server, Mail, Phone, Contact
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import apiClient from '../config/api';

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmt = (n) => {
  if (!n || n === 0) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K';
  return n.toString();
};

// ── LimitInput — giống Settings.jsx ──────────────────────────────────────────
function LimitInput({ label, description, icon, color, value, onChange, presets = [], unit = '' }) {
  const numVal = parseInt(value, 10) || 0;
  const step = presets[1] || 1;

  return (
    <div style={{
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
      background: 'var(--bg-panel)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-elevated)',
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `${color}18`, flexShrink: 0,
        }}>
          {React.cloneElement(icon, { size: 14, color })}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{label}</div>
          {description && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{description}</div>}
        </div>
        <span style={{
          padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700,
          background: numVal > 0 ? `${color}18` : 'var(--success-subtle)',
          color: numVal > 0 ? color : 'var(--success)',
        }}>
          {numVal > 0 ? `${fmt(numVal)}${unit ? ' ' + unit : ''}` : '∞ Không giới hạn'}
        </span>
      </div>

      {/* Input area */}
      <div style={{ padding: '14px 16px' }}>
        {/* Stepper + number */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'stretch', marginBottom: 12 }}>
          <button
            type="button"
            onClick={() => onChange(String(Math.max(0, numVal - step)))}
            style={{
              width: 36, height: 40, borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)', background: 'var(--bg-elevated)',
              cursor: 'pointer', fontSize: 18, fontWeight: 700,
              color: 'var(--text-secondary)', flexShrink: 0,
              transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onMouseOver={e => e.currentTarget.style.borderColor = color}
            onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >−</button>

          <input
            type="number" min="0"
            value={value}
            onChange={e => onChange(e.target.value)}
            className="input-field"
            style={{
              flex: 1, textAlign: 'center',
              fontSize: 20, fontWeight: 800,
              letterSpacing: '-0.5px',
              height: 40, padding: '0 10px',
              boxSizing: 'border-box',
              borderColor: numVal > 0 ? `${color}60` : 'var(--border)',
            }}
            placeholder="0"
          />

          <button
            type="button"
            onClick={() => onChange(String(numVal + step))}
            style={{
              width: 36, height: 40, borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)', background: 'var(--bg-elevated)',
              cursor: 'pointer', fontSize: 18, fontWeight: 700,
              color: 'var(--text-secondary)', flexShrink: 0,
              transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onMouseOver={e => e.currentTarget.style.borderColor = color}
            onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >+</button>
        </div>

        {/* Presets */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {presets.map(v => {
            const isActive = numVal === v;
            return (
              <button
                key={v}
                type="button"
                onClick={() => onChange(String(v))}
                style={{
                  padding: '4px 11px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                  border: `1.5px solid ${isActive ? color : 'var(--border)'}`,
                  background: isActive ? `${color}18` : 'var(--bg-elevated)',
                  color: isActive ? color : 'var(--text-secondary)',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                {v === 0 ? '∞ Không giới hạn' : `${fmt(v)}${unit ? ' ' + unit : ''}`}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Badge Components ──────────────────────────────────────────────────────────
const RoleBadge = ({ role }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '2px 9px', borderRadius: 99, fontSize: 11, fontWeight: 600,
    background: role === 'admin' ? 'rgba(99,102,241,0.12)' : 'rgba(16,185,129,0.1)',
    color: role === 'admin' ? '#818cf8' : '#34d399',
    border: `1px solid ${role === 'admin' ? 'rgba(99,102,241,0.25)' : 'rgba(16,185,129,0.2)'}`,
  }}>
    {role === 'admin' ? <Crown size={9} /> : <User size={9} />}
    {role === 'admin' ? 'Admin' : 'User'}
  </span>
);

const StatusBadge = ({ active }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '2px 9px', borderRadius: 99, fontSize: 11, fontWeight: 600,
    background: active ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
    color: active ? '#34d399' : '#f87171',
    border: `1px solid ${active ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
  }}>
    <Activity size={9} />
    {active ? 'Hoạt động' : 'Đã khóa'}
  </span>
);

// ── User Modal ────────────────────────────────────────────────────────────────
function UserModal({ mode, user, onClose, onSave }) {
  const [form, setForm] = useState({
    username:            user?.username            || '',
    full_name:           user?.full_name           || '',
    email:               user?.email               || '',
    phone:               user?.phone               || '',
    password:            '',
    role:                user?.role                || 'user',
    daily_token_limit:   String(user?.daily_token_limit   ?? 0),
    daily_article_limit: String(user?.daily_article_limit ?? 0),
    use_system_key:      user?.use_system_key      ?? false,
  });
  const [showPw,  setShowPw]  = useState(false);
  const [loading, setLoading] = useState(false);
  const [err,     setErr]     = useState('');
  const isCreate = mode === 'create';

  const set = (key) => (val) => setForm(p => ({ ...p, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      await onSave(form);
      onClose();
    } catch (e) {
      setErr(e.response?.data?.error || 'Có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9999, padding: '20px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '520px',
          background: 'var(--bg-panel)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
          overflow: 'hidden',
          maxHeight: '90vh',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* HEADER */}
        <div style={{
          padding: '18px 22px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--bg-elevated)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'var(--accent-subtle)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              {isCreate ? <UserPlus size={16} color="var(--accent)" /> : <Edit2 size={15} color="var(--accent)" />}
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                {isCreate ? 'Tạo tài khoản mới' : `Chỉnh sửa · ${user?.username}`}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
                {isCreate ? 'Điền thông tin tài khoản' : 'Cập nhật thông tin tài khoản'}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 30, height: 30, borderRadius: 8,
              background: 'none', border: '1px solid var(--border)',
              cursor: 'pointer', color: 'var(--text-secondary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* BODY — scrollable */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>

            {/* Error */}
            {err && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                padding: '10px 12px',
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: 10, color: '#f87171', fontSize: 13,
              }}>
                <AlertCircle size={14} style={{ marginTop: 1, flexShrink: 0 }} />
                {err}
              </div>
            )}

            {/* Username */}
            {isCreate && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                  Tên đăng nhập <span style={{ color: '#f87171' }}>*</span>
                </label>
                <input
                  className="input-field"
                  value={form.username}
                  onChange={e => set('username')(e.target.value)}
                  placeholder="Ví dụ: nguyenvan"
                  autoFocus required
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>
            )}

            {/* Họ tên */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                Họ tên
              </label>
              <div style={{ position: 'relative' }}>
                <Contact size={14} color="var(--text-muted)" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input
                  className="input-field"
                  value={form.full_name}
                  onChange={e => set('full_name')(e.target.value)}
                  placeholder="Ví dụ: Nguyễn Văn A"
                  style={{ width: '100%', boxSizing: 'border-box', paddingLeft: 34 }}
                />
              </div>
            </div>

            {/* Email & Phone */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                  Email <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(tùy chọn)</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail size={14} color="var(--text-muted)" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                  <input
                    className="input-field"
                    type="email"
                    value={form.email}
                    onChange={e => set('email')(e.target.value)}
                    placeholder="email@example.com"
                    style={{ width: '100%', boxSizing: 'border-box', paddingLeft: 34 }}
                  />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                  Số điện thoại <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(tùy chọn)</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <Phone size={14} color="var(--text-muted)" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                  <input
                    className="input-field"
                    type="tel"
                    value={form.phone}
                    onChange={e => set('phone')(e.target.value)}
                    placeholder="0912 345 678"
                    style={{ width: '100%', boxSizing: 'border-box', paddingLeft: 34 }}
                  />
                </div>
              </div>
            </div>

            {/* Password */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                {isCreate ? <>Mật khẩu <span style={{ color: '#f87171' }}>*</span></> : 'Mật khẩu mới'}
                {!isCreate && <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 6 }}>(bỏ trống = không đổi)</span>}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  className="input-field"
                  type={showPw ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => set('password')(e.target.value)}
                  placeholder={isCreate ? 'Nhập mật khẩu...' : 'Để trống nếu không đổi'}
                  required={isCreate}
                  style={{ width: '100%', boxSizing: 'border-box', paddingRight: 40 }}
                />
                <button
                  type="button" onClick={() => setShowPw(v => !v)}
                  style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-secondary)', display: 'flex',
                  }}
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Role */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
                Phân quyền
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  { val: 'user',  label: 'User',  icon: <User size={14} />,  clr: '#10b981' },
                  { val: 'admin', label: 'Admin', icon: <Crown size={14} />, clr: '#818cf8' },
                ].map(opt => (
                  <button
                    key={opt.val} type="button"
                    onClick={() => set('role')(opt.val)}
                    style={{
                      padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                      border: `1.5px solid ${form.role === opt.val ? opt.clr + '90' : 'var(--border)'}`,
                      background: form.role === opt.val ? `${opt.clr}12` : 'var(--bg-elevated)',
                      color: form.role === opt.val ? opt.clr : 'var(--text-secondary)',
                      display: 'flex', alignItems: 'center', gap: 8,
                      fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
                    }}
                  >
                    {opt.icon} {opt.label}
                    {form.role === opt.val && (
                      <span style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: opt.clr }} />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Key hệ thống */}
            <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(99,102,241,0.12)', flexShrink: 0 }}>
                  <Server size={14} color="var(--accent)" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>Dùng key hệ thống</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                    Cho phép user này dùng API key của hệ thống khi chưa cấu hình key cá nhân. Sẽ bị giới hạn token/bài.
                  </div>
                </div>
              </div>
              <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <button
                  type="button"
                  onClick={() => set('use_system_key')(!form.use_system_key)}
                  style={{
                    width: 44, height: 24, borderRadius: 12,
                    background: form.use_system_key ? 'var(--accent)' : 'var(--border)',
                    border: 'none', cursor: 'pointer', position: 'relative',
                    transition: 'background 0.2s', flexShrink: 0,
                  }}
                >
                  <div style={{
                    position: 'absolute', top: 2,
                    left: form.use_system_key ? 22 : 2,
                    width: 20, height: 20, borderRadius: '50%',
                    background: '#fff', transition: 'left 0.2s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                  }} />
                </button>
                <span style={{ fontSize: 13, fontWeight: 600, color: form.use_system_key ? 'var(--accent)' : 'var(--text-secondary)' }}>
                  {form.use_system_key ? 'Được phép dùng key hệ thống' : 'Không được dùng key hệ thống'}
                </span>
              </div>
            </div>

            {/* DIVIDER */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Giới hạn / ngày {!form.use_system_key && <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>· chỉ áp dụng khi dùng key hệ thống</span>}
              </span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>

            {/* Token Limit */}
            <LimitInput
              label="Giới hạn Token / Ngày"
              description="0 = không giới hạn · Flash ≈ 2–4K tokens/bài"
              icon={<Zap />}
              color="var(--accent)"
              value={form.daily_token_limit}
              onChange={set('daily_token_limit')}
              presets={[0, 50000, 100000, 200000, 500000]}
            />

            {/* Article Limit */}
            <LimitInput
              label="Giới hạn Bài Viết / Ngày"
              description="0 = không giới hạn · Chỉ áp dụng viết lẻ realtime"
              icon={<FileText />}
              color="var(--success)"
              value={form.daily_article_limit}
              onChange={set('daily_article_limit')}
              presets={[0, 5, 10, 20, 50, 100]}
              unit="bài"
            />
          </div>

          {/* FOOTER */}
          <div style={{
            padding: '14px 22px',
            borderTop: '1px solid var(--border)',
            display: 'flex', gap: 10, justifyContent: 'flex-end',
            background: 'var(--bg-elevated)', flexShrink: 0,
          }}>
            <button type="button" onClick={onClose} className="btn btn-outline" style={{ minWidth: 80 }}>Hủy</button>
            <button
              type="submit" className="btn btn-primary"
              disabled={loading}
              style={{ minWidth: 140, justifyContent: 'center', opacity: loading ? 0.75 : 1, display: 'flex', alignItems: 'center', gap: 7 }}
            >
              {loading
                ? <><Loader2 size={14} className="animate-spin" /> Đang lưu...</>
                : isCreate
                  ? <><UserPlus size={14} /> Tạo tài khoản</>
                  : <><Edit2 size={14} /> Lưu thay đổi</>
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
const Users = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [modal, setModal]               = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/api/users');
      setUsers(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (form) => {
    await apiClient.post('/api/users', {
      ...form,
      daily_token_limit:   parseInt(form.daily_token_limit,   10) || 0,
      daily_article_limit: parseInt(form.daily_article_limit, 10) || 0,
      use_system_key:      form.use_system_key,
      full_name:           form.full_name  || null,
      email:               form.email      || null,
      phone:               form.phone      || null,
    });
    await load();
  };

  const handleEdit = async (form) => {
    const payload = {
      role:                form.role,
      daily_token_limit:   parseInt(form.daily_token_limit,   10) || 0,
      daily_article_limit: parseInt(form.daily_article_limit, 10) || 0,
      use_system_key:      form.use_system_key,
      full_name:           form.full_name  || null,
      email:               form.email      || null,
      phone:               form.phone      || null,
    };
    if (form.password) payload.password = form.password;
    await apiClient.put(`/api/users/${modal.user.id}`, payload);
    await load();
  };

  const toggleActive = async (u) => {
    setActionLoading(u.id + '-toggle');
    try {
      await apiClient.put(`/api/users/${u.id}`, { is_active: u.is_active ? 0 : 1 });
      await load();
    } finally { setActionLoading(null); }
  };

  const deleteUser = async (u) => {
    if (!confirm(`Xóa user "${u.username}"? Thao tác không thể hoàn tác.`)) return;
    setActionLoading(u.id + '-delete');
    try {
      await apiClient.delete(`/api/users/${u.id}`);
      await load();
    } finally { setActionLoading(null); }
  };

  if (currentUser?.role !== 'admin') {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <Shield size={44} style={{ opacity: 0.2, marginBottom: 16 }} />
        <div style={{ fontSize: 16, fontWeight: 600 }}>Không có quyền truy cập</div>
        <div style={{ fontSize: 13, marginTop: 4, color: 'var(--text-muted)' }}>Trang này chỉ dành cho Admin.</div>
      </div>
    );
  }

  const activeCount    = users.filter(u => u.is_active).length;
  const adminCount     = users.filter(u => u.role === 'admin').length;
  const sysKeyCount    = users.filter(u => !u.has_own_key && u.use_system_key).length;

  return (
    <div>
      {/* HEADER */}
      <div className="page-header" style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div>
          <h1 className="page-title">Quản lý Users</h1>
          <p className="page-subtitle">{users.length} tài khoản · {activeCount} hoạt động · {adminCount} admin · {sysKeyCount} dùng key hệ thống</p>
        </div>
        <div style={{ display: 'flex', gap: 8}}>
          <button className="btn btn-outline" onClick={load} disabled={loading} title="Làm mới">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button className="btn btn-primary" onClick={() => setModal({ mode: 'create' })}>
            <UserPlus size={15} /> Thêm user
          </button>
        </div>
      </div>

      {/* TABLE */}
      <div className="table-container">
        {/* Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 90px 100px 110px 110px 120px 1fr 110px',
          padding: '10px 20px',
          borderBottom: '1px solid var(--border)',
          fontSize: 12, fontWeight: 700,
          color: 'var(--text-secondary)',
          textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>
          {['Username', 'Role', 'Trạng thái', 'Key API', 'Token/ngày', 'Bài/ngày', 'Đăng nhập cuối', 'Hành động'].map(h => (
            <div key={h}>{h}</div>
          ))}
        </div>

        {/* Skeleton loading */}
        {loading ? (
          [1, 2, 3].map(i => (
            <div key={i} style={{
              display: 'grid',
              gridTemplateColumns: '2fr 90px 100px 110px 110px 120px 1fr 110px',
              padding: '16px 20px', borderBottom: '1px solid var(--border)',
              alignItems: 'center', gap: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="skeleton" style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0 }} />
                <div className="skeleton" style={{ height: 13, width: '60%', borderRadius: 4 }} />
              </div>
              {[1,2,3,4,5,6,7].map(j => (
                <div key={j} className="skeleton" style={{ height: 13, width: '70%', borderRadius: 4 }} />
              ))}
            </div>
          ))
        ) : users.length === 0 ? (
          <div className="table-empty">
            <div className="table-empty-icon"><User size={24} /></div>
            <div className="table-empty-text">Chưa có tài khoản nào</div>
            <div className="table-empty-hint">Nhấn "Thêm user" để tạo tài khoản đầu tiên</div>
          </div>
        ) : (
          users.map(u => {
            const isSelf     = u.id === currentUser?.id;
            const isToggling = actionLoading === u.id + '-toggle';
            const isDeleting = actionLoading === u.id + '-delete';
            const initial    = u.username.charAt(0).toUpperCase();
            const avatarColors = [
              ['#6366f1','rgba(99,102,241,0.15)'],['#10b981','rgba(16,185,129,0.15)'],
              ['#f59e0b','rgba(245,158,11,0.15)'], ['#ef4444','rgba(239,68,68,0.15)'],
              ['#8b5cf6','rgba(139,92,246,0.15)'], ['#06b6d4','rgba(6,182,212,0.15)'],
            ];
            const [clr, bg] = avatarColors[u.username.charCodeAt(0) % avatarColors.length];

            return (
              <div
                key={u.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 90px 100px 110px 110px 120px 1fr 110px',
                  padding: '13px 20px',
                  borderBottom: '1px solid var(--border)',
                  alignItems: 'center',
                  transition: 'background 0.15s',
                  opacity: u.is_active ? 1 : 0.65,
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {/* Username */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    background: bg, color: clr,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 800,
                    border: `1.5px solid ${clr}30`,
                  }}>{initial}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {u.username}
                      {isSelf && (
                        <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--accent)', background: 'var(--accent-subtle)', padding: '1px 6px', borderRadius: 99, fontWeight: 600 }}>bạn</span>
                      )}
                    </div>
                    {u.full_name && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{u.full_name}</div>
                    )}
                    {u.email && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{u.email}</div>
                    )}
                  </div>
                </div>

                {/* Role */}
                <div><RoleBadge role={u.role} /></div>

                {/* Status */}
                <div><StatusBadge active={u.is_active} /></div>

                {/* Key API */}
                <div>
                  {u.has_own_key ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 9px', borderRadius: 99, fontSize: 11, fontWeight: 600, background: 'rgba(16,185,129,0.08)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)' }}>
                      <KeyRound size={9} /> Cá nhân
                    </span>
                  ) : u.use_system_key ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 9px', borderRadius: 99, fontSize: 11, fontWeight: 600, background: 'rgba(99,102,241,0.08)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)' }}>
                      <Server size={9} /> Hệ thống
                    </span>
                  ) : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 9px', borderRadius: 99, fontSize: 11, fontWeight: 600, background: 'rgba(239,68,68,0.06)', color: '#f87171', border: '1px solid rgba(239,68,68,0.18)' }}>
                      <Shield size={9} /> Bị chặn
                    </span>
                  )}
                </div>

                {/* Token limit */}
                <div style={{ fontSize: 13, color: u.daily_token_limit > 0 ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: u.daily_token_limit > 0 ? 600 : 400 }}>
                  {u.daily_token_limit > 0 ? fmt(u.daily_token_limit) : '∞'}
                </div>

                {/* Article limit */}
                <div style={{ fontSize: 13, color: u.daily_article_limit > 0 ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: u.daily_article_limit > 0 ? 600 : 400 }}>
                  {u.daily_article_limit > 0 ? u.daily_article_limit + ' bài' : '∞'}
                </div>

                {/* Last login */}
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {u.lastLoginAt
                    ? new Date(u.lastLoginAt).toLocaleString('vi-VN', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })
                    : <span style={{ color: 'var(--text-muted)' }}>—</span>
                  }
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 6 }}>
                  {/* Sửa */}
                  <button
                    onClick={() => setModal({ mode: 'edit', user: u })}
                    title="Chỉnh sửa"
                    className="btn btn-ghost btn-icon"
                    style={{ width: 30, height: 30, padding: 0, borderRadius: 7 }}
                  >
                    <Edit2 size={13} />
                  </button>

                  {/* Khóa / Mở khóa */}
                  {!isSelf && (
                    <button
                      onClick={() => toggleActive(u)}
                      disabled={isToggling}
                      title={u.is_active ? 'Khóa tài khoản' : 'Mở khóa'}
                      style={{
                        width: 30, height: 30, padding: 0, borderRadius: 7,
                        border: `1px solid ${u.is_active ? 'rgba(239,68,68,0.25)' : 'rgba(16,185,129,0.25)'}`,
                        background: u.is_active ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)',
                        color: u.is_active ? '#f87171' : '#34d399',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        opacity: isToggling ? 0.6 : 1, transition: 'all 0.15s',
                      }}
                    >
                      {isToggling
                        ? <Loader2 size={12} className="animate-spin" />
                        : u.is_active ? <Lock size={12} /> : <Unlock size={12} />
                      }
                    </button>
                  )}

                  {/* Xóa */}
                  {!isSelf && (
                    <button
                      onClick={() => deleteUser(u)}
                      disabled={isDeleting}
                      title="Xóa user"
                      style={{
                        width: 30, height: 30, padding: 0, borderRadius: 7,
                        border: '1px solid rgba(239,68,68,0.25)',
                        background: 'rgba(239,68,68,0.08)', color: '#f87171',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        opacity: isDeleting ? 0.6 : 1, transition: 'all 0.15s',
                      }}
                    >
                      {isDeleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL */}
      {modal && (
        <UserModal
          mode={modal.mode}
          user={modal.user}
          onClose={() => setModal(null)}
          onSave={modal.mode === 'create' ? handleCreate : handleEdit}
        />
      )}
    </div>
  );
};

export default Users;
