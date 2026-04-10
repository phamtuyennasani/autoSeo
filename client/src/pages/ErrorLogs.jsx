import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import apiClient from '../config/api';
import {
  AlertTriangle, RefreshCw, Search, Loader2,
  Trash2, XCircle, FileText, Clock,
  ChevronDown, Download, Check, AlertCircle, Tag,
} from 'lucide-react';

// ─── Helpers ───────────────────────────────────────────────────────────────────

const fmtDatetime = (s) => s ? new Date(s).toLocaleString('vi-VN') : '—';

const PHASE_META = {
  tao_tieude: { label: 'Tạo tiêu đề', color: '#6366f1', bg: 'rgba(99,102,241,0.12)' },
  viet_bai:   { label: 'Viết bài',     color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
};

// ─── PhaseBadge ─────────────────────────────────────────────────────────────────

const PhaseBadge = ({ phase }) => {
  const meta = PHASE_META[phase] || { label: phase, color: '#999', bg: 'rgba(153,153,153,0.1)' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: meta.bg, color: meta.color,
      borderRadius: 999, padding: '3px 10px', fontSize: 12, fontWeight: 600,
    }}>
      <AlertCircle size={11} />
      {meta.label}
    </span>
  );
};

// ─── ErrorLogRow ─────────────────────────────────────────────────────────────────

const ErrorLogRow = ({ log, onDelete, expanded, onExpand, companies = [], users = [], contracts = [] }) => {
  const [deleting, setDeleting] = useState(false);

  const getCompanyName = (id) => {
    if (!id) return '—';
    const c = companies.find(x => x.id === id);
    return c?.name || id?.slice(0, 10) + '…' || '—';
  };
  const getUserName = (id) => {
    if (!id) return '—';
    const u = users.find(x => x.id === id);
    if (!u) return id;
    if (u.full_name && u.employee_code) return `${u.full_name} (${u.employee_code})`;
    if (u.full_name) return u.full_name;
    if (u.email) return u.email;
    return id;
  };
  const getMaHd = (hopDongId) => {
    if (!hopDongId) return log.ma_hd || '—';
    const hd = contracts.find(h => h.id === hopDongId);
    return hd?.ma_hd || log.ma_hd || hopDongId;
  };

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!window.confirm(`Xóa log lỗi "${log.keyword}"?\nHành động này không thể hoàn tác.`)) return;
    setDeleting(true);
    try {
      await apiClient.delete(`/api/error-logs/${log.id}`);
      toast.success('Đã xóa log lỗi');
      onDelete(log.id);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Lỗi xóa log');
    } finally {
      setDeleting(false);
    }
  };

  const phaseColor = log.phase === 'tao_tieude' ? '#6366f1' : '#f59e0b';

  return (
    <>
      <div
        className="table-row"
        style={{ gridTemplateColumns: '48px 1fr 1fr 120px 120px 140px 2fr 80px', cursor: 'pointer' }}
        onClick={() => onExpand(expanded === log.id ? null : log.id)}
      >
        {/* Phase badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{
            width: 30, height: 30, borderRadius: 8,
            background: log.phase === 'tao_tieude' ? 'rgba(99,102,241,0.12)' : 'rgba(245,158,11,0.12)',
            color: phaseColor,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 800,
          }}>
            {log.phase === 'tao_tieude' ? 'TT' : 'VB'}
          </span>
        </div>

        {/* Keyword */}
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {log.keyword}
        </div>

        {/* Company */}
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {getCompanyName(log.company_id)}
        </div>

        {/* Mã HĐ */}
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {getMaHd(log.hop_dong_id)}
        </div>

        {/* ID từ khóa (CRM1) */}
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {log.id_tukhoa || '—'}
        </div>

        {/* Thời gian */}
        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
          {fmtDatetime(log.created_at)}
        </div>

        {/* Error message */}
        <div style={{ fontSize: 12, color: '#ef4444', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {log.error_message}
        </div>

        {/* Delete */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <button
            onClick={handleDelete}
            disabled={deleting}
            title="Xóa log này"
            style={{
              background: 'none', border: 'none', cursor: deleting ? 'not-allowed' : 'pointer',
              color: '#ef4444', opacity: deleting ? 0.4 : 1,
              display: 'flex', alignItems: 'center', padding: 4,
              borderRadius: 6, transition: 'background 0.15s',
            }}
            onMouseEnter={e => { if (!deleting) e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            {deleting
              ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
              : <Trash2 size={13} />
            }
          </button>
        </div>
      </div>

      {expanded === log.id && (
        <div style={{
          background: 'var(--bg-elevated)',
          borderBottom: '1px solid var(--border)',
          padding: '16px 24px',
        }}>
          {/* Header row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 12,
            marginBottom: 14,
          }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>ID từ CRM1</div>
              <div style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{log.id_tukhoa || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Mã HĐ</div>
              <div style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{getMaHd(log.hop_dong_id) || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Chu kỳ</div>
              <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>{log.chuki || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Người tạo</div>
              <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>{getUserName(log.created_by)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Email</div>
              <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>{log.email || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Company</div>
              <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>{getCompanyName(log.company_id)}</div>
            </div>
          </div>

          {/* Error message */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Nội dung lỗi
            </div>
            <pre style={{
              margin: 0, fontSize: 12, color: '#ef4444',
              background: 'rgba(239,68,68,0.07)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 8, padding: '10px 14px',
              fontFamily: 'monospace', overflowX: 'auto',
              maxHeight: 200, overflowY: 'auto',whiteSpace: 'break-spaces',
            }}>
              {log.error_message}
            </pre>
          </div>

          {/* Footer row */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-muted)' }}>
              <Clock size={11} />
              Ghi nhận: <strong style={{ color: 'var(--text-secondary)' }}>{fmtDatetime(log.created_at)}</strong>
            </div>
            {log.notified_at && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-muted)' }}>
                <Check size={11} color="#16a34a" />
                Đã notify CRM1 lúc: <strong style={{ color: 'var(--text-secondary)' }}>{fmtDatetime(log.notified_at)}</strong>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

// ─── Main Page ─────────────────────────────────────────────────────────────────

const ErrorLogs = () => {
  const [logs, setLogs]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [stats, setStats]             = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [phaseFilter, setPhaseFilter]   = useState('');
  const [keywordSearch, setKeywordSearch] = useState('');
  const [expanded, setExpanded]       = useState(null);
  const [autoRefresh, setAutoRefresh]  = useState(false);
  const [companies, setCompanies]     = useState([]);
  const [users, setUsers]             = useState([]);
  const [contracts, setContracts]     = useState([]);
  const [purging, setPurging]         = useState(false);

  // ── Fetch lookups ──────────────────────────────────────────────────────────
  const fetchLookups = useCallback(async () => {
    try {
      const [compRes, userRes, contractRes] = await Promise.all([
        apiClient.get('/api/companies'),
        apiClient.get('/api/users'),
        apiClient.get('/api/hop-dong'),
      ]);
      setCompanies(compRes.data || []);
      setUsers(userRes.data || []);
      setContracts(contractRes.data || []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchLookups(); }, [fetchLookups]);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchStats = useCallback(async () => {
    try {
      const res = await apiClient.get('/api/error-logs/stats');
      setStats(res.data);
    } catch { /* silent */ }
    finally { setLoadingStats(false); }
  }, []);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/api/error-logs', {
        params: {
          phase:    phaseFilter || undefined,
          keyword:  keywordSearch || undefined,
          limit:    200,
          offset:   0,
        },
      });
      setLogs(res.data.data || res.data);
    } catch {
      toast.error('Lỗi tải error logs');
    } finally {
      setLoading(false);
    }
  }, [phaseFilter, keywordSearch]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => { fetchStats(); fetchLogs(); }, 15000);
    return () => clearInterval(id);
  }, [autoRefresh, fetchStats, fetchLogs]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleDelete = useCallback((id) => {
    setLogs(prev => prev.filter(l => l.id !== id));
    fetchStats();
  }, [fetchStats]);

  const handlePurgeAll = async () => {
    if (!window.confirm('Xóa TẤT CẢ error logs?\nHành động này không thể hoàn tác.')) return;
    setPurging(true);
    try {
      await apiClient.delete('/api/error-logs/purge-all');
      toast.success('Đã xóa tất cả error logs');
      setLogs([]);
      fetchStats();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Lỗi xóa tất cả');
    } finally {
      setPurging(false);
    }
  };

  const handleRefresh = () => { fetchStats(); fetchLogs(); };

  // ── Derived ───────────────────────────────────────────────────────────────

  const taoCount  = stats?.tao_tieude  ?? 0;
  const vietCount  = stats?.viet_bai   ?? 0;
  const totalCount = stats?.total       ?? 0;
  const todayCount = stats?.today       ?? 0;

  const HEADER_COLS = '48px 1fr 1fr 120px 120px 140px 2fr 80px';

  return (
    <div className="page-container">
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* ── Header ── */}
      <div className="page-header">
        <div className="page-title-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertTriangle size={20} color="var(--accent)" />
            <h1 className="page-title">Log Lỗi</h1>
            <PhaseBadge phase={phaseFilter || ''} />
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              className={`btn ${autoRefresh ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setAutoRefresh(v => !v)}
              title={autoRefresh ? 'Tắt tự động làm mới' : 'Bật tự động làm mới (15s)'}
              style={{ height: 36, width: 36, padding: 0 }}
            >
              <RefreshCw size={14} style={autoRefresh ? { animation: 'spin 3s linear infinite' } : {}} />
            </button>
            <button className="btn btn-outline" onClick={handleRefresh} style={{ height: 36 }}>
              <RefreshCw size={14} /> Làm mới
            </button>
          </div>
        </div>
      </div>

      {/* ── Stats Cards ── */}
      <div className="stats-row">
        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="stat-card-label">Tổng cộng</div>
            <div className="stat-card-icon" style={{ background: 'rgba(239,68,68,0.12)' }}>
              <AlertTriangle size={15} color="#ef4444" />
            </div>
          </div>
          <div className="stat-card-value" style={{ color: loadingStats ? 'var(--text-muted)' : '#ef4444' }}>
            {loadingStats ? '…' : totalCount}
          </div>
        </div>

        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="stat-card-label">Hôm nay</div>
            <div className="stat-card-icon" style={{ background: 'rgba(245,158,11,0.12)' }}>
              <Clock size={15} color="#f59e0b" />
            </div>
          </div>
          <div className="stat-card-value" style={{ color: loadingStats ? 'var(--text-muted)' : '#f59e0b' }}>
            {loadingStats ? '…' : todayCount}
          </div>
        </div>

        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => { setPhaseFilter(phaseFilter === 'tao_tieude' ? '' : 'tao_tieude'); }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="stat-card-label">Lỗi tạo tiêu đề</div>
            <div className="stat-card-icon" style={{ background: 'rgba(99,102,241,0.12)' }}>
              <FileText size={15} color="#6366f1" />
            </div>
          </div>
          <div className="stat-card-value" style={{ color: loadingStats ? 'var(--text-muted)' : '#6366f1' }}>
            {loadingStats ? '…' : taoCount}
          </div>
        </div>

        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => { setPhaseFilter(phaseFilter === 'viet_bai' ? '' : 'viet_bai'); }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="stat-card-label">Lỗi viết bài</div>
            <div className="stat-card-icon" style={{ background: 'rgba(245,158,11,0.12)' }}>
              <FileText size={15} color="#f59e0b" />
            </div>
          </div>
          <div className="stat-card-value" style={{ color: loadingStats ? 'var(--text-muted)' : '#f59e0b' }}>
            {loadingStats ? '…' : vietCount}
          </div>
        </div>
      </div>

      {/* ── Filter row ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>

        {/* Phase filter pills */}
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 10, padding: 3 }}>
          {[
            { value: '',        label: 'Tất cả' },
            { value: 'tao_tieude', label: 'Tạo tiêu đề' },
            { value: 'viet_bai',   label: 'Viết bài' },
          ].map(f => (
            <button key={f.value} onClick={() => setPhaseFilter(f.value)} style={{
              padding: '5px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              border: 'none', cursor: 'pointer',
              background: phaseFilter === f.value ? '#6366f1' : 'transparent',
              color: phaseFilter === f.value ? '#fff' : 'var(--text-muted)',
              display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s',
            }}>
              {f.label}
              {f.value === 'tao_tieude' && !loadingStats && taoCount > 0 && phaseFilter !== 'viet_bai' && (
                <span style={{ background: 'rgba(255,255,255,0.25)', color: '#fff', borderRadius: 999, padding: '0 6px', fontSize: 10, fontWeight: 700 }}>
                  {taoCount}
                </span>
              )}
              {f.value === 'viet_bai' && !loadingStats && vietCount > 0 && phaseFilter !== 'tao_tieude' && (
                <span style={{ background: 'rgba(255,255,255,0.25)', color: '#fff', borderRadius: 999, padding: '0 6px', fontSize: 10, fontWeight: 700 }}>
                  {vietCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Keyword search */}
        <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 320 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            className="input-field"
            style={{ paddingLeft: 32, fontSize: 13, height: 34, width: '100%' }}
            placeholder="Tìm từ khóa…"
            value={keywordSearch}
            onChange={e => setKeywordSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchLogs()}
          />
        </div>

        {/* Purge all */}
        {totalCount > 0 && (
          <button
            className="btn"
            onClick={handlePurgeAll}
            disabled={purging}
            style={{ gap: 6, fontSize: 12, padding: '5px 12px', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}
          >
            {purging ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={12} />}
            Xóa tất cả ({totalCount})
          </button>
        )}
      </div>

      {/* ── Table ── */}
      <div className="table-container" style={{ marginTop: 12 }}>
        <div className="table-header" style={{ gridTemplateColumns: HEADER_COLS }}>
          <div />
          <div>Từ khóa</div>
          <div>Company</div>
          <div>Mã HĐ</div>
          <div>ID CRM1</div>
          <div>Thời gian</div>
          <div>Lỗi</div>
          <div style={{ textAlign: 'center' }}>Xóa</div>
        </div>

        {loading && (
          <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', marginBottom: 8 }} />
            <div style={{ fontSize: 14 }}>Đang tải error logs…</div>
          </div>
        )}

        {!loading && logs.length === 0 && (
          <div className="table-empty">
            <div className="table-empty-icon"><AlertTriangle size={28} /></div>
            <div className="table-empty-text">
              {phaseFilter === 'tao_tieude' ? 'Không có log lỗi tạo tiêu đề nào' :
               phaseFilter === 'viet_bai'   ? 'Không có log lỗi viết bài nào' :
               'Không có log lỗi nào'}
            </div>
            <div className="table-empty-hint">
              Các từ khóa lỗi khi tạo tiêu đề hoặc viết bài sẽ được ghi nhận tại đây.
            </div>
          </div>
        )}

        {!loading && logs.map(log => (
          <ErrorLogRow
            key={log.id}
            log={log}
            onDelete={handleDelete}
            expanded={expanded}
            onExpand={setExpanded}
            companies={companies}
            users={users}
            contracts={contracts}
          />
        ))}
      </div>

      {/* ── Footer hint ── */}
      <div style={{
        marginTop: 12, padding: '8px 14px',
        background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)',
        borderRadius: 'var(--radius-md)', fontSize: 12, color: 'var(--text-muted)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <AlertTriangle size={14} style={{ color: '#ef4444', flexShrink: 0 }} />
        <span>
          Các từ khóa lỗi khi tạo tiêu đề hoặc viết bài sẽ được ghi nhận tại đây và thông báo về CRM1.
          <strong style={{ color: 'var(--text-secondary)' }}> Click vào stats card</strong> để lọc theo loại lỗi.
        </span>
      </div>
    </div>
  );
};

export default ErrorLogs;