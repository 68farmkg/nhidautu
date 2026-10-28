/* NHỊP HISTORY — lịch sử hoạt động và thị trường, gom từ dữ liệu thật của các module. */
(() => {
  const LS = "nhip.history.v1";
  let P; try { P = JSON.parse(localStorage.getItem(LS) || "{}"); } catch { P = {}; }
  P = { tab: "feed", range: 30, cat: "all", ...P };
  const saveP = () => { try { localStorage.setItem(LS, JSON.stringify(P)); } catch { } };
  let EV = [], META = {}, q = "", shown = 40, TL = { sym: "" }, PR = { sym: "", days: 90, rows: null, meta: null, shown: 30 };

  const CAT = { alert: ["Cảnh báo", "🔔"], watch: ["Theo dõi", "★"], research: ["Nghiên cứu", "🔬"], trade: ["Giao dịch", "▣"], audit: ["Thao tác", "🧾"] };
  const DEL_CH = { app: "Trong ứng dụng", browser: "Thông báo trình duyệt" };
  const DEL_ST = { ok: "thành công", pending: "đang chờ", failed: "thất bại", error: "thất bại" };
  const slug = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").toLowerCase();
  const day = t => new Date(t).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  const hm = t => new Date(t).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  const when = e => e.dateOnly ? day(e.t) : `${hm(e.t)} · ${day(e.t)}`;
  const cdate = t => { const s = new Date(t * 1000).toISOString().slice(0, 10); return s.split("-").reverse().join("/"); };
  const ckey = t => new Date(t * 1000).toISOString().slice(0, 10);
  const okSym = s => /^[A-Z0-9.]{2,12}$/.test(s);
  const vol = n => n == null ? "—" : num(n, 0);

  function inRange(list) {
    if (!P.range) return list;
    const from = Date.now() - P.range * 86400000;
    return list.filter(e => Date.parse(e.t) >= from);
  }
  function filtered() {
    let l = inRange(EV);
    if (P.cat !== "all") l = l.filter(e => e.cat === P.cat);
    if (q) { const k = slug(q); l = l.filter(e => slug([e.title, e.sym, e.detail, e.text, e.portfolio, e.customer, e.note].join(" ")).includes(k)); }
    return l;
  }

  // ---- CSV (UTF-8 BOM để Excel đọc đúng tiếng Việt); chặn công thức độc hại trong ô ----
  const cell = v => { let s = String(v ?? ""); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
  function csv(rows, name) {
    const blob = new Blob(["\ufeff" + rows.map(r => r.map(cell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const stamp = () => new Date().toISOString().slice(0, 10).replace(/-/g, "");
  function exportFeed() {
    const l = filtered(); if (!l.length) return toast("Không có sự kiện nào để xuất", 1);
    csv([["Thời điểm", "Loại", "Mã", "Tiêu đề", "Chi tiết", "Ghi chú nguồn"], ...l.map(e => [e.dateOnly ? e.t.slice(0, 10) : e.t, CAT[e.cat]?.[0] || e.cat, e.sym, e.title, e.detail || "", e.cat === "trade" ? `${e.customer ? e.customer + " · " : ""}${e.portfolio}${e.sim ? " (mô phỏng)" : ""} · sổ cá nhân` : e.cat === "alert" ? "NHỊP ALERT" : e.cat === "watch" ? "Nhật ký Theo dõi" : e.cat === "audit" ? "Nhật ký thao tác" : "Nhật ký hoạt động"])], `nhip-lich-su-${stamp()}.csv`);
    toast(`Đã xuất ${l.length} sự kiện`);
  }

  // ---- KPI + tab ----
  function head() {
    const l = inRange(EV), c = k => l.filter(e => e.cat === k).length;
    $("#hx-kpi").innerHTML = `<article class="index-card"><span>Hoạt động</span><strong>${l.length}</strong><small>${P.range ? P.range + " ngày gần đây" : "Toàn bộ thời gian"}</small></article>
<article class="index-card"><span>Cảnh báo</span><strong>${c("alert")}</strong><small>Đã kích hoạt trong NHỊP ALERT</small></article>
<article class="index-card"><span>Theo dõi</span><strong>${c("watch")}</strong><small>Thay đổi danh sách, nhóm, ghi chú</small></article>
<article class="index-card"><span>Giao dịch</span><strong>${c("trade")}</strong><small>Sổ giao dịch cá nhân, không phải lệnh khớp chính thức</small></article>`;
    $("#hx-tabs").innerHTML = [["feed", "Hoạt động"], ["price", "Giá thị trường"], ["tl", "Dòng thời gian"], ["stat", "Thống kê"]].map(([k, n]) => `<button type="button" data-t="${k}" class="${P.tab === k ? "on" : ""}">${n}</button>`).join("");
    $$("#hx-tabs [data-t]").forEach(b => b.onclick = () => { P.tab = b.dataset.t; saveP(); paint(); });
  }

  // ---- Tab Hoạt động ----
  function evBody(e) {
    const sy = e.sym ? esc(e.sym) : "", links = e.sym ? `<a class="btn pale" href="#/tong-quan?s=${encodeURIComponent(e.sym)}">📈 Biểu đồ</a><a class="btn pale" href="#/phan-tich?s=${encodeURIComponent(e.sym)}">🔬 Phân tích</a><button type="button" class="btn pale" data-tl="${sy}">Dòng thời gian ${sy}</button>` : "";
    if (e.cat === "alert") {
      const dl = (e.deliveries || []).map(d => `${DEL_CH[d.channel] || esc(d.channel)}: <b>${DEL_ST[d.status] || esc(d.status)}</b>`).join(" · ") || "Chưa có bản ghi gửi";
      return `${e.detail ? `<p><b>Giá trị quan sát:</b> ${esc(e.detail)}</p>` : ""}${e.facts?.length ? `<ul class="hx-ul">${e.facts.map(f => `<li>${esc(f)}</li>`).join("")}</ul>` : ""}${e.reason ? `<p class="muted">${esc(e.reason)}</p>` : ""}<p><b>Thông báo:</b> ${dl}</p><p><b>Trạng thái:</b> ${e.ack ? "Đã đọc" : "Chưa đọc"}${e.review ? " · Chưa xác minh (tin RSS)" : ""}</p><div class="row">${links}${/^https?:\/\//.test(e.link || "") ? `<a class="btn pale" target="_blank" rel="noopener noreferrer" href="${esc(e.link)}">Mở tin gốc</a>` : ""}<a class="btn pale" href="#/canh-bao">Mở NHỊP ALERT</a></div>`;
    }
    if (e.cat === "watch") return `<p>${esc(e.detail || "")}</p>${e.before || e.after ? `<p><b>Trước:</b> ${esc(e.before || "—")}<br><b>Sau:</b> ${esc(e.after || "—")}</p>` : ""}<div class="row">${links}<a class="btn pale" href="#/theo-doi">Mở Theo dõi</a></div>`;
    if (e.cat === "audit") return `<p>${esc(e.detail || "")}</p><p class="muted">Bản ghi này chỉ được thêm, không thể xóa hay sửa.${e.restoredAt ? " Đã khôi phục lúc " + esc(when({ t: e.restoredAt })) + "." : ""}</p>${e.restorable ? `<div class="row"><button type="button" class="btn pale" data-restore="${esc(e.auditId)}">↩ Khôi phục dữ liệu này</button></div>` : ""}`;
    if (e.cat === "trade") return `<p>${esc(e.detail || "—")}</p><p class="muted">Khách hàng: <b>${esc(e.customer || "Chưa gán khách")}</b> · Danh mục: ${esc(e.portfolio)}${e.sim ? " (mô phỏng)" : ""}${e.deletedPortfolio ? " — <b>danh mục đã bị xóa</b> (giữ lại từ nhật ký thao tác; có thể khôi phục)" : ""}${e.note ? " · Ghi chú: " + esc(e.note) : ""}<br>Sổ giao dịch cá nhân do bạn nhập; không phải lịch sử khớp lệnh chính thức của công ty chứng khoán.</p><div class="row">${links}<a class="btn pale" href="#/danh-muc">Mở Danh mục</a></div>`;
    return `${e.text ? `<pre class="hx-pre">${esc(e.text)}</pre><p class="source-note">Đây là kết quả tại thời điểm ${esc(when(e))}, không phải phân tích mới theo thị trường hiện tại.</p>` : `<p>${esc(e.detail || "")}</p>`}<div class="row">${links}</div>`;
  }
  function feedHtml() {
    const l = filtered(), vis = l.slice(0, shown);
    let lastDay = "", html = "";
    for (const e of vis) {
      const d = day(e.t); if (d !== lastDay) { html += `<div class="hx-day">${d}</div>`; lastDay = d; }
      html += `<details class="hx-ev hx-${e.cat}"><summary><span class="hx-ic">${CAT[e.cat]?.[1] || "•"}</span><span class="hx-t"><b>${esc(e.title)}</b><small class="muted">${CAT[e.cat]?.[0] || ""}${e.sym ? " · " + esc(e.sym) : ""}${e.detail && e.cat !== "alert" ? " · " + esc(e.detail.slice(0, 80)) : ""}</small></span><time>${esc(when(e))}</time></summary><div class="hx-b">${evBody(e)}</div></details>`;
    }
    return `<p class="panel-sub">Hiển thị ${vis.length}/${l.length} sự kiện</p>${html || '<p class="muted">Không có sự kiện nào thỏa bộ lọc. Cảnh báo, giao dịch, xem mã, hỏi AI và thay đổi Theo dõi sẽ xuất hiện ở đây khi bạn sử dụng.</p>'}${l.length > vis.length ? '<div class="row"><button id="hx-more" type="button" class="btn secondary">Xem thêm</button></div>' : ""}`;
  }
  function tabFeed() {
    $("#hx-main").innerHTML = `<section class="panel"><div class="panelhead"><div><div class="eyebrow">TRA CỨU LỊCH SỬ</div></div><div class="row"><button id="hx-exp" type="button" class="btn secondary">⬇ Xuất CSV</button><button id="hx-clear" type="button" class="btn secondary">Xóa nhật ký xem/AI</button></div></div>
<div class="row"><select id="hx-range">${[[7, "7 ngày gần đây"], [30, "30 ngày gần đây"], [90, "90 ngày gần đây"], [365, "1 năm gần đây"], [0, "Toàn bộ"]].map(([v, n]) => `<option value="${v}" ${P.range === v ? "selected" : ""}>${n}</option>`).join("")}</select><input id="hx-q" type="search" placeholder="Tìm theo mã, nội dung…" value="${esc(q)}" style="flex:1;min-width:160px"><button id="hx-reset" type="button" class="btn secondary">Đặt lại</button></div>
<div id="hx-cats" class="chips tf">${[["all", "Tất cả"], ["alert", "Cảnh báo"], ["watch", "Theo dõi"], ["research", "Nghiên cứu"], ["trade", "Giao dịch"], ["audit", "Thao tác"]].map(([k, n]) => `<button type="button" data-c="${k}" class="${P.cat === k ? "on" : ""}">${n}</button>`).join("")}</div>
<div id="hx-list">${feedHtml()}</div><p class="source-note">${esc(META.notes?.watch || "")} ${esc(META.notes?.activity || "")}</p></section>`;
    const redo = () => { $("#hx-list").innerHTML = feedHtml(); bindFeed(); };
    $("#hx-range").onchange = e => { P.range = +e.target.value; saveP(); shown = 40; head(); redo(); };
    $("#hx-q").oninput = e => { q = e.target.value.trim(); shown = 40; redo(); };
    $("#hx-reset").onclick = () => { P.range = 30; P.cat = "all"; q = ""; shown = 40; saveP(); paint(); };
    $$("#hx-cats [data-c]").forEach(b => b.onclick = () => { P.cat = b.dataset.c; saveP(); shown = 40; $$("#hx-cats [data-c]").forEach(x => x.classList.toggle("on", x === b)); redo(); });
    $("#hx-exp").onclick = exportFeed;
    $("#hx-clear").onclick = async () => {
      try {
        let n = 0;
        try { const d = await api("/api/history", { method: "DELETE" }); return toast(d.deleted ? "Đã xóa nhật ký xem/AI" : "Không có nhật ký để xóa"); }
        catch (e) { if (e.data?.code !== "NEED_CONFIRM") throw e; n = e.data.count; }
        if (!(await NhipDlg.confirm({ tone: "danger", title: `Xóa ${n} bản ghi nhật ký?`, message: "Nhật ký xem mã và hỏi AI sẽ bị xóa. Cảnh báo, giao dịch và thay đổi Theo dõi nằm ở module riêng nên không bị ảnh hưởng.", note: { tone: "ok", text: "Nội dung được lưu trong Nhật ký thao tác (tab Thao tác) để khôi phục." }, okText: "Xóa nhật ký", cancelText: "Giữ lại" }))) return;
        await api("/api/history?confirm=" + n, { method: "DELETE" }); toast(`Đã xóa ${n} bản ghi (có thể khôi phục)`); window.vLichSu();
      } catch (e) { toast(e.message, 1); }
    };
    bindFeed();
  }
  function bindFeed() {
    const m = $("#hx-more"); if (m) m.onclick = () => { shown += 40; $("#hx-list").innerHTML = feedHtml(); bindFeed(); };
    $$("#hx-list [data-restore]").forEach(b => b.onclick = async () => {
      if (!(await NhipDlg.confirm({ tone: "info", icon: "undo", title: "Khôi phục từ bản ghi này?", message: "Dữ liệu trong bản ghi sẽ được đưa trở lại ứng dụng.", note: { tone: "ok", text: "Dữ liệu đang có không bị xóa; mục nào trùng sẽ được giữ nguyên." }, okText: "Khôi phục", cancelText: "Hủy" }))) return;
      b.disabled = true;
      try { const d = await api(`/api/audit/${encodeURIComponent(b.dataset.restore)}/restore`, { method: "POST" }); toast(d.summary || "Đã khôi phục"); try { Object.assign(ST, await api("/api/state")); } catch { } window.vLichSu(); }
      catch (e) { toast(e.message, 1); b.disabled = false; }
    });
    $$("#hx-list [data-tl]").forEach(b => b.onclick = () => { TL.sym = b.dataset.tl; P.tab = "tl"; saveP(); paint(); });
  }

  // ---- Tab Giá thị trường (OHLC thật từ VNDirect DChart) ----
  const GT = (s, c, v) => (!isIdx(s) && c != null && v != null) ? num(vnd(c) * v / 1e9, 2) + " tỷ" : "—";
  async function loadPrice(ok) {
    const s = PR.sym; if (!okSym(s)) return toast("Mã không hợp lệ", 1);
    $("#hx-pr-out").innerHTML = '<p class="muted">Đang tải dữ liệu từ VNDirect DChart…</p>';
    try {
      const d = await api(`/api/analysis/${encodeURIComponent(s)}?resolution=D&days=${PR.days}`); if (!ok()) return;
      PR.rows = d.candles.map((c, i, a) => ({ ...c, pct: i && a[i - 1].close ? (c.close - a[i - 1].close) / a[i - 1].close * 100 : null })).reverse(); PR.meta = d.meta; PR.shown = 30; sessionStorage.sym = s; drawPrice();
    } catch (e) { if (ok()) $("#hx-pr-out").innerHTML = err(e, "Không tải được lịch sử giá"); }
  }
  function drawPrice() {
    const r = PR.rows, s = PR.sym; if (!r) return;
    const hi = Math.max(...r.map(x => x.high)), lo = Math.min(...r.map(x => x.low));
    $("#hx-pr-out").innerHTML = `<p class="panel-sub">${esc(s)} · ${r.length} phiên (${cdate(r.at(-1).time)} → ${cdate(r[0].time)}) · cao nhất ${px(s, hi)} · thấp nhất ${px(s, lo)} · nguồn ${esc(PR.meta?.source || "VNDirect DChart")} lúc ${PR.meta?.fetchedAt ? dt(PR.meta.fetchedAt) : "—"}</p>
<div class="tw"><table class="tbl"><tr><th>Ngày</th><th>Mở</th><th>Cao</th><th>Thấp</th><th>Đóng</th><th>% đổi</th><th>Khối lượng</th><th class="tw-m">GTGD ước tính</th></tr>${r.slice(0, PR.shown).map(x => `<tr><td>${cdate(x.time)}</td><td>${px(s, x.open)}</td><td>${px(s, x.high)}</td><td>${px(s, x.low)}</td><td><b>${px(s, x.close)}</b></td><td class="${x.pct == null ? "" : x.pct < 0 ? "dn" : "up"}">${pc(x.pct == null ? null : +x.pct.toFixed(2))}</td><td>${vol(x.volume)}</td><td class="tw-m">${GT(s, x.close, x.volume)}</td></tr>`).join("")}</table></div>
<div class="row">${r.length > PR.shown ? '<button id="hx-pr-more" type="button" class="btn secondary">Xem thêm</button>' : ""}<button id="hx-pr-csv" type="button" class="btn secondary">⬇ Xuất CSV</button><a class="btn pale" href="#/tong-quan?s=${encodeURIComponent(s)}">📈 Mở biểu đồ</a></div>
<p class="source-note">Giá cổ phiếu hiển thị bằng đồng. GTGD ước tính = giá đóng cửa × khối lượng của phiên, không phải giá trị khớp lệnh chính thức. Nguồn không cho biết trạng thái điều chỉnh giá nên NHỊP không khẳng định giá đã hoặc chưa điều chỉnh; hãy đối chiếu với nguồn gốc khi cần số liệu chính xác. Không phải khuyến nghị đầu tư.</p>`;
    const m = $("#hx-pr-more"); if (m) m.onclick = () => { PR.shown += 60; drawPrice(); };
    $("#hx-pr-csv").onclick = () => csv([["Ngày", "Mở", "Cao", "Thấp", "Đóng", "% đổi", "Khối lượng", "GTGD ước tính (tỷ đồng)", "Đơn vị giá"], ...r.map(x => [ckey(x.time), x.open, x.high, x.low, x.close, x.pct == null ? "" : x.pct.toFixed(2), x.volume ?? "", isIdx(s) ? "" : (vnd(x.close) * (x.volume || 0) / 1e9).toFixed(2), isIdx(s) ? "điểm" : "nghìn đồng"])], `nhip-gia-${s}-${stamp()}.csv`);
  }
  function tabPrice(ok) {
    PR.sym = PR.sym || sessionStorage.sym || ST.watchlist[0] || "VNINDEX";
    $("#hx-main").innerHTML = `<section class="panel"><div class="eyebrow">LỊCH SỬ GIÁ VÀ THỊ TRƯỜNG</div><form id="hx-pf" class="row"><input id="hx-ps" maxlength="12" value="${esc(PR.sym)}" placeholder="Mã hoặc chỉ số (VD: ${(()=>{const x=window.NHIPHouse&&NHIPHouse.sample&&NHIPHouse.sample();return x?[x.sym,x.idx,x.idx2].filter((v,i,a)=>a.indexOf(v)===i).join(', '):'FPT, VNINDEX, VN30'})()})" required><select id="hx-pd">${[[30, "30 ngày"], [90, "90 ngày"], [180, "180 ngày"], [365, "1 năm"], [730, "2 năm"]].map(([v, n]) => `<option value="${v}" ${PR.days === v ? "selected" : ""}>${n}</option>`).join("")}</select><button class="btn pale">Xem</button></form>
<div class="chips tf">${["VNINDEX", "VN30", ...ST.watchlist.slice(0, 6)].map(s => `<button type="button" data-s="${esc(s)}">${esc(s)}</button>`).join("")}</div><div id="hx-pr-out"><p class="muted">Nhập mã và bấm Xem để tải nến ngày.</p></div></section>`;
    $("#hx-pf").onsubmit = e => { e.preventDefault(); { const v = $("#hx-ps").value.trim().toUpperCase(); if (window.NHIPHouse && !NHIPHouse.gate(v, { onCancel: () => { $("#hx-ps").value = PR.sym; } })) return; } PR.sym = $("#hx-ps").value.trim().toUpperCase(); PR.days = +$("#hx-pd").value; loadPrice(ok); };
    $$("[data-s]", $("#hx-main")).forEach(b => b.onclick = () => { PR.sym = b.dataset.s; $("#hx-ps").value = PR.sym; PR.days = +$("#hx-pd").value; loadPrice(ok); });
    if (PR.rows && PR.rows.length) drawPrice();
  }

  // ---- Tab Dòng thời gian theo mã ----
  async function loadTL(ok) {
    const s = TL.sym; if (!okSym(s)) return toast("Mã không hợp lệ", 1);
    const evs = EV.filter(e => e.sym === s).sort((a, b) => Date.parse(a.t) - Date.parse(b.t));
    $("#hx-tl-out").innerHTML = '<p class="muted">Đang đối chiếu với giá lịch sử…</p>';
    let cd = null, perr = "";
    try { cd = (await api(`/api/analysis/${encodeURIComponent(s)}?resolution=D&days=730`)).candles; } catch (e) { perr = e.message; }
    if (!ok()) return;
    const closeOn = t => { // đóng cửa của phiên cùng ngày hoặc phiên liền trước
      if (!cd) return null; const k = new Date(t).toISOString().slice(0, 10); let best = null;
      for (const c of cd) { if (ckey(c.time) <= k) best = c; else break; } return best && ckey(best.time) >= new Date(Date.parse(t) - 10 * 86400000).toISOString().slice(0, 10) ? { c: best, same: ckey(best.time) === k } : null;
    };
    const last = cd?.at(-1);
    $("#hx-tl-out").innerHTML = `${last ? `<p class="panel-sub">${esc(s)} · đóng cửa mới nhất ${px(s, last.close)} (${cdate(last.time)}) · nguồn VNDirect DChart, không đảm bảo realtime</p>` : `<p class="inline-error">Không đối chiếu được giá: ${esc(perr || "thiếu dữ liệu")}. Vẫn hiển thị sự kiện.</p>`}
${evs.length ? `<div class="hx-tl">${evs.map((e, i) => { const h = closeOn(e.t), chg = h && last && h.c.close ? (last.close - h.c.close) / h.c.close * 100 : null;
      return `<div class="hx-tli hx-${e.cat}"><div class="hx-dot">${CAT[e.cat]?.[1] || "•"}</div><div><b>${esc(e.title)}</b> <small class="muted">${CAT[e.cat]?.[0] || ""} · ${esc(when(e))}</small>${e.detail ? `<div class="muted">${esc(e.detail.slice(0, 160))}</div>` : ""}${h ? `<div class="hx-px">Đóng cửa ${h.same ? "cùng ngày" : "phiên " + cdate(h.c.time)}: <b>${px(s, h.c.close)}</b>${chg != null ? ` · đến phiên mới nhất: <b class="${chg < 0 ? "dn" : "up"}">${pc(+chg.toFixed(2))}</b>` : ""}</div>` : '<div class="muted hx-px">Chưa đối chiếu được giá (ngoài phạm vi 2 năm hoặc thiếu dữ liệu).</div>'}</div></div>`; }).join("")}</div>` : `<p class="muted">Chưa có sự kiện nào gắn với mã ${esc(s)} trong cảnh báo, Theo dõi, nghiên cứu hay giao dịch.</p>`}
<p class="source-note">Dòng thời gian chỉ xếp sự kiện theo thứ tự và đối chiếu với giá đóng cửa; không khẳng định cảnh báo, tin tức hay hành động nào là nguyên nhân gây ra biến động giá.</p>`;
  }
  function tabTL(ok) {
    const cnt = {}; EV.forEach(e => { if (e.sym) cnt[e.sym] = (cnt[e.sym] || 0) + 1; });
    const top = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 8);
    TL.sym = TL.sym || top[0]?.[0] || ST.watchlist[0] || "";
    $("#hx-main").innerHTML = `<section class="panel"><div class="eyebrow">DÒNG THỜI GIAN ĐẦU TƯ THEO MÃ</div><form id="hx-tf" class="row"><input id="hx-ts" maxlength="12" value="${esc(TL.sym)}" placeholder="Nhập mã (VD: ${(()=>{const x=window.NHIPHouse&&NHIPHouse.sample&&NHIPHouse.sample();return x?x.sym:'FPT'})()})" required><button class="btn pale">Xem</button></form>
<div class="chips tf">${top.map(([s, n]) => `<button type="button" data-s="${esc(s)}">${esc(s)} · ${n}</button>`).join("")}</div><div id="hx-tl-out"></div></section>`;
    $("#hx-tf").onsubmit = e => { e.preventDefault(); TL.sym = $("#hx-ts").value.trim().toUpperCase(); loadTL(ok); };
    $$("[data-s]", $("#hx-main")).forEach(b => b.onclick = () => { TL.sym = b.dataset.s; $("#hx-ts").value = TL.sym; loadTL(ok); });
    if (TL.sym) loadTL(ok); else $("#hx-tl-out").innerHTML = '<p class="muted">Chưa có mã nào để hiển thị.</p>';
  }

  // ---- Tab Thống kê ----
  function tabStat() {
    const l = inRange(EV), alerts = l.filter(e => e.cat === "alert"), dels = alerts.flatMap(e => e.deliveries || []);
    const ok = dels.filter(d => d.status === "ok").length, pend = dels.filter(d => d.status === "pending").length, bad = dels.filter(d => d.status === "failed" || d.status === "error").length;
    const views = {}; l.filter(e => e.cat === "research" && e.kind === "view" && e.sym).forEach(e => views[e.sym] = (views[e.sym] || 0) + 1);
    const topV = Object.entries(views).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const tx = l.filter(e => e.cat === "trade"), n = k => tx.filter(e => e.kind === k).length;
    const ai = l.filter(e => e.cat === "research" && e.kind === "ai").length, wc = l.filter(e => e.cat === "watch").length;
    const row = (k, v) => `<div class="sg-row"><span>${k}</span><span>${v}</span></div>`;
    $("#hx-main").innerHTML = `<section class="panel"><div class="eyebrow">THỐNG KÊ CÁ NHÂN · ${P.range ? P.range + " NGÀY GẦN ĐÂY" : "TOÀN BỘ"}</div>
${row("Số cảnh báo đã kích hoạt", `<b>${alerts.length}</b>`)}
${row("Thông báo đã gửi thành công", dels.length ? `<b>${ok}/${dels.length}</b> (${num(ok / dels.length * 100, 0)}%)${pend ? ` · ${pend} đang chờ` : ""}${bad ? ` · ${bad} thất bại` : ""}` : '<span class="muted">Chưa có bản ghi gửi</span>')}
${row("Mã được xem nhiều nhất", topV.length ? topV.map(([s, c]) => `<a href="#/tong-quan?s=${encodeURIComponent(s)}"><b>${esc(s)}</b></a> ×${c}`).join(" · ") : '<span class="muted">Chưa có lượt xem</span>')}
${row("Giao dịch mua / bán / cổ tức", `<b>${n("buy")}</b> / <b>${n("sell")}</b> / <b>${n("div")}</b>`)}
${row("Lượt hỏi AI / phân tích đã lưu", `<b>${ai}</b>`)}
${row("Thay đổi Theo dõi", `<b>${wc}</b>`)}
<p class="source-note">Lãi/lỗ đã thực hiện, chưa thực hiện và hiệu quả theo thời gian được tính trong mục <a href="#/danh-muc">Danh mục</a> theo giao dịch bạn nhập. Số lượt xem, số cảnh báo và số giao dịch là các chỉ số khác nhau; không dùng chúng để thay thế nhau khi đánh giá hiệu quả đầu tư. Thông báo “đang chờ” là chưa được trình duyệt xác nhận, không đồng nghĩa với thất bại.</p></section>`;
  }

  function paint() {
    head(); const ok = mine2;
    ({ feed: tabFeed, price: tabPrice, tl: tabTL, stat: tabStat })[P.tab](ok);
  }
  let mine2 = () => true;

  window.HXX = { get tab() { return P.tab; } };
  window.vLichSu = async function () {
    const ok = mine(); mine2 = ok;
    view(`<div class="view-h"><div><div class="eyebrow">NHỊP HISTORY</div><h1>${hico("lich-su")}Lịch sử</h1><p class="muted">Lịch sử hoạt động và thị trường: cảnh báo, thay đổi Theo dõi, nghiên cứu, giao dịch và giá lịch sử trong một nơi.</p></div></div>
<section id="hx-kpi" class="cards dashboard-kpis"></section><div id="hx-tabs" class="tf tabs"></div><div id="hx-main"><p class="muted">Đang tải lịch sử…</p></div>`);
    try { const d = await api("/api/history/feed"); if (!ok()) return; EV = d.events; META = d; }
    catch (e) { if (ok()) $("#hx-main").innerHTML = err(e, "Không tải được lịch sử"); return; }
    shown = 40; PR.rows = null; paint();
  };
})();
