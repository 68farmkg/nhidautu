/* NHIP · Phân tích (route #/phan-tich) — v29.
   Dùng chung giao diện biểu đồ gọn của mục Biểu đồ (khung giờ, loại biểu đồ, chỉ báo có tham số, so sánh %, công cụ vẽ, thang giá, phóng to,
   lưu ảnh, tự cập nhật…) và giữ nguyên phần phân tích: bằng chứng xác nhận, bối cảnh ngành/VN-Index, AI, vùng giá, lưới chỉ báo.
   Dữ liệu vẫn là /api/analysis (VNDirect đã làm sạch) — không thêm dữ liệu giả. Lỗi module → app.js tự quay về bản cũ (vAnalysis). */
(function () {
  "use strict";
  var E = function (s) { return esc(s == null ? "" : s); };
  /* Huy hiệu bộ chấm điểm MỚI (RSIx + Fade2) theo sàn — thay cho huy hiệu của bộ chấm điểm cũ đã bị loại */
  function valChip(ex) { try { var b = window.NHIPVScore && window.NHIPVScore.badge(ex && ex.ex ? ex.ex : ex); if (!b) return ""; return '<span class="sg ' + (b.status === "validated" ? "upb" : "mid") + '" title="' + E(b.title) + '">Bộ chấm điểm: ' + E(b.label) + "</span> "; } catch (e) { return ""; } }
  var TABS = [["ev", "Bằng chứng", "#an-p-ev"], ["ai", "AI", "#an-p-ai"], ["wl", "Theo dõi", "#p-wl"], ["nw", "Tin tức", "#p-nw"], ["lv", "Vùng giá", "#an-p-lv"]];

  /* V2.82 — chip gợi ý dưới AI: đúng mã, đúng sàn (sàn lấy từ danh bạ, chưa rõ sàn thì không ghi sàn) */
  var sugEl = null, sugSym = "";
  function sugList(sym) {
    var ex = ""; try { var r = window.NHIPExchange && window.NHIPExchange.resolve(sym); ex = r && r.known ? ({ HOSE: "HOSE", HNX: "HNX", UPCOM: "UPCoM" })[String(r.ex).toUpperCase()] || "" : ""; } catch (e) { ex = ""; }
    var t = sym + (ex ? " (" + ex + ")" : "");
    return ["Điểm tham gia của " + t + " đang nói gì và độ vững bằng chứng của sàn ra sao?", "Điểm cộng cơ bản và tin của " + t + " chấm theo ngưỡng nào, có cờ đỏ không?", "Bài tin nào được tính vào điểm cộng tin của " + sym + "?", "Nếu nền = 0 thì điểm cộng của " + sym + " có áp dụng không?"];
  }
  function paintSug(S) {
    var b = $("#an-sug"); if (!b || !S || !S.sym || (b === sugEl && sugSym === S.sym)) return;
    sugEl = b; sugSym = S.sym;
    b.innerHTML = '<span class="muted">Gợi ý hỏi:</span>' + sugList(S.sym).map(function (t) { return '<button type="button" class="btn pale" data-q="' + E(t) + '">' + E(t) + "</button>"; }).join("");
  }
  function sideHTML() {
    return '<aside class="cp-side panel an-sidex"><div class="tf tabs" id="an-tabs">' + TABS.map(function (t, i) { return '<button type="button" data-t="' + t[0] + '" class="' + (i ? "" : "on") + '">' + t[1] + "</button>"; }).join("") + '</div>' +
      '<div id="an-p-ev" class="pane"><div id="an-ev"><p class="muted">Đang tải bằng chứng đã kiểm chứng…</p></div></div>' +
      '<div id="an-p-ai" class="pane an-aipane" hidden><div class="eyebrow">TRỢ LÝ PHÂN TÍCH · NHỊP AI</div><p class="source-note">AI nhận dữ liệu nến và chỉ báo thực từ máy chủ; không tự tạo giá, thanh khoản, tin tức hay xác suất. Phân tích cơ bản chỉ được đưa ra khi có nguồn xác minh: AI tự nạp chỉ số cơ bản rồi tin của mã (đúng sàn) trước khi trả lời.</p>' +
      '<div class="an-acts"><button class="btn primary" type="button" id="an-run">✦ Phân tích dữ liệu thực</button><button class="btn pale" type="button" id="an-report">Báo cáo 6 phần</button><label class="analysis-news"><input id="an-news" type="checkbox"> Đối chiếu tin RSS CafeF nếu nguồn truy cập được</label></div>' +
      '<div id="an-ai-result" class="analysis-ai-result"><p class="muted">Chọn mã và nhấn phân tích để tạo nhận định từ dữ liệu hiện có.</p></div>' +
      '<div class="an-dock"><div id="an-sug" class="an-sug"></div>' +
      (window.NHIPAICard ? '<div id="an-comp">' + NHIPAICard.composer({ formId: "an-ai-form", taId: "an-question", rows: 2, placeholder: "Hỏi AI về mã này — ví dụ: xu hướng, hỗ trợ/kháng cự, kịch bản tăng/cơ sở/giảm…" }) + "</div>" : '<form id="an-ai-form"><textarea id="an-question" rows="3"></textarea></form>') + '</div></div>' +
      '<div id="p-wl" class="pane" hidden><p class="muted">Đang tải…</p></div>' +
      '<div id="p-nw" class="pane newslist" hidden><p class="muted">Đang tải tin…</p></div>' +
      '<div id="an-p-lv" class="pane" hidden><div class="eyebrow">VÙNG GIÁ THAM KHẢO</div><div id="an-levels" class="level-grid"><p class="muted">Đang tính từ 20 nến gần nhất…</p></div><p class="source-note">Vùng giá là mức cao/thấp quan sát được trong dữ liệu lịch sử, không phải dự báo hay khuyến nghị.</p></div></aside>';
  }
  /* V2.74: khối "CHỈ BÁO TỪ NẾN HIỆN TẠI" (SMA/RSI/MACD/Bollinger/ATR kèm nhãn Quá mua…) chưa qua kiểm chứng → tắt. Đặt true để hiện lại. */
  var SHOW_RAW_INDICATORS = false;
  var BELOW = SHOW_RAW_INDICATORS ? '<div class="sec-label an-sec">CHỈ BÁO TỪ NẾN HIỆN TẠI</div><section class="an-ind panel" id="an-stats"><p class="muted">Đang tính chỉ báo…</p></section>' : '';

  function showTab(t) {
    $$("#an-tabs button").forEach(function (b) { b.classList.toggle("on", b.dataset.t === t); });
    TABS.forEach(function (x) { var el = $(x[2]); if (el) el.hidden = x[0] !== t; });
  }

  /* Chỉ báo từ nến hiện tại: gom nhóm, mỗi chỉ báo kèm trạng thái so với giá hiện tại; RSI và Bollinger có thanh đo. Chỉ tính từ summary thật của nguồn. */
  function stats(S, d) {
    var m = d.summary, sym = S.sym, el = $("#an-stats");
    var P = m.latestClose, nul = function (x) { return x == null || isNaN(x); };
    var chip = function (k, t) { return '<span class="sg ' + k + '">' + t + "</span>"; };
    var row = function (label, val, extra) { return '<div class="an-r"><span class="an-l">' + label + '</span><b class="an-v">' + (nul(val) ? "—" : typeof val === "string" ? val : px(sym, val)) + "</b>" + (extra || "") + "</div>"; };
    var vsP = function (v) { if (nul(v) || nul(P) || !v) return ""; var x = (P / v - 1) * 100; return chip(x >= 0 ? "upb" : "dnb", (x >= 0 ? "▲ " : "▼ ") + (x >= 0 ? "+" : "") + num(x, 2) + "%"); };
    var mas = [m.sma20, m.sma50, m.ema12, m.ema26], have = mas.filter(function (v) { return !nul(v); }), above = have.filter(function (v) { return P > v; }).length;
    var r = m.rsi14, rK = nul(r) ? ["mid", "—"] : r > 70 ? ["dnb", "Quá mua"] : r < 30 ? ["upb", "Quá bán"] : r >= 50 ? ["upb", "Động lượng tốt"] : ["mid", "Trung tính / yếu"];
    var macdOk = !nul(m.macd) && !nul(m.macdSignal), macdUp = macdOk && m.macd > m.macdSignal;
    var rng = !nul(m.bbUpper) && !nul(m.bbLower) && m.bbUpper > m.bbLower ? m.bbUpper - m.bbLower : null, pb = rng ? (P - m.bbLower) / rng : null;
    var bK = pb == null ? ["mid", "—"] : pb > 1 ? ["dnb", "Vượt dải trên"] : pb < 0 ? ["upb", "Thủng dải dưới"] : pb >= 0.8 ? ["mid", "Gần dải trên"] : pb <= 0.2 ? ["mid", "Gần dải dưới"] : ["mid", "Giữa dải"];
    var clamp = function (x) { return Math.max(0, Math.min(100, x)); };
    var sum = '<div class="an-sum">' +
      (have.length ? chip(above / have.length >= 0.75 ? "upb" : above / have.length <= 0.25 ? "dnb" : "mid", "Giá trên " + above + "/" + have.length + " đường MA") : "") +
      (nul(r) ? "" : chip(rK[0], "RSI " + num(r, 0) + " · " + rK[1])) + (macdOk ? chip(macdUp ? "upb" : "dnb", macdUp ? "MACD trên Signal" : "MACD dưới Signal") : "") + (pb == null ? "" : chip(bK[0], bK[1])) + "</div>";
    var g1 = '<div class="an-g"><div class="an-gh">Xu hướng &amp; giá</div>' + row("SMA 20", m.sma20, vsP(m.sma20)) + row("SMA 50", m.sma50, vsP(m.sma50)) + row("EMA 12", m.ema12, vsP(m.ema12)) + row("EMA 26", m.ema26, vsP(m.ema26)) + row("VWAP phiên", m.vwap, vsP(m.vwap)) + "</div>";
    var g2 = '<div class="an-g"><div class="an-gh">Động lượng</div>' + row("RSI 14", nul(r) ? null : num(r, 1), chip(rK[0], rK[1])) +
      (nul(r) ? "" : '<div class="an-gauge an-rsi"><i style="left:' + clamp(r) + '%"></i></div><div class="an-gl"><span>30</span><span>70</span></div>') +
      row("MACD", nul(m.macd) ? null : num(m.macd, 0), macdOk ? chip(macdUp ? "upb" : "dnb", macdUp ? "Trên Signal" : "Dưới Signal") : "") + (nul(m.macdSignal) ? "" : row("Signal", num(m.macdSignal, 0))) + "</div>";
    var g3 = '<div class="an-g"><div class="an-gh">Biến động</div>' + row("Bollinger trên", m.bbUpper) + row("Bollinger dưới", m.bbLower) +
      (pb == null ? "" : '<div class="an-gauge an-bb"><i style="left:' + clamp(pb * 100) + '%"></i></div><div class="an-gl"><span>Dải dưới</span><span>%B ' + num(pb * 100, 0) + "%</span><span>Dải trên</span></div>") +
      row("ATR 14", m.atr14, nul(m.atr14) || !P ? "" : '<span class="an-sub">' + num(m.atr14 / P * 100, 2) + "% giá</span>") + "</div>";
    if (el) el.innerHTML = sum + '<div class="an-gs">' + g1 + g2 + g3 + "</div>";
    var lv = $("#an-levels");
    if (lv) {
      lv.classList.add("lv-two");
      var dist = function (v) { if (nul(v) || nul(P) || !P) return ""; var x = (v / P - 1) * 100; return '<em>' + (x >= 0 ? "+" : "") + num(x, 2) + "% so với giá</em>"; };
      lv.innerHTML = '<article class="lv-c lv-s"><span>Hỗ trợ</span><b>' + px(sym, m.support20) + "</b><small>20 nến gần nhất</small>" + dist(m.support20) + '</article><article class="lv-c lv-r"><span>Kháng cự</span><b>' + px(sym, m.resistance20) + "</b><small>20 nến gần nhất</small>" + dist(m.resistance20) + "</article>";
    }
  }

  /* V2.74: tab Bằng chứng chỉ còn bảng đã kiểm chứng theo sàn (RSIx + Fade2) và bộ chấm điểm mới. Các khối cũ
     (tổng hợp chỉ báo, điểm rủi ro, điểm xếp hạng, cấu trúc giá, bối cảnh rổ, đa khung, kiểm thử beta…) đã được gỡ. */
  function evidence(S, d, ok) {
    var ev = $("#an-ev"); if (!ev) return;
    if (!window.NHIPEvidenceUI || !window.NHIPVScore) { ev.innerHTML = '<p class="muted">Thiếu mô-đun bằng chứng (nhip-vscore.js / nhip-evidence-ui.js).</p>'; return; }
    window.NHIPEvidenceUI.mount(ev, S, d);
  }

  async function vAnalysisPro() {
    var ok = mine();
    if (typeof window.vCharts !== "function") throw new Error("thiếu module biểu đồ");
    await window.vCharts({
      mode: "analysis", side: sideHTML(), below: BELOW,
      onReady: function (S) {
        $$("#an-tabs button").forEach(function (b) { b.onclick = function () { showTab(b.dataset.t); }; });
        paintSug(S);
        var sg = $("#an-sug"); if (sg) sg.onclick = function (ev) { var b = ev.target && ev.target.closest && ev.target.closest("button[data-q]"); if (!b) return; $("#an-question").value = b.getAttribute("data-q"); $("#an-ai-form").requestSubmit(); };
        /* V2.94 — AI: nạp lại ĐÚNG khối Bằng chứng của tab Bằng chứng, trả lời bằng thẻ chung (nhãn sàn, bảng, liên kết, hỏi tiếp, nút hành động); khung chat có Dừng · Đính kèm · Micro. */
        var AI = { busy: false, ctl: null, mode: "ask", I: window.NHIPAICard ? NHIPAICard.attach($("#an-comp") || document) : null, last: null };
        function aiBusy(on) { AI.busy = on; if (AI.I && AI.I.setBusy) AI.I.setBusy(on); ["#an-run", "#an-report"].forEach(function (k) { var b = $(k); if (b) b.disabled = on; }); if (window.NHIPAICard) NHIPAICard._stop = on ? aiStop : null; }
        function aiStop() { if (AI.ctl) { try { AI.ctl.abort(); } catch (e) { } } }
        /* điểm/nhóm điểm/nến đóng đúng như tab Bằng chứng đang hiển thị (cùng NHIPAIEvidence + nến của tab) để máy chủ đối chiếu với khối AI nhận */
        function evSnap(sym) {
          try {
            var u = window.NHIPEvidenceUI, st = u && u._state && u._state(); if (!st || String(st.sym).toUpperCase() !== sym || !st.candles || !window.NHIPAIEvidence) return null;
            var c = NHIPAIEvidence.context(sym, st.candles, { res: S.res }); return c && c.meta && c.meta.score != null ? { score: c.meta.score, band: c.meta.band, closed: c.meta.closed } : null;
          } catch (e) { return null; }
        }
        async function aiRun(report) {
          var sym = S.sym, resolution = S.res, I = AI.I, ta = $("#an-question"), box = $("#an-ai-result"), nb = $("#an-news");
          if (I && I.pendingAtt && I.pendingAtt()) return toast("Đang đọc tệp đính kèm, vui lòng đợi…", 1);
          var q = ta.value.trim(), fl = window.NHIPAICard ? NHIPAICard.files(I) : { images: [], docs: [], names: [] };
          if (!q && !report && (fl.images.length || fl.docs.length)) q = fl.images.length ? "Hãy phân tích ảnh đính kèm cùng dữ liệu của mã này." : "Hãy tóm tắt và phân tích tài liệu đính kèm cùng dữ liệu của mã này.";
          var ctl = AI.ctl = new AbortController(); aiBusy(true); AI.last = { report: report };
          box.innerHTML = NHIPAICard.wait(report ? "Nhịp AI đang nạp Bằng chứng và lập báo cáo 6 phần…" : "Nhịp AI đang nạp dữ liệu thực và phân tích…");
          try {
            var out = await api("/api/analysis/ai", { method: "POST", signal: ctl.signal, body: { symbol: sym, resolution: resolution, question: report ? undefined : (q || undefined), report6: report ? 1 : undefined, extra: report && q ? q : undefined, withNews: !!(nb && nb.checked), evClient: evSnap(sym), reqId: NHIPAICard.uid(), images: fl.images, docs: fl.docs } });
            if (!ok() || S.sym !== sym) return;
            var x = out.exchange || null, chips = "";
            if (x && x.ex) {
              if (x.gate && x.gate.status !== "unknown") chips += '<span class="nhc-chip ' + (x.gate.status === "ok" ? "ok" : x.gate.status === "blocked" ? "bad" : "") + '" title="Cổng thanh khoản theo chuẩn của sàn (ngưỡng khởi điểm, chưa hiệu chỉnh)">Thanh khoản: ' + E(x.gate.label) + "</span>";
              if (x.regime) chips += '<span class="nhc-chip" title="Trạng thái chỉ số của sàn, tính từ nến ngày">' + E(x.regime.name) + ": " + E(x.regime.state) + "</span>";
              chips += valChip(x.ex);
            } else if (x) chips += '<span class="nhc-chip bad" title="Không có sàn trong danh bạ mã nên không áp quy tắc riêng của sàn">Chưa rõ sàn</span>';
            var card = { kind: "analysis", report6: !!out.report6, sym: sym, ex: x && x.ex ? x.ex : "", answer: out.answer, name: out.name || out.provider, model: out.model, dataAt: dt(out.dataFetchedAt), source: out.source, at: Date.now(), used: out.used, warnings: out.warnings, evCheck: out.evidenceCheck, evLines: out.evidenceLines, chips: chips, note: out.note, q: q,
              ask: function (t) { ta.value = t; ta.dispatchEvent(new Event("input", { bubbles: true })); AI.mode = "ask"; $("#an-ai-form").requestSubmit(); } };
            box.innerHTML = NHIPAICard.html(card) + (window.NHIPQ ? NHIPQ.aiExtra(out) : "");
            if (I && I.clearAtt) I.clearAtt(); ta.value = ""; ta.dispatchEvent(new Event("input", { bubbles: true }));
            logH("ai", (report ? "Báo cáo 6 phần " : "Phân tích ") + sym, out.answer || "");
          } catch (e) {
            if (!ok() || S.sym !== sym) return;
            if (e && (e.name === "AbortError" || (e.data && e.data.aborted))) { box.innerHTML = '<div class="nhc-wait"><span>⏹ Đã dừng theo yêu cầu của bạn.</span><button type="button" class="aix-stop" id="an-retry">↻ Hỏi lại</button></div>'; var rt = $("#an-retry"); if (rt) rt.onclick = function () { aiRun(report); }; }
            else box.innerHTML = err(e, "Không thể phân tích AI");
          } finally { aiBusy(false); AI.ctl = null; }
        }
        $("#an-run").onclick = function () { AI.mode = "ask"; $("#an-ai-form").requestSubmit(); };
        $("#an-report").onclick = function () { AI.mode = "report"; $("#an-ai-form").requestSubmit(); };
        $("#an-ai-form").onsubmit = function (e) { e.preventDefault(); if (AI.busy) { aiStop(); return; } var rep = AI.mode === "report"; AI.mode = "ask"; aiRun(rep); };
      },
      onData: function (S, d, isTick) {
        try { paintSug(S); } catch (x) { }
        try { stats(S, d); } catch (x) { var st = $("#an-stats"); if (st) st.innerHTML = '<p class="muted">Không thể tính một số chỉ báo: ' + E(x && x.message || "lỗi dữ liệu") + '</p>'; }
        /* Luôn dựng bằng chứng cơ bản từ nến đã có; lỗi ở mô-đun phụ không được để spinner treo vô thời hạn. */
        try { evidence(S, d, ok); }
        catch (x) {
          var ev = $("#an-ev");
          if (ev) {
            var sm = d && d.summary || {}, candles = d && Array.isArray(d.candles) ? d.candles : [];
            var close = sm.latestClose;
            ev.innerHTML = '<div class="stats mt3"><div><small>Số nến</small><b>' + candles.length + '</b></div><div><small>Giá đóng cửa mới nhất</small><b>' + (close == null ? '—' : E(typeof px === "function" ? px(S.sym, close) : close)) + '</b></div></div><p class="muted">Đã tải dữ liệu giá nhưng phần bằng chứng nâng cao gặp lỗi: ' + E(x && x.message || "lỗi tính toán") + '. Hãy tải lại biểu đồ.</p>';
          }
        }
      },
      onError: function () {
        var s = $("#an-stats"); if (s) s.innerHTML = '<p class="muted">Chưa có dữ liệu để tính chỉ báo. Hãy thử tải lại biểu đồ.</p>';
        var ev = $("#an-ev"); if (ev) ev.innerHTML = '<p class="muted">Chưa nhận được dữ liệu nến nên chưa thể tạo bằng chứng. Hãy kiểm tra kết nối nguồn dữ liệu rồi thử lại.</p>';
      },
      onAsk: function () { showTab("ai"); var p = $("#an-p-ai"); if (p && p.scrollIntoView) p.scrollIntoView({ behavior: "smooth", block: "start" }); var q = $("#an-question"); if (q) q.focus({ preventScroll: true }); }
    });
  }
  window.vAnalysisPro = vAnalysisPro;
})();
