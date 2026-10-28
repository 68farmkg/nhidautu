/* NHIP v2.12 — Hộp "Điều hướng biểu đồ" (biểu tượng ✥ nằm ngay cạnh nút "Vẽ").
   Gói 1 chỗ: ✋ Bàn tay kéo · Thu nhỏ / Phóng to · Giảm / Tăng chiều cao · ↺ Trả về mặc định.
   Dùng chung cho 3 mục có biểu đồ (Biểu đồ, Phân tích, Giao dịch) vì cả ba đều dựng bằng vCharts() trong charts.js,
   và cho TỪNG KHUNG trong chế độ Đa khung (nút ✥ nằm trong thanh tiêu đề của mỗi khung).
   Không sửa charts.js: bắt sự kiện "nhip:chart-built" (biểu đồ chính) và "nhip:mc-chart-built" (khung đa khung). */
(function () {
  "use strict";
  var H_MIN = 220, H_MAX = 1400, H_STEP = 60, Z_STEP = 1.25;
  var M = { kind: "main", k: null, box: null, def: null, hand: false, locked: [] };
  var list = [], ctxs = new WeakMap(), cur = null, pop = null;

  var ICON = {
    nav: '<path d="M12 3v18M3 12h18M12 3 9 6M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>',
    hand: '<path d="M8 13V6a1.5 1.5 0 0 1 3 0v5M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6.5a1.5 1.5 0 0 1 3 0V14c0 4-2.5 6-6 6-2.6 0-4.2-1-5.6-3L3.6 13.6a1.5 1.5 0 0 1 2.4-1.7L8 14"/>',
    zin: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2M11 8.2v5.6M8.2 11h5.6"/>',
    zout: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2M8.2 11h5.6"/>',
    hup: '<path d="M12 20V5M6 10l6-6 6 6M5 21h14"/>',
    hdn: '<path d="M12 4v15M6 14l6 6 6-6M5 3h14"/>',
    vin: '<path d="M12 3v18M7 8l5-5 5 5M7 16l5 5 5-5"/>',
    vout: '<path d="M12 3v7M12 21v-7M8 6l4 4 4-4M8 18l4-4 4 4"/>',
    pdn: '<path d="M12 4v15M6 14l6 6 6-6"/>',
    pup: '<path d="M12 20V5M6 10l6-6 6 6"/>',
    fit: '<path d="M4 12h16M4 5h16M4 19h16M12 8v8"/>',
    reset: '<path d="M4 12a8 8 0 1 0 2.6-5.9M4 4v4.5h4.5"/>'
  };
  function svg(n, s) { return '<svg viewBox="0 0 24 24" width="' + (s || 18) + '" height="' + (s || 18) + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON[n] + "</svg>"; }
  function $(s, r) { return (r || document).querySelector(s); }
  function toast(m) { var t = $(".cn-toast"); if (!t) { t = document.createElement("div"); t.className = "cn-toast"; document.body.appendChild(t); } t.textContent = m; t.classList.add("show"); clearTimeout(t._t); t._t = setTimeout(function () { t.classList.remove("show"); }, 1800); }

  /* ---------- Chiều cao (nhớ riêng từng mục / từng khung) ---------- */
  function grp() { var m = /^#\/([\w-]+)/.exec(location.hash); return m ? m[1] : "tong-quan"; }
  function keyOf(c) { return c.kind === "main" ? "nhip.chartnav.h." + grp() : "nhip.chartnav.mh." + grp() + "." + (c.res || "x"); }
  function getH(c) { try { var v = +localStorage.getItem(keyOf(c)); return v >= H_MIN && v <= H_MAX ? v : null; } catch (e) { return null; } }
  function setH(c, v) { try { if (v == null) localStorage.removeItem(keyOf(c)); else localStorage.setItem(keyOf(c), String(Math.round(v))); } catch (e) { } }
  function curH(c) { return c.box ? Math.round(c.box.getBoundingClientRect().height) : 0; }
  function isFull() { var p = $("#cpm"); return !!(p && p.classList.contains("is-full")); }
  function resize(c) { try { c.k && c.k.resize(); } catch (e) { } }
  function applyH(c) {
    if (!c.box || !c.box.isConnected) return;
    var h = getH(c);
    c.box.style.height = h && !isFull() ? h + "px" : "";
    resize(c);
  }
  function changeH(c, d) {
    if (isFull()) return toast("Đang phóng to toàn màn hình — chiều cao tự theo màn hình");
    var base = getH(c) || curH(c); if (!base) return;
    setH(c, Math.max(H_MIN, Math.min(H_MAX, base + d))); applyH(c); paint();
  }


  /* ---------- v2.20 · Co giãn / đẩy NẾN theo trục giá + tự căn giữa giá & lệnh + thao tác chạm kiểu TradingView ----------
     Tra cứu KLineChart 9.8: khoảng giá trục Y KHÔNG cho ghi đè, nhưng setPaneOptions({id:"candle_pane", gap:{top,bottom}}) chỉnh lề trên/dưới của ô nến
     (số >= 1 là pixel, số < 1 là tỉ lệ chiều cao). Đây là cách chính thức, nhẹ, không cần chỉ báo phụ → không còn gây đơ trên điện thoại.
     Mô hình: c.g = {t, b} = lề trên / lề dưới theo TỈ LỆ chiều cao ô nến (mặc định 0,2 / 0,1). Phần nến chiếm F = 1 − t − b. */
  var V_STEP = 1.25, V_SHIFT = 0.12, G0 = { t: 0.2, b: 0.1 }, GMIN = -0.3, GMAX = 3, FMIN = 0.1, FMAX = 1.6;
  function isTrade() { return grp() === "giao-dich"; }
  function lastClose(c) { try { var d = c.k.getDataList(); return d.length ? d[d.length - 1].close : null; } catch (e) { return null; } }
  function normalAxis(c) { try { var y = c.k.getStyles().yAxis; return !y || !y.type || y.type === "normal"; } catch (e) { return true; } }
  function paneH(c) { try { var s = c.k.getSize("candle_pane", "main"); return s && s.height ? s.height : 0; } catch (e) { return 0; } }
  function clampG(c, t, b) {
    t = Math.max(GMIN, Math.min(GMAX, t)); b = Math.max(GMIN, Math.min(GMAX, b));
    var F = 1 - t - b; if (F > FMAX) { var k = (F - FMAX) / 2; t += k; b += k; } else if (F < FMIN) { var k2 = (FMIN - F) / 2; t -= k2; b -= k2; }
    return { t: t, b: b };
  }
  function setGap(c, t, b) { /* áp dụng lề: dương → pixel (>=1), âm → tỉ lệ (<1) theo đúng quy ước của thư viện */
    var H = paneH(c); if (!c.k || !(H > 0)) return false;
    var g = clampG(c, t, b), conv = function (r) { return r >= 0 ? Math.max(1, Math.round(r * H)) : r; };
    c.g = g;
    try { c.k.setPaneOptions({ id: "candle_pane", gap: { top: conv(g.t), bottom: conv(g.b) } }); return true; } catch (e) { return false; }
  }
  function gOf(c) { return c.g || G0; }
  /* các mức giá ĐANG HIỂN THỊ (nhóm lệnh chọn Hiện/Mờ) — cùng quy tắc với charts-orders.js */
  function shownPrices(c) {
    var out = [], O = window.NHIPOrders, sym = c.sym; if (!O || !sym || !O.cur) return out;
    try {
      var p = O.cur(); if (!p) return out; var m = (window.NHIPOLMem || {})[sym], sel = (m && m.sel) || {};
      var pos = (p.positions || []).filter(function (x) { return x.symbol === sym; })[0] || null, list = O.list(sym).slice(), G = O.groups(list, sym);
      if (pos && sel.hold) out.push(Math.round(pos.cost));
      list.forEach(function (o) {
        var g = o.kind === "buy" ? G[o.id] : O.exitGroup(o); if (g && sel[g.key]) out.push(o.price);
        if (o.kind === "buy" && G[o.id] && sel[G[o.id].key]) [+o.tp, +o.sl].forEach(function (v) { if (v > 0) out.push(v); });
      });
    } catch (e) { }
    return out.filter(function (v) { return v > 0 && isFinite(v); });
  }
  /* khoảng giá của PHẦN NẾN hiện tại (dữ liệu + chỉ báo) suy ra từ lề đang áp dụng */
  function dataRange(c) {
    var H = paneH(c), g = gOf(c); if (!(H > 0)) return null;
    try {
      var r = c.k.convertFromPixel([{ y: g.t * H }, { y: H - g.b * H }], { paneId: "candle_pane" });
      var hi = r && r[0] && r[0].value, lo = r && r[1] && r[1].value; return isFinite(hi) && isFinite(lo) && hi > lo ? { hi: hi, lo: lo } : null;
    } catch (e) { return null; }
  }
  function fitTarget(c, D) { /* khoảng giá muốn hiển thị: giá hiện tại + mọi mức đang hiện, chia đều, có đệm */
    var last = lastClose(c), ps = shownPrices(c); if (last > 0) ps.push(last); if (!ps.length || !D) return null;
    var lo = Math.min.apply(null, ps), hi = Math.max.apply(null, ps), mid = (lo + hi) / 2, S;
    if (ps.length === 1 || hi - lo < mid * 0.04) { S = 2 * Math.max(D.hi - mid, mid - D.lo, mid * 0.04) * 1.06; lo = mid - S / 2; hi = mid + S / 2; } /* chỉ giá hiện tại: đặt giữa khung, vẫn thấy hết nến */
    else { var pad = (hi - lo) * 0.18; lo -= pad; hi += pad; }
    return hi > lo ? { lo: lo, hi: hi } : null;
  }
  function fitApply(c) {
    var D = dataRange(c), T = fitTarget(c, D); if (!T) return false;
    var S = T.hi - T.lo, t = (T.hi - D.hi) / S, b = (D.lo - T.lo) / S;
    c.fsig = [Math.round(D.hi), Math.round(D.lo), Math.round(T.lo), Math.round(T.hi)].join("|");
    return setGap(c, t, b);
  }
  function viewApply(c) {
    if (!c.k || !c.box || !c.box.isConnected || !normalAxis(c)) return;
    if (c.fit) { if (!c.fitInit) { setGap(c, G0.t, G0.b); c.fitInit = 1; } fitApply(c); } else setGap(c, gOf(c).t, gOf(c).b);
  }
  function toManual(c) { c.fit = false; }
  function vZoom(c, f) { /* f > 1 giãn nến ra · f < 1 co nến lại (khung giữ nguyên) */
    toManual(c); var g = gOf(c), F = 1 - g.t - g.b, cen = g.t + F / 2, F2 = Math.max(FMIN, Math.min(FMAX, F * f)), t2 = cen - F2 / 2;
    setGap(c, t2, 1 - t2 - F2); paint();
  }
  function vShiftBy(c, d) { toManual(c); var g = gOf(c); setGap(c, g.t + d, g.b - d); paint(); } /* d > 0 đẩy nến xuống */
  function vShift(c, dir) { vShiftBy(c, dir * V_SHIFT); }
  function vFit(c) { c.fit = true; c.fitInit = 0; viewApply(c); paint(); toast("Đã căn giữa giá hiện tại và các lệnh đang hiển thị"); }
  function vTight(c) { toManual(c); setGap(c, 0.05, 0.05); paint(); toast("Nến vừa khít khung"); }
  function vLatest(c) { try { c.k.scrollToRealTime(); } catch (e) { } toast("Về nến mới nhất"); }
  function vResetV(c) { c.fit = false; c.fitInit = 0; c.g = null; setGap(c, G0.t, G0.b); if (c.fit) viewApply(c); paint(); }
  function initView(c, sym) {
    if (c.sym !== sym) { c.sym = sym; c.g = null; c.fit = false; } else if (c.fit == null) c.fit = false;
    if (!isTrade() && c.fit) c.fit = false;
    c.fitInit = 0; watchTouch(c);
    if (c.g && !c.fit) setGap(c, c.g.t, c.g.b); else if (c.fit) { viewApply(c); setTimeout(function () { viewApply(c); }, 500); } /* áp lại khi bố cục đã dựng xong */
  }
  function touching(c) { return c.touchT && Date.now() - c.touchT < 900; }

  /* ---- Thao tác chạm (học theo TradingView mobile): kéo TRỤC GIÁ lên/xuống để co giãn nến · chạm đúp trục giá = tự căn lại · Bàn tay kéo cả chiều dọc ---- */
  function axisZone(c, x, y) {
    try {
      var r = c.box.getBoundingClientRect(), ax = c.k.getSize("candle_pane", "yAxis"), pn = c.k.getSize("candle_pane", "root");
      var left = r.left + (ax.left || (r.width - ax.width)), top = r.top + (pn.top || 0), bot = top + (pn.height || r.height);
      return x >= left - 4 && x <= r.right + 2 && y >= top && y <= bot;
    } catch (e) { return false; }
  }
  function watchTouch(c) {
    if (!c.box || c.box._cnTouch) return; c.box._cnTouch = 1;
    var st = null, raf = 0, acc = 0, mode = null, lastTap = 0, bx = c.box;
    function flush() { raf = 0; if (!acc) return; var v = acc; acc = 0; if (mode === "axis") vZoom(c, Math.exp(-v * 0.008)); else if (mode === "hand") { var H = paneH(c); if (H > 0) vShiftBy(c, v / H); } }
    function begin(x, y) { st = { x: x, y: y, ly: y, moved: 0 }; mode = axisZone(c, x, y) ? "axis" : (c.hand ? "hand" : null); }
    function move(y) { if (!st || !mode) return; var dy = y - st.ly; st.ly = y; st.moved += Math.abs(dy); acc += (mode === "axis" ? dy : dy); if (!raf) raf = requestAnimationFrame(flush); }
    function end() {
      if (st && mode === "axis" && st.moved < 8) { var now = Date.now(); if (now - lastTap < 350) { lastTap = 0; vResetV(c); toast("Đã trả trục giá về tự động"); } else lastTap = now; }
      st = null; mode = null; c.touchT = Date.now();
    }
    bx.addEventListener("touchstart", function (e) {
      c.touchT = Date.now(); if (e.touches.length !== 1) { st = null; mode = null; return; }
      var t = e.touches[0]; begin(t.clientX, t.clientY);
      if (mode === "axis") { e.stopPropagation(); if (e.cancelable) e.preventDefault(); } /* chạm trục giá: không để thư viện/trang cuộn */
    }, { passive: false, capture: true });
    bx.addEventListener("touchmove", function (e) {
      c.touchT = Date.now(); if (!st || !mode || e.touches.length !== 1) return;
      if (mode === "axis") { e.stopPropagation(); if (e.cancelable) e.preventDefault(); }
      move(e.touches[0].clientY);
    }, { passive: false, capture: true });
    ["touchend", "touchcancel"].forEach(function (n) { bx.addEventListener(n, function (e) { if (mode === "axis") e.stopPropagation(); end(); }, { passive: true, capture: true }); });
    /* chuột (PC): Bàn tay kéo cả dọc; nhấp đúp trục giá = tự căn lại */
    var md = false;
    bx.addEventListener("mousedown", function (e) { c.touchT = Date.now(); md = !!c.hand && e.button === 0 && !axisZone(c, e.clientX, e.clientY); if (md) { st = { ly: e.clientY, moved: 0 }; mode = "hand"; } }, true);
    window.addEventListener("mousemove", function (e) { if (md && st && mode === "hand") { c.touchT = Date.now(); move(e.clientY); } }, true);
    window.addEventListener("mouseup", function () { if (md) { md = false; st = null; mode = null; } }, true);
    bx.addEventListener("dblclick", function (e) { if (axisZone(c, e.clientX, e.clientY)) { vResetV(c); toast("Đã trả trục giá về tự động"); } }, true);
  }
  setInterval(function () { /* đang ở chế độ tự căn: giá / lệnh / khoảng nến đổi → căn lại (tạm dừng khi đang chạm) */
    if (document.hidden) return;
    [M].concat(list).forEach(function (c) {
      if (!c || !c.k || !c.fit || !isTrade() || !c.box || !c.box.isConnected || touching(c) || !normalAxis(c)) return;
      var D = dataRange(c), T = D && fitTarget(c, D); if (!T) return;
      var sig = [Math.round(D.hi), Math.round(D.lo), Math.round(T.lo), Math.round(T.hi)].join("|"); if (sig !== c.fsig) fitApply(c);
    });
  }, 700);

  /* ---------- Thu phóng ---------- */
  function barOf(k) { try { var b = k.getBarSpace(); return typeof b === "number" ? b : (b && b.bar); } catch (e) { return null; } }
  function zoom(c, f) {
    if (!c.k) return;
    var b = barOf(c.k);
    try {
      if (b != null && c.k.setBarSpace) c.k.setBarSpace(Math.max(1.5, Math.min(60, b * f)));
      else c.k.zoomAtCoordinate(f > 1 ? 1 : -1, { x: (c.box ? c.box.clientWidth : 600) * 0.8, y: 0 }, 120);
    } catch (e) { console.warn("charts-nav: zoom", e); }
    paint();
  }
  function zoomPct(c) { var b = c.k ? barOf(c.k) : null; return b && c.def ? Math.round(b / c.def * 100) : null; }

  /* ---------- Bàn tay kéo ---------- */
  function lockOverlays(c, on) {
    if (c.kind !== "main" || !c.k) return;
    try {
      if (on) {
        var all = (c.k.getOverlays && c.k.getOverlays()) || []; c.locked = [];
        all.forEach(function (o) { if (o && o.id && !o.lock) { try { c.k.overrideOverlay({ id: o.id, lock: true }); c.locked.push(o.id); } catch (e) { } } });
      } else { c.locked.forEach(function (id) { try { c.k.overrideOverlay({ id: id, lock: false }); } catch (e) { } }); c.locked = []; }
    } catch (e) { }
  }
  function setHand(c, on) {
    c.hand = !!on;
    if (c.hand && c.kind === "main") { var t = $("#cx-rail [data-tool].on"); if (t) t.click(); } /* thoát công cụ vẽ đang chọn */
    if (c.box) c.box.classList.toggle("cn-hand", c.hand);
    lockOverlays(c, c.hand); paint();
  }

  /* ---------- Trả về mặc định ---------- */
  function resetAll(c) {
    setH(c, null); if (c.box) c.box.style.height = ""; vResetV(c);
    if (c.hand) setHand(c, false);
    try { if (c.k && c.def && c.k.setBarSpace) c.k.setBarSpace(c.def); } catch (e) { }
    try { c.k && c.k.scrollToRealTime(); } catch (e) { }
    setTimeout(function () { resize(c); paint(); }, 80);
    toast("Đã trả biểu đồ về mặc định");
  }

  /* ---------- Nút ✥ ---------- */
  function mkBtn(cls, id) {
    var b = document.createElement("button");
    b.type = "button"; if (id) b.id = id; b.className = cls;
    b.setAttribute("aria-haspopup", "true"); b.setAttribute("aria-expanded", "false");
    b.setAttribute("aria-label", "Điều hướng biểu đồ"); b.title = "Điều hướng biểu đồ: bàn tay kéo · thu phóng · chiều cao · mặc định";
    b.innerHTML = svg("nav", 16); return b;
  }
  function ensureMainBtn() {
    var d = $("#bt-draw"); if (!d || $("#bt-nav")) return;
    d.parentNode.insertBefore(mkBtn("cx-btn cx-ico cn-btn", "bt-nav"), d.nextSibling);
    M.hand = false; if (!isOpen()) closePop();
  }
  function ensureMcBtn(c) {
    var p = c.box && c.box.closest(".mc-p"), ph = p && p.querySelector(".mc-ph"); if (!ph || ph.querySelector(".cn-btn")) return;
    var anchor = ph.querySelector(".mc-solo") || ph.querySelector(".mc-open");
    ph.insertBefore(mkBtn("cn-btn mc-nav"), anchor || null);
  }
  function btnOf(c) { return c.kind === "main" ? $("#bt-nav") : (c.box && c.box.closest(".mc-p") ? c.box.closest(".mc-p").querySelector(".cn-btn") : null); }
  function ctxOfBtn(b) {
    if (b.id === "bt-nav") return M;
    var p = b.closest(".mc-p"), box = p && p.querySelector(".mc-ch"); return box ? ctxs.get(box) || null : null;
  }

  /* ---------- Hộp (popover) ---------- */
  function build(btn) {
    var host = (btn && btn.closest && btn.closest("#cpm")) || $("#cpm"); if (!host) return null;
    if (pop && pop.isConnected && pop.parentNode === host) return pop;
    if (pop && pop.parentNode) pop.parentNode.removeChild(pop);
    pop = document.createElement("div"); pop.className = "cn-pop"; pop.hidden = true; pop.setAttribute("role", "dialog"); pop.setAttribute("aria-label", "Điều hướng biểu đồ");
    pop.innerHTML =
      '<div class="cn-hd">Điều hướng biểu đồ</div>' +
      '<button type="button" class="cn-hand-b" data-act="hand" aria-pressed="false">' + svg("hand", 20) + '<span><b>Bàn tay kéo</b><i>Kéo để dịch biểu đồ, không vẽ nhầm</i></span><em class="cn-sw"></em></button>' +
      '<div class="cn-row"><span class="cn-lb">Thu phóng</span><div class="cn-st"><button type="button" data-act="zout" aria-label="Thu nhỏ">' + svg("zout") + '</button><output id="cn-z">—</output><button type="button" data-act="zin" aria-label="Phóng to">' + svg("zin") + "</button></div></div>" +
      '<div class="cn-row"><span class="cn-lb">Co giãn nến</span><div class="cn-st"><button type="button" data-act="vout" aria-label="Co nến lại (thu giá)">' + svg("vout") + '</button><output id="cn-v">—</output><button type="button" data-act="vin" aria-label="Giãn nến ra (phóng giá)">' + svg("vin") + "</button></div></div>" +
      '<div class="cn-row"><span class="cn-lb">Vị trí nến</span><div class="cn-st"><button type="button" data-act="pdn" aria-label="Đẩy nến xuống thấp">' + svg("pdn") + '</button><output id="cn-p">—</output><button type="button" data-act="pup" aria-label="Đẩy nến lên cao">' + svg("pup") + "</button></div></div>" +
      '<div class="cn-quick"><button type="button" data-act="latest">' + svg("pup", 15) + ' Về nến mới</button><button type="button" data-act="tight">' + svg("vin", 15) + ' Vừa khít nến</button></div>' +
      '<button type="button" class="cn-fit-b" data-act="fit" aria-pressed="false">' + svg("fit", 18) + '<span><b>Căn giữa giá &amp; lệnh</b><i>Đưa giá hiện tại và các lệnh đang hiện vào giữa khung</i></span><em class="cn-sw"></em></button>' +
      '<button type="button" class="cn-reset" data-act="reset">' + svg("reset") + " Trả về mặc định</button>";
    host.appendChild(pop); return pop;
  }
  function isOpen() { return !!(pop && !pop.hidden); }
  function paint() {
    [M].concat(list).forEach(function (c) { var b = btnOf(c); if (b) { var o = isOpen() && cur === c; b.classList.toggle("on", !!c.hand || o); b.setAttribute("aria-expanded", o ? "true" : "false"); } });
    if (!isOpen() || !cur) return;
    var hb = $('[data-act="hand"]', pop); if (hb) { hb.classList.toggle("on", !!cur.hand); hb.setAttribute("aria-pressed", cur.hand ? "true" : "false"); }
    var z = $("#cn-z", pop), p = zoomPct(cur); if (z) z.textContent = p ? p + "%" : "—";
    var g = gOf(cur), F = 1 - g.t - g.b, shv = (g.t - g.b) / 2 - (G0.t - G0.b) / 2;
    var v = $("#cn-v", pop); if (v) v.textContent = cur.fit ? "Tự động" : Math.round(F / (1 - G0.t - G0.b) * 100) + "%";
    var pp = $("#cn-p", pop); if (pp) pp.textContent = cur.fit ? "Tự động" : (Math.abs(shv) < 0.01 ? "Giữa" : (shv > 0 ? "Xuống " : "Lên ") + Math.round(Math.abs(shv) * 100) + "%");
    var fb = $('[data-act="fit"]', pop); if (fb) { fb.hidden = !(isTrade() && cur.sym); fb.classList.toggle("on", !!cur.fit); fb.setAttribute("aria-pressed", cur.fit ? "true" : "false"); }
  }
  function openPop(c, btn) {
    var p = build(btn); if (!p || !btn) return;
    p._w = innerWidth;
    cur = c; p.hidden = false; openedAt = Date.now(); paint();
    if (innerWidth > 700) {
      var ar = btn.getBoundingClientRect(), w = 270, hh = p.offsetHeight || 220;
      var left = Math.max(6, Math.min(ar.left, innerWidth - w - 6));
      var top = ar.bottom + 6; if (top + hh > innerHeight - 6) top = Math.max(6, ar.top - hh - 6);
      p.style.left = left + "px"; p.style.top = top + "px";
    } else { p.style.left = ""; p.style.top = ""; }
  }
  var openedAt = 0;
  function closePop(force) { if (!force && Date.now() - openedAt < 450) return; /* v3.18: sự kiện thừa ngay sau khi mở không được đóng hộp */ if (pop) pop.hidden = true; paint(); }

  document.addEventListener("click", function (e) {
    var t = e.target; if (!t || !t.closest) return;
    var nb = t.closest(".cn-btn");
    if (nb) {
      var c = ctxOfBtn(nb); if (!c) return;
      if (isOpen() && cur === c) closePop(true); else openPop(c, nb);
      return;
    }
    var a = t.closest(".cn-pop [data-act]");
    if (a && cur) {
      var act = a.dataset.act;
      if (act === "hand") setHand(cur, !cur.hand);
      else if (act === "zin") zoom(cur, Z_STEP);
      else if (act === "zout") zoom(cur, 1 / Z_STEP);
      else if (act === "vin") vZoom(cur, V_STEP);
      else if (act === "vout") vZoom(cur, 1 / V_STEP);
      else if (act === "pdn") vShift(cur, 1);
      else if (act === "pup") vShift(cur, -1);
      else if (act === "fit") { if (cur.fit) { toManual(cur); paint(); } else vFit(cur); }
      else if (act === "latest") vLatest(cur);
      else if (act === "tight") vTight(cur);
      else if (act === "reset") resetAll(cur);
      return;
    }
    if (t.closest(".cn-pop")) return;
    if (M.hand && t.closest("#cx-rail [data-tool]")) setHand(M, false); /* chọn công cụ vẽ → tự tắt bàn tay */
    if (isOpen()) closePop();
  }, true);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && isOpen()) closePop(); });

  /* ---------- Gắn vào vòng đời biểu đồ ---------- */
  window.addEventListener("nhip:chart-built", function (e) {
    var d = e.detail || {}; M.k = d.k || M.k; M.box = d.el || $("#chart");
    var b = barOf(M.k); if (b) M.def = b; /* khoảng cách nến mặc định ngay sau khi dựng */
    ensureMainBtn(); applyH(M); M.kind = "main"; initView(M, String(d.sym || "").toUpperCase());
    if (M.hand) { if (M.box) M.box.classList.add("cn-hand"); lockOverlays(M, true); }
    paint();
  });
  window.addEventListener("nhip:mc-chart-built", function (e) {
    var d = e.detail || {}; if (!d.box) return;
    var c = ctxs.get(d.box);
    if (!c) { c = { kind: "mc", k: null, box: d.box, def: null, hand: false, locked: [] }; ctxs.set(d.box, c); list.push(c); }
    list = list.filter(function (x) { return x.box && x.box.isConnected; });
    if (list.indexOf(c) < 0) list.push(c);
    c.k = d.k; c.res = d.res;
    var b = barOf(d.k); if (b) c.def = b;
    ensureMcBtn(c); applyH(c); initView(c, String(d.sym || "").toUpperCase());
    if (c.hand) d.box.classList.add("cn-hand");
    paint();
  });
  var raf = 0;
  new MutationObserver(function () {
    if (raf) return;
    raf = requestAnimationFrame(function () {
      raf = 0; ensureMainBtn();
      var p = $("#cpm");
      if (p && !p._cnw) { /* bật/tắt phóng to toàn màn hình → bỏ/khôi phục chiều cao tùy chỉnh */
        p._cnw = 1; new MutationObserver(function () { applyH(M); list.forEach(applyH); paint(); }).observe(p, { attributes: true, attributeFilter: ["class"] });
      }
      if (pop && !pop.isConnected) { pop = null; cur = null; }
    });
  }).observe(document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", function () { closePop(true); });
  window.addEventListener("resize", function () { if (isOpen() && (!pop || pop._w !== innerWidth)) closePop(); }); /* v3.17: chỉ đóng khi bề rộng đổi thật (Live bắn resize giả, thanh địa chỉ điện thoại đổi chiều cao) */
})();
