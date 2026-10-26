import type { APIRoute } from 'astro';
import { handleApi } from '../../lib/pb/api';

// API của Page Builder Pro. Middleware đã bắt buộc đăng nhập + đúng nguồn gốc (CSRF theo Origin); handleApi kiểm thêm mã HMAC theo phiên.
export const POST: APIRoute = async ({ request, locals, cookies }) => {
  const env = (locals as any).runtime.env, u = (locals as any).user || { uid: 0, role: 'admin', name: '' };
  const json = (o: any, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
  if (Number(request.headers.get('content-length') || 0) > 1_800_000) return json({ ok: false, error: 'Dữ liệu quá lớn' }, 413);
  let body: any = null; try { body = await request.json(); } catch { return json({ ok: false, error: 'JSON không hợp lệ' }, 400); }
  const r = await handleApi({ db: env.DB, env, user: { uid: u.uid, role: u.role, name: u.name }, token: request.headers.get('x-pb-token') || '', cookie: cookies.get('nhip_admin')?.value || '', body });
  return json(r.json, r.status);
};
