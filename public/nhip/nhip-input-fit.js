/* NHIP · Ô nhập tay tự co chữ (v2.7.6)
   Khi chữ đang nhập chạm mép phải của ô, cỡ chữ tự hạ từng 0,5px (tối thiểu ~55% cỡ gốc, không dưới 9px);
   xóa bớt chữ thì cỡ chữ tự nở lại. Áp dụng cho MỌI ô nhập tay (kể cả ô được dựng lại về sau). Không đổi dữ liệu/logic. */
(function () {
  "use strict";
  var TYPES = { text: 1, search: 1, tel: 1, number: 1, email: 1, url: 1, "": 1 };
  var cv = document.createElement("canvas").getContext("2d");
  function ok(el) {
    if (!el || el.tagName !== "INPUT") return false;
    var t = (el.getAttribute("type") || "").toLowerCase();
    return !!TYPES[t] && !el.hidden;
  }
  function fit(el) {
    var cs, w = el.clientWidth;
    if (!w) return;
    var key = el.value + "|" + w;
    if (el._nifKey === key) return;
    el._nifKey = key;
    if (el._nifSet) { el.style.fontSize = ""; el._nifSet = false; }
    var v = el.value;
    if (!v) return;
    cs = getComputedStyle(el);
    var base = parseFloat(cs.fontSize) || 14,
      avail = w - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0) - 2,
      min = Math.max(9, base * 0.55), fs = base;
    function width(sz) {
      cv.font = (cs.fontStyle || "normal") + " " + (cs.fontWeight || "400") + " " + sz + "px " + cs.fontFamily;
      var ls = parseFloat(cs.letterSpacing) || 0;
      return cv.measureText(v).width + ls * v.length;
    }
    if (width(fs) <= avail) return;
    while (fs > min && width(fs) > avail) fs -= 0.5;
    el.style.fontSize = fs + "px";
    el._nifSet = true;
  }
  function all() {
    var l = document.querySelectorAll("input");
    for (var i = 0; i < l.length; i++) if (ok(l[i])) fit(l[i]);
  }
  function one(e) { var t = e.target; if (ok(t)) { t._nifKey = null; fit(t); } }
  document.addEventListener("input", one, true);
  document.addEventListener("change", one, true);
  document.addEventListener("focusin", one, true);
  var raf = 0;
  function later() { if (raf) return; raf = requestAnimationFrame(function () { raf = 0; all(); }); }
  new MutationObserver(later).observe(document.documentElement, { childList: true, subtree: true });
  addEventListener("resize", later);
  if (window.visualViewport) visualViewport.addEventListener("resize", later);
  setInterval(all, 700); /* bắt các ô được gán giá trị bằng mã (không phát sự kiện input) */
  if (document.readyState !== "loading") later(); else document.addEventListener("DOMContentLoaded", later);
})();
