import type { Plugin } from '../../lib/plugins';
import { esc } from '../../lib/esc';
import { DDL_V1, DDL_CATS } from '../../lib/pb/ddl';
import { PRO_BLOCKS } from '../../lib/pb/blocks-pro';

// Plugin "Page Builder Pro" (plugin mã nguồn, mặc định TẮT; cài trong Admin > Tiện ích & plugin).
// Phần lớn mã nằm ở:
//  - src/lib/pb/*            (schema JSON, CSS an toàn, lưu trữ D1, API, mẫu có sẵn, render trang)
//  - src/pages/admin/pb/     (trình dựng) · admin/pb-api.ts · admin/pb-preview.astro
//  - public/pb.js, pb-canvas.js, pb.css   (giao diện trình dựng kéo thả)
//  - src/styles/pb.css       (CSS hiển thị trên giao diện khách)
// Chưa cài: mọi thứ chạy như cũ (trình dựng cũ ở /admin/trang/<id>). Đã cài: /admin/trang/<id> chuyển sang trình dựng Pro; vẫn mở được bản cũ bằng ?basic=1.
const plugin: Plugin = {
  id: 'page-builder', name: 'Page Builder Pro', icon: 'layers', version: '1.1.0', category: 'Giao diện', author: 'Nhịp Đầu Tư', defaultOff: true,
  desc: 'Trình dựng trang kéo thả kiểu UX Builder: xem trước máy tính/tablet/điện thoại, hoàn tác, bản nháp & xuất bản, thư viện mẫu, lịch sử phiên bản, SEO + Schema.',
  permissions: ['admin.menu', 'admin.settings', 'frontend.blocks', 'content.read', 'market.read'],
  open: '/admin/trang', openLabel: 'Mở danh sách Trang', settingsUrl: '/admin/tien-ich',
  features: [
    'Canvas là trang thật (render bằng chính giao diện khách), bấm chọn khối, kéo thả, sửa chữ trực tiếp',
    'Xem trước Máy tính / Tablet / Điện thoại bằng khung thật (media query chạy đúng)',
    'Hoàn tác / làm lại, tự lưu nháp, Xuất bản tách khỏi Lưu nháp, 50 phiên bản có khôi phục',
    'Bảng cấu hình theo khối: nội dung, màu, font, khoảng cách, kích thước, nền, viền, hiệu ứng, responsive, điều kiện hiển thị, khóa quyền',
    'Thư viện mẫu trang & mẫu khối, tạo/nhân bản/nhập/xuất/chia sẻ mẫu, khối dùng chung nhiều trang',
    'Menu con “Trang” trong sidebar: Tất cả trang · Thêm trang mới · Danh mục trang · Giao diện & Menu; phân loại trang theo danh mục',
    'SEO: tiêu đề, mô tả, canonical, noindex, Schema.org JSON-LD, sitemap.xml tự động',
    'Lưu ý: ZIP plugin không thêm được route/mã máy chủ; plugin này là plugin mã nguồn nên cần build + deploy một lần',
  ],
  settings: [
    { k: 'autosave', label: 'Tự lưu nháp sau mỗi (giây, 0 = tắt)', type: 'number', def: 30 },
    { k: 'cache', label: 'Đệm trang công khai ở Cloudflare (giây, 0 = tắt)', type: 'number', def: 30, hint: 'Trang xuất bản có thể chậm cập nhật tối đa chừng này giây.' },
  ],
  migrations: [{ id: '001-core', sql: DDL_V1 }, { id: '002-cats', sql: DDL_CATS }],
  blocks: PRO_BLOCKS,
  admin: async ({ db }) => {
    const n = async (sql: string) => { try { return ((await db.prepare(sql).first()) as any)?.n ?? 0; } catch { return 0; } };
    const [pub, drafts, tpl, re, ver] = await Promise.all([n("SELECT COUNT(*) n FROM pages WHERE status='published' AND is_template=0"), n('SELECT COUNT(*) n FROM px_page_builder_drafts'), n('SELECT COUNT(*) n FROM px_page_builder_templates'), n('SELECT COUNT(*) n FROM px_page_builder_reusable'), n('SELECT COUNT(*) n FROM px_page_builder_versions')]);
    const cell = (a: any, b: string) => `<div class="box"><b style="font-size:26px">${esc(a)}</b><div class="meta">${esc(b)}</div></div>`;
    return `<div class="cards" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));display:grid;gap:12px">${cell(pub, 'Trang đã xuất bản')}${cell(drafts, 'Bản nháp chưa xuất bản')}${cell(ver, 'Phiên bản đã lưu')}${cell(tpl, 'Mẫu của bạn')}${cell(re, 'Khối dùng chung')}</div>
      <div class="box" style="margin-top:12px"><b>Bắt đầu</b><p class="meta">Vào <a href="/admin/trang">Trang</a> → “Thêm trang mới” để mở trình dựng. Chọn mẫu ở cột trái, bấm vào khối trên trang để chỉnh ở cột phải.</p><div class="acts"><a class="btn sm" href="/admin/pb/moi">Thêm trang mới</a><a class="btn ghost sm" href="/sitemap.xml" target="_blank">Xem sitemap.xml</a></div></div>`;
  },
};
export default plugin;
