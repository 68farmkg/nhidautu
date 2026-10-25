import type { APIRoute } from 'astro';
import { all, first, run, nowIso } from '../../lib/util';
import { jres, readJson, vnDayStart } from '../../lib/adminapi';
import { getCfg, kvGet, kvSet, touchAdmin, isAway } from '../../lib/chatcfg';
import { draftReply } from '../../lib/chatai';
import { getMailbox, sendMail, isEmail } from '../../lib/mailer';

const ST = ['new', 'processing', 'done'];

async function list(db: any, url: URL) {
  const tab = url.searchParams.get('tab') || 'all', q = (url.searchParams.get('q') || '').trim().toLowerCase();
  const rows = await all(db, `SELECT c.id,c.name,c.email,c.status,c.unread_admin,c.last_at,c.created_at,c.page,COALESCE(e.phone,'') phone,COALESCE(e.mode,'auto') mode,COALESCE(e.category,'') category,
    (SELECT body FROM chat_msgs WHERE conv_id=c.id AND role IN ('visitor','admin','ai') ORDER BY id DESC LIMIT 1) last,
    (SELECT role FROM chat_msgs WHERE conv_id=c.id AND role IN ('visitor','admin','ai') ORDER BY id DESC LIMIT 1) last_role
    FROM conversations c LEFT JOIN conv_ext e ON e.conv_id=c.id ORDER BY COALESCE(c.last_at,c.created_at) DESC LIMIT 300`);
  const counts = { all: rows.length, new: 0, processing: 0, done: 0, human: 0, unread: 0 } as Record<string, number>;
  for (const r of rows) { if (ST.includes(r.status)) counts[r.status]++; if (r.mode === 'human' && r.status !== 'done') counts.human++; counts.unread += r.unread_admin > 0 ? 1 : 0; }
  let items = rows;
  if (ST.includes(tab)) items = items.filter((r) => r.status === tab);
  if (tab === 'human') items = items.filter((r) => r.mode === 'human' && r.status !== 'done');
  if (q) items = items.filter((r) => `${r.name} ${r.email} ${r.phone} ${r.last}`.toLowerCase().includes(q));
  const d0 = vnDayStart(), recent = new Date(Date.now() - 10 * 60000).toISOString();
  const [m, c, a, rs, ai] = await Promise.all([
    first(db, "SELECT COUNT(*) n FROM chat_msgs WHERE created_at>=? AND role IN ('visitor','admin','ai')", d0),
    first(db, 'SELECT COUNT(*) n FROM conversations WHERE created_at>=?', d0),
    first(db, "SELECT COUNT(*) n FROM conversations WHERE last_at>=? AND status<>'done'", recent),
    first(db, "SELECT COUNT(*) n FROM conversations WHERE status='done' AND last_at>=?", d0),
    first(db, "SELECT COUNT(*) n FROM chat_msgs WHERE created_at>=? AND role='ai'", d0),
  ]);
  return { items: items.slice(0, 200), counts, stats: { msgs: m?.n || 0, customers: c?.n || 0, active: a?.n || 0, done: rs?.n || 0, ai: ai?.n || 0 } };
}

async function thread(db: any, id: number, after: number, mark: boolean) {
  const conv: any = await first(db, `SELECT c.*,COALESCE(e.phone,'') phone,COALESCE(e.mode,'auto') mode,COALESCE(e.category,'') category,COALESCE(e.ai_count,0) ai_count FROM conversations c LEFT JOIN conv_ext e ON e.conv_id=c.id WHERE c.id=?`, id);
  if (!conv) return null;
  const msgs = await all(db, "SELECT id,role,body,by,created_at FROM chat_msgs WHERE conv_id=? AND id>? ORDER BY id LIMIT 300", id, after);
  if (mark && (conv.unread_admin > 0)) await run(db, 'UPDATE conversations SET unread_admin=0 WHERE id=?', id);
  const { token, ...pub } = conv;
  return { conv: pub, msgs };
}

export const GET: APIRoute = async ({ url, locals }) => {
  const db = (locals as any).runtime.env.DB, act = url.searchParams.get('act') || 'list';
  try {
    await touchAdmin(db);
    if (act === 'list') {
      const cfg = await getCfg(db);
      return jres({ ok: true, ...(await list(db, url)), presence: (await kvGet(db, 'chat.presence')) || 'auto', away: await isAway(db, cfg), aiMode: cfg.ai.mode, aiErr: await kvGet(db, 'chat.ai_err') });
    }
    if (act === 'thread') {
      const t = await thread(db, Number(url.searchParams.get('id')) || 0, Number(url.searchParams.get('after')) || 0, true);
      return t ? jres({ ok: true, ...t }) : jres({ ok: false, error: 'notfound' }, 404);
    }
    if (act === 'quick') return jres({ ok: true, items: await all(db, "SELECT id,title,body FROM quick_replies WHERE kind='chat' ORDER BY sort,id") });
  } catch (e: any) { return jres({ ok: false, error: String(e?.message || e) }, 500); }
  return jres({ ok: false }, 400);
};

export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as any).runtime.env, db = env.DB, U: any = (locals as any).user || { name: 'Quản trị' };
  const d = await readJson(request); if (!d) return jres({ ok: false, error: 'invalid' }, 400);
  const act = String(d.act || ''), id = Number(d.id) || 0, now = nowIso();
  try {
    if (act === 'presence') { const v = ['auto', 'online', 'away'].includes(d.value) ? d.value : 'auto'; await kvSet(db, 'chat.presence', v); return jres({ ok: true, presence: v }); }
    if (!id) return jres({ ok: false, error: 'invalid' }, 400);
    const conv: any = await first(db, 'SELECT id,name,email FROM conversations WHERE id=?', id);
    if (!conv) return jres({ ok: false, error: 'notfound' }, 404);
    if (act === 'reply') {
      const body = String(d.body || '').trim().slice(0, 1000); if (!body) return jres({ ok: false, error: 'empty' }, 400);
      const cfg = await getCfg(db);
      const r = await run(db, "INSERT INTO chat_msgs (conv_id,role,body,by,created_at) VALUES (?, 'admin', ?, ?, ?)", id, body, U.name || 'Nhân viên', now);
      await run(db, "UPDATE conversations SET last_at=?,unread_admin=0,status=CASE WHEN status='new' THEN 'processing' ELSE status END WHERE id=?", now, id);
      await run(db, "INSERT INTO conv_ext (conv_id,mode,human_at,suggest) VALUES (?,?,?, '') ON CONFLICT(conv_id) DO UPDATE SET suggest='',human_at=excluded.human_at" + (cfg.ai.stop_on_human ? ",mode='human'" : ''), id, cfg.ai.stop_on_human ? 'human' : 'auto', now);
      return jres({ ok: true, id: r.meta.last_row_id });
    }
    if (act === 'status') { if (!ST.includes(d.value)) return jres({ ok: false }, 400); await run(db, 'UPDATE conversations SET status=? WHERE id=?', d.value, id); return jres({ ok: true }); }
    if (act === 'mode') {
      const v = d.value === 'human' ? 'human' : 'auto';
      await run(db, 'INSERT INTO conv_ext (conv_id,mode) VALUES (?,?) ON CONFLICT(conv_id) DO UPDATE SET mode=excluded.mode', id, v);
      return jres({ ok: true });
    }
    if (act === 'note') { await run(db, 'UPDATE conversations SET note=? WHERE id=?', String(d.value || '').slice(0, 2000), id); return jres({ ok: true }); }
    if (act === 'category') { await run(db, 'INSERT INTO conv_ext (conv_id,category) VALUES (?,?) ON CONFLICT(conv_id) DO UPDATE SET category=excluded.category', id, String(d.value || '').slice(0, 40)); return jres({ ok: true }); }
    if (act === 'delete') { await run(db, 'DELETE FROM chat_msgs WHERE conv_id=?', id); await run(db, 'DELETE FROM conv_ext WHERE conv_id=?', id); await run(db, 'DELETE FROM conversations WHERE id=?', id); return jres({ ok: true }); }
    if (act === 'draft') {
      const cfg = await getCfg(db);
      try { return jres({ ok: true, text: await draftReply(env, db, cfg, id) }); } catch (e: any) { return jres({ ok: false, error: String(e?.message || e).slice(0, 300) }, 200); }
    }
    if (act === 'email') {
      if (!isEmail(conv.email)) return jres({ ok: false, error: 'Khách chưa có email hợp lệ.' });
      const mb = await getMailbox(db, Number(d.mailbox) || 0); if (!mb) return jres({ ok: false, error: 'Chưa cấu hình hộp thư gửi (Cài đặt website > Hộp thư gửi).' });
      const r = await sendMail(mb, { to: conv.email, subject: String(d.subject || 'Phản hồi từ chúng tôi'), text: String(d.body || '') });
      if (r.ok) await run(db, "UPDATE conversations SET note=? WHERE id=?", ((await first(db, 'SELECT note FROM conversations WHERE id=?', id))?.note || '') + `\n[${now.slice(0, 16).replace('T', ' ')} UTC] ${U.name || 'NV'} đã gửi email cho khách từ ${mb.from_email}`, id);
      return jres(r);
    }
  } catch (e: any) { return jres({ ok: false, error: String(e?.message || e).slice(0, 300) }, 500); }
  return jres({ ok: false, error: 'unknown' }, 400);
};
