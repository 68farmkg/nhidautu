/* NHIP v1.63 — Cho phép nhập số tùy chỉnh ở các ô chọn có sẵn của Kiểm thử & Mô phỏng.
   Cách hoạt động: giữ nguyên <select> (mọi đoạn mã đọc $("#id").value vẫn chạy như cũ),
   chỉ thêm lựa chọn "Tùy chỉnh…" + ô nhập số. Khi nhập hợp lệ, giá trị của lựa chọn đó chính là số bạn gõ.
   Giới hạn (min/max) khớp với mức kẹp trong nhip-sim-core.js / analysis-portfolio.js, để số bạn nhập
   không bị lõi âm thầm đổi thành số khác. */
(function (W, D) {
  "use strict";
  var CUSTOM = "__custom__";
  /* id: [min, max, đơn vị, chỉ số nguyên?, ghi chú] */
  var RANGES = {
    "an-bt-train": [50, 90, "%", false, ""],
    "an-batch-train": [50, 90, "%", false, ""],
    "an-port-train": [50, 90, "%", false, ""],
    "an-batch-count": [1, 50, " mã", true, ""],
    "an-port-count": [2, 50, " mã", true, "tối thiểu 2 mã"],
    "an-port-weight": [5, 100, "%", false, ""],
    "an-port-slots": [1, 20, " mã", true, ""],
    "an-port-risk": [0.1, 5, "%", false, ""],
    "an-port-stop": [0.5, 30, "%", false, ""],
    "an-port-target": [0, 100, "%", false, "0 = tắt"],
    "an-port-total-risk": [1, 30, "%", false, ""],
    "an-port-dd-stop": [0, 50, "%", false, "0 = tắt"],
    "an-port-wf-train": [50, 80, "%", false, ""],
    "an-port-wf-folds": [2, 5, "", true, ""]
  };

  function fmt(v) { return String(v).replace(".", ","); }

  function enhance(sel) {
    var id = sel.id, r = RANGES[id];
    if (!r || sel.getAttribute("data-cs") === "1") return;
    sel.setAttribute("data-cs", "1");
    var min = r[0], max = r[1], unit = r[2], isInt = r[3], note = r[4];
    var fallback = sel.value;

    var opt = D.createElement("option");
    opt.value = CUSTOM; opt.textContent = "Tùy chỉnh…"; opt.setAttribute("data-custom", "1");
    sel.appendChild(opt);

    var wrap = D.createElement("div");
    wrap.className = "nhip-cs-wrap"; wrap.hidden = true;
    var inp = D.createElement("input");
    inp.type = "number"; inp.className = "nhip-cs-input";
    inp.inputMode = isInt ? "numeric" : "decimal";
    inp.min = String(min); inp.max = String(max); inp.step = isInt ? "1" : "any";
    inp.setAttribute("aria-label", "Giá trị tùy chỉnh");
    var hint = D.createElement("small");
    hint.className = "nhip-cs-hint";
    hint.textContent = "Từ " + fmt(min) + " đến " + fmt(max) + unit + (note ? " · " + note : "");
    wrap.appendChild(inp); wrap.appendChild(hint);
    (sel.parentNode || sel).appendChild(wrap);

    function lastPreset() {
      for (var i = 0; i < sel.options.length; i++) {
        if (sel.options[i].value !== CUSTOM && sel.options[i].defaultSelected) return sel.options[i].value;
      }
      return fallback;
    }
    function apply(commit) {
      var raw = String(inp.value).replace(",", "."), v = parseFloat(raw), ok = raw !== "" && isFinite(v);
      if (ok && isInt) v = Math.round(v);
      var inRange = ok && v >= min && v <= max;
      inp.classList.toggle("bad", !inRange && raw !== "");
      if (ok && commit && !inRange) { v = Math.min(max, Math.max(min, v)); inp.value = String(v); inRange = true; inp.classList.remove("bad"); }
      /* Giá trị chưa hợp lệ → dùng mức mặc định để không bao giờ gửi số sai cho lõi */
      opt.value = inRange ? String(v) : lastPreset();
      opt.textContent = inRange ? "Tùy chỉnh: " + fmt(v) + unit : "Tùy chỉnh…";
    }
    sel.addEventListener("change", function () {
      if (sel.selectedOptions && sel.selectedOptions[0] === opt) {
        wrap.hidden = false;
        if (!inp.value) { inp.value = fallback; }
        apply(false); inp.focus(); inp.select && inp.select();
      } else {
        wrap.hidden = true; fallback = sel.value;
        opt.value = CUSTOM; opt.textContent = "Tùy chỉnh…";
      }
    });
    inp.addEventListener("input", function () { apply(false); });
    inp.addEventListener("change", function () { apply(true); });
    inp.addEventListener("blur", function () { apply(true); });
    /* Bấm Enter trong ô nhập: chốt giá trị, không gửi form nào */
    inp.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); apply(true); inp.blur(); } });
  }

  function scan(root) {
    var ids = Object.keys(RANGES);
    for (var i = 0; i < ids.length; i++) {
      var el = (root || D).querySelector("#" + ids[i]);
      if (el && el.tagName === "SELECT") enhance(el);
    }
  }

  var pending = false;
  function schedule() {
    if (pending) return; pending = true;
    (W.requestAnimationFrame || W.setTimeout)(function () { pending = false; scan(D); });
  }
  function start() {
    scan(D);
    if (W.MutationObserver && D.body) new MutationObserver(schedule).observe(D.body, { childList: true, subtree: true });
  }
  if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", start); else start();

  W.NHIPCustomSelect = { RANGES: RANGES, enhance: enhance, scan: scan };
})(window, document);
