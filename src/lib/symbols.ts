// Danh bạ mã chứng khoán 3 sàn (HOSE, HNX, UPCoM) cho bảng quotes.
// Danh sách mã: /proxy/stocks (VNDirect FinInfo, qua kho hub nhip-18). Giá cả sàn: /proxy/market (SSI iBoard) - cùng nguồn nhip-19.
import { nhipFetch } from './nhip-data';
import { nowIso } from './util';
import { fmtVol } from './market';

export const EXCH = ['HOSE', 'HNX', 'UPCOM'] as const;
const normFloor = (f: any) => {
  const x = String(f || '').toUpperCase().replace(/[^A-Z]/g, '');
  return x === 'HOSE' || x === 'HSX' ? 'HOSE' : x === 'HNX' ? 'HNX' : x === 'UPCOM' ? 'UPCOM' : '';
};
const chunks = <T,>(a: T[], n: number) => { const o: T[][] = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };

// 1) Đồng bộ DANH SÁCH mã (tên, sàn, ngành) của cả 3 sàn. Không đụng giá, không đụng chỉ số, không ghi lại dòng không đổi.
export async function syncListing(db: any) {
  const r = await nhipFetch('/proxy/stocks');
  if (!r.ok) throw new Error('Không lấy được danh sách mã (HTTP ' + r.status + ')');
  const j: any = await r.json();
  const rows: any[] = Array.isArray(j?.data) ? j.data : [];
  const list: { code: string; name: string; ex: string; sector: string }[] = [];
  const seen = new Set<string>();
  for (const x of rows) {
    const code = String(x.code || '').toUpperCase();
    const ex = normFloor(x.floor);
    if (!/^[A-Z0-9.]{2,12}$/.test(code) || !ex || seen.has(code)) continue;
    seen.add(code);
    list.push({ code, name: String(x.shortName || x.companyName || code).slice(0, 120), ex, sector: String(x.industryName || '').slice(0, 80) });
  }
  if (!list.length) throw new Error('Nguồn trả về danh sách rỗng.');
  const cnt = async () => Number(((await db.prepare("SELECT COUNT(*) n FROM quotes WHERE kind='stock'").first()) as any)?.n || 0);
  const before = await cnt();
  const st = db.prepare(`INSERT INTO quotes (symbol,name,kind,exchange,sector) VALUES (?1,?2,'stock',?3,?4)
    ON CONFLICT(symbol) DO UPDATE SET
      exchange = excluded.exchange,
      name = CASE WHEN quotes.name IS NULL OR quotes.name = '' OR quotes.name = quotes.symbol THEN excluded.name ELSE quotes.name END,
      sector = CASE WHEN quotes.sector IS NULL OR quotes.sector = '' THEN excluded.sector ELSE quotes.sector END
    WHERE quotes.kind = 'stock' AND (quotes.exchange IS NOT excluded.exchange OR quotes.name IS NULL OR quotes.name = '' OR quotes.name = quotes.symbol OR quotes.sector IS NULL OR quotes.sector = '')`);
  for (const c of chunks(list, 100)) await db.batch(c.map((x) => st.bind(x.code, x.name, x.ex, x.sector)));
  const after = await cnt();
  const per: Record<string, number> = { HOSE: 0, HNX: 0, UPCOM: 0 };
  list.forEach((x) => per[x.ex]++);
  return { total: list.length, added: Math.max(0, after - before), per };
}

// 2) Cập nhật GIÁ cả sàn từ bảng giá SSI iBoard (1 lượt/sàn, không phải gọi từng mã).
const num = (o: any, keys: string[]) => { for (const k of keys) { const v = o?.[k]; if (v != null && v !== '' && Number.isFinite(Number(v))) return Number(v); } return null; };
const str = (o: any, keys: string[]) => { for (const k of keys) { const v = o?.[k]; if (typeof v === 'string' && v) return v; } return ''; };

export async function syncBoard(db: any, ex: string) {
  const out = { ex, ok: false, msg: '', rows: 0, matched: 0, unit: '' };
  let j: any;
  try {
    const r = await nhipFetch('/proxy/market?ex=' + ex.toLowerCase());
    if (!r.ok) { out.msg = 'HTTP ' + r.status; return out; }
    j = await r.json();
  } catch (e: any) { out.msg = String(e?.message || e); return out; }
  const arr: any[] = Array.isArray(j) ? j : Array.isArray(j?.data) ? j.data : Array.isArray(j?.data?.data) ? j.data.data : Array.isArray(j?.items) ? j.items : [];
  out.rows = arr.length;
  if (!arr.length) { out.msg = 'Nguồn không có bảng giá (khóa trả về: ' + Object.keys(j || {}).slice(0, 8).join(', ') + ')'; return out; }
  const recs: { s: string; p: number; pct: number; v: number }[] = [];
  for (const o of arr) {
    const s = String(str(o, ['stockSymbol', 'symbol', 'ss', 'code', 's']) || '').toUpperCase();
    if (!/^[A-Z0-9.]{2,12}$/.test(s)) continue;
    const ref = num(o, ['refPrice', 'referencePrice', 'basicPrice', 'r']);
    let p = num(o, ['matchedPrice', 'lastPrice', 'closePrice', 'price', 'mp']);
    if (!p) p = ref;
    if (!p) continue;
    let pct = num(o, ['priceChangePercent', 'changePercent', 'pctChange', 'cp']);
    if (pct == null) pct = ref ? ((p - ref) / ref) * 100 : 0;
    recs.push({ s, p, pct, v: num(o, ['nmTotalTradedQty', 'totalTradedQty', 'totalVolume', 'vol', 'v']) || 0 });
  }
  if (!recs.length) { out.msg = 'Không đọc được trường giá. Các khóa của dòng đầu: ' + Object.keys(arr[0] || {}).slice(0, 12).join(', '); return out; }
  // Đơn vị: website lưu cổ phiếu theo nghìn đồng. Nếu giá trung vị >= 1000 thì nguồn đang trả theo đồng.
  const sorted = recs.map((x) => x.p).sort((a, b) => a - b), med = sorted[Math.floor(sorted.length / 2)];
  const div = med >= 1000 ? 1000 : 1;
  out.unit = div === 1000 ? 'đồng → nghìn đồng' : 'nghìn đồng';
  const t = nowIso();
  const st = db.prepare("UPDATE quotes SET price=?1, change_pct=?2, volume=COALESCE(NULLIF(?3,''),volume), updated_at=?4 WHERE symbol=?5 AND kind='stock'");
  for (const c of chunks(recs, 100)) {
    const res: any[] = await db.batch(c.map((x) => st.bind(Math.round((x.p / div) * 100) / 100, Math.round(x.pct * 100) / 100, x.v ? fmtVol(x.v) : '', t, x.s)));
    out.matched += res.reduce((a, r) => a + Number(r?.meta?.changes || 0), 0);
  }
  out.ok = true;
  return out;
}
