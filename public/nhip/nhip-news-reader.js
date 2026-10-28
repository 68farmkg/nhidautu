/* NHỊP V3.00 — ĐỌC TIN NGAY TRONG TRANG + NÚT "✦ AI PHÂN TÍCH NHANH"
   1) Mọi link tin báo ngoài (Dashboard, Tin tức, tin theo mã ở Phân tích/Danh mục/Theo dõi, Cảnh báo, Lịch sử…) KHÔNG còn mở tab/trình duyệt khác.
      Bấm vào sẽ mở một bảng tại chỗ, chỉ hiện nội dung bài (tiêu đề, ảnh, các đoạn văn) lấy qua /proxy/article của Worker.
   2) Cạnh mỗi tin có nút "✦ AI phân tích nhanh": bảng tóm tắt ngắn (3-4 ý chính), tác động tiềm năng, kèm đường dẫn tới mã/ngành/mục liên quan.
      Tóm tắt tự động hiện ngay (không cần khóa AI); nếu Nhịp AI sẵn sàng thì được nâng cấp bằng câu trả lời của AI.
   Không sửa app.js: chạy độc lập, tự gắn nút bằng MutationObserver, chặn click link ngoài ở pha capture. */
(function (W, D) {
  "use strict";
  if (W.NHIPNewsReader) return;

  /* ---------- tiện ích ---------- */
  var ESCM = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  function E(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return ESCM[c]; }); }
  function txt(el) { return String(el && el.textContent || "").replace(/\s+/g, " ").trim(); }
  function plain(s) { var C = W.NHIPClean; if (C) return C.fix(s); return String(s || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim(); }
  function T(m, bad) { try { if (typeof W.toast === "function") W.toast(m, bad); } catch (e) { } }
  function https(u) { return String(u || "").replace(/^http:/i, "https:"); }
  function isExt(a) {
    var h = a && a.getAttribute && a.getAttribute("href") || "";
    return /^https?:\/\//i.test(h) && !a.hasAttribute("data-nr-ext");
  }
  function symInfo(s) { try { return W.NHIPSYM && W.NHIPSYM.info ? W.NHIPSYM.info(s) : null; } catch (e) { return null; } }
  function symName(s) { try { return W.NHIPSYM ? (W.NHIPSYM.name(s) || "") : ""; } catch (e) { return ""; } }
  function short(s, n) { s = String(s || ""); if (s.length <= n) return s; var c = s.slice(0, n - 1), i = c.lastIndexOf(" "); return (i > n * 0.6 ? c.slice(0, i) : c) + "…"; }
  function st() { try { return typeof ST !== "undefined" ? ST : null; } catch (e) { return null; } }

  /* ---------- siêu dữ liệu tin ---------- */
  var META = {};
  var SCOPE = ".nws,.nw-card,.tw-news,.nv-log,.nd-box,.nwp-row,li,.row,.panel";
  function metaOf(link, el) {
    var m = { link: link, title: "", source: "", date: "", desc: "", syms: [] }, d = W.__dbNews && W.__dbNews[link];
    if (d) { m.title = plain(d.title); m.source = d.source || ""; m.date = d.date || ""; m.desc = plain(d.description || d.desc); }
    var k = META[link]; if (k) for (var p in k) if (k[p] && (!m[p] || !m[p].length)) m[p] = k[p];
    if (el && el.closest) {
      var b = el.closest(".nws,.nw-card,.tw-news,.nd-box") || el.closest("li");
      if (b) {
        var h = b.querySelector("h3,h2,strong") || b.querySelector("a[href^='http']");
        if (h && !m.title) m.title = txt(h);
        var s = b.querySelector(".nw-src,.nws-src");
        if (s && !m.source) { var p2 = txt(s).replace(/^Báo chí\s*·\s*/, "").split("·"); m.source = p2[0].trim(); if (!m.date && p2[1]) m.date = p2[1].trim(); }
        var dsc = b.querySelector("p"); if (dsc && !m.desc) m.desc = txt(dsc).replace(/…$/, "");
        var ch = b.querySelectorAll(".nw-sym[data-sym],.nw-sym[href*='?s=']");
        for (var i = 0; i < ch.length; i++) { var sy = ch[i].getAttribute("data-sym") || (ch[i].getAttribute("href").match(/[?&]s=([A-Z0-9.]+)/) || [])[1]; if (sy && m.syms.indexOf(sy) < 0) m.syms.push(sy); }
      }
      if (!m.title && el.tagName === "A") m.title = txt(el);
    }
    if (!m.title) m.title = m.link.replace(/^https?:\/\/(www\.)?/, "").slice(0, 80);
    if (!m.source) { try { m.source = new URL(link).hostname.replace(/^www\./, ""); } catch (e) { } }
    META[link] = m; return m;
  }

  /* ---------- toàn văn bài báo (qua Worker) ---------- */
  var ART = {}, PRM = {};
  /* Làm sạch bài trả về: sửa ký tự lỗi, bỏ đoạn là mã, ẩn quảng cáo (lọc lần nữa phòng khi Worker cũ/bộ nhớ đệm) */
  function cleanArt(a) { var C = W.NHIPClean; return C && C.art ? C.art(a) : a; }
  function fetchOnce(k, title, retry) {
    return fetch("/proxy/article?u=" + encodeURIComponent(k) + (title ? "&t=" + encodeURIComponent(String(title).slice(0, 300)) : "") + (retry ? "&r=" + Date.now() : ""), { headers: { Accept: "application/json" } })
      .then(function (r) { return r.json().catch(function () { return null; }).then(function (a) { if (!r.ok || !a || typeof a !== "object") a = { ok: false, error: (a && a.error) || "Không đọc được trang nguồn." }; return a; }); })
      .catch(function () { return { ok: false, code: 0, error: "Không kết nối được máy chủ đọc tin." }; });
  }
  /* V3.04: gửi kèm tiêu đề để Worker tìm bài cùng sự kiện khi bài gốc bị chặn; tự thử lại 1 lần nếu lỗi tạm thời */
  function getArt(link, title) {
    var k = https(link), tt = title || (META[link] && META[link].title) || "";
    if (ART[k]) return Promise.resolve(ART[k]);
    if (PRM[k]) return PRM[k];
    PRM[k] = fetchOnce(k, tt, false)
      .then(function (a) { if (a && a.ok) return a; var c = a && a.code; if (c === "deny" || c === 415 || c === 413) return a; return new Promise(function (res) { setTimeout(res, 900); }).then(function () { return fetchOnce(k, tt, true); }).then(function (b) { return b && b.ok ? b : (a || b); }); })
      .then(function (a) { a = cleanArt(a); if (a && a.ok) ART[k] = a; delete PRM[k]; return a; });
    return PRM[k];
  }
  function artText(a) { return a && a.ok && a.blocks ? a.blocks.filter(function (b) { return b.t === "p"; }).map(function (b) { return b.x; }).join(" ") : ""; }

  /* ---------- hai bảng (reader + AI) ---------- */
  function mk(id, cls) {
    var e = D.createElement("div"); e.id = id; e.className = "nr-ov " + cls; e.setAttribute("role", "dialog"); e.setAttribute("aria-modal", "true"); e.hidden = true;
    D.body.appendChild(e); return e;
  }
  var RD, AI, rdTok = 0, aiTok = 0, aiCtl = null;
  function ensure() { if (!RD) { RD = mk("nrRd", "nr-rd"); AI = mk("nrAi", "nr-ai-ov"); } }
  function lock() { D.documentElement.classList.toggle("nr-lock", !RD.hidden || !AI.hidden); }
  function house() { try { var H = W.NHIPHouse; return H && H.cur ? String(H.cur()).toUpperCase() : ""; } catch (e) { return ""; } }
  function closeOv(el) {
    if (!el || el.hidden) return; el.hidden = true; el.innerHTML = "";
    if (el === AI) { aiTok++; if (aiCtl) { try { aiCtl.abort(); } catch (e) { } aiCtl = null; } } else rdTok++;
    lock();
  }
  function closeAll() { ensure(); closeOv(AI); closeOv(RD); }


  /* V3.07 — chẩn đoán khi không đọc được: hiện link thật đang mở, nhớ + ẩn tin chết, báo nếu Worker còn bản cũ */
  function nrDiag(m, a, body) {
    var L = W.NHIPLink, code = a && a.code, real = (a && (a.url || a.resolved)) || m.link, host = "", path = "";
    try { var u = new URL(real); host = u.hostname.replace(/^www\./, ""); path = decodeURIComponent(u.pathname + u.search); } catch (e) { path = String(real || ""); }
    var dead = code === "gone" || code === 404 || code === 410;
    if (dead && L) L.markDead(m.link);
    var box = D.createElement("p"); box.className = "nr-st nr-dbg";
    var bad = L && L.bad(m.link);
    box.innerHTML = "Liên kết đang mở: <b>" + E(host) + "</b>" + E(path.length > 70 ? path.slice(0, 34) + "…" + path.slice(-30) : path) + (bad ? ' <b style="color:#f87171">· link bị hỏng/không phải bài báo</b>' : "");
    body.appendChild(box);
    if (L) L.ping().then(function (p) {
      if (!p || !p.old || RD.hidden) return;
      var w = D.createElement("p"); w.className = "nr-fail";
      w.innerHTML = "<b>Máy chủ Worker đang chạy bản cũ.</b><span>Chưa có bộ lọc tin chết (3.06+). Hãy triển khai lại tệp _worker.js lên Cloudflare Pages rồi tải lại trang (bản mới nhất: 3.07).</span>";
      body.insertBefore(w, body.firstChild);
    });
  }
  /* ---------- đọc tin ---------- */
  function openReader(m) {
    ensure(); var tok = ++rdTok;
    RD.hidden = false; RD.dataset.h = house(); lock();
    RD.innerHTML = '<div class="nr-sheet"><div class="nr-bar"><span class="nr-bsrc">' + E(m.source || "Tin tức") + '</span><div class="nr-bact"><button type="button" class="nr-btn nr-aib" data-nrai data-link="' + E(m.link) + '">✦ <span>AI phân tích nhanh</span></button><button type="button" class="nr-x" data-nr-x aria-label="Đóng">✕</button></div></div>'
      + '<div class="nr-scroll"><article class="nr-art"><h1>' + E(m.title) + '</h1><div class="nr-meta">' + E(m.source || "") + (m.date ? " · " + E(m.date) : "") + '</div><div class="nr-body" data-nr-body><div class="nr-sk"><i></i><i></i><i></i><i class="s"></i><i></i><i class="s"></i></div><p class="nr-st">Đang tải nội dung bài viết…</p></div></article></div></div>';
    var sc = RD.querySelector(".nr-scroll"); if (sc) sc.scrollTop = 0;
    getArt(m.link, m.title).then(function (a) { if (tok !== rdTok || RD.hidden) return; paintArt(m, a); });
  }
  function paintArt(m, a) {
    var body = RD.querySelector("[data-nr-body]"); if (!body) return;
    var ok = a && a.ok && a.blocks && a.blocks.length, h = "";
    if (ok) {
      if (a.title) { var t = RD.querySelector(".nr-art h1"); if (t) t.textContent = a.title; }
      var meta = RD.querySelector(".nr-meta"); if (meta && a.date && !m.date) { var dd = new Date(a.date); if (!isNaN(dd)) meta.textContent = (m.source || "") + " · " + dd.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
      if (a.alt) h += '<div class="nr-alt">Không đọc được bài gốc từ ' + E(a.origHost || m.source || "nguồn này") + ". Dưới đây là bài <b>cùng sự kiện</b> của " + E(a.host || "báo khác") + ". Nội dung có thể khác đôi chút so với bài gốc.</div>";
      if (a.hero) h += '<figure class="nr-fig"><img src="' + E(a.hero) + '" referrerpolicy="no-referrer" alt=""></figure>';
      var pn = 0, im = 0;
      a.blocks.forEach(function (b) {
        if (b.t === "h") h += "<h2>" + E(b.x) + "</h2>";
        else { h += "<p>" + E(b.x) + "</p>"; pn++; var g = a.imgs && a.imgs[im]; if (pn % 3 === 0 && g) { im++; h += '<figure class="nr-fig"><img src="' + E(g.u) + '" referrerpolicy="no-referrer" loading="lazy" alt="' + E(g.c) + '">' + (g.c ? "<figcaption>" + E(g.c) + "</figcaption>" : "") + "</figure>"; } }
      });
      h += '<p class="nr-end">Nội dung thuộc về ' + E(m.source || "nguồn tin") + ". Nhịp Đầu Tư chỉ hiển thị lại để đọc nhanh, không phải khuyến nghị đầu tư." + (a.ads ? " Đã ẩn " + a.ads + " mục quảng cáo/nội dung tài trợ." : "") + "</p>";
      var sh0 = RD.querySelector(".nr-sheet"); if (sh0) sh0.classList.remove("nr-fit");
    } else {
      var d = plain(m.desc || (a && a.desc) || ""), ttl = plain(m.title || ""), dk = d.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim(), tk = ttl.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
      if (!d || (tk && dk.indexOf(tk.slice(0, 40)) === 0 && dk.length < tk.length + 60)) d = "";   /* mô tả chỉ lặp lại tiêu đề + tên báo thì không hiện */
      var code = a && a.code, why = (a && a.error) || "";
      if (code === "gone" || code === 404 || code === 410) why = "Bài gốc đã bị báo gỡ hoặc không còn tồn tại (mã " + (typeof code === "number" ? code : "404") + "). Đã ẩn tin này khỏi danh sách.";
      else if (code === "gnews") why = "Đã thử giải liên kết Google News và tìm bài cùng sự kiện ở báo khác nhưng chưa được. Bấm Thử lại sau ít phút.";
      else if (typeof code === "number" && code >= 500) why = "Trang báo đang quá tải hoặc chặn truy cập tự động (mã " + code + "). Thử lại sau ít phút.";
      else if (code === 403 || code === 429) why = "Trang báo từ chối truy cập tự động (mã " + code + ").";
      else if (!why) why = "Trang nguồn không cho đọc trực tiếp (có thể bài cần đăng nhập hoặc tải bằng script).";
      var sh1 = RD.querySelector(".nr-sheet"); if (sh1) sh1.classList.add("nr-fit");
      h = '<div class="nr-fail"><b>Chưa lấy được toàn văn bài này.</b><span>' + E(plain(why)) + "</span></div>"
        + (d ? '<div class="nr-sum"><div class="nr-lb">TÓM TẮT TỪ NGUỒN TIN</div><p>' + E(d) + "</p></div>" : "")
        + '<div class="nr-fact"><button type="button" class="nr-btn" data-nr-retry>↻ Thử lại</button><button type="button" class="nr-btn" data-nr-copy="' + E(m.link) + '">⧉ Sao chép liên kết</button><a class="nr-btn" href="' + E((a && (a.url || a.resolved)) || m.link) + '" target="_blank" rel="noopener noreferrer" data-nr-ext>↗ Mở bài gốc</a></div>'
        + (a && a.trail && a.trail.length ? '<p class="nr-st nr-dbg">Đã thử: ' + E(a.trail.join(" → ")) + "</p>" : "");
    }
    body.innerHTML = h;
    var sc = RD.querySelector(".nr-scroll"); if (sc && ok) sc.scrollTop = 0;
    if (!ok) nrDiag(m, a, body);
  }

  /* ---------- phân tích tự động (không cần khóa AI) ---------- */
  var POS = ["tăng trưởng", "tăng mạnh", "tăng", "lãi", "lợi nhuận", "kỷ lục", "vượt kế hoạch", "vượt", "cổ tức", "mua ròng", "nâng hạng", "hạ lãi suất", "ký kết", "trúng thầu", "khởi công", "mở rộng", "phục hồi", "bứt phá", "hợp tác", "đạt", "thuận lợi", "cải thiện", "nâng dự báo", "chia thưởng"];
  var NEG = ["giảm mạnh", "giảm", "lỗ", "bán ròng", "xử phạt", "bị phạt", "đình chỉ", "vi phạm", "nợ xấu", "hủy", "huỷ", "thanh tra", "khởi tố", "truy tố", "cảnh báo", "sụt", "rủi ro", "chậm", "thua lỗ", "tăng lãi suất", "áp lực", "khó khăn", "trượt", "hạ dự báo", "bị bán", "cắt giảm", "phá sản", "thoái lui", "mất"];
  var EVS = [
    ["Kết quả kinh doanh", /doanh thu|lợi nhuận|lãi ròng|quý\s+[1-4ivIV]+|báo cáo tài chính|kết quả kinh doanh|biên lợi nhuận/i],
    ["Cổ tức · cổ phiếu thưởng", /cổ tức|cổ phiếu thưởng|chia thưởng|quyền mua|ESOP|ngày giao dịch không hưởng quyền/i],
    ["Phát hành · huy động vốn", /phát hành|huy động vốn|trái phiếu|tăng vốn|chào bán|IPO/i],
    ["M&A · thoái vốn · sở hữu", /thâu tóm|sáp nhập|mua lại|thoái vốn|chuyển nhượng|cổ đông lớn|nhà đầu tư nước ngoài|room ngoại/i],
    ["Lãi suất · tiền tệ · vĩ mô", /lãi suất|tỷ giá|lạm phát|CPI|GDP|ngân hàng nhà nước|NHNN|Fed|tín dụng|xuất khẩu|nhập khẩu|FDI|vĩ mô/i],
    ["Thị trường · dòng tiền", /VN-?Index|thanh khoản|khối ngoại|dòng tiền|phiên|chỉ số|margin|tự doanh/i],
    ["Pháp lý · xử phạt", /xử phạt|vi phạm|khởi tố|thanh tra|đình chỉ|cảnh báo|kiểm soát|hạn chế giao dịch/i],
    ["Dự án · bất động sản", /dự án|bất động sản|khu đô thị|mở bán|giải phóng mặt bằng|hạ tầng|khởi công/i]
  ];
  var SECR = [["Ngân hàng", /ngân hàng|tín dụng|nợ xấu/i], ["Bất động sản", /bất động sản|dự án|khu đô thị/i], ["Chứng khoán", /công ty chứng khoán|môi giới|margin/i], ["Dầu khí · năng lượng", /dầu khí|năng lượng|điện|xăng dầu/i], ["Thép · vật liệu", /thép|xi măng|vật liệu/i], ["Bán lẻ · tiêu dùng", /bán lẻ|tiêu dùng|siêu thị/i], ["Công nghệ", /công nghệ|phần mềm|chuyển đổi số|AI\b/i]];

  function sentences(t) {
    t = String(t || "").replace(/\s+/g, " ").trim(); var out = [], cur = "";
    for (var i = 0; i < t.length; i++) {
      var c = t[i]; cur += c;
      if (/[.!?…]/.test(c)) {
        var n = t[i + 1], nn = t[i + 2];
        if (n === undefined || (/\s/.test(n) && nn && /[A-ZÀ-ỴĐ0-9"“(]/.test(nn))) { if (cur.trim().length > 25) out.push(cur.trim()); cur = ""; }
      }
    }
    if (cur.trim().length > 25) out.push(cur.trim());
    return out;
  }
  function cnt(t, arr) { var low = t.toLowerCase(), n = 0; for (var i = 0; i < arr.length; i++) { var k = arr[i], j = 0, p; while ((p = low.indexOf(k, j)) >= 0) { n++; j = p + k.length; if (n > 40) return n; } } return n; }
  function findSyms(m, text) {
    var out = (m.syms || []).slice(), full = (m.title + ". " + (text || m.desc || "")).slice(0, 12000);
    try { var r = W.NHIPSYM && W.NHIPSYM.scan ? W.NHIPSYM.scan(full) : []; r.forEach(function (x) { if (x && x.sym && out.indexOf(x.sym) < 0) out.push(x.sym); }); } catch (e) { }
    var cur = house(), same = [], other = [];
    out.forEach(function (s) { var f = String((symInfo(s) || {}).floor || "").toUpperCase(); (f && cur && f !== cur ? other : same).push(s); });
    return same.concat(other).slice(0, 6);
  }
  function analyze(m, a) {
    var body = artText(a), text = body || m.desc || "", all = m.title + ". " + text, syms = findSyms(m, all);
    var ss = sentences(text.length > 6000 ? text.slice(0, 6000) : text), sc = ss.map(function (s, i) {
      var v = (i === 0 ? 3 : i === 1 ? 1.2 : 0) + (/\d/.test(s) ? 2 : 0) + (/%|tỷ|triệu|USD|đồng|điểm/i.test(s) ? 2 : 0) + cnt(s, POS) * 0.6 + cnt(s, NEG) * 0.6;
      syms.forEach(function (y) { if (s.indexOf(y) >= 0) v += 2.5; });
      if (s.length > 280) v -= 2; if (s.length < 50) v -= 1; return v;
    });
    var want = body && body.length > 1800 ? 4 : 3, idx = ss.map(function (_, i) { return i; }).sort(function (x, y) { return sc[y] - sc[x] || x - y; }).slice(0, want).sort(function (x, y) { return x - y; });
    var pts = idx.map(function (i) { return short(ss[i], 230); });
    if (!pts.length && text) pts = [short(text, 230)];
    var p = cnt(all, POS), n = cnt(all, NEG), tone = p + n < 2 ? "neu" : p > n * 1.3 ? "pos" : n > p * 1.3 ? "neg" : "mix";
    var evs = EVS.filter(function (e) { return e[1].test(all); }).slice(0, 3).map(function (e) { return e[0]; });
    var secs = []; syms.forEach(function (s) { var i = symInfo(s); if (i && i.sector && i.sector !== "Chỉ số" && secs.indexOf(i.sector) < 0) secs.push(i.sector); });
    if (!secs.length) SECR.forEach(function (r) { if (r[1].test(all) && secs.length < 2) secs.push(r[0]); });
    return { pts: pts, tone: tone, pos: p, neg: n, evs: evs, syms: syms, secs: secs.slice(0, 3), full: !!body, ex: ss.length ? short(idx.map(function (i) { return ss[i]; }).join(" "), 1050) : short(text, 1050) };
  }
  var TONE = { pos: ["up", "Thiên về thuận lợi"], neg: ["dn", "Thiên về bất lợi"], mix: ["mid", "Hai chiều"], neu: ["neu", "Trung lập / chưa rõ"] };

  /* ---------- liên kết liên quan ---------- */
  function related(an) {
    var s = st(), wl = (s && s.watchlist) || [], pf = ((s && s.portfolio) || []).map(function (p) { return p.symbol; }), h = "";
    if (an.syms.length) {
      h += '<div class="nr-lb">MÃ LIÊN QUAN</div><div class="nr-syms">';
      an.syms.forEach(function (y) {
        var nm = symName(y), tag = pf.indexOf(y) >= 0 ? '<em>Trong danh mục</em>' : wl.indexOf(y) >= 0 ? '<em>Đang theo dõi</em>' : "", u = encodeURIComponent(y);
        h += '<div class="nr-sym"><a class="nr-symm" href="#/phan-tich?s=' + u + '" data-nr-go><b>' + E(y) + "</b>" + (nm && nm !== y ? "<small>" + E(short(nm, 18)) + "</small>" : "") + tag + '</a><a href="#/tong-quan?s=' + u + '" data-nr-go title="Biểu đồ">📈</a><a href="#/giao-dich?s=' + u + '" data-nr-go title="Giao dịch">💹</a></div>';
      });
      h += "</div>";
    }
    var rows = [];
    an.secs.forEach(function (x) { rows.push(['#/thi-truong', "🏷 Ngành " + x + " · Thị trường"]); });
    if (an.evs.some(function (e) { return /vĩ mô/i.test(e); })) rows.push(["#/tin-tuc", "🌐 Tin Vĩ mô & quốc tế"]);
    if (an.evs.some(function (e) { return /Cổ tức/.test(e); })) rows.push(["#/danh-muc", "💰 Lịch cổ tức trong Danh mục"]);
    if (an.syms.length) { rows.push(["#/theo-doi", "👁 Danh sách theo dõi"]); rows.push(["#/canh-bao", "🔔 Tạo cảnh báo cho mã"]); }
    rows.push(["#/tin-tuc", "📰 Tin tức khác"]);
    var seen = {}; rows = rows.filter(function (r) { var k = r[0] + r[1]; return seen[k] ? false : (seen[k] = 1); });
    h += '<div class="nr-lb">MỤC LIÊN QUAN</div><div class="nr-links">' + rows.map(function (r) { return '<a class="nr-chip" href="' + r[0] + '" data-nr-go>' + E(r[1]) + "</a>"; }).join("") + "</div>";
    return h;
  }

  /* ---------- AI phân tích nhanh ---------- */
  var AIC = {};
  function fmtInline(s) { return E(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>"); }
  function parseAi(t) {
    t = String(t || "").replace(/\r/g, "").trim(); if (!t) return null;
    var g = function (re) { var m = t.match(re); return m ? m[1].trim() : ""; };
    var s = g(/T[ÓO]M\s*T[ẮA]T\s*[:：]\s*\**\s*([\s\S]*?)(?=\n\s*\**\s*(?:T[ÁA]C\s*[ĐD][ỘO]NG|C[ẦA]N\s*KI[ỂE]M)|$)/i),
      i = g(/T[ÁA]C\s*[ĐD][ỘO]NG\s*[:：]\s*\**\s*([\s\S]*?)(?=\n\s*\**\s*(?:C[ẦA]N\s*KI[ỂE]M)|$)/i),
      c = g(/C[ẦA]N\s*KI[ỂE]M\s*(?:TRA)?\s*[:：]\s*\**\s*([\s\S]*)$/i);
    if (!s && !i) return { raw: t };
    return { sum: s, imp: i, chk: c };
  }
  function aiQuestion(m, an) {
    var q = "Tóm tắt nhanh tin này cho nhà đầu tư bằng tiếng Việt, tối đa 110 từ, CHỈ dùng dữ kiện trong đoạn trích, không thêm số liệu, không khuyến nghị mua/bán. Trả lời đúng 3 dòng:\nTÓM TẮT: 2-3 câu.\nTÁC ĐỘNG: thuận lợi/bất lợi/trung lập và lý do ngắn (nêu rõ đây là suy luận).\nCẦN KIỂM TRA: 1-2 ý.\n"
      + "Tiêu đề: " + m.title + "\nNguồn: " + (m.source || "") + (m.date ? ", " + m.date : "") + (an.syms.length ? "\nMã nhắc đến: " + an.syms.join(", ") : "") + "\nTrích: ";
    return (q + an.ex).slice(0, 1985);
  }
  function aiHtml(m, an, ai, state) {
    var tn = TONE[an.tone], h = '<div class="nr-sheet nr-aish"><div class="nr-bar"><span class="nr-bsrc">✦ AI phân tích nhanh</span><div class="nr-bact"><button type="button" class="nr-x" data-nr-x aria-label="Đóng">✕</button></div></div><div class="nr-scroll"><div class="nr-art nr-aibox">';
    h += '<h2 class="nr-at">' + E(m.title) + '</h2><div class="nr-meta">' + E(m.source || "") + (m.date ? " · " + E(m.date) : "") + "</div>";
    var tag = ai && ai.name ? "AI · " + E(ai.name) + (ai.model ? " " + E(ai.model) : "") : "Tóm tắt tự động";
    h += '<div class="nr-lb">TÓM TẮT <span class="nr-src">' + tag + "</span></div>";
    if (ai && ai.p && ai.p.sum) h += '<p class="nr-p">' + fmtInline(ai.p.sum) + "</p>";
    else if (ai && ai.p && ai.p.raw) h += '<p class="nr-p">' + fmtInline(ai.p.raw).replace(/\n+/g, "<br>") + "</p>";
    else h += an.pts.length ? "<ul class=\"nr-ul\">" + an.pts.map(function (x) { return "<li>" + E(x) + "</li>"; }).join("") + "</ul>" : '<p class="nr-p muted">Nguồn tin không kèm đủ nội dung để tóm tắt.</p>';
    if (state === "load") h += '<p class="nr-st"><i class="nr-spin"></i>Đang nhờ Nhịp AI rà lại…</p>';
    else if (state === "noai") h += '<p class="nr-st">Nhịp AI chưa sẵn sàng nên đang hiển thị tóm tắt tự động từ nội dung bài.</p>';
    else if (state === "short") h += '<p class="nr-st">Chưa tải được toàn văn, tóm tắt dựa trên tiêu đề và mô tả của nguồn.</p>';
    h += '<div class="nr-lb">TÁC ĐỘNG TIỀM NĂNG <span class="nr-src">suy luận, không phải khuyến nghị</span></div>';
    if (ai && ai.p && ai.p.imp) h += '<p class="nr-p">' + fmtInline(ai.p.imp) + "</p>";
    else h += '<p class="nr-p"><span class="nr-pill ' + tn[0] + '">' + tn[1] + "</span> " + (an.tone === "neu" ? "Tin chưa nêu rõ yếu tố thuận lợi hay bất lợi." : an.tone === "pos" ? "Nội dung nghiêng về các từ ngữ tích cực (tăng trưởng, lợi nhuận, ký kết…). Gợi ý theo từ khóa, cần đối chiếu số liệu chính thức." : an.tone === "neg" ? "Nội dung nghiêng về các từ ngữ tiêu cực (giảm, lỗ, vi phạm, rủi ro…). Gợi ý theo từ khóa, cần đối chiếu số liệu chính thức." : "Nội dung có cả yếu tố thuận lợi lẫn bất lợi. Gợi ý theo từ khóa, cần đối chiếu số liệu chính thức.") + "</p>";
    if (an.evs.length) h += '<div class="nr-evs">' + an.evs.map(function (e) { return '<span class="nr-tag">' + E(e) + "</span>"; }).join("") + "</div>";
    if (ai && ai.p && ai.p.chk) h += '<div class="nr-lb">CẦN KIỂM TRA</div><p class="nr-p">' + fmtInline(ai.p.chk) + "</p>";
    h += related(an);
    h += '<div class="nr-fact"><button type="button" class="nr-btn pri" data-nr-read data-link="' + E(m.link) + '">📖 Đọc toàn văn</button><button type="button" class="nr-btn" data-nr-cp>⧉ Chép tóm tắt</button></div>';
    h += '<p class="nr-end">Tham khảo từ nội dung tin, không phải khuyến nghị đầu tư. Hãy đối chiếu báo cáo chính thức và giá/khối lượng.</p></div></div></div>';
    return h;
  }
  function openAI(m) {
    ensure(); var tok = ++aiTok; if (aiCtl) { try { aiCtl.abort(); } catch (e) { } aiCtl = null; }
    AI.hidden = false; AI.dataset.h = house(); lock();
    var an = analyze(m, ART[https(m.link)]), cached = AIC[m.link];
    if (cached) { AI.innerHTML = aiHtml(m, cached.an, cached.ai, ""); AI._cur = { m: m, an: cached.an, ai: cached.ai }; return; }
    AI.innerHTML = aiHtml(m, an, null, "load"); AI._cur = { m: m, an: an, ai: null };
    getArt(m.link, m.title).then(function (a) {
      if (tok !== aiTok || AI.hidden) return;
      var full = a && a.ok; an = analyze(m, full ? a : null);
      AI.innerHTML = aiHtml(m, an, null, "load"); AI._cur = { m: m, an: an, ai: null };
      var ctl = (typeof AbortController !== "undefined") ? new AbortController() : null; aiCtl = ctl;
      var to = setTimeout(function () { try { ctl && ctl.abort(); } catch (e) { } }, 45000);
      return fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: aiQuestion(m, an), symbol: an.syms[0] || "", provider: "auto", screen: "tin-tuc" }), signal: ctl ? ctl.signal : undefined })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (o) { return { ok: r.ok, o: o }; }); })
        .then(function (x) {
          clearTimeout(to); if (tok !== aiTok || AI.hidden) return;
          if (x.ok && x.o && x.o.answer) {
            var ai = { name: x.o.name || "Nhịp AI", model: x.o.model || "", p: parseAi(x.o.answer) };
            AIC[m.link] = { an: an, ai: ai }; AI.innerHTML = aiHtml(m, an, ai, ""); AI._cur = { m: m, an: an, ai: ai };
          } else { AI.innerHTML = aiHtml(m, an, null, full ? "noai" : "short"); }
        });
    }).catch(function () { if (tok === aiTok && !AI.hidden) { var c = AI._cur || {}; AI.innerHTML = aiHtml(m, c.an || an, null, "noai"); } });
  }
  function copyText(s, ok) {
    function done() { T(ok || "Đã sao chép"); }
    try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(s).then(done, fb); return; } } catch (e) { }
    fb(); function fb() { try { var t = D.createElement("textarea"); t.value = s; t.style.cssText = "position:fixed;opacity:0"; D.body.appendChild(t); t.select(); D.execCommand("copy"); t.remove(); done(); } catch (e) { T("Không sao chép được", 1); } }
  }
  function summaryText() {
    var c = AI && AI._cur; if (!c) return ""; var m = c.m, an = c.an, ai = c.ai, L = [m.title, (m.source || "") + (m.date ? " · " + m.date : ""), ""];
    if (ai && ai.p && (ai.p.sum || ai.p.raw)) { L.push("Tóm tắt: " + (ai.p.sum || ai.p.raw)); if (ai.p.imp) L.push("Tác động: " + ai.p.imp); if (ai.p.chk) L.push("Cần kiểm tra: " + ai.p.chk); }
    else { an.pts.forEach(function (x) { L.push("• " + x); }); L.push("Tác động: " + TONE[an.tone][1]); }
    if (an.syms.length) L.push("Mã liên quan: " + an.syms.join(", "));
    return L.join("\n");
  }

  /* ---------- gắn nút vào các dòng tin ---------- */
  var BTN = '<button type="button" class="nr-ai" data-nrai data-link="{L}" title="Tóm tắt nhanh tin này bằng AI">✦ <span>AI phân tích nhanh</span></button>';
  function linkOf(box) { var a = box.querySelector("a[href^='http']"); if (a) return a.getAttribute("href"); var b = box.querySelector("[data-o],[data-svn]"); return b ? (b.getAttribute("data-o") || b.getAttribute("data-svn")) : ""; }
  function decorate() {
    var v = D.getElementById("view"); if (!v) return;
    /* 1) .nws: Dashboard + tin theo mã ở Phân tích/Danh mục/Thị trường */
    v.querySelectorAll("article.nws:not([data-nrx])").forEach(function (x) {
      x.setAttribute("data-nrx", "1"); var a = x.querySelector("a.newsitem"), l = a && a.getAttribute("href"); if (!l) return;
      metaOf(l, a); var tmp = D.createElement("div"); tmp.innerHTML = BTN.replace("{L}", E(l)); var b = tmp.firstChild; b.classList.add("nr-ai-row"); x.appendChild(b);
    });
    /* 2) Trang Tin tức: thẻ .nw-card */
    v.querySelectorAll(".nw-card:not([data-nrx])").forEach(function (x) {
      x.setAttribute("data-nrx", "1"); var l = linkOf(x); if (!l) return; metaOf(l, x);
      var act = x.querySelector(".nw-act"); if (!act) return; var tmp = D.createElement("div"); tmp.innerHTML = BTN.replace("{L}", E(l)); var b = tmp.firstChild, f = act.querySelector("[data-sv]");
      act.insertBefore(b, f ? f.nextSibling : null);
    });
    /* 3) Theo dõi (.tw-news) và Dashboard tin điểm nhấn (li) */
    v.querySelectorAll(".tw-news:not([data-nrx]),#db-focus li:not([data-nrx])").forEach(function (x) {
      x.setAttribute("data-nrx", "1"); var a = x.querySelector("a[href^='http']"); if (!a) return; var l = a.getAttribute("href"); metaOf(l, a);
      var tmp = D.createElement("div"); tmp.innerHTML = BTN.replace("{L}", E(l)); var b = tmp.firstChild; b.classList.add("nr-ai-inl"); x.appendChild(b);
    });
    /* 4) Đổi nhãn nút "Bài gốc ↗ / Đọc bài gốc ↗ / Mở tin gốc" thành đọc tại chỗ */
    v.querySelectorAll("a[target='_blank']").forEach(function (a) {
      if (!isExt(a) || a.getAttribute("data-nrl")) return; a.setAttribute("data-nrl", "1");
      var t = txt(a); if (/b[àa]i gốc|tin gốc/i.test(t)) a.textContent = "📖 Đọc toàn văn";
    });
  }
  var raf = 0, MO = null;
  function schedule() { if (raf) return; raf = (W.requestAnimationFrame || setTimeout)(function () { raf = 0; try { decorate(); } catch (e) { } }); }

  /* ---------- bắt click ---------- */
  function onClick(e) {
    var t = e.target; if (!t || !t.closest) return;
    ensure();
    var x = t.closest("[data-nr-x]");
    if (x) { e.preventDefault(); e.stopPropagation(); var ov = x.closest(".nr-ov"); closeOv(ov); return; }
    var ov0 = t.classList && t.classList.contains("nr-ov") ? t : null;
    if (ov0) { e.preventDefault(); e.stopPropagation(); closeOv(ov0); return; }
    var go = t.closest("[data-nr-go]"); if (go) { closeAll(); return; }   // để hash đổi trang bình thường
    var ai = t.closest("[data-nrai]");
    if (ai) { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); var l = ai.getAttribute("data-link"); openAI(metaOf(l, ai.closest(".nws,.nw-card,.tw-news,li,.nr-ov") || ai)); return; }
    var rd = t.closest("[data-nr-read]"); if (rd) { e.preventDefault(); e.stopPropagation(); var l2 = rd.getAttribute("data-link"); closeOv(AI); openReader(metaOf(l2)); return; }
    var rt = t.closest("[data-nr-retry]"); if (rt) { e.preventDefault(); var cur = RD && RD.querySelector(".nr-aib"); if (cur) { var l3 = cur.getAttribute("data-link"); delete ART[https(l3)]; openReader(metaOf(l3)); } return; }
    var cp = t.closest("[data-nr-copy]"); if (cp) { e.preventDefault(); copyText(cp.getAttribute("data-nr-copy"), "Đã sao chép liên kết"); return; }
    if (t.closest("[data-nr-cp]")) { e.preventDefault(); copyText(summaryText(), "Đã sao chép tóm tắt"); return; }
    var a = t.closest("a[href]");
    if (a && isExt(a) && a.getAttribute("target") === "_blank" && !a.closest(".nr-ov")) {
      e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      var link = a.getAttribute("href"); openReader(metaOf(link, a)); return;
    }
    if (a && isExt(a) && a.closest(".nw-card h3,#nd") && !a.closest(".nr-ov")) { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); openReader(metaOf(a.getAttribute("href"), a)); }
  }
  D.addEventListener("click", onClick, true);
  D.addEventListener("keydown", function (e) {
    if (e.key !== "Escape" || !RD) return; if (!AI.hidden) { closeOv(AI); e.preventDefault(); } else if (!RD.hidden) { closeOv(RD); e.preventDefault(); }
  });
  W.addEventListener("hashchange", function () { if (RD) closeAll(); });

  function start() {
    ensure(); decorate();
    try { MO = new MutationObserver(schedule); MO.observe(D.body, { childList: true, subtree: true }); } catch (e) { setInterval(decorate, 1500); }
  }
  if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", start); else start();

  W.NHIPNewsReader = { open: function (link, meta) { var m = metaOf(link); if (meta) for (var k in meta) if (meta[k]) m[k] = meta[k]; openReader(m); }, ai: function (link, meta) { var m = metaOf(link); if (meta) for (var k in meta) if (meta[k]) m[k] = meta[k]; openAI(m); }, close: closeAll, _analyze: analyze, _sentences: sentences, _parseAi: parseAi };
})(window, document);
