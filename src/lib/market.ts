import { all, run, first, nowIso } from './util';
import { nhipFetch, nhipEnv } from './nhip-data';

const UA = 'Mozilla/5.0 (compatible; NHIP/2.0)';

// Mã trong bảng của mình -> mã VNDirect dùng cho biểu đồ (giống file V3)
export const dsym = (s: string) => {
  const x = s.toUpperCase().replace(/-/g, '');
  if (x === 'HNXINDEX') return 'HNX';
  if (x === 'UPCOMINDEX') return 'UPCOM';
  return x;
};

export const fmtVol = (v: number) => (v >= 1e6 ? (v / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + ' triệu' : v >= 1e3 ? (v / 1e3).toLocaleString('vi-VN', { maximumFractionDigits: 0 }) + ' nghìn' : String(v || ''));

// Lấy giá đóng cửa gần nhất và % so với phiên trước từ nến ngày VNDirect DChart
export async function fetchQuote(symbol: string) {
  const to = Math.floor(Date.now() / 1000);
  const qs = new URLSearchParams({ symbol: dsym(symbol), resolution: 'D', from: String(to - 12 * 86400), to: String(to + 60) });
  let j: any = null;
  if (nhipEnv()) { // kho hub trước (giống nhip-19); không có thì xuống nguồn gốc
    try { const h = await nhipFetch('/proxy/dchart?' + qs); if (h.ok) j = await h.json(); } catch { /* dùng nguồn gốc */ }
    if (!(j && j.s === 'ok' && Array.isArray(j.c) && j.c.length)) j = null;
  }
  if (!j) {
    const r = await fetch('https://dchart-api.vndirect.com.vn/dchart/history?' + qs, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(12000) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    j = await r.json();
  }
  if (j.s !== 'ok' || !Array.isArray(j.c) || !j.c.length) throw new Error('không có dữ liệu');
  const n = j.c.length;
  const price = Number(j.c[n - 1]);
  const prev = Number(n > 1 ? j.c[n - 2] : j.c[n - 1]);
  return { price, pct: prev ? ((price - prev) / prev) * 100 : 0, vol: j.v ? fmtVol(Number(j.v[n - 1])) : '' };
}

// Tra tên, sàn, ngành của một mã từ FinInfo VNDirect
export async function fetchInfo(code: string) {
  const qs = '?' + new URLSearchParams({ q: `code:${code}`, fields: 'code,companyName,shortName,floor,industryName', size: '1' });
  for (const h of ['https://finfo-api.vndirect.com.vn/v4/stocks', 'https://api-finfo.vndirect.com.vn/v4/stocks']) {
    try {
      const r = await fetch(h + qs, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(10000) });
      if (!r.ok) continue;
      const d = ((await r.json()) as any)?.data?.[0];
      if (d) return { name: d.shortName || d.companyName || code, exchange: d.floor || 'HOSE', sector: d.industryName || '' };
    } catch { /* thử máy chủ tiếp theo */ }
  }
  return null;
}

// Cập nhật giá cho các mã cũ nhất trước (tối đa 40 mã mỗi lần để không vượt giới hạn của Cloudflare)
export async function refreshQuotes(db: any, only?: string) {
  const rows = only
    ? await all(db, 'SELECT symbol FROM quotes WHERE symbol=?', only)
    : await all(db, 'SELECT symbol FROM quotes ORDER BY COALESCE(updated_at,\'\') ASC LIMIT 40');
  let ok = 0;
  const errors: string[] = [];
  for (let i = 0; i < rows.length; i += 5) {
    await Promise.all(rows.slice(i, i + 5).map(async (r) => {
      try {
        const q = await fetchQuote(r.symbol);
        await run(db, 'UPDATE quotes SET price=?, change_pct=?, volume=COALESCE(NULLIF(?,\'\'),volume), updated_at=? WHERE symbol=?', q.price, Math.round(q.pct * 100) / 100, q.vol, nowIso(), r.symbol);
        ok++;
      } catch (e: any) { errors.push(`${r.symbol}: ${e?.message || e}`); }
    }));
  }
  return { ok, fail: errors.length, errors };
}

// Chỉ làm mới nếu lần trước cách đây hơn `minutes` phút (dùng cho cập nhật tự động khi có người xem web)
export async function refreshIfStale(db: any, minutes = 5) {
  const k = await first(db, "SELECT v FROM kv WHERE k='last_quote_refresh'");
  if (k && Date.now() - Number(k.v) < minutes * 60000) return { updated: false };
  await run(db, "INSERT INTO kv (k,v) VALUES ('last_quote_refresh',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v", String(Date.now()));
  const r = await refreshQuotes(db);
  return { updated: r.ok > 0 };
}
