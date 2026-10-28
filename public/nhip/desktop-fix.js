/* NHIP · Sửa lỗi PC v1.12 — khung gợi ý mã tự vẽ. Chỉ chạy khi dùng chuột (PC); điện thoại giữ nguyên datalist. */
(function () {
  if (!window.matchMedia || !matchMedia("(hover:hover) and (pointer:fine)").matches) return;
  var box = document.createElement("div");
  box.className = "nx-sg"; box.hidden = true; box.setAttribute("role", "listbox");
  document.body.appendChild(box);
  var cur = null, items = [], idx = -1;
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var isTarget = function (el) { return el && el.tagName === "INPUT" && (el.id === "si" || el.id === "cx-ci"); };
  var source = function () {
    var dl = document.getElementById("cx-syms"), out = [];
    if (!dl) return out;
    dl.querySelectorAll("option").forEach(function (o) { out.push({ s: o.value, n: o.textContent || o.label || "" }); });
    return out;
  };
  function place() {
    if (!cur) return;
    var r = cur.getBoundingClientRect();
    box.style.left = Math.max(8, r.left) + "px";
    box.style.top = (r.bottom + 6) + "px";
    box.style.width = Math.max(240, r.width) + "px";
    var room = innerHeight - r.bottom - 16;
    box.style.maxHeight = Math.max(140, Math.min(340, room)) + "px";
  }
  function hide() { box.hidden = true; idx = -1; }
  function mark() {
    var els = box.querySelectorAll(".nx-it");
    els.forEach(function (e, i) { e.classList.toggle("on", i === idx); });
    if (els[idx]) els[idx].scrollIntoView({ block: "nearest" });
  }
  function render() {
    if (!cur) return;
    var q = cur.value.trim().toUpperCase(), all = source();
    var a = [], b = [];
    all.forEach(function (x) {
      var s = x.s.toUpperCase(), n = x.n.toUpperCase();
      if (!q || s.indexOf(q) === 0) a.push(x); else if (s.indexOf(q) > 0 || n.indexOf(q) >= 0) b.push(x);
    });
    items = a.concat(b).slice(0, 40);
    idx = -1;
    if (!items.length) { box.innerHTML = all.length ? '<div class="nx-empty">Không có mã phù hợp</div>' : ""; box.hidden = !all.length; place(); return; }
    box.innerHTML = items.map(function (x, i) { return '<button type="button" class="nx-it" role="option" data-i="' + i + '"><b>' + esc(x.s) + "</b><span>" + esc(x.n) + "</span></button>"; }).join("");
    box.hidden = false; place();
  }
  function pick(i) {
    var x = items[i]; if (!x || !cur) return;
    var inp = cur; inp.value = x.s; hide();
    inp.dispatchEvent(new Event("input", { bubbles: true }));
    var f = inp.form;
    if (inp.id === "si" && f) { if (f.requestSubmit) f.requestSubmit(); else f.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true })); }
    else inp.focus();
  }
  document.addEventListener("focusin", function (e) {
    if (!isTarget(e.target)) return;
    cur = e.target;
    cur.removeAttribute("list");            /* tắt hộp gợi ý mặc định xấu của trình duyệt */
    cur.setAttribute("autocomplete", "off");
    render();
  });
  document.addEventListener("input", function (e) { if (isTarget(e.target)) { cur = e.target; render(); } });
  document.addEventListener("keydown", function (e) {
    if (!cur || box.hidden || e.target !== cur) return;
    if (e.key === "ArrowDown") { e.preventDefault(); idx = Math.min(items.length - 1, idx + 1); mark(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); idx = Math.max(0, idx - 1); mark(); }
    else if (e.key === "Enter" && idx >= 0) { e.preventDefault(); pick(idx); }
    else if (e.key === "Escape") { hide(); }
    else if (e.key === "Tab") { hide(); }
  }, true);
  box.addEventListener("mousedown", function (e) { e.preventDefault(); });   /* giữ focus ở ô nhập */
  box.addEventListener("click", function (e) { var b = e.target.closest(".nx-it"); if (b) pick(+b.dataset.i); });
  document.addEventListener("mousedown", function (e) { if (e.target !== cur && !box.contains(e.target)) hide(); });
  addEventListener("resize", place);
  addEventListener("scroll", function (e) { if (!box.contains(e.target)) hide(); }, true);
  addEventListener("hashchange", hide);
})();
