/* NHIP VScore v1.1 (V2.75: thêm bộ công cụ tham khảo đã kiểm chứng theo sàn — Supertrend, SMA, EMA, AO, Turtle, Stoch nghịch) — BỘ CHẤM ĐIỂM MỚI, chỉ dựa trên hai công cụ đã qua kiểm chứng ngoài mẫu theo từng sàn: RSIx và Fade2.
   Thay hoàn toàn bộ chấm điểm cũ trong tab Phân tích (điểm rủi ro, điểm xếp hạng kỹ thuật, điểm cấu trúc…): các điểm đó đã được kiểm chứng
   trên dữ liệu thật 2021–2026 và KHÔNG thấy lợi thế ở cả 3 sàn (HOSE IC20 −0,011, t −0,5; HNX IC5 −0,042, t −3,7; UPCoM t 0,64).

   Nguyên tắc: không có trọng số tự đặt, không có ngưỡng "phán đoán". Điểm chỉ là kết quả của đúng mô hình đã được kiểm thử:
     ĐIỂM THAM GIA = 50 × [RSIx đang mua] + 50 × [Fade2 đang mua]   (0 / 50 / 100 — mô hình tổ hợp 50/50 đã đo)
   Kèm "độ vững của bằng chứng" của sàn (không cộng vào điểm): suy ra bằng quy tắc công khai từ các thước đo của báo cáo kiểm chứng.
   Điểm KHÔNG phải xác suất tăng giá; lợi thế được kiểm chứng là trung bình trên rổ mã của sàn, từng mã có thể lệch xa.
   Lõi thuần (không DOM), chạy được trong Node. Cần NHIPStrategies v1.1+ (có rsix, fade2). */
(function (W) {
  "use strict";
  var NS = W.NHIPStrategies;
  var NOW = null, CACHE = null;

  /* ---------- tiện ích ---------- */
  function fin(v) { return typeof v === "number" && isFinite(v); }
  function ymd(t) {
    if (typeof t === "number" && isFinite(t)) return new Date((t < 1e11 ? t * 1000 : t) + 7 * 3600e3).toISOString().slice(0, 10);
    return String(t == null ? "" : t).slice(0, 10);
  }
  function vnNow() { var d = new Date((NOW != null ? NOW : Date.now()) + 7 * 3600e3); return { date: d.toISOString().slice(0, 10), hour: d.getUTCHours() + d.getUTCMinutes() / 60, dow: d.getUTCDay() }; }

  /* ---------- thước đo kiểm chứng theo sàn (báo cáo kiểm chứng; ngoài mẫu 10/2024 → 10/2026, tham số chọn trên các năm đầu) ----------
     edge = hơn mức vào/ra ngẫu nhiên cùng độ phủ (điểm %); net = lãi ròng cộng dồn ngoài mẫu (%); bh = mua-giữ cùng kỳ (%); n = số mã ngoài mẫu. */
  var KEYS = ["HOSE", "HNX", "UPCOM"], LABEL = { HOSE: "HOSE", HNX: "HNX", UPCOM: "UPCoM" };
  var PARAMS = { rsix: { period: 14, low: 25, high: 70 }, fade2: { high: 80, low: 30 } }; /* cùng một bộ tham số được chọn ở cả 3 sàn */
  var TOOLS = [
    { id: "rsix", name: "RSIx", rule: "Mua khi RSI(14) cắt lên 25 (quá bán sâu); bán khi RSI ≥ 70 hoặc rơi lại dưới 25.", prof: "≈ 1,4–1,9 lệnh/năm" },
    { id: "fade2", name: "Fade2", rule: "Mua khi giá đóng cửa thủng đáy 30 phiên; giữ đến khi đóng cửa vượt đỉnh 80 phiên.", prof: "ở trong thị trường ≈ 70% thời gian" }
  ];
  var EXCH = {
    HOSE: { n: 115, bh: 4.3, rsix: { edge: 5.5, net: 4.5 }, fade2: { edge: 5.5, net: null, netText: "≈ 0%" }, combo: { edge: 5.5, net: 2.6 },
      read: "RSIx cho lãi ngang mua-giữ (+4,5% so với +4,3%) nhưng chỉ ở trong thị trường khoảng 28% thời gian — giá trị chính là giảm rủi ro. Fade2 mạnh khi thị trường giảm, yếu khi tăng mạnh (HOSE 2024–25 chỉ hơn +1,6 điểm)." },
    HNX: { n: 75, bh: 0.3, rsix: { edge: 7.3, net: 7.1 }, fade2: { edge: 6.0, net: 0.5 }, combo: { edge: 6.6, net: 3.8 },
      read: "Sàn RSIx tốt nhất: +7,1% trong khi mua-giữ chỉ +0,3%; hạ ngưỡng mua từ 30 xuống 25 đã đổi kết quả cùng kỳ từ −3,7% sang +7,1%. Fade2 gần hòa vốn (+0,5%) — giá trị là giảm rủi ro." },
    UPCOM: { n: 47, bh: -7.1, rsix: { edge: 7.3, net: 4.6 }, fade2: { edge: 6.6, net: -3.4 }, combo: { edge: 7.0, net: 0.6 },
      read: "Thị trường giảm (mua-giữ −7,1%): RSIx +4,6%, Fade2 −3,4% (lỗ ít hơn), tổ hợp 50/50 +0,6%. Mẫu chỉ 47 mã nên kết luận thận trọng hơn hai sàn còn lại." }
  };
  /* ---------- BỘ CÔNG CỤ THAM KHẢO ĐÃ KIỂM CHỨNG THEO SÀN (không cộng vào điểm) ----------
     Nguồn: báo cáo kiểm chứng (chạy_ngoai_mau.html) — dữ liệu thật 20/10/2021 → 19/10/2026, giá điều chỉnh, 5 cửa sổ ~1 năm cộng dồn, mặc định tham số của thư viện,
     đã trừ phí 0,15%/chiều, thuế bán 0,1%, trượt giá 0,1%, T+, lô, biên độ. KHÁC với thước đo ngoài mẫu của RSIx/Fade2 ở trên (kỳ khác, mua-giữ khác) nên hiển thị tách riêng.
     net = lãi ròng cộng dồn (%) · edge = hơn mức vào/ra ngẫu nhiên cùng độ phủ (điểm %) khi báo cáo có số riêng của công cụ đó, ngược lại null.
     Không bịa số: ô nào báo cáo không nêu thì để null và hiển thị “chưa có số riêng”. */
  var EXTRA = [
    { id: "supertrend", sid: "supertrend", name: "Supertrend", dir: "fwd", trend: true, def: "ATR 10 · hệ số 3", rule: "Mua khi Supertrend đổi sang tăng; bán khi đổi sang giảm." },
    { id: "sma", sid: "sma", name: "SMA 20/50", dir: "fwd", trend: true, def: "SMA nhanh 20 / chậm 50", rule: "Mua khi SMA20 cắt lên SMA50; bán khi cắt xuống." },
    { id: "ema", sid: "ema", name: "EMA 12/26", dir: "fwd", trend: true, def: "EMA nhanh 12 / chậm 26", rule: "Mua khi EMA12 cắt lên EMA26; bán khi cắt xuống." },
    { id: "ao", sid: "ao", name: "AO", dir: "fwd", trend: true, def: "Awesome Oscillator 5/34", rule: "Mua khi AO chuyển dương; bán khi chuyển âm." },
    { id: "turtle", sid: "turtle", name: "Turtle", dir: "fwd", trend: true, def: "vào 55 / ra 20 phiên", rule: "Mua khi giá vượt đỉnh 55 phiên; bán khi thủng đáy 20 phiên." },
    { id: "stochr", sid: "stoch", name: "Stoch nghịch", dir: "rev", trend: false, def: "Stochastic 14,3,3 · đảo chiều", rule: "Giữ cổ phiếu khi Stochastic gốc đứng ngoài; bán khi Stochastic gốc báo mua." }
  ];
  var FULL = {
    HOSE: { n: 120, bh: -10.7, span: "120 mã HOSE",
      tools: {
        supertrend: { net: 11.7, edge: -2.9, role: "filter", read: "Lãi nhờ đứng ngoài lúc sập 2022; so với việc ở trong thị trường cùng tỷ lệ thời gian vẫn kém 2,9 điểm." },
        sma:        { net: 8.0, edge: -3.8, role: "filter", read: "Lãi nhờ tránh đợt sập 2022; cùng độ phủ vẫn kém 3,8 điểm." },
        ema:        { net: 7.9, edge: null, role: "filter", read: "Lãi nhờ tránh đợt sập 2022; chưa có số cùng độ phủ riêng (cả nhóm xu hướng vẫn âm)." },
        ao:         { net: 8.5, edge: null, role: "filter", read: "Lãi nhờ tránh đợt sập 2022; chưa có số cùng độ phủ riêng (cả nhóm xu hướng vẫn âm)." },
        turtle:     { net: 5.1, edge: null, role: "filter", read: "Lãi nhờ tránh đợt sập 2022; chưa có số cùng độ phủ riêng (cả nhóm xu hướng vẫn âm)." },
        stochr:     { net: 9.6, edge: null, role: "trial", read: "Lãi +9,6% nhưng lợi thế chọn thời điểm yếu (t = 0,3) — chỉ nên thử nghiệm thêm." }
      },
      old: [
        { t: "RSI cũ (14/30/70)", d: "Lãi cộng dồn +5,0%; hơn cùng độ phủ +4,3 điểm ngoài mẫu → đã được RSIx (25/70) thay thế (+5,5 điểm)." },
        { t: "Turtle đảo bản cũ", d: "Hơn cùng độ phủ +3,8 điểm ngoài mẫu → đã được Fade2 thay thế (+5,5 điểm)." }
      ],
      note: "Nhóm xu hướng chỉ nên dùng làm bộ lọc trạng thái (giảm tiếp xúc khi xu hướng giảm), không dùng làm tín hiệu vào lệnh." },
    HNX: { n: 80, bh: -40.7, span: "80 mã HNX",
      tools: {
        supertrend: { net: -5.5, edge: null, role: "ref", read: "Công cụ tốt nhất nhóm xu hướng ở HNX nhưng vẫn lỗ; lỗ ít hơn mua-giữ chủ yếu nhờ giảm tiếp xúc." },
        turtle:     { net: -8.7, edge: null, role: "ref", read: "Tốt nhất nhóm còn lại ở HNX nhưng vẫn lỗ." },
        stochr:     { net: -13.4, edge: null, role: "ref", read: "Công cụ nghịch tốt nhất ở HNX nhưng vẫn lỗ." }
      },
      old: [
        { t: "RSI cũ (14/30/70)", d: "Hơn cùng độ phủ +3,4 điểm ngoài mẫu → đã được RSIx (25/70) thay thế (+7,3 điểm)." },
        { t: "Turtle đảo bản cũ", d: "Hơn cùng độ phủ +5,0 điểm ngoài mẫu (lợi thế thô +5,1, t = 2,4) → đã được Fade2 thay thế (+6,0 điểm)." }
      ],
      note: "Không công cụ nào trong nhóm xu hướng lãi ở cả hai chiều trên HNX trong 5 năm này (mua-giữ −40,7%)." },
    UPCOM: { n: null, bh: -46.8, span: "80 + 47 mã UPCoM (hai đoạn)",
      tools: {
        supertrend: { net: -1.1, edge: null, role: "ref", read: "Gần hòa vốn trong khi mua-giữ −46,8%, nhưng vẫn không lãi; lợi chủ yếu từ giảm tiếp xúc." },
        ema:        { net: -7.4, edge: null, role: "ref", read: "Tốt nhất nhóm còn lại ở UPCoM nhưng vẫn lỗ." },
        stochr:     { net: -13.1, edge: null, role: "ref", read: "Công cụ nghịch tốt nhất ở UPCoM nhưng vẫn lỗ." }
      },
      old: [
        { t: "RSI cũ (14/30/70)", d: "Hơn cùng độ phủ +4,6 điểm ngoài mẫu → đã được RSIx (25/70) thay thế (+7,3 điểm)." },
        { t: "Turtle đảo bản cũ", d: "Hơn cùng độ phủ +7,1 điểm ngoài mẫu → đã được Fade2 thay thế (+6,6 điểm)." },
        { t: "VWAP", d: "Lợi thế thô +4,6 điểm nhưng 9–13 lệnh/năm nên phí nuốt hết." }
      ],
      note: "Thiếu dữ liệu UPCoM 20/10/2023–20/10/2024 nên chia hai đoạn; không công cụ nào lãi ở cả hai chiều (mua-giữ −46,8%)." }
  };

  var COMBO_PROF = "50% vốn mỗi công cụ · ≈ 50% thời gian trong thị trường · 3–4 lệnh/năm";
  var COST = { fee: 0.0015, slip: 0.001, tax: 0.001, lock: 2 }; /* phí 0,15%/chiều · trượt giá 0,1% · thuế bán 0,1% · khóa bán T+2 */

  /* Công cụ/điểm đã được kiểm chứng NHƯNG KHÔNG đạt — lý do không còn nằm trong bộ chấm điểm (số liệu từ báo cáo kiểm chứng 2021–2026, 5 cửa sổ ~1 năm) */
  var REJECTED = [
    { t: "Điểm xếp hạng kỹ thuật cũ (NHIPRating)", d: "Chưa thấy lợi thế ở cả 3 sàn. HOSE: IC 20 phiên −0,011 (t −0,5), nhóm “Mạnh” −1,29% sau 20 phiên, kém nhóm “Yếu” −1,06%. HNX: IC 5 phiên −0,042 (t −3,7) — ngược chiều ngắn hạn. UPCoM: IC dương nhẹ, t 0,64 (không đủ ý nghĩa)." },
    { t: "Nhóm theo xu hướng (Supertrend, SMA, EMA, AO, Turtle) — HOSE", d: "Lãi tuyệt đối (Supertrend +11,7%, AO +8,5%, SMA +8,0%, EMA +7,9%, Turtle +5,1% so với mua-giữ −10,7%) nhưng chủ yếu nhờ đứng ngoài lúc sập 2022; so với việc ở trong thị trường cùng tỷ lệ thời gian vẫn âm (Supertrend −2,9 điểm, SMA −3,8 điểm). Không có lợi thế chọn thời điểm." },
    { t: "Mọi công cụ theo xu hướng — HNX và UPCoM", d: "Không công cụ nào lãi tuyệt đối ở cả hai chiều (tốt nhất Supertrend −5,5% ở HNX, −1,1% ở UPCoM; mua-giữ −40,7% và −46,8%)." },
    { t: "Giao dịch dày (HMA, Williams %R, ROC, OBV, Force…)", d: "Phí và thuế nuốt hết lợi thế: HMA +0,2% khi không phí nhưng −12,7% với phí mặc định (~22 lệnh/mã/năm)." },
    { t: "Đã loại bỏ", d: "HMA, Williams %R, CCI, ROC, RSI50, Force, Giá/SMA, PSAR — âm ở cả hai chiều, chỉ tốn phí. Fade breakout bản đầu cũng bị bỏ (âm cả huấn luyện lẫn ngoài mẫu)." }
  ];

  /* ---------- mô phỏng nhanh trên chính mã (khớp ở giá mở cửa nến kế tiếp; theo trạng thái nắm giữ của công cụ) ---------- */
  function replay(c, st, K) {
    K = K || COST;
    var n = c.length, pos = null, E = 1, trades = [], held = 0, i;
    for (i = 1; i < n; i++) {
      var want = !!st[i - 1];
      if (!pos && want) { var cost = c[i].open * (1 + K.slip) * (1 + K.fee); pos = { i0: i, units: E / cost, cost: cost }; }
      else if (pos && !want && i >= pos.i0 + K.lock) { var out = c[i].open * (1 - K.slip) * (1 - K.fee - K.tax); E = pos.units * out; trades.push({ i0: pos.i0, i1: i, r: out / pos.cost - 1 }); pos = null; }
      if (pos) held++;
    }
    if (pos) { E = pos.units * c[n - 1].close; trades.push({ i0: pos.i0, i1: null, r: c[n - 1].close / pos.cost - 1 }); }
    var bh = n > 1 ? c[n - 1].close / (c[1].open * (1 + K.slip) * (1 + K.fee)) - 1 : NaN, expo = n > 1 ? held / (n - 1) : 0, net = E - 1;
    return { net: net, bh: bh, expo: expo, trades: trades, excess: excessPts(net, expo, bh) };
  }
  /* mốc so sánh = vào/ra ngẫu nhiên nhưng ở trong thị trường cùng tỷ lệ thời gian: (1+mua-giữ)^độ phủ − 1 (hình học, vì lãi cộng dồn) */
  function excessPts(net, expo, bh) { return fin(bh) && 1 + bh > 0 ? (net - (Math.pow(1 + bh, expo) - 1)) * 100 : NaN; }
  function mix(a, b) { var net = (a.net + b.net) / 2, expo = (a.expo + b.expo) / 2; return { net: net, bh: a.bh, expo: expo, trades: a.trades.concat(b.trades), nTrades: a.trades.length + b.trades.length, excess: excessPts(net, expo, a.bh) }; }

  /* ---------- phân tích 1 mã ---------- */
  function lastIdx(a) { for (var i = a.length - 1; i >= 0; i--) if (a[i]) return i; return -1; }
  function isLong(t) { return !!t && (t.state === "long" || t.state === "buy_new"); }
  function runTool(t, cs, all, partial) {
    var sp = {}; sp[t.id] = PARAMS[t.id];
    var p = NS.effectiveParams(t.id, sp), cfg = { strategies: [t.id], stratParams: sp }, need = NS.warm(cfg), m = cs.length, last = m - 1;
    if (m < need) return { id: t.id, state: "na", need: need, have: m, p: p };
    var sig = NS.compose(cs, cfg), hold = NS._h.holdState(sig);
    var o = { id: t.id, p: p, state: sig.buy[last] ? "buy_new" : sig.sell[last] ? "sell_new" : hold[last] ? "long" : "flat", hold: hold, rep: replay(cs, hold), pend: null };
    if (partial) { var sf = NS.compose(all, cfg), L = all.length - 1; o.pend = sf.buy[L] ? "buy" : sf.sell[L] ? "sell" : null; }
    var bi = lastIdx(sig.buy);
    if ((o.state === "long" || o.state === "buy_new") && bi >= 0) { o.since = ymd(cs[bi].time); var en = cs[bi + 1]; o.entry = en ? en.open : cs[bi].close; }
    if (t.id === "rsix") {
      var r = NS._h.rsi(cs.map(function (x) { return x.close; }), p.period);
      o.rsi = r[last];
    } else {
      var lo = Infinity, hi = -Infinity, k;
      for (k = Math.max(0, m - p.low); k < m; k++) if (cs[k].low < lo) lo = cs[k].low;
      if (m >= p.high) for (k = m - p.high; k < m; k++) if (cs[k].high > hi) hi = cs[k].high;
      o.floor = isFinite(lo) ? lo : NaN; o.ceil = isFinite(hi) ? hi : NaN;
    }
    return o;
  }
  /* công cụ tham khảo: tham số mặc định của thư viện (đúng như lúc kiểm chứng); chiều nghịch = giữ khi công cụ gốc đứng ngoài */
  function runExtra(x, cs, all, partial) {
    var cfg = { strategies: [x.sid] }, p = NS.effectiveParams(x.sid), need = NS.warm(cfg), m = cs.length, last = m - 1;
    if (m < need) return { id: x.id, state: "na", need: need, have: m, p: p };
    var sig = NS.compose(cs, cfg), hold = NS._h.holdState(sig), i, st;
    if (x.dir === "rev") {
      hold = hold.map(function (h, k) { return k >= need - 1 ? !h : false; });
      st = hold[last] ? (last && !hold[last - 1] ? "buy_new" : "long") : (last && hold[last - 1] ? "sell_new" : "flat");
    } else st = sig.buy[last] ? "buy_new" : sig.sell[last] ? "sell_new" : hold[last] ? "long" : "flat";
    var o = { id: x.id, p: p, state: st, hold: hold, rep: replay(cs, hold), pend: null };
    if (partial) {
      var sf = NS.compose(all, cfg), hf = NS._h.holdState(sf), L = all.length - 1;
      if (x.dir === "rev") { hf = hf.map(function (h, k) { return k >= need - 1 ? !h : false; }); o.pend = hf[L] && !hold[last] ? "buy" : !hf[L] && hold[last] ? "sell" : null; }
      else o.pend = sf.buy[L] ? "buy" : sf.sell[L] ? "sell" : null;
    }
    for (i = last; i > 0 && hold[i] && hold[i - 1]; i--) { /* tìm nến vào lệnh hiện tại */ }
    if (hold[last]) { o.since = ymd(cs[i].time); var en = cs[i + 1]; o.entry = en ? en.open : cs[i].close; }
    return o;
  }
  /* o.closed = true: người gọi đã tự bỏ nến chưa đóng (khung phút/giờ/tuần/tháng) → không áp luật "phiên ngày chưa đóng" của khung Ngày lần nữa. Bỏ o → hành vi cũ (khung Ngày). */
  function analyze(candles, o) {
    var n = candles.length;
    if (!n) return { ready: false, reason: "Chưa có dữ liệu nến." };
    var now = vnNow(), liveDate = ymd(candles[n - 1].time);
    var partial = !(o && o.closed) && n > 1 && liveDate === now.date && now.dow >= 1 && now.dow <= 5 && now.hour < 15; /* phiên chưa đóng → không dùng nến cuối để ra tín hiệu */
    var cs = partial ? candles.slice(0, n - 1) : candles, m = cs.length;
    var closes = cs.slice(-60).map(function (x) { return x.close; }).filter(fin).sort(function (a, b) { return a - b; });
    var out = { ready: true, n: m, partial: partial, closed: ymd(cs[m - 1].time), liveDate: liveDate, price: candles[n - 1].close, years: m / 250, scale: closes.length && closes[closes.length >> 1] < 300 ? 1000 : 1, tools: {} };
    TOOLS.forEach(function (t) { out.tools[t.id] = runTool(t, cs, candles, partial); });
    out.extra = {};
    EXTRA.forEach(function (x) { out.extra[x.id] = runExtra(x, cs, candles, partial); });
    var a = out.tools.rsix, b = out.tools.fade2;
    if (a.rep && b.rep) out.combo = mix(a.rep, b.rep);
    out.cs = cs;
    return out;
  }

  /* ---------- BỘ CHẤM ĐIỂM ---------- */
  /* Độ vững của bằng chứng theo sàn — quy tắc công khai, chỉ từ thước đo đã kiểm chứng:
       "Khá"        : ≥ 50 mã ngoài mẫu VÀ cả RSIx, Fade2, tổ hợp đều hơn mức ngẫu nhiên cùng độ phủ ≥ 5 điểm;
       "Thận trọng" : còn lại (ít mã hoặc lợi thế dưới 5 điểm);
       "Chưa rõ sàn": chưa biết mã thuộc sàn nào → không có thước đo để đối chiếu.
     Không bao giờ "Cao": ngoài mẫu mới chỉ có 2 cửa sổ trong 1 chu kỳ thị trường (tăng rồi giảm). */
  function strength(ex) {
    var E = ex && EXCH[ex];
    if (!E) return { key: "unknown", label: "Chưa rõ sàn", cls: "mid", why: "Chưa nhận diện được sàn nên chưa có thước đo kiểm chứng để đối chiếu." };
    var ok = E.n >= 50 && E.rsix.edge >= 5 && E.fade2.edge >= 5 && E.combo.edge >= 5;
    return ok ? { key: "fair", label: "Khá", cls: "upb", why: "Ngoài mẫu " + E.n + " mã " + LABEL[ex] + "; RSIx, Fade2 và tổ hợp đều hơn mức ngẫu nhiên cùng độ phủ ≥ 5 điểm." }
      : { key: "cautious", label: "Thận trọng", cls: "mid", why: "Ngoài mẫu chỉ " + E.n + " mã " + LABEL[ex] + " (< 50) nên kết luận kém vững hơn." };
  }
  function band(score) { return score >= 100 ? "Tham gia đủ" : score >= 50 ? "Tham gia một nửa" : "Đứng ngoài"; }
  function score(V, ex) {
    var a = V && V.tools && V.tools.rsix, b = V && V.tools && V.tools.fade2;
    if (!V || !V.ready || !a || !b || a.state === "na" || b.state === "na") {
      var need = Math.max(a && a.need || 0, b && b.need || 0);
      return { ready: false, reason: V && V.ready ? "Cần ≥ " + need + " nến ngày (hiện có " + V.n + ")." : (V && V.reason || "Chưa có dữ liệu."), need: need };
    }
    var la = isLong(a), lb = isLong(b), s = (la ? 50 : 0) + (lb ? 50 : 0), E = ex && EXCH[ex] || null;
    return {
      ready: true, score: s, band: band(s), parts: { rsix: la ? 50 : 0, fade2: lb ? 50 : 0 },
      fresh: [["RSIx", a], ["Fade2", b]].filter(function (x) { return x[1].state === "buy_new" || x[1].state === "sell_new"; }).map(function (x) { return { name: x[0], state: x[1].state }; }),
      pending: [["RSIx", a], ["Fade2", b]].filter(function (x) { return x[1].pend; }).map(function (x) { return { name: x[0], pend: x[1].pend }; }),
      strength: strength(ex), exchange: ex || null,
      expect: E ? { edge: E.combo.edge, net: E.combo.net, bh: E.bh, n: E.n } : null
    };
  }
  /* ---------- ĐIỂM TỔNG HỢP THEO SÀN & THEO MÃ (V2.76) ----------
     Quy tắc công khai, suy từ thước đo kiểm chứng của CHÍNH SÀN đó (không có trọng số tự đặt theo cảm tính):
       Nhóm LÕI  — RSIx và Fade2: hơn mức vào/ra ngẫu nhiên cùng độ phủ ≥ 5 điểm ngoài mẫu → chia đều.
       Nhóm LỌC  — công cụ xu hướng mà báo cáo xếp “bộ lọc” (lãi ròng toàn kỳ > 0 trên sàn đó; hiện chỉ có ở HOSE) → chiếm 30% điểm, chia đều.
                   Sàn không có công cụ lọc đạt điều kiện (HNX, UPCoM: mọi công cụ xu hướng đều lỗ) → nhóm lọc = 0 và lõi chiếm 100% (đúng mô hình 50/50 đã đo).
       Công cụ vai trò “tham khảo”/“thử nghiệm” (lãi ròng ≤ 0, hoặc lợi thế yếu) → 0 điểm, chỉ hiển thị.
       Công cụ chưa đủ nến → bỏ khỏi nhóm và chia lại điểm trong nhóm; không bao giờ coi là “đứng ngoài”.
     Tỷ lệ 70/30 là ngưỡng khởi điểm, calibrated:false; việc GHÉP lõi với nhóm lọc CHƯA được đo ngoài mẫu (chỉ từng phần được đo). Theo từng mã: chỉ báo “độ phù hợp của mã”
     (số công cụ có điểm mà mô phỏng 5 năm trên chính mã hơn mức ngẫu nhiên cùng độ phủ) — thông tin, KHÔNG đổi điểm vì một mã chỉ là một mẫu. */
  var W_FILTER = 30;
  function bandC(sc) { return sc <= 0 ? "Đứng ngoài" : sc >= 100 ? "Tham gia đủ" : sc < 35 ? "Tham gia thấp" : sc < 65 ? "Tham gia vừa" : "Tham gia cao"; }
  function filterSet(ex) { var F = ex && FULL[ex]; return F ? EXTRA.filter(function (x) { var d = F.tools[x.id]; return d && d.role === "filter" && d.net > 0; }) : []; }
  function composite(V, ex) {
    var core = score(V, ex);
    if (!core.ready) return { ready: false, reason: core.reason, need: core.need };
    var F = ex && FULL[ex] || null, all = filterSet(ex), live = all.filter(function (x) { return V.extra && V.extra[x.id] && V.extra[x.id].state !== "na"; });
    var skipped = all.filter(function (x) { return live.indexOf(x) < 0; }).map(function (x) { return x.name; });
    var hasF = live.length > 0, wCore = hasF ? 100 - W_FILTER : 100, wF = hasF ? W_FILTER : 0, comps = [], total = 0;
    [["rsix", "RSIx"], ["fade2", "Fade2"]].forEach(function (c) { var t = V.tools[c[0]], on = isLong(t), w = wCore / 2; comps.push({ id: c[0], name: c[1], grp: "core", w: w, on: on, state: t.state, pts: on ? w : 0, rep: t.rep }); if (on) total += w; });
    live.forEach(function (x) { var t = V.extra[x.id], on = isLong(t), w = wF / live.length; comps.push({ id: x.id, name: x.name, grp: "filter", w: w, on: on, state: t.state, pts: on ? w : 0, rep: t.rep }); if (on) total += w; });
    var unscored = F ? EXTRA.filter(function (x) { return F.tools[x.id] && live.indexOf(x) < 0 && skipped.indexOf(x.name) < 0; }).map(function (x) { return { name: x.name, role: F.tools[x.id].role, net: F.tools[x.id].net }; }) : [];
    var fitN = 0, fitP = 0; comps.forEach(function (c) { if (c.rep && fin(c.rep.excess)) { fitN++; if (c.rep.excess > 0) fitP++; } });
    var fOn = comps.filter(function (c) { return c.grp === "filter" && c.on; }).length, fAll = comps.filter(function (c) { return c.grp === "filter"; }).length;
    total = Math.round(total);
    return { ready: true, score: total, band: bandC(total), core: core, comps: comps, wCore: wCore, wFilter: wF, filterOn: fOn, filterTotal: fAll, skipped: skipped, unscored: unscored,
      fit: { pos: fitP, n: fitN }, strength: core.strength, exchange: ex || null, expect: core.expect, fresh: core.fresh, blended: hasF };
  }

  function evaluate(candles, ex) { var V = analyze(candles || []); return { view: V, score: score(V, ex) }; }
  /* Huy hiệu theo sàn (hiện cạnh kết quả AI): thay cho huy hiệu "Bộ chấm điểm" cũ */
  function badge(ex) {
    var E = ex && EXCH[ex], st = strength(ex);
    if (!E) return { status: "unknown", label: "Chưa rõ sàn", title: st.why };
    return { status: st.key === "fair" ? "validated" : "trial", label: "RSIx + Fade2 · " + st.label,
      title: "Ngoài mẫu 10/2024–10/2026, " + E.n + " mã " + LABEL[ex] + ": hơn mức ngẫu nhiên cùng độ phủ " + (E.combo.edge > 0 ? "+" : "") + E.combo.edge.toFixed(1).replace(".", ",") + " điểm (tổ hợp 50/50). Không phải khuyến nghị đầu tư." };
  }
  function view(key, candles) {
    if (CACHE && CACHE.key === key) return CACHE.v;
    var v = analyze(candles); CACHE = { key: key, v: v }; return v;
  }

  W.NHIPVScore = {
    version: "1.3", KEYS: KEYS, W_FILTER: W_FILTER, composite: composite, bandC: bandC, filterSet: filterSet, EXTRA: EXTRA, FULL: FULL, LABEL: LABEL, PARAMS: PARAMS, TOOLS: TOOLS, EXCH: EXCH, COST: COST, COMBO_PROF: COMBO_PROF, REJECTED: REJECTED,
    analyze: analyze, score: score, evaluate: evaluate, strength: strength, band: band, badge: badge, replay: replay, mix: mix, excessPts: excessPts, isLong: isLong,
    ymd: ymd, vnNow: vnNow, view: view,
    _t: { nowMs: function () { return NOW != null ? NOW : Date.now(); }, setNow: function (ms) { NOW = ms; CACHE = null; }, reset: function () { CACHE = null; } }
  };
})(typeof window !== "undefined" ? window : this);
