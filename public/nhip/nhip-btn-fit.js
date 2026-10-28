/* NHIP v2.7.29 — Chữ trong nút tự co để nằm gọn và canh giữa trong ô (Chờ mua / Take profit / Stop loss, Lệnh thường / Lệnh chờ,
   LO·ATO·ATC·MP, Mua / Bán, Quay lại / Xác nhận…). Chỉ đổi cỡ chữ của nút (tối thiểu 9px), không đổi dữ liệu/logic. */
(function () {
  "use strict";
  var SEL = ".od-kinds button,.pt-kinds button,.tr-mode button,.tr-ot button,.tr-side button,.tr-cf .tr-row button,.tp-act button,.od-fg .od-chips button";
  var cv = document.createElement("canvas").getContext("2d");
  function fit(b) {
    var txt = (b.textContent || "").replace(/\s+/g, " ").trim(), w = b.clientWidth;
    if (!txt || !w) return;
    var key = txt + "|" + w;
    if (b._nbfKey === key) return;
    b._nbfKey = key;
    if (b._nbfSet) { b.style.fontSize = ""; b._nbfSet = false; }
    var cs = getComputedStyle(b),
      base = parseFloat(cs.fontSize) || 13,
      avail = w - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0) - (parseFloat(cs.borderLeftWidth) || 0) - (parseFloat(cs.borderRightWidth) || 0) - 2,
      min = Math.min(base, 9), fs = base;
    function width(sz) {
      cv.font = (cs.fontStyle || "normal") + " " + (cs.fontWeight || "400") + " " + sz + "px " + cs.fontFamily;
      var ls = parseFloat(cs.letterSpacing) || 0;
      return cv.measureText(txt).width + ls * txt.length;
    }
    if (width(fs) <= avail) return;
    while (fs > min && width(fs) > avail) fs -= 0.5;
    b.style.fontSize = fs + "px"; b._nbfSet = true;
  }
  function run() { document.querySelectorAll(SEL).forEach(fit); }
  var raf = 0;
  function later() { if (raf) return; raf = requestAnimationFrame(function () { raf = 0; run(); }); }
  if (window.MutationObserver) new MutationObserver(later).observe(document.body, { childList: true, subtree: true, characterData: true });
  window.addEventListener("resize", later);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(later);
  later(); setTimeout(later, 400);
})();
