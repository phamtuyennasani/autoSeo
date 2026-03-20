import React, { createContext, useContext, useRef, useState } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState(null); // { title, message, confirmText, danger, resolve }
  const resolveRef = useRef(null);

  // Trả về Promise<boolean>
  const confirm = ({ title, message, confirmText = 'Xác nhận', cancelText = 'Hủy', danger = false }) =>
    new Promise((resolve) => {
      resolveRef.current = resolve;
      setDialog({ title, message, confirmText, cancelText, danger });
    });

  const handleConfirm = () => {
    resolveRef.current?.(true);
    setDialog(null);
  };

  const handleCancel = () => {
    resolveRef.current?.(false);
    setDialog(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {dialog && (
        <div
          className="modal-overlay"
          style={{ zIndex: 9999 }}
          onKeyDown={e => { if (e.key === 'Escape') handleCancel(); }}
        >
          <div
            className="modal-dialog"
            style={{ maxWidth: 420, padding: 0, overflow: 'hidden' }}
            role="alertdialog"
            aria-modal="true"
          >
            {/* Accent bar */}
            <div style={{
              height: 4,
              background: dialog.danger
                ? 'linear-gradient(90deg, var(--danger), #f87171)'
                : 'linear-gradient(90deg, var(--accent), var(--accent))',
            }} />

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '20px 22px 14px' }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: dialog.danger ? 'rgba(239,68,68,0.12)' : 'var(--accent-subtle)',
                color: dialog.danger ? 'var(--danger)' : 'var(--accent)',
              }}>
                {dialog.danger ? <Trash2 size={18} /> : <AlertTriangle size={18} />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 6 }}>
                  {dialog.title}
                </div>
                {dialog.message && (
                  <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    {dialog.message}
                  </div>
                )}
              </div>
              <button
                onClick={handleCancel}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, flexShrink: 0, lineHeight: 1 }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 22px 20px' }}>
              <button className="btn btn-outline" onClick={handleCancel}>
                {dialog.cancelText}
              </button>
              <button
                className="btn btn-primary"
                style={dialog.danger ? {
                  background: 'var(--danger)',
                  borderColor: 'var(--danger)',
                } : {}}
                onClick={handleConfirm}
                autoFocus
              >
                {dialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmContext);
