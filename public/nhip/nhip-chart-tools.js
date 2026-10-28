/* NHIP Chart Tools v1.2 (V2.79: mở rộng tới khung 3 tháng · 6 tháng · 1 năm · 3 năm · 5 năm, cả biểu đồ một khung lẫn Đa khung) — v1.1 (V2.78: 1 phút → 1 tháng + đa khung) — gốc v1.0 (V2.77) — "BỘ CÔNG CỤ NHỊP" nằm TRÊN CÙNG hộp "Chỉ báo" của biểu đồ (Biểu đồ · Phân tích · Giao dịch dùng chung vCharts).
   Là các công cụ của tab Bằng chứng (Phân tích), đưa ra biểu đồ để nhìn trực tiếp trên giá:
     RSIx · Fade2 (2 công cụ chấm điểm) + Supertrend · SMA 20/50 · EMA 12/26 · AO · Turtle · Stoch nghịch (công cụ tham khảo đã kiểm chứng theo sàn).
   Nguyên tắc (khớp tab Bằng chứng, dùng chung nguồn số liệu nhip-vscore.js — không có con số nào tự đặt ở đây):
   • ĐÚNG SÀN: sàn của mã lấy từ danh bạ (NHIPExchange ← symbols-vn.js). Mỗi sàn chỉ hiện đúng những công cụ mà báo cáo kiểm chứng có số cho sàn đó
     (HOSE 8 · HNX 5 · UPCoM 5). Chưa rõ sàn → KHÔNG hiện công cụ nào (không đoán). Chỉ số (VNINDEX…) → không áp dụng.
   • ĐÚNG MÃ: đường vẽ tính từ chính nến của mã đang xem; đổi mã/đổi sàn → bộ công cụ và đường vẽ đổi theo.
   • ĐA KHUNG THỜI GIAN (V2.78 → V2.79): vẽ được ở 1p · 5p · 15p · 30p · 1h · Ngày · Tuần · Tháng · 3 tháng · 6 tháng · 1 năm · 3 năm · 5 năm (cả biểu đồ một khung lẫn từng ô của chế độ Đa khung).
     Kiểm chứng chỉ làm trên nến NGÀY → ở khung khác công thức/tham số GIỮ NGUYÊN (tính theo số nến của khung đó) nhưng CHƯA kiểm chứng riêng; giao diện ghi rõ và số liệu hiển thị luôn gắn nhãn "khung Ngày".
     Khung dài (3T–5N, V2.79): mỗi nến gộp 3/6/12/36/60 tháng nên số nến ít — công cụ nào chưa đủ nến thì ghi rõ "cần ≥ N nến (hiện có M)" và không cho bật (không đoán). Trạng thái luôn tính trên nến ĐÃ ĐÓNG của chính khung đó (bỏ nến đang chạy).
   • ĐÚNG CÔNG THỨC: tham số lấy từ NHIPStrategies/NHIPVScore (đúng bộ đã kiểm chứng); đường vẽ chỉ dùng dữ liệu TRƯỚC nến đang xét (nhân quả).
   • Lựa chọn nhớ theo SÀN (localStorage "nhip.ctools.v1"); mặc định không bật công cụ nào.
   Lõi tính toán thuần (không DOM) chạy được trong Node; phần biểu đồ chỉ chạy khi có KLineChart. Cần NHIPStrategies, NHIPVScore; NHIPExchange (nên có). */
(function (W) {
  "use strict";
  var VS = W.NHIPVScore, NS = W.NHIPStrategies;
  if (!VS || !NS) { try { console.warn("nhip-chart-tools: thiếu NHIPVScore/NHIPStrategies"); } catch (e) { } return; }
  var LSKEY = "nhip.ctools.v1";
  var KEYS = VS.KEYS, LABEL = VS.LABEL, EXCH = VS.EXCH, FULL = VS.FULL;

  /* ---------- tiện ích ---------- */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function fin(v) { return typeof v === "number" && isFinite(v); }
  function nf(v, d) { return fin(v) ? v.toLocaleString("vi-VN", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—"; }
  function sg(v, d) { return fin(v) ? (v > 0 ? "+" : v < 0 ? "−" : "") + nf(Math.abs(v), d) : "—"; }
  function pct(v, d) { return fin(v) ? sg(v, d == null ? 1 : d) + "%" : "—"; }
  function dmy2(s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ""); return m ? m[3] + "/" + m[2] + "/" + m[1].slice(2) : String(s || "—"); }
  function arr(n, v) { var a = new Array(n); for (var i = 0; i < n; i++) a[i] = v; return a; }

  /* ---------- tham số: đúng bộ đã kiểm chứng ---------- */
  var P = {
    rsix: VS.PARAMS.rsix, fade2: VS.PARAMS.fade2,
    supertrend: NS.effectiveParams("supertrend"), sma: NS.effectiveParams("sma"), ema: NS.effectiveParams("ema"),
    ao: NS.effectiveParams("ao"), turtle: NS.effectiveParams("turtle"), stoch: NS.effectiveParams("stoch")
  };

  /* ---------- tính các đường vẽ (hàm thuần; mỗi hàng i CHỈ dùng nến ≤ i hoặc < i) ---------- */
  function cols(cs) { return { o: cs.map(function (x) { return +x.open; }), h: cs.map(function (x) { return +x.high; }), l: cs.map(function (x) { return +x.low; }), c: cs.map(function (x) { return +x.close; }), n: cs.length }; }
  /* đỉnh/đáy của n nến NGAY TRƯỚC nến i (không gồm i) — đúng mốc mà tín hiệu so với giá đóng cửa của nến i */
  function prevHi(x, n) { var o = arr(x.length, NaN); for (var i = n; i < x.length; i++) { var m = -Infinity; for (var k = i - n; k < i; k++) if (x[k] > m) m = x[k]; o[i] = m; } return o; }
  function prevLo(x, n) { var o = arr(x.length, NaN); for (var i = n; i < x.length; i++) { var m = Infinity; for (var k = i - n; k < i; k++) if (x[k] < m) m = x[k]; o[i] = m; } return o; }
  function winHi(x, n) { var o = arr(x.length, NaN); for (var i = n - 1; i < x.length; i++) { var m = -Infinity; for (var k = i - n + 1; k <= i; k++) if (x[k] > m) m = x[k]; o[i] = m; } return o; }
  function winLo(x, n) { var o = arr(x.length, NaN); for (var i = n - 1; i < x.length; i++) { var m = Infinity; for (var k = i - n + 1; k <= i; k++) if (x[k] < m) m = x[k]; o[i] = m; } return o; }
  /* Supertrend — cùng thuật toán với NHIPStrategies (supertrend): dải trên/dưới, hướng 1 = tăng, −1 = giảm */
  function stBands(cs, p) {
    var A = cols(cs), n = A.n, a = NS._h.atr(A.h, A.l, A.c, p.period), fu = arr(n, NaN), fl = arr(n, NaN), dir = arr(n, 0), i;
    for (i = 0; i < n; i++) {
      if (!fin(a[i])) continue;
      var mid = (A.h[i] + A.l[i]) / 2, bu = mid + p.mult * a[i], bl = mid - p.mult * a[i];
      if (i === 0 || !fin(fu[i - 1])) { fu[i] = bu; fl[i] = bl; dir[i] = 1; continue; }
      fu[i] = (bu < fu[i - 1] || A.c[i - 1] > fu[i - 1]) ? bu : fu[i - 1];
      fl[i] = (bl > fl[i - 1] || A.c[i - 1] < fl[i - 1]) ? bl : fl[i - 1];
      dir[i] = A.c[i] > fu[i - 1] ? 1 : (A.c[i] < fl[i - 1] ? -1 : dir[i - 1]);
    }
    return { fu: fu, fl: fl, dir: dir };
  }
  function stochKD(cs, p) {
    var A = cols(cs), H = winHi(A.h, p.period), L = winLo(A.l, p.period);
    var raw = A.c.map(function (v, i) { var r = H[i] - L[i]; return fin(r) ? (r > 0 ? 100 * (v - L[i]) / r : 50) : NaN; });
    var K = NS._h.sma(raw, p.k), D = NS._h.sma(K, p.d); return { K: K, D: D };
  }
  function rows(n, f) { var o = new Array(n); for (var i = 0; i < n; i++) o[i] = f(i) || {}; return o; }
  function put(o, k, v) { if (fin(v)) o[k] = v; return o; }

  var CALC = {
    rsix: function (cs) { var p = P.rsix, r = NS._h.rsi(cs.map(function (x) { return +x.close; }), p.period); return rows(cs.length, function (i) { var o = {}; if (fin(r[i])) { o.rsi = r[i]; o.lo = p.low; o.hi = p.high; } return o; }); },
    fade2: function (cs, ind) {
      /* đáy/đỉnh (đường vẽ) + tín hiệu MUA/BÁN đánh dấu bằng mũi tên (V2.92) — cùng luật với NHIPStrategies · fade2 (machine):
         đang đứng ngoài: nến ĐÓNG CỬA thủng đáy `low` nến trước → MUA; đang giữ: nến đóng cửa vượt đỉnh `high` nến trước → BÁN. */
      var p = P.fade2, A = cols(cs), lo = prevLo(A.l, p.low), hi = prevHi(A.h, p.high), n = cs.length, on = false, out = rows(n, function (i) { return put(put({}, "lo", lo[i]), "hi", hi[i]); }), i;
      for (i = 0; i < n; i++) {
        var e = fin(lo[i]) && A.c[i] < lo[i], x = fin(hi[i]) && A.c[i] > hi[i];
        if (!on) { if (e && !x) { on = true; out[i].sig = 1; out[i].px = A.l[i]; } }
        else if (x) { on = false; out[i].sig = -1; out[i].px = A.h[i]; }
      }
      /* tín hiệu ở nến CUỐI mà nến đó còn đang chạy → chưa xác nhận (vẽ mờ) */
      if (n && out[n - 1].sig) { var res = ind && ind.extendData != null ? ind.extendData : (ind && ind.calcParams && ind.calcParams[0]); if (res != null && pendingBar(cs[n - 1], String(res), nowMs())) out[n - 1].pend = true; }
      return out;
    },
    turtle: function (cs) { var p = P.turtle, A = cols(cs), hi = prevHi(A.h, p.entry), lo = prevLo(A.l, p.exit); return rows(cs.length, function (i) { return put(put({}, "hi", hi[i]), "lo", lo[i]); }); },
    supertrend: function (cs) { var b = stBands(cs, P.supertrend); return rows(cs.length, function (i) { var o = {}; if (b.dir[i] === 1 && fin(b.fl[i])) o.up = b.fl[i]; else if (b.dir[i] === -1 && fin(b.fu[i])) o.dn = b.fu[i]; return o; }); },
    sma: function (cs) { var c = cols(cs).c, a = NS._h.sma(c, P.sma.fast), b = NS._h.sma(c, P.sma.slow); return rows(cs.length, function (i) { return put(put({}, "fast", a[i]), "slow", b[i]); }); },
    ema: function (cs) { var c = cols(cs).c, a = NS._h.ema(c, P.ema.fast), b = NS._h.ema(c, P.ema.slow); return rows(cs.length, function (i) { return put(put({}, "fast", a[i]), "slow", b[i]); }); },
    ao: function (cs) { var A = cols(cs), md = A.h.map(function (h, i) { return (h + A.l[i]) / 2; }), f = NS._h.sma(md, P.ao.fast), s = NS._h.sma(md, P.ao.slow); return rows(cs.length, function (i) { return put({}, "ao", f[i] - s[i]); }); },
    stochr: function (cs) { var kd = stochKD(cs, P.stoch); return rows(cs.length, function (i) { var o = {}; if (fin(kd.K[i]) && fin(kd.D[i])) { o.k = kd.K[i]; o.d = kd.D[i]; o.lo = 20; o.hi = 80; } return o; }); }
  };

  /* ---------- cách vẽ từng công cụ trên KLineChart (chỉ dùng figure "line"/"bar" — loại đã chạy ổn ở indicators.js) ---------- */
  var C1 = "#0ea5a4", C2 = "#d97706", C3 = "#6366f1", C4 = "#a855f7";
  function ln(key, title, color, dash) { return { key: key, title: title, type: "line", color: color, dash: !!dash }; }
  var VIS = {
    rsix: { ind: "NT_RSIX", short: "RSIx", pane: true, figs: [ln("rsi", "RSI " + P.rsix.period + ": ", C3), ln("lo", "Mốc mua " + P.rsix.low + ": ", C1, true), ln("hi", "Mốc bán " + P.rsix.high + ": ", C2, true)], where: "ô riêng" },
    fade2: { ind: "NT_FADE2", short: "Fade2", pane: false, figs: [ln("lo", "Đáy " + P.fade2.low + " nến: ", C1), ln("hi", "Đỉnh " + P.fade2.high + " nến: ", C2)], where: "trên giá · mũi tên Mua/Bán", draw: drawFade2 },
    turtle: { ind: "NT_TURTLE", short: "Turtle", pane: false, figs: [ln("hi", "Đỉnh " + P.turtle.entry + " nến: ", C1), ln("lo", "Đáy " + P.turtle.exit + " nến: ", C2)], where: "trên giá" },
    supertrend: { ind: "NT_SUPERTREND", short: "Supertrend", pane: false, figs: [ln("up", "Supertrend tăng: ", C1), ln("dn", "Supertrend giảm: ", C2)], where: "trên giá" },
    sma: { ind: "NT_SMA", short: "SMA", pane: false, figs: [ln("fast", "SMA " + P.sma.fast + ": ", C3), ln("slow", "SMA " + P.sma.slow + ": ", C4)], where: "trên giá" },
    ema: { ind: "NT_EMA", short: "EMA", pane: false, figs: [ln("fast", "EMA " + P.ema.fast + ": ", C3), ln("slow", "EMA " + P.ema.slow + ": ", C4)], where: "trên giá" },
    ao: { ind: "NT_AO", short: "AO", pane: true, figs: [{ key: "ao", title: "AO " + P.ao.fast + "/" + P.ao.slow + ": ", type: "bar", baseValue: 0 }], where: "ô riêng" },
    stochr: { ind: "NT_STOCH", short: "Stoch", pane: true, figs: [ln("k", "%K: ", C3), ln("d", "%D: ", C4), ln("lo", "20: ", C1, true), ln("hi", "80: ", C2, true)], where: "ô riêng" }
  };
  var ROLE = { score: "Chấm điểm", filter: "Bộ lọc xu hướng", ref: "Tham khảo", trial: "Thử nghiệm" };
  var STATE_TXT = { buy_new: ["Mua mới", "up"], sell_new: ["Bán mới", "dn"], long: ["Đang mua", "up"], flat: ["Đứng ngoài", "mid"], na: ["Chưa đủ nến", "mid"] };
  var IDXRE = /^(VNINDEX|VN30|VN100|VNALL|VNMID|VNSML|HNX\w*|UPCOM\w*)$/;

  /* ---------- sàn của mã (tự động; không chọn tay) ---------- */
  function normEx(v) {
    if (v == null || typeof v === "object") return null;
    var s = String(v).toUpperCase().replace(/[^A-Z]/g, "");
    return s === "HOSE" || s === "HSX" ? "HOSE" : s === "HNX" || s === "HASTC" ? "HNX" : s === "UPCOM" ? "UPCOM" : null;
  }
  function exOf(o) { if (!o || typeof o !== "object") return null; var f = ["exchange", "exch", "floor", "market", "board"]; for (var i = 0; i < f.length; i++) { var e = normEx(o[f[i]]); if (e) return e; } return null; }
  function isIdx(sym) { var s = String(sym || "").toUpperCase(); try { if (W.NHIPChartsCore && W.NHIPChartsCore.isIndex && W.NHIPChartsCore.isIndex(s)) return true; } catch (e) { } return IDXRE.test(s); }
  /* Thứ tự (giống tab Bằng chứng): chỉ số → loại · danh bạ mã (symbols-vn.js là chuẩn) → trường sàn trong dữ liệu → không rõ */
  function exchangeOf(sym, d) {
    sym = String(sym || "").toUpperCase();
    if (isIdx(sym)) return { key: null, idx: true, src: "index" };
    var e = null;
    try { var r = W.NHIPExchange && W.NHIPExchange.resolve ? W.NHIPExchange.resolve(sym) : null; e = r && r.known ? normEx(r.ex) : null; if (e) return { key: e, src: "list" }; } catch (x) { }
    var objs = [d, d && d.meta, d && d.info, d && d.profile];
    for (var i = 0; i < objs.length; i++) if ((e = exOf(objs[i]))) return { key: e, src: "data" };
    return { key: null, src: "none" };
  }

  /* ---------- danh mục công cụ của từng sàn: đúng những công cụ báo cáo kiểm chứng có số cho sàn đó ---------- */
  function toolsFor(ex, res) {
    var E = ex && EXCH[ex], F = ex && FULL[ex], out = [], un = unitOf(res);
    if (!E || !F) return out;
    VS.TOOLS.forEach(function (t) {
      var x = E[t.id];
      out.push({ id: t.id, name: t.name, kind: "score", role: ROLE.score, def: t.id === "rsix" ? "RSI(" + P.rsix.period + ") · " + P.rsix.low + "/" + P.rsix.high : "đáy " + P.fade2.low + " / đỉnh " + P.fade2.high + " " + un, rule: t.rule, vis: VIS[t.id],
        stat: { span: "Ngoài mẫu 10/2024–10/2026 · " + E.n + " mã " + LABEL[ex], edge: x.edge, net: x.net, netText: x.netText || null, bh: E.bh } });
    });
    VS.EXTRA.forEach(function (x) {
      var d = F.tools[x.id]; if (!d || !VIS[x.id]) return;
      out.push({ id: x.id, name: x.name, kind: d.role, role: ROLE[d.role] || "Tham khảo", def: x.def, rule: x.rule, vis: VIS[x.id], read: d.read,
        stat: { span: "5 năm · " + F.span, edge: d.edge, net: d.net, netText: null, bh: F.bh } });
    });
    return out;
  }
  function stateOf(V, id) { return V && V.ready ? (V.tools && V.tools[id]) || (V.extra && V.extra[id]) || null : null; }

  /* ---------- khung thời gian được hỗ trợ (V2.78) ---------- */
  var TF = ["1", "5", "15", "30", "60", "120", "180", "240", "D", "W", "M", "3M", "6M", "1Y", "3Y", "5Y"];   /* 1 phút → 5 năm (V2.79); thêm 2h · 3h · 4h (V2.92) */
  var LONG_M = { "3M": 3, "6M": 6, "1Y": 12, "3Y": 36, "5Y": 60 };                   /* số tháng của mỗi nến khung dài — khớp charts-core.js */
  var RANGE_TXT = "1 phút đến 5 năm";
  var TF_MIN = { "1": 1, "5": 5, "15": 15, "30": 30, "60": 60, "120": 120, "180": 180, "240": 240 };    /* số phút của nến phút/giờ */
  var TF_GROUP = { "120": 1, "180": 1, "240": 1 };   /* 2h/3h/4h: nến gộp từ nến 1 giờ theo từng ngày (có thể vắt qua giờ nghỉ trưa) → không dùng "bắt đầu + số phút" để biết nến còn chạy hay không */
  function supported(res) { return TF.indexOf(String(res)) >= 0; }
  function unitOf(res) { return String(res || "D") === "D" ? "phiên" : "nến"; }
  function isLongRes(res) { return !!LONG_M[String(res)]; }
  function lastBizDay(day) { while (((day + 4) % 7) === 0 || ((day + 4) % 7) === 6) day--; return day; }   /* ngày-số (kể từ 1970) của ngày làm việc gần nhất ≤ day */
  function nowMs() { try { if (VS._t && VS._t.nowMs) return VS._t.nowMs(); } catch (e) { } return Date.now(); }
  function vnp(ms) { var d = new Date(ms + 7 * 3600e3); return { day: Math.floor((ms + 7 * 3600e3) / 864e5), dow: d.getUTCDay(), hour: d.getUTCHours() + d.getUTCMinutes() / 60, mi: d.getUTCFullYear() * 12 + d.getUTCMonth() }; }
  /* Nến cuối còn đang chạy (chưa đóng)? — phút/giờ: chưa hết thời lượng nến; tuần: còn trong tuần giao dịch hiện tại; tháng: còn trong tháng hiện tại */
  function forming(c, res, now) {
    res = String(res); var t = c.time < 1e11 ? c.time * 1000 : c.time;
    if (TF_GROUP[res]) { var g1 = vnp(t), g2 = vnp(now); return g1.day === g2.day && g2.dow >= 1 && g2.dow <= 5 && g2.hour >= 9 && g2.hour < 15; }   /* V2.92: nến 2h/3h/4h cuối của hôm nay coi là đang chạy cho tới hết phiên (thận trọng; khớp nhip-runtime.js · assess) */
    if (TF_MIN[res]) return now >= t && now < t + TF_MIN[res] * 60000;
    var a = vnp(t), b = vnp(now);
    if (res === "W") { if (Math.floor((a.day + 3) / 7) !== Math.floor((b.day + 3) / 7)) return false; return !(b.dow === 0 || b.dow === 6 || (b.dow === 5 && b.hour >= 15)); }
    if (res === "M") return a.mi === b.mi;
    if (LONG_M[res]) {   /* khung dài: còn "đang chạy" nếu hôm nay vẫn nằm trong cột mốc của nến cuối, trừ khi đã qua phiên cuối của tháng cuối cột mốc (khớp nhip-runtime.js · assess) */
      var N = LONG_M[res], bk = Math.floor(a.mi / N);
      if (bk !== Math.floor(b.mi / N)) return false;
      var endMi = (bk + 1) * N, ey = Math.floor((endMi - 1) / 12), em = (endMi - 1) % 12;
      var lastBiz = lastBizDay(Math.floor(Date.UTC(ey, em + 1, 0) / 864e5));
      return !(b.day > lastBiz || (b.day === lastBiz && b.hour >= 15));
    }
    return false;
  }
  /* nến (của KLineChart: timestamp ms; hoặc nến NHỊP: time giây) còn đang chạy? — thêm khung Ngày: hôm nay trong giờ phiên */
  function pendingBar(c, res, now) {
    if (!c) return false;
    var ts = c.timestamp != null ? c.timestamp : c.time, t = ts < 1e11 ? ts * 1000 : ts;
    if (res === "D") { var a = vnp(t), b = vnp(now); return a.day === b.day && b.dow >= 1 && b.dow <= 5 && b.hour >= 9 && b.hour < 15; }
    return forming({ time: t }, res, now);
  }
  /* khung Ngày: để NHIPVScore.analyze tự xử lý như cũ; khung khác: bỏ nến đang chạy tại đây */
  function closedOnly(cs, res, now) { if (String(res) === "D" || !cs || !cs.length) return cs; return forming(cs[cs.length - 1], res, now) ? cs.slice(0, -1) : cs; }
  function analyzeFrame(cs, res) {
    res = String(res || "D");
    if (res === "D") return VS.analyze(cs);
    var c = closedOnly(cs, res, nowMs());
    if (!c.length) return { ready: false, reason: "Chưa có nến đã đóng." };
    var V = VS.analyze(c, { closed: true }); V.dropped = c.length !== cs.length; return V;
  }
  function fmtBar(sec, res) {
    var d = new Date(sec * 1000 + 7 * 3600e3), p = function (n) { return (n < 10 ? "0" : "") + n; }; res = String(res);
    if (TF_MIN[res]) return p(d.getUTCHours()) + ":" + p(d.getUTCMinutes()) + " " + p(d.getUTCDate()) + "/" + p(d.getUTCMonth() + 1);
    if (res === "M") return p(d.getUTCMonth() + 1) + "/" + d.getUTCFullYear();
    if (LONG_M[res]) { try { var C = W.NHIPChartsCore; if (C && C.periodLabel) return C.periodLabel(sec, res); } catch (e) { } return p(d.getUTCMonth() + 1) + "/" + d.getUTCFullYear(); }
    return p(d.getUTCDate()) + "/" + p(d.getUTCMonth() + 1) + "/" + String(d.getUTCFullYear()).slice(2);
  }
  function shortLabel(res) { try { var T = W.NHIPChartsCore && W.NHIPChartsCore.TIMEFRAMES, f = T && T.filter(function (x) { return x[0] === String(res); })[0]; if (f) return f[3]; } catch (e) { } return String(res || "—"); }

  /* ---------- trạng thái hiện tại trên chính mã (nến ĐÃ ĐÓNG của chính khung đó; cùng hàm VS.analyze với tab Bằng chứng) ---------- */
  var CACHE = {}, G = null;   /* G = biểu đồ chính đang dựng: { k, sym, res, ex, panes:{ id → paneId } } */
  function view(ctx) {
    var cs = ctx && ctx.candles; if (!cs || !cs.length) return null;
    var res = String(ctx.res != null ? ctx.res : "D"), last = cs[cs.length - 1], mk = ctx.sym + "|" + res, key = [cs.length, last.time, last.close, Math.floor(nowMs() / 60000)].join("|"), e = CACHE[mk];
    if (e && e.key === key) return e.v;
    var v = null; try { v = analyzeFrame(cs, res); } catch (x) { v = null; }
    CACHE[mk] = { key: key, v: v }; return v;
  }
  /* "giữ từ …": khung Ngày dùng ngày tín hiệu của thư viện (như cũ); khung khác lần ngược theo trạng thái nắm giữ để ra đúng nến vào lệnh */
  function sinceOf(V, id, res) {
    var st = stateOf(V, id); if (!st || !(st.state === "long" || st.state === "buy_new")) return null;
    if (String(res || "D") === "D") return st.since ? dmy2(st.since) : null;
    var cs = V && V.cs, h = st.hold; if (!cs || !h) return null;
    var i = cs.length - 1; while (i > 0 && h[i - 1]) i--; return cs[i] ? fmtBar(cs[i].time, res) : null;
  }

  /* ---------- lựa chọn (nhớ theo SÀN; dùng chung biểu đồ một khung và đa khung) ---------- */
  function store() { try { return W.localStorage || null; } catch (e) { return null; } }
  function loadSel() { try { var s = store(), o = s ? JSON.parse(s.getItem(LSKEY) || "{}") : {}; return o && typeof o === "object" && !Array.isArray(o) ? o : {}; } catch (e) { return {}; } }
  function saveSel(o) { try { var s = store(); if (s) s.setItem(LSKEY, JSON.stringify(o)); } catch (e) { } }
  function selFor(ex) { var ids = toolsFor(ex).map(function (t) { return t.id; }), s = loadSel()[ex]; return Array.isArray(s) ? s.filter(function (x) { return ids.indexOf(x) >= 0; }) : []; }

  /* ---------- mũi tên MUA / BÁN của Fade2 (V2.92) ----------
     ▲ Mua nằm DƯỚI nến thủng đáy (chữ "Mua" ngay cạnh mũi tên); ▼ Bán nằm TRÊN nến vượt đỉnh (chữ "Bán" cạnh mũi tên).
     Tín hiệu ở nến đang chạy (chưa đóng) vẽ MỜ vì chưa xác nhận. Hàm vẽ nhận ngữ cảnh của KLineChart v9 (indicator.draw) và luôn
     trả false để các đường Đáy/Đỉnh vẫn được thư viện vẽ như cũ; mọi lỗi đều bị nuốt, không làm hỏng biểu đồ. */
  var C_BUY = "#16a34a", C_SELL = "#dc2626";
  function pill(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else { ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); }
    ctx.closePath();
  }
  function drawTag(ctx, cx, py, up, text, pend, maxW) {
    var h = 18, tri = 5, gap = 4, pad = 5;
    ctx.save();
    ctx.font = "600 11px -apple-system, 'Segoe UI', Roboto, sans-serif"; ctx.textBaseline = "middle"; ctx.textAlign = "left";
    var tw = ctx.measureText(text).width, w = pad + tri * 2 + gap + tw + pad + 1;
    var x = cx - w / 2; if (maxW) x = Math.max(2, Math.min(x, maxW - w - 2));
    var y = up ? py + 7 : py - 7 - h;                       /* Mua: dưới đáy nến · Bán: trên đỉnh nến */
    ctx.globalAlpha = pend ? 0.5 : 1;
    ctx.fillStyle = up ? C_BUY : C_SELL; pill(ctx, x, y, w, h, 5); ctx.fill();
    var ax = x + pad + tri, ay = y + h / 2;                 /* mũi tên: ▲ cho Mua, ▼ cho Bán */
    ctx.fillStyle = "#ffffff"; ctx.beginPath();
    if (up) { ctx.moveTo(ax, ay - tri); ctx.lineTo(ax + tri, ay + tri - 1); ctx.lineTo(ax - tri, ay + tri - 1); }
    else { ctx.moveTo(ax, ay + tri); ctx.lineTo(ax + tri, ay - tri + 1); ctx.lineTo(ax - tri, ay - tri + 1); }
    ctx.closePath(); ctx.fill();
    ctx.fillText(text, x + pad + tri * 2 + gap, ay + 0.5);
    ctx.restore();
  }
  function drawFade2(p) {
    try {
      var ctx = p.ctx, res = p.indicator && p.indicator.result, vr = p.visibleRange || {}, xa = p.xAxis, ya = p.yAxis;
      if (!ctx || !res || !res.length || !xa || !ya) return false;
      var from = Math.max(0, (vr.from != null ? vr.from : 0) - 1), to = Math.min(res.length - 1, (vr.to != null ? vr.to : res.length - 1) + 1), maxW = 0;
      try { maxW = ctx.canvas.clientWidth || (ctx.canvas.width / (W.devicePixelRatio || 1)); } catch (e) { maxW = 0; }
      for (var i = from; i <= to; i++) {
        var r = res[i]; if (!r || !r.sig || !fin(r.px)) continue;
        var cx = xa.convertToPixel(i), py = ya.convertToPixel(r.px);
        if (!fin(cx) || !fin(py)) continue;
        drawTag(ctx, cx, py, r.sig > 0, r.sig > 0 ? "Mua" : "Bán", !!r.pend, maxW);
      }
    } catch (e) { }
    return false;
  }

  /* ---------- vẽ lên biểu đồ ---------- */
  function lineStyle(f) { return { style: f.dash ? "dashed" : "solid", smooth: false, size: 1, dashedValue: [3, 3], color: f.color }; }
  function install(K) {
    if (!K || !K.registerIndicator || install.done) return false;
    install.done = true;
    Object.keys(VIS).forEach(function (id) {
      var v = VIS[id];
      try {
        var tpl = {
          name: v.ind, shortName: v.short, calcParams: [], precision: 2,
          figures: v.figs.map(function (f) { var o = { key: f.key, title: f.title, type: f.type }; if (f.type === "bar") o.baseValue = f.baseValue; return o; }),
          calc: function (dataList, indicator) { try { return CALC[id](dataList, indicator); } catch (e) { return dataList.map(function () { return {}; }); } }
        };
        if (typeof v.draw === "function") tpl.draw = v.draw;
        K.registerIndicator(tpl);
      } catch (e) { try { console.warn("Không đăng ký được công cụ", id, e); } catch (x) { } }
    });
    return true;
  }
  /* Mỗi biểu đồ (chính hoặc một ô đa khung) là một "đích vẽ" T = { k, sym, res, ex, panes, box?, mc?, host? } */
  var MC = [];                                  /* các đích vẽ trong chế độ Đa khung */
  function liveT(T) { return !!T && (!T.box || T.box.isConnected !== false); }
  function paneHeight(T) {
    try { if (T && T.box && T.box.clientHeight) return T.box.clientHeight < 320 ? 52 : 70; } catch (e) { }
    try { return W.innerWidth < 700 ? 84 : 104; } catch (e) { return 104; }
  }
  function addTool(T, id) {
    var v = VIS[id]; if (!T || !T.k || !v) return false;
    try {
      var spec = { name: v.ind, calcParams: [], extendData: String(T.res) }, lines = v.figs.filter(function (f) { return f.type === "line"; }).map(lineStyle);
      if (lines.length) spec.styles = { lines: lines };
      var pid = v.pane ? T.k.createIndicator(spec, false, { height: paneHeight(T) }) : T.k.createIndicator(spec, true, { id: "candle_pane" });
      if (!pid) return false;
      T.panes[id] = pid; return true;
    } catch (e) { try { console.warn("nhip-chart-tools: lỗi vẽ", id, e); } catch (x) { } return false; }
  }
  function dropTool(T, id) {
    var v = VIS[id]; if (!T || !T.k || !v || !T.panes[id]) return;
    try { T.k.removeIndicator(T.panes[id], v.ind); } catch (e) { }
    delete T.panes[id];
  }
  /* tập công cụ cần có trên một đích: chỉ ở khung được hỗ trợ (1p → 5 năm), chỉ của sàn đang xem, chỉ cái đã bật */
  function wantedT(T) { return T && T.ex && supported(T.res) ? selFor(T.ex) : []; }
  function syncT(T) {
    if (!T || !T.k) return;
    var want = wantedT(T);
    Object.keys(T.panes).forEach(function (id) { if (want.indexOf(id) < 0) dropTool(T, id); });
    want.forEach(function (id) { if (!T.panes[id]) addTool(T, id); });
  }
  function sync() { MC = MC.filter(liveT); if (G) syncT(G); MC.forEach(syncT); }
  function activeCount() { return G ? Object.keys(G.panes).length : 0; }

  /* ---------- bật/tắt ở biểu đồ MỘT khung ---------- */
  function toggle(id, ctx) {
    ctx = ctx || {};
    var sym = String(ctx.sym || (G && G.sym) || "").toUpperCase(), res = String(ctx.res != null ? ctx.res : (G && G.res) || "");
    var xr = exchangeOf(sym, ctx.d), ex = xr.key, t = toolsFor(ex, res).filter(function (x) { return x.id === id; })[0];
    if (!t) return { ok: false, err: true, msg: ex ? "Công cụ này không thuộc bộ đã kiểm chứng của sàn " + LABEL[ex] + "." : "Chưa rõ sàn của " + sym + " nên chưa bật được công cụ." };
    if (!supported(res)) return { ok: false, err: true, msg: "Công cụ chạy ở khung từ " + RANGE_TXT + " — hãy chuyển sang một khung trong phạm vi này." };
    var all = loadSel(), cur = selFor(ex), i = cur.indexOf(id), on = i < 0;
    if (on) {
      var V = view({ sym: sym, res: res, candles: ctx.candles }), st = stateOf(V, id);
      if (st && st.state === "na") return { ok: false, err: true, msg: t.name + " cần ≥ " + st.need + " nến " + (res === "D" ? "ngày" : "của khung này") + " (hiện có " + st.have + ")." };
      cur.push(id);
    } else cur.splice(i, 1);
    all[ex] = cur; saveSel(all);
    if (G) {
      G.ex = ex; if (ctx.res != null) G.res = res; sync();
      if (on && !G.panes[id]) { cur.splice(cur.indexOf(id), 1); all[ex] = cur; saveSel(all); return { ok: false, err: true, msg: "Biểu đồ không vẽ được " + t.name + "." }; }
    } else sync();
    return { ok: true, on: on, msg: (on ? "Đã bật " : "Đã tắt ") + t.name + " · " + LABEL[ex] };
  }

  /* ---------- bật/tắt ở chế độ ĐA KHUNG: một lựa chọn áp cho mọi biểu đồ của mã ---------- */
  function mcEntries(host) { MC = MC.filter(liveT); return MC.filter(function (T) { return T.host === host; }).sort(function (a, b) { return (a.i || 0) - (b.i || 0); }); }
  function mcFrames(host) {
    var E = mcEntries(host), f = null;
    try { if (E.length && E[0].mc && E[0].mc.frames) f = E[0].mc.frames(); } catch (e) { }
    return Array.isArray(f) && f.length ? f.map(String) : E.map(function (T) { return String(T.res); });
  }
  function mcCandles(host, res) {
    var E = mcEntries(host), i, c = null;
    for (i = 0; i < E.length; i++) { try { if (E[i].mc && E[i].mc.candlesOf) { c = E[i].mc.candlesOf(res); if (c) return c; } } catch (e) { } }
    for (i = 0; i < E.length; i++) if (String(E[i].res) === String(res) && E[i].candles) return E[i].candles;
    return null;
  }
  function toggleMc(id, host) {
    var E = mcEntries(host); if (!E.length) return { ok: false, err: true, msg: "Chưa có biểu đồ để vẽ." };
    var sym = E[0].sym, xr = exchangeOf(sym, null), ex = xr.key, t = toolsFor(ex, "D").filter(function (x) { return x.id === id; })[0];
    if (!t) return { ok: false, err: true, msg: ex ? "Công cụ này không thuộc bộ đã kiểm chứng của sàn " + LABEL[ex] + "." : "Chưa rõ sàn của " + sym + " nên chưa bật được công cụ." };
    var drawable = E.filter(function (T) { return supported(T.res); });
    if (!drawable.length) return { ok: false, err: true, msg: "Không có khung nào trong phạm vi " + RANGE_TXT + " để vẽ." };
    var all = loadSel(), cur = selFor(ex), i = cur.indexOf(id), on = i < 0;
    if (on) cur.push(id); else cur.splice(i, 1);
    all[ex] = cur; saveSel(all);
    E.forEach(function (T) { T.ex = ex; }); sync();
    if (on && !drawable.some(function (T) { return T.panes[id]; })) { cur.splice(cur.indexOf(id), 1); all[ex] = cur; saveSel(all); sync(); return { ok: false, err: true, msg: "Biểu đồ không vẽ được " + t.name + "." }; }
    return { ok: true, on: on, msg: (on ? "Đã bật " : "Đã tắt ") + t.name + " · " + LABEL[ex] + " · " + drawable.length + " biểu đồ" };
  }

  /* ---------- giao diện trong hộp Chỉ báo (biểu đồ một khung) ---------- */
  function resLabel(res) { try { var T = W.NHIPChartsCore && W.NHIPChartsCore.TIMEFRAMES, f = T && T.filter(function (x) { return x[0] === String(res); })[0]; if (f) return f[1]; } catch (e) { } return String(res || "—"); }
  function statLine(t, res) {
    var s = t.stat, a = [], tag = String(res || "D") === "D" ? "" : "Khung Ngày: ";
    a.push(tag + esc(s.span));
    if (fin(s.net)) a.push("lãi ròng " + pct(s.net, 1)); else if (s.netText) a.push("lãi ròng " + esc(s.netText));
    if (fin(s.edge)) a.push("hơn mốc " + sg(s.edge, 1) + " điểm");
    if (fin(s.bh)) a.push("mua-giữ " + pct(s.bh, 1));
    return a.join(" · ");
  }
  function rowHTML(t, V, on, canUse, res) {
    var st = stateOf(V, t.id), sx = st ? (STATE_TXT[st.state] || STATE_TXT.na) : null, na = !!(st && st.state === "na");
    var sn = sinceOf(V, t.id, res), held = sn ? " · giữ từ " + sn : "";
    return '<button type="button" class="nt-row' + (on ? " on" : "") + (t.kind === "score" ? " core" : "") + '" data-nt="' + esc(t.id) + '" aria-pressed="' + (on ? "true" : "false") + '"' + (na || !canUse ? " disabled" : "") + ">" +
      '<span class="nt-main"><b class="nt-name">' + esc(t.name) + '</b><span class="nt-role nt-r-' + esc(t.kind) + '">' + esc(t.role) + "</span>" + (sx ? '<span class="nt-chip nt-' + sx[1] + '">' + sx[0] + "</span>" : "") + "</span>" +
      '<small class="nt-def">' + esc(t.def) + " · " + esc(t.vis.where) + esc(held) + (na ? " · cần ≥ " + st.need + " nến (hiện có " + st.have + ")" : "") + "</small>" +
      '<small class="nt-stat">' + statLine(t, res) + "</small>" +
      '<span class="nt-sw" aria-hidden="true"></span></button>';
  }
  function sepHTML() { return '<div class="nt-sep" role="separator"><span>Chỉ báo thông thường</span></div>'; }
  function warnHTML(res) {
    var lg = isLongRes(res) ? " Mỗi nến gộp <b>" + (LONG_M[String(res)] >= 12 ? LONG_M[String(res)] / 12 + " năm" : LONG_M[String(res)] + " tháng") + "</b> nên số nến ít — công cụ nào chưa đủ nến sẽ ghi rõ số nến còn thiếu và không bật được." : "";
    var gh = TF_GROUP[String(res)] ? " Nến " + esc(shortLabel(res)) + " được <b>gộp từ nến 1 giờ trong cùng một ngày</b> (không nối qua ngày; nến cuối ngày có thể ngắn hơn)." : "";
    return '<p class="nt-warn"><b>Khung ' + esc(resLabel(res)) + ":</b> bộ công cụ được kiểm chứng trên <b>nến ngày</b>. Ở khung này công thức và tham số giữ nguyên (tính theo số nến của khung) nhưng <b>chưa được kiểm chứng riêng</b> — số liệu bên dưới là của khung Ngày, chỉ để tham khảo." + gh + lg + "</p>";
  }
  function headHTML(sym, ex, xr) {
    return '<div class="nt-hd"><span class="nt-ttl">BỘ CÔNG CỤ NHỊP</span>' + (ex ? '<span class="nt-ex nt-ex-' + ex + '">' + LABEL[ex] + "</span>" : xr.idx ? '<span class="nt-ex nt-ex-none">Chỉ số</span>' : '<span class="nt-ex nt-ex-none">Chưa rõ sàn</span>') + '<span class="nt-sym">' + esc(sym || "—") + "</span></div>";
  }
  function noExHTML(sym, xr) {
    return xr.idx ? '<p class="nt-msg"><b>' + esc(sym) + "</b> là chỉ số — bộ công cụ chỉ được kiểm chứng trên cổ phiếu của từng sàn nên không áp dụng.</p>"
      : '<p class="nt-msg">Chưa xác định được sàn của <b>' + esc(sym) + "</b> trong danh bạ nên chưa hiện công cụ nào (mỗi sàn có bộ riêng — không đoán). Thêm mã ở Cài đặt → Danh bạ mã để có bộ đúng sàn.</p>";
  }
  /* Khối trên cùng của hộp Chỉ báo. ctx = { sym, res, candles, d } */
  function popHTML0(ctx) {
    ctx = ctx || {};
    var sym = String(ctx.sym || (G && G.sym) || "").toUpperCase(), res = String(ctx.res != null ? ctx.res : (G && G.res) || ""), xr = exchangeOf(sym, ctx.d), ex = xr.key, list = toolsFor(ex, res);
    var head = headHTML(sym, ex, xr), body, foot = "";
    if (!ex) body = noExHTML(sym, xr);
    else if (!supported(res)) body = '<p class="nt-msg">Bộ công cụ chạy ở các khung từ <b>1 phút đến 5 năm</b> (đang xem: ' + esc(resLabel(res)) + " — khung này chưa hỗ trợ). Sàn " + LABEL[ex] + " có " + list.length + ' công cụ.</p><button type="button" class="nt-go" data-res="D">Chuyển sang khung Ngày</button>';
    else {
      var V = view({ sym: sym, res: res, candles: ctx.candles }), sel = selFor(ex);
      body = '<p class="nt-sub">Đã kiểm chứng riêng cho sàn ' + LABEL[ex] + " · chỉ gồm công cụ có số liệu của sàn này · vẽ theo chính nến của " + esc(sym) + " ở khung " + esc(resLabel(res)) + ".</p>" +
        (res === "D" ? "" : warnHTML(res)) +
        '<div class="nt-list">' + list.map(function (t) { return rowHTML(t, V, sel.indexOf(t.id) >= 0, true, res); }).join("") + "</div>";
      foot = '<p class="nt-foot">Đường vẽ theo giá đang hiển thị; trạng thái (Đang mua/Đứng ngoài…) chỉ tính trên nến <b>đã đóng</b> của khung này. Chỉ RSIx + Fade2 (và nhóm lọc nếu sàn có) tham gia điểm ở tab Bằng chứng, và điểm đó chỉ tính trên nến ngày. Kết quả lịch sử, không phải khuyến nghị.</p>';
    }
    return head + body + foot;
  }
  /* lỗi ở khối này không bao giờ được làm hỏng danh sách chỉ báo thông thường bên dưới */
  function popHTML(ctx) { try { return popHTML0(ctx); } catch (e) { try { console.warn("nhip-chart-tools", e); } catch (x) { } return ""; } }
  function popBlock(ctx) { return '<div id="cx-nt" class="nt-wrap">' + popHTML(ctx) + "</div>" + sepHTML(); }

  /* ---------- giao diện ở chế độ ĐA KHUNG ---------- */
  function mcRowHTML(t, host, frames, on) {
    var sym = (mcEntries(host)[0] || {}).sym, chips = frames.map(function (res) {
      if (!supported(res)) return '<span class="nt-fr nt-fr-off" title="Khung này chưa hỗ trợ">' + esc(shortLabel(res)) + " · —</span>";
      var cs = mcCandles(host, res); if (!cs || !cs.length) return '<span class="nt-fr nt-fr-off">' + esc(shortLabel(res)) + " · đang tải</span>";
      var st = stateOf(view({ sym: sym, res: res, candles: cs }), t.id), sx = st ? (STATE_TXT[st.state] || STATE_TXT.na) : null;
      return '<span class="nt-fr' + (sx ? " nt-fr-" + sx[1] : "") + '">' + esc(shortLabel(res)) + " · " + (st && st.state === "na" ? "thiếu nến" : sx ? sx[0] : "—") + "</span>";
    }).join("");
    return '<button type="button" class="nt-row' + (on ? " on" : "") + (t.kind === "score" ? " core" : "") + '" data-ntmc="' + esc(t.id) + '" aria-pressed="' + (on ? "true" : "false") + '">' +
      '<span class="nt-main"><b class="nt-name">' + esc(t.name) + '</b><span class="nt-role nt-r-' + esc(t.kind) + '">' + esc(t.role) + "</span></span>" +
      '<small class="nt-def">' + esc(t.def.replace(/ (phiên|nến)$/, "")) + " nến · " + esc(t.vis.where) + "</small>" +
      '<span class="nt-frs">' + chips + "</span>" +
      '<small class="nt-stat">' + statLine(t, "W") + "</small>" +
      '<span class="nt-sw" aria-hidden="true"></span></button>';
  }
  function mcPopHTML(host, note) {
    var E = mcEntries(host); if (!E.length) return '<p class="nt-msg">Đang dựng biểu đồ…</p>';
    var sym = E[0].sym, xr = exchangeOf(sym, null), ex = xr.key, frames = mcFrames(host), list = toolsFor(ex, "W");
    var head = headHTML(sym, ex, xr) + '<button type="button" class="nt-mcx" aria-label="Đóng">✕</button>', body;
    if (!ex) body = noExHTML(sym, xr);
    else {
      var sel = selFor(ex), unsup = frames.filter(function (r) { return !supported(r); }), nonD = frames.some(function (r) { return supported(r) && r !== "D"; });
      body = '<p class="nt-sub">Bật một lần → vẽ trên <b>mọi biểu đồ</b> của ' + esc(sym) + " (" + frames.map(function (r) { return esc(shortLabel(r)); }).join(" · ") + "). Mỗi hàng ghi trạng thái hiện tại của công cụ ở từng khung (nến đã đóng).</p>" +
        (nonD ? '<p class="nt-warn">Bộ công cụ được kiểm chứng trên <b>nến ngày</b>. Ở các khung khác công thức và tham số giữ nguyên (tính theo số nến) nhưng <b>chưa được kiểm chứng riêng</b>; số liệu từng hàng là của khung Ngày, chỉ để tham khảo.</p>' : "") +
        (unsup.length ? '<p class="nt-warn">Khung ' + unsup.map(function (r) { return esc(shortLabel(r)); }).join(", ") + " chưa hỗ trợ (chỉ 1 phút – 5 năm) nên không vẽ ở khung đó.</p>" : "") +
        '<div class="nt-list">' + list.map(function (t) { return mcRowHTML(t, host, frames, sel.indexOf(t.id) >= 0); }).join("") + "</div>" +
        (note ? '<p class="nt-note' + (note.err ? " err" : "") + '" role="status">' + esc(note.msg) + "</p>" : "") +
        '<p class="nt-foot">Kết quả lịch sử, không phải khuyến nghị đầu tư.</p>';
    }
    return head + body;
  }
  function mcBtnLabel(host) {
    var E = mcEntries(host), n = 0;
    if (E.length) { var ex = exchangeOf(E[0].sym, null).key; if (ex && E.some(function (T) { return supported(T.res); })) n = selFor(ex).length; }
    return "Công cụ NHỊP" + (n ? " (" + n + ")" : "");
  }
  function ensureMcUI(host) {
    try {
      if (!host || !host.querySelector) return;
      var acts = host.querySelector(".mc-acts"), root = host.querySelector(".mc"); if (!acts || !root) return;
      var b = host.querySelector(".nt-mcbtn");
      if (!b) { b = document.createElement("button"); b.type = "button"; b.className = "cx-btn nt-mcbtn"; b.setAttribute("data-nt-mcbtn", "1"); b.setAttribute("aria-expanded", "false"); acts.insertBefore(b, acts.firstChild); }
      b.textContent = mcBtnLabel(host);
      if (!host.querySelector(".nt-mcpop")) { var p = document.createElement("div"); p.className = "nt-mcpop"; p.hidden = true; root.appendChild(p); }
    } catch (e) { try { console.warn("nhip-chart-tools", e); } catch (x) { } }
  }
  function refreshMcUI(host, note) {
    try {
      var p = host.querySelector(".nt-mcpop"), b = host.querySelector(".nt-mcbtn");
      if (b) b.textContent = mcBtnLabel(host);
      if (p && !p.hidden) { var sc = p.scrollTop; p.innerHTML = mcPopHTML(host, note); p.scrollTop = sc; }
    } catch (e) { }
  }
  function closeMcPops(except) {
    try {
      Array.prototype.forEach.call(document.querySelectorAll(".nt-mcpop"), function (p) {
        if (p === except) return; p.hidden = true;
        var h = p.parentNode && p.parentNode.parentNode, b = h && h.querySelector && h.querySelector(".nt-mcbtn"); if (b) { b.setAttribute("aria-expanded", "false"); b.classList.remove("on"); }
      });
    } catch (e) { }
  }
  function hostOf(el) { var r = el && el.closest ? el.closest(".mc") : null; return r ? r.parentNode : null; }
  function onDocClick(e) {
    var t = e && e.target; if (!t || !t.closest) return;
    var b = t.closest("[data-nt-mcbtn]");
    if (b) {
      var host = hostOf(b), p = host && host.querySelector(".nt-mcpop"); if (!p) return;
      var open = p.hidden; closeMcPops(open ? p : null);
      if (open) { p.innerHTML = mcPopHTML(host); p.hidden = false; b.setAttribute("aria-expanded", "true"); b.classList.add("on"); } else { p.hidden = true; b.setAttribute("aria-expanded", "false"); b.classList.remove("on"); }
      return;
    }
    var r = t.closest("[data-ntmc]");
    if (r) { var h2 = hostOf(r), res = toggleMc(r.getAttribute("data-ntmc"), h2); refreshMcUI(h2, res); return; }
    if (t.closest(".nt-mcx")) { closeMcPops(null); return; }
    if (!t.closest(".nt-mcpop")) closeMcPops(null);
  }

  /* ---------- gắn với biểu đồ ---------- */
  try {
    if (W.addEventListener) {
      W.addEventListener("nhip:chart-built", function (e) {
        var d = e && e.detail; if (!d || !d.k) return;
        G = { k: d.k, sym: String(d.sym || "").toUpperCase(), res: String(d.res || ""), ex: exchangeOf(d.sym, d.d).key, panes: {} };
        syncT(G);
      });
      W.addEventListener("nhip:chart-destroyed", function (e) { if (G && e && e.detail && e.detail.k === G.k) G = null; });
      /* mỗi ô của chế độ Đa khung: mang theo khung (res), nến, và hàm lấy dữ liệu các khung còn lại */
      W.addEventListener("nhip:mc-chart-built", function (e) {
        var d = e && e.detail; if (!d || !d.k) return;
        var sym = String(d.sym || "").toUpperCase();
        MC = MC.filter(function (T) { return liveT(T) && T.k !== d.k && !(d.box && T.box === d.box); });
        var T = { k: d.k, box: d.box || null, host: d.host || null, i: d.i, sym: sym, res: String(d.res || ""), ex: exchangeOf(sym, null).key, panes: {}, mc: d.mc || null, candles: d.candles || null };
        MC.push(T); syncT(T);
        if (T.host) ensureMcUI(T.host);
      });
    }
    if (typeof document !== "undefined" && document.addEventListener) document.addEventListener("click", onDocClick);
    install(W.klinecharts);
  } catch (e) { try { console.warn("nhip-chart-tools", e); } catch (x) { } }

  W.NHIPChartTools = {
    version: "1.2", KEYS: KEYS, TF: TF, supported: supported, toolsFor: toolsFor, exchangeOf: exchangeOf, popHTML: popHTML, popBlock: popBlock, toggle: toggle, toggleMc: toggleMc, mcPopHTML: mcPopHTML, activeCount: activeCount, sync: sync, install: install,
    _t: { CALC: CALC, VIS: VIS, P: P, stBands: stBands, stochKD: stochKD, prevHi: prevHi, prevLo: prevLo, loadSel: loadSel, saveSel: saveSel, selFor: selFor, view: view, analyzeFrame: analyzeFrame, closedOnly: closedOnly, forming: forming, fmtBar: fmtBar, sinceOf: sinceOf, mcEntries: mcEntries, onDocClick: onDocClick, LONG_M: LONG_M, state: function () { return G; }, mc: function () { return MC; }, reset: function () { G = null; MC = []; CACHE = {}; install.done = false; } }
  };
})(typeof window !== "undefined" ? window : this);
