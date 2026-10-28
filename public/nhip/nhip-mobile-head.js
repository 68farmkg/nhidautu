/* NHIP v2.65 — CHỈ ĐIỆN THOẠI.
   (1) Biểu đồ + Phân tích: đầu trang trình bày giống mục Giao dịch (Mã ⌄ · sàn / tên công ty · ngành / giá / Trần-Sàn-TC-KL-Giá trị / Mua-Bán).
   (2) Dưới biểu đồ (Biểu đồ, Phân tích, Giao dịch): chỉ 1 nhãn trạng thái hiện tại thay cho 3 nhãn
       "Nến cuối đã đóng / Đã đóng phiên / Dữ liệu mới"; nhãn trạng thái cạnh giá ở đầu trang không còn.
   PC (≥801px) không bị đụng tới: không dựng khối đầu trang, không đổi nội dung dưới biểu đồ. */
(function (W) {
  "use strict";
  var D = W.document;
  var MQ = W.matchMedia ? W.matchMedia("(max-width:800px)") : null;   /* Biểu đồ / Phân tích: PC bắt đầu từ 801px */
  var MQE = W.matchMedia ? W.matchMedia("(max-width:900px)") : null;  /* Biểu đồ nhúng trong Giao dịch: điện thoại tới 900px */
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var fmt = function (n, d) { return n == null || !isFinite(n) ? "—" : Number(n).toLocaleString("vi-VN", { maximumFractionDigits: d == null ? 2 : d }); };
  var money = function (v) { return v == null || !isFinite(v) ? "—" : Math.abs(v) >= 1e9 ? fmt(v / 1e9, 2) + " tỷ" : Math.abs(v) >= 1e6 ? fmt(v / 1e6, 1) + " tr" : fmt(v, 0); };
  function isMobile(embed) { var m = embed ? MQE : MQ; return !!(m && m.matches); }

  /* ---------- Số liệu của mã (nến ngày) ---------- */
  var Q = { sym: "", idx: false, last: null, prev: null, ref: null, o: null, h: null, l: null, v: 0, ts: 0, tried: 0, seq: 0, listening: false };
  function resetQ(sym, idx) { Q.sym = sym; Q.idx = !!idx; Q.last = Q.prev = Q.ref = Q.o = Q.h = Q.l = null; Q.v = 0; Q.ts = 0; Q.tried = 0; Q.seq++; }

  function load() {
    var sym = Q.sym, id = ++Q.seq; Q.tried = Date.now();
    fetch("/api/analysis/" + encodeURIComponent(sym) + "?resolution=D&days=30", { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (d) {
        if (id !== Q.seq || sym !== Q.sym) return;
        var cs = (d && d.candles) || []; if (!cs.length) throw new Error("no candles");
        var c = cs[cs.length - 1], p = cs.length > 1 ? cs[cs.length - 2] : null;
        var k = !Q.idx && Number(c.close) > 0 && Number(c.close) < 1000 ? 1000 : 1;   /* giá cổ phiếu tính theo nghìn đồng → đồng, giống mục Giao dịch */
        var NO = W.NHIPOrders, ct = Number(c.time);
        var cday = NO && NO.vnDate && isFinite(ct) ? NO.vnDate(new Date(ct > 1e12 ? ct : ct * 1000)) : "";
        var last = Number(c.close) * k, prev = p ? Number(p.close) * k : null;
        var oldDay = !!(NO && NO.vnDate && cday && cday < NO.vnDate());
        Q.last = last; Q.prev = prev; Q.ref = (oldDay ? last : prev) || prev;
        Q.o = Number(c.open) * k; Q.h = Number(c.high) * k; Q.l = Number(c.low) * k; Q.v = Number(c.volume) || 0; Q.ts = Date.now();
        paint();
      })
      .catch(function () { /* không có dữ liệu mới: giữ nguyên số đang hiển thị, không tự bịa giá */ });
  }

  /* Giá chạy trực tiếp từ nhip-live.js: chỉ đổi giá/cao/thấp, KL lấy ở lần tải kế tiếp */
  function listen() {
    if (Q.listening) return; Q.listening = true;
    W.addEventListener("nhip:live-price", function (e) {
      var dt = (e && e.detail) || {}; if (!Q.sym || dt.symbol !== Q.sym || !(dt.price > 0) || Q.ts === 0) return;
      Q.last = dt.price; if (Q.h != null && dt.price > Q.h) Q.h = dt.price; if (Q.l != null && dt.price < Q.l) Q.l = dt.price;
      paint();
    });
  }

  /* ---------- Khối đầu trang ---------- */
  function hostEl() { var h = D.querySelector(".cp:not(.cp-embed)"); return h && h.querySelector(".cp-top") && h.querySelector(".cp-top").parentNode === h ? h : null; }
  function remove() {
    var el = D.getElementById("mh-head"); if (el && el.parentNode) { el.parentNode.classList.remove("mh-on"); el.parentNode.removeChild(el); }
  }
  function skeleton(el) {
    var key = Q.sym + "|" + (Q.idx ? 1 : 0);
    if (el.getAttribute("data-k") === key) return;
    el.setAttribute("data-k", key);
    el.innerHTML = '<div class="tp-id"><div class="tp-idtop"><button type="button" class="tp-symbtn mh-sym" aria-label="Chọn mã khác" title="Chạm để chọn mã khác"><b></b></button><span class="tp-ex mh-ex"></span></div><small class="mh-co"></small></div>'
      + '<div class="tp-px"><b class="mh-last">…</b><span class="mh-chg muted">—</span></div>'
      + '<dl class="tp-stats mh-stats"></dl>'
      + (Q.idx ? "" : '<div class="tp-act"><a class="tp-b" href="#/giao-dich" data-trade-quick="buy">Mua</a><a class="tp-s" href="#/giao-dich" data-trade-quick="sell">Bán</a></div>');
    el.querySelector(".mh-sym b").textContent = Q.sym;
    el.removeAttribute("data-ex"); el.removeAttribute("data-co");
  }
  function setHtml(node, html, el, attr) { if (!node) return; if (el.getAttribute(attr) !== html) { el.setAttribute(attr, html); node.innerHTML = html; } }
  function paint() {
    var el = D.getElementById("mh-head"); if (!el || !Q.sym) return;
    skeleton(el);
    var N = W.NHIPOrders, d = Q.idx ? 2 : 0, last = Q.last, prev = Q.prev;
    var chg = last != null && prev ? last - prev : null, pct = chg != null && prev ? chg / prev * 100 : null;
    var dir = chg == null || chg === 0 ? "" : chg > 0 ? "up" : "dn";

    var nm = "", sec = "";
    try {
      nm = (W.NHIPSYM && W.NHIPSYM.name && W.NHIPSYM.name(Q.sym)) || "";
      var inf = W.NHIPSYM && W.NHIPSYM.info ? W.NHIPSYM.info(Q.sym) : null; sec = (inf && inf.sector) || "";
    } catch (e) { }
    if (!nm) nm = Q.idx ? "Chỉ số" : "Cổ phiếu";
    setHtml(el.querySelector(".mh-co"), "<span>" + esc(nm) + "</span>" + (sec ? "<em>" + esc(sec) + "</em>" : ""), el, "data-co");
    var tag = ""; try { if (!Q.idx && N && N.exTag) tag = N.exTag(Q.sym); } catch (e) { }
    setHtml(el.querySelector(".mh-ex"), tag, el, "data-ex");

    var L = el.querySelector(".mh-last"); L.textContent = last == null ? "…" : fmt(last, d); L.className = "mh-last " + dir;
    var C = el.querySelector(".mh-chg"); C.className = "mh-chg " + (dir || "muted");
    C.textContent = prev && chg != null ? (chg > 0 ? "▲ +" : chg < 0 ? "▼ " : "") + fmt(chg, d) + " (" + (pct > 0 ? "+" : "") + fmt(pct) + "%)" : "—";

    var S = function (l, v, c) { return "<div><dt>" + l + '</dt><dd class="' + (c || "") + '">' + v + "</dd></div>"; }, h = "";
    if (Q.idx) h = S("TC", fmt(Q.ref, d), "tp-rf") + S("Mở", fmt(Q.o, d)) + S("Cao", fmt(Q.h, d), "up") + S("Thấp", fmt(Q.l, d), "dn") + S("KL", fmt(Q.v, 0));
    else {
      var b = null;
      try { var ex = N && N.getExch ? N.getExch(Q.sym, N.baseExch ? N.baseExch(Q.sym, null) : "HOSE") : "HOSE"; b = N && N.band && Q.ref > 0 ? N.band(Q.ref, ex) : null; } catch (e) { }
      h = S("Trần", fmt(b && b.ce, 0), "tp-ce") + S("Sàn", fmt(b && b.fl, 0), "tp-fl") + S("TC", fmt(Q.ref, 0), "tp-rf") + S("KL", fmt(Q.v, 0)) + S("Giá trị", money(Q.v * (last || 0) || null));
    }
    setHtml(el.querySelector(".mh-stats"), h, el, "data-st");
  }

  /* charts.js gọi mỗi lần vẽ lại đầu trang (tải lịch sử, giá chạy, đổi mã) */
  function sync(sym, idx) {
    if (!isMobile(false)) { remove(); return; }
    var host = hostEl(); if (!host || !sym) return;
    var el = D.getElementById("mh-head");
    if (el && el.parentNode !== host) { remove(); el = null; }
    if (!el) {
      el = D.createElement("div"); el.id = "mh-head"; el.className = "panel tp-head mh-head";
      el.addEventListener("click", function (e) { if (e.target.closest && e.target.closest(".mh-sym")) { var h = D.getElementById("cp-sym"); if (h) h.click(); } });
      host.insertBefore(el, host.querySelector(".cp-top")); host.classList.add("mh-on");
    }
    if (sym !== Q.sym || !!idx !== Q.idx) resetQ(sym, idx);
    listen(); paint();
    var now = Date.now(); if (now - Q.ts > 45000 && now - Q.tried > 15000) load();
  }

  /* ---------- Dòng trạng thái dưới biểu đồ (1 nhãn duy nhất) ---------- */
  function derive(d) {
    var q = (d && d.quality) || {}, f = q.freshness || {}, ss = q.session || {};
    if (f.level === "stale") return { txt: "Dữ liệu cũ", cls: "err", title: f.message || "" };
    if (f.level === "delayed") return { txt: "Dữ liệu trễ", cls: "warn", title: f.message || "" };
    return { txt: ss.label || "Dữ liệu mới", cls: ss.state === "open" ? "live" : "idle", title: "" };
  }
  function chip(d) {
    var s = W.NHIPLiveStatus, o = s && Date.now() - s.ts < 15000 ? s : derive(d);   /* nhip-live.js cập nhật nhãn này mỗi giây khi đang chạy */
    return '<span id="nl-chip" class="nl-chip ' + esc(o.cls) + '" title="' + esc(o.title || "") + '">' + esc(o.txt) + "</span>";
  }

  /* đổi giữa điện thoại ↔ PC (xoay máy, đổi cỡ cửa sổ): báo để biểu đồ vẽ lại đầu trang/dòng trạng thái */
  function onMode() { try { W.dispatchEvent(new CustomEvent("nhip:mh-mode")); } catch (e) { } }
  [MQ, MQE].forEach(function (m) { if (!m) return; if (m.addEventListener) m.addEventListener("change", onMode); else if (m.addListener) m.addListener(onMode); });

  W.NHIPMobileHead = { isMobile: isMobile, sync: sync, chip: chip, remove: remove };
})(window);
