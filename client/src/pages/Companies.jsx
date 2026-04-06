import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import apiClient from '../config/api';
import { Plus, Trash2, Building2, Globe, Pencil, X, Save, User, Upload, Palette, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import { AppMultiSelect } from '../components/AppMultiSelect';
import { FontPicker } from '../components/FontPicker';
import { RichTextEditor } from '../components/RichTextEditor';
import { API } from '../config/api';
const API_URL = API.companies;

/** Strip HTML tags — dùng cho hiển thị plain text trong danh sách */
const stripHtml = (html) => {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim();
};

const INDUSTRY_OPTIONS = [
  { value: 4,  label: 'Xây dựng' },
  { value: 5,  label: 'Studio' },
  { value: 6,  label: 'Nông nghiệp' },
  { value: 7,  label: 'Vận tải' },
  { value: 8,  label: 'Nhà hàng' },
  { value: 9,  label: 'Y tế - Y khoa' },
  { value: 10, label: 'Gia dụng' },
  { value: 11, label: 'Tổ chức sự kiện' },
  { value: 12, label: 'Thể thao' },
  { value: 13, label: 'Bánh - Trà Sữa Thức Uống' },
  { value: 14, label: 'Nội Ngoại Thất' },
  { value: 15, label: 'Thực Phẩm' },
  { value: 16, label: 'Mỹ phẩm' },
  { value: 17, label: 'Landing Page' },
  { value: 18, label: 'Ô tô - Xe máy' },
  { value: 19, label: 'Khách sạn' },
  { value: 20, label: 'Du lịch' },
  { value: 21, label: 'Bất động sản' },
  { value: 22, label: 'Doanh nghiệp' },
  { value: 23, label: 'Bán hàng' },
  { value: 24, label: 'NASANI' },
  { value: 25, label: 'Spa - Làm đẹp' },
  { value: 26, label: 'Giáo dục' },
  { value: 27, label: 'Đào tạo' },
  { value: 28, label: 'Nghệ thuật' },
  { value: 29, label: 'Khác' },
  { value: 30, label: 'Công nghiệp' },
  { value: 31, label: 'Máy móc - Thiết bị' },
  { value: 32, label: 'Dược phẩm' },
  { value: 33, label: 'Thuốc' },
];

const DEFAULT_STYLES = { fontFamily: '', fontSize: '', lineHeight: '', color: '', accentColor: '', h2FontSize: '', h2Color: '', h3FontSize: '', h3Color: '', h4FontSize: '', h4Color: '' };

/* ── Copyable ID cell ── */
function IdCell({ id }) {
  const [copied, setCopied] = React.useState(false);
  const copy = () => {
    navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis'}}>{id}</span>
      <button onClick={copy} title="Copy ID" style={{ background: 'none', border: 'none', padding: '2px', cursor: 'pointer', color: copied ? 'var(--success)' : 'var(--text-primary)', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        {copied ? <Check size={11} /> : <Copy size={11} />}
      </button>
    </div>
  );
}

const Companies = () => {
  const { user: currentUser, authEnabled, canManageUsers } = useAuth();
  const confirm = useConfirm();
  const showMultiUser = authEnabled && canManageUsers;

  const [companies, setCompanies] = useState([]);
  const [userList, setUserList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Add modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', url: '', info: '', contract_code: '', industry: [], internal_links_enabled: false, internal_links_max: 3, article_styles: { ...DEFAULT_STYLES } });
  const [submitting, setSubmitting] = useState(false);
  const [showAddStyles, setShowAddStyles] = useState(false);

  // Edit modal
  const [editingCompany, setEditingCompany] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', url: '', info: '', contract_code: '', industry: [], internal_links_enabled: false, internal_links_max: 3, article_styles: { ...DEFAULT_STYLES } });
  const [saving, setSaving] = useState(false);
  const [showEditStyles, setShowEditStyles] = useState(false);

  // Google Fonts — lazy load khi mở accordion lần đầu
  const [googleFonts, setGoogleFonts] = useState([]);
  const [fontsLoading, setFontsLoading] = useState(false);
  const fontsFetched = React.useRef(false);

  const fetchGoogleFonts = () => {
    if (fontsFetched.current) return;
    fontsFetched.current = true;
    const api = document.querySelector('meta[name="google_font_api"]')?.getAttribute('content');
    if (!api) return;
    setFontsLoading(true);
    const url = `https://www.googleapis.com/webfonts/v1/webfonts?key=${api}&sort=popularity`;
    fetch(url)
      .then(r => r.json())
      .then(data => setGoogleFonts((data.items || []).map(f => ({ family: f.family }))))
      .catch(() => { fontsFetched.current = false; })
      .finally(() => setFontsLoading(false));
  };

  // Load Google Font CSS khi chọn font
  const loadGoogleFont = (family) => {
    if (!family) return;
    const id = `gf-${family.replace(/\s+/g, '-')}`;
    if (!document.getElementById(id)) {
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}&display=swap`;
      document.head.appendChild(link);
    }
  };

  useEffect(() => { fetchCompanies(); }, []);
  useEffect(() => {
    if (showMultiUser) {
      apiClient.get('/api/users').then(r => setUserList(r.data)).catch(() => {});
    }
  }, [showMultiUser]);

  const fetchCompanies = async () => {
    try {
      const res = await apiClient.get(API_URL);
      setCompanies(res.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // ADD
  const handleAdd = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const stylesPayload = Object.values(addForm.article_styles).some(Boolean) ? addForm.article_styles : null;
      await apiClient.post(API_URL, { ...addForm, industry: addForm.industry.join(','), internal_links_enabled: addForm.internal_links_enabled ? 1 : 0, article_styles: stylesPayload });
      setAddForm({ name: '', url: '', info: '', contract_code: '', industry: [], internal_links_enabled: false, internal_links_max: 3, article_styles: { ...DEFAULT_STYLES } });
      setShowAddStyles(false);
      setIsAddOpen(false);
      fetchCompanies();
    } catch (error) {
      toast.error('Có lỗi xảy ra khi thêm công ty');
    } finally {
      setSubmitting(false);
    }
  };

  // EDIT - open
  const openEdit = (company) => {
    setEditingCompany(company);
    setEditForm({ name: company.name, url: company.url, info: company.info || '', contract_code: company.contract_code || '', industry: (company.industry || '').split(',').filter(Boolean).map(v => isNaN(v) ? v : Number(v)), internal_links_enabled: !!company.internal_links_enabled, internal_links_max: company.internal_links_max || 3, article_styles: company.article_styles ? { ...DEFAULT_STYLES, ...company.article_styles } : { ...DEFAULT_STYLES } });
    setShowEditStyles(false);
  };

  // EDIT - save
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const stylesPayload = Object.values(editForm.article_styles).some(Boolean) ? editForm.article_styles : null;
      await apiClient.put(`${API_URL}/${editingCompany.id}`, { ...editForm, industry: editForm.industry.join(','), internal_links_enabled: editForm.internal_links_enabled ? 1 : 0, article_styles: stylesPayload });
      setEditingCompany(null);
      fetchCompanies();
    } catch (error) {
      toast.error('Có lỗi khi cập nhật!');
    } finally {
      setSaving(false);
    }
  };

  // DELETE
  const handleDelete = async (id, name) => {
    if (!await confirm({ title: `Xóa công ty "${name}"?`, message: 'Hành động này không thể hoàn tác.', confirmText: 'Xóa', danger: true })) return;
    try {
      await apiClient.delete(`${API_URL}/${id}`);
      fetchCompanies();
    } catch (error) {
      toast.error('Xóa thất bại!');
    }
  };

  const getInitials = (name) => {
    if (!name) return 'C';
    return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  };

  return (
    <div>
      {/* PAGE HEADER */}
      <div className="page-header">
        <div className="page-title-row">
          <div>
            <h1 className="page-title">Website & Công Ty</h1>
            <p className="page-subtitle">Quản lý thông tin các website/doanh nghiệp dùng để AI viết bài SEO phù hợp</p>
          </div>
          <button onClick={() => setIsAddOpen(true)} className="btn btn-primary">
            <Plus size={16} /> Thêm Website
          </button>
        </div>
      </div>

      {/* STATS */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-card-label">Tổng Website</div>
          <div className="stat-card-value">{companies.length}</div>
        </div>
      </div>

      {/* TABLE */}
      {loading ? (
        <div className="table-container">
          {[1, 2, 3].map(i => (
            <div key={i} style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '16px', alignItems: 'center' }}>
              <div className="skeleton" style={{ width: 36, height: 36, borderRadius: 8 }}></div>
              <div style={{ flex: 1 }}>
                <div className="skeleton" style={{ height: 15, width: '40%', marginBottom: 8 }}></div>
                <div className="skeleton" style={{ height: 12, width: '30%' }}></div>
              </div>
            </div>
          ))}
        </div>
      ) : companies.length === 0 ? (
        <div className="table-container">
          <div className="table-empty">
            <div className="table-empty-icon"><Building2 size={24} /></div>
            <div className="table-empty-text">Chưa có website nào</div>
            <div className="table-empty-hint">Nhấn "Thêm Website" để bắt đầu</div>
          </div>
        </div>
      ) : (
        <div className="table-container">
          {/* Header */}
          <div className="table-header" style={{ gridTemplateColumns: showMultiUser ? '140px 1fr 2fr 200px 72px' : '200px 1fr 2fr 72px' }}>
            <div>ID</div>
            <div>Tên Công Ty</div>
            <div>Mô tả</div>
            {showMultiUser && <div>Người tạo</div>}
            <div></div>
          </div>
          {companies.map(company => {
            const creator = showMultiUser ? userList.find(u => u.id === company.createdBy) : null;
            return (
            <div key={company.id} className="table-row" style={{ gridTemplateColumns: showMultiUser ? '140px 1fr 2fr 200px 72px' : '200px 1fr 2fr 72px' }}>
              {/* ID */}
              <IdCell id={company.id} />

              {/* Tên + URL + lĩnh vực */}
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <div className="company-avatar" style={{ flexShrink: 0 }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--accent)' }}>
                      {getInitials(company.name)}
                    </span>
                  </div>
                  <span style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {company.name}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 2 }}>
                  <a href={company.url} target="_blank" rel="noreferrer" style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    fontSize: '12px', color: 'var(--info)', textDecoration: 'none',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%',
                  }}>
                    <Globe size={11} style={{ flexShrink: 0 }} />
                    {company.url.replace(/^https?:\/\//, '')}
                  </a>
                  {company.industry && company.industry.split(',').filter(Boolean).map(ind => {
                    const num = isNaN(ind) ? ind : Number(ind);
                    const label = INDUSTRY_OPTIONS.find(o => o.value === num)?.label ?? ind;
                    return (
                    <span key={ind} style={{
                      fontSize: '10px', fontWeight: 600, padding: '1px 7px', borderRadius: 99,
                      background: 'rgba(99,102,241,0.08)', color: 'var(--accent)',
                      border: '1px solid rgba(99,102,241,0.2)', whiteSpace: 'nowrap', flexShrink: 0,
                    }}>
                      {label}
                    </span>
                  );
                  })}
                </div>
              </div>

              {/* Mô tả */}
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                {stripHtml(company.info) || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Chưa có mô tả</span>}
              </div>

              {/* Người tạo */}
              {showMultiUser && (
                <div>
                  {creator ? (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600,
                      background: 'var(--bg-hover)', border: '1px solid var(--border)',
                      color: 'var(--text-secondary)', maxWidth: '100%',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      <User size={9} style={{ flexShrink: 0 }} />
                      {creator.full_name || creator.username}
                    </span>
                  ) : company.creatorEmail ? (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600,
                      background: 'var(--bg-hover)', border: '1px solid var(--border)',
                      color: 'var(--text-secondary)', maxWidth: '100%',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      <User size={9} style={{ flexShrink: 0 }} />
                      {company.creatorEmail}
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>
                  )}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                <button onClick={() => openEdit(company)} className="btn btn-ghost btn-icon" title="Chỉnh sửa">
                  <Pencil size={15} />
                </button>
                <button onClick={() => handleDelete(company.id, company.name)} className="btn btn-danger-ghost btn-icon" title="Xóa">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* MODAL THÊM MỚI */}
      {isAddOpen && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <div className="modal-title">Thêm Website / Công Ty Mới</div>
              <button className="close-btn" onClick={() => !submitting && setIsAddOpen(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleAdd}>
                <div className="input-group">
                  <label className="input-label">Tên Công Ty / Website *</label>
                  <input type="text" className="input-field" value={addForm.name}
                    onChange={e => setAddForm({ ...addForm, name: e.target.value })}
                    required placeholder="VD: Công ty TNHH ABC" disabled={submitting} autoFocus />
                </div>
                <div className="input-group">
                  <label className="input-label">URL Website *</label>
                  <input type="url" className="input-field" value={addForm.url}
                    onChange={e => setAddForm({ ...addForm, url: e.target.value })}
                    required placeholder="https://example.com" disabled={submitting} />
                </div>
                <div className="input-group">
                  <label className="input-label">Mã Hợp Đồng</label>
                  <input type="text" className="input-field" value={addForm.contract_code}
                    onChange={e => setAddForm({ ...addForm, contract_code: e.target.value })}
                    placeholder="VD: HD-2024-001" disabled={submitting} />
                </div>
                <div className="input-group">
                  <label className="input-label">Lĩnh Vực</label>
                  <AppMultiSelect
                    value={addForm.industry}
                    onChange={v => setAddForm({ ...addForm, industry: v })}
                    disabled={submitting}
                    options={INDUSTRY_OPTIONS}
                    placeholder="-- Chọn lĩnh vực --"
                  />
                </div>
                <div className="input-group">
                  <label className="input-label">Mô tả (AI dùng để cá nhân hóa bài viết)</label>
                    <RichTextEditor
                      value={addForm.info}
                      onChange={v => setAddForm({ ...addForm, info: v })}
                      disabled={submitting}
                    />
                </div>
                <div className="input-group" style={{ marginBottom: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
                    <div
                      onClick={() => !submitting && setAddForm(f => ({ ...f, internal_links_enabled: !f.internal_links_enabled }))}
                      style={{
                        width: 36, height: 20, borderRadius: 99, flexShrink: 0,
                        background: addForm.internal_links_enabled ? 'var(--success)' : 'var(--border)',
                        position: 'relative', transition: 'background 0.2s', cursor: 'pointer',
                      }}
                    >
                      <div style={{
                        position: 'absolute', top: 3, left: addForm.internal_links_enabled ? 18 : 3,
                        width: 14, height: 14, borderRadius: '50%', background: '#fff',
                        transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      }} />
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Tự động chèn internal links</span>
                  </label>
                </div>
                {addForm.internal_links_enabled && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 46, marginBottom: 8, marginTop: -4 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Tối đa</span>
                    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: 'var(--bg-panel)' }}>
                      <button type="button" disabled={submitting || +addForm.internal_links_max <= 1}
                        onClick={() => setAddForm(f => ({ ...f, internal_links_max: Math.max(1, +f.internal_links_max - 1) }))}
                        style={{ width: 28, height: 28, border: 'none', background: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                      <span style={{ minWidth: 24, textAlign: 'center', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{addForm.internal_links_max}</span>
                      <button type="button" disabled={submitting || +addForm.internal_links_max >= 10}
                        onClick={() => setAddForm(f => ({ ...f, internal_links_max: Math.min(10, +f.internal_links_max + 1) }))}
                        style={{ width: 28, height: 28, border: 'none', background: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>link / bài</span>
                  </div>
                )}

                {/* Tùy chỉnh style bài viết */}
                <div style={{ borderTop: '1px solid var(--border)', marginTop: 4, paddingTop: 12 }}>
                  <button type="button" onClick={() => { setShowAddStyles(v => !v); fetchGoogleFonts(); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', padding: 0, cursor: 'pointer', width: '100%', marginBottom: showAddStyles ? 12 : 0 }}>
                    <Palette size={14} color="var(--accent)" />
                    <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>Tùy chỉnh giao diện bài viết</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>để trống = dùng mặc định</span>
                    {showAddStyles ? <ChevronUp size={14} color="var(--text-muted)" /> : <ChevronDown size={14} color="var(--text-muted)" />}
                  </button>
                  {showAddStyles && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px' }}>
                      <div className="input-group" style={{ marginBottom: 0 }}>
                        <label className="input-label" style={{ fontSize: 11 }}>Font chữ</label>
                        <FontPicker
                          value={addForm.article_styles.fontFamily}
                          onChange={v => { loadGoogleFont(v); setAddForm(f => ({ ...f, article_styles: { ...f.article_styles, fontFamily: v } })); }}
                          fonts={googleFonts}
                          loading={fontsLoading}
                          placeholder="-- Mặc định --"
                        />
                      </div>
                      <div className="input-group" style={{ marginBottom: 0 }}>
                        <label className="input-label" style={{ fontSize: 11 }}>Font size tổng</label>
                        <input className="input-field" style={{ fontSize: 12 }} placeholder="VD: 16px"
                          value={addForm.article_styles.fontSize}
                          onChange={e => setAddForm(f => ({ ...f, article_styles: { ...f.article_styles, fontSize: e.target.value } }))} />
                      </div>
                      <div className="input-group" style={{ marginBottom: 0 }}>
                        <label className="input-label" style={{ fontSize: 11 }}>Line height</label>
                        <input className="input-field" style={{ fontSize: 12 }} placeholder="VD: 1.8"
                          value={addForm.article_styles.lineHeight}
                          onChange={e => setAddForm(f => ({ ...f, article_styles: { ...f.article_styles, lineHeight: e.target.value } }))} />
                      </div>
                      <div className="input-group" style={{ marginBottom: 0 }}>
                        <label className="input-label" style={{ fontSize: 11 }}>Màu chữ tổng</label>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input type="color" value={addForm.article_styles.color || '#333333'}
                            onChange={e => setAddForm(f => ({ ...f, article_styles: { ...f.article_styles, color: e.target.value } }))}
                            style={{ width: 32, height: 32, padding: 2, border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', background: 'none' }} />
                          <input className="input-field" style={{ fontSize: 12, flex: 1 }} placeholder="#333333"
                            value={addForm.article_styles.color}
                            onChange={e => setAddForm(f => ({ ...f, article_styles: { ...f.article_styles, color: e.target.value } }))} />
                        </div>
                      </div>
                      <div className="input-group" style={{ marginBottom: 0 }}>
                        <label className="input-label" style={{ fontSize: 11 }}>Màu chủ đạo (link, blockquote...)</label>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input type="color" value={addForm.article_styles.accentColor || '#6366f1'}
                            onChange={e => setAddForm(f => ({ ...f, article_styles: { ...f.article_styles, accentColor: e.target.value } }))}
                            style={{ width: 32, height: 32, padding: 2, border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', background: 'none' }} />
                          <input className="input-field" style={{ fontSize: 12, flex: 1 }} placeholder="#6366f1"
                            value={addForm.article_styles.accentColor}
                            onChange={e => setAddForm(f => ({ ...f, article_styles: { ...f.article_styles, accentColor: e.target.value } }))} />
                        </div>
                      </div>
                      <div className="input-group" style={{ marginBottom: 0 }}>
                        <label className="input-label" style={{ fontSize: 11 }}>H2 font size</label>
                        <input className="input-field" style={{ fontSize: 12 }} placeholder="VD: 20px"
                          value={addForm.article_styles.h2FontSize}
                          onChange={e => setAddForm(f => ({ ...f, article_styles: { ...f.article_styles, h2FontSize: e.target.value } }))} />
                      </div>
                      <div className="input-group" style={{ marginBottom: 0 }}>
                        <label className="input-label" style={{ fontSize: 11 }}>H2 màu chữ</label>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input type="color" value={addForm.article_styles.h2Color || '#111111'}
                            onChange={e => setAddForm(f => ({ ...f, article_styles: { ...f.article_styles, h2Color: e.target.value } }))}
                            style={{ width: 32, height: 32, padding: 2, border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', background: 'none' }} />
                          <input className="input-field" style={{ fontSize: 12, flex: 1 }} placeholder="#111111"
                            value={addForm.article_styles.h2Color}
                            onChange={e => setAddForm(f => ({ ...f, article_styles: { ...f.article_styles, h2Color: e.target.value } }))} />
                        </div>
                      </div>
                      <div className="input-group" style={{ marginBottom: 0 }}>
                        <label className="input-label" style={{ fontSize: 11 }}>H3 font size</label>
                        <input className="input-field" style={{ fontSize: 12 }} placeholder="VD: 17px"
                          value={addForm.article_styles.h3FontSize}
                          onChange={e => setAddForm(f => ({ ...f, article_styles: { ...f.article_styles, h3FontSize: e.target.value } }))} />
                      </div>
                      <div className="input-group" style={{ marginBottom: 0 }}>
                        <label className="input-label" style={{ fontSize: 11 }}>H3 màu chữ</label>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input type="color" value={addForm.article_styles.h3Color || '#222222'}
                            onChange={e => setAddForm(f => ({ ...f, article_styles: { ...f.article_styles, h3Color: e.target.value } }))}
                            style={{ width: 32, height: 32, padding: 2, border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', background: 'none' }} />
                          <input className="input-field" style={{ fontSize: 12, flex: 1 }} placeholder="#222222"
                            value={addForm.article_styles.h3Color}
                            onChange={e => setAddForm(f => ({ ...f, article_styles: { ...f.article_styles, h3Color: e.target.value } }))} />
                        </div>
                      </div>
                      <div className="input-group" style={{ marginBottom: 0 }}>
                        <label className="input-label" style={{ fontSize: 11 }}>H4 font size</label>
                        <input className="input-field" style={{ fontSize: 12 }} placeholder="VD: 15px"
                          value={addForm.article_styles.h4FontSize}
                          onChange={e => setAddForm(f => ({ ...f, article_styles: { ...f.article_styles, h4FontSize: e.target.value } }))} />
                      </div>
                      <div className="input-group" style={{ marginBottom: 0 }}>
                        <label className="input-label" style={{ fontSize: 11 }}>H4 màu chữ</label>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input type="color" value={addForm.article_styles.h4Color || '#333333'}
                            onChange={e => setAddForm(f => ({ ...f, article_styles: { ...f.article_styles, h4Color: e.target.value } }))}
                            style={{ width: 32, height: 32, padding: 2, border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', background: 'none' }} />
                          <input className="input-field" style={{ fontSize: 12, flex: 1 }} placeholder="#333333"
                            value={addForm.article_styles.h4Color}
                            onChange={e => setAddForm(f => ({ ...f, article_styles: { ...f.article_styles, h4Color: e.target.value } }))} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                  <button type="button" className="btn btn-outline" onClick={() => setIsAddOpen(false)} disabled={submitting}>Hủy</button>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? <><div className="spinner"></div> Đang lưu...</> : <><Plus size={16} /> Lưu lại</>}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CHỈNH SỬA */}
      {editingCompany && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Pencil size={17} color="var(--accent)" />
                Chỉnh Sửa Thông Tin
              </div>
              <button className="close-btn" onClick={() => !saving && setEditingCompany(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSaveEdit}>
                <div className="input-group">
                  <label className="input-label">Tên Công Ty / Website *</label>
                  <input type="text" className="input-field" value={editForm.name}
                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                    required disabled={saving} autoFocus />
                </div>
                <div className="input-group">
                  <label className="input-label">URL Website *</label>
                  <input type="url" className="input-field" value={editForm.url}
                    onChange={e => setEditForm({ ...editForm, url: e.target.value })}
                    required disabled={saving} />
                </div>
                <div className="input-group">
                  <label className="input-label">Mã Hợp Đồng</label>
                  <input type="text" className="input-field" value={editForm.contract_code}
                    onChange={e => setEditForm({ ...editForm, contract_code: e.target.value })}
                    placeholder="VD: HD-2024-001" disabled={saving} />
                </div>
                <div className="input-group">
                  <label className="input-label">Lĩnh Vực</label>
                  <AppMultiSelect
                    value={editForm.industry}
                    onChange={v => setEditForm({ ...editForm, industry: v })}
                    disabled={saving}
                    options={INDUSTRY_OPTIONS}
                    placeholder="-- Chọn lĩnh vực --"
                  />
                </div>
                <div className="input-group">
                  <label className="input-label">Mô tả (AI dùng để cá nhân hóa bài viết)</label>
                 
                  <RichTextEditor
                      value={editForm.info}
                      onChange={v => setEditForm({ ...editForm, info: v })}
                      disabled={saving}
                    />
                </div>
                <div className="input-group" style={{ marginBottom: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
                    <div
                      onClick={() => !saving && setEditForm(f => ({ ...f, internal_links_enabled: !f.internal_links_enabled }))}
                      style={{
                        width: 36, height: 20, borderRadius: 99, flexShrink: 0,
                        background: editForm.internal_links_enabled ? 'var(--success)' : 'var(--border)',
                        position: 'relative', transition: 'background 0.2s', cursor: 'pointer',
                      }}
                    >
                      <div style={{
                        position: 'absolute', top: 3, left: editForm.internal_links_enabled ? 18 : 3,
                        width: 14, height: 14, borderRadius: '50%', background: '#fff',
                        transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      }} />
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Tự động chèn internal links</span>
                  </label>
                </div>
                {editForm.internal_links_enabled && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 46, marginBottom: 8, marginTop: -4 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Tối đa</span>
                    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: 'var(--bg-panel)' }}>
                      <button type="button" disabled={saving || +editForm.internal_links_max <= 1}
                        onClick={() => setEditForm(f => ({ ...f, internal_links_max: Math.max(1, +f.internal_links_max - 1) }))}
                        style={{ width: 28, height: 28, border: 'none', background: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                      <span style={{ minWidth: 24, textAlign: 'center', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{editForm.internal_links_max}</span>
                      <button type="button" disabled={saving || +editForm.internal_links_max >= 10}
                        onClick={() => setEditForm(f => ({ ...f, internal_links_max: Math.min(10, +f.internal_links_max + 1) }))}
                        style={{ width: 28, height: 28, border: 'none', background: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>link / bài</span>
                  </div>
                )}

                {/* Tùy chỉnh style bài viết */}
                <div style={{ borderTop: '1px solid var(--border)', marginTop: 4, paddingTop: 12 }}>
                  <button type="button" onClick={() => { setShowEditStyles(v => !v); fetchGoogleFonts(); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', padding: 0, cursor: 'pointer', width: '100%', marginBottom: showEditStyles ? 12 : 0 }}>
                    <Palette size={14} color="var(--accent)" />
                    <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>Tùy chỉnh giao diện bài viết</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>để trống = dùng mặc định</span>
                    {showEditStyles ? <ChevronUp size={14} color="var(--text-muted)" /> : <ChevronDown size={14} color="var(--text-muted)" />}
                  </button>
                  {showEditStyles && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px' }}>
                      <div className="input-group" style={{ marginBottom: 0 }}>
                        <label className="input-label" style={{ fontSize: 11 }}>Font chữ</label>
                        <FontPicker
                          value={editForm.article_styles.fontFamily}
                          onChange={v => { loadGoogleFont(v); setEditForm(f => ({ ...f, article_styles: { ...f.article_styles, fontFamily: v } })); }}
                          fonts={googleFonts}
                          loading={fontsLoading}
                          placeholder="-- Mặc định --"
                        />
                      </div>
                      <div className="input-group" style={{ marginBottom: 0 }}>
                        <label className="input-label" style={{ fontSize: 11 }}>Font size tổng</label>
                        <input className="input-field" style={{ fontSize: 12 }} placeholder="VD: 16px"
                          value={editForm.article_styles.fontSize}
                          onChange={e => setEditForm(f => ({ ...f, article_styles: { ...f.article_styles, fontSize: e.target.value } }))} />
                      </div>
                      <div className="input-group" style={{ marginBottom: 0 }}>
                        <label className="input-label" style={{ fontSize: 11 }}>Line height</label>
                        <input className="input-field" style={{ fontSize: 12 }} placeholder="VD: 1.8"
                          value={editForm.article_styles.lineHeight}
                          onChange={e => setEditForm(f => ({ ...f, article_styles: { ...f.article_styles, lineHeight: e.target.value } }))} />
                      </div>
                      <div className="input-group" style={{ marginBottom: 0 }}>
                        <label className="input-label" style={{ fontSize: 11 }}>Màu chữ tổng</label>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input type="color" value={editForm.article_styles.color || '#333333'}
                            onChange={e => setEditForm(f => ({ ...f, article_styles: { ...f.article_styles, color: e.target.value } }))}
                            style={{ width: 32, height: 32, padding: 2, border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', background: 'none' }} />
                          <input className="input-field" style={{ fontSize: 12, flex: 1 }} placeholder="#333333"
                            value={editForm.article_styles.color}
                            onChange={e => setEditForm(f => ({ ...f, article_styles: { ...f.article_styles, color: e.target.value } }))} />
                        </div>
                      </div>
                      <div className="input-group" style={{ marginBottom: 0 }}>
                        <label className="input-label" style={{ fontSize: 11 }}>Màu chủ đạo (link, blockquote...)</label>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input type="color" value={editForm.article_styles.accentColor || '#6366f1'}
                            onChange={e => setEditForm(f => ({ ...f, article_styles: { ...f.article_styles, accentColor: e.target.value } }))}
                            style={{ width: 32, height: 32, padding: 2, border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', background: 'none' }} />
                          <input className="input-field" style={{ fontSize: 12, flex: 1 }} placeholder="#6366f1"
                            value={editForm.article_styles.accentColor}
                            onChange={e => setEditForm(f => ({ ...f, article_styles: { ...f.article_styles, accentColor: e.target.value } }))} />
                        </div>
                      </div>
                      <div className="input-group" style={{ marginBottom: 0 }}>
                        <label className="input-label" style={{ fontSize: 11 }}>H2 font size</label>
                        <input className="input-field" style={{ fontSize: 12 }} placeholder="VD: 20px"
                          value={editForm.article_styles.h2FontSize}
                          onChange={e => setEditForm(f => ({ ...f, article_styles: { ...f.article_styles, h2FontSize: e.target.value } }))} />
                      </div>
                      <div className="input-group" style={{ marginBottom: 0 }}>
                        <label className="input-label" style={{ fontSize: 11 }}>H2 màu chữ</label>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input type="color" value={editForm.article_styles.h2Color || '#111111'}
                            onChange={e => setEditForm(f => ({ ...f, article_styles: { ...f.article_styles, h2Color: e.target.value } }))}
                            style={{ width: 32, height: 32, padding: 2, border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', background: 'none' }} />
                          <input className="input-field" style={{ fontSize: 12, flex: 1 }} placeholder="#111111"
                            value={editForm.article_styles.h2Color}
                            onChange={e => setEditForm(f => ({ ...f, article_styles: { ...f.article_styles, h2Color: e.target.value } }))} />
                        </div>
                      </div>
                      <div className="input-group" style={{ marginBottom: 0 }}>
                        <label className="input-label" style={{ fontSize: 11 }}>H3 font size</label>
                        <input className="input-field" style={{ fontSize: 12 }} placeholder="VD: 17px"
                          value={editForm.article_styles.h3FontSize}
                          onChange={e => setEditForm(f => ({ ...f, article_styles: { ...f.article_styles, h3FontSize: e.target.value } }))} />
                      </div>
                      <div className="input-group" style={{ marginBottom: 0 }}>
                        <label className="input-label" style={{ fontSize: 11 }}>H3 màu chữ</label>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input type="color" value={editForm.article_styles.h3Color || '#222222'}
                            onChange={e => setEditForm(f => ({ ...f, article_styles: { ...f.article_styles, h3Color: e.target.value } }))}
                            style={{ width: 32, height: 32, padding: 2, border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', background: 'none' }} />
                          <input className="input-field" style={{ fontSize: 12, flex: 1 }} placeholder="#222222"
                            value={editForm.article_styles.h3Color}
                            onChange={e => setEditForm(f => ({ ...f, article_styles: { ...f.article_styles, h3Color: e.target.value } }))} />
                        </div>
                      </div>
                      <div className="input-group" style={{ marginBottom: 0 }}>
                        <label className="input-label" style={{ fontSize: 11 }}>H4 font size</label>
                        <input className="input-field" style={{ fontSize: 12 }} placeholder="VD: 15px"
                          value={editForm.article_styles.h4FontSize}
                          onChange={e => setEditForm(f => ({ ...f, article_styles: { ...f.article_styles, h4FontSize: e.target.value } }))} />
                      </div>
                      <div className="input-group" style={{ marginBottom: 0 }}>
                        <label className="input-label" style={{ fontSize: 11 }}>H4 màu chữ</label>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input type="color" value={editForm.article_styles.h4Color || '#333333'}
                            onChange={e => setEditForm(f => ({ ...f, article_styles: { ...f.article_styles, h4Color: e.target.value } }))}
                            style={{ width: 32, height: 32, padding: 2, border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', background: 'none' }} />
                          <input className="input-field" style={{ fontSize: 12, flex: 1 }} placeholder="#333333"
                            value={editForm.article_styles.h4Color}
                            onChange={e => setEditForm(f => ({ ...f, article_styles: { ...f.article_styles, h4Color: e.target.value } }))} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                  <button type="button" className="btn btn-outline" onClick={() => setEditingCompany(null)} disabled={saving}>Hủy</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? <><div className="spinner"></div> Đang lưu...</> : <><Save size={15} /> Lưu thay đổi</>}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Companies;
