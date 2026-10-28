/* NHIP · Biểu đồ — phần lõi logic thuần (không đụng DOM, không gọi mạng) để kiểm thử được trong Node.
   Mọi con số hiển thị trên biểu đồ vẫn đến từ nến thật của nguồn; file này chỉ chuẩn hóa, kiểm tra và tính toán từ nến đó. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.NHIPChartsCore = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var VN_OFFSET = 7 * 3600e3;
  var INTRADAY = ["1", "5", "15", "30", "60", "120", "180", "240"];   /* 120/180/240 = 2h/3h/4h: gộp từ nến 1 giờ theo từng ngày (V2.92) */

  /* Khung dài: gộp từ nến ngày theo cột mốc lịch (quý / nửa năm / năm / bội số 3 năm / bội số 5 năm) — số tháng mỗi nến */
  var LONG_MONTHS = { "3M": 3, "6M": 6, "1Y": 12, "3Y": 36, "5Y": 60 };
  var isLong = function (res) { return !!LONG_MONTHS[String(res)]; };

  /* [mã khung, nhãn đầy đủ, số ngày tải, nhãn ngắn trên nút, nhóm] — khớp tập khung mà server (/api/analysis) chấp nhận */
  var TIMEFRAMES = [
    ["1", "1 phút", 7, "1p", "min"], ["5", "5 phút", 30, "5p", "min"], ["15", "15 phút", 60, "15p", "min"], ["30", "30 phút", 90, "30p", "min"],
    ["60", "1 giờ", 180, "1h", "min"], ["120", "2 giờ", 180, "2h", "min"], ["180", "3 giờ", 180, "3h", "min"], ["240", "4 giờ", 180, "4h", "min"],
    ["D", "Ngày", 730, "Ngày", "main"], ["W", "Tuần", 3650, "Tuần", "main"], ["M", "Tháng", 7300, "Tháng", "main"],
    ["3M", "3 tháng", 7300, "3T", "long"], ["6M", "6 tháng", 7300, "6T", "long"], ["1Y", "1 năm", 9125, "1N", "long"],
    ["3Y", "3 năm", 10950, "3N", "long"], ["5Y", "5 năm", 10950, "5N", "long"]
  ];
  var isIntraday = function (res) { return INTRADAY.indexOf(String(res)) >= 0; };
  var daysFor = function (res) { var t = TIMEFRAMES.filter(function (x) { return x[0] === String(res); })[0]; return t ? t[2] : 730; };
  var validRes = function (res) { return TIMEFRAMES.some(function (x) { return x[0] === String(res); }); };

  var SYMBOL_RE = /^[A-Z0-9.]{2,12}$/;
  function normalizeSymbol(s) {
    var v = String(s == null ? "" : s).trim().toUpperCase();
    return SYMBOL_RE.test(v) ? v : null;
  }
  var isIndex = function (s) { return /^(VNINDEX|VN30|VN100|HNX\w*|UPCOM\w*)$/.test(s || ""); };

  /* Nguồn trả giá cổ phiếu theo đơn vị nghìn đồng (vd 98.5) → nhân 1000 để hiện 98.500; chỉ số giữ nguyên. Giữ đúng quy tắc cũ của NHIP. */
  function priceScale(symbol, lastClose) {
    if (isIndex(symbol)) return 1;
    return lastClose != null && lastClose < 1000 ? 1000 : 1;
  }

  /* ---------- Thời gian theo giờ Việt Nam ---------- */
  var vnDay = function (tsMs) { return new Date(tsMs + VN_OFFSET).toISOString().slice(0, 10); };
  /* Khóa ghép nến giữa hai mã: intraday khớp theo phút, D/W/M khớp theo ngày lịch VN (tránh lệch do mã giờ 00:00 vs 07:00). */
  /* Khung dài: khớp theo cột mốc (quý/năm…) vì ngày giao dịch đầu cột mốc của hai mã có thể khác nhau. */
  function barKey(tsMs, res) {
    if (isLong(res)) { var d = new Date(tsMs + VN_OFFSET); return "L" + Math.floor((d.getUTCFullYear() * 12 + d.getUTCMonth()) / LONG_MONTHS[String(res)]); }
    return isIntraday(res) ? String(Math.floor(tsMs / 60000)) : vnDay(tsMs);
  }
  /* Nhãn thời gian của một nến khung dài (từ timestamp giây): Q4/2026, Nửa cuối 2026, 2026, 2025–2027… */
  function periodLabel(sec, res) {
    var N = LONG_MONTHS[String(res)]; if (!N) return "";
    var d = new Date(sec * 1000 + VN_OFFSET), mi = d.getUTCFullYear() * 12 + d.getUTCMonth(), b = Math.floor(mi / N), y0 = Math.floor(b * N / 12), y1 = Math.floor(((b + 1) * N - 1) / 12);
    if (N === 3) return "Q" + (Math.floor((b * N) % 12 / 3) + 1) + "/" + y0;
    if (N === 6) return ((b * N) % 12 === 0 ? "Nửa đầu " : "Nửa cuối ") + y0;
    return y0 === y1 ? String(y0) : y0 + "–" + y1;
  }

  /* ---------- Thay đổi giá & thống kê phiên ---------- */
  /* Intraday: so với đóng cửa phiên TRƯỚC (không phải nến 1 phút trước đó). D/W/M: so với nến trước. */
  function sessionChange(candles, res) {
    var n = candles ? candles.length : 0;
    if (!n) return null;
    var last = candles[n - 1], prevClose = null, basis = "nến trước";
    if (isIntraday(res)) {
      var d = vnDay(last.time * 1000);
      for (var i = n - 2; i >= 0; i--) {
        if (vnDay(candles[i].time * 1000) !== d) { prevClose = candles[i].close; break; }
      }
      basis = "phiên trước";
      if (prevClose == null) return { change: null, pct: null, basis: basis, prevClose: null, missing: true };
    } else {
      if (n < 2) return { change: null, pct: null, basis: basis, prevClose: null, missing: true };
      prevClose = candles[n - 2].close;
    }
    var change = last.close - prevClose;
    return { change: change, pct: prevClose ? change / prevClose * 100 : null, basis: basis, prevClose: prevClose, missing: false };
  }

  /* Intraday: gộp theo ngày giao dịch hiện tại (mở của nến đầu, cao/thấp, tổng KL). D/W/M: chính nến cuối. */
  function periodStats(candles, res) {
    var n = candles ? candles.length : 0;
    if (!n) return null;
    var last = candles[n - 1];
    if (!isIntraday(res)) return { open: last.open, high: last.high, low: last.low, close: last.close, volume: last.volume, label: isLong(res) ? "Nến " + periodLabel(last.time, res) : "Nến cuối", bars: 1 };
    var d = vnDay(last.time * 1000), i = n - 1;
    while (i > 0 && vnDay(candles[i - 1].time * 1000) === d) i--;
    var hi = -Infinity, lo = Infinity, vol = 0, hasVol = false;
    for (var j = i; j < n; j++) {
      hi = Math.max(hi, candles[j].high); lo = Math.min(lo, candles[j].low);
      if (candles[j].volume != null) { vol += candles[j].volume; hasVol = true; }
    }
    return { open: candles[i].open, high: hi, low: lo, close: last.close, volume: hasVol ? vol : null, label: "Phiên " + d.slice(8, 10) + "/" + d.slice(5, 7), bars: n - i };
  }

  /* Thay đổi so với nến liền trước của nến đang trỏ (dùng cho readout khi rê chuột). */
  function barChange(candles, idx) {
    if (!candles || idx == null || idx < 0 || idx >= candles.length) return null;
    var c = candles[idx], p = idx > 0 ? candles[idx - 1] : null;
    return { bar: c, change: p ? c.close - p.close : null, pct: p && p.close ? (c.close - p.close) / p.close * 100 : null };
  }
  /* Tìm chỉ số nến theo timestamp (ms) — nhị phân, trả -1 nếu không có nến đó. */
  function indexByTs(candles, tsMs) {
    var lo = 0, hi = (candles ? candles.length : 0) - 1, t = Math.floor(tsMs / 1000);
    while (lo <= hi) {
      var m = (lo + hi) >> 1, v = candles[m].time;
      if (v === t) return m;
      if (v < t) lo = m + 1; else hi = m - 1;
    }
    return -1;
  }

  /* ---------- So sánh mã: chuẩn hóa % từ mốc chung ---------- */
  /* series: { SYM: [{time(giây), close}] } — mã đầu tiên trong `order` là mã chính.
     Mốc gốc = nến ĐẦU TIÊN của mã chính mà tất cả mã còn lại cũng có. Không nội suy, không bịa dữ liệu thiếu (null). */
  function buildCompare(order, series, res) {
    if (!order || order.length < 2) return { error: "Cần ít nhất 2 mã để so sánh." };
    var maps = {}, i, s;
    for (i = 0; i < order.length; i++) {
      s = order[i];
      var arr = series[s];
      if (!arr || !arr.length) return { error: "Thiếu dữ liệu của " + s + "." };
      var m = new Map();
      arr.forEach(function (c) { if (c && isFinite(c.close) && c.close > 0) m.set(barKey(c.time * 1000, res), c.close); });
      maps[s] = m;
    }
    var main = series[order[0]], baseKey = null;
    for (i = 0; i < main.length; i++) {
      var k = barKey(main[i].time * 1000, res);
      if (order.every(function (x) { return maps[x].has(k); })) { baseKey = k; break; }
    }
    if (baseKey == null) return { error: "Các mã không có nến trùng thời gian để chuẩn hóa." };
    var base = {};
    order.forEach(function (x) { base[x] = maps[x].get(baseKey); });
    var rows = main.map(function (c) {
      var key = barKey(c.time * 1000, res), vals = {};
      order.forEach(function (x) {
        var v = maps[x].get(key);
        vals[x] = v == null || key < baseKey ? null : (v / base[x] - 1) * 100;
      });
      return { time: c.time, key: key, vals: vals };
    });
    var latest = {};
    order.forEach(function (x) {
      for (var j = rows.length - 1; j >= 0; j--) if (rows[j].vals[x] != null) { latest[x] = rows[j].vals[x]; break; }
    });
    return { rows: rows, base: base, baseKey: baseKey, latest: latest, order: order.slice() };
  }

  /* ---------- Danh mục chỉ báo ---------- */
  /* group: "price" = vẽ chồng lên nến; "pane" = ô riêng. params: [min, max, độ dài tối đa danh sách]. */
  var INDICATORS = [
    { n: "MA", cat: "Xu hướng", label: "MA", full: "Trung bình động đơn giản", group: "price", def: [20, 50], max: 4, min: 2, hi: 500 },
    { n: "EMA", cat: "Xu hướng", label: "EMA", full: "Trung bình động lũy thừa", group: "price", def: [12, 26], max: 4, min: 2, hi: 500 },
    { n: "BOLL", cat: "Biến động", label: "Bollinger", full: "Dải Bollinger (chu kỳ, độ lệch)", group: "price", def: [20, 2], max: 2, min: 2, hi: 200, exact: true },
    { n: "SAR", cat: "Xu hướng", label: "SAR", full: "Parabolic SAR (bước, bước tối đa…)", group: "price", def: [2, 2, 20], max: 3, min: 3, hi: 100, exact: true },
    { n: "VOL", cat: "Khối lượng", label: "Khối lượng", full: "Khối lượng + trung bình KL", group: "pane", def: [20], max: 3, min: 1, hi: 250 },
    { n: "RSI", cat: "Động lượng", label: "RSI", full: "Sức mạnh tương đối", group: "pane", def: [14], max: 3, min: 2, hi: 200 },
    { n: "MACD", cat: "Động lượng", label: "MACD", full: "MACD (nhanh, chậm, tín hiệu)", group: "pane", def: [12, 26, 9], max: 3, min: 3, hi: 200, exact: true },
    { n: "KDJ", cat: "Động lượng", label: "KDJ", full: "Stochastic KDJ", group: "pane", def: [9, 3, 3], max: 3, min: 3, hi: 100, exact: true },
    { n: "WR", cat: "Động lượng", label: "Williams %R", full: "Williams %R", group: "pane", def: [14], max: 3, min: 1, hi: 200 },
    { n: "CCI", cat: "Động lượng", label: "CCI", full: "Commodity Channel Index", group: "pane", def: [20], max: 1, min: 1, hi: 200, exact: true },
    { n: "OBV", cat: "Khối lượng", label: "OBV", full: "Khối lượng cân bằng", group: "pane", def: [30], max: 1, min: 1, hi: 250, exact: true }
  ];
  var IND = {}; INDICATORS.forEach(function (x) { IND[x.n] = x; });
  var LEGACY = ["MA", "EMA", "BOLL", "VOL", "RSI", "MACD"]; // tập chỉ báo mà trang Phân tích/AI đã biết

  /* Tham số: số nguyên dương trong giới hạn; sai thì quay về mặc định (không ném lỗi). BOLL cho phép độ lệch thập phân. */
  function sanitizeParams(name, raw) {
    var d = IND[name]; if (!d) return null;
    var list = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(/[\s,;]+/).filter(Boolean) : [];
    var out = list.map(Number).filter(function (v) { return isFinite(v) && v > 0; });
    if (name === "BOLL") out = out.slice(0, 2).map(function (v, i) { return i === 0 ? Math.min(200, Math.round(v)) : Math.min(5, Math.round(v * 10) / 10); });
    else if (name === "SAR") out = out.slice(0, 3).map(function (v) { return Math.min(d.hi, Math.round(v * 10) / 10); });
    else out = out.slice(0, d.max).map(function (v) { return Math.min(d.hi, Math.max(1, Math.round(v))); });
    if (out.length < d.min || (d.exact && out.length !== d.def.length)) return d.def.slice();
    return out;
  }

  var CHART_TYPES = [
    ["candle_solid", "Nến đặc"], ["candle_stroke", "Nến rỗng"], ["candle_up_stroke", "Nến tăng rỗng"],
    ["ohlc", "Thanh OHLC"], ["area", "Đường / vùng"]
  ];
  var SCALES = [["normal", "Tuyến tính"], ["log", "Logarit"], ["percentage", "Phần trăm"]];
  var DEFAULT_LAYOUT = function () {
    return { type: "candle_solid", scale: "normal", inds: [{ n: "MA", on: true, p: [20, 50] }, { n: "VOL", on: true, p: [20] }], cmp: [], auto: false };
  };

  /* Chuẩn hóa bố cục đọc từ localStorage: loại phần tử lạ, trùng, tham số hỏng. */
  function sanitizeLayout(raw) {
    var L = DEFAULT_LAYOUT();
    if (!raw || typeof raw !== "object") return L;
    if (CHART_TYPES.some(function (t) { return t[0] === raw.type; })) L.type = raw.type;
    if (SCALES.some(function (t) { return t[0] === raw.scale; })) L.scale = raw.scale;
    if (Array.isArray(raw.inds)) {
      var seen = {}; L.inds = [];
      raw.inds.forEach(function (x) {
        if (!x || !IND[x.n] || seen[x.n]) return; seen[x.n] = 1;
        L.inds.push({ n: x.n, on: x.on !== false, p: sanitizeParams(x.n, x.p) || IND[x.n].def.slice() });
      });
    }
    if (Array.isArray(raw.cmp)) {
      var cs = {}; L.cmp = [];
      raw.cmp.forEach(function (s) { var v = normalizeSymbol(s); if (v && !cs[v] && L.cmp.length < 3) { cs[v] = 1; L.cmp.push(v); } });
    }
    L.auto = raw.auto === true;
    return L;
  }
  /* Đồng bộ với tập chỉ báo cũ (trang Phân tích / ngữ cảnh AI) — chỉ phần giao với LEGACY và đang bật. */
  function legacySet(layout) {
    return layout.inds.filter(function (x) { return x.on && LEGACY.indexOf(x.n) >= 0; }).map(function (x) { return x.n; });
  }
  /* Bố cục khởi tạo từ tập chỉ báo cũ khi người dùng chưa từng dùng bộ biểu đồ mới (giữ thói quen). */
  function layoutFromLegacy(names) {
    var L = DEFAULT_LAYOUT();
    if (Array.isArray(names) && names.length) {
      L.inds = names.filter(function (n) { return IND[n]; }).map(function (n) { return { n: n, on: true, p: IND[n].def.slice() }; });
    }
    return L;
  }
  function toggleIndicator(layout, name) {
    var i = layout.inds.findIndex(function (x) { return x.n === name; });
    if (i >= 0) layout.inds.splice(i, 1);
    else if (IND[name]) layout.inds.push({ n: name, on: true, p: IND[name].def.slice() });
    return layout;
  }

  /* ---------- Nét vẽ (lưu theo mã, dùng chung mọi khung thời gian vì tọa độ là thời gian + giá) ---------- */
  var TOOLS = [
    ["segment", "Đường xu hướng", 2], ["rayLine", "Tia", 2], ["horizontalStraightLine", "Đường ngang (hỗ trợ/kháng cự)", 1],
    ["verticalStraightLine", "Đường dọc", 1], ["parallelStraightLine", "Kênh song song", 3],
    ["straightLine", "Đường thẳng kéo dài", 2], ["horizontalRayLine", "Tia ngang", 2], ["horizontalSegment", "Đoạn ngang", 2],
    ["priceChannelLine", "Kênh giá", 3], ["fibonacciLine", "Fibonacci", 2], ["priceLine", "Mốc giá", 1], ["simpleAnnotation", "Ghi chú", 1], ["simpleTag", "Nhãn giá", 1],
    ["nhRect", "Hình chữ nhật", 2], ["nhCircle", "Hình tròn", 2], ["nhTriangle", "Tam giác", 3], ["nhArrow", "Mũi tên", 2],
    ["nhFib", "Fibonacci tùy chỉnh", 2], ["nhFibExt", "Fibonacci mở rộng", 3], ["nhFibFan", "Fibonacci Fan", 2], ["nhAngle", "Đường góc", 2], ["nhZone", "Vùng hỗ trợ/kháng cự", 2], ["nhLabelRect", "Hình chữ nhật có nhãn", 2], ["nhMeasure", "Đo khoảng giá / thời gian", 2], ["nhLong", "Vị thế Long (mua)", 3], ["nhShort", "Vị thế Short (bán)", 3]
  ];
  var TOOL_NAMES = TOOLS.map(function (t) { return t[0]; });
  var MAX_DRAWINGS = 120, MAX_SYMBOLS = 60;

  /* points trong store được chia cho `scale` (hệ số hiển thị) để không phụ thuộc cách nhân giá. */
  function packDrawing(rec, scale) {
    if (!rec || TOOL_NAMES.indexOf(rec.name) < 0 || !Array.isArray(rec.points) || !rec.points.length) return null;
    var pts = rec.points.map(function (p) {
      return p && isFinite(p.timestamp) && isFinite(p.value) ? { t: Math.round(p.timestamp), v: Math.round(p.value / (scale || 1) * 1e6) / 1e6 } : null;
    });
    if (pts.some(function (p) { return !p; })) return null;
    var out = { name: rec.name, pts: pts };
    if (typeof rec.text === "string" && rec.text) out.text = rec.text.slice(0, 120);
    if (typeof rec.group === "string" && rec.group) out.grp = rec.group.slice(0, 60);
    if (typeof rec.tf === "string" && rec.tf) out.tf = rec.tf.slice(0, 12);
    if (rec.textStyle && typeof rec.textStyle === "object") out.ts = { size: Math.max(9, Math.min(28, +rec.textStyle.size || 12)), bold: !!rec.textStyle.bold, align: ["left", "center", "right"].indexOf(rec.textStyle.align) >= 0 ? rec.textStyle.align : "left", bg: /^#[0-9a-f]{6}$/i.test(rec.textStyle.bg || "") ? rec.textStyle.bg : "#2f80ed" };
    var s = rec.st; /* style từng nét: c màu, w độ dày, d kiểu nét, f độ trong suốt nền */
    if (s && typeof s === "object" && /^#[0-9a-f]{6}$/i.test(s.c)) out.st = { c: s.c, w: Math.max(1, Math.min(8, Math.round(+s.w) || 2)), d: [0, 1, 2].indexOf(+s.d) < 0 ? 0 : +s.d, f: Math.max(0, Math.min(100, Math.round(+s.f) || 0)) };
    if (rec.lock) out.lk = 1; if (rec.hide) out.hd = 1; if (isFinite(rec.z) && rec.z) out.z = Math.round(rec.z);
    return out;
  }
  function unpackDrawing(d, scale) {
    if (!d || TOOL_NAMES.indexOf(d.name) < 0 || !Array.isArray(d.pts) || !d.pts.length || d.pts.length > 3) return null;
    var pts = d.pts.map(function (p) { return p && isFinite(p.t) && isFinite(p.v) ? { timestamp: p.t, value: p.v * (scale || 1) } : null; });
    if (pts.some(function (p) { return !p; })) return null;
    return { name: d.name, points: pts, text: typeof d.text === "string" ? d.text : "", group: typeof d.grp === "string" ? d.grp : "", tf: typeof d.tf === "string" ? d.tf : "", textStyle: d.ts && typeof d.ts === "object" ? d.ts : null, st: d.st && /^#[0-9a-f]{6}$/i.test(d.st.c) ? { c: d.st.c, w: d.st.w, d: d.st.d, f: d.st.f } : null, lock: d.lk === 1, hide: d.hd === 1, z: isFinite(d.z) ? d.z : 0 };
  }
  function sanitizeStore(raw) {
    var S = { v: 1, layout: null, draws: {}, order: [] };
    if (!raw || typeof raw !== "object") return S;
    if (raw.layout) S.layout = sanitizeLayout(raw.layout);
    var d = raw.draws && typeof raw.draws === "object" ? raw.draws : {};
    Object.keys(d).forEach(function (sym) {
      if (!normalizeSymbol(sym) || !Array.isArray(d[sym])) return;
      var list = d[sym].filter(function (x) { return unpackDrawing(x, 1); }).slice(0, MAX_DRAWINGS);
      if (list.length) S.draws[sym] = list;
    });
    var ord = Array.isArray(raw.order) ? raw.order.filter(function (s) { return S.draws[s]; }) : [];
    Object.keys(S.draws).forEach(function (s) { if (ord.indexOf(s) < 0) ord.push(s); });
    S.order = ord.slice(-MAX_SYMBOLS);
    Object.keys(S.draws).forEach(function (s) { if (S.order.indexOf(s) < 0) delete S.draws[s]; });
    return S;
  }
  function setDrawings(store, symbol, list) {
    var s = normalizeSymbol(symbol); if (!s) return store;
    var clean = (list || []).filter(function (x) { return unpackDrawing(x, 1); }).slice(0, MAX_DRAWINGS);
    store.order = (store.order || []).filter(function (x) { return x !== s; });
    if (clean.length) { store.draws[s] = clean; store.order.push(s); } else delete store.draws[s];
    while (store.order.length > MAX_SYMBOLS) { delete store.draws[store.order.shift()]; }
    return store;
  }

  /* ---------- Màu ---------- */
  function hexA(hex, a) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
    if (!m) return "rgba(128,128,128," + a + ")";
    var n = parseInt(m[1], 16);
    return "rgba(" + (n >> 16 & 255) + "," + (n >> 8 & 255) + "," + (n & 255) + "," + a + ")";
  }
  var CMP_COLORS = ["#2f7bd9", "#e8903a", "#8e5bd6", "#14a39a"];

  return {
    TIMEFRAMES: TIMEFRAMES, INDICATORS: INDICATORS, IND: IND, LEGACY: LEGACY, CHART_TYPES: CHART_TYPES, SCALES: SCALES, TOOLS: TOOLS,
    CMP_COLORS: CMP_COLORS, MAX_DRAWINGS: MAX_DRAWINGS, MAX_SYMBOLS: MAX_SYMBOLS,
    isIntraday: isIntraday, isLong: isLong, LONG_MONTHS: LONG_MONTHS, periodLabel: periodLabel, daysFor: daysFor, validRes: validRes, normalizeSymbol: normalizeSymbol, isIndex: isIndex, priceScale: priceScale,
    vnDay: vnDay, barKey: barKey, sessionChange: sessionChange, periodStats: periodStats, barChange: barChange, indexByTs: indexByTs,
    buildCompare: buildCompare, sanitizeParams: sanitizeParams, sanitizeLayout: sanitizeLayout, DEFAULT_LAYOUT: DEFAULT_LAYOUT,
    legacySet: legacySet, layoutFromLegacy: layoutFromLegacy, toggleIndicator: toggleIndicator,
    packDrawing: packDrawing, unpackDrawing: unpackDrawing, sanitizeStore: sanitizeStore, setDrawings: setDrawings, hexA: hexA
  };
});
