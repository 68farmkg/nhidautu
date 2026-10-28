/* NHIP v2.9.2 — lăn chuột trên thanh công cụ vẽ (ngang) thì cuộn ngang. */
(function () {
  "use strict";
  document.addEventListener("wheel", function (e) {
    var r = e.target && e.target.closest ? e.target.closest("#cx-rail") : null;
    if (!r || r.scrollWidth <= r.clientWidth + 1 || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    r.scrollLeft += e.deltaY; e.preventDefault();
  }, { passive: false });
})();
