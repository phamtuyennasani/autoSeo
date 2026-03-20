/**
 * TokenStats.jsx — Trang thống kê token & chi phí AI.
 * Hiển thị: tổng token, chi phí theo model, biểu đồ theo ngày, breakdown theo loại, per-user (admin).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import api from '../config/api';
import { useAuth } from '../context/AuthContext';
import {
  Cpu, DollarSign, TrendingUp, Activity, RefreshCw, Trash2,
  ChevronDown, BarChart2, Calendar, Users, Zap, AlertCircle, Info,
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) => {
  if (!n) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return Number(n).toLocaleString();
};

const fmtCost = (usd) => {
  if (!usd || usd === 0) return '$0.000000';
  if (usd < 0.000001) return '<$0.000001';
  if (usd < 0.01) return `$${usd.toFixed(6)}`;
  if (usd < 1) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
};

const fmtVnd = (usd, rate = 25400) => {
  const vnd = usd * rate;
  if (!vnd || vnd === 0) return '₫0';
  if (vnd < 1) return '<₫1';
  if (vnd < 1000) return `₫${Math.round(vnd)}`;
  return `₫${Math.round(vnd).toLocaleString('vi-VN')}`;
};

const MODEL_COLORS = {
  'gemini-2.5-flash': '#6366f1',
  'gemini-2.5-pro':   '#8b5cf6',
  'gemini-2.0-flash': '#06b6d4',
  'gemini-1.5-flash': '#10b981',
  'gemini-1.5-pro':   '#f59e0b',
  'unknown':          '#64748b',
};

function modelColor(name) {
  if (!name) return '#64748b';
  for (const key of Object.keys(MODEL_COLORS)) {
    if (name.startsWith(key)) return MODEL_COLORS[key];
  }
  return '#a78bfa';
}

const TYPE_LABEL = {
  'titles':        'Tạo tiêu đề',
  'article':       'Viết bài đơn',
  'article-batch': 'Batch API',
};

const PERIODS = [
  { value: 'today', label: 'Hôm nay' },
  { value: 'week',  label: '7 ngày' },
  { value: 'month', label: '30 ngày' },
  { value: 'all',   label: 'Tất cả' },
];

// ─── Mini bar chart (SVG) ─────────────────────────────────────────────────────
function MiniBarChart({ data, color = '#6366f1' }) {
  if (!data || data.length === 0) return (
    <div style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>
      Chưa có dữ liệu
    </div>
  );
  const max = Math.max(...data.map(d => d.total_tokens), 1);
  const W = 560, H = 90, BAR_COUNT = data.length;
  const barW = Math.max(4, Math.floor((W - (BAR_COUNT - 1) * 2) / BAR_COUNT));
  const gap = BAR_COUNT > 1 ? (W - barW * BAR_COUNT) / (BAR_COUNT - 1) : 0;

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H + 20}`} style={{ display: 'block' }}>
        {data.map((d, i) => {
          const barH = Math.max(2, (d.total_tokens / max) * H);
          const x = i * (barW + gap);
          const y = H - barH;
          return (
            <g key={d.day}>
              <rect
                x={x} y={y} width={barW} height={barH}
                rx="3" fill={color} opacity="0.85"
              >
                <title>{d.day}: {fmt(d.total_tokens)} tokens ({d.calls} lần)</title>
              </rect>
              {i % Math.ceil(BAR_COUNT / 8) === 0 && (
                <text x={x + barW / 2} y={H + 14} textAnchor="middle" fontSize="9" fill="#64748b">
                  {d.day?.slice(5)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color = '#6366f1', glow }) {
  return (
    <div style={{
      background: 'var(--bg-panel)',
      border: '1px solid var(--border)',
      borderRadius: '14px',
      padding: '20px 22px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      boxShadow: glow ? `0 0 24px ${color}22` : 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{
          width: '36px', height: '36px', borderRadius: '10px',
          background: `${color}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={17} color={color} />
        </div>
        <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{sub}</div>}
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({ title, icon: Icon, children, action }) {
  return (
    <div style={{
      background: 'var(--bg-panel)',
      border: '1px solid var(--border)',
      borderRadius: '14px',
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 20px',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Icon size={16} color="var(--accent)" />
          <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>{title}</span>
        </div>
        {action}
      </div>
      <div style={{ padding: '20px' }}>{children}</div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
const TokenStats = () => {
  const { user, authEnabled } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');
  const [period, setPeriod] = useState('all');
  const [userId, setUserId] = useState('all');
  const [usdRate, setUsdRate] = useState(25400); // VND per USD
  const [resetting, setResetting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ period });
      if (isAdmin && userId !== 'all') params.set('userId', userId);
      const { data } = await api.get(`/api/stats/tokens?${params}`);
      setStats(data);
    } catch (e) {
      setError(e.response?.data?.error || 'Không thể tải thống kê');
    } finally {
      setLoading(false);
    }
  }, [period, userId, isAdmin]);

  useEffect(() => { load(); }, [load]);

  const handleReset = async () => {
    if (!confirm('Xóa toàn bộ lịch sử token usage? Hành động này không thể hoàn tác.')) return;
    setResetting(true);
    try {
      await api.delete('/api/stats/tokens');
      await load();
    } catch (e) {
      toast.error('Lỗi khi reset: ' + (e.response?.data?.error || e.message));
    } finally {
      setResetting(false);
    }
  };

  // ── Build dữ liệu type breakdown ─────────────────────────────────────────
  const typeMap = {};
  (stats?.by_type || []).forEach(row => {
    if (!typeMap[row.type]) {
      typeMap[row.type] = { type: row.type, input_tokens: 0, output_tokens: 0, total_tokens: 0, calls: 0, cost_usd: 0 };
    }
    typeMap[row.type].input_tokens  += row.input_tokens;
    typeMap[row.type].output_tokens += row.output_tokens;
    typeMap[row.type].total_tokens  += row.total_tokens;
    typeMap[row.type].calls         += row.calls;
    typeMap[row.type].cost_usd      += row.cost_usd;
  });
  const typeRows = Object.values(typeMap).sort((a, b) => b.total_tokens - a.total_tokens);
  const totalTokensForPercent = stats?.total_tokens || 1;

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Thống kê Token & Chi phí
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
            Theo dõi lượng token tiêu thụ và ước tính kinh phí cho từng AI model
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Period filter */}
          <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-input)', borderRadius: '10px', padding: '3px' }}>
            {PERIODS.map(p => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif',
                  background: period === p.value ? 'var(--accent)' : 'transparent',
                  color: period === p.value ? 'white' : 'var(--text-secondary)',
                  transition: 'all 0.15s',
                }}
              >{p.label}</button>
            ))}
          </div>

          {/* Admin: user filter — chỉ hiện khi AUTH bật */}
          {authEnabled && isAdmin && stats?.users?.length > 0 && (
            <select
              value={userId}
              onChange={e => setUserId(e.target.value)}
              style={{
                padding: '6px 10px', borderRadius: '9px',
                border: '1px solid var(--border)',
                background: 'var(--bg-input)',
                color: 'var(--text-primary)',
                fontSize: '12px', cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              <option value="all">Tất cả users</option>
              {stats.users.map(u => (
                <option key={u.id} value={u.id}>{u.username} ({fmt(u.total_tokens)} tokens)</option>
              ))}
            </select>
          )}

          <button
            onClick={load}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 12px', borderRadius: '9px',
              border: '1px solid var(--border)',
              background: 'var(--bg-panel)',
              color: 'var(--text-secondary)',
              fontSize: '12px', cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            <RefreshCw size={13} style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }} />
            Làm mới
          </button>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '12px 16px',
          background: 'var(--danger-subtle)', border: '1px solid rgba(239,68,68,0.25)',
          borderRadius: '12px', color: '#fca5a5', fontSize: '13px',
        }}>
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {loading && !stats ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '60px', color: 'var(--text-secondary)', fontSize: '14px' }}>
          <div style={{ width: '20px', height: '20px', border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          Đang tải...
        </div>
      ) : stats && (
        <>
          {/* ── Stat cards ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
            <StatCard
              icon={Cpu} label="Tổng token tiêu thụ" color="#6366f1" glow
              value={fmt(stats.total_tokens)}
              sub={`Input: ${fmt(stats.total_input)} | Output: ${fmt(stats.total_output)}`}
            />
            <StatCard
              icon={DollarSign} label="Ước tính chi phí (USD)" color="#10b981" glow
              value={fmtCost(stats.total_cost_usd)}
              sub={`≈ ${fmtVnd(stats.total_cost_usd, usdRate)} (tỉ giá ${usdRate.toLocaleString()})`}
            />
            <StatCard
              icon={Activity} label="Tổng lần gọi API" color="#f59e0b"
              value={stats.total_calls.toLocaleString()}
              sub="Bao gồm tạo tiêu đề & viết bài"
            />
            <StatCard
              icon={TrendingUp} label="Token trung bình/lần" color="#0ea5e9"
              value={stats.total_calls > 0 ? fmt(Math.round(stats.total_tokens / stats.total_calls)) : '—'}
              sub="Trung bình mỗi lần gọi"
            />
          </div>

          {/* ── Tỉ giá tuỳ chỉnh ── */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '12px 16px',
            background: 'var(--bg-panel)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            fontSize: '13px',
          }}>
            <Info size={15} color="#f59e0b" />
            <span style={{ color: 'var(--text-secondary)' }}>Tỉ giá USD/VND:</span>
            <input
              type="number"
              value={usdRate}
              onChange={e => setUsdRate(Number(e.target.value))}
              style={{
                width: '90px', padding: '4px 8px',
                background: 'var(--bg-input)', border: '1px solid var(--border)',
                borderRadius: '7px', color: 'var(--text-primary)', fontSize: '13px',
                fontFamily: 'Inter, sans-serif', outline: 'none',
              }}
            />
            <span style={{ color: 'var(--text-muted)' }}>₫ (điều chỉnh để tính chi phí VND)</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {/* ── Theo model ── */}
            <Section title="Theo AI Model" icon={Zap}>
              {stats.by_model.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>
                  Chưa có dữ liệu
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {stats.by_model.map(row => {
                    const pct = totalTokensForPercent > 0 ? (row.total_tokens / totalTokensForPercent * 100) : 0;
                    const color = modelColor(row.model);
                    return (
                      <div key={row.model}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color }} />
                            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{row.model}</span>
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'right' }}>
                            <span style={{ color: '#10b981', fontWeight: 600 }}>{fmtCost(row.cost_usd)}</span>
                            <span style={{ color: 'var(--text-muted)', marginLeft: '6px' }}>≈ {fmtVnd(row.cost_usd, usdRate)}</span>
                          </div>
                        </div>
                        {/* Progress bar */}
                        <div style={{ height: '6px', background: 'var(--bg-input)', borderRadius: '99px', overflow: 'hidden', marginBottom: '6px' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '99px', transition: 'width 0.4s ease' }} />
                        </div>
                        <div style={{ display: 'flex', gap: '14px', fontSize: '11px', color: 'var(--text-muted)' }}>
                          <span>Input: {fmt(row.input_tokens)}</span>
                          <span>Output: {fmt(row.output_tokens)}</span>
                          <span>Tổng: {fmt(row.total_tokens)}</span>
                          <span style={{ marginLeft: 'auto' }}>{row.calls} lần · {pct.toFixed(1)}%</span>
                        </div>
                        {/* Pricing info */}
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '3px' }}>
                          ${row.pricing.input}/1M input · ${row.pricing.output}/1M output
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>

            {/* ── Theo loại ── */}
            <Section title="Theo Loại Tác Vụ" icon={BarChart2}>
              {typeRows.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>
                  Chưa có dữ liệu
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {typeRows.map(row => {
                    const pct = totalTokensForPercent > 0 ? (row.total_tokens / totalTokensForPercent * 100) : 0;
                    const colorMap = { titles: '#6366f1', article: '#10b981', 'article-batch': '#f59e0b' };
                    const color = colorMap[row.type] || '#64748b';
                    return (
                      <div key={row.type}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {TYPE_LABEL[row.type] || row.type}
                          </span>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'right' }}>
                            <span style={{ color: '#10b981', fontWeight: 600 }}>{fmtCost(row.cost_usd)}</span>
                          </div>
                        </div>
                        <div style={{ height: '6px', background: 'var(--bg-input)', borderRadius: '99px', overflow: 'hidden', marginBottom: '6px' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '99px', transition: 'width 0.4s ease' }} />
                        </div>
                        <div style={{ display: 'flex', gap: '14px', fontSize: '11px', color: 'var(--text-muted)' }}>
                          <span>Input: {fmt(row.input_tokens)}</span>
                          <span>Output: {fmt(row.output_tokens)}</span>
                          <span>Tổng: {fmt(row.total_tokens)}</span>
                          <span style={{ marginLeft: 'auto' }}>{row.calls} lần · {pct.toFixed(1)}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>
          </div>

          {/* ── Biểu đồ theo ngày ── */}
          <Section title="Lượng token theo ngày (30 ngày gần nhất)" icon={Calendar}>
            <MiniBarChart data={stats.daily} color="#6366f1" />
            {stats.daily.length > 0 && (
              <div style={{ display: 'flex', gap: '20px', marginTop: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                <span>Tổng ngày có dữ liệu: <strong style={{ color: 'var(--text-secondary)' }}>{stats.daily.length}</strong></span>
                <span>Ngày cao nhất: <strong style={{ color: 'var(--text-secondary)' }}>
                  {fmt(Math.max(...stats.daily.map(d => d.total_tokens)))} tokens
                </strong></span>
              </div>
            )}
          </Section>

          {/* ── Theo user — chỉ hiện khi AUTH bật ── */}
          {authEnabled && isAdmin && stats.users && stats.users.length > 0 && (
            <Section
              title="Thống kê theo User"
              icon={Users}
              action={
                <button
                  onClick={handleReset}
                  disabled={resetting}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '5px 12px', borderRadius: '8px',
                    border: '1px solid rgba(239,68,68,0.3)',
                    background: 'rgba(239,68,68,0.06)',
                    color: '#f87171', fontSize: '12px',
                    cursor: resetting ? 'not-allowed' : 'pointer',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  <Trash2 size={12} />
                  {resetting ? 'Đang xóa...' : 'Reset tất cả'}
                </button>
              }
            >
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ color: 'var(--text-secondary)' }}>
                      {['User', 'Vai trò', 'Lần gọi', 'Input', 'Output', 'Tổng token', 'Chi phí (USD)', 'Chi phí (VND)'].map(h => (
                        <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 500, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stats.users.map((u, i) => (
                      <tr
                        key={u.id}
                        style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}
                      >
                        <td style={{ padding: '9px 10px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                            <div style={{
                              width: '26px', height: '26px', borderRadius: '50%',
                              background: 'var(--accent-subtle)', border: '1px solid var(--accent-glow)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '11px', fontWeight: 700, color: 'var(--accent)',
                            }}>
                              {(u.fullname || u.username).charAt(0).toUpperCase()}
                            </div>
                            {u.fullname || u.username}
                          </div>
                        </td>
                        <td style={{ padding: '9px 10px' }}>
                          <span style={{
                            padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 500,
                            background: u.role === 'admin' ? 'rgba(99,102,241,0.12)' : 'rgba(34,197,94,0.1)',
                            color: u.role === 'admin' ? '#818cf8' : '#4ade80',
                          }}>{u.role === 'admin' ? 'Admin' : 'User'}</span>
                        </td>
                        <td style={{ padding: '9px 10px', color: 'var(--text-secondary)' }}>{u.calls.toLocaleString()}</td>
                        <td style={{ padding: '9px 10px', color: 'var(--text-secondary)' }}>{fmt(u.input_tokens)}</td>
                        <td style={{ padding: '9px 10px', color: 'var(--text-secondary)' }}>{fmt(u.output_tokens)}</td>
                        <td style={{ padding: '9px 10px', fontWeight: 600, color: 'var(--text-primary)' }}>{fmt(u.total_tokens)}</td>
                        <td style={{ padding: '9px 10px', fontWeight: 600, color: '#10b981' }}>{fmtCost(u.cost_usd)}</td>
                        <td style={{ padding: '9px 10px', color: 'var(--text-muted)' }}>{fmtVnd(u.cost_usd, usdRate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* ── Bảng giá tham khảo ── */}
          <Section title="Bảng giá Gemini API (tham khảo)" icon={Info}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ color: 'var(--text-secondary)' }}>
                    {['Model', 'Input ($/1M)', 'Output ($/1M)', 'Ghi chú'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 500, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.model_pricing && Object.entries(stats.model_pricing).map(([model, price], i) => {
                    const isHighTier = model.includes('pro');
                    const tier2note = price.inputOver200k ? `>200K ctx: $${price.inputOver200k} / $${price.outputOver200k}` : null;
                    return (
                      <tr key={model} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                        <td style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, background: modelColor(model) }} />
                            {model}
                          </div>
                        </td>
                        <td style={{ padding: '8px 10px', color: '#10b981', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          ${price.input}
                          {price.inputOver200k && (
                            <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '11px', marginLeft: '4px' }}>/ ${price.inputOver200k}*</span>
                          )}
                        </td>
                        <td style={{ padding: '8px 10px', color: '#f59e0b', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          ${price.output}
                          {price.outputOver200k && (
                            <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '11px', marginLeft: '4px' }}>/ ${price.outputOver200k}*</span>
                          )}
                        </td>
                        <td style={{ padding: '8px 10px', color: 'var(--text-muted)', fontSize: '12px' }}>
                          {price.note || (isHighTier ? 'Mô hình cao cấp' : 'Mô hình tiết kiệm')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  * Giá tiered: cột thứ 2 (sau /) áp dụng khi context &gt; 200K tokens.
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  * Batch API (gemini-batch) giảm 50% so với giá Standard.
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  * Nguồn: <span style={{ color: 'var(--accent)' }}>ai.google.dev/gemini-api/docs/pricing</span> — cập nhật 03/2025.
                </div>
              </div>
            </div>
          </Section>
        </>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default TokenStats;
