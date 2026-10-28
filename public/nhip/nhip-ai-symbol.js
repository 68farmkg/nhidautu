/* NHỊP · V2.31 — Ô MÃ CỦA NHỊP AI THEO SÀN (cửa sổ nổi + trang Phân tích AI)
   Nguyên tắc: AI đang ở sàn nào thì CHỈ làm việc với sàn đó (HOSE / HNX / UPCoM), không lẫn sàn khác.
   - Gợi ý: bấm vào ô mã → xổ danh sách TẤT CẢ mã của sàn đang đứng (cùng nguồn với bộ chọn mã Biểu đồ/Phân tích:
     NHIPSymbolPicker.items = danh bạ nhúng + danh sách niêm yết VNDirect + mã khách tự khai báo). Gõ để lọc theo mã/tên.
   - Mã KHÔNG có ở bất kỳ sàn nào  → báo "không thấy", chặn gửi, gợi ý mã gần giống.
   - Mã đúng nhưng thuộc sàn KHÁC   → hỏi (NHIPHouse.gate, cùng hộp thoại của cả ứng dụng). Đồng ý → chuyển sàn rồi AI tiếp tục
     với mã đó ở sàn mới; không đồng ý → ở lại, trả ô mã về mã cũ.
   - Câu hỏi gõ ở khung chat (VD "Phân tích SHS") cũng được kiểm tra theo đúng các quy tắc trên trước khi gửi.
   - Câu hỏi nhắc mã của NHIỀU sàn cùng lúc: không chuyển sàn, yêu cầu hỏi riêng từng sàn.
   Không đoán: mã chưa có trong danh bạ không bị xem là của sàn nào (báo "không thấy", nhắc thêm ở Cài đặt → Danh bạ mã). */
(function () {
  "use strict";
  var W = window, D = document;
  var NM = { HOSE: "HOSE", HNX: "HNX", UPCOM: "UPCoM" };
  var CHUNK = 60, MAXOTHER = 3;
  var IDXRE = /^(VNINDEX|VN30|VN100|VNALL|VNMID|VNSML|HNX\w*|UPCOM\w*)$/;
  /* Từ viết hoa hay gặp KHÔNG phải mã: không báo "không thấy mã" cho chúng */
  var STOP = /^(AI|OK|HOSE|HNX|UPCOM|HSX|RSI|MACD|EMA|SMA|WMA|MA|ADX|ATR|OBV|MFI|CCI|SAR|BB|PE|PB|ROE|ROA|EPS|VND|USD|KL|GTGD|NN|ETF|CP|CK|TA|FA|VN|IPO|SL|TP|RR|GDP|CPI|FED|NPL|NIM|CASA|LNST|BCTC|YTD|YOY|QOQ)$/;
  var TRIG = /(?:phân tích|phan tich|báo cáo|bao cao|cổ phiếu|co phieu|mã ck|ma ck|mã|ma|cp|so sánh|so sanh|định giá|dinh gia|đánh giá|danh gia|biểu đồ|bieu do)\s+(?:cổ phiếu\s+|co phieu\s+|mã\s+|ma\s+)?([A-Za-z][A-Za-z0-9]{1,4})(?=$|[\s.,;:!?)\]])/gi;

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function houseNow() { try { return W.NHIPHouse && W.NHIPHouse.cur ? W.NHIPHouse.cur() : "HOSE"; } catch (e) { return "HOSE"; } }
  function clean(s) { return String(s || "").toUpperCase().replace(/[^A-Z0-9.]/g, ""); }
  function norm(s) {
    try { if (W.NHIPSymbolPicker && W.NHIPSymbolPicker.norm) return W.NHIPSymbolPicker.norm(s); } catch (e) { }
    return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }
  function mobile() { try { return W.matchMedia("(max-width:700px)").matches; } catch (e) { return false; } }
  function dynLoaded() { try { return !!(W.NHIPSYM && W.NHIPSYM.stats && W.NHIPSYM.stats().dynamic); } catch (e) { return false; } }
  function symVer() { try { return W.NHIPSYM && W.NHIPSYM.version ? W.NHIPSYM.version() : 0; } catch (e) { return 0; } }

  /* ---------- Dữ liệu: danh sách mã của từng sàn (có cache theo phiên bản danh bạ) ---------- */
  var cache = {};
  function items(h) {
    var v = symVer(), c = cache[h];
    if (c && c.ver === v) return c.list;
    var list = [];
    try { list = (W.NHIPSymbolPicker && W.NHIPSymbolPicker.items(h)) || []; } catch (e) { list = []; }
    cache[h] = { ver: v, list: list };
    return list;
  }
  function filter(list, q) {
    var qs = q.split(" "), up = q.toUpperCase().replace(/\s+/g, ""), res = [];
    list.forEach(function (x) {
      for (var i = 0; i < qs.length; i++) if (x.k.indexOf(qs[i]) < 0) return;
      var s = x.sym, r = s === up ? 0 : s.indexOf(up) === 0 ? 1 : s.indexOf(up) > 0 ? 2 : 3;
      res.push([r, x]);
    });
    res.sort(function (a, b) { return a[0] - b[0] || (a[1].sym < b[1].sym ? -1 : a[1].sym > b[1].sym ? 1 : 0); });
    return res.map(function (r) { return r[1]; });
  }
  function isKnown(k) {
    if (IDXRE.test(k)) return true;
    try { var e = W.NHIPSYM && W.NHIPSYM.info ? W.NHIPSYM.info(k) : null; return !!(e && e.floor); } catch (x) { return false; }
  }
  function similar(k, h) {
    var L = items(h), out = [], seen = {};
    function add(x) { if (!x.idx && !seen[x.sym] && out.length < 5) { seen[x.sym] = 1; out.push(x); } }
    L.forEach(function (x) { if (x.sym.indexOf(k) === 0) add(x); });
    if (out.length < 5 && k.length >= 3) L.forEach(function (x) { if (x.sym.indexOf(k.slice(0, 2)) === 0) add(x); });
    if (out.length < 5) { var q = norm(k); if (q) L.forEach(function (x) { if (x.k.indexOf(q) >= 0) add(x); }); }
    return out;
  }
  /* resolve(raw) → { state: empty | ok | other | none, sym, at?, house, similar? } */
  function resolve(raw) {
    var k = clean(raw), h = houseNow();
    if (!k) return { state: "empty", sym: "", house: h };
    if (!isKnown(k)) return { state: "none", sym: k, house: h, similar: similar(k, h) };
    var at = h; try { at = W.NHIPHouse.houseOf(k) || h; } catch (e) { }
    return at === h ? { state: "ok", sym: k, house: h } : { state: "other", sym: k, at: at, house: h };
  }
  /* V2.84: tab nào cần ô Mã (Tự động, Biểu đồ, Phân tích, Giao dịch) — danh sách nằm ở ai.js (NHIPAIModes); khóa cũ vẫn nhận */
  function needSym(m) { try { if (W.NHIPAIModes) return W.NHIPAIModes.needSym(m); } catch (e) { } return !(m === "market" || m === "news" || m === "portfolio"); }
  /* Mã nhắc trong câu hỏi (chỉ mã nhận ra chắc chắn; mã lạ chỉ bị báo khi đứng ngay sau từ khóa như "phân tích", "báo cáo", "mã"…) */
  function textRefs(text, mode) {
    var t = String(text || ""), out = [], seen = {};
    function put(sym) { if (!sym || seen[sym]) return; seen[sym] = 1; out.push(resolve(sym)); }
    try { (W.NHIPSYM.scan(t) || []).forEach(function (x) { put(x.sym); }); } catch (e) { }
    var m; TRIG.lastIndex = 0;
    while ((m = TRIG.exec(t))) {
      var tok = m[1], up = tok.toUpperCase();
      if (seen[up]) continue;
      if (isKnown(up)) { put(up); continue; }
      if (tok === up && /[A-Z]/.test(tok) && !STOP.test(up)) { seen[up] = 1; out.push(resolve(up)); }
    }
    var one = /^\s*([A-Za-z][A-Za-z0-9]{1,4})\s*$/.exec(t);
    if (one && mode !== "auto" && needSym(mode)) {
      var u = one[1].toUpperCase();
      if (isKnown(u)) put(u); else if (one[1] === u && !STOP.test(u) && !seen[u]) { seen[u] = 1; out.push(resolve(u)); }
    }
    return out;
  }

  /* ---------- Thông báo ngay trong khung AI ---------- */
  function note(I, html, kind) {
    var n = I && I.root && I.root.querySelector(".aix-note"); if (!n) return;
    n.className = "aix-note" + (kind ? " " + kind : ""); n.innerHTML = html || ""; n.hidden = !html;
  }
  function field(I) { return I.root.querySelector(".aix-sym"); }
  function noteNone(I, r, mark) {
    var h = r.house || houseNow(), chips = (r.similar || []).map(function (x) { return '<button type="button" data-ns="' + esc(x.sym) + '">' + esc(x.sym) + "</button>"; }).join("");
    note(I, "<b>Không thấy mã “" + esc(r.sym) + "” trên sàn " + NM[h] + ".</b> Hãy gõ lại hoặc chọn một mã trong danh sách gợi ý." +
      (chips ? '<div class="aix-nc">Có phải: ' + chips + "</div>" : "") +
      (dynLoaded() ? "" : '<div class="aix-ns">Danh sách đầy đủ của sàn chưa nạp xong (đang dùng danh bạ có sẵn). Mã thiếu có thể thêm tại Cài đặt → Danh bạ mã.</div>'), "err");
    if (mark) { var f = field(I); if (f) f.classList.add("bad"); }
  }
  function noteOther(I, r, mark) {
    note(I, "<b>" + esc(r.sym) + " thuộc sàn " + NM[r.at] + "</b>, còn bạn đang ở sàn " + NM[r.house] + ". Nhịp AI chỉ làm việc với một sàn mỗi lần. " +
      '<div class="aix-nc"><button type="button" data-sw="' + esc(r.sym) + '" data-at="' + r.at + '">Chuyển sang ' + NM[r.at] + "</button></div>", "warn");
    if (mark) { var f = field(I); if (f) f.classList.add("bad"); }
  }
  function noteMulti(I, refs) {
    var l = refs.map(function (r) { return r.sym + " · " + NM[r.state === "other" ? r.at : r.house]; }).join(", ");
    note(I, "<b>Câu hỏi nhắc mã của nhiều sàn (" + esc(l) + ").</b> Mỗi lần Nhịp AI chỉ làm việc với một sàn — hãy hỏi riêng từng sàn.", "warn");
  }

  /* ---------- Chuyển sàn (hộp thoại chung NHIPHouse.gate); xong thì AI tiếp tục với mã đó ---------- */
  function restore(I) {
    var f = field(I); if (!f) return;
    var back = I.symOk || ""; try { if (!back && W.NHIPAI && W.NHIPAI.pageSym) back = W.NHIPAI.pageSym(); } catch (e) { }
    f.value = back && resolve(back).state === "ok" ? back : ""; f.classList.remove("bad"); I.symLocked = !!f.value; note(I, "");
    try { I.draw(); } catch (e) { }
  }
  function askSwitch(I, sym, at, ctx) {
    ctx = ctx || {};
    var H = W.NHIPHouse; if (!H || !H.gate) return false;
    return H.gate(sym, {
      aiText: true,
      onCancel: function () { restore(I); },
      onSwitch: function (to, k) { setTimeout(function () { try { if (W.NHIPAI) W.NHIPAI.resume({ sym: k, text: ctx.text || "", opts: ctx.opts || null }); } catch (e) { } }, 160); }
    });
  }

  /* ---------- check(): chạy TRƯỚC khi gửi câu hỏi. Trả { ok, sym } (ok=false: đã chặn và đang báo/hỏi) ---------- */
  function check(I, text, o) {
    o = o || {};
    var mode = o.mode || "auto", visible = needSym(mode);
    var f = field(I), refs = textRefs(text, mode), h = houseNow();
    if (refs.length) {
      var other = refs.filter(function (r) { return r.state === "other"; }), none = refs.filter(function (r) { return r.state === "none"; }), okr = refs.filter(function (r) { return r.state === "ok"; }), hs = {};
      other.forEach(function (r) { hs[r.at] = 1; }); if (okr.length) hs[h] = 1;
      if (Object.keys(hs).length > 1) { noteMulti(I, refs.filter(function (r) { return r.state !== "none"; })); return { ok: false }; }
      if (other.length) { note(I, ""); askSwitch(I, other[0].sym, other[0].at, { text: text, opts: o }); return { ok: false }; }
      if (none.length) { noteNone(I, none[0], false); return { ok: false }; }
      if (f) f.classList.remove("bad"); note(I, "");
      return { ok: true, sym: okr[0] ? okr[0].sym : "" };
    }
    if (visible && f && f.value) {
      var r = resolve(f.value);
      if (r.state === "none") { noteNone(I, r, true); return { ok: false }; }
      if (r.state === "other") { note(I, ""); askSwitch(I, r.sym, r.at, { text: text, opts: o }); return { ok: false }; }
      if (r.state === "ok") { f.classList.remove("bad"); note(I, ""); I.symOk = r.sym; return { ok: true, sym: r.sym }; }
    }
    return { ok: true, sym: "" };
  }

  /* ---------- Danh sách gợi ý (dùng chung một hộp) ---------- */
  var dd = null, S = { open: false, I: null, inp: null, h: "", q: "", view: [], shown: 0, grp: "", act: -1, hold: false, tick: null, ver: -1 };
  function build() {
    if (dd) return dd;
    var r = D.createElement("div"); r.id = "aisg"; r.hidden = true; r.tabIndex = -1;
    r.innerHTML = '<div class="aisg-hd"><b></b><span></span></div><div class="aisg-ls" role="listbox" aria-label="Gợi ý mã trong sàn"><div class="aisg-main"></div><div class="aisg-other"></div></div>';
    D.body.appendChild(r);
    dd = { root: r, t: r.querySelector(".aisg-hd b"), sub: r.querySelector(".aisg-hd span"), ls: r.querySelector(".aisg-ls"), main: r.querySelector(".aisg-main"), other: r.querySelector(".aisg-other") };
    r.addEventListener("pointerdown", function () { S.hold = true; setTimeout(function () { S.hold = false; }, 450); }, true);
    r.addEventListener("mousedown", function (e) { e.preventDefault(); });   /* giữ con trỏ ở ô mã, không làm mất bàn phím/tiêu điểm */
    dd.ls.addEventListener("click", function (e) {
      var b = e.target.closest(".aisg-it"); if (!b) return;
      if (b.dataset.at) pickOther(b.dataset.s, b.dataset.at); else pick(b.dataset.s);
    });
    dd.ls.addEventListener("scroll", function () { if (dd.ls.scrollTop + dd.ls.clientHeight > dd.ls.scrollHeight - 240) more(); }, { passive: true });
    return dd;
  }
  function rowHtml(x, extra) {
    var on = !extra && S.I && x.sym === S.I.symOk;
    return '<button type="button" class="aisg-it' + (on ? " on" : "") + '" role="option" tabindex="-1" data-s="' + esc(x.sym) + '"' + (extra ? ' data-at="' + extra + '"' : "") + ">" +
      "<b>" + esc(x.sym) + '</b><span><em>' + esc(x.name || "—") + "</em>" + (x.sector && !x.idx ? "<small>" + esc(x.sector) + "</small>" : "") + "</span>" +
      (extra ? '<i class="aisg-tag">' + NM[extra] + " · Chuyển sàn</i>" : on ? '<i class="aisg-ck" aria-hidden="true">✓</i>' : "") + "</button>";
  }
  function more() {
    if (!S.open || S.shown >= S.view.length) return;
    var end = Math.min(S.view.length, S.shown + CHUNK), h = "", flat = !!norm(S.q);
    for (var i = S.shown; i < end; i++) {
      var x = S.view[i];
      if (!flat) { var g = x.idx ? "Chỉ số" : x.sym.charAt(0); if (g !== S.grp) { S.grp = g; h += '<div class="aisg-gh">' + esc(g) + "</div>"; } }
      h += rowHtml(x);
    }
    S.shown = end; dd.main.insertAdjacentHTML("beforeend", h);
  }
  function watchRows(L) {
    var wl = []; try { wl = (typeof ST !== "undefined" && ST && ST.watchlist) || []; } catch (e) { }
    var by = {}; L.forEach(function (x) { by[x.sym] = x; });
    return wl.filter(function (s) { return by[s]; }).map(function (s) { return by[s]; }).slice(0, 12);
  }
  function paint(reset) {
    if (!S.open) return;
    var h = S.h, q = norm(S.q), L = items(h);
    S.view = q ? filter(L, q) : L; S.shown = 0; S.grp = ""; S.ver = symVer();
    dd.main.innerHTML = ""; dd.other.innerHTML = ""; if (reset) dd.ls.scrollTop = 0;
    dd.t.textContent = "Mã sàn " + NM[h];
    dd.sub.textContent = (q ? S.view.length + " kết quả" : L.length + " mã") + (dynLoaded() ? "" : " · danh bạ có sẵn");
    if (!q) { var w = watchRows(L); if (w.length) dd.main.insertAdjacentHTML("beforeend", '<div class="aisg-gh">★ Đang theo dõi</div>' + w.map(function (x) { return rowHtml(x); }).join("")); }
    more();
    var oth = [];
    if (q) {
      ["HOSE", "HNX", "UPCOM"].forEach(function (h2) {
        if (h2 === h) return;
        var m = filter(items(h2), q).slice(0, MAXOTHER);
        m.forEach(function (x) { if (!x.idx) oth.push([h2, x]); });
      });
      if (!S.view.length) dd.main.innerHTML = '<div class="aisg-empty">Không thấy “' + esc(clean(S.q) || S.q) + "” trên sàn " + NM[h] + (oth.length ? ". Có ở sàn khác:" : ".") + "</div>";
      if (oth.length) dd.other.innerHTML = (S.view.length ? '<div class="aisg-oh">Có ở sàn khác — chạm để chuyển sàn</div>' : "") + oth.map(function (p) { return rowHtml(p[1], p[0]); }).join("");
    }
    S.act = -1;
  }
  function place() {
    if (!S.open || !S.inp) return;
    var r = S.inp.getBoundingClientRect(), vv = W.visualViewport, vw = W.innerWidth, vt = vv ? vv.offsetTop : 0, vh = vv ? vv.height : W.innerHeight;
    var w = Math.min(340, vw - 16), left = Math.max(8, Math.min(r.left, vw - w - 8));
    var below = vt + vh - r.bottom - 8, above = r.top - vt - 8, up = below < 190 && above > below;
    var mh = Math.max(150, Math.min(up ? above : below, 380));
    dd.root.style.left = left + "px"; dd.root.style.width = w + "px"; dd.root.style.maxHeight = mh + "px";
    if (up) { dd.root.style.top = "auto"; dd.root.style.bottom = (W.innerHeight - r.top + 4) + "px"; } else { dd.root.style.bottom = "auto"; dd.root.style.top = (r.bottom + 4) + "px"; }
  }
  function open(I, inp) {
    build(); S.open = true; S.I = I; S.inp = inp; S.h = houseNow(); S.q = ""; dd.root.hidden = false;
    inp.setAttribute("aria-expanded", "true"); paint(true); place();
    clearInterval(S.tick); S.tick = setInterval(function () { if (S.open && symVer() !== S.ver) paint(false); }, 1500);
  }
  function close() {
    if (!S.open) return; S.open = false; clearInterval(S.tick);
    if (dd) dd.root.hidden = true; if (S.inp) S.inp.setAttribute("aria-expanded", "false");
  }
  function setValid(I, sym) {
    var f = field(I); f.value = sym; f.classList.remove("bad"); I.symLocked = true; I.symOk = sym; note(I, "");
    try { I.draw(); } catch (e) { }
  }
  function pick(sym) {
    var I = S.I, f = S.inp; close(); if (!I) return;
    setValid(I, sym); if (mobile() && f) try { f.blur(); } catch (e) { }
  }
  function pickOther(sym, at) { var I = S.I; close(); if (!I) return; askSwitch(I, sym, at, {}); }
  function hardCommit(I) {
    var f = field(I), r = resolve(f.value);
    if (r.state === "empty") { f.classList.remove("bad"); note(I, ""); I.symLocked = false; return; }
    if (r.state === "ok") { setValid(I, r.sym); return; }
    if (r.state === "other") { note(I, ""); askSwitch(I, r.sym, r.at, {}); return; }
    noteNone(I, r, true);
  }
  function softCommit(I) {
    var f = field(I); if (!f || !D.body.contains(f)) return;
    var r = resolve(f.value);
    if (r.state === "empty") { f.classList.remove("bad"); return; }
    if (r.state === "ok") { f.classList.remove("bad"); I.symOk = r.sym; if (I.root.querySelector(".aix-note.err,.aix-note.warn")) note(I, ""); return; }
    if (r.state === "other") noteOther(I, r, true); else noteNone(I, r, true);
  }

  function attach(I) {
    var inp = field(I); if (!inp || inp.dataset.aisg) return; inp.dataset.aisg = "1";
    inp.setAttribute("role", "combobox"); inp.setAttribute("aria-autocomplete", "list"); inp.setAttribute("aria-expanded", "false");
    inp.setAttribute("autocapitalize", "characters"); inp.setAttribute("autocorrect", "off"); inp.setAttribute("spellcheck", "false"); inp.setAttribute("enterkeyhint", "go");
    inp.addEventListener("focus", function () { open(I, inp); try { inp.select(); } catch (e) { } });
    inp.addEventListener("click", function () { if (!S.open || S.inp !== inp) open(I, inp); });
    inp.addEventListener("input", function () {
      inp.classList.remove("bad"); note(I, "");
      if (!S.open || S.inp !== inp) open(I, inp);
      S.q = clean(inp.value); S.act = -1; paint(true); place();
    });
    inp.addEventListener("keydown", function (e) {
      var rows = S.open && dd ? dd.ls.querySelectorAll(".aisg-it") : [];
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault(); if (!S.open) { open(I, inp); return; } if (!rows.length) return;
        S.act = Math.max(0, Math.min(rows.length - 1, S.act + (e.key === "ArrowDown" ? 1 : -1)));
        rows.forEach(function (x, i) { x.classList.toggle("act", i === S.act); });
        var a = rows[S.act]; if (a) a.scrollIntoView({ block: "nearest" });
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (S.open && S.act >= 0 && rows[S.act]) { rows[S.act].click(); return; }
        close(); hardCommit(I); try { if (mobile()) inp.blur(); } catch (x) { }
      } else if (e.key === "Escape") { if (S.open) { e.stopPropagation(); close(); } }
    });
    inp.addEventListener("blur", function () {
      setTimeout(function () {
        if (S.hold || (dd && D.activeElement && dd.root.contains(D.activeElement))) return;
        if (S.open && S.inp === inp) close();
        softCommit(I);
      }, 130);
    });
    I.root.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest("[data-ns],[data-sw]"); if (!b || !I.root.contains(b)) return;
      if (b.dataset.ns) { setValid(I, b.dataset.ns); return; }
      askSwitch(I, b.dataset.sw, b.dataset.at, {});
    });
  }

  W.addEventListener("resize", place);
  if (W.visualViewport) { W.visualViewport.addEventListener("resize", place); W.visualViewport.addEventListener("scroll", place); }
  W.addEventListener("hashchange", close);
  W.addEventListener("nhip:house-changed", function () { close(); cache = {}; });
  D.addEventListener("scroll", function (e) { if (S.open && dd && !dd.root.contains(e.target)) place(); }, true);
  D.addEventListener("pointerdown", function (e) { if (S.open && dd && !dd.root.contains(e.target) && e.target !== S.inp) close(); }, true);

  W.NHIPAISym = { attach: attach, check: check, resolve: resolve, refs: textRefs, items: items, note: note, close: close };
})();
