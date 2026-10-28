/* NHIP Candidate Scanner v2 — lọc rủi ro trên CÙNG bộ chấm điểm với Xếp hạng kỹ thuật (NHIPRating). Không tự chấm lại RSI/khối lượng/xu hướng:
   điểm gốc = điểm xếp hạng; chỉ áp cờ rủi ro chuẩn hóa (phạt nhỏ, chặn tổng) và cổng loại (xu hướng giảm). Không bịa dữ liệu OHLC/ATR không có. */
(function () {
  'use strict';
  var finite = function (v) { return v !== null && v !== undefined && Number.isFinite(Number(v)); };
  var clamp = function (x) { return Math.max(0, Math.min(100, x)); };
  /* Phán quyết ứng viên cho một dòng xếp hạng (dùng chung cho Top 5 và Tổng hợp bằng chứng) */
  function judge(x) {
    var C = window.NHIPRating ? window.NHIPRating.CFG : { maxPenalty: 15 }, penalty = 0, risks = [], gated = false;
    (x.flags || []).forEach(function (f) { penalty += f.penalty || 0; risks.push(f.text); if (f.gate) gated = true; });
    penalty = Math.min(C.maxPenalty, penalty);
    var adjusted = clamp(x.score - penalty);
    return { adjustedScore: adjusted, penalty: penalty, risks: risks, gated: gated, eligible: adjusted >= 50 && !gated };
  }
  function scan(stocks, indices, sectors, limit, minCoverage) {
    limit = limit == null ? 5 : limit; minCoverage = minCoverage == null ? 45 : minCoverage;
    if (!window.NHIPRating) return { ready: false, rows: [], excluded: [], message: 'Thiếu mô-đun chấm điểm kỹ thuật.' };
    var ranked = window.NHIPRating.rank(stocks || [], indices || [], sectors || []), eligible = [], excluded = [];
    ranked.forEach(function (x) {
      var s = x.stock;
      if (!finite(s.price) || Number(s.price) <= 0) { excluded.push({ stock: s, reason: 'Thiếu giá hợp lệ' }); return; }
      if (!finite(s.volume) || Number(s.volume) < 0) { excluded.push({ stock: s, reason: 'Thiếu khối lượng hợp lệ' }); return; }
      if (x.coverage < minCoverage) { excluded.push({ stock: s, reason: 'Độ phủ dữ liệu thấp (' + x.coverage + '%)' }); return; }
      var j = judge(x); eligible.push(Object.assign({}, x, { adjustedScore: j.adjustedScore, penalty: j.penalty, risks: j.risks, gated: j.gated, eligible: j.eligible }));
    });
    eligible.sort(function (a, b) { return b.adjustedScore - a.adjustedScore || b.score - a.score || b.coverage - a.coverage || String(a.stock.symbol).localeCompare(String(b.stock.symbol)); });
    var ok = eligible.filter(function (x) { return x.eligible; }), rows = ok.slice(0, Math.max(1, Math.min(20, limit))), gatedCount = eligible.filter(function (x) { return x.gated; }).length;
    return { ready: true, rows: rows, eligibleCount: ok.length, excludedCount: excluded.length, gatedCount: gatedCount, excluded: excluded.slice(0, 10), minCoverage: minCoverage,
      message: rows.length ? 'Xếp hạng ứng viên trong rổ dữ liệu hiện có (cùng bộ chấm điểm với Xếp hạng kỹ thuật).' : 'Chưa có mã đạt đồng thời ngưỡng độ phủ, điểm sàng lọc và cổng xu hướng' + (gatedCount ? ' (' + gatedCount + ' mã bị loại vì xu hướng giảm)' : '') + '.' };
  }
  window.NHIPCandidates = { version: '2.0', scan: scan, judge: judge };
})();
