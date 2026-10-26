// Gửi email từ nhiều "hộp thư gửi": qua API (Resend, Brevo...), Gmail/Apps Script, hoặc SMTP (TCP socket Cloudflare, cổng 465/587).
import { all, first, run, nowIso } from './util';
import { smtpSend } from './smtp';

export const PROVIDERS: Record<string, { name: string; hint: string; free: string }> = {
  resend: { name: 'Resend', hint: 'Dán API key (re_...). Địa chỉ gửi phải thuộc tên miền đã xác minh ở Resend.', free: '3.000 thư/tháng miễn phí' },
  brevo: { name: 'Brevo (Sendinblue)', hint: 'Dán API key v3 (xkeysib-...). Người gửi cần được xác minh trong Brevo (dùng được cả Gmail đã xác minh).', free: '300 thư/ngày miễn phí' },
  sendgrid: { name: 'SendGrid', hint: 'Dán API key (SG....). Người gửi cần được xác minh (Single Sender hoặc tên miền).', free: 'dùng thử có hạn' },
  mailgun: { name: 'Mailgun', hint: 'Dán Private API key và điền Tên miền gửi (ví dụ mg.tenmien.vn). Máy chủ EU: ghi "eu" ở ô Thông tin thêm.', free: 'gói thử có hạn' },
  webhook: { name: 'Gmail / Google Apps Script (không cần tên miền)', hint: 'Gửi bằng chính Gmail của bạn qua Google Apps Script. Dán địa chỉ Web app vào ô "Địa chỉ webhook", mã bí mật vào ô API key. Xem mẫu mã bên dưới.', free: 'miễn phí (giới hạn của Gmail)' },
  smtp: { name: 'SMTP (Gmail, mail hosting...)', hint: 'Ô \"Máy chủ SMTP\": ví dụ smtp.gmail.com. Ô \"Cổng\": 465 (mặc định) hoặc 587; muốn dùng tên đăng nhập khác email gửi thì ghi 465|tendangnhap. Ô khóa: mật khẩu (Gmail: dùng Mật khẩu ứng dụng 16 ký tự). Cổng 25 không dùng được.', free: 'tùy nhà cung cấp (Gmail miễn phí, có giới hạn ngày)' },
};

export const APPS_SCRIPT = `function doPost(e) {
  var d = JSON.parse(e.postData.contents);
  if (d.secret !== 'DOI-MA-BI-MAT-NAY') return ContentService.createTextOutput('no');
  GmailApp.sendEmail(d.to, d.subject, d.text, { htmlBody: d.html, name: d.from_name, replyTo: d.reply_to });
  return ContentService.createTextOutput('ok');
}`;

export type Mailbox = { id: number; label: string; provider: string; from_name: string; from_email: string; reply_to: string; api_key: string; domain: string; extra: string; signature: string; is_default: number; active: number };

const clean = (s: any, n = 200) => String(s ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, n);
export const isEmail = (s: string) => /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]{2,}$/.test(s);
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const toHtml = (t: string) => `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#13292b">${esc(t).replace(/\n/g, '<br>')}</div>`;

export async function listMailboxes(db: any, onlyActive = false): Promise<Mailbox[]> {
  try { return await all(db, `SELECT * FROM mailboxes ${onlyActive ? 'WHERE active=1' : ''} ORDER BY is_default DESC, id`); } catch { return []; }
}
export async function getMailbox(db: any, id: number): Promise<Mailbox | null> {
  try {
    if (id) { const m = await first(db, 'SELECT * FROM mailboxes WHERE id=? AND active=1', id); if (m) return m; }
    return (await first(db, 'SELECT * FROM mailboxes WHERE active=1 ORDER BY is_default DESC, id LIMIT 1')) || null;
  } catch { return null; }
}
export async function saveMailbox(db: any, d: any) {
  const id = Number(d.id) || 0;
  const v = { label: clean(d.label, 60) || 'Hộp thư', provider: PROVIDERS[d.provider] ? d.provider : 'resend', from_name: clean(d.from_name, 80), from_email: clean(d.from_email, 120).toLowerCase(), reply_to: clean(d.reply_to, 120).toLowerCase(), domain: clean(d.domain, 200), extra: clean(d.extra, 200), signature: String(d.signature || '').slice(0, 1000), active: d.active ? 1 : 0, is_default: d.is_default ? 1 : 0 };
  if (!isEmail(v.from_email)) throw new Error('Địa chỉ email gửi chưa hợp lệ.');
  if (v.reply_to && !isEmail(v.reply_to)) throw new Error('Email nhận phản hồi chưa hợp lệ.');
  const key = String(d.api_key || '').trim().slice(0, 500);
  let rid = id;
  if (id) {
    await run(db, 'UPDATE mailboxes SET label=?,provider=?,from_name=?,from_email=?,reply_to=?,domain=?,extra=?,signature=?,active=?,is_default=? WHERE id=?', v.label, v.provider, v.from_name, v.from_email, v.reply_to, v.domain, v.extra, v.signature, v.active, v.is_default, id);
    if (key) await run(db, 'UPDATE mailboxes SET api_key=? WHERE id=?', key, id);
    if (d.clear_key) await run(db, "UPDATE mailboxes SET api_key='' WHERE id=?", id);
  } else {
    const r = await run(db, 'INSERT INTO mailboxes (label,provider,from_name,from_email,reply_to,api_key,domain,extra,signature,is_default,active,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', v.label, v.provider, v.from_name, v.from_email, v.reply_to, key, v.domain, v.extra, v.signature, v.is_default, v.active, nowIso());
    rid = r.meta.last_row_id;
  }
  const n: any = await first(db, 'SELECT COUNT(*) n FROM mailboxes WHERE is_default=1');
  if (v.is_default) await run(db, 'UPDATE mailboxes SET is_default=0 WHERE id<>?', rid);
  else if (!n?.n) await run(db, 'UPDATE mailboxes SET is_default=1 WHERE id=(SELECT id FROM mailboxes ORDER BY id LIMIT 1)');
  return rid;
}
// Ẩn khóa khi gửi ra trình duyệt
export const publicMailbox = (m: Mailbox) => ({ ...m, api_key: '', has_key: !!m.api_key });

async function post(url: string, init: RequestInit) {
  const r = await fetch(url, { ...init, signal: AbortSignal.timeout(15000), redirect: 'follow' });
  const t = await r.text().catch(() => '');
  return { ok: r.ok, status: r.status, text: t.slice(0, 300) };
}

export async function sendMail(m: Mailbox, o: { to: string; subject: string; text: string; replyTo?: string }): Promise<{ ok: boolean; error?: string }> {
  const to = clean(o.to, 120), subject = clean(o.subject, 200) || '(không tiêu đề)';
  if (!isEmail(to)) return { ok: false, error: 'Email người nhận không hợp lệ.' };
  const text = String(o.text || '').slice(0, 20000) + (m.signature ? '\n\n' + m.signature : '');
  const html = toHtml(text), fromName = clean(m.from_name, 80), reply = clean(o.replyTo || m.reply_to || '', 120);
  const from = fromName ? `${fromName.replace(/[<>"]/g, '')} <${m.from_email}>` : m.from_email;
  try {
    let r: { ok: boolean; status: number; text: string };
    if (m.provider === 'resend') {
      r = await post('https://api.resend.com/emails', { method: 'POST', headers: { authorization: 'Bearer ' + m.api_key, 'content-type': 'application/json' }, body: JSON.stringify({ from, to: [to], subject, text, html, ...(reply ? { reply_to: reply } : {}) }) });
    } else if (m.provider === 'brevo') {
      r = await post('https://api.brevo.com/v3/smtp/email', { method: 'POST', headers: { 'api-key': m.api_key, 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ sender: { name: fromName || undefined, email: m.from_email }, to: [{ email: to }], subject, textContent: text, htmlContent: html, ...(reply ? { replyTo: { email: reply } } : {}) }) });
    } else if (m.provider === 'sendgrid') {
      r = await post('https://api.sendgrid.com/v3/mail/send', { method: 'POST', headers: { authorization: 'Bearer ' + m.api_key, 'content-type': 'application/json' }, body: JSON.stringify({ personalizations: [{ to: [{ email: to }] }], from: { email: m.from_email, ...(fromName ? { name: fromName } : {}) }, subject, content: [{ type: 'text/plain', value: text }, { type: 'text/html', value: html }], ...(reply ? { reply_to: { email: reply } } : {}) }) });
    } else if (m.provider === 'mailgun') {
      if (!m.domain) return { ok: false, error: 'Mailgun cần điền Tên miền gửi.' };
      const f = new URLSearchParams({ from, to, subject, text, html }); if (reply) f.set('h:Reply-To', reply);
      r = await post(`https://api${/eu/i.test(m.extra) ? '.eu' : ''}.mailgun.net/v3/${encodeURIComponent(m.domain)}/messages`, { method: 'POST', headers: { authorization: 'Basic ' + btoa('api:' + m.api_key), 'content-type': 'application/x-www-form-urlencoded' }, body: f.toString() });
    } else if (m.provider === 'webhook') {
      if (!/^https:\/\//i.test(m.extra)) return { ok: false, error: 'Thiếu địa chỉ webhook (https://script.google.com/...).' };
      r = await post(m.extra, { method: 'POST', headers: { 'content-type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ secret: m.api_key, to, subject, text, html, from_name: fromName, reply_to: reply }) });
      if (r.ok && /^no\b/i.test(r.text.trim())) return { ok: false, error: 'Webhook từ chối: mã bí mật (API key) không khớp với mã trong Apps Script.' };
    } else if (m.provider === 'smtp') {
      const host = clean(m.domain, 200).toLowerCase();
      if (!host || /[\s/:]/.test(host)) return { ok: false, error: 'Thiếu hoặc sai Máy chủ SMTP (ví dụ smtp.gmail.com, không ghi https:// hay cổng).' };
      const [pp, ...uu] = String(m.extra || '').split('|');
      const port = Number(pp) || 465, user = clean(uu.join('|'), 200) || m.from_email;
      if (![465, 587, 2465, 2587].includes(port)) return { ok: false, error: 'Cổng SMTP chỉ hỗ trợ 465 hoặc 587 (cổng 25 bị Cloudflare chặn).' };
      if (!m.api_key) return { ok: false, error: 'Chưa nhập mật khẩu SMTP.' };
      try { await smtpSend({ host, port, user, pass: m.api_key, fromEmail: m.from_email, fromName, to, replyTo: reply, subject, text, html }); }
      catch (e: any) { return { ok: false, error: 'SMTP: ' + String(e?.message || e).split(m.api_key).join('***').slice(0, 220) }; }
      return { ok: true };
    } else return { ok: false, error: 'Nhà cung cấp không hỗ trợ.' };
    if (!r.ok) {
      let msg = r.text; try { const j = JSON.parse(r.text); msg = j.message || j.error?.message || j.errors?.[0]?.message || r.text; } catch { /* giữ nguyên */ }
      return { ok: false, error: `${PROVIDERS[m.provider]?.name || m.provider} báo lỗi ${r.status}: ${String(msg).replace(m.api_key || '\u0000', '***').slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e: any) { return { ok: false, error: 'Không kết nối được: ' + String(e?.message || e).slice(0, 150) }; }
}
