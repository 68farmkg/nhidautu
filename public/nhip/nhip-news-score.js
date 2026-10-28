/* NHIP NewsScore v1.0 (V2.81) — ĐIỂM CỘNG TỪ TIN, đúng mã và đúng sàn.
   Dùng chính bộ lọc tin sẵn có của NHIP (/api/news?symbol=… đã qua SYMD.verify: tiêu đề phải nhắc đúng doanh nghiệp và không ghi sàn khác).
   Ở đây lọc thêm 3 lớp để KHÔNG lẫn tin giữa các mã/sàn:
     1) bỏ tin "tin sàn …"/related (tin chung của sàn, không phải tin riêng của mã) và tin gom từ tìm kiếm theo sàn (viaExchange);
     2) chỉ nhận bài có it.syms chứa đúng mã; nếu bài gắn sàn (it.floor / it.fl) khác sàn của mã trong danh bạ → loại và đếm riêng;
     3) bỏ bài trùng tiêu đề; chỉ tính bài trong 30 ngày, bài càng mới trọng số càng lớn.
   Cực tính tin = từ khóa tiếng Việt (KHÔNG phải hiểu ngữ nghĩa) → có thể sai; vì vậy điểm cộng chỉ tối đa +5, chỉ dương, và hiện rõ từng bài đã tính.
   Tin xấu (cực tính ròng ≤ −0,9 hoặc có từ khóa nghiêm trọng trong 14 ngày) → điểm cộng tin = 0 và gắn cờ đỏ. Không có tin trực tiếp = trung tính (0), không phải xấu.
   calibrated:false — ngưỡng khởi điểm, chưa kiểm chứng ngoài mẫu. Lõi thuần, chạy được trong Node. */
(function (W) {
  "use strict";
  var TTL = 10 * 60e3, MAX_BONUS = 5, CACHE = {}, INFL = {}, FETCH = null, NOW = null, LISTEN = [];
  function now() { return NOW != null ? NOW : Date.now(); }
  function fin(v) { return typeof v === "number" && isFinite(v); }
  /* từ khóa: biên từ theo chữ Unicode để "lỗ" không khớp "lỗ hổng", "lãi" không khớp "lãi suất" ở mức từ ghép khác */
  function R(list) { return new RegExp("(?<![\\p{L}\\p{N}])(?:" + list.join("|") + ")(?![\\p{L}\\p{N}])", "iu"); }
  var POS = R(["lãi (ròng )?(tăng|kỷ lục|vượt|gấp)", "lợi nhuận (\\S+ ){0,2}(tăng|vượt|kỷ lục|cải thiện|bứt phá|tăng trưởng)", "doanh thu (\\S+ ){0,2}(tăng|vượt|kỷ lục)", "vượt (kế hoạch|dự báo|kỳ vọng)",
    "tăng trưởng (mạnh|hai chữ số|tích cực|vượt)", "(chia|trả|tạm ứng) cổ tức", "cổ tức (tiền mặt|bằng tiền)", "trúng thầu", "ký (kết )?hợp đồng", "hợp tác chiến lược",
    "nâng (dự phóng|giá mục tiêu|khuyến nghị)", "khuyến nghị (mua|khả quan)", "mua lại cổ phiếu quỹ", "cổ đông (lớn )?(mua|đăng ký mua)", "(lãnh đạo|ban lãnh đạo) (mua|đăng ký mua)"]);
  var NEG = R(["lỗ", "lỗ (ròng|quý|năm)", "lợi nhuận (\\S+ ){0,2}(giảm|sụt|âm|lao dốc)", "doanh thu (\\S+ ){0,2}(giảm|sụt)", "(bị )?xử phạt", "bị phạt", "đình chỉ", "cảnh báo", "(bị )?kiểm soát đặc biệt", "hạn chế giao dịch",
    "tạm ngừng giao dịch", "hủy niêm yết", "chậm (nộp|công bố)", "khởi tố", "bắt tạm giam", "nợ xấu (tăng|gia tăng)", "vi phạm", "thanh tra", "khuyến nghị bán", "hạ (dự phóng|giá mục tiêu|khuyến nghị)",
    "cổ đông (lớn )?(bán|đăng ký bán)", "(lãnh đạo|ban lãnh đạo) (bán|đăng ký bán)", "bán (ra )?(mạnh|toàn bộ|hết)", "phá sản", "ngừng hoạt động", "mất vốn"]);
  var SEV = R(["đình chỉ", "khởi tố", "bắt tạm giam", "hủy niêm yết", "phá sản", "tạm ngừng giao dịch", "kiểm soát đặc biệt"]);
  var NOT_LOSS = /(?:(?:không|hết|thoát|xóa|bù|khắc phục|vượt qua)\s+lỗ|lỗ hổng)/giu; /* "thoát lỗ", "không lỗ" là tin tốt, không phải từ khóa xấu */

  function normEx(v) { var s = String(v == null ? "" : v).toUpperCase().replace(/[^A-Z]/g, ""); return s === "HOSE" || s === "HSX" || s === "HOSTC" ? "HOSE" : s === "HNX" || s === "HASTC" ? "HNX" : s === "UPCOM" ? "UPCOM" : ""; }
  function classify(title) {
    var t = String(title || ""), tl = t.replace(NOT_LOSS, " "), p = POS.test(tl), n = NEG.test(tl), sev = SEV.test(tl);
    return { pol: sev ? -2 : p && n ? 0 : p ? 1 : n ? -1 : 0, mixed: p && n && !sev, sev: sev };
  }
  function wAge(days) { return days <= 3 ? 1 : days <= 7 ? 0.8 : days <= 14 ? 0.5 : days <= 30 ? 0.25 : 0; }
  function key(t) { return String(t || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().slice(0, 70); }

  /* items: mảng tin của /api/news?symbol=…; sym, ex (HOSE/HNX/UPCOM hoặc ""). Trả {ready, bonus, …}. */
  function rate(items, sym, ex, nowMs) {
    sym = String(sym || "").toUpperCase(); nowMs = nowMs != null ? nowMs : now();
    if (!ex) return { ready: false, bonus: 0, max: MAX_BONUS, reason: "Chưa rõ sàn nên không thể bảo đảm tin đúng sàn." };
    if (!Array.isArray(items)) return { ready: false, pending: true, bonus: 0, max: MAX_BONUS, reason: "Chưa nạp tin." };
    var seen = {}, rows = [], skip = { related: 0, notSym: 0, wrongFloor: 0, old: 0, dup: 0 };
    items.forEach(function (it) {
      if (!it) return;
      if (it.related || it.viaExchange || /tin sàn/i.test(it.source || "")) { skip.related++; return; }
      if (!Array.isArray(it.syms) || it.syms.indexOf(sym) < 0) { skip.notSym++; return; }
      var fl = it.floor ? [normEx(it.floor)] : Array.isArray(it.fl) ? it.fl.map(normEx) : [];
      if (fl.length && fl.filter(Boolean).length && fl.indexOf(ex) < 0) { skip.wrongFloor++; return; }
      var k = key(it.title); if (!k || seen[k]) { skip.dup++; return; } seen[k] = 1;
      var ms = Date.parse(it.date), days = isFinite(ms) ? Math.max(0, (nowMs - ms) / 86400e3) : 14, w = wAge(days);
      if (!w) { skip.old++; return; }
      var c = classify(it.title); rows.push({ title: String(it.title || ""), link: it.link || "", source: it.source || "", date: it.date || "", days: days, w: w, pol: c.pol, mixed: c.mixed, sev: c.sev });
    });
    var net = 0, posN = 0, negN = 0, sevRecent = false;
    rows.forEach(function (r) { net += r.w * r.pol; if (r.pol > 0) posN++; if (r.pol < 0) negN++; if (r.sev && r.days <= 14) sevRecent = true; });
    net = Math.round(net * 100) / 100;
    var bad = net <= -0.9 || sevRecent, bonus = bad ? 0 : net >= 2 ? 5 : net >= 1.2 ? 3 : net >= 0.6 ? 2 : 0;
    if (bonus > 2 && posN < 2) bonus = 2; /* một bài tốt không đủ để cộng quá 2 */
    rows.sort(function (a, b) { return a.days - b.days; });
    return { ready: true, bonus: bonus, max: MAX_BONUS, net: net, n: rows.length, pos: posN, neg: negN, bad: bad, sev: sevRecent, rows: rows, skipped: skip, exchange: ex, calibrated: false,
      flags: bad ? [sevRecent ? "Có tin nghiêm trọng trong 14 ngày" : "Tin tiêu cực chiếm ưu thế"] : [], note: rows.length ? "" : "Không có tin nhắc trực tiếp mã này trong 30 ngày (trung tính, không phải xấu)." };
  }

  function doFetch(url) { var f = FETCH || (typeof W.fetch === "function" ? W.fetch.bind(W) : null); if (!f) return Promise.reject(new Error("Không có fetch")); return f(url, { headers: { Accept: "application/json" } }); }
  function fresh(e) { return !!e && now() - e.at < TTL; }
  function get(sym) { return CACHE[String(sym || "").toUpperCase()] || null; }
  function ensure(sym, force) {
    sym = String(sym || "").toUpperCase();
    if (!/^[A-Z0-9.]{2,12}$/.test(sym)) return Promise.resolve({ at: now(), items: null, err: "Mã không hợp lệ" });
    if (!force && fresh(CACHE[sym])) return Promise.resolve(CACHE[sym]);
    if (INFL[sym]) return INFL[sym];
    var p = doFetch("/api/news?symbol=" + encodeURIComponent(sym)).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (j) { return { at: now(), items: Array.isArray(j && j.items) ? j.items : [], meta: j && j.meta || null }; }, function (e) { return { at: now(), items: null, err: String(e && e.message || e) }; })
      .then(function (e) { CACHE[sym] = e; delete INFL[sym]; LISTEN.slice().forEach(function (f) { try { f(sym); } catch (x) { } }); return e; });
    INFL[sym] = p; return p;
  }
  W.NHIPNewsScore = {
    version: "1.0", MAX_BONUS: MAX_BONUS, classify: classify, rate: rate, ensure: ensure, get: get, fresh: fresh,
    onUpdate: function (f) { LISTEN.push(f); return function () { LISTEN = LISTEN.filter(function (x) { return x !== f; }); }; },
    _t: { setFetch: function (f) { FETCH = f; }, setNow: function (ms) { NOW = ms; }, reset: function () { CACHE = {}; INFL = {}; LISTEN = []; } }
  };
})(typeof window !== "undefined" ? window : this);
