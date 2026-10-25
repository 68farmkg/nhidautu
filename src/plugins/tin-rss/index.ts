import type { Plugin } from '../../lib/plugins';
import { esc } from '../../lib/esc';
import { getFeed, FEEDS } from '../../lib/rss';
import { fmtDate } from '../../lib/util';

const plugin: Plugin = {
  id: 'tin-rss', name: 'Tin RSS các báo', icon: 'rss', version: '1.0',
  desc: 'Khối hiện tiêu đề tin từ các báo kèm link về báo gốc.',
  blocks: [{ type: 'rss', label: 'Tin từ các báo (RSS)', icon: 'rss', group: 'Chứng khoán', fields: [
    { k: 'keys', label: 'Mã nguồn, cách nhau dấu phẩy', def: 'cafef-ck,vietstock-ck', hint: 'Ví dụ mã: ' + Object.keys(FEEDS).slice(0, 5).join(', ') },
    { k: 'count', label: 'Số tin', type: 'number', def: 8 }],
    render: async (p) => { const keys = String(p.keys || 'cafef-ck').split(',').map((s) => s.trim()).filter((k) => FEEDS[k]).slice(0, 4);
      const res = await Promise.allSettled(keys.map((k) => getFeed(k, 8, 4000))); const seen = new Set<string>();
      const items = res.flatMap((r) => (r.status === 'fulfilled' ? r.value : [])).filter((i) => (seen.has(i.link) ? false : (seen.add(i.link), true)))
        .sort((a, b) => +new Date(b.date) - +new Date(a.date)).slice(0, Math.min(20, Math.max(1, Number(p.count) || 8)));
      return items.length ? `<div class="box">${items.map((i) => `<p style="margin:0 0 10px"><a href="${esc(i.link)}" target="_blank" rel="noopener nofollow"><b>${esc(i.title)}</b></a><br><span class="meta">${esc(i.source.split(' · ')[0])} · ${i.date && !isNaN(+new Date(i.date)) ? fmtDate(new Date(i.date).toISOString()) : ''}</span></p>`).join('')}</div>` : '<p class="meta">Chưa lấy được tin.</p>'; } }],
};
export default plugin;
