/* NHỊP V2.85 — lưu mã/tin ở Dashboard · menu AI theo nhóm · ô chat tự giãn */
(function () {
  "use strict";
  var GROUPS = [["Tổng quan", ["Tự động", "Dashboard", "Thị trường"]], ["Phân tích & giao dịch", ["Biểu đồ", "Phân tích", "Giao dịch"]], ["Của tôi", ["Danh mục", "Theo dõi", "Cảnh báo", "Lịch sử"]], ["Tin & hệ thống", ["Tin tức", "Phân tích AI", "Cài đặt"]]];
  var raf = 0;
  function sync() {
    raf = 0;
    document.querySelectorAll(".aix-sug button:not([title]),.an-sug button:not([title])").forEach(function (b) { b.title = b.textContent.trim() });
    var S = window.NHIPSave; if (!S) return;
    document.querySelectorAll(".sv-sym").forEach(function (b) { var on = S.hasW(b.dataset.svs); var v = on ? "★" : "☆"; if (b.getAttribute("aria-pressed") !== String(on)) b.setAttribute("aria-pressed", on); if (b.textContent !== v) b.textContent = v });
    document.querySelectorAll(".sv-news").forEach(function (b) { var on = S.hasN(b.dataset.svn); var v = on ? "★" : "☆", t = b.querySelector("span"), tv = on ? "Đã lưu" : "Lưu tin"; if (b.getAttribute("aria-pressed") !== String(on)) b.setAttribute("aria-pressed", on); if (b.firstChild.nodeValue !== v) b.firstChild.nodeValue = v; if (t && t.textContent !== tv) t.textContent = tv });
    document.querySelectorAll(".aix:not([data-v285])").forEach(enhance);
    document.querySelectorAll(".aix[data-v285]").forEach(label);
  }
  function label(r) { var on = r.querySelector("[data-m].on"), c = r.querySelector(".aix-cur b"); if (on && c && c.textContent !== on.textContent) c.textContent = on.textContent }
  function enhance(r) {
    var bar = r.querySelector(".aix-modes"); if (!bar) return;
    r.dataset.v285 = 1; r.classList.remove("aix-open"); bar.classList.add("aix-g");
    var btns = [].slice.call(bar.querySelectorAll("[data-m]")), used = {}, frag = document.createDocumentFragment();
    GROUPS.forEach(function (g) {
      var list = btns.filter(function (b) { return g[1].indexOf(b.textContent.trim()) > -1 }); if (!list.length) return;
      var d = document.createElement("div"), w = document.createElement("div"); d.className = "aix-grp"; d.innerHTML = "<em>" + g[0] + "</em>";
      list.forEach(function (b) { used[b.dataset.m] = 1; w.appendChild(b) }); d.appendChild(w); frag.appendChild(d)
    });
    var rest = btns.filter(function (b) { return !used[b.dataset.m] });
    if (rest.length) { var d2 = document.createElement("div"), w2 = document.createElement("div"); d2.className = "aix-grp"; d2.innerHTML = "<em>Khác</em>"; rest.forEach(function (b) { w2.appendChild(b) }); d2.appendChild(w2); frag.appendChild(d2) }
    bar.appendChild(frag);
    var cur = document.createElement("button"); cur.type = "button"; cur.className = "aix-cur"; cur.setAttribute("aria-haspopup", "true"); cur.setAttribute("aria-expanded", "false");
    cur.innerHTML = '<span>Mục AI:</span><b></b><small>Đổi mục</small><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
    var top = r.querySelector(".aix-top"); if (top) top.appendChild(cur); else bar.parentNode.insertBefore(cur, bar);
    cur.onclick = function () { var o = r.classList.toggle("aix-open"); cur.setAttribute("aria-expanded", o) };
    bar.addEventListener("click", function (e) { if (e.target.closest("[data-m]")) setTimeout(function () { r.classList.remove("aix-open"); cur.setAttribute("aria-expanded", false); label(r) }, 0) });
    label(r)
  }
  function grow(t) { t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 160) + "px" }
  document.addEventListener("click", function (e) {
    var b = e.target.closest(".sv-btn");
    if (b) {
      e.preventDefault(); e.stopPropagation(); var S = window.NHIPSave; if (!S) return;
      if (b.dataset.svs) S.toggleW(b.dataset.svs).then(sync); else if (b.dataset.svn) { S.toggleN(b.dataset.svn); sync() }
      return
    }
    document.querySelectorAll(".aix.aix-open").forEach(function (r) { if (!r.contains(e.target)) r.classList.remove("aix-open") })
  }, true);
  document.addEventListener("wheel", function (e) {
    var r = e.target.closest && e.target.closest(".aix-sug,.an-sug"); if (!r || r.scrollWidth <= r.clientWidth + 1) return;
    var d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY; if (!d) return;
    var max = r.scrollWidth - r.clientWidth, nx = Math.max(0, Math.min(max, r.scrollLeft + d));
    if (nx === r.scrollLeft) return; e.preventDefault(); r.scrollLeft = nx
  }, { passive: false });
  document.addEventListener("input", function (e) { if (e.target.matches && e.target.matches("textarea.aix-q")) grow(e.target) });
  document.addEventListener("keydown", function (e) {
    var t = e.target; if (!(t.matches && t.matches("textarea.aix-q")) || e.key !== "Enter" || e.shiftKey || e.isComposing) return;
    if (window.matchMedia("(pointer:coarse)").matches) return; /* điện thoại: Enter xuống dòng, bấm nút ↑ để gửi */
    e.preventDefault(); var f = t.form; if (f && t.value.trim()) f.requestSubmit()
  });
  document.addEventListener("submit", function (e) { var t = e.target.querySelector && e.target.querySelector("textarea.aix-q"); if (t) setTimeout(function () { grow(t) }, 30) }, true);
  new MutationObserver(function () { if (!raf) raf = requestAnimationFrame(sync) }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
  sync()
})();
