/* Cửa sổ chat cho khách. Nhúng bằng <script src="/chat.js" data-title data-welcome defer> */
(function () {
  var me = document.currentScript; if (!me || window.__nc) return; window.__nc = 1;
  var title = me.getAttribute('data-title') || 'Hỗ trợ trực tuyến', welcome = me.getAttribute('data-welcome') || '';
  var S = { get: function (k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }, set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  var token = S.get('nc_t');
  if (!/^[a-z0-9]{24,48}$/.test(token)) { var a = new Uint8Array(16); (window.crypto || window.msCrypto).getRandomValues(a); token = Array.prototype.map.call(a, function (x) { return ('0' + x.toString(36)).slice(-2); }).join('').slice(0, 32); if (token.length < 24) token = (token + 'abcdefghijklmnopqrstuvwx').slice(0, 24); S.set('nc_t', token); }
  var last = Number(S.get('nc_l')) || 0, unread = 0, open = false, sending = false, timer = null, seen = {};
  function el(t, c, txt) { var e = document.createElement(t); if (c) e.className = c; if (txt) e.textContent = txt; return e; }
  var btn = el('button', 'nc-btn'); btn.type = 'button'; btn.setAttribute('aria-label', 'Chat với chúng tôi');
  btn.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4z"/></svg>';
  var badge = el('span', 'nc-n'); btn.appendChild(badge);
  var box = el('div', 'nc-box'); box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', title);
  var hd = el('div', 'nc-h'); hd.appendChild(el('b', '', title)); var x = el('button', '', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Đóng'); hd.appendChild(x);
  var list = el('div', 'nc-l'), form = el('div', 'nc-f');
  var nm = el('input', 'nc-name'); nm.type = 'text'; nm.placeholder = 'Tên của bạn (không bắt buộc)'; nm.maxLength = 60; nm.value = S.get('nc_n');
  var row = el('div', 'nc-row'), ta = el('textarea'); ta.placeholder = 'Nhập tin nhắn…'; ta.maxLength = 1000; ta.rows = 1;
  var send = el('button', '', 'Gửi'); send.type = 'button'; row.appendChild(ta); row.appendChild(send);
  form.appendChild(nm); form.appendChild(row);
  box.appendChild(hd); box.appendChild(list); box.appendChild(form);
  function add(role, text, id) {
    if (id) { if (seen[id]) return; seen[id] = 1; }
    var m = el('div', 'nc-m ' + (role === 'visitor' ? 'v' : role === 'admin' ? 'a' : 's'), text); list.appendChild(m); list.scrollTop = list.scrollHeight;
  }
  function setBadge() { badge.textContent = unread > 9 ? '9+' : String(unread); badge.className = 'nc-n' + (unread ? ' on' : ''); }
  function poll() {
    if (document.hidden) return;
    fetch('/api/chat?token=' + token + '&after=' + last, { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (d) {
      if (!d || !d.ok) return;
      (d.msgs || []).forEach(function (m) {
        if (m.id > last) last = m.id; S.set('nc_l', String(last));
        if (!seen[m.id]) { add(m.role, m.body, m.id); if (m.role === 'admin' && !open) { unread++; setBadge(); } }
      });
    }).catch(function () {});
  }
  function schedule() { clearInterval(timer); timer = setInterval(poll, open ? 4000 : 20000); }
  function toggle(on) {
    open = on; box.className = 'nc-box' + (on ? ' on' : '');
    if (on) { unread = 0; setBadge(); poll(); setTimeout(function () { ta.focus(); }, 50); document.body.style.overflow = window.innerWidth <= 560 ? 'hidden' : ''; } else document.body.style.overflow = '';
    schedule();
  }
  function submit() {
    var body = ta.value.trim(); if (!body || sending) return; sending = true; send.disabled = true;
    S.set('nc_n', nm.value.trim());
    fetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: token, body: body, name: nm.value.trim(), page: location.pathname }) })
      .then(function (r) { return r.json().then(function (d) { return [r.status, d]; }); })
      .then(function (a) {
        if (a[1] && a[1].ok) { ta.value = ''; nm.style.display = 'none'; add('visitor', body, a[1].id); if (a[1].id > last) { last = a[1].id; S.set('nc_l', String(last)); } }
        else add('sys', a[0] === 429 ? 'Bạn gửi hơi nhanh, vui lòng đợi một chút.' : 'Chưa gửi được tin. Vui lòng thử lại.');
      }).catch(function () { add('sys', 'Mất kết nối. Vui lòng thử lại.'); })
      .then(function () { sending = false; send.disabled = false; });
  }
  btn.addEventListener('click', function () { toggle(!open); });
  x.addEventListener('click', function () { toggle(false); });
  send.addEventListener('click', submit);
  ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } });
  document.addEventListener('click', function (e) { var t = e.target; while (t && t !== document) { if (t.hasAttribute && t.hasAttribute('data-open-chat')) { e.preventDefault(); toggle(true); return; } t = t.parentNode; } });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && open) toggle(false); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) poll(); });
  document.body.appendChild(btn); document.body.appendChild(box);
  if (welcome) add('sys', welcome);
  if (last || S.get('nc_n')) nm.style.display = S.get('nc_n') ? 'none' : '';
  // tải lịch sử cuộc trò chuyện cũ (nếu có)
  fetch('/api/chat?token=' + token + '&after=0', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (d) {
    if (d && d.ok && d.msgs && d.msgs.length) { nm.style.display = 'none'; d.msgs.forEach(function (m) { if (m.id > last) last = m.id; add(m.role, m.body, m.id); }); S.set('nc_l', String(last)); }
  }).catch(function () {});
  schedule();
})();
