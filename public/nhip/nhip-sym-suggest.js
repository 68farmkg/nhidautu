/* V3.14 — ô tìm mã của công cụ "Mã & rổ" (Live) cũng hiện gợi ý TẤT CẢ mã của đúng sàn đang live; chọn mã → mở mã đó.
   NHIP · V2.50 — GỢI Ý MÃ Ở Ô NHẬP MÃ (Danh mục · Lịch sử · Cài đặt)
   V2.51 — thêm: Tin tức (ô tìm tin), Thị trường › Bộ lọc (ô Mã), Theo dõi (ô Thêm mã + ô Lọc). Ô tìm/lọc là ô GÕ TỰ DO (từ khóa) → không có mã khớp thì tự ẩn gợi ý.
   Bấm vào ô nhập mã → hiện danh sách TẤT CẢ mã của sàn đang đứng (HOSE / HNX / UPCoM), gõ để lọc theo mã, tên doanh nghiệp, ngành.
   Dùng chung nguồn với bộ chọn mã ở Biểu đồ: NHIPSymbolPicker.items() (danh bạ + danh sách niêm yết + mã khách khai báo; đúng sàn).
   V2.53 — thêm: ô mã ở Biểu đồ (#si), Phân tích (#an-symbol), Giao dịch (ô mã + Xem của tab Biểu đồ, cũng là #si) và ô So sánh (#cx-ci). Các ô này đang chứa sẵn mã hiện tại → khi bấm vào sẽ bôi đen mã và hiện TẤT CẢ mã của sàn (chỉ lọc khi bắt đầu gõ); chọn mã → tự bấm "Xem"/"Phân tích" (gửi form). Gỡ thuộc tính list="cx-syms" để không bị trùng gợi ý gốc của trình duyệt.
   Chọn mã → điền vào ô và gửi sự kiện input/change (đi qua đúng luồng cũ, không đổi logic nơi khác). Ô vẫn gõ tay tự do được. */
(function () {
  "use strict";
  var W = window, D = document;
  /* Danh mục: #ps (thêm/gộp vị thế) · #dv-s (cổ tức) · #pfx-s (mua/bán nhanh) · #tx-s (ghi tay) | Lịch sử: #hx-ps · #hx-ts | Cài đặt: mã mặc định · #al-s · #sd-s (danh bạ mã) */
  var SEL = '#ps,#dv-s,#pfx-s,#tx-s,#hx-ps,#hx-ts,#al-s,#sd-s,input[data-pf="sym"],input[data-f="q"],input[data-k="q"],#tw-in,#tw-q,#si,#an-symbol,#cx-ci,.lv-tw input[data-insym],.lv-tw input[data-nvq],.lv-tw input[data-lpin],.lv-tw input[data-q]';
  var PRE = '#si,#an-symbol,#cx-ci,.lv-tw input[data-insym]'; /* ô đã điền sẵn mã hiện tại: mở ra là hiện đủ danh sách, chỉ lọc khi gõ */
  var FREE = 'input[data-k="q"],input[data-f="q"],#tw-q,.lv-tw input[data-nvq],.lv-tw input[data-q]'; /* ô từ khóa: gõ gì cũng được, chỉ gợi ý khi có mã khớp */
  var CHUNK = 60, NAME = { HOSE: "HOSE", HNX: "HNX", UPCOM: "UPCoM" };
  var st = { typed: false, inp: null, all: [], view: [], shown: 0, act: -1, house: "", ver: -2, timer: 0 }, box = null;

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function norm(s) { try { if (W.NHIPSymbolPicker && W.NHIPSymbolPicker.norm) return W.NHIPSymbolPicker.norm(s); } catch (e) { } return String(s || "").toLowerCase().trim(); }
  function house() { try { return W.NHIPHouse && W.NHIPHouse.cur ? W.NHIPHouse.cur() : "HOSE"; } catch (e) { return "HOSE"; } }
  /* V3.11 — trong cửa sổ công cụ của phòng Live: sàn lấy theo cửa sổ đó (HOSE/HNX/UPCoM ở đầu cửa sổ), không theo nhà đang mở bên ngoài */
  function inLive(inp) { try { return inp && inp.closest ? inp.closest(".lv-tw") : null; } catch (e) { return null; } }
  function curHouse() { var tw = inLive(st.inp), h = tw && tw.dataset && tw.dataset.h; return h || house(); }
  function ver() { try { return W.NHIPSYM && W.NHIPSYM.version ? W.NHIPSYM.version() : -1; } catch (e) { return -1; } }
  function load() {
    var h = curHouse(), v = ver(); if (h === st.house && v === st.ver && st.all.length) return;
    st.house = h; st.ver = v; try { st.all = W.NHIPSymbolPicker ? W.NHIPSymbolPicker.items(h) : []; } catch (e) { st.all = []; }
  }
  function build() {
    if (box) return; box = D.createElement("div"); box.id = "nsg"; box.hidden = true; box.setAttribute("role", "listbox");
    box.innerHTML = '<div class="nsg-hd"></div><div class="nsg-ls"></div>'; D.body.appendChild(box);
    box.addEventListener("mousedown", function (e) { e.preventDefault(); }); /* giữ focus ở ô nhập, không bị blur trước khi chọn */
    box.addEventListener("click", function (e) { var b = e.target.closest && e.target.closest("[data-s]"); if (b) pick(b.getAttribute("data-s")); });
    box.querySelector(".nsg-ls").addEventListener("scroll", function () { var l = this; if (l.scrollTop + l.clientHeight > l.scrollHeight - 80) more(); });
  }
  function filter() {
    var q = st.inp && (st.typed || !st.inp.matches(PRE)) ? norm(st.inp.value) : "", all = st.all;
    if (!q) return all.slice();
    var out = [];
    all.forEach(function (x, i) {
      var s = x.sym.toLowerCase(), sc = s === q ? 0 : s.indexOf(q) === 0 ? 1 : s.indexOf(q) > 0 ? 2 : x.k.indexOf(q) >= 0 ? 3 : 9;
      if (sc < 9) out.push([sc, i, x]);
    });
    out.sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    return out.map(function (r) { return r[2]; });
  }
  function rowHtml(x, i) { return '<div class="nsg-it' + (i === st.act ? " act" : "") + '" role="option" data-s="' + esc(x.sym) + '"><b>' + esc(x.sym) + '</b><span class="nsg-n"><em>' + esc(x.name || (x.idx ? "Chỉ số" : "")) + "</em>" + (x.sector ? "<small>" + esc(x.sector) + "</small>" : "") + "</span></div>"; }
  /* V3.12 — gõ mã của sàn khác trong Live: nói rõ mã đó thuộc sàn nào */
  function otherHouse() {
    if (!inLive(st.inp)) return ""; var v = String(st.inp.value || "").toUpperCase().replace(/[^A-Z0-9.]/g, ""); if (v.length < 2) return "";
    try { var f = W.NHIPSYM && W.NHIPSYM.floorOf ? String(W.NHIPSYM.floorOf(v) || "").toUpperCase().replace(/[^A-Z]/g, "") : ""; if (f === "HSX") f = "HOSE"; if (f && f !== st.house) return "Mã " + esc(v) + " thuộc sàn " + esc(NAME[f] || f) + ", không nằm trong sàn " + esc(NAME[st.house] || st.house) + " đang live."; } catch (e) { } return "";
  }
  function paint(keep) {
    var ls = box.querySelector(".nsg-ls"), hd = box.querySelector(".nsg-hd"), nm = NAME[st.house] || st.house;
    st.view = filter(); st.shown = 0; st.act = -1;
    if (!st.view.length && st.all.length && st.inp && st.inp.value.trim() && st.inp.matches(FREE) && !otherHouse()) { box.hidden = true; return; }
    hd.textContent = st.all.length ? nm + " · " + (st.inp && (st.typed || !st.inp.matches(PRE)) && norm(st.inp.value) ? st.view.length + "/" : "") + st.all.length + " mã" : nm + " · đang tải danh sách mã…";
    ls.innerHTML = st.view.length ? "" : '<div class="nsg-em">' + (st.all.length ? (otherHouse() || "Không có mã nào khớp trong sàn " + esc(nm)) : "Chưa có dữ liệu mã") + "</div>";
    if (!keep) ls.scrollTop = 0; place(); more(); while (st.shown < st.view.length && ls.scrollHeight <= ls.clientHeight + 40) more();
  }
  function more() {
    if (st.shown >= st.view.length) return; var ls = box.querySelector(".nsg-ls"), a = st.shown, b = Math.min(st.view.length, a + CHUNK), h = "";
    for (var i = a; i < b; i++) h += rowHtml(st.view[i], i); ls.insertAdjacentHTML("beforeend", h); st.shown = b;
  }
  function place() {
    if (!box || box.hidden || !st.inp) return; if (!st.inp.isConnected) { close(); return; }
    var r = st.inp.getBoundingClientRect(), vh = W.innerHeight, vw = W.innerWidth, w = Math.min(vw - 16, Math.max(r.width, 260)), left = Math.max(8, Math.min(r.left, vw - w - 8));
    var below = vh - r.bottom - 10, above = r.top - 10, up = below < 170 && above > below, maxH = Math.max(120, Math.min(340, up ? above : below));
    box.style.left = left + "px"; box.style.width = w + "px"; box.style.maxHeight = maxH + "px";
    if (up) { box.style.top = "auto"; box.style.bottom = (vh - r.top + 4) + "px"; } else { box.style.bottom = "auto"; box.style.top = (r.bottom + 4) + "px"; }
  }
  function open(inp) {
    build(); if (st.inp !== inp) { st.inp = inp; st.typed = false; try { inp.setAttribute("autocomplete", "off"); inp.setAttribute("autocapitalize", "characters"); if (inp.hasAttribute("list")) inp.removeAttribute("list"); if (inp.matches(PRE)) inp.select(); } catch (e) { } }
    load(); box.classList.toggle("nsg-live", !!inLive(inp)); box.hidden = false; paint(false); clearInterval(st.timer);
    st.timer = setInterval(function () { if (!st.inp || !st.inp.isConnected) { close(); return; } if (curHouse() !== st.house || ver() !== st.ver) { load(); paint(true); } }, 1200); /* danh sách niêm yết nạp xong → tự cập nhật */
  }
  function close() { if (box) box.hidden = true; clearInterval(st.timer); st.inp = null; }
  function pick(sym) {
    var inp = st.inp; if (!inp) return; var hs = st.house; inp.value = sym; close();
    inp.dispatchEvent(new Event("input", { bubbles: true })); inp.dispatchEvent(new Event("change", { bubbles: true })); try { inp.blur(); } catch (e) { }
    try { W.dispatchEvent(new CustomEvent("nhip:sym-picked", { detail: { sym: sym, input: inp, house: hs } })); } catch (e) { }
    if (inp.matches(PRE) && inp.form) setTimeout(function () { try { if (inp.form.requestSubmit) inp.form.requestSubmit(); else inp.form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); } catch (e) { } }, 0); /* chọn xong là xem luôn (đi qua cổng sàn có sẵn) */
  }
  function setAct(n) {
    var ls = box.querySelector(".nsg-ls"); if (!st.view.length) return; while (n >= st.shown && st.shown < st.view.length) more();
    st.act = Math.max(0, Math.min(st.view.length - 1, n)); Array.prototype.forEach.call(ls.querySelectorAll(".nsg-it"), function (e, i) { e.classList.toggle("act", i === st.act); });
    var el = ls.querySelectorAll(".nsg-it")[st.act]; if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest" });
  }

  D.addEventListener("focusin", function (e) { var t = e.target; if (t && t.matches && t.matches(SEL) && !t.readOnly && !t.disabled) open(t); });
  D.addEventListener("click", function (e) { var t = e.target; if (t && t.matches && t.matches(SEL) && !t.readOnly && !t.disabled && (!box || box.hidden)) open(t); }); /* ô đang focus mà panel đã đóng (vừa chọn xong) → bấm lại để mở */
  D.addEventListener("input", function (e) { if (st.inp && e.target === st.inp && box) { if (e.isTrusted) st.typed = true; box.hidden = false; paint(false); } });
  D.addEventListener("keydown", function (e) {
    if (!box || box.hidden || !st.inp || e.target !== st.inp) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setAct(st.act + 1); } else if (e.key === "ArrowUp") { e.preventDefault(); setAct(st.act - 1); }
    else if (e.key === "Enter" && st.act >= 0 && st.view[st.act]) { e.preventDefault(); e.stopPropagation(); pick(st.view[st.act].sym); }
    else if (e.key === "Escape") { close(); } else if (e.key === "Tab") { close(); }
  }, true);
  D.addEventListener("pointerdown", function (e) { if (!box || box.hidden) return; if (box.contains(e.target) || e.target === st.inp) return; close(); }, true);
  D.addEventListener("focusout", function (e) { if (e.target === st.inp) setTimeout(function () { if (st.inp && D.activeElement !== st.inp && !(box && box.contains(D.activeElement))) close(); }, 160); });
  W.addEventListener("resize", place); W.addEventListener("scroll", place, true); if (W.visualViewport) { W.visualViewport.addEventListener("resize", place); W.visualViewport.addEventListener("scroll", place); }
  W.addEventListener("nhip:house-changed", close); W.addEventListener("hashchange", close);
  W.NHIPSymSuggest = { selectors: SEL, close: close };
})();
