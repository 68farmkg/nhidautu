/* NHIP Strategies v1 — thư viện chiến lược cho kiểm thử/mô phỏng + cách kết hợp nhiều công cụ.
   Mỗi chiến lược trả về {buy[],sell[]} theo từng nến: phần tử i CHỈ dùng dữ liệu ≤ i (tín hiệu xác nhận khi nến đóng;
   lõi NHIPSim khớp lệnh ở giá mở cửa nến kế tiếp). Chỉ báo tự cài đặt, độc lập với KLineCharts.
   Kết hợp nhiều công cụ: mỗi công cụ có "trạng thái nắm giữ" (mua → bật, bán → tắt); tổ hợp = AND / OR / đa số trên các trạng thái đó,
   mua khi tổ hợp bật, bán khi tổ hợp tắt. */
(function(W){'use strict';
  function isF(v){return typeof v==='number'&&isFinite(v);}
  function fill(n,v){var a=new Array(n);for(var i=0;i<n;i++)a[i]=v;return a;}
  function firstF(x){for(var i=0;i<x.length;i++)if(isF(x[i]))return i;return -1;}

  /* ---------- chỉ báo (nhân quả, NaN khi chưa đủ dữ liệu) ---------- */
  function sma(x,n){var N=x.length,o=fill(N,NaN),f=firstF(x);if(f<0)return o;var s=0;for(var i=f;i<N;i++){s+=x[i];if(i-f>=n)s-=x[i-n];if(i-f>=n-1)o[i]=s/n;}return o;}
  function ema(x,n,alpha){var N=x.length,o=fill(N,NaN),f=firstF(x);if(f<0||N-f<n)return o;var a=alpha||2/(n+1),s=0,i;for(i=f;i<f+n;i++)s+=x[i];o[f+n-1]=s/n;for(i=f+n;i<N;i++)o[i]=o[i-1]+a*(x[i]-o[i-1]);return o;}
  function rma(x,n){return ema(x,n,1/n);}
  function wma(x,n){var N=x.length,o=fill(N,NaN),f=firstF(x);if(f<0)return o;var den=n*(n+1)/2;for(var i=f+n-1;i<N;i++){var s=0;for(var k=0;k<n;k++)s+=(k+1)*x[i-n+1+k];o[i]=s/den;}return o;}
  function stdev(x,n){var N=x.length,o=fill(N,NaN),f=firstF(x);if(f<0)return o;for(var i=f+n-1;i<N;i++){var m=0,k;for(k=i-n+1;k<=i;k++)m+=x[k];m/=n;var v=0;for(k=i-n+1;k<=i;k++)v+=(x[k]-m)*(x[k]-m);o[i]=Math.sqrt(v/n);}return o;}
  function hh(x,n){var N=x.length,o=fill(N,NaN);for(var i=n-1;i<N;i++){var m=-Infinity;for(var k=i-n+1;k<=i;k++)if(x[k]>m)m=x[k];o[i]=m;}return o;}
  function ll(x,n){var N=x.length,o=fill(N,NaN);for(var i=n-1;i<N;i++){var m=Infinity;for(var k=i-n+1;k<=i;k++)if(x[k]<m)m=x[k];o[i]=m;}return o;}
  function trueRange(h,l,c){return h.map(function(_,i){return i?Math.max(h[i]-l[i],Math.abs(h[i]-c[i-1]),Math.abs(l[i]-c[i-1])):h[i]-l[i];});}
  function atr(h,l,c,n){return rma(trueRange(h,l,c),n);}
  function rsi(c,n){var N=c.length,g=fill(N,NaN),ls=fill(N,NaN),i;for(i=1;i<N;i++){var d=c[i]-c[i-1];g[i]=d>0?d:0;ls[i]=d<0?-d:0;}var ag=rma(g,n),al=rma(ls,n),o=fill(N,NaN);for(i=0;i<N;i++)if(isF(ag[i])&&isF(al[i]))o[i]=al[i]===0?(ag[i]===0?50:100):100-100/(1+ag[i]/al[i]);return o;}
  function sub(a,b){return a.map(function(v,i){return v-b[i];});}

  /* ---------- tiện ích sinh tín hiệu ---------- */
  function cu(a,b,i){return i>0&&isF(a[i])&&isF(b[i])&&isF(a[i-1])&&isF(b[i-1])&&a[i-1]<=b[i-1]&&a[i]>b[i];}
  function cd(a,b,i){return i>0&&isF(a[i])&&isF(b[i])&&isF(a[i-1])&&isF(b[i-1])&&a[i-1]>=b[i-1]&&a[i]<b[i];}
  function lu(a,lv,i){return i>0&&isF(a[i])&&isF(a[i-1])&&a[i-1]<=lv&&a[i]>lv;}
  function ld(a,lv,i){return i>0&&isF(a[i])&&isF(a[i-1])&&a[i-1]>=lv&&a[i]<lv;}
  function zero(n){return fill(n,0);}
  /* máy trạng thái: vào khi enter(i), ra khi exit(i). Khi đang đứng ngoài mà enter&&exit cùng nến → bỏ qua. */
  function machine(n,enter,exit){var buy=fill(n,false),sell=fill(n,false),on=false;for(var i=0;i<n;i++){var e=enter(i),x=exit(i);if(!on){if(e&&!x){on=true;buy[i]=true;}}else if(x){on=false;sell[i]=true;}}return {buy:buy,sell:sell};}
  function crossRule(a,b){return machine(a.length,function(i){return cu(a,b,i);},function(i){return cd(a,b,i);});}
  function arrs(c){var o=[],h=[],l=[],cl=[],v=[];for(var i=0;i<c.length;i++){o.push(c[i].open);h.push(c[i].high);l.push(c[i].low);cl.push(c[i].close);v.push(isF(c[i].volume)?c[i].volume:NaN);}return {o:o,h:h,l:l,c:cl,v:v,n:c.length};}
  function none(n){return {buy:fill(n,false),sell:fill(n,false)};}

  /* ---------- danh mục chiến lược ----------
     p: [tên, mặc định, min, max, nguyên?]; grid: các bộ tham số dùng cho walk-forward (tối ưu lại mỗi vòng). */
  var DEFS=[];
  function def(d){DEFS.push(d);}

  /* — Xu hướng — */
  def({id:'sma',label:'Giao cắt SMA nhanh/chậm',short:'SMA',group:'Xu hướng',desc:'Mua khi SMA nhanh cắt lên SMA chậm; bán khi cắt xuống (mặc định 20/50).',
    p:[['fast',20,2,200,1],['slow',50,3,400,1]],grid:[{fast:10,slow:30},{fast:20,slow:50},{fast:30,slow:100}],need:function(p){return p.slow+2;},
    sig:function(A,p){var n=A.n,buy=fill(n,false),sell=fill(n,false),pre=zero(n+1),k;for(k=0;k<n;k++)pre[k+1]=pre[k]+Math.round(A.c[k]*1e4);
      var sm=function(q,i){return i+1<q?null:pre[i+1]-pre[i+1-q];};
      for(var m=1;m<n;m++){var f=sm(p.fast,m),s2=sm(p.slow,m),pf=sm(p.fast,m-1),ps=sm(p.slow,m-1);if(f===null||s2===null||pf===null||ps===null)continue;var cur=f*p.slow-s2*p.fast,prv=pf*p.slow-ps*p.fast;buy[m]=prv<=0&&cur>0;sell[m]=prv>=0&&cur<0;}
      return {buy:buy,sell:sell};}});
  def({id:'ema',label:'Giao cắt EMA nhanh/chậm',short:'EMA',group:'Xu hướng',desc:'Mua khi EMA nhanh cắt lên EMA chậm; bán khi cắt xuống (12/26).',
    p:[['fast',12,2,100,1],['slow',26,3,200,1]],grid:[{fast:8,slow:21},{fast:12,slow:26},{fast:20,slow:50}],need:function(p){return p.slow*2;},
    sig:function(A,p){return crossRule(ema(A.c,p.fast),ema(A.c,p.slow));}});
  def({id:'pricesma',label:'Giá cắt qua SMA',short:'Giá/SMA',group:'Xu hướng',desc:'Mua khi giá đóng cửa vượt lên trên SMA; bán khi rơi xuống dưới (mặc định SMA50).',
    p:[['period',50,5,300,1]],grid:[{period:20},{period:50},{period:100}],need:function(p){return p.period+2;},
    sig:function(A,p){return crossRule(A.c,sma(A.c,p.period));}});
  def({id:'hma',label:'Giá cắt qua Hull MA',short:'HMA',group:'Xu hướng',desc:'Mua khi giá vượt lên trên Hull MA; bán khi xuống dưới (21).',
    p:[['period',21,4,200,1]],grid:[{period:14},{period:21},{period:34}],need:function(p){return p.period*2+4;},
    sig:function(A,p){var half=Math.max(1,Math.floor(p.period/2)),sq=Math.max(1,Math.round(Math.sqrt(p.period)))/* cùng quy ước với đường HMA trên biểu đồ (indicators.js) */,w1=wma(A.c,half),w2=wma(A.c,p.period),raw=w1.map(function(v,i){return 2*v-w2[i];});return crossRule(A.c,wma(raw,sq));}});
  def({id:'macd',label:'MACD cắt đường tín hiệu',short:'MACD',group:'Xu hướng',desc:'Mua khi MACD cắt lên đường tín hiệu; bán khi cắt xuống (12/26/9).',
    p:[['fast',12,2,100,1],['slow',26,3,200,1],['signal',9,2,100,1]],grid:[{fast:8,slow:17,signal:9},{fast:12,slow:26,signal:9},{fast:19,slow:39,signal:9}],need:function(p){return p.slow+p.signal+p.slow;},
    sig:function(A,p){var m=sub(ema(A.c,p.fast),ema(A.c,p.slow));return crossRule(m,ema(m,p.signal));}});
  def({id:'supertrend',label:'Supertrend đổi chiều',short:'Supertrend',group:'Xu hướng',desc:'Mua khi Supertrend chuyển sang tăng; bán khi chuyển sang giảm (ATR 10, hệ số 3).',
    p:[['period',10,2,100,1],['mult',3,0.5,10,0]],grid:[{period:10,mult:2},{period:10,mult:3},{period:14,mult:3}],need:function(p){return p.period*3;},
    sig:function(A,p){var n=A.n,a=atr(A.h,A.l,A.c,p.period),fu=fill(n,NaN),fl=fill(n,NaN),dir=fill(n,0),buy=fill(n,false),sell=fill(n,false);
      for(var i=0;i<n;i++){if(!isF(a[i]))continue;var mid=(A.h[i]+A.l[i])/2,bu=mid+p.mult*a[i],bl=mid-p.mult*a[i];
        if(!isF(fu[i-1])){fu[i]=bu;fl[i]=bl;dir[i]=1;continue;}
        fu[i]=(bu<fu[i-1]||A.c[i-1]>fu[i-1])?bu:fu[i-1];fl[i]=(bl>fl[i-1]||A.c[i-1]<fl[i-1])?bl:fl[i-1];
        dir[i]=A.c[i]>fu[i-1]?1:(A.c[i]<fl[i-1]?-1:dir[i-1]);
        if(dir[i]===1&&dir[i-1]===-1)buy[i]=true;if(dir[i]===-1&&dir[i-1]===1)sell[i]=true;}
      return machine(n,function(i){return buy[i];},function(i){return sell[i];});}});
  def({id:'psar',label:'Parabolic SAR đổi chiều',short:'SAR',group:'Xu hướng',desc:'Mua khi SAR chuyển xuống dưới giá; bán khi chuyển lên trên giá (0,02 / 0,2).',
    p:[['step',0.02,0.005,0.1,0],['max',0.2,0.05,0.5,0]],grid:[{step:0.015,max:0.15},{step:0.02,max:0.2},{step:0.03,max:0.3}],need:function(){return 10;},
    sig:function(A,p){var n=A.n,up=true,af=p.step,ep,sar,buy=fill(n,false),sell=fill(n,false);if(n<3)return none(n);
      up=A.c[1]>=A.c[0];sar=up?A.l[0]:A.h[0];ep=up?A.h[1]:A.l[1];
      for(var i=2;i<n;i++){var ns=sar+af*(ep-sar);
        if(up){ns=Math.min(ns,A.l[i-1],A.l[i-2]);if(A.l[i]<ns){up=false;ns=ep;ep=A.l[i];af=p.step;sell[i]=true;}else if(A.h[i]>ep){ep=A.h[i];af=Math.min(af+p.step,p.max);}}
        else{ns=Math.max(ns,A.h[i-1],A.h[i-2]);if(A.h[i]>ns){up=true;ns=ep;ep=A.h[i];af=p.step;buy[i]=true;}else if(A.l[i]<ep){ep=A.l[i];af=Math.min(af+p.step,p.max);}}
        sar=ns;}
      return machine(n,function(i){return buy[i];},function(i){return sell[i];});}});
  def({id:'ichimoku',label:'Ichimoku (giá trên mây)',short:'Ichimoku',group:'Xu hướng',desc:'Mua khi giá đóng trên mây và Tenkan > Kijun; bán khi giá đóng dưới Kijun (9/26/52).',
    p:[['tenkan',9,2,60,1],['kijun',26,3,120,1],['senkou',52,5,240,1]],grid:[{tenkan:9,kijun:26,senkou:52},{tenkan:7,kijun:22,senkou:44}],need:function(p){return p.senkou+p.kijun+2;},
    sig:function(A,p){var n=A.n,mid=function(k){var H=hh(A.h,k),L=ll(A.l,k);return H.map(function(v,i){return (v+L[i])/2;});},
      t=mid(p.tenkan),kj=mid(p.kijun),sb=mid(p.senkou),top=fill(n,NaN);
      for(var i=p.kijun;i<n;i++){var j=i-p.kijun,sa=(t[j]+kj[j])/2;if(isF(sa)&&isF(sb[j]))top[i]=Math.max(sa,sb[j]);}
      return machine(n,function(i){return isF(top[i])&&isF(t[i])&&isF(kj[i])&&A.c[i]>top[i]&&t[i]>kj[i];},function(i){return isF(kj[i])&&A.c[i]<kj[i];});}});
  def({id:'adx',label:'ADX + giao cắt DI',short:'ADX/DI',group:'Xu hướng',desc:'Mua khi +DI cắt lên −DI và ADX ≥ ngưỡng; bán khi −DI cắt lên +DI (14, ngưỡng 20).',
    p:[['period',14,2,100,1],['min',20,5,50,1]],grid:[{period:14,min:20},{period:14,min:25},{period:21,min:20}],need:function(p){return p.period*3;},
    sig:function(A,p){var n=A.n,pdm=fill(n,NaN),mdm=fill(n,NaN),i;for(i=1;i<n;i++){var up=A.h[i]-A.h[i-1],dn=A.l[i-1]-A.l[i];pdm[i]=up>dn&&up>0?up:0;mdm[i]=dn>up&&dn>0?dn:0;}
      var tr=rma(trueRange(A.h,A.l,A.c),p.period),pd=rma(pdm,p.period),md=rma(mdm,p.period),pdi=fill(n,NaN),mdi=fill(n,NaN),dx=fill(n,NaN);
      for(i=0;i<n;i++)if(isF(tr[i])&&isF(pd[i])&&isF(md[i])&&tr[i]>0){pdi[i]=100*pd[i]/tr[i];mdi[i]=100*md[i]/tr[i];var s=pdi[i]+mdi[i];dx[i]=s>0?100*Math.abs(pdi[i]-mdi[i])/s:0;}
      var adx=rma(dx,p.period);
      return machine(n,function(i){return cu(pdi,mdi,i)&&isF(adx[i])&&adx[i]>=p.min;},function(i){return cu(mdi,pdi,i);});}});
  def({id:'aroon',label:'Aroon Up cắt Aroon Down',short:'Aroon',group:'Xu hướng',desc:'Mua khi Aroon Up cắt lên Aroon Down; bán khi cắt xuống (25).',
    p:[['period',25,5,100,1]],grid:[{period:14},{period:25},{period:50}],need:function(p){return p.period+3;},
    sig:function(A,p){var n=A.n,u=fill(n,NaN),d=fill(n,NaN);for(var i=p.period;i<n;i++){var hi=-Infinity,lo=Infinity,ih=i,il=i;for(var k=i-p.period;k<=i;k++){if(A.h[k]>=hi){hi=A.h[k];ih=k;}if(A.l[k]<=lo){lo=A.l[k];il=k;}}
        u[i]=100*(p.period-(i-ih))/p.period;d[i]=100*(p.period-(i-il))/p.period;}
      return crossRule(u,d);}});

  /* — Kênh / phá vỡ — */
  def({id:'breakout',label:'Phá vỡ đỉnh/đáy N nến (Donchian)',short:'Phá vỡ',group:'Phá vỡ & kênh',desc:'Mua khi đóng cửa vượt đỉnh N nến trước; bán khi thủng đáy N nến trước (20).',
    p:[['lookback',20,3,250,1]],grid:[{lookback:10},{lookback:20},{lookback:40}],need:function(p){return p.lookback+1;},
    sig:function(A,p){var n=A.n,buy=fill(n,false),sell=fill(n,false);for(var i=p.lookback;i<n;i++){var hi=-Infinity,lo=Infinity;for(var j=i-p.lookback;j<i;j++){if(A.h[j]>hi)hi=A.h[j];if(A.l[j]<lo)lo=A.l[j];}buy[i]=A.c[i]>hi;sell[i]=A.c[i]<lo;}return {buy:buy,sell:sell};}});
  def({id:'turtle',label:'Turtle (vào 55 / ra 20)',short:'Turtle',group:'Phá vỡ & kênh',desc:'Mua khi vượt đỉnh 55 nến; bán khi thủng đáy 20 nến.',
    p:[['entry',55,10,250,1],['exit',20,3,120,1]],grid:[{entry:40,exit:15},{entry:55,exit:20},{entry:80,exit:30}],need:function(p){return p.entry+2;},
    sig:function(A,p){var H=hh(A.h,p.entry),L=ll(A.l,p.exit);return machine(A.n,function(i){return i>0&&isF(H[i-1])&&A.c[i]>H[i-1];},function(i){return i>0&&isF(L[i-1])&&A.c[i]<L[i-1];});}});
  def({id:'fade2',label:'Fade2: mua sau khi thủng đáy, giữ đến khi phá đỉnh (80/30)',short:'Fade2',group:'Phá vỡ & kênh',desc:'Đảo chiều hệ thống phá vỡ (fade breakout): mua khi giá đóng cửa thủng đáy 30 nến trước; bán khi giá đóng cửa vượt đỉnh 80 nến trước. Đứng ngoài cho tới lần thủng đáy đầu tiên.',
    p:[['high',80,10,250,1],['low',30,3,120,1]],grid:[{high:80,low:30},{high:55,low:20},{high:120,low:40}],need:function(p){return Math.max(p.high,p.low)+2;},
    sig:function(A,p){var H=hh(A.h,p.high),L=ll(A.l,p.low);return machine(A.n,function(i){return i>0&&isF(L[i-1])&&A.c[i]<L[i-1];},function(i){return i>0&&isF(H[i-1])&&A.c[i]>H[i-1];});}});
  def({id:'bollbreak',label:'Bollinger: bứt phá dải trên',short:'BB bứt phá',group:'Phá vỡ & kênh',desc:'Mua khi giá đóng trên dải Bollinger trên; bán khi giá đóng dưới đường giữa (20, 2σ).',
    p:[['period',20,5,200,1],['k',2,0.5,4,0]],grid:[{period:20,k:2},{period:20,k:2.5},{period:30,k:2}],need:function(p){return p.period+2;},
    sig:function(A,p){var m=sma(A.c,p.period),s=stdev(A.c,p.period);return machine(A.n,function(i){return isF(m[i])&&A.c[i]>m[i]+p.k*s[i];},function(i){return isF(m[i])&&A.c[i]<m[i];});}});
  def({id:'keltner',label:'Keltner: bứt phá dải trên',short:'Keltner',group:'Phá vỡ & kênh',desc:'Mua khi giá đóng trên dải Keltner trên; bán khi giá đóng dưới EMA giữa (EMA20, ATR10, 2).',
    p:[['period',20,5,200,1],['atr',10,2,100,1],['mult',2,0.5,6,0]],grid:[{period:20,atr:10,mult:2},{period:20,atr:10,mult:1.5},{period:30,atr:14,mult:2}],need:function(p){return p.period*2;},
    sig:function(A,p){var m=ema(A.c,p.period),a=atr(A.h,A.l,A.c,p.atr);return machine(A.n,function(i){return isF(m[i])&&isF(a[i])&&A.c[i]>m[i]+p.mult*a[i];},function(i){return isF(m[i])&&A.c[i]<m[i];});}});

  /* — Hồi quy về trung bình (quá bán/quá mua) — */
  def({id:'rsi',label:'RSI quá bán → hồi phục',short:'RSI',group:'Quá mua / quá bán',desc:'Mua khi RSI cắt lên ngưỡng quá bán (30); bán khi RSI ≥ 70 hoặc rơi lại dưới 30 (RSI14).',
    p:[['period',14,2,100,1],['low',30,5,45,1],['high',70,55,95,1]],grid:[{period:14,low:30,high:70},{period:14,low:25,high:65},{period:7,low:30,high:70}],need:function(p){return p.period*3;},
    sig:function(A,p){var r=rsi(A.c,p.period);return machine(A.n,function(i){return lu(r,p.low,i);},function(i){return isF(r[i])&&(r[i]>=p.high||ld(r,p.low,i));});}});
  def({id:'rsix',label:'RSIx: RSI quá bán sâu → hồi phục (25/70)',short:'RSIx',group:'Quá mua / quá bán',desc:'Như RSI hồi phục nhưng chỉ mua khi quá bán sâu hơn: mua khi RSI cắt lên 25; bán khi RSI ≥ 70 hoặc rơi lại dưới 25 (RSI14). Ít lệnh hơn (~1,5 lệnh/năm) nên phí ít ăn mòn.',
    p:[['period',14,2,100,1],['low',25,5,45,1],['high',70,55,95,1]],grid:[{period:14,low:25,high:70},{period:14,low:20,high:70},{period:14,low:30,high:70}],need:function(p){return p.period*3;},
    sig:function(A,p){var r=rsi(A.c,p.period);return machine(A.n,function(i){return lu(r,p.low,i);},function(i){return isF(r[i])&&(r[i]>=p.high||ld(r,p.low,i));});}});
  def({id:'rsi50',label:'RSI cắt mốc 50 (động lượng)',short:'RSI50',group:'Quá mua / quá bán',desc:'Mua khi RSI cắt lên 50; bán khi cắt xuống 50 (RSI14).',
    p:[['period',14,2,100,1],['mid',50,40,60,1]],grid:[{period:14,mid:50},{period:10,mid:50},{period:21,mid:50}],need:function(p){return p.period*3;},
    sig:function(A,p){var r=rsi(A.c,p.period);return machine(A.n,function(i){return lu(r,p.mid,i);},function(i){return ld(r,p.mid,i);});}});
  def({id:'stoch',label:'Stochastic %K cắt %D vùng quá bán',short:'Stoch',group:'Quá mua / quá bán',desc:'Mua khi %K cắt lên %D ở vùng < 20; bán khi %K cắt xuống %D ở vùng > 80 (14,3,3).',
    p:[['period',14,3,100,1],['k',3,1,20,1],['d',3,1,20,1]],grid:[{period:14,k:3,d:3},{period:9,k:3,d:3},{period:21,k:5,d:3}],need:function(p){return p.period+p.k+p.d+2;},
    sig:function(A,p){var H=hh(A.h,p.period),L=ll(A.l,p.period),raw=A.c.map(function(v,i){var r=H[i]-L[i];return isF(r)?(r>0?100*(v-L[i])/r:50):NaN;}),K=sma(raw,p.k),D=sma(K,p.d);
      return machine(A.n,function(i){return cu(K,D,i)&&K[i]<20;},function(i){return cd(K,D,i)&&K[i]>80;});}});
  def({id:'cci',label:'CCI cắt lên −100',short:'CCI',group:'Quá mua / quá bán',desc:'Mua khi CCI cắt lên −100; bán khi CCI cắt xuống +100 hoặc rơi lại dưới −100 (20).',
    p:[['period',20,5,100,1],['lv',100,50,200,1]],grid:[{period:14,lv:100},{period:20,lv:100},{period:30,lv:100}],need:function(p){return p.period*2;},
    sig:function(A,p){var tp=A.h.map(function(h,i){return (h+A.l[i]+A.c[i])/3;}),m=sma(tp,p.period),cci=fill(A.n,NaN);for(var i=p.period-1;i<A.n;i++){var dv=0;for(var k=i-p.period+1;k<=i;k++)dv+=Math.abs(tp[k]-m[i]);dv/=p.period;cci[i]=dv>0?(tp[i]-m[i])/(0.015*dv):0;}
      return machine(A.n,function(i){return lu(cci,-p.lv,i);},function(i){return ld(cci,p.lv,i)||ld(cci,-p.lv,i);});}});
  def({id:'willr',label:'Williams %R hồi phục từ −80',short:'%R',group:'Quá mua / quá bán',desc:'Mua khi %R cắt lên −80; bán khi %R ≥ −20 hoặc rơi lại dưới −80 (14).',
    p:[['period',14,3,100,1]],grid:[{period:10},{period:14},{period:21}],need:function(p){return p.period+3;},
    sig:function(A,p){var H=hh(A.h,p.period),L=ll(A.l,p.period),w=A.c.map(function(v,i){var r=H[i]-L[i];return isF(r)?(r>0?-100*(H[i]-v)/r:-50):NaN;});
      return machine(A.n,function(i){return lu(w,-80,i);},function(i){return isF(w[i])&&(w[i]>=-20||ld(w,-80,i));});}});
  def({id:'bollrev',label:'Bollinger: hồi phục từ dải dưới',short:'BB hồi quy',group:'Quá mua / quá bán',desc:'Mua khi giá đóng cửa quay lại trên dải dưới; bán khi chạm đường giữa hoặc thủng lại dải dưới (20, 2σ).',
    p:[['period',20,5,200,1],['k',2,0.5,4,0]],grid:[{period:20,k:2},{period:20,k:2.5},{period:30,k:2}],need:function(p){return p.period+2;},
    sig:function(A,p){var m=sma(A.c,p.period),s=stdev(A.c,p.period),lo=m.map(function(v,i){return v-p.k*s[i];});return machine(A.n,function(i){return cu(A.c,lo,i);},function(i){return isF(m[i])&&(A.c[i]>=m[i]||cd(A.c,lo,i));});}});
  def({id:'mfi',label:'MFI quá bán → hồi phục (có khối lượng)',short:'MFI',group:'Quá mua / quá bán',desc:'Mua khi MFI cắt lên 20; bán khi MFI ≥ 80 hoặc rơi lại dưới 20 (14). Cần dữ liệu khối lượng.',
    p:[['period',14,3,100,1],['low',20,5,40,1],['high',80,60,95,1]],grid:[{period:14,low:20,high:80},{period:10,low:20,high:80},{period:14,low:25,high:75}],need:function(p){return p.period+3;},
    sig:volRule(function(A,p){var tp=A.h.map(function(h,i){return (h+A.l[i]+A.c[i])/3;}),m=fill(A.n,NaN);
      for(var i=p.period;i<A.n;i++){var pos=0,neg=0;for(var k=i-p.period+1;k<=i;k++){var f=tp[k]*A.v[k];if(tp[k]>tp[k-1])pos+=f;else if(tp[k]<tp[k-1])neg+=f;}m[i]=neg===0?(pos===0?50:100):100-100/(1+pos/neg);}
      return machine(A.n,function(i){return lu(m,p.low,i);},function(i){return isF(m[i])&&(m[i]>=p.high||ld(m,p.low,i));});})});

  /* — Động lượng — */
  def({id:'roc',label:'ROC cắt mốc 0',short:'ROC',group:'Động lượng',desc:'Mua khi tốc độ thay đổi giá N phiên chuyển dương; bán khi chuyển âm (12).',
    p:[['period',12,2,200,1]],grid:[{period:10},{period:12},{period:25}],need:function(p){return p.period+2;},
    sig:function(A,p){var r=A.c.map(function(v,i){return i>=p.period?(v/A.c[i-p.period]-1)*100:NaN;});return machine(A.n,function(i){return lu(r,0,i);},function(i){return ld(r,0,i);});}});
  def({id:'ao',label:'Awesome Oscillator cắt mốc 0',short:'AO',group:'Động lượng',desc:'Mua khi AO (SMA5−SMA34 của giá trung bình) chuyển dương; bán khi chuyển âm.',
    p:[['fast',5,2,50,1],['slow',34,5,200,1]],grid:[{fast:5,slow:34},{fast:5,slow:21},{fast:8,slow:34}],need:function(p){return p.slow+2;},
    sig:function(A,p){var md=A.h.map(function(h,i){return (h+A.l[i])/2;}),ao=sub(sma(md,p.fast),sma(md,p.slow));return machine(A.n,function(i){return lu(ao,0,i);},function(i){return ld(ao,0,i);});}});
  def({id:'trix',label:'TRIX cắt đường tín hiệu',short:'TRIX',group:'Động lượng',desc:'Mua khi TRIX cắt lên đường tín hiệu; bán khi cắt xuống (15, 9).',
    p:[['period',15,3,100,1],['signal',9,2,50,1]],grid:[{period:12,signal:9},{period:15,signal:9},{period:21,signal:9}],need:function(p){return p.period*4+p.signal;},
    sig:function(A,p){var e3=ema(ema(ema(A.c,p.period),p.period),p.period),tx=e3.map(function(v,i){return i&&isF(v)&&isF(e3[i-1])&&e3[i-1]!==0?(v/e3[i-1]-1)*100:NaN;});return crossRule(tx,sma(tx,p.signal));}});
  def({id:'tsi',label:'TSI cắt đường tín hiệu',short:'TSI',group:'Động lượng',desc:'Mua khi True Strength Index cắt lên đường tín hiệu; bán khi cắt xuống (25, 13, 7).',
    p:[['long',25,5,100,1],['short',13,2,50,1],['signal',7,2,50,1]],grid:[{long:25,short:13,signal:7},{long:20,short:10,signal:5}],need:function(p){return p.long+p.short+p.signal+5;},
    sig:function(A,p){var d=A.c.map(function(v,i){return i?v-A.c[i-1]:NaN;}),ad=d.map(function(v){return isF(v)?Math.abs(v):NaN;}),
      num=ema(ema(d,p.long),p.short),den=ema(ema(ad,p.long),p.short),t=num.map(function(v,i){return isF(v)&&isF(den[i])&&den[i]>0?100*v/den[i]:NaN;});return crossRule(t,ema(t,p.signal));}});

  /* — Khối lượng — (cần dữ liệu khối lượng đầy đủ) */
  function volRule(build,need){return function(A,p){if(A.v.some(function(v){return !isF(v);}))return none(A.n);return build(A,p);};}
  def({id:'cmf',label:'Chaikin Money Flow cắt mốc 0',short:'CMF',group:'Khối lượng',desc:'Mua khi dòng tiền Chaikin chuyển dương; bán khi chuyển âm (20).',
    p:[['period',20,3,100,1]],grid:[{period:14},{period:20},{period:30}],need:function(p){return p.period+2;},
    sig:volRule(function(A,p){var n=A.n,mv=fill(n,NaN),cmf=fill(n,NaN),i;for(i=0;i<n;i++){var r=A.h[i]-A.l[i];mv[i]=r>0?((A.c[i]-A.l[i])-(A.h[i]-A.c[i]))/r*A.v[i]:0;}
      for(i=p.period-1;i<n;i++){var sm=0,sv=0;for(var k=i-p.period+1;k<=i;k++){sm+=mv[k];sv+=A.v[k];}cmf[i]=sv>0?sm/sv:0;}return machine(n,function(i){return lu(cmf,0,i);},function(i){return ld(cmf,0,i);});})});
  def({id:'obv',label:'OBV cắt SMA của OBV',short:'OBV',group:'Khối lượng',desc:'Mua khi OBV cắt lên đường trung bình của nó; bán khi cắt xuống (SMA20).',
    p:[['period',20,3,200,1]],grid:[{period:10},{period:20},{period:40}],need:function(p){return p.period+2;},
    sig:volRule(function(A,p){var obv=fill(A.n,0);for(var i=1;i<A.n;i++)obv[i]=obv[i-1]+(A.c[i]>A.c[i-1]?A.v[i]:A.c[i]<A.c[i-1]?-A.v[i]:0);return crossRule(obv,sma(obv,p.period));})});
  def({id:'vwap',label:'Giá cắt VWAP cuộn',short:'VWAP',group:'Khối lượng',desc:'Mua khi giá đóng vượt lên VWAP N phiên; bán khi xuống dưới (20).',
    p:[['period',20,3,200,1]],grid:[{period:10},{period:20},{period:50}],need:function(p){return p.period+2;},
    sig:volRule(function(A,p){var n=A.n,vw=fill(n,NaN);for(var i=p.period-1;i<n;i++){var pv=0,sv=0;for(var k=i-p.period+1;k<=i;k++){pv+=(A.h[k]+A.l[k]+A.c[k])/3*A.v[k];sv+=A.v[k];}if(sv>0)vw[i]=pv/sv;}return crossRule(A.c,vw);})});
  def({id:'force',label:'Force Index (EMA) cắt mốc 0',short:'Force',group:'Khối lượng',desc:'Mua khi Elder Force Index (EMA) chuyển dương; bán khi chuyển âm (13).',
    p:[['period',13,2,100,1]],grid:[{period:7},{period:13},{period:21}],need:function(p){return p.period+3;},
    sig:volRule(function(A,p){var fi=A.c.map(function(v,i){return i?(v-A.c[i-1])*A.v[i]:NaN;}),e=ema(fi,p.period);return machine(A.n,function(i){return lu(e,0,i);},function(i){return ld(e,0,i);});})});

  var BY={};DEFS.forEach(function(d){BY[d.id]=d;});
  var GROUPS=['Xu hướng','Phá vỡ & kênh','Quá mua / quá bán','Động lượng','Khối lượng'];

  /* ---------- tham số ---------- */
  function num(v){var x=typeof v==='string'?parseFloat(v):v;return isF(x)?x:null;}
  function normParams(d,user){
    var out={};user=user||{};
    d.p.forEach(function(s){var v=num(user[s[0]]);if(v===null)v=s[1];v=Math.min(s[3],Math.max(s[2],v));out[s[0]]=s[4]?Math.round(v):v;});
    if(out.fast!==undefined&&out.slow!==undefined&&out.fast>=out.slow){d.p.forEach(function(s){if(s[0]==='fast'||s[0]==='slow')out[s[0]]=s[1];});}
    return out;
  }
  function effectiveParams(id,all,legacy){
    var d=BY[id];if(!d)return null;var u=Object.assign({},(all&&all[id])||{});
    if(legacy){if(id==='sma'){if(legacy.smaFast!=null&&u.fast==null)u.fast=legacy.smaFast;if(legacy.smaSlow!=null&&u.slow==null)u.slow=legacy.smaSlow;}if(id==='breakout'&&legacy.breakoutLookback!=null&&u.lookback==null)u.lookback=legacy.breakoutLookback;}
    return normParams(d,u);
  }

  /* ---------- tổ hợp ---------- */
  function holdState(sig){var n=sig.buy.length,st=new Array(n),on=false;for(var i=0;i<n;i++){if(sig.buy[i])on=true;else if(sig.sell[i])on=false;st[i]=on;}return st;}
  function needVotes(mode,k,minVotes){if(mode==='all')return k;if(mode==='any')return 1;var m=num(minVotes);return Math.min(k,Math.max(1,m!==null?Math.round(m):Math.floor(k/2)+1));}
  /* cfg: {strategies:[id], combine:'all'|'any'|'vote', minVotes, stratParams:{id:{..}}, smaFast.. (tương thích cũ)} */
  function compose(c,cfg){
    var ids=(cfg.strategies||[]).filter(function(id){return BY[id];}),n=c.length,A=arrs(c);
    if(!ids.length)return none(n);
    var states=ids.map(function(id){var p=effectiveParams(id,cfg.stratParams,cfg);return holdState(BY[id].sig(A,p));});
    var need=needVotes(cfg.combine,ids.length,cfg.minVotes),on=fill(n,false),buy=fill(n,false),sell=fill(n,false);
    for(var i=0;i<n;i++){var cnt=0;for(var s=0;s<states.length;s++)if(states[s][i])cnt++;on[i]=cnt>=need;if(i){buy[i]=on[i]&&!on[i-1];sell[i]=!on[i]&&on[i-1];}}
    return {buy:buy,sell:sell,members:ids};
  }
  function warm(cfg){var w=0;(cfg.strategies||[]).forEach(function(id){var d=BY[id];if(!d)return;var p=effectiveParams(id,cfg.stratParams,cfg);w=Math.max(w,d.need(p));});return w;}
  function grid(id){var d=BY[id];return d?d.grid.map(function(g){var o={};o[id]=g;return {stratParams:o};}):[];} // mỗi phần tử trộn thẳng vào opts của lõi mô phỏng
  function label(ids,combine,minVotes){
    ids=(ids||[]).filter(function(i){return BY[i];});if(!ids.length)return '';
    if(ids.length===1)return BY[ids[0]].label;
    var names=ids.map(function(i){return BY[i].short;}).join(' + ');
    var k=needVotes(combine,ids.length,minVotes);
    return (combine==='all'?'Đồng thuận tất cả':combine==='any'?'Bất kỳ':'≥'+k+'/'+ids.length+' phiếu')+': '+names;
  }
  function describe(cfg){return (cfg.strategies||[]).filter(function(id){return BY[id];}).map(function(id){return {id:id,label:BY[id].label,params:effectiveParams(id,cfg.stratParams,cfg)};});}

  /* ---------- giao diện chọn nhiều công cụ ---------- */
  function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  function pickerHTML(prefix,selected){
    selected=selected&&selected.length?selected:['sma'];
    var body=GROUPS.map(function(g){return '<div class="nhip-strat-group"><b>'+esc(g)+'</b>'+DEFS.filter(function(d){return d.group===g;}).map(function(d){return '<label title="'+esc(d.desc)+'"><input type="checkbox" value="'+d.id+'"'+(selected.indexOf(d.id)>=0?' checked':'')+'><span>'+esc(d.label)+'</span></label>';}).join('')+'</div>';}).join('');
    return '<div class="nhip-strat" id="'+prefix+'-strat" data-prefix="'+prefix+'"><details class="nhip-strat-box"><summary id="'+prefix+'-strat-sum">'+esc(summaryText(selected,'all'))+'</summary><div class="nhip-strat-list">'+body+'</div></details>'+
      '<label class="nhip-strat-comb">Cách kết hợp<select id="'+prefix+'-combine"><option value="all">Đồng thuận tất cả (AND)</option><option value="vote">Đa số phiếu (&gt;50%)</option><option value="any">Bất kỳ công cụ nào (OR)</option></select></label>'+
      '<small class="source-note nhip-strat-note">Chọn 1 công cụ = chạy riêng. Chọn nhiều = mua/bán theo cách kết hợp. Tổ hợp dùng tham số mặc định, không tối ưu lại trong walk-forward.</small></div>';
  }
  function summaryText(ids,combine){return ids.length===1?'Chiến lược: '+(BY[ids[0]]?BY[ids[0]].label:ids[0]):'Chiến lược: '+ids.length+' công cụ ('+(combine==='all'?'AND':combine==='any'?'OR':'đa số')+')';}
  function readPicker(prefix){
    var root=document.getElementById(prefix+'-strat'),ids=[];
    if(root)Array.prototype.forEach.call(root.querySelectorAll('input[type=checkbox]:checked'),function(i){ids.push(i.value);});
    if(!ids.length)ids=['sma'];
    var sel=document.getElementById(prefix+'-combine');
    return {strategies:ids,strategy:ids.length===1?ids[0]:'combo',combine:sel?sel.value:'all'};
  }
  if(typeof document!=='undefined'&&document.addEventListener){
    document.addEventListener('change',function(e){var t=e.target,root=t&&t.closest?t.closest('.nhip-strat'):null;if(!root)return;var p=root.getAttribute('data-prefix'),r=readPicker(p),sum=document.getElementById(p+'-strat-sum');if(sum)sum.textContent=summaryText(r.strategies,r.combine);});
  }

  W.NHIPStrategies={version:'1.1',DEFS:DEFS,BY:BY,GROUPS:GROUPS,ids:function(){return DEFS.map(function(d){return d.id;});},normParams:normParams,effectiveParams:effectiveParams,
    compose:compose,warm:warm,grid:grid,label:label,describe:describe,pickerHTML:pickerHTML,readPicker:readPicker,needVotes:needVotes,
    _h:{sma:sma,ema:ema,rma:rma,wma:wma,stdev:stdev,rsi:rsi,atr:atr,holdState:holdState}};
})(typeof window!=='undefined'?window:globalThis);
