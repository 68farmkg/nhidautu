/* Cài đặt Chat khách hàng + Trợ lý AI + Hộp thư gửi (trong Admin > Cài đặt website). Dùng /admin/chat-config. */
(function () {
  'use strict';
  var root = document.getElementById('csRoot'); if (!root || !window.NhipChat) return;
  var NC = window.NhipChat, M = null, X = {}, tab = 'general', pv = null, pvView = 'chat', pvT = null, editMb = null, editQr = null, editKb = null, dirty = false;
  var TABS = [['general', 'Chung'], ['theme', 'Giao diện'], ['show', 'Hiển thị khách / nhân viên / AI'], ['gate', 'Khách điền thông tin'], ['notify', 'Thông báo'], ['ai', 'Trợ lý AI'], ['quick', 'Gợi ý & trả lời nhanh'], ['kb', 'Kiến thức AI'], ['mail', 'Hộp thư gửi']];
  var PREV = { general: 1, theme: 1, show: 1, gate: 1 };
  var $ = function (s, r) { return (r || root).querySelector(s); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function get(p) { return p.split('.').reduce(function (o, k) { return o == null ? o : o[k]; }, M); }
  function set(p, v) { var a = p.split('.'), o = M; for (var i = 0; i < a.length - 1; i++) o = o[a[i]]; o[a[a.length - 1]] = v; }
  function call(act, body, get_) {
    if (get_) return fetch('/admin/chat-config', { credentials: 'same-origin', cache: 'no-store' }).then(function (r) { return r.json(); });
    body = body || {}; body.act = act;
    return fetch('/admin/chat-config', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(function (r) { return r.json(); });
  }
  // ---------- ô nhập
  function F(label, path, o) {
    o = o || {}; var v = get(path), id = 'f_' + path.replace(/\./g, '_'), h = '';
    var t = o.t || 'text', hint = o.hint ? '<div class="meta">' + o.hint + '</div>' : '';
    if (t === 'chk') return '<label class="chk"><input type="checkbox" data-k="' + path + '"' + (v ? ' checked' : '') + '> ' + label + '</label>' + hint;
    h += '<div' + (o.w ? ' style="grid-column:1/-1"' : '') + '><label for="' + id + '">' + label + '</label>';
    if (t === 'sel') h += '<select id="' + id + '" data-k="' + path + '">' + o.opts.map(function (x) { return '<option value="' + esc(x[0]) + '"' + (String(v) === String(x[0]) ? ' selected' : '') + '>' + esc(x[1]) + '</option>'; }).join('') + '</select>';
    else if (t === 'area') h += '<textarea id="' + id + '" data-k="' + path + '" style="min-height:' + (o.h || 80) + 'px">' + esc(v) + '</textarea>';
    else if (t === 'num') h += '<input id="' + id + '" type="number" data-k="' + path + '" data-n="1" value="' + esc(v) + '"' + (o.min != null ? ' min="' + o.min + '"' : '') + (o.max != null ? ' max="' + o.max + '"' : '') + '>';
    else if (t === 'range') h += '<div class="cs-color"><input id="' + id + '" type="range" data-k="' + path + '" data-n="1" min="' + o.min + '" max="' + o.max + '" value="' + esc(v) + '" style="padding:0"><b class="rv">' + esc(v) + '</b></div>';
    else if (t === 'color') h += '<div class="cs-color"><input id="' + id + '" type="color" data-k="' + path + '" value="' + esc(hex(v)) + '"><span class="meta" style="margin:0">' + esc(hex(v)) + '</span></div>';
    else if (t === 'list') h += '<textarea id="' + id + '" data-k="' + path + '" data-list="1" style="min-height:' + (o.h || 90) + 'px">' + esc((v || []).join('\n')) + '</textarea>';
    else h += '<input id="' + id + '" type="text" data-k="' + path + '" value="' + esc(v) + '"' + (o.ph ? ' placeholder="' + esc(o.ph) + '"' : '') + '>';
    return h + hint + '</div>';
  }
  function hex(v) { v = String(v || ''); if (/^#[0-9a-f]{6}$/i.test(v)) return v; if (/^#[0-9a-f]{3}$/i.test(v)) return '#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3]; return '#888888'; }
  function firstHex(s) { var m = String(s || '').match(/#[0-9a-f]{6}|#[0-9a-f]{3}\b/i); return m ? hex(m[0]) : null; }
  var G = function (inner) { return '<div class="cs-row">' + inner + '</div>'; };
  var ONOFF = [['off', 'Không hỏi'], ['optional', 'Hỏi, không bắt buộc'], ['required', 'Bắt buộc']];
  var ICONS_L = [['chat', 'Bong bóng chat'], ['headset', 'Tai nghe hỗ trợ'], ['bot', 'Robot AI'], ['spark', 'Tia sáng AI'], ['msgs', 'Hội thoại']];

  // ---------- các tab
  function paneGeneral() {
    return '<h3 class="cs-h" style="margin-top:0">Bật chat & nội dung</h3>' + F('Bật chat trên website', 'site.chat_on', { t: 'chk' }) +
      G(F('Tiêu đề cửa sổ chat', 'site.chat_title') + F('Dòng phụ dưới tiêu đề', 'cfg.ui.sub') + F('Lời chào đầu tiên', 'site.chat_welcome', { t: 'area', w: 1, h: 70 }) + F('Gợi ý trong ô nhập', 'cfg.ui.placeholder') + F('Dòng chữ nhỏ cuối khung (miễn trừ)', 'cfg.ui.footer', { w: 1 })) +
      '<h3 class="cs-h">Nút mở chat</h3>' +
      G(F('Vị trí', 'cfg.ui.pos', { t: 'sel', opts: [['right', 'Góc phải'], ['left', 'Góc trái']] }) + F('Kiểu nút', 'cfg.ui.launcher', { t: 'sel', opts: [['circle', 'Tròn'], ['rounded', 'Vuông bo góc'], ['pill', 'Viên thuốc có chữ']] }) + F('Biểu tượng', 'cfg.ui.launcher_icon', { t: 'sel', opts: ICONS_L }) + F('Chữ trên nút (kiểu viên thuốc)', 'cfg.ui.launcher_label') + F('Cách mép ngang (px)', 'cfg.ui.ox', { t: 'num', min: 0, max: 200 }) + F('Cách mép dưới (px)', 'cfg.ui.oy', { t: 'num', min: 0, max: 300 }) + F('Kích thước (%)', 'cfg.ui.scale', { t: 'range', min: 80, max: 130 })) +
      F('Hiệu ứng nhấp nháy thu hút', 'cfg.ui.pulse', { t: 'chk' }) +
      '<h3 class="cs-h">Bong bóng mời & hành vi</h3>' +
      G(F('Câu mời chat nổi trên nút (để trống = tắt)', 'cfg.ui.teaser', { w: 1 }) + F('Hiện sau (giây)', 'cfg.ui.teaser_delay', { t: 'num', min: 1, max: 120 }) + F('Tự mở khung chat sau (giây, 0 = không)', 'cfg.ui.auto_open', { t: 'num', min: 0, max: 300 }) + F('Hiệu ứng mở', 'cfg.ui.anim', { t: 'sel', opts: [['pop', 'Bật nảy'], ['slide', 'Trượt lên'], ['fade', 'Mờ dần']] }) + F('Không hiện ở các trang bắt đầu bằng (cách nhau dấu phẩy)', 'cfg.ui.hide_paths', { w: 1 })) +
      F('Âm báo khi có tin mới', 'cfg.ui.sound', { t: 'chk' }) + F('Ẩn chat trên điện thoại', 'cfg.ui.hide_mobile', { t: 'chk' }) +
      '<h3 class="cs-h">Chuyển sang nhân viên</h3>' + F('Hiện nút “Gặp nhân viên” khi AI đang trả lời', 'cfg.handoff.btn', { t: 'chk' }) + G(F('Chữ trên nút', 'cfg.handoff.label'));
  }
  function swatch(id, t) {
    return '<button type="button" class="cs-th' + (M.cfg.ui.theme === id ? ' on' : '') + '" data-theme="' + id + '"><div class="sw" style="background:' + esc(t.bg) + ';border:1px solid ' + esc(t.bd) + '"><i style="background:' + esc(t.hbg) + '"></i><s style="left:8px;width:46%;background:' + esc(t.ab) + ';border:1px solid ' + esc(t.bd) + ';bottom:24px"></s><s style="right:8px;width:40%;background:' + esc(t.vb) + '"></s></div><b>' + esc(t.label) + '</b><small>' + esc(t.desc || '') + '</small></button>';
  }
  function paneTheme() {
    var h = '<h3 class="cs-h" style="margin-top:0">Chọn mẫu giao diện (' + (Object.keys(NC.THEMES).length) + ' mẫu có sẵn + tự xây)</h3><div class="cs-themes">';
    Object.keys(NC.THEMES).forEach(function (k) { h += swatch(k, NC.THEMES[k]); });
    var c = NC.resolveTheme({ theme: 'custom', custom: M.cfg.ui.custom });
    h += swatch('custom', { bg: c.bg, bd: c.bd, hbg: c.hbg, ab: c.ab, vb: c.vb, label: '✨ Tự xây', desc: 'Tự chọn mọi màu, bo góc, kiểu bong bóng' }) + '</div>';
    h += '<div style="margin-top:12px"><button class="btn ghost sm" type="button" data-act="fromtheme">Dùng mẫu đang chọn làm gốc để tự chỉnh</button> <button class="btn ghost sm" type="button" data-act="expcustom">Sao chép mẫu tự xây</button> <button class="btn ghost sm" type="button" data-act="impcustom">Dán mẫu đã sao chép</button></div>';
    h += '<h3 class="cs-h">Kiểu chung</h3>' + G(F('Phông chữ', 'cfg.ui.font', { t: 'sel', opts: [['theme', 'Theo mẫu'], ['system', 'Hệ thống'], ['inter', 'Inter'], ['serif', 'Có chân (Georgia)'], ['mono', 'Đơn cách (kiểu bảng giá)'], ['round', 'Tròn mềm']] }));
    if (M.cfg.ui.theme === 'custom') {
      var P = function (l, k) { return F(l, 'cfg.ui.custom.' + k, { t: 'color' }); };
      h += '<h3 class="cs-h">🎨 Tự xây giao diện</h3><div class="cs-note cs-ok">Mọi thay đổi hiện ngay ở khung xem trước bên phải.</div>' +
        '<b>Màu chính</b>' + G(P('Màu nhấn (nút, chip)', 'p') + P('Màu nhấn phụ (gradient)', 'p2') + P('Chữ trên nút', 'pt')) +
        '<b>Phần đầu khung</b>' + G(P('Nền phần đầu', 'hbg') + P('Chữ phần đầu', 'ht')) + F('Phần đầu dùng gradient từ màu nhấn → nhấn phụ', 'cfg.ui.custom.hgrad', { t: 'chk' }) +
        '<b>Nền & ô nhập</b>' + G(P('Nền khung', 'box') + P('Nền vùng tin nhắn', 'bg') + P('Nền ô nhập', 'inp') + P('Màu viền', 'bd')) +
        '<b>Bong bóng tin nhắn</b>' + G(P('Bong bóng của khách', 'vb') + P('Chữ của khách', 'vt') + P('Bong bóng nhân viên', 'ab') + P('Chữ nhân viên', 'at') + P('Bong bóng AI', 'aib') + P('Chữ AI', 'ait')) + F('Bong bóng khách dùng gradient', 'cfg.ui.custom.vgrad', { t: 'chk' }) +
        '<b>Hình dạng</b>' + G(F('Bo góc khung', 'cfg.ui.custom.br', { t: 'range', min: 0, max: 32 }) + F('Bo góc bong bóng', 'cfg.ui.custom.bubr', { t: 'range', min: 0, max: 26 }) + F('Kiểu phần đầu', 'cfg.ui.custom.head', { t: 'sel', opts: [['solid', 'Phẳng'], ['curve', 'Bo cong đáy'], ['glass', 'Kính mờ']] }) + F('Kiểu bong bóng', 'cfg.ui.custom.bubble', { t: 'sel', opts: [['round', 'Bo tròn'], ['tail', 'Có đuôi (kiểu iMessage)'], ['sharp', 'Vuông vức'], ['flat', 'Phẳng nhẹ'], ['brutal', 'Viền đen + bóng cứng']] }) + F('Bóng đổ', 'cfg.ui.custom.shadow', { t: 'sel', opts: [['none', 'Không'], ['sm', 'Nhẹ'], ['md', 'Vừa'], ['lg', 'Đậm'], ['glow', 'Phát sáng'], ['hard', 'Bóng cứng']] }) + F('Làm mờ nền phía sau (px, cho kiểu kính)', 'cfg.ui.custom.blur', { t: 'range', min: 0, max: 30 }));
    }
    return h;
  }
  function paneShow() {
    var AG = [['headset', 'Tai nghe'], ['user', 'Người'], ['star', 'Ngôi sao'], ['shield', 'Khiên'], ['heart', 'Trái tim']], AI = [['bot', 'Robot'], ['spark', 'Tia sáng AI'], ['chip', 'Vi mạch'], ['star', 'Ngôi sao']];
    return '<h3 class="cs-h" style="margin-top:0">Bố cục hội thoại</h3>' + G(F('Kiểu hiển thị', 'cfg.show.layout', { t: 'sel', opts: [['bubble', 'Bong bóng (khách bên phải, bên kia bên trái)'], ['flat', 'Danh sách phẳng kiểu Slack (tất cả bên trái)']] })) +
      F('Hiện tên người gửi', 'cfg.show.names', { t: 'chk' }) + F('Hiện giờ gửi', 'cfg.show.time', { t: 'chk' }) + F('Hiện chấm xanh “đang trực” ở đầu khung', 'cfg.show.status_dot', { t: 'chk' }) + F('Hiện hiệu ứng “đang soạn tin…”', 'cfg.show.typing', { t: 'chk' }) +
      '<h3 class="cs-h">👤 Khách</h3>' + G(F('Tên hiển thị của khách', 'cfg.show.vis_label')) + F('Hiện ảnh đại diện của khách', 'cfg.show.vis_avatar', { t: 'chk' }) +
      '<h3 class="cs-h">🎧 Nhân viên (người thật)</h3>' + G(F('Tên hiển thị mặc định', 'cfg.show.agent_name', { hint: 'Nếu nhân viên có tên tài khoản, tên đó sẽ hiện thay.' }) + F('Nhãn nhỏ bên cạnh tên (để trống = không hiện)', 'cfg.show.agent_badge') + F('Biểu tượng nhân viên', 'cfg.show.agent_icon', { t: 'sel', opts: AG }) + F('Hoặc dùng ảnh (https://… hoặc /anh.png)', 'cfg.show.agent_img', { hint: 'Có ảnh thì ảnh được ưu tiên hơn biểu tượng.' })) +
      '<h3 class="cs-h">🤖 Trợ lý AI</h3>' + G(F('Tên hiển thị của AI', 'cfg.show.ai_name') + F('Nhãn nhỏ bên cạnh tên', 'cfg.show.ai_badge') + F('Biểu tượng AI', 'cfg.show.ai_icon', { t: 'sel', opts: AI }) + F('Hoặc dùng ảnh (https://…)', 'cfg.show.ai_img')) +
      '<div class="cs-note">Khi cuộc chat được chuyển cho người thật, khách thấy biểu tượng 🎧 và nhãn “' + esc(M.cfg.show.agent_badge || 'Nhân viên') + '”; tin do AI trả lời hiện biểu tượng 🤖 và nhãn “' + esc(M.cfg.show.ai_badge) + '”, để khách luôn biết đang nói chuyện với ai.</div>';
  }
  function paneGate() {
    return F('Bắt khách điền thông tin trước khi chat', 'cfg.gate.on', { t: 'chk' }) + '<div class="meta">Chưa điền hợp lệ thì khách không gửi được tin. Máy chủ cũng kiểm tra lại, không thể lách bằng cách gọi trực tiếp.</div>' +
      G(F('Họ tên', 'cfg.gate.name', { t: 'sel', opts: ONOFF }) + F('Số điện thoại', 'cfg.gate.phone', { t: 'sel', opts: ONOFF }) + F('Email', 'cfg.gate.email', { t: 'sel', opts: ONOFF })) +
      F('Chỉ cần SĐT hoặc email (một trong hai là đủ)', 'cfg.gate.either', { t: 'chk' }) +
      G(F('Tiêu đề form', 'cfg.gate.title') + F('Chữ nút bắt đầu', 'cfg.gate.btn') + F('Mô tả ngắn', 'cfg.gate.desc', { t: 'area', w: 1, h: 60 }) + F('Dòng đồng ý (để trống = không hiện ô tích)', 'cfg.gate.consent', { t: 'area', w: 1, h: 60 })) +
      F('Bắt buộc tích đồng ý', 'cfg.gate.consent_req', { t: 'chk' }) +
      '<div class="cs-note">SĐT hợp lệ: dạng 0912345678 hoặc +84912345678. Tên, SĐT, email của khách hiện trong khung “Thông tin khách hàng” ở trang Chat khách. Thông báo và email xác nhận cấu hình ở tab <b>Thông báo</b>.</div>';
  }
  function paneNotify() {
    var mb = M.mailboxes.filter(function (m) { return m.active; });
    return '<div class="cs-note ' + (X.telegram ? 'cs-ok' : '') + '">Telegram: ' + (X.telegram ? '<b>đã cấu hình</b> (TELEGRAM_BOT_TOKEN và TELEGRAM_CHAT_ID).' : '<b>chưa cấu hình</b>. Thêm 2 biến TELEGRAM_BOT_TOKEN và TELEGRAM_CHAT_ID trong Cloudflare (xem HUONG-DAN.md).') + '</div>' +
      '<h3 class="cs-h" style="margin-top:0">Báo cho bạn khi có khách</h3>' + F('Báo qua Telegram', 'cfg.notify.tg', { t: 'chk' }) + F('Báo ngay khi khách vừa điền xong thông tin (mở chat)', 'cfg.notify.on_start', { t: 'chk' }) + F('Báo cho MỖI tin khách gửi (mặc định chỉ tin đầu của lượt chưa đọc)', 'cfg.notify.each', { t: 'chk' }) +
      G(F('Báo qua email tới (nhiều địa chỉ cách nhau dấu phẩy)', 'cfg.notify.email', { w: 1, ph: 'ban@gmail.com, nhanvien@gmail.com' }) + F('Gửi email báo từ hộp thư', 'cfg.notify.mailbox', { t: 'sel', opts: [[0, mb.length ? 'Hộp thư mặc định' : '(chưa có hộp thư gửi)']].concat(mb.map(function (m) { return [m.id, m.label + ' — ' + m.from_email]; })) }) + F('Webhook (Zalo/Slack/Discord/…)', 'cfg.notify.webhook', { w: 1, ph: 'https://…', hint: 'Nhận JSON {title, text, content, link}.' })) +
      '<div class="meta">Ngoài ra trang <b>Chat khách</b> có âm báo và thông báo trình duyệt khi mở.</div>' +
      '<h3 class="cs-h">Xác nhận cho khách</h3>' + F('Hiện lời xác nhận ngay trong khung chat sau khi khách điền thông tin', 'cfg.notify.in_chat', { t: 'chk' }) + G(F('Nội dung xác nhận trong chat', 'cfg.notify.in_chat_text', { t: 'area', w: 1, h: 60 })) +
      F('Gửi email xác nhận cho khách (nếu khách để email)', 'cfg.notify.confirm_visitor', { t: 'chk' }) + G(F('Tiêu đề email', 'cfg.notify.confirm_subject', { w: 1 }) + F('Nội dung email', 'cfg.notify.confirm_text', { t: 'area', w: 1, h: 70 }));
  }
  function paneAi() {
    var A = 'cfg.ai.', provs = [['auto', 'Tự động (thử lần lượt các nhà AI đã bật)']].concat(X.providers.map(function (p) { return [p.id, p.name]; }));
    var d = M.cfg.ai.mode;
    return (X.providers.length ? '' : '<div class="cs-note">Chưa bật nhà AI nào có API key. Vào <a href="/admin/cai-dat-ai"><b>Cài đặt AI (API)</b></a> nhập key (Gemini, Groq… có gói miễn phí) để AI chat hoạt động.</div>') +
      '<h3 class="cs-h" style="margin-top:0">Khi nào AI trả lời?</h3>' +
      G(F('Chế độ', A + 'mode', { t: 'sel', opts: [['off', 'Tắt, chỉ nhân viên trả lời'], ['always', 'Luôn để AI trả lời (trừ khi đã chuyển cho nhân viên)'], ['smart', 'Thông minh: AI trả lời khi bạn vắng mặt']] }) + F('Nhà AI dùng', A + 'provider', { t: 'sel', opts: provs })) +
      (d === 'smart' ? '<div class="cs-note cs-ok"><b>AI trả lời thay bạn khi:</b> ' + 'bạn bấm “Tôi vắng” trên trang Chat, hoặc bạn không mở trang Chat trong ít phút, hoặc ngoài giờ làm việc, hoặc khách chờ quá lâu chưa ai trả lời. Bật/tắt từng điều kiện bên dưới.</div>' +
        F('Khi bạn vắng/không mở trang Chat', A + 'use_presence', { t: 'chk' }) + G(F('Coi là vắng sau (phút không mở trang Chat)', A + 'away_after', { t: 'num', min: 1, max: 240 })) +
        F('Ngoài giờ làm việc', A + 'outside_hours', { t: 'chk' }) + G(F('Giờ bắt đầu', A + 'hours.from', { ph: '08:30' }) + F('Giờ kết thúc', A + 'hours.to', { ph: '17:30' })) + daysHtml() +
        G(F('Khách chờ quá (giây) chưa ai trả lời thì AI vào cuộc (0 = tắt)', A + 'delay', { t: 'num', min: 0, max: 3600 })) : '') +
      '<h3 class="cs-h">Tính cách & quy tắc</h3>' + G(F('Vai trò của AI', A + 'persona', { t: 'area', w: 1, h: 80 }) + F('Quy tắc riêng (mỗi dòng một ý, ví dụ: không báo giá phí, luôn mời để lại SĐT)', A + 'rules', { t: 'area', w: 1, h: 100 })) +
      '<h3 class="cs-h">Dữ liệu AI được nạp để trả lời</h3>' + F('Số liệu thị trường (chỉ số, giá cổ phiếu trong Số liệu thị trường)', A + 'use_quotes', { t: 'chk' }) + F('Tin tức & phân tích đã đăng trên website', A + 'use_posts', { t: 'chk' }) + G(F('Số bài liên quan tối đa mỗi lần', A + 'posts_n', { t: 'num', min: 1, max: 12 })) + F('Kiến thức do bạn nhập (tab Kiến thức AI)', A + 'use_kb', { t: 'chk' }) +
      '<h3 class="cs-h">Chuyển cho nhân viên</h3>' + G(F('Từ khóa khách gõ là chuyển ngay (cách nhau dấu phẩy)', A + 'handoff_kw', { t: 'area', w: 1, h: 60 }) + F('Lời báo khi chuyển cho nhân viên', A + 'handoff_msg', { t: 'area', w: 1, h: 60 }) + F('Lời báo khi AI gặp lỗi/không trả lời được', A + 'fallback_msg', { t: 'area', w: 1, h: 60 })) +
      F('Khi nhân viên trả lời tay, tự tắt AI cho cuộc chat đó', A + 'stop_on_human', { t: 'chk' }) + F('AI gợi ý 3 câu hỏi liên quan sau mỗi câu trả lời', A + 'suggest', { t: 'chk' }) + G(F('Số tin AI tối đa mỗi cuộc chat', A + 'max_replies', { t: 'num', min: 1, max: 500 })) +
      '<h3 class="cs-h">🧪 Hỏi thử AI</h3><div class="cs-row"><div style="grid-column:1/-1"><input type="text" id="aiq" placeholder="Ví dụ: VN-Index hôm nay thế nào?"></div></div><p><button class="btn sm" type="button" data-act="aitest">Hỏi thử (dùng cấu hình đang soạn)</button></p><div id="aiout"></div>';
  }
  function daysHtml() {
    var N = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'], on = M.cfg.ai.hours.days;
    return '<label>Ngày làm việc</label><div style="display:flex;gap:10px;flex-wrap:wrap">' + N.map(function (n, i) { return '<label class="chk" style="margin:0"><input type="checkbox" data-day="' + i + '"' + (on.indexOf(i) >= 0 ? ' checked' : '') + '> ' + n + '</label>'; }).join('') + '</div>';
  }
  function paneQuick() {
    var qs = M.quick;
    var h = '<h3 class="cs-h" style="margin-top:0">Câu gợi ý hiện cho khách lúc mới vào</h3>' + F('Mỗi dòng một câu (tối đa 8). Khách bấm là gửi ngay.', 'cfg.chips', { t: 'list', h: 110 }) + '<div class="meta">Sau mỗi câu trả lời, AI còn tự gợi ý “Câu hỏi liên quan” (bật ở tab Trợ lý AI).</div>';
    h += '<h3 class="cs-h">Trả lời nhanh cho nhân viên</h3><div class="meta">Trong trang Chat gõ “/” hoặc bấm “Trả lời nhanh” để chèn. Mẫu loại “Email” dùng khi trả lời Hộp thư.</div>';
    h += qs.map(function (q) { return '<div class="cs-card"><div class="tt"><b>' + esc(q.title) + '</b> <span class="st">' + (q.kind === 'mail' ? 'Email' : 'Chat') + '</span><p>' + esc(q.body) + '</p></div><div class="acts"><button class="btn ghost sm" type="button" data-qe="' + q.id + '">Sửa</button><button class="btn red sm" type="button" data-qd="' + q.id + '">Xóa</button></div></div>'; }).join('');
    var e = editQr || { id: 0, kind: 'chat', title: '', body: '' };
    h += '<div class="box" style="margin-top:10px"><b>' + (e.id ? 'Sửa mẫu' : 'Thêm mẫu mới') + '</b><div class="cs-row"><div><label>Loại</label><select id="qk"><option value="chat"' + (e.kind === 'chat' ? ' selected' : '') + '>Chat</option><option value="mail"' + (e.kind === 'mail' ? ' selected' : '') + '>Email</option></select></div><div><label>Tiêu đề (để tìm nhanh)</label><input type="text" id="qt" value="' + esc(e.title) + '"></div><div style="grid-column:1/-1"><label>Nội dung</label><textarea id="qb" style="min-height:90px">' + esc(e.body) + '</textarea></div></div><p><button class="btn sm" type="button" data-act="qsave">Lưu mẫu</button> ' + (e.id ? '<button class="btn ghost sm" type="button" data-act="qcancel">Hủy sửa</button>' : '') + '</p></div>';
    return h;
  }
  function paneKb() {
    var KN = { faq: 'Hỏi đáp', info: 'Thông tin công ty', policy: 'Chính sách/phí', product: 'Sản phẩm/dịch vụ', pin: '📌 Luôn nạp' };
    var h = '<div class="cs-note cs-ok">AI <b>tự động</b> đọc số liệu thị trường và bài viết trên website. Ở đây bạn nhập thêm những gì AI cần biết: bảng phí, quy trình mở tài khoản, giờ làm việc, hỏi đáp thường gặp, cách phân tích của riêng bạn… Loại “📌 Luôn nạp” luôn được đưa cho AI; các loại khác được chọn theo câu hỏi của khách.</div>';
    h += M.kb.map(function (k) { return '<div class="cs-card"><div class="tt"><b>' + esc(k.title) + '</b> <span class="st">' + KN[k.kind] + '</span>' + (k.active ? '' : ' <span class="st pending">Tắt</span>') + '<p>' + esc(String(k.body).slice(0, 220)) + (k.body.length > 220 ? '…' : '') + '</p></div><div class="acts"><button class="btn ghost sm" type="button" data-ke="' + k.id + '">Sửa</button><button class="btn red sm" type="button" data-kd="' + k.id + '">Xóa</button></div></div>'; }).join('') || '<div class="cp-empty">Chưa có mục nào.</div>';
    var e = editKb || { id: 0, title: '', body: '', kind: 'faq', active: 1 };
    h += '<div class="box" style="margin-top:10px"><b>' + (e.id ? 'Sửa mục kiến thức' : 'Thêm kiến thức mới') + '</b><div class="cs-row"><div><label>Tiêu đề / câu hỏi</label><input type="text" id="kt" value="' + esc(e.title) + '"></div><div><label>Loại</label><select id="kk">' + Object.keys(KN).map(function (k) { return '<option value="' + k + '"' + (e.kind === k ? ' selected' : '') + '>' + KN[k] + '</option>'; }).join('') + '</select></div><div style="grid-column:1/-1"><label>Nội dung (tối đa 4.000 ký tự)</label><textarea id="kb" style="min-height:140px">' + esc(e.body) + '</textarea></div></div><label class="chk"><input type="checkbox" id="ka"' + (e.active ? ' checked' : '') + '> Đang dùng</label><p><button class="btn sm" type="button" data-act="ksave">Lưu</button> ' + (e.id ? '<button class="btn ghost sm" type="button" data-act="kcancel">Hủy sửa</button>' : '') + '</p></div>';
    return h;
  }
  function paneMail() {
    var h = '<div class="cs-note">Cloudflare không gửi mail trực tiếp, nên mỗi <b>hộp thư gửi</b> kết nối qua một dịch vụ gửi thư (hoặc Gmail của bạn qua Google Apps Script, không cần tên miền). Bạn có thể thêm <b>nhiều hộp thư</b> (ví dụ hỗ trợ@, tư vấn@) và chọn hộp nào để trả lời ngay trong trang Hộp thư. Khi khách bấm “Trả lời” trong email, thư sẽ về địa chỉ <b>“Nhận phản hồi tại”</b> bạn đặt (ví dụ Gmail của bạn).</div>';
    h += M.mailboxes.map(function (m) { var pn = (X.providersMeta[m.provider] || {}).name || m.provider; return '<div class="cs-card"><div class="tt"><b>' + esc(m.label) + '</b> ' + (m.is_default ? '<span class="st published">Mặc định</span> ' : '') + (m.active ? '' : '<span class="st pending">Tắt</span> ') + (m.has_key ? '' : '<span class="st new">Chưa có khóa</span>') + '<p>' + esc(m.from_name) + ' &lt;' + esc(m.from_email) + '&gt; · ' + esc(pn) + (m.reply_to ? '<br>Nhận phản hồi tại: ' + esc(m.reply_to) : '') + '</p></div><div class="acts"><button class="btn ghost sm" type="button" data-mt="' + m.id + '">Gửi thử</button><button class="btn ghost sm" type="button" data-me="' + m.id + '">Sửa</button><button class="btn red sm" type="button" data-md="' + m.id + '">Xóa</button></div></div>'; }).join('') || '<div class="cp-empty">Chưa có hộp thư gửi nào.</div>';
    var e = editMb || null;
    if (!e) return h + '<p><button class="btn" type="button" data-act="mnew">+ Thêm hộp thư gửi</button></p>';
    var P = X.providersMeta;
    h += '<div class="box" style="margin-top:10px"><b>' + (e.id ? 'Sửa hộp thư' : 'Thêm hộp thư gửi') + '</b><div class="cs-row">' +
      '<div><label>Tên gọi (để bạn chọn)</label><input type="text" id="mbl" value="' + esc(e.label) + '" placeholder="Hỗ trợ khách hàng"></div>' +
      '<div><label>Dịch vụ gửi</label><select id="mbp">' + Object.keys(P).map(function (k) { return '<option value="' + k + '"' + (e.provider === k ? ' selected' : '') + '>' + esc(P[k].name) + '</option>'; }).join('') + '</select></div>' +
      '<div><label>Tên người gửi</label><input type="text" id="mbn" value="' + esc(e.from_name) + '" placeholder="Nhịp Đầu Tư"></div>' +
      '<div><label>Địa chỉ email gửi</label><input type="text" id="mbe" value="' + esc(e.from_email) + '" placeholder="hotro@tenmien.vn"></div>' +
      '<div><label>Nhận phản hồi tại (Reply-To)</label><input type="text" id="mbr" value="' + esc(e.reply_to) + '" placeholder="Gmail của bạn"></div>' +
      '<div><label id="mbkl">API key / mã bí mật</label><input type="password" id="mbk" autocomplete="off" placeholder="' + (e.has_key ? 'Đã lưu. Để trống nếu giữ nguyên' : 'Dán khóa vào đây') + '"></div>' +
      '<div id="mbdw"><label>Tên miền gửi (Mailgun)</label><input type="text" id="mbd" value="' + esc(e.domain) + '" placeholder="mg.tenmien.vn"></div>' +
      '<div id="mbxw"><label id="mbxl">Thông tin thêm</label><input type="text" id="mbx" value="' + esc(e.extra) + '"></div>' +
      '<div style="grid-column:1/-1"><label>Chữ ký tự thêm cuối mỗi thư</label><textarea id="mbs" style="min-height:70px" placeholder="Trân trọng,&#10;Nhịp Đầu Tư - 1900 0000">' + esc(e.signature) + '</textarea></div></div>' +
      '<div class="meta" id="mbh"></div><div id="mbcode"></div><label class="chk"><input type="checkbox" id="mbdef"' + (e.is_default ? ' checked' : '') + '> Đặt làm hộp thư mặc định</label><label class="chk"><input type="checkbox" id="mba"' + (e.active ? ' checked' : '') + '> Đang bật</label>' + (e.has_key ? '<label class="chk"><input type="checkbox" id="mbc"> Xóa khóa đã lưu</label>' : '') +
      '<div class="msg err" id="mbe2" style="display:none"></div><p><button class="btn" type="button" data-act="msave">Lưu hộp thư</button> <button class="btn ghost" type="button" data-act="mcancel">Hủy</button></p></div>';
    return h;
  }
  function mbHints() {
    var s = $('#mbp'); if (!s) return; var p = s.value, P = X.providersMeta[p] || {};
    $('#mbh').innerHTML = '<b>' + esc(P.name || '') + ':</b> ' + esc(P.hint || '') + ' <i>(' + esc(P.free || '') + ')</i>';
    $('#mbdw').style.display = p === 'mailgun' ? '' : 'none'; $('#mbxw').style.display = (p === 'mailgun' || p === 'webhook') ? '' : 'none';
    $('#mbxl').textContent = p === 'webhook' ? 'Địa chỉ Web app của Apps Script (https://script.google.com/…/exec)' : 'Máy chủ EU? Ghi chữ eu (để trống = máy chủ Mỹ)';
    $('#mbkl').textContent = p === 'webhook' ? 'Mã bí mật (tự đặt, trùng với mã trong Apps Script)' : 'API key';
    $('#mbcode').innerHTML = p === 'webhook' ? '<p class="meta"><b>Cách làm (5 phút):</b> vào script.google.com > Dự án mới > dán mã dưới (đổi DOI-MA-BI-MAT-NAY thành mã bí mật của bạn) > Triển khai > Ứng dụng web > “Thực thi bằng: Tôi”, “Ai có quyền truy cập: Bất kỳ ai” > sao chép địa chỉ dán vào ô trên.</p><div class="cs-code">' + esc(X.appsScript) + '</div>' : '';
  }

  // ---------- vẽ
  function build() {
    var t = '<div class="cs-tabs">' + TABS.map(function (x) { return '<button type="button" data-tab="' + x[0] + '" class="' + (tab === x[0] ? 'on' : '') + '">' + x[1] + '</button>'; }).join('') + '</div>';
    var fn = { general: paneGeneral, theme: paneTheme, show: paneShow, gate: paneGate, notify: paneNotify, ai: paneAi, quick: paneQuick, kb: paneKb, mail: paneMail }[tab];
    var body = '<div class="cs-pane on">' + fn() + '</div>';
    var prev = PREV[tab] ? '<aside class="cs-prev"><h4>Xem trước trực tiếp</h4><div class="cs-seg cp-seg" id="pvSeg"><button data-v="chat" class="' + (pvView === 'chat' ? 'on' : '') + '">Khung chat</button><button data-v="gate" class="' + (pvView === 'gate' ? 'on' : '') + '">Form thông tin</button><button data-v="closed" class="' + (pvView === 'closed' ? 'on' : '') + '">Nút mở</button></div><div id="pvHost" style="margin-top:12px"></div></aside>' : '';
    root.innerHTML = t + (PREV[tab] ? '<div class="cs-layout"><div>' + body + '</div>' + prev + '</div>' : body) +
      '<div class="cs-sv"><button class="btn" type="button" data-act="save">Lưu cài đặt chat</button><span id="svMsg" class="meta" style="margin:0">' + (dirty ? 'Có thay đổi chưa lưu' : '') + '</span></div>';
    if (tab === 'mail') mbHints();
    drawPreview();
  }
  function pubCfg() {
    var c = M.cfg, s = M.site;
    return { ui: c.ui, show: c.show, gate: c.gate, chips: c.chips, handoff: c.handoff, ai: { on: c.ai.mode !== 'off', name: c.show.ai_name }, title: s.chat_title || 'Hỗ trợ trực tuyến', welcome: s.chat_welcome };
  }
  function drawPreview() {
    var h = $('#pvHost'); if (!h) return;
    if (pv) { try { pv.destroy(); } catch (e) { } pv = null; }
    h.innerHTML = '';
    try { pv = NC.mount(h, JSON.parse(JSON.stringify(pubCfg())), { preview: true, view: pvView }); } catch (e) { h.textContent = 'Không vẽ được bản xem trước: ' + e.message; }
  }
  function schedPreview() { clearTimeout(pvT); pvT = setTimeout(drawPreview, 160); }
  function mark() { dirty = true; var m = $('#svMsg'); if (m) m.textContent = 'Có thay đổi chưa lưu'; }

  // ---------- sự kiện
  function onInput(e) {
    var t = e.target;
    if (t.dataset && t.dataset.day != null) { var d = Number(t.dataset.day), a = M.cfg.ai.hours.days.slice(), i = a.indexOf(d); if (t.checked && i < 0) a.push(d); if (!t.checked && i >= 0) a.splice(i, 1); M.cfg.ai.hours.days = a; mark(); return; }
    var k = t.dataset && t.dataset.k; if (!k) return;
    var v = t.type === 'checkbox' ? t.checked : t.dataset.list ? t.value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean) : t.dataset.n ? Number(t.value) : t.value;
    if (k === 'site.chat_on') v = v ? '1' : '';
    set(k, v); mark();
    if (t.type === 'range') { var rv = t.parentNode.querySelector('.rv'); if (rv) rv.textContent = v; }
    if (t.type === 'color') { var sp = t.parentNode.querySelector('span'); if (sp) sp.textContent = v; }
    if (k === 'cfg.ai.mode' || k === 'cfg.ui.font') { if (k === 'cfg.ai.mode') build(); else schedPreview(); return; }
    schedPreview();
  }
  root.addEventListener('input', onInput); root.addEventListener('change', onInput);
  root.addEventListener('change', function (e) { if (e.target.id === 'mbp') mbHints(); });

  function mbForm() {
    return { id: editMb.id || 0, label: $('#mbl').value, provider: $('#mbp').value, from_name: $('#mbn').value, from_email: $('#mbe').value, reply_to: $('#mbr').value, api_key: $('#mbk').value, domain: $('#mbd').value, extra: $('#mbx').value, signature: $('#mbs').value, is_default: $('#mbdef').checked, active: $('#mba').checked, clear_key: $('#mbc') ? $('#mbc').checked : false };
  }
  root.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.tab) { tab = b.dataset.tab; editMb = null; if (history.replaceState) history.replaceState(null, '', '#' + (tab === 'mail' ? 'mail' : 'chat')); build(); return; }
    if (b.closest('#pvSeg') && b.dataset.v) { pvView = b.dataset.v; [].forEach.call($('#pvSeg').children, function (x) { x.classList.toggle('on', x === b); }); drawPreview(); return; }
    if (b.dataset.theme) { M.cfg.ui.theme = b.dataset.theme; mark(); build(); return; }
    if (b.dataset.qe) { editQr = M.quick.find(function (q) { return q.id === Number(b.dataset.qe); }); build(); return; }
    if (b.dataset.qd) { if (confirm('Xóa mẫu này?')) call('qr_delete', { id: Number(b.dataset.qd) }).then(function (r) { if (r.ok) { M.quick = r.quick; build(); } }); return; }
    if (b.dataset.ke) { editKb = M.kb.find(function (q) { return q.id === Number(b.dataset.ke); }); build(); return; }
    if (b.dataset.kd) { if (confirm('Xóa mục này?')) call('kb_delete', { id: Number(b.dataset.kd) }).then(function (r) { if (r.ok) { M.kb = r.kb; build(); } }); return; }
    if (b.dataset.me) { editMb = JSON.parse(JSON.stringify(M.mailboxes.find(function (m) { return m.id === Number(b.dataset.me); }))); build(); return; }
    if (b.dataset.md) { if (confirm('Xóa hộp thư gửi này?')) call('mb_delete', { id: Number(b.dataset.md) }).then(function (r) { if (r.ok) { M.mailboxes = r.mailboxes; build(); } }); return; }
    if (b.dataset.mt) { var to = prompt('Gửi thư thử tới email nào?'); if (!to) return; b.disabled = true; call('mb_test', { id: Number(b.dataset.mt), to: to }).then(function (r) { alert(r.ok ? 'Đã gửi thư thử. Hãy kiểm tra hộp thư (cả mục Spam).' : 'Lỗi: ' + r.error); }).then(function () { b.disabled = false; }); return; }
    var a = b.dataset.act; if (!a) return;
    if (a === 'save') {
      b.disabled = true; $('#svMsg').textContent = 'Đang lưu…';
      call('save', { cfg: M.cfg, site: M.site }).then(function (r) { if (r.ok) { M.cfg = r.cfg; dirty = false; $('#svMsg').textContent = '✓ Đã lưu. Tải lại trang website để thấy thay đổi.'; } else $('#svMsg').textContent = 'Lỗi: ' + (r.error || ''); }).catch(function () { $('#svMsg').textContent = 'Mất kết nối.'; }).then(function () { b.disabled = false; });
    }
    if (a === 'fromtheme') {
      var rt = NC.resolveTheme(M.cfg.ui), c = M.cfg.ui.custom;
      ['p', 'p2', 'pt', 'ht', 'bg', 'box', 'vt', 'ab', 'at', 'aib', 'ait', 'inp', 'bd', 'bd'].forEach(function (k) { c[k] = firstHex(rt[k]) || c[k]; });
      c.hbg = firstHex(rt.hbg) || c.hbg; c.hgrad = /gradient/.test(rt.hbg); c.vb = firstHex(rt.vb) || c.vb; c.vgrad = /gradient/.test(rt.vb);
      c.br = rt.br; c.bubr = rt.bubr; c.head = rt.head; c.bubble = rt.bubble; c.shadow = rt.shadow; c.blur = rt.blur || 0; c.font = rt.font;
      M.cfg.ui.theme = 'custom'; mark(); build();
    }
    if (a === 'expcustom') { var js = JSON.stringify(M.cfg.ui.custom); (navigator.clipboard ? navigator.clipboard.writeText(js) : Promise.reject()).then(function () { alert('Đã sao chép mẫu tự xây.'); }).catch(function () { prompt('Sao chép đoạn này:', js); }); }
    if (a === 'impcustom') { var s = prompt('Dán mẫu đã sao chép:'); if (!s) return; try { var o = JSON.parse(s); Object.keys(M.cfg.ui.custom).forEach(function (k) { if (o[k] != null) M.cfg.ui.custom[k] = o[k]; }); M.cfg.ui.theme = 'custom'; mark(); build(); } catch (x) { alert('Mẫu không hợp lệ.'); } }
    if (a === 'qsave') { b.disabled = true; call('qr_save', { id: editQr ? editQr.id : 0, kind: $('#qk').value, title: $('#qt').value, body: $('#qb').value }).then(function (r) { if (r.ok) { M.quick = r.quick; editQr = null; build(); } else alert(r.error); }).then(function () { b.disabled = false; }); }
    if (a === 'qcancel') { editQr = null; build(); }
    if (a === 'ksave') { b.disabled = true; call('kb_save', { id: editKb ? editKb.id : 0, title: $('#kt').value, kind: $('#kk').value, body: $('#kb').value, active: $('#ka').checked }).then(function (r) { if (r.ok) { M.kb = r.kb; editKb = null; build(); } else alert(r.error); }).then(function () { b.disabled = false; }); }
    if (a === 'kcancel') { editKb = null; build(); }
    if (a === 'mnew') { editMb = { id: 0, label: '', provider: 'resend', from_name: '', from_email: '', reply_to: '', domain: '', extra: '', signature: '', is_default: M.mailboxes.length === 0, active: 1, has_key: false }; build(); }
    if (a === 'mcancel') { editMb = null; build(); }
    if (a === 'msave') {
      b.disabled = true; call('mb_save', { box: mbForm() }).then(function (r) { if (r.ok) { M.mailboxes = r.mailboxes; editMb = null; build(); } else { var er = $('#mbe2'); er.style.display = ''; er.textContent = r.error; } }).then(function () { b.disabled = false; });
    }
    if (a === 'aitest') {
      var q = $('#aiq').value.trim(); if (!q) { alert('Nhập câu hỏi thử.'); return; } b.disabled = true; b.textContent = 'AI đang trả lời…'; $('#aiout').innerHTML = '';
      call('ai_test', { cfg: M.cfg, q: q }).then(function (r) {
        $('#aiout').innerHTML = r.ok ? ('<div class="cs-note ' + (r.error ? '' : 'cs-ok') + '"><b>' + (r.error ? 'Không trả lời được: ' + esc(r.error) : 'AI trả lời:') + '</b><br>' + esc(r.reply).replace(/\n/g, '<br>') + (r.handoff ? '<br><i>(AI sẽ chuyển cho nhân viên)</i>' : '') + (r.suggest && r.suggest.length ? '<br><br><b>Gợi ý liên quan:</b> ' + r.suggest.map(esc).join(' · ') : '') + '</div><details><summary>Dữ liệu AI đã được nạp cho câu hỏi này</summary><div class="cs-code">' + esc(r.knowledge) + '</div></details>') : '<div class="msg err">' + esc(r.error) + '</div>';
      }).catch(function () { $('#aiout').innerHTML = '<div class="msg err">Mất kết nối.</div>'; }).then(function () { b.disabled = false; b.textContent = 'Hỏi thử (dùng cấu hình đang soạn)'; });
    }
  });

  window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
  call('get', null, true).then(function (d) {
    if (!d.ok) { root.innerHTML = '<div class="msg err">Không tải được cài đặt chat.</div>'; return; }
    M = { cfg: d.cfg, site: d.site, mailboxes: d.mailboxes, quick: d.quick, kb: d.kb }; X = { providers: d.providers, providersMeta: d.providersMeta, appsScript: d.appsScript, telegram: d.telegram };
    if (location.hash === '#mail') tab = 'mail';
    build();
    if (location.hash === '#chat' || location.hash === '#mail') { var c = document.getElementById('chat'); if (c) c.scrollIntoView(); }
  }).catch(function () { root.innerHTML = '<div class="msg err">Mất kết nối máy chủ.</div>'; });
})();
