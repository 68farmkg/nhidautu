# Nhịp Đầu Tư - Hướng dẫn cài đặt cho người mới

Bản này KHÔNG cần thẻ Visa: không dùng kho ảnh R2. Ảnh lấy từ trang khác (Unsplash, Pexels, Pixabay) bằng cách dán link. Bạn chỉ cần tài khoản GitHub và Cloudflare (miễn phí).

## Bước 1. Đưa mã nguồn lên GitHub
1. Giải nén `nhip-astro.zip` trên máy. Bên trong có thư mục `nhip`.
2. Vào github.com, đăng ký/đăng nhập. Bấm dấu + (góc phải trên) > New repository. Đặt tên `nhip`, chọn Private, bấm Create repository.
3. Bấm liên kết "uploading an existing file". Mở thư mục `nhip` đã giải nén, chọn TẤT CẢ bên trong (thư mục `src`, `public` và các tệp `package.json`, `astro.config.mjs`, `schema.sql`…) rồi kéo thả vào trang GitHub. Chờ tải xong, bấm Commit changes.
   Các tệp bắt đầu bằng dấu chấm (`.node-version`, `.gitignore`) có thể bị ẩn nên không kéo được. Không sao, ta đã có biến NODE_VERSION ở bước 4.

## Bước 2. Tạo cơ sở dữ liệu D1 (miễn phí, không cần thẻ)
1. Đăng nhập dash.cloudflare.com. Menu trái: Storage & databases > D1 SQL database > Create database. Đặt tên `nhip-db`, bấm Create.
2. Mở database vừa tạo > tab Console.
3. Mở tệp `schema.sql` (trên GitHub bấm vào tệp), chọn hết nội dung, sao chép, dán vào ô Console, bấm Execute.
   Nếu báo lỗi, chạy từng khối: mỗi lần dán một câu `CREATE TABLE …;` hoặc `INSERT …;` rồi Execute.
   (Nếu trước đây bạn đã chạy `schema.sql` của bản cũ: chỉ cần chạy `nang-cap.sql`, từng lệnh một; lệnh nào báo "duplicate column name" thì bỏ qua.)
4. Cài mới hoàn toàn: sau `schema.sql`, chạy tiếp `nang-cap-2.sql` rồi `nang-cap-3.sql` (mỗi tệp dán cả khối, Execute một lần, chạy lại cũng an toàn).

## Bước 3. Tạo website trên Cloudflare Pages
1. Workers & Pages > Create application > tab Pages > Connect to Git. Cho phép Cloudflare đọc GitHub, chọn repo `nhip`, bấm Begin setup.
2. Điền:
   - Framework preset: Astro
   - Build command: `npm run build`
   - Build output directory: `dist`
3. Mở Environment variables (advanced), thêm 3 biến:
   - `ADMIN_PASSWORD` = mật khẩu đăng nhập admin (đặt dài, khó đoán, tự nhớ)
   - `SESSION_SECRET` = một chuỗi dài bất kỳ, ví dụ gõ lung tung 30 ký tự
   - `NODE_VERSION` = `20`
4. Bấm Save and Deploy. Lần đầu có thể báo lỗi hoặc web chưa chạy vì chưa gắn D1, cứ sang bước 4.

## Bước 4. Khai báo (gắn) D1 vào website
Đây là bước giúp website và admin đọc/ghi được dữ liệu.
1. Vào project Pages vừa tạo > Settings > Bindings (hoặc Functions > D1 database bindings) > Add > D1 database.
2. Variable name: `DB` (viết HOA đúng như vậy). D1 database: chọn `nhip-db`. Lưu cho cả Production và Preview.
3. Settings > Runtime (hoặc Functions) > Compatibility flags: thêm `nodejs_compat` cho Production và Preview. Lưu.
4. Vào tab Deployments > bấm dấu ba chấm (…) ở lần deploy mới nhất > Retry deployment. Sau 1-2 phút, bấm vào địa chỉ `ten-du-an.pages.dev` để xem website (đã có dữ liệu mẫu).
Quy tắc nhớ: mỗi lần thêm hoặc đổi biến/binding, phải Retry deployment thì mới có hiệu lực.

## Bước 5. Đăng nhập admin và nhập API key AI
1. Mở `địa-chỉ-web/admin`, nhập `ADMIN_PASSWORD`.
2. Vào menu Cài đặt AI (API). Có 20 nhà AI, mỗi nhà một khung:
   - Bấm mở khung nhà bạn có key, tích "Bật nhà này", dán API key, bấm "Lưu và thử kết nối". Hiện chữ "thành công" là dùng được.
   - Muốn có key miễn phí để bắt đầu: Google Gemini (aistudio.google.com/apikey), Groq (console.groq.com/keys), OpenRouter (openrouter.ai/keys), Cerebras, SambaNova, NVIDIA NIM đều có gói free. Đăng ký tài khoản trên trang đó, vào mục API keys, tạo key rồi chép về.
   - Model: để trống là dùng model mặc định. Nếu nhà AI đổi tên model làm báo lỗi, thay tên model mới vào ô Model.
   - Số "Ưu tiên": số nhỏ chạy trước. Bật nhiều nhà thì khi nhà đầu lỗi hoặc hết hạn mức, hệ thống tự thử nhà tiếp theo.
3. (Tùy chọn) Cách khai báo key ở Cloudflare thay vì dán trong admin: Settings > Variables and Secrets > Add, tên biến theo mẫu `AI_KEY_` + tên nhà viết hoa, ví dụ `AI_KEY_OPENAI`, `AI_KEY_GEMINI`, `AI_KEY_GROQ`, `AI_KEY_ANTHROPIC`, `AI_KEY_DEEPSEEK`, `AI_KEY_OPENROUTER`. Nhớ bật nhà đó trong Cài đặt AI, và Retry deployment sau khi thêm biến. Key dán trong admin được ưu tiên hơn biến Cloudflare.

## Giá thị trường và tin RSS (lấy từ các nguồn trong NHỊP V3)
- Giá: lấy từ VNDirect DChart. Vào Số liệu thị trường > "Cập nhật giá ngay". Ô "Thêm nhanh mã" chỉ cần gõ mã (ví dụ VCB), hệ thống tự lấy tên, sàn, ngành và giá. Khi có khách xem trang chủ hoặc trang Thị trường, giá cũng tự cập nhật (tối đa 5 phút một lần). Nếu giá đứng yên ngoài giờ giao dịch là bình thường.
- Tin RSS: menu Tin RSS các báo, có 26 nguồn (CafeF, Vietstock, VnEconomy, Báo Đầu tư, VietnamBiz, VnExpress, Tuổi Trẻ, Thanh Niên, Dân Trí, VietnamNet...). Chọn nguồn, bấm "Viết lại bằng AI" ở tin muốn dùng: AI viết bản nháp bằng lời mới và gắn link nguồn gốc. Trang chủ và trang Thị trường cũng có khối "Tin từ các báo" chỉ hiện tiêu đề kèm link sang báo gốc.
- Nếu một nguồn báo hoặc VNDirect không phản hồi, trang admin báo lỗi ở nguồn đó, các nguồn khác không bị ảnh hưởng.

## Dùng hằng ngày
- AI viết bài: menu AI Content Studio > nhập chủ đề > Viết bản nháp bằng AI. Bài nằm ở "Chờ duyệt".
- Thêm ảnh: mở bài, trong khung xanh "Tìm ảnh ở trang khác" bấm Unsplash/Pexels/Pixabay, chọn ảnh, sao chép địa chỉ hình ảnh, dán vào ô "Link ảnh đại diện". Với ảnh trong bài, thay dòng `[ẢNH CẦN: …]` bằng `[ảnh:https://link-anh]`.
- Đăng: đổi Trạng thái sang "Đăng", bấm Lưu. Muốn hẹn giờ thì chọn ngày giờ tương lai.
- Số liệu thị trường: menu Số liệu thị trường, sửa giá và %, bấm Lưu từng dòng.
- Lưu ý bản quyền: chỉ dùng ảnh từ kho miễn phí hoặc ảnh bạn có quyền dùng. Link ảnh có thể hỏng nếu trang gốc xóa ảnh.

## Sửa giao diện và thông tin
- Email, hotline, địa chỉ: `src/lib/util.ts` (khối SITE). Màu sắc: `src/styles/global.css`.
- Trên GitHub bấm vào tệp > biểu tượng cây bút > sửa > Commit changes. Cloudflare tự cập nhật sau 1-2 phút.

## Sự cố thường gặp
- Web hoặc admin báo lỗi 500: thường chưa gắn binding `DB` hoặc chưa Retry deployment (Bước 4).
- Báo chưa cài ADMIN_PASSWORD: thêm biến ở Settings > Variables and Secrets rồi Retry deployment.
- Build lỗi liên quan Node: kiểm tra có biến `NODE_VERSION` = 20.
- Thử kết nối AI báo lỗi 401: key sai hoặc thiếu. Lỗi 404/model: sửa tên model. Lỗi 429: hết hạn mức, đợi hoặc bật thêm nhà khác.
- Không dùng được LM Studio, Ollama chạy trên máy và YourAI cục bộ vì Cloudflare không truy cập được máy cá nhân.
- Cần hỗ trợ: gửi Claude nguyên văn lỗi trong Deployments > View build log.

## NÂNG CẤP ĐỢT 1 (LÕI): trang tự dựng, menu, giao diện, plugin
Làm 3 việc, theo thứ tự:
1. **Chạy SQL một lần:** D1 > nhip-db > Console, dán TOÀN BỘ nội dung `nang-cap-2.sql`, bấm Execute (chạy lại cũng an toàn). Nó tạo bảng trang, menu, tiện ích, lịch sử sửa và nạp sẵn menu mặc định.
2. **Đưa file lên GitHub:** giải nén, kéo thả đè lên repo (thư mục `src`, `public` và các file lẻ). Cloudflare tự build lại sau 1-2 phút.
3. **Mở `/admin`:** menu mới có các mục bên dưới. Chưa chạy SQL thì web cũ vẫn chạy bình thường, chỉ các mục mới báo "chưa có bảng".

### Dùng hằng ngày
- **Trang:** Admin > Trang > chọn mẫu (Trống, Giới thiệu, Trang chủ giới thiệu, Hỏi đáp) hoặc "trang mẫu" bạn tự lưu. Trong trình soạn bấm "Thêm khối" (24 loại: tiêu đề, văn bản, ảnh, nút, banner, hộp biểu tượng, hỏi đáp, thư viện ảnh, video/nhúng, bản đồ, mã HTML, đồng hồ đếm ngược, danh sách bài, chỉ số, bảng giá, biểu đồ TradingView, tin RSS...).
- **Sắp xếp:** máy tính kéo biểu tượng lưới để đổi chỗ; điện thoại dùng nút ↑ ↓. Mỗi khối có mục "Bố cục & hiển thị": độ rộng riêng cho máy tính và điện thoại (cả hàng, 1/2, 1/3, 1/4...), ẩn trên máy tính hoặc điện thoại, đệm, màu nền, tràn hết chiều ngang.
- **Xem trước:** tab "Xem trước" có 2 nút **Máy tính** (khung 1280px thu nhỏ vừa màn hình) và **Điện thoại** (khung 390px). Mỗi bên dựng đúng giao diện thật, có menu và chân trang, chưa cần lưu. Trình soạn bài viết cũng có khung này.
- **Trang chủ:** Admin > Trang > "Đặt làm trang chủ" (hoặc Cài đặt website). Bỏ chọn thì quay về trang chủ mặc định.
- **Menu:** Admin > Menu & chân trang, có 5 vị trí: menu trên cùng (có menu con xổ xuống), ngăn kéo điện thoại, thanh nút dưới đáy điện thoại (có biểu tượng), 2 cột chân trang. Mỗi mục chọn biểu tượng, hiện trên máy tính / điện thoại / cả hai, mở tab mới. Gõ vào ô link sẽ gợi ý các trang và chuyên mục.
- **Cài đặt website:** tên, logo, màu, email, hotline, địa chỉ, mạng xã hội, chân trang, mã Google Analytics/Pixel.
- **Lịch sử sửa:** mỗi lần lưu trang giữ 20 bản; vào Cài đặt & SEO của trang để xem lại bản cũ.

### Plugin
- **Plugin dữ liệu (không cần deploy):** Admin > Tiện ích & plugin > "Tạo tiện ích mới", dán HTML/CSS/JS, dùng `{{ten}}` làm biến. Trong trang chọn khối "Tiện ích đã tạo" và nhập số hiệu.
- **Plugin mã:** thư mục `src/plugins/<ten>/index.ts` (xem 4 plugin mẫu: gia-chung-khoan, bieu-do, tin-rss, thong-ke). Thêm thư mục mới lên GitHub là khối của nó tự có trong trình dựng, và nếu có hàm `admin` thì tự có mục trong menu quản trị. Không cần sửa lõi.

### Giới hạn hiện tại (nói thẳng)
- Mình chưa build thử được trên máy bạn (máy mình không có mạng). Nếu Cloudflare báo lỗi build, gửi nguyên văn lỗi trong Deployments > View build log.
- Thư viện ảnh vẫn là link từ trang khác (không dùng kho R2 để khỏi cần thẻ Visa).

## NÂNG CẤP ĐỢT 2-4 (HOÀN CHỈNH): khối lồng khối, chat khách hàng, hộp thư, phân quyền, slider
Làm đúng 3 việc, theo thứ tự (giống Đợt 1):
1. **Chạy SQL:** D1 > nhip-db > Console, dán TOÀN BỘ `nang-cap-3.sql`, bấm Execute. Nó tạo bảng người dùng, cuộc chat, tin chat và trạng thái hộp thư. Đã chạy `nang-cap-2.sql` trước đó rồi thì không cần chạy lại.
2. **Đưa file lên GitHub:** giải nén, kéo thả đè lên repo. Cloudflare tự build lại sau 1-2 phút.
3. **Đăng nhập lại** tại `/admin` (phiên đăng nhập cũ hết hiệu lực một lần vì đổi cách bảo mật). Chủ website vẫn dùng mật khẩu `ADMIN_PASSWORD`, **để trống ô tên đăng nhập**.

### Khối lồng khối (Section > Hàng cột > Khối)
- Trong trình dựng bấm **Thêm khối** nhóm **Bố cục**: **Section** (vùng nền: màu hoặc ảnh, đệm, chữ sáng), **Hàng cột** (chia 1 đến 6 cột: 1/2+1/2, 1/3+2/3, 3 cột đều, 4 cột...) và **Khung thẻ** (hộp có viền, bóng đổ).
- Mỗi Section, mỗi cột, mỗi khung có nút **“Thêm khối vào đây”**: đặt khối bất kỳ vào trong, kể cả đặt Hàng cột trong Section, rồi Khung thẻ trong cột (tối đa 5 cấp).
- **Máy tính:** kéo biểu tượng lưới để chuyển khối giữa các cột và Section. **Điện thoại:** dùng nút ↑ ↓, và mục **“Chuyển khối này tới”** trong khối (chọn Section hoặc Cột đích).
- **Hàng cột:** chọn đổi kiểu chia cột thì nội dung được giữ nguyên (cột bị bớt sẽ gộp vào cột cuối). Có tùy chọn: trên điện thoại **xếp chồng** hoặc **giữ cạnh nhau**; căn dọc; khoảng cách giữa cột.
- Mẫu trang mới: **Trang chủ nhiều phần (Section › Cột)** và **Trang liên hệ**. Mẫu cũ đã chuyển sang dùng Hàng cột.
- **Slider:** khối “Slider (trình chiếu ảnh)”, mỗi dòng một slide `link ảnh | tiêu đề | mô tả | chữ nút | link nút`. Tự chuyển slide, vuốt trên điện thoại, nút trước/sau, chấm điều hướng.
- Khối mới khác: **Biểu mẫu liên hệ** (gửi vào Hộp thư), **Nút mở chat**.

### Chat khách hàng và Hộp thư có trạng thái
- **Bật chat:** Admin > Cài đặt website > “Chat khách hàng” > tích “Bật chat trên website”, sửa tiêu đề và lời chào, Lưu. Nút chat tròn xuất hiện góc phải (trên điện thoại nằm phía trên thanh nút dưới đáy). Khách không cần đăng ký, chỉ cần gõ tin. Cuộc chat được nhớ trong trình duyệt của khách, quay lại vẫn thấy lịch sử.
- **Trả lời:** Admin > **Hộp thư & chat** (có huy hiệu số tin chưa đọc). Có 2 kênh: **Chat khách** và **Biểu mẫu liên hệ**; lọc theo trạng thái **Mới / Đang xử lý / Đã xong**. Mở một cuộc chat để xem toàn bộ, gõ trả lời (khách nhận trong vài giây), đổi trạng thái, ghi chú nội bộ (khách không thấy), xóa. Khách nhắn lại vào cuộc đã xong thì tự mở lại thành “Mới”. Trang chat tự cập nhật tin mới của khách mỗi 5 giây.
- **Báo tin về điện thoại (tùy chọn, miễn phí):** tạo bot Telegram với @BotFather để lấy token; lấy chat id của bạn (nhắn bot rồi mở `https://api.telegram.org/bot<TOKEN>/getUpdates`). Thêm 2 biến trong Cloudflare (Settings > Variables and Secrets): `TELEGRAM_BOT_TOKEN` và `TELEGRAM_CHAT_ID`, rồi Retry deployment. Từ đó có chat mới hoặc liên hệ mới là Telegram báo ngay kèm link mở thẳng cuộc trò chuyện. Không cấu hình thì bỏ qua, vẫn xem được trong Hộp thư.
- **Chống spam:** giới hạn số tin mỗi phút, mỗi giờ, và ô ẩn chống robot ở biểu mẫu liên hệ.
- Cửa sổ chat dùng cách hỏi lại máy chủ (polling) vì Cloudflare Pages không có kết nối realtime miễn phí; độ trễ 4 giây khi đang mở chat, 20 giây khi đóng.

### Người dùng và phân quyền
- Admin > **Người dùng & quyền**: tạo tài khoản (tên đăng nhập chữ thường không dấu, mật khẩu tối thiểu 8 ký tự), đổi vai trò, khóa/mở khóa, đặt lại mật khẩu, xóa.
- **3 vai trò:**
  - `admin` (Quản trị viên): toàn quyền, kể cả menu, cài đặt, AI, plugin, người dùng.
  - `editor` (Biên tập viên): Trang, Bài viết, AI Content Studio, Tin RSS, Số liệu thị trường. Không vào được Menu, Cài đặt, Plugin, Người dùng, Cài đặt AI (nên không thấy API key).
  - `support` (Chăm sóc khách hàng): chỉ Hộp thư & chat.
- **Bảo vệ website:** biên tập viên không thêm hoặc sửa được khối “Mã HTML tự do” và “Tiện ích đã tạo” (vì mã chạy trên website của bạn); khối đã có sẵn do admin tạo được giữ nguyên khi biên tập viên lưu trang.
- Chủ website (đăng nhập bằng ADMIN_PASSWORD, để trống tên đăng nhập) luôn có toàn quyền, kể cả khi bảng người dùng chưa tạo. Mỗi người dùng đổi mật khẩu của mình ở **Tài khoản của tôi**.
- **Đăng nhập an toàn hơn:** phiên ký bằng khóa bí mật, hết hạn sau 14 ngày; mật khẩu người dùng được băm (PBKDF2), không lưu dạng chữ thường; sai quá 10 lần trong 15 phút thì tạm khóa theo địa chỉ IP; khóa tài khoản có hiệu lực ngay cả khi người đó đang đăng nhập.

### Sự cố thường gặp ở đợt này
- Vào Hộp thư báo “Chưa có bảng”: chưa chạy `nang-cap-3.sql`.
- Đăng nhập báo sai dù đúng mật khẩu chủ: để TRỐNG ô tên đăng nhập.
- Nút chat không hiện: chưa tích “Bật chat” trong Cài đặt website, hoặc trình duyệt còn giữ bản cũ. Thử tải lại bằng Ctrl+F5. Trong khung xem trước của admin nút chat luôn ẩn (chỉ hiện ở website thật).
- Telegram không báo: kiểm tra 2 biến đã đặt đúng, đã Retry deployment, và bạn đã nhắn bot ít nhất một tin.
- Cloudflare báo lỗi khi build: gửi nguyên văn lỗi trong Deployments > View build log để sửa ngay.

## Đợt 5. Hệ thống plugin (Tiện ích & plugin)
1. Chạy `nang-cap-4.sql` MỘT LẦN trong D1 Console (chạy lại cũng an toàn). Chưa chạy thì website vẫn như cũ, mọi plugin có sẵn coi như đang bật.
2. Admin > Tiện ích & plugin: Tổng quan, Đã cài, Cửa hàng, Tải gói ZIP, Nhật ký, Tiện ích HTML.
3. Hai loại plugin:
   - Plugin mã nguồn: thư mục `src/plugins/<id>/index.ts` (xem `thanh-thong-bao` làm mẫu). Thêm mới cần đưa lên GitHub và deploy; sau đó bật/tắt/cấu hình ngay trong Admin. Plugin mới nên đặt `defaultOff: true`.
   - Gói ZIP khai báo: chỉ gồm `manifest.json` (xem `goi-mau/` và `goi-mau-loi-chao.zip`). Cài ngay, không cần deploy, không chạy mã máy chủ.
4. Thay đổi bật/tắt có hiệu lực trong tối đa ~10 giây (bộ nhớ đệm của từng máy chủ Cloudflare).

## ĐỢT 6. Plugin "Hộp thư & Chat Pro" (đã gộp vào hệ plugin)
Chat Pro giờ là một plugin mã nguồn, mặc định TẮT. Chưa cài thì website chạy như cũ (Hộp thư & chat cơ bản).
1. **Đưa file lên GitHub:** kéo thả đè các thư mục `src`, `public` và các file lẻ trong gói cập nhật vào repo, bấm Commit changes. Chờ Cloudflare build xong (Success).
2. **(Tùy chọn) Chạy SQL:** D1 > Console, dán `nang-cap-5-sach.sql`, Execute. Có thể bỏ qua vì hệ thống tự tạo bảng khi bạn mở trang quản trị lần đầu. Cần đã chạy `nang-cap-3.sql` và `nang-cap-4.sql`.
3. **Cài plugin:** Admin > Tiện ích & plugin > Cửa hàng > Hộp thư & Chat Pro > Cài đặt, tích đồng ý quyền rồi xác nhận.
4. **Dùng:** menu admin xuất hiện **Hộp thư**, **Chat khách** và **Chat, AI & hộp thư gửi**. Cài đặt chat nằm ở Admin > Cài đặt website > cuộn xuống "Chat khách hàng, Trợ lý AI & Hộp thư gửi", nhớ bấm Lưu cài đặt chat. Để AI trả lời cần bật ít nhất một nhà AI có API key ở Cài đặt AI (API).
5. **Tắt plugin:** dữ liệu chat, hộp thư và cài đặt được giữ nguyên; website quay về chat cơ bản.
Chi tiết tính năng Chat Pro xem mục "NÂNG CẤP ĐỢT 5: HỘP THƯ PRO + CHAT PRO" của bản Chat Pro gốc (mẫu giao diện, form khách, AI, hộp thư gửi, thông báo).
