import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Trash2, Building2, Globe, Pencil, X, Save } from 'lucide-react';

import API from '../config/api';
const API_URL = API.companies;

const Companies = () => {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);

  // Add modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', url: '', info: '' });
  const [submitting, setSubmitting] = useState(false);

  // Edit modal
  const [editingCompany, setEditingCompany] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', url: '', info: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchCompanies(); }, []);

  const fetchCompanies = async () => {
    try {
      const res = await axios.get(API_URL);
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
      await axios.post(API_URL, addForm);
      setAddForm({ name: '', url: '', info: '' });
      setIsAddOpen(false);
      fetchCompanies();
    } catch (error) {
      alert('Có lỗi xảy ra khi thêm công ty');
    } finally {
      setSubmitting(false);
    }
  };

  // EDIT - open
  const openEdit = (company) => {
    setEditingCompany(company);
    setEditForm({ name: company.name, url: company.url, info: company.info || '' });
  };

  // EDIT - save
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await axios.put(`${API_URL}/${editingCompany.id}`, editForm);
      setEditingCompany(null);
      fetchCompanies();
    } catch (error) {
      alert('Có lỗi khi cập nhật!');
    } finally {
      setSaving(false);
    }
  };

  // DELETE
  const handleDelete = async (id, name) => {
    if (!window.confirm(`Xóa công ty "${name}"? Hành động không thể hoàn tác.`)) return;
    try {
      await axios.delete(`${API_URL}/${id}`);
      fetchCompanies();
    } catch (error) {
      alert('Xóa thất bại!');
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
          <div className="table-header" style={{ gridTemplateColumns: '2fr 2fr 3fr auto' }}>
            <div>Tên Công Ty</div>
            <div>Website URL</div>
            <div>Mô tả</div>
            <div></div>
          </div>
          {companies.map(company => (
            <div key={company.id} className="table-row" style={{ gridTemplateColumns: '2fr 2fr 3fr auto' }}>
              {/* Name */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div className="company-avatar">
                  <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--accent)' }}>
                    {getInitials(company.name)}
                  </span>
                </div>
                <span style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)' }}>
                  {company.name}
                </span>
              </div>

              {/* URL */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                <Globe size={13} color="var(--info)" style={{ flexShrink: 0 }} />
                <a href={company.url} target="_blank" rel="noreferrer"
                  style={{ color: 'var(--info)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {company.url}
                </a>
              </div>

              {/* Info */}
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                {company.info || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Chưa có mô tả</span>}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => openEdit(company)}
                  className="btn btn-ghost btn-icon"
                  title="Chỉnh sửa"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => handleDelete(company.id, company.name)}
                  className="btn btn-danger-ghost btn-icon"
                  title="Xóa"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL THÊM MỚI */}
      {isAddOpen && (
        <div className="modal-overlay" onClick={() => !submitting && setIsAddOpen(false)}>
          <div className="modal-dialog" onClick={e => e.stopPropagation()}>
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
                  <label className="input-label">Mô tả (AI dùng để cá nhân hóa bài viết)</label>
                  <textarea className="input-field" value={addForm.info}
                    onChange={e => setAddForm({ ...addForm, info: e.target.value })}
                    placeholder="Lĩnh vực, sản phẩm, dịch vụ..." rows={4} disabled={submitting} />
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
        <div className="modal-overlay" onClick={() => !saving && setEditingCompany(null)}>
          <div className="modal-dialog" onClick={e => e.stopPropagation()}>
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
                  <label className="input-label">Mô tả (AI dùng để cá nhân hóa bài viết)</label>
                  <textarea className="input-field" value={editForm.info}
                    onChange={e => setEditForm({ ...editForm, info: e.target.value })}
                    rows={5} disabled={saving} />
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
