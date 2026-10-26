// Khối dùng lại (giống UX Blocks của Flatsome): soạn HTML một lần, chèn vào Header/Footer hoặc nhiều trang.
// Chỉ admin soạn được. Vẫn lọc phòng thủ: bỏ script/iframe/object/embed, thuộc tính on*, liên kết javascript:.
import { all, first, run, nowIso } from './util';

const ready = new WeakSet<object>();
let cache: { at: number; m: Map<string, string> } | null = null;
export const bust = () => { cache = null; };
export async function ensureBlocks(db: any) {
  if (ready.has(db)) return;
  await run(db, "CREATE TABLE IF NOT EXISTS reusable_blocks (slug TEXT PRIMARY KEY, title TEXT NOT NULL, html TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL)");
  ready.add(db);
}
export const SLUG = /^[a-z][a-z0-9-]{1,39}$/;
export function sanitizeHtml(s: string): string {
  let h = String(s || '').slice(0, 60000);
  for (let i = 0; i < 3; i++) { // lặp để chống chuỗi lồng nhau kiểu <scr<script>ipt>
    h = h.replace(/<\s*(script|iframe|object|embed|link|meta|base|form)\b[\s\S]*?(<\s*\/\s*\1\s*>|$)/gi, '')
      .replace(/<\s*\/?\s*(script|iframe|object|embed|link|meta|base|form)\b[^>]*>/gi, '')
      .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/(href|src|action|formaction|xlink:href)\s*=\s*("|')?\s*(javascript|vbscript|data\s*:\s*text\/html)[^"'>\s]*/gi, '$1=$2#');
  }
  return h;
}
export type Block = { slug: string; title: string; html: string; updated_at: string };
export async function listBlocks(db: any): Promise<Block[]> {
  try { await ensureBlocks(db); return await all(db, 'SELECT slug,title,html,updated_at FROM reusable_blocks ORDER BY title'); } catch { return []; }
}
export async function getBlockHtml(db: any, slug: string): Promise<string> {
  if (!SLUG.test(slug || '')) return '';
  if (!cache || Date.now() - cache.at > 30000) {
    const m = new Map<string, string>();
    try { await ensureBlocks(db); for (const r of await all(db, 'SELECT slug,html FROM reusable_blocks')) m.set(r.slug, sanitizeHtml(r.html)); } catch { /* chưa có bảng */ }
    cache = { at: Date.now(), m };
  }
  return cache.m.get(slug) || '';
}
export type Res = { ok: boolean; msg: string };
export async function saveBlock(db: any, o: { slug: string; title: string; html: string; isNew: boolean }): Promise<Res> {
  await ensureBlocks(db);
  const slug = String(o.slug || '').trim().toLowerCase(), title = String(o.title || '').trim().slice(0, 80);
  if (!SLUG.test(slug)) return { ok: false, msg: 'Mã khối 2-40 ký tự: chữ thường không dấu, số, dấu gạch; bắt đầu bằng chữ.' };
  if (!title) return { ok: false, msg: 'Hãy nhập tên khối.' };
  const html = sanitizeHtml(o.html), ex = await first(db, 'SELECT slug FROM reusable_blocks WHERE slug=?', slug);
  if (o.isNew) { if (ex) return { ok: false, msg: 'Đã có khối dùng mã này.' }; await run(db, 'INSERT INTO reusable_blocks (slug,title,html,updated_at) VALUES (?,?,?,?)', slug, title, html, nowIso()); }
  else { if (!ex) return { ok: false, msg: 'Không tìm thấy khối.' }; await run(db, 'UPDATE reusable_blocks SET title=?, html=?, updated_at=? WHERE slug=?', title, html, nowIso(), slug); }
  bust(); return { ok: true, msg: 'Đã lưu khối.' };
}
export async function deleteBlock(db: any, slug: string): Promise<Res> {
  await ensureBlocks(db); await run(db, 'DELETE FROM reusable_blocks WHERE slug=?', slug); bust(); return { ok: true, msg: 'Đã xóa khối.' };
}
// Thay [khoi slug="ten"] trong một đoạn HTML bằng nội dung khối (dùng cho nội dung bài/trang nếu muốn).
export async function expandBlocks(db: any, html: string): Promise<string> {
  const re = /\[khoi\s+slug="([a-z0-9-]{2,40})"\]/g, slugs = [...new Set([...String(html).matchAll(re)].map((m) => m[1]))];
  let out = String(html); for (const s of slugs) out = out.split(`[khoi slug="${s}"]`).join(await getBlockHtml(db, s)); return out;
}
