/* NHIP v2.7 — bộ tăng/giảm + chip nhanh dùng chung cho form Danh mục (Thêm/gộp vị thế, Ghi tay).
   Gắn một lần ở document nên vẫn chạy khi app.js vẽ lại form. Không đụng logic lưu của form. */
(function () {
  "use strict";
  var D = document;
  function parse(s) { /* chấp nhận 98.500 · 98,500 · 98500 · 1.250,5 */
    s = String(s == null ? "" : s).replace(/[\s₫đ]/g, ""); if (!s) return 0;
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
    else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, "");
    else s = s.replace(",", ".");
    var n = parseFloat(s); return isFinite(n) ? n : 0;
  }
  function fmt(n) { return n > 0 ? Math.round(n).toLocaleString("vi-VN") : ""; }
  function fire(inp) { try { inp.dispatchEvent(new Event("input", { bubbles: true })); inp.dispatchEvent(new Event("change", { bubbles: true })); } catch (e) { } }
  function symOf(form) { var s = form && form.querySelector("#ps,#tx-s"); return s ? String(s.value || s.placeholder || "").toUpperCase().trim() : ""; }
  function stepPrice(cur, dir, form) {
    var O = window.NHIPOrders, sym = symOf(form), ex = "HOSE";
    try { if (O && O.getExch) ex = O.getExch(sym, "HOSE"); } catch (e) { }
    try { if (O && O.step) return O.step(cur > 0 ? cur : 0, ex, dir); } catch (e) { }
    var t = cur < 10000 ? 10 : cur < 50000 ? 50 : 100; /* dự phòng: bước giá HOSE */
    return Math.max(t, Math.round((cur + dir * t) / t) * t);
  }
  function inputOf(btn) { var w = btn.closest(".nx-step"); return w ? w.querySelector("input") : null; }

  D.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-nx]"); if (!b) return;
    var kind = b.getAttribute("data-nx"), form = b.closest("form"), inp;
    if (kind === "q" || kind === "p") {          /* nút − / + */
      inp = inputOf(b); if (!inp) return; e.preventDefault();
      var d = +b.getAttribute("data-d") || 0, cur = parse(inp.value);
      if (kind === "q") inp.value = fmt(Math.max(0, cur + d));
      else inp.value = fmt(stepPrice(cur, d < 0 ? -1 : 1, form));
      fire(inp); inp.focus({ preventScroll: true });
    } else if (kind === "set") {                  /* chip số lượng: 100 · 200 · 500 · 1.000 */
      inp = form && form.querySelector("#" + b.getAttribute("data-for")); if (!inp) return; e.preventDefault();
      inp.value = fmt(+b.getAttribute("data-v") || 0); fire(inp);
    } else if (kind === "add") {                  /* chip cộng thêm */
      inp = form && form.querySelector("#" + b.getAttribute("data-for")); if (!inp) return; e.preventDefault();
      inp.value = fmt(Math.max(0, parse(inp.value) + (+b.getAttribute("data-v") || 0))); fire(inp);
    }
  });

  /* Tự định dạng dấu chấm nghìn khi rời ô (không làm gián đoạn lúc gõ) */
  D.addEventListener("focusout", function (e) {
    var t = e.target; if (!t || !t.matches || !t.matches(".nx-step input")) return;
    var n = parse(t.value); t.value = n > 0 ? (Math.abs(n - Math.round(n)) > 1e-9 ? String(n).replace(".", ",") : fmt(n)) : "";
  });
  window.NHIPTradeUI = { parse: parse, fmt: fmt };
})();
