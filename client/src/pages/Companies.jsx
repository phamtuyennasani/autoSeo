import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import apiClient from '../config/api';
import { Plus, Trash2, Building2, Globe, Pencil, X, Save, User, Upload } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import { AppMultiSelect } from '../components/AppMultiSelect';

import { API } from '../config/api';
const API_URL = API.companies;

const INDUSTRIES = [
  'Bất động sản',
  'Công nghệ thông tin',
  'Thương mại điện tử',
  'Giáo dục & Đào tạo',
  'Y tế & Sức khỏe',
  'Tài chính & Ngân hàng',
  'Xây dựng & Nội thất',
  'Du lịch & Khách sạn',
  'Thực phẩm & Đồ uống',
  'Thời trang & Làm đẹp',
  'Vận tải & Logistics',
  'Nông nghiệp',
  'Năng lượng',
  'Truyền thông & Marketing',
  'Pháp lý',
  'Khác',
];
const INDUSTRY_OPTIONS = INDUSTRIES.map(ind => ({ value: ind, label: ind }));

const Companies = () => {
  const { user: currentUser, authEnabled, canManageUsers } = useAuth();
  const confirm = useConfirm();
  const showMultiUser = authEnabled && canManageUsers;

  const [companies, setCompanies] = useState([]);
  const [userList, setUserList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Add modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', url: '', info: '', contract_code: '', industry: [], publish_api_url: '', auto_publish: false, internal_links_enabled: false, internal_links_max: 3 });
  const [submitting, setSubmitting] = useState(false);

  // Edit modal
  const [editingCompany, setEditingCompany] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', url: '', info: '', contract_code: '', industry: [], publish_api_url: '', auto_publish: false, internal_links_enabled: false, internal_links_max: 3 });
  const [saving, setSaving] = useState(false);

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
      await apiClient.post(API_URL, { ...addForm, industry: addForm.industry.join(','), auto_publish: addForm.auto_publish ? 1 : 0, internal_links_enabled: addForm.internal_links_enabled ? 1 : 0 });
      setAddForm({ name: '', url: '', info: '', contract_code: '', industry: [], publish_api_url: '', auto_publish: false, internal_links_enabled: false, internal_links_max: 3 });
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
    setEditForm({ name: company.name, url: company.url, info: company.info || '', contract_code: company.contract_code || '', industry: (company.industry || '').split(',').filter(Boolean), publish_api_url: company.publish_api_url || '', auto_publish: !!company.auto_publish, internal_links_enabled: !!company.internal_links_enabled, internal_links_max: company.internal_links_max || 3 });
  };

  // EDIT - save
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiClient.put(`${API_URL}/${editingCompany.id}`, { ...editForm, industry: editForm.industry.join(','), auto_publish: editForm.auto_publish ? 1 : 0, internal_links_enabled: editForm.internal_links_enabled ? 1 : 0 });
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
          <div className="table-header" style={{ gridTemplateColumns: showMultiUser ? '1fr 2fr 130px 72px' : '1fr 2fr 72px' }}>
            <div>Tên Công Ty</div>
            <div>Mô tả</div>
            {showMultiUser && <div>Người tạo</div>}
            <div></div>
          </div>
          {companies.map(company => {
            const creator = showMultiUser ? userList.find(u => u.id === company.createdBy) : null;
            return (
            <div key={company.id} className="table-row" style={{ gridTemplateColumns: showMultiUser ? '1fr 2fr 130px 72px' : '1fr 2fr 72px' }}>
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
                  {company.industry && company.industry.split(',').filter(Boolean).map(ind => (
                    <span key={ind} style={{
                      fontSize: '10px', fontWeight: 600, padding: '1px 7px', borderRadius: 99,
                      background: 'rgba(99,102,241,0.08)', color: 'var(--accent)',
                      border: '1px solid rgba(99,102,241,0.2)', whiteSpace: 'nowrap', flexShrink: 0,
                    }}>
                      {ind}
                    </span>
                  ))}
                  {company.auto_publish ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '10px', fontWeight: 600, padding: '1px 7px', borderRadius: 99, background: 'rgba(34,197,94,0.08)', color: 'var(--success)', border: '1px solid rgba(34,197,94,0.2)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      <Upload size={9} /> Auto-post
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Mô tả */}
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                {company.info || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Chưa có mô tả</span>}
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
                  <textarea className="input-field" value={addForm.info}
                    onChange={e => setAddForm({ ...addForm, info: e.target.value })}
                    placeholder="Lĩnh vực, sản phẩm, dịch vụ..." rows={4} disabled={submitting} />
                </div>
                <div className="input-group">
                  <label className="input-label">API URL Đăng Bài <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(để trống = dùng URL mặc định trong Cài Đặt)</span></label>
                  <input type="url" className="input-field" value={addForm.publish_api_url}
                    onChange={e => setAddForm({ ...addForm, publish_api_url: e.target.value })}
                    placeholder="https://api.example.com/posts" disabled={submitting} />
                </div>
                <div className="input-group" style={{ marginBottom: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
                    <div
                      onClick={() => !submitting && setAddForm(f => ({ ...f, auto_publish: !f.auto_publish }))}
                      style={{
                        width: 36, height: 20, borderRadius: 99, flexShrink: 0,
                        background: addForm.auto_publish ? 'var(--success)' : 'var(--border)',
                        position: 'relative', transition: 'background 0.2s', cursor: 'pointer',
                      }}
                    >
                      <div style={{
                        position: 'absolute', top: 3, left: addForm.auto_publish ? 18 : 3,
                        width: 14, height: 14, borderRadius: '50%', background: '#fff',
                        transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      }} />
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Tự động đăng bài sau khi viết xong</span>
                  </label>
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
                  <div className="input-group" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <label style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Số link tối đa mỗi bài:</label>
                    <input type="number" min="1" max="10" className="input-field"
                      value={addForm.internal_links_max}
                      onChange={e => setAddForm(f => ({ ...f, internal_links_max: e.target.value }))}
                      style={{ width: 70, textAlign: 'center' }} disabled={submitting} />
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>(1–10)</span>
                  </div>
                )}
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
                  <textarea className="input-field" value={editForm.info}
                    onChange={e => setEditForm({ ...editForm, info: e.target.value })}
                    rows={5} disabled={saving} />
                </div>
                <div className="input-group">
                  <label className="input-label">API URL Đăng Bài <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(để trống = dùng URL mặc định trong Cài Đặt)</span></label>
                  <input type="url" className="input-field" value={editForm.publish_api_url}
                    onChange={e => setEditForm({ ...editForm, publish_api_url: e.target.value })}
                    placeholder="https://api.example.com/posts" disabled={saving} />
                </div>
                <div className="input-group" style={{ marginBottom: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
                    <div
                      onClick={() => !saving && setEditForm(f => ({ ...f, auto_publish: !f.auto_publish }))}
                      style={{
                        width: 36, height: 20, borderRadius: 99, flexShrink: 0,
                        background: editForm.auto_publish ? 'var(--success)' : 'var(--border)',
                        position: 'relative', transition: 'background 0.2s', cursor: 'pointer',
                      }}
                    >
                      <div style={{
                        position: 'absolute', top: 3, left: editForm.auto_publish ? 18 : 3,
                        width: 14, height: 14, borderRadius: '50%', background: '#fff',
                        transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      }} />
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Tự động đăng bài sau khi viết xong</span>
                  </label>
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
                  <div className="input-group" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <label style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Số link tối đa mỗi bài:</label>
                    <input type="number" min="1" max="10" className="input-field"
                      value={editForm.internal_links_max}
                      onChange={e => setEditForm(f => ({ ...f, internal_links_max: e.target.value }))}
                      style={{ width: 70, textAlign: 'center' }} disabled={saving} />
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>(1–10)</span>
                  </div>
                )}
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
