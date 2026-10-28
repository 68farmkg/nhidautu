/* NHIP: đăng ký service worker + thanh báo offline / không lưu được dữ liệu. */
(function () {
  var bar;
  function show(msg, color) {
    if (!bar) { bar = document.createElement("div"); bar.setAttribute("role", "status"); document.body.appendChild(bar); }
    bar.style.cssText = "position:fixed;left:0;right:0;bottom:0;z-index:99999;padding:8px 12px calc(8px + env(safe-area-inset-bottom));color:#fff;font:600 13px/1.4 system-ui,sans-serif;text-align:center;background:" + (color || "#7a4b00");
    bar.textContent = msg; bar.hidden = false;
  }
  var OFF = "Đang offline — hiển thị giá/tin đã lưu gần nhất. Danh mục, theo dõi, cảnh báo vẫn dùng bình thường.";
  addEventListener("offline", function () { show(OFF); });
  addEventListener("online", function () { if (bar) bar.hidden = true; });
  addEventListener("DOMContentLoaded", function () { if (!navigator.onLine) show(OFF); });
  if (window.NHIP_READY) NHIP_READY.then(function () { if (window.NHIP_NOSTORE) show("Trình duyệt không cho lưu dữ liệu (chế độ riêng tư?). Dữ liệu sẽ mất khi đóng tab.", "#a12b2b"); });
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.addEventListener("message", function (e) { if (e.data && e.data.t === "offline-hit") show(OFF); });
  addEventListener("load", function () { navigator.serviceWorker.register("/nhip/sw.js").catch(function (e) { console.warn("sw", e); }); });
})();
