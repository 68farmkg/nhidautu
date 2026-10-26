// Gửi thư qua SMTP bằng TCP socket của Cloudflare Workers (cloudflare:sockets).
// Hỗ trợ cổng 465 (TLS ngay) và 587 (STARTTLS). Cổng 25 bị Cloudflare chặn nên không dùng.
const enc = new TextEncoder();
const dec = new TextDecoder();

const b64 = (s: string | Uint8Array) => {
  const u = typeof s === 'string' ? enc.encode(s) : s;
  let b = '';
  for (let i = 0; i < u.length; i += 0x2000) b += String.fromCharCode(...u.subarray(i, i + 0x2000));
  return btoa(b);
};
const wrap76 = (s: string) => (s.match(/.{1,76}/g) || ['']).join('\r\n');
const isAscii = (s: string) => /^[\x20-\x7e]*$/.test(s);

// Mã hóa tiêu đề/tên có dấu (RFC 2047), cắt từng đoạn <= 45 byte
export function encodeWords(s: string): string {
  if (isAscii(s)) return s;
  const parts: string[] = [];
  let cur = '';
  for (const ch of s) {
    if (enc.encode(cur + ch).length > 45) { parts.push(cur); cur = ''; }
    cur += ch;
  }
  if (cur) parts.push(cur);
  return parts.map((p) => `=?UTF-8?B?${b64(p)}?=`).join('\r\n ');
}

export type SmtpOpts = {
  host: string; port: number; user: string; pass: string;
  fromEmail: string; fromName?: string; to: string; replyTo?: string;
  subject: string; text: string; html: string;
  // chỉ dùng khi kiểm thử
  connectFn?: (addr: { hostname: string; port: number }, o: { secureTransport: 'on' | 'starttls' | 'off' }) => any;
};

export function buildMessage(o: SmtpOpts, domain: string): string {
  const boundary = 'nd_' + crypto.randomUUID().replace(/-/g, '');
  const from = o.fromName ? `${encodeWords(o.fromName.replace(/[<>"\r\n]/g, ''))} <${o.fromEmail}>` : o.fromEmail;
  const h = [
    `From: ${from}`,
    `To: <${o.to}>`,
    ...(o.replyTo ? [`Reply-To: <${o.replyTo}>`] : []),
    `Subject: ${encodeWords(o.subject)}`,
    `Date: ${new Date().toUTCString().replace('GMT', '+0000')}`,
    `Message-ID: <${crypto.randomUUID()}@${domain}>`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ].join('\r\n');
  const part = (type: string, body: string) =>
    `--${boundary}\r\nContent-Type: ${type}; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${wrap76(b64(body))}\r\n`;
  return `${h}\r\n\r\n${part('text/plain', o.text)}${part('text/html', o.html)}--${boundary}--\r\n`;
}

async function run(o: SmtpOpts): Promise<void> {
  let connect = o.connectFn as any;
  if (!connect) {
    try {
      const spec = 'cloudflare:sockets'; // biến để bước build không phụ thuộc module này
      connect = (await import(/* @vite-ignore */ spec)).connect;
    } catch { throw new Error('Môi trường này không hỗ trợ kết nối SMTP (cần chạy trên Cloudflare Workers/Pages).'); }
  }
  const implicit = o.port === 465;
  let socket = connect({ hostname: o.host, port: o.port }, { secureTransport: implicit ? 'on' : 'starttls' });
  let reader = socket.readable.getReader();
  let writer = socket.writable.getWriter();
  let buf = '';

  const readResp = async (): Promise<{ code: number; text: string }> => {
    for (;;) {
      const lines = buf.split('\r\n');
      const end = lines.findIndex((l, i) => i < lines.length - 1 && /^\d{3} /.test(l));
      if (end >= 0) {
        const got = lines.slice(0, end + 1);
        buf = lines.slice(end + 1).join('\r\n');
        return { code: Number(got[end].slice(0, 3)), text: got.map((l) => l.slice(4)).join(' | ') };
      }
      const { value, done } = await reader.read();
      if (done) throw new Error('Máy chủ SMTP đóng kết nối đột ngột.');
      buf += dec.decode(value, { stream: true });
    }
  };
  const send = (s: string) => writer.write(enc.encode(s));
  const cmd = async (line: string, ok: number[], secret = false) => {
    await send(line + '\r\n');
    const r = await readResp();
    if (!ok.includes(r.code)) throw new Error(`SMTP ${r.code}: ${secret ? '(đăng nhập bị từ chối) ' : ''}${r.text}`.slice(0, 220));
    return r;
  };

  try {
    let r = await readResp();
    if (r.code !== 220) throw new Error(`SMTP ${r.code}: ${r.text}`);
    const me = 'nhidautu.local';
    r = await cmd(`EHLO ${me}`, [250]);
    if (!implicit) {
      await cmd('STARTTLS', [220]);
      reader.releaseLock(); writer.releaseLock();
      socket = socket.startTls();
      reader = socket.readable.getReader(); writer = socket.writable.getWriter(); buf = '';
      r = await cmd(`EHLO ${me}`, [250]);
    }
    // Đăng nhập: PLAIN, nếu bị từ chối do không hỗ trợ thì thử LOGIN
    try {
      await cmd('AUTH PLAIN ' + b64(`\0${o.user}\0${o.pass}`), [235], true);
    } catch (e: any) {
      if (!/SMTP (50[4-9]|5[0-9]{2}|4[0-9]{2}): /.test(String(e.message)) || /535|534|454/.test(String(e.message))) throw e;
      await cmd('AUTH LOGIN', [334]);
      await cmd(b64(o.user), [334]);
      await cmd(b64(o.pass), [235], true);
    }
    await cmd(`MAIL FROM:<${o.fromEmail}>`, [250]);
    await cmd(`RCPT TO:<${o.to}>`, [250, 251]);
    await cmd('DATA', [354]);
    const msg = buildMessage(o, o.fromEmail.split('@')[1] || 'localhost').replace(/^\./gm, '..');
    await send(msg + '\r\n.\r\n');
    const end = await readResp();
    if (end.code !== 250) throw new Error(`SMTP ${end.code}: ${end.text}`);
    try { await send('QUIT\r\n'); } catch { /* bỏ qua */ }
  } finally {
    try { reader.releaseLock(); } catch { /* */ }
    try { writer.releaseLock(); } catch { /* */ }
    try { await socket.close(); } catch { /* */ }
  }
}

export async function smtpSend(o: SmtpOpts, timeoutMs = 25000): Promise<void> {
  let t: any;
  const timeout = new Promise<never>((_, rej) => { t = setTimeout(() => rej(new Error('Hết thời gian chờ máy chủ SMTP (kiểm tra máy chủ/cổng).')), timeoutMs); });
  try { await Promise.race([run(o), timeout]); } finally { clearTimeout(t); }
}
