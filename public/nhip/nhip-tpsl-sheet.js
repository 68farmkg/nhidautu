/* NHỊP v2.40 — CỬA SỔ ĐẶT TP/SL DÙNG CHUNG (trang Giao dịch › Danh mục, biểu đồ).
   Bọc NHIPProtect.mountPanel trong một bảng nổi: điện thoại = trượt từ dưới lên, máy tính = giữa màn hình.
   NHIPTpSl.open({ pid, symbol, kind?, price?, quote(sym)->{last,exch}, onChange?, onFill?(order) })
   Sổ ghi chú trong ứng dụng — không gửi lệnh lên công ty chứng khoán. */
(function (W) {
  "use strict";
  var D = W.document, cur = null;
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  function close() {
    var c = cur; if (!c) return; cur = null;
    D.removeEventListener("keydown", c.key, true);
    ["nhip:orders-changed", "nhip:portfolio-changed"].forEach(function (n) { W.removeEventListener(n, c.rf); });
    try { c.pt.destroy(); } catch (e) { }
    if (c.ov.parentNode) c.ov.parentNode.removeChild(c.ov);
    D.documentElement.classList.remove("tps-lock");
    if (c.o.onClose) { try { c.o.onClose(); } catch (e) { } }
  }
  function open(o) {
    close();
    var P = W.NHIPProtect; if (!P || !P.mountPanel || !o || !o.symbol) return null;
    var sym = String(o.symbol).toUpperCase(), t0 = Date.now();
    var ov = D.createElement("div"); ov.className = "tps-ov";
    ov.innerHTML = '<div class="tps-sheet" role="dialog" aria-modal="true" aria-label="Đặt TP/SL ' + esc(sym) + '">' +
      '<div class="tps-grab" aria-hidden="true"></div>' +
      '<div class="tps-h"><b>Đặt TP / SL · ' + esc(sym) + '</b><button type="button" class="tps-x" aria-label="Đóng">✕</button></div>' +
      '<div class="tps-b"></div></div>';
    D.body.appendChild(ov); D.documentElement.classList.add("tps-lock");
    var body = ov.querySelector(".tps-b");
    var pt = P.mountPanel(body, {
      pid: typeof o.pid === "function" ? o.pid : function () { return o.pid; },
      symbol: function () { return sym; },
      quote: o.quote, kind: o.kind, price: o.price,
      onChange: function () { if (o.onChange) o.onChange(); },
      onFill: function (ord) { close(); if (o.onFill) o.onFill(ord); }
    });
    var key = function (e) { if (e.key === "Escape") { e.stopPropagation(); close(); } };
    D.addEventListener("keydown", key, true);
    ov.addEventListener("click", function (e) { if (e.target === ov && Date.now() - t0 > 350) close(); });
    ov.querySelector(".tps-x").addEventListener("click", close);
    /* giá/đơn đổi từ nơi khác (biểu đồ, bảng lệnh) → vẽ lại bảng */
    var rf = function () { if (cur && cur.pt) cur.pt.refresh(); };
    ["nhip:orders-changed", "nhip:portfolio-changed"].forEach(function (n) { W.addEventListener(n, rf); });
    cur = { ov: ov, pt: pt, key: key, rf: rf, o: o };
    return { close: function () { close(); } };
  }
  W.NHIPTpSl = { open: open, close: function () { close(); }, isOpen: function () { return !!cur; } };
})(window);
