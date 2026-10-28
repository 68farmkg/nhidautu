// Phân quyền theo "quyền hành động" (capability) gắn với đường dẫn. admin: toàn quyền.
// Đường dẫn không nằm trong PATH_CAP (cài đặt, plugin, người dùng, menu, API khóa...) chỉ admin vào được.
export const ROLES: Record<string, string> = {
  admin: 'Quản trị viên (toàn quyền)',
  editor: 'Biên tập viên (trang, bài viết, AI, RSS, số liệu)',
  support: 'Chăm sóc khách hàng (hộp thư, chat khách)',
};
// assignable=false: không bao giờ gán được cho vai trò tùy chỉnh (tránh leo thang quyền).
export const CAPS: Record<string, { label: string; assignable: boolean }> = {
  posts: { label: 'Bài viết, chuyên mục, thẻ', assignable: true },
  pages: { label: 'Trang', assignable: true },
  builder: { label: 'Trình dựng trang (Page Builder)', assignable: true },
  preview: { label: 'Xem trước nội dung', assignable: true },
  ai: { label: 'AI Content Studio', assignable: true },
  rss: { label: 'Tin RSS', assignable: true },
  market: { label: 'Số liệu thị trường', assignable: true },
  inbox: { label: 'Hộp thư liên hệ', assignable: true },
  chat: { label: 'Chat khách hàng', assignable: true },
  self: { label: 'Tài khoản của tôi', assignable: false },
  logs: { label: 'Nhật ký hoạt động', assignable: false },
};
export const ASSIGNABLE = Object.keys(CAPS).filter((k) => CAPS[k].assignable);
export const ROLE_CAPS: Record<string, string[]> = {
  editor: ['posts', 'pages', 'builder', 'preview', 'ai', 'rss', 'market', 'self'],
  support: ['inbox', 'chat', 'self'],
};
// Khớp theo "đúng đường dẫn hoặc đường dẫn con" (giống bản cũ).
const PATH_CAP: [string, string][] = [
  ['/admin/bai-viet', 'posts'], ['/admin/trang', 'pages'], ['/admin/pb', 'builder'], ['/admin/pb-api', 'builder'], ['/admin/pb-preview', 'builder'],
  ['/admin/xem-truoc', 'preview'], ['/admin/ai', 'ai'], ['/admin/rss', 'rss'], ['/admin/thi-truong', 'market'], ['/admin/ma-chung-khoan', 'market'],
  ['/admin/hop-thu', 'inbox'], ['/admin/mail-api', 'inbox'], ['/admin/tin-nhan', 'inbox'],
  ['/admin/chat', 'chat'], ['/admin/chat-api', 'chat'], ['/admin/chat-poll', 'chat'],
  ['/admin/tai-khoan', 'self'], ['/admin/nhat-ky', 'logs'],
];
export const capForPath = (path: string): string => PATH_CAP.find(([p]) => path === p || path.startsWith(p + '/'))?.[1] || '';
const basic = (path: string) => path === '/admin' || path === '/admin/' || path.startsWith('/admin/logout');

export function canCaps(caps: Iterable<string>, path: string): boolean {
  if (basic(path)) return true;
  const c = capForPath(path);
  return !!c && new Set(caps).has(c);
}
// Tương thích bản cũ: chỉ biết vai trò dựng sẵn.
export function can(role: string, path: string): boolean {
  if (role === 'admin') return true;
  return canCaps(ROLE_CAPS[role] || [], path);
}
// Dùng cho người dùng đã đăng nhập: ưu tiên danh sách quyền đã nạp (hỗ trợ vai trò tùy chỉnh).
export function canU(u: { role: string; caps?: string[] } | null | undefined, path: string): boolean {
  if (!u || u.role === 'admin') return true;
  return canCaps(u.caps ?? ROLE_CAPS[u.role] ?? [], path);
}
