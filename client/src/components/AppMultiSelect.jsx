/**
 * AppMultiSelect — Multi-select dropdown dùng Radix Popover.
 * Trigger chiều cao cố định: hiện preview 1-2 tag + "+N khác".
 */
import * as Popover from '@radix-ui/react-popover';
import { ChevronDown, Check, X } from 'lucide-react';
import './AppMultiSelect.css';

export function AppMultiSelect({
  value = [],
  onChange,
  options = [],
  placeholder = 'Chọn...',
  disabled = false,
}) {
  const toggle = (val) => {
    onChange(value.includes(val) ? value.filter(v => v !== val) : [...value, val]);
  };

  const removeTag = (e, val) => {
    e.preventDefault();
    e.stopPropagation();
    onChange(value.filter(v => v !== val));
  };

  // Hiển thị tối đa 2 tag trong trigger, phần còn lại gộp thành "+N"
  const MAX_VISIBLE = 2;
  const visible = value.slice(0, MAX_VISIBLE);
  const hiddenCount = value.length - MAX_VISIBLE;

  return (
    <Popover.Root>
      <Popover.Trigger asChild disabled={disabled}>
        <button type="button" className="app-ms-trigger" style={{height:38}}>
          <span className="app-ms-body">
            {value.length === 0 ? (
              <span className="app-ms-placeholder">{placeholder}</span>
            ) : (
              <span className="app-ms-tags">
                {visible.map(v => {
                  const opt = options.find(o => o.value === v);
                  return (
                    <span key={v} className="app-ms-tag">
                      {opt?.label ?? v}
                      <span
                        role="button"
                        className="app-ms-tag-remove"
                        onPointerDown={e => removeTag(e, v)}
                      >
                        <X size={9} strokeWidth={2.5} />
                      </span>
                    </span>
                  );
                })}
                {hiddenCount > 0 && (
                  <span className="app-ms-tag app-ms-tag--more">
                    +{hiddenCount}
                  </span>
                )}
              </span>
            )}
          </span>
          <ChevronDown size={14} className="app-ms-chevron" />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className="app-ms-content"
          sideOffset={5}
          avoidCollisions
          onOpenAutoFocus={e => e.preventDefault()}
        >
          {/* Header: số đã chọn */}
          {value.length > 0 && (
            <div className="app-ms-header">
              <span>{value.length} đã chọn</span>
              <button
                type="button"
                className="app-ms-clear"
                onClick={() => onChange([])}
              >
                Bỏ chọn tất cả
              </button>
            </div>
          )}

          <div className="app-ms-list">
            {options.map(opt => {
              const checked = value.includes(opt.value);
              return (
                <div
                  key={opt.value}
                  className={`app-ms-item ${checked ? 'app-ms-item--checked' : ''}`}
                  onClick={() => toggle(opt.value)}
                >
                  <span className={`app-ms-checkbox ${checked ? 'app-ms-checkbox--checked' : ''}`}>
                    {checked && <Check size={10} strokeWidth={3} />}
                  </span>
                  {opt.label}
                </div>
              );
            })}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
