/* NHIP Dividends v1.0 (V2.89) — TỰ LẤY LỊCH CỔ TỨC / CỔ PHIẾU THƯỞNG VÀ TỰ TÍNH QUYỀN CHO ĐÚNG DANH MỤC.
   Nguyên tắc (thị trường Việt Nam, T+2):
   1) Chỉ xét MÃ đang/đã nằm trong danh mục của khách đang chọn, và chỉ khi mã đó thuộc SÀN của danh mục.
   2) Quyền cổ tức = số cp còn giữ sau mọi giao dịch có ngày TRƯỚC ngày giao dịch không hưởng quyền (GDKHQ).
      Mua từ ngày GDKHQ trở đi: không có quyền. Bán từ ngày GDKHQ trở đi: vẫn giữ quyền (cp bán T+2 vẫn nằm trong danh sách chốt).
   3) Cổ tức tiền: thực nhận = SL × đ/cp − thuế TNCN 5%. Cổ phiếu: làm tròn xuống số nguyên, không thuế khi nhận.
   4) Đến ngày thanh toán (và đã qua GDKHQ) thì tự ghi nhận vào danh mục (có thể tắt). Chưa có ngày thanh toán thì để "chờ về".
   Nguồn dữ liệu: VNDirect FinInfo (qua /proxy/finfo, endpoint events). Cấu trúc trả về được đọc theo kiểu "chịu lỗi" (nhiều tên trường khả dĩ);
   nếu nguồn không trả dữ liệu thì không làm gì và giao diện báo rõ để nhập tay.
   Lõi thuần: chạy được trong Node (fetch/sessionStorage được tiêm khi kiểm thử). */
(function (W) {
  "use strict";
  var PAR = 10000, TAX = 5, TTL = 30 * 60e3, CONC = 3, KEY = "nhip.divfeed.v1", HOUSES = ["HOSE", "HNX", "UPCOM"];

  var norm = function (s) { return String(s == null ? "" : s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase(); };
  var vnNum = function (s) {
    s = String(s == null ? "" : s).replace(/\s/g, "");
    if (!s) return NaN;
    if (/^\d{1,3}([.,]\d{3})+$/.test(s)) return Number(s.replace(/[.,]/g, ""));
    return Number(s.replace(",", "."));
  };
  var iso = function (v) {
    if (v == null || v === "") return "";
    var s = String(v).trim(), m;
    if ((m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s))) return m[1] + "-" + m[2] + "-" + m[3];
    if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s))) return m[3] + "-" + ("0" + m[2]).slice(-2) + "-" + ("0" + m[1]).slice(-2);
    return "";
  };
  var addDays = function (d, n) { var t = new Date(d + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
  var prevBiz = function (d) { var x = addDays(d, -1), w = new Date(x + "T00:00:00Z").getUTCDay(); if (w === 0) x = addDays(x, -2); else if (w === 6) x = addDays(x, -1); return x; };
  var house = function (v) {
    var s = String(v || "").toUpperCase().replace(/[^A-Z]/g, "");
    if (s === "HOSE" || s === "HSX" || s === "HCM") return "HOSE";
    if (s === "HNX" || s === "HASTC") return "HNX";
    if (s === "UPCOM" || s === "UPCOM") return "UPCOM";
    return "";
  };
  var first = function (r, names) { for (var i = 0; i < names.length; i++) { var d = iso(r[names[i]]); if (d) return d; } return ""; };

  /* ---- 1) Đọc một dòng sự kiện thô → 0..2 quyền (tiền và/hoặc cổ phiếu) ---- */
  function parseRow(r, sym) {
    if (!r || typeof r !== "object") return [];
    var code = String(r.code || r.symbol || r.ticker || sym || "").toUpperCase();
    if (sym && code && code !== sym) return [];
    var loc = String(r.locale || "").toUpperCase();
    var TXT = ["eventName", "eventTitle", "title", "content", "note", "description", "name", "purpose", "eventCode", "eventType", "type", "ratio", "issueRatio"];
    var raw = TXT.map(function (k) { return r[k] == null ? "" : String(r[k]); }).filter(Boolean).join(" ; ");
    var n = norm(raw);
    var isDiv = /co tuc|chia co tuc|tra co tuc|tam ung co tuc/.test(n), isBonus = /co phieu thuong|thuong bang co phieu|\bthuong\b.*co phieu/.test(n);
    if (!isDiv && !isBonus) return [];
    var ex = first(r, ["actualExrightDate", "exrightDate", "exRightDate", "exDate", "gdkhqDate"]);
    var rec = first(r, ["actualRecordDate", "recordDate", "registerDate", "lastRegisterDate"]);
    var pay = first(r, ["actualPaymentDate", "paymentDate", "payDate", "issueDate"]);
    var exEst = false;
    if (!ex && rec) { ex = prevBiz(rec); exEst = true; }
    if (!ex) return [];
    var fl = house(r.floor || r.exchange || r.market || r.exchangeCode);
    var name = raw.replace(/\s+/g, " ").slice(0, 100);
    var warn = /quyen mua|chao ban cho co dong hien huu|phat hanh them|esop/.test(n) ? "Thông báo có kèm quyền mua/phát hành thêm — chỉ tính phần cổ tức, hãy đối chiếu thông báo gốc" : "";
    var out = [], seen = {};
    var push = function (kind, per, ratio) {
      var k = sym + "|" + ex + "|" + kind + "|" + Math.round(kind === "cash" ? per : ratio * 100);
      if (seen[k]) return; seen[k] = 1;
      out.push({ key: k.slice(0, 80), symbol: sym || code, kind: kind, per: kind === "cash" ? per : 0, ratio: kind === "stock" ? ratio : 0, exDate: ex, recDate: rec, payDate: pay, exEst: exEst, floor: fl, name: name, warn: warn, locale: loc });
    };
    var hasCash = /(co tuc|bang|tra|chia|tam ung)\s+tien\b|tien mat/.test(n), hasStock = /bang co phieu|co phieu thuong|thuong bang co phieu|chia co phieu/.test(n);
    var m, any = false, assumed = false;
    /* a) số tiền cụ thể: 1.000 đồng/cp */
    var rx1 = /(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?)\s*(?:dong|d|vnd|vnd)\s*\/\s*(?:cp|co phieu|cphieu)/g;
    while ((m = rx1.exec(n))) { var v = vnNum(m[1]); if (v > 0 && v < 1e7) { push("cash", v, 0); any = true; } }
    /* b) số trường số sẵn có */
    ["dividendPerShare", "cashPerShare", "dividendAmount", "cashDividend"].forEach(function (k) { var v = Number(r[k]); if (!any && v > 0 && v < 1e7) { push("cash", v, 0); any = true; } });
    /* c) a:b (a cp cũ nhận b cp mới) → luôn là cổ phiếu */
    var rx2 = /(\d+(?:[.,]\d+)?)\s*:\s*(\d+(?:[.,]\d+)?)/g;
    while ((m = rx2.exec(n))) { var a = vnNum(m[1]), b = vnNum(m[2]); if (a > 0 && b > 0 && !/quyen mua/.test(n.slice(Math.max(0, m.index - 40), m.index))) { push("stock", 0, +(b / a * 100).toFixed(4)); any = true; } }
    /* d) phần trăm: gán loại theo từ khóa đi liền sau (hoặc loại duy nhất của thông báo) */
    var rx3 = /(\d+(?:[.,]\d+)?)\s*%/g;
    while ((m = rx3.exec(n))) {
      var p = vnNum(m[1]); if (!(p > 0)) continue;
      var bw = n.slice(Math.max(0, m.index - 32), m.index), cut = Math.max(bw.lastIndexOf("%"), bw.lastIndexOf(";")); if (cut >= 0) bw = bw.slice(cut + 1);
      bw = bw.replace(/(\s|ty le|la|:|,|voi)+$/, "");
      var w = n.slice(m.index + m[0].length, m.index + m[0].length + 45), it = w.search(/bang tien|tien mat|\btien\b/), is = w.search(/bang co phieu|co phieu/), kind = "";
      if (/(bang tien|tien mat|co tuc tien)$/.test(bw)) kind = "cash"; else if (/(bang co phieu|co phieu)$/.test(bw)) kind = "stock";
      else if (it >= 0 && (is < 0 || it < is)) kind = "cash"; else if (is >= 0) kind = "stock"; else if (hasCash && !hasStock) kind = "cash"; else if (hasStock && !hasCash) kind = "stock"; else if (!hasStock) { kind = "cash"; assumed = true; }
      if (kind === "cash") { var per = +(p * PAR / 100).toFixed(2); if (!out.some(function (o) { return o.kind === "cash" && Math.abs(o.per - per) < 1; })) { push("cash", per, 0); any = true; } }
      else if (kind === "stock") { if (!out.some(function (o) { return o.kind === "stock" && Math.abs(o.ratio - p) < 1e-6; })) { push("stock", 0, p); any = true; } }
    }
    if (assumed) out.forEach(function (o) { if (o.kind === "cash" && !o.warn) o.warn = "Thông báo không nêu rõ hình thức — giả định cổ tức bằng tiền, hãy đối chiếu"; });
    return any ? out : [];
  }

  /* ---- 2) Số cp được hưởng quyền: còn giữ sau mọi giao dịch có ngày < GDKHQ ---- */
  function heldBefore(p, sym, ex, today) {
    var tx = (p.tx || []).filter(function (t) { return t.symbol === sym && t.date; });
    var pos = (p.positions || []).find(function (x) { return x.symbol === sym; });
    if (!tx.length) return pos && ex >= today ? { qty: pos.qty, legacy: true, since: "" } : { qty: 0, legacy: false, since: "" };
    var L = tx.slice().reverse().map(function (t, i) { return { t: t, i: i }; }).sort(function (a, b) { return a.t.date < b.t.date ? -1 : a.t.date > b.t.date ? 1 : a.i - b.i; });
    var q = 0, since = "";
    L.forEach(function (o) {
      var t = o.t, d = t.date; if (!(d < ex)) return;
      var n = +t.qty || 0;
      if (t.type === "buy" || t.type === "sdiv") { q += n; if (!since && n > 0) since = d; }
      else if (t.type === "pos") { if (t.note === "Xóa vị thế") q = 0; else { q += n; if (!since && n > 0) since = d; } }
      else if (t.type === "sell") q = Math.max(0, q - n);
    });
    return { qty: Math.max(0, q), legacy: false, since: since };
  }
  var firstDate = function (p, sym) {
    var ds = (p.tx || []).filter(function (t) { return t.symbol === sym && t.date && (t.type === "buy" || t.type === "pos" || t.type === "sdiv") && (+t.qty || 0) > 0; }).map(function (t) { return t.date; }).sort();
    return ds[0] || "";
  };
  var symbolsOf = function (p) {
    var s = {};
    (p.positions || []).forEach(function (x) { s[x.symbol] = 1; });
    (p.tx || []).forEach(function (t) { if (t.symbol && (t.type === "buy" || t.type === "sell" || t.type === "pos" || t.type === "sdiv")) s[t.symbol] = 1; });
    return Object.keys(s).filter(function (k) { return /^[A-Z0-9.]{2,12}$/.test(k); });
  };

  /* ---- 3) Tải sự kiện theo mã (cache 30 phút, chịu lỗi, thử 2 kiểu truy vấn) ---- */
  var mem = {};
  var store = function () { try { return W.sessionStorage || null; } catch (e) { return null; } };
  var cacheGet = function (sym) {
    var m = mem[sym]; if (m && Date.now() - m.t < TTL) return m;
    var st = store(); if (!st) return null;
    try { var o = JSON.parse(st.getItem(KEY + "." + sym) || "null"); if (o && Date.now() - o.t < TTL) { mem[sym] = o; return o; } } catch (e) {}
    return null;
  };
  var cachePut = function (sym, o) { mem[sym] = o; var st = store(); if (st) try { st.setItem(KEY + "." + sym, JSON.stringify(o)); } catch (e) {} };
  var rowsOf = function (j) { return Array.isArray(j) ? j : (j && (j.data || j.content || j.items || j.result)) || []; };
  async function fetchSym(sym, fetchFn, force) {
    if (!force) { var c = cacheGet(sym); if (c) return c; }
    var tries = [
      { endpoint: "events", q: "code:" + sym + "~locale:VN", sort: "effectiveDate:desc", size: "100" },
      { endpoint: "events", q: "code:" + sym, size: "300" }
    ], lastErr = "";
    for (var i = 0; i < tries.length; i++) {
      try {
        var r = await fetchFn("/proxy/finfo?" + new URLSearchParams(tries[i]).toString());
        if (!r || !r.ok) { lastErr = "HTTP " + (r && r.status); continue; }
        var rows = rowsOf(await r.json());
        if (!Array.isArray(rows)) { lastErr = "Định dạng không nhận ra"; continue; }
        var ev = [], seen = {};
        rows.forEach(function (row) { parseRow(row, sym).forEach(function (e) { if (!seen[e.key]) { seen[e.key] = 1; ev.push(e); } }); });
        var o = { t: Date.now(), ok: true, n: rows.length, ev: ev };
        if (rows.length || i === tries.length - 1) { cachePut(sym, o); return o; }
      } catch (e) { lastErr = String(e && e.message || e); }
    }
    return { t: Date.now(), ok: false, n: 0, ev: [], err: lastErr || "Không tải được" };
  }

  /* ---- 4) Đồng bộ: cập nhật p.divEv theo nguồn, đúng mã – đúng sàn – đúng thời điểm nắm giữ ---- */
  async function sync(p, o) {
    o = o || {};
    var today = o.today || new Date().toISOString().slice(0, 10), fetchFn = o.fetch || W.fetch.bind(W);
    var rep = { changed: false, syms: 0, fetched: 0, rows: 0, added: 0, updated: 0, removed: 0, settled: 0, stale: 0, skipped: [], failed: [], settleErr: [] };
    p.divEv = p.divEv || [];
    var ph = house(o.house), syms = symbolsOf(p);
    rep.syms = syms.length;
    var pool = syms.slice(), res = {};
    await Promise.all(new Array(Math.min(CONC, pool.length)).fill(0).map(async function () {
      while (pool.length) { var s = pool.shift(); res[s] = await fetchSym(s, fetchFn, o.force); }
    }));
    var add = function (e, why) { rep.skipped.push({ symbol: e.symbol, exDate: e.exDate, kind: e.kind, per: e.per, ratio: e.ratio, why: why, name: e.name }); };
    syms.forEach(function (sym) {
      var R = res[sym];
      if (!R || !R.ok) { rep.failed.push(sym); return; }
      rep.fetched++; rep.rows += R.n;
      var hs = o.houseOf ? house(o.houseOf(sym)) : "";
      var live = {};
      R.ev.forEach(function (e) {
        var fl = e.floor || hs;
        if (ph && fl && fl !== ph) return add(e, "Mã thuộc sàn " + fl + ", danh mục này thuộc sàn " + ph);
        var fd = firstDate(p, sym), H = heldBefore(p, sym, e.exDate, today);
        var ex = (p.divEv || []).find(function (x) { return x.key === e.key || (x.symbol === sym && x.kind === e.kind && x.exDate && x.exDate === e.exDate && (e.kind === "cash" ? Math.abs((+x.per || 0) - e.per) < 1 : Math.abs((+x.ratio || 0) - e.ratio) < 1e-6)); });
        if (ex) {
          live[ex.id] = 1;
          if (!ex.auto) return;
          if (ex.status === "pending") {
            var ch = false, set = function (k, v) { if (ex[k] !== v) { ex[k] = v; ch = true; } };
            if (!ex.qtyLock) { if (H.qty > 0) set("qty", H.qty); }
            set("recDate", e.recDate || ex.recDate || ""); set("payDate", e.payDate || ex.payDate || ""); set("exDate", e.exDate);
            if (ex.stale) { delete ex.stale; ch = true; }
            if (ch) { rep.updated++; rep.changed = true; }
          }
          return;
        }
        if (!(H.qty > 0)) return add(e, fd && e.exDate < fd ? "GDKHQ " + e.exDate + " trước ngày bắt đầu nắm giữ (" + fd + ")" : e.exDate < today ? "Không còn giữ cổ phiếu trước ngày GDKHQ " + e.exDate : "Chưa giữ cổ phiếu (phải mua trước GDKHQ " + e.exDate + " mới có quyền)");
        var ev = { id: (o.uid ? o.uid() : Date.now().toString(36) + Math.random().toString(36).slice(2, 5)), symbol: sym, kind: e.kind, per: e.per, ratio: e.ratio, qty: H.qty, taxPct: e.kind === "cash" ? TAX : 0, exDate: e.exDate, recDate: e.recDate, payDate: e.payDate, status: "pending", txId: "", note: "", auto: true, key: e.key, src: "VNDirect", floor: e.floor || hs, name: e.name };
        if (e.exEst) ev.exEst = true; if (e.warn) ev.warn = e.warn; if (H.legacy) ev.warn = (ev.warn ? ev.warn + "; " : "") + "Chưa rõ ngày mua — lấy số đang giữ, hãy kiểm tra";
        p.divEv.push(ev); live[ev.id] = 1; rep.added++; rep.changed = true;
      });
      /* quyền tự động đang chờ nhưng nguồn không còn → cảnh báo; SL về 0 → bỏ */
      (p.divEv || []).slice().forEach(function (x) {
        if (x.symbol !== sym || !x.auto || x.status !== "pending" || live[x.id]) return;
        if (!x.stale) { x.stale = true; rep.changed = true; }
        rep.stale++;
      });
    });
    /* quyền tự động chờ mà SL tính lại = 0 (đã bán hết trước GDKHQ…) → loại */
    var keep = [];
    p.divEv.forEach(function (x) {
      if (x.auto && x.status === "pending" && !x.qtyLock) { var H = heldBefore(p, x.symbol, x.exDate || today, today); if (!(H.qty > 0) && !H.legacy) { rep.removed++; rep.changed = true; return; } }
      keep.push(x);
    });
    p.divEv = keep;
    /* tự ghi nhận khi đã GDKHQ và đến ngày thanh toán */
    if (o.settle && p.settings && p.settings.divAuto !== false) {
      p.divEv.filter(function (x) { return x.status === "pending" && x.auto && !x.stale && x.exDate && x.exDate <= today && x.payDate && x.payDate <= today && (+x.qty || 0) > 0; })
        .sort(function (a, b) { return (a.payDate || "").localeCompare(b.payDate || ""); })
        .forEach(function (x) { var m = o.settle(p, x); if (m) rep.settleErr.push(x.symbol + ": " + m); else { rep.settled++; rep.changed = true; } });
    }
    return rep;
  }

  var api = { sync: sync, parseRow: parseRow, heldBefore: heldBefore, firstDate: firstDate, symbolsOf: symbolsOf, prevBiz: prevBiz, house: house, _mem: mem, PAR: PAR, TAX: TAX };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else W.NHIPDiv = api;
})(typeof window !== "undefined" ? window : globalThis);
