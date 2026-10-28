# Nhịp Đầu Tư × NHỊP 19 × Hub 18 — hướng dẫn nối dữ liệu

## Đã làm trong bản này
1. **Giao diện NHỊP trọn bộ** (nguyên 12 trang của nhip-19) nằm ở `public/nhip/` → mở tại `/nhip/`. Chỉ đổi đường dẫn tài nguyên `/x.js` → `/nhip/x.js`; không sửa logic.
2. **API/RSS giống hệt nhip-19**: `src/lib/nhip-worker.js` là bản sao nguyên văn `_worker.js` của nhip-19. Tuyến `src/pages/proxy/[...path].ts` chuyển mọi `/proxy/*` (rss, dchart, stocks, market, bctc, finfo, gnews, bing, article, linkcheck, ai, tts) cho mã đó. Thứ tự lấy dữ liệu: KV chung `NHIP_KV` → HTTP `HUB_URL/api/data` → gọi thẳng nguồn.
3. **Website cũng đọc từ hub**: `lib/rss.ts` (tin RSS ở Tin tức, khối Tin RSS, admin RSS) và `lib/market.ts` (cập nhật giá) thử hub trước, hỏng mới gọi nguồn gốc như cũ.
4. **Tiện ích → plugin “Biểu đồ”**: thêm khối **Biểu đồ NHỊP (KLineChart)** (nến, đường, MA, VOL, khung 1p→Tháng, đổi mã; màu/thang giá/chỉ báo như nhip-19). Thêm plugin **Ứng dụng NHỊP (đầy đủ)** có nút “Mở ứng dụng NHỊP” và khối nhúng vào Page Builder.

## Việc bạn cần làm trên Cloudflare (chọn 1 trong 2 cách)
- **Cách A – dùng chung KV (khuyên dùng):** Pages → dự án nhidautu → Settings → Bindings → thêm *KV namespace*, tên biến `NHIP_KV`, chọn đúng namespace mà hub 18 đang dùng.
- **Cách B – không KV:** Settings → Variables → thêm `HUB_URL` = địa chỉ hub 18 (ví dụ `https://1987-1-18.pages.dev`). Không đặt gì thì mặc định dùng địa chỉ này.
- Hub 18 vẫn phải chạy cron `/api/refresh` như trước để có dữ liệu.

## Lưu ý
- Giao diện NHỊP lưu danh mục/theo dõi/cài đặt ngay trên trình duyệt (như nhip-19), không dùng D1 của website.
- Khóa API AI (nếu dùng Phân tích AI) nhập trong Cài đặt của ứng dụng NHỊP như bản 19.
- Chưa chạy `astro build` và chưa thử trên Cloudflare/điện thoại thật; đã kiểm bằng Node: đường đọc hub (RSS, nến ngày) trả đúng dữ liệu và nhãn `hub-kv`, cú pháp JS của khối KLineChart hợp lệ.
