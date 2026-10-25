// Phân quyền theo vai trò. admin: toàn quyền. Các vai trò khác chỉ vào được các đường dẫn liệt kê.
export const ROLES: Record<string, string> = {
  admin: 'Quản trị viên (toàn quyền)',
  editor: 'Biên tập viên (trang, bài viết, AI, RSS, số liệu)',
  support: 'Chăm sóc khách hàng (hộp thư, chat khách)',
};
const ALLOW: Record<string, string[]> = {
  editor: ['/admin/trang', '/admin/bai-viet', '/admin/ai', '/admin/rss', '/admin/thi-truong', '/admin/xem-truoc', '/admin/tai-khoan'],
  support: ['/admin/hop-thu', '/admin/chat', '/admin/chat-api', '/admin/mail-api', '/admin/chat-poll', '/admin/tin-nhan', '/admin/tai-khoan'],
};
export function can(role: string, path: string): boolean {
  if (role === 'admin') return true;
  if (path === '/admin' || path === '/admin/' || path.startsWith('/admin/logout')) return true;
  return (ALLOW[role] || []).some((p) => path === p || path.startsWith(p + '/'));
}
