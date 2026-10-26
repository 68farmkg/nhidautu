// Vai trò tùy chỉnh (bảng roles). Vai trò dựng sẵn admin/editor/support không sửa/xóa được để tránh tự khóa mình.
import { all, first, run, nowIso } from './util';
import { ROLES, ROLE_CAPS, ASSIGNABLE } from './perm';

const ready = new WeakSet<object>();
let cache: { at: number; m: Map<string, string[]> } | null = null;
const bust = () => { cache = null; };
export async function ensureRoles(db: any) {
  if (ready.has(db)) return;
  await run(db, "CREATE TABLE IF NOT EXISTS roles (slug TEXT PRIMARY KEY, name TEXT NOT NULL, caps TEXT DEFAULT '[]', created_at TEXT NOT NULL)");
  ready.add(db);
}
export type RoleRow = { slug: string; name: string; caps: string[]; builtin: boolean };
export const cleanCaps = (a: any): string[] => [...new Set((Array.isArray(a) ? a : []).map(String))].filter((c) => ASSIGNABLE.includes(c));

async function custom(db: any): Promise<Map<string, string[]>> {
  if (cache && Date.now() - cache.at < 30000) return cache.m;
  const m = new Map<string, string[]>();
  try { await ensureRoles(db); for (const r of await all(db, 'SELECT slug,caps FROM roles')) { let c: any = []; try { c = JSON.parse(r.caps); } catch { /* bỏ */ } m.set(r.slug, cleanCaps(c)); } } catch { /* chưa có bảng */ }
  cache = { at: Date.now(), m }; return m;
}
// Quyền của một vai trò: dựng sẵn -> mặc định; tùy chỉnh -> từ DB; vai trò không còn tồn tại -> chỉ tài khoản của tôi.
export async function capsOf(db: any, role: string): Promise<string[]> {
  if (role === 'admin') return [];
  if (ROLE_CAPS[role]) return ROLE_CAPS[role];
  return [...((await custom(db)).get(role) || []), 'self']; // ai cũng được đổi mật khẩu của chính mình
}
export async function listRoles(db: any): Promise<RoleRow[]> {
  const out: RoleRow[] = Object.entries(ROLES).map(([slug, name]) => ({ slug, name, caps: slug === 'admin' ? ['*'] : ROLE_CAPS[slug], builtin: true }));
  try { await ensureRoles(db); for (const r of await all(db, 'SELECT slug,name,caps FROM roles ORDER BY created_at,slug')) { let c: any = []; try { c = JSON.parse(r.caps); } catch { /* bỏ */ } out.push({ slug: r.slug, name: r.name, caps: cleanCaps(c), builtin: false }); } } catch { /* bỏ */ }
  return out;
}
export const roleNames = async (db: any): Promise<Record<string, string>> => Object.fromEntries((await listRoles(db)).map((r) => [r.slug, r.name]));

export type Res = { ok: boolean; msg: string };
export async function saveRole(db: any, o: { slug: string; name: string; caps: any; isNew: boolean }): Promise<Res> {
  await ensureRoles(db);
  const slug = String(o.slug || '').trim().toLowerCase(), name = String(o.name || '').trim().slice(0, 60);
  if (!/^[a-z][a-z0-9-]{1,29}$/.test(slug)) return { ok: false, msg: 'Mã vai trò 2-30 ký tự: chữ thường không dấu, số, dấu gạch; bắt đầu bằng chữ.' };
  if (ROLES[slug]) return { ok: false, msg: 'Mã này trùng vai trò dựng sẵn.' };
  if (!name) return { ok: false, msg: 'Hãy nhập tên vai trò.' };
  const caps = JSON.stringify(cleanCaps(o.caps));
  const ex = await first(db, 'SELECT slug FROM roles WHERE slug=?', slug);
  if (o.isNew) { if (ex) return { ok: false, msg: 'Đã có vai trò dùng mã này.' }; await run(db, 'INSERT INTO roles (slug,name,caps,created_at) VALUES (?,?,?,?)', slug, name, caps, nowIso()); }
  else { if (!ex) return { ok: false, msg: 'Không tìm thấy vai trò.' }; await run(db, 'UPDATE roles SET name=?, caps=? WHERE slug=?', name, caps, slug); }
  bust(); return { ok: true, msg: 'Đã lưu vai trò.' };
}
export async function deleteRole(db: any, slug: string): Promise<Res> {
  await ensureRoles(db);
  if (ROLES[slug]) return { ok: false, msg: 'Không xóa được vai trò dựng sẵn.' };
  let n = 0; try { n = (await first(db, 'SELECT COUNT(*) n FROM users WHERE role=?', slug))?.n || 0; } catch { /* bỏ */ }
  if (n > 0) return { ok: false, msg: `Còn ${n} tài khoản đang dùng vai trò này. Hãy chuyển họ sang vai trò khác trước.` };
  await run(db, 'DELETE FROM roles WHERE slug=?', slug); bust(); return { ok: true, msg: 'Đã xóa vai trò.' };
}
