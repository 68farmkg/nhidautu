import type { Plugin } from '../../lib/plugins';

// Plugin "Hộp thư & Chat Pro" (plugin mã nguồn, mặc định TẮT, cài trong Admin > Tiện ích & plugin).
// Phần lớn mã nằm ở:
//  - src/lib/chat*.ts, mailer.ts, adminapi.ts      (cấu hình, AI, gửi mail, thông báo)
//  - src/pages/admin/chat, hop-thu, chat-api, chat-config, mail-api  (giao diện quản lý)
//  - src/pages/api/chat.ts, public/chat*.js, mail-admin.js           (cửa sổ chat khách, trang cài đặt)
//  - src/components/MailPro.astro                  (Hộp thư Pro; chưa cài thì dùng MailBasic.astro)
// Bảng dữ liệu được tạo tự động bởi lib/chatschema.ts (CREATE TABLE IF NOT EXISTS), hoặc chạy nang-cap-5-sach.sql.
// Trạng thái bật/tắt do hệ plugin quản lý (lib/px/registry.ts); chatcfg.pluginOn() đọc từ đó.
const plugin: Plugin = {
  id: 'chat-pro', name: 'Hộp thư & Chat Pro', icon: 'message', version: '2.0.0', category: 'Giao tiếp', author: 'Nhịp Đầu Tư', defaultOff: true,
  desc: 'Quản lý chat kiểu 3 cột, hộp thư tách riêng, 14 mẫu giao diện chat, bắt khách điền thông tin, Trợ lý AI nạp dữ liệu thị trường, chuyển nhân viên, nhiều hộp thư gửi.',
  permissions: ['admin.menu', 'admin.settings', 'content.read', 'market.read'],
  open: '/admin/chat', openLabel: 'Mở Chat khách', settingsUrl: '/admin/cai-dat#chat',
  features: [
    'Quản lý Chat 3 cột + Hộp thư tách riêng, trả lời bằng nhiều hộp thư gửi',
    '14 mẫu giao diện chat + chế độ tự xây',
    'Bắt khách điền tên/SĐT/email trước khi chat, thông báo và xác nhận',
    'Trợ lý AI nạp số liệu thị trường, bài viết, kiến thức riêng; chuyển nhân viên',
    'Gợi ý nhanh, trả lời nhanh, câu hỏi liên quan',
    'Lưu ý: plugin gọi dịch vụ ngoài (nhà AI, dịch vụ gửi mail, Telegram/webhook) theo cấu hình của bạn',
  ],
};
export default plugin;
