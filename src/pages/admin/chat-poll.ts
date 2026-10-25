import type { APIRoute } from 'astro';
// Trang admin hỏi tin mới của một cuộc chat (đã được middleware bảo vệ)
export const GET: APIRoute = async ({ url, locals }) => {
  const db = (locals as any).runtime.env.DB;
  const id = Number(url.searchParams.get('id')) || 0, after = Number(url.searchParams.get('after')) || 0;
  try {
    const r = await db.prepare("SELECT id,role,body FROM chat_msgs WHERE conv_id=? AND id>? ORDER BY id LIMIT 100").bind(id, after).all();
    if (r.results.length) await db.prepare('UPDATE conversations SET unread_admin=0 WHERE id=?').bind(id).run();
    return new Response(JSON.stringify({ ok: true, msgs: r.results }), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
  } catch { return new Response(JSON.stringify({ ok: false, msgs: [] }), { status: 500, headers: { 'content-type': 'application/json' } }); }
};
