// Tùy chỉnh giao diện (Theme Options) + cấu hình Header/Footer, mô phỏng cách Flatsome làm:
//  - mọi tùy chọn là cặp khóa→giá trị phẳng, có mặc định, được kiểm tra chặt rồi mới xuất ra CSS;
//  - Header gồm 3 thanh (trên cùng / chính / dưới) mỗi thanh có 3 vùng trái-giữa-phải, phần tử kéo thả theo thứ tự; di động có vùng riêng.
// Giá trị RỖNG = "giữ nguyên giao diện hiện tại" nên cài bước này không làm đổi gì cho tới khi bạn chọn.
import { all, run } from './util';

export const FONTS = ['Inter', 'Be Vietnam Pro', 'Roboto', 'Open Sans', 'Montserrat', 'Nunito', 'Noto Sans', 'Source Sans 3', 'Roboto Slab', 'Merriweather', 'Playfair Display'];
export const EL: [string, string][] = [['logo', 'Logo'], ['nav', 'Menu'], ['search', 'Tìm kiếm'], ['btn1', 'Nút 1'], ['btn2', 'Nút 2'], ['social', 'Mạng xã hội'], ['contact', 'Liên hệ (điện thoại, email)'], ['html', 'Văn bản tùy chỉnh'], ['divider', 'Vạch ngăn'], ['spacer', 'Khoảng trống']];
export const EL_MOBILE = ['logo', 'search', 'btn1', 'contact', 'spacer'];
const REPEAT = new Set(['divider', 'spacer']);
export const SLOTS_D = ['top_l', 'top_c', 'top_r', 'mn_l', 'mn_c', 'mn_r', 'bt_l', 'bt_c', 'bt_r'];
export const SLOTS_M = ['mb_l', 'mb_r'];

export type Field = { k: string; l: string; t: 'color' | 'int' | 'enum' | 'bool' | 'text' | 'url' | 'font' | 'slots' | 'css'; g: string; sg?: string; def?: string; min?: number; max?: number; opts?: [string, string][]; hint?: string; ml?: number };
const C = (k: string, l: string, sg = 'Màu sắc', hint = '', g = 'mau'): Field => ({ k, l, t: 'color', g, sg, def: '', hint });
const F = (k: string, l: string): Field => ({ k, l, t: 'font', g: 'chu', sg: 'Phông chữ', def: '', hint: 'Để trống = giữ phông hiện tại' });
const N = (k: string, l: string, g: string, min: number, max: number, def = '', sg = '', hint = ''): Field => ({ k, l, t: 'int', g, sg, min, max, def, hint });
const E = (k: string, l: string, g: string, opts: [string, string][], def: string, sg = ''): Field => ({ k, l, t: 'enum', g, sg, opts, def });
const B = (k: string, l: string, g: string, def: string, sg = ''): Field => ({ k, l, t: 'bool', g, sg, def });
const T = (k: string, l: string, g: string, ml: number, sg = '', hint = '', t: 'text' | 'url' = 'text'): Field => ({ k, l, t, g, sg, ml, def: '', hint });
const S = (k: string, l: string, sg: string): Field => ({ k, l, t: 'slots', g: 'header', sg, def: '' });
const TT: [string, string][] = [['', 'Giữ nguyên'], ['none', 'Giữ nguyên chữ gõ'], ['uppercase', 'IN HOA']];

export const FIELDS: Field[] = [
  // — Màu sắc —
  C('c_primary', 'Màu chủ đạo', 'Màu chính', 'Nút, liên kết nhấn, điểm nhấn'), C('c_secondary', 'Màu phụ'), C('c_success', 'Màu thành công'), C('c_alert', 'Màu cảnh báo'),
  C('c_text', 'Màu chữ nội dung', 'Chữ & liên kết'), C('c_heading', 'Màu tiêu đề'), C('c_link', 'Màu liên kết'), C('c_link_h', 'Màu liên kết khi rê chuột'),
  C('c_body_bg', 'Nền trang (ngoài khung)', 'Nền'), C('c_content_bg', 'Nền vùng nội dung'),
  // — Chữ —
  F('f_head', 'Phông tiêu đề'), F('f_body', 'Phông nội dung'), F('f_nav', 'Phông menu'),
  N('fs_base', 'Cỡ chữ nội dung (px)', 'chu', 13, 22, '', 'Kích cỡ', 'Để trống = giữ nguyên'), N('fs_base_m', 'Cỡ chữ trên điện thoại (px)', 'chu', 12, 20, '', 'Kích cỡ'),
  E('tt_nav', 'Chữ menu', 'chu', TT, '', 'Kiểu chữ'), E('tt_btn', 'Chữ trên nút', 'chu', TT, ''), E('tt_sec', 'Tiêu đề mục', 'chu', TT, ''),
  N('r_btn', 'Bo góc nút (px)', 'chu', 0, 40, '', 'Bo góc'), N('r_card', 'Bo góc thẻ/khung (px)', 'chu', 0, 32, ''),
  // — Bố cục —
  E('layout', 'Chế độ bố cục', 'bocuc', [['', 'Giữ nguyên'], ['full', 'Tràn rộng'], ['boxed', 'Đóng khung (boxed)']], '', 'Khung trang'),
  N('w_site', 'Chiều rộng nội dung (px)', 'bocuc', 960, 1680, '', 'Khung trang', 'Chiều rộng tối đa của vùng nội dung'), N('w_boxed', 'Chiều rộng khung khi đóng khung (px)', 'bocuc', 960, 1680, '1240'),
  E('gap', 'Khoảng cách giữa các khối', 'bocuc', [['', 'Giữ nguyên'], ['compact', 'Gọn'], ['normal', 'Vừa'], ['relaxed', 'Thoáng']], '', 'Khoảng cách'),
  // — Header —
  B('hd_on', 'Dùng Header mới (thay Header hiện tại)', 'header', '0', 'Chung'),
  E('hd_tone', 'Tông Header', 'header', [['light', 'Nền sáng, chữ tối'], ['dark', 'Nền tối, chữ sáng']], 'light', 'Chung'),
  C('hd_bg', 'Màu nền Header', 'Chung', 'Để trống = tự chọn theo tông', 'header'),
  N('hd_h', 'Chiều cao thanh chính (px)', 'header', 40, 160, '72', 'Chung'), N('hd_h_m', 'Chiều cao trên điện thoại (px)', 'header', 44, 100, '56', 'Chung'),
  B('hd_shadow', 'Đổ bóng dưới Header', 'header', '1', 'Chung'), B('hd_line', 'Đường kẻ dưới Header', 'header', '0', 'Chung'),
  B('hd_trans', 'Header trong suốt ở trang chủ (nằm đè lên ảnh đầu trang)', 'header', '0', 'Chung'),
  B('hd_sticky', 'Dính đầu trang khi cuộn', 'header', '1', 'Dính khi cuộn'), N('hd_h_st', 'Chiều cao khi đã cuộn (px)', 'header', 40, 120, '60', 'Dính khi cuộn'),
  B('hd_top', 'Hiện thanh trên cùng', 'header', '0', 'Thanh trên cùng'), N('hd_top_h', 'Chiều cao thanh trên cùng (px)', 'header', 24, 70, '36', 'Thanh trên cùng'), C('hd_top_bg', 'Nền thanh trên cùng', 'Thanh trên cùng', '', 'header'),
  B('hd_bot', 'Hiện thanh dưới (menu hàng 2)', 'header', '0', 'Thanh dưới'), N('hd_bot_h', 'Chiều cao thanh dưới (px)', 'header', 32, 80, '44', 'Thanh dưới'), C('hd_bot_bg', 'Nền thanh dưới', 'Thanh dưới', '', 'header'),
  E('nav_style', 'Kiểu menu', 'header', [['plain', 'Chữ đơn giản'], ['underline', 'Gạch chân'], ['pill', 'Viên thuốc']], 'plain', 'Menu'), N('nav_fs', 'Cỡ chữ menu (px)', 'header', 12, 20, '15', 'Menu'), N('nav_gap', 'Khoảng cách giữa mục menu (px)', 'header', 4, 40, '18', 'Menu'),
  N('logo_h', 'Chiều cao logo (px)', 'header', 20, 120, '40', 'Logo'), E('logo_m', 'Vị trí logo trên điện thoại', 'header', [['left', 'Bên trái'], ['center', 'Ở giữa']], 'left', 'Logo'),
  E('mb_burger', 'Nút ☰ trên điện thoại', 'header', [['left', 'Bên trái'], ['right', 'Bên phải']], 'right', 'Logo'),
  S('top_l', 'Thanh trên · trái', 'Sắp xếp phần tử'), S('top_c', 'Thanh trên · giữa', 'Sắp xếp phần tử'), S('top_r', 'Thanh trên · phải', 'Sắp xếp phần tử'),
  S('mn_l', 'Thanh chính · trái', 'Sắp xếp phần tử'), S('mn_c', 'Thanh chính · giữa', 'Sắp xếp phần tử'), S('mn_r', 'Thanh chính · phải', 'Sắp xếp phần tử'),
  S('bt_l', 'Thanh dưới · trái', 'Sắp xếp phần tử'), S('bt_c', 'Thanh dưới · giữa', 'Sắp xếp phần tử'), S('bt_r', 'Thanh dưới · phải', 'Sắp xếp phần tử'),
  S('mb_l', 'Điện thoại · trái', 'Sắp xếp trên điện thoại'), S('mb_r', 'Điện thoại · phải', 'Sắp xếp trên điện thoại'),
  T('b1_t', 'Nút 1 · chữ', 'header', 30, 'Phần tử: Nút'), T('b1_u', 'Nút 1 · liên kết', 'header', 300, 'Phần tử: Nút', '', 'url'), E('b1_s', 'Nút 1 · kiểu', 'header', [['fill', 'Đặc'], ['outline', 'Viền']], 'fill', 'Phần tử: Nút'),
  T('b2_t', 'Nút 2 · chữ', 'header', 30, 'Phần tử: Nút'), T('b2_u', 'Nút 2 · liên kết', 'header', 300, 'Phần tử: Nút', '', 'url'), E('b2_s', 'Nút 2 · kiểu', 'header', [['fill', 'Đặc'], ['outline', 'Viền']], 'outline', 'Phần tử: Nút'),
  T('ct_phone', 'Điện thoại', 'header', 20, 'Phần tử: Liên hệ & mạng xã hội'), T('ct_mail', 'Email', 'header', 80, 'Phần tử: Liên hệ & mạng xã hội'), T('hd_html', 'Văn bản tùy chỉnh', 'header', 160, 'Phần tử: Liên hệ & mạng xã hội'),
  T('s_fb', 'Facebook', 'header', 300, 'Phần tử: Liên hệ & mạng xã hội', '', 'url'), T('s_yt', 'YouTube', 'header', 300, 'Phần tử: Liên hệ & mạng xã hội', '', 'url'), T('s_zalo', 'Zalo', 'header', 300, 'Phần tử: Liên hệ & mạng xã hội', '', 'url'), T('s_tt', 'TikTok', 'header', 300, 'Phần tử: Liên hệ & mạng xã hội', '', 'url'), T('s_x', 'X (Twitter)', 'header', 300, 'Phần tử: Liên hệ & mạng xã hội', '', 'url'),
  // — Footer —
  B('ft_on', 'Dùng Footer mới (thay Footer hiện tại)', 'footer', '0', 'Chung'),
  E('ft_tone', 'Tông Footer', 'footer', [['dark', 'Nền tối, chữ sáng'], ['light', 'Nền sáng, chữ tối']], 'dark', 'Chung'), C('ft_bg', 'Màu nền Footer', 'Chung', 'Để trống = tự chọn theo tông', 'footer'),
  N('ft_cols', 'Số cột (1–5)', 'footer', 1, 5, '4', 'Cột liên kết', 'Cột đầu là giới thiệu; các cột sau lấy từ Menu & chân trang'), T('ft_about', 'Đoạn giới thiệu ở cột đầu', 'footer', 300, 'Cột liên kết'), B('ft_social', 'Hiện mạng xã hội ở cột đầu', 'footer', '1', 'Cột liên kết'),
  T('ft_copy', 'Dòng bản quyền', 'footer', 160, 'Thanh dưới cùng', 'Để trống = © năm hiện tại + tên website'), E('ft_align', 'Căn dòng bản quyền', 'footer', [['split', 'Trái / phải'], ['left', 'Trái'], ['center', 'Giữa'], ['right', 'Phải']], 'split', 'Thanh dưới cùng'), T('ft_right', 'Chữ bên phải thanh dưới', 'footer', 120, 'Thanh dưới cùng'),
  B('bt_on', 'Nút “Lên đầu trang”', 'footer', '1', 'Lên đầu trang'), E('bt_shape', 'Hình dạng', 'footer', [['circle', 'Tròn'], ['square', 'Vuông bo góc']], 'circle', 'Lên đầu trang'), E('bt_pos', 'Vị trí', 'footer', [['right', 'Phải'], ['left', 'Trái']], 'right', 'Lên đầu trang'), B('bt_mob', 'Hiện trên điện thoại', 'footer', '1', 'Lên đầu trang'),
  T('blk_hd_before', 'Khối phía trên Header', 'khoi', 40, 'Chèn khối dùng lại', 'Mã khối (xem Khối dùng lại). Để trống = không chèn'), T('blk_hd_after', 'Khối ngay dưới Header', 'khoi', 40, 'Chèn khối dùng lại'), T('blk_ft_before', 'Khối phía trên Footer', 'khoi', 40, 'Chèn khối dùng lại'), T('blk_ft_in', 'Khối trong Footer (trên dòng bản quyền)', 'khoi', 40, 'Chèn khối dùng lại'),
  // — Nâng cao —
  { k: 'css', l: 'CSS tùy chỉnh', t: 'css', g: 'nangcao', def: '', ml: 8000, hint: 'Áp dụng cho toàn bộ website. Không dùng thẻ HTML.' },
];

export const GROUPS: [string, string][] = [['mau', 'Màu sắc'], ['chu', 'Chữ & nút'], ['bocuc', 'Bố cục'], ['header', 'Header'], ['footer', 'Footer'], ['khoi', 'Khối chèn sẵn'], ['nangcao', 'Nâng cao']];
export type Opts = Record<string, string>;

const HEX = /^#[0-9a-fA-F]{6}$/;
const HEX3 = /^#[0-9a-fA-F]{3}$/;
export function cleanUrl(s: string): string {
  const v = String(s || '').trim().slice(0, 300);
  if (/^(\/(?!\/)|https?:\/\/|tel:|mailto:|#)/i.test(v) && !/[\s"'<>\\]/.test(v)) return v;
  return '';
}
export function cleanSlot(s: string, mobile: boolean, used: Set<string>): string {
  const out: string[] = [];
  for (const id of String(s || '').split(',').map((x) => x.trim())) {
    if (!EL.some((e) => e[0] === id) || (mobile && !EL_MOBILE.includes(id))) continue;
    if (!REPEAT.has(id)) { if (used.has(id)) continue; used.add(id); }
    out.push(id);
  }
  return out.slice(0, 8).join(',');
}
export const PRESETS: Record<string, { name: string; v: Opts }> = {
  classic: { name: 'Cổ điển: logo trái · menu giữa · tìm kiếm + nút phải', v: { hd_top: '0', hd_bot: '0', mn_l: 'logo', mn_c: 'nav', mn_r: 'search,btn1', top_l: '', top_c: '', top_r: '', bt_l: '', bt_c: '', bt_r: '' } },
  center: { name: 'Logo giữa: tìm kiếm trái · menu ở thanh dưới', v: { hd_top: '0', hd_bot: '1', mn_l: 'search', mn_c: 'logo', mn_r: 'btn1', top_l: '', top_c: '', top_r: '', bt_l: '', bt_c: 'nav', bt_r: '' } },
  wide: { name: 'Menu rộng: logo + nút ở trên · menu hàng 2', v: { hd_top: '0', hd_bot: '1', mn_l: 'logo', mn_c: '', mn_r: 'search,btn1', top_l: '', top_c: '', top_r: '', bt_l: 'nav', bt_c: '', bt_r: 'contact' } },
  simple: { name: 'Đơn giản: logo trái · menu + nút phải', v: { hd_top: '0', hd_bot: '0', mn_l: 'logo', mn_c: '', mn_r: 'nav,btn1', top_l: '', top_c: '', top_r: '', bt_l: '', bt_c: '', bt_r: '' } },
  info: { name: 'Có thanh thông tin: liên hệ + mạng xã hội ở trên', v: { hd_top: '1', hd_bot: '0', top_l: 'contact', top_c: '', top_r: 'social', mn_l: 'logo', mn_c: 'nav', mn_r: 'search,btn1', bt_l: '', bt_c: '', bt_r: '' } },
};

// Làm sạch toàn bộ: bất kỳ giá trị lạ nào đều bị thay bằng mặc định. Đây là hàng rào duy nhất trước khi giá trị đi vào CSS/HTML.
export function clean(raw: Record<string, any>): Opts {
  const o: Opts = {}, usedD = new Set<string>(), usedM = new Set<string>();
  for (const f of FIELDS) {
    let v = raw?.[f.k]; v = v == null ? '' : String(v).trim();
    const def = f.def ?? '';
    if (f.t === 'color') { o[f.k] = HEX.test(v) ? v.toLowerCase() : HEX3.test(v) ? '#' + [...v.slice(1)].map((c) => c + c).join('').toLowerCase() : ''; }
    else if (f.t === 'int') { if (v === '') o[f.k] = def; else { const n = Math.round(Number(v)); o[f.k] = Number.isFinite(n) ? String(Math.min(f.max!, Math.max(f.min!, n))) : def; } }
    else if (f.t === 'enum') o[f.k] = f.opts!.some((x) => x[0] === v) ? v : def;
    else if (f.t === 'bool') o[f.k] = v === '1' || v === 'true' || v === 'on' ? '1' : v === '' && !(f.k in (raw || {})) ? def : '0';
    else if (f.t === 'font') o[f.k] = FONTS.includes(v) ? v : '';
    else if (f.t === 'url') o[f.k] = cleanUrl(v);
    else if (f.t === 'slots') o[f.k] = cleanSlot(v, SLOTS_M.includes(f.k), SLOTS_M.includes(f.k) ? usedM : usedD);
    else if (f.t === 'css') o[f.k] = v.replace(/</g, '').replace(/@import[^;]*;?/gi, '').replace(/expression\s*\(|javascript:/gi, '').slice(0, f.ml);
    else o[f.k] = v.replace(/[\u0000-\u001f<>]/g, '').slice(0, f.ml || 120);
  }
  for (const k of Object.keys(o)) if (k.startsWith('blk_') && !/^[a-z][a-z0-9-]{1,39}$/.test(o[k])) o[k] = '';
  return o;
}
// Sắp xếp phần tử mặc định khi chưa lưu gì
const DEF_SLOTS: Opts = { mn_l: 'logo', mn_c: 'nav', mn_r: 'search,btn1', mb_l: 'logo', mb_r: '' };
export const defaults = (): Opts => clean({ ...DEF_SLOTS });

const ready = new WeakSet<object>();
let cache: { at: number; o: Opts } | null = null;
export const bust = () => { cache = null; };
export async function ensureTheme(db: any) {
  if (ready.has(db)) return;
  await run(db, 'CREATE TABLE IF NOT EXISTS theme_opts (k TEXT PRIMARY KEY, v TEXT NOT NULL DEFAULT "")');
  ready.add(db);
}
export async function getTheme(db: any): Promise<Opts> {
  if (cache && Date.now() - cache.at < 30000) return cache.o;
  let rows: any[] = [];
  try { await ensureTheme(db); rows = await all(db, 'SELECT k,v FROM theme_opts'); } catch { /* chưa có bảng */ }
  const raw: Record<string, string> = rows.length ? Object.fromEntries(rows.map((r) => [r.k, r.v])) : { ...DEF_SLOTS };
  const o = clean(raw); cache = { at: Date.now(), o }; return o;
}
export async function saveTheme(db: any, raw: Record<string, any>): Promise<Opts> {
  await ensureTheme(db);
  const o = clean(raw);
  for (const f of FIELDS) await run(db, 'INSERT INTO theme_opts (k,v) VALUES (?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v', f.k, o[f.k]);
  bust(); return o;
}
export async function resetTheme(db: any) { await ensureTheme(db); await run(db, 'DELETE FROM theme_opts'); bust(); }

// ---- Xuất CSS ----
const fam = (f: string) => (f ? `'${f}',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif` : '');
const lum = (hex: string) => { const n = parseInt(hex.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };
export function fontsHref(o: Opts): string {
  const fs = [...new Set([o.f_head, o.f_body, o.f_nav].filter(Boolean))];
  if (!fs.length) return '';
  return 'https://fonts.googleapis.com/css2?' + fs.map((f) => `family=${f.replace(/ /g, '+')}:wght@400;500;600;700`).join('&') + '&display=swap';
}
export function themeCss(o: Opts): string {
  const v = (n: string, x: string) => (x ? `--${n}:${x};` : '');
  const dark = o.hd_tone === 'dark', fdark = o.ft_tone === 'dark';
  const hdBg = o.hd_bg || (dark ? '#0b2a2a' : '#ffffff'), ftBg = o.ft_bg || (fdark ? '#0b2a2a' : '#f3f6f5');
  const hdFg = lum(hdBg) < 0.55 ? '#ffffff' : '#1b2a2f', ftFg = lum(ftBg) < 0.55 ? '#e8f1ef' : '#1b2a2f';
  const gap = { compact: '16px', normal: '28px', relaxed: '44px' }[o.gap as 'compact'] || '';
  let s = ':root{' + v('nhip-primary', o.c_primary) + v('nhip-secondary', o.c_secondary) + v('nhip-success', o.c_success) + v('nhip-alert', o.c_alert) + v('nhip-text', o.c_text) + v('nhip-heading', o.c_heading) + v('nhip-link', o.c_link) + v('nhip-link-h', o.c_link_h)
    + v('nhip-body-bg', o.c_body_bg) + v('nhip-content-bg', o.c_content_bg) + v('nhip-font-head', fam(o.f_head)) + v('nhip-font-body', fam(o.f_body)) + v('nhip-font-nav', fam(o.f_nav))
    + v('nhip-btn-radius', o.r_btn && o.r_btn + 'px') + v('nhip-card-radius', o.r_card && o.r_card + 'px') + v('nhip-container', o.w_site && o.w_site + 'px') + v('nhip-gap', gap)
    + `--nh-hd-h:${o.hd_h}px;--nh-hd-hm:${o.hd_h_m}px;--nh-hd-st:${o.hd_h_st}px;--nh-top-h:${o.hd_top_h}px;--nh-bot-h:${o.hd_bot_h}px;--nh-hd-bg:${hdBg};--nh-hd-fg:${hdFg};--nh-fg-solid:${hdFg};--nh-top-bg:${o.hd_top_bg || hdBg};--nh-bot-bg:${o.hd_bot_bg || hdBg};--nh-nav-fs:${o.nav_fs}px;--nh-nav-gap:${o.nav_gap}px;--nh-logo-h:${o.logo_h}px;--nh-ft-bg:${ftBg};--nh-ft-fg:${ftFg};--nh-accent:${o.c_primary || '#0f9d6b'};}`;
  if (o.c_body_bg) s += 'html{background:var(--nhip-body-bg)}';
  if (o.c_content_bg) s += 'body{background:var(--nhip-content-bg)}';
  if (o.c_text || o.f_body || o.fs_base) s += `body{${o.c_text ? 'color:var(--nhip-text);' : ''}${o.f_body ? 'font-family:var(--nhip-font-body);' : ''}${o.fs_base ? `font-size:${o.fs_base}px;` : ''}}`;
  if (o.fs_base_m) s += `@media(max-width:549px){body{font-size:${o.fs_base_m}px}}`;
  if (o.c_heading || o.f_head) s += `h1,h2,h3,h4,h5,h6{${o.c_heading ? 'color:var(--nhip-heading);' : ''}${o.f_head ? 'font-family:var(--nhip-font-head);' : ''}}`;
  if (o.c_link) s += 'main a:not(.btn):not(.nh-btn){color:var(--nhip-link)}';
  if (o.c_link_h) s += 'main a:not(.btn):not(.nh-btn):hover{color:var(--nhip-link-h)}';
  if (o.tt_nav) s += `.nh-nav a{text-transform:${o.tt_nav}}`;
  if (o.tt_btn) s += `.btn,.nh-btn,button.btn{text-transform:${o.tt_btn}}`;
  if (o.tt_sec) s += `.sec-title,.section-title,main h2{text-transform:${o.tt_sec}}`;
  if (o.r_btn) s += '.btn,.nh-btn,button.btn{border-radius:var(--nhip-btn-radius)}';
  if (o.r_card) s += '.card,.box,.nh-card{border-radius:var(--nhip-card-radius)}';
  if (o.w_site) s += '.wrap{max-width:var(--nhip-container)}';
  if (o.layout === 'boxed') s += `body{max-width:${o.w_boxed || 1240}px;margin-left:auto;margin-right:auto;box-shadow:0 0 40px rgba(0,0,0,.12)}`;
  if (o.f_nav) s += '.nh-nav a{font-family:var(--nhip-font-nav)}';
  if (o.css) s += '\n' + o.css;
  return s;
}
export const slotIds = (s: string) => (s ? s.split(',').filter(Boolean) : []);
export const socialList = (o: Opts): [string, string, string][] => ([['Facebook', 'FB', o.s_fb], ['YouTube', 'YT', o.s_yt], ['Zalo', 'Zalo', o.s_zalo], ['TikTok', 'TikTok', o.s_tt], ['X', 'X', o.s_x]] as [string, string, string][]).filter((x) => x[2]);
