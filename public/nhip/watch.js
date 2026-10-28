/* NHỊP THEO DÕI — danh sách theo dõi cá nhân trên dữ liệu thật (VNDirect DChart, NHỊP ALERT, RSS). */
(() => {
  const LS = "nhip.watch.v1";
  let P; try { P = JSON.parse(localStorage.getItem(LS) || "{}"); } catch { P = {}; }
  P = { grp: "all", smart: "", sort: "", dir: -1, pct: 3, vol: 2, ...P };
  const saveP = () => { try { localStorage.setItem(LS, JSON.stringify(P)); } catch { } };
  const WM = { groups: [], items: {} };           // nhóm + ghi chú (lưu trên máy chủ)
  let SNAP = { items: [], alerts: {}, news: {}, meta: {} }, open = null, q = "";
  const slug = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").toLowerCase();
  const vol = n => n == null ? "—" : n >= 1e6 ? num(n / 1e6, 2) + " triệu" : n >= 1e3 ? num(n / 1e3, 0) + " nghìn" : num(n, 0);
  const tone = n => n == null || n === 0 ? "" : n < 0 ? "dn" : "up";
  const phien = t => t ? new Date(t * 1000).toISOString().slice(0, 10).split("-").reverse().join("/") : "—";
  const ago = ts => { const m = (Date.now() - ts) / 6e4; return !ts ? "" : m < 60 ? Math.max(1, Math.round(m)) + " phút trước" : m < 1440 ? Math.round(m / 60) + " giờ trước" : Math.round(m / 1440) + " ngày trước"; };
  const rsiTxt = r => r == null ? "—" : num(r, 1) + (r >= 70 ? " · quá mua" : r <= 30 ? " · quá bán" : "");
  const saveMeta = () => api("/api/watch/meta", { method: "PUT", body: { groups: WM.groups, items: WM.items } }).then(d => { WM.groups = d.groups; WM.items = d.items; });
  const item = s => SNAP.items.find(x => x.symbol === s) || null;
  const alOf = s => SNAP.alerts[s] || { rules: 0, active: 0, attention: 0, events24h: 0, unread: 0, list: [] };
  const nmOf = s => { try { return window.NHIPSYM ? window.NHIPSYM.name(s) : ""; } catch (e) { return ""; } };
  const nwOf = s => SNAP.news[s] || { count72h: 0, hasEvent: false, items: [] };
  const hasAlert = s => { const a = alOf(s); return a.events24h > 0 || a.unread > 0; };

  // Nhóm thông minh: điều kiện kiểm tra được, ngưỡng do người dùng chọn.
  const SMART = {
    move: { label: "Biến động mạnh", test: s => { const x = item(s); return x && !x.error && Math.abs(x.pct) >= P.pct; } },
    liq: { label: "Thanh khoản tăng", test: s => { const x = item(s); return x && !x.error && x.volRatio != null && x.volRatio >= P.vol; } },
    alert: { label: "Có cảnh báo", test: hasAlert },
    event: { label: "Có sự kiện mới", test: s => nwOf(s).hasEvent }
  };

  function visible() {
    let list = ST.watchlist.slice();
    if (P.grp !== "all") list = list.filter(s => (WM.items[s]?.g || []).includes(P.grp));
    if (P.smart && SMART[P.smart]) list = list.filter(SMART[P.smart].test);
    if (q) { const k = slug(q); list = list.filter(s => slug(s).includes(k) || slug(item(s)?.sector || "").includes(k)); }
    if (P.sort) {
      const val = s => { const x = item(s) || {}, a = alOf(s); return ({ sym: s, price: x.price, pct: x.pct, vol: x.volume, ratio: x.volRatio, rsi: x.rsi14, al: a.events24h * 100 + a.unread * 10 + a.active })[P.sort]; };
      list.sort((a, b) => { const x = val(a), y = val(b); if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1; return (typeof x === "string" ? x.localeCompare(y) : x - y) * P.dir; });
    }
    return list;
  }

  function kpis() {
    const xs = ST.watchlist.map(item).filter(x => x && !x.error), up = xs.filter(x => x.pct > 0).length, dn = xs.filter(x => x.pct < 0).length;
    const flat = xs.length - up - dn, bad = ST.watchlist.length - xs.length;
    const act = ST.watchlist.reduce((a, s) => a + alOf(s).active, 0), fired = ST.watchlist.filter(hasAlert).length;
    $("#tw-kpi").innerHTML = `<article class="index-card"><span>Tổng số mã</span><strong>${ST.watchlist.length}</strong><small>Tối đa 50 mã${bad ? ` · ${bad} mã chưa tải được` : ""}</small></article>
<article class="index-card"><span>Đang tăng</span><strong class="up">${up}</strong><small>So với nến ngày liền trước</small></article>
<article class="index-card"><span>Đang giảm</span><strong class="dn">${dn}</strong><small>${flat} mã đứng giá</small></article>
<article class="index-card"><span>Cảnh báo đang bật</span><strong>${act}</strong><small>${fired} mã có cảnh báo kích hoạt trong 24 giờ hoặc chưa đọc</small></article>`;
  }

  function chips() {
    const gs = [["all", "Tất cả", ST.watchlist.length], ...WM.groups.map(g => [g.id, g.name, ST.watchlist.filter(s => (WM.items[s]?.g || []).includes(g.id)).length])];
    $("#tw-groups").innerHTML = gs.map(([id, n, c]) => `<button type="button" data-g="${esc(id)}" class="${P.grp === id ? "on" : ""}">${esc(n)} · ${c}</button>`).join("") +
      `<button type="button" id="tw-gnew" class="tw-add">+ Nhóm</button>` +
      (P.grp !== "all" ? `<button type="button" id="tw-gren" class="tw-add">✎ Đổi tên</button><button type="button" id="tw-gdel" class="tw-add">Xóa nhóm</button>` : "");
    $("#tw-smart").innerHTML = Object.entries(SMART).map(([k, v]) => `<button type="button" data-k="${k}" class="${P.smart === k ? "on" : ""}">${v.label} · ${ST.watchlist.filter(v.test).length}</button>`).join("");
    $("#tw-cond").innerHTML = `Điều kiện: biến động ≥ <select id="tw-pct">${[1, 2, 3, 5].map(v => `<option value="${v}" ${P.pct === v ? "selected" : ""}>${v}%</option>`).join("")}</select> · KL/TB20 ≥ <select id="tw-vol">${[1.5, 2, 3].map(v => `<option value="${v}" ${P.vol === v ? "selected" : ""}>${v}×</option>`).join("")}</select> · “Có cảnh báo”: NHỊP ALERT kích hoạt trong 24 giờ hoặc chưa đọc · “Có sự kiện mới”: tiêu đề RSS 72 giờ qua nhắc mã kèm từ khóa BCTC, cổ tức, phát hành, cổ đông lớn… (chưa xác minh).`;
    $$("#tw-groups [data-g]").forEach(b => b.onclick = () => { P.grp = b.dataset.g; saveP(); open = null; paint(); });
    $$("#tw-smart [data-k]").forEach(b => b.onclick = () => { P.smart = P.smart === b.dataset.k ? "" : b.dataset.k; saveP(); open = null; paint(); });
    $("#tw-pct").onchange = e => { P.pct = +e.target.value; saveP(); paint(); };
    $("#tw-vol").onchange = e => { P.vol = +e.target.value; saveP(); paint(); };
    $("#tw-gnew").onclick = async () => {
      if (WM.groups.length >= 10) return toast("Tối đa 10 nhóm", 1);
      const n = ((await NhipDlg.prompt({ title: "Tạo nhóm theo dõi", icon: "folder", label: "Tên nhóm", placeholder: "VD: Ngân hàng", maxLength: 30, hint: "Dùng nhóm để lọc nhanh các mã trong danh sách.", chips: ["Ngân hàng", "Ngắn hạn", "Theo dõi đặc biệt"].map(function (x) { return { label: x, value: x }; }), validate: function (v) { return WM.groups.some(function (g) { return g.name.toLowerCase() === v.toLowerCase(); }) ? "Đã có nhóm tên này." : ""; }, okText: "Tạo nhóm" })) || "").trim().slice(0, 30); if (!n) return;
      const id = Date.now().toString(36); WM.groups.push({ id, name: n }); P.grp = id; saveP();
      try { await saveMeta(); } catch (e) { toast(e.message, 1); } paint();
    };
    if ($("#tw-gren")) {
      $("#tw-gren").onclick = async () => { const g = WM.groups.find(x => x.id === P.grp); const n = ((await NhipDlg.prompt({ title: "Đổi tên nhóm", icon: "edit", label: "Tên mới", value: g?.name || "", maxLength: 30, okText: "Đổi tên" })) || "").trim().slice(0, 30); if (!n || !g) return; g.name = n; try { await saveMeta(); } catch (e) { toast(e.message, 1); } paint(); };
      $("#tw-gdel").onclick = async () => { const g = WM.groups.find(x => x.id === P.grp); if (!g || !(await NhipDlg.confirm({ tone: "danger", icon: "folder", title: "Xóa nhóm này?", subject: g.name, message: "Chỉ nhóm bị xóa, các mã bên trong vẫn nằm trong danh sách theo dõi.", okText: "Xóa nhóm", cancelText: "Giữ lại" }))) return; WM.groups = WM.groups.filter(x => x.id !== g.id); for (const v of Object.values(WM.items)) v.g = (v.g || []).filter(x => x !== g.id); P.grp = "all"; saveP(); try { await saveMeta(); } catch (e) { toast(e.message, 1); } paint(); };
    }
  }

  const TH = [["sym", "Mã", ""], ["price", "Giá (đ)", ""], ["pct", "% đổi", ""], ["vol", "KL khớp", ""], ["ratio", "KL/TB20", "tw-m"], ["rsi", "RSI14", "tw-m"], ["al", "Cảnh báo", ""]];
  function rowHtml(s) {
    const x = item(s), a = alOf(s), n = nwOf(s), note = WM.items[s]?.note, gs = (WM.items[s]?.g || []).map(id => WM.groups.find(g => g.id === id)?.name).filter(Boolean);
    const tags = [];
    Object.entries(SMART).forEach(([k, v]) => { if (v.test(s)) tags.push(`<span class="pill tw-tag">${v.label}</span>`); });
    const alTxt = a.rules ? `<b>${a.active}</b> bật${a.events24h ? ` · <span class="dn">${a.events24h} kích hoạt</span>` : ""}${a.attention ? ` · <span class="muted">${a.attention} cần xem</span>` : ""}` : '<span class="muted">—</span>';
    const main = !x || x.error
      ? `<td><b>${esc(s)}</b>${nmOf(s) ? `<br><small class="muted">${esc(nmOf(s))}</small>` : ""}</td><td colspan="5"><span class="dn">${esc(x?.error || "Chưa có dữ liệu")}</span></td>`
      : `<td><b>${esc(s)}</b>${nmOf(s) ? `<br><small class="muted">${esc(nmOf(s))}</small>` : ""}${x.sector ? `<br><small class="muted">${esc(x.sector)}</small>` : ""}${gs.length ? `<br><small class="muted">${esc(gs.join(", "))}</small>` : ""}</td>
<td>${px(s, x.price)}</td><td class="${tone(x.pct)}">${pc(x.pct)}</td><td>${vol(x.volume)}</td><td class="tw-m">${x.volRatio == null ? "—" : num(x.volRatio, 2) + "×"}</td><td class="tw-m">${x.rsi14 == null ? "—" : num(x.rsi14, 1)}</td>`;
    return `<tr class="go ${open === s ? "tw-open" : ""}" data-s="${esc(s)}">${main}<td>${alTxt}${note ? ' <span title="Có ghi chú">📝</span>' : ""}${tags.length ? `<div class="tw-tags">${tags.join("")}</div>` : ""}</td></tr>${open === s ? `<tr class="tw-dr"><td colspan="7">${detail(s)}</td></tr>` : ""}`;
  }

  function detail(s) {
    const x = item(s), a = alOf(s), n = nwOf(s), m = WM.items[s] || {};
    if (!x || x.error) return `<p class="muted">Không có dữ liệu giá cho ${esc(s)}: ${esc(x?.error || "")}</p><div class="row"><button class="btn secondary" data-act="rm">Xóa khỏi danh sách</button></div>`;
    const up = x.pct >= 0, cell = (k, v, t = "") => `<div class="tw-st"><span>${k}</span><b class="${t}">${v}</b></div>`;
    const px_ = v => v == null ? "—" : px(s, v);
    const macd = x.macd == null || x.macdSignal == null ? "—" : (x.macd > x.macdSignal ? "MACD trên Signal" : "MACD dưới Signal");
    const rules = a.list.length ? a.list.map(r => `<div class="sg-row"><span>${esc(r.title)}</span><span class="muted">${r.on ? ({ ok: "Đang theo dõi", stale: "Dữ liệu trễ", error: "Lỗi nguồn", review: "Cần xem xét", pending: "Chờ kiểm tra" })[r.status] || "Đang bật" : "Đã tắt"}</span></div>`).join("") : '<p class="muted">Chưa có cảnh báo cho mã này.</p>';
    const news = n.items.length ? n.items.map(t => `<div class="tw-news"><a href="${esc(t.link)}" target="_blank" rel="noopener noreferrer">${esc(t.title)}</a><small class="muted">${esc(t.source || "RSS")}${t.ts ? " · " + ago(t.ts) : ""}${t.event ? " · có từ khóa sự kiện" : ""}</small></div>`).join("") : `<p class="muted">${SNAP.meta.newsError ? "Không tải được RSS: " + esc(SNAP.meta.newsError) : "Không có tin RSS nào nhắc mã này trong nguồn hiện tải."}</p>`;
    const gchk = WM.groups.length ? WM.groups.map(g => `<label class="tw-chk"><input type="checkbox" data-gid="${esc(g.id)}" ${(m.g || []).includes(g.id) ? "checked" : ""}> ${esc(g.name)}</label>`).join("") : '<small class="muted">Chưa có nhóm — bấm “+ Nhóm” phía trên.</small>';
    return `<div class="tw-detail">
<div class="tw-dh"><div><b class="tw-big">${px(s, x.price)}</b> <span class="${tone(x.pct)}">${pc(x.pct)} (${x.change > 0 ? "+" : ""}${num(x.change, 2)})</span><br><small class="muted">Nến ngày ${phien(x.candleTime)} · VNDirect DChart · không đảm bảo realtime</small></div><div class="tw-sp">${spark(x.spark, up)}<small class="muted">30 phiên</small></div></div>
<div class="tw-grid">${cell("Khối lượng", vol(x.volume))}${cell("KL/TB20", x.volRatio == null ? "—" : num(x.volRatio, 2) + "×")}${cell("RSI14", rsiTxt(x.rsi14))}${cell("SMA20", px_(x.sma20))}${cell("SMA50", px_(x.sma50))}${cell("MACD", macd)}${cell("Đáy 20 phiên", px_(x.support20))}${cell("Đỉnh 20 phiên", px_(x.resistance20))}</div>
<div class="row tw-act"><a class="btn pale" href="#/tong-quan?s=${encodeURIComponent(s)}">📈 Biểu đồ</a><a class="btn pale" href="#/phan-tich?s=${encodeURIComponent(s)}">🔬 Phân tích</a><a class="btn pale" href="#/canh-bao?s=${encodeURIComponent(s)}">🔔 Tạo cảnh báo</a><button type="button" class="btn pale" data-act="ai">✦ Phân tích AI</button><button type="button" class="btn secondary" data-act="rm">Xóa khỏi danh sách</button></div>
<div class="tw-cols"><div><div class="eyebrow">CẢNH BÁO CỦA MÃ</div>${rules}</div><div><div class="eyebrow">TIN RSS NHẮC MÃ</div>${news}<p class="source-note">Khớp theo mã hoặc tên doanh nghiệp trong tiêu đề/mô tả RSS (nếu RSS chung chưa có, Nhịp Đầu Tư tìm riêng theo mã qua Google News); chưa xác minh liên quan trực tiếp tới doanh nghiệp.</p></div></div>
<div class="eyebrow">NHÓM</div><div class="tw-gchk">${gchk}</div>
<div class="eyebrow">GHI CHÚ CÁ NHÂN</div><textarea id="tw-note" maxlength="600" rows="3" placeholder="Lý do đưa mã vào danh sách, luận điểm cần kiểm chứng…">${esc(m.note || "")}</textarea>
<div class="row"><input id="tw-zone" maxlength="80" placeholder="Vùng giá quan tâm (VD: ${(()=>{const x=window.NHIPHouse&&NHIPHouse.sample&&NHIPHouse.sample();return x?x.zone:'120.000–125.000'})()})" value="${esc(m.zone || "")}"><button type="button" class="btn primary" data-act="save">Lưu ghi chú</button></div></div>`;
  }

  function bindRows() {
    $$("#tw-body tr.go").forEach(r => r.onclick = e => { if (e.target.closest("a,button")) return; const s = r.dataset.s; open = open === s ? null : s; paint(true); });
    $$("#tw-body [data-gid]").forEach(c => c.onchange = async () => {
      const s = open, e = WM.items[s] = WM.items[s] || { g: [], note: "", zone: "" }; e.g = e.g || [];
      e.g = c.checked ? [...new Set([...e.g, c.dataset.gid])] : e.g.filter(x => x !== c.dataset.gid);
      try { await saveMeta(); } catch (er) { toast(er.message, 1); } paint(true);
    });
    $$("#tw-body [data-act]").forEach(b => b.onclick = async () => {
      const s = open, act = b.dataset.act;
      if (act === "rm") { if (!(await NhipDlg.confirm({ tone: "danger", icon: "star", title: "Xóa khỏi Theo dõi?", subject: s, message: "Mã này sẽ không còn xuất hiện trong danh sách theo dõi của bạn.", okText: "Xóa khỏi Theo dõi", cancelText: "Giữ lại" }))) return; ST.watchlist = ST.watchlist.filter(x => x !== s); open = null; try { await saveWatch(); await saveMeta(); } catch (e) { toast(e.message, 1); } paint(); }
      if (act === "save") { const e = WM.items[s] = WM.items[s] || { g: [], note: "", zone: "" }; e.note = $("#tw-note").value.trim().slice(0, 600); e.zone = $("#tw-zone").value.trim().slice(0, 80); try { await saveMeta(); toast("Đã lưu ghi chú"); } catch (er) { toast(er.message, 1); } paint(true); }
      if (act === "ai") { sessionStorage.pending = JSON.stringify({ symbol: s, question: `Tóm tắt diễn biến ${s} từ dữ liệu nến và chỉ báo thực có sẵn, nêu dữ liệu đáng chú ý, rủi ro cần kiểm tra và các điều kiện cần theo dõi tiếp. Nêu nguồn và giới hạn dữ liệu; không khuyến nghị mua/bán.`, withNews: 1 }); location.hash = "#/ai"; }
    });
  }

  function paint(keepScroll) {
    const y = scrollY; kpis(); chips();
    const list = visible();
    $("#tw-count").textContent = `Hiển thị ${list.length}/${ST.watchlist.length} mã`;
    const head = TH.map(([k, t, c]) => `<th class="s ${c}" data-o="${k}">${t}${P.sort === k ? (P.dir < 0 ? " ▼" : " ▲") : ""}</th>`).join("");
    $("#tw-list").innerHTML = ST.watchlist.length
      ? `<table class="tbl tw-tbl"><tr>${head}</tr><tbody id="tw-body">${list.map(rowHtml).join("") || '<tr><td colspan="7" class="muted" style="text-align:left">Không có mã nào thỏa bộ lọc hiện tại.</td></tr>'}</tbody></table>`
      : '<p class="muted">Chưa có mã nào. Nhập mã (VD: ' + (function(){var x=window.NHIPHouse&&NHIPHouse.sample&&NHIPHouse.sample();return x?x.sym3:'MWG'})() + ') vào ô phía trên để bắt đầu theo dõi.</p>';
    $$("#tw-list th[data-o]").forEach(h => h.onclick = () => { const k = h.dataset.o; if (P.sort === k) P.dir *= -1; else { P.sort = k; P.dir = k === "sym" ? 1 : -1; } saveP(); paint(); });
    bindRows(); if (keepScroll) scrollTo(0, y);
    const m = SNAP.meta || {};
    $("#tw-src").textContent = `Nguồn giá: ${m.source || "VNDirect DChart"} · tải lúc ${m.fetchedAt ? dt(m.fetchedAt) : "—"}${m.newsSource ? " · tin: " + m.newsSource + (m.newsStale ? " (bản lưu cũ)" : "") : ""}. ${m.note || ""}`;
  }

  async function refresh(ok) {
    if (!ST.watchlist.length) { SNAP = { items: [], alerts: {}, news: {}, meta: {} }; return paint(); }
    $("#tw-status").textContent = "Đang tải dữ liệu thật…";
    try {
      const d = await api("/api/watch/snapshot?symbols=" + encodeURIComponent(ST.watchlist.join(",")));
      if (!ok()) return; SNAP = d; $("#tw-status").textContent = ""; paint();
    } catch (e) { if (ok()) $("#tw-status").innerHTML = err(e, "Không tải được dữ liệu"); }
  }

  window.vTheoDoi = async function () {
    const ok = mine();
    view(`<div class="view-h"><div><div class="eyebrow">NHỊP THEO DÕI</div><h1>${hico("theo-doi")}Theo dõi</h1><p class="muted">Danh sách cá nhân của bạn: biến động, thanh khoản, cảnh báo và tin liên quan trên dữ liệu thật.</p></div></div>
<section id="tw-kpi" class="cards dashboard-kpis"></section>
<section class="panel"><form id="tw-form" class="row"><input id="tw-in" placeholder="Thêm mã (VD: ${(()=>{const x=window.NHIPHouse&&NHIPHouse.sample&&NHIPHouse.sample();return x?x.sym3:'MWG'})()})" maxlength="12" autocomplete="off" required><button class="btn pale">+ Thêm</button><input id="tw-q" type="search" placeholder="Lọc theo mã hoặc ngành trong danh sách" autocomplete="off" style="flex:1;min-width:180px"></form>
<div id="tw-groups" class="chips tf"></div><div class="eyebrow">NHÓM THÔNG MINH</div><div id="tw-smart" class="chips tf"></div><p id="tw-cond" class="source-note"></p></section>
<section class="panel"><div class="panelhead"><div><div class="eyebrow">DANH SÁCH THEO DÕI</div><p class="panel-sub" id="tw-count"></p></div><button id="tw-reload" type="button" class="btn secondary">↻ Tải lại giá</button></div><div id="tw-status" class="muted"></div><div id="tw-list" class="tw"><p class="muted">Đang tải…</p></div><p id="tw-src" class="source-note"></p><p class="source-note">Nhóm thông minh chỉ lọc theo điều kiện có thể kiểm tra; mã tăng mạnh hay thanh khoản cao không đồng nghĩa là cơ hội mua. Không phải khuyến nghị đầu tư.</p></section>`);
    try { const m = await api("/api/watch/meta"); WM.groups = m.groups || []; WM.items = m.items || {}; } catch { }
    if (!ok()) return;
    if (P.grp !== "all" && !WM.groups.some(g => g.id === P.grp)) P.grp = "all";
    open = null; q = "";
    $("#tw-form").onsubmit = async e => {
      e.preventDefault(); const s = $("#tw-in").value.trim().toUpperCase();
      if (!/^[A-Z0-9.]{2,12}$/.test(s)) return toast("Mã không hợp lệ", 1);
      if (ST.watchlist.includes(s)) return toast(`${s} đã có trong danh sách`, 1);
      if (ST.watchlist.length >= 50) return toast("Tối đa 50 mã", 1);
      const b = e.submitter || $("#tw-form button"); b.disabled = true;
      try {
        const d = await api("/api/watch/snapshot?symbols=" + s), it = d.items[0];
        if (!it || it.error) { toast(`Không có dữ liệu cho mã ${s}; chưa thêm vào danh sách.`, 1); b.disabled = false; return; }
        ST.watchlist.unshift(s); await saveWatch(); $("#tw-in").value = ""; open = s; SNAP.items.push(it); SNAP.alerts[s] = d.alerts[s]; SNAP.news[s] = d.news[s]; if (!SNAP.meta.fetchedAt) SNAP.meta = d.meta;
      } catch (er) { toast(er.message, 1); b.disabled = false; return; }
      b.disabled = false; if (ok()) paint();
    };
    $("#tw-q").oninput = e => { q = e.target.value.trim(); open = null; paint(); };
    $("#tw-reload").onclick = () => refresh(ok);
    paint(); refresh(ok);
  };
})();
