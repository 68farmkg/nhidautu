/* NHIP v2.13.2 — bảng nằm NGAY TRÊN TỪNG KHUNG (góc dưới trái vùng nến, như biểu đồ chính), mỗi khung một bảng, dùng chung ô tích.
   NHIP v2.13 — thêm bảng "Lệnh trên biểu đồ" (mở/thu gọn, tích chọn nhóm, Mờ/Ẩn) cho Đa khung, dùng chung trạng thái tích với biểu đồ một khung; tự ẩn khi không có lệnh.
   NHIP v2.12 — Giá đang giao dịch trên TỪNG KHUNG của chế độ Đa khung (CHỈ ở mục Giao dịch).
   Hiện các đường ngang + nhãn giống biểu đồ chính: Giá vốn (đang giữ) · Chờ mua · TP · SL · TP/SL sau mua, cùng màu/mã nhóm.
   Chỉ ĐỌC (không kéo/sửa/xóa) — muốn sửa lệnh thì dùng biểu đồ một khung. Dữ liệu lấy từ NHIPOrders (cùng nguồn với biểu đồ chính),
   nên tự cập nhật khi đặt/sửa/khớp lệnh. Ở Biểu đồ và Phân tích: không làm gì. */
(function () {
  "use strict";
  var O = window.NHIPOrders; if (!O) return;
  var insts = [], raf = 0, ready = false;
  var MODEK = "nhip.ol.mode2", MEM = window.NHIPOLMem = window.NHIPOLMem || {}; /* dùng chung với charts-orders.js: tích nhóm nào ở biểu đồ một khung thì ở đa khung cũng vậy */
  var esc = O.esc || function (x) { return String(x == null ? "" : x).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  function memOf(sym) { return MEM[sym] || (MEM[sym] = { sel: {}, seen: {}, done: false }); }
  function modeNow() { try { return window.localStorage.getItem(MODEK) === "dim" ? "dim" : "hide"; } catch (e) { return "hide"; } }
  var nf = function (v, d) { return v == null || !isFinite(v) ? "—" : Number(v).toLocaleString("vi-VN", { maximumFractionDigits: d || 0 }); };
  var LBL = { buy: "Chờ mua", tp: "▲ TP", sl: "▼ SL", cost: "Giá vốn", btp: "▲ TP sau mua", bsl: "▼ SL sau mua" };
  function mk(cls) { var d = document.createElement("div"); d.className = cls; return d; }

  function dataList(S) { try { return S.k.getDataList() || []; } catch (e) { return []; } }
  function lastClose(S) { var d = dataList(S); return d.length ? d[d.length - 1].close : null; }
  function geo(S) {
    var W = S.box.clientWidth, H = S.box.clientHeight, m = null;
    try { m = S.k.getSize("candle_pane", "main"); } catch (e) { }
    return { w: W, mw: m && m.width ? m.width : Math.max(80, W - 64), mh: m && m.height ? m.height : Math.round(H * 0.62) };
  }
  function yOf(S, price) { try { var r = S.k.convertToPixel([{ value: price }], { paneId: "candle_pane" })[0]; return r && isFinite(r.y) ? r.y : null; } catch (e) { return null; } }

  /* danh sách đường cần vẽ — cùng cách suy ra như charts-orders.js (biểu đồ chính) */
  function collect(S) {
    var p = O.cur(); if (!p) return [];
    var pos = (p.positions || []).filter(function (x) { return x.symbol === S.sym; })[0] || null;
    var list = O.list(S.sym).slice(), G = O.groups(list, S.sym), HG = O.holdGroup(), out = [];
    if (pos) out.push({ type: "cost", price: Math.round(pos.cost), qty: pos.qty, g: HG, pos: pos });
    list.forEach(function (o) {
      out.push({ type: o.kind, price: o.price, qty: o.qty, g: o.kind === "buy" ? G[o.id] : O.exitGroup(o), pos: pos });
      if (o.kind === "buy") [["btp", +o.tp], ["bsl", +o.sl]].forEach(function (a) { if (a[1] > 0) out.push({ type: a[0], price: a[1], qty: o.qty, buyPx: o.price, g: G[o.id] }); });
    });
    return out;
  }
  function fill(S, it) {
    var t = it.tag, ch = it.g ? O.chip(it.g) : "";
    var dpc = function (d) { return d == null ? "" : '<span class="ol-d ' + (d >= 0 ? "up" : "dn") + '">' + (d > 0 ? "+" : "") + nf(d, 1) + "%</span>"; };
    if (it.type === "cost") {
      var last = lastClose(S), pl = last > 0 && it.price > 0 ? (last / it.price - 1) * 100 : null;
      t.innerHTML = ch + '<span class="ol-lbl">Giá vốn</span><b class="ol-px">' + nf(it.price) + '</b><span class="ol-q">' + nf(it.qty) + " cp" + (pl != null ? ' · <i class="' + (pl >= 0 ? "up" : "dn") + '">' + (pl > 0 ? "+" : "") + nf(pl, 1) + "%</i>" : "") + "</span>"; return;
    }
    var d = it.buyPx > 0 ? (it.price / it.buyPx - 1) * 100 : (it.pos && it.pos.cost > 0 && (it.type === "tp" || it.type === "sl") ? (it.price / it.pos.cost - 1) * 100 : null);
    t.innerHTML = ch + '<span class="ol-lbl">' + LBL[it.type] + '</span><b class="ol-px">' + nf(it.price) + '</b><span class="ol-q">×' + nf(it.qty) + "</span>" + (it.type === "buy" ? "" : dpc(d));
  }
  function build(S) {
    S.items.forEach(function (i) { i.line.remove(); i.tag.remove(); }); S.items = [];
    var arr = [];
    try { arr = collect(S); } catch (e) { console.warn("orders-multi:", e); }
    arr.forEach(function (it) {
      it.line = mk("ol-line ol-t-" + it.type); it.tag = mk("ol-tag ol-t-" + it.type); it.cost = it.type === "cost";
      if (it.g) { it.gk = it.g.key; [it.line, it.tag].forEach(function (e) { e.classList.add("ol-g"); e.style.setProperty("--ol-g", it.g.color); }); }
      S.layer.appendChild(it.line); S.layer.appendChild(it.tag); fill(S, it); S.items.push(it);
    });
    applySel(S); S.sig = ""; place(S);
  }
  function place(S) {
    var g = geo(S), ys = S.items.map(function (i) { return yOf(S, i.price); }), sig = g.w + "|" + g.mw + "|" + g.mh + "|" + (S.P && !S.P.el.hidden ? S.P.el.offsetHeight : 0) + "|" + ys.join(",");
    if (sig === S.sig) return; S.sig = sig;
    if (S.P && !S.P.el.hidden) S.P.el.style.top = Math.max(4, g.mh - S.P.el.offsetHeight - 8) + "px";
    S.items.forEach(function (i) { i.line.style.display = "none"; i.tag.style.display = "none"; });
    var order = S.items.map(function (i, n) { return { i: i, y: ys[n] }; }).filter(function (x) { return x.y != null && x.y >= 0 && x.y <= g.mh && !x.i.hidden; });
    var right = Math.max(4, g.w - g.mw + 6), GAP = 21;
    ["right", "left"].forEach(function (side) {
      var grp = order.filter(function (x) { return (x.i.cost ? "left" : "right") === side; }).sort(function (a, b) { return a.y - b.y; }), prev = -99;
      grp.forEach(function (x) { x.ty = Math.max(x.y, prev + GAP); prev = x.ty; });
      var lim = g.mh - 11; for (var gi = grp.length - 1; gi >= 0; gi--) { if (grp[gi].ty > lim) grp[gi].ty = lim; lim = grp[gi].ty - GAP; }
      grp.forEach(function (x) {
        var ty = Math.max(11, x.ty), i = x.i;
        i.line.style.display = ""; i.line.style.top = x.y + "px"; i.line.style.width = g.mw + "px";
        i.tag.style.display = ""; i.tag.style.top = (ty - 10) + "px";
        if (side === "right") { i.tag.style.right = right + "px"; i.tag.style.left = "auto"; } else { i.tag.style.left = "6px"; i.tag.style.right = "auto"; }
      });
    });
  }
  function loop() {
    raf = 0;
    insts = insts.filter(function (S) { if (!S.box.isConnected) { try { S.layer.remove(); if (S.P) S.P.el.remove(); } catch (e) { } return false; } return true; });
    if (!insts.length) return;
    if (!document.hidden) insts.forEach(function (S) { place(S); });
    raf = requestAnimationFrame(loop);
  }

  /* ---------- Bảng nhóm lệnh (một bảng cho cả lưới đa khung) ---------- */
  function snap(sym) {
    var p = O.cur(); if (!p) return null;
    var list = O.list(sym).slice(), pos = (p.positions || []).filter(function (x) { return x.symbol === sym; })[0] || null;
    return { list: list, G: O.groups(list, sym), pos: pos };
  }
  function keysOf(d) {
    var ks = {}; if (d.pos) ks.hold = 1;
    d.list.forEach(function (o) { if (o.kind === "buy") ks[d.G[o.id].key] = 1; else ks[O.exitGroup(o).key] = 1; });
    return ks;
  }
  /* nhóm MỚI xuất hiện sau lần đầu (lệnh chờ mua vừa đặt, nhóm "Giữ X" sinh ra khi khớp) tự được tích — cùng luật với biểu đồ một khung */
  function syncSel(sym, d) {
    if (!ready || !d) return; var m = memOf(sym), ks = keysOf(d);
    Object.keys(ks).forEach(function (k) { if (m.seen[k]) return; m.seen[k] = 1; if (!m.done) return; if (k.indexOf("g:") === 0) { if (m.sel[k.slice(2)]) m.sel[k] = m.sel[k.slice(2)]; } else m.sel[k] = 1; });
    m.done = true; Object.keys(m.sel).forEach(function (k) { if (!ks[k]) { delete m.sel[k]; delete m.seen[k]; } });
  }
  function applySel(S) {
    var m = memOf(S.sym);
    S.items.forEach(function (i) {
      var st = m.sel[i.gk] || 0, hd = !st, dim = st === 2; i.hidden = hd; /* 1 = Hiện · 2 = Mờ · không chọn = không hiện */
      [i.line, i.tag].forEach(function (e) { e.classList.toggle("ol-dim", dim); e.classList.toggle("ol-hide", hd); });
    });
    S.sig = "";
  }
  function legendRows(d, m) {
    var fx = function (arr, cls, lab, rev) { return arr.slice().sort(function (a, b) { return rev ? b.price - a.price : a.price - b.price; }).map(function (x) { return ' <em class="' + cls + '">' + lab + " " + nf(x.price) + "×" + nf(x.qty) + "</em>"; }).join(""); };
    var ck = function (k) { var st = m.sel[k] || 0; return '<span class="ol-lg-vm" role="group" aria-label="Cách hiển thị nhóm này"><button type="button" class="' + (st === 1 ? "on" : "") + '" data-ol-st="' + esc(k) + '" data-ol-v="1" aria-pressed="' + (st === 1) + '" title="Hiện nhóm này trên các khung (bấm lại để bỏ chọn)">Hiện</button><button type="button" class="' + (st === 2 ? "on" : "") + '" data-ol-st="' + esc(k) + '" data-ol-v="2" aria-pressed="' + (st === 2) + '" title="Hiện mờ nhóm này (bấm lại để bỏ chọn)">Mờ</button></span>'; };
    var buys = d.list.filter(function (o) { return o.kind === "buy"; }), ex = d.list.filter(function (o) { return o.kind === "tp" || o.kind === "sl"; });
    var byG = {}, order = [], rows = [], HG = O.holdGroup(), has = Object.keys(m.sel).length > 0;
    if (d.pos || ex.some(function (o) { return !o.grp; })) { byG.hold = { g: HG, tp: [], sl: [] }; order.push("hold"); }
    ex.forEach(function (o) { var g = O.exitGroup(o); if (!byG[g.key]) { byG[g.key] = { g: g, tp: [], sl: [] }; order.push(g.key); } byG[g.key][o.kind].push(o); });
    order.forEach(function (key) {
      var b = byG[key], g = b.g, main = key === "hold" ? (d.pos ? nf(d.pos.qty) + " cp · vốn " + nf(Math.round(d.pos.cost)) : "Đang giữ") : "mua " + (g.gpx ? nf(g.gpx) : "") + " · đã khớp", on = !!m.sel[key];
      rows.push('<div class="ol-lg-r' + (on ? " on" : "") + (has && !on ? " ol-dim" : "") + '" data-ol-g="' + esc(key) + '" style="--ol-g:' + g.color + '" title="' + esc(g.tip || "Phần cổ phiếu đang giữ") + ' — bấm để chọn / bỏ chọn nhóm này">' + ck(key) + O.chip(g) + '<span class="ol-lg-t"><b>' + main + "</b>" + fx(b.tp, "up", "▲TP", false) + fx(b.sl, "dn", "▼SL", true) + "</span></div>");
    });
    buys.forEach(function (o) {
      var g = d.G[o.id], on = !!m.sel[o.id];
      rows.push('<div class="ol-lg-r' + (on ? " on" : "") + (has && !on ? " ol-dim" : "") + '" data-ol-g="' + esc(o.id) + '" style="--ol-g:' + g.color + '" title="Lệnh chờ mua nhóm ' + esc(g.code) + ' — bấm để chọn / bỏ chọn nhóm này">' + ck(o.id) + O.chip(g) + '<span class="ol-lg-t"><b>Mua ' + nf(o.price) + "</b> ×" + nf(o.qty) + (o.tp > 0 ? ' <em class="up">▲TP ' + nf(o.tp) + "</em>" : "") + (o.sl > 0 ? ' <em class="dn">▼SL ' + nf(o.sl) + "</em>" : "") + "</span></div>");
    });
    rows.keys = order.concat(buys.map(function (o) { return o.id; }));
    return rows;
  }
  function openOf(P) { var o = memOf(P.sym).mcOpen || {}; return o[P.res] == null ? (P.S.box.clientWidth || 400) > 600 : !!o[P.res]; }
  function renderPanel(P) {
    if (!P.el || !P.el.isConnected) return;
    var d = snap(P.sym), orders = d ? d.list.length : 0;
    if (!d || (!orders && !d.pos)) { P.el.hidden = true; P.el.innerHTML = ""; return; } /* không có lệnh nào → ẩn bảng */
    var m = memOf(P.sym), rows = legendRows(d, m), nsel = Object.keys(m.sel).length, open = openOf(P), keys = rows.keys || [], sts = keys.map(function (k) { return m.sel[k] || 0; }), allSt = keys.length && sts.every(function (v) { return v === sts[0]; }) ? sts[0] : -1;
    P.keys = keys;
    var master = function (n, st) { return '<div class="ol-lg-all" role="group" aria-label="Áp dụng cho tất cả nhóm"><span class="ol-lg-al">Tất cả</span><span class="ol-lg-vm ol-lg-vm3"><button type="button" class="' + (st === 0 ? "on" : "") + '" data-ol-all="0" aria-pressed="' + (st === 0) + '" title="Ẩn tất cả nhóm khỏi biểu đồ">Ẩn</button><button type="button" class="' + (st === 1 ? "on" : "") + '" data-ol-all="1" aria-pressed="' + (st === 1) + '" title="Hiện tất cả nhóm">Hiện</button><button type="button" class="' + (st === 2 ? "on" : "") + '" data-ol-all="2" aria-pressed="' + (st === 2) + '" title="Hiện mờ tất cả nhóm">Mờ</button></span></div>'; };
    P.el.hidden = false;
    P.el.innerHTML = '<div class="ol-lg-hd"><button type="button" class="ol-lg-h' + (open ? " open" : "") + '" data-ol-lgt="1" aria-expanded="' + open + '"><span class="ol-lg-ht">Lệnh · ' + rows.length + " nhóm" + (nsel ? " · hiện " + nsel : " · đang ẩn") + '</span></button>' +
      '<button type="button" class="ol-lg-tgb" data-ol-lgt="1" aria-label="' + (open ? "Thu gọn" : "Mở") + ' danh sách"><span class="ol-lg-tg"><span class="ol-lg-tx">' + (open ? "Thu gọn" : "Mở ra") + '</span><svg class="ol-lg-ch' + (open ? " open" : "") + '" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></span></button></div>' +
      (open ? master(keys.length, allSt) + '<div class="ol-lg-b">' + (nsel ? "" : '<p class="ol-lg-hint">Đang ẩn hết · chọn Hiện hoặc Mờ ở từng nhóm để đưa lên các khung</p>') + rows.join("") + '<p class="ol-lg-hint">Chỉ xem · sửa/dời lệnh ở biểu đồ một khung.</p></div>' : "");
    P.S.sig = "";
  }
  function repaintAll() { insts.forEach(applySel); insts.forEach(function (S) { if (S.P) renderPanel(S.P); }); }
  function mkPanel(S) {
    var el = document.createElement("div"); el.className = "ol-lg ol-mc-lg"; el.hidden = true;
    var P = { S: S, sym: S.sym, res: S.res, el: el }; S.box.appendChild(el);
    el.addEventListener("click", function (e) {
      var b = e.target.closest("[data-ol-all],[data-ol-st],[data-ol-g],[data-ol-lgt]"); if (!b || b.disabled) return;
      var m = memOf(P.sym);
      if (b.dataset.olLgt) { m.mcOpen = m.mcOpen || {}; m.mcOpen[P.res] = !openOf(P); renderPanel(P); return; }
      if (b.dataset.olAll != null) { var av = +b.dataset.olAll; (P.keys || []).forEach(function (k) { if (av) m.sel[k] = av === 2 ? 2 : 1; else delete m.sel[k]; }); }
      else if (b.dataset.olSt) { var v = +b.dataset.olV === 2 ? 2 : 1, k0 = b.dataset.olSt; if (m.sel[k0] === v) delete m.sel[k0]; else m.sel[k0] = v; }
      else { var k = b.dataset.olG; if (m.sel[k]) delete m.sel[k]; else m.sel[k] = 1; }
      repaintAll(); /* ô tích dùng chung → mọi khung cập nhật cùng lúc */
    });
    return P;
  }
  function refreshAll() {
    insts.forEach(build);
    var seen = {}; insts.forEach(function (S) { if (!seen[S.sym]) { seen[S.sym] = 1; syncSel(S.sym, snap(S.sym)); } });
    repaintAll();
  }

  window.addEventListener("nhip:mc-chart-built", function (e) {
    var d = e && e.detail; if (!d || !d.k || !d.box) return;
    if (!d.box.closest || !d.box.closest(".tp")) return; /* chỉ mục Giao dịch */
    var sym = String(d.sym || "").toUpperCase();
    insts = insts.filter(function (S) { if (S.box === d.box) { try { S.layer.remove(); if (S.P) S.P.el.remove(); } catch (x) { } return false; } return true; });
    if (!/^[A-Z0-9.]{2,12}$/.test(sym) || (window.NHIPPF && window.NHIPPF.isIdx && window.NHIPPF.isIdx(sym))) return; /* chỉ số: không có lệnh */
    if (getComputedStyle(d.box).position === "static") d.box.style.position = "relative";
    var layer = mk("ol-layer ol-ro"); d.box.appendChild(layer);
    var S = { k: d.k, box: d.box, sym: sym, res: d.res, layer: layer, items: [], sig: "", P: null };
    S.P = mkPanel(S); insts.push(S); build(S); syncSel(sym, snap(sym)); applySel(S); renderPanel(S.P);
    O.ensure().then(function () { ready = true; if (insts.indexOf(S) >= 0) refreshAll(); }).catch(function () { });
    if (!raf) raf = requestAnimationFrame(loop);
  });
  ["nhip:orders-changed", "nhip:trade-sel", "nhip:portfolio-changed"].forEach(function (n) { window.addEventListener(n, refreshAll); });
})();
