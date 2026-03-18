import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Save, RefreshCw, Loader2, CheckCircle2,
  Zap, FileText, AlertTriangle, Info, BarChart3,
  Shield, TrendingUp, Calendar
} from 'lucide-react';

import API from '../config/api';

const ENDPOINT = API.settings;

const fmt = (n) => {
  if (!n) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
};

const pct = (used, limit) =>
  limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

function ProgressBar({ value, limit, color }) {
  const p = pct(value, limit);
  const barColor = p >= 90 ? 'var(--danger)' : p >= 70 ? 'var(--warning)' : color || 'var(--accent)';
  return (
    <div style={{ height: 8, borderRadius: 99, background: 'var(--border)', overflow: 'hidden', marginTop: 10 }}>
      <div style={{
        height: '100%', borderRadius: 99,
        width: `${limit > 0 ? p : 0}%`,
        background: barColor,
        transition: 'width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
        boxShadow: `0 0 8px ${barColor}55`,
      }} />
    </div>
  );
}

function StatCard({ icon, label, value, limit, color, unit = '' }) {
  const p = limit > 0 ? pct(value, limit) : null;
  const statusColor = p !== null ? (p >= 90 ? 'var(--danger)' : p >= 70 ? 'var(--warning)' : 'var(--success)') : 'var(--text-muted)';
  return (
    <div className="panel" style={{ padding: '16px 20px', flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `${color}18`, flexShrink: 0
        }}>
          {React.cloneElement(icon, { size: 15, color })}
        </div>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--text)', lineHeight: 1 }}>
        {fmt(value)}<span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 4 }}>{unit}</span>
      </div>
      {limit > 0 ? (
        <>
          <ProgressBar value={value} limit={limit} color={color} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>
            <span style={{ fontWeight: 600, color: statusColor }}>{p}% đã dùng</span>
            <span>/ {fmt(limit)} {unit}</span>
          </div>
        </>
      ) : (
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>Không giới hạn</div>
      )}
    </div>
  );
}

// ── Input số lớn với steppers và preset ────────────────────────────────────────
function LimitInput({ id, label, description, icon, color, value, onChange, presets = [], unit = '' }) {
  const numVal = parseInt(value, 10) || 0;

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
        padding: '14px 18px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-elevated)',
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `${color}18`, flexShrink: 0,
        }}>
          {React.cloneElement(icon, { size: 16, color })}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{label}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{description}</div>
        </div>
        {numVal > 0 && (
          <span style={{
            padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
            background: `${color}18`, color,
          }}>
            {fmt(numVal)} {unit}
          </span>
        )}
        {numVal === 0 && (
          <span style={{
            padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
            background: 'var(--success-subtle)', color: 'var(--success)',
          }}>
            Không giới hạn
          </span>
        )}
      </div>

      {/* Input area */}
      <div style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'stretch', marginBottom: 14 }}>
          {/* Stepper minus */}
          <button
            onClick={() => onChange(String(Math.max(0, numVal - (presets[1] || 1))))}
            style={{
              width: 38, height: 42, borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)', background: 'var(--bg-elevated)',
              cursor: 'pointer', fontSize: 18, fontWeight: 700,
              color: 'var(--text-secondary)', flexShrink: 0,
              transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onMouseOver={e => e.currentTarget.style.borderColor = color}
            onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >−</button>

          {/* Input chính */}
          <div style={{ flex: 1, position: 'relative' }}>
            <input
              id={id}
              type="number"
              min="0"
              value={value}
              onChange={e => onChange(e.target.value)}
              className="input-field"
              style={{
                width: '100%', textAlign: 'center',
                fontSize: 22, fontWeight: 800,
                letterSpacing: '-0.5px',
                height: 42, padding: '0 12px',
                boxSizing: 'border-box',
                borderColor: numVal > 0 ? `${color}60` : 'var(--border)',
              }}
              placeholder="0"
            />
          </div>

          {/* Stepper plus */}
          <button
            onClick={() => onChange(String(numVal + (presets[1] || 1)))}
            style={{
              width: 38, height: 42, borderRadius: 'var(--radius-md)',
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
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {presets.map(v => {
            const isActive = numVal === v;
            return (
              <button
                key={v}
                onClick={() => onChange(String(v))}
                style={{
                  padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
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

// ── Main Component ─────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [tokenLimit, setTokenLimit] = useState('0');
  const [articleLimit, setArticleLimit] = useState('0');

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(ENDPOINT);
      setData(res.data);
      const s = res.data.settings;
      setTokenLimit(s.find(r => r.key === 'daily_token_limit')?.value ?? '0');
      setArticleLimit(s.find(r => r.key === 'daily_article_limit')?.value ?? '0');
    } catch (err) {
      setError('Không thể tải cài đặt: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleSave = async () => {
    setSaving(true); setSaved(false); setError('');
    try {
      await axios.put(ENDPOINT, {
        daily_token_limit: parseInt(tokenLimit, 10) || 0,
        daily_article_limit: parseInt(articleLimit, 10) || 0,
      });
      setSaved(true);
      await fetchSettings();
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError('Lỗi lưu cài đặt: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  const tLimit = parseInt(tokenLimit, 10) || 0;
  const aLimit = parseInt(articleLimit, 10) || 0;
  const tokensToday = data?.today.tokens || 0;
  const articlesToday = data?.today.articles || 0;

  return (
    <div className="page-content">
      <div style={{ maxWidth: 740, margin: '0 auto' }}>

        {/* Header */}
        <div className="page-title-row" style={{ marginBottom: 24 }}>
          <div>
            <h1 className="page-title">Cài Đặt</h1>
            <p className="page-subtitle">Giới hạn tài nguyên AI — kiểm soát chi phí sử dụng mỗi ngày</p>
          </div>
          <button onClick={fetchSettings} className="btn btn-outline" disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Làm mới
          </button>
        </div>

        {error && (
          <div className="info-box info-box-red" style={{ marginBottom: 20 }}>
            <AlertTriangle size={14} /> <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 80, color: 'var(--text-secondary)' }}>
            <Loader2 className="animate-spin" size={32} style={{ margin: '0 auto 14px', display: 'block' }} />
            <p>Đang tải...</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* ── Usage hôm nay ──────────────────────────────────────────────── */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12, fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                <BarChart3 size={13} />
                Sử dụng hôm nay
                <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, background: 'var(--accent-subtle)', color: 'var(--accent)', fontWeight: 600, letterSpacing: 0 }}>
                  <Calendar size={9} style={{ display: 'inline', marginRight: 3 }} />{data?.today.date}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <StatCard
                  icon={<Zap />}
                  label="Tokens đã dùng"
                  value={tokensToday}
                  limit={tLimit}
                  color="var(--accent)"
                />
                <StatCard
                  icon={<FileText />}
                  label="Bài viết đã tạo"
                  value={articlesToday}
                  limit={aLimit}
                  color="var(--success)"
                  unit="bài"
                />
              </div>
            </div>

            {/* ── Divider ────────────────────────────────────────────────────── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Shield size={11} /> Cấu hình giới hạn
              </span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>

            {/* ── Info box ───────────────────────────────────────────────────── */}
            <div className="info-box info-box-blue">
              <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>
                <strong>0</strong> = không giới hạn. Giới hạn reset tự động lúc <strong>0:00 mỗi ngày</strong>.
                Khi vượt giới hạn, yêu cầu viết bài realtime sẽ bị từ chối — <em>Batch API không bị ảnh hưởng</em>.
              </span>
            </div>

            {/* ── Token limit ────────────────────────────────────────────────── */}
            <LimitInput
              id="token-limit"
              label="Giới hạn Token / Ngày"
              description="Gemini Flash ≈ 0.075–0.3 USD / 1M output tokens · Mỗi bài ≈ 2,000–4,000 tokens"
              icon={<Zap />}
              color="var(--accent)"
              value={tokenLimit}
              onChange={setTokenLimit}
              presets={[0, 50000, 100000, 200000, 500000, 1000000]}
            />

            {/* ── Article limit ──────────────────────────────────────────────── */}
            <LimitInput
              id="article-limit"
              label="Giới hạn Bài Viết / Ngày"
              description="Chỉ áp dụng cho viết bài lẻ (realtime) · Batch API không bị kiểm soát bởi setting này"
              icon={<FileText />}
              color="var(--success)"
              value={articleLimit}
              onChange={setArticleLimit}
              presets={[0, 5, 10, 20, 50, 100]}
              unit="bài"
            />

            {/* ── Save button ────────────────────────────────────────────────── */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '16px 20px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--bg-panel)',
            }}>
              <button
                onClick={handleSave}
                className="btn btn-primary"
                disabled={saving}
                style={{ gap: 7, minWidth: 150, justifyContent: 'center' }}
              >
                {saving
                  ? <><Loader2 className="animate-spin" size={15} /> Đang lưu...</>
                  : <><Save size={15} /> Lưu cài đặt</>}
              </button>

              {saved && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontSize: 13, fontWeight: 600, color: 'var(--success)',
                  animation: 'fadeIn 0.3s ease',
                }}>
                  <CheckCircle2 size={15} /> Đã lưu thành công!
                </span>
              )}

              <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
                <TrendingUp size={11} style={{ display: 'inline', marginRight: 4 }} />
                Cài đặt có hiệu lực ngay lập tức
              </span>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
