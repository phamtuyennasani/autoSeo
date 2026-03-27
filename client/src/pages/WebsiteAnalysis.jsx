/**
 * WebsiteAnalysis.jsx — Phân tích website & gợi ý từ khóa SEO.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { Globe, Play, Trash2, ChevronDown, ChevronRight, ExternalLink, Loader,
         CheckCircle2, AlertCircle, Clock, Search, Star, TrendingUp, FileText,
         RefreshCw, Filter, Plus } from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '../config/api';
import { AppSelect } from '../components/AppSelect';

const API_URL     = '/api/website-analysis';
const COMPANY_URL = '/api/companies';

const STATUS_MAP = {
  pending:   { label: 'Chờ',       color: '#6b7280', icon: Clock },
  crawling:  { label: 'Đang crawl', color: '#f59e0b', icon: Loader },
  analyzing: { label: 'Đang phân tích', color: '#8b5cf6', icon: Loader },
  done:      { label: 'Hoàn thành', color: '#22c55e', icon: CheckCircle2 },
  error:     { label: 'Lỗi',        color: '#ef4444', icon: AlertCircle },
};

const PRIORITY_COLOR = { 'Cao': '#ef4444', 'Trung bình': '#f59e0b', 'Thấp': '#22c55e' };
const INTENT_COLOR   = { 'Thông tin': '#3b82f6', 'Thương mại': '#8b5cf6', 'Giao dịch': '#f59e0b', 'Điều hướng': '#06b6d4' };

// ─── Số liệu tổng hợp ────────────────────────────────────────────────────
function SummaryCard({ label, value, color = 'var(--accent)' }) {
  return (
    <div style={{ padding: '16px 20px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, minWidth: 120 }}>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

export default function WebsiteAnalysis() {
  const [analyses, setAnalyses]         = useState([]);
  const [companies, setCompanies]       = useState([]);
  const [loading, setLoading]           = useState(true);
  const [creating, setCreating]         = useState(false);
  const [selected, setSelected]         = useState(null);   // analysis đang xem
  const [pages, setPages]               = useState([]);
  const [keywords, setKeywords]         = useState([]);
  const [activeTab, setActiveTab]       = useState('keywords'); // 'keywords' | 'pages'
  const [filterPriority, setFilterPriority] = useState('');
  const [filterIntent, setFilterIntent]     = useState('');
  const pollingRef = useRef(null);  // interval id (dùng ref để tránh stale closure)

  // Form tạo mới
  const [form, setForm] = useState({
    url: '', companyId: '', maxPages: 100, maxDepth: 3, delayMs: 300,
  });
  const [showForm, setShowForm] = useState(false);

  // ── Fetch pages + keywords cho 1 analysis ──────────────────────────────
  const fetchSelectedData = useCallback(async (id) => {
    try {
      const [pRes, kRes] = await Promise.all([
        apiClient.get(`${API_URL}/${id}/pages`),
        apiClient.get(`${API_URL}/${id}/keywords`),
      ]);
      setPages(pRes.data  || []);
      setKeywords(kRes.data || []);
    } catch (err) {
      console.error('[WebsiteAnalysis] fetchSelectedData lỗi:', err);
      toast.error('Không tải được dữ liệu chi tiết: ' + (err.response?.data?.error || err.message));
    }
  }, []);

  // ── Fetch danh sách ─────────────────────────────────────────────────────
  const fetchAnalyses = useCallback(async () => {
    try {
      const res = await apiClient.get(API_URL);
      setAnalyses(res.data);
    } catch {
      toast.error('Không tải được danh sách phân tích');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalyses();
    apiClient.get(COMPANY_URL).then(r => setCompanies(r.data || [])).catch(() => {});
  }, [fetchAnalyses]);

  // ── Cleanup interval khi unmount ─────────────────────────────────────────
  useEffect(() => {
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, []);

  // ── Auto-poll + tự động load data khi selected vừa done ─────────────────
  useEffect(() => {
    const running = analyses.some(a => ['pending', 'crawling', 'analyzing'].includes(a.status));

    // Nếu selected đang chạy và vừa chuyển sang done → load data ngay
    if (selected) {
      const updated = analyses.find(a => a.id === selected.id);
      if (updated) {
        // Sync lại selected với data mới nhất
        setSelected(updated);
        // Nếu vừa xong và chưa có keywords/pages → fetch
        if (updated.status === 'done' && keywords.length === 0 && pages.length === 0) {
          fetchSelectedData(updated.id);
        }
      }
    }

    if (running && !pollingRef.current) {
      pollingRef.current = setInterval(fetchAnalyses, 3000);
    } else if (!running && pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analyses]);

  // ── Tạo phân tích mới ────────────────────────────────────────────────────
  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.url.trim()) return toast.error('Nhập URL website');
    setCreating(true);
    try {
      await apiClient.post(API_URL, form);
      toast.success('Đã bắt đầu phân tích! Quá trình có thể mất vài phút.');
      setShowForm(false);
      setForm({ url: '', companyId: '', maxPages: 100, maxDepth: 3, delayMs: 300 });
      fetchAnalyses();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Lỗi tạo phân tích');
    } finally {
      setCreating(false);
    }
  };

  // ── Xem chi tiết ─────────────────────────────────────────────────────────
  const openAnalysis = async (analysis) => {
    setSelected(analysis);
    setPages([]);
    setKeywords([]);
    setActiveTab('keywords');
    if (analysis.status === 'done') {
      await fetchSelectedData(analysis.id);
    }
  };

  // ── Xóa ─────────────────────────────────────────────────────────────────
  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!confirm('Xóa phân tích này?')) return;
    await apiClient.delete(`${API_URL}/${id}`);
    setAnalyses(prev => prev.filter(a => a.id !== id));
    if (selected?.id === id) setSelected(null);
    toast.success('Đã xóa');
  };

  // ── Filter keywords ──────────────────────────────────────────────────────
  const filteredKeywords = keywords.filter(k => {
    if (filterPriority && k.priority !== filterPriority) return false;
    if (filterIntent   && k.intent   !== filterIntent)   return false;
    return true;
  });

  const clusters = [...new Set(filteredKeywords.map(k => k.cluster).filter(Boolean))];

  // ── Import keyword vào Keyword Planner ──────────────────────────────────
  const importToPlanner = () => {
    const kwList = filteredKeywords.map(k => k.keyword).join('\n');
    navigator.clipboard.writeText(kwList);
    toast.success(`Đã copy ${filteredKeywords.length} từ khóa vào clipboard`);
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '24px',  margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Phân tích Website
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
            Crawl website, phân tích nội dung & gợi ý từ khóa SEO
          </p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', background: 'var(--accent-gradient)', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
        >
          <Plus size={15} /> Phân tích mới
        </button>
      </div>

      {/* Form tạo mới */}
      {showForm && (
        <form onSubmit={handleCreate} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, marginBottom: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>URL Website *</label>
              <input
                type="url"
                value={form.url}
                onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                placeholder="https://example.com"
                required
                style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Công ty (tuỳ chọn)</label>
              <AppSelect
                value={form.companyId}
                onChange={v => setForm(f => ({ ...f, companyId: v }))}
                options={[{ value: '', label: '-- Không chọn --' }, ...companies.map(c => ({ value: c.id, label: c.name }))]}
              />
            </div>
          </div>

          {/* Cài đặt giới hạn */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
            {[
              { key: 'maxPages', label: 'Số trang tối đa', min: 10, max: 500 },
              { key: 'maxDepth', label: 'Độ sâu BFS', min: 1, max: 5 },
              { key: 'delayMs', label: 'Delay (ms)', min: 100, max: 2000 },
            ].map(({ key, label, min, max }) => (
              <div key={key}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                  {label}: <strong style={{ color: 'var(--accent)' }}>{form[key]}</strong>
                </label>
                <input
                  type="range"
                  min={min} max={max}
                  value={form[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: Number(e.target.value) }))}
                  style={{ width: '100%' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)' }}>
                  <span>{min}</span><span>{max}</span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit" disabled={creating} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 20px', background: creating ? 'rgba(99,102,241,0.4)' : 'var(--accent-gradient)', color: '#fff', border: 'none', borderRadius: 9, cursor: creating ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 13 }}>
              {creating ? <><Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> Đang tạo...</> : <><Play size={13} /> Bắt đầu crawl</>}
            </button>
            <button type="button" onClick={() => setShowForm(false)} style={{ padding: '9px 16px', background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 9, cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13 }}>
              Huỷ
            </button>
          </div>
        </form>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '360px 1fr' : '1fr', gap: 20 }}>

        {/* Danh sách phân tích */}
        <div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}><Loader size={20} style={{ animation: 'spin 1s linear infinite' }} /></div>
          ) : analyses.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)', background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 14 }}>
              <Globe size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
              <div>Chưa có phân tích nào</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {analyses.map(a => {
                const S = STATUS_MAP[a.status] || STATUS_MAP.pending;
                const isActive = selected?.id === a.id;
                const isRunning = ['pending', 'crawling', 'analyzing'].includes(a.status);
                return (
                  <div
                    key={a.id}
                    onClick={() => openAnalysis(a)}
                    style={{ padding: '14px 16px', background: isActive ? 'rgba(99,102,241,0.08)' : 'var(--bg-panel)', border: `1px solid ${isActive ? 'rgba(99,102,241,0.4)' : 'var(--border)'}`, borderRadius: 12, cursor: 'pointer', transition: 'all 0.15s' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {a.url}
                        </div>
                        {a.companyName && (
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{a.companyName}</div>
                        )}
                      </div>
                      <button onClick={e => handleDelete(a.id, e)} style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0 }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: S.color }}>
                        <S.icon size={11} style={isRunning ? { animation: 'spin 1s linear infinite' } : {}} />
                        {S.label}
                      </span>
                      {a.totalPages > 0 && (
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{a.totalPages} trang</span>
                      )}
                      {a.summary?.suggestedKeywords > 0 && (
                        <span style={{ fontSize: 11, color: '#22c55e' }}>{a.summary.suggestedKeywords} keywords</span>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                      {new Date(a.createdAt).toLocaleString('vi-VN')}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Chi tiết */}
        {selected && (
          <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>

            {/* Header chi tiết */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {selected.url}
                </div>
                {selected.status === 'done' && (
                  <button
                    onClick={() => fetchSelectedData(selected.id)}
                    title="Tải lại dữ liệu"
                    style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                  >
                    <RefreshCw size={14} />
                  </button>
                )}
                <button onClick={() => setSelected(null)} style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
              </div>

              {/* Summary cards */}
              {selected.status === 'done' && selected.summary && (
                <div style={{ display: 'flex', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
                  <SummaryCard label="Trang đã crawl"  value={selected.summary.totalPages || 0} />
                  <SummaryCard label="Từ trung bình"   value={selected.summary.avgWordCount || 0} color="#f59e0b" />
                  <SummaryCard label="Keyword gợi ý"   value={selected.summary.suggestedKeywords || 0} color="#22c55e" />
                </div>
              )}

              {/* Running state + progress log */}
              {['pending', 'crawling', 'analyzing'].includes(selected.status) && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f59e0b', fontSize: 13, marginBottom: 10 }}>
                    <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} />
                    <span style={{ fontWeight: 600 }}>{STATUS_MAP[selected.status]?.label}...</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>tự động cập nhật mỗi 3s</span>
                  </div>
                  {selected.progress_log && (
                    <div style={{
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: 10,
                      padding: '10px 14px',
                      maxHeight: 220,
                      overflowY: 'auto',
                      fontFamily: 'monospace',
                      fontSize: 12,
                      lineHeight: 1.7,
                      color: 'var(--text-secondary)',
                    }}>
                      {selected.progress_log.trim().split('\n').reverse().map((line, i) => {
                        const isError   = line.includes('❌');
                        const isSuccess = line.includes('✅') || line.includes('🎉');
                        const isAI      = line.includes('🤖');
                        const isCrawl   = line.includes('🔍');
                        const color = isError ? '#ef4444' : isSuccess ? '#22c55e' : isAI ? '#a78bfa' : isCrawl ? '#60a5fa' : 'var(--text-secondary)';
                        return (
                          <div key={i} style={{ color, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                            {line}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {!selected.progress_log && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      Đang khởi động...
                    </div>
                  )}
                </div>
              )}
            </div>

            {selected.status === 'done' && (
              <>
                {/* Tabs */}
                <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)' }}>
                  {[
                    { key: 'keywords', label: `Keyword gợi ý (${keywords.length})`, icon: TrendingUp },
                    { key: 'pages',    label: `Trang đã crawl (${pages.length})`,   icon: FileText },
                    { key: 'log',      label: 'Log',                                icon: Search },
                  ].map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      onClick={() => setActiveTab(key)}
                      style={{ flex: 1, padding: '11px 16px', background: 'none', border: 'none', borderBottom: `2px solid ${activeTab === key ? 'var(--accent)' : 'transparent'}`, cursor: 'pointer', color: activeTab === key ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: activeTab === key ? 600 : 400, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
                    >
                      <Icon size={13} /> {label}
                    </button>
                  ))}
                </div>

                {/* Tab: Keywords */}
                {activeTab === 'keywords' && (
                  <div style={{ padding: 16 }}>
                    {/* Filter + Import */}
                    <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                      <AppSelect
                        value={filterPriority}
                        onChange={setFilterPriority}
                        options={[{ value: '', label: 'Tất cả độ ưu tiên' }, { value: 'Cao', label: '🔴 Cao' }, { value: 'Trung bình', label: '🟡 Trung bình' }, { value: 'Thấp', label: '🟢 Thấp' }]}
                      />
                      <AppSelect
                        value={filterIntent}
                        onChange={setFilterIntent}
                        options={[{ value: '', label: 'Tất cả mục đích' }, { value: 'Thông tin', label: 'Thông tin' }, { value: 'Thương mại', label: 'Thương mại' }, { value: 'Giao dịch', label: 'Giao dịch' }, { value: 'Điều hướng', label: 'Điều hướng' }]}
                      />
                      <button
                        onClick={importToPlanner}
                        style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, cursor: 'pointer', color: '#22c55e', fontSize: 12, fontWeight: 600 }}
                      >
                        <Plus size={12} /> Copy {filteredKeywords.length} từ khóa
                      </button>
                    </div>

                    {/* Keyword list nhóm theo cluster */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: 500, overflowY: 'auto' }}>
                      {clusters.map(cluster => {
                        const clusterKws = filteredKeywords.filter(k => k.cluster === cluster);
                        return (
                          <div key={cluster}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>{cluster}</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {clusterKws.map(kw => (
                                <div key={kw.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', background: 'var(--bg-hover)', borderRadius: 9, border: '1px solid var(--border)' }}>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{kw.keyword}</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>{kw.reason}</div>
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                                    <span style={{ fontSize: 10, fontWeight: 700, color: PRIORITY_COLOR[kw.priority] || '#6b7280', padding: '2px 7px', background: `${PRIORITY_COLOR[kw.priority]}18`, borderRadius: 99 }}>
                                      {kw.priority}
                                    </span>
                                    <span style={{ fontSize: 10, fontWeight: 600, color: INTENT_COLOR[kw.intent] || '#6b7280', padding: '2px 7px', background: `${INTENT_COLOR[kw.intent]}18`, borderRadius: 99 }}>
                                      {kw.intent}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                      {/* Keywords không có cluster */}
                      {filteredKeywords.filter(k => !k.cluster).map(kw => (
                        <div key={kw.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', background: 'var(--bg-hover)', borderRadius: 9, border: '1px solid var(--border)' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{kw.keyword}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>{kw.reason}</div>
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 700, color: PRIORITY_COLOR[kw.priority], padding: '2px 7px', background: `${PRIORITY_COLOR[kw.priority]}18`, borderRadius: 99 }}>
                            {kw.priority}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tab: Pages */}
                {activeTab === 'pages' && (
                  <div style={{ padding: 16, maxHeight: 560, overflowY: 'auto' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {pages.map(p => (
                        <div key={p.id} style={{ padding: '10px 12px', background: 'var(--bg-hover)', borderRadius: 9, border: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <a href={p.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 12, color: 'var(--accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, textDecoration: 'none' }}>
                              {p.url}
                            </a>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>
                              depth {p.depth} · {p.wordCount} từ
                            </span>
                          </div>
                          {p.title && <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginTop: 4 }}>{p.title}</div>}
                          {p.h1    && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>H1: {p.h1}</div>}
                          {p.h2s?.length > 0 && (
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
                              H2: {p.h2s.slice(0, 3).join(' · ')}{p.h2s.length > 3 ? ` +${p.h2s.length - 3}` : ''}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tab: Log */}
                {activeTab === 'log' && (
                  <div style={{ padding: 16 }}>
                    {selected.progress_log ? (
                      <div style={{
                        background: 'var(--bg-panel)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: 10,
                        padding: '12px 16px',
                        maxHeight: 500,
                        overflowY: 'auto',
                        fontFamily: 'monospace',
                        fontSize: 12,
                        lineHeight: 1.8,
                      }}>
                        {selected.progress_log.trim().split('\n').reverse().map((line, i) => {
                          const isError   = line.includes('❌');
                          const isSuccess = line.includes('✅') || line.includes('🎉');
                          const isAI      = line.includes('🤖');
                          const isCrawl   = line.includes('🔍');
                          const isSave    = line.includes('💾');
                          const color = isError ? '#ef4444' : isSuccess ? '#22c55e' : isAI ? '#a78bfa' : isCrawl ? '#60a5fa' : isSave ? '#f59e0b' : 'var(--text-secondary)';
                          return (
                            <div key={i} style={{ color, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                              {line}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>
                        Không có log
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {selected.status === 'error' && (
              <div style={{ padding: 24 }}>
                <div style={{ textAlign: 'center', color: '#ef4444', marginBottom: 16 }}>
                  <AlertCircle size={24} style={{ marginBottom: 8 }} />
                  <div style={{ fontWeight: 600 }}>{selected.summary?.error || 'Đã xảy ra lỗi khi phân tích'}</div>
                </div>
                {selected.progress_log && (
                  <div style={{
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(239,68,68,0.2)',
                    borderRadius: 10,
                    padding: '12px 16px',
                    maxHeight: 300,
                    overflowY: 'auto',
                    fontFamily: 'monospace',
                    fontSize: 12,
                    lineHeight: 1.8,
                  }}>
                    {selected.progress_log.trim().split('\n').map((line, i) => {
                      const isError = line.includes('❌');
                      return (
                        <div key={i} style={{ color: isError ? '#ef4444' : 'var(--text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                          {line}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
