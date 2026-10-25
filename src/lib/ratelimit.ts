// Giới hạn tần suất đơn giản lưu trong bảng kv. Trả về true nếu còn được phép.
export async function allow(db: any, key: string, max: number, sec: number): Promise<boolean> {
  try {
    const now = Math.floor(Date.now() / 1000), k = 'rl:' + key.slice(0, 80);
    const r = await db.prepare('SELECT v FROM kv WHERE k=?').bind(k).first();
    let [n, t] = String(r?.v || '0|0').split('|').map(Number);
    if (!r || now - t > sec) { n = 0; t = now; }
    if (n >= max) return false;
    await db.prepare('INSERT INTO kv (k,v) VALUES (?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v').bind(k, `${n + 1}|${t}`).run();
    return true;
  } catch { return true; }
}
export async function clear(db: any, key: string) { try { await db.prepare('DELETE FROM kv WHERE k=?').bind('rl:' + key.slice(0, 80)).run(); } catch { /* bỏ */ } }
export const ipOf = (req: Request) => req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'ip';
