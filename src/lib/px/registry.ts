// Plugin Registry + vòng đời. Hợp nhất: plugin mã nguồn (src/plugins) và gói ZIP khai báo (D1).
// Nguyên tắc: chưa chạy nang-cap-4.sql -> mọi plugin mã nguồn coi như đang bật (không đổi hành vi cũ).
import { PLUGINS, type Plugin } from '../plugins';
import type { BlockDef } from '../blocks';
import { validateManifest, verGt, NHIP_API, PERMS, type Manifest, type Field } from './manifest';
import { tpl, scopeCss } from './tpl';
import { sanitizeHtml, sandboxFrame } from './sanitize';
import { esc } from '../esc';

export type Status = 'available' | 'installing' | 'inactive' | 'active' | 'failed' | 'incompatible' | 'uninstalling' | 'uninstalled';
export type Entry = {
  id: string; name: string; version: string; desc: string; icon: string; category: string; author: string; runtime: 'builtin' | 'package';
  status: Status; installed: boolean; active: boolean; error: string; granted: string[]; declared: string[]; requires: string[];
  settings: Field[]; builtin?: Plugin; manifest?: Manifest; prev_version: string; staged_version?: string; staged_perms?: string[]; hasUpdate: boolean; updated_at: string;
  caps: string[];
};
type St = { t: number; ready: boolean; rows: Map<string, any>; pkgs: Map<string, { installed?: Manifest; latest: Manifest }>; settings: Map<string, Record<string, string>>; place: Map<string, any> };
let ST: St | null = null;
export const bust = () => { ST = null; };
const nowIso = () => new Date().toISOString();

async function load(db: any): Promise<St> {
  if (ST && Date.now() - ST.t < 10000) return ST;
  const s: St = { t: Date.now(), ready: false, rows: new Map(), pkgs: new Map(), settings: new Map(), place: new Map() };
  try {
    const rows = (await db.prepare('SELECT * FROM plugin_installs').all()).results as any[];
    for (const r of rows) s.rows.set(r.id, r);
    s.ready = true;
    const pk = (await db.prepare('SELECT id,version,manifest FROM plugin_packages').all()).results as any[];
    for (const p of pk) {
      const v = validateManifest(safeJson(p.manifest)); if (!v.ok) continue;
      const cur = s.pkgs.get(p.id) || { latest: v.m }; const row = s.rows.get(p.id);
      if (verGt(v.m.version, cur.latest.version)) cur.latest = v.m;
      if (row && row.version === v.m.version) cur.installed = v.m;
      s.pkgs.set(p.id, cur);
    }
    for (const r of (await db.prepare('SELECT plugin_id,k,v FROM plugin_settings').all()).results as any[]) { (s.settings.get(r.plugin_id) || s.settings.set(r.plugin_id, {}).get(r.plugin_id)!)[r.k] = r.v; }
    for (const r of (await db.prepare('SELECT * FROM plugin_placements').all()).results as any[]) s.place.set(`${r.plugin_id}/${r.slot_id}`, r);
  } catch { /* chưa chạy nang-cap-4.sql: ready=false */ }
  ST = s; return s;
}
const safeJson = (t: string) => { try { return JSON.parse(t); } catch { return null; } };

export async function isReady(db: any) { return (await load(db)).ready; }
export async function listEntries(db: any): Promise<Entry[]> {
  const s = await load(db), out: Entry[] = [];
  for (const p of PLUGINS) {
    const r = s.rows.get(p.id);
    const dflt: Status = p.defaultOff ? 'available' : 'active';
    const status: Status = !s.ready ? dflt : r ? (r.status as Status) : dflt;
    const installed = status !== 'uninstalled' && status !== 'available';
    out.push({ id: p.id, name: p.name, version: p.version || '1.0', desc: p.desc || '', icon: p.icon || 'puzzle', category: p.category || 'Khác', author: p.author || 'Nhịp Đầu Tư', runtime: 'builtin',
      status: installed ? status : 'available', installed, active: installed && status === 'active', error: r?.error || '', granted: safeJson(r?.perms || '[]') || [], declared: p.permissions || [], requires: p.requires || [],
      settings: p.settings || [], builtin: p, prev_version: r?.prev_version || '', hasUpdate: false, updated_at: r?.updated_at || '',
      caps: [p.blocks?.length ? `${p.blocks.length} khối` : '', p.admin ? 'trang admin' : '', p.slots?.length ? `${p.slots.length} vị trí` : '', p.routes?.length ? 'API' : '', p.migrations?.length ? 'dữ liệu riêng' : ''].filter(Boolean) });
  }
  for (const [id, k] of s.pkgs) {
    if (PLUGINS.some((p) => p.id === id)) continue; // không cho gói ZIP đè plugin mã nguồn
    const r = s.rows.get(id), m = k.installed || k.latest, installed = !!r && r.status !== 'uninstalled';
    out.push({ id, name: m.name, version: m.version, desc: m.description, icon: m.icon, category: m.category, author: m.author || 'Không rõ', runtime: 'package',
      status: installed ? r.status : 'available', installed, active: installed && r.status === 'active', error: r?.error || '', granted: safeJson(r?.perms || '[]') || [], declared: m.permissions, requires: m.requires,
      settings: m.settings, manifest: m, prev_version: r?.prev_version || '', staged_version: installed && verGt(k.latest.version, m.version) ? k.latest.version : undefined, staged_perms: k.latest.permissions,
      hasUpdate: installed && verGt(k.latest.version, m.version), updated_at: r?.updated_at || '',
      caps: [m.blocks.length ? `${m.blocks.length} khối` : '', m.slots.length ? `${m.slots.length} vị trí` : '', m.adminPages.length ? 'trang admin' : ''].filter(Boolean) });
  }
  return out;
}
export async function getEntry(db: any, id: string) { return (await listEntries(db)).find((e) => e.id === id) || null; }
export async function getSettings(db: any, e: Entry): Promise<Record<string, string>> {
  const s = await load(db), o: Record<string, string> = {};
  for (const f of e.settings) o[f.k] = f.def === undefined || f.def === null ? '' : String(f.def);
  return Object.assign(o, s.settings.get(e.id) || {});
}

// ===== Nhật ký =====
export async function logPx(db: any, id: string, action: string, detail = '', actor = '') {
  try { await db.prepare('INSERT INTO plugin_logs (plugin_id,action,detail,actor,created_at) VALUES (?,?,?,?,?)').bind(id, action, String(detail).slice(0, 500), actor, nowIso()).run(); } catch { /* bỏ */ }
}

// ===== Khối (blocks) =====
function pkgBlockDef(m: Manifest, b: Manifest['blocks'][number], inactive: boolean): BlockDef & { inactive?: boolean } {
  const scope = `.px-${m.id}-${b.type.split('--')[1]}`;
  return { type: b.type, label: b.label + (inactive ? ' (plugin đang tắt)' : ''), icon: b.icon, group: b.group, fields: b.fields as any, inactive,
    render: async (p, c: any) => {
      const vars: Record<string, any> = {}; for (const f of b.fields) vars[f.k] = p[f.k] ?? f.def ?? '';
      const css = b.css ? scopeCss(b.css, scope) : '';
      return `${css ? `<style>${css}</style>` : ''}<div class="${scope.slice(1)}">${sanitizeHtml(tpl(b.template, vars))}</div>`;
    } } as any;
}
// Danh sách định nghĩa khối: active=true chỉ gồm plugin đang bật; false = tất cả (để giữ bố cục khi plugin tắt)
export async function blockDefs(db: any, onlyActive = true): Promise<(BlockDef & { inactive?: boolean })[]> {
  const es = await listEntries(db), out: (BlockDef & { inactive?: boolean })[] = [];
  for (const e of es) {
    if (!e.installed) continue;
    const on = e.active;
    if (onlyActive && !on) continue;
    if (e.builtin) for (const b of e.builtin.blocks || []) out.push(on ? b : { ...b, label: b.label + ' (plugin đang tắt)', inactive: true } as any);
    if (e.manifest) for (const b of e.manifest.blocks) out.push(pkgBlockDef(e.manifest, b, !on));
  }
  return out;
}
// Số trang đang dùng khối của plugin (kiểm tra phụ thuộc trước khi tắt/gỡ)
export async function pagesUsing(db: any, e: Entry): Promise<number> {
  const types = [...(e.builtin?.blocks || []).map((b) => b.type), ...(e.manifest?.blocks || []).map((b) => b.type)];
  if (!types.length) return 0;
  try {
    const q = types.map(() => 'blocks LIKE ?').join(' OR ');
    const r: any = await db.prepare(`SELECT COUNT(*) n FROM pages WHERE ${q}`).bind(...types.map((t) => `%"type":"${t.replace(/[%_"\\]/g, '')}"%`)).first();
    return r?.n || 0;
  } catch { return 0; }
}

// ===== Vị trí hiển thị (slots) trên giao diện khách =====
const pageMatch = (rule: string, path: string) => { const r = String(rule || '').split(/[\s,]+/).filter(Boolean); return !r.length || r.some((x) => x === '*' || x === path || (x.endsWith('*') && path.startsWith(x.slice(0, -1)))); };
export async function renderSlot(db: any, slot: string, url: URL): Promise<string> {
  let es: Entry[]; try { es = (await listEntries(db)).filter((e) => e.active); } catch { return ''; }
  const s = await load(db), items: { sort: number; html: string }[] = [];
  for (const e of es) {
    const cfg = await getSettings(db, e);
    const defs: { id: string; slot: string; pages: string; run: () => Promise<string> | string }[] = [];
    for (const d of e.builtin?.slots || []) defs.push({ id: d.id, slot: d.slot, pages: d.pages || '', run: () => d.render({ db, settings: cfg, url }) });
    for (const d of e.manifest?.slots || []) defs.push({ id: d.id, slot: d.slot, pages: d.pages || '', run: () => {
      const vars = { ...cfg }; const scope = `px-${e.id}-${d.id}`; const css = d.css ? scopeCss(d.css, '.' + scope) : '';
      if (d.js) return sandboxFrame(`<style>${(d.css || '').replace(/<\/style/gi, '')}</style>${tpl(d.template, vars)}<script>${(d.js || '').replace(/<\/script/gi, '<\\/script')}</script>`, d.height || 200, d.label);
      return `${css ? `<style>${css}</style>` : ''}<div class="${scope}">${sanitizeHtml(tpl(d.template, vars))}</div>`; } });
    for (const d of defs) {
      if (d.slot !== slot) continue;
      const pl = s.place.get(`${e.id}/${d.id}`);
      if (pl && !pl.enabled) continue;
      if (!pageMatch(pl?.pages || d.pages, url.pathname)) continue;
      try { items.push({ sort: pl?.sort ?? 0, html: `<div class="px-slot" data-px="${esc(e.id)}">${await d.run()}</div>` }); } catch { /* một plugin lỗi không làm hỏng trang */ }
    }
  }
  return items.sort((a, b) => a.sort - b.sort).map((i) => i.html).join('');
}
export async function slotList(db: any, e: Entry) {
  const s = await load(db);
  const raw = [...(e.builtin?.slots || []).map((d) => ({ id: d.id, slot: d.slot, label: d.label, pages: d.pages || '' })), ...(e.manifest?.slots || []).map((d) => ({ id: d.id, slot: d.slot, label: d.label, pages: d.pages || '' }))];
  return raw.map((d) => { const p = s.place.get(`${e.id}/${d.id}`); return { ...d, enabled: p ? !!p.enabled : true, sort: p?.sort ?? 0, pagesCfg: p?.pages ?? d.pages }; });
}
export async function savePlacement(db: any, id: string, slotId: string, enabled: boolean, sort: number, pages: string, actor: string) {
  await db.prepare('INSERT INTO plugin_placements (plugin_id,slot_id,enabled,sort,pages) VALUES (?,?,?,?,?) ON CONFLICT(plugin_id,slot_id) DO UPDATE SET enabled=excluded.enabled,sort=excluded.sort,pages=excluded.pages')
    .bind(id, slotId, enabled ? 1 : 0, Math.max(-99, Math.min(99, sort | 0)), pages.slice(0, 300)).run();
  bust(); await logPx(db, id, 'placement', `${slotId}: ${enabled ? 'bật' : 'tắt'}, thứ tự ${sort}`, actor);
}

// ===== Hooks / sự kiện (có giới hạn thời gian, lỗi không làm hỏng luồng chính) =====
export async function emit(db: any, event: string, payload: any = {}) {
  let es: Entry[]; try { es = (await listEntries(db)).filter((e) => e.active && e.builtin?.hooks?.[event]); } catch { return; }
  await Promise.all(es.map(async (e) => {
    try { const cfg = await getSettings(db, e); await Promise.race([Promise.resolve(e.builtin!.hooks![event](payload, { db, settings: cfg })), new Promise((_, r) => setTimeout(() => r(new Error('quá thời gian 2 giây')), 2000))]); }
    catch (x: any) { await logPx(db, e.id, 'hook-error', `${event}: ${x?.message || x}`); }
  }));
}

// ===== Vòng đời =====
type R = { ok: boolean; msg: string };
const prefix = (id: string) => `px_${id.replace(/-/g, '_')}_`;
const SQL_OK = (id: string, s: string) => new RegExp(`^\\s*CREATE (TABLE|INDEX|UNIQUE INDEX) IF NOT EXISTS\\s+${prefix(id)}\\w+`, 'i').test(s) && !/;\s*\S/.test(s.trim()) && !/\b(DROP|DELETE|UPDATE|ATTACH|PRAGMA)\b/i.test(s);
async function setRow(db: any, e: Entry, status: Status, patch: { error?: string; perms?: string[]; version?: string; prev?: string } = {}) {
  const t = nowIso(), ex = await db.prepare('SELECT id FROM plugin_installs WHERE id=?').bind(e.id).first();
  if (!ex) await db.prepare('INSERT INTO plugin_installs (id,name,version,prev_version,runtime,status,perms,error,installed_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .bind(e.id, e.name, patch.version || e.version, patch.prev || '', e.runtime, status, JSON.stringify(patch.perms || e.granted || []), patch.error || '', t, t).run();
  else await db.prepare('UPDATE plugin_installs SET name=?,version=?,prev_version=?,status=?,perms=?,error=?,updated_at=? WHERE id=?')
    .bind(e.name, patch.version || e.version, patch.prev ?? e.prev_version, status, JSON.stringify(patch.perms || e.granted || []), patch.error || '', t, e.id).run();
  bust();
}
async function runMigrations(db: any, e: Entry): Promise<string> {
  for (const m of e.builtin?.migrations || []) {
    const done = await db.prepare('SELECT ok FROM plugin_migrations WHERE plugin_id=? AND mig_id=? AND ok=1').bind(e.id, m.id).first();
    if (done) continue;
    for (const q of m.sql) if (!SQL_OK(e.id, q)) { const err = `Câu SQL không hợp lệ (chỉ CREATE ... IF NOT EXISTS với bảng ${prefix(e.id)}*)`; await db.prepare('INSERT OR REPLACE INTO plugin_migrations (plugin_id,mig_id,ok,err,applied_at) VALUES (?,?,0,?,?)').bind(e.id, m.id, err, nowIso()).run(); return err; }
    try { await db.batch(m.sql.map((q) => db.prepare(q))); await db.prepare('INSERT OR REPLACE INTO plugin_migrations (plugin_id,mig_id,ok,err,applied_at) VALUES (?,?,1,?,?)').bind(e.id, m.id, '', nowIso()).run(); }
    catch (x: any) { const err = String(x?.message || x).slice(0, 300); await db.prepare('INSERT OR REPLACE INTO plugin_migrations (plugin_id,mig_id,ok,err,applied_at) VALUES (?,?,0,?,?)').bind(e.id, m.id, err, nowIso()).run(); return `Migration ${m.id} lỗi: ${err}`; }
  }
  return '';
}
function checkCompat(e: Entry, all: Entry[]): string {
  const api = e.builtin?.api ?? e.manifest?.api ?? NHIP_API;
  if (api > NHIP_API) return `Cần API plugin ${api}, website hỗ trợ tới ${NHIP_API}`;
  for (const r of e.requires) { const d = all.find((x) => x.id === r); if (!d || !d.active) return `Cần bật plugin "${r}" trước`; }
  for (const p of e.declared) if (!PERMS[p]) return `Quyền không hỗ trợ: ${p}`;
  return '';
}
export async function installOrActivate(db: any, id: string, actor: string, grant: string[]): Promise<R> {
  const all = await listEntries(db), e = all.find((x) => x.id === id);
  if (!e) return { ok: false, msg: 'Không tìm thấy plugin' };
  if (!(await isReady(db))) return { ok: false, msg: 'Chưa chạy nang-cap-4.sql trong D1' };
  const miss = e.declared.filter((p) => !grant.includes(p) && !e.granted.includes(p));
  if (miss.length) return { ok: false, msg: 'Cần xác nhận cấp quyền: ' + miss.join(', ') };
  const bad = checkCompat(e, all);
  if (bad) { if (!e.installed) await setRow(db, e, 'incompatible', { error: bad, perms: [] }); await logPx(db, id, 'incompatible', bad, actor); return { ok: false, msg: bad }; }
  const wasNew = !e.installed;
  await setRow(db, e, 'installing', { perms: e.declared });
  const err = await runMigrations(db, e);
  if (err) { await setRow(db, e, 'failed', { error: err, perms: e.declared }); await logPx(db, id, 'install-failed', err, actor); return { ok: false, msg: err }; }
  await setRow(db, e, 'active', { perms: e.declared }); await logPx(db, id, wasNew ? 'install' : 'activate', `v${e.version}`, actor);
  await emit(db, 'plugin.activated', { id }); return { ok: true, msg: wasNew ? 'Đã cài đặt và kích hoạt.' : 'Đã kích hoạt.' };
}
export async function dependents(db: any, id: string): Promise<string[]> { return (await listEntries(db)).filter((x) => x.active && x.requires.includes(id)).map((x) => x.name); }
export async function deactivate(db: any, id: string, actor: string, force = false): Promise<R> {
  const e = await getEntry(db, id); if (!e || !e.installed) return { ok: false, msg: 'Plugin chưa cài' };
  const dep = await dependents(db, id); if (dep.length) return { ok: false, msg: 'Đang được dùng bởi: ' + dep.join(', ') };
  const n = await pagesUsing(db, e);
  if (n && !force) return { ok: false, msg: `${n} trang đang dùng khối của plugin này. Khối sẽ ẩn trên website (không bị xóa) và hiện nhãn "plugin đang tắt" trong trình dựng. Bấm lại để xác nhận tắt.` };
  await setRow(db, e, 'inactive'); await logPx(db, id, 'deactivate', n ? `${n} trang bị ẩn khối` : '', actor); await emit(db, 'plugin.deactivated', { id }); return { ok: true, msg: 'Đã tắt. Dữ liệu và cấu hình được giữ nguyên.' };
}
export async function uninstall(db: any, id: string, actor: string, purge: boolean): Promise<R> {
  const e = await getEntry(db, id); if (!e || !e.installed) return { ok: false, msg: 'Plugin chưa cài' };
  if (e.active) return { ok: false, msg: 'Hãy tắt plugin trước khi gỡ cài đặt' };
  const dep = await dependents(db, id); if (dep.length) return { ok: false, msg: 'Đang được dùng bởi: ' + dep.join(', ') };
  let dropped = 0;
  if (purge) {
    const t = (await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE ? ESCAPE '\\'").bind(prefix(id).replace(/_/g, '\\_') + '%').all()).results as any[];
    for (const r of t) if (new RegExp(`^${prefix(id)}\\w+$`).test(r.name)) { await db.prepare(`DROP TABLE IF EXISTS "${r.name}"`).run(); dropped++; }
    await db.prepare('DELETE FROM plugin_migrations WHERE plugin_id=?').bind(id).run(); await db.prepare('DELETE FROM plugin_settings WHERE plugin_id=?').bind(id).run();
  }
  await db.prepare('DELETE FROM plugin_placements WHERE plugin_id=?').bind(id).run();
  if (e.runtime === 'package') { await db.prepare('DELETE FROM plugin_installs WHERE id=?').bind(id).run(); await db.prepare('DELETE FROM plugin_packages WHERE id=?').bind(id).run(); }
  else await setRow(db, e, 'uninstalled');
  bust(); await logPx(db, id, 'uninstall', purge ? `đã xóa dữ liệu (${dropped} bảng)` : 'giữ lại dữ liệu', actor);
  return { ok: true, msg: purge ? 'Đã gỡ cài đặt và xóa dữ liệu của plugin.' : 'Đã gỡ cài đặt. Dữ liệu được giữ lại để cài lại sau.' };
}
export async function saveSettings(db: any, id: string, form: FormData, actor: string): Promise<R> {
  const e = await getEntry(db, id); if (!e) return { ok: false, msg: 'Không tìm thấy plugin' };
  for (const f of e.settings) {
    let v = f.type === 'check' ? (form.get('s_' + f.k) ? '1' : '') : String(form.get('s_' + f.k) ?? '').slice(0, 5000);
    if (f.type === 'number') v = String(Number(v) || 0);
    if (f.type === 'color' && !/^#[0-9a-f]{3,8}$/i.test(v)) v = '';
    if (f.type === 'select' && !(f.options || []).some((o) => o[0] === v)) v = String(f.def ?? '');
    await db.prepare('INSERT INTO plugin_settings (plugin_id,k,v) VALUES (?,?,?) ON CONFLICT(plugin_id,k) DO UPDATE SET v=excluded.v').bind(id, f.k, v).run();
  }
  bust(); await logPx(db, id, 'settings', 'cập nhật cấu hình', actor); return { ok: true, msg: 'Đã lưu cấu hình.' };
}

// ===== Gói ZIP =====
export async function stagePackage(db: any, files: Record<string, string>, checksum: string, actor: string): Promise<{ ok: boolean; msg: string; id?: string; errors?: string[] }> {
  const raw = files['manifest.json']; if (!raw) return { ok: false, msg: 'Thiếu manifest.json ở thư mục gốc của gói', errors: [] };
  const extra = Object.keys(files).filter((n) => n !== 'manifest.json' && n !== 'README.md' && n !== 'readme.txt');
  if (extra.length) return { ok: false, msg: 'Gói ZIP chỉ được chứa manifest.json (và README). Tệp lạ: ' + extra.slice(0, 3).join(', ') + '. Mã máy chủ không được tải lên qua đây.', errors: [] };
  const v = validateManifest(safeJson(raw)); if (!v.ok) return { ok: false, msg: 'Manifest không hợp lệ', errors: v.errors };
  if (PLUGINS.some((p) => p.id === v.m.id)) return { ok: false, msg: `Id "${v.m.id}" trùng với plugin mã nguồn có sẵn` };
  const cur = await db.prepare('SELECT version FROM plugin_packages WHERE id=? ORDER BY rowid DESC').bind(v.m.id).all();
  if ((cur.results as any[]).some((r) => r.version === v.m.version)) return { ok: false, msg: `Phiên bản ${v.m.version} của "${v.m.id}" đã tồn tại. Hãy tăng version khi nâng cấp.` };
  await db.prepare('INSERT INTO plugin_packages (id,version,manifest,checksum,created_at) VALUES (?,?,?,?,?)').bind(v.m.id, v.m.version, raw, checksum, nowIso()).run(); // lưu bản gốc: manifest luôn được kiểm tra lại khi nạp
  bust(); await logPx(db, v.m.id, 'stage', `v${v.m.version} sha256:${checksum.slice(0, 12)}`, actor); return { ok: true, msg: 'Gói hợp lệ.', id: v.m.id };
}
export async function upgradePackage(db: any, id: string, actor: string, grant: string[]): Promise<R> {
  const s = await load(db), k = s.pkgs.get(id), row = s.rows.get(id);
  if (!k || !row) return { ok: false, msg: 'Chưa cài plugin này' };
  const n = k.latest, old = row.version; if (!verGt(n.version, old)) return { ok: false, msg: 'Không có phiên bản mới hơn' };
  const granted: string[] = safeJson(row.perms) || [], added = n.permissions.filter((p) => !granted.includes(p) && !grant.includes(p));
  if (added.length) return { ok: false, msg: 'Phiên bản mới xin thêm quyền: ' + added.join(', ') };
  const all = await listEntries(db), tmp = { ...all.find((x) => x.id === id)!, manifest: n, declared: n.permissions, requires: n.requires, version: n.version };
  const bad = checkCompat(tmp, all); if (bad) { await logPx(db, id, 'update-failed', bad, actor); return { ok: false, msg: bad + '. Vẫn giữ phiên bản cũ.' }; }
  await setRow(db, tmp, row.status, { version: n.version, prev: old, perms: n.permissions }); await logPx(db, id, 'update', `${old} → ${n.version}`, actor);
  return { ok: true, msg: `Đã nâng cấp ${old} → ${n.version}. Có thể quay lại ${old} nếu cần.` };
}
export async function rollbackPackage(db: any, id: string, actor: string): Promise<R> {
  const s = await load(db), row = s.rows.get(id); if (!row || !row.prev_version) return { ok: false, msg: 'Không có phiên bản trước' };
  const has = await db.prepare('SELECT 1 x FROM plugin_packages WHERE id=? AND version=?').bind(id, row.prev_version).first(); if (!has) return { ok: false, msg: 'Phiên bản trước không còn trong kho' };
  await db.prepare('UPDATE plugin_installs SET version=?,prev_version=?,updated_at=? WHERE id=?').bind(row.prev_version, row.version, nowIso(), id).run();
  bust(); await logPx(db, id, 'rollback', `${row.version} → ${row.prev_version}`, actor); return { ok: true, msg: `Đã quay lại phiên bản ${row.prev_version}.` };
}
