/* Trình dựng trang kéo thả, hỗ trợ khối lồng khối (Section > Hàng cột > Khối).
   NhipBuilder({defs, blocks, list, addBtn:[...], sheet, icons, isAdmin, onChange}) */
window.NhipBuilder = function (cfg) {
  var defs = {}; cfg.defs.forEach(function (d) { defs[d.type] = d; });
  var MAXD = 4, ROOT = [], openId = null, drag = null, pending = null;
  var SPANS = [[12, 'Cả hàng (1/1)'], [9, '3/4'], [8, '2/3'], [6, 'Một nửa (1/2)'], [4, 'Một phần ba (1/3)'], [3, 'Một phần tư (1/4)'], [2, '1/6'], [1, '1/12']];
  var STYLE0 = function (full) { return { sp: 12, sm: 12, hp: false, hm: false, py: 0, bg: '', al: '', full: !!full }; };
  var uid = function () { return Math.random().toString(36).slice(2, 9); };
  function h(tag, a, kids) {
    var e = document.createElement(tag);
    for (var k in (a || {})) { if (k === 'text') e.textContent = a[k]; else if (k === 'html') e.innerHTML = a[k]; else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), a[k]); else if (a[k] !== false && a[k] != null) e.setAttribute(k, a[k] === true ? '' : a[k]); }
    (kids || []).forEach(function (c) { if (c) e.appendChild(c); });
    return e;
  }
  function changed() { cfg.onChange && cfg.onChange(); }
  function parts(layout) {
    var a = String(layout || '6-6').split('-').map(Number).filter(function (n) { return n >= 1 && n <= 12; });
    var sum = a.reduce(function (x, y) { return x + y; }, 0);
    return a.length && sum <= 12 ? a : [12];
  }
  function kidsOf(b) { return b.children ? [b.children] : (b.cols || []); }
  function contains(b, arr) { return kidsOf(b).some(function (a) { return a === arr || a.some(function (x) { return contains(x, arr); }); }); }
  function sync(b) { // đưa số cột về đúng theo kiểu chia cột; cột thừa gộp vào cột cuối
    var n = parts(b.props.layout).length, c = b.cols || [];
    while (c.length < n) c.push([]);
    while (c.length > n) { var x = c.pop(); c[n - 1] = c[n - 1].concat(x); }
    b.cols = c;
  }
  function norm(arr) {
    var out = [];
    (arr || []).forEach(function (b) {
      var d = b && defs[b.type]; if (!d) return;
      b.id = b.id || uid(); b.props = b.props || {}; b.style = b.style || STYLE0(d.full);
      if (d.container === 'list') b.children = norm(b.children);
      if (d.container === 'cols') { b.cols = (b.cols || []).map(norm); sync(b); }
      out.push(b);
    });
    return out;
  }
  function reid(b) { b.id = uid(); if (b.children) b.children.forEach(reid); (b.cols || []).forEach(function (c) { c.forEach(reid); }); }
  ROOT = norm(cfg.blocks);

  function label(txt, input, hint) { var l = h('label', { text: txt }); var w = h('div'); w.appendChild(l); w.appendChild(input); if (hint) w.appendChild(h('div', { class: 'meta', text: hint })); return w; }
  function control(obj, f, key, after) {
    var v = obj[key], c;
    if (f.type === 'textarea') { c = h('textarea', { rows: 4 }); c.value = v == null ? '' : v; }
    else if (f.type === 'select') { c = h('select'); (f.options || []).forEach(function (o) { var op = h('option', { value: o[0], text: o[1] }); if (String(v) === String(o[0])) op.selected = true; c.appendChild(op); }); }
    else if (f.type === 'check') { c = h('input', { type: 'checkbox' }); c.checked = !!v; var w = h('label', { class: 'chk' }, [c, h('span', { text: f.label })]); c.addEventListener('change', function () { obj[key] = c.checked; changed(); }); return w; }
    else if (f.type === 'number') { c = h('input', { type: 'number' }); c.value = v == null ? '' : v; }
    else if (f.type === 'datetime') { c = h('input', { type: 'datetime-local' }); c.value = v || ''; }
    else { c = h('input', { type: 'text', placeholder: f.type === 'color' ? '#12b76a hoặc tên màu' : '' }); c.value = v == null ? '' : v; }
    var ev = f.type === 'select' ? 'change' : 'input';
    c.addEventListener(ev, function () { obj[key] = f.type === 'number' ? (c.value === '' ? '' : Number(c.value)) : c.value; changed(); if (after) after(); });
    return label(f.label, c, f.hint);
  }
  function summary(b) {
    var d = defs[b.type];
    if (d.container === 'list') return (b.children || []).length + ' khối';
    if (d.container === 'cols') return b.cols.length + ' cột · ' + b.cols.reduce(function (n, c) { return n + c.length; }, 0) + ' khối';
    var p = b.props || {}; for (var k in p) { if (typeof p[k] === 'string' && p[k].trim() && !/^https?:/.test(p[k])) return p[k].replace(/\s+/g, ' ').slice(0, 50); }
    return '';
  }
  // danh sách nơi có thể chuyển khối tới (dùng cho điện thoại, không cần kéo thả)
  function dests(b, cur) {
    var out = [{ label: 'Trang (ngoài cùng)', arr: ROOT }];
    (function walk(list, path, depth) {
      list.forEach(function (x, i) {
        var d = defs[x.type], nm = path + d.label + ' ' + (i + 1);
        if (d.container === 'list') { out.push({ label: nm, arr: x.children, depth: depth }); walk(x.children, nm + ' › ', depth + 1); }
        if (d.container === 'cols') x.cols.forEach(function (c, k) { out.push({ label: nm + ' › Cột ' + (k + 1), arr: c, depth: depth }); walk(c, nm + ' › Cột ' + (k + 1) + ' › ', depth + 1); });
      });
    })(ROOT, '', 0);
    return out.filter(function (t) { return t.arr !== cur && !contains(b, t.arr) && (t.depth || 0) <= MAXD; });
  }
  function body(b, arr) {
    var d = defs[b.type], box = h('div', { class: 'bl-b' });
    d.fields.forEach(function (f) { box.appendChild(control(b.props, f, f.k, d.container === 'cols' && f.k === 'layout' ? function () { sync(b); render(); } : null)); });
    var fs = h('fieldset', {}, [h('legend', { text: 'Bố cục & hiển thị' })]);
    var row = h('div', { class: 'row2' });
    row.appendChild(control(b.style, { label: 'Độ rộng trên máy tính', type: 'select', options: SPANS }, 'sp'));
    row.appendChild(control(b.style, { label: 'Độ rộng trên điện thoại', type: 'select', options: SPANS }, 'sm'));
    fs.appendChild(row);
    var r2 = h('div', { class: 'row2' });
    r2.appendChild(control(b.style, { label: 'Đệm trên/dưới (px)', type: 'number' }, 'py'));
    r2.appendChild(control(b.style, { label: 'Căn chữ', type: 'select', options: [['', 'Mặc định'], ['left', 'Trái'], ['center', 'Giữa'], ['right', 'Phải']] }, 'al'));
    fs.appendChild(r2);
    fs.appendChild(control(b.style, { label: 'Màu nền khối', type: 'color' }, 'bg'));
    fs.appendChild(control(b.style, { label: 'Tràn hết chiều ngang (chỉ khối ngoài cùng)', type: 'check' }, 'full'));
    fs.appendChild(control(b.style, { label: 'Ẩn trên máy tính', type: 'check' }, 'hp'));
    fs.appendChild(control(b.style, { label: 'Ẩn trên điện thoại', type: 'check' }, 'hm'));
    box.appendChild(fs);
    var ds = dests(b, arr);
    if (ds.length) {
      var sel = h('select'); sel.appendChild(h('option', { value: '', text: 'Chọn nơi…' }));
      ds.forEach(function (t, i) { sel.appendChild(h('option', { value: i, text: t.label })); });
      sel.addEventListener('change', function () { if (sel.value === '') return; var t = ds[+sel.value], i = arr.indexOf(b); if (i < 0) return; arr.splice(i, 1); t.arr.push(b); render(); changed(); });
      box.appendChild(label('Chuyển khối này tới', sel));
    }
    return box;
  }
  function move(arr, i, j) { if (j < 0 || j >= arr.length) return; var t = arr.splice(i, 1)[0]; arr.splice(j, 0, t); render(); changed(); }
  function dropAt(arr, idx) {
    if (!drag) return; var b = drag, src = findArr(ROOT, b); drag = null;
    if (!src || contains(b, arr)) return;
    var si = src.indexOf(b); src.splice(si, 1); if (src === arr && si < idx) idx--; arr.splice(idx, 0, b); render(); changed();
  }
  function findArr(list, b) {
    if (list.indexOf(b) >= 0) return list;
    for (var i = 0; i < list.length; i++) { var ks = kidsOf(list[i]); for (var k = 0; k < ks.length; k++) { var r = findArr(ks[k], b); if (r) return r; } }
    return null;
  }
  function card(b, arr, i, depth) {
    var d = defs[b.type], ct = !!d.container;
    var el = h('div', { class: 'bl' + (openId === b.id ? ' open' : '') + (ct ? ' ct' : '') });
    var ib = function (ic, t, fn, cls) { return h('button', { type: 'button', title: t, 'aria-label': t, class: cls || '', html: cfg.icons[ic] || t, onclick: function (e) { e.stopPropagation(); fn(); } }); };
    var hd = h('span', { class: 'hd', title: 'Kéo để đổi chỗ', html: cfg.icons.grid });
    var head = h('div', { class: 'bl-h', onclick: function () { openId = openId === b.id ? null : b.id; render(); } }, [
      hd, h('span', { class: 'nm' }),
      ib('up', 'Lên', function () { move(arr, i, i - 1); }), ib('down', 'Xuống', function () { move(arr, i, i + 1); }),
      ib('copy', 'Nhân đôi', function () { var c = JSON.parse(JSON.stringify(b)); reid(c); arr.splice(i + 1, 0, c); openId = c.id; render(); changed(); }),
      ib('trash', 'Xóa', function () { if (confirm('Xóa khối này' + (ct ? ' và mọi khối bên trong' : '') + '?')) { arr.splice(i, 1); render(); changed(); } }, 'red')]);
    var nm = head.querySelector('.nm'); nm.appendChild(h('b', { text: d.label })); nm.appendChild(h('small', { text: ' ' + summary(b) }));
    hd.addEventListener('mousedown', function () { el.draggable = true; });
    el.addEventListener('dragstart', function (e) { if (e.target !== el) return; drag = b; el.classList.add('drag'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', b.id); } catch (x) {} });
    el.addEventListener('dragend', function (e) { if (e.target !== el) return; el.draggable = false; el.classList.remove('drag'); });
    el.addEventListener('dragover', function (e) { if (drag && drag !== b && !contains(drag, arr)) { e.preventDefault(); e.stopPropagation(); el.classList.add('over'); } });
    el.addEventListener('dragleave', function (e) { if (e.target === el) el.classList.remove('over'); });
    el.addEventListener('drop', function (e) { e.preventDefault(); e.stopPropagation(); el.classList.remove('over'); if (drag && drag !== b) dropAt(arr, arr.indexOf(b)); });
    el.appendChild(head);
    if (openId === b.id) el.appendChild(body(b, arr));
    if (d.container === 'list') el.appendChild(zone(b.children, depth + 1, 'Nội dung bên trong'));
    if (d.container === 'cols') { var ps = parts(b.props.layout); b.cols.forEach(function (c, k) { el.appendChild(zone(c, depth + 1, 'Cột ' + (k + 1) + ' (' + ps[k] + '/12)')); }); }
    return el;
  }
  function zone(list, depth, title) {
    var z = h('div', { class: 'zone' }), l = h('div', { class: 'zl' });
    z.appendChild(h('div', { class: 'zt', text: title }));
    if (!list.length) l.appendChild(h('div', { class: 'bl-empty', text: 'Trống. Kéo khối vào đây hoặc bấm nút bên dưới.' }));
    list.forEach(function (b, i) { l.appendChild(card(b, list, i, depth)); });
    l.addEventListener('dragover', function (e) { if (drag && !contains(drag, list)) { e.preventDefault(); e.stopPropagation(); } });
    l.addEventListener('drop', function (e) { if (e.target === l || e.target.classList.contains('bl-empty')) { e.preventDefault(); e.stopPropagation(); dropAt(list, list.length); } });
    z.appendChild(l);
    z.appendChild(h('button', { type: 'button', class: 'btn ghost sm ic-b zadd', html: cfg.icons.plus + '<span>Thêm khối vào đây</span>', onclick: function () { openSheet(list, depth); } }));
    return z;
  }
  function render() {
    var list = cfg.list; list.innerHTML = '';
    if (!ROOT.length) list.appendChild(h('div', { class: 'box', text: 'Trang trống. Bấm “Thêm khối” để bắt đầu. Dùng “Section” và “Hàng cột” để chia bố cục lồng nhau.' }));
    ROOT.forEach(function (b, i) { list.appendChild(card(b, ROOT, i, 0)); });
  }
  function add(type, tgt) {
    var d = defs[type], p = {}; tgt = tgt || { arr: ROOT, depth: 0 };
    if (d.container && tgt.depth >= MAXD) { alert('Lồng quá sâu, hãy đặt khối này ở cấp ngoài hơn.'); return; }
    d.fields.forEach(function (f) { if (f.def !== undefined) p[f.k] = f.def; });
    var b = { id: uid(), type: type, props: p, style: STYLE0(d.full && tgt.depth === 0) };
    if (d.container === 'list') b.children = [];
    if (d.container === 'cols') { b.cols = []; sync(b); }
    tgt.arr.push(b); openId = d.container ? null : b.id; render(); changed();
    var el = cfg.list.querySelector('.bl.open') || cfg.list.lastElementChild; el && el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function openSheet(list, depth) { pending = { arr: list, depth: depth || 0 }; cfg.sheet.classList.add('on'); }
  function palette() {
    var sh = cfg.sheet, inner = sh.querySelector('.pal'); inner.innerHTML = '';
    var groups = {}; cfg.defs.forEach(function (d) { if ((d.admin && !cfg.isAdmin) || d.inactive) return; (groups[d.group] = groups[d.group] || []).push(d); });
    Object.keys(groups).forEach(function (g) {
      inner.appendChild(h('h4', { text: g })); var grid = h('div', { class: 'g' });
      groups[g].forEach(function (d) { var bt = h('button', { type: 'button', html: (cfg.icons[d.icon] || '') + '<span></span>', onclick: function () { sh.classList.remove('on'); add(d.type, pending); pending = null; } }); bt.querySelector('span').textContent = d.label; grid.appendChild(bt); });
      inner.appendChild(grid);
    });
  }
  cfg.list.addEventListener('dragover', function (e) { if (drag) e.preventDefault(); });
  palette(); render();
  cfg.addBtn.forEach(function (b) { b.addEventListener('click', function () { openSheet(ROOT, 0); }); });
  cfg.sheet.addEventListener('click', function (e) { if (e.target === cfg.sheet) { cfg.sheet.classList.remove('on'); pending = null; } });
  return { get: function () { return ROOT; }, add: add, set: function (a) { ROOT = norm(a); render(); } };
};
