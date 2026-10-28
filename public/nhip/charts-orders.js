/* NHIP · Lệnh chờ trên biểu đồ (v1.70)
   Vẽ lớp DOM phủ lên biểu đồ KLineChart: mỗi lệnh chờ của MÃ đang xem (chờ mua · take profit · stop loss) là một đường ngang + nhãn;
   cộng đường GIÁ VỐN khi đang giữ. Kéo nhãn lên/xuống để dời giá (tự bám bước giá sàn), bấm nhãn để sửa giá/KL hoặc xóa,
   nút ＋ ở góc để thêm nhiều đợt (bấm vào biểu đồ chọn mức giá). Mọi kiểm tra theo NHIPOrders.validate (quy tắc cổ phiếu VN).
   v1.73: lệnh CHỜ MUA có TP/SL gắn kèm (sau khi mua khớp) cũng vẽ thành 2 đường riêng "TP sau mua" / "SL sau mua" (nét chấm, kéo được, ✕ gỡ riêng từng mức); popup sửa/thêm chờ mua có thêm ô Take profit + Stop loss.
   Danh mục lấy từ danh mục đang chọn ở phiếu lệnh (localStorage nhip.trade.v1). Không có API KLineChart nào ngoài
   convertToPixel / convertFromPixel / getSize / getDataList (đã dùng ở charts-draw.js). */
(function () {
  "use strict";
  var O = window.NHIPOrders; if (!O) return;
  var L = null, symsP = null, symsH = "";
  var nf = function (v, d) { return v == null || !isFinite(v) ? "—" : Number(v).toLocaleString("vi-VN", { maximumFractionDigits: d || 0 }); };
  var esc = O.esc || function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var toast = function (m, e) { try { window.NHIPPF.toast(m, e); } catch (x) { } };
  var sc = function (p) { p = Number(p); return p > 0 && p < 1000 ? p * 1000 : p; };
  var LBL = { buy: "Chờ mua", tp: "TP", sl: "SL", cost: "Giá vốn", btp: "TP sau mua", bsl: "SL sau mua" };
  var EXIT_K = { btp: "tp", bsl: "sl" }; /* loại đường con → trường trên lệnh chờ mua */
  var num = function (v) { var n = window.NHIPPF && window.NHIPPF.pnum ? window.NHIPPF.pnum(v) : parseFloat(String(v).replace(/\./g, "").replace(",", ".")); return isNaN(n) ? 0 : n; };

  /* v1.73.2: sàn = khách chọn tay → danh bạ mã (NHIPSYM, có trường sàn) → HOSE. /api/symbols không có trường sàn nên không dựa vào đó. */
  function exchFor(sym) {
    var hx = window.NHIPHouse && window.NHIPHouse.cur ? window.NHIPHouse.cur() : ""; if (!symsP || symsH !== hx) { symsH = hx; symsP = fetch("/api/symbols").then(function (r) { return r.ok ? r.json() : { items: [] }; }).then(function (j) { return j.items || []; }).catch(function () { return []; }); }
    return Promise.all([symsP, O.dirReady ? O.dirReady() : null]).then(function (a) { var it = a[0].filter(function (x) { return (x.symbol || x.code) === sym; })[0]; return O.effEx(sym, it); });
  }
  function loadQuote(S) {
    var sym = S.sym;
    return Promise.all([exchFor(sym), fetch("/api/quotes?symbols=" + encodeURIComponent(sym)).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })]).then(function (a) {
      if (!L || L !== S) return; var it = a[1] && (a[1].items || [])[0], last = null, ref = null;
      if (it && !it.error && it.price != null) { var f = Number(it.price) > 0 && Number(it.price) < 1000 ? 1000 : 1; last = Number(it.price) * f; if (it.change != null) ref = last - Number(it.change) * f; }
      if (!(last > 0)) { var d = dataList(S); if (d.length) last = d[d.length - 1].close; }
      var live = !!(it && !it.error && it.price != null); /* chỉ giá THẬT từ API mới dùng để tự khớp (không dùng giá đóng nến cũ) */
      S.q = { last: last, ref: ref, exch: a[0] }; S.items && build(S); drawBar(S);
      runAuto(S, live);
    });
  }
  /* v2.11 — Giá cập nhật → lệnh chờ mua / TP / SL đã chạm giá tự khớp (không cần bấm "Ghi khớp"). Sau khi khớp, sự kiện danh mục vẽ lại biểu đồ. */
  function runAuto(S, live) {
    if (!O.autoRun || L !== S) return;
    O.ensure().then(function () { if (L !== S) return; return O.autoRun(S.sym, { last: live ? S.q.last : 0 }, candles(S)); }).then(function (r) { if (r && r.fills && r.fills.length && L === S) { drawBar(S); build(S); } }).catch(function () { });
  }
  /* v2.11.2 — lọc nhóm: tích chọn nhiều nhóm; nhóm KHÔNG tích → "Mờ" hoặc "Ẩn" (chọn ở góc trên bên phải chú giải). Không tích nhóm nào = hiện đủ. */
  var MODEK = "nhip.ol.mode2", MEM = window.NHIPOLMem = window.NHIPOLMem || {}; /* MEM: nhớ ô đã tích theo mã trong phiên (đổi khung thời gian không mất) */
  function loadMode() { try { return window.localStorage.getItem(MODEK) === "dim" ? "dim" : "hide"; } catch (e) { return "hide"; } } /* v2.14: hide = nút "Hiện" (chỉ hiện nhóm đã tích) · dim = nút "Mờ" (nhóm khác hiện mờ) · mặc định hide */
  function selCount(S) { return Object.keys(S.sel || {}).length; }
  function toggleSel(S, key, v) { if (!key) return; v = v === 2 ? 2 : 1; if (S.sel[key] === v) delete S.sel[key]; else S.sel[key] = v; /* v2.15: mỗi nhóm chỉ một trong hai: Hiện (1) hoặc Mờ (2); bấm lại nút đang chọn = bỏ chọn (không hiện) */ S.hv = null; drawLegend(S); applyHl(S); S.sig = ""; pos_(S, true); }
  function dataList(S) { try { return S.k.getDataList() || []; } catch (e) { return []; } }
  function candles(S) { return S.res === "D" ? dataList(S).map(function (c) { return { time: c.timestamp / 1000, low: c.low, high: c.high, close: c.close }; }) : null; }

  function geo(S) {
    var W = S.el.clientWidth, H = S.el.clientHeight, m = null;
    try { m = S.k.getSize("candle_pane", "main"); } catch (e) { }
    return { w: W, mw: m && m.width ? m.width : Math.max(80, W - 64), mh: m && m.height ? m.height : Math.round(H * 0.62) };
  }
  function yOf(S, price) { try { var r = S.k.convertToPixel([{ value: price }], { paneId: "candle_pane" })[0]; return r && isFinite(r.y) ? r.y : null; } catch (e) { return null; } }
  function priceAt(S, y) { try { var r = S.k.convertFromPixel([{ x: 10, y: y }], { paneId: "candle_pane" })[0]; return r && isFinite(r.value) ? r.value : null; } catch (e) { return null; } }

  /* ---------- Dựng ---------- */
  function mk(cls, html) { var d = document.createElement("div"); d.className = cls; if (html != null) d.innerHTML = html; return d; }
  function init(det) {
    destroy(); if (!det || !det.k || !det.el) return;
    if (typeof location !== "undefined" && !/^#\/giao-dich/.test(location.hash || "")) return; /* lệnh chờ chỉ hiện trên biểu đồ ở mục Giao dịch, không hiện ở Biểu đồ / Phân tích */
    var cs = getComputedStyle(det.el); if (cs.position === "static") det.el.style.position = "relative";
    var layer = mk("ol-layer"); det.el.appendChild(layer);
    L = { k: det.k, el: det.el, sym: String(det.sym || "").toUpperCase(), res: det.res, layer: layer, q: { last: null, ref: null, exch: O.effEx(String(det.sym || "").toUpperCase()) }, items: [], sig: "", raf: 0, timer: 0, pop: null, pick: null };
    if (!/^[A-Z0-9.]{2,12}$/.test(L.sym) || (window.NHIPPF && window.NHIPPF.isIdx && window.NHIPPF.isIdx(L.sym))) { destroy(); return; } /* chỉ số: không có lệnh chờ */
    var S = L; S.bar = mk("ol-bar"); layer.appendChild(S.bar); S.cap = mk("ol-cap"); S.cap.hidden = true; layer.appendChild(S.cap);
    S.lg = mk("ol-lg"); S.lg.style.display = "none"; layer.appendChild(S.lg); S.lgOpen = (det.el.clientWidth || 800) > 600; S.mem = MEM[S.sym] || (MEM[S.sym] = { sel: {}, seen: {}, done: false }); S.sel = S.mem.sel; S.hv = null;
    layer.addEventListener("mouseover", onHover); layer.addEventListener("mouseleave", function () { if (L && L.hv) { L.hv = null; applyHl(L); } });
    layer.addEventListener("pointerdown", onDown); layer.addEventListener("click", onClick);
    S.lgPos = loadLgPos(); S.lg.addEventListener("pointerdown", onLgDown);
    S.lg.addEventListener("click", function (e) { if (Date.now() - (S.lgMoved || 0) < 400) { e.stopPropagation(); e.preventDefault(); } }, true); /* vừa kéo xong: không coi là bấm nút */
    S.lg.addEventListener("dblclick", function (e) { if (e.target.closest && e.target.closest(".ol-lg-grip")) { S.lgPos = null; saveLgPos(null); S.sig = ""; pos_(S, true); } });
    S.cap.addEventListener("click", onCap);
    var d = dataList(S); if (d.length) S.q.last = d[d.length - 1].close;
    drawBar(S); build(S); loadQuote(S); O.ensure().then(function () { if (L === S) { drawBar(S); build(S); } });
    S.timer = setInterval(function () { if (L === S && !document.hidden) loadQuote(S); }, 60000);
    var tick = function () { if (L !== S) return; if (!S.el.isConnected) { destroy(); return; } if (!document.hidden) pos_(S, false); S.raf = requestAnimationFrame(tick); };
    S.raf = requestAnimationFrame(tick);
  }
  function destroy() {
    if (!L) return; var S = L; L = null; if (S.raf) cancelAnimationFrame(S.raf); if (S.timer) clearInterval(S.timer);
    try { if (S.pop) { S.pop.remove(); S.pop = null; } } catch (e) { } try { S.layer.remove(); } catch (e) { }
  }
  function cur() { return O.cur(); }
  function holding(S) { var p = cur(); return p ? p.positions.filter(function (x) { return x.symbol === S.sym; })[0] || null : null; }

  function drawBar(S) {
    var p = cur(), pos = holding(S), pk = S.pick;
    S.bar.innerHTML = pk ? '<span class="ol-hint">Chạm vào biểu đồ để chọn mức giá ' + esc(O.KINDS[pk].toLowerCase()) + (S.pickG && groupByKey(S, S.pickG) ? " cho nhóm " + esc(groupByKey(S, S.pickG).code) : "") + '</span><button type="button" data-ol-cancel="1">Hủy</button>' :
      '<span class="ol-bt" title="Lệnh chờ của ' + esc(S.sym) + " trên sàn " + esc(O.exName(S.q.exch)) + (p ? "" : ". Chọn khách hàng và danh mục trong phiếu lệnh") + ". Sổ lệnh nội bộ, không gửi tới công ty chứng khoán; trạng thái chạm giá suy ra từ nến OHLC" + '"><b>' + esc(S.sym) + "</b>" + O.exTag(S.sym) + "</span>" +
      '<button type="button" class="ol-b-buy" data-ol-add="buy">＋ Chờ mua</button>' +
      '<button type="button" class="ol-b-tp" data-ol-add="tp"' + (pos ? "" : ' disabled title="Cần đang giữ cổ phiếu (không bán khống)"') + ">＋ TP</button>" +
      '<button type="button" class="ol-b-sl" data-ol-add="sl"' + (pos ? "" : ' disabled title="Cần đang giữ cổ phiếu (không bán khống)"') + ">＋ SL</button>";
    S.bar.style.display = pk ? "" : "none"; /* ẩn thanh mã + Chờ mua/TP/SL trên mọi biểu đồ; chỉ hiện gợi ý khi đang chọn giá */
    S.cap.hidden = !pk;
  }

  function build(S) {
    if (L !== S) return; S.items.forEach(function (i) { i.line.remove(); i.tag.remove(); }); S.items = [];
    var p = cur(), cd = candles(S), pos = holding(S), list = O.list(S.sym).slice(), G = O.groups(list, S.sym), HG = O.holdGroup();
    S.pos0 = pos; S.lgd = { list: list, G: G, pos: pos };
    if (pos) S.items.push(mkItem(S, { type: "cost", price: Math.round(pos.cost), qty: pos.qty, g: HG }, null));
    list.forEach(function (o) {
      S.items.push(mkItem(S, { type: o.kind, price: o.price, qty: o.qty, id: o.id, tp: o.tp, sl: o.sl, g: o.kind === "buy" ? G[o.id] : O.exitGroup(o) }, O.hit(o, 0, cd)));
      if (o.kind === "buy") { /* TP/SL gắn kèm lệnh chờ mua: mỗi mức một đường riêng, chỉ hiệu lực sau khi mua khớp */
        [["btp", +o.tp], ["bsl", +o.sl]].forEach(function (a) { if (a[1] > 0) S.items.push(mkItem(S, { type: a[0], price: a[1], qty: o.qty, pid: o.id, buyPx: o.price, g: G[o.id] }, null)); });
      }
    });
    if (p) { /* v2.11.3: mặc định ẨN HẾT; nhóm MỚI xuất hiện sau đó (lệnh chờ mua vừa đặt; nhóm "Giữ X" sinh ra từ nhóm đã tích) tự được tích để thấy ngay */
      var m = S.mem, ks = {}; S.items.forEach(function (i) { if (i.gk) ks[i.gk] = 1; });
      Object.keys(ks).forEach(function (k) { if (m.seen[k]) return; m.seen[k] = 1; if (!m.done) return; if (k.indexOf("g:") === 0) { if (S.sel[k.slice(2)]) S.sel[k] = S.sel[k.slice(2)]; } else S.sel[k] = 1; }); /* v2.18: nhóm MỚI (kể cả \"Giữ\" vừa có vị thế) tự hiện */
      m.done = true;
      Object.keys(S.sel).forEach(function (k) { if (!ks[k]) { delete S.sel[k]; delete m.seen[k]; } }); /* v2.18: nhóm biến mất thì quên luôn \"đã thấy\" → khi xuất hiện lại được xem là nhóm mới (trước đây bị ẩn vĩnh viễn) */
    }
    drawLegend(S); applyHl(S); S.sig = ""; pos_(S);
    if (p == null) { /* chưa chọn danh mục: chỉ hiện nút */ }
  }
  function mkItem(S, it, h) {
    var line = mk("ol-line ol-t-" + it.type + (h && !h.uncertain ? " is-hit" : "") + (h && h.uncertain ? " is-uncertain" : "")), tag = mk("ol-tag ol-t-" + it.type + (h && !h.uncertain ? " is-hit" : "") + (h && h.uncertain ? " is-uncertain" : ""));
    it.hit = h; it.line = line; it.tag = tag; it.cost = it.type === "cost";
    if (it.g) { it.gk = it.g.key; [line, tag].forEach(function (e) { e.classList.add("ol-g"); e.style.setProperty("--ol-g", it.g.color); }); }
    S.layer.insertBefore(line, S.bar); S.layer.insertBefore(tag, S.bar); fillTag(S, it); return it;
  }
  function fillTag(S, it) {
    var t = it.tag, ch = it.g ? O.chip(it.g) : "", AR = { tp: "▲ ", btp: "▲ ", sl: "▼ ", bsl: "▼ " }, dpc = function (d) { return d == null ? "" : '<span class="ol-d ' + (d >= 0 ? "up" : "dn") + '">' + (d > 0 ? "+" : "") + nf(d, 1) + "%</span>"; };
    if (it.cost) { var pl = S.q.last > 0 && it.price > 0 ? (S.q.last / it.price - 1) * 100 : null; t.innerHTML = ch + '<span class="ol-lbl">Giá vốn</span><b class="ol-px">' + nf(it.price) + '</b><span class="ol-q">' + nf(it.qty) + " cp" + (pl != null ? ' · <i class="' + (pl >= 0 ? "up" : "dn") + '">' + (pl > 0 ? "+" : "") + nf(pl, 1) + "%</i>" : "") + "</span>"; return; }
    if (it.pid) { /* đường TP/SL sau mua */
      var dp = it.buyPx > 0 ? (it.price / it.buyPx - 1) * 100 : null;
      t.title = "Nhóm " + (it.g ? it.g.code : "") + " · " + LBL[it.type] + " " + nf(it.price) + (dp != null ? " (" + (dp > 0 ? "+" : "") + nf(dp, 1) + "% so với giá mua " + nf(it.buyPx) + ")" : "") + " · chỉ hiệu lực sau khi lệnh chờ mua khớp";
      t.innerHTML = '<span class="ol-grip" aria-hidden="true">⋮⋮</span>' + ch + '<span class="ol-lbl">' + AR[it.type] + LBL[it.type] + '</span><b class="ol-px">' + nf(it.price) + '</b><span class="ol-q">×' + nf(it.qty) + '</span>' + dpc(dp) + '<button type="button" class="ol-x" data-ol-clr="' + it.pid + ':' + EXIT_K[it.type] + '" aria-label="Gỡ ' + LBL[it.type] + '">✕</button>';
      return;
    }
    var hp = S.pos0 && S.pos0.cost > 0 && (it.type === "tp" || it.type === "sl") ? (it.price / S.pos0.cost - 1) * 100 : null;
    if (hp != null) t.title = (it.type === "tp" ? "Take profit " : "Stop loss ") + nf(it.price) + " (" + (hp > 0 ? "+" : "") + nf(hp, 1) + "% so với giá vốn " + nf(Math.round(S.pos0.cost)) + ") · thuộc phần ĐANG GIỮ";
    else if (it.type === "buy") t.title = "Chờ mua nhóm " + (it.g ? it.g.code : "") + " @ " + nf(it.price) + " — TP/SL gắn kèm có cùng mã nhóm và màu";
    t.innerHTML = '<span class="ol-grip" aria-hidden="true">⋮⋮</span>' + ch + '<span class="ol-lbl">' + (AR[it.type] || "") + LBL[it.type] + (it.hit ? (it.hit.uncertain ? " · chưa xác định" : (it.hit.status === "price_beyond" ? " · giá vượt ngưỡng" : " · chạm giá")) : "") + '</span><b class="ol-px">' + nf(it.price) + '</b><span class="ol-q">×' + nf(it.qty) + '</span>' + dpc(hp) + '<button type="button" class="ol-x" data-ol-del="' + it.id + '" aria-label="Xóa lệnh">✕</button>';
  }
  /* v2.10 — Chú giải: mỗi nhóm một dòng (Giữ · A · B …) liệt kê giá mua và TP/SL của nhóm; rê chuột / bấm dòng = làm mờ các nhóm khác */
  function drawLegend(S) {
    var lg = S.lg, d = S.lgd; if (!lg || !d) return;
    var buys = d.list.filter(function (o) { return o.kind === "buy"; }), ex = d.list.filter(function (o) { return o.kind === "tp" || o.kind === "sl"; });
    if (!buys.length && !ex.length && !d.pos) { lg.style.display = "none"; S.lgOn = false; return; } /* v2.18: đang GIỮ cổ phiếu (đã khớp/mua) cũng là có giao dịch → vẫn hiện bảng; chỉ ẩn khi không có lệnh chờ lẫn vị thế */
    S.lgOn = true; lg.style.display = "";
    var HG = O.holdGroup(), byG = {}, order = [];
    if (d.pos || ex.some(function (o) { return !o.grp; })) { byG.hold = { g: HG, tp: [], sl: [] }; order.push("hold"); }
    ex.forEach(function (o) { var g = O.exitGroup(o); if (!byG[g.key]) { byG[g.key] = { g: g, tp: [], sl: [] }; order.push(g.key); } byG[g.key][o.kind].push(o); });
    var fx = function (arr, cls, lab, rev) { return arr.slice().sort(function (a, b) { return rev ? b.price - a.price : a.price - b.price; }).map(function (x) { return ' <em class="' + cls + '">' + lab + " " + nf(x.price) + "×" + nf(x.qty) + "</em>"; }).join(""); };
    var addB = function (key) { return '<span class="ol-lg-a"><button type="button" class="up" data-ol-addx="tp" data-ol-gk="' + esc(key) + '" title="Thêm Take profit cho nhóm này"' + (d.pos ? "" : " disabled") + '>＋TP</button><button type="button" class="dn" data-ol-addx="sl" data-ol-gk="' + esc(key) + '" title="Thêm Stop loss cho nhóm này"' + (d.pos ? "" : " disabled") + ">＋SL</button></span>"; };
    var rows = [], ck = function (k) { var st = S.sel[k] || 0; return '<span class="ol-lg-vm" role="group" aria-label="Cách hiển thị nhóm này"><button type="button" class="' + (st === 1 ? "on" : "") + '" data-ol-st="' + esc(k) + '" data-ol-v="1" aria-pressed="' + (st === 1) + '" title="Hiện nhóm này trên biểu đồ (bấm lại để bỏ chọn)">Hiện</button><button type="button" class="' + (st === 2 ? "on" : "") + '" data-ol-st="' + esc(k) + '" data-ol-v="2" aria-pressed="' + (st === 2) + '" title="Hiện mờ nhóm này (bấm lại để bỏ chọn)">Mờ</button></span>'; };
    order.forEach(function (key) {
      var b = byG[key], g = b.g, main = key === "hold" ? (d.pos ? nf(d.pos.qty) + " cp · vốn " + nf(Math.round(d.pos.cost)) : "Đang giữ") : "mua " + (g.gpx ? nf(g.gpx) : "") + " · đã khớp";
      rows.push('<div class="ol-lg-r" data-ol-g="' + esc(key) + '" style="--ol-g:' + g.color + '" title="' + esc(g.tip || "Phần cổ phiếu đang giữ") + ' — bấm để chọn / bỏ chọn nhóm này">' + ck(key) + O.chip(g) + '<span class="ol-lg-t"><b>' + main + "</b>" + fx(b.tp, "up", "▲TP", false) + fx(b.sl, "dn", "▼SL", true) + "</span>" + addB(key) + "</div>");
    });
    buys.forEach(function (o) {
      var g = d.G[o.id]; rows.push('<div class="ol-lg-r" data-ol-g="' + esc(o.id) + '" style="--ol-g:' + g.color + '" title="Lệnh chờ mua nhóm ' + g.code + ' — bấm để chọn / bỏ chọn nhóm này">' + ck(o.id) + O.chip(g) + '<span class="ol-lg-t"><b>Mua ' + nf(o.price) + "</b> ×" + nf(o.qty) + (o.tp > 0 ? ' <em class="up">▲TP ' + nf(o.tp) + "</em>" : "") + (o.sl > 0 ? ' <em class="dn">▼SL ' + nf(o.sl) + "</em>" : "") + '</span><span class="ol-lg-a"><button type="button" class="up" data-ol-edit="' + esc(o.id) + '" data-ol-ef="tp" title="Đặt/sửa TP sau mua của lệnh này">＋TP</button><button type="button" class="dn" data-ol-edit="' + esc(o.id) + '" data-ol-ef="sl" title="Đặt/sửa SL sau mua của lệnh này">＋SL</button><button type="button" class="ol-lg-e" data-ol-edit="' + esc(o.id) + '" aria-label="Sửa lệnh nhóm ' + g.code + '" title="Sửa lệnh này">✎</button></span></div>');
    });
    var au = O.autoOn && O.autoOn();
    var nsel = selCount(S), keys = order.concat(buys.map(function (o) { return o.id; })), sts = keys.map(function (k) { return S.sel[k] || 0; }), allSt = keys.length && sts.every(function (v) { return v === sts[0]; }) ? sts[0] : -1;
    S.lgKeys = keys;
    var master = function (n, st) { return '<div class="ol-lg-all" role="group" aria-label="Áp dụng cho tất cả nhóm"><span class="ol-lg-al">Tất cả</span><span class="ol-lg-vm ol-lg-vm3"><button type="button" class="' + (st === 0 ? "on" : "") + '" data-ol-all="0" aria-pressed="' + (st === 0) + '" title="Ẩn tất cả nhóm khỏi biểu đồ">Ẩn</button><button type="button" class="' + (st === 1 ? "on" : "") + '" data-ol-all="1" aria-pressed="' + (st === 1) + '" title="Hiện tất cả nhóm">Hiện</button><button type="button" class="' + (st === 2 ? "on" : "") + '" data-ol-all="2" aria-pressed="' + (st === 2) + '" title="Hiện mờ tất cả nhóm">Mờ</button></span></div>'; };
        lg.innerHTML = '<div class="ol-lg-hd"><span class="ol-lg-grip" title="Kéo để dời bảng · bấm đúp để về góc phải-dưới" aria-hidden="true">⋮⋮</span><button type="button" class="ol-lg-h' + (S.lgOpen ? " open" : "") + '" data-ol-lgt="1" aria-expanded="' + !!S.lgOpen + '" aria-label="' + (S.lgOpen ? "Thu gọn" : "Mở") + ' danh sách lệnh trên biểu đồ"><span class="ol-lg-ht">Lệnh trên biểu đồ · ' + rows.length + ' nhóm' + (nsel ? ' · hiện ' + nsel : ' · đang ẩn') + '</span></button><button type="button" class="ol-lg-tgb" data-ol-lgt="1" aria-label="' + (S.lgOpen ? "Thu gọn" : "Mở") + ' danh sách"><span class="ol-lg-tg"><span class="ol-lg-tx">' + (S.lgOpen ? "Thu gọn" : "Mở ra") + '</span><svg class="ol-lg-ch' + (S.lgOpen ? " open" : "") + '" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></span></button></div>' + (S.lgOpen ? master(keys.length, allSt) + '<div class="ol-lg-b">' + (nsel ? "" : '<p class="ol-lg-hint">Đang ẩn hết · chọn Hiện hoặc Mờ ở từng nhóm để đưa lên biểu đồ</p>') + rows.join("") + '<button type="button" class="ol-lg-auto' + (au ? " on" : "") + '" data-ol-auto="1" aria-pressed="' + !!au + '" title="Khi giá cập nhật: lệnh chờ mua / TP / SL chạm giá sẽ tự ghi khớp vào danh mục (giá đặt). Tắt thì phải bấm Ghi khớp tay.">⚡ Tự khớp khi chạm giá: ' + (au ? "Bật" : "Tắt") + "</button></div>" : "");
  }
  /* nhóm (đối tượng) theo khóa: "hold" hoặc "g:<id lệnh mua gốc>" */
  function groupByKey(S, gk) {
    if (!gk || gk === "hold") return O.holdGroup();
    var x = S.lgd && S.lgd.list.filter(function (o) { return (o.kind === "tp" || o.kind === "sl") && O.exitGroup(o).key === gk; })[0]; return x ? O.exitGroup(x) : null;
  }
  function applyHl(S) {
    var has = selCount(S) > 0;
    S.items.forEach(function (i) {
      var st = S.sel[i.gk] || 0, hd = !st, dim = st === 2; /* không chọn → không hiện; Hiện → rõ; Mờ → mờ */
      i.hidden = hd; [i.line, i.tag].forEach(function (e) { e.classList.toggle("ol-dim", dim); e.classList.toggle("ol-hide", hd); });
    });
    if (S.lg) Array.prototype.forEach.call(S.lg.querySelectorAll(".ol-lg-r"), function (r) { var key = r.getAttribute("data-ol-g"), st = S.sel[key] || 0; r.classList.toggle("on", !!st); r.classList.toggle("ol-dim", has && !st); });
    S.sig = "";
  }
  function onHover(e) {
    var S = L; if (!S) return; var t = e.target.closest && e.target.closest(".ol-tag,.ol-lg-r"), k = null;
    if (t) { if (t.classList.contains("ol-lg-r")) k = t.getAttribute("data-ol-g"); else { var it = itemOf(S, t); k = it && it.gk || null; } }
    if (S.hv !== k) { S.hv = k; applyHl(S); }
  }
  function pos_(S, force) {
    var g = geo(S), ys = S.items.map(function (i) { return yOf(S, i.price); }), sig = g.w + "|" + g.mw + "|" + g.mh + "|" + ys.join(",");
    if (!force && sig === S.sig) return; S.sig = sig;
    if (S.lg && S.lgOn && !S.lgDrag) { /* v2.48: bảng nhóm nằm TRÊN cùng (z-index cao hơn đường/nhãn lệnh); mặc định góc phải-dưới vùng nến, kéo rê được và nhớ vị trí */
      var pw = S.lg.offsetWidth, ph = S.lg.offsetHeight, H = S.el.clientHeight || g.mh, lx, ty;
      if (S.lgPos) { lx = S.lgPos.l; ty = S.lgPos.t; } else { lx = g.mw - pw - 6; ty = g.mh - ph - 8; }
      lx = Math.max(4, Math.min(lx, g.w - pw - 4)); ty = Math.max(4, Math.min(ty, H - ph - 4));
      S.lg.style.left = lx + "px"; S.lg.style.top = ty + "px"; S.lg.style.right = "auto";
    }
    var order = S.items.map(function (i, n) { return { i: i, y: ys[n] }; }).filter(function (x) { return x.y != null && x.y >= 0 && x.y <= g.mh && !x.i.hidden; });
    S.items.forEach(function (i) { i.line.style.display = "none"; i.tag.style.display = "none"; });
    var right = Math.max(4, g.w - g.mw + 6);
    ["right", "left"].forEach(function (side) {
      var grp = order.filter(function (x) { return (x.i.cost ? "left" : "right") === side; }).sort(function (a, b) { return a.y - b.y; }), prev = -99;
      /* nhãn không được tràn khỏi khung: đẩy dồn lên khi quá sát đáy (khoảng cách tối thiểu 25px) */
      grp.forEach(function (x) { x.ty = Math.max(x.y, prev + 25); prev = x.ty; });
      var lim = g.mh - 12; for (var gi = grp.length - 1; gi >= 0; gi--) { if (grp[gi].ty > lim) grp[gi].ty = lim; lim = grp[gi].ty - 25; }
      grp.forEach(function (x) { var ty = Math.max(12, x.ty), i = x.i; if (S.drag && S.drag.it === i) return;
        i.line.style.display = ""; i.line.style.top = x.y + "px"; i.line.style.width = g.mw + "px";
        i.tag.style.display = ""; i.tag.style.top = (ty - 11) + "px"; if (side === "right") { i.tag.style.right = right + "px"; i.tag.style.left = "auto"; } else { i.tag.style.left = "6px"; i.tag.style.right = "auto"; } });
    });
  }


  /* ---------- v2.48 — kéo rê bảng nhóm lệnh ---------- */
  var LGK = "nhip.ol.lgpos";
  function loadLgPos() { try { var j = JSON.parse(window.localStorage.getItem(LGK) || "null"); return j && isFinite(j.l) && isFinite(j.t) ? { l: +j.l, t: +j.t } : null; } catch (e) { return null; } }
  function saveLgPos(p) { try { if (p) window.localStorage.setItem(LGK, JSON.stringify(p)); else window.localStorage.removeItem(LGK); } catch (e) { } }
  function onLgDown(e) {
    var S = L; if (!S || !S.lg || !e.target.closest || !e.target.closest(".ol-lg-hd")) return; if (e.pointerType === "mouse" && e.button !== 0) return;
    var r = S.lg.getBoundingClientRect(), er = S.el.getBoundingClientRect(), d = { sx: e.clientX, sy: e.clientY, l0: r.left - er.left, t0: r.top - er.top, pw: r.width, ph: r.height, moved: false, l: 0, t: 0 };
    var mv = function (ev) {
      var dx = ev.clientX - d.sx, dy = ev.clientY - d.sy; if (!d.moved && Math.abs(dx) + Math.abs(dy) < 7) return;
      if (!d.moved) { d.moved = true; S.lgDrag = d; S.lg.classList.add("dragging"); }
      var W = S.el.clientWidth, H = S.el.clientHeight;
      d.l = Math.max(4, Math.min(d.l0 + dx, W - d.pw - 4)); d.t = Math.max(4, Math.min(d.t0 + dy, H - d.ph - 4));
      S.lg.style.left = d.l + "px"; S.lg.style.top = d.t + "px"; S.lg.style.right = "auto"; ev.preventDefault();
    };
    var up = function () {
      document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", up);
      if (!d.moved) return; S.lgDrag = null; S.lgMoved = Date.now(); S.lg.classList.remove("dragging");
      if (L === S) { S.lgPos = { l: d.l, t: d.t }; saveLgPos(S.lgPos); S.sig = ""; pos_(S, true); }
    };
    document.addEventListener("pointermove", mv, { passive: false }); document.addEventListener("pointerup", up); document.addEventListener("pointercancel", up);
  }

  /* ---------- Kéo / bấm ---------- */
  function itemOf(S, el) { for (var i = 0; i < S.items.length; i++) if (S.items[i].tag === el) return S.items[i]; return null; }
  function onDown(e) {
    var S = L; if (!S || S.pop && S.pop.contains(e.target)) return; var tag = e.target.closest(".ol-tag"); if (!tag || e.target.closest(".ol-x")) return; var it = itemOf(S, tag); if (!it || it.cost) return; var par = it.pid ? S.items.filter(function (x) { return x.id === it.pid; })[0] : null; if (it.pid && !par) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    var g = geo(S), y0 = yOf(S, it.price); if (y0 == null) return;
    S.drag = { it: it, sy: e.clientY, y0: y0, moved: false, price: it.price, g: g }; try { tag.setPointerCapture(e.pointerId); } catch (x) { }
    var mv = function (ev) {
      var d = S.drag; if (!d) return; var dy = ev.clientY - d.sy; if (!d.moved && Math.abs(dy) < 5) return; d.moved = true; tag.classList.add("dragging"); it.line.classList.add("dragging");
      var y = Math.max(0, Math.min(d.g.mh, d.y0 + dy)), pr = priceAt(S, y); if (pr == null) return; d.price = O.snap(pr, S.q.exch, 0);
      it.line.style.display = ""; it.tag.style.display = ""; it.line.style.top = y + "px"; it.line.style.width = d.g.mw + "px"; it.tag.style.top = (y - 11) + "px"; it.tag.style.right = Math.max(4, d.g.w - d.g.mw + 6) + "px";
      var px = it.tag.querySelector(".ol-px"); if (px) px.textContent = nf(d.price);
      var r = chk(S, it.pid ? buyObj(par, EXIT_K[it.type], d.price) : { id: it.id, kind: it.type, sym: S.sym, price: d.price, qty: it.qty }); tag.classList.toggle("bad", !!(r && r.errors.length));
    };
    var up = function (ev) {
      tag.removeEventListener("pointermove", mv); tag.removeEventListener("pointerup", up); tag.removeEventListener("pointercancel", up); try { tag.releasePointerCapture(ev.pointerId); } catch (x) { }
      var d = S.drag; S.drag = null; tag.classList.remove("dragging", "bad"); it.line.classList.remove("dragging"); if (!d) return;
      if (!d.moved) { if (!it.pid && (it.type === "tp" || it.type === "sl") && window.NHIPTpSl) { openTpSl(S, { kind: it.type }); return; } openPop(S, { mode: "edit", it: par || it, focus: it.pid ? EXIT_K[it.type] : null }); return; }
      if (d.price === it.price) { pos_(S, true); return; }
      var patch = {}; if (it.pid) patch[EXIT_K[it.type]] = d.price; else patch.price = d.price;
      O.update(it.pid || it.id, patch, S.q).then(function (r) { if (!r.ok && r.err) toast(r.err, 1); else if (r.ok) toast("Đã dời " + LBL[it.type] + " " + S.sym + " → " + nf(d.price)); if (L === S) build(S); });
    };
    tag.addEventListener("pointermove", mv); tag.addEventListener("pointerup", up); tag.addEventListener("pointercancel", up); e.preventDefault();
  }
  /* Lệnh chờ mua giả định để kiểm tra khi dời một mức TP/SL sau mua */
  function buyObj(par, k, v) { var o = { id: par.id, kind: "buy", sym: L ? L.sym : "", price: par.price, qty: par.qty, tp: par.tp, sl: par.sl }; o[k] = v; return o; }
  function chk(S, o) { var p = cur(); return p ? O.validate(o, O.ctxFor(p, o, S.q)) : null; }
  function onClick(e) {
    var S = L; if (!S) return; var ct = e.target.closest(".ol-tag"); if (ct && !e.target.closest(".ol-x")) { var ci = itemOf(S, ct); if (ci && ci.cost) { openTpSl(S, null); return; } } /* v2.40: bấm thẻ Giá vốn → bảng đặt TP/SL */
    var b = e.target.closest("[data-ol-add],[data-ol-del],[data-ol-cancel],[data-ol-clr],[data-ol-g],[data-ol-lgt],[data-ol-edit],[data-ol-addx],[data-ol-auto],[data-ol-ck],[data-ol-st],[data-ol-all]"); if (!b || b.disabled) return;
    if (b.dataset.olAll != null) { var av = +b.dataset.olAll; (S.lgKeys || []).forEach(function (k) { if (av) S.sel[k] = av === 2 ? 2 : 1; else delete S.sel[k]; }); S.hv = null; drawLegend(S); applyHl(S); S.sig = ""; pos_(S, true); return; } /* nút tổng: 0 = ẩn hết · 1 = hiện hết · 2 = mờ hết */
    if (b.dataset.olSt) { toggleSel(S, b.dataset.olSt, +b.dataset.olV); return; }
    if (b.dataset.olAuto) { var on = !(O.autoOn && O.autoOn()); O.setAuto(on); toast(on ? "Đã bật tự khớp khi chạm giá" : "Đã tắt tự khớp — lệnh chạm giá sẽ chờ bạn bấm Ghi khớp"); drawLegend(S); if (on) runAuto(S, S.q && S.q.last > 0); return; }
    if (b.dataset.olAddx) { if (!cur()) { toast("Chọn khách hàng và danh mục trong phiếu lệnh (trang Giao dịch) để đặt lệnh chờ", 1); return; } closePop(S); S.pick = b.dataset.olAddx; S.pickG = b.dataset.olGk || null; drawBar(S); return; }
    if (b.dataset.olLgt) { S.lgOpen = !S.lgOpen; drawLegend(S); applyHl(S); S.sig = ""; pos_(S); return; }
    if (b.dataset.olEdit) { var ei = S.items.filter(function (x) { return x.id === b.dataset.olEdit && !x.pid; })[0]; if (ei) { closePop(S); openPop(S, { mode: "edit", it: ei, focus: b.dataset.olEf || null }); } return; }
    if (b.dataset.olCk || b.dataset.olG) { toggleSel(S, b.dataset.olCk || b.dataset.olG); return; }
    if (b.dataset.olClr) { var pr = b.dataset.olClr.split(":"), pt = {}; pt[pr[1]] = 0; O.update(pr[0], pt, S.q).then(function (r) { if (r.ok) toast("Đã gỡ " + (pr[1] === "tp" ? "Take profit" : "Stop loss") + " sau mua"); else if (r.err) toast(r.err, 1); }); return; }
    if (b.dataset.olCancel) { S.pick = null; S.pickG = null; drawBar(S); return; }
    if (b.dataset.olDel) { var o = O.list(S.sym).filter(function (x) { return x.id === b.dataset.olDel; })[0]; if (o) NhipDlg.confirmOrder({ kind: O.KINDS[o.kind], sym: o.sym, qty: o.qty, price: o.price }).then(function (ok) { if (ok) O.remove(o.id).then(function (r) { if (r.ok) toast("Đã xóa lệnh chờ"); else if (r.err) toast(r.err, 1); }); }); return; }
    if (b.dataset.olAdd) {
      if (!cur()) { toast("Chọn khách hàng và danh mục trong phiếu lệnh (trang Giao dịch) để đặt lệnh chờ", 1); return; }
      closePop(S); S.pick = b.dataset.olAdd; drawBar(S);
    }
  }
  /* v2.40 — bảng đặt TP/SL dùng chung với trang Giao dịch (NHIPTpSl). Chỉ cho mã ĐANG GIỮ (không bán khống). */
  function openTpSl(S, o) {
    var p = cur(); if (!p) { toast("Chọn khách hàng và danh mục trong phiếu lệnh (trang Giao dịch) trước", 1); return; }
    if (!holding(S)) { toast("Cần đang giữ " + S.sym + " để đặt TP/SL (không bán khống)", 1); return; }
    if (!window.NHIPTpSl) return; closePop(S);
    window.NHIPTpSl.open({ pid: p.id, symbol: S.sym, kind: o && o.kind, quote: function () { return { last: S.q && S.q.last > 0 ? S.q.last : null, exch: S.q ? S.q.exch : "HOSE" }; },
      onFill: function (ord) { var ev = new CustomEvent("nhip:fill-order", { detail: ord, cancelable: true }); window.dispatchEvent(ev); if (!ev.defaultPrevented) toast("Mở Giao dịch › Danh mục để ghi bán theo mức " + nf(ord.price)); } });
  }
  function onCap(e) {
    var S = L; if (!S || !S.pick) return; var r = S.cap.getBoundingClientRect(), y = e.clientY - r.top, g = geo(S); if (y > g.mh || e.clientX - r.left > g.mw) return;
    var pr = priceAt(S, y); if (pr == null) return; var kind = S.pick, gk = S.pickG; S.pick = null; S.pickG = null; drawBar(S);
    openPop(S, { mode: "add", kind: kind, price: O.snap(pr, S.q.exch, kind === "tp" ? 1 : -1), y: y, gk: gk });
  }

  /* ---------- Hộp sửa / thêm ---------- */
  function closePop(S) { if (S && S.pop) { S.pop.remove(); S.pop = null; } }
  function openPop(S, o) {
    closePop(S); var add = o.mode === "add", it = o.it, kind = add ? o.kind : it.type, p = cur(); if (!p) { toast("Chọn khách hàng và danh mục trong phiếu lệnh trước", 1); return; }
    var pos = holding(S), buy = kind === "buy", st = { price: add ? o.price : it.price, qty: add ? (kind === "buy" ? 100 : Math.max(1, Math.min(pos ? pos.qty : 100, Math.floor((pos ? pos.qty : 100) / 100) * 100 || (pos ? pos.qty : 100)))) : it.qty, tp: add ? 0 : (+it.tp || 0), sl: add ? 0 : (+it.sl || 0) };
    var gx = null; /* nhóm của lệnh đang thêm/sửa: TP/SL thêm vào nhóm nào thì ở đúng nhóm đó */
    if (add) { if ((kind === "tp" || kind === "sl") && o.gk) gx = groupByKey(S, o.gk); } else gx = it.g || null;
    if (add && gx && gx.lot) { var lq = 0; S.lgd.list.forEach(function (x) { if ((x.kind === "tp" || x.kind === "sl") && x.grp === gx.grp) lq = Math.max(lq, x.qty); }); if (lq > 0) st.qty = Math.min(lq, pos ? pos.qty : lq); }
    var pop = mk("ol-pop"); S.pop = pop; (document.body && document.body.appendChild ? document.body : S.layer).appendChild(pop); /* gắn vào <body>: không bị khung/lớp biểu đồ cắt hay đè */
    var g = geo(S), y = add ? o.y : (yOf(S, it.price) || 40);
    function place() { /* popup cố định giữa màn hình, cỡ cố định (nhip-ol-pop.css) — không tính toán vị trí/chiều cao */ }
    /* Mức mặc định khi bấm +/− lúc ô còn trống: TP cao hơn giá mua 7%, SL thấp hơn 5% (bám bước giá sàn) */
    function defExit(k) { return O.snap(st.price * (k === "tp" ? 1.07 : 0.95), S.q.exch, k === "tp" ? 1 : -1); }
    function net(v) { var fee = (isFinite(S.q.feePct) ? S.q.feePct : 0.15) / 100; return Math.round((v * (1 - fee - 0.001) - st.price * (1 + fee)) * st.qty); }
    function tk(v) { return O.tickSize ? O.tickSize(v, S.q.exch) : 50; }
    function xbar(k) { var arr = k === "tp" ? [5, 7, 10, 15] : [3, 5, 7, 10]; return '<div class="ol-chips nx-seg" data-rkind="price" data-rref="[data-p-in=price]" data-rlo="' + (k === "tp" ? 0 : -25) + '" data-rhi="' + (k === "tp" ? 25 : 0) + '" data-rstep="' + tk(st.price) + '" data-rex="' + S.q.exch + '" data-rempty="' + (k === "tp" ? "min" : "max") + '" role="group" aria-label="' + (k === "tp" ? "Take profit" : "Stop loss") + ' so với giá mua">' + arr.map(function (x) { return '<button type="button" class="' + (k === "tp" ? "up" : "dn") + '" data-p="xp:' + k + ":" + (k === "tp" ? "" : "-") + x + '">' + (k === "tp" ? "+" : "−") + x + "%</button>"; }).join("") + "</div>"; }
    function exitField(k) {
      var lab = k === "tp" ? "Take profit (₫)" : "Stop loss (₫)", v = st[k], d = v > 0 && st.price > 0 ? (v / st.price - 1) * 100 : null;
      return '<div class="ol-fg ol-xl-' + k + '"><label>' + lab + '<div class="ol-st"><button type="button" data-p="' + k + 'm">−</button><input data-p-in="' + k + '" inputmode="numeric" placeholder="' + (k === "tp" ? "Tùy chọn · cao hơn giá mua" : "Tùy chọn · thấp hơn giá mua") + '" value="' + (v > 0 ? nf(v) : "") + '"><button type="button" data-p="' + k + 'p">+</button></div></label>' + xbar(k) +
        (v > 0 && st.qty > 0 && st.price > 0 ? '<small class="ol-est ' + (net(v) >= 0 ? "up" : "dn") + '">' + (k === "tp" ? "Chốt lời" : "Cắt lỗ") + " ≈ " + (net(v) > 0 ? "+" : "") + nf(net(v)) + " ₫" + (d != null ? " · " + (d > 0 ? "+" : "") + nf(d, 1) + "% so với giá mua" : "") + "</small>" : "") + "</div>";
    }
    function seg(h, lab, at) { return '<div class="ol-chips nx-seg"' + (at || "") + ' role="group" aria-label="' + lab + '">' + h + "</div>"; }
    function priceSeg() {
      var L = S.q && S.q.last > 0 ? S.q.last : 0; if (!L) return "";
      var bdp = O.band && S.q.ref > 0 ? O.band(S.q.ref, S.q.exch) : null;
      return seg([-5, -3, -1, 0, 1, 3, 5].map(function (x) { return '<button type="button" class="' + (x < 0 ? "dn" : x > 0 ? "up" : "") + '" data-p="pc:' + x + '">' + (x === 0 ? "Giá HT" : (x > 0 ? "+" : "−") + Math.abs(x) + "%") + "</button>"; }).join(""), "Giá so với giá hiện tại", ' data-rkind="price" data-rmin="' + (bdp ? bdp.fl : Math.round(L * 0.9)) + '" data-rmax="' + (bdp ? bdp.ce : Math.round(L * 1.1)) + '" data-rstep="' + tk(L) + '" data-rex="' + S.q.exch + '"');
    }
    function qtySeg() {
      var qm = buy ? Math.max(3000, Math.ceil(st.qty / 1000) * 1000) : (pos ? pos.qty : 0), qa = qm > 0 ? ' data-rkind="qty" data-rmin="0" data-rmax="' + qm + '" data-rstep="100"' : "";
      return buy ? seg([100, 200, 500, 1000].map(function (n) { return '<button type="button" data-p="qa:' + n + '">' + nf(n) + "</button>"; }).join(""), "Chọn nhanh khối lượng", qa)
        : seg([["25%", 0.25], ["50%", 0.5], ["Tất cả", 1]].map(function (x) { return '<button type="button" data-p="qf:' + x[1] + '">' + x[0] + "</button>"; }).join(""), "Chọn nhanh khối lượng", qa);
    }
    function draw() {
      var obj = { id: add ? undefined : it.id, kind: kind, sym: S.sym, price: st.price, qty: st.qty }; if (buy) { obj.tp = st.tp; obj.sl = st.sl; }
      var r = chk(S, obj) || { errors: [], warns: [], infos: [] };
      pop.innerHTML = '<div class="ol-ph"><b class="ol-t-' + kind + '">' + (add ? "Thêm " : "Sửa ") + esc(O.KINDS[kind].toLowerCase()) + " · " + esc(S.sym) + "</b>" + (gx ? O.chip(gx) : "") + O.exTag(S.sym) + '<button type="button" data-p="x" aria-label="Đóng">✕</button></div>' +
        '<div class="ol-fg"><label>Giá đặt (₫)<div class="ol-st"><button type="button" data-p="pm">−</button><input data-p-in="price" inputmode="numeric" value="' + nf(st.price) + '"><button type="button" data-p="pp">+</button></div></label>' + priceSeg() + '</div>' +
        '<div class="ol-fg"><label>Khối lượng (cp)<div class="ol-st"><button type="button" data-p="qm">−</button><input data-p-in="qty" inputmode="numeric" value="' + nf(st.qty) + '"><button type="button" data-p="qp">+</button></div></label>' + qtySeg() + '</div>' +
        (buy ? exitField("tp") + exitField("sl") : "") +
        r.errors.concat(r.warns).map(function (m) { return '<p class="ol-m ' + (r.errors.indexOf(m) >= 0 ? "err" : "warn") + '">' + esc(m) + "</p>"; }).join("") +
        '<div class="ol-pb">' + (add ? "" : '<button type="button" class="ol-del" data-p="del">Xóa</button>') + '<button type="button" class="ol-ok" data-p="ok"' + (r.errors.length ? " disabled" : "") + ">" + (add ? "Đặt lệnh" : "Lưu") + "</button></div>";
      place();
    }
    pop.addEventListener("click", function (e) {
      var b = e.target.closest("[data-p]"); if (!b) return; var a = b.dataset.p;
      if (a === "x") closePop(S);
      else if (a === "pm" || a === "pp") { st.price = O.step(st.price, S.q.exch, a === "pp" ? 1 : -1); draw(); }
      else if (a === "qm" || a === "qp") { st.qty = Math.max(1, st.qty + (a === "qp" ? 100 : -100)); draw(); }
      else if (a === "tpm" || a === "tpp" || a === "slm" || a === "slp") { var k = a.slice(0, 2), dir = a.charAt(2) === "p" ? 1 : -1; st[k] = st[k] > 0 ? Math.max(0, O.step(st[k], S.q.exch, dir)) : defExit(k); draw(); }
      else if (a.indexOf("pc:") === 0) { var pc = +a.slice(3), L0 = S.q && S.q.last > 0 ? S.q.last : 0; if (L0) { var v0 = pc === 0 ? L0 : O.snap(L0 * (1 + pc / 100), S.q.exch, pc > 0 ? 1 : -1), bd = O.band && S.q.ref > 0 ? O.band(S.q.ref, S.q.exch) : null; st.price = bd && buy ? Math.min(bd.ce, Math.max(bd.fl, v0)) : v0; draw(); }}
      else if (a.indexOf("qa:") === 0) { st.qty = Math.max(1, st.qty + (+a.slice(3))); draw(); }
      else if (a.indexOf("qf:") === 0) { var h0 = pos ? pos.qty : 0, fr = +a.slice(3); st.qty = Math.max(1, fr >= 1 ? h0 : (Math.floor(h0 * fr / 100) * 100 || h0)); draw(); }
      else if (a.indexOf("xp:") === 0) { var pr = a.split(":"); st[pr[1]] = O.snap(st.price * (1 + (+pr[2]) / 100), S.q.exch, pr[1] === "tp" ? 1 : -1); draw(); }
      else if (a === "del") { NhipDlg.confirmOrder({ kind: O.KINDS[kind], sym: S.sym, qty: it.qty, price: it.price }).then(function (ok) { if (ok) O.remove(it.id).then(function (r) { if (r.ok) { closePop(S); toast("Đã xóa lệnh chờ"); } else if (r.err) toast(r.err, 1); }); }); }
      else if (a === "ok") {
        b.disabled = true;
        var base = { kind: kind, sym: S.sym, price: st.price, qty: st.qty }; if (add && gx && gx.lot) { base.grp = gx.grp; base.gc = gx.gc; base.gi = gx.gi; base.gpx = gx.gpx; } var patch = { price: st.price, qty: st.qty };
        if (buy) { base.tp = st.tp; base.sl = st.sl; patch.tp = st.tp; patch.sl = st.sl; } /* 0 = gỡ mức */
        var pr2 = add ? O.add(base, S.q) : O.update(it.id, patch, S.q);
        pr2.then(function (r) { if (r.ok) { closePop(S); toast((add ? "Đã đặt " : "Đã sửa ") + O.KINDS[kind].toLowerCase() + " " + S.sym + " @ " + nf(st.price) + (buy && (st.tp > 0 || st.sl > 0) ? " (kèm TP/SL sau khi mua)" : "")); } else { if (r.err) toast(r.err, 1); draw(); } });
      }
    });
    pop.addEventListener("change", function (e) { if (!e.nxRng) return; var f = e.target.getAttribute("data-p-in"); if (f) { st[f] = num(e.target.value); draw(); } });
    pop.addEventListener("input", function (e) {
      var f = e.target.getAttribute("data-p-in"); if (!f) return; st[f] = num(e.target.value); if (e.nxRng) return; /* đang kéo thanh kéo: không dựng lại hộp (giữ thao tác kéo) */
      var keepV = e.target.value; draw(); var n = pop.querySelector('[data-p-in="' + f + '"]'); if (n) { n.value = keepV; n.focus(); try { n.setSelectionRange(keepV.length, keepV.length); } catch (x) { } }
    });
    pop.addEventListener("keydown", function (e) { if (e.key === "Escape") closePop(S); if (e.key === "Enter" && e.target.matches("input")) { e.preventDefault(); var ok = pop.querySelector('[data-p="ok"]'); if (ok && !ok.disabled) ok.click(); } });
    draw(); var f = pop.querySelector('[data-p-in="' + (o.focus || "qty") + '"]'); if (f && (add || o.focus)) f.focus();
  }

  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && L) { if (L.pick) { L.pick = null; L.pickG = null; drawBar(L); } closePop(L); } });
  window.addEventListener("nhip:chart-built", function (e) { init(e && e.detail); });
  window.addEventListener("nhip:exch-changed", function () { var S = L; if (!S) return; exchFor(S.sym).then(function (ex) { if (L === S && S.q.exch !== ex) { S.q.exch = ex; drawBar(S); build(S); } else if (L === S) drawBar(S); }); });
  window.addEventListener("nhip:chart-destroyed", function (e) { if (L && e && e.detail && e.detail.k === L.k) destroy(); });
  ["nhip:orders-changed", "nhip:trade-sel", "nhip:portfolio-changed"].forEach(function (n) { window.addEventListener(n, function () { var S = L; if (!S) return; drawBar(S); build(S); }); });
  window.NHIPChartOrders = { refresh: function () { if (L) { drawBar(L); build(L); } }, active: function () { return !!L; } };
})();
