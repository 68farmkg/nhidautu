/* NHIP AI v2 — cửa sổ chat nổi + trang Phân tích AI dùng chung một thành phần.
   Dùng các hàm/biến toàn cục của app.js ($, $$, esc, api, ST, PREF, ALS, ico, hico, view, mine, toast, fmtA, aiCtx, saveWatch, alSave, alCheck). */
(() => {
"use strict";
const KEY = "nhip.chats.v2", RKEY = "nhip.reports.v1";
/* V2.84 — menu AI = đúng tên 12 mục trên menu ứng dụng (cùng thứ tự) + "Tự động" bao quát tất cả. Khóa tab = đường dẫn của mục. */
const MODES = [["auto", "Tự động"], ["dashboard", "Dashboard"], ["tong-quan", "Biểu đồ"], ["thi-truong", "Thị trường"], ["phan-tich", "Phân tích"], ["danh-muc", "Danh mục"], ["giao-dich", "Giao dịch"], ["theo-doi", "Theo dõi"], ["canh-bao", "Cảnh báo"], ["tin-tuc", "Tin tức"], ["ai", "Phân tích AI"], ["lich-su", "Lịch sử"], ["cai-dat", "Cài đặt"]];
const PAGES = { dashboard: "Dashboard", "tong-quan": "Biểu đồ", "thi-truong": "Thị trường", "phan-tich": "Phân tích", "danh-muc": "Danh mục", "giao-dich": "Giao dịch", "theo-doi": "Theo dõi", "canh-bao": "Cảnh báo", "tin-tuc": "Tin tức", ai: "Phân tích AI", "lich-su": "Lịch sử", "cai-dat": "Cài đặt" };
/* Đang đứng ở mục nào thì tab AI đi theo mục đó (mở ✦ hoặc đổi mục). Đứng ở #/ai thì giữ tab đã chọn → mục nào trỏ sang AI thì AI mở đúng tab của mục đó. */
const PAGE_MODE = { dashboard: "dashboard", "tong-quan": "tong-quan", "thi-truong": "thi-truong", "phan-tich": "phan-tich", "danh-muc": "danh-muc", "giao-dich": "giao-dich", "theo-doi": "theo-doi", "canh-bao": "canh-bao", "tin-tuc": "tin-tuc", "lich-su": "lich-su", "cai-dat": "cai-dat" };
const LEGACY_MODE = { market: "thi-truong", stock: "phan-tich", portfolio: "danh-muc", news: "tin-tuc", trade: "giao-dich" };   // khóa cũ của các cuộc trò chuyện đã lưu
const MODE_NAME = Object.fromEntries(MODES.concat([["guide", "Hướng dẫn"], ["market", "Thị trường"], ["stock", "Phân tích"], ["portfolio", "Danh mục"], ["news", "Tin tức"], ["trade", "Giao dịch"]]));
const SYM_TABS = new Set(["auto", "tong-quan", "phan-tich", "giao-dich"]);   // tab cần ô Mã (mã thuộc đúng sàn đang đứng)
const needSym = m => SYM_TABS.has(LEGACY_MODE[m] || m);
const modeKey = m => LEGACY_MODE[m] || m || "auto";
window.NHIPAIModes = { MODES: MODES.map(x => x[0]), needSym, modeKey };
/* v2.31 — AI làm việc theo SÀN: mọi thứ (mã gợi ý, cuộc trò chuyện, báo cáo, dữ liệu gửi cho AI) chỉ thuộc sàn đang đứng */
const hx = () => { try { return NHIPHouse.cur() } catch { return "HOSE" } };
const hxn = () => { try { return NHIPHouse.name() } catch { return "HOSE" } };
const sam = () => { try { return NHIPHouse.sample() } catch { return { sym: "FPT", sym2: "HPG" } } };
const PH = { get auto() { return `Hỏi về bất kỳ mục nào: thị trường ${hxn()}, mã, tin, danh mục, cách dùng…` }, get dashboard() { return `Hỏi về Dashboard sàn ${hxn()} (Top 5, Bảng điểm, bản tin)…` }, get "tong-quan"() { return `Hỏi về biểu đồ một mã sàn ${hxn()} (VD: ${sam().sym} đang ở vùng nào?)…` }, get "thi-truong"() { return `Hỏi về Thị trường ${hxn()} (xếp hạng, ngành, dòng tiền, bộ lọc)…` }, get "phan-tich"() { return `Hỏi về Bằng chứng/phân tích một mã sàn ${hxn()} (VD: Phân tích ${sam().sym})…` }, get "danh-muc"() { return `Hỏi về danh mục của bạn ở sàn ${hxn()}…` }, get "giao-dich"() { return `Hỏi giá vào – chốt lời – cắt lỗ của một mã sàn ${hxn()} (VD: Kế hoạch giao dịch ${sam().sym})…` }, get "theo-doi"() { return `Hỏi về danh sách theo dõi sàn ${hxn()}…` }, "canh-bao": "Hỏi cách tạo và đọc cảnh báo (NHỊP ALERT)…", "tin-tuc": "Hỏi về tin tức, sự kiện…", ai: "Hỏi cách dùng Nhịp AI và các tab…", "lich-su": "Hỏi về Lịch sử (hoạt động, giá, dòng thời gian, thống kê)…", "cai-dat": "Hỏi nên chỉnh gì ở Cài đặt (AI, giao diện, danh bạ mã…)…" };
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } };
const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const mobile = () => matchMedia("(max-width:700px)").matches;

let CS = load(KEY, null); if (!CS || !Array.isArray(CS.list)) CS = { cur: "", list: [] };
if (!CS.curBy || typeof CS.curBy !== "object") CS.curBy = {};
const chatHouse = c => (c && c.house) || "HOSE";
CS.list.forEach(c => { c.msgs = (c.msgs || []).filter(m => !m.pending); if (LEGACY_MODE[c.mode]) c.mode = LEGACY_MODE[c.mode] });
let RP = load(RKEY, []); if (!Array.isArray(RP)) RP = [];
/* V2.94: thẻ trả lời của Phân tích › AI và Tin tức › AI lưu báo cáo qua đây (cùng kho "Báo cáo đã lưu") */
window.NHIPAIReports = { add: e => { RP.unshift({ id: uid(), t: Date.now(), house: e.house || hx(), sym: e.sym || "", mode: e.mode, title: String(e.title || "Báo cáo").slice(0, 80), text: e.text, via: e.via || "" }); RP = RP.slice(0, 30); put(RKEY, RP) } };
const save = () => { const n = {}; CS.list = CS.list.filter(c => (n[chatHouse(c)] = (n[chatHouse(c)] || 0) + 1) <= 12); CS.list.forEach(c => c.msgs = c.msgs.slice(-40)); put(KEY, CS) };
const route = () => (location.hash.replace(/^#\/?/, "") || PREF.start || "dashboard").split("?")[0];
const cur = () => { const h = hx(); let c = CS.list.find(x => x.id === CS.curBy[h] && chatHouse(x) === h); if (!c && CS.cur) { const o = CS.list.find(x => x.id === CS.cur); if (o && chatHouse(o) === h) c = o } if (!c) { c = { id: uid(), t: Date.now(), title: "Cuộc trò chuyện mới", mode: PAGE_MODE[route()] || "auto", house: h, msgs: [] }; CS.list.unshift(c) } CS.curBy[h] = CS.cur = c.id; return c };
let lastSec = PAGE_MODE[route()] ? route() : "";   // mục (không phải #/ai) gần nhất — để biết mục nào vừa trỏ sang AI
const followRoute = () => { const r = route(), m = PAGE_MODE[r]; if (!m) return; lastSec = r; const c = cur(); if (c.mode !== m) { c.mode = m; save() } };
const newChat = () => { const c = cur(); if (c.msgs.length) { CS.curBy[hx()] = ""; CS.cur = ""; cur() } save(); redrawAll() };
/* Mã đang xem: ưu tiên mã trên địa chỉ trang (Biểu đồ / Phân tích / Giao dịch), rồi mã biểu đồ vừa tải, rồi mã xem gần nhất; bỏ qua chỉ số. */
const IDX_RE = /^(VNINDEX|VN30|VN100|VNALL|VNMID|VNSML|HNX\w*|UPCOM\w*)$/;
const pageSym = () => { const q = new URLSearchParams(location.hash.split("?")[1] || ""); const c = [q.get("s"), window.__nhipChartSymbol, sessionStorage.analysisSym, sessionStorage.sym]; for (const v of c) { const s = String(v || "").toUpperCase().replace(/[^A-Z0-9.]/g, ""); if (s && !IDX_RE.test(s)) return s } return "" };
const provOpts = () => '<option value="auto">⚡ Tự động chuyển AI</option>' + ST.ai.providers.filter(p => p.ready).map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join("");
const tm = t => new Date(t).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/* ---------- Hiển thị câu trả lời (markdown gọn, an toàn) ---------- */
const inl = t => fmtA(t).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/(^|[^*\w])\*([^*\s](?:[^*]*[^*\s])?)\*(?!\*)/g, "$1<i>$2</i>");
function md(t) {
  const L = String(t || "").split("\n"); let h = "", ul = false, ol = false, i = 0;
  const close = () => { if (ul) { h += "</ul>"; ul = false } if (ol) { h += "</ol>"; ol = false } };
  const isRow = l => /^\s*\|.*\|\s*$/.test(l), isSep = l => /^[\s|:-]+$/.test(l) && l.includes("-");
  const cells = l => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(c => c.trim());
  while (i < L.length) {
    const l = L[i].trimEnd();
    if (isRow(l)) {
      close(); const rows = []; while (i < L.length && isRow(L[i])) rows.push(L[i++]);
      const head = rows.length > 1 && isSep(rows[1]), data = rows.filter(r => !isSep(r)).map(cells);
      h += `<div class="tw"><table class="tbl aix-t">${data.map((r, k) => `<tr>${r.map(c => head && !k ? `<th>${inl(c)}</th>` : `<td>${inl(c)}</td>`).join("")}</tr>`).join("")}</table></div>`; continue;
    }
    i++;
    if (/^\s*([-*_])\1{2,}\s*$/.test(l)) { close(); continue }
    const li = /^\s*[-*•]\s+(.*)/.exec(l), no = /^\s*\d+[.)]\s+(.*)/.exec(l);
    if (li) { if (ol) { h += "</ol>"; ol = false } if (!ul) { h += "<ul>"; ul = true } h += `<li>${inl(li[1])}</li>`; continue }
    if (no) { if (ul) { h += "</ul>"; ul = false } if (!ol) { h += "<ol>"; ol = true } h += `<li>${inl(no[1])}</li>`; continue }
    close();
    const bq = /^\s*>\s?(.*)$/.exec(l);
    if (bq) { if (bq[1].trim()) h += `<blockquote class="aix-bq">${inl(bq[1])}</blockquote>`; continue }
    const hd = /^#{1,4}\s+(.*)/.exec(l), sec = /^\*\*(\d\.\s[^*]+)\*\*:?\s*$/.exec(l);
    if (sec) h += `<h4 class="sec">${inl(sec[1])}</h4>`;
    else if (hd) h += `<h4${/^\d\./.test(hd[1]) ? ' class="sec"' : ""}>${inl(hd[1])}</h4>`;
    else if (l.trim()) h += `<p>${inl(l)}</p>`;
  }
  close(); return h;
}
window.NHIPmd = md;

/* ---------- Gợi ý theo mục / mã / chế độ ---------- */
/* V2.82 — tên sàn của MÃ (theo danh bạ, không đoán); chưa rõ sàn thì trả "" để câu gợi ý không ghi sàn */
const exLbl = x => { try { const r = NHIPExchange.resolve(x); return r && r.known ? ({ HOSE: "HOSE", HNX: "HNX", UPCOM: "UPCoM" })[String(r.ex).toUpperCase()] || "" : "" } catch { return "" } };
/* sàn nào ra sàn đó: mã gợi ý/so sánh chỉ lấy trong đúng sàn đang đứng */
const sameHouse = x => { try { return !window.NHIPHouse || !NHIPHouse.houseOf || NHIPHouse.houseOf(x) === hx() } catch { return true } };
function sugg(mode, sym) {
  const sm = sam(), wl = (ST.watchlist || []).filter(sameHouse), s = sym || wl[0] || sm.sym, o = wl.find(x => x !== s) || (s === sm.sym ? sm.sym2 : sm.sym), r = route(), xs = exLbl(s), ts = s + (xs ? " (" + xs + ")" : ""), h = hxn();
  const by = {
    dashboard: [`Tóm tắt Dashboard sàn ${h} hôm nay`, `Bảng điểm ${hxn()}: mã nào có nền > 0 và mã nào có cờ đỏ?`, "Top 5 ứng viên hôm nay là mã nào và vì sao?", "5 mã tăng và 5 mã giảm mạnh nhất là mã nào?", "Bản đồ nhiệt ngành và độ rộng cho biết điều gì?", "Các khối trên Dashboard nên đọc theo thứ tự nào?"],
    "tong-quan": [`${ts} đang ở vùng hỗ trợ/kháng cự nào?`, `Công cụ NHỊP nào áp dụng cho ${ts}?`, `Giải thích RSI và MACD của ${s}`, `Khung thời gian nào hợp để xem ${s}?`, `So sánh ${s} và ${o}`, "Cách vẽ đường xu hướng và Fibonacci trên biểu đồ?"],
    "thi-truong": [`Phân tích tổng quan thị trường ${h} hôm nay`, "Xếp hạng kỹ thuật: mã nào dẫn đầu và điểm được chấm thế nào?", "Top 5 ứng viên: mã nào bị loại và vì sao?", "Nhóm ngành nào đang hút dòng tiền?", "Độ rộng thị trường cho biết điều gì?", "Dùng Bộ lọc để tìm mã giá trên SMA20 và MACD dương thế nào?"],
    "phan-tich": [`Bằng chứng NHỊP của ${ts}: điểm tham gia nói gì?`, `Điểm cộng cơ bản và tin của ${ts} nói gì?`, `${s} có đồng thuận đa khung (Ngày/Tuần/Tháng) không?`, `Cấu trúc giá và mẫu hình của ${s}`, `Rủi ro chính khi theo dõi ${s}`, `Kết quả kiểm thử chiến lược của ${s} đáng tin đến đâu?`],
    "danh-muc": ["Đánh giá mức tập trung rủi ro danh mục", "Điểm tham gia và điểm cộng từng mã trong danh mục (theo sàn)", "Mã nào chiếm tỷ trọng lớn nhất và đang lãi/lỗ?", "Danh mục nhạy với nhóm ngành nào?", "Cách ghi cổ tức và nhập CSV vào danh mục?"],
    "giao-dich": [`Kế hoạch giao dịch ${ts}: trong ngày, trung hạn, dài hạn`, `Điểm vào, chốt lời, cắt lỗ trong ngày của ${s}`, `Kế hoạch trung hạn (2–8 tuần) của ${s}: vào ở đâu, SL/TP ở đâu?`, `Kế hoạch dài hạn (3–12 tháng) của ${s}`, `Bằng chứng NHỊP của ${ts} có ủng hộ vào lệnh lúc này không?`, `Lãi/rủi ro và giá hòa vốn sau phí + thuế của ${s}`, `Nếu tôi đang giữ ${s}, nên đặt SL/TP ở mức nào?`, `${s} mua hôm nay thì bao giờ bán được (T+2), bước giá và lô thế nào?`, "Mục Giao dịch có những phần nào và đặt Lệnh chờ TP/SL ra sao?"],
    "theo-doi": [`Trong danh sách theo dõi sàn ${h}, mã nào đang biến động mạnh?`, "Mã theo dõi nào có nền > 0 và mã nào có cờ đỏ?", "Mã nào có thanh khoản tăng (KL/TB20 cao)?", "Nhóm thông minh trong Theo dõi hoạt động thế nào?", "Làm sao thêm ghi chú và vùng giá quan tâm cho một mã?"],
    "canh-bao": ["Các nhóm cảnh báo A–D dùng khi nào?", `Tạo cảnh báo giá cho ${s} thế nào?`, `Cảnh báo kỹ thuật nào hợp với ${ts}?`, "Vì sao cảnh báo không chạy khi tôi đóng trang?", "Xác nhận bằng nến đã đóng và nến đang chạy khác nhau ra sao?"],
    "tin-tuc": ["Tóm tắt tin quan trọng hôm nay", "Tin nào đang được tính vào điểm cộng tin của mã tôi theo dõi?", "Tin nào có thể ảnh hưởng mã tôi theo dõi?", "Sự kiện cần theo dõi tuần này", "6 tab trong Tin tức khác nhau thế nào và lọc tin ra sao?"],
    ai: ["13 tab của Nhịp AI dùng để làm gì?", "Khi nào nên dùng Tự động, khi nào chọn tab riêng?", "Vì sao AI không nhận mã của sàn khác?", "Làm sao lưu báo cáo và hỏi tiếp?"],
    "lich-su": ["Lịch sử có những tab nào và dùng để làm gì?", "Làm sao xuất CSV nhật ký theo bộ lọc?", "Dòng thời gian của một mã cho biết điều gì?", "Thống kê trong Lịch sử đo những gì?"],
    "cai-dat": ["Cài đặt có những nhóm nào?", "Thêm API key AI ở đâu và kiểm tra kết nối thế nào?", "Danh bạ mã–doanh nghiệp dùng để làm gì?", "Đổi màu tăng/giảm và cỡ chữ ở đâu?"]
  };
  if (mode !== "auto") return by[modeKey(mode)] || [];
  const pm = PAGE_MODE[r] || "dashboard";
  if (pm === "giao-dich") return [...by["giao-dich"].slice(0, 3), "Trang này dùng để làm gì?"];
  return [...(by[pm] || []).slice(0, 2), "Trang này dùng để làm gì?", "Các mục của Nhịp Đầu Tư dùng để làm gì?", "Làm sao tạo cảnh báo giá?"];
}

/* ---------- Hành động dưới câu trả lời (không tốn token; AI chỉ đề xuất, người dùng bấm mới thực hiện) ---------- */
function actsFor(m, i) {
  const mt = m.meta || {}, md = modeKey(mt.mode), s = (mt.syms || [])[0], a = [];
  if (s && md === "giao-dich") a.push([`go:giao-dich?s=${s}`, `💹 Mở Giao dịch ${s}`]);
  if (s) a.push(["chart", `📈 Biểu đồ ${s}`], ["ana", "🔬 Phân tích"], ST.watchlist.includes(s) ? ["none", "★ Đang theo dõi"] : ["wl", "☆ Theo dõi"], ["al", "🔔 Cảnh báo"]);
  else if (md === "dashboard" || md === "thi-truong") a.push(["go:thi-truong", "Mở Thị trường"], ["go:dashboard", "Dashboard"]);
  else if (PAGES[md] && md !== "ai") a.push([`go:${md}`, `Mở ${PAGES[md]}`]);
  if (mt.mode && mt.mode !== "guide") a.push(["save", mt.report ? "💾 Lưu báo cáo" : "💾 Lưu"]);
  a.push(["copy", "📋 Sao chép"], ["pdf", "⬇ Tải PDF"]);
  return `<div class="aix-acts">${a.map(([k, n]) => `<button type="button" data-a="${k}" data-i="${i}"${k === "none" ? " disabled" : ""}>${n}</button>`).join("")}</div>`
    + (m.alOpen ? `<div class="aix-al"><select data-alt><option value="above">Giá ≥</option><option value="below">Giá ≤</option><option value="pct">Biến động ± ≥ (%)</option></select><input data-alv inputmode="decimal" placeholder="Giá (đồng) hoặc %"><button type="button" class="btn primary" data-a="alok" data-i="${i}">Tạo</button><small>Giá tính bằng đồng/cổ phiếu (VD 98500). Máy chủ kiểm tra liên tục, cả khi bạn đóng ứng dụng.</small></div>` : "");
}
/* V2.82 — "Hỏi tiếp" dưới câu trả lời mới nhất: gợi ý đào sâu điểm cộng cơ bản/tin theo đúng mã – đúng sàn (AI chỉ nhận câu hỏi, không tự thao tác) */
function followFor(m, i) {
  const mt = m.meta || {}, md = modeKey(mt.mode); let last = false; try { last = i === cur().msgs.length - 1 } catch { }
  if (m.err || m.pending || !last || !mt.mode || mt.mode === "guide") return "";
  const s = (mt.syms || [])[0], h = hxn(), q = [];
  if (s && md === "giao-dich") { const e = exLbl(s); q.push(`Điều kiện nào làm kế hoạch ${s}${e ? " (" + e + ")" : ""} mất hiệu lực?`, `Vì sao SL/TP của ${s} nằm ở mức đó?`, `Tóm tắt 3 khung của ${s} thành bảng ngắn gọn`) }
  else if (s) { const e = exLbl(s); q.push(`Điểm cộng cơ bản của ${s}${e ? " (" + e + ")" : ""} chấm theo ngưỡng nào?`, `Bài tin nào được tính vào điểm cộng tin của ${s}?`, `${s} có cờ đỏ (lỗ, tin xấu) không?`) }
  else if (md === "dashboard" || md === "thi-truong") q.push(`Trong bảng điểm ${h}, mã nào có nền > 0?`, `Mã nào ở sàn ${h} đang có cờ đỏ?`);
  else if (md === "theo-doi") q.push(`Mã nào trong Theo dõi sàn ${h} có nền > 0 hoặc cờ đỏ?`, "Mã theo dõi nào có thanh khoản tăng?");
  else if (md === "danh-muc") q.push("Mã nào trong danh mục có nền = 0 hoặc cờ đỏ?", "Điểm cộng cơ bản của các mã trong danh mục khác nhau thế nào?");
  else if (md === "tin-tuc") q.push("Tin nào đang được tính vào điểm cộng tin của các mã tôi theo dõi?");
  else if (md === "canh-bao") q.push("Nhóm cảnh báo nào hợp với mã tôi đang theo dõi?", "Cảnh báo chạy khi nào và dừng khi nào?");
  else if (md === "lich-su") q.push("Làm sao xuất nhật ký này ra CSV?");
  else if (md === "cai-dat") q.push("Sau khi chỉnh xong, làm sao kiểm tra kết nối AI?");
  else if (md === "ai") q.push("Tab nào hợp nhất với câu hỏi của tôi?");
  return q.length ? `<div class="aix-fu"><span>Hỏi tiếp:</span>${q.map(t => `<button type="button" data-p="${esc(t)}">${esc(t)}</button>`).join("")}</div>` : "";
}
function bubble(m, i) {
  if (m.r === "u") return `<div class="bubble user">${esc(m.t)}${(m.att || []).length ? `<div class="aix-ua">${m.att.map(a => `<span>${a.k === "img" ? "🖼" : "📄"} ${esc(a.n)}</span>`).join("")}</div>` : ""}</div>`;
  if (m.pending) return `<div class="bubble bot aix-wait"><span class="dots"><i></i><i></i><i></i></span> Nhịp AI đang phân tích… <button type="button" class="aix-stop" data-a="stop">⏹ Dừng</button></div>`;
  if (m.stopped) return `<div class="bubble bot aix-stopped"><span>⏹ ${esc(m.t)}</span><button type="button" data-a="retry" data-i="${i}">↻ Hỏi lại</button></div>`;
  const mt = m.meta || {}, used = (mt.used || []).map(u => `<span>${esc(u)}</span>`).join("");
  const via = m.err ? "" : `<div class="via">${esc(MODE_NAME[mt.mode] || "")}${mt.name ? " · " + esc(mt.name) : ""}${mt.tok ? ` · ngữ cảnh ~${mt.tok} token` : ""}${mt.at ? " · " + tm(mt.at) : ""}</div>${used ? `<div class="aix-used">Dữ liệu đã dùng: ${used}</div>` : ""}`;
  return `<div class="bubble bot${mt.report ? " rep" : ""}${m.err ? " err" : ""}">${md(m.t)}${via}${m.w ? `<div class="warn">${esc(m.w)}</div>` : ""}${m.err ? "" : actsFor(m, i) + followFor(m, i)}</div>`;
}

/* ---------- Thành phần chat (dùng cho cả cửa sổ nổi và trang đầy đủ) ---------- */
const inst = new Set();
let busy = false, CTL = null, LASTREQ = null;
function R_plus(I) { const b = I.root.querySelector(".aix-plus"); if (b && !b.innerHTML) b.innerHTML = NHIPAICompose.ICON.plus }
const stopAI = () => { if (CTL) { try { CTL.abort() } catch {} } };
function mount(host, o = {}) {
  const I = { host, hist: false, symLocked: false };
  host.innerHTML = `<div class="aix${o.page ? " page" : ""}">
<div class="aix-top"><input class="aix-sym" placeholder="Mã" maxlength="12" autocomplete="off" aria-label="Mã cổ phiếu"></div>
<div class="aix-modes" role="tablist">${MODES.map(([k, n]) => `<button type="button" role="tab" data-m="${k}">${n}</button>`).join("")}</div>
<div class="aix-ctx"><span class="aix-pg"></span></div>
<div class="aix-warn"></div>
<div class="aix-note" role="status" aria-live="polite" hidden></div>
<div class="aix-body chat"></div>
<div class="aix-sug"></div>
<form class="aix-f"><div class="aix-box"><div class="aix-att" hidden></div><textarea class="aix-q" rows="1" autocomplete="off" enterkeyhint="send"></textarea><div class="aix-tools"><button type="button" class="aix-tb aix-plus" aria-label="Đính kèm ảnh hoặc tài liệu" aria-haspopup="true" aria-expanded="false"></button><select class="aix-pv" aria-label="Chọn AI"></select><span class="aix-lt" role="status" aria-live="polite"></span><button type="button" class="aix-tb aix-mic" aria-label="Nói để nhập" aria-pressed="false"></button><button class="aix-send" type="submit" aria-label="Gửi"><svg class="i-go" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg><svg class="i-stop" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2.5"/></svg></button></div><div class="aix-menu" hidden><button type="button" data-pick="cam">📷 <span>Chụp ảnh</span></button><button type="button" data-pick="img">🖼 <span>Chọn ảnh</span></button><button type="button" data-pick="doc">📄 <span>Tài liệu <small>PDF, Word, TXT, CSV…</small></span></button></div></div><input class="aix-in-img" type="file" accept="image/*" multiple hidden><input class="aix-in-cam" type="file" accept="image/*" capture="environment" hidden><input class="aix-in-doc" type="file" accept=".pdf,.docx,.txt,.md,.csv,.tsv,.json,.xml,.html,.htm,.log,text/*,application/pdf" multiple hidden></form>
<p class="aix-foot">AI có thể sai · Cần kiểm tra nguồn dữ liệu · Chỉ phân tích, không đặt lệnh · Không phải khuyến nghị đầu tư.</p></div>`;
  I.root = host.firstElementChild;
  if (window.NHIPAISym) NHIPAISym.attach(I);
  if (window.NHIPAICompose) { NHIPAICompose.attach(I); R_plus(I) }
  const R = I.root, q = s => R.querySelector(s);
  I.draw = () => {
    if (!document.body.contains(host)) return false;
    const c = cur(), mode = c.mode || "auto", r = route();
    $$("[data-m]", R).forEach(b => b.classList.toggle("on", b.dataset.m === mode));
    q(".aix-pg").innerHTML = "📍 " + esc(PAGES[r] || "Nhịp Đầu Tư") + ' · <span class="aix-hs">' + esc(hxn()) + "</span>";
    const si = q(".aix-sym"); if (!I.symLocked && document.activeElement !== si) { si.value = pageSym() || si.value; const rs = window.NHIPAISym && si.value ? NHIPAISym.resolve(si.value) : null; if (rs && rs.state === "other") si.value = ""; else if (rs && rs.state === "ok") I.symOk = rs.sym }
    si.placeholder = "Mã " + hxn();
    si.style.display = needSym(mode) ? "" : "none";
    { const on = $("[data-m].on", R), bar = q(".aix-modes"); if (on && bar) bar.scrollLeft = Math.max(0, on.offsetLeft - (bar.clientWidth - on.offsetWidth) / 2) }
    const pv = q(".aix-pv"), pvv = pv.value; pv.innerHTML = provOpts(); pv.value = [...pv.options].some(x => x.value === pvv) ? pvv : "auto";
    q(".aix-warn").innerHTML = ST.ai.providers.some(p => p.ready) ? "" : 'Chưa có AI nào sẵn sàng. <a href="#/cai-dat">Thêm API key trong Cài đặt →</a>';
    q(".aix-q").placeholder = PH[mode]; { const sb = q(".aix-send"); q(".aix-f").classList.toggle("busy", busy); sb.setAttribute("aria-label", busy ? "Dừng trả lời" : "Gửi"); sb.title = busy ? "Dừng" : "Gửi"; I.refreshComposer && I.refreshComposer() }
    const body = q(".aix-body");
    if (I.hist) {
      body.innerHTML = `<div class="aix-hl"><div class="aix-hh"><b>Cuộc trò chuyện</b><button type="button" data-a="new">＋ Mới</button><button type="button" data-a="back">Quay lại</button></div>${convList()}</div>`;
      q(".aix-sug").innerHTML = "";
    } else {
      const sy = q(".aix-sym").value.trim().toUpperCase();
      body.innerHTML = c.msgs.map(bubble).join("") || `<div class="bubble bot"><p>Xin chào! Tôi là trợ lý AI chứng khoán của NHIP. Tôi hiểu toàn bộ 12 mục trong ứng dụng. Các tab phía trên có tên giống hệt menu: chọn đúng mục để tôi trả lời theo bố cục của mục đó, hoặc dùng <b>Tự động</b> để tôi tự nhận ra mục phù hợp. Bạn đang làm việc ở sàn ${esc(hxn())}: tôi chỉ dùng mã và dữ liệu của sàn này (mã sàn khác tôi sẽ hỏi bạn chuyển sàn). Bạn muốn bắt đầu từ đâu?</p><div class="via">Dữ liệu: nến ngày VNDirect + tin RSS · không realtime · AI chỉ phân tích và đề xuất</div></div>`;
      const chips = []; if (modeKey(mode) === "phan-tich" || modeKey(mode) === "tong-quan" || (mode === "auto" && sy && (r === "phan-tich" || r === "tong-quan"))) chips.push(`<button type="button" class="rep" data-rep="1">📑 Báo cáo 5 phần${sy ? " · " + esc(sy) : ""}</button>`);
      sugg(mode, sy).forEach(t => chips.push(`<button type="button" data-p="${esc(t)}">${esc(t)}</button>`));
      q(".aix-sug").innerHTML = chips.join("");
      body.scrollTop = 1e9;
    }
    return true;
  };
  const go = (text, x = {}) => {
    const base = { mode: cur().mode || "auto", symbol: q(".aix-sym").value.trim(), provider: q(".aix-pv").value, ...x };
    const g = window.NHIPAISym ? NHIPAISym.check(I, text, base) : { ok: true, sym: base.symbol };
    if (!g.ok) return false;
    return send(text, { ...base, symbol: g.sym || "" });
  };
  R.addEventListener("click", e => {
    const t = e.target.closest("button,a"); if (!t) return;
    if (t.tagName === "A" && t.getAttribute("href")?.startsWith("#/")) { if (mobile()) togglePanel(false); return }
    if (t.dataset.m) { const c = cur(); c.mode = t.dataset.m; save(); redrawAll(); if ((c.mode === "tong-quan" || c.mode === "phan-tich" || c.mode === "giao-dich") && !q(".aix-sym").value) q(".aix-sym").focus(); return }
    if (t.dataset.p) { q(".aix-q").value = t.dataset.p; q(".aix-f").requestSubmit(); return }
    if (t.dataset.rep) { const sy = q(".aix-sym").value.trim().toUpperCase(); if (!sy) { toast("Nhập mã cổ phiếu để lập báo cáo", 1); q(".aix-sym").focus(); return } go(`Báo cáo phân tích ${sy}`, { mode: modeKey(cur().mode) === "tong-quan" ? "tong-quan" : "phan-tich", report: 1, symbol: sy }); return }
    if (t.dataset.cv) { CS.cur = CS.curBy[hx()] = t.dataset.cv; I.hist = false; save(); redrawAll(); return }
    if (t.dataset.dc) { CS.list = CS.list.filter(x => x.id !== t.dataset.dc); if (CS.cur === t.dataset.dc) CS.cur = ""; if (CS.curBy[hx()] === t.dataset.dc) CS.curBy[hx()] = ""; save(); redrawAll(); return }
    if (t.dataset.a) act(t.dataset.a, +t.dataset.i, I, t);
  });
  R.addEventListener("input", e => { if (e.target.classList.contains("aix-sym")) { I.symLocked = !!e.target.value; e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9.]/g, ""); I.draw() } });
  q(".aix-f").onsubmit = e => {
    e.preventDefault();
    if (busy) { stopAI(); return }
    const v = q(".aix-q").value.trim(), att = I.getAtt ? I.getAtt() : [];
    if (I.pendingAtt && I.pendingAtt()) { toast("Tệp đính kèm đang được đọc, chờ một chút…"); return }
    if (!v && !att.length) { q(".aix-q").focus(); return }
    if (I.stopMic) I.stopMic();
    q(".aix-q").value = "";
    const r = go(v || (att.some(a => a.k === "img") ? "Hãy phân tích ảnh đính kèm." : "Hãy tóm tắt và phân tích tài liệu đính kèm."), { att });
    if (r !== false) { I.clearAtt && I.clearAtt() } else q(".aix-q").value = v;
  };
  I.go = go; I.showHist = v => { I.hist = v ?? !I.hist; I.draw() };
  inst.add(I); I.draw(); return I;
}
function redrawAll() { for (const I of [...inst]) if (!I.draw()) inst.delete(I); renderSide() }

function convList() {
  return CS.list.filter(c => chatHouse(c) === hx()).map(c => `<div class="aix-cv${c.id === CS.cur ? " on" : ""}"><button type="button" data-cv="${c.id}"><b>${esc(c.title)}</b><small>${esc(MODE_NAME[c.mode] || "")} · ${c.msgs.length} tin · ${tm(c.t)}</small></button><button type="button" class="x" data-dc="${c.id}" aria-label="Xóa">×</button></div>`).join("") || '<p class="muted">Chưa có cuộc trò chuyện.</p>';
}

/* ---------- Gửi câu hỏi ---------- */
async function send(text, o = {}) {
  text = String(text || "").trim(); if (!text || busy) return;
  const c = cur(), att = o.att || [], hist = c.msgs.filter(m => m.t && !m.pending && !m.err && !m.stopped).slice(-4).map(m => ({ r: m.r, t: m.t.slice(0, 250) }));
  if (!c.msgs.length) c.title = text.slice(0, 48);
  c.t = Date.now(); c.msgs.push({ r: "u", t: text, att: att.map(a => ({ n: a.name, k: a.k })) }); const w = { r: "b", t: "", pending: 1 }; c.msgs.push(w); busy = true; LASTREQ = { text, o }; const ctl = CTL = new AbortController(); redrawAll();
  const errs = $$("#view .inline-error,#view .placeholder").map(e => e.textContent.trim().slice(0, 180)).filter(Boolean).slice(0, 2);
  try {
    const d = await api("/api/ai", { method: "POST", body: { question: text, mode: o.mode || "auto", report: o.report ? 1 : undefined, symbol: o.symbol || "", house: hx(), provider: o.provider || "auto", withNews: o.withNews ? 1 : undefined, withMarket: o.withMarket ? 1 : undefined, withPortfolio: o.withPortfolio ? 1 : undefined, pfId: o.pfId ? String(o.pfId).slice(0, 20) : undefined, screen: route(), errs, history: hist, ctx: aiCtx(), reqId: uid(), images: att.filter(a => a.k === "img").map(a => ({ mime: a.mime, data: a.data })), docs: att.filter(a => a.k === "doc").map(a => ({ name: a.name, text: a.text })) }, signal: ctl.signal });
    w.t = d.answer; w.meta = { mode: d.mode, syms: d.syms || [], used: d.used || [], report: !!d.report, name: d.name, model: d.model, tok: d.ctxChars ? Math.round(d.ctxChars / 3.2) : 0, at: Date.now(), q: text, att: att.map(a => a.name) };
    const ws = []; if (d.attempts?.length) ws.push("Đã tự chuyển AI: " + d.attempts.map(a => `${a.name}: ${a.label || "lỗi"} (${a.error})`).join("; ")); if (d.verification && !d.verification.ok) ws.push("⚠ Số liệu chưa đối chiếu được với dữ liệu hệ thống: " + d.verification.unverified.join(", ") + ". Hãy kiểm tra trước khi dùng."); if (att.some(a => a.k === "img")) ws.push("🖼 Số liệu đọc từ ảnh chưa được hệ thống đối chiếu tự động — hãy kiểm tra lại."); if (ws.length) w.w = ws.join(" · ");
  } catch (e) { if (e.name === "AbortError" || e.data?.aborted) { w.stopped = 1; w.t = "Đã dừng theo yêu cầu của bạn." } else { w.err = 1; w.t = e.data?.needSymbol || e.data?.wrongHouse ? e.message : "Không có câu trả lời: " + e.message; if (e.data?.configured === false) w.w = "Vào Cài đặt để thêm API key." } }
  w.pending = 0; busy = false; if (CTL === ctl) CTL = null; save(); redrawAll();
}

/* ---------- Thực hiện hành động (mọi thao tác ghi đều cần người dùng bấm/xác nhận) ---------- */
async function act(a, i, I, btn) {
  const c = cur(), m = c.msgs[i], mt = m?.meta || {}, s = (mt.syms || [])[0];
  const nav = h => { location.hash = h; if (mobile()) togglePanel(false) };
  if (a === "new") return newChat();
  if (a === "stop") return stopAI();
  if (a === "retry") { const u = c.msgs[i - 1]; if (!u || u.r !== "u" || busy) return; if (LASTREQ && LASTREQ.text === u.t) { c.msgs.splice(i - 1, 2); save(); redrawAll(); return send(LASTREQ.text, LASTREQ.o) } c.msgs.splice(i - 1, 2); save(); I.root.querySelector(".aix-q").value = u.t; I.refreshComposer && I.refreshComposer(); redrawAll(); return }
  if (a === "back") return I.showHist(false);
  if (!m) return;
  if (a.startsWith("go:")) return nav("#/" + a.slice(3));
  if (a === "chart") return nav("#/tong-quan?s=" + s);
  if (a === "ana") return nav("#/phan-tich?s=" + s);
  if (a === "wl") { if (!(await NhipDlg.confirm({ tone: "info", icon: "star", title: "Thêm vào Theo dõi?", subject: s, message: "Mã này sẽ được thêm vào danh sách Theo dõi của bạn.", okText: "Thêm", cancelText: "Để sau" }))) return; try { ST.watchlist = [...new Set([...ST.watchlist, s])]; await saveWatch(); toast(`Đã thêm ${s} vào Theo dõi`) } catch (e) { toast(e.message, 1) } return redrawAll() }
  if (a === "al") { m.alOpen = !m.alOpen; return redrawAll() }
  if (a === "alok") {
    const box = btn && btn.closest(".aix-al"); if (!box) return;
    const ty = box.querySelector("[data-alt]").value, v = parseFloat(String(box.querySelector("[data-alv]").value).replace(",", "."));
    if (!(v > 0)) return toast("Nhập ngưỡng lớn hơn 0", 1);
    m.alOpen = false; save(); window.alCreateLegacy({ sym: s, type: ty, val: v }).then(() => toast(`Đã tạo cảnh báo ${s} (xem trong mục Cảnh báo)`)).catch(e => toast(e.message, 1)); return redrawAll();
  }
  if (a === "save") { RP.unshift({ id: uid(), t: Date.now(), house: hx(), sym: s || "", mode: mt.mode, title: mt.report ? `Báo cáo ${s}` : (mt.q || "Câu trả lời").slice(0, 60), text: m.t, via: mt.name || "" }); RP = RP.slice(0, 30); put(RKEY, RP); toast("Đã lưu vào Báo cáo đã lưu (trang Phân tích AI)"); return redrawAll() }
  if (a === "copy") { try { const k = await NHIPAIExport.copy(m.t); toast(k === "rich" ? "Đã sao chép — dán vào đâu cũng giữ nguyên mẫu" : "Đã sao chép (văn bản thường)") } catch { toast("Không sao chép được", 1) } return }
  if (a === "pdf") {
    if (btn) { btn.disabled = true; btn.dataset.t = btn.textContent; btn.textContent = "⏳ Đang tạo PDF…" }
    try { const r = await NHIPAIExport.pdf(m.t, { q: mt.q, mode: MODE_NAME[mt.mode] || "", name: mt.name, at: mt.at, att: mt.att }); toast(`Đã tạo ${r.name} (${r.pages} trang)`) } catch (e) { toast("Không tạo được PDF: " + (e.message || e), 1) }
    if (btn) { btn.disabled = false; btn.textContent = btn.dataset.t }
  }
}

/* ---------- Cửa sổ nổi ✦ ---------- */
const AW = document.createElement("div"); AW.id = "aiPanel"; AW.className = "aiw hidden";
AW.innerHTML = `<div class="aiw-h"><b>${ico("ai")} Nhịp AI</b><span class="aiw-sp"></span><button type="button" id="aw-new" title="Cuộc trò chuyện mới" aria-label="Cuộc trò chuyện mới">＋</button><button type="button" id="aw-hist" title="Lịch sử trò chuyện" aria-label="Lịch sử">🕘</button><a href="#/ai" id="aw-full" title="Mở trang đầy đủ" aria-label="Mở trang đầy đủ">⤢</a><button type="button" id="aw-x" aria-label="Đóng">×</button></div><div class="aix-host"></div>`;
document.body.append(AW);
let WI = null;
function fit() { const vv = window.visualViewport; if (!vv || AW.classList.contains("hidden")) return; if (mobile()) { AW.style.height = vv.height + "px"; AW.style.top = vv.offsetTop + "px" } else { AW.style.height = AW.style.top = "" } }
function togglePanel(open) {
  const show = open ?? AW.classList.contains("hidden"); if (show && route() === "ai") return;
  AW.classList.toggle("hidden", !show); document.body.classList.toggle("ai-open", show && mobile());
  if (show) { followRoute(); if (!WI || !document.body.contains(WI.host)) WI = mount($(".aix-host", AW)); WI.showHist(false); WI.draw && WI.draw(); fit(); setTimeout(() => !mobile() && WI.root.querySelector(".aix-q").focus(), 60) }
  else { AW.style.height = AW.style.top = "" }
}
$("#aw-x").onclick = () => togglePanel(false); $("#aw-full").onclick = () => togglePanel(false);
$("#aw-new").onclick = () => { newChat(); WI?.showHist(false) }; $("#aw-hist").onclick = () => WI?.showHist();
addEventListener("keydown", e => { if (e.key === "Escape" && !AW.classList.contains("hidden")) togglePanel(false) });
if (window.visualViewport) { visualViewport.addEventListener("resize", fit); visualViewport.addEventListener("scroll", fit) }
let moved = false, drag = false, sx, sy, ox, oy; const W = $("#aiWidget"), L = $("#aiLauncher");
L.onpointerdown = e => { drag = true; moved = false; sx = e.clientX; sy = e.clientY; const r = W.getBoundingClientRect(); ox = r.left; oy = r.top; L.setPointerCapture(e.pointerId) };
L.onpointermove = e => { if (!drag) return; const dx = e.clientX - sx, dy = e.clientY - sy; if (Math.abs(dx) + Math.abs(dy) > 6) moved = true; if (moved) { W.style.left = Math.max(4, Math.min(innerWidth - W.offsetWidth, ox + dx)) + "px"; W.style.top = Math.max(4, Math.min(innerHeight - W.offsetHeight, oy + dy)) + "px"; W.style.right = W.style.bottom = "auto" } };
L.onpointerup = () => { drag = false; if (!moved) togglePanel(); setTimeout(() => moved = false, 120) }; L.onpointercancel = () => drag = false;
const clampW = () => { const r = W.getBoundingClientRect(); if (r.right > innerWidth || r.bottom > innerHeight || r.left < 0 || r.top < 0) W.style.left = W.style.top = W.style.right = W.style.bottom = ""; fit() };
addEventListener("resize", clampW); setTimeout(clampW, 300);
const syncRoute = () => { document.body.classList.toggle("on-ai", route() === "ai"); followRoute(); if (route() === "ai") togglePanel(false); inst.forEach(I => I.draw && I.draw()) };
addEventListener("hashchange", syncRoute); syncRoute();
let lastPageSym = pageSym();
addEventListener("nhip:chart-symbol", e => { const s = String(e && e.detail && e.detail.sym || "").toUpperCase(); if (!s || s === lastPageSym) return; lastPageSym = s; inst.forEach(I => { if (!I.root) return; I.symLocked = false; I.symOk = ""; if (window.NHIPAISym) NHIPAISym.note(I, ""); I.draw && I.draw() }) });
addEventListener("nhip:house-changed", () => {
  inst.forEach(I => { const si = I.root && I.root.querySelector(".aix-sym"); if (si) { si.value = ""; si.classList.remove("bad") } I.symLocked = false; I.symOk = ""; I.hist = false; if (window.NHIPAISym) NHIPAISym.note(I, "") });
  if (window.NHIPAISym) NHIPAISym.close();
  redrawAll();
});
const liveInst = () => [...inst].reverse().find(I => I.draw && document.body.contains(I.host) && I.host.offsetParent !== null) || [...inst].find(I => document.body.contains(I.host));
/* Sau khi khách đồng ý chuyển sàn: điền mã vào ô và gửi lại đúng câu hỏi đang chờ, ở sàn mới */
function resume(o = {}) {
  if (route() !== "ai" && AW.classList.contains("hidden")) togglePanel(true);
  const I = liveInst(); if (!I) return;
  const si = I.root.querySelector(".aix-sym");
  if (o.sym) { si.value = o.sym; I.symLocked = true; I.symOk = o.sym; si.classList.remove("bad") }
  if (window.NHIPAISym) NHIPAISym.note(I, "");
  redrawAll();
  if (o.text) { const { symbol, ...rest } = o.opts || {}; I.go(o.text, rest) }
}

/* ---------- Trang Phân tích AI (#/ai) ---------- */
function renderSide() {
  const el = $("#aix-side"); if (!el) return;
  const cx = aiCtx(), r = route(), ready = ST.ai.providers.filter(p => p.ready).map(p => p.name);
  el.innerHTML = `<section class="panel"><div class="eyebrow">AI ĐANG NHÌN THẤY</div><ul class="aix-ul"><li>Sàn đang làm việc: <b>${esc(hxn())}</b></li><li>Mục đang xem: <b>${esc(PAGES[r] || "—")}</b></li><li>Tab AI: <b>${esc(MODE_NAME[modeKey(cur().mode)] || "Tự động")}</b></li><li>Mã: <b>${esc(cx.sym || pageSym() || "—")}</b></li><li>Theo dõi: <b>${ST.watchlist.length}</b> mã · Danh mục: <b>${ST.portfolio.length}</b> vị thế</li><li>AI sẵn sàng: <b>${ready.length ? esc(ready.join(" → ")) : "chưa có"}</b></li></ul><p class="source-note">Cẩm nang đủ 12 mục luôn có sẵn ở dạng rút gọn (tab Tự động nhận cả bản đồ cấu trúc, tab mục nhận đầy đủ bố cục của mục đó); dữ liệu (giá, thị trường, tin, danh mục) chỉ nạp khi câu hỏi cần — mỗi câu trả lời hiện số token ước tính.</p></section>
<section class="panel"><div class="eyebrow">Nhịp AI ĐỌC ĐƯỢC</div><div class="aix-hub">${Object.entries(PAGES).filter(([k]) => k !== "ai").map(([k, n]) => `<a href="#/${k}">${n}</a>`).join("")}</div></section>
<section class="panel"><div class="eyebrow">CUỘC TRÒ CHUYỆN ${esc(hxn())} (${CS.list.filter(c => chatHouse(c) === hx()).length})</div><div class="aix-hl"><div class="aix-hh"><button type="button" data-a="new">＋ Cuộc trò chuyện mới</button></div>${convList()}</div></section>
<section class="panel"><div class="eyebrow">BÁO CÁO ĐÃ LƯU ${esc(hxn())} (${RP.filter(x => (x.house || "HOSE") === hx()).length})</div>${RP.filter(x => (x.house || "HOSE") === hx()).map(x => `<details class="aix-rp"><summary><b>${esc(x.title)}</b><small>${tm(x.t)}</small></summary><div class="bubble bot">${md(x.text)}</div><div class="aix-acts">${x.sym ? `<a class="btn pale" href="#/phan-tich?s=${esc(x.sym)}">Mở ${esc(x.sym)}</a>` : ""}<button type="button" data-rd="${x.id}">Xóa</button></div></details>`).join("") || '<p class="muted">Bấm "💾 Lưu" dưới câu trả lời để giữ báo cáo.</p>'}</section>`;
}
document.addEventListener("click", e => {
  const el = $("#aix-side"); if (!el || !el.contains(e.target)) return;
  const t = e.target.closest("button"); if (!t) return;
  if (t.dataset.rd) { RP = RP.filter(x => x.id !== t.dataset.rd); put(RKEY, RP); renderSide() }
  else if (t.dataset.cv) { CS.cur = CS.curBy[hx()] = t.dataset.cv; save(); redrawAll() }
  else if (t.dataset.dc) { CS.list = CS.list.filter(x => x.id !== t.dataset.dc); if (CS.cur === t.dataset.dc) CS.cur = ""; if (CS.curBy[hx()] === t.dataset.dc) CS.curBy[hx()] = ""; save(); redrawAll() }
  else if (t.dataset.a === "new") newChat();
});
function page() {
  const ok = mine();
  view(`<div class="view-h"><div><div class="eyebrow">TRỢ LÝ PHÂN TÍCH CHỨNG KHOÁN</div><h1>${hico("ai")}Phân tích AI</h1></div></div><div class="aix-pagegrid"><section class="panel aix-main"><div class="aix-host"></div></section><aside id="aix-side" class="aix-side"></aside></div>`);
  const I = mount($(".aix-host"), { page: true });
  renderSide();
  const pend = sessionStorage.pending;
  if (pend) {
    sessionStorage.removeItem("pending"); let p = {}; try { p = JSON.parse(pend) } catch {}
    if (p.question && ok()) {
      const fm = PAGE_MODE[lastSec], mode = fm || (p.withPortfolio ? "danh-muc" : p.withMarket ? "thi-truong" : p.symbol ? "phan-tich" : "auto");   // mục vừa trỏ sang AI quyết định tab
      if (p.symbol) { I.root.querySelector(".aix-sym").value = p.symbol; I.symLocked = true }
      const c = cur(); c.mode = mode; save(); I.draw();
      I.go(p.question, { mode, symbol: p.symbol || "", provider: "auto", withNews: p.withNews, withMarket: p.withMarket, withPortfolio: p.withPortfolio, pfId: p.pfId });
    }
  }
}
window.NHIPAI = { page, open: () => togglePanel(true), send, resume, pageSym };
})();
