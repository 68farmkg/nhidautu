import type { Plugin } from '../../lib/plugins';
import { all, first, CATS, fmtDate } from '../../lib/util';
import { esc } from '../../lib/esc';

const plugin: Plugin = {
  id: 'thong-ke', name: 'Thống kê', icon: 'chart', version: '1.0',
  desc: 'Trang thống kê trong admin và khối "Đọc nhiều nhất" cho website.',
  blocks: [{ type: 'top-views', label: 'Bài đọc nhiều nhất', icon: 'star', group: 'Chức năng', fields: [{ k: 'count', label: 'Số bài', type: 'number', def: 5 }, { k: 'title', label: 'Tiêu đề', def: 'Đọc nhiều nhất' }],
    render: async (p, c) => { const r = await all(c.db, `SELECT slug,title,views FROM posts WHERE status='published' ORDER BY views DESC LIMIT ${Math.min(20, Math.max(1, Number(p.count) || 5))}`);
      return `<div class="box"><h3>${esc(p.title)}</h3>${r.map((x, i) => `<p style="margin:0 0 8px"><b>${i + 1}.</b> <a href="/bai-viet/${esc(x.slug)}">${esc(x.title)}</a> <span class="meta">${x.views || 0} lượt</span></p>`).join('')}</div>`; } }],
  admin: async ({ db }) => {
    const t = await first(db, "SELECT COUNT(*) n, COALESCE(SUM(views),0) v FROM posts WHERE status='published'");
    const top = await all(db, "SELECT id,title,views,category,published_at FROM posts WHERE status='published' ORDER BY views DESC LIMIT 15");
    const pg = await first(db, 'SELECT COUNT(*) n FROM pages WHERE is_template=0');
    return `<div class="stats"><div class="box"><small>Bài đã đăng</small><b>${t?.n || 0}</b></div><div class="box"><small>Tổng lượt xem</small><b>${t?.v || 0}</b></div><div class="box"><small>Số trang</small><b>${pg?.n || 0}</b></div></div>
      <div class="box scroll"><h3>Bài đọc nhiều nhất</h3><table class="t"><tbody>${top.map((x) => `<tr><td><a href="/admin/bai-viet/${x.id}"><b>${esc(x.title)}</b></a><br><span class="meta">${esc(CATS[x.category] || x.category)} · ${fmtDate(x.published_at)}</span></td><td class="r">${x.views || 0}</td></tr>`).join('')}</tbody></table></div>`;
  },
};
export default plugin;
