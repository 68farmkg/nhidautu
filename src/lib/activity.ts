// Nhật ký hoạt động. KHÔNG bao giờ ghi nội dung biểu mẫu, mật khẩu hay mã bí mật: chỉ hành động, đối tượng và tóm tắt ngắn.
import { all, first, run, nowIso } from './util';

export const ACTIONS: Record<string, string> = {
  login: 'Đăng nhập', login_fail: 'Đăng nhập sai', logout: 'Đăng xuất',
  'user.add': 'Tạo tài khoản', 'user.role': 'Sửa tài khoản', 'user.toggle': 'Khóa/mở khóa tài khoản', 'user.pw': 'Đặt lại mật khẩu', 'user.delete': 'Xóa tài khoản',
  'role.save': 'Lưu vai trò', 'role.delete': 'Xóa vai trò',
  'post.create': 'Tạo bài viết', 'post.update': 'Sửa bài viết', 'post.delete': 'Xóa bài viết',
  'term.save': 'Lưu chuyên mục/thẻ', 'term.delete': 'Xóa chuyên mục/thẻ', 'term.up': 'Sắp xếp chuyên mục', 'term.down': 'Sắp xếp chuyên mục',
  'theme.save': 'Lưu giao diện', 'theme.reset': 'Đặt lại giao diện',
  'block.save': 'Lưu khối dùng lại', 'block.delete': 'Xóa khối dùng lại',
  'backup.export': 'Tải bản sao lưu', 'backup.restore': 'Khôi phục sao lưu',
  'admin.write': 'Thao tác quản trị',
};
export const GROUPS: Record<string, string[]> = {
  login: ['login', 'login_fail', 'logout'],
  user: ['user.add', 'user.role', 'user.toggle', 'user.pw', 'user.delete', 'role.save', 'role.delete'],
  content: ['post.create', 'post.update', 'post.delete', 'term.save', 'term.delete', 'term.up', 'term.down', 'theme.save', 'theme.reset', 'block.save', 'block.delete', 'backup.export', 'backup.restore'],
};
const ready = new WeakSet<object>();
export async function ensureActivity(db: any) {
  if (ready.has(db)) return;
  await run(db, "CREATE TABLE IF NOT EXISTS activity_log (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, uid INTEGER DEFAULT 0, actor TEXT DEFAULT '', action TEXT NOT NULL, obj TEXT DEFAULT '', summary TEXT DEFAULT '', ip TEXT DEFAULT '')");
  await run(db, 'CREATE INDEX IF NOT EXISTS idx_act_at ON activity_log(at)');
  await run(db, 'CREATE INDEX IF NOT EXISTS idx_act_action ON activity_log(action)');
  ready.add(db);
}
export type Entry = { uid?: number; actor?: string; action: string; obj?: string; summary?: string; ip?: string };
// Ghi nhật ký không bao giờ làm hỏng thao tác chính. Giữ 365 ngày; dọn bản cũ thỉnh thoảng (1/50 lần ghi).
export async function logAct(db: any, e: Entry): Promise<void> {
  try {
    await ensureActivity(db);
    await run(db, 'INSERT INTO activity_log (at,uid,actor,action,obj,summary,ip) VALUES (?,?,?,?,?,?,?)', nowIso(), e.uid || 0, String(e.actor || '').slice(0, 60), String(e.action).slice(0, 40), String(e.obj || '').slice(0, 60), String(e.summary || '').slice(0, 200), String(e.ip || '').slice(0, 45));
    if (Math.random() < 0.02) await run(db, 'DELETE FROM activity_log WHERE at < ?', new Date(Date.now() - 365 * 86400000).toISOString());
  } catch { /* bỏ qua */ }
}
export type Q = { nhom?: string; action?: string; q?: string; page?: number; per?: number };
export async function listAct(db: any, o: Q) {
  await ensureActivity(db);
  const w: string[] = [], a: any[] = [];
  const acts = o.action ? [o.action] : o.nhom ? GROUPS[o.nhom] : null;
  if (acts) { w.push(`action IN (${acts.map(() => '?').join(',')})`); a.push(...acts); }
  const q = (o.q || '').trim().slice(0, 60);
  if (q) { w.push('(actor LIKE ? OR summary LIKE ? OR obj LIKE ?)'); const l = `%${q.replace(/[%_]/g, '')}%`; a.push(l, l, l); }
  const where = w.length ? 'WHERE ' + w.join(' AND ') : '', per = o.per || 30, page = Math.max(1, o.page || 1);
  const total = (await first(db, `SELECT COUNT(*) n FROM activity_log ${where}`, ...a))?.n || 0;
  const rows = await all(db, `SELECT * FROM activity_log ${where} ORDER BY id DESC LIMIT ? OFFSET ?`, ...a, per, (page - 1) * per);
  return { rows, total, pages: Math.max(1, Math.ceil(total / per)), page };
}
