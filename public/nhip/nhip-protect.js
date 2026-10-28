/* NHIP · Chốt lời / Cắt lỗ cho VỊ THẾ ĐANG NẮM GIỮ trong Danh mục (v1.72)
   Quy tắc (cổ phiếu cơ sở HOSE / HNX / UPCoM, không phải phái sinh):
   - Chỉ đặt TP/SL cho cổ phiếu ĐANG GIỮ. Không bán khống: Stop loss luôn THẤP hơn giá hiện tại, Take profit luôn CAO hơn giá hiện tại.
   - TP/SL là hai lối THOÁT cho cùng số cổ phiếu: tổng KL mỗi nhóm ≤ số đang giữ (có thể chia nhiều tầng giá).
   - Lãi/lỗ dự kiến tính theo giá vốn bình quân, đã trừ phí môi giới + thuế bán 0,1%.
   - Dùng chung sổ lệnh chờ p.orders (kind "tp" / "sl") với trang Giao dịch → hai nơi luôn khớp nhau.
   Đây là SỔ GHI CHÚ trong ứng dụng: KHÔNG gửi lệnh lên công ty chứng khoán, KHÔNG tự bán khi chạm giá.
   Khi giá chạm mức, ứng dụng báo "Đã chạm" và có nút "Ghi bán" (điền sẵn phiếu bán) — bạn xác nhận giao dịch. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root);
  else root.NHIPProtect = factory(root);
})(typeof self !== "undefined" ? self : this, function (W) {
  "use strict";
  var NO = (typeof module === "object" && module.exports) ? require("./nhip-orders.js") : W.NHIPOrders;
  var FEE = 0.15, TAX = 0.1;
  var nf = function (v, d) { return v == null || !isFinite(v) ? "—" : Number(v).toLocaleString("vi-VN", { maximumFractionDigits: d || 0 }); };
  var sg = function (v, d) { return v == null || !isFinite(v) ? "—" : (v > 0 ? "+" : "") + nf(v, d == null ? 1 : d); };
  var posOf = function (p, sym) { return p && p.positions ? p.positions.filter(function (x) { return x.symbol === sym; })[0] || null : null; };

  /* ---------- Hàm thuần ---------- */
  /* Giá hòa vốn khi bán: làm tròn LÊN theo bước giá của sàn */
  function breakEven(cost, exch, feePct) {
    cost = +cost || 0; if (!(cost > 0)) return 0;
    var f = isFinite(feePct) && feePct >= 0 ? feePct : FEE;
    return NO.snap(cost / (1 - (f + TAX) / 100), exch, 1);
  }
  /* Kết quả nếu bán qty cp ở giá price (đã trừ phí + thuế) */
  function outcome(price, qty, cost, feePct) {
    var f = isFinite(feePct) && feePct >= 0 ? feePct : FEE, value = price * qty, fee = Math.round(value * f / 100), tax = Math.round(value * TAX / 100);
    var net = value - fee - tax, basis = cost * qty, pl = net - basis;
    return { value: value, fee: fee, tax: tax, net: net, pl: pl, plPct: basis > 0 ? pl / basis * 100 : null };
  }
  /* Các lệnh TP/SL của một mã: tp tăng dần (gần giá nhất trước), sl giảm dần */
  function ordersOf(p, sym) {
    var l = ((p && p.orders) || []).filter(function (o) { return o.sym === sym && (o.kind === "tp" || o.kind === "sl"); });
    return {
      tp: l.filter(function (o) { return o.kind === "tp"; }).sort(function (a, b) { return a.price - b.price; }),
      sl: l.filter(function (o) { return o.kind === "sl"; }).sort(function (a, b) { return b.price - a.price; })
    };
  }
  function sumQty(l) { return l.reduce(function (a, o) { return a + (+o.qty || 0); }, 0); }
  /* Độ phủ: bao nhiêu cp đã có TP / SL, còn trống bao nhiêu */
  function coverage(p, sym) {
    var pos = posOf(p, sym), held = pos ? pos.qty : 0, o = ordersOf(p, sym), t = sumQty(o.tp), s = sumQty(o.sl);
    return { held: held, tpQty: t, slQty: s, tpLeft: Math.max(0, held - t), slLeft: Math.max(0, held - s), tpN: o.tp.length, slN: o.sl.length };
  }
  /* Kịch bản: nếu TẤT CẢ lệnh SL chạm → lỗ bao nhiêu; TP chạm → lãi bao nhiêu; tỷ lệ lãi/rủi ro */
  function scenario(p, sym, feePct) {
    var pos = posOf(p, sym); if (!pos) return null; var o = ordersOf(p, sym), loss = 0, gain = 0, lq = 0, gq = 0;
    o.sl.forEach(function (x) { var r = outcome(x.price, x.qty, pos.cost, feePct); loss += r.pl; lq += x.qty; });
    o.tp.forEach(function (x) { var r = outcome(x.price, x.qty, pos.cost, feePct); gain += r.pl; gq += x.qty; });
    var rr = loss < 0 && gain > 0 && lq === gq ? gain / -loss : null;
    return { loss: loss, gain: gain, slQty: lq, tpQty: gq, rr: rr, basis: pos.cost * pos.qty };
  }
  /* Gợi ý nhanh theo %: base = "cost" (giá vốn) hoặc "last" (giá hiện tại). Trả null nếu mức giá sai chiều so với giá hiện tại. */
  function presets(pos, last, exch, base) {
    var b = base === "last" ? last : (pos ? pos.cost : last); if (!(b > 0) || !(last > 0)) return { sl: [], tp: [] };
    var mk = function (kind, pct) {
      var raw = kind === "sl" ? b * (1 - pct / 100) : b * (1 + pct / 100), price = NO.snap(raw, exch, kind === "sl" ? -1 : 1);
      var ok = kind === "sl" ? price < last : price > last;
      return { kind: kind, pct: pct, price: price, ok: ok, vsLast: (price / last - 1) * 100 };
    };
    return { sl: [5, 7, 10].map(function (x) { return mk("sl", x); }), tp: [10, 15, 20].map(function (x) { return mk("tp", x); }) };
  }
  /* SL dời về hòa vốn (chỉ khi giá hiện tại đã trên hòa vốn) */
  function breakEvenStop(pos, last, exch, feePct) {
    if (!pos || !(last > 0)) return null; var be = breakEven(pos.cost, exch, feePct);
    return be > 0 && be < last ? be : null;
  }
  /* Các mức đã chạm của danh mục. last: {SYM: giá đồng}; candles(sym) tùy chọn */
  function touched(p, last, candles) {
    var out = []; ((p && p.orders) || []).forEach(function (o) {
      if (o.kind !== "tp" && o.kind !== "sl") return; var pos = posOf(p, o.sym); if (!pos) return;
      var px = last ? last[o.sym] : null, h = NO.hit(o, px > 0 ? px : 0, candles ? candles(o.sym) : null);
      if (h) out.push({ o: o, hit: h, pos: pos });
    }); return out;
  }
  function validate(p, o, quote) { return NO.validate(o, NO.ctxFor(p, o, quote)); }

  var api = { FEE: FEE, TAX: TAX, breakEven: breakEven, outcome: outcome, ordersOf: ordersOf, coverage: coverage, scenario: scenario, presets: presets, breakEvenStop: breakEvenStop, touched: touched, validate: validate };
  if (typeof document === "undefined") return api;

  /* ---------- Giao diện ---------- */
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var g = function (n) { return W.NHIPPF ? W.NHIPPF[n] : undefined; };
  var toast = function (m, e) { try { g("toast")(m, e); } catch (x) { } };
  var dc = function (v) { return v > 0 ? "up" : v < 0 ? "dn" : ""; };
  function pfById(pid) { var x = g("PF2"); return x ? x.list.filter(function (p) { return p.id === pid; })[0] || null : null; }

  /* Ô "TP / SL" trong bảng vị thế: mức gần giá nhất mỗi phía + trạng thái */
  function cellHtml(p, sym, last) {
    var o = ordersOf(p, sym), cv = coverage(p, sym);
    if (!o.tp.length && !o.sl.length) return '<span class="pt-none">Đặt TP/SL</span>';
    var tp = o.tp.filter(function (x) { return !(last > 0) || x.price > last; })[0] || o.tp[0], sl = o.sl.filter(function (x) { return !(last > 0) || x.price < last; })[0] || o.sl[0];
    var line = function (k, x, n) {
      if (!x) return '<span class="pt-ln pt-miss">' + k + " —</span>";
      var hit = last > 0 && (k === "TP" ? last >= x.price : last <= x.price), d = last > 0 ? (x.price / last - 1) * 100 : null;
      return '<span class="pt-ln ' + (k === "TP" ? "up" : "dn") + (hit ? " pt-hit" : "") + '">' + k + " " + nf(x.price) + (d != null ? " <small>(" + sg(d) + "%)</small>" : "") + (n > 1 ? " <small>+" + (n - 1) + "</small>" : "") + (hit ? " ⚠" : "") + "</span>";
    };
    return line("TP", tp, o.tp.length) + line("SL", sl, o.sl.length) + (cv.slLeft > 0 && o.sl.length ? '<small class="pt-warn">SL phủ ' + nf(cv.slQty) + "/" + nf(cv.held) + "</small>" : "");
  }
  /* Dải cảnh báo đầu tab "Đang nắm giữ" */
  function bannerHtml(p, last, candles) {
    var t = touched(p, last, candles); if (!t.length) return "";
    return '<section class="panel pt-banner" role="alert"><div class="eyebrow">⚠ ĐÃ CHẠM MỨC TP / SL</div>' + t.map(function (x) {
      var tp = x.o.kind === "tp";
      return '<button type="button" class="pt-b-row ' + (tp ? "up" : "dn") + '" data-pt-open="' + esc(x.o.sym) + '"><b>' + esc(x.o.sym) + "</b><span>" + (tp ? "Chốt lời" : "Cắt lỗ") + " " + nf(x.o.qty) + " cp @ " + nf(x.o.price) + "</span><i>Xem & ghi bán →</i></button>";
    }).join("") + '<p class="source-note">Ứng dụng không tự bán. Mở mã để bấm “Ghi bán” (điền sẵn phiếu bán), rồi xác nhận giao dịch thực tế ở công ty chứng khoán của bạn.</p></section>';
  }

  /* Bảng quản lý TP/SL của MỘT mã. opts: { pid(), symbol(), quote(sym):{last,ref,exch}, candles(sym)?, onChange(), onFill(order) } */
  function mountPanel(el, opts) {
    var dead = false, busy = false, F = { kind: opts.kind === "tp" ? "tp" : "sl", price: opts.price > 0 ? String(Math.round(opts.price)) : "", qty: "", touched: opts.price > 0, base: "cost" }; /* v2.40: mở từ biểu đồ/danh mục có thể chọn sẵn loại + giá */
    var sym = function () { return String(opts.symbol() || "").toUpperCase(); };
    var P = function () { return pfById(opts.pid()); };
    var Q = function () { var x = opts.quote ? opts.quote(sym()) || {} : {}; return { last: x.last > 0 ? x.last : null, ref: x.ref, exch: NO.getExch ? NO.getExch(sym(), x.exch || "HOSE") : (x.exch || "HOSE"), feePct: x.feePct }; };
    var num = function (v) { var n = g("pnum") ? g("pnum")(v) : parseFloat(String(v).replace(/\./g, "").replace(",", ".")); return isNaN(n) ? 0 : n; };

    function defPrice(kind, q) { if (!q.last) return ""; return String(NO.snap(q.last * (kind === "tp" ? 1.1 : 0.93), q.exch, kind === "tp" ? 1 : -1)); }
    function curPrice(q) { return F.touched ? num(F.price) : num(defPrice(F.kind, q)); }
    function defQty(p, q) { var c = coverage(p, sym()); return F.kind === "tp" ? c.tpLeft : c.slLeft; }

    function summaryHtml(p, q) {
      var pos = posOf(p, sym()), s = NO.sellable(p, sym()), cv = coverage(p, sym()), sc = scenario(p, sym(), M(q)), L = q.last;
      var up = L && pos.cost > 0 ? (L / pos.cost - 1) * 100 : null, be = breakEven(pos.cost, q.exch, M(q));
      return '<div class="pt-sum"><div><span>Đang giữ</span><b>' + nf(pos.qty) + " cp</b></div><div><span>Giá vốn BQ</span><b>" + nf(pos.cost) + "</b></div><div><span>Giá hiện tại</span><b>" + (L ? nf(L) : "—") + (up != null ? ' <small class="' + dc(up) + '">' + sg(up, 2) + "%</small>" : "") + "</b></div><div><span>Giá hòa vốn*</span><b>" + nf(be) + "</b></div></div>" +
        '<div class="pt-cov"><span class="' + (cv.slLeft ? "pt-warn" : "up") + '">Cắt lỗ phủ ' + nf(cv.slQty) + "/" + nf(cv.held) + " cp</span><span class=\"" + (cv.tpLeft ? "muted" : "up") + '">Chốt lời phủ ' + nf(cv.tpQty) + "/" + nf(cv.held) + " cp</span></div>" +
        (sc && (sc.slQty || sc.tpQty) ? '<div class="pt-scn"><div><span>Nếu chạm hết SL</span><b class="dn">' + (sc.slQty ? sg(sc.loss, 0) + " ₫" : "—") + '</b></div><div><span>Nếu chạm hết TP</span><b class="up">' + (sc.tpQty ? sg(sc.gain, 0) + " ₫" : "—") + '</b></div><div><span>Lãi / rủi ro</span><b>' + (sc.rr ? nf(sc.rr, 2) + " : 1" : "—") + "</b></div></div>" : "") +
        (s.unsettled ? '<p class="pt-note">' + nf(s.unsettled) + " cp mới mua chưa về tài khoản (bán được từ 13h chiều T+2).</p>" : "");
    }
    var M = function (q) { return q.feePct; };
    function quickHtml(p, q) {
      var pos = posOf(p, sym()), pr = presets(pos, q.last, q.exch, F.base), be = breakEvenStop(pos, q.last, q.exch, M(q));
      if (!q.last) return '<p class="pt-note">Chưa có giá hiện tại nên chưa gợi ý được mức giá.</p>';
      var chip = function (x) { return '<button type="button" data-pt-pre="' + x.kind + ":" + x.price + '"' + (x.ok ? "" : " disabled") + ' class="pt-c-' + x.kind + '">' + (x.kind === "sl" ? "−" : "+") + x.pct + "% · " + nf(x.price) + "</button>"; };
      return '<div class="pt-q"><div class="pt-q-h"><span>Gợi ý nhanh · tính từ</span><div class="pt-seg" role="group"><button type="button" data-pt-base="cost" class="' + (F.base === "cost" ? "on" : "") + '">Giá vốn</button><button type="button" data-pt-base="last" class="' + (F.base === "last" ? "on" : "") + '">Giá hiện tại</button></div></div>' +
        (F.kind === "sl" ? '<div class="pt-chips pt-qrow"><span class="nx-seg">' + pr.sl.map(chip).join("") + (be ? '<button type="button" data-pt-pre="sl:' + be + '" class="pt-c-sl">Hòa vốn · ' + nf(be) + "</button>" : "") + "</span></div>" : '<div class="pt-chips pt-qrow"><span class="nx-seg">' + pr.tp.map(chip).join("") + "</span></div>") + '</div>';
    }
    function formHtml(p, q) {
      var price = curPrice(q), qty = F.qty === "" ? defQty(p, q) : num(F.qty), o = { kind: F.kind, sym: sym(), price: price, qty: qty }, r = validate(p, o, q), pos = posOf(p, sym());
      var show = (qty > 0 ? r.errors : r.errors.filter(function (e) { return !/Khối lượng/.test(e); })).concat(r.warns);
      var msgs = show.map(function (m) { return '<p class="od-msg ' + (r.errors.indexOf(m) >= 0 ? "err" : "warn") + '">' + esc(m) + "</p>"; }).join("");
      var oc = price > 0 && qty > 0 && pos ? outcome(price, qty, pos.cost, M(q)) : null, ready = !r.errors.length && price > 0 && qty > 0 && !busy;
      var cv = coverage(p, sym());
      return '<div class="pt-form"><div class="pt-kinds" role="group" aria-label="Loại lệnh"><button type="button" data-pt-kind="sl" class="pt-k-sl' + (F.kind === "sl" ? " on" : "") + '">Cắt lỗ (Stop loss)</button><button type="button" data-pt-kind="tp" class="pt-k-tp' + (F.kind === "tp" ? " on" : "") + '">Chốt lời (Take profit)</button></div>' +
        '<div class="pt-fields"><div class="pt-fg"><label><span>' + (F.kind === "sl" ? "Giá cắt lỗ (₫) — thấp hơn giá HT" : "Giá chốt lời (₫) — cao hơn giá HT") + '</span><div class="od-st"><button type="button" data-pt-step="-1" aria-label="Giảm một bước giá">−</button><input class="od-in" data-pt-f="price" inputmode="numeric" value="' + esc(nf(price || 0)) + '"><button type="button" data-pt-step="1" aria-label="Tăng một bước giá">+</button></div></label></div>' +
        '<div class="pt-fg"><label><span>Khối lượng (cp)</span><div class="od-st"><button type="button" data-pt-qs="-100" aria-label="Giảm 100">−</button><input class="od-in" data-pt-f="qty" inputmode="numeric" value="' + esc(nf(qty || 0)) + '"><button type="button" data-pt-qs="100" aria-label="Tăng 100">+</button></div></label></div></div>' +
        '<div class="pt-chips nx-seg pt-qchips" role="group" aria-label="Chọn nhanh khối lượng"><button type="button" data-pt-qp="0.25">25%</button><button type="button" data-pt-qp="0.5">50%</button><button type="button" data-pt-qp="1">Tất cả (' + nf(cv.held) + ')</button></div>' +
        '<div class="pt-dyn">' + (oc ? '<div class="pt-oc"><span>Nếu chạm giá này</span><b class="' + dc(oc.pl) + '">' + sg(oc.pl, 0) + " ₫ (" + sg(oc.plPct, 2) + "%)</b><small>thực nhận " + nf(oc.net) + " ₫ sau phí + thuế 0,1%</small></div>" : "") + msgs +
        '<button type="button" class="pt-go ' + F.kind + '" data-pt="go" ' + (ready ? "" : "disabled") + ">Đặt " + (F.kind === "sl" ? "cắt lỗ" : "chốt lời") + " · " + esc(sym()) + "</button></div></div>";
    }
    function listHtml(p, q) {
      var o = ordersOf(p, sym()), all = o.tp.slice().reverse().concat(o.sl), pos = posOf(p, sym());
      if (!all.length) return '<p class="muted pt-empty">Chưa đặt TP/SL cho ' + esc(sym()) + ".</p>";
      return '<div class="pt-ol">' + all.map(function (x) {
        var h = NO.hit(x, q.last || 0, opts.candles ? opts.candles(x.sym) : null), d = q.last ? (x.price / q.last - 1) * 100 : null, oc = pos ? outcome(x.price, x.qty, pos.cost, M(q)) : null, over = x.qty > (pos ? pos.qty : 0);
        return '<div class="pt-oi' + (h ? " is-hit" : "") + '" data-oid="' + x.id + '"><div class="pt-oi-h"><b class="' + (x.kind === "tp" ? "up" : "dn") + '">' + (x.kind === "tp" ? "Chốt lời" : "Cắt lỗ") + '</b><span class="pt-oi-d">' + (d != null ? sg(d) + "% so với giá HT" : "") + '</span>' +
          (h ? '<b class="od-hit">Đã chạm giá</b>' : over ? '<b class="od-over">KL vượt số giữ</b>' : '<small class="muted">Đang chờ</small>') +
          '<span class="pt-act">' + (h ? '<button type="button" class="od-fill" data-pt-fill="' + x.id + '">Ghi bán</button>' : "") + '<button type="button" class="od-del" data-pt-del="' + x.id + '" aria-label="Xóa lệnh">✕</button></span></div>' +
          '<div class="pt-oi-f"><label><small>KL (cp)</small><input class="od-in sm" data-pt-e="qty" inputmode="numeric" value="' + nf(x.qty) + '"></label><label><small>Giá (₫)</small><input class="od-in sm" data-pt-e="price" inputmode="numeric" value="' + nf(x.price) + '"></label>' +
          '<div class="pt-oi-pl"><small>Nếu chạm</small>' + (oc ? '<b class="' + dc(oc.pl) + '">' + sg(oc.pl, 0) + " ₫</b>" : "<b>—</b>") + '</div></div></div>';
      }).join("") + "</div>";
    }
    function render() {
      if (dead) return; var p = P(), q = Q(), pos = p && posOf(p, sym());
      if (!p) { el.innerHTML = '<p class="muted pt-empty">Không tìm thấy danh mục.</p>'; return; }
      if (!pos) { el.innerHTML = '<p class="muted pt-empty">Chưa giữ ' + esc(sym()) + " — TP/SL chỉ đặt cho cổ phiếu đang nắm giữ (thị trường cổ phiếu không bán khống).</p>"; return; }
      var ae = document.activeElement, keep = ae && el.contains(ae) ? { k: ae.getAttribute("data-pt-f") || ae.getAttribute("data-pt-e"), oid: ae.closest && ae.closest("[data-oid]") ? ae.closest("[data-oid]").dataset.oid : null } : null;
      el.innerHTML = '<div class="pt">' + summaryHtml(p, q) + quickHtml(p, q) + formHtml(p, q) + '<div class="pt-h3">Lệnh đang đặt</div>' + listHtml(p, q) +
        '<p class="pt-foot">* Giá hòa vốn gồm phí ' + nf(isFinite(q.feePct) ? q.feePct : FEE, 2) + '% + thuế bán 0,1%. Sổ ghi chú trong ứng dụng — không gửi lệnh lên công ty chứng khoán, không tự bán khi chạm giá. Sàn ' + esc(q.exch) + ".</p></div>";
      if (keep && keep.k) { var n = keep.oid ? el.querySelector('[data-oid="' + keep.oid + '"] [data-pt-e="' + keep.k + '"]') : el.querySelector('[data-pt-f="' + keep.k + '"]'); if (n) { n.focus(); try { n.setSelectionRange(n.value.length, n.value.length); } catch (e) { } } }
    }
    function lite() { var p = P(); if (!p) return; var tmp = document.createElement("div"); tmp.innerHTML = formHtml(p, Q()); var nd = tmp.querySelector(".pt-dyn"), d = el.querySelector(".pt-dyn"); if (nd && d) d.innerHTML = nd.innerHTML; }
    /* ghi: dùng bản mới nhất của danh mục rồi lưu (pfSave tự xử lý xung đột phiên bản) */
    async function mutate(fn) {
      var p = P(); if (!p) return { ok: false, err: "Không tìm thấy danh mục" };
      p.orders = Array.isArray(p.orders) ? p.orders : []; var m = fn(p); if (m) return { ok: false, err: m };
      var ok = false; try { ok = await g("pfSave")(); } catch (e) { }
      if (ok) { try { W.dispatchEvent(new CustomEvent("nhip:orders-changed")); } catch (e) { } if (opts.onChange) opts.onChange(); }
      return { ok: ok, err: ok ? "" : "Không lưu được" };
    }
    function place() {
      var p = P(), q = Q(); if (!p || busy) return; var price = curPrice(q), qty = F.qty === "" ? defQty(p, q) : num(F.qty), o = { kind: F.kind, sym: sym(), price: price, qty: qty };
      busy = true; render();
      mutate(function (pp) {
        if (pp.orders.length >= NO.MAX_ORDERS) return "Tối đa " + NO.MAX_ORDERS + " lệnh chờ mỗi danh mục";
        var r = validate(pp, o, q); if (r.errors.length) return r.errors[0];
        pp.orders.push({ id: g("uid")(), sym: o.sym, kind: o.kind, price: Math.round(o.price), qty: Math.floor(o.qty), created: NO.vnDate() });
      }).then(function (r) { busy = false; if (r.ok) { toast("Đã đặt " + (o.kind === "sl" ? "cắt lỗ " : "chốt lời ") + o.sym + " @ " + nf(o.price)); F.qty = ""; F.touched = false; } else if (r.err) toast(r.err, 1); render(); });
    }
    function edit(id, field, val) {
      var q = Q(), v = num(val);
      mutate(function (p) {
        var x = p.orders.filter(function (y) { return y.id === id; })[0]; if (!x) return "Lệnh không còn tồn tại"; if (v === x[field]) return "";
        var n = { id: id, sym: x.sym, kind: x.kind, price: field === "price" ? v : x.price, qty: field === "qty" ? v : x.qty }, r = validate(p, n, q); if (r.errors.length) return r.errors[0];
        x.price = Math.round(n.price); x.qty = Math.floor(n.qty); if (field === "price") x.created = NO.vnDate();
      }).then(function (r) { if (!r.ok && r.err) toast(r.err, 1); else if (r.ok) toast("Đã sửa lệnh"); render(); });
    }
    function del(id) {
      var p = P(), x = p && (p.orders || []).filter(function (y) { return y.id === id; })[0]; if (!x) return;
      NhipDlg.confirmOrder({ kind: x.kind === "tp" ? "Chốt lời" : "Cắt lỗ", sym: x.sym, qty: x.qty, price: x.price }).then(function (ok) {
        if (!ok) return;
        mutate(function (pp) { pp.orders = pp.orders.filter(function (y) { return y.id !== id; }); }).then(function (r) { if (r.ok) toast("Đã xóa lệnh"); else if (r.err) toast(r.err, 1); render(); });
      });
    }
    el.addEventListener("click", function (e) {
      var b = e.target.closest("[data-pt-kind],[data-pt-base],[data-pt-pre],[data-pt-step],[data-pt-qs],[data-pt-qp],[data-pt],[data-pt-fill],[data-pt-del]"); if (!b) return; var D = b.dataset, p = P(), q = Q();
      if (D.ptKind) { F.kind = D.ptKind === "tp" ? "tp" : "sl"; F.touched = false; F.qty = ""; render(); return; }
      if (D.ptBase) { F.base = D.ptBase === "last" ? "last" : "cost"; render(); return; }
      if (D.ptPre) { var s = D.ptPre.split(":"); F.kind = s[0] === "tp" ? "tp" : "sl"; F.price = s[1]; F.touched = true; F.qty = ""; render(); return; }
      if (D.ptStep) { var cp = curPrice(q); if (!cp) return; F.price = String(NO.step(cp, q.exch, +D.ptStep)); F.touched = true; render(); return; }
      if (D.ptQs) { var cq = F.qty === "" ? defQty(p, q) : num(F.qty); F.qty = String(Math.max(0, cq + +D.ptQs)); render(); return; }
      if (D.ptQp) { var h = p ? coverage(p, sym()).held : 0, fr = +D.ptQp, raw = Math.floor(h * fr + 1e-9); F.qty = String(fr >= 1 ? h : (raw >= 100 ? Math.floor(raw / 100) * 100 : raw)); render(); return; }
      if (D.pt === "go") { place(); return; }
      if (D.ptFill) { var o = ((p && p.orders) || []).filter(function (x) { return x.id === D.ptFill; })[0]; if (o && opts.onFill) opts.onFill(o); return; }
      if (D.ptDel) del(D.ptDel);
    });
    el.addEventListener("input", function (e) {
      var t = e.target, f = t.getAttribute("data-pt-f"); if (!f) return;
      if (f === "qty") { F.qty = t.value.replace(/[^\d]/g, ""); if (t.value !== F.qty) t.value = F.qty; } else { F.price = t.value.replace(/[^\d]/g, ""); F.touched = true; }
      lite();
    });
    el.addEventListener("change", function (e) { var t = e.target, ed = t.getAttribute("data-pt-e"); if (ed) { var tr = t.closest("[data-oid]"); if (tr) edit(tr.dataset.oid, ed, t.value); } else if (t.getAttribute("data-pt-f") === "price") { F.price = String(num(t.value)); render(); } else if (t.getAttribute("data-pt-f") === "qty") { F.qty = String(num(t.value)); render(); } });
    el.addEventListener("keydown", function (e) { if (e.key === "Enter" && e.target.matches && e.target.matches(".od-in")) { e.preventDefault(); if (e.target.getAttribute("data-pt-e")) e.target.blur(); else { if (e.target.getAttribute("data-pt-f") === "price") F.touched = true; place(); } } });
    render();
    return { refresh: function () { if (dead) return; var a = document.activeElement; if (!(a && el.contains(a) && a.matches && a.matches(".od-in"))) render(); }, destroy: function () { dead = true; try { el.innerHTML = ""; } catch (e) { } } };
  }
  api.mountPanel = mountPanel; api.cellHtml = cellHtml; api.bannerHtml = bannerHtml;
  return api;
});
