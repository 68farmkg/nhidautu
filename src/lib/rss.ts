// Danh sách nguồn RSS lấy từ file NHIP V3 (_worker.js)
export const FEEDS: Record<string, { name: string; url: string }> = {
  'cafef-ck': { name: 'CafeF · Thị trường chứng khoán', url: 'https://cafef.vn/thi-truong-chung-khoan.rss' },
  'cafef-dn': { name: 'CafeF · Doanh nghiệp', url: 'https://cafef.vn/doanh-nghiep.rss' },
  'cafef-vm': { name: 'CafeF · Vĩ mô, đầu tư', url: 'https://cafef.vn/vi-mo-dau-tu.rss' },
  'cafef-tc': { name: 'CafeF · Tài chính, ngân hàng', url: 'https://cafef.vn/tai-chinh-ngan-hang.rss' },
  'cafef-bds': { name: 'CafeF · Bất động sản', url: 'https://cafef.vn/bat-dong-san.rss' },
  'vietstock-ck': { name: 'Vietstock · Chứng khoán', url: 'https://vietstock.vn/144/chung-khoan.rss' },
  'vietstock-cp': { name: 'Vietstock · Cổ phiếu', url: 'https://vietstock.vn/830/chung-khoan/co-phieu.rss' },
  'vietstock-dn': { name: 'Vietstock · Doanh nghiệp', url: 'https://vietstock.vn/733/doanh-nghiep.rss' },
  'vietstock-hdkd': { name: 'Vietstock · Hoạt động kinh doanh', url: 'https://vietstock.vn/737/doanh-nghiep/hoat-dong-kinh-doanh.rss' },
  'vietstock-np': { name: 'Vietstock · Nhận định, phân tích', url: 'https://vietstock.vn/579/nhan-dinh-phan-tich.rss' },
  'vietstock-vm': { name: 'Vietstock · Vĩ mô', url: 'https://vietstock.vn/761/kinh-te/vi-mo.rss' },
  'vietstock-tg': { name: 'Vietstock · Thế giới', url: 'https://vietstock.vn/736/the-gioi.rss' },
  'vietstock-tc': { name: 'Vietstock · Tài chính', url: 'https://vietstock.vn/734/tai-chinh.rss' },
  'vneconomy-ck': { name: 'VnEconomy · Chứng khoán', url: 'https://vneconomy.vn/chung-khoan.rss' },
  'vneconomy-dn': { name: 'VnEconomy · Doanh nghiệp', url: 'https://vneconomy.vn/doanh-nghiep.rss' },
  'vneconomy-tc': { name: 'VnEconomy · Tài chính', url: 'https://vneconomy.vn/tai-chinh.rss' },
  'baodautu-ck': { name: 'Báo Đầu tư · Tài chính chứng khoán', url: 'https://baodautu.vn/tai-chinh-chung-khoan.rss' },
  'baodautu-dn': { name: 'Báo Đầu tư · Thông tin doanh nghiệp', url: 'https://baodautu.vn/thong-tin-doanh-nghiep.rss' },
  'vietnambiz-ck': { name: 'VietnamBiz · Chứng khoán', url: 'https://vietnambiz.vn/chung-khoan.rss' },
  'vietnambiz-dn': { name: 'VietnamBiz · Doanh nghiệp', url: 'https://vietnambiz.vn/doanh-nghiep.rss' },
  'ndh-ck': { name: 'Người Đồng Hành · Chứng khoán', url: 'https://ndh.vn/chung-khoan.rss' },
  'vnexpress-kd': { name: 'VnExpress · Kinh doanh', url: 'https://vnexpress.net/rss/kinh-doanh.rss' },
  'tuoitre-kd': { name: 'Tuổi Trẻ · Kinh doanh', url: 'https://tuoitre.vn/rss/kinh-doanh.rss' },
  'thanhnien-kd': { name: 'Thanh Niên · Kinh tế', url: 'https://thanhnien.vn/rss/kinh-te.rss' },
  'dantri-kd': { name: 'Dân Trí · Kinh doanh', url: 'https://dantri.com.vn/rss/kinh-doanh.rss' },
  'vietnamnet-kd': { name: 'VietnamNet · Kinh doanh', url: 'https://vietnamnet.vn/rss/kinh-doanh.rss' },
};

export type Item = { title: string; link: string; date: string; desc: string; image: string; source: string };

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = (s: string) => {
  for (let i = 0; i < 3; i++) {
    s = s.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e) => {
      if (e[0] === '#') { const c = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return c ? String.fromCodePoint(c) : m; }
      return ENT[e.toLowerCase()] ?? m;
    });
  }
  return s;
};
const unCdata = (s: string) => s.replace(/^\s*<!\[CDATA\[/, '').replace(/\]\]>\s*$/, '');
const tag = (x: string, t: string) => { const m = x.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`, 'i')); return m ? unCdata(m[1]).trim() : ''; };
const strip = (h: string) => decode(h.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

export function parseRss(xml: string, source: string, limit = 20): Item[] {
  const items: Item[] = [];
  for (const m of xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)) {
    const x = m[0];
    const rawDesc = tag(x, 'description') || tag(x, 'content:encoded');
    const img = (x.match(/<enclosure[^>]+url="([^"]+)"/i) || x.match(/<media:content[^>]+url="([^"]+)"/i) || decode(rawDesc).match(/<img[^>]+src="([^"]+)"/i) || [])[1] || '';
    const title = strip(tag(x, 'title'));
    const link = decode(tag(x, 'link')).trim();
    if (!title || !/^https?:\/\//.test(link)) continue;
    items.push({ title, link, date: tag(x, 'pubDate'), desc: strip(rawDesc).slice(0, 500), image: /^https:\/\//.test(img) ? img : '', source });
    if (items.length >= limit) break;
  }
  return items;
}

export async function getFeed(key: string, limit = 20, timeout = 8000): Promise<Item[]> {
  const f = FEEDS[key];
  if (!f) return [];
  const r = await fetch(f.url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NHIP/2.0)', Accept: '*/*' }, signal: AbortSignal.timeout(timeout), cf: { cacheTtl: 300, cacheEverything: true } } as any);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return parseRss(await r.text(), f.name, limit);
}
