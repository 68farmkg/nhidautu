/* NHIP Multi-timeframe v1: deterministic summaries from real OHLCV candles only. */
(function(){'use strict';
  const n=v=>v!==null&&v!==undefined&&Number.isFinite(Number(v))?Number(v):null;
  const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
  function analyze(input,res){
    const c=(Array.isArray(input)?input:[]).map(x=>({open:n(x.open),high:n(x.high),low:n(x.low),close:n(x.close),volume:n(x.volume),timestamp:x.timestamp||x.time})).filter(x=>x.close!==null&&x.high!==null&&x.low!==null&&x.high>=x.low);
    if(c.length<20)return {ready:false,res,count:c.length,reason:'Cần ít nhất 20 nến hợp lệ cho khung này.'};
    const closes=c.map(x=>x.close), last=c[c.length-1], sma20=mean(closes.slice(-20)), sma50=c.length>=50?mean(closes.slice(-50)):null;
    const gains=[],losses=[];for(let i=Math.max(1,c.length-14);i<c.length;i++){const d=closes[i]-closes[i-1];gains.push(Math.max(0,d));losses.push(Math.max(0,-d));}
    const ag=mean(gains),al=mean(losses),rsi=al===0?(ag===0?50:100):100-(100/(1+ag/al));
    const vols=c.slice(-20).map(x=>x.volume).filter(x=>x!==null&&x>=0),avgVol=mean(vols),volRatio=last.volume!==null&&avgVol>0?last.volume/avgVol:null;
    const prior=c.slice(-21,-1), priorHigh=prior.length?Math.max(...prior.map(x=>x.high)):null,priorLow=prior.length?Math.min(...prior.map(x=>x.low)):null;
    const above20=last.close>sma20, above50=sma50===null?null:last.close>sma50, stack=sma50===null?null:sma20>sma50;
    let state='Hỗn hợp';if(above20&&above50&&stack)state='Tăng đồng thuận';else if(!above20&&above50===false&&stack===false)state='Giảm đồng thuận';else if(above20&&above50===false)state='Hồi phục / mâu thuẫn';else if(!above20&&above50===true)state='Điều chỉnh / mâu thuẫn';
    const parts=[];if(sma20!==null)parts.push(above20?1:0);if(above50!==null)parts.push(above50?1:0);if(stack!==null)parts.push(stack?1:0);if(n(rsi)!==null)parts.push(rsi>=50&&rsi<=70?1:rsi<40?0:.5);
    const score=parts.length?Math.round(parts.reduce((a,b)=>a+b,0)/parts.length*100):null;
    let volumeNote='Chưa đủ dữ liệu khối lượng';if(volRatio!==null)volumeNote=volRatio>=1.5?'Khối lượng cao hơn TB20':volRatio<.7?'Khối lượng thấp hơn TB20':'Khối lượng quanh TB20';
    let breakout='Không có phá vỡ 20 nến';if(priorHigh!==null&&last.close>priorHigh)breakout='Đóng cửa vượt đỉnh 20 nến';else if(priorLow!==null&&last.close<priorLow)breakout='Đóng cửa thủng đáy 20 nến';
    return {ready:true,res,count:c.length,lastClose:last.close,asOf:last.timestamp||null,sma20,sma50,rsi:+rsi.toFixed(1),volumeRatio:volRatio,volumeNote,state,score,coverage:Math.round(parts.length/4*100),breakout};
  }
  window.NHIPMultiTimeframe={analyze};
})();
