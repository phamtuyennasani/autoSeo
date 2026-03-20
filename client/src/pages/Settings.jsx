import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../config/api';
import { useAuth } from '../context/AuthContext';
import {
  Save, RefreshCw, Loader2, CheckCircle2,
  Zap, FileText, AlertTriangle, Info, BarChart3,
  Shield, TrendingUp, Calendar, KeyRound, Eye, EyeOff, Cpu,
  Calculator, DollarSign, ChevronDown, ChevronUp
} from 'lucide-react';

import { API } from '../config/api';

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

// ── API Config Tab ─────────────────────────────────────────────────────────────
const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
];

function KeyField({ label, sub, color = 'var(--accent)', value, onChange, show, onToggleShow, placeholder }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${color}18`, flexShrink: 0 }}>
          <KeyRound size={16} color={color} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{label}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sub}</div>
        </div>
        {value
          ? <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: 'var(--success-subtle)', color: 'var(--success)' }}>Đã cấu hình</span>
          : <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: 'var(--bg-panel)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>Chưa cấu hình</span>
        }
      </div>
      <div style={{ padding: '14px 18px', position: 'relative' }}>
        <input
          type={show ? 'text' : 'password'}
          className="input-field"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ paddingRight: 42 }}
        />
        <button onClick={onToggleShow} style={{ position: 'absolute', right: 28, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );
}

// Component đặc biệt cho Gemini API Key — hỗ trợ nhiều key cách nhau dấu phẩy
function GeminiKeyField({ value, onChange, show, onToggleShow }) {
  const keys = value ? value.split(',').map(k => k.trim()).filter(Boolean) : [];
  const keyCount = keys.length;

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(99,102,241,0.12)', flexShrink: 0 }}>
          <KeyRound size={16} color="var(--accent)" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Gemini API Key</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Lấy tại <strong>aistudio.google.com</strong> → Get API Key — nhập nhiều key cách nhau dấu <strong>,</strong> để xoay vòng
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {keyCount > 1 && (
            <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: 'rgba(99,102,241,0.12)', color: 'var(--accent)' }}>
              {keyCount} keys
            </span>
          )}
          {keyCount > 0
            ? <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: 'var(--success-subtle)', color: 'var(--success)' }}>Đã cấu hình</span>
            : <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: 'var(--bg-panel)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>Chưa cấu hình</span>
          }
        </div>
      </div>

      {/* Input */}
      <div style={{ padding: '14px 18px', position: 'relative' }}>
        <textarea
          className="input-field"
          rows={keyCount > 1 ? Math.min(keyCount + 1, 5) : 2}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={'AIza... (1 key)\nhoặc: AIza..., AIza..., AIza... (nhiều key xoay vòng)'}
          style={{
            resize: 'vertical',
            fontFamily: 'monospace',
            fontSize: 13,
            paddingRight: 42,
            filter: show ? 'none' : 'blur(4px)',
            transition: 'filter 0.2s',
            userSelect: show ? 'auto' : 'none',
          }}
        />
        <button
          onClick={onToggleShow}
          style={{ position: 'absolute', right: 28, top: 24, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}
          title={show ? 'Ẩn key' : 'Hiện key'}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>

      {/* Key list preview khi show */}
      {show && keyCount > 1 && (
        <div style={{ padding: '0 18px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {keys.map((k, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
              <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--accent-subtle)', color: 'var(--accent)', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
              <span style={{ fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.slice(0, 12)}...{k.slice(-4)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ApiConfigTab() {
  const { user, authEnabled } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isUserScope = authEnabled && !isAdmin; // user thường khi AUTH bật

  const [form, setForm] = useState({ gemini_api_key: '', gemini_model: 'gemini-2.5-flash', serpapi_api_key: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [showGemini, setShowGemini] = useState(false);
  const [showSerp, setShowSerp] = useState(false);

  useEffect(() => {
    apiClient.get(`${ENDPOINT}/api-config`)
      .then(res => setForm(res.data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true); setSaved(false); setError('');
    try {
      await apiClient.put(`${ENDPOINT}/api-config`, form);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError('Lỗi lưu cấu hình: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 80, color: 'var(--text-secondary)' }}>
      <Loader2 className="animate-spin" size={32} style={{ margin: '0 auto 14px', display: 'block' }} />
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {error && <div className="info-box info-box-red"><AlertTriangle size={14} /><span>{error}</span></div>}

      {/* Banner phân biệt scope */}
      {isUserScope ? (
        <div className="info-box info-box-blue">
          <Info size={14} style={{ flexShrink: 0 }} />
          <span>
            Đây là <strong>API key cá nhân</strong> của bạn. Khi cấu hình, hệ thống ưu tiên dùng key này và bạn sẽ <strong>không bị giới hạn</strong> token/bài.
            Nếu để trống, bạn cần được admin cấp quyền dùng key hệ thống mới có thể viết bài.
          </span>
        </div>
      ) : (
        <div className="info-box info-box-blue">
          <Info size={14} style={{ flexShrink: 0 }} />
          <span>Đây là <strong>API key hệ thống</strong> — dùng chung cho tất cả user chưa cấu hình key riêng. Lưu vào database, có hiệu lực ngay.</span>
        </div>
      )}

      {/* Gemini API Key — hỗ trợ nhiều key xoay vòng */}
      <GeminiKeyField
        value={form.gemini_api_key}
        onChange={v => setForm({ ...form, gemini_api_key: v })}
        show={showGemini}
        onToggleShow={() => setShowGemini(v => !v)}
      />

      {/* Gemini Model */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(99,102,241,0.12)', flexShrink: 0 }}>
            <Cpu size={16} color="var(--accent)" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Gemini Model</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {isUserScope ? 'Model riêng cho tài khoản của bạn. Để trống để dùng model hệ thống.' : 'Model mặc định toàn hệ thống. Flash = nhanh + rẻ, Pro = chất lượng cao hơn.'}
            </div>
          </div>
          <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: 'var(--accent-subtle)', color: 'var(--accent)' }}>{form.gemini_model || 'mặc định hệ thống'}</span>
        </div>
        <div style={{ padding: '14px 18px' }}>
          <select className="input-field" value={form.gemini_model} onChange={e => setForm({ ...form, gemini_model: e.target.value })}>
            {isUserScope && <option value="">— Dùng model hệ thống —</option>}
            {GEMINI_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      {/* SerpAPI Key */}
      <KeyField
        label={<>SerpAPI Key <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)' }}>(Tùy chọn)</span></>}
        sub={<>Lấy tại <strong>serpapi.com</strong> — Để trống nếu không dùng. AI sẽ tự sinh tiêu đề từ kiến thức nội tại.</>}
        color="var(--success)"
        value={form.serpapi_api_key}
        onChange={v => setForm({ ...form, serpapi_api_key: v })}
        show={showSerp}
        onToggleShow={() => setShowSerp(v => !v)}
        placeholder="Để trống nếu không dùng SerpAPI"
      />

      {/* Save */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', background: 'var(--bg-panel)' }}>
        <button onClick={handleSave} className="btn btn-primary" disabled={saving} style={{ gap: 7, minWidth: 150, justifyContent: 'center' }}>
          {saving ? <><Loader2 className="animate-spin" size={15} /> Đang lưu...</> : <><Save size={15} /> Lưu cấu hình</>}
        </button>
        {saved && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--success)' }}><CheckCircle2 size={15} /> Đã lưu thành công!</span>}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
          {isUserScope ? 'Lưu vào tài khoản cá nhân, có hiệu lực ngay' : 'Lưu vào hệ thống, có hiệu lực ngay'}
        </span>
      </div>
    </div>
  );
}

// ── Cost Calculator Tab ────────────────────────────────────────────────────────
const PRICING = {
  'gemini-2.5-pro': {
    standard: { input: 1.25,   output: 10.00 },
    batch:    { input: 0.625,  output: 5.00  },
    note: '≤200K context',
  },
  'gemini-2.5-flash': {
    standard: { input: 0.30,  output: 2.50  },
    batch:    { input: 0.15,  output: 1.25  },
  },
  'gemini-2.5-flash-lite': {
    standard: { input: 0.10,  output: 0.40  },
    batch:    { input: 0.05,  output: 0.20  },
  },
  'gemini-2.0-flash': {
    standard: { input: 0.10,  output: 0.40  },
    batch:    { input: 0.05,  output: 0.20  },
    note: 'Deprecated',
  },
};

const USD_TO_VND = 25500;

function fmtUSD(n) {
  if (n === 0) return '$0.00';
  if (n < 0.001) return `$${n.toFixed(6)}`;
  if (n < 0.01)  return `$${n.toFixed(5)}`;
  if (n < 1)     return `$${n.toFixed(4)}`;
  return `$${n.toFixed(3)}`;
}

function fmtVND(n) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(n);
}

function calcCost(articles, inputTok, outputTok, price) {
  return (articles * inputTok / 1_000_000) * price.input
       + (articles * outputTok / 1_000_000) * price.output;
}

function CostCalculatorTab() {
  const [articles,   setArticles]   = useState(100);
  const [inputTok,   setInputTok]   = useState(800);
  const [outputTok,  setOutputTok]  = useState(2500);
  const [showDetail, setShowDetail] = useState(false);

  const models = Object.keys(PRICING);

  // Tìm model rẻ nhất (standard)
  const cheapestStd = models.reduce((best, m) => {
    const c = calcCost(articles, inputTok, outputTok, PRICING[m].standard);
    return c < best.cost ? { model: m, cost: c } : best;
  }, { model: null, cost: Infinity });

  const cheapestBatch = models.reduce((best, m) => {
    const c = calcCost(articles, inputTok, outputTok, PRICING[m].batch);
    return c < best.cost ? { model: m, cost: c } : best;
  }, { model: null, cost: Infinity });

  const MODEL_LABELS = {
    'gemini-2.5-pro':        { color: '#a855f7', bg: 'rgba(168,85,247,0.1)'  },
    'gemini-2.5-flash':      { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)'  },
    'gemini-2.5-flash-lite': { color: '#10b981', bg: 'rgba(16,185,129,0.1)'  },
    'gemini-2.0-flash':      { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      <div className="info-box info-box-blue">
        <Info size={14} style={{ flexShrink: 0 }} />
        <span>Chi phí ước tính dựa theo <strong>bảng giá chính thức của Google</strong> tại ai.google.dev/gemini-api/docs/pricing. Giá có thể thay đổi, kiểm tra lại trước khi quyết định.</span>
      </div>

      {/* Inputs */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(99,102,241,0.12)' }}>
            <Calculator size={15} color="var(--accent)" />
          </div>
          <span style={{ fontWeight: 700, fontSize: 14 }}>Thông số tính toán</span>
        </div>

        <div style={{ padding: '16px 18px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          {[
            { label: 'Số bài viết', value: articles, set: setArticles, min: 1, hint: 'bài' },
            { label: 'Input tokens / bài', value: inputTok, set: setInputTok, min: 100, hint: 'tokens', sub: 'Prompt + ngữ cảnh công ty' },
            { label: 'Output tokens / bài', value: outputTok, set: setOutputTok, min: 100, hint: 'tokens', sub: '≈ 1 token ~ 0.75 từ' },
          ].map(({ label, value, set, min, hint, sub }) => (
            <div key={label}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>{label}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  onClick={() => set(v => Math.max(min, v - (label === 'Số bài viết' ? 10 : 100)))}
                  style={{ width: 32, height: 36, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-elevated)', cursor: 'pointer', fontSize: 16, fontWeight: 700, color: 'var(--text-secondary)', flexShrink: 0, fontFamily: 'Inter' }}
                >−</button>
                <input
                  type="number" min={min}
                  value={value}
                  onChange={e => set(Math.max(min, parseInt(e.target.value) || min))}
                  className="input-field"
                  style={{ textAlign: 'center', fontWeight: 700, fontSize: 15, height: 36, padding: '0 8px' }}
                />
                <button
                  onClick={() => set(v => v + (label === 'Số bài viết' ? 10 : 100))}
                  style={{ width: 32, height: 36, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-elevated)', cursor: 'pointer', fontSize: 16, fontWeight: 700, color: 'var(--text-secondary)', flexShrink: 0, fontFamily: 'Inter' }}
                >+</button>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{sub || hint}</div>
            </div>
          ))}
        </div>

        {/* Quick presets */}
        <div style={{ padding: '0 18px 14px', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 4 }}>Nhanh:</span>
          {[10, 50, 100, 500, 1000].map(n => (
            <button
              key={n}
              onClick={() => setArticles(n)}
              style={{
                padding: '4px 11px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                border: `1.5px solid ${articles === n ? 'var(--accent)' : 'var(--border)'}`,
                background: articles === n ? 'var(--accent-subtle)' : 'var(--bg-elevated)',
                color: articles === n ? 'var(--accent)' : 'var(--text-secondary)',
              }}
            >{n} bài</button>
          ))}
        </div>
      </div>

      {/* Results table */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(16,185,129,0.12)' }}>
              <DollarSign size={15} color="var(--success)" />
            </div>
            <div>
              <span style={{ fontWeight: 700, fontSize: 14 }}>Chi Phí Ước Tính — {articles} bài viết</span>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                Input {inputTok.toLocaleString()} + Output {outputTok.toLocaleString()} tokens/bài · 1 USD ≈ {USD_TO_VND.toLocaleString('vi-VN')} VND
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowDetail(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            {showDetail ? <><ChevronUp size={14} /> Ẩn chi tiết</> : <><ChevronDown size={14} /> Hiện chi tiết</>}
          </button>
        </div>

        <div style={{ padding: '0 18px 4px' }}>
          {models.map(model => {
            const p = PRICING[model];
            const stdCost  = calcCost(articles, inputTok, outputTok, p.standard);
            const batchCost = calcCost(articles, inputTok, outputTok, p.batch);
            const { color, bg } = MODEL_LABELS[model];
            const isCheapestStd   = cheapestStd.model === model;
            const isCheapestBatch = cheapestBatch.model === model;

            return (
              <div key={model} style={{ borderBottom: '1px solid var(--border)', padding: '14px 0' }}>
                {/* Model name row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: bg, color }}>
                    {model}
                  </span>
                  {p.note && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>{p.note}</span>
                  )}
                </div>

                {/* Standard vs Batch */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    { label: 'Standard (Realtime)', price: p.standard, cost: stdCost, isCheapest: isCheapestStd },
                    { label: 'Batch API (−50%)', price: p.batch, cost: batchCost, isCheapest: isCheapestBatch, isBatch: true },
                  ].map(({ label, price, cost, isCheapest, isBatch }) => (
                    <div
                      key={label}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 'var(--radius-md)',
                        border: `1.5px solid ${isCheapest ? 'rgba(34,197,94,0.4)' : 'var(--border)'}`,
                        background: isCheapest ? 'rgba(34,197,94,0.05)' : 'var(--bg-elevated)',
                        position: 'relative',
                      }}
                    >
                      {isCheapest && (
                        <div style={{ position: 'absolute', top: -9, right: 10, padding: '1px 8px', borderRadius: 20, fontSize: 10, fontWeight: 800, background: 'var(--success)', color: '#fff', letterSpacing: '0.04em' }}>
                          RẺ NHẤT
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: isBatch ? 'var(--accent)' : 'var(--text-secondary)' }}>{label}</span>
                      </div>
                      {/* Big cost */}
                      <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--text-primary)', lineHeight: 1 }}>
                        {fmtUSD(cost)}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>
                        {fmtVND(cost * USD_TO_VND)}
                      </div>
                      {/* Per article */}
                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-muted)' }}>
                        {fmtUSD(cost / articles)} / bài &nbsp;·&nbsp; {fmtVND((cost / articles) * USD_TO_VND)} / bài
                      </div>
                      {/* Detail */}
                      {showDetail && (
                        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span>Input: ${price.input}/1M tok → {fmtUSD((articles * inputTok / 1_000_000) * price.input)}</span>
                          <span>Output: ${price.output}/1M tok → {fmtUSD((articles * outputTok / 1_000_000) * price.output)}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer note */}
        <div style={{ padding: '12px 18px', background: 'var(--bg-panel)', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
            <span>* Giá theo bảng Google AI tháng 3/2025</span>
            <span>* Batch API chỉ áp dụng qua tính năng <strong>Batch Jobs</strong></span>
            <span>* Gemini 2.5 Pro: giá cho context ≤200K tokens</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || !user; // bypass mode (AUTH disabled) → hiện đủ
  const [activeTab, setActiveTab] = useState(isAdmin ? 'limits' : 'api');
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
      const res = await apiClient.get(ENDPOINT);
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
      await apiClient.put(ENDPOINT, {
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

  const tabs = [
    ...(isAdmin ? [{ id: 'limits', label: 'Cài Đặt' }] : []),
    { id: 'api',        label: 'Cấu Hình API' },
    { id: 'calculator', label: 'Tính Chi Phí' },
  ];

  return (
    <div className="page-content">
      <div style={{ maxWidth: 740, margin: '0 auto' }}>

        {/* Header */}
        <div className="page-title-row" style={{ marginBottom: 24 }}>
          <div>
            <h1 className="page-title">Cài Đặt</h1>
            <p className="page-subtitle">Quản lý giới hạn tài nguyên và cấu hình API keys</p>
          </div>
          {activeTab === 'limits' && (
            <button onClick={fetchSettings} className="btn btn-outline" disabled={loading}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Làm mới
            </button>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '9px 20px',
                fontSize: 14, fontWeight: 600,
                background: 'none', border: 'none', cursor: 'pointer',
                color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-secondary)',
                borderBottom: `2px solid ${activeTab === tab.id ? 'var(--accent)' : 'transparent'}`,
                marginBottom: -1,
                transition: 'all 0.15s',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab: Cài Đặt (giới hạn) */}
        {activeTab === 'limits' && (
          <>
            {error && <div className="info-box info-box-red" style={{ marginBottom: 20 }}><AlertTriangle size={14} /><span>{error}</span></div>}

            {loading ? (
              <div style={{ textAlign: 'center', padding: 80, color: 'var(--text-secondary)' }}>
                <Loader2 className="animate-spin" size={32} style={{ margin: '0 auto 14px', display: 'block' }} />
                <p>Đang tải...</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12, fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    <BarChart3 size={13} /> Sử dụng hôm nay
                    <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, background: 'var(--accent-subtle)', color: 'var(--accent)', fontWeight: 600, letterSpacing: 0 }}>
                      <Calendar size={9} style={{ display: 'inline', marginRight: 3 }} />{data?.today.date}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <StatCard icon={<Zap />} label="Tokens đã dùng" value={tokensToday} limit={tLimit} color="var(--accent)" />
                    <StatCard icon={<FileText />} label="Bài viết đã tạo" value={articlesToday} limit={aLimit} color="var(--success)" unit="bài" />
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Shield size={11} /> Cấu hình giới hạn
                  </span>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                </div>

                <div className="info-box info-box-blue">
                  <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>
                    <strong>0</strong> = không giới hạn. Giới hạn reset tự động lúc <strong>0:00 mỗi ngày</strong>.
                    Khi vượt giới hạn, yêu cầu viết bài realtime sẽ bị từ chối.
                  </span>
                </div>

                <LimitInput
                  id="token-limit"
                  label="Giới hạn Token / Ngày"
                  description="Gemini Flash ≈ 0.075–0.3 USD / 1M output tokens · Mỗi bài ≈ 2,000–4,000 tokens"
                  icon={<Zap />} color="var(--accent)"
                  value={tokenLimit} onChange={setTokenLimit}
                  presets={[0, 50000, 100000, 200000, 500000, 1000000]}
                />

                <LimitInput
                  id="article-limit"
                  label="Giới hạn Bài Viết / Ngày"
                  description="Chỉ áp dụng cho viết bài lẻ (realtime) · Batch API không bị kiểm soát bởi setting này"
                  icon={<FileText />} color="var(--success)"
                  value={articleLimit} onChange={setArticleLimit}
                  presets={[0, 5, 10, 20, 50, 100]} unit="bài"
                />

                <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', background: 'var(--bg-panel)' }}>
                  <button onClick={handleSave} className="btn btn-primary" disabled={saving} style={{ gap: 7, minWidth: 150, justifyContent: 'center' }}>
                    {saving ? <><Loader2 className="animate-spin" size={15} /> Đang lưu...</> : <><Save size={15} /> Lưu cài đặt</>}
                  </button>
                  {saved && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--success)' }}><CheckCircle2 size={15} /> Đã lưu thành công!</span>}
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
                    <TrendingUp size={11} style={{ display: 'inline', marginRight: 4 }} /> Cài đặt có hiệu lực ngay lập tức
                  </span>
                </div>
              </div>
            )}
          </>
        )}

        {/* Tab: Cấu Hình API */}
        {activeTab === 'api' && <ApiConfigTab />}

        {/* Tab: Tính Chi Phí */}
        {activeTab === 'calculator' && <CostCalculatorTab />}

      </div>
    </div>
  );
}
