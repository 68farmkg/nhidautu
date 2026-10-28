/* NHIP · V2.35 — BỘ CHỌN MÃ Ở TRANG BIỂU ĐỒ, PHÂN TÍCH & GIAO DỊCH
   Chạm vào tên mã to ở đầu trang (VD "VIC") → mở danh sách TẤT CẢ mã của sàn đang đứng (HOSE / HNX / UPCoM), có ô tìm kiếm.
   Nguồn dữ liệu (một nguồn duy nhất, cùng nguồn với cổng kiểm tra sàn của app):
     NHIPSYM.all()  = danh bạ nhúng symbols-vn.js + danh sách niêm yết VNDirect (tự nạp, lưu cache) + mã khách tự khai báo ở Cài đặt → Danh bạ mã.
   Đúng sàn: chỉ giữ mã có NHIPHouse.houseOf(mã) === sàn đang đứng (mã chưa rõ sàn KHÔNG bị đoán là HOSE, không được liệt kê).
   Chọn mã: điền vào ô #si rồi gửi form #sf có sẵn → đi qua đúng luồng cũ (chuẩn hóa mã, cổng sàn, tải biểu đồ). Không đổi dữ liệu/logic khác. */
(function () {
  "use strict";
  var W = window, D = document;
  var NAME = { HOSE: "HOSE", HNX: "HNX", UPCOM: "UPCoM" };
  var CHUNK = 80;
  var st = { open: false, house: "", all: [], view: [], shown: 0, q: "", cur: "", grp: "", act: -1, ver: -1 };
  var el = null;

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function norm(s) {
    try { if (W.NHIPSYM && W.NHIPSYM.norm) return W.NHIPSYM.norm(s); } catch (e) { }
    return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }
  function trg() { return D.getElementById("cp-sym") || D.getElementById("tp-sym"); }
  function curSym() { var t = trg(); return t ? String(t.dataset.sym || t.textContent || "").trim().toUpperCase() : ""; }
  function houseNow() { try { return W.NHIPHouse && W.NHIPHouse.cur ? W.NHIPHouse.cur() : "HOSE"; } catch (e) { return "HOSE"; } }
  function floorKey(f) {
    var k = String(f || "").toUpperCase().replace(/[^A-Z]/g, "");
    return k === "H" || k === "HOSE" || k === "HSX" ? "HOSE" : k === "N" || k === "HNX" ? "HNX" : k === "U" || k === "UPCOM" ? "UPCOM" : "";
  }
  function houseOf(sym, floor) {
    try { if (W.NHIPHouse && W.NHIPHouse.houseOf) return W.NHIPHouse.houseOf(sym); } catch (e) { }
    return floorKey(floor);
  }
  var IDX = /^(VNINDEX|VN30|VN100|VNALL|VNMID|VNSML|HNX\w*|UPCOM\w*)$/;

  /* ---------- Dữ liệu: mã đúng sàn, có tên + ngành, xếp A→Z (chỉ số đứng đầu) ---------- */
  function collect(h) {
    var S = W.NHIPSYM, out = [], seen = {}, list = [];
    try { list = S && S.all ? S.all() : []; } catch (e) { list = []; }
    list.forEach(function (e) {
      var sym = String(e.sym || "").toUpperCase();
      if (!sym || seen[sym] || !floorKey(e.floor)) return;      /* chưa rõ sàn → không đưa vào */
      if (houseOf(sym, e.floor) !== h) return;                   /* sai sàn → loại */
      seen[sym] = 1;
      var inf = null; try { inf = S.info ? S.info(sym) : null; } catch (x) { }
      var name = e.name || (inf && (inf.name || inf.full)) || "", sector = (inf && inf.sector) || "", al = (inf && inf.aliases) || [];
      out.push({ sym: sym, name: name, sector: sector, idx: IDX.test(sym), k: norm(sym + " " + name + " " + sector + " " + al.join(" ")) });
    });
    var RK = ["VNINDEX", "VN30", "VN100", "HNX", "HNX30", "UPCOM"], rk = function (s) { var i = RK.indexOf(s); return i < 0 ? 99 : i; };
    out.sort(function (a, b) { return a.idx !== b.idx ? (a.idx ? -1 : 1) : a.idx ? rk(a.sym) - rk(b.sym) || (a.sym < b.sym ? -1 : 1) : a.sym < b.sym ? -1 : a.sym > b.sym ? 1 : 0; });
    return out;
  }
  function filtered() {
    var q = norm(st.q);
    if (!q) return st.all;
    var qs = q.split(" "), res = [];
    st.all.forEach(function (x) {
      for (var i = 0; i < qs.length; i++) if (x.k.indexOf(qs[i]) < 0) return;
      var s = x.sym.toLowerCase(), r = s === q ? 0 : s.indexOf(q) === 0 ? 1 : s.indexOf(q) > 0 ? 2 : 3;
      res.push([r, x]);
    });
    res.sort(function (a, b) { return a[0] - b[0] || (a[1].sym < b[1].sym ? -1 : a[1].sym > b[1].sym ? 1 : 0); });
    return res.map(function (r) { return r[1]; });
  }

  /* ---------- Giao diện ---------- */
  function build() {
    if (el) return el;
    var r = D.createElement("div");
    r.id = "spk"; r.hidden = true;
    r.innerHTML = '<div class="spk-bg"></div><div class="spk-box" role="group" aria-label="Chọn mã trong sàn">' +
      '<div class="spk-grip"></div>' +
      '<div class="spk-hd"><div class="spk-tt"><b id="spk-title"></b><span id="spk-sub"></span></div><button type="button" class="spk-x" aria-label="Đóng">×</button></div>' +
      '<div class="spk-sr"><input id="spk-q" type="search" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="go" placeholder="Tìm mã hoặc tên công ty…" aria-label="Tìm mã trong sàn"></div>' +
      '<div class="spk-list" id="spk-list" role="listbox" aria-label="Danh sách mã"></div></div>';
    D.body.appendChild(r);
    el = { root: r, box: r.querySelector(".spk-box"), list: r.querySelector("#spk-list"), q: r.querySelector("#spk-q"), title: r.querySelector("#spk-title"), sub: r.querySelector("#spk-sub") };
    r.querySelector(".spk-bg").addEventListener("click", close);
    r.querySelector(".spk-x").addEventListener("click", close);
    el.q.addEventListener("input", function () { st.q = el.q.value; st.act = -1; paint(true); });
    el.list.addEventListener("scroll", function () { if (el.list.scrollTop + el.list.clientHeight > el.list.scrollHeight - 320) more(); }, { passive: true });
    el.list.addEventListener("click", function (e) { var b = e.target.closest(".spk-it"); if (b) pick(b.dataset.s); });
    el.q.addEventListener("keydown", function (e) {
      var rows = el.list.querySelectorAll(".spk-it");
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault(); if (!rows.length) return;
        st.act = Math.max(0, Math.min(rows.length - 1, st.act + (e.key === "ArrowDown" ? 1 : -1)));
        rows.forEach(function (x, i) { x.classList.toggle("act", i === st.act); });
        var a = rows[st.act]; if (a) a.scrollIntoView({ block: "nearest" });
      } else if (e.key === "Enter") {
        e.preventDefault(); var t = rows[st.act >= 0 ? st.act : 0]; if (t) pick(t.dataset.s);
      }
    });
    return el;
  }

  function row(x) {
    var on = x.sym === st.cur;
    return '<button type="button" class="spk-it' + (on ? " on" : "") + '" role="option" aria-selected="' + (on ? "true" : "false") + '" data-s="' + esc(x.sym) + '">' +
      '<b class="spk-s">' + esc(x.sym) + '</b><span class="spk-n"><span class="spk-nm">' + esc(x.name || "—") + "</span>" +
      (x.sector && !x.idx ? '<small>' + esc(x.sector) + "</small>" : "") + "</span>" + (on ? '<i class="spk-ck" aria-hidden="true"></i>' : "") + "</button>";
  }
  function more() {
    if (st.shown >= st.view.length) return;
    var end = Math.min(st.view.length, st.shown + CHUNK), h = "", flat = !!norm(st.q);
    for (var i = st.shown; i < end; i++) {
      var x = st.view[i];
      if (!flat) {
        var g = x.idx ? "Chỉ số" : x.sym.charAt(0);
        if (g !== st.grp) { st.grp = g; h += '<div class="spk-gh">' + esc(g) + "</div>"; }
      }
      h += row(x);
    }
    st.shown = end;
    el.list.insertAdjacentHTML("beforeend", h);
  }
  function stats() {
    var S = W.NHIPSYM, dyn = false; try { dyn = !!(S && S.stats && S.stats().dynamic); } catch (e) { }
    return dyn ? "đầy đủ theo VNDirect + danh bạ" : "danh bạ có sẵn (đang chờ nạp VNDirect)";
  }
  function paint(resetScroll) {
    st.view = filtered(); st.shown = 0; st.grp = "";
    el.list.innerHTML = ""; if (resetScroll) el.list.scrollTop = 0;
    var nm = NAME[st.house] || st.house, q = norm(st.q);
    el.title.textContent = "Mã sàn " + nm;
    el.sub.textContent = (q ? st.view.length + "/" : "") + st.all.length + " mã · " + stats();
    if (!st.view.length) {
      var h = "", up = String(st.q || "").trim().toUpperCase(), other = "";
      try { var inf = /^[A-Z0-9.]{2,12}$/.test(up) && W.NHIPSYM && W.NHIPSYM.info ? W.NHIPSYM.info(up) : null; var f = inf && floorKey(inf.floor); if (f && f !== st.house) other = NAME[f]; } catch (e) { }
      h = other ? "<b>" + esc(up) + "</b> thuộc sàn <b>" + esc(other) + "</b>, không nằm trong " + esc(nm) + ". Hãy chọn tab " + esc(other) + " ở đầu trang để xem mã này."
        : "Không có mã nào khớp trong sàn " + esc(nm) + ".";
      el.list.innerHTML = '<div class="spk-empty">' + h + "</div>"; return;
    }
    more();
  }
  function focusCur() {
    var i = -1; for (var k = 0; k < st.view.length; k++) if (st.view[k].sym === st.cur) { i = k; break; }
    if (i < 0) return;
    while (st.shown <= i) more();
    var r = el.list.querySelector(".spk-it.on"); if (r) el.list.scrollTop = Math.max(0, r.offsetTop - el.list.clientHeight / 2 + r.offsetHeight / 2);
  }
  function place() {
    var box = el.box, trg = D.getElementById("cp-sym") || D.getElementById("tp-sym");
    box.style.cssText = "";
    if (W.matchMedia && W.matchMedia("(min-width:901px)").matches && trg) {
      var r = trg.getBoundingClientRect(), w = Math.min(400, W.innerWidth - 24);
      box.classList.add("pop");
      box.style.left = Math.max(12, Math.min(r.left, W.innerWidth - w - 12)) + "px";
      box.style.top = Math.min(r.bottom + 8, Math.max(12, W.innerHeight - 360)) + "px";
      box.style.width = w + "px";
    } else box.classList.remove("pop");
  }

  function open() {
    if (st.open) return;
    var S = W.NHIPSYM; build();
    st.open = true; st.house = houseNow(); st.q = ""; st.act = -1;
    var h1 = trg(); st.cur = curSym();
    st.all = collect(st.house);
    try { st.ver = S && S.version ? S.version() : -1; } catch (e) { }
    el.q.value = ""; place(); el.root.hidden = false; h1 && h1.setAttribute("aria-expanded", "true");
    paint(true); focusCur();
    if (W.matchMedia && W.matchMedia("(pointer:fine)").matches) { try { el.q.focus({ preventScroll: true }); } catch (e) { } }
    /* danh sách VNDirect nạp xong sau khi mở → tự bổ sung, giữ nguyên ô tìm kiếm */
    try {
      if (S && S.refresh) S.refresh().then(function () {
        if (!st.open || st.house !== houseNow()) return;
        var v = S.version ? S.version() : -1; if (v === st.ver) { el.sub.textContent = (norm(st.q) ? st.view.length + "/" : "") + st.all.length + " mã · " + stats(); return; }
        st.ver = v; st.all = collect(st.house); var keep = el.list.scrollTop; paint(false); while (st.shown < st.view.length && el.list.scrollHeight < keep + el.list.clientHeight + 50) more(); el.list.scrollTop = keep;
      }).catch(function () { });
    } catch (e) { }
  }
  function close() {
    if (!st.open) return;
    st.open = false; if (el) el.root.hidden = true;
    var h1 = trg(); h1 && h1.setAttribute("aria-expanded", "false");
  }
  function pick(sym) {
    sym = String(sym || "").toUpperCase(); if (!sym) return;
    var si = D.getElementById("si"), sf = D.getElementById("sf");
    close();
    if (sym === st.cur) return;
    /* Trang Giao dịch: đổi mã qua đúng luồng của trang (cổng sàn, phiếu lệnh, biểu đồ nhúng) */
    if (D.getElementById("tp-sym") && W.NHIPTrading && W.NHIPTrading.setSymbol) { W.NHIPTrading.setSymbol(sym); return; }
    if (!si || !sf) return;
    si.value = sym;
    if (sf.requestSubmit) sf.requestSubmit(); else sf.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
  }

  /* ---------- Gắn vào tên mã (#cp-sym) ở Biểu đồ + Phân tích ---------- */
  function enhance() {
    var h = trg(); if (!h || h.dataset.spk) return;
    h.dataset.spk = "1"; h.classList.add("spk-trg");
    if (h.id === "tp-sym") { h.setAttribute("aria-haspopup", "listbox"); h.setAttribute("aria-expanded", "false"); return; }
    h.setAttribute("role", "button"); h.setAttribute("tabindex", "0"); h.setAttribute("aria-haspopup", "listbox"); h.setAttribute("aria-expanded", "false");
    h.setAttribute("title", "Chạm để chọn mã khác trong cùng sàn"); h.setAttribute("aria-label", "Chọn mã khác trong sàn");
  }
  var pend = false;
  function sched() { if (pend) return; pend = true; (W.requestAnimationFrame || setTimeout)(function () { pend = false; enhance(); }); }
  D.addEventListener("click", function (e) { var t = e.target.closest && e.target.closest("#cp-sym,#tp-sym"); if (t) { e.preventDefault(); st.open ? close() : open(); } });
  D.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && st.open) { close(); return; }
    var t = e.target; if (t && t.id === "cp-sym" && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); st.open ? close() : open(); }
  });
  W.addEventListener("hashchange", close);
  W.addEventListener("nhip:house-changed", close);
  W.addEventListener("resize", function () { if (st.open) place(); });
  function init() {
    enhance();
    var v = D.getElementById("view") || D.body;
    if (W.MutationObserver) new MutationObserver(sched).observe(v, { childList: true, subtree: true });
  }
  if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", init); else init();
  W.NHIPSymbolPicker = { open: open, close: close, list: function (h) { return collect(h || houseNow()).map(function (x) { return x.sym; }); }, items: function (h) { return collect(h || houseNow()); }, norm: norm };
})();
