#!/usr/bin/env node
// Nối "Tùy chỉnh giao diện" (bước 5) vào giao diện công khai.
//   node tools/noi-giao-dien.mjs                 xem trước (KHÔNG ghi gì)
//   node tools/noi-giao-dien.mjs --apply         ghi thật (tự sao lưu *.bak-noi-giao-dien)
//   node tools/noi-giao-dien.mjs --hoan-tac      khôi phục từ bản sao lưu
// Tùy chọn:
//   --base src/layouts/Base.astro   --css src/styles/global.css
//   --map ten-bien=khoa             vd --map brand=primary  (khoa: primary secondary success alert text heading link link-h body-bg content-bg)
//   --hex "#0f9d6b=primary"         thay MỌI chỗ mã màu cứng này trong CSS bằng biến theme
//   --logo /logo.svg                logo dùng cho header/footer mới ("" = chữ)
//   --name "Nhịp Đầu Tư"
// An toàn: chạy lại nhiều lần không nhân đôi; có việc nào không nhận ra được thì KHÔNG ghi tệp đó và nói rõ cần sửa tay chỗ nào.
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const vals = (n) => argv.flatMap((a, i) => (a === n && argv[i + 1] !== undefined ? [argv[i + 1]] : []));
const val = (n, d) => vals(n)[0] ?? d;
const APPLY = flag('--apply'), UNDO = flag('--hoan-tac');
const BAK = '.bak-noi-giao-dien', MARK = 'nhip-theme-wired';
const root = process.cwd();
const rel = (p) => path.relative(root, p) || p;
const out = (...a) => console.log(...a);
const warn = [], todo = [];

const KEYS = ['primary', 'secondary', 'success', 'alert', 'text', 'heading', 'link', 'link-h', 'body-bg', 'content-bg'];

function find(cands) { for (const c of cands) { const p = path.resolve(root, c); if (fs.existsSync(p)) return p; } return null; }
const basePath = val('--base') ? path.resolve(root, val('--base')) : find(['src/layouts/Base.astro', 'src/layouts/Layout.astro', 'src/layouts/BaseLayout.astro']);
let cssPath = val('--css') ? path.resolve(root, val('--css')) : find(['src/styles/global.css', 'src/styles/globals.css', 'src/styles/main.css', 'src/styles/style.css', 'src/global.css']);

if (UNDO) {
  let n = 0;
  for (const p of [basePath, cssPath].filter(Boolean)) {
    const b = p + BAK;
    if (fs.existsSync(b)) { fs.copyFileSync(b, p); fs.unlinkSync(b); out('Đã khôi phục', rel(p)); n++; }
  }
  out(n ? 'Xong.' : 'Không có bản sao lưu nào để khôi phục.');
  process.exit(0);
}
if (!basePath || !fs.existsSync(basePath)) { out('Không tìm thấy Base.astro (đã thử src/layouts/Base.astro, Layout.astro, BaseLayout.astro). Chỉ đường dẫn bằng --base.'); process.exit(1); }

// ───────────────────────── Base.astro ─────────────────────────
function patchBase(src) {
  const nl = src.includes('\r\n') ? '\r\n' : '\n';
  if (src.includes(MARK)) return { skip: 'Base.astro đã được nối trước đó (có dấu ' + MARK + ').' };
  if (/\bSiteHeader\b|\bSiteFooter\b|\bThemeHead\b/.test(src)) return { fail: 'Base.astro đã nhắc tới SiteHeader/SiteFooter/ThemeHead nhưng chưa có dấu nối. Hãy bỏ các dòng đó đi rồi chạy lại, hoặc nối tay theo README bước 5.' };

  const fm = src.match(/^(\s*)---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) return { fail: 'Base.astro không có phần frontmatter (--- … ---) ở đầu tệp nên không chèn mã được.' };
  const headEnd = src.match(/<\/head\s*>/i), bodyOpen = src.match(/<body\b[^>]*>/i), bodyEnd = src.match(/<\/body\s*>/i);
  if (!headEnd) return { fail: 'Không thấy thẻ </head> trong Base.astro.' };
  if (!bodyOpen) return { fail: 'Không thấy thẻ <body> trong Base.astro.' };
  if (!bodyEnd) return { fail: 'Không thấy thẻ </body> trong Base.astro.' };
  if (/\bnhTheme\b|\bnhSite\b/.test(src)) return { fail: 'Base.astro đã dùng tên biến nhTheme/nhSite.' };

  const srcDir = path.resolve(root, 'src');
  let r = path.relative(path.dirname(basePath), srcDir).split(path.sep).join('/') || '.';
  if (!r.startsWith('.')) r = './' + r;
  const logoGiven = vals('--logo').length > 0;
  let logo = logoGiven ? val('--logo') : '';
  if (!logoGiven) {
    for (const f of ['logo.svg', 'logo.png', 'logo.webp', 'logo.jpg']) if (fs.existsSync(path.join(root, 'public', f))) { logo = '/' + f; break; }
    if (!logo) warn.push('Không thấy tệp logo trong public/ nên header/footer mới sẽ hiện tên bằng chữ. Có logo thì chạy lại kèm --logo /duong-dan.');
  }
  const name = val('--name', 'Nhịp Đầu Tư');
  const lit = (s) => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";

  const fmAdd = [
    `// ${MARK}: nối Tùy chỉnh giao diện (bước 5) — chạy bằng tools/noi-giao-dien.mjs`,
    `import ThemeHead from '${r}/components/ThemeHead.astro';`,
    `import SiteHeader from '${r}/components/SiteHeader.astro';`,
    `import SiteFooter from '${r}/components/SiteFooter.astro';`,
    `import { getTheme } from '${r}/lib/theme';`,
    `const nhTheme = await getTheme(Astro.locals.runtime.env.DB);`,
    `const nhSite = { name: ${lit(name)}, logo: ${lit(logo)} };`,
  ].join(nl);

  let s = src;
  // 1) body trước (vị trí lớn nhất trước) để chỉ số phía trước không lệch
  // Tìm header/footer cũ TRƯỚC khi chèn bản mới
  const wrapOld = (kind) => {
    const tag = kind === 'header' ? 'header' : 'footer';
    const compRe = kind === 'header' ? /<(Header|Navbar|NavBar|TopNav|SiteNav|MainHeader|HeaderBar|SiteHeaderOld)\b[^>]*\/>/g : /<(Footer|MainFooter|FooterBar|SiteFooterOld)\b[^>]*\/>/g;
    const elRe = new RegExp(`<${tag}(?=[\\s>])[\\s\\S]*?</${tag}\\s*>`, 'g');
    const body = s.slice(bodyOpen.index, bodyEnd.index + bodyEnd[0].length);
    const base = bodyOpen.index;
    const els = [...body.matchAll(elRe)], comps = [...body.matchAll(compRe)];
    const hits = els.length === 1 && comps.length === 0 ? els : comps.length === 1 && els.length === 0 ? comps : null;
    if (!hits) {
      todo.push(`Không tự nhận ra ${kind} cũ (${els.length} thẻ <${tag}>, ${comps.length} thẻ component). Hãy bọc tay: {nhTheme.${kind === 'header' ? 'hd_on' : 'ft_on'} !== '1' && ( …${kind} cũ… )}`);
      return null;
    }
    const m = hits[0];
    return { start: base + m.index, end: base + m.index + m[0].length, text: m[0] };
  };
  const oh = wrapOld('header'), of = wrapOld('footer');

  // Danh sách chỉnh sửa theo vị trí, áp từ cuối lên đầu
  const edits = [];
  edits.push({ at: headEnd.index, del: 0, ins: `<ThemeHead />${nl}` });
  edits.push({ at: bodyOpen.index + bodyOpen[0].length, del: 0, ins: `${nl}<SiteHeader site={nhSite} />` });
  if (oh) edits.push({ at: oh.start, del: oh.end - oh.start, ins: `{nhTheme.hd_on !== '1' && (${nl}${oh.text}${nl})}` });
  if (of) edits.push({ at: of.start, del: of.end - of.start, ins: `{nhTheme.ft_on !== '1' && (${nl}${of.text}${nl})}${nl}<SiteFooter site={nhSite} />` });
  else { edits.push({ at: bodyEnd.index, del: 0, ins: `<SiteFooter site={nhSite} />${nl}` }); todo.push('Không có footer cũ để bọc nên SiteFooter được đặt ngay trước </body>. Nếu footer cũ nằm trong một component khác, hãy bọc nó bằng {nhTheme.ft_on !== \'1\' && (…)}.'); }
  // chèn frontmatter: ngay trước dấu --- đóng
  const closeIdx = fm[0].length - 3;
  edits.push({ at: closeIdx, del: 0, ins: nl + fmAdd + nl });

  edits.sort((a, b) => b.at - a.at || b.del - a.del);
  for (let i = 1; i < edits.length; i++) if (edits[i].at + edits[i].del > edits[i - 1].at) return { fail: 'Các vị trí cần sửa chồng lên nhau (header/footer nằm trong <head>?). Hãy nối tay theo README bước 5.' };
  for (const e of edits) s = s.slice(0, e.at) + e.ins + s.slice(e.at + e.del);
  if (!/<main[\s>]/i.test(s)) warn.push('Base.astro không có thẻ <main>: màu liên kết (Màu liên kết / khi rê chuột) trong Tùy chỉnh giao diện sẽ không áp dụng. Bọc <slot /> bằng <main> nếu muốn.');
  return { text: s, header: !!oh, footer: !!of };
}

// ───────────────────────── CSS ─────────────────────────
const norm = (h) => { h = h.toLowerCase(); return h.length === 4 ? '#' + [...h.slice(1)].map((c) => c + c).join('') : h; };
const NAMES = [
  ['primary', /^(primary|brand|main|accent|theme|c-primary|color-primary|brand-color|primary-color|green)$/],
  ['secondary', /^(secondary|c-secondary|color-secondary|secondary-color)$/],
  ['success', /^(success|positive|ok)$/],
  ['alert', /^(alert|danger|error)$/],
  ['text', /^(text|ink|fg|foreground|text-color|color-text|body-text|txt)$/],
  ['heading', /^(heading|heading-color|title-color)$/],
  ['link', /^(link|link-color)$/],
  ['link-h', /^(link-hover|link-h|link-hover-color)$/],
  ['body-bg', /^(bg|background|body-bg|page-bg|bg-body|canvas)$/],
  ['content-bg', /^(card|card-bg|surface|panel|bg-card|content-bg)$/],
];
function patchCss(src) {
  if (/var\(--nhip-[a-z-]+,/.test(src) && !flag('--force')) {
    // đã nối ít nhất một phần: vẫn cho áp thêm --map/--hex mới nhưng bỏ qua các biến đã nối
  }
  let s = src;
  const report = [];
  const manual = new Map(vals('--map').map((x) => x.split('=')).filter((x) => x.length === 2 && KEYS.includes(x[1])).map(([a, b]) => [a.replace(/^--/, ''), b]));
  for (const x of vals('--map')) { const [a, b] = x.split('='); if (!b || !KEYS.includes(b)) warn.push(`--map "${x}" sai khuôn dạng; khóa hợp lệ: ${KEYS.join(', ')}.`); }

  // biến :root có giá trị là mã màu
  const decls = [];
  for (const blk of s.matchAll(/:root\s*\{([^}]*)\}/g)) {
    for (const d of blk[1].matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6})\s*(?=[;}]|$)/g)) decls.push({ name: d[1].slice(2), value: d[2] });
  }
  const want = new Map(); // key -> [name,...]
  for (const d of decls) {
    let key = manual.get(d.name);
    if (!key) for (const [k, re] of NAMES) if (re.test(d.name)) { key = k; break; }
    if (!key) continue;
    if (!want.has(key)) want.set(key, []);
    want.get(key).push(d);
  }
  for (const [key, ds] of want) {
    const explicit = ds.filter((d) => manual.get(d.name) === key);
    const use = explicit.length ? explicit : ds;
    if (use.length > 1) { report.push(`BỎ QUA "${key}": nhiều biến cùng khớp (${use.map((d) => '--' + d.name).join(', ')}). Chọn một bằng --map ten=${key}.`); continue; }
    const d = use[0];
    const re = new RegExp(`(--${d.name.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\s*:\\s*)${d.value}(?=\\s*[;}]|\\s*$)`, 'g');
    const before = s;
    s = s.replace(re, `$1var(--nhip-${key},${d.value})`);
    if (s !== before) report.push(`--${d.name}: ${d.value}  →  var(--nhip-${key},${d.value})`);
  }
  // mã màu cứng
  for (const x of vals('--hex')) {
    const [h, key] = x.split('=');
    if (!h || !/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(h) || !KEYS.includes(key)) { warn.push(`--hex "${x}" sai khuôn dạng (vd "#0f9d6b=primary").`); continue; }
    const target = norm(h);
    let n = 0;
    s = s.replace(/(?<!var\(--nhip-[a-z-]+,\s*)#[0-9a-fA-F]{6}\b|(?<!var\(--nhip-[a-z-]+,\s*)#[0-9a-fA-F]{3}\b/g, (m) => (norm(m) === target ? (n++, `var(--nhip-${key},${m})`) : m));
    report.push(`${h} → var(--nhip-${key},…): ${n} chỗ`);
  }
  if (!report.length) {
    const freq = new Map();
    for (const m of src.matchAll(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g)) { const k = norm(m[0]); freq.set(k, (freq.get(k) || 0) + 1); }
    const top = [...freq].filter((x) => x[1] >= 3).sort((a, b) => b[1] - a[1]).slice(0, 8);
    todo.push('Không tự nối được biến màu nào (CSS không dùng biến :root có tên quen thuộc).' + (top.length ? ' Các mã màu hay dùng nhất: ' + top.map(([h, n]) => `${h} (${n}×)`).join(', ') + '. Ví dụ màu chủ đạo là ' + top[0][0] + ' thì chạy thêm: --hex "' + top[0][0] + '=primary"' : ''));
  }
  return { text: s, report, changed: s !== src };
}

// ───────────────────────── chạy ─────────────────────────
const plans = [];
const b = patchBase(fs.readFileSync(basePath, 'utf8'));
out('— ' + rel(basePath));
if (b.skip) out('  ' + b.skip); else if (b.fail) { out('  KHÔNG ghi: ' + b.fail); } else { out('  + <ThemeHead /> trong <head>'); out('  + <SiteHeader /> ngay sau <body>' + (b.header ? '; header cũ được bọc điều kiện' : '')); out('  + <SiteFooter />' + (b.footer ? '; footer cũ được bọc điều kiện' : '')); plans.push([basePath, b.text]); }

if (cssPath && fs.existsSync(cssPath)) {
  const c = patchCss(fs.readFileSync(cssPath, 'utf8'));
  out('— ' + rel(cssPath));
  if (c.report.length) c.report.forEach((l) => out('  ' + l)); else out('  (không có thay đổi)');
  if (c.changed) plans.push([cssPath, c.text]);
} else {
  todo.push('Không tìm thấy tệp CSS chung (global.css). Chỉ đường dẫn bằng --css để nối biến màu.');
}

warn.forEach((w) => out('Lưu ý: ' + w));
todo.forEach((t) => out('Cần làm tay: ' + t));
if (b.fail) process.exitCode = 2;

if (!plans.length) { out('\nKhông có gì để ghi.'); process.exit(process.exitCode || 0); }
if (!APPLY) { out('\nĐây chỉ là xem trước. Thêm --apply để ghi thật.'); process.exit(process.exitCode || 0); }
for (const [p, text] of plans) {
  if (!fs.existsSync(p + BAK)) fs.copyFileSync(p, p + BAK);
  fs.writeFileSync(p, text);
  out('Đã ghi ' + rel(p) + ' (sao lưu: ' + rel(p + BAK) + ')');
}
out('Xong. Hoàn tác bất cứ lúc nào bằng: node tools/noi-giao-dien.mjs --hoan-tac');
