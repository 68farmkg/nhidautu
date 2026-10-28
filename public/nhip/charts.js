/* NHIP · Biểu đồ (route #/tong-quan) — nâng cấp v26.
   Dữ liệu: /api/analysis/:mã (VNDirect DChart đã làm sạch + chất lượng + tổng hợp kỹ thuật có công thức). Không có dữ liệu giả:
   lỗi nguồn → hiện lỗi; so sánh mã thiếu dữ liệu → báo, không nội suy.
   Dùng KLineChart 9.x đã có sẵn. Mọi tính năng nâng cao bọc try/catch để lỗi một phần không làm hỏng cả trang. */
(function () {
  "use strict";
  var C = window.NHIPChartsCore;
  if (!C) { console.warn("charts: thiếu charts-core.js"); return; }

  var LS = "nhip.charts.v1", LS_A = "nhip.charts.analysis.v1", STORE, symsPromise = null, symsHouse = "", cmpSeq = 0;
  var loadStore = function () { try { return C.sanitizeStore(JSON.parse(localStorage.getItem(LS) || "null")); } catch (e) { return C.sanitizeStore(null); } };
  var saveStore = function () { try { localStorage.setItem(LS, JSON.stringify(STORE)); } catch (e) { } };
  STORE = loadStore();

  var norm = function (s) { return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").toLowerCase(); };
  var getSyms = function () {
    var hx = window.NHIPHouse && window.NHIPHouse.cur ? window.NHIPHouse.cur() : ""; if (!symsPromise || symsHouse !== hx) { symsHouse = hx; symsPromise = fetch("/api/symbols").then(function (r) { return r.ok ? r.json() : { items: [] }; }).then(function (j) { return j.items || []; }).catch(function () { return []; }); }
    return symsPromise;
  };
  var fmtDate = function (sec, res) {
    var o = { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" };
    if (C.isIntraday(res)) { o.hour = "2-digit"; o.minute = "2-digit"; delete o.year; }
    if (res === "M") { delete o.day; }
    if (C.isLong(res)) return C.periodLabel(sec, res);
    try { return new Date(sec * 1000).toLocaleString("vi-VN", o); } catch (e) { return String(sec); }
  };
  var volFmt = function (v) { return v == null ? "—" : v >= 1e9 ? num(v / 1e9, 2) + " tỷ" : v >= 1e6 ? num(v / 1e6, 2) + " tr" : num(v, 0); };

  var ICON = {
    segment: '<path d="M5 19 19 5"/><circle cx="5" cy="19" r="1.6"/><circle cx="19" cy="5" r="1.6"/>',
    rayLine: '<path d="M5 19 20 4"/><circle cx="5" cy="19" r="1.6"/><path d="M14 4h6v6"/>',
    horizontalStraightLine: '<path d="M3 12h18"/><circle cx="12" cy="12" r="1.6"/>',
    verticalStraightLine: '<path d="M12 3v18"/><circle cx="12" cy="12" r="1.6"/>',
    parallelStraightLine: '<path d="M4 15 16 5M8 20 20 10"/>',
    fibonacciLine: '<path d="M3 5h18M3 10h18M3 15h18M3 20h18"/>',
    priceLine: '<path d="M3 12h13"/><path d="M16 8h5l-2 4 2 4h-5z"/>',
    simpleAnnotation: '<path d="M4 5h16v11H11l-4 4v-4H4z"/>',
    straightLine: '<path d="M3 20 21 4"/><path d="M12 12.5v.01"/>',
    horizontalRayLine: '<path d="M5 12h16"/><circle cx="5" cy="12" r="1.6"/><path d="M17 8l4 4-4 4"/>',
    horizontalSegment: '<path d="M5 12h14"/><circle cx="5" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
    priceChannelLine: '<path d="M3 17 21 9M3 11 21 3M3 21 21 13"/>',
    simpleTag: '<path d="M4 7h11l5 5-5 5H4z"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    magnet: '<path d="M6 3v8a6 6 0 0 0 12 0V3h-4v8a2 2 0 0 1-4 0V3z"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    nhRect: '<rect x="4" y="6" width="16" height="12" rx="1"/>', nhCircle: '<circle cx="12" cy="12" r="8"/>', nhTriangle: '<path d="M12 4 21 19H3z"/>', nhArrow: '<path d="M5 19 19 5M10 5h9v9"/>',
    nhFib: '<path d="M3 5h18M3 9h18M3 14h18M3 20h18"/><path d="M6 5v15M12 5v15M18 5v15" opacity=".45"/>',
    nhFibFan: '<path d="M4 20 20 4M4 20 21 12M4 20 20 20"/><circle cx="4" cy="20" r="1.5"/>',
    nhAngle: '<path d="M4 20h16M4 20V4M4 20 18 9"/><path d="M10 20a6 6 0 0 0-4.2-5.7"/>',
    nhZone: '<rect x="3" y="5" width="18" height="6" rx="1"/><rect x="3" y="14" width="18" height="5" rx="1" opacity=".55"/>',
    nhLabelRect: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M6 8h12M6 12h8M6 16h10"/>',
    nhFibExt: '<path d="M3 5h18M3 10h18M3 15h12M3 20h7"/>', nhMeasure: '<path d="M3 17 17 3l4 4L7 21zM8 12l2 2M11 9l2 2M14 6l2 2"/>',
    nhLong: '<rect x="4" y="4" width="16" height="8"/><rect x="4" y="12" width="16" height="8" opacity=".4"/>', nhShort: '<rect x="4" y="4" width="16" height="8" opacity=".4"/><rect x="4" y="12" width="16" height="8"/>',
    redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>', list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    cont: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>'
  };
  var svg = function (n) { var path = ICON[n] || '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M7 12h10M12 7v10"/>'; return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path + "</svg>"; };

  async function vCharts(opts) {
    var ok = mine(), q = new URLSearchParams(location.hash.split("?")[1] || "");
    /* opts.mode === "analysis": cùng giao diện biểu đồ gọn, nhưng bố cục/nét vẽ lưu riêng và cột phụ do module Phân tích cung cấp */
    opts = opts && typeof opts === "object" && typeof opts.preventDefault !== "function" ? opts : {};
    if (typeof opts.alive === "function") ok = opts.alive; /* v3.17: biểu đồ nhúng (Live) không bị vô hiệu khi trang nền đổi tuyến */
    var A = opts.mode === "analysis", KS = A ? "analysisSym" : "sym", KR = A ? "analysisRes" : "res", ROUTE = A ? "phan-tich" : "tong-quan", LSK = A ? LS_A : LS;
    var STORE = (function () { try { return C.sanitizeStore(JSON.parse(localStorage.getItem(LSK) || "null")); } catch (e) { return C.sanitizeStore(null); } })();
    var saveStore = function () { try { localStorage.setItem(LSK, JSON.stringify(STORE)); } catch (e) { } };
    var hook = function (n) { if (!A || typeof opts[n] !== "function") return; try { return opts[n].apply(null, [S].concat(Array.prototype.slice.call(arguments, 1))); } catch (e) { console.warn("charts: hook " + n, e); } };
    var res0 = sessionStorage[KR] || PREF.res || "D";
    var S = {
      sym: C.normalizeSymbol(q.get("s") || sessionStorage[KS] || sessionStorage.sym || PREF.sym || HOMESYM()) || "FPT",
      res: C.validRes(res0) ? res0 : "D",
      layout: STORE.layout ? C.sanitizeLayout(STORE.layout) : C.layoutFromLegacy(Array.from(analysisIndicators)),
      d: null, data: [], k: null, sc: 1, seq: 0, panes: {}, tool: null, pendingId: null, draws: [], magnet: false, hidden: false,
      pop: null, wq: [], cmp: null, multi: false, mc: null, full: false, ro: null, timer: null, ob: null, silent: false, tab: "wl"
    };
    var saveLayout = function () {
      STORE.layout = S.layout; saveStore();
      try { analysisIndicators.clear(); C.legacySet(S.layout).forEach(function (n) { analysisIndicators.add(n); }); saveAnalysisPrefs(); } catch (e) { }
    };
    var colors = function () { return { up: analysisPrefs.up || "#16bd8c", dn: analysisPrefs.down || "#ee7580" }; };
    var tfLabel = function () { return (C.TIMEFRAMES.filter(function (t) { return t[0] === S.res; })[0] || [0, S.res])[1]; };
    var fp = function (v) { return v == null ? "—" : C.isIndex(S.sym) ? num(v) : num(Math.round(v * S.sc), 0); };
    var paneH = function () { return innerWidth < 700 ? 84 : 104; };
    var tfBtn = function (t) { return '<button type="button" data-v="' + t[0] + '" title="' + esc(t[1]) + '" aria-label="' + esc(t[1]) + '" class="' + (t[0] === S.res ? "on" : "") + '">' + t[3] + "</button>"; };

    (opts.host ? function (h) { opts.host.innerHTML = h; } : view)('<div class="cp cpx' + (opts.host ? " cp-embed" : "") + '">' +
      '<div class="cp-top"><div class="cp-id"><div class="eyebrow">' + (A ? "PHÂN TÍCH KỸ THUẬT" : "BIỂU ĐỒ KỸ THUẬT") + '</div><h1 id="cp-sym">' + esc(S.sym) + '</h1><div id="cp-sub" class="cx-sub muted"></div><div id="cp-px" class="cp-px"><span class="muted">Đang tải giá…</span></div><div id="cp-ohlc" class="cp-ohlc"></div></div>' +
      '<form id="sf" class="cp-search" autocomplete="off"><input id="si" list="cx-syms" value="' + esc(S.sym) + '" maxlength="12" autocapitalize="characters" aria-label="Mã cổ phiếu hoặc chỉ số"><datalist id="cx-syms"></datalist><button class="btn primary">Xem</button></form>' +
      '<div class="cp-actions"><div class="tp-bs"><a class="tp-bb" href="#/giao-dich" data-trade-quick="buy">Mua</a><a class="tp-bsl" href="#/giao-dich" data-trade-quick="sell">Bán</a></div><button type="button" id="aw" class="btn pale"></button><button type="button" id="ak" class="btn primary">✦ Hỏi AI</button></div></div>' +
      '<div class="cp-grid"><section class="cp-main panel" id="cpm">' +
      /* Hàng 1: khung thời gian — [Phút ▾] | Ngày Tuần Tháng | 3T 6T 1N 3N 5N. Hàng 2 (hoặc cùng hàng trên PC): công cụ. */
      '<div class="cx-bar" role="toolbar" aria-label="Công cụ biểu đồ"><div class="cx-tfs"><div class="tf" id="tf" role="group" aria-label="Khung thời gian">' +
      '<button type="button" class="cx-btn tf-min" id="bt-min" aria-haspopup="true" aria-label="Khung phút và giờ"></button>' +
      C.TIMEFRAMES.filter(function (t) { return t[4] === "main"; }).map(tfBtn).join("") + '<i class="cx-tsep" aria-hidden="true"></i>' +
      C.TIMEFRAMES.filter(function (t) { return t[4] === "long"; }).map(tfBtn).join("") + "</div></div>" +
      '<div class="cx-tools"><button type="button" class="cx-btn" id="bt-type" aria-haspopup="true"></button><button type="button" class="cx-btn" id="bt-ind" aria-haspopup="true"></button><button type="button" class="cx-btn" id="bt-cmp" aria-haspopup="true">So sánh</button><button type="button" class="cx-btn cx-multi-btn" id="bt-multi" aria-pressed="false" title="Xem nhiều khung thời gian của cùng một mã trên một bảng">Đa khung</button>' +
      '<button type="button" class="cx-btn" id="bt-draw" aria-pressed="false">Vẽ</button><button type="button" class="cx-btn cx-ico" id="bt-more" aria-haspopup="true" aria-label="Thêm tùy chọn">⋯</button><button type="button" class="cx-btn cx-ico" id="bt-full" aria-label="Phóng to biểu đồ" title="Phóng to / thu nhỏ">⛶</button></div></div>' +
      '<div class="cx-pop" id="cx-pop" hidden></div>' +
      '<div class="cx-legend" id="cx-legend"></div><div class="cx-ro" id="cx-ro" aria-live="off"></div>' +
      '<div class="cx-stage"><div class="cx-rail" id="cx-rail" role="toolbar" aria-label="Công cụ vẽ">' +
      C.TOOLS.map(function (t) { return '<button type="button" data-tool="' + t[0] + '" title="' + esc(t[1]) + '" aria-label="' + esc(t[1]) + '">' + svg(t[0]) + "</button>"; }).join("") +
      '<i class="cx-rsep"></i><button type="button" id="rl-mag" title="Hít vào giá (nam châm)" aria-pressed="false">' + svg("magnet") + '</button><button type="button" id="rl-hide" title="Ẩn / hiện nét vẽ" aria-pressed="false">' + svg("eye") + '</button><button type="button" id="rl-undo" title="Xóa nét vẽ gần nhất">' + svg("undo") + '</button><button type="button" id="rl-clear" title="Xóa tất cả nét vẽ của mã này">' + svg("trash") + "</button></div>" +
      '<div id="chart" class="kline-chart kc-pro cx-chart"><div class="placeholder">Đang tải biểu đồ…</div></div></div>' +
      '<div id="cx-multi" class="mc-host" hidden></div>' +
      '<div id="cs" class="source-strip"></div></section>' +
      (A ? (opts.side || "") : '<aside class="cp-side panel"><div class="tf tabs" id="tabs"><button type="button" data-t="wl" class="on">Theo dõi</button><button type="button" data-t="sig">Tín hiệu</button><button type="button" data-t="nw">Tin tức</button></div>' +
      '<div id="p-wl" class="pane"><p class="muted">Đang tải…</p></div><div id="p-sig" class="pane" hidden></div><div id="p-nw" class="pane newslist" hidden></div></aside>') + '</div>' + (A ? (opts.below || "") : "") + '</div>');

    /* v2.9.2: thanh công cụ vẽ nằm NGAY DƯỚI hàng "Nến đặc … Vẽ" (trên dòng giá Mở/Cao/Thấp), dạng thanh ngang */
    (function () { var bar0 = $(".cx-bar"), rail0 = $("#cx-rail"); if (bar0 && rail0 && bar0.parentNode) bar0.parentNode.insertBefore(rail0, bar0.nextSibling); })();

    /* ---------- Header: giá, trạng thái dữ liệu ---------- */
    var syncWatch = function () { var b = $("#aw"); if (b) b.textContent = ST.watchlist.indexOf(S.sym) >= 0 ? "★ Đang theo dõi" : "☆ Theo dõi"; };
    function drawHeader() {
      var d = S.d; if (!d || !ok()) return;
      var cs = d.candles, l = cs[cs.length - 1], ch = C.sessionChange(cs, S.res), st = C.periodStats(cs, S.res), qf = d.quality && d.quality.freshness;
      var chHtml = ch && !ch.missing ? '<span class="' + (ch.change < 0 ? "dn" : "up") + '">' + (ch.change > 0 ? "+" : "") + fp(ch.change) + " (" + pc(ch.pct) + ")</span>" : '<span class="muted">Chưa đủ dữ liệu để tính thay đổi</span>';
      var warn = qf && qf.level !== "fresh" ? '<span class="qchip warn" title="' + esc(qf.message) + '">' + (qf.level === "stale" ? "Dữ liệu cũ" : "Dữ liệu trễ") + "</span>" : "";
      var form = d.quality && d.quality.forming ? '<span class="qchip warn">Nến cuối đang hình thành</span>' : "";
      $("#cp-px").innerHTML = '<b class="big ' + (ch && ch.change < 0 ? "dn" : "up") + '">' + fp(l.close) + "</b>" + chHtml;
      var oh = $("#cp-ohlc");
      if (oh) {
        var cell = function (lb, v, k) { return '<div class="oh"><span>' + lb + '</span><b class="' + (k || "") + '">' + v + "</b></div>"; };
        oh.innerHTML = '<div class="oh-cap"><span>' + esc(st.label) + (ch && !ch.missing ? " · thay đổi so với " + esc(ch.basis) : "") + "</span>" + warn + form + "</div>" +
          '<div class="oh-grid">' + cell("Mở", fp(st.open)) + cell("Cao", fp(st.high), "up") + cell("Thấp", fp(st.low), "dn") + cell("KL", volFmt(st.volume)) + "</div>";
      }
      var cs2 = $("#cs"), MH = window.NHIPMobileHead, mob = !!(MH && MH.isMobile(!!opts.host));
      if (MH && !opts.host) { try { MH.sync(S.sym, C.isIndex(S.sym)); } catch (e) { } } /* v2.65: đầu trang kiểu Giao dịch (chỉ điện thoại) */
      if (cs2 && mob) {
        /* v2.65 điện thoại: MỘT nhãn trạng thái hiện tại + 1 dòng nguồn, thay cho 3 nhãn Nến cuối / Phiên / Dữ liệu */
        var m2 = d.meta || {}, q2 = d.quality || {}, lc2 = q2.lastCandle, f2 = q2.freshness || {}, is2 = q2.issues || {};
        cs2.innerHTML = '<div class="cs-st">' + MH.chip(d) + "</div>"
          + '<div class="qline cs-src">' + esc(m2.source || "Nguồn không rõ") + " · lấy lúc " + esc(dt(m2.fetchedAt)) + (m2.cached ? " · cache" : "") + (lc2 ? " · nến cuối " + esc(lc2.dateVN + " " + lc2.clockVN) + " (giờ VN)" : "") + " · " + d.candles.length + " nến · " + tfLabel() + " · không đảm bảo realtime.</div>"
          + (f2.level && f2.level !== "fresh" && f2.message ? '<div class="qline cs-src qwarn">' + esc(f2.message) + "</div>" : "")
          + (is2.dropped || is2.duplicates ? '<div class="qline cs-src qwarn">Đã loại ' + (is2.dropped || 0) + " nến lỗi và " + (is2.duplicates || 0) + " bản ghi trùng từ nguồn.</div>" : "");
      } else {
        if (cs2) cs2.innerHTML = window.NHIPQ ? window.NHIPQ.quality(d) : esc((d.meta && d.meta.source) || "") + " · " + esc(dt(d.meta && d.meta.fetchedAt));
        var meta = $("#cs"); if (meta) meta.insertAdjacentHTML("beforeend", '<div class="qline cx-note">' + d.candles.length + " nến · " + tfLabel() + " · giờ Việt Nam · không đảm bảo realtime.</div>");
      }
    }
    window.addEventListener("nhip:mh-mode", function () { if (ok()) { try { if (!(window.NHIPMobileHead && window.NHIPMobileHead.isMobile(false))) window.NHIPMobileHead && window.NHIPMobileHead.remove(); drawHeader(); } catch (e) { } } });
    var sigRow = function (k, v) { return '<div class="sg-row"><span>' + k + "</span>" + v + "</div>"; };
    function drawSignals() {
      var d = S.d, el = $("#p-sig"); if (!d || !el) return;
      var s = d.summary, cs = d.candles, l = cs[cs.length - 1], vs = cs.slice(-20).map(function (x) { return x.volume || 0; }), av = vs.reduce(function (a, b) { return a + b; }, 0) / (vs.length || 1);
      var t = function (good, txt) { return '<span class="sg ' + (good == null ? "mid" : good ? "upb" : "dnb") + '">' + txt + "</span>"; }, rsi = s.rsi14;
      var rows = [
        ["Giá so với SMA20", s.sma20 == null ? t(null, "—") : t(s.latestClose > s.sma20, s.latestClose > s.sma20 ? "Trên" : "Dưới")],
        ["Giá so với SMA50", s.sma50 == null ? t(null, "—") : t(s.latestClose > s.sma50, s.latestClose > s.sma50 ? "Trên" : "Dưới")],
        ["SMA20 / SMA50", s.sma20 == null || s.sma50 == null ? t(null, "—") : t(s.sma20 > s.sma50, s.sma20 > s.sma50 ? "SMA20 trên SMA50" : "SMA20 dưới SMA50")],
        ["RSI(14)", rsi == null ? t(null, "—") : t(rsi >= 50 && rsi <= 70 ? true : rsi > 70 || rsi < 30 ? false : null, num(rsi, 1) + " · " + (rsi > 70 ? "quá mua" : rsi < 30 ? "quá bán" : rsi >= 50 ? "động lượng tốt" : "yếu"))],
        ["MACD / Signal", s.macd == null ? t(null, "—") : t(s.macd > s.macdSignal, s.macd > s.macdSignal ? "MACD trên Signal" : "MACD dưới Signal")],
        ["Khối lượng / TB20", av && l.volume != null ? t(l.volume > av * 1.3 ? true : null, num(l.volume / av, 2) + "×") : t(null, "—")]
      ];
      el.innerHTML = '<div class="wl-h">Tín hiệu từ chỉ báo (nến ' + esc(fmtDate(l.time, S.res)) + ", khung " + esc(tfLabel()) + ")</div>" + rows.map(function (r) { return sigRow(r[0], r[1]); }).join("") +
        (window.NHIPQ && d.technical ? '<details class="cx-tech"><summary>Tổng hợp kỹ thuật có công thức</summary>' + window.NHIPQ.tech(d.technical) + "</details>" : "") +
        '<p class="source-note">Tính tự động từ nến thật của nguồn; là dữ liệu tham khảo, không phải khuyến nghị mua/bán.</p>';
    }

    /* ---------- Chart engine ---------- */
    var toK = function (c) { var o = { timestamp: c.time * 1000, open: c.open * S.sc, high: c.high * S.sc, low: c.low * S.sc, close: c.close * S.sc }; if (c.volume != null) o.volume = c.volume; return o; };
    function destroyChart() {
      if (S.ob) { try { S.ob.disconnect(); } catch (e) { } S.ob = null; }
      if (S.k) { try { window.dispatchEvent(new CustomEvent("nhip:chart-destroyed", { detail: { k: S.k } })); } catch (e) { } }
      if (S.k) { try { window.klinecharts.dispose(S.k); } catch (e) { } S.k = null; if (typeof proK !== "undefined") proK = null; }
      S.panes = {}; S.draws = []; S.pendingId = null; S.tool = null; S.cmp = null;
    }
    function applyStyles() {
      var k = S.k, c = colors(), L = S.layout, brand = "#2f7bd9";
      k.setStyles(isDark() ? "dark" : "light");
      k.setStyles({
        grid: { horizontal: { color: GRC() }, vertical: { color: GRC() } },
        candle: {
          type: L.type,
          tooltip: { showRule: "none" }, /* ẩn Time/Open/High/Low/Close/Volume đè lên nến (đã có ở thanh trên biểu đồ) */
          bar: { upColor: c.up, downColor: c.dn, upBorderColor: c.up, downBorderColor: c.dn, upWickColor: c.up, downWickColor: c.dn },
          area: { lineSize: 2, lineColor: brand, backgroundColor: [{ offset: 0, color: C.hexA(brand, 0.22) }, { offset: 1, color: C.hexA(brand, 0.01) }] }
        },
        yAxis: { type: L.scale }
      });
    }
    function indSpec(it) {
      var c = colors(), s = { name: it.n, calcParams: it.p.slice() };
      if (it.n === "VOL" || it.n === "MACD") s.styles = { bars: [{ style: "fill", borderSize: 1, borderStyle: "solid", borderDashedValue: [2, 2], upColor: C.hexA(c.up, 0.7), downColor: C.hexA(c.dn, 0.7), noChangeColor: "#8a97a6" }] };
      return s;
    }
    function applyInd(it) {
      var k = S.k, g = C.IND[it.n]; if (!k || !g) return false;
      try {
        var id = g.group === "price" ? k.createIndicator(indSpec(it), true, { id: "candle_pane" }) : k.createIndicator(indSpec(it), false, { height: paneH() });
        S.panes[it.n] = id || (g.group === "price" ? "candle_pane" : null);
        if (!id) { console.warn("charts: không tạo được chỉ báo", it.n); return false; }
        if (!it.on) k.overrideIndicator({ name: it.n, visible: false }, id);
        return true;
      } catch (e) { console.warn("charts: lỗi chỉ báo", it.n, e); return false; }
    }
    function dropInd(name) {
      try { if (S.k && S.panes[name]) S.k.removeIndicator(S.panes[name], name); } catch (e) { console.warn(e); }
      delete S.panes[name];
    }
    var stash = {};
    var ovHandlers = function () {
      var again = function (o) { return DP && DP.cont() ? o.name : null; };
      return {
        onDrawEnd: function (e) { var n = again(e.overlay); upsertDraw(e.overlay); S.tool = null; S.pendingId = null; syncTools(); persistDraws(); if (n) setTimeout(function () { if (ok()) setTool(n); }, 0); return false; },
        onPressedMoveEnd: function (e) { upsertDraw(e.overlay); persistDraws(); return false; },
        onRemoved: function (e) { if (S.silent) return false; S.draws = S.draws.filter(function (r) { return r.id !== e.overlay.id; }); persistDraws(); if (DP) DP.gone(e.overlay.id); return false; },
        onRightClick: function (e) { if (DP) { DP.onRight(e.overlay); return true; } (function (oid) { NhipDlg.confirm({ tone: "danger", icon: "trash", title: "Xóa nét vẽ này?", message: "Nét vẽ sẽ bị xóa khỏi biểu đồ.", okText: "Xóa nét vẽ", cancelText: "Giữ lại" }).then(function (ok) { if (ok) { try { S.k.removeOverlay({ id: oid }); } catch (x) { } } }); })(e.overlay.id); return true; },
        onSelected: function (e) { if (DP) DP.onSel(e.overlay); return false; },
        onDeselected: function () { if (DP) DP.onDesel(); return false; },
        onDoubleClick: function (e) { if (DP) DP.onDbl(e.overlay); return false; }
      };
    };
    function mkOverlay(name, points, text, ex) {
      ex = ex || {}; var st = DP ? DP.stOf(name, ex.st) : null;
      var cfg = Object.assign({ name: name, lock: !!ex.lock, visible: !(ex.hide || S.hidden), mode: DP ? DP.mode() : (S.magnet ? "weak_magnet" : "normal") }, ovHandlers());
      if (DP) { var sx=Object.assign({},st||{}); if(ex.textStyle){sx.textSize=ex.textStyle.size;sx.bold=ex.textStyle.bold;sx.textAlign=ex.textStyle.align;sx.textBg=ex.textStyle.bg;} cfg.styles = DP.styles(name, sx); }
      if (ex.z) cfg.zLevel = ex.z;
      if (points) cfg.points = points;
      if (text) cfg.extendData = text;
      var id = S.k.createOverlay(cfg);
      if (id) stash[id] = { st: st, lock: !!ex.lock, hide: !!ex.hide, z: ex.z || 0 };
      return id;
    }
    function upsertDraw(o) {
      if (!o || !o.id) return;
      var i = S.draws.findIndex(function (r) { return r.id === o.id; }), old = i >= 0 ? S.draws[i] : (stash[o.id] || {});
      var rec = Object.assign({}, old, { id: o.id, name: o.name, points: (o.points || []).map(function (p) { return { timestamp: p.timestamp, value: p.value }; }), text: typeof o.extendData === "string" ? o.extendData : "" });
      if (i >= 0) S.draws[i] = rec; else S.draws.push(rec);
    }
    function persistDraws() {
      var list = S.draws.map(function (r) { return C.packDrawing(r, S.sc); }).filter(Boolean);
      C.setDrawings(STORE, S.sym, list); saveStore();
      if (DP && !S.rebuilding) DP.push();
    }
    function restoreDraws() {
      var list = (STORE.draws[S.sym] || []).map(function (x) { return C.unpackDrawing(x, S.sc); }).filter(Boolean);
      list.forEach(function (u) {
        try {
          var id = mkOverlay(u.name, u.points, u.text, u);
          if (id) S.draws.push({ id: id, name: u.name, points: u.points, text: u.text, st: stash[id].st, lock: u.lock, hide: u.hide, z: u.z });
        } catch (e) { console.warn("charts: không khôi phục được nét vẽ", e); }
      });
      if (S.hidden) setDrawVisible(false);
      if (DP) DP.reset();
    }
    /* Cầu nối cho bộ vẽ nâng cao (charts-draw.js) */
    function patchDraw(id, p, quiet) {
      var r = S.draws.filter(function (x) { return x.id === id; })[0]; if (!r) return;
      Object.assign(r, p); var o = { id: id };
      if (p.st || p.textStyle) { var sx=Object.assign({},r.st||{}); if(r.textStyle){sx.textSize=r.textStyle.size;sx.bold=r.textStyle.bold;sx.textAlign=r.textStyle.align;sx.textBg=r.textStyle.bg;} o.styles = DP.styles(r.name, sx); }
      if ("lock" in p) o.lock = !!p.lock;
      if ("hide" in p) o.visible = !p.hide && !S.hidden;
      if ("z" in p) o.zLevel = p.z;
      if ("text" in p) o.extendData = p.text;
      try { S.k.overrideOverlay(o); } catch (e) { console.warn(e); }
      if (!quiet) persistDraws();
    }
    function addDraw(name, points, text) {
      if (S.draws.length >= C.MAX_DRAWINGS) return toast("Đã đạt tối đa " + C.MAX_DRAWINGS + " nét vẽ cho mỗi mã", 1);
      var id = mkOverlay(name, points, text); if (!id) return;
      S.draws.push(Object.assign({ id: id, name: name, points: points, text: text || "" }, stash[id])); persistDraws();
    }
    function cloneDraw(id) {
      var r = S.draws.filter(function (x) { return x.id === id; })[0]; if (!r) return;
      if (S.draws.length >= C.MAX_DRAWINGS) return toast("Đã đạt tối đa " + C.MAX_DRAWINGS + " nét vẽ cho mỗi mã", 1);
      var pts = r.points.map(function (p) { return { timestamp: p.timestamp, value: p.value * 1.01 }; }), nid = mkOverlay(r.name, pts, r.text, r);
      if (nid) { S.draws.push(Object.assign({}, r, { id: nid, points: pts, lock: false })); persistDraws(); toast("Đã nhân bản (lệch nhẹ để dễ thấy)"); }
    }
    function rebuildDraws(list) {
      S.rebuilding = true; S.silent = true; try { S.k.removeOverlay(); } catch (e) { } S.silent = false; S.draws = [];
      list.forEach(function (u) { try { var id = mkOverlay(u.name, u.points, u.text, u); if (id) S.draws.push(Object.assign({}, u, { id: id, st: stash[id].st })); } catch (e) { console.warn(e); } });
      S.rebuilding = false; persistDraws();
    }
    function setDrawVisible(v) { S.draws.forEach(function (r) { try { S.k.overrideOverlay({ id: r.id, visible: v }); } catch (e) { } }); }

    /* So sánh mã: đường % chuẩn hóa trong ô riêng. Chỉ dùng dữ liệu thật của từng mã; mã nào lỗi thì loại và báo. */
    async function buildCmp() {
      var mySeq = S.seq, L = S.layout;
      L.cmp = L.cmp.filter(function (s) { return s !== S.sym; });
      if (S.k && S.panes.__cmp) { try { S.k.removeIndicator(S.panes.__cmp, S.panes.__cmpName); } catch (e) { } delete S.panes.__cmp; }
      S.cmp = null;
      if (!L.cmp.length) { drawLegend(); return; }
      var days = C.daysFor(S.res);
      var got = await Promise.all(L.cmp.map(function (s) { return api("/api/analysis/" + encodeURIComponent(s) + "?resolution=" + S.res + "&days=" + days).then(function (r) { return { s: s, r: r }; }).catch(function (e) { return { s: s, e: e }; }); }));
      if (!ok() || mySeq !== S.seq || !S.k) return;
      var series = {}, order = [S.sym], failed = [];
      series[S.sym] = S.d.candles;
      got.forEach(function (g) { if (g.r && g.r.candles && g.r.candles.length) { series[g.s] = g.r.candles; order.push(g.s); } else failed.push(g.s + (g.e ? " (" + g.e.message + ")" : "")); });
      if (failed.length) { toast("Không tải được dữ liệu so sánh: " + failed.join("; "), 1); L.cmp = L.cmp.filter(function (s) { return order.indexOf(s) >= 0; }); saveLayout(); }
      if (order.length < 2) { drawLegend(); return; }
      var r = C.buildCompare(order, series, S.res);
      if (r.error) { toast(r.error + " Đã bỏ so sánh.", 1); L.cmp = []; saveLayout(); drawLegend(); return; }
      var byKey = {}; r.rows.forEach(function (row) { byKey[row.key] = row.vals; });
      var name = "NHIP_CMP_" + (++cmpSeq);
      try {
        window.klinecharts.registerIndicator({
          name: name, shortName: "So sánh %", precision: 2,
          figures: order.map(function (s, i) { return { key: "s" + i, title: s + ": ", type: "line" }; }),
          calc: function (list) {
            return list.map(function (b) {
              var vals = byKey[C.barKey(b.timestamp, S.res)], o = {};
              if (vals) order.forEach(function (s, i) { if (vals[s] != null) o["s" + i] = vals[s]; });
              return o;
            });
          }
        });
        var id = S.k.createIndicator({ name: name, styles: { lines: order.map(function (s, i) { return { style: "solid", smooth: false, size: 1.6, dashedValue: [2, 2], color: C.CMP_COLORS[i % C.CMP_COLORS.length] }; }) } }, false, { height: paneH() + 26 });
        S.panes.__cmp = id; S.panes.__cmpName = name;
      } catch (e) { console.warn("charts: không vẽ được so sánh", e); toast("Không vẽ được đường so sánh trên phiên bản biểu đồ này.", 1); }
      S.cmp = r; drawLegend();
    }
    function drawLegend() {
      var el = $("#cx-legend"); if (!el) return;
      if (!S.cmp) { el.innerHTML = ""; el.hidden = true; return; }
      el.hidden = false;
      el.innerHTML = '<span class="cx-lg-h">So sánh % từ ' + esc(S.cmp.baseKey) + ":</span>" + S.cmp.order.map(function (s, i) {
        var v = S.cmp.latest[s];
        return '<span class="cx-chip"><i style="background:' + C.CMP_COLORS[i % C.CMP_COLORS.length] + '"></i><b>' + esc(s) + "</b> " + (v == null ? "—" : '<span class="' + (v < 0 ? "dn" : "up") + '">' + (v > 0 ? "+" : "") + num(v, 2) + "%</span>") + (i > 0 ? ' <button type="button" data-rmcmp="' + esc(s) + '" aria-label="Bỏ ' + esc(s) + '">✕</button>' : "") + "</span>";
      }).join("");
    }

    /* Readout OHLC theo con trỏ (tiếng Việt, theo nến thật) */
    function drawRO(idx) {
      var el = $("#cx-ro"), cs = S.d && S.d.candles; if (!el || !cs || !cs.length) return;
      var i = idx == null || idx < 0 || idx >= cs.length ? cs.length - 1 : idx, b = C.barChange(cs, i), c = b.bar;
      el.innerHTML = '<span class="cx-ro-d">' + esc(fmtDate(c.time, S.res)) + "</span>" +
        "<span>Mở <b>" + fp(c.open) + "</b></span><span>Cao <b>" + fp(c.high) + "</b></span><span>Thấp <b>" + fp(c.low) + "</b></span><span>Đóng <b>" + fp(c.close) + "</b></span>" +
        (b.change != null ? '<span class="' + (b.change < 0 ? "dn" : "up") + '">' + (b.change > 0 ? "+" : "") + fp(b.change) + " (" + pc(b.pct) + ")</span>" : "") +
        "<span>KL <b>" + volFmt(c.volume) + "</b></span>";
    }
    var roRaf = 0;
    function wireCrosshair() {
      try {
        S.k.subscribeAction("onCrosshairChange", function (p) {
          if (roRaf) return;
          roRaf = requestAnimationFrame(function () {
            roRaf = 0;
            if (!ok() || !S.d) return;
            var idx = p && typeof p.dataIndex === "number" ? p.dataIndex : (p && p.kLineData ? C.indexByTs(S.d.candles, p.kLineData.timestamp) : -1);
            drawRO(idx);
          });
        });
      } catch (e) { console.warn("charts: không gắn được crosshair", e); }
    }

    function buildChart() {
      var el = $("#chart"); if (!el || !S.d) return;
      destroyChart();
      if (!window.klinecharts) { el.innerHTML = '<div class="placeholder">Không tải được thư viện biểu đồ (KLineChart). Kiểm tra kết nối Internet rồi tải lại.</div>'; return; }
      el.innerHTML = "";
      var cs = S.d.candles;
      S.sc = C.priceScale(S.sym, cs[cs.length - 1].close);
      S.data = cs.map(toK);
      var k = window.klinecharts.init(el); S.k = k; if (typeof proK !== "undefined") proK = k;
      try { k.setTimezone("Asia/Ho_Chi_Minh"); } catch (e) { }
      try { k.setPriceVolumePrecision(C.isIndex(S.sym) ? 2 : 0, 0); } catch (e) { }
      try { applyStyles(); } catch (e) { console.warn("charts: styles", e); }
      k.applyNewData(S.data);
      S.layout.inds.forEach(applyInd);
      restoreDraws();
      try { k.setOffsetRightDistance(innerWidth < 700 ? 40 : 64); } catch (e) { }
      try { k.scrollToRealTime(); } catch (e) { }
      wireCrosshair();
      try { S.ob = new ResizeObserver(function () { try { k.resize(); } catch (e) { } }); S.ob.observe(el); } catch (e) { }
      drawRO(-1); syncBar(); syncTools();
      try { window.dispatchEvent(new CustomEvent("nhip:chart-built", { detail: { k: k, el: el, sym: S.sym, res: S.res, sc: S.sc, d: S.d } })); } catch (e) { }
      buildCmp();
    }

    /* ---------- Thanh công cụ & popover ---------- */
    function syncBar() {
      var t = C.CHART_TYPES.filter(function (x) { return x[0] === S.layout.type; })[0];
      $("#bt-type").textContent = (t ? t[1] : "Nến") + " ▾";
      var on = S.layout.inds.filter(function (x) { return x.on; }).length;
      try { on += window.NHIPChartTools ? window.NHIPChartTools.activeCount() : 0; } catch (e) { } /* V2.77: gồm cả Bộ công cụ NHỊP đang vẽ */
      $("#bt-ind").textContent = "Chỉ báo" + (on ? " (" + on + ")" : "");
      $("#bt-cmp").textContent = "So sánh" + (S.layout.cmp.length ? " (" + S.layout.cmp.length + ")" : "");
      $$("#tf button[data-v]").forEach(function (b) { b.classList.toggle("on", b.dataset.v === S.res); });
      var mn = $("#bt-min"), cur = C.TIMEFRAMES.filter(function (t) { return t[0] === S.res && t[4] === "min"; })[0];
      if (mn) { mn.textContent = (cur ? cur[3] : "Phút") + " ▾"; mn.classList.toggle("on", !!cur); }
      var act = $("#tf .on"), tf = $("#tf");
      if (act && tf && tf.scrollWidth > tf.clientWidth) tf.scrollLeft = act.offsetLeft - (tf.clientWidth - act.offsetWidth) / 2; /* chip đang chọn luôn nằm trong tầm nhìn khi hàng cuộn ngang (điện thoại) */
    }
    function syncTools() {
      $$("#cx-rail [data-tool]").forEach(function (b) { b.classList.toggle("on", b.dataset.tool === S.tool); });
      var m = $("#rl-mag"); if (m) { m.classList.toggle("on", S.magnet); m.setAttribute("aria-pressed", S.magnet ? "true" : "false"); }
      var h = $("#rl-hide"); if (h) { h.classList.toggle("on", S.hidden); h.setAttribute("aria-pressed", S.hidden ? "true" : "false"); }
    }
    function closePop() { S.pop = null; var p = $("#cx-pop"); if (p) p.hidden = true; ["#bt-type", "#bt-ind", "#bt-cmp", "#bt-more"].forEach(function (id) { var b = $(id); if (b) b.classList.remove("on"); }); syncMin(); }
    function syncMin() { var mn = $("#bt-min"); if (mn) mn.classList.toggle("on", C.isIntraday(S.res)); }
    function openPop(kind, anchor) {
      if (S.pop === kind) { closePop(); return; }
      closePop(); S.pop = kind;
      var p = $("#cx-pop"); p.innerHTML = ""; p.hidden = false; p.dataset.kind = kind; anchor.classList.add("on");
      renderPop();
      try {
        var host = $("#cpm").getBoundingClientRect(), a = anchor.getBoundingClientRect(), w = Math.min(340, host.width - 12);
        p.style.left = Math.max(6, Math.min(a.left - host.left, host.width - w - 6)) + "px"; p.style.top = (a.bottom - host.top + 6) + "px"; p.style.width = w + "px";
      } catch (e) { }
    }
    var indQuery = "";
    function renderPop() {
      var p = $("#cx-pop"), kind = S.pop; if (!p || !kind) return;
      if (kind === "min") {
        p.innerHTML = '<div class="cx-sec">Khung phút / giờ</div><div class="cx-list">' + C.TIMEFRAMES.filter(function (t) { return t[4] === "min"; }).map(function (t) { return '<button type="button" class="cx-opt ' + (S.res === t[0] ? "on" : "") + '" data-res="' + t[0] + '">' + esc(t[1]) + "</button>"; }).join("") + "</div>";
      } else if (kind === "type") {
        p.innerHTML = '<div class="cx-list">' + C.CHART_TYPES.map(function (t) { return '<button type="button" class="cx-opt ' + (S.layout.type === t[0] ? "on" : "") + '" data-type="' + t[0] + '">' + t[1] + "</button>"; }).join("") + "</div>";
      } else if (kind === "more") {
        p.innerHTML = '<div class="cx-sec">Thang giá</div><div class="cx-seg">' + C.SCALES.map(function (t) { return '<button type="button" class="' + (S.layout.scale === t[0] ? "on" : "") + '" data-scale="' + t[0] + '">' + t[1] + "</button>"; }).join("") + "</div>" +
          '<div class="cx-sec">Dữ liệu</div><button type="button" class="cx-opt ' + (LIVE && LIVE.isEnabled() ? "on" : "") + '" data-act="auto">' + (LIVE && LIVE.isEnabled() ? "✓ " : "") + "Giá chạy trực tiếp (3–15 giây)</button><button type=\"button\" class=\"cx-opt\" data-act=\"reload\">Tải lại dữ liệu</button>" +
          '<div class="cx-sec">Bố cục</div><button type="button" class="cx-opt" data-act="snap">Lưu ảnh biểu đồ (JPG)</button><button type="button" class="cx-opt" data-act="reset">Đặt lại bố cục mặc định</button>' +
          (A ? '<div class="cx-sec">Màu nến</div><div class="cx-colors"><label>Nến tăng <input type="color" id="cx-up" value="' + esc(colors().up) + '"></label><label>Nến giảm <input type="color" id="cx-dn" value="' + esc(colors().dn) + '"></label></div><button type="button" class="cx-opt" data-act="latest">Về nến mới nhất</button>' : "") +
          '<p class="cx-hint">Bố cục (loại biểu đồ, chỉ báo, thang giá, mã so sánh) lưu trên trình duyệt này. Nét vẽ lưu theo từng mã.</p>';
      } else if (kind === "cmp") {
        p.innerHTML = '<div class="cx-sec">So sánh hiệu suất (%) với mã khác</div><form id="cx-cf" class="cx-cf"><input id="cx-ci" list="cx-syms" maxlength="12" placeholder="VD: ' + (function () { var x = (function(){try{return window.NHIPHouse&&NHIPHouse.sample?NHIPHouse.sample():null}catch(e){return null}})(); return x ? x.idx + ', ' + x.sym2 : 'VNINDEX, HPG'; })() + '…" aria-label="Mã so sánh" autocapitalize="characters"><button class="btn primary" type="submit">Thêm</button></form>' +
          '<div class="cx-quick">' + quickCmp().map(function (s) { return '<button type="button" data-addcmp="' + esc(s) + '">' + esc(s) + "</button>"; }).join("") + "</div>" +
          (S.layout.cmp.length ? '<div class="cx-sec">Đang so sánh</div>' + S.layout.cmp.map(function (s) { return '<div class="cx-ir"><b>' + esc(s) + '</b><span class="grow"></span><button type="button" data-rmcmp="' + esc(s) + '">Bỏ</button></div>'; }).join("") : "") +
          '<p class="cx-hint">Tối đa 3 mã. Các đường được chuẩn hóa về 0% tại nến đầu tiên mà mọi mã đều có dữ liệu — không nội suy, không cộng giá tuyệt đối khác thang.</p>';
      } else if (kind === "ind") {
        var ql = norm(indQuery), act = S.layout.inds;
        var match = function (g) { return !ql || norm(g.label + " " + g.full + " " + g.n).indexOf(ql) >= 0; };
        var actRows = act.filter(function (it) { return match(C.IND[it.n]); }).map(function (it) {
          return '<div class="cx-ir ' + (it.on ? "" : "off") + '"><b>' + esc(C.IND[it.n].label) + '</b><input class="cx-p" data-pn="' + it.n + '" value="' + esc(it.p.join(", ")) + '" aria-label="Tham số ' + esc(it.n) + '"><button type="button" data-eye="' + it.n + '">' + (it.on ? "Ẩn" : "Hiện") + '</button><button type="button" data-rmind="' + it.n + '" aria-label="Xóa ' + esc(it.n) + '">✕</button></div>';
        }).join("");
        var addRows = C.INDICATORS.filter(function (g) { return !act.some(function (it) { return it.n === g.n; }) && match(g); }).map(function (g) {
          return '<button type="button" class="cx-add" data-addind="' + g.n + '"><b>' + esc(g.label) + "</b><small>" + esc(g.full) + " · " + (g.cat ? esc(g.cat) + " · " : "") + (g.group === "price" ? "trên giá" : "ô riêng") + "</small></button>";
        }).join("");
        var body = p.querySelector("#cx-ib");
        var html = (actRows ? '<div class="cx-sec">Đang dùng — sửa tham số rồi Enter</div>' + actRows : "") + (addRows ? '<div class="cx-sec">Thêm chỉ báo</div>' + addRows : "") + (!actRows && !addRows ? '<p class="muted">Không có chỉ báo khớp “' + esc(indQuery) + "”.</p>" : "");
        var NT = window.NHIPChartTools, ntCtx = { sym: S.sym, res: S.res, candles: S.d && S.d.candles, d: S.d };
        if (!body) { p.innerHTML = (NT ? NT.popBlock(ntCtx) : "") + '<input id="cx-is" class="cx-search" type="search" placeholder="Tìm chỉ báo…" aria-label="Tìm chỉ báo" value="' + esc(indQuery) + '"><div id="cx-ib" class="cx-ib"></div><p class="cx-hint">Chỉ báo do biểu đồ tính từ chính các nến thật đang hiển thị; không có tín hiệu mua/bán tự động.</p>'; body = p.querySelector("#cx-ib"); }
        else if (NT) { var ntb = p.querySelector("#cx-nt"); if (ntb) ntb.innerHTML = NT.popHTML(ntCtx); }
        body.innerHTML = html;
      }
    }

    /* Nút Mua/Bán ở đầu biểu đồ luôn trỏ đúng mã đang xem (mở tab mới / nhấn giữ vẫn đúng); chỉ số thì tắt nút */
    function syncBuySell() {
      var idx = false; try { idx = !!(window.NHIPPF && window.NHIPPF.isIdx && window.NHIPPF.isIdx(S.sym)); } catch (e) { }
      $$(".cp-actions .tp-bs a").forEach(function (a) { a.setAttribute("href", "#/giao-dich?s=" + encodeURIComponent(S.sym)); a.classList.toggle("is-off", idx); if (idx) { a.setAttribute("aria-disabled", "true"); a.title = S.sym + " là chỉ số — không giao dịch được"; } else { a.removeAttribute("aria-disabled"); a.removeAttribute("title"); } });
    }
    /* ---------- Hành động ---------- */
    async function load(opts) {
      var seq = ++S.seq; opts = opts || {};
      S.sym = C.normalizeSymbol(S.sym) || "FPT"; window.__nhipChartSymbol = S.sym; sessionStorage[KS] = S.sym; sessionStorage[KR] = S.res; if (A) { sessionStorage.sym = S.sym; }
      try { window.dispatchEvent(new CustomEvent("nhip:chart-symbol", { detail: { sym: S.sym } })); } catch (e) { }
      $("#si").value = S.sym; $("#cp-sym").textContent = S.sym; (function () { var sb = $("#cp-sub"); if (sb) { sb.dataset.sym = S.sym; sb.dataset.txt = ""; paintSub(sb); } })(); syncBuySell(); syncWatch(); syncBar(); if (S.mc) S.mc.setSymbol(S.sym); if (S.tr) S.tr.refresh();
      (function () {
        var ps = S._shown; S._shown = S.sym; if (ps === S.sym) return;
        var set = function (id, h) { var e = $(id); if (e) e.innerHTML = h; }, L = function (t) { return '<p class="muted">' + t + "</p>"; }, m = esc(S.sym);
        set("#p-nw", L("Đang tải tin của " + m + "…"));
        set("#an-ev", L("Đang tổng hợp bằng chứng cho " + m + "…"));
        set("#an-ctx", L("Đang so sánh " + m + " với ngành và VN-Index…"));
        set("#an-mtf", L("Đang đối chiếu khung ngày, tuần và tháng của " + m + "…"));
        set("#an-levels", L("Đang tính vùng giá của " + m + "…"));
        set("#an-stats", L("Đang tính chỉ báo của " + m + "…"));
        set("#an-ai-result", L("Mã đang chọn: <b>" + m + "</b>. Nhấn phân tích để tạo nhận định cho " + m + "."));
        var psg = $("#p-sig"); if (psg) psg.innerHTML = ""; var oh0 = $("#cp-ohlc"); if (oh0) oh0.innerHTML = "";
      })();

      $$(".wl-row").forEach(function (r) { r.classList.toggle("on", r.dataset.s === S.sym); });
      try { var rt = /^#\/giao-dich/.test(location.hash) ? "giao-dich" : ROUTE; history.replaceState(null, "", "#/" + rt + "?s=" + encodeURIComponent(S.sym)); } catch (e) { }
      getSyms().then(function (l) { if (!ok() || seq !== S.seq) return; var it = l.filter(function (x) { return x.symbol === S.sym; })[0]; var s = $("#cp-sub"); if (s) { s.dataset.txt = it ? (it.sector || it.name || "") : ""; s.dataset.sym = S.sym; paintSub(s); } });
      if (!seen.has(S.sym)) { seen.add(S.sym); logH("view", "Xem " + S.sym, "Phân tích kỹ thuật " + S.sym); }
      if (!opts.keep) { destroyChart(); $("#chart").innerHTML = '<div class="placeholder">Đang tải biểu đồ…</div>'; $("#cx-ro").innerHTML = ""; $("#cx-legend").innerHTML = ""; }
      api("/api/news?symbol=" + encodeURIComponent(S.sym)).then(function (n) { var nw = $("#p-nw"); if (nw && ok() && seq === S.seq) nw.innerHTML = n.items.map(newsItem).join("") || '<p class="muted">Không có tin nhắc trực tiếp mã này trong RSS (không có nghĩa là không có tin liên quan).</p>'; }).catch(function (e) { var nw = $("#p-nw"); if (nw && ok()) nw.innerHTML = err(e); });
      try {
        var d = await api("/api/analysis/" + encodeURIComponent(S.sym) + "?resolution=" + S.res + "&days=" + C.daysFor(S.res));
        if (!ok() || seq !== S.seq) return;
        if (!d.candles || !d.candles.length) throw new Error("Nguồn không có nến cho mã này");
        S.d = d; proD = d; S.sc = C.priceScale(S.sym, d.candles[d.candles.length - 1].close);
        drawHeader(); drawSignals(); buildChart(); hook("onData", d, false);
      } catch (e) {
        if (!ok() || seq !== S.seq) return;
        S.d = null;
        $("#chart").innerHTML = '<div class="placeholder">' + esc(e.message || "Lỗi dữ liệu") + '. Nhịp Đầu Tư không tự tạo giá thay thế.<br><button type="button" class="btn pale" id="cx-retry" style="margin-top:10px">Thử lại</button></div>';
        var rt = $("#cx-retry"); if (rt) rt.onclick = function () { load(); };
        $("#cp-px").innerHTML = ""; var ohe = $("#cp-ohlc"); if (ohe) ohe.innerHTML = ""; var psg = $("#p-sig"); if (psg) psg.innerHTML = ""; hook("onError", e); $("#cs").innerHTML = ""; $("#cx-ro").innerHTML = "";
      }
    }
    function reapply() { // đổi loại biểu đồ / thang giá không cần tải lại dữ liệu
      if (!S.k) return;
      try { applyStyles(); } catch (e) { console.warn(e); }
    }
    /* ---------- Chế độ ĐA KHUNG: cùng một mã, nhiều khung, một bảng (mô-đun charts-multi.js) ---------- */
    var KM = A ? "analysisMulti" : "multi";
    function setMulti(on) {
      on = !!on; if (on === S.multi) return;
      var h = $("#cx-multi"), p = $("#cpm"), b = $("#bt-multi"); if (!h || !p) return;
      if (on && !window.NHIPMultiChart) { toast("Không tải được mô-đun đa khung — hãy tải lại trang", 1); return; }
      S.multi = on; closePop();
      p.classList.toggle("is-multi", on); h.hidden = !on;
      if (b) { b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); }
      try { sessionStorage[KM] = on ? "1" : "0"; } catch (e) { }
      if (on) {
        S.mc = window.NHIPMultiChart.mount(h, {
          symbol: S.sym, api: api, colors: colors, isDark: isDark, grid: GRC,
          onBuild: function (el, mode) { /* Phiếu lệnh chuyển sang mục Giao dịch riêng. */
            if (S.tr) { S.tr.destroy(); S.tr = null; }
            if (el) el.innerHTML = "";
          },
          onExit: function () { setMulti(false); }, onFull: function () { setFull(!S.full); },
          onOpen: function (res) { setMulti(false); if (S.res !== res) { S.res = res; load(); } }
        });
      } else {
        if (S.tr) { S.tr.destroy(); S.tr = null; } if (S.mc) { S.mc.destroy(); S.mc = null; } h.innerHTML = "";
        setTimeout(function () { try { S.k && S.k.resize(); } catch (e) { } }, 60);
      }
    }
    async function setTool(name) {
      if (!S.k) return;
      if (S.pendingId) { try { S.k.removeOverlay({ id: S.pendingId }); } catch (e) { } S.pendingId = null; }
      var prev = S.tool; S.tool = null;
      if (prev === name) { syncTools(); return; }
      var text = "";
      if (name === "simpleAnnotation") { text = await NhipDlg.prompt({ title: "Thêm ghi chú lên biểu đồ", icon: "edit", label: "Nội dung ghi chú", placeholder: "VD: Vùng cầu mạnh, chờ xác nhận", maxLength: 120, multiline: true, rows: 3, hint: "Sau đó chọn vị trí đặt ghi chú trên biểu đồ.", okText: "Thêm ghi chú" }); if (!text) { syncTools(); return; } text = text.slice(0, 120); }
      S.tool = name; syncTools();
      try {
        var id = mkOverlay(name, null, text); S.pendingId = id || null;
        if (!id) { S.tool = null; syncTools(); toast("Không bắt đầu được công cụ vẽ", 1); }
      } catch (e) { S.tool = null; syncTools(); console.warn(e); toast("Công cụ vẽ không khả dụng trên phiên bản biểu đồ này", 1); }
    }
    function addCmp(raw) {
      var s = C.normalizeSymbol(raw);
      if (!s) return toast("Mã so sánh không hợp lệ", 1);
      if (s === S.sym) return toast("Đó là mã đang xem", 1);
      if (S.layout.cmp.indexOf(s) >= 0) return toast(s + " đã có trong so sánh", 1);
      if (S.layout.cmp.length >= 3) return toast("Tối đa 3 mã so sánh", 1);
      S.layout.cmp.push(s); saveLayout(); syncBar(); buildCmp().then(function () { if (ok() && S.pop === "cmp") renderPop(); });
    }
    function quickCmp() {
      var base = ["VNINDEX", "VN30"].concat(ST.watchlist.slice(0, 4));
      return base.filter(function (s, i, a) { return a.indexOf(s) === i && s !== S.sym && S.layout.cmp.indexOf(s) < 0; }).slice(0, 6);
    }
    function snap() {
      try {
        var url = S.k.getConvertPictureUrl(true, "jpeg", isDark() ? "#141b22" : "#ffffff"), a = document.createElement("a");
        a.href = url; a.download = "NHIP-" + S.sym + "-" + S.res + "-" + new Date().toISOString().slice(0, 10) + ".jpg"; document.body.appendChild(a); a.click(); a.remove();
      } catch (e) { console.warn(e); toast("Không xuất được ảnh biểu đồ", 1); }
    }
    function setFull(on) {
      S.full = on; var p = $("#cpm"); if (!p) return;
      p.classList.toggle("is-full", on); $("#bt-full").setAttribute("aria-label", on ? "Thu nhỏ biểu đồ" : "Phóng to biểu đồ");
      try {
        if (on && p.requestFullscreen) p.requestFullscreen().then(function () { p.dataset.fsReq = "1"; }).catch(function () { });
        else if (!on) { delete p.dataset.fsReq; if (document.fullscreenElement) document.exitFullscreen(); }
      } catch (e) { }
      setTimeout(function () { try { S.k && S.k.resize(); } catch (e) { } }, 120);
    }
    /* v2.64: "Tự cập nhật" = giá chạy trực tiếp (NHIPLive: nến 1 phút hôm nay, 3–15 giây) + tải lại lịch sử mỗi 60 giây. Mặc định BẬT; tắt/bật ở menu ⋯ (khóa nhip.live.off). */
    function setAuto(on) {
      S.layout.auto = on; saveLayout(); clearInterval(S.timer); S.timer = null;
      if (LIVE) LIVE.setEnabled(on);
      S.timer = setInterval(tick, 60000);
    }
    var LIVE = window.NHIPLive ? window.NHIPLive.create({ S: S, ok: ok, toK: function (c) { return toK(c); }, drawHeader: function () { drawHeader(); } }) : null;
    async function tick() {
      if (!ok()) { clearInterval(S.timer); S.timer = null; if (LIVE) LIVE.stop(); return; }
      if (document.hidden || !S.d || !S.k || (LIVE && !LIVE.isEnabled())) return;
      var seq = S.seq;
      try {
        var nd = await api("/api/analysis/" + encodeURIComponent(S.sym) + "?resolution=" + S.res + "&days=" + C.daysFor(S.res));
        if (!ok() || seq !== S.seq || !S.k || !nd.candles || !nd.candles.length) return;
        var oc = S.d.candles, last = oc[oc.length - 1].time;
        if (nd.candles[nd.candles.length - 1].time < last) return;
        nd.candles.filter(function (c) { return c.time >= last; }).forEach(function (c) { S.k.updateData(toK(c)); });
        S.d = nd; proD = nd; S.data = nd.candles.map(toK);
        if (LIVE) LIVE.reapply(); /* giữ nến trực tiếp: giá/cao/thấp/KL không lùi về bản cache cũ */
        drawHeader(); drawSignals(); drawRO(-1); hook("onData", nd, true);
        if (S.layout.cmp.length) buildCmp();
      } catch (e) { console.warn("charts: tự cập nhật lỗi", e); var cs = $("#cs"); if (cs) cs.insertAdjacentHTML("beforeend", '<div class="qline qwarn">Tự cập nhật thất bại — đang giữ dữ liệu trước đó.</div>'); }
    }

    /* ---------- Watchlist / tab phụ (giữ hành vi cũ) ---------- */
    var wlRow = function (x) { return '<button type="button" class="wl-row ' + (x.symbol === S.sym ? "on" : "") + '" data-s="' + x.symbol + '"><b>' + x.symbol + "</b><span>" + (x.error ? "—" : px(x.symbol, x.price)) + '</span><span class="' + (x.changePct < 0 ? "dn" : "up") + '">' + (x.error ? "" : pc(x.changePct)) + "</span></button>"; };
    var drawWl = function () {
      var list = S.wq.length ? S.wq.map(wlRow).join("") : '<p class="muted">Chưa có mã nào.</p>';
      $("#p-wl").innerHTML = '<div class="wl-h">Chỉ số & danh sách theo dõi</div>' + list + (ST.watchlist.length ? "" : '<p class="source-note">Bấm “☆ Theo dõi” để thêm mã đang xem vào danh sách này.</p>');
      $$(".wl-row").forEach(function (r) { r.onclick = function () { if (window.NHIPHouse && !window.NHIPHouse.gate(r.dataset.s)) return; S.sym = r.dataset.s; load(); }; });
    };
    var loadWl = async function () {
      try { S.wq = await quotes(["VNINDEX", "VN30"].concat(ST.watchlist).filter(function (v, i, a) { return a.indexOf(v) === i; })); if (ok()) drawWl(); }
      catch (e) { var pw = $("#p-wl"); if (pw && ok()) pw.innerHTML = err(e, "Không tải được danh sách"); }
    };

    var DP = null;
    try {
      if (window.NHIPDraw) DP = window.NHIPDraw.attach({ S: S, C: C, $: $, $$: $$, esc: esc, toast: toast, ok: ok, api: api, fp: fp, svg: svg, sync: syncTools, setTool: setTool,
        patch: patchDraw, add: addDraw, clone: cloneDraw, rebuild: rebuildDraws, persist: persistDraws });
    } catch (e) { DP = null; console.warn("charts: bộ vẽ nâng cao không khởi động được", e); }
    /* ---------- Gắn sự kiện ---------- */
    $("#sf").onsubmit = function (e) { e.preventDefault(); var s = C.normalizeSymbol($("#si").value); if (!s) return toast("Mã không hợp lệ (2–12 ký tự chữ/số)", 1); if (window.NHIPHouse && !window.NHIPHouse.gate(s, { onCancel: function () { $("#si").value = S.sym; } })) { closePop(); return; } S.sym = s; closePop(); load(); };
    $$("#tf button[data-v]").forEach(function (b) { b.onclick = function () { if (S.res === b.dataset.v) return; S.res = b.dataset.v; closePop(); load(); }; });
    $("#bt-min").onclick = function (e) { openPop("min", e.currentTarget); };
    $("#bt-type").onclick = function (e) { openPop("type", e.currentTarget); };
    $("#bt-ind").onclick = function (e) { indQuery = ""; openPop("ind", e.currentTarget); };
    $("#bt-cmp").onclick = function (e) { openPop("cmp", e.currentTarget); };
    $("#bt-more").onclick = function (e) { openPop("more", e.currentTarget); };
    $("#bt-full").onclick = function () { setFull(!S.full); };
    $("#bt-multi").onclick = function () { setMulti(!S.multi); };
    try { if (sessionStorage[KM] === "1") setMulti(true); } catch (e) { }
    $("#bt-draw").onclick = function (e) { var r = $("#cx-rail"), on = !r.classList.contains("open"); r.classList.toggle("open", on); e.currentTarget.classList.toggle("on", on); e.currentTarget.setAttribute("aria-pressed", on ? "true" : "false"); try { localStorage.setItem("nhip.draw.toolbarOpen", on ? "1" : "0"); } catch (x) {} setTimeout(function () { try { S.k && S.k.resize(); } catch (x) { } }, 60); };
    var railPref = null; try { railPref = localStorage.getItem("nhip.draw.toolbarOpen"); } catch (e) {}
    if (railPref === "1" || (railPref == null && innerWidth >= 1000)) { $("#cx-rail").classList.add("open"); $("#bt-draw").classList.add("on"); $("#bt-draw").setAttribute("aria-pressed", "true"); } else { $("#cx-rail").classList.remove("open"); $("#bt-draw").classList.remove("on"); $("#bt-draw").setAttribute("aria-pressed", "false"); }
    $$("#cx-rail [data-tool]").forEach(function (b) { b.onclick = function () { setTool(b.dataset.tool); }; });
    $("#rl-mag").onclick = function () { if (DP) return DP.cycleMag(); S.magnet = !S.magnet; syncTools(); toast(S.magnet ? "Nét vẽ sẽ hít vào giá O/H/L/C (áp dụng cho nét vẽ mới)" : "Đã tắt hít giá"); };
    $("#rl-hide").onclick = function () { S.hidden = !S.hidden; setDrawVisible(!S.hidden); syncTools(); };
    $("#rl-undo").onclick = function () { if (DP) return DP.undo(); var r = S.draws[S.draws.length - 1]; if (!r) return toast("Chưa có nét vẽ nào"); try { S.k.removeOverlay({ id: r.id }); } catch (e) { } };
    $("#rl-clear").onclick = async function () { if (!S.draws.length) return toast("Chưa có nét vẽ nào"); if (!(await NhipDlg.confirm({ tone: "danger", icon: "trash", title: "Xóa tất cả nét vẽ?", subject: S.sym, message: "Toàn bộ " + S.draws.length + " nét vẽ của mã này sẽ bị xóa khỏi biểu đồ.", note: { tone: "danger", text: "Không thể hoàn tác." }, okText: "Xóa tất cả", cancelText: "Giữ lại" }))) return; S.silent = true; try { S.k.removeOverlay(); } catch (e) { } S.silent = false; S.draws = []; persistDraws(); };

    var pop = $("#cx-pop");
    pop.addEventListener("click", async function (e) {
      var t = e.target.closest("button"); if (!t) return;
      if (t.dataset.res) { var nr = t.dataset.res; closePop(); if (S.res !== nr) { S.res = nr; load(); } return; }
      if (t.dataset.type) { S.layout.type = t.dataset.type; saveLayout(); reapply(); syncBar(); closePop(); }
      else if (t.dataset.scale) { S.layout.scale = t.dataset.scale; saveLayout(); reapply(); renderPop(); }
      else if (t.dataset.act === "auto") { setAuto(!(LIVE && LIVE.isEnabled())); renderPop(); toast(LIVE && LIVE.isEnabled() ? "Đã bật giá chạy trực tiếp (chỉ khi tab đang mở)" : "Đã tắt giá chạy trực tiếp"); }
      else if (t.dataset.act === "reload") { closePop(); load(); }
      else if (t.dataset.act === "snap") { closePop(); snap(); }
      else if (t.dataset.act === "latest") { closePop(); try { S.k.scrollToRealTime(); } catch (e) { } }
      else if (t.dataset.act === "reset") { if (!(await NhipDlg.confirm({ tone: "warn", icon: "reset", title: "Đặt lại biểu đồ về mặc định?", message: "Loại biểu đồ, chỉ báo, thang giá và mã so sánh sẽ trở về mặc định.", note: { tone: "ok", text: "Các nét vẽ của bạn được giữ nguyên." }, okText: "Đặt lại", cancelText: "Hủy" }))) return; var keepAuto = S.layout.auto; S.layout = C.DEFAULT_LAYOUT(); S.layout.auto = keepAuto; saveLayout(); closePop(); S.d && buildChart(); syncBar(); }
      else if (t.dataset.nt) { /* V2.77: bật/tắt công cụ của Bộ công cụ NHỊP (đúng mã, đúng sàn, khung Ngày) */
        var NTc = window.NHIPChartTools, ntr = null;
        try { ntr = NTc ? NTc.toggle(t.dataset.nt, { sym: S.sym, res: S.res, candles: S.d && S.d.candles, d: S.d }) : null; } catch (x) { console.warn(x); }
        if (ntr && ntr.msg) toast(ntr.msg, ntr.err ? 1 : 0);
        syncBar(); renderPop();
      }
      else if (t.dataset.addind) {
        var it = { n: t.dataset.addind, on: true, p: C.IND[t.dataset.addind].def.slice() }; S.layout.inds.push(it); saveLayout();
        if (!applyInd(it)) { S.layout.inds.pop(); saveLayout(); toast("Biểu đồ không thêm được chỉ báo " + it.n, 1); }
        syncBar(); renderPop();
      }
      else if (t.dataset.rmind) { var n = t.dataset.rmind; dropInd(n); S.layout.inds = S.layout.inds.filter(function (x) { return x.n !== n; }); saveLayout(); syncBar(); renderPop(); }
      else if (t.dataset.eye) { var it2 = S.layout.inds.filter(function (x) { return x.n === t.dataset.eye; })[0]; if (it2) { it2.on = !it2.on; try { S.k.overrideIndicator({ name: it2.n, visible: it2.on }, S.panes[it2.n]); } catch (e) { } saveLayout(); syncBar(); renderPop(); } }
      else if (t.dataset.addcmp) addCmp(t.dataset.addcmp);
      else if (t.dataset.rmcmp) { S.layout.cmp = S.layout.cmp.filter(function (s) { return s !== t.dataset.rmcmp; }); saveLayout(); syncBar(); buildCmp().then(function () { if (ok() && S.pop === "cmp") renderPop(); }); }
    });
    pop.addEventListener("input", function (e) { if (e.target.id === "cx-is") { indQuery = e.target.value; renderPop(); } });
    pop.addEventListener("change", function (e) {
      if (e.target.id === "cx-up" || e.target.id === "cx-dn") {
        if (e.target.id === "cx-up") analysisPrefs.up = e.target.value; else analysisPrefs.down = e.target.value;
        try { saveAnalysisPrefs(); } catch (x) { } if (S.d) buildChart(); return;
      }
      var inp = e.target.closest("input.cx-p"); if (!inp) return;
      var n = inp.dataset.pn, it = S.layout.inds.filter(function (x) { return x.n === n; })[0]; if (!it) return;
      var np = C.sanitizeParams(n, inp.value), ask = String(inp.value).split(/[\s,;]+/).filter(Boolean).map(Number);
      if (JSON.stringify(np) === JSON.stringify(C.IND[n].def) && JSON.stringify(ask) !== JSON.stringify(C.IND[n].def)) toast("Tham số chưa hợp lệ cho " + n + " — dùng mặc định " + C.IND[n].def.join(", "), 1);
      it.p = np; saveLayout();
      try { S.k.overrideIndicator({ name: n, calcParams: np }, S.panes[n]); } catch (e) { console.warn(e); dropInd(n); applyInd(it); }
      renderPop();
    });
    pop.addEventListener("submit", function (e) { if (e.target.id === "cx-cf") { e.preventDefault(); var v = $("#cx-ci").value; $("#cx-ci").value = ""; addCmp(v); } });
    $("#cx-legend").addEventListener("click", function (e) { var t = e.target.closest("[data-rmcmp]"); if (!t) return; S.layout.cmp = S.layout.cmp.filter(function (s) { return s !== t.dataset.rmcmp; }); saveLayout(); syncBar(); buildCmp(); });

    var onDoc = function (e) {
      if (!ok()) { document.removeEventListener("click", onDoc, true); document.removeEventListener("keydown", onKey, true); document.removeEventListener("fullscreenchange", onFs); return; }
      if (S.pop && !e.target.closest("#cx-pop, .cx-btn")) closePop();
    };
    var onKey = function (e) {
      if (!ok()) return;
      if (e.key === "Escape") { if (S.pop) closePop(); else if (S.tool) setTool(S.tool); else if (S.full) setFull(false); }
    };
    var onFs = function () { var p = $("#cpm"); if (ok() && S.full && p && p.dataset.fsReq && !document.fullscreenElement) setFull(false); };
    document.addEventListener("click", onDoc, true); document.addEventListener("keydown", onKey, true); document.addEventListener("fullscreenchange", onFs);

    $$("#tabs button").forEach(function (b) { b.onclick = function () { $$("#tabs button").forEach(function (x) { x.classList.toggle("on", x === b); }); ["wl", "sig", "nw"].forEach(function (t) { $("#p-" + t).hidden = t !== b.dataset.t; }); }; });
    $("#aw").onclick = async function () { ST.watchlist = ST.watchlist.indexOf(S.sym) >= 0 ? ST.watchlist.filter(function (x) { return x !== S.sym; }) : [S.sym].concat(ST.watchlist); await saveWatch(); syncWatch(); loadWl(); };
    $("#ak").onclick = function () {
      if (A && opts.onAsk) return hook("onAsk");
      var inds = S.layout.inds.filter(function (x) { return x.on; }).map(function (x) { return x.n; }).join(", ");
      sessionStorage.pending = JSON.stringify({ symbol: S.sym, question: "Phân tích kỹ thuật " + S.sym + " khung " + tfLabel() + (inds ? " (chỉ báo đang xem: " + inds + ")" : "") + " dựa trên dữ liệu đang có; nêu bằng chứng, điều kiện xác nhận/phủ định và rủi ro cần lưu ý.", withNews: 1 });
      location.hash = "#/ai";
    };

    getSyms().then(function (l) { var dl = $("#cx-syms"); if (dl && ok()) dl.innerHTML = l.map(function (x) { return '<option value="' + esc(x.symbol) + '">' + esc(x.sector || x.name || "") + "</option>"; }).join(""); });
    S.timer = setInterval(tick, 60000);
    if (LIVE) LIVE.start();
    hook("onReady");
    syncBar(); loadWl(); load();
  }
  /* v1.73.3: dòng phụ dưới mã = nhãn SÀN (HOSE/HNX/UPCoM) + ngành/tên. Chỉ số không có sàn. */
  function paintSub(s) {
    if (!s) return; var N = window.NHIPOrders, sy = s.dataset.sym || "", idx = window.NHIPPF && window.NHIPPF.isIdx && window.NHIPPF.isIdx(sy);
    s.innerHTML = (!idx && sy && N && N.exTag ? '<div class="cx-ex">' + N.exTag(sy) + "</div>" : "") + (s.dataset.txt ? '<div class="cx-sector">' + esc(s.dataset.txt) + "</div>" : ""); /* mã đứng riêng; sàn nằm trên, ngành nằm dưới */
  }
  window.addEventListener("nhip:exch-changed", function () { paintSub(document.getElementById("cp-sub")); });
  window.vCharts = vCharts;
})();
