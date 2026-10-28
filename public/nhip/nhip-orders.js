/* NHIP · Lệnh chờ (v1.70, thiết kế lại v1.73 theo sàn HOSE/HNX/UPCoM) — chờ mua · take profit · stop loss cho CỔ PHIẾU cơ sở (không phải phái sinh).
   v1.73: chọn sàn; lệnh chờ mua đặt được cả DƯỚI giá (mua khi giá giảm về) lẫn TRÊN giá (mua khi giá tăng lên), phải trong [sàn, trần]; gắn TP/SL vào lệnh chờ mua (hiệu lực sau khi mua khớp).
   Quy tắc áp dụng (HOSE / HNX / UPCoM):
   - Chỉ có vị thế MUA (long). Không bán khống: TP/SL chỉ đặt trên cổ phiếu ĐANG GIỮ; tổng KL TP ≤ KL đang giữ, tổng KL SL ≤ KL đang giữ.
     (TP và SL là hai lối thoát cho cùng số cổ phiếu, nên mỗi nhóm được so riêng với số đang giữ.)
   - Chờ mua: giá đặt THẤP hơn giá hiện tại (mua khi giá giảm về). Take profit: giá CAO hơn giá hiện tại. Stop loss: giá THẤP hơn giá hiện tại.
   - Bước giá: HOSE <10.000đ → 10đ · 10.000–49.950đ → 50đ · ≥50.000đ → 100đ. HNX, UPCoM: 100đ.
   - Biên độ/ngày so với giá tham chiếu: HOSE ±7% · HNX ±10% · UPCoM ±15% (ngày đầu niêm yết/ngày GDKHQ có biên độ khác — ứng dụng không biết các ngày này).
   - Khối lượng: lô chẵn là bội số của 100; 1–99 cp là lô lẻ (khớp riêng); tối đa 500.000 cp/lệnh.
   - Cổ phiếu mới mua chỉ bán được từ chiều ngày T+2 (13h) — TP/SL cho phần chưa về tài khoản được cảnh báo.
   Đây là SỔ LỆNH CHỜ TRONG ỨNG DỤNG: không gửi lệnh lên công ty chứng khoán. Khi giá chạm mức đặt, lệnh hiện "Đã chạm giá"
   và có nút "Ghi khớp" (mở phiếu lệnh điền sẵn) — không tự ghi giao dịch. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root);
  else root.NHIPOrders = factory(root);
})(typeof self !== "undefined" ? self : this, function (W) {
  "use strict";

  var KINDS = { buy: "Chờ mua", tp: "Take profit", sl: "Stop loss" };
  var BAND = { HOSE: 7, HNX: 10, UPCOM: 15 }, MAX_QTY = 500000, MAX_ORDERS = 200;
  var nf = function (v, d) { return v == null || !isFinite(v) ? "—" : Number(v).toLocaleString("vi-VN", { maximumFractionDigits: d || 0 }); };

  /* ---------- Quy tắc sàn (hàm thuần) ---------- */
  function normEx(e) { e = String(e || "").toUpperCase().replace(/[^A-Z]/g, ""); return e === "HNX" ? "HNX" : (e === "UPCOM" || e === "UPCOM") ? "UPCOM" : "HOSE"; }
  function tickSize(price, exch) { var p = +price || 0; if (normEx(exch) !== "HOSE") return 100; return p < 10000 ? 10 : p < 50000 ? 50 : 100; }
  /* dir: -1 làm tròn xuống, +1 lên, 0 gần nhất */
  function snap(price, exch, dir) {
    var p = +price || 0; if (!(p > 0)) return 0; var t = tickSize(p, exch), q = p / t;
    var r = dir < 0 ? Math.floor(q + 1e-9) : dir > 0 ? Math.ceil(q - 1e-9) : Math.round(q), v = r * t;
    var t2 = tickSize(v, exch); if (t2 !== t) { q = p / t2; r = dir < 0 ? Math.floor(q + 1e-9) : dir > 0 ? Math.ceil(q - 1e-9) : Math.round(q); v = r * t2; }
    return Math.max(t2, v);
  }
  function onTick(price, exch) { var p = +price; return p > 0 && p === Math.floor(p) && p % tickSize(p, exch) === 0; }
  function step(price, exch, n) { var p = +price || 0, t = tickSize(n < 0 ? p - 1 : p, exch); return Math.max(tickSize(1, exch), snap(p + n * t, exch, 0)); }
  /* Trần làm tròn xuống, sàn làm tròn lên theo bước giá */
  function band(ref, exch) { ref = +ref; if (!(ref > 0)) return null; var b = BAND[normEx(exch)] / 100; return { ce: snap(ref * (1 + b), exch, -1), fl: snap(ref * (1 - b), exch, 1) }; }

  /* ---------- Ngày giờ Việt Nam, T+2 ---------- */
  function vnDate(now) { return new Date((now || new Date()).getTime() + 7 * 3600e3).toISOString().slice(0, 10); }
  function vnHour(now) { return ((now || new Date()).getUTCHours() + 7) % 24; }
  function addBiz(ds, n) { var d = new Date(ds + "T00:00:00Z"); while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d = new Date(d.getTime() + 864e5); for (var i = 0; i < n; i++) { d = new Date(d.getTime() + 864e5); while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d = new Date(d.getTime() + 864e5); } return d.toISOString().slice(0, 10); }
  /* Số cp bán được ngay: cp mua trong 2 phiên gần nhất (chưa tới chiều T+2) chưa về tài khoản. Chưa tính ngày lễ. */
  function sellable(p, sym, now) {
    var pos = p && p.positions ? p.positions.filter(function (x) { return x.symbol === sym; })[0] : null, held = pos ? +pos.qty || 0 : 0;
    var today = vnDate(now), hr = vnHour(now), un = 0, items = [];
    ((p && p.tx) || []).forEach(function (t) {
      if (t.type !== "buy" || t.symbol !== sym || !/^\d{4}-\d{2}-\d{2}$/.test(t.date || "")) return;
      var av = addBiz(t.date, 2), ok = today > av || (today === av && hr >= 13);
      if (!ok) { un += +t.qty || 0; items.push({ qty: +t.qty || 0, date: t.date, avail: av }); }
    });
    un = Math.min(held, un);
    return { held: held, sellable: Math.max(0, held - un), unsettled: un, items: items };
  }

  /* ---------- Loại lệnh, lô, sàn đang chọn (v1.73) ---------- */
  var TYPES = { HOSE: ["LO", "ATO", "ATC", "MP"], HNX: ["LO", "ATC", "MTL", "MOK", "MAK", "PLO"], UPCOM: ["LO"] };
  var TYPE_TIP = { LO: "Giới hạn: khớp đúng giá đặt hoặc tốt hơn", ATO: "Khớp tại giá mở cửa", ATC: "Khớp tại giá đóng cửa", MP: "Thị trường: khớp ngay theo giá tốt nhất", MTL: "Thị trường giới hạn: phần chưa khớp chuyển thành LO", MOK: "Khớp toàn bộ ngay hoặc hủy", MAK: "Khớp một phần ngay, phần còn lại hủy", PLO: "Giới hạn sau giờ: khớp ở giá đóng cửa sau phiên ATC" };
  function typesFor(ex) { return TYPES[normEx(ex)].slice(); }
  var EXK = "nhip.trade.exch";
  function exMap() { try { return JSON.parse(W.localStorage.getItem(EXK) || "{}") || {}; } catch (e) { return {}; } }
  /* Sàn áp dụng cho mã: khách chọn tay (nếu có) → ngược lại theo danh bạ mã (fb) */
  /* v1.73.2 — NGUỒN SÀN DUY NHẤT: danh bạ mã NHIPSYM (bản nhúng + danh sách VNDirect, trường floor H/N/U).
     /api/symbols và /api/overview KHÔNG có trường sàn nên trước đây mọi mã bị coi là HOSE. dirEx trả "" nếu chưa biết sàn của mã. */
  function dirEx(sym) {
    try { var e = W.NHIPSYM && W.NHIPSYM.info ? W.NHIPSYM.info(String(sym || "").toUpperCase()) : null; var f = e && e.floor ? String(e.floor).toUpperCase().replace(/[^A-Z]/g, "") : ""; return f === "HNX" ? "HNX" : f === "UPCOM" ? "UPCOM" : (f === "HOSE" || f === "HSX") ? "HOSE" : ""; } catch (x) { return ""; }
  }
  /* Sàn theo danh bạ: danh bạ → dòng API (nếu có exchange/floor) → HOSE (tạm, khi chưa biết). row: phần tử /api/symbols (tùy chọn) */
  function baseExch(sym, row) { return dirEx(sym) || (row && (row.exchange || row.floor) ? normEx(row.exchange || row.floor) : "HOSE"); }
  /* Sàn đang áp dụng = khách chọn tay (nếu có) → sàn theo danh bạ */
  function effEx(sym, row) { return getExch(sym, baseExch(sym, row)); }
  /* Nạp danh sách mã niêm yết (có sàn) từ VNDirect một lần (tối đa ~3,5 giây). Nơi gọi tự so sánh sàn trước/sau và phát nhip:exch-changed nếu đổi */
  var _dirP = null;
  function dirReady() {
    if (_dirP) return _dirP; if (!(W.NHIPSYM && W.NHIPSYM.ready)) return (_dirP = Promise.resolve(false));
    _dirP = Promise.resolve(W.NHIPSYM.ready()).catch(function () { return false; });
    return _dirP;
  }
  function getExch(sym, fb) { var d = dirEx(sym); if (d) return d; /* v1.73.4: mã đã có trong danh bạ thì sàn là CỐ ĐỊNH, không cho ghi đè theo từng mã */ var v = exMap()[String(sym || "").toUpperCase()]; return v ? normEx(v) : normEx(fb); }
  function setExch(sym, ex) {
    var k = String(sym || "").toUpperCase();
    try { var m = exMap(); if (!ex) delete m[k]; else m[k] = normEx(ex); W.localStorage.setItem(EXK, JSON.stringify(m)); } catch (e) { }
    try { W.dispatchEvent(new CustomEvent("nhip:exch-changed", { detail: { sym: k } })); } catch (e) { }
  }
  /* Lô: HOSE/HNX lô chẵn là bội số của 100, 1–99 cp là lô lẻ (khớp riêng). UPCoM giao dịch từ 1 cp, không bắt buộc lô 100. */
  function lotCheck(q, ex) {
    ex = normEx(ex); var r = {};
    if (ex === "UPCOM") { if (q > 100000) r.warn = "UPCoM thường giới hạn 100.000 cp/lệnh — kiểm tra lại với công ty chứng khoán"; return r; }
    if (q > 99 && q % 100 !== 0) r.err = "Sàn " + ex + ": từ 100 cp trở lên phải chẵn lô (bội số 100). Phần lẻ 1–99 cp đặt thành lệnh riêng";
    else if (q < 100) r.warn = "Lô lẻ (1–99 cp) khớp riêng với lô lẻ khác, thanh khoản thấp";
    return r;
  }


  /* ---------- v1.73.3 · Nhãn SÀN hiển thị thống nhất (lệnh chờ · biểu đồ · thông tin mã · danh sách) ---------- */
  function exName(ex) { ex = normEx(ex); return ex === "UPCOM" ? "UPCoM" : ex; }
  /* Sàn của mã đã được xác định chắc chắn chưa (khách chọn tay hoặc có trong danh bạ mã) */
  function exKnown(sym) { var k = String(sym || "").toUpperCase(); return !!(dirEx(k) || exMap()[k]); }
  function exText(sym, row) { var e = effEx(sym, row); return exName(e) + (exKnown(sym) || (row && (row.exchange || row.floor)) ? "" : "?"); }
  function escA(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  /* HTML nhãn sàn nhỏ cạnh mã. Chưa biết sàn → "HOSE?" (nét đứt) + giải thích khi chạm/di chuột */
  function exTag(sym, row) {
    var e = effEx(sym, row), known = exKnown(sym) || !!(row && (row.exchange || row.floor)), nm = exName(e);
    return '<em class="ex-tag ex-' + e + (known ? "" : " unk") + '" data-ex="' + e + '" title="' + escA(known ? "Mã " + String(sym || "").toUpperCase() + " giao dịch trên sàn " + nm : "Chưa xác định được sàn của mã này — đang tạm tính HOSE. Hãy chọn đúng sàn ở tab Đặt lệnh") + '">' + nm + (known ? "" : "?") + "</em>";
  }

  /* ---------- Kiểm tra lệnh chờ ---------- */
  /* o:{kind,sym,price,qty,tp?,sl?,id?}  c:{exch,last,ref,heldQty,others:[{kind,qty,price}],cash,cost,sellableQty,feePct}
     Trả {errors, warns, infos}. Lệnh CHỜ MUA: được đặt DƯỚI hoặc TRÊN giá hiện tại (dưới = mua khi giá giảm về, trên = mua khi giá tăng lên);
     bắt buộc nằm trong biên độ hôm nay [sàn, trần] và đúng bước giá. Có thể gắn TP/SL: chỉ hiệu lực SAU KHI lệnh mua khớp. */
  function validate(o, c) {
    c = c || {}; var E = [], Wn = [], In = [], kind = o.kind, px = +o.price, q = +o.qty, ex = normEx(c.exch), last = +c.last > 0 ? +c.last : 0, held = +c.heldQty || 0;
    var others = (c.others || []).filter(function (x) { return x.kind === kind; }), bd = +c.ref > 0 ? band(+c.ref, ex) : null;
    var rng = bd ? nf(bd.fl) + "–" + nf(bd.ce) + ", ±" + BAND[ex] + "%" : "";
    if (!KINDS[kind]) E.push("Loại lệnh không hợp lệ");
    if (!(px > 0) || px !== Math.floor(px)) E.push("Giá phải là số nguyên đồng lớn hơn 0");
    else if (!onTick(px, ex)) { var t = tickSize(px, ex); E.push("Giá phải là bội số của bước giá " + nf(t) + "đ (" + ex + ") — gần nhất " + nf(snap(px, ex, -1)) + " hoặc " + nf(snap(px, ex, 1))); }
    if (!(q >= 1) || q !== Math.floor(q)) E.push("Khối lượng phải là số nguyên từ 1 cổ phiếu");
    else {
      if (q > MAX_QTY) E.push("Tối đa " + nf(MAX_QTY) + " cp/lệnh");
      var lc = lotCheck(q, ex); if (lc.err) E.push(lc.err); if (lc.warn) Wn.push(lc.warn);
    }
    if (px > 0 && bd && (px > bd.ce || px < bd.fl)) {
      if (kind === "buy") E.push("Giá chờ mua phải nằm trong biên độ hôm nay của " + ex + " (" + rng + ") — sàn không nhận giá ngoài khoảng này");
      else Wn.push("Ngoài biên độ hôm nay (" + rng + "): chỉ khớp được khi giá về trong biên độ của các phiên sau");
    } else if (kind === "buy" && px > 0 && !bd) Wn.push("Chưa có giá tham chiếu nên chưa kiểm tra biên độ sàn/trần");
    if (px > 0 && last > 0 && KINDS[kind]) {
      var sp = (px / last - 1) * 100, spt = (sp > 0 ? "+" : "") + nf(sp, 2) + "% so với giá hiện tại " + nf(last);
      if (kind === "buy") {
        if (px === last) In.push("Bằng giá hiện tại " + nf(last) + " — lệnh kích hoạt ngay. Muốn khớp tức thì hãy dùng lệnh thường");
        else if (px > last) In.push("Mua khi giá TĂNG lên ≥ " + nf(px) + " (" + spt + "): lệnh chờ giá vượt lên mức này, không khớp ngay");
        else In.push("Mua khi giá GIẢM về ≤ " + nf(px) + " (" + spt + ")");
      }
      if (kind === "tp" && px <= last) E.push("Take profit phải CAO hơn giá hiện tại " + nf(last) + ". Muốn bán ngay hãy dùng lệnh thường");
      if (kind === "sl" && px >= last) E.push("Stop loss phải THẤP hơn giá hiện tại " + nf(last) + " (đã giữ cổ phiếu, thị trường cơ sở không bán khống)");
    } else if (KINDS[kind] && !(last > 0)) Wn.push("Chưa có giá hiện tại nên chưa kiểm tra chiều giá");
    if (kind === "buy") { /* TP/SL gắn kèm lệnh mua: tính theo GIÁ MUA, chỉ hiệu lực sau khi mua khớp */
      var hasv = function (v) { return v != null && v !== "" && +v !== 0; }, any = false;
      [["tp", o.tp, "Take profit"], ["sl", o.sl, "Stop loss"]].forEach(function (a) {
        if (!hasv(a[1])) return; any = true; var v = +a[1];
        if (!(v > 0) || v !== Math.floor(v)) { E.push(a[2] + " sau khi mua phải là số nguyên đồng lớn hơn 0"); return; }
        if (!onTick(v, ex)) E.push(a[2] + " sau khi mua phải là bội số của bước giá " + nf(tickSize(v, ex)) + "đ (" + ex + ") — gần nhất " + nf(snap(v, ex, -1)) + " hoặc " + nf(snap(v, ex, 1)));
        if (px > 0 && a[0] === "tp" && v <= px) E.push("Take profit sau khi mua phải CAO hơn giá mua " + nf(px));
        if (px > 0 && a[0] === "sl" && v >= px) E.push("Stop loss sau khi mua phải THẤP hơn giá mua " + nf(px));
        if (bd && (v > bd.ce || v < bd.fl)) Wn.push(a[2] + " " + nf(v) + " nằm ngoài biên độ hôm nay (" + rng + ") — hợp lệ vì chỉ kích hoạt ở phiên sau, hãy kiểm tra lại");
      });
      if (any) In.push("TP/SL chỉ có hiệu lực SAU KHI lệnh mua khớp. Cổ phiếu mới mua chỉ bán được từ chiều T+2 nên TP/SL chưa thể thực thi trước đó.");
    }
    if (kind === "tp" || kind === "sl") {
      if (!(held > 0)) E.push("Chưa giữ " + (o.sym || "mã này") + ": không thể đặt " + KINDS[kind] + " (thị trường cổ phiếu không bán khống)");
      else if (q >= 1) {
        var tot = others.reduce(function (a, x) { return a + (+x.qty || 0); }, 0) + q;
        if (tot > held) E.push("Tổng KL " + KINDS[kind] + " (" + nf(tot) + ") vượt số đang giữ (" + nf(held) + " cp)");
        else if (c.sellableQty != null && q > c.sellableQty) Wn.push("Chỉ " + nf(c.sellableQty) + " cp đã về tài khoản; phần còn lại bán được từ chiều T+2");
      }
      if (kind === "tp" && c.cost > 0 && px > 0 && px < c.cost) Wn.push("Take profit thấp hơn giá vốn " + nf(c.cost) + " — chốt ở mức LỖ so với vốn");
    }
    if (kind === "buy" && px > 0 && q >= 1 && c.cash != null) {
      var need = (c.pendingBuyValue || 0) + px * q * (1 + (isFinite(c.feePct) ? c.feePct : 0.15) / 100);
      if (need > c.cash) Wn.push("Tổng giá trị các lệnh chờ mua (" + nf(need) + " ₫) vượt tiền mặt danh mục (" + nf(c.cash) + " ₫)");
    }
    if (others.some(function (x) { return +x.price === px; }) && px > 0) Wn.push("Đã có lệnh " + KINDS[kind] + " cùng mức giá này");
    return { errors: E, warns: Wn, infos: In };
  }
  /* Lệnh THƯỜNG (ghi sổ khớp lệnh): o:{side,otype,price,qty}  c:{exch,last,ref,sellable}
     LO phải đúng bước giá; mọi loại phải nằm trong [sàn, trần]; loại lệnh theo từng sàn; lô theo sàn; bán không vượt số đã về tài khoản (T+2). */
  function checkNow(o, c) {
    c = c || {}; var E = [], Wn = [], In = [], ex = normEx(c.exch), px = +o.price, q = +o.qty, ot = o.otype || "LO", last = +c.last > 0 ? +c.last : 0, bd = +c.ref > 0 ? band(+c.ref, ex) : null;
    if (TYPES[ex].indexOf(ot) < 0) E.push("Sàn " + ex + " không có lệnh " + ot + " — các loại lệnh của sàn: " + TYPES[ex].join(", "));
    if (px > 0) {
      if (ot === "LO" && px === Math.floor(px) && !onTick(px, ex)) E.push("Giá phải là bội số của bước giá " + nf(tickSize(px, ex)) + "đ (" + ex + ") — gần nhất " + nf(snap(px, ex, -1)) + " hoặc " + nf(snap(px, ex, 1)));
      if (bd && (px > bd.ce || px < bd.fl)) E.push("Giá " + nf(px) + " nằm ngoài biên độ hôm nay của " + ex + " (" + nf(bd.fl) + "–" + nf(bd.ce) + ", ±" + BAND[ex] + "%) — sàn sẽ từ chối");
      else if (!bd) Wn.push("Chưa có giá tham chiếu nên chưa kiểm tra biên độ sàn/trần");
      if (ot === "LO" && last > 0 && o.side === "buy" && px > last) In.push("Lệnh mua giá cao hơn giá bán tốt nhất sẽ khớp ngay tại giá bán đó, có thể thấp hơn giá đặt — hãy ghi giá khớp thực tế");
      if (ot === "LO" && last > 0 && o.side === "sell" && px < last) In.push("Lệnh bán giá thấp hơn giá mua tốt nhất sẽ khớp ngay tại giá mua đó, có thể cao hơn giá đặt — hãy ghi giá khớp thực tế");
    }
    if (q >= 1 && q === Math.floor(q)) {
      if (q > MAX_QTY) E.push("Tối đa " + nf(MAX_QTY) + " cp/lệnh");
      var lc = lotCheck(q, ex); if (lc.err) E.push(lc.err); if (lc.warn) Wn.push(lc.warn);
      if (o.side === "sell" && c.sellable != null && q > c.sellable) E.push("Chỉ bán được " + nf(c.sellable) + " cp (phần còn lại mới mua, chưa về tài khoản — bán được từ chiều T+2)");
    }
    return { errors: E, warns: Wn, infos: In };
  }
  /* Ngữ cảnh kiểm tra lấy từ danh mục p */
  function ctxFor(p, o, quote) {
    quote = quote || {}; var pos = p.positions.filter(function (x) { return x.symbol === o.sym; })[0], sl = sellable(p, o.sym);
    var all = (p.orders || []).filter(function (x) { return x.id !== o.id; });
    return { exch: quote.exch, last: quote.last, ref: quote.ref, heldQty: pos ? pos.qty : 0, cost: pos ? pos.cost : 0, sellableQty: pos ? sl.sellable : null,
      others: all.filter(function (x) { return x.sym === o.sym; }), cash: p.cash,
      pendingBuyValue: all.filter(function (x) { return x.kind === "buy"; }).reduce(function (a, x) { return a + x.price * x.qty; }, 0), feePct: quote.feePct };
  }

  /* ---------- Phát hiện đã chạm giá ---------- */
  /* candles: [{time(giây), low, high}] cùng đơn vị giá với lệnh (đồng). Chỉ xét phiên SAU ngày đặt lệnh + giá hiện tại. */
  /* OHLC ngày chỉ cho biết biên độ, không chứng minh thứ tự chạm hay khớp lệnh.
     Nếu nến cùng ngày tạo lệnh, đánh dấu chưa xác định; giá hiện tại vượt ngưỡng chỉ là quan sát. */
  function hit(o, last, candles) {
    if (!o || !KINDS[o.kind]) return null;
    var up = o.kind === "tp" || (o.kind === "buy" && o.dir === "up");
    var cond = function (lo, hi) { return up ? hi >= +o.price : o.kind === "buy" || o.kind === "sl" ? lo <= +o.price : false; };
    var cs = candles || [], createdDay = o.created || "", today = vnDate();
    for (var i = 0; i < cs.length; i++) {
      var tm = +cs[i].time; if (!isFinite(tm)) continue;
      var d = vnDate(new Date(tm > 1e12 ? tm : tm * 1000));
      if (!cond(+cs[i].low, +cs[i].high) || (createdDay && d < createdDay)) continue;
      if (createdDay && d === createdDay) return { date: d, px: up ? +cs[i].high : +cs[i].low, uncertain: true, source: "daily_ohlc", status: "uncertain" };
      return { date: d, px: up ? +cs[i].high : +cs[i].low, uncertain: false, source: "daily_ohlc", status: "observed_touch" };
    }
    if (last > 0 && cond(last, last)) return { date: today, px: last, uncertain: false, source: "last_price", status: "price_beyond" };
    return null;
  }
  /* Sau khi ghi giao dịch: bỏ lệnh đã khớp, thu hẹp TP/SL theo số còn giữ (không để KL lệnh vượt số giữ) */
  /* v2.10 — TP/SL THẬT sinh ra từ lệnh chờ mua đã khớp mang dấu NHÓM GỐC (grp = id lệnh mua, gc = mã A/B…, gi = màu, gpx = giá mua) để luôn ở đúng nhóm,
     không bị gộp/chuyển sang nhóm khác. Khi bán bớt, phần vượt số đang giữ được cắt theo FIFO: nhóm mua CŨ bán trước → cắt TP/SL của nhóm cũ trước, giữ lại nhóm mới; TP/SL không thuộc nhóm nào (đặt tay) coi là cũ nhất.
     Bán hết (số giữ = 0) → xóa toàn bộ TP/SL của mã. */
  function reconcile(p, sym, removeId) {
    if (!p.orders) return; if (removeId) p.orders = p.orders.filter(function (x) { return x.id !== removeId; });
    var pos = p.positions.filter(function (x) { return x.symbol === sym; })[0], held = pos ? pos.qty : 0;
    ["tp", "sl"].forEach(function (k) {
      var left = held, gOrd = {}, list = [];
      p.orders.forEach(function (x, i) { if (x.sym === sym && x.kind === k) { list.push(x); if (x.grp) { var g = gOrd[x.grp] || (gOrd[x.grp] = { c: "", i: -1 }); if ((x.created || "") > g.c) g.c = x.created || ""; g.i = i; } } });
      list.sort(function (a, b) {
        var ga = a.grp || "", gb = b.grp || ""; if (!ga !== !gb) return ga ? -1 : 1; /* nhóm mới trước, đặt tay (cũ nhất) sau */
        if (ga !== gb) { var A = gOrd[ga], B = gOrd[gb]; return A.c !== B.c ? (A.c < B.c ? 1 : -1) : B.i - A.i; }
        return k === "tp" ? a.price - b.price : b.price - a.price;
      });
      list.forEach(function (x) { if (left <= 0) { x.qty = 0; return; } if (x.qty > left) x.qty = left; left -= x.qty; });
    });
    p.orders = p.orders.filter(function (x) { return x.qty > 0; });
  }
  /* Ghi cố định mã nhóm lên các lệnh chờ mua của mã sy còn thiếu (lệnh cũ trước v2.11) */
  function stampBuys(p, sy) {
    if (!p || !Array.isArray(p.orders)) return; var G = groups(p.orders, sy);
    p.orders.forEach(function (o) { if (o && o.sym === sy && o.kind === "buy" && !o.gc && G[o.id]) { o.gc = G[o.id].code; o.gi = G[o.id].idx % GCOL.length; } });
  }
  /* Dọn toàn bộ TP/SL của danh mục (gọi trước mỗi lần lưu): mã đã bán hết → xóa TP/SL; KL vượt số giữ → thu hẹp theo FIFO */
  function sweep(p) {
    if (!p || !Array.isArray(p.orders) || !p.orders.length) return; var syms = {}, bs = {};
    p.orders.forEach(function (o) { if (o && o.kind === "buy" && !o.gc) bs[o.sym] = 1; }); /* v2.11: lệnh chờ mua cũ chưa có mã nhóm → ghi cố định mã hiện tại */
    Object.keys(bs).forEach(function (sy) { stampBuys(p, sy); });
    p.orders.forEach(function (o) { if (o && (o.kind === "tp" || o.kind === "sl")) syms[o.sym] = 1; });
    Object.keys(syms).forEach(function (s) { reconcile(p, s); });
  }
  /* Sau khi MUA khớp: sinh TP/SL thật (kind tp/sl) từ mức đã gắn kèm lệnh chờ mua, cho đúng KL vừa khớp, GẮN NHÓM GỐC của lệnh mua.
     Chỉ gộp với TP/SL cùng nhóm gốc + cùng giá (khớp nhiều đợt); KHÔNG gộp với TP/SL của nhóm khác dù trùng giá. */
  function spawnExits(p, o, qty, uid, day) {
    if (!o || o.kind !== "buy" || !(qty > 0)) return 0; p.orders = p.orders || []; stampBuys(p, o.sym); var n = 0; day = /^\d{4}-\d{2}-\d{2}$/.test(day || "") ? day : vnDate();
    var gg = groups(p.orders, o.sym)[o.id] || null;
    [["tp", +o.tp], ["sl", +o.sl]].forEach(function (a) {
      if (!(a[1] > 0)) return;
      var same = p.orders.filter(function (x) { return x.sym === o.sym && x.kind === a[0] && x.price === a[1] && x.grp === o.id; })[0];
      if (same) { same.qty += qty; n++; return; }
      if (p.orders.length >= MAX_ORDERS) return;
      var r = { id: uid(), sym: o.sym, kind: a[0], price: a[1], qty: qty, created: day, grp: o.id, gc: gg ? gg.code : "", gi: gg ? gg.idx % GCOL.length : 0, gpx: Math.round(o.price) }; if (o.ex) r.ex = o.ex; p.orders.push(r); n++;
    });
    return n;
  }
  /* ---------- v2.11 · TỰ KHỚP khi giá biểu đồ cập nhật ---------- */
  /* Chạm giá ĐỦ CHẮC để tự ghi: (a) nến ngày SAU ngày đặt lệnh có biên độ chạm mức giá, hoặc (b) giá hiện tại đã vượt mức.
     Nến CÙNG ngày đặt lệnh (không biết thứ tự trong ngày) → không tự ghi, chỉ khi giá hiện tại vượt mức. */
  function autoHit(o, last, candles) {
    var h = hit(o, last, candles); if (h && !h.uncertain) return h;
    var h2 = hit(o, last, null); return h2 && !h2.uncertain ? h2 : null;
  }
  function holdsCash(p) { return !!p && (p.cash > 0 || (p.tx || []).some(function (t) { return t.type === "dep"; })); }
  /* Tự khớp mọi lệnh của MỘT mã đã chạm giá, trên danh mục p (sửa trực tiếp p; người gọi lưu).
     c: { last, candles, apply(p, tx):"" | lỗi (= pfApply), uid, feePct=0.15, taxPct=0.1, now }
     1) Lệnh chờ mua chạm giá → ghi MUA (giá đặt) → lệnh chờ biến mất → TP/SL sau mua thành TP/SL thật của đúng nhóm (Giữ A…).
        Không đủ tiền mặt (danh mục có dùng tiền mặt) → KHÔNG tự ghi, giữ nguyên lệnh (vẫn có nút Ghi khớp).
     2) TP/SL thật chạm giá → ghi BÁN (giá đặt) tối đa bằng số đã về tài khoản (T+2). Phần chưa bán được vì T+2 giữ lại, khớp ở lần sau.
        Lệnh có nhóm: phần vừa bán trừ vào lệnh đối ứng (TP↔SL) CÙNG nhóm trước; phần dư theo FIFO (reconcile). Bán hết → xóa toàn bộ TP/SL của mã.
        Cùng ngày cả TP lẫn SL đều chạm → coi SL khớp trước (thận trọng).
     Trả { fills:[{side,kind,sym,qty,price,date,code,src}], skips:[{id,kind,reason,...}] } */
  function autoFill(p, sym, c) {
    c = c || {}; var res = { fills: [], skips: [] }; sym = String(sym || "").toUpperCase();
    if (!p || !Array.isArray(p.orders) || typeof c.apply !== "function" || !sym) return res; p.tx = p.tx || [];
    var last = +c.last > 0 ? +c.last : 0, cs = c.candles || null, fp = isFinite(c.feePct) && c.feePct >= 0 ? c.feePct : 0.15, tx = isFinite(c.taxPct) && c.taxPct >= 0 ? c.taxPct : 0.1, now = c.now || new Date();
    var uid = c.uid || function () { return "a" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); };
    /* 1) lệnh chờ mua đã chạm giá (cũ trước) */
    var buys = p.orders.filter(function (o) { return o.sym === sym && o.kind === "buy"; }).map(function (o) { return { o: o, h: autoHit(o, last, cs) }; }).filter(function (x) { return x.h; });
    buys.sort(function (a, b) { return a.h.date < b.h.date ? -1 : a.h.date > b.h.date ? 1 : 0; });
    buys.forEach(function (x) {
      var o = x.o; if (p.orders.indexOf(o) < 0) return;
      var qty = o.qty, px = o.price, value = qty * px, fee = Math.round(value * fp / 100), cash = holdsCash(p);
      if (cash && p.cash < value + fee) { res.skips.push({ id: o.id, kind: "buy", sym: sym, reason: "cash", need: value + fee, have: p.cash }); return; }
      var gg = groups(p.orders, sym)[o.id], code = gg ? gg.code : "";
      var m = c.apply(p, { type: "buy", symbol: sym, qty: qty, price: px, fee: fee, date: x.h.date, note: ("Tự khớp chờ mua " + code + " @ giá đặt").slice(0, 80), cash: cash, src: "chart" });
      if (m) { res.skips.push({ id: o.id, kind: "buy", sym: sym, reason: "apply", msg: m }); return; }
      spawnExits(p, o, qty, uid, x.h.date); reconcile(p, sym, o.id);
      res.fills.push({ side: "buy", kind: "buy", sym: sym, qty: qty, price: px, date: x.h.date, code: code, src: x.h.source });
    });
    /* 2) TP/SL thật đã chạm giá (theo ngày; cùng ngày SL trước TP) */
    var ex = p.orders.filter(function (o) { return o.sym === sym && (o.kind === "tp" || o.kind === "sl"); }).map(function (o) { return { o: o, h: autoHit(o, last, cs) }; }).filter(function (x) { return x.h; });
    ex.sort(function (a, b) { return a.h.date !== b.h.date ? (a.h.date < b.h.date ? -1 : 1) : (a.o.kind === b.o.kind ? 0 : a.o.kind === "sl" ? -1 : 1); });
    ex.forEach(function (x) {
      var o = x.o; if (p.orders.indexOf(o) < 0) return;
      var pos = p.positions.filter(function (y) { return y.symbol === sym; })[0]; if (!pos || !(pos.qty > 0)) return;
      var sb = sellable(p, sym, now).sellable, q = Math.min(o.qty, pos.qty, sb);
      if (!(q > 0)) { res.skips.push({ id: o.id, kind: o.kind, sym: sym, reason: "t2", held: pos.qty }); return; }
      var value = q * o.price, fee = Math.round(value * (fp + tx) / 100), gg = exitGroup(o);
      var m = c.apply(p, { type: "sell", symbol: sym, qty: q, price: o.price, fee: fee, date: x.h.date, note: ("Tự khớp " + KINDS[o.kind] + (o.gc ? " nhóm " + o.gc : "") + " @ giá đặt").slice(0, 80), cash: holdsCash(p), src: "chart" });
      if (m) { res.skips.push({ id: o.id, kind: o.kind, sym: sym, reason: "apply", msg: m }); return; }
      o.qty -= q; var rest = q;
      if (o.grp) p.orders.forEach(function (y) { if (rest > 0 && y !== o && y.sym === sym && y.grp === o.grp && y.kind !== o.kind) { var cut = Math.min(y.qty, rest); y.qty -= cut; rest -= cut; } });
      reconcile(p, sym);
      res.fills.push({ side: "sell", kind: o.kind, sym: sym, qty: q, price: o.price, date: x.h.date, code: o.grp ? gg.code : "Giữ", src: x.h.source });
    });
    return res;
  }
  var EXS = ["HOSE", "HNX", "UPCOM"];
  function clean(a) {
    return (Array.isArray(a) ? a : []).slice(0, MAX_ORDERS).map(function (o) {
      var r = { id: String(o && o.id || "").replace(/[^a-z0-9]/gi, "").slice(0, 20), sym: String(o && o.sym || "").trim().toUpperCase(), kind: KINDS[o && o.kind] ? o.kind : "", price: Math.round(+o.price) || 0, qty: Math.floor(+o.qty) || 0, created: /^\d{4}-\d{2}-\d{2}$/.test(o && o.created) ? o.created : "" };
      var ex = String(o && o.ex || "").toUpperCase(); if (EXS.indexOf(ex) >= 0) r.ex = ex;
      if (r.kind !== "buy" && o && o.grp) { var gp = String(o.grp).replace(/[^a-z0-9]/gi, "").slice(0, 20); if (gp) { r.grp = gp; var gcc = String(o.gc || "").replace(/[^A-Z0-9]/g, "").slice(0, 3); if (gcc) r.gc = gcc; var gii = Math.floor(+o.gi); if (gii >= 0 && gii < 8) r.gi = gii; var gpp = Math.round(+o.gpx) || 0; if (gpp > 0) r.gpx = gpp; } }
      if (r.kind === "buy") {
        if (o.dir === "up" || o.dir === "dn") r.dir = o.dir;
        var bgc = String(o.gc || "").replace(/[^A-Z0-9]/g, "").slice(0, 3); if (bgc) { r.gc = bgc; var bgi = Math.floor(+o.gi); if (bgi >= 0 && bgi < 8) r.gi = bgi; }
        var tp = Math.round(+o.tp) || 0, sl = Math.round(+o.sl) || 0; if (tp > 0) r.tp = tp; if (sl > 0) r.sl = sl;
      }
      return r;
    }).filter(function (o) { return o.id && /^[A-Z0-9.]{2,12}$/.test(o.sym) && o.kind && o.price > 0 && o.qty > 0 && o.qty <= MAX_QTY; });
  }

  /* v2.10 — NHẬN DIỆN LỆNH: mỗi lệnh CHỜ MUA của một mã có mã nhóm (A, B, C…) + màu riêng; TP/SL gắn kèm lệnh đó mang cùng mã/màu.
     TP/SL của phần ĐANG GIỮ dùng nhóm "Giữ" (vàng, cùng màu đường Giá vốn). Mã nhóm theo thứ tự đặt lệnh (cũ → mới) trong cùng một mã. */
  var GCOL = ["#2f7bd9", "#8b5cf6", "#f97316", "#0e9bb5", "#d6409f", "#6d8f1a", "#5b6ee1", "#b8571f"], HOLD_COL = "#c88a12";
  function codeOf(i) { return String.fromCharCode(65 + i % 26) + (i >= 26 ? Math.floor(i / 26) + 1 : ""); }
  /* v2.11 — MÃ NHÓM ỔN ĐỊNH: mã (gc) + màu (gi) được GHI LÊN lệnh chờ mua ngay khi tạo (hoặc khi lưu lần đầu với lệnh cũ) và không đổi nữa.
     Nhờ vậy khi lệnh A khớp/xóa, lệnh B vẫn là B (trước đây B bị đổi thành A → trùng với "Giữ A" của phần đã khớp, trông như TP/SL nhảy nhóm).
     Lệnh chưa có mã: lấy chữ cái nhỏ nhất chưa bị lệnh chờ mua hoặc TP/SL thật của cùng mã dùng. */
  function groups(orders, sym) {
    var m = {}, used = {}, s = String(sym || "").toUpperCase(), n = 0;
    (orders || []).forEach(function (o) { if (o && o.gc && String(o.sym || "").toUpperCase() === s && (o.kind === "buy" || o.grp)) used[o.gc] = 1; });
    (orders || []).forEach(function (o) {
      if (!o || o.kind !== "buy" || String(o.sym || "").toUpperCase() !== s) return;
      var code, idx;
      if (o.gc) { code = o.gc; idx = o.gi >= 0 && o.gi < 8 ? +o.gi : 0; }
      else { while (used[codeOf(n)]) n++; code = codeOf(n); used[code] = 1; idx = n % GCOL.length; n++; }
      m[o.id] = { code: code, color: GCOL[idx % GCOL.length], idx: idx, key: o.id };
    });
    return m;
  }
  /* Nhóm kế tiếp còn trống của một mã (dùng khi tạo lệnh chờ mua mới) */
  function freeGroup(orders, sym) {
    var s = String(sym || "").toUpperCase(), used = {}, G = groups(orders, s);
    Object.keys(G).forEach(function (k) { used[G[k].code] = 1; });
    (orders || []).forEach(function (o) { if (o && o.gc && String(o.sym || "").toUpperCase() === s) used[o.gc] = 1; });
    var n = 0; while (used[codeOf(n)]) n++;
    return { gc: codeOf(n), gi: n % GCOL.length };
  }
  function holdGroup() { return { code: "Giữ", color: HOLD_COL, hold: true, key: "hold" }; }
  /* Nhóm của một TP/SL thật: có dấu nhóm gốc → "Giữ A" (phần đã khớp từ lệnh chờ mua A) + màu cũ; không có → "Giữ" chung */
  function exitGroup(o) {
    if (o && o.grp) return { code: "Giữ " + (o.gc || ""), color: GCOL[(+o.gi || 0) % GCOL.length], hold: true, lot: true, key: "g:" + o.grp, grp: o.grp, gc: o.gc || "", gi: +o.gi || 0, gpx: +o.gpx || 0, tip: "Phần đã khớp từ lệnh chờ mua " + (o.gc || "") + (o.gpx ? " @ " + nf(o.gpx) : "") };
    return holdGroup();
  }
  function chip(g, tip) { return g ? '<i class="od-chip" style="--gc:' + g.color + '" title="' + escA(tip || g.tip || (g.hold ? "Thuộc phần cổ phiếu ĐANG GIỮ" : "Thuộc lệnh chờ mua nhóm " + g.code)) + '">' + escA(g.code) + "</i>" : ""; }

  var api = { KINDS: KINDS, BAND: BAND, MAX_QTY: MAX_QTY, MAX_ORDERS: MAX_ORDERS, TYPES: TYPES, TYPE_TIP: TYPE_TIP, typesFor: typesFor, getExch: getExch, setExch: setExch, lotCheck: lotCheck, checkNow: checkNow, spawnExits: spawnExits, normEx: normEx, dirEx: dirEx, baseExch: baseExch, effEx: effEx, dirReady: dirReady, requestEx: requestEx, exName: exName, exKnown: exKnown, exText: exText, exTag: exTag, tickSize: tickSize, snap: snap, onTick: onTick, step: step, band: band, vnDate: vnDate, addBiz: addBiz, sellable: sellable, validate: validate, ctxFor: ctxFor, hit: hit, reconcile: reconcile, clean: clean, groups: groups, holdGroup: holdGroup, exitGroup: exitGroup, sweep: sweep, freeGroup: freeGroup, autoHit: autoHit, autoFill: autoFill, chip: chip, GCOL: GCOL, HOLD_COL: HOLD_COL };
  if (typeof document === "undefined") return api;

  /* ---------- Kho lưu (trong danh mục đang chọn ở phiếu lệnh) ---------- */
  var g = function (n) { return W.NHIPPF ? W.NHIPPF[n] : undefined; };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var toast = function (m, e) { try { g("toast")(m, e); } catch (x) { } };
  function sel() { try { return JSON.parse(localStorage.getItem("nhip.trade.v1") || "{}") || {}; } catch (e) { return {}; } }
  function cur() { /* v2.47: chưa lưu/chọn danh mục ở phiếu lệnh (mở trang mới, đổi sàn) → dùng danh mục đang chọn ở mục Danh mục (PF2.active), giống phiếu lệnh tự nhận (adopt) */
    var x = g("PF2"), s = sel(); if (!x || !x.list) return null;
    return x.list.filter(function (p) { return p.id === s.pid; })[0] || x.list.filter(function (p) { return p.id === x.active; })[0] || null;
  }
  function notify() { try { W.dispatchEvent(new CustomEvent("nhip:orders-changed")); } catch (e) { } }
  async function ensure() { if (!g("PF2") && g("pfLoad")) { try { await g("pfLoad")(); } catch (e) { } } return cur(); }
  function listFor(sym) { var p = cur(); return p ? (p.orders || []).filter(function (o) { return !sym || o.sym === sym; }) : []; }
  /* mutate: nạp bản mới nhất → áp thay đổi → lưu. Trả {ok, err} */
  async function mutate(fn) {
    try { await g("pfLoad")(); } catch (e) { return { ok: false, err: "Không tải được danh mục" }; }
    var p = cur(); if (!p) return { ok: false, err: "Chọn khách hàng và danh mục trong phiếu lệnh trước" };
    p.orders = Array.isArray(p.orders) ? p.orders : []; var m = fn(p); if (m) return { ok: false, err: m };
    var ok = await g("pfSave")(); if (ok) notify(); return { ok: ok, err: ok ? "" : "Không lưu được" };
  }
  async function add(o, quote) {
    return mutate(function (p) {
      if (p.orders.length >= MAX_ORDERS) return "Tối đa " + MAX_ORDERS + " lệnh chờ mỗi danh mục";
      var r = validate(o, ctxFor(p, o, quote)); if (r.errors.length) return r.errors[0];
      var last = +(quote && quote.last) || 0, rec = { id: g("uid")(), sym: o.sym, kind: o.kind, price: Math.round(o.price), qty: Math.floor(o.qty), created: vnDate(), ex: normEx(quote && quote.exch) };
      if (o.kind === "buy") { var fg = freeGroup(p.orders, o.sym); rec.gc = fg.gc; rec.gi = fg.gi; rec.dir = last > 0 && rec.price > last ? "up" : "dn"; if (+o.tp > 0) rec.tp = Math.round(o.tp); if (+o.sl > 0) rec.sl = Math.round(o.sl); }
      else if (o.grp) { var gp = String(o.grp).replace(/[^a-z0-9]/gi, "").slice(0, 20); if (gp) { rec.grp = gp; rec.gc = String(o.gc || "").replace(/[^A-Z0-9]/g, "").slice(0, 3); rec.gi = Math.max(0, Math.min(7, Math.floor(+o.gi) || 0)); if (+o.gpx > 0) rec.gpx = Math.round(o.gpx); } }
      p.orders.push(rec);
    });
  }
  /* patch: {price?, qty?, tp?, sl?} — tp/sl = 0 nghĩa là gỡ mức TP/SL gắn kèm lệnh chờ mua */
  async function update(id, patch, quote) {
    return mutate(function (p) {
      var x = p.orders.filter(function (y) { return y.id === id; })[0]; if (!x) return "Lệnh không còn tồn tại";
      var qt = { last: quote && quote.last, ref: quote && quote.ref, exch: (quote && quote.exch) || x.ex, feePct: quote && quote.feePct };
      var n = { id: id, sym: x.sym, kind: x.kind, price: patch.price != null ? patch.price : x.price, qty: patch.qty != null ? patch.qty : x.qty };
      if (x.kind === "buy") { n.tp = patch.tp != null ? patch.tp : x.tp; n.sl = patch.sl != null ? patch.sl : x.sl; }
      var r = validate(n, ctxFor(p, n, qt)); if (r.errors.length) return r.errors[0];
      x.price = Math.round(n.price); x.qty = Math.floor(n.qty);
      if (x.kind === "buy") { if (+n.tp > 0) x.tp = Math.round(n.tp); else delete x.tp; if (+n.sl > 0) x.sl = Math.round(n.sl); else delete x.sl; if (patch.price != null) { var last = +(quote && quote.last) || 0; x.dir = last > 0 && x.price > last ? "up" : "dn"; } }
      if (qt.exch) x.ex = normEx(qt.exch);
      if (patch.price != null) x.created = vnDate(); /* dời giá = lệnh mới: chỉ tính chạm giá từ phiên sau */
    });
  }
  async function remove(id) { return mutate(function (p) { p.orders = p.orders.filter(function (y) { return y.id !== id; }); }); }

  /* v1.73.4 — Chuyển SÀN: mỗi sàn là một không gian riêng (mã, biểu đồ, lệnh chờ, thông tin). Mã có trong danh bạ thì sàn cố định → trang Giao dịch
     bắt sự kiện nhip:ex-switch và chuyển sang mã của sàn được chọn. Mã chưa có trong danh bạ thì cho khách gán sàn tay (lưu theo mã). */
  function requestEx(sym, ex) {
    var k = String(sym || "").toUpperCase(); ex = normEx(ex); if (effEx(k) === ex) return;
    if (!dirEx(k)) { setExch(k, ex); return; }
    var d = { ex: ex, sym: k, handled: false };
    try { W.dispatchEvent(new CustomEvent("nhip:ex-switch", { detail: d })); } catch (e) { }
    if (!d.handled) toast(k + " niêm yết trên " + exName(dirEx(k)) + " — hãy chọn một mã của sàn " + exName(ex) + " để giao dịch trên sàn đó", 1);
  }
  /* ---------- Chọn sàn + quy tắc sàn (dùng chung ở phiếu lệnh thường và lệnh chờ) ---------- */
  function exSelHtml(s, fb) {
    var cur = getExch(s, fb), auto = normEx(fb), ov = exMap()[String(s).toUpperCase()], nm = function (k) { return k === "UPCOM" ? "UPCoM" : k; };
    return '<div class="od-ex" role="group" aria-label="Chọn sàn giao dịch"><span class="od-ex-l">Sàn</span>' + EXS.map(function (k) {
      return '<button type="button" data-od-ex="' + k + '" data-od-sym="' + esc(s) + '" class="' + (cur === k ? "on" : "") + '" aria-pressed="' + (cur === k) + '">' + nm(k) + "</button>";
    }).join("") + "<small>" + (dirEx(s) ? esc(String(s).toUpperCase()) + " niêm yết trên " + nm(dirEx(s)) + " · bấm sàn khác để chuyển sang mã của sàn đó" : (ov ? "Chọn tay: tính theo quy tắc sàn " + nm(ov) + " (mã chưa có trong danh bạ)" : "Chưa xác định được sàn của mã này (tạm tính HOSE) — hãy chọn đúng sàn")) + "</small></div>";
  }
  function rulesHtml(ref, last, ex) {
    ex = normEx(ex); var bd = +ref > 0 ? band(+ref, ex) : null, nm = ex === "UPCOM" ? "UPCoM" : ex;
    return '<p class="od-rules"><b>' + nm + "</b> · biên độ ±" + BAND[ex] + "%" + (bd ? " · Sàn <b>" + nf(bd.fl) + "</b> · TC <b>" + nf(ref) + "</b> · Trần <b>" + nf(bd.ce) + "</b>" : " · chưa có giá tham chiếu") + " · bước giá " + nf(tickSize(last || ref || 50000, ex)) + "đ · " + (ex === "UPCOM" ? "mua/bán từ 1 cp" : "lô chẵn 100 cp, lô lẻ 1–99 cp khớp riêng") + "</p>";
  }
  if (!W.__nhipExBound && typeof document.addEventListener === "function") { W.__nhipExBound = 1; document.addEventListener("click", function (e) { var b = e.target.closest && e.target.closest("[data-od-ex]"); if (!b) return; e.preventDefault(); requestEx(b.getAttribute("data-od-sym"), b.getAttribute("data-od-ex")); }); }

  /* ---------- Bảng lệnh chờ (dùng ở tab Lệnh chờ và trong phiếu lệnh) ----------
     opts: { symbol():mã đang xem, quote(sym):{last,ref}|null, exch(sym):sàn theo danh bạ mã, candles(sym):[...]|null, symbolOnly:bool, showEx:false nếu nơi gọi đã tự hiện ô chọn sàn, onPick(sym), onFill(order) } */
  function mountTable(el, opts) {
    var dead = false, F = { kind: "buy", price: "", qty: "", touched: false, tp: "", sl: "" }, busy = false;
    var sym = function () { return String(opts.symbol() || "").toUpperCase(); };
    var baseEx = function (s) { return opts.exch ? opts.exch(s) : "HOSE"; };
    var q = function (s) { var x = opts.quote && opts.quote(s) || {}; return { last: x.last > 0 ? x.last : null, ref: x.ref, exch: getExch(s, baseEx(s)) }; };
    var rq = function (o) { return q(o.sym); }; /* sàn hiện hành của mã (danh bạ / khách chọn tay), không dùng ảnh chụp lúc đặt vì có thể đã ghi nhầm HOSE */
    var num = function (v) { var n = g("pnum") ? g("pnum")(v) : parseFloat(String(v).replace(/\./g, "").replace(",", ".")); return isNaN(n) ? 0 : n; };
    var dc = function (v) { return v > 0 ? "up" : v < 0 ? "dn" : ""; };
    function clampBuy(px, Q) { var bd = Q.ref > 0 ? band(Q.ref, Q.exch) : null; return bd ? Math.min(bd.ce, Math.max(bd.fl, px)) : px; }
    function defPrice(kind, s) {
      var Q = q(s); if (!Q.last) return ""; var f = kind === "buy" ? 0.97 : kind === "tp" ? 1.07 : 0.95, v = snap(Q.last * f, Q.exch, kind === "tp" ? 1 : -1);
      return String(kind === "buy" ? clampBuy(v, Q) : v);
    }
    function entryNow() { return F.kind === "buy" ? num(F.touched ? F.price : defPrice("buy", sym())) : 0; }
    function exitDef(k) { var e = entryNow(); return e ? snap(e * (k === "tp" ? 1.07 : 0.95), q(sym()).exch, k === "tp" ? 1 : -1) : 0; }
    function holdHtml(p, s) {
      var pos = p.positions.filter(function (x) { return x.symbol === s; })[0], Q = q(s), sl = sellable(p, s);
      if (!pos) return '<div class="od-hold"><b>Chưa giữ ' + esc(s) + "</b><span>Chỉ đặt được lệnh chờ mua (có thể gắn sẵn TP/SL cho sau khi mua khớp). TP/SL riêng lẻ cần đang giữ cổ phiếu.</span></div>";
      var pl = Q.last ? (Q.last - pos.cost) * pos.qty : null, pp = Q.last && pos.cost > 0 ? (Q.last / pos.cost - 1) * 100 : null;
      return '<div class="od-hold"><div><span>Đang giữ ' + esc(s) + "</span><b>" + nf(pos.qty) + " cp</b></div><div><span>Giá vốn BQ</span><b>" + nf(pos.cost) + "</b></div><div><span>Giá hiện tại</span><b>" + (Q.last ? nf(Q.last) : "—") + "</b></div><div><span>Lãi/lỗ tạm tính</span><b class=\"" + dc(pl) + '">' + (pl == null ? "—" : (pl > 0 ? "+" : "") + nf(pl) + (pp != null ? " (" + (pp > 0 ? "+" : "") + nf(pp, 2) + "%)" : "")) + "</b></div><div><span>Bán được ngay</span><b>" + nf(sl.sellable) + " cp</b></div>" +
        (sl.unsettled ? '<p class="od-note">' + nf(sl.unsettled) + " cp mới mua chưa về tài khoản (bán được từ chiều T+2).</p>" : "") + "</div>";
    }
    function addHtml(p, s) {
      var Q = q(s), price = F.touched ? F.price : defPrice(F.kind, s), buy = F.kind === "buy", o = { kind: F.kind, sym: s, price: num(price), qty: num(F.qty) };
      if (buy) { o.tp = num(F.tp); o.sl = num(F.sl); }
      var r = validate(o, ctxFor(p, o, Q)), errs = o.qty > 0 ? r.errors : r.errors.filter(function (e) { return !/Khối lượng/.test(e); });
      var msgs = errs.map(function (m) { return '<p class="od-msg err">' + esc(m) + "</p>"; }).concat(r.warns.map(function (m) { return '<p class="od-msg warn">' + esc(m) + "</p>"; }), (r.infos || []).map(function (m) { return '<p class="od-msg info">' + esc(m) + "</p>"; })).join("");
      var ready = !r.errors.length && o.qty > 0 && o.price > 0;
      var pcts = buy ? [-5, -3, -1, 0, 1, 3, 5] : F.kind === "tp" ? [3, 5, 7, 10] : [-3, -5, -7, -10];
      var bdq = Q.ref > 0 ? band(Q.ref, Q.exch) : null, pAttr = Q.last ? ' data-rkind="price" data-rmin="' + (bdq ? bdq.fl : Math.round(Q.last * 0.9)) + '" data-rmax="' + (bdq ? bdq.ce : Math.round(Q.last * 1.1)) + '" data-rstep="' + tickSize(Q.last, Q.exch) + '" data-rex="' + Q.exch + '"' : "";
      var posq = p.positions.filter(function (x) { return x.symbol === s; })[0], qMax = buy ? Math.max(3000, Math.ceil(o.qty / 1000) * 1000) : (posq ? posq.qty : 0), qAttr = qMax > 0 ? ' data-rkind="qty" data-rmin="0" data-rmax="' + qMax + '" data-rstep="100"' : "";
      var pchips = Q.last ? '<div class="od-chips od-pc nx-seg"' + pAttr + ' role="group" aria-label="So với giá hiện tại" title="So với giá hiện tại">' + pcts.map(function (x) { return '<button type="button" data-od-pct="' + x + '">' + (x === 0 ? "Giá HT" : (x > 0 ? "+" : "−") + Math.abs(x) + "%") + "</button>"; }).join("") + "</div>" : "";
      var exit = "", est = "";
      if (buy && !opts.noBuyExit) { /* v2.8: TP/SL gắn ngay trong phiếu chờ mua — cùng kiểu ô [−][số][+] + thanh chọn nhanh dưới ô, không khung viền riêng */
        var fld = function (k, lab, ph, bar) { return '<div class="od-fg od-fx"><label><span>' + lab + '</span><div class="od-st"><button type="button" data-od-step="-1" data-od-for="' + k + '" aria-label="Giảm một bước giá">−</button><input class="od-in" data-od-f="' + k + '" inputmode="numeric" placeholder="' + ph + '" value="' + esc(+F[k] ? nf(+F[k]) : "") + '"><button type="button" data-od-step="1" data-od-for="' + k + '" aria-label="Tăng một bước giá">+</button></div></label>' + bar + '</div>'; };
        var xbar = function (k, arr, lab) { return '<div class="od-chips od-xc nx-seg" data-rkind="price" data-rref="[data-od-f=price]" data-rlo="' + (k === "tp" ? 0 : -25) + '" data-rhi="' + (k === "tp" ? 25 : 0) + '" data-rstep="' + tickSize(Q.last || Q.ref || o.price, Q.exch) + '" data-rex="' + Q.exch + '" data-rempty="' + (k === "tp" ? "min" : "max") + '" role="group" aria-label="' + lab + '">' + arr.map(function (x) { return '<button type="button" class="' + (k === "tp" ? "up" : "dn") + '" data-od-xp="' + k + ":" + (k === "tp" ? "" : "-") + x + '">' + (k === "tp" ? "+" : "−") + x + "%</button>"; }).join("") + "</div>"; };
        exit = fld("tp", "Take profit (₫)", "Tùy chọn · cao hơn giá mua", xbar("tp", [5, 7, 10, 15], "Take profit so với giá mua")) + fld("sl", "Stop loss (₫)", "Tùy chọn · thấp hơn giá mua", xbar("sl", [3, 5, 7, 10], "Stop loss so với giá mua"));
        if (o.price > 0 && o.qty > 0 && (o.tp > o.price || (o.sl > 0 && o.sl < o.price))) {
          var inn = o.price * o.qty * 1.0015, net = function (x) { return x * o.qty * (1 - 0.0015 - 0.001) - inn; };
          est = '<div class="od-est">' + (o.tp > o.price ? "<span>Chốt lời ≈ <b class=\"up\">+" + nf(net(o.tp)) + " ₫</b></span>" : "") + (o.sl > 0 && o.sl < o.price ? "<span>Cắt lỗ ≈ <b class=\"dn\">" + nf(net(o.sl)) + " ₫</b></span>" : "") + "<small>đã trừ phí 0,15%/chiều và thuế bán 0,1%</small></div>";
        }
      }
      var ex0 = baseEx(s);
      return '<div class="od-add" data-od="add">' + (opts.showEx === false ? "" : (opts.noExUi ? "" : exSelHtml(s, ex0)) + rulesHtml(Q.ref, Q.last, Q.exch)) + '<div class="od-kinds" role="group" aria-label="Loại lệnh chờ">' + ["buy", "tp", "sl"].map(function (k) { return '<button type="button" data-od-kind="' + k + '" class="od-k-' + k + (F.kind === k ? " on" : "") + '">' + KINDS[k] + "</button>"; }).join("") + "</div>" +
        '<div class="od-fields"><div class="od-fg"><label><span>' + (buy ? "Giá chờ mua (₫)" : "Giá đặt (₫)") + '</span><div class="od-st"><button type="button" data-od-step="-1" aria-label="Giảm một bước giá">−</button><input class="od-in" data-od-f="price" inputmode="numeric" value="' + esc(nf(+price || 0)) + '"><button type="button" data-od-step="1" aria-label="Tăng một bước giá">+</button></div></label>' + pchips + '</div>' +
        '<div class="od-fg"><label><span>Khối lượng (cp)</span><div class="od-st"><button type="button" data-od-qs="-100" aria-label="Giảm 100">−</button><input class="od-in" data-od-f="qty" inputmode="numeric" placeholder="100" value="' + esc(F.qty) + '"><button type="button" data-od-qs="100" aria-label="Tăng 100">+</button></div></label>' + '<div class="od-chips od-qc nx-seg"' + qAttr + ' role="group" aria-label="Chọn nhanh khối lượng">' + (buy ? [100, 200, 500, 1000].map(function (n) { return '<button type="button" data-od-q="' + n + '">' + nf(n) + "</button>"; }).join("") : [["25%", 0.25], ["50%", 0.5], ["Tất cả", 1]].map(function (x) { return '<button type="button" data-od-qp="' + x[1] + '">' + x[0] + "</button>"; }).join("")) + "</div>" + '</div>' + exit + '</div>' +
        '<div class="od-dyn">' + est + msgs + '<button type="button" class="od-go" data-od="go" ' + (ready && !busy ? "" : "disabled") + ">Đặt " + KINDS[F.kind].toLowerCase() + " · " + esc(s) + "</button></div></div>";
    }
    function rowHtml(p, o) {
      var Q = rq(o), last = Q.last, diff = last ? (o.price / last - 1) * 100 : null, cs = opts.candles && o.sym === sym() ? opts.candles(o.sym) : null, h = hit(o, last, cs);
      var pos = p.positions.filter(function (x) { return x.symbol === o.sym; })[0], held = pos ? pos.qty : 0, over = o.kind !== "buy" && o.qty > held;
      var GG = groups(p.orders, o.sym), gch = chip(o.kind === "buy" ? GG[o.id] : exitGroup(o));
      var wait = o.kind === "buy" ? '<span class="od-dirb ' + (o.dir === "up" ? "up" : "dn") + '">' + (o.dir === "up" ? "▲ khi giá tăng" : "▼ khi giá giảm") + "</span>" : "Đang chờ";
      var badTick = !onTick(o.price, Q.exch) ? '<small class="od-over" title="Giá đặt không khớp bước giá của sàn ' + exName(Q.exch) + '">sai bước giá ' + exName(Q.exch) + "</small>" : "";
      var st = (h ? '<b class="od-hit">Đã chạm giá</b>' + (h.date !== vnDate() ? "<small>" + esc(h.date) + "</small>" : "") : over ? '<b class="od-over" title="Số đang giữ đã giảm: sửa hoặc xóa lệnh">KL vượt số giữ (' + nf(held) + ")</b>" : wait) + badTick;
      var act = h ? '<button type="button" class="od-fill" data-od-fill="' + o.id + '">Ghi khớp</button>' : "";
      var main = '<tr class="od-r' + (o.sym === sym() ? " cur" : "") + (h ? " is-hit" : "") + '" data-oid="' + o.id + '"><td>' + (opts.symbolOnly ? "" : '<span class="od-symc">' + gch + '<button type="button" class="od-sym" data-od-pick="' + esc(o.sym) + '">' + esc(o.sym) + "</button>" + exTag(o.sym) + "</span>") + '</td><td><input class="od-in sm" data-od-e="qty" inputmode="numeric" value="' + nf(o.qty) + '" aria-label="Khối lượng"></td><td><input class="od-in" data-od-e="price" inputmode="numeric" value="' + nf(o.price) + '" aria-label="Giá đặt"></td><td class="' + (diff == null ? "" : dc(diff)) + '">' + (diff == null ? "—" : (diff > 0 ? "+" : "") + nf(diff, 1) + "%") + "</td><td>" + st + '</td><td class="od-ta">' + act + '<button type="button" class="od-del" data-od-del="' + o.id + '" aria-label="Xóa lệnh">✕</button></td></tr>';
      if (o.kind !== "buy" || (opts.noBuyExit && !(o.tp > 0 || o.sl > 0))) return main; /* lệnh cũ đã có TP/SL vẫn cho sửa/gỡ */
      return main + '<tr class="od-sub" data-oid="' + o.id + '"><td></td><td colspan="5"><div class="od-subc" title="TP/SL chỉ có hiệu lực sau khi lệnh chờ mua khớp (giá chạm ' + nf(o.price) + ')">' + chip(GG[o.id]) + '<span class="od-subl">TP/SL sau khi mua khớp @ ' + nf(o.price) + '</span><label>TP <input class="od-in sm" data-od-e="tp" inputmode="numeric" placeholder="—" value="' + (o.tp ? nf(o.tp) : "") + '" aria-label="Take profit sau khi mua"></label><label>SL <input class="od-in sm" data-od-e="sl" inputmode="numeric" placeholder="—" value="' + (o.sl ? nf(o.sl) : "") + '" aria-label="Stop loss sau khi mua"></label></div></td></tr>';
    }
    function tableHtml(p) {
      var s = sym(), all0 = (p.orders || []).filter(function (o) { return !opts.symbolOnly || o.sym === s; }), all = all0, xbar = "", head = "", cx = effEx(s);
      if (!opts.symbolOnly && !opts.noExUi) { /* v1.73.4: chỉ hiện lệnh của SÀN đang xem; chip HOSE/HNX/UPCoM (kèm số lệnh) để chuyển sàn */
        var cnt = {}; all0.forEach(function (o) { var e = effEx(o.sym); cnt[e] = (cnt[e] || 0) + 1; });
        all = all0.filter(function (o) { return effEx(o.sym) === cx; });
        xbar = '<div class="od-xf" role="group" aria-label="Chuyển sàn xem lệnh chờ"><span class="od-xl">Sàn</span>' + EXS.map(function (k) { return '<button type="button" data-od-ex="' + k + '" data-od-sym="' + esc(s) + '" class="' + (k === cx ? "on" : "") + '" aria-pressed="' + (k === cx) + '">' + exName(k) + (cnt[k] ? " · " + cnt[k] : "") + "</button>"; }).join("") + "</div>";
      }
      if (opts.symbolOnly) head = '<div class="od-sh"><b>' + esc(s) + "</b>" + exTag(s) + '<span>Lệnh chờ của mã này · áp dụng quy tắc sàn ' + exName(effEx(s)) + "</span></div>";
      if (!all.length) return head + xbar + '<p class="muted od-empty">' + (opts.symbolOnly ? "Chưa có lệnh chờ nào cho " + esc(s) + "." : "Chưa có lệnh chờ nào trên sàn " + exName(cx) + ".") + "</p>";
      var rows = ["buy", "tp", "sl"].map(function (k) {
        var l = all.filter(function (o) { return o.kind === k; }).sort(function (a, b) { return (a.sym === s ? 0 : 1) - (b.sym === s ? 0 : 1) || a.sym.localeCompare(b.sym) || (k === "buy" ? b.price - a.price : k === "tp" ? a.price - b.price : b.price - a.price); });
        return l.length ? '<tr class="od-sec od-s-' + k + '"><th colspan="6">' + KINDS[k] + " · " + l.length + " lệnh</th></tr>" + l.map(function (o) { return rowHtml(p, o); }).join("") : "";
      }).join("");
      return head + xbar + '<div class="od-tw"><table class="od-t' + (opts.symbolOnly ? ' od-so' : '') + '"><thead><tr><th>' + (opts.symbolOnly ? "" : "Mã") + "</th><th>KL</th><th>Giá đặt</th><th>So với giá HT</th><th>Trạng thái</th><th></th></tr></thead><tbody>" + rows + "</tbody></table></div>";
    }
    function render() {
      if (dead) return; var p = cur(), s = sym();
      if (!p) { el.innerHTML = '<p class="muted od-empty">Chọn khách hàng và danh mục trong phiếu lệnh để dùng lệnh chờ.</p>'; return; }
      var ae = document.activeElement, keep = ae && el.contains(ae) ? { k: ae.getAttribute("data-od-f") || ae.getAttribute("data-od-e"), oid: ae.closest("[data-oid]") ? ae.closest("[data-oid]").dataset.oid : null, v: ae.value } : null;
      el.innerHTML = '<div class="od">' + holdHtml(p, s) + (opts.listOnly ? "" : addHtml(p, s)) + (opts.noList ? "" : tableHtml(p)) +
        '<p class="od-foot">Sổ lệnh chờ trong ứng dụng — không gửi lên công ty chứng khoán, không tự bán/mua khi chạm giá. Bước giá, biên độ, lô theo quy tắc sàn ' + esc(q(s).exch) + ". Chưa tính ngày lễ khi xét T+2. · NHIP v2.10</p></div>";
      if (keep && keep.k) { var n = keep.oid ? el.querySelector('[data-oid="' + keep.oid + '"] [data-od-e="' + keep.k + '"]') : el.querySelector('[data-od-f="' + keep.k + '"]'); if (n) { n.focus(); try { n.setSelectionRange(n.value.length, n.value.length); } catch (e) { } } }
    }
    function lite() { /* gõ: chỉ cập nhật phần kiểm tra + nút, không dựng lại ô đang gõ */
      var p = cur(); if (!p) return; var tmp = document.createElement("div"); tmp.innerHTML = addHtml(p, sym()); var nd = tmp.querySelector(".od-dyn"), d = el.querySelector(".od-dyn"); if (nd && d) d.innerHTML = nd.innerHTML;
    }
    function addOrder() {
      var p = cur(), s = sym(); if (!p || busy) return; var Q = q(s), price = num(F.touched ? F.price : defPrice(F.kind, s)), o = { kind: F.kind, sym: s, price: price, qty: num(F.qty) };
      if (F.kind === "buy") { o.tp = num(F.tp); o.sl = num(F.sl); }
      busy = true; render();
      add(o, Q).then(function (r) { busy = false; if (r.ok) { F.qty = ""; F.tp = ""; F.sl = ""; F.touched = false; toast("Đã đặt " + KINDS[o.kind].toLowerCase() + " " + s + " @ " + nf(price) + (o.tp > 0 || o.sl > 0 ? " (kèm TP/SL sau khi mua)" : "")); } else if (r.err) toast(r.err, 1); render(); });
    }
    function edit(id, field, val) {
      var o = listFor().filter(function (x) { return x.id === id; })[0]; if (!o) return; var v = num(val), patch = {}; if (v === (o[field] || 0)) { render(); return; } patch[field] = v;
      update(id, patch, rq(o)).then(function (r) { if (!r.ok && r.err) toast(r.err, 1); else if (r.ok) toast("Đã sửa lệnh " + KINDS[o.kind].toLowerCase() + " " + o.sym); render(); });
    }
    el.addEventListener("click", function (e) {
      var b = e.target.closest("[data-od-kind],[data-od-step],[data-od-qs],[data-od-q],[data-od-qp],[data-od-pct],[data-od-xp],[data-od],[data-od-fill],[data-od-del],[data-od-pick]"); if (!b) return; var D = b.dataset, s = sym();
      if (D.odKind) { F.kind = D.odKind; F.touched = false; if (F.kind !== "buy") { F.tp = ""; F.sl = ""; } render(); return; }
      if (D.odStep) { var fl = D.odFor || "price", Q = q(s), cp = fl === "price" ? (F.touched ? num(F.price) : num(defPrice(F.kind, s))) : (num(F[fl]) || exitDef(fl)); if (!cp) return; var nv = step(cp, Q.exch, +D.odStep); if (fl === "price") { F.price = String(F.kind === "buy" ? clampBuy(nv, Q) : nv); F.touched = true; } else F[fl] = String(nv); render(); return; }
      if (D.odPct !== undefined) { var Q2 = q(s), pc = +D.odPct; if (!Q2.last) return; var v2 = snap(Q2.last * (1 + pc / 100), Q2.exch, pc > 0 ? 1 : pc < 0 ? -1 : 0); F.price = String(F.kind === "buy" ? clampBuy(v2, Q2) : v2); F.touched = true; render(); return; }
      if (D.odXp) { var pr = D.odXp.split(":"), en = entryNow(), pc2 = +pr[1]; if (!en) return; F[pr[0]] = String(snap(en * (1 + pc2 / 100), q(s).exch, pc2 > 0 ? 1 : -1)); render(); return; }
      if (D.odQs) { F.qty = String(Math.max(0, num(F.qty) + +D.odQs)); render(); return; }
      if (D.odQ) { F.qty = String(num(F.qty) + +D.odQ); render(); return; }
      if (D.odQp) { var p = cur(), pos = p && p.positions.filter(function (x) { return x.symbol === s; })[0], h = pos ? pos.qty : 0, fr = +D.odQp; F.qty = String(fr >= 1 ? h : (Math.floor(h * fr / 100) * 100 || h)); render(); return; }
      if (D.od === "go") { addOrder(); return; }
      if (D.odFill) { var o = listFor().filter(function (x) { return x.id === D.odFill; })[0]; if (o && opts.onFill) opts.onFill(o); return; }
      if (D.odDel) { var odId = D.odDel, od = listFor().filter(function (x) { return x.id === odId; })[0]; if (od) NhipDlg.confirmOrder({ kind: KINDS[od.kind], sym: od.sym, qty: od.qty, price: od.price }).then(function (ok) { if (ok) remove(odId).then(function (r) { if (r.ok) toast("Đã xóa lệnh chờ"); else if (r.err) toast(r.err, 1); render(); }); }); return; }
      if (D.odPick && opts.onPick) opts.onPick(D.odPick);
    });
    el.addEventListener("input", function (e) {
      var t = e.target, f = t.getAttribute("data-od-f"); if (!f) return;
      if (f === "qty") { F.qty = t.value.replace(/[^\d]/g, ""); if (t.value !== F.qty) t.value = F.qty; } else if (f === "tp" || f === "sl") F[f] = t.value.replace(/[^\d]/g, ""); else { F.price = t.value.replace(/[^\d]/g, ""); F.touched = true; }
      lite();
    });
    el.addEventListener("change", function (e) { var t = e.target, ed = t.getAttribute("data-od-e"), fe = t.getAttribute("data-od-f"); if (ed) { var tr = t.closest("[data-oid]"); if (tr) edit(tr.dataset.oid, ed, t.value); } else if (fe === "price" || fe === "tp" || fe === "sl") { F[fe] = String(num(t.value) || ""); if (fe === "price") F.touched = true; render(); } });
    el.addEventListener("keydown", function (e) { if (e.key === "Enter" && e.target.matches && e.target.matches(".od-in")) { e.preventDefault(); if (e.target.getAttribute("data-od-e")) e.target.blur(); else { F.touched = F.touched || e.target.getAttribute("data-od-f") === "price"; addOrder(); } } });
    var onEv = function () { var a = document.activeElement; if (!(a && el.contains(a) && a.matches && a.matches(".od-in"))) render(); };
    var EVS = ["nhip:orders-changed", "nhip:trade-sel", "nhip:portfolio-changed", "nhip:exch-changed"];
    EVS.forEach(function (n) { W.addEventListener(n, onEv); });
    render(); ensure().then(render);
    return { refresh: function () { if (!dead) { var a = document.activeElement; if (!(a && el.contains(a) && a.matches && a.matches(".od-in"))) render(); } }, resetForm: function () { F.touched = false; F.price = ""; F.qty = ""; F.tp = ""; F.sl = ""; render(); },
      destroy: function () { dead = true; EVS.forEach(function (n) { W.removeEventListener(n, onEv); }); try { el.innerHTML = ""; } catch (e) { } } };
  }

  /* ---------- v2.11 · Tự khớp (chạy khi biểu đồ có giá mới) ---------- */
  var AUTOK = "nhip.orders.auto", _autoBusy = false, _warned = {};
  function autoOn() { try { return W.localStorage.getItem(AUTOK) !== "0"; } catch (e) { return true; } }
  function setAuto(v) { try { W.localStorage.setItem(AUTOK, v ? "1" : "0"); } catch (e) { } }
  function feePctNow() { var f = sel().feePct; return isFinite(f) && f >= 0 && f <= 5 ? +f : 0.15; }
  var money = function (v) { return nf(Math.round(v)); };
  /* sym: mã đang xem · quote: {last} (CHỈ truyền khi là giá thật từ API) · candles: nến ngày của biểu đồ hoặc null.
     Trả {fills, skips} hoặc null (không có gì để làm / đang bận / tắt). Lưu 1 lần cho cả lượt; lỗi lưu → tải lại danh mục, không báo khớp. */
  async function autoRun(sym, quote, candles) {
    if (_autoBusy || !autoOn()) return null; sym = String(sym || "").toUpperCase();
    var p0 = cur(); if (!p0 || !Array.isArray(p0.orders)) return null; var last = quote && +quote.last > 0 ? +quote.last : 0;
    if (!p0.orders.some(function (o) { return o.sym === sym && autoHit(o, last, candles); })) return null; /* không có lệnh nào chạm giá → khỏi tải/lưu */
    _autoBusy = true;
    try {
      await g("pfLoad")(); var p = cur(); if (!p) return null; /* dùng bản mới nhất: tab/thiết bị khác có thể vừa khớp tay */
      var res = autoFill(p, sym, { last: last, candles: candles, apply: g("pfApply"), uid: g("uid"), feePct: feePctNow() });
      if (res.fills.length) {
        var ok = await g("pfSave")();
        if (!ok) { try { await g("pfLoad")(); } catch (e) { } toast("Không lưu được lệnh tự khớp — sẽ thử lại ở lần cập nhật giá sau", 1); res.fills = []; res.failed = true; return res; }
        res.fills.forEach(function (f) {
          toast("Tự khớp " + (f.side === "buy" ? "MUA " : (f.kind === "tp" ? "chốt lời " : "cắt lỗ ")) + f.sym + " " + nf(f.qty) + " cp @ " + nf(f.price) + (f.code ? " · nhóm " + f.code : "") + (f.side === "buy" ? " — TP/SL sau mua đã thành TP/SL thật" : ""));
        });
        notify(); try { W.dispatchEvent(new CustomEvent("nhip:portfolio-changed")); } catch (e) { }
      }
      res.skips.forEach(function (k) { /* báo mỗi lý do một lần trong phiên, không lặp mỗi phút */
        var key = k.id + ":" + k.reason; if (_warned[key]) return; _warned[key] = 1;
        if (k.reason === "cash") toast("Lệnh chờ mua " + k.sym + " đã chạm giá nhưng thiếu tiền mặt (cần " + money(k.need) + " ₫, có " + money(k.have) + " ₫) — chưa tự khớp, hãy nạp tiền hoặc bấm Ghi khớp", 1);
        else if (k.reason === "t2") toast(O_KINDS(k.kind) + " " + k.sym + " đã chạm giá nhưng cổ phiếu chưa về tài khoản (T+2) — sẽ tự khớp khi bán được", 1);
        else if (k.reason === "apply") toast("Không tự khớp được " + k.sym + ": " + k.msg, 1);
      });
      return res;
    } catch (e) { return null; } finally { _autoBusy = false; }
  }
  function O_KINDS(k) { return KINDS[k] || k; }

  api.autoRun = autoRun; api.autoOn = autoOn; api.setAuto = setAuto; api.exSelHtml = exSelHtml; api.rulesHtml = rulesHtml; api.cur = cur; api.ensure = ensure; api.list = listFor; api.add = add; api.update = update; api.remove = remove; api.mountTable = mountTable; api.esc = esc;
  return api;
});
