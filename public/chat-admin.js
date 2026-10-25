/* Trang quản lý Chat (admin). Dùng /admin/chat-api. */
(function () {
  'use strict';
  var root = document.getElementById('cp'); if (!root) return;
  var $ = function (id) { return document.getElementById(id); };
  var quick = []; try { quick = JSON.parse(root.dataset.quick || '[]'); } catch (e) { }
  var isAdmin = root.dataset.admin === '1';
  var S = { tab: 'all', q: '', items: [], counts: {}, cur: 0, conv: null, msgs: [], last: 0, sound: localStorage.getItem('cp_snd') !== '0', unreadSig: -1, pres: 'auto' };
  var COLORS = ['#12b76a', '#2e90fa', '#7a5af8', '#f79009', '#ee46bc', '#0ba5ec', '#e5484d', '#16b364'];
  var SL = { new: 'Chờ xử lý', processing: 'Đang xử lý', done: 'Đã giải quyết' };
  var CATS = ['', 'Tư vấn đầu tư', 'Hỗ trợ kỹ thuật', 'Mở tài khoản', 'Khiếu nại', 'Hợp tác', 'Khác'];
  var IC = {
    bot: '<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 4v4M9 14h.01M15 14h.01"/>', user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>',
    msg: '<path d="M4 5h16v11H9l-5 4z"/>', users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 21a7 7 0 0114 0M17 4a3.5 3.5 0 010 7M22 21a7 7 0 00-4-6"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', check: '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>', send: '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/>', spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>', back: '<path d="M15 5l-7 7 7 7"/>'
  };
  function ic(n, s) { s = s || 18; return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (IC[n] || '') + '</svg>'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function ago(iso) {
    if (!iso) return ''; var d = new Date(iso), s = (Date.now() - d) / 1000; if (isNaN(s)) return '';
    if (s < 60) return 'vừa xong'; if (s < 3600) return Math.floor(s / 60) + ' phút'; if (s < 86400) return Math.floor(s / 3600) + ' giờ';
    return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2);
  }
  function hm(iso) { var d = new Date(iso); return isNaN(d) ? '' : ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + ' ' + ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2); }
  function api(act, body) {
    if (body) { body.act = act; return fetch('/admin/chat-api', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(function (r) { return r.json(); }); }
    return fetch('/admin/chat-api?act=' + act + (arguments[2] || ''), { credentials: 'same-origin', cache: 'no-store' }).then(function (r) { return r.json(); });
  }
  function err(m) { var e = $('cpErr'); e.style.display = m ? '' : 'none'; e.textContent = m || ''; }
  function ini(n) { n = String(n || 'K').trim(); return (n[0] || 'K').toUpperCase(); }
  function col(id) { return COLORS[id % COLORS.length]; }
  function beep() { if (!S.sound) return; try { var C = window.AudioContext || window.webkitAudioContext, a = beep.a || (beep.a = new C()), o = a.createOscillator(), g = a.createGain(); o.frequency.value = 760; g.gain.value = 0.08; o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime + 0.18); } catch (e) { } }

  // ----- thống kê + tab
  function renderStats(st) {
    var cards = [['Tổng tin nhắn hôm nay', st.msgs, 'msg', '#12b76a', '#e6f6ee', 'AI trả lời ' + st.ai + ' tin'], ['Khách hàng hôm nay', st.customers, 'users', '#2e90fa', '#e8f3ff', 'cuộc trò chuyện mới'], ['Đang hoạt động', st.active, 'clock', '#2e90fa', '#e8f0ff', 'trong 10 phút qua'], ['Đã giải quyết', st.done, 'check', '#12b76a', '#e6f6ee', 'hôm nay']];
    $('cpStats').innerHTML = cards.map(function (c) { return '<div class="cp-st"><div class="ci" style="background:' + c[4] + ';color:' + c[3] + '">' + ic(c[2], 22) + '</div><div><small>' + c[0] + '</small><b>' + c[1] + '</b><em>' + c[5] + '</em></div></div>'; }).join('');
  }
  function renderTabs() {
    var c = S.counts, t = [['all', 'Tất cả', c.all], ['new', 'Chờ xử lý', c.new], ['processing', 'Đang xử lý', c.processing], ['human', 'Nhân viên', c.human], ['done', 'Đã xong', c.done]];
    $('cpTabs').innerHTML = t.map(function (x) { return '<button data-t="' + x[0] + '" class="' + (S.tab === x[0] ? 'on' : '') + '">' + x[1] + '<span>' + (x[2] || 0) + '</span></button>'; }).join('');
  }
  function renderList() {
    var box = $('cpList');
    if (!S.items.length) { box.innerHTML = '<div class="cp-empty">Chưa có cuộc trò chuyện nào.</div>'; return; }
    box.innerHTML = S.items.map(function (c) {
      var who = c.last_role === 'ai' ? 'AI: ' : c.last_role === 'admin' ? 'Bạn: ' : '';
      return '<div class="cp-it' + (c.id === S.cur ? ' on' : '') + (c.unread_admin > 0 ? ' un' : '') + '" data-id="' + c.id + '"><div class="cp-av" style="background:' + col(c.id) + '">' + esc(ini(c.name)) + (c.mode === 'human' ? '<span class="md">' + ic('user', 11) + '</span>' : '<span class="md">' + ic('bot', 11) + '</span>') + '</div><div class="tx"><b><span>' + esc(c.name || 'Khách #' + c.id) + '</span><time>' + ago(c.last_at || c.created_at) + '</time></b><p>' + esc(who + (c.last || '')) + '</p><div class="meta2"><span class="st ' + c.status + '">' + SL[c.status] + '</span>' + (c.unread_admin > 0 ? '<span class="bdg" style="margin:0">' + c.unread_admin + '</span>' : '') + (c.phone ? '<span class="meta" style="margin:0">' + esc(c.phone) + '</span>' : '') + '</div></div></div>';
    }).join('');
  }
  function loadList(first) {
    return api('list', null, '&tab=' + encodeURIComponent(S.tab) + '&q=' + encodeURIComponent(S.q)).then(function (d) {
      if (!d.ok) { err('Không tải được danh sách: ' + (d.error || '')); return; } err('');
      S.items = d.items; S.counts = d.counts; S.pres = d.presence;
      renderStats(d.stats); renderTabs(); renderList();
      var ai = $('cpAi'); ai.className = 'cp-pill ' + (d.aiMode === 'off' ? '' : 'on'); ai.lastChild.textContent = 'AI: ' + ({ off: 'đang tắt', always: 'luôn trả lời', smart: d.away ? 'đang trực thay bạn' : 'chờ khi bạn vắng' }[d.aiMode] || d.aiMode);
      if (d.aiErr) { var p = String(d.aiErr).split('|'); ai.title = 'Lỗi AI gần nhất: ' + (p[1] || ''); }
      [].forEach.call($('cpPres').children, function (b) { b.classList.toggle('on', b.dataset.v === d.presence); });
      // báo khi có tin chưa đọc mới
      var sig = d.counts.unread || 0;
      if (!first && S.unreadSig >= 0 && sig > S.unreadSig) { beep(); document.title = '(' + sig + ') Chat mới | Quản trị'; try { if (window.Notification && Notification.permission === 'granted' && document.hidden) new Notification('Có tin nhắn chat mới', { body: 'Mở trang chat để trả lời' }); } catch (e) { } }
      if (sig === 0) document.title = 'Chat khách | Quản trị Nhịp';
      S.unreadSig = sig;
    }).catch(function () { err('Mất kết nối máy chủ.'); });
  }

  // ----- luồng chat
  function msgHtml(m, conv) {
    if (m.role === 'sys') return '<div class="cp-sy">' + esc(m.body) + '</div>';
    var k = m.role === 'visitor' ? 'v' : m.role === 'ai' ? 'i' : 'a';
    var nm = k === 'v' ? (conv.name || 'Khách') : k === 'i' ? 'Trợ lý AI' : (m.by || 'Nhân viên');
    return '<div class="cp-m ' + k + '" data-id="' + m.id + '"><div class="ma">' + ic(k === 'i' ? 'bot' : 'user', 16) + '</div><div><div class="bb">' + esc(m.body) + '</div><small>' + esc(nm) + ' · ' + hm(m.created_at) + '</small></div></div>';
  }
  function renderThreadShell() {
    var c = S.conv, h = $('cpTh');
    h.innerHTML = '<div class="cp-th-h"><button class="ib cp-back" id="cpBack" type="button">' + ic('back', 18) + '</button><div class="cp-av" style="background:' + col(c.id) + ';width:38px;height:38px">' + esc(ini(c.name)) + '</div><div class="nm"><b>' + esc(c.name || 'Khách #' + c.id) + '</b><small id="cpSub"></small></div>' +
      '<button class="btn ghost sm cp-mob" id="cpInfoB" type="button">Thông tin</button><button class="btn ghost sm" id="cpMode" type="button"></button><button class="btn sm" id="cpDone" type="button"></button></div>' +
      '<div class="cp-th" id="cpMsgs"></div>' +
      '<div class="cp-comp"><div class="cp-bar"><button type="button" id="cpQr">⚡ Trả lời nhanh</button><button type="button" id="cpDraft">' + ic('spark', 14) + ' AI gợi ý câu trả lời</button></div><div class="row"><textarea id="cpTa" placeholder="Nhập trả lời… (Enter để gửi, Shift+Enter xuống dòng, gõ / để chọn trả lời nhanh)" maxlength="1000"></textarea><button class="btn" id="cpSend" type="button">' + ic('send', 18) + '</button></div></div>';
    updateThreadHead();
  }
  function updateThreadHead() {
    var c = S.conv; if (!c) return;
    $('cpSub').textContent = (c.mode === 'human' ? 'Nhân viên đang xử lý' : 'AI đang trực') + (c.page ? ' · trang ' + c.page : '');
    $('cpMode').textContent = c.mode === 'human' ? 'Trả lại cho AI' : 'Nhận chat (tắt AI)';
    $('cpDone').textContent = c.status === 'done' ? 'Mở lại' : 'Đánh dấu xong';
  }
  function renderInfo() {
    var c = S.conv, b = $('cpInfo'); if (!c) { b.innerHTML = '<div class="cp-empty">Thông tin khách hàng sẽ hiện ở đây.</div>'; return; }
    b.innerHTML = '<div><h4>Thông tin khách hàng</h4><dl><dt>Tên</dt><dd><b>' + esc(c.name || '—') + '</b></dd><dt>Email</dt><dd>' + (c.email ? '<a href="mailto:' + esc(c.email) + '">' + esc(c.email) + '</a>' : '—') + '</dd><dt>SĐT</dt><dd>' + (c.phone ? '<a href="tel:' + esc(c.phone) + '">' + esc(c.phone) + '</a>' : '—') + '</dd><dt>Bắt đầu</dt><dd>' + hm(c.created_at) + '</dd><dt>Gần nhất</dt><dd>' + hm(c.last_at) + '</dd><dt>Trang</dt><dd>' + esc(c.page || '—') + '</dd><dt>Trạng thái</dt><dd><span class="st ' + c.status + '">' + SL[c.status] + '</span></dd><dt>Xử lý bởi</dt><dd>' + (c.mode === 'human' ? 'Nhân viên' : 'AI (' + (c.ai_count || 0) + ' tin)') + '</dd></dl><button class="cp-mob btn ghost sm" id="cpInfoX" type="button" style="margin-top:10px">Đóng</button></div>' +
      '<div><h4>Phân loại yêu cầu</h4><select id="cpCat">' + CATS.map(function (x) { return '<option value="' + esc(x) + '"' + (x === c.category ? ' selected' : '') + '>' + (x || '— Chưa phân loại —') + '</option>'; }).join('') + '</select></div>' +
      '<div><h4>Ghi chú nội bộ</h4><textarea id="cpNote" style="min-height:90px" placeholder="Khách không nhìn thấy ghi chú này">' + esc(c.note || '') + '</textarea><p style="margin:6px 0 0"><button class="btn sm" id="cpNoteS" type="button" style="width:100%">Lưu</button></p></div>' +
      '<div><h4>Thao tác nhanh</h4><div class="btns"><button id="cpEm" type="button">✉️ Gửi email</button><button id="cpDel" type="button" style="color:#b42318">🗑 Xóa chat</button></div></div>';
  }
  function openConv(id, silent) {
    S.cur = id; S.last = 0; S.msgs = [];
    $('cpGrid').classList.add('open'); renderList();
    return api('thread', null, '&id=' + id + '&after=0').then(function (d) {
      if (!d.ok) { err('Không mở được cuộc trò chuyện.'); return; }
      S.conv = d.conv; renderThreadShell(); renderInfo();
      addMsgs(d.msgs, true); wire(); loadList(true);
      if (history.replaceState) history.replaceState(null, '', '/admin/chat?id=' + id);
    });
  }
  function addMsgs(ms, first) {
    var box = $('cpMsgs'); if (!box) return 0; var n = 0;
    ms.forEach(function (m) { if (m.id > S.last) { S.last = m.id; box.insertAdjacentHTML('beforeend', msgHtml(m, S.conv)); n++; } });
    if (n) box.scrollTop = box.scrollHeight; return n;
  }
  function pollThread() {
    if (!S.cur || document.hidden) return;
    api('thread', null, '&id=' + S.cur + '&after=' + S.last).then(function (d) {
      if (!d.ok || S.cur !== d.conv.id) return;
      var changed = d.conv.status !== S.conv.status || d.conv.mode !== S.conv.mode;
      S.conv = d.conv; var n = addMsgs(d.msgs); if (changed) { updateThreadHead(); renderInfo(); wireInfo(); } if (n) loadList(true);
    }).catch(function () { });
  }

  // ----- thao tác
  function send() {
    var ta = $('cpTa'), body = ta.value.trim(); if (!body) return; $('cpSend').disabled = true;
    api('reply', { id: S.cur, body: body }).then(function (d) {
      if (d.ok) { ta.value = ''; ta.style.height = '44px'; S.conv.mode = 'human'; if (S.conv.status === 'new') S.conv.status = 'processing'; updateThreadHead(); renderInfo(); wireInfo(); pollThread(); loadList(true); } else err('Chưa gửi được: ' + (d.error || ''));
    }).then(function () { $('cpSend').disabled = false; ta.focus(); });
  }
  function popQuick(filter) {
    var comp = document.querySelector('.cp-comp'), old = $('cpPop'); if (old) old.remove();
    var f = (filter || '').toLowerCase(), list = quick.filter(function (q) { return !f || (q.title + q.body).toLowerCase().indexOf(f) >= 0; });
    var p = document.createElement('div'); p.className = 'cp-pop'; p.id = 'cpPop';
    p.innerHTML = list.length ? list.map(function (q) { return '<div data-b="' + esc(q.body) + '"><b>' + esc(q.title) + '</b><span>' + esc(q.body.slice(0, 90)) + '</span></div>'; }).join('') : '<div><span>Chưa có mẫu. Thêm ở Cài đặt chat > Gợi ý & trả lời nhanh.</span></div>';
    comp.appendChild(p);
    p.addEventListener('click', function (e) { var t = e.target.closest('div[data-b]'); if (!t) return; var ta = $('cpTa'); ta.value = t.dataset.b; ta.focus(); p.remove(); });
  }
  function wire() {
    $('cpSend').onclick = send; var ta = $('cpTa');
    ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
    ta.addEventListener('input', function () { ta.style.height = '44px'; ta.style.height = Math.min(140, ta.scrollHeight) + 'px'; var v = ta.value; if (v[0] === '/') popQuick(v.slice(1)); else { var o = $('cpPop'); if (o) o.remove(); } });
    $('cpQr').onclick = function () { if ($('cpPop')) $('cpPop').remove(); else popQuick(''); };
    $('cpDraft').onclick = function () { var b = $('cpDraft'); b.disabled = true; b.textContent = 'AI đang soạn…'; api('draft', { id: S.cur }).then(function (d) { if (d.ok && d.text) { $('cpTa').value = d.text; $('cpTa').focus(); } else err('AI chưa soạn được: ' + (d.error || 'chưa bật nhà AI nào trong Cài đặt AI (API)')); }).then(function () { b.disabled = false; b.innerHTML = ic('spark', 14) + ' AI gợi ý câu trả lời'; }); };
    $('cpMode').onclick = function () { var v = S.conv.mode === 'human' ? 'auto' : 'human'; api('mode', { id: S.cur, value: v }).then(function () { S.conv.mode = v; updateThreadHead(); renderInfo(); wireInfo(); loadList(true); }); };
    $('cpDone').onclick = function () { var v = S.conv.status === 'done' ? 'processing' : 'done'; api('status', { id: S.cur, value: v }).then(function () { S.conv.status = v; updateThreadHead(); renderInfo(); wireInfo(); loadList(true); }); };
    $('cpBack').onclick = function () { $('cpGrid').classList.remove('open'); };
    $('cpInfoB').onclick = function () { $('cpGrid').classList.add('showinfo'); };
    wireInfo();
  }
  function wireInfo() {
    var x = $('cpInfoX'); if (x) x.onclick = function () { $('cpGrid').classList.remove('showinfo'); };
    var cat = $('cpCat'); if (cat) cat.onchange = function () { api('category', { id: S.cur, value: cat.value }); };
    var ns = $('cpNoteS'); if (ns) ns.onclick = function () { api('note', { id: S.cur, value: $('cpNote').value }).then(function () { ns.textContent = 'Đã lưu ✓'; setTimeout(function () { ns.textContent = 'Lưu'; }, 1500); }); };
    var del = $('cpDel'); if (del) del.onclick = function () { if (confirm('Xóa cuộc trò chuyện này? Không thể khôi phục.')) api('delete', { id: S.cur }).then(function () { S.cur = 0; S.conv = null; $('cpTh').innerHTML = '<div class="cp-empty" style="margin:auto">Đã xóa.</div>'; renderInfo(); $('cpGrid').classList.remove('open'); loadList(true); }); };
    var em = $('cpEm'); if (em) em.onclick = mailModal;
  }
  function mailModal() {
    var c = S.conv; if (!c.email) { alert('Khách chưa để lại email.'); return; }
    fetch('/admin/mail-api?act=setup', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (d) {
      var mbs = d.mailboxes || []; if (!mbs.length) { alert('Chưa có hộp thư gửi. ' + (isAdmin ? 'Vào Cài đặt chat > Hộp thư gửi để thêm.' : 'Nhờ quản trị viên thêm.')); return; }
      $('cpMailBody').innerHTML = '<label>Gửi từ</label><select id="cmB">' + mbs.map(function (m) { return '<option value="' + m.id + '">' + esc(m.label) + ' — ' + esc(m.from_email) + '</option>'; }).join('') + '</select><label>Đến</label><input type="text" value="' + esc(c.email) + '" disabled><label>Tiêu đề</label><input type="text" id="cmS" value="Phản hồi từ chúng tôi"><label>Nội dung</label><textarea id="cmT" style="min-height:140px"></textarea><div class="msg err" id="cmE" style="display:none"></div><p style="display:flex;gap:8px;margin-top:12px"><button class="btn" id="cmGo" type="button">Gửi email</button><button class="btn ghost" id="cmX" type="button">Hủy</button></p>';
      $('cpMail').classList.add('on');
      $('cmX').onclick = function () { $('cpMail').classList.remove('on'); };
      $('cmGo').onclick = function () { var b = $('cmGo'); b.disabled = true; api('email', { id: S.cur, mailbox: Number($('cmB').value), subject: $('cmS').value, body: $('cmT').value }).then(function (r) { if (r.ok) { $('cpMail').classList.remove('on'); alert('Đã gửi email cho khách.'); } else { $('cmE').style.display = ''; $('cmE').textContent = r.error || 'Gửi lỗi'; } }).then(function () { b.disabled = false; }); };
    });
  }

  // ----- sự kiện chung
  $('cpTabs').addEventListener('click', function (e) { var b = e.target.closest('button[data-t]'); if (!b) return; S.tab = b.dataset.t; loadList(true); });
  $('cpList').addEventListener('click', function (e) { var it = e.target.closest('.cp-it'); if (it) openConv(Number(it.dataset.id)); });
  var qt; $('cpQ').addEventListener('input', function (e) { clearTimeout(qt); qt = setTimeout(function () { S.q = e.target.value.trim(); loadList(true); }, 300); });
  $('cpPres').addEventListener('click', function (e) { var b = e.target.closest('button[data-v]'); if (!b) return; api('presence', { value: b.dataset.v }).then(function () { loadList(true); }); });
  $('cpSnd').textContent = '🔔 Âm báo: ' + (S.sound ? 'bật' : 'tắt');
  $('cpSnd').onclick = function () { S.sound = !S.sound; localStorage.setItem('cp_snd', S.sound ? '1' : '0'); this.textContent = '🔔 Âm báo: ' + (S.sound ? 'bật' : 'tắt'); if (S.sound) { beep(); try { if (window.Notification && Notification.permission === 'default') Notification.requestPermission(); } catch (e) { } } };
  renderInfo();
  loadList(true).then(function () { var o = Number(root.dataset.open); if (o) openConv(o); });
  setInterval(function () { if (!document.hidden) loadList(false); }, 6000);
  setInterval(pollThread, 3000);
})();
