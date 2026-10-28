/* NHỊP V2.90 — Ô soạn tin của Nhịp AI: đính kèm ảnh / tài liệu, micro (giọng nói → chữ), dán/kéo thả.
   - Ảnh: thu nhỏ (cạnh dài ≤ 1600px, JPEG) ngay trên máy trước khi gửi → nhẹ, nhanh, tiết kiệm token.
   - Tài liệu: đọc chữ NGAY TRÊN MÁY (txt, md, csv, json, html, pdf, docx) rồi gửi phần chữ cho AI. Không tải tệp gốc lên đâu cả.
   - Micro: Web Speech API (vi-VN). Chrome/Edge/Safari hỗ trợ; trình duyệt khác sẽ báo rõ. */
(function () {
  "use strict";
  var MAX_IMG = 4, MAX_DOC = 3, MAX_DOC_CHARS = 30000, MAX_TOTAL_CHARS = 60000, MAX_FILE_MB = 15;
  var toast = function (m, e) { try { window.toast(m, e) } catch (x) { } };
  var esc = function (s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;") };
  var uid = function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 5) };
  var kb = function (n) { return n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB" };

  /* ---------- đọc ảnh ---------- */
  function readImage(file) {
    return new Promise(function (ok, bad) {
      var url = URL.createObjectURL(file), im = new Image();
      im.onload = function () {
        try {
          var w = im.naturalWidth, h = im.naturalHeight, s = Math.min(1, 1600 / Math.max(w, h)), cw = Math.max(1, Math.round(w * s)), ch = Math.max(1, Math.round(h * s));
          var c = document.createElement("canvas"); c.width = cw; c.height = ch; var g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, cw, ch); g.drawImage(im, 0, 0, cw, ch);
          var d = c.toDataURL("image/jpeg", 0.85), t = document.createElement("canvas"), ts = 96 / Math.max(cw, ch); t.width = Math.max(1, Math.round(cw * ts)); t.height = Math.max(1, Math.round(ch * ts));
          t.getContext("2d").drawImage(c, 0, 0, t.width, t.height);
          URL.revokeObjectURL(url); ok({ mime: "image/jpeg", data: d.split(",")[1], thumb: t.toDataURL("image/jpeg", 0.7), size: Math.round(d.length * 0.75) });
        } catch (e) { URL.revokeObjectURL(url); bad(e) }
      };
      im.onerror = function () { URL.revokeObjectURL(url); bad(new Error("Không đọc được ảnh (định dạng chưa hỗ trợ)")) };
      im.src = url;
    });
  }

  /* ---------- đọc tài liệu ---------- */
  var loadScript = function (src) { return new Promise(function (ok, bad) { var s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = function () { bad(new Error("Không tải được bộ đọc PDF (cần mạng lần đầu)")) }; document.head.appendChild(s) }) };
  async function readPdf(file) {
    if (!window.pdfjsLib) await loadScript("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js");
    pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    var doc = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise, out = [], n = Math.min(doc.numPages, 40);
    for (var i = 1; i <= n; i++) {
      var pg = await doc.getPage(i), tc = await pg.getTextContent(), line = "", lastY = null;
      tc.items.forEach(function (it) { var y = it.transform && it.transform[5]; if (lastY !== null && Math.abs(y - lastY) > 4) line += "\n"; else if (line && !/\s$/.test(line)) line += " "; line += it.str; lastY = y });
      out.push("[Trang " + i + "]\n" + line.trim());
    }
    var t = out.join("\n\n");
    if (t.replace(/\[Trang \d+\]|\s/g, "").length < 20) throw new Error("PDF này là ảnh quét, không có chữ để đọc — hãy gửi dưới dạng ảnh");
    return doc.numPages > n ? t + "\n\n(Chỉ đọc " + n + "/" + doc.numPages + " trang đầu)" : t;
  }
  /* docx = tệp zip; đọc word/document.xml bằng DecompressionStream (không cần thư viện) */
  async function readDocx(file) {
    var buf = new Uint8Array(await file.arrayBuffer()), dv = new DataView(buf.buffer), eocd = -1;
    for (var i = buf.length - 22; i >= Math.max(0, buf.length - 70000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break }
    if (eocd < 0) throw new Error("Tệp .docx không hợp lệ");
    var cnt = dv.getUint16(eocd + 10, true), p = dv.getUint32(eocd + 16, true), hit = null;
    for (var k = 0; k < cnt; k++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      var method = dv.getUint16(p + 10, true), csz = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
      var name = new TextDecoder().decode(buf.subarray(p + 46, p + 46 + nl));
      if (name === "word/document.xml") { hit = { method: method, csz: csz, lo: lo }; break }
      p += 46 + nl + el + cl;
    }
    if (!hit) throw new Error("Không tìm thấy nội dung trong .docx");
    var ln = dv.getUint16(hit.lo + 26, true), le = dv.getUint16(hit.lo + 28, true), data = buf.subarray(hit.lo + 30 + ln + le, hit.lo + 30 + ln + le + hit.csz), xml;
    if (hit.method === 0) xml = new TextDecoder().decode(data);
    else {
      if (typeof DecompressionStream === "undefined") throw new Error("Trình duyệt chưa hỗ trợ đọc .docx — hãy lưu thành PDF hoặc .txt");
      var ds = new DecompressionStream("deflate-raw"), w = ds.writable.getWriter(); w.write(data); w.close();
      xml = await new Response(ds.readable).text();
    }
    var s = xml.replace(/<w:tab\/>/g, "\t").replace(/<\/w:tc>/g, "\t").replace(/<\/w:p>/g, "\n").replace(/<w:br\/>/g, "\n").replace(/<[^>]+>/g, "");
    var ta = document.createElement("textarea"); ta.innerHTML = s; return ta.value.replace(/\t+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  }
  async function readDoc(file) {
    var n = file.name.toLowerCase(), ext = (n.match(/\.([a-z0-9]+)$/) || [])[1] || "", t;
    if (ext === "pdf" || file.type === "application/pdf") t = await readPdf(file);
    else if (ext === "docx") t = await readDocx(file);
    else if (ext === "doc" || ext === "xls" || ext === "xlsx" || ext === "ppt" || ext === "pptx") throw new Error("Chưa đọc được ." + ext + " — hãy lưu thành PDF, .docx hoặc .csv rồi gửi lại");
    else {
      t = await file.text();
      if (/\x00/.test(t.slice(0, 2000))) throw new Error("Tệp nhị phân, không đọc được chữ");
      if (ext === "html" || ext === "htm") { var d = new DOMParser().parseFromString(t, "text/html"); d.querySelectorAll("script,style").forEach(function (e) { e.remove() }); t = d.body ? d.body.textContent : t }
    }
    t = String(t).replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    if (!t) throw new Error("Tệp không có chữ để đọc");
    return t;
  }

  var ICON = {
    plus: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    mic: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>'
  };
  window.NHIPAICompose = {
    ICON: ICON,
    attach: function (I) {
      var R = I.root, q = function (s) { return R.querySelector(s) };
      I.att = [];
      var strip = q(".aix-att"), menu = q(".aix-menu"), f = q(".aix-f"), ta = q(".aix-q"), micB = q(".aix-mic"), note = q(".aix-lt");
      var inImg = q(".aix-in-img"), inCam = q(".aix-in-cam"), inDoc = q(".aix-in-doc");
      var refresh = function () {
        var ok = I.att.filter(function (a) { return a.st === "ok" });
        strip.hidden = !I.att.length;
        strip.innerHTML = I.att.map(function (a) {
          return '<span class="aix-chip' + (a.st === "err" ? " bad" : "") + '" title="' + esc(a.err || a.name) + '">' +
            (a.k === "img" && a.thumb ? '<img src="' + a.thumb + '" alt="">' : '<i>' + (a.st === "load" ? "⏳" : a.k === "img" ? "🖼" : "📄") + "</i>") +
            '<span><b>' + esc(a.name) + "</b><small>" + (a.st === "load" ? "Đang đọc…" : a.st === "err" ? esc(a.err) : (a.k === "doc" ? (a.text.length < 1000 ? a.text.length + " ký tự" : Math.round(a.text.length / 100) / 10 + "k ký tự") + (a.trunc ? " (đã cắt)" : "") : kb(a.size))) + "</small></span>" +
            '<button type="button" data-ax="' + a.id + '" aria-label="Bỏ tệp">×</button></span>';
        }).join("");
        f.classList.toggle("can", !!(ta.value.trim() || ok.length));
        f.classList.toggle("has-att", !!I.att.length);
      };
      I.refreshComposer = refresh;
      var total = function () { return I.att.reduce(function (s, a) { return s + (a.k === "doc" && a.st === "ok" ? a.text.length : 0) }, 0) };
      I.addFiles = async function (files, forceKind) {
        files = [].slice.call(files || []);
        for (var i = 0; i < files.length; i++) {
          var fl = files[i], isImg = forceKind === "img" || (forceKind !== "doc" && /^image\//.test(fl.type));
          if (fl.size > MAX_FILE_MB * 1048576) { toast(fl.name + ": quá lớn (tối đa " + MAX_FILE_MB + " MB)", 1); continue }
          if (isImg && I.att.filter(function (a) { return a.k === "img" }).length >= MAX_IMG) { toast("Tối đa " + MAX_IMG + " ảnh mỗi câu hỏi", 1); continue }
          if (!isImg && I.att.filter(function (a) { return a.k === "doc" }).length >= MAX_DOC) { toast("Tối đa " + MAX_DOC + " tài liệu mỗi câu hỏi", 1); continue }
          var a = { id: uid(), k: isImg ? "img" : "doc", name: fl.name || (isImg ? "ảnh.jpg" : "tệp"), st: "load" }; I.att.push(a); refresh();
          try {
            if (isImg) { var r = await readImage(fl); a.mime = r.mime; a.data = r.data; a.thumb = r.thumb; a.size = r.size }
            else {
              var t = await readDoc(fl), room = Math.max(0, MAX_TOTAL_CHARS - total()), lim = Math.min(MAX_DOC_CHARS, room);
              if (lim < 200) throw new Error("Đã đủ dung lượng chữ cho một câu hỏi — hãy bỏ bớt tệp khác");
              a.trunc = t.length > lim; a.text = t.slice(0, lim); a.size = fl.size;
              if (a.trunc) toast(fl.name + ": chỉ gửi " + lim.toLocaleString("vi-VN") + " ký tự đầu", 0);
            }
            a.st = "ok";
          } catch (e) { a.st = "err"; a.err = e.message || "Lỗi đọc tệp"; toast(a.name + ": " + a.err, 1); setTimeout(function () { I.att = I.att.filter(function (x) { return x !== a }); refresh() }, 3500) }
          refresh();
        }
      };
      I.getAtt = function () { return I.att.filter(function (a) { return a.st === "ok" }) };
      I.pendingAtt = function () { return I.att.some(function (a) { return a.st === "load" }) };
      I.clearAtt = function () { I.att = []; refresh() };
      I.stopMic = function () { if (I._rec) { try { I._rec.stop() } catch (e) { } } };

      /* menu đính kèm */
      var closeMenu = function () { menu.hidden = true; q(".aix-plus").setAttribute("aria-expanded", "false") };
      q(".aix-plus").onclick = function (e) { e.stopPropagation(); var o = menu.hidden; menu.hidden = !o; this.setAttribute("aria-expanded", String(o)) };
      menu.addEventListener("click", function (e) {
        var b = e.target.closest("[data-pick]"); if (!b) return; closeMenu();
        ({ img: inImg, cam: inCam, doc: inDoc })[b.dataset.pick].click();
      });
      document.addEventListener("click", function (e) { if (!menu.hidden && !menu.contains(e.target)) closeMenu() });
      [[inImg, "img"], [inCam, "img"], [inDoc, "doc"]].forEach(function (p) { p[0].onchange = function () { I.addFiles(this.files, p[1]); this.value = "" } });
      strip.addEventListener("click", function (e) { var b = e.target.closest("[data-ax]"); if (!b) return; I.att = I.att.filter(function (a) { return a.id !== b.dataset.ax }); refresh() });
      ta.addEventListener("input", refresh);
      /* dán ảnh (Ctrl+V / giữ-dán trên điện thoại) và kéo thả tệp */
      ta.addEventListener("paste", function (e) {
        var fs = [].filter.call((e.clipboardData && e.clipboardData.files) || [], function (x) { return /^image\//.test(x.type) });
        if (fs.length) { e.preventDefault(); I.addFiles(fs, "img") }
      });
      ["dragover", "dragenter"].forEach(function (n) { f.addEventListener(n, function (e) { if (e.dataTransfer && [].indexOf.call(e.dataTransfer.types || [], "Files") > -1) { e.preventDefault(); f.classList.add("drop") } }) });
      ["dragleave", "drop"].forEach(function (n) { f.addEventListener(n, function () { f.classList.remove("drop") }) });
      f.addEventListener("drop", function (e) { if (e.dataTransfer && e.dataTransfer.files.length) { e.preventDefault(); I.addFiles(e.dataTransfer.files) } });

      /* micro */
      var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      micB.innerHTML = ICON.mic;
      var setMic = function (on, msg) { micB.classList.toggle("on", on); micB.setAttribute("aria-pressed", String(on)); micB.setAttribute("aria-label", on ? "Dừng nói" : "Nói để nhập"); note.textContent = on ? (msg || "Đang nghe… bấm lại để dừng") : (msg || ""); f.classList.toggle("listening", on) };
      micB.onclick = function () {
        if (I._rec) { try { I._rec.stop() } catch (e) { } return }
        if (!SR) { toast("Trình duyệt này chưa hỗ trợ nhận giọng nói — hãy dùng Chrome, Edge hoặc Safari", 1); return }
        var rec = new SR(), base = ta.value, got = false; I._rec = rec;
        rec.lang = "vi-VN"; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
        rec.onstart = function () { setMic(true) };
        rec.onresult = function (e) {
          var s = ""; for (var i = 0; i < e.results.length; i++) s += e.results[i][0].transcript; got = got || !!s.trim();
          ta.value = (base && !/\s$/.test(base) ? base + " " : base) + s; ta.dispatchEvent(new Event("input", { bubbles: true }));
        };
        rec.onerror = function (e) {
          var m = { "not-allowed": "Chưa được cấp quyền micro — vào cài đặt trình duyệt để cho phép", "service-not-allowed": "Chưa được cấp quyền micro", "no-speech": "Không nghe thấy giọng nói, thử lại nhé", "audio-capture": "Không tìm thấy micro", network: "Cần có mạng để nhận giọng nói" }[e.error];
          if (m) toast(m, 1);
        };
        rec.onend = function () { I._rec = null; setMic(false); ta.focus() };
        try { rec.start() } catch (e) { I._rec = null; setMic(false); toast("Không bật được micro", 1) }
      };
      refresh();
    }
  };
})();
