/* NHIP VOICE v1 (V2.97k) — GIỌNG ĐỌC CHO PHÒNG LIVE
   - Nút "🎚 Giọng" cạnh "🔊 Đọc to": chọn giọng, phong cách (lĩnh vực), tốc độ, cao độ, âm lượng, nghe thử.
   - Nguồn giọng 1: giọng của thiết bị (Web Speech) — liệt kê MỌI giọng tiếng Việt máy có, xếp giọng tự nhiên lên đầu
     (Edge: HoaiMy/NamMinh Natural · Android/Chrome: Google Tiếng Việt · iPhone/Mac: Linh).
   - Nguồn giọng 2: giọng AI qua máy chủ chuẩn OpenAI (/v1/audio/speech): OpenAI gpt-4o-mini-tts (có chỉ dẫn cảm xúc),
     hoặc máy chủ nguồn mở tự chạy (VietTTS, VieNeu-TTS...). Lỗi/ngắt kết nối → tự quay về giọng thiết bị.
   - Chuẩn hoá lời đọc tiếng Việt: số 1.285,34 · +1,2% · ngày/tháng · VN-Index, HOSE, P/E, ROE... + từ điển do bạn tự thêm.
   - Truyền cảm theo nội dung: câu tăng/giảm/rủi ro/hỏi/cảm thán đổi nhẹ cao độ + tốc độ; nghỉ dài ngắn theo dấu câu.
   API: NHIPVoice.play(mảngCâu,{on(i),done(),stale(),fail(msg)}) · stop() · openPanel({onOpen}) · state() */
(function (root) {
  'use strict';
  var KEY = 'nhip-live-voice';
  /* ================= PHẦN THUẦN (kiểm thử bằng node) ================= */
  var STYLES = [
    { id: 'tin', ic: '📰', nm: 'Bản tin chứng khoán', rate: 1.0, pitch: 1.0, gap: 380, emph: .5, ins: 'Đọc như phát thanh viên bản tin tài chính tiếng Việt: rõ ràng, điềm tĩnh, chuyên nghiệp, nhấn nhẹ vào con số và mã cổ phiếu.' },
    { id: 'tc', ic: '🎭', nm: 'Truyền cảm', rate: .94, pitch: 1.04, gap: 480, emph: 1.0, ins: 'Đọc tiếng Việt truyền cảm, ấm áp, có nhấn nhá, lên xuống giọng theo ý nghĩa của từng câu, như đang tâm sự với người nghe.' },
    { id: 'ke', ic: '📖', nm: 'Kể chuyện', rate: .88, pitch: 1.0, gap: 700, emph: .8, ins: 'Đọc như người kể chuyện: chậm rãi, giàu cảm xúc, ngắt nghỉ rõ ràng, tạo cảm giác cuốn hút.' },
    { id: 'pod', ic: '🎧', nm: 'Podcast thân mật', rate: 1.04, pitch: 1.03, gap: 320, emph: .8, ins: 'Đọc như người dẫn podcast: tự nhiên, gần gũi, vui vẻ, nhịp nói thoải mái.' },
    { id: 'nong', ic: '🔥', nm: 'Tin nóng · sôi động', rate: 1.12, pitch: 1.07, gap: 220, emph: 1.3, ins: 'Đọc như bản tin nóng: nhanh, dồn dập, đầy năng lượng, nhấn mạnh các diễn biến lớn.' },
    { id: 'cg', ic: '🧑‍💼', nm: 'Chuyên gia điềm đạm', rate: .93, pitch: .93, gap: 520, emph: .6, ins: 'Đọc như chuyên gia phân tích dày dạn: giọng trầm, điềm đạm, chắc chắn, thận trọng khi nói về rủi ro.' },
    { id: 'gd', ic: '🎓', nm: 'Giảng giải · giáo dục', rate: .9, pitch: 1.0, gap: 620, emph: .7, ins: 'Đọc như giảng viên: rõ từng chữ, chậm vừa phải, ngắt nghỉ để người nghe kịp hiểu.' }
  ];
  var DICT = {
    'VN-Index': 'Vi En Ín-đếch', 'VNINDEX': 'Vi En Ín-đếch', 'VNIndex': 'Vi En Ín-đếch', 'VN30': 'Vi En ba mươi',
    'HNX-Index': 'Hát En Ích Ín-đếch', 'HNXINDEX': 'Hát En Ích Ín-đếch', 'UPCoM-Index': 'Úp-com Ín-đếch', 'UPCOM': 'Úp-com', 'UPCoM': 'Úp-com',
    'HOSE': 'Hô-sê', 'HNX': 'Hát En Ích', 'HSX': 'Hát Ét Ích', 'TP.HCM': 'Thành phố Hồ Chí Minh',
    'P/E': 'P trên E', 'P/B': 'P trên B', 'EPS': 'ê-pê-ét', 'ROE': 'rô-ê', 'ROA': 'rô-a', 'RSI': 'rờ-ét-i', 'MACD': 'mắc-đi',
    'EMA': 'i-em-ây', 'SMA': 'ét-em-ây', 'MA': 'em-ây', 'ATR': 'ây-ti-a', 'ETF': 'i-ti-ép', 'IPO': 'ai-pi-âu', 'GDP': 'gi-đi-pi', 'CPI': 'xi-pi-ai',
    'ATO': 'ây-ti-âu', 'ATC': 'ây-ti-xi', 'Fed': 'Phét', 'FED': 'Phét', 'USD': 'đô la Mỹ', 'VND': 'đồng', 'VNĐ': 'đồng', 'AI': 'ây ai',
    'T+2': 'T cộng hai', 'YoY': 'so với cùng kỳ', 'QoQ': 'so với quý trước',
    'ĐHCĐ': 'đại hội cổ đông', 'HĐQT': 'hội đồng quản trị', 'NHNN': 'Ngân hàng Nhà nước', 'TTCK': 'thị trường chứng khoán',
    'LNST': 'lợi nhuận sau thuế', 'KLGD': 'khối lượng giao dịch', 'GTGD': 'giá trị giao dịch', 'BCTC': 'báo cáo tài chính',
    'KQKD': 'kết quả kinh doanh', 'BĐS': 'bất động sản', 'NĐT': 'nhà đầu tư', 'DN': 'doanh nghiệp'
  };
  var UP = ['tăng', 'bứt phá', 'vượt', 'khởi sắc', 'tích cực', 'hưng phấn', 'lạc quan', 'thuận lợi', 'hồi phục', 'bùng nổ', 'kỷ lục', 'đột phá', 'cải thiện', 'mạnh lên', 'xanh'];
  var DOWN = ['giảm', 'lao dốc', 'bán tháo', 'rủi ro', 'cảnh báo', 'tiêu cực', 'thận trọng', 'áp lực', 'suy yếu', 'sụt', 'thua lỗ', 'bất lợi', 'mất điểm', 'đỏ'];
  var LET = '\\p{L}\\p{N}_';
  var reCache = {};
  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function parseDict(raw) {
    var o = {};
    String(raw || '').split('\n').forEach(function (l) {
      var i = l.indexOf('='); if (i < 1) return;
      var k = l.slice(0, i).trim(), v = l.slice(i + 1).trim();
      if (k && v.length) o[k] = v;
    });
    return o;
  }
  function dictRe(d) {
    var ks = Object.keys(d).sort(function (a, b) { return b.length - a.length }), sig = ks.join('\u0001');
    if (!reCache[sig]) reCache[sig] = ks.length ? new RegExp('(^|[^' + LET + '])(' + ks.map(esc).join('|') + ')(?=$|[^' + LET + '])', 'gu') : null;
    return reCache[sig];
  }
  function applyDict(s, d) { var re = dictRe(d); return re ? s.replace(re, function (_, a, k) { return a + d[k] }) : s }
  function numVi(x) {
    var m, i, f = '';
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(x)) { x = x.replace(/\./g, '') }
    else if (/^\d{1,3}(,\d{3}){2,}(\.\d+)?$/.test(x)) { x = x.replace(/,/g, '').replace('.', ',') }
    else if (/^\d{1,3}\.\d{3}$/.test(x)) { x = x.replace('.', '') }
    else if (/^\d+\.\d+$/.test(x)) { x = x.replace('.', ',') }
    if ((i = x.indexOf(',')) >= 0) { f = x.slice(i + 1).replace(/0+$/, ''); x = x.slice(0, i) + (f ? ' phẩy ' + f : '') }
    return x;
  }
  function normalize(text, user) {
    var d = {}, k; for (k in DICT) d[k] = DICT[k]; user = user || {}; for (k in user) d[k] = user[k];
    var s = String(text == null ? '' : text);
    s = s.replace(/\u25B2|↑/g, ' tăng ').replace(/\u25BC|↓/g, ' giảm ')
      .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\uFE0F\u200D]/gu, ' ')
      .replace(/\*\*|__|`|^#+\s*/gm, '').replace(/^\s*[-*•]\s+/gm, '');
    s = applyDict(s, d);
    s = s.replace(/\b(TP|Tp)\.\s?/g, 'thành phố ');
    s = s.replace(/([A-Za-z]{2,})(\d{1,4})(?![\d])/g, '$1 $2');
    s = applyDict(s, d);
    s = s.replace(/(\d{1,2})\/(\d{1,2})\/(\d{4})/g, function (m, a, b, c, off) { return (/ngày\s*$/i.test(s.slice(0, off)) ? '' : 'ngày ') + a + ' tháng ' + b + ' năm ' + c }).replace(/(ngày\s+)(\d{1,2})\/(\d{1,2})(?!\d)/gi, '$1$2 tháng $3')
      .replace(/\bQ([1-4])\b/g, 'quý $1');
    s = s.replace(/([+\-−–])?(\s?)(\d[\d.,]*)\s*%/g, function (m, sg, sp, n, off) {
      var pre = s.slice(0, off), w = sp;
      if (sg) {
        if (/\d$/.test(pre)) w = ' đến ';
        else if (/(tăng|giảm|lên|xuống|mất|thêm|hơn|khoảng|gần|đạt|còn|ở|là)\s*$/i.test(pre)) w = ' ';
        else w = (sg === '+' ? ' tăng ' : ' giảm ');
      }
      return w + numVi(n.replace(/[.,]+$/, '')) + ' phần trăm';
    });
    s = s.replace(/(\d)\s?(?:₫|đ)(?![\p{L}])/gu, '$1 đồng').replace(/\d+(?:[.,]\d+)*/g, function (n) { return numVi(n) });
    s = s.replace(/&/g, ' và ').replace(/≥/g, ' lớn hơn hoặc bằng ').replace(/≤/g, ' nhỏ hơn hoặc bằng ').replace(/→/g, ' thành ').replace(/~/g, ' khoảng ')
      .replace(/(\p{L})\/(\p{L})/gu, '$1 trên $2').replace(/\s=\s/g, ' bằng ').replace(/\s>\s/g, ' lớn hơn ').replace(/\s<\s/g, ' nhỏ hơn ')
      .replace(/[()\[\]]/g, ',').replace(/\s[—–-]\s/g, ', ');
    s = s.replace(/\s*,(\s*,)+/g, ',').replace(/,\s*([.!?…])/g, '$1').replace(/\s+,/g, ',').replace(/,(?=[^\s])/g, ', ').replace(/^[\s,]+/, '').replace(/[ \t\u00A0]+/g, ' ').trim();
    return s;
  }
  /* tách thành các đoạn ngắn (≤ ~140 ký tự) để giọng máy không bị cắt giữa chừng và có chỗ nghỉ */
  function splitChunks(text) {
    var out = [];
    String(text || '').replace(/([.!?…]+)\s+/g, '$1\u0001').split('\u0001').forEach(function (sen) {
      sen = sen.trim(); if (!sen) return;
      var parts = sen.length <= 140 ? [sen] : (function () {
        var segs = sen.split(/([,;:])\s+/), acc = [], cur = '';
        for (var q = 0; q < segs.length; q += 2) { var piece = segs[q] + (segs[q + 1] || ''); if (cur && (cur + ' ' + piece).length > 120) { acc.push(cur); cur = piece } else cur = cur ? cur + ' ' + piece : piece }
        if (cur) acc.push(cur); return acc;
      })();
      for (var i = 0; i < parts.length; i++) {
        if (parts[i].length < 18 && i < parts.length - 1) { parts[i + 1] = parts[i] + ' ' + parts[i + 1]; parts[i] = ''; }
      }
      parts = parts.filter(Boolean);
      parts.forEach(function (p, i) { out.push({ t: p, last: i === parts.length - 1 }) });
    });
    return out;
  }
  function has(t, a) { t = t.toLowerCase(); for (var i = 0; i < a.length; i++) if (t.indexOf(a[i]) >= 0) return true; return false }
  function tone(t, st) {
    var r = 1, p = 1, e = st.emph, u = has(t, UP), d = has(t, DOWN);
    if (u && !d) { p += .05 * e; r += .03 * e } else if (d && !u) { p -= .05 * e; r -= .04 * e }
    if (/\?\s*$/.test(t)) p += .06 * e;
    if (/!\s*$/.test(t)) { p += .05 * e; r += .04 * e }
    return { r: r, p: p };
  }
  var clamp = function (x, a, b) { return Math.min(b, Math.max(a, x)) };
  function gapOf(c, st) { return /[.!?…]$/.test(c.t) ? st.gap : Math.round(st.gap * .45) }
  var P = { STYLES: STYLES, DICT: DICT, normalize: normalize, splitChunks: splitChunks, tone: tone, parseDict: parseDict, numVi: numVi, clamp: clamp, gapOf: gapOf };
  if (typeof module !== 'undefined' && module.exports) { module.exports = P; }
  if (typeof window === 'undefined' || !root.document) return;

  /* ================= PHẦN TRÌNH DUYỆT ================= */
  var SAMPLE = 'Xin chào các bạn. VN-Index tăng 1,2% lên 1.285,34 điểm, thanh khoản cải thiện rõ rệt. Nhưng hãy thận trọng, vì rủi ro điều chỉnh vẫn còn!';
  var KORVA = [['phuong_linh', 'Phương Linh · nữ · bản tin'], ['khanh_vy', 'Khánh Vy · nữ · ấm áp'], ['bao_kim', 'Bảo Kim · nữ · podcast'], ['ngoc_huyen', 'Ngọc Huyền · nữ · giảng giải'], ['quynh_nhu', 'Quỳnh Như · nữ · thân mật'],
    ['hoang_nam', 'Hoàng Nam · nam · trang trọng'], ['thanh_phong', 'Thanh Phong · nam · sôi động'], ['gia_bao', 'Gia Bảo · nam · review'], ['huu_dat', 'Hữu Đạt · nam · công nghệ'], ['quang_huy', 'Quang Huy · nam · lời nhắc']];
  var isKorva = function () { return /korva/i.test(S.srv.model || '') };
  var isCf = function () { return /cloudflare/i.test(S.srv.model || '') };
  var CF_VOICES = [['vi-VN-HoaiMyNeural', 'HoaiMy · nữ'], ['vi-VN-NamMinhNeural', 'NamMinh · nam']];
  var PRESETS = {
    cf: { nm: '☁ Giọng trên Cloudflare (không cần cài · dùng cho điện thoại)', url: '/proxy/tts', model: 'cloudflare', voice: 'vi-VN-HoaiMyNeural' },
    korva: { nm: '⚡ KorvaTTS trên máy tính (không dùng cho điện thoại)', url: 'http://localhost:8298/v1', model: 'korvatts', voice: 'phuong_linh' },
    openai: { nm: 'OpenAI (có chỉ dẫn cảm xúc)', url: 'https://api.openai.com/v1', model: 'gpt-4o-mini-tts', voice: 'coral' },
    local: { nm: 'Máy chủ tự chạy (VietTTS, VieNeu… — máy tính)', url: 'http://localhost:8298/v1', model: 'tts-1', voice: '' }
  };
  var OAI_VOICES = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer', 'verse'];
  var S = { eng: 'web', voice: '', style: 'tin', rate: 1, pitch: 1, vol: 1, dict: '', srv: { url: '', key: '', model: 'tts-1', voice: '' } };
  (function load() { try { var o = JSON.parse(localStorage.getItem(KEY) || 'null'); if (o && typeof o === 'object') { for (var k in o) if (k !== 'srv') S[k] = o[k]; if (o.srv) for (var j in o.srv) S.srv[j] = o.srv[j] } } catch (e) { } })();
  /* v2.99e: trang chạy trên Cloudflare (không phải máy tính của bạn) → mặc định dùng ☁ Giọng trên Cloudflare; điện thoại không dùng được địa chỉ localhost nên tự chuyển sang Cloudflare */
  (function auto() {
    try {
      var h = (root.location && root.location.hostname) || '', local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(h) || !h, fresh = !localStorage.getItem(KEY);
      var phone = /Android|iPhone|iPad|iPod|Mobile/i.test((root.navigator && navigator.userAgent) || ''), bad = /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(S.srv.url || '');
      if (!local && (fresh || (S.eng === 'srv' && bad && phone) || (S.eng === 'srv' && !S.srv.url))) { S.eng = 'srv'; S.srv.url = '/proxy/tts'; S.srv.model = 'cloudflare'; S.srv.key = ''; if (!/^vi-VN-/.test(S.srv.voice || '')) S.srv.voice = 'vi-VN-HoaiMyNeural'; try { localStorage.setItem(KEY, JSON.stringify(S)) } catch (e) { } }
    } catch (e) { }
  })();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)) } catch (e) { } }
  var style = function () { for (var i = 0; i < STYLES.length; i++) if (STYLES[i].id === S.style) return STYLES[i]; return STYLES[0] };
  var T = 0, au = null, unlocked = false, ctl = null, cache = new Map(), previewing = false;

  /* ---- giọng thiết bị ---- */
  var hasWeb = function () { return 'speechSynthesis' in root && typeof root.SpeechSynthesisUtterance === 'function' };
  function vscore(v) { var n = v.name + ' ' + v.voiceURI, s = 0; if (/natural|neural|online|premium|enhanced|nâng cao/i.test(n)) s += 5; if (/microsoft/i.test(n)) s += 2; if (/google/i.test(n)) s += 2; if (/linh|hoaimy|namminh/i.test(n)) s += 1; if (!v.localService) s += 1; return s }
  function wvoices() { try { return speechSynthesis.getVoices().filter(function (v) { return /^vi/i.test(String(v.lang).replace('_', '-')) }).sort(function (a, b) { return vscore(b) - vscore(a) }) } catch (e) { return [] } }
  function pickVoice() { var l = wvoices(); for (var i = 0; i < l.length; i++) if (l[i].voiceURI === S.voice) return l[i]; return l[0] || null }
  if (hasWeb()) try { speechSynthesis.addEventListener('voiceschanged', function () { if (panel) fillVoices() }) } catch (e) { }

  /* ---- âm thanh (giọng AI) ---- */
  var SILENT = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
  function audioEl() { return au || (au = new Audio()) }
  function unlock() { if (unlocked) return; unlocked = true; try { var a = audioEl(); a.src = SILENT; a.volume = 0; var p = a.play(); if (p && p.catch) p.catch(function () { }) } catch (e) { } }
  var voiceSrv = function () { var v = S.srv.voice; if (isCf() && !CF_VOICES.some(function (k) { return k[0] === v })) return CF_VOICES[0][0]; if (isKorva() && !KORVA.some(function (k) { return k[0] === v })) return KORVA[0][0]; return v };
  var oaiHost = function (u) { return /^https:\/\/api\.openai\.com\//.test(u) };
  function fetchAudio(text, c, sig) {
    var cf = S.srv, st = style(), rate = clamp(st.rate * S.rate, .5, 1.8), vo = voiceSrv(), oai = oaiHost(cf.url);
    var key = [cf.url, cf.model, vo, oai ? S.style : '', oai ? rate.toFixed(2) : '', text].join('|');
    if (cache.has(key)) return Promise.resolve(cache.get(key));
    var url = String(cf.url).replace(/\/+$/, '') + '/audio/speech', body = { model: cf.model || 'tts-1', input: text, voice: vo || 'alloy' };
    if (oai && Math.abs(rate - 1) > .02) body.speed = clamp(rate, .25, 4);
    if (/gpt-4o.*tts/i.test(body.model)) body.instructions = st.ins;
    var h = { 'Content-Type': 'application/json' }; if (cf.key) h.Authorization = 'Bearer ' + cf.key;
    var target = oaiHost(url) ? '/proxy/ai?u=' + encodeURIComponent(url) : url;
    return fetch(target, { method: 'POST', headers: h, body: JSON.stringify(body), signal: sig }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status); try { noteVia(r.headers && r.headers.get && r.headers.get('X-NHIP-Voice')) } catch (e) { } return r.blob();
    }).then(function (b) {
      if (!/audio|octet|mpeg|wav|ogg/i.test(b.type) && b.size < 2000) throw new Error('phản hồi không phải âm thanh');
      cache.set(key, b); if (cache.size > 40) cache.delete(cache.keys().next().value); return b;
    });
  }

  /* ---- phát ---- */
  function stop() {
    T++; if (ctl) { try { ctl.abort() } catch (e) { } ctl = null }
    try { if (au) { au.onended = au.onerror = null; au.pause(); au.removeAttribute('src') } } catch (e) { }
    try { if (hasWeb()) speechSynthesis.cancel() } catch (e) { }
    previewing = false;
  }
  function playWeb(chunks, from, o, tok) {
    var i = from, st = style(), pv = pickVoice();
    var next = function () {
      if (tok !== T || (o.stale && o.stale())) return;
      if (i >= chunks.length) { o.done && o.done(); return }
      var c = chunks[i++], tn = tone(c.t, st), u = new root.SpeechSynthesisUtterance(c.t), fin = false, wd;
      if (c.first && o.on) o.on(c.b);
      if (pv) { u.voice = pv; u.lang = pv.lang } else u.lang = 'vi-VN';
      u.rate = clamp(st.rate * S.rate * tn.r, .5, 1.8); u.pitch = clamp(st.pitch * S.pitch * tn.p, .5, 1.6); u.volume = clamp(S.vol, 0, 1);
      var nx = function () { if (fin) return; fin = true; clearTimeout(wd); setTimeout(next, gapOf(c, st)) };
      u.onend = nx; u.onerror = function (e) { if (e && (e.error === 'canceled' || e.error === 'interrupted')) return; nx() };
      wd = setTimeout(nx, c.t.length * 150 / u.rate + 5000);
      try { speechSynthesis.speak(u) } catch (e) { nx() }
    };
    setTimeout(next, 120);
  }
  function playSrv(chunks, o, tok) {
    var st = style(), jobs = {}, i = 0, warned = false; ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var sig = ctl ? ctl.signal : undefined;
    var get = function (k) { if (k >= chunks.length) return null; if (!jobs[k]) { jobs[k] = fetchAudio(chunks[k].t, chunks[k], sig); jobs[k].catch(function () { }) } return jobs[k] };
    var bail = function (k, e) {
      if (tok !== T) return;
      var m = 'Giọng AI lỗi (' + ((e && e.message) || 'không rõ') + ') — chuyển sang giọng thiết bị';
      o.fail && o.fail(m);
      if (hasWeb()) playWeb(chunks, k, o, tok); else o.done && o.done();
    };
    var next = function () {
      if (tok !== T || (o.stale && o.stale())) return;
      if (i >= chunks.length) { o.done && o.done(); return }
      var k = i++, c = chunks[k], cur = get(k); get(k + 1); get(k + 2);
      cur.then(function (blob) {
        if (tok !== T || (o.stale && o.stale())) return;
        var a = audioEl(), u = URL.createObjectURL(blob);
        if (c.first && o.on) o.on(c.b);
        a.onended = function () { URL.revokeObjectURL(u); setTimeout(next, gapOf(c, st)) };
        a.onerror = function () { URL.revokeObjectURL(u); bail(k, new Error('không phát được âm thanh')) };
        var pr = oaiHost(S.srv.url) ? 1 : clamp(st.rate * S.rate, .5, 2); a.volume = clamp(S.vol, 0, 1); a.src = u; a.defaultPlaybackRate = pr; a.playbackRate = pr;
        var p = a.play(); if (p && p.catch) p.catch(function (e) { if (tok === T) bail(k, e) });
      }).catch(function (e) { if (e && e.name === 'AbortError') return; bail(k, e) });
    };
    next();
  }
  function play(texts, o) {
    o = o || {}; stop(); var tok = T, d = parseDict(S.dict), chunks = [];
    (texts || []).forEach(function (t, b) { splitChunks(normalize(t, d)).forEach(function (c, j, a) { c.b = b; c.first = j === 0; chunks.push(c) }) });
    if (!chunks.length) { o.done && o.done(); return }
    unlock();
    if (S.eng === 'srv' && S.srv.url) playSrv(chunks, o, tok);
    else if (hasWeb()) playWeb(chunks, 0, o, tok);
    else o.fail && o.fail('Thiết bị không hỗ trợ đọc');
  }

  /* ================= BẢNG CHỌN GIỌNG ================= */
  var panel = null, CSS = '.nv-bk{position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:100040;display:flex;align-items:flex-end;justify-content:center}' +
    '.nv-pn{background:var(--surface,#fff);color:var(--text,#16303a);width:min(34em,100vw);max-height:88vh;overflow:auto;border-radius:1.1em 1.1em 0 0;padding:.8em .9em 1.2em;box-shadow:0 -8px 30px rgba(0,0,0,.28);font-size:15px;line-height:1.45;-webkit-overflow-scrolling:touch}' +
    '@media(min-width:720px){.nv-bk{align-items:center}.nv-pn{border-radius:1.1em}}' +
    '.nv-h{display:flex;align-items:center;gap:.5em;margin-bottom:.4em}.nv-h b{flex:1;font-size:1.08em}' +
    '.nv-x{border:0;background:var(--bg,#f4faf9);border-radius:.6em;min-width:2.2em;min-height:2.2em;cursor:pointer;color:inherit;font-size:1em}' +
    '.nv-l{display:block;margin:.8em 0 .3em;font-weight:700;font-size:.86em;color:var(--muted,#71879b)}' +
    '.nv-seg{display:flex;gap:.35em}.nv-seg button,.nv-ch button,.nv-bt{border:1px solid var(--line,#e0eeef);background:var(--bg,#f4faf9);color:inherit;border-radius:.7em;padding:.4em .7em;cursor:pointer;font:inherit;font-weight:700;min-height:2.3em}' +
    '.nv-seg button{flex:1}.nv-seg button.on,.nv-ch button.on,.nv-bt.p{background:var(--acc,#12b98b);border-color:var(--acc,#12b98b);color:#fff}' +
    '.nv-ch{display:flex;flex-wrap:wrap;gap:.35em}.nv-ch button{font-size:.92em;padding:.3em .6em}' +
    '.nv-in{border:1px solid var(--line,#e0eeef);border-radius:.6em;padding:.45em .55em;background:var(--bg,#f4faf9);color:inherit;font:inherit;width:100%;box-sizing:border-box;min-width:0}' +
    '.nv-r{display:grid;grid-template-columns:5.5em 1fr 3.2em;align-items:center;gap:.5em;margin:.25em 0}.nv-r input{width:100%;accent-color:var(--acc,#12b98b)}.nv-r output{text-align:right;color:var(--muted,#71879b);font-size:.88em}' +
    '.nv-st{margin:.7em 0 0;padding:.5em .6em;border-radius:.7em;background:var(--bg,#f4faf9);border:1px solid var(--line,#e0eeef);font-size:.9em}.nv-auto{display:flex;gap:.5em;align-items:center;margin:.6em 0 0;font-size:.92em}.nv-in:disabled{opacity:.6}' +
    '.nv-m{color:var(--muted,#71879b);font-size:.84em;margin:.3em 0}.nv-m a{color:var(--acc,#12b98b)}' +
    '.nv-row{display:flex;gap:.4em;margin-top:.7em}.nv-row .nv-bt{flex:1}' +
    '.nv-pn details{margin-top:.8em;border-top:1px solid var(--line,#e0eeef);padding-top:.5em}.nv-pn summary{cursor:pointer;font-weight:700}' +
    '.nv-pn textarea{min-height:6em;resize:vertical;font-family:inherit}';
  var $ = function (s) { return panel && panel.querySelector(s) };
  function fillVoices() {
    var sel = $('#nvVoice'); if (!sel) return; var l = wvoices(), cur = pickVoice();
    if (!l.length) { sel.innerHTML = '<option value="">(Chưa có giọng tiếng Việt)</option>'; var h = $('#nvNoV'); if (h) h.style.display = ''; return }
    var h2 = $('#nvNoV'); if (h2) h2.style.display = 'none';
    sel.innerHTML = l.map(function (v) { var q = vscore(v) >= 5 ? '★ ' : '', gd = /hoaimy|linh/i.test(v.name) ? ' · nữ' : /namminh/i.test(v.name) ? ' · nam' : ''; return '<option value="' + escA(v.voiceURI) + '"' + (cur && cur.voiceURI === v.voiceURI ? ' selected' : '') + '>' + q + escA(v.name) + gd + (v.localService ? '' : ' · online') + '</option>' }).join('');
  }
  var escA = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] }) };
  var gIc = function (n) { return /nữ/.test(n) ? '👩 ' : /nam/.test(n) ? '👨 ' : '' };
  var CAP = null, VIA = '';
  var capNow = function () { return CAP && CAP.u === S.srv.url ? CAP : null };
  var VIA_NAME = { 'vi-VN-HoaiMyNeural': '👩 HoaiMy (nữ, Microsoft)', 'vi-VN-NamMinhNeural': '👨 NamMinh (nam, Microsoft)', google: '👩 Google (nữ)' };
  function viaHtml() { return VIA ? '🔊 Lần đọc gần nhất dùng đúng: <b>' + escA(VIA_NAME[VIA] || VIA) + '</b>' + (isCf() && VIA === 'google' && /NamMinh/.test(voiceSrv()) ? ' — bạn chọn Nam nhưng Microsoft đang không dùng được nên máy chủ phải đọc bằng Google.' : '') : '' }
  function noteVia(v) { if (!v) return; VIA = v; var e = $('#nvVia'); if (e) e.innerHTML = viaHtml() }
  function btns(L, cur) { return '<div class="nv-ch">' + L.map(function (k) { return '<button data-v="sv" data-id="' + escA(k[0]) + '" class="' + (k[0] === cur ? 'on' : '') + '">' + escA(k[1]) + '</button>' }).join('') + '</div>' }
  function voiceInner() {
    var cur = voiceSrv(), c = capNow();
    if (isCf()) {
      if (c && c.ok && !(c.azure || c.edge)) return '<label class="nv-l">Giọng đang có thật</label><div class="nv-ch"><button class="on" data-v="noop">👩 Google · nữ (giọng duy nhất lúc này)</button></div><div class="nv-m">Microsoft HoaiMy/NamMinh chưa dùng được' + (c.err ? ' (' + escA(c.err) + ')' : '') + ', nên chỉ có 1 giọng nữ — mình không hiện giọng Nam để tránh nhầm. Muốn nhiều giọng: chọn “📱 Giọng thiết bị” phía trên, hoặc thêm khóa Azure (xem HUONG-DAN-GIONG-AI.txt).</div>';
      return '<label class="nv-l">Giọng — bạn tự chọn nam / nữ</label>' + btns(CF_VOICES.map(function (k) { return [k[0], k[1].indexOf('nữ') > 0 ? '👩 Nữ · HoaiMy' : '👨 Nam · NamMinh'] }), cur);
    }
    if (isKorva()) {
      if (c && !c.ok) return '<label class="nv-l">Giọng</label><div class="nv-m">⚠ Chưa kết nối được KorvaTTS nên chưa có giọng nào để chọn. Danh sách 10 giọng sẽ hiện khi máy chủ giọng đang chạy trên máy tính' + (isPhone() ? '. <b>Điện thoại không dùng được cách này</b> — bấm “☁ Giọng trên Cloudflare”.' : '.') + '</div>';
      var real = c && c.list && c.list.length ? c.list : KORVA;
      return '<label class="nv-l">Giọng — bạn tự chọn nam / nữ</label>' + btns(real.map(function (k) { return [k[0], gIc(k[1]) + k[1].replace(/ · (nữ|nam)/, '')] }), cur);
    }
    if (oaiHost(S.srv.url)) return '<label class="nv-l">Giọng OpenAI</label>' + btns(OAI_VOICES.map(function (v) { return [v, v] }), cur);
    return '<label class="nv-l">Giọng</label><input class="nv-in" data-v="svoice" value="' + escA(S.srv.voice) + '" autocapitalize="off" placeholder="tên giọng của máy chủ">';
  }
  function voicePick() { return '<div id="nvVP">' + voiceInner() + '</div><div class="nv-m" id="nvVia">' + viaHtml() + '</div>' + (isCf() ? '<div class="nv-m" id="nvGnote"></div>' : '') }
  function refreshVP() { var e = $('#nvVP'); if (e) e.innerHTML = voiceInner(); var v = $('#nvVia'); if (v) v.innerHTML = viaHtml() }
  function render() {
    var web = S.eng !== 'srv', st = style();
    panel.querySelector('.nv-pn').innerHTML =
      '<div class="nv-h"><b>🎚 Giọng đọc lời dẫn</b><button class="nv-x" data-v="close" aria-label="Đóng">✕</button></div>' +
      '<div class="nv-seg"><button data-v="eng" data-e="web" class="' + (web ? 'on' : '') + '">📱 Giọng thiết bị</button><button data-v="eng" data-e="srv" class="' + (!web ? 'on' : '') + '">☁ Giọng AI</button></div>' +
      '<label class="nv-l">Phong cách đọc (theo lĩnh vực)</label><div class="nv-ch">' + STYLES.map(function (x) { return '<button data-v="style" data-s="' + x.id + '" class="' + (x.id === S.style ? 'on' : '') + '">' + x.ic + ' ' + x.nm + '</button>' }).join('') + '</div>' +
      (web ? '<label class="nv-l">Giọng (★ = tự nhiên hơn)</label><select class="nv-in" id="nvVoice" data-v="voice"></select>' +
        '<div class="nv-m" id="nvNoV" style="display:none">Máy chưa có giọng tiếng Việt. Edge (Windows/Mac) thường có sẵn HoaiMy, NamMinh (Natural). Android: cài “Google Text-to-speech” và tải dữ liệu tiếng Việt. iPhone: Cài đặt → Trợ năng → Nội dung đọc được → Giọng nói → Tiếng Việt. Hoặc dùng “Giọng AI”.</div>' :
        '<div class="nv-st" id="nvSt"></div><label class="nv-l">Chọn nhanh</label><div class="nv-ch">' + Object.keys(PRESETS).map(function (k) { return '<button data-v="preset" data-p="' + k + '" class="' + (PRESETS[k].url === S.srv.url && PRESETS[k].model === S.srv.model ? 'on' : '') + '">' + PRESETS[k].nm + '</button>' }).join('') + '</div>' +
        voicePick() +
        '<details><summary>⚙ Nâng cao (địa chỉ, key, model)</summary>' +
        '<label class="nv-l">Địa chỉ máy chủ (…/v1)</label><input class="nv-in" data-v="url" value="' + escA(S.srv.url) + '" placeholder="http://localhost:8298/v1" autocapitalize="off" autocomplete="off">' +
        '<label class="nv-l">API key (nếu có)</label><input class="nv-in" data-v="key" type="password" value="' + escA(S.srv.key) + '" autocomplete="off">' +
        '<label class="nv-l">Model</label><input class="nv-in" data-v="model" value="' + escA(S.srv.model) + '" autocapitalize="off">' +
        '<div class="nv-row"><button class="nv-bt" data-v="list">⟳ Tải danh sách giọng từ máy chủ</button></div><div class="nv-m" id="nvMsg"></div></details>') +
      '<label class="nv-l">Âm thanh</label>' +
      '<div class="nv-r"><span>Tốc độ</span><input type="range" min=".6" max="1.5" step=".05" value="' + S.rate + '" data-v="rate"><output id="o-rate">' + (+S.rate).toFixed(2) + '×</output></div>' +
      (web ? '<div class="nv-r"><span>Cao độ</span><input type="range" min=".7" max="1.3" step=".05" value="' + S.pitch + '" data-v="pitch"><output id="o-pitch">' + (+S.pitch).toFixed(2) + '</output></div>' : '') +
      '<div class="nv-r"><span>Âm lượng</span><input type="range" min=".2" max="1" step=".05" value="' + S.vol + '" data-v="vol"><output id="o-vol">' + Math.round(S.vol * 100) + '%</output></div>' +
      '<div class="nv-row"><button class="nv-bt p" data-v="test">▶ Nghe thử</button><button class="nv-bt" data-v="stop">■ Dừng</button></div>' +
      '<div class="nv-m">Phong cách chỉnh tốc độ, ngắt nghỉ và độ lên/xuống giọng theo nội dung câu (tăng · giảm · rủi ro · câu hỏi). Một số giọng của Chrome/Android bỏ qua “cao độ”.</div>' +
      '<details><summary>📘 Từ điển phát âm của bạn</summary><div class="nv-m">Mỗi dòng một mục, dạng <b>TỪ=cách đọc</b>. Ví dụ: <b>FPT=ép-pê-tê</b>. Phân biệt hoa/thường.</div><textarea class="nv-in" data-v="dict" placeholder="FPT=ép-pê-tê">' + escA(S.dict) + '</textarea></details>' +
      '<details><summary>🌐 Nguồn giọng nguồn mở (GitHub)</summary><div class="nv-m">Giọng AI cần một máy chủ có địa chỉ <b>/v1/audio/speech</b> (chuẩn OpenAI). Có thể tự chạy: <a href="https://github.com/dangvansam/viet-tts" target="_blank" rel="noopener">VietTTS</a> · <a href="https://github.com/pnnbao97/VieNeu-TTS" target="_blank" rel="noopener">VieNeu-TTS</a> (có chế độ “storytelling”) · <a href="https://github.com/rhasspy/piper" target="_blank" rel="noopener">Piper</a> (giọng vi_VN). Trang https chỉ gọi được http://localhost hoặc máy chủ https có bật CORS. API key lưu ngay trên thiết bị này.</div></details>';
    if (web) fillVoices(); else checkSrv();
  }
  var isPhone = function () { return /Android|iPhone|iPad|iPod|Mobile/i.test((root.navigator && navigator.userAgent) || '') };
  var chk = 0, HOWTO_CF = 'Chưa gọi được /proxy/tts. Hãy tải lại bản mới (file _worker.js) lên Cloudflare Pages rồi thử lại.', HOWTO = 'Chưa thấy máy chủ giọng. Cài một lần: <b>pip install korvatts</b>, rồi chạy: <b>python tools/nhip-tts-server.py</b> (xem HUONG-DAN-GIONG-AI.txt).';
  function checkSrv() {
    var el = $('#nvSt'); if (!el) return; var u = String(S.srv.url || '').replace(/\/+$/, ''), key = S.srv.url;
    if (!u) { el.innerHTML = 'Bấm <b>☁ Giọng trên Cloudflare</b> bên dưới — không cần cài gì.'; return }
    if (oaiHost(u)) { el.textContent = S.srv.key ? '🔑 Đã nhập key OpenAI.' : '🔑 Cần nhập API key OpenAI ở mục Nâng cao.'; return }
    el.textContent = '⏳ Đang kiểm tra máy chủ giọng…';
    var tk = ++chk; fetch(u.replace(/\/v1$/, '') + '/health').then(function (r) { if (!r.ok) throw 0; return r.json() }).then(function (j) {
      if (tk !== chk) return; CAP = { u: key, ok: true, azure: !!(j && j.azure), edge: !!(j && j.edge), err: (j && j.edgeError) || '' };
      if ($('#nvSt')) $('#nvSt').textContent = '✅ Máy chủ giọng đang chạy' + (isCf() ? (CAP.azure ? ' (Microsoft Azure HoaiMy/NamMinh)' : CAP.edge ? ' (Microsoft HoaiMy nữ / NamMinh nam — miễn phí)' : ' (chỉ còn giọng Google — 1 giọng nữ)') : '') + ' — bấm Nghe thử.';
      refreshVP();
    }).catch(function () {
      if (tk !== chk) return; CAP = { u: key, ok: false };
      if ($('#nvSt')) $('#nvSt').innerHTML = '❌ ' + (isCf() ? HOWTO_CF : HOWTO + (isPhone() ? '<br><b>📱 Điện thoại không chạy được cách này</b> — hãy bấm <b>☁ Giọng trên Cloudflare</b> bên dưới.' : ''));
      refreshVP();
    });
  }
  function setMsg(t) { var m = $('#nvMsg'); if (m) m.textContent = t }
  function loadList() {
    var u = String(S.srv.url || '').replace(/\/+$/, ''); if (!u) return setMsg('Hãy nhập địa chỉ máy chủ trước.');
    if (oaiHost(u)) { var dl = $('#nvVL'); if (dl) dl.innerHTML = OAI_VOICES.map(function (v) { return '<option value="' + v + '">' }).join(''); return setMsg('Giọng OpenAI: ' + OAI_VOICES.join(', ') + '.') }
    setMsg('Đang tải…'); var h = {}; if (S.srv.key) h.Authorization = 'Bearer ' + S.srv.key;
    fetch(u + '/voices', { headers: h }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json() }).then(function (j) {
      var a = Array.isArray(j) ? j : (j && (j.voices || j.data)) || j, names = [];
      if (Array.isArray(a)) a.forEach(function (x) { names.push(typeof x === 'string' ? x : x && (x.id || x.name || x.voice)) });
      else if (a && typeof a === 'object') names = Object.keys(a);
      names = names.filter(Boolean); var dl2 = $('#nvVL'); if (dl2) dl2.innerHTML = names.map(function (v) { return '<option value="' + escA(v) + '">' }).join('');
      setMsg(names.length ? 'Có ' + names.length + ' giọng — chạm ô “Giọng” để chọn.' : 'Máy chủ không trả danh sách giọng.');
    }).catch(function (e) { setMsg('Không tải được (' + e.message + '). Kiểm tra địa chỉ, CORS hoặc http/https.') });
  }
  function onClick(e) {
    var t = e.target.closest('[data-v]'); if (!t) { if (e.target.classList.contains('nv-bk')) closePanel(); return }
    var v = t.dataset.v;
    if (v === 'close') closePanel();
    else if (v === 'eng') { S.eng = t.dataset.e; save(); render() }
    else if (v === 'style') { S.style = t.dataset.s; save(); render() }
    else if (v === 'preset') { var p = PRESETS[t.dataset.p]; S.eng = 'srv'; S.srv.url = p.url; S.srv.model = p.model; S.srv.voice = p.voice; VIA = ''; save(); render() }
    else if (v === 'sv') { S.srv.voice = t.dataset.id; save(); render() }
    else if (v === 'list') loadList();
    else if (v === 'test') { stop(); previewing = true; var b = t; b.textContent = '… đang đọc'; play([SAMPLE], { done: function () { var x = $('[data-v=test]'); if (x) x.textContent = '▶ Nghe thử' }, fail: setMsg }) }
    else if (v === 'stop') { stop(); var x = $('[data-v=test]'); if (x) x.textContent = '▶ Nghe thử' }
  }
  function onInput(e) {
    var t = e.target, v = t.dataset && t.dataset.v; if (!v) return;
    if (v === 'voice') S.voice = t.value; else if (v === 'url') S.srv.url = t.value.trim(); else if (v === 'key') S.srv.key = t.value.trim();
    else if (v === 'model') S.srv.model = t.value.trim(); else if (v === 'svoice') S.srv.voice = t.value.trim(); else if (v === 'dict') S.dict = t.value;
    else if (v === 'rate' || v === 'pitch' || v === 'vol') { S[v] = +t.value; var o = $('#o-' + v); if (o) o.textContent = v === 'vol' ? Math.round(S.vol * 100) + '%' : (+t.value).toFixed(2) + (v === 'rate' ? '×' : '') }
    else return;
    save();
  }
  function openPanel(o) {
    if (panel) return; o = o || {}; o.onOpen && o.onOpen();
    if (!document.getElementById('nvCss')) { var st = document.createElement('style'); st.id = 'nvCss'; st.textContent = CSS; document.head.appendChild(st) }
    panel = document.createElement('div'); panel.className = 'nv-bk'; panel.innerHTML = '<div class="nv-pn" role="dialog" aria-label="Giọng đọc"></div>';
    panel.addEventListener('click', onClick); panel.addEventListener('input', onInput); panel.addEventListener('change', onInput);
    document.body.appendChild(panel); render();
  }
  function closePanel() { if (!panel) return; if (previewing) stop(); panel.remove(); panel = null }
  root.NHIPVoice = { STYLES: STYLES, play: play, stop: stop, openPanel: openPanel, closePanel: closePanel, state: function () { return JSON.parse(JSON.stringify(S)) }, normalize: normalize, splitChunks: splitChunks };
})(typeof window !== 'undefined' ? window : globalThis);
