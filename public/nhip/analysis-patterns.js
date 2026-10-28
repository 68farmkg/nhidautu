/* NHIP Price Structure v1 — deterministic patterns computed only from supplied OHLC candles. */
(function(){'use strict';
  const num=v=>v!==null&&v!==undefined&&Number.isFinite(Number(v))?Number(v):null;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function analyze(input){
    const c=(Array.isArray(input)?input:[]).map(x=>({open:num(x.open),high:num(x.high),low:num(x.low),close:num(x.close),volume:num(x.volume),timestamp:x.timestamp||x.time})).filter(x=>x.open!==null&&x.high!==null&&x.low!==null&&x.close!==null&&x.high>=x.low);
    if(c.length<8)return {ready:false,count:c.length,reason:'Cần ít nhất 8 nến OHLC hợp lệ.',levels:[],patterns:[],structure:'Chưa đủ dữ liệu',score:null,coverage:0};
    const last=c[c.length-1], prev=c[c.length-2], recent=c.slice(-20), hi=Math.max(...recent.map(x=>x.high)),lo=Math.min(...recent.map(x=>x.low));
    const range=last.high-last.low, body=Math.abs(last.close-last.open), upper=last.high-Math.max(last.open,last.close),lower=Math.min(last.open,last.close)-last.low;
    const avgBody=recent.reduce((s,x)=>s+Math.abs(x.close-x.open),0)/recent.length;
    const pivots=[];
    for(let i=Math.max(2,c.length-60);i<c.length-2;i++){
      const x=c[i], prevs=c.slice(i-2,i), nexts=c.slice(i+1,i+3);
      if(prevs.every(y=>x.high>=y.high)&&nexts.every(y=>x.high>=y.high))pivots.push({type:'R',price:x.high,index:i});
      if(prevs.every(y=>x.low<=y.low)&&nexts.every(y=>x.low<=y.low))pivots.push({type:'S',price:x.low,index:i});
    }
    function cluster(type){const arr=pivots.filter(p=>p.type===type).sort((a,b)=>a.price-b.price), groups=[];for(const p of arr){let g=groups.find(z=>Math.abs(z.price-p.price)/Math.max(Math.abs(z.price),1e-9)<.012);if(!g)groups.push(g={price:p.price,count:0,lastIndex:0});g.price=(g.price*g.count+p.price)/(g.count+1);g.count++;g.lastIndex=Math.max(g.lastIndex,p.index);}return groups.sort((a,b)=>b.count-a.count||b.lastIndex-a.lastIndex).slice(0,3).map(g=>({type,price:g.price,touches:g.count,age:c.length-1-g.lastIndex}));}
    const levels=[...cluster('S'),...cluster('R')].sort((a,b)=>a.price-b.price);
    // Local swing progression (last 3 confirmed pivots of each type).
    const lastHighs=pivots.filter(p=>p.type==='R').slice(-3),lastLows=pivots.filter(p=>p.type==='S').slice(-3);
    let structure='Hỗn hợp / đi ngang';
    if(lastHighs.length>=2&&lastLows.length>=2){const hh=lastHighs[lastHighs.length-1].price>lastHighs[lastHighs.length-2].price,hl=lastLows[lastLows.length-1].price>lastLows[lastLows.length-2].price,lh=lastHighs[lastHighs.length-1].price<lastHighs[lastHighs.length-2].price,ll=lastLows[lastLows.length-1].price<lastLows[lastLows.length-2].price;if(hh&&hl)structure='Đỉnh cao dần · đáy cao dần';else if(lh&&ll)structure='Đỉnh thấp dần · đáy thấp dần';}
    const patterns=[];
    const add=(name,kind,detail,confidence)=>patterns.push({name,kind,detail,confidence});
    if(range>0&&body/range<.12)add('Doji / thân nến nhỏ','neutral','Thân nến nhỏ so với biên độ phiên; thể hiện lưỡng lự, cần nến xác nhận.',55);
    if(prev.close<prev.open&&last.close>last.open&&last.open<=prev.close&&last.close>=prev.open&&body>=Math.abs(prev.close-prev.open)*.8)add('Bullish engulfing','bull','Nến tăng bao phủ thân nến trước; chỉ là tín hiệu cần xác nhận.',65);
    if(prev.close>prev.open&&last.close<last.open&&last.open>=prev.close&&last.close<=prev.open&&body>=Math.abs(prev.close-prev.open)*.8)add('Bearish engulfing','bear','Nến giảm bao phủ thân nến trước; chỉ là tín hiệu cần xác nhận.',65);
    if(range>0&&lower>=body*2&&upper<=Math.max(body*.8,range*.08)&&last.close>=last.low+range*.55)add('Bóng dưới dài','bull','Lực mua xuất hiện ở vùng thấp trong phiên; không tự xác nhận đảo chiều.',52);
    if(range>0&&upper>=body*2&&lower<=Math.max(body*.8,range*.08)&&last.close<=last.low+range*.45)add('Bóng trên dài','bear','Áp lực bán xuất hiện ở vùng cao trong phiên; không tự xác nhận đảo chiều.',52);
    const prior=c.slice(-21,-1),priorHigh=prior.length?Math.max(...prior.map(x=>x.high)):null,priorLow=prior.length?Math.min(...prior.map(x=>x.low)):null;
    if(priorHigh!==null&&last.close>priorHigh)add('Đóng cửa vượt đỉnh 20 nến','bull','Giá đóng cửa vượt đỉnh của 20 nến trước; kiểm tra thanh khoản và nguy cơ phá vỡ giả.',70);
    else if(priorHigh!==null&&last.high>priorHigh&&last.close<=priorHigh)add('Thử vượt đỉnh nhưng chưa giữ được','bear','Giá chạm vượt đỉnh cũ trong phiên nhưng đóng cửa phía dưới.',58);
    if(priorLow!==null&&last.close<priorLow)add('Đóng cửa thủng đáy 20 nến','bear','Giá đóng cửa dưới đáy của 20 nến trước; kiểm tra khả năng hồi kỹ thuật.',70);
    const dist=(a,b)=>a===null||b===null?null:(a-b)/Math.max(Math.abs(b),1e-9)*100;
    const support=levels.filter(x=>x.type==='S'&&x.price<=last.close).sort((a,b)=>b.price-a.price)[0]||null;
    const resistance=levels.filter(x=>x.type==='R'&&x.price>=last.close).sort((a,b)=>a.price-b.price)[0]||null;
    const dS=support?dist(last.close,support.price):null,dR=resistance?dist(resistance.price,last.close):null;
    let score=50,weight=0,parts=[];
    if(structure!=='Hỗn hợp / đi ngang'){const v=structure.indexOf('cao dần')>=0?78:35;parts.push({name:'Cấu trúc swing',value:v,weight:40});}
    if(priorHigh!==null&&priorLow!==null){const v=last.close>priorHigh?85:last.close<priorLow?20:55;parts.push({name:'Vị trí trong biên 20 nến',value:v,weight:35});}
    if(patterns.some(x=>x.kind==='bull')||patterns.some(x=>x.kind==='bear')){let v=50;if(patterns.some(x=>x.kind==='bull'))v+=15;if(patterns.some(x=>x.kind==='bear'))v-=15;parts.push({name:'Mẫu hình nến / phá vỡ',value:clamp(v,0,100),weight:25});}
    parts.forEach(p=>{score+=0;weight+=p.weight;});if(weight)score=parts.reduce((s,p)=>s+p.value*p.weight,0)/weight;else score=null;
    return {ready:true,count:c.length,lastClose:last.close,structure,levels,support,resistance,distanceSupportPct:dS,distanceResistancePct:dR,patterns,score,coverage:weight,parts,range20:{high:hi,low:lo},asOf:last.timestamp||null};
  }
  window.NHIPPriceStructure={analyze};
})();
