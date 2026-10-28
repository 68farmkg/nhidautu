/* NHỊP V2.94 — THẺ TRẢ LỜI AI DÙNG CHUNG
   Dùng cho: Phân tích › AI (nút "Phân tích dữ liệu thực" / "Báo cáo 6 phần") và Tin tức › AI phân tích (nút "Tóm tắt tin nổi bật").
   Mỗi câu trả lời có: nhãn sàn · trình bày có số mục/bảng/nhãn Dữ kiện–Suy luận · dữ liệu đã dùng · (Phân tích) khối Bằng chứng đã nạp
   · liên kết liên quan · nút hành động (Biểu đồ, Theo dõi, Cảnh báo, Lưu, Sao chép, Tải PDF) · câu hỏi gợi ý nối tiếp (đúng từng sàn).
   Khung chat: nút Dừng, Đính kèm, Micro dùng lại NHIPAICompose của khung Nhịp AI.
   Dùng các hàm/biến toàn cục của app.js: esc, api, ST, toast, saveWatch. */
(function (W) {
  "use strict";
  var D = document, REG = {}, SEQ = 0;
  var XN = { HOSE: "HOSE", HNX: "HNX", UPCOM: "UPCoM" };
  var IDX = { HOSE: "VNINDEX", HNX: "HNX", UPCOM: "UPCOM" }, IDXN = { HOSE: "VN-Index", HNX: "HNX-Index", UPCOM: "UPCoM-Index" };
  var BAND = { HOSE: 7, HNX: 10, UPCOM: 15 };
  function E(t) { return typeof esc === "function" ? esc(t) : String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }
  function T(m, e) { try { toast(m, e); } catch (x) { } }
  function exKey(x) { x = String(x || "").toUpperCase(); return x === "UPCOM" || x === "UPCOM" ? "UPCOM" : x === "HNX" ? "HNX" : x === "HOSE" ? "HOSE" : ""; }
  function hm(t) { return new Date(t || Date.now()).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); }

  /* ---------- Trình bày câu trả lời ---------- */
  function norm(t) {
    t = String(t || "").replace(/\r/g, "");
    t = t.replace(/^\s*\*\*\s*(\d)\s*[)\.]\s*([^*\n]+?)\s*\*\*:?\s*$/gm, "**$1. $2**");   /* **1) X** → **1. X** để thành tiêu đề mục */
    t = t.replace(/^\s*(\d)\)\s+\*\*([^*\n]+)\*\*:?\s*$/gm, "**$1. $2**");
    return t;
  }
  function pretty(t) {
    var h = (W.NHIPmd || function (x) { return "<p>" + E(x) + "</p>"; })(norm(t));
    h = h.replace(/<h4 class="sec">\s*(\d)[.)]\s*([\s\S]*?)<\/h4>/g, '<h4 class="sec"><span class="nhc-n">$1</span><span>$2</span></h4>');
    h = h.replace(/<(strong|b)>\s*Dữ kiện\s*:?\s*<\/\1>\s*:?/g, '<span class="nhc-tag fact">Dữ kiện</span>')
      .replace(/<(strong|b)>\s*Suy luận\s*:?\s*<\/\1>\s*:?/g, '<span class="nhc-tag infer">Suy luận</span>');
    var P = { "Tích cực": "up", "Tiêu cực": "dn", "Trái chiều": "mid", "Trung tính": "neu", "Đang mua": "up", "Mua mới": "up", "Bán mới": "dn", "Đứng ngoài": "neu", "Cao": "up", "Vừa": "mid", "Thấp": "dn", "Khá": "up", "Yếu": "dn", "Trung bình": "mid", "Đạt": "up", "Không đạt": "dn" };
    h = h.replace(/<td>\s*([^<]{2,14}?)\s*<\/td>/g, function (m, w) { var k = P[w] || P[w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()]; return k ? '<td><span class="nhc-pill ' + k + '">' + w + "</span></td>" : m; });
    return h;
  }

  /* ---------- Gợi ý nối tiếp & liên kết (đúng từng sàn) ---------- */
  function followUps(o) {
    var s = o.sym, ex = o.ex, n = XN[ex] || "", q = [];
    if (o.kind === "analysis" && s) {
      q.push("Điểm tham gia của " + s + (n ? " (" + n + ")" : "") + " đang nói gì và độ vững bằng chứng của sàn ra sao?");
      q.push("Mức giá hay điều kiện nào làm kịch bản tích cực của " + s + " mất hiệu lực?");
      if (ex === "HOSE") q.push("Nhóm bộ lọc xu hướng ở HOSE đóng vai trò gì trong điểm của " + s + "?");
      else if (ex === "HNX") q.push("Vì sao ở HNX RSIx được ưu tiên hơn các công cụ xu hướng khi đọc " + s + "?");
      else if (ex === "UPCOM") q.push("Thanh khoản mỏng của UPCoM ảnh hưởng thế nào tới độ tin cậy tín hiệu của " + s + "?");
      else q.push("Sàn của " + s + " chưa rõ thì phần nào của báo cáo bị hạn chế?");
      q.push("Điểm cộng cơ bản và tin của " + s + " chấm theo ngưỡng nào, có cờ đỏ không?");
    } else if (o.kind === "news") {
      q.push("Ba tin nào có thể tác động mạnh nhất tới sàn " + n + " phiên tới, theo điều kiện nào?");
      if (ex === "HOSE") q.push("Tin nào ảnh hưởng nhóm vốn hóa lớn trong VN30 hôm nay?");
      else if (ex === "HNX") q.push("Tin nào liên quan nhóm doanh nghiệp vừa và nhỏ trên HNX cần theo dõi?");
      else if (ex === "UPCOM") q.push("Tin nào nhắc rủi ro thanh khoản hoặc kế hoạch lên sàn của doanh nghiệp UPCoM?");
      q.push("Những sự kiện doanh nghiệp (cổ tức, đại hội, phát hành) nào được tin nhắc và mốc thời gian ra sao?");
    }
    return q.slice(0, 4);
  }
  function links(o) {
    var s = o.sym, a = [];
    if (o.kind === "analysis" && s) {
      a.push(["ev", "🧾 Bằng chứng " + s], ["#/tong-quan?s=" + s, "📈 Biểu đồ"], ["#/giao-dich?s=" + s, "💹 Giao dịch"], ["#/tin-tuc", "📰 Tin tức " + (XN[o.ex] || "")], ["#/canh-bao", "🔔 Cảnh báo"]);
    } else if (o.kind === "news") {
      a.push(["tab:top", "⭐ Tin nổi bật"], ["tab:dn", "🏢 Doanh nghiệp"], ["tab:cal", "📅 Lịch sự kiện"], ["#/thi-truong", "📊 Thị trường " + (XN[o.ex] || "")], ["#/dashboard", "🏠 Dashboard"]);
    }
    return a;
  }
  function acts(o, id) {
    var s = o.sym, a = [], watched = false; try { watched = s && ST.watchlist.indexOf(s) >= 0; } catch (e) { }
    if (o.kind === "analysis" && s) a.push(["chart", "📈 Biểu đồ " + s], ["ev", "🧾 Bằng chứng"], watched ? ["none", "★ Đang theo dõi"] : ["wl", "☆ Theo dõi"], ["al", "🔔 Cảnh báo"]);
    else if (o.kind === "news") a.push(["chart", "📈 Biểu đồ " + (IDXN[o.ex] || "chỉ số")], ["nwatch", "★ Tin mã theo dõi"], ["al", "🔔 Cảnh báo"]);
    a.push(["save", o.kind === "analysis" && o.report6 ? "💾 Lưu báo cáo" : "💾 Lưu"], ["copy", "📋 Sao chép"], ["pdf", "⬇ Tải PDF"]);
    return '<div class="aix-acts">' + a.map(function (x) { return '<button type="button" data-nc="' + x[0] + '"' + (x[0] === "none" ? " disabled" : "") + ">" + x[1] + "</button>"; }).join("") + "</div>" +
      (o.alOpen ? '<div class="aix-al"><select data-alt><option value="above">Giá ≥</option><option value="below">Giá ≤</option><option value="pct">Biến động ± ≥ (%)</option></select><input data-alv inputmode="decimal" placeholder="Giá (đồng) hoặc %"><button type="button" class="btn primary" data-nc="alok">Tạo</button><small>Giá tính bằng đồng/cổ phiếu (VD 98500). Máy chủ kiểm tra liên tục, cả khi bạn đóng ứng dụng.</small></div>' : "");
  }

  /* ---------- Dựng thẻ ---------- */
  function html(o) {
    o.id = o.id || "c" + (++SEQ) + uid(); REG[o.id] = o;
    var ex = exKey(o.ex), top = '<div class="nhc-top"><span class="nhc-ex">' + E(XN[ex] || "Thị trường") + (BAND[ex] ? " · ±" + BAND[ex] + "%" : "") + '</span><span class="nhc-kind">' +
      (o.kind === "analysis" ? (o.report6 ? "Báo cáo 6 phần" : "Phân tích dữ liệu thực") + (o.sym ? " · " + E(o.sym) : "") : "Tóm tắt tin nổi bật") + "</span>";
    if (o.chips) top += o.chips;
    if (o.evCheck) {
      var c = o.evCheck;
      top += c.match === true ? '<span class="nhc-chip ok" title="Điểm AI nhận trùng điểm tab Bằng chứng đang hiển thị">✔ Khớp tab Bằng chứng · ' + E(c.ai.score) + "/100</span>" : c.match === false ? '<span class="nhc-chip bad">⚠ Lệch tab Bằng chứng (' + E(c.tab.score) + " vs " + E(c.ai.score) + ")</span>" : "";
    }
    top += "</div>";
    var warn = o.warnings && o.warnings.length ? '<div class="nhc-warn"><ul>' + o.warnings.map(function (w) { return "<li>" + E(w) + "</li>"; }).join("") + "</ul></div>" : "";
    var cov = o.cover ? '<div class="nhc-cov">' + E(o.cover) + "</div>" : "";
    var body = '<div class="nhc-body">' + pretty(o.answer || "Không có nội dung trả về.") + "</div>";
    var via = '<div class="nhc-via">' + E([o.name, o.model].filter(Boolean).join(" · ") || "Nhịp AI") + (o.dataAt ? " · dữ liệu " + E(o.dataAt) : "") + (o.source ? " · " + E(o.source) : "") + " · " + hm(o.at) + "</div>";
    var used = o.used && o.used.length ? '<div class="aix-used">Dữ liệu đã dùng: ' + o.used.map(function (u) { return "<span>" + E(u) + "</span>"; }).join("") + "</div>" : "";
    var ev = o.evLines && o.evLines.length ? '<details class="nhc-ev"><summary>🧾 Bằng chứng đã nạp từ tab Bằng chứng (' + o.evLines.length + ' dòng)</summary><ul>' + o.evLines.map(function (l) { return "<li>" + E(l) + "</li>"; }).join("") + "</ul></details>" : "";
    var syms = o.syms && o.syms.length ? '<div class="nhc-sec"><span class="nhc-lb">Mã được nhắc trong tin</span><div class="nhc-syms">' + o.syms.map(function (s) { return '<button type="button" data-nc="sym" data-s="' + E(s) + '" title="Mở Phân tích ' + E(s) + '">' + E(s) + "</button>"; }).join("") + "</div></div>" : "";
    var lk = links(o), related = lk.length ? '<div class="nhc-sec"><span class="nhc-lb">Xem chi tiết tại</span><div class="nhc-links">' + lk.map(function (x) { return '<button type="button" data-nc="go" data-to="' + E(x[0]) + '">' + x[1] + "</button>"; }).join("") + "</div></div>" : "";
    var fu = followUps(o), follow = fu.length ? '<div class="aix-fu"><span>Hỏi tiếp:</span>' + fu.map(function (t) { return '<button type="button" data-nc="ask" data-p="' + E(t) + '">' + E(t) + "</button>"; }).join("") + "</div>" : "";
    var note = '<p class="nhc-note">' + E(o.note || "Tham khảo, không phải khuyến nghị đầu tư.") + "</p>";
    return '<div class="nhc" data-k="' + o.id + '" data-ex="' + E(ex) + '">' + top + warn + cov + body + via + used + ev + syms + related + acts(o, o.id) + follow + note + "</div>";
  }
  function wait(label) {
    return '<div class="nhc-wait"><span class="dots"><i></i><i></i><i></i></span><span>' + E(label || "Nhịp AI đang phân tích…") + '</span><button type="button" class="aix-stop" data-nc="stop">⏹ Dừng</button></div>';
  }

  /* ---------- Hành động ---------- */
  function go(to, o) {
    if (to === "ev") { if (location.hash.indexOf("#/phan-tich") !== 0 || (o.sym && location.hash.indexOf("s=" + o.sym) < 0)) location.hash = "#/phan-tich?s=" + (o.sym || ""); setTimeout(function () { var b = D.querySelector('#an-tabs [data-t="ev"]'); if (b) { b.click(); var p = D.getElementById("an-p-ev"); if (p && p.scrollIntoView) p.scrollIntoView({ behavior: "smooth", block: "start" }); } }, location.hash.indexOf("#/phan-tich") === 0 ? 30 : 700); return; }
    if (to.indexOf("tab:") === 0) { var b2 = D.querySelector('#nt [data-t="' + to.slice(4) + '"]'); if (b2) { b2.click(); var f = D.getElementById("nfeed"); if (f && f.scrollIntoView) f.scrollIntoView({ behavior: "smooth", block: "start" }); } return; }
    location.hash = to;
  }
  async function act(a, btn, card) {
    var o = REG[card.dataset.k]; if (!o) return;
    var s = o.sym;
    if (a === "go") return go(btn.dataset.to, o);
    if (a === "ask") { if (o.ask) o.ask(btn.dataset.p); return; }
    if (a === "sym") { location.hash = "#/phan-tich?s=" + btn.dataset.s; return; }
    if (a === "chart") { location.hash = "#/tong-quan?s=" + (o.kind === "news" ? IDX[o.ex] || "VNINDEX" : s); return; }
    if (a === "ev") return go("ev", o);
    if (a === "nwatch") { var wb = D.querySelector('#nf [data-pt="watch"]'); if (wb) { wb.click(); var nf = D.getElementById("nf"); if (nf && nf.scrollIntoView) nf.scrollIntoView({ behavior: "smooth", block: "start" }); } else T("Mở bộ lọc “Tin theo mã theo dõi” ở đầu trang Tin tức", 1); return; }
    if (a === "wl") {
      try {
        if (!(await NhipDlg.confirm({ tone: "info", icon: "star", title: "Thêm vào Theo dõi?", subject: s, message: "Mã này sẽ được thêm vào danh sách Theo dõi của bạn.", okText: "Thêm", cancelText: "Để sau" }))) return;
        ST.watchlist = Array.from(new Set(ST.watchlist.concat([s]))); await saveWatch(); T("Đã thêm " + s + " vào Theo dõi"); redraw(o);
      } catch (e) { T(e.message || "Không thêm được", 1); }
      return;
    }
    if (a === "al") { if (o.kind === "news") { location.hash = "#/canh-bao"; return; } o.alOpen = !o.alOpen; redraw(o); return; }
    if (a === "alok") {
      var box = btn.closest(".aix-al"), ty = box.querySelector("[data-alt]").value, v = parseFloat(String(box.querySelector("[data-alv]").value).replace(",", "."));
      if (!(v > 0)) return T("Nhập ngưỡng lớn hơn 0", 1);
      o.alOpen = false; redraw(o);
      try { await W.alCreateLegacy({ sym: s, type: ty, val: v }); T("Đã tạo cảnh báo " + s + " (xem trong mục Cảnh báo)"); } catch (e) { T(e.message || "Không tạo được cảnh báo", 1); }
      return;
    }
    if (a === "save") {
      if (W.NHIPAIReports) { W.NHIPAIReports.add({ sym: s || "", mode: o.kind === "news" ? "tin-tuc" : "phan-tich", house: exKey(o.ex), title: o.kind === "news" ? "Tóm tắt tin " + (XN[exKey(o.ex)] || "") + " " + hm(o.at).slice(0, 5) : o.report6 ? "Báo cáo 6 phần " + s : "Phân tích " + s, text: o.answer, via: o.name || "" }); T("Đã lưu vào Báo cáo đã lưu (trang Phân tích AI)"); }
      else T("Chưa lưu được báo cáo", 1);
      return;
    }
    if (a === "copy") { try { var k = await W.NHIPAIExport.copy(o.answer); T(k === "rich" ? "Đã sao chép — dán vào đâu cũng giữ nguyên mẫu" : "Đã sao chép (văn bản thường)"); } catch (e) { T("Không sao chép được", 1); } return; }
    if (a === "pdf") {
      var old = btn.textContent; btn.disabled = true; btn.textContent = "⏳ Đang tạo PDF…";
      try { var r = await W.NHIPAIExport.pdf(o.answer, { q: o.q, mode: o.kind === "news" ? "Tin tức · " + (XN[exKey(o.ex)] || "") : (o.report6 ? "Báo cáo 6 phần" : "Phân tích") + (s ? " · " + s : ""), name: o.name, at: o.at }); T("Đã tạo " + r.name + " (" + r.pages + " trang)"); } catch (e) { T("Không tạo được PDF: " + (e.message || e), 1); }
      btn.disabled = false; btn.textContent = old;
    }
  }
  function redraw(o) { var c = D.querySelector('.nhc[data-k="' + o.id + '"]'); if (!c) return; var host = c.parentNode, hs = c.scrollTop; var t = D.createElement("div"); t.innerHTML = html(o); var n = t.firstChild; host.replaceChild(n, c); if (typeof o.onRedraw === "function") o.onRedraw(o); }
  D.addEventListener("click", function (e) {
    var b = e.target && e.target.closest && e.target.closest(".nhc [data-nc]"); if (!b) return;
    var card = b.closest(".nhc"), a = b.dataset.nc;
    if (a === "stop") { var st = W.NHIPAICard._stop; if (st) st(); return; }
    e.preventDefault(); act(a, b, card);
  });

  /* ---------- Khung chat: Dừng · Đính kèm · Micro (dùng lại NHIPAICompose của khung Nhịp AI) ---------- */
  function composer(o) {
    o = o || {};
    return '<div class="aix nhc-comp"><form class="aix-f" ' + (o.formId ? 'id="' + o.formId + '"' : "") + '><div class="aix-box"><div class="aix-att" hidden></div><textarea class="aix-q" ' + (o.taId ? 'id="' + o.taId + '"' : "") + ' rows="' + (o.rows || 2) + '" autocomplete="off" enterkeyhint="send" placeholder="' + E(o.placeholder || "Nhập câu hỏi…") + '"></textarea>' +
      '<div class="aix-tools"><button type="button" class="aix-tb aix-plus" aria-label="Đính kèm ảnh hoặc tài liệu" aria-haspopup="true" aria-expanded="false"></button><span class="aix-lt" role="status" aria-live="polite"></span><button type="button" class="aix-tb aix-mic" aria-label="Nói để nhập" aria-pressed="false"></button>' +
      '<button class="aix-send" type="submit" aria-label="Gửi"><svg class="i-go" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg><svg class="i-stop" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2.5"/></svg></button></div>' +
      '<div class="aix-menu" hidden><button type="button" data-pick="cam">📷 <span>Chụp ảnh</span></button><button type="button" data-pick="img">🖼 <span>Chọn ảnh</span></button><button type="button" data-pick="doc">📄 <span>Tài liệu <small>PDF, Word, TXT, CSV…</small></span></button></div></div>' +
      '<input class="aix-in-img" type="file" accept="image/*" multiple hidden><input class="aix-in-cam" type="file" accept="image/*" capture="environment" hidden><input class="aix-in-doc" type="file" accept=".pdf,.docx,.txt,.md,.csv,.tsv,.json,.xml,.html,.htm,.log,text/*,application/pdf" multiple hidden></form></div>';
  }
  function attach(root) {
    var I = { root: root };
    try { if (W.NHIPAICompose) { W.NHIPAICompose.attach(I); var p = root.querySelector(".aix-plus"); if (p && !p.innerHTML) p.innerHTML = W.NHIPAICompose.ICON.plus; } } catch (e) { }
    I.setBusy = function (on) { var f = root.querySelector(".aix-f"), sb = root.querySelector(".aix-send"); if (!f || !sb) return; f.classList.toggle("busy", !!on); sb.setAttribute("aria-label", on ? "Dừng trả lời" : "Gửi"); sb.title = on ? "Dừng" : "Gửi"; };
    return I;
  }
  /* gom tệp đính kèm theo đúng khuôn của /api/ai */
  function files(I) {
    var a = I && I.getAtt ? I.getAtt() : [];
    return { images: a.filter(function (x) { return x.k === "img"; }).map(function (x) { return { mime: x.mime, data: x.data }; }), docs: a.filter(function (x) { return x.k === "doc"; }).map(function (x) { return { name: x.name, text: x.text }; }), names: a.map(function (x) { return x.name; }) };
  }

  W.NHIPAICard = { version: "1.0", html: html, wait: wait, composer: composer, attach: attach, files: files, pretty: pretty, followUps: followUps, uid: uid, exKey: exKey, _reg: REG, _stop: null };
})(window);
