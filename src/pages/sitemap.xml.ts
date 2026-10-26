import type { APIRoute } from 'astro';
import { all } from '../lib/util';
import { pbCfg } from '../lib/pb/cfg';
import { getCats, listTerms } from '../lib/terms';

// sitemap.xml tự động (chỉ khi plugin Page Builder Pro đang bật): trang chủ, trang đã xuất bản (trừ noindex), bài viết, chuyên mục.
const x = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const GET: APIRoute = async ({ locals, url }) => {
  const db = (locals as any).runtime.env.DB;
  if (!(await pbCfg(db)).on) return new Response('Not found', { status: 404 });
  const o = url.origin, rows: [string, string][] = [[o + '/', '']];
  for (const k of Object.keys(await getCats(db))) rows.push([`${o}/chuyen-muc/${k}`, '']);
  try {
    for (const p of await all(db, "SELECT p.slug,p.updated_at,m.meta FROM pages p LEFT JOIN px_page_builder_meta m ON m.page_id=p.id WHERE p.status='published' AND p.is_template=0 LIMIT 2000")) {
      let ni = false; try { ni = !!JSON.parse(p.meta || '{}').noindex; } catch { /* bỏ */ }
      if (!ni) rows.push([`${o}/${p.slug}`, p.updated_at || '']);
    }
    for (const p of await all(db, "SELECT slug,published_at FROM posts WHERE status='published' AND published_at <= ? ORDER BY published_at DESC LIMIT 5000", new Date().toISOString())) rows.push([`${o}/bai-viet/${p.slug}`, p.published_at || '']);
    for (const t of await listTerms(db, 'tag')) if (t.n > 0) rows.push([`${o}/the/${t.slug}`, '']);
  } catch { /* chưa có bảng: vẫn trả danh sách cơ bản */ }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${rows.map(([l, m]) => `<url><loc>${x(l)}</loc>${m ? `<lastmod>${x(String(m).slice(0, 10))}</lastmod>` : ''}</url>`).join('')}</urlset>`;
  return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=0, s-maxage=300' } });
};
