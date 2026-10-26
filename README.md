# Bước 8 – Giao diện admin theo mẫu: Bài viết, Quản lý tài khoản (gói gộp bước 2–7b)
Chép đè vào dự án. Không cần SQL, không đổi cấu trúc bảng.
- `src/styles/admin-pro.css`: thành phần dùng chung (thẻ số liệu, tab, bộ lọc, bảng, bảng bên phải, phân trang; có dạng thẻ trên điện thoại). Màu chính theo `--nhip-primary`.
- `/admin/bai-viet`: thẻ số liệu (tổng, đã xuất bản, nháp, chờ duyệt, lượt xem), tab trạng thái có số lượng, tìm kiếm (tiêu đề, tóm tắt, mã CK), lọc chuyên mục, sắp xếp, bảng có ảnh nhỏ, phân trang 10/20/50, cột lọc bên phải (trạng thái, chuyên mục, khoảng ngày), thao tác nhanh. Xóa bài vẫn như cũ và được ghi nhật ký (`post.delete`).
- `/admin/nguoi-dung`: thẻ số liệu theo vai trò, tìm/lọc vai trò/trạng thái, bảng có ảnh chữ cái, bảng chi tiết bên phải (thông tin, quyền hạn theo vai trò, 5 hoạt động gần nhất lấy từ nhật ký), thêm/sửa/đặt lại mật khẩu/khóa/xóa giữ nguyên logic cũ.
- Chưa có vì CSDL chưa có cột: Tác giả của bài, Thùng rác/Lưu trữ, định dạng bài (video/ảnh/infographic); email, ảnh đại diện, nhóm người dùng, thiết bị đăng nhập của tài khoản.
- Kiểm tra: cú pháp phần frontmatter đã qua esbuild, ngoặc `{}` của template cân bằng. CHƯA chạy `astro build`.

---
# Bước 5b – Nối Tùy chỉnh giao diện vào giao diện công khai (gói gộp bước 2–7)
Chép đè vào dự án (thêm `tools/noi-giao-dien.mjs`). Không cần SQL.

Mình chưa có `Base.astro`, `global.css` nên không sửa trực tiếp được. Thay vào đó là công cụ tự nối, chạy trong thư mục gốc dự án:

```
node tools/noi-giao-dien.mjs                       # xem trước, KHÔNG ghi gì
node tools/noi-giao-dien.mjs --apply               # ghi thật (tự sao lưu *.bak-noi-giao-dien)
node tools/noi-giao-dien.mjs --hoan-tac            # trả về như cũ
```
Công cụ làm 3 việc:
1. `Base.astro`: thêm `<ThemeHead />` cuối `<head>`, `<SiteHeader />` ngay sau `<body>`, `<SiteFooter />` sau footer; bọc header/footer cũ bằng `{nhTheme.hd_on !== '1' && (…)}` / `ft_on` (chỉ hiện khi chưa bật bản mới).
2. `global.css`: biến `:root` có tên quen thuộc (brand/primary, ink/text, bg, card, danger…) đổi thành `var(--nhip-primary, màu cũ)` nên giữ nguyên giao diện cho đến khi bạn chọn màu trong admin.
3. Mã màu cứng: thêm `--hex "#0f9d6b=primary"` (có thể lặp nhiều lần) để thay mọi chỗ mã đó.
Khóa: primary secondary success alert text heading link link-h body-bg content-bg. Chọn tay biến khi trùng: `--map ten-bien=khoa`. Logo/tên: `--logo /logo.svg --name "Nhịp Đầu Tư"`.

Không đoán: không nhận ra header/footer cũ, hai biến cùng khớp, thiếu `</head>`… thì không ghi phần đó và nói rõ cần sửa tay chỗ nào. Chạy lại nhiều lần không nhân đôi.

Thêm: `theme.ts` — "Chiều rộng nội dung" giờ áp cả lên `.wrap` (vùng nội dung các trang).
Test: tests/noi-giao-dien.test.mjs (4/4) chạy được độc lập: `node --test tests/noi-giao-dien.test.mjs`. CHƯA chạy `astro build`.

---
# Bước 7 – Sao lưu & khôi phục cấu hình (gói gộp bước 2–7)
Chép đè vào dự án. Không cần chạy SQL: bảng `settings_snapshots` tự tạo khi dùng lần đầu.

- Trang `/admin/sao-luu` (Cài đặt & tài khoản › Sao lưu & khôi phục), chỉ admin, không gán được. Có nhật ký (tải sao lưu, khôi phục).
- **Gồm:** Tùy chỉnh giao diện, Khối dùng lại, Menu & chân trang. **Không gồm:** tài khoản, mật khẩu, vai trò, API key, bài viết, trang, tin nhắn.
- Tải về: tệp `nhip-sao-luu-YYYY-MM-DD.json`, chọn được từng phần.
- Khôi phục 2 bước: chọn tệp → xem trước (số lượng từng phần, cảnh báo mục bị bỏ) → chọn phần → xác nhận. Giao diện = thay toàn bộ; Khối = ghép theo mã (không xóa khối khác); Menu = thay từng vị trí có trong tệp.
- Mọi dữ liệu trong tệp được làm sạch lại như khi nhập tay (màu, phông, liên kết, HTML khối, mã vị trí menu). Tệp tối đa 2 MB.
- Trước mỗi lần khôi phục, hệ thống tự chụp bản hiện tại (giữ 5 bản) và cho "Quay lại bản này". Nếu không chụp được (dữ liệu quá lớn) thì từ chối khôi phục và nhắc tải bản sao lưu thủ công.
- Không làm được tự động: khôi phục trong một giao dịch duy nhất (D1 ở đây chạy từng lệnh); nếu lỗi giữa chừng hãy quay lại bản chụp.

Test: tests/backup.test.ts (5) cùng theme (7) và reusable (4) = 16/16 đạt với CSDL giả lập. Test cũ (perm, terms) cần makeDb thật của dự án nên mình chạy riêng. CHƯA chạy astro build.

---
# Bước 6 – Khối dùng lại + Header trong suốt (gói gộp bước 2–6)
Chép đè vào dự án. Không cần chạy SQL: bảng `reusable_blocks` tự tạo. Các tệp bước 5 vẫn trong gói; cách nối `Base.astro` xem phần Bước 5 bên dưới (chưa đổi).

## Khối dùng lại (tương đương UX Blocks của Flatsome)
- Trang `/admin/khoi-dung-lai`: tạo/sửa/xóa khối HTML có mã (slug). Chỉ admin, không gán được cho vai trò tùy chỉnh. Có nhật ký.
- Chèn sẵn: Tùy chỉnh giao diện › **Khối chèn sẵn** (trên Header, dưới Header, trên Footer, trong Footer).
- Chèn thủ công: `<ReusableBlock slug="ma-khoi" />`; trong nội dung: `[khoi slug="ma-khoi"]` qua `expandBlocks(db, html)` (cần gọi ở trang hiển thị bài, chưa tự gắn).
- Lọc khi lưu VÀ khi hiển thị: bỏ script, iframe, object, embed, form, link, meta, thuộc tính on*, liên kết javascript:. Đây là lớp phòng thủ bằng biểu thức chính quy, không thay cho việc chỉ để admin tin cậy soạn khối.

## Header trong suốt
Tùy chọn Header › "Header trong suốt ở trang chủ": chỉ trang `/`, nằm đè lên ảnh đầu trang, chữ trắng; cuộn xuống thì thành nền đặc. Lưu ý: trang chủ cần ảnh/khối đầu trang đủ tối để chữ trắng đọc được.

Test: tests/reusable.test.ts (4) + tests/theme.test.ts (7) = 11/11 đạt với CSDL giả lập. CHƯA chạy astro build.

---
# Bước 5 – Tùy chỉnh giao diện (Theme Options) + Header/Footer Builder (gói gộp bước 2–5)
Chép đè vào dự án, giữ nguyên đường dẫn. Không cần chạy SQL: bảng `theme_opts` tự tạo khi dùng lần đầu.

## Mô hình lấy từ Flatsome (đã đọc mã nguồn v3.20.7)
- Tùy chọn là cặp khóa→giá trị phẳng, có mặc định, xuất thành MỘT khối CSS (biến `:root` + vài quy tắc). Ở đây: `src/lib/theme.ts` (`themeCss`).
- Header = 3 thanh (trên cùng / chính / dưới), mỗi thanh 3 vùng trái-giữa-phải; di động có vùng riêng; có "dính khi cuộn" và thu nhỏ. Ở đây: `SiteHeader.astro`, `HeaderEl.astro`.
- Footer = các cột + thanh bản quyền + nút lên đầu trang. Ở đây: `SiteFooter.astro`.
- Mẫu Header dựng sẵn (preset): 5 mẫu, bấm là điền vào bảng, chỉ áp dụng khi Lưu.
- Khác Flatsome (cố ý): ô để TRỐNG = giữ nguyên giao diện hiện tại; không có xem trước trực tiếp; không có WooCommerce/cửa hàng.

## Trang quản trị mới
Giao diện › **Tùy chỉnh giao diện** (`/admin/giao-dien`): Màu sắc · Chữ & nút · Bố cục · Header · Footer · Nâng cao (CSS tùy chỉnh). Chỉ admin, không gán được cho vai trò tùy chỉnh. Có ghi nhật ký (Lưu / Đặt lại giao diện).

## Nối vào giao diện công khai (3 chỗ, trong `src/layouts/Base.astro`)
```astro
---
import ThemeHead from '../components/ThemeHead.astro';
import SiteHeader from '../components/SiteHeader.astro';
import SiteFooter from '../components/SiteFooter.astro';
import { getTheme } from '../lib/theme';
const th = await getTheme(Astro.locals.runtime.env.DB);
const site = { name: 'Nhịp Đầu Tư', logo: '/logo.svg' };
---
<head> … <ThemeHead /> </head>           <!-- đặt SAU các file CSS hiện có -->
<body>
  <SiteHeader site={site} />
  {th.hd_on !== '1' && <HeaderCu />}      <!-- header hiện tại, chỉ hiện khi chưa bật Header mới -->
  <slot />
  {th.ft_on !== '1' && <FooterCu />}      <!-- footer hiện tại -->
  <SiteFooter site={site} />              <!-- cũng chứa nút Lên đầu trang -->
</body>
```
Biến CSS để map vào CSS hiện có (trong `global.css`), ví dụ: `--brand: var(--nhip-primary, <màu cũ>);`.
Biến có sẵn: `--nhip-primary/secondary/success/alert/text/heading/link/link-h/body-bg/content-bg/font-head/font-body/font-nav/btn-radius/card-radius/container/gap`.

## Bảo mật
Mọi giá trị được lọc ở `clean()` trước khi vào CSS/HTML: màu chỉ nhận #hex, số bị kẹp trong khoảng, phông chỉ nhận danh sách cho phép, liên kết chỉ nhận `/`, `http(s)`, `tel`, `mailto`, CSS tùy chỉnh bị bỏ `<`, `@import`, `javascript:`.

Test: tests/theme.test.ts (7/7 đạt với CSDL giả lập). CHƯA chạy `astro build`; các tệp .astro mới chưa được biên dịch thử.

---
# Bước 4 – Nhật ký hoạt động + Vai trò theo quyền hành động (gói gộp bước 2, 3, 4)
Chép đè toàn bộ vào dự án, giữ nguyên đường dẫn. Không cần chạy SQL: bảng `roles`, `activity_log` tự tạo khi dùng lần đầu.

## Phân quyền
- src/lib/perm.ts: quyền (capability) gắn với đường dẫn. admin/editor/support giữ NGUYÊN quyền cũ (test đối chiếu 36 đường dẫn).
- Cài đặt, plugin, menu, người dùng, vai trò, nhật ký, API khóa: chỉ admin, không gán được cho vai trò tùy chỉnh.
- Vai trò tùy chỉnh: Người dùng & quyền › Vai trò & quyền. Ai cũng có "Tài khoản của tôi". Vai trò khác admin vẫn bị chặn khối HTML tự do như biên tập viên.
- Middleware nạp quyền mỗi yêu cầu (vai trò đổi/xóa có hiệu lực ngay; bộ nhớ đệm 30 giây giữa các worker).

## Nhật ký
- /admin/nhat-ky (lọc theo nhóm, tìm kiếm, phân trang) và Lịch sử đăng nhập. Giữ 365 ngày.
- Ghi chi tiết: đăng nhập, đăng nhập sai, đăng xuất, tạo/sửa/khóa/xóa tài khoản, đặt lại mật khẩu, vai trò, bài viết, chuyên mục/thẻ.
- Mọi thao tác ghi khác trong /admin được ghi chung "Thao tác quản trị" (chỉ phương thức + đường dẫn). KHÔNG lưu nội dung biểu mẫu/mật khẩu.
- Lưu ý: thao tác bị từ chối ở bước xác thực biểu mẫu nhưng trả trang 200 vẫn có thể được ghi chung; các mục có chi tiết thì chính xác.

Test: tests/perm.test.ts (5) + tests/terms.test.ts (6) = 11/11 đạt (node:test, SQLite giả lập D1). CHƯA chạy astro build.
