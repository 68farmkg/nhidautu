/* NHỊP ALERT — giao diện Cảnh báo (#/canh-bao). Bộ xử lý chạy ở máy chủ; trang này chỉ tạo/sửa quy tắc và hiển thị sự kiện.
   Dùng các hàm toàn cục của app.js: $, $$, esc, num, dt, api, view, mine, toast, hico, ST, PREF, ALS, alSave. */
(() => {
  const AL = { rules: [], events: [], summary: null, cat: null, form: null };
  const GN = { A: "A · Cơ bản", B: "B · Kỹ thuật", C: "C · Thanh khoản", D: "D · Sự kiện & rủi ro" };
  const SEEN = "nhip.alerts.srv.seen";
  const byType = id => (AL.cat?.catalog || []).find(t => t.id === id);
  const timeOf = v => v ? new Date(v).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "—";

  async function load() {
    if (!AL.cat) AL.cat = await api("/api/alerts/catalog");
    const d = await api("/api/alerts"); Object.assign(AL, { rules: d.rules, events: d.events, summary: d.summary }); badge();
  }
  function badge() {
    const b = $("#alBadge"), n = AL.summary?.unread || 0; if (!b) return;
    b.hidden = !n; b.textContent = n > 99 ? "99+" : n;
  }
  function ruleStatus(r) {
    const s = r.state?.status;
    if (r.status === "triggered" && !r.on) return ["Đã kích hoạt", "ok"];
    if (!r.on) return ["Tạm tắt", ""];
    if (s === "stale") return ["Dữ liệu trễ", "cool"];
    if (s === "error") return ["Lỗi nguồn dữ liệu", "bad"];
    if (s === "review") return ["Cần xác minh", "cool"];
    if (r.group === "D") return ["Chưa xác minh", "cool"];
    return ["Đang theo dõi", "ok"];
  }

  /* ---------- Các khối giao diện ---------- */
  const kpi = () => { const s = AL.summary || {}, c = (l, v, n) => `<article class="index-card"><div class="eyebrow">${l}</div><div class="big">${String(v ?? 0).padStart(2, "0")}</div><small class="muted">${n}</small></article>`;
    return c("ĐANG THEO DÕI", s.watching, `trên ${s.total || 0} quy tắc`) + c("ĐÃ KÍCH HOẠT HÔM NAY", s.firedToday, "sự kiện đã ghi nhận") + c("CẦN XEM XÉT", s.review, "tin chưa xác minh hoặc dữ liệu trễ"); };
  const status = () => { const s = AL.summary; if (!s) return "";
    return `<b>${esc(s.session.label)}</b> · ${esc(s.session.vnTime)} (giờ VN) · Bộ xử lý chạy trên máy chủ, lần kiểm tra gần nhất: ${s.lastRun ? esc(timeOf(s.lastRun)) : "chưa có"} · Ngoài giờ giao dịch hệ thống kiểm tra thưa hơn. <span class="muted">${esc(s.session.note)}</span>`; };
  const ruleRow = r => { const [lb, k] = ruleStatus(r), st = r.state || {}, d = st.data || {};
    return `<div class="al-rule" data-id="${esc(r.id)}"><div class="al-r-top"><a class="db-symbol" href="#/phan-tich?s=${encodeURIComponent(r.sym)}">${esc(r.sym)}</a><span class="badge ${k}">${lb}</span><span class="pill">${GN[r.group] || r.group}</span></div>
      <div class="al-r-t">${esc(r.title)}</div>
      <small class="muted">${esc(AL.cat?.modes[r.mode] || r.mode)}${r.fires ? ` · đã kích hoạt ${r.fires} lần` : ""}${st.checkedAt ? ` · kiểm tra ${esc(timeOf(st.checkedAt))}` : ""}${st.obs ? `<br>${esc(st.obs)}` : ""}${d.source ? ` · ${esc(d.source)}` : ""}</small>
      ${st.note ? `<div class="al-warn">${esc(st.note)}</div>` : ""}${r.note ? `<small class="muted"><br>${esc(r.note)}</small>` : ""}
      <div class="row al-r-act"><label class="chk"><input type="checkbox" data-on="${esc(r.id)}" ${r.on ? "checked" : ""}> Bật</label><button type="button" class="btn secondary" data-del="${esc(r.id)}">Xóa</button></div></div>`; };
  const rules = () => `<div class="eyebrow">DANH SÁCH CẢNH BÁO · ${AL.rules.length} QUY TẮC</div>${AL.rules.map(ruleRow).join("") || '<p class="muted">Chưa có cảnh báo nào. Bấm “+ Tạo cảnh báo” để bắt đầu.</p>'}`;
  const evCard = (e, i) => { const dl = (e.deliveries || []).map(x => `${x.channel === "app" ? "Trong ứng dụng" : "Trình duyệt"} ${x.status === "ok" ? "✓" : "…"}`).join(" · "), d = e.data || {};
    return `<article class="al-ev ${e.ack ? "" : "new"}" data-id="${esc(e.id)}"><div class="al-r-top"><a class="db-symbol" href="#/phan-tich?s=${encodeURIComponent(e.sym)}">${esc(e.sym)}</a><span class="pill">${GN[e.group] || e.group}</span>${e.review ? '<span class="badge cool">Chưa xác minh</span>' : ""}<small class="muted" style="margin-left:auto">${esc(dt(e.t))}</small></div>
      <div class="al-r-t">${esc(e.title)}</div><div class="al-obs">${esc(e.observed || "")}${e.more > 0 ? ` · và ${e.more} tin khác` : ""}</div>
      <details ${i === 0 && !e.ack ? "open" : ""}><summary>Vì sao cảnh báo được kích hoạt?</summary><p>${esc(e.reason)}</p>
        ${(e.facts || []).length ? `<div class="eyebrow">DỮ KIỆN CẦN KIỂM TRA</div><ul>${e.facts.map(f => `<li>${esc(f)}</li>`).join("")}</ul>` : ""}
        <ul class="al-chk"><li>Giá có duy trì khi nến đóng cửa hay không</li><li>Diễn biến chung của VN-Index và nhóm ngành</li><li>Tin doanh nghiệp có nguồn đáng tin cậy hay chưa</li></ul>
        <p class="source-note">Nguồn: ${esc(d.source || "—")} · dữ liệu lúc ${esc(dt(d.fetchedAt))}${d.tf ? ` · khung ${esc(AL.cat?.tfs[d.tf] || d.tf)}` : ""} · quy tắc ${esc(e.ruleVersion)}<br>Gửi: ${esc(dl)}</p></details>
      <div class="row al-r-act"><a class="btn pale" href="#/phan-tich?s=${encodeURIComponent(e.sym)}">Xem phân tích</a>${e.link ? `<a class="btn pale" target="_blank" rel="noopener noreferrer" href="${esc(e.link)}">Mở tin gốc</a>` : ""}<button type="button" class="btn secondary" data-ask="${esc(e.id)}">Hỏi Nhịp AI</button>${e.ack ? "" : `<button type="button" class="btn secondary" data-ack="${esc(e.id)}">Đã xem</button>`}</div></article>`; };
  const events = () => `<div class="eyebrow">SỰ KIỆN VỪA XẢY RA · ${AL.events.length}</div>${AL.events.length ? `<div class="row" style="margin:6px 0"><button type="button" class="btn secondary" id="al-ackall">Đánh dấu đã xem tất cả</button></div>` : ""}${AL.events.map(evCard).join("") || '<p class="muted">Chưa có cảnh báo nào được kích hoạt. Khi điều kiện thỏa, lý do, thời điểm và nguồn dữ liệu sẽ hiện ở đây.</p>'}<p class="source-note">Lịch sử sự kiện được giữ lại kể cả khi bạn tắt hoặc xóa quy tắc (tối đa 500 sự kiện gần nhất).</p>`;
  const paint = () => { if ($("#al-kpi")) $("#al-kpi").innerHTML = kpi(); if ($("#al-status")) $("#al-status").innerHTML = status(); if ($("#al-rules")) $("#al-rules").innerHTML = rules(); if ($("#al-events")) $("#al-events").innerHTML = events(); wire(); };

  async function market(ok) {
    const box = $("#al-mkt"); if (!box) return;
    try { const o = await api("/api/overview"); if (!ok()) return; const v = (o.indices || []).find(x => x.symbol === "VNINDEX"), b = o.breadth || {};
      box.innerHTML = `<div class="sg-row"><span>VN-Index</span><span>${v ? `<b>${num(v.price)}</b> <span class="${cls(v.pct)}">${pc(v.pct)}</span>` : "—"}</span></div>
      <div class="sg-row"><span>Số mã tăng / giảm (trong rổ ~34 mã theo dõi)</span><span><b class="up">${b.up ?? "—"}</b> / <b class="dn">${b.down ?? "—"}</b></span></div>
      <div class="sg-row"><span>Dữ liệu cập nhật</span><span>${esc(dt(o.meta?.fetchedAt))} · ${esc(o.meta?.source || "")}</span></div>
      <p class="source-note">Giá là nến ngày gần nhất của nguồn, không phải giá realtime. Rổ ~34 mã không đại diện toàn thị trường.</p>`;
    } catch (e) { if (ok()) box.innerHTML = `<p class="muted">Chưa lấy được dữ liệu thị trường: ${esc(e.message)}. Cảnh báo sẽ báo trạng thái dữ liệu thay vì phát tin như bình thường.</p>`; }
  }

  /* ---------- Biểu mẫu tạo cảnh báo ---------- */
  const F = () => AL.form;
  function formHTML() {
    const f = F(), t = byType(f.type), cat = AL.cat, syms = [...new Set([...(ST.watchlist || []), ...(ST.portfolio || []).map(x => x.symbol)])];
    const groups = ["A", "B", "C", "D"], opts = cat.catalog.filter(x => x.group === f.group);
    const fld = x => x.sel ? `<label class="fld2"><span>${esc(x.label)}</span><select data-f="${x.k}">${x.sel.map(v => `<option value="${v}" ${String(f[x.k] ?? x.def) === String(v) ? "selected" : ""}>${v === 20 || v === 50 || v === 200 ? "MA" + v : v}</option>`).join("")}</select></label>`
      : `<label class="fld2"><span>${esc(x.label)}</span><input data-f="${x.k}" inputmode="decimal" placeholder="${esc(x.ph || "")}" value="${esc(f[x.k] ?? x.def ?? "")}"></label>`;
    return `<div class="eyebrow">TẠO CẢNH BÁO MỚI</div><p class="source-note">Chỉ vài thao tác, không cần viết điều kiện phức tạp. Cảnh báo được kiểm tra trên máy chủ.</p>
      <div class="fl-grid"><label class="fld2"><span>Mã cổ phiếu</span><input id="af-s" list="af-wl" maxlength="12" placeholder="${esc((window.NHIPHouse&&NHIPHouse.sample&&NHIPHouse.sample().sym)||"FPT")}" value="${esc(f.sym || "")}" autocapitalize="characters"><datalist id="af-wl">${syms.map(s => `<option value="${esc(s)}">`).join("")}</datalist></label></div>
      <div class="tf chips" id="af-g">${groups.map(g => `<button type="button" data-g="${g}" class="${f.group === g ? "on" : ""}">${GN[g]}</button>`).join("")}</div>
      <div class="fl-grid"><label class="fld2"><span>Điều kiện kích hoạt</span><select id="af-t">${opts.map(o => `<option value="${o.id}" ${o.id === f.type ? "selected" : ""}>${esc(o.label)}</option>`).join("")}</select></label>${t.fields.map(fld).join("")}</div>
      <div class="fl-grid">${t.tf ? `<label class="fld2"><span>Khung thời gian</span><select data-f="tf">${Object.entries(cat.tfs).map(([k, l]) => `<option value="${k}" ${(f.tf || "D") === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        <label class="fld2"><span>Xác nhận bằng</span><select data-f="confirm"><option value="close" ${f.confirm !== "live" ? "selected" : ""}>Nến đã đóng (khuyến nghị)</option><option value="live" ${f.confirm === "live" ? "selected" : ""}>Dữ liệu mới nhất (nến đang chạy)</option></select></label>` : ""}
        <label class="fld2"><span>Chế độ cảnh báo</span><select data-f="mode">${Object.entries(cat.modes).map(([k, l]) => `<option value="${k}" ${(f.mode || "once") === k ? "selected" : ""}>${l}</option>`).join("")}</select></label></div>
      <div class="eyebrow" style="margin-top:10px">NƠI NHẬN THÔNG BÁO</div>
      <label class="chk"><input type="checkbox" checked disabled> Thông báo trong NHỊP</label>
      <label class="chk"><input type="checkbox" id="af-b" ${f.browser !== false ? "checked" : ""}> Thông báo hệ thống của trình duyệt (cần bật quyền trong Cài đặt → Cảnh báo)</label>
      <label class="chk"><input type="checkbox" disabled> Đẩy điện thoại · Email — chưa hỗ trợ (giai đoạn 3 của lộ trình)</label>
      ${t.group === "D" ? '<p class="al-warn">Tin lấy từ RSS báo chí, nên cảnh báo luôn gắn nhãn “chưa xác minh”. Hệ thống không biến tin đồn thành thông tin đã xác nhận.</p>' : ""}
      <div class="al-prev"><div class="eyebrow">XEM TRƯỚC QUY TẮC</div><div id="af-p"></div></div>
      <div class="row" style="margin-top:10px"><button type="button" class="btn primary" id="af-save">Lưu cảnh báo</button><button type="button" class="btn secondary" id="af-x">Hủy</button></div>`;
  }
  function readForm() {
    const f = F(); f.sym = ($("#af-s")?.value || "").trim().toUpperCase(); f.browser = !!$("#af-b")?.checked;
    $$("[data-f]").forEach(el => { f[el.dataset.f] = el.value; }); return f;
  }
  function preview() {
    const f = readForm(), t = byType(f.type), box = $("#af-p"); if (!box || !t) return;
    const v = k => f[k] === "" || f[k] == null ? "…" : Number(String(f[k]).replace(",", ".")).toLocaleString("vi-VN");
    let s = t.tpl.replace("{val}", v("val")).replace("{pct}", v("pct")).replace("{n}", v("n")).replace("{period}", f.period || 20).replace("{thr}", v("thr")).replace("{mult}", v("mult"))
      .replace("{ref}", f.ref ? v("ref") + " VNĐ" : "đóng cửa phiên trước").replace("{vol}", f.volMult ? ` kèm KL ≥ ${v("volMult")}× TB20` : "");
    box.innerHTML = `<b>${esc(f.sym || "Mã")}</b><div>${esc(s)}${t.tf ? ` · khung ${esc(AL.cat.tfs[f.tf || "D"])}` : ""}</div><small class="muted">Tần suất: ${esc(AL.cat.modes[f.mode || "once"])} · Kênh: Trong ứng dụng${f.browser !== false ? ", Trình duyệt" : ""}<br>Khi kích hoạt, hiển thị lý do, thời điểm dữ liệu và nguồn dữ liệu.</small>`;
  }
  function openForm(init = {}) {
    const g = init.group || "A"; AL.form = { group: g, type: init.type || AL.cat.catalog.find(x => x.group === g).id, sym: init.sym || "", mode: "once", tf: "D", confirm: "close", ...init };
    drawForm(); $("#al-form").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function drawForm() {
    const box = $("#al-form"); if (!box) return; box.hidden = false; box.innerHTML = formHTML(); preview();
    $$("#al-form input,#al-form select").forEach(el => el.addEventListener("input", preview));
    $$("#af-g [data-g]").forEach(b => b.onclick = () => { readForm(); const g = b.dataset.g, ty = AL.cat.catalog.find(x => x.group === g); AL.form = { sym: F().sym, browser: F().browser, mode: F().mode, group: g, type: ty.id, tf: "D", confirm: "close" }; drawForm(); });
    $("#af-t").onchange = e => { readForm(); const sym = F().sym, browser = F().browser, mode = F().mode; AL.form = { sym, browser, mode, group: F().group, type: e.target.value, tf: "D", confirm: "close" }; drawForm(); };
    $("#af-x").onclick = () => { box.hidden = true; };
    $("#af-save").onclick = async () => { const f = readForm(); try { await api("/api/alerts/rules", { method: "POST", body: { ...f, channels: { browser: f.browser } } }); box.hidden = true; toast("Đã lưu cảnh báo"); await load(); paint(); } catch (e) { toast(e.message, 1); } };
  }

  /* ---------- Gắn sự kiện ---------- */
  function wire() {
    $$("[data-on]").forEach(el => el.onchange = async () => { try { await api("/api/alerts/rules/" + el.dataset.on, { method: "PUT", body: { on: el.checked } }); await load(); paint(); } catch (e) { toast(e.message, 1); } });
    $$("[data-del]").forEach(el => el.onclick = async () => { if (!(await NhipDlg.confirm({ tone: "danger", title: "Xóa quy tắc cảnh báo?", message: "Quy tắc sẽ ngừng theo dõi và không còn phát cảnh báo mới.", note: { tone: "ok", text: "Lịch sử sự kiện đã phát sinh vẫn được giữ lại." }, okText: "Xóa quy tắc", cancelText: "Giữ lại" }))) return; try { await api("/api/alerts/rules/" + el.dataset.del, { method: "DELETE" }); await load(); paint(); } catch (e) { toast(e.message, 1); } });
    $$("[data-ack]").forEach(el => el.onclick = async () => { await api("/api/alerts/events/ack", { method: "POST", body: { ids: [el.dataset.ack] } }); await load(); paint(); });
    const aa = $("#al-ackall"); if (aa) aa.onclick = async () => { await api("/api/alerts/events/ack", { method: "POST", body: { ids: "all" } }); await load(); paint(); };
    $$("[data-ask]").forEach(el => el.onclick = () => { const e = AL.events.find(x => x.id === el.dataset.ask); if (!e) return;
      const q = `Giải thích cảnh báo ${e.sym}: "${e.title}". Dữ kiện: ${e.observed}. Chỉ dùng dữ liệu thực có trong ứng dụng, nêu rõ điều gì chưa kiểm chứng được, không đưa ra khuyến nghị mua/bán.`;
      if (window.NHIPAI?.send) { try { NHIPAI.open(); NHIPAI.send(q, { sym: e.sym }); return; } catch { } } location.hash = "#/ai?s=" + encodeURIComponent(e.sym); });
  }
  function legacyBox() {
    const old = (ALS?.rules || []).filter(r => r.on); if (!old.length) return "";
    return `<section class="panel"><div class="eyebrow">CẢNH BÁO CŨ TRONG TRÌNH DUYỆT</div><p class="muted">Bạn còn ${old.length} cảnh báo cũ chỉ chạy khi Nhịp Đầu Tư đang mở. Chuyển sang NHỊP ALERT để máy chủ theo dõi liên tục.</p><button type="button" class="btn pale" id="al-mig">Chuyển ${old.length} cảnh báo sang máy chủ</button></section>`;
  }
  const legacyBody = r => r.type === "above" ? { type: "price_gte", val: r.val } : r.type === "below" ? { type: "price_lte", val: r.val } : r.type === "pct" ? { type: "pct_move", pct: r.val } : { type: "news_any" };
  window.alCreateLegacy = async r => { await api("/api/alerts/rules", { method: "POST", body: { sym: r.sym, mode: r.type === "pct" ? "daily" : "once", ...legacyBody(r) } }); };

  window.vAlerts = async function () {
    const ok = mine(), q = new URLSearchParams(location.hash.split("?")[1] || "");
    view(`<div class="view-h vh-al"><div class="al-ht"><div class="eyebrow">NHỊP ALERT</div><h1>${hico("canh-bao")}Cảnh báo</h1></div><div class="row al-btns"><button id="al-chk" class="btn secondary">↻ Kiểm tra ngay</button><button id="al-new" class="btn primary">+ Tạo cảnh báo</button></div></div><p class="muted al-sub">Trung tâm cảnh báo thị trường chứng khoán Việt Nam · điều kiện do bạn đặt, kiểm tra trên máy chủ, có lý do và nguồn dữ liệu rõ ràng.</p>
      <div id="al-status" class="statusbar">Đang tải…</div><section id="al-kpi" class="cards"></section>
      <section id="al-form" class="panel" hidden></section><div id="al-legacy"></div>
      <div class="al-grid"><div class="al-col"><section class="panel"><div class="eyebrow">TRẠNG THÁI THỊ TRƯỜNG</div><div id="al-mkt"><p class="muted">Đang tải…</p></div></section><section class="panel" id="al-rules"></section></div>
        <div class="al-col"><section class="panel" id="al-events"></section></div></div>
      <section class="panel"><div class="eyebrow">QUY TẮC ĐẶC THÙ THỊ TRƯỜNG VIỆT NAM</div><ul class="al-chk"><li>Chỉ báo kỹ thuật dùng nến đã đóng theo mặc định; không phát cảnh báo xác nhận từ nến đang chạy.</li><li>Khi nguồn dữ liệu trễ hoặc không có nến của phiên hiện tại (kể cả ngày nghỉ lễ), quy tắc chuyển sang trạng thái “Dữ liệu trễ” thay vì phát cảnh báo như bình thường.</li><li>Cảnh báo không tự suy ra giá trần/sàn; giá tham chiếu là đóng cửa phiên trước của nguồn hoặc mốc do bạn đặt.</li><li>Cùng một lần vượt ngưỡng chỉ tạo một thông báo (chống trùng, thời gian chờ, chế độ một lần/mỗi ngày/kích hoạt lại).</li></ul>
        <div class="eyebrow" style="margin-top:10px">CHƯA HỖ TRỢ</div>${(AL.cat?.unsupported || []).map(u => `<div class="sg-row"><span>${esc(u.label)}<br><small class="muted">${esc(u.why)}</small></span><span class="badge">Sắp có</span></div>`).join("")}</section>`);
    try { await load(); } catch (e) { if (ok()) $("#al-status").innerHTML = `<span class="dn">Không tải được NHỊP ALERT: ${esc(e.message)}</span>`; return; }
    if (!ok()) return;
    view_fill(); paint(); market(ok);
    $("#al-new").onclick = () => openForm({ sym: (q.get("s") || "").toUpperCase() });
    $("#al-chk").onclick = async () => { const b = $("#al-chk"); b.disabled = true; try { await api("/api/alerts/check", { method: "POST" }); await load(); paint(); toast("Đã kiểm tra các quy tắc đang bật"); } catch (e) { toast(e.message, 1); } b.disabled = false; };
    SWR.on(ok, u => { if (AL.form || !$("#al-events")) return; if (/overview/.test(u)) return market(ok); return load().then(() => { if (ok()) paint(); }); });
    if (q.get("s")) openForm({ sym: q.get("s").toUpperCase() });
    function view_fill() {
      const lg = $("#al-legacy"); lg.innerHTML = legacyBox();
      const m = $("#al-mig"); if (m) m.onclick = async () => { let n = 0; for (const r of ALS.rules.filter(x => x.on)) { try { await window.alCreateLegacy(r); r.on = false; n++; } catch { } } alSave(); toast(`Đã chuyển ${n} cảnh báo`); await load(); lg.innerHTML = ""; paint(); };
    }
  };

  /* ---------- Thăm dò sự kiện mới (toàn ứng dụng) ---------- */
  let seen; try { seen = localStorage.getItem(SEEN); } catch { }
  if (!seen) { seen = new Date().toISOString(); try { localStorage.setItem(SEEN, seen); } catch { } }
  async function poll() {
    try {
      const d = await api("/api/alerts/events?since=" + encodeURIComponent(seen)); AL.summary = d.summary; badge();
      if (!d.events.length) return;
      const fresh = d.events.slice().reverse(); seen = d.events[0].t; try { localStorage.setItem(SEEN, seen); } catch { }
      fresh.forEach(e => { toast("Cảnh báo: " + e.message); try { if (PREF.notify && window.Notification && Notification.permission === "granted" && (e.deliveries || []).some(x => x.channel === "browser")) new Notification("NHỊP · " + e.sym, { body: e.message + (e.observed ? "\n" + e.observed : "") }); } catch { } });
      api("/api/alerts/events/delivered", { method: "POST", body: { ids: fresh.map(e => e.id) } }).catch(() => { });
      if ((location.hash.replace(/^#\/?/, "").split("?")[0]) === "canh-bao" && $("#al-events")) { await load(); paint(); }
    } catch { }
  }
  setTimeout(poll, 4000); setInterval(poll, 30000);
})();
