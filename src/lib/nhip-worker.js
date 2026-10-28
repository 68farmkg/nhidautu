// Cloudflare Pages "advanced mode": proxy nhỏ cho giá (VNDirect), tin RSS, tìm tin theo mã (Google News RSS) và danh sách mã niêm yết (VNDirect).
// Các nguồn này chặn gọi thẳng từ trình duyệt (CORS) nên cần đi qua đây. Chỉ cho phép đúng các địa chỉ trong danh sách; mọi đường dẫn khác trả về file tĩnh.
// Muốn thêm nguồn tin: thêm 1 dòng vào RSS ở đây VÀ 1 dòng vào FEEDS ở đầu nhip-runtime.js (cùng khóa "k").
const RSS = {
  "cafef-ck": "https://cafef.vn/thi-truong-chung-khoan.rss",
  "cafef-dn": "https://cafef.vn/doanh-nghiep.rss",
  "cafef-vm": "https://cafef.vn/vi-mo-dau-tu.rss",
  "vnexpress-kd": "https://vnexpress.net/rss/kinh-doanh.rss",
  "vietstock-ck": "https://vietstock.vn/144/chung-khoan.rss",
  "vietstock-cp": "https://vietstock.vn/830/chung-khoan/co-phieu.rss",
  "vietstock-dn": "https://vietstock.vn/733/doanh-nghiep.rss",
  "vietstock-np": "https://vietstock.vn/579/nhan-dinh-phan-tich.rss",
  "vietstock-vm": "https://vietstock.vn/761/kinh-te/vi-mo.rss",
  "vietstock-tg": "https://vietstock.vn/736/the-gioi.rss",
  "vneconomy-ck": "https://vneconomy.vn/chung-khoan.rss",
  "baodautu-ck": "https://baodautu.vn/tai-chinh-chung-khoan.rss",
  "tuoitre-kd": "https://tuoitre.vn/rss/kinh-doanh.rss",
  "thanhnien-kd": "https://thanhnien.vn/rss/kinh-te.rss",
  "dantri-kd": "https://dantri.com.vn/rss/kinh-doanh.rss",
  "vietnamnet-kd": "https://vietnamnet.vn/rss/kinh-doanh.rss",
  "vietstock-hdkd": "https://vietstock.vn/737/doanh-nghiep/hoat-dong-kinh-doanh.rss",
  "vietstock-tc": "https://vietstock.vn/734/tai-chinh.rss",
  "cafef-tc": "https://cafef.vn/tai-chinh-ngan-hang.rss",
  "cafef-bds": "https://cafef.vn/bat-dong-san.rss",
  "vneconomy-dn": "https://vneconomy.vn/doanh-nghiep.rss",
  "vneconomy-tc": "https://vneconomy.vn/tai-chinh.rss",
  "vietnambiz-ck": "https://vietnambiz.vn/chung-khoan.rss",
  "vietnambiz-dn": "https://vietnambiz.vn/doanh-nghiep.rss",
  "ndh-ck": "https://ndh.vn/chung-khoan.rss",
  "baodautu-dn": "https://baodautu.vn/thong-tin-doanh-nghiep.rss"
};
const STOCKS_Q = { q: "type:STOCK~status:LISTED", fields: "code,companyName,shortName,floor,industryName", sort: "code", size: "500" };
/* BẢN 20: finfo-api.* báo lỗi 1016/530 khi gọi từ Worker → dùng api-finfo.* (đã kiểm), phân trang 500 mã/trang có sort để không lặp/sót mã */
async function stocksAll(getPage) {
  const all = []; let total = 0;
  for (let p = 1; p <= 8; p++) {
    const r = await getPage("https://api-finfo.vndirect.com.vn/v4/stocks?" + new URLSearchParams({ ...STOCKS_Q, page: String(p) }));
    if (!r.ok) throw new Error("HTTP " + r.status);
    const j = await r.json(), rows = Array.isArray(j && j.data) ? j.data : [];
    all.push(...rows); total = Number(j && j.totalPages) || 1;
    if (!rows.length || p >= total) break;
  }
  if (!all.length) throw new Error("Danh sách rỗng");
  return JSON.stringify({ data: all, totalElements: all.length });
}
const bad = (m, s = 400) => new Response(JSON.stringify({ error: m }), { status: s, headers: { "Content-Type": "application/json" } });
const PATHS = ["/proxy/dchart", "/proxy/rss", "/proxy/gnews", "/proxy/bing", "/proxy/stocks", "/proxy/market", "/proxy/bctc", "/proxy/ai", "/proxy/finfo", "/proxy/article", "/proxy/linkcheck", "/proxy/version"];
// Máy chủ AI được phép chuyển tiếp (nhiều nhà cung cấp không bật CORS nên trình duyệt không gọi thẳng được, vd NVIDIA NIM).
const AI_HOSTS = new Set(["api.openai.com", "api.anthropic.com", "generativelanguage.googleapis.com", "api.deepseek.com", "api.groq.com", "api.mistral.ai", "api.x.ai", "openrouter.ai", "api.perplexity.ai", "api.together.xyz", "api.cerebras.ai", "api.sambanova.ai", "api.fireworks.ai", "api.cohere.ai", "integrate.api.nvidia.com", "api.moonshot.ai", "dashscope-intl.aliyuncs.com", "open.bigmodel.cn", "ollama.com"]);
const AI_HEADERS = ["authorization", "content-type", "x-api-key", "anthropic-version", "anthropic-dangerous-direct-browser-access", "x-goog-api-key", "accept"];
async function aiProxy(request, u) {
  // Chỉ nhận từ chính trang NHIP này (không làm "proxy mở" cho người ngoài). Khóa API của bạn đi qua Worker của bạn, không được lưu hay ghi log.
  const site = request.headers.get("Sec-Fetch-Site"), origin = request.headers.get("Origin");
  if (site ? site !== "same-origin" : origin !== u.origin) return bad("Chỉ nhận yêu cầu từ chính trang NHIP.", 403);
  let t; try { t = new URL(u.searchParams.get("u") || ""); } catch (e) { return bad("Địa chỉ không hợp lệ."); }
  if (t.protocol !== "https:" || t.username || t.password || t.port || !AI_HOSTS.has(t.hostname)) return bad("Máy chủ AI không nằm trong danh sách cho phép.", 403);
  const h = new Headers(); for (const k of AI_HEADERS) { const v = request.headers.get(k); if (v) h.set(k, v); }
  try {
    const r = await fetch(t.toString(), { method: request.method, headers: h, body: request.method === "GET" ? undefined : request.body, cf: { cacheTtl: 0 } });
    const o = new Headers({ "Content-Type": r.headers.get("content-type") || "application/json", "Cache-Control": "no-store" });
    const ra = r.headers.get("retry-after"); if (ra) o.set("Retry-After", ra);
    return new Response(r.body, { status: r.status, headers: o });
  } catch (e) { return bad("Không kết nối được nhà cung cấp AI.", 502); }
}

/* v2.98 — ĐỌC BÀI NGAY TRONG PHÒNG LIVE: lấy trang bài báo (https, tên miền công khai), rút phần thân bài (đoạn chữ + vài ảnh) rồi trả JSON.
   Không chuyển tiếp mã script, không làm "proxy mở": chỉ nhận từ chính trang NHIP, chặn IP/địa chỉ nội bộ, tối đa 4 lần chuyển hướng, 2,5 MB. */
/*NC-BEGIN*/
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
/*NC-END*/

const okHost = h => { h = String(h || "").toLowerCase(); return h.includes(".") && !/^[\d.]+$/.test(h) && !h.includes(":") && !h.startsWith("[") && !/(^|\.)(localhost|local|internal|lan|home|corp|intranet)$/.test(h); };
const decEnt = s => ncFix(s);
const txt = s => ncFix(String(s || "").replace(/<br\s*\/?>/gi, " "));
const metaOf = (h, n) => { const m = h.match(new RegExp("<meta[^>]+(?:property|name)=[\"']" + n + "[\"'][^>]*>", "i")); if (!m) return ""; const c = m[0].match(/content=["']([^"']*)["']/i); return c ? decEnt(c[1]).trim() : ""; };
const absUrl = (u, b) => { try { const x = new URL(String(u).trim().split(/\s+/)[0], b); return x.protocol === "https:" || x.protocol === "http:" ? x.toString() : ""; } catch (e) { return ""; } };
const STOP = /^(tin liên quan|bài liên quan|xem thêm|đọc thêm|có thể bạn quan tâm|tin cùng chuyên mục|tin mới|bình luận|đọc nhiều|bài viết khác|chủ đề|từ khóa|tags?\b|nguồn:|theo\s+\S+\s*$)/i;
const JUNK = /(đăng ký nhận|nhận tin|bản quyền|all rights reserved|©|theo dõi .{0,30}(trên|tại)|tải ứng dụng|bấm vào đây|click vào)/i;
/* Chỉ gỡ form/header/aside khi khối ít chữ (<3 thẻ p); trang ASP.NET bọc cả bài trong <form> thì giữ lại */
const dropSmall = (h, tag, max) => h.replace(new RegExp("<" + tag + "\\b[\\s\\S]*?<\\/" + tag + ">", "gi"), m => (m.match(/<p\b/gi) || []).length < 3 && m.length < max ? "" : m);
function ldBody(html) {
  const out = [];
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let j; try { j = JSON.parse(m[1].trim()); } catch (e) { continue; }
    const walk = (o, d) => { if (!o || d > 6) return; if (Array.isArray(o)) { o.forEach(x => walk(x, d + 1)); return; } if (typeof o !== "object") return; if (typeof o.articleBody === "string" && o.articleBody.length > 200) out.push(o.articleBody); for (const k in o) if (o[k] && typeof o[k] === "object") walk(o[k], d + 1); };
    walk(j, 0);
  }
  return out[0] || "";
}
function pushBlock(out, seen, tag, t, st) {
  if (!t) return;
  if (tag === "p") {
    if (seen.has(t)) return;
    if (ncIsAd(t)) { st.ads++; return; }
    if (t.length < 30) return;
    if (t.length <= 220 && JUNK.test(t)) { st.junk++; return; }
    if (ncIsCode(t)) { st.code++; return; }
    seen.add(t); out.push({ t: "p", x: t.slice(0, 1800) });
  } else if (t.length >= 6 && t.length <= 140 && !STOP.test(t) && !ncIsAd(t) && !ncIsCode(t)) out.push({ t: "h", x: t });
}
function extractArticle(html, base) {
  const ld = ldBody(html), st = { ads: 0, code: 0, junk: 0 };
  let h = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<(script|style|noscript|svg|iframe|template|button|select|nav|footer)\b[\s\S]*?<\/\1>/gi, "");
  h = dropSmall(dropSmall(dropSmall(h, "form", 5000), "header", 6000), "aside", 8000);
  const sa = ncStripAds(h); h = sa.html; st.ads += sa.n;
  const title = txt(metaOf(h, "og:title") || (h.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || (h.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]);
  const desc = txt(metaOf(h, "og:description") || metaOf(h, "description"));
  const hero0 = absUrl(metaOf(h, "og:image"), base), hero = hero0 && !ncIsAdImg(hero0, "", 0, 0) ? hero0 : "";
  const date = metaOf(h, "article:published_time") || metaOf(h, "pubdate") || ((h.match(/<time[^>]+datetime=["']([^"']+)["']/i) || [])[1] || "");
  let body = h, m;
  if ((m = h.match(/<article\b[\s\S]*?<\/article>/i)) && m[0].length > 1200) body = m[0];
  else if ((m = h.match(/<(?:div|section)[^>]+(?:itemprop=["']articleBody["']|class=["'][^"']*(?:detail-content|detail__content|content-detail|article-body|article__body|fck_detail|post-content|entry-content|singular-content|cms-body|news-content|detail-main|maincontent|main-content|article-content|content-news|cate-24h|content__body)[^"']*["'])[^>]*>[\s\S]*/i))) body = m[0];
  const out = [], seen = new Set(); let n = 0;
  for (const mm of body.matchAll(/<(p|h2|h3|blockquote)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const t = txt(mm[2]), k = mm[1].toLowerCase();
    if (!t) continue;
    if (STOP.test(t) && out.length >= 2) break;
    pushBlock(out, seen, k === "h2" || k === "h3" ? "h" : "p", t, st);
    if (++n > 220 || out.length >= 60) break;
  }
  /* Dự phòng 1: JSON-LD articleBody — nhiều báo cho sẵn toàn văn ở đây */
  if (out.filter(b => b.t === "p").length < 2 && ld) {
    const parts = ncFix(ld.replace(/\r?\n+|<br\s*\/?>|<\/p>/gi, "\n")).length ? ld.split(/\r?\n+|<br\s*\/?>|<\/p>/i) : [];
    const o2 = []; parts.forEach(p => pushBlock(o2, new Set(), "p", txt(p), st));
    if (o2.length >= 2) { out.length = 0; o2.slice(0, 60).forEach(b => out.push(b)); }
  }
  /* Dự phòng 2: bài không dùng thẻ <p> mà ngắt dòng bằng <br>/<div> */
  if (out.filter(b => b.t === "p").length < 2) {
    const o3 = [], seen3 = new Set();
    body.replace(/<br\s*\/?>|<\/div>|<\/li>/gi, "\n").split(/\n+/).forEach(line => { if (line.length < 8000) pushBlock(o3, seen3, "p", txt(line), st); });
    if (o3.length >= 2) { out.length = 0; o3.slice(0, 60).forEach(b => out.push(b)); }
  }
  const imgs = [], si = new Set(hero ? [hero] : []);
  for (const mm of body.matchAll(/<img\b[^>]*>/gi)) {
    const tag = mm[0], src = absUrl((tag.match(/(?:data-original|data-src|data-lazy-src|src)=["']([^"']+)["']/i) || [])[1] || "", base), alt = txt((tag.match(/alt=["']([^"']*)["']/i) || [])[1] || "");
    const w = (tag.match(/\bwidth=["']?(\d+)/i) || [])[1], hh = (tag.match(/\bheight=["']?(\d+)/i) || [])[1];
    if (!src || si.has(src) || /(logo|icon|avatar|sprite|blank|loading)/i.test(src) || ncIsAdImg(src, alt, w, hh)) { if (src && ncIsAdImg(src, alt, w, hh)) st.ads++; continue; }
    si.add(src); imgs.push({ u: src, c: alt.slice(0, 160) });
    if (imgs.length >= 4) break;
  }
  const np = out.filter(b => b.t === "p"), chars = np.reduce((s, b) => s + b.x.length, 0);
  return { title: title.slice(0, 300), desc: desc.slice(0, 600), hero, date, blocks: out, imgs, ads: st.ads, ok: np.length >= 2 || (np.length === 1 && chars >= 200) };
}
/* ===== V3.04 — LẤY TOÀN VĂN BÀI TỪ LIÊN KẾT GOOGLE NEWS (nhiều đường dự phòng) =====
   1) Giải link trung gian Google News → địa chỉ báo gốc: (a) giải mã trực tiếp từ mã bài, (b) hỏi batchexecute bằng nhiều dạng URL/ngôn ngữ, (c) theo chuyển hướng 302.
   2) Lấy trang báo gốc (máy tính → điện thoại → bộ đọc dự phòng r.jina.ai nếu trang chặn/đòi script).
   3) Vẫn không được: tìm CÙNG SỰ KIỆN ở báo khác (Bing News + RSS các báo) theo tiêu đề và trả bài đó, đánh dấu alt:true để giao diện ghi rõ.
   Lỗi 5xx/403/429 không còn bị cache 10 phút (trước đây bấm "Thử lại" vẫn trúng lỗi cũ). */
const GN_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const GN_CK = "CONSENT=YES+cb; SOCS=CAESHAgBEhJnd3NfMjAyMzA4MTAtMF9SQzIaAmRlIAEaBgiAo_CmBg";
const isGoogleHost = h => /(^|\.)(google\.[a-z.]+|gstatic\.com|googleusercontent\.com|googleapis\.com)$/i.test(String(h || ""));
const realUrl = s => { try { s = String(s || "").trim().replace(/^http:/i, "https:"); const u = new URL(s); return u.protocol === "https:" && !isGoogleHost(u.hostname) && okHost(u.hostname) ? u.toString() : null; } catch (e) { return null; } };
const gnTimeout = ms => (typeof AbortSignal !== "undefined" && AbortSignal.timeout ? AbortSignal.timeout(ms) : undefined);
/* (a) mã bài dạng cũ chứa sẵn địa chỉ (protobuf: ... 0x22 <độ dài> <url> ...) */
function gnDecodeId(id) {
  try {
    const b64 = id.replace(/-/g, "+").replace(/_/g, "/"), bin = atob(b64 + "=".repeat((4 - b64.length % 4) % 4));
    const i = bin.search(/https?:\/\//); if (i < 0) return null;
    let len = 0;
    if (i >= 1 && bin.charCodeAt(i - 1) < 128) len = bin.charCodeAt(i - 1);
    else if (i >= 2) len = (bin.charCodeAt(i - 2) & 127) | (bin.charCodeAt(i - 1) << 7);
    let url = len > 8 && i + len <= bin.length ? bin.substr(i, len) : "";
    if (!/^https?:\/\/[\x21-\x7e]+$/.test(url)) url = (bin.slice(i).match(/^https?:\/\/[\x21-\x7e]+/) || [""])[0];
    return realUrl(url);
  } catch (e) { return null; }
}
/* (b) hỏi máy chủ Google: lấy chữ ký + dấu thời gian trong trang trung gian rồi gọi batchexecute */
async function gnBatch(id) {
  const heads = { Cookie: GN_CK, "User-Agent": GN_UA, "Accept-Language": "en-US,en;q=0.9" };
  const pages = ["https://news.google.com/articles/" + id + "?hl=en-US&gl=US&ceid=US:en", "https://news.google.com/rss/articles/" + id + "?hl=en-US&gl=US&ceid=US:en", "https://news.google.com/rss/articles/" + id + "?hl=vi&gl=VN&ceid=VN:vi"];
  for (const pu of pages) {
    try {
      const pg = await fetch(pu, { headers: heads, signal: gnTimeout(6000), cf: { cacheTtl: 0 } }); if (!pg.ok) continue;
      const html = await pg.text();
      const au = (html.match(/data-n-au=["']([^"']+)["']/) || [])[1]; if (au) { const r0 = realUrl(au.replace(/&amp;/g, "&")); if (r0) return r0; }
      const sg = (html.match(/data-n-a-sg=["']([^"']+)["']/) || [])[1], ts = (html.match(/data-n-a-ts=["']([^"']+)["']/) || [])[1]; if (!sg || !ts) continue;
      for (const loc of ["US:en", "VN:vi"]) {
        try {
          const inner = JSON.stringify(["garturlreq", [["X", "X", ["X", "X"], null, null, 1, 1, loc, null, 1, null, null, null, null, null, 0, 1], "X", "X", 1, [1, 1, 1], 1, 1, null, 0, 0, null, 0], id, +ts, sg]);
          const res = await fetch("https://news.google.com/_/DotsSplashUi/data/batchexecute", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8", "User-Agent": GN_UA, Cookie: GN_CK }, body: "f.req=" + encodeURIComponent(JSON.stringify([[["Fbv4je", inner, null, "generic"]]])), signal: gnTimeout(6000), cf: { cacheTtl: 0 } });
          if (!res.ok) continue;
          const txt0 = await res.text(); let url = null;
          try { const arr = JSON.parse(txt0.split("\n\n")[1]); url = JSON.parse(arr[0][2])[1]; } catch (e) {
            const m = txt0.match(/garturlres\\*",\\*"(https?:[^"\\]+)/); if (m) { try { url = JSON.parse('"' + m[1] + '"'); } catch (e2) { url = m[1]; } }
          }
          const ru = realUrl(url); if (ru) return ru;
        } catch (e) { }
      }
    } catch (e) { }
  }
  return null;
}
/* (c) một số liên kết tự chuyển hướng 302 sang báo gốc khi mở bằng trình duyệt điện thoại */
async function gnRedirect(id) {
  try {
    const r = await fetch("https://news.google.com/rss/articles/" + id + "?oc=5", { redirect: "manual", headers: { "User-Agent": "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36", Cookie: GN_CK }, signal: gnTimeout(6000), cf: { cacheTtl: 0 } });
    const lo = r.headers.get("location"); if (lo) return realUrl(new URL(lo, "https://news.google.com").toString());
  } catch (e) { }
  return null;
}
async function gnResolve(u) {
  const m = u.pathname.match(/\/(?:rss\/)?(?:articles|read)\/([A-Za-z0-9_-]+)/); if (!m) return null;
  const id = m[1];
  return gnDecodeId(id) || await gnBatch(id) || await gnRedirect(id) || null;
}
/* ---- tìm bài CÙNG SỰ KIỆN ở báo khác (khi bài gốc không giải/không đọc được) ---- */
const wordSet = s => new Set(String(s || "").normalize("NFC").toLowerCase().replace(/\s+[-–—|]\s+[^-–—|]{2,50}$/, "").split(/[^\p{L}\p{N}]+/u).filter(w => w.length > 1));
function titleSim(a, b) { const A = wordSet(a), B = wordSet(b); if (A.size < 4 || B.size < 4) return 0; let n = 0; for (const w of A) if (B.has(w)) n++; return n / (A.size + B.size - n); }
function parseFeed(xml) {
  const out = [];
  for (const mm of String(xml || "").matchAll(/<item\b[\s\S]*?<\/item>/gi)) {
    const it = mm[0], t = txt((it.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || ""), l0 = ((it.match(/<link[^>]*>([\s\S]*?)<\/link>/i) || [])[1] || "").replace(/<!\[CDATA\[|\]\]>/g, "").replace(/&amp;/g, "&").trim();
    let l = l0; try { const lu = new URL(l0); if (/(^|\.)bing\.com$/i.test(lu.hostname)) l = lu.searchParams.get("url") || ""; } catch (e) { l = ""; }
    if (t && l) out.push({ t, l });
  }
  return out;
}
async function feedGet(url) {
  try { const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; NHIP/3.04)", Accept: "*/*" }, signal: gnTimeout(5000), cf: { cacheTtl: 300, cacheEverything: true, cacheTtlByStatus: { "200-299": 300, "300-599": 0 } } }); return r.ok ? parseFeed(await r.text()) : []; } catch (e) { return []; }
}
async function altFind(title, skipHost) {
  const q = String(title || "").replace(/\s+[-–—|]\s+[^-–—|]{2,50}$/, "").trim().slice(0, 200); if (wordSet(q).size < 4) return null;
  const jobs = [feedGet("https://www.bing.com/news/search?" + new URLSearchParams({ q, format: "rss", setlang: "vi", cc: "VN" }))];
  for (const k of ["cafef-ck", "cafef-dn", "vietstock-ck", "vietstock-cp", "vietstock-dn", "vneconomy-ck", "baodautu-ck", "vietnambiz-ck", "ndh-ck", "vneconomy-dn"]) jobs.push(feedGet(RSS[k]));
  const all = (await Promise.all(jobs)).flat(); let best = null, bs = 0;
  for (const c of all) {
    const ru = realUrl(c.l); if (!ru) continue; let h = ""; try { h = new URL(ru).hostname; } catch (e) { continue; }
    if (skipHost && h === skipHost) continue;
    const s = titleSim(q, c.t); if (s > bs) { bs = s; best = ru; }
  }
  return bs >= 0.6 ? best : null;
}
/* ---- bộ đọc dự phòng cho trang chặn robot / dựng bằng script (r.jina.ai trả bản chữ của trang) ---- */
async function readerFallback(t) {
  const r = await fetch("https://r.jina.ai/" + t.toString(), { headers: { Accept: "text/plain", "User-Agent": GN_UA }, signal: gnTimeout(14000) });
  if (!r.ok) return null;
  const raw = await r.text(), ti = txt((raw.match(/^Title:\s*(.+)$/m) || [])[1] || ""), body = (raw.split(/Markdown Content:\s*/)[1] || raw).replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
  const out = [], seen = new Set(), st = { ads: 0, code: 0, junk: 0 };
  for (const par of body.split(/\n{2,}/)) {
    const line = par.replace(/\s+/g, " ").trim(); if (!line) continue;
    const hm = line.match(/^#{1,4}\s+(.+)$/), x = ncFix((hm ? hm[1] : line).replace(/[*_`>]/g, "").trim());
    if (x) pushBlock(out, seen, hm ? "h" : "p", x, st);
    if (out.length >= 60) break;
  }
  const np = out.filter(b => b.t === "p"), chars = np.reduce((s, b) => s + b.x.length, 0);
  return { title: ti.slice(0, 300), desc: "", hero: "", date: "", blocks: out, imgs: [], ads: st.ads, ok: np.length >= 2 && chars >= 300, via: "reader" };
}
const UA_D = GN_UA;
const UA_M = "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36";
async function fetchHop(t0, ua, ref) {
  let t = t0, r;
  for (let hop = 0; hop < 5; hop++) {
    if (t.protocol !== "https:" || t.username || t.password || (t.port && t.port !== "443") || !okHost(t.hostname)) return { deny: true };
    const hd = { "User-Agent": ua, "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.5", "Upgrade-Insecure-Requests": "1", "Sec-Fetch-Dest": "document", "Sec-Fetch-Mode": "navigate", "Sec-Fetch-Site": ref ? "cross-site" : "none", "Sec-Fetch-User": "?1", "Cache-Control": "max-age=0" }; if (ref) hd.Referer = ref;
    r = await fetch(t.toString(), { redirect: "manual", signal: gnTimeout(9000), headers: hd, cf: { cacheTtl: 600, cacheEverything: true, cacheTtlByStatus: { "200-299": 600, "300-599": 0 } } });
    if (r.status >= 300 && r.status < 400 && r.headers.get("location")) { t = new URL(r.headers.get("location"), t); continue; }
    break;
  }
  return { r, t };
}
/* Giải mã trang: ưu tiên charset khai báo; nếu còn nhiều ký tự hỏng thì thử windows-1258 (mã tiếng Việt cũ) */
function decodePage(buf, cs) {
  const dec = c => { try { return new TextDecoder(c, { fatal: false }).decode(buf); } catch (e) { return null; } };
  let html = dec(cs || "utf-8") || dec("utf-8");
  if (!cs) { const m = html.slice(0, 4000).match(/<meta[^>]+charset=["']?([\w-]+)/i); if (m && !/utf-?8/i.test(m[1])) { const h2 = dec(m[1]); if (h2) html = h2; } }
  const bad = (html.match(/\uFFFD/g) || []).length;
  if (bad > 5) { const h3 = dec("windows-1258"); if (h3 && (h3.match(/\uFFFD/g) || []).length < bad) html = h3; }
  return html;
}
/* Biến thể địa chỉ: một số báo trả 404 cho dạng có tham số theo dõi, thiếu/thừa "www" hoặc dấu "/" cuối */
function urlVariants(t) {
  const out = [], seen = new Set(), add = u => { const k = u.toString(); if (!seen.has(k)) { seen.add(k); out.push(u); } };
  add(t);
  try {
    const a = new URL(t.toString()); a.search = ""; a.hash = ""; add(a);
    const h = a.hostname, b = new URL(a.toString()); b.hostname = /^www\./i.test(h) ? h.replace(/^www\./i, "") : "www." + h; add(b);
    const c = new URL(a.toString()); c.pathname = /\/$/.test(c.pathname) ? c.pathname.replace(/\/+$/, "") : c.pathname + "/"; if (c.pathname) add(c);
  } catch (e) { }
  return out.slice(0, 4);
}
/* Toàn văn nằm ngay trong RSS của chính báo đó (content:encoded / description dài) — không phải gọi trang bài */
const normLink = l => { try { const u = new URL(String(l).trim()); return u.hostname.replace(/^www\./, "") + u.pathname.replace(/\/+$/, ""); } catch (e) { return ""; } };
async function rssContent(t, hint) {
  const hs = new Set([t.hostname, t.hostname.replace(/^www\./, ""), "www." + t.hostname.replace(/^www\./, "")]);
  const feeds = Object.values(RSS).filter(u => { try { return hs.has(new URL(u).hostname); } catch (e) { return false; } }).slice(0, 6), want = normLink(t.toString());
  const raws = await Promise.all(feeds.map(async fu => { try { const r = await fetch(fu, { headers: { "User-Agent": "Mozilla/5.0 (compatible; NHIP/3.05)", Accept: "*/*" }, signal: gnTimeout(5000), cf: { cacheTtl: 120, cacheEverything: true, cacheTtlByStatus: { "200-299": 120, "300-599": 0 } } }); return r.ok ? await r.text() : ""; } catch (e) { return ""; } }));
  for (const xml of raws) for (const mm of String(xml).matchAll(/<item\b[\s\S]*?<\/item>/gi)) {
    const it = mm[0], g = n => ((it.match(new RegExp("<" + n + "[^>]*>([\\s\\S]*?)</" + n + ">", "i")) || [])[1] || "").replace(/^\s*<!\[CDATA\[|\]\]>\s*$/g, ""), title = txt(g("title")), link = g("link").trim();
    if (!(normLink(link) === want || (hint && titleSim(hint, title) >= 0.8))) continue;
    const html = g("content:encoded") || g("description"), out = [], seen = new Set(), st = { ads: 0, code: 0, junk: 0 };
    for (const par of html.replace(/<\/p>|<br\s*\/?>|<\/div>|<\/li>/gi, "\n").split(/\n+/)) pushBlock(out, seen, "p", txt(par), st);
    const np = out.filter(b => b.t === "p"), chars = np.reduce((n, b) => n + b.x.length, 0);
    if (np.length >= 2 && chars >= 400) { const img = (html.match(/<img[^>]+src=["']([^"']+)["']/i) || [])[1] || ""; return { title, desc: "", hero: absUrl(img, t.toString()) || "", date: "", blocks: out, imgs: [], ads: st.ads, ok: true, via: "rss" }; }
  }
  return null;
}
/* Lấy + rút nội dung một địa chỉ báo (đã là địa chỉ thật): máy tính → điện thoại → biến thể địa chỉ → RSS của báo → bộ đọc r.jina.ai */
async function fetchArticle(t0, env, trail, hint) {
  trail = trail || []; let code = 0, keep = null;
  const attempt = async (tt, ua, ref, tag) => {
    try {
      const x = await fetchHop(tt, ua, ref); if (x.deny) { trail.push(tag + ":deny"); return { deny: true }; }
      const r = x.r; if (!r) { trail.push(tag + ":none"); return { code: 0 }; }
      if (!r.ok) { trail.push(tag + ":" + r.status); return { code: r.status }; }
      if (!/html|xml/i.test(r.headers.get("content-type") || "")) { trail.push(tag + ":type"); return { code: 415 }; }
      const buf = await r.arrayBuffer(); if (buf.byteLength > 2.5e6) { trail.push(tag + ":big"); return { code: 413 }; }
      const cs = ((r.headers.get("content-type") || "").match(/charset=([\w-]+)/i) || [])[1] || "";
      const a = extractArticle(decodePage(buf, cs), x.t.toString()); a.host = x.t.hostname; trail.push(tag + (a.ok ? ":ok" : ":thin")); return { a };
    } catch (e) { trail.push(tag + ":err"); return { code: 0 }; }
  };
  const vs = urlVariants(t0);
  for (let i = 0; i < vs.length; i++) {
    const nm = i ? "v" + i : "web";
    const x1 = await attempt(vs[i], UA_D, "", nm + "-pc"); if (x1.deny) return { ok: false, code: "deny", error: "Địa chỉ bài báo không được phép.", trail };
    if (x1.a) { if (x1.a.ok) { x1.a.trail = trail; return x1.a; } if (!keep) keep = x1.a; } else if (!code) code = x1.code;
    if (i === 0) {
      const x2 = await attempt(vs[i], UA_M, "https://www.google.com/", nm + "-mob");
      if (x2.a) { if (x2.a.ok) { x2.a.trail = trail; return x2.a; } if (!keep) keep = x2.a; } else if (!code) code = x2.code;
    }
    if (i === 0 && !(x1.code === 404 || x1.code === 410)) break; /* chỉ thử biến thể địa chỉ khi trang báo "không tìm thấy" */
  }
  try { const rc = await rssContent(vs[0], hint); trail.push("rss:" + (rc ? "ok" : "none")); if (rc) { rc.host = vs[0].hostname; rc.trail = trail; return rc; } } catch (e) { trail.push("rss:err"); }
  if (!(env && env.NO_READER)) {
    for (const rv of vs.slice(0, 2)) {
      try { const j = await readerFallback(rv); trail.push("reader:" + (j ? (j.ok ? "ok" : "thin") : "fail")); if (j && j.ok) { j.host = rv.hostname; j.trail = trail; return j; } } catch (e) { trail.push("reader:err"); }
    }
  }
  return keep ? Object.assign(keep, { code: code || 0, trail }) : { ok: false, code, error: "Trang nguồn trả mã " + (code || "lỗi"), trail };
}
async function articleProxy(request, u, env) {
  const site = request.headers.get("Sec-Fetch-Site"), origin = request.headers.get("Origin");
  if (site ? site !== "same-origin" : (origin && origin !== u.origin)) return bad("Chỉ nhận yêu cầu từ chính trang NHIP.", 403);
  let t; try { t = new URL(u.searchParams.get("u") || ""); } catch (e) { return bad("Địa chỉ không hợp lệ."); }
  const hint = (u.searchParams.get("t") || "").slice(0, 300), trail = [];
  const J = (o, cc) => new Response(JSON.stringify(o), { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": cc || "no-store" } });
  try {
    let real = t, gn = false;
    if (isGoogleHost(t.hostname)) { gn = true; const r = await gnResolve(t); trail.push("gnews:" + (r ? "ok" : "fail")); real = null; if (r) { try { real = new URL(r); } catch (e) { } } }
    let a = null;
    if (real) { a = await fetchArticle(real, env, trail, hint); if (a.ok) { if (gn) a.resolved = real.toString(); return J(a, "public, max-age=600"); } if (a.code === "deny") return J(a); }
    const alt = await altFind(hint, real ? real.hostname : ""); trail.push("alt:" + (alt ? "found" : "none"));
    if (alt) {
      let at; try { at = new URL(alt); } catch (e) { at = null; }
      const b = at ? await fetchArticle(at, env, trail, hint) : null;
      if (b && b.ok) { b.alt = true; b.altUrl = at.toString(); b.origHost = real ? real.hostname : (gn ? "news.google.com" : t.hostname); return J(b, "public, max-age=600"); }
    }
    if (a) { a.trail = trail; a.url = real ? real.toString() : ""; if ((a.code === 404 || a.code === 410) && !a.blocks) { a.code = "gone"; a.error = "Bài gốc đã bị gỡ hoặc không còn tồn tại."; } return J(a); }
    return J({ ok: false, code: "gnews", error: "Không giải được liên kết trung gian của Google News.", trail });
  } catch (e) { return bad("Không mở được trang bài báo.", 502); }
}

/* ===== V3.06 — /proxy/linkcheck: kiểm tra link bài báo còn sống không (để ẩn tin đã bị gỡ) =====
   POST {urls:[…≤12]} → {results:[{u, s}]} với s=1 còn sống · s=0 chết chắc chắn (404/410, trang "đã bị gỡ/không tồn tại", chuyển về trang chủ, link hỏng) · s=2 chưa rõ (chặn robot/quá tải/hết giờ → app GIỮ tin).
   Link Google News được giải ra báo gốc trước khi kiểm. Kết quả cache chung trên Cloudflare (sống 30 phút, chết 6 giờ). */
const LC_SOFT404_T = /(^|[^\p{L}\p{N}])404([^\p{L}\p{N}]|$)|không tìm thấy|khong tim thay|not found|đã bị gỡ|không tồn tại|không khả dụng/iu;
const LC_SOFT404_B = /nội dung này đã bị gỡ hoặc không tồn tại|không tìm thấy đường dẫn này|bài viết (này )?(đã bị gỡ|không tồn tại)|trang (bạn|ban) (đang )?tìm (kiếm )?không tồn tại/i;
async function lcCacheGet(key) { try { if (typeof caches === "undefined" || !caches.default) return null; const r = await caches.default.match(new Request("https://nhip-linkcheck.invalid/" + encodeURIComponent(key))); return r ? (await r.json()).s : null; } catch (e) { return null; } }
async function lcCachePut(key, s) { try { if (typeof caches === "undefined" || !caches.default || s === 2) return; await caches.default.put(new Request("https://nhip-linkcheck.invalid/" + encodeURIComponent(key)), new Response(JSON.stringify({ s }), { headers: { "Cache-Control": "public, max-age=" + (s === 1 ? 1800 : 21600) } })); } catch (e) { } }
async function lcHead(r, cap) { /* đọc tối đa ~cap byte đầu trang rồi hủy (đủ để thấy <title> và nội dung báo lỗi) */
  try { const rd = r.body.getReader(), parts = []; let n = 0; while (n < cap) { const x = await rd.read(); if (x.done) break; parts.push(x.value); n += x.value.length; } try { rd.cancel(); } catch (e) { } const all = new Uint8Array(n); let o = 0; for (const p of parts) { all.set(p, o); o += p.length; } return new TextDecoder("utf-8", { fatal: false }).decode(all); } catch (e) { return ""; }
}
async function lcOne(raw, bud) {
  raw = String(raw || "").slice(0, 600);
  if (!/^https?:\/\/[^\s]+$/i.test(raw)) return { u: raw, s: 0 }; /* link hỏng (có khoảng trắng/không phải địa chỉ) */
  let t; try { t = new URL(raw); } catch (e) { return { u: raw, s: 0 }; }
  if (t.protocol === "http:") t.protocol = "https:";
  const hit = await lcCacheGet(raw); if (hit === 0 || hit === 1) return { u: raw, s: hit };
  let real = t;
  if (isGoogleHost(t.hostname)) {
    if (bud.n < 6) return { u: raw, s: 2 }; bud.n -= 4;
    const rr = await gnResolve(t); if (!rr) return { u: raw, s: 2 };
    try { real = new URL(rr); } catch (e) { return { u: raw, s: 2 }; }
  }
  if (bud.n < 2) return { u: raw, s: 2 }; bud.n -= 2;
  let s = 2, st = 0, ff = "";
  try {
    const x = await fetchHop(real, UA_M, "https://www.google.com/");
    if (x.deny || !x.r) s = 2;
    else {
      let r = x.r, fin = x.t; st = r.status; ff = fin.pathname;
      if (r.status === 404 || r.status === 410) {
        /* V3.07: một số báo trả 404 giả cho trình duyệt điện thoại/máy chủ → thử lại bằng trình duyệt máy tính, không Referer; chỉ khi cả hai đều 404/410 mới coi là chết */
        let y = null; try { y = await fetchHop(real, UA_D, ""); } catch (e) { }
        if (y && y.r && y.r.status !== 404 && y.r.status !== 410) { r = y.r; fin = y.t; st = r.status; ff = fin.pathname; }
      }
      if (r.status === 404 || r.status === 410) s = 0;
      else if (r.ok) {
        const homeJump = (real.pathname.length > 8 && (fin.pathname === "/" || fin.pathname === "")) || (/(^|\/)(404|error|errors|not-?found|loi|page-?not-?found)(\/|\.|-|$)/i.test(fin.pathname) && !/(^|\/)(404|error|errors|not-?found|loi|page-?not-?found)(\/|\.|-|$)/i.test(real.pathname));
        if (homeJump) s = 0;
        else if (/html/i.test(r.headers.get("content-type") || "")) {
          const head = await lcHead(r, 70000), ti = (head.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "", og = (head.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)/i) || [])[1] || "";
          const body = head.replace(/<(script|style|noscript)\b[\s\S]*?<\/\1>/gi, " ");
          s = (LC_SOFT404_T.test(txt(ti)) && !og) || LC_SOFT404_B.test(body) ? 0 : 1;
        } else s = 1;
      } else s = 2; /* 403/429/5xx: có thể chỉ là chặn robot → chưa rõ */
    }
  } catch (e) { s = 2; }
  lcCachePut(raw, s);
  return { u: raw, s, st, f: ff.slice(0, 80) };
}
async function linkCheck(request, u) {
  const site = request.headers.get("Sec-Fetch-Site"), origin = request.headers.get("Origin");
  if (site ? site !== "same-origin" : (origin && origin !== u.origin)) return bad("Chỉ nhận yêu cầu từ chính trang NHIP.", 403);
  let body; try { body = await request.json(); } catch (e) { return bad("Dữ liệu không hợp lệ."); }
  const urls = Array.isArray(body && body.urls) ? body.urls.slice(0, 12) : []; if (!urls.length) return bad("Thiếu danh sách liên kết.");
  const bud = { n: 44 }, results = [], q = urls.slice();
  const run = async () => { while (q.length) { const x = q.shift(); results.push(await lcOne(x, bud)); } };
  await Promise.all([run(), run(), run(), run()]);
  return new Response(JSON.stringify({ results }), { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}

/* ---------- Giọng đọc tiếng Việt (V2.99c): /proxy/tts/* — người dùng không phải cài gì ----------
   Thứ tự: Azure (nếu có biến AZURE_TTS_KEY + AZURE_TTS_REGION) → Microsoft Edge miễn phí không khóa (HoaiMy nữ / NamMinh nam) → Google Dịch (1 giọng nữ). Cái nào lỗi tự chuyển sang cái kế.
   Chỉ nhận yêu cầu từ chính trang NHIP (không làm "proxy mở"). Cloudflare Workers AI chưa có giọng tiếng Việt nên không dùng. */
const TTS_VOICES = [{ id: "vi-VN-HoaiMyNeural", name: "HoaiMy", gender: "nữ" }, { id: "vi-VN-NamMinhNeural", name: "NamMinh", gender: "nam" }];
const xmlEsc = s => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));
const okJson = o => new Response(JSON.stringify(o), { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
function ttsSplit(t, n) {
  const out = []; let cur = "";
  for (const w of t.split(/\s+/)) { if (!w) continue; if (cur && (cur + " " + w).length > n) { out.push(cur); cur = w; } else cur = cur ? cur + " " + w : w; }
  if (cur) out.push(cur); return out;
}
/* Microsoft Edge "Đọc to" — giọng HoaiMy/NamMinh miễn phí, không cần khóa (qua WebSocket từ Worker). Lỗi/quá 7 giây → tự quay về Google. */
const EDGE_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4", EDGE_VER = "1-143.0.3650.75";
async function edgeGec(skew) {
  const t = Math.floor((Date.now() + (skew || 0)) / 1000) + 11644473600, ticks = BigInt(t - (t % 300)) * 10000000n;
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ticks.toString() + EDGE_TOKEN));
  return Array.from(new Uint8Array(d), b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}
async function edgeTts(text, voice, skew, retried) {
  const id = crypto.randomUUID().replace(/-/g, ""), gec = await edgeGec(skew);
  const url = "https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?" + new URLSearchParams({ TrustedClientToken: EDGE_TOKEN, "Sec-MS-GEC": gec, "Sec-MS-GEC-Version": EDGE_VER, ConnectionId: id });
  const r = await fetch(url, { headers: { Upgrade: "websocket", Origin: "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold", Pragma: "no-cache", "Cache-Control": "no-cache", "Accept-Language": "en-US,en;q=0.9", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0" } });
  const ws = r.webSocket;
  if (!ws) {
    /* 403 thường do lệch đồng hồ: lấy giờ máy chủ Microsoft từ header Date rồi thử lại 1 lần */
    const dt = Date.parse(r.headers && r.headers.get ? r.headers.get("date") || "" : "");
    if (r.status === 403 && !retried && dt) return edgeTts(text, voice, dt - Date.now(), true);
    throw new Error("Edge " + r.status);
  }
  ws.accept();
  return new Promise((res, rej) => {
    const parts = []; let len = 0, done = false;
    const fin = (ok, v) => { if (done) return; done = true; clearTimeout(to); try { ws.close(); } catch (e) { } ok ? res(v) : rej(v); };
    const to = setTimeout(() => fin(false, new Error("Edge hết giờ")), 7000);
    ws.addEventListener("message", async ev => {
      try {
        let d = ev.data;
        if (typeof d === "string") { if (/Path:turn\.end/.test(d)) { if (!len) return fin(false, new Error("Edge rỗng")); const all = new Uint8Array(len); let o = 0; for (const b of parts) { all.set(b, o); o += b.length; } fin(true, all); } return; }
        if (d && typeof d.arrayBuffer === "function") d = await d.arrayBuffer();
        const u = new Uint8Array(d); if (u.length < 2) return;
        const hl = (u[0] << 8) | u[1]; if (hl + 2 > u.length) return;
        if (!/Path:audio/.test(new TextDecoder().decode(u.subarray(2, 2 + hl)))) return;
        const a = u.subarray(2 + hl); if (a.length) { parts.push(a); len += a.length; }
      } catch (e) { fin(false, e); }
    });
    ws.addEventListener("error", () => fin(false, new Error("Edge lỗi kết nối")));
    ws.addEventListener("close", () => { if (!done) fin(false, new Error("Edge đóng sớm")); });
    const ts = new Date().toString();
    ws.send("X-Timestamp:" + ts + "\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n" + '{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}\r\n');
    ws.send("X-RequestId:" + id + "\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:" + ts + "Z\r\nPath:ssml\r\n\r\n" + "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='vi-VN'><voice name='" + voice + "'><prosody pitch='+0Hz' rate='+0%' volume='+0%'>" + xmlEsc(text) + "</prosody></voice></speak>");
  });
}
async function ttsProxy(request, u, env) {
  const site = request.headers.get("Sec-Fetch-Site"), origin = request.headers.get("Origin");
  if (site ? site !== "same-origin" : origin !== u.origin) return bad("Chỉ nhận yêu cầu từ chính trang NHIP.", 403);
  const p = u.pathname.replace(/\/+$/, ""), azure = !!(env && env.AZURE_TTS_KEY && /^[a-z0-9]{3,30}$/i.test(env.AZURE_TTS_REGION || ""));
  if (p === "/proxy/tts/health" && request.method === "GET") {
    let edge = false, edgeError = ""; if (!azure) { try { edge = (await edgeTts("xin chào", "vi-VN-NamMinhNeural")).length > 500; } catch (e) { edgeError = String(e && e.message || e).slice(0, 80); } }
    return okJson({ ok: true, provider: azure ? "azure" : edge ? "edge" : "google", azure, edge, edgeError, voices: (azure || edge) ? TTS_VOICES : [{ id: "google", name: "Google", gender: "nữ" }] });
  }
  if (p === "/proxy/tts/voices" && request.method === "GET") return okJson({ voices: TTS_VOICES, provider: azure ? "azure" : "edge/google" });
  if (p !== "/proxy/tts/audio/speech") return bad("Không có đường dẫn này.", 404);
  if (request.method !== "POST") return bad("Method Not Allowed", 405);
  let req; try { req = await request.json(); } catch (e) { return bad("JSON không hợp lệ."); }
  const text = String(req && req.input || "").replace(/\s+/g, " ").trim();
  if (!text) return bad("Thiếu 'input'.");
  if (text.length > 1200) return bad("Văn bản quá dài (tối đa 1200 ký tự).", 413);
  const voice = TTS_VOICES.some(v => v.id === req.voice) ? req.voice : "vi-VN-HoaiMyNeural", mp3 = (body, via) => new Response(body, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store", "X-NHIP-TTS": via, "X-NHIP-Voice": via === "google" ? "google" : voice } });
  try {
    if (azure) {
      const r = await fetch("https://" + env.AZURE_TTS_REGION + ".tts.speech.microsoft.com/cognitiveservices/v1", {
        method: "POST",
        headers: { "Ocp-Apim-Subscription-Key": env.AZURE_TTS_KEY, "Content-Type": "application/ssml+xml", "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3", "User-Agent": "NHIP" },
        body: "<speak version='1.0' xml:lang='vi-VN'><voice xml:lang='vi-VN' name='" + voice + "'>" + xmlEsc(text) + "</voice></speak>"
      });
      if (r.ok) return mp3(r.body, "azure");
    }
    try { const a = await edgeTts(text, voice); if (a.length > 500) return mp3(a, "edge"); } catch (e) { /* quay về Google */ }
    const bufs = []; let len = 0;
    for (const part of ttsSplit(text, 180)) {
      const r = await fetch("https://translate.google.com/translate_tts?" + new URLSearchParams({ ie: "UTF-8", client: "tw-ob", tl: "vi", q: part }), { headers: { "User-Agent": "Mozilla/5.0 (compatible; NHIP/2.99)", Referer: "https://translate.google.com/" }, cf: { cacheTtl: 86400, cacheEverything: true } });
      if (!r.ok || !/audio/i.test(r.headers.get("content-type") || "")) throw new Error("Google " + r.status);
      const b = new Uint8Array(await r.arrayBuffer()); bufs.push(b); len += b.length;
    }
    const all = new Uint8Array(len); let o = 0; for (const b of bufs) { all.set(b, o); o += b.length; }
    return mp3(all, "google");
  } catch (e) { return bad("Không tạo được giọng đọc (" + ((e && e.message) || "lỗi") + ").", 502); }
}

/* ---------- v3.15 — HỘP THƯ GHÉP ĐÔI 📡 PHÁT LIVE: /proxy/live-sig ----------
   Máy tính và điện thoại trao đổi "lời mời" (o) và "câu trả lời" (a) WebRTC qua mã phòng 6 ký tự, giữ tối đa 5 phút rồi tự xóa.
   Hình/tiếng KHÔNG đi qua đây (đi thẳng giữa hai máy). Lưu bằng KV nếu bạn gắn biến NHIP_LIVE_KV (ổn định nhất); không có thì dùng Cache API của Cloudflare (không cần cấu hình, nhưng chỉ chạy tốt khi hai máy rơi cùng trạm Cloudflare — không được thì dùng "Ghép thủ công" trong bảng).
   Chỉ nhận từ chính trang NHIP; nội dung phải là SDP (bắt đầu bằng "v=0", tối đa 16 KB); câu trả lời đầu tiên thắng (409 cho kẻ đến sau). */
const SIG_RE = /^[A-HJ-NP-Z2-9]{6}$/;
async function sigProxy(request, u, env) {
  const site = request.headers.get("Sec-Fetch-Site"), origin = request.headers.get("Origin");
  if (site ? site !== "same-origin" : (origin && origin !== u.origin)) return bad("Chỉ nhận yêu cầu từ chính trang NHIP.", 403);
  const kv = env && env.NHIP_LIVE_KV && typeof env.NHIP_LIVE_KV.get === "function" ? env.NHIP_LIVE_KV : null, store = kv ? "kv" : "cache";
  if (u.searchParams.get("health")) return okJson({ ok: true, store });
  const room = u.searchParams.get("room") || "", k = u.searchParams.get("k") || "";
  if (!SIG_RE.test(room) || (k !== "o" && k !== "a")) return bad("Mã phòng không hợp lệ.");
  const key = "nhip-live-sig:" + room + ":" + k, ck = new Request(u.origin + "/__nhip-live-sig/" + room + "/" + k);
  const read = async () => { if (kv) return await kv.get(key); const r = await caches.default.match(ck); return r ? await r.text() : null; };
  try {
    if (request.method === "GET") { const v = await read(); return v ? new Response(v, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } }) : new Response("", { status: 404, headers: { "Cache-Control": "no-store" } }); }
    if (request.method === "POST") {
      const body = await request.text(); if (body.length > 16000 || !/^v=0/.test(body)) return bad("Dữ liệu không hợp lệ.");
      if (k === "a" && await read()) return bad("Mã này đã có người trả lời.", 409);
      if (kv) await kv.put(key, body, { expirationTtl: 300 }); else await caches.default.put(ck, new Response(body, { headers: { "Content-Type": "text/plain", "Cache-Control": "public, max-age=300" } }));
      return okJson({ ok: true, store });
    }
    if (request.method === "DELETE") { if (kv) await kv.delete(key); else await caches.default.delete(ck); return okJson({ ok: true }); }
    return bad("Method Not Allowed", 405);
  } catch (e) { return bad("Hộp thư ghép đôi chưa dùng được trên máy chủ này (" + ((e && e.message) || "lỗi") + ") — dùng Ghép thủ công.", 503); }
}

/*HUB-SHARED*/
const HUB_IDX = [["VNINDEX", ["VNINDEX"]], ["VN30", ["VN30"]], ["HNX", ["HNX", "HNXINDEX"]], ["UPCOM", ["UPCOM", "UPCOMINDEX"]]];
const HUB_STK = "ACB BID CTG HDB MBB SHB SSB STB TCB TPB VCB VIB VPB NVB BAB KLB BVB BCM VHM VIC VRE IDC TIG SSI SHS MBS BVS MSN MWG SAB VNM QNS MCH MML FPT VGI FOX GAS PLX POW PVS PVC BSR OIL PGV HPG GVR VCS VJC ACV SAS BVH TNG VGT DGC DPM DCM GEX HSG NKG VND VCI HCM FRT PNJ REE PDR DIG NVL KDH KBC SZC HAH GMD PVT PC1 EIB LPB OCB MSB".split(" ");
const HUB_SYMS = Array.from(new Set(HUB_STK));
const HUB_PART = 38;                                   /* số mã mỗi lượt (giữ dưới giới hạn 50 subrequest của gói free) */
const HUB_PARTS = Math.ceil((HUB_IDX.length + HUB_SYMS.length) / HUB_PART);
function hubPxList() { return [...HUB_IDX.map(([id, alts]) => ({ id, alts })), ...HUB_SYMS.map(s => ({ id: s, alts: [s] }))]; }

/* =====================================================================================================
   NHỊP — BẢN 19: ĐỌC DỮ LIỆU CÓ SẴN TỪ HUB (bản 18) THAY VÌ GỌI TỪNG NGUỒN MỖI LẦN MỞ TRANG
   Ưu tiên 1: KV chung (gắn cùng namespace NHIP_KV với bản 18) → đọc thẳng, không qua mạng.
   Ưu tiên 2: gọi HTTP sang bản 18 (biến HUB_URL, mặc định https://1987-1-18.pages.dev).
   Hub không có / quá cũ / lỗi → tự lùi về cách gọi trực tiếp nguồn như bản gốc (không bao giờ trống dữ liệu).
   ===================================================================================================== */
const HX_MAX_AGE = 3 * 3600000;
const hxMem = new Map();
async function hxGet(env, key) {
  const m = hxMem.get(key); if (m && Date.now() - m.at < 20000) return m;
  let v = null, via = "";
  try {
    if (env && env.NHIP_KV && typeof env.NHIP_KV.get === "function") { v = await env.NHIP_KV.get(key, { type: "json", cacheTtl: 60 }); via = "hub-kv"; }
    else {
      const base = ((env && env.HUB_URL) || "https://1987-1-18.pages.dev").replace(/\/+$/, "");
      const r = await fetch(base + "/api/data?k=" + encodeURIComponent(key), { cf: { cacheTtl: 20, cacheEverything: true } });
      if (r.ok && /json/.test(r.headers.get("content-type") || "")) { v = await r.json(); via = "hub-http"; }
    }
  } catch (e) { v = null; }
  const o = { at: Date.now(), v, via }; hxMem.set(key, o); return o;
}
const hxHdr = (type, via, extra = {}) => ({ "Content-Type": type, "Cache-Control": "public, max-age=30", "X-Nhip-Source": via, ...extra });
async function hubClient(request, u, env) {
  const p = u.pathname, get = request.method === "GET";
  try {
    if (p === "/proxy/rss" && get) {
      const src = u.searchParams.get("src") || ""; if (!RSS[src]) return null;
      const g = await hxGet(env, "rss:all"), f = g.v && g.v.feeds && g.v.feeds[src];
      if (f && f.x && Date.now() - g.v.t < HX_MAX_AGE) return new Response(f.x, { headers: hxHdr("application/xml; charset=utf-8", g.via) });
      return null;
    }
    if (p === "/proxy/stocks" && get) {
      const g = await hxGet(env, "stocks");
      if (g.v && g.v.x) return new Response(g.v.x, { headers: hxHdr("application/json; charset=utf-8", g.via, { "Cache-Control": "public, max-age=3600" }) });
      return null;
    }
    if (p === "/proxy/dchart" && get) {
      const q = u.searchParams, sym = (q.get("symbol") || "").toUpperCase(), from = Number(q.get("from")), to = Number(q.get("to"));
      if (q.get("resolution") !== "D" || !/^[A-Z0-9.]{2,12}$/.test(sym) || !(from > 0) || !(to > from)) return null;
      const list = hubPxList(), idx = list.findIndex(it => it.id === sym || it.alts.includes(sym)); if (idx < 0) return null;
      const g = await hxGet(env, "px:" + Math.floor(idx / HUB_PART)), d = g.v && g.v.d && g.v.d[list[idx].id];
      if (!d || !d.t || !d.t.length || Date.now() - g.v.t > HX_MAX_AGE) return null;
      if (from < d.t[0] - 7 * 86400) return null;                           /* khoảng xin xa hơn dữ liệu đang giữ → để nguồn gốc trả */
      const o = { t: [], o: [], h: [], l: [], c: [], v: [], s: "ok" };
      for (let i = 0; i < d.t.length; i++) if (d.t[i] >= from && d.t[i] <= to) { o.t.push(d.t[i]); o.o.push(d.o[i]); o.h.push(d.h[i]); o.l.push(d.l[i]); o.c.push(d.c[i]); o.v.push(d.v[i]); }
      if (!o.t.length) return null;
      return new Response(JSON.stringify(o), { headers: hxHdr("application/json; charset=utf-8", g.via, { "Cache-Control": "public, max-age=15" }) });
    }
    if (p === "/proxy/linkcheck" && request.method === "POST") {
      const site = request.headers.get("Sec-Fetch-Site"), origin = request.headers.get("Origin");
      if (site ? site !== "same-origin" : (origin && origin !== u.origin)) return bad("Chỉ nhận yêu cầu từ chính trang NHIP.", 403);
      const g = await hxGet(env, "lc:all"); if (!g.v || !g.v.m) return null;
      let body; try { body = await request.clone().json(); } catch (e) { return null; }
      const urls = Array.isArray(body && body.urls) ? body.urls.slice(0, 12) : []; if (!urls.length) return null;
      const results = urls.map(x => { x = String(x || "").slice(0, 600); if (!/^https?:\/\/[^\s]+$/i.test(x)) return { u: x, s: 0 }; const c = g.v.m[x]; return { u: x, s: c ? c[0] : 2 }; });
      return new Response(JSON.stringify({ results }), { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Nhip-Source": g.via } });
    }
  } catch (e) { return null; }
  return null;
}
export default {
  async fetch(request, env) {
    const u = new URL(request.url);
    if (u.pathname === "/proxy/tts" || u.pathname.startsWith("/proxy/tts/")) return ttsProxy(request, u, env);
    if (u.pathname === "/proxy/live-sig") return sigProxy(request, u, env);
    if (!PATHS.includes(u.pathname)) return env.ASSETS.fetch(request);
    { const hx = await hubClient(request, u, env); if (hx) return hx; } /* BẢN 19: ưu tiên dữ liệu có sẵn từ hub */
    if (u.pathname === "/proxy/article") return request.method === "GET" ? articleProxy(request, u, env) : bad("Method Not Allowed", 405);
    if (u.pathname === "/proxy/version") return new Response(JSON.stringify({ v: "3.07", linkcheck: true, gone: true }), { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
    if (u.pathname === "/proxy/linkcheck") return request.method === "POST" ? linkCheck(request, u) : bad("Method Not Allowed", 405);
    if (u.pathname === "/proxy/ai") return request.method === "GET" || request.method === "POST" ? aiProxy(request, u) : bad("Method Not Allowed", 405);
    if (u.pathname === "/proxy/finfo") {
      if (request.method !== "GET") return bad("Method Not Allowed", 405);
      const endpoint = (u.searchParams.get("endpoint") || "").toLowerCase();
      const allowed = new Set(["ratios", "stock_prices", "stocks", "financial_statements", "financial_models", "events"]);
      if (!allowed.has(endpoint)) return bad("Endpoint FinInfo không được phép.", 400);
      const params = new URLSearchParams();
      for (const key of ["q", "fields", "size", "sort", "page"]) {
        const value = u.searchParams.get(key);
        if (value != null && value.length <= 500) params.set(key, value);
      }
      if (endpoint === "ratios" && !params.has("q")) return bad("Thiếu tham số mã/chỉ tiêu.", 400);
      if (endpoint === "events" && !/^code:[A-Za-z0-9.]{2,12}(~|$)/.test(params.get("q") || "")) return bad("Thiếu mã cổ phiếu (q=code:MÃ).", 400);
      const qs = params.toString() ? "?" + params.toString() : "";
      /* v2.89: sự kiện doanh nghiệp (cổ tức, thưởng) thử cả hai tên miền FinInfo của VNDirect; cache 30 phút */
      const hosts = ["https://api-finfo.vndirect.com.vn/v4/"];
      try {
        let r;
        for (const h of hosts) {
          r = await fetch(h + endpoint + qs, { headers: { "User-Agent": "Mozilla/5.0 (compatible; NHIP/2.0)", "Accept": "application/json" }, cf: { cacheTtl: endpoint === "events" ? 1800 : 300, cacheEverything: true } });
          if (r.ok) break;
        }
        return new Response(r.body, {
          status: r.status,
          headers: { "Content-Type": r.headers.get("content-type") || "application/json", "Cache-Control": "public, max-age=60" }
        });
      } catch (e) {
        return bad("Không kết nối được FinInfo VNDIRECT.", 502);
      }
    }
    if (request.method !== "GET") return bad("Method Not Allowed", 405);
    const UA = { "User-Agent": "Mozilla/5.0 (compatible; NHIP/2.0)", "Accept": "application/json" };
    if (u.pathname === "/proxy/stocks") {
      try { const x = await stocksAll(g => fetch(g, { headers: UA, cf: { cacheTtl: 3600, cacheEverything: true } })); return new Response(x, { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=3600" } }); }
      catch (e) { return bad("Không lấy được danh sách mã.", 502); }
    }
    /* BẢN 20 — /proxy/market?ex=hose|hnx|upcom : bảng giá cả sàn từ SSI iBoard (đã kiểm: 410/299/814 mã) */
    if (u.pathname === "/proxy/market") {
      const ex = (u.searchParams.get("ex") || "").toLowerCase();
      if (!["hose", "hnx", "upcom"].includes(ex)) return bad("Sàn không hợp lệ (hose, hnx, upcom).");
      try { const r = await fetch("https://iboard-query.ssi.com.vn/stock/exchange/" + ex, { headers: UA, cf: { cacheTtl: 30, cacheEverything: true } }); return new Response(r.body, { status: r.status, headers: { "Content-Type": r.headers.get("content-type") || "application/json", "Cache-Control": "public, max-age=30" } }); }
      catch (e) { return bad("Không kết nối được SSI iBoard.", 502); }
    }
    /* BẢN 20 — /proxy/bctc?code=FPT&type=QUARTER|YEAR&n=8 : báo cáo tài chính gom theo kỳ (VNDirect financial_statements) */
    if (u.pathname === "/proxy/bctc") {
      const code = (u.searchParams.get("code") || "").toUpperCase(), type = (u.searchParams.get("type") || "QUARTER").toUpperCase();
      const n = Math.max(1, Math.min(Number(u.searchParams.get("n")) || 8, 20));
      if (!/^[A-Z0-9.]{2,12}$/.test(code) || !["QUARTER", "YEAR"].includes(type)) return bad("Tham số không hợp lệ (code, type=QUARTER|YEAR).");
      try {
        const rows = []; let tp = 1;
        for (let p = 1; p <= 6 && p <= tp; p++) {
          const r = await fetch("https://api-finfo.vndirect.com.vn/v4/financial_statements?" + new URLSearchParams({ q: "code:" + code + "~reportType:" + type, sort: "fiscalDate:desc", size: "1000", page: String(p) }), { headers: UA, cf: { cacheTtl: 3600, cacheEverything: true } });
          if (!r.ok) throw new Error("HTTP " + r.status);
          const j = await r.json(); tp = Number(j.totalPages) || 1; rows.push(...(Array.isArray(j.data) ? j.data : []));
          if (new Set(rows.map(x => x.fiscalDate)).size > n) break;
        }
        const periods = [...new Set(rows.map(x => x.fiscalDate))].sort().reverse().slice(0, n), keep = new Set(periods), models = {};
        for (const x of rows) { if (!keep.has(x.fiscalDate)) continue; const m = models[x.modelType] || (models[x.modelType] = {}), it = m[x.itemCode] || (m[x.itemCode] = {}); it[x.fiscalDate] = x.numericValue; }
        if (!periods.length) return bad("Không có dữ liệu cho mã này.", 404);
        return new Response(JSON.stringify({ code, reportType: type, periods, models }), { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=1800" } });
      } catch (e) { return bad("Không lấy được báo cáo tài chính.", 502); }
    }
    let target, ttl;
    if (u.pathname === "/proxy/dchart") {
      const p = u.searchParams, symbol = p.get("symbol") || "", res = p.get("resolution") || "", from = p.get("from") || "", to = p.get("to") || "";
      if (!/^[A-Za-z0-9.]{2,12}$/.test(symbol) || !/^(1|5|15|30|60|D|W|M)$/.test(res) || !/^\d{9,11}$/.test(from) || !/^\d{9,11}$/.test(to)) return bad("Tham số không hợp lệ.");
      target = "https://dchart-api.vndirect.com.vn/dchart/history?" + new URLSearchParams({ symbol: symbol.toUpperCase(), resolution: res, from, to });
      ttl = res === "1" ? 2 : 15; /* v2.64: nến 1 phút (nhịp giá trực tiếp) cache 2 giây */
    } else if (u.pathname === "/proxy/rss") {
      target = RSS[u.searchParams.get("src")]; ttl = 120;
      if (!target) return bad("Nguồn tin không hợp lệ.");
    } else if (u.pathname === "/proxy/gnews") {
      // Tìm tin theo mã/tên doanh nghiệp: chỉ nhận chữ, số, khoảng trắng, nháy kép, dấu : - . ( ) và từ khóa OR / when:
      const q = (u.searchParams.get("q") || "").trim();
      if (q.length < 3 || q.length > 420 || !/^[\p{L}\p{N}\s"':.\-()&]+$/u.test(q)) return bad("Từ khóa không hợp lệ.");
      target = "https://news.google.com/rss/search?" + new URLSearchParams({ q, hl: "vi", gl: "VN", ceid: "VN:vi" }); ttl = 600;
    } else if (u.pathname === "/proxy/bing") {
      // Bing News RSS: nguồn tìm tin thứ hai (bổ sung cho Google News), cùng quy tắc kiểm tra từ khóa.
      const q = (u.searchParams.get("q") || "").trim();
      if (q.length < 3 || q.length > 420 || !/^[\p{L}\p{N}\s"':.\-()&]+$/u.test(q)) return bad("Từ khóa không hợp lệ.");
      target = "https://www.bing.com/news/search?" + new URLSearchParams({ q, format: "rss", setlang: "vi", cc: "VN" }); ttl = 600;
    } else {
      target = "https://api-finfo.vndirect.com.vn/v4/stocks?" + new URLSearchParams(STOCKS_Q); ttl = 86400;
    }
    try {
      const r = await fetch(target, { headers: { "User-Agent": "Mozilla/5.0 (compatible; NHIP/1.8)", Accept: "*/*" }, cf: { cacheTtl: ttl, cacheEverything: true } });
      return new Response(r.body, { status: r.status, headers: { "Content-Type": r.headers.get("content-type") || "application/octet-stream", "Cache-Control": "public, max-age=" + ttl } });
    } catch (e) { return bad("Không kết nối được nguồn dữ liệu.", 502); }
  }
};
