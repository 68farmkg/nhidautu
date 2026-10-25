// Đọc ZIP tối giản, không phụ thuộc thư viện. Chỉ giải nén (deflate/stored), có giới hạn chống zip-bomb và đường dẫn độc.
export const ZIP_LIMITS = { files: 40, perFile: 200_000, total: 1_000_000, archive: 2_000_000 };
const td = new TextDecoder('utf-8', { fatal: false });
const u16 = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);
const u32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

async function inflate(data: Uint8Array, max: number): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw');
  const w = ds.writable.getWriter(); w.write(data as any).catch(() => {}); w.close().catch(() => {});
  const r = ds.readable.getReader(); const parts: Uint8Array[] = []; let n = 0;
  for (;;) { const { done, value } = await r.read(); if (done) break; n += value.length; if (n > max) { r.cancel().catch(() => {}); throw new Error('Tệp giải nén vượt giới hạn'); } parts.push(value); }
  const out = new Uint8Array(n); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out;
}
export const safeName = (n: string) => !(n.startsWith('/') || n.includes('..') || n.includes('\\') || n.includes('\0') || n.length > 120);

export async function readZip(buf: ArrayBuffer): Promise<Record<string, string>> {
  const b = new Uint8Array(buf);
  if (b.length > ZIP_LIMITS.archive) throw new Error('Gói ZIP quá lớn (tối đa 2 MB)');
  let e = -1; for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (u32(b, i) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error('Không phải tệp ZIP hợp lệ');
  const count = u16(b, e + 10); let p = u32(b, e + 16);
  if (count > ZIP_LIMITS.files * 3) throw new Error('ZIP có quá nhiều tệp');
  const out: Record<string, string> = {}; let total = 0, n = 0;
  for (let i = 0; i < count; i++) {
    if (u32(b, p) !== 0x02014b50) throw new Error('ZIP hỏng (thư mục trung tâm)');
    const flags = u16(b, p + 8), method = u16(b, p + 10), csize = u32(b, p + 20), usize = u32(b, p + 24), nl = u16(b, p + 28), xl = u16(b, p + 30), cl = u16(b, p + 32), lo = u32(b, p + 42);
    const name = td.decode(b.subarray(p + 46, p + 46 + nl)); p += 46 + nl + xl + cl;
    if (name.endsWith('/') || name.startsWith('__MACOSX/')) continue;
    if (flags & 1) throw new Error('Không hỗ trợ ZIP có mật khẩu');
    if (!safeName(name)) throw new Error('Đường dẫn tệp không an toàn: ' + name.slice(0, 60));
    if (++n > ZIP_LIMITS.files) throw new Error('ZIP có quá nhiều tệp (tối đa 40)');
    if (usize > ZIP_LIMITS.perFile) throw new Error(`Tệp ${name} quá lớn (tối đa 200 KB)`);
    if (u32(b, lo) !== 0x04034b50) throw new Error('ZIP hỏng (tiêu đề tệp)');
    const ds = lo + 30 + u16(b, lo + 26) + u16(b, lo + 28), raw = b.subarray(ds, ds + csize);
    if (ds + csize > b.length) throw new Error('ZIP hỏng (thiếu dữ liệu)');
    const data = method === 0 ? raw : method === 8 ? await inflate(raw, ZIP_LIMITS.perFile) : null;
    if (!data) throw new Error('Kiểu nén không hỗ trợ: ' + name);
    total += data.length; if (total > ZIP_LIMITS.total) throw new Error('Tổng dung lượng giải nén vượt 1 MB');
    out[name] = td.decode(data);
  }
  return out;
}
export async function sha256(s: string) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(h)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
