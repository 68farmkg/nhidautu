/* NHIP · Điều hướng điện thoại: 4 mục chính (có Giao dịch) + "Thêm" (mở bảng chọn). Chỉ hiện khi màn hình ≤ 900px. */
(function () {
  var MAIN = [["dashboard", "Dashboard"], ["tong-quan", "Biểu đồ"], ["phan-tich", "Phân tích"], ["giao-dich", "Giao dịch"]];
  var MORE = [["thi-truong", "Thị trường"], ["danh-muc", "Danh mục"], ["theo-doi", "Theo dõi"], ["canh-bao", "Cảnh báo"], ["tin-tuc", "Tin tức"], ["ai", "Phân tích AI"], ["lich-su", "Lịch sử"], ["cai-dat", "Cài đặt"]];
  var MORE_KEYS = MORE.map(function (m) { return m[0]; });
  var icon = function (r) { var n = document.querySelector('.sidebar .nav[data-r="' + r + '"] .ni'); return n ? n.outerHTML : ""; };
  var moreIcon = '<svg class="ni" viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>';

  var nav = document.createElement("nav");
  nav.id = "mnav"; nav.setAttribute("aria-label", "Điều hướng chính");
  nav.innerHTML = MAIN.map(function (m) { return '<a href="#/' + m[0] + '" data-r="' + m[0] + '">' + icon(m[0]) + "<span>" + m[1] + "</span></a>"; }).join("") +
    '<button type="button" id="mmore" aria-haspopup="dialog" aria-expanded="false">' + moreIcon + "<span>Thêm</span><i class=\"mdot\" hidden></i></button>";

  var sheet = document.createElement("div");
  sheet.id = "msheet"; sheet.hidden = true; sheet.setAttribute("role", "dialog"); sheet.setAttribute("aria-label", "Thêm mục");
  sheet.innerHTML = '<div class="ms-bg"></div><div class="ms-box"><div class="ms-grip"></div><div class="ms-title">Tất cả mục</div><div class="ms-grid">' +
    MORE.map(function (m) { return '<a href="#/' + m[0] + '" data-r="' + m[0] + '">' + icon(m[0]) + "<span>" + m[1] + "</span>" + (m[0] === "canh-bao" ? '<b class="ms-badge" hidden></b>' : "") + "</a>"; }).join("") + "</div></div>";
  document.body.append(nav, sheet);

  var more = nav.querySelector("#mmore");
  var open = function (v) { sheet.hidden = !v; more.setAttribute("aria-expanded", v ? "true" : "false"); document.documentElement.classList.toggle("ms-open", v); };
  more.onclick = function () { open(sheet.hidden); };
  sheet.querySelector(".ms-bg").onclick = function () { open(false); };
  sheet.addEventListener("click", function (e) { if (e.target.closest("a")) open(false); });
  addEventListener("keydown", function (e) { if (e.key === "Escape") open(false); });

  var sync = function () {
    var a = document.querySelector(".sidebar .nav.active"), r = a && a.dataset.r;
    nav.querySelectorAll("a").forEach(function (x) { x.classList.toggle("on", x.dataset.r === r); });
    sheet.querySelectorAll("a").forEach(function (x) { x.classList.toggle("on", x.dataset.r === r); });
    more.classList.toggle("on", MORE_KEYS.indexOf(r) >= 0);
    var b = document.getElementById("alBadge"), n = b && !b.hidden ? b.textContent : "";
    var sb = sheet.querySelector(".ms-badge"), dot = more.querySelector(".mdot");
    if (sb) { sb.hidden = !n; sb.textContent = n; } if (dot) dot.hidden = !n;
  };
  var sb = document.querySelector(".sidebar");
  if (sb && window.MutationObserver) new MutationObserver(sync).observe(sb, { subtree: true, attributes: true, childList: true, characterData: true });
  addEventListener("hashchange", function () { open(false); setTimeout(sync, 0); });
  sync();
})();
