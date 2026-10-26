// Sao lưu & khôi phục CẤU HÌNH giao diện: tùy chỉnh giao diện (theme), khối dùng lại, menu & chân trang.
// KHÔNG gồm: tài khoản, mật khẩu, vai trò, API key, bài viết, trang, tin nhắn. Mọi dữ liệu nhập vào đều được làm sạch lại.
import { all, run, nowIso } from './util';
import { clean as cleanTheme, getTheme, saveTheme, bust as bustTheme } from './theme';
import { sanitizeHtml, SLUG, listBlocks, saveBlock, ensureBlocks, bust as bustBlocks } from './reusable';
import { cleanUrl } from './theme';

export const PARTS: [string, string][] = [['theme', 'Tùy chỉnh giao diện (màu, chữ, bố cục, Header, Footer)'], ['blocks', 'Khối dùng lại'], ['menu', 'Menu & chân trang']];
export const MAX_BYTES = 2_000_000;
const LOC = /^(header|mobile|bottom|footer[a-z0-9_-]{0,20})$/;
export type MenuItem = { loc: string; label: string; url: string; icon: string; sub: boolean; blank: boolean; device: string };
export type Backup = { app: 'nhip'; v: 1; at: string; parts: { theme?: Record<string, string>; blocks?: { slug: string; title: string; html: string }[]; menu?: MenuItem[] } };

export async function buildBackup(db: any, parts: string[]): Promise<Backup> {
  const b: Backup = { app: 'nhip', v: 1, at: nowIso(), parts: {} };
  if (parts.includes('theme')) b.parts.theme = await getTheme(db);
  if (parts.includes('blocks')) b.parts.blocks = (await listBlocks(db)).map((x) => ({ slug: x.slug, title: x.title, html: x.html }));
  if (parts.includes('menu')) {
    let rows: any[] = []; try { rows = await all(db, 'SELECT * FROM nav_items ORDER BY loc,sort,id'); } catch { /* chưa có bảng */ }
    b.parts.menu = rows.map((r) => ({ loc: String(r.loc), label: String(r.label), url: String(r.url || '#'), icon: String(r.icon || ''), sub: !!r.parent_id, blank: r.target === '_blank', device: String(r.device || 'all') }));
  }
  return b;
}
export type Parsed = { ok: true; data: Backup; note: string[] } | { ok: false; msg: string };
// Làm sạch tuyệt đối: chỉ giữ trường biết, ép kiểu, giới hạn độ dài và số lượng.
export function parseBackup(text: string): Parsed {
  if (!text || text.length > MAX_BYTES) return { ok: false, msg: 'Tệp trống hoặc quá lớn (tối đa 2 MB).' };
  let j: any; try { j = JSON.parse(text); } catch { return { ok: false, msg: 'Tệp không phải JSON hợp lệ.' }; }
  if (!j || j.app !== 'nhip' || j.v !== 1 || typeof j.parts !== 'object' || !j.parts) return { ok: false, msg: 'Đây không phải tệp sao lưu của Nhịp (sai nhãn hoặc phiên bản).' };
  const out: Backup = { app: 'nhip', v: 1, at: String(j.at || '').slice(0, 40), parts: {} }, note: string[] = [];
  if (j.parts.theme && typeof j.parts.theme === 'object') out.parts.theme = cleanTheme(j.parts.theme);
  if (Array.isArray(j.parts.blocks)) {
    const seen = new Set<string>(), bl: any[] = []; let drop = 0;
    for (const x of j.parts.blocks.slice(0, 200)) {
      const slug = String(x?.slug || '').toLowerCase(), title = String(x?.title || '').trim().slice(0, 80);
      if (!SLUG.test(slug) || !title || seen.has(slug)) { drop++; continue; } seen.add(slug); bl.push({ slug, title, html: sanitizeHtml(String(x?.html || '')) });
    }
    out.parts.blocks = bl; if (drop) note.push(`${drop} khối không hợp lệ đã bị bỏ qua.`);
  }
  if (Array.isArray(j.parts.menu)) {
    const m: MenuItem[] = []; let drop = 0; const cnt: Record<string, number> = {};
    for (const x of j.parts.menu.slice(0, 600)) {
      const loc = String(x?.loc || ''), label = String(x?.label || '').trim().slice(0, 60);
      if (!LOC.test(loc) || !label || (cnt[loc] = (cnt[loc] || 0) + 1) > 60) { drop++; continue; }
      m.push({ loc, label, url: cleanUrl(String(x?.url || '')) || '#', icon: /^[a-z0-9-]{0,30}$/.test(String(x?.icon || '')) ? String(x?.icon || '') : '', sub: !!x?.sub, blank: !!x?.blank, device: ['all', 'pc', 'mobile'].includes(x?.device) ? x.device : 'all' });
    }
    out.parts.menu = m; if (drop) note.push(`${drop} mục menu không hợp lệ đã bị bỏ qua.`);
  }
  if (!out.parts.theme && !out.parts.blocks && !out.parts.menu) return { ok: false, msg: 'Tệp không chứa phần nào để khôi phục.' };
  return { ok: true, data: out, note };
}
export const summary = (b: Backup) => ({ theme: b.parts.theme ? Object.values(b.parts.theme).filter((v) => v !== '').length : -1, blocks: b.parts.blocks ? b.parts.blocks.length : -1, menu: b.parts.menu ? b.parts.menu.length : -1 });

// Áp dụng: theme = thay toàn bộ; khối = ghép theo mã (không xóa khối khác); menu = thay từng vị trí có trong tệp.
export async function applyBackup(db: any, b: Backup, parts: string[]): Promise<string[]> {
  const done: string[] = [];
  if (parts.includes('theme') && b.parts.theme) { await saveTheme(db, b.parts.theme); done.push('giao diện'); }
  if (parts.includes('blocks') && b.parts.blocks) {
    await ensureBlocks(db); const ex = new Set((await listBlocks(db)).map((x) => x.slug));
    for (const x of b.parts.blocks) await saveBlock(db, { ...x, isNew: !ex.has(x.slug) });
    bustBlocks(); done.push(`${b.parts.blocks.length} khối`);
  }
  if (parts.includes('menu') && b.parts.menu) {
    const byLoc = new Map<string, MenuItem[]>(); for (const it of b.parts.menu) { if (!byLoc.has(it.loc)) byLoc.set(it.loc, []); byLoc.get(it.loc)!.push(it); }
    for (const [loc, items] of byLoc) {
      await run(db, 'DELETE FROM nav_items WHERE loc=?', loc); let parent = 0, n = 0;
      for (const it of items) {
        const sub = it.sub && parent > 0 && loc !== 'bottom';
        const r: any = await run(db, 'INSERT INTO nav_items (loc,label,url,icon,parent_id,sort,target,device) VALUES (?,?,?,?,?,?,?,?)', loc, it.label, it.url, it.icon, sub ? parent : 0, ++n, it.blank ? '_blank' : '', it.device);
        if (!sub) parent = Number(r?.meta?.last_row_id) || 0;
      }
    }
    done.push(`menu (${byLoc.size} vị trí)`);
  }
  bustTheme(); return done;
}

// Bản chụp tự động trước khi khôi phục (giữ 5 bản gần nhất).
export async function ensureSnaps(db: any) { await run(db, 'CREATE TABLE IF NOT EXISTS settings_snapshots (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, label TEXT NOT NULL DEFAULT "", json TEXT NOT NULL)'); }
export async function snapshot(db: any, label: string): Promise<boolean> {
  try {
    await ensureSnaps(db); const j = JSON.stringify(await buildBackup(db, PARTS.map((p) => p[0])));
    if (j.length > 1_500_000) return false;
    await run(db, 'INSERT INTO settings_snapshots (at,label,json) VALUES (?,?,?)', nowIso(), label.slice(0, 60), j);
    await run(db, 'DELETE FROM settings_snapshots WHERE id NOT IN (SELECT id FROM settings_snapshots ORDER BY id DESC LIMIT 5)');
    return true;
  } catch { return false; }
}
export async function listSnaps(db: any): Promise<{ id: number; at: string; label: string }[]> { try { await ensureSnaps(db); return await all(db, 'SELECT id,at,label FROM settings_snapshots ORDER BY id DESC'); } catch { return []; } }
export async function getSnap(db: any, id: number): Promise<Parsed> {
  try { await ensureSnaps(db); const r = (await all(db, 'SELECT json FROM settings_snapshots WHERE id=?', id))[0]; return r ? parseBackup(r.json) : { ok: false, msg: 'Không tìm thấy bản chụp.' }; } catch { return { ok: false, msg: 'Không đọc được bản chụp.' }; }
}
