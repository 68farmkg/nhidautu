/* NHIP · BCTC v1 — tab "BCTC" cạnh Tin tức ở trang Biểu đồ.
   Nguồn: VNDirect FinInfo qua /proxy/finfo (chỉ số có tên: P/E, P/B, EPS, ROE, ROA — 8 quý gần nhất) và /proxy/bctc (báo cáo theo mã khoản mục).
   Không sửa charts.js: tự chèn nút + khung khi thấy #tabs. Tên khoản mục lấy từ financial_models (từ điển modelType:itemCode); thiếu thì hiện "Mã xxxxx", không đoán tên. */
(function () {
  "use strict";
  var W = window, D = document, CACHE = {}, TTL = 10 * 60e3, seq = 0, DK = "nhip.bctc.dict.v1", DTTL = 30 * 86400e3, DICT = null, DP = null;
  var IDX = /^(VNINDEX|VN30|VN100|VNALL|VNMID|VNSML|HNX\w*|UPCOM\w*)$/;
  var RAT = [["PRICE_TO_EARNINGS", "P/E", "x", 1], ["PRICE_TO_BOOK", "P/B", "x", 1], ["EPS_TR", "EPS (đ)", "d"], ["ROAE_TR_AVG5Q", "ROE", "%"], ["ROAA_TR_AVG5Q", "ROA", "%"]]; /* P/E, P/B theo NGÀY → chỉ lấy giá trị mới nhất; EPS, ROE, ROA theo QUÝ */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function q(d) { var m = /^(\d{4})-(\d{2})/.exec(d || ""); return m ? "Q" + Math.ceil(+m[2] / 3) + "/" + m[1].slice(2) : esc(d); }
  function num(v, k) {
    if (typeof v !== "number" || !isFinite(v)) return "–";
    if (k === "%") return (Math.abs(v) <= 1 ? v * 100 : v).toLocaleString("vi-VN", { maximumFractionDigits: 1 }) + "%";
    if (k === "d") return Math.round(v).toLocaleString("vi-VN");
    return v.toLocaleString("vi-VN", { maximumFractionDigits: 2 });
  }
  function sym() { var h = D.getElementById("cp-sym"), s = (h && h.textContent || W.__nhipChartSymbol || "").toUpperCase().replace(/[^A-Z0-9.]/g, ""); return s; }
  function getJ(u) { return fetch(u, { headers: { Accept: "application/json" } }).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }); }
  /* Từ điển tên khoản mục: VNDirect financial_models (đã kiểm: 3.370 dòng, có itemCode/itemVnName/itemEnName). Tải 1 lần, lưu 30 ngày trong trình duyệt. */
  function dictLoad() {
    if (DICT) return Promise.resolve(DICT);
    try { var c = JSON.parse(W.localStorage.getItem(DK) || "null"); if (c && c.m && Date.now() - c.t < DTTL) { DICT = c; return Promise.resolve(c); } } catch (e) { }
    if (DP) return DP;
    var F = "modelType,modelTypeName,modelVnDesc,companyForm,itemCode,itemVnName,itemEnName";
    var page = function (p) { return getJ("/proxy/finfo?" + new URLSearchParams({ endpoint: "financial_models", fields: F, size: "4000", page: String(p) })); };
    DP = page(1).then(function (j) {
      var rows = j.data || [];
      if (!rows.length || rows[0].codeList !== undefined) throw new Error("nguồn bỏ qua tham số fields — không tải từ điển để tránh tải quá nặng");
      var all = rows.slice(), pages = Math.min(Number(j.totalPages) || 1, 12), ch = Promise.resolve();
      for (var p = 2; p <= pages; p++) (function (pp) { ch = ch.then(function () { return page(pp); }).then(function (jj) { Array.prototype.push.apply(all, jj.data || []); }); })(p);
      return ch.then(function () { return { total: Number(j.totalElements) || all.length, rows: all }; });
    }).then(function (r) {
      var m = {}, mt = {};
      r.rows.forEach(function (x) { var k = String(x.modelType) + ":" + String(x.itemCode); if (!m[k]) m[k] = [x.itemVnName || "", x.itemEnName || ""]; if (!mt[x.modelType]) mt[x.modelType] = x.modelVnDesc || x.modelTypeName || ""; });
      DICT = { t: Date.now(), m: m, mt: mt, n: Object.keys(m).length, total: r.total };
      try { W.localStorage.setItem(DK, JSON.stringify(DICT)); } catch (e) { }
      return DICT;
    }); DP.catch(function () { DP = null; });
    return DP;
  }
  function css() {
    if (D.getElementById("bctc-css")) return;
    var s = D.createElement("style"); s.id = "bctc-css";
    s.textContent = "#p-fs table{width:100%;border-collapse:collapse;font-size:12px;table-layout:fixed}#p-fs th,#p-fs td{padding:5px 4px;text-align:right;border-bottom:1px solid rgba(128,128,128,.25);word-break:break-word}#p-fs th:first-child,#p-fs td:first-child{text-align:left;width:40%}#p-fs h4{margin:14px 0 6px}#p-fs details{margin-top:10px}#p-fs summary{cursor:pointer;font-weight:600}#p-fs .bc-val{display:flex;gap:14px;flex-wrap:wrap;margin:4px 0 8px}";
    D.head.appendChild(s);
  }
  function fmtDay(d) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || ""); return m ? m[3] + "/" + m[2] + "/" + m[1] : esc(d); }
  function ratiosHtml(rows) {
    var val = rows.filter(function (r) { return r.daily; }), qr = rows.filter(function (r) { return !r.daily; });
    var h = '<div class="bc-val">' + val.map(function (r) { var p = r.pts[0]; return "<span><b>" + esc(r.l) + "</b> " + (p ? num(p.v, r.k) : "–") + (p ? ' <span class="muted">(' + fmtDay(p.d) + ")</span>" : "") + "</span>"; }).join("") + "</div>";
    var per = {}; qr.forEach(function (r) { r.pts.forEach(function (p) { per[p.d] = 1; }); });
    var ds = Object.keys(per).sort().reverse().slice(0, 4);
    if (!ds.length) return h + '<p class="muted">Nguồn không có EPS/ROE/ROA theo quý cho mã này.</p>';
    return h + "<table><thead><tr><th>Chỉ số</th>" + ds.map(function (d) { return "<th>" + q(d) + "</th>"; }).join("") + "</tr></thead><tbody>" +
      qr.map(function (r) { var m = {}; r.pts.forEach(function (p) { m[p.d] = p.v; }); return "<tr><td>" + esc(r.l) + "</td>" + ds.map(function (d) { return "<td>" + num(m[d], r.k) + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table>";
  }
  function stmtHtml(j, dc) {
    var ps = (j.periods || []).slice(0, 4), out = "";
    Object.keys(j.models || {}).sort(function (a, b) { return a - b; }).forEach(function (mt) {
      var items = Object.keys(j.models[mt]).sort(function (a, b) { return a - b; }).filter(function (it) { return ps.some(function (d) { var x = j.models[mt][it][d]; return typeof x === "number" && x !== 0; }); });
      out += "<h4>" + esc((dc && dc.mt[mt]) || "Loại báo cáo " + mt) + " · " + items.length + " khoản mục có số</h4><table><thead><tr><th>Khoản mục</th>" + ps.map(function (d) { return "<th>" + q(d) + "</th>"; }).join("") + "</tr></thead><tbody>" +
        items.slice(0, 120).map(function (it) { var v = j.models[mt][it]; return "<tr><td>" + (dc && dc.m[mt + ":" + it] && dc.m[mt + ":" + it][0] ? esc(dc.m[mt + ":" + it][0]) + ' <span class="muted">(' + esc(it) + ")</span>" : "Mã " + esc(it)) + "</td>" + ps.map(function (d) { var x = v[d]; return "<td>" + (typeof x === "number" ? (x / 1e9).toLocaleString("vi-VN", { maximumFractionDigits: 1 }) : "–") + "</td>"; }).join("") + "</tr>"; }).join("") +
        "</tbody></table>" + (items.length > 120 ? '<p class="muted">Chỉ hiện 120 khoản mục đầu.</p>' : "");
    });
    return out || '<p class="muted">Chưa có báo cáo chi tiết.</p>';
  }
  function load(force) {
    var pane = D.getElementById("p-fs"); if (!pane) return;
    var s = sym(), my = ++seq;
    if (!s) { pane.innerHTML = '<p class="muted">Chọn một mã để xem báo cáo tài chính.</p>'; return; }
    if (IDX.test(s)) { pane.innerHTML = '<p class="muted">' + esc(s) + " là chỉ số, không có báo cáo tài chính.</p>"; return; }
    var c = CACHE[s]; if (c && !force && Date.now() - c.t < TTL) { pane.innerHTML = c.h; return; }
    pane.innerHTML = '<p class="muted">Đang tải báo cáo tài chính của ' + esc(s) + "…</p>";
    var rp = Promise.all(RAT.map(function (d) {
      return getJ("/proxy/finfo?" + new URLSearchParams({ endpoint: "ratios", q: "code:" + s + "~ratioCode:" + d[0], size: d[3] ? "1" : "4", sort: "reportDate:desc" }))
        .then(function (j) { return { l: d[1], k: d[2], daily: !!d[3], pts: (j.data || []).map(function (x) { return { d: x.reportDate, v: x.value != null ? Number(x.value) : null }; }) }; }).catch(function () { return { l: d[1], k: d[2], daily: !!d[3], pts: [] }; });
    }));
    var sp = getJ("/proxy/bctc?" + new URLSearchParams({ code: s, type: "QUARTER", n: "4" })).catch(function () { return null; });
    var dp = dictLoad().catch(function () { return null; });
    Promise.all([rp, sp, dp]).then(function (a) {
      if (my !== seq) return;
      var h = "<h4>Chỉ số tài chính</h4>" + ratiosHtml(a[0]) +
        "<details><summary>Báo cáo chi tiết theo quý (tỷ đồng)</summary>" + (a[1] ? (a[2] ? "" : '<p class="muted">Chưa tải được tên khoản mục nên hiện theo mã.</p>') + stmtHtml(a[1], a[2]) : '<p class="muted">Không tải được báo cáo chi tiết.</p>') + "</details>" +
        '<p class="muted source-note">Nguồn: VNDirect FinInfo. Số liệu theo kỳ công bố, không phải realtime.</p>';
      CACHE[s] = { t: Date.now(), h: h }; pane.innerHTML = h;
    });
  }
  function inject() {
    var tabs = D.getElementById("tabs"); if (!tabs || tabs.querySelector('[data-t="fs"]')) return;
    var nw = tabs.querySelector('[data-t="nw"]'), pn = D.getElementById("p-nw"); if (!nw || !pn) return;
    css();
    var b = D.createElement("button"); b.type = "button"; b.dataset.t = "fs"; b.textContent = "BCTC"; nw.after(b);
    var p = D.createElement("div"); p.id = "p-fs"; p.className = "pane"; p.hidden = true; pn.after(p);
    tabs.addEventListener("click", function (e) {
      var t = e.target.closest && e.target.closest("button[data-t]"); if (!t) return;
      if (t.dataset.t === "fs") {
        tabs.querySelectorAll("button").forEach(function (x) { x.classList.toggle("on", x === t); });
        ["wl", "sig", "nw"].forEach(function (k) { var e2 = D.getElementById("p-" + k); if (e2) e2.hidden = true; });
        p.hidden = false; load(false);
      } else p.hidden = true;
    });
  }
  W.addEventListener("nhip:chart-symbol", function () { var p = D.getElementById("p-fs"); if (p && !p.hidden) setTimeout(function () { load(false); }, 50); else seq++; });
  var raf = 0; new MutationObserver(function () { if (raf) return; raf = requestAnimationFrame(function () { raf = 0; inject(); }); }).observe(D.documentElement, { childList: true, subtree: true });
  inject();
  W.NHIPBctc = { reload: function () { load(true); } };
})();
