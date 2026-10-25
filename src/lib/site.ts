import { all } from './util';

export const DEF = {
  name: 'Nhịp Đầu Tư', tagline: 'Kết nối tri thức · Kiến tạo giá trị', logo: '',
  email: 'support@nhipdautu.vn', hotline: '1900 0000', address: 'Số 123, Đường ABC, Quận 1, TP.HCM',
  color: '#12b76a', color_dark: '#0a2a2f',
  footer_text: '', disclaimer: 'Thông tin chỉ mang tính tham khảo, không phải khuyến nghị đầu tư.',
  f1_title: 'Chuyên mục', f2_title: 'Khám phá', social_fb: '', social_yt: '', social_zalo: '',
  home_page: '', head_code: '', body_code: '',
  chat_on: '', chat_title: 'Hỗ trợ trực tuyến', chat_welcome: 'Xin chào! Bạn cần hỗ trợ gì? Hãy để lại tin nhắn, chúng tôi sẽ trả lời sớm.',
};
export type Site = typeof DEF;
export const SITE_KEYS = Object.keys(DEF) as (keyof Site)[];

export async function getSite(db: any): Promise<Site> {
  try {
    const rows = await all(db, "SELECT k,v FROM kv WHERE k LIKE 's.%'");
    const o: any = { ...DEF };
    for (const r of rows) { const k = r.k.slice(2); if (k in DEF && r.v !== null && r.v !== '') o[k] = r.v; }
    return o;
  } catch { return { ...DEF }; }
}

export type NavItem = { id: number; loc: string; label: string; url: string; icon: string; parent_id: number; sort: number; target: string; device: string; children?: NavItem[] };
export const LOCS: Record<string, string> = {
  header: 'Menu trên cùng (máy tính)', mobile: 'Menu bên (ngăn kéo trên điện thoại)', bottom: 'Thanh dưới cùng (điện thoại)',
  footer1: 'Chân trang: cột 1', footer2: 'Chân trang: cột 2',
};
const FALLBACK: Record<string, [string, string, string][]> = {
  header: [['Trang chủ', '/', 'home'], ['Thị trường', '/thi-truong', 'chart'], ['Tin tức', '/tin-tuc', 'news'], ['Liên hệ', '/lien-he', 'mail']],
  bottom: [['Trang chủ', '/', 'home'], ['Thị trường', '/thi-truong', 'chart'], ['Tin tức', '/tin-tuc', 'news'], ['Liên hệ', '/lien-he', 'mail']],
};

export async function getMenus(db: any): Promise<Record<string, NavItem[]>> {
  let rows: NavItem[] = [];
  try { rows = await all(db, 'SELECT * FROM nav_items ORDER BY sort, id'); } catch { /* chưa chạy SQL */ }
  const out: Record<string, NavItem[]> = {};
  for (const loc of Object.keys(LOCS)) out[loc] = [];
  for (const r of rows) if (out[r.loc] && !r.parent_id) out[r.loc].push({ ...r, children: [] });
  for (const r of rows) if (r.parent_id) { const p = out[r.loc]?.find((x) => x.id === r.parent_id); if (p) p.children!.push(r); }
  if (!rows.length) for (const [loc, items] of Object.entries(FALLBACK)) out[loc] = items.map(([label, url, ic], i) => ({ id: -i - 1, loc, label, url, icon: ic, parent_id: 0, sort: i, target: '', device: 'all', children: [] }));
  if (!out.mobile.length) out.mobile = out.header;
  return out;
}

export const isActive = (url: string, path: string) => (url === '/' ? path === '/' : path === url || path.startsWith(url + '/'));
// Chỉ cho phép liên kết nội bộ hoặc https/mailto/tel
export const safeUrl = (u: string) => (/^(\/|#|https:\/\/|http:\/\/|mailto:|tel:)/i.test((u || '').trim()) ? u.trim() : '#');
