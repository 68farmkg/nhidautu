// Cây menu quản trị kiểu WordPress. Chỉ liệt kê trang ĐÃ có thật; trang mới thêm vào đây khi làm xong.
// [đường dẫn, nhãn, khóa active, icon]. subs: mục con (hiện khi đang ở nhóm đó). need: điều kiện hiển thị.
export type Sub = [string, string, string];
export type Node = { h: string; l: string; k: string; ic: string; subs?: Sub[]; need?: 'pb' | 'chatpro' | 'chatlite' };
export type Group = { g: string; items: Node[] };

export const NAV: Group[] = [
  { g: 'Bảng điều khiển', items: [{ h: '/admin', l: 'Tổng quan', k: 'home', ic: 'home' }] },
  { g: 'Nội dung', items: [
    { h: '/admin/bai-viet', l: 'Bài viết', k: 'posts', ic: 'news', subs: [['/admin/bai-viet', 'Tất cả bài viết', 'posts'], ['/admin/bai-viet/moi', 'Viết bài mới', 'posts-new'], ['/admin/bai-viet/chuyen-muc', 'Chuyên mục', 'posts-cats'], ['/admin/bai-viet/the', 'Thẻ', 'posts-tags']] },
    { h: '/admin/trang', l: 'Trang', k: 'pages', ic: 'file', need: 'pb', subs: [['/admin/trang', 'Tất cả trang', 'pages'], ['/admin/pb/moi', 'Thêm trang mới', 'pages-new'], ['/admin/trang/danh-muc', 'Danh mục trang', 'pages-cats']] },
    { h: '/admin/trang', l: 'Trang', k: 'pages', ic: 'file' },
  ] },
  { g: 'Liên hệ & Chat', items: [
    { h: '/admin/hop-thu', l: 'Hộp thư', k: 'msg', ic: 'mail', need: 'chatpro' },
    { h: '/admin/chat', l: 'Chat khách', k: 'chat', ic: 'message', need: 'chatpro' },
    { h: '/admin/hop-thu', l: 'Hộp thư & chat', k: 'msg', ic: 'message', need: 'chatlite' },
  ] },
  { g: 'Giao diện', items: [
    { h: '/admin/giao-dien', l: 'Tùy chỉnh giao diện', k: 'theme', ic: 'settings', subs: [['/admin/giao-dien#mau', 'Màu sắc', 'theme'], ['/admin/giao-dien#header', 'Header', 'theme-header'], ['/admin/giao-dien#footer', 'Footer', 'theme-footer']] },
    { h: '/admin/khoi-dung-lai', l: 'Khối dùng lại', k: 'blocks', ic: 'puzzle' },
    { h: '/admin/menu', l: 'Menu & chân trang', k: 'menu', ic: 'menu' },
    { h: '/admin/tien-ich', l: 'Tiện ích & plugin', k: 'tools', ic: 'puzzle' },
  ] },
  { g: 'Công cụ', items: [
    { h: '/admin/ai', l: 'AI Content Studio', k: 'ai', ic: 'bot' },
    { h: '/admin/rss', l: 'Tin RSS các báo', k: 'rss', ic: 'rss' },
    { h: '/admin/ma-chung-khoan', l: 'Danh bạ mã 3 sàn', k: 'market', ic: 'chart', subs: [['/admin/ma-chung-khoan', 'Tất cả mã HOSE · HNX · UPCoM', 'market'], ['/admin/thi-truong', 'Chỉ số & sửa tay', 'market']] },
  ] },
  { g: 'Cài đặt & tài khoản', items: [
    { h: '/admin/cai-dat', l: 'Cài đặt website', k: 'site', ic: 'settings', subs: [['/admin/cai-dat', 'Thông tin chung', 'site'], ['/admin/cai-dat#chat', 'Chat & hộp thư gửi', 'site-chat'], ['/admin/cai-dat-ai', 'Cài đặt AI (API)', 'aiset']] },
    { h: '/admin/nguoi-dung', l: 'Người dùng & quyền', k: 'users', ic: 'user', subs: [['/admin/nguoi-dung', 'Tất cả tài khoản', 'users'], ['/admin/nguoi-dung/vai-tro', 'Vai trò & quyền', 'users-roles'], ['/admin/nhat-ky?nhom=login', 'Lịch sử đăng nhập', 'users-logins']] },
    { h: '/admin/sao-luu', l: 'Sao lưu & khôi phục', k: 'backup', ic: 'shield' },
    { h: '/admin/nhat-ky', l: 'Nhật ký hoạt động', k: 'logs', ic: 'shield' },
    { h: '/admin/tai-khoan', l: 'Tài khoản của tôi', k: 'acct', ic: 'settings' },
  ] },
];

// Một nút "Trang" có 2 biến thể (plugin bật / tắt): giữ biến thể đầu tiên thỏa điều kiện.
export function visible(groups: Group[], ctx: { pb: boolean; chatPro: boolean }, allow: (path: string) => boolean): Group[] {
  const ok = (n: Node) => (n.need === 'pb' ? ctx.pb : n.need === 'chatpro' ? ctx.chatPro : n.need === 'chatlite' ? !ctx.chatPro : true);
  return groups.map((gr) => {
    const seen = new Set<string>();
    const items = gr.items.filter(ok).filter((n) => allow(n.h) && !seen.has(n.k) && !!seen.add(n.k))
      .map((n) => ({ ...n, subs: (n.subs || []).filter((s) => allow(s[0])) }));
    return { g: gr.g, items };
  }).filter((gr) => gr.items.length);
}
// Nhóm đang mở: khóa active trùng mục cha hoặc một mục con (kể cả dạng "pages-xxx").
export const isOpen = (n: Node, active: string) => !!n.subs?.length && (active === n.k || active.startsWith(n.k + '-') || n.subs.some((s) => s[2] === active));
export const isOn = (n: Node, active: string) => active === n.k || (!!n.subs?.length && active.startsWith(n.k + '-') && !n.subs.some((s) => s[2] === active));
