# Page Builder Pro: hướng dẫn cài đặt & sử dụng

## 1. Cài đặt (làm một lần)
1. Chép đè các tệp trong gói này vào dự án (cùng cấu trúc thư mục). Không tệp cũ nào bị xóa.
2. `npm run build` rồi deploy lên Cloudflare như bình thường (đây là **mã nguồn mới** nên cần build + deploy một lần).
3. Vào **Admin → Tiện ích & plugin**, bật **Page Builder Pro**. Hệ plugin tự tạo 5 bảng `px_page_builder_*` (hoặc chạy tay `nang-cap-6-pb.sql` trong D1 Console).
4. Vào **Trang** → **Thêm trang mới bằng Pro**. Trang cũ bấm **Sửa (Pro)**; nút **Cơ bản** vẫn mở trình dựng cũ (`?basic=1`).

Tắt plugin = website và trình dựng cũ chạy y như trước. Dữ liệu trang không bị mất (cùng cột `pages.blocks`).

## 2. Dùng trình dựng
- Cột trái: **Mẫu trang** (lọc theo danh mục, “Sử dụng mẫu” thay nội dung, “Chèn thêm” nối vào cuối), **Khối** (bấm hoặc kéo vào trang; có Mẫu khối), **Cấu trúc** (cây, kéo để đổi chỗ/lồng).
- Giữa: trang thật. Bấm để chọn khối; thanh công cụ nổi (↑ ↓ nhân đôi, xóa, tay kéo); **nhấp đúp** tiêu đề/nút/banner để gõ chữ trực tiếp. Chuyển **Máy tính / Tablet / Điện thoại** (khung thật nên responsive đúng). **Xem trước** tắt các khung chỉnh sửa.
- Cột phải: khi không chọn khối = **Cài đặt trang** (layout toàn rộng/khung hẹp/thanh bên, tiêu đề H1, màu chủ đạo). Chọn khối = **Nội dung / Kiểu / Hiển thị / Nâng cao**. Tab **Kiểu** ghi theo thiết bị đang chọn.
- Phím tắt: Ctrl+Z, Ctrl+Shift+Z (hoặc Ctrl+Y), Ctrl+S (lưu nháp), Ctrl+D (nhân đôi), Delete, Esc.
- **Lưu nháp** không đổi trang đang chạy; **Xuất bản** ghi vào website và tạo phiên bản. Tự lưu nháp mỗi 30 giây (đổi trong cấu hình plugin). Tab **Lịch sử**: khôi phục 50 phiên bản gần nhất (khôi phục vào trình soạn, rồi Lưu/Xuất bản).
- Nút ▾ cạnh Xuất bản: xem trước tab mới, hủy xuất bản, lưu làm mẫu, xuất/nhập JSON, nhân bản.

## 3. Nội dung động hay cần build?
| Việc | Cách |
|---|---|
| Sửa/tạo trang, khối, mẫu, SEO, bố cục, phiên bản | **Động** (lưu D1, hiện ngay; đệm Cloudflare tối đa 30 giây, chỉnh trong cấu hình plugin) |
| Thêm **loại khối mới**, đổi giao diện trình dựng | Cần sửa mã + build + deploy (plugin mã nguồn) |
| Plugin ZIP | Không thêm được route/trang quản trị mới; chỉ khối/ô giao diện/hook |

## 4. Bảo mật tóm tắt
- Mọi dữ liệu qua `validateDoc` (schema + whitelist khối/thuộc tính/CSS) cả khi lưu lẫn khi hiển thị; khối lạ bị bỏ.
- CSS chỉ sinh từ thuộc tính có kiểu; CSS tùy chỉnh bị đóng phạm vi vào đúng khối, chặn `@import`, `url()` ngoài https, `expression`, `position:fixed`.
- HTML tùy chỉnh đi qua bộ lọc; **JavaScript chỉ quản trị viên được nhập và chạy trong khung `sandbox` không cùng nguồn gốc**.
- API: bắt buộc đăng nhập (middleware), kiểm tra Origin và mã HMAC theo phiên (`x-pb-token`), phân quyền theo vai trò, giới hạn AI 20 lần/giờ.
- Khối có thể **khóa** (chỉ quản trị viên sửa/xóa), áp dụng ở máy chủ.
