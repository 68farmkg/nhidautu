/* NHIP v2.9 — THANH KÉO dưới thanh chọn nhanh (.nx-seg[data-rkind]) — đồng bộ hai chiều với ô nhập ngay phía trên.
   Thanh chọn nhanh khai báo: data-rkind="price|qty", data-rmin/data-rmax (cố định) HOẶC data-rref="selector ô giá vào" + data-rlo/data-rhi (% so với ô đó),
   data-rstep, data-rex (sàn → làm tròn theo bước giá), data-rempty="min|max" (vị trí khi ô còn trống).
   Kéo = sự kiện input (nxRng:"drag") trên ô nhập; thả = sự kiện change (nxRng:"end"), nên toàn bộ logic kiểm tra/lưu có sẵn không đổi. */
(function () {
  "use strict";
  if (typeof document === "undefined") return;
  var D = document, W = window;
  var fmt = function (v) { return String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, "."); };
  var num = function (s) { var n = parseInt(String(s == null ? "" : s).replace(/[^\d]/g, ""), 10); return isFinite(n) ? n : 0; };
  var rootOf = function (bar) { return bar.closest(".od-add,.ol-pop") || D; };
  var inputOf = function (bar) { return bar.parentElement && bar.parentElement.querySelector("input:not([type=range])"); };
  function bounds(bar) {
    var a = bar.dataset, mn, mx;
    if (a.rref) {
      var rf = rootOf(bar).querySelector(a.rref), ref = rf ? num(rf.value) : 0; if (!(ref > 0)) return null;
      mn = ref * (1 + (+a.rlo || 0) / 100); mx = ref * (1 + (+a.rhi || 0) / 100);
    } else { mn = +a.rmin; mx = +a.rmax; }
    if (!isFinite(mn) || !isFinite(mx) || mx <= mn) return null;
    var st = +a.rstep || 1, NO = W.NHIPOrders;
    if (a.rkind === "price" && a.rex && NO && NO.snap) { mn = NO.snap(mn, a.rex, 1); mx = NO.snap(mx, a.rex, -1); if (mx <= mn) return null; }
    else { mn = Math.ceil(mn / st) * st; mx = Math.floor(mx / st) * st; if (mx <= mn) return null; }
    return { mn: mn, mx: mx, st: st };
  }
  function sync(r) {
    var bar = r._bar, inp = inputOf(bar), b = bounds(bar);
    if (!b || !inp) { r.hidden = true; return; } r.hidden = false;
    r.min = b.mn; r.max = b.mx; r.step = b.st;
    var v = num(inp.value), e = bar.dataset.rempty;
    if (!v) v = e === "max" ? b.mx : b.mn;
    r.value = Math.min(b.mx, Math.max(b.mn, v));
    var pc = (r.value - b.mn) / (b.mx - b.mn) * 100; r.style.setProperty("--p", pc + "%");
    r.setAttribute("aria-valuetext", fmt(num(inp.value) || r.value));
  }
  function attach(bar) {
    var nx = bar.nextElementSibling; if (nx && nx.classList.contains("nx-rng")) { nx._bar = bar; sync(nx); return; }
    var r = D.createElement("input"); r.type = "range"; r.className = "nx-rng"; r._bar = bar;
    r.setAttribute("aria-label", bar.getAttribute("aria-label") ? "Thanh kéo: " + bar.getAttribute("aria-label") : "Thanh kéo");
    bar.parentNode.insertBefore(r, bar.nextSibling); sync(r);
  }
  function ev(inp, type, ph) { var e = new Event(type, { bubbles: true }); e.nxRng = ph; inp.dispatchEvent(e); }
  D.addEventListener("input", function (e) {
    var t = e.target;
    if (t.classList && t.classList.contains("nx-rng")) {
      var bar = t._bar, inp = inputOf(bar), a = bar.dataset, v = +t.value, NO = W.NHIPOrders; if (!inp) return;
      if (a.rkind === "price" && a.rex && NO && NO.snap) v = NO.snap(v, a.rex, 0);
      inp.value = fmt(v); t.style.setProperty("--p", ((t.value - t.min) / (t.max - t.min) * 100) + "%"); ev(inp, "input", "drag"); return;
    }
    rescan(); /* gõ số → thanh kéo chạy theo */
  });
  D.addEventListener("change", function (e) { var t = e.target; if (t.classList && t.classList.contains("nx-rng")) { var inp = inputOf(t._bar); if (inp) ev(inp, "change", "end"); } });
  D.addEventListener("click", function () { setTimeout(rescan, 0); });
  function rescan() {
    var bars = D.querySelectorAll(".nx-seg[data-rkind]");
    for (var i = 0; i < bars.length; i++) attach(bars[i]);
  }
  var pend = 0, sched = function () { if (pend) return; pend = 1; (W.requestAnimationFrame || setTimeout)(function () { pend = 0; rescan(); }); };
  if (typeof MutationObserver === "function") new MutationObserver(sched).observe(D.body || D.documentElement, { childList: true, subtree: true });
  if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", rescan); else rescan();
  W.NHIPSlider = { rescan: rescan };
})();
