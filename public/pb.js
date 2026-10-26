/* Page Builder Pro - trình dựng. Dữ liệu khởi tạo trong <script id="pb-boot" type="application/json">.
   Canvas = trang thật (iframe, render bởi /admin/pb-preview) + pb-canvas.js để chọn/kéo/sửa chữ trực tiếp. Mọi thay đổi lưu qua /admin/pb-api (server kiểm tra lại schema). */
(function () {
  'use strict';
  var boot = JSON.parse(document.getElementById('pb-boot').textContent);
  var $ = function (s, r) { return (r || document).querySelector(s); }, $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var uid = function () { return Math.random().toString(36).slice(2, 9); };
  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };
  function h(tag, a, kids) {
    var e = document.createElement(tag);
    for (var k in (a || {})) { var v = a[k]; if (v === false || v == null) continue; if (k === 'text') e.textContent = v; else if (k === 'html') e.innerHTML = v; else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v); }
    (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  var defs = {}; boot.defs.forEach(function (d) { defs[d.type] = d; });
  var DEV = { desktop: 'd', tablet: 't', mobile: 'm' }, DEVW = { desktop: '100%', tablet: '820px', mobile: '390px' }, DEVN = { desktop: 'Máy tính', tablet: 'Tablet', mobile: 'Điện thoại' };
  var LAYOUTS = [['12', '1 cột'], ['6-6', '2 cột đều'], ['4-8', '1/3 + 2/3'], ['8-4', '2/3 + 1/3'], ['3-9', '1/4 + 3/4'], ['9-3', '3/4 + 1/4'], ['4-4-4', '3 cột đều'], ['3-6-3', 'Giữa rộng'], ['3-3-3-3', '4 cột đều'], ['2-2-2-2-2-2', '6 cột đều']];
  var SPANS = [[12, 'Cả hàng'], [9, '3/4'], [8, '2/3'], [6, '1/2'], [4, '1/3'], [3, '1/4'], [2, '1/6']];
  var S = { doc: boot.doc, id: boot.page.id, status: boot.page.status, sel: null, zone: null, dev: 'desktop', area: 'main', hist: [], hp: -1, dirty: false, busy: false, preview: false, tab: 'right-content', ltab: 'tpl', tpls: null, seq: 0, lastSave: boot.draft ? boot.draft.updated_at : '' };
  var PBX = window.PBX = { drag: null, get previewMode() { return S.preview; } };

  // ===== tiện ích cây khối =====
  var parts = function (l) { var a = String(l || '6-6').split('-').map(Number).filter(function (n) { return n >= 1 && n <= 12; }); return a.length && a.reduce(function (x, y) { return x + y; }, 0) <= 12 ? a : [12]; };
  function zoneArr(key) {
    if (key === 'root') return S.doc.blocks; if (key === 'side') return S.doc.side;
    var p = String(key).split(':'), f = find(p[0]); if (!f) return null; var b = f.b;
    return b.children ? b.children : (b.cols ? b.cols[+p[1] || 0] || null : null);
  }
  function walk(cb) {
    (function rec(arr, zone, depth, parent) {
      for (var i = 0; i < arr.length; i++) {
        var b = arr[i]; if (cb(b, arr, i, zone, depth, parent) === true) return true;
        if (b.children && rec(b.children, b.id + ':0', depth + 1, b)) return true;
        if (b.cols) for (var c = 0; c < b.cols.length; c++) if (rec(b.cols[c], b.id + ':' + c, depth + 1, b)) return true;
      }
    })(S.doc.blocks, 'root', 0, null) || (function () { return (function rec2(arr, zone, depth, parent) { for (var i = 0; i < arr.length; i++) { var b = arr[i]; if (cb(b, arr, i, zone, depth, parent) === true) return true; if (b.children && rec2(b.children, b.id + ':0', depth + 1, b)) return true; if (b.cols) for (var c = 0; c < b.cols.length; c++) if (rec2(b.cols[c], b.id + ':' + c, depth + 1, b)) return true; } })(S.doc.side, 'side', 0, null); })();
  }
  function find(id) { var r = null; walk(function (b, arr, i, zone, depth, parent) { if (b.id === id) { r = { b: b, arr: arr, i: i, zone: zone, depth: depth, parent: parent }; return true; } }); return r; }
  function zoneDepth(key) { if (key === 'root' || key === 'side') return 0; var f = find(String(key).split(':')[0]); return f ? f.depth + 1 : 99; }
  function contains(b, id) { var r = false; (function rec(x) { if (x.id === id) r = true; (x.children || []).forEach(rec); (x.cols || []).forEach(function (c) { c.forEach(rec); }); })(b); return r; }
  function syncCols(b) { var n = parts(b.props.layout).length, c = b.cols || []; while (c.length < n) c.push([]); while (c.length > n) { var x = c.pop(); c[n - 1] = c[n - 1].concat(x); } b.cols = c; }
  function styleDef(full) { return { sp: 12, sm: 12, hp: false, hm: false, py: 0, bg: '', al: '', full: !!full }; }
  function newBlock(type) {
    var d = defs[type]; if (!d) return null; var p = {};
    d.fields.forEach(function (f) { if (f.def !== undefined) p[f.k] = f.def; });
    var b = { id: uid(), type: type, props: p, style: styleDef(d.full) };
    if (d.container === 'list') b.children = []; if (d.container === 'cols') { b.cols = []; syncCols(b); }
    return b;
  }
  function reid(b) { b.id = uid(); (b.children || []).forEach(reid); (b.cols || []).forEach(function (c) { c.forEach(reid); }); return b; }
  function canPut(b, zone) { var d = zoneDepth(zone), def = defs[b.type]; return d <= 5 && (!(def && def.container) || d <= 4); }
  var lockedForMe = function (b) { return !boot.isAdmin && b.style && b.style.x && b.style.x.lock === 'admin'; };

  // ===== lịch sử hoàn tác =====
  var snap = function () { return JSON.stringify(S.doc); }, lastKey = '', lastT = 0, rtimer = null;
  function commit(key, opt) {
    var s = snap(), now = Date.now();
    if (key && key === lastKey && now - lastT < 900 && S.hp > 0) S.hist[S.hp] = s;
    else { S.hist = S.hist.slice(0, S.hp + 1); S.hist.push(s); if (S.hist.length > 100) S.hist.shift(); S.hp = S.hist.length - 1; }
    lastKey = key || ''; lastT = now; markDirty(); histUi();
    if (!opt || !opt.norender) scheduleRender();
    treeUi();
  }
  function histUi() { $('#pb-undo').disabled = S.hp <= 0; $('#pb-redo').disabled = S.hp >= S.hist.length - 1; }
  function restoreSnap(i) { S.hp = i; S.doc = JSON.parse(S.hist[i]); lastKey = ''; if (S.sel && !find(S.sel)) S.sel = null; markDirty(); histUi(); syncFields(); fullUi(); scheduleRender(); }
  function undo() { if (S.hp > 0) restoreSnap(S.hp - 1); }
  function redo() { if (S.hp < S.hist.length - 1) restoreSnap(S.hp + 1); }

  // ===== thao tác khối =====
  function insertAt(zone, idx, b) { var a = zoneArr(zone); if (!a || !canPut(b, zone)) { toast('Không thể đặt khối vào đây (lồng quá sâu).', 1); return false; } a.splice(Math.min(idx, a.length), 0, b); return true; }
  function addBlock(type, where) {
    var b = newBlock(type); if (!b) return; var z = where || insertTarget();
    if (insertAt(z.zone, z.idx, b)) { S.sel = b.id; S.zone = null; commit('add'); select(b.id, { scroll: 1 }); }
  }
  function insertTarget() {
    var rootKey = S.area === 'side' ? 'side' : 'root';
    if (S.zone && zoneArr(S.zone)) return { zone: S.zone, idx: 1e9 };
    if (S.sel) { var f = find(S.sel); if (f) { var d = defs[f.b.type]; if (d && d.container === 'list') return { zone: f.b.id + ':0', idx: 1e9 }; if (d && d.container === 'cols') return { zone: f.b.id + ':0', idx: 1e9 }; return { zone: f.zone, idx: f.i + 1 }; } }
    return { zone: rootKey, idx: 1e9 };
  }
  function removeBlock(id) { var f = find(id); if (!f) return; if (lockedForMe(f.b)) return toast('Khối này bị khóa, chỉ quản trị viên được xóa.', 1); if (f.b.children && f.b.children.length || (f.b.cols || []).some(function (c) { return c.length; })) if (!confirm('Xóa khối này và mọi khối bên trong?')) return; f.arr.splice(f.i, 1); if (S.sel === id || contains(f.b, S.sel)) S.sel = null; commit('del'); fullUi(); }
  function dupBlock(id) { var f = find(id); if (!f) return; var c = reid(clone(f.b)); if (!boot.isAdmin && c.style && c.style.x) c.style.x.lock = ''; f.arr.splice(f.i + 1, 0, c); S.sel = c.id; commit('dup'); select(c.id, { scroll: 1 }); }
  function moveBy(id, d) { var f = find(id); if (!f) return; var j = f.i + d; if (j < 0 || j >= f.arr.length) return; var t = f.arr.splice(f.i, 1)[0]; f.arr.splice(j, 0, t); commit('move'); }
  function moveTo(id, zone, idx) {
    var f = find(id); if (!f) return; if (zone.split(':')[0] === id || contains(f.b, zone.split(':')[0])) return toast('Không thể đặt khối vào chính nó.', 1);
    if (!canPut(f.b, zone)) return toast('Lồng quá sâu, không thể đặt vào đây.', 1);
    var dst = zoneArr(zone); if (!dst) return; f.arr.splice(f.i, 1); if (dst === f.arr && f.i < idx) idx--; dst.splice(Math.min(idx, dst.length), 0, f.b); S.sel = id; commit('move'); fullUi();
  }
  PBX.drop = function (zone, idx) {
    var d = PBX.drag; PBX.drag = null; if (!d) return;
    if (d.kind === 'new') { var b = newBlock(d.type); if (b && insertAt(zone, idx, b)) { S.sel = b.id; commit('add'); select(b.id, { scroll: 1 }); } }
    else if (d.kind === 'tpl') { var arr = clone(d.blocks).map(reid), ok = true; arr.forEach(function (b, i) { if (ok && !insertAt(zone, idx + i, b)) ok = false; }); if (ok) { commit('tpl'); if (arr[0]) select(arr[0].id, { scroll: 1 }); } }
    else if (d.kind === 'move') moveTo(d.id, zone, idx);
  };
  PBX.zoneArr = zoneArr;

  // ===== chọn khối =====
  function select(id, o) { S.sel = id; S.zone = null; rightUi(); treeUi(); canvasSel(o && o.scroll); if (id) showRight(); }
  PBX.canvasEvent = function (t, v) { if (t === 'select') { if (v) select(v); else select(null); } else if (t === 'zone') { S.zone = v; S.sel = null; rightUi(); canvasSel(); toast('Đã chọn vùng trống. Bấm “＋ Thêm khối” hoặc kéo khối vào.'); openLeft('blocks'); } else if (t === 'up') moveBy(v, -1); else if (t === 'down') moveBy(v, 1); else if (t === 'dup') dupBlock(v); else if (t === 'del') removeBlock(v); else if (t === 'prop') setProp(v.id, v.k, v.v); };
  PBX.key = keyHandler; PBX.canvasReady = function () { canvasSel(); }; PBX.find = find;
  var cw = function () { try { return $('#pb-canvas').contentWindow.PBC || null; } catch (e) { return null; } };
  function canvasSel(scroll) { var c = cw(); if (c) c.select(S.sel, S.zone, !!scroll); }

  // ===== điều khiển dùng chung =====
  function ctl(spec, val, onset) {
    var t = spec.type || 'text', c, w;
    if (t === 'check') { c = h('input', { type: 'checkbox' }); c.checked = !!val; c.addEventListener('change', function () { onset(c.checked); }); return h('label', { class: 'chk' }, [c, h('span', { text: spec.label })]); }
    if (t === 'textarea') { c = h('textarea', { rows: spec.rows || 4 }); c.value = val == null ? '' : val; }
    else if (t === 'select') { c = h('select'); (spec.options || []).forEach(function (o) { var op = h('option', { value: o[0], text: o[1] }); if (String(val == null ? '' : val) === String(o[0])) op.selected = true; c.appendChild(op); }); }
    else if (t === 'number') { c = h('input', { type: 'number', step: spec.step || 'any' }); c.value = val == null ? '' : val; if (spec.ph) c.placeholder = spec.ph; }
    else if (t === 'datetime') { c = h('input', { type: 'datetime-local' }); c.value = val || ''; }
    else if (t === 'color') {
      var tx = h('input', { type: 'text', placeholder: '#12b76a' }); tx.value = val || ''; var pk = h('input', { type: 'color', class: 'pbx-cp' }); pk.value = /^#[0-9a-f]{6}$/i.test(val || '') ? val : '#12b76a';
      tx.addEventListener('input', function () { onset(tx.value.trim()); if (/^#[0-9a-f]{6}$/i.test(tx.value)) pk.value = tx.value; }); pk.addEventListener('input', function () { tx.value = pk.value; onset(pk.value); });
      var clr = h('button', { type: 'button', class: 'btn ghost sm', title: 'Xóa màu', 'aria-label': 'Xóa màu', text: '×', onclick: function () { tx.value = ''; onset(''); } });
      w = h('div', { class: 'pbx-f' }, [h('label', { text: spec.label }), h('div', { class: 'pbx-crow' }, [pk, tx, clr])]); return w;
    }
    else { c = h('input', { type: 'text' }); c.value = val == null ? '' : val; if (spec.ph) c.placeholder = spec.ph; if (t === 'url' || t === 'image') c.setAttribute('list', 'pb-links'); }
    c.addEventListener(t === 'select' || t === 'datetime' ? 'change' : 'input', function () { onset(t === 'number' ? (c.value === '' ? '' : Number(c.value)) : c.value); });
    w = h('div', { class: 'pbx-f' }, [h('label', { text: spec.label }), c]); if (spec.hint) w.appendChild(h('div', { class: 'meta', text: spec.hint })); return w;
  }
  var fieldTimer = {};
  function setProp(id, k, v, render) { var f = find(id); if (!f) return; if (lockedForMe(f.b)) return toast('Khối bị khóa.', 1); f.b.props[k] = v; commit(id + ':' + k); }
  function xOf(b, create) {
    if (!b.style.x && create) b.style.x = { d: {}, t: {}, m: {}, fx: { anim: '', hover: '', dur: 0.6, delay: 0 }, cond: { from: '', to: '', days: [], param: '' }, lock: '', cls: '', anchor: '', css: '' };
    return b.style.x;
  }
  function setX(b, dev, k, v) { var x = xOf(b, true), r = x[dev]; if (v === '' || v == null || v === false) delete r[k]; else r[k] = v; commit(b.id + ':x' + dev + k); }

  // ===== bảng cài đặt bên phải =====
  var FONTOPT = Object.keys(boot.fonts).map(function (k) { return [k, boot.fonts[k]]; });
  var GRADOPT = [['', 'Không'], ['brand', 'Xanh thương hiệu'], ['night', 'Đêm'], ['sky', 'Trời'], ['mint', 'Bạc hà'], ['sun', 'Nắng']];
  var STYLE_GROUPS = [
    ['Kích thước', [['w', 'Chiều rộng', 'text', 'vd 100%, 320px'], ['maxw', 'Rộng tối đa', 'text', 'vd 720px'], ['minh', 'Cao tối thiểu (px)', 'number']]],
    ['Khoảng cách', [['pt', 'Đệm trên (px)', 'number'], ['pb', 'Đệm dưới (px)', 'number'], ['pl', 'Đệm trái (px)', 'number'], ['pr', 'Đệm phải (px)', 'number'], ['mt', 'Lề trên (px)', 'number'], ['mb', 'Lề dưới (px)', 'number']]],
    ['Nền', [['bg', 'Màu nền', 'color'], ['grad', 'Nền chuyển màu', 'select', GRADOPT], ['bgimg', 'Ảnh nền (https://…)', 'text'], ['bgsize', 'Cỡ ảnh nền', 'select', [['', 'Phủ kín'], ['contain', 'Vừa khung'], ['auto', 'Gốc']]], ['bgpos', 'Vị trí ảnh nền', 'select', [['', 'Giữa'], ['top', 'Trên'], ['bottom', 'Dưới'], ['left', 'Trái'], ['right', 'Phải']]]]],
    ['Chữ', [['color', 'Màu chữ', 'color'], ['font', 'Font chữ', 'select', FONTOPT], ['fs', 'Cỡ chữ (px)', 'number'], ['fw', 'Độ đậm', 'select', [['', 'Mặc định'], ['400', 'Thường'], ['500', 'Vừa'], ['600', 'Đậm vừa'], ['700', 'Đậm'], ['800', 'Rất đậm']]], ['lh', 'Giãn dòng', 'number'], ['ls', 'Giãn chữ (px)', 'number'], ['al', 'Căn chữ', 'select', [['', 'Mặc định'], ['left', 'Trái'], ['center', 'Giữa'], ['right', 'Phải'], ['justify', 'Đều hai bên']]]]],
    ['Viền & bóng', [['bw', 'Độ dày viền (px)', 'number'], ['bs', 'Kiểu viền', 'select', [['', 'Liền'], ['dashed', 'Nét đứt'], ['dotted', 'Chấm']]], ['bc', 'Màu viền', 'color'], ['radius', 'Bo góc (px)', 'number'], ['shadow', 'Bóng đổ', 'select', [['', 'Không'], ['sm', 'Nhẹ'], ['md', 'Vừa'], ['lg', 'Mạnh'], ['glow', 'Phát sáng']]]]],
    ['Hiệu ứng', [['opacity', 'Độ trong suốt (0-100)', 'number']]],
  ];
  function showRight() { $('#pbx').classList.add('r-open'); }
  function rightUi() {
    var box = $('#pb-right'); box.innerHTML = '';
    var f = S.sel ? find(S.sel) : null;
    if (!f) return pagePanel(box);
    var b = f.b, d = defs[b.type] || { label: b.type, fields: [] }, lock = lockedForMe(b);
    var head = h('div', { class: 'pbx-rh' }, [h('b', { text: d.label }), h('span', { class: 'pbx-sp' }),
      h('button', { type: 'button', class: 'pbx-ic', title: 'Lên', text: '↑', onclick: function () { moveBy(b.id, -1); } }), h('button', { type: 'button', class: 'pbx-ic', title: 'Xuống', text: '↓', onclick: function () { moveBy(b.id, 1); } }),
      h('button', { type: 'button', class: 'pbx-ic', title: 'Nhân đôi', text: '⧉', onclick: function () { dupBlock(b.id); } }), h('button', { type: 'button', class: 'pbx-ic red', title: 'Xóa', text: '🗑', onclick: function () { removeBlock(b.id); } }),
      h('button', { type: 'button', class: 'pbx-ic', title: 'Bỏ chọn', text: '×', onclick: function () { select(null); } })]);
    box.appendChild(head);
    if (d.inactive) box.appendChild(h('div', { class: 'msg err', text: 'Plugin của khối này đang tắt: khối được giữ nguyên nhưng không hiển thị ngoài website.' }));
    if (lock) box.appendChild(h('div', { class: 'msg', text: '🔒 Khối bị khóa: chỉ quản trị viên được sửa.' }));
    var tabs = [['c', 'Nội dung'], ['s', 'Kiểu'], ['v', 'Hiển thị'], ['a', 'Nâng cao']], cur = S.rtab || 'c';
    var tb = h('div', { class: 'pbx-rt' }); tabs.forEach(function (t) { tb.appendChild(h('button', { type: 'button', class: cur === t[0] ? 'on' : '', text: t[1], onclick: function () { S.rtab = t[0]; rightUi(); } })); }); box.appendChild(tb);
    var body = h('div', { class: 'pbx-rb' }); if (lock) body.className += ' disabled';
    if (cur === 'c') contentPanel(body, b, d); else if (cur === 's') stylePanel(body, b); else if (cur === 'v') visPanel(body, b, d); else advPanel(body, b);
    box.appendChild(body);
  }
  function contentPanel(box, b, d) {
    d.fields.forEach(function (fl) {
      box.appendChild(ctl(fl, b.props[fl.k], function (v) { b.props[fl.k] = v; commit(b.id + ':' + fl.k); if (d.container === 'cols' && fl.k === 'layout') { syncCols(b); rightUi(); } }));
    });
    if (!d.fields.length) box.appendChild(h('div', { class: 'meta', text: 'Khối này không có tùy chọn nội dung.' }));
    if (b.type === 'pb-ai') aiUi(box, b);
    if (b.type === 'pb-reusable') reuseUi(box, b);
    if (b.props._src) box.appendChild(h('div', { class: 'pbx-sec' }, [h('b', { text: 'Khối này tách ra từ khối dùng chung #' + b.props._src }), h('button', { type: 'button', class: 'btn sm', text: 'Cập nhật lại khối dùng chung', onclick: function () { reUpdate(b); } })]));
    if (b.type !== 'pb-reusable') box.appendChild(h('div', { class: 'pbx-sec' }, [h('button', { type: 'button', class: 'btn ghost sm', text: 'Lưu khối thành mẫu khối', onclick: function () { saveTpl('block', [b]); } }), ' ', h('button', { type: 'button', class: 'btn ghost sm', text: 'Lưu thành khối dùng chung', onclick: function () { makeReusable(b); } })]));
    var g = h('fieldset', { class: 'pbx-fs' }, [h('legend', { text: 'Vị trí trong lưới' })]);
    g.appendChild(ctl({ label: 'Độ rộng trên máy tính', type: 'select', options: SPANS }, b.style.sp, function (v) { b.style.sp = +v; commit(b.id + ':sp'); }));
    g.appendChild(ctl({ label: 'Độ rộng trên điện thoại', type: 'select', options: SPANS }, b.style.sm, function (v) { b.style.sm = +v; commit(b.id + ':sm'); }));
    g.appendChild(ctl({ label: 'Tràn hết chiều ngang (khối ngoài cùng)', type: 'check' }, b.style.full, function (v) { b.style.full = v; commit(b.id + ':full'); }));
    box.appendChild(g);
  }
  function stylePanel(box, b) {
    var dk = DEV[S.dev], x = xOf(b, true), r = x[dk];
    box.appendChild(h('div', { class: 'pbx-devnote' }, [h('span', { text: 'Đang chỉnh cho: ' }), h('b', { text: DEVN[S.dev] }), h('span', { class: 'meta', text: S.dev === 'desktop' ? ' (áp dụng cho mọi màn hình nếu không đặt riêng)' : ' (chỉ ghi đè ở màn hình này trở xuống)' })]));
    STYLE_GROUPS.forEach(function (g, gi) {
      var fs = h('fieldset', { class: 'pbx-fs' }, [h('legend', { text: g[0] })]);
      g[1].forEach(function (s) { fs.appendChild(ctl({ label: s[1], type: s[2], options: s[3], ph: s[3] && typeof s[3] === 'string' ? s[3] : (s[4] || (x.d[s[0]] != null && dk !== 'd' ? String(x.d[s[0]]) : '')) }, r[s[0]], function (v) { setX(b, dk, s[0], v); })); });
      if (g[0] === 'Hiệu ứng') {
        fs.appendChild(ctl({ label: 'Hiệu ứng xuất hiện khi cuộn', type: 'select', options: [['', 'Không'], ['fade', 'Mờ dần'], ['up', 'Trượt lên'], ['left', 'Trượt từ trái'], ['right', 'Trượt từ phải'], ['zoom', 'Phóng to nhẹ']] }, x.fx.anim, function (v) { x.fx.anim = v; commit(b.id + ':anim'); }));
        fs.appendChild(ctl({ label: 'Hiệu ứng khi rê chuột', type: 'select', options: [['', 'Không'], ['lift', 'Nâng lên'], ['zoom', 'Phóng to'], ['glow', 'Phát sáng']] }, x.fx.hover, function (v) { x.fx.hover = v; commit(b.id + ':hover'); }));
        fs.appendChild(ctl({ label: 'Thời lượng (giây)', type: 'number', step: '0.1' }, x.fx.dur, function (v) { x.fx.dur = +v || 0.6; commit(b.id + ':dur'); }));
        fs.appendChild(ctl({ label: 'Trễ (giây)', type: 'number', step: '0.1' }, x.fx.delay, function (v) { x.fx.delay = +v || 0; commit(b.id + ':delay'); }));
      }
      box.appendChild(fs);
    });
    box.appendChild(h('button', { type: 'button', class: 'btn ghost sm', text: 'Xóa kiểu của ' + DEVN[S.dev].toLowerCase(), onclick: function () { x[dk] = {}; commit(b.id + ':xclr'); rightUi(); } }));
  }
  function visPanel(box, b, d) {
    var x = xOf(b, true);
    var fs = h('fieldset', { class: 'pbx-fs' }, [h('legend', { text: 'Hiển thị theo thiết bị' })]);
    fs.appendChild(ctl({ label: 'Ẩn trên điện thoại (≤760px)', type: 'check' }, b.style.hm, function (v) { b.style.hm = v; commit(b.id + ':hm'); }));
    fs.appendChild(ctl({ label: 'Ẩn trên tablet và điện thoại (≤1024px)', type: 'check' }, !!x.t.hide, function (v) { setX(b, 't', 'hide', v); }));
    fs.appendChild(ctl({ label: 'Ẩn trên máy tính và tablet (chỉ hiện ở điện thoại)', type: 'check' }, b.style.hp, function (v) { b.style.hp = v; commit(b.id + ':hp'); }));
    box.appendChild(fs);
    var c = x.cond, cs = h('fieldset', { class: 'pbx-fs' }, [h('legend', { text: 'Điều kiện hiển thị' })]);
    cs.appendChild(ctl({ label: 'Hiện từ (giờ Việt Nam)', type: 'datetime' }, c.from, function (v) { c.from = v; commit(b.id + ':cf'); }));
    cs.appendChild(ctl({ label: 'Hiện đến', type: 'datetime' }, c.to, function (v) { c.to = v; commit(b.id + ':ct'); }));
    var days = h('div', { class: 'pbx-days' }); ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].forEach(function (n, i) { var k = h('input', { type: 'checkbox' }); k.checked = c.days.indexOf(i) >= 0; k.addEventListener('change', function () { c.days = c.days.filter(function (z) { return z !== i; }); if (k.checked) c.days.push(i); commit(b.id + ':cd'); }); days.appendChild(h('label', { class: 'chk' }, [k, h('span', { text: n })])); });
    cs.appendChild(h('label', { text: 'Chỉ hiện vào các thứ (bỏ trống = mọi ngày)' })); cs.appendChild(days);
    cs.appendChild(ctl({ label: 'Chỉ hiện khi địa chỉ có tham số', type: 'text', ph: 'vd ref=facebook', hint: 'Dạng ten=gia-tri, ví dụ trang?ref=facebook' }, c.param, function (v) { c.param = v; commit(b.id + ':cp'); }));
    cs.appendChild(h('div', { class: 'meta', text: 'Điều kiện chỉ áp dụng ngoài website; trong trình soạn khối luôn hiện để bạn chỉnh.' })); box.appendChild(cs);
    var ps = h('fieldset', { class: 'pbx-fs' }, [h('legend', { text: 'Quyền sử dụng' })]);
    ps.appendChild(ctl({ label: 'Khóa: chỉ quản trị viên được sửa/xóa khối này', type: 'check' }, x.lock === 'admin', function (v) { if (!boot.isAdmin) return toast('Chỉ quản trị viên được khóa/mở khóa khối.', 1); x.lock = v ? 'admin' : ''; commit(b.id + ':lock'); }));
    ps.appendChild(h('div', { class: 'meta', text: d.admin ? 'Loại khối này chỉ quản trị viên được thêm/sửa.' : (d.adminFields && d.adminFields.length ? 'Một số trường (vd JavaScript) chỉ quản trị viên được sửa.' : 'Mọi người dùng có quyền sửa trang đều dùng được loại khối này.') }));
    if (!boot.isAdmin) ps.firstChild.querySelector('input').disabled = true; box.appendChild(ps);
  }
  function advPanel(box, b) {
    var x = xOf(b, true);
    box.appendChild(ctl({ label: 'Neo liên kết (ID)', type: 'text', ph: 'vd dang-ky', hint: 'Dùng liên kết dạng #dang-ky. Chỉ chữ, số, gạch.' }, x.anchor, function (v) { x.anchor = v; commit(b.id + ':anc'); }));
    box.appendChild(ctl({ label: 'Lớp CSS tùy chỉnh (class)', type: 'text', ph: 'vd noi-bat' }, x.cls, function (v) { x.cls = v; commit(b.id + ':cls'); }));
    if (boot.isAdmin) box.appendChild(ctl({ label: 'CSS riêng cho khối (chỉ trong khối này)', type: 'textarea', rows: 6, hint: 'Không cho phép @import, url ngoài https, expression, position:fixed. Quy tắc không an toàn bị bỏ khi hiển thị.' }, x.css, function (v) { x.css = v; commit(b.id + ':css'); }));
    else box.appendChild(h('div', { class: 'meta', text: 'CSS riêng chỉ quản trị viên được sửa.' }));
    box.appendChild(h('div', { class: 'meta', text: 'ID khối: ' + b.id + ' · loại: ' + b.type }));
  }
  function pagePanel(box) {
    var m = S.doc.meta;
    box.appendChild(h('div', { class: 'pbx-rh' }, [h('b', { text: 'Cài đặt trang' })]));
    var body = h('div', { class: 'pbx-rb' });
    var lay = h('div', { class: 'pbx-lay' }); [['full', 'Toàn rộng'], ['boxed', 'Khung hẹp'], ['side-left', 'Thanh bên trái'], ['side-right', 'Thanh bên phải']].forEach(function (l) {
      lay.appendChild(h('button', { type: 'button', class: m.layout === l[0] ? 'on' : '', onclick: function () { m.layout = l[0]; if (l[0].indexOf('side') < 0) { S.area = 'main'; } commit('layout'); syncArea(); rightUi(); } }, [h('i', { class: 'lay-' + l[0] }), h('span', { text: l[1] })]));
    });
    body.appendChild(h('label', { text: 'Layout trang' })); body.appendChild(lay);
    body.appendChild(ctl({ label: 'Hiển thị tiêu đề trang (H1)', type: 'check' }, m.showTitle, function (v) { m.showTitle = v; commit('showTitle'); }));
    body.appendChild(ctl({ label: 'Màu chủ đạo của trang', type: 'color' }, m.accent, function (v) { m.accent = v; commit('accent'); }));
    body.appendChild(ctl({ label: 'Hiện thanh menu trên cùng', type: 'check' }, S.doc.show_header, function (v) { S.doc.show_header = v; commit('hdr'); }));
    body.appendChild(ctl({ label: 'Hiện chân trang', type: 'check' }, S.doc.show_footer, function (v) { S.doc.show_footer = v; commit('ftr'); }));
    var sec = h('div', { class: 'pbx-sec' }); sec.appendChild(h('b', { text: 'Các khối đã thêm (' + (S.area === 'side' ? 'thanh bên' : 'nội dung chính') + ')' }));
    var arr = S.area === 'side' ? S.doc.side : S.doc.blocks;
    arr.forEach(function (b) { var d = defs[b.type] || { label: b.type }; sec.appendChild(h('button', { type: 'button', class: 'pbx-li', onclick: function () { select(b.id, { scroll: 1 }); } }, [h('b', { text: d.label }), h('small', { text: ' ' + blockSummary(b) }), h('span', { text: '›' })])); });
    if (!arr.length) sec.appendChild(h('div', { class: 'meta', text: 'Chưa có khối nào.' }));
    sec.appendChild(h('button', { type: 'button', class: 'btn ghost sm', text: '＋ Thêm khối', onclick: function () { openLeft('blocks'); } })); body.appendChild(sec);
    var adv = h('div', { class: 'pbx-sec' }); adv.appendChild(h('b', { text: 'Cài đặt nâng cao' }));
    adv.appendChild(ctl({ label: 'Không cho Google lập chỉ mục trang này (noindex)', type: 'check' }, m.noindex, function (v) { m.noindex = v; commit('noindex'); }));
    adv.appendChild(h('div', { class: 'meta', text: 'Sitemap.xml tự động tạo từ các trang đã xuất bản; Schema.org chọn ở thẻ SEO.' })); body.appendChild(adv);
    if (S.id && boot.isAdmin) body.appendChild(h('div', { class: 'pbx-sec' }, [h('button', { type: 'button', class: 'btn red', text: 'Xóa trang', onclick: delPage })]));
    box.appendChild(body);
  }
  function blockSummary(b) { var p = b.props || {}; for (var k in p) if (typeof p[k] === 'string' && p[k].trim() && !/^https?:/.test(p[k]) && k.charAt(0) !== '_') return p[k].replace(/\s+/g, ' ').slice(0, 34); return ''; }

  // ===== AI / khối dùng chung =====
  function aiUi(box, b) {
    var st = { topic: '', tone: 'chuyên nghiệp', len: 'mid' }, out = h('div', { class: 'meta' });
    var fs = h('fieldset', { class: 'pbx-fs' }, [h('legend', { text: 'Tạo nội dung bằng AI' })]);
    fs.appendChild(ctl({ label: 'Mô tả nội dung cần viết', type: 'textarea', rows: 3, ph: 'vd: Nhận định ngắn về nhóm cổ phiếu ngân hàng tuần này' }, '', function (v) { st.topic = v; }));
    fs.appendChild(ctl({ label: 'Giọng văn', type: 'select', options: [['chuyên nghiệp', 'Chuyên nghiệp'], ['dễ hiểu cho người mới', 'Dễ hiểu cho người mới'], ['ngắn gọn súc tích', 'Ngắn gọn']] }, st.tone, function (v) { st.tone = v; }));
    fs.appendChild(ctl({ label: 'Độ dài', type: 'select', options: [['short', 'Ngắn'], ['mid', 'Vừa'], ['long', 'Dài']] }, st.len, function (v) { st.len = v; }));
    var btn = h('button', { type: 'button', class: 'btn sm', text: '✦ Tạo bằng AI', onclick: function () {
      if (b.props.text && !confirm('Nội dung hiện tại sẽ bị thay bằng bản AI. Tiếp tục?')) return; btn.disabled = true; out.textContent = 'Đang tạo…';
      api({ action: 'ai', topic: st.topic, tone: st.tone, len: st.len }).then(function (r) { btn.disabled = false; if (r.ok) { b.props.text = r.text; commit(b.id + ':ai'); out.textContent = 'Đã tạo bởi ' + r.via + '. Hãy đọc và chỉnh sửa trước khi xuất bản.'; rightUi(); } else out.textContent = '⚠ ' + r.error; });
    } });
    fs.appendChild(btn); fs.appendChild(out); box.appendChild(fs);
  }
  function reuseUi(box, b) {
    var fs = h('fieldset', { class: 'pbx-fs' }, [h('legend', { text: 'Khối dùng chung' })]), sel = h('select'); sel.appendChild(h('option', { value: '', text: 'Đang tải…' }));
    api({ action: 're-list' }).then(function (r) { sel.innerHTML = ''; sel.appendChild(h('option', { value: '', text: '— Chọn —' })); (r.items || []).forEach(function (i) { var o = h('option', { value: i.id, text: '#' + i.id + ' ' + i.name }); if (+b.props.ref === i.id) o.selected = true; sel.appendChild(o); }); });
    sel.addEventListener('change', function () { b.props.ref = sel.value ? +sel.value : ''; commit(b.id + ':ref'); });
    fs.appendChild(h('div', { class: 'pbx-f' }, [h('label', { text: 'Chọn khối dùng chung' }), sel]));
    fs.appendChild(h('button', { type: 'button', class: 'btn ghost sm', text: 'Tách ra để sửa riêng', onclick: function () {
      if (!b.props.ref) return; api({ action: 're-get', id: b.props.ref }).then(function (r) { if (!r.ok) return toast(r.error, 1); var nb = reid(r.block); nb.props = nb.props || {}; nb.props._src = +b.props.ref; var f = find(b.id); if (!f) return; f.arr.splice(f.i, 1, nb); S.sel = nb.id; commit('detach'); select(nb.id); toast('Đã tách. Sửa xong bấm “Cập nhật lại khối dùng chung” để áp dụng cho mọi trang (đang dùng khoảng ' + r.usage + ' trang).'); });
    } }));
    box.appendChild(fs);
  }
  function makeReusable(b) {
    var name = prompt('Tên khối dùng chung (vd: Banner khuyến mãi):'); if (!name) return;
    var c = clone(b); delete c.props._src;
    api({ action: 're-save', name: name, block: c }).then(function (r) { if (!r.ok) return toast(r.error, 1); var f = find(b.id); if (!f) return; var nb = newBlock('pb-reusable'); if (!nb) return toast('Plugin chưa bật khối dùng chung', 1); nb.props.ref = r.id; nb.style = b.style; f.arr.splice(f.i, 1, nb); S.sel = nb.id; commit('reuse'); select(nb.id); toast('Đã lưu khối dùng chung #' + r.id + '. Các trang khác có thể dùng lại.'); });
  }
  function reUpdate(b) {
    var c = clone(b), id = c.props._src; delete c.props._src;
    api({ action: 're-get', id: id }).then(function (g) { if (!g.ok) return toast(g.error, 1); if (!confirm('Cập nhật khối dùng chung #' + id + '? Thay đổi áp dụng cho khoảng ' + g.usage + ' trang đang dùng.')) return;
      api({ action: 're-update', id: id, block: c }).then(function (r) { toast(r.ok ? 'Đã cập nhật khối dùng chung.' : r.error, !r.ok); }); });
  }

  // ===== thư viện (cột trái) =====
  function openLeft(t) { S.ltab = t; leftUi(); $('#pb-left').scrollTop = 0; $('#pbx').classList.add('l-open'); }
  function leftUi() {
    $$('.pbx-ltabs button').forEach(function (x) { x.classList.toggle('on', x.getAttribute('data-l') === S.ltab); });
    var box = $('#pb-lbody'); box.innerHTML = '';
    if (S.ltab === 'tpl') tplUi(box); else if (S.ltab === 'blocks') blocksUi(box); else treeUi(true);
  }
  var tplFilter = { q: '', cat: 'tat-ca' };
  function loadTpls(cb) { if (S.tpls) return cb(); api({ action: 'tpl-list' }).then(function (r) { S.tpls = r.ok ? r.templates : []; cb(); }); }
  function thumb(blocks) {
    var W = 160, out = [], H = 0;
    function dark(b) { var x = b.style && b.style.x && b.style.x.d; return b.props && (/^#(0|1)[0-9a-f]{5}$/i.test(b.props.bg || '') || b.props.light) || (x && x.grad && x.grad !== 'sky' && x.grad !== 'mint' && x.grad !== 'sun'); }
    function rec(list, x, y, w) {
      var yy = y; (list || []).forEach(function (b) {
        if (yy > 190) return; var d = defs[b.type] || {}, hh;
        if (b.type === 'section') { var inner = []; var s0 = out.length; out.push(''); var ih = rec(b.children, x + 4, yy + 4, w - 8); out[s0] = '<rect x="' + x + '" y="' + yy + '" width="' + w + '" height="' + (ih + 8) + '" fill="' + (dark(b) ? '#0f3d3b' : (b.props.bg ? '#eef2f1' : '#fff')) + '" stroke="#dde5e3"/>'; hh = ih + 8; }
        else if (b.type === 'columns') { var ps = parts(b.props.layout), tot = ps.reduce(function (a, c) { return a + c; }, 0), cx = x, mh = 10; ps.forEach(function (p, i) { var cw = w * p / tot; mh = Math.max(mh, rec((b.cols || [])[i], cx + 2, yy, cw - 4)); cx += cw; }); hh = mh; }
        else if (b.type === 'card') { var s1 = out.length; out.push(''); var ch = rec(b.children, x + 3, yy + 3, w - 6); out[s1] = '<rect x="' + x + '" y="' + yy + '" width="' + w + '" height="' + (ch + 6) + '" rx="3" fill="#fff" stroke="#cfd9d7"/>'; hh = ch + 6; }
        else { var col = { banner: '#2b6b64', slider: '#2b6b64', image: '#b9c9c6', gallery: '#b9c9c6', 'pb-cta': '#12b76a', 'tv-chart': '#9fc9e8', 'pb-market': '#9fc9e8', 'pb-video': '#555' }[b.type] || '#dfe6e4'; hh = { heading: 8, text: 16, banner: 34, slider: 34, image: 28, 'tv-chart': 30, 'pb-market': 26, 'pb-pricing': 30, posts: 28, 'pb-latest': 24, indexes: 14, stocks: 22, iconbox: 22, 'pb-cta': 20, button: 8 }[b.type] || 14;
          out.push(b.type === 'heading' ? '<rect x="' + (x + 2) + '" y="' + (yy + 1) + '" width="' + (w * .55) + '" height="5" rx="2" fill="#44605c"/>' : b.type === 'text' ? '<rect x="' + (x + 2) + '" y="' + yy + '" width="' + (w - 4) + '" height="3" fill="#cfd9d7"/><rect x="' + (x + 2) + '" y="' + (yy + 6) + '" width="' + (w * .8) + '" height="3" fill="#cfd9d7"/>' : '<rect x="' + (x + 1) + '" y="' + yy + '" width="' + (w - 2) + '" height="' + hh + '" rx="3" fill="' + col + '"/>'); }
        yy += hh + 4;
      }); return yy - y;
    }
    H = rec(blocks, 4, 4, W - 8) + 8; if (!blocks.length) out.push('<text x="80" y="55" text-anchor="middle" font-size="9" fill="#8a9">Trống</text>');
    return '<svg viewBox="0 0 160 ' + Math.max(60, Math.min(H, 120)) + '" width="100%" height="100" preserveAspectRatio="xMidYMin slice" role="img" aria-label="Xem trước bố cục"><rect width="160" height="200" fill="#f7f9f8"/>' + out.join('') + '</svg>';
  }
  function tplUi(box) {
    var cats = boot.cats;
    var q = h('input', { type: 'search', placeholder: 'Tìm kiếm mẫu…', 'aria-label': 'Tìm mẫu', value: tplFilter.q }); q.addEventListener('input', function () { tplFilter.q = q.value; list(); });
    box.appendChild(h('h4', { text: 'Thư viện mẫu trang' })); box.appendChild(q);
    var chips = h('div', { class: 'pbx-chips' }); cats.forEach(function (c) { chips.appendChild(h('button', { type: 'button', class: tplFilter.cat === c[0] ? 'on' : '', text: c[1], onclick: function () { tplFilter.cat = c[0]; leftUi(); } })); }); box.appendChild(chips);
    var lst = h('div', { class: 'pbx-tpls' }); box.appendChild(lst);
    var imp = h('div', { class: 'pbx-sec' }, [h('button', { type: 'button', class: 'btn ghost sm', text: 'Lưu trang này làm mẫu', onclick: function () { saveTpl('page', S.doc.blocks); } }), ' ', h('button', { type: 'button', class: 'btn ghost sm', text: 'Nhập mẫu (.json)', onclick: function () { var f = h('input', { type: 'file', accept: '.json,application/json' }); f.onchange = function () { readJson(f, function (j) { api({ action: 'tpl-import', data: j }).then(function (r) { toast(r.ok ? 'Đã nhập mẫu' + (r.dropped ? ' (bỏ ' + r.dropped + ' khối không hợp lệ)' : '') : r.error, !r.ok); S.tpls = null; leftUi(); }); }); }; f.click(); } })]); box.appendChild(imp);
    function list() {
      lst.innerHTML = 'Đang tải…';
      loadTpls(function () {
        lst.innerHTML = ''; var n = 0;
        S.tpls.filter(function (t) { return t.kind === 'page' && (tplFilter.cat === 'tat-ca' || t.category === tplFilter.cat) && (!tplFilter.q || (t.name + ' ' + t.desc).toLowerCase().indexOf(tplFilter.q.toLowerCase()) >= 0); }).forEach(function (t) {
          n++; var card = h('div', { class: 'pbx-tpl' }, [h('div', { class: 'th', html: thumb(t.blocks) }), h('div', { class: 'tn', text: t.name }), h('div', { class: 'meta', text: t.desc || '' })]);
          var acts = h('div', { class: 'acts' }, [h('button', { type: 'button', class: 'btn sm', text: 'Sử dụng mẫu', onclick: function () { useTpl(t, true); } }), h('button', { type: 'button', class: 'btn ghost sm', text: 'Chèn thêm', onclick: function () { useTpl(t, false); } })]);
          if (!t.builtin) { acts.appendChild(h('button', { type: 'button', class: 'btn ghost sm', text: 'Xuất', onclick: function () { exportTpl(t); } })); if (t.mine || boot.isAdmin) acts.appendChild(h('button', { type: 'button', class: 'btn red sm', text: 'Xóa', onclick: function () { if (confirm('Xóa mẫu này?')) api({ action: 'tpl-delete', id: +String(t.id).slice(2) }).then(function (r) { toast(r.ok ? 'Đã xóa' : r.error, !r.ok); S.tpls = null; leftUi(); }); } })); }
          card.appendChild(acts); lst.appendChild(card);
        });
        if (!n) lst.appendChild(h('div', { class: 'meta', text: 'Không có mẫu phù hợp.' }));
      });
    }
    list();
  }
  function useTpl(t, replace) {
    var area = S.area === 'side' ? S.doc.side : S.doc.blocks;
    if (replace && area.length && !confirm('Thay toàn bộ nội dung đang soạn bằng mẫu “' + t.name + '”? (Bạn có thể bấm Hoàn tác)')) return;
    var blocks = clone(t.blocks).map(reid); if (replace) area.length = 0; blocks.forEach(function (b) { area.push(b); });
    if (replace && !S.doc.title) { S.doc.title = t.name; $('#pb-title').value = t.name; }
    S.sel = null; commit('tpl'); fullUi(); toast('Đã áp dụng mẫu “' + t.name + '”.');
  }
  function saveTpl(kind, blocks) {
    var name = prompt(kind === 'page' ? 'Tên mẫu trang:' : 'Tên mẫu khối:'); if (!name) return;
    var share = confirm('Chia sẻ mẫu này cho mọi người dùng trong trang quản trị? (Bấm Hủy để chỉ mình bạn thấy)');
    api({ action: 'tpl-save', name: name, kind: kind, category: kind === 'page' ? 'khac' : 'khac', desc: '', blocks: clone(blocks), shared: share }).then(function (r) { toast(r.ok ? 'Đã lưu mẫu.' : r.error, !r.ok); S.tpls = null; if (r.ok) leftUi(); });
  }
  function exportTpl(t) { api({ action: 'tpl-export', id: +String(t.id).slice(2) }).then(function (r) { if (r.ok) download((t.name || 'mau').replace(/[^\w-]+/g, '-') + '.pbtemplate.json', r.file); else toast(r.error, 1); }); }
  function download(name, obj) { var a = h('a', { href: URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })), download: name }); document.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); }, 500); }
  function readJson(inp, cb) { var f = inp.files && inp.files[0]; if (!f) return; if (f.size > 1.5e6) return toast('Tệp quá lớn.', 1); var r = new FileReader(); r.onload = function () { try { cb(JSON.parse(String(r.result))); } catch (e) { toast('Tệp JSON không hợp lệ.', 1); } }; r.readAsText(f); }

  function blocksUi(box) {
    var q = h('input', { type: 'search', placeholder: 'Tìm khối…', 'aria-label': 'Tìm khối' }); box.appendChild(h('h4', { text: 'Khối' })); box.appendChild(q);
    var wrap = h('div'); box.appendChild(wrap);
    function draw() {
      wrap.innerHTML = ''; var groups = {}, term = q.value.toLowerCase();
      boot.defs.forEach(function (d) { if (d.inactive) return; if (d.admin && !boot.isAdmin) return; if (term && (d.label + ' ' + d.type).toLowerCase().indexOf(term) < 0) return; (groups[d.group] = groups[d.group] || []).push(d); });
      Object.keys(groups).forEach(function (g) {
        wrap.appendChild(h('div', { class: 'pbx-gh', text: g })); var grid = h('div', { class: 'pbx-pal' });
        groups[g].forEach(function (d) {
          var it = h('div', { role: 'button', tabindex: '0', class: 'pbx-pi', draggable: 'true', title: 'Bấm để thêm, hoặc kéo vào trang' }, [h('span', { html: boot.icons[d.icon] || '' }), h('span', { text: d.label })]);
          it.addEventListener('click', function () { addBlock(d.type); $('#pbx').classList.remove('l-open'); });
          it.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); addBlock(d.type); } });
          it.addEventListener('dragstart', function (e) { PBX.drag = { kind: 'new', type: d.type }; e.dataTransfer.effectAllowed = 'copy'; try { e.dataTransfer.setData('text/plain', d.type); } catch (x) { } });
          it.addEventListener('dragend', function () { PBX.drag = null; }); grid.appendChild(it);
        }); wrap.appendChild(grid);
      });
      loadTpls(function () {
        var bt = S.tpls.filter(function (t) { return t.kind === 'block' && (!term || t.name.toLowerCase().indexOf(term) >= 0); }); if (!bt.length) return;
        wrap.appendChild(h('div', { class: 'pbx-gh', text: 'Mẫu khối (bấm để chèn)' }));
        bt.forEach(function (t) { var it = h('div', { role: 'button', tabindex: '0', class: 'pbx-bt', draggable: 'true' }, [h('div', { class: 'th', html: thumb(t.blocks) }), h('span', { text: t.name })]); it.addEventListener('click', function () { var z = insertTarget(), arr = clone(t.blocks).map(reid), ok = true; arr.forEach(function (b, i) { if (ok && !insertAt(z.zone, z.idx + i, b)) ok = false; }); if (ok) { commit('tpl'); fullUi(); toast('Đã chèn “' + t.name + '”.'); $('#pbx').classList.remove('l-open'); } });
          it.addEventListener('dragstart', function (e) { PBX.drag = { kind: 'tpl', blocks: t.blocks }; e.dataTransfer.effectAllowed = 'copy'; try { e.dataTransfer.setData('text/plain', t.name); } catch (x) { } }); it.addEventListener('dragend', function () { PBX.drag = null; }); wrap.appendChild(it); });
      });
    }
    q.addEventListener('input', draw); draw();
  }
  function treeUi(force) {
    if (S.ltab !== 'tree') return; var box = $('#pb-lbody'); if (!force && !box) return; box.innerHTML = ''; box.appendChild(h('h4', { text: 'Cấu trúc trang' }));
    var root = h('div', { class: 'pbx-tree' });
    function rec(arr, zone, parent, depth) {
      var ul = h('div', { class: 'pbx-tz', 'data-zone': zone });
      ul.addEventListener('dragover', function (e) { if (PBX.drag && PBX.drag.kind === 'move' && e.target === ul) { e.preventDefault(); } }); ul.addEventListener('drop', function (e) { if (e.target === ul) { e.preventDefault(); PBX.drop(zone, arr.length); } });
      arr.forEach(function (b, i) {
        var d = defs[b.type] || { label: b.type }, row = h('div', { class: 'pbx-tr' + (S.sel === b.id ? ' on' : ''), draggable: 'true', style: 'padding-left:' + (6 + depth * 14) + 'px' }, [h('span', { class: 'hd', text: '⠿' }), h('b', { text: d.label }), h('small', { text: ' ' + blockSummary(b) })]);
        row.addEventListener('click', function () { select(b.id, { scroll: 1 }); });
        row.addEventListener('dragstart', function (e) { PBX.drag = { kind: 'move', id: b.id }; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', b.id); } catch (x) { } });
        row.addEventListener('dragend', function () { PBX.drag = null; });
        row.addEventListener('dragover', function (e) { if (PBX.drag && PBX.drag.kind !== 'move' || (PBX.drag && PBX.drag.id !== b.id)) { e.preventDefault(); var r = row.getBoundingClientRect(); row.className = 'pbx-tr' + (S.sel === b.id ? ' on' : '') + (e.clientY > r.top + r.height / 2 ? ' after' : ' before'); } });
        row.addEventListener('dragleave', function () { row.className = 'pbx-tr' + (S.sel === b.id ? ' on' : ''); });
        row.addEventListener('drop', function (e) { e.preventDefault(); e.stopPropagation(); var r = row.getBoundingClientRect(); PBX.drop(zone, i + (e.clientY > r.top + r.height / 2 ? 1 : 0)); });
        ul.appendChild(row);
        if (b.children) ul.appendChild(rec(b.children, b.id + ':0', b, depth + 1));
        if (b.cols) b.cols.forEach(function (c, k) { ul.appendChild(h('div', { class: 'pbx-tc', style: 'padding-left:' + (6 + (depth + 1) * 14) + 'px', text: 'Cột ' + (k + 1) })); ul.appendChild(rec(c, b.id + ':' + k, b, depth + 1)); });
      });
      if (!arr.length && depth > 0) ul.appendChild(h('div', { class: 'meta', style: 'padding-left:' + (6 + depth * 14) + 'px', text: '(trống)' }));
      return ul;
    }
    root.appendChild(rec(S.area === 'side' ? S.doc.side : S.doc.blocks, S.area === 'side' ? 'side' : 'root', null, 0)); box.appendChild(root);
    box.appendChild(h('div', { class: 'meta', text: 'Kéo để đổi thứ tự hoặc chuyển vào section/cột. Có thể kéo thả ngay trên trang.' }));
  }

  // ===== canvas =====
  var renderT = null;
  function scheduleRender() { clearTimeout(renderT); renderT = setTimeout(function () { renderCanvas(false); }, 260); }
  function frameW() { $('#pb-frame').style.width = DEVW[S.dev]; $('#pb-frame').className = 'pbx-frame ' + S.dev; }
  function reqBody(full) { return JSON.stringify({ id: S.id, doc: S.doc, mode: full ? 'full' : 'frag', edit: !S.preview }); }
  function renderCanvas(full) {
    var mySeq = ++S.seq, ifr = $('#pb-canvas'); $('#pb-load').hidden = false;
    var needFull = full || !cw() || !ifr.contentDocument || !ifr.contentDocument.getElementById('pb-root');
    fetch('/admin/pb-preview', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: reqBody(needFull) }).then(function (r) { return needFull ? r.text().then(function (t) { return { ok: r.ok, t: t }; }) : r.json().then(function (j) { return { ok: r.ok, j: j }; }); }).then(function (r) {
      if (mySeq !== S.seq) return; $('#pb-load').hidden = true;
      if (needFull) { if (!r.ok) { var e; try { e = JSON.parse(r.t).error; } catch (x) { e = 'Không dựng được bản xem trước'; } return toast(e, 1); } ifr.srcdoc = r.t; return; }
      if (!r.ok || !r.j.ok) return toast((r.j && r.j.error) || 'Không dựng được bản xem trước', 1);
      var d = ifr.contentDocument, root = d.getElementById('pb-root'), sy = d.documentElement.scrollTop || d.body.scrollTop;
      root.innerHTML = r.j.html; [].slice.call(root.querySelectorAll('script')).forEach(function (o) { var ty = (o.getAttribute('type') || '').toLowerCase(); if (ty && ty !== 'text/javascript' && ty !== 'module') return; var n = d.createElement('script'); if (o.src) n.src = o.src; n.textContent = o.textContent; o.parentNode.replaceChild(n, o); });
      d.documentElement.scrollTop = sy; var c = cw(); if (c) c.refresh(); canvasSel();
    }).catch(function () { $('#pb-load').hidden = true; toast('Mất kết nối khi dựng bản xem trước', 1); });
  }
  $('#pb-canvas').addEventListener('load', function () { $('#pb-load').hidden = true; });

  // ===== API, lưu, xuất bản =====
  function api(body) { return fetch('/admin/pb-api', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json', 'x-pb-token': boot.token }, body: JSON.stringify(body) }).then(function (r) { return r.json().catch(function () { return { ok: false, error: 'Máy chủ trả về dữ liệu lạ (' + r.status + ')' }; }); }).catch(function () { return { ok: false, error: 'Không kết nối được máy chủ' }; }); }
  PBX.api = api;
  function markDirty() { S.dirty = true; stateUi(); }
  function stateUi() {
    var t = S.busy ? 'Đang lưu…' : S.dirty ? '● Chưa lưu' : (S.lastSave ? 'Đã lưu ' + new Date(S.lastSave).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : ''); $('#pb-state').textContent = t + (S.status === 'published' ? ' · Đang xuất bản' : ' · Nháp');
  }
  function afterSave(r, pub) {
    S.busy = false; $('#pb-save').disabled = $('#pb-pub').disabled = false;
    if (!r.ok) { stateUi(); return toast(r.error, 1); }
    if (!S.id) { S.id = r.id; history.replaceState(null, '', '/admin/pb/' + r.id); }
    S.doc.slug = r.slug; if (r.slug) { $('#pb-slug').value = r.slug; urlUi(); } S.dirty = false; S.lastSave = r.savedAt; if (pub) S.status = r.published ? 'published' : 'draft';
    stateUi(); if (r.warnings && r.warnings.length) toast(r.warnings.join(' · '), 1); else toast(pub ? (r.published ? 'Đã xuất bản.' : 'Đã lưu.') : 'Đã lưu nháp (chưa hiển thị ngoài website).');
  }
  function save(silent) { if (S.busy) return; if (!S.doc.title.trim()) { if (!silent) toast('Hãy nhập tên trang trước.', 1); return; } S.busy = true; stateUi(); $('#pb-save').disabled = true; api({ action: 'save', id: S.id, doc: S.doc }).then(function (r) { afterSave(r, false); }); }
  function publish() {
    if (S.busy) return; if (!S.doc.title.trim()) return toast('Hãy nhập tên trang trước.', 1);
    var note = prompt('Ghi chú phiên bản (tùy chọn):', ''); if (note === null) return;
    S.busy = true; stateUi(); $('#pb-pub').disabled = true; api({ action: 'publish', id: S.id, doc: S.doc, note: note }).then(function (r) { afterSave(r, true); if (r.ok) banner('Đã xuất bản: <a href="/' + encodeURIComponent(r.slug) + '" target="_blank" rel="noopener">xem trang thật</a>', 'ok'); });
  }
  function delPage() { if (!confirm('Xóa vĩnh viễn trang này cùng lịch sử phiên bản?')) return; api({ action: 'delete-page', id: S.id }).then(function (r) { if (r.ok) { S.dirty = false; location.href = '/admin/trang'; } else toast(r.error, 1); }); }
  var tt = null;
  function toast(msg, bad) { var t = $('#pb-toast'); t.textContent = msg; t.className = 'pbx-toast show' + (bad ? ' bad' : ''); clearTimeout(tt); tt = setTimeout(function () { t.className = 'pbx-toast'; }, bad ? 6000 : 3200); }
  function banner(html, kind) { var b = $('#pb-banner'); b.hidden = !html; b.className = 'pbx-banner ' + (kind || ''); b.innerHTML = html || ''; }
  PBX.toast = toast;

  // ===== tab SEO / Cài đặt / Lịch sử =====
  function seoUi() {
    var box = $('[data-tab="seo"]'); box.innerHTML = ''; var s = S.doc.seo, m = S.doc.meta, w = h('div', { class: 'box' });
    var prev = h('div', { class: 'pbx-serp' }); function serp() { var u = location.origin + '/' + (S.doc.slug || '…'); prev.innerHTML = ''; prev.appendChild(h('div', { class: 'u', text: u })); prev.appendChild(h('div', { class: 't', text: (s.title || S.doc.title || 'Tiêu đề trang').slice(0, 70) })); prev.appendChild(h('div', { class: 'd', text: (s.desc || 'Mô tả trang sẽ hiện ở đây.').slice(0, 170) })); }
    function cnt(el, n, max) { el.textContent = n + '/' + max + (n > max ? ' (hơi dài, Google có thể cắt)' : ''); }
    var ct = h('div', { class: 'meta' }), cd = h('div', { class: 'meta' });
    w.appendChild(h('h3', { text: 'SEO & chia sẻ' })); w.appendChild(prev);
    w.appendChild(ctl({ label: 'Tiêu đề SEO (Google)', type: 'text' }, s.title, function (v) { s.title = v; cnt(ct, v.length, 60); serp(); markDirty(); })); w.appendChild(ct); cnt(ct, s.title.length, 60);
    w.appendChild(ctl({ label: 'Mô tả SEO', type: 'textarea', rows: 3 }, s.desc, function (v) { s.desc = v; cnt(cd, v.length, 160); serp(); markDirty(); })); w.appendChild(cd); cnt(cd, s.desc.length, 160);
    w.appendChild(ctl({ label: 'Ảnh chia sẻ mạng xã hội (https://…)', type: 'image' }, s.image, function (v) { s.image = v; markDirty(); }));
    w.appendChild(ctl({ label: 'Canonical URL (để trống = đường dẫn của trang)', type: 'text', ph: 'https://…' }, m.canonical, function (v) { m.canonical = v; markDirty(); }));
    w.appendChild(ctl({ label: 'Không cho lập chỉ mục (noindex) và loại khỏi sitemap', type: 'check' }, m.noindex, function (v) { m.noindex = v; markDirty(); }));
    w.appendChild(ctl({ label: 'Schema.org (dữ liệu có cấu trúc JSON-LD)', type: 'select', options: boot.schemaTypes }, m.schemaType, function (v) { m.schemaType = v; markDirty(); }));
    w.appendChild(h('div', { class: 'meta', text: 'Thẻ canonical, Open Graph, Twitter Card và JSON-LD được tạo tự động khi xuất bản. sitemap.xml tự cập nhật.' })); serp(); box.appendChild(w);
  }
  function settingsUi() {
    var box = $('[data-tab="settings"]'); box.innerHTML = ''; var w = h('div', { class: 'box' }); w.appendChild(h('h3', { text: 'Cài đặt trang' }));
    if ((boot.pcats || []).length) w.appendChild(ctl({ label: 'Danh mục trang', type: 'select', options: [['0', 'Chưa phân loại']].concat(boot.pcats.map(function (c) { return [String(c[0]), c[1]]; })) }, String(S.doc.meta.cat || 0), function (v) { S.doc.meta.cat = +v || 0; markDirty(); }));
    else w.appendChild(h('div', { class: 'meta', html: 'Chưa có danh mục trang. <a href="/admin/trang/danh-muc" target="_blank">Tạo danh mục</a>' }));
    w.appendChild(ctl({ label: 'Lưu làm “trang mẫu” (không hiện ra website)', type: 'check' }, S.doc.is_template, function (v) { S.doc.is_template = v; markDirty(); }));
    w.appendChild(ctl({ label: 'Hiện thanh menu trên cùng', type: 'check' }, S.doc.show_header, function (v) { S.doc.show_header = v; commit('hdr'); }));
    w.appendChild(ctl({ label: 'Hiện chân trang', type: 'check' }, S.doc.show_footer, function (v) { S.doc.show_footer = v; commit('ftr'); }));
    if (boot.isAdmin) w.appendChild(ctl({ label: 'CSS riêng của cả trang (chỉ quản trị viên)', type: 'textarea', rows: 8, hint: 'Chỉ áp dụng trong trang; @import, url ngoài https, expression, position:fixed bị loại.' }, S.doc.meta.css, function (v) { S.doc.meta.css = v; commit('pcss'); }));
    w.appendChild(h('div', { class: 'meta', text: 'Layout, màu chủ đạo và tiêu đề H1 chỉnh ở cột “Cài đặt trang” khi không chọn khối nào.' })); box.appendChild(w);
  }
  function historyUi() {
    var box = $('[data-tab="history"]'); box.innerHTML = ''; var w = h('div', { class: 'box' }); w.appendChild(h('h3', { text: 'Lịch sử phiên bản' })); box.appendChild(w);
    if (!S.id) return w.appendChild(h('div', { class: 'meta', text: 'Trang chưa được lưu nên chưa có lịch sử.' }));
    w.appendChild(h('div', { class: 'meta', text: 'Đang tải…' }));
    api({ action: 'versions', id: S.id }).then(function (r) {
      w.innerHTML = ''; w.appendChild(h('h3', { text: 'Lịch sử phiên bản (tối đa 50)' })); if (!r.ok || !r.versions.length) return w.appendChild(h('div', { class: 'meta', text: 'Chưa có phiên bản. Mỗi lần bấm Xuất bản sẽ tạo một phiên bản.' }));
      var K = { publish: 'Xuất bản', save: 'Lưu', import: 'Bản gốc trước khi dùng Pro' };
      r.versions.forEach(function (v) { w.appendChild(h('div', { class: 'item' }, [h('div', { class: 'tt' }, [h('b', { text: K[v.kind] || v.kind }), h('span', { class: 'meta', text: ' · ' + new Date(v.created_at).toLocaleString('vi-VN') + ' · ' + (v.by || '') + (v.note ? ' · ' + v.note : '') })]),
        h('div', { class: 'acts' }, [h('button', { type: 'button', class: 'btn ghost sm', text: 'Khôi phục vào trình soạn', onclick: function () { if (S.dirty && !confirm('Bản đang soạn chưa lưu sẽ bị thay (vẫn có thể Hoàn tác). Tiếp tục?')) return; api({ action: 'version', id: S.id, vid: v.id }).then(function (g) { if (!g.ok) return toast(g.error, 1); var d = g.doc; S.doc.title = d.title || S.doc.title; S.doc.blocks = d.blocks || []; S.doc.side = d.side || []; S.doc.meta = d.meta || S.doc.meta; S.doc.seo = d.seo || S.doc.seo; S.doc.show_header = d.show_header !== false; S.doc.show_footer = d.show_footer !== false; S.sel = null; commit('restore'); syncFields(); fullUi(); tab('content'); toast('Đã nạp phiên bản. Bấm Lưu nháp hoặc Xuất bản để áp dụng.'); }); } })])])); });
    });
  }
  function tab(t) { $$('#pb-tabs button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-tab') === t); }); $$('#pbx > section').forEach(function (s) { s.hidden = s.getAttribute('data-tab') !== t; }); if (t === 'seo') seoUi(); if (t === 'settings') settingsUi(); if (t === 'history') historyUi(); if (t === 'content') { frameW(); canvasSel(); } }

  // ===== khung trên cùng, thiết bị, vùng =====
  function urlUi() { $('#pb-url').textContent = location.origin + '/' + (S.doc.slug || '…'); }
  function syncFields() { $('#pb-title').value = S.doc.title; $('#pb-slug').value = S.doc.slug; urlUi(); syncArea(); }
  function syncArea() { var side = S.doc.meta.layout.indexOf('side') === 0; $('#pb-area').hidden = !side; if (!side) S.area = 'main'; $$('#pb-area button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-a') === S.area); }); }
  function fullUi() { rightUi(); treeUi(); histUi(); syncArea(); stateUi(); if (S.ltab !== 'tree') { /* giữ thư viện */ } }
  $('#pb-title').addEventListener('input', function () { S.doc.title = this.value; markDirty(); });
  $('#pb-slug-edit').addEventListener('click', function () { var i = $('#pb-slug'); i.hidden = !i.hidden; if (!i.hidden) i.focus(); });
  $('#pb-slug').addEventListener('input', function () { S.doc.slug = this.value.trim(); urlUi(); markDirty(); });
  $('#pb-save').addEventListener('click', function () { save(false); });
  $('#pb-pub').addEventListener('click', publish);
  $('#pb-undo').addEventListener('click', undo); $('#pb-redo').addEventListener('click', redo);
  $('#pb-add').addEventListener('click', function () { openLeft('blocks'); });
  $('#pb-lt').addEventListener('click', function () { $('#pbx').classList.toggle('l-open'); $('#pbx').classList.remove('r-open'); });
  $('#pb-rt').addEventListener('click', function () { $('#pbx').classList.toggle('r-open'); $('#pbx').classList.remove('l-open'); });
  $('#pb-prev').addEventListener('click', function () { S.preview = !S.preview; this.classList.toggle('on', S.preview); this.textContent = S.preview ? 'Quay lại soạn' : 'Xem trước'; $('#pbx').classList.toggle('previewing', S.preview); renderCanvas(true); });
  $$('#pb-dev button').forEach(function (b) { b.addEventListener('click', function () { S.dev = b.getAttribute('data-d'); $$('#pb-dev button').forEach(function (x) { x.classList.toggle('on', x === b); }); frameW(); if (S.sel && S.rtab === 's') rightUi(); setTimeout(function () { var c = cw(); if (c) c.refresh(); }, 80); }); });
  $$('#pb-area button').forEach(function (b) { b.addEventListener('click', function () { S.area = b.getAttribute('data-a'); S.sel = null; syncArea(); rightUi(); treeUi(); var c = cw(); if (c) c.scrollZone(S.area === 'side' ? 'side' : 'root'); }); });
  $$('.pbx-ltabs button').forEach(function (b) { b.addEventListener('click', function () { S.ltab = b.getAttribute('data-l'); leftUi(); $('#pb-left').scrollTop = 0; }); });
  $$('#pb-tabs button').forEach(function (b) { b.addEventListener('click', function () { tab(b.getAttribute('data-tab')); }); });
  $('#pb-pubm').addEventListener('click', function (e) { e.stopPropagation(); var m = $('#pb-pubmenu'); m.hidden = !m.hidden; });
  document.addEventListener('click', function (e) { if (!e.target.closest || !e.target.closest('.pbx-pub')) $('#pb-pubmenu').hidden = true; });
  $('#pb-pubmenu').addEventListener('click', function (e) {
    var m = e.target.getAttribute && e.target.getAttribute('data-m'); if (!m) return; this.hidden = true;
    if (m === 'tpl') saveTpl('page', S.doc.blocks);
    else if (m === 'unpub') { if (!S.id) return; if (confirm('Trang sẽ không còn hiển thị ngoài website. Tiếp tục?')) api({ action: 'unpublish', id: S.id }).then(function (r) { if (r.ok) { S.status = 'draft'; stateUi(); toast('Đã chuyển về nháp.'); } else toast(r.error, 1); }); }
    else if (m === 'export') download((S.doc.slug || 'trang') + '.pbpage.json', S.doc);
    else if (m === 'import') $('#pb-file').click();
    else if (m === 'dup') { if (!S.id) return toast('Hãy lưu trang trước.', 1); api({ action: 'dup', id: S.id }).then(function (r) { if (r.ok) location.href = '/admin/pb/' + r.id; else toast(r.error, 1); }); }
    else if (m === 'live') { if (S.id && S.status === 'published') window.open('/' + S.doc.slug, '_blank'); else toast('Trang chưa xuất bản.', 1); }
    else if (m === 'tab') fetch('/admin/pb-preview', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: S.id, doc: S.doc, mode: 'full', edit: false }) }).then(function (r) { return r.text(); }).then(function (t) { window.open(URL.createObjectURL(new Blob([t.replace('<head>', '<head><base href="' + location.origin + '/">')], { type: 'text/html' })), '_blank'); });
  });
  $('#pb-file').addEventListener('change', function () { readJson(this, function (j) { api({ action: 'validate', doc: j }).then(function (r) { if (!r.ok) return toast(r.error, 1); if (!confirm('Thay nội dung đang soạn bằng trang trong tệp? (Có thể Hoàn tác)')) return; var d = r.doc; S.doc.title = d.title; S.doc.blocks = d.blocks; S.doc.side = d.side; S.doc.meta = d.meta; S.doc.seo = d.seo; S.sel = null; commit('import'); syncFields(); fullUi(); toast('Đã nhập trang' + (r.warnings.length ? ' · ' + r.warnings.join(' · ') : '')); }); }); this.value = ''; });
  function keyHandler(e) {
    var t = e.target, typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable); var k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
    if (mod && k === 's') { e.preventDefault(); save(false); return; }
    if (typing) return;
    if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); } else if (mod && k === 'y') { e.preventDefault(); redo(); }
    else if (mod && k === 'd' && S.sel) { e.preventDefault(); dupBlock(S.sel); } else if ((k === 'delete' || k === 'backspace') && S.sel) { e.preventDefault(); removeBlock(S.sel); } else if (k === 'escape') { select(null); }
  }
  document.addEventListener('keydown', keyHandler);
  window.addEventListener('beforeunload', function (e) { if (S.dirty) { e.preventDefault(); e.returnValue = ''; } });
  if (boot.autosave > 0) setInterval(function () { if (S.dirty && !S.busy && S.doc.title.trim()) { api({ action: 'save', id: S.id, doc: S.doc }).then(function (r) { if (r.ok) { if (!S.id) { S.id = r.id; history.replaceState(null, '', '/admin/pb/' + r.id); } S.dirty = false; S.lastSave = r.savedAt; stateUi(); } }); } }, boot.autosave * 1000);
  var dl = $('#pb-links'); (boot.links || []).forEach(function (l) { dl.appendChild(h('option', { value: l[0], label: l[1] })); });

  // ===== khởi động =====
  if (boot.draft) banner('Đang mở <b>bản nháp</b> chưa xuất bản (lưu lúc ' + new Date(boot.draft.updated_at).toLocaleString('vi-VN') + '). <button type="button" class="btn ghost sm" id="pb-discard">Bỏ bản nháp, dùng bản đang chạy</button>', 'warn');
  var dd = $('#pb-discard'); if (dd) dd.addEventListener('click', function () { if (!confirm('Bỏ bản nháp và quay về bản đang xuất bản?')) return; api({ action: 'discard-draft', id: S.id }).then(function (r) { if (r.ok) { S.doc = r.doc; S.sel = null; S.hist = []; S.hp = -1; commit('discard'); S.dirty = false; syncFields(); fullUi(); banner(''); renderCanvas(true); } else toast(r.error, 1); }); });
  S.hist = [snap()]; S.hp = 0; syncFields(); frameW(); leftUi(); rightUi(); histUi(); S.dirty = !!boot.startDirty; stateUi(); renderCanvas(true);
  PBX._S = S; PBX._test = { addBlock: addBlock, commit: commit, find: find, undo: undo, redo: redo, save: save, publish: publish };
})();
