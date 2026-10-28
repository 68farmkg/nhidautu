/* NHIP v2.64 — Giá chạy trực tiếp trên biểu đồ (Biểu đồ · Phân tích · Giao dịch dùng chung vCharts).
   Nguyên tắc rút từ các sàn lớn (TradingView, Binance, Investing, Webull):
   1) Tách "tải lịch sử" (nặng, 60 giây/lần) khỏi "nhịp giá" (nhẹ, 3–15 giây/lần chỉ lấy nến 1 phút của HÔM NAY).
   2) Dựng nến đang chạy của MỌI khung (1p…1h, Ngày, Tuần, Tháng, 3T…5N) từ nến 1 phút, chỉ sửa nến cuối (updateData), không vẽ lại toàn bộ.
   3) Làm mượt: giá/cao/thấp của nến cuối trượt ~0,35 giây thay vì nhảy bậc; nháy xanh/đỏ ở giá đầu trang.
   4) Nhịp thích ứng theo giờ giao dịch VN, ẩn tab thì dừng, quay lại thì bắt kịp ngay, lỗi thì giãn nhịp (backoff).
   5) Trung thực: nguồn là VNDirect DChart (hỏi định kỳ, không phải websocket) → luôn hiện độ trễ thực của nến 1 phút cuối, không gọi là realtime.
   Không dữ liệu giả: không có phản hồi hợp lệ thì giữ nguyên nến cũ và báo trạng thái. */
(function (root) {
  "use strict";
  var VN = 7 * 3600, DAY = 86400;

  /* ---------- Giờ giao dịch (giờ Việt Nam, UTC+7) ---------- */
  function vnParts(ms) { var d = new Date(ms + VN * 1000); return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), wd: d.getUTCDay(), min: d.getUTCHours() * 60 + d.getUTCMinutes(), sec: d.getUTCSeconds() }; }
  function vnDayStartSec(ms) { var p = vnParts(ms); return Date.UTC(p.y, p.m, p.d) / 1000 - VN; } /* 00:00 giờ VN của ngày chứa ms, tính bằng giây UTC */
  /* pre: trước 9:00 · am: 9:00–11:30 · lunch: 11:30–13:00 · pm: 13:00–14:45 · post: 14:45–15:00 · closed */
  function sessionState(ms) {
    var p = vnParts(ms); if (p.wd === 0 || p.wd === 6) return "closed";
    var m = p.min; if (m < 540) return "pre"; if (m < 690) return "am"; if (m < 780) return "lunch"; if (m < 885) return "pm"; if (m < 900) return "post"; return "closed";
  }
  /* Nhịp hỏi (ms) theo trạng thái; n = số lần liên tiếp không có gì mới; err = số lỗi liên tiếp */
  function nextDelay(state, n, err) {
    if (err > 0) return Math.min(30000, 3000 * Math.pow(2, Math.min(err, 4)));
    if (state === "am" || state === "pm") return n < 5 ? 3000 : n < 15 ? 5000 : 10000;
    if (state === "post") return 10000;
    if (state === "lunch") return 30000;
    if (state === "pre") return 20000;
    return 120000;
  }

  /* ---------- Dựng nến từ nến 1 phút ---------- */
  /* bars: [{time(giây), open, high, low, close, volume}] sắp tăng dần. res: khung đang xem. last: nến cuối hiện có. Trả { candle, isNew } hoặc null. */
  function periodStart(res, last, t) {
    res = String(res);
    if (/^(1|5|15|30|60)$/.test(res)) { var step = Number(res) * 60; if (t < last.time) return null; return last.time + Math.floor((t - last.time) / step) * step; }
    if (res === "D") { var dd = Math.round((vnDayStartSec(t * 1000) - vnDayStartSec(last.time * 1000)) / DAY); if (dd < 0) return null; return last.time + dd * DAY; }
    var pl = vnParts(last.time * 1000), pt = vnParts(t * 1000);
    if (res === "W") { return t < last.time + 7 * DAY && t >= last.time - DAY ? last.time : -1; }
    var months = res === "M" ? 1 : ({ "3M": 3, "6M": 6, "1Y": 12, "3Y": 36, "5Y": 60 }[res]);
    if (!months) return null;
    var il = pl.y * 12 + pl.m, it = pt.y * 12 + pt.m;
    return Math.floor(il / months) === Math.floor(it / months) ? last.time : -1; /* -1 = sang kỳ mới: để lần tải lịch sử kế tiếp dựng */
  }
  function aggregate(bars, res, last) {
    if (!bars || !bars.length || !last) return null;
    var per = {}, order = [];
    bars.forEach(function (b) { var s = periodStart(res, last, b.time); if (s == null || s < 0) return; if (!per[s]) { per[s] = []; order.push(s); } per[s].push(b); });
    if (!order.length) return null;
    var s = order[order.length - 1], g = per[s], o = g[0].open, h = -Infinity, l = Infinity, v = 0;
    g.forEach(function (b) { if (b.high > h) h = b.high; if (b.low < l) l = b.low; v += b.volume || 0; });
    var c = g[g.length - 1].close, isNew = s > last.time;
    if (!isNew) { /* nến đang có: giữ Mở của nguồn; cao/thấp/KL không bao giờ lùi */
      return { isNew: false, candle: { time: last.time, open: last.open, high: Math.max(last.high, h), low: Math.min(last.low, l), close: c, volume: Math.max(last.volume || 0, v) } };
    }
    return { isNew: true, candle: { time: s, open: o, high: h, low: l, close: c, volume: v } };
  }
  function parseDChart(j) {
    if (!j || j.s !== "ok" || !Array.isArray(j.t) || !Array.isArray(j.c)) return [];
    var out = [], i; for (i = 0; i < j.t.length; i++) { var o = +j.o[i], h = +j.h[i], l = +j.l[i], c = +j.c[i]; if (!isFinite(o + h + l + c) || c <= 0 || h < l) continue; out.push({ time: +j.t[i], open: o, high: h, low: l, close: c, volume: +(j.v && j.v[i]) || 0 }); }
    out.sort(function (a, b) { return a.time - b.time; }); return out;
  }

  var api = { sessionState: sessionState, nextDelay: nextDelay, aggregate: aggregate, parseDChart: parseDChart, periodStart: periodStart, vnDayStartSec: vnDayStartSec };

  /* ---------- Bộ chạy trong trình duyệt ---------- */
  function create(ctx) {
    var S = ctx.S, W = root, doc = W.document, stopped = true, timer = null, tw = null, ticker = null, still = 0, errs = 0, busy = null, lastSig = "", lastBarT = 0, lastOk = 0, state = "closed", overlay = null, lastPx = null, hdrAt = 0;
    var reduce = false; try { reduce = W.matchMedia && W.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { }
    var key = function () { return S.sym + "|" + S.res; }, curKey = "";
    var enabled = function () { try { return localStorage.getItem("nhip.live.off") !== "1"; } catch (e) { return true; } };

    function chip(txt, cls, title) {
      W.NHIPLiveStatus = { txt: txt, cls: cls, title: title || "", ts: Date.now() }; /* v2.65: dòng trạng thái dưới biểu đồ (điện thoại) đọc nhãn này */
      var el = doc.getElementById("nl-chip");
      if (!el) { var MH = W.NHIPMobileHead; if (MH && MH.isMobile(!!doc.querySelector(".cp-embed"))) return; /* điện thoại: nhãn chỉ nằm dưới biểu đồ, không ghi cạnh mã */
        var px = doc.getElementById("cp-px"); if (!px || !px.parentNode) return; el = doc.createElement("span"); el.id = "nl-chip"; px.parentNode.insertBefore(el, px.nextSibling); }
      if (el.textContent !== txt) el.textContent = txt; if (el.className !== "nl-chip " + cls) el.className = "nl-chip " + cls; el.title = title || "";
    }
    function paintChip() {
      if (!enabled()) { chip("Tạm dừng", "off", "Đã tắt giá chạy trực tiếp trong Cài đặt biểu đồ"); return; }
      var age = lastBarT ? Math.max(0, Math.round(Date.now() / 1000 - lastBarT)) : null, ageTxt = age == null ? "" : age < 90 ? age + " giây" : Math.round(age / 60) + " phút";
      var src = "Nguồn VNDirect DChart, hỏi định kỳ (không phải websocket). Độ trễ = tuổi nến 1 phút cuối cùng nhận được.";
      if (errs > 1) chip("Mất kết nối · thử lại", "err", src);
      else if (state === "am" || state === "pm") { var late = age != null && age > 300; chip(late ? "Dữ liệu trễ " + ageTxt : "● Trực tiếp" + (ageTxt ? " · trễ ~" + ageTxt : ""), late ? "warn" : "live", src); }
      else if (state === "lunch") chip("Nghỉ trưa 11:30–13:00", "idle", src);
      else if (state === "pre") chip("Chờ mở cửa 9:00", "idle", src);
      else if (state === "post") chip("Thỏa thuận 14:45–15:00", "idle", src);
      else chip("Đã đóng phiên", "idle", src);
    }

    /* Làm mượt: nội suy nến hiển thị từ (a) tới (b) trong 350ms, chỉ vẽ lại nến cuối */
    function draw(c) { try { S.k.updateData(ctx.toK(c)); } catch (e) { } }
    function tween(from, to) {
      if (tw) { W.cancelAnimationFrame(tw.raf); tw = null; }
      if (reduce || !from || from.time !== to.time || (from.close === to.close && from.high === to.high && from.low === to.low)) { draw(to); return; }
      var t0 = performance.now(), D = 350, lastF = 0, st = { raf: 0 };
      var step = function (now) {
        if (stopped || !S.k) return; var p = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - p, 3);
        if (p < 1 && now - lastF < 40) { st.raf = W.requestAnimationFrame(step); return; } lastF = now; /* ≤ 25 khung/giây: đỡ pin điện thoại */
        var c = p >= 1 ? to : { time: to.time, open: to.open, volume: to.volume, close: from.close + (to.close - from.close) * e, high: from.high + (to.high - from.high) * e, low: from.low + (to.low - from.low) * e };
        if (p < 1) { c.high = Math.max(c.high, c.close); c.low = Math.min(c.low, c.close); }
        draw(c); if (p < 1) st.raf = W.requestAnimationFrame(step); else tw = null;
      };
      tw = st; st.raf = W.requestAnimationFrame(step);
    }

    function flash(up) {
      var b = doc.querySelector("#cp-px .big"); if (!b) return; b.classList.remove("nl-up", "nl-dn"); void b.offsetWidth; b.classList.add(up ? "nl-up" : "nl-dn");
    }
    function apply(res) {
      if (!S.d || !S.d.candles || !S.d.candles.length || !S.k) return;
      var cs = S.d.candles, last = cs[cs.length - 1], r = aggregate(res.bars, S.res, last); if (!r) return;
      var prev = { time: last.time, open: last.open, high: last.high, low: last.low, close: last.close, volume: last.volume };
      var nc = r.candle; if (r.isNew) { cs.push(nc); if (S.data) S.data.push(ctx.toK(nc)); prev = null; } else { Object.assign(last, nc); if (S.data && S.data.length) S.data[S.data.length - 1] = ctx.toK(last); }
      overlay = Object.assign({}, nc);
      var changed = !prev || prev.close !== nc.close || prev.high !== nc.high || prev.low !== nc.low || (prev.volume || 0) !== (nc.volume || 0);
      if (!changed) return;
      still = 0; tween(prev, nc);
      var now = Date.now(); if (now - hdrAt > 800 || r.isNew) { hdrAt = now; try { ctx.drawHeader(); } catch (e) { } }
      if (lastPx != null && nc.close !== lastPx) flash(nc.close > lastPx); lastPx = nc.close;
      try { W.dispatchEvent(new CustomEvent("nhip:live-price", { detail: { symbol: S.sym, price: nc.close * (S.sc || 1), raw: nc.close, time: lastBarT, res: S.res } })); } catch (e) { }
    }
    /* Sau khi tải lịch sử (nến có thể cũ hơn nhịp giá vừa nhận): đắp lại nến trực tiếp, không để giá lùi */
    function reapply() {
      if (!overlay || !S.d || !S.d.candles || !S.d.candles.length || !S.k) return; var cs = S.d.candles, l = cs[cs.length - 1];
      if (l.time === overlay.time) { l.high = Math.max(l.high, overlay.high); l.low = Math.min(l.low, overlay.low); l.volume = Math.max(l.volume || 0, overlay.volume || 0); l.close = overlay.close; draw(l); if (S.data && S.data.length) S.data[S.data.length - 1] = ctx.toK(l); }
      else if (l.time < overlay.time) { cs.push(Object.assign({}, overlay)); if (S.data) S.data.push(ctx.toK(overlay)); draw(overlay); }
    }

    function from() { /* lấy từ 00:00 hôm nay (VN) lùi 1 ngày: đủ bắt nến đầu phiên + qua ngày; khung ngày/tuần/tháng cần phần hôm nay */
      var now = Date.now(); return Math.floor(vnDayStartSec(now) - 6 * 3600);
    }
    async function poll() {
      if (stopped) return; if (!ctx.ok()) { stop(); return; }
      if (!enabled() || doc.hidden || !S.d || !S.k) { schedule(); return; }
      var k0 = key(); if (k0 !== curKey) { curKey = k0; still = 0; errs = 0; lastBarT = 0; overlay = null; lastPx = null; }
      state = sessionState(Date.now());
      if (busy) return; var ac = W.AbortController ? new W.AbortController() : null; busy = ac || true;
      var tmo = setTimeout(function () { try { ac && ac.abort(); } catch (e) { } }, 8000);
      try {
        var now = Math.floor(Date.now() / 1000), u = "/proxy/dchart?" + new URLSearchParams({ symbol: S.sym, resolution: "1", from: String(from()), to: String(now + 60) });
        var r = await fetch(u, ac ? { signal: ac.signal, cache: "no-store" } : { cache: "no-store" }); if (!r.ok) throw new Error("HTTP " + r.status);
        var bars = parseDChart(await r.json()); if (stopped || k0 !== key()) return;
        errs = 0; lastOk = Date.now();
        if (bars.length) { var lb = bars[bars.length - 1]; lastBarT = lb.time; var sig = lb.time + "|" + lb.close + "|" + lb.high + "|" + lb.low + "|" + lb.volume; if (sig === lastSig) still++; else { lastSig = sig; apply({ bars: bars }); } }
        else still++;
      } catch (e) { errs++; } finally { clearTimeout(tmo); busy = null; }
      paintChip(); schedule();
    }
    function schedule() { clearTimeout(timer); if (stopped) return; timer = setTimeout(poll, nextDelay(sessionState(Date.now()), still, errs)); }
    function onVis() { if (stopped) return; if (!doc.hidden) { clearTimeout(timer); still = 0; poll(); } }
    function onOn() { if (!stopped) { errs = 0; clearTimeout(timer); poll(); } }
    function start() {
      if (!stopped) return; stopped = false; curKey = ""; still = 0; errs = 0; doc.addEventListener("visibilitychange", onVis); W.addEventListener("online", onOn); W.addEventListener("focus", onOn);
      ticker = setInterval(function () { if (!doc.hidden && !stopped) paintChip(); }, 1000); /* độ trễ tăng từng giây giữa 2 nhịp hỏi */
      poll();
    }
    function stop() { stopped = true; clearTimeout(timer); clearInterval(ticker); if (tw) { W.cancelAnimationFrame(tw.raf); tw = null; } doc.removeEventListener("visibilitychange", onVis); W.removeEventListener("online", onOn); W.removeEventListener("focus", onOn); var el = doc.getElementById("nl-chip"); if (el && el.parentNode) el.parentNode.removeChild(el); try { delete W.NHIPLiveStatus; } catch (e) { W.NHIPLiveStatus = null; } }
    function setEnabled(on) { try { if (on) localStorage.removeItem("nhip.live.off"); else localStorage.setItem("nhip.live.off", "1"); } catch (e) { } paintChip(); if (on) onOn(); }
    return { start: start, stop: stop, reapply: reapply, setEnabled: setEnabled, isEnabled: enabled };
  }
  api.create = create;
  root.NHIPLive = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
