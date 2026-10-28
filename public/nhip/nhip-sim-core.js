/* NHIP Sim Core v2.0 — lõi mô phỏng/kiểm thử dùng chung cho backtest đơn mã, mô phỏng danh mục và walk-forward.
   Thiết kế:
   - MỘT engine duy nhất (simulate). Backtest đơn mã chỉ là danh mục 1 mã, nên hai chế độ không thể lệch logic nhau.
   - Tín hiệu tính TRƯỚC cho từng nến từ dữ liệu đến hết nến đó (không đọc được tương lai); lệnh khớp ở giá mở nến kế tiếp.
   - Luật thị trường Việt Nam (bật mặc định, tắt bằng vnRules:false): lô 100 cổ, bước giá, biên độ ±7/10/15%, thuế bán 0,1%,
     khóa bán T+2 (mặc định phiên bán sớm nhất là T+3 theo nến ngày), không bán được khi nến khóa sàn, trần cầu bị khóa thì không mua được,
     giới hạn khối lượng theo thanh khoản, cổ tức tiền/cổ phiếu (nếu người dùng cung cấp).
   - Cỡ lệnh chỉ dùng giá đóng cửa của phiên trước (không dùng giá cùng ngày để định giá danh mục).
   - verify(): kiểm tra độc lập từng lệnh với dữ liệu nến. leakProbe(): thử cắt/phá dữ liệu tương lai. monteCarlo(): phân phối kết quả.
   Đây là công cụ kiểm thử kỹ thuật; không phải dự báo hay khuyến nghị đầu tư. */
(function(){'use strict';
  var W=typeof window!=='undefined'?window:globalThis;
  var num=function(v){return v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v):null;};
  var clamp=function(v,a,b){return Math.max(a,Math.min(b,v));};
  var r6=function(x){return Math.round(x*1e6)/1e6;};

  /* ---------- thời gian ---------- */
  function timeKey(v,i){
    var idx=function(){return 'I'+String(i).padStart(8,'0');};
    if(v===undefined||v===null||v==='')return idx();
    if(typeof v==='number'){
      if(Number.isInteger(v)&&v>=19000101&&v<=22001231){var z=String(v);return z.slice(0,4)+'-'+z.slice(4,6)+'-'+z.slice(6,8);}
      if(Math.abs(v)<10000000)return 'I'+String(Math.max(0,Math.floor(v))).padStart(8,'0');
      var d=new Date(v<1e12?v*1000:v);return Number.isNaN(d.getTime())?idx():d.toISOString().slice(0,10);
    }
    var d2=new Date(v);return Number.isNaN(d2.getTime())?idx():d2.toISOString().slice(0,10);
  }
  function dateText(v,i){
    if(v===null||v===undefined||v==='')return String(i);
    if(typeof v==='number'){var d=new Date(v<1e12?v*1000:v);return Number.isNaN(d.getTime())?String(v):d.toISOString();}
    var d2=new Date(v);return Number.isNaN(d2.getTime())?String(v):d2.toISOString();
  }

  /* ---------- luật thị trường ---------- */
  var LIMITS={HOSE:7,HNX:10,UPCOM:15};
  var exMap=null;
  function exchangeOf(symbol,hint){
    if(hint){var h=String(hint).toUpperCase();if(h==='HNX'||h==='N')return 'HNX';if(h==='UPCOM'||h==='U')return 'UPCOM';if(h==='HOSE'||h==='HSX'||h==='H')return 'HOSE';}
    if(!exMap){var src=W.NHIP_SYMBOLS_VN,lines=Array.isArray(src)?src:String(src||'').split('\n'),m=new Map();/* V2.69: danh bạ là CHUỖI (join), bản cũ gọi forEach trên chuỗi nên lỗi rồi mặc định HOSE cho mọi mã */lines.forEach(function(l){var p=String(l).split('|');if(p[0]&&p[3])m.set(p[0].trim().toUpperCase(),p[3].trim().toUpperCase());});if(m.size)exMap=m;}
    var e=exMap?exMap.get(String(symbol||'').toUpperCase()):undefined;return e==='N'?'HNX':e==='U'?'UPCOM':'HOSE';
  }
  function tickVND(ex,p){if(ex==='HOSE')return p<10000?10:p<50000?50:100;return 100;}
  function tickOf(ex,price,unit){return tickVND(ex,price*unit)/unit;}
  function ceilTick(p,t){return r6(Math.ceil(p/t-1e-9)*t);}
  function floorTick(p,t){return r6(Math.floor(p/t+1e-9)*t);}
  function median(a){var s=a.slice().sort(function(x,y){return x-y;});var n=s.length;return n?(n%2?s[(n-1)/2]:(s[n/2-1]+s[n/2])/2):0;}

  /* ---------- cấu hình ---------- */
  function normOpts(o,mode){
    o=o||{};var vn=o.vnRules!==false,single=mode==='single';
    var cfg={
      mode:mode||'portfolio',vnRules:vn,
      strategy:'sma',
      smaFast:Math.round(clamp(num(o.smaFast)??20,2,200)),smaSlow:Math.round(clamp(num(o.smaSlow)??50,3,400)),
      breakoutLookback:Math.round(clamp(num(o.breakoutLookback)??20,3,250)),
      initialCapital:num(o.initialCapital)>0?num(o.initialCapital):100000000,
      feePct:clamp(num(o.feePct)??0.15,0,5),slippagePct:clamp(num(o.slippagePct)??0.1,0,5),
      sellTaxPct:vn?clamp(num(o.sellTaxPct)??0.1,0,2):0,
      trainPct:clamp(num(o.trainPct)??70,50,90),
      lotSize:vn?Math.max(1,Math.round(num(o.lotSize)??100)):1,
      settlementBars:vn?Math.round(clamp(num(o.settlementBars)??3,0,6)):0,
      cashLagBars:Math.round(clamp(num(o.cashLagBars)??0,0,5)),
      limitPct:vn?(num(o.limitPct)!==null?clamp(num(o.limitPct),0,50):undefined):0,
      maxVolumePct:vn?clamp(num(o.maxVolumePct)??10,0,100):0,
      startKey:o.startKey||o.testStartDate||null,endKey:o.endKey||o.testEndDate||null,autoStart:!!o.autoStart,
      dividendTaxPct:clamp(num(o.dividendTaxPct)??5,0,30)
    };
    // Chọn chiến lược: o.strategies (nhiều công cụ) hoặc o.strategy (một công cụ; sma/breakout giữ đường chạy cũ).
    var known=(W.NHIPStrategies&&W.NHIPStrategies.BY)||{},ids=[];
    if(Array.isArray(o.strategies))o.strategies.forEach(function(id){id=String(id);if(known[id]&&ids.indexOf(id)<0&&ids.length<8)ids.push(id);});
    if(!ids.length)ids=[o.strategy&&known[o.strategy]?String(o.strategy):(o.strategy==='breakout'?'breakout':'sma')];
    cfg.strategies=ids;cfg.strategy=ids.length>1?'combo':ids[0];
    cfg.legacy=ids.length===1&&(ids[0]==='sma'||ids[0]==='breakout');
    cfg.combine=(o.combine==='any'||o.combine==='vote')?o.combine:'all';cfg.minVotes=num(o.minVotes);
    cfg.stratParams=(o.stratParams&&typeof o.stratParams==='object')?o.stratParams:{};
    if(cfg.strategy==='sma'&&cfg.smaFast>=cfg.smaSlow){cfg.smaFast=20;cfg.smaSlow=50;}
    if(single){
      cfg.maxPositions=1;cfg.maxPositionPct=100;cfg.riskPerTradePct=0;cfg.stopLossPct=0;cfg.takeProfitPct=0;cfg.maxPortfolioRiskPct=100;cfg.maxDrawdownStopPct=0;
    }else{
      cfg.maxPositions=Math.round(clamp(num(o.maxPositions)??5,1,20));cfg.maxPositionPct=clamp(num(o.maxPositionPct)??20,5,100);
      cfg.riskPerTradePct=clamp(num(o.riskPerTradePct)??1,0.1,5);cfg.stopLossPct=clamp(num(o.stopLossPct)??5,0.5,30);
      cfg.takeProfitPct=clamp(num(o.takeProfitPct)??10,0,100);cfg.maxPortfolioRiskPct=clamp(num(o.maxPortfolioRiskPct)??10,1,30);
      cfg.maxDrawdownStopPct=clamp(num(o.maxDrawdownStopPct)??15,0,50);
    }
    return cfg;
  }
  function warmOf(cfg){
    if(!cfg.legacy&&W.NHIPStrategies)return Math.max(W.NHIPStrategies.warm(cfg),10);
    return cfg.strategy==='breakout'?cfg.breakoutLookback+1:cfg.smaSlow+2;
  }
  /* mô tả tham số hiệu lực để hiển thị: cũ giữ nguyên dạng; mới là {id:{tham số}} */
  function paramsOf(cfg){
    if(cfg.legacy)return cfg.strategy==='breakout'?{breakoutLookback:cfg.breakoutLookback}:{smaFast:cfg.smaFast,smaSlow:cfg.smaSlow};
    var o={};if(W.NHIPStrategies)W.NHIPStrategies.describe(cfg).forEach(function(d){o[d.id]=d.params;});return o;
  }
  function labelOf(cfg){return W.NHIPStrategies?W.NHIPStrategies.label(cfg.strategies,cfg.combine,cfg.minVotes):cfg.strategy;}

  /* ---------- tín hiệu (mỗi phần tử i chỉ dùng dữ liệu ≤ i) ---------- */
  function computeSignals(c,cfg){
    var n=c.length,buy=new Array(n).fill(false),sell=new Array(n).fill(false);
    if(!cfg.legacy&&W.NHIPStrategies){var cs=W.NHIPStrategies.compose(c,cfg);return {buy:cs.buy,sell:cs.sell};}
    if(cfg.strategy==='breakout'){
      var L=cfg.breakoutLookback;
      for(var i=L;i<n;i++){var hi=-Infinity,lo=Infinity;for(var j=i-L;j<i;j++){if(c[j].high>hi)hi=c[j].high;if(c[j].low<lo)lo=c[j].low;}buy[i]=c[i].close>hi;sell[i]=c[i].close<lo;}
    }else{
      // Tổng theo số nguyên (giá×1e4) và so sánh nhân chéo: tránh sai số dấu phẩy động khi hai đường SMA đúng bằng nhau (rất hay gặp với giá theo bước giá).
      var pre=new Array(n+1).fill(0);for(var k=0;k<n;k++)pre[k+1]=pre[k]+Math.round(c[k].close*1e4);
      var sm=function(p,i){return i+1<p?null:pre[i+1]-pre[i+1-p];};
      var F=cfg.smaFast,L2=cfg.smaSlow;
      for(var m=1;m<n;m++){
        var f=sm(F,m),s2=sm(L2,m),pf=sm(F,m-1),ps=sm(L2,m-1);
        if(f===null||s2===null||pf===null||ps===null)continue;
        var cur=f*L2-s2*F,prv=pf*L2-ps*F; // dấu của (SMA nhanh − SMA chậm)
        buy[m]=prv<=0&&cur>0;sell[m]=prv>=0&&cur<0;
      }
    }
    return {buy:buy,sell:sell};
  }

  /* ---------- chuẩn bị dữ liệu từng mã ---------- */
  function prepAsset(item,cfg){
    var raw=Array.isArray(item&&item.candles)?item.candles:[];
    var q=W.NHIPDataQuality?W.NHIPDataQuality.inspect(raw):null;
    if(q&&(q.duplicateTimes||q.outOfOrder))return {error:'Nến trùng thời gian hoặc sai thứ tự',quality:q};
    var c=[];
    raw.forEach(function(x,i){
      var o=num(x.open),h=num(x.high),l=num(x.low),cl=num(x.close);
      if(o===null||h===null||l===null||cl===null||!(h>=l)||!(o>0)||!(cl>0))return;
      var t=x.timestamp!==undefined&&x.timestamp!==null?x.timestamp:(x.time!==undefined&&x.time!==null?x.time:x.date);
      c.push({open:o,high:h,low:l,close:cl,volume:num(x.volume),time:t,key:timeKey(t,i),srcIndex:i});
    });
    var warm=warmOf(cfg);
    if(c.length<Math.max(80,warm+20))return {error:'Không đủ nến hợp lệ',quality:q};
    var symbol=String(item.symbol||'');
    var ex=exchangeOf(symbol,item.exchange);
    var unit=median(c.map(function(x){return x.close;}))<1000?1000:1;
    var limit=cfg.limitPct===undefined?LIMITS[ex]:cfg.limitPct;
    for(var i=0;i<c.length;i++){
      var b=c[i];b.ceil=null;b.floor=null;b.tick=cfg.vnRules?tickOf(ex,b.close,unit):0;
      if(cfg.vnRules&&limit>0&&i>0){
        var ref=c[i-1].close,t=tickOf(ex,ref,unit);
        b.ceil=floorTick(ref*(1+limit/100),t);b.floor=ceilTick(ref*(1-limit/100),t);
      }
      var eps=(b.tick||0)/2+1e-9;
      b.lockedUp=b.ceil!==null&&(b.high-b.low)<=eps&&b.high>=b.ceil-eps;
      b.lockedDown=b.floor!==null&&(b.high-b.low)<=eps&&b.low<=b.floor+eps;
    }
    var sig=computeSignals(c,cfg);
    // thanh khoản trung bình 20 phiên tính đến hết nến i (dùng cho nến i+1)
    var adv=new Array(c.length).fill(null),sumV=0,cntV=0;
    for(var k=0;k<c.length;k++){
      sumV+=c[k].volume||0;if(c[k].volume!==null)cntV++;
      if(k>=20){sumV-=c[k-20].volume||0;if(c[k-20].volume!==null)cntV--;}
      if(k>=19&&cntV>=15&&sumV>0)adv[k]=sumV/Math.min(20,k+1);
    }
    var divs=(Array.isArray(item.dividends)?item.dividends:[]).map(function(d){return {key:timeKey(d.date||d.exDate||d.time,0),cash:num(d.cashPerShare)||0,ratio:num(d.stockRatio)||0};}).filter(function(d){return d.key&&d.key[0]!=='I'&&(d.cash>0||d.ratio>0);});
    return {symbol:symbol,exchange:ex,unit:unit,limitPct:limit,candles:c,buySig:sig.buy,sellSig:sig.sell,adv:adv,dividends:divs,warm:warm,quality:q};
  }

  /* ---------- engine ---------- */
  function simulate(input,cfg){
    var rejected=[],assets=[];
    (Array.isArray(input)?input:[]).forEach(function(it){
      var a=prepAsset(it,cfg);
      if(a.error){rejected.push({symbol:it&&it.symbol,reason:a.error});return;}
      var c=a.candles,split;
      if(cfg.startKey){split=c.findIndex(function(x){return x.key>=cfg.startKey;});if(split<0)split=c.length;}
      else if(cfg.autoStart)split=a.warm;
      else split=Math.floor(c.length*cfg.trainPct/100);
      var inWindow=c.filter(function(x,i){return i>=split&&(!cfg.endKey||x.key<=cfg.endKey);}).length;
      if(split<a.warm||inWindow<20){rejected.push({symbol:it&&it.symbol,reason:'Không đủ nến khởi động hoặc dưới 20 phiên trong cửa sổ kiểm thử'});return;}
      a.split=split;a.pos=null;a.pendingBuy=false;a.pendingSell=false;a.lastClose=null;assets.push(a);
    });
    if(!assets.length)return {ready:false,reason:'Không có mã nào đủ dữ liệu hợp lệ.',rejected:rejected};
    var commonStart=assets.reduce(function(m,a){return a.candles[a.split].key>m?a.candles[a.split].key:m;},'0000-00-00');
    assets.forEach(function(a){
      var s=a.candles.findIndex(function(x,i){return i>=a.split&&x.key>=commonStart;});a.start=s<0?a.candles.length:s;
      for(var i=Math.max(0,a.start-1);i<a.start;i++)a.lastClose=a.candles[i].close; // giá đóng phiên trước ngày bắt đầu
    });
    var events=new Map();
    assets.forEach(function(a){for(var i=a.start;i<a.candles.length;i++){var c=a.candles[i];if(cfg.endKey&&c.key>cfg.endKey)break;if(!events.has(c.key))events.set(c.key,[]);events.get(c.key).push({a:a,i:i,c:c});}});
    var dates=Array.from(events.keys()).sort();
    if(dates.length<20)return {ready:false,reason:'Khoảng thời gian chung ngoài mẫu dưới 20 phiên.',rejected:rejected};

    var fee=cfg.feePct/100,slip=cfg.slippagePct/100,tax=cfg.sellTaxPct/100,lot=cfg.lotSize;
    var initial=cfg.initialCapital,cash=initial,unsettled=[],positions=0,trades=[],curve=[];
    var peak=initial,maxDD=0,halted=false,haltDate=null,maxOpenRiskPct=0,minCash=initial,maxConcurrent=0,dividendsTotal=0;
    var skipped={noCash:0,lotZero:0,riskCap:0,volumeCap:0,noSlot:0,lockedLimit:0,halted:0,tLocked:0};
    var stopPct=cfg.stopLossPct/100,tpPct=cfg.takeProfitPct/100,allocPct=cfg.maxPositionPct/100,riskPct=cfg.riskPerTradePct/100,portRisk=cfg.maxPortfolioRiskPct/100;
    var singleAllIn=cfg.mode==='single';

    function unsettledSum(){var s=0;for(var k=0;k<unsettled.length;k++)s+=unsettled[k].amt;return s;}
    function openRisk(){var s=0;assets.forEach(function(a){if(a.pos&&a.pos.stop!==null)s+=Math.max(0,a.pos.price-a.pos.stop)*a.pos.units*a.unit;});return s;}
    function refEquity(){var s=cash+unsettledSum();assets.forEach(function(a){if(a.pos)s+=a.pos.units*a.unit*(a.lastClose!==null?a.lastClose:a.pos.price);});return s;}
    function sellFill(a,raw,b){var f=raw*(1-slip);if(cfg.vnRules){f=floorTick(f,b.tick);if(b.floor!==null&&f<b.floor)f=b.floor;if(b.ceil!==null&&f>b.ceil)f=b.ceil;}return f;}
    function closePos(a,i,b,fill,reason,forced,dayIdx,day){
      var p=a.pos,gross=p.units*fill*a.unit,feeAmt=gross*fee,taxAmt=gross*tax,proceeds=gross-feeAmt-taxAmt;
      if(cfg.cashLagBars>0&&!forced)unsettled.push({due:dayIdx+cfg.cashLagBars,amt:proceeds});else cash+=proceeds;
      var pnl=proceeds-p.cost;
      trades.push({symbol:a.symbol,entryDate:p.date,exitDate:day,entryIndex:p.srcIndex,exitIndex:b.srcIndex,entryTime:dateText(p.time,p.srcIndex),exitTime:dateText(b.time,b.srcIndex),
        entryPrice:p.price,exitPrice:fill,units:p.units,unit:a.unit,cost:p.cost,proceeds:proceeds,pnl:pnl,returnPct:(proceeds/p.cost-1)*100,bars:i-p.index,
        exitReason:reason,forced:!!forced,feePaid:p.buyFee+feeAmt,taxPaid:taxAmt,equityAtEntry:p.equityAtEntry,pnlPctEquity:p.equityAtEntry>0?pnl/p.equityAtEntry:0,sellableIndex:p.index+cfg.settlementBars,candleIndex:i,entryCandleIndex:p.index});
      a.pos=null;a.pendingSell=false;positions--;
    }

    dates.forEach(function(day,dayIdx){
      var today=events.get(day).slice().sort(function(x,y){return x.a.symbol<y.a.symbol?-1:x.a.symbol>y.a.symbol?1:0;});
      // 1) tiền bán chờ về tài khoản
      if(unsettled.length){var keep=[];unsettled.forEach(function(u){if(u.due<=dayIdx)cash+=u.amt;else keep.push(u);});unsettled=keep;}
      // 2) cổ tức (chỉ khi người dùng cung cấp)
      today.forEach(function(e){var p=e.a.pos;if(!p)return;e.a.dividends.forEach(function(d){if(d.key!==day)return;
        if(d.cash>0){var amt=p.units*d.cash*e.a.unit*(1-cfg.dividendTaxPct/100);cash+=amt;dividendsTotal+=amt;}
        if(d.ratio>0){var add=Math.floor(p.units*d.ratio/lot)*lot;if(!cfg.vnRules)add=p.units*d.ratio;p.units+=add;}
      });});
      // 3) lệnh bán đã đặt từ phiên trước (mở cửa), chỉ khi đã về cổ phiếu và không bị khóa sàn
      today.forEach(function(e){var a=e.a;if(!a.pos||!a.pendingSell)return;
        if(e.i-a.pos.index<cfg.settlementBars){skipped.tLocked++;return;}
        if(e.c.lockedDown){skipped.lockedLimit++;return;}
        closePos(a,e.i,e.c,sellFill(a,e.c.open,e.c),'Tín hiệu chiến lược',false,dayIdx,day);
      });
      // 4) lệnh mua đã đặt từ phiên trước; cỡ lệnh dựa trên giá đóng phiên trước
      var buys=today.filter(function(e){return e.a.pendingBuy&&!e.a.pos;});
      buys.sort(function(x,y){var lx=x.a.adv[x.i-1]||0,ly=y.a.adv[y.i-1]||0;return ly-lx||(x.a.symbol<y.a.symbol?-1:1);});
      buys.forEach(function(e){
        var a=e.a,b=e.c;
        if(halted){skipped.halted++;return;}
        if(positions>=cfg.maxPositions){skipped.noSlot++;return;}
        if(b.lockedUp){skipped.lockedLimit++;return;}
        var fill=b.open*(1+slip);if(cfg.vnRules){fill=ceilTick(fill,b.tick);if(b.ceil!==null&&fill>b.ceil)fill=b.ceil;if(b.floor!==null&&fill<b.floor)fill=b.floor;}
        var eq=refEquity(),unitCost=fill*a.unit*(1+fee);
        var riskUnits=Infinity;if(!singleAllIn&&stopPct>0){var remain=Math.max(0,eq*portRisk-openRisk());riskUnits=Math.min(eq*riskPct,remain)/(fill*a.unit*stopPct);}
        var capUnits=eq*allocPct/unitCost,cashUnits=cash/unitCost;
        var advV=a.adv[e.i-1],volUnits=cfg.maxVolumePct>0&&advV?advV*cfg.maxVolumePct/100:Infinity;
        var units=Math.min(riskUnits,capUnits,cashUnits,volUnits);
        if(cfg.vnRules)units=Math.floor(units/lot+1e-9)*lot;
        if(!(units>0)){var m=Math.min(riskUnits,capUnits,cashUnits,volUnits);if(m===cashUnits)skipped.noCash++;else if(m===volUnits)skipped.volumeCap++;else if(m===riskUnits)skipped.riskCap++;else skipped.lotZero++;if(cfg.vnRules&&m>0)skipped.lotZero++;return;}
        var cost=units*unitCost;if(cost>cash+1e-6)return;
        cash-=cost;if(cash<minCash)minCash=cash;
        a.pos={units:units,price:fill,cost:cost,buyFee:units*fill*a.unit*fee,date:day,index:e.i,srcIndex:b.srcIndex,time:b.time,
          stop:stopPct>0?(cfg.vnRules?ceilTick(fill*(1-stopPct),b.tick):fill*(1-stopPct)):null,
          target:tpPct>0?(cfg.vnRules?floorTick(fill*(1+tpPct),b.tick):fill*(1+tpPct)):null,equityAtEntry:eq,costPctEquity:eq>0?cost/eq*100:0};
        a.pendingBuy=false;positions++;if(positions>maxConcurrent)maxConcurrent=positions;
      });
      // 5) thoát lệnh bảo vệ trong phiên (dừng lỗ ưu tiên nếu cả hai chạm vì nến ngày không cho biết thứ tự)
      today.forEach(function(e){var a=e.a,p=a.pos;if(!p||p.index===e.i)return;
        if(e.i-p.index<cfg.settlementBars)return;
        var raw=null,reason='';
        if(p.stop!==null&&e.c.low<=p.stop){raw=e.c.open<=p.stop?e.c.open:p.stop;reason='Dừng lỗ';}
        else if(p.target!==null&&e.c.high>=p.target){raw=e.c.open>=p.target?e.c.open:p.target;reason='Chốt lời';}
        if(raw===null)return;
        if(e.c.lockedDown){skipped.lockedLimit++;return;}
        var f=raw;if(reason==='Dừng lỗ'){f=sellFill(a,raw,e.c);}else{f=sellFill(a,raw,e.c);}
        closePos(a,e.i,e.c,f,reason,false,dayIdx,day);
      });
      // 6) định giá cuối phiên + tạo tín hiệu cho phiên sau
      var value=cash+unsettledSum();
      assets.forEach(function(a){
        var e=today.find(function(x){return x.a===a;});
        if(e){a.lastClose=e.c.close;
          a.pendingBuy=false;
          if(a.pos&&a.sellSig[e.i])a.pendingSell=true;
          else if(!a.pos&&a.buySig[e.i])a.pendingBuy=true;
        }
        if(a.pos&&a.lastClose!==null){value+=a.pos.units*a.unit*a.lastClose*(1-slip)*(1-fee-tax);}
      });
      var orisk=openRisk();if(value>0&&orisk/value*100>maxOpenRiskPct)maxOpenRiskPct=orisk/value*100;
      curve.push({date:day,value:value,cash:cash+unsettledSum(),positions:positions,openRisk:orisk});
      if(value>peak)peak=value;var dd=peak>0?(peak-value)/peak*100:0;if(dd>maxDD)maxDD=dd;
      if(!halted&&cfg.maxDrawdownStopPct>0&&dd>=cfg.maxDrawdownStopPct){halted=true;haltDate=day;}
    });
    // 7) đóng toàn bộ vị thế còn lại ở nến cuối của kỳ
    var lastDate=dates[dates.length-1];
    assets.forEach(function(a){
      if(!a.pos)return;var last=null,idx=-1;
      for(var i=a.start;i<a.candles.length;i++){if(a.candles[i].key<=lastDate){last=a.candles[i];idx=i;}else break;}
      if(!last)return;
      closePos(a,idx,last,sellFill(a,last.close,last),'Đóng cuối kỳ',true,dates.length,lastDate);
    });
    var finalValue=cash+unsettledSum();
    if(curve.length)curve[curve.length-1].value=finalValue;
    var sim={ready:true,cfg:cfg,assets:assets,rejected:rejected,dates:dates,trades:trades,curve:curve,initial:initial,finalValue:finalValue,commonStart:commonStart,commonEnd:lastDate,
      halted:halted,haltDate:haltDate,maxDD:maxDD,maxOpenRiskPct:maxOpenRiskPct,minCash:minCash,maxConcurrent:maxConcurrent,dividendsTotal:dividendsTotal,skipped:skipped};
    sim.verification=verify(sim);
    return sim;
  }

  /* ---------- kiểm chứng độc lập từng lệnh với dữ liệu nến ---------- */
  function verify(sim){
    var cfg=sim.cfg,bySym=new Map();sim.assets.forEach(function(a){bySym.set(a.symbol,a);});
    var v={lotViolations:0,tickViolations:0,settlementViolations:0,limitViolations:0,priceOutOfRange:0,exposureBreaches:0,orderViolations:0,badNumbers:0,checked:sim.trades.length};
    var byIdx=function(a){var m=new Map();a.candles.forEach(function(c,i){m.set(c.srcIndex,i);});return m;};
    var maps=new Map();
    sim.trades.forEach(function(t){
      var a=bySym.get(t.symbol);if(!a)return;
      if(!maps.has(a.symbol))maps.set(a.symbol,byIdx(a));
      var mp=maps.get(a.symbol),ei=mp.get(t.entryIndex),xi=mp.get(t.exitIndex);
      if(![t.units,t.entryPrice,t.exitPrice,t.cost,t.proceeds,t.pnl].every(Number.isFinite)||t.units<=0||t.entryPrice<=0||t.exitPrice<=0)v.badNumbers++;
      if(ei===undefined||xi===undefined||xi<ei||(xi===ei&&!t.forced))v.orderViolations++; // v1.62: đóng cưỡng bức cuối kỳ ngay trong nến vừa mua (mở→đóng) hợp lệ
      if(cfg.vnRules){
        if(Math.abs(t.units/cfg.lotSize-Math.round(t.units/cfg.lotSize))>1e-9)v.lotViolations++;
        var eb=a.candles[ei],xb=a.candles[xi];
        if(eb&&xb){
          var te=eb.tick,tx=xb.tick;
          if(te&&Math.abs(t.entryPrice/te-Math.round(t.entryPrice/te))>1e-6)v.tickViolations++;
          if(tx&&Math.abs(t.exitPrice/tx-Math.round(t.exitPrice/tx))>1e-6)v.tickViolations++;
          if(eb.ceil!==null&&t.entryPrice>eb.ceil+1e-9)v.limitViolations++;
          if(eb.floor!==null&&t.entryPrice<eb.floor-1e-9)v.limitViolations++;
          if(xb.ceil!==null&&t.exitPrice>xb.ceil+1e-9)v.limitViolations++;
          if(xb.floor!==null&&t.exitPrice<xb.floor-1e-9)v.limitViolations++;
          if(t.entryPrice<eb.low*(1-cfg.slippagePct/100)-eb.tick||t.entryPrice>Math.max(eb.high,eb.open*(1+cfg.slippagePct/100))+eb.tick)v.priceOutOfRange++;
        }
        if(!t.forced&&xi-ei<cfg.settlementBars)v.settlementViolations++;
      }
      if(t.entryCandleIndex!==undefined&&Number.isFinite(t.costPctEquity)&&t.costPctEquity>cfg.maxPositionPct+0.5)v.exposureBreaches++;
    });
    var sumPnl=sim.trades.reduce(function(s,t){return s+t.pnl;},0);
    v.sumPnl=sumPnl;v.dividends=sim.dividendsTotal;
    v.accountingResidual=sim.finalValue-(sim.initial+sumPnl+sim.dividendsTotal);
    v.accountingOk=Math.abs(v.accountingResidual)<=Math.max(1e-6,Math.abs(sim.initial)*1e-9);
    v.negativeCash=sim.minCash<-1e-6;
    v.maxConcurrent=sim.maxConcurrent;v.positionCapOk=sim.maxConcurrent<=cfg.maxPositions;
    v.ok=v.accountingOk&&!v.negativeCash&&v.positionCapOk&&!v.lotViolations&&!v.tickViolations&&!v.settlementViolations&&!v.limitViolations&&!v.orderViolations&&!v.badNumbers&&!v.exposureBreaches;
    return v;
  }

  /* ---------- chỉ số hiệu suất ---------- */
  function ratios(curve,initial){
    var rets=[],prior=initial,peak=initial,underwater=0,maxUnderwater=0,currentDD=0,longestRecovery=0,worst=null,best=null,monthly=new Map();
    curve.forEach(function(pt){
      var r=prior>0?(pt.value/prior-1)*100:0;rets.push(r);
      if(!worst||r<worst.returnPct)worst={date:pt.date,returnPct:r};if(!best||r>best.returnPct)best={date:pt.date,returnPct:r};
      var mo=String(pt.date).slice(0,7);if(!monthly.has(mo))monthly.set(mo,{month:mo,startValue:prior,endValue:pt.value,returnPct:0});monthly.get(mo).endValue=pt.value;
      prior=pt.value;
      if(pt.value>=peak){peak=pt.value;currentDD=0;if(underwater){longestRecovery=Math.max(longestRecovery,underwater);underwater=0;}}
      else{underwater++;if(underwater>maxUnderwater)maxUnderwater=underwater;currentDD=(peak-pt.value)/peak*100;}
    });
    var n=rets.length,mean=n?rets.reduce(function(a,b){return a+b;},0)/n:0;
    var variance=n?rets.reduce(function(a,b){return a+(b-mean)*(b-mean);},0)/n:0,vol=Math.sqrt(variance);
    var down=n?Math.sqrt(rets.reduce(function(a,b){return a+(b<0?b*b:0);},0)/n):0;
    return {rets:rets,mean:mean,vol:vol,sharpe:vol?mean/vol*Math.sqrt(252):null,sortino:down?mean/down*Math.sqrt(252):null,annVol:vol*Math.sqrt(252),
      worst:worst,best:best,currentDD:currentDD,maxUnderwater:maxUnderwater,longestRecovery:longestRecovery,
      monthly:Array.from(monthly.values()).map(function(m){return Object.assign({},m,{returnPct:m.startValue>0?(m.endValue/m.startValue-1)*100:0});})};
  }
  function tradeStats(trades){
    var rets=trades.map(function(t){return t.returnPct;}),wins=rets.filter(function(x){return x>0;}),losses=rets.filter(function(x){return x<0;});
    var gw=wins.reduce(function(a,b){return a+b;},0),gl=-losses.reduce(function(a,b){return a+b;},0);
    var streak=0,maxStreak=0;trades.forEach(function(t){if(t.pnl<0){streak++;if(streak>maxStreak)maxStreak=streak;}else if(t.pnl>0)streak=0;});
    return {n:trades.length,wins:wins.length,losses:losses.length,winRatePct:trades.length?wins.length/trades.length*100:null,
      avgTradePct:rets.length?rets.reduce(function(a,b){return a+b;},0)/rets.length:null,avgWinPct:wins.length?gw/wins.length:null,avgLossPct:losses.length?-gl/losses.length:null,
      profitFactor:gl?gw/gl:(gw?null:0),maxConsecutiveLosses:maxStreak,grossWin:gw,grossLoss:gl};
  }

  /* ---------- Monte Carlo (có seed, tái lập được) ---------- */
  function rng(seed){var a=(seed>>>0)||1;return function(){a=(a+0x6D2B79F5)>>>0;var t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
  function pct(sorted,p){if(!sorted.length)return null;var k=(sorted.length-1)*p,f=Math.floor(k),c=Math.ceil(k);return sorted[f]+(sorted[c]-sorted[f])*(k-f);}
  function dist(a){var s=a.slice().sort(function(x,y){return x-y;});return {p5:pct(s,.05),p25:pct(s,.25),p50:pct(s,.5),p75:pct(s,.75),p95:pct(s,.95)};}
  function monteCarlo(result,config){
    config=config||{};
    var trades=(result&&result.tradeLog)||[],curve=(result&&result.equityCurve)||[];
    var runs=Math.round(clamp(num(config.runs)??2000,200,20000)),seed=num(config.seed)??20260101,block=Math.round(clamp(num(config.block)??5,1,30));
    if(!result||!result.ready||trades.length<5)return {ready:false,reason:'Cần ít nhất 5 giao dịch đóng để chạy Monte Carlo.',trades:trades.length};
    var rand=rng(seed),initial=result.initialCapital||1;
    var tr=trades.map(function(t){return Number.isFinite(t.pnlPctEquity)?t.pnlPctEquity:(t.returnPct||0)/100;});
    var fin=[],dds=[],meanR=[],lossRuns=0,dd20=0;
    for(var r=0;r<runs;r++){
      var eq=1,pk=1,mdd=0,sum=0;
      for(var k=0;k<tr.length;k++){var x=tr[Math.floor(rand()*tr.length)];sum+=x;eq*=1+x;if(eq>pk)pk=eq;var d=(pk-eq)/pk;if(d>mdd)mdd=d;}
      fin.push((eq-1)*100);dds.push(mdd*100);meanR.push(sum/tr.length*100);if(eq<1)lossRuns++;if(mdd>=0.2)dd20++;
    }
    var out={ready:true,runs:runs,seed:seed,trades:tr.length,
      tradeBootstrap:{returnPct:dist(fin),maxDrawdownPct:dist(dds),probLossPct:lossRuns/runs*100,probDrawdown20Pct:dd20/runs*100},
      expectancyCI:{meanPctOfEquityPerTrade:dist(meanR),probPositivePct:meanR.filter(function(x){return x>0;}).length/runs*100}};
    if(curve.length>=30){
      var dr=[];for(var i=0;i<curve.length;i++){var pv=i?curve[i-1].value:initial;dr.push(pv>0?curve[i].value/pv-1:0);}
      var f2=[],d2=[],l2=0,q20=0;
      for(var r2=0;r2<runs;r2++){
        var e2=1,p2=1,m2=0,cnt=0;
        while(cnt<dr.length){var st=Math.floor(rand()*dr.length);for(var b=0;b<block&&cnt<dr.length;b++,cnt++){e2*=1+dr[(st+b)%dr.length];if(e2>p2)p2=e2;var dd=(p2-e2)/p2;if(dd>m2)m2=dd;}}
        f2.push((e2-1)*100);d2.push(m2*100);if(e2<1)l2++;if(m2>=0.2)q20++;
      }
      out.dailyBlockBootstrap={blockDays:block,returnPct:dist(f2),maxDrawdownPct:dist(d2),probLossPct:l2/runs*100,probDrawdown20Pct:q20/runs*100};
    }
    out.note='Monte Carlo xáo trộn các giao dịch/phiên đã có trong mẫu (giả định gần độc lập và cùng phân phối). Nó đo độ nhạy với thứ tự và may rủi trong CHÍNH mẫu này, không dự báo tương lai và không thay thế kiểm thử ngoài mẫu.';
    return out;
  }

  /* ---------- thử rò rỉ dữ liệu tương lai ---------- */
  // Cắt dữ liệu tại nhiều mốc và/hoặc thay phần tương lai bằng dữ liệu rác; đường vốn trước mốc phải giữ nguyên.
  function leakProbe(input,optsFn,cutFractions){
    var base=optsFn();var full=simulate(input,base);
    if(!full.ready)return {ready:false,reason:full.reason};
    var res={ready:true,cuts:[],ok:true};
    (cutFractions||[0.5,0.75]).forEach(function(fr){
      var cutIdx=Math.floor(full.dates.length*fr),cutKey=full.dates[cutIdx];
      var garbage=input.map(function(it,si){return Object.assign({},it,{candles:(it.candles||[]).map(function(c,i){
        var key=timeKey(c.timestamp!==undefined?c.timestamp:(c.time!==undefined?c.time:c.date),i);
        if(key<=cutKey)return c;var m=1+((si*7+i*13)%17)/10;return Object.assign({},c,{open:c.open*m,high:c.high*m*1.2,low:c.low*m*0.8,close:c.close*m*0.9,volume:(c.volume||0)*5});
      })});});
      var o2=optsFn();o2.endKey=cutKey;var cutRun=simulate(input,o2),junk=simulate(garbage,optsFn());
      var cmp=function(a,b){var n=0,bad=0;if(!a.ready||!b.ready)return {n:0,bad:1};
        var A=a.curve.filter(function(p){return p.date<cutKey;}),B=b.curve.filter(function(p){return p.date<cutKey;});
        if(A.length!==B.length)return {n:A.length,bad:Math.abs(A.length-B.length)+1};
        for(var i=0;i<A.length;i++){n++;if(Math.abs(A[i].value-B[i].value)>1e-6*Math.max(1,Math.abs(A[i].value)))bad++;}
        var TA=a.trades.filter(function(t){return !t.forced&&t.exitDate<cutKey;}).length,TB=b.trades.filter(function(t){return !t.forced&&t.exitDate<cutKey;}).length;if(TA!==TB)bad++;
        return {n:n,bad:bad};};
      var c1=cmp(full,cutRun),c2=cmp(full,junk);
      res.cuts.push({fraction:fr,cutDate:cutKey,truncated:c1,corruptedFuture:c2});
      if(c1.bad||c2.bad)res.ok=false;
    });
    return res;
  }

  /* ---------- tối ưu tham số trong mẫu (dùng cho walk-forward) ---------- */
  function paramGrid(strategy){
    if(strategy!=='breakout'&&strategy!=='sma'&&W.NHIPStrategies&&W.NHIPStrategies.BY[strategy])return W.NHIPStrategies.grid(strategy);
    if(strategy==='breakout')return [{breakoutLookback:10},{breakoutLookback:20},{breakoutLookback:40}];
    return [{smaFast:10,smaSlow:30},{smaFast:20,smaSlow:50},{smaFast:30,smaSlow:100}];
  }
  function optimize(input,opts,trainEndKey,minTrades){
    minTrades=minTrades||5;var base=normOpts(opts,'portfolio');
    if(base.strategies.length>1)return {best:null,tried:0,eligible:0,fixed:true};
    var grid=paramGrid(base.strategies[0]),best=null,tried=0,ok=0;
    grid.forEach(function(g){
      var cfg=normOpts(Object.assign({},opts,g,{startKey:null,testStartDate:null,autoStart:true,endKey:trainEndKey,testEndDate:null}),'portfolio');
      var s=simulate(input,cfg);tried++;
      if(!s.ready)return;
      var net=(s.finalValue/s.initial-1)*100;if(s.trades.length<minTrades)return;ok++;
      var score=net-0.5*s.maxDD;
      if(!best||score>best.score)best={params:g,score:score,trainReturnPct:net,trainDrawdownPct:s.maxDD,trainTrades:s.trades.length};
    });
    return {best:best,tried:tried,eligible:ok};
  }

  function canOptimize(opts){return normOpts(opts||{},'portfolio').strategies.length===1;}
  W.NHIPSim={version:'2.1',paramsOf:paramsOf,labelOf:labelOf,canOptimize:canOptimize,num:num,clamp:clamp,timeKey:timeKey,dateText:dateText,normOpts:normOpts,warmOf:warmOf,exchangeOf:exchangeOf,LIMITS:LIMITS,tickVND:tickVND,tickOf:tickOf,ceilTick:ceilTick,floorTick:floorTick,
    computeSignals:computeSignals,simulate:simulate,verify:verify,ratios:ratios,tradeStats:tradeStats,monteCarlo:monteCarlo,leakProbe:leakProbe,optimize:optimize,paramGrid:paramGrid,rng:rng};
})();
