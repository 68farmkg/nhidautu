/* NHỊP · V2.2 — 3 SÀN = 3 NHÀ RIÊNG (HOSE · HNX · UPCoM)
   Khách hàng là người nắm cả ba nhà. Vào nhà nào thì toàn bộ ứng dụng chỉ hiện đúng nhà đó:
   mã, bảng giá, theo dõi, cảnh báo, lịch sử, danh mục, lệnh chờ, biểu đồ, giao dịch.

   Cách làm (KHÔNG xóa/sửa dữ liệu gốc, chỉ lọc khi hiển thị):
   - Mọi dữ liệu đi qua fetch("/api/…") nên lọc ở MỘT chỗ (lớp bọc fetch bên dưới).
   - Khi ghi ngược (lưu Theo dõi, lưu Danh mục) lớp này gộp lại phần của các nhà đang ẩn, nên không nhà nào bị mất dữ liệu.
   - Danh mục có nhãn ex (HOSE|HNX|UPCOM). Danh mục cũ chưa có nhãn được suy ra từ mã đang giữ và được ghi nhãn ở lần lưu kế tiếp.
   - Ghi giao dịch mua/bán/vị thế của mã nhà khác vào danh mục của nhà này bị chặn. */
(function () {
  "use strict";
  var W = window, D = document;
  var HS = ["HOSE", "HNX", "UPCOM"], NM = { HOSE: "HOSE", HNX: "HNX", UPCOM: "UPCoM" },
    SUB = { HOSE: "Sở TP.HCM", HNX: "Sở Hà Nội", UPCOM: "Đăng ký GD" },
    FULLNM = { HOSE: "Sở Giao dịch Chứng khoán TP.HCM", HNX: "Sở Giao dịch Chứng khoán Hà Nội", UPCOM: "Thị trường UPCoM" },
    DEF = { HOSE: "FPT", HNX: "SHS", UPCOM: "ACV" }, KEY = "nhip.house.v1";
  var S = (function () { try { var j = JSON.parse(W.localStorage.getItem(KEY) || "{}"); return { cur: HS.indexOf(j.cur) >= 0 ? j.cur : "HOSE", last: j.last || {}, pf: j.pf || {} }; } catch (e) { return { cur: "HOSE", last: {}, pf: {} }; } })();
  function save() { try { W.localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } }
  var RAW = { wl: null, pf: null, cust: [] };

  /* ---------- Mã thuộc nhà nào ---------- */
  function isSymLike(s) { return typeof s === "string" && /^[A-Z0-9.]{2,12}$/.test(s); }
  function houseOf(sym) {
    var k = String(sym || "").toUpperCase(); if (!k) return "";
    if (/^(VNINDEX|VN30|VN100|VNALL|VNMID|VNSML)$/.test(k)) return "HOSE";
    if (/^HNX\w*$/.test(k)) return "HNX";
    if (/^UPCOM\w*$/.test(k)) return "UPCOM";
    var N = W.NHIPOrders;
    if (N && N.effEx) { try { return N.effEx(k); } catch (e) { } }
    var f = ""; try { var e2 = W.NHIPSYM && W.NHIPSYM.info ? W.NHIPSYM.info(k) : null; f = e2 && e2.floor ? String(e2.floor).toUpperCase().replace(/[^A-Z]/g, "") : ""; } catch (e) { }
    return f === "HNX" ? "HNX" : f === "UPCOM" ? "UPCOM" : "HOSE";
  }
  function inHouse(sym, h) { return houseOf(sym) === (h || S.cur); }
  function isIndexSym(k) { return /^(VNINDEX|VN30|VN100|VNALL|VNMID|VNSML|HNX\w*|UPCOM\w*)$/.test(String(k || "").toUpperCase()); }

  /* ---------- v2.21 — CỔNG KIỂM TRA SÀN KHI GHI ----------
     Mã MỚI chỉ được ghi vào nhà đúng sàn của nó. Không đoán: mã chưa rõ sàn cũng bị từ chối (không âm thầm tính là HOSE).
     Chỉ kiểm mã mới thêm; dữ liệu cũ không bị đụng tới nên không làm hỏng thao tác xóa/sửa khác. */
  function exKnownSym(k) {
    try { var N = W.NHIPOrders; if (N && typeof N.exKnown === "function" && N.exKnown(k)) return true; } catch (e) { }
    try { var e2 = W.NHIPSYM && W.NHIPSYM.info ? W.NHIPSYM.info(k) : null; return !!(e2 && e2.floor); } catch (e) { }
    return false;
  }
  function whyNot(sym, h) {
    var k = String(sym || "").toUpperCase(); if (!isSymLike(k)) return "";
    var at = houseOf(k);
    if (!isIndexSym(k) && !exKnownSym(k)) return k + " (chưa rõ sàn)";
    return at === (h || S.cur) ? "" : k + " (" + NM[at] + ")";
  }
  function whyNotList(arr, h) { var seen = {}, out = []; (arr || []).forEach(function (s) { var w = whyNot(s, h); if (w && !seen[w]) { seen[w] = 1; out.push(w); } }); return out; }

  /* ---------- Lọc dữ liệu hiển thị ---------- */
  function symOf(x) { return x && typeof x === "object" ? (x.symbol || x.sym) : null; }
  function walk(o) {
    if (Array.isArray(o)) {
      var out = [];
      o.forEach(function (x) { var s = symOf(x); if (!Array.isArray(x) && isSymLike(s) && !inHouse(s)) return; out.push(walk(x)); });
      return out;
    }
    if (o && typeof o === "object") { Object.keys(o).forEach(function (k) { o[k] = walk(o[k]); }); }
    return o;
  }
  function scopeOverview(d) {
    if (!d || typeof d !== "object") return d;
    walk(d);
    if (Array.isArray(d.stocks)) {
      var by = {}; d.stocks.forEach(function (s) { (by[s.sector] = by[s.sector] || []).push(s); });
      d.sectors = Object.keys(by).map(function (n) { var l = by[n]; return { name: n, pct: +(l.reduce(function (a, b) { return a + (b.pct || 0); }, 0) / l.length).toFixed(2), count: l.length }; });
      d.breadth = { up: d.stocks.filter(function (s) { return s.pct > 0; }).length, down: d.stocks.filter(function (s) { return s.pct < 0; }).length, flat: d.stocks.filter(function (s) { return s.pct === 0; }).length };
    }
    return d;
  }
  function scopeSymbols(d) {
    if (!d || !Array.isArray(d.items)) return d;
    walk(d);
    var has = {}; d.items.forEach(function (x) { has[x.symbol] = 1; });
    if (S.cur === "HNX" && !has.HNX) d.items.unshift({ symbol: "HNX", sector: "Chỉ số" });
    if (S.cur === "UPCOM" && !has.UPCOM) d.items.unshift({ symbol: "UPCOM", sector: "Chỉ số" });
    return d;
  }
  /* Lịch sử — v2.27: MỌI bản ghi thuộc đúng một sàn, sàn nào ra sàn đó, không hiển thị chung.
     Thứ tự xác định sàn của một bản ghi:
       1) nhãn ex được gắn lúc ghi (mọi bản ghi mới: xem mã, hỏi AI, thao tác, giao dịch…);
       2) mã (sym); 3) danh mục/khách hàng liên quan; 4) mã nêu trong chi tiết (Theo dõi, quy tắc cảnh báo);
       5) bản ghi CŨ không thể xác định (trước v2.27, không mã, không danh mục): xếp vào HOSE — KHÔNG hiện ở cả 3 sàn. */
  function feedVisible(e, pfEx, custEx) {
    if (!e) return false;
    var act = String(e.action || ""), H = S.cur;
    if (validEx(e.ex)) return e.ex === H;
    if (isSymLike(e.sym)) return inHouse(e.sym);
    if (e.pid && pfEx[e.pid]) return pfEx[e.pid] === H;
    if (/^watch\./.test(act)) {
      var toks = String(e.detail || "").split(/[;,:]/).map(function (x) { return (x.trim().match(/^[A-Z0-9.]{2,12}$/) || [""])[0]; }).filter(function (t) { return t && !/^\d+$/.test(t) && isIndexSym(t) || (t && exKnownSym(t)); });
      if (toks.length) return toks.some(function (t) { return inHouse(t); });
    }
    if (/^portfolio\./.test(act) && e.entityId && pfEx[e.entityId]) return pfEx[e.entityId] === H;
    if (/^customer\./.test(act) && e.entityId && custEx[e.entityId]) return custEx[e.entityId] === H;
    if (/^alerts\.rule\./.test(act)) { var m = /\b([A-Z0-9.]{2,12})\b/.exec(String(e.title || "")); if (m && exKnownSym(m[1])) return inHouse(m[1]); }
    return H === "HOSE";
  }
  function scopeFeed(d) {
    if (!d || !Array.isArray(d.events)) return d;
    var pfEx = {}; (RAW.pf || []).forEach(function (p) { pfEx[p.id] = p.ex; });
    var custEx = {}; (RAW.cust || []).forEach(function (c) { custEx[c.id] = c.ex; });
    d.events = d.events.filter(function (e) { return feedVisible(e, pfEx, custEx); });
    if (d.sources && typeof d.sources === "object") {
      d.sources.trades = d.events.filter(function (e) { return e.cat === "trade"; }).length;
      d.sources.audit = d.events.filter(function (e) { return e.cat === "audit"; }).length;
      d.sources.alerts = d.events.filter(function (e) { return e.cat === "alert"; }).length;
      d.sources.watch = d.events.filter(function (e) { return e.cat === "watch"; }).length;
      d.sources.activity = d.events.filter(function (e) { return e.cat === "research"; }).length;
    }
    d.house = S.cur;
    return d;
  }
  function scopeState(d) {
    if (!d || typeof d !== "object") return d;
    if (Array.isArray(d.watchlist)) { RAW.wl = d.watchlist.slice(); d.watchlist = d.watchlist.filter(function (s) { return inHouse(s); }); }
    if (Array.isArray(d.portfolio)) d.portfolio = d.portfolio.filter(function (p) { return !isSymLike(p && p.symbol) || inHouse(p.symbol); });
    return d;
  }

  /* ---------- Danh mục: mỗi danh mục thuộc đúng một nhà ---------- */
  function inferEx(p) {
    var c = { HOSE: 0, HNX: 0, UPCOM: 0 };
    (p.positions || []).forEach(function (x) { if (x && x.symbol && !isIndexSym(x.symbol)) c[houseOf(x.symbol)]++; });
    (p.tx || []).forEach(function (t) { if (t && t.symbol && (t.type === "buy" || t.type === "sell" || t.type === "pos") && !isIndexSym(t.symbol)) c[houseOf(t.symbol)]++; });
    var best = "HOSE", mx = 0; HS.forEach(function (h) { if (c[h] > mx) { mx = c[h]; best = h; } });
    return best;
  }
  function blankPf(h, d) {
    var cid = ""; try { var cf = W.sessionStorage.pfCust; if (cf && cf !== "all" && cf !== "none" && (d.customers || []).some(function (c) { return c.id === cf; })) cid = cf; } catch (e) { }
    return { id: "nha" + h.toLowerCase(), cid: cid, name: "Danh mục " + NM[h], sim: false, ex: h, cash: 0, realized: 0, divs: 0, divEv: [], orders: [], positions: [], tx: [] };
  }
  /* v2.5 — MỖI NHÀ MỘT DANH SÁCH KHÁCH HÀNG RIÊNG. Khách có nhãn ex. Khách cũ (chưa nhãn, hoặc đang dùng chung nhiều nhà) được TÁCH một lần:
     khách giữ nhà có nhiều danh mục nhất; ở nhà khác tạo bản sao (tên/điện thoại/ghi chú giống) và chuyển danh mục + giao dịch sang bản sao. Không xóa gì. */
  function validEx(x) { return HS.indexOf(x) >= 0; }
  function ensurePfEx(d) { (d.list || []).forEach(function (p) { if (!validEx(p.ex)) p.ex = inferEx(p); }); }
  function needsMig(d) {
    if (!d || !Array.isArray(d.list)) return false;
    var cs = {}; (d.customers || []).forEach(function (c) { cs[c.id] = c; });
    if ((d.customers || []).some(function (c) { return !validEx(c.ex); })) return true;
    return d.list.some(function (p) { var c = p.cid && cs[p.cid]; return c && validEx(p.ex) && c.ex !== p.ex; });
  }
  function newCid(base, h, used) {
    var core = String(base || "k").replace(/[^a-z0-9]/gi, "").slice(0, 14) + h.charAt(0).toLowerCase() + h.charAt(h.length - 1).toLowerCase(), id, i = 0;
    do { id = (core + (i ? i.toString(36) : Math.random().toString(36).slice(2, 4))).slice(0, 20); i++; } while (used[id]);
    used[id] = 1; return id;
  }
  function migrateCust(d) {
    ensurePfEx(d);
    var used = {}; (d.customers || []).forEach(function (c) { used[c.id] = 1; });
    var add = [];
    (d.customers || []).forEach(function (c) {
      var by = { HOSE: [], HNX: [], UPCOM: [] };
      d.list.forEach(function (p) { if (p.cid === c.id) by[p.ex].push(p); });
      var primary = validEx(c.ex) ? c.ex : null;
      if (!primary) { var best = -1; HS.forEach(function (h) { if (by[h].length > best) { best = by[h].length; primary = h; } }); if (best <= 0) primary = S.cur; }
      c.ex = primary;
      HS.forEach(function (h) {
        if (h === primary || !by[h].length) return;
        var nc = { id: newCid(c.id, h, used), name: c.name, phone: c.phone || "", note: c.note || "", created: c.created || "", ex: h };
        add.push(nc);
        by[h].forEach(function (p) { p.cid = nc.id; (p.tx || []).forEach(function (t) { if (t && t.cid === c.id) t.cid = nc.id; }); });
      });
    });
    d.customers = (d.customers || []).concat(add);
    return d;
  }
  function scopePf(d) {
    if (!d || !Array.isArray(d.list)) return d;
    ensurePfEx(d);
    if (!Array.isArray(d.customers)) d.customers = [];
    d.customers.forEach(function (c) { if (!validEx(c.ex)) c.ex = ""; });
    RAW.pf = JSON.parse(JSON.stringify(d.list));
    RAW.cust = JSON.parse(JSON.stringify(d.customers));
    var h = S.cur, vis = d.list.filter(function (p) { return p.ex === h; });
    d.customers = d.customers.filter(function (c) { return c.ex === h; });
    var okC = {}; d.customers.forEach(function (c) { okC[c.id] = 1; });
    if (!vis.length) vis = [blankPf(h, d)];
    vis.forEach(function (p) { if (p.cid && !okC[p.cid]) p.cid = ""; });
    d.list = vis;
    var want = S.pf[h];
    d.active = vis.some(function (p) { return p.id === d.active; }) ? d.active : (vis.some(function (p) { return p.id === want; }) ? want : vis[0].id);
    S.pf[h] = d.active; save();
    return d;
  }

  /* ---------- Bọc fetch ---------- */
  var realFetch = W.fetch.bind(W);
  function jres(o, st) { return new Response(JSON.stringify(o), { status: st || 200, headers: { "Content-Type": "application/json" } }); }
  function refuse(h, bad, what) {
    return jres({ error: "Nhà " + NM[h] + " không ghi " + what + " của sàn khác hoặc chưa rõ sàn: " + bad.slice(0, 4).join(", ") + (bad.length > 4 ? "…" : "") + ". Hãy chuyển sang đúng nhà của mã (hoặc đồng bộ danh bạ mã) rồi thêm.", code: "HOUSE_MISMATCH" }, 400);
  }
  function bodyOf(init) { try { return init && typeof init.body === "string" ? JSON.parse(init.body) : null; } catch (e) { return null; } }
  function withBody(init, b) { return Object.assign({}, init, { body: JSON.stringify(b) }); }

  function mergeWatch(init) {
    var b = bodyOf(init); if (!b || !Array.isArray(b.symbols)) return init;
    var hidden = (RAW.wl || []).filter(function (s) { return !inHouse(s); });
    var seen = {}, all = b.symbols.concat(hidden).filter(function (s) { if (seen[s]) return false; seen[s] = 1; return true; });
    b.symbols = all; return withBody(init, b);
  }
  function guardPf(init) {
    var b = bodyOf(init); if (!b || !Array.isArray(b.list)) return { init: init };
    var h = S.cur, old = {}; (RAW.pf || []).forEach(function (p) { old[p.id] = p; });
    b.list.forEach(function (p) { if (HS.indexOf(p.ex) < 0) p.ex = h; });
    /* v2.5: khách mới tạo ở nhà nào thuộc nhà đó; gộp lại khách của các nhà đang ẩn để không bị xóa nhầm */
    if (Array.isArray(b.customers)) {
      b.customers.forEach(function (c) { if (!validEx(c.ex)) c.ex = h; });
      var cid2 = {}; b.customers.forEach(function (c) { cid2[c.id] = 1; });
      var hidC = (RAW.cust || []).filter(function (c) { return c.ex !== h && !cid2[c.id]; });
      var hidId = {}; hidC.forEach(function (c) { hidId[c.id] = 1; });
      b.list.forEach(function (p) { if (p.ex === h && p.cid && hidId[p.cid]) p.cid = ""; });
      b.customers = b.customers.concat(hidC);
    }
    var bad = [];
    b.list.forEach(function (p) {
      var ids = {}; ((old[p.id] || {}).tx || []).forEach(function (t) { ids[t.id] = 1; });
      (p.tx || []).forEach(function (t) {
        if (ids[t.id] || !t || !t.symbol || !(t.type === "buy" || t.type === "sell" || t.type === "pos")) return;
        var w = whyNot(t.symbol, p.ex); if (w) bad.push(w);
      });
      var hadPos = {}, hadOrd = {}, o = old[p.id] || {};
      (o.positions || []).forEach(function (x) { if (x && x.symbol) hadPos[String(x.symbol).toUpperCase()] = 1; });
      (o.orders || []).forEach(function (x) { if (x && x.id) hadOrd[x.id] = 1; });
      (p.positions || []).forEach(function (x) { if (x && x.symbol && !hadPos[String(x.symbol).toUpperCase()]) { var w1 = whyNot(x.symbol, p.ex); if (w1) bad.push(w1); } });
      (p.orders || []).forEach(function (x) { if (x && x.sym && !(x.id && hadOrd[x.id])) { var w2 = whyNot(x.sym, p.ex); if (w2) bad.push(w2); } });
    });
    if (bad.length) return { err: "Nhà " + NM[h] + " không ghi được mã của sàn khác hoặc chưa rõ sàn: " + bad.slice(0, 4).join(", ") + ". Hãy chuyển sang đúng nhà của mã (hoặc đồng bộ danh bạ mã) rồi ghi." };
    var ids2 = {}; b.list.forEach(function (p) { ids2[p.id] = 1; });
    var hidden = (RAW.pf || []).filter(function (p) { return p.ex !== h && !ids2[p.id]; });
    b.list = b.list.concat(hidden);
    S.pf[h] = b.active || S.pf[h]; save();
    return { init: withBody(init, b) };
  }

  async function migrateAndSave(d) {
    var m = migrateCust(JSON.parse(JSON.stringify(d)));
    try {
      var r2 = await realFetch("/api/portfolios", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: m.active, rev: m.rev, list: m.list, customers: m.customers }) });
      if (r2.ok) { var j = await r2.json(); if (j && Array.isArray(j.list)) return j; }
    } catch (e) { }
    return m; /* chưa ghi được: vẫn hiển thị đã tách; lần lưu kế tiếp sẽ ghi */
  }
  W.fetch = async function (input, init) {
    var url = typeof input === "string" ? input : input instanceof URL ? input.href : null, u;
    if (url == null) return realFetch(input, init);
    try { u = new URL(url, location.href); } catch (e) { return realFetch(input, init); }
    if (u.origin !== location.origin || u.pathname.indexOf("/api/") !== 0) return realFetch(input, init);
    var p = u.pathname, method = String((init && init.method) || "GET").toUpperCase();
    if (method === "PUT" && p === "/api/watchlist") {
      var wb = bodyOf(init), prevW = {}; (RAW.wl || []).forEach(function (x) { prevW[x] = 1; });
      var badW = wb && Array.isArray(wb.symbols) ? whyNotList(wb.symbols.filter(function (x) { return !prevW[x]; })) : [];
      if (badW.length) return refuse(S.cur, badW, "mã theo dõi");
      init = mergeWatch(init);
    }
    else if ((method === "POST" || method === "PUT") && /^\/api\/alerts\/rules(\/|$)/.test(p)) {
      var ab = bodyOf(init), sy = ab && (ab.sym || ab.symbol), wa = sy ? whyNot(sy) : "";
      if (wa) return refuse(S.cur, [wa], "cảnh báo");
    }
    else if (method === "PUT" && p === "/api/portfolios") { var g = guardPf(init); if (g.err) return jres({ error: g.err, code: "HOUSE_MISMATCH" }, 400); init = g.init; }
    var res = await realFetch(input, init);
    var scoped = (method === "GET" && /^\/api\/(state|overview|symbols|alerts|alerts\/events|history\/feed)$/.test(p)) ||
      ((method === "GET" || method === "PUT") && p === "/api/portfolios") || (method === "PUT" && p === "/api/watchlist");
    if (!scoped) return res;
    var txt; try { txt = await res.text(); } catch (e) { return res; }
    var d; try { d = JSON.parse(txt); } catch (e) { return jres({ error: "Phản hồi không hợp lệ" }, res.status || 500); }
    try {
      if (p === "/api/state") d = scopeState(d);
      else if (p === "/api/overview") d = scopeOverview(d);
      else if (p === "/api/symbols") d = scopeSymbols(d);
      else if (p === "/api/portfolios") { if (method === "GET" && needsMig(d)) d = await migrateAndSave(d); d = scopePf(d); }
      else if (p === "/api/watchlist") { if (Array.isArray(d.watchlist)) { RAW.wl = d.watchlist.slice(); d.watchlist = d.watchlist.filter(function (s) { return inHouse(s); }); } }
      else if (p === "/api/history/feed") d = scopeFeed(d);
      else d = walk(d);
    } catch (e) { console.error("NHIP house:", e); }
    return jres(d, res.status);
  };

  /* ---------- Phiên làm việc: mã đang xem phải thuộc nhà đang đứng ---------- */
  function rememberSym() { try { var v = W.sessionStorage.getItem("sym"); if (v && !isIndexSym(v) && houseOf(v) === S.cur) S.last[S.cur] = v; } catch (e) { } }
  function homeSym(h) { return S.last[h] && houseOf(S.last[h]) === h ? S.last[h] : DEF[h]; }
  function fixSession() {
    try {
      ["sym", "analysisSym"].forEach(function (k) { var v = W.sessionStorage.getItem(k); if (!v || houseOf(v) !== S.cur) W.sessionStorage.setItem(k, homeSym(S.cur)); });
      var l = W.localStorage.getItem("nhip.trade.lastsym"); if (l && houseOf(l) !== S.cur) W.localStorage.setItem("nhip.trade.lastsym", homeSym(S.cur));
    } catch (e) { }
  }
  function fixHash() {
    var h = location.hash || "", m = /([?&]s=)([A-Za-z0-9.]+)/.exec(h);
    if (m && houseOf(m[2]) !== S.cur) { try { history.replaceState(null, "", h.replace(m[0], m[1] + homeSym(S.cur))); } catch (e) { } }
  }

  /* ---------- Giao diện ---------- */
  function apply() {
    D.documentElement.dataset.house = S.cur;
    var st = D.getElementById("nhStrip"); if (!st) return;
    st.querySelectorAll("[data-nh]").forEach(function (b) { var on = b.dataset.nh === S.cur; b.classList.toggle("on", on); b.setAttribute("aria-selected", on ? "true" : "false"); });
    var n = st.querySelector(".nh-note"); if (n) n.innerHTML = "Đang ở <b>nhà " + NM[S.cur] + "</b> — chỉ hiện mã, danh mục, lệnh, cảnh báo của " + NM[S.cur];
  }
  function mount() {
    if (D.getElementById("nhStrip")) return;
    var tb = D.querySelector(".topbar"), sh = D.querySelector(".shell"); if (!tb || !sh) return;
    var st = D.createElement("div"); st.id = "nhStrip"; st.className = "nh-strip";
    st.innerHTML = '<div class="nh-tabs" role="tablist" aria-label="Chọn nhà (sàn giao dịch)">' + HS.map(function (h) {
      return '<button type="button" role="tab" class="nh-t nh-' + h + '" data-nh="' + h + '" title="' + FULLNM[h] + '"><b>' + NM[h] + '</b><small>' + SUB[h] + '</small></button>';
    }).join("") + '</div><div class="nh-note"></div>';
    tb.parentNode.insertBefore(st, sh);
    st.addEventListener("click", function (e) { var b = e.target.closest("[data-nh]"); if (b) set(b.dataset.nh); });
    apply();
  }

  /* ---------- Đổi nhà ---------- */
  var busy = false;
  async function set(h, o) {
    o = o || {};
    h = HS.indexOf(String(h || "").toUpperCase()) >= 0 ? String(h).toUpperCase() : "HOSE";
    if (h === S.cur && !o.force) return;
    if (busy) return; busy = true;
    try {
      rememberSym(); S.cur = h; if (o.sym && houseOf(o.sym) === h) S.last[h] = String(o.sym).toUpperCase(); save(); fixSession(); fixHash(); apply();
      try { var r = await W.fetch("/api/state"); var st = await r.json(); if (typeof ST !== "undefined") ST = st; } catch (e) { }
      try { if (typeof PF2 !== "undefined") PF2 = null; } catch (e) { }
      try { W.dispatchEvent(new CustomEvent("nhip:house-changed", { detail: { house: h } })); } catch (e) { }
      if (typeof W.route === "function") W.route();
    } finally { busy = false; }
  }

  /* ---------- v2.26 — CỔNG XEM MÃ SÀN KHÁC ----------
     Không bao giờ hiển thị mã của sàn khác ngay trên sàn đang đứng. Gặp mã sai sàn:
       1) giữ nguyên màn hình hiện tại (mã cũ, đúng sàn);
       2) hỏi: "Mã X thuộc sàn Y — chuyển sang xem?";
       3) Đồng ý → đổi sàn, GIỮ NGUYÊN mục đang xem (Biểu đồ/Phân tích/Giao dịch…) và mở mã X ở sàn Y;
          Không đồng ý → ở lại, trả ô nhập về mã cũ.
     Mã chưa rõ sàn (không có trong danh bạ) không bị đoán/không bị chặn ở đây — việc ghi dữ liệu vẫn do cổng ghi (whyNot) lo. */
  var askOpen = false;
  function routeKey() { return (String(location.hash || "").replace(/^#\/?/, "").split("?")[0]) || ""; }
  function routeLabel() { var r = routeKey(), a = r && D.querySelector('.nav[data-r="' + r + '"] span'); return a ? a.textContent.trim() : ""; }
  function wrongHouse(sym) {
    var k = String(sym || "").toUpperCase().trim();
    if (!isSymLike(k)) return "";
    if (!isIndexSym(k) && !exKnownSym(k)) return "";
    var at = houseOf(k); return at && at !== S.cur ? at : "";
  }
  /* Đổi sàn + mở đúng mã ở sàn đó, giữ nguyên mục đang xem */
  function goHouse(at, k) {
    rememberSym();
    try { W.sessionStorage.setItem("sym", k); W.sessionStorage.setItem("analysisSym", k); if (!isIndexSym(k)) W.localStorage.setItem("nhip.trade.lastsym", k); } catch (e) { }
    var h = location.hash || "";
    if (/([?&]s=)[A-Za-z0-9.]+/.test(h)) { try { history.replaceState(null, "", h.replace(/([?&]s=)[A-Za-z0-9.]+/, "$1" + k)); } catch (e) { } }
    return set(at, { sym: k });
  }
  /* ask: hiện hộp thoại; trả Promise<true|false> (true = đã chuyển sàn) */
  function ask(k, at, o) {
    if (askOpen) return Promise.resolve(false);
    askOpen = true;
    var lb = routeLabel(), cur = S.cur;
    var spec = {
      tone: "warn", icon: "chart",
      title: "Mã " + k + " thuộc sàn " + NM[at],
      message: "Bạn đang làm việc ở sàn " + NM[cur] + ". Mã " + k + " không có trên sàn này nên không thể hiển thị tại đây." +
        " Nếu đồng ý, ứng dụng sẽ chuyển sang sàn " + NM[at] + (o && o.aiText ? " và Nhịp AI sẽ làm việc với mã " + k + " ở sàn " + NM[at] : lb ? " và mở mục “" + lb + "” của mã " + k : " và mở mã " + k) + ".",
      note: { tone: "info", text: "Dữ liệu từng sàn được giữ riêng. Chuyển sàn không xóa hay gộp gì." },
      okText: "Chuyển sang " + NM[at], cancelText: "Ở lại " + NM[cur]
    };
    var P = W.NhipDlg && W.NhipDlg.confirm ? W.NhipDlg.confirm(spec) : Promise.resolve(W.confirm(spec.title + "\n" + spec.message));
    return Promise.resolve(P).then(function (yes) {
      askOpen = false;
      if (yes) return goHouse(at, k).then(function () { try { if (o && typeof o.onSwitch === "function") o.onSwitch(at, k); } catch (e) { } return true; });
      try { if (o && typeof o.onCancel === "function") o.onCancel(); } catch (e) { }
      return false;
    }, function () { askOpen = false; return false; });
  }
  /* gate(sym, {onCancel, onSwitch, aiText}) → true: mã hợp lệ ở sàn này, cứ tiếp tục. false: đã chặn và đang hỏi — người gọi phải dừng. */
  function gate(sym, o) {
    var at = wrongHouse(sym); if (!at) return true;
    ask(String(sym).toUpperCase().trim(), at, o); return false;
  }

  /* Liên kết/hash tới mã của sàn khác: chặn NGAY (trước khi trang vẽ), trả hash về mã đang đúng sàn rồi mới hỏi.
     Nghe sự kiện này đứng trước bộ định tuyến của app (nạp ở <head>) nên trang không kịp hiện mã sai sàn. */
  function holdHash(k, at) {
    var back = (function () { try { var v = W.sessionStorage.getItem("sym"); return v && houseOf(v) === S.cur && !isIndexSym(v) ? v : homeSym(S.cur); } catch (e) { return homeSym(S.cur); } })();
    try { history.replaceState(null, "", (location.hash || "").replace(/([?&]s=)[A-Za-z0-9.]+/, "$1" + back)); } catch (e) { }
    return back;
  }
  function checkHash() {
    var m = /[?&]s=([A-Za-z0-9.]+)/.exec(location.hash || ""); if (!m || busy) return;
    var k = m[1].toUpperCase(), at = wrongHouse(k); if (!at) return;
    var back = holdHash(k, at);
    ask(k, at, { onCancel: function () { try { W.sessionStorage.setItem("analysisSym", back); } catch (e) { } } });
  }
  W.addEventListener("hashchange", checkHash);
  /* Mở thẳng đường dẫn ?s=… của sàn khác (tải trang / dán link): chặn trước khi vẽ, hỏi sau khi giao diện sẵn sàng */
  (function () {
    var m = /[?&]s=([A-Za-z0-9.]+)/.exec(location.hash || ""); if (!m) return;
    var k = m[1].toUpperCase(), at = wrongHouse(k); if (!at) return;
    holdHash(k, at);
    var go = function () { setTimeout(function () { ask(k, at, {}); }, 400); };
    if (D.readyState === "complete") go(); else W.addEventListener("load", go);
  })();

  /* v2.28 — MÃ/GIÁ MẪU THEO SÀN: mọi ô gợi ý (placeholder), ví dụ, bản xem trước chỉ dùng mã đúng sàn đang đứng.
     Chỉ là ví dụ minh họa (giá không phải giá thị trường). Mỗi mã mẫu phải thuộc đúng sàn của nó (có test kiểm). */
  var SAMPLE = {
    HOSE: { sym: "FPT", sym2: "HPG", sym3: "MWG", idx: "VNINDEX", idx2: "VN30", px: "98500", close: "50000", zone: "120.000–125.000", bizName: "Hòa Phát", biz: "HPG", bizFull: "Tập đoàn Hòa Phát", bizAlias: "Hòa Phát; Hoa Phat Group",
      pv: [["FPT", "126.000", "+1,60%", 1], ["HPG", "25.500", "−0,80%", 0], ["VCB", "92.000", "+0,55%", 1]] },
    HNX: { sym: "SHS", sym2: "PVS", sym3: "MBS", idx: "HNX", idx2: "HNX", px: "15200", close: "15000", zone: "15.000–16.000", bizName: "Chứng khoán Sài Gòn – Hà Nội", biz: "SHS", bizFull: "Chứng khoán SHS", bizAlias: "Chứng khoán Sài Gòn - Hà Nội; Chung khoan Sai Gon Ha Noi",
      pv: [["SHS", "15.200", "+1,20%", 1], ["PVS", "35.800", "−0,60%", 0], ["MBS", "26.400", "+0,40%", 1]] },
    UPCOM: { sym: "ACV", sym2: "OIL", sym3: "QNS", idx: "UPCOM", idx2: "UPCOM", px: "81500", close: "81000", zone: "80.000–84.000", bizName: "Cảng hàng không Việt Nam", biz: "ACV", bizFull: "Cảng hàng không Việt Nam", bizAlias: "ACV; Airports Corporation of Vietnam",
      pv: [["ACV", "81.500", "−0,40%", 0], ["OIL", "11.200", "+0,30%", 1], ["QNS", "48.000", "+0,50%", 1]] }
  };
  function sample(h) { var k = HS.indexOf(h) >= 0 ? h : S.cur; return Object.assign({ ex: k, exName: NM[k] }, SAMPLE[k]); }

  W.NHIPRawFetch = realFetch; /* v2.95 — phòng LIVE gọi dữ liệu GỐC của cả 3 nhà, không bị lọc theo nhà đang đứng bên ngoài */
  W.NHIPHouse = { sample: sample, gate: gate, wrongHouse: wrongHouse, goHouse: goHouse, HOUSES: HS, name: function (h) { return NM[h || S.cur]; }, cur: function () { return S.cur; }, set: set, houseOf: houseOf, inHouse: inHouse, check: whyNot, checkList: whyNotList, homeSym: homeSym, defaults: DEF };
  D.documentElement.dataset.house = S.cur;
  fixSession();
  if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", function () { mount(); fixSession(); }); else { mount(); }
})();
