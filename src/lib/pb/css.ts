// Page Builder Pro: kiểu mở rộng (style.x) của từng khối.
// Nguyên tắc: KHÔNG bao giờ ghép chuỗi người dùng vào CSS. Mỗi thuộc tính có kiểu dữ liệu riêng, giá trị được kiểm tra rồi mới sinh CSS.
// Không import blocks.ts (tránh vòng phụ thuộc).
export const BP = { t: 1024, m: 760 }; // điểm ngắt: máy tính bảng ≤1024px, điện thoại ≤760px (khớp core.css)

export const FONTS: Record<string, { label: string; stack: string; gf?: string }> = {
  '': { label: 'Theo giao diện', stack: '' },
  sans: { label: 'Inter', stack: "Inter,system-ui,-apple-system,'Segoe UI',sans-serif" },
  'be-vietnam': { label: 'Be Vietnam Pro', stack: "'Be Vietnam Pro',system-ui,sans-serif", gf: 'Be+Vietnam+Pro:wght@400;600;700' },
  montserrat: { label: 'Montserrat', stack: "'Montserrat',system-ui,sans-serif", gf: 'Montserrat:wght@400;600;700' },
  roboto: { label: 'Roboto', stack: "'Roboto',system-ui,sans-serif", gf: 'Roboto:wght@400;500;700' },
  merriweather: { label: 'Merriweather (có chân)', stack: "'Merriweather',Georgia,serif", gf: 'Merriweather:wght@400;700' },
  playfair: { label: 'Playfair Display (tiêu đề)', stack: "'Playfair Display',Georgia,serif", gf: 'Playfair+Display:wght@500;700' },
  serif: { label: 'Georgia', stack: "Georgia,'Times New Roman',serif" },
  mono: { label: 'Chữ đơn cách', stack: "ui-monospace,Menlo,Consolas,monospace" },
};
export const GRADS: Record<string, string> = {
  brand: 'linear-gradient(135deg,color-mix(in srgb,var(--green) 80%,#000),var(--ink))',
  night: 'linear-gradient(135deg,#0a2a2f,#0b1220)',
  sky: 'linear-gradient(135deg,#e6f4ff,#f5faff)',
  mint: 'linear-gradient(135deg,#e7f8ef,#f6fffa)',
  sun: 'linear-gradient(135deg,#fff3d6,#ffe8c2)',
};
export const SHADOWS: Record<string, string> = {
  none: 'none', sm: '0 1px 3px rgba(0,0,0,.12)', md: '0 8px 24px rgba(0,0,0,.10)', lg: '0 18px 48px rgba(0,0,0,.16)',
  glow: '0 0 0 4px color-mix(in srgb,var(--green) 25%,transparent),0 8px 24px rgba(0,0,0,.12)',
};

type Spec = { t: 'col' } | { t: 'num'; min: number; max: number } | { t: 'enum'; v: string[] } | { t: 'len' } | { t: 'url' } | { t: 'bool' } | { t: 'font' };
export const RULE_SPEC: Record<string, Spec> = {
  color: { t: 'col' }, bg: { t: 'col' }, bgimg: { t: 'url' }, grad: { t: 'enum', v: Object.keys(GRADS) },
  bgsize: { t: 'enum', v: ['cover', 'contain', 'auto'] }, bgpos: { t: 'enum', v: ['center', 'top', 'bottom', 'left', 'right'] },
  font: { t: 'font' }, fs: { t: 'num', min: 8, max: 140 }, fw: { t: 'enum', v: ['300', '400', '500', '600', '700', '800', '900'] },
  lh: { t: 'num', min: 0.8, max: 3 }, ls: { t: 'num', min: -2, max: 12 }, al: { t: 'enum', v: ['left', 'center', 'right', 'justify'] },
  pt: { t: 'num', min: 0, max: 400 }, pr: { t: 'num', min: 0, max: 400 }, pb: { t: 'num', min: 0, max: 400 }, pl: { t: 'num', min: 0, max: 400 },
  mt: { t: 'num', min: -100, max: 400 }, mb: { t: 'num', min: -100, max: 400 },
  w: { t: 'len' }, maxw: { t: 'len' }, minh: { t: 'num', min: 0, max: 1600 },
  bw: { t: 'num', min: 0, max: 20 }, bs: { t: 'enum', v: ['solid', 'dashed', 'dotted'] }, bc: { t: 'col' }, radius: { t: 'num', min: 0, max: 200 },
  shadow: { t: 'enum', v: Object.keys(SHADOWS) }, opacity: { t: 'num', min: 0, max: 100 }, hide: { t: 'bool' },
};
export type Rule = Record<string, string | number | boolean>;
export type X = {
  d: Rule; t: Rule; m: Rule;
  fx: { anim: string; hover: string; dur: number; delay: number };
  cond: { from: string; to: string; days: number[]; param: string };
  lock: '' | 'admin'; cls: string; anchor: string; css: string;
};

const COL = /^(#[0-9a-f]{3,8}|[a-z]{3,20}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%deg]+\))$/i;
const LEN = /^(auto|0|-?\d{1,4}(\.\d{1,2})?(px|%|rem|em|vw|vh)?)$/;
const httpsRaw = (s: any) => (/^https:\/\/[^\s'"()<>\\]{1,1000}$/i.test(String(s || '').trim()) ? String(s).trim() : '');
const cssUrlEnc = (s: string) => s.replace(/['"()\\\s<>]/g, (c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'));

export function cleanRule(r: any): Rule {
  const o: Rule = {};
  if (!r || typeof r !== 'object') return o;
  for (const [k, sp] of Object.entries(RULE_SPEC)) {
    const v = r[k];
    if (v === undefined || v === null || v === '' || v === false) continue;
    if (sp.t === 'col') { const s = String(v).trim(); if (COL.test(s)) o[k] = s; }
    else if (sp.t === 'num') { const n = Number(v); if (isFinite(n)) o[k] = Math.min(sp.max, Math.max(sp.min, n)); }
    else if (sp.t === 'enum') { const s = String(v); if (sp.v.includes(s)) o[k] = s; }
    else if (sp.t === 'len') { const s = String(v).trim(); if (LEN.test(s)) o[k] = s; }
    else if (sp.t === 'url') { const s = httpsRaw(v); if (s) o[k] = s; }
    else if (sp.t === 'bool') { if (v === true) o[k] = true; }
    else if (sp.t === 'font') { const s = String(v); if (s in FONTS && s) o[k] = s; }
  }
  return o;
}

const num = (v: any, d: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(Number(v)) ? Number(v) : d));
const ANIMS = ['', 'fade', 'up', 'left', 'right', 'zoom'], HOVERS = ['', 'lift', 'zoom', 'glow'];
const VNDT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const PARAM = /^[\w-]{1,30}=[\w.-]{0,60}$/;

// admin=false: người không phải quản trị viên không được đặt/đổi "khóa" và CSS tùy chỉnh; giữ nguyên giá trị cũ (oldX).
export function cleanX(x: any, admin: boolean, oldX?: any): X {
  const s = x && typeof x === 'object' ? x : {};
  const fx = s.fx || {}, cd = s.cond || {};
  const out: X = {
    d: cleanRule(s.d), t: cleanRule(s.t), m: cleanRule(s.m),
    fx: { anim: ANIMS.includes(fx.anim) ? fx.anim : '', hover: HOVERS.includes(fx.hover) ? fx.hover : '', dur: num(fx.dur, 0.6, 0.1, 3), delay: num(fx.delay, 0, 0, 3) },
    cond: { from: VNDT.test(cd.from) ? cd.from : '', to: VNDT.test(cd.to) ? cd.to : '', days: (Array.isArray(cd.days) ? cd.days : []).map(Number).filter((n: number) => n >= 0 && n <= 6).filter((n: number, i: number, a: number[]) => a.indexOf(n) === i), param: PARAM.test(String(cd.param || '')) ? String(cd.param) : '' },
    lock: admin ? (s.lock === 'admin' ? 'admin' : '') : (oldX?.lock === 'admin' ? 'admin' : ''),
    cls: String(s.cls || '').replace(/[^\w -]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80),
    anchor: /^[a-zA-Z][\w-]{0,40}$/.test(String(s.anchor || '')) ? String(s.anchor) : '',
    css: admin ? String(s.css || '').slice(0, 8000) : String(oldX?.css || '').slice(0, 8000),
  };
  return out;
}
export const isEmptyX = (x: X) => !Object.keys(x.d).length && !Object.keys(x.t).length && !Object.keys(x.m).length && !x.fx.anim && !x.fx.hover
  && !x.cond.from && !x.cond.to && !x.cond.days.length && !x.cond.param && !x.lock && !x.cls && !x.anchor && !x.css;

function decl(r: Rule, edit: boolean, fonts?: Set<string>): string {
  const o: string[] = [], px = (k: string, p: string) => { if (r[k] !== undefined) o.push(`${p}:${r[k]}px`); };
  if (r.color) o.push(`color:${r.color}`);
  if (r.bg) o.push(`background-color:${r.bg}`);
  if (r.grad) o.push(`background-image:${GRADS[String(r.grad)]}`);
  if (r.bgimg) { o.push(`background-image:url('${cssUrlEnc(String(r.bgimg))}')`, 'background-repeat:no-repeat'); o.push(`background-size:${r.bgsize || 'cover'}`, `background-position:${r.bgpos || 'center'}`); }
  if (r.font) { const f = FONTS[String(r.font)]; if (f?.stack) { o.push(`font-family:${f.stack}`); if (f.gf && fonts) fonts.add(f.gf); } }
  px('fs', 'font-size'); if (r.fw) o.push(`font-weight:${r.fw}`); if (r.lh !== undefined) o.push(`line-height:${r.lh}`); px('ls', 'letter-spacing');
  if (r.al) o.push(`text-align:${r.al}`);
  px('pt', 'padding-top'); px('pr', 'padding-right'); px('pb', 'padding-bottom'); px('pl', 'padding-left'); px('mt', 'margin-top'); px('mb', 'margin-bottom');
  if (r.w) o.push(`width:${r.w}`); if (r.maxw) o.push(`max-width:${r.maxw}`); px('minh', 'min-height');
  if (r.bw !== undefined) { o.push(`border-width:${r.bw}px`, `border-style:${r.bs || 'solid'}`, `border-color:${r.bc || 'var(--line)'}`); }
  else if (r.bs || r.bc) { o.push(`border-style:${r.bs || 'solid'}`, `border-color:${r.bc || 'var(--line)'}`, 'border-width:1px'); }
  px('radius', 'border-radius'); if (r.shadow) o.push(`box-shadow:${SHADOWS[String(r.shadow)]}`);
  if (r.opacity !== undefined) o.push(`opacity:${Number(r.opacity) / 100}`);
  if (r.hide) o.push(edit ? 'opacity:.3' : 'display:none');
  return o.map((x) => x + '!important').join(';');
}

const vnParts = (d: Date) => { const v = new Date(d.getTime() + 7 * 3600e3); return { day: v.getUTCDay(), ms: d.getTime() }; };
export function condOk(c: X['cond'], url?: URL, now = new Date()): boolean {
  const t = vnParts(now);
  if (c.from && t.ms < Date.parse(c.from + ':00+07:00')) return false;
  if (c.to && t.ms > Date.parse(c.to + ':00+07:00')) return false;
  if (c.days.length && !c.days.includes(t.day)) return false;
  if (c.param) { const [k, v] = c.param.split('='); if (!url || (url.searchParams.get(k) ?? '') !== v) return false; }
  return true;
}

export function compileX(id: string, x: any, o: { edit?: boolean; url?: URL; fonts?: Set<string>; now?: Date; anim?: { used: boolean } } = {}): { cls: string; css: string; attrs: string; show: boolean } {
  const safeId = String(id).replace(/[^\w-]/g, ''), sel = `.pb-${safeId}`;
  const X: X = cleanX(x, true, x); // dữ liệu lưu đã sạch; chạy lại để chắc chắn (phòng dữ liệu cũ/sửa tay trong D1)
  const edit = !!o.edit;
  if (!edit && !condOk(X.cond, o.url, o.now)) return { cls: '', css: '', attrs: '', show: false };
  const parts: string[] = [];
  const d = decl(X.d, edit, o.fonts), t = decl(X.t, edit, o.fonts), m = decl(X.m, edit, o.fonts);
  if (d) parts.push(`${sel}{${d}}`);
  if (t) parts.push(`@media(max-width:${BP.t}px){${sel}{${t}}}`);
  if (m) parts.push(`@media(max-width:${BP.m}px){${sel}{${m}}}`);
  // Chữ trong khối kế thừa kiểu đã đặt ở khối (tiêu đề/đoạn có cỡ chữ riêng nên cần inherit); không đụng tới các khối con lồng bên trong
  const inh: string[] = [], all3 = [X.d, X.t, X.m], has = (k: string) => all3.some((r) => r[k] !== undefined);
  if (has('color')) inh.push('color'); if (has('font')) inh.push('font-family'); if (has('fs')) inh.push('font-size'); if (has('fw')) inh.push('font-weight'); if (has('lh')) inh.push('line-height'); if (has('ls')) inh.push('letter-spacing');
  if (inh.length) parts.push(`${sel} :is(h1,h2,h3,h4,p,li,b,small,summary,label,.b-h,.b-sub):not(${sel} .blk *){${inh.map((k) => k + ':inherit').join(';')}}`);
  if (X.css) { const sc = scopeCss(X.css, sel); if (sc.css) parts.push(sc.css); }
  const cls = [`pb-${safeId}`, X.cls, X.fx.anim ? `pb-a pb-a-${X.fx.anim}` : '', X.fx.hover ? `pb-h-${X.fx.hover}` : ''].filter(Boolean).join(' ');
  if (X.fx.anim && o.anim) o.anim.used = true;
  const st = X.fx.anim ? ` style="--pbd:${X.fx.delay}s;--pbt:${X.fx.dur}s"` : '';
  return { cls, css: parts.join(''), attrs: (X.anchor ? ` id="${X.anchor}"` : '') + st, show: true };
}

// ===== CSS tùy chỉnh: chỉ cho quy tắc thường và @media; đóng phạm vi vào đúng khối; chặn url() ngoài https, @import, expression, position:fixed… =====
const BAD = /@import|@charset|@font-face|@namespace|@keyframes|@-|expression\s*\(|javascript:|vbscript:|behavior\s*:|-moz-binding|<|>|\\|\/\*|position\s*:\s*fixed/i;
function okDecls(body: string): string {
  const out: string[] = [];
  for (const raw of body.split(';')) {
    const i = raw.indexOf(':'); if (i < 1) continue;
    const p = raw.slice(0, i).trim().toLowerCase(), v = raw.slice(i + 1).trim();
    if (!/^[a-z-]{2,40}$/.test(p) || !v || BAD.test(p + ':' + v)) continue;
    if (/url\s*\(/i.test(v) && !/^[^()]*url\(\s*['"]?https:\/\/[^'")\s]+['"]?\s*\)[^()]*$/i.test(v)) continue;
    if (/\bimage-set\b|\bsrc\s*\(/i.test(v)) continue;
    out.push(`${p}:${v}!important`);
  }
  return out.join(';');
}
export function scopeCss(css: string, scope: string, depth = 0): { css: string; dropped: number } {
  let src = String(css || '').slice(0, 8000).replace(/\/\*[\s\S]*?\*\//g, '');
  let out = '', dropped = 0, i = 0;
  src = src.replace(/@[a-z-]+[^{};]*;/gi, () => { dropped++; return ' '; }); // @import, @charset… (khai báo kết thúc bằng ;) bị bỏ riêng, không kéo theo quy tắc kế bên
  while (i < src.length) {
    const b = src.indexOf('{', i); if (b < 0) { if (src.slice(i).trim()) dropped++; break; }
    const head = src.slice(i, b).trim();
    let lvl = 1, j = b + 1; while (j < src.length && lvl) { if (src[j] === '{') lvl++; else if (src[j] === '}') lvl--; j++; }
    if (lvl) { dropped++; break; }
    const body = src.slice(b + 1, j - 1); i = j;
    if (head.startsWith('@')) {
      if (depth === 0 && /^@media\s*[\w\s():,.\-/]+$/i.test(head)) { const r = scopeCss(body, scope, 1); dropped += r.dropped; if (r.css) out += `${head}{${r.css}}`; } else dropped++;
      continue;
    }
    const sels = head.split(',').map((s) => s.trim()).filter(Boolean);
    if (!sels.length || sels.some((s) => !/^[\w\s.#>+~*:[\]="'()^$|&-]+$/.test(s) || BAD.test(s) || /(^|[\s>+~(])(html|body)\b|:root/i.test(s))) { dropped++; continue; }
    const d = okDecls(body); if (!d) { dropped++; continue; }
    out += sels.map((s) => (s.startsWith('&') ? scope + s.slice(1) : `${scope} ${s}`)).join(',') + `{${d}}`;
  }
  return { css: out, dropped };
}

// CSS hoạt ảnh/hover dùng chung của trang (nhỏ, chỉ được chèn khi có khối dùng hiệu ứng)
export const FX_CSS = '.pb-js .pb-a{opacity:0;transition:opacity var(--pbt,.6s) ease var(--pbd,0s),transform var(--pbt,.6s) ease var(--pbd,0s)}.pb-js .pb-a-up{transform:translateY(24px)}.pb-js .pb-a-left{transform:translateX(-28px)}.pb-js .pb-a-right{transform:translateX(28px)}.pb-js .pb-a-zoom{transform:scale(.94)}.pb-js .pb-a.pb-in{opacity:1;transform:none}.pb-h-lift,.pb-h-zoom,.pb-h-glow{transition:transform .25s ease,box-shadow .25s ease}.pb-h-lift:hover{transform:translateY(-4px)}.pb-h-zoom:hover{transform:scale(1.03)}.pb-h-glow:hover{box-shadow:0 0 0 4px color-mix(in srgb,var(--green) 25%,transparent),0 10px 28px rgba(0,0,0,.14)}@media(prefers-reduced-motion:reduce){.pb-js .pb-a{opacity:1!important;transform:none!important;transition:none!important}}';
export const FX_JS = "(function(){var d=document.documentElement;d.classList.add('pb-js');var a=[].slice.call(document.querySelectorAll('.pb-a'));if(!('IntersectionObserver' in window)){a.forEach(function(e){e.classList.add('pb-in')});return}var o=new IntersectionObserver(function(l){l.forEach(function(x){if(x.isIntersecting){x.target.classList.add('pb-in');o.unobserve(x.target)}})},{threshold:.12});a.forEach(function(e){o.observe(e)})})()";
