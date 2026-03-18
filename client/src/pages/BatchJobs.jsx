import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../config/api';
import {
  Layers, RefreshCw, Trash2, CheckCircle2, Clock, XCircle,
  ChevronDown, ChevronUp, Loader2, Send, AlertTriangle, FileText, Zap
} from 'lucide-react';
import { useToken } from '../context/TokenContext';

import { API } from '../config/api';
const API_ENDPOINT = API.batchJobs;

const STATUS_CONFIG = {
  pending: { label: 'Đang xử lý',  icon: <Clock size={13} />,        color: 'var(--warning)', bg: 'var(--warning-subtle)' },
  done:    { label: 'Hoàn thành',  icon: <CheckCircle2 size={13} />, color: 'var(--success)', bg: 'var(--success-subtle)' },
  failed:  { label: 'Thất bại',    icon: <XCircle size={13} />,      color: 'var(--danger)',  bg: 'var(--danger-subtle)'  },
};

const GEMINI_STATE_LABEL = {
  JOB_STATE_PENDING:   'Đang chờ trong hàng',
  JOB_STATE_RUNNING:   'Gemini đang xử lý...',
  JOB_STATE_SUCCEEDED: 'Gemini xong — chờ import',
  JOB_STATE_FAILED:    'Gemini thất bại',
  JOB_STATE_CANCELLED: 'Đã hủy',
  JOB_STATE_EXPIRED:   'Hết hạn',
};

// Đếm ngược đến lần check tự động tiếp theo (dựa trên ISO string từ DB)
function useNextCheckCountdown(lastCheckIso, intervalMs = 60 * 60 * 1000) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    if (!lastCheckIso) return;
    const base = new Date(lastCheckIso).getTime();
    const tick = () => {
      const elapsed = Date.now() - base;
      const remaining = Math.max(0, intervalMs - elapsed);
      const min = Math.floor(remaining / 60000);
      const sec = Math.floor((remaining % 60000) / 1000);
      setTimeLeft(`${min}:${String(sec).padStart(2, '0')}`);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [lastCheckIso, intervalMs]);

  return timeLeft;
}

export default function BatchJobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [checkingId, setCheckingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [checkResult, setCheckResult] = useState({});
  const [triggering, setTriggering] = useState(false);
  const [lastCheckIso, setLastCheckIso] = useState(null);
  const { refreshStats } = useToken();

  const nextCheck = useNextCheckCountdown(lastCheckIso);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await apiClient.get(API_ENDPOINT);
      setJobs(res.data.jobs);
      if (res.data.lastCheck) setLastCheckIso(res.data.lastCheck);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
    // Auto refresh list mỗi 2 phút
    const timer = setInterval(fetchJobs, 120_000);
    return () => clearInterval(timer);
  }, [fetchJobs]);

  // Trigger check thủ công tất cả job
  const handleCheckAll = async () => {
    setTriggering(true);
    try {
      await apiClient.post(`${API_ENDPOINT}/check-all`);
      // Đợi 3 giây rồi refresh list — fetchJobs sẽ cập nhật lastCheckIso từ DB
      setTimeout(() => {
        fetchJobs();
        refreshStats();
      }, 3000);
    } catch (err) {
      alert('Lỗi: ' + (err.response?.data?.error || err.message));
    } finally {
      setTimeout(() => setTriggering(false), 3000);
    }
  };

  const handleCheck = async (job) => {
    setCheckingId(job.id);
    setCheckResult(prev => ({ ...prev, [job.id]: null }));
    try {
      const res = await apiClient.post(`${API_ENDPOINT}/${job.id}/check`);
      setCheckResult(prev => ({ ...prev, [job.id]: res.data }));
      if (res.data.status === 'done') {
        refreshStats();
        fetchJobs();
      }
    } catch (err) {
      setCheckResult(prev => ({
        ...prev,
        [job.id]: { error: err.response?.data?.error || err.message }
      }));
    } finally {
      setCheckingId(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Xóa batch job này? Sau đó có thể gửi lại yêu cầu viết từ trang Từ Khóa.')) return;
    setDeletingId(id);
    try {
      await apiClient.delete(`${API_ENDPOINT}/${id}`);
      setJobs(prev => prev.filter(j => j.id !== id));
    } catch (err) {
      alert('Lỗi xóa job: ' + (err.response?.data?.error || err.message));
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const pendingCount = jobs.filter(j => j.status === 'pending').length;
  const doneCount    = jobs.filter(j => j.status === 'done').length;

  return (
    <div className="page-content">
      <div style={{ maxWidth: 860, margin: '0 auto' }}>

        {/* Header */}
        <div className="page-title-row" style={{ marginBottom: 8 }}>
          <div>
            <h1 className="page-title">Batch Jobs</h1>
            <p className="page-subtitle">
              Theo dõi các yêu cầu viết bài hàng loạt — Gemini Batch API giảm <strong>50% chi phí</strong>
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {pendingCount > 0 && (
              <button
                onClick={handleCheckAll}
                className="btn btn-primary"
                disabled={triggering}
                title="Kích hoạt kiểm tra tất cả job ngay (server tự check mỗi 60 phút)"
                style={{ gap: 6 }}
              >
                {triggering
                  ? <><Loader2 className="animate-spin" size={14} /> Đang kích hoạt...</>
                  : <><Zap size={14} /> Kiểm tra Tất Cả Ngay</>}
              </button>
            )}
            <button onClick={fetchJobs} className="btn btn-outline" title="Làm mới danh sách">
              <RefreshCw size={15} /> Làm mới
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Tổng jobs',   value: jobs.length,  color: 'var(--accent)'   },
            { label: 'Đang chờ',    value: pendingCount, color: 'var(--warning)'  },
            { label: 'Hoàn thành',  value: doneCount,    color: 'var(--success)'  },
          ].map(s => (
            <div key={s.label} className="panel" style={{ flex: 1, padding: '12px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Auto-check info — chỉ hiện khi có job đang pending */}
        {pendingCount > 0 && (
          <div className="info-box info-box-blue" style={{ marginBottom: 20 }}>
            <Clock size={14} style={{ flexShrink: 0 }} />
            <span>
              Server tự động kiểm tra tất cả job mỗi <strong>60 phút</strong>.
              Lần check tiếp theo còn khoảng <strong>{nextCheck}</strong>.
              Hoặc nhấn <strong>Kiểm tra Tất Cả Ngay</strong> để check ngay lập tức.
            </span>
          </div>
        )}

        <div className="info-box info-box-blue" style={{ marginBottom: 20 }}>
          <Send size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            Job được gửi từ trang <strong>Từ Khóa</strong> → Gemini xử lý vài phút đến vài giờ →{' '}
            Tự động import hoặc nhấn <strong>Kiểm tra &amp; Import</strong> thủ công.{' '}
            Muốn gửi lại: <strong>xóa job</strong> → quay về Từ Khóa → nhấn "Viết Tất Cả" lại.
          </span>
        </div>

        {/* Jobs list */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>
            <Loader2 className="animate-spin" size={28} style={{ margin: '0 auto 12px' }} />
            <p>Đang tải...</p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="panel" style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
            <Layers size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
            <p style={{ fontWeight: 500 }}>Chưa có batch job nào</p>
            <p style={{ fontSize: 13, marginTop: 6 }}>
              Vào trang Từ Khóa → chọn từ khóa → nhấn "Viết Tất Cả — Batch"
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {jobs.map(job => {
              const cfg = STATUS_CONFIG[job.status] || STATUS_CONFIG.pending;
              const isExpanded = expandedId === job.id;
              const cr = checkResult[job.id];
              const titles = Array.isArray(job.titles) ? job.titles : [];

              return (
                <div key={job.id} className="panel" style={{ overflow: 'hidden' }}>
                  {/* Row chính */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px' }}>

                    {/* Status badge */}
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                      color: cfg.color, background: cfg.bg, whiteSpace: 'nowrap', flexShrink: 0,
                    }}>
                      {cfg.icon} {cfg.label}
                    </span>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {job.keyword}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <span>{job.companyName || job.companyId}</span>
                        <span>{job.total} bài</span>
                        {job.status === 'done' && <span style={{ color: 'var(--success)' }}>✓ {job.succeeded} thành công</span>}
                        {job.gemini_state && <span style={{ fontFamily: 'monospace', opacity: 0.7 }}>{GEMINI_STATE_LABEL[job.gemini_state] || job.gemini_state}</span>}
                      </div>
                    </div>

                    {/* Date */}
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {formatDate(job.createdAt)}
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      {job.status === 'pending' && (
                        <button
                          className="btn btn-primary"
                          style={{ fontSize: 12, padding: '5px 12px', gap: 5 }}
                          onClick={() => handleCheck(job)}
                          disabled={checkingId === job.id}
                        >
                          {checkingId === job.id
                            ? <><Loader2 className="animate-spin" size={12} /> Đang kiểm tra</>
                            : <><CheckCircle2 size={12} /> Kiểm tra &amp; Import</>}
                        </button>
                      )}
                      <button
                        className="btn btn-outline"
                        style={{ fontSize: 12, padding: '5px 8px' }}
                        onClick={() => setExpandedId(isExpanded ? null : job.id)}
                        title="Xem chi tiết"
                      >
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                      <button
                        className="btn btn-outline btn-danger"
                        style={{ fontSize: 12, padding: '5px 8px' }}
                        onClick={() => handleDelete(job.id)}
                        disabled={deletingId === job.id}
                        title="Xóa job (cho phép gửi lại từ trang Từ Khóa)"
                      >
                        {deletingId === job.id ? <Loader2 className="animate-spin" size={14} /> : <Trash2 size={14} />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div style={{ borderTop: '1px solid var(--border)', padding: '14px 18px', background: 'var(--bg-panel)', fontSize: 13 }}>

                      {/* Check result */}
                      {cr && (
                        <div style={{ marginBottom: 14 }}>
                          {cr.error ? (
                            <div className="info-box info-box-red">
                              <AlertTriangle size={14} /> <span>Lỗi: {cr.error}</span>
                            </div>
                          ) : cr.status === 'pending' ? (
                            <div className="info-box info-box-blue">
                              <Clock size={14} /> <span>Job chưa hoàn thành. Trạng thái Gemini: <strong>{GEMINI_STATE_LABEL[cr.geminiState] || cr.geminiState}</strong></span>
                            </div>
                          ) : cr.status === 'done' ? (
                            <div className="info-box info-box-green">
                              <CheckCircle2 size={14} />
                              <span>Import thành công <strong>{cr.succeeded}</strong> bài{cr.failed > 0 && `, ${cr.failed} lỗi`}.</span>
                            </div>
                          ) : null}
                        </div>
                      )}

                      {/* Job info */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 24px', marginBottom: 12, color: 'var(--text-secondary)' }}>
                        <div><b>Gemini Job:</b> <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{job.gemini_job_name}</span></div>
                        <div><b>Gửi lúc:</b> {formatDate(job.createdAt)}</div>
                        {job.completedAt && <div><b>Hoàn thành:</b> {formatDate(job.completedAt)}</div>}
                        <div><b>Công ty:</b> {job.companyName || job.companyId}</div>
                      </div>

                      {/* Titles list */}
                      <div>
                        <div style={{ fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <FileText size={13} /> Danh sách tiêu đề ({titles.length})
                        </div>
                        <ul style={{ margin: 0, padding: '0 0 0 18px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {titles.map((t, i) => (
                            <li key={i} style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{t}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
