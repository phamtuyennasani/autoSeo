import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import apiClient from '../config/api';
import {
  Webhook, RefreshCw, Search, CheckCircle2, XCircle,
  Clock, Loader2, Hash, ChevronDown, ChevronRight, AlertCircle, Trash2, User, Check, Minus,
} from 'lucide-react';

const STATUS_MAP = {
  pending:    { label: 'Chờ xử lý',  color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  processing: { label: 'Đang xử lý', color: '#6366f1', bg: 'rgba(99,102,241,0.12)' },
  done:       { label: 'Thành công',  color: '#16a34a', bg: 'rgba(22,163,74,0.12)' },
  failed:     { label: 'Thất bại',    color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
};

const StatusBadge = ({ status }) => {
  const st = STATUS_MAP[status] || STATUS_MAP.pending;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: st.bg, color: st.color,
      borderRadius: 999, padding: '3px 10px', fontSize: 12, fontWeight: 600,
    }}>
      {status === 'done'       && <CheckCircle2 size={11} />}
      {status === 'failed'     && <XCircle size={11} />}
      {status === 'pending'    && <Clock size={11} />}
      {status === 'processing' && <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />}
      {st.label}
    </span>
  );
};

const FILTER_TABS = [
  { label: 'Tất cả',      value: '',           color: '#6366f1' },
  { label: 'Chờ xử lý',  value: 'pending',    color: '#f59e0b', statKey: 'pending' },
  { label: 'Đang xử lý', value: 'processing', color: '#6366f1', statKey: 'processing' },
  { label: 'Thành công',  value: 'done',       color: '#16a34a', statKey: 'done' },
  { label: 'Thất bại',   value: 'failed',     color: '#ef4444', statKey: 'failed' },
];

const COLS = '36px 32px 1fr 0.8fr 1fr 160px 2fr 1fr';

const WebhookEvents = () => {
  const [events, setEvents]             = useState([]);
  const [loading, setLoading]           = useState(true);
  const [q, setQ]                       = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [retrying, setRetrying]         = useState(null);
  const [expanded, setExpanded]         = useState(null);
  const [autoRefresh, setAutoRefresh]   = useState(false);
  const [clearing, setClearing]         = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [selected, setSelected]         = useState(new Set());
  const [deletingSelected, setDeletingSelected] = useState(false);

  useEffect(() => { fetchEvents(); }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(fetchEvents, 10000);
    return () => clearInterval(id);
  }, [autoRefresh]);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/api/webhook-events', { params: { q, status: statusFilter } });
      setEvents(res.data);
      setSelected(new Set());
    } catch {
      toast.error('Lỗi tải danh sách webhook events');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (val) => {
    setStatusFilter(val);
    setTimeout(fetchEvents, 0);
  };

  const allChecked = events.length > 0 && selected.size === events.length;
  const someChecked = selected.size > 0 && selected.size < events.length;

  const toggleAll = () => {
    if (allChecked) setSelected(new Set());
    else setSelected(new Set(events.map(e => e.id)));
  };

  const toggleOne = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleDeleteSelected = async () => {
    if (selected.size === 0) return;
    setDeletingSelected(true);
    try {
      await Promise.all([...selected].map(id => apiClient.delete(`/api/webhook-events/${id}`)));
      toast.success(`Đã xóa ${selected.size} event`);
      setEvents(prev => prev.filter(e => !selected.has(e.id)));
      setSelected(new Set());
    } catch (err) {
      toast.error(err.response?.data?.error || 'Lỗi xóa event');
    } finally {
      setDeletingSelected(false);
    }
  };

  const handleClearAll = async () => {
    if (!confirmClear) { setConfirmClear(true); return; }
    setClearing(true);
    try {
      await apiClient.delete('/api/webhook-events');
      toast.success('Đã xóa toàn bộ lịch sử webhook');
      setEvents([]);
      setSelected(new Set());
    } catch (err) {
      toast.error(err.response?.data?.error || 'Lỗi xóa lịch sử');
    } finally {
      setClearing(false);
      setConfirmClear(false);
    }
  };

  const handleRetry = async (ev) => {
    setRetrying(ev.id);
    try {
      await apiClient.post(`/api/webhook-events/${ev.id}/retry`);
      toast.success('Đang xử lý lại event...');
      setTimeout(fetchEvents, 1500);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Lỗi retry');
    } finally {
      setRetrying(null);
    }
  };

  const stats = useMemo(() => ({
    total:      events.length,
    done:       events.filter(e => e.status === 'done').length,
    failed:     events.filter(e => e.status === 'failed').length,
    pending:    events.filter(e => e.status === 'pending').length,
    processing: events.filter(e => e.status === 'processing').length,
  }), [events]);

  const fmtDatetime = (s) => s ? new Date(s).toLocaleString('vi-VN') : '—';

  return (
    <div className="page-container">
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* ── Header ── */}
      <div className="page-header">
        <div className="page-title-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Webhook size={20} color="var(--accent)" />
            <h1 className="page-title">Lịch Sử Webhook</h1>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* Unified search bar */}
            <div style={{
              display: 'flex', alignItems: 'center', height: 36,
              background: 'var(--bg-input)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', overflow: 'hidden',
              transition: 'border-color 0.15s',
            }}
              onFocusCapture={e => e.currentTarget.style.borderColor = 'var(--border-active)'}
              onBlurCapture={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <Search size={13} style={{ marginLeft: 10, color: 'var(--text-muted)', flexShrink: 0 }} />
              <input
                style={{
                  flex: 1, background: 'transparent', border: 'none', outline: 'none',
                  color: 'var(--text-primary)', fontSize: 13, padding: '0 8px',
                  width: 190, height: '100%',
                }}
                placeholder="Tìm theo Mã HĐ..."
                value={q}
                onChange={e => setQ(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && fetchEvents()}
              />
              <button
                onClick={fetchEvents}
                style={{
                  height: '100%', padding: '0 14px',
                  background: 'var(--accent-gradient)', color: 'white',
                  border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
                }}
              >
                <Search size={13} /> Tìm
              </button>
            </div>
            {/* Auto-refresh button */}
            <button
              className={`btn ${autoRefresh ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setAutoRefresh(v => !v)}
              title={autoRefresh ? 'Tắt tự động làm mới' : 'Bật tự động làm mới (10s)'}
              style={{ height: 36, width: 36, padding: 0 }}
            >
              <RefreshCw size={14} style={autoRefresh ? { animation: 'spin 2s linear infinite' } : {}} />
            </button>
            {/* Clear history button */}
            {events.length > 0 && (
              <button
                className="btn btn-outline"
                onClick={handleClearAll}
                disabled={clearing}
                title={confirmClear ? 'Bấm lần nữa để xác nhận xóa' : 'Xóa toàn bộ lịch sử'}
                style={{
                  height: 36, padding: '0 12px', gap: 5,
                  color: confirmClear ? '#ef4444' : 'var(--text-muted)',
                  borderColor: confirmClear ? '#ef4444' : undefined,
                  transition: 'all 0.15s',
                }}
                onBlur={() => setConfirmClear(false)}
              >
                {clearing
                  ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                  : <Trash2 size={14} />}
                {confirmClear ? 'Xác nhận xóa?' : 'Xóa lịch sử'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="stats-row">
        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="stat-card-label">Tổng Events</div>
            <div className="stat-card-icon" style={{ background: 'rgba(99,102,241,0.12)' }}>
              <Hash size={15} color="#6366f1" />
            </div>
          </div>
          <div className="stat-card-value">{stats.total}</div>
        </div>
        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="stat-card-label">Thành Công</div>
            <div className="stat-card-icon" style={{ background: 'rgba(22,163,74,0.12)' }}>
              <CheckCircle2 size={15} color="#16a34a" />
            </div>
          </div>
          <div className="stat-card-value" style={{ color: '#16a34a' }}>{stats.done}</div>
        </div>
        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="stat-card-label">Thất Bại</div>
            <div className="stat-card-icon" style={{ background: 'rgba(239,68,68,0.12)' }}>
              <XCircle size={15} color="#ef4444" />
            </div>
          </div>
          <div className="stat-card-value" style={{ color: '#ef4444' }}>{stats.failed}</div>
        </div>
        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="stat-card-label">Chờ Xử Lý</div>
            <div className="stat-card-icon" style={{ background: 'rgba(245,158,11,0.12)' }}>
              <Clock size={15} color="#f59e0b" />
            </div>
          </div>
          <div className="stat-card-value" style={{ color: '#f59e0b' }}>{stats.pending}</div>
        </div>
      </div>

      {/* ── Filter Tabs ── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {FILTER_TABS.map(tab => {
          const active = statusFilter === tab.value;
          const count = tab.statKey ? stats[tab.statKey] : undefined;
          return (
            <button
              key={tab.value}
              onClick={() => handleFilterChange(tab.value)}
              style={{
                padding: '5px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                border: `1px solid ${active ? tab.color : 'var(--border)'}`,
                background: active ? `${tab.color}18` : 'transparent',
                color: active ? tab.color : 'var(--text-muted)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                transition: 'all 0.15s',
              }}
            >
              {tab.label}
              {count !== undefined && (
                <span style={{
                  background: active ? tab.color : 'var(--border)',
                  color: active ? '#fff' : 'var(--text-muted)',
                  borderRadius: 999, padding: '0 6px', fontSize: 11, fontWeight: 700,
                }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Bulk action toolbar ── */}
      {selected.size > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10,
          padding: '8px 14px', borderRadius: 'var(--radius-md)',
          background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)',
        }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Đã chọn <strong>{selected.size}</strong> event
          </span>
          <button
            className="btn btn-ghost"
            style={{ padding: '4px 12px', fontSize: 12, gap: 5, color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, marginLeft: 'auto' }}
            disabled={deletingSelected}
            onClick={handleDeleteSelected}
          >
            {deletingSelected
              ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
              : <Trash2 size={12} />}
            Xóa đã chọn
          </button>
          <button
            className="btn btn-ghost"
            style={{ padding: '4px 10px', fontSize: 12 }}
            onClick={() => setSelected(new Set())}
          >
            Bỏ chọn
          </button>
        </div>
      )}

      {/* ── Table ── */}
      <div className="table-container">
        {/* Header */}
        <div className="table-header" style={{ gridTemplateColumns: COLS }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div
              onClick={toggleAll}
              style={{
                width: 15, height: 15, borderRadius: 4, flexShrink: 0, cursor: 'pointer',
                border: `2px solid ${allChecked || someChecked ? 'var(--accent)' : 'var(--border)'}`,
                background: allChecked || someChecked ? 'var(--accent)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.12s',
              }}
            >
              {allChecked && <Check size={9} color="#fff" strokeWidth={3} />}
              {someChecked && <Minus size={9} color="#fff" strokeWidth={3} />}
            </div>
          </div>
          <div />
          <div>Thời Gian Nhận</div>
          <div>Mã HĐ</div>
          <div>User</div>
          <div style={{ textAlign: 'center' }}>Trạng Thái</div>
          <div>Lỗi</div>
          <div>Xử Lý Lúc</div>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', marginBottom: 8 }} />
            <div style={{ fontSize: 14 }}>Đang tải...</div>
          </div>
        )}

        {/* Empty */}
        {!loading && events.length === 0 && (
          <div className="table-empty">
            <div className="table-empty-icon"><Webhook size={28} /></div>
            <div className="table-empty-text">Chưa có webhook event nào</div>
            <div className="table-empty-hint">Events sẽ xuất hiện khi CRM gửi dữ liệu qua webhook</div>
          </div>
        )}

        {/* Rows */}
        {!loading && events.map(ev => (
          <React.Fragment key={ev.id}>
            <div
              className="table-row"
              style={{ gridTemplateColumns: COLS, cursor: 'pointer', background: selected.has(ev.id) ? 'rgba(99,102,241,0.05)' : undefined }}
              onClick={() => setExpanded(expanded === ev.id ? null : ev.id)}
            >
              {/* Checkbox */}
              <div
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onClick={e => { e.stopPropagation(); toggleOne(ev.id); }}
              >
                <div style={{
                  width: 15, height: 15, borderRadius: 4, flexShrink: 0, cursor: 'pointer',
                  border: `2px solid ${selected.has(ev.id) ? 'var(--accent)' : 'var(--border)'}`,
                  background: selected.has(ev.id) ? 'var(--accent)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.12s',
                }}>
                  {selected.has(ev.id) && <Check size={9} color="#fff" strokeWidth={3} />}
                </div>
              </div>

              {/* Expand icon */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                {expanded === ev.id
                  ? <ChevronDown size={15} />
                  : <ChevronRight size={15} />}
              </div>

              {/* Thời gian nhận */}
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {fmtDatetime(ev.createdAt)}
              </div>

              {/* Mã HĐ */}
              <div style={{ fontWeight: 700, color: 'var(--accent)', fontFamily: 'monospace', fontSize: 13 }}>
                {ev.ma_hd || '—'}
              </div>

              {/* User */}
              <div style={{ fontSize: 12, overflow: 'hidden' }}>
                {ev.email ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--text-secondary)' }}>
                    <User size={11} style={{ flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ev.email}
                    </span>
                  </span>
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>—</span>
                )}
              </div>

              {/* Trạng thái + Retry */}
              <div
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                onClick={e => ev.status === 'failed' && e.stopPropagation()}
              >
                <StatusBadge status={ev.status} />
                {ev.status === 'failed' && (
                  <button
                    className="btn btn-ghost"
                    style={{ padding: '3px 7px', fontSize: 11, gap: 3, color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6 }}
                    disabled={retrying === ev.id}
                    onClick={() => handleRetry(ev)}
                    title="Thử lại"
                  >
                    {retrying === ev.id
                      ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
                      : <RefreshCw size={11} />}
                    Retry
                  </button>
                )}
              </div>

              {/* Lỗi */}
              <div style={{ overflow: 'hidden' }}>
                {ev.error ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#ef4444' }}>
                    <AlertCircle size={12} style={{ flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ev.error}
                    </span>
                  </span>
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>—</span>
                )}
              </div>

              {/* Xử lý lúc */}
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {fmtDatetime(ev.processedAt)}
              </div>

            </div>

            {/* Expanded — payload */}
            {expanded === ev.id && (
              <div style={{
                background: 'var(--bg-elevated)',
                borderBottom: '1px solid var(--border)',
                padding: '12px 24px',
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Payload
                </div>
                <pre style={{
                  margin: 0,
                  fontSize: 12, color: 'var(--text-secondary)',
                  overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  fontFamily: "'Fira Code', 'Cascadia Code', monospace",
                  background: 'var(--bg-main)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 16px',
                  maxHeight: 320, overflowY: 'auto',
                }}>
                  {(() => { try { return JSON.stringify(JSON.parse(ev.payload || '{}'), null, 2); } catch { return ev.payload; } })()}
                </pre>
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default WebhookEvents;
