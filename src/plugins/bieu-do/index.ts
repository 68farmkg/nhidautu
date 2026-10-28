import type { Plugin } from '../../lib/plugins';

const sym = (s: any) => String(s || 'HOSE:VNINDEX').replace(/[^A-Za-z0-9:._-]/g, '').slice(0, 30);
const tv = (src: string, cfg: any, h: number) => `<div class="tradingview-widget-container" style="height:${h}px"><div class="tradingview-widget-container__widget" style="height:100%"></div><script type="text/javascript" src="https://s3.tradingview.com/external-embedding/${src}" async>${JSON.stringify({ ...cfg, colorTheme: 'light', locale: 'vi_VN' })}</script></div>`;

// ---- Biểu đồ KLineChart kiểu NHỊP (cùng thư viện klinecharts 9.8.12, màu/thang giá/chỉ báo như nhip-19) ----
// Giá nến lấy qua /proxy/dchart: ưu tiên kho dữ liệu hub (nhip-18), không có thì gọi thẳng nguồn — giống giao diện NHỊP.
const KL_TF: [string, string, number][] = [['1', '1p', 7], ['5', '5p', 30], ['15', '15p', 60], ['30', '30p', 90], ['60', '1h', 180], ['D', 'Ngày', 730], ['W', 'Tuần', 1825], ['M', 'Tháng', 3650]];
const klSym = (s: any) => String(s || 'VNINDEX').toUpperCase().replace(/^[A-Z]+:/, '').replace(/[^A-Z0-9.]/g, '').slice(0, 12) || 'VNINDEX';
const klRes = (s: any) => (KL_TF.some((x) => x[0] === String(s)) ? String(s) : 'D');
let klN = 0;
const klChart = (sym: string, res: string, h: number) => {
  const id = 'nkl' + Date.now().toString(36) + (klN++);
  const cfg = JSON.stringify({ id, sym, res, tf: KL_TF }).replace(/</g, '\\u003c');
  return `<div class="nkl" id="${id}" style="--nkl-h:${h}px"><style>
.nkl{border:1px solid var(--nkl-bd,#dfe5ec);border-radius:12px;background:var(--nkl-bg,#fff);color:var(--nkl-fg,#1d2733);overflow:hidden;font:13px/1.4 system-ui,sans-serif}
.nkl-bar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:8px 10px;border-bottom:1px solid var(--nkl-bd,#dfe5ec)}
.nkl-bar b{font-size:15px;margin-right:6px}.nkl-bar .px{font-weight:700}.nkl-bar .up{color:#16bd8c}.nkl-bar .dn{color:#ee7580}
.nkl-bar button,.nkl-bar input{font:inherit;border:1px solid var(--nkl-bd,#dfe5ec);background:transparent;color:inherit;border-radius:7px;padding:3px 9px;cursor:pointer}
.nkl-bar button.on{background:#2f7bd9;border-color:#2f7bd9;color:#fff}.nkl-bar input{width:84px;text-transform:uppercase;cursor:text}.nkl-sp{flex:1}
.nkl-c{height:var(--nkl-h,420px);width:100%}.nkl-m{padding:14px;text-align:center;opacity:.7}
.nkl-f{padding:6px 10px;font-size:11px;opacity:.65;border-top:1px solid var(--nkl-bd,#dfe5ec)}
@media(prefers-color-scheme:dark){.nkl{--nkl-bg:#0f1722;--nkl-fg:#e6edf5;--nkl-bd:#243246}}
</style><div class="nkl-bar"></div><div class="nkl-c"><div class="nkl-m">Đang tải biểu đồ…</div></div><div class="nkl-f">Dữ liệu tham khảo, không phải khuyến nghị đầu tư. Nguồn giá qua hub NHỊP.</div>
<script>(function(){var C=${cfg},R=document.getElementById(C.id);if(!R)return;
var bar=R.querySelector('.nkl-bar'),box=R.querySelector('.nkl-c'),S={sym:C.sym,res:C.res,type:'candle_solid',vol:1,ma:1,k:null,ob:null};
var IDX=/^(VNINDEX|VN30|VN100|HNX\\w*|UPCOM\\w*)$/;
var dark=function(){return matchMedia('(prefers-color-scheme: dark)').matches||/dark/i.test(document.documentElement.getAttribute('data-theme')||document.documentElement.className)};
function lib(cb){if(window.klinecharts)return cb();var s=document.querySelector('script[data-klc]');if(!s){s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/klinecharts@9.8.12/dist/umd/klinecharts.min.js';s.async=true;s.setAttribute('data-klc','1');document.head.appendChild(s);}
 s.addEventListener('load',cb);s.addEventListener('error',function(){box.innerHTML='<div class="nkl-m">Không tải được thư viện biểu đồ (klinecharts).</div>'});}
function days(){for(var i=0;i<C.tf.length;i++)if(C.tf[i][0]===S.res)return C.tf[i][2];return 730}
function load(){box.innerHTML='<div class="nkl-m">Đang tải biểu đồ…</div>';var to=Math.floor(Date.now()/1000),from=to-days()*86400;
 fetch('/proxy/dchart?'+new URLSearchParams({symbol:S.sym,resolution:S.res,from:from,to:to+60}),{cache:'no-store'}).then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(j){
  if(!j||j.s!=='ok'||!j.t||!j.t.length)throw 0;var sc=IDX.test(S.sym)?1:(j.c[j.c.length-1]<500?1000:1);
  var d=j.t.map(function(t,i){return{timestamp:t*1000,open:j.o[i]*sc,high:j.h[i]*sc,low:j.l[i]*sc,close:j.c[i]*sc,volume:j.v?j.v[i]:0}});S.data=d;S.sc=sc;draw(d)}).catch(function(){box.innerHTML='<div class="nkl-m">Chưa có dữ liệu cho mã '+S.sym+' (khung '+S.res+').</div>'});}
function draw(d){box.innerHTML='';lib(function(){var k=window.klinecharts;if(S.ob){S.ob.disconnect();S.ob=null}if(S.k){try{k.dispose(S.k)}catch(e){}}
 S.k=k.init(box);var K=S.k,up='#16bd8c',dn='#ee7580',brand='#2f7bd9',grid=dark()?'rgba(255,255,255,.06)':'rgba(0,0,0,.06)';
 try{K.setTimezone('Asia/Ho_Chi_Minh')}catch(e){}try{K.setPriceVolumePrecision(IDX.test(S.sym)?2:0,0)}catch(e){}
 K.setStyles(dark()?'dark':'light');
 K.setStyles({grid:{horizontal:{color:grid},vertical:{color:grid}},candle:{type:S.type,tooltip:{showRule:'none'},bar:{upColor:up,downColor:dn,upBorderColor:up,downBorderColor:dn,upWickColor:up,downWickColor:dn},area:{lineSize:2,lineColor:brand,backgroundColor:[{offset:0,color:'rgba(47,123,217,.22)'},{offset:1,color:'rgba(47,123,217,.01)'}]}}});
 K.applyNewData(d);
 var bars=[{style:'fill',borderSize:1,borderStyle:'solid',borderDashedValue:[2,2],upColor:'rgba(22,189,140,.7)',downColor:'rgba(238,117,128,.7)',noChangeColor:'#8a97a6'}];
 if(S.ma)K.createIndicator({name:'MA',calcParams:[5,20,50]},true,{id:'candle_pane'});
 if(S.vol)K.createIndicator({name:'VOL',calcParams:[5,20],styles:{bars:bars}},false,{height:innerWidth<700?84:104});
 try{K.setOffsetRightDistance(innerWidth<700?40:64);K.scrollToRealTime()}catch(e){}
 try{S.ob=new ResizeObserver(function(){try{K.resize()}catch(e){}});S.ob.observe(box)}catch(e){}
 head(d);});}
function head(d){var l=d[d.length-1],p=d.length>1?d[d.length-2].close:l.close,ch=l.close-p,pc=p?ch/p*100:0,f=function(v){return IDX.test(S.sym)?v.toLocaleString('vi-VN',{minimumFractionDigits:2,maximumFractionDigits:2}):Math.round(v).toLocaleString('vi-VN')};
 var q=bar.querySelector('.q');if(q)q.innerHTML='<span class="px '+(ch>=0?'up':'dn')+'">'+f(l.close)+'</span> <span class="'+(ch>=0?'up':'dn')+'">'+(ch>=0?'▲ ':'▼ ')+Math.abs(pc).toFixed(2)+'%</span>';}
function ui(){var tf=C.tf.map(function(t){return'<button type="button" data-r="'+t[0]+'"'+(t[0]===S.res?' class="on"':'')+'>'+t[1]+'</button>'}).join('');
 bar.innerHTML='<b>'+S.sym+'</b><span class="q"></span><span class="nkl-sp"></span>'+tf+'<button type="button" data-t="candle_solid" class="'+(S.type==='candle_solid'?'on':'')+'">Nến</button><button type="button" data-t="area" class="'+(S.type==='area'?'on':'')+'">Đường</button><button type="button" data-i="ma" class="'+(S.ma?'on':'')+'">MA</button><button type="button" data-i="vol" class="'+(S.vol?'on':'')+'">VOL</button><input aria-label="Mã" value="'+S.sym+'" maxlength="12">';
 if(S.data)head(S.data);}
bar.addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;
 if(b.dataset.r){S.res=b.dataset.r;ui();load();}else if(b.dataset.t){S.type=b.dataset.t;ui();if(S.data)draw(S.data);}else if(b.dataset.i){S[b.dataset.i]=S[b.dataset.i]?0:1;ui();if(S.data)draw(S.data);}});
bar.addEventListener('keydown',function(e){if(e.key==='Enter'&&e.target.tagName==='INPUT'){var v=e.target.value.toUpperCase().replace(/[^A-Z0-9.]/g,'').slice(0,12);if(v.length>=2){S.sym=v;S.data=null;ui();load();}}});
ui();load();})();</script></div>`;
};

const plugin: Plugin = {
  id: 'bieu-do', name: 'Biểu đồ (NHỊP KLineChart + TradingView)', icon: 'chart', version: '1.1',
  desc: 'Biểu đồ nến kiểu NHỊP (KLineChart, giá từ hub nhip-18) cùng biểu đồ và dải giá chạy TradingView.',
  blocks: [
    { type: 'nhip-kline', label: 'Biểu đồ NHỊP (KLineChart)', icon: 'chart', group: 'Chứng khoán', fields: [
      { k: 'symbol', label: 'Mã (vd VNINDEX, VN30, FPT, HPG)', def: 'VNINDEX' },
      { k: 'res', label: 'Khung mặc định (1, 5, 15, 30, 60, D, W, M)', def: 'D' },
      { k: 'height', label: 'Chiều cao (px)', type: 'number', def: 460 }],
      render: (p) => klChart(klSym(p.symbol), klRes(p.res), Math.min(900, Math.max(260, Number(p.height) || 460))) },
    { type: 'tv-chart', label: 'Biểu đồ giá', icon: 'chart', group: 'Chứng khoán', fields: [
      { k: 'symbol', label: 'Mã (vd HOSE:VNINDEX, HOSE:FPT, NASDAQ:AAPL)', def: 'HOSE:VNINDEX' }, { k: 'height', label: 'Chiều cao (px)', type: 'number', def: 420 }],
      render: (p) => { const h = Math.min(900, Math.max(200, Number(p.height) || 420)); return tv('embed-widget-advanced-chart.js', { symbol: sym(p.symbol), interval: 'D', timezone: 'Asia/Ho_Chi_Minh', autosize: true, hide_side_toolbar: true }, h); } },
    { type: 'tv-ticker', label: 'Dải giá chạy', icon: 'chart', group: 'Chứng khoán', fields: [
      { k: 'symbols', label: 'Mỗi dòng một mã', type: 'textarea', def: 'HOSE:VNINDEX\nHOSE:VIC\nHOSE:FPT\nHOSE:HPG' }],
      render: (p) => tv('embed-widget-ticker-tape.js', { symbols: String(p.symbols || '').split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 20).map((x) => ({ proName: sym(x), title: sym(x).split(':').pop() })) }, 80) },
  ],
};
export default plugin;
