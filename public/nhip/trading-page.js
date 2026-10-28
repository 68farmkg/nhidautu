/* NHIP · Trang Giao dịch v3 — bố cục terminal: Theo dõi | Biểu đồ + tab dưới | Phiếu lệnh. Điện thoại: tab Biểu đồ / Đặt lệnh / Thông tin. */
(function(){
"use strict";
var root=document.getElementById("view"),ticket=null,chart=null,timer=null,seq=0,last=null,days=180,items=[],itemsEx="",wl=[],pxm={},st=null,symbol="FPT",tab="info",ordTbl=null,cds=[],wtab="wl",view="chart",side="buy",goSide=null;
var esc=function(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})};
var fmt=function(n,d){return n==null||!isFinite(n)?"—":Number(n).toLocaleString("vi-VN",{maximumFractionDigits:d==null?2:d})};
var money=function(v){return v==null||!isFinite(v)?"—":Math.abs(v)>=1e9?fmt(v/1e9,2)+" tỷ":Math.abs(v)>=1e6?fmt(v/1e6,1)+" tr":fmt(v,0)};
var RK="nhip.trade.recent",RANGES=[[30,"1T"],[90,"3T"],[180,"6T"],[365,"1N"]],BAND={HOSE:7,HNX:10,UPCOM:15};
var sc=function(p){p=Number(p);return p>0&&p<1000?p*1000:p};
function recent(){try{return JSON.parse(localStorage.getItem(RK)||"[]")}catch(e){return[]}}
function pushRecent(s){try{localStorage.setItem(RK,JSON.stringify([s].concat(recent().filter(function(x){return x!==s})).slice(0,10)))}catch(e){}}
function PF(){return window.NHIPPF&&window.NHIPPF.PF2}
function sel(){var r=ticket&&ticket.sel?ticket.sel():{},x=PF(),p=x&&x.list.filter(function(q){return q.id===r.pid})[0];return p||null}
function mountTicket(){if(ticket){ticket.destroy();ticket=null}var el=document.getElementById("trade-ticket");if(el&&window.NHIPTrade){ticket=window.NHIPTrade.mount(el,{mode:"i",whoHost:document.getElementById("tp-who"),side:side,symbol:function(){return symbol},price:function(){return last},quote:ordQuote,exch:ordExch,candles:ordCandles,setSymbol:function(s){setSymbol(s)}})}}
function ordQuote(s){return s===symbol?{last:last,ref:st&&st.ref}:(pxm[s]&&pxm[s].p?{last:pxm[s].p}:null)}
function ordExch(s){var m=items.filter(function(x){return (x.symbol||x.code)===s})[0];return window.NHIPOrders?window.NHIPOrders.baseExch(s,m):"HOSE"}
function ordCandles(s){return s===symbol?cds:null}
var exSeen="";
function rowOf(s){return items.filter(function(x){return (x.symbol||x.code)===s})[0]||null}
function exTag(s){var N=window.NHIPOrders;return N&&N.exTag?N.exTag(s,rowOf(s)):""}
var DEFSYM={HOSE:"FPT",HNX:"SHS",UPCOM:"ACV"},LSK="nhip.trade.lastsym";
function exOfSym(s){var N=window.NHIPOrders;return N?N.effEx(s,rowOf(s)):"HOSE"}
function exNm(e){var N=window.NHIPOrders;return N?N.exName(e):e}
function lastMap(){try{return JSON.parse(localStorage.getItem(LSK)||"{}")||{}}catch(e){return{}}}
function remember(s){var N=window.NHIPOrders;if(!N||!N.exKnown(s))return;var m=lastMap();m[exOfSym(s)]=s;try{localStorage.setItem(LSK,JSON.stringify(m))}catch(e){}}
function inEx(s){return exOfSym(s)===curEx()}
/* v1.73.4: 3 sàn = 3 không gian riêng. Đổi sàn → sang mã gần nhất đã xem của sàn đó (mặc định FPT / SHS / ACV); mã chưa rõ sàn thì chỉ gán sàn cho mã đó. */
function switchEx(ex){var N=window.NHIPOrders;if(!N)return;ex=N.normEx(ex);if(curEx()===ex)return;if(!N.exKnown(symbol)){N.setExch(symbol,ex);return}
 var t=lastMap()[ex];if(!t||exOfSym(t)!==ex||!N.exKnown(t))t=DEFSYM[ex];setSymbol(t);try{window.NHIPPF.toast("Sàn "+exNm(ex)+" · "+t)}catch(e){}}
function drawEx3(){var el=document.getElementById("tp-ex3");if(!el)return;var N=window.NHIPOrders,p=sel(),c=curEx(),cnt={};if(p)(p.orders||[]).forEach(function(o){var e=exOfSym(o.sym);cnt[e]=(cnt[e]||0)+1});
 el.innerHTML=["HOSE","HNX","UPCOM"].map(function(k){return '<button type="button" role="tab" aria-selected="'+(k===c)+'" data-tp-ex="'+k+'" class="'+(k===c?"on":"")+'"><b>'+exNm(k)+'</b>'+(cnt[k]?'<i title="Số lệnh chờ">'+cnt[k]+'</i>':"")+'</button>'}).join("")}
function exTxt(s){var N=window.NHIPOrders;return N&&N.exText?N.exText(s,rowOf(s)):""}
/* v1.73.2: sàn của mã đến SAU khi trang đã dựng (danh sách mã / danh bạ VNDirect nạp xong) → báo để trần/sàn, phiếu lệnh, thông tin mã dựng lại theo đúng sàn */
function exSync(){var e=curEx();if(exSeen&&e!==exSeen){try{window.dispatchEvent(new CustomEvent("nhip:exch-changed",{detail:{sym:symbol}}))}catch(x){}}exSeen=e}
function curEx(){var N=window.NHIPOrders;return N&&N.getExch?N.getExch(symbol,ordExch(symbol)):"HOSE"}
function drawStats(){var el=document.getElementById("tp-stats");if(!el||!st)return;var S=function(l,v,c){return '<div><dt>'+l+'</dt><dd class="'+(c||"")+'">'+v+'</dd></div>'};el.innerHTML=S("Trần",fmt(st.ce,0),"tp-ce")+S("Sàn",fmt(st.fl,0),"tp-fl")+S("TC",fmt(st.ref,0),"tp-rf")+S("KL",fmt(st.v,0))+S("Giá trị",money(st.val))}
/* Trần/sàn theo SÀN đang chọn (±7% HOSE, ±10% HNX, ±15% UPCoM), làm tròn theo bước giá: trần xuống, sàn lên */
function bandApply(){if(!st)return;var N=window.NHIPOrders,b=N&&st.ref>0?N.band(st.ref,curEx()):null;st.ce=b?b.ce:null;st.fl=b?b.fl:null;drawStats()}
function ordMount(el){var h=el.querySelector("#tp-ord");if(ordTbl&&h){ordTbl.refresh();return}if(ordTbl){ordTbl.destroy();ordTbl=null}if(!window.NHIPOrders){el.innerHTML='<p class="muted tp-e">Thiếu module lệnh chờ.</p>';return}el.innerHTML='<div id="tp-ord"></div>';ordTbl=window.NHIPOrders.mountTable(el.firstChild,{symbol:function(){return symbol},symbolOnly:false,noExUi:true,listOnly:true,quote:ordQuote,exch:ordExch,candles:ordCandles,onPick:function(s){setSymbol(s)},onFill:fillOrder})}
function fillOrder(o){setSymbol(o.sym,o.kind==="buy"?"buy":"sell");view="order";goSide=null;mark();drawGo();setTimeout(function(){if(ticket&&ticket.prefill)ticket.prefill(o)},0)}
function meta(){return items.filter(function(x){return (x.symbol||x.code)===symbol})[0]||null}
function dirc(v){return v==null||v===0?"":v>0?"up":"dn"}
/* ---------- khung trang ---------- */
function render(){
 var WIDE=!!(window.matchMedia&&window.matchMedia("(min-width:1101px)").matches);
 root.innerHTML='<section class="tp" data-v="'+view+'"><div class="panel tp-head"><div class="tp-id"><div class="tp-idtop"><button type="button" id="tp-sym" class="tp-symbtn" data-sym="'+esc(symbol)+'" title="Chạm để chọn mã khác trong cùng sàn" aria-label="Chọn mã khác trong sàn"><b>'+esc(symbol)+'</b></button><span id="trade-ex" class="tp-ex"></span></div><small id="trade-co">Đang tải…</small><select id="trade-symbol" hidden tabindex="-1" aria-hidden="true"><option>'+esc(symbol)+'</option></select></div><div class="tp-px"><b id="trade-last">…</b><span id="trade-change" class="muted">—</span></div><dl class="tp-stats" id="tp-stats"></dl><div class="tp-act"><button type="button" class="tp-b" data-tp-side="buy">Mua</button><button type="button" class="tp-s" data-tp-side="sell">Bán</button></div><div class="tp-wl"><div class="tp-wt"><button type="button" data-tp-wt="wl">Theo dõi</button><button type="button" data-tp-wt="rc">Gần đây</button></div><div id="tp-wlist" class="tp-wlist"></div></div>'+(WIDE?'<div class="tp-accbar"><div id="tp-acct" class="tp-acct"></div><div id="tp-who" class="tp-who2"></div></div>':'')+'</div>'+
 '<div class="tp-ex3" id="tp-ex3" role="tablist" aria-label="Chọn sàn giao dịch"></div>'+
 '<div class="tp-seg" role="tablist"><button type="button" data-tp-v="chart">Biểu đồ</button><button type="button" data-tp-v="order">Đặt lệnh</button><button type="button" data-tp-v="info">Thông tin</button></div>'+
 '<div class="tp-body">'+
 '<div class="tp-mid"><section class="tp-chart"><div id="tp-chart-host" class="tp-chart-host"><div class="placeholder">Đang tải biểu đồ…</div></div><div class="tp-gobar" id="tp-gobar" hidden></div><p class="tp-foot"><span id="trade-updated">Đang tải dữ liệu…</span> · Biểu đồ phân tích · giá suy ra từ nến gần nhất, có thể trễ.</p></section>'+
 '<section class="panel tp-info"><div class="tp-tabs"><button type="button" data-tp-tab="info">Thông tin mã</button><button type="button" data-tp-tab="pf">Danh mục</button><button type="button" data-tp-tab="day">Lệnh trong ngày</button><button type="button" data-tp-tab="tx">Lịch sử lệnh</button><button type="button" data-tp-tab="cond">Lệnh chờ</button><button type="button" data-tp-tab="asset">Tài sản</button></div><div id="tp-tabc" class="tp-tabc"></div></section></div>'+
 '<aside class="panel tp-ticket"><h2 class="tp-th">Đặt lệnh · <span id="tp-ts">'+esc(symbol)+'</span><span id="tp-ts-ex"></span></h2>'+(WIDE?'':'<div id="tp-acct" class="tp-acct"></div>')+'<div id="trade-ticket"></div></aside></div></section>';
 mark();loadSymbols();loadQuote();mountTicket();loadWl();drawTab();mountChart();drawGo();
}
function drawGo(){var el=document.getElementById("tp-gobar");if(!el)return;var on=!!goSide&&view==="chart";el.hidden=!on;if(on){el.innerHTML='<button type="button" class="tp-go-'+goSide+'" data-tp-act="goorder">'+(goSide==="sell"?"Bán ":"Mua ")+esc(symbol)+' · mở phiếu lệnh →</button>'}}
function pickSide(sd){side=sd==="sell"?"sell":"buy";if(ticket)ticket.setSide(side);mark()}
function mark(){root.querySelectorAll("[data-tp-days]").forEach(function(b){b.classList.toggle("on",+b.dataset.tpDays===days)});root.querySelectorAll("[data-tp-tab]").forEach(function(b){b.classList.toggle("on",b.dataset.tpTab===tab)});root.querySelectorAll("[data-tp-wt]").forEach(function(b){b.classList.toggle("on",b.dataset.tpWt===wtab)});root.querySelectorAll("[data-tp-v]").forEach(function(b){b.classList.toggle("on",b.dataset.tpV===view)});var t=root.querySelector(".tp");if(t)t.dataset.v=view;var s=document.getElementById("tp-star");if(s){var on=wl.indexOf(symbol)>=0;s.textContent=on?"★ Đang theo dõi":"☆ Theo dõi";s.classList.toggle("on",on)}}
/* ---------- dữ liệu ---------- */
/* v2.29: /api/symbols được nhip-house.js lọc THEO SÀN đang đứng → danh sách phải nạp lại khi đổi sàn (trước đây giữ danh sách của sàn cũ nên chỉ còn đúng 1 mã, phải tải lại trang). */
function houseKey(){return window.NHIPHouse&&window.NHIPHouse.cur?window.NHIPHouse.cur():""}
async function loadSymbols(retry){try{var hx=houseKey();if(!items.length||itemsEx!==hx){var r=await fetch("/api/symbols");if(!r.ok)throw new Error("symbols");var j=(await r.json()).items||[];if(houseKey()!==hx)return;if(!j.length)throw new Error("empty");items=j;itemsEx=hx}var el=document.getElementById("trade-symbol");if(!el)return;fillSyms();showCo();exSync();if(window.NHIPSYM&&window.NHIPSYM.refresh)window.NHIPSYM.refresh().then(function(){if(houseKey()===hx&&document.getElementById("trade-symbol")){fillSyms();showCo();exSync()}}).catch(function(){})}catch(e){if(!retry&&document.getElementById("trade-symbol"))setTimeout(function(){loadSymbols(1)},1500)}}
function symNm(x,s){var n=(x&&(x.name||x.companyName))||"";if(!n&&window.NHIPSYM&&window.NHIPSYM.name)n=window.NHIPSYM.name(s)||"";return n?" · "+n:""}
/* v2.29.2: danh sách mã = mã gợi ý của máy chủ (đứng đầu) + TOÀN BỘ danh bạ mã có sàn (bản nhúng + danh sách niêm yết VNDirect), rồi lọc theo sàn đang đứng. */
function symPool(){var seen={},out=[];items.forEach(function(x){var s=x.symbol||x.code||"";if(s&&!seen[s]){seen[s]=1;out.push(x)}});var S=window.NHIPSYM,extra=[];if(S&&S.all)S.all().forEach(function(e){if(!seen[e.sym]){seen[e.sym]=1;extra.push({symbol:e.sym,name:e.name})}});extra.sort(function(a,b){return a.symbol<b.symbol?-1:a.symbol>b.symbol?1:0});return out.concat(extra)}
function fillSyms(){var el=document.getElementById("trade-symbol");if(el)el.innerHTML='<option selected value="'+esc(symbol)+'">'+esc(symbol)+'</option>';drawSym()}
function drawSym(){var b=document.getElementById("tp-sym");if(!b)return;b.dataset.sym=symbol;var t=b.querySelector("b");if(t)t.textContent=symbol}
function showCo(){var m=meta(),el=document.getElementById("trade-co");if(el){var nm=(m&&(m.name||m.companyName))||(window.NHIPSYM&&window.NHIPSYM.name&&window.NHIPSYM.name(symbol))||"Cổ phiếu",sc0=(m&&m.sector)||"";if(!sc0){try{var inf=window.NHIPSYM&&window.NHIPSYM.info?window.NHIPSYM.info(symbol):null;sc0=(inf&&inf.sector)||""}catch(x){}}el.innerHTML="<span>"+esc(nm)+"</span>"+(sc0?"<em>"+esc(sc0)+"</em>":"")}drawSym();var t=exTag(symbol),a=document.getElementById("trade-ex"),b=document.getElementById("tp-ts-ex");if(a)a.innerHTML=t;if(b)b.innerHTML=t;drawEx3()}
async function loadWl(){
 /* v2.7.21: danh sách theo dõi lấy từ /api/state (cùng nguồn với mục Theo dõi); trước đây gọi GET /api/watchlist không tồn tại nên luôn rỗng */
 try{var r=await fetch("/api/state",{cache:"no-store"});if(r.ok){var d=await r.json();if(Array.isArray(d.watchlist))wl=d.watchlist.slice(0,50)}}catch(e){}
 try{if(!wl.length&&typeof ST!=="undefined"&&ST&&Array.isArray(ST.watchlist))wl=ST.watchlist.slice(0,50)}catch(e){}
 try{if(typeof ST!=="undefined"&&ST&&Array.isArray(ST.watchlist)&&wl.length)ST.watchlist=wl.slice()}catch(e){}
 if(recent().indexOf(symbol)<0)pushRecent(symbol);
 mark();drawWl();drawTab();
 var p=sel(),ps=p?p.positions.map(function(x){return x.symbol}):[],list=wl.concat(recent(),ps,[symbol]).filter(function(v,i,a){return v&&a.indexOf(v)===i}),chunks=[];
 for(var k=0;k<list.length;k+=20)chunks.push(list.slice(k,k+20));
 await Promise.all(chunks.map(async function(c){try{var q=await fetch("/api/quotes?symbols="+c.join(","));if(q.ok)((await q.json()).items||[]).forEach(function(x){if(!x.error)pxm[x.symbol]={p:sc(x.price),c:x.changePct}})}catch(e){}}));
 mark();drawWl();drawTab();
}
function drawWl(){var el=document.getElementById("tp-wlist");if(!el)return;var l=(wtab==="wl"?wl:recent()).filter(inEx);
 el.innerHTML=l.length?l.map(function(s){var q=pxm[s];return '<button type="button" class="tp-wr'+(s===symbol?" on":"")+'" data-tp-sym="'+esc(s)+'"><span class="tp-wsy"><b>'+esc(s)+'</b>'+exTag(s)+'</span><span>'+(q?fmt(q.p,0):"—")+'</span><span class="'+(q?dirc(q.c):"")+'">'+(q&&q.c!=null?(q.c>0?"+":"")+fmt(q.c)+"%":"")+'</span></button>'}).join(""):'<p class="muted tp-e">'+(wtab==="wl"?"Chưa có mã theo dõi trên sàn "+exNm(curEx())+". Bấm “☆ Theo dõi”.":"Chưa xem mã nào trên sàn "+exNm(curEx())+".")+'</p>'}
async function loadQuote(){
 var id=++seq;
 try{
  var r=await fetch("/api/analysis/"+encodeURIComponent(symbol)+"?resolution=D&days="+days,{cache:"no-store"});if(!r.ok)throw Error("Nguồn dữ liệu trả về lỗi HTTP "+r.status);
  var d=await r.json();if(id!==seq)return;var cs=d.candles||[];if(!cs.length)throw Error("Nguồn không có dữ liệu nến");
  var c=cs[cs.length-1],p=cs.length>1?cs[cs.length-2]:null,k=(Number(c.close)>0&&Number(c.close)<1000)?1000:1;
  last=Number(c.close)*k;cds=cs.map(function(x){return {time:x.time,low:Number(x.low)*k,high:Number(x.high)*k}});var ref=p?Number(p.close)*k:null,chg=ref?last-ref:null,pct=ref?chg/ref*100:null,vol=Number(c.volume)||0;
  var NO=window.NHIPOrders,ct=Number(c.time),cday=NO&&isFinite(ct)?NO.vnDate(new Date(ct>1e12?ct:ct*1000)):"",bref=NO&&cday&&cday<NO.vnDate()?last:ref;
  st={ref:bref||ref,ce:null,fl:null,o:Number(c.open)*k,h:Number(c.high)*k,l:Number(c.low)*k,v:vol,val:vol*last};
  var L=document.getElementById("trade-last");L.textContent=fmt(last,0);L.className=dirc(chg);
  var ch=document.getElementById("trade-change");ch.className=dirc(chg);ch.textContent=ref?(chg>0?"▲ +":chg<0?"▼ ":"")+fmt(chg,0)+" ("+(pct>0?"+":"")+fmt(pct)+"%)":"—";
  bandApply();
  document.getElementById("trade-updated").textContent="Cập nhật "+new Date().toLocaleTimeString("vi-VN");
  pxm[symbol]={p:last,c:pct};drawWl();drawTab();if(ticket)ticket.refresh();
 }catch(e){if(id!==seq)return;var l=document.getElementById("trade-last");if(l)l.textContent="—";var u=document.getElementById("trade-updated");if(u)u.textContent="Không có dữ liệu mới"}
}
/* ---------- tab dưới biểu đồ ---------- */
var dc=function(v){return v==null||v===0?"":v>0?"up":"dn"},sg=function(v,d){return v==null||!isFinite(v)?"—":(v>0?"+":"")+fmt(v,d==null?0:d)};
function acct(){var p=sel();if(!p)return null;var mv=0,cost=0;p.positions.forEach(function(x){var q=pxm[x.symbol];mv+=(q?q.p:x.cost)*x.qty;cost+=x.cost*x.qty});return {p:p,mv:mv,cost:cost,total:p.cash+mv,upl:mv-cost,pct:cost>0?(mv/cost-1)*100:null}}
function conds(p){var o=[];p.positions.forEach(function(x){var od=(p.orders||[]).filter(function(y){return y.sym===x.symbol&&(y.kind==="tp"||y.kind==="sl")}),sls=od.filter(function(y){return y.kind==="sl"}).sort(function(a,b){return b.price-a.price}),tps=od.filter(function(y){return y.kind==="tp"}).sort(function(a,b){return a.price-b.price});if(sls.length||tps.length){o.push({s:x.symbol,q:x.qty,sl:sls[0]?sls[0].price:null,tp:tps[0]?tps[0].price:null,d:"",n:sls.length+tps.length});return}var t=p.tx.filter(function(t){return t.symbol===x.symbol&&t.type==="buy"&&/(SL|TP) \d/.test(t.note||"")})[0];if(!t)return;var g=function(k){var m=new RegExp(k+" ([\\d.,]+)").exec(t.note);return m?+m[1].replace(/\./g,"").replace(",","."):null};var sl=g("SL"),tp=g("TP");if(sl||tp)o.push({s:x.symbol,q:x.qty,sl:sl,tp:tp,d:t.date})});return o}
function tbl(h,rows,empty){return rows.length?'<div class="tp-tw"><table class="tp-t"><thead><tr>'+h.map(function(x){return '<th>'+x+'</th>'}).join("")+'</tr></thead><tbody>'+rows.join("")+'</tbody></table></div>':'<p class="muted tp-e">'+empty+'</p>'}
var txRow=function(t){return '<tr><td>'+esc(t.date)+'</td><td><b>'+esc(t.symbol)+'</b>'+exTag(t.symbol)+'</td><td class="'+(t.type==="buy"?"up":"dn")+'">'+(t.type==="buy"?"Mua":"Bán")+'</td><td>'+fmt(t.qty,0)+'</td><td>'+fmt(t.price,0)+'</td><td>'+fmt(t.qty*t.price,0)+'</td><td>'+fmt(t.fee||0,0)+'</td></tr>'};
function drawAcct(){var el=document.getElementById("tp-acct");if(!el)return;var a=acct();el.innerHTML=a?'<div><span title="Sức mua (tiền mặt)">Sức mua<i class="tp-sub"> (tiền mặt)</i></span><b class="'+(a.p.cash<0?"dn":"")+'">'+money(a.p.cash)+' ₫</b></div><div><span>Tổng tài sản</span><b>'+money(a.total)+' ₫</b></div><div><span>Lãi/lỗ tạm tính</span><b class="'+dc(a.upl)+'">'+sg(a.upl)+(a.pct!=null?" ("+sg(a.pct,2)+"%)":"")+'</b></div>':""}
function drawTab(){drawAcct();drawEx3();var el=document.getElementById("tp-tabc");if(!el)return;var h="",a=acct(),p=a&&a.p,NO='<p class="muted tp-e">Chọn khách hàng và danh mục trong phiếu lệnh để xem.</p>';
 if(tab!=="cond"&&ordTbl){ordTbl.destroy();ordTbl=null}
 if(tab==="cond"){ordMount(el);return}
 if(tab==="info"){var c=function(l,v,k){return '<div><span>'+l+'</span><b class="'+(k||"")+'">'+v+'</b></div>'};var N0=window.NHIPOrders,ex0=curEx(),m0=meta(),idc='<div class="tp-idc"><div class="tp-idc-t"><b>'+esc(symbol)+'</b>'+exTag(symbol)+'</div><span>'+esc(m0?(m0.name||m0.companyName||"")+(m0.sector?" · "+m0.sector:""):"")+'</span></div>',
  rule=N0&&N0.BAND?c("Sàn giao dịch",exTag(symbol))+c("Biên độ ngày","±"+N0.BAND[ex0]+"%")+c("Bước giá",fmt(N0.tickSize(last||(st&&st.ref)||50000,ex0),0)+" đ")+c("Lô giao dịch",ex0==="UPCOM"?"từ 1 cp":"100 cp (lẻ 1–99)"):"",
  warn=N0&&N0.exKnown&&!N0.exKnown(symbol)?'<p class="tp-foot tp-exw">Chưa xác định được sàn của '+esc(symbol)+' (tạm tính HOSE). Chọn đúng sàn ở tab Đặt lệnh để trần/sàn, bước giá, loại lệnh được tính đúng.</p>':"";
 h=idc+(st?'<div class="tp-ig">'+rule+c("Trần",fmt(st.ce,0),"tp-ce")+c("Sàn",fmt(st.fl,0),"tp-fl")+c("Tham chiếu",fmt(st.ref,0),"tp-rf")+c("Mở cửa",fmt(st.o,0))+c("Cao nhất",fmt(st.h,0),"up")+c("Thấp nhất",fmt(st.l,0),"dn")+c("Khối lượng",fmt(st.v,0))+c("Giá trị",money(st.val)+" ₫")+'</div>':'<p class="muted tp-e">Đang tải…</p>')+warn;
  if(p){var x=p.positions.filter(function(q){return q.symbol===symbol})[0],tx=p.tx.filter(function(t){return t.symbol===symbol&&(t.type==="buy"||t.type==="sell")}).slice(0,5);var v=x&&last?x.qty*last:0,pl=x&&last?(last-x.cost)*x.qty:null;
   h+='<h3 class="tp-h3">Vị thế '+esc(symbol)+' · '+esc(p.name)+'</h3>'+(x?'<div class="tp-ig">'+c("Đang giữ",fmt(x.qty,0)+" cp")+c("Giá vốn BQ",fmt(x.cost,0))+c("Giá trị",money(v)+" ₫")+c("Lãi/lỗ",sg(pl)+(x.cost>0&&last?" ("+sg((last/x.cost-1)*100,2)+"%)":""),dc(pl))+c("Tỷ trọng",a.total>0?fmt(v/a.total*100,1)+"%":"—")+'</div>':'<p class="muted tp-e">Danh mục chưa giữ '+esc(symbol)+'.</p>')+'<h3 class="tp-h3">Khớp lệnh của tôi · '+esc(symbol)+'</h3>'+tbl(["Ngày","Mã","Lệnh","SL","Giá","Giá trị","Phí"],tx.map(txRow),"Chưa có giao dịch "+esc(symbol)+".")}}
 else if(!p)h=NO;
 else if(tab==="pf")h=tbl(["Mã","KL","Giá vốn","Giá hiện tại","TP / SL","Giá trị","Lãi/lỗ","%","Tỷ trọng",""],p.positions.filter(function(x){return inEx(x.symbol)}).map(function(x){var q=pxm[x.symbol],v=q?q.p*x.qty:null,pl=q?(q.p-x.cost)*x.qty:null,pp=q&&x.cost>0?(q.p/x.cost-1)*100:null;return '<tr><td><b>'+esc(x.symbol)+'</b>'+exTag(x.symbol)+'</td><td>'+fmt(x.qty,0)+'</td><td>'+fmt(x.cost,0)+'</td><td>'+(q?fmt(q.p,0):"—")+'</td><td class="tp-tsc"><button type="button" class="pt-open" data-tp-tpsl="'+esc(x.symbol)+'" title="Bấm để đặt / sửa Take profit – Stop loss">'+(window.NHIPProtect?window.NHIPProtect.cellHtml(p,x.symbol,q?q.p:null):"Đặt TP/SL")+'</button></td><td>'+(v==null?"—":fmt(v,0))+'</td><td class="'+dc(pl)+'">'+sg(pl)+'</td><td class="'+dc(pp)+'">'+(pp==null?"—":sg(pp,2)+"%")+'</td><td>'+(v!=null&&a.total>0?fmt(v/a.total*100,1)+"%":"—")+'</td><td class="tp-ta"><button type="button" class="tp-mb" data-tp-go="'+esc(x.symbol)+'" data-tp-gs="buy">Mua</button><button type="button" class="tp-ms" data-tp-go="'+esc(x.symbol)+'" data-tp-gs="sell">Bán</button></td></tr>'}),"Danh mục chưa giữ cổ phiếu nào trên sàn "+exNm(curEx())+".")+'<p class="tp-foot">Danh mục '+esc(p.name)+' · Tiền mặt '+money(p.cash)+' ₫ · giá hiện tại lấy từ nến gần nhất · chỉ hiện mã sàn '+exNm(curEx())+'.</p>';
 else if(tab==="day"){var td=window.NHIPPF.todayS();h=tbl(["Ngày","Mã","Lệnh","SL","Giá","Giá trị","Phí"],p.tx.filter(function(t){return (t.type==="buy"||t.type==="sell")&&t.date===td&&inEx(t.symbol)}).map(txRow),"Hôm nay chưa có lệnh nào trên sàn "+exNm(curEx())+".")}
 else if(tab==="tx")h=tbl(["Ngày","Mã","Lệnh","SL","Giá","Giá trị","Phí"],p.tx.filter(function(t){return (t.type==="buy"||t.type==="sell")&&inEx(t.symbol)}).slice(0,30).map(txRow),"Chưa có giao dịch trên sàn "+exNm(curEx())+".");
 else if(tab==="cond"){h=tbl(["Mã","SL","Giá HT","Stop loss","Take profit","Trạng thái"],conds(p).map(function(o){var q=pxm[o.s],px=q?q.p:null,hit=px&&o.sl&&px<=o.sl?'<b class="dn">Đã chạm SL</b>':px&&o.tp&&px>=o.tp?'<b class="up">Đã chạm TP</b>':'Đang chờ';return '<tr><td><b>'+esc(o.s)+'</b></td><td>'+fmt(o.q,0)+'</td><td>'+(px?fmt(px,0):"—")+'</td><td>'+(o.sl?fmt(o.sl,0)+(px?' <small class="muted">('+sg((o.sl/px-1)*100,1)+'%)</small>':""):"—")+'</td><td>'+(o.tp?fmt(o.tp,0)+(px?' <small class="muted">('+sg((o.tp/px-1)*100,1)+'%)</small>':""):"—")+'</td><td>'+hit+'</td></tr>'}),"Chưa có mức SL/TP nào được đặt cho các vị thế đang giữ.")+'<p class="tp-foot">Lấy từ TP/SL đặt trong Danh mục (mức gần giá nhất mỗi phía) hoặc ghi chú SL/TP lúc mua. Chỉ theo dõi và báo trạng thái, không tự bán khi chạm giá. Đặt/sửa TP/SL: Danh mục → bấm một mã.</p>'}
 else{var r=function(l,v,k){return '<div><span>'+l+'</span><b class="'+(k||"")+'">'+v+'</b></div>'};h='<div class="tp-ig">'+r("Tiền mặt",money(p.cash)+" ₫",p.cash<0?"dn":"")+r("Giá trị cổ phiếu",money(a.mv)+" ₫")+r("Tổng tài sản",money(a.total)+" ₫")+r("Vốn cổ phiếu",money(a.cost)+" ₫")+r("Lãi/lỗ chưa thực hiện",sg(a.upl)+(a.pct!=null?" ("+sg(a.pct,2)+"%)":""),dc(a.upl))+r("Lãi/lỗ đã thực hiện",sg(p.realized||0),dc(p.realized))+r("Cổ tức đã nhận",money(p.divs||0)+" ₫")+'</div>'+(p.positions.length?'<h3 class="tp-h3">Phân bổ</h3>'+p.positions.map(function(x){var q=pxm[x.symbol],v=(q?q.p:x.cost)*x.qty,w=a.total>0?v/a.total*100:0;return '<div class="tp-bar"><span>'+esc(x.symbol)+'</span><i><u style="width:'+Math.min(100,w).toFixed(1)+'%"></u></i><b>'+fmt(w,1)+'%</b></div>'}).join(""):"")}
 el.innerHTML=h}
function mountChart(){var h=document.getElementById("tp-chart-host");if(!h||typeof window.vCharts!=="function")return;sessionStorage.analysisSym=symbol;Promise.resolve(window.vCharts({mode:"analysis",host:h})).catch(function(e){h.innerHTML='<div class="placeholder">'+esc((e&&e.message)||"Không tải được biểu đồ")+'</div>'})}
function chartSym(s){var i=document.getElementById("si"),f=document.getElementById("sf");if(!i||!f){mountChart();return}i.value=s;sessionStorage.analysisSym=s;f.dispatchEvent(new Event("submit",{cancelable:true}))}
/* ---------- thao tác ---------- */
function setSymbol(s,sd,fromChart){s=String(s||"").toUpperCase().trim();if(!s)return;if(s!==symbol&&window.NHIPHouse&&!window.NHIPHouse.gate(s,{onCancel:function(){var sl=document.getElementById("trade-symbol");if(sl)sl.value=symbol}}))return;if(sd){side=sd}if(s!==symbol){symbol=s;sessionStorage.sym=s;sessionStorage.analysisSym=s;pushRecent(s);remember(s);history.replaceState(null,"","#/giao-dich?s="+encodeURIComponent(s));last=null;st=null;var t=document.getElementById("tp-ts");if(t)t.textContent=s;var sl=document.getElementById("trade-symbol");if(sl)sl.value=s;showCo();fillSyms();exSeen=curEx();mountTicket();if(!fromChart)chartSym(s);loadQuote();loadWl()}else if(sd&&ticket)ticket.setSide(sd);mark();drawWl()}
async function toggleWatch(){var n=wl.indexOf(symbol)>=0?wl.filter(function(x){return x!==symbol}):[symbol].concat(wl);try{var r=await fetch("/api/watchlist",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({symbols:n})});if(r.ok){var d=await r.json();wl=d.watchlist||n}else{var ej=await r.json().catch(function(){return{}});toast(ej.error||("Không ghi được Theo dõi (HTTP "+r.status+")"),1)}}catch(e){}mark();drawWl()}
root.addEventListener("change",function(e){if(e.target.id==="trade-symbol")setSymbol(e.target.value)});
root.addEventListener("click",function(e){if(e.target.closest&&e.target.closest("#aw"))setTimeout(loadWl,700)}); /* bấm ☆ Theo dõi ở hàng nhập mã → làm mới danh sách theo dõi */
/* v2.40 — bảng đặt TP/SL mở từ dòng danh mục (dùng chung với biểu đồ: NHIPTpSl) */
function openTpSl(sym,kind){var p=sel(),T=window.NHIPTpSl,N=window.NHIPOrders;if(!p){try{window.NHIPPF.toast("Chọn khách hàng và danh mục trong phiếu lệnh trước",1)}catch(e){}return}if(!T)return;T.open({pid:p.id,symbol:sym,kind:kind,quote:function(){var q=pxm[sym];return {last:q&&q.p>0?q.p:null,exch:N&&N.baseExch?N.baseExch(sym):"HOSE"}},onChange:function(){drawTab()},onFill:fillOrder})}
if(!window.__nhipTpslBound){window.__nhipTpslBound=1;window.addEventListener("nhip:orders-changed",function(){if(tab==="pf"&&document.getElementById("tp-tabc"))drawTab()});window.addEventListener("nhip:fill-order",function(e){if(e.detail&&document.getElementById("tp-tabc")){e.preventDefault();fillOrder(e.detail)}})}
root.addEventListener("click",function(e){var b=e.target.closest("[data-tp-sym],[data-tp-days],[data-tp-act],[data-tp-side],[data-tp-v],[data-tp-tab],[data-tp-wt],[data-tp-go],[data-tp-ex],[data-tp-tpsl]");if(!b)return;var D=b.dataset;
 if(D.tpTpsl)openTpSl(D.tpTpsl);
 else if(D.tpSym)setSymbol(D.tpSym);
 else if(D.tpDays){days=+D.tpDays;mark();loadQuote()}
 else if(D.tpSide){side=D.tpSide;if(ticket)ticket.setSide(side);view="order";goSide=null;mark();drawGo();var t=root.querySelector(".tp-ticket");if(t&&innerWidth>900)t.scrollIntoView({block:"nearest",behavior:"smooth"})}
 else if(D.tpV){view=D.tpV;goSide=null;mark();drawGo()}
 else if(D.tpTab){tab=D.tpTab;mark();drawTab()}
 else if(D.tpEx)switchEx(D.tpEx)
 else if(D.tpWt){wtab=D.tpWt;mark();drawWl();if(wtab==="wl")loadWl()}
 else if(D.tpGo){var gs=D.tpGs==="sell"?"sell":"buy";setSymbol(D.tpGo,gs);side=gs;if(ticket)ticket.setSide(gs);view="order";goSide=null;mark();drawGo();setTimeout(function(){var t=root.querySelector(".tp-ticket");if(t)t.scrollIntoView({block:"start",behavior:"smooth"});else window.scrollTo({top:0,behavior:"smooth"})},60)} /* v2.41: Mua/Bán ở Danh mục → thẳng phiếu Đặt lệnh đúng chiều */
 else if(D.tpAct==="goorder"){view="order";goSide=null;mark();drawGo()}
 else if(D.tpAct==="star")toggleWatch();
 else loadQuote()});
/* v1.69.7: biểu đồ nhúng đổi mã (ô tìm kiếm, danh sách theo dõi…) thì phiếu lệnh, thanh giá, tab Thông tin đổi theo đúng mã đó. */
window.addEventListener("nhip:exch-changed",function(){if(!document.getElementById("tp-tabc"))return;bandApply();showCo();fillSyms();drawWl();drawTab()});
window.addEventListener("nhip:ex-switch",function(e){if(!document.getElementById("tp-tabc")||!e||!e.detail)return;e.detail.handled=true;switchEx(e.detail.ex)});
window.addEventListener("nhip:chart-symbol",function(e){var s=e&&e.detail&&e.detail.sym;if(s&&document.getElementById("tp-tabc")&&/#\/giao-dich/.test(location.hash)&&String(s).toUpperCase()!==symbol)setSymbol(s,null,true)});
/* nút Mua/Bán ở trang Biểu đồ & Phân tích: nhớ mã đang xem + chiều lệnh.
   v1.69.6: nếu đã ở trang Giao dịch thì chỉ đổi chiều Mua/Bán trên phiếu đang mở (giữ nguyên các ô khác), không để lại cờ cho lần vào sau. */
document.addEventListener("click",function(e){var a=e.target.closest("[data-trade-quick]");if(!a)return;var sd=a.dataset.tradeQuick==="sell"?"sell":"buy";
 if(document.getElementById("tp-tabc")&&/#\/giao-dich/.test(location.hash)){e.preventDefault();pickSide(sd);if(innerWidth<=900){view="order";goSide=null;mark();drawGo()}return}
 var h=document.getElementById("cp-sym"),i=document.getElementById("si"),s=String((h&&h.textContent)||window.__nhipChartSymbol||(i&&i.value)||"").trim().toUpperCase();if(s&&window.NHIPPF&&window.NHIPPF.isIdx&&window.NHIPPF.isIdx(s)){e.preventDefault();try{window.NHIPPF.toast(s+" là chỉ số — không giao dịch được. Chọn một mã cổ phiếu.",1)}catch(x){}return}if(s){sessionStorage.sym=s;sessionStorage.analysisSym=s;a.setAttribute("href","#/giao-dich?s="+encodeURIComponent(s))}try{sessionStorage.tradeSide=JSON.stringify({side:sd,t:Date.now()})}catch(x){}});
function stop(){if(ordTbl){ordTbl.destroy();ordTbl=null}if(timer){clearInterval(timer);timer=null}if(ticket){ticket.destroy();ticket=null}if(chart){try{window.klinecharts.dispose(chart)}catch(e){}chart=null}}
window.NHIPTrading={setSymbol:function(x){setSymbol(x)},symbol:function(){return symbol},reload:function(){try{loadQuote();loadWl()}catch(e){}}};
window.vTradingPage=function(){stop();exSeen="";symbol=String((new URLSearchParams(location.hash.split("?")[1]||"")).get("s")||sessionStorage.sym||"FPT").toUpperCase();sessionSide();last=null;st=null;pushRecent(symbol);sessionStorage.sym=symbol;sessionStorage.analysisSym=symbol;remember(symbol);try{history.replaceState(null,"","#/giao-dich?s="+encodeURIComponent(symbol))}catch(e){}render();exSeen=curEx();if(window.NHIPOrders&&window.NHIPOrders.dirReady)window.NHIPOrders.dirReady().then(function(){if(document.getElementById("tp-tabc"))exSync()});timer=setInterval(function(){if(!document.hidden){loadQuote();loadWl()}},60000)};
function sessionSide(){var j=null;try{j=JSON.parse(sessionStorage.tradeSide||"null")}catch(e){}if(j&&typeof j==="object"&&Date.now()-(j.t||0)<15000){side=j.side==="sell"?"sell":"buy";view="order"}else{side="buy";view="chart"}sessionStorage.removeItem("tradeSide");goSide=null}
["nhip:trade-sel","nhip:portfolio-changed"].forEach(function(n){window.addEventListener(n,function(){if(document.getElementById("tp-tabc"))loadWl()})});
window.addEventListener("hashchange",function(){if(!location.hash.includes("/giao-dich"))stop()});
})();
