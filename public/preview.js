/* Xem trước PC / điện thoại. Dùng: NhipPreview(rootEl, () => ({kind:'page', ...})) */
window.NhipPreview = function (root, getData) {
  var stage = root.querySelector('.pv-stage'), frame = root.querySelector('iframe'), info = root.querySelector('.pv-info');
  var dev = 'pc', W = { pc: 1280, m: 390 };
  function fit() {
    var w = W[dev], avail = stage.clientWidth || 360;
    var s = dev === 'pc' ? Math.min(1, avail / w) : 1;
    var h = Math.round(Math.max(480, window.innerHeight * 0.68));
    frame.style.width = w + 'px'; frame.style.height = (h / s) + 'px';
    frame.style.transform = s < 1 ? 'scale(' + s + ')' : 'none';
    stage.style.height = h + 'px'; stage.className = 'pv-stage ' + dev;
    if (dev === 'm') stage.style.height = h + 'px';
    info.textContent = dev === 'pc' ? 'MÁY TÍNH · ' + w + 'px' + (s < 1 ? ' (thu nhỏ ' + Math.round(s * 100) + '%)' : '') : 'ĐIỆN THOẠI · ' + w + 'px';
  }
  function load() {
    info.textContent = 'Đang dựng…';
    fetch('/admin/xem-truoc', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(getData()), credentials: 'same-origin' })
      .then(function (r) { return r.text(); })
      .then(function (h) { frame.srcdoc = h.replace('<head>', '<head><base target="_blank">'); fit(); })
      .catch(function () { info.textContent = 'Không dựng được bản xem trước'; });
  }
  root.querySelectorAll('[data-dev]').forEach(function (b) {
    b.addEventListener('click', function () {
      dev = b.getAttribute('data-dev');
      root.querySelectorAll('[data-dev]').forEach(function (x) { x.classList.toggle('on', x === b); });
      fit();
    });
  });
  root.querySelector('[data-reload]').addEventListener('click', load);
  window.addEventListener('resize', fit);
  return { load: load, fit: fit };
};
