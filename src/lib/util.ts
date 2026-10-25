export const SITE = {
  name: 'Nhịp Đầu Tư',
  tagline: 'Kết nối tri thức · Kiến tạo giá trị',
  email: 'support@nhipdautu.vn',
  hotline: '1900 0000',
  address: 'Số 123, Đường ABC, Quận 1, TP.HCM',
};

export const CATS: Record<string, string> = {
  'thi-truong': 'Thị trường',
  'doanh-nghiep': 'Doanh nghiệp',
  'phan-tich': 'Phân tích',
  'kien-thuc': 'Kiến thức',
};

export const fmtNum = (n: number, d = 2) =>
  Number(n || 0).toLocaleString('vi-VN', { minimumFractionDigits: d, maximumFractionDigits: d });

export const fmtPct = (n: number) => (n > 0 ? '+' : '') + fmtNum(n) + '%';

const parse = (iso?: string) => {
  if (!iso) return null;
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
  return isNaN(d.getTime()) ? null : d;
};

export const fmtDate = (iso?: string) => {
  const d = parse(iso);
  if (!d) return '';
  return d.toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

export const toLocalInput = (iso?: string) => {
  const d = parse(iso);
  if (!d) return '';
  return new Date(d.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 16);
};

export const fromLocalInput = (v: string) => {
  if (!v) return '';
  const d = new Date(v + ':00+07:00');
  return isNaN(d.getTime()) ? '' : d.toISOString();
};

export const slugify = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'bai-viet';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Văn bản đơn giản -> HTML an toàn:
// "## Tiêu đề" = đề mục, "- " = gạch đầu dòng, [ảnh:https://...] = ảnh, còn lại là đoạn văn.
export function renderContent(t: string) {
  return (t || '').replace(/\r/g, '').replace(/\[ảnh cần:[^\]]*\]/gi, '').split(/\n{2,}/).map((raw) => {
    const b = raw.trim();
    if (!b) return '';
    if (b.startsWith('### ')) return `<h3>${esc(b.slice(4))}</h3>`;
    if (b.startsWith('## ')) return `<h2>${esc(b.slice(3))}</h2>`;
    const lines = b.split('\n');
    if (lines.every((l) => l.startsWith('- '))) {
      return '<ul>' + lines.map((l) => `<li>${esc(l.slice(2))}</li>`).join('') + '</ul>';
    }
    const img = b.match(/^\[ảnh:(https:\/\/[^\]\s"'<>]+)\]$/i);
    if (img) return `<img src="${img[1]}" alt="" referrerpolicy="no-referrer" loading="lazy">`;
    return `<p>${esc(b).replace(/\n/g, '<br>')}</p>`;
  }).join('');
}

export const nowIso = () => new Date().toISOString();
export const all = async (db: any, sql: string, ...a: any[]) => (await db.prepare(sql).bind(...a).all()).results as any[];
export const first = async (db: any, sql: string, ...a: any[]) => (await db.prepare(sql).bind(...a).first()) as any;
export const run = async (db: any, sql: string, ...a: any[]) => db.prepare(sql).bind(...a).run();
