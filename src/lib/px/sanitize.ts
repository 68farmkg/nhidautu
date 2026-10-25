// Làm sạch HTML của plugin bằng danh sách cho phép: tách thẻ rồi DỰNG LẠI từ thành phần đã kiểm tra (không dùng regex xóa).
const TAGS = new Set('div span p a b i u s em strong small br hr h1 h2 h3 h4 h5 h6 ul ol li table thead tbody tfoot tr th td caption img section article header footer nav blockquote code pre button figure figcaption details summary label'.split(' '));
const VOID = new Set(['br', 'hr', 'img']);
const ATTR = new Set(['class', 'title', 'alt', 'href', 'src', 'target', 'width', 'height', 'colspan', 'rowspan', 'role', 'style', 'type', 'open']);
const escA = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const unent = (s: string) => s.replace(/&#x([0-9a-f]+);?/gi, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/&#(\d+);?/g, (_, d) => String.fromCharCode(+d)).replace(/&(colon|tab|newline);/gi, (_, n) => (n.toLowerCase() === 'colon' ? ':' : ' '));
function okUrl(v: string, img = false): string {
  const u = unent(v).replace(/[\u0000-\u0020\u007f-\u009f]/g, '');
  if (/^https:\/\//i.test(u) || (/^\/(?!\/)/.test(u)) || u.startsWith('#')) return v.trim();
  if (!img && /^(mailto|tel):/i.test(u)) return v.trim();
  if (img && /^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+/=]+$/i.test(u)) return v.trim();
  return '';
}
function okStyle(v: string): string { const u = unent(v); return /url\s*\(|expression|@import|behavior|javascript|-moz-binding|position\s*:\s*fixed|[<>\\]/i.test(u) ? '' : v.trim().slice(0, 500); }

export function sanitizeHtml(html: string): string {
  const src = String(html || '').slice(0, 60000).replace(/<!--[\s\S]*?(-->|$)/g, '');
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/g;
  let out = '', last = 0, m: RegExpExecArray | null; const stack: string[] = [];
  const text = (t: string) => t.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  while ((m = re.exec(src))) {
    out += text(src.slice(last, m.index)); last = re.lastIndex;
    const close = !!m[1], tag = m[2].toLowerCase();
    if (!TAGS.has(tag)) continue; // thẻ lạ bị bỏ, nội dung chữ bên trong vẫn được giữ (đã escape)
    if (close) { const i = stack.lastIndexOf(tag); if (i >= 0) { while (stack.length > i) out += `</${stack.pop()}>`; } continue; }
    let attrs = '', href = false;
    const ar = /([^\s=/"'<>]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g; let a: RegExpExecArray | null;
    while ((a = ar.exec(m[3]))) {
      const k = a[1].toLowerCase(), v = a[3] ?? a[4] ?? a[5] ?? '';
      if (k.startsWith('on')) continue;
      if (k.startsWith('data-') && /^data-[a-z0-9-]{1,30}$/.test(k)) { attrs += ` ${k}="${escA(v.slice(0, 200))}"`; continue; }
      if (k.startsWith('aria-') && /^aria-[a-z-]{1,30}$/.test(k)) { attrs += ` ${k}="${escA(v.slice(0, 200))}"`; continue; }
      if (!ATTR.has(k)) continue;
      if (k === 'href') { const u = okUrl(v); if (u && tag === 'a') { attrs += ` href="${escA(u)}"`; href = true; } continue; }
      if (k === 'src') { const u = okUrl(v, true); if (u && tag === 'img') attrs += ` src="${escA(u)}"`; continue; }
      if (k === 'style') { const s = okStyle(v); if (s) attrs += ` style="${escA(s)}"`; continue; }
      if (k === 'type') { if (tag === 'button') attrs += ' type="button"'; continue; }
      if (k === 'target') { if (tag === 'a' && v === '_blank') attrs += ' target="_blank"'; continue; }
      attrs += ` ${k}="${escA(v.slice(0, 300))}"`;
    }
    if (tag === 'button' && !/type=/.test(attrs)) attrs += ' type="button"';
    if (tag === 'a' && href) attrs += ' rel="noopener nofollow"';
    if (tag === 'img') attrs += ' loading="lazy" referrerpolicy="no-referrer"';
    out += `<${tag}${attrs}>`;
    if (!VOID.has(tag)) stack.push(tag);
  }
  out += text(src.slice(last));
  while (stack.length) out += `</${stack.pop()}>`;
  return out;
}

// Mã JS/CSS không đáng tin chỉ chạy trong khung cách ly: sandbox="allow-scripts" (nguồn gốc rỗng: không cookie, không thấy admin),
// CSP chặn mọi kết nối mạng ra ngoài, chỉ cho ảnh https.
export function sandboxFrame(inner: string, height: number, title = 'Tiện ích'): string {
  const doc = `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src https: data:; font-src https: data:; media-src https:"><base target="_blank"><style>html,body{margin:0;font-family:system-ui,sans-serif}</style>${inner}`;
  const h = Math.min(1200, Math.max(40, Math.round(height) || 200));
  return `<iframe class="px-sandbox" title="${escA(title)}" sandbox="allow-scripts" referrerpolicy="no-referrer" loading="lazy" style="width:100%;height:${h}px;border:0;display:block" srcdoc="${escA(doc)}"></iframe>`;
}
