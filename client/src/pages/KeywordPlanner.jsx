import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight, FileText, Download, Search, Brain, CheckCircle2, Clock, AlertCircle, Circle, Star, Copy, X, Loader, ExternalLink, Hash, Check } from 'lucide-react';
import { toast } from 'sonner';

import { API } from '../config/api';
import { AppSelect } from '../components/AppSelect';
// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  draft:     { label: 'Chờ xử lý',       color: '#6b7280', bg: 'rgba(107,114,128,0.12)', icon: Circle },
  in_queue:  { label: 'Đang xử lý', color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)',  icon: Loader },
  created:   { label: 'Đã tạo',     color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  icon: FileText },
  scheduled: { label: 'Đã lên lịch', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', icon: Clock },
  published: { label: 'Published',   color: '#22c55e', bg: 'rgba(34,197,94,0.12)',   icon: CheckCircle2 },
  error:     { label: 'Lỗi',         color: '#ef4444', bg: 'rgba(239,68,68,0.12)',    icon: AlertCircle },
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

const INTENT_VN = {
  Informational: 'Thông tin',
  Commercial:    'Thương mại',
  Navigational:  'Điều hướng',
  Transactional: 'Giao dịch',
};

const ANGLE_CONFIG = {
  'Hướng dẫn':  { color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  'Danh sách':  { color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  'So sánh':    { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  'Review':     { color: '#06b6d4', bg: 'rgba(6,182,212,0.12)' },
  'Case Study': { color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
  'Hỏi đáp':   { color: '#ec4899', bg: 'rgba(236,72,153,0.12)' },
  'Định nghĩa': { color: '#6366f1', bg: 'rgba(99,102,241,0.12)' },
  'Tin tức':    { color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  'How-to Guide': { color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  'Listicle':   { color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  'Comparison': { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  'FAQ':        { color: '#ec4899', bg: 'rgba(236,72,153,0.12)' },
  'Guide 101':  { color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
};

const daysSince = (dateStr) => {
  if (!dateStr) return null;
  const d = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  return d > 0 ? `${d}d` : 'hôm nay';
};

const fmtWords = (n) => n > 0 ? `~${n.toLocaleString('vi-VN')} từ` : null;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const apiFetch = async (url, opts = {}) => {
  const token = localStorage.getItem('autoseo_token');
  const res = await fetch(url, {
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
    whiteSpace: 'nowrap',
  }}>{INTENT_VN[intent] || intent}</span>
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

const AngleBadge = ({ angle }) => {
  if (!angle) return null;
  const cfg = ANGLE_CONFIG[angle] || { color: '#6b7280', bg: 'rgba(107,114,128,0.12)' };
  return (
    <span style={{ padding: '1px 7px', borderRadius: 10, fontSize: 10, fontWeight: 600, color: cfg.color, background: cfg.bg, whiteSpace: 'nowrap' }}>
      {angle}
    </span>
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
      const plan = await apiFetch(API.keywordPlans, {
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
function ClusterAccordion({ clusterIdx, clusterName, items, onEditItem, onCreateArticle, onDeleteItem, onRemoveVariant, creating, selectedIds, onToggleSelect }) {
  const [open, setOpen] = useState(true);
  const pillar   = items.find(i => i.item_type === 'pillar');
  const children = items.filter(i => i.item_type !== 'pillar');
  const created  = items.filter(i => i.status !== 'draft').length;

  let variants = [];
  try { variants = pillar?.variants ? JSON.parse(pillar.variants) : []; } catch { variants = []; }

  const pillarIntent = pillar?.search_intent;
  const clusterAngle = pillar?.content_angle;

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 8 }}>
      {/* ── Header ── */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', background: 'var(--bg-panel)', cursor: 'pointer', userSelect: 'none', minHeight: 40 }}
      >
        {/* chevron */}
        <span style={{ flexShrink: 0, color: 'var(--text-muted)', display: 'flex' }}>
          {open ? <ChevronDown size={13}/> : <ChevronRight size={13}/>}
        </span>

        {/* cluster number */}
        <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-subtle)', padding: '2px 7px', borderRadius: 5, lineHeight: 1.4 }}>
          #{clusterIdx + 1}
        </span>

        {/* cluster name + pillar — truncate if too long */}
        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
          <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', lineHeight: 1.4 }}>
            {clusterName || 'Chưa phân nhóm'}
            {pillar && (
              <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--text-muted)', marginLeft: 5 }}>
                (Pillar: {pillar.keyword})
              </span>
            )}
          </span>
        </div>

        {/* badges — right side, no wrap */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
          {pillarIntent && <IntentBadge intent={pillarIntent} />}
          {clusterAngle && <AngleBadge angle={clusterAngle} />}
          <span style={{ fontSize: 11, color: 'var(--text-muted)', paddingLeft: 2 }}>{items.length} kw</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: created > 0 ? '#22c55e' : 'var(--text-secondary)' }}>
            {created}/{items.length}
          </span>
          {/* mini progress bar */}
          <div style={{ width: 36, height: 3, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${items.length ? (created / items.length) * 100 : 0}%`, background: '#22c55e', borderRadius: 3, transition: 'width 0.4s' }} />
          </div>
        </div>
      </div>

      {open && (
        <div>
          {/* ── Biến thể row ── */}
          {variants.length > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap',
              padding: '5px 14px 5px 36px',
              borderTop: '1px solid var(--border)',
              background: 'rgba(99,102,241,0.03)',
            }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.04em', flexShrink: 0 }}>Biến thể:</span>
              {variants.map((v, vi) => (
                <span key={vi} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                  fontSize: 11, color: 'var(--text-secondary)',
                  background: 'var(--bg-main)', border: '1px solid var(--border)',
                  borderRadius: 20, padding: '1px 8px',
                }}>
                  {v}
                  {onRemoveVariant && (
                    <button
                      onClick={e => { e.stopPropagation(); onRemoveVariant(pillar.id, variants.filter((_, i) => i !== vi)); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, color: 'var(--text-muted)', display: 'flex' }}
                    >
                      <X size={9}/>
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}

          {/* ── Items ── */}
          {pillar && (
            <KeywordItem item={pillar} isPillar
              onEdit={onEditItem} onCreateArticle={onCreateArticle} onDeleteItem={onDeleteItem}
              creating={creating} selected={selectedIds.has(pillar.id)} onToggleSelect={onToggleSelect} />
          )}
          {children.map(item => (
            <KeywordItem key={item.id} item={item}
              onEdit={onEditItem} onCreateArticle={onCreateArticle} onDeleteItem={onDeleteItem}
              creating={creating} selected={selectedIds.has(item.id)} onToggleSelect={onToggleSelect} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Keyword Item Row ─────────────────────────────────────────────────────────
function KeywordItem({ item, isPillar, onEdit, onCreateArticle, onDeleteItem, creating, selected, onToggleSelect }) {
  const [editingIntent, setEditingIntent] = useState(false);
  const intents     = ['Informational', 'Commercial', 'Navigational', 'Transactional'];
  const isProcessing = item.status === 'in_queue';
  const age         = daysSince(item.createdAt);
  const wordCount   = fmtWords(item.recommended_word_count);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 7,
      padding: '7px 14px',
      borderTop: `1px solid ${selected ? 'rgba(99,102,241,0.3)' : 'var(--border)'}`,
      background: selected
        ? 'rgba(99,102,241,0.06)'
        : isPillar ? 'rgba(139,92,246,0.04)' : 'var(--bg-page)',
      minHeight: 38,
      transition: 'all 0.12s',
      cursor: 'default',
    }}>
      {/* checkbox */}
      <div
        onClick={e => { e.stopPropagation(); if (!isProcessing) onToggleSelect(item.id); }}
        style={{
          width: 15, height: 15, borderRadius: 4, flexShrink: 0,
          border: `2px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
          background: selected ? 'var(--accent)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: isProcessing ? 'default' : 'pointer',
          transition: 'all 0.12s',
        }}
      >
        {selected && <Check size={9} color="#fff" strokeWidth={3}/>}
      </div>

      {/* star icon for pillar */}
      {isPillar
        ? <Star size={12} color="#8b5cf6" style={{ flexShrink: 0 }}/>
        : <span style={{ width: 12, flexShrink: 0 }}/>
      }

      {/* keyword text — truncates */}
      <span style={{
        flex: 1, minWidth: 0,
        fontSize: 13, color: 'var(--text-primary)',
        fontWeight: isPillar ? 600 : 400,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {item.keyword}
      </span>

      {/* right-side meta + actions — no wrap */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
        {isPillar && (
          <span style={{ fontSize: 9, color: '#8b5cf6', fontWeight: 700, border: '1px solid #8b5cf670', borderRadius: 8, padding: '1px 6px', letterSpacing: '0.05em' }}>PILLAR</span>
        )}
        {age && (
          <span style={{ fontSize: 10, color: 'var(--text-muted)', background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 8, padding: '1px 6px' }}>{age}</span>
        )}

        {/* intent badge — click to edit */}
        {editingIntent ? (
          <select autoFocus defaultValue={item.search_intent}
            onBlur={e  => { setEditingIntent(false); onEdit(item.id, { search_intent: e.target.value }); }}
            onChange={e => { setEditingIntent(false); onEdit(item.id, { search_intent: e.target.value }); }}
            style={{ fontSize: 11, border: '1px solid var(--border)', borderRadius: 6, padding: '1px 5px', background: 'var(--bg-panel)', color: 'var(--text-primary)' }}>
            {intents.map(i => <option key={i} value={i}>{INTENT_VN[i] || i}</option>)}
          </select>
        ) : (
          <span onClick={() => setEditingIntent(true)} title="Click để thay đổi" style={{ cursor: 'pointer' }}>
            <IntentBadge intent={item.search_intent}/>
          </span>
        )}

        {item.content_angle && <AngleBadge angle={item.content_angle}/>}

        {wordCount && (
          <span style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{wordCount}</span>
        )}

        <Badge status={item.status}/>

        {/* Google search link */}
        <a
          href={`https://www.google.com/search?q=${encodeURIComponent(item.keyword)}`}
          target="_blank" rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          title="Tìm trên Google"
          style={{ display: 'flex', alignItems: 'center', padding: '3px 5px', borderRadius: 5, border: '1px solid var(--border)', color: 'var(--text-muted)', textDecoration: 'none', transition: 'all 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#4285f4'; e.currentTarget.style.borderColor = '#4285f480'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
        >
          <ExternalLink size={11}/>
        </a>

        {/* create article button */}
        {item.status === 'draft' && (
          <button onClick={() => onCreateArticle(item)} disabled={creating === item.id}
            style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid var(--accent)', background: 'transparent', color: 'var(--accent)', cursor: 'pointer', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
            {creating === item.id ? '...' : '+ Tạo bài'}
          </button>
        )}
        {item.status === 'in_queue' && (
          <span style={{ fontSize: 11, color: '#8b5cf6' }}>⏳</span>
        )}
        {item.articleId && item.status === 'created' && (
          <span style={{ fontSize: 11, color: '#22c55e' }}>✓</span>
        )}

        {/* delete */}
        <button onClick={() => onDeleteItem(item.id)} title="Xóa"
          style={{ display: 'flex', padding: '3px', borderRadius: 4, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', opacity: 0.4, transition: 'all 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.opacity = '1'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.opacity = '0.4'; }}>
          <Trash2 size={12}/>
        </button>
      </div>
    </div>
  );
}

// ─── Progress Panel ───────────────────────────────────────────────────────────
function ProgressPanel({ planId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch(`${API.keywordPlans}/${planId}/progress`).then(setData).catch(() => {}).finally(() => setLoading(false));
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
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [batchCreating, setBatchCreating] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleHours, setScheduleHours] = useState(24);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch(`${API.keywordPlans}/${planId}`);
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
      const data = await apiFetch(`${API.keywordPlans}/${planId}/analyze`, { method: 'POST' });
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
      const updated = await apiFetch(`${API.keywordPlans}/${planId}/items/${itemId}`, { method: 'PUT', body: JSON.stringify(changes) });
      setItems(prev => prev.map(i => i.id === itemId ? { ...i, ...updated } : i));
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleRemoveVariant = async (itemId, newVariants) => {
    try {
      const updated = await apiFetch(`${API.keywordPlans}/${planId}/items/${itemId}`, { method: 'PUT', body: JSON.stringify({ variants: newVariants }) });
      setItems(prev => prev.map(i => i.id === itemId ? { ...i, ...updated } : i));
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (!window.confirm('Xóa keyword này khỏi plan?')) return;
    try {
      await apiFetch(`${API.keywordPlans}/${planId}/items/${itemId}`, { method: 'DELETE' });
      setItems(prev => prev.filter(i => i.id !== itemId));
      setSelectedIds(prev => { const n = new Set(prev); n.delete(itemId); return n; });
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleCreateArticle = async (item) => {
    if (!plan.companyId) return toast.error('Plan chưa chọn công ty. Vui lòng cập nhật plan.');
    setCreating(item.id);
    try {
      const result = await apiFetch(`${API.keywordPlans}/${planId}/items/${item.id}/create-article`, {
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
    const token = localStorage.getItem('autoseo_token');
    const url = `${API.keywordPlans}/${planId}/export?format=${format}`;
    window.open(url + (token ? `&token=${token}` : ''), '_blank');
  };

  const handleToggleSelect = (itemId) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(itemId) ? next.delete(itemId) : next.add(itemId);
      return next;
    });
  };

  const handleSelectAllDraft = () => {
    const draftIds = items.filter(i => i.status === 'draft').map(i => i.id);
    setSelectedIds(new Set(draftIds));
  };

  const handleBatchCreate = async () => {
    if (selectedIds.size === 0) return toast.error('Chưa chọn keyword nào');
    if (!plan.companyId) return toast.error('Plan chưa chọn công ty');
    if (!window.confirm(`Tạo bài cho ${selectedIds.size} keyword đã chọn?`)) return;
    setBatchCreating(true);
    try {
      const result = await apiFetch(`${API.keywordPlans}/${planId}/batch-create`, {
        method: 'POST',
        body: JSON.stringify({ itemIds: [...selectedIds] }),
      });
      toast.success(`Đã thêm ${result.queued} keyword vào hàng đợi. Bài sẽ được tạo lần lượt trong nền.`);
      setSelectedIds(new Set());
      await load();
    } catch (err) {
      toast.error('Batch tạo thất bại: ' + err.message);
    } finally {
      setBatchCreating(false);
    }
  };

  const handleSchedule = async () => {
    if (selectedIds.size === 0) return toast.error('Chưa chọn keyword nào');
    setBatchCreating(true);
    try {
      const result = await apiFetch(`${API.keywordPlans}/${planId}/schedule`, {
        method: 'POST',
        body: JSON.stringify({ itemIds: [...selectedIds], interval_hours: scheduleHours }),
      });
      toast.success(`Đã lên lịch ${result.total} keyword (cách nhau ${scheduleHours}h)`);
      setSelectedIds(new Set());
      setShowSchedule(false);
      await load();
    } catch (err) {
      toast.error('Lên lịch thất bại: ' + err.message);
    } finally {
      setBatchCreating(false);
    }
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
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Tổng: <strong style={{ color: 'var(--text-primary)' }}>{totalItems}</strong> keywords · Đã tạo: <strong style={{ color: '#3b82f6' }}>{createdItems}</strong> · Đã publish: <strong style={{ color: '#22c55e' }}>{publishedItems}</strong></span>
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
        {[{ id: 'clusters', label: `📋 Cấu trúc ${totalItems}` }, { id: 'progress', label: `📄 Bài viết ${createdItems}/${totalItems}` }].map(tab => (
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
          {/* ── Toolbar: filters + bulk actions ── */}
          {items.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>

              {/* Filters */}
              <AppSelect
                size="sm"
                value={filterStatus}
                onChange={setFilterStatus}
                options={[
                  { value: 'all', label: 'Tất cả trạng thái' },
                  ...Object.entries(STATUS_CONFIG).map(([k, v]) => ({ value: k, label: v.label })),
                ]}
              />
              <AppSelect
                size="sm"
                value={filterCluster}
                onChange={setFilterCluster}
                options={[
                  { value: 'all', label: 'Tất cả clusters' },
                  ...clusterNames.map(n => ({ value: n, label: n })),
                ]}
                style={{ maxWidth: 200 }}
              />
              <button onClick={handleSelectAllDraft}
                style={{ padding: '5px 12px', height: 32, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap' }}>
                Chọn tất cả
              </button>

              {/* Bulk action bar — hiện khi có chọn */}
              {selectedIds.size > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'var(--accent-subtle)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700 }}>{selectedIds.size} đã chọn</span>
                  <div style={{ width: 1, height: 16, background: 'rgba(99,102,241,0.3)' }}/>
                  <button onClick={handleBatchCreate} disabled={batchCreating}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600, opacity: batchCreating ? 0.7 : 1, whiteSpace: 'nowrap' }}>
                    <FileText size={12}/> {batchCreating ? 'Đang tạo...' : 'Tạo bài'}
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    {showSchedule && (
                      <>
                        <AppSelect
                          size="sm"
                          value={String(scheduleHours)}
                          onChange={v => setScheduleHours(Number(v))}
                          options={[
                            { value: '0', label: 'Ngay lập tức' },
                            { value: '24', label: 'Hàng ngày' },
                            { value: '48', label: 'Mỗi 2 ngày' },
                            { value: '168', label: 'Hàng tuần' },
                            { value: '-1', label: 'Tùy chỉnh...' },
                          ]}
                        />
                        {scheduleHours === -1 && (
                          <input type="number" min={1} max={720} placeholder="giờ"
                            onChange={e => setScheduleHours(Number(e.target.value))}
                            style={{ width: 55, padding: '3px 7px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-primary)', fontSize: 11 }} />
                        )}
                        <button onClick={handleSchedule} disabled={batchCreating}
                          style={{ padding: '3px 10px', borderRadius: 6, border: 'none', background: '#f59e0b', color: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                          Xác nhận
                        </button>
                        <button onClick={() => setShowSchedule(false)}
                          style={{ display: 'flex', padding: '3px', borderRadius: 5, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                          <X size={12}/>
                        </button>
                      </>
                    )}
                    {!showSchedule && (
                      <button onClick={() => setShowSchedule(true)}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 6, border: '1px solid #f59e0b', background: 'rgba(245,158,11,0.1)', color: '#f59e0b', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                        <Clock size={12}/> Lên lịch
                      </button>
                    )}
                  </div>
                  <button onClick={() => setSelectedIds(new Set())}
                    style={{ display: 'flex', padding: '3px', borderRadius: 5, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
                    title="Bỏ chọn">
                    <X size={13}/>
                  </button>
                </div>
              )}
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
            Object.entries(clusters).map(([clusterName, clusterItems], idx) => (
              <ClusterAccordion key={clusterName} clusterIdx={idx} clusterName={clusterName} items={clusterItems}
                onEditItem={handleEditItem} onCreateArticle={handleCreateArticle} onDeleteItem={handleDeleteItem}
                onRemoveVariant={handleRemoveVariant} creating={creating}
                selectedIds={selectedIds} onToggleSelect={handleToggleSelect} />
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
      const data = await apiFetch(API.keywordPlans);
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
      await apiFetch(`${API.keywordPlans}/${plan.id}`, { method: 'DELETE' });
      toast.success('Đã xóa plan');
      setPlans(prev => prev.filter(p => p.id !== plan.id));
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDuplicate = async (plan, e) => {
    e.stopPropagation();
    try {
      const newPlan = await apiFetch(`${API.keywordPlans}/${plan.id}/duplicate`, { method: 'POST' });
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
    apiFetch(API.companies)
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
