import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import apiClient from '../config/api';
import {
  Trash2, RefreshCw, RotateCcw, Loader2,
  AlertTriangle, Database, Inbox, Play,
  ChevronDown, Download, Settings, Pause, PlayCircle,
  Activity, BarChart3, Server, PlusCircle, MinusCircle,
} from 'lucide-react';

// ─── Helpers ───────────────────────────────────────────────────────────────────

const fmtDatetime = (s) => s ? new Date(s).toLocaleString('vi-VN') : '—';

const QUEUE_META = {
  keyword: {
    label: 'Keyword Queue',
    icon: <span style={{ fontSize: 11, fontWeight: 700 }}>KW</span>,
    color: '#6366f1',
    bg: 'rgba(99,102,241,0.12)',
    cols: '48px 120px 1fr 120px 100px 100px 160px 2fr',
    headerCols: '48px 120px 1fr 120px 100px 100px 160px 2fr',
  },
  title: {
    label: 'Title Queue',
    icon: <span style={{ fontSize: 11, fontWeight: 700 }}>TL</span>,
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.12)',
    cols: '48px 120px 1fr 160px 120px 100px 100px 2fr',
    headerCols: '48px 120px 1fr 160px 120px 100px 100px 2fr',
  },
};

// ─── Threshold Settings Modal ─────────────────────────────────────────────────

const ThresholdModal = ({ thresholds, onSave, onClose }) => {
  const [kwWarn, setKwWarn] = useState(thresholds.keyword_warn);
  const [kwCrit, setKwCrit] = useState(thresholds.keyword_crit);
  const [tlWarn, setTlWarn] = useState(thresholds.title_warn);
  const [tlCrit, setTlCrit] = useState(thresholds.title_crit);

  const handleSave = () => {
    onSave({ keyword_warn: Number(kwWarn), keyword_crit: Number(kwCrit), title_warn: Number(tlWarn), title_crit: Number(tlCrit) });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Settings size={16} color="var(--accent)" />
            <span style={{ fontWeight: 700, fontSize: 15 }}>Cài đặt ngưỡng cảnh báo</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 18 }}>×</button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Cảnh báo sẽ hiển thị khi số job trong DLQ vượt ngưỡng. Ngưỡng <strong style={{ color: '#f59e0b' }}>Warning</strong> hiển thị màu vàng, <strong style={{ color: '#ef4444' }}>Critical</strong> hiển thị màu đỏ.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Keyword DLQ</div>
              <div className="input-group">
                <label className="input-label">Warning</label>
                <input className="input-field" type="number" min="0" value={kwWarn} onChange={e => setKwWarn(e.target.value)} />
              </div>
              <div className="input-group" style={{ marginTop: 8 }}>
                <label className="input-label">Critical</label>
                <input className="input-field" type="number" min="0" value={kwCrit} onChange={e => setKwCrit(e.target.value)} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Title DLQ</div>
              <div className="input-group">
                <label className="input-label">Warning</label>
                <input className="input-field" type="number" min="0" value={tlWarn} onChange={e => setTlWarn(e.target.value)} />
              </div>
              <div className="input-group" style={{ marginTop: 8 }}>
                <label className="input-label">Critical</label>
                <input className="input-field" type="number" min="0" value={tlCrit} onChange={e => setTlCrit(e.target.value)} />
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
            <button className="btn btn-outline" onClick={onClose}>Hủy</button>
            <button className="btn btn-primary" onClick={handleSave}>Lưu</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Queue Monitor Panel ───────────────────────────────────────────────────────

const QueueMonitorPanel = ({ queueStats, workersPaused, onPause, onResume, loading,
  onSpawnKw, onSpawnTl, spawningKw, spawningTl }) => {
  const kw = queueStats?.keyword_queue || {};
  const tl = queueStats?.title_queue   || {};
  const wh = queueStats?.webhook_events || {};
  const workers    = queueStats?.workers        || {};
  const activeWrks = queueStats?.active_workers || {};
  const running    = queueStats?.running   ?? true;

  const activeKw = activeWrks.keyword ?? 0;
  const activeTl = activeWrks.title   ?? 0;

  const StatusDot = ({ ok, label }) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: ok ? '#16a34a' : '#ef4444' }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: ok ? '#16a34a' : '#ef4444', display: 'inline-block' }} />
      {label}
    </span>
  );

  const WorkerBadge = ({ label, color, configured, active, onSpawn, spawning, type }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{label}:</span>
      <span style={{ fontSize: 12, fontWeight: 700, color }}>
        {active}
        {active !== configured && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>/{configured}</span>}
      </span>
      {!workersPaused && (
        <button
          className="btn"
          onClick={onSpawn}
          disabled={spawning}
          title={`Tạo thêm ${label} worker`}
          style={{
            background: 'none', border: 'none', cursor: spawning ? 'not-allowed' : 'pointer',
            color: spawning ? 'var(--text-muted)' : color, padding: '0 2px', opacity: spawning ? 0.5 : 1,
            display: 'flex', alignItems: 'center',
          }}
        >
          {spawning
            ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
            : <PlusCircle size={11} />
          }
        </button>
      )}
    </div>
  );

  const QueueBar = ({ label, stats, color }) => {
    const total = (stats.pending || 0) + (stats.processing || 0) + (stats.done || 0) + (stats.failed || 0);
    const w = (v) => total > 0 ? `${Math.max((v / total) * 100, 0)}%` : '0%';
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color }}>{label}</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Tổng: {total}</span>
        </div>
        <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: 'var(--border)', gap: 1 }}>
          <div style={{ width: w(stats.pending), background: '#6366f1', transition: 'width 0.3s' }} title={`Pending: ${stats.pending || 0}`} />
          <div style={{ width: w(stats.processing), background: '#f59e0b', transition: 'width 0.3s' }} title={`Processing: ${stats.processing || 0}`} />
          <div style={{ width: w(stats.done), background: '#16a34a', transition: 'width 0.3s' }} title={`Done: ${stats.done || 0}`} />
          <div style={{ width: w(stats.failed), background: '#ef4444', transition: 'width 0.3s' }} title={`Failed: ${stats.failed || 0}`} />
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
          {[['pending', stats.pending, '#6366f1'], ['processing', stats.processing, '#f59e0b'], ['done', stats.done, '#16a34a'], ['failed', stats.failed, '#ef4444']].map(([lbl, val, clr]) => (
            <span key={lbl} style={{ fontSize: 11, color: clr }}>{lbl}: <strong>{val || 0}</strong></span>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
      padding: '12px 14px',
      background: 'var(--bg-panel)', borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border)',
    }}>
      {/* Header row */}
      <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={14} color="var(--accent)" />
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
              Queue Monitor
            </span>
            <StatusDot ok={running && !workersPaused} label={workersPaused ? 'Paused' : running ? 'Running' : 'Stopped'} />
          </div>
          <div style={{ display: 'flex', gap: 12, borderLeft: '1px solid var(--border)', paddingLeft: 10 }}>
            <WorkerBadge label="KW" color="#6366f1" configured={workers.keyword} active={activeKw} onSpawn={onSpawnKw} spawning={spawningKw} />
            <WorkerBadge label="TL" color="#f59e0b" configured={workers.title} active={activeTl} onSpawn={onSpawnTl} spawning={spawningTl} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {workersPaused ? (
            <button className="btn" onClick={onResume} style={{ gap: 4, fontSize: 11, padding: '3px 10px', color: '#16a34a', border: '1px solid rgba(22,163,74,0.3)' }}>
              <PlayCircle size={12} /> Resume
            </button>
          ) : (
            <button className="btn" onClick={onPause} style={{ gap: 4, fontSize: 11, padding: '3px 10px', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
              <Pause size={12} /> Pause
            </button>
          )}
        </div>
      </div>

      <QueueBar label="Keyword Queue" stats={kw} color="#6366f1" />
      <QueueBar label="Title Queue"   stats={tl} color="#f59e0b" />

      {/* Webhook events */}
      <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          Webhooks:
          <strong style={{ color: '#6366f1' }}> {wh.pending_or_processing ?? 0}</strong> đang xử lý
          &nbsp;|&nbsp;
          <strong style={{ color: '#f59e0b' }}>{wh.ready_to_retry ?? 0}</strong> chờ retry
          &nbsp;|&nbsp;
          <strong style={{ color: '#ef4444' }}>{wh.failed ?? 0}</strong> failed
        </span>
      </div>
    </div>
  );
};

// ─── InfoField ─────────────────────────────────────────────────────────────────

const InfoField = ({ label, value, mono }) => (
  <div>
    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
    <div style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: mono ? 'monospace' : undefined, wordBreak: 'break-all' }}>
      {value || '—'}
    </div>
  </div>
);

// ─── KeywordRow ─────────────────────────────────────────────────────────────────

const DlqKeywordRow = ({ job, onReplay, onPurge, expanded, onExpand, companies = [], users = [], contracts = [] }) => {
  const [replaying, setReplaying] = useState(false);
  const [purging, setPurging] = useState(false);

  const getCompanyName = (id) => companies.find(c => c.id === id)?.name || id?.slice(0, 8) + '…' || '—';
  const getUserName    = (id) => {
    if (!id) return '—';
    const u = users.find(x => x.id === id);
    if (!u) return id;
    if (u.full_name && u.employee_code) return `${u.full_name} (${u.employee_code})`;
    if (u.full_name) return u.full_name;
    if (u.email) return u.email;
    return id;
  };
  const getContractCode = (id) => {
    if (!id) return '—';
    const c = companies.find(x => x.id === id);
    return c?.contract_code || id;
  };
  const getMaHd = (hopDongId) => {
    if (!hopDongId) return '—';
    const hd = contracts.find(h => h.id === hopDongId);
    return hd?.ma_hd || hopDongId;
  };

  const handleReplay = async (e) => {
    e.stopPropagation();
    setReplaying(true);
    try {
      const res = await apiClient.post(`/api/dlq/keyword/${job.id}/replay`);
      toast.success(res.data.message || 'Đã đẩy job vào keyword_queue');
      onReplay(job.id);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Lỗi replay job');
    } finally {
      setReplaying(false);
    }
  };

  const handlePurge = async (e) => {
    e.stopPropagation();
    if (!window.confirm(`Xóa vĩnh viễn job DLQ "${job.keyword}"?\nHành động này không thể hoàn tác.`)) return;
    setPurging(true);
    try {
      await apiClient.post(`/api/dlq/keyword/${job.id}/purge`);
      toast.success('Đã xóa vĩnh viễn khỏi DLQ');
      onPurge(job.id);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Lỗi xóa job');
    } finally {
      setPurging(false);
    }
  };

  return (
    <>
      <div
        className="table-row"
        style={{ gridTemplateColumns: QUEUE_META.keyword.cols, cursor: 'pointer' }}
        onClick={() => onExpand(job.id)}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{
            width: 28, height: 28, borderRadius: 6,
            background: QUEUE_META.keyword.bg, color: QUEUE_META.keyword.color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700,
          }}>
            KW
          </span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
          {job.id.slice(0, 8)}…
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {job.keyword}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getCompanyName(job.company_id)}</div>
        <div style={{ fontSize: 12, textAlign: 'center', color: 'var(--text-secondary)' }}>{job.so_tieude}</div>
        <div style={{ fontSize: 12, textAlign: 'center' }}>
          <span style={{ color: '#ef4444', fontWeight: 700 }}>{job.retries}</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmtDatetime(job.failed_at)}</div>
        <div style={{ fontSize: 12, color: '#ef4444', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {job.error}
        </div>
      </div>

      {expanded === job.id && (
        <div style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)', padding: '14px 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <InfoField label="DLQ ID" value={job.id} mono />
            <InfoField label="Original ID" value={job.original_id} mono />
            <InfoField label="Company" value={getCompanyName(job.company_id)} />
            <InfoField label="Mã HĐ" value={getMaHd(job.hop_dong_id)} mono />
            <InfoField label="Chu kỳ" value={job.chuki || '—'} />
            <InfoField label="Người tạo" value={getUserName(job.created_by)} />
            <InfoField label="Số tiêu đề" value={job.so_tieude} />
            <InfoField label="Retry lần" value={job.retries} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Error</div>
            <pre style={{ margin: 0, fontSize: 12, color: '#ef4444', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '8px 12px', fontFamily: 'monospace', overflowX: 'auto' }}>{job.error}</pre>
          </div>
          {job.payload_json && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Payload</div>
              <pre style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', background: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontFamily: 'monospace', overflowX: 'auto', maxHeight: 200, overflowY: 'auto' }}>
                {(() => { try { return JSON.stringify(JSON.parse(job.payload_json), null, 2); } catch { return job.payload_json; } })()}
              </pre>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" style={{ gap: 6, fontSize: 12, padding: '6px 14px' }} disabled={replaying} onClick={handleReplay}>
              {replaying ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <RotateCcw size={13} />}
              Đẩy lại Queue
            </button>
            <button className="btn" style={{ gap: 6, fontSize: 12, padding: '6px 14px', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }} disabled={purging} onClick={handlePurge}>
              {purging ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={13} />}
              Xóa vĩnh viễn
            </button>
          </div>
        </div>
      )}
    </>
  );
};

// ─── TitleRow ──────────────────────────────────────────────────────────────────

const DlqTitleRow = ({ job, onReplay, onPurge, expanded, onExpand, companies = [], users = [] }) => {
  const [replaying, setReplaying] = useState(false);
  const [purging, setPurging] = useState(false);

  const getCompanyName = (id) => companies.find(c => c.id === id)?.name || id || '—';
  const getUserName    = (id) => {
    if (!id) return '—';
    const u = users.find(x => x.id === id);
    if (!u) return id;
    if (u.full_name && u.employee_code) return `${u.full_name} (${u.employee_code})`;
    if (u.full_name) return u.full_name;
    if (u.email) return u.email;
    return id;
  };
  const getContractCode = (id) => {
    if (!id) return '—';
    const c = companies.find(x => x.id === id);
    return c?.contract_code || id;
  };
  const getMaHd = (hopDongId) => {
    if (!hopDongId) return '—';
    const hd = contracts.find(h => h.id === hopDongId);
    return hd?.ma_hd || hopDongId;
  };

  const handleReplay = async (e) => {
    e.stopPropagation();
    setReplaying(true);
    try {
      const res = await apiClient.post(`/api/dlq/title/${job.id}/replay`);
      toast.success(res.data.message || 'Đã đẩy job vào title_queue');
      onReplay(job.id);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Lỗi replay job');
    } finally {
      setReplaying(false);
    }
  };

  const handlePurge = async (e) => {
    e.stopPropagation();
    if (!window.confirm(`Xóa vĩnh viễn title DLQ job?\nHành động này không thể hoàn tác.`)) return;
    setPurging(true);
    try {
      await apiClient.post(`/api/dlq/title/${job.id}/purge`);
      toast.success('Đã xóa vĩnh viễn khỏi DLQ');
      onPurge(job.id);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Lỗi xóa job');
    } finally {
      setPurging(false);
    }
  };

  return (
    <>
      <div
        className="table-row"
        style={{ gridTemplateColumns: QUEUE_META.title.cols, cursor: 'pointer' }}
        onClick={() => onExpand(job.id)}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{
            width: 28, height: 28, borderRadius: 6,
            background: QUEUE_META.title.bg, color: QUEUE_META.title.color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700,
          }}>
            TL
          </span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
          {job.id.slice(0, 8)}…
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {job.keyword}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {job.keyword_q_id?.slice(0, 12) || '—'}…
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getCompanyName(job.company_id)}</div>
        <div style={{ fontSize: 12, textAlign: 'center' }}>
          <span style={{ color: '#ef4444', fontWeight: 700 }}>{job.retries}</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmtDatetime(job.failed_at)}</div>
        <div style={{ fontSize: 12, color: '#ef4444', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {job.error}
        </div>
      </div>

      {expanded === job.id && (
        <div style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)', padding: '14px 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <InfoField label="DLQ ID" value={job.id} mono />
            <InfoField label="Original ID" value={job.original_id} mono />
            <InfoField label="Keyword Q ID" value={job.keyword_q_id} mono />
            <InfoField label="Company" value={getCompanyName(job.company_id)} />
            <InfoField label="Mã HĐ" value={getMaHd(job.hop_dong_id)} mono />
            <InfoField label="Chu kỳ" value={job.chuki || '—'} />
            <InfoField label="Người tạo" value={getUserName(job.created_by)} />
            <InfoField label="Retry lần" value={job.retries} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Error</div>
            <pre style={{ margin: 0, fontSize: 12, color: '#ef4444', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '8px 12px', fontFamily: 'monospace', overflowX: 'auto' }}>{job.error}</pre>
          </div>
          {job.titles_json && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Titles ({(() => { try { return JSON.parse(job.titles_json).length; } catch { return '?'; } })()})
              </div>
              <pre style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', background: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontFamily: 'monospace', overflowX: 'auto', maxHeight: 160, overflowY: 'auto' }}>
                {(() => { try { return JSON.stringify(JSON.parse(job.titles_json), null, 2); } catch { return job.titles_json; } })()}
              </pre>
            </div>
          )}
          {job.payload_json && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Payload</div>
              <pre style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', background: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontFamily: 'monospace', overflowX: 'auto', maxHeight: 160, overflowY: 'auto' }}>
                {(() => { try { return JSON.stringify(JSON.parse(job.payload_json), null, 2); } catch { return job.payload_json; } })()}
              </pre>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" style={{ gap: 6, fontSize: 12, padding: '6px 14px' }} disabled={replaying} onClick={handleReplay}>
              {replaying ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <RotateCcw size={13} />}
              Đẩy lại Queue
            </button>
            <button className="btn" style={{ gap: 6, fontSize: 12, padding: '6px 14px', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }} disabled={purging} onClick={handlePurge}>
              {purging ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={13} />}
              Xóa vĩnh viễn
            </button>
          </div>
        </div>
      )}
    </>
  );
};

// ─── Main Page ─────────────────────────────────────────────────────────────────

const DEFAULT_THRESHOLDS = { keyword_warn: 10, keyword_crit: 50, title_warn: 10, title_crit: 50 };

const Dlq = () => {
  const [activeTab, setActiveTab]         = useState('keyword');
  const [kwJobs, setKwJobs]               = useState([]);
  const [tlJobs, setTlJobs]               = useState([]);
  const [loadingKw, setLoadingKw]         = useState(true);
  const [loadingTl, setLoadingTl]         = useState(true);
  const [stats, setStats]                 = useState(null);
  const [loadingStats, setLoadingStats]   = useState(true);
  const [kwFilter, setKwFilter]           = useState('false');
  const [tlFilter, setTlFilter]           = useState('false');
  const [expanded, setExpanded]           = useState(null);
  const [autoRefresh, setAutoRefresh]     = useState(false);
  const [showThresholdModal, setShowThresholdModal] = useState(false);
  const [thresholds, setThresholds]       = useState(() => {
    try { return JSON.parse(localStorage.getItem('dlq_thresholds') || 'null') || DEFAULT_THRESHOLDS; }
    catch { return DEFAULT_THRESHOLDS; }
  });
  const [queueStats, setQueueStats]        = useState(null);
  const [loadingQueue, setLoadingQueue]   = useState(true);
  const [workersPaused, setWorkersPaused] = useState(false);
  const [spawningKw, setSpawningKw]       = useState(false);
  const [spawningTl, setSpawningTl]       = useState(false);
  const [companies, setCompanies]         = useState([]);
  const [users, setUsers]                 = useState([]);
  const [contracts, setContracts]         = useState([]);

  // ── Fetch companies + users + contracts for name lookup ──────────────────────
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

  // ── Lookup helpers ─────────────────────────────────────────────────────────
  const getCompanyName = (id) => companies.find(c => c.id === id)?.name || id || '—';
  const getUserName    = (id) => {
    if (!id) return '—';
    const u = users.find(x => x.id === id);
    if (!u) return id;
    if (u.full_name && u.employee_code) return `${u.full_name} (${u.employee_code})`;
    if (u.full_name) return u.full_name;
    if (u.email) return u.email;
    return id;
  };
  const getContractCode = (id) => {
    if (!id) return '—';
    const c = companies.find(x => x.id === id);
    return c?.contract_code || id;
  };
  const getMaHd = (hopDongId) => {
    if (!hopDongId) return '—';
    const hd = contracts.find(h => h.id === hopDongId);
    return hd?.ma_hd || hopDongId;
  };

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchStats = useCallback(async () => {
    try {
      const res = await apiClient.get('/api/dlq');
      setStats(res.data);
    } catch { /* silent */ }
    finally { setLoadingStats(false); }
  }, []);

  const fetchKeywordDlq = useCallback(async () => {
    setLoadingKw(true);
    try {
      const res = await apiClient.get('/api/dlq/keyword', { params: { limit: 200, replayed: kwFilter } });
      setKwJobs(res.data);
    } catch { toast.error('Lỗi tải keyword DLQ'); }
    finally { setLoadingKw(false); }
  }, [kwFilter]);

  const fetchTitleDlq = useCallback(async () => {
    setLoadingTl(true);
    try {
      const res = await apiClient.get('/api/dlq/title', { params: { limit: 200, replayed: tlFilter } });
      setTlJobs(res.data);
    } catch { toast.error('Lỗi tải title DLQ'); }
    finally { setLoadingTl(false); }
  }, [tlFilter]);

  const fetchQueueStats = useCallback(async () => {
    try {
      const res = await apiClient.get('/api/queue/status');
      setQueueStats(res.data);
      setWorkersPaused(!res.data.running);
    } catch { /* silent */ }
    finally { setLoadingQueue(false); }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchKeywordDlq(); }, [fetchKeywordDlq]);
  useEffect(() => { fetchTitleDlq(); }, [fetchTitleDlq]);
  useEffect(() => { fetchQueueStats(); }, [fetchQueueStats]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => {
      fetchStats();
      fetchQueueStats();
      if (activeTab === 'keyword') fetchKeywordDlq();
      else fetchTitleDlq();
    }, 15000);
    return () => clearInterval(id);
  }, [autoRefresh, activeTab, fetchStats, fetchKeywordDlq, fetchTitleDlq, fetchQueueStats]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleTabChange = (tab) => { setActiveTab(tab); setExpanded(null); };

  const handleRemoveJob = useCallback((id) => {
    if (activeTab === 'keyword') setKwJobs(prev => prev.filter(j => j.id !== id));
    else setTlJobs(prev => prev.filter(j => j.id !== id));
    fetchStats();
  }, [activeTab, fetchStats]);

  const handleRefresh = () => {
    fetchStats();
    fetchQueueStats();
    if (activeTab === 'keyword') fetchKeywordDlq();
    else fetchTitleDlq();
  };

  // ── Bulk Replay ────────────────────────────────────────────────────────────

  const [bulkReplaying, setBulkReplaying] = useState(false);

  const handleBulkReplay = async () => {
    const count = activeTab === 'keyword' ? kwJobs.filter(j => !j.replayed_at).length : tlJobs.filter(j => !j.replayed_at).length;
    if (count === 0) { toast.info('Không có job nào chưa replay để đẩy lại'); return; }
    if (!window.confirm(`Đẩy tất cả ${count} job CHƯA replay vào ${activeTab === 'keyword' ? 'keyword_queue' : 'title_queue'}?\n\nSẽ replay tuần tự từng job.`)) return;

    setBulkReplaying(true);
    try {
      const res = await apiClient.post(`/api/dlq/${activeTab}/replay-all`);
      const { replayed, failed, message } = res.data;
      if (failed > 0) {
        toast.warning(`${message}\n${failed} job thất bại.`);
      } else {
        toast.success(message);
      }
      if (activeTab === 'keyword') fetchKeywordDlq();
      else fetchTitleDlq();
      fetchStats();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Lỗi bulk replay');
    } finally {
      setBulkReplaying(false);
    }
  };

  // ── Export ─────────────────────────────────────────────────────────────────

  const handleExport = async (format) => {
    try {
      const res = await apiClient.get(`/api/dlq/export`, { params: { type: activeTab, format }, responseType: format === 'csv' ? 'blob' : 'json' });
      if (format === 'csv') {
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const a = document.createElement('a'); a.href = url;
        a.download = `dlq-${activeTab}-${Date.now()}.csv`; document.body.appendChild(a); a.click(); document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        toast.success('Đã tải file CSV');
      } else {
        const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url;
        a.download = `dlq-${activeTab}-${Date.now()}.json`; document.body.appendChild(a); a.click(); document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        toast.success('Đã tải file JSON');
      }
    } catch (err) {
      toast.error('Lỗi export: ' + (err.response?.data?.error || err.message));
    }
  };

  // ── Threshold ──────────────────────────────────────────────────────────────

  const handleSaveThresholds = (vals) => {
    setThresholds(vals);
    localStorage.setItem('dlq_thresholds', JSON.stringify(vals));
    toast.success('Đã lưu ngưỡng cảnh báo');
  };

  const kwCount = stats?.keyword_dlq_count ?? 0;
  const tlCount = stats?.title_dlq_count   ?? 0;
  const kwAlert = kwCount >= thresholds.keyword_crit ? 'critical' : kwCount >= thresholds.keyword_warn ? 'warning' : null;
  const tlAlert = tlCount >= thresholds.title_crit  ? 'critical' : tlCount >= thresholds.title_warn  ? 'warning' : null;

  // ── Queue pause/resume ─────────────────────────────────────────────────────

  const handlePause = async () => {
    try {
      await apiClient.post('/api/queue/pause');
      setWorkersPaused(true);
      toast.success('Workers đã tạm dừng');
    } catch { toast.error('Lỗi tạm dừng workers'); }
  };

  const handleResume = async () => {
    try {
      await apiClient.post('/api/queue/resume');
      setWorkersPaused(false);
      toast.success('Workers đã khôi phục');
      fetchQueueStats();
    } catch { toast.error('Lỗi khôi phục workers'); }
  };

  // ── Spawn workers ──────────────────────────────────────────────────────────

  const handleSpawnKw = async () => {
    setSpawningKw(true);
    try {
      const res = await apiClient.post('/api/queue/spawn-kw');
      toast.success(res.data.message);
      fetchQueueStats();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Lỗi tạo KW worker');
    } finally {
      setSpawningKw(false);
    }
  };

  const handleSpawnTl = async () => {
    setSpawningTl(true);
    try {
      const res = await apiClient.post('/api/queue/spawn-tl');
      toast.success(res.data.message);
      fetchQueueStats();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Lỗi tạo TL worker');
    } finally {
      setSpawningTl(false);
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────

  const jobs         = activeTab === 'keyword' ? kwJobs : tlJobs;
  const loading      = activeTab === 'keyword' ? loadingKw : loadingTl;
  const replayedJobs = jobs.filter(j => j.replayed_at);
  const unreplayed   = jobs.filter(j => !j.replayed_at).length;
  const cols         = activeTab === 'keyword' ? QUEUE_META.keyword.headerCols : QUEUE_META.title.headerCols;
  const emptyMsg     = activeTab === 'keyword' ? 'Không có job nào trong Keyword DLQ' : 'Không có job nào trong Title DLQ';
  const exportCount  = jobs.length;

  return (
    <div className="page-container">
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* ── Header ── */}
      <div className="page-header">
        <div className="page-title-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Database size={20} color="var(--accent)" />
            <h1 className="page-title">Dead Letter Queue</h1>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className={`btn ${autoRefresh ? 'btn-primary' : 'btn-outline'}`} onClick={() => setAutoRefresh(v => !v)} title={autoRefresh ? 'Tắt tự động làm mới' : 'Bật tự động làm mới (15s)'} style={{ height: 36, width: 36, padding: 0 }}>
              <RefreshCw size={14} style={autoRefresh ? { animation: 'spin 3s linear infinite' } : {}} />
            </button>
            <button className="btn btn-outline" onClick={handleRefresh} style={{ height: 36 }}>
              <RefreshCw size={14} /> Làm mới
            </button>
          </div>
        </div>
      </div>

      {/* ── Alert banners ── */}
      {(kwAlert || tlAlert) && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
          borderRadius: 'var(--radius-md)', marginBottom: 12, flexWrap: 'wrap',
          background: kwAlert === 'critical' || tlAlert === 'critical'
            ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
          border: `1px solid ${kwAlert === 'critical' || tlAlert === 'critical' ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`,
        }}>
          <AlertTriangle size={16} color={kwAlert === 'critical' || tlAlert === 'critical' ? '#ef4444' : '#f59e0b'} />
          <span style={{ fontSize: 13, flex: 1, color: kwAlert === 'critical' || tlAlert === 'critical' ? '#ef4444' : '#f59e0b' }}>
            {kwAlert === 'critical' && <strong>Keyword DLQ vượt ngưỡng Critical ({kwCount} ≥ {thresholds.keyword_crit})</strong>}
            {kwAlert === 'warning' && <strong>Keyword DLQ vượt ngưỡng Warning ({kwCount} ≥ {thresholds.keyword_warn})</strong>}
            {(kwAlert && tlAlert) && '  |  '}
            {tlAlert === 'critical' && <strong>Title DLQ vượt ngưỡng Critical ({tlCount} ≥ {thresholds.title_crit})</strong>}
            {tlAlert === 'warning' && <strong>Title DLQ vượt ngưỡng Warning ({tlCount} ≥ {thresholds.title_warn})</strong>}
          </span>
          <button className="btn" onClick={() => setShowThresholdModal(true)} style={{ gap: 5, fontSize: 11, padding: '4px 10px', border: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
            <Settings size={12} /> Ngưỡng
          </button>
        </div>
      )}

      {/* ── Stats Cards ── */}
      <div className="stats-row">
        <div className="stat-card" style={{ cursor: 'pointer', transition: 'all 0.15s' }} onClick={() => handleTabChange('keyword')}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="stat-card-label">Keyword DLQ</div>
            <div className="stat-card-icon" style={{ background: 'rgba(99,102,241,0.12)' }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#6366f1' }}>KW</span>
            </div>
          </div>
          <div className="stat-card-value" style={{ color: loadingStats ? 'var(--text-muted)' : kwAlert === 'critical' ? '#ef4444' : kwAlert === 'warning' ? '#f59e0b' : '#6366f1' }}>
            {loadingStats ? '…' : (stats?.keyword_dlq_count ?? 0)}
          </div>
        </div>

        <div className="stat-card" style={{ cursor: 'pointer', transition: 'all 0.15s' }} onClick={() => handleTabChange('title')}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="stat-card-label">Title DLQ</div>
            <div className="stat-card-icon" style={{ background: 'rgba(245,158,11,0.12)' }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#f59e0b' }}>TL</span>
            </div>
          </div>
          <div className="stat-card-value" style={{ color: loadingStats ? 'var(--text-muted)' : tlAlert === 'critical' ? '#ef4444' : tlAlert === 'warning' ? '#f59e0b' : '#f59e0b' }}>
            {loadingStats ? '…' : (stats?.title_dlq_count ?? 0)}
          </div>
        </div>

        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="stat-card-label">Đã Replay</div>
            <div className="stat-card-icon" style={{ background: 'rgba(22,163,74,0.12)' }}>
              <RotateCcw size={15} color="#16a34a" />
            </div>
          </div>
          <div className="stat-card-value" style={{ color: loadingStats ? 'var(--text-muted)' : '#16a34a' }}>
            {loadingStats ? '…' : (stats?.total_replayed ?? 0)}
          </div>
        </div>

        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="stat-card-label">Chưa Replay</div>
            <div className="stat-card-icon" style={{ background: 'rgba(239,68,68,0.12)' }}>
              <AlertTriangle size={15} color="#ef4444" />
            </div>
          </div>
          <div className="stat-card-value" style={{ color: loadingStats ? 'var(--text-muted)' : '#ef4444' }}>
            {loadingStats ? '…' : ((stats?.keyword_dlq_count ?? 0) + (stats?.title_dlq_count ?? 0) - (stats?.total_replayed ?? 0))}
          </div>
        </div>
      </div>

      {/* ── Queue Monitor ── */}
      <QueueMonitorPanel
        queueStats={queueStats}
        workersPaused={workersPaused}
        onPause={handlePause}
        onResume={handleResume}
        loading={loadingQueue}
        onSpawnKw={handleSpawnKw}
        onSpawnTl={handleSpawnTl}
        spawningKw={spawningKw}
        spawningTl={spawningTl}
      />

      {/* ── Tabs + Filter + Action row ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, marginBottom: 12, flexWrap: 'wrap' }}>

        {/* Tab buttons */}
        <div style={{ display: 'flex', gap: 2, background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 10, padding: 3 }}>
          <button onClick={() => handleTabChange('keyword')} style={{
            padding: '6px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            border: 'none', cursor: 'pointer',
            background: activeTab === 'keyword' ? '#6366f1' : 'transparent',
            color: activeTab === 'keyword' ? '#fff' : 'var(--text-muted)',
            display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s',
          }}>
            <span style={{ fontWeight: 800, fontSize: 11 }}>KW</span> Keyword
            {!loadingStats && stats?.keyword_dlq_count > 0 && (
              <span style={{ background: 'rgba(255,255,255,0.25)', color: '#fff', borderRadius: 999, padding: '0 6px', fontSize: 11, fontWeight: 700 }}>
                {stats.keyword_dlq_count}
              </span>
            )}
          </button>
          <button onClick={() => handleTabChange('title')} style={{
            padding: '6px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            border: 'none', cursor: 'pointer',
            background: activeTab === 'title' ? '#f59e0b' : 'transparent',
            color: activeTab === 'title' ? '#fff' : 'var(--text-muted)',
            display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s',
          }}>
            <span style={{ fontWeight: 800, fontSize: 11 }}>TL</span> Title
            {!loadingStats && stats?.title_dlq_count > 0 && (
              <span style={{ background: 'rgba(255,255,255,0.25)', color: '#fff', borderRadius: 999, padding: '0 6px', fontSize: 11, fontWeight: 700 }}>
                {stats.title_dlq_count}
              </span>
            )}
          </button>
        </div>

        {/* Filter pills */}
        <div style={{ display: 'flex', gap: 4 }}>
          {[['false', 'Chưa replay'], ['true', 'Đã replay'], ['', 'Tất cả']].map(([val, lbl]) => {
            const current = activeTab === 'keyword' ? kwFilter : tlFilter;
            const active = current === val;
            return (
              <button key={val} onClick={() => activeTab === 'keyword' ? setKwFilter(val) : setTlFilter(val)} style={{
                padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                background: active ? 'rgba(99,102,241,0.12)' : 'transparent',
                color: active ? 'var(--accent)' : 'var(--text-muted)',
                cursor: 'pointer', transition: 'all 0.15s',
              }}>
                {lbl}
              </button>
            );
          })}
        </div>

        {/* Bulk Replay */}
        {unreplayed > 0 && (
          <button
            className="btn"
            onClick={handleBulkReplay}
            disabled={bulkReplaying}
            style={{ gap: 6, fontSize: 12, padding: '5px 12px', color: '#16a34a', border: '1px solid rgba(22,163,74,0.3)', background: 'rgba(22,163,74,0.06)' }}
          >
            {bulkReplaying ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={12} />}
            Replay tất cả ({unreplayed})
          </button>
        )}

        {/* Purge replayed */}
        {replayedJobs.length > 0 && (
          <button
            className="btn"
            onClick={async () => {
              if (!window.confirm(`Xóa ${replayedJobs.length} job đã replay?\nHành động này không thể hoàn tác.`)) return;
              try {
                await Promise.all(replayedJobs.map(j => apiClient.post(`/api/dlq/${activeTab}/${j.id}/purge`)));
                toast.success(`Đã xóa ${replayedJobs.length} job đã replay`);
                if (activeTab === 'keyword') fetchKeywordDlq(); else fetchTitleDlq();
                fetchStats();
              } catch (err) { toast.error(err.response?.data?.error || 'Lỗi xóa'); }
            }}
            style={{ gap: 6, fontSize: 12, padding: '5px 12px', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}
          >
            <Trash2 size={12} /> Xóa {replayedJobs.length} đã replay
          </button>
        )}

        {/* Export dropdown */}
        {exportCount > 0 && (
          <div style={{ position: 'relative', marginLeft: 'auto' }}>
            <button
              className="btn btn-outline"
              onClick={e => {
                const menu = e.currentTarget.nextElementSibling;
                document.querySelectorAll('.export-menu').forEach(el => el !== menu && (el.style.display = 'none'));
                menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
              }}
              style={{ gap: 6, fontSize: 12, padding: '5px 12px', height: 32 }}
            >
              <Download size={12} /> Export ({exportCount})
              <ChevronDown size={12} />
            </button>
            <div className="export-menu" style={{
              display: 'none', position: 'absolute', right: 0, top: '100%', marginTop: 4,
              background: 'var(--bg-elevated)', border: '1px solid var(--border)',
              borderRadius: 8, overflow: 'hidden', zIndex: 100, minWidth: 140,
              boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
            }}>
              {[['csv', 'Export CSV'], ['json', 'Export JSON']].map(([fmt, lbl]) => (
                <button
                  key={fmt}
                  onClick={async (e) => {
                    e.currentTarget.closest('.export-menu').style.display = 'none';
                    await handleExport(fmt);
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                    padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 13, color: 'var(--text-primary)', textAlign: 'left',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-panel)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  <Download size={13} color="var(--accent)" /> {lbl}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Table ── */}
      <div className="table-container">
        <div className="table-header" style={{ gridTemplateColumns: cols }}>
          {activeTab === 'keyword' ? (
            <><div /><div>DLQ ID</div><div>Keyword</div><div>Company</div><div style={{ textAlign: 'center' }}>Tiêu đề</div><div style={{ textAlign: 'center' }}>Retries</div><div>Failed At</div><div>Error</div></>
          ) : (
            <><div /><div>DLQ ID</div><div>Keyword</div><div>Keyword Q ID</div><div>Company</div><div style={{ textAlign: 'center' }}>Retries</div><div>Failed At</div><div>Error</div></>
          )}
        </div>

        {loading && (
          <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', marginBottom: 8 }} />
            <div style={{ fontSize: 14 }}>Đang tải DLQ…</div>
          </div>
        )}

        {!loading && jobs.length === 0 && (
          <div className="table-empty">
            <div className="table-empty-icon"><Inbox size={28} /></div>
            <div className="table-empty-text">{emptyMsg}</div>
            <div className="table-empty-hint">
              {activeTab === 'keyword' ? 'Các job thất bại sau khi retry đủ sẽ xuất hiện ở đây' : 'Các job title thất bại sau khi retry đủ sẽ xuất hiện ở đây'}
            </div>
          </div>
        )}

        {!loading && jobs.map(job =>
          activeTab === 'keyword' ? (
            <DlqKeywordRow key={job.id} job={job} onReplay={handleRemoveJob} onPurge={handleRemoveJob} onExpand={setExpanded} expanded={expanded} companies={companies} users={users} contracts={contracts} />
          ) : (
            <DlqTitleRow key={job.id} job={job} onReplay={handleRemoveJob} onPurge={handleRemoveJob} onExpand={setExpanded} expanded={expanded} companies={companies} users={users} contracts={contracts} />
          )
        )}
      </div>

      {/* ── Footer hint ── */}
      <div style={{
        marginTop: 12, padding: '8px 14px',
        background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)',
        borderRadius: 'var(--radius-md)', fontSize: 12, color: 'var(--text-muted)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <AlertTriangle size={14} style={{ color: '#6366f1', flexShrink: 0 }} />
        <span>
          <strong>Replay</strong> đẩy job trở lại main queue để xử lý lại.
          <strong> Bulk Replay</strong> đẩy tất cả chưa replay cùng lúc.
          <strong> Xóa vĩnh viễn</strong> không thể hoàn tác.
        </span>
        <button
          onClick={() => setShowThresholdModal(true)}
          style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <Settings size={12} /> Ngưỡng: KW {thresholds.keyword_warn}/{thresholds.keyword_crit} | TL {thresholds.title_warn}/{thresholds.title_crit}
        </button>
      </div>

      {/* ── Threshold Modal ── */}
      {showThresholdModal && (
        <ThresholdModal
          thresholds={thresholds}
          onSave={handleSaveThresholds}
          onClose={() => setShowThresholdModal(false)}
        />
      )}
    </div>
  );
};

export default Dlq;
