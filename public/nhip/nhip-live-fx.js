/* NHIP LIVE v3.21 — nhip-live-fx.js
   1) KHUNG DỰNG SẴN (tỉ lệ 16:9 / 9:16 / 1:1 / 4:5) — mẫu lấy theo bố cục bản tin tài chính thật:
      camera góc (PiP) · camera trái/phải + bảng dữ liệu · chia đôi · camera toàn màn + bảng nhỏ. Có vùng an toàn cho TikTok/Reels.
   2) BỘ LỌC CAMERA (WebGL, 2 lượt): khử nhiễu/khối vỡ theo thời gian (có chống vệt chuyển động) → cân sáng tự động mượt
      (đo 4 lần/giây, làm mượt, không giật) → nâng vùng tối, tương phản, màu, ấm/lạnh, làm nét có che vùng tối.
   Thuần logic: layout()/list() chạy được trong Node (test). createEnhancer() chỉ chạy trong trình duyệt. */
(function (root) {
  "use strict";
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };

  /* ---------- KHUNG DỰNG SẴN ---------- */
  var TPL = [
    { id: "pip-br", nm: "Góc phải-dưới", desc: "Biểu đồ toàn màn hình, camera nhỏ góc phải-dưới (kiểu Hàn Quốc/Mỹ)" },
    { id: "pip-bl", nm: "Góc trái-dưới", desc: "Camera nhỏ góc trái-dưới, hợp biểu đồ có thang giá bên phải" },
    { id: "pip-tr", nm: "Góc phải-trên", desc: "Camera nhỏ góc phải-trên" },
    { id: "side-l", nm: "Camera trái", desc: "Camera bên trái + bảng dữ liệu bên phải + thanh tiêu đề (CNBC/TVB). Dọc: camera trên, biểu đồ dưới" },
    { id: "side-r", nm: "Camera phải", desc: "Bảng dữ liệu bên trái + camera bên phải + thanh tiêu đề (Fox Business). Dọc: biểu đồ trên, camera dưới" },
    { id: "split", nm: "Chia đôi", desc: "Dữ liệu và camera chia 50/50 không viền (bản tin thời sự)" },
    { id: "camfull", nm: "Camera lớn", desc: "Camera toàn màn hình, bảng dữ liệu nhỏ nổi lên (BM&C / bản tin)" }
  ];
  function isLand(W, H) { return W >= H; }
  function R(x, y, w, h) { return { x: x, y: y, w: w, h: h }; }
  /* Trả về { bg, cam, rad, top:"bg"|"cam", bar, frame } theo pixel của khung W×H. camOn=false → bảng dữ liệu chiếm phần camera. */
  function layout(id, W, H, camOn) {
    var L = isLand(W, H), m = .02 * Math.min(W, H), t = { id: id, bg: R(0, 0, W, H), cam: R(0, 0, W, H), rad: .06, top: "cam", bar: null, frame: false }, p, bw, bh, ca;
    camOn = camOn !== false;
    if (/^pip-/.test(id)) {
      /* ngang: camera rộng 24% · dọc: rộng 36%, tránh vùng nút/chú thích của TikTok-Reels (trên 10%, dưới 18%) */
      bw = L ? W * .24 : W * .36; bh = L ? bw * 9 / 16 : bw * 4 / 3; var mt = L ? m : H * .10, mb = L ? m : H * .18;
      var x = /r$/.test(id) ? W - bw - m : m, y = /^pip-t/.test(id) ? mt : H - bh - mb;
      t.cam = R(x, y, bw, bh); t.rad = .1; return t;
    }
    t.top = "cam"; t.frame = true;
    if (id === "side-l" || id === "side-r") {
      if (L) {
        var top = H * .04, ph = H * .74, g = W * .012, cw = W * .30, dw = W - cw - g - 2 * (W * .015);
        t.bar = R(0, H * .80, W, H * .15);
        if (id === "side-l") { t.cam = R(W * .015, top, cw, ph); t.bg = R(W * .015 + cw + g, top, dw, ph); } else { t.bg = R(W * .015, top, dw, ph); t.cam = R(W * .015 + dw + g, top, cw, ph); }
        if (!camOn) t.bg = R(W * .015, top, W * .97, ph);
      } else {
        var ch = H * .38, gh = H * .055, dh = H * .46;
        if (id === "side-l") { t.cam = R(0, 0, W, ch); t.bar = R(0, ch, W, gh); t.bg = R(0, ch + gh, W, dh); } else { t.bg = R(0, H * .05, W, dh); t.bar = R(0, H * .05 + dh, W, gh); t.cam = R(0, H * .05 + dh + gh, W, ch); }
        if (!camOn) t.bg = R(0, H * .05, W, dh + ch);
      }
      t.rad = .02; return t;
    }
    if (id === "split") {
      t.frame = false; t.rad = 0;
      if (L) { t.bg = R(0, 0, W / 2, H); t.cam = R(W / 2, 0, W / 2, H); } else { t.bg = R(0, 0, W, H / 2); t.cam = R(0, H / 2, W, H / 2); }
      if (!camOn) t.bg = R(0, 0, W, H); return t;
    }
    if (id === "camfull") {
      t.top = "bg"; t.rad = 0; t.cam = R(0, 0, W, H); t.frame = true;
      t.bg = L ? R(W * .50, H * .06, W * .46, H * .52) : R(W * .05, H * .58, W * .90, H * .26);
      if (!camOn) t.bg = R(0, 0, W, H); return t;
    }
    return t;
  }
  function list(ar) { return TPL.slice(); }

  /* Áp vị trí do người dùng tự kéo (chuẩn hoá 0..1) lên khung dựng sẵn. skip = { cam:1, bg:1 } bỏ qua phần tương ứng. */
  function applyOv(T, ov, W, H, skip) {
    if (!ov || !T) return T; skip = skip || {}; var o = {}, k; for (k in T) o[k] = T[k];
    var dn = function (a) {
      if (!a || a.length !== 4) return null; var v = a.map(Number); if (!v.every(isFinite)) return null;
      var x = Math.max(0, Math.min(.96, v[0])), y = Math.max(0, Math.min(.96, v[1])), w = Math.max(.04, Math.min(1 - x, v[2])), h = Math.max(.04, Math.min(1 - y, v[3]));
      return R(x * W, y * H, w * W, h * H);
    };
    var c = !skip.cam && dn(ov.cam), b = !skip.bg && dn(ov.bg); if (c) o.cam = c; if (b) o.bg = b; return o;
  }

  /* ---------- ẢNH MẶC ĐỊNH: THỊ TRƯỜNG CHỨNG KHOÁN VIỆT NAM ----------
     Vẽ bằng canvas (không cần tệp ảnh) nên nét ở mọi cỡ và mọi tỉ lệ (16:9, 9:16, vuông, khung camera nhỏ).
     Chỉ là hình minh hoạ thương hiệu — KHÔNG có con số giá/chỉ số nào. */
  var ARTC = {};
  function artSeries(n) {
    if (ARTC[n]) return ARTC[n]; var s = 20260 + n, rnd = function () { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }, a = [], prev = .1, i, mx = 0;
    for (i = 0; i < n; i++) {
      var cl = .12 + .78 * (i / (n - 1)) + (rnd() - .5) * .13 - (i % 6 === 4 ? .08 : 0); if (i > n - 4) cl = Math.max(cl, prev + .02);
      a.push({ o: prev, c: cl, h: Math.max(prev, cl) + rnd() * .045, l: Math.min(prev, cl) - rnd() * .045 }); prev = cl; mx = Math.max(mx, cl);
    }
    a[n - 1].c = Math.max(a[n - 1].c, mx + .03); a[n - 1].h = Math.max(a[n - 1].h, a[n - 1].c + .02);
    var mn = 9; mx = -9; a.forEach(function (q) { mn = Math.min(mn, q.l); mx = Math.max(mx, q.h); });
    a.forEach(function (q) { ["o", "c", "h", "l"].forEach(function (k) { q[k] = (q[k] - mn) / (mx - mn); }); });
    return (ARTC[n] = a);
  }
  function star(c, cx, cy, r) { c.beginPath(); for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .4 : r; c[i ? "lineTo" : "moveTo"](cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } c.closePath(); }
  function art(c, x, y, w, h, now, o) {
    o = o || {}; if (!(w > 4 && h > 4)) return;
    var t = (now || 0) / 1000, m = Math.min(w, h), port = h > w * 1.15, tiny = m < 150 || w < 190, i, g;
    var u = port ? Math.min(w / 9, h / 16) : Math.min(w / 16, h / 9);
    c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); c.translate(x, y);
    g = c.createLinearGradient(0, 0, w * .35, h); g.addColorStop(0, "#030c20"); g.addColorStop(.5, "#0a2b61"); g.addColorStop(1, "#063a4d"); c.fillStyle = g; c.fillRect(0, 0, w, h);
    g = c.createRadialGradient(w * .82, h * .22, 0, w * .82, h * .22, Math.max(w, h) * .6); g.addColorStop(0, "rgba(255,196,60,.30)"); g.addColorStop(.5, "rgba(255,160,40,.08)"); g.addColorStop(1, "rgba(255,160,40,0)"); c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.strokeStyle = "rgba(160,200,255,.07)"; c.lineWidth = 1; var gs = Math.max(18, u * .9), gx; for (gx = gs; gx < w; gx += gs) { c.beginPath(); c.moveTo(gx, 0); c.lineTo(gx, h); c.stroke(); } for (gx = gs; gx < h; gx += gs) { c.beginPath(); c.moveTo(0, gx); c.lineTo(w, gx); c.stroke(); }
    /* vùng biểu đồ */
    var cx0, cy0, cw, ch;
    if (tiny) { cx0 = w * .08; cy0 = h * .16; cw = w * .84; ch = h * .56; }
    else if (port) { cx0 = w * .07; cy0 = h * .42; cw = w * .86; ch = h * .30; }
    else { cx0 = w * .44; cy0 = h * .17; cw = w * .51; ch = h * .52; }
    var n = tiny ? 11 : port ? 17 : 26, S = artSeries(n), bw = cw / n, k;
    var base = cy0 + ch, X = function (j) { return cx0 + (j + .5) * bw; }, Y = function (v) { return base - v * ch; };
    var pulse = .5 + .5 * Math.sin(t * 2.2);
    for (i = 0; i < n; i++) {
      var q = S[i], up = q.c >= q.o, col = up ? "#19d38a" : "#f0444f", hh = q.h, cc = q.c;
      if (i === n - 1) { cc = q.c + pulse * .035; hh = Math.max(q.h, cc); }
      c.strokeStyle = col; c.fillStyle = col; c.lineWidth = Math.max(1, bw * .12); c.beginPath(); c.moveTo(X(i), Y(hh)); c.lineTo(X(i), Y(q.l)); c.stroke();
      var top = Y(Math.max(q.o, cc)), bt = Y(Math.min(q.o, cc)); c.fillRect(X(i) - bw * .32, top, bw * .64, Math.max(2, bt - top));
    }
    /* đường xu hướng vàng + hào quang */
    c.save(); c.lineJoin = "round"; c.lineCap = "round"; c.shadowColor = "rgba(255,200,60,.9)"; c.shadowBlur = Math.max(6, u * .35); c.strokeStyle = "#ffcf3d"; c.lineWidth = Math.max(2, u * .075); c.beginPath();
    for (i = 0; i < n; i++) { var mv = (S[Math.max(0, i - 1)].c + S[i].c + S[Math.min(n - 1, i + 1)].c) / 3; c[i ? "lineTo" : "moveTo"](X(i), Y(mv) - ch * .05); } c.stroke(); c.restore();
    var ex = X(n - 1), ey = Y((S[n - 2].c + S[n - 1].c) / 2) - ch * .05;
    c.fillStyle = "rgba(255,207,61," + (.25 + .35 * pulse) + ")"; c.beginPath(); c.arc(ex, ey, u * (.22 + .12 * pulse), 0, 7); c.fill(); c.fillStyle = "#fff6cf"; c.beginPath(); c.arc(ex, ey, Math.max(2, u * .09), 0, 7); c.fill();
    /* mũi tên lên */
    if (!tiny) { var ax = ex - u * .1, ay = ey - u * .55 - pulse * u * .12, as = u * .34; c.save(); c.fillStyle = "#19d38a"; c.shadowColor = "rgba(25,211,138,.8)"; c.shadowBlur = u * .3; c.beginPath(); c.moveTo(ax, ay - as); c.lineTo(ax + as * .8, ay + as * .25); c.lineTo(ax + as * .28, ay + as * .25); c.lineTo(ax + as * .28, ay + as * .9); c.lineTo(ax - as * .28, ay + as * .9); c.lineTo(ax - as * .28, ay + as * .25); c.lineTo(ax - as * .8, ay + as * .25); c.closePath(); c.fill(); c.restore(); }
    /* dải sáng quét ngang */
    var sx = ((t * .18) % 1.6 - .3) * w; g = c.createLinearGradient(sx - w * .12, 0, sx + w * .12, 0); g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(.5, "rgba(255,255,255,.07)"); g.addColorStop(1, "rgba(255,255,255,0)"); c.fillStyle = g; c.fillRect(0, 0, w, h);
    /* đường chân trời thành phố */
    var sk = h * (tiny ? .22 : port ? .2 : .26), sb = h, bx = 0, rs = 77; c.fillStyle = "rgba(2,9,24,.88)";
    while (bx < w) { rs = (rs * 9301 + 49297) % 233280; var bwid = w * (.025 + (rs / 233280) * .035), bh = sk * (.25 + ((rs * 7 % 233280) / 233280) * .75); c.fillRect(bx, sb - bh, bwid, bh); if (!tiny && bh > sk * .85) { c.fillRect(bx + bwid / 2 - 1, sb - bh - sk * .22, 2, sk * .22); } bx += bwid + w * .004; }
    c.fillStyle = "rgba(255,214,120,.55)"; if (!tiny) { rs = 31; for (i = 0; i < 60; i++) { rs = (rs * 9301 + 49297) % 233280; var wx = (rs / 233280) * w; rs = (rs * 9301 + 49297) % 233280; var wy = sb - (rs / 233280) * sk * .8; c.fillRect(wx, wy, Math.max(1.5, u * .03), Math.max(1.5, u * .04)); } }
    /* chữ */
    var FF = "system-ui,'Segoe UI',Roboto,Arial,sans-serif";
    if (tiny) {
      c.fillStyle = "#fff"; c.textAlign = "left"; c.textBaseline = "top"; var f1 = Math.max(9, Math.min(w * .13, h * .13)); c.font = "800 " + f1 + "px " + FF; c.fillText("VN-INDEX", w * .07, h * .045, w * .86);
    } else {
      var lx = port ? w / 2 : w * .06, al = port ? "center" : "left", ty = port ? h * .075 : h * .15, mw = port ? w * .9 : w * .38;
      c.textAlign = al; c.textBaseline = "alphabetic";
      c.fillStyle = "#ffcf3d"; c.beginPath(); c.arc(lx + (port ? -mw * .5 : 0) + u * .26, ty - u * .16, u * .26, 0, 7); c.fillStyle = "#da251d"; c.fill(); c.fillStyle = "#ffcd00"; star(c, lx + (port ? -mw * .5 : 0) + u * .26, ty - u * .15, u * .17); c.fill();
      c.fillStyle = "#ffcf3d"; c.font = "800 " + u * .3 + "px " + FF; c.textAlign = "left"; var kx = lx + (port ? -mw * .5 : 0) + u * .66; if (port) { c.textAlign = "center"; kx = lx + u * .2; }
      if (c.letterSpacing !== undefined) c.letterSpacing = (u * .05) + "px"; c.fillText("THỊ TRƯỜNG CHỨNG KHOÁN", kx, ty, mw - u * .7); if (c.letterSpacing !== undefined) c.letterSpacing = "0px";
      c.textAlign = al; var tf = c.createLinearGradient(0, ty, 0, ty + u * 1.5); tf.addColorStop(0, "#ffffff"); tf.addColorStop(1, "#ffd35c"); c.fillStyle = tf; c.shadowColor = "rgba(0,0,0,.5)"; c.shadowBlur = u * .2; c.font = "900 " + u * (port ? 1.55 : 1.4) + "px " + FF; c.fillText("VIỆT NAM", lx, ty + u * (port ? 1.65 : 1.5), mw);
      c.shadowBlur = 0; c.fillStyle = "#cfe3ff"; c.font = "700 " + u * .3 + "px " + FF; c.fillText("VN-INDEX  ·  VN30  ·  HNX  ·  UPCOM", lx, ty + u * (port ? 2.35 : 2.2), mw);
      /* dải chữ chạy dưới cùng */
      var rh = Math.max(u * .55, 18), ry = h - rh; c.fillStyle = "rgba(4,14,36,.92)"; c.fillRect(0, ry, w, rh); c.fillStyle = "#ffcf3d"; c.fillRect(0, ry, w, Math.max(2, u * .04));
      var txt = "NHỊP  ·  PHÂN TÍCH & NHẬN ĐỊNH THỊ TRƯỜNG TRỰC TIẾP  ·  HOSE  ·  HNX  ·  UPCOM  ·  CỔ PHIẾU  ·  TRÁI PHIẾU  ·  PHÁI SINH  ·  ";
      c.font = "800 " + rh * .5 + "px " + FF; c.textAlign = "left"; c.textBaseline = "middle"; c.fillStyle = "#fff"; var tw = c.measureText(txt).width || 1, off = -((t * u * .9) % tw); c.save(); c.beginPath(); c.rect(0, ry, w, rh); c.clip(); for (var rx = off; rx < w; rx += tw) c.fillText(txt, rx, ry + rh * .55); c.restore();
    }
    if (o.dim) { c.fillStyle = "rgba(3,10,24," + o.dim + ")"; c.fillRect(0, 0, w, h); }
    c.restore();
  }

  function rrect(c, x, y, w, h, r) { r = Math.max(0, Math.min(r, w / 2, h / 2)); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  /* phase "pre": nền khung (gradient + sọc chéo mờ) · phase "post": viền các ô + thanh tiêu đề đè lên trên cùng */
  function paint(c, W, H, T, o, phase) {
    o = o || {}; var ac = o.accent || "#12b98b";
    if (phase === "pre") {
      if (/^pip-/.test(T.id) || T.id === "split") return;
      var g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, "#0a1b3a"); g.addColorStop(1, "#0f3a6b"); c.fillStyle = g; c.fillRect(0, 0, W, H);
      c.save(); c.globalAlpha = .07; c.fillStyle = "#fff"; for (var i = -H; i < W; i += Math.max(24, W / 24)) { c.beginPath(); c.moveTo(i, H); c.lineTo(i + H * .6, 0); c.lineTo(i + H * .6 + W / 60, 0); c.lineTo(i + W / 60, H); c.closePath(); c.fill(); } c.restore();
      return;
    }
    var lw = Math.max(2, Math.round(Math.min(W, H) * .004));
    if (T.frame && T.id !== "camfull") { c.save(); c.lineWidth = lw; c.strokeStyle = "rgba(255,255,255,.92)"; c.strokeRect(T.bg.x, T.bg.y, T.bg.w, T.bg.h); c.strokeRect(T.cam.x, T.cam.y, T.cam.w, T.cam.h); c.restore(); }
    if (T.id === "camfull") { c.save(); c.lineWidth = lw * 1.5; c.strokeStyle = "#fff"; rrect(c, T.bg.x, T.bg.y, T.bg.w, T.bg.h, Math.min(T.bg.w, T.bg.h) * .03); c.stroke(); c.restore(); }
    if (T.bar) {
      var b = T.bar, fs = b.h * .5, hasSub = !!o.sub; c.save();
      var g2 = c.createLinearGradient(b.x, b.y, b.x + b.w, b.y); g2.addColorStop(0, "#0b2a66"); g2.addColorStop(1, "#1747a6"); c.fillStyle = g2; c.fillRect(b.x, b.y, b.w, b.h);
      c.fillStyle = ac; c.fillRect(b.x, b.y, b.h * .16, b.h);
      c.fillStyle = "#fff"; c.textBaseline = "middle"; c.textAlign = "left"; var tx = b.x + b.h * .5, tw = b.w - b.h * 1.0;
      c.font = "800 " + (hasSub ? fs * .8 : fs) + "px system-ui,sans-serif"; c.fillText(o.title || (o.live ? "TRỰC TIẾP THỊ TRƯỜNG" : "NHỊP · THỊ TRƯỜNG"), tx, b.y + b.h * (hasSub ? .36 : .5), tw);
      if (hasSub) { c.fillStyle = "#c9dcff"; c.font = "500 " + fs * .55 + "px system-ui,sans-serif"; c.fillText(o.sub, tx, b.y + b.h * .74, tw); }
      c.restore();
    }
  }
  /* hình thu nhỏ để chọn khung (vẽ bằng đúng hàm layout) */
  function thumb(c, w, h, id, accent) {
    c.fillStyle = "#0b1220"; c.fillRect(0, 0, w, h); var ac = accent || "#12b98b";
    if (id === "free") { c.fillStyle = "#24406a"; c.fillRect(2, 2, w - 4, h - 4); c.fillStyle = ac; c.fillRect(w * .62, h * .6, w * .3, h * .3); return; }
    var T = layout(id, w, h, true); c.fillStyle = "#24406a"; c.fillRect(T.bg.x, T.bg.y, T.bg.w, T.bg.h);
    c.fillStyle = "#6f8db5"; var i; for (i = 1; i < 4; i++) c.fillRect(T.bg.x + T.bg.w * .1, T.bg.y + T.bg.h * i * .22, T.bg.w * .8 * (1 - i * .15), Math.max(1, h * .03));
    if (T.bar) { c.fillStyle = "#1747a6"; c.fillRect(T.bar.x, T.bar.y, T.bar.w, T.bar.h); }
    c.fillStyle = ac; c.fillRect(T.cam.x, T.cam.y, T.cam.w, T.cam.h);
    if (T.top === "cam") { c.fillStyle = "#24406a"; } c.fillStyle = "rgba(255,255,255,.85)"; c.beginPath(); c.arc(T.cam.x + T.cam.w / 2, T.cam.y + T.cam.h * .4, Math.min(T.cam.w, T.cam.h) * .16, 0, 7); c.fill();
    if (T.id === "camfull") { c.fillStyle = "#24406a"; c.fillRect(T.bg.x, T.bg.y, T.bg.w, T.bg.h); }
  }

  /* ---------- BỘ LỌC CAMERA ---------- */
  var PRESETS = {
    auto: { nm: "Tự động", v: { auto: true, ev: 0, shadow: .35, con: .15, sat: .12, warm: 0, den: .55, sharp: .35 } },
    natural: { nm: "Tự nhiên", v: { auto: false, ev: 0, shadow: .15, con: .08, sat: .05, warm: 0, den: .3, sharp: .2 } },
    lowlight: { nm: "Thiếu sáng", v: { auto: true, ev: .25, shadow: .6, con: .2, sat: .15, warm: .1, den: .8, sharp: .3 } },
    studio: { nm: "Studio nét", v: { auto: true, ev: 0, shadow: .3, con: .25, sat: .2, warm: .05, den: .45, sharp: .5 } },
    soft: { nm: "Da mịn", v: { auto: true, ev: .1, shadow: .35, con: .05, sat: .08, warm: .15, den: .9, sharp: .1 } }
  };
  function defaultFx() { return Object.assign({ on: true, preset: "auto" }, PRESETS.auto.v); }

  var VS = "attribute vec2 p;varying vec2 uv;varying vec2 fv;void main(){uv=vec2((p.x+1.)*.5,(1.-p.y)*.5);fv=vec2(uv.x,1.-uv.y);gl_Position=vec4(p,0.,1.);}";
  var FS1 = "precision mediump float;varying vec2 uv;varying vec2 fv;uniform sampler2D uCur;uniform sampler2D uHist;uniform vec2 tx;uniform float uStr;uniform float uFirst;" +
    "float lm(vec3 c){return dot(c,vec3(.299,.587,.114));}" +
    "void main(){vec3 c=texture2D(uCur,uv).rgb;float lc=lm(c);vec3 s=c;float ws=1.;" +
    "vec2 o[4];o[0]=vec2(tx.x,0.);o[1]=vec2(-tx.x,0.);o[2]=vec2(0.,tx.y);o[3]=vec2(0.,-tx.y);" +
    "for(int i=0;i<4;i++){vec3 n=texture2D(uCur,uv+o[i]).rgb;float w=(1.-smoothstep(.02,.1,abs(lm(n)-lc)))*uStr;s+=n*w;ws+=w;}" +
    "s/=ws;vec3 h=texture2D(uHist,fv).rgb;float d=abs(lm(s)-lm(h));float a=uStr*.72*(1.-smoothstep(.03,.15,d))*(1.-uFirst);gl_FragColor=vec4(mix(s,h,a),1.);}";
  var FS2 = "precision mediump float;varying vec2 uv;varying vec2 fv;uniform sampler2D uTex;uniform vec2 tx;uniform float uGain,uShadow,uCon,uSat,uWarm,uSharp;" +
    "float lm(vec3 c){return dot(c,vec3(.299,.587,.114));}" +
    "void main(){vec3 c=texture2D(uTex,fv).rgb;" +
    "vec3 b=(texture2D(uTex,fv+vec2(tx.x,0.)).rgb+texture2D(uTex,fv-vec2(tx.x,0.)).rgb+texture2D(uTex,fv+vec2(0.,tx.y)).rgb+texture2D(uTex,fv-vec2(0.,tx.y)).rgb)*.25;" +
    "float l0=lm(c);c+=(c-b)*uSharp*1.4*smoothstep(.06,.28,l0);" +
    "c*=uGain;float l=lm(c);vec3 g=pow(max(c,vec3(0.)),vec3(1./(1.+uShadow*1.1)));c=mix(g,c,smoothstep(.45,.95,l));" +
    "c=mix(c,c*c*(3.-2.*c),uCon);l=lm(c);c=mix(vec3(l),c,1.+uSat);c.r*=1.+uWarm*.08;c.b*=1.-uWarm*.08;" +
    "vec3 hi=max(c-.82,vec3(0.));c=min(c,vec3(.82))+hi/(1.+hi*5.);gl_FragColor=vec4(clamp(c,0.,1.),1.);}";

  function createEnhancer() {
    var D = root.document, cv = D.createElement("canvas"), gl = null, ok = false, P1, P2, buf, tex = {}, fbo = [], ft = [], cur = 0, W = 0, H = 0, first = 1, lastT = -1, lastOut = null, gain = 1, lastMeas = 0, meas = D.createElement("canvas"), mx = null, dead = false;
    meas.width = 32; meas.height = 18;
    function sh(t, s) { var o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; }
    function prog(f) { var p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, f)); gl.bindAttribLocation(p, 0, "p"); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); return p; }
    function mkTex() { var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; }
    try {
      gl = cv.getContext("webgl", { preserveDrawingBuffer: true, antialias: false, alpha: false, premultipliedAlpha: false });
      if (gl) {
        P1 = prog(FS1); P2 = prog(FS2); buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        tex.v = mkTex(); ft = [mkTex(), mkTex()]; fbo = [gl.createFramebuffer(), gl.createFramebuffer()]; ok = true;
        cv.addEventListener("webglcontextlost", function (e) { e.preventDefault(); dead = true; });
      }
    } catch (e) { ok = false; }
    function resize(w, h) {
      W = w; H = h; cv.width = w; cv.height = h; gl.viewport(0, 0, w, h);
      for (var i = 0; i < 2; i++) { gl.bindTexture(gl.TEXTURE_2D, ft[i]); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[i]); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, ft[i], 0); }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); first = 1;
    }
    /* đo độ sáng trung bình (ưu tiên giữa khung) 4 lần/giây rồi làm mượt: gain đổi chậm → không nhấp nháy/giật */
    function measure(v, now) {
      if (now - lastMeas < 250) return; lastMeas = now;
      try {
        mx = mx || meas.getContext("2d", { willReadFrequently: true }); mx.drawImage(v, 0, 0, 32, 18); var d = mx.getImageData(0, 0, 32, 18).data, s = 0, ws = 0, i, x, y;
        for (i = 0, y = 0; y < 18; y++) for (x = 0; x < 32; x++, i += 4) { var w = 1 + 1.5 * (1 - Math.min(1, Math.abs(x - 15.5) / 16)) * (1 - Math.min(1, Math.abs(y - 8.5) / 9)); s += (d[i] * .299 + d[i + 1] * .587 + d[i + 2] * .114) / 255 * w; ws += w; }
        var m = Math.max(.02, s / ws), target = clamp(.46 / m, 1, 2.4); gain += (target - gain) * .12;
      } catch (e) { }
    }
    function run(v, fx) {
      var vw = v.videoWidth, vh = v.videoHeight; if (!(vw > 0 && vh > 0) || dead) return null;
      var now = root.performance ? root.performance.now() : Date.now();
      if (!ok) { return null; }
      if (v.currentTime === lastT && lastOut) return lastOut; /* khung camera chưa đổi: dùng lại kết quả, tiết kiệm GPU */
      lastT = v.currentTime; var sc = Math.min(1, 1280 / vw), w = Math.max(2, Math.round(vw * sc)), h = Math.max(2, Math.round(vh * sc)); if (w !== W || h !== H) resize(w, h);
      if (fx.auto) measure(v, now); else gain += (1 - gain) * .1;
      var g = Math.pow(2, +fx.ev || 0) * (fx.auto ? gain : 1), den = clamp((+fx.den || 0) + (g - 1) * .2, 0, 1);
      gl.bindTexture(gl.TEXTURE_2D, tex.v); try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, v); } catch (e) { return null; }
      var nx = 1 - cur;
      /* lượt 1: khử nhiễu → ghi vào ft[nx] (đồng thời là "lịch sử" của khung sau) */
      gl.useProgram(P1); gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[nx]); gl.viewport(0, 0, W, H);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex.v); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, ft[cur]);
      gl.uniform1i(gl.getUniformLocation(P1, "uCur"), 0); gl.uniform1i(gl.getUniformLocation(P1, "uHist"), 1); gl.uniform2f(gl.getUniformLocation(P1, "tx"), 1 / W, 1 / H); gl.uniform1f(gl.getUniformLocation(P1, "uStr"), den); gl.uniform1f(gl.getUniformLocation(P1, "uFirst"), first);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); first = 0;
      /* lượt 2: chỉnh màu/sáng/nét → canvas */
      gl.useProgram(P2); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, ft[nx]);
      gl.uniform1i(gl.getUniformLocation(P2, "uTex"), 0); gl.uniform2f(gl.getUniformLocation(P2, "tx"), 1 / W, 1 / H);
      gl.uniform1f(gl.getUniformLocation(P2, "uGain"), g); gl.uniform1f(gl.getUniformLocation(P2, "uShadow"), clamp(+fx.shadow || 0, 0, 1)); gl.uniform1f(gl.getUniformLocation(P2, "uCon"), clamp(+fx.con || 0, 0, 1));
      gl.uniform1f(gl.getUniformLocation(P2, "uSat"), clamp(+fx.sat || 0, -.5, 1)); gl.uniform1f(gl.getUniformLocation(P2, "uWarm"), clamp(+fx.warm || 0, -1, 1)); gl.uniform1f(gl.getUniformLocation(P2, "uSharp"), clamp(+fx.sharp || 0, 0, 1));
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); cur = nx; lastOut = { el: cv, w: W, h: H }; return lastOut;
    }
    return { run: run, ok: function () { return ok && !dead; }, gain: function () { return gain; } };
  }

  var api = { TPL: TPL, layout: layout, list: list, applyOv: applyOv, art: art, paint: paint, thumb: thumb, PRESETS: PRESETS, defaultFx: defaultFx, createEnhancer: createEnhancer, VS: VS, FS1: FS1, FS2: FS2 };
  if (typeof window === "undefined") { if (typeof module !== "undefined" && module.exports) module.exports = api; return; }
  root.NHIPLiveFX = api;
})(typeof window !== "undefined" ? window : globalThis);
