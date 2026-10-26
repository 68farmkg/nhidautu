import { all, nowIso } from './util';

// Ngày giờ theo giờ Việt Nam, ví dụ: "Thứ Năm, 23/10/2025 15:30"
export function vnNow() {
  const d = new Date(), tz = 'Asia/Ho_Chi_Minh';
  const wd = d.toLocaleDateString('vi-VN', { timeZone: tz, weekday: 'long' });
  const day = d.toLocaleDateString('vi-VN', { timeZone: tz, day: '2-digit', month: '2-digit', year: 'numeric' });
  const t = d.toLocaleTimeString('vi-VN', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
  return `${wd.charAt(0).toUpperCase() + wd.slice(1)}, ${day} ${t}`;
}

// Thống kê theo ngành từ bảng quotes (trung bình % thay đổi của các mã trong ngành)
export function sectorStats(stocks: any[]) {
  const m = new Map<string, { name: string; n: number; sum: number }>();
  for (const s of stocks) {
    const k = (s.sector || '').trim(); if (!k) continue;
    const o = m.get(k) || { name: k, n: 0, sum: 0 };
    o.n++; o.sum += Number(s.change_pct) || 0; m.set(k, o);
  }
  return [...m.values()].map((o) => ({ name: o.name, n: o.n, pct: o.sum / o.n })).sort((a, b) => b.pct - a.pct);
}

export const prevClose = (price: number, pct: number) => price / (1 + (pct || 0) / 100);

const COLS = 'id,slug,title,summary,image,category,published_at,views';
// Lấy bài đã đăng; trả về tối đa `limit` bài và cờ `more` nếu còn trang sau
export async function getPosts(db: any, o: { cat?: string; limit: number; offset?: number; order?: 'new' | 'views'; exclude?: number[] }) {
  const where = ["status='published'", 'published_at <= ?'], args: any[] = [nowIso()];
  if (o.cat) { where.push('category = ?'); args.push(o.cat); }
  if (o.exclude?.length) { where.push(`id NOT IN (${o.exclude.map(() => '?').join(',')})`); args.push(...o.exclude); }
  const order = o.order === 'views' ? 'views DESC, published_at DESC' : 'published_at DESC';
  const rows = await all(db, `SELECT ${COLS} FROM posts WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT ${o.limit + 1} OFFSET ${o.offset || 0}`, ...args);
  return { rows: rows.slice(0, o.limit), more: rows.length > o.limit };
}
