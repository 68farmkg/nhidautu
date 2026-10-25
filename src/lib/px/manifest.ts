// Kiểm tra manifest plugin theo schema chặt. Quyền chỉ được cấp khi nằm trong danh sách PERMS dưới đây.
export const NHIP_API = 2; // phiên bản API plugin của lõi
export const PERMS: Record<string, string> = {
  'admin.menu': 'Thêm mục vào menu quản trị',
  'admin.settings': 'Có trang cấu hình riêng',
  'frontend.blocks': 'Thêm khối vào trình dựng trang',
  'frontend.slots': 'Chèn nội dung vào vị trí cố định trên website',
  'frontend.script': 'Chạy JavaScript (chỉ trong khung cách ly)',
  'content.read': 'Đọc bài viết, trang',
  'market.read': 'Đọc số liệu thị trường',
};
// Vị trí lõi cho phép plugin chèn (khớp các điểm gọi <Slot name="..."> trong layout)
export const SLOTS: Record<string, string> = {
  'site.head': 'Đầu trang (trong <head>, chỉ CSS/meta)', 'site.top': 'Ngay dưới đầu trang', 'site.bottom': 'Trước chân trang',
  'home.top': 'Đầu trang chủ', 'home.bottom': 'Cuối trang chủ', 'post.top': 'Đầu bài viết', 'post.bottom': 'Cuối bài viết',
  'stock.bottom': 'Cuối trang mã cổ phiếu', 'site.floating': 'Nổi trên toàn website',
};
export const FIELD_TYPES = ['text', 'textarea', 'number', 'select', 'color', 'check'];
const ID = /^[a-z][a-z0-9-]{1,39}$/, VER = /^\d{1,3}\.\d{1,3}(\.\d{1,3})?$/, KEY = /^[a-z][\w-]{0,29}$/;
const RESERVED_IDS = ['core', 'admin', 'system', 'api'];

export type Field = { k: string; label: string; type?: string; options?: [string, string][]; def?: any; hint?: string };
export type PkgBlock = { type: string; label: string; icon: string; group: string; fields: Field[]; template: string; css?: string };
export type PkgSlot = { id: string; slot: string; label: string; template: string; css?: string; js?: string; pages?: string; height?: number };
export type PkgAdminPage = { id: string; title: string; template: string };
export type Manifest = {
  id: string; name: string; version: string; description: string; author: string; category: string; icon: string; api: number;
  permissions: string[]; requires: string[]; settings: Field[]; blocks: PkgBlock[]; slots: PkgSlot[]; adminPages: PkgAdminPage[];
};
const S = (v: any, max: number) => String(v ?? '').slice(0, max);

function fields(a: any, errs: string[], where: string): Field[] {
  if (a === undefined) return [];
  if (!Array.isArray(a) || a.length > 30) { errs.push(`${where}: fields phải là mảng (tối đa 30)`); return []; }
  const seen = new Set<string>();
  return a.map((f: any) => {
    if (!f || !KEY.test(String(f.k)) || seen.has(f.k)) { errs.push(`${where}: khóa trường không hợp lệ "${f?.k}"`); return null; }
    seen.add(f.k);
    const type = FIELD_TYPES.includes(f.type) ? f.type : 'text';
    const o: Field = { k: f.k, label: S(f.label || f.k, 100), type, def: typeof f.def === 'object' ? '' : f.def, hint: S(f.hint, 200) };
    if (type === 'select') o.options = (Array.isArray(f.options) ? f.options : []).slice(0, 30).map((p: any) => [S(p?.[0], 60), S(p?.[1], 100)] as [string, string]);
    return o;
  }).filter(Boolean) as Field[];
}

export function validateManifest(raw: any): { ok: true; m: Manifest } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, errors: ['manifest phải là một đối tượng JSON'] };
  if (!ID.test(String(raw.id)) || RESERVED_IDS.includes(raw.id)) errors.push('id không hợp lệ (a-z, 0-9, dấu gạch, 2–40 ký tự, bắt đầu bằng chữ)');
  if (!VER.test(String(raw.version))) errors.push('version phải dạng 1.0 hoặc 1.2.3');
  if (!String(raw.name || '').trim()) errors.push('thiếu name');
  const api = Number(raw.api ?? NHIP_API);
  if (!(api >= 1 && api <= NHIP_API)) errors.push(`plugin cần API ${raw.api}, website chỉ hỗ trợ tới ${NHIP_API}`);
  const perms: string[] = Array.isArray(raw.permissions) ? raw.permissions : [];
  for (const p of perms) if (!PERMS[p]) errors.push(`quyền không được hỗ trợ: ${S(p, 40)}`);
  const has = (p: string) => perms.includes(p);

  const settings = fields(raw.settings, errors, 'settings');
  const blocks: PkgBlock[] = [], slots: PkgSlot[] = [], adminPages: PkgAdminPage[] = [];
  const requires = (Array.isArray(raw.requires) ? raw.requires : []).slice(0, 10).map(String);
  for (const r of requires) if (!ID.test(r)) errors.push(`requires không hợp lệ: ${S(r, 40)}`);
  if (raw.tables) errors.push('Gói ZIP không được tạo bảng dữ liệu. Plugin cần bảng riêng phải là plugin mã nguồn.');
  const types = new Set<string>();
  for (const b of Array.isArray(raw.blocks) ? raw.blocks.slice(0, 20) : []) {
    if (!has('frontend.blocks')) { errors.push('có blocks nhưng thiếu quyền frontend.blocks'); break; }
    if (!KEY.test(String(b?.type))) { errors.push(`block type không hợp lệ: ${S(b?.type, 30)}`); continue; }
    const type = `${raw.id}--${b.type}`; if (types.has(type)) { errors.push(`block trùng: ${b.type}`); continue; } types.add(type);
    blocks.push({ type, label: S(b.label || b.type, 80), icon: S(b.icon || 'puzzle', 20), group: S(b.group || 'Plugin', 40), fields: fields(b.fields, errors, `block ${b.type}`), template: S(b.template, 20000), css: S(b.css, 20000) });
  }
  for (const s of Array.isArray(raw.slots) ? raw.slots.slice(0, 20) : []) {
    if (!has('frontend.slots')) { errors.push('có slots nhưng thiếu quyền frontend.slots'); break; }
    if (!KEY.test(String(s?.id)) || !SLOTS[s?.slot]) { errors.push(`slot không hợp lệ: ${S(s?.id, 30)} → ${S(s?.slot, 30)}`); continue; }
    if (s.js && !has('frontend.script')) { errors.push(`slot ${s.id} có js nhưng thiếu quyền frontend.script`); continue; }
    slots.push({ id: s.id, slot: s.slot, label: S(s.label || s.id, 80), template: S(s.template, 20000), css: S(s.css, 20000), js: S(s.js, 30000), pages: S(s.pages, 300), height: Math.min(900, Math.max(40, Number(s.height) || 200)) });
  }
  for (const a of Array.isArray(raw.adminPages) ? raw.adminPages.slice(0, 10) : []) {
    if (!has('admin.menu')) { errors.push('có adminPages nhưng thiếu quyền admin.menu'); break; }
    if (!KEY.test(String(a?.id))) { errors.push(`adminPage id không hợp lệ`); continue; }
    adminPages.push({ id: a.id, title: S(a.title || a.id, 80), template: S(a.template, 20000) });
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, m: { id: raw.id, name: S(raw.name, 80), version: raw.version, description: S(raw.description, 500), author: S(raw.author, 80), category: S(raw.category || 'Khác', 40), icon: S(raw.icon || 'puzzle', 20), api, permissions: perms, requires, settings, blocks, slots, adminPages } };
}
// So sánh phiên bản a > b
export const verGt = (a: string, b: string) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; };
