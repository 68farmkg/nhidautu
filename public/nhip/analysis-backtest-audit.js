/* NHIP Backtest Audit v2: đối chiếu kế toán, tuân thủ luật VN (lô, bước giá, biên độ, T+), cỡ mẫu và độ tập trung lợi nhuận.
   Đọc result.verification do lõi NHIPSim tính độc lập từ dữ liệu nến. Điểm là bộ quy tắc cảnh báo, không phải xác suất thành công. */
(function(){'use strict';
  var finite=function(v){return typeof v==='number'&&Number.isFinite(v);};
  function inspect(result){
    if(!result||!result.ready)return {ready:false,grade:'Chưa đánh giá',score:null,warnings:['Không có kết quả backtest hợp lệ để kiểm định.'],checks:[]};
    var trades=Array.isArray(result.tradeLog)?result.tradeLog:[],equity=Array.isArray(result.equityCurve)?result.equityCurve:[],v=result.verification||null;
    var warnings=[],checks=[],score=100,n=trades.length;
    function add(name,ok,detail,penalty,warn){checks.push({name:name,ok:!!ok,detail:detail});if(!ok){score-=penalty||0;if(warn)warnings.push(warn);}}
    add('Quy mô mẫu',n>=30,n+' giao dịch đóng',n<10?35:n<30?20:0,n<10?'Mẫu giao dịch rất nhỏ (<10); các chỉ số có thể bị chi phối bởi vài lệnh.':'Số giao dịch dưới 30; bằng chứng thống kê còn hạn chế.');
    if(n>=30&&n<50){score-=8;warnings.push('Số giao dịch từ 30 đến 49; nên tiếp tục kiểm thử ở giai đoạn khác.');}
    var pnl=trades.map(function(t){return finite(t.pnl)?t.pnl:Number(t.returnPct);}).filter(Number.isFinite),wins=pnl.filter(function(x){return x>0;}).sort(function(a,b){return b-a;});
    var gw=wins.reduce(function(a,b){return a+b;},0),top1=gw>0?wins[0]/gw*100:null,top3=gw>0?wins.slice(0,3).reduce(function(a,b){return a+b;},0)/gw*100:null;
    if(top1!==null&&top1>=50){score-=20;warnings.push('Một giao dịch tạo ra ít nhất 50% tổng lãi gộp; kết quả phụ thuộc nhiều vào lệnh tốt nhất.');}
    else if(top1!==null&&top1>=30){score-=10;warnings.push('Lệnh tốt nhất chiếm từ 30% tổng lãi gộp; cần xem độ phụ thuộc vào giao dịch lớn.');}
    if(top3!==null&&top3>=75){score-=10;warnings.push('Ba giao dịch tốt nhất tạo ra ít nhất 75% tổng lãi gộp.');}
    checks.push({name:'Mức tập trung lợi nhuận',ok:top1===null||top1<30,detail:top1===null?'Chưa có giao dịch thắng':'Lệnh tốt nhất chiếm '+top1.toFixed(1)+'%; top 3 chiếm '+top3.toFixed(1)+'%'});
    var malformed=trades.filter(function(t){return !Number.isFinite(Number(t.returnPct))||!(Number(t.entryPrice)>0)||!(Number(t.exitPrice)>0);}).length;
    add('Tính đầy đủ nhật ký',malformed===0,malformed?'Có '+malformed+' giao dịch thiếu/không hợp lệ':'Các trường giá và lợi suất hợp lệ',malformed?30:0,malformed?'Nhật ký giao dịch có bản ghi thiếu/không hợp lệ.':'');
    var eqOk=equity.length>0&&equity.every(function(x){return Number.isFinite(Number(x.value))&&Number(x.value)>=0;});
    add('Đường vốn',eqOk,equity.length+' điểm đường vốn',eqOk?0:25,eqOk?'':'Đường vốn trống hoặc có giá trị không hợp lệ.');
    if(v){
      add('Đối chiếu kế toán',v.accountingOk,v.accountingOk?'Vốn cuối = vốn đầu + tổng lãi/lỗ lệnh + cổ tức (sai số '+Math.abs(v.accountingResidual).toExponential(1)+')':'Lệch '+v.accountingResidual+' giữa vốn cuối và tổng lãi/lỗ',v.accountingOk?0:40,v.accountingOk?'':'Kế toán không khớp: kết quả không đáng tin.');
      add('Không âm tiền mặt',!v.negativeCash,v.negativeCash?'Tiền mặt từng âm':'Tiền mặt không âm trong suốt kỳ',v.negativeCash?30:0,v.negativeCash?'Mô phỏng dùng quá số tiền hiện có.':'');
      add('Thứ tự giao dịch',!v.orderViolations&&!v.badNumbers,(v.orderViolations+v.badNumbers)?(v.orderViolations+v.badNumbers)+' lệnh bất thường':'Vào trước ra, số liệu hữu hạn',(v.orderViolations+v.badNumbers)?35:0,(v.orderViolations+v.badNumbers)?'Có giao dịch sai thứ tự hoặc số liệu không hợp lệ.':'');
      var vn=result.vnRules!==false;
      if(vn){
        add('Lô giao dịch',!v.lotViolations,v.lotViolations?v.lotViolations+' lệnh sai lô':'Mọi lệnh là bội số lô',v.lotViolations?20:0,v.lotViolations?'Có lệnh không phải bội số lô.':'');
        add('Bước giá',!v.tickViolations,v.tickViolations?v.tickViolations+' mức giá sai bước giá':'Mọi giá khớp đúng bước giá',v.tickViolations?15:0,v.tickViolations?'Có giá khớp không đúng bước giá.':'');
        add('Biên độ giá',!v.limitViolations,v.limitViolations?v.limitViolations+' giá khớp vượt trần/sàn':'Mọi giá khớp trong biên độ',v.limitViolations?25:0,v.limitViolations?'Có giá khớp vượt biên độ trần/sàn.':'');
        add('Khóa bán T+',!v.settlementViolations,v.settlementViolations?v.settlementViolations+' lệnh bán trước khi cổ phiếu về':'Không có lệnh bán sớm hơn chu kỳ thanh toán',v.settlementViolations?30:0,v.settlementViolations?'Có lệnh bán trước khi cổ phiếu về tài khoản (vi phạm T+).':'');
      }else warnings.push('Đã tắt luật thị trường VN: kết quả này chỉ để đối chiếu, không phản ánh khả năng giao dịch thực tế.');
      if(v.exposureBreaches)add('Giới hạn tỷ trọng',false,v.exposureBreaches+' lệnh vượt tỷ trọng tối đa',15,'Có lệnh vượt tỷ trọng tối đa mỗi vị thế.');
      if(!v.positionCapOk)add('Số vị thế tối đa',false,'Đạt '+v.maxConcurrent+' vị thế',20,'Vượt số vị thế tối đa.');
    }else{warnings.push('Kết quả không kèm báo cáo kiểm chứng của lõi mô phỏng (có thể là dữ liệu cũ); chưa kiểm được luật VN và kế toán.');score-=10;}
    if(result.testBars!=null&&result.trainBars!=null&&result.count!=null){var ok=result.trainBars+result.testBars===result.count;add('Phân tách huấn luyện/ngoài mẫu',ok,'Khởi động '+result.trainBars+' nến; ngoài mẫu '+result.testBars+' nến',ok?0:30,ok?'':'Số nến khởi động và ngoài mẫu không khớp tổng.');}
    else if(result.commonStart&&result.commonEnd)checks.push({name:'Khoảng thời gian ngoài mẫu chung',ok:String(result.commonStart)<=String(result.commonEnd),detail:'Từ '+result.commonStart+' đến '+result.commonEnd});
    warnings.push('Tín hiệu đọc ở nến đã đóng và khớp ở nến kế tiếp là quy tắc khai báo; việc không rò rỉ tương lai được kiểm bằng bộ test riêng (tests/run-tests.js: cắt và phá dữ liệu tương lai), không suy ra được chỉ từ kết quả này.');
    warnings.push('Điểm kiểm định là bộ quy tắc cảnh báo heuristic, không phải xác suất chiến lược thành công hay chứng nhận đầu tư.');
    score=Math.max(0,Math.min(100,score));
    var grade=score>=80?'Tương đối tốt · vẫn cần kiểm chứng':score>=55?'Cần rà soát':'Bằng chứng yếu';
    return {ready:true,score:score,grade:grade,trades:n,topWinContributionPct:top1,top3WinContributionPct:top3,warnings:warnings,checks:checks};
  }
  function toCSV(report){
    if(!report)return '';var rows=[['metric','status','detail'],['Điểm kiểm định',report.score==null?'':report.score,report.grade||'']];
    (report.checks||[]).forEach(function(x){rows.push([x.name,x.ok?'Đạt':'Cần rà soát',x.detail]);});(report.warnings||[]).forEach(function(x,i){rows.push(['Cảnh báo '+(i+1),'Lưu ý',x]);});
    var esc=function(v){var s=v==null?'':String(v);return /[",\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;};return rows.map(function(r){return r.map(esc).join(',');}).join('\r\n');
  }
  window.NHIPBacktestAudit={inspect:inspect,toCSV:toCSV};
})();
