/* NHIP Risk & Setup v1 — ATR, vùng giá, xác nhận khối lượng và tỷ lệ lợi nhuận/rủi ro tham khảo. */
(function(){'use strict';
  const n=v=>v!==null&&v!==undefined&&Number.isFinite(Number(v))?Number(v):null;
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  function analyze(input, structure){
    const c=(Array.isArray(input)?input:[]).map(x=>({open:n(x.open),high:n(x.high),low:n(x.low),close:n(x.close),volume:n(x.volume),time:x.timestamp||x.time})).filter(x=>x.open!==null&&x.high!==null&&x.low!==null&&x.close!==null&&x.high>=x.low&&x.high>=Math.max(x.open,x.close)&&x.low<=Math.min(x.open,x.close));
    if(c.length<22)return {ready:false,count:c.length,reason:'Cần ít nhất 22 nến OHLC hợp lệ để đánh giá ATR và phá vỡ 20 nến.'};
    const last=c[c.length-1], prior=c.slice(-21,-1), prevClose=c[c.length-2].close;
    const trs=c.slice(1).map((x,i)=>Math.max(x.high-x.low,Math.abs(x.high-c[i].close),Math.abs(x.low-c[i].close)));
    const atrs=trs.slice(-14), atr=atrs.length===14?atrs.reduce((a,b)=>a+b,0)/14:null;
    const avgVolRows=c.slice(-21,-1).filter(x=>x.volume!==null&&x.volume>=0), avgVol=avgVolRows.length?avgVolRows.reduce((a,x)=>a+x.volume,0)/avgVolRows.length:null;
    const volRatio=avgVol>0&&last.volume!==null?last.volume/avgVol:null;
    const priorHigh=Math.max(...prior.map(x=>x.high)), priorLow=Math.min(...prior.map(x=>x.low));
    let breakout='Không có phá vỡ 20 nến';
    if(last.close>priorHigh)breakout=volRatio===null?'Đóng cửa vượt đỉnh · thiếu dữ liệu KL':volRatio>=1.5?'Vượt đỉnh có khối lượng xác nhận (≥1,5× TB20)':volRatio>=1?'Vượt đỉnh · khối lượng đạt TB20':'Vượt đỉnh nhưng khối lượng yếu';
    else if(last.high>priorHigh)breakout='Đã vượt đỉnh trong phiên nhưng đóng cửa không giữ được';
    else if(last.close<priorLow)breakout='Đóng cửa thủng đáy 20 nến';
    else if(last.low<priorLow)breakout='Thủng đáy trong phiên nhưng đóng cửa hồi lên';
    const support=structure&&structure.support&&structure.support.price<last.close?structure.support.price:(priorLow<last.close?priorLow:null);
    const resistance=structure&&structure.resistance&&structure.resistance.price>last.close?structure.resistance.price:(priorHigh>last.close?priorHigh:null);
    const riskPct=support!==null?(last.close-support)/last.close*100:null;
    const rewardPct=resistance!==null?(resistance-last.close)/last.close*100:null;
    const rr=riskPct!==null&&riskPct>0&&rewardPct!==null?rewardPct/riskPct:null;
    const atrPct=atr!==null&&last.close>0?atr/last.close*100:null;
    const candleRange=last.high-last.low, closeLocation=candleRange>0?(last.close-last.low)/candleRange:null;
    const warnings=[];
    if(volRatio===null)warnings.push('Không đủ khối lượng hợp lệ để xác nhận phá vỡ.');
    else if(volRatio<1)warnings.push('Khối lượng phiên cuối thấp hơn trung bình 20 nến.');
    if(atrPct!==null&&atrPct>=5)warnings.push('ATR/giá cao (≥5%): biến động lớn, cần thận trọng với quy mô vị thế.');
    if(closeLocation!==null&&closeLocation<.35)warnings.push('Giá đóng cửa ở phần thấp của biên độ phiên.');
    if(riskPct!==null&&riskPct<=0)warnings.push('Vùng hỗ trợ tham khảo không nằm dưới giá hiện tại; cần kiểm tra lại cấu trúc.');
    if(rr!==null&&rr<1)warnings.push('Khoảng cách tới kháng cự gần nhỏ hơn khoảng cách tới hỗ trợ tham khảo.');
    if(!support)warnings.push('Chưa xác định được hỗ trợ bên dưới giá hiện tại.');
    if(!resistance)warnings.push('Chưa xác định được kháng cự bên trên giá hiện tại.');
    return {ready:true,count:c.length,close:last.close,atr,atrPct,avgVolume20:avgVol,volumeRatio:volRatio,priorHigh,priorLow,breakout,support,resistance,riskPct,rewardPct,rr,closeLocation,warnings,asOf:last.time||null};
  }
  window.NHIPRiskSetup={analyze};
})();
