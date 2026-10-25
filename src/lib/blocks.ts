import { all, first, CATS, fmtNum, fmtPct, renderContent } from './util';
import { icon, ICONS } from './icons';
import { safeUrl } from './site';
import { PLUGINS } from './plugins';
import { blockDefs } from './px/registry';
import { sandboxFrame } from './px/sanitize';

export type Field = { k: string; label: string; type?: 'text' | 'textarea' | 'number' | 'select' | 'color' | 'check' | 'datetime'; options?: [string, string][]; def?: any; hint?: string };
export type Ctx = { db: any; defs?: Record<string, BlockDef> };
export type BlockDef = { type: string; label: string; icon: string; group: string; fields: Field[]; full?: boolean; container?: 'list' | 'cols'; admin?: boolean; render: (p: any, ctx: Ctx, kids?: any) => string | Promise<string> };
export type Block = { id: string; type: string; props: Record<string, any>; style: Record<string, any>; children?: Block[]; cols?: Block[][] };

import { esc } from './esc';
export { esc };
const url = (s: any) => esc(safeUrl(String(s || '')));
const col = (s: any) => (/^(#[0-9a-f]{3,8}|[a-z]+|rgba?\([\d\s.,%]+\))$/i.test(String(s || '').trim()) ? String(s).trim() : '');
const num = (s: any, d: number, min = 0, max = 9999) => Math.min(max, Math.max(min, Number(s) || d));
const lines = (s: any) => String(s || '').split('\n').map((x) => x.trim()).filter(Boolean);
const rawHttps = (s: any) => (/^https:\/\//i.test(String(s || '').trim()) ? String(s).trim() : '');
const httpsOnly = (s: any) => esc(rawHttps(s));
// Dùng trong url('...') của CSS: mã hóa ký tự có thể thoát khỏi chuỗi
const cssUrl = (s: any) => { const r = rawHttps(s); return r ? esc(r.replace(/['"()\\\s<>]/g, (c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))) : ''; };
export const LAYOUTS: [string, string][] = [['12', '1 cột'], ['6-6', '2 cột đều (1/2 + 1/2)'], ['4-8', '1/3 + 2/3'], ['8-4', '2/3 + 1/3'], ['3-9', '1/4 + 3/4'], ['9-3', '3/4 + 1/4'], ['4-4-4', '3 cột đều'], ['3-6-3', 'Giữa rộng (1/4 + 1/2 + 1/4)'], ['3-3-3-3', '4 cột đều'], ['2-2-2-2-2-2', '6 cột đều']];
export const parseLayout = (s: any): number[] => { const a = String(s || '6-6').split('-').map(Number).filter((n) => n >= 1 && n <= 12); return a.length && a.reduce((x, y) => x + y, 0) <= 12 ? a : [12]; };
const ALIGN: [string, string][] = [['left', 'Trái'], ['center', 'Giữa'], ['right', 'Phải']];

function embedSrc(u: string) {
  const s = u.trim();
  let m = s.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,15})/);
  if (m) return `https://www.youtube-nocookie.com/embed/${m[1]}`;
  m = s.match(/vimeo\.com\/(\d+)/);
  if (m) return `https://player.vimeo.com/video/${m[1]}`;
  return /^https:\/\//i.test(s) ? s : '';
}

const CORE: BlockDef[] = [
  { type: 'heading', label: 'Tiêu đề', icon: 'file', group: 'Nội dung', fields: [
    { k: 'text', label: 'Chữ tiêu đề' }, { k: 'sub', label: 'Dòng phụ (tùy chọn)' },
    { k: 'tag', label: 'Cỡ', type: 'select', options: [['h1', 'H1 lớn nhất'], ['h2', 'H2'], ['h3', 'H3'], ['h4', 'H4']], def: 'h2' }],
    render: (p) => { const t = ['h1', 'h2', 'h3', 'h4'].includes(p.tag) ? p.tag : 'h2'; return `<${t} class="b-h">${esc(p.text)}</${t}>${p.sub ? `<p class="b-sub">${esc(p.sub)}</p>` : ''}`; } },
  { type: 'text', label: 'Văn bản', icon: 'list', group: 'Nội dung', fields: [
    { k: 'text', label: 'Nội dung', type: 'textarea', hint: '## đề mục · "- " gạch đầu dòng · [ảnh:https://…] chèn ảnh · cách đoạn bằng dòng trống' }],
    render: (p) => `<div class="b-text art-body">${renderContent(p.text)}</div>` },
  { type: 'image', label: 'Ảnh', icon: 'image', group: 'Nội dung', fields: [
    { k: 'src', label: 'Link ảnh (https://…)' }, { k: 'alt', label: 'Mô tả ảnh' }, { k: 'link', label: 'Bấm vào ảnh mở link (tùy chọn)' },
    { k: 'radius', label: 'Bo góc (px)', type: 'number', def: 10 }],
    render: (p) => { const s = httpsOnly(p.src); if (!s) return ''; const im = `<img src="${s}" alt="${esc(p.alt)}" loading="lazy" referrerpolicy="no-referrer" style="border-radius:${num(p.radius, 10, 0, 60)}px;width:100%">`; return p.link ? `<a href="${url(p.link)}">${im}</a>` : im; } },
  { type: 'button', label: 'Nút bấm', icon: 'link', group: 'Nội dung', fields: [
    { k: 'label', label: 'Chữ trên nút', def: 'Xem thêm' }, { k: 'url', label: 'Liên kết', def: '/' },
    { k: 'kind', label: 'Kiểu', type: 'select', options: [['solid', 'Đặc'], ['ghost', 'Viền']], def: 'solid' },
    { k: 'newtab', label: 'Mở tab mới', type: 'check' }],
    render: (p) => `<a class="btn ${p.kind === 'ghost' ? 'ghost' : ''}" href="${url(p.url)}"${p.newtab ? ' target="_blank" rel="noopener"' : ''}>${esc(p.label)}</a>` },
  { type: 'banner', label: 'Banner', icon: 'layers', group: 'Nội dung', full: true, fields: [
    { k: 'title', label: 'Tiêu đề lớn' }, { k: 'text', label: 'Mô tả' }, { k: 'image', label: 'Ảnh nền (https://…)' },
    { k: 'bg', label: 'Màu nền khi không có ảnh', type: 'color', def: '#0c4a43' }, { k: 'dark', label: 'Độ tối lớp phủ (0-90)', type: 'number', def: 45 },
    { k: 'height', label: 'Chiều cao (px)', type: 'number', def: 360 }, { k: 'align', label: 'Căn chữ', type: 'select', options: ALIGN, def: 'left' },
    { k: 'btn', label: 'Chữ nút' }, { k: 'btn_url', label: 'Liên kết nút' }],
    render: (p) => { const im = cssUrl(p.image); const bg = im ? `url('${im}') center/cover` : col(p.bg) || '#0c4a43';
      return `<div class="b-banner" style="min-height:${num(p.height, 360, 120, 900)}px;background:${bg};text-align:${['left', 'center', 'right'].includes(p.align) ? p.align : 'left'}"><div class="b-ov" style="background:rgba(0,0,0,${num(p.dark, 45, 0, 90) / 100})"></div><div class="wrap b-in"><h2>${esc(p.title)}</h2>${p.text ? `<p>${esc(p.text)}</p>` : ''}${p.btn ? `<a class="btn" href="${url(p.btn_url)}">${esc(p.btn)}</a>` : ''}</div></div>`; } },
  { type: 'iconbox', label: 'Hộp biểu tượng', icon: 'star', group: 'Nội dung', fields: [
    { k: 'icon', label: 'Biểu tượng', type: 'select', options: Object.keys(ICONS).map((k) => [k, k] as [string, string]), def: 'star' },
    { k: 'title', label: 'Tiêu đề' }, { k: 'text', label: 'Mô tả', type: 'textarea' }, { k: 'url', label: 'Liên kết (tùy chọn)' }],
    render: (p) => { const h = `<div class="b-ib"><span class="b-ibi">${icon(p.icon || 'star', 26)}</span><b>${esc(p.title)}</b><p>${esc(p.text)}</p></div>`; return p.url ? `<a href="${url(p.url)}">${h}</a>` : h; } },
  { type: 'testimonial', label: 'Đánh giá khách hàng', icon: 'message', group: 'Nội dung', fields: [
    { k: 'quote', label: 'Lời nhận xét', type: 'textarea' }, { k: 'name', label: 'Tên' }, { k: 'role', label: 'Chức danh' }],
    render: (p) => `<blockquote class="b-q"><p>“${esc(p.quote)}”</p><footer><b>${esc(p.name)}</b> ${esc(p.role)}</footer></blockquote>` },
  { type: 'accordion', label: 'Hỏi đáp (thu gọn)', icon: 'list', group: 'Nội dung', fields: [
    { k: 'items', label: 'Mỗi dòng một mục: Câu hỏi | Trả lời', type: 'textarea', def: 'Câu hỏi 1 | Trả lời 1\nCâu hỏi 2 | Trả lời 2' }],
    render: (p) => lines(p.items).map((l) => { const [q, ...a] = l.split('|'); return `<details class="b-acc"><summary>${esc(q)}</summary><p>${esc(a.join('|').trim())}</p></details>`; }).join('') },
  { type: 'gallery', label: 'Thư viện ảnh', icon: 'grid', group: 'Nội dung', fields: [
    { k: 'urls', label: 'Mỗi dòng một link ảnh (https://…)', type: 'textarea' }, { k: 'cols', label: 'Số cột (điện thoại luôn 2)', type: 'number', def: 3 }],
    render: (p) => `<div class="b-gal" style="--c:${num(p.cols, 3, 1, 6)}">${lines(p.urls).map(httpsOnly).filter(Boolean).map((s) => `<img src="${s}" alt="" loading="lazy" referrerpolicy="no-referrer">`).join('')}</div>` },
  { type: 'spacer', label: 'Khoảng trống / đường kẻ', icon: 'more', group: 'Bố cục', fields: [
    { k: 'h', label: 'Chiều cao (px)', type: 'number', def: 24 }, { k: 'line', label: 'Hiện đường kẻ', type: 'check' }],
    render: (p) => `<div style="height:${num(p.h, 24, 0, 400)}px;display:flex;align-items:center">${p.line ? '<hr class="b-hr">' : ''}</div>` },
  { type: 'embed', label: 'Nhúng video / iframe', icon: 'play', group: 'Nhúng', fields: [
    { k: 'url', label: 'Link YouTube, Vimeo hoặc trang https://…' }, { k: 'ratio', label: 'Tỉ lệ', type: 'select', options: [['16/9', '16:9'], ['4/3', '4:3'], ['1/1', 'Vuông'], ['9/16', 'Dọc']], def: '16/9' }],
    render: (p) => { const s = embedSrc(String(p.url || '')); return s ? `<div class="b-emb" style="aspect-ratio:${['16/9', '4/3', '1/1', '9/16'].includes(p.ratio) ? p.ratio : '16/9'}"><iframe src="${esc(s)}" loading="lazy" allowfullscreen referrerpolicy="no-referrer-when-downgrade" sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-forms"></iframe></div>` : ''; } },
  { type: 'map', label: 'Bản đồ Google', icon: 'map', group: 'Nhúng', fields: [
    { k: 'q', label: 'Địa chỉ cần hiện' }, { k: 'height', label: 'Chiều cao (px)', type: 'number', def: 320 }],
    render: (p) => p.q ? `<iframe class="b-map" style="height:${num(p.height, 320, 120, 900)}px" loading="lazy" src="https://www.google.com/maps?q=${encodeURIComponent(String(p.q))}&output=embed"></iframe>` : '' },
  { type: 'html', label: 'Mã HTML tự do', icon: 'code', group: 'Nhúng', admin: true, fields: [
    { k: 'code', label: 'HTML / CSS / JavaScript', type: 'textarea', hint: 'Chạy nguyên văn. Chỉ dán mã bạn tin tưởng.' }],
    render: (p) => String(p.code || '') },
  { type: 'widget', label: 'Tiện ích đã tạo', icon: 'puzzle', group: 'Nhúng', admin: true, fields: [
    { k: 'id', label: 'Số hiệu tiện ích (xem ở Admin > Tiện ích)', type: 'number' }, { k: 'vars', label: 'Ghi đè biến, mỗi dòng: ten=gia tri', type: 'textarea' }],
    render: async (p, c) => { const w = await first(c.db, 'SELECT code,vars FROM widgets WHERE id=?', Number(p.id) || 0); if (!w) return '<p class="meta">Tiện ích không tồn tại.</p>';
      const v: Record<string, string> = {}; for (const l of [...lines(w.vars), ...lines(p.vars)]) { const i = l.indexOf('='); if (i > 0) v[l.slice(0, i).trim()] = l.slice(i + 1).trim(); }
      const body = String(w.code || '').replace(/\{\{\s*([\w-]+)\s*\}\}/g, (_: string, k: string) => esc(v[k] ?? ''));
      // Chế độ "cách ly" (_mode=sandbox): chạy trong khung sandbox không cookie, không thấy admin, không gọi được mạng.
      return v._mode === 'sandbox' ? sandboxFrame(body, Number(v._height) || 300, 'Tiện ích #' + (p.id || '')) : body; } },
  { type: 'countdown', label: 'Đồng hồ đếm ngược', icon: 'clock', group: 'Chức năng', fields: [
    { k: 'to', label: 'Thời điểm kết thúc', type: 'datetime' }, { k: 'label', label: 'Lời dẫn', def: 'Còn lại' }],
    render: (p) => { const id = 'cd' + Math.random().toString(36).slice(2, 8); const t = p.to ? Date.parse(String(p.to) + ':00+07:00') : 0; if (!t) return '';
      return `<div class="b-cd"><small>${esc(p.label)}</small><b id="${id}">…</b></div><script>(function(){var e=document.getElementById('${id}'),t=${t};function f(){var s=Math.max(0,Math.floor((t-Date.now())/1000)),d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60);e.textContent=d+' ngày '+h+' giờ '+m+' phút '+(s%60)+' giây'}f();setInterval(f,1000)})()</script>`; } },
  { type: 'search', label: 'Ô tìm kiếm', icon: 'search', group: 'Chức năng', fields: [{ k: 'ph', label: 'Gợi ý trong ô', def: 'Tìm mã cổ phiếu, bài viết…' }],
    render: (p) => `<form class="b-search" action="/tim-kiem" method="get"><input type="search" name="q" placeholder="${esc(p.ph)}" aria-label="Tìm kiếm"><button class="btn" type="submit">Tìm</button></form>` },
  { type: 'posts', label: 'Danh sách bài viết', icon: 'news', group: 'Chức năng', fields: [
    { k: 'cat', label: 'Chuyên mục', type: 'select', options: [['', 'Tất cả'], ...Object.entries(CATS)] }, { k: 'count', label: 'Số bài', type: 'number', def: 6 },
    { k: 'layout', label: 'Kiểu hiển thị', type: 'select', options: [['grid', 'Lưới thẻ'], ['list', 'Danh sách']], def: 'grid' }, { k: 'title', label: 'Tiêu đề khối (tùy chọn)' }],
    render: async (p, c) => { const w = ["status='published'", 'published_at <= ?']; const a: any[] = [new Date().toISOString()]; if (p.cat && CATS[p.cat]) { w.push('category=?'); a.push(p.cat); }
      const rows = await all(c.db, `SELECT slug,title,summary,image,category,published_at FROM posts WHERE ${w.join(' AND ')} ORDER BY published_at DESC LIMIT ${num(p.count, 6, 1, 24)}`, ...a);
      const cards = rows.map((r) => `<a class="b-pc" href="/bai-viet/${esc(r.slug)}"><div class="im">${r.image ? `<img src="${esc(r.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}</div><div><h3>${esc(r.title)}</h3>${r.summary ? `<p>${esc(r.summary)}</p>` : ''}<span class="tag">${esc(CATS[r.category] || r.category)}</span></div></a>`).join('');
      return (p.title ? `<h2 class="b-h">${esc(p.title)}</h2>` : '') + `<div class="b-posts ${p.layout === 'list' ? 'list' : ''}">${cards || '<p class="meta">Chưa có bài viết.</p>'}</div>`; } },
  { type: 'categories', label: 'Chuyên mục', icon: 'tag', group: 'Chức năng', fields: [],
    render: () => `<div class="tools">${Object.entries(CATS).map(([k, n]) => `<a href="/chuyen-muc/${k}">${esc(n)}</a>`).join('')}</div>` },

  // ===== Khối chứa (lồng khối): Section > Hàng cột > Khối =====
  { type: 'section', label: 'Section (vùng nền)', icon: 'layers', group: 'Bố cục', container: 'list', full: true, fields: [
    { k: 'bg', label: 'Màu nền', type: 'color' }, { k: 'image', label: 'Ảnh nền (https://…, tùy chọn)' },
    { k: 'dark', label: 'Độ tối lớp phủ lên ảnh (0-90)', type: 'number', def: 0 },
    { k: 'py', label: 'Đệm trên/dưới (px)', type: 'number', def: 40 }, { k: 'minh', label: 'Chiều cao tối thiểu (px, 0 = tự động)', type: 'number', def: 0 },
    { k: 'light', label: 'Chữ sáng (dùng khi nền tối)', type: 'check' },
    { k: 'inner', label: 'Độ rộng nội dung', type: 'select', options: [['wide', 'Vừa khung website'], ['full', 'Tràn hết chiều ngang']], def: 'wide' }],
    render: (p, _c, kids) => { const im = cssUrl(p.image), bg = col(p.bg), dk = num(p.dark, 0, 0, 90);
      const st = [`padding-block:${num(p.py, 40, 0, 300)}px`, p.minh ? `min-height:${num(p.minh, 0, 0, 1200)}px` : '', im ? `background:url('${im}') center/cover` : bg ? `background:${bg}` : ''].filter(Boolean).join(';');
      return `<section class="b-sec${p.light ? ' light' : ''}${p.inner === 'full' ? ' inner-full' : ''}" style="${st}">${im && dk ? `<div class="b-ov" style="background:rgba(0,0,0,${dk / 100})"></div>` : ''}<div class="b-secin">${kids || ''}</div></section>`; } },
  { type: 'columns', label: 'Hàng cột', icon: 'grid', group: 'Bố cục', container: 'cols', fields: [
    { k: 'layout', label: 'Chia cột', type: 'select', options: LAYOUTS, def: '6-6' },
    { k: 'gap', label: 'Khoảng cách giữa các cột (px)', type: 'number', def: 16 },
    { k: 'mobile', label: 'Trên điện thoại', type: 'select', options: [['stack', 'Xếp chồng từng cột'], ['keep', 'Giữ cạnh nhau']], def: 'stack' },
    { k: 'valign', label: 'Căn dọc', type: 'select', options: [['start', 'Trên'], ['center', 'Giữa'], ['end', 'Dưới']], def: 'start' }],
    render: (p, _c, kids) => { const parts = parseLayout(p.layout), k: string[] = Array.isArray(kids) ? kids : [];
      return `<div class="b-cols${p.mobile === 'keep' ? ' keep' : ''}" style="gap:${num(p.gap, 16, 0, 80)}px;align-items:${['start', 'center', 'end'].includes(p.valign) ? p.valign : 'start'}">${parts.map((n, i) => `<div class="b-col" style="grid-column:span ${n}">${k[i] || ''}</div>`).join('')}</div>`; } },
  { type: 'card', label: 'Khung thẻ', icon: 'file', group: 'Bố cục', container: 'list', fields: [
    { k: 'bg', label: 'Màu nền', type: 'color', def: '#ffffff' }, { k: 'pad', label: 'Đệm trong (px)', type: 'number', def: 18 },
    { k: 'radius', label: 'Bo góc (px)', type: 'number', def: 12 }, { k: 'border', label: 'Có viền', type: 'check', def: true }, { k: 'shadow', label: 'Có bóng đổ', type: 'check' }],
    render: (p, _c, kids) => `<div class="b-card" style="background:${col(p.bg) || '#fff'};padding:${num(p.pad, 18, 0, 80)}px;border-radius:${num(p.radius, 12, 0, 60)}px;${p.border === false ? '' : 'border:1px solid var(--line);'}${p.shadow ? 'box-shadow:0 8px 24px rgba(0,0,0,.08)' : ''}">${kids || ''}</div>` },
  // ===== Khối mới Đợt 3-4 =====
  { type: 'slider', label: 'Slider (trình chiếu ảnh)', icon: 'image', group: 'Nội dung', full: true, fields: [
    { k: 'slides', label: 'Mỗi dòng một slide: link ảnh | tiêu đề | mô tả | chữ nút | link nút', type: 'textarea', def: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1600 | Đầu tư thông minh | Dữ liệu thị trường mỗi ngày | Xem ngay | /thi-truong' },
    { k: 'height', label: 'Chiều cao (px)', type: 'number', def: 380 }, { k: 'auto', label: 'Tự chuyển slide sau (giây, 0 = tắt)', type: 'number', def: 5 },
    { k: 'dark', label: 'Độ tối lớp phủ (0-90)', type: 'number', def: 35 }],
    render: (p) => {
      const sl = lines(p.slides).slice(0, 12).map((l) => l.split('|').map((x) => x.trim())).map(([im, t, tx, bt, bu]) => ({ im: cssUrl(im), t: t || '', tx: tx || '', bt: bt || '', bu: bu || '' })).filter((x) => x.im || x.t);
      if (!sl.length) return '';
      const id = 'sl' + Math.random().toString(36).slice(2, 8), auto = num(p.auto, 5, 0, 60), dk = num(p.dark, 35, 0, 90) / 100;
      const items = sl.map((x) => `<div class="b-sl-s" style="background:${x.im ? `url('${x.im}') center/cover` : '#0c4a43'}"><div class="b-ov" style="background:rgba(0,0,0,${dk})"></div><div class="b-sl-c">${x.t ? `<h3>${esc(x.t)}</h3>` : ''}${x.tx ? `<p>${esc(x.tx)}</p>` : ''}${x.bt ? `<a class="btn" href="${url(x.bu)}">${esc(x.bt)}</a>` : ''}</div></div>`).join('');
      const nav = sl.length > 1 ? `<button type="button" class="pv" aria-label="Trước">‹</button><button type="button" class="nx" aria-label="Sau">›</button><div class="b-sl-d">${sl.map((_, i) => `<i${i ? '' : ' class="on"'}></i>`).join('')}</div>` : '';
      const js = `(function(){var r=document.getElementById('${id}'),t=r.querySelector('.b-sl-t'),n=t.children.length,i=0,tm;function dots(){r.querySelectorAll('.b-sl-d i').forEach(function(d,k){d.className=k===i?'on':''})}function go(k){i=(k+n)%n;t.scrollTo({left:i*t.clientWidth,behavior:'smooth'});dots()}t.addEventListener('scroll',function(){var k=Math.round(t.scrollLeft/t.clientWidth);if(k!==i){i=k;dots()}});var pv=r.querySelector('.pv'),nx=r.querySelector('.nx');if(pv){pv.onclick=function(){go(i-1)};nx.onclick=function(){go(i+1)}}r.querySelectorAll('.b-sl-d i').forEach(function(d,k){d.onclick=function(){go(k)}});function play(){clearInterval(tm);if(${auto}&&n>1)tm=setInterval(function(){go(i+1)},${auto}*1000)}r.addEventListener('mouseenter',function(){clearInterval(tm)});r.addEventListener('mouseleave',play);r.addEventListener('touchstart',function(){clearInterval(tm)},{passive:true});play()})()`;
      return `<div class="b-sl" id="${id}" style="height:${num(p.height, 380, 160, 900)}px"><div class="b-sl-t">${items}</div>${nav}</div><script>${js}</script>`; } },
  { type: 'contactform', label: 'Biểu mẫu liên hệ', icon: 'mail', group: 'Chức năng', fields: [{ k: 'title', label: 'Tiêu đề', def: 'Gửi liên hệ cho chúng tôi' }, { k: 'btn', label: 'Chữ nút gửi', def: 'Gửi liên hệ' }],
    render: (p) => `<form class="b-cf box" method="post" action="/lien-he">${p.title ? `<h3>${esc(p.title)}</h3>` : ''}<label>Họ và tên<input type="text" name="name" required maxlength="100"></label><label>Email<input type="email" name="email" required maxlength="150"></label><label>Số điện thoại<input type="text" name="phone" maxlength="30"></label><label>Nội dung<textarea name="body" required maxlength="3000"></textarea></label><input type="text" name="website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true"><p><button class="btn" type="submit">${esc(p.btn || 'Gửi liên hệ')}</button></p></form>` },
  { type: 'chatbtn', label: 'Nút mở chat', icon: 'message', group: 'Chức năng', fields: [{ k: 'label', label: 'Chữ trên nút', def: 'Chat với chúng tôi' }],
    render: (p) => `<button type="button" class="btn" data-open-chat>${esc(p.label || 'Chat với chúng tôi')}</button>` },
];

export const allDefs = (): BlockDef[] => [...CORE, ...PLUGINS.flatMap((p) => p.blocks || [])];
export const defMap = () => Object.fromEntries(allDefs().map((d) => [d.type, d]));
// Khối đang dùng được = lõi + plugin ĐANG BẬT (cả plugin mã nguồn lẫn gói ZIP). Lỗi D1 -> quay về hành vi cũ.
export async function activeDefs(db: any): Promise<BlockDef[]> {
  try { return [...CORE, ...(await blockDefs(db, true))]; } catch { return allDefs(); }
}
export const defsToMap = (a: BlockDef[]) => Object.fromEntries(a.map((d) => [d.type, d]));
// Gửi cho trình dựng: khối của plugin đang tắt vẫn được gửi (đánh dấu inactive) để bố cục cũ không bị hỏng/mất.
export async function clientDefsAsync(db: any) {
  let a: any[]; try { a = [...CORE, ...(await blockDefs(db, false))]; } catch { a = allDefs(); }
  return a.map(({ render, ...d }) => d);
}
export const clientDefs = () => allDefs().map(({ render, ...d }) => d);

export const STYLE_DEF = { sp: 12, sm: 12, hp: false, hm: false, py: 0, bg: '', al: '', full: false };

export function parseBlocks(s: string): Block[] {
  try { const a = JSON.parse(s || '[]'); return Array.isArray(a) ? a.filter((b) => b && typeof b.type === 'string') : []; } catch { return []; }
}

export const MAX_DEPTH = 5;
async function renderOne(b: Block, ctx: Ctx, depth: number, defs: Record<string, BlockDef>): Promise<string> {
  const d = defs[b.type]; if (!d) return '';
  const s = { ...STYLE_DEF, ...(b.style || {}) };
  let inner = '';
  try {
    let kids: any;
    if (d.container === 'list') kids = depth < MAX_DEPTH ? await renderBlocks(b.children || [], ctx, depth + 1) : '';
    else if (d.container === 'cols') kids = await Promise.all((b.cols || []).map((c) => (depth < MAX_DEPTH ? renderBlocks(c || [], ctx, depth + 1) : Promise.resolve(''))));
    inner = await d.render(b.props || {}, ctx, kids);
  } catch (e: any) { inner = `<p class="meta">Khối “${esc(d.label)}” lỗi: ${esc(e?.message || e)}</p>`; }
  // "tràn hết chiều ngang" chỉ áp dụng ở cấp ngoài cùng (khối lồng bên trong đã nằm trong khung)
  const full = depth === 0 && (s.full || (d.full && b.style?.full !== false));
  const cls = ['blk', `sp-${num(s.sp, 12, 1, 12)}`, `spm-${num(s.sm, 12, 1, 12)}`, s.hp ? 'hide-pc' : '', s.hm ? 'hide-m' : '', full ? 'full' : ''].filter(Boolean).join(' ');
  const st = [s.py ? `padding-block:${num(s.py, 0, 0, 200)}px` : '', col(s.bg) ? `background:${col(s.bg)}` : '', ['left', 'center', 'right'].includes(s.al) ? `text-align:${s.al}` : ''].filter(Boolean).join(';');
  return `<div class="${cls}"${st ? ` style="${st}"` : ''}>${inner}</div>`;
}

export async function renderBlocks(blocks: Block[], ctx: Ctx, depth = 0): Promise<string> {
  if (!ctx.defs) ctx = { ...ctx, defs: defsToMap(await activeDefs(ctx.db)) };
  const defs = ctx.defs!;
  const out = await Promise.all((blocks || []).map((b) => renderOne(b, ctx, depth, defs)));
  return `<div class="bgrid${depth ? ' nested' : ''}">${out.join('')}</div>`;
}

// ===== Làm sạch dữ liệu trước khi lưu =====
const flat = (o: any) => { const r: Record<string, any> = {}; if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { if (!/^[\w-]{1,40}$/.test(k)) continue; if (typeof v === 'string') r[k] = v.slice(0, 30000); else if (typeof v === 'number' && isFinite(v)) r[k] = v; else if (typeof v === 'boolean') r[k] = v; } return r; };
const cleanStyle = (s: any) => { const o = { ...STYLE_DEF }; if (s && typeof s === 'object') { o.sp = num(s.sp, 12, 1, 12); o.sm = num(s.sm, 12, 1, 12); o.hp = !!s.hp; o.hm = !!s.hm; o.py = num(s.py, 0, 0, 200); o.bg = col(s.bg); o.al = ['left', 'center', 'right'].includes(s.al) ? s.al : ''; o.full = !!s.full; } return o; };

// Kiểm tra cấu trúc khối: bỏ loại không biết, giới hạn độ sâu (5) và số khối (400).
// Người không phải admin không được thêm/sửa khối chạy mã (HTML tự do, tiện ích): bản cũ được giữ nguyên, khối mới bị bỏ.
export function cleanBlocks(raw: any, o: { admin?: boolean; old?: Block[]; defs?: Record<string, BlockDef>; known?: Record<string, BlockDef> } = {}): Block[] {
  const defs = o.defs || defMap(), known = o.known || defs, oldMap = new Map<string, Block>();
  (function idx(a: Block[]) { for (const b of a || []) { if (!b) continue; oldMap.set(b.id, b); idx(b.children || []); for (const c of b.cols || []) idx(c || []); } })(o.old || []);
  let n = 0; const seen = new Set<string>();
  const walk = (a: any, depth: number): Block[] => {
    if (!Array.isArray(a) || depth > MAX_DEPTH) return [];
    const out: Block[] = [];
    for (const r of a) {
      if (!r || typeof r.type !== 'string' || n >= 400) continue;
      const d = defs[r.type] || known[r.type]; if (!d) continue; // khối của plugin đang tắt vẫn được giữ lại
      const id = typeof r.id === 'string' && /^[\w-]{1,20}$/.test(r.id) && !seen.has(r.id) ? r.id : uid(); seen.add(id);
      let props = flat(r.props);
      if (d.admin && !o.admin) { const ob = oldMap.get(id); if (!ob || ob.type !== r.type) continue; props = ob.props || {}; }
      n++;
      const b: Block = { id, type: r.type, props, style: cleanStyle(r.style) };
      if (d.container === 'list') b.children = walk(r.children, depth + 1);
      if (d.container === 'cols') {
        const k = parseLayout(props.layout).length, cs: any[] = Array.isArray(r.cols) ? r.cols : [];
        b.cols = Array.from({ length: k }, (_, i) => walk(i < k - 1 ? cs[i] : ([] as any[]).concat(...cs.slice(k - 1).map((x) => (Array.isArray(x) ? x : []))), depth + 1));
      }
      out.push(b);
    }
    return out;
  };
  return walk(raw, 0);
}
export const uid = () => Math.random().toString(36).slice(2, 9);
