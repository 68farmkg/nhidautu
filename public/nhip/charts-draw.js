/* NHIP · Bộ vẽ nâng cao (v1.9): style từng nét, chuột phải, thanh thuộc tính, hoàn tác/làm lại, quản lý nét vẽ, hình mới.
   Dùng chung cho PC (chuột) và điện thoại (chạm: nhấn giữ = menu; thanh/menu hiện dạng ngăn dưới màn hình). Lỗi ở đây không làm hỏng biểu đồ. */
(function () {
  "use strict";
  var K = window.klinecharts, CUR = null;
  var PAL = ["#2f80ed", "#16bd8c", "#ee4b5e", "#f2994a", "#f2c94c", "#9b51e0", "#ffffff", "#111827"];
  var DEF = { c: "#2f80ed", w: 2, d: 0, f: 18 };
  var DEFT = {
    nhLong: { c: "#16bd8c", w: 1, f: 22 }, nhShort: { c: "#ee4b5e", w: 1, f: 22 }, fibonacciLine: { c: "#9b51e0", w: 1 }, nhFib: { c: "#9b51e0", w: 1 }, nhFibFan: { c: "#9b51e0", w: 1 }, nhFibExt: { c: "#9b51e0", w: 1 }, nhZone: { c: "#16bd8c", w: 1, f: 16 }, nhLabelRect: { c: "#2f80ed", w: 1, f: 12 }, nhAngle: { c: "#f2994a", w: 2 },
    horizontalStraightLine: { c: "#f2994a" }, nhRect: { c: "#f2c94c", w: 1 }, nhMeasure: { w: 1, d: 1 }
  };
  var FILL = { nhRect: 1, nhCircle: 1, nhTriangle: 1, priceChannelLine: 1, parallelStraightLine: 1 };
  var TKEY = "nhip.draw.tmpl.v2", tm = {}, fibLevels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1], fibColors = {}, fibShowPct = true, favorites = [], namedTemplates = {};
  try { var fcfg=JSON.parse(localStorage.getItem("nhip.draw.fibConfig")||"null"); if(fcfg){fibLevels=fcfg.levels||fibLevels;fibColors=fcfg.colors||{};fibShowPct=fcfg.showPct!==false;} else fibLevels=JSON.parse(localStorage.getItem("nhip.draw.fibLevels")||"null")||fibLevels; } catch (e) {}
  try { favorites = JSON.parse(localStorage.getItem("nhip.draw.favs") || "[]") || []; } catch (e) {}
  try { namedTemplates = JSON.parse(localStorage.getItem("nhip.draw.namedTemplates") || "{}") || {}; } catch (e) {}
  try { tm = JSON.parse(localStorage.getItem(TKEY) || "{}") || {}; } catch (e) { tm = {}; }
  var saveTm = function () { try { localStorage.setItem(TKEY, JSON.stringify(tm)); } catch (e) { } };
  var hexA = function (h, a) { var n = parseInt(String(h).slice(1), 16); return "rgba(" + (n >> 16 & 255) + "," + (n >> 8 & 255) + "," + (n & 255) + "," + Math.max(0, Math.min(1, a)) + ")"; };

  function stOf(name, st) {
    var b = Object.assign({}, DEF, DEFT[name], tm[name]), m = Object.assign({}, b, st || {});
    if (!/^#[0-9a-f]{6}$/i.test(m.c)) m.c = b.c;
    m.w = Math.max(1, Math.min(8, Math.round(+m.w) || b.w)); m.d = [0, 1, 2].indexOf(+m.d) < 0 ? 0 : +m.d; m.f = Math.max(0, Math.min(100, Math.round(+m.f))); if (!isFinite(m.f)) m.f = b.f;
    return m;
  }
  function styles(name, st) {
    st = stOf(name, st);
    var dv = st.d === 2 ? [2, 4] : [6, 4], ds = st.d ? "dashed" : "solid", fill = hexA(st.c, st.f / 100);
    var bd = { borderColor: st.c, borderSize: st.w, borderStyle: ds, borderDashedValue: dv };
    return {
      line: { style: ds, dashedValue: dv, color: st.c, size: st.w },
      rect: Object.assign({ style: "stroke_fill", color: fill }, bd), polygon: Object.assign({ style: "stroke_fill", color: fill }, bd),
      text: { color: st.c, size: st.textSize || 12, style: st.bold ? "bold" : "normal", backgroundColor: st.textBg || "transparent", align: st.textAlign || "left" }, point: { color: st.c, borderColor: hexA(st.c, 0.35) }
    };
  }
  var sty = function (a) { var o = a.overlay; return o && o.styles && o.styles.line && o.styles.polygon ? o.styles : styles(o && o.name, null); };
  var money = function (v) { return CUR && CUR.fp ? CUR.fp(v) : Number(v).toFixed(2); };
  function label(x, y, t, bg, al) {
    return { key: "lb" + t.length + bg, type: "text", ignoreEvent: true, attrs: { x: x, y: y, text: t, align: al || "center", baseline: "bottom" },
      styles: { style: "fill", color: "#fff", size: 12, backgroundColor: bg, borderColor: bg, borderRadius: 4, paddingLeft: 6, paddingRight: 6, paddingTop: 3, paddingBottom: 3 } };
  }
  function reg(name, pts, fn) {
    try { K.registerOverlay({ name: name, totalStep: pts + 1, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true, createPointFigures: fn }); }
    catch (e) { console.warn("charts-draw: không đăng ký được", name, e); }
  }
  function barsBetween(t0, t1) {
    try { var L = CUR.S.k.getDataList(), a = Math.min(t0, t1), b = Math.max(t0, t1), n = 0; for (var i = 0; i < L.length; i++) if (L[i].timestamp >= a && L[i].timestamp <= b) n++; return Math.max(0, n - 1); } catch (e) { return null; }
  }
  if (K && K.registerOverlay) {
    reg("nhFib", 2, function (a) { var c=a.coordinates,p=a.overlay.points,s=sty(a).line;if(c.length<2||!a.yAxis||!p[0]||!p[1])return [];var A=p[0].value,B=p[1].value,W=a.bounding.width,out=[];fibLevels.forEach(function(lv,i){var pr=A+(B-A)*lv,y=a.yAxis.convertToPixel(pr);if(!isFinite(y))return;out.push({key:"fl"+i,type:"line",attrs:{coordinates:[{x:c[0].x,y:y},{x:W,y:y}]},styles:{color:fibColors[String(lv)]||s.color,size:s.size,style:s.style,dashedValue:s.dashedValue}});out.push({key:"ft"+i,type:"text",ignoreEvent:true,attrs:{x:W-4,y:y-2,text:(fibShowPct?(Math.round(lv*1000)/10)+"% ":"")+money(pr),align:"right",baseline:"bottom"},styles:{style:"fill",color:fibColors[String(lv)]||s.color,size:11}});});return out;});
    reg("nhFibFan", 2, function(a){var c=a.coordinates,p=a.overlay.points,s=sty(a).line;if(c.length<2||!a.yAxis||!p[0]||!p[1])return [];var A=p[0].value,B=p[1].value,dx=Math.max(20,a.bounding.width-c[0].x),out=[];[0.382,0.5,0.618,1].forEach(function(k,i){var y=a.yAxis.convertToPixel(A+(B-A)*k);if(isFinite(y))out.push({key:"fan"+i,type:"line",attrs:{coordinates:[c[0],{x:Math.min(a.bounding.width,c[0].x+dx),y:y}]},styles:s});});return out;});
    reg("nhAngle", 2, function(a){var c=a.coordinates;if(c.length<2)return [];var dx=Math.max(1,c[1].x-c[0].x),dy=c[1].y-c[0].y,W=a.bounding.width;return [{key:"ang",type:"line",attrs:{coordinates:[c[0],{x:W,y:c[0].y+dy/dx*(W-c[0].x)}]},styles:sty(a).line}];});
    reg("nhZone", 2, function(a){var c=a.coordinates;if(c.length<2)return [];var x=Math.min(c[0].x,c[1].x),y=Math.min(c[0].y,c[1].y),w=Math.abs(c[1].x-c[0].x),h=Math.abs(c[1].y-c[0].y),st=sty(a),txt=a.overlay.extendData||(c[1].y<c[0].y?"Kháng cự":"Hỗ trợ");return [{key:"zone",type:"rect",attrs:{x:x,y:y,width:w,height:h},styles:st.rect},label(x+8,y+18,txt,st.line.color,"left")];});
    reg("nhLabelRect", 2, function(a){var c=a.coordinates;if(c.length<2)return [];var x=Math.min(c[0].x,c[1].x),y=Math.min(c[0].y,c[1].y),w=Math.abs(c[1].x-c[0].x),h=Math.abs(c[1].y-c[0].y),st=sty(a),txt=a.overlay.extendData||"Nhãn";return [{key:"lr",type:"rect",attrs:{x:x,y:y,width:w,height:h},styles:st.rect},label(x+6,y+18,txt,st.line.color,"left")];});

    reg("nhRect", 2, function (a) {
      var c = a.coordinates; if (c.length < 2) return [];
      return [{ key: "r", type: "rect", attrs: { x: Math.min(c[0].x, c[1].x), y: Math.min(c[0].y, c[1].y), width: Math.abs(c[1].x - c[0].x), height: Math.abs(c[1].y - c[0].y) }, styles: sty(a).rect }];
    });
    reg("nhCircle", 2, function (a) {
      var c = a.coordinates; if (c.length < 2) return [];
      return [{ key: "c", type: "circle", attrs: { x: c[0].x, y: c[0].y, r: Math.hypot(c[1].x - c[0].x, c[1].y - c[0].y) }, styles: sty(a).polygon }];
    });
    reg("nhTriangle", 3, function (a) {
      var c = a.coordinates; if (c.length < 2) return [];
      return c.length < 3 ? [{ key: "l", type: "line", attrs: { coordinates: c }, styles: sty(a).line }] : [{ key: "t", type: "polygon", attrs: { coordinates: c }, styles: sty(a).polygon }];
    });
    reg("nhArrow", 2, function (a) {
      var c = a.coordinates, s = sty(a).line; if (c.length < 2) return [];
      var an = Math.atan2(c[1].y - c[0].y, c[1].x - c[0].x), L = 8 + s.size * 3, p = c[1];
      return [{ key: "l", type: "line", attrs: { coordinates: c }, styles: s },
        { key: "h", type: "polygon", attrs: { coordinates: [p, { x: p.x - L * Math.cos(an - 0.45), y: p.y - L * Math.sin(an - 0.45) }, { x: p.x - L * Math.cos(an + 0.45), y: p.y - L * Math.sin(an + 0.45) }] }, styles: { style: "fill", color: s.color } }];
    });
    reg("nhMeasure", 2, function (a) {
      var c = a.coordinates, p = a.overlay.points; if (c.length < 2 || !p[1] || p[0].value == null || p[1].value == null) return [];
      var d = p[1].value - p[0].value, pc = p[0].value ? d / p[0].value * 100 : 0, col = d >= 0 ? "#16bd8c" : "#ee4b5e";
      var n = barsBetween(p[0].timestamp, p[1].timestamp);
      var t = (d >= 0 ? "+" : "−") + money(Math.abs(d)) + " (" + (pc >= 0 ? "+" : "−") + Math.abs(pc).toFixed(2) + "%)" + (n != null ? " · " + n + " nến" : "");
      var x = Math.min(c[0].x, c[1].x), y = Math.min(c[0].y, c[1].y);
      return [{ key: "b", type: "rect", attrs: { x: x, y: y, width: Math.abs(c[1].x - c[0].x), height: Math.abs(c[1].y - c[0].y) }, styles: { style: "stroke_fill", color: hexA(col, 0.12), borderColor: col, borderSize: 1, borderStyle: "dashed", borderDashedValue: [4, 3] } },
        { key: "l", type: "line", attrs: { coordinates: [c[0], c[1]] }, styles: { color: col, size: 1 } }, label(x + Math.abs(c[1].x - c[0].x) / 2, y - 4, t, col)];
    });
    var pos = function (tag) {
      return function (a) {
        var c = a.coordinates, p = a.overlay.points; if (c.length < 2 || !a.yAxis || p[0].value == null || p[1].value == null) return [];
        var e = p[0].value, s = p[1].value, has = c.length > 2 && p[2] && p[2].value != null, t = has ? p[2].value : e + (e - s) * 2;
        var ty = has ? c[2].y : a.yAxis.convertToPixel(t), L = Math.min(c[0].x, c[1].x), W = Math.max(Math.abs(c[1].x - c[0].x), 70);
        var risk = Math.abs(e - s) / e * 100, rew = Math.abs(t - e) / e * 100, rr = Math.abs(e - s) > 0 ? Math.abs(t - e) / Math.abs(e - s) : 0, ln = sty(a).line;
        return [{ key: "tp", type: "rect", attrs: { x: L, y: Math.min(c[0].y, ty), width: W, height: Math.abs(ty - c[0].y) }, styles: { style: "fill", color: hexA("#16bd8c", 0.2) } },
          { key: "sl", type: "rect", attrs: { x: L, y: Math.min(c[0].y, c[1].y), width: W, height: Math.abs(c[1].y - c[0].y) }, styles: { style: "fill", color: hexA("#ee4b5e", 0.2) } },
          { key: "en", type: "line", attrs: { coordinates: [{ x: L, y: c[0].y }, { x: L + W, y: c[0].y }] }, styles: ln },
          label(L + W / 2, Math.min(c[0].y, ty) - 2, tag + " · RR 1:" + rr.toFixed(2) + " · +" + rew.toFixed(2) + "%", "#16bd8c"),
          label(L + W / 2, Math.max(c[0].y, c[1].y) + 22, "−" + risk.toFixed(2) + "% (dừng lỗ)", "#ee4b5e")];
      };
    };
    reg("nhLong", 3, pos("LONG")); reg("nhShort", 3, pos("SHORT"));
    reg("nhFibExt", 3, function (a) {
      var c = a.coordinates, p = a.overlay.points, s = sty(a).line; if (c.length < 2) return [];
      var out = [{ key: "ab", type: "line", attrs: { coordinates: c.slice(0, 3) }, styles: { color: s.color, size: 1, style: "dashed", dashedValue: [4, 4] } }];
      if (c.length < 3 || !a.yAxis) return out;
      var A = p[0].value, B = p[1].value, Cv = p[2].value, W = a.bounding.width;
      [0, 0.618, 1, 1.272, 1.618, 2, 2.618].forEach(function (lv, i) {
        var pr = Cv + (B - A) * lv, y = a.yAxis.convertToPixel(pr);
        out.push({ key: "f" + i, type: "line", attrs: { coordinates: [{ x: c[2].x, y: y }, { x: W, y: y }] }, styles: s });
        out.push({ key: "t" + i, type: "text", ignoreEvent: true, attrs: { x: W - 4, y: y - 2, text: lv + " · " + money(pr), align: "right", baseline: "bottom" }, styles: { style: "fill", color: s.color, size: 11 } });
      });
      return out;
    });
  }

  function attach(ctx) {
    CUR = ctx;
    var S = ctx.S, $ = ctx.$, esc = ctx.esc, hist = [], hi = -1, mag = 0, cont = false, sel = null, lastE = null, hit = false, lastCtx = 0, zTop = 0, zBot = 0;
    var LBL = {}; ctx.C.TOOLS.forEach(function (t) { LBL[t[0]] = t[1]; });
    var selectedMany = {}, toolSearch = "", showOnlyFav = false;
    var MAGL = ["Tắt", "Yếu", "Mạnh"], MODES = ["normal", "weak_magnet", "strong_magnet"];
    var PC = function () { return window.matchMedia && matchMedia("(hover:hover) and (pointer:fine)").matches; };
    var host = $("#cpm") || document.body;
    host.insertAdjacentHTML("beforeend",
      '<div class="nd-menu" hidden role="menu"></div>' +
      '<div class="nd-bar" hidden><b class="nd-nm"></b><span class="nd-sw">' + PAL.map(function (c) { return '<button type="button" data-c="' + c + '" style="background:' + c + '" aria-label="Màu ' + c + '"></button>'; }).join("") + '<input type="color" class="nd-col" aria-label="Màu tùy chọn"></span>' +
      '<select class="nd-w" aria-label="Độ dày">' + [1, 2, 3, 4, 5, 6].map(function (n) { return '<option value="' + n + '">' + n + " px</option>"; }).join("") + '</select>' +
      '<select class="nd-d" aria-label="Kiểu nét"><option value="0">Liền</option><option value="1">Đứt</option><option value="2">Chấm</option></select>' +
      '<label class="nd-f">Nền <input type="range" min="0" max="100" step="2" aria-label="Độ trong suốt nền"></label>' +
      '<button type="button" data-a="more">⋯</button><button type="button" data-a="lock">Khóa</button><button type="button" data-a="clone">Nhân bản</button><button type="button" data-a="del">Xóa</button><button type="button" data-a="x" aria-label="Đóng">✕</button></div>' +
      '<div class="nd-pan" hidden><div class="nd-ph"><b></b><button type="button" data-a="px" aria-label="Đóng">✕</button></div><div class="nd-tools"><input class="nd-search" placeholder="Tìm công cụ…" aria-label="Tìm công cụ"><button type="button" data-a="favonly">☆ Yêu thích</button><button type="button" data-a="savefav">Ghim công cụ đang chọn</button></div><div class="nd-bulk"><button type="button" data-a="group">Nhóm đã chọn</button><button type="button" data-a="hidegroup">Ẩn nhóm</button><button type="button" data-a="lockgroup">Khóa nhóm</button><button type="button" data-a="delgroup">Xóa đã chọn</button><button type="button" data-a="fibcfg">Mức Fibonacci</button><button type="button" data-a="exporttpl">Sao lưu mẫu</button><button type="button" data-a="importtpl">Khôi phục mẫu</button></div><div class="nd-pl"></div></div>');
    var menu = $(".nd-menu"), bar = $(".nd-bar"), pan = $(".nd-pan");
    var rail = $("#cx-rail");
    if (rail && !$("#rl-redo")) rail.insertAdjacentHTML("beforeend", '<button type="button" id="rl-redo" title="Làm lại (Ctrl+Y)">' + ctx.svg("redo") + '</button><button type="button" id="rl-cont" title="Vẽ liên tục" aria-pressed="false">' + ctx.svg("cont") + '</button><button type="button" id="rl-list" title="Quản lý nét vẽ">' + ctx.svg("list") + "</button>");
    var find = function (id) { return S.draws.filter(function (r) { return r.id === id; })[0]; };

    /* ----- lịch sử hoàn tác ----- */
    function snap() { return JSON.stringify(S.draws.map(function (r) { return { name: r.name, points: r.points, text: r.text, st: r.st, lock: r.lock, hide: r.hide, z: r.z }; })); }
    function push() { var s = snap(); if (hist[hi] === s) return; hist = hist.slice(0, hi + 1); hist.push(s); if (hist.length > 60) hist.shift(); hi = hist.length - 1; renderPan(); }
    function reset() { S.draws.forEach(function(r){ try{S.k.overrideOverlay({id:r.id,visible:!S.hidden&&(!r.tf||r.tf===S.res)&&!r.hide});}catch(e){} }); hist = [snap()]; hi = 0; sel = null; bar.hidden = true; closeMenu(); zTop = Math.max.apply(null, [0].concat(S.draws.map(function (r) { return r.z || 0; }))); zBot = Math.min.apply(null, [0].concat(S.draws.map(function (r) { return r.z || 0; }))); renderPan(); syncBtns(); }
    function go(d) {
      var n = hi + d; if (n < 0 || n >= hist.length) return ctx.toast(d < 0 ? "Không còn thao tác để hoàn tác" : "Không còn thao tác để làm lại");
      hi = n; sel = null; bar.hidden = true; ctx.rebuild(JSON.parse(hist[n])); renderPan(); syncBtns();
    }
    function syncBtns() { var m = $("#rl-cont"); if (m) { m.classList.toggle("on", cont); m.setAttribute("aria-pressed", cont ? "true" : "false"); } }

    /* ----- thao tác ----- */
    function cycleMag() {
      mag = (mag + 1) % 3; S.magnet = mag > 0; S.draws.forEach(function (r) { try { S.k.overrideOverlay({ id: r.id, mode: MODES[mag] }); } catch (e) { } });
      ctx.sync(); ctx.toast("Nam châm: " + MAGL[mag] + (mag ? " — hít vào giá O/H/L/C" : ""));
    }
    function toggleCont() { cont = !cont; syncBtns(); ctx.toast("Vẽ liên tục: " + (cont ? "bật" : "tắt")); }
    function del(id) { try { S.k.removeOverlay({ id: id }); } catch (e) { } gone(id); }
    function gone(id) { if (sel === id) { sel = null; bar.hidden = true; } renderPan(); }
    function setSt(p, quiet) { var r = find(sel); if (!r) return; ctx.patch(sel, { st: Object.assign({}, stOf(r.name, r.st), p) }, quiet); if (!quiet) fillBar(); }
    function front(id, up) { ctx.patch(id, { z: up ? ++zTop : --zBot }); ctx.toast(up ? "Đã đưa lên trước" : "Đã gửi ra sau"); }
    function unlockAll() { S.draws.forEach(function (r) { if (r.lock) ctx.patch(r.id, { lock: false }, true); }); ctx.persist(); ctx.toast("Đã mở khóa tất cả"); }
    async function editText(id) { var r = find(id); if (!r) return; var t = await NhipDlg.prompt({ title: "Sửa nội dung ghi chú", icon: "edit", label: "Nội dung ghi chú", value: r.text || "", maxLength: 120, multiline: true, rows: 3, required: false, okText: "Lưu" }); if (t == null) return; ctx.patch(id, { text: t.slice(0, 120) }); }
    function alertAt(pr) {
      var L = S.k.getDataList(), last = L.length ? L[L.length - 1].close : pr, ty = pr >= last ? "price_gte" : "price_lte";
      ctx.api("/api/alerts/rules", { method: "POST", body: { sym: S.sym, type: ty, val: Math.round(pr * S.sc), channels: { browser: true } } })
        .then(function () { ctx.toast("Đã đặt cảnh báo " + (ty === "price_gte" ? "giá ≥ " : "giá ≤ ") + ctx.fp(pr)); }).catch(function (e) { ctx.toast((e && e.message) || "Không đặt được cảnh báo", 1); });
    }
    function ptAt(ev) {
      try {
        var dom = S.k.getDom(), rc = dom.getBoundingClientRect(), r = S.k.convertFromPixel([{ x: ev.clientX - rc.left, y: ev.clientY - rc.top }], { paneId: "candle_pane" })[0], L = S.k.getDataList();
        if (!r || r.value == null) return null;
        var t = r.timestamp; if (!isFinite(t)) t = r.dataIndex != null && L[r.dataIndex] ? L[r.dataIndex].timestamp : L.length ? L[L.length - 1].timestamp : NaN;
        return isFinite(t) ? { timestamp: t, value: r.value } : null;
      } catch (e) { return null; }
    }

    /* ----- menu chuột phải / nhấn giữ ----- */
    var menuT = 0;
    function closeMenu(force) { if (force !== true && Date.now() - menuT < 700) return; /* v3.18: chạm nhả tay sinh sự kiện chuột thừa → không đóng ngay */ menu.hidden = true; }
    function showMenu(x, y, items) {
      menu.innerHTML = '<div class="nd-mh"><b>Tùy chọn</b><button type="button" class="nd-mx" aria-label="Đóng">✕</button></div>' + items.map(function (it, i) { return it === "-" ? '<i class="nd-sep"></i>' : '<button type="button" role="menuitem" data-i="' + i + '"' + (it.dis ? " disabled" : "") + "><span>" + esc(it.t) + "</span>" + (it.k ? "<kbd>" + it.k + "</kbd>" : "") + "</button>"; }).join("");
      menu.hidden = false; menuT = Date.now(); menu.style.left = menu.style.top = "";
      if (PC()) { menu.style.left = Math.max(8, Math.min(x, innerWidth - menu.offsetWidth - 8)) + "px"; menu.style.top = Math.max(8, Math.min(y, innerHeight - menu.offsetHeight - 8)) + "px"; }
      menu.onclick = function (e) { var b = e.target.closest("button"); if (!b || b.disabled) return; if (b.classList.contains("nd-mx")) { closeMenu(true); return; } var it = items[+b.dataset.i]; closeMenu(true); if (it && it.fn) it.fn(); };
    }
    function objMenu(id, x, y) {
      var r = find(id); if (!r) return; var text = r.name === "simpleAnnotation";
      showMenu(x, y, [{ t: "Sửa thuộc tính…", fn: function () { showBar(id); } }, text ? { t: "Sửa chữ…", fn: function () { editText(id); } } : null, text ? { t: "Thuộc tính chữ (cỡ/đậm/nền/căn lề)…", fn: async function(){var q=r.textStyle||{size:12,bold:false,align:"left",bg:r.st&&r.st.c||"#2f80ed"};var z=await NhipDlg.form({title:"Kiểu chữ của ghi chú",icon:"edit",okText:"Áp dụng",fields:[{name:"size",label:"Cỡ chữ",type:"number",value:q.size,required:true,hint:"Từ 9 đến 28.",chips:[12,14,16,20].map(function(n){return{label:String(n),value:String(n)}}),validate:function(v){return isFinite(+v)&&+v>=9&&+v<=28?"":"Nhập số từ 9 đến 28."}},{name:"bold",type:"switch",label:"Chữ đậm",value:q.bold},{name:"align",type:"choice",label:"Căn lề",value:q.align,options:[{value:"left",label:"Trái"},{value:"center",label:"Giữa"},{value:"right",label:"Phải"}]},{name:"bg",type:"color",label:"Màu nền",value:q.bg,required:true,validate:function(v){return /^#[0-9a-f]{6}$/i.test(v)?"":"Nhập màu dạng #RRGGBB, ví dụ #2f80ed."}}]});if(!z)return;ctx.patch(id,{textStyle:{size:Math.max(9,Math.min(28,+z.size||12)),bold:!!z.bold,align:["left","center","right"].indexOf(z.align)>=0?z.align:"left",bg:z.bg}}); } } : null, { t: "Nhân bản", k: "Ctrl+D", fn: function () { ctx.clone(id); } }, "-",
        { t: "Khóa nét vẽ (mở khóa trong Quản lý)", fn: function () { ctx.patch(id, { lock: true }); bar.hidden = true; sel = null; } }, { t: "Ẩn nét này", fn: function () { ctx.patch(id, { hide: true }); bar.hidden = true; sel = null; } }, { t: "Đặt tên nhóm…", fn:async function(){var g=await NhipDlg.prompt({title:"Đặt tên nhóm cho nét vẽ",icon:"folder",label:"Tên nhóm",value:r.group||"",maxLength:60,required:false,hint:"Để trống nếu muốn bỏ nét này khỏi nhóm.",okText:"Lưu"});if(g!=null)ctx.patch(id,{group:g.slice(0,60)});} },
        { t: "Đưa lên trước", fn: function () { front(id, true); } }, { t: "Gửi ra sau", fn: function () { front(id, false); } }, "-",
        { t: "Lưu mẫu thuộc tính có tên…", fn: async function () { var nm=await NhipDlg.prompt({title:"Lưu mẫu thuộc tính",icon:"tag",label:"Tên mẫu",value:LBL[r.name]||r.name,maxLength:40,hint:"Lưu lại kiểu của nét này để áp dụng nhanh cho nét khác.",okText:"Lưu mẫu"}); if(!nm)return; namedTemplates[nm]={tool:r.name,st:stOf(r.name,r.st)}; try{localStorage.setItem("nhip.draw.namedTemplates",JSON.stringify(namedTemplates));}catch(e){} ctx.toast("Đã lưu mẫu: "+nm); } }, { t: "Đặt làm mẫu mặc định cho công cụ này", fn: function () { tm[r.name] = stOf(r.name, r.st); saveTm(); ctx.toast("Đã lưu mẫu cho " + (LBL[r.name] || r.name)); } },
        { t: "Áp dụng mẫu có tên…", fn: async function(){var names=Object.keys(namedTemplates);if(!names.length)return ctx.toast("Chưa có mẫu có tên");var nm=await NhipDlg.pick({title:"Áp dụng mẫu đã lưu",icon:"tag",message:"Chọn một mẫu để áp dụng cho nét vẽ này.",options:names.map(function(n){return{value:n,label:n,sub:LBL[(namedTemplates[n]||{}).tool]||""}})});if(nm&&namedTemplates[nm]&&namedTemplates[nm].st)ctx.patch(id,{st:namedTemplates[nm].st});}, dis: !Object.keys(namedTemplates).length }, { t: "Chỉ hiện ở khung thời gian hiện tại", fn:function(){ctx.patch(id,{tf:S.res});ctx.toast("Nét này chỉ hiện ở "+S.res);} }, { t: "Hiện ở mọi khung thời gian", fn:function(){ctx.patch(id,{tf:""});} }, { t: "Về mặc định của công cụ", fn: function () { delete tm[r.name]; saveTm(); ctx.patch(id, { st: stOf(r.name, null) }); if (sel === id) fillBar(); } }, "-", { t: "Xóa", k: "Del", fn: function () { del(id); } }].filter(Boolean));
    }
    function blankMenu(x, y, ev) {
      var pt = ev && ptAt(ev), it = [];
      if (pt) {
        var pr = pt.value, P = [{ timestamp: pt.timestamp, value: pr }];
        it.push({ t: "Vẽ đường ngang tại " + ctx.fp(pr), fn: function () { ctx.add("horizontalStraightLine", P, ""); } }, { t: "Đặt cảnh báo giá tại " + ctx.fp(pr), fn: function () { alertAt(pr); } },
          { t: "Thêm ghi chú tại đây…", fn: async function () { var t = await NhipDlg.prompt({ title: "Thêm ghi chú tại đây", icon: "edit", label: "Nội dung ghi chú", placeholder: "VD: Vùng cầu mạnh", maxLength: 120, multiline: true, rows: 3, okText: "Thêm ghi chú" }); if (t) ctx.add("simpleAnnotation", P, t.slice(0, 120)); } }, "-");
      }
      it.push({ t: "Nam châm: " + MAGL[mag] + " (đổi)", k: "M", fn: cycleMag }, { t: "Vẽ liên tục: " + (cont ? "bật" : "tắt"), fn: toggleCont }, "-",
        { t: (S.hidden ? "Hiện" : "Ẩn") + " tất cả nét vẽ", fn: function () { $("#rl-hide").click(); } }, { t: "Mở khóa tất cả", fn: unlockAll, dis: !S.draws.some(function (r) { return r.lock; }) }, "-",
        { t: "Hoàn tác", k: "Ctrl+Z", fn: function () { go(-1); }, dis: hi <= 0 }, { t: "Làm lại", k: "Ctrl+Y", fn: function () { go(1); }, dis: hi >= hist.length - 1 }, "-",
        { t: "Quản lý nét vẽ (" + S.draws.length + ")", fn: function () { togglePan(); } }, { t: "Xóa tất cả nét vẽ", fn: function () { $("#rl-clear").click(); }, dis: !S.draws.length });
      showMenu(x, y, it);
    }
    var stage = $(".cx-stage") || host;
    stage.addEventListener("contextmenu", function (e) {
      if (!e.target.closest || !e.target.closest(".cx-chart")) return;
      e.preventDefault(); lastE = e; hit = false; lastCtx = Date.now();
      setTimeout(function () { if (!hit && ctx.ok()) blankMenu(e.clientX, e.clientY, e); }, 0);
    }, true);
    var lp = null;
    stage.addEventListener("touchstart", function (e) {
      clearTimeout(lp); if (e.touches.length !== 1 || S.tool || !e.target.closest || !e.target.closest(".cx-chart")) return;
      var t = e.touches[0], x0 = t.clientX, y0 = t.clientY; lastE = { clientX: x0, clientY: y0 };
      lp = setTimeout(function () { if (Date.now() - lastCtx < 1500 || !ctx.ok()) return; if (sel && find(sel)) objMenu(sel, x0, y0); else blankMenu(x0, y0, lastE); if (navigator.vibrate) try { navigator.vibrate(12); } catch (x) { } }, 550);
    }, { passive: true });
    ["touchmove", "touchend", "touchcancel"].forEach(function (n) { stage.addEventListener(n, function () { clearTimeout(lp); }, { passive: true }); });
    document.addEventListener("mousedown", function away(e) { if (!ctx.ok()) { document.removeEventListener("mousedown", away); return; } if (!menu.hidden && !e.target.closest(".nd-menu")) closeMenu(); });
    document.addEventListener("touchstart", function away(e) { if (!ctx.ok()) { document.removeEventListener("touchstart", away); return; } if (!menu.hidden && !e.target.closest(".nd-menu")) closeMenu(); }, { passive: true });
    var _w0 = innerWidth; addEventListener("resize", function () { if (innerWidth !== _w0) { _w0 = innerWidth; closeMenu(); } });

    /* ----- thanh thuộc tính ----- */
    function place() {
      var ch = $(".cx-chart");
      if (PC() && ch) { var rc = ch.getBoundingClientRect(); bar.style.top = Math.max(8, rc.top + 8) + "px"; bar.style.left = (rc.left + rc.width / 2) + "px"; } else { bar.style.top = bar.style.left = ""; }
    }
    function fillBar() {
      var r = find(sel); if (!r) { bar.hidden = true; return; }
      var st = stOf(r.name, r.st);
      bar.hidden = false; bar.querySelector(".nd-nm").textContent = LBL[r.name] || r.name; bar.querySelector(".nd-w").value = String(Math.min(6, st.w)); bar.querySelector(".nd-d").value = String(st.d);
      var f = bar.querySelector(".nd-f"); f.hidden = !FILL[r.name]; f.querySelector("input").value = st.f; bar.querySelector(".nd-col").value = st.c;
      bar.querySelectorAll(".nd-sw button").forEach(function (b) { b.classList.toggle("on", b.dataset.c.toLowerCase() === st.c.toLowerCase()); });
      bar.querySelector('[data-a="lock"]').textContent = r.lock ? "Mở khóa" : "Khóa"; place(); renderPan();
    }
    function showBar(id) { sel = id; fillBar(); }
    bar.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      if (b.dataset.c) return setSt({ c: b.dataset.c });
      var a = b.dataset.a, r = find(sel); if (!r) return;
      if (a === "x") { bar.hidden = true; } else if (a === "del") del(sel); else if (a === "clone") ctx.clone(sel);
      else if (a === "lock") { ctx.patch(sel, { lock: !r.lock }); if (!r.lock) { bar.hidden = true; sel = null; } else fillBar(); }
      else if (a === "more") { var q = b.getBoundingClientRect(); objMenu(sel, q.left, q.bottom + 4); }
    });
    bar.querySelector(".nd-w").onchange = function () { setSt({ w: +this.value }); };
    bar.querySelector(".nd-d").onchange = function () { setSt({ d: +this.value }); };
    bar.querySelector(".nd-col").oninput = function () { setSt({ c: this.value }, true); };
    bar.querySelector(".nd-col").onchange = function () { setSt({ c: this.value }); };
    bar.querySelector(".nd-f input").oninput = function () { setSt({ f: +this.value }, true); };
    bar.querySelector(".nd-f input").onchange = function () { setSt({ f: +this.value }); };

    /* ----- bảng quản lý nét vẽ ----- */
    function renderToolFinder(){ var q=toolSearch.toLowerCase(); var arr=ctx.C.TOOLS.filter(function(t){return (!q||(t[1]+" "+t[0]).toLowerCase().indexOf(q)>=0)&&(!showOnlyFav||favorites.indexOf(t[0])>=0);}); return '<div class="nd-toolgrid">'+arr.map(function(t){return '<button type="button" data-toolpick="'+esc(t[0])+'">'+(favorites.indexOf(t[0])>=0?'★ ':'☆ ')+esc(t[1])+'</button>';}).join('')+'</div>'; }
    function picked(){return S.draws.filter(function(r){return !!selectedMany[r.id];});}
    function fibParse(v){return String(v).split(',').filter(function(x){return x.trim()!==''}).map(Number).filter(function(n){return isFinite(n)&&n>=-5&&n<=5;}).filter(function(n,i,x){return x.indexOf(n)===i;}).sort(function(x,y){return x-y;});}
    async function fibConfig(){var r0=await NhipDlg.form({title:"Cấu hình Fibonacci",icon:"chart",wide:true,okText:"Lưu cấu hình",message:"Chọn các mức hồi quy hiển thị trên công cụ Fibonacci.",fields:[{name:"levels",label:"Các mức",value:fibLevels.join(", "),mono:true,required:true,hint:"Cách nhau bằng dấu phẩy, mỗi mức từ -5 đến 5.",chips:[{label:"Mặc định",value:"0, 0.236, 0.382, 0.5, 0.618, 0.786, 1"},{label:"Mở rộng",value:"0, 0.382, 0.5, 0.618, 1, 1.272, 1.618"}],validate:function(v){return fibParse(v).length?"":"Chưa có mức hợp lệ (từ -5 đến 5).";}},{name:"pct",type:"switch",label:"Hiện nhãn phần trăm",hint:"Ví dụ 61,8% bên cạnh mỗi mức.",value:fibShowPct},{name:"colors",label:"Màu riêng cho từng mức (tùy chọn)",type:"textarea",rows:3,mono:true,required:false,value:JSON.stringify(fibColors),hint:'Dạng JSON, ví dụ {"0.618":"#ee4b5e"}. Để trống để giữ màu hiện tại.',validate:function(v){try{JSON.parse(v);return "";}catch(e){return "JSON màu chưa hợp lệ.";}}}]});if(!r0)return;var a=fibParse(r0.levels);fibLevels=a;fibShowPct=!!r0.pct;if(r0.colors){try{fibColors=JSON.parse(r0.colors);}catch(e){return ctx.toast("JSON màu Fibonacci không hợp lệ",1);}}try{localStorage.setItem('nhip.draw.fibConfig',JSON.stringify({levels:fibLevels,colors:fibColors,showPct:fibShowPct}));localStorage.setItem('nhip.draw.fibLevels',JSON.stringify(a));}catch(e){}try{S.draws.filter(function(r){return r.name==='nhFib';}).forEach(function(r){S.k.overrideOverlay({id:r.id});});}catch(e){}ctx.toast('Đã cập nhật '+a.length+' mức Fibonacci');}
    async function templateIO(mode){if(mode==='exporttpl'){var data=JSON.stringify({defaults:tm,named:namedTemplates,fibLevels:fibLevels,favorites:favorites},null,2);await NhipDlg.form({title:"Sao lưu mẫu vẽ",icon:"copy",wide:true,message:"Sao chép nội dung bên dưới và lưu ở nơi an toàn. Dùng “Khôi phục mẫu” để nạp lại khi cần.",fields:[{name:"d",type:"readonly",label:"Nội dung sao lưu",value:data,rows:8}],okText:"Xong",hideCancel:true});}else{var raw=await NhipDlg.prompt({title:"Khôi phục mẫu vẽ",icon:"upload",wide:true,label:"Nội dung sao lưu (JSON)",placeholder:"Dán nội dung đã sao lưu vào đây",multiline:true,rows:8,mono:true,trim:false,hint:"Mẫu hiện tại sẽ được thay bằng nội dung bạn dán.",okText:"Khôi phục"});if(!raw)return;try{var o=JSON.parse(raw);if(o.defaults&&typeof o.defaults==='object')tm=o.defaults;if(o.named&&typeof o.named==='object')namedTemplates=o.named;if(Array.isArray(o.fibLevels))fibLevels=o.fibLevels.filter(function(n){return isFinite(n)});if(Array.isArray(o.favorites))favorites=o.favorites;saveTm();localStorage.setItem('nhip.draw.namedTemplates',JSON.stringify(namedTemplates));localStorage.setItem('nhip.draw.fibLevels',JSON.stringify(fibLevels));localStorage.setItem('nhip.draw.favs',JSON.stringify(favorites));ctx.toast('Đã khôi phục mẫu');}catch(e){ctx.toast('JSON sao lưu không hợp lệ',1);}}}
    function renderPan() {
      if (pan.hidden) return;
      pan.querySelector(".nd-ph b").textContent = "Nét vẽ — " + S.sym + " (" + S.draws.length + ")";
      pan.querySelector(".nd-pl").innerHTML = renderToolFinder() + (S.draws.length ? S.draws.map(function (r, i) {
        var st = stOf(r.name, r.st);
        return '<div class="nd-row' + (r.id === sel ? " on" : "") + (r.hide ? " off" : "") + '" data-id="' + esc(r.id) + '"><input type="checkbox" class="nd-pick" ' + (selectedMany[r.id] ? 'checked' : '') + ' aria-label="Chọn nét"><i style="background:' + st.c + '"></i><span class="nd-t">' + esc((LBL[r.name] || r.name) + (r.group ? " · Nhóm: "+r.group : "") + (r.tf ? " · TF: "+r.tf : "") + (r.text ? " — " + r.text : "")) + "</span>" +
          '<button type="button" data-a="eye" aria-label="Ẩn/hiện">' + (r.hide ? "Hiện" : "Ẩn") + '</button><button type="button" data-a="lk" aria-label="Khóa">' + (r.lock ? "Mở" : "Khóa") + '</button><button type="button" data-a="rm" aria-label="Xóa">Xóa</button></div>';
      }).join("") : '<p class="nd-empty">Chưa có nét vẽ nào.</p>');
    }
    function togglePan() { pan.hidden = !pan.hidden; closeMenu(true); renderPan(); }
    pan.addEventListener("click", async function (e) {
      var b = e.target.closest("button"), row = e.target.closest(".nd-row");
      if (e.target.classList.contains("nd-search")) return;
      if (e.target.classList.contains("nd-pick") && row) { selectedMany[row.dataset.id]=e.target.checked; return; }
      if (b && b.dataset.a === "px") { pan.hidden = true; return; }
      if (b && b.dataset.a === "fibcfg") return fibConfig();
      if (b && (b.dataset.a === "exporttpl" || b.dataset.a === "importtpl")) return templateIO(b.dataset.a);
      if (b && b.dataset.a === "favonly") { showOnlyFav=!showOnlyFav; renderPan(); return; }
      if (b && b.dataset.a === "savefav") { if(!S.tool)return ctx.toast("Hãy chọn công cụ trên thanh vẽ trước",1); if(favorites.indexOf(S.tool)<0)favorites.push(S.tool); localStorage.setItem("nhip.draw.favs",JSON.stringify(favorites)); renderPan(); return; }
      if (b && b.dataset.a === "group") { var arr=picked(); if(!arr.length)return ctx.toast("Chọn ít nhất một nét",1);var g=await NhipDlg.prompt({title:"Gộp thành nhóm",icon:"folder",subject:arr.length+" nét đã chọn",label:"Tên nhóm",value:arr[0].group||"Nhóm 1",maxLength:60,okText:"Tạo nhóm"});if(!g)return;arr.forEach(function(r){ctx.patch(r.id,{group:g.slice(0,60)},true);});ctx.persist();renderPan();return; }
      if (b && b.dataset.a === "hidegroup") { var arr=picked();arr.forEach(function(r){ctx.patch(r.id,{hide:true},true);});ctx.persist();renderPan();return; }
      if (b && b.dataset.a === "lockgroup") { var arr=picked();arr.forEach(function(r){ctx.patch(r.id,{lock:true},true);});ctx.persist();renderPan();return; }
      if (b && b.dataset.a === "delgroup") { var arr=picked();if(!arr.length)return ctx.toast("Chọn ít nhất một nét",1);if(!(await NhipDlg.confirm({tone:"danger",icon:"trash",title:"Xóa các nét đã chọn?",message:"Sẽ xóa "+arr.length+" nét vẽ khỏi biểu đồ.",note:{tone:"danger",text:"Không thể hoàn tác."},okText:"Xóa "+arr.length+" nét",cancelText:"Giữ lại"})))return;arr.forEach(function(r){del(r.id);delete selectedMany[r.id];});ctx.persist();renderPan();return; }
      if (b && b.dataset.toolpick) { ctx.setTool(b.dataset.toolpick); return; }
      if (!row) return; var id = row.dataset.id, r = find(id); if (!r) return;
      if (b && b.dataset.a === "eye") ctx.patch(id, { hide: !r.hide }); else if (b && b.dataset.a === "lk") ctx.patch(id, { lock: !r.lock }); else if (b && b.dataset.a === "rm") del(id); else showBar(id);
      renderPan();
    });
    pan.querySelector(".nd-search").addEventListener("input", function(){ toolSearch=this.value||""; renderPan(); });
    if ($("#rl-redo")) $("#rl-redo").onclick = function () { go(1); };
    if ($("#rl-cont")) $("#rl-cont").onclick = toggleCont;
    if ($("#rl-list")) $("#rl-list").onclick = togglePan;

    /* ----- phím tắt ----- */
    document.addEventListener("keydown", function key(e) {
      if (!ctx.ok()) { document.removeEventListener("keydown", key); return; }
      var t = e.target; if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
      var k = (e.key || "").toLowerCase(), m = e.ctrlKey || e.metaKey;
      if (m && k === "z" && !e.shiftKey) { e.preventDefault(); go(-1); } else if (m && (k === "y" || (k === "z" && e.shiftKey))) { e.preventDefault(); go(1); }
      else if (m && k === "d" && sel) { e.preventDefault(); ctx.clone(sel); } else if ((k === "delete" || k === "backspace") && sel) { e.preventDefault(); del(sel); }
      else if (k === "escape") { closeMenu(true); if (S.tool) ctx.setTool(S.tool); } else if (!m && !e.altKey && k === "m") cycleMag();
    });

    return {
      stOf: stOf, styles: styles, push: push, reset: reset, gone: gone, cont: function () { return cont; }, mode: function () { return MODES[mag]; }, undo: function () { go(-1); }, cycleMag: cycleMag,
      onRight: function (o) { hit = true; var x = lastE ? lastE.clientX : innerWidth / 2, y = lastE ? lastE.clientY : innerHeight / 2; if (o && o.id && find(o.id)) { sel = o.id; fillBar(); objMenu(o.id, x, y); } },
      onSel: function (o) { if (o && o.id && find(o.id)) showBar(o.id); },
      onDesel: function () { setTimeout(function () { var a = document.activeElement; if (a && bar.contains(a)) return; sel = null; bar.hidden = true; renderPan(); }, 120); },
      onDbl: function (o) { if (o && o.name === "simpleAnnotation") editText(o.id); else if (o && find(o.id)) showBar(o.id); }
    };
  }
  window.NHIPDraw = { attach: attach, stOf: stOf, styles: styles };
})();
