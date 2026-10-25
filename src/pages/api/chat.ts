import type { APIRoute } from 'astro';
import { getSite } from '../../lib/site';
import { allow, ipOf } from '../../lib/ratelimit';
import { nowIso } from '../../lib/util';
import { getCfg, isAway, inHours, type ChatCfg } from '../../lib/chatcfg';
import { runAi, doHandoff } from '../../lib/chatai';
import { notifyOwner, confirmVisitor } from '../../lib/chatnotify';
import { isEmail } from '../../lib/mailer';

const TOKEN = /^[a-z0-9]{24,48}$/;
const json = (o: any, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const later = (locals: any, p: Promise<any>) => { try { locals.runtime.ctx.waitUntil(p.catch(() => {})); } catch { p.catch(() => {}); } };
const PHONE = /^(\+?84|0)\d{9,10}$/;
const normPhone = (s: string) => String(s || '').replace(/[\s.\-()]/g, '');

// Kiểm tra thông tin khách theo cấu hình "phải điền trước khi chat". Trả về mã lỗi (name/phone/email/either/consent) hoặc ''.
function checkContact(cfg: ChatCfg, d: any) {
  const g = cfg.gate, name = String(d.name || '').trim().slice(0, 60), email = String(d.email || '').trim().slice(0, 120), phone = normPhone(d.phone).slice(0, 20);
  if (g.name !== 'off' && (g.name === 'required' ? name.length < 2 : name && name.length < 2)) return { err: 'name' };
  if (g.phone !== 'off' && phone && !PHONE.test(phone)) return { err: 'phone' };
  if (g.email !== 'off' && email && !isEmail(email)) return { err: 'email' };
  const pReq = g.phone === 'required', eReq = g.email === 'required';
  if (g.either && g.phone !== 'off' && g.email !== 'off') { if (!phone && !email) return { err: 'either' }; }
  else { if (pReq && !phone) return { err: 'phone' }; if (eReq && !email) return { err: 'email' }; }
  if (g.consent && g.consent_req && !d.consent) return { err: 'consent' };
  return { err: '', name: g.name === 'off' ? '' : name, email: g.email === 'off' ? '' : email, phone: g.phone === 'off' ? '' : phone };
}

// Khách xem tin: GET /api/chat?token=...&after=<id>
export const GET: APIRoute = async ({ url, locals }) => {
  const env = (locals as any).runtime.env, db = env.DB;
  const token = url.searchParams.get('token') || '', after = Number(url.searchParams.get('after')) || 0;
  if (!TOKEN.test(token)) return json({ ok: false }, 400);
  try {
    const c: any = await db.prepare('SELECT id FROM conversations WHERE token=?').bind(token).first();
    if (!c) return json({ ok: true, msgs: [], registered: false, mode: 'auto', typing: false, suggest: [] });
    const [ext, rows, last] = await Promise.all([
      db.prepare('SELECT mode,registered,suggest,ai_pending FROM conv_ext WHERE conv_id=?').bind(c.id).first(),
      db.prepare("SELECT id,role,body,by,created_at FROM chat_msgs WHERE conv_id=? AND id>? AND role IN ('visitor','admin','ai','sys') ORDER BY id LIMIT 100").bind(c.id, after).all(),
      db.prepare("SELECT role,created_at FROM chat_msgs WHERE conv_id=? AND role IN ('visitor','admin','ai') ORDER BY id DESC LIMIT 1").bind(c.id).first(),
    ]) as any[];
    const cfg = await getCfg(db), nowS = Math.floor(Date.now() / 1000);
    let pending = !!(ext?.ai_pending && nowS - ext.ai_pending < 60);
    // AI "trả lời chậm": khách nhắn quá N giây mà chưa ai trả lời thì AI vào cuộc
    if (!pending && cfg.ai.mode === 'smart' && cfg.ai.delay > 0 && ext?.mode !== 'human' && last?.role === 'visitor') {
      const age = nowS - Math.floor(new Date(last.created_at).getTime() / 1000);
      if (age >= cfg.ai.delay && age < 3600) { pending = true; later(locals, runAi(env, db, cfg, c.id)); }
    }
    let suggest: string[] = []; try { if (last?.role === 'ai' && ext?.suggest) suggest = JSON.parse(ext.suggest); } catch { /* bỏ */ }
    return json({ ok: true, registered: !!ext?.registered, mode: ext?.mode || 'auto', typing: pending, suggest, msgs: rows.results.map((m: any) => ({ id: m.id, role: m.role, body: m.body, by: m.role === 'admin' ? m.by || '' : '', at: m.created_at })) });
  } catch { return json({ ok: false, error: 'db' }, 500); }
};

// Khách gửi: POST JSON { act: start|send|handoff, token, ... }
export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as any).runtime.env, db = env.DB;
  let d: any; try { d = await request.json(); } catch { return json({ ok: false }, 400); }
  const token = String(d.token || ''), act = String(d.act || 'send'), page = String(d.page || '').slice(0, 200), now = nowIso();
  if (!TOKEN.test(token)) return json({ ok: false, error: 'invalid' }, 400);
  if (d.website) return json({ ok: true, id: 0 }); // ô ẩn chống robot
  const S = await getSite(db);
  if (S.chat_on !== '1') return json({ ok: false, error: 'off' }, 403);
  const cfg = await getCfg(db), origin = new URL(request.url).origin;
  const ip = ipOf(request);
  try {
    let c: any = await db.prepare('SELECT id,name,email,unread_admin FROM conversations WHERE token=?').bind(token).first();
    const ext: any = c ? await db.prepare('SELECT mode,registered,phone FROM conv_ext WHERE conv_id=?').bind(c.id).first() : null;

    if (act === 'start') {
      if (!(await allow(db, 'chatstart:' + ip, 12, 3600))) return json({ ok: false, error: 'slow' }, 429);
      const v: any = checkContact(cfg, d);
      if (v.err) return json({ ok: false, error: v.err }, 400);
      let fresh = false;
      if (!c) {
        const r = await db.prepare("INSERT INTO conversations (token,name,email,page,status,unread_admin,last_at,created_at) VALUES (?,?,?,?, 'new',0,?,?)").bind(token, v.name, v.email, page, now, now).run();
        c = { id: r.meta.last_row_id, name: v.name, email: v.email, unread_admin: 0 }; fresh = true;
      } else await db.prepare('UPDATE conversations SET name=?,email=? WHERE id=?').bind(v.name || c.name, v.email || c.email, c.id).run();
      const was = !!ext?.registered;
      await db.prepare('INSERT INTO conv_ext (conv_id,phone,registered) VALUES (?,?,1) ON CONFLICT(conv_id) DO UPDATE SET phone=excluded.phone,registered=1').bind(c.id, v.phone).run();
      if (!was && cfg.notify.in_chat && cfg.notify.in_chat_text) await db.prepare("INSERT INTO chat_msgs (conv_id,role,body,by,created_at) VALUES (?, 'sys', ?, '', ?)").bind(c.id, cfg.notify.in_chat_text, now).run();
      if (!was) {
        if (cfg.notify.on_start) notifyOwner(locals, cfg, '🆕 Khách mới mở chat', `${v.name || 'Khách'}${v.phone ? ' · ' + v.phone : ''}${v.email ? ' · ' + v.email : ''}${page ? '\nTrang: ' + page : ''}`, `${origin}/admin/chat?id=${c.id}`);
        confirmVisitor(locals, cfg, v.email, v.name);
      }
      return json({ ok: true, fresh });
    }

    if (act === 'handoff') {
      if (!c) return json({ ok: false, error: 'invalid' }, 400);
      if (cfg.gate.on && !ext?.registered) return json({ ok: false, error: 'gate' }, 403);
      if (!(await allow(db, 'chathand:' + token, 4, 3600))) return json({ ok: false, error: 'slow' }, 429);
      if (ext?.mode !== 'human') {
        await doHandoff(db, c.id, cfg, 'khach');
        notifyOwner(locals, cfg, '🙋 Khách cần gặp nhân viên', `${c.name || 'Khách'}${ext?.phone ? ' · ' + ext.phone : ''}`, `${origin}/admin/chat?id=${c.id}`);
      }
      return json({ ok: true });
    }

    // act = send
    const body = String(d.body || '').trim().slice(0, 1000);
    if (!body) return json({ ok: false, error: 'invalid' }, 400);
    if (!(await allow(db, 'chat:' + token, 15, 60)) || !(await allow(db, 'chatip:' + ip, 80, 3600))) return json({ ok: false, error: 'slow' }, 429);
    if (cfg.gate.on && !ext?.registered) return json({ ok: false, error: 'gate' }, 403);
    let fresh = false;
    const name = String(d.name || '').trim().slice(0, 60), email = String(d.email || '').trim().slice(0, 120);
    if (!c) {
      const r = await db.prepare("INSERT INTO conversations (token,name,email,page,status,unread_admin,last_at,created_at) VALUES (?,?,?,?, 'new',0,?,?)").bind(token, name, isEmail(email) ? email : '', page, now, now).run();
      c = { id: r.meta.last_row_id, name, email: '', unread_admin: 0 }; fresh = true;
      await db.prepare('INSERT INTO conv_ext (conv_id) VALUES (?) ON CONFLICT(conv_id) DO NOTHING').bind(c.id).run();
    }
    const m = await db.prepare("INSERT INTO chat_msgs (conv_id,role,body,created_at) VALUES (?, 'visitor', ?, ?)").bind(c.id, body, now).run();
    await db.prepare("UPDATE conversations SET unread_admin=unread_admin+1,last_at=?,status=CASE WHEN status='done' THEN 'new' ELSE status END WHERE id=?").bind(now, c.id).run();
    await db.prepare("UPDATE conv_ext SET suggest='' WHERE conv_id=?").bind(c.id).run();
    if (fresh || !c.unread_admin || cfg.notify.each) {
      notifyOwner(locals, cfg, `💬 Chat mới từ ${c.name || name || 'khách'}`, `${ext?.phone ? ext.phone + '\n' : ''}${body}`, `${origin}/admin/chat?id=${c.id}`);
      if (fresh && !cfg.gate.on && isEmail(email)) confirmVisitor(locals, cfg, email, name);
    }
    // AI: trả lời ngay khi chế độ "luôn trả lời", hoặc chế độ "thông minh" lúc chủ vắng / ngoài giờ
    let ai = false;
    if (cfg.ai.mode !== 'off' && ext?.mode !== 'human') {
      let go = cfg.ai.mode === 'always';
      if (!go && cfg.ai.mode === 'smart') go = (cfg.ai.use_presence && (await isAway(db, cfg))) || (cfg.ai.outside_hours && !inHours(cfg));
      if (go) { ai = true; later(locals, runAi(env, db, cfg, c.id)); }
    }
    return json({ ok: true, id: m.meta.last_row_id, ai });
  } catch { return json({ ok: false, error: 'db' }, 500); }
};
