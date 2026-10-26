// Chuyên mục & Thẻ dùng chung (kiểu WordPress "taxonomy"). Tương thích ngược:
// posts.category vẫn lưu slug chuyên mục chính; thẻ nằm ở bảng post_terms. Không đổi/xóa dữ liệu bài viết cũ.
import { all, first, run, slugify, CATS } from './util';

export type Kind = 'category' | 'tag';
export type Term = { id: number; kind: Kind; slug: string; name: string; descr: string; sort: number; n: number };

const DDL = [
  "CREATE TABLE IF NOT EXISTS terms (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, slug TEXT NOT NULL, name TEXT NOT NULL, descr TEXT DEFAULT '', sort INTEGER DEFAULT 0, UNIQUE(kind, slug))",
  'CREATE TABLE IF NOT EXISTS post_terms (post_id INTEGER NOT NULL, term_id INTEGER NOT NULL, PRIMARY KEY (post_id, term_id))',
  'CREATE INDEX IF NOT EXISTS idx_post_terms_term ON post_terms(term_id)',
];
const ready = new WeakSet<object>();
let cache: { at: number; v: Record<string, string> } | null = null;
const bust = () => { cache = null; };

export async function ensureTerms(db: any) {
  if (ready.has(db)) return;
  for (const s of DDL) await run(db, s);
  const has = await first(db, "SELECT id FROM terms WHERE kind='category' LIMIT 1");
  if (!has) {
    let i = 0;
    for (const [slug, name] of Object.entries(CATS)) await run(db, "INSERT OR IGNORE INTO terms (kind,slug,name,sort) VALUES ('category',?,?,?)", slug, name, ++i);
    // giữ các slug chuyên mục đang được bài viết cũ dùng
    for (const r of await all(db, "SELECT DISTINCT category c FROM posts WHERE category<>''")) if (r.c && !(r.c in CATS)) await run(db, "INSERT OR IGNORE INTO terms (kind,slug,name,sort) VALUES ('category',?,?,?)", r.c, r.c, ++i);
  }
  ready.add(db);
}

// Bản đồ slug -> tên chuyên mục (có bộ nhớ đệm 30 giây; rơi về CATS cũ nếu bảng chưa có).
export async function getCats(db: any): Promise<Record<string, string>> {
  if (cache && Date.now() - cache.at < 30000) return cache.v;
  try {
    await ensureTerms(db);
    const rows = await all(db, "SELECT slug,name FROM terms WHERE kind='category' ORDER BY sort,id");
    if (rows.length) { const v: Record<string, string> = {}; for (const r of rows) v[r.slug] = r.name; cache = { at: Date.now(), v }; return v; }
  } catch { /* dùng bản cũ */ }
  return { ...CATS };
}

export async function listTerms(db: any, kind: Kind): Promise<Term[]> {
  await ensureTerms(db);
  const cnt = kind === 'category' ? 'SELECT COUNT(*) FROM posts p WHERE p.category=t.slug' : 'SELECT COUNT(*) FROM post_terms x WHERE x.term_id=t.id';
  return all(db, `SELECT t.*, (${cnt}) n FROM terms t WHERE t.kind=? ORDER BY ${kind === 'category' ? 't.sort,t.id' : 't.name COLLATE NOCASE'}`, kind);
}

export type Res = { ok: boolean; msg: string; id?: number };
export async function saveTerm(db: any, kind: Kind, o: { id?: number; name: string; slug?: string; descr?: string }): Promise<Res> {
  await ensureTerms(db);
  const name = (o.name || '').trim().slice(0, 60), descr = (o.descr || '').trim().slice(0, 300);
  if (!name) return { ok: false, msg: 'Hãy nhập tên.' };
  if (o.id) { // đổi tên/mô tả; slug giữ nguyên để không làm gãy bài viết và đường dẫn đang có
    const t = await first(db, 'SELECT id FROM terms WHERE id=? AND kind=?', o.id, kind);
    if (!t) return { ok: false, msg: 'Không tìm thấy mục này.' };
    await run(db, 'UPDATE terms SET name=?, descr=? WHERE id=?', name, descr, o.id); bust();
    return { ok: true, msg: 'Đã lưu.', id: o.id };
  }
  const slug = slugify(o.slug || name);
  if (await first(db, 'SELECT id FROM terms WHERE kind=? AND slug=?', kind, slug)) return { ok: false, msg: `Đã có mục dùng đường dẫn “${slug}”.` };
  const mx = await first(db, 'SELECT COALESCE(MAX(sort),0) m FROM terms WHERE kind=?', kind);
  const r = await run(db, 'INSERT INTO terms (kind,slug,name,descr,sort) VALUES (?,?,?,?,?)', kind, slug, name, descr, (mx?.m || 0) + 1); bust();
  return { ok: true, msg: 'Đã thêm.', id: r.meta.last_row_id };
}

export async function moveTerm(db: any, id: number, dir: 'up' | 'down'): Promise<Res> {
  await ensureTerms(db);
  const t = await first(db, "SELECT * FROM terms WHERE id=? AND kind='category'", id);
  if (!t) return { ok: false, msg: 'Không tìm thấy.' };
  const rows = await all(db, "SELECT id FROM terms WHERE kind='category' ORDER BY sort,id");
  const ids = rows.map((r) => r.id), i = ids.indexOf(id), j = dir === 'up' ? i - 1 : i + 1;
  if (j < 0 || j >= ids.length) return { ok: true, msg: '' };
  [ids[i], ids[j]] = [ids[j], ids[i]];
  for (let k = 0; k < ids.length; k++) await run(db, 'UPDATE terms SET sort=? WHERE id=?', k + 1, ids[k]);
  bust(); return { ok: true, msg: '' };
}

// Xóa chuyên mục: bài viết KHÔNG bị xóa, được chuyển sang chuyên mục còn lại đầu tiên. Không cho xóa chuyên mục cuối cùng.
export async function deleteTerm(db: any, id: number): Promise<Res> {
  await ensureTerms(db);
  const t = await first(db, 'SELECT * FROM terms WHERE id=?', id);
  if (!t) return { ok: false, msg: 'Không tìm thấy mục này.' };
  if (t.kind === 'tag') { await run(db, 'DELETE FROM post_terms WHERE term_id=?', id); await run(db, 'DELETE FROM terms WHERE id=?', id); bust(); return { ok: true, msg: 'Đã xóa thẻ (bài viết vẫn giữ nguyên).' }; }
  const others = await all(db, "SELECT slug,name FROM terms WHERE kind='category' AND id<>? ORDER BY sort,id", id);
  if (!others.length) return { ok: false, msg: 'Phải còn ít nhất một chuyên mục.' };
  const to = others.find((o) => o.slug === 'thi-truong') || others[0];
  const m = await first(db, 'SELECT COUNT(*) n FROM posts WHERE category=?', t.slug);
  await run(db, 'UPDATE posts SET category=? WHERE category=?', to.slug, t.slug);
  await run(db, 'DELETE FROM terms WHERE id=?', id); bust();
  return { ok: true, msg: `Đã xóa chuyên mục. ${m?.n || 0} bài được chuyển sang “${to.name}”.` };
}

// Xử lý form quản trị dùng chung cho 2 trang (act: save | delete | up | down).
export async function handleTermsPost(db: any, kind: Kind, f: FormData): Promise<Res> {
  const act = String(f.get('act') || 'save'), id = Number(f.get('id')) || 0;
  if (act === 'delete') return deleteTerm(db, id);
  if (act === 'up' || act === 'down') return moveTerm(db, id, act);
  return saveTerm(db, kind, { id: id || undefined, name: String(f.get('name') || ''), slug: String(f.get('slug') || ''), descr: String(f.get('descr') || '') });
}

// ---- Thẻ của bài viết ----
export function parseTags(s: string): { name: string; slug: string }[] {
  const out: { name: string; slug: string }[] = [], seen = new Set<string>();
  for (const raw of String(s || '').split(/[,\n]/)) {
    const name = raw.trim().replace(/\s+/g, ' ').slice(0, 40); if (!name) continue;
    const slug = slugify(name); if (seen.has(slug)) continue;
    seen.add(slug); out.push({ name, slug }); if (out.length >= 30) break;
  }
  return out;
}
export async function setPostTags(db: any, postId: number, input: string) {
  await ensureTerms(db);
  await run(db, "DELETE FROM post_terms WHERE post_id=? AND term_id IN (SELECT id FROM terms WHERE kind='tag')", postId);
  for (const t of parseTags(input)) {
    await run(db, "INSERT OR IGNORE INTO terms (kind,slug,name) VALUES ('tag',?,?)", t.slug, t.name);
    const row = await first(db, "SELECT id FROM terms WHERE kind='tag' AND slug=?", t.slug);
    if (row) await run(db, 'INSERT OR IGNORE INTO post_terms (post_id,term_id) VALUES (?,?)', postId, row.id);
  }
}
export async function getPostTags(db: any, postId: number): Promise<{ slug: string; name: string }[]> {
  try { await ensureTerms(db); return await all(db, "SELECT t.slug,t.name FROM post_terms x JOIN terms t ON t.id=x.term_id WHERE x.post_id=? AND t.kind='tag' ORDER BY t.name COLLATE NOCASE", postId); } catch { return []; }
}
export async function tagBySlug(db: any, slug: string) { await ensureTerms(db); return first(db, "SELECT * FROM terms WHERE kind='tag' AND slug=?", slug); }
export async function postsByTag(db: any, termId: number, nowIso: string, limit: number, offset: number) {
  return all(db, "SELECT p.id,p.slug,p.title,p.summary,p.image,p.category,p.published_at FROM posts p JOIN post_terms x ON x.post_id=p.id WHERE x.term_id=? AND p.status='published' AND p.published_at<=? ORDER BY p.published_at DESC LIMIT ? OFFSET ?", termId, nowIso, limit, offset);
}
