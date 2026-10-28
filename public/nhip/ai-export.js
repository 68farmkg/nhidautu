/* NHỊP V2.90 — Sao chép giữ định dạng + Tải PDF cho câu trả lời của AI.
   Cách làm giống các trợ lý AI lớn (ChatGPT, Claude, Gemini): khi sao chép đặt SONG SONG vào clipboard
   2 bản — text/html (có tiêu đề, in đậm, danh sách, bảng thật → dán vào Word/Docs/Zalo/Gmail/Notes giữ nguyên mẫu)
   và text/plain đã làm sạch (không còn **, ##, |---|). Ứng dụng đích tự chọn bản phù hợp.
   Tải PDF: tự dàn trang bằng canvas (chữ Việt đầy đủ, không cần thư viện, chạy cả khi offline) rồi ghép thành file .pdf. */
(function () {
  "use strict";
  var FAM = '"Noto Sans","Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif', MONO = 'Consolas,"Roboto Mono","Courier New",monospace';
  var esc = function (s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;") };

  /* ---------- 1) Phân tích markdown → khối (dùng chung cho HTML, văn bản thường và PDF) ---------- */
  function clean(t) {
    t = String(t == null ? "" : t).replace(/\r\n?/g, "\n").replace(/<br\s*\/?>/gi, "\n");
    try { if (typeof window.fixVi === "function") t = window.fixVi(t) } catch (e) { }
    return t;
  }
  /* inline: **đậm**, *nghiêng*, `mã`, [chữ](liên kết) → mảng đoạn {s,b,i,c,href} */
  function inline(s) {
    var out = [], re = /\*\*([^*]+?)\*\*|`([^`]+?)`|\[([^\]]+)\]\(([^)\s]+)\)|(^|[^*\w])\*([^*\s](?:[^*]*[^*\s])?)\*(?!\*)/g, last = 0, m;
    s = String(s);
    while ((m = re.exec(s))) {
      if (m.index > last) out.push({ s: s.slice(last, m.index) });
      if (m[1] != null) out.push({ s: m[1], b: 1 });
      else if (m[2] != null) out.push({ s: m[2], c: 1 });
      else if (m[3] != null) { var h = /^https?:/i.test(m[4]) ? m[4] : ""; out.push({ s: m[3], href: h, u: h ? 1 : 0 }) }
      else { if (m[5]) out.push({ s: m[5] }); out.push({ s: m[6], i: 1 }) }
      last = re.lastIndex;
    }
    if (last < s.length) out.push({ s: s.slice(last) });
    return out.filter(function (r) { return r.s !== "" });
  }
  var isRow = function (l) { return /^\s*\|.*\|\s*$/.test(l) }, isSep = function (l) { return /^[\s|:-]+$/.test(l) && l.indexOf("-") > -1 };
  var cells = function (l) { return l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(function (c) { return c.trim() }) };
  function parse(text) {
    var L = clean(text).split("\n"), B = [], i = 0;
    while (i < L.length) {
      var l = L[i].replace(/\s+$/, "");
      if (/^\s*```/.test(l)) { var code = []; i++; while (i < L.length && !/^\s*```/.test(L[i])) code.push(L[i++]); i++; B.push({ t: "code", lines: code }); continue }
      if (isRow(l)) {
        var rows = []; while (i < L.length && isRow(L[i])) rows.push(L[i++]);
        var head = rows.length > 1 && isSep(rows[1]), data = rows.filter(function (r) { return !isSep(r) }).map(function (r) { return cells(r).map(inline) });
        B.push({ t: "table", head: head ? data[0] : null, rows: head ? data.slice(1) : data }); continue;
      }
      i++;
      if (!l.trim()) continue;
      if (/^\s*([-*_])\1{2,}\s*$/.test(l)) { B.push({ t: "hr" }); continue }
      var hd = /^(#{1,6})\s+(.*)$/.exec(l), sec = /^\*\*(\d+\.\s[^*]+)\*\*:?\s*$/.exec(l);
      if (sec) { B.push({ t: "h", lv: 3, r: inline(sec[1]) }); continue }
      if (hd) { B.push({ t: "h", lv: Math.min(3, hd[1].length), r: inline(hd[2].replace(/\s*#+\s*$/, "")) }); continue }
      var q = /^\s*>\s?(.*)$/.exec(l);
      if (q) { var prev = B[B.length - 1]; if (prev && prev.t === "q") prev.r = prev.r.concat([{ s: " " }], inline(q[1])); else B.push({ t: "q", r: inline(q[1]) }); continue }
      var li = /^(\s*)[-*•]\s+(.*)$/.exec(l), no = /^(\s*)(\d+)[.)]\s+(.*)$/.exec(l);
      if (li) { B.push({ t: "li", d: Math.min(2, Math.floor(li[1].length / 2)), n: 0, r: inline(li[2]) }); continue }
      if (no) { B.push({ t: "li", d: Math.min(2, Math.floor(no[1].length / 2)), n: +no[2], r: inline(no[3]) }); continue }
      B.push({ t: "p", r: inline(l.trim()) });
    }
    return B;
  }

  /* ---------- 2) Bản HTML giàu định dạng (style nội tuyến để dán đi đâu cũng giữ mẫu) ---------- */
  var runHtml = function (rs) {
    return rs.map(function (r) {
      var s = esc(r.s);
      if (r.c) s = '<code style="font-family:' + MONO + ';background:#f1f3f4;padding:1px 4px;border-radius:3px">' + s + "</code>";
      if (r.b) s = "<b>" + s + "</b>"; if (r.i) s = "<i>" + s + "</i>";
      if (r.href) s = '<a href="' + esc(r.href) + '">' + s + "</a>";
      return s;
    }).join("");
  };
  function html(text) {
    var B = parse(text), o = [], stack = [];
    var closeTo = function (n) { while (stack.length > n) o.push("</" + stack.pop() + ">") };
    B.forEach(function (b) {
      if (b.t !== "li") closeTo(0);
      if (b.t === "h") o.push("<h" + (b.lv + 1) + ' style="font-family:Arial,sans-serif;font-size:' + (b.lv === 1 ? 20 : b.lv === 2 ? 17 : 15) + 'px;margin:16px 0 6px;color:#0b6b57">' + runHtml(b.r) + "</h" + (b.lv + 1) + ">");
      else if (b.t === "p") o.push('<p style="margin:0 0 10px">' + runHtml(b.r) + "</p>");
      else if (b.t === "q") o.push('<blockquote style="margin:8px 0 10px;padding:6px 12px;border-left:4px solid #12987f;background:#f2faf8;color:#334">' + runHtml(b.r) + "</blockquote>");
      else if (b.t === "hr") o.push('<hr style="border:0;border-top:1px solid #cfd8d6;margin:12px 0">');
      else if (b.t === "code") o.push('<pre style="font-family:' + MONO + ';font-size:13px;background:#f4f5f6;padding:8px 10px;border-radius:4px;white-space:pre-wrap">' + esc(b.lines.join("\n")) + "</pre>");
      else if (b.t === "li") {
        var tag = b.n ? "ol" : "ul", need = b.d + 1;
        closeTo(Math.min(stack.length, need));
        while (stack.length < need) { stack.push(tag); o.push("<" + tag + ' style="margin:0 0 8px;padding-left:24px">') }
        if (stack[stack.length - 1] !== tag) { o.push("</" + stack.pop() + ">"); stack.push(tag); o.push("<" + tag + ' style="margin:0 0 8px;padding-left:24px">') }
        o.push('<li style="margin:0 0 3px">' + runHtml(b.r) + "</li>");
      } else if (b.t === "table") {
        var td = function (c, th) { return "<" + (th ? "th" : "td") + ' style="border:1px solid #b9c4c2;padding:5px 9px;text-align:left;vertical-align:top;' + (th ? "background:#e8f3f0;font-weight:bold" : "") + '">' + runHtml(c) + "</" + (th ? "th" : "td") + ">" };
        o.push('<table style="border-collapse:collapse;margin:8px 0 12px;font-size:14px">' + (b.head ? "<tr>" + b.head.map(function (c) { return td(c, 1) }).join("") + "</tr>" : "") + b.rows.map(function (r) { return "<tr>" + r.map(function (c) { return td(c) }).join("") + "</tr>" }).join("") + "</table>");
      }
    });
    closeTo(0);
    return '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#1c2b33">' + o.join("") + "</div>";
  }

  /* ---------- 3) Bản văn bản thường đã làm sạch (không còn ký hiệu markdown) ---------- */
  var runTxt = function (rs) { return rs.map(function (r) { return r.s }).join("") };
  function plain(text) {
    var o = [];
    var prev = "";
    parse(text).forEach(function (b) {
      var k = b.t === "li" ? "li" : b.t === "table" ? "table" : "x";
      if (prev && prev !== k && o.length && o[o.length - 1] !== "") o.push("");
      prev = k;
      if (b.t === "h") o.push("", runTxt(b.r), "");
      else if (b.t === "p" || b.t === "q") o.push(runTxt(b.r), "");
      else if (b.t === "li") o.push("  ".repeat(b.d) + (b.n ? b.n + ". " : "• ") + runTxt(b.r));
      else if (b.t === "hr") o.push("");
      else if (b.t === "code") o.push.apply(o, b.lines.concat([""]));
      else if (b.t === "table") { (b.head ? [b.head] : []).concat(b.rows).forEach(function (r) { o.push(r.map(runTxt).join("\t")) }); o.push("") }
    });
    return o.join("\n").replace(/\n{3,}/g, "\n\n").replace(/^\n+|\n+$/g, "");
  }

  /* ---------- 4) Sao chép: thử clipboard hiện đại → thử execCommand (rich) → thử text thường ---------- */
  function legacyRich(h, p) {
    var d = document.createElement("div"); d.contentEditable = "true"; d.innerHTML = h;
    d.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0;white-space:pre-wrap"; document.body.appendChild(d);
    var sel = getSelection(), rg = document.createRange(), ok = false;
    try { rg.selectNodeContents(d); sel.removeAllRanges(); sel.addRange(rg); ok = document.execCommand("copy") } catch (e) { }
    try { sel.removeAllRanges() } catch (e) { } d.remove(); return ok;
  }
  function legacyText(p) {
    var t = document.createElement("textarea"); t.value = p; t.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0"; document.body.appendChild(t); t.select();
    var ok = false; try { ok = document.execCommand("copy") } catch (e) { } t.remove(); return ok;
  }
  async function copy(text) {
    var h = html(text), p = plain(text);
    try {
      if (navigator.clipboard && window.ClipboardItem && navigator.clipboard.write) {
        await navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([h], { type: "text/html" }), "text/plain": new Blob([p], { type: "text/plain" }) })]);
        return "rich";
      }
    } catch (e) { }
    if (legacyRich(h, p)) return "rich";
    try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(p); return "plain" } } catch (e) { }
    if (legacyText(p)) return "plain";
    throw new Error("Không sao chép được");
  }

  /* ---------- 5) PDF: ghép các trang ảnh JPEG thành file .pdf (A4) ---------- */
  function makePdf(pages, title) {
    var enc = new TextEncoder(), chunks = [], off = 0, offs = [], PW = 595.28, PH = 841.89;
    var push = function (b) { if (typeof b === "string") b = enc.encode(b); chunks.push(b); off += b.length };
    var obj = function (id, fn) { offs[id] = off; push(id + " 0 obj\n"); fn(); push("\nendobj\n") };
    push(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));
    var hex = ""; for (var k = 0; k < title.length; k++) hex += ("0000" + title.charCodeAt(k).toString(16)).slice(-4);
    obj(1, function () { push("<< /Type /Catalog /Pages 2 0 R >>") });
    obj(2, function () { push("<< /Type /Pages /Count " + pages.length + " /Kids [" + pages.map(function (_, i) { return (3 + i * 3) + " 0 R" }).join(" ") + "] >>") });
    pages.forEach(function (p, i) {
      var pid = 3 + i * 3, cid = pid + 1, iid = pid + 2, c = "q " + PW + " 0 0 " + PH + " 0 0 cm /Im0 Do Q";
      obj(pid, function () { push("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + PW + " " + PH + "] /Resources << /XObject << /Im0 " + iid + " 0 R >> >> /Contents " + cid + " 0 R >>") });
      obj(cid, function () { push("<< /Length " + c.length + " >>\nstream\n" + c + "\nendstream") });
      obj(iid, function () { push("<< /Type /XObject /Subtype /Image /Width " + p.w + " /Height " + p.h + " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " + p.jpg.length + " >>\nstream\n"); push(p.jpg); push("\nendstream") });
    });
    var infoId = 3 + pages.length * 3; obj(infoId, function () { push("<< /Title <FEFF" + hex + "> /Producer (Nhip AI) >>") });
    var xr = off, n = infoId + 1; push("xref\n0 " + n + "\n0000000000 65535 f \n");
    for (var j = 1; j < n; j++) push(("0000000000" + offs[j]).slice(-10) + " 00000 n \n");
    push("trailer\n<< /Size " + n + " /Root 1 0 R /Info " + infoId + " 0 R >>\nstartxref\n" + xr + "\n%%EOF\n");
    return new Blob(chunks, { type: "application/pdf" });
  }

  async function renderPages(text, meta) {
    var W = 1240, H = 1754, M = 100, CW = W - 2 * M, BOT = H - 120, FS = 27, LH = 40;
    var pages = [], cv, g, y, pn = 0;
    var font = function (b, i, sz, mono) { return (i ? "italic " : "") + (b ? "700 " : "400 ") + sz + "px " + (mono ? MONO : FAM) };
    var flush = function () {
      g.fillStyle = "#8a9a9a"; g.font = font(0, 0, 20); g.textBaseline = "alphabetic";
      g.fillText("AI có thể sai · Chỉ phân tích, không đặt lệnh · Không phải khuyến nghị đầu tư", M, H - 62);
      g.textAlign = "right"; g.fillText("Trang " + pn, W - M, H - 62); g.textAlign = "left";
      g.strokeStyle = "#dfe7e5"; g.lineWidth = 2; g.beginPath(); g.moveTo(M, H - 92); g.lineTo(W - M, H - 92); g.stroke();
      var c = cv; return new Promise(function (ok, bad) {
        c.toBlob(function (bl) { if (!bl) return bad(new Error("Không tạo được trang PDF")); bl.arrayBuffer().then(function (ab) { pages.push({ jpg: new Uint8Array(ab), w: W, h: H }); ok() }, bad) }, "image/jpeg", 0.9);
      });
    };
    var newPage = async function () {
      if (cv) await flush();
      cv = document.createElement("canvas"); cv.width = W; cv.height = H; g = cv.getContext("2d"); pn++;
      g.fillStyle = "#fff"; g.fillRect(0, 0, W, H); g.textBaseline = "alphabetic"; y = M;
    };
    var ensure = async function (h) { if (y + h > BOT) await newPage() };
    /* xuống dòng: tách thành "từ" có kiểu, đo bằng đúng phông sẽ vẽ */
    var wrap = function (runs, maxW, sz, bold) {
      var words = [];
      runs.forEach(function (r) { r.s.split(/(\s+)/).forEach(function (w) { if (w !== "") words.push({ w: w, b: r.b || bold, i: r.i, c: r.c, sp: /^\s+$/.test(w) }) }) });
      var lines = [], cur = [], cw = 0;
      var meas = function (x) { g.font = font(x.b, x.i, sz, x.c); return g.measureText(x.w).width };
      words.forEach(function (x) {
        if (x.sp) { if (cur.length) { x.mw = meas({ w: " ", b: x.b, i: x.i, c: x.c }); x.w = " "; cur.push(x); cw += x.mw } return }
        var w = meas(x);
        if (cw + w > maxW && cur.length) { while (cur.length && cur[cur.length - 1].sp) cw -= cur.pop().mw; lines.push(cur); cur = []; cw = 0 }
        while (w > maxW && x.w.length > 1) { /* từ dài hơn cả dòng: cắt theo ký tự */
          var k = x.w.length; while (k > 1 && meas({ w: x.w.slice(0, k), b: x.b, i: x.i, c: x.c }) > maxW - cw) k--;
          var part = { w: x.w.slice(0, k), b: x.b, i: x.i, c: x.c }; part.mw = meas(part); cur.push(part); lines.push(cur); cur = []; cw = 0; x = { w: x.w.slice(k), b: x.b, i: x.i, c: x.c }; w = meas(x);
        }
        x.mw = w; cur.push(x); cw += w;
      });
      if (cur.length) lines.push(cur);
      return lines;
    };
    var drawLine = function (ln, x, base, sz, color, bg) {
      ln.forEach(function (it) {
        g.font = font(it.b, it.i, sz, it.c);
        if (it.c) { g.fillStyle = "#eef1f2"; g.fillRect(x, base - sz, it.mw, sz + 10) }
        g.fillStyle = it.c ? "#8a2b4a" : color; g.fillText(it.w, x, base); x += it.mw;
      });
    };
    var para = async function (runs, x0, sz, color, bold, bg) {
      var lines = wrap(runs, CW - (x0 - M), sz, bold), lh = Math.round(sz * 1.5);
      for (var k = 0; k < lines.length; k++) { await ensure(lh); if (bg) { g.fillStyle = bg; g.fillRect(M, y - 4, CW, lh) } drawLine(lines[k], x0, y + sz, sz, color); y += lh }
    };
    await newPage();
    /* đầu trang 1: thương hiệu + câu hỏi + thông tin */
    g.fillStyle = "#12987f"; g.font = font(1, 0, 40); g.fillText("✦ Nhịp AI", M, y + 40); y += 62;
    var mm = meta || {}, info = [];
    if (mm.mode) info.push(mm.mode); if (mm.name) info.push(mm.name); info.push(new Date(mm.at || Date.now()).toLocaleString("vi-VN"));
    g.fillStyle = "#6b7b7b"; g.font = font(0, 0, 22); g.fillText(info.join("  ·  "), M, y + 22); y += 40;
    if (mm.q) { await para([{ s: "Câu hỏi: ", b: 1 }, { s: String(mm.q).slice(0, 500) }], M, 25, "#33444a"); }
    if (mm.att && mm.att.length) { await para([{ s: "Tệp đính kèm: ", b: 1 }, { s: mm.att.join(", ") }], M, 23, "#6b7b7b") }
    g.strokeStyle = "#12987f"; g.lineWidth = 3; g.beginPath(); g.moveTo(M, y + 6); g.lineTo(W - M, y + 6); g.stroke(); y += 30;
    var blocks = parse(text);
    for (var bi = 0; bi < blocks.length; bi++) {
      var b = blocks[bi];
      if (b.t === "h") { var sz = b.lv === 1 ? 36 : b.lv === 2 ? 31 : 29; y += 12; await ensure(Math.round(sz * 1.5) * 2); await para(b.r, M, sz, "#0b6b57", 1); y += 4 }
      else if (b.t === "p") { await para(b.r, M, FS, "#1c2b33"); y += 10 }
      else if (b.t === "q") {
        var ql = wrap(b.r, CW - 40, FS, 0), lh = Math.round(FS * 1.5); y += 4;
        for (var q = 0; q < ql.length; q++) { await ensure(lh); g.fillStyle = "#f2faf8"; g.fillRect(M, y - 4, CW, lh); g.fillStyle = "#12987f"; g.fillRect(M, y - 4, 7, lh); drawLine(ql[q], M + 28, y + FS, FS, "#334"); y += lh }
        y += 12;
      }
      else if (b.t === "hr") { y += 8; await ensure(10); g.strokeStyle = "#cfd8d6"; g.lineWidth = 2; g.beginPath(); g.moveTo(M, y); g.lineTo(W - M, y); g.stroke(); y += 16 }
      else if (b.t === "code") {
        for (var cI = 0; cI < b.lines.length; cI++) { await ensure(36); g.fillStyle = "#f3f4f6"; g.fillRect(M, y - 4, CW, 36); g.fillStyle = "#222"; g.font = font(0, 0, 23, 1); g.fillText(b.lines[cI].slice(0, 90), M + 14, y + 22); y += 34 }
        y += 12;
      }
      else if (b.t === "li") {
        var ind = 22 + b.d * 40, x0 = M + ind + 34, ll = wrap(b.r, CW - (x0 - M), FS, 0), lh2 = Math.round(FS * 1.5);
        for (var li = 0; li < ll.length; li++) {
          await ensure(lh2);
          if (!li) { g.font = font(b.n ? 1 : 0, 0, FS); g.fillStyle = "#12987f"; g.fillText(b.n ? b.n + "." : (b.d ? "–" : "•"), M + ind + (b.n ? 0 : 6), y + FS) }
          drawLine(ll[li], x0, y + FS, FS, "#1c2b33"); y += lh2;
        }
        y += 4; var nx = blocks[bi + 1]; if (!nx || nx.t !== "li") y += 8;
      }
      else if (b.t === "table") {
        var all = (b.head ? [b.head] : []).concat(b.rows), nc = Math.max.apply(null, all.map(function (r) { return r.length })), TS = 23, PAD = 12, mn = [], mx = [];
        for (var c = 0; c < nc; c++) { mn[c] = 40; mx[c] = 40 }
        all.forEach(function (r, ri) { for (var c = 0; c < nc; c++) { var cell = r[c] || [], hb = b.head && ri === 0;
          var full = 0, longest = 0; cell.forEach(function (rn) { g.font = font(rn.b || hb, rn.i, TS, rn.c); full += g.measureText(rn.s).width; rn.s.split(/\s+/).forEach(function (w) { longest = Math.max(longest, g.measureText(w).width) }) });
          mn[c] = Math.max(mn[c], longest + 2 * PAD); mx[c] = Math.max(mx[c], full + 2 * PAD) } });
        var sMn = mn.reduce(function (a, v) { return a + v }, 0), sMx = mx.reduce(function (a, v) { return a + v }, 0), cw = [];
        if (sMx <= CW) { for (var c = 0; c < nc; c++) cw[c] = mx[c] + (CW - sMx) * mx[c] / sMx }
        else if (sMn >= CW) { for (var c = 0; c < nc; c++) cw[c] = mn[c] * CW / sMn }
        else { var ex = CW - sMn, sd = sMx - sMn; for (var c = 0; c < nc; c++) cw[c] = mn[c] + ex * (mx[c] - mn[c]) / sd }
        var drawRow = async function (r, hb) {
          var cl = [], rh = 0; for (var c = 0; c < nc; c++) { cl[c] = wrap(r[c] || [], cw[c] - 2 * PAD, TS, hb); rh = Math.max(rh, cl[c].length) }
          rh = rh * 34 + 2 * PAD - 4; if (y + rh > BOT) { await newPage(); if (!hb && b.head) await drawRow(b.head, 1) }
          var x = M; for (var c = 0; c < nc; c++) {
            g.fillStyle = hb ? "#e8f3f0" : "#fff"; g.fillRect(x, y, cw[c], rh); g.strokeStyle = "#b9c4c2"; g.lineWidth = 2; g.strokeRect(x, y, cw[c], rh);
            cl[c].forEach(function (ln, k) { drawLine(ln, x + PAD, y + PAD + 24 + k * 34, TS, "#1c2b33") }); x += cw[c];
          }
          y += rh;
        };
        y += 6; await ensure(120);
        for (var ri = 0; ri < all.length; ri++) await drawRow(all[ri], b.head && ri === 0);
        y += 18;
      }
    }
    await flush();
    return pages;
  }
  var stamp = function (d) { var p = function (n) { return ("0" + n).slice(-2) }; return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "-" + p(d.getHours()) + p(d.getMinutes()) };
  async function pdf(text, meta) {
    meta = meta || {};
    try { if (document.fonts && document.fonts.ready) await document.fonts.ready } catch (e) { }
    var pages = await renderPages(text, meta), title = "Nhịp AI — " + String(meta.q || "Phân tích").slice(0, 60);
    var blob = makePdf(pages, title), name = "NhipAI-" + stamp(new Date(meta.at || Date.now())) + ".pdf";
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.style.display = "none"; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove() }, 4000);
    return { name: name, pages: pages.length, size: blob.size };
  }
  window.NHIPAIExport = { parse: parse, html: html, plain: plain, copy: copy, pdf: pdf, _makePdf: makePdf };
})();
