/* NHIP Technical Rank v2.1 (V2.69: biết SÀN — chuẩn hóa biến động ngày theo biên độ sàn, xếp hạng thanh khoản trong cùng sàn, chỉ số tham chiếu theo sàn, cờ thanh khoản/trần/sàn; HOSE giữ nguyên kết quả cũ) — MỘT bộ chấm điểm duy nhất cho: Xếp hạng kỹ thuật, Top 5 ứng viên, 5 mã cần quan tâm (Dashboard),
   điểm xếp hạng trong Tổng hợp bằng chứng và các tín hiệu RSI/khối lượng ở phần Phân tích. Tất định, minh bạch, chỉ dùng trường dữ liệu có sẵn.
   Điểm cao = cấu trúc kỹ thuật thuận lợi hơn (KHÔNG phải xác suất tăng giá). Trọng số/ngưỡng là phán đoán có nguyên tắc, chưa fit từ dữ liệu. */
(function (W) {
  'use strict';
  var VERSION = '2.2';
  var CFG = {
    weights: { trend: 20, momentum: 16, volume: 12, relative: 12, entry: 10, liquidity: 5 }, total: 75,
    support: 65, against: 40,            /* điểm thành phần ≥65 → Ủng hộ; ≤40 → Phản bác; còn lại Trung lập (dùng chung mọi nơi) */
    shrink: 0.5,                         /* điểm lệch khỏi 50 được co theo độ phủ: phủ 100% giữ nguyên, phủ 0% còn 50% độ lệch */
    minLiquidityUniverse: 5,
    maxPenalty: 15,
    flags: {                             /* chỉ phạt phần điểm gốc KHÔNG phản ánh; tổng phạt bị chặn ở maxPenalty */
      overbought: { penalty: 6, text: 'RSI cao, có thể quá mua' },
      oversold: { penalty: 0, text: 'RSI yếu/quá bán; cần xác nhận hồi phục' },
      spike: { penalty: 8, text: 'Biến động phiên rất lớn' },
      drop: { penalty: 6, text: 'Giá giảm mạnh trong phiên' },
      extended: { penalty: 5, text: 'Giá cách xa SMA20 (>10%), dễ đuổi giá' },
      lowvol: { penalty: 0, text: 'Khối lượng thấp hơn một nửa TB20' },
      downtrend: { penalty: 0, gate: true, text: 'Giá dưới SMA20 và SMA20 dưới SMA50 (xu hướng giảm)' }
    }
  };
  var K = {
    rsi: [[20, 12], [30, 25], [40, 42], [50, 72], [55, 90], [65, 90], [68, 72], [70, 62], [75, 50], [80, 36], [90, 20], [100, 12]],
    part: [[0.3, 0], [0.8, 0.3], [1.2, 0.55], [2, 1], [3, 0.85], [5, 0.5]],
    ext: [[-15, 15], [-8, 30], [-3, 50], [0, 75], [3, 95], [6, 75], [10, 40], [15, 15], [25, 5]],
    day: [[-7, 10], [-4, 25], [-2, 45], [0, 60], [1, 75], [2.5, 85], [4, 75], [6, 45], [7, 25]]
  };
  function fin(x) { return x !== null && x !== undefined && x !== '' && isFinite(Number(x)); }
  function clamp(x, a, b) { a = a == null ? 0 : a; b = b == null ? 100 : b; return Math.max(a, Math.min(b, x)); }
  function interp(k, x) { if (x <= k[0][0]) return k[0][1]; for (var i = 1; i < k.length; i++) if (x <= k[i][0]) { var a = k[i - 1], b = k[i]; return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]); } return k[k.length - 1][1]; }

  /* ---------- các hàm điểm thành phần (0–100, cao = thuận lợi) ---------- */
  function rsiScore(r) { return fin(r) ? interp(K.rsi, Number(r)) : null; }
  function trendScore(above20, s20over50) {
    var a = typeof above20 === 'boolean', b = typeof s20over50 === 'boolean';
    if (a && b) return (above20 ? 55 : 0) + (s20over50 ? 45 : 0);
    if (a) return above20 ? 65 : 20;
    if (b) return s20over50 ? 65 : 20;
    return null;
  }
  function momentumScore(rsi, macdBull) {
    var m = rsiScore(rsi);
    if (typeof macdBull === 'boolean') m = m === null ? (macdBull ? 75 : 30) : m * 0.65 + (macdBull ? 100 : 10) * 0.35;
    return m;
  }
  /* KL/TB: so với trung bình của các nến CÒN LẠI trong cửa sổ (loại nến hiện tại) — avg20 gồm cả nến hiện tại nên suy ngược: (n·avg − KL)/(n−1). */
  function volRatio(volume, avg, n) {
    if (!fin(volume) || !fin(avg) || Number(avg) <= 0 || Number(volume) < 0) return null;
    n = n || 20; var v = Number(volume), base = (n * Number(avg) - v) / (n - 1);
    return base > 0 ? v / base : v / Number(avg);
  }
  function volRatioSeries(vols) {
    if (!vols || !vols.length) return null; var cur = vols[vols.length - 1], w = vols.slice(-20).filter(fin).map(Number); if (!fin(cur) || w.length < 15) return null;
    return volRatio(cur, w.reduce(function (a, b) { return a + b; }, 0) / w.length, w.length);
  }
  /* Khối lượng CÓ HƯỚNG: KL lớn kèm giá tăng = xác nhận; KL lớn kèm giá giảm = phân phối (xấu). Không có hướng → không chấm. */
  function volScore(vr, pct) {
    if (!fin(vr) || !fin(pct)) return null;
    var p = interp(K.part, Number(vr)), dir = clamp(Number(pct) / 2, -1, 1);
    return clamp(50 + dir * (50 * p - 10));
  }
  function entryScore(extPct, pct) {
    var e = fin(extPct) ? interp(K.ext, Number(extPct)) : null, d = fin(pct) ? interp(K.day, Number(pct)) : null;
    return e !== null && d !== null ? 0.6 * e + 0.4 * d : e !== null ? e : d;
  }
  function verdict(v) { return v === null || v === undefined || !isFinite(v) ? 'neutral' : v >= CFG.support ? 'support' : v <= CFG.against ? 'against' : 'neutral'; }
  function band(s) { return s >= 80 ? 'Mạnh' : s >= 65 ? 'Khá' : s >= 50 ? 'Trung tính' : 'Yếu'; }
  function f1(v, d) { return Number(v).toFixed(d == null ? 1 : d); }

  /* ---------- chấm một mã ---------- */
  function evaluate(s, indexPct, sectorPct, liqPct, ex) {
    s = s || {}; var parts = [], reasons = [], cautions = [], flags = [], W_ = CFG.weights;
    var X = W.NHIPExchange, xr = X ? X.resolve(s.symbol, ex || s.exchange || s.floor) : { ex: '', known: false }, exId = xr.ex, kx = X ? X.scale(exId) : 1;
    function part(id, name, v, detail) { if (v !== null && v !== undefined && isFinite(v)) { v = clamp(v); parts.push({ id: id, name: name, weight: W_[id], value: v, verdict: verdict(v), detail: detail || '' }); return v; } return null; }
    var rsi = fin(s.rsi14) ? Number(s.rsi14) : null, pct = fin(s.pct) ? Number(s.pct) : null, pctN = pct === null ? null : pct * kx;
    var tv = trendScore(s.closeAboveSma20, s.sma20AboveSma50);
    if (part('trend', 'Xu hướng', tv, (s.closeAboveSma20 === true ? 'giá trên SMA20' : s.closeAboveSma20 === false ? 'giá dưới SMA20' : '') + (typeof s.sma20AboveSma50 === 'boolean' ? (s.closeAboveSma20 !== undefined && s.closeAboveSma20 !== null ? '; ' : '') + (s.sma20AboveSma50 ? 'SMA20 trên SMA50' : 'SMA20 dưới SMA50') : '')) !== null) {
      if (s.closeAboveSma20 === true) reasons.push('Giá trên SMA20'); if (s.sma20AboveSma50 === true) reasons.push('SMA20 trên SMA50');
      if (tv < 40) cautions.push('Cấu trúc xu hướng chưa thuận lợi');
    }
    var mv = momentumScore(rsi, s.macdBullish);
    if (part('momentum', 'Động lượng', mv, (rsi !== null ? 'RSI14 ' + f1(rsi) : '') + (typeof s.macdBullish === 'boolean' ? (rsi !== null ? '; ' : '') + (s.macdBullish ? 'MACD trên Signal' : 'MACD dưới Signal') : '')) !== null) {
      if (rsi !== null && rsiScore(rsi) >= CFG.support) reasons.push('RSI14 ' + f1(rsi) + ' (vùng động lượng tích cực)');
      if (s.macdBullish === true) reasons.push('MACD trên Signal');
    }
    var vr = volRatio(s.volume, s.avgVolume20, 20), vv = volScore(vr, pctN);
    if (part('volume', 'Khối lượng', vv, vr === null ? '' : f1(vr, 2) + '× TB' + (pct === null ? '' : (pct >= 0 ? ' · giá tăng' : ' · giá giảm'))) !== null) {
      if (vv >= CFG.support) reasons.push('Khối lượng ' + f1(vr, 2) + '× TB20 kèm giá tăng (xác nhận)');
      if (vv <= CFG.against && vr >= 1.2) cautions.push('Khối lượng ' + f1(vr, 2) + '× TB20 kèm giá giảm (phân phối)');
    }
    var diffs = []; if (pct !== null && fin(indexPct)) diffs.push((pct - Number(indexPct)) * kx); if (pct !== null && fin(sectorPct)) diffs.push((pct - Number(sectorPct)) * kx);
    if (diffs.length) { var d = diffs.reduce(function (a, b) { return a + b; }, 0) / diffs.length; if (part('relative', 'Sức mạnh tương đối', clamp(50 + d * 12), (d >= 0 ? '+' : '') + f1(d, 2) + ' điểm % so với thị trường/ngành' + (kx !== 1 ? ' (đã quy chuẩn theo biên độ ' + exId + ')' : '')) !== null && d > 0) reasons.push('Mạnh hơn thị trường/ngành trong phiên'); }
    var ext = fin(s.sma20) && Number(s.sma20) > 0 && fin(s.price) ? (Number(s.price) / Number(s.sma20) - 1) * 100 : null;
    part('entry', 'Rủi ro/điểm vào', entryScore(ext, pctN), (ext !== null ? 'cách SMA20 ' + (ext >= 0 ? '+' : '') + f1(ext, 1) + '%' : '') + (pct !== null ? (ext !== null ? '; ' : '') + 'phiên ' + (pct >= 0 ? '+' : '') + f1(pct, 2) + '%' : ''));
    if (fin(liqPct)) part('liquidity', 'Thanh khoản tương đối', Number(liqPct), 'phân vị giá trị giao dịch trong rổ');
    /* cờ rủi ro (chuẩn hóa, dùng cho Top 5): cùng ngưỡng ở mọi nơi */
    function flag(id) { flags.push({ id: id, text: CFG.flags[id].text, penalty: CFG.flags[id].penalty, gate: !!CFG.flags[id].gate }); }
    if (rsi !== null && rsi >= 75) flag('overbought'); else if (rsi !== null && rsi < 35) flag('oversold');
    if (pctN !== null && Math.abs(pctN) >= 6) flag('spike');
    if (pctN !== null && pctN < -3) flag('drop');
    var atrP = fin(s.atrPct) && Number(s.atrPct) > 0 ? Number(s.atrPct) : null, extThr = atrP !== null ? clamp(3.5 * atrP, 6, 20) : 10; /* V2.70: ngưỡng "xa SMA20" theo biến động riêng của mã khi có ATR; không có ATR giữ 10% như cũ */
    if (ext !== null && ext > extThr) { flag('extended'); if (atrP !== null) flags[flags.length - 1].text = 'Giá cách SMA20 ' + f1(ext, 1) + '% (ngưỡng ' + f1(extThr, 1) + '% theo ATR ' + f1(atrP, 1) + '%/giá), dễ đuổi giá'; }
    if (vr !== null && vr < 0.5) flag('lowvol');
    if (s.closeAboveSma20 === false && s.sma20AboveSma50 === false) flag('downtrend');
    if (X && exId) X.rowFlags(s, exId).forEach(function (f) { flags.push({ id: f.id, text: f.text, penalty: f.penalty, gate: !!f.gate }); });
    var used = 0, sum = 0; parts.forEach(function (p) { used += p.weight; sum += p.weight * p.value; });
    var raw = used ? sum / used : null, cov = used / CFG.total, score = raw === null ? null : 50 + (raw - 50) * (CFG.shrink + (1 - CFG.shrink) * cov);
    var missing = []; ['trend', 'momentum', 'volume', 'relative', 'entry', 'liquidity'].forEach(function (id) { if (!parts.some(function (p) { return p.id === id; })) missing.push(id); });
    return { score: score, rawScore: raw, coverage: Math.round(cov * 100), weightUsed: used, parts: parts, reasons: reasons, cautions: cautions, flags: flags, volumeRatio: vr, ext: ext, band: score === null ? null : band(score), verdict: verdict(score), missing: missing, exchange: exId, exchangeKnown: !!exId, dayNorm: pctN, dayScale: kx };
  }

  /* ---------- xếp hạng cả rổ ---------- */
  var LAST = null;
  function rank(stocks, indices, sectors) {
    var X = W.NHIPExchange, sm = {}; (sectors || []).forEach(function (x) { sm[x.name] = x.pct; });
    var list = stocks || [], exOf = list.map(function (s) { return X ? X.resolve(s.symbol, s.exchange || s.floor).ex : ''; }), byEx = {};
    /* V2.69: phân vị thanh khoản chỉ tính TRONG CÙNG SÀN (trước đây gộp cả rổ nên UPCoM luôn đứng cuối, HOSE luôn đứng đầu) */
    list.forEach(function (s, i) { var v = (Number(s.price) || 0) * (Number(s.volume) || 0); if (v > 0) (byEx[exOf[i]] = byEx[exOf[i]] || []).push(v); });
    Object.keys(byEx).forEach(function (k) { byEx[k].sort(function (a, b) { return a - b; }); });
    var vnidx = (indices || []).find(function (x) { return x.symbol === 'VNINDEX'; });
    var rows = list.map(function (s, i) {
      var ex = exOf[i], vals = byEx[ex] || [], value = (Number(s.price) || 0) * (Number(s.volume) || 0), liq = value > 0 && vals.length >= CFG.minLiquidityUniverse ? vals.filter(function (v) { return v <= value; }).length / vals.length * 100 : null;
      var bm = X ? X.benchmark(ex, indices) : null; if (!bm && vnidx) bm = { symbol: 'VNINDEX', name: 'VN-Index', pct: vnidx.pct, fallback: false };
      var e = evaluate(s, bm && bm.pct, sm[s.sector], liq, ex); e.stock = s; e.value = value; e.benchmark = bm; e.liqGroup = ex || 'chưa rõ sàn'; e.liqGroupSize = vals.length;
      e.missing = e.missing.concat(['Hỗ trợ/kháng cự từ chuỗi nến', 'Mẫu hình giá']); return e;
    }).filter(function (x) { return x.score !== null; });
    rows.sort(function (a, b) { return b.score - a.score || b.coverage - a.coverage || b.value - a.value || String(a.stock.symbol).localeCompare(String(b.stock.symbol)); });
    var by = {}; rows.forEach(function (r, i) { r.rank = i + 1; by[r.stock.symbol] = r; });
    LAST = { at: Date.now(), n: rows.length, by: by, rows: rows };
    try { if (W.NHIPValidate && W.NHIPValidate.logRank) W.NHIPValidate.logRank(rows); } catch (e) { } /* V2.71: ghi nhật ký tín hiệu thật (chỉ dữ liệu cuối ngày, có throttle) — không ảnh hưởng điểm */
    return rows;
  }
  function remember(stocks, indices, sectors) { rank(stocks, indices, sectors); return LAST; }
  function lookup(sym, maxAgeMs) { return LAST && LAST.by[sym] && Date.now() - LAST.at <= (maxAgeMs == null ? 600000 : maxAgeMs) ? { row: LAST.by[sym], rank: LAST.by[sym].rank, of: LAST.n, at: LAST.at } : null; }

  W.NHIPRating = { version: VERSION, CFG: CFG, rsiScore: rsiScore, trendScore: trendScore, momentumScore: momentumScore, volRatio: volRatio, volRatioSeries: volRatioSeries, volScore: volScore, entryScore: entryScore, verdict: verdict, band: band, evaluate: evaluate, rank: rank, remember: remember, lookup: lookup };
  /* Tương thích API cũ: NHIPScore.rank/score/band */
  W.NHIPScore = { version: VERSION, rank: rank, score: function (s, i, sec) { return evaluate(s, i, sec); }, band: band };
})(typeof window !== 'undefined' ? window : globalThis);
