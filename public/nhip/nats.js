/* NHIP · NATS v2.0 — hành vi giao diện (không đổi dữ liệu/logic).
   1) Nhóm chức năng trên thanh bên (PC)  2) Gợi ý mờ dần cho hàng/bảng cuộn ngang
   3) Theo dõi vùng nhìn thực (bàn phím ảo) cho popup/phiếu lệnh  4) Tooltip cho thanh bên thu gọn */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };

  /* 1. Nhóm menu: THỊ TRƯỜNG · ĐẦU TƯ · THÔNG TIN · HỆ THỐNG */
  var GROUPS = { "dashboard": "Thị trường", "danh-muc": "Đầu tư", "tin-tuc": "Thông tin", "lich-su": "Hệ thống" };
  function groups() {
    var sb = $(".sidebar"); if (!sb || sb.dataset.nats) return;
    sb.dataset.nats = "1";
    $$(".nav", sb).forEach(function (a) {
      var t = a.querySelector("span"); if (t && !a.title) a.title = t.textContent.trim();
      var g = GROUPS[a.dataset.r]; if (!g) return;
      var h = document.createElement("div"); h.className = "nats-grp"; h.textContent = g; h.setAttribute("aria-hidden", "true");
      sb.insertBefore(h, a);
    });
  }

  /* 2. Gợi ý cuộn ngang */
  var SEL = ".cx-bar .tf,.tp-tabs,.st-nav,.chips,.pf-tabs,.tw,.db-table-wrap,.tp-tw,.od-tw,.pt-tw,.tf.tabs:not(#tabs):not(#an-tabs),.aix-modes,.aix-sug";
  function hint(el) {
    var o = el.scrollWidth > el.clientWidth + 2;
    el.classList.toggle("nats-ov", o);
    el.classList.toggle("nats-l", o && el.scrollLeft > 2);
    el.classList.toggle("nats-r", o && el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }
  function scan() {
    $$(SEL).forEach(function (el) {
      if (!el.dataset.natsH) { el.dataset.natsH = "1"; el.addEventListener("scroll", function () { hint(el); }, { passive: true }); }
      hint(el);
    });
  }
  /* 4. Popup nằm trên cùng: đánh dấu <html> khi có popup để nâng lớp phiếu lệnh (sticky) lên trên biểu đồ */
  function modalFlag() {
    var on = !!$(".tr-ov,.ol-pop,.acc-modal");
    document.documentElement.classList.toggle("nats-modal", on);
  }

  /* 5. Chữ tự co: hạ cỡ chữ từng bước 0,5px đến khi hết tràn ngang (không dưới ~62% cỡ gốc) */
  var FIT = "#aw,.tp-star,.tp-b,.tp-s,.tp-go-buy,.tp-go-sell,.tr-go,.tp-seg button,.tp-wt button,.tp-wr,.tp-rng button," +
    ".tp-tabs button,.ol-bar button,.ol-bt,.tr-cf .tr-row>*,.tr-who b,.tr-cf h3," +
    ".tp-stats dd,.tp-px b,.tp-acct b,.tr-side button,.cp-actions .btn,[data-nfit]";
  function fitText(el) {
    if (!el.clientWidth) return;
    if (el.dataset.natsF) { el.style.fontSize = ""; delete el.dataset.natsF; }
    if (el.scrollWidth <= el.clientWidth + 1) return;
    var fs = parseFloat(getComputedStyle(el).fontSize) || 14, min = Math.max(9, fs * 0.62);
    while (fs > min && el.scrollWidth > el.clientWidth + 1) { fs -= 0.5; el.style.fontSize = fs + "px"; }
    el.dataset.natsF = "1";
  }
  /* Popup: khung thu nhỏ đồng đều (--zf) cho đến khi mọi thành phần nằm gọn trong một khung */
  function fitBox(box) {
    box.style.removeProperty("--zf");
    var zf = 1, g = 0;
    while (g++ < 14 && zf > 0.6 && (box.scrollHeight > box.clientHeight + 1 || box.scrollWidth > box.clientWidth + 1)) {
      zf = Math.round((zf - 0.04) * 100) / 100; box.style.setProperty("--zf", zf);
    }
  }
  function fitAll() {
    $$(".tr-cf").forEach(fitBox); /* .ol-pop (popup lệnh trên biểu đồ) cỡ cố định — không zoom */
    $$(FIT).forEach(fitText);
    /* hộp thoại có thể vừa đổi nội dung → chữ trong đó co lại lần nữa sau khi khung đã chốt tỷ lệ */
  }
  var ft = 0;
  function laterFit() { clearTimeout(ft); ft = setTimeout(fitAll, 90); }

  var raf = 0;
  function later() { if (raf) return; raf = requestAnimationFrame(function () { raf = 0; groups(); scan(); modalFlag(); laterFit(); }); }

  /* 3. Vùng nhìn thực: bàn phím ảo hiện thì popup co lại, vẫn cuộn tới nút hành động */
  function vv() {
    var h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    document.documentElement.style.setProperty("--vvh", Math.round(h) + "px");
    document.documentElement.style.setProperty("--vvt", Math.round(window.visualViewport ? window.visualViewport.offsetTop : 0) + "px");
  }
  if (window.visualViewport) { visualViewport.addEventListener("resize", function () { vv(); laterFit(); }); visualViewport.addEventListener("scroll", vv); }
  addEventListener("resize", function () { vv(); later(); laterFit(); });
  addEventListener("orientationchange", function () { setTimeout(function () { vv(); later(); }, 250); });
  addEventListener("hashchange", function () { setTimeout(later, 120); });
  /* ô nhập lấy tiêu điểm trong popup: cuộn vào giữa vùng nhìn, không bị bàn phím che */
  document.addEventListener("focusin", function (e) {
    var t = e.target; if (!t || !/^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName)) return;
    if (t.closest(".tr-cf,.tr.is-sheet,.acc-card")) setTimeout(function () { try { t.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (_) {} }, 280);
  });

  vv();
  var root = $("#view") || document.body;
  if (window.MutationObserver) new MutationObserver(later).observe(document.body, { childList: true, subtree: true });
  later(); setTimeout(later, 600);
})();
