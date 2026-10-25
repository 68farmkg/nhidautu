import type { Plugin } from '../../lib/plugins';
import { esc } from '../../lib/esc';
import { safeUrl } from '../../lib/site';

// Plugin mẫu đầy đủ: cấu hình, vị trí hiển thị, migration dữ liệu riêng, hook và API (chỉ admin).
// defaultOff: không tự bật. Vào Admin > Tiện ích & plugin > Cửa hàng để cài.
const plugin: Plugin = {
  id: 'thanh-thong-bao', name: 'Thanh thông báo', icon: 'star', version: '1.0.0', category: 'Marketing', defaultOff: true,
  desc: 'Thanh thông báo đầu website (khuyến mãi, cảnh báo thị trường…). Ghi lại sự kiện lưu trang.',
  permissions: ['frontend.slots', 'admin.settings', 'admin.menu'],
  settings: [
    { k: 'text', label: 'Nội dung thông báo', type: 'text', def: 'Chào mừng bạn đến với Nhịp Đầu Tư' },
    { k: 'link', label: 'Liên kết (tùy chọn)', type: 'text', def: '' },
    { k: 'bg', label: 'Màu nền', type: 'color', def: '#0c4a43' },
  ],
  migrations: [{ id: '001-events', sql: ['CREATE TABLE IF NOT EXISTS px_thanh_thong_bao_events (id INTEGER PRIMARY KEY AUTOINCREMENT, event TEXT, ref TEXT, created_at TEXT)'] }],
  slots: [{ id: 'bar', slot: 'site.top', label: 'Thanh thông báo trên cùng', render: ({ settings: s }) => {
    if (!s.text) return '';
    const bg = /^#[0-9a-f]{3,8}$/i.test(s.bg) ? s.bg : '#0c4a43';
    const t = esc(s.text);
    return `<div style="background:${bg};color:#fff;text-align:center;padding:8px 12px;font-size:14px">${s.link ? `<a href="${esc(safeUrl(s.link))}" style="color:#fff;text-decoration:underline">${t}</a>` : t}</div>`;
  } }],
  hooks: { 'page.saved': async (p, { db }) => { await db.prepare('INSERT INTO px_thanh_thong_bao_events (event,ref,created_at) VALUES (?,?,?)').bind('page.saved', String(p?.slug || p?.id || ''), new Date().toISOString()).run(); } },
  routes: [{ path: 'events', method: 'GET', handler: async ({ db }) => { const r = await db.prepare('SELECT * FROM px_thanh_thong_bao_events ORDER BY id DESC LIMIT 20').all(); return new Response(JSON.stringify({ ok: true, events: r.results }), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } }); } }],
  admin: async ({ db }) => {
    const r = (await db.prepare('SELECT * FROM px_thanh_thong_bao_events ORDER BY id DESC LIMIT 20').all()).results as any[];
    return `<div class="box scroll"><h3>Sự kiện gần đây</h3><table class="t"><tbody>${r.map((x) => `<tr><td>${esc(x.event)}</td><td>${esc(x.ref)}</td><td class="meta">${esc(x.created_at)}</td></tr>`).join('') || '<tr><td class="meta">Chưa có sự kiện. Lưu một trang để thử.</td></tr>'}</tbody></table></div>`;
  },
};
export default plugin;
