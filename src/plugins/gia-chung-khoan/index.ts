import type { Plugin } from '../../lib/plugins';
import { all, fmtNum, fmtPct } from '../../lib/util';
import { esc } from '../../lib/esc';

const plugin: Plugin = {
  id: 'gia-chung-khoan', name: 'Giá chứng khoán', icon: 'chart', version: '1.0',
  desc: 'Dải chỉ số, bảng giá cổ phiếu. Dữ liệu lấy từ mục Số liệu thị trường.',
  blocks: [
    { type: 'indexes', label: 'Dải chỉ số (VN-Index…)', icon: 'chart', group: 'Chứng khoán', fields: [],
      render: async (_p, c) => { const r = await all(c.db, "SELECT * FROM quotes WHERE kind='index' ORDER BY rowid LIMIT 6");
        return `<div class="b-idx">${r.map((i) => `<a class="c" href="/co-phieu/${esc(i.symbol)}"><small>${esc(i.name)}</small><b>${fmtNum(i.price)}</b><span class="${i.change_pct >= 0 ? 'up' : 'down'}">${fmtPct(i.change_pct)}</span></a>`).join('')}</div>`; } },
    { type: 'stocks', label: 'Bảng giá cổ phiếu', icon: 'list', group: 'Chứng khoán', fields: [
      { k: 'count', label: 'Số mã', type: 'number', def: 8 },
      { k: 'sort', label: 'Sắp xếp', type: 'select', options: [['up', 'Tăng mạnh nhất'], ['down', 'Giảm mạnh nhất'], ['az', 'A-Z']], def: 'up' }, { k: 'title', label: 'Tiêu đề khối' }],
      render: async (p, c) => { const o = p.sort === 'down' ? 'change_pct ASC' : p.sort === 'az' ? 'symbol' : 'change_pct DESC';
        const r = await all(c.db, `SELECT * FROM quotes WHERE kind='stock' ORDER BY ${o} LIMIT ${Math.min(30, Math.max(1, Number(p.count) || 8))}`);
        return (p.title ? `<h3 class="b-h">${esc(p.title)}</h3>` : '') + `<div class="scroll"><table class="t"><tbody>${r.map((s) => `<tr><td><a href="/co-phieu/${esc(s.symbol)}"><b>${esc(s.symbol)}</b></a></td><td class="r">${fmtNum(s.price)}</td><td class="r ${s.change_pct >= 0 ? 'up' : 'down'}">${fmtPct(s.change_pct)}</td></tr>`).join('')}</tbody></table></div>`; } },
  ],
};
export default plugin;
