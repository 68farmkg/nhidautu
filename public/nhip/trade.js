/* NHIP · Khối MUA / BÁN trong chế độ Đa khung (v1.68)
   Luồng: chọn KHÁCH HÀNG → chọn DANH MỤC của khách → phiếu lệnh (Mua/Bán, SL, giá, phí) → màn hình XÁC NHẬN tóm tắt → ghi.
   Ghi giao dịch dùng đúng pfApply/pfSave của trang Danh mục (cùng sổ, cùng giá vốn bình quân, cùng tiền mặt, cùng nhật ký) nên
   mua/bán xong, vị thế – tiền mặt – lãi/lỗ đã thực hiện của danh mục tự đổi; mọi giao dịch ghi kèm tên khách và nhãn "từ biểu đồ".
   Thiết kế theo các nền tảng giao dịch: PC = phiếu lệnh ở cột phải cạnh biểu đồ; điện thoại = thanh Mua/Bán cố định phía dưới
   (tầm ngón cái) mở bảng trượt từ dưới lên; luôn hiện rõ "Khách – Danh mục"; luôn có bước xác nhận (tiền, phí, tiền mặt sau lệnh).
   Đây là SỔ GHI CHÉP của bạn, không đặt lệnh lên sàn / công ty chứng khoán. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root);
  else root.NHIPTrade = factory(root);
})(typeof self !== "undefined" ? self : this, function (W) {
  "use strict";

  /* ---------- Hàm thuần (kiểm thử được trong Node) ---------- */
  var FEE_DEFAULT = 0.15, TAX_SELL = 0.1; /* % — phí môi giới tham khảo, sửa được; thuế bán 0,1% */
  var nf = function (v, d) { return v == null || !isFinite(v) ? "—" : Number(v).toLocaleString("vi-VN", { maximumFractionDigits: d || 0 }); };
  var mny = function (v) { return v == null || !isFinite(v) ? "—" : Math.abs(v) >= 1e9 ? nf(v / 1e9, 2) + " tỷ" : Math.abs(v) >= 1e6 ? nf(v / 1e6, 1) + " tr" : nf(Math.round(v)); };
  /* bước giá HOSE: <10.000đ: 10 · 10.000–49.950đ: 50 · ≥50.000đ: 100 (chỉ để bấm +/−, không chặn nhập tay) */
  function tick(p) { p = +p || 0; return p < 10000 ? 10 : p < 50000 ? 50 : 100; }
  function autoFee(side, value, feePct, taxPct) {
    var f = isFinite(feePct) && feePct >= 0 ? feePct : FEE_DEFAULT, t = isFinite(taxPct) && taxPct >= 0 ? taxPct : TAX_SELL;
    return Math.round(value * f / 100 + (side === "sell" ? value * t / 100 : 0));
  }
  /* o: { side, qty, price, fee, pos:{qty,cost}|null, cash, useCash, last } */
  function calc(o) {
    var q = +o.qty || 0, p = +o.price || 0, fee = Math.max(0, +o.fee || 0), side = o.side === "sell" ? "sell" : "buy";
    var held = o.pos ? +o.pos.qty || 0 : 0, cost = o.pos ? +o.pos.cost || 0 : 0, cash = +o.cash || 0, value = q * p;
    var r = { side: side, value: value, fee: fee, errors: [], warns: [], held: held, cashBefore: cash };
    if (!(q > 0) || q !== Math.floor(q)) r.errors.push("Số lượng phải là số nguyên lớn hơn 0");
    if (!(p > 0)) r.errors.push("Giá phải lớn hơn 0");
    if (side === "buy") {
      r.total = value + fee; r.qtyAfter = held + q;
      r.costAfter = r.qtyAfter > 0 ? (cost * held + value + fee) / r.qtyAfter : 0;
      r.cashAfter = o.useCash ? cash - r.total : cash;
      if (o.useCash && r.cashAfter < 0) r.warns.push("Tiền mặt không đủ: thiếu " + nf(-r.cashAfter) + " ₫ — tiền mặt sẽ ÂM nếu vẫn ghi");
    } else {
      if (q > held) r.errors.push(held > 0 ? "Chỉ đang giữ " + nf(held) + " cp, không thể bán " + nf(q) : "Danh mục chưa giữ mã này để bán");
      r.total = value - fee; r.qtyAfter = held - q; r.costAfter = cost;
      r.costBasis = q * cost; r.pl = value - fee - q * cost; r.exit = exitKind(r.pl); r.plPct = cost > 0 && q > 0 ? r.pl / (q * cost) * 100 : null;
      r.cashAfter = o.useCash ? cash + r.total : cash;
    }
    if (q > 0 && q % 100 !== 0) r.warns.push("Số lượng không chẵn lô 100 (lô lẻ)");
    if (o.last > 0 && p > 0 && Math.abs(p / o.last - 1) > 0.07) r.warns.push("Giá lệch " + nf(Math.abs(p / o.last - 1) * 100, 1) + "% so với giá gần nhất (" + nf(o.last) + " ₫) — kiểm tra lại");
    return r;
  }
  /* Giá hòa vốn khi BÁN: giá tối thiểu để tiền thực nhận (sau phí + thuế bán) bằng đúng vốn bình quân. Làm tròn LÊN theo bước giá. */
  function breakEven(cost, feePct, taxPct) {
    cost = +cost || 0; if (!(cost > 0)) return 0;
    var f = isFinite(feePct) && feePct >= 0 ? feePct : FEE_DEFAULT, t = isFinite(taxPct) && taxPct >= 0 ? taxPct : TAX_SELL;
    var raw = cost / (1 - (f + t) / 100), tk = tick(raw);
    return Math.ceil(raw / tk - 1e-9) * tk;
  }
  /* Nhãn kết quả thanh lý: chốt lời / cắt lỗ / hòa vốn (theo lãi/lỗ đã trừ phí + thuế) */
  function exitKind(pl) { return !isFinite(pl) ? "" : pl > 0 ? "profit" : pl < 0 ? "loss" : "even"; }
  /* SL mua tối đa theo tiền mặt (chẵn lô 100) */
  function maxBuy(cash, price, feePct) { if (!(cash > 0) || !(price > 0)) return 0; var f = isFinite(feePct) ? feePct : FEE_DEFAULT; return Math.floor(cash / (price * (1 + f / 100)) / 100) * 100; }

  var api = { calc: calc, autoFee: autoFee, tick: tick, maxBuy: maxBuy, breakEven: breakEven, exitKind: exitKind, FEE_DEFAULT: FEE_DEFAULT, TAX_SELL: TAX_SELL };
  if (typeof document === "undefined") return api;

  /* ---------- Giao diện ---------- */
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var LS = "nhip.trade.v1", DK = "nhip.trade.draft";
  /* Bản nháp phiếu lệnh (v1.69.6): khi rời trang rồi quay lại cùng mã, giữ nguyên số lượng, giá, SL/TP, phí, loại lệnh, ô tiền mặt — chỉ chiều Mua/Bán lấy theo nút vừa bấm. */
  var DRAFT_FIELDS = ["otype", "qty", "price", "priceTouched", "fee", "feeTouched", "sl", "tp", "useCash", "cashTouched"];
  function loadDraft(sy) { try { var j = JSON.parse(sessionStorage.getItem(DK) || "null"); return j && j.sym === sy && Date.now() - (j.t || 0) < 6 * 3600 * 1000 ? j : null; } catch (e) { return null; } }
  function saveDraft(S, sy) { try { var j = { sym: sy, t: Date.now() }; DRAFT_FIELDS.forEach(function (k) { j[k] = S[k]; }); var empty = !String(S.qty).trim() && !String(S.sl).trim() && !String(S.tp).trim() && !S.priceTouched && !S.feeTouched && !S.cashTouched && S.otype === "LO"; if (empty) sessionStorage.removeItem(DK); else sessionStorage.setItem(DK, JSON.stringify(j)); } catch (e) { } }
  var M = (function () { try { var j = JSON.parse(localStorage.getItem(LS) || "{}"); return { cid: j.cid || "", pid: j.pid || "", feePct: isFinite(j.feePct) ? j.feePct : FEE_DEFAULT }; } catch (e) { return { cid: "", pid: "", feePct: FEE_DEFAULT }; } })();
  var save = function () { try { localStorage.setItem(LS, JSON.stringify({ cid: M.cid, pid: M.pid, feePct: M.feePct })); } catch (e) { } };
  var g = function (n) { return W.NHIPPF ? W.NHIPPF[n] : undefined; }; /* cầu nối do app.js cung cấp (PF2, pfApply, pfSave…) */

  function mount(el, opts) {
    var tbl = null, S = { mode: "now", fromOrder: null, otype: "LO", side: opts.side === "sell" ? "sell" : "buy", qty: "", price: "", priceTouched: false, fee: "", feeTouched: false, sl: "", tp: "", useCash: true, cashTouched: false, form: null, f: { nn: "", np: "", pn: "", pd: "", ps: false }, sheet: false, confirm: null, busy: false, loading: true, err: "", sym: "" };
    var dead = false, timer = null, rz = null, mode = opts.mode === "m" ? "m" : "i", whoStr = "";
    (function () { var d = loadDraft(String(opts.symbol() || "").toUpperCase()); if (d) DRAFT_FIELDS.forEach(function (k) { if (d[k] !== undefined) S[k] = d[k]; }); })();
    var sym = function () { return String(opts.symbol() || "").toUpperCase(); };
    var PF = function () { return g("PF2"); };
    var customers = function () { var x = PF(); return (x && x.customers) || []; };
    var pfs = function (cid) { var x = PF(); return x ? x.list.filter(function (p) { return p.cid === cid; }) : []; };
    var curC = function () { return customers().filter(function (c) { return c.id === M.cid; })[0] || null; };
    var curP = function () { var l = pfs(M.cid); return l.filter(function (p) { return p.id === M.pid; })[0] || null; };
    var last = function () { var p = opts.price(); return p > 0 ? Math.round(p) : null; };
    var tradable = function () { var s = sym(); return /^[A-Z0-9.]{2,12}$/.test(s) && !g("isIdx")(s); };
    var NOm = function () { return W.NHIPOrders || null; };
    var baseEx = function () { return opts.exch ? opts.exch(sym()) : "HOSE"; };
    var exOf = function () { var N = NOm(); return N && N.getExch ? N.getExch(sym(), baseEx()) : "HOSE"; };
    var exTagH = function () { var N = NOm(); return N && N.exTag ? N.exTag(sym()) : ""; };
    var refOf = function () { var qq = opts.quote ? opts.quote(sym()) : null; return qq && qq.ref > 0 ? qq.ref : 0; };
    var usesCash = function (p) { return !!p && (p.cash > 0 || p.tx.some(function (t) { return t.type === "dep"; })); };

    /* v2.6 — DÙNG CHUNG KHÁCH/DANH MỤC VỚI MỤC DANH MỤC.
       Nguồn duy nhất: khách đang chọn (sessionStorage.pfCust) + danh mục đang chọn (PF2.active, lưu ở máy chủ).
       adopt(): khi mở trang / tải lại, phiếu lệnh đứng đúng khách + danh mục đang chọn ở Danh mục.
       share(): khi đổi khách/danh mục ở phiếu lệnh, ghi ngược để Danh mục đứng đúng khách + danh mục đó. */
    function adopt() {
      var x = PF(); if (!x) return;
      var cs = customers(), want = ""; try { want = sessionStorage.getItem("pfCust") || ""; } catch (e) { }
      var a = x.list.filter(function (p) { return p.id === x.active; })[0];
      if (want && want !== "none" && want !== "all" && cs.some(function (c) { return c.id === want; })) {
        var l = pfs(want); M.cid = want; M.pid = a && a.cid === want ? a.id : (l.length ? l[0].id : "");
      } else if (a && a.cid && cs.some(function (c) { return c.id === a.cid; })) { M.cid = a.cid; M.pid = a.id; }
    }
    function share() {
      try { sessionStorage.setItem("pfCust", M.cid || ""); } catch (e) { }
      var x = PF(); if (!x || !M.pid || x.active === M.pid) return;
      x.active = M.pid; try { Promise.resolve(g("pfSave")()).catch(function () { }); } catch (e) { }
    }
    function fixSel() { /* khách/danh mục đã lưu phải còn tồn tại; chưa có thì lấy khách đầu tiên */
      var cs = customers(), o0 = { cid: M.cid, pid: M.pid };
      if (!cs.some(function (c) { return c.id === M.cid; })) M.cid = cs.length ? cs[0].id : "";
      var l = pfs(M.cid); if (!l.some(function (p) { return p.id === M.pid; })) M.pid = l.length ? l[0].id : "";
      if (!S.cashTouched) S.useCash = usesCash(curP());
      if (M.pid && (o0.cid !== M.cid || o0.pid !== M.pid)) { save(); try { window.dispatchEvent(new CustomEvent("nhip:trade-sel")); } catch (x) { } } /* v2.47: lưu lựa chọn tự gán để biểu đồ/lệnh chờ đọc đúng danh mục */
    }
    function currentPrice() { return S.priceTouched ? (+String(S.price).replace(/\./g, "").replace(",", ".") || 0) : (last() || 0); }
    function num(v) { var n = g("pnum")(v); return isNaN(n) ? 0 : n; }
    function ticket() {
      var p = curP(), pos = p ? p.positions.filter(function (x) { return x.symbol === sym(); })[0] : null, pr = S.priceTouched ? num(S.price) : (last() || 0), q = num(S.qty), sell = S.side === "sell";
      var fee = S.feeTouched ? num(S.fee) : autoFee(S.side, q * pr, M.feePct);
      var rr = calc({ side: S.side, qty: q, price: pr, fee: fee, pos: pos, cash: p ? p.cash : 0, useCash: S.useCash, last: last() });
      var sl = 0, tp = 0; /* v2.4: lệnh mua không còn Stop loss / Take profit */
      /* MUA: SL thấp hơn, TP cao hơn giá vào. BÁN = thanh lý vị thế đang giữ → KHÔNG có SL/TP (thị trường cơ sở không bán khống; lãi/lỗ tính theo giá vốn) */
      if (!sell) {
        /* không có SL/TP ở lệnh mua */
      } else if (p && pos && q > 0 && rr.pl < 0) {
        rr.warns.push("Bán DƯỚI giá vốn " + nf(pos.cost) + ": lỗ " + nf(-rr.pl) + " ₫ — đây là lệnh cắt lỗ, không thể “lãi” khi giá xuống");
      }
      /* v1.73: quy tắc theo SÀN đã chọn (loại lệnh, bước giá, biên độ sàn/trần, lô, T+2) */
      var NOx = W.NHIPOrders, ex = exOf(), sbx = (sell && p && pos && NOx && NOx.sellable) ? NOx.sellable(p, sym()) : null;
      if (NOx && NOx.checkNow) {
        if (NOx.typesFor(ex).indexOf(S.otype) < 0) S.otype = "LO";
        var ref = refOf();
        rr.warns = rr.warns.filter(function (w) { return !/chẵn lô 100/.test(w) && !(ref && /Giá lệch/.test(w)); });
        var cn = NOx.checkNow({ side: S.side, otype: S.otype, price: pr, qty: q }, { exch: ex, last: last(), ref: ref, sellable: sbx ? sbx.sellable : null });
        rr.errors = rr.errors.concat(cn.errors); rr.warns = rr.warns.concat(cn.warns); rr.infos = cn.infos;
      }
      var be = sell && pos ? breakEven(pos.cost, M.feePct, TAX_SELL) : 0;
      return { p: p, pos: pos, pr: pr, q: q, fee: fee, sl: sl || null, tp: tp || null, be: be, sb: (sell && p && pos && W.NHIPOrders && W.NHIPOrders.sellable) ? W.NHIPOrders.sellable(p, sym()) : null, r: rr };
    }

    /* ----- HTML ----- */
    function acctHtml() {
      var cs = customers(), c = curC(), l = pfs(M.cid);
      if (!cs.length && !S.form) S.form = "cust";
      if (S.form === "cust") return '<div class="tr-mini"><b>Thêm khách hàng' + (W.NHIPHouse && W.NHIPHouse.cur ? ' · sàn ' + esc(W.NHIPHouse.name(W.NHIPHouse.cur())) : "") + '</b><input id="tr-nn" maxlength="60" placeholder="Tên khách hàng" autocomplete="off" value="' + esc(S.f.nn) + '"><input id="tr-np" maxlength="20" inputmode="tel" placeholder="Điện thoại (không bắt buộc)" value="' + esc(S.f.np) + '"><div class="tr-row"><button type="button" class="btn primary" data-a="cust-ok">Thêm &amp; tạo “Danh mục chính”</button>' + (cs.length ? '<button type="button" class="btn secondary" data-a="form-x">Hủy</button>' : "") + '</div></div>';
      if (S.form === "pf") return '<div class="tr-mini"><b>Danh mục mới cho ' + esc(c ? c.name : "") + '</b><input id="tr-pn" maxlength="40" placeholder="Tên danh mục (VD: Dài hạn)" value="' + esc(S.f.pn) + '"><input id="tr-pd" inputmode="decimal" placeholder="Tiền nạp ban đầu (đ) — không bắt buộc" value="' + esc(S.f.pd) + '"><label class="tr-chk"><input type="checkbox" id="tr-ps"' + (S.f.ps ? " checked" : "") + '> Mô phỏng (giả lập)</label><div class="tr-row"><button type="button" class="btn primary" data-a="pf-ok">Tạo danh mục</button><button type="button" class="btn secondary" data-a="form-x">Hủy</button></div></div>';
      return '<div class="tr-acct"><label><span>Khách hàng</span><select id="tr-c" aria-label="Khách hàng">' + (cs.length ? "" : '<option value="">— Chưa có khách —</option>') +
        cs.map(function (x) { return '<option value="' + x.id + '"' + (x.id === M.cid ? " selected" : "") + ">" + esc(x.name) + "</option>"; }).join("") + '<option value="__new">＋ Thêm khách hàng…</option></select></label>' +
        '<label><span>Danh mục</span><select id="tr-p" aria-label="Danh mục" ' + (c ? "" : "disabled") + ">" + (l.length ? "" : '<option value="">— Khách chưa có danh mục —</option>') +
        l.map(function (x) { return '<option value="' + x.id + '"' + (x.id === M.pid ? " selected" : "") + ">" + esc(x.name) + (x.sim ? " · mô phỏng" : "") + "</option>"; }).join("") + (c ? '<option value="__new">＋ Tạo danh mục…</option>' : "") + "</select></label></div>";
    }
    function holdHtml(T) {
      if (!T.p) return "";
      var pos = T.pos;
      return '<div class="tr-hold"><span>' + (pos ? "Đang giữ <b>" + nf(pos.qty) + " cp</b> · vốn <b>" + nf(pos.cost) + "</b>" : "Chưa giữ " + esc(sym())) + '</span><span>Tiền mặt <b class="' + (T.p.cash < 0 ? "dn" : "") + '">' + mny(T.p.cash) + " ₫</b></span></div>";
    }
    /* ----- BÁN = THANH LÝ vị thế đang giữ (không bán khống) ----- */
    function sellCard(T) {
      var pos = T.pos, L = last(); if (!T.p) return "";
      if (!pos) return '<p class="tr-msg err">Danh mục chưa giữ ' + esc(sym()) + ' — thị trường cổ phiếu Việt Nam không bán khống, chỉ bán được cổ phiếu đang nắm giữ.</p>';
      var up = L ? (L / pos.cost - 1) * 100 : null, sb = T.sb;
      return '<div class="tr-liq"><div class="tr-liq-h"><b>Thanh lý vị thế ' + esc(sym()) + '</b><span class="tr-tag ' + (up == null ? "" : up > 0 ? "up" : up < 0 ? "dn" : "") + '">' + (up == null ? "—" : (up > 0 ? "Đang lãi " : up < 0 ? "Đang lỗ " : "Hòa vốn ") + (up > 0 ? "+" : "") + nf(up, 2) + "%") + '</span></div>' +
        '<div class="tr-liq-g"><div><span>Đang giữ</span><b>' + nf(pos.qty) + ' cp</b></div><div><span>Giá vốn BQ</span><b>' + nf(pos.cost) + '</b></div><div><span>Giá hòa vốn*</span><b>' + nf(T.be) + '</b></div><div><span>Bán được ngay</span><b>' + (sb ? nf(sb.sellable) + " cp" : "—") + '</b></div></div>' +
        '<small class="muted">* Giá thấp nhất để thu về đủ vốn sau phí + thuế bán 0,1%. Bán trên mức này = lãi, dưới mức này = lỗ.</small></div>';
    }
    function sellSum(T) {
      var r = T.r, tax = Math.round(r.value * TAX_SELL / 100), fee = Math.max(0, r.fee - tax), pl = r.pl, cls = pl < 0 ? "dn" : "up", lbl = r.exit === "loss" ? "Lỗ (cắt lỗ)" : r.exit === "profit" ? "Lãi (chốt lời)" : "Hòa vốn";
      var due = addBizSafe(todayISO(), 2);
      return '<div class="tr-sum"><div><span>Giá trị bán</span><b>' + nf(r.value) + " ₫</b></div>" +
        (S.feeTouched ? "<div><span>Phí + thuế</span><b>" + nf(r.fee) + " ₫</b></div>" : "<div><span>Phí giao dịch</span><b>" + nf(fee) + " ₫</b></div><div><span>Thuế bán 0,1%</span><b>" + nf(tax) + " ₫</b></div>") +
        '<div class="tr-tot"><span>Tiền thực nhận</span><b>' + nf(r.total) + " ₫</b></div>" +
        "<div><span>Vốn của số cp bán</span><b>" + nf(r.costBasis) + " ₫</b></div>" +
        '<div><span>' + lbl + '</span><b class="' + cls + '">' + (pl > 0 ? "+" : "") + nf(pl) + " ₫" + (r.plPct != null ? " (" + (r.plPct > 0 ? "+" : "") + nf(r.plPct, 2) + "%)" : "") + "</b></div>" +
        "<div><span>Còn giữ sau bán</span><b>" + nf(r.qtyAfter) + " cp</b></div>" +
        (S.useCash ? "<div><span>Tiền mặt sau lệnh</span><b>" + nf(r.cashAfter) + " ₫</b></div>" : "") +
        (due ? "<div><span>Tiền về TK thật (T+2)</span><b>" + due + "</b></div>" : "") + "</div>";
    }
    function todayISO() { try { return g("todayS")(); } catch (e) { return ""; } }
    function addBizSafe(d, n) { try { return /^\d{4}-\d{2}-\d{2}$/.test(d) && W.NHIPOrders ? W.NHIPOrders.addBiz(d, n) : ""; } catch (e) { return ""; } }
    function ticketHtml(T) {
      var s = sym(), r = T.r, side = S.side, buy = side === "buy", L = last(), ex0 = exOf();
      var qSeg = (buy ? [100, 200, 500, 1000].map(function (n) { return '<button type="button" data-q="' + n + '">' + nf(n) + "</button>"; }).join("")
        : [["25%", 0.25], ["50%", 0.5], ["Tất cả", 1]].map(function (x) { return '<button type="button" data-qp="' + x[1] + '">' + x[0] + "</button>"; }).join(""));
      var qMore = (buy ? (S.useCash && T.p && T.p.cash > 0 ? '<button type="button" data-qmax="1">Tối đa theo tiền mặt</button>' : "") : (T.sb && T.sb.unsettled > 0 && T.sb.sellable > 0 ? '<button type="button" data-qsell="1">Bán được ngay (' + nf(T.sb.sellable) + ")</button>" : ""));
      var pcs = [-3, -1, 0, 1, 3], NO2 = NOm(), exn = exOf(), rf = refOf();
      var pSeg = L && S.otype === "LO" ? pcs.map(function (x) {
        var v = x === 0 ? L : (NO2 && NO2.snap ? NO2.snap(L * (1 + x / 100), exn, x > 0 ? 1 : -1) : Math.round(L * (1 + x / 100))), bd = NO2 && NO2.band && rf > 0 ? NO2.band(rf, exn) : null;
        if (bd) v = Math.min(bd.ce, Math.max(bd.fl, v));
        return '<button type="button" class="' + (x < 0 ? "dn" : x > 0 ? "up" : "") + '" data-px="' + v + '">' + (x === 0 ? "Giá HT" : (x > 0 ? "+" : "−") + Math.abs(x) + "%") + "</button>";
      }).join("") : "";
      var pMore = (!buy && T.be > 0 && S.otype === "LO" ? '<button type="button" data-px="' + T.be + '">Hòa vốn ' + nf(T.be) + "</button>" : "") + (S.priceTouched && L ? '<button type="button" data-a="px-reset" class="tr-link">Giá gần nhất ' + nf(L) + "</button>" : "");
      var seg = function (h, lab, at) { return h ? '<div class="tr-chips tr-seg nx-seg"' + (at || "") + ' role="group" aria-label="' + lab + '">' + h + "</div>" : ""; };
      var held = T.pos ? T.pos.qty : 0, qMax = buy ? Math.max(3000, Math.ceil((+S.qty || 0) / 1000) * 1000) : held;
      var qAt = qMax > 0 ? ' data-rkind="qty" data-rmin="0" data-rmax="' + qMax + '" data-rstep="100"' : "";
      var bdT = NO2 && NO2.band && rf > 0 ? NO2.band(rf, exn) : null;
      var pAt = L ? ' data-rkind="price" data-rmin="' + (bdT ? bdT.fl : Math.round(L * 0.9)) + '" data-rmax="' + (bdT ? bdT.ce : Math.round(L * 1.1)) + '" data-rstep="' + (NO2 && NO2.tickSize ? NO2.tickSize(L, exn) : 50) + '" data-rex="' + exn + '"' : "";
      var more = function (h) { return h ? '<div class="tr-chips tr-more">' + h + "</div>" : ""; };
      var sum = "";
      if (T.q > 0 && T.pr > 0) {
        if (buy) sum = '<div class="tr-sum"><div><span>Giá trị</span><b>' + nf(r.value) + " ₫</b></div><div><span>Phí</span><b>" + nf(r.fee) + ' ₫</b></div><div class="tr-tot"><span>Tổng tiền cần</span><b>' + nf(r.total) + " ₫</b></div>" +
          (S.useCash ? "<div><span>Tiền mặt sau lệnh</span><b class=\"" + (r.cashAfter < 0 ? "dn" : "") + "\">" + nf(r.cashAfter) + " ₫</b></div>" : "") + "<div><span>Giá vốn BQ sau mua</span><b>" + nf(r.costAfter) + "</b></div></div>";
        else sum = sellSum(T);
      }
      var msgs = (T.q > 0 ? r.errors : []).map(function (m) { return '<p class="tr-msg err">' + esc(m) + "</p>"; }).concat(r.warns.map(function (m) { return '<p class="tr-msg warn">' + esc(m) + "</p>"; }), (r.infos || []).map(function (m) { return '<p class="tr-msg info">' + esc(m) + "</p>"; })).join("");
      var ready = T.p && T.q > 0 && T.pr > 0 && !r.errors.length;
      var risk = ""; /* v2.4: bỏ Stop loss / Take profit ở lệnh mua */
      return '<div class="tr-side" role="group" aria-label="Mua hoặc bán"><button type="button" class="tr-buy' + (buy ? " on" : "") + '" data-side="buy" aria-pressed="' + buy + '">Mua</button><button type="button" class="tr-sell' + (!buy ? " on" : "") + '" data-side="sell" aria-pressed="' + !buy + '">Bán</button></div>' + (buy ? "" : sellCard(T)) +
        '<div class="tr-ot" role="group" aria-label="Loại lệnh">' + (NOm() ? NOm().typesFor(ex0) : ["LO"]).map(function (o) { return '<button type="button" data-ot="' + o + '" title="' + esc((NOm() && NOm().TYPE_TIP[o]) || "") + '" class="' + (S.otype === o ? "on" : "") + '">' + o + "</button>"; }).join("") + "</div>" + '<div class="tr-grid tr-g1"><div class="tr-fg"><label class="tr-f"><span>Số lượng (cp)</span><div class="tr-step"><button type="button" data-qs="-100" aria-label="Giảm 100">−</button><input id="tr-q" inputmode="numeric" placeholder="100" value="' + esc(S.qty) + '"><button type="button" data-qs="100" aria-label="Tăng 100">+</button></div></label>' + seg(qSeg, "Chọn nhanh khối lượng", qAt) + more(qMore) + "</div>" +
        '<div class="tr-fg"><label class="tr-f"><span>' + (S.otype === "LO" ? "Giá (đ/cp)" : "Giá khớp thực tế (đ/cp)") + '</span><div class="tr-step"><button type="button" data-ps="-1" aria-label="Giảm một bước giá">−</button><input id="tr-pr" inputmode="decimal" placeholder="' + (L ? nf(L) : "0") + '" value="' + (S.priceTouched ? esc(S.price) : (L ? nf(L) : "")) + '"><button type="button" data-ps="1" aria-label="Tăng một bước giá">+</button></div></label>' + seg(pSeg, "Giá so với giá hiện tại", pAt) + more(pMore) + "</div></div>" +
        '<div class="tr-grid"><label class="tr-f"><span>Phí' + (buy ? "" : " + thuế") + ' (đ)</span><input id="tr-fee" inputmode="decimal" value="' + (S.feeTouched ? esc(S.fee) : nf(T.fee)) + '"></label><label class="tr-f"><span>Phí GD (%)</span><input id="tr-fp" inputmode="decimal" value="' + String(M.feePct).replace(".", ",") + '"></label></div>' +
        risk +
        '<label class="tr-chk"><input type="checkbox" id="tr-cash" ' + (S.useCash ? "checked" : "") + "> Cập nhật tiền mặt của danh mục</label>" + '<div id="tr-dyn">' + sum + msgs +
        '<button type="button" class="tr-go ' + (buy ? "buy" : "sell") + '" data-a="go" ' + (ready ? "" : "disabled") + ">" + (buy ? "Mua " : "Bán ") + esc(s) + (T.q > 0 ? " · " + nf(T.q) + " cp" : "") + "</button>" + '</div>' +
        '<p class="tr-note">' + (buy ? "Sổ giao dịch/danh mục nội bộ — không gửi lệnh lên công ty chứng khoán. Muốn mua khi giá giảm về / tăng lên một mức, dùng chế độ “Lệnh chờ”. " : "Lệnh bán chỉ THANH LÝ cổ phiếu đang giữ (không bán khống, không có chiều “giá xuống để lãi”). Muốn đặt giá tự động chốt lời / cắt lỗ cho phần còn lại, dùng “Lệnh chờ”. Thuế bán 0,1% trên giá trị bán; phí theo biểu phí công ty chứng khoán của bạn. ") + "Không tự mua/bán khi chạm giá. ATO/ATC/MP: nhập giá khớp thực tế sau khi khớp. Giá lấy từ dữ liệu ứng dụng và có thể trễ." + "</p>";
    }
    function recentHtml() {
      var x = PF(), c = curC(); if (!x || !c) return "";
      var rows = []; pfs(c.id).forEach(function (p) { p.tx.forEach(function (t) { if ((t.type === "buy" || t.type === "sell") && t.symbol === sym()) rows.push({ t: t, p: p }); }); });
      rows.sort(function (a, b) { return (b.t.date || "").localeCompare(a.t.date || ""); });
      var p = curP(), canUndo = p && p.tx[0] && p.tx[0].src === "chart" && p.tx[0].snap;
      return '<div class="tr-rec"><div class="tr-rh"><b>Giao dịch ' + esc(sym()) + " của " + esc(c.name) + "</b>" + (canUndo ? '<button type="button" class="tr-link" data-a="undo">Hoàn tác lệnh gần nhất</button>' : "") + "</div>" +
        (rows.length ? rows.slice(0, 5).map(function (o) { var t = o.t; return '<div class="tr-rr"><span class="' + (t.type === "buy" ? "up" : "dn") + '">' + (t.type === "buy" ? "Mua" : "Bán") + "</span><span>" + nf(t.qty) + " @ " + nf(t.price) + "</span><small class=\"muted\">" + esc(t.date) + " · " + esc(o.p.name) + "</small></div>"; }).join("") : '<p class="muted tr-empty">Chưa có giao dịch ' + esc(sym()) + " của khách này.</p>") +
        '<a class="tr-link" href="#/danh-muc" data-a="open-pf">Mở sổ giao dịch &amp; danh mục →</a></div>';
    }
    function exBlock() { var N = NOm(); return N && N.rulesHtml ? N.rulesHtml(refOf(), last(), exOf()) : ""; }
    function modeHtml() { return '<div class="tr-mode" role="group" aria-label="Chế độ đặt lệnh"><button type="button" data-mode="now" class="' + (S.mode !== "pend" ? "on" : "") + '">Lệnh thường</button><button type="button" data-mode="pend" class="' + (S.mode === "pend" ? "on" : "") + '">Lệnh chờ</button></div>'; }
    function mountOrders() {
      if (tbl) { try { tbl.destroy(); } catch (e) { } tbl = null; }
      var h = el.querySelector("#tr-orders"); if (!h || !W.NHIPOrders || !W.NHIPOrders.mountTable) return;
      tbl = W.NHIPOrders.mountTable(h, { symbol: sym, symbolOnly: true, showEx: false, noList: true, quote: opts.quote || function (s) { return s === sym() ? { last: last() } : null; }, exch: opts.exch, candles: opts.candles, onFill: function (o) { prefill(o); } });
    }
    function prefill(o) {
      if (!o) return; if (o.sym && o.sym !== sym() && opts.setSymbol) opts.setSymbol(o.sym);
      S.mode = "now"; S.side = o.kind === "buy" ? "buy" : "sell"; S.otype = "LO"; S.priceTouched = true; S.price = nf(o.price); S.qty = String(o.qty); S.fromOrder = o.id; S.sheet = true; saveDraft(S, S.sym || sym()); render();
    }
    function bodyHtml() {
      whoStr = "";
      if (S.loading) return '<p class="muted tr-empty">Đang tải danh mục…</p>';
      if (S.err) return '<p class="tr-msg err">' + esc(S.err) + '</p><button type="button" class="btn pale" data-a="reload">Thử lại</button>';
      if (!tradable()) return '<p class="muted tr-empty">“' + esc(sym()) + '” là chỉ số — không giao dịch được. Chọn một mã cổ phiếu.</p>';
      var T = ticket(), a = acctHtml(), wh = !!(opts.whoHost && mode === "i" && !S.form);
      whoStr = wh ? a + holdHtml(T) : "";
      return (wh ? "" : a) + (S.form ? "" : (wh ? "" : holdHtml(T)) + (T.p ? exBlock() + modeHtml() + (S.mode === "pend" ? '<div id="tr-orders"></div>' : ticketHtml(T) + recentHtml()) : '<p class="muted tr-empty">' + (curC() ? "Tạo danh mục cho khách để bắt đầu mua/bán." : "Thêm khách hàng để bắt đầu mua/bán.") + "</p>"));
    }
    function confirmHtml() {
      var c = S.confirm, T = c.T, r = T.r, buy = r.side === "buy", cu = curC(), p = T.p, row = function (k, v, cl) { return "<div><span>" + k + "</span><b" + (cl ? ' class="' + cl + '"' : "") + ">" + v + "</b></div>"; };
      /* v2.49: gom nhóm cho dễ đọc — Đầu: mã·sàn + khách/danh mục · Chi tiết lệnh · Tổng · Sau giao dịch */
      var pl = r.exit === "loss" ? "Lỗ thực hiện (cắt lỗ)" : r.exit === "profit" ? "Lãi thực hiện (chốt lời)" : "Hòa vốn";
      var after = (buy ? "" : row("Giá vốn BQ", nf(T.pos ? T.pos.cost : 0) + " ₫")) + row("Tiền mặt", S.useCash ? mny(r.cashBefore) + " → " + mny(r.cashAfter) + " ₫" : "Không đổi") + row("Số cp " + esc(sym()), nf(r.held) + " → " + nf(r.qtyAfter)) +
        (buy ? row("Giá vốn BQ", nf(T.pos ? T.pos.cost : 0) + " → " + nf(r.costAfter)) : row(pl, (r.pl > 0 ? "+" : "") + nf(r.pl) + " ₫" + (r.plPct != null ? " (" + (r.plPct > 0 ? "+" : "") + nf(r.plPct, 2) + "%)" : ""), r.pl < 0 ? "dn" : "up"));
      return '<div class="tr-ov" data-a="cf-bg"><div class="tr-cf" role="dialog" aria-modal="true" aria-label="Xác nhận giao dịch"><div class="tr-cf-h"><h3>Xác nhận ' + (buy ? "MUA" : "BÁN") + " " + esc(sym()) + '</h3><span class="tr-cf-ex">' + esc(NOm() && NOm().exName ? NOm().exName(exOf()) : exOf()) + "</span></div>" +
        '<div class="tr-who"><div><span>Khách hàng</span><b>' + esc(cu ? cu.name : "") + "</b></div><div><span>Danh mục</span><b>" + esc(p.name) + (p.sim ? " · mô phỏng" : "") + "</b></div></div>" +
        '<div class="tr-sum"><div class="tr-sh">Chi tiết lệnh</div>' + row("Số lượng", nf(T.q) + " cp") + row("Giá", nf(T.pr) + " ₫") + row("Giá trị", nf(r.value) + " ₫") + row("Phí" + (buy ? "" : " + thuế"), nf(r.fee) + " ₫") +
        '<div class="tr-tot"><span>' + (buy ? "Tổng tiền cần" : "Tiền thực nhận") + "</span><b>" + nf(r.total) + " ₫</b></div>" +
        '<div class="tr-sh">Sau giao dịch</div>' + after + "</div>" +
        r.warns.map(function (m) { return '<p class="tr-msg warn">' + esc(m) + "</p>"; }).join("") +
        '<div class="tr-row"><button type="button" class="btn secondary" data-a="cf-x">Quay lại</button><button type="button" class="tr-go ' + (buy ? "buy" : "sell") + '" data-a="cf-ok" ' + (S.busy ? "disabled" : "") + ">" + (S.busy ? "Đang ghi…" : r.warns.length ? "Vẫn ghi giao dịch" : "Xác nhận " + (buy ? "mua" : "bán")) + "</button></div></div></div>";
    }
    function barHtml() {
      var c = curC(), p = curP();
      return '<div class="tr-bar"><button type="button" class="tr-who-b" data-a="open"><i>Khách · Danh mục</i><b>' + (c && p ? esc(c.name) + " · " + esc(p.name) : "Chọn khách hàng") + '</b></button><button type="button" class="tr-buy on" data-open="buy">Mua</button><button type="button" class="tr-sell on" data-open="sell">Bán</button></div>';
    }
    function render() {
      if (dead) return; var keep = document.activeElement && document.activeElement.id, selStart = null;
      try { if (keep && document.activeElement.selectionStart != null) selStart = document.activeElement.selectionStart; } catch (e) { }
      var head = '<header class="tr-h"><b>Giao dịch · ' + esc(sym()) + "</b>" + exTagH() + '<span class="tr-px">' + (last() ? "Giá " + nf(last()) : "") + "</span>" + (mode === "m" ? '<button type="button" class="tr-x" data-a="close" aria-label="Đóng">✕</button>' : "") + "</header>";
      var inner = '<section class="tr ' + (mode === "m" ? "is-sheet" : "is-inline") + '">' + head + '<div class="tr-body">' + bodyHtml() + "</div></section>";
      if (mode === "m") el.innerHTML = barHtml() + (S.sheet ? '<div class="tr-bg" data-a="close"></div>' + inner : "") + (S.confirm ? confirmHtml() : "");
      else el.innerHTML = inner + (S.confirm ? confirmHtml() : "");
      mountOrders();
      if (opts.whoHost && mode === "i") { try { opts.whoHost.innerHTML = whoStr; } catch (e) { } }
      if (keep) { var n = el.querySelector("#" + keep); if (n && n.focus) { n.focus(); try { if (selStart != null) n.setSelectionRange(selStart, selStart); } catch (e) { } } }
    }

    /* ----- Hành động ----- */
    var toast = function (m, e) { try { g("toast")(m, e); } catch (x) { } };
    function setQty(n) { S.qty = String(Math.max(0, Math.floor(n))); render(); }
    function afterChange() { render(); }
    async function reload() {
      S.loading = true; S.err = ""; render();
      try { await g("pfLoad")(); S.loading = false; adopt(); fixSel(); } catch (e) { S.loading = false; S.err = "Không tải được danh mục: " + ((e && e.message) || "lỗi"); }
      render(); try { window.dispatchEvent(new CustomEvent("nhip:trade-sel")); } catch (e) { }
    }
    async function addCustomer() {
      var n = (el.querySelector("#tr-nn").value || "").trim().slice(0, 60); if (!n) return toast("Nhập tên khách hàng", 1);
      var x = PF(); if (x.customers.length >= 200) return toast("Tối đa 200 khách hàng", 1); if (x.list.length >= 100) return toast("Tối đa 100 danh mục", 1);
      var id = g("uid")(), pid = g("uid")() + "p", ph = (el.querySelector("#tr-np").value || "").trim().slice(0, 20);
      var hx = (W.NHIPHouse && W.NHIPHouse.cur && W.NHIPHouse.cur()) || ""; /* v2.5: khách + danh mục tạo ở sàn nào thuộc đúng sàn đó */
      x.customers = x.customers.concat([{ id: id, name: n, phone: ph, note: "", created: g("todayS")(), ex: hx }]);
      var blank = x.list.filter(function (q) { return /^nha(hose|hnx|upcom)$/.test(q.id) && !q.cid && !(q.tx || []).length && !(q.positions || []).length && !q.cash; })[0];
      if (blank) { blank.cid = id; blank.name = "Danh mục chính"; pid = blank.id; }
      else x.list.push({ id: pid, cid: id, name: "Danh mục chính", sim: false, ex: hx, cash: 0, realized: 0, divs: 0, settings: { maxW: 30, maxLoss: 10, alertsOn: false }, positions: [], tx: [] });
      x.active = pid;
      if (await g("pfSave")()) { M.cid = id; M.pid = pid; save(); try { sessionStorage.setItem("pfCust", id); } catch (e) { } S.form = null; S.f.nn = ""; S.f.np = ""; S.cashTouched = false; fixSel(); toast("Đã thêm khách “" + n + "” và danh mục chính"); } else fixSel();
      render();
    }
    async function addPortfolio() {
      var n = (el.querySelector("#tr-pn").value || "").trim().slice(0, 40); if (!n) return toast("Nhập tên danh mục", 1);
      var x = PF(); if (x.list.length >= 100) return toast("Tối đa 100 danh mục", 1);
      var id = g("uid")(), dep = num(el.querySelector("#tr-pd").value), np = { id: id, cid: M.cid, name: n, sim: !!el.querySelector("#tr-ps").checked, cash: 0, realized: 0, divs: 0, settings: { maxW: 30, maxLoss: 10, alertsOn: false }, positions: [], tx: [] };
      if (dep > 0) g("pfApply")(np, { type: "dep", amount: dep, date: g("todayS")(), note: "Nạp tiền ban đầu" });
      x.list.push(np); x.active = id;
      if (await g("pfSave")()) { M.pid = id; save(); try { sessionStorage.setItem("pfCust", M.cid || ""); } catch (e) { } S.form = null; S.f.pn = ""; S.f.pd = ""; S.f.ps = false; S.cashTouched = false; fixSel(); toast("Đã tạo danh mục “" + n + "”"); } else fixSel();
      render();
    }
    function openConfirm() {
      var T = ticket(); if (!T.p || T.r.errors.length || !(T.q > 0) || !(T.pr > 0)) return;
      S.confirm = { T: T, snap: { side: S.side, q: T.q, pr: T.pr, fee: T.fee, cash: S.useCash, sl: T.sl, tp: T.tp, orderId: S.fromOrder || null } }; render();
    }
    async function commit() {
      if (S.busy || !S.confirm) return; S.busy = true; render();
      var c = S.confirm.snap, sy = sym(), ok = false;
      try {
        await g("pfLoad")(); fixSel();   /* lấy bản mới nhất (tab/thiết bị khác có thể vừa đổi) rồi kiểm tra lại */
        var p = curP(); if (!p) { toast("Danh mục không còn tồn tại", 1); }
        else {
          var m = g("pfApply")(p, { type: c.side, symbol: sy, qty: c.q, price: c.pr, fee: c.fee, date: g("todayS")(), note: "Giao dịch từ mục Giao dịch · " + S.otype + (c.sl ? " · SL " + nf(c.sl) : "") + (c.tp ? " · TP " + nf(c.tp) : ""), cash: c.cash, src: "chart" });
          if (m) toast(m, 1);
          else if (afterFill(p, c, sy), await g("pfSave")()) { ok = true; toast((c.side === "buy" ? "Đã MUA " : "Đã BÁN ") + nf(c.q) + " " + sy + " @ " + nf(c.pr) + " · " + curC().name + " · " + p.name + " — danh mục đã cập nhật"); }
        }
      } catch (e) { toast((e && e.message) || "Không ghi được giao dịch", 1); }
      S.busy = false; S.confirm = null;
      if (ok) { S.fromOrder = null; S.qty = ""; S.fee = ""; S.feeTouched = false; S.sl = ""; S.tp = ""; try { sessionStorage.removeItem(DK); } catch (e) { } if (mode === "m") S.sheet = false; try { window.dispatchEvent(new CustomEvent("nhip:portfolio-changed")); } catch (e) { } }
      render();
    }
    /* Ghi giao dịch xong: lệnh chờ vừa khớp được bỏ/giảm KL; TP/SL của mã được thu hẹp theo số còn giữ (không để vượt số đang giữ) */
    function afterFill(p, c, sy) {
      try {
        var NO = W.NHIPOrders; if (!NO || !Array.isArray(p.orders) || !p.orders.length) return;
        var o = c.orderId ? p.orders.filter(function (x) { return x.id === c.orderId; })[0] : null, rid = null;
        if (o && o.sym === sy && (o.kind === "buy") === (c.side === "buy")) { if (o.kind === "buy" && (o.tp || o.sl) && NO.spawnExits) NO.spawnExits(p, o, Math.min(c.q, o.qty), g("uid")); if (c.q >= o.qty) rid = o.id; else o.qty -= c.q; }
        NO.reconcile(p, sy, rid);
      } catch (e) { }
    }
    async function undo() {
      var p = curP(); if (!p || !p.tx[0] || p.tx[0].src !== "chart") return; var t = p.tx[0];
      if (!(await NhipDlg.confirm({ tone: "warn", icon: "undo", title: "Hoàn tác lệnh gần nhất?", message: "Lệnh sẽ bị gỡ và danh mục quay về trạng thái trước đó.", rows: [["Lệnh", t.type === "buy" ? "Mua" : "Bán"], ["Mã cổ phiếu", t.symbol], ["Khối lượng", nf(t.qty) + " cp"], ["Giá", nf(t.price) + " đ"], ["Khách hàng", curC().name]], okText: "Hoàn tác", cancelText: "Giữ nguyên" }))) return;
      if (g("pfUndo")(p) && await g("pfSave")()) toast("Đã hoàn tác lệnh gần nhất");
      render();
    }

    /* cập nhật nhẹ khi đang gõ: chỉ thay phần tóm tắt/cảnh báo/nút, không đụng ô đang gõ (tránh nháy bàn phím trên điện thoại) */
    function lite() {
      saveDraft(S, S.sym || sym());
      var d = el.querySelector("#tr-dyn"); if (!d) { render(); return; }
      var T = ticket(), tmp = document.createElement("div"); tmp.innerHTML = ticketHtml(T);
      var nd = tmp.querySelector("#tr-dyn"); if (nd) d.innerHTML = nd.innerHTML;
      var fe = el.querySelector("#tr-fee"); if (fe && !S.feeTouched && document.activeElement !== fe) fe.value = nf(T.fee);
    }
    /* ----- Sự kiện (ủy quyền) ----- */
    el.addEventListener("click", function (e) {
      var b = e.target.closest("[data-a],[data-side],[data-q],[data-qp],[data-qsell],[data-px],[data-qmax],[data-qs],[data-ps],[data-open],[data-ot],[data-mode]"); if (!b) return; var D = b.dataset;
      if (D.mode) { S.mode = D.mode === "pend" ? "pend" : "now"; render(); return; }
      if (D.ot) { S.otype = D.ot; saveDraft(S, S.sym || sym()); render(); return; }
      if (D.side) { S.side = D.side; render(); return; }
      if (D.open) { S.side = D.open; S.sheet = true; render(); return; }
      if (D.q) { setQty((num(S.qty) || 0) + +D.q); return; }
      if (D.qs) { setQty(Math.max(0, (num(S.qty) || 0) + +D.qs)); return; }
      if (D.qp) { var h = ticket().pos ? ticket().pos.qty : 0, fr = +D.qp, raw = Math.floor(h * fr + 1e-9); setQty(fr >= 1 ? h : (raw >= 100 ? Math.floor(raw / 100) * 100 : raw)); return; }
      if (D.qsell) { var tt = ticket(); setQty(tt.sb ? tt.sb.sellable : 0); return; }
      if (D.px) { S.priceTouched = true; S.price = nf(+D.px); render(); return; }
      if (D.qmax) { var T = ticket(); setQty(maxBuy(T.p ? T.p.cash : 0, T.pr, M.feePct)); return; }
      if (D.ps) { var cp = currentPrice() || last() || 0; if (!cp) return; var np = NOm() && NOm().step ? NOm().step(cp, exOf(), +D.ps) : Math.max(0, cp + (+D.ps) * tick(cp)); S.priceTouched = true; S.price = nf(np); render(); return; }
      switch (D.a) {
        case "go": openConfirm(); break;
        case "cf-ok": commit(); break;
        case "cf-x": S.confirm = null; render(); break;
        case "cf-bg": if (e.target === b) { S.confirm = null; render(); } break;
        case "close": if (e.target === b || b.classList.contains("tr-x")) { S.sheet = false; render(); } break;
        case "open": S.sheet = true; render(); break;
        case "px-reset": S.priceTouched = false; S.price = ""; render(); break;
        case "cust-ok": addCustomer(); break;
        case "pf-ok": addPortfolio(); break;
        case "form-x": S.form = null; S.f = { nn: "", np: "", pn: "", pd: "", ps: false }; render(); break;
        case "undo": undo(); break;
        case "reload": reload(); break;
        case "open-pf": try { sessionStorage.pfCust = M.cid || ""; sessionStorage.pfTab = "tx"; var pp = curP(); if (pp) sessionStorage.pfGo = pp.id; } catch (x) { } break;
      }
    });
    var onChange = function (e) {
      var t = e.target;
      if (t.id === "tr-c") { if (t.value === "__new") { S.form = "cust"; render(); return; } M.cid = t.value; M.pid = ""; S.cashTouched = false; fixSel(); save(); share(); render(); try { window.dispatchEvent(new CustomEvent("nhip:trade-sel")); } catch (x) { } return; }
      if (t.id === "tr-p") { if (t.value === "__new") { S.form = "pf"; render(); return; } M.pid = t.value; S.cashTouched = false; fixSel(); save(); share(); render(); try { window.dispatchEvent(new CustomEvent("nhip:trade-sel")); } catch (x) { } return; }
      if (t.id === "tr-ps") { S.f.ps = !!t.checked; return; }
      if (t.id === "tr-cash") { S.useCash = t.checked; S.cashTouched = true; saveDraft(S, S.sym || sym()); render(); return; }
      if (t.id === "tr-fp") { var v = num(t.value); M.feePct = isFinite(v) && v >= 0 && v <= 5 ? v : FEE_DEFAULT; save(); S.feeTouched = false; lite(); return; }
      if (t.id === "tr-pr" || t.id === "tr-fee") lite(); /* đã cập nhật ở sự kiện input; không dựng lại để nút Mua/Bán không bị thay giữa lúc chạm */
    };
    el.addEventListener("change", onChange); if (opts.whoHost) opts.whoHost.addEventListener("change", onChange);
    el.addEventListener("input", function (e) { /* gõ SL: cập nhật phần tóm tắt tức thì nhưng không dựng lại ô đang gõ */
      var t = e.target;
      if (t.id === "tr-q") { S.qty = t.value.replace(/[^\d]/g, ""); if (t.value !== S.qty) t.value = S.qty; lite(); }
      else if (t.id === "tr-pr") { S.price = t.value; S.priceTouched = !!t.value.trim(); lite(); }
      else if (t.id === "tr-fee") { S.fee = t.value; S.feeTouched = !!t.value.trim(); lite(); }
      else if (t.id === "tr-sl") { S.sl = t.value; lite(); }
      else if (t.id === "tr-tp") { S.tp = t.value; lite(); }
      /* v2.87: ô nhập tay của form Thêm khách hàng / Tạo danh mục lưu vào trạng thái — dựng lại giao diện không làm mất chữ */
      else if (t.id === "tr-nn") S.f.nn = t.value; else if (t.id === "tr-np") S.f.np = t.value;
      else if (t.id === "tr-pn") S.f.pn = t.value; else if (t.id === "tr-pd") S.f.pd = t.value;
    });
    el.addEventListener("keydown", function (e) { if (e.key === "Escape") { if (S.confirm) { S.confirm = null; render(); } else if (S.sheet) { S.sheet = false; render(); } } if (e.key === "Enter" && e.target.id === "tr-q") { e.preventDefault(); openConfirm(); } });

    /* ----- Vòng đời ----- */
    /* v2.87: nhịp giá chỉ đổi số (giá đầu phiếu + tóm tắt); KHÔNG dựng lại phiếu khi đang mở form nhập tay hoặc đang gõ */
    function typing() { var a = document.activeElement; return !!(S.form || (a && /^tr-/.test(a.id || "") && a.matches && a.matches("input,textarea,select"))); }
    function patchPx() { var p = el.querySelector(".tr-px"); if (p) { var t = last() ? "Giá " + nf(last()) : ""; if (p.textContent !== t) p.textContent = t; } if (!S.form) { try { lite(); } catch (e) { } } }
    timer = setInterval(function () { if (dead) return; if (!el.isConnected) { destroy(); return; } if (document.hidden || S.confirm || S.mode === "pend") return; if (typing()) { patchPx(); return; } render(); }, 15000);
    function onHide() { if (!dead) saveDraft(S, S.sym || sym()); }
    function destroy() { if (!dead) saveDraft(S, S.sym || sym()); dead = true; if (tbl) { try { tbl.destroy(); } catch (e) { } tbl = null; } if (timer) clearInterval(timer); timer = null; try { W.removeEventListener("pagehide", onHide); W.removeEventListener("nhip:exch-changed", onEx); } catch (e) { } try { el.innerHTML = ""; if (opts.whoHost) opts.whoHost.innerHTML = ""; } catch (e) { } }
    try { W.addEventListener("pagehide", onHide); } catch (e) { }
    var onEx = function () { if (!dead) render(); }; try { W.addEventListener("nhip:exch-changed", onEx); } catch (e) { }
    S.sym = sym();
    var hasPF = !!PF(); if (hasPF) { S.loading = false; adopt(); fixSel(); } render(); reload();
    return {
      destroy: destroy,
      setSide: function (v) { if (dead) return; S.side = v === "sell" ? "sell" : "buy"; render(); },
      sel: function () { return { cid: M.cid, pid: M.pid }; },
      prefill: prefill,
      refresh: function () { if (dead) return; if (sym() !== S.sym) { S.sym = sym(); S.priceTouched = false; S.price = ""; S.qty = ""; S.fee = ""; S.feeTouched = false; S.sl = ""; S.tp = ""; S.confirm = null; S.fromOrder = null; try { sessionStorage.removeItem(DK); } catch (e) { } render(); return; } if (S.mode === "pend" && tbl) { tbl.refresh(); return; } if (typing()) { patchPx(); return; } render(); }
    };
  }
  /* chọn khách/danh mục cho phiếu lệnh từ nơi khác (vd nút Mua/Bán trong Danh mục): đổi M rồi lưu */
  api.select = function (cid, pid) { try { var cs = (g("PF2") && g("PF2").customers) || [], ps = (g("PF2") && g("PF2").list) || []; var p = ps.filter(function (x) { return x.id === pid && x.cid === cid; })[0]; if (!p || !cs.some(function (c) { return c.id === cid; })) return false; M.cid = cid; M.pid = pid; save(); try { sessionStorage.setItem("pfCust", cid); } catch (e) { } try { window.dispatchEvent(new CustomEvent("nhip:trade-sel")); } catch (e) { } return true; } catch (e) { return false; } };
  api.mount = mount;
  return api;
});
