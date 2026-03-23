import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, RefreshCw, ChevronDown, ChevronRight, FileText, BarChart2, Download, Search, Brain, CheckCircle2, Clock, AlertCircle, Circle, Star, Copy, X, Edit2, Check } from 'lucide-react';
import { toast } from 'sonner';

import { API } from '../config/api';
// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  draft:     { label: 'Draft',     color: '#6b7280', bg: 'rgba(107,114,128,0.12)', icon: Circle },
  created:   { label: 'Đã tạo',   color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  icon: FileText },
  scheduled: { label: 'Đã lên lịch', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', icon: Clock },
  published: { label: 'Published', color: '#22c55e', bg: 'rgba(34,197,94,0.12)',   icon: CheckCircle2 },
  error:     { label: 'Lỗi',       color: '#ef4444', bg: 'rgba(239,68,68,0.12)',    icon: AlertCircle },
};

const PLAN_STATUS = {
  draft:      { label: 'Draft',     color: '#6b7280' },
  analyzed:   { label: 'Đã phân tích', color: '#8b5cf6' },
  publishing: { label: 'Đang đăng', color: '#f59e0b' },
  done:       { label: 'Hoàn thành', color: '#22c55e' },
};

const INTENT_COLOR = {
  Informational: '#3b82f6',
  Commercial:    '#8b5cf6',
  Navigational:  '#06b6d4',
  Transactional: '#f59e0b',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const apiFetch = async (url, opts = {}) => {
  const token = localStorage.getItem('token');
  const res = await fetch(API.keywordPlansl, {
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
};

const Badge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  const Icon = cfg.icon;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600,
      color: cfg.color, background: cfg.bg,
    }}>
      <Icon size={10} /> {cfg.label}
    </span>
  );
};

const IntentBadge = ({ intent }) => intent ? (
  <span style={{
    padding: '1px 7px', borderRadius: 10, fontSize: 10, fontWeight: 600,
    color: INTENT_COLOR[intent] || '#6b7280',
    background: (INTENT_COLOR[intent] || '#6b7280') + '20',
  }}>{intent}</span>
) : null;

const PlanStatusBadge = ({ status }) => {
  const cfg = PLAN_STATUS[status] || PLAN_STATUS.draft;
  return (
    <span style={{
      padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600,
      color: cfg.color, background: cfg.color + '18',
    }}>{cfg.label}</span>
  );
};

// ─── Modal Tạo Plan ───────────────────────────────────────────────────────────
function CreatePlanModal({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [keywordsText, setKeywordsText] = useState('');
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState([]);

  useEffect(() => {
    apiFetch(API.companies)
      .then(data => setCompanies(Array.isArray(data) ? data : (data.data || [])))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const keywords = keywordsText.split('\n').map(k => k.trim()).filter(Boolean);
    if (!name.trim()) return toast.error('Vui lòng nhập tên plan');
    if (keywords.length === 0) return toast.error('Vui lòng nhập ít nhất 1 keyword');
    if (keywords.length > 200) return toast.warning('Khuyến nghị tối đa 200 keyword mỗi plan');
    setLoading(true);
    try {
      const plan = await apiFetch(API, {
        method: 'POST',
        body: JSON.stringify({ name, description, companyId: companyId || null, keywords }),
      });
      toast.success('Tạo plan thành công!');
      onCreated(plan);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--bg-panel)', borderRadius: 12, padding: 28, width: '100%', maxWidth: 560, border: '1px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>+ Tạo Keyword Plan</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>Tên Plan *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="VD: SEO On-page 2026 Q1"
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>Công ty / Website</label>
            <select value={companyId} onChange={e => setCompanyId(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-primary)', fontSize: 13 }}>
              <option value="">-- Chọn công ty (tuỳ chọn) --</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>
              Danh sách Keyword * <span style={{ fontWeight: 400 }}>(mỗi keyword 1 dòng, 20-200 từ)</span>
            </label>
            <textarea value={keywordsText} onChange={e => setKeywordsText(e.target.value)}
              placeholder={'seo là gì\ncách tối ưu seo on-page\nkiểm tra seo website\n...'}
              rows={8}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-primary)', fontSize: 13, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'monospace' }} />
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
              {keywordsText.split('\n').filter(k => k.trim()).length} keyword đã nhập
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
            <button type="button" onClick={onClose} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13 }}>Hủy</button>
            <button type="submit" disabled={loading} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Đang tạo...' : 'Tạo Plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Cluster Accordion ────────────────────────────────────────────────────────
function ClusterAccordion({ clusterName, items, onEditItem, onCreateArticle, creating }) {
  const [open, setOpen] = useState(true);
  const pillar = items.find(i => i.item_type === 'pillar');
  const clusters = items.filter(i => i.item_type !== 'pillar');
  const published = items.filter(i => i.status === 'published').length;

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 10 }}>
      <div onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'var(--bg-panel)', cursor: 'pointer', userSelect: 'none' }}>
        {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', flex: 1 }}>📁 {clusterName || 'Chưa phân nhóm'}</span>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{published}/{items.length} bài</span>
        <div style={{ width: 60, height: 4, borderRadius: 4, background: 'var(--border)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${items.length ? (published / items.length) * 100 : 0}%`, background: '#22c55e', borderRadius: 4 }} />
        </div>
      </div>
      {open && (
        <div>
          {pillar && (
            <KeywordItem item={pillar} isPillar onEdit={onEditItem} onCreateArticle={onCreateArticle} creating={creating} />
          )}
          {clusters.map(item => (
            <KeywordItem key={item.id} item={item} onEdit={onEditItem} onCreateArticle={onCreateArticle} creating={creating} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Keyword Item Row ─────────────────────────────────────────────────────────
function KeywordItem({ item, isPillar, onEdit, onCreateArticle, creating }) {
  const [editingIntent, setEditingIntent] = useState(false);
  const intents = ['Informational', 'Commercial', 'Navigational', 'Transactional'];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', borderTop: '1px solid var(--border)', background: isPillar ? 'rgba(139,92,246,0.04)' : 'transparent', flexWrap: 'wrap' }}>
      {isPillar ? <Star size={13} color="#8b5cf6" /> : <span style={{ width: 13, display: 'inline-block' }} />}
      <span style={{ flex: 1, minWidth: 180, fontSize: 13, color: 'var(--text-primary)', fontWeight: isPillar ? 600 : 400 }}>
        {item.keyword}
      </span>
      {isPillar && <span style={{ fontSize: 10, color: '#8b5cf6', fontWeight: 700, border: '1px solid #8b5cf680', borderRadius: 10, padding: '1px 7px' }}>PILLAR</span>}
      {editingIntent ? (
        <select autoFocus defaultValue={item.search_intent}
          onBlur={e => { setEditingIntent(false); onEdit(item.id, { search_intent: e.target.value }); }}
          onChange={e => { setEditingIntent(false); onEdit(item.id, { search_intent: e.target.value }); }}
          style={{ fontSize: 11, border: '1px solid var(--border)', borderRadius: 6, padding: '2px 6px', background: 'var(--bg-panel)', color: 'var(--text-primary)' }}>
          {intents.map(i => <option key={i} value={i}>{i}</option>)}
        </select>
      ) : (
        <span onClick={() => setEditingIntent(true)} style={{ cursor: 'pointer' }}>
          <IntentBadge intent={item.search_intent} />
        </span>
      )}
      {item.content_angle && (
        <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontStyle: 'italic' }}>{item.content_angle}</span>
      )}
      <Badge status={item.status} />
      {item.status === 'draft' ? (
        <button onClick={() => onCreateArticle(item)} disabled={creating === item.id}
          style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid var(--accent)', background: 'transparent', color: 'var(--accent)', cursor: 'pointer', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
          {creating === item.id ? '...' : '+ Tạo bài'}
        </button>
      ) : item.articleId ? (
        <span style={{ fontSize: 11, color: '#22c55e' }}>✓ Đã tạo</span>
      ) : null}
    </div>
  );
}

// ─── Progress Panel ───────────────────────────────────────────────────────────
function ProgressPanel({ planId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch(`${API}/${planId}/progress`).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [planId]);

  if (loading) return <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-secondary)' }}>Đang tải...</div>;
  if (!data) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 4 }}>
      {/* Progress bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
          <span>Tổng tiến độ</span>
          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{data.progress}%</span>
        </div>
        <div style={{ height: 8, background: 'var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${data.progress}%`, background: 'linear-gradient(90deg, #6366f1, #22c55e)', borderRadius: 8, transition: 'width 0.5s' }} />
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 10 }}>
        {Object.entries(data.byStatus).filter(([, v]) => v > 0).map(([status, count]) => {
          const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
          return (
            <div key={status} style={{ padding: '10px 12px', borderRadius: 8, background: cfg.bg, border: `1px solid ${cfg.color}30`, textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: cfg.color }}>{count}</div>
              <div style={{ fontSize: 11, color: cfg.color, marginTop: 2 }}>{cfg.label}</div>
            </div>
          );
        })}
      </div>

      {/* By cluster */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Theo Cluster</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {Object.entries(data.byCluster).map(([name, info]) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 12, color: 'var(--text-primary)', minWidth: 150, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', minWidth: 50 }}>{info.created}/{info.total}</span>
              <div style={{ flex: 1, height: 4, background: 'var(--border)', borderRadius: 4, minWidth: 80, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${info.total ? (info.created / info.total) * 100 : 0}%`, background: '#6366f1', borderRadius: 4 }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* By intent */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Theo Search Intent</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {Object.entries(data.byIntent).filter(([k, v]) => k && v > 0).map(([intent, count]) => (
            <div key={intent} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, background: (INTENT_COLOR[intent] || '#6b7280') + '15' }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: INTENT_COLOR[intent] || '#6b7280' }}>{count}</span>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{intent}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Plan Detail View ─────────────────────────────────────────────────────────
function PlanDetail({ planId, companies, onBack }) {
  const [plan, setPlan] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [creating, setCreating] = useState(null); // itemId đang tạo bài
  const [activeTab, setActiveTab] = useState('clusters'); // clusters | progress
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCluster, setFilterCluster] = useState('all');

  const load = useCallback(async () => {
    try {
      const data = await apiFetch(`${API}/${planId}`);
      setPlan(data);
      setItems(data.items || []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => { load(); }, [load]);

  const handleAnalyze = async () => {
    if (!window.confirm('Chạy AI phân tích sẽ xóa kết quả cũ. Tiếp tục?')) return;
    setAnalyzing(true);
    try {
      const data = await apiFetch(`${API}/${planId}/analyze`, { method: 'POST' });
      setPlan(data);
      setItems(data.items || []);
      toast.success(`Phân tích xong! ${data.clusters_count} clusters`);
    } catch (err) {
      toast.error('Phân tích thất bại: ' + err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleEditItem = async (itemId, changes) => {
    try {
      const updated = await apiFetch(`${API}/${planId}/items/${itemId}`, { method: 'PUT', body: JSON.stringify(changes) });
      setItems(prev => prev.map(i => i.id === itemId ? { ...i, ...updated } : i));
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleCreateArticle = async (item) => {
    if (!plan.companyId) return toast.error('Plan chưa chọn công ty. Vui lòng cập nhật plan.');
    setCreating(item.id);
    try {
      const result = await apiFetch(`${API}/${planId}/items/${item.id}/create-article`, {
        method: 'POST',
        body: JSON.stringify({ companyId: plan.companyId, title: item.keyword }),
      });
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'created', articleId: result.article?.id } : i));
      toast.success(`Đã tạo bài: ${item.keyword}`);
    } catch (err) {
      toast.error('Tạo bài thất bại: ' + err.message);
    } finally {
      setCreating(null);
    }
  };

  const handleExport = (format) => {
    const token = localStorage.getItem('token');
    const url = `${API}/${planId}/export?format=${format}`;
    window.open(url + (token ? `&token=${token}` : ''), '_blank');
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>Đang tải...</div>;
  if (!plan) return null;

  // Group items by cluster
  const clusters = {};
  const filteredItems = items.filter(item => {
    if (filterStatus !== 'all' && item.status !== filterStatus) return false;
    if (filterCluster !== 'all' && item.cluster_name !== filterCluster) return false;
    return true;
  });
  for (const item of filteredItems) {
    const key = item.cluster_name || 'Chưa phân nhóm';
    if (!clusters[key]) clusters[key] = [];
    clusters[key].push(item);
  }
  const clusterNames = [...new Set(items.map(i => i.cluster_name || 'Chưa phân nhóm'))];

  const totalItems = items.length;
  const createdItems = items.filter(i => i.status !== 'draft').length;
  const publishedItems = items.filter(i => i.status === 'published').length;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13, padding: 0, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          ← Danh sách Plans
        </button>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>{plan.name}</h1>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <PlanStatusBadge status={plan.status} />
              {plan.companyName && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>🏢 {plan.companyName}</span>}
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>📝 {totalItems} items · {createdItems} đã tạo · {publishedItems} published</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={handleAnalyze} disabled={analyzing}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid #8b5cf6', background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
              <Brain size={14} /> {analyzing ? 'Đang phân tích...' : 'AI Phân tích'}
            </button>
            <button onClick={() => handleExport('csv')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-panel)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12 }}>
              <Download size={13} /> CSV
            </button>
            <button onClick={() => handleExport('json')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-panel)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12 }}>
              <Download size={13} /> JSON
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {[{ id: 'clusters', label: '📁 Clusters' }, { id: 'progress', label: '📊 Tiến độ' }].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{ padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: activeTab === tab.id ? 700 : 400,
              color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-secondary)',
              borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent', marginBottom: -1, transition: 'all 0.15s' }}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'clusters' && (
        <>
          {/* Filters */}
          {items.length > 0 && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-panel)', color: 'var(--text-primary)', fontSize: 12 }}>
                <option value="all">Tất cả trạng thái</option>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <select value={filterCluster} onChange={e => setFilterCluster(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-panel)', color: 'var(--text-primary)', fontSize: 12 }}>
                <option value="all">Tất cả clusters</option>
                {clusterNames.map(name => <option key={name} value={name}>{name}</option>)}
              </select>
            </div>
          )}

          {/* Clusters */}
          {items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>
              <Brain size={48} style={{ opacity: 0.2, marginBottom: 12 }} />
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Chưa có kết quả phân tích</div>
              <div style={{ fontSize: 13 }}>Nhấn "AI Phân tích" để nhóm keyword thành clusters</div>
            </div>
          ) : Object.keys(clusters).length === 0 ? (
            <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-secondary)' }}>Không có keyword nào khớp với bộ lọc</div>
          ) : (
            Object.entries(clusters).map(([clusterName, clusterItems]) => (
              <ClusterAccordion key={clusterName} clusterName={clusterName} items={clusterItems}
                onEditItem={handleEditItem} onCreateArticle={handleCreateArticle} creating={creating} />
            ))
          )}
        </>
      )}

      {activeTab === 'progress' && <ProgressPanel planId={planId} />}
    </div>
  );
}

// ─── Plans List ───────────────────────────────────────────────────────────────
function PlansList({ onSelect, refreshKey }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch(API);
      setPlans(Array.isArray(data) ? data : data.data || []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  const handleDelete = async (plan, e) => {
    e.stopPropagation();
    if (!window.confirm(`Xóa plan "${plan.name}"? (Bài viết đã tạo sẽ không bị xóa)`)) return;
    try {
      await apiFetch(`${API}/${plan.id}`, { method: 'DELETE' });
      toast.success('Đã xóa plan');
      setPlans(prev => prev.filter(p => p.id !== plan.id));
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDuplicate = async (plan, e) => {
    e.stopPropagation();
    try {
      const newPlan = await apiFetch(`${API}/${plan.id}/duplicate`, { method: 'POST' });
      toast.success('Đã nhân bản plan');
      setPlans(prev => [newPlan, ...prev]);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const filtered = plans.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>Đang tải plans...</div>;

  return (
    <div>
      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm plan..."
          style={{ width: '100%', padding: '8px 12px 8px 36px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-panel)', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' }} />
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>📋</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{search ? 'Không tìm thấy plan' : 'Chưa có Keyword Plan nào'}</div>
          <div style={{ fontSize: 13 }}>Nhấn "+ Tạo kế hoạch" để bắt đầu</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(plan => {
            const total = plan.totalItems || 0;
            const created = plan.createdItems || 0;
            const published = plan.publishedItems || 0;
            const progress = total > 0 ? Math.round((created / total) * 100) : 0;
            let keywords = [];
            try { keywords = JSON.parse(plan.keywords); } catch {}

            return (
              <div key={plan.id} onClick={() => onSelect(plan.id)}
                style={{ padding: '14px 18px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-panel)', cursor: 'pointer', transition: 'all 0.15s', position: 'relative' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{plan.name}</span>
                      <PlanStatusBadge status={plan.status} />
                    </div>
                    <div style={{ display: 'flex', gap: 14, fontSize: 12, color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                      <span>📝 {keywords.length} keyword</span>
                      {plan.companyName && <span>🏢 {plan.companyName}</span>}
                      {total > 0 && <span>📄 {created}/{total} bài · {published} published</span>}
                      <span>🗓️ {new Date(plan.createdAt).toLocaleDateString('vi-VN')}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                    <button onClick={e => handleDuplicate(plan, e)} title="Nhân bản"
                      style={{ padding: '5px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}>
                      <Copy size={13} />
                    </button>
                    <button onClick={e => handleDelete(plan, e)} title="Xóa plan"
                      style={{ padding: '5px', borderRadius: 6, border: '1px solid transparent', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}
                      onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                {total > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ height: 4, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, #6366f1, #22c55e)', borderRadius: 4 }} />
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 3, textAlign: 'right' }}>{progress}%</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function KeywordPlanner() {
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    apiFetch('/api/companies?limit=500')
      .then(data => {
        const list = Array.isArray(data) ? data : (data.data || []);
        setCompanies(list);
      })
      .catch(err => {
        console.error('[KeywordPlanner] load companies:', err.message);
      });
  }, []);

  const handleCreated = (plan) => {
    setShowCreate(false);
    setRefreshKey(k => k + 1);
    setSelectedPlanId(plan.id);
  };

  return (
    <div style={{ margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>
            📋 Keyword Planner
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
            Lập kế hoạch nội dung SEO · AI phân tích & clustering · Theo dõi tiến độ
          </p>
        </div>
        {!selectedPlanId && (
          <button onClick={() => setShowCreate(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 9, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
            <Plus size={15} /> Tạo kế hoạch
          </button>
        )}
      </div>

      {/* Content */}
      <div style={{ background: 'var(--bg-panel)', borderRadius: 12, border: '1px solid var(--border)', padding: 24 }}>
        {selectedPlanId ? (
          <PlanDetail planId={selectedPlanId} companies={companies} onBack={() => setSelectedPlanId(null)} />
        ) : (
          <PlansList onSelect={setSelectedPlanId} refreshKey={refreshKey} />
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <CreatePlanModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />
      )}
    </div>
  );
}
