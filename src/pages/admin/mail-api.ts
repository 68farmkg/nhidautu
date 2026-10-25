import type { APIRoute } from 'astro';
import { all, first, run, nowIso } from '../../lib/util';
import { jres, readJson } from '../../lib/adminapi';
import { pluginOn } from '../../lib/chatcfg';
import { listMailboxes, getMailbox, sendMail, isEmail, publicMailbox } from '../../lib/mailer';

const ST = ['new', 'processing', 'done'];

export const GET: APIRoute = async ({ url, locals }) => {
  const db = (locals as any).runtime.env.DB, act = url.searchParams.get('act') || 'list';
  try {
    if (act === 'list') {
      const tab = url.searchParams.get('tab') || 'all', q = (url.searchParams.get('q') || '').trim().toLowerCase();
      const rows = await all(db, `SELECT m.id,m.name,m.email,m.phone,m.body,m.created_at,COALESCE(s.status,'new') status,
        (SELECT COUNT(*) FROM mail_replies r WHERE r.msg_id=m.id AND r.status='sent') replies FROM messages m LEFT JOIN inbox_state s ON s.msg_id=m.id ORDER BY m.id DESC LIMIT 300`);
      const counts: Record<string, number> = { all: rows.length, new: 0, processing: 0, done: 0 };
      for (const r of rows) if (ST.includes(r.status)) counts[r.status]++;
      let items = rows;
      if (ST.includes(tab)) items = items.filter((r) => r.status === tab);
      if (q) items = items.filter((r) => `${r.name} ${r.email} ${r.phone} ${r.body}`.toLowerCase().includes(q));
      return jres({ ok: true, items: items.map((r) => ({ ...r, body: String(r.body).slice(0, 160) })), counts });
    }
    if (act === 'get') {
      const id = Number(url.searchParams.get('id')) || 0;
      const m: any = await first(db, "SELECT m.*,COALESCE(s.status,'new') status,COALESCE(s.note,'') note FROM messages m LEFT JOIN inbox_state s ON s.msg_id=m.id WHERE m.id=?", id);
      if (!m) return jres({ ok: false, error: 'notfound' }, 404);
      const replies = await all(db, 'SELECT id,from_email,to_email,subject,body,status,error,by,created_at FROM mail_replies WHERE msg_id=? ORDER BY id', id);
      return jres({ ok: true, msg: m, replies });
    }
    if (act === 'setup') {
      const mbs = (await pluginOn(db, 'chat-pro')) ? (await listMailboxes(db, true)).map(publicMailbox) : [];
      const tpl = await all(db, "SELECT id,title,body FROM quick_replies WHERE kind='mail' ORDER BY sort,id");
      return jres({ ok: true, mailboxes: mbs.map((m) => ({ id: m.id, label: m.label, from_email: m.from_email, from_name: m.from_name, is_default: m.is_default, signature: m.signature, provider: m.provider })), templates: tpl, last: Number((await first(db, "SELECT v FROM kv WHERE k='mail.last_box'"))?.v) || 0 });
    }
  } catch (e: any) { return jres({ ok: false, error: String(e?.message || e).slice(0, 300) }, 500); }
  return jres({ ok: false }, 400);
};

export const POST: APIRoute = async ({ request, locals }) => {
  const db = (locals as any).runtime.env.DB, U: any = (locals as any).user || { name: 'Quản trị' };
  const d = await readJson(request); if (!d) return jres({ ok: false, error: 'invalid' }, 400);
  const act = String(d.act || ''), id = Number(d.id) || 0, now = nowIso();
  try {
    const m: any = id ? await first(db, 'SELECT * FROM messages WHERE id=?', id) : null;
    if (!m) return jres({ ok: false, error: 'notfound' }, 404);
    const st: any = await first(db, 'SELECT status,note FROM inbox_state WHERE msg_id=?', id);
    const save = (status: string, note: string) => run(db, 'INSERT INTO inbox_state (msg_id,status,note,updated_at) VALUES (?,?,?,?) ON CONFLICT(msg_id) DO UPDATE SET status=excluded.status,note=excluded.note,updated_at=excluded.updated_at', id, status, note, now);
    if (act === 'status') { if (!ST.includes(d.value)) return jres({ ok: false }, 400); await save(d.value, st?.note || ''); return jres({ ok: true }); }
    if (act === 'note') { await save(st?.status || 'new', String(d.value || '').slice(0, 2000)); return jres({ ok: true }); }
    if (act === 'delete') { await run(db, 'DELETE FROM mail_replies WHERE msg_id=?', id); await run(db, 'DELETE FROM inbox_state WHERE msg_id=?', id); await run(db, 'DELETE FROM messages WHERE id=?', id); return jres({ ok: true }); }
    if (act === 'send') {
      if (!(await pluginOn(db, 'chat-pro'))) return jres({ ok: false, error: 'Cần cài plugin Hộp thư & Chat Pro (Tiện ích & plugin) để gửi email từ đây.' });
      const to = String(d.to || m.email).trim(), subject = String(d.subject || '').trim().slice(0, 200), body = String(d.body || '').trim();
      if (!isEmail(to)) return jres({ ok: false, error: 'Email người nhận không hợp lệ.' });
      if (!body) return jres({ ok: false, error: 'Nội dung trống.' });
      const mb = await getMailbox(db, Number(d.mailbox) || 0);
      if (!mb) return jres({ ok: false, error: 'Chưa có hộp thư gửi nào. Vào Cài đặt website > Hộp thư gửi để thêm.' });
      if (Number(d.mailbox) && mb.id !== Number(d.mailbox)) return jres({ ok: false, error: 'Hộp thư đã chọn đang tắt hoặc không còn.' });
      const r = await sendMail(mb, { to, subject, text: body });
      await run(db, 'INSERT INTO mail_replies (msg_id,mailbox_id,from_email,to_email,subject,body,status,error,by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)', id, mb.id, mb.from_email, to, subject, body + (mb.signature ? '\n\n' + mb.signature : ''), r.ok ? 'sent' : 'failed', r.error || '', U.name || '', now);
      if (r.ok) {
        await run(db, "INSERT INTO kv (k,v) VALUES ('mail.last_box',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v", String(mb.id));
        await save(d.done ? 'done' : (st?.status === 'done' ? 'done' : 'processing'), st?.note || '');
      }
      return jres(r);
    }
  } catch (e: any) { return jres({ ok: false, error: String(e?.message || e).slice(0, 300) }, 500); }
  return jres({ ok: false, error: 'unknown' }, 400);
};
