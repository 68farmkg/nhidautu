// Đăng nhập: chủ website (mật khẩu ADMIN_PASSWORD, uid=0) và người dùng trong bảng users.
// Phiên là chuỗi ký HMAC-SHA256, hết hạn sau 14 ngày.
const enc = new TextEncoder();
const b64 = (buf: ArrayBuffer | Uint8Array) => { let s = ''; new Uint8Array(buf as ArrayBuffer).forEach((c) => (s += String.fromCharCode(c))); return btoa(s); };
const b64u = (buf: ArrayBuffer | Uint8Array) => b64(buf).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

export type Session = { uid: number; role: string; name: string; exp: number };

async function hkey(env: any) {
  return crypto.subtle.importKey('raw', enc.encode(`${env.SESSION_SECRET || 'nhip'}|${env.ADMIN_PASSWORD || ''}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}
export async function makeSession(env: any, s: { uid: number; role: string; name: string }, ttl = 14 * 86400) {
  const payload = b64u(enc.encode(JSON.stringify({ ...s, exp: Math.floor(Date.now() / 1000) + ttl })));
  const sig = await crypto.subtle.sign('HMAC', await hkey(env), enc.encode(payload));
  return payload + '.' + b64u(sig);
}
export async function readSession(env: any, tok?: string): Promise<Session | null> {
  try {
    if (!tok || !env.ADMIN_PASSWORD) return null;
    const [p, sig] = tok.split('.'); if (!p || !sig) return null;
    const good = b64u(await crypto.subtle.sign('HMAC', await hkey(env), enc.encode(p)));
    if (!safeEq(good, sig)) return null;
    const s = JSON.parse(new TextDecoder().decode(unb64(p)));
    if (!s || typeof s.uid !== 'number' || typeof s.role !== 'string' || s.exp < Date.now() / 1000) return null;
    return s as Session;
  } catch { return null; }
}
// So sánh chuỗi không lộ độ dài khớp (đủ dùng cho mật khẩu và chữ ký)
export function safeEq(a: string, b: string) {
  const x = enc.encode(String(a)), y = enc.encode(String(b)); let d = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) d |= (x[i] || 0) ^ (y[i] || 0);
  return d === 0;
}
// Băm mật khẩu người dùng: PBKDF2-SHA256, 100.000 vòng (mức tối đa Cloudflare cho phép)
async function derive(pw: string, salt: Uint8Array) {
  const k = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as any, iterations: 100000 }, k, 256);
}
export async function hashPw(pw: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return b64(salt) + '$' + b64(await derive(pw, salt));
}
export async function verifyPw(pw: string, stored: string) {
  try { const [s, h] = String(stored).split('$'); return safeEq(b64(await derive(pw, unb64(s))), h); } catch { return false; }
}
