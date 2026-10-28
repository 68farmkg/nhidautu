import { defineMiddleware } from 'astro:middleware';
import { readSession } from './lib/auth';
import { canU } from './lib/perm';
import { capsOf } from './lib/roles';
import { logAct } from './lib/activity';
import { ensureChatSchema } from './lib/chatschema';
import { pluginOn } from './lib/chatcfg';
import { setNhipEnv } from './lib/nhip-data';

const denied = '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Không đủ quyền</title><body style="font-family:system-ui;max-width:420px;margin:15vh auto;padding:0 16px"><h2>Bạn chưa có quyền vào mục này</h2><p>Tài khoản của bạn không được cấp quyền cho trang này. Hãy nhờ quản trị viên cấp thêm quyền.</p><p><a href="/admin">Về trang tổng quan</a></p></body>';

// Chống CSRF: yêu cầu ghi (POST/PUT/PATCH/DELETE) vào khu quản trị phải cùng nguồn gốc (Origin trùng, hoặc Sec-Fetch-Site same-origin).
const WRITE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
// API nền/tự động lưu: không ghi nhật ký chung (nếu cần, từng chức năng tự ghi điểm quan trọng)
const QUIET = /^\/admin\/(chat-poll|chat-api|mail-api|pb-api|pb-preview|xem-truoc|chat-config)(\/|$)/;
function crossSite(req: Request, origin: string) {
  const o = req.headers.get('origin'), sf = req.headers.get('sec-fetch-site');
  if (o) return o !== origin;
  if (sf) return sf !== 'same-origin' && sf !== 'none';
  return false;
}
export const onRequest = defineMiddleware(async (context, next) => {
  const p = context.url.pathname;
  setNhipEnv((context.locals as any).runtime?.env);
  if (p.startsWith('/admin') || p.startsWith('/api/chat')) { try { await ensureChatSchema((context.locals as any).runtime.env.DB); } catch { /* bỏ */ } }
  if ((p.startsWith('/admin') || p.startsWith('/api/px/')) && WRITE.has(context.request.method) && crossSite(context.request, context.url.origin)) {
    return new Response('Yêu cầu bị chặn (khác nguồn gốc)', { status: 403 });
  }
  if (p.startsWith('/admin') && p !== '/admin/login') {
    const env = (context.locals as any).runtime.env;
    if (!env.ADMIN_PASSWORD) return new Response('Chưa cài ADMIN_PASSWORD trong Cloudflare. Xem HUONG-DAN.md', { status: 500 });
    const s = await readSession(env, context.cookies.get('nhip_admin')?.value);
    if (!s) return context.redirect('/admin/login');
    if (s.uid > 0) { // người dùng trong bảng users: kiểm tra còn hoạt động và lấy vai trò mới nhất
      try {
        const u: any = await env.DB.prepare('SELECT role,active,name FROM users WHERE id=?').bind(s.uid).first();
        if (!u || !u.active) { context.cookies.delete('nhip_admin', { path: '/' }); return context.redirect('/admin/login'); }
        s.role = u.role; s.name = u.name || s.name;
      } catch { return context.redirect('/admin/login'); }
    }
    if (s.role !== 'admin') { try { (s as any).caps = await capsOf(env.DB, s.role); } catch { (s as any).caps = []; } }
    (context.locals as any).user = s;
    // Ghi nhật ký có chi tiết từ từng trang: await Astro.locals.log('post.update', 'post:5', 'Tiêu đề'). Không ghi nội dung biểu mẫu/mật khẩu.
    const ip = context.request.headers.get('cf-connecting-ip') || '';
    (context.locals as any).log = (action: string, obj = '', summary = '') => { (context.locals as any).actLogged = true; return logAct(env.DB, { uid: s.uid, actor: s.name || 'Chủ website', action, obj, summary, ip }); };
    // Trang của plugin Chat Pro chỉ mở khi đã cài/bật trong Tiện ích & plugin
    if (/^\/admin\/(chat|chat-api|chat-config)(\/|$)/.test(p) && !(await pluginOn(env.DB, 'chat-pro'))) {
      if (/-(api|config)$/.test(p)) return new Response(JSON.stringify({ ok: false, error: 'Plugin Hộp thư & Chat Pro chưa được cài. Vào Tiện ích & plugin để cài.' }), { status: 409, headers: { 'content-type': 'application/json' } });
      return context.redirect('/admin/tien-ich?tab=dc&p=chat-pro');
    }
    if (!canU(s as any, p)) return new Response(denied, { status: 403, headers: { 'content-type': 'text/html; charset=utf-8' } });
  }
  const res = await next();
  const L = context.locals as any;
  if (p.startsWith('/admin') && L.user && WRITE.has(context.request.method) && !L.actLogged && res.status < 400 && !QUIET.test(p)) {
    await logAct((L.runtime.env).DB, { uid: L.user.uid, actor: L.user.name || 'Chủ website', action: 'admin.write', obj: p.slice(0, 60), summary: `${context.request.method} ${p}`, ip: context.request.headers.get('cf-connecting-ip') || '' });
  }
  if (p.startsWith('/admin')) res.headers.set('Cache-Control', 'no-store');
  return res;
});
