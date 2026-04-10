// Inject inline styles vào các thẻ HTML sau khi markdown → HTML
// styles (optional) — object từ companies.article_styles để ghi đè default

function hexToRgba(hex, alpha) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return `rgba(99,102,241,${alpha})`;
  return `rgba(${r},${g},${b},${alpha})`;
}

function applyInlineStyles_OLD(html, styles = {}) {
  if (!html) return '';

  const s = {
    fontFamily:  styles.fontFamily  || "'Plus Jakarta Sans',sans-serif",
    fontSize:    styles.fontSize    || '16px',
    lineHeight:  styles.lineHeight  || '1.8',
    color:       styles.color       || 'var(--text-primary)',
    accentColor: styles.accentColor || null,
    h2FontSize:  styles.h2FontSize  || '20px',
    h2Color:     styles.h2Color     || 'var(--text-primary)',
    h3FontSize:  styles.h3FontSize  || '17px',
    h3Color:     styles.h3Color     || 'var(--text-primary)',
    h4FontSize:  styles.h4FontSize  || '15px',
    h4Color:     styles.h4Color     || 'var(--text-primary)',
  };

  const accent       = s.accentColor || 'var(--accent)';
  const accentSubtle = s.accentColor ? hexToRgba(s.accentColor, 0.1) : 'var(--accent-subtle)';
  const accentCode   = s.accentColor ? hexToRgba(s.accentColor, 0.12) : 'rgba(99,102,241,0.1)';
  const accentLight  = s.accentColor ? hexToRgba(s.accentColor, 0.75) : '#a78bfa';

  const hBase = `font-family:${s.fontFamily};font-weight:700;margin-bottom:0.6em;line-height:${s.lineHeight};`;

  // 1. Xử lý <pre><code> trước để tránh xung đột với inline code
  html = html.replace(/<pre(\s[^>]*)?>[\s\S]*?<\/pre>/gi, (match, preAttrs = '') => {
    return match
      .replace(/<pre(\s[^>]*)?>/, `<pre${preAttrs} style="background:var(--bg-root);border:1px solid var(--border);border-radius:var(--radius-md);padding:16px 20px;overflow-x:auto;margin:1.5em 0;">`)
      .replace(/<code([^>]*)>/, `<code$1 style="background:none;padding:0;color:var(--text-primary);font-size:13.5px;font-family:'Fira Code','Consolas',monospace;">`);
  });

  // 2. Headings
  html = html.replace(/<h1(\s[^>]*)?>/gi, (_, a = '') => `<h1${a} style="${hBase}font-size:26px;color:${s.h2Color};border-bottom:2px solid var(--border);padding-bottom:10px;">`);
  html = html.replace(/<h2(\s[^>]*)?>/gi, (_, a = '') => `<h2${a} style="${hBase}font-size:${s.h2FontSize};color:${s.h2Color};">`);
  html = html.replace(/<h3(\s[^>]*)?>/gi, (_, a = '') => `<h3${a} style="${hBase}font-size:${s.h3FontSize};color:${s.h3Color};">`);
  html = html.replace(/<h4(\s[^>]*)?>/gi, (_, a = '') => `<h4${a} style="${hBase}font-size:${s.h4FontSize};color:${s.h4Color};">`);

  // 3. Paragraph, list
  html = html.replace(/<p(\s[^>]*)?>/gi,  (_, a = '') => `<p${a} style="margin-bottom:1.2em;color:${s.color};font-size:${s.fontSize};line-height:${s.lineHeight};font-family:${s.fontFamily};">`);
  html = html.replace(/<ul(\s[^>]*)?>/gi, (_, a = '') => `<ul${a} style="padding-left:1.6em;margin-bottom:1.2em;">`);
  html = html.replace(/<ol(\s[^>]*)?>/gi, (_, a = '') => `<ol${a} style="padding-left:1.6em;margin-bottom:1.2em;">`);
  html = html.replace(/<li(\s[^>]*)?>/gi, (_, a = '') => `<li${a} style="margin-bottom:0.4em;color:${s.color};font-size:${s.fontSize};line-height:${s.lineHeight};">`);

  // 4. Blockquote
  html = html.replace(/<blockquote(\s[^>]*)?>/gi, (_, a = '') =>
    `<blockquote${a} style="border-left:3px solid ${accent};padding:10px 16px;margin:1.5em 0;background:${accentSubtle};border-radius:0 var(--radius-sm) var(--radius-sm) 0;color:${s.color};font-style:italic;">`);

  // 5. Inline code
  html = html.replace(/<code(\s[^>]*)?>/gi, (_, a = '') =>
    `<code${a} style="font-family:${s.fontFamily};font-size:13px;background:${accentCode};color:${accentLight};padding:2px 6px;border-radius:4px;">`);

  // 6. Inline formatting
  html = html.replace(/<strong(\s[^>]*)?>/gi, (_, a = '') => `<strong${a} style="font-weight:700;color:${s.color};">`);
  html = html.replace(/<em(\s[^>]*)?>/gi,     (_, a = '') => `<em${a} style="font-style:italic;color:${s.color};">`);
  html = html.replace(/<a(\s[^>]*)?>/gi,      (_, a = '') => `<a${a} style="color:${accent};text-decoration:underline;text-underline-offset:3px;">`);

  // 7. HR
  html = html.replace(/<hr(\s[^>]*)?>/gi, (_, a = '') => `<hr${a} style="border:none;border-top:1px solid gray;margin:2em 0;">`);

  // 8. Table
  html = html.replace(/<table(\s[^>]*)?>/gi, (_, a = '') => `<div class="table-responsive"><table${a} class="table table-striped" style="width:100%;border-collapse:collapse;margin:1.5em 0;font-size:14px;">`);
  html = html.replace(/<th(\s[^>]*)?>/gi,    (_, a = '') => `<th${a} style="padding:10px 14px;border:1px solid gray;text-align:left;background:#ffffff;font-weight:600;color:${s.color};">`);
  html = html.replace(/<\/table>/gi, () => `</table></div>`);
  html = html.replace(/<td(\s[^>]*)?>/gi,    (_, a = '') => `<td${a} style="padding:10px 14px;border:1px solid gray;text-align:left;color:${s.color};">`);
  // 9 .IMG
  html = html.replace(/<img(\s[^>]*)?>/gi, (_, a = '') => `<img${a} style="max-width:100%;height:auto;">`);
  return html;
}
function applyInlineStyles(html, styles = {}) {
  if (!html) return '';

  const s = {
    fontFamily:  styles.fontFamily  || "'Plus Jakarta Sans',sans-serif",
    fontSize:    styles.fontSize    || '16px',
    lineHeight:  styles.lineHeight  || '1.8',
    color:       styles.color       || 'var(--text-primary)',
    accentColor: styles.accentColor || null,
    h2FontSize:  styles.h2FontSize  || '20px',
    h2Color:     styles.h2Color     || 'var(--text-primary)',
    h3FontSize:  styles.h3FontSize  || '17px',
    h3Color:     styles.h3Color     || 'var(--text-primary)',
    h4FontSize:  styles.h4FontSize  || '15px',
    h4Color:     styles.h4Color     || 'var(--text-primary)',
  };

  const accent       = s.accentColor || 'var(--accent)';
  const accentSubtle = s.accentColor ? hexToRgba(s.accentColor, 0.1)  : 'var(--accent-subtle)';
  const accentCode   = s.accentColor ? hexToRgba(s.accentColor, 0.12) : 'rgba(99,102,241,0.1)';
  const accentLight  = s.accentColor ? hexToRgba(s.accentColor, 0.75) : '#a78bfa';

  const hBase = `font-family:${s.fontFamily};font-weight:700;margin-bottom:0.6em;line-height:${s.lineHeight};`;

  // 1. Xử lý <pre><code> trước để tránh xung đột với inline code
  html = html.replace(/<pre(\s[^>]*)?>[\s\S]*?<\/pre>/gi, (match, preAttrs = '') => {
    return match
      .replace(/<pre(\s[^>]*)?>/, (_, a = '') => {
        const attrs = (a || '').replace(/\bstyle="[^"]*"/gi, '').trim();
        return `<pre${attrs ? ' ' + attrs : ''} style="background:var(--bg-root);border:1px solid var(--border);border-radius:var(--radius-md);padding:16px 20px;overflow-x:auto;margin:1.5em 0;">`;
      })
      .replace(/<code([^>]*)>/, (_, a = '') => {
        const attrs = (a || '').replace(/\bstyle="[^"]*"/gi, '').trim();
        return `<code${attrs ? ' ' + attrs : ''} style="background:none;padding:0;color:var(--text-primary);font-size:13.5px;font-family:'Fira Code','Consolas',monospace;">`;
      });
  });

  // 2. Headings
  html = html.replace(/<h1(\s[^>]*)?>/gi, (_, a = '') => {
    const attrs = (a || '').replace(/\bstyle="[^"]*"/gi, '').trim();
    return `<h1${attrs ? ' ' + attrs : ''} style="${hBase}font-size:26px;color:${s.h2Color};border-bottom:2px solid var(--border);padding-bottom:10px;">`;
  });
  html = html.replace(/<h2(\s[^>]*)?>/gi, (_, a = '') => {
    const attrs = (a || '').replace(/\bstyle="[^"]*"/gi, '').trim();
    return `<h2${attrs ? ' ' + attrs : ''} style="${hBase}font-size:${s.h2FontSize};color:${s.h2Color};">`;
  });
  html = html.replace(/<h3(\s[^>]*)?>/gi, (_, a = '') => {
    const attrs = (a || '').replace(/\bstyle="[^"]*"/gi, '').trim();
    return `<h3${attrs ? ' ' + attrs : ''} style="${hBase}font-size:${s.h3FontSize};color:${s.h3Color};">`;
  });
  html = html.replace(/<h4(\s[^>]*)?>/gi, (_, a = '') => {
    const attrs = (a || '').replace(/\bstyle="[^"]*"/gi, '').trim();
    return `<h4${attrs ? ' ' + attrs : ''} style="${hBase}font-size:${s.h4FontSize};color:${s.h4Color};">`;
  });

  // 3. Paragraph, list
  html = html.replace(/<p(\s[^>]*)?>/gi, (_, a = '') => {
    const attrs = (a || '').replace(/\bstyle="[^"]*"/gi, '').trim();
    return `<p${attrs ? ' ' + attrs : ''} style="margin-bottom:1.2em;color:${s.color};font-size:${s.fontSize};line-height:${s.lineHeight};font-family:${s.fontFamily};">`;
  });
  html = html.replace(/<ul(\s[^>]*)?>/gi, (_, a = '') => {
    const attrs = (a || '').replace(/\bstyle="[^"]*"/gi, '').trim();
    return `<ul${attrs ? ' ' + attrs : ''} style="padding-left:1.6em;margin-bottom:1.2em;">`;
  });
  html = html.replace(/<ol(\s[^>]*)?>/gi, (_, a = '') => {
    const attrs = (a || '').replace(/\bstyle="[^"]*"/gi, '').trim();
    return `<ol${attrs ? ' ' + attrs : ''} style="padding-left:1.6em;margin-bottom:1.2em;">`;
  });
  html = html.replace(/<li(\s[^>]*)?>/gi, (_, a = '') => {
    const attrs = (a || '').replace(/\bstyle="[^"]*"/gi, '').trim();
    return `<li${attrs ? ' ' + attrs : ''} style="margin-bottom:0.4em;color:${s.color};font-size:${s.fontSize};line-height:${s.lineHeight};">`;
  });

  // 4. Blockquote
  html = html.replace(/<blockquote(\s[^>]*)?>/gi, (_, a = '') => {
    const attrs = (a || '').replace(/\bstyle="[^"]*"/gi, '').trim();
    return `<blockquote${attrs ? ' ' + attrs : ''} style="border-left:3px solid ${accent};padding:10px 16px;margin:1.5em 0;background:${accentSubtle};border-radius:0 var(--radius-sm) var(--radius-sm) 0;color:${s.color};font-style:italic;">`;
  });

  // 5. Inline code (chỉ áp dụng cho code ngoài pre, nhưng pre đã được xử lý ở bước 1)
  html = html.replace(/<code(\s[^>]*)?>/gi, (_, a = '') => {
    const attrs = (a || '').replace(/\bstyle="[^"]*"/gi, '').trim();
    return `<code${attrs ? ' ' + attrs : ''} style="font-family:${s.fontFamily};font-size:13px;background:${accentCode};color:${accentLight};padding:2px 6px;border-radius:4px;">`;
  });

  // 6. Inline formatting
  html = html.replace(/<strong(\s[^>]*)?>/gi, (_, a = '') => {
    const attrs = (a || '').replace(/\bstyle="[^"]*"/gi, '').trim();
    return `<strong${attrs ? ' ' + attrs : ''} style="font-weight:700;color:${s.color};">`;
  });
  html = html.replace(/<em(\s[^>]*)?>/gi, (_, a = '') => {
    const attrs = (a || '').replace(/\bstyle="[^"]*"/gi, '').trim();
    return `<em${attrs ? ' ' + attrs : ''} style="font-style:italic;color:${s.color};">`;
  });
  html = html.replace(/<a(\s[^>]*)?>/gi, (_, a = '') => {
    const attrs = (a || '').replace(/\bstyle="[^"]*"/gi, '').trim();
    return `<a${attrs ? ' ' + attrs : ''} style="color:${accent};text-decoration:underline;text-underline-offset:3px;">`;
  });

  // 7. HR
  html = html.replace(/<hr(\s[^>]*)?>/gi, (_, a = '') => {
    const attrs = (a || '').replace(/\bstyle="[^"]*"/gi, '').trim();
    return `<hr${attrs ? ' ' + attrs : ''} style="border:none;border-top:1px solid gray;margin:2em 0;">`;
  });

  // 8. Table
  html = html.replace(/<table(\s[^>]*)?>/gi, (_, a = '') => {
    const attrs = (a || '').replace(/\bclass="[^"]*"/gi, '').replace(/\bstyle="[^"]*"/gi, '').trim();
    return `<div class="table-responsive"><table${attrs ? ' ' + attrs : ''} class="table table-striped" style="width:100%;border-collapse:collapse;margin:1.5em 0;font-size:14px;">`;
  });
  html = html.replace(/<th(\s[^>]*)?>/gi, (_, a = '') => {
    const attrs = (a || '').replace(/\bstyle="[^"]*"/gi, '').trim();
    return `<th${attrs ? ' ' + attrs : ''} style="padding:10px 14px;border:1px solid gray;text-align:left;background:#ffffff;font-weight:600;color:${s.color};">`;
  });
  html = html.replace(/<td(\s[^>]*)?>/gi, (_, a = '') => {
    const attrs = (a || '').replace(/\bstyle="[^"]*"/gi, '').trim();
    return `<td${attrs ? ' ' + attrs : ''} style="padding:10px 14px;border:1px solid gray;text-align:left;color:${s.color};">`;
  });
  html = html.replace(/<\/table>/gi, '</table></div>');

  // 9. IMG
  html = html.replace(/<img(\s[^>]*)?>/gi, (_, a = '') => {
    const attrs = (a || '').replace(/\bstyle="[^"]*"/gi, '').trim();
    return `<img${attrs ? ' ' + attrs : ''} style="max-width:100%;height:auto;">`;
  });

  return html;
}
module.exports = { applyInlineStyles };
