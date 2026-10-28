/* NHIP · Phân tích: dải chất lượng dữ liệu, tổng hợp kỹ thuật có công thức, đồng bộ bố cục theo tài khoản. */
window.NHIPQ = (function () {
  var E = function (s) { return esc(s == null ? "" : s); }, T = null, pulled = false;
  function quality(d) {
    var q = d.quality, m = d.meta || {}; if (!q) return E(m.source || "Nguồn không rõ") + " · lấy lúc " + dt(m.fetchedAt);
    var f = q.freshness || {}, ch = function (c, t) { return '<span class="qchip ' + c + '">' + E(t) + "</span>"; }, is = q.issues || {};
    var fl = f.level === "fresh" ? ch("ok", "Dữ liệu mới") : f.level === "delayed" ? ch("warn", "Dữ liệu trễ") : ch("bad", "Dữ liệu cũ");
    var ss = q.session && q.session.state === "open" ? ch("ok", q.session.label) : ch("mid", (q.session || {}).label || "");
    return '<div class="qchips">' + (q.forming ? ch("warn", "Nến cuối đang hình thành") : ch("ok", "Nến cuối đã đóng")) + ss + fl + "</div><div class=\"qline\">" + E(m.source || "Nguồn không rõ") + " · lấy lúc " + E(dt(m.fetchedAt)) + (m.cached ? " · cache" : "") + " · nến cuối " + E(q.lastCandle.dateVN + " " + q.lastCandle.clockVN) + " (giờ VN)</div>"
      + (f.level !== "fresh" ? '<div class="qline qwarn">' + E(f.message) + "</div>" : "") + (is.dropped || is.duplicates ? '<div class="qline qwarn">Đã loại ' + (is.dropped || 0) + " nến lỗi và " + (is.duplicates || 0) + " bản ghi trùng từ nguồn.</div>" : "");
  }
  function tech(t) {
    if (!t) return '<p class="muted">Chưa đủ nến để tổng hợp.</p>';
    var cls = { up: "upb", down: "dnb", mid: "mid" }, g = {}, order = [];
    t.items.forEach(function (x) { if (!g[x.group]) { g[x.group] = []; order.push(x.group); } g[x.group].push(x); });
    return '<div class="tq-tally"><span class="sg upb">' + t.tally.up + " tăng</span><span class=\"sg mid\">" + t.tally.mid + " trung lập</span><span class=\"sg dnb\">" + t.tally.down + " giảm</span></div>"
      + order.map(function (k) { return '<div class="tq-group">' + E(k) + "</div>" + g[k].map(function (x) { return '<details class="tq-row"><summary><span>' + E(x.label) + '</span><span class="sg ' + cls[x.signal] + '">' + E(x.text) + '</span></summary><div class="tq-more"><div><b>Công thức:</b> ' + E(x.formula) + '</div><div><b>Số liệu:</b> ' + Object.keys(x.inputs || {}).map(function (i) { return E(i) + " = " + E(x.inputs[i]); }).join(" · ") + "</div></div></details>"; }).join(""); }).join("")
      + '<p class="source-note">' + E(t.basis.note) + " " + E(t.note) + "</p>";
  }
  function aiExtra(o) {
    var vv = o.verification && !o.verification.ok ? ["Số liệu chưa đối chiếu được với dữ liệu hệ thống: " + o.verification.unverified.join(", ") + ". Hãy kiểm tra trước khi dùng."] : [], w = (o.warnings || []).concat(vv).map(function (x) { return "<li>" + E(x) + "</li>"; }).join("");
    return (w ? '<ul class="qwarnbox">' + w + "</ul>" : "") + (o.inputs ? '<details class="tq-more"><summary>Dữ liệu đầu vào AI đã nhận (' + E(o.inputs.candles) + " nến, " + E(o.inputs.resolution) + ")</summary><pre class=\"tq-pre\">" + E(o.inputs.context) + "</pre></details>" : "");
  }
  function pull(p) {
    if (pulled) return Promise.resolve(); pulled = true;
    return fetch("/api/prefs/analysis").then(function (r) { return r.ok ? r.json() : {}; }).then(function (s) { if (s && s.layouts) p.layouts = Object.assign({}, s.layouts, p.layouts || {}); if (s && s.up && !p.up) p.up = s.up; if (s && s.down && !p.down) p.down = s.down; }).catch(function () { });
  }
  function sync(p) { clearTimeout(T); T = setTimeout(function () { fetch("/api/prefs/analysis", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ layouts: p.layouts, up: p.up, down: p.down }) }).catch(function () { }); }, 800); }
  return { quality: quality, tech: tech, aiExtra: aiExtra, pull: pull, sync: sync };
})();
