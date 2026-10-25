import type { APIRoute } from 'astro';
import { getSite } from '../../lib/site';
import { allow, ipOf } from '../../lib/ratelimit';
import { notify } from '../../lib/notify';
import { nowIso } from '../../lib/util';

const TOKEN = /^[a-z0-9]{24,48}$/;
const json = (o: any, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

// Khách xem tin: GET /api/chat?token=...&after=<id>
export const GET: APIRoute = async ({ url, locals }) => {
  const db = (locals as any).runtime.env.DB;
  const token = url.searchParams.get('token') || '', after = Number(url.searchParams.get('after')) || 0;
  if (!TOKEN.test(token)) return json({ ok: false }, 400);
  try {
    const c: any = await db.prepare('SELECT id FROM conversations WHERE token=?').bind(token).first();
    if (!c) return json({ ok: true, msgs: [] });
    const r = await db.prepare("SELECT id,role,body,created_at FROM chat_msgs WHERE conv_id=? AND id>? AND role IN ('visitor','admin') ORDER BY id LIMIT 100").bind(c.id, after).all();
    return json({ ok: true, msgs: r.results.map((m: any) => ({ id: m.id, role: m.role, body: m.body, at: m.created_at })) });
  } catch { return json({ ok: false, error: 'db' }, 500); }
};

// Khách gửi tin: POST JSON { token, body, name?, email?, page? }
export const POST: APIRoute = async ({ request, locals }) => {
  const db = (locals as any).runtime.env.DB;
  let d: any; try { d = await request.json(); } catch { return json({ ok: false }, 400); }
  const token = String(d.token || ''), body = String(d.body || '').trim().slice(0, 1000);
  if (!TOKEN.test(token) || !body) return json({ ok: false, error: 'invalid' }, 400);
  const S = await getSite(db);
  if (S.chat_on !== '1') return json({ ok: false, error: 'off' }, 403);
  if (!(await allow(db, 'chat:' + token, 15, 60)) || !(await allow(db, 'chatip:' + ipOf(request), 80, 3600))) return json({ ok: false, error: 'slow' }, 429);
  const name = String(d.name || '').trim().slice(0, 60), email = String(d.email || '').trim().slice(0, 120), page = String(d.page || '').slice(0, 200), now = nowIso();
  try {
    let c: any = await db.prepare('SELECT id,name,unread_admin FROM conversations WHERE token=?').bind(token).first();
    let fresh = false;
    if (!c) {
      const r = await db.prepare("INSERT INTO conversations (token,name,email,page,status,unread_admin,last_at,created_at) VALUES (?,?,?,?, 'new',0,?,?)").bind(token, name, email, page, now, now).run();
      c = { id: r.meta.last_row_id, name, unread_admin: 0 }; fresh = true;
    } else if (name && !c.name) await db.prepare('UPDATE conversations SET name=? WHERE id=?').bind(name, c.id).run();
    const m = await db.prepare("INSERT INTO chat_msgs (conv_id,role,body,created_at) VALUES (?, 'visitor', ?, ?)").bind(c.id, body, now).run();
    // khách nhắn lại vào cuộc đã xong thì mở lại thành "mới"
    await db.prepare("UPDATE conversations SET unread_admin=unread_admin+1,last_at=?,status=CASE WHEN status='done' THEN 'new' ELSE status END WHERE id=?").bind(now, c.id).run();
    if (fresh || !c.unread_admin) notify(locals, `💬 Chat mới từ ${name || c.name || 'khách'}: ${body}\n${new URL(request.url).origin}/admin/hop-thu/chat/${c.id}`);
    return json({ ok: true, id: m.meta.last_row_id });
  } catch { return json({ ok: false, error: 'db' }, 500); }
};
