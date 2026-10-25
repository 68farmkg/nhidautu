import type { APIRoute } from 'astro';
import { all, first, run, nowIso } from '../../lib/util';
import { jres, readJson } from '../../lib/adminapi';
import { getCfg, saveCfg, kvSet } from '../../lib/chatcfg';
import { getSite } from '../../lib/site';
import { listMailboxes, saveMailbox, publicMailbox, getMailbox, sendMail, isEmail, PROVIDERS, APPS_SCRIPT } from '../../lib/mailer';
import { loadSettings, keyOf, CATALOG } from '../../lib/ai';
import { buildKnowledge, runAi } from '../../lib/chatai';

// API cài đặt chat/mail (chỉ quản trị viên: vai trò khác bị middleware chặn)
export const GET: APIRoute = async ({ locals }) => {
  const env = (locals as any).runtime.env, db = env.DB;
  const [cfg, site, mbs, quick, kb, st] = await Promise.all([getCfg(db), getSite(db), listMailboxes(db), all(db, 'SELECT id,kind,title,body FROM quick_replies ORDER BY kind,sort,id'), all(db, 'SELECT id,title,body,kind,active FROM ai_knowledge ORDER BY id DESC LIMIT 300'), loadSettings(db)]);
  const providers = CATALOG.filter((p) => st[p.id]?.enabled && keyOf(env, p.id, st[p.id])).map((p) => ({ id: p.id, name: p.name }));
  return jres({ ok: true, cfg, site: { chat_on: site.chat_on, chat_title: site.chat_title, chat_welcome: site.chat_welcome }, mailboxes: mbs.map(publicMailbox), quick, kb, providers, providersMeta: PROVIDERS, appsScript: APPS_SCRIPT, telegram: !!(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) });
};

export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as any).runtime.env, db = env.DB;
  const d = await readJson(request); if (!d) return jres({ ok: false, error: 'invalid' }, 400);
  const act = String(d.act || '');
  try {
    if (act === 'save') {
      const cfg = await saveCfg(db, d.cfg || {});
      const s = d.site || {};
      await kvSet(db, 's.chat_on', s.chat_on === '1' || s.chat_on === true ? '1' : '');
      await kvSet(db, 's.chat_title', String(s.chat_title || '').slice(0, 80));
      await kvSet(db, 's.chat_welcome', String(s.chat_welcome || '').slice(0, 500));
      return jres({ ok: true, cfg });
    }
    if (act === 'mb_save') { const id = await saveMailbox(db, d.box || {}); return jres({ ok: true, id, mailboxes: (await listMailboxes(db)).map(publicMailbox) }); }
    if (act === 'mb_delete') { await run(db, 'DELETE FROM mailboxes WHERE id=?', Number(d.id) || 0); await run(db, 'UPDATE mailboxes SET is_default=1 WHERE id=(SELECT id FROM mailboxes ORDER BY id LIMIT 1) AND NOT EXISTS (SELECT 1 FROM mailboxes WHERE is_default=1)'); return jres({ ok: true, mailboxes: (await listMailboxes(db)).map(publicMailbox) }); }
    if (act === 'mb_test') {
      const mb = await getMailbox(db, Number(d.id) || 0); const to = String(d.to || '').trim();
      if (!mb) return jres({ ok: false, error: 'Không tìm thấy hộp thư (hoặc đang tắt).' });
      if (!isEmail(to)) return jres({ ok: false, error: 'Nhập email nhận thư thử.' });
      return jres(await sendMail(mb, { to, subject: 'Thư thử từ website của bạn', text: 'Chúc mừng! Hộp thư "' + mb.label + '" đã gửi được thư. Bạn có thể dùng nó để trả lời khách trong Hộp thư.' }));
    }
    if (act === 'qr_save') {
      const kind = d.kind === 'mail' ? 'mail' : 'chat', title = String(d.title || '').trim().slice(0, 60), body = String(d.body || '').trim().slice(0, 2000), id = Number(d.id) || 0;
      if (!title || !body) return jres({ ok: false, error: 'Cần tiêu đề và nội dung.' });
      if (id) await run(db, 'UPDATE quick_replies SET title=?,body=?,kind=? WHERE id=?', title, body, kind, id); else await run(db, 'INSERT INTO quick_replies (kind,title,body,sort) VALUES (?,?,?,?)', kind, title, body, Date.now() % 100000000);
      return jres({ ok: true, quick: await all(db, 'SELECT id,kind,title,body FROM quick_replies ORDER BY kind,sort,id') });
    }
    if (act === 'qr_delete') { await run(db, 'DELETE FROM quick_replies WHERE id=?', Number(d.id) || 0); return jres({ ok: true, quick: await all(db, 'SELECT id,kind,title,body FROM quick_replies ORDER BY kind,sort,id') }); }
    if (act === 'kb_save') {
      const title = String(d.title || '').trim().slice(0, 120), body = String(d.body || '').trim().slice(0, 4000), id = Number(d.id) || 0;
      const kind = ['faq', 'info', 'policy', 'product', 'pin'].includes(d.kind) ? d.kind : 'faq', active = d.active === false || d.active === 0 ? 0 : 1;
      if (!title || !body) return jres({ ok: false, error: 'Cần tiêu đề và nội dung.' });
      if (id) await run(db, 'UPDATE ai_knowledge SET title=?,body=?,kind=?,active=? WHERE id=?', title, body, kind, active, id); else await run(db, 'INSERT INTO ai_knowledge (title,body,kind,active,created_at) VALUES (?,?,?,?,?)', title, body, kind, active, nowIso());
      return jres({ ok: true, kb: await all(db, 'SELECT id,title,body,kind,active FROM ai_knowledge ORDER BY id DESC LIMIT 300') });
    }
    if (act === 'kb_delete') { await run(db, 'DELETE FROM ai_knowledge WHERE id=?', Number(d.id) || 0); return jres({ ok: true, kb: await all(db, 'SELECT id,title,body,kind,active FROM ai_knowledge ORDER BY id DESC LIMIT 300') }); }
    if (act === 'ai_test') {
      // Hỏi thử AI với cấu hình đang soạn (chưa cần lưu) và xem dữ liệu AI sẽ được nạp
      const cfg = await saveCfg(db, d.cfg || (await getCfg(db)));
      const q = String(d.q || '').trim().slice(0, 300); if (!q) return jres({ ok: false, error: 'Nhập câu hỏi thử.' });
      const kn = await buildKnowledge(db, cfg, q);
      const tok = 'test' + Date.now().toString(36).padEnd(24, 'x');
      const r = await run(db, "INSERT INTO conversations (token,name,status,unread_admin,last_at,created_at) VALUES (?, 'Thử AI', 'done', 0, ?, ?)", tok, nowIso(), nowIso());
      const cid = r.meta.last_row_id;
      try {
        await run(db, "INSERT INTO chat_msgs (conv_id,role,body,created_at) VALUES (?, 'visitor', ?, ?)", cid, q, nowIso());
        const res = await runAi(env, db, cfg, cid);
        const a: any = await first(db, "SELECT role,body FROM chat_msgs WHERE conv_id=? AND role IN ('ai','sys') ORDER BY id DESC LIMIT 1", cid);
        const sg: any = await first(db, 'SELECT suggest FROM conv_ext WHERE conv_id=?', cid);
        return jres({ ok: true, reply: a?.body || '', handoff: !!res.handoff, error: res.ok ? '' : res.error, suggest: sg?.suggest ? JSON.parse(sg.suggest) : [], knowledge: kn.slice(0, 2500) });
      } finally { await run(db, 'DELETE FROM chat_msgs WHERE conv_id=?', cid); await run(db, 'DELETE FROM conv_ext WHERE conv_id=?', cid); await run(db, 'DELETE FROM conversations WHERE id=?', cid); }
    }
  } catch (e: any) { return jres({ ok: false, error: String(e?.message || e).slice(0, 300) }, 200); }
  return jres({ ok: false, error: 'unknown' }, 400);
};
