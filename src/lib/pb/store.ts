// Page Builder Pro: lưu trữ trên D1. Bảng px_page_builder_* (cùng định nghĩa trong migration của plugin và nang-cap-6-pb.sql).
// Bảng lõi pages/revisions được dùng lại; Pro chỉ GHI vào pages khi người dùng bấm Xuất bản.
import { all, first, run, nowIso, slugify } from '../util';
import { RESERVED, docFromPage, type Doc } from './schema';

import { DDL } from './ddl';
export { DDL };
let ready = false;
export async function ensurePb(db: any) { if (ready) return; for (const q of DDL) await db.prepare(q).run(); ready = true; }
export const resetReady = () => { ready = false; };
export const MAX_VERSIONS = 50;

export async function getPage(db: any, id: number) { return id ? first(db, 'SELECT * FROM pages WHERE id=?', id) : null; }
export async function getLiveDoc(db: any, id: number): Promise<Doc | null> {
  const p = await getPage(db, id); if (!p) return null;
  let m: any = null; try { m = await first(db, 'SELECT meta,side FROM px_page_builder_meta WHERE page_id=?', id); } catch { /* chưa có */ }
  return docFromPage(p, m);
}
export async function getDraft(db: any, id: number): Promise<{ doc: Doc; updated_at: string; by: string } | null> {
  const r = await first(db, 'SELECT doc,updated_at,by FROM px_page_builder_drafts WHERE page_id=?', id); if (!r) return null;
  try { return { doc: JSON.parse(r.doc), updated_at: r.updated_at, by: r.by }; } catch { return null; }
}
export const saveDraft = (db: any, id: number, doc: Doc, by: string) =>
  run(db, 'INSERT INTO px_page_builder_drafts (page_id,doc,by,updated_at) VALUES (?,?,?,?) ON CONFLICT(page_id) DO UPDATE SET doc=excluded.doc,by=excluded.by,updated_at=excluded.updated_at', id, JSON.stringify(doc), by, nowIso());
export const deleteDraft = (db: any, id: number) => run(db, 'DELETE FROM px_page_builder_drafts WHERE page_id=?', id);

export async function uniqueSlug(db: any, slug: string, exceptId: number) {
  let s = RESERVED.includes(slug) ? slug + '-trang' : slug;
  const dup = await first(db, 'SELECT id FROM pages WHERE slug=? AND id<>?', s, exceptId);
  if (dup) s += '-' + Date.now().toString(36);
  return s;
}
export async function createPage(db: any, doc: Doc): Promise<{ id: number; slug: string }> {
  const slug = await uniqueSlug(db, doc.slug || slugify(doc.title), 0), t = nowIso();
  const r = await run(db, 'INSERT INTO pages (slug,title,blocks,status,is_template,show_header,show_footer,seo_title,seo_desc,seo_image,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
    slug, doc.title, JSON.stringify(doc.blocks), 'draft', doc.is_template ? 1 : 0, doc.show_header ? 1 : 0, doc.show_footer ? 1 : 0, doc.seo.title, doc.seo.desc, doc.seo.image, t, t);
  const id = Number(r.meta.last_row_id);
  await run(db, 'INSERT OR REPLACE INTO px_page_builder_meta (page_id,meta,side,updated_at) VALUES (?,?,?,?)', id, JSON.stringify(doc.meta), JSON.stringify(doc.side), t);
  return { id, slug };
}
// Xuất bản: ghi vào bảng pages (bản đang chạy) + meta Pro. Bản đang chạy trước đó được lưu thành phiên bản nếu chưa có (không mất dữ liệu).
export async function publishDoc(db: any, id: number, doc: Doc, by: string, note = '', publish = true): Promise<{ slug: string }> {
  const live = await getLiveDoc(db, id);
  const haveV = await first(db, 'SELECT COUNT(*) n FROM px_page_builder_versions WHERE page_id=?', id);
  if (live && !haveV?.n) await addVersion(db, id, live, 'import', 'Bản trước khi dùng Page Builder Pro', by);
  const slug = await uniqueSlug(db, doc.slug || slugify(doc.title), id), t = nowIso();
  const final: Doc = { ...doc, slug };
  await run(db, 'UPDATE pages SET slug=?,title=?,blocks=?,status=?,is_template=?,show_header=?,show_footer=?,seo_title=?,seo_desc=?,seo_image=?,updated_at=? WHERE id=?',
    slug, doc.title, JSON.stringify(doc.blocks), publish ? 'published' : 'draft', doc.is_template ? 1 : 0, doc.show_header ? 1 : 0, doc.show_footer ? 1 : 0, doc.seo.title, doc.seo.desc, doc.seo.image, t, id);
  await run(db, 'INSERT OR REPLACE INTO px_page_builder_meta (page_id,meta,side,updated_at) VALUES (?,?,?,?)', id, JSON.stringify(doc.meta), JSON.stringify(doc.side), t);
  await addVersion(db, id, final, publish ? 'publish' : 'save', note, by);
  await deleteDraft(db, id);
  return { slug };
}
export async function unpublish(db: any, id: number) { await run(db, "UPDATE pages SET status='draft',updated_at=? WHERE id=?", nowIso(), id); }

export async function addVersion(db: any, pageId: number, doc: Doc, kind: string, note: string, by: string) {
  await run(db, 'INSERT INTO px_page_builder_versions (page_id,doc,kind,note,by,created_at) VALUES (?,?,?,?,?,?)', pageId, JSON.stringify(doc), kind, String(note || '').slice(0, 200), by, nowIso());
  await run(db, `DELETE FROM px_page_builder_versions WHERE page_id=? AND id NOT IN (SELECT id FROM px_page_builder_versions WHERE page_id=? ORDER BY id DESC LIMIT ${MAX_VERSIONS})`, pageId, pageId);
}
export const listVersions = (db: any, pageId: number) => all(db, 'SELECT id,kind,note,by,created_at,LENGTH(doc) size FROM px_page_builder_versions WHERE page_id=? ORDER BY id DESC LIMIT 50', pageId);
export async function getVersion(db: any, pageId: number, vid: number): Promise<Doc | null> {
  const r = await first(db, 'SELECT doc FROM px_page_builder_versions WHERE id=? AND page_id=?', vid, pageId); if (!r) return null;
  try { return JSON.parse(r.doc); } catch { return null; }
}

// ===== Mẫu (trang/khối) =====
export type TplRow = { id: number; name: string; kind: string; category: string; descr: string; doc: string; shared: number; owner: string; created_at: string };
export const listTemplates = (db: any, uid: string, admin: boolean) =>
  all(db, 'SELECT id,name,kind,category,descr,doc,shared,owner,created_at FROM px_page_builder_templates WHERE shared=1 OR owner=? OR ?=1 ORDER BY id DESC LIMIT 200', uid, admin ? 1 : 0) as Promise<TplRow[]>;
export const getTemplate = (db: any, id: number) => first(db, 'SELECT * FROM px_page_builder_templates WHERE id=?', id) as Promise<TplRow | null>;
export async function saveTemplate(db: any, t: { name: string; kind: string; category: string; descr: string; doc: any; shared: boolean; owner: string }) {
  const r = await run(db, 'INSERT INTO px_page_builder_templates (name,kind,category,descr,doc,shared,owner,created_at) VALUES (?,?,?,?,?,?,?,?)', t.name.slice(0, 80), t.kind === 'block' ? 'block' : 'page', t.category.slice(0, 30) || 'khac', t.descr.slice(0, 200), JSON.stringify(t.doc), t.shared ? 1 : 0, t.owner, nowIso());
  return Number(r.meta.last_row_id);
}
export const deleteTemplate = (db: any, id: number) => run(db, 'DELETE FROM px_page_builder_templates WHERE id=?', id);

// ===== Khối dùng chung =====
export const listReusable = (db: any) => all(db, 'SELECT id,name,owner,created_at,updated_at FROM px_page_builder_reusable ORDER BY id DESC LIMIT 200');
export const getReusable = (db: any, id: number) => first(db, 'SELECT * FROM px_page_builder_reusable WHERE id=?', id);
export async function saveReusable(db: any, name: string, block: any, owner: string) {
  const r = await run(db, 'INSERT INTO px_page_builder_reusable (name,block,owner,created_at,updated_at) VALUES (?,?,?,?,?)', name.slice(0, 80), JSON.stringify(block), owner, nowIso(), nowIso());
  return Number(r.meta.last_row_id);
}
export const updateReusable = (db: any, id: number, block: any) => run(db, 'UPDATE px_page_builder_reusable SET block=?,updated_at=? WHERE id=?', JSON.stringify(block), nowIso(), id);
export const deleteReusable = (db: any, id: number) => run(db, 'DELETE FROM px_page_builder_reusable WHERE id=?', id);
export async function reusableUsage(db: any, id: number): Promise<number> {
  const r = await first(db, 'SELECT COUNT(*) n FROM pages WHERE blocks LIKE ?', `%"type":"pb-reusable"%"ref":${Number(id)}%`).catch(() => null);
  return r?.n || 0;
}

// ===== Danh mục trang =====
export type Cat = { id: number; name: string; slug: string; descr: string; sort: number; n?: number };
export const listCats = (db: any) => all(db, "SELECT c.id,c.name,c.slug,c.descr,c.sort,(SELECT COUNT(*) FROM px_page_builder_meta m JOIN pages p ON p.id=m.page_id WHERE json_extract(m.meta,'$.cat')=c.id AND p.is_template=0) n FROM px_page_builder_cats c ORDER BY c.sort,c.id") as Promise<Cat[]>;
export const getCat = (db: any, id: number) => first(db, 'SELECT * FROM px_page_builder_cats WHERE id=?', id) as Promise<Cat | null>;
export async function addCat(db: any, name: string, descr = ''): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  name = name.trim().slice(0, 60); if (!name) return { ok: false, error: 'Hãy nhập tên danh mục.' };
  if (await first(db, 'SELECT id FROM px_page_builder_cats WHERE lower(name)=lower(?)', name)) return { ok: false, error: 'Danh mục này đã có.' };
  let slug = slugify(name) || 'danh-muc'; if (await first(db, 'SELECT id FROM px_page_builder_cats WHERE slug=?', slug)) slug += '-' + Date.now().toString(36);
  const mx = await first(db, 'SELECT COALESCE(MAX(sort),0)+1 n FROM px_page_builder_cats');
  const r = await run(db, 'INSERT INTO px_page_builder_cats (name,slug,descr,sort,created_at) VALUES (?,?,?,?,?)', name, slug, descr.slice(0, 200), mx?.n || 1, nowIso());
  return { ok: true, id: Number(r.meta.last_row_id) };
}
export async function renameCat(db: any, id: number, name: string, descr: string) {
  name = name.trim().slice(0, 60); if (!name) return 'Hãy nhập tên danh mục.';
  if (await first(db, 'SELECT id FROM px_page_builder_cats WHERE lower(name)=lower(?) AND id<>?', name, id)) return 'Đã có danh mục trùng tên.';
  await run(db, 'UPDATE px_page_builder_cats SET name=?,descr=? WHERE id=?', name, descr.slice(0, 200), id); return '';
}
export async function moveCat(db: any, id: number, dir: -1 | 1) {
  const l = await all(db, 'SELECT id FROM px_page_builder_cats ORDER BY sort,id'), i = l.findIndex((x: any) => x.id === id), j = i + dir; if (i < 0 || j < 0 || j >= l.length) return;
  [l[i], l[j]] = [l[j], l[i]]; for (let k = 0; k < l.length; k++) await run(db, 'UPDATE px_page_builder_cats SET sort=? WHERE id=?', k + 1, l[k].id);
}
// Xóa danh mục: các trang thuộc danh mục về "chưa phân loại" (không xóa trang)
export async function deleteCat(db: any, id: number) {
  await run(db, "UPDATE px_page_builder_meta SET meta=json_set(meta,'$.cat',0) WHERE json_extract(meta,'$.cat')=?", id);
  await run(db, 'DELETE FROM px_page_builder_cats WHERE id=?', id);
}
export async function setPageCat(db: any, pageId: number, cat: number) {
  await run(db, "INSERT INTO px_page_builder_meta (page_id,meta,side,updated_at) VALUES (?,json_object('cat',?),'[]',?) ON CONFLICT(page_id) DO UPDATE SET meta=json_set(CASE WHEN json_valid(meta) THEN meta ELSE '{}' END,'$.cat',?),updated_at=?", pageId, cat, nowIso(), cat, nowIso());
}
