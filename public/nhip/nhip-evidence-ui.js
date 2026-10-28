/* NHIP Evidence UI v4 — tab "Bằng chứng" (Phân tích) — V2.75: làm lại theo từng sàn, tối ưu màn hình điện thoại dọc.
   Nguyên tắc:
   • Sàn của mã lấy TỰ ĐỘNG từ danh bạ (symbols-vn.js qua NHIPExchange) — KHÔNG còn ô chọn sàn. Chưa biết sàn → không hiện thước đo của sàn nào (không đoán).
   • Mỗi sàn (HOSE / HNX / UPCoM) có bằng chứng riêng, đúng các thước đo của báo cáo kiểm chứng (nhip-vscore.js là nguồn duy nhất của số liệu):
       1) Hai công cụ chấm điểm RSIx + Fade2 (kiểm chứng ngoài mẫu 10/2024–10/2026): hơn mức vào/ra ngẫu nhiên cùng độ phủ, lãi ròng, mua-giữ.
       2) Công cụ tham khảo đã kiểm chứng riêng từng sàn (toàn kỳ 10/2021–10/2026): Supertrend, SMA, EMA, AO, Turtle, Stoch nghịch — hiện trạng thái hiện tại trên đúng mã,
          kèm kết quả đã kiểm chứng của sàn đó. Không cộng vào điểm; ghi rõ vai trò (bộ lọc / tham khảo / thử nghiệm).
   • Bố cục điện thoại dọc: không còn bảng nhiều cột; mỗi công cụ là một thẻ, số liệu xếp lưới 3–4 ô, chữ tự xuống dòng, chừa chỗ dưới cùng cho thanh điều hướng và nút AI.
   analysis-view.js gọi NHIPEvidenceUI.mount(ev,S,d) sau mỗi lần dựng bằng chứng (kể cả tick làm mới). Cần NHIPStrategies (v1.1+), NHIPVScore (v1.1+), NHIPExchange. */
(function (W, D) {
  "use strict";
  var VS = W.NHIPVScore, NS = W.NHIPStrategies;
  var ST = {}, FUND = {}, OPEN = {};

  /* ---------- tiện ích ---------- */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function fin(v) { return typeof v === "number" && isFinite(v); }
  function nf(v, d) { return fin(v) ? v.toLocaleString("vi-VN", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—"; }
  function sg(v, d) { return fin(v) ? (v > 0 ? "+" : v < 0 ? "−" : "") + nf(Math.abs(v), d) : "—"; }
  function pct(v, d) { return fin(v) ? sg(v, d == null ? 1 : d) + "%" : "—"; }
  function cls(v) { return fin(v) ? (v > 0 ? "up" : v < 0 ? "dn" : "") : ""; }
  function $(s) { return D ? D.querySelector(s) : null; }
  function ymd(t) {
    if (typeof t === "number" && isFinite(t)) return new Date((t < 1e11 ? t * 1000 : t) + 7 * 3600e3).toISOString().slice(0, 10);
    return String(t == null ? "" : t).slice(0, 10);
  }
  function dmy(s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ""); return m ? m[3] + "/" + m[2] + "/" + m[1] : String(s || "—"); }
  function dmy2(s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ""); return m ? m[3] + "/" + m[2] + "/" + m[1].slice(2) : String(s || "—"); }
  function dm(s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ""); return m ? m[3] + "/" + m[2] : String(s || "—"); }

  /* ---------- thước đo chuẩn theo sàn: một nguồn duy nhất trong nhip-vscore.js ---------- */
  var KEYS = VS.KEYS, LABEL = VS.LABEL, TOOLS = VS.TOOLS, EXCH = VS.EXCH, EXTRA = VS.EXTRA, FULL = VS.FULL, COMBO_PROF = VS.COMBO_PROF;
  var STATE_TXT = { buy_new: ["Mua mới", "upb"], sell_new: ["Bán mới", "dnb"], long: ["Đang mua", "upb"], flat: ["Đứng ngoài", "mid"], na: ["Chưa đủ dữ liệu", "mid"] };
  var ROLE_TXT = { filter: "Bộ lọc xu hướng", ref: "Tham khảo", trial: "Thử nghiệm" };
  var IDXRE = /^(VNINDEX|VN30|VN100|VNALL|VNMID|VNSML|HNX\w*|UPCOM\w*)$/;

  /* ---------- nhận diện sàn (tự động, không có chọn tay) ---------- */
  function normEx(v) {
    if (v == null || typeof v === "object") return null;
    var s = String(v).toUpperCase().replace(/[^A-Z]/g, "");
    return s === "HOSE" || s === "HSX" ? "HOSE" : s === "HNX" || s === "HASTC" ? "HNX" : s === "UPCOM" ? "UPCOM" : null;
  }
  function exOf(o) { if (!o || typeof o !== "object") return null; var f = ["exchange", "exch", "floor", "market", "board", "san", "sàn"]; for (var i = 0; i < f.length; i++) { var e = normEx(o[f[i]]); if (e) return e; } return null; }
  /* Thứ tự: danh bạ mã (NHIPExchange: symbols-vn.js là CHUẨN) → trường sàn trong dữ liệu của mã → không rõ. */
  function detectExchange(sym, S, d) {
    var e = null;
    try { var r = W.NHIPExchange && W.NHIPExchange.resolve ? W.NHIPExchange.resolve(sym) : null; e = r && r.known ? normEx(r.ex) : null; if (e) return { key: e, src: "list" }; } catch (x) { /* bỏ qua */ }
    var objs = [S, d, d && d.meta, d && d.info, d && d.profile, S && S.meta, S && S.info];
    for (var i = 0; i < objs.length; i++) if ((e = exOf(objs[i]))) return { key: e, src: "data" };
    return { key: null, src: "none" };
  }

  function isLong(t) { return VS.isLong(t); }
  function px(V, v) { return fin(v) ? nf(v * V.scale, 0) : "—"; }

  /* ---------- hiển thị ---------- */
  function chip(s) { var t = STATE_TXT[s] || STATE_TXT.na; return '<span class="sg ' + t[1] + '">' + t[0] + "</span>"; }
  function gauge(o) {
    function pos(v) { return Math.max(0, Math.min(100, (v - o.min) / (o.max - o.min) * 100)); }
    var z = o.zones.map(function (zn) { var a = pos(zn.from), b = pos(zn.to); return '<i class="nv-z ' + zn.cls + '" style="left:' + a.toFixed(1) + "%;width:" + (b - a).toFixed(1) + '%"></i>'; }).join("");
    var tk = o.ticks.map(function (t) { return '<i class="nv-tk" style="left:' + pos(t.v).toFixed(1) + '%"></i>'; }).join("");
    var lab = o.ticks.map(function (t) { return '<span style="left:' + Math.max(14, Math.min(86, pos(t.v))).toFixed(1) + '%">' + t.label + "</span>"; }).join("");
    return '<div class="nv-gauge" role="img" aria-label="' + esc(o.aria) + '"><div class="nv-track">' + z + tk + '<b class="nv-dot" style="left:' + pos(o.value).toFixed(1) + '%"></b></div><div class="nv-glab">' + lab + "</div></div>";
  }
  function stat(label, val, c, sub) { return '<div><small>' + label + '</small><b class="' + (c || "") + '">' + val + "</b>" + (sub ? "<small>" + sub + "</small>" : "") + "</div>"; }
  function stats(cols, cells) { return '<div class="nv-st" style="--c:' + cols + '">' + cells.join("") + "</div>"; }
  function pendNote(t, name) { return t.pend ? '<p class="nv-warn">Giá hiện tại đã chạm điều kiện ' + (t.pend === "buy" ? "MUA" : "BÁN") + " của " + esc(name) + " — chỉ được xác nhận nếu nến hôm nay đóng cửa như vậy.</p>" : ""; }
  function sigWord(t) {
    return t.state === "buy_new" ? "Vừa có tín hiệu MUA ở nến đóng " + dm(ST.V.closed) + "; lệnh khớp ở giá mở cửa phiên kế tiếp."
      : t.state === "sell_new" ? "Vừa có tín hiệu BÁN ở nến đóng " + dm(ST.V.closed) + "; khớp ở giá mở cửa phiên kế tiếp (chịu khóa T+2)." : "";
  }
  function holdWord(V, t) { return t.since ? "Đang giữ từ tín hiệu mua " + dmy2(t.since) + (fin(t.entry) ? ", giá vào " + px(V, t.entry) + " (hiện " + pct((V.price / t.entry - 1) * 100, 1) + ")" : "") + ". " : ""; }
  function naCard(name, t) { return '<div class="nv-tool"><div class="nv-trow"><b>' + esc(name) + "</b>" + chip("na") + '</div><p class="nv-txt">Cần ≥ ' + t.need + " nến ngày (hiện có " + t.have + ").</p></div>"; }

  function rsixCard(V, t) {
    var r = t.rsi, p = t.p, body;
    if (t.state === "na") return naCard("RSIx", t);
    var g = gauge({ min: 0, max: 100, value: r, aria: "RSI " + nf(r, 1) + ", vùng mua dưới " + p.low + ", vùng bán trên " + p.high,
      zones: [{ from: 0, to: p.low, cls: "buy" }, { from: p.high, to: 100, cls: "sell" }], ticks: [{ v: p.low, label: p.low + "<br>mốc mua" }, { v: p.high, label: p.high + "<br>mốc bán" }] });
    if (isLong(t)) body = holdWord(V, t) + "Bán khi RSI ≥ " + p.high + " hoặc rơi lại dưới " + p.low + " (hiện " + nf(r, 1) + ").";
    else if (r < p.low) body = "RSI đang dưới " + p.low + " (quá bán sâu). Mua khi RSI cắt lên trên " + p.low + ".";
    else body = "Chờ RSI xuống dưới " + p.low + " rồi cắt lên lại (hiện " + nf(r, 1) + ", cách mốc " + nf(r - p.low, 1) + " điểm).";
    return '<div class="nv-tool"><div class="nv-trow"><b>RSIx</b><span class="nv-def">RSI(' + p.period + ") · " + p.low + "/" + p.high + "</span>" + chip(t.state) + "</div>" + g +
      '<p class="nv-txt">' + esc(sigWord(t) || body) + "</p>" + pendNote(t, "RSIx") + "</div>";
  }
  function fade2Card(V, t) {
    var p = t.p, body;
    if (t.state === "na") return naCard("Fade2", t);
    var L = t.floor, H = t.ceil, price = V.price, lo = Math.min(L, price), hi = Math.max(fin(H) ? H : price, price), pad = (hi - lo) * 0.08 || price * 0.02, g;
    var dL = (L / price - 1) * 100, dH = fin(H) ? (H / price - 1) * 100 : NaN;
    g = gauge({ min: lo - pad, max: hi + pad, value: price, aria: "Giá " + px(V, price) + ", mốc mua " + px(V, L) + ", mốc bán " + px(V, H),
      zones: [{ from: lo - pad, to: L, cls: "buy" }].concat(fin(H) ? [{ from: H, to: hi + pad, cls: "sell" }] : []),
      ticks: [{ v: L, label: "Đáy " + p.low + " phiên<br>" + px(V, L) }].concat(fin(H) ? [{ v: H, label: "Đỉnh " + p.high + " phiên<br>" + px(V, H) }] : []) });
    if (isLong(t)) body = holdWord(V, t) + "Bán khi đóng cửa vượt " + px(V, H) + " (" + pct(dH, 1) + " so với giá hiện tại " + px(V, price) + ").";
    else body = "Chờ giá đóng cửa thủng " + px(V, L) + " (" + pct(dL, 1) + " so với giá hiện tại " + px(V, price) + ").";
    return '<div class="nv-tool"><div class="nv-trow"><b>Fade2</b><span class="nv-def">đáy ' + p.low + " / đỉnh " + p.high + " phiên</span>" + chip(t.state) + "</div>" + g +
      '<p class="nv-txt">' + esc(sigWord(t) || body) + "</p>" + (isLong(t) && fin(t.entry) && V.price / t.entry - 1 < -0.15 ? '<p class="nv-warn">Đang lỗ ' + nf(Math.abs((V.price / t.entry - 1) * 100), 1) + "% so với giá vào. Fade2 không có lệnh cắt lỗ — chỉ thoát khi đóng cửa vượt đỉnh " + p.high + " phiên.</p>" : "") + pendNote(t, "Fade2") + "</div>";
  }

  /* ---------- các khối ---------- */
  function headHTML(V, ex) {
    return '<div class="nv-head"><div class="nv-ht"><div class="eyebrow">BẰNG CHỨNG · ' + esc(ST.sym || "—") + '</div><div class="nv-sub">' + V.n + " nến ngày đã đóng · nến cuối " + dmy(V.closed) + "</div></div>" +
      (ex.key ? '<span class="nv-ex nv-ex-' + ex.key + '" title="Sàn lấy tự động từ danh bạ mã">' + LABEL[ex.key] + "</span>" : '<span class="nv-ex nv-ex-none">Chưa rõ sàn</span>') + "</div>" +
      (V.partial ? '<p class="nv-warn">Phiên ' + dm(V.liveDate) + " đang diễn ra — kết luận dựa trên nến đã đóng " + dm(V.closed) + " (giá hiện tại " + px(V, V.price) + "). Tín hiệu chỉ xác nhận khi đóng cửa.</p>" : "") +
      (ex.key ? "" : '<p class="nv-warn">Chưa xác định được sàn của mã này trong danh bạ nên chưa hiện thước đo kiểm chứng của sàn nào (mỗi sàn có số liệu riêng, không đoán). Thêm mã ở Cài đặt → Danh bạ mã để có bằng chứng đúng sàn.</p>');
  }
  function verdictHTML(V, ex) {
    var C = VS.composite(V, ex.key);
    if (!C.ready) return '<section class="nv-card"><div class="eyebrow">ĐIỂM THAM GIA · TỔNG HỢP THEO SÀN</div><p class="nv-txt">Chưa đủ dữ liệu: ' + esc(C.reason) + "</p></section>";
    var R = C.core, st = C.strength, E = ex.key ? EXCH[ex.key] : null;
    var nCore = C.comps.filter(function (c) { return c.grp === "core" && c.on; }).length;
    var head = C.blended ? "Lõi " + nCore + "/2 đang MUA · lọc xu hướng " + C.filterOn + "/" + C.filterTotal : nCore === 2 ? "Cả hai công cụ đang MUA" : nCore === 1 ? "Một trong hai công cụ đang MUA" : "Cả hai công cụ đang ĐỨNG NGOÀI";
    var seg = C.comps.map(function (c) { return '<i class="' + (c.on ? "on" : "") + (c.grp === "filter" ? " f" : "") + '" style="flex:' + c.w.toFixed(2) + ' 1 0"></i>'; }).join("");
    var rows = C.comps.map(function (c) { return "<span" + (c.grp === "filter" ? ' class="f"' : "") + ">" + esc(c.name) + " · " + STATE_TXT[c.state][0] + " · <b>" + nf(c.pts, c.pts % 1 ? 1 : 0) + "/" + nf(c.w, c.w % 1 ? 1 : 0) + "</b></span>"; }).join("");
    var news = C.fresh.map(function (x) { return '<div class="nv-new ' + (x.state === "buy_new" ? "up" : "dn") + '">' + x.name + " vừa báo " + (x.state === "buy_new" ? "MUA" : "BÁN") + " ở nến đóng " + dm(V.closed) + "</div>"; }).join("");
    var exp = E ? '<p class="nv-cap">Phần lõi đã kiểm chứng · RSIx + Fade2 50/50 · sàn ' + LABEL[ex.key] + " · ngoài mẫu</p>" + stats(3, [stat("Hơn mốc", sg(E.combo.edge, 1) + "<em> điểm</em>", "up"), stat("Lãi ròng", pct(E.combo.net, 1), cls(E.combo.net)), stat("Mua-giữ", pct(E.bh, 1), cls(E.bh))]) : "";
    var warn = C.blended ? '<p class="nv-warn">Nhóm lọc xu hướng chiếm ' + C.wFilter + " điểm; việc ghép nhóm này với lõi <b>chưa được đo ngoài mẫu</b> (từng phần mới có số riêng). Lõi vẫn là phần đã kiểm chứng.</p>" : "";
    var skip = C.skipped.length ? '<p class="nv-note">Chưa đủ nến nên bỏ khỏi điểm: ' + esc(C.skipped.join(", ")) + ".</p>" : "";
    var fit = C.fit.n ? '<p class="nv-txt"><b>Độ phù hợp của mã:</b> ' + C.fit.pos + "/" + C.fit.n + " công cụ có điểm hơn mức ngẫu nhiên cùng độ phủ trên chính mã này (mô phỏng ≈ " + nf(V.years, 1) + ' năm). <span class="muted">Chỉ để tham khảo — một mã là một mẫu, không đổi điểm.</span></p>' : "";
    var un = C.unscored.length ? "<li><b>Không cộng điểm</b> (lãi ròng toàn kỳ ≤ 0 hoặc lợi thế yếu trên sàn này): " + C.unscored.map(function (x) { return esc(x.name); }).join(", ") + ".</li>" : "";
    return '<section class="nv-card nv-verdict"><div class="eyebrow">ĐIỂM THAM GIA · TỔNG HỢP THEO SÀN' + (ex.key ? " " + LABEL[ex.key].toUpperCase() : "") + '</div><div class="nv-big"><b class="' + (C.score ? "up" : "") + '">' + C.score + '<small class="nv-of">/100</small></b><span>' + C.band + "<br><small>" + head + "</small></span></div>" +
      '<div class="nv-seg">' + seg + '</div><div class="nv-segl">' + rows + "</div>" + news + warn + skip + exp + fit +
      '<p class="nv-txt">Độ vững bằng chứng (phần lõi): <span class="sg ' + st.cls + '">' + st.label + "</span></p><p class=\"nv-note\">" + esc(st.why) + "</p>" +
      '<details data-k="score"><summary>Điểm này được tính thế nào?</summary><ul class="nv-ul"><li><b>Lõi (' + C.wCore + ' điểm):</b> RSIx và Fade2, mỗi công cụ đang MUA được ' + nf(C.wCore / 2, 0) + " điểm — đúng mô hình 50/50 đã đo ngoài mẫu.</li>" +
      "<li><b>Nhóm lọc xu hướng (" + C.wFilter + " điểm):</b> " + (C.blended ? "các công cụ xu hướng mà sàn này có lãi ròng toàn kỳ dương (" + C.comps.filter(function (c) { return c.grp === "filter"; }).map(function (c) { return esc(c.name); }).join(", ") + "), chia đều; đang giữ thì được điểm." : "sàn này không có công cụ xu hướng nào lãi ròng dương nên nhóm lọc = 0, lõi chiếm 100 điểm.") + "</li>" + un +
      "<li>Mọi trạng thái tính từ nến ĐÃ ĐÓNG; phiên đang chạy không được dùng để ra tín hiệu. Công cụ chưa đủ nến bị bỏ và điểm được chia lại trong nhóm.</li><li><b>Điểm không phải xác suất tăng giá</b> và không phải khuyến nghị. Tỷ lệ 70/30 là ngưỡng khởi điểm chưa hiệu chỉnh.</li>" +
      "<li>Độ vững: “Khá” khi ≥ 50 mã ngoài mẫu và RSIx, Fade2, tổ hợp đều hơn mức ngẫu nhiên cùng độ phủ ≥ 5 điểm; không bao giờ “Cao” vì ngoài mẫu mới có 2 cửa sổ trong 1 chu kỳ.</li></ul></details></section>";
  }
  function scorersHTML(V) {
    return '<section class="nv-sec"><div class="eyebrow">2 CÔNG CỤ CHẤM ĐIỂM · TÍN HIỆU HIỆN TẠI</div>' + rsixCard(V, V.tools.rsix) + fade2Card(V, V.tools.fade2) + "</section>";
  }
  function metricsHTML(ex) {
    if (!ex.key) return "";
    var E = EXCH[ex.key], rows = [["RSIx", "RSI(14) · 25/70", E.rsix, TOOLS[0].prof], ["Fade2", "đáy 30 / đỉnh 80 phiên", E.fade2, TOOLS[1].prof], ["Tổ hợp 50/50", "RSIx + Fade2", E.combo, COMBO_PROF]];
    var body = rows.map(function (r) {
      var x = r[2], w = Math.max(0, Math.min(100, x.edge / 8 * 100));
      return '<div class="nv-tool"><div class="nv-trow"><b>' + r[0] + '</b><span class="nv-def">' + r[1] + "</span></div>" +
        stats(3, [stat("Hơn mốc", sg(x.edge, 1) + "<em> điểm</em>", "up"), stat("Lãi ròng", x.net == null ? esc(x.netText) : pct(x.net, 1), x.net == null ? "" : cls(x.net)), stat("Mua-giữ", pct(E.bh, 1), cls(E.bh))]) +
        '<i class="nv-bar"><u style="width:' + w.toFixed(0) + '%"></u></i><p class="nv-note">' + esc(r[3]) + "</p></div>";
    }).join("");
    return '<section class="nv-sec"><div class="eyebrow">THƯỚC ĐO KIỂM CHỨNG · SÀN ' + LABEL[ex.key].toUpperCase() + '</div><p class="nv-cap">Ngoài mẫu 10/2024 → 10/2026 · ' + E.n + " mã " + LABEL[ex.key] + " · tham số chọn trên các năm trước</p>" + body +
      '<p class="nv-txt">' + esc(E.read) + '</p><p class="nv-note">Đã trừ phí, thuế bán, trượt giá, T+, lô, biên độ. Cả hai công cụ dương ở cả hai cửa sổ ngoài mẫu.</p>' +
      '<details data-k="metric"><summary>Cách đọc các số</summary><ul class="nv-ul"><li><b>Hơn mốc</b> = lãi công cụ trừ lãi của việc vào/ra ngẫu nhiên nhưng ở trong thị trường cùng tỷ lệ thời gian (điểm %). Dương nghĩa là chọn thời điểm có lợi thật, không chỉ nhờ đứng ngoài lúc thị trường giảm.</li><li><b>Lãi ròng</b> = lợi suất cộng dồn trên dữ liệu không dùng để chọn tham số.</li><li><b>Mua-giữ</b> = so sánh gốc cùng kỳ, cùng rổ mã.</li></ul></details></section>';
  }
  function extraState(V, x, t) {
    if (t.state === "na") return "Cần ≥ " + t.need + " nến ngày (hiện có " + t.have + ").";
    var w = sigWord(t); if (w) return w;
    if (isLong(t)) return t.since ? "Đang giữ từ " + dmy2(t.since) + (fin(t.entry) ? ", giá vào " + px(V, t.entry) + " (hiện " + pct((V.price / t.entry - 1) * 100, 1) + ")" : "") + "." : "Đang giữ.";
    return "Đang đứng ngoài.";
  }
  function extrasList(ex) { var F = ex.key && FULL[ex.key]; return F ? EXTRA.filter(function (x) { return F.tools[x.id]; }) : []; }
  function extrasHTML(V, ex) {
    if (!ex.key) return "";
    var F = FULL[ex.key], list = extrasList(ex), tr = list.filter(function (x) { return x.trend; }), on = tr.filter(function (x) { return isLong(V.extra[x.id]); });
    var ctx = tr.length ? '<p class="nv-txt"><b>Bối cảnh xu hướng:</b> ' + on.length + "/" + tr.length + " công cụ xu hướng đang giữ" + (on.length ? " (" + on.map(function (x) { return x.name; }).join(", ") + ")" : "") + (VS.filterSet(ex.key).length ? ". Nhóm này đã được tính " + VS.W_FILTER + "% điểm tổng hợp (chưa kiểm chứng khi ghép)." : ". Sàn này không có công cụ xu hướng lãi ròng dương nên chỉ để tham khảo, không cộng điểm.") + "</p>" : "";
    var cards = list.map(function (x) {
      var d = F.tools[x.id], t = V.extra[x.id];
      return '<div class="nv-tool"><div class="nv-trow"><b>' + esc(x.name) + '</b><span class="nv-def">' + esc(x.def) + "</span>" + chip(t.state) + "</div>" +
        stats(3, [stat("Lãi ròng 5 năm", pct(d.net, 1), cls(d.net)), stat("Hơn mốc", d.edge == null ? "chưa có" : sg(d.edge, 1) + "<em> điểm</em>", d.edge == null ? "muted" : cls(d.edge)), stat("Vai trò", ROLE_TXT[d.role] || "Tham khảo", "role")]) +
        '<p class="nv-txt">' + esc(extraState(V, x, t)) + '</p><p class="nv-note">' + esc(d.read) + "</p>" + pendNote(t, x.name) + "</div>";
    }).join("");
    return '<section class="nv-sec"><div class="eyebrow">CÔNG CỤ THAM KHẢO · SÀN ' + LABEL[ex.key].toUpperCase() + '</div><p class="nv-cap">Toàn kỳ 10/2021 → 10/2026 · ' + esc(F.span) + " · mua-giữ cùng kỳ " + pct(F.bh, 1) + " · tham số mặc định</p>" + ctx + cards +
      '<p class="nv-note">' + esc(F.note) + "</p></section>";
  }
  function simRow(name, rep, nTr) {
    return '<div class="nv-tool nv-sim"><div class="nv-trow"><b>' + esc(name) + "</b></div>" + stats(4, [stat("Lệnh", nTr), stat("Độ phủ", nf(rep.expo * 100, 0) + "%"), stat("Lãi ròng", pct(rep.net * 100, 1), cls(rep.net)), stat("Hơn mốc", sg(rep.excess, 1), cls(rep.excess))]) + "</div>";
  }
  function replayHTML(V, ex) {
    var a = V.tools.rsix, b = V.tools.fade2;
    if (!a.rep || !b.rep) return "";
    var rows = simRow("RSIx", a.rep, a.rep.trades.length) + simRow("Fade2", b.rep, b.rep.trades.length) + simRow("Tổ hợp 50/50", V.combo, V.combo.nTrades);
    extrasList(ex).forEach(function (x) { var t = V.extra[x.id]; if (t && t.rep) rows += simRow(x.name, t.rep, t.rep.trades.length); });
    var small = a.rep.trades.length + b.rep.trades.length < 5 ? '<p class="nv-warn">Mẫu rất nhỏ (' + (a.rep.trades.length + b.rep.trades.length) + " lệnh) — chỉ để minh họa; bằng chứng chính là thước đo của sàn ở trên.</p>" : "";
    function log(name, t, cs) {
      if (!t.rep.trades.length) return "";
      return "<b>" + name + "</b>" + t.rep.trades.slice(-5).map(function (x) { return '<div class="nv-log"><span>' + dm(ymd(cs[x.i0].time)) + " → " + (x.i1 == null ? "đang giữ" : dm(ymd(cs[x.i1].time))) + '</span><b class="' + cls(x.r) + '">' + pct(x.r * 100, 1) + "</b></div>"; }).join("");
    }
    return '<section class="nv-sec"><div class="eyebrow">ÁP DỤNG TRÊN CHÍNH MÃ NÀY · MÔ PHỎNG NHANH</div><p class="nv-cap">' + V.n + " nến (≈ " + nf(V.years, 1) + " năm) · toàn bộ vốn vào một mã · mua-giữ cùng kỳ " + pct(a.rep.bh * 100, 1) + "</p>" + rows + small +
      '<p class="nv-note"><b>Một mã chỉ là một mẫu:</b> lợi thế được kiểm chứng là trung bình trên cả rổ mã của sàn; từng mã có thể lệch rất xa mức đó. “Hơn mốc” = hơn mức vào/ra ngẫu nhiên cùng độ phủ (điểm %). Khớp ở giá mở cửa nến kế tiếp, phí 0,15%/chiều, thuế bán 0,1%, trượt giá 0,1%, khóa bán T+2. Không thay thế Kiểm thử đầy đủ luật VN (lô, bước giá, biên độ).</p>' +
      '<details data-k="log"><summary>Nhật ký lệnh gần nhất (RSIx, Fade2)</summary><div class="nv-logs">' + (log("RSIx", a, V.cs) + log("Fade2", b, V.cs) || '<p class="nv-note">Chưa có lệnh nào.</p>') + "</div></details></section>";
  }
  function rejectedHTML(ex) {
    var F = ex && ex.key ? FULL[ex.key] : null;
    var own = F ? F.old.map(function (r) { return "<li><b>" + esc(r.t) + " (" + LABEL[ex.key] + ").</b> " + esc(r.d) + "</li>"; }).join("") : "";
    return '<details class="nv-fold" data-k="rejected"><summary>Đã kiểm chứng nhưng không đạt — vì sao không nằm trong bộ chấm điểm</summary><ul class="nv-ul">' + own +
      VS.REJECTED.map(function (r) { return "<li><b>" + esc(r.t) + ".</b> " + esc(r.d) + "</li>"; }).join("") +
      '</ul><p class="nv-note">Nguồn: báo cáo kiểm chứng trên dữ liệu thật 20/10/2021 → 19/10/2026 (giá điều chỉnh): rổ 120 HOSE, 80 HNX, 80 + 47 UPCoM (hai đoạn vì thiếu 20/10/2023–20/10/2024), 29 công cụ, 5 cửa sổ ~1 năm, đã trừ phí 0,15%/chiều, thuế bán 0,1%, trượt giá 0,1%, T+, lô, biên độ. Thử nhiều công cụ × nhiều sàn nên có thể có kết quả trùng hợp.</p></details>';
  }
  function notesHTML(ex) {
    return '<details class="nv-fold" data-k="limits"><summary>Giới hạn &amp; những gì không hiển thị</summary><ul class="nv-ul">' +
      "<li>Ngoài mẫu chỉ có 2 cửa sổ ~1 năm trong một chu kỳ thị trường (tăng rồi giảm)" + (ex && ex.key === "UPCOM" ? "; UPCoM chỉ có " + EXCH.UPCOM.n + " mã" : "") + ".</li>" +
      "<li>Công cụ tham khảo (Supertrend, SMA, EMA, AO, Turtle, Stoch nghịch) dùng tham số mặc định và kỳ kiểm chứng khác (5 năm), không cùng kỳ ngoài mẫu với RSIx/Fade2 nên không so trực tiếp số với nhau. Báo cáo không nêu “hơn mốc” riêng cho từng công cụ ở mọi sàn — ô nào để “chưa có” là chưa có số, không phải bằng 0.</li>" +
      "<li>Chưa đo mức sụt vốn tối đa; không tính lãi tiền mặt khi đứng ngoài; chỉ mua, không bán khống; rổ chọn theo thanh khoản nên có thiên lệch sống sót nhẹ.</li>" +
      "<li>Fade2 gần như không có lãi tuyệt đối — giá trị là giảm rủi ro — và không có lệnh cắt lỗ (chỉ thoát khi đóng cửa vượt đỉnh 80 phiên) nên có thể giữ qua đợt giảm sâu, dài. RSIx chỉ ~1–2 lệnh/năm nên mẫu theo từng mã rất nhỏ.</li>" +
      "<li>Trạng thái “đang mua” tính từ các nến đang có trên mã này; Fade2 cần ≥ 82 nến, RSIx ≥ 42 nến, Turtle ≥ 57 nến.</li>" +
      "<li>Các điểm/chỉ báo khác (điểm rủi ro, điểm xếp hạng cũ, MACD/Bollinger/ATR, cấu trúc giá, đa khung, kiểm thử beta…) đã được gỡ khỏi tab này vì chưa đạt thước đo hoặc chưa được tích hợp vào bộ kiểm thử.</li>" +
      "<li>Đây là kết quả lịch sử, không phải khuyến nghị đầu tư.</li></ul></details>";
  }

  /* ---- phân tích cơ bản (tham khảo, ngoài bộ kiểm chứng) — chỉ tải khi mở ---- */
  var FUND_GROUPS = [
    { t: "Định giá", items: [["P/E", "Giá / thu nhập"], ["P/B", "Giá / sổ sách"]] },
    { t: "Sinh lời", items: [["EPS", "Lãi / cổ phiếu"], ["ROE", "LN / vốn chủ"], ["ROA", "LN / tài sản"]] }
  ];
  function fundCards(map) {
    map = map || {};
    return FUND_GROUPS.map(function (g) {
      return '<div class="nhip-fund-g"><div class="nhip-fund-gt">' + g.t + '</div><div class="nhip-fund-grid" style="--n:' + g.items.length + '">' + g.items.map(function (it) {
        var r = map[it[0]], v = r && r.text != null ? r.text : "—";
        return '<div class="nhip-fund-item' + (r && r.text != null ? "" : " is-empty") + '"><span class="nhip-fund-k">' + esc(it[0]) + '</span><b class="nhip-fund-v">' + esc(v) + '</b><span class="nhip-fund-s">' + esc(it[1]) + "</span>" + (r && r.reportDate ? '<small class="nhip-fund-d">' + esc(r.reportDate) + "</small>" : "") + (r && r.error ? '<small class="nhip-fund-d">Nguồn lỗi</small>' : "") + "</div>";
      }).join("") + "</div></div>";
    }).join("");
  }
  /* V2.81: chỉ số cơ bản do NHIPFund tự nạp (cache 12 giờ, dùng chung với điểm cộng); không còn chờ người dùng mở khối. */
  var FUND_KEYS = { "P/E": "pe", "P/B": "pb", "EPS": "eps", "ROE": "roe", "ROA": "roa" };
  function fundMap(e) {
    var m = {}; if (!e) return null;
    Object.keys(FUND_KEYS).forEach(function (lab) {
      var k = FUND_KEYS[lab], v = e.v && e.v[k], text = null;
      if (fin(v)) text = k === "roe" || k === "roa" ? nf(v, 2) + "%" : k === "eps" ? Math.round(v).toLocaleString("vi-VN") + " ₫" : nf(v, 2) + "x";
      m[lab] = { text: text, reportDate: e.date && e.date[k] || "", error: e.status === "error" ? "lỗi" : "" };
    });
    return m;
  }
  function fundStatus(e) { return !e ? "Đang nạp chỉ số cơ bản…" : e.status === "ok" ? "Nguồn FinInfo · kỳ dữ liệu mới nhất · tự nạp, dùng cho điểm cộng cơ bản" : e.status === "partial" ? "Nguồn FinInfo · một số chỉ số chưa có dữ liệu (cần ≥ 3/5 mới chấm điểm cộng)" : "Chưa nhận được chỉ số (không bị coi là điểm xấu)."; }
  function fundHTML() {
    var e = W.NHIPFund ? W.NHIPFund.get(ST.sym) : null;
    return '<details class="nv-fold" data-k="fund" id="nhip-fundamentals" data-sym="' + esc(ST.sym) + '" open><summary>Chỉ số cơ bản · tự nạp, dùng cho điểm cộng (chưa kiểm chứng)</summary><div class="nhip-fund-groups" id="nhip-fund-grid">' + fundCards(fundMap(e)) + '</div><div class="nhip-fund-cap" id="nhip-fund-status" aria-live="polite">' + esc(fundStatus(e)) + "</div></details>";
  }
  /* nạp theo thứ tự ① cơ bản → ② tin; xong thì vẽ lại đúng mã đang xem. Có đủ cache thì không làm gì (tránh vẽ lại mỗi nhịp làm mới). */
  function ensurePlus() {
    var sym = String(ST.sym || "").toUpperCase(), FU = W.NHIPFund, NW = W.NHIPNewsScore;
    if (!sym || IDXRE.test(sym) || !FU || !NW || typeof fetch !== "function") return;
    if (FU.fresh(FU.get(sym)) && NW.fresh(NW.get(sym))) return;
    if (ST.loading === sym) return; ST.loading = sym;
    FU.ensure(sym).then(function () { return NW.ensure(sym); }).then(function () { if (ST.loading === sym) ST.loading = null; if (String(ST.sym || "").toUpperCase() === sym) paint(); }, function () { if (ST.loading === sym) ST.loading = null; });
  }
  /* ---- thẻ ĐIỂM CỘNG: nền (đã kiểm chứng) + cơ bản + tin, đúng sàn của mã ---- */
  function plusHTML(V, ex) {
    var PL = W.NHIPPlus; if (!PL || !ex.key) return "";
    var r = PL.compute(ST.sym, ST.candles, { ex: ex.key, V: V }); if (!r.ready) return "";
    var F = r.fund, N = r.news, sym = ST.sym, pend = r.pending.fund || r.pending.news;
    var head = r.gated ? "Nền = 0 (đứng ngoài) nên điểm cộng CHƯA áp dụng" + (r.potential ? " — tiềm năng +" + nf(r.potential, 1) : "") : "Nền " + r.base + " + cộng " + nf(r.applied, 1) + (r.capped ? " (bị chặn ở 100)" : "");
    var fl = F.ready ? F.parts.filter(function (p) { return p.k !== "eps"; }).map(function (p) { return "<span>" + esc(p.label) + " " + esc(p.text) + " · <b>" + nf(p.pts, p.pts % 1 ? 1 : 0) + "/" + p.max + "</b></span>"; }).join("") : "";
    var fund = F.ready ? '<div class="nv-segl">' + fl + "</div>" + (F.capped ? '<p class="nv-note">' + esc(F.capped) + "</p>" : "") + '<p class="nv-note">Ngưỡng ' + LABEL[ex.key] + (F.financial ? " (nhóm " + esc(F.industry) + ": ngưỡng ROA/P/B riêng)" : "") + ": P/E ≤ " + W.NHIPFund.BANDS[ex.key].pe[0] + "x tốt · P/B ≤ " + W.NHIPFund.BANDS[ex.key].pb[0] + "x tốt · ROE ≥ " + W.NHIPFund.BANDS[ex.key].roe[0] + '% tốt. Ngưỡng khởi điểm, chưa kiểm chứng.</p>'
      : '<p class="nv-note">' + esc(F.reason || "") + "</p>";
    var news = "";
    if (N.ready) {
      news = N.rows.slice(0, 3).map(function (x) { return '<div class="nv-log"><span>' + (x.pol > 0 ? "▲ " : x.pol < 0 ? "▼ " : "• ") + (x.link ? '<a href="' + esc(x.link) + '" target="_blank" rel="noopener noreferrer">' + esc(x.title.slice(0, 90)) + "</a>" : esc(x.title.slice(0, 90))) + "</span><span class=\"muted\">" + Math.round(x.days) + " ngày</span></div>"; }).join("");
      var sk = N.skipped; news += '<p class="nv-note">' + (N.n ? N.n + " tin trực tiếp đúng mã " + esc(sym) : esc(N.note)) + (sk.wrongFloor || sk.related || sk.notSym ? " · đã loại " + (sk.notSym + sk.related + sk.wrongFloor) + " tin không đúng mã/sàn" : "") + ". Cực tính theo từ khóa, có thể sai.</p>";
    } else news = '<p class="nv-note">' + esc(N.reason || "") + "</p>";
    var warn = r.flags.length ? '<p class="nv-warn">⚠ ' + esc(r.flags.join(" · ")) + "</p>" : "";
    return '<section class="nv-card nv-plus"><div class="eyebrow">ĐIỂM CỘNG · CƠ BẢN + TIN · SÀN ' + LABEL[ex.key].toUpperCase() + '</div><div class="nv-big"><b class="' + (r.total ? "up" : "") + '">' + r.total + '<small class="nv-of">/100</small></b><span>' + esc(r.band) + "<br><small>" + esc(head) + "</small></span></div>" +
      stats(3, [stat("Nền (đã kiểm chứng)", r.base, ""), stat("+ Cơ bản", F.ready ? "+" + nf(F.bonus, 1) + "<em> /10</em>" : "—", F.ready && F.bonus ? "up" : ""), stat("+ Tin", N.ready ? "+" + nf(N.bonus, 0) + "<em> /5</em>" : "—", N.ready && N.bonus ? "up" : "")]) + warn +
      (pend ? '<p class="nv-note">Đang nạp ' + (r.pending.fund ? "chỉ số cơ bản" : "tin") + "… điểm cộng sẽ cập nhật khi xong.</p>" : "") +
      '<div class="eyebrow" style="margin-top:10px">Cơ bản (tối đa +10)</div>' + fund + '<div class="eyebrow" style="margin-top:10px">Tin (tối đa +5)</div>' + news +
      '<details data-k="plus"><summary>Điểm cộng được tính thế nào?</summary><ul class="nv-ul"><li><b>Thứ tự:</b> ① nạp chỉ số cơ bản → ② nạp tin theo mã → ③ mới tính điểm.</li><li><b>Nền</b> là Điểm tham gia đã kiểm chứng ở trên, không bị thay đổi.</li><li><b>Điều kiện:</b> điểm cộng chỉ áp dụng khi nền &gt; 0; nền = 0 thì cơ bản/tin tốt không kéo điểm lên. Tổng không vượt 100.</li><li><b>Cơ bản (≤ +10):</b> P/E 3, P/B 2, ROE 3, ROA 2 điểm; đạt ngưỡng “tốt” của đúng sàn được đủ điểm, “chấp nhận” được nửa. Mã lỗ (EPS/P/E ≤ 0) → 0 và cờ đỏ. Thiếu dữ liệu (&lt; 3/5 chỉ tiêu) → không chấm, không bị coi là xấu.</li><li><b>Tin (≤ +5):</b> chỉ tin nhắc trực tiếp đúng mã, đúng sàn trong 30 ngày (bỏ tin chung của sàn, tin mã khác, tin gắn sàn khác, tin trùng); tin mới trọng số lớn hơn. Tin xấu → 0 và cờ đỏ. Không có tin = trung tính.</li><li><b>Chưa kiểm chứng:</b> khác với RSIx/Fade2, ngưỡng cơ bản và tin là điểm khởi đầu, chưa đo ngoài mẫu. Không phải xác suất hay khuyến nghị đầu tư.</li></ul></details></section>';
  }

  /* ---------- dựng trang ---------- */
  function pageHTML() {
    var sym = String(ST.sym || "").toUpperCase();
    if (IDXRE.test(sym)) return '<div class="nv-head"><div class="nv-ht"><div class="eyebrow">BẰNG CHỨNG · ' + esc(sym) + '</div></div></div><p class="nv-txt muted">Đây là mã chỉ số. Các công cụ được kiểm chứng trên cổ phiếu HOSE/HNX/UPCoM nên không áp dụng cho chỉ số.</p>';
    var V = ST.V = view(), ex = ST.ex;
    if (!V.ready) return '<div class="nv-head"><div class="nv-ht"><div class="eyebrow">BẰNG CHỨNG · ' + esc(sym) + '</div></div></div><p class="nv-txt muted">' + esc(V.reason) + "</p>";
    return headHTML(V, ex) + verdictHTML(V, ex) + plusHTML(V, ex) + scorersHTML(V) + metricsHTML(ex) + extrasHTML(V, ex) + replayHTML(V, ex) + rejectedHTML(ex) + notesHTML(ex) + fundHTML();
  }
  function view() {
    var c = ST.candles || [], l = c[c.length - 1] || {}, now = VS.vnNow();
    return VS.view([ST.sym, c.length, l.time, l.close, l.high, l.low, now.date, now.hour < 15 ? 0 : 1].join("|"), c);
  }
  var CSS = "#nhip-evpro{font-size:13px;line-height:1.45;box-sizing:border-box;max-width:100%;overflow-x:hidden;padding-bottom:calc(120px + env(safe-area-inset-bottom,0px));overflow-wrap:anywhere;word-break:normal}" +
    "#nhip-evpro *{box-sizing:border-box;min-width:0;max-width:100%}#nhip-evpro .up{color:var(--up,#14c29a)}#nhip-evpro .dn{color:var(--dn,#e5484d)}#nhip-evpro .muted{opacity:.65}" +
    "#nhip-evpro .eyebrow{white-space:normal;line-height:1.3;letter-spacing:.06em}" +
    "#nhip-evpro .nv-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:8px}#nhip-evpro .nv-ht{flex:1 1 auto}#nhip-evpro .nv-sub{font-size:12px;opacity:.65;margin-top:2px}" +
    "#nhip-evpro .nv-ex{flex:none;font-size:12px;font-weight:800;padding:4px 12px;border-radius:999px;border:1.5px solid currentColor;white-space:nowrap}#nhip-evpro .nv-ex-HOSE{color:#2f6fed}#nhip-evpro .nv-ex-HNX{color:#d97706}#nhip-evpro .nv-ex-UPCOM{color:#7c3aed}#nhip-evpro .nv-ex-none{opacity:.6}" +
    "#nhip-evpro .nv-sec{margin:18px 0 0}#nhip-evpro .nv-sec>.eyebrow{margin:0 0 6px}" +
    "#nhip-evpro .nv-card{border:1px solid rgba(127,127,127,.3);border-radius:12px;padding:12px;background:rgba(127,127,127,.06);margin-top:10px}" +
    "#nhip-evpro .nv-big{display:flex;align-items:center;gap:12px;margin:6px 0 8px}#nhip-evpro .nv-big>b{font-size:36px;line-height:1;font-weight:800;flex:none}#nhip-evpro .nv-big span{font-size:12px;opacity:.85}#nhip-evpro .nv-big small{font-size:13px;font-weight:700;opacity:1}#nhip-evpro .nv-big>b .nv-of{font-size:14px;font-weight:600;opacity:.55;margin-left:2px}" +
    "#nhip-evpro .nv-seg{display:flex;gap:3px}#nhip-evpro .nv-seg i{height:8px;border-radius:4px;background:rgba(127,127,127,.28)}#nhip-evpro .nv-seg i.on{background:var(--up,#14c29a)}#nhip-evpro .nv-seg i.f.on{background:#2f6fed}" +
    "#nhip-evpro .nv-segl{display:grid;grid-template-columns:1fr 1fr;gap:4px 8px;font-size:11.5px;opacity:.85;margin-top:6px}#nhip-evpro .nv-segl .f{opacity:.9}" +
    "#nhip-evpro .nv-new{margin-top:8px;font-weight:700;font-size:12.5px}" +
    "#nhip-evpro .nv-tool{border:1px solid rgba(127,127,127,.3);border-radius:12px;padding:10px 12px;margin-top:8px;background:rgba(127,127,127,.04)}" +
    "#nhip-evpro .nv-trow{display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px}#nhip-evpro .nv-trow>b{font-size:14px}#nhip-evpro .nv-def{flex:1 1 90px;font-size:11.5px;opacity:.65}#nhip-evpro .nv-trow .sg{flex:none;margin-left:auto}" +
    "#nhip-evpro .nv-st{display:grid;grid-template-columns:repeat(var(--c,3),minmax(0,1fr));gap:6px;margin-top:8px}#nhip-evpro .nv-st>div{background:rgba(127,127,127,.1);border-radius:8px;padding:6px 7px}" +
    "#nhip-evpro .nv-st small{display:block;font-size:10.5px;line-height:1.2;opacity:.65}#nhip-evpro .nv-st b{display:block;font-size:14px;line-height:1.25;margin-top:2px}#nhip-evpro .nv-st b em{font-style:normal;font-size:10.5px;font-weight:600;opacity:.7}#nhip-evpro .nv-st b.role,#nhip-evpro .nv-st b.muted{font-size:11.5px;font-weight:700}" +
    "#nhip-evpro .nv-gauge{margin:10px 2px 0}#nhip-evpro .nv-track{position:relative;height:10px;border-radius:5px;background:rgba(127,127,127,.22)}" +
    "#nhip-evpro .nv-z{position:absolute;top:0;bottom:0}#nhip-evpro .nv-z.buy{background:var(--up,#14c29a);opacity:.35;border-radius:5px 0 0 5px}#nhip-evpro .nv-z.sell{background:var(--dn,#e5484d);opacity:.35;border-radius:0 5px 5px 0}" +
    "#nhip-evpro .nv-tk{position:absolute;top:-3px;bottom:-3px;width:2px;margin-left:-1px;background:currentColor;opacity:.55}" +
    "#nhip-evpro .nv-dot{position:absolute;top:50%;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;background:#2f6fed;border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.35)}" +
    "#nhip-evpro .nv-glab{position:relative;height:30px;margin-top:6px;font-size:10.5px;line-height:1.25}#nhip-evpro .nv-glab span{position:absolute;transform:translateX(-50%);text-align:center;white-space:nowrap;opacity:.8}" +
    "#nhip-evpro .nv-txt{margin:8px 0 0;font-size:12.5px}#nhip-evpro .nv-note{margin:6px 0 0;font-size:11.5px;opacity:.7}#nhip-evpro .nv-cap{margin:0 0 4px;font-size:11.5px;opacity:.7}" +
    "#nhip-evpro .nv-warn{margin:8px 0 0;padding:6px 10px;border-radius:8px;font-size:12px;background:rgba(217,164,0,.14);border:1px solid rgba(217,164,0,.4)}" +
    "#nhip-evpro .nv-bar{display:block;height:4px;border-radius:2px;background:rgba(127,127,127,.22);margin-top:8px}#nhip-evpro .nv-bar u{display:block;height:100%;border-radius:2px;background:var(--up,#14c29a);text-decoration:none}" +
    "#nhip-evpro details{margin-top:10px}#nhip-evpro summary{cursor:pointer;font-size:12.5px;font-weight:600;opacity:.9;line-height:1.35}#nhip-evpro .nv-fold{border:1px solid rgba(127,127,127,.3);border-radius:12px;padding:10px 12px}" +
    "#nhip-evpro .nv-ul{margin:8px 0 0;padding-left:18px;font-size:12px}#nhip-evpro .nv-ul li{margin:5px 0}" +
    "#nhip-evpro .nv-logs{margin-top:6px;font-size:12px}#nhip-evpro .nv-log{display:flex;justify-content:space-between;gap:8px;padding:3px 0;border-top:1px solid rgba(127,127,127,.15)}" +
    "@media (max-width:380px){#nhip-evpro .nv-st[style*='--c:4']{grid-template-columns:repeat(2,minmax(0,1fr))}}";
  function ensureStyle() {
    if (!D) return;
    var s = D.getElementById("nhip-ev-style");
    if (!s) { s = D.createElement("style"); s.id = "nhip-ev-style"; (D.head || D.documentElement).appendChild(s); }
    s.textContent = CSS;
  }

  function paint() {
    var box = $("#nhip-evpro"); if (!box) return;
    Array.prototype.forEach.call(box.querySelectorAll("details[data-k]"), function (d) { OPEN[d.getAttribute("data-k")] = d.open; });
    box.innerHTML = pageHTML();
    Array.prototype.forEach.call(box.querySelectorAll("details[data-k]"), function (d) { if (OPEN[d.getAttribute("data-k")]) d.open = true; });
    wire();
  }
  function wire() {
    ensurePlus();
  }
  function mount(ev, S, d) {
    if (!NS || !VS || !ev || !d || !Array.isArray(d.candles)) return;
    var sym = String(S && S.sym || d.symbol || "").toUpperCase();
    ST.sym = sym; ST.candles = d.candles; ST.ex = detectExchange(sym, S, d);
    ensureStyle();
    if (!ev.querySelector("#nhip-evpro")) ev.insertAdjacentHTML("afterbegin", '<div id="nhip-evpro" class="an-structure nhip-evpro"></div>');
    paint();
  }

  W.NHIPEvidenceUI = {
    version: "4.1", mount: mount, _state: function () { return ST; },
    _html: function (st) { ST = st || ST; if (!ST.ex) ST.ex = detectExchange(String(ST.sym || "").toUpperCase(), null, null); return pageHTML(); },
    _t: { analyze: VS.analyze, replay: VS.replay, mix: VS.mix, detectExchange: detectExchange, EXCH: VS.EXCH, FULL: VS.FULL, EXTRA: VS.EXTRA, PARAMS: VS.PARAMS, COST: VS.COST, setNow: VS._t.setNow, reset: function () { ST = {}; VS._t.reset(); } }
  };
})(window, typeof document !== "undefined" ? document : null);
