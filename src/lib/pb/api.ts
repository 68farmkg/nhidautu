// Page Builder Pro: API JSON cho trình dựng (POST /admin/pb-api). Đăng nhập + vai trò đã được middleware kiểm tra;
// ở đây kiểm tra thêm mã CSRF (HMAC theo phiên), quyền theo hành động, schema dữ liệu và giới hạn tần suất AI.
import { activeDefs, defsToMap, cleanBlocks, type Block } from '../blocks';
import { blockDefs, emit } from '../px/registry';
import { safeEq } from '../auth';
import { ask } from '../ai';
import { allow } from '../ratelimit';
import { slugify } from '../util';
import { validateDoc, emptyDoc, docFromPage, type Doc } from './schema';
import { seedList } from './seed';
import * as S from './store';

export type ApiUser = { uid: number; role: string; name: string };
export type ApiCtx = { db: any; env: any; user: ApiUser; token: string; cookie: string; body: any };
export type ApiRes = { status: number; json: any };

const enc = new TextEncoder();
export async function pbToken(env: any, cookie: string): Promise<string> {
  const k = await crypto.subtle.importKey('raw', enc.encode(`${env.SESSION_SECRET || 'nhip'}|pb|${env.ADMIN_PASSWORD || ''}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(cookie || 'none')));
  let s = ''; sig.forEach((c) => (s += c.toString(16).padStart(2, '0'))); return s;
}
const ok = (o: any = {}): ApiRes => ({ status: 200, json: { ok: true, ...o } });
const bad = (error: string, status = 400, extra: any = {}): ApiRes => ({ status, json: { ok: false, error, ...extra } });
const int = (v: any) => (Number.isInteger(Number(v)) && Number(v) >= 0 ? Number(v) : 0);
const who = (u: ApiUser) => `${(u.name || 'Chủ website').slice(0, 40)}#${u.uid}`;

export async function defsFor(db: any) { return { defs: defsToMap(await activeDefs(db)), known: defsToMap((await blockDefs(db, false)) as any) }; }
const cleanTree = async (db: any, blocks: any, admin: boolean): Promise<Block[]> => { const d = await defsFor(db); return cleanBlocks(blocks, { admin, defs: d.defs, known: d.known }); };

export async function handleApi(c: ApiCtx): Promise<ApiRes> {
  const { db, user, body } = c, admin = user.role === 'admin';
  if (!body || typeof body !== 'object' || typeof body.action !== 'string') return bad('Yêu cầu không hợp lệ');
  if (!c.token || !safeEq(c.token, await pbToken(c.env, c.cookie))) return bad('Mã bảo vệ (CSRF) không hợp lệ. Hãy tải lại trang.', 403);
  try { await S.ensurePb(db); } catch (e: any) { return bad('Chưa tạo được bảng dữ liệu: ' + (e?.message || e), 500); }
  const id = int(body.id), owner = String(user.uid);

  switch (body.action) {
    case 'save': case 'publish': {
      const publish = body.action === 'publish';
      const live = id ? await S.getLiveDoc(db, id) : null;
      if (id && !live) return bad('Không tìm thấy trang', 404);
      const dr = id ? await S.getDraft(db, id) : null;
      const d = await defsFor(db);
      const v = validateDoc(body.doc, { admin, old: dr?.doc || live, defs: d.defs, known: d.known });
      if (!v.ok) return bad(v.errors.join(' '), 422, { errors: v.errors });
      if (v.doc.meta.cat && !(await S.getCat(db, v.doc.meta.cat))) v.doc.meta.cat = 0;
      let pid = id, slug = v.doc.slug;
      if (!pid) { const r = await S.createPage(db, v.doc); pid = r.id; slug = r.slug; }
      if (publish) {
        const r = await S.publishDoc(db, pid, v.doc, who(user), String(body.note || ''), body.pub !== false); slug = r.slug;
        await emit(db, 'page.saved', { id: pid, slug }).catch(() => 0);
        return ok({ id: pid, slug, published: body.pub !== false, warnings: v.warnings, savedAt: new Date().toISOString() });
      }
      await S.saveDraft(db, pid, { ...v.doc, slug }, who(user));
      return ok({ id: pid, slug, warnings: v.warnings, savedAt: new Date().toISOString() });
    }
    case 'unpublish': { if (!id || !(await S.getPage(db, id))) return bad('Không tìm thấy trang', 404); await S.unpublish(db, id); return ok(); }
    case 'discard-draft': { if (!id) return bad('Thiếu id'); await S.deleteDraft(db, id); const l = await S.getLiveDoc(db, id); return l ? ok({ doc: l }) : bad('Không tìm thấy trang', 404); }
    case 'versions': return ok({ versions: id ? await S.listVersions(db, id) : [] });
    case 'version': { const doc = await S.getVersion(db, id, int(body.vid)); return doc ? ok({ doc }) : bad('Không tìm thấy phiên bản', 404); }
    case 'dup': {
      const l = await S.getLiveDoc(db, id); if (!l) return bad('Không tìm thấy trang', 404);
      const r = await S.createPage(db, { ...l, title: l.title + ' (bản sao)', slug: l.slug + '-ban-sao' });
      await emit(db, 'page.saved', { id: r.id, slug: r.slug }).catch(() => 0); return ok({ id: r.id, slug: r.slug });
    }
    case 'validate': { // dùng cho nhập trang từ tệp JSON
      const d = await defsFor(db); const raw = body.doc && typeof body.doc === 'object' ? { ...body.doc, v: body.doc.v ?? 1 } : null;
      const v = validateDoc(raw, { admin, old: null, defs: d.defs, known: d.known }); return v.ok ? ok({ doc: v.doc, warnings: v.warnings }) : bad(v.errors.join(' '), 422);
    }
    case 'delete-page': {
      if (!admin) return bad('Chỉ quản trị viên được xóa trang', 403); const pg = await S.getPage(db, id); if (!pg) return bad('Không tìm thấy trang', 404);
      for (const t of ['px_page_builder_drafts', 'px_page_builder_meta']) await db.prepare(`DELETE FROM ${t} WHERE page_id=?`).bind(id).run();
      await db.prepare('DELETE FROM px_page_builder_versions WHERE page_id=?').bind(id).run(); await db.prepare('DELETE FROM pages WHERE id=?').bind(id).run(); return ok();
    }
    case 'page-cat': { // đổi danh mục ngay từ danh sách trang, không cần mở trình dựng
      const c = int(body.cat); if (!id || !(await S.getPage(db, id))) return bad('Không tìm thấy trang', 404); if (c && !(await S.getCat(db, c))) return bad('Danh mục không tồn tại', 404);
      await S.setPageCat(db, id, c); const dr = await S.getDraft(db, id); if (dr) { dr.doc.meta = { ...dr.doc.meta, cat: c }; await S.saveDraft(db, id, dr.doc, who(user)); }
      return ok();
    }
    case 'check-slug': { const s = slugify(String(body.slug || '')); return ok({ slug: await S.uniqueSlug(db, s, id) }); }

    case 'tpl-list': {
      const rows = await S.listTemplates(db, owner, admin);
      const mine = rows.map((r) => { let blocks: any[] = []; try { blocks = JSON.parse(r.doc).blocks || []; } catch { /* bỏ */ } return { id: 't:' + r.id, name: r.name, kind: r.kind, category: r.category, desc: r.descr, builtin: false, shared: !!r.shared, mine: r.owner === owner, blocks }; });
      return ok({ templates: [...seedList(), ...mine] });
    }
    case 'tpl-save': {
      const name = String(body.name || '').trim(); if (!name) return bad('Hãy đặt tên mẫu');
      const blocks = await cleanTree(db, body.blocks, admin); if (!blocks.length) return bad('Mẫu không có khối nào');
      const tid = await S.saveTemplate(db, { name, kind: body.kind, category: String(body.category || 'khac'), descr: String(body.desc || ''), doc: { v: 1, blocks }, shared: !!body.shared, owner });
      return ok({ id: tid });
    }
    case 'tpl-delete': { const t = await S.getTemplate(db, id); if (!t) return bad('Không tìm thấy mẫu', 404); if (!admin && t.owner !== owner) return bad('Bạn chỉ xóa được mẫu của mình', 403); await S.deleteTemplate(db, id); return ok(); }
    case 'tpl-export': {
      const t = await S.getTemplate(db, id); if (!t || (!admin && !t.shared && t.owner !== owner)) return bad('Không tìm thấy mẫu', 404);
      let blocks: any[] = []; try { blocks = JSON.parse(t.doc).blocks || []; } catch { /* bỏ */ }
      return ok({ file: { pbTemplate: 1, name: t.name, kind: t.kind, category: t.category, desc: t.descr, blocks } });
    }
    case 'tpl-import': {
      const f = body.data; if (!f || f.pbTemplate !== 1 || !Array.isArray(f.blocks)) return bad('Tệp không phải mẫu Page Builder (thiếu pbTemplate:1)');
      const blocks = await cleanTree(db, f.blocks, admin); if (!blocks.length) return bad('Tệp mẫu không có khối hợp lệ nào');
      const tid = await S.saveTemplate(db, { name: String(f.name || 'Mẫu nhập').trim() || 'Mẫu nhập', kind: f.kind, category: String(f.category || 'khac'), descr: String(f.desc || ''), doc: { v: 1, blocks }, shared: false, owner });
      return ok({ id: tid, dropped: Math.max(0, f.blocks.length - blocks.length) });
    }

    case 're-list': return ok({ items: await S.listReusable(db) });
    case 're-get': { const r: any = await S.getReusable(db, id); if (!r) return bad('Không tìm thấy', 404); let b: any = null; try { b = JSON.parse(r.block); } catch { /* bỏ */ } return ok({ block: b, name: r.name, usage: await S.reusableUsage(db, id) }); }
    case 're-save': {
      const name = String(body.name || '').trim(); if (!name) return bad('Hãy đặt tên');
      const b = (await cleanTree(db, [body.block], admin))[0]; if (!b || b.type === 'pb-reusable') return bad('Khối không hợp lệ');
      return ok({ id: await S.saveReusable(db, name, b, owner) });
    }
    case 're-update': {
      const r: any = await S.getReusable(db, id); if (!r) return bad('Không tìm thấy', 404); if (!admin && r.owner !== owner) return bad('Chỉ quản trị viên hoặc người tạo được cập nhật khối dùng chung', 403);
      const b = (await cleanTree(db, [body.block], admin))[0]; if (!b || b.type === 'pb-reusable') return bad('Khối không hợp lệ');
      await S.updateReusable(db, id, b); return ok({ usage: await S.reusableUsage(db, id) });
    }
    case 're-delete': {
      const r: any = await S.getReusable(db, id); if (!r) return bad('Không tìm thấy', 404); if (!admin && r.owner !== owner) return bad('Không đủ quyền', 403);
      const n = await S.reusableUsage(db, id); if (n > 0 && !body.force) return bad(`Khối đang được dùng ở khoảng ${n} trang. Xóa sẽ làm khối biến mất khỏi các trang đó.`, 409, { usage: n });
      await S.deleteReusable(db, id); return ok();
    }

    case 'ai': {
      const topic = String(body.topic || '').trim().slice(0, 600); if (topic.length < 5) return bad('Hãy mô tả nội dung cần viết (ít nhất 5 ký tự)');
      if (!(await allow(db, 'pb-ai:' + owner, 20, 3600))) return bad('Bạn đã dùng quá 20 lần/giờ cho AI. Hãy thử lại sau.', 429);
      const len = ({ short: '120-180 từ', mid: '250-350 từ', long: '450-600 từ' } as any)[body.len] || '250-350 từ';
      try {
        const r = await ask(c.env, db, { system: 'Bạn là biên tập viên tài chính tiếng Việt. Viết nội dung cho website đầu tư, trung lập, dễ hiểu, không hứa hẹn lợi nhuận, không khuyến nghị mua/bán chắc chắn, nêu rõ rủi ro khi cần. Chỉ dùng định dạng thuần: "## " cho đề mục, "- " cho gạch đầu dòng, đoạn cách nhau một dòng trống. Không dùng markdown khác, không HTML, không chèn link. Không bịa số liệu: nếu thiếu dữ liệu, nói rõ cần kiểm chứng.', user: `Chủ đề: ${topic}\nGiọng văn: ${String(body.tone || 'chuyên nghiệp').slice(0, 40)}\nĐộ dài: ${len}` });
        return ok({ text: r.text.replace(/<[^>]*>/g, '').slice(0, 6000), via: r.via });
      } catch (e: any) { return bad(String(e?.message || e).slice(0, 400), 502); }
    }
    default: return bad('Hành động không hỗ trợ: ' + body.action.slice(0, 30));
  }
}
export { emptyDoc, docFromPage };
export type { Doc };
