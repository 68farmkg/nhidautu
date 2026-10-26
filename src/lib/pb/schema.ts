// Page Builder Pro: tài liệu trang (JSON) + kiểm tra schema trước khi lưu.
// Tài liệu = { v:1, title, slug, blocks[], side[], meta{}, seo{}, show_header, show_footer, is_template }.
// blocks dùng ĐÚNG định dạng cây khối của hệ thống cũ (cột pages.blocks) nên trang cũ mở được ngay và không mất dữ liệu.
import { cleanBlocks, parseBlocks, type Block, type BlockDef } from '../blocks';
import { slugify } from '../util';
import { scopeCss } from './css';

export const DOC_V = 1;
export const LAYOUTS: Record<string, string> = { full: 'Toàn chiều rộng', boxed: 'Khung hẹp (boxed)', 'side-left': 'Thanh bên trái', 'side-right': 'Thanh bên phải' };
export const SCHEMA_TYPES: Record<string, string> = { WebPage: 'Trang thường (WebPage)', Article: 'Bài phân tích (Article)', CollectionPage: 'Danh sách (CollectionPage)', AboutPage: 'Giới thiệu (AboutPage)', ContactPage: 'Liên hệ (ContactPage)', FAQPage: 'Hỏi đáp (FAQPage)', None: 'Không thêm schema' };
export type PageMeta = { layout: string; showTitle: boolean; accent: string; noindex: boolean; canonical: string; schemaType: string; ogTitle: string; css: string; cat: number };
export type Doc = { v: 1; title: string; slug: string; blocks: Block[]; side: Block[]; meta: PageMeta; seo: { title: string; desc: string; image: string }; show_header: boolean; show_footer: boolean; is_template: boolean };
export const DEFAULT_META: PageMeta = { layout: 'full', showTitle: false, accent: '', noindex: false, canonical: '', schemaType: 'WebPage', ogTitle: '', css: '', cat: 0 };
export const RESERVED = ['admin', 'api', 'bai-viet', 'chuyen-muc', 'co-phieu', 'thi-truong', 'tin-tuc', 'tim-kiem', 'lien-he', 'favicon.svg', 'preview.js', 'builder.js', 'chat.js', '_astro', 'sitemap.xml', 'robots.txt', 'pb.js', 'pb-canvas.js', 'pb.css'];
export const MAX_JSON = 700000;

const httpsOrEmpty = (s: any) => (/^https:\/\/[^\s<>"']{1,500}$/i.test(String(s || '').trim()) ? String(s).trim() : '');
const colOrEmpty = (s: any) => (/^#[0-9a-f]{3,8}$/i.test(String(s || '').trim()) ? String(s).trim() : '');

export function cleanMeta(m: any, admin: boolean, old?: Partial<PageMeta>): PageMeta {
  const r = m && typeof m === 'object' ? m : {};
  return {
    layout: r.layout in LAYOUTS ? r.layout : 'full', showTitle: !!r.showTitle, accent: colOrEmpty(r.accent), noindex: !!r.noindex,
    canonical: httpsOrEmpty(r.canonical), schemaType: r.schemaType in SCHEMA_TYPES ? r.schemaType : 'WebPage', ogTitle: String(r.ogTitle || '').slice(0, 120),
    css: admin ? String(r.css || '').slice(0, 8000) : String(old?.css || '').slice(0, 8000),
    cat: Number.isInteger(Number(r.cat)) && Number(r.cat) > 0 && Number(r.cat) < 1e9 ? Number(r.cat) : 0, // danh mục trang (máy chủ kiểm tra tồn tại khi lưu)
  };
}

export const countBlocks = (a: Block[]): number => (a || []).reduce((n, b) => n + 1 + countBlocks(b.children || []) + (b.cols || []).reduce((m, c) => m + countBlocks(c || []), 0), 0);
export function walkBlocks(a: Block[], fn: (b: Block) => void) { for (const b of a || []) { if (!b) continue; fn(b); walkBlocks(b.children || [], fn); for (const c of b.cols || []) walkBlocks(c || [], fn); } }

export function emptyDoc(): Doc {
  return { v: 1, title: '', slug: '', blocks: [], side: [], meta: { ...DEFAULT_META }, seo: { title: '', desc: '', image: '' }, show_header: true, show_footer: true, is_template: false };
}
// Dựng Doc từ một dòng bảng pages (+ meta Pro nếu có). Trang cũ chưa có meta vẫn mở bình thường.
export function docFromPage(page: any, metaRow?: any): Doc {
  let meta: any = {}, side: any = [];
  try { meta = JSON.parse(metaRow?.meta || '{}'); } catch { /* bỏ */ }
  try { side = JSON.parse(metaRow?.side || '[]'); } catch { /* bỏ */ }
  return {
    v: 1, title: String(page?.title || ''), slug: String(page?.slug || ''), blocks: parseBlocks(page?.blocks), side: Array.isArray(side) ? side : [],
    meta: cleanMeta(meta, true, meta), seo: { title: String(page?.seo_title || ''), desc: String(page?.seo_desc || ''), image: String(page?.seo_image || '') },
    show_header: page ? !!page.show_header : true, show_footer: page ? !!page.show_footer : true, is_template: !!page?.is_template,
  };
}

export type VOpts = { admin: boolean; old?: Doc | null; defs: Record<string, BlockDef>; known: Record<string, BlockDef> };
export type VResult = { ok: true; doc: Doc; warnings: string[]; errors?: undefined } | { ok: false; errors: string[]; doc?: undefined; warnings?: undefined };

export function validateDoc(raw: any, o: VOpts): VResult {
  const errors: string[] = [], warnings: string[] = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, errors: ['Dữ liệu trang phải là một đối tượng JSON'] };
  if (raw.v !== undefined && raw.v !== DOC_V) errors.push(`Phiên bản dữ liệu trang không hỗ trợ: ${String(raw.v).slice(0, 10)}`);
  const title = String(raw.title || '').trim().slice(0, 200);
  if (!title) errors.push('Hãy nhập tên trang.');
  if (!Array.isArray(raw.blocks)) errors.push('blocks phải là một mảng');
  if (raw.side !== undefined && !Array.isArray(raw.side)) errors.push('side phải là một mảng');
  if (errors.length) return { ok: false, errors };
  const old = o.old || null;
  const blocks = cleanBlocks(raw.blocks, { admin: o.admin, old: old?.blocks, defs: o.defs, known: o.known });
  const side = cleanBlocks(raw.side || [], { admin: o.admin, old: old?.side, defs: o.defs, known: o.known });
  const nIn = countBlocks(raw.blocks) + countBlocks(raw.side || []), nOut = countBlocks(blocks) + countBlocks(side);
  if (nOut < nIn) warnings.push(`${nIn - nOut} khối không hợp lệ hoặc không đủ quyền đã bị bỏ`);
  if (JSON.stringify(blocks).length > MAX_JSON || JSON.stringify(side).length > MAX_JSON) return { ok: false, errors: ['Trang quá lớn (hơn 700 KB). Hãy tách thành nhiều trang.'] };
  if (!o.admin && old) { // khối bị khóa không được xóa
    const keep = new Set<string>(); walkBlocks([...blocks, ...side], (b) => keep.add(b.id));
    const lost: string[] = []; walkBlocks([...old.blocks, ...old.side], (b) => { if ((b.style as any)?.x?.lock === 'admin' && !keep.has(b.id)) lost.push(b.type); });
    if (lost.length) return { ok: false, errors: [`Có ${lost.length} khối bị khóa (chỉ quản trị viên được xóa), không thể xóa.`] };
  }
  let slug = slugify(String(raw.slug || '') || title);
  if (RESERVED.includes(slug)) { slug += '-trang'; warnings.push('Đường dẫn trùng với đường dẫn hệ thống nên đã thêm “-trang”'); }
  const seo = raw.seo && typeof raw.seo === 'object' ? raw.seo : {};
  const meta = cleanMeta(raw.meta, o.admin, old?.meta);
  if (meta.css) { const r = scopeCss(meta.css, '.pb-page'); if (r.dropped) warnings.push(`${r.dropped} quy tắc CSS của trang không an toàn và sẽ bị bỏ khi hiển thị`); }
  const doc: Doc = {
    v: 1, title, slug, blocks, side, meta,
    seo: { title: String(seo.title || '').slice(0, 120), desc: String(seo.desc || '').slice(0, 300), image: httpsOrEmpty(seo.image) },
    show_header: raw.show_header !== false, show_footer: raw.show_footer !== false, is_template: !!raw.is_template,
  };
  if (String(seo.image || '').trim() && !doc.seo.image) warnings.push('Ảnh chia sẻ phải bắt đầu bằng https:// nên đã bị bỏ');
  return { ok: true, doc, warnings };
}
