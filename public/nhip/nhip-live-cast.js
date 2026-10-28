/* NHIP LIVE CAST v1 (bản 2.99h) — "📡 Phát live": ghép điện thoại + cửa sổ máy tính thành một khung hình để phát lên mạng xã hội.
   Nguyên lý rút từ OBS / StreamYard / Streamlabs / Larix / Camo:
   1) Ghép cảnh trên canvas: lớp NỀN = các cửa sổ của Live (Khung hình, Biểu đồ, Tin tức, AI, Mã & rổ) · lớp TRÊN = camera điện thoại (kéo/đổi cỡ/đổi hình dạng tự do) · lớp CHỮ = tiêu đề, huy hiệu LIVE.
   2) Camera điện thoại đi qua WebRTC (ngang hàng, không qua máy chủ); máy chủ chỉ làm "hộp thư" 5 phút để hai máy trao đổi mã (/proxy/live-sig). Có đường dự phòng ghép thủ công.
   3) Nền máy tính lấy bằng Element Capture (Chrome/Edge): chỉ đúng cửa sổ được chọn, không dính cửa sổ khác dù bị che; trình duyệt cũ hơn tự lùi về cắt theo vùng.
   4) Luôn XEM TRƯỚC + danh sách kiểm tra; nút BẮT ĐẦU chỉ sáng khi mọi mục bắt buộc đạt.
   5) Đầu ra: Cửa sổ phát sạch (chia sẻ vào trang live / OBS Window Capture) · WHIP (đẩy WebRTC) · quay file .webm. Không lưu khóa phát (stream key) ở đâu cả. */
(function (root) {
  "use strict";
  /*PURE*/
  var AB = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  function genCode(rnd) { var s = "", i; for (i = 0; i < 6; i++) s += AB.charAt(Math.floor(rnd() * 32) % 32); return s; }
  function normCode(s) { return String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6); }
  function okCode(s) { return /^[A-HJ-NP-Z2-9]{6}$/.test(String(s || "")); }
  var RAT = { "16:9": [16, 9], "9:16": [9, 16], "1:1": [1, 1], "4:5": [4, 5] };
  function ev(n) { return Math.max(2, Math.round(n / 2) * 2); }
  function outSize(ar, q) { var r = RAT[ar] || RAT["16:9"], a = r[0] / r[1]; q = +q || 720; return a >= 1 ? [ev(q * a), ev(q)] : [ev(q), ev(q / a)]; }
  var PLAT = {
    facebook: { nm: "Facebook Live", ic: "📘", ar: "16:9", q: 1080, kbps: 6000, how: ["Mở trang Phát trực tiếp của Facebook (Live Producer) → chọn phát bằng Webcam / Chia sẻ màn hình → chọn cửa sổ “NHỊP – Phát”.", "Muốn chất lượng ổn định hơn: dùng OBS, thêm nguồn Window Capture = cửa sổ “NHỊP – Phát”, dán Stream key do Facebook cấp."] },
    youtube: { nm: "YouTube Live", ic: "▶️", ar: "16:9", q: 1080, kbps: 6000, how: ["YouTube Studio → Tạo → Phát trực tiếp. Chế độ Webcam của YouTube chỉ nhận camera, không nhận chia sẻ màn hình.", "Cách chuẩn: OBS → nguồn Window Capture = cửa sổ “NHỊP – Phát” → dán Stream key của YouTube.", "Hoặc dùng WHIP nếu bạn có máy chủ trung gian nhận WebRTC rồi chuyển tiếp RTMP."] },
    tiktok: { nm: "TikTok LIVE", ic: "🎵", ar: "9:16", q: 1080, kbps: 4000, how: ["Dùng TikTok LIVE Studio (máy tính) hoặc OBS: thêm nguồn Window Capture = cửa sổ “NHỊP – Phát”.", "Phát dọc 9:16 hoặc ngang 16:9 tuỳ ứng dụng/tài khoản của bạn; tài khoản cần đủ điều kiện LIVE của TikTok."] },
    twitch: { nm: "Twitch", ic: "🟣", ar: "16:9", q: 1080, kbps: 6000, how: ["OBS → nguồn Window Capture = cửa sổ “NHỊP – Phát” → dán Stream key Twitch.", "Twitch có hỗ trợ WHIP ở một số tài khoản: dùng chế độ WHIP trong bước 5."] },
    custom: { nm: "Tuỳ chỉnh", ic: "⚙️", ar: "16:9", q: 720, kbps: 4000, how: ["Chọn tỉ lệ và độ phân giải theo ứng dụng bạn dùng, rồi chia sẻ cửa sổ “NHỊP – Phát” vào ứng dụng đó."] }
  };
  function fitRect(sw, sh, dx, dy, dw, dh, mode) {
    if (!(sw > 0 && sh > 0 && dw > 0 && dh > 0)) return null;
    var s = mode === "cover" ? Math.max(dw / sw, dh / sh) : Math.min(dw / sw, dh / sh);
    if (mode === "cover") { var cw = dw / s, ch = dh / s; return { sx: (sw - cw) / 2, sy: (sh - ch) / 2, sw: cw, sh: ch, dx: dx, dy: dy, dw: dw, dh: dh }; }
    var w = sw * s, h = sh * s; return { sx: 0, sy: 0, sw: sw, sh: sh, dx: dx + (dw - w) / 2, dy: dy + (dh - h) / 2, dw: w, dh: h };
  }
  function tiles(n, mode, W, H, g) {
    g = g == null ? 8 : g; var o = [], i; if (n <= 0) return o;
    if (mode === "single" || n === 1) { for (i = 0; i < n; i++) o.push({ x: 0, y: 0, w: W, h: H }); return o; }
    var cols, rows; if (mode === "split" && n === 2) { cols = W >= H ? 2 : 1; rows = W >= H ? 1 : 2; } else { cols = Math.ceil(Math.sqrt(n)); rows = Math.ceil(n / cols); }
    var cw = (W - g * (cols - 1)) / cols, ch = (H - g * (rows - 1)) / rows;
    for (i = 0; i < n; i++) { var c = i % cols, r = Math.floor(i / cols); o.push({ x: c * (cw + g), y: r * (ch + g), w: cw, h: ch }); } return o;
  }
  function camAr(shape, vAr) { return shape === "circle" || shape === "square" ? 1 : shape === "16:9" ? 16 / 9 : shape === "9:16" ? 9 / 16 : shape === "4:3" ? 4 / 3 : (vAr > 0 ? vAr : 16 / 9); }
  function camRect(cam, W, H, vAr) {
    var ar = camAr(cam.shape, vAr), w = Math.max(.06, Math.min(1, cam.w)) * W, h = w / ar;
    if (cam.shape === "free") h = Math.max(.06, Math.min(1, cam.h > 0 ? cam.h : w * 9 / 16 / H)) * H;
    else { if (h > H * .96) { h = H * .96; w = h * ar; } if (w > W) { w = W; h = w / ar; } }
    var x = cam.cx * W - w / 2, y = cam.cy * H - h / 2; x = Math.max(0, Math.min(W - w, x)); y = Math.max(0, Math.min(H - h, y)); return { x: x, y: y, w: w, h: h };
  }
  /* Kéo hộp (camera / bảng dữ liệu) trên khung xem trước — hàm thuần để kiểm thử */
  function moveRect(r, dx, dy, W, H) { return { x: Math.max(0, Math.min(W - r.w, r.x + dx)), y: Math.max(0, Math.min(H - r.h, r.y + dy)), w: r.w, h: r.h }; }
  function resizeRect(r, hd, dx, dy, W, H, o) {
    o = o || {}; var mn = o.min || 24, x1 = r.x, y1 = r.y, x2 = r.x + r.w, y2 = r.y + r.h, E = hd.indexOf("e") >= 0, Wt = hd.indexOf("w") >= 0, N = hd.indexOf("n") >= 0, Sd = hd.indexOf("s") >= 0;
    if (E) x2 = Math.max(x1 + mn, Math.min(W, x2 + dx)); if (Wt) x1 = Math.min(x2 - mn, Math.max(0, x1 + dx));
    if (Sd) y2 = Math.max(y1 + mn, Math.min(H, y2 + dy)); if (N) y1 = Math.min(y2 - mn, Math.max(0, y1 + dy));
    if (o.ar > 0 && hd.length === 2) {
      var ax = Wt ? r.x + r.w : r.x, ay = N ? r.y + r.h : r.y, mxw = Math.min(Wt ? ax : W - ax, (N ? ay : H - ay) * o.ar), nw = Math.max(Math.min(mn, mxw), Math.min(mxw, x2 - x1)), nh = nw / o.ar;
      x1 = Wt ? ax - nw : ax; x2 = Wt ? ax : ax + nw; y1 = N ? ay - nh : ay; y2 = N ? ay : ay + nh;
    }
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  }
  function camPreset(name, cam, W, H, vAr) {
    var r = camRect(cam, W, H, vAr), m = .03 * Math.min(W, H), x = name.charAt(1) === "l" ? m : name.charAt(1) === "r" ? W - r.w - m : (W - r.w) / 2, y = name.charAt(0) === "t" ? m : name.charAt(0) === "b" ? H - r.h - m : (H - r.h) / 2;
    return { cx: (x + r.w / 2) / W, cy: (y + r.h / 2) / H };
  }
  function validWhip(u) { try { var x = new URL(u); return x.protocol === "https:" || (x.protocol === "http:" && /^(localhost|127\.0\.0\.1)$/.test(x.hostname)); } catch (e) { return false; } }
  /* Danh sách kiểm tra trước khi phát. lv: req (bắt buộc, chặn nút Bắt đầu) · warn (nên xem lại) · ok · info */
  function checks(s) {
    var L = [], add = function (id, lv, t) { L.push({ id: id, lv: lv, t: t }); };
    if (!s.capOk) add("cap", "req", "Chưa cho phép ghi hình trang NHỊP (bước 2)."); else add("cap", "ok", "Đã cho phép ghi hình trang NHỊP.");
    if (!s.selCount) add("bg", "req", "Chưa chọn cửa sổ nền nào (bước 2).");
    else if (!s.openCount) add("bg", "req", "Các cửa sổ đã chọn đều đang đóng — hãy mở ít nhất một cửa sổ.");
    else if (s.openCount < s.selCount) add("bg", "warn", "Có cửa sổ đã chọn đang đóng: " + (s.selCount - s.openCount) + " cửa sổ sẽ hiện khung chờ.");
    else add("bg", "ok", "Nền: " + s.selCount + " cửa sổ đang mở.");
    if (s.camOn && s.camFeed !== false) { if (!s.linkOk) add("cam", "req", s.camSrc === "pc" ? "Camera máy tính chưa bật (bước 3) — hoặc tắt camera." : "Điện thoại chưa kết nối (bước 1) — hoặc tắt camera ở bước 3."); else if (!s.camFlow) add("cam", "req", "Đã kết nối nhưng chưa nhận được hình từ điện thoại."); else add("cam", "ok", s.camSrc === "pc" ? "Camera máy tính đang chạy." : "Camera điện thoại đang gửi hình."); }
    else add("cam", "info", s.camOn ? "Camera đang tắt — khung hiện ảnh thay thế." : "Camera điện thoại đang tắt — chỉ phát nền máy tính.");
    if (!s.previewOn) add("pv", "req", "Hãy bật Xem trước và kiểm tra khung hình."); else if (s.fps < 5) add("pv", "warn", "Khung hình rất chậm — hãy hạ độ phân giải hoặc khung/giây ở bước 5."); else add("pv", "ok", "Xem trước đang chạy.");
    if (s.outMode === "whip" && !validWhip(s.whipUrl)) add("out", "req", "Địa chỉ WHIP chưa hợp lệ (cần https://…).");
    else if (s.outMode === "none" && !s.rec) add("out", "req", "Chọn Cửa sổ phát, WHIP hoặc bật quay file.");
    else add("out", "ok", s.outMode === "window" ? "Đầu ra: cửa sổ phát sạch." : s.outMode === "whip" ? "Đầu ra: WHIP." : "Đầu ra: chỉ quay file.");
    if (!s.audioAny) add("au", "warn", "Chưa bật âm thanh nào — người xem sẽ không nghe gì."); else add("au", "ok", "Âm thanh đã bật.");
    if (s.capMode && s.capMode !== "element") add("cm", "warn", "Trình duyệt chưa hỗ trợ Element Capture: giữ bảng cài đặt không che cửa sổ nền (dùng Chrome/Edge mới để tốt nhất).");
    if (s.bat != null && s.bat < .2) add("bat", "warn", "Pin điện thoại dưới 20% — cắm sạc.");
    if (s.outMode === "window" && s.live && s.owClosed) add("ow", "warn", "Cửa sổ phát đã bị đóng — bấm Mở cửa sổ phát.");
    var blockers = L.filter(function (x) { return x.lv === "req"; }).length;
    return { items: L, blockers: blockers, canStart: blockers === 0 };
  }
  /* ---------- Mã QR (byte mode, mức sửa lỗi M, phiên bản 1–10) ---------- */
  function qrMatrix(text) {
    var b = unescape(encodeURIComponent(String(text))), data = [], i, j, k;
    for (i = 0; i < b.length; i++) data.push(b.charCodeAt(i));
    var ECC = [10, 16, 26, 18, 24, 16, 18, 22, 22, 26], NB = [1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
    var rawMods = function (v) { var r = (16 * v + 128) * v + 64; if (v >= 2) { var na = Math.floor(v / 7) + 2; r -= (25 * na - 10) * na - 55; if (v >= 7) r -= 36; } return r; };
    var ver, raw, nd;
    for (ver = 1; ver <= 10; ver++) { raw = rawMods(ver); nd = (raw >> 3) - ECC[ver - 1] * NB[ver - 1]; if (4 + (ver < 10 ? 8 : 16) + data.length * 8 <= nd * 8) break; }
    if (ver > 10) return null;
    var bits = [], put = function (v, n) { for (var q = n - 1; q >= 0; q--) bits.push((v >>> q) & 1); };
    put(4, 4); put(data.length, ver < 10 ? 8 : 16); data.forEach(function (d) { put(d, 8); });
    put(0, Math.min(4, nd * 8 - bits.length)); while (bits.length % 8) bits.push(0);
    for (var pad = 0xEC; bits.length < nd * 8; pad ^= 0xEC ^ 0x11) put(pad, 8);
    var cw = []; for (i = 0; i < bits.length; i++) cw[i >> 3] = (cw[i >> 3] || 0) | (bits[i] << (7 - (i & 7)));
    var gmul = function (x, y) { var z = 0; for (var q = 7; q >= 0; q--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> q) & 1) * x; } return z; };
    var eccLen = ECC[ver - 1], nbl = NB[ver - 1], div = [], root2 = 1;
    for (i = 0; i < eccLen; i++) div.push(0); div[eccLen - 1] = 1;
    for (i = 0; i < eccLen; i++) { for (j = 0; j < eccLen; j++) { div[j] = gmul(div[j], root2); if (j + 1 < eccLen) div[j] ^= div[j + 1]; } root2 = gmul(root2, 2); }
    var rem = function (dat) { var r = []; for (var q = 0; q < eccLen; q++) r.push(0); dat.forEach(function (x) { var f = x ^ r.shift(); r.push(0); for (var q = 0; q < eccLen; q++) r[q] ^= gmul(div[q], f); }); return r; };
    var rawCw = raw >> 3, nShort = nbl - rawCw % nbl, shortLen = Math.floor(rawCw / nbl), blocks = [];
    k = 0; for (i = 0; i < nbl; i++) { var dl = shortLen - eccLen + (i < nShort ? 0 : 1), dat = cw.slice(k, k + dl); k += dl; var ecc = rem(dat); if (i < nShort) dat.push(0); blocks.push(dat.concat(ecc)); }
    var all = []; for (i = 0; i < blocks[0].length; i++) blocks.forEach(function (bl, jj) { if (i !== shortLen - eccLen || jj >= nShort) all.push(bl[i]); });
    var n = ver * 4 + 17, M = [], F = []; for (i = 0; i < n; i++) { M.push(new Array(n).fill(false)); F.push(new Array(n).fill(false)); }
    var setF = function (x, y, d) { if (x >= 0 && y >= 0 && x < n && y < n) { M[y][x] = d; F[y][x] = true; } };
    for (i = 0; i < n; i++) { setF(6, i, i % 2 === 0); setF(i, 6, i % 2 === 0); }
    [[3, 3], [n - 4, 3], [3, n - 4]].forEach(function (c) { for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) { var d = Math.max(Math.abs(dx), Math.abs(dy)); setF(c[0] + dx, c[1] + dy, d !== 2 && d !== 4); } });
    var ap = [];
    if (ver > 1) { var na2 = Math.floor(ver / 7) + 2, st = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (na2 * 2 - 2)) * 2; ap = [6]; for (var pos = n - 7; ap.length < na2; pos -= st) ap.splice(1, 0, pos); }
    ap.forEach(function (ax, ia) { ap.forEach(function (ay, ib) { if ((ia === 0 && ib === 0) || (ia === 0 && ib === ap.length - 1) || (ia === ap.length - 1 && ib === 0)) return; for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) setF(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1); }); });
    if (ver >= 7) { var vr = ver; for (i = 0; i < 12; i++) vr = (vr << 1) ^ ((vr >>> 11) * 0x1F25); var vb = (ver << 12) | vr; for (i = 0; i < 18; i++) { var cc = ((vb >>> i) & 1) === 1, a = n - 11 + i % 3, bb = Math.floor(i / 3); setF(a, bb, cc); setF(bb, a, cc); } }
    var fmt = function (m, mask) {
      var d = (0 << 3) | mask, r = d; for (var q = 0; q < 10; q++) r = (r << 1) ^ ((r >>> 9) * 0x537);
      var bt = ((d << 10) | r) ^ 0x5412, g = function (q) { return ((bt >>> q) & 1) === 1; }, s = function (x, y, v) { m[y][x] = v; };
      for (var q = 0; q <= 5; q++) s(8, q, g(q)); s(8, 7, g(6)); s(8, 8, g(7)); s(7, 8, g(8)); for (q = 9; q < 15; q++) s(14 - q, 8, g(q));
      for (q = 0; q < 8; q++) s(n - 1 - q, 8, g(q)); for (q = 8; q < 15; q++) s(8, n - 15 + q, g(q)); s(8, n - 8, true);
    };
    for (i = 0; i < n; i++) for (j = 0; j < n; j++) if (i === 8 || j === 8 || i >= n - 8 || j >= n - 8) { /* vùng định dạng được đánh dấu để dữ liệu không đè lên */ }
    var Fd = F.map(function (r) { return r.slice(); }), mark = function (x, y) { if (x >= 0 && y >= 0 && x < n && y < n) Fd[y][x] = true; };
    for (i = 0; i < 9; i++) { mark(8, i); mark(i, 8); } for (i = 0; i < 8; i++) { mark(n - 1 - i, 8); mark(8, n - 1 - i); } mark(8, n - 8);
    var maskFn = [function (x, y) { return (x + y) % 2 === 0; }, function (x, y) { return y % 2 === 0; }, function (x, y) { return x % 3 === 0; }, function (x, y) { return (x + y) % 3 === 0; }, function (x, y) { return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; }, function (x, y) { return x * y % 2 + x * y % 3 === 0; }, function (x, y) { return (x * y % 2 + x * y % 3) % 2 === 0; }, function (x, y) { return ((x + y) % 2 + x * y % 3) % 2 === 0; }];
    var best = null, bestP = 1e9;
    for (var mk = 0; mk < 8; mk++) {
      var m = M.map(function (r) { return r.slice(); }), bi = 0;
      for (var right = n - 1; right >= 1; right -= 2) { if (right === 6) right = 5; for (var vert = 0; vert < n; vert++) for (var jj = 0; jj < 2; jj++) { var x = right - jj, up = ((right + 1) & 2) === 0, y = up ? n - 1 - vert : vert; if (!Fd[y][x] && bi < all.length * 8) { m[y][x] = ((all[bi >> 3] >>> (7 - (bi & 7))) & 1) === 1; bi++; } if (!Fd[y][x] && maskFn[mk](x, y)) m[y][x] = !m[y][x]; } }
      fmt(m, mk);
      var p = 0, run, prev, x2, y2; for (y2 = 0; y2 < n; y2++) { run = 1; for (x2 = 1; x2 < n; x2++) { if (m[y2][x2] === m[y2][x2 - 1]) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; } }
      for (x2 = 0; x2 < n; x2++) { run = 1; for (y2 = 1; y2 < n; y2++) { if (m[y2][x2] === m[y2 - 1][x2]) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; } }
      for (y2 = 0; y2 < n - 1; y2++) for (x2 = 0; x2 < n - 1; x2++) if (m[y2][x2] === m[y2][x2 + 1] && m[y2][x2] === m[y2 + 1][x2] && m[y2][x2] === m[y2 + 1][x2 + 1]) p += 3;
      if (p < bestP) { bestP = p; best = m; }
    }
    return { n: n, m: best };
  }
  var api = { genCode: genCode, normCode: normCode, okCode: okCode, outSize: outSize, PLAT: PLAT, fitRect: fitRect, tiles: tiles, camAr: camAr, camRect: camRect, moveRect: moveRect, resizeRect: resizeRect, camPreset: camPreset, validWhip: validWhip, checks: checks, qrMatrix: qrMatrix };
  /*ENDPURE*/
  if (typeof window === "undefined") { if (typeof module !== "undefined" && module.exports) module.exports = api; return; }
  /* =================== PHẦN CHẠY TRONG TRÌNH DUYỆT =================== */
  var D = root.document, $ = function (s, r) { return (r || D).querySelector(s); }, $$ = function (s, r) { return [].slice.call((r || D).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var RF = function () { return root.NHIPRawFetch || root.fetch.bind(root); };
  var ICE = [{ urls: "stun:stun.cloudflare.com:3478" }, { urls: "stun:stun.l.google.com:19302" }];
  var LSK = "nhip-live-cast-v1";
  function defS() { return { plat: "facebook", ar: "16:9", q: 720, fps: 30, tpl: "free", fx: { on: true, preset: "auto", auto: true, ev: 0, shadow: .35, con: .15, sat: .12, warm: 0, den: .55, sharp: .35 }, bg: { sel: ["p1"], layout: "single", fit: "contain", active: "p1", rot: 0, follow: true, pin: false, idle: 0 }, cam: { on: true, feed: true, img: "default", lock: false, h: 0, src: "phone", dev: "", cx: .8, cy: .76, w: .26, shape: "auto", mirror: false, border: 3, zoom: 1, radius: .1, color: "#12b98b" }, aud: { page: { on: true, v: 1 }, pc: { on: false, v: 1 }, ph: { on: true, v: 1 } }, out: { mode: "window", rec: false, sound: false, whip: "", tok: "" }, title: { on: false, t: "Phiên live thị trường", s: "" }, badge: true, ov: {} }; }
  var S = (function () {
    var d = defS(), sv = {}; try { sv = JSON.parse(localStorage.getItem(LSK) || "null") || {}; } catch (e) { }
    Object.keys(d).forEach(function (k) { if (sv[k] == null) return; if (d[k] && typeof d[k] === "object" && !Array.isArray(d[k])) { Object.keys(d[k]).forEach(function (j) { if (sv[k][j] != null) { if (d[k][j] && typeof d[k][j] === "object" && !Array.isArray(d[k][j])) Object.assign(d[k][j], sv[k][j]); else d[k][j] = sv[k][j]; } }); } else d[k] = sv[k]; });
    try { d.out.whip = sessionStorage.getItem(LSK + ".whip") || ""; } catch (e) { } try { if (sv.ov && typeof sv.ov === "object") d.ov = sv.ov; } catch (e) { } return d;
  })();
  function save() { try { var o = JSON.parse(JSON.stringify(S)); o.out.whip = ""; o.out.tok = ""; localStorage.setItem(LSK, JSON.stringify(o)); sessionStorage.setItem(LSK + ".whip", S.out.whip || ""); } catch (e) { } }
  var R = { role: (root.matchMedia && root.matchMedia("(pointer:coarse)").matches && root.innerWidth < 900) ? "phone" : "pc", open: false, wide: false, min: false, sec: { 1: true }, link: "idle", linkMsg: "", code: "", pc: null, dc: null, tok: 0, remote: null, info: {}, preview: false, live: false, t0: 0, fps: 0, cd: 0, msg: "", ck: false, local: null, facing: "user", mic: true, manual: null };
  var CAP = { base: null, et: null, ev: null, eid: "", eel: null, sty: null, busy: false, audio: null, mode: "", ok: false, src: {} };
  var OUT = D.createElement("canvas"), OUTS = null, N = {}, AC = null, ADEST = null, TK = null, rv = D.createElement("video"), ra = null, frames = 0, lastFpsT = 0;
  rv.muted = true; rv.playsInline = true; rv.autoplay = true;
  var FXA = function () { return root.NHIPLiveFX; }, EN = null;
  var pcv = D.createElement("video"); pcv.muted = true; pcv.playsInline = true; pcv.autoplay = true;
  var camV = function () { return S.cam.src === "pc" ? pcv : rv; };
  function enh(v) { var F = FXA(); if (!F || !S.fx || S.fx.on === false) return null; try { if (!EN) EN = F.createEnhancer(); return EN.run(v, S.fx); } catch (e) { return null; } }
  function tplL() { var F = FXA(); if (!F || !S.tpl || S.tpl === "free") return null; return F.layout(S.tpl, OUT.width, OUT.height, S.cam.on); }
  /* Bố cục thực tế = khung dựng sẵn (hoặc tự do) + vị trí do người dùng tự kéo. Mỗi (khung × tỉ lệ) nhớ riêng trong S.ov. */
  function ovKey() { return S.tpl + "@" + S.ar; }
  function lay() {
    var F = FXA(), W = OUT.width, H = OUT.height, free = !F || !S.tpl || S.tpl === "free", ov = S.ov && S.ov[ovKey()], T;
    if (free) T = { id: "free", free: true, bg: { x: 0, y: 0, w: W, h: H }, cam: api.camRect(S.cam, W, H, vAr()), rad: null, top: "cam", bar: null, frame: false };
    else T = F.layout(S.tpl, W, H, S.cam.on);
    if (F && F.applyOv && ov) T = F.applyOv(T, ov, W, H, { cam: free || !S.cam.on, bg: !free && !S.cam.on });
    return T;
  }
  function tplOpt() { return { accent: S.cam.color, title: S.title.on ? S.title.t : "", sub: S.title.on ? S.title.s : "", live: R.live }; }
  async function pcDevs() { try { var ds = await navigator.mediaDevices.enumerateDevices(); R.pcDevs = ds.filter(function (d) { return d.kind === "videoinput"; }).map(function (d, i) { return { id: d.deviceId, label: d.label || ("Camera " + (i + 1)) }; }); } catch (e) { } }
  function pcCamOff() { if (R.pcCam) { R.pcCam.getTracks().forEach(function (t) { try { t.stop(); } catch (e) { } }); R.pcCam = null; } try { pcv.srcObject = null; } catch (e) { } }
  async function pcCamOn(dev) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { toast("Trình duyệt không hỗ trợ camera."); return; }
    pcCamOff(); var w = +S.q >= 1080 ? 1920 : 1280, h = +S.q >= 1080 ? 1080 : 720, vc = { width: { ideal: w }, height: { ideal: h }, frameRate: { ideal: 30 } }; if (dev) vc.deviceId = { ideal: dev }; else vc.facingMode = "user";
    try {
      var s = await navigator.mediaDevices.getUserMedia({ video: vc, audio: false }); R.pcCam = s; pcv.srcObject = s; pcv.play().catch(function () { });
      var tr = s.getVideoTracks()[0]; try { tr.contentHint = "detail"; } catch (e) { }
      try { await tr.applyConstraints({ advanced: [{ exposureMode: "continuous", whiteBalanceMode: "continuous", focusMode: "continuous" }] }); } catch (e) { }
      S.cam.src = "pc"; S.cam.on = true; S.cam.feed = true; save(); await pcDevs(); if (!R.preview && CAP.ok) startPreview();
    } catch (e) { S.cam.on = false; toast("Không mở được camera máy tính: " + (e.message || e.name) + ". Hãy cho phép camera cho trang này."); }
    render();
  }
  /* Tắt/bật hình camera: tắt thì khung giữ nguyên và hiện ảnh (mặc định NHỊP hoặc ảnh của bạn). */
  var IMGK = LSK + ".img", CUST = null;
  function loadCust() { try { var u = localStorage.getItem(IMGK); if (u) { var im = new Image(); im.onload = function () { CUST = im; }; im.src = u; } } catch (e) { } }
  function pickImg() {
    var f = D.createElement("input"); f.type = "file"; f.accept = "image/*";
    f.onchange = function () {
      var file = f.files && f.files[0]; if (!file) return; var fr = new FileReader();
      fr.onload = function () {
        var im = new Image(); im.onload = function () {
          var k = Math.min(1, 1600 / Math.max(im.naturalWidth, im.naturalHeight)), cv = D.createElement("canvas"); cv.width = Math.max(2, Math.round(im.naturalWidth * k)); cv.height = Math.max(2, Math.round(im.naturalHeight * k));
          cv.getContext("2d").drawImage(im, 0, 0, cv.width, cv.height); var u = cv.toDataURL("image/jpeg", .88), im2 = new Image();
          im2.onload = function () { CUST = im2; S.cam.img = "custom"; var kept = true; try { localStorage.setItem(IMGK, u); } catch (e) { kept = false; } save(); toast(kept ? "Đã dùng ảnh của bạn." : "Đã dùng ảnh (chỉ trong phiên này — ảnh quá lớn để lưu)."); render(); }; im2.src = u;
        }; im.onerror = function () { toast("Không đọc được ảnh này."); }; im.src = fr.result;
      }; fr.readAsDataURL(file);
    }; f.click();
  }
  function setFeed(on) {
    S.cam.feed = !!on; save();
    if (S.cam.src === "pc") { if (on) { if (S.cam.on) pcCamOn(S.cam.dev); } else pcCamOff(); } else ctl({ t: "vid", v: !!on });
    render();
  }
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var toast = function (m) { R.msg = m; clearTimeout(R.mt); R.mt = setTimeout(function () { R.msg = ""; paintStatus(); }, 5000); paintStatus(); };
  var L = function () { return root.NHIPLiveRoom && root.NHIPLiveRoom.cast; };
  var panes = function () { var c = L(); try { return c ? c.panes() : []; } catch (e) { return []; } };
  var paneOf = function (id) { return panes().filter(function (p) { return p.id === id; })[0]; };

  /* ---------- hộp thư trao đổi mã (/proxy/live-sig) ---------- */
  function sigUrl(code, k) { return "/proxy/live-sig?room=" + encodeURIComponent(code) + "&k=" + k; }
  async function sigPut(code, k, sdp) { var r = await RF()(sigUrl(code, k), { method: "POST", headers: { "Content-Type": "text/plain" }, body: sdp, cache: "no-store" }); if (!r.ok) { var j = {}; try { j = await r.json(); } catch (e) { } throw new Error(j.error || ("Máy chủ trả mã " + r.status)); } }
  async function sigWait(code, k, ms, tok) {
    var t0 = Date.now(); while (Date.now() - t0 < ms) { if (tok !== R.tok) throw new Error("hủy"); try { var r = await RF()(sigUrl(code, k), { cache: "no-store" }); if (r.ok) return await r.text(); if (r.status !== 404) throw new Error("Máy chủ trả mã " + r.status); } catch (e) { if (/Máy chủ/.test(e.message)) throw e; } await sleep(1200); }
    throw new Error("Hết thời gian chờ (" + Math.round(ms / 1000) + " giây)");
  }
  function iceDone(pc, ms) { return new Promise(function (res) { if (pc.iceGatheringState === "complete") return res(); var t = setTimeout(fin, ms); function fin() { clearTimeout(t); pc.removeEventListener("icegatheringstatechange", chk); res(); } function chk() { if (pc.iceGatheringState === "complete") fin(); } pc.addEventListener("icegatheringstatechange", chk); }); }
  async function pack(s) { var cs = new CompressionStream("deflate-raw"), w = cs.writable.getWriter(); w.write(new TextEncoder().encode(s)); w.close(); var u = new Uint8Array(await new Response(cs.readable).arrayBuffer()), b = ""; u.forEach(function (x) { b += String.fromCharCode(x); }); return "NHIP1:" + btoa(b).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
  async function unpack(t) { t = String(t || "").trim().replace(/^NHIP1:/, "").replace(/\s+/g, ""); var b = atob(t.replace(/-/g, "+").replace(/_/g, "/")), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); var ds = new DecompressionStream("deflate-raw"), w = ds.writable.getWriter(); w.write(u); w.close(); return new TextDecoder().decode(await new Response(ds.readable).arrayBuffer()); }
  function setLink(st, msg) { R.link = st; R.linkMsg = msg || ""; if (R.open) { if (st === "connected" || st === "lost" || st === "idle" || st === "err" || st === "wait" || st === "cam") render(); else paintStatus(); } }

  /* ---------- MÁY TÍNH: tạo lời mời, chờ điện thoại trả lời ---------- */
  function newPC() { var pc = new RTCPeerConnection({ iceServers: ICE }); pc.onconnectionstatechange = function () { if (pc !== R.pc) return; var s = pc.connectionState; if (s === "connected") { setLink("connected", ""); } else if (s === "failed" || s === "disconnected" || s === "closed") { if (R.link === "connected") { R.remote = null; setLink("lost", "Mất kết nối với điện thoại."); } else if (s === "failed") setLink("err", "Không kết nối được trực tiếp (mạng chặn). Thử cùng Wi‑Fi hoặc ghép thủ công."); } }; return pc; }
  function closePair() { R.tok++; try { if (R.dc) R.dc.close(); } catch (e) { } try { if (R.pc) R.pc.close(); } catch (e) { } R.pc = null; R.dc = null; R.remote = null; rv.srcObject = null; R.info = {}; bindAudio("ph", null); }
  async function pcMakeOffer() {
    closePair(); var tok = R.tok, pc = R.pc = newPC();
    R.dc = pc.createDataChannel("ctl"); bindDC(R.dc);
    pc.addTransceiver("video", { direction: "recvonly" }); pc.addTransceiver("audio", { direction: "recvonly" });
    pc.ontrack = function (e) { if (e.track.kind === "video") { R.remote = e.streams[0] || new MediaStream([e.track]); rv.srcObject = R.remote; rv.play().catch(function () { }); } else if (e.track.kind === "audio") { bindAudio("ph", e.track); } };
    var off = await pc.createOffer(); await pc.setLocalDescription(off); await iceDone(pc, 2500);
    return { sdp: pc.localDescription.sdp, tok: tok, pc: pc };
  }
  async function pcPair() {
    R.code = api.genCode(function () { return (root.crypto && crypto.getRandomValues) ? crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296 : Math.random(); });
    setLink("wait", "Đang tạo mã…"); render();
    try {
      var o = await pcMakeOffer(); await sigPut(R.code, "o", o.sdp); setLink("wait", "Chờ điện thoại nhập mã " + R.code + "…");
      var ans = await sigWait(R.code, "a", 300000, o.tok); await o.pc.setRemoteDescription({ type: "answer", sdp: ans }); setLink("wait", "Đang nối…");
    } catch (e) { if (e.message !== "hủy") setLink("err", "Không ghép được: " + e.message + " — dùng “Ghép thủ công” bên dưới nếu máy chủ chưa hỗ trợ."); }
  }
  async function pcManualOffer() { try { setLink("wait", "Đang tạo mã thủ công…"); var o = await pcMakeOffer(); R.manual = { tok: o.tok, pc: o.pc, offer: await pack(o.sdp) }; setLink("wait", "Chép mã bên dưới sang điện thoại, rồi dán mã trả lời vào."); } catch (e) { setLink("err", "Lỗi: " + e.message); } }
  async function pcManualAnswer(txt) { try { if (!R.manual) return; await R.manual.pc.setRemoteDescription({ type: "answer", sdp: await unpack(txt) }); setLink("wait", "Đang nối…"); } catch (e) { toast("Mã trả lời không hợp lệ."); } }
  function bindDC(dc) { dc.onmessage = function (e) { try { var m = JSON.parse(e.data); if (m.t === "vid") { if (R.local) R.local.getVideoTracks().forEach(function (t) { t.enabled = !!m.v; }); } else if (m.t === "info") { R.info = m; if (R.open) paintStatus(); } else if (m.t === "facing") { phoneCam(m.v, true); } else if (m.t === "mic") { R.mic = !!m.v; if (R.local) R.local.getAudioTracks().forEach(function (t) { t.enabled = R.mic; }); sendInfo(); if (R.open) render(); } else if (m.t === "q") { R.q = m.v; phoneCam(R.facing, true); } } catch (x) { } }; dc.onopen = function () { if (R.role === "phone") sendInfo(); else { ctl({ t: "hello" }); if (S.cam.feed === false) ctl({ t: "vid", v: false }); } }; }
  function ctl(o) { try { if (R.dc && R.dc.readyState === "open") R.dc.send(JSON.stringify(o)); } catch (e) { } }

  /* ---------- ĐIỆN THOẠI: bật camera, nhận lời mời, trả lời ---------- */
  async function phoneCam(facing, replace) {
    var q = R.q || "720", w = q === "1080" ? 1920 : 1280, h = q === "1080" ? 1080 : 720, s;
    var old = R.local; R.facing = facing || R.facing;
    try { s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: R.facing }, width: { ideal: w }, height: { ideal: h }, frameRate: { ideal: 30 } }, audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
    catch (e) { try { s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: R.facing } } }); toast("Không mở được micro — vẫn gửi hình."); } catch (e2) { setLink("err", "Không mở được camera: " + (e2.message || e2.name) + ". Hãy cho phép camera cho trang này."); return false; } }
    s.getAudioTracks().forEach(function (t) { t.enabled = R.mic; }); try { s.getVideoTracks().forEach(function (t) { t.contentHint = "detail"; }); } catch (e) { } R.local = s;
    if (old) old.getTracks().forEach(function (t) { t.stop(); });
    if (R.pc && replace) R.pc.getSenders().forEach(function (sn) { if (!sn.track && !sn.transport) return; var k = sn.track && sn.track.kind, nt = s.getTracks().filter(function (t) { return t.kind === k; })[0]; if (nt) sn.replaceTrack(nt).catch(function () { }); });
    var pv = $("#lcPv"); if (pv) { pv.srcObject = s; pv.play().catch(function () { }); }
    if (R.link === "idle" || R.link === "err") R.link = "cam"; sendInfo(); if (R.open) render(); return true;
  }
  async function sendInfo() {
    var o = { t: "info", facing: R.facing, mic: R.mic, bat: null, chg: false, w: 0, h: 0 };
    try { var b = navigator.getBattery && await navigator.getBattery(); if (b) { o.bat = b.level; o.chg = b.charging; } } catch (e) { }
    try { var st = R.local && R.local.getVideoTracks()[0].getSettings(); if (st) { o.w = st.width; o.h = st.height; } } catch (e) { } ctl(o);
  }
  async function phoneAnswer(offerSdp, tok) {
    closePair(); R.tok = tok; var pc = R.pc = newPC(); pc.ondatachannel = function (e) { R.dc = e.channel; bindDC(R.dc); };
    await pc.setRemoteDescription({ type: "offer", sdp: offerSdp });
    R.local.getTracks().forEach(function (t) { pc.addTrack(t, R.local); });
    pc.getSenders().forEach(function (sn) { if (sn.track && sn.track.kind === "video") { try { var p = sn.getParameters(); p.encodings = p.encodings && p.encodings.length ? p.encodings : [{}]; p.encodings[0].maxBitrate = (R.q === "1080" ? 9000 : 5000) * 1000; p.encodings[0].scaleResolutionDownBy = 1; sn.setParameters(p).then(function () { var p2 = sn.getParameters(); p2.degradationPreference = "maintain-resolution"; return sn.setParameters(p2); }).catch(function () { }); } catch (e) { } } });
    var a = await pc.createAnswer(); await pc.setLocalDescription(a); await iceDone(pc, 2500); return pc.localDescription.sdp;
  }
  async function phoneJoin(code) {
    code = api.normCode(code); if (!api.okCode(code)) { toast("Mã gồm 6 ký tự (chữ + số), ví dụ K7P2QM."); return; }
    if (!R.local && !(await phoneCam(R.facing))) return;
    var tok = ++R.tok; R.code = code; setLink("connecting", "Đang lấy lời mời từ máy tính…");
    try { var off = await sigWait(code, "o", 45000, tok), ans = await phoneAnswer(off, tok); await sigPut(code, "a", ans); setLink("connecting", "Đang nối với máy tính…"); keepAwake(true); }
    catch (e) { if (e.message !== "hủy") setLink("err", "Không kết nối được: " + e.message + ". Kiểm tra mã, hoặc dùng ghép thủ công."); }
  }
  async function phoneManual(txt) { try { if (!R.local && !(await phoneCam(R.facing))) return; var tok = ++R.tok, ans = await phoneAnswer(await unpack(txt), tok); R.manual = { answer: await pack(ans) }; setLink("connecting", "Chép mã trả lời sang máy tính."); render(); } catch (e) { toast("Mã từ máy tính không hợp lệ."); } }
  var WL = null; async function keepAwake(on) { try { if (on && navigator.wakeLock) { WL = await navigator.wakeLock.request("screen"); } else if (WL) { await WL.release(); WL = null; } } catch (e) { } }
  D.addEventListener("visibilitychange", function () { if (!D.hidden && (R.live || (R.role === "phone" && R.link === "connected"))) keepAwake(true); });

  /* ---------- NỀN: ghi hình trang NHỊP ----------
     • Bố cục "một cửa sổ toàn màn hình" (mặc định) + Chrome/Edge → Element Capture: MỘT nguồn ghi duy nhất, đổi mục tiêu theo cửa sổ đang hiển thị
       (chỉ ghi đúng phần tử, kể cả khi bị cửa sổ khác che). Chrome chỉ cho một nguồn Element Capture tại một thời điểm nên không dùng cho nhiều cửa sổ cùng lúc.
     • Bố cục chia đôi/lưới hoặc trình duyệt cũ → ghi cả thẻ rồi cắt theo vùng/tọa độ (các cửa sổ phải nằm trên cùng, không chồng nhau). */
  async function grabTab(wantAudio) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) { toast("Trình duyệt này không hỗ trợ ghi hình màn hình."); return null; }
    var st; try { st = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: !!wantAudio, preferCurrentTab: true, selfBrowserSurface: "include", surfaceSwitching: "exclude", systemAudio: "exclude" }); } catch (e) { toast(e && e.name === "NotAllowedError" ? "Bạn đã từ chối ghi hình." : "Không bật được ghi hình: " + (e.message || e.name)); return null; }
    var vt = st.getVideoTracks()[0], ds = vt.getSettings().displaySurface;
    if (ds && ds !== "browser") { st.getTracks().forEach(function (t) { t.stop(); }); toast("Hãy chọn đúng THẺ (Tab) đang mở NHỊP, không chọn cả màn hình/cửa sổ."); return null; }
    return { st: st, vt: vt };
  }
  var capModeOf = function (vt) { return (root.RestrictionTarget && typeof vt.restrictTo === "function") ? "element" : (root.CropTarget && typeof vt.cropTo === "function") ? "region" : "rect"; };
  function mkVideo(tr) { var v = D.createElement("video"); v.muted = true; v.playsInline = true; v.autoplay = true; v.srcObject = new MediaStream([tr]); v.play().catch(function () { }); return v; }
  function dropSource(id) { var s = CAP.src[id]; if (!s) return; if (s.tr && s.tr !== CAP.base) try { s.tr.stop(); } catch (e) { } try { s.video.srcObject = null; } catch (e) { } delete CAP.src[id]; }
  var TR = { from: "", to: "", t: 0, snap: null };
  function snapshot() { var v = CAP.ev; if (!v || !v.videoWidth) { TR.snap = null; return; } var c = TR.snap || (TR.snap = D.createElement("canvas")); c.width = v.videoWidth; c.height = v.videoHeight; try { c.getContext("2d").drawImage(v, 0, 0); } catch (e) { TR.snap = null; } }
  async function retarget(id) {
    var p = paneOf(id); if (!p || !p.el || !p.open || !CAP.et || CAP.mode !== "element") return false; if (CAP.eid === id && CAP.eel === p.el) return true; if (CAP.busy) return false; CAP.busy = true;
    try {
      snapshot(); var prev = CAP.sty, styled = [p.el.style.isolation, p.el.style.contain];
      /* đặt sẵn điều kiện "đủ tư cách" (stacking context + khối chứa) trước khi ghi — một lần restrictTo thất bại có thể làm hỏng track */
      p.el.style.isolation = "isolate"; p.el.style.contain = "paint";
      try { await CAP.et.restrictTo(await root.RestrictionTarget.fromElement(p.el)); } catch (e2) { p.el.style.isolation = styled[0]; p.el.style.contain = styled[1]; throw e2; }
      if (prev && prev.el !== p.el) { prev.el.style.isolation = prev.old[0]; prev.el.style.contain = prev.old[1]; }
      CAP.sty = styled ? { el: p.el, old: styled } : null; CAP.eid = id; CAP.eel = p.el; TR.t = performance.now(); return true;
    } catch (e) { toast("Không ghi được cửa sổ này: " + (e.message || e)); return false; } finally { CAP.busy = false; }
  }
  async function enableCapture() {
    var act = S.bg.sel.filter(function (id) { var p = paneOf(id); return p && p.el && p.open; });
    if (!act.length) { toast("Hãy tick và mở ít nhất một cửa sổ nền trước."); return; }
    var g = await grabTab(true); if (!g) return; var mode = capModeOf(g.vt); if (mode === "element" && S.bg.layout !== "single") mode = CropTargetOk(g.vt);
    releaseCapture(); CAP.mode = mode; CAP.audio = g.st.getAudioTracks()[0] || null;
    if (mode === "element") { CAP.et = g.vt; CAP.ev = mkVideo(g.vt); CAP.ok = true; var first = act.indexOf(S.bg.active) >= 0 ? S.bg.active : act[0]; if (!(await retarget(first))) { releaseCapture(); return; } g.vt.addEventListener("ended", function () { if (CAP.et === g.vt) { releaseCapture(); toast("Đã dừng chia sẻ tab. Hãy cho phép lại."); if (R.live) stopLive(); render(); } }); }
    else { CAP.base = g.vt; CAP.ok = true; g.vt.addEventListener("ended", function () { if (CAP.base === g.vt) { releaseCapture(); toast("Đã dừng chia sẻ tab. Hãy cho phép lại."); if (R.live) stopLive(); render(); } }); await syncSources(); }
    if (CAP.audio) bindAudio("page", CAP.audio); if (!R.preview) startPreview(); render();
  }
  function CropTargetOk(vt) { return (root.CropTarget && typeof vt.cropTo === "function") ? "region" : "rect"; }
  function releaseCapture() {
    Object.keys(CAP.src).slice().forEach(dropSource); if (CAP.sty) { CAP.sty.el.style.isolation = CAP.sty.old[0]; CAP.sty.el.style.contain = CAP.sty.old[1]; CAP.sty = null; }
    [CAP.base, CAP.et, CAP.audio].forEach(function (t) { if (t) try { t.stop(); } catch (e) { } }); if (CAP.ev) try { CAP.ev.srcObject = null; } catch (e) { }
    bindAudio("page", null); CAP.base = null; CAP.et = null; CAP.ev = null; CAP.eid = ""; CAP.eel = null; CAP.audio = null; CAP.ok = false; CAP.mode = ""; CAP.busy = false; TR.snap = null;
  }
  async function mkSource(id) { /* chỉ cho chế độ cắt vùng/tọa độ (dùng chung một lần ghi) */
    var p = paneOf(id); if (!p || !p.el || !CAP.base) return null; var cur = CAP.src[id]; if (cur && cur.el === p.el) return cur; dropSource(id);
    var mode = CAP.mode, tr = mode === "rect" ? CAP.base : CAP.base.clone();
    try { if (mode === "region") await tr.cropTo(await root.CropTarget.fromElement(p.el)); } catch (e) { try { tr.stop(); } catch (x) { } tr = CAP.base; mode = "rect"; }
    return (CAP.src[id] = { id: id, el: p.el, tr: tr, video: mkVideo(tr), mode: mode });
  }
  async function syncSources() { if (!CAP.ok || !CAP.base) return; for (var i = 0; i < S.bg.sel.length; i++) { try { await mkSource(S.bg.sel[i]); } catch (e) { } } }

  /* ---------- ÂM THANH: trộn 3 nguồn ---------- */
  function audioInit() { if (AC) { if (AC.state === "suspended") AC.resume().catch(function () { }); return; } var C = root.AudioContext || root.webkitAudioContext; if (!C) return; AC = new C(); ADEST = AC.createMediaStreamDestination(); }
  function bindAudio(key, track) {
    var n = N[key]; if (n && n.track === track) return; if (n) { try { n.src.disconnect(); n.gain.disconnect(); n.an.disconnect(); } catch (e) { } N[key] = null; if (key === "ph" && ra) { ra.srcObject = null; ra = null; } }
    if (!track) return; audioInit(); if (!AC) return;
    var ms = new MediaStream([track]); if (key === "ph") { ra = new Audio(); ra.srcObject = ms; ra.muted = true; ra.play().catch(function () { }); }
    var src = AC.createMediaStreamSource(ms), gain = AC.createGain(), an = AC.createAnalyser(); an.fftSize = 256; src.connect(gain); gain.connect(an); an.connect(ADEST); N[key] = { track: track, src: src, gain: gain, an: an, buf: new Uint8Array(an.fftSize) }; applyGain();
  }
  function applyGain() { ["page", "pc", "ph"].forEach(function (k) { if (N[k]) N[k].gain.gain.value = S.aud[k].on ? S.aud[k].v : 0; }); }
  async function setPcMic(on) {
    S.aud.pc.on = on; save();
    if (on) { try { var s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); R.pcMic = s; bindAudio("pc", s.getAudioTracks()[0]); } catch (e) { S.aud.pc.on = false; toast("Không mở được micro máy tính."); } }
    else { if (R.pcMic) R.pcMic.getTracks().forEach(function (t) { t.stop(); }); R.pcMic = null; bindAudio("pc", null); }
    applyGain(); render();
  }
  function level(k) { var n = N[k]; if (!n || !S.aud[k].on) return 0; n.an.getByteTimeDomainData(n.buf); var s = 0, i; for (i = 0; i < n.buf.length; i++) { var v = (n.buf[i] - 128) / 128; s += v * v; } return clamp(Math.sqrt(s / n.buf.length) * 3 * S.aud[k].v, 0, 1); }
  function audioAny() { return ["page", "pc", "ph"].some(function (k) { return S.aud[k].on && S.aud[k].v > 0 && N[k]; }); }

  /* ---------- GHÉP CẢNH (compositor) ---------- */
  function setSize() { var z = api.outSize(S.ar, S.q); if (OUT.width !== z[0] || OUT.height !== z[1]) { OUT.width = z[0]; OUT.height = z[1]; OUTS = null; } }
  function rrect(c, x, y, w, h, r) { r = Math.max(0, Math.min(r, w / 2, h / 2)); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function ph(c, x, y, w, h, txt, sub) { var g = c.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, "#14202e"); g.addColorStop(1, "#0b1220"); c.fillStyle = g; c.fillRect(x, y, w, h); var fs = Math.max(14, Math.min(w, h) * .06); c.fillStyle = "#cfe3ee"; c.textAlign = "center"; c.textBaseline = "middle"; c.font = "700 " + fs + "px system-ui,sans-serif"; c.fillText(txt, x + w / 2, y + h / 2 - (sub ? fs * .7 : 0)); if (sub) { c.fillStyle = "#7f98a8"; c.font = "500 " + fs * .72 + "px system-ui,sans-serif"; c.fillText(sub, x + w / 2, y + h / 2 + fs * .8); } }
  function drawTile(c, id, r, fit, alpha) {
    var p = paneOf(id), s = CAP.src[id], v = s && s.video, nm = p ? p.nm : id; c.save(); c.globalAlpha = alpha == null ? 1 : alpha; c.beginPath(); c.rect(r.x, r.y, r.w, r.h); c.clip();
    if (!p || !p.open) { ph(c, r.x, r.y, r.w, r.h, "🪟 " + nm.replace(/^\S+\s/, ""), "đang đóng — mở lại cửa sổ này trong Live"); c.restore(); return; }
    if (!v || !v.videoWidth) { ph(c, r.x, r.y, r.w, r.h, "⏳ " + nm.replace(/^\S+\s/, ""), CAP.ok ? "đang chờ hình…" : "chưa cho phép ghi hình"); c.restore(); return; }
    var sw = v.videoWidth, sh = v.videoHeight, sx = 0, sy = 0;
    if (s.mode === "rect") { var b = p.el.getBoundingClientRect(), kx = sw / root.innerWidth, ky = sh / root.innerHeight; sx = Math.max(0, b.left * kx); sy = Math.max(0, b.top * ky); sw = Math.max(2, Math.min(sw - sx, b.width * kx)); sh = Math.max(2, Math.min(sh - sy, b.height * ky)); }
    c.fillStyle = "#0b1220"; c.fillRect(r.x, r.y, r.w, r.h);
    var f = api.fitRect(sw, sh, r.x, r.y, r.w, r.h, fit); if (f) { try { c.drawImage(v, sx + f.sx, sy + f.sy, f.sw, f.sh, f.dx, f.dy, f.dw, f.dh); } catch (e) { } } c.restore();
  }
  function drawBg(c, W, H, now) {
    var ids = S.bg.sel.filter(function (id) { return !!paneOf(id); });
    if (!ids.length) { ph(c, 0, 0, W, H, "Chưa chọn cửa sổ nền", "Bước 2 · Nền máy tính"); return; }
    if (CAP.mode === "element" && S.bg.layout !== "single") { ph(c, 0, 0, W, H, "Đổi bố cục cần cấp quyền lại", "bấm “Cho phép ghi hình” ở bước 2"); return; }
    if (S.bg.layout === "single") {
      var act = ids.indexOf(S.bg.active) >= 0 ? S.bg.active : ids[0];
      if (CAP.mode === "element") {
        var pa = paneOf(act), full = { x: 0, y: 0, w: W, h: H };
        if (!pa || !pa.open) { ph(c, 0, 0, W, H, "🪟 " + (pa ? pa.nm.replace(/^\S+\s/, "") : act), "đang đóng — mở lại cửa sổ này trong Live"); return; }
        if (CAP.eid !== act || CAP.eel !== pa.el) retarget(act);
        var ready = CAP.eid === act && CAP.ev && CAP.ev.videoWidth > 0, pr = clamp((now - TR.t) / 450, 0, 1);
        c.fillStyle = "#0b1220"; c.fillRect(0, 0, W, H);
        if (TR.snap && (!ready || pr < 1)) { var fs = api.fitRect(TR.snap.width, TR.snap.height, 0, 0, W, H, S.bg.fit); if (fs) { c.save(); c.globalAlpha = ready ? 1 - pr : 1; try { c.drawImage(TR.snap, fs.sx, fs.sy, fs.sw, fs.sh, fs.dx, fs.dy, fs.dw, fs.dh); } catch (e) { } c.restore(); } }
        if (ready) { var fl = api.fitRect(CAP.ev.videoWidth, CAP.ev.videoHeight, 0, 0, W, H, S.bg.fit); if (fl) { c.save(); c.globalAlpha = TR.snap ? pr : 1; try { c.drawImage(CAP.ev, fl.sx, fl.sy, fl.sw, fl.sh, fl.dx, fl.dy, fl.dw, fl.dh); } catch (e) { } c.restore(); } } else if (!TR.snap) ph(c, 0, 0, W, H, "⏳ " + pa.nm.replace(/^\S+\s/, ""), "đang chờ hình…");
        return;
      }
      if (TR.to !== act) { TR.from = TR.to; TR.to = act; TR.t = now; }
      var p = clamp((now - TR.t) / 450, 0, 1);
      if (TR.from && p < 1 && ids.indexOf(TR.from) >= 0) { drawTile(c, TR.from, { x: 0, y: 0, w: W, h: H }, S.bg.fit, 1); drawTile(c, act, { x: 0, y: 0, w: W, h: H }, S.bg.fit, p); } else drawTile(c, act, { x: 0, y: 0, w: W, h: H }, S.bg.fit, 1);
      return;
    }
    var T = api.tiles(ids.length, S.bg.layout, W, H, Math.round(Math.min(W, H) * .008)); c.fillStyle = "#0b1220"; c.fillRect(0, 0, W, H); ids.forEach(function (id, i) { drawTile(c, id, T[i], S.bg.fit, 1); });
  }
  function vAr() { var v = camV(); return v.videoWidth > 0 ? v.videoWidth / v.videoHeight : 0; }
  function camBox() { return lay().cam; }
  function drawFiller(c, r, now) {
    if (S.cam.img === "custom" && CUST) { var f = api.fitRect(CUST.naturalWidth || CUST.width, CUST.naturalHeight || CUST.height, r.x, r.y, r.w, r.h, "cover"); if (f) { try { c.drawImage(CUST, f.sx, f.sy, f.sw, f.sh, f.dx, f.dy, f.dw, f.dh); return; } catch (e) { } } }
    var F = FXA(); if (F && F.art) F.art(c, r.x, r.y, r.w, r.h, now); else ph(c, r.x, r.y, r.w, r.h, "NHỊP", "Thị trường chứng khoán Việt Nam");
  }
  function drawCam(c, W, H, T, now) {
    if (!S.cam.on) return; T = T || lay(); var r = T.cam, k = W / 1280, sh = S.cam.shape, rad = T.free ? (sh === "circle" ? Math.min(r.w, r.h) / 2 : Math.min(r.w, r.h) * S.cam.radius) : T.rad * Math.min(r.w, r.h);
    c.save(); c.shadowColor = "rgba(0,0,0,.45)"; c.shadowBlur = 18 * k; c.shadowOffsetY = 4 * k; rrect(c, r.x, r.y, r.w, r.h, rad); c.fillStyle = "#0b1220"; c.fill(); c.restore();
    c.save(); rrect(c, r.x, r.y, r.w, r.h, rad); c.clip();
    var cvd = camV(), vok = S.cam.feed !== false && cvd.readyState >= 2 && cvd.videoWidth > 0, en = vok ? enh(cvd) : null;
    if (vok) {
      var z = Math.max(1, S.cam.zoom), vw = en ? en.w : cvd.videoWidth, vh = en ? en.h : cvd.videoHeight, f = api.fitRect(vw / z, vh / z, r.x, r.y, r.w, r.h, "cover");
      f.sx += (vw - vw / z) / 2; f.sy += (vh - vh / z) / 2;
      if (S.cam.mirror) { c.translate(r.x * 2 + r.w, 0); c.scale(-1, 1); } try { c.drawImage(en ? en.el : cvd, f.sx, f.sy, f.sw, f.sh, r.x, r.y, r.w, r.h); } catch (e) { }
    } else if (S.cam.feed === false || R.live) drawFiller(c, r, now);
    else ph(c, r.x, r.y, r.w, r.h, S.cam.src === "pc" ? "💻" : "📱", "chờ camera");
    c.restore();
    if (S.cam.border > 0) { c.save(); rrect(c, r.x, r.y, r.w, r.h, rad); c.lineWidth = S.cam.border * k; c.strokeStyle = S.cam.color; c.stroke(); c.restore(); }
  }
  function drawTitle(c, W, H) {
    if (!S.title.on || !(S.title.t || S.title.s)) return; var fs = Math.round(H * .042), pad = fs * .7, hh = fs * (S.title.s ? 2.5 : 1.7), x = W * .03, y = H - hh - H * .04, w = Math.min(W * .62, Math.max(fs * 8, Math.max(c.measureText(S.title.t || "").width, 0)));
    c.save(); c.font = "800 " + fs + "px system-ui,sans-serif"; var tw = c.measureText(S.title.t || "").width; c.font = "500 " + fs * .72 + "px system-ui,sans-serif"; var sw = c.measureText(S.title.s || "").width; w = Math.min(W * .7, Math.max(tw, sw) + pad * 2.6);
    c.fillStyle = "rgba(8,16,26,.82)"; rrect(c, x, y, w, hh, fs * .35); c.fill(); c.fillStyle = S.cam.color || "#12b98b"; rrect(c, x, y, fs * .28, hh, fs * .14); c.fill();
    c.fillStyle = "#fff"; c.textAlign = "left"; c.textBaseline = "middle"; c.font = "800 " + fs + "px system-ui,sans-serif"; c.fillText(S.title.t || "", x + pad * 1.2, y + (S.title.s ? hh * .36 : hh / 2), w - pad * 2);
    if (S.title.s) { c.fillStyle = "#b9ccd8"; c.font = "500 " + fs * .72 + "px system-ui,sans-serif"; c.fillText(S.title.s, x + pad * 1.2, y + hh * .74, w - pad * 2); } c.restore();
  }
  function drawBadge(c, W, H, now) {
    if (!S.badge || !R.live) return; var fs = Math.round(H * .034), x = W * .025, y = H * .035, on = Math.floor(now / 700) % 2 === 0; c.save(); c.font = "800 " + fs + "px system-ui,sans-serif"; var w = c.measureText("LIVE").width + fs * 2;
    c.fillStyle = "rgba(220,38,38,.92)"; rrect(c, x, y, w, fs * 1.6, fs * .3); c.fill(); c.fillStyle = on ? "#fff" : "rgba(255,255,255,.35)"; c.beginPath(); c.arc(x + fs * .8, y + fs * .8, fs * .26, 0, 7); c.fill(); c.fillStyle = "#fff"; c.textAlign = "left"; c.textBaseline = "middle"; c.fillText("LIVE", x + fs * 1.35, y + fs * .82); c.restore();
  }
  function frame() {
    if (!R.preview && !R.live) return; var c = OUT.getContext("2d"), W = OUT.width, H = OUT.height, now = performance.now();
    c.fillStyle = "#0b1220"; c.fillRect(0, 0, W, H); var TL = lay(), F = FXA();
    if (!TL.free) F.paint(c, W, H, TL, tplOpt(), "pre"); else if (F && F.art && (TL.bg.w < W - 2 || TL.bg.h < H - 2)) F.art(c, 0, 0, W, H, now, { dim: .55 });
    if (TL.top === "bg") drawCam(c, W, H, TL, now);
    c.save(); c.beginPath(); c.rect(TL.bg.x, TL.bg.y, TL.bg.w, TL.bg.h); c.clip(); c.translate(TL.bg.x, TL.bg.y); drawBg(c, TL.bg.w, TL.bg.h, now); c.restore();
    if (TL.top !== "bg") drawCam(c, W, H, TL, now);
    if (!TL.free) F.paint(c, W, H, TL, tplOpt(), "post");
    if (TL.free || !TL.bar) drawTitle(c, W, H); drawBadge(c, W, H, now);
    if (R.cd > 0) { c.save(); c.fillStyle = "rgba(0,0,0,.45)"; c.fillRect(0, 0, W, H); c.fillStyle = "#fff"; c.font = "800 " + H * .4 + "px system-ui,sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(String(R.cd), W / 2, H / 2); c.restore(); }
    frames++; if (now - lastFpsT >= 1000) { R.fps = frames * 1000 / (now - lastFpsT); frames = 0; lastFpsT = now; }
  }
  function mkTicker(fn, ms) { try { var b = new Blob(["var t;onmessage=function(e){clearInterval(t);if(e.data)t=setInterval(function(){postMessage(0)},e.data)}"], { type: "text/javascript" }), u = URL.createObjectURL(b), w = new Worker(u); w.onmessage = fn; w.postMessage(ms); return { stop: function () { w.postMessage(0); w.terminate(); URL.revokeObjectURL(u); } }; } catch (e) { var id = setInterval(fn, ms); return { stop: function () { clearInterval(id); } }; } }
  var lastDraw = 0;
  function tickFn() { var n = performance.now(); if (n - lastDraw < 800 / S.fps) return; /* quá tải: bỏ khung thay vì dồn việc */ lastDraw = n; try { frame(); } catch (e) { } }
  function startPreview() { setSize(); audioInit(); if (!TK) TK = mkTicker(tickFn, Math.round(1000 / S.fps)); R.preview = true; lastFpsT = performance.now(); frames = 0; syncSources(); }
  function stopPreview() { R.preview = false; if (!R.live && TK) { TK.stop(); TK = null; } R.fps = 0; }
  function outStream() {
    setSize(); if (!OUTS) { OUTS = OUT.captureStream(S.fps); }
    var ms = new MediaStream(OUTS.getVideoTracks()); audioInit(); if (ADEST) ADEST.stream.getAudioTracks().forEach(function (t) { ms.addTrack(t); }); return ms;
  }

  /* ---------- ĐẦU RA: cửa sổ phát · WHIP · quay file ---------- */
  function openOutWin() {
    var w = R.ow; if (w && !w.closed) { try { w.focus(); } catch (e) { } return true; }
    if (!R.preview) startPreview(); w = root.open("", "nhipLiveOut", "popup=yes,width=960,height=540"); if (!w) return false; R.ow = w;
    var d = w.document; d.title = "NHỊP – Phát"; d.body.style.cssText = "margin:0;background:#000;overflow:hidden";
    var v = d.createElement("video"); v.autoplay = true; v.muted = !S.out.sound; v.playsInline = true; v.style.cssText = "width:100vw;height:100vh;object-fit:contain;display:block;background:#000"; v.srcObject = R.outStream = outStream();
    d.body.appendChild(v); v.play().catch(function () { }); v.addEventListener("dblclick", function () { if (d.fullscreenElement) d.exitFullscreen(); else if (v.requestFullscreen) v.requestFullscreen(); }); return true;
  }
  async function whipStart(url, token, ms) {
    var pc = new RTCPeerConnection({ iceServers: ICE, bundlePolicy: "max-bundle" }); ms.getTracks().forEach(function (t) { pc.addTransceiver(t, { direction: "sendonly", streams: [ms] }); });
    pc.getSenders().forEach(function (sn) { if (sn.track && sn.track.kind === "video") { try { var p = sn.getParameters(); p.encodings = p.encodings && p.encodings.length ? p.encodings : [{}]; p.encodings[0].maxBitrate = (api.PLAT[S.plat].kbps || 4000) * 1000; sn.setParameters(p).catch(function () { }); } catch (e) { } } });
    var off = await pc.createOffer(); await pc.setLocalDescription(off); await iceDone(pc, 2000);
    var h = { "Content-Type": "application/sdp" }; if (token) h.Authorization = "Bearer " + token;
    var r = await fetch(url, { method: "POST", headers: h, body: pc.localDescription.sdp }); if (!r.ok) { pc.close(); throw new Error("máy chủ trả mã " + r.status); }
    var loc = r.headers.get("Location"); await pc.setRemoteDescription({ type: "answer", sdp: await r.text() }); return { pc: pc, loc: loc ? new URL(loc, url).href : "", tok: token };
  }
  function whipStop(w) { try { w.pc.close(); } catch (e) { } if (w.loc) { var h = {}; if (w.tok) h.Authorization = "Bearer " + w.tok; fetch(w.loc, { method: "DELETE", headers: h }).catch(function () { }); } }
  function recStart(ms) {
    try {
      var mt = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].filter(function (m) { return root.MediaRecorder && MediaRecorder.isTypeSupported(m); })[0];
      var rc = new MediaRecorder(ms, { mimeType: mt, videoBitsPerSecond: (api.PLAT[S.plat].kbps || 4000) * 1000 }); R.chunks = [];
      rc.ondataavailable = function (e) { if (e.data && e.data.size) R.chunks.push(e.data); };
      rc.onstop = function () { var b = new Blob(R.chunks, { type: "video/webm" }); R.chunks = []; var a = D.createElement("a"), d = new Date(); a.href = URL.createObjectURL(b); a.download = "NHIP-live-" + d.toISOString().slice(0, 16).replace(/[-:T]/g, "") + ".webm"; D.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000); };
      rc.start(2000); R.rec = rc;
    } catch (e) { toast("Không quay được file: " + e.message); }
  }
  function recStop() { try { if (R.rec && R.rec.state !== "inactive") R.rec.stop(); } catch (e) { } R.rec = null; }
  function stat() {
    var sel = S.bg.sel.filter(function (id) { return !!paneOf(id); }), op = sel.filter(function (id) { var p = paneOf(id); return p && p.open; }).length;
    return { capOk: CAP.ok, capMode: CAP.mode, selCount: sel.length, openCount: op, camOn: S.cam.on, camFeed: S.cam.feed !== false, camSrc: S.cam.src, linkOk: S.cam.src === "pc" ? !!R.pcCam : R.link === "connected", camFlow: camV().readyState >= 2 && camV().videoWidth > 0, previewOn: R.preview, fps: R.fps, outMode: S.out.mode, whipUrl: S.out.whip, rec: S.out.rec, audioAny: audioAny(), bat: R.info.bat == null ? null : R.info.bat, live: R.live, owClosed: !!(R.ow && R.ow.closed) };
  }
  async function startLive() {
    if (R.live || R.cd) return; audioInit(); var ck = api.checks(stat()); if (!ck.canStart) { toast("Còn " + ck.blockers + " mục bắt buộc chưa đạt."); return; }
    var ms = R.outStream = outStream();
    if (S.out.mode === "window" && !openOutWin()) { toast("Trình duyệt chặn cửa sổ phát — cho phép cửa sổ bật lên cho trang này rồi bấm lại."); return; }
    for (R.cd = 3; R.cd > 0; R.cd--) { paintStatus(); await sleep(1000); } R.cd = 0;
    try { if (S.out.mode === "whip") R.whip = await whipStart(S.out.whip, S.out.tok, ms); } catch (e) { R.whip = null; if (R.ow && !R.ow.closed) try { R.ow.close(); } catch (x) { } toast("WHIP lỗi: " + e.message); render(); return; }
    if (S.out.rec) recStart(ms); R.live = true; R.t0 = Date.now(); keepAwake(true); render(); chip();
  }
  function stopLive() {
    if (!R.live && !R.cd) return; R.live = false; R.cd = 0; if (R.whip) { whipStop(R.whip); R.whip = null; } recStop();
    if (R.ow && !R.ow.closed) try { R.ow.close(); } catch (e) { } R.ow = null; keepAwake(false); if (!R.open) stopPreview(); render(); chip();
  }
  var hms = function (ms) { var s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); s %= 60; return (h ? h + ":" : "") + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0"); };

  /* ---------- GIAO DIỆN ---------- */
  var CSS = ".lc-pn{position:fixed;z-index:2147483000;right:12px;top:56px;width:min(460px,calc(100vw - 24px));max-height:calc(100dvh - 72px);display:flex;flex-direction:column;background:var(--surface,#fff);color:var(--text,#16303a);border:2px solid var(--acc,#12b98b);border-radius:16px;box-shadow:0 18px 50px rgba(0,0,0,.42);font:14px/1.45 system-ui,-apple-system,'Segoe UI',sans-serif;overflow:hidden}.lc-pn.w{width:min(940px,calc(100vw - 24px))}.lc-pn *{box-sizing:border-box}.lc-pn button,.lc-pn select,.lc-pn input,.lc-pn textarea{font:inherit;color:inherit}" +
    ".lc-hd{display:flex;align-items:center;gap:6px;padding:8px 10px;background:var(--surface2,#f1f7f8);border-bottom:1px solid var(--line,#e0eeef);flex:none}.lc-hd>b{flex:1;white-space:nowrap}.lc-ib{border:0;border-radius:9px;min-width:34px;height:34px;background:var(--mint,#eafaf4);cursor:pointer;font-weight:800}.lc-ib:hover{background:var(--acc,#12b98b);color:#fff}" +
    ".lc-seg{display:inline-flex;border:1px solid var(--line,#d7e6e8);border-radius:10px;overflow:hidden}.lc-seg button{border:0;background:transparent;padding:5px 8px;cursor:pointer;font-size:13px;white-space:nowrap}.lc-seg button.on{background:var(--acc,#12b98b);color:#fff;font-weight:800}" +
    ".lc-air{font-weight:800;color:#fff;background:#dc2626;border-radius:99px;padding:2px 10px;font-size:12px;display:none}.lc-air.on{display:inline-block}" +
    ".lc-bd{overflow:auto;-webkit-overflow-scrolling:touch;display:flex;flex-direction:column;min-height:0;flex:1}.lc-pn.w .lc-bd{display:grid;grid-template-columns:1fr 1fr;grid-template-areas:'st pv' 'st ft';grid-template-rows:auto 1fr;align-items:start}.lc-pn.w .lc-st{grid-area:st;overflow:auto;max-height:calc(100dvh - 130px)}.lc-pn.w .lc-pv{grid-area:pv;position:static}.lc-pn.w .lc-ft{grid-area:ft;position:static}" +
    ".lc-pv{padding:8px 10px;background:var(--bg,#f4faf9);position:sticky;top:0;z-index:3;border-bottom:1px solid var(--line,#e0eeef)}.lc-cv{position:relative;margin:0 auto;width:min(100%,calc(var(--vh,40vh)*var(--arn,1.7778)));aspect-ratio:var(--arn,1.7778);background:#000;border-radius:10px;overflow:hidden;touch-action:none}.lc-cv canvas{width:100%;height:100%;display:block}" +
    ".lc-ov{position:absolute;inset:0}.lc-cb{position:absolute;border:2px dashed #fff;outline:1px solid rgba(0,0,0,.5);cursor:move;touch-action:none}.lc-cb i{position:absolute;width:13px;height:13px;margin:-7px 0 0 -7px;border-radius:50%;background:var(--acc,#12b98b);border:2px solid #fff;touch-action:none;z-index:2}.lc-cb i:after{content:'';position:absolute;inset:-9px}.lc-cb i[data-h=nw]{left:0;top:0;cursor:nwse-resize}.lc-cb i[data-h=n]{left:50%;top:0;cursor:ns-resize}.lc-cb i[data-h=ne]{left:100%;top:0;cursor:nesw-resize}.lc-cb i[data-h=e]{left:100%;top:50%;cursor:ew-resize}.lc-cb i[data-h=se]{left:100%;top:100%;cursor:nwse-resize}.lc-cb i[data-h=s]{left:50%;top:100%;cursor:ns-resize}.lc-cb i[data-h=sw]{left:0;top:100%;cursor:nesw-resize}.lc-cb i[data-h=w]{left:0;top:50%;cursor:ew-resize}.lc-cb.bg{border-color:#ffd24a;background:rgba(255,210,74,.08)}.lc-cb.dim{opacity:.4}.lc-bl{position:absolute;left:6px;top:4px;font:700 11px system-ui;color:#fff;background:rgba(0,0,0,.55);border-radius:6px;padding:1px 6px;font-style:normal;pointer-events:none}.lc-bt{position:absolute;left:4px;top:4px;display:flex;gap:4px;z-index:3}.lc-bt button{width:26px;height:26px;border-radius:50%;border:1px solid #fff;background:rgba(0,0,0,.6);color:#fff;font-size:13px;line-height:1;padding:0;cursor:pointer}.lc-tag{position:absolute;left:6px;top:6px;background:rgba(0,0,0,.6);color:#fff;font-size:11px;font-weight:800;border-radius:6px;padding:2px 7px;letter-spacing:.04em}" +
    ".lc-row{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:6px 0}.lc-b{border:1px solid var(--line,#d7e6e8);background:var(--surface,#fff);border-radius:10px;padding:6px 11px;cursor:pointer;min-height:36px}.lc-b:hover{border-color:var(--acc,#12b98b)}.lc-b.on{background:var(--acc,#12b98b);color:#fff!important;border-color:var(--acc,#12b98b);font-weight:700}.lc-b.p{background:var(--acc,#12b98b);color:#fff;border-color:var(--acc,#12b98b);font-weight:800}.lc-b:disabled{opacity:.45;cursor:not-allowed}" +
    ".lc-go{width:100%;min-height:50px;border:0;border-radius:12px;font-weight:900;font-size:16px;letter-spacing:.03em;cursor:pointer;background:#16a34a;color:#fff}.lc-go:disabled{background:#94a3b8;cursor:not-allowed}.lc-go.stop{background:#dc2626}" +
    ".lc-st{padding:4px 10px 12px}.lc-sec{border:1px solid var(--line,#e0eeef);border-radius:12px;margin:8px 0;background:var(--surface,#fff)}.lc-sh{display:flex;align-items:center;gap:8px;padding:9px 10px;cursor:pointer;font-weight:800;user-select:none}.lc-sh span{flex:1}.lc-sh small{font-weight:600;color:var(--muted,#71879b)}.lc-sb{padding:2px 12px 12px;display:none}.lc-sec.on .lc-sb{display:block}.lc-dot{width:10px;height:10px;border-radius:50%;background:#cbd5e1;flex:none}.lc-dot.ok{background:#16a34a}.lc-dot.warn{background:#f59e0b}.lc-dot.bad{background:#dc2626}.lc-ch{transition:transform .15s}.lc-sec.on .lc-ch{transform:rotate(90deg)}" +
    ".lc-mut{color:var(--muted,#71879b);font-size:12.5px;margin:4px 0}.lc-ok{color:#15803d;font-weight:700;margin:4px 0}.lc-err{color:#b91c1c;margin:4px 0;font-size:13px}.lc-lb{display:flex;align-items:center;gap:8px;margin:7px 0;flex-wrap:wrap}.lc-lb>em{font-style:normal;min-width:84px;font-size:13px;color:var(--muted,#71879b)}.lc-lb input[type=range]{flex:1;min-width:110px;accent-color:var(--acc,#12b98b)}.lc-lb b{min-width:44px;text-align:right;font-size:13px}.lc-lb select,.lc-pn input[type=text],.lc-pn input[type=url],.lc-pn input[type=password],.lc-pn textarea{border:1px solid var(--line,#d7e6e8);border-radius:9px;padding:6px 8px;background:var(--bg,#f4faf9);min-width:0}.lc-pn textarea{width:100%;min-height:64px;font-size:11px;word-break:break-all}.lc-pn input[type=text],.lc-pn input[type=url],.lc-pn input[type=password]{flex:1}" +
    ".lc-code{font:800 30px/1.1 ui-monospace,Consolas,monospace;letter-spacing:.12em;text-align:center;padding:8px;background:var(--bg,#f4faf9);border-radius:10px;margin:6px 0;user-select:all}.lc-qr{display:block;margin:6px auto;width:168px;height:168px;image-rendering:pixelated;background:#fff;border-radius:8px;padding:6px}" +
    ".lc-pk{display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid var(--line,#e0eeef);border-radius:10px;margin:5px 0;cursor:pointer}.lc-pk input{width:18px;height:18px;accent-color:var(--acc,#12b98b)}.lc-pk span{flex:1}.lc-pk small{padding:1px 8px;border-radius:99px;background:#e2e8f0;font-size:11px;font-weight:700}.lc-pk small.on{background:#dcfce7;color:#166534}" +
    ".lc-mt{height:7px;background:var(--line,#e0eeef);border-radius:99px;overflow:hidden;flex:1;min-width:60px}.lc-mt i{display:block;height:100%;width:0;background:linear-gradient(90deg,#16a34a,#eab308,#dc2626);transition:width .08s}.lc-ft{padding:8px 10px;border-top:1px solid var(--line,#e0eeef);background:var(--surface2,#f1f7f8);position:sticky;bottom:0;z-index:3}.lc-ck{margin:0 0 8px}.lc-ck summary{cursor:pointer;font-weight:700;font-size:13px}.lc-ck li{list-style:none;margin:3px 0;font-size:13px}.lc-ck ul{margin:4px 0 0;padding:0}.lc-ck .req{color:#b91c1c}.lc-ck .warn{color:#b45309}.lc-ck .ok{color:#15803d}.lc-ck .info{color:var(--muted,#71879b)}" +
    ".lc-dt{margin-top:8px;border-top:1px dashed var(--line,#d7e6e8);padding-top:6px}.lc-dt summary{cursor:pointer;font-weight:700;font-size:13px}.lc-g5{display:grid;grid-template-columns:repeat(5,1fr);gap:5px}.lc-pvv{width:100%;max-height:34vh;background:#000;border-radius:10px;object-fit:contain}" +
    ".lc-chip{position:fixed;left:12px;bottom:14px;z-index:2147483000;background:#dc2626;color:#fff;border-radius:99px;padding:7px 8px 7px 14px;font:800 13px system-ui;display:flex;gap:8px;align-items:center;box-shadow:0 8px 24px rgba(0,0,0,.4)}.lc-chip button{border:0;border-radius:99px;padding:4px 10px;background:rgba(255,255,255,.22);color:#fff;font-weight:800;cursor:pointer}" +
    "@media(max-width:700px){.lc-hd>b{font-size:13px}.lc-seg button{font-size:12px;padding:5px 6px}.lc-pn,.lc-pn.w{left:0;right:0;bottom:0;top:auto;width:100vw;max-height:90dvh;border-radius:16px 16px 0 0;border-width:2px 0 0}.lc-pn.w .lc-bd{display:flex}.lc-pn.w .lc-st{max-height:none}.lc-pn.w .lc-pv{position:sticky}.lc-pn.w .lc-ft{position:sticky}.lc-cv{--vh:28vh}}" +
    ".lc-pn.min .lc-bd{display:none}";
  var CSSX = ".lc-tpl{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:6px 0}.lc-tb{border:1px solid var(--line,#d7e6e8);border-radius:9px;background:transparent;padding:4px;cursor:pointer;font-size:11px;display:flex;flex-direction:column;align-items:center;gap:3px;color:inherit}.lc-tb.on{border-color:var(--acc,#12b98b);box-shadow:0 0 0 2px var(--acc,#12b98b) inset;font-weight:800}.lc-tb canvas{max-width:100%;height:auto;max-height:64px;border-radius:4px}";
  function cssOnce() { if ($("#lcCss")) return; var s = D.createElement("style"); s.id = "lcCss"; s.textContent = CSS + CSSX; D.head.appendChild(s); }
  var SECS = [["1", "Kết nối điện thoại"], ["2", "Nền máy tính — cửa sổ hiển thị phía sau"], ["3", "Camera điện thoại"], ["4", "Âm thanh"], ["5", "Đích phát & hiển thị"]];
  function opt(v, cur, t) { return '<option value="' + v + '"' + (String(v) === String(cur) ? " selected" : "") + ">" + t + "</option>"; }
  function rg(path, label, v, min, max, step, sc, unit) { return '<label class="lc-lb"><em>' + label + '</em><input type="range" data-k="' + path + '" data-sc="' + sc + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + Math.round(v * sc * 100) / 100 + '"><b data-v="' + path + '">' + (Math.round(v * sc * 10) / 10) + unit + "</b></label>"; }
  function ck(path, label, v) { return '<label class="lc-lb"><input type="checkbox" data-k="' + path + '"' + (v ? " checked" : "") + "><span>" + label + "</span></label>"; }
  function dotOf(i) {
    if (i === 0) return S.cam.on ? (R.link === "connected" ? "ok" : R.link === "err" || R.link === "lost" ? "bad" : "warn") : "";
    if (i === 1) return CAP.ok && S.bg.sel.length ? "ok" : "bad"; if (i === 2) return S.cam.on ? "ok" : ""; if (i === 3) return audioAny() ? "ok" : "warn"; return "ok";
  }
  function tplHtml() {
    var F = FXA(), z = api.outSize(S.ar, S.q), a = z[0] / z[1], cw = a >= 1 ? 64 : Math.round(64 * a), ch = a >= 1 ? Math.round(64 / a) : 64;
    var h = '<div class="lc-mut"><b>Khung dựng sẵn</b> · tỉ lệ ' + S.ar + (S.tpl !== "free" ? " · camera & cảnh tự xếp theo khung" : "") + '</div><div class="lc-tpl">', all = [{ id: "free", nm: "Tự do", desc: "Tự kéo/đổi cỡ camera" }].concat(F ? F.list(S.ar) : []);
    all.forEach(function (t) { h += '<button class="lc-tb' + (S.tpl === t.id ? " on" : "") + '" data-a="tpl" data-v="' + t.id + '" title="' + esc(t.desc) + '"><canvas width="' + cw + '" height="' + ch + '" data-tp="' + t.id + '"></canvas><span>' + esc(t.nm) + "</span></button>"; });
    return h + "</div>";
  }
  function paintThumbs() { var F = FXA(); if (!F || !pn) return; $$("[data-tp]", pn).forEach(function (cv) { try { F.thumb(cv.getContext("2d"), cv.width, cv.height, cv.dataset.tp, S.cam.color); } catch (e) { } }); }
  function camSrcHtml() {
    var pc = S.cam.src === "pc", h = '<div class="lc-row"><span class="lc-seg"><button data-a="csrc" data-v="phone" class="' + (!pc ? "on" : "") + '">📱 Điện thoại</button><button data-a="csrc" data-v="pc" class="' + (pc ? "on" : "") + '">💻 Camera máy tính</button></span></div>';
    if (pc) {
      h += '<div class="lc-row"><button class="lc-b' + (R.pcCam ? " on" : "") + '" data-a="pccam">' + (R.pcCam ? "⏹ Tắt camera máy tính" : "▶ Bật camera máy tính") + "</button>";
      if (R.pcDevs && R.pcDevs.length > 1) h += '<select class="lc-b" data-k="cam.dev">' + R.pcDevs.map(function (d) { return opt(d.id, S.cam.dev, esc(d.label)); }).join("") + "</select>";
      h += '</div><div class="lc-mut">Webcam không có tiếng; micro máy tính bật ở bước 4. Nên bật “Lật gương” bên dưới nếu muốn thấy như soi gương.</div>';
    }
    return h;
  }
  function fxHtml() {
    var F = FXA(), P = F ? F.PRESETS : {}, f = S.fx, h = '<div class="lc-dt"><b>✨ Lọc & làm đẹp hình camera</b>' + ck("fx.on", "Bật bộ lọc (xử lý GPU, mượt — không làm giật khung hình)", f.on !== false);
    if (f.on === false) return h + "</div>";
    h += '<div class="lc-row">' + Object.keys(P).map(function (k) { return '<button class="lc-b' + (f.preset === k ? " on" : "") + '" data-a="fxp" data-v="' + k + '">' + P[k].nm + "</button>"; }).join("") + "</div>";
    h += ck("fx.auto", "Tự cân sáng (đổi từ từ, chống tối/ngược sáng)", f.auto) + rg("fx.ev", "Độ sáng (EV)", f.ev, -1, 1, .05, 1, "") + rg("fx.shadow", "Sáng vùng tối", f.shadow, 0, 1, .05, 1, "") + rg("fx.con", "Tương phản", f.con, 0, 1, .05, 1, "") + rg("fx.sat", "Màu sắc", f.sat, -.5, 1, .05, 1, "") + rg("fx.warm", "Ấm ↔ lạnh", f.warm, -1, 1, .05, 1, "") + rg("fx.den", "Khử nhiễu / vỡ hạt", f.den, 0, 1, .05, 1, "") + rg("fx.sharp", "Làm nét", f.sharp, 0, 1, .05, 1, "");
    return h + '<div class="lc-mut">Hình vỡ/mờ khi tối chủ yếu do iPhone tăng ISO + nén. Lọc này khử nhiễu theo thời gian rồi nâng sáng; thêm một đèn bàn phía trước mặt sẽ tốt hơn mọi bộ lọc.</div></div>';
  }
  function fillHtml() {
    var cu = S.cam.img === "custom", off = S.cam.feed === false;
    return '<div class="lc-dt"><b>🖼 Khi tắt camera</b><div class="lc-row"><button class="lc-b' + (off ? "" : " on") + '" data-a="camfeed">' + (off ? "▶ Bật camera lại" : "⏹ Tắt camera (hiện ảnh)") + '</button></div><div class="lc-row"><span class="lc-seg"><button data-a="imgsel" data-v="default" class="' + (!cu ? "on" : "") + '">📈 Ảnh mặc định NHỊP</button><button data-a="imgsel" data-v="custom" class="' + (cu ? "on" : "") + '">🖼 Ảnh của tôi</button></span></div><div class="lc-row"><button class="lc-b" data-a="imgpick">📁 Thêm / đổi ảnh…</button>' + (CUST ? '<button class="lc-b" data-a="imgdel">🗑 Xóa ảnh</button>' : "") + '</div><div class="lc-mut">Ảnh cũng tự hiện thay camera nếu điện thoại mất kết nối giữa lúc đang phát, để khung không bị trống. Có thể bấm 📷 / 🖼 ngay trên khung camera trong ô xem trước.</div></div>';
  }
  function lyHtml() {
    return '<div class="lc-dt"><b>📐 Kéo · co giãn · sắp xếp</b><div class="lc-mut">Trong khung xem trước: kéo <b>thân hộp</b> để di chuyển; kéo chấm ở <b>cạnh</b> để kéo dài/ngắn (ngang hoặc dọc riêng); chấm ở <b>góc</b> để đổi cả hai (giữ Shift hoặc bật khóa để giữ tỉ lệ); lăn chuột để phóng/thu. Chọn hộp cần chỉnh ở dòng “Chỉnh” dưới khung xem trước. Mỗi khung dựng sẵn và mỗi tỉ lệ nhớ vị trí riêng.</div>' + ck("cam.lock", "🔒 Khóa tỉ lệ khi kéo chấm góc (camera)", S.cam.lock) + '<div class="lc-row"><button class="lc-b" data-a="bgfull">⤢ Bảng dữ liệu toàn khung</button><button class="lc-b" data-a="lreset">↺ Đặt lại bố cục này</button></div></div>';
  }
  function s1() {
    var h = "", url = location.origin + "/?livecam=" + R.code;
    if (R.link === "connected") h += '<div class="lc-ok">✅ Điện thoại đã kết nối' + (R.info.w ? " · " + R.info.w + "×" + R.info.h : "") + (R.info.bat != null ? " · pin " + Math.round(R.info.bat * 100) + "%" + (R.info.chg ? " ⚡" : "") : "") + '</div><div class="lc-row"><button class="lc-b" data-a="facing">🔄 Đổi camera trước/sau</button><button class="lc-b" data-a="phmic">' + (R.info.mic === false ? "🔇 Mic điện thoại: tắt" : "🎤 Mic điện thoại: bật") + '</button><button class="lc-b" data-a="unpair">⏏ Ngắt</button></div>';
    else if (!R.code || R.link === "idle") h += '<button class="lc-b p" data-a="pair">🔗 Tạo mã kết nối</button><div class="lc-mut">Trên điện thoại mở cùng trang NHỊP → nút <b>LIVE</b> → hàng cài đặt cuối → <b>📡 Phát live</b> → chọn 📱 và nhập mã (hoặc quét QR).</div>';
    else h += '<div class="lc-code">' + R.code.split("").join(" ") + '</div><canvas class="lc-qr" data-url="' + esc(url) + '" width="168" height="168"></canvas><div class="lc-row"><button class="lc-b" data-a="copylink">⧉ Chép liên kết</button>' + (navigator.share ? '<button class="lc-b" data-a="share">↗ Gửi</button>' : "") + '<button class="lc-b" data-a="pair">↻ Mã mới</button><button class="lc-b" data-a="unpair">✕ Hủy</button></div>';
    h += '<div id="lcLink" class="' + (R.link === "err" || R.link === "lost" ? "lc-err" : "lc-mut") + '">' + esc(R.linkMsg) + "</div>";
    h += '<details class="lc-dt"><summary>Không kết nối được? Ghép thủ công</summary><div class="lc-mut">Dùng khi máy chủ chưa mở “hộp thư” hoặc mạng chặn. Nếu cùng Wi‑Fi mà vẫn không nối, bật micro máy tính một lần (bước 4) để trình duyệt cho phép dùng địa chỉ mạng nội bộ.</div><button class="lc-b" data-a="manualoffer">Tạo mã thủ công</button>' + (R.manual && R.manual.offer ? '<div class="lc-mut">1) Chép mã này sang điện thoại:</div><textarea id="lcMO" readonly>' + esc(R.manual.offer) + '</textarea><button class="lc-b" data-a="copy" data-v="lcMO">⧉ Chép</button><div class="lc-mut">2) Dán mã trả lời từ điện thoại:</div><textarea id="lcMA"></textarea><button class="lc-b p" data-a="manualans">Nối</button>' : "") + "</details>";
    return h;
  }
  function s2() {
    var h = "", ps = panes();
    if (!CAP.ok) h += '<button class="lc-b p" data-a="cap">🖥 Cho phép ghi hình</button><div class="lc-mut">Tick cửa sổ bên dưới, rồi bấm nút này. Trình duyệt hỏi: chọn <b>thẻ (Tab) NHỊP này</b> và bật <b>chia sẻ âm thanh thẻ</b> để giọng đọc AI vào live. Mỗi cửa sổ cần một lần cho phép (Chrome/Edge chỉ ghi đúng cửa sổ đó, kể cả khi bị che).</div>';
    else h += '<div class="lc-ok">✅ Đã cho phép · ' + (CAP.mode === "element" ? "Element Capture (chính xác từng cửa sổ)" : CAP.mode === "region" ? "cắt theo vùng" : "cắt theo tọa độ") + '</div><div class="lc-row"><button class="lc-b" data-a="uncap">Dừng chia sẻ</button></div>';
    h += '<div class="lc-mut" style="margin-top:8px">Chọn cửa sổ hiển thị phía sau (chỉ gồm khung Khung hình và 4 công cụ):</div>';
    ps.forEach(function (p) { var on = S.bg.sel.indexOf(p.id) >= 0; h += '<label class="lc-pk"><input type="checkbox" data-pane="' + p.id + '"' + (on ? " checked" : "") + "><span>" + esc(p.nm) + '</span><small class="' + (p.open ? "on" : "") + '">' + (p.open ? "đang mở" : "đang đóng") + "</small>" + (!p.open ? '<button class="lc-b" data-a="openp" data-v="' + p.id + '">Mở</button>' : "") + "</label>"; });
    var sel = S.bg.sel.filter(function (id) { return !!paneOf(id); });
    h += '<label class="lc-lb"><em>Bố cục</em><select data-k="bg.layout">' + opt("single", S.bg.layout, "Một cửa sổ toàn màn hình (chuyển cảnh)") + opt("split", S.bg.layout, "Chia đôi") + opt("grid", S.bg.layout, "Lưới") + '</select></label><label class="lc-lb"><em>Vừa khung</em><select data-k="bg.fit">' + opt("contain", S.bg.fit, "Giữ nguyên tỉ lệ (có viền)") + opt("cover", S.bg.fit, "Lấp đầy (cắt mép)") + "</select></label>";
    if (S.bg.layout === "single" && sel.length > 1) { h += '<div class="lc-mut">Đang hiển thị phía sau — chạm để chuyển cảnh:</div><div class="lc-row">' + sel.map(function (id) { return '<button class="lc-b' + (id === (sel.indexOf(S.bg.active) >= 0 ? S.bg.active : sel[0]) ? " on" : "") + '" data-a="active" data-v="' + id + '">' + esc(paneOf(id).nm) + "</button>"; }).join("") + '</div><label class="lc-lb"><em>Tự luân phiên</em><select data-k="bg.rot">' + opt(0, S.bg.rot, "Tắt") + opt(10, S.bg.rot, "10 giây") + opt(20, S.bg.rot, "20 giây") + opt(30, S.bg.rot, "30 giây") + opt(60, S.bg.rot, "60 giây") + "</select></label>"; }
    var ap = paneOf(S.bg.active) || paneOf("p1");
    h += '<div class="lc-mut"><b>📺 Khung hình = nền chính</b> · các công cụ = cửa sổ phụ. Mở/bấm công cụ nào thì phát công cụ đó; đóng công cụ, thu nhỏ nó, hoặc bấm lại vào Khung hình thì quay về nền chính.</div>';
    h += ck("bg.follow", "Tự chuyển cảnh theo cửa sổ đang thao tác", S.bg.follow) + ck("bg.pin", "📌 Ghim cảnh hiện tại (tạm dừng tự chuyển)", S.bg.pin);
    h += '<label class="lc-lb"><em>Tự về nền chính</em><select data-k="bg.idle">' + opt(0, S.bg.idle, "Tắt") + opt(15, S.bg.idle, "Sau 15 giây không thao tác") + opt(30, S.bg.idle, "Sau 30 giây") + opt(60, S.bg.idle, "Sau 1 phút") + opt(120, S.bg.idle, "Sau 2 phút") + '</select></label>';
    h += '<div class="lc-row"><button class="lc-b" data-a="home">🏠 Về nền chính ngay</button>' + (ap ? '<span class="lc-mut">Đang phát: <b>' + esc(ap.nm) + "</b> · " + (ap.id === "p1" ? "nền chính" : "cửa sổ phụ") + "</span>" : "") + "</div>";
    h += '<div class="lc-row"><button class="lc-b" data-a="fitwin">📐 Căn cửa sổ công cụ theo tỉ lệ ' + S.ar + '</button><button class="lc-b" data-a="maxp1">⤢ Phóng lớn Khung hình</button></div>';
    return h;
  }
  function s3() {
    var h = tplHtml() + ck("cam.on", "Hiển thị khung camera trong live", S.cam.on) + camSrcHtml() + (S.cam.on ? fillHtml() : "");
    if (!S.cam.on) return h; var v = vAr(), fr = S.tpl === "free";
    if (fr) h += rg("cam.w", S.cam.shape === "free" ? "Chiều ngang" : "Kích thước", S.cam.w, 8, 100, 1, 100, "%") + (S.cam.shape === "free" ? rg("cam.h", "Chiều cao", S.cam.h > 0 ? S.cam.h : S.cam.w * 9 / 16 * OUT.width / OUT.height, 6, 100, 1, 100, "%") : "") + '<label class="lc-lb"><em>Hình dạng</em><select data-k="cam.shape">' + opt("auto", S.cam.shape, "Theo hình camera") + opt("free", S.cam.shape, "Tự do (kéo cạnh: cao/thấp, ngang/dọc)") + opt("16:9", S.cam.shape, "Ngang 16:9") + opt("9:16", S.cam.shape, "Dọc 9:16") + opt("4:3", S.cam.shape, "4:3") + opt("square", S.cam.shape, "Vuông") + opt("circle", S.cam.shape, "Tròn") + "</select></label>";
    if (fr && S.cam.shape !== "circle") h += rg("cam.radius", "Bo góc", S.cam.radius, 0, 50, 1, 100, "%");
    h += rg("cam.zoom", "Phóng hình", S.cam.zoom, 1, 3, .05, 1, "×") + rg("cam.border", "Viền", S.cam.border, 0, 12, 1, 1, "px") + '<label class="lc-lb"><em>Màu viền</em><input type="color" data-k="cam.color" value="' + S.cam.color + '"></label>' + ck("cam.mirror", "Lật gương (như soi gương)", S.cam.mirror);
    if (fr) h += '<div class="lc-mut">Vị trí nhanh:</div><div class="lc-g5"><button class="lc-b" data-a="camp" data-v="tl">⬉</button><button class="lc-b" data-a="camp" data-v="tc">⬆</button><button class="lc-b" data-a="camp" data-v="tr">⬈</button><button class="lc-b" data-a="camp" data-v="cc">⊙</button><button class="lc-b" data-a="camp" data-v="bl">⬋</button><button class="lc-b" data-a="camp" data-v="bc">⬇</button><button class="lc-b" data-a="camp" data-v="br">⬊</button></div><div class="lc-mut">Hoặc <b>kéo hộp nét đứt</b> trong khung xem trước để đặt tự do, <b>kéo chấm tròn</b> ở góc để đổi cỡ, <b>lăn chuột</b> để phóng to/thu nhỏ.</div>';
    return h + lyHtml() + fxHtml();
  }
  function s4() {
    var rows = [["page", "🖥 Âm thanh trang (giọng đọc AI)", CAP.audio ? "" : "cần chọn “chia sẻ âm thanh thẻ” ở bước 2"], ["ph", "📱 Micro điện thoại", N.ph ? "" : "chờ kết nối"], ["pc", "🎤 Micro máy tính", ""]];
    return rows.map(function (r) { var k = r[0]; return '<div class="lc-lb">' + '<label style="display:flex;gap:6px;align-items:center;flex:1;min-width:160px"><input type="checkbox" data-k="aud.' + k + '.on"' + (S.aud[k].on ? " checked" : "") + ">" + r[1] + '</label><div class="lc-lb" style="width:100%;margin:0"><em></em><input type="range" data-k="aud.' + k + '.v" data-sc="100" min="0" max="150" step="5" value="' + Math.round(S.aud[k].v * 100) + '"><b data-v="aud.' + k + '.v">' + Math.round(S.aud[k].v * 100) + '%</b><span class="lc-mt"><i data-m="' + k + '"></i></span></div>' + (r[2] ? '<div class="lc-mut" style="width:100%;margin:0">' + r[2] + "</div>" : "") + "</div>"; }).join("") + '<div class="lc-mut">Mẹo: dùng tai nghe để micro không thu lại tiếng loa (vang).</div>';
  }
  function s5() {
    var P = api.PLAT, h = '<div class="lc-row">' + Object.keys(P).map(function (k) { return '<button class="lc-b' + (S.plat === k ? " on" : "") + '" data-a="plat" data-v="' + k + '">' + P[k].ic + " " + P[k].nm + "</button>"; }).join("") + "</div>";
    var z = api.outSize(S.ar, S.q), lk = R.live ? " disabled" : "";
    h += '<label class="lc-lb"><em>Tỉ lệ</em><select data-k="ar"' + lk + ">" + opt("16:9", S.ar, "Ngang 16:9") + opt("9:16", S.ar, "Dọc 9:16") + opt("1:1", S.ar, "Vuông 1:1") + opt("4:5", S.ar, "4:5") + '</select></label><label class="lc-lb"><em>Chất lượng</em><select data-k="q"' + lk + ">" + opt(540, S.q, "540p (nhẹ)") + opt(720, S.q, "720p") + opt(1080, S.q, "1080p") + '</select><b>' + z[0] + "×" + z[1] + '</b></label><label class="lc-lb"><em>Khung/giây</em><select data-k="fps"' + lk + ">" + opt(24, S.fps, "24") + opt(30, S.fps, "30") + opt(60, S.fps, "60 (nặng)") + "</select></label>";
    h += '<div class="lc-mut" style="margin-top:8px"><b>Đưa hình lên đâu?</b></div><label class="lc-pk"><input type="radio" name="lcm" data-mode="window"' + (S.out.mode === "window" ? " checked" : "") + "><span>🪟 Cửa sổ phát sạch — chia sẻ vào trang live / OBS</span></label><label class=\"lc-pk\"><input type=\"radio\" name=\"lcm\" data-mode=\"whip\"" + (S.out.mode === "whip" ? " checked" : "") + "><span>🌐 WHIP — đẩy WebRTC thẳng lên máy chủ</span></label><label class=\"lc-pk\"><input type=\"radio\" name=\"lcm\" data-mode=\"none\"" + (S.out.mode === "none" ? " checked" : "") + "><span>💾 Chỉ quay file (phát thử)</span></label>";
    if (S.out.mode === "window") h += ck("out.sound", "Có tiếng trong cửa sổ phát (dùng khi chia sẻ cả tab; nhớ dùng tai nghe)", S.out.sound) + '<div class="lc-row"><button class="lc-b" data-a="ow">🪟 Mở cửa sổ phát để chọn trước trong trang live</button></div>';
    if (S.out.mode === "whip") h += '<label class="lc-lb"><em>WHIP URL</em><input type="url" data-k="out.whip" value="' + esc(S.out.whip) + '" placeholder="https://…/whip"></label><label class="lc-lb"><em>Token</em><input type="password" data-k="out.tok" value="' + esc(S.out.tok) + '" placeholder="(nếu có)" autocomplete="off"></label><div class="lc-mut">Khóa/token chỉ nằm trong bộ nhớ trang, không được lưu lại.</div>';
    h += ck("out.rec", "Quay file .webm trên máy này khi phát", S.out.rec);
    h += '<details class="lc-dt"><summary>Hướng dẫn cho ' + esc(P[S.plat].nm) + '</summary><ul style="padding-left:18px;margin:6px 0">' + P[S.plat].how.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + '</ul><div class="lc-mut">Giao diện từng nền tảng có thể đổi theo thời gian; luôn đối chiếu hướng dẫn mới nhất của họ.</div></details>';
    h += '<div class="lc-dt"><b>Chữ trên hình</b>' + ck("badge", "Huy hiệu ● LIVE khi đang phát", S.badge) + ck("title.on", "Thanh tiêu đề phía dưới", S.title.on) + (S.title.on ? '<label class="lc-lb"><em>Tiêu đề</em><input type="text" data-k="title.t" value="' + esc(S.title.t) + '" maxlength="80"></label><label class="lc-lb"><em>Dòng phụ</em><input type="text" data-k="title.s" value="' + esc(S.title.s) + '" maxlength="100"></label>' : "") + "</div>";
    return h;
  }
  function ftHtml() {
    var c = api.checks(stat()), h = '<details class="lc-ck" id="lcCk"' + (R.ck ? " open" : "") + "><summary>" + (c.blockers ? "⚠ Còn " + c.blockers + " mục bắt buộc" : "✅ Sẵn sàng phát") + " · kiểm tra trước khi phát</summary><ul>" + c.items.map(function (i) { return '<li class="' + i.lv + '">' + (i.lv === "ok" ? "✔" : i.lv === "req" ? "✖" : i.lv === "warn" ? "▲" : "ℹ") + " " + esc(i.t) + "</li>"; }).join("") + "</ul></details>";
    if (R.live) h += '<button class="lc-go stop" data-a="stop">■ DỪNG PHÁT · ' + hms(Date.now() - R.t0) + "</button>";
    else if (R.cd > 0) h += '<button class="lc-go" disabled>Bắt đầu sau ' + R.cd + "…</button>";
    else h += '<button class="lc-go" data-a="start"' + (c.canStart ? "" : " disabled") + ">▶ BẮT ĐẦU PHÁT</button>";
    if (R.msg) h += '<div class="lc-err" style="margin-top:6px">' + esc(R.msg) + "</div>"; return h;
  }
  function pcBody() {
    var z = api.outSize(S.ar, S.q), pv = '<div class="lc-pv"><div class="lc-cv" id="lcCv" style="--arn:' + (z[0] / z[1]) + '"><div class="lc-ov" id="lcOv"></div><span class="lc-tag">' + (R.live ? "● ĐANG PHÁT" : R.preview ? "XEM TRƯỚC" : "TẮT") + '</span></div><div class="lc-row" style="justify-content:space-between"><button class="lc-b' + (R.preview ? " on" : "") + '" data-a="pv">' + (R.preview ? "👁 Xem trước: BẬT" : "👁 Bật xem trước") + '</button><span class="lc-mut" id="lcStat"></span></div><div class="lc-row"><span class="lc-seg"><button data-a="edit" data-v="cam" class="' + (R.edit !== "bg" ? "on" : "") + '">✋ Chỉnh: 📷 Camera</button><button data-a="edit" data-v="bg" class="' + (R.edit === "bg" ? "on" : "") + '">🗂 Bảng dữ liệu</button></span><button class="lc-b" data-a="lreset" title="Đặt lại vị trí và kích thước">↺ Đặt lại</button></div></div>';
    var st = '<div class="lc-st">' + [s1, s2, s3, s4, s5].map(function (f, i) { var id = String(i + 1); return '<div class="lc-sec' + (R.sec[id] ? " on" : "") + '"><div class="lc-sh" data-a="sec" data-v="' + id + '"><i class="lc-dot ' + dotOf(i) + '"></i><span>' + id + " · " + SECS[i][1] + '</span><small class="lc-ch">▸</small></div><div class="lc-sb">' + f() + "</div></div>"; }).join("") + "</div>";
    return pv + st + '<div class="lc-ft" id="lcFt">' + ftHtml() + "</div>";
  }
  function phoneBody() {
    var h = '<div class="lc-st" style="padding-top:8px"><video id="lcPv" class="lc-pvv" muted playsinline autoplay></video>';
    if (!R.local) h += '<div class="lc-row"><button class="lc-b p" data-a="phcam">📷 Bật camera điện thoại</button></div>';
    else h += '<div class="lc-row"><button class="lc-b" data-a="phfacing">🔄 ' + (R.facing === "user" ? "Đang dùng camera trước" : "Đang dùng camera sau") + '</button><button class="lc-b' + (R.mic ? " on" : "") + '" data-a="phmic2">' + (R.mic ? "🎤 Mic bật" : "🔇 Mic tắt") + '</button><select data-pq class="lc-b">' + opt("720", R.q || "720", "720p") + opt("1080", R.q || "720", "1080p") + "</select></div>";
    h += '<div class="lc-lb"><em>Mã từ máy tính</em><input type="text" id="lcCode" value="' + esc(R.code) + '" maxlength="6" placeholder="K7P2QM" style="text-transform:uppercase;letter-spacing:.2em;font-weight:800"><button class="lc-b p" data-a="phjoin">Kết nối</button></div>';
    h += '<div id="lcLink" class="' + (R.link === "err" || R.link === "lost" ? "lc-err" : R.link === "connected" ? "lc-ok" : "lc-mut") + '">' + (R.link === "connected" ? "✅ Đang gửi hình cho máy tính. Giữ màn hình sáng, đừng khóa máy hay chuyển ứng dụng." : esc(R.linkMsg || "Bật camera, rồi nhập mã hiển thị trên máy tính (bước 1) hoặc quét QR.")) + "</div>";
    h += '<details class="lc-dt"><summary>Ghép thủ công</summary><div class="lc-mut">Dán mã do máy tính tạo:</div><textarea id="lcPO"></textarea><button class="lc-b" data-a="phmanual">Tạo mã trả lời</button>' + (R.manual && R.manual.answer ? '<textarea id="lcPA" readonly>' + esc(R.manual.answer) + '</textarea><button class="lc-b" data-a="copy" data-v="lcPA">⧉ Chép sang máy tính</button>' : "") + "</details>";
    return h + '<div class="lc-row"><button class="lc-b" data-a="phstop">⏏ Ngắt kết nối</button></div></div>';
  }
  function drawQR(cv, text) { var q = api.qrMatrix(text); if (!q || !cv) return; var c = cv.getContext("2d"), px = Math.floor(cv.width / (q.n + 2)); c.fillStyle = "#fff"; c.fillRect(0, 0, cv.width, cv.height); c.fillStyle = "#000"; var o = Math.floor((cv.width - px * q.n) / 2); for (var y = 0; y < q.n; y++) for (var x = 0; x < q.n; x++) if (q.m[y][x]) c.fillRect(o + x * px, o + y * px, px, px); }
  var HND = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
  function rectGet(kind) { var T = lay(); return kind === "bg" ? T.bg : T.cam; }
  function rectSet(kind, r, how) {
    var W = OUT.width, H = OUT.height, rd = function (v) { return Math.round(v * 10000) / 10000; };
    if (kind === "cam" && S.tpl === "free") {
      if (how === "resize" && Math.abs((r.w / r.h) / api.camAr(S.cam.shape, vAr()) - 1) > .02) S.cam.shape = "free";
      S.cam.cx = rd((r.x + r.w / 2) / W); S.cam.cy = rd((r.y + r.h / 2) / H); S.cam.w = rd(r.w / W); S.cam.h = rd(r.h / H);
    } else { var k = ovKey(), o = S.ov[k] || (S.ov[k] = {}); o[kind] = [rd(r.x / W), rd(r.y / H), rd(r.w / W), rd(r.h / H)]; }
  }
  function syncSl() { [["cam.w", S.cam.w], ["cam.h", S.cam.h]].forEach(function (q) { var sl = $('[data-k="' + q[0] + '"]'); if (sl && q[1] > 0) { sl.value = Math.round(q[1] * 100); var b = $('[data-v="' + q[0] + '"]'); if (b) b.textContent = Math.round(q[1] * 100) + "%"; } }); }
  function mkBox(kind) {
    var bx = D.createElement("div"); bx.className = "lc-cb " + kind; bx.dataset.kind = kind;
    bx.innerHTML = HND.map(function (h) { return '<i data-h="' + h + '"></i>'; }).join("") + (kind === "cam" ? '<span class="lc-bt"><button data-a="camfeed"></button><button data-a="imgpick" title="Thêm / đổi ảnh hiện khi tắt camera">🖼</button></span>' : '<em class="lc-bl">🗂 Bảng dữ liệu</em>');
    return bx;
  }
  function dragBox(bx, cv) {
    var kind = bx.dataset.kind, d = null;
    bx.addEventListener("pointerdown", function (e) {
      if (e.target.closest("button")) return; var hn = e.target.closest("[data-h]"), rc = cv.getBoundingClientRect(), r0 = rectGet(kind);
      d = { hd: hn ? hn.dataset.h : "move", x: e.clientX, y: e.clientY, kx: OUT.width / rc.width, ky: OUT.height / rc.height, r0: { x: r0.x, y: r0.y, w: r0.w, h: r0.h } };
      try { bx.setPointerCapture(e.pointerId); } catch (x) { } e.preventDefault(); e.stopPropagation();
    });
    bx.addEventListener("pointermove", function (e) {
      if (!d) return; var W = OUT.width, H = OUT.height, dx = (e.clientX - d.x) * d.kx, dy = (e.clientY - d.y) * d.ky, mn = Math.max(24, Math.min(W, H) * .06), cor = d.hd.length === 2, lk = cor && (e.shiftKey || (kind === "cam" && S.cam.lock)), r;
      if (d.hd === "move") r = api.moveRect(d.r0, dx, dy, W, H); else r = api.resizeRect(d.r0, d.hd, dx, dy, W, H, { min: mn, ar: lk ? d.r0.w / d.r0.h : 0 });
      rectSet(kind, r, d.hd === "move" ? "move" : lk ? "scale" : "resize"); posBox(); syncSl();
    });
    var up = function () { if (!d) return; d = null; save(); if (S.cam.shape === "free" && S.cam.on && !$('[data-k="cam.h"]') && S.tpl === "free") render(); };
    bx.addEventListener("pointerup", up); bx.addEventListener("pointercancel", up);
  }
  function mountOv() {
    var cv = $("#lcCv"); if (!cv) return; cv.insertBefore(OUT, cv.firstChild); var ov = $("#lcOv"); if (!ov) return;
    var bb = mkBox("bg"), bx = mkBox("cam"); ov.appendChild(bb); ov.appendChild(bx); R.bx = bx; R.bb = bb; dragBox(bb, cv); dragBox(bx, cv); posBox();
    cv.addEventListener("wheel", function (e) {
      var kind = R.edit === "bg" ? "bg" : "cam"; if (kind === "cam" && !S.cam.on) return; e.preventDefault();
      var W = OUT.width, H = OUT.height, mn = Math.max(24, Math.min(W, H) * .06), r = rectGet(kind), f = e.deltaY < 0 ? 1.04 : 1 / 1.04, nw = Math.min(W, Math.max(mn, r.w * f)), nh = Math.min(H, Math.max(mn, r.h * f));
      rectSet(kind, { x: clamp(r.x + (r.w - nw) / 2, 0, W - nw), y: clamp(r.y + (r.h - nh) / 2, 0, H - nh), w: nw, h: nh }, "scale"); posBox(); syncSl(); save();
    }, { passive: false });
  }
  function posBox() {
    var bx = R.bx, bb = R.bb; if (!bx || !bx.isConnected) return; var T = lay(), W = OUT.width, H = OUT.height, ed = R.edit === "bg" ? "bg" : "cam";
    var put = function (b, r) { b.style.left = (r.x / W * 100) + "%"; b.style.top = (r.y / H * 100) + "%"; b.style.width = (r.w / W * 100) + "%"; b.style.height = (r.h / H * 100) + "%"; };
    if (!S.cam.on) bx.style.display = "none";
    else {
      var r = T.cam; bx.style.display = "block"; put(bx, r); bx.style.borderRadius = T.free ? (S.cam.shape === "circle" ? "50%" : (S.cam.radius * 100) + "%") : (T.rad * Math.min(r.w, r.h) / r.w * 100) + "%";
      bx.classList.toggle("dim", ed !== "cam"); bx.style.pointerEvents = ed === "cam" ? "" : "none";
      var fb = bx.querySelector('[data-a="camfeed"]'); if (fb) { fb.textContent = S.cam.feed === false ? "🚫" : "📷"; fb.title = S.cam.feed === false ? "Camera đang tắt — bấm để bật" : "Tắt camera (hiện ảnh)"; }
    }
    if (bb) { if (ed === "bg" && (T.free || S.cam.on)) { bb.style.display = "block"; put(bb, T.bg); } else bb.style.display = "none"; }
  }
  var pn = null;
  function render() {
    if (!R.open) return; cssOnce(); var scr = pn && $(".lc-bd", pn) ? $(".lc-bd", pn).scrollTop : 0, sst = pn && $(".lc-st", pn) ? $(".lc-st", pn).scrollTop : 0;
    if (!pn) { pn = D.createElement("div"); pn.id = "lcPanel"; pn.addEventListener("click", onClick); pn.addEventListener("input", onInput); pn.addEventListener("change", onChange); D.body.appendChild(pn); }
    pn.className = "lc-pn" + (R.wide ? " w" : "") + (R.min ? " min" : ""); pn.dataset.role = R.role;
    var hd = '<div class="lc-hd"><b>📡 Phát live</b><span class="lc-air' + (R.live ? " on" : "") + '" id="lcAir">● ' + (R.live ? hms(Date.now() - R.t0) : "") + '</span><span class="lc-seg"><button data-a="role" data-v="pc" class="' + (R.role === "pc" ? "on" : "") + '">💻 Máy tính</button><button data-a="role" data-v="phone" class="' + (R.role === "phone" ? "on" : "") + '">📱 Điện thoại</button></span>' + (R.role === "pc" ? '<button class="lc-ib" data-a="wide" title="Mở rộng / thu hẹp bảng">⤢</button>' : "") + '<button class="lc-ib" data-a="min" title="Thu gọn">▁</button><button class="lc-ib" data-a="x" title="Đóng">✕</button></div>';
    pn.innerHTML = hd + '<div class="lc-bd">' + (R.role === "pc" ? pcBody() : phoneBody()) + "</div>";
    if (R.role === "pc") { mountOv(); $$(".lc-qr", pn).forEach(function (c) { drawQR(c, c.dataset.url); }); } else { var pv = $("#lcPv"); if (pv && R.local) { pv.srcObject = R.local; pv.play().catch(function () { }); } }
    var b = $(".lc-bd", pn); if (b) b.scrollTop = scr; var s = $(".lc-st", pn); if (s) s.scrollTop = sst; pads(); paintThumbs();
  }
  function pads() { var bd = pn && $(".lc-bd", pn); if (!bd) return; var pv = $(".lc-pv", pn), ft = $(".lc-ft", pn), w = R.wide && root.innerWidth > 700; bd.style.scrollPaddingTop = (!w && pv ? pv.offsetHeight + 8 : 0) + "px"; bd.style.scrollPaddingBottom = (!w && ft ? ft.offsetHeight + 8 : 0) + "px"; }
  function paintStatus() {
    if (!pn || !R.open) return;
    pads(); var air = $("#lcAir", pn); if (air) { air.classList.toggle("on", R.live); air.textContent = "● " + (R.live ? hms(Date.now() - R.t0) : ""); }
    var ft = $("#lcFt", pn); if (ft && R.role === "pc") { var html = ftHtml(); if (ft.dataset.h !== html) { ft.dataset.h = html; ft.innerHTML = html; var d = $("#lcCk", ft); if (d) d.addEventListener("toggle", function () { R.ck = d.open; }); } }
    var lk = $("#lcLink", pn); if (lk && R.role === "pc") lk.textContent = R.linkMsg;
    var st = $("#lcStat", pn); if (st) st.textContent = R.preview ? Math.round(R.fps) + " fps · " + OUT.width + "×" + OUT.height + (R.info.bat != null ? " · 📱 " + Math.round(R.info.bat * 100) + "%" : "") : "";
    $$("[data-m]", pn).forEach(function (e) { e.style.width = Math.round(level(e.dataset.m) * 100) + "%"; });
  }
  function chip() {
    var c = $("#lcChip"); if (!R.live || R.open) { if (c) c.remove(); return; } cssOnce();
    if (!c) { c = D.createElement("div"); c.id = "lcChip"; c.className = "lc-chip"; c.innerHTML = '<span id="lcChT">● ĐANG PHÁT</span><button data-c="open">Mở bảng</button><button data-c="stop">Dừng</button>'; c.addEventListener("click", function (e) { var k = e.target.dataset.c; if (k === "open") openPanel(); else if (k === "stop") stopLive(); }); D.body.appendChild(c); }
    $("#lcChT", c).textContent = "● ĐANG PHÁT " + hms(Date.now() - R.t0);
  }
  function setPath(path, val) {
    if (!/^(tpl|fx\.[a-z]+|(cam|bg|title)\.[a-z]+|aud\.(page|pc|ph)\.(on|v)|out\.(whip|tok|rec|sound|mode)|badge|ar|q|fps)$/.test(path)) return; var p = path.split("."), o = S, i; for (i = 0; i < p.length - 1; i++) o = o[p[i]]; o[p[p.length - 1]] = val;
    if (p[0] === "aud") applyGain(); if (path === "ar" || path === "q") { setSize(); OUTS = null; } if (path === "fps") { if (TK) { TK.stop(); TK = null; if (R.preview || R.live) TK = mkTicker(tickFn, Math.round(1000 / S.fps)); } OUTS = null; }
    if (path === "bg.rot") rotTimer(); save();
  }
  function onInput(e) { var t = e.target, k = t.dataset.k; if (!k || t.type !== "range") return; var sc = +t.dataset.sc || 1, v = +t.value / sc; setPath(k, v); var b = $('[data-v="' + k + '"]', pn); if (b) b.textContent = (k.indexOf("aud.") === 0 ? Math.round(v * 100) + "%" : k === "cam.w" || k === "cam.radius" ? Math.round(v * 100) + "%" : k === "cam.zoom" ? v.toFixed(2) + "×" : k.indexOf("fx.") === 0 ? v.toFixed(2) : v + "px");
    if (k.indexOf("fx.") === 0) S.fx.preset = "custom"; posBox(); }
  function onChange(e) {
    var t = e.target, k = t.dataset.k;
    if (t.dataset.pane) {
      var id = t.dataset.pane, i = S.bg.sel.indexOf(id);
      if (R.auto) delete R.auto[id];
      if (t.checked && i < 0) {
        S.bg.sel.push(id); if (!S.bg.active || S.bg.sel.length === 1) S.bg.active = id; save(); var p = paneOf(id);
        if (p && !p.open && L()) { if (id === "p1") root.NHIPLiveRoom.open(); else root.NHIPLiveRoom.tool(id, { keep: 1 }); }
        render(); if (CAP.ok) setTimeout(function () { syncSources().then(render); }, 250);
      } else if (!t.checked && i >= 0) { S.bg.sel.splice(i, 1); dropSource(id); save(); render(); }
      return;
    }
    if (t.dataset.mode) { setPath("out.mode", t.dataset.mode); render(); return; } if (t.dataset.pq != null) { R.q = t.value; if (R.local) phoneCam(R.facing, true); ctl({ t: "q", v: t.value }); return; }
    if (k === "cam.dev") { S.cam.dev = t.value; save(); if (R.pcCam) pcCamOn(t.value); return; }
    if (k === "cam.on" && S.cam.src === "pc") { S.cam.on = !!t.checked; save(); if (S.cam.on) pcCamOn(S.cam.dev); else { pcCamOff(); render(); } return; }
    if (!k) return; if (t.type === "range") return; var v = t.type === "checkbox" ? t.checked : t.type === "color" || t.type === "text" || t.type === "url" || t.type === "password" ? t.value : (/^(q|fps|bg\.rot|bg\.idle)$/.test(k) ? +t.value : t.value);
    if (k === "aud.pc.on") { setPcMic(!!v); return; } if (k === "bg.layout" && v !== "single" && CAP.mode === "element") { releaseCapture(); toast("Nhiều cửa sổ cùng lúc dùng ghi theo vùng: bấm “Cho phép ghi hình” lại và xếp các cửa sổ không chồng nhau."); }
    setPath(k, v); if (t.type === "text" || t.type === "url" || t.type === "password") return; render();
  }
  /* ---------- TỰ CHUYỂN CẢNH THEO CỬA SỔ ĐANG THAO TÁC ---------- */
  /* Nền chính = "Khung hình" (p1). Công cụ = cửa sổ phụ: mở/bấm → phát công cụ đó; đóng/thu nhỏ hết hoặc bấm về Khung hình → quay về nền chính. */
  var seenOpen = null, lastAct = performance.now(), HOME = "p1";
  function boxOf(p) { if (!p || !p.el || !p.el.closest) return p && p.el || null; return p.id === HOME ? (p.el.closest("#nlWin") || p.el) : (p.el.closest(".lv-tw") || p.el); }
  function shown(p) { if (!p || !p.open) return false; var b = boxOf(p); return !(b && b.classList && b.classList.contains("lv-min")); }
  function followTo(id, force) {
    if (!(R.preview || R.live) || S.bg.layout !== "single") return; if (!force && (!S.bg.follow || S.bg.pin)) return; lastAct = performance.now();
    if (S.bg.sel.indexOf(id) < 0) { S.bg.sel.push(id); if (id !== HOME) (R.auto || (R.auto = {}))[id] = 1; }
    if (S.bg.active === id) return; S.bg.active = id; save(); var cf = L(); if (cf && cf.front && CAP.mode !== "element") cf.front(id); if (CAP.ok && CAP.mode !== "element") syncSources(); if (R.open) render();
  }
  function paneAt(t) {
    var ps = panes().filter(function (p) { return p.open; }), i, b, hp = null;
    for (i = 0; i < ps.length; i++) { if (ps[i].id === HOME) { hp = ps[i]; continue; } b = boxOf(ps[i]); if (b && b.contains(t)) return ps[i]; }
    b = boxOf(hp); if (b && b.contains(t) && !(t.closest && t.closest("#nlTools"))) return hp; return null;
  }
  function onTouchPane(e) {
    if (!(R.preview || R.live)) return; if (pn && pn.contains(e.target)) return; var p = paneAt(e.target); if (!p) return;
    if (p.id === S.bg.active) { lastAct = performance.now(); return; } followTo(p.id);
  }
  D.addEventListener("pointerdown", onTouchPane, true); D.addEventListener("focusin", onTouchPane, true);
  ["wheel", "keydown", "input"].forEach(function (ev) { D.addEventListener(ev, function (e) { var b = boxOf(paneOf(S.bg.active)); if (b && e.target && b.contains && b.contains(e.target)) lastAct = performance.now(); }, true); });
  function bestPane(ps) {
    var best = null, bz = -1; ps.forEach(function (p) { if (p.id === HOME || !shown(p)) return; var b = boxOf(p), z = b ? (+b.style.zIndex || 0) : 0; if (z > bz) { bz = z; best = p.id; } });
    if (best) return best; if (shown(paneOf(HOME))) return HOME; var any = ps.filter(shown)[0]; return any ? any.id : HOME;
  }
  function followTick() {
    var ps = panes(), open = ps.filter(function (p) { return p.open; }).map(function (p) { return p.id; }); if (seenOpen === null) { seenOpen = open; return; }
    Object.keys(R.auto || {}).forEach(function (id) { if (open.indexOf(id) < 0 && S.bg.active !== id) { var i = S.bg.sel.indexOf(id); if (i >= 0) { S.bg.sel.splice(i, 1); dropSource(id); save(); if (R.open) render(); } delete R.auto[id]; } });
    if (S.bg.follow && !S.bg.pin && S.bg.layout === "single" && (R.preview || R.live)) {
      var nw = open.filter(function (id) { return seenOpen.indexOf(id) < 0 && id !== HOME; });
      if (nw.length) followTo(nw[nw.length - 1]);
      else if (!shown(paneOf(S.bg.active))) followTo(bestPane(ps), 1);
      else if (+S.bg.idle > 0 && S.bg.active !== HOME && shown(paneOf(HOME)) && performance.now() - lastAct > S.bg.idle * 1000) followTo(HOME);
    }
    seenOpen = open;
  }
  var rotT = null; function rotTimer() { clearInterval(rotT); rotT = null; if (+S.bg.rot > 0) rotT = setInterval(function () { var ids = S.bg.sel.filter(function (id) { return !!paneOf(id); }); if (S.bg.layout !== "single" || ids.length < 2 || !(R.preview || R.live)) return; var i = ids.indexOf(S.bg.active); S.bg.active = ids[(i + 1) % ids.length]; if (R.open) render(); }, +S.bg.rot * 1000); }
  function onClick(e) {
    var b = e.target.closest("[data-a]"); if (!b || b.disabled) return; var a = b.dataset.a, v = b.dataset.v;
    if (a === "x") closePanel(); else if (a === "min") { R.min = !R.min; render(); } else if (a === "wide") { R.wide = !R.wide; render(); } else if (a === "role") { R.role = v; render(); if (v === "pc" && CAP.ok && !R.preview) startPreview(); }
    else if (a === "sec") { R.sec[v] = !R.sec[v]; render(); } else if (a === "pair") pcPair(); else if (a === "unpair") { closePair(); R.code = ""; R.manual = null; setLink("idle", ""); }
    else if (a === "copylink") copyTxt(location.origin + "/?livecam=" + R.code); else if (a === "share") { navigator.share({ title: "NHỊP – Camera điện thoại", url: location.origin + "/?livecam=" + R.code }).catch(function () { }); }
    else if (a === "facing") ctl({ t: "facing", v: R.info.facing === "environment" ? "user" : "environment" }); else if (a === "phmic") ctl({ t: "mic", v: R.info.mic === false });
    else if (a === "manualoffer") pcManualOffer(); else if (a === "manualans") pcManualAnswer(($("#lcMA") || {}).value); else if (a === "copy") copyTxt(($("#" + v) || {}).value);
    else if (a === "cap") enableCapture(); else if (a === "uncap") { releaseCapture(); if (R.live) stopLive(); render(); }
    else if (a === "openp") { if (v === "p1") root.NHIPLiveRoom.open(); else root.NHIPLiveRoom.tool(v, { keep: 1 }); setTimeout(function () { syncSources().then(render); }, 200); render(); }
    else if (a === "active") { S.bg.active = v; save(); var cf = L(); if (cf && cf.front) cf.front(v); render(); }
    else if (a === "tpl") { S.tpl = v; save(); posBox(); render(); }
    else if (a === "csrc") { if (v === "pc") { S.cam.src = "pc"; save(); if (S.cam.on && S.cam.feed !== false) pcCamOn(S.cam.dev); else render(); } else { pcCamOff(); S.cam.src = "phone"; save(); render(); } }
    else if (a === "pccam") { if (R.pcCam) { pcCamOff(); S.cam.feed = false; save(); render(); } else pcCamOn(S.cam.dev); }
    else if (a === "fxp") { var pp = FXA() && FXA().PRESETS[v]; if (pp) { Object.assign(S.fx, pp.v, { preset: v, on: true }); save(); render(); } } else if (a === "fitwin") { var c = L(); if (c) { c.fit(S.bg.sel.filter(function (id) { return id !== "p1"; }), OUT.width / OUT.height); toast("Đã căn cửa sổ theo tỉ lệ " + S.ar + "."); } } else if (a === "maxp1") { var c2 = L(); if (c2) c2.max(1); }
    else if (a === "camfeed") setFeed(S.cam.feed === false);
    else if (a === "imgsel") { S.cam.img = v; save(); if (v === "custom" && !CUST) pickImg(); render(); }
    else if (a === "imgpick") pickImg();
    else if (a === "imgdel") { CUST = null; try { localStorage.removeItem(IMGK); } catch (e) { } S.cam.img = "default"; save(); render(); }
    else if (a === "edit") { R.edit = v; render(); }
    else if (a === "bgfull") { var kk = ovKey(); if (S.ov[kk]) delete S.ov[kk].bg; save(); posBox(); }
    else if (a === "lreset") { delete S.ov[ovKey()]; if (S.tpl === "free") { S.cam.cx = .8; S.cam.cy = .76; S.cam.w = .26; S.cam.h = 0; if (S.cam.shape === "free") S.cam.shape = "auto"; } save(); render(); toast("Đã đặt lại bố cục."); }
    else if (a === "home") { if (S.bg.layout !== "single") toast("Chỉ dùng khi bố cục là “Một cửa sổ toàn màn hình”."); else { followTo("p1", 1); render(); } }
    else if (a === "camp") { var pr = api.camPreset(v, S.cam, OUT.width, OUT.height, vAr()); S.cam.cx = pr.cx; S.cam.cy = pr.cy; save(); posBox(); }
    else if (a === "plat") { var P = api.PLAT[v]; if (R.live) return; S.plat = v; S.ar = P.ar; S.q = P.q; OUTS = null; setSize(); save(); render(); }
    else if (a === "pv") { if (R.preview) { if (!R.live) stopPreview(); } else if (!CAP.ok) { toast("Hãy cho phép ghi hình trang này (bước 2) trước."); R.sec["2"] = true; } else startPreview(); render(); }
    else if (a === "ow") { if (!openOutWin()) toast("Trình duyệt chặn cửa sổ — cho phép cửa sổ bật lên rồi bấm lại."); }
    else if (a === "start") startLive(); else if (a === "stop") stopLive();
    else if (a === "phcam") phoneCam(R.facing); else if (a === "phfacing") phoneCam(R.facing === "user" ? "environment" : "user", true); else if (a === "phmic2") { R.mic = !R.mic; if (R.local) R.local.getAudioTracks().forEach(function (t) { t.enabled = R.mic; }); sendInfo(); render(); }
    else if (a === "phjoin") phoneJoin(($("#lcCode") || {}).value); else if (a === "phmanual") phoneManual(($("#lcPO") || {}).value); else if (a === "phstop") { closePair(); keepAwake(false); setLink(R.local ? "cam" : "idle", ""); }
  }
  function copyTxt(t) { (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { toast("Đã chép."); }, function () { toast("Không chép được — hãy bôi đen và chép tay."); }); }
  function openPanel(o) {
    o = o || {}; if (o.role) R.role = o.role; R.open = true; render(); if (R.role === "pc" && CAP.ok && !R.preview) startPreview(); if (R.role === "pc") { var ch = $("#lcChip"); if (ch) ch.remove(); }
    if (R.role === "phone" && o.code) { R.code = o.code; phoneJoin(o.code); }
  }
  function closePanel() { R.open = false; if (pn) { pn.remove(); pn = null; } if (!R.live) stopPreview(); else chip(); }
  setInterval(function () { if (R.open) { paintStatus(); } if (R.live) { chip(); } if (D.hidden) return; try { followTick(); } catch (e) { } if (CAP.ok && (R.preview || R.live)) syncSources(); }, 500);
  rotTimer(); loadCust();
  function init() {
    var c = api.normCode(new URLSearchParams(location.search).get("livecam") || ""); if (!api.okCode(c)) return;
    try { history.replaceState(null, "", location.pathname + location.hash); } catch (e) { } var n = 0, t = setInterval(function () { if (L() || ++n > 60) { clearInterval(t); if (L()) { root.NHIPLiveRoom.open(); openPanel({ role: "phone", code: c }); } } }, 250);
  }
  root.NHIPLiveCast = { open: openPanel, close: closePanel, stop: stopLive, _debug: function () { return { S: S, link: R.link, live: R.live, preview: R.preview, cap: CAP.mode, modes: CAP.mode === "element" ? ["el:" + CAP.eid] : Object.keys(CAP.src).map(function (k) { return k + ":" + CAP.src[k].mode; }), fps: R.fps, checks: api.checks(stat()), rv: [rv.videoWidth, rv.videoHeight], ev: CAP.ev ? [CAP.ev.videoWidth, CAP.ev.videoHeight, CAP.ev.readyState] : null }; } };
  if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", init); else init();
})(typeof window !== "undefined" ? window : globalThis);
