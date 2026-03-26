/**
 * FontPicker — Combobox chọn Google Font.
 * - Trigger là <input>: gõ tự lọc danh sách, blur thì lưu giá trị đang gõ (custom font)
 * - Chọn từ dropdown: lưu ngay
 * - Cùng visual style với AppSelect
 */
import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Type } from 'lucide-react';
import './FontPicker.css';

const MAX_VISIBLE = 60;

export function FontPicker({ value = '', onChange, fonts = [], loading = false, placeholder = 'Chọn hoặc nhập font...', style = {} }) {
  const [open, setOpen] = useState(false);
  const [inputVal, setInputVal] = useState(value);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Sync inputVal khi value thay đổi từ bên ngoài
  useEffect(() => { setInputVal(value); }, [value]);

  // Đóng khi click ngoài, lưu giá trị đang gõ
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        // Lưu custom value khi click ngoài
        const trimmed = inputVal.trim();
        if (trimmed !== value) onChange(trimmed);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [inputVal, value, onChange]);

  const filtered = inputVal
    ? fonts.filter(f => f.family.toLowerCase().includes(inputVal.toLowerCase())).slice(0, MAX_VISIBLE)
    : fonts.slice(0, MAX_VISIBLE);

  const select = (family) => {
    setInputVal(family);
    onChange(family);
    setOpen(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      const trimmed = inputVal.trim();
      onChange(trimmed);
      setOpen(false);
      inputRef.current?.blur();
    } else if (e.key === 'Escape') {
      setInputVal(value); // reset
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div ref={containerRef} className="font-picker" style={style}>
      {/* Trigger = input */}
      <div className={`font-picker-input-wrap${open ? ' font-picker-open' : ''}`}>
        <span className="font-picker-icon"><Type size={14} /></span>
        <input
          ref={inputRef}
          className="font-picker-input"
          style={{ fontFamily: inputVal || 'inherit' }}
          placeholder={placeholder}
          value={inputVal}
          onChange={e => { setInputVal(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="button"
          className="font-picker-chevron-btn"
          tabIndex={-1}
          onClick={() => { setOpen(v => !v); inputRef.current?.focus(); }}
        >
          <ChevronDown size={14} className={`app-select-chevron${open ? ' font-picker-chevron-open' : ''}`} />
        </button>
      </div>

      {/* Dropdown */}
      {open && (
        <div className="font-picker-dropdown">
          <div className="font-picker-list">
            {loading && <div className="font-picker-status">Đang tải danh sách font...</div>}

            {/* Reset về mặc định */}
            {!inputVal && (
              <button type="button" className={`font-picker-item${value === '' ? ' font-picker-item-selected' : ''}`} onClick={() => select('')}>
                <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>-- Mặc định --</span>
                {value === '' && <Check size={12} className="font-picker-check" />}
              </button>
            )}

            {/* Custom font nếu gõ không khớp chính xác */}
            {inputVal.trim() && !fonts.some(f => f.family.toLowerCase() === inputVal.trim().toLowerCase()) && (
              <button type="button" className="font-picker-custom-opt" onClick={() => select(inputVal.trim())}>
                <Type size={12} />
                Dùng font &nbsp;<strong>"{inputVal.trim()}"</strong>
              </button>
            )}

            {!loading && filtered.length === 0 && inputVal && (
              <div className="font-picker-status">Không tìm thấy trong Google Fonts</div>
            )}

            {filtered.map(f => (
              <button
                type="button"
                key={f.family}
                className={`font-picker-item${value === f.family ? ' font-picker-item-selected' : ''}`}
                style={{ fontFamily: f.family }}
                onMouseDown={e => { e.preventDefault(); select(f.family); }}
              >
                <span>{f.family}</span>
                {value === f.family && <Check size={12} className="font-picker-check" />}
              </button>
            ))}

            {!inputVal && fonts.length > MAX_VISIBLE && (
              <div className="font-picker-status" style={{ fontSize: 11 }}>
                Gõ để tìm thêm {fonts.length - MAX_VISIBLE} font...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
