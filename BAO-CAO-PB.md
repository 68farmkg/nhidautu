# Báo cáo Đợt 7: Page Builder Pro

## Cập nhật 1.1: menu con “Trang” + Danh mục trang
- Sidebar (máy tính và ngăn kéo điện thoại) khi plugin bật và đang ở nhóm Trang: **Tất cả trang · Thêm trang mới · Danh mục trang · Giao diện & Menu** (lọc theo quyền; biên tập viên không thấy Menu).
- `/admin/trang/danh-muc`: thêm, đổi tên, mô tả, sắp xếp ↑↓, xóa (trang không bị xóa, về “Chưa phân loại”). Danh sách Trang có bộ lọc theo danh mục và ô đổi danh mục từng trang; trình dựng chọn ở tab Cài đặt.
- Danh mục chỉ để **sắp xếp trong khu quản trị**, chưa tạo trang/URL công khai theo danh mục. Bảng `px_page_builder_cats` (migration `002-cats`; bản đã cài tự nâng cấp khi dùng).
- Kiểm thử: lõi **20/20**, trình duyệt **37/37**. **Menu sidebar, trang danh-muc.astro và danh sách Trang chưa chạy được dưới Astro thật** (không có npm/mạng): đã kiểm tra phần dữ liệu/logic, còn lại cần bạn build và xem thử.

## Kết quả kiểm thử (đã chạy thật)
- `node tests/run.mjs`: **20/20** (CSS an toàn, vòng đời plugin + migration, render, schema/khóa/quyền, API lưu nháp/xuất bản/phiên bản/mẫu/khối dùng chung/AI, SEO + JSON-LD) trên SQLite giả lập D1.
- `node tests/run.mjs --e2e`: **37/37** trên Chromium thật (mẫu, chọn khối, sửa panel, hoàn tác/làm lại, responsive 390px, kéo thả palette→canvas, kéo trong cây, sửa chữ trực tiếp, lưu nháp ≠ xuất bản, phiên bản, SEO, xuất JSON, ngăn kéo điện thoại, quyền editor, không lỗi JS).
- Lỗi thật tìm được và đã sửa nhờ test: `all:unset` làm mất kéo thả ở palette; nạp lại script JSON trong canvas gây SyntaxError; cỡ chữ không kế thừa vào tiêu đề; mặc định bảng giá rỗng; cuộn cột trái giữ khi đổi tab.

## CHƯA kiểm chứng
- **Chưa build bằng Astro/chạy trên Cloudflare** (môi trường không có mạng để `npm install`). Các tệp `.astro` mỏng, logic nằm trong `lib/pb` đã test; cần `npm run build` + thử trên site thật. Máy chủ E2E thay lớp Astro bằng HTTP thuần, dùng nguyên `lib/pb`, `pb.js`, `pb-canvas.js`.
- Chưa đo Lighthouse/hiệu năng thật; chưa thử trình duyệt Safari/Firefox.

## Chưa làm / giới hạn
Lên lịch xuất bản; thư viện ảnh/tải ảnh (chỉ nhập URL https); khóa chống hai người sửa cùng lúc (ghi sau thắng); biểu mẫu tùy trường (dùng khối Biểu mẫu liên hệ sẵn có); biểu đồ thị trường dạng thanh % từ bảng `quotes` (biểu đồ giá dùng khối TradingView có sẵn).

## Tệp mới
src/lib/pb/{css,schema,store,ddl,cfg,api,render,seed,blocks-pro,editor-shell}.ts · src/plugins/page-builder/index.ts · src/pages/admin/pb/[id].astro · pb-api.ts · pb-preview.astro · src/pages/sitemap.xml.ts · src/styles/pb.css · public/{pb.js,pb-canvas.js,pb.css} · nang-cap-6-pb.sql · tests/* · HUONG-DAN-PB.md
## Tệp sửa (nhỏ, tương thích ngược)
- `src/lib/blocks.ts`: thêm `style.x`, chế độ soạn (`data-bid`, vùng trống), khóa khối, `adminFields`; trình soạn cũ không làm mất `style.x`.
- `src/lib/perm.ts`: editor được vào `/admin/pb*`. `src/layouts/Base.astro`: canonical, noindex, JSON-LD, og/twitter, font.
- `src/pages/[...slug].astro`, `src/pages/index.astro`: dùng renderPage khi plugin bật (không bật = như cũ). `admin/trang/[id].astro`: chuyển sang Pro (`?basic=1` giữ bản cũ). `admin/trang/index.astro`: nút Pro. `package.json`: script test.
