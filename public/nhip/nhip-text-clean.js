/* NHỊP V3.02 — Làm sạch chữ tin tức (sửa ký tự lỗi/mã loằn ngoằn thành tiếng Việt) + nhận diện quảng cáo.
   Dùng chung bởi bảng đọc tin (nhip-news-reader.js) và app.js. Cùng logic với _worker.js. */
(function (W) {
  "use strict";
  if (W.NHIPClean) return;

/* ---- NHỊP V3.02: làm sạch chữ tiếng Việt + nhận diện quảng cáo (dùng chung Worker & trình duyệt) ---- */
const NC_ENT = (() => {
  const m = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", ldquo: "\u201C", rdquo: "\u201D", lsquo: "\u2018", rsquo: "\u2019", sbquo: "\u201A", bdquo: "\u201E", ndash: "\u2013", mdash: "\u2014", hellip: "\u2026", bull: "\u2022", trade: "\u2122", euro: "\u20AC", dagger: "\u2020", permil: "\u2030", lsaquo: "\u2039", rsaquo: "\u203A", larr: "\u2190", rarr: "\u2192", uarr: "\u2191", darr: "\u2193", harr: "\u2194", ensp: " ", emsp: " ", thinsp: " ", zwnj: "", zwj: "", Abreve: "\u0102", abreve: "\u0103", Dstrok: "\u0110", dstrok: "\u0111", Ohorn: "\u01A0", ohorn: "\u01A1", Uhorn: "\u01AF", uhorn: "\u01B0", OElig: "\u0152", oelig: "\u0153", Scaron: "\u0160", scaron: "\u0161", circ: "\u02C6", tilde: "\u02DC" };
  "nbsp iexcl cent pound curren yen brvbar sect uml copy ordf laquo not shy reg macr deg plusmn sup2 sup3 acute micro para middot cedil sup1 ordm raquo frac14 frac12 frac34 iquest Agrave Aacute Acirc Atilde Auml Aring AElig Ccedil Egrave Eacute Ecirc Euml Igrave Iacute Icirc Iuml ETH Ntilde Ograve Oacute Ocirc Otilde Ouml times Oslash Ugrave Uacute Ucirc Uuml Yacute THORN szlig agrave aacute acirc atilde auml aring aelig ccedil egrave eacute ecirc euml igrave iacute icirc iuml eth ntilde ograve oacute ocirc otilde ouml divide oslash ugrave uacute ucirc uuml yacute thorn yuml".split(" ").forEach((n, i) => { m[n] = String.fromCharCode(160 + i); });
  return m;
})();
function ncDecodeEnt(s) {
  s = String(s == null ? "" : s);
  for (let i = 0; i < 4 && s.indexOf("&") >= 0; i++) {
    const p = s;
    s = s.replace(/&(nbsp|amp|quot|lt|gt)(?![A-Za-z0-9;])/g, "&$1;")
      .replace(/&(?:#(\d{1,7})|#[xX]([0-9a-fA-F]{1,6})|([A-Za-z][A-Za-z0-9]{1,9}));/g, (m, d, h, n) => {
        if (d || h) { const c = d ? +d : parseInt(h, 16); if (!c || c > 0x10FFFF || (c >= 0xD800 && c <= 0xDFFF)) return ""; try { return String.fromCodePoint(c); } catch (e) { return ""; } }
        return Object.prototype.hasOwnProperty.call(NC_ENT, n) ? NC_ENT[n] : m;
      });
    if (s === p) break;
  }
  return s;
}
/* Chữ bị lỗi mã hóa kiểu "Ã¡", "áº¿", "Ä‘" (UTF-8 bị đọc nhầm thành Latin-1/Windows-1252) → trả về đúng tiếng Việt */
const NC_CP = { 0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A, 0x2039: 0x8B, 0x0152: 0x8C, 0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B, 0x0153: 0x9C, 0x017E: 0x9E, 0x0178: 0x9F };
const NC_C = "[\\u0080-\\u00BF\\u0152\\u0153\\u0160\\u0161\\u0178\\u017D\\u017E\\u0192\\u02C6\\u02DC\\u2013\\u2014\\u2018-\\u201E\\u2020-\\u2022\\u2026\\u2030\\u2039\\u203A\\u20AC\\u2122]";
const NC_MOJI = new RegExp("(?:[\\u00C2-\\u00DF]" + NC_C + "|[\\u00E0-\\u00EF]" + NC_C + "{2}|[\\u00F0-\\u00F4]" + NC_C + "{3})+", "g");
function ncRepair(s) {
  s = String(s == null ? "" : s); if (!s) return s;
  if (/\\u[0-9a-fA-F]{4}|\\\//.test(s)) s = s.replace(/\\u([0-9a-fA-F]{4})/g, (m, h) => String.fromCharCode(parseInt(h, 16))).replace(/\\\//g, "/").replace(/\\"/g, '"').replace(/\\[nrt]/g, " ");
  for (let k = 0; k < 2 && /[\u00C2-\u00F4]/.test(s); k++) {
    const p = s;
    s = s.replace(/\u00C3 /g, "\u00C3\u00A0").replace(NC_MOJI, run => {
      const b = [];
      for (const ch of run) { const c = ch.charCodeAt(0), v = c < 256 ? c : NC_CP[c]; if (v === undefined) return run; b.push(v); }
      try { return new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(b)); } catch (e) { return run; }
    });
    if (s === p) break;
  }
  return s;
}
/* Làm sạch hoàn toàn: giải mã ký tự HTML (cả loại bị mã hóa 2 lần), sửa lỗi mã hóa, bỏ thẻ/thuộc tính/chuỗi mã dài, ký tự ẩn */
function ncFix(s) {
  s = String(s == null ? "" : s); if (!s) return "";
  /* V3.06: địa chỉ http(s) là dữ liệu, không phải "chuỗi mã": cất đi trước, trả lại nguyên vẹn sau (trước đây slug dài ≥48 ký tự bị xóa → link hỏng, mở ra 404) */
  var ncU = []; s = s.replace(/https?:\/\/(?!news\.google\.com)[^\s<>"']+/gi, function (u) { ncU.push(u.replace(/&amp;/g, "&")); return " NCURL" + (ncU.length - 1) + "Z "; });
  s = s.replace(/(?:%[0-9A-Fa-f]{2}){3,}/g, r => { try { return decodeURIComponent(r); } catch (e) { return r; } });
  s = ncRepair(ncDecodeEnt(ncRepair(s)));
  s = s.replace(/<\/?[A-Za-z][^>]*>/g, " ")
    .replace(/\b(?:href|src|target|rel|class|style|id|data-[\w-]+)\s*=\s*(?:"[^"]*"|'[^']*'|\S+)/gi, " ")
    .replace(/https?:\/\/news\.google\.com\/\S*/gi, " ")
    .replace(/\b[A-Za-z0-9_-]{48,}\b/g, " ")
    .replace(/[\u200B-\u200D\u2060\uFEFF\u00AD\uFFFC\uFFFD\uE000-\uF8FF]/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u2028\u2029\u200E\u200F\u202A-\u202E]/g, " ")
    .replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, " ");
  try { s = s.normalize("NFC"); } catch (e) { }
  s = s.replace(/NCURL(\d+)Z/g, function (m, i) { return ncU[+i] || ""; });
  return s.replace(/\s+/g, " ").trim();
}
/* Đoạn "chữ" thực chất là mã (JS/CSS/JSON/chuỗi băm) */
function ncIsCode(t) {
  t = String(t || ""); const n = t.length; if (n < 12) return false;
  if (/(?:\bfunction\s*\(|\b(?:var|let|const)\s+[\w$]+\s*=|\bwindow\.|\bdocument\.|googletag|dataLayer|\.push\(|=>|<\/?script|@media|@font-face|\{\s*["']?[\w-]+["']?\s*:[^}]{0,80}[;,}]|\b(?:margin|padding|font-family|background|display)\s*:|__[A-Z_]{3,}__|\bnull\s*,\s*null\b)/.test(t)) return true;
  const sym = (t.match(/[{}\[\]<>=;$\\|^~`]/g) || []).length; if (sym >= 5 && sym / n > 0.04) return true;
  if (/\S{50,}/.test(t.replace(/https?:\/\/\S+/g, ""))) return true;
  const letters = (t.match(/\p{L}/gu) || []).length; if (n > 30 && letters / n < 0.5) return true;
  return false;
}
/* Quảng cáo dạng chữ */
const NC_AD_LABEL = /^\W*(?:quảng cáo|advertisement|advertorial|sponsored(?: content| by\b.*)?|nội dung (?:được )?tài trợ|tin tài trợ|bài (?:viết )?(?:pr|tài trợ|quảng cáo)|pr|ads?|tài trợ|được tài trợ|liên kết quảng cáo|adchoices|ad choices)\W*$/i;
const NC_AD_HEAD = /^\W*(?:quảng cáo|advertisement|advertorial|sponsored|nội dung (?:được )?tài trợ|được tài trợ|bài pr)\b/i;
const NC_AD_CTA = /(?:liên hệ (?:quảng cáo|đặt quảng cáo|hợp tác quảng cáo)|đặt (?:mua )?quảng cáo|hotline[^.]{0,20}\d{3,}|zalo[^.]{0,12}\d{6,}|(?:^|\s)(?:mua ngay|đặt hàng ngay|đặt mua ngay|đăng ký ngay|nhận ưu đãi ngay|xem ngay|tải ngay|click (?:vào|ngay)|nhấn (?:vào )?(?:đây|ngay)|bấm (?:vào )?(?:đây|ngay)|truy cập ngay|tham gia ngay|nhận tư vấn|tư vấn miễn phí|liên hệ ngay)(?:\s|[.!:]|$)|mã giảm giá|\bvoucher\b|flash sale|\bcasino\b|nhà cái|cá cược|slot game|kèo nhà cái)/i;
function ncIsAd(t) {
  t = String(t || "").trim(); if (!t) return false;
  if (NC_AD_LABEL.test(t)) return true;
  if (t.length <= 260 && (NC_AD_HEAD.test(t) || NC_AD_CTA.test(t))) return true;
  return false;
}
/* Quảng cáo dạng ảnh/liên kết */
const NC_AD_URL = /(?:doubleclick|googlesyndication|googleadservices|adservice|adsystem|adnxs|taboola|outbrain|criteo|admicro|adtima|eclick|adnetwork|\bads?[.\-_/]|[/.\-_]ads?[/.\-_?]|\/adv(?:ert\w*)?\/|banner|quangcao|quang-cao|sponsor|\/pr\/|pixel|tracking|beacon|spacer|1x1)/i;
function ncIsAdImg(u, alt, w, h) {
  if (!u || /^data:/i.test(u) || NC_AD_URL.test(u) || /\.(gif|svg)(\?|$)/i.test(u)) return true;
  if (/(quảng cáo|sponsored|advert|tài trợ)/i.test(alt || "")) return true;
  w = +w || 0; h = +h || 0; if ((w && w < 120) || (h && h < 80)) return true;
  if (w && h && (w / h > 5 || h / w > 5)) return true;
  return false;
}
/* Thuộc tính HTML của một khối quảng cáo (class, id, data-…, aria-label) */
const NC_AD_TOK = new Set(["ad", "ads", "adv", "advert", "adverts", "advertising", "advertisement", "adsbygoogle", "adslot", "adunit", "adbox", "adwrap", "adzone", "banner", "banners", "sponsor", "sponsors", "sponsored", "quangcao", "qc", "taboola", "outbrain", "dfp", "admicro", "adtima", "eclick", "advertorial", "promo", "promoted", "popup", "modal", "newsletter", "subscribe", "related", "recommend", "recommended", "readmore"]);
function ncAdAttrs(attrs) {
  attrs = String(attrs || ""); if (!attrs) return false;
  if (/\bdata-(?:ad|ads|adv|google|dfp|slot|ad-)[\w-]*\s*=/i.test(attrs) || /\b(?:aria-label|title|alt)\s*=\s*["'][^"']*(?:quảng cáo|advertisement|sponsored)/i.test(attrs)) return true;
  const m = attrs.match(/\b(?:class|id)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi); if (!m) return false;
  for (const a of m) { const v = a.replace(/^[^=]*=\s*["']?/, "").replace(/["']$/, "").toLowerCase(); for (const tk of v.split(/[^a-z0-9]+/)) if (tk && NC_AD_TOK.has(tk)) return true; }
  return false;
}
const NC_VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
/* Cắt bỏ cả khối HTML quảng cáo (và mọi thứ nằm trong khối đó) trước khi trích nội dung bài */
function ncStripAds(html) {
  const out = [], re = /<(\/?)([A-Za-z][A-Za-z0-9]*)\b([^>]*)>/g, stack = []; let pos = 0, skip = -1, n = 0, m;
  while ((m = re.exec(html))) {
    const text = html.slice(pos, m.index); pos = re.lastIndex; if (skip < 0) out.push(text);
    const close = m[1] === "/", name = m[2].toLowerCase(), attrs = m[3] || "", selfc = NC_VOID.has(name) || /\/\s*$/.test(attrs);
    if (close) {
      const k = stack.lastIndexOf(name); if (k >= 0) stack.length = k;
      if (skip >= 0) { if (stack.length <= skip) skip = -1; } else out.push(m[0]);
      continue;
    }
    if (skip >= 0) { if (!selfc) stack.push(name); continue; }
    if (name !== "html" && name !== "body" && name !== "head" && ncAdAttrs(attrs)) { n++; if (!selfc) { stack.push(name); skip = stack.length - 1; } continue; }
    out.push(m[0]); if (!selfc) stack.push(name);
  }
  if (skip < 0) out.push(html.slice(pos));
  return { html: out.join(""), n };
}


  /* Làm sạch bài trả về từ /proxy/article: sửa ký tự lỗi, bỏ đoạn là mã, ẩn quảng cáo (chữ + ảnh) */
  function ncArt(a) {
    if (!a || !a.ok || !a.blocks) return a;
    var hid = +a.ads || 0, seen = {}, bl = [];
    a.blocks.forEach(function (b) {
      var x = ncFix(b.x); if (!x) return;
      if (b.t === "p") { if (seen[x]) return; if (ncIsAd(x)) { hid++; return; } if (x.length < 30 || ncIsCode(x)) return; seen[x] = 1; }
      else if (ncIsAd(x) || ncIsCode(x)) return;
      bl.push({ t: b.t, x: x });
    });
    var im = (a.imgs || []).filter(function (g) { var bad = ncIsAdImg(g.u, g.c, 0, 0); if (bad) hid++; return !bad; }).map(function (g) { return { u: g.u, c: ncFix(g.c) }; });
    var hero = a.hero && !ncIsAdImg(a.hero, "", 0, 0) ? a.hero : "";
    var n = bl.filter(function (b) { return b.t === "p"; });
    return { ok: n.length >= 2 || (n.length === 1 && n[0].x.length >= 200), title: ncFix(a.title), desc: ncFix(a.desc), hero: hero, date: a.date, blocks: bl, imgs: im, ads: hid, error: a.error, code: a.code, alt: a.alt, altUrl: a.altUrl, origHost: a.origHost, host: a.host, via: a.via, resolved: a.resolved, trail: a.trail, url: a.url };
  }
  /* Làm sạch danh sách tin (title/summary/source) và bỏ tin là quảng cáo/mã */
  function ncItems(list) {
    if (!Array.isArray(list)) return list;
    return list.filter(function (t) {
      if (!t || typeof t !== "object") return true;
      ["title", "summary", "description", "source"].forEach(function (k) { if (typeof t[k] === "string") t[k] = ncFix(t[k]); });
      return !!t.title && !ncIsAd(t.title) && !ncIsCode(t.title);
    });
  }
  /* Mô tả chỉ lặp lại tiêu đề (+ tên báo) thì coi như không có */
  function ncDupDesc(desc, title) {
    var f = function (s) { return String(s || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim(); }, d = f(desc), k = f(title);
    return !d || (k && d.indexOf(k.slice(0, 40)) === 0 && d.length < k.length + 60);
  }
  W.NHIPClean = { fix: ncFix, repair: ncRepair, decode: ncDecodeEnt, isCode: ncIsCode, isAd: ncIsAd, isAdImg: ncIsAdImg, art: ncArt, items: ncItems, dupDesc: ncDupDesc };
})(typeof window !== "undefined" ? window : globalThis);

/* NHỊP V3.07 — NHIPLink: kiểm tra/sửa link tin, nhớ tin đã chết, ẩn tin chết khỏi danh sách, phát hiện Worker cũ.
   Dùng chung bởi nhip-runtime.js (lọc /api/news), bảng đọc tin (nhip-news-reader.js) và phòng Live (nhip-live-room.js). */
(function (W) {
  "use strict";
  if (W.NHIPLink) return;
  var KEY = "nhip-lc-v1", DEAD_MS = 21600000, SEL = ".nws,.nw-card,.tw-news,.nwp-row,.nd-box,.lv-news,.lv-nw,li";
  function load() { try { return JSON.parse(W.localStorage.getItem(KEY) || "{}") || {}; } catch (e) { return {}; } }
  function save(C) { try { W.localStorage.setItem(KEY, JSON.stringify(C)); } catch (e) { } }
  /* Link KHÔNG thể là một bài báo: có khoảng trắng, không phải http(s), chỉ là trang chủ (không tham số), hoặc đường dẫn bị phá thành "/ .html" ("/%20.html") */
  function bad(l) {
    l = String(l == null ? "" : l);
    if (!/^https?:\/\/[^\s]+$/i.test(l)) return true;
    var u; try { u = new URL(l); } catch (e) { return true; }
    var p = u.pathname || "/";
    if (p === "/" && !u.search) return true;
    var rest = p; try { rest = decodeURIComponent(p); } catch (e) { } rest = rest.replace(/\s+/g, "");
    if (/%20/i.test(p) && rest.replace(/[\/.]|html?$/gi, "").length < 3) return true;
    return false;
  }
  function isDead(l) { var c = load()[l]; return !!(c && c[0] === 0 && Date.now() - c[1] < DEAD_MS); }
  function esc(s) { return String(s).replace(/["\\]/g, "\\$&"); }
  /* Gỡ mọi thẻ tin trỏ tới link này khỏi màn hình (không cần tải lại) */
  function hide(l) {
    try {
      var D = W.document; if (!D) return 0;
      var nodes = D.querySelectorAll("[data-o],[data-sv],[data-link],a[href]"), n = 0;
      for (var i = 0; i < nodes.length; i++) {
        var e = nodes[i], v = e.getAttribute("data-o") || e.getAttribute("data-sv") || e.getAttribute("data-link") || e.getAttribute("href");
        if (v !== l) continue;
        if (e.closest && e.closest("#nrRd,#nrAi,.lv-rd,.lv-rdb")) continue;
        var c = e.closest ? e.closest(SEL) : null; if (c && c.parentNode) { c.parentNode.removeChild(c); n++; }
      }
      return n;
    } catch (e) { return 0; }
  }
  function markDead(l) {
    if (!l) return; var C = load(); C[l] = [0, Date.now()]; save(C);
    var n = hide(l);
    try { W.dispatchEvent(new CustomEvent("nhip:linkdead", { detail: { link: l, hidden: n } })); } catch (e) { }
    return n;
  }
  /* Dọn các link hỏng đã lưu từ bản cũ (bản ≤3.05 làm link thành "/ .html"): bỏ khỏi bộ nhớ kiểm link */
  function purge() { var C = load(), ch = false; for (var k in C) if (bad(k) && C[k][0] !== 0) { delete C[k]; ch = true; } if (ch) save(C); }
  /* Hỏi Worker đang chạy bản nào. Worker cũ (chưa có /proxy/version) hoặc chưa triển khai → old=true */
  var PING = null;
  function ping() {
    if (PING) return PING;
    PING = W.fetch("/proxy/version", { cache: "no-store" }).then(function (r) {
      if (!r.ok || /text\/html/.test(r.headers.get("content-type") || "")) return { old: true, v: "" };
      return r.json().then(function (j) { return { old: !(j && j.linkcheck), v: (j && j.v) || "" }; });
    }).catch(function () { return { old: true, v: "", net: true }; });
    return PING;
  }
  W.NHIPLink = { bad: bad, isDead: isDead, markDead: markDead, hide: hide, purge: purge, ping: ping, ver: "3.07" };
  try { purge(); } catch (e) { }
})(typeof window !== "undefined" ? window : globalThis);
