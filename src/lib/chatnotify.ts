// Báo cho chủ website khi có chat/liên hệ mới: Telegram + email + webhook (Zalo/Slack/Discord...), và email xác nhận cho khách.
import { notify } from './notify';
import { getMailbox, sendMail, isEmail } from './mailer';
import type { ChatCfg } from './chatcfg';

const later = (locals: any, p: Promise<any>) => { try { locals.runtime.ctx.waitUntil(p.catch(() => {})); } catch { p.catch(() => {}); } };

export function notifyOwner(locals: any, cfg: ChatCfg, title: string, text: string, link: string) {
  const env = locals?.runtime?.env, db = env?.DB;
  if (cfg.notify.tg) notify(locals, `${title}\n${text}\n${link}`);
  const body = `${text}\n\nMở xem: ${link}`;
  const addrs = String(cfg.notify.email || '').split(/[,;\s]+/).filter(isEmail).slice(0, 5);
  if (addrs.length && db) later(locals, (async () => {
    const mb = await getMailbox(db, Number(cfg.notify.mailbox) || 0); if (!mb) return;
    for (const a of addrs) await sendMail(mb, { to: a, subject: title.replace(/[\r\n]+/g, ' ').slice(0, 150), text: body });
  })());
  const wh = String(cfg.notify.webhook || '').trim();
  if (/^https:\/\//i.test(wh)) later(locals, fetch(wh, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title, text: `${title}\n${text}\n${link}`, content: `${title}\n${text}\n${link}`, link }), signal: AbortSignal.timeout(8000) }));
}

// Email xác nhận gửi cho khách (nếu khách có email và đã cấu hình hộp thư gửi)
export function confirmVisitor(locals: any, cfg: ChatCfg, email: string, name: string) {
  const env = locals?.runtime?.env, db = env?.DB;
  if (!cfg.notify.confirm_visitor || !db || !isEmail(email)) return;
  later(locals, (async () => {
    const mb = await getMailbox(db, Number(cfg.notify.mailbox) || 0); if (!mb) return;
    await sendMail(mb, { to: email, subject: cfg.notify.confirm_subject || 'Chúng tôi đã nhận được tin nhắn của bạn', text: `Chào ${name || 'bạn'},\n\n${cfg.notify.confirm_text}` });
  })());
}
