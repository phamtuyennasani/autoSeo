import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Terminal, Wifi, WifiOff, Trash2, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

const WS_DEFAULT = `ws://${window.location.hostname}:3002`;

function escHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const LEVELS = ['all', 'log', 'info', 'warn', 'error'];

const LEVEL_STYLES = {
  log:   { badge: 'level-log',   entry: 'log-entry',   text: '#c9d1d9' },
  info:  { badge: 'level-info',  entry: 'log-entry info',  text: '#c9d1d9' },
  warn:  { badge: 'level-warn',  entry: 'log-entry warn',  text: '#e3b341' },
  error: { badge: 'level-error', entry: 'log-entry error', text: '#ffa198' },
};

const LEVEL_COLORS = {
  all:   '#58a6ff',
  log:   '#8b949e',
  info:  '#3fb950',
  warn:  '#d29922',
  error: '#f85149',
};

export default function ServerLogs() {
  const [wsUrl, setWsUrl]       = useState(WS_DEFAULT);
  const [connected, setConnected] = useState(false);
  const [statusText, setStatusText] = useState('Chưa kết nối');
  const [logs, setLogs]         = useState([]);
  const [filter, setFilter]     = useState('all');
  const [search, setSearch]     = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const wsRef    = useRef(null);
  const connRef  = useRef(null);
  const bottomRef = useRef(null);

  const counts = logs.reduce((acc, l) => {
    acc[l.level] = (acc[l.level] || 0) + 1;
    return acc;
  }, { log: 0, info: 0, warn: 0, error: 0 });

  // ── Connect / Disconnect ────────────────────────────────────────────────────────
  const connect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      return;
    }
    try {
      wsRef.current = new WebSocket(wsUrl.trim());
    } catch {
      setStatusText('URL không hợp lệ');
      return;
    }

    setStatusText('Đang kết nối…');

    wsRef.current.onopen = () => {
      setConnected(true);
      setStatusText('Đã kết nối: ' + wsUrl);
    };

    wsRef.current.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        setLogs(prev => [...prev.slice(-4999), data]);
      } catch {}
    };

    wsRef.current.onclose = () => {
      setConnected(false);
      wsRef.current = null;
      setStatusText('Mất kết nối — tự reconnect sau 3s…');
      connRef.current = setTimeout(connect, 3000);
    };

    wsRef.current.onerror = () => {
      setStatusText('Lỗi kết nối');
    };
  }, [wsUrl]);

  // ── Auto-scroll ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  // Cleanup on unmount
  useEffect(() => () => { clearTimeout(connRef.current); wsRef.current?.close(); }, []);

  // ── Filtered log entries ──────────────────────────────────────────────────────
  const filtered = logs.filter(l => {
    const matchLevel = filter === 'all' || filter === l.level;
    const matchSearch = !search || l.text?.toLowerCase().includes(search.toLowerCase());
    return matchLevel && matchSearch;
  });

  const lastLog = logs[logs.length - 1];

  // ── Format time ───────────────────────────────────────────────────────────────
  function fmtTime(iso) {
    try {
      const t = new Date(iso);
      return t.toLocaleTimeString('vi-VN') + '.' + String(t.getMilliseconds()).padStart(3, '0');
    } catch { return iso; }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="page-header">
      {/* ── Title row ── */}
      <div className="page-title-row" style={{ marginBottom: 24 }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Terminal size={22} />
            Server Log Dashboard
          </h1>
          <p className="page-subtitle">Theo dõi real-time logs từ server WebSocket <code style={{ fontSize: 12, background: 'rgba(99,102,241,0.12)', padding: '1px 6px', borderRadius: 4 }}>{wsUrl}</code></p>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Connection status */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--bg-panel)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)', padding: '7px 14px',
          }}>
            <div className={`status-dot-root ${connected ? 'connected' : ''}`} />
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{statusText}</span>
          </div>

          {/* Connect / Disconnect */}
          <button
            className={`btn btn-sm ${connected ? 'btn-outline' : 'btn-primary'}`}
            onClick={connect}
          >
            {connected ? <><WifiOff size={13} /> Ngắt kết nối</> : <><Wifi size={13} /> Kết nối</>}
          </button>

          {/* WS URL gear */}
          <button
            className="btn btn-ghost btn-sm btn-icon"
            onClick={() => setShowSettings(s => !s)}
            title="Cài đặt WebSocket URL"
          >
            <RefreshCw size={14} style={{ transform: showSettings ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>

          {/* Clear */}
          <button className="btn btn-ghost btn-sm" onClick={() => setLogs([])} title="Xóa logs">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* ── WS URL settings ── */}
      {showSettings && (
        <div className="info-box info-box-blue" style={{ marginBottom: 20 }}>
          <span style={{ fontSize: 14, fontWeight: 600, minWidth: 80 }}>WS URL</span>
          <input
            className="input-field"
            style={{ flex: 1, fontSize: 13 }}
            value={wsUrl}
            onChange={e => setWsUrl(e.target.value)}
            placeholder="ws://your-server-ip:3002"
            onKeyDown={e => e.key === 'Enter' && connect()}
          />
          <button className="btn btn-primary btn-sm" onClick={connect} disabled={connected}>
            <Wifi size={13} /> Kết nối
          </button>
        </div>
      )}

      {/* ── Toolbar ── */}
      <div style={{
        display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
        background: 'var(--bg-panel)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: 16,
      }}>
        {/* Filter badges */}
        <div style={{ display: 'flex', gap: 6 }}>
          {LEVELS.map(lvl => (
            <button
              key={lvl}
              className={`filter-btn-root ${filter === lvl ? 'active' : ''}`}
              data-level={lvl}
              onClick={() => setFilter(lvl)}
            >
              {lvl === 'all' ? 'Tất cả' : lvl.toUpperCase()}
              {lvl !== 'all' && (
                <span style={{ marginLeft: 5, fontSize: 10, opacity: 0.7 }}>
                  {counts[lvl] || 0}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search */}
        <input
          className="input-field"
          style={{ width: 220, fontSize: 13, padding: '6px 12px', marginLeft: 'auto' }}
          placeholder="🔍 Tìm kiếm log…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        {/* Stats */}
        <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-secondary)', alignItems: 'center' }}>
          <span>Tổng <strong style={{ color: 'var(--text-primary)' }}>{logs.length}</strong></span>
          <span style={{ color: '#3fb950' }}>INFO <strong>{counts.info || 0}</strong></span>
          <span style={{ color: '#d29922' }}>WARN <strong>{counts.warn || 0}</strong></span>
          <span style={{ color: '#f85149' }}>ERR <strong>{counts.error || 0}</strong></span>
        </div>

        {/* Auto scroll toggle */}
        <button
          onClick={() => setAutoScroll(s => !s)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 12, color: 'var(--text-secondary)', background: 'none', border: 'none',
            cursor: 'pointer', padding: '4px 8px', borderRadius: 6,
            background: autoScroll ? 'rgba(99,102,241,0.1)' : 'transparent',
          }}
          title={autoScroll ? 'Tắt auto scroll' : 'Bật auto scroll'}
        >
          {autoScroll ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
          Auto scroll
        </button>
      </div>

      {/* ── Log container ── */}
      <div className="log-container-root" style={{ background: '#0d1117', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', height: 'calc(100vh - 280px)', minHeight: 400 }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#484f58' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📡</div>
            <div style={{ fontSize: 15 }}>
              {logs.length === 0
                ? <>Nhấn <strong style={{ color: '#58a6ff' }}>Kết nối</strong> để nhận logs từ server</>
                : <>Không có log nào khớp filter / tìm kiếm</>
              }
            </div>
          </div>
        ) : (
          filtered.map((entry, i) => {
            const s = LEVEL_STYLES[entry.level] || LEVEL_STYLES.log;
            return (
              <div
                key={i}
                className={s.entry}
                style={{ padding: '3px 10px', borderLeft: `3px solid ${
                  entry.level === 'warn' ? '#d29922' :
                  entry.level === 'error' ? '#f85149' :
                  entry.level === 'info' ? '#3fb950' : '#30363d'
                }` }}
              >
                <span style={{ color: '#484f58', fontSize: 11, fontFamily: 'Consolas,Monaco,monospace', whiteSpace: 'nowrap', marginRight: 10 }}>
                  {fmtTime(entry.time)}
                </span>
                <span
                  className={`log-level-root ${s.badge}`}
                  style={{ fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 3, marginRight: 10, flexShrink: 0 }}
                >
                  {(entry.level || 'log').toUpperCase()}
                </span>
                <span style={{ color: s.text, fontSize: 12.5, fontFamily: 'Consolas,Monaco,monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.6 }}>
                  {escHtml(entry.text || '')}
                </span>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Footer bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '8px 16px', fontSize: 11, color: '#484f58',
        background: '#161b22', border: '1px solid #30363d',
        borderTop: 'none', borderRadius: '0 0 var(--radius-lg) var(--radius-lg)',
      }}>
        <span>{logs.length} dòng</span>
        <span style={{ marginLeft: 'auto' }}>
          {lastLog ? fmtTime(lastLog.time) : ''}
        </span>
        {connected && (
          <span style={{ color: '#3fb950', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, background: '#3fb950', borderRadius: '50%', display: 'block' }} />
            Live
          </span>
        )}
      </div>
    </div>
  );
}
