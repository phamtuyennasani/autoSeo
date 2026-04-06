import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import apiClient from '../config/api';
import {
  FileSignature, Search, Pencil, Trash2,
  ChevronDown, ChevronRight, Building2, X, Save,
  RefreshCw, CheckCircle2, PauseCircle, Hash,
} from 'lucide-react';
import { useConfirm } from '../context/ConfirmContext';

const fmtDate = (s) => s ? new Date(s).toLocaleDateString('vi-VN') : '—';

const COLS = '32px 1fr 2fr 1.5fr 72px 130px 100px 72px';

const HopDong = () => {
  const confirm = useConfirm();
  const [list, setList]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [q, setQ]               = useState('');
  const [expanded, setExpanded] = useState(null);
  const [detail, setDetail]     = useState({});
  const [editing, setEditing]   = useState(null);
  const [editForm, setEditForm] = useState({ ten_hd: '', ten_mien: '', status: 'active' });
  const [saving, setSaving]     = useState(false);

  useEffect(() => { fetchList(); }, []);

  const fetchList = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/api/hop-dong', { params: { q } });
      setList(res.data);
    } catch {
      toast.error('Lỗi tải danh sách hợp đồng');
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => ({
    total:    list.length,
    active:   list.filter(h => h.status === 'active').length,
    inactive: list.filter(h => h.status !== 'active').length,
    companies: list.reduce((s, h) => s + (h.so_cong_ty || 0), 0),
  }), [list]);

  const toggleExpand = async (hd) => {
    if (expanded === hd.id) { setExpanded(null); return; }
    setExpanded(hd.id);
    if (detail[hd.id]) return;
    try {
      const res = await apiClient.get(`/api/hop-dong/${hd.id}`);
      setDetail(prev => ({ ...prev, [hd.id]: res.data }));
    } catch {
      toast.error('Lỗi tải chi tiết hợp đồng');
    }
  };

  const openEdit = (hd, e) => {
    e.stopPropagation();
    setEditing(hd);
    setEditForm({ ten_hd: hd.ten_hd || '', ten_mien: hd.ten_mien || '', status: hd.status || 'active' });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiClient.put(`/api/hop-dong/${editing.id}`, editForm);
      toast.success('Đã cập nhật hợp đồng');
      setEditing(null);
      setDetail({});
      fetchList();
    } catch {
      toast.error('Lỗi cập nhật hợp đồng');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (hd, e) => {
    e.stopPropagation();
    const ok = await confirm({
      title: 'Xóa Hợp Đồng',
      message: `Xóa hợp đồng "${hd.ma_hd}"? Hành động này không thể hoàn tác.`,
      confirmText: 'Xóa', danger: true,
    });
    if (!ok) return;
    try {
      await apiClient.delete(`/api/hop-dong/${hd.id}`);
      toast.success('Đã xóa hợp đồng');
      setDetail({});
      fetchList();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Lỗi xóa hợp đồng');
    }
  };

  return (
    <div className="page-container">
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* ── Header ── */}
      <div className="page-header">
        <div className="page-title-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileSignature size={20} color="var(--accent)" />
            <h1 className="page-title">Quản Lý Hợp Đồng</h1>
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
                  width: 220, height: '100%',
                }}
                placeholder="Tìm mã HĐ, tên, tên miền..."
                value={q}
                onChange={e => setQ(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && fetchList()}
              />
              <button
                onClick={fetchList}
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
            {/* Reload button */}
            <button
              className="btn btn-outline"
              onClick={() => { setQ(''); setTimeout(fetchList, 0); }}
              title="Làm mới"
              style={{ height: 36, width: 36, padding: 0 }}
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="stats-row">
        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="stat-card-label">Tổng Hợp Đồng</div>
            <div className="stat-card-icon" style={{ background: 'rgba(99,102,241,0.12)' }}>
              <Hash size={15} color="#6366f1" />
            </div>
          </div>
          <div className="stat-card-value">{stats.total}</div>
        </div>
        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="stat-card-label">Đang Hoạt Động</div>
            <div className="stat-card-icon" style={{ background: 'rgba(22,163,74,0.12)' }}>
              <CheckCircle2 size={15} color="#16a34a" />
            </div>
          </div>
          <div className="stat-card-value" style={{ color: '#16a34a' }}>{stats.active}</div>
        </div>
        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="stat-card-label">Tạm Dừng</div>
            <div className="stat-card-icon" style={{ background: 'rgba(148,163,184,0.12)' }}>
              <PauseCircle size={15} color="#94a3b8" />
            </div>
          </div>
          <div className="stat-card-value" style={{ color: 'var(--text-muted)' }}>{stats.inactive}</div>
        </div>
        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="stat-card-label">Tổng Công Ty</div>
            <div className="stat-card-icon" style={{ background: 'rgba(245,158,11,0.12)' }}>
              <Building2 size={15} color="#f59e0b" />
            </div>
          </div>
          <div className="stat-card-value">{stats.companies}</div>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="table-container">
        {/* Table header */}
        <div className="table-header" style={{ gridTemplateColumns: COLS }}>
          <div />
          <div>Mã HĐ</div>
          <div>Tên Hợp Đồng</div>
          <div>Tên Miền</div>
          <div style={{ textAlign: 'center' }}>Công ty</div>
          <div style={{ textAlign: 'center' }}>Trạng thái</div>
          <div>Ngày tạo</div>
          <div style={{ textAlign: 'center' }}>Thao tác</div>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite', marginBottom: 8 }} />
            <div style={{ fontSize: 13 }}>Đang tải...</div>
          </div>
        )}

        {/* Empty */}
        {!loading && list.length === 0 && (
          <div className="table-empty">
            <div className="table-empty-icon"><FileSignature size={22} /></div>
            <div className="table-empty-text">Chưa có hợp đồng nào</div>
            <div className="table-empty-hint">Hợp đồng sẽ được tạo tự động qua webhook CRM</div>
          </div>
        )}

        {/* Rows */}
        {!loading && list.map(hd => (
          <div key={hd.id}>
            {/* Main row */}
            <div
              className="table-row"
              style={{ gridTemplateColumns: COLS, cursor: 'pointer' }}
              onClick={() => toggleExpand(hd)}
            >
              {/* Chevron */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                {expanded === hd.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </div>

              {/* Mã HĐ */}
              <div style={{ fontWeight: 700, color: 'var(--accent)', fontFamily: 'monospace', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {hd.ma_hd}
              </div>

              {/* Tên HĐ */}
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {hd.ten_hd || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Chưa đặt tên</span>}
              </div>

              {/* Tên Miền */}
              <div style={{ color: 'var(--text-secondary)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {hd.ten_mien || '—'}
              </div>

              {/* Số công ty */}
              <div style={{ textAlign: 'center' }}>
                <span style={{ background: 'var(--accent-subtle)', color: 'var(--accent)', borderRadius: 999, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>
                  {hd.so_cong_ty || 0}
                </span>
              </div>

              {/* Status */}
              <div style={{ textAlign: 'center' }}>
                {hd.status === 'active' ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(22,163,74,0.12)', color: '#16a34a', borderRadius: 999, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>
                    <CheckCircle2 size={11} /> Hoạt động
                  </span>
                ) : (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(148,163,184,0.1)', color: 'var(--text-muted)', borderRadius: 999, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>
                    <PauseCircle size={11} /> Tạm dừng
                  </span>
                )}
              </div>

              {/* Ngày tạo */}
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{fmtDate(hd.createdAt)}</div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 2, justifyContent: 'center' }} onClick={e => e.stopPropagation()}>
                <button className="btn btn-ghost" style={{ padding: '4px 8px' }} onClick={e => openEdit(hd, e)} title="Chỉnh sửa">
                  <Pencil size={14} />
                </button>
                <button className="btn btn-ghost" style={{ padding: '4px 8px', color: 'var(--error)' }} onClick={e => handleDelete(hd, e)} title="Xóa">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {/* Expanded — companies */}
            {expanded === hd.id && (
              <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
                <div style={{ padding: '14px 24px 14px 60px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    <Building2 size={13} /> Công ty thuộc hợp đồng
                  </div>
                  {!detail[hd.id] ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> Đang tải...
                    </div>
                  ) : detail[hd.id].companies?.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: 13, fontStyle: 'italic' }}>Chưa có công ty nào.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {detail[hd.id].companies.map(c => (
                        <div key={c.id} style={{
                          display: 'grid', gridTemplateColumns: '2fr 1fr 90px 100px',
                          gap: 12, padding: '8px 14px',
                          background: 'var(--bg-panel)', borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--border)', fontSize: 13,
                        }}>
                          <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                          <div style={{ color: 'var(--text-muted)' }}>{c.industry || '—'}</div>
                          <div style={{ color: 'var(--text-muted)' }}>{fmtDate(c.createdAt)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Edit Modal ── */}
      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div className="modal-dialog" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>

            {/* Header */}
            <div className="modal-header">
              <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Pencil size={14} color="var(--accent)" />
                </div>
                Chỉnh sửa Hợp Đồng
              </div>
              <button className="close-btn" onClick={() => setEditing(null)}><X size={16} /></button>
            </div>

            {/* Body */}
            <form onSubmit={handleSave}>
              <div className="modal-body">

                {/* Mã HĐ — readonly */}
                <div className="input-group">
                  <label className="input-label">Mã HĐ</label>
                  <input
                    className="input-field"
                    value={editing.ma_hd}
                    disabled
                    style={{ opacity: 0.5, cursor: 'not-allowed', fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent)' }}
                  />
                </div>

                {/* Tên Hợp Đồng */}
                <div className="input-group">
                  <label className="input-label">Tên Hợp Đồng</label>
                  <input
                    className="input-field"
                    value={editForm.ten_hd}
                    onChange={e => setEditForm(p => ({ ...p, ten_hd: e.target.value }))}
                    placeholder="Nhập tên hợp đồng..."
                    autoFocus
                  />
                </div>

                {/* Tên Miền */}
                <div className="input-group">
                  <label className="input-label">Tên Miền</label>
                  <input
                    className="input-field"
                    value={editForm.ten_mien}
                    onChange={e => setEditForm(p => ({ ...p, ten_mien: e.target.value }))}
                    placeholder="VD: example.com"
                  />
                </div>

                {/* Trạng thái */}
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Trạng Thái</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[
                      { value: 'active',   label: 'Đang hoạt động', color: '#16a34a', bg: 'rgba(22,163,74,0.1)',   icon: <CheckCircle2 size={13} /> },
                      { value: 'inactive', label: 'Tạm dừng',       color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', icon: <PauseCircle size={13} /> },
                    ].map(opt => {
                      const active = editForm.status === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setEditForm(p => ({ ...p, status: opt.value }))}
                          style={{
                            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            padding: '9px 12px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                            fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
                            border: `1.5px solid ${active ? opt.color : 'var(--border)'}`,
                            background: active ? opt.bg : 'transparent',
                            color: active ? opt.color : 'var(--text-muted)',
                          }}
                        >
                          {opt.icon} {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

              </div>

              {/* Footer */}
              <div style={{
                display: 'flex', gap: 8, justifyContent: 'flex-end',
                padding: '16px 24px',
                borderTop: '1px solid var(--border)',
              }}>
                <button type="button" className="btn btn-outline" onClick={() => setEditing(null)}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving} style={{ gap: 6 }}>
                  {saving
                    ? <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> Đang lưu...</>
                    : <><Save size={13} /> Lưu thay đổi</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default HopDong;
