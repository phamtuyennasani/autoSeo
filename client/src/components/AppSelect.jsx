/**
 * AppSelect — Radix UI Select, styled theo design system của app.
 * Thay thế toàn bộ native <select> để có giao diện nhất quán.
 *
 * Props:
 *   value       string | number   — giá trị hiện tại
 *   onChange    (value: string) => void  — callback khi chọn
 *   options     { value, label }[]       — danh sách lựa chọn
 *   placeholder string            — text khi chưa chọn
 *   disabled    bool
 *   icon        ReactNode         — icon bên trái (optional)
 *   size        'md' | 'sm'       — md = form field, sm = toolbar compact
 *   active      bool              — highlight border accent khi đang filter
 *   style       object
 *   className   string
 */
import * as Select from '@radix-ui/react-select';
import { ChevronDown, Check } from 'lucide-react';
import './AppSelect.css';

// Radix không hỗ trợ empty string làm value → dùng sentinel
const EMPTY = '__empty__';
const toR  = v => (v === '' || v == null) ? EMPTY : String(v);
const fromR = v => v === EMPTY ? '' : v;

export function AppSelect({
  value = '',
  onChange,
  options = [],
  placeholder,
  disabled = false,
  icon = null,
  size = 'md',
  active = false,
  style = {},
  className = '',
}) {
  return (
    <Select.Root
      value={toR(value)}
      onValueChange={v => onChange(fromR(v))}
      disabled={disabled}
    >
      <Select.Trigger
        className={[
          'app-select-trigger',
          size === 'sm' ? 'app-select-sm' : '',
          active         ? 'app-select-active' : '',
          className,
        ].filter(Boolean).join(' ')}
        style={style}
      >
        {icon && <span className="app-select-left-icon">{icon}</span>}
        <Select.Value placeholder={placeholder} />
        <Select.Icon className="app-select-chevron" asChild>
          <ChevronDown size={size === 'sm' ? 13 : 14} />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content
          className="app-select-content"
          position="popper"
          sideOffset={5}
          avoidCollisions
        >
          <Select.ScrollUpButton className="app-select-scroll-btn">▲</Select.ScrollUpButton>
          <Select.Viewport className="app-select-viewport">
            {options.map(opt => (
              <Select.Item
                key={opt.value}
                value={toR(opt.value)}
                className="app-select-item"
              >
                <Select.ItemText>{opt.label}</Select.ItemText>
                <Select.ItemIndicator className="app-select-check">
                  <Check size={12} />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
          <Select.ScrollDownButton className="app-select-scroll-btn">▼</Select.ScrollDownButton>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
