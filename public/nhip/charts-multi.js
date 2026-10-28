/* NHIP · Đa khung thời gian (v1.67)
   Xem CÙNG MỘT mã ở nhiều khung nến trên một bảng để so sánh từ khung lớn xuống khung nhỏ (top-down).
   - PC / máy tính bảng: lưới 2×2 (hoặc 1 lớn + 2 nhỏ khi có 3 khung); bảng tổng hợp xu hướng nằm bên phải hoặc bên dưới.
   - Điện thoại: MỖI LẦN MỘT biểu đồ (màn hình nhỏ), chuyển bằng thanh tab; bảng tổng hợp nằm ngay dưới biểu đồ.
   - Rê/chạm vào một biểu đồ → tiêu đề các biểu đồ còn lại hiện nến CHỨA cùng thời điểm đó (đồng bộ mốc thời gian).
   - Bảng xu hướng dùng lại NHIPMultiTimeframe.analyze (cùng luật với tab Phân tích) → không có hai cách chấm khác nhau.
   Mọi số liệu đến từ nến thật của /api/analysis; khung thiếu nến thì ghi rõ "Thiếu nến", không ước tính. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./charts-core.js"), root);
  else root.NHIPMultiChart = factory(root.NHIPChartsCore, root);
})(typeof self !== "undefined" ? self : this, function (C, W) {
  "use strict";

  /* ---------- Hằng & hàm thuần (kiểm thử được trong Node) ---------- */
  var KEY = "nhip.mtf.v1";
  var DUR = { "1": 1, "5": 5, "15": 15, "30": 30, "60": 60, "120": 120, "180": 180, "240": 240, "D": 1440, "W": 7200, "M": 30000, "3M": 90000, "6M": 180000, "1Y": 365000, "3Y": 1095000, "5Y": 1825000 };
  var PRESETS = [
    { id: "td", label: "Top-down", frames: ["M", "W", "D", "60"], hint: "Tháng → Tuần → Ngày → 1 giờ" },
    { id: "mid", label: "Trung hạn", frames: ["W", "D", "60"], hint: "Tuần → Ngày → 1 giờ" },
    { id: "long", label: "Dài hạn", frames: ["1Y", "3M", "M", "W"], hint: "1 năm → 3 tháng → Tháng → Tuần" },
    { id: "short", label: "Ngắn hạn", frames: ["D", "60", "15", "5"], hint: "Ngày → 1 giờ → 15 phút → 5 phút" }
  ];
  var SHORT_STATE = { "Tăng đồng thuận": "Tăng", "Giảm đồng thuận": "Giảm", "Hồi phục / mâu thuẫn": "Hồi phục", "Điều chỉnh / mâu thuẫn": "Điều chỉnh", "Hỗn hợp": "Hỗn hợp" };
  var rank = function (res) { return DUR[String(res)] || 0; };
  var label = function (res) { var t = C.TIMEFRAMES.filter(function (x) { return x[0] === String(res); })[0]; return t ? t[1] : String(res); };
  var shortLabel = function (res) { var t = C.TIMEFRAMES.filter(function (x) { return x[0] === String(res); })[0]; return t ? t[3] : String(res); };

  /* 2–4 khung hợp lệ, không trùng; sai/thiếu → mặc định Top-down */
  function sanitizeFrames(arr) {
    var out = [];
    (Array.isArray(arr) ? arr : []).forEach(function (r) { r = String(r); if (C.validRes(r) && out.indexOf(r) < 0 && out.length < 4) out.push(r); });
    return out.length >= 2 ? out : PRESETS[0].frames.slice();
  }
  function presetOf(frames) {
    var p = PRESETS.filter(function (x) { return x.frames.length === frames.length && x.frames.every(function (f, i) { return f === frames[i]; }); })[0];
    return p ? p.id : "custom";
  }
  /* nến cuối cùng có time <= tsSec (nến "chứa" thời điểm đó); -1 nếu thời điểm trước nến đầu */
  function lastIndexLE(candles, tsSec) {
    var lo = 0, hi = (candles ? candles.length : 0) - 1, ans = -1;
    while (lo <= hi) { var m = (lo + hi) >> 1; if (candles[m].time <= tsSec) { ans = m; lo = m + 1; } else hi = m - 1; }
    return ans;
  }
  /* Kết luận chung: chỉ khi số khung nghiêng một phía NHIỀU HƠN phía kia và ≥ 2; khung lớn nhất có dữ liệu được nêu riêng (top-down). */
  function overall(rows) {
    var valid = rows.filter(function (r) { return r.result && r.result.ready; });
    var up = valid.filter(function (r) { return r.result.state === "Tăng đồng thuận"; }).length;
    var down = valid.filter(function (r) { return r.result.state === "Giảm đồng thuận"; }).length;
    var text = valid.length < 2 ? "Chưa đủ khung để kết luận" : (up > down && up >= 2) ? "Nghiêng tăng đa khung" : (down > up && down >= 2) ? "Nghiêng giảm đa khung" : "Tín hiệu hỗn hợp";
    var top = null; valid.forEach(function (r) { if (!top || rank(r.res) > rank(top.res)) top = r; });
    return { text: text, valid: valid.length, total: rows.length, up: up, down: down, top: top ? { res: top.res, state: top.result.state } : null };
  }

  var api = { PRESETS: PRESETS, DUR: DUR, rank: rank, sanitizeFrames: sanitizeFrames, presetOf: presetOf, lastIndexLE: lastIndexLE, overall: overall, SHORT_STATE: SHORT_STATE };
  if (typeof document === "undefined") return api;

  /* ---------- Giao diện ---------- */
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var nf = function (v, d) { return v == null || !isFinite(v) ? "—" : Number(v).toLocaleString("vi-VN", { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); };
  var pct = function (v) { return v == null || !isFinite(v) ? "—" : (v > 0 ? "+" : "") + v.toFixed(2).replace(".", ",") + "%"; };
  function fmtDate(sec, res) {
    if (C.isLong(res)) return C.periodLabel(sec, res);
    var o = { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" };
    if (C.isIntraday(res)) { o.hour = "2-digit"; o.minute = "2-digit"; delete o.year; }
    if (res === "M") delete o.day;
    try { return new Date(sec * 1000).toLocaleString("vi-VN", o); } catch (e) { return String(sec); }
  }
  function loadStore() { try { var j = JSON.parse(localStorage.getItem(KEY) || "null"); return j && j.frames ? sanitizeFrames(j.frames) : PRESETS[0].frames.slice(); } catch (e) { return PRESETS[0].frames.slice(); } }
  function saveStore(frames) { try { localStorage.setItem(KEY, JSON.stringify({ frames: frames })); } catch (e) { } }

  /* opts: { symbol, api(url), colors(), isDark(), grid(), onOpen(res), onExit(), onFull() } */
  function mount(host, opts) {
    var st = {
      sym: opts.symbol, frames: loadStore(), active: 0, mode: "d", cache: {}, charts: [], gen: 0, dead: false,
      ro: null, timer: null, raf: 0, hoverTs: null, sc: 1, solo: null
    };
    var uid = "mc" + Math.random().toString(36).slice(2, 7);

    function modeOf() { var w = host.clientWidth || innerWidth; return w < 720 ? "m" : w < 1000 ? "d" : "w"; }
    function candlesOf(res) { var c = st.cache[res]; return c && c.d && c.d.candles ? c.d.candles : null; }
    function fp(v) { return v == null ? "—" : C.isIndex(st.sym) ? nf(v, 2) : nf(Math.round(v * st.sc), 0); }
    var toK = function (c) { var o = { timestamp: c.time * 1000, open: c.open * st.sc, high: c.high * st.sc, low: c.low * st.sc, close: c.close * st.sc }; if (c.volume != null) o.volume = c.volume; return o; };

    /* ----- Dữ liệu ----- */
    function fetchFrame(res, force) {
      var key = res, c = st.cache[key];
      if (!force && c && c.d && Date.now() - c.at < 45000) return Promise.resolve(c.d);
      return opts.api("/api/analysis/" + encodeURIComponent(st.sym) + "?resolution=" + res + "&days=" + C.daysFor(res)).then(function (d) {
        if (!d || !d.candles || !d.candles.length) throw new Error("Nguồn không có nến cho khung này");
        st.cache[key] = { d: d, at: Date.now(), err: null }; return d;
      });
    }
    function loadAll(force) {
      var gen = ++st.gen, sym = st.sym;
      st.frames.forEach(function (res, i) {
        var had = candlesOf(res);
        if (!had) { st.cache[res] = { d: null, at: 0, err: null, loading: true }; paintPanel(i); }
        fetchFrame(res, force).then(function (d) {
          if (st.dead || gen !== st.gen || sym !== st.sym) return;
          var wasEmpty = !had;
          st.frames.forEach(function (r, j) { if (r === res) { if (wasEmpty || !st.charts[j]) paintPanel(j); else liveUpdate(j, d); } });
          renderSummary(); renderTabs();
        }).catch(function (e) {
          if (st.dead || gen !== st.gen || sym !== st.sym) return;
          if (!had) { st.cache[res] = { d: null, at: 0, err: (e && e.message) || "Lỗi dữ liệu" }; st.frames.forEach(function (r, j) { if (r === res) paintPanel(j); }); renderSummary(); renderTabs(); }
        });
      });
    }

    /* ----- Khung HTML ----- */
    function soloIcon(on) {
      return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        (on ? '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>' : '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>') + "</svg>";
    }
    function build() {
      st.mode = modeOf();
      if (st.solo != null && st.solo >= st.frames.length) st.solo = null;
      var pid = presetOf(st.frames), n = st.frames.length;
      host.innerHTML = '<div class="mc is-' + st.mode + '" id="' + uid + '">' +
        '<div class="mc-bar"><div class="mc-presets tf" role="group" aria-label="Bộ khung có sẵn">' +
        PRESETS.map(function (p) { return '<button type="button" data-preset="' + p.id + '" title="' + esc(p.hint) + '" class="' + (p.id === pid ? "on" : "") + '">' + esc(p.label) + "</button>"; }).join("") +
        (pid === "custom" ? '<button type="button" class="on" disabled>Tùy chọn</button>' : "") + '</div>' +
        '<div class="mc-acts"><button type="button" class="cx-btn cx-ico mc-full" aria-label="Phóng to biểu đồ" title="Phóng to / thu nhỏ">⛶</button><button type="button" class="cx-btn mc-exit" title="Quay lại biểu đồ một khung">✕ Thoát</button></div></div>' +
        '<div class="mc-tabs tf" id="' + uid + '-tabs" role="tablist" aria-label="Chọn khung đang xem"></div>' +
        '<div class="mc-main"><div class="mc-grid" data-n="' + n + '">' +
        st.frames.map(function (res, i) {
          return '<section class="mc-p" data-i="' + i + '" id="' + uid + '-p' + i + '" role="tabpanel"><header class="mc-ph">' +
            '<select class="mc-sel" data-i="' + i + '" aria-label="Khung thời gian của biểu đồ ' + (i + 1) + '">' +
            C.TIMEFRAMES.map(function (t) { return '<option value="' + t[0] + '"' + (t[0] === res ? " selected" : "") + ">" + esc(t[1]) + "</option>"; }).join("") + "</select>" +
            '<span class="mc-px"></span><button type="button" class="mc-solo" data-i="' + i + '" aria-pressed="false" aria-label="Xem riêng khung này (ẩn các khung khác)" title="Xem riêng khung này — ẩn các khung khác">' + soloIcon(false) + '</button><button type="button" class="mc-open" data-i="' + i + '" aria-label="Mở khung này ở biểu đồ lớn" title="Mở ở biểu đồ lớn">⤢</button></header>' +
            '<div class="mc-ro" aria-live="off"></div>' +
            '<div class="mc-ch" id="' + uid + '-c' + i + '"><div class="placeholder">Đang tải…</div></div></section>';
        }).join("") + '</div><div class="mc-side"><div class="mc-trade" id="' + uid + '-trade"></div><aside class="mc-sum" id="' + uid + '-sum"></aside></div></div></div>';
      wire(); renderTabs(); renderSummary(); applyVisibility();
      if (opts.onBuild) { try { opts.onBuild(host.querySelector("#" + uid + "-trade"), st.mode); } catch (e) { console.warn("mc: onBuild", e); } }
      st.frames.forEach(function (_, i) { paintPanel(i); });
    }
    function wire() {
      var el = host.querySelector("#" + uid);
      el.addEventListener("click", function (e) {
        var b = e.target.closest("button, tr[data-i]"); if (!b) return;
        if (b.dataset.preset) { var p = PRESETS.filter(function (x) { return x.id === b.dataset.preset; })[0]; if (p) { st.frames = p.frames.slice(); st.active = 0; st.solo = null; saveStore(st.frames); disposeCharts(); build(); loadAll(false); } return; }
        if (b.classList.contains("mc-exit")) { opts.onExit && opts.onExit(); return; }
        if (b.classList.contains("mc-full")) { opts.onFull && opts.onFull(); return; }
        if (b.classList.contains("mc-solo")) { setSolo(+b.dataset.i); return; }
        if (b.classList.contains("mc-open")) { opts.onOpen && opts.onOpen(st.frames[+b.dataset.i]); return; }
        if (b.dataset.tab != null) { setActive(+b.dataset.tab); return; }
        if (b.tagName === "TR" && b.dataset.i != null) { focusPanel(+b.dataset.i); return; }
        if (b.classList.contains("mc-retry")) { loadAll(true); }
      });
      el.addEventListener("keydown", function (e) { var tr = e.target.closest && e.target.closest("tr[data-i]"); if (tr && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); focusPanel(+tr.dataset.i); } });
      el.addEventListener("change", function (e) {
        var s = e.target.closest(".mc-sel"); if (!s) return;
        var i = +s.dataset.i, v = s.value, j = st.frames.indexOf(v);
        if (j >= 0 && j !== i) { st.frames[j] = st.frames[i]; } /* đã có ở biểu đồ khác → hoán đổi, không trùng khung */
        st.frames[i] = v; saveStore(st.frames); disposeCharts(); build(); loadAll(false);
      });
    }
    function focusPanel(i) {
      if (st.mode === "m") { setActive(i); return; }
      if (st.solo != null) { setSolo(i, true); return; } /* đang xem riêng 1 khung → chạm dòng khác thì chuyển sang khung đó */
      var p = host.querySelector("#" + uid + "-p" + i); if (!p) return;
      try { p.scrollIntoView({ block: "nearest", behavior: "smooth" }); } catch (e) { }
      p.classList.remove("mc-flash"); void p.offsetWidth; p.classList.add("mc-flash");
    }
    function setActive(i) {
      if (i < 0 || i >= st.frames.length) return;
      st.active = i; applyVisibility(); renderTabs();
      var k = st.charts[i]; if (k) { try { k.resize(); } catch (e) { } } else paintPanel(i);
    }
    function applyVisibility() {
      var solo = st.mode !== "m" && st.solo != null && st.solo < st.frames.length ? st.solo : null;
      var grid = host.querySelector("#" + uid + " .mc-grid"); if (grid) grid.classList.toggle("is-solo", solo != null);
      st.frames.forEach(function (_, i) {
        var p = host.querySelector("#" + uid + "-p" + i); if (!p) return;
        p.hidden = st.mode === "m" ? i !== st.active : (solo != null && i !== solo);
        p.classList.toggle("is-solo", solo === i);
        var sb = p.querySelector(".mc-solo");
        if (sb) {
          var on = solo === i;
          sb.classList.toggle("on", on); sb.setAttribute("aria-pressed", on ? "true" : "false");
          sb.title = on ? "Trở về lưới nhiều khung" : "Xem riêng khung này — ẩn các khung khác";
          sb.setAttribute("aria-label", on ? "Trở về lưới nhiều khung" : "Xem riêng khung này (ẩn các khung khác)");
          sb.innerHTML = soloIcon(on);
        }
      });
    }
    /* Xem riêng 1 khung: các khung còn lại ẩn, khung này chiếm toàn bộ vùng biểu đồ (bấm lại để về lưới). keep = giữ nguyên chế độ riêng, chỉ đổi khung. */
    function setSolo(i, keep) {
      if (st.mode === "m" || i < 0 || i >= st.frames.length) return;
      st.solo = !keep && st.solo === i ? null : i;
      applyVisibility();
      var fix = function () { resizeAll(); var p = host.querySelector("#" + uid + "-p" + i); if (p && st.solo != null) { try { p.scrollIntoView({ block: "nearest", behavior: "smooth" }); } catch (e) { } } };
      requestAnimationFrame(function () { if (!st.dead) fix(); }); setTimeout(function () { if (!st.dead) resizeAll(); }, 160);
    }

    /* ----- Tab (điện thoại) ----- */
    function trendOf(res) {
      var cs = candlesOf(res), M = W.NHIPMultiTimeframe;
      if (!cs) { var c = st.cache[res]; return { res: res, loading: !!(c && c.loading), error: c && c.err, result: null }; }
      return { res: res, result: M ? M.analyze(cs, res) : { ready: false, reason: "Thiếu mô-đun phân tích" } };
    }
    var chipCls = function (state) { return state === "Tăng đồng thuận" ? "upb" : state === "Giảm đồng thuận" ? "dnb" : "mid"; };
    function renderTabs() {
      var t = host.querySelector("#" + uid + "-tabs"); if (!t) return;
      t.innerHTML = st.frames.map(function (res, i) {
        var r = trendOf(res), dot = r.result && r.result.ready ? chipCls(r.result.state) : "mid";
        return '<button type="button" role="tab" data-tab="' + i + '" aria-selected="' + (i === st.active) + '" class="' + (i === st.active ? "on" : "") + '"><i class="mc-dot ' + dot + '"></i>' + esc(shortLabel(res)) + "</button>";
      }).join("");
    }

    /* ----- Bảng tổng hợp ----- */
    function renderSummary() {
      var box = host.querySelector("#" + uid + "-sum"); if (!box) return;
      var rows = st.frames.map(trendOf), ov = overall(rows);
      var anyLoading = rows.some(function (r) { return r.loading; });
      var head = '<div class="mc-ov"><b>' + esc(anyLoading && ov.valid < 2 ? "Đang đối chiếu các khung…" : ov.text) + "</b><small>" + ov.valid + "/" + ov.total + " khung đủ dữ liệu · không phải xác suất tăng/giảm</small></div>";
      var body = rows.map(function (r, i) {
        var cs = candlesOf(r.res), b = cs ? C.barChange(cs, cs.length - 1) : null, ch = b ? b.pct : null, a = r.result;
        var trend = r.loading ? '<span class="muted">Đang tải…</span>' : r.error ? '<span class="sg mid" title="' + esc(r.error) + '">Lỗi</span>' : a && a.ready ? '<span class="sg ' + chipCls(a.state) + '" title="' + esc(a.state + " · điểm " + a.score + "/100") + '">' + esc(SHORT_STATE[a.state] || a.state) + "</span>" : '<span class="sg mid" title="' + esc(a ? a.reason : "") + '">Thiếu nến</span>';
        var rsi = a && a.ready ? nf(a.rsi, 1) : "—";
        return '<tr data-i="' + i + '" tabindex="0" role="button" aria-label="Xem khung ' + esc(label(r.res)) + '"><th scope="row">' + esc(label(r.res)) + "</th><td>" + trend + "</td><td>" + rsi + '</td><td class="' + (ch == null ? "" : ch < 0 ? "dn" : "up") + '">' + pct(ch) + "</td></tr>";
      }).join("");
      var note = "";
      if (ov.top && ov.valid >= 2) note = '<p class="mc-top">Khung lớn nhất có dữ liệu (' + esc(label(ov.top.res)) + "): <b>" + esc(ov.top.state) + "</b>. Phân tích top-down thường đọc khung lớn để xác định hướng chính, khung nhỏ để xem nhịp ngắn.</p>";
      box.innerHTML = head + '<div class="mc-tw"><table class="mc-tb"><thead><tr><th>Khung</th><th>Xu hướng</th><th>RSI</th><th>±% nến cuối</th></tr></thead><tbody>' + body + "</tbody></table></div>" + note +
        '<p class="source-note">Xu hướng chấm từ giá so với SMA20/SMA50, thứ tự SMA và RSI trên chính các nến của từng khung (cùng luật với tab Phân tích). Khung có dưới 20 nến (ví dụ 3 năm, 5 năm) sẽ ghi “Thiếu nến” thay vì ước lượng. Chạm một dòng để xem biểu đồ khung đó. Chỉ để tham khảo, không phải khuyến nghị đầu tư.</p>';
    }

    /* ----- Biểu đồ từng khung ----- */
    function disposeCharts() {
      st.charts.forEach(function (k) { if (k) { try { W.klinecharts.dispose(k); } catch (e) { } } });
      st.charts = [];
    }
    var volFmt = function (v) { return v == null ? "—" : v >= 1e9 ? nf(v / 1e9, 2) + " tỷ" : v >= 1e6 ? nf(v / 1e6, 2) + " tr" : nf(v, 0); };
    function roOf(i) { return host.querySelector("#" + uid + "-p" + i + " .mc-ro"); }
    function headerPx(i, idx, synced) {
      var res = st.frames[i], cs = candlesOf(res), px = host.querySelector("#" + uid + "-p" + i + " .mc-px"); if (!px || !cs) return;
      var j = idx == null || idx < 0 ? cs.length - 1 : idx, b = C.barChange(cs, j), c = b.bar;
      px.innerHTML = '<b class="' + (b.change != null && b.change < 0 ? "dn" : "up") + '">' + fp(c.close) + "</b> " + (b.pct != null ? '<i class="' + (b.change < 0 ? "dn" : "up") + '">' + pct(b.pct) + "</i>" : "") +
        '<small class="mc-dt' + (synced ? " sync" : "") + '">' + esc(fmtDate(c.time, res)) + "</small>";
      /* Dòng giá giống biểu đồ chính: Mở · Cao · Thấp · Đóng · ± · KL (theo nến đang rê chuột, mặc định nến cuối) */
      var ro = roOf(i);
      if (ro) ro.innerHTML = "<span>Mở <b>" + fp(c.open) + "</b></span><span>Cao <b>" + fp(c.high) + "</b></span><span>Thấp <b>" + fp(c.low) + "</b></span><span>Đóng <b>" + fp(c.close) + "</b></span>" +
        (b.change != null ? '<span class="' + (b.change < 0 ? "dn" : "up") + '">' + (b.change > 0 ? "+" : "") + fp(b.change) + " (" + pct(b.pct) + ")</span>" : "") +
        "<span>KL <b>" + volFmt(c.volume) + "</b></span>";
    }
    function paintPanel(i) {
      var res = st.frames[i], box = host.querySelector("#" + uid + "-c" + i); if (!box) return;
      var c = st.cache[res], cs = candlesOf(res);
      if (!cs) {
        disposeOne(i);
        box.innerHTML = c && c.err ? '<div class="placeholder">' + esc(c.err) + '. Nhịp Đầu Tư không tự tạo giá thay thế.<br><button type="button" class="btn pale mc-retry" style="margin-top:8px">Thử lại</button></div>' : '<div class="placeholder">Đang tải…</div>';
        var px = host.querySelector("#" + uid + "-p" + i + " .mc-px"); if (px) px.innerHTML = "";
        return;
      }
      if (st.mode === "m" && i !== st.active) { headerPx(i); return; } /* điện thoại: chỉ dựng biểu đồ của tab đang xem */
      if (!W.klinecharts) { box.innerHTML = '<div class="placeholder">Không tải được thư viện biểu đồ (KLineChart).</div>'; return; }
      disposeOne(i); box.innerHTML = "";
      st.sc = C.priceScale(st.sym, cs[cs.length - 1].close);
      var k = W.klinecharts.init(box); st.charts[i] = k;
      var col = opts.colors(), g = opts.grid();
      try { k.setTimezone("Asia/Ho_Chi_Minh"); k.setPriceVolumePrecision(C.isIndex(st.sym) ? 2 : 0, 0); } catch (e) { }
      try {
        k.setStyles(opts.isDark() ? "dark" : "light");
        k.setStyles({
          grid: { horizontal: { color: g }, vertical: { color: g } },
          candle: { tooltip: { showRule: "none" }, bar: { upColor: col.up, downColor: col.dn, upBorderColor: col.up, downBorderColor: col.dn, upWickColor: col.up, downWickColor: col.dn } },
          indicator: { tooltip: { showRule: "none" } }
        });
      } catch (e) { console.warn("mc: styles", e); }
      k.applyNewData(cs.map(toK));
      try { k.createIndicator({ name: "MA", calcParams: [20, 50] }, true, { id: "candle_pane" }); } catch (e) { }
      try { k.createIndicator({ name: "VOL", styles: { bars: [{ style: "fill", borderSize: 1, upColor: C.hexA(col.up, 0.7), downColor: C.hexA(col.dn, 0.7), noChangeColor: "#8a97a6" }] } }, false, { height: st.mode === "m" ? 56 : 44 }); } catch (e) { }
      try { k.setOffsetRightDistance(st.mode === "m" ? 30 : 48); k.scrollToRealTime(); } catch (e) { }
      try {
        k.subscribeAction("onCrosshairChange", function (p) {
          var ts = null;
          if (p && p.kLineData && p.kLineData.timestamp) ts = p.kLineData.timestamp;
          else if (p && typeof p.dataIndex === "number" && cs[p.dataIndex]) ts = cs[p.dataIndex].time * 1000;
          st.hoverTs = ts; if (st.raf) return;
          st.raf = requestAnimationFrame(function () { st.raf = 0; if (!st.dead) syncHover(i); });
        });
      } catch (e) { console.warn("mc: crosshair", e); }
      headerPx(i);
      try { W.dispatchEvent(new CustomEvent("nhip:mc-chart-built", { detail: { k: k, box: box, i: i, res: res, host: host, sym: st.sym, candles: cs, mc: { frames: function () { return st.frames.slice(); }, candlesOf: candlesOf } } })); } catch (e) { }
    }
    function disposeOne(i) { var k = st.charts[i]; if (k) { try { W.klinecharts.dispose(k); } catch (e) { } st.charts[i] = null; } }
    /* Rê vào biểu đồ i → mọi biểu đồ hiện nến chứa cùng thời điểm; thả ra → về nến cuối */
    function syncHover(src) {
      var ts = st.hoverTs;
      st.frames.forEach(function (res, i) {
        var cs = candlesOf(res); if (!cs) return;
        if (ts == null) { headerPx(i); return; }
        if (i === src) { headerPx(i, lastIndexLE(cs, Math.floor(ts / 1000)), true); return; }
        var idx = lastIndexLE(cs, Math.floor(ts / 1000));
        if (idx < 0) { var px = host.querySelector("#" + uid + "-p" + i + " .mc-px"); if (px) px.innerHTML = '<span class="muted">Chưa có nến thời điểm này</span>'; var r0 = roOf(i); if (r0) r0.innerHTML = ""; }
        else headerPx(i, idx, true);
      });
    }
    function liveUpdate(i, nd) {
      var res = st.frames[i], k = st.charts[i]; if (!k) { headerPx(i); return; }
      try {
        var drawn = k.getDataList(), lastT = drawn.length ? drawn[drawn.length - 1].timestamp / 1000 : 0;
        nd.candles.filter(function (c) { return c.time >= lastT; }).forEach(function (c) { k.updateData(toK(c)); });
      } catch (e) { console.warn("mc: cập nhật", e); }
      headerPx(i);
    }

    /* ----- Vòng đời ----- */
    function resizeAll() { st.charts.forEach(function (k) { if (k) { try { k.resize(); } catch (e) { } } }); }
    function onResize() {
      if (st.dead) return;
      if (!host.isConnected) { destroy(); return; }
      var m = modeOf();
      if (m !== st.mode) { disposeCharts(); build(); } else resizeAll();
    }
    function destroy() {
      st.dead = true; disposeCharts();
      if (st.ro) { try { st.ro.disconnect(); } catch (e) { } st.ro = null; }
      if (st.timer) { clearInterval(st.timer); st.timer = null; }
      if (st.raf) { cancelAnimationFrame(st.raf); st.raf = 0; }
    }
    build(); loadAll(false);
    try { var t = 0; st.ro = new ResizeObserver(function () { clearTimeout(t); t = setTimeout(onResize, 120); }); st.ro.observe(host); } catch (e) { addEventListener("resize", onResize); }
    st.timer = setInterval(function () { if (st.dead) return; if (!host.isConnected) { destroy(); return; } if (document.hidden || host.hidden) return; loadAll(true); }, 60000);

    return {
      destroy: destroy,
      resize: function () { if (!st.dead) onResize(); },
      setSymbol: function (s) { if (st.dead || s === st.sym) return; st.sym = s; st.cache = {}; disposeCharts(); build(); loadAll(true); },
      getFrames: function () { return st.frames.slice(); },
      /* Giá gần nhất (đồng) lấy từ nến của khung nhỏ nhất đã có dữ liệu; null nếu chưa có */
      lastPrice: function () {
        var best = null; st.frames.forEach(function (r) { var cs = candlesOf(r); if (cs && (!best || rank(r) < rank(best.res))) best = { res: r, cs: cs }; });
        if (!best) return null; var c = best.cs[best.cs.length - 1].close; return c * C.priceScale(st.sym, c);
      }
    };
  }
  api.mount = mount;
  return api;
});
