# Báo cáo Đợt 5 — Hệ thống plugin

## Kiểm toán (kết quả)
- Chỉ nhận được `nhip-astro-hoan-chinh.zip`; KHÔNG có `nhip-astro-chat-pro.zip` nên chưa đối chiếu hai phiên bản. Chat hiện có trong bản này: `api/chat.ts`, `public/chat.js`, `admin/hop-thu`. Cần gửi bản Chat Pro để gộp tiếp.
- Plugin cũ (`src/plugins/*`) nạp bằng `import.meta.glob` lúc build, luôn bật, không có trạng thái/quyền/nhật ký. Admin plugin trả HTML thô.
- Chưa có chống CSRF ngoài `SameSite=Lax`. Widget HTML/JS chạy nguyên văn trong trang (không cách ly).
- Không có nơi nào để plugin chèn vào giao diện khách ngoài khối của trình dựng trang.

## Đã làm
| Hạng mục | Tệp |
|---|---|
| Bảng D1 (installs, packages, settings, placements, migrations, logs) | `nang-cap-4.sql` |
| Manifest + kiểm tra schema, danh sách quyền, vị trí cho phép | `lib/px/manifest.ts` |
| Registry, vòng đời (cài/bật/tắt/gỡ/nâng cấp/quay lại), migration, hook, slot, cấu hình | `lib/px/registry.ts` |
| Đọc ZIP an toàn (giới hạn, chặn đường dẫn độc, zip-bomb) | `lib/px/zip.ts` |
| Làm sạch HTML theo danh sách cho phép; khung cách ly sandbox+CSP | `lib/px/sanitize.ts` |
| Template an toàn, CSS đóng phạm vi | `lib/px/tpl.ts` |
| Mở rộng kiểu Plugin (tương thích ngược) | `lib/plugins.ts` |
| Khối chỉ từ plugin đang bật; khối plugin tắt vẫn giữ trong bố cục | `lib/blocks.ts`, `public/builder.js`, `admin/trang/[id].astro`, `admin/xem-truoc.astro` |
| Vị trí hiển thị trên giao diện khách (9 vị trí) | `components/Slot.astro`, `layouts/Base.astro`, `index.astro`, `DefaultHome.astro`, `bai-viet/[slug]`, `co-phieu/[symbol]` |
| Menu admin theo plugin đang bật; trang admin của plugin | `layouts/Admin.astro`, `admin/p/[id].astro` |
| API plugin có kiểm soát (`/api/px/<id>/<path>`, mặc định chỉ admin) | `pages/api/px/[id]/[...path].ts` |
| Chống CSRF (Origin/Sec-Fetch-Site) cho /admin và /api/px | `middleware.ts` |
| Giao diện Plugin Manager + tiện ích HTML (cách ly, xem trước, nhân bản, lịch sử) | `admin/tien-ich.astro` |
| Mẫu: plugin mã nguồn và gói ZIP | `plugins/thanh-thong-bao/`, `goi-mau/`, `goi-mau-loi-chao.zip` |

## Kiểm thử đã chạy (42/42 đạt)
Chạy lõi registry trên SQLite thay D1: chưa migrate vẫn chạy; cài cần đồng ý quyền; migration tạo bảng `px_*`; slot đúng vị trí/trang; cấu hình độc hại bị thoát; hook chạy và dừng khi tắt; tắt không mất dữ liệu; cảnh báo khi trang đang dùng khối; gói ZIP (từ chối tệp mã, id trùng, bảng dữ liệu); nâng cấp đòi duyệt quyền mới; JS chỉ chạy trong iframe sandbox không `allow-same-origin`; quay lại phiên bản trước; gỡ + xóa dữ liệu chỉ đụng bảng `px_*`; nhật ký. Ngoài ra kiểm thử riêng ZIP độc, zip-bomb, và 8 mẫu XSS cho bộ làm sạch HTML.

## CHƯA kiểm thử được (cần bạn xác nhận khi build)
Không có mạng nên không cài được Astro: các tệp `.astro` và `blocks.ts` mới chỉ được rà soát bằng mắt, chưa `npm run build`. Chưa thử trên Cloudflare thật, chưa thử trên điện thoại. Hãy deploy lên nhánh/preview trước và báo lỗi build nếu có.

## Giới hạn đã biết (nói thẳng)
- Plugin mã nguồn mới vẫn cần build+deploy; ZIP không thể thêm route/API/mã máy chủ. Đây là giới hạn của Astro+Workers, không phải thiếu sót.
- Chưa có kho plugin từ xa; "Cửa hàng" lấy từ plugin mã nguồn chưa bật và ZIP đã tải lên.
- Trang admin plugin chỉ dành cho vai trò admin (chưa cấp quyền theo vai trò từng plugin).
- Chưa có tô màu cú pháp trong trình soạn mã (cần thư viện ngoài); chưa nối CI/CD GitHub.
- Trạng thái bật/tắt có độ trễ tối đa ~10 giây giữa các máy chủ.
- Chat Pro đã được gộp thành plugin `chat-pro` (Đợt 6). Bảng dữ liệu của nó vẫn do `lib/chatschema.ts` tự tạo (không qua migration `px_*`), nên khi gỡ plugin chọn "xóa dữ liệu" sẽ KHÔNG xóa các bảng chat/hộp thư.

## Tiêu chí nghiệm thu (sau khi deploy)
1. Chạy `nang-cap-4.sql`; mở Tiện ích & plugin: thấy 5 plugin có sẵn đang bật, Cửa hàng có "Thanh thông báo".
2. Cài "Thanh thông báo" → thanh xuất hiện đầu website; tắt → biến mất; dữ liệu còn.
3. Tải `goi-mau-loi-chao.zip` → xem quyền → cài → câu chào hiện ở trang chủ, khối "Lời chào" có trong trình dựng.
4. Tắt "Biểu đồ TradingView" khi trang đang dùng → có cảnh báo, bố cục không mất; bật lại thì khối hiện lại.
5. Bài viết, tin tức, RSS, chat, giá chứng khoán hoạt động như trước.


## Đợt 6. Gộp Chat Pro
- Trạng thái bật/tắt của Chat Pro lấy từ hệ plugin (`chatcfg.pluginOn` đọc `px/registry`), thay cho khóa `plugin.chat-pro` cũ.
- Chưa cài: giữ nguyên Hộp thư & chat cơ bản (`components/MailBasic.astro`). Đã cài: Hộp thư Pro (`MailPro.astro`) + trang Chat khách.
- Chưa build thử trên Astro/Cloudflare (không có mạng). Đã kiểm cú pháp TS/JS, kiểm import, và chạy thử SQL trên SQLite.
