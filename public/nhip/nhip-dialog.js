/* NHIP v2.14 — HỘP THOẠI DÙNG CHUNG
   Thay alert()/confirm()/prompt() của trình duyệt bằng hộp thoại cùng phong cách ứng dụng.
   Mọi hàm trả về Promise (dùng với await), tự xếp hàng nếu có nhiều hộp thoại liên tiếp.

   NhipDlg.confirm({tone,icon,title,message,subject,rows,note,okText,cancelText,requireText})  → true | false
   NhipDlg.prompt ({title,message,label,value,placeholder,maxLength,hint,multiline,chips,validate,okText}) → chuỗi | null
   NhipDlg.form   ({title,message,fields:[{name,label,type,value,…}],okText})                → {name:giá trị} | null
   NhipDlg.pick   ({title,message,options:[{value,label,sub}]})                               → value | null
   NhipDlg.alert  ({tone,title,message,okText})                                               → true
   Loại trường của form: text · number · textarea · switch · color · readonly (kèm nút Sao chép)
   tone: "danger" (xóa/không hoàn tác) · "warn" (thay đổi lớn) · "info" · "ok". */
(function (W, D) {
  "use strict";
  if (W.NhipDlg) return;

  var P = {
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
    warn: '<path d="M12 3.5 2.8 19.5h18.4L12 3.5z"/><path d="M12 10v4.5M12 17.6v.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.01"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.8 2.8L16.5 9.5"/>',
    edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z"/><path d="m13.5 6.5 4 4"/>',
    star: '<path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 17l-5.2 2.7 1-5.9-4.3-4.1 5.9-.8L12 3.5z"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    reset: '<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v4.5h-4.5"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>',
    user: '<circle cx="12" cy="8" r="3.6"/><path d="M5 20a7 7 0 0 1 14 0"/>',
    tag: '<path d="M3 12V4h8l10 10-8 8L3 12z"/><circle cx="7.5" cy="8.5" r="1.2"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
    shield: '<path d="M12 3 4.5 6v5.5c0 4.5 3 8 7.5 9.5 4.5-1.5 7.5-5 7.5-9.5V6L12 3z"/><path d="m9 12 2.2 2.2L15.2 10"/>',
    chev: '<path d="m9 6 6 6-6 6"/>',
    unlink: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    chart: '<path d="M4 19V5"/><path d="M4 19h16"/><path d="m8 15 3-4 3 2 4-6"/>',
    coin: '<circle cx="12" cy="12" r="9"/><path d="M14.8 9.2c-.6-.8-1.6-1.2-2.8-1.2-1.7 0-2.8.8-2.8 2s1 1.7 2.8 2 2.8.8 2.8 2-1.1 2-2.8 2c-1.2 0-2.3-.4-2.9-1.3M12 6.5V8m0 8v1.5"/>',
    download: '<path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>'
  };
  var DEF_ICON = { danger: "trash", warn: "warn", info: "info", ok: "check" };

  function svg(name, cls) {
    var s = D.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("fill", "none"); s.setAttribute("stroke", "currentColor");
    s.setAttribute("stroke-width", "1.9"); s.setAttribute("stroke-linecap", "round"); s.setAttribute("stroke-linejoin", "round");
    s.setAttribute("aria-hidden", "true"); if (cls) s.setAttribute("class", cls);
    s.innerHTML = P[name] || P.info; return s;
  }
  function el(tag, cls, text) {
    var e = D.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e;
  }
  function paras(m) {
    if (m == null || m === "") return [];
    if (Array.isArray(m)) return m.filter(Boolean).map(String);
    return String(m).split(/\n{2,}|\n/).map(function (x) { return x.trim(); }).filter(Boolean);
  }

  var queue = Promise.resolve(), uid = 0, lastFocus = null;

  function open(spec) {
    return new Promise(function (resolve) {
      queue = queue.then(function () { return new Promise(function (next) { show(spec, function (v) { resolve(v); next(); }); }); });
    });
  }

  function show(spec, finish) {
    spec = spec || {};
    var kind = spec.kind || "confirm";               // confirm | alert | form | pick
    var tone = spec.tone || (kind === "alert" ? "info" : "info");
    var id = "nhd" + (++uid);
    var ov = el("div", "nhd-ov"); ov.setAttribute("data-tone", tone);
    var card = el("div", "nhd-card" + (spec.wide ? " nhd-wide" : ""));
    card.setAttribute("role", tone === "danger" ? "alertdialog" : "dialog"); card.setAttribute("aria-modal", "true");
    card.setAttribute("aria-labelledby", id + "t"); card.tabIndex = -1;
    var body = el("div", "nhd-body"), head = el("div", "nhd-head");
    var ico = el("span", "nhd-ico"); ico.appendChild(svg(spec.icon || DEF_ICON[tone] || "info")); head.appendChild(ico);
    var ttl = el("div", "nhd-ttl"), h = el("h3", "nhd-t", spec.title || (kind === "alert" ? "Thông báo" : "Xác nhận")); h.id = id + "t"; ttl.appendChild(h);
    var ps = paras(spec.message);
    ps.forEach(function (t, i) { var p = el("p", "nhd-m", t); if (i === 0) p.id = id + "d"; ttl.appendChild(p); });
    if (ps.length) card.setAttribute("aria-describedby", id + "d");
    if (spec.subject) ttl.appendChild(el("div", "nhd-sub", String(spec.subject)));
    head.appendChild(ttl); body.appendChild(head);

    if (spec.rows && spec.rows.length) {
      var dl = el("dl", "nhd-rows");
      spec.rows.forEach(function (r) {
        if (!r || r[1] == null || r[1] === "") return;
        var row = el("div", "nhd-row"); row.appendChild(el("dt", "", r[0])); row.appendChild(el("dd", r[2] || "", String(r[1]))); dl.appendChild(row);
      });
      body.appendChild(dl);
    }

    var getters = [], firstInput = null, okBtn, cancelBtn;

    if (kind === "form") {
      var wrap = el("div", "nhd-fields");
      (spec.fields || []).forEach(function (f, i) { wrap.appendChild(buildField(f, i)); });
      body.appendChild(wrap);
    }
    if (kind === "pick") {
      var list = el("div", "nhd-list");
      (spec.options || []).forEach(function (o) {
        var b = el("button", "nhd-opt"); b.type = "button";
        var tx = el("span"); tx.appendChild(el("b", "", o.label)); if (o.sub) tx.appendChild(el("small", "", o.sub));
        b.appendChild(tx); b.appendChild(svg("chev", "nhd-go"));
        b.addEventListener("click", function () { close(o.value); });
        list.appendChild(b);
      });
      body.appendChild(list);
    }
    var typed = null;
    if (spec.requireText) {
      var tf = el("div", "nhd-fields"), box = el("label", "nhd-fld");
      var lb = el("span", "nhd-lb"); lb.appendChild(el("span", "", "Gõ “" + spec.requireText + "” để xác nhận")); box.appendChild(lb);
      typed = el("input", "nhd-in mono"); typed.type = "text"; typed.autocomplete = "off"; typed.setAttribute("autocapitalize", "characters");
      typed.spellcheck = false; typed.placeholder = spec.requireText; box.appendChild(typed); tf.appendChild(box); body.appendChild(tf);
    }
    var notes = [].concat(spec.note ? [spec.note] : [], spec.notes || []);
    notes.forEach(function (n) {
      if (typeof n === "string") n = { text: n };
      var d = el("div", "nhd-note " + (n.tone || "")); d.appendChild(svg(n.icon || (n.tone === "ok" ? "shield" : n.tone === "danger" ? "warn" : n.tone === "warn" ? "warn" : "info")));
      d.appendChild(el("span", "", n.text)); body.appendChild(d);
    });
    card.appendChild(body);

    var act = el("div", "nhd-act");
    if (kind !== "pick" && kind !== "alert" && !spec.hideCancel) {
      cancelBtn = el("button", "nhd-b cancel", spec.cancelText || "Hủy"); cancelBtn.type = "button";
      cancelBtn.addEventListener("click", function () { close(kind === "confirm" ? false : null); }); act.appendChild(cancelBtn);
    }
    if (kind === "pick") {
      cancelBtn = el("button", "nhd-b cancel", spec.cancelText || "Đóng"); cancelBtn.type = "button";
      cancelBtn.addEventListener("click", function () { close(null); }); act.appendChild(cancelBtn);
    }
    if (kind !== "pick") {
      okBtn = el("button", "nhd-b ok", spec.okText || (kind === "alert" ? "Đã hiểu" : kind === "form" ? "Lưu" : "Đồng ý")); okBtn.type = "button";
      okBtn.addEventListener("click", submit); act.appendChild(okBtn);
    }
    if (!cancelBtn) act.className += " one";
    card.appendChild(act); ov.appendChild(card);

    if (typed) { okBtn.disabled = true; typed.addEventListener("input", function () { okBtn.disabled = typed.value.trim() !== spec.requireText; }); }

    /* ---- trường nhập ---- */
    function buildField(f, i) {
      var type = f.type || "text", name = f.name || ("f" + i), fid = id + "f" + i, wrap, input, lab;
      if (type === "switch") {
        wrap = el("label", "nhd-sw"); input = el("input"); input.type = "checkbox"; input.checked = !!f.value;
        var tx = el("span"); tx.appendChild(D.createTextNode(f.label || "")); if (f.hint) tx.appendChild(el("small", "", f.hint));
        wrap.appendChild(tx); wrap.appendChild(input); wrap.appendChild(el("i"));
        getters.push({ name: name, get: function () { return input.checked; }, validate: function () { return ""; } });
        return wrap;
      }
      wrap = el("div", "nhd-fld"); lab = el("label", "nhd-lb"); lab.htmlFor = fid;
      lab.appendChild(el("span", "", f.label || "")); var cnt = null;
      if (f.maxLength && type !== "readonly") { cnt = el("em", "nhd-cnt"); lab.appendChild(cnt); }
      wrap.appendChild(lab);
      var multi = type === "textarea" || type === "readonly";
      if (type === "choice") {
        var seg = el("div", "nhd-chips nhd-seg"), cur = f.value, btns = [];
        (f.options || []).forEach(function (o) {
          var b = el("button", "nhd-chip" + (String(o.value) === String(cur) ? " on" : ""), o.label); b.type = "button"; b.setAttribute("aria-pressed", String(o.value) === String(cur));
          b.addEventListener("click", function () { cur = o.value; btns.forEach(function (x) { x.classList.remove("on"); x.setAttribute("aria-pressed", "false"); }); b.classList.add("on"); b.setAttribute("aria-pressed", "true"); });
          btns.push(b); seg.appendChild(b);
        });
        wrap.appendChild(seg); if (f.hint) wrap.appendChild(el("div", "nhd-hint", f.hint));
        getters.push({ name: name, get: function () { return cur; }, validate: function () { return ""; } });
        return wrap;
      }
      if (type === "color") {
        var cw = el("div", "nhd-clr"), pick = el("input"); pick.type = "color"; input = el("input", "nhd-in mono"); input.type = "text"; input.maxLength = 7;
        var v0 = String(f.value || "#2f80ed"); input.value = v0; try { pick.value = /^#[0-9a-f]{6}$/i.test(v0) ? v0 : "#2f80ed"; } catch (e) { }
        pick.addEventListener("input", function () { input.value = pick.value; });
        input.addEventListener("input", function () { if (/^#[0-9a-f]{6}$/i.test(input.value)) pick.value = input.value; });
        cw.appendChild(pick); cw.appendChild(input); wrap.appendChild(cw); input.id = fid;
      } else {
        input = el(multi ? "textarea" : "input", "nhd-in" + (f.mono || type === "readonly" ? " mono" : "")); input.id = fid;
        if (!multi) { input.type = "text"; if (type === "number") { input.inputMode = "decimal"; input.setAttribute("enterkeyhint", "done"); } else input.setAttribute("enterkeyhint", "done"); }
        else if (f.rows) input.rows = f.rows;
        input.value = f.value == null ? "" : String(f.value);
        if (f.placeholder) input.placeholder = f.placeholder;
        if (f.maxLength && type !== "readonly") input.maxLength = f.maxLength;
        input.autocomplete = "off"; input.spellcheck = false; if (type === "readonly") input.readOnly = true;
        wrap.appendChild(input);
      }
      if (cnt) { var upd = function () { cnt.textContent = input.value.length + "/" + f.maxLength; cnt.className = "nhd-cnt" + (input.value.length >= f.maxLength ? " full" : ""); }; input.addEventListener("input", upd); upd(); }
      if (f.chips && f.chips.length) {
        var cs = el("div", "nhd-chips");
        f.chips.forEach(function (c) { var b = el("button", "nhd-chip", c.label); b.type = "button"; b.addEventListener("click", function () { input.value = c.value; input.dispatchEvent(new Event("input")); input.focus(); }); cs.appendChild(b); });
        wrap.appendChild(cs);
      }
      if (type === "readonly") {
        var cb = el("button", "nhd-chip", "Sao chép"); cb.type = "button"; cb.style.justifySelf = "start";
        cb.addEventListener("click", function () {
          var done = function () { cb.textContent = "Đã sao chép ✓"; setTimeout(function () { cb.textContent = "Sao chép"; }, 1600); };
          input.focus(); input.select();
          try { if (W.navigator.clipboard && W.navigator.clipboard.writeText) W.navigator.clipboard.writeText(input.value).then(done, function () { D.execCommand("copy"); done(); }); else { D.execCommand("copy"); done(); } } catch (e) { try { D.execCommand("copy"); done(); } catch (x) { } }
        });
        wrap.appendChild(cb);
      }
      if (f.hint) wrap.appendChild(el("div", "nhd-hint", f.hint));
      var err = el("div", "nhd-err"); err.setAttribute("role", "alert"); wrap.appendChild(err);
      input.addEventListener("input", function () { input.classList.remove("bad"); err.classList.remove("on"); });
      input.addEventListener("focus", function () { setTimeout(function () { try { input.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (e) { } }, 250); });
      if (!firstInput && type !== "readonly") firstInput = input;
      if (type === "readonly" && !firstInput) firstInput = null;
      getters.push({
        name: name, input: input,
        get: function () { var v = input.value; return f.trim === false ? v : v.trim(); },
        validate: function () {
          var v = this.get(), m = "";
          if (f.required && !v) m = f.requiredMsg || "Vui lòng nhập " + (f.label ? f.label.toLowerCase() : "nội dung") + ".";
          else if (v && f.validate) m = f.validate(v) || "";
          if (m) { err.textContent = m; err.classList.remove("on"); void err.offsetWidth; err.classList.add("on"); input.classList.add("bad"); }
          return m;
        }
      });
      return wrap;
    }

    /* ---- đóng / gửi ---- */
    var closed = false;
    function submit() {
      if (closed || (okBtn && okBtn.disabled)) return;
      if (kind === "form") {
        var out = {}, bad = null;
        getters.forEach(function (g) { var m = g.validate(); if (m && !bad) bad = g; });
        if (bad) { try { bad.input.focus(); } catch (e) { } return; }
        getters.forEach(function (g) { out[g.name] = g.get(); });
        return close(out);
      }
      close(kind === "alert" ? true : true);
    }
    function close(val) {
      if (closed) return; closed = true;
      D.removeEventListener("keydown", onKey, true);
      if (W.visualViewport) { W.visualViewport.removeEventListener("resize", fitVV); W.visualViewport.removeEventListener("scroll", fitVV); }
      ov.classList.add("nhd-out");
      setTimeout(function () {
        if (ov.parentNode) ov.parentNode.removeChild(ov);
        if (!D.querySelector(".nhd-ov")) D.documentElement.classList.remove("nhd-open");
        try { if (lastFocus && lastFocus.focus && D.contains(lastFocus)) lastFocus.focus({ preventScroll: true }); } catch (e) { }
        finish(val);
      }, 110);
    }
    function cancelVal() { return kind === "confirm" ? false : kind === "alert" ? true : null; }
    function onKey(e) {
      if (!ov.parentNode) return;
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(cancelVal()); return; }
      if (e.key === "Enter" && kind === "form") {
        var t = e.target;
        if (t && t.tagName === "TEXTAREA") { if (e.ctrlKey || e.metaKey) { e.preventDefault(); submit(); } return; }
        if (t && t.tagName === "INPUT") { e.preventDefault(); submit(); return; }
      }
      if (e.key === "Enter" && typed && e.target === typed) { e.preventDefault(); submit(); return; }
      if (e.key === "Tab") {
        var f = [].slice.call(card.querySelectorAll('button:not([disabled]),input:not([disabled]):not([type=hidden]),textarea:not([disabled])')).filter(function (x) { return x.offsetParent !== null || x.type === "checkbox"; });
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1], a = D.activeElement;
        if (!card.contains(a)) { e.preventDefault(); first.focus(); }
        else if (e.shiftKey && a === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
      }
    }
    function fitVV() {
      var vv = W.visualViewport; if (!vv) return;
      if (W.innerHeight - vv.height > 120) { ov.style.height = vv.height + "px"; ov.style.top = vv.offsetTop + "px"; ov.style.bottom = "auto"; }
      else { ov.style.height = ""; ov.style.top = ""; ov.style.bottom = ""; }
    }
    var down = false;
    if (kind !== "form" && spec.dismissOutside !== false) {
      ov.addEventListener("mousedown", function (e) { down = e.target === ov; });
      ov.addEventListener("touchstart", function (e) { down = e.target === ov; }, { passive: true });
      ov.addEventListener("click", function (e) { if (e.target === ov && down) close(cancelVal()); down = false; });
    }

    lastFocus = D.activeElement;
    D.body.appendChild(ov); D.documentElement.classList.add("nhd-open");
    D.addEventListener("keydown", onKey, true);
    if (W.visualViewport) { W.visualViewport.addEventListener("resize", fitVV); W.visualViewport.addEventListener("scroll", fitVV); }
    /* tiêu điểm: nhập liệu → ô đầu tiên; xóa/nguy hiểm → nút Hủy (tránh lỡ Enter); còn lại → nút chính */
    setTimeout(function () {
      var target = typed || firstInput || (tone === "danger" && cancelBtn) || okBtn || card;
      try { target.focus({ preventScroll: true }); if (target.select && (target === firstInput) && target.value && target.tagName === "INPUT") target.select(); } catch (e) { }
    }, 30);
  }

  /* ---------- API ---------- */
  function norm(s, def) { return typeof s === "string" ? Object.assign({}, def, { message: s }) : Object.assign({}, def, s || {}); }

  var Dlg = {
    confirm: function (s) { return open(Object.assign({ kind: "confirm" }, norm(s, {}))); },
    alert: function (s) { return open(Object.assign({ kind: "alert" }, norm(s, {}))); },
    form: function (s) { return open(Object.assign({ kind: "form" }, s || {})); },
    pick: function (s) { return open(Object.assign({ kind: "pick" }, s || {})); },
    prompt: function (s) {
      s = s || {};
      var f = { name: "v", label: s.label || "Nội dung", type: s.multiline ? "textarea" : "text", value: s.value, placeholder: s.placeholder, maxLength: s.maxLength,
        hint: s.hint, chips: s.chips, required: s.required !== false, requiredMsg: s.requiredMsg, validate: s.validate, mono: s.mono, rows: s.rows, trim: s.trim };
      return open({ kind: "form", tone: s.tone || "info", icon: s.icon || "edit", title: s.title || "Nhập thông tin", message: s.message, subject: s.subject, rows: s.rows2, note: s.note,
        okText: s.okText || "Lưu", cancelText: s.cancelText, wide: s.wide, fields: [f] }).then(function (r) { return r ? r.v : null; });
    },
    /* Xóa một lệnh chờ / TP / SL: một chỗ duy nhất để mọi nơi hiển thị giống nhau */
    confirmOrder: function (o) {
      o = o || {}; var nf = function (v) { return v == null || !isFinite(v) ? null : Number(v).toLocaleString("vi-VN", { maximumFractionDigits: 3 }); };
      return Dlg.confirm({
        tone: "danger", icon: "trash", title: "Xóa lệnh " + String(o.kind || "").toLowerCase() + "?",
        message: "Lệnh sẽ bị hủy và không còn được theo dõi trên biểu đồ.",
        rows: [["Mã cổ phiếu", o.sym], ["Loại lệnh", o.kind], ["Khối lượng", o.qty != null && nf(o.qty) ? nf(o.qty) + " cp" : null], ["Giá đặt", nf(o.price) ? nf(o.price) + " đ" : null]],
        okText: "Xóa lệnh", cancelText: "Giữ lại"
      });
    }
  };
  W.NhipDlg = Dlg;

  /* alert() lẻ còn sót ở nơi khác: hiển thị không chặn (alert vốn không trả về giá trị) */
  W.alert = function (m) { Dlg.alert({ tone: "warn", title: "Thông báo", message: m == null ? "" : String(m) }); };
})(window, document);
