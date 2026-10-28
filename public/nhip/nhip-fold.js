/* NHIP V2.7.11 — Nút tam giác thu/mở thanh công cụ + khung giờ (Biểu đồ · Phân tích · Giao dịch).
   Tam giác ▼ = đang THU (ẩn công cụ, khung giờ, dòng OHLC, thanh vẽ) · Tam giác ▲ = đang MỞ (như cũ).
   Trạng thái nhớ trong localStorage (dùng chung 3 mục). Không đổi logic biểu đồ. */
(function () {
  "use strict";
  var KEY = "nhip.fold.v1", H = document.documentElement;
  function load() { try { return localStorage.getItem(KEY) === "1"; } catch (_) { return false; } }
  function save(v) { try { localStorage.setItem(KEY, v ? "1" : "0"); } catch (_) {} }
  var folded = load();
  var TRI = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>';
  function apply() {
    H.classList.toggle("nx-fold-on", folded);
    document.querySelectorAll(".nx-fold-btn").forEach(function (b) {
      b.setAttribute("aria-expanded", folded ? "false" : "true");
      b.setAttribute("aria-label", folded ? "Mở công cụ và khung giờ" : "Thu gọn công cụ và khung giờ");
      b.title = folded ? "Đang thu — bấm để mở" : "Đang mở — bấm để thu";
      b.classList.toggle("is-folded", folded);
    });
  }
  function mount() {
    document.querySelectorAll(".cx-bar").forEach(function (bar) {
      var p = bar.previousElementSibling;
      if (p && p.classList.contains("nx-fold")) return;
      var row = document.createElement("div");
      row.className = "nx-fold";
      row.innerHTML = '<button type="button" class="nx-fold-btn">' + TRI + "</button>";
      bar.parentNode.insertBefore(row, bar);
    });
    apply();
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest(".nx-fold-btn"); if (!b) return;
    folded = !folded; save(folded); apply();
    /* biểu đồ tự co giãn lại theo chiều cao mới */
    setTimeout(function () { try { window.dispatchEvent(new Event("resize")); } catch (_) {} }, 60);
  });
  var raf = 0;
  function later() { if (raf) return; raf = requestAnimationFrame(function () { raf = 0; mount(); }); }
  if (window.MutationObserver) new MutationObserver(later).observe(document.body, { childList: true, subtree: true });
  apply(); later(); setTimeout(later, 500);
})();
