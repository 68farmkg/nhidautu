/* NHIP Fundamentals v1.0 (V2.81) — NẠP TỰ ĐỘNG chỉ số cơ bản (P/E, P/B, EPS, ROE, ROA) rồi chấm "điểm cộng cơ bản" THEO SÀN.
   Vì sao có file này: trước V2.81 chỉ số cơ bản chỉ tải khi người dùng mở khối "Chỉ số cơ bản" ở tab Bằng chứng, nên không thể dùng để tính điểm.
   Nay: ensure(mã) tự tải (5 chỉ tiêu qua /proxy/finfo), lưu cache 12 giờ trong trình duyệt, gộp yêu cầu trùng, giới hạn số yêu cầu chạy song song;
   preload(danh sách mã) nạp trước cả rổ. Điểm chỉ được tính SAU KHI nạp xong (NHIPPlus.evaluate gọi ensure trước).
   Điểm cộng cơ bản: tối đa +10, chỉ dương (không trừ điểm). Ngưỡng theo từng sàn là NGƯỠNG KHỞI ĐIỂM, calibrated:false — chưa được kiểm chứng ngoài mẫu như RSIx/Fade2.
   Thiếu dữ liệu ≠ điểm xấu: < 3/5 chỉ tiêu → không chấm (ready:false), điểm cộng = 0 và ghi rõ lý do.
   Lõi thuần, chạy được trong Node (fetch/localStorage được tiêm khi kiểm thử). */
(function (W) {
  "use strict";
  var KEY = "nhip.fund.v2", TTL = 12 * 3600e3, ERR_TTL = 10 * 60e3, SYM_CONC = 2, MAX_BONUS = 10, MIN_METRICS = 3;
  /* mã chỉ tiêu VNDirect (giữ đúng 5 mã mà tab Bằng chứng đã dùng từ V2.49) */
  var CODES = [["PRICE_TO_EARNINGS", "pe"], ["PRICE_TO_BOOK", "pb"], ["EPS_TR", "eps"], ["ROAE_TR_AVG5Q", "roe"], ["ROAA_TR_AVG5Q", "roa"]];
  var LABELS = { pe: "P/E", pb: "P/B", eps: "EPS", roe: "ROE", roa: "ROA" };
  /* Ngưỡng theo sàn: [tốt, chấp nhận được]. P/E, P/B: càng thấp càng tốt (≤). ROE, ROA: càng cao càng tốt (≥).
     HNX/UPCoM: định giá chặt hơn (thanh khoản thấp, rủi ro cao hơn) nhưng ngưỡng sinh lời dễ hơn một chút vì doanh nghiệp nhỏ. */
  var BANDS = {
    HOSE: { pe: [15, 22], pb: [1.8, 3], roe: [15, 10], roa: [6, 3] },
    HNX: { pe: [12, 18], pb: [1.2, 2], roe: [12, 8], roa: [5, 2.5] },
    UPCOM: { pe: [12, 18], pb: [1.2, 2], roe: [12, 8], roa: [5, 2.5] }
  };
  var BANK_ROA = [1.5, 1], BANK_PB = [2, 1.2]; /* ngân hàng/bảo hiểm: đòn bẩy cao nên ROA thấp, P/B lệch */
  var MAXPTS = { pe: 3, pb: 2, roe: 3, roa: 2 };
  var FIN_IND = /ngân hàng|bảo hiểm/i;

  var MEM = {}, INFL = {}, QUEUE = [], RUN = 0, FETCH = null, STORE = null, NOW = null;
  function now() { return NOW != null ? NOW : Date.now(); }
  function fin(v) { return typeof v === "number" && isFinite(v); }
  function store() { if (STORE) return STORE; try { return W.localStorage || null; } catch (e) { return null; } }
  function load() { try { var s = store(), j = s && JSON.parse(s.getItem(KEY) || "{}"); if (j && typeof j === "object") MEM = j; } catch (e) { MEM = MEM || {}; } }
  function save() { try { var s = store(); if (!s) return; var k = Object.keys(MEM); if (k.length > 400) k.sort(function (a, b) { return (MEM[a].at || 0) - (MEM[b].at || 0); }).slice(0, k.length - 400).forEach(function (x) { delete MEM[x]; }); s.setItem(KEY, JSON.stringify(MEM)); } catch (e) { } }
  load();

  /* ---------- ngành (từ danh bạ symbols-vn.js: cột 5) ---------- */
  var IND = null;
  function industryOf(sym) {
    if (!IND) { IND = {}; try { String(W.NHIP_SYMBOLS_VN || "").split("\n").forEach(function (l) { var p = l.replace(/^\s*"/, "").replace(/",?\s*$/, "").split("|"); if (p[0] && p[4]) IND[p[0].trim().toUpperCase()] = p[4].trim(); }); } catch (e) { } }
    return IND[String(sym || "").toUpperCase()] || "";
  }

  /* ---------- tải ---------- */
  function doFetch(url) { var f = FETCH || (typeof W.fetch === "function" ? W.fetch.bind(W) : null); if (!f) return Promise.reject(new Error("Không có fetch")); return f(url, { headers: { Accept: "application/json" } }); }
  function getOne(sym, def) {
    var url = "/proxy/finfo?" + new URLSearchParams({ endpoint: "ratios", q: "code:" + sym + "~ratioCode:" + def[0], size: "1", sort: "reportDate:desc" });
    return doFetch(url).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }).then(function (j) {
      var row = (Array.isArray(j && j.data) ? j.data : [])[0] || {}, raw = row.value != null ? row.value : row.ratioValue != null ? row.ratioValue : row.value1, v = raw == null || raw === "" ? null : Number(raw);
      return { k: def[1], v: isFinite(v) ? v : null, date: row.reportDate || row.fiscalDate || "" };
    });
  }
  /* ROE/ROA: nguồn trả dạng phân số (0,152) → đổi sang %; giữ đúng cách xử lý đã dùng ở tab Bằng chứng (|x| ≤ 1 → nhân 100) */
  function toPct(v) { return fin(v) ? (Math.abs(v) <= 1 ? v * 100 : v) : null; }
  function fetchSym(sym) {
    return Promise.all(CODES.map(function (d) { return getOne(sym, d).catch(function (e) { return { k: d[1], v: null, date: "", err: String(e && e.message || e) }; }); })).then(function (rows) {
      var v = {}, date = {}, errs = 0, okN = 0;
      rows.forEach(function (r) {
        var x = r.k === "roe" || r.k === "roa" ? toPct(r.v) : r.v;
        v[r.k] = fin(x) ? x : null; date[r.k] = r.date || ""; if (r.err) errs++; if (fin(x)) okN++;
      });
      return { at: now(), n: okN, v: v, date: date, status: okN >= MIN_METRICS ? "ok" : okN ? "partial" : errs ? "error" : "empty" };
    });
  }
  function pump() {
    while (RUN < SYM_CONC && QUEUE.length) {
      (function (job) {
        RUN++;
        fetchSym(job.sym).then(function (e) { MEM[job.sym] = e; save(); job.res(e); }, function (err) { var e = { at: now(), n: 0, v: {}, date: {}, status: "error", err: String(err && err.message || err) }; MEM[job.sym] = e; job.res(e); })
          .then(function () { RUN--; delete INFL[job.sym]; pump(); notify(job.sym); });
      })(QUEUE.shift());
    }
  }
  var LISTEN = [];
  function notify(sym) { LISTEN.slice().forEach(function (f) { try { f(sym); } catch (e) { } }); }
  function fresh(e) { return !!e && now() - e.at < (e.status === "ok" || e.status === "partial" ? TTL : ERR_TTL); }
  function get(sym) { var e = MEM[String(sym || "").toUpperCase()]; return e || null; }
  /* ensure: trả Promise<entry>. Dùng cache còn hạn; gộp yêu cầu trùng; xếp hàng để không bắn quá nhiều yêu cầu cùng lúc. */
  function ensure(sym, force) {
    sym = String(sym || "").toUpperCase();
    if (!/^[A-Z0-9.]{2,12}$/.test(sym)) return Promise.resolve({ at: now(), n: 0, v: {}, date: {}, status: "error", err: "Mã không hợp lệ" });
    var e = MEM[sym]; if (!force && fresh(e)) return Promise.resolve(e);
    if (INFL[sym]) return INFL[sym];
    var p = new Promise(function (res) { QUEUE.push({ sym: sym, res: res }); });
    INFL[sym] = p; pump(); return p;
  }
  /* preload: nạp trước một danh sách mã; onProgress(done,total,sym) sau MỖI mã xong. Không bao giờ reject. */
  function preload(syms, onProgress) {
    var list = (syms || []).map(function (s) { return String(s || "").toUpperCase(); }).filter(function (s, i, a) { return s && a.indexOf(s) === i; }), done = 0;
    return Promise.all(list.map(function (s) { return ensure(s).then(function (e) { done++; if (onProgress) try { onProgress(done, list.length, s); } catch (x) { } return e; }); })).then(function (all) { return { total: list.length, ok: all.filter(function (e) { return e.status === "ok"; }).length, entries: all }; });
  }

  /* ---------- chấm điểm cộng cơ bản theo sàn ---------- */
  function tierLow(v, b) { return v > 0 && v <= b[0] ? 2 : v > 0 && v <= b[1] ? 1 : 0; } /* 2 = tốt, 1 = chấp nhận, 0 = không */
  function tierHigh(v, b) { return v >= b[0] ? 2 : v >= b[1] ? 1 : 0; }
  function txt(k, v) { return !fin(v) ? "—" : k === "roe" || k === "roa" ? v.toLocaleString("vi-VN", { maximumFractionDigits: 1 }) + "%" : k === "eps" ? Math.round(v).toLocaleString("vi-VN") + " ₫" : v.toLocaleString("vi-VN", { maximumFractionDigits: 1 }) + "x"; }
  function rate(entry, ex, sym) {
    var B = ex && BANDS[ex];
    if (!B) return { ready: false, bonus: 0, max: MAX_BONUS, reason: "Chưa rõ sàn nên chưa có ngưỡng để chấm." };
    if (!entry) return { ready: false, pending: true, bonus: 0, max: MAX_BONUS, reason: "Chưa nạp chỉ số cơ bản." };
    var v = entry.v || {}, have = ["pe", "pb", "eps", "roe", "roa"].filter(function (k) { return fin(v[k]); }).length;
    if (have < MIN_METRICS) return { ready: false, bonus: 0, max: MAX_BONUS, reason: "Chỉ có " + have + "/5 chỉ tiêu (cần ≥ " + MIN_METRICS + ") nên không chấm — thiếu dữ liệu không bị coi là xấu.", have: have, status: entry.status };
    var ind = industryOf(sym), fi = FIN_IND.test(ind), bands = { pe: B.pe, pb: fi ? BANK_PB : B.pb, roe: B.roe, roa: fi ? BANK_ROA : B.roa };
    var flags = [], parts = [], got = 0, avail = 0;
    var loss = (fin(v.eps) && v.eps <= 0) || (fin(v.pe) && v.pe <= 0);
    if (loss) flags.push("Lỗ (EPS/P/E ≤ 0)");
    if (fin(v.roe) && v.roe < 0) flags.push("ROE âm");
    if (fin(v.pe) && v.pe > 40) flags.push("P/E rất cao (> 40x)");
    if (fin(v.pb) && v.pb > 5) flags.push("P/B rất cao (> 5x)");
    ["pe", "pb", "roe", "roa"].forEach(function (k) {
      var x = v[k]; if (!fin(x)) { parts.push({ k: k, label: LABELS[k], text: "—", pts: 0, max: MAXPTS[k], tier: null }); return; }
      var t = k === "pe" || k === "pb" ? tierLow(x, bands[k]) : tierHigh(x, bands[k]), pts = t === 2 ? MAXPTS[k] : t === 1 ? MAXPTS[k] / 2 : 0;
      avail += MAXPTS[k]; got += pts;
      parts.push({ k: k, label: LABELS[k], text: txt(k, x), pts: pts, max: MAXPTS[k], tier: t, band: bands[k], date: entry.date && entry.date[k] || "" });
    });
    parts.splice(2, 0, { k: "eps", label: "EPS", text: txt("eps", v.eps), pts: 0, max: 0, tier: null, date: entry.date && entry.date.eps || "", note: "dùng để loại mã lỗ, không cộng điểm" });
    var raw = avail ? got / avail * MAX_BONUS : 0, bonus = loss ? 0 : Math.round(raw * 2) / 2; /* làm tròn 0,5; mã đang lỗ → không cộng */
    return { ready: true, bonus: bonus, max: MAX_BONUS, parts: parts, flags: flags, have: have, financial: fi, industry: ind, exchange: ex, calibrated: false,
      date: entry.date && (entry.date.roe || entry.date.pe || entry.date.eps) || "", capped: loss ? "Mã đang lỗ nên điểm cộng cơ bản = 0." : "" };
  }

  W.NHIPFund = {
    version: "1.0", CODES: CODES, BANDS: BANDS, MAX_BONUS: MAX_BONUS, MIN_METRICS: MIN_METRICS, LABELS: LABELS,
    ensure: ensure, preload: preload, get: get, rate: rate, industryOf: industryOf, fresh: fresh,
    onUpdate: function (f) { LISTEN.push(f); return function () { LISTEN = LISTEN.filter(function (x) { return x !== f; }); }; },
    _t: { setFetch: function (f) { FETCH = f; }, setStore: function (s) { STORE = s; MEM = {}; load(); }, setNow: function (ms) { NOW = ms; }, reset: function () { MEM = {}; INFL = {}; QUEUE = []; RUN = 0; LISTEN = []; IND = null; }, mem: function () { return MEM; }, toPct: toPct }
  };
})(typeof window !== "undefined" ? window : this);
