import type { Plugin } from '../../lib/plugins';

// Ứng dụng NHỊP (nhip-19) chạy trọn bộ tại /nhip/ (thư mục public/nhip). Dữ liệu giá/tin đi qua /proxy/* -> kho hub nhip-18.
const PAGES = ['dashboard', 'tong-quan', 'thi-truong', 'phan-tich', 'danh-muc', 'giao-dich', 'theo-doi', 'canh-bao', 'tin-tuc', 'ai', 'lich-su', 'cai-dat'];
const page = (s: any) => (PAGES.includes(String(s)) ? String(s) : 'tong-quan');

const plugin: Plugin = {
  id: 'nhip-app', name: 'Ứng dụng NHỊP (đầy đủ)', icon: 'chart', version: '1.0',
  desc: 'Toàn bộ giao diện NHỊP bản 19: Dashboard, Biểu đồ, Thị trường, Phân tích, Danh mục, Giao dịch, Theo dõi, Cảnh báo, Tin tức, Phân tích AI, Lịch sử, Cài đặt. Dữ liệu API/RSS lấy từ hub nhip-18.',
  open: '/nhip/', openLabel: 'Mở ứng dụng NHỊP',
  blocks: [
    { type: 'nhip-embed', label: 'Nhúng ứng dụng NHỊP', icon: 'chart', group: 'Chứng khoán', fields: [
      { k: 'page', label: 'Trang mở sẵn (' + PAGES.join(', ') + ')', def: 'tong-quan' },
      { k: 'height', label: 'Chiều cao (px)', type: 'number', def: 780 }],
      render: (p) => `<iframe src="/nhip/#/${page(p.page)}" title="Ứng dụng NHỊP" loading="lazy" style="width:100%;height:${Math.min(1600, Math.max(400, Number(p.height) || 780))}px;border:1px solid #dfe5ec;border-radius:12px;background:#fff"></iframe>` },
  ],
};
export default plugin;
