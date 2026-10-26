/* Page Builder Pro - script chạy BÊN TRONG khung xem trước (trang thật): chọn khối, kéo thả, thanh công cụ, sửa chữ trực tiếp.
   Chỉ hoạt động khi được nhúng trong trình dựng cùng nguồn gốc (window.parent.PBX). Trang khách không bao giờ nạp tệp này. */
(function () {
  var P; try { P = window.parent && window.parent !== window ? window.parent.PBX : null; } catch (e) { P = null; }
  if (!P) return;
  var d = document, selId = null, selZone = null, raf = 0;
  var st = d.createElement('style');
  st.textContent = '.pbc-o{position:absolute;pointer-events:none;z-index:2147483000;box-sizing:border-box}.pbc-h{outline:2px dashed #3b82f6;background:rgba(59,130,246,.06)}.pbc-s{outline:2px solid #12b76a;background:rgba(18,183,106,.05)}.pbc-tb{position:absolute;z-index:2147483001;display:flex;gap:2px;align-items:center;background:#12b76a;color:#fff;border-radius:6px 6px 0 0;font:600 11px system-ui;padding:2px 4px;pointer-events:auto;white-space:nowrap}.pbc-tb button{all:unset;cursor:pointer;padding:2px 6px;border-radius:4px;font-size:13px}.pbc-tb button:hover{background:rgba(0,0,0,.25)}.pbc-tb .hd{cursor:grab}.pbc-ind{position:absolute;z-index:2147483002;pointer-events:none;background:#12b76a;box-shadow:0 0 0 1px #fff}.pbc-in{outline:3px dashed #12b76a;outline-offset:-3px;background:transparent;box-shadow:none}[data-bid]{cursor:default}.pbc-ed{outline:2px solid #f59e0b!important;cursor:text!important;min-width:20px}[data-pb-empty]{cursor:pointer}[data-bid]>*:first-child{pointer-events:auto}';
  d.head.appendChild(st);
  var mk = function (c) { var e = d.createElement('div'); e.className = c; d.body.appendChild(e); return e; };
  var hov = mk('pbc-o pbc-h'), sel = mk('pbc-o pbc-s'), ind = mk('pbc-ind'), tb = mk('pbc-tb');
  hov.style.display = sel.style.display = ind.style.display = tb.style.display = 'none';
  var q = function (id) { return d.querySelector('[data-bid="' + id + '"]'); };
  var box = function (el, o) { var r = el.getBoundingClientRect(), sx = window.pageXOffset, sy = window.pageYOffset; o.style.display = 'block'; o.style.left = r.left + sx + 'px'; o.style.top = r.top + sy + 'px'; o.style.width = r.width + 'px'; o.style.height = r.height + 'px'; return r; };
  function btn(t, title, fn) { var b = d.createElement('button'); b.type = 'button'; b.textContent = t; b.title = title; b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); fn(); }); return b; }
  function place() {
    if (P.previewMode) { hov.style.display = sel.style.display = tb.style.display = 'none'; return; }
    var el = selId ? q(selId) : (selZone ? d.querySelector('.bgrid[data-zone="' + selZone + '"]') : null);
    if (!el) { sel.style.display = tb.style.display = 'none'; return; }
    var r = box(el, sel); if (!selId) { tb.style.display = 'none'; return; }
    tb.innerHTML = ''; var lock = el.hasAttribute('data-lock');
    var hd = d.createElement('button'); hd.className = 'hd'; hd.textContent = '⠿ ' + el.getAttribute('data-bt'); hd.title = 'Kéo để chuyển khối'; hd.draggable = true;
    hd.addEventListener('dragstart', function (e) { P.drag = { kind: 'move', id: selId }; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', selId); } catch (x) { } });
    hd.addEventListener('dragend', function () { P.drag = null; ind.style.display = 'none'; });
    tb.appendChild(hd); var id = selId;
    tb.appendChild(btn('↑', 'Lên', function () { P.canvasEvent('up', id); })); tb.appendChild(btn('↓', 'Xuống', function () { P.canvasEvent('down', id); })); tb.appendChild(btn('⧉', 'Nhân đôi', function () { P.canvasEvent('dup', id); }));
    if (!lock || true) tb.appendChild(btn('🗑', 'Xóa', function () { P.canvasEvent('del', id); }));
    tb.style.display = 'flex'; var th = 24; tb.style.left = r.left + window.pageXOffset + 'px'; tb.style.top = Math.max(0, r.top + window.pageYOffset - th) + 'px';
  }
  function sched() { cancelAnimationFrame(raf); raf = requestAnimationFrame(place); }
  window.addEventListener('scroll', sched, { passive: true }); window.addEventListener('resize', sched); window.addEventListener('load', sched);
  try { new ResizeObserver(sched).observe(d.body); } catch (e) { }
  var rootEl = d.getElementById('pb-root'); if (rootEl) new MutationObserver(sched).observe(rootEl, { childList: true, subtree: true });

  d.addEventListener('mouseover', function (e) { if (P.previewMode || P.drag) return; var b = e.target.closest && e.target.closest('[data-bid]'); if (!b || b.getAttribute('data-bid') === selId) { hov.style.display = 'none'; return; } box(b, hov); });
  d.addEventListener('mouseleave', function () { hov.style.display = 'none'; });
  d.addEventListener('click', function (e) {
    if (P.previewMode) return; if (e.target.closest && e.target.closest('.pbc-tb')) return;
    if (e.target.closest && e.target.closest('.pbc-ed')) { e.preventDefault(); return; }
    e.preventDefault(); e.stopPropagation();
    var em = e.target.closest && e.target.closest('[data-pb-empty]'); if (em) { P.canvasEvent('zone', em.parentNode.getAttribute('data-zone')); return; }
    var b = e.target.closest && e.target.closest('[data-bid]'); P.canvasEvent('select', b ? b.getAttribute('data-bid') : null);
  }, true);
  d.addEventListener('submit', function (e) { if (!P.previewMode) e.preventDefault(); }, true);
  d.addEventListener('keydown', function (e) { if (e.target && e.target.classList && e.target.classList.contains('pbc-ed')) return; P.key(e); });

  // ----- sửa chữ trực tiếp (nhấp đúp) -----
  var MAP = { heading: [['.b-h', 'text'], ['.b-sub', 'sub']], button: [['.btn', 'label']], banner: [['h2', 'title'], ['p', 'text']], iconbox: [['b', 'title'], ['p', 'text']], 'pb-cta': [['h2', 'title'], ['.pb-cta-t p', 'text']] };
  d.addEventListener('dblclick', function (e) {
    if (P.previewMode) return; var b = e.target.closest && e.target.closest('[data-bid]'); if (!b || b.hasAttribute('data-lock') && false) return;
    var m = MAP[b.getAttribute('data-bt')]; if (!m) return; var hit = null;
    m.forEach(function (x) { var el = e.target.closest(x[0]); if (!hit && el && b.contains(el)) hit = { el: el, k: x[1] }; }); if (!hit) return;
    e.preventDefault(); var el = hit.el, old = el.textContent, id = b.getAttribute('data-bid'), done = false;
    el.classList.add('pbc-ed'); el.contentEditable = 'plaintext-only'; if (el.contentEditable !== 'plaintext-only') el.contentEditable = 'true'; el.focus();
    try { var r = d.createRange(); r.selectNodeContents(el); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); } catch (x) { }
    function end(ok) { if (done) return; done = true; el.contentEditable = 'false'; el.classList.remove('pbc-ed'); var v = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim(); if (ok && v !== old.trim()) P.canvasEvent('prop', { id: id, k: hit.k, v: v }); else el.textContent = old; }
    el.addEventListener('blur', function () { end(true); }, { once: true });
    el.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); el.blur(); } else if (ev.key === 'Escape') { ev.preventDefault(); end(false); } ev.stopPropagation(); });
  });

  // ----- kéo thả trên trang -----
  function pick(e) {
    var t = e.target; if (!t || !t.closest) return null;
    var em = t.closest('[data-pb-empty]'); if (em) return { zone: em.parentNode.getAttribute('data-zone'), idx: 0, rect: em.getBoundingClientRect(), mode: 'in' };
    var bl = t.closest('[data-bid]'), dr = P.drag, mv = dr && dr.kind === 'move' ? q(dr.id) : null;
    if (!bl) { var g = t.closest('.bgrid[data-zone]'); if (!g) g = d.querySelector('.bgrid[data-zone]'); if (!g) return null; var a0 = P.zoneArr(g.getAttribute('data-zone')); return { zone: g.getAttribute('data-zone'), idx: a0 ? a0.length : 0, rect: g.getBoundingClientRect(), mode: 'in' }; }
    if (mv && (mv === bl || mv.contains(bl))) return null;
    var bt = bl.getAttribute('data-bt');
    if (['section', 'columns', 'card'].indexOf(bt) >= 0) { var zg = t.closest('.bgrid[data-zone]'); if (zg && bl.contains(zg) && zg.closest('[data-bid]') === bl) { var a = P.zoneArr(zg.getAttribute('data-zone')); return { zone: zg.getAttribute('data-zone'), idx: a ? a.length : 0, rect: zg.getBoundingClientRect(), mode: 'in' }; } }
    var grid = bl.parentNode, zone = grid.getAttribute('data-zone'); if (!zone) return null;
    var sibs = [].filter.call(grid.children, function (c) { return c.hasAttribute('data-bid'); }), i = sibs.indexOf(bl), r = bl.getBoundingClientRect(), after = e.clientY > r.top + r.height / 2;
    return { zone: zone, idx: i + (after ? 1 : 0), rect: r, mode: after ? 'after' : 'before' };
  }
  function showInd(p) {
    if (!p) { ind.style.display = 'none'; return; } var sx = window.pageXOffset, sy = window.pageYOffset, r = p.rect; ind.style.display = 'block';
    if (p.mode === 'in') { ind.className = 'pbc-ind pbc-in'; ind.style.left = r.left + sx + 'px'; ind.style.top = r.top + sy + 'px'; ind.style.width = r.width + 'px'; ind.style.height = r.height + 'px'; }
    else { ind.className = 'pbc-ind'; ind.style.left = r.left + sx + 'px'; ind.style.width = r.width + 'px'; ind.style.height = '4px'; ind.style.top = (p.mode === 'before' ? r.top : r.bottom) + sy - 2 + 'px'; }
  }
  d.addEventListener('dragover', function (e) { if (!P.drag) return; var p = pick(e); if (!p) { ind.style.display = 'none'; return; } e.preventDefault(); e.dataTransfer.dropEffect = P.drag.kind === 'move' ? 'move' : 'copy'; showInd(p); });
  d.addEventListener('drop', function (e) { if (!P.drag) return; e.preventDefault(); var p = pick(e); ind.style.display = 'none'; if (p) P.drop(p.zone, p.idx); else P.drag = null; });
  d.addEventListener('dragleave', function (e) { if (!e.relatedTarget) ind.style.display = 'none'; });
  d.addEventListener('dragend', function () { ind.style.display = 'none'; });

  window.PBC = {
    select: function (id, zone, scroll) { selId = id || null; selZone = id ? null : zone || null; place(); if (scroll && selId) { var el = q(selId); if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } },
    refresh: place, scrollZone: function (z) { var g = d.querySelector('.bgrid[data-zone="' + z + '"]'); if (g) g.scrollIntoView({ block: 'start', behavior: 'smooth' }); },
  };
  place(); try { P.canvasReady(); } catch (e) { }
})();
