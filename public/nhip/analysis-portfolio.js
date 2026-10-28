/* NHIP Portfolio v2 — mô phỏng danh mục vốn chung, kịch bản độ nhạy, walk-forward CÓ tối ưu lại tham số và nối vốn liên tục, Monte Carlo.
   Chạy trên lõi NHIPSim. Giữ API cũ: run, toCSV, equityToCSV, monthlyToCSV, compareScenarios, scenariosToCSV, walkForward, walkForwardToCSV. */
(function(){'use strict';
  var S=window.NHIPSim,n=S.num,clamp=S.clamp;
  function esc(v){var s=v==null?'':String(v);return /[",\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;}
  function csv(cols,rows,round){return [cols.join(',')].concat(rows.map(function(x){return cols.map(function(k){return esc(typeof x[k]==='number'?Number(x[k].toFixed(round||6)):x[k]);}).join(',');})).join('\r\n');}

  function correlations(sim){
    var pairs=[],A=sim.assets,from=sim.commonStart,to=sim.commonEnd,maps=A.map(function(a){var m=new Map();a.candles.forEach(function(c,i){if(i>0&&c.key>=from&&c.key<=to&&a.candles[i-1].close>0)m.set(c.key,c.close/a.candles[i-1].close-1);});return m;});
    for(var i=0;i<A.length;i++)for(var j=i+1;j<A.length;j++){
      var xs=[],ys=[];maps[i].forEach(function(v,k){if(maps[j].has(k)){xs.push(v);ys.push(maps[j].get(k));}});
      if(xs.length<20)continue;
      var mx=xs.reduce(function(a,b){return a+b;},0)/xs.length,my=ys.reduce(function(a,b){return a+b;},0)/ys.length,cov=0,vx=0,vy=0;
      for(var k=0;k<xs.length;k++){var dx=xs[k]-mx,dy=ys[k]-my;cov+=dx*dy;vx+=dx*dx;vy+=dy*dy;}
      var r=vx&&vy?cov/Math.sqrt(vx*vy):null;if(r!==null&&Number.isFinite(r))pairs.push({symbolA:A[i].symbol,symbolB:A[j].symbol,correlation:r,samples:xs.length});
    }
    pairs.sort(function(a,b){return b.correlation-a.correlation;});return pairs;
  }
  function benchmarkOf(sim,opts){
    if(!Array.isArray(opts.benchmarkCandles)||!opts.benchmarkCandles.length)return null;
    var bm=opts.benchmarkCandles.map(function(x,i){return {key:S.timeKey(x.timestamp!==undefined?x.timestamp:(x.time!==undefined?x.time:x.date),i),close:n(x.close)};}).filter(function(x){return x.close!==null&&x.close>0;}).sort(function(a,b){return a.key<b.key?-1:a.key>b.key?1:0;});
    var first=bm.find(function(x){return x.key>=sim.commonStart&&x.key<=sim.commonEnd;}),last=bm.filter(function(x){return x.key<=sim.commonEnd;}).slice(-1)[0];
    if(!first||!last)return null;
    var ret=(last.close/first.close-1)*100,port=(sim.finalValue/sim.initial-1)*100;
    return {symbol:opts.benchmarkSymbol||'VNINDEX',startDate:first.key,endDate:last.key,startClose:first.close,endClose:last.close,returnPct:ret,excessReturnPct:port-ret};
  }
  function run(input,opts){
    opts=opts||{};
    if(!Array.isArray(input)||input.length<2)return {ready:false,reason:'Cần ít nhất 2 mã để mô phỏng danh mục.'};
    var cfg=S.normOpts(opts,'portfolio'),sim=S.simulate(input,cfg);
    if(!sim.ready)return {ready:false,reason:sim.reason,rejected:sim.rejected};
    if(sim.assets.length<2)return {ready:false,reason:'Cần ít nhất 2 mã có dữ liệu hợp lệ; hãy tải thêm lịch sử hoặc giảm số mã.',rejected:sim.rejected};
    var trades=sim.trades,ts=S.tradeStats(trades),rt=S.ratios(sim.curve,sim.initial),pairs=correlations(sim),high=pairs.filter(function(x){return x.correlation>=0.7;});
    var cmap=new Map();trades.forEach(function(t){var z=cmap.get(t.symbol)||{symbol:t.symbol,trades:0,wins:0,losses:0,netPnl:0,avgReturnPct:0};z.trades++;if(t.pnl>0)z.wins++;if(t.pnl<0)z.losses++;z.netPnl+=t.pnl;z.avgReturnPct+=t.returnPct;cmap.set(t.symbol,z);});
    var contributions=Array.from(cmap.values()).map(function(z){return Object.assign({},z,{avgReturnPct:z.trades?z.avgReturnPct/z.trades:0});}).sort(function(a,b){return b.netPnl-a.netPnl;});
    var avgCorr=pairs.length?pairs.reduce(function(s,x){return s+x.correlation;},0)/pairs.length:null;
    var years=sim.dates.length/252,net=(sim.finalValue/sim.initial-1)*100;
    var cagr=years>0&&sim.finalValue>0?(Math.pow(sim.finalValue/sim.initial,1/years)-1)*100:null;
    var res={ready:true,initialCapital:sim.initial,finalEquity:sim.finalValue,netReturnPct:net,cagrPct:cagr,maxDrawdownPct:sim.maxDD,currentDrawdownPct:rt.currentDD,
      maxDrawdownDurationDays:rt.maxUnderwater,longestRecoveryDays:rt.longestRecovery,annualizedVolatilityPct:rt.annVol,sharpeRatio:rt.sharpe,sortinoRatio:rt.sortino,
      calmarRatio:cagr!==null&&sim.maxDD>0?cagr/sim.maxDD:null,worstDay:rt.worst,bestDay:rt.best,maxConsecutiveLosingTrades:ts.maxConsecutiveLosses,monthlyReturns:rt.monthly,
      benchmark:benchmarkOf(sim,opts),feePct:cfg.feePct,slippagePct:cfg.slippagePct,sellTaxPct:cfg.sellTaxPct,trainPct:cfg.trainPct,strategy:cfg.strategy,
      strategies:cfg.strategies,combine:cfg.strategies.length>1?cfg.combine:null,strategyLabel:S.labelOf(cfg),params:S.paramsOf(cfg),vnRules:cfg.vnRules,
      assetCount:sim.assets.length,symbols:sim.assets.map(function(a){return a.symbol;}),exchanges:sim.assets.map(function(a){return {symbol:a.symbol,exchange:a.exchange,limitPct:a.limitPct};}),
      rejected:sim.rejected,commonStart:sim.commonStart,commonEnd:sim.commonEnd,testDays:sim.dates.length,trades:ts.n,wins:ts.wins,losses:ts.losses,winRatePct:ts.winRatePct,
      profitFactor:ts.profitFactor,avgTradePct:ts.avgTradePct,maxPositions:cfg.maxPositions,maxPositionPct:cfg.maxPositionPct,riskPerTradePct:cfg.riskPerTradePct,stopLossPct:cfg.stopLossPct,
      takeProfitPct:cfg.takeProfitPct,maxPortfolioRiskPct:cfg.maxPortfolioRiskPct,maxDrawdownStopPct:cfg.maxDrawdownStopPct,entriesHalted:sim.halted,entriesHaltedDate:sim.haltDate,
      maxOpenRiskPct:sim.maxOpenRiskPct,avgCorrelation:avgCorr===null?null:avgCorr*100,
      highCorrelationPairs:high.map(function(x){return Object.assign({},x,{correlationPct:x.correlation*100});}),correlationPairs:pairs.map(function(x){return Object.assign({},x,{correlationPct:x.correlation*100});}),
      tradeLog:trades,equityCurve:sim.curve,contributions:contributions,verification:sim.verification,diagnostics:sim.skipped,dividendsReceived:sim.dividendsTotal,
      totalFeesPaid:trades.reduce(function(s,t){return s+t.feePaid;},0),totalTaxPaid:trades.reduce(function(s,t){return s+t.taxPaid;},0),
      settings:{lotSize:cfg.lotSize,settlementBars:cfg.settlementBars,cashLagBars:cfg.cashLagBars,maxVolumePct:cfg.maxVolumePct},
      note:'Mô phỏng long-only, vốn chung, chỉ trên phần thời gian chung ngoài mẫu. Tín hiệu từ nến đã đóng, khớp tại giá mở nến kế tiếp; cỡ lệnh định giá bằng giá đóng phiên trước.'+(cfg.vnRules?' Đã áp dụng luật VN: lô '+cfg.lotSize+' cổ, bước giá, biên độ theo sàn (HOSE 7%, HNX 10%, UPCoM 15%), thuế bán '+cfg.sellTaxPct+'%, khóa bán đến phiên T+'+cfg.settlementBars+', không bán khi khóa sàn/không mua khi khóa trần, trần khối lượng '+cfg.maxVolumePct+'% thanh khoản 20 phiên. Chưa có: cổ tức/quyền (trừ khi cung cấp), khớp từng phần, ATO/ATC, margin.':' Chế độ tắt luật VN (chỉ để đối chiếu).')+' Sharpe/Sortino dùng lợi suất theo phiên, lãi phi rủi ro 0.'};
    return res;
  }
  function toCSV(r){if(!r||!r.ready)return '';return csv(['symbol','entryDate','exitDate','entryPrice','exitPrice','units','cost','proceeds','pnl','returnPct','feePaid','taxPaid','bars','exitReason','forced'],r.tradeLog);}
  function equityToCSV(r){if(!r||!r.ready)return '';return csv(['date','value','cash','positions','openRisk'],r.equityCurve,4);}
  function monthlyToCSV(r){if(!r||!r.ready)return '';return csv(['month','startValue','endValue','returnPct'],r.monthlyReturns||[]);}

  function compareScenarios(input,opts){
    opts=Object.assign({},opts||{});var base=S.normOpts(opts,'portfolio');
    var sc=[{name:'Cấu hình hiện tại',patch:{}},
      {name:'Chi phí x2',patch:{feePct:Math.min(5,base.feePct*2),slippagePct:Math.min(5,base.slippagePct*2)}},
      {name:'Chi phí x3',patch:{feePct:Math.min(5,base.feePct*3),slippagePct:Math.min(5,base.slippagePct*3)}},
      {name:'Dừng lỗ 3% / chốt lời 5%',patch:{stopLossPct:3,takeProfitPct:5}},
      {name:'Dừng lỗ 5% / chốt lời 10%',patch:{stopLossPct:5,takeProfitPct:10}},
      {name:'Dừng lỗ 8% / chốt lời 15%',patch:{stopLossPct:8,takeProfitPct:15}},
      {name:'Không chốt lời định trước',patch:{takeProfitPct:0}},
      {name:'Tiền bán về chậm T+2 (chặt)',patch:{cashLagBars:2,settlementBars:3}},
      {name:'Bỏ luật VN (chỉ đối chiếu)',patch:{vnRules:false}}];
    var results=sc.map(function(s){var r=run(input,Object.assign({},opts,s.patch));return {name:s.name,ready:!!r.ready,reason:r.reason||'',netReturnPct:r.netReturnPct==null?null:r.netReturnPct,maxDrawdownPct:r.maxDrawdownPct==null?null:r.maxDrawdownPct,trades:r.trades||0,winRatePct:r.winRatePct==null?null:r.winRatePct,profitFactor:r.profitFactor==null?null:r.profitFactor,
      feePct:r.feePct!=null?r.feePct:opts.feePct,slippagePct:r.slippagePct!=null?r.slippagePct:opts.slippagePct,stopLossPct:r.stopLossPct!=null?r.stopLossPct:opts.stopLossPct,takeProfitPct:r.takeProfitPct!=null?r.takeProfitPct:opts.takeProfitPct};});
    return {ready:results.some(function(x){return x.ready;}),scenarios:results,note:'Các kịch bản được định trước để kiểm tra độ nhạy; không phải tối ưu hóa tham số và không đảm bảo kết quả tương lai. Dòng "Bỏ luật VN" cho biết luật thị trường làm kết quả lệch bao nhiêu so với mô phỏng lý tưởng.'};
  }
  function scenariosToCSV(s){if(!s||!Array.isArray(s.scenarios))return '';return csv(['name','ready','netReturnPct','maxDrawdownPct','trades','winRatePct','profitFactor','feePct','slippagePct','stopLossPct','takeProfitPct','reason'],s.scenarios);}

  // Walk-forward: các cửa sổ ngoài mẫu liên tiếp; mỗi vòng TỐI ƯU LẠI tham số chỉ bằng dữ liệu trước cửa sổ, rồi kiểm thử; vốn nối liên tục giữa các vòng.
  function walkForward(input,opts,config){
    opts=Object.assign({},opts||{});config=config||{};
    if(!Array.isArray(input)||input.length<2)return {ready:false,reason:'Cần ít nhất 2 mã dữ liệu.'};
    var all=new Set();input.forEach(function(it){(Array.isArray(it.candles)?it.candles:[]).forEach(function(c,i){var k=S.timeKey(c.timestamp!==undefined?c.timestamp:(c.time!==undefined?c.time:c.date),i);if(k&&k[0]!=='I')all.add(k);});});
    var dates=Array.from(all).sort(),trainPct=clamp(n(config.initialTrainPct)??60,50,80),folds=Math.round(clamp(n(config.folds)??3,2,5));
    var optimize=config.optimize!==false&&S.canOptimize(opts),chain=config.chainCapital!==false;
    var first=Math.floor(dates.length*trainPct/100),remaining=dates.length-first;
    if(dates.length<160||remaining<folds*20)return {ready:false,reason:'Không đủ lịch sử để tạo các cửa sổ ngoài mẫu tối thiểu 20 phiên. Cần tối thiểu khoảng 160 ngày dữ liệu chung.'};
    var out=[],capital=n(opts.initialCapital)>0?n(opts.initialCapital):100000000;
    for(var f=0;f<folds;f++){
      var si=first+Math.floor(remaining*f/folds),ei=first+Math.floor(remaining*(f+1)/folds)-1;if(ei-si+1<20)continue;
      var startDate=dates[si],endDate=dates[ei],params={},opt=null;
      if(optimize&&si>0){opt=S.optimize(input,Object.assign({},opts,{initialCapital:capital}),dates[si-1]);if(opt.best)params=opt.best.params;}
      var o=Object.assign({},opts,params,{testStartDate:startDate,testEndDate:endDate,initialCapital:chain?capital:(n(opts.initialCapital)||100000000)});
      var r=run(input,o);
      var ready=!!r.ready;
      if(ready&&chain)capital=r.finalEquity;
      var p=params&&params.stratParams?(r.params||params.stratParams):(params&&Object.keys(params).length?params:(r.params||{}));
      out.push({fold:f+1,startDate:startDate,endDate:endDate,ready:ready,reason:r.reason||'',netReturnPct:r.netReturnPct==null?null:r.netReturnPct,maxDrawdownPct:r.maxDrawdownPct==null?null:r.maxDrawdownPct,trades:r.trades||0,winRatePct:r.winRatePct==null?null:r.winRatePct,profitFactor:r.profitFactor==null?null:r.profitFactor,
        testDays:r.testDays||0,assetCount:r.assetCount||0,finalEquity:r.finalEquity==null?null:r.finalEquity,params:p,optimized:!!(opt&&opt.best),paramsFallback:!!(optimize&&opt&&!opt.best),
        trainReturnPct:opt&&opt.best?opt.best.trainReturnPct:null,trainTrades:opt&&opt.best?opt.best.trainTrades:null,gridTried:opt?opt.tried:0});
    }
    var valid=out.filter(function(x){return x.ready&&Number.isFinite(x.netReturnPct);});
    if(!valid.length)return {ready:false,reason:'Không có cửa sổ nào đủ dữ liệu để kiểm thử.',folds:out};
    var rets=valid.map(function(x){return x.netReturnPct;}).sort(function(a,b){return a-b;}),mean=rets.reduce(function(a,b){return a+b;},0)/rets.length;
    var median=rets.length%2?rets[(rets.length-1)/2]:(rets[rets.length/2-1]+rets[rets.length/2])/2,positive=valid.filter(function(x){return x.netReturnPct>0;}).length;
    var worst=valid.reduce(function(a,b){return b.netReturnPct<a.netReturnPct?b:a;}),maxDD=Math.max.apply(null,valid.map(function(x){return x.maxDrawdownPct||0;}));
    var comp=1;valid.forEach(function(x){comp*=1+x.netReturnPct/100;});
    var withTrain=valid.filter(function(x){return x.trainReturnPct!=null;});
    return {ready:true,initialTrainPct:trainPct,requestedFolds:folds,validFolds:valid.length,folds:out,meanReturnPct:mean,medianReturnPct:median,positiveFolds:positive,positiveFoldPct:positive/valid.length*100,
      worstFoldReturnPct:worst.netReturnPct,worstFold:worst.fold,maxDrawdownPct:maxDD,totalTrades:valid.reduce(function(a,b){return a+b.trades;},0),compoundedSegmentReturnPct:(comp-1)*100,
      optimized:optimize,chainedCapital:chain,meanTrainReturnPct:withTrain.length?withTrain.reduce(function(a,b){return a+b.trainReturnPct;},0)/withTrain.length:null,
      note:'Các cửa sổ ngoài mẫu liên tiếp, không chồng lấn. '+(optimize?'Mỗi vòng chọn lại tham số (lưới nhỏ định trước) chỉ bằng dữ liệu TRƯỚC cửa sổ; ':'Dùng một cấu hình cố định; ')+(chain?'vốn nối liên tục giữa các vòng (vị thế được đóng ở cuối mỗi cửa sổ, chịu đủ chi phí).':'mỗi vòng khởi tạo lại vốn.')+' Kết quả là chẩn đoán độ ổn định, không phải hồ sơ giao dịch thực.'};
  }
  function walkForwardToCSV(r){if(!r||!Array.isArray(r.folds))return '';return csv(['fold','startDate','endDate','ready','assetCount','testDays','netReturnPct','maxDrawdownPct','trades','winRatePct','profitFactor','finalEquity','trainReturnPct','optimized','reason'],r.folds.map(function(x){return Object.assign({},x,{optimized:x.optimized?'yes':'no'});}));}
  function monteCarlo(result,config){return S.monteCarlo(result,config);}
  function monteCarloToCSV(m){if(!m||!m.ready)return '';var rows=[];['tradeBootstrap','dailyBlockBootstrap'].forEach(function(k){var d=m[k];if(!d)return;['p5','p25','p50','p75','p95'].forEach(function(p){rows.push({method:k,percentile:p,returnPct:d.returnPct[p],maxDrawdownPct:d.maxDrawdownPct[p]});});});return csv(['method','percentile','returnPct','maxDrawdownPct'],rows);}
  window.NHIPPortfolioBacktest={run:run,toCSV:toCSV,equityToCSV:equityToCSV,monthlyToCSV:monthlyToCSV,compareScenarios:compareScenarios,scenariosToCSV:scenariosToCSV,walkForward:walkForward,walkForwardToCSV:walkForwardToCSV,monteCarlo:monteCarlo,monteCarloToCSV:monteCarloToCSV};
})();
