import type { Plugin } from '../../lib/plugins';

const sym = (s: any) => String(s || 'HOSE:VNINDEX').replace(/[^A-Za-z0-9:._-]/g, '').slice(0, 30);
const tv = (src: string, cfg: any, h: number) => `<div class="tradingview-widget-container" style="height:${h}px"><div class="tradingview-widget-container__widget" style="height:100%"></div><script type="text/javascript" src="https://s3.tradingview.com/external-embedding/${src}" async>${JSON.stringify({ ...cfg, colorTheme: 'light', locale: 'vi_VN' })}</script></div>`;

const plugin: Plugin = {
  id: 'bieu-do', name: 'Biểu đồ TradingView', icon: 'chart', version: '1.0',
  desc: 'Nhúng biểu đồ giá và dải giá chạy của TradingView (miễn phí).',
  blocks: [
    { type: 'tv-chart', label: 'Biểu đồ giá', icon: 'chart', group: 'Chứng khoán', fields: [
      { k: 'symbol', label: 'Mã (vd HOSE:VNINDEX, HOSE:FPT, NASDAQ:AAPL)', def: 'HOSE:VNINDEX' }, { k: 'height', label: 'Chiều cao (px)', type: 'number', def: 420 }],
      render: (p) => { const h = Math.min(900, Math.max(200, Number(p.height) || 420)); return tv('embed-widget-advanced-chart.js', { symbol: sym(p.symbol), interval: 'D', timezone: 'Asia/Ho_Chi_Minh', autosize: true, hide_side_toolbar: true }, h); } },
    { type: 'tv-ticker', label: 'Dải giá chạy', icon: 'chart', group: 'Chứng khoán', fields: [
      { k: 'symbols', label: 'Mỗi dòng một mã', type: 'textarea', def: 'HOSE:VNINDEX\nHOSE:VIC\nHOSE:FPT\nHOSE:HPG' }],
      render: (p) => tv('embed-widget-ticker-tape.js', { symbols: String(p.symbols || '').split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 20).map((x) => ({ proName: sym(x), title: sym(x).split(':').pop() })) }, 80) },
  ],
};
export default plugin;
