// Render trang công khai của Page Builder Pro: bố cục, CSS đóng phạm vi, font, hiệu ứng, JSON-LD.
import { renderBlocks, parseBlocks, FX_CSS, FX_JS, type Block, type Ctx } from '../blocks';
import { esc } from '../esc';
import { scopeCss } from './css';
import { cleanMeta, DEFAULT_META, type PageMeta } from './schema';

export type PageOut = { html: string; head: string; meta: PageMeta; jsonld: string };
const jsonSafe = (o: any) => JSON.stringify(o).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028|\u2029/g, '');

export function jsonLd(p: { type: string; title: string; desc: string; image: string; url: string; site: string; published?: string; modified?: string }): string {
  if (p.type === 'None') return '';
  const base: any = { '@context': 'https://schema.org', '@type': p.type, name: p.title, url: p.url, inLanguage: 'vi' };
  if (p.desc) base.description = p.desc; if (p.image) base.image = p.image;
  base.isPartOf = { '@type': 'WebSite', name: p.site, url: new URL(p.url).origin };
  if (p.type === 'Article') { base.headline = p.title.slice(0, 110); base.publisher = { '@type': 'Organization', name: p.site }; if (p.published) base.datePublished = p.published; if (p.modified) base.dateModified = p.modified; }
  return jsonSafe(base);
}

// page = dòng bảng pages; metaRow = dòng px_page_builder_meta (có thể null: trang cũ)
export async function renderPage(db: any, page: any, metaRow: any, url: URL, o: { site?: string; edit?: boolean; blocks?: Block[]; side?: Block[]; meta?: any } = {}): Promise<PageOut> {
  let m: any = o.meta; let side: Block[] = o.side || [];
  if (!m) { try { m = JSON.parse(metaRow?.meta || '{}'); } catch { m = {}; } try { side = parseBlocks(metaRow?.side || '[]'); } catch { side = []; } }
  const meta = cleanMeta(m, true, m) || DEFAULT_META;
  const fonts = new Set<string>(), once = new Set<string>(), anim = { used: false };
  const ctx: Ctx = { db, url, fonts, once, anim, edit: !!o.edit };
  const blocks = o.blocks || parseBlocks(page?.blocks);
  const main = await renderBlocks(blocks, ctx, 0, 'root');
  const hasSide = meta.layout === 'side-left' || meta.layout === 'side-right';
  const aside = hasSide || o.edit ? await renderBlocks(side, ctx, 0, 'side') : '';
  const title = meta.showTitle && page?.title ? `<h1 class="pb-title">${esc(page.title)}</h1>` : '';
  const body = hasSide ? `<div class="pb-grid ${meta.layout}"><div class="pb-main">${main}</div><aside class="pb-side">${aside}</aside></div>` : `<div class="pb-main">${main}</div>`;
  const accent = meta.accent ? ` style="--green:${esc(meta.accent)}"` : '';
  const pcss = meta.css ? scopeCss(meta.css, '.pb-page').css : '';
  const html = `<div class="pb-page pb-l-${esc(meta.layout)}"${accent}><div class="wrap">${title}${body}</div></div>${pcss ? `<style>${pcss}</style>` : ''}${anim.used && !o.edit ? `<style>${FX_CSS}</style><script>${FX_JS}</script>` : ''}`;
  const gf = [...fonts].map((f) => `family=${f}`).join('&');
  const head = gf ? `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?${esc(gf)}&display=swap">` : '';
  const canon = meta.canonical || (page?.slug ? new URL('/' + page.slug, url.origin).toString() : '');
  const ld = canon ? jsonLd({ type: meta.schemaType, title: page?.seo_title || page?.title || '', desc: page?.seo_desc || '', image: page?.seo_image || '', url: canon, site: o.site || '', modified: page?.updated_at }) : '';
  return { html, head, meta, jsonld: ld };
}
