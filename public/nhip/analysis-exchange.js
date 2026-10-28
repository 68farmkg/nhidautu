/* NHIP Exchange Profile v1.1 (V2.69 GĐ1 + V2.70 GĐ2: cổng thanh khoản cứng, chất lượng dữ liệu theo sàn, trạng thái chỉ số của sàn, mức giá khớp bước giá) — hồ sơ riêng cho HOSE / HNX / UPCoM, dùng chung cho Xếp hạng kỹ thuật, Top ứng viên và AI phân tích.
   Nguyên tắc:
   - Sàn của mã lấy từ danh bạ mã (NHIPSYM / NHIPOrders / symbols-vn.js). KHÔNG đoán: chưa rõ sàn → ex = "" và hệ thống không áp quy tắc riêng của sàn.
   - Biên độ và bước giá khớp với nhip-sim-core.js (HOSE ±7%, HNX ±10%, UPCoM ±15%; bước giá HOSE 10/50/100đ, HNX/UPCoM 100đ).
   - Ngưỡng thanh khoản (liq.*) là GIÁ TRỊ KHỞI ĐIỂM CHƯA HIỆU CHỈNH (calibrated:false). Giai đoạn 3 sẽ hiệu chỉnh bằng dữ liệu; đến lúc đó chỉ sửa tại file này.
   - Chỉ dùng dữ liệu có sẵn; không bịa số. Hàm thuần, chạy được cả trong trình duyệt lẫn Node (kiểm thử). */
(function (W) {
  'use strict';
  var VERSION = '1.1';
  var BASE_BAND = 7; /* biên độ chuẩn của thang điểm hiện có (đã hiệu chỉnh theo HOSE) */

  var PROFILES = {
    HOSE: {
      id: 'HOSE', name: 'HOSE', bandPct: 7, benchmark: ['VNINDEX', 'VN30'], benchmarkAlts: ['VNINDEX'], benchmarkName: 'VN-Index',
      liq: { minAvgValueVND: 2e9, thinDays: 2, hardFactor: 0.5, hardZeroRatio: 0.5 }, dq: { maxZeroRatio: 0.05, maxZeroStreak: 2 },
      aiNote: 'Sàn có thanh khoản cao nhất, nhóm vốn hóa lớn chịu ảnh hưởng mạnh của VN-Index/VN30; chỉ báo và vùng giá ở đây thường ổn định hơn so với HNX/UPCoM.',
      calibrated: false
    },
    HNX: {
      id: 'HNX', name: 'HNX', bandPct: 10, benchmark: ['HNX'], benchmarkAlts: ['HNX', 'HNXINDEX'], benchmarkName: 'HNX-Index',
      liq: { minAvgValueVND: 1e9, thinDays: 3, hardFactor: 0.5, hardZeroRatio: 0.5 }, dq: { maxZeroRatio: 0.15, maxZeroStreak: 3 },
      aiNote: 'Biên độ rộng hơn HOSE nên một phiên biến động mạnh chưa chắc bất thường; thanh khoản thường mỏng hơn HOSE, cần kiểm tra khả năng khớp lệnh.',
      calibrated: false
    },
    UPCOM: {
      id: 'UPCOM', name: 'UPCoM', bandPct: 15, benchmark: ['UPCOM'], benchmarkAlts: ['UPCOM', 'UPCOMINDEX'], benchmarkName: 'UPCoM-Index',
      liq: { minAvgValueVND: 3e8, thinDays: 5, hardFactor: 0.5, hardZeroRatio: 0.5 }, dq: { maxZeroRatio: 0.30, maxZeroStreak: 5 },
      aiNote: 'Biên độ rộng nhất, nhiều mã có phiên khối lượng rất thấp hoặc không giao dịch; mẫu hình nến, phá vỡ và chỉ báo kém tin cậy hơn khi khối lượng mỏng, và rủi ro không khớp được lệnh cao hơn.',
      calibrated: false
    }
  };
  var ORDER = ['HOSE', 'HNX', 'UPCOM'];

  function fin(x) { return x !== null && x !== undefined && x !== '' && isFinite(Number(x)); }
  function r6(x) { return Math.round(x * 1e6) / 1e6; }

  /* ---------- nhận diện sàn ---------- */
  function normEx(v) {
    v = String(v == null ? '' : v).toUpperCase().replace(/[^A-Z]/g, '');
    if (v === 'HOSE' || v === 'HSX' || v === 'HOSTC' || v === 'H') return 'HOSE';
    if (v === 'HNX' || v === 'HASTC' || v === 'N') return 'HNX';
    if (v === 'UPCOM' || v === 'UPCOMINDEX' || v === 'U') return 'UPCOM';
    return '';
  }
  var _map = null;
  function dictMap() {
    if (_map) return _map;
    _map = {};
    try { String((W.NHIP_SYMBOLS_VN || '')).split('\n').forEach(function (l) { var p = l.split('|'); if (p[0] && p[3]) { var e = normEx(p[3]); if (e) _map[p[0].trim().toUpperCase()] = e; } }); } catch (e) { }
    return _map;
  }
  /* Trả {ex, known, source}. Thứ tự: gợi ý trong dòng dữ liệu → danh bạ NHIPSYM → NHIPOrders (chọn tay/danh bạ) → symbols-vn.js. Không có → ex "" */
  function resolve(sym, hint) {
    var k = String(sym || '').toUpperCase(), e = normEx(hint);
    if (e) return { ex: e, known: true, source: 'dòng dữ liệu' };
    if (/^(VNINDEX|VN30|VN100|VNALL|VNMID|VNSML)$/.test(k)) return { ex: 'HOSE', known: true, source: 'chỉ số' };
    if (/^HNX\w*$/.test(k)) return { ex: 'HNX', known: true, source: 'chỉ số' };
    if (/^UPCOM\w*$/.test(k)) return { ex: 'UPCOM', known: true, source: 'chỉ số' };
    try { var i = W.NHIPSYM && W.NHIPSYM.info ? W.NHIPSYM.info(k) : null; e = normEx(i && i.floor); if (e) return { ex: e, known: true, source: 'danh bạ mã' }; } catch (x) { }
    try { var O = W.NHIPOrders; if (O && O.exKnown && O.exKnown(k) && O.effEx) { e = normEx(O.effEx(k)); if (e) return { ex: e, known: true, source: 'sàn đã chọn/danh bạ' }; } } catch (x) { }
    e = dictMap()[k]; if (e) return { ex: e, known: true, source: 'symbols-vn.js' };
    return { ex: '', known: false, source: 'chưa xác định' };
  }
  function profile(ex) { return PROFILES[normEx(ex)] || null; }
  /* Hệ số chuẩn hóa biến động ngày: 7/biên độ sàn (HOSE = 1). Chưa rõ sàn → 1 (giữ hành vi cũ). */
  function scale(ex) { var p = profile(ex); return p ? BASE_BAND / p.bandPct : 1; }
  /* % thay đổi quy về "đơn vị HOSE" để dùng chung thang điểm */
  function normPct(pct, ex) { return fin(pct) ? Number(pct) * scale(ex) : null; }

  /* ---------- giá: đơn vị, bước giá, trần/sàn ---------- */
  function unitOf(price) { return fin(price) && Number(price) > 0 && Number(price) < 1000 ? 1000 : 1; } /* giá nến thường là nghìn đồng */
  function tickVND(ex, pVND) { ex = normEx(ex); if (ex === 'HOSE') return pVND < 10000 ? 10 : pVND < 50000 ? 50 : 100; return 100; }
  function tickOf(ex, price, unit) { unit = unit || unitOf(price); return tickVND(ex, price * unit) / unit; }
  function ceilTick(p, t) { return r6(Math.ceil(p / t - 1e-9) * t); }
  function floorTick(p, t) { return r6(Math.floor(p / t + 1e-9) * t); }
  function snap(price, ex, mode) { /* đưa mức giá về bước giá hợp lệ: 'down' | 'up' | gần nhất */
    var t = tickOf(ex, price); if (!(t > 0)) return price;
    return mode === 'down' ? floorTick(price, t) : mode === 'up' ? ceilTick(price, t) : r6(Math.round(price / t) * t);
  }
  /* Trần/sàn phiên kế tiếp theo giá tham chiếu (xấp xỉ bằng giá đóng cửa gần nhất; nếu có sự kiện quyền thì giá tham chiếu thật có thể khác) */
  function limits(ex, ref) {
    var p = profile(ex); if (!p || !fin(ref) || Number(ref) <= 0) return null;
    ref = Number(ref); var t = tickOf(ex, ref);
    return { ref: ref, band: p.bandPct, ceil: floorTick(ref * (1 + p.bandPct / 100), t), floor: ceilTick(ref * (1 - p.bandPct / 100), t), tick: t, approxRef: true };
  }

  /* ---------- thanh khoản (từ nến) ---------- */
  function liquidity(candles) {
    var c = (candles || []).filter(function (x) { return x && fin(x.close); }), w = c.slice(-20);
    if (w.length < 10) return null;
    var unit = unitOf(w[w.length - 1].close), vals = [], zero = 0, vols = 0;
    w.forEach(function (x) { var v = fin(x.volume) ? Number(x.volume) : null; if (v === null) return; vols++; if (v === 0) zero++; vals.push(v * Number(x.close) * unit); });
    if (vols < 10) return null;
    return { sessions: w.length, avgValueVND: vals.reduce(function (a, b) { return a + b; }, 0) / vals.length, zeroVolDays: zero };
  }
  /* Giá trị giao dịch TB20 xấp xỉ từ một dòng thị trường (price, avgVolume20) */
  function avgValueOfRow(s) {
    if (!s || !fin(s.price) || !fin(s.avgVolume20) || Number(s.price) <= 0) return null;
    return Number(s.avgVolume20) * Number(s.price) * unitOf(s.price);
  }
  function fmtVND(v) {
    if (!fin(v)) return 'không đủ dữ liệu';
    v = Number(v); return v >= 1e9 ? (v / 1e9).toFixed(2).replace('.', ',') + ' tỷ đồng' : (v / 1e6).toFixed(1).replace('.', ',') + ' triệu đồng';
  }

  /* ---------- chỉ số tham chiếu của sàn ---------- */
  function benchmark(ex, indices) {
    var p = profile(ex), list = indices || [];
    function find(sym) { for (var i = 0; i < list.length; i++) if (list[i] && String(list[i].symbol).toUpperCase() === sym && fin(list[i].pct)) return list[i]; return null; }
    if (p) for (var i = 0; i < p.benchmark.length; i++) { var f = find(p.benchmark[i]); if (f) return { symbol: f.symbol, name: p.benchmarkName, pct: Number(f.pct), fallback: false }; }
    var v = find('VNINDEX');
    return v ? { symbol: 'VNINDEX', name: 'VN-Index', pct: Number(v.pct), fallback: !!p && p.id !== 'HOSE' } : null;
  }

  /* ---------- cờ rủi ro riêng sàn cho một dòng thị trường ---------- */
  function rowFlags(s, ex) {
    var p = profile(ex), out = []; if (!p) return out;
    var av = avgValueOfRow(s);
    if (av !== null && av < p.liq.minAvgValueVND) { var hard = av < p.liq.minAvgValueVND * p.liq.hardFactor; out.push({ id: 'illiquid', penalty: 6, gate: hard, text: (hard ? 'Thanh khoản TB20 rất thấp' : 'Thanh khoản TB20 thấp') + ' (' + fmtVND(av) + '/phiên) so với ngưỡng tham chiếu của ' + p.name + (hard ? ' — loại khỏi ứng viên' : '') }); }
    if (fin(s.pct)) {
      var pc = Number(s.pct);
      if (pc >= p.bandPct * 0.98) out.push({ id: 'nearceil', penalty: 0, text: 'Giá sát/chạm trần ' + p.name + ': khó mua thêm, cần kiểm tra dư mua' });
      else if (pc <= -p.bandPct * 0.98) out.push({ id: 'nearfloor', penalty: 4, text: 'Giá sát/chạm sàn ' + p.name + ': rủi ro không bán được' });
    }
    return out;
  }

  /* ---------- GĐ2: cổng thanh khoản cứng ---------- */
  /* status: ok | caution | blocked | unknown. Chỉ dựa trên thống kê nến; ngưỡng là khởi điểm chưa hiệu chỉnh. */
  function gate(ex, lq) {
    var p = profile(ex); if (!p) return { status: 'unknown', label: 'Chưa rõ sàn', reasons: ['Chưa xác định sàn nên không kiểm tra được thanh khoản theo chuẩn sàn.'] };
    if (!lq) return { status: 'unknown', label: 'Chưa đủ dữ liệu', reasons: ['Không đủ dữ liệu khối lượng 20 phiên để kiểm tra thanh khoản.'] };
    var reasons = [], zr = lq.sessions ? lq.zeroVolDays / lq.sessions : 0, blocked = false, caution = false;
    if (lq.avgValueVND < p.liq.minAvgValueVND * p.liq.hardFactor) { blocked = true; reasons.push('Giá trị giao dịch TB20 ≈ ' + fmtVND(lq.avgValueVND) + ', dưới một nửa ngưỡng tham chiếu của ' + p.name + ' (' + fmtVND(p.liq.minAvgValueVND) + ').'); }
    else if (lq.avgValueVND < p.liq.minAvgValueVND) { caution = true; reasons.push('Giá trị giao dịch TB20 ≈ ' + fmtVND(lq.avgValueVND) + ', thấp hơn ngưỡng tham chiếu của ' + p.name + ' (' + fmtVND(p.liq.minAvgValueVND) + ').'); }
    if (zr >= p.liq.hardZeroRatio) { blocked = true; reasons.push(lq.zeroVolDays + '/' + lq.sessions + ' phiên không có khối lượng (từ một nửa số phiên trở lên).'); }
    else if (lq.zeroVolDays >= p.liq.thinDays) { caution = true; reasons.push(lq.zeroVolDays + '/' + lq.sessions + ' phiên không có khối lượng.'); }
    return blocked ? { status: 'blocked', label: 'Không đủ điều kiện', reasons: reasons } : caution ? { status: 'caution', label: 'Thận trọng', reasons: reasons } : { status: 'ok', label: 'Đạt', reasons: reasons };
  }

  /* ---------- GĐ2: chất lượng dữ liệu riêng sàn (60 phiên gần nhất, nến ngày) ---------- */
  function dataQuality(ex, candles) {
    var p = profile(ex); if (!p) return null;
    var c = (candles || []).filter(function (x) { return x && fin(x.close); }).slice(-60); if (c.length < 20) return null;
    var zero = 0, streak = 0, maxStreak = 0, breaches = 0, lim = p.bandPct / 100 * 1.02 + 0.0005, counted = 0;
    for (var i = 0; i < c.length; i++) {
      var v = fin(c[i].volume) ? Number(c[i].volume) : null;
      if (v !== null) { counted++; if (v === 0) { zero++; streak++; if (streak > maxStreak) maxStreak = streak; } else streak = 0; }
      if (i > 0 && Number(c[i - 1].close) > 0 && Math.abs(Number(c[i].close) / Number(c[i - 1].close) - 1) > lim) breaches++;
    }
    var ratio = counted ? zero / counted : null, w = [];
    if (ratio !== null && ratio > p.dq.maxZeroRatio) w.push('Dữ liệu ' + p.name + ': ' + zero + '/' + counted + ' phiên (' + Math.round(ratio * 100) + '%) không có khối lượng trong ' + c.length + ' phiên gần nhất, cao hơn mức tham chiếu ' + Math.round(p.dq.maxZeroRatio * 100) + '%.');
    if (maxStreak > p.dq.maxZeroStreak) w.push('Có chuỗi ' + maxStreak + ' phiên liên tiếp không có khối lượng.');
    if (breaches) w.push(breaches + ' phiên đóng cửa vượt biên độ ±' + p.bandPct + '% của ' + p.name + ' (có thể do chưa điều chỉnh quyền/chia tách hoặc ngày đầu niêm yết) — chỉ báo quanh các phiên này kém tin cậy.');
    return { sessions: c.length, counted: counted, zeroRatio: ratio, zeroStreak: maxStreak, limitBreaches: breaches, warnings: w, ok: w.length === 0 };
  }

  /* ---------- GĐ2: trạng thái chỉ số của đúng sàn (từ nến chỉ số ngày) ---------- */
  function regime(ex, idxCandles) {
    var p = profile(ex); if (!p) return null;
    var c = (idxCandles || []).filter(function (x) { return x && fin(x.close); }), n = c.length; if (n < 50) return null;
    var cl = c.map(function (x) { return Number(x.close); });
    function sma(k) { var s = 0; for (var i = n - k; i < n; i++) s += cl[i]; return s / k; }
    var s20 = sma(20), s50 = sma(50), last = cl[n - 1], ret20 = (last / cl[n - 21] - 1) * 100, rets = [];
    for (var j = n - 20; j < n; j++) rets.push(cl[j] / cl[j - 1] - 1);
    var m = rets.reduce(function (a, b) { return a + b; }, 0) / rets.length, vol = Math.sqrt(rets.reduce(function (a, b) { return a + (b - m) * (b - m); }, 0) / (rets.length - 1)) * 100;
    var state = last > s20 && s20 > s50 ? 'Tăng' : last < s20 && s20 < s50 ? 'Giảm' : 'Đi ngang/hỗn hợp';
    return { state: state, name: p.benchmarkName, last: last, sma20: s20, sma50: s50, ret20: ret20, vol20: vol, above20: last > s20, above50: last > s50, bars: n };
  }

  /* ---------- GĐ2: mức giá tham chiếu khớp bước giá + số phiên tối thiểu theo biên độ ---------- */
  function minSessions(ex, from, to) {
    var p = profile(ex); if (!p || !(from > 0) || !(to > 0) || to === from) return 0;
    var b = p.bandPct / 100, k = to > from ? Math.log(to / from) / Math.log(1 + b) : Math.log(to / from) / Math.log(1 - b);
    return Math.max(1, Math.ceil(k - 1e-9));
  }
  /* opt: {support, resistance, atr} cùng đơn vị giá với last. Trả danh sách đã snap bước giá. Đây là mức quan sát kỹ thuật, không phải dự báo. */
  function levels(ex, last, opt) {
    var p = profile(ex); opt = opt || {}; if (!p || !fin(last) || Number(last) <= 0) return [];
    last = Number(last); var out = [], L = limits(p.id, last);
    function add(id, label, price, mode) {
      if (!fin(price) || Number(price) <= 0) return;
      var pr = snap(Number(price), p.id, mode); if (!(pr > 0) || pr === last) return;
      out.push({ id: id, label: label, price: pr, distPct: (pr / last - 1) * 100, minSessions: minSessions(p.id, last, pr) });
    }
    if (L) { out.push({ id: 'ceil1', label: 'Trần phiên kế tiếp (xấp xỉ)', price: L.ceil, distPct: (L.ceil / last - 1) * 100, minSessions: 1 }); out.push({ id: 'floor1', label: 'Sàn phiên kế tiếp (xấp xỉ)', price: L.floor, distPct: (L.floor / last - 1) * 100, minSessions: 1 }); }
    if (fin(opt.resistance) && Number(opt.resistance) > last) add('resistance', 'Kháng cự gần nhất (swing)', opt.resistance, 'up');
    if (fin(opt.support) && Number(opt.support) < last) add('support', 'Hỗ trợ gần nhất (swing)', opt.support, 'down');
    if (fin(opt.atr) && Number(opt.atr) > 0) { add('atr_up', 'Giá + 2×ATR14', last + 2 * Number(opt.atr), 'up'); add('atr_dn', 'Giá − 2×ATR14', last - 2 * Number(opt.atr), 'down'); }
    return out;
  }
  function fmtP(v) { return Number(v).toFixed(2); }

  /* ---------- ngữ cảnh cho AI (toàn bộ do code tính, AI không được tự suy) ---------- */
  function context(sym, candles, opt) {
    opt = opt || {}; var r = resolve(sym, opt.hint), p = profile(r.ex), lines = [], warnings = [];
    if (!p) {
      lines.push('Sàn của ' + sym + ': CHƯA XÁC ĐỊNH (không có trong danh bạ mã). Không áp dụng biên độ, bước giá hay chuẩn thanh khoản của một sàn cụ thể; không suy đoán sàn.');
      warnings.push('Chưa xác định được sàn niêm yết của ' + sym + ' nên phân tích không áp quy tắc riêng của sàn.');
      return { ex: '', known: false, profile: null, lines: lines, warnings: warnings, facts: {} };
    }
    var c = (candles || []).filter(function (x) { return x && fin(x.close); }), last = c[c.length - 1], facts = { ex: p.id, bandPct: p.bandPct, benchmark: p.benchmarkName };
    lines.push('Sàn niêm yết: ' + p.name + ' (xác minh từ ' + r.source + '). Biên độ giá ±' + p.bandPct + '%/phiên. Chỉ số tham chiếu: ' + p.benchmarkName + '.');
    var daily = opt.daily !== false;
    if (!daily) lines.push('Khung thời gian không phải nến ngày: không tính trần/sàn phiên kế tiếp và thanh khoản theo phiên; chỉ dùng biên độ và đặc điểm sàn ở trên.');
    if (last && daily) {
      var L = limits(p.id, Number(last.close));
      if (L) {
        var u = unitOf(last.close);
        lines.push('Bước giá tại mức giá hiện tại: ' + tickVND(p.id, Number(last.close) * u) + ' đồng. Nếu lấy giá đóng cửa gần nhất ' + L.ref + ' làm tham chiếu, trần/sàn phiên kế tiếp xấp xỉ ' + L.ceil + ' / ' + L.floor + ' (giá tham chiếu thật có thể khác khi có sự kiện quyền).');
        facts.ceil = L.ceil; facts.floor = L.floor; facts.tick = L.tick;
      }
    }
    var lq = daily ? liquidity(c) : null;
    if (!daily) { /* đã ghi chú ở trên */ }
    else if (lq) {
      lines.push('Thanh khoản 20 phiên gần nhất: giá trị giao dịch trung bình ≈ ' + fmtVND(lq.avgValueVND) + '/phiên; số phiên không có khối lượng: ' + lq.zeroVolDays + '/' + lq.sessions + '.');
      facts.avgValueVND = lq.avgValueVND; facts.zeroVolDays = lq.zeroVolDays;
    } else lines.push('Thanh khoản 20 phiên: không đủ dữ liệu khối lượng để tính.');
    var gt = gate(p.id, lq), dq = daily ? dataQuality(p.id, c) : null, rg = daily && opt.regimeCandles ? regime(p.id, opt.regimeCandles) : null, lv = [];
    if (daily) {
      lines.push('CỔNG THANH KHOẢN (' + p.name + '): ' + gt.label.toUpperCase() + (gt.reasons.length ? ' — ' + gt.reasons.join(' ') : '.'));
      gt.reasons.forEach(function (r) { if (warnings.indexOf(r) < 0 && gt.status !== 'unknown') warnings.push(r); });
      if (dq) { dq.warnings.forEach(function (w) { warnings.push(w); }); lines.push('Chất lượng dữ liệu ' + p.name + ' (' + dq.sessions + ' phiên): ' + (dq.ok ? 'không có bất thường theo ngưỡng tham chiếu.' : dq.warnings.join(' '))); }
      if (rg) lines.push('Trạng thái ' + rg.name + ' (từ nến chỉ số ngày, ' + rg.bars + ' phiên): ' + rg.state + '; điểm ' + fmtP(rg.last) + ' so với SMA20 ' + fmtP(rg.sma20) + ' và SMA50 ' + fmtP(rg.sma50) + '; thay đổi 20 phiên ' + (rg.ret20 >= 0 ? '+' : '') + rg.ret20.toFixed(2) + '%; biến động ngày (độ lệch chuẩn 20 phiên) ' + rg.vol20.toFixed(2) + '%.');
      else if (opt.regimeCandles === undefined) { /* không yêu cầu */ } else lines.push('Không lấy được đủ nến chỉ số ' + p.benchmarkName + ' để xác định trạng thái chỉ số của sàn.');
      if (last) { lv = levels(p.id, Number(last.close), { support: opt.structure && opt.structure.support ? opt.structure.support.price : null, resistance: opt.structure && opt.structure.resistance ? opt.structure.resistance.price : null, atr: opt.atr }); }
      if (lv.length) lines.push('MỨC GIÁ THAM CHIẾU (đã khớp bước giá ' + p.name + '; số phiên tối thiểu chỉ tính từ biên độ ±' + p.bandPct + '%/phiên, KHÔNG phải dự báo thời gian):\n' + lv.map(function (x) { return ' - ' + x.label + ': ' + fmtP(x.price) + ' (' + (x.distPct >= 0 ? '+' : '') + x.distPct.toFixed(2) + '%; tối thiểu ' + x.minSessions + ' phiên)'; }).join('\n'));
    }
    if (opt.indices) {
      var b = benchmark(p.id, opt.indices);
      if (b) { lines.push((b.fallback ? 'Không có ' + p.benchmarkName + ' trong dữ liệu; dùng tạm ' + b.name : 'Chỉ số tham chiếu ' + b.name) + ' phiên gần nhất: ' + (b.pct >= 0 ? '+' : '') + b.pct.toFixed(2) + '%.'); facts.benchmarkPct = b.pct; facts.benchmarkFallback = b.fallback; }
      else lines.push('Không có dữ liệu chỉ số tham chiếu ' + p.benchmarkName + ' trong yêu cầu này.');
    }
    lines.push('Đặc điểm sàn (mô tả định tính, không phải số liệu): ' + p.aiNote);
    if (!p.calibrated) lines.push('Các ngưỡng thanh khoản theo sàn là giá trị khởi điểm chưa hiệu chỉnh bằng dữ liệu; chỉ dùng để cảnh báo, không dùng để khẳng định.');
    facts.gate = gt.status; if (rg) facts.regime = rg.state; if (dq) facts.dqOk = dq.ok;
    return { ex: p.id, known: true, profile: p, lines: lines, warnings: warnings, facts: facts, gate: gt, regime: rg, dataQuality: dq, levels: lv };
  }

  /* Quy tắc bổ sung cho prompt AI, riêng từng sàn */
  function promptRules(ex) {
    var p = profile(ex);
    if (!p) return 'Sàn của mã CHƯA XÁC ĐỊNH: không nêu biên độ trần/sàn, bước giá hay so sánh với chỉ số của một sàn cụ thể; nói rõ giới hạn này ở đầu phần Dữ kiện.';
    var common = 'Đây là phân tích riêng cho sàn ' + p.name + ' (biên độ ±' + p.bandPct + '%, chỉ số tham chiếu ' + p.benchmarkName + '). Chỉ so sánh sức mạnh tương đối với ' + p.benchmarkName + ' (không so với sàn khác). Mức giá trong kịch bản chỉ dùng các mức trong bảng MỨC GIÁ THAM CHIẾU (đã khớp bước giá); không tự đặt mức giá khác. Trong MỘT phiên giá không thể vượt trần/sàn của phiên đó; mức xa hơn chỉ đạt được sau ít nhất số phiên ghi trong bảng. CỔNG THANH KHOẢN: nếu ghi KHÔNG ĐỦ ĐIỀU KIỆN thì kết luận phải là "Không đủ điều kiện để kết luận kỹ thuật" kèm lý do và không đưa kịch bản tăng/giảm như tín hiệu đáng tin; nếu ghi THẬN TRỌNG thì mức tin cậy tối đa là "thấp–trung bình". Nếu có trạng thái chỉ số của sàn, nêu mối quan hệ giữa mã và chỉ số đó. ';
    if (p.id === 'HOSE') return common + 'Với HOSE: đánh giá cả bối cảnh VN-Index/VN30; nếu thanh khoản đủ thì có thể dựa vào xu hướng và khối lượng, nhưng vẫn phải nêu điều kiện vô hiệu.';
    if (p.id === 'HNX') return common + 'Với HNX: biên độ ±10% nên không coi biến động vài phần trăm là bất thường; ưu tiên kiểm tra thanh khoản và phiên khối lượng thấp trước khi kết luận về phá vỡ hay xu hướng.';
    return common + 'Với UPCoM: luôn nêu thanh khoản và số phiên không có khối lượng trước kết luận; không đánh giá mẫu hình nến/phá vỡ là tín hiệu rõ khi khối lượng mỏng; nhấn mạnh rủi ro khó khớp lệnh và khoảng giá nhảy; mức tin cậy tối đa là "thấp–trung bình" nếu có cảnh báo thanh khoản.';
  }

  W.NHIPExchange = {
    version: VERSION, PROFILES: PROFILES, ORDER: ORDER, BASE_BAND: BASE_BAND,
    normEx: normEx, resolve: resolve, profile: profile, scale: scale, normPct: normPct,
    unitOf: unitOf, tickVND: tickVND, tickOf: tickOf, ceilTick: ceilTick, floorTick: floorTick, snap: snap, limits: limits,
    liquidity: liquidity, gate: gate, dataQuality: dataQuality, regime: regime, levels: levels, minSessions: minSessions, avgValueOfRow: avgValueOfRow, fmtVND: fmtVND, benchmark: benchmark, rowFlags: rowFlags, context: context, promptRules: promptRules
  };
})(typeof window !== 'undefined' ? window : globalThis);
