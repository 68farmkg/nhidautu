/* Hộp thư (thư liên hệ) + trả lời bằng nhiều hộp thư gửi. Dùng /admin/mail-api. */
(function () {
  'use strict';
  var root = document.getElementById('mp'); if (!root) return;
  var $ = function (id) { return document.getElementById(id); };
  var isAdmin = root.dataset.admin === '1';
  var S = { tab: 'all', q: '', items: [], counts: {}, cur: 0, boxes: [], tpl: [], last: 0 };
  var SL = { new: 'Mới', processing: 'Đang xử lý', done: 'Đã xong' };
  var COLORS = ['#12b76a', '#2e90fa', '#7a5af8', '#f79009', '#ee46bc', '#0ba5ec', '#e5484d', '#16b364'];
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function hm(iso) { var d = new Date(iso); return isNaN(d) ? '' : ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + ' ' + ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear(); }
  function get(q) { return fetch('/admin/mail-api?' + q, { credentials: 'same-origin', cache: 'no-store' }).then(function (r) { return r.json(); }); }
  function post(act, b) { b.act = act; return fetch('/admin/mail-api', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }).then(function (r) { return r.json(); }); }
  function err(m) { var e = $('mpErr'); e.style.display = m ? '' : 'none'; e.textContent = m || ''; }

  function tabs() {
    var c = S.counts, t = [['all', 'Tất cả', c.all], ['new', 'Mới', c.new], ['processing', 'Đang xử lý', c.processing], ['done', 'Đã xong', c.done]];
    $('mpTabs').innerHTML = t.map(function (x) { return '<button data-t="' + x[0] + '" class="' + (S.tab === x[0] ? 'on' : '') + '">' + x[1] + '<span>' + (x[2] || 0) + '</span></button>'; }).join('');
  }
  function list() {
    var b = $('mpList');
    if (!S.items.length) { b.innerHTML = '<div class="cp-empty">Chưa có thư nào.</div>'; return; }
    b.innerHTML = S.items.map(function (m) {
      return '<div class="cp-it' + (m.id === S.cur ? ' on' : '') + (m.status === 'new' ? ' un' : '') + '" data-id="' + m.id + '"><div class="cp-av" style="background:' + COLORS[m.id % 8] + '">' + esc((m.name || 'K')[0].toUpperCase()) + '</div><div class="tx"><b><span>' + esc(m.name) + '</span><time>' + hm(m.created_at).slice(6, 11) + '</time></b><p>' + esc(m.body.replace(/\s+/g, ' ')) + '</p><div class="meta2"><span class="st ' + m.status + '">' + SL[m.status] + '</span>' + (m.replies ? '<span class="meta" style="margin:0">↩ ' + m.replies + ' phản hồi</span>' : '') + '</div></div></div>';
    }).join('');
  }
  function load() {
    return get('act=list&tab=' + encodeURIComponent(S.tab) + '&q=' + encodeURIComponent(S.q)).then(function (d) {
      if (!d.ok) { err('Không tải được hộp thư: ' + (d.error || '')); return; } err('');
      S.items = d.items; S.counts = d.counts; tabs(); list();
    }).catch(function () { err('Mất kết nối máy chủ.'); });
  }
  function open(id) {
    S.cur = id; $('mpGrid').classList.add('open'); list();
    get('act=get&id=' + id).then(function (d) {
      if (!d.ok) { err('Không mở được thư.'); return; }
      var m = d.msg, st = m.status, sig = S.boxes.find(function (b) { return b.id === S.last; }) || S.boxes.find(function (b) { return b.is_default; }) || S.boxes[0];
      var thread = '<div class="mp-card"><div class="hd"><span><b>' + esc(m.name) + '</b> &lt;' + esc(m.email) + '&gt;' + (m.phone ? ' · ' + esc(m.phone) : '') + '</span><span>' + hm(m.created_at) + '</span></div><div class="bd">' + esc(m.body) + '</div></div>' +
        d.replies.map(function (r) { return '<div class="mp-card ' + (r.status === 'sent' ? 'me' : 'fail') + '"><div class="hd"><span>↩ ' + esc(r.by || 'Nhân viên') + ' · từ ' + esc(r.from_email) + ' → ' + esc(r.to_email) + '</span><span>' + hm(r.created_at) + '</span></div><div class="bd"><b>' + esc(r.subject) + '</b>\n' + esc(r.body) + '</div>' + (r.status !== 'sent' ? '<div class="meta" style="color:#b42318">Gửi lỗi: ' + esc(r.error) + '</div>' : '') + '</div>'; }).join('');
      var comp;
      if (!S.boxes.length) comp = '<div class="cs-note">Chưa có hộp thư gửi nào. ' + (isAdmin ? '<a href="/admin/cai-dat#mail"><b>Thêm hộp thư gửi</b></a> (Resend, Brevo, SendGrid, Mailgun, SMTP hoặc Gmail qua Apps Script) để trả lời khách ngay tại đây.' : 'Nhờ quản trị viên thêm hộp thư gửi.') + ' Tạm thời có thể <a href="mailto:' + esc(m.email) + '"><b>trả lời bằng ứng dụng mail trên máy</b></a>.</div>';
      else comp = '<div class="mp-comp"><b>Trả lời khách</b><div class="r2"><div><label>Gửi từ hộp thư</label><select id="mpFrom">' + S.boxes.map(function (b) { return '<option value="' + b.id + '"' + (sig && sig.id === b.id ? ' selected' : '') + '>' + esc(b.label) + ' — ' + esc(b.from_email) + '</option>'; }).join('') + '</select></div><div><label>Đến</label><input type="text" id="mpTo" value="' + esc(m.email) + '"></div></div><label>Tiêu đề</label><input type="text" id="mpSub" value="Re: Phản hồi liên hệ của bạn"><div style="display:flex;justify-content:space-between;align-items:end;gap:8px;flex-wrap:wrap"><label style="margin-bottom:0">Nội dung</label><select id="mpTpl" style="width:auto;max-width:220px"><option value="">⚡ Chèn mẫu trả lời…</option>' + S.tpl.map(function (t, i) { return '<option value="' + i + '">' + esc(t.title) + '</option>'; }).join('') + '</select></div><textarea id="mpBody" placeholder="Xin chào ' + esc(m.name) + ',"></textarea><div class="meta" id="mpSig"></div><div class="msg err" id="mpSE" style="display:none"></div><p style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px"><button class="btn" id="mpSend" type="button">Gửi email</button><label class="chk" style="margin:0"><input type="checkbox" id="mpDone"> Gửi xong đánh dấu “Đã xong”</label></p></div>';
      $('mpDet').innerHTML = '<div class="cp-th-h"><button class="ib cp-back" id="mpBack" type="button">←</button><div class="nm"><b>' + esc(m.name) + '</b><small>' + esc(m.email) + '</small></div>' + ['new', 'processing', 'done'].map(function (k) { return '<button class="btn sm ' + (st === k ? '' : 'ghost') + '" data-s="' + k + '" type="button">' + SL[k] + '</button>'; }).join('') + '<button class="btn red sm" id="mpDel" type="button">Xóa</button></div><div class="mp-det">' + thread + comp + '<div><label>Ghi chú nội bộ</label><textarea id="mpNote" style="min-height:70px">' + esc(m.note || '') + '</textarea><p><button class="btn ghost sm" id="mpNoteS" type="button">Lưu ghi chú</button></p></div></div>';
      $('mpBack').onclick = function () { $('mpGrid').classList.remove('open'); };
      [].forEach.call($('mpDet').querySelectorAll('[data-s]'), function (b) { b.onclick = function () { post('status', { id: id, value: b.dataset.s }).then(function () { open(id); load(); }); }; });
      $('mpNoteS').onclick = function () { post('note', { id: id, value: $('mpNote').value }).then(function () { $('mpNoteS').textContent = 'Đã lưu ✓'; }); };
      $('mpDel').onclick = function () { if (confirm('Xóa thư này và các phản hồi?')) post('delete', { id: id }).then(function () { S.cur = 0; $('mpDet').innerHTML = '<div class="cp-empty" style="margin:auto">Đã xóa.</div>'; $('mpGrid').classList.remove('open'); load(); }); };
      if (S.boxes.length) {
        var showSig = function () { var b = S.boxes.find(function (x) { return x.id === Number($('mpFrom').value); }); $('mpSig').textContent = b && b.signature ? 'Chữ ký tự thêm: ' + b.signature.replace(/\n/g, ' / ') : ''; };
        $('mpFrom').onchange = showSig; showSig();
        $('mpTpl').onchange = function () { var t = S.tpl[Number(this.value)]; if (t) $('mpBody').value = ($('mpBody').value ? $('mpBody').value + '\n\n' : '') + t.body; this.value = ''; };
        $('mpSend').onclick = function () {
          var b = $('mpSend'); b.disabled = true; b.textContent = 'Đang gửi…'; $('mpSE').style.display = 'none';
          post('send', { id: id, mailbox: Number($('mpFrom').value), to: $('mpTo').value, subject: $('mpSub').value, body: $('mpBody').value, done: $('mpDone').checked }).then(function (r) {
            if (r.ok) { S.last = Number($('mpFrom').value); open(id); load(); } else { $('mpSE').style.display = ''; $('mpSE').textContent = r.error || 'Gửi lỗi'; open(id); }
          }).catch(function () { $('mpSE').style.display = ''; $('mpSE').textContent = 'Mất kết nối.'; }).then(function () { b.disabled = false; b.textContent = 'Gửi email'; });
        };
      }
    });
  }
  $('mpTabs').addEventListener('click', function (e) { var b = e.target.closest('button[data-t]'); if (b) { S.tab = b.dataset.t; load(); } });
  $('mpList').addEventListener('click', function (e) { var it = e.target.closest('.cp-it'); if (it) open(Number(it.dataset.id)); });
  var qt; $('mpQ').addEventListener('input', function (e) { clearTimeout(qt); qt = setTimeout(function () { S.q = e.target.value.trim(); load(); }, 300); });
  get('act=setup').then(function (d) { if (d.ok) { S.boxes = d.mailboxes; S.tpl = d.templates; S.last = d.last; } }).then(load).then(function () { var o = Number(root.dataset.open); if (o) open(o); });
  setInterval(function () { if (!document.hidden) load(); }, 20000);
})();
