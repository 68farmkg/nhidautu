/* NHIP Backtest v3 — backtest đơn mã, chạy trên lõi NHIPSim (cùng engine với mô phỏng danh mục).
   Long-only. Tín hiệu ở nến đã đóng, khớp giá mở nến kế tiếp. Có luật VN: lô 100, bước giá, biên độ, thuế bán, khóa bán T+2.
   Giữ nguyên API cũ: NHIPBacktest.run(candles, opts) và toCSV(result). Vốn được chuẩn hóa về 1 để tương thích giao diện. */
(function(){'use strict';
  var S=window.NHIPSim;
  var num=S.num;
  function run(input,opts){
    opts=opts||{};
    var cfg=S.normOpts(opts,'single');
    var raw=Array.isArray(input)?input:[];
    var quality=window.NHIPDataQuality?window.NHIPDataQuality.inspect(raw):null;
    if(quality&&(quality.duplicateTimes>0||quality.outOfOrder>0))return {ready:false,count:quality.valid,reason:'Dữ liệu nến có mốc thời gian trùng hoặc không theo thứ tự. Hãy tải lại/chuẩn hóa dữ liệu trước khi backtest.',dataQuality:quality};
    var sim=S.simulate([{symbol:String(opts.symbol||'MÃ'),exchange:opts.exchange,candles:raw,dividends:opts.dividends}],cfg);
    var need=Math.max(80,S.warmOf(cfg)+20);
    if(!sim.ready){
      var valid=raw.filter(function(x){return [x.open,x.high,x.low,x.close].every(function(v){return num(v)!==null;});}).length;
      return {ready:false,count:valid,reason:'Cần ít nhất '+need+' nến hợp lệ, trong đó phần ngoài mẫu có tối thiểu 20 nến. Hãy tải thêm lịch sử hoặc giảm tỷ lệ phần huấn luyện.',dataQuality:quality};
    }
    var a=sim.assets[0],c=a.candles,split=a.split,initial=sim.initial,trades=sim.trades;
    var ts=S.tradeStats(trades),rt=S.ratios(sim.curve,initial);
    var idxOf=new Map();c.forEach(function(x,i){idxOf.set(x.key,i);});
    var equity=sim.curve.map(function(p){var i=idxOf.get(p.date);return {index:i,time:S.dateText(c[i].time,i),value:p.value/initial,inPosition:p.positions>0};});
    var first=c[split],last=c[c.length-1],slip=cfg.slippagePct/100,fee=cfg.feePct/100,tax=cfg.sellTaxPct/100;
    var bhBuy=first.open*(1+slip),bhSell=last.close*(1-slip),buyHold=(bhSell*(1-fee-tax))/(bhBuy*(1+fee))*100-100;
    var days=(Date.parse(S.dateText(last.time,c.length-1))-Date.parse(S.dateText(first.time,split)))/86400000;
    var net=(sim.finalValue/initial-1)*100,years=Number.isFinite(days)&&days>0?days/365.25:null;
    var tl=trades.map(function(t){return Object.assign({},t,{entryPrice:t.entryPrice,exitPrice:t.exitPrice});});
    var inPos=equity.filter(function(x){return x.inPosition;}).length;
    return {ready:true,count:c.length,strategy:cfg.strategy,feePct:cfg.feePct,slippagePct:cfg.slippagePct,sellTaxPct:cfg.sellTaxPct,trainPct:cfg.trainPct,vnRules:cfg.vnRules,
      strategies:cfg.strategies,combine:cfg.strategies.length>1?cfg.combine:null,strategyLabel:S.labelOf(cfg),params:S.paramsOf(cfg),
      testStartIndex:split,testBars:c.length-split,trainBars:split,
      netReturnPct:net,cagrPct:years&&sim.finalValue>0?(Math.pow(sim.finalValue/initial,1/years)-1)*100:null,buyHoldPct:buyHold,maxDrawdownPct:sim.maxDD,
      sharpeRatio:rt.sharpe,sortinoRatio:rt.sortino,calmarRatio:sim.maxDD>0&&years?((Math.pow(Math.max(sim.finalValue,1e-9)/initial,1/years)-1)*100)/sim.maxDD:null,
      trades:ts.n,wins:ts.wins,losses:ts.losses,winRatePct:ts.winRatePct,avgTradePct:ts.avgTradePct,avgWinPct:ts.avgWinPct,avgLossPct:ts.avgLossPct,profitFactor:ts.profitFactor,expectancyPct:ts.avgTradePct,
      maxConsecutiveLosses:ts.maxConsecutiveLosses,exposurePct:equity.length?inPos/equity.length*100:0,finalEquity:sim.finalValue/initial,initialCapital:initial,
      tradeLog:tl,equityCurve:equity,periodDays:Number.isFinite(days)&&days>0?days:null,verification:sim.verification,diagnostics:sim.skipped,dataQuality:quality,
      note:'Kết quả ngoài mẫu theo thời gian: '+cfg.trainPct+'% nến đầu chỉ dùng làm dữ liệu khởi động chỉ báo; danh mục bắt đầu bằng tiền mặt tại nến '+split+'. Tín hiệu chỉ xác nhận sau khi nến đóng, lệnh khớp ở giá mở cửa nến kế tiếp.'+(cfg.vnRules?' Đã áp dụng: lô '+cfg.lotSize+' cổ, bước giá, biên độ giá theo sàn, phí '+cfg.feePct+'%/chiều, thuế bán '+cfg.sellTaxPct+'%, khóa bán đến phiên T+'+(cfg.settlementBars)+' theo nến ngày, không bán được khi khóa sàn. Chưa có: cổ tức/sự kiện doanh nghiệp (trừ khi cung cấp), khớp từng phần, ATO/ATC, margin.':' Chế độ tắt luật VN (chỉ để đối chiếu): không lô, không thuế, không T+.')};
  }
  function toCSV(result){
    if(!result||!result.ready)return '';
    var cols=['entryIndex','exitIndex','entryTime','exitTime','entryPrice','exitPrice','units','returnPct','pnl','bars','exitReason','forced'];
    var esc=function(v){var s=v===null||v===undefined?'':String(v);return /[",\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;};
    return [cols.join(',')].concat(result.tradeLog.map(function(t){return cols.map(function(k){return esc(typeof t[k]==='number'?Number(t[k].toFixed(6)):t[k]);}).join(',');})).join('\r\n');
  }
  window.NHIPBacktest={run:run,toCSV:toCSV};
})();
