/* NHIP Validate v1.0 (V2.71 · Giai đoạn 3) — kiểm chứng bộ chấm điểm kỹ thuật theo TỪNG SÀN bằng dữ liệu, không bằng niềm tin.
   Có hai nguồn bằng chứng, luôn tách bạch:
   (1) REPLAY LỊCH SỬ: chấm lại điểm tại các ngày trong quá khứ chỉ bằng nến đến hết ngày đó (không nhìn trước), rồi đo lợi suất thực tế sau 5/20 phiên.
       Hạn chế: bộ trọng số do con người đặt trước và đã được nhìn thấy dữ liệu thị trường nói chung → đây là bằng chứng "trong lịch sử", không phải ngoài mẫu thật.
   (2) NHẬT KÝ TÍN HIỆU THẬT: ghi điểm tại thời điểm app chấm, sau đó mới đo kết quả khi đủ phiên. Đây là bằng chứng ngoài mẫu thật nhưng tích lũy chậm.
   Quy ước thực thi (khớp luật Việt Nam): tín hiệu ở nến đã đóng; mua ở giá MỞ cửa phiên kế tiếp; bán ở giá ĐÓNG cửa sau h phiên (h ≥ 5 nên đã qua T+2).
   Phiên kế tiếp mở cửa tại trần hoặc không có khối lượng → coi là KHÔNG MUA ĐƯỢC, loại khỏi thống kê lợi suất (đếm riêng).
   Thống kê: IC Spearman theo từng ngày trong cùng sàn (trung hòa thị trường), lợi suất vượt trung bình ngày, nhóm điểm, độ ổn định theo giai đoạn, t-stat có hiệu chỉnh chồng lấn.
   Mọi ngưỡng (CFG.valid, phí) là QUY ƯỚC khởi điểm, calibrated:false. Không bao giờ tự đổi trọng số của bộ chấm: chỉ ĐỀ XUẤT và kiểm lại bằng walk-forward.
   Hàm thuần, chạy được trong trình duyệt và Node (kiểm thử). */
(function (W) {
  'use strict';
  var VERSION = '1.0';
  var CFG = {
    horizons: [5, 20], primary: 20,
    step: 5,              /* lấy mẫu ngày tín hiệu mỗi 5 phiên để giảm chồng lấn */
    warm: 60,             /* cần ≥60 nến trước ngày tín hiệu (SMA50, MACD) */
    minCross: 8,          /* số mã tối thiểu trong cùng sàn/cùng ngày để tính IC và lợi suất vượt */
    costPct: 0.6,         /* phí khứ hồi giả định: phí 0,15%×2 + thuế bán 0,1% + trượt giá 0,1%×2 */
    quint: 0.2,
    liqUniverseMin: 5,
    valid: { minNodata: 50, minDatesNodata: 10, minObs: 300, minEffN: 12, minT: 2, minPosFoldShare: 0.75, folds: 4 },
    log: { cap: 6000, keep: 'nhip.signals.v1', summary: 'nhip.validate.summary.v1', throttleMs: 300000, priceTol: 0.01 },
    calibrated: false
  };
  var COMP = ['trend', 'momentum', 'volume', 'relative', 'entry', 'liquidity'];
  var BANDS = [['Yếu', -Infinity, 50], ['Trung tính', 50, 65], ['Khá', 65, 80], ['Mạnh', 80, Infinity]];
  var STATUS = { validated: 'Đã kiểm chứng (lịch sử)', experimental: 'Đang thử nghiệm', noedge: 'Chưa thấy lợi thế', inverse: 'Ngược chiều', nodata: 'Chưa đủ dữ liệu', untested: 'Chưa kiểm chứng' };

  /* ---------- tiện ích thống kê ---------- */
  function fin(x) { return typeof x === 'number' ? isFinite(x) : (x !== null && x !== undefined && x !== '' && isFinite(Number(x))); }
  function num(x) { return fin(x) ? Number(x) : null; }
  function mean(a) { if (!a.length) return null; var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s / a.length; }
  function sd(a) { if (a.length < 2) return null; var m = mean(a), s = 0; for (var i = 0; i < a.length; i++) s += (a[i] - m) * (a[i] - m); return Math.sqrt(s / (a.length - 1)); }
  function median(a) { if (!a.length) return null; var b = a.slice().sort(function (x, y) { return x - y; }), n = b.length; return n % 2 ? b[(n - 1) / 2] : (b[n / 2 - 1] + b[n / 2]) / 2; }
  function pctile(sorted, p) { if (!sorted.length) return null; var k = (sorted.length - 1) * p, lo = Math.floor(k), hi = Math.ceil(k); return sorted[lo] + (sorted[hi] - sorted[lo]) * (k - lo); }
  function rankAvg(a) {
    var idx = a.map(function (v, i) { return i; }).sort(function (i, j) { return a[i] - a[j]; }), r = new Array(a.length), i = 0;
    while (i < idx.length) { var j = i; while (j + 1 < idx.length && a[idx[j + 1]] === a[idx[i]]) j++; var rk = (i + j) / 2 + 1; for (var k = i; k <= j; k++) r[idx[k]] = rk; i = j + 1; }
    return r;
  }
  function spearman(x, y) {
    if (x.length !== y.length || x.length < 3) return null;
    var rx = rankAvg(x), ry = rankAvg(y), mx = mean(rx), my = mean(ry), sxy = 0, sxx = 0, syy = 0;
    for (var i = 0; i < rx.length; i++) { sxy += (rx[i] - mx) * (ry[i] - my); sxx += (rx[i] - mx) * (rx[i] - mx); syy += (ry[i] - my) * (ry[i] - my); }
    return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : null;
  }
  /* t-stat của trung bình chuỗi theo ngày; số mẫu độc lập hiệu dụng = số ngày × min(1, bước/h) vì lợi suất h phiên của các ngày gần nhau chồng lấn */
  function effN(nDates, step, h) { return Math.max(1, Math.floor(nDates * Math.min(1, step / h))); }
  function tstat(vals, nEff) { var s = sd(vals); if (vals.length < 3 || s === null || s <= 0) return null; return mean(vals) / (s / Math.sqrt(nEff)); }
  function r4(x) { return x === null || x === undefined || !isFinite(x) ? null : Math.round(x * 1e4) / 1e4; }
  function X() { return W.NHIPExchange; }
  function R() { return W.NHIPRating; }

  /* ---------- ngày ---------- */
  function dkey(t) {
    var ms;
    if (t === null || t === undefined || t === '') return '';
    if (typeof t === 'number') ms = t < 1e11 ? t * 1000 : t;
    else if (t instanceof Date) ms = t.getTime();
    else { var s = String(t); if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10); var n = Number(s); ms = isFinite(n) ? (n < 1e11 ? n * 1000 : n) : Date.parse(s); }
    return isFinite(ms) ? new Date(ms + 7 * 3600e3).toISOString().slice(0, 10) : '';
  }
  function shiftDate(d, k) { var t = Date.parse(d + 'T00:00:00Z') + k * 86400000; return new Date(t).toISOString().slice(0, 10); }
  function prevWeekday(d) { var x = shiftDate(d, -1), w = new Date(Date.parse(x + 'T00:00:00Z')).getUTCDay(); if (w === 0) return shiftDate(x, -2); if (w === 6) return shiftDate(x, -1); return x; }
  /* Ngày của dữ liệu đóng cửa gần nhất tại thời điểm `now` (giờ Việt Nam). Trong phiên (9:00–15:10 ngày thường) dữ liệu chưa chốt → intraday:true, không dùng để thống kê. */
  function signalDate(now) {
    var v = new Date((now == null ? Date.now() : now) + 7 * 3600e3), date = v.toISOString().slice(0, 10), dow = v.getUTCDay(), min = v.getUTCHours() * 60 + v.getUTCMinutes();
    if (dow === 0) return { date: shiftDate(date, -2), intraday: false };
    if (dow === 6) return { date: shiftDate(date, -1), intraday: false };
    if (min < 9 * 60) return { date: prevWeekday(date), intraday: false };
    if (min < 15 * 60 + 10) return { date: date, intraday: true };
    return { date: date, intraday: false };
  }

  /* ---------- nến & chỉ báo (chỉ dùng hàm nhân quả: giá trị tại i chỉ phụ thuộc nến ≤ i) ---------- */
  function clean(raw) {
    var o = [], seen = {};
    (Array.isArray(raw) ? raw : []).forEach(function (x) {
      if (!x) return;
      var q = { open: +x.open, high: +x.high, low: +x.low, close: +x.close, volume: x.volume == null || x.volume === '' ? NaN : +x.volume, time: x.time != null ? x.time : x.timestamp };
      q.d = dkey(q.time);
      if (q.d && [q.open, q.high, q.low, q.close].every(function (v) { return typeof v === 'number' && isFinite(v); }) && q.high >= q.low && q.close > 0) o.push(q);
    });
    o.sort(function (a, b) { return a.d < b.d ? -1 : a.d > b.d ? 1 : 0; });
    var out = []; o.forEach(function (q) { if (seen[q.d] !== undefined) out[seen[q.d]] = q; else { seen[q.d] = out.length; out.push(q); } });
    return out;
  }
  function prep(c) {
    var ST = W.NHIPStrategies, H = ST && ST._h; if (!H) return null;
    var cl = c.map(function (x) { return x.close; }), hi = c.map(function (x) { return x.high; }), lo = c.map(function (x) { return x.low; });
    var e12 = H.ema(cl, 12), e26 = H.ema(cl, 26), line = cl.map(function (_, i) { return isFinite(e12[i]) && isFinite(e26[i]) ? e12[i] - e26[i] : NaN; });
    return { s20: H.sma(cl, 20), s50: H.sma(cl, 50), rsi: H.rsi(cl, 14), line: line, sig: H.ema(line, 9), atr: H.atr(hi, lo, cl, 14) };
  }
  function ok(v) { return typeof v === 'number' && isFinite(v); }
  /* Dòng dữ liệu tại nến i — cùng các trường mà Xếp hạng kỹ thuật dùng (xem nhip-evidence-auto.js: snapshot) */
  function rowAt(P, c, i, sym, ex) {
    var L = c[i], pv = c[i - 1], vs = [];
    for (var k = Math.max(0, i - 19); k <= i; k++) if (ok(c[k].volume)) vs.push(c[k].volume);
    var s20 = P.s20[i], s50 = P.s50[i], m = P.line[i], sg = P.sig[i], a = P.atr[i];
    return {
      symbol: sym, exchange: ex, price: L.close, pct: pv ? (L.close / pv.close - 1) * 100 : null, volume: ok(L.volume) ? L.volume : null,
      avgVolume20: vs.length >= 15 ? mean(vs) : null, rsi14: ok(P.rsi[i]) ? P.rsi[i] : null, sma20: ok(s20) ? s20 : null, sma50: ok(s50) ? s50 : null,
      closeAboveSma20: ok(s20) ? L.close > s20 : null, sma20AboveSma50: ok(s20) && ok(s50) ? s20 > s50 : null, macdBullish: ok(m) && ok(sg) ? m > sg : null,
      atrPct: ok(a) && L.close > 0 ? a / L.close * 100 : null
    };
  }

  /* ---------- lợi suất sau tín hiệu ---------- */
  /* nt: phiên kế tiếp không mua được (mở cửa tại trần hoặc không có khối lượng). Trả null nếu chưa đủ nến cho phiên kế tiếp. */
  function entryState(c, i, ex) {
    if (i + 1 > c.length - 1) return null;
    var p = X() ? X().profile(ex) : null, band = p ? p.bandPct : 7, en = c[i + 1];
    var lock = (en.open / c[i].close - 1) * 100 >= band * 0.98, zero = ok(en.volume) && en.volume === 0;
    return { nt: lock || zero, lock: lock, zero: zero };
  }
  function fwdRet(c, i, h) { if (i + h > c.length - 1) return null; return (c[i + h].close / c[i + 1].open - 1) * 100; }
  function nextZero(c, i) { if (i + 5 > c.length - 1) return null; var z = 0; for (var k = i + 1; k <= i + 5; k++) { if (!ok(c[k].volume)) return null; if (c[k].volume === 0) z++; } return z; }

  /* ---------- 1. REPLAY LỊCH SỬ ---------- */
  /* universe: [{symbol, exchange?, candles}]; opts.indexCandles: {HOSE:[...], HNX:[...], UPCOM:[...]} (tùy chọn, dùng cho thành phần Sức mạnh tương đối) */
  function replay(universe, opts) {
    opts = opts || {};
    var Xe = X(), Ra = R(); if (!Xe || !Ra) return { ok: false, reason: 'Thiếu mô-đun hồ sơ sàn hoặc bộ chấm điểm.' };
    var step = opts.step || CFG.step, warm = opts.warm || CFG.warm, hs = opts.horizons || CFG.horizons, maxH = Math.max.apply(null, hs);
    var stat = { symbols: 0, skippedUnknownEx: 0, skippedShort: 0, noIndicator: 0 }, byEx = {};
    (universe || []).forEach(function (u) {
      var ex = Xe.resolve(u.symbol, u.exchange).ex;
      if (!ex) { stat.skippedUnknownEx++; return; }
      var c = clean(u.candles);
      if (c.length < warm + maxH + 2) { stat.skippedShort++; return; }
      var P = prep(c); if (!P) { stat.noIndicator++; return; }
      var map = {}; c.forEach(function (x, i) { map[x.d] = i; });
      (byEx[ex] = byEx[ex] || []).push({ sym: String(u.symbol).toUpperCase(), c: c, P: P, map: map }); stat.symbols++;
    });
    var idxPct = {}, relIncl = {};
    Object.keys(byEx).forEach(function (ex) {
      var ic = clean(opts.indexCandles && opts.indexCandles[ex]); relIncl[ex] = ic.length >= 30; idxPct[ex] = {};
      for (var k = 1; k < ic.length; k++) idxPct[ex][ic[k].d] = (ic[k].close / ic[k - 1].close - 1) * 100;
    });
    var obs = [], first = null, last = null;
    Object.keys(byEx).forEach(function (ex) {
      var list = byEx[ex], cnt = {};
      list.forEach(function (s) { for (var i = warm; i < s.c.length - 1; i++) cnt[s.c[i].d] = (cnt[s.c[i].d] || 0) + 1; });
      var dates = Object.keys(cnt).filter(function (d) { return cnt[d] >= CFG.minCross; }).sort(), picked = dates.filter(function (d, k) { return k % step === 0; });
      picked.forEach(function (d) {
        var rows = [];
        list.forEach(function (s) {
          var i = s.map[d]; if (i === undefined || i < warm || i + 1 > s.c.length - 1) return;
          var row = rowAt(s.P, s.c, i, s.sym, ex); rows.push({ s: s, i: i, row: row, value: (row.price || 0) * (row.volume || 0) });
        });
        if (rows.length < CFG.minCross) return;
        var vals = rows.map(function (r) { return r.value; }).filter(function (v) { return v > 0; }).sort(function (a, b) { return a - b; });
        rows.forEach(function (r) {
          var liq = r.value > 0 && vals.length >= CFG.liqUniverseMin ? vals.filter(function (v) { return v <= r.value; }).length / vals.length * 100 : null;
          var ev = Ra.evaluate(r.row, idxPct[ex][d] === undefined ? null : idxPct[ex][d], null, liq, ex); if (ev.score === null) return;
          var s = r.s, i = r.i, c = s.c, es = entryState(c, i, ex); if (!es) return;
          var lq = Xe.liquidity(c.slice(Math.max(0, i - 24), i + 1)), g = Xe.gate(ex, lq), p = {};
          ev.parts.forEach(function (q) { p[q.id] = r4(q.value); });
          var o = { s: s.sym, ex: ex, d: d, sc: r4(ev.score), p: p, g: g.status, av: lq ? Math.round(lq.avgValueVND) : null, nt: es.nt, nz: nextZero(c, i) };
          hs.forEach(function (h) { o['f' + h] = es.nt ? null : r4(fwdRet(c, i, h)); });
          obs.push(o); if (!first || d < first) first = d; if (!last || d > last) last = d;
        });
      });
    });
    return { ok: true, obs: obs, meta: { symbols: stat.symbols, skippedUnknownEx: stat.skippedUnknownEx, skippedShort: stat.skippedShort, noIndicator: stat.noIndicator, step: step, warm: warm, horizons: hs, costPct: opts.costPct == null ? CFG.costPct : opts.costPct, from: first, to: last, relativeIncluded: relIncl, scoreVersion: Ra.version, exVersion: Xe.version, at: new Date().toISOString(),
      parityNote: 'Replay không có dữ liệu ngành' + (Object.keys(relIncl).every(function (k) { return relIncl[k]; }) ? '' : ' và thiếu chỉ số của một số sàn') + ' nên thành phần "Sức mạnh tương đối" có thể thiếu so với điểm hiển thị trực tiếp.' } };
  }

  /* ---------- 2. THỐNG KÊ ---------- */
  function bandOf(s) { for (var i = 0; i < BANDS.length; i++) if (s >= BANDS[i][1] && s < BANDS[i][2]) return BANDS[i][0]; return BANDS[BANDS.length - 1][0]; }
  function groupBy(a, f) { var o = {}; a.forEach(function (x) { var k = f(x); (o[k] = o[k] || []).push(x); }); return o; }
  function metrics(list, h, o) {
    var key = 'f' + h, cost = o.costPct, rows = list.filter(function (x) { return ok(x[key]) && ok(x.sc); }), byD = groupBy(rows, function (x) { return x.d; }), ds = Object.keys(byD).sort();
    var ic = [], ics = [], sp = [], exAll = [], datesIC = [];
    ds.forEach(function (d) {
      var a = byD[d]; if (a.length < o.minCross) return;
      var m = mean(a.map(function (x) { return x[key]; })), v = spearman(a.map(function (x) { return x.sc; }), a.map(function (x) { return x[key]; }));
      a.forEach(function (x) { exAll.push({ b: bandOf(x.sc), e: x[key] - m, f: x[key] }); });
      if (v !== null) { ic.push(v); datesIC.push(d); }
      var q = Math.floor(a.length * CFG.quint); if (q >= 2) { var s = a.slice().sort(function (x, y) { return y.sc - x.sc; }); sp.push(mean(s.slice(0, q).map(function (x) { return x[key]; })) - mean(s.slice(-q).map(function (x) { return x[key]; }))); }
    });
    var nE = effN(ic.length, o.step, h), buckets = BANDS.map(function (b) {
      var xs = rows.filter(function (x) { return x.sc >= b[1] && x.sc < b[2]; }), ex = exAll.filter(function (x) { return x.b === b[0]; });
      return { band: b[0], n: xs.length, meanNet: xs.length ? r4(mean(xs.map(function (x) { return x[key]; })) - cost) : null, medianNet: xs.length ? r4(median(xs.map(function (x) { return x[key]; })) - cost) : null,
        hitPct: xs.length ? r4(xs.filter(function (x) { return x[key] - cost > 0; }).length / xs.length * 100) : null, meanExcess: ex.length ? r4(mean(ex.map(function (x) { return x.e; }))) : null };
    });
    var withEx = buckets.filter(function (b) { return b.n >= 20 && b.meanExcess !== null; }), mono = null;
    if (withEx.length >= 3) { var okc = 0; for (var k = 1; k < withEx.length; k++) if (withEx[k].meanExcess >= withEx[k - 1].meanExcess) okc++; mono = okc / (withEx.length - 1); }
    var K = o.folds, per = Math.floor(ic.length / K), folds = [];
    if (per >= 3) for (var f = 0; f < K; f++) { var seg = ic.slice(f * per, f === K - 1 ? ic.length : (f + 1) * per); folds.push({ from: datesIC[f * per], to: datesIC[(f === K - 1 ? ic.length : (f + 1) * per) - 1], nDates: seg.length, meanIC: r4(mean(seg)) }); }
    return { h: h, nObs: rows.length, nDates: ic.length, nEff: nE, meanIC: r4(mean(ic)), sdIC: r4(sd(ic)), tIC: r4(tstat(ic, nE)), spreadMean: r4(mean(sp)), spreadT: r4(tstat(sp, effN(sp.length, o.step, h))),
      topExcess: r4(mean(exAll.filter(function (x) { return x.b === 'Mạnh' || x.b === 'Khá'; }).map(function (x) { return x.e; }))), buckets: buckets, monotone: r4(mono), folds: folds,
      posFoldShare: folds.length ? r4(folds.filter(function (f) { return f.meanIC > 0; }).length / folds.length) : null, _ic: ic };
  }
  function judge(m20, m5, V) {
    var why = [];
    if (!m20 || m20.nDates < V.minDatesNodata || m20.nObs < V.minNodata) return { status: 'nodata', label: STATUS.nodata, reasons: ['Quá ít quan sát có kết quả sau 20 phiên (' + (m20 ? m20.nObs : 0) + ' quan sát, ' + (m20 ? m20.nDates : 0) + ' ngày).'] };
    if (m20.nObs < V.minObs || m20.nEff < V.minEffN) return { status: 'experimental', label: STATUS.experimental, reasons: ['Mẫu chưa đủ để kết luận: ' + m20.nObs + ' quan sát (cần ≥' + V.minObs + '), số ngày độc lập hiệu dụng ≈ ' + m20.nEff + ' (cần ≥' + V.minEffN + ').'] };
    if (m20.tIC !== null && m20.tIC <= -V.minT) return { status: 'inverse', label: STATUS.inverse, reasons: ['Điểm cao đi cùng lợi suất 20 phiên THẤP hơn (IC TB ' + m20.meanIC + ', t ≈ ' + m20.tIC + '). Không dùng điểm này để xếp hạng trên sàn này cho đến khi xem xét lại.'] };
    var pass = true;
    if (!(m20.tIC !== null && m20.tIC >= V.minT)) { pass = false; why.push('IC 20 phiên chưa đủ mạnh về thống kê (t ≈ ' + m20.tIC + ', cần ≥' + V.minT + ').'); }
    if (!(m20.posFoldShare !== null && m20.posFoldShare >= V.minPosFoldShare)) { pass = false; why.push('IC không ổn định giữa các giai đoạn (dương ở ' + (m20.posFoldShare === null ? '?' : Math.round(m20.posFoldShare * 100)) + '% giai đoạn, cần ≥' + Math.round(V.minPosFoldShare * 100) + '%).'); }
    if (!(m20.spreadMean !== null && m20.spreadMean > 0)) { pass = false; why.push('Nhóm điểm cao nhất không vượt nhóm thấp nhất sau 20 phiên.'); }
    if (!(m5 && m5.meanIC !== null && m5.meanIC > 0)) { pass = false; why.push('IC 5 phiên không dương, không nhất quán với 20 phiên.'); }
    return pass ? { status: 'validated', label: STATUS.validated, reasons: ['IC 20 phiên TB ' + m20.meanIC + ' (t ≈ ' + m20.tIC + '), ổn định ở ' + Math.round(m20.posFoldShare * 100) + '% giai đoạn, nhóm điểm cao vượt nhóm thấp. Đây là kết quả trong lịch sử đã tải, không đảm bảo tương lai.'] } : { status: 'noedge', label: STATUS.noedge, reasons: why };
  }

  /* IC từng thành phần điểm (xem thành phần nào thực sự mang thông tin) */
  function componentStats(list, h, o) {
    var key = 'f' + h, out = {};
    COMP.forEach(function (id) {
      var rows = list.filter(function (x) { return ok(x[key]) && x.p && ok(x.p[id]); }), byD = groupBy(rows, function (x) { return x.d; }), ics = [];
      Object.keys(byD).sort().forEach(function (d) { var a = byD[d]; if (a.length < o.minCross) return; var v = spearman(a.map(function (x) { return x.p[id]; }), a.map(function (x) { return x[key]; })); if (v !== null) ics.push(v); });
      var nE = effN(ics.length, o.step, h);
      out[id] = ics.length >= 5 ? { nDates: ics.length, meanIC: r4(mean(ics)), t: r4(tstat(ics, nE)) } : null;
    });
    return out;
  }
  function rescore(p, w) {
    var Ra = R(), used = 0, sum = 0; COMP.forEach(function (id) { if (p && ok(p[id]) && ok(w[id])) { used += w[id]; sum += w[id] * p[id]; } });
    if (!used) return null; var raw = sum / used, cov = used / Ra.CFG.total; return 50 + (raw - 50) * (Ra.CFG.shrink + (1 - Ra.CFG.shrink) * cov);
  }
  /* Đề xuất trọng số: chỉ nâng khi t ≥ 2, chỉ hạ khi t ≤ −2; còn lại giữ nguyên. Giữ tổng trọng số, co 50% về giá trị cũ. KHÔNG tự áp dụng. */
  function proposeWeights(cs) {
    var prior = R().CFG.weights, total = 0, raw = {}, ids = COMP.filter(function (id) { return ok(prior[id]); });
    ids.forEach(function (id) { total += prior[id]; var t = cs && cs[id] ? cs[id].t : null, f = t === null || t === undefined ? 1 : t >= 2 ? 1.25 : t <= -2 ? 0.5 : 1; raw[id] = prior[id] * f; });
    var rs = ids.reduce(function (a, id) { return a + raw[id]; }, 0), out = {};
    ids.forEach(function (id) { var norm = raw[id] / rs * total, w = prior[id] + 0.5 * (norm - prior[id]); out[id] = Math.round(w * 10) / 10; });
    var d = Math.round((total - ids.reduce(function (a, id) { return a + out[id]; }, 0)) * 10) / 10; if (d !== 0) { var big = ids.slice().sort(function (a, b) { return out[b] - out[a]; })[0]; out[big] = Math.round((out[big] + d) * 10) / 10; }
    return out;
  }
  /* Walk-forward: học đề xuất trên các giai đoạn trước, đo trên giai đoạn kế tiếp (chưa từng dùng để học) */
  function walkForward(list, o, h) {
    h = h || CFG.primary; var key = 'f' + h, ds = Object.keys(groupBy(list.filter(function (x) { return ok(x[key]); }), function (x) { return x.d; })).sort(), K = o.folds, per = Math.floor(ds.length / K);
    if (per < 3) return { ok: false, reason: 'Chưa đủ số ngày để chia ' + K + ' giai đoạn.' };
    var prior = R().CFG.weights, res = [];
    for (var k = 1; k < K; k++) {
      var trainSet = {}, testSet = {}; ds.slice(0, k * per).forEach(function (d) { trainSet[d] = 1; }); ds.slice(k * per, k === K - 1 ? ds.length : (k + 1) * per).forEach(function (d) { testSet[d] = 1; });
      var train = list.filter(function (x) { return trainSet[x.d]; }), test = list.filter(function (x) { return testSet[x.d] && ok(x[key]) && x.p; });
      var w = proposeWeights(componentStats(train, h, o)), byD = groupBy(test, function (x) { return x.d; }), a = [], b = [];
      Object.keys(byD).forEach(function (d) {
        var g = byD[d]; if (g.length < o.minCross) return;
        var y = g.map(function (x) { return x[key]; }), s0 = g.map(function (x) { var v = rescore(x.p, prior); return v === null ? x.sc : v; }), s1 = g.map(function (x) { var v = rescore(x.p, w); return v === null ? x.sc : v; });
        var i0 = spearman(s0, y), i1 = spearman(s1, y); if (i0 !== null && i1 !== null) { a.push(i0); b.push(i1); }
      });
      if (a.length >= 3) res.push({ fold: k + 1, nDates: a.length, baselineIC: r4(mean(a)), proposedIC: r4(mean(b)), delta: r4(mean(b) - mean(a)) });
    }
    var pos = res.filter(function (r) { return r.delta > 0; }).length, md = res.length ? mean(res.map(function (r) { return r.delta; })) : null;
    var full = proposeWeights(componentStats(list, h, o)), changed = Object.keys(full).some(function (id) { return Math.abs(full[id] - prior[id]) >= 0.5; });
    return { ok: res.length > 0, folds: res, meanDelta: r4(md), positiveFolds: pos, proposal: full, prior: prior, changed: changed,
      adopt: res.length >= 2 && changed && md > 0.005 && pos >= res.length - 1, note: 'Chỉ nên cân nhắc đổi trọng số khi "adopt" = true VÀ đã kiểm lại bằng nhật ký tín hiệu thật. Hệ thống không tự đổi trọng số.' };
  }
  /* Kiểm tra cổng thanh khoản của GĐ2 bằng kết quả thực: nhóm bị cảnh báo có thật sự khó giao dịch hơn không */
  function gateCheck(list) {
    var by = groupBy(list, function (x) { return x.g || 'unknown'; }), out = {};
    Object.keys(by).forEach(function (k) {
      var a = by[k], nz = a.filter(function (x) { return ok(x.nz); }), f5 = a.filter(function (x) { return ok(x.f5); });
      out[k] = { n: a.length, noTradeNextPct: r4(a.filter(function (x) { return x.nt; }).length / a.length * 100), zeroVolNextPct: nz.length ? r4(nz.filter(function (x) { return x.nz > 0; }).length / nz.length * 100) : null, meanAbsF5: f5.length ? r4(mean(f5.map(function (x) { return Math.abs(x.f5); }))) : null };
    });
    var z = function (k) { return out[k] && out[k].zeroVolNextPct !== null ? out[k].zeroVolNextPct : null; }, worse = null;
    if (z('ok') !== null && (z('blocked') !== null || z('caution') !== null)) worse = Math.max(z('blocked') === null ? -1 : z('blocked'), z('caution') === null ? -1 : z('caution')) > z('ok');
    return { groups: out, warnedAreWorse: worse };
  }
  function liqProfile(list, target) {
    var a = list.filter(function (x) { return ok(x.av) && ok(x.nz); }).sort(function (x, y) { return x.av - y.av; }); if (a.length < 100) return { ok: false, reason: 'Cần ≥100 quan sát có thanh khoản và khối lượng 5 phiên kế tiếp.' };
    var av = a.map(function (x) { return x.av; }), dist = { p10: pctile(av, 0.1), p25: pctile(av, 0.25), p50: pctile(av, 0.5), p75: pctile(av, 0.75) }, sug = null;
    for (var q = 0.05; q <= 0.9; q += 0.05) { var cut = pctile(av, q), suf = a.filter(function (x) { return x.av >= cut; }); if (suf.length >= 50 && suf.filter(function (x) { return x.nz > 0; }).length / suf.length <= (target || 0.02)) { sug = cut; break; } }
    return { ok: true, dist: dist, suggestedMinAvgValueVND: sug === null ? null : Math.round(sug), targetZeroShare: target || 0.02, note: 'Ngưỡng gợi ý = mức giá trị giao dịch TB20 thấp nhất mà từ đó trở lên hiếm khi gặp phiên không khối lượng ở 5 phiên kế tiếp. Chỉ tham khảo, chưa tự áp dụng.' };
  }

  function summarize(obs, opts) {
    opts = opts || {}; var o = { step: opts.step || CFG.step, minCross: opts.minCross || CFG.minCross, costPct: opts.costPct == null ? CFG.costPct : opts.costPct, folds: opts.folds || CFG.valid.folds }, out = { byEx: {}, opts: o, at: new Date().toISOString() };
    var by = groupBy(obs || [], function (x) { return x.ex; });
    Object.keys(by).forEach(function (ex) {
      var list = by[ex], m5 = metrics(list, 5, o), m20 = metrics(list, 20, o), j = judge(m20, m5, CFG.valid);
      out.byEx[ex] = { ex: ex, nObs: list.length, status: j.status, label: j.label, reasons: j.reasons, h5: m5, h20: m20, components: { h20: componentStats(list, 20, o), h5: componentStats(list, 5, o) }, walkForward: walkForward(list, o, 20), gate: gateCheck(list), liquidity: liqProfile(list), lockedOrNoTradePct: list.length ? r4(list.filter(function (x) { return x.nt; }).length / list.length * 100) : null };
    });
    return out;
  }
  function strip(sum) { /* bỏ chuỗi IC thô trước khi lưu/hiển thị */ Object.keys(sum.byEx).forEach(function (k) { delete sum.byEx[k].h5._ic; delete sum.byEx[k].h20._ic; }); return sum; }

  /* ---------- 3. LƯU TÓM TẮT & HUY HIỆU ---------- */
  var _store = null;
  function store() { if (_store) return _store; try { return W.localStorage || null; } catch (e) { return null; } }
  function setStorage(s) { _store = s; }
  function readJSON(k, d) { try { var s = store(); var v = s ? JSON.parse(s.getItem(k) || 'null') : null; return v === null ? d : v; } catch (e) { return d; } }
  function writeJSON(k, v) { try { var s = store(); if (!s) return false; s.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function saveSummary(kind, sum, meta) {
    var all = readJSON(CFG.log.summary, {}), rec = all[kind] || {};
    Object.keys(sum.byEx).forEach(function (ex) { var e = sum.byEx[ex]; rec[ex] = { status: e.status, label: e.label, at: sum.at, nObs: e.nObs, meanIC20: e.h20.meanIC, t20: e.h20.tIC, from: meta && meta.from || null, to: meta && meta.to || null, scoreVersion: meta && meta.scoreVersion || (R() && R().version), exVersion: meta && meta.exVersion || (X() && X().version) }; });
    all[kind] = rec; return writeJSON(CFG.log.summary, all);
  }
  /* Trạng thái hiển thị cho một sàn. Nếu bộ chấm/hồ sơ sàn đã đổi phiên bản sau lần kiểm chứng → coi như chưa kiểm chứng lại (stale). */
  function badge(ex) {
    ex = X() ? X().normEx(ex) : ex; var all = readJSON(CFG.log.summary, {}), h = all.hist && all.hist[ex], l = all.log && all.log[ex], cur = R() && X() ? { s: R().version, e: X().version } : null;
    function fix(r) { if (!r) return null; var stale = !!cur && (r.scoreVersion !== cur.s || r.exVersion !== cur.e); return { status: stale && r.status === 'validated' ? 'experimental' : r.status, label: stale && r.status === 'validated' ? STATUS.experimental : (STATUS[r.status] || r.label), stale: stale, at: r.at, nObs: r.nObs }; }
    var hh = fix(h), ll = fix(l), use = ll && ll.status === 'validated' ? ll : hh || ll;
    if (!use) return { status: 'untested', label: STATUS.untested, title: 'Bộ chấm điểm của ' + (ex || 'sàn này') + ' chưa được kiểm chứng bằng dữ liệu. Điểm chỉ là phán đoán có nguyên tắc.', hist: hh, log: ll };
    return { status: use.status, label: use.label, title: (use === ll ? 'Theo nhật ký tín hiệu thật' : 'Theo replay lịch sử') + (use.stale ? ' (bộ chấm đã đổi sau lần kiểm chứng này — cần chạy lại)' : '') + ' · ' + (use.nObs || 0) + ' quan sát.', hist: hh, log: ll };
  }

  /* ---------- 4. NHẬT KÝ TÍN HIỆU THẬT ---------- */
  var _lastLog = 0;
  function readLog() { var a = readJSON(CFG.log.keep, []); return Array.isArray(a) ? a : []; }
  function writeLog(a) { if (a.length > CFG.log.cap) { a.sort(function (x, y) { return x.d < y.d ? 1 : x.d > y.d ? -1 : 0; }); a = a.slice(0, CFG.log.cap); } return writeJSON(CFG.log.keep, a); }
  /* rows: kết quả NHIPRating.rank(). Chỉ ghi khi dữ liệu là cuối ngày (không ghi giữa phiên) và sàn đã xác định. */
  function logRank(rows, now) {
    var Xe = X(), Ra = R(); if (!Xe || !Ra || !rows || !rows.length) return { logged: 0, reason: 'no-rows' };
    var t = now == null ? Date.now() : now; if (now == null && t - _lastLog < CFG.log.throttleMs) return { logged: 0, reason: 'throttled' };
    var sd_ = signalDate(t); if (sd_.intraday) return { logged: 0, reason: 'intraday' };
    _lastLog = t; var log = readLog(), have = {}, added = 0; log.forEach(function (e, i) { have[e.id] = i; });
    rows.forEach(function (r) {
      var s = r && r.stock; if (!s || r.score === null) return; var ex = Xe.resolve(s.symbol, s.exchange || s.floor).ex; if (!ex) return;
      var illiq = (r.flags || []).filter(function (f) { return f.id === 'illiquid'; })[0], p = {}; (r.parts || []).forEach(function (q) { p[q.id] = r4(q.value); });
      var e = { id: s.symbol + '|' + sd_.date, s: String(s.symbol).toUpperCase(), ex: ex, d: sd_.date, sc: r4(r.score), p: p, g: illiq ? (illiq.gate ? 'blocked' : 'caution') : 'ok', av: Xe.avgValueOfRow(s) === null ? null : Math.round(Xe.avgValueOfRow(s)), px: Number(s.price), sv: Ra.version, ev: Xe.version };
      if (have[e.id] !== undefined) { if (log[have[e.id]].f20 === undefined && log[have[e.id]].f5 === undefined) { log[have[e.id]] = e; added++; } } else { log.push(e); added++; }
    });
    if (added) writeLog(log); return { logged: added, date: sd_.date };
  }
  /* Điền kết quả cho các dòng nhật ký đã đủ phiên. candlesBySym: {SYM: candles}. */
  function settleLog(candlesBySym, opts) {
    var log = readLog(), changed = 0, mism = 0, wait = 0, cache = {};
    log.forEach(function (e) {
      if (e.f20 !== undefined && e.nz !== undefined) return;
      var raw = candlesBySym && candlesBySym[e.s]; if (!raw) return;
      var c = cache[e.s] || (cache[e.s] = (function () { var cc = clean(raw), m = {}; cc.forEach(function (x, i) { m[x.d] = i; }); return { c: cc, m: m }; })()), i = c.m[e.d];
      if (i === undefined) return;
      if (ok(e.px) && Math.abs(c.c[i].close / e.px - 1) > CFG.log.priceTol) { e.bad = 1; mism++; return; }
      var es = entryState(c.c, i, e.ex); if (!es) { wait++; return; }
      e.nt = es.nt; if (e.nz === undefined) { var z = nextZero(c.c, i); if (z !== null) e.nz = z; }
      [5, 20].forEach(function (h) { if (e['f' + h] === undefined) { var v = es.nt ? null : fwdRet(c.c, i, h); if (v !== null || es.nt) { if (i + h <= c.c.length - 1) e['f' + h] = r4(v); } } });
      changed++;
    });
    if (changed || mism) writeLog(log); return { changed: changed, priceMismatch: mism, waiting: wait, total: log.length };
  }
  function logObs() { return readLog().filter(function (e) { return !e.bad && ok(e.sc); }).map(function (e) { return { s: e.s, ex: e.ex, d: e.d, sc: e.sc, p: e.p, g: e.g, av: e.av, nt: !!e.nt, nz: e.nz === undefined ? null : e.nz, f5: e.f5 === undefined ? null : e.f5, f20: e.f20 === undefined ? null : e.f20 }; }); }
  function logStats() {
    var l = readLog(), by = groupBy(l, function (e) { return e.ex; }), out = { total: l.length, byEx: {} };
    Object.keys(by).forEach(function (k) { var a = by[k]; out.byEx[k] = { n: a.length, days: Object.keys(groupBy(a, function (e) { return e.d; })).length, settled5: a.filter(function (e) { return e.f5 !== undefined; }).length, settled20: a.filter(function (e) { return e.f20 !== undefined; }).length, unsettledSymbols: Object.keys(groupBy(a.filter(function (e) { return e.f20 === undefined && !e.bad; }), function (e) { return e.s; })) }; });
    return out;
  }
  function clearLog() { try { var s = store(); if (s) s.removeItem(CFG.log.keep); return true; } catch (e) { return false; } }

  function toCSV(obs) {
    var cols = ['symbol', 'exchange', 'date', 'score', 'trend', 'momentum', 'volume', 'relative', 'entry', 'liquidity', 'gate', 'avgValueVND', 'notTradableNext', 'zeroVolNext5', 'fwd5Pct', 'fwd20Pct'];
    return [cols.join(',')].concat((obs || []).map(function (o) { var p = o.p || {}; return [o.s, o.ex, o.d, o.sc, p.trend, p.momentum, p.volume, p.relative, p.entry, p.liquidity, o.g, o.av, o.nt ? 1 : 0, o.nz, o.f5, o.f20].map(function (v) { return v === null || v === undefined ? '' : v; }).join(','); })).join('\r\n');
  }

  W.NHIPValidate = { version: VERSION, CFG: CFG, COMP: COMP, BANDS: BANDS, STATUS: STATUS,
    dkey: dkey, signalDate: signalDate, clean: clean, prep: prep, rowAt: rowAt, entryState: entryState, fwdRet: fwdRet, nextZero: nextZero,
    spearman: spearman, effN: effN, tstat: tstat, replay: replay, metrics: metrics, judge: judge, componentStats: componentStats, rescore: rescore, proposeWeights: proposeWeights, walkForward: walkForward, gateCheck: gateCheck, liqProfile: liqProfile,
    summarize: summarize, strip: strip, saveSummary: saveSummary, badge: badge, setStorage: setStorage, logRank: logRank, settleLog: settleLog, logObs: logObs, logStats: logStats, clearLog: clearLog, toCSV: toCSV };
})(typeof window !== 'undefined' ? window : globalThis);
