// Các khối của Page Builder Pro (đăng ký qua plugin "page-builder"; chỉ hiện khi plugin đang bật).
// Mọi giá trị người dùng nhập đều được thoát/kiểm tra trước khi ra HTML. JavaScript chỉ chạy trong khung cách ly (sandbox) và chỉ quản trị viên được nhập.
import type { BlockDef } from '../blocks';
import { esc } from '../esc';
import { safeUrl } from '../site';
import { all, first, CATS, fmtNum, fmtPct, renderContent } from '../util';
import { sanitizeHtml, sandboxFrame } from '../px/sanitize';
import { scopeCss } from './css';

const url = (s: any) => esc(safeUrl(String(s || '')));
const https = (s: any) => (/^https:\/\/[^\s"'<>]+$/i.test(String(s || '').trim()) ? esc(String(s).trim()) : '');
const num = (s: any, d: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(Number(s)) ? Number(s) : d));
const lines = (s: any) => String(s || '').split('\n').map((x) => x.trim()).filter(Boolean);
const ago = (iso: string) => {
  const t = Date.parse(iso); if (!t) return ''; const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  return m < 1 ? 'vừa xong' : m < 60 ? `${m} phút trước` : m < 1440 ? `${Math.round(m / 60)} giờ trước` : `${Math.round(m / 1440)} ngày trước`;
};
const ALIGN: [string, string][] = [['left', 'Trái'], ['center', 'Giữa'], ['right', 'Phải']];

const PLANS_DEF = 'Cơ bản | Miễn phí | | Bản tin thị trường; Tin tức cơ bản | Bắt đầu | /lien-he\nChuyên nghiệp | 199.000đ | /tháng | Phân tích chuyên sâu; Cảnh báo cổ phiếu; Hỗ trợ ưu tiên | Đăng ký | /lien-he | *\nDoanh nghiệp | Liên hệ | | Dữ liệu riêng; Tư vấn 1-1 | Liên hệ | /lien-he';
export const PRO_BLOCKS: BlockDef[] = [
  { type: 'pb-cta', label: 'CTA kêu gọi hành động', icon: 'star', group: 'Nội dung', fields: [
    { k: 'title', label: 'Tiêu đề', def: 'Đồng hành cùng bạn trên hành trình đầu tư thông minh' }, { k: 'text', label: 'Mô tả', type: 'textarea', def: 'Nhận thông báo, phân tích và gợi ý đầu tư từ đội ngũ chuyên gia.' },
    { k: 'btn', label: 'Chữ nút chính', def: 'Đăng ký nhận tin' }, { k: 'url', label: 'Liên kết nút chính', type: 'url', def: '/lien-he' },
    { k: 'btn2', label: 'Chữ nút phụ (tùy chọn)' }, { k: 'url2', label: 'Liên kết nút phụ', type: 'url' },
    { k: 'look', label: 'Kiểu', type: 'select', options: [['brand', 'Xanh thương hiệu'], ['dark', 'Tối'], ['light', 'Sáng']], def: 'brand' }, { k: 'align', label: 'Căn chữ', type: 'select', options: ALIGN, def: 'left' }],
    render: (p) => `<div class="pb-cta ${['brand', 'dark', 'light'].includes(p.look) ? 'l-' + p.look : 'l-brand'} a-${['left', 'center', 'right'].includes(p.align) ? p.align : 'left'}"><div class="pb-cta-t"><h2>${esc(p.title)}</h2>${p.text ? `<p>${esc(p.text)}</p>` : ''}</div><div class="pb-cta-b">${p.btn ? `<a class="btn" href="${url(p.url)}">${esc(p.btn)}</a>` : ''}${p.btn2 ? `<a class="btn ghost" href="${url(p.url2)}">${esc(p.btn2)}</a>` : ''}</div></div>` },

  { type: 'pb-pricing', label: 'Bảng giá dịch vụ', icon: 'list', group: 'Nội dung', fields: [
    { k: 'plans', label: 'Mỗi dòng một gói: Tên | Giá | Chu kỳ | Tính năng 1; Tính năng 2 | Chữ nút | Liên kết | * (nổi bật)', type: 'textarea',
      def: PLANS_DEF }],
    render: (p) => { const cards = lines(p.plans ?? PLANS_DEF).slice(0, 6).map((l) => l.split('|').map((x) => x.trim())).map(([n, pr, per, ft, bt, bu, hot]) =>
      `<div class="pb-plan${hot === '*' ? ' hot' : ''}">${hot === '*' ? '<span class="pb-badge">Phổ biến</span>' : ''}<h3>${esc(n)}</h3><div class="pb-price"><b>${esc(pr)}</b>${per ? `<small>${esc(per)}</small>` : ''}</div><ul>${String(ft || '').split(';').map((x) => x.trim()).filter(Boolean).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>${bt ? `<a class="btn${hot === '*' ? '' : ' ghost'}" href="${url(bu)}">${esc(bt)}</a>` : ''}</div>`).join('');
      return `<div class="pb-plans">${cards}</div>`; } },

  { type: 'pb-stock', label: 'Thông tin cổ phiếu', icon: 'chart', group: 'Chứng khoán', fields: [
    { k: 'symbol', label: 'Mã (vd FPT, VIC, VN-INDEX)', def: 'FPT' }, { k: 'detail', label: 'Hiện chi tiết (sàn, ngành, khối lượng)', type: 'check', def: true }, { k: 'link', label: 'Có liên kết tới trang mã', type: 'check', def: true }],
    render: async (p, c) => { const sym = String(p.symbol || '').toUpperCase().replace(/[^A-Z0-9._-]/g, '').slice(0, 20); const q = sym ? await first(c.db, 'SELECT * FROM quotes WHERE symbol=?', sym) : null;
      if (!q) return `<div class="pb-stock empty">${sym ? `Chưa có dữ liệu mã ${esc(sym)}. Thêm mã ở Số liệu thị trường.` : 'Chưa chọn mã.'}</div>`;
      const up = q.change_pct >= 0; const inner = `<div class="pb-stock-h"><b>${esc(q.symbol)}</b><span>${esc(q.name)}</span></div><div class="pb-stock-p"><strong>${fmtNum(q.price)}</strong><em class="${up ? 'up' : 'down'}">${up ? '▲' : '▼'} ${fmtPct(q.change_pct)}</em></div>${p.detail === false ? '' : `<div class="pb-stock-m">${[q.exchange, q.sector, q.volume ? 'KL ' + q.volume : ''].filter(Boolean).map(esc).join(' · ')}</div>`}`;
      return p.link === false ? `<div class="pb-stock">${inner}</div>` : `<a class="pb-stock" href="/co-phieu/${encodeURIComponent(q.symbol)}">${inner}</a>`; } },

  { type: 'pb-market', label: 'Biểu đồ thị trường (thanh % thay đổi)', icon: 'chart', group: 'Chứng khoán', fields: [
    { k: 'title', label: 'Tiêu đề', def: 'Biến động thị trường' }, { k: 'src', label: 'Nguồn dữ liệu', type: 'select', options: [['index', 'Các chỉ số'], ['up', 'Cổ phiếu tăng mạnh'], ['down', 'Cổ phiếu giảm mạnh'], ['list', 'Danh sách mã tự chọn']], def: 'index' },
    { k: 'symbols', label: 'Danh sách mã (mỗi dòng một mã, dùng khi chọn “tự chọn”)', type: 'textarea' }, { k: 'count', label: 'Số mã', type: 'number', def: 6 }],
    render: async (p, c) => { const n = num(p.count, 6, 1, 15); let rows: any[] = [];
      if (p.src === 'list') { const sy = lines(p.symbols).map((x) => x.toUpperCase().replace(/[^A-Z0-9._-]/g, '')).filter(Boolean).slice(0, 15); if (sy.length) rows = await all(c.db, `SELECT symbol,name,price,change_pct FROM quotes WHERE symbol IN (${sy.map(() => '?').join(',')})`, ...sy); }
      else if (p.src === 'up' || p.src === 'down') rows = await all(c.db, `SELECT symbol,name,price,change_pct FROM quotes WHERE kind='stock' ORDER BY change_pct ${p.src === 'up' ? 'DESC' : 'ASC'} LIMIT ${n}`);
      else rows = await all(c.db, `SELECT symbol,name,price,change_pct FROM quotes WHERE kind='index' ORDER BY symbol LIMIT ${n}`);
      const head = p.title ? `<h3 class="b-h">${esc(p.title)}</h3>` : '';
      if (!rows.length) return head + '<p class="meta">Chưa có dữ liệu thị trường.</p>';
      const mx = Math.max(1, ...rows.map((r) => Math.abs(Number(r.change_pct) || 0))), W = 560, rowH = 30, L = 96, R = 70, mid = L + (W - L - R) / 2, half = (W - L - R) / 2 - 6;
      const svg = rows.map((r, i) => { const v = Number(r.change_pct) || 0, w = Math.max(2, Math.abs(v) / mx * half), y = i * rowH + 4, x = v >= 0 ? mid : mid - w;
        return `<text x="${L - 8}" y="${y + 14}" text-anchor="end" class="l">${esc(r.symbol)}</text><rect x="${x.toFixed(1)}" y="${y}" width="${w.toFixed(1)}" height="18" rx="3" class="${v >= 0 ? 'u' : 'd'}"/><text x="${W - 4}" y="${y + 14}" text-anchor="end" class="v ${v >= 0 ? 'u' : 'd'}">${esc(fmtPct(v))}</text>`; }).join('');
      return `${head}<svg class="pb-mchart" viewBox="0 0 ${W} ${rows.length * rowH + 8}" role="img" aria-label="Biểu đồ phần trăm thay đổi của ${rows.length} mã"><line x1="${mid}" y1="0" x2="${mid}" y2="${rows.length * rowH + 8}" class="ax"/>${svg}</svg>`; } },

  { type: 'pb-latest', label: 'Tin mới nhất', icon: 'news', group: 'Nội dung', fields: [
    { k: 'title', label: 'Tiêu đề khối', def: 'Tin tức mới nhất' }, { k: 'cat', label: 'Chuyên mục', type: 'select', options: [['', 'Tất cả'], ...Object.entries(CATS)] }, { k: 'count', label: 'Số tin', type: 'number', def: 5 },
    { k: 'sort', label: 'Sắp xếp', type: 'select', options: [['new', 'Mới nhất'], ['views', 'Đọc nhiều nhất']], def: 'new' }, { k: 'thumb', label: 'Hiện ảnh nhỏ', type: 'check', def: true }, { k: 'more', label: 'Liên kết “Xem thêm”', type: 'url', def: '/tin-tuc' }],
    render: async (p, c) => { const w = ["status='published'", 'published_at <= ?'], a: any[] = [new Date().toISOString()]; if (p.cat && /^[a-z0-9-]{1,80}$/.test(String(p.cat))) { w.push('category=?'); a.push(p.cat); }
      const rows = await all(c.db, `SELECT slug,title,image,published_at FROM posts WHERE ${w.join(' AND ')} ORDER BY ${p.sort === 'views' ? 'views DESC,' : ''} published_at DESC LIMIT ${num(p.count, 5, 1, 20)}`, ...a);
      const li = rows.map((r) => `<a class="pb-news" href="/bai-viet/${esc(r.slug)}">${p.thumb !== false ? `<span class="im">${r.image ? `<img src="${esc(r.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}</span>` : ''}<span class="tx"><b>${esc(r.title)}</b><small>${esc(ago(r.published_at))}</small></span></a>`).join('');
      return `<div class="pb-newsbox">${p.title ? `<h3 class="b-h">${esc(p.title)}</h3>` : ''}${li || '<p class="meta">Chưa có bài viết.</p>'}${p.more ? `<a class="pb-more" href="${url(p.more)}">Xem thêm →</a>` : ''}</div>`; } },

  { type: 'pb-ai', label: 'Nội dung AI (soạn sẵn)', icon: 'bot', group: 'Nội dung', fields: [
    { k: 'title', label: 'Tiêu đề (tùy chọn)' }, { k: 'text', label: 'Nội dung (bấm “Tạo bằng AI” bên dưới hoặc tự viết)', type: 'textarea', hint: '## đề mục · "- " gạch đầu dòng · cách đoạn bằng dòng trống' },
    { k: 'label', label: 'Hiện nhãn “Nội dung có AI hỗ trợ”', type: 'check', def: true }],
    render: (p) => `<div class="pb-ai">${p.title ? `<h3 class="b-h">${esc(p.title)}</h3>` : ''}${p.label !== false ? '<span class="pb-ai-tag">✦ Nội dung có AI hỗ trợ, đã được biên tập</span>' : ''}<div class="b-text art-body">${renderContent(p.text)}</div></div>` },

  { type: 'pb-video', label: 'Video (tải nhẹ)', icon: 'play', group: 'Nhúng', fields: [
    { k: 'url', label: 'Link YouTube, Vimeo hoặc tệp .mp4 (https://…)', type: 'url' }, { k: 'poster', label: 'Ảnh bìa (tùy chọn, https://…)', type: 'image' },
    { k: 'ratio', label: 'Tỉ lệ', type: 'select', options: [['16/9', '16:9'], ['4/3', '4:3'], ['1/1', 'Vuông'], ['9/16', 'Dọc']], def: '16/9' }],
    render: (p, c) => { const u = String(p.url || '').trim(), ratio = ['16/9', '4/3', '1/1', '9/16'].includes(p.ratio) ? p.ratio : '16/9', st = `aspect-ratio:${ratio}`;
      let m = u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,15})/);
      if (m) { const once = !c.once?.has('yt'); c.once?.add('yt'); const id = m[1], poster = https(p.poster) || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
        return `<div class="pb-vid" style="${st}"><button type="button" class="pb-yt" data-yt="${esc(id)}" aria-label="Phát video"><img src="${poster}" alt="" loading="lazy" referrerpolicy="no-referrer"><i>▶</i></button></div>${once ? `<script>document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('.pb-yt');if(!b)return;var f=document.createElement('iframe');f.src='https://www.youtube-nocookie.com/embed/'+b.getAttribute('data-yt')+'?autoplay=1';f.allow='autoplay;fullscreen';f.allowFullscreen=true;f.referrerPolicy='no-referrer-when-downgrade';b.parentNode.replaceChild(f,b)})</script>` : ''}`; }
      m = u.match(/vimeo\.com\/(\d+)/); if (m) return `<div class="pb-vid" style="${st}"><iframe src="https://player.vimeo.com/video/${m[1]}" loading="lazy" allowfullscreen referrerpolicy="no-referrer-when-downgrade"></iframe></div>`;
      if (/^https:\/\/[^\s"'<>]+\.(mp4|webm)(\?[^\s"'<>]*)?$/i.test(u)) return `<div class="pb-vid" style="${st}"><video controls preload="none" playsinline src="${esc(u)}"${https(p.poster) ? ` poster="${https(p.poster)}"` : ''}></video></div>`;
      return ''; } },

  { type: 'pb-html', label: 'HTML/CSS tùy chỉnh (an toàn)', icon: 'code', group: 'Nhúng', adminFields: ['js'], fields: [
    { k: 'html', label: 'HTML (thẻ cho phép; mã nguy hiểm tự bị loại)', type: 'textarea' }, { k: 'css', label: 'CSS (chỉ áp dụng trong khối này)', type: 'textarea' },
    { k: 'js', label: 'JavaScript (CHỈ quản trị viên; chạy trong khung cách ly, không thấy dữ liệu quản trị)', type: 'textarea' }, { k: 'height', label: 'Chiều cao khung cách ly khi có JavaScript (px)', type: 'number', def: 300 }],
    render: (p, _c, _k, blk) => { const id = String(blk?.id || 'x').replace(/[^\w-]/g, ''), html = sanitizeHtml(String(p.html || ''));
      if (String(p.js || '').trim()) { const css = String(p.css || '').replace(/<\/style/gi, '<\\/style'), js = String(p.js).replace(/<\/script/gi, '<\\/script');
        return sandboxFrame(`<style>${css}</style>${html}<script>${js}</script>`, num(p.height, 300, 60, 1000), 'HTML tùy chỉnh'); }
      const sc = scopeCss(String(p.css || ''), `.pbh-${id}`).css; return `<div class="pbh pbh-${id}">${sc ? `<style>${sc}</style>` : ''}${html}</div>`; } },

  { type: 'pb-reusable', label: 'Khối dùng chung', icon: 'puzzle', group: 'Bố cục', fields: [{ k: 'ref', label: 'Số hiệu khối dùng chung', type: 'number' }],
    render: async (p, c) => { if ((c.reuse || 0) >= 1) return ''; const r = await first(c.db, 'SELECT block FROM px_page_builder_reusable WHERE id=?', Number(p.ref) || 0).catch(() => null);
      if (!r) return c.edit ? '<p class="meta">Khối dùng chung không còn tồn tại.</p>' : ''; let b: any; try { b = JSON.parse(r.block); } catch { return ''; }
      const { renderBlocks } = await import('../blocks'); return renderBlocks([b], { ...c, reuse: (c.reuse || 0) + 1, edit: false }, 1); } },
];
