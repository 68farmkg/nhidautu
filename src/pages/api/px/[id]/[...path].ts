import type { APIRoute } from 'astro';
import { getEntry, getSettings, logPx } from '../../../../lib/px/registry';
import { readSession } from '../../../../lib/auth';

// Cổng API cho plugin mã nguồn: /api/px/<id>/<đường dẫn>. Chỉ plugin ĐANG BẬT; mặc định yêu cầu đăng nhập admin.
// Plugin công khai phải khai báo public:true rõ ràng và tự giới hạn tần suất (dùng lib/ratelimit).
const json = (o: any, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const handle: APIRoute = async ({ params, request, locals, cookies, url }) => {
  const env = (locals as any).runtime.env, db = env.DB;
  const e = await getEntry(db, String(params.id));
  if (!e || !e.active || !e.builtin?.routes) return json({ ok: false, error: 'not_found' }, 404);
  const path = String(params.path || '');
  const r = e.builtin.routes.find((x) => x.path === path && x.method === request.method);
  if (!r) return json({ ok: false, error: 'not_found' }, 404);
  let user: any = null;
  if (!r.public) {
    const s = await readSession(env, cookies.get('nhip_admin')?.value);
    if (!s) return json({ ok: false, error: 'unauthorized' }, 401);
    if (s.uid > 0) { const u: any = await db.prepare('SELECT role,active FROM users WHERE id=?').bind(s.uid).first().catch(() => null); if (!u || !u.active) return json({ ok: false, error: 'unauthorized' }, 401); s.role = u.role; }
    if (s.role !== 'admin') return json({ ok: false, error: 'forbidden' }, 403);
    user = s;
  }
  try { return await r.handler({ db, env, url, request, settings: await getSettings(db, e), user, params: path.split('/') }); }
  catch (x: any) { await logPx(db, e.id, 'api-error', `${request.method} ${path}: ${x?.message || x}`); return json({ ok: false, error: 'plugin_error' }, 500); }
};
export const GET = handle, POST = handle;
