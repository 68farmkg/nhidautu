// Thư viện mẫu có sẵn của Page Builder Pro. Mỗi mẫu dựng ra cây khối mới (id mới) mỗi lần gọi.
// Chỉ dùng khối lõi + khối Pro + khối plugin chứng khoán (indexes, stocks, top-views, tv-chart). Khối thuộc plugin đang tắt vẫn được giữ trong bố cục (không mất).
import { uid, STYLE_DEF, type Block } from '../blocks';

type Ex = { children?: Block[]; cols?: Block[][] };
const B = (type: string, props: any, style: any = {}, ex: Ex = {}): Block => ({ id: uid(), type, props, style: { ...STYLE_DEF, ...style }, ...ex });
const X = (d: any, extra: any = {}) => ({ x: { d, t: {}, m: {}, fx: { anim: '', hover: '', dur: 0.6, delay: 0 }, cond: { from: '', to: '', days: [], param: '' }, lock: '', cls: '', anchor: '', css: '', ...extra } });
const COLS = (layout: string, cols: Block[][], gap = 20, valign = 'start') => B('columns', { layout, gap, mobile: 'stack', valign }, {}, { cols });
const SEC = (bg: string, py: number, kids: Block[], light = false, extra: any = {}) => B('section', { bg, py, light, inner: 'wide', dark: 0, minh: 0 }, { full: true, ...extra }, { children: kids });
const IMG = 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1600';

const features = (): Block => COLS('3-3-3-3', [
  [B('iconbox', { icon: 'chart', title: 'Dữ liệu thị trường', text: 'Cập nhật nhanh biến động thị trường theo thời gian thực.', url: '/thi-truong' })],
  [B('iconbox', { icon: 'layers', title: 'Phân tích chuyên sâu', text: 'Nhận định từ đội ngũ chuyên gia, dễ hiểu, có dẫn chứng.', url: '/chuyen-muc/phan-tich' })],
  [B('iconbox', { icon: 'shield', title: 'Khuyến nghị đầu tư', text: 'Thông tin tham khảo minh bạch, nêu rõ rủi ro.', url: '/chuyen-muc/kien-thuc' })],
  [B('iconbox', { icon: 'news', title: 'Tin tức nổi bật', text: 'Tin quan trọng được chọn lọc mỗi ngày.', url: '/tin-tuc' })]], 16);
const hero = (title: string, text: string): Block => SEC('#0a2a2f', 48, [
  COLS('7-5', [
    [B('heading', { text: title, tag: 'h1', sub: text }, X({ color: '#ffffff' })), B('button', { label: 'Xem dữ liệu thị trường', url: '/thi-truong', kind: 'solid' })],
    [B('card', { bg: '#ffffff', pad: 16, radius: 14, border: false, shadow: true }, {}, { children: [B('pb-market', { title: 'Chỉ số thị trường', src: 'index', count: 4 })] })]], 28, 'center')], true, X({ grad: 'night' }));

export type SeedTpl = { id: string; name: string; kind: 'page' | 'block'; category: string; desc: string; make: () => Block[] };
export const CATEGORIES: [string, string][] = [['tat-ca', 'Tất cả'], ['trang-chu', 'Trang chủ'], ['tin-tuc', 'Tin tức'], ['phan-tich', 'Phân tích'], ['chuyen-muc', 'Chuyên mục'], ['co-phieu', 'Mã cổ phiếu'], ['gioi-thieu', 'Giới thiệu'], ['lien-he', 'Liên hệ'], ['landing', 'Landing'], ['khac', 'Khác']];

export const SEED: SeedTpl[] = [
  { id: 'trong', name: 'Trang trống', kind: 'page', category: 'khac', desc: 'Bắt đầu từ đầu', make: () => [] },
  { id: 'p-phan-tich', name: 'Trang phân tích thị trường', kind: 'page', category: 'phan-tich', desc: 'Hero + chỉ số, 4 mục nhanh, bài nổi bật, tin mới, biểu đồ, CTA', make: () => [
    hero('Phân tích thị trường hôm nay', 'Cập nhật nhanh diễn biến thị trường, xu hướng dòng tiền và cơ hội đầu tư dưới góc nhìn chuyên gia.'),
    SEC('', 24, [features()]),
    SEC('', 8, [COLS('8-4', [
      [B('posts', { title: 'Bài viết nổi bật', cat: 'phan-tich', count: 4, layout: 'list' })],
      [B('pb-latest', { title: 'Tin tức mới nhất', count: 5, sort: 'new', thumb: true, more: '/tin-tuc' })]], 24)]),
    SEC('#f3f6f5', 32, [COLS('7-5', [[B('tv-chart', { symbol: 'HOSE:VNINDEX', height: 380 })], [B('pb-market', { title: 'Biến động trong phiên', src: 'up', count: 6 }), B('pb-stock', { symbol: 'VIC', detail: true, link: true })]], 24)]),
    SEC('', 24, [B('pb-cta', { title: 'Đồng hành cùng bạn trên hành trình đầu tư thông minh', text: 'Nhận thông báo, phân tích và gợi ý đầu tư từ đội ngũ chuyên gia.', btn: 'Đăng ký nhận tin', url: '/lien-he', look: 'brand', align: 'left' })])] },
  { id: 'p-trang-chu', name: 'Trang chủ tin tức & thị trường', kind: 'page', category: 'trang-chu', desc: 'Slider, dải chỉ số, bài mới, cổ phiếu nổi bật, liên hệ', make: () => [
    B('slider', { slides: `${IMG} | Đầu tư thông minh hơn mỗi ngày | Tin tức, phân tích và số liệu thị trường | Xem thị trường | /thi-truong`, height: 380, auto: 6, dark: 40 }, { full: true }),
    SEC('#ffffff', 20, [B('indexes', {})]),
    SEC('', 32, [COLS('8-4', [
      [B('heading', { text: 'Bài viết mới', tag: 'h2' }), B('posts', { count: 6, layout: 'grid' })],
      [B('card', { bg: '#ffffff', pad: 16, radius: 12, border: true, shadow: false }, {}, { children: [B('stocks', { count: 6, sort: 'up', title: 'Cổ phiếu nổi bật' }), B('spacer', { h: 12, line: true }), B('top-views', { count: 5, title: 'Đọc nhiều nhất' })] })]], 24)]),
    SEC('', 20, [B('pb-cta', { title: 'Nhận bản tin thị trường mỗi sáng', text: 'Tóm tắt nhanh để bạn không bỏ lỡ cơ hội.', btn: 'Đăng ký', url: '/lien-he', look: 'dark', align: 'center' })])] },
  { id: 'p-tin-tuc', name: 'Trang tin tức', kind: 'page', category: 'tin-tuc', desc: 'Tiêu đề, bài mới dạng lưới, đọc nhiều', make: () => [
    B('heading', { text: 'Tin tức', tag: 'h1', sub: 'Tin mới và nhận định từ thị trường.' }), B('categories', {}),
    COLS('8-4', [[B('posts', { count: 9, layout: 'grid' })], [B('pb-latest', { title: 'Đọc nhiều nhất', count: 6, sort: 'views', thumb: true, more: '' }), B('top-views', { count: 5, title: 'Bài đọc nhiều' })]], 24)] },
  { id: 'p-chuyen-muc', name: 'Trang chuyên mục', kind: 'page', category: 'chuyen-muc', desc: 'Giới thiệu chuyên mục + danh sách bài + thanh bên', make: () => [
    SEC('#f3f6f5', 32, [B('heading', { text: 'Chuyên mục Phân tích', tag: 'h1', sub: 'Nhận định thị trường, doanh nghiệp và ngành.' })]),
    SEC('', 24, [COLS('8-4', [[B('posts', { cat: 'phan-tich', count: 9, layout: 'list' })], [B('card', { bg: '#fff', pad: 16, radius: 12, border: true, shadow: false }, {}, { children: [B('heading', { text: 'Chuyên mục khác', tag: 'h3' }), B('categories', {})] })]], 24)])] },
  { id: 'p-co-phieu', name: 'Trang nhận định mã cổ phiếu', kind: 'page', category: 'co-phieu', desc: 'Thông tin mã, biểu đồ giá, nội dung phân tích AI, bài liên quan', make: () => [
    B('heading', { text: 'Nhận định cổ phiếu FPT', tag: 'h1', sub: 'Đổi mã trong khối “Thông tin cổ phiếu” và biểu đồ.' }),
    COLS('4-8', [[B('pb-stock', { symbol: 'FPT', detail: true, link: true })], [B('tv-chart', { symbol: 'HOSE:FPT', height: 400 })]], 24),
    B('pb-ai', { title: 'Nhận định nhanh', text: '## Điểm nhấn\n\n- Nhập hoặc tạo nội dung bằng AI ở khung bên phải.\n- Luôn kiểm tra lại số liệu trước khi xuất bản.', label: true }),
    B('pb-latest', { title: 'Tin liên quan', count: 5, sort: 'new', thumb: true, more: '/tin-tuc' })] },
  { id: 'p-gioi-thieu', name: 'Trang giới thiệu', kind: 'page', category: 'gioi-thieu', desc: 'Giới thiệu, 3 điểm mạnh, đánh giá, CTA', make: () => [
    B('heading', { text: 'Về Nhịp Đầu Tư', tag: 'h1', sub: 'Kết nối tri thức · Kiến tạo giá trị' }), B('text', { text: 'Viết vài dòng giới thiệu về website, sứ mệnh và đội ngũ của bạn.' }),
    COLS('4-4-4', [[B('iconbox', { icon: 'shield', title: 'Đáng tin cậy', text: 'Thông tin kiểm chứng, minh bạch.' })], [B('iconbox', { icon: 'chart', title: 'Cập nhật nhanh', text: 'Số liệu thị trường mỗi ngày.' })], [B('iconbox', { icon: 'book', title: 'Dễ hiểu', text: 'Kiến thức viết cho người mới.' })]], 16),
    COLS('6-6', [[B('testimonial', { quote: 'Nội dung rõ ràng, giúp tôi hiểu thị trường hơn.', name: 'Nhà đầu tư A', role: 'Thành viên' })], [B('testimonial', { quote: 'Bản tin ngắn gọn, đáng tin cậy.', name: 'Nhà đầu tư B', role: 'Thành viên' })]], 16),
    B('pb-cta', { title: 'Liên hệ với chúng tôi', text: 'Chúng tôi phản hồi trong ngày.', btn: 'Liên hệ', url: '/lien-he', look: 'brand', align: 'center' })] },
  { id: 'p-lien-he', name: 'Trang liên hệ', kind: 'page', category: 'lien-he', desc: 'Biểu mẫu, thông tin, nút chat, bản đồ', make: () => [
    B('heading', { text: 'Liên hệ', tag: 'h1' }),
    COLS('6-6', [[B('contactform', { title: 'Gửi liên hệ cho chúng tôi', btn: 'Gửi liên hệ' })], [B('card', { bg: '#ffffff', pad: 18, radius: 12, border: true, shadow: false }, {}, { children: [B('heading', { text: 'Thông tin', tag: 'h3' }), B('text', { text: 'Hotline, email và địa chỉ của bạn ghi ở đây.' }), B('chatbtn', { label: 'Chat ngay' }), B('map', { q: 'Quận 1, TP.HCM', height: 220 })] })]], 24)] },
  { id: 'p-landing', name: 'Landing page đăng ký', kind: 'page', category: 'landing', desc: 'Hero, lợi ích, bảng giá, hỏi đáp, CTA', make: () => [
    SEC('#0a2a2f', 64, [B('heading', { text: 'Đầu tư tự tin hơn với dữ liệu và phân tích đáng tin cậy', tag: 'h1', sub: 'Tham gia để nhận bản tin, cảnh báo và phân tích từ chuyên gia.' }, { al: 'center', ...X({ color: '#ffffff' }) }), B('button', { label: 'Đăng ký ngay', url: '#dang-ky', kind: 'solid' }, { al: 'center' })], true, X({ grad: 'brand' })),
    SEC('', 32, [features()]),
    SEC('#f3f6f5', 40, [B('heading', { text: 'Chọn gói phù hợp', tag: 'h2' }, { al: 'center' }), B('pb-pricing', {})]),
    SEC('', 32, [B('heading', { text: 'Câu hỏi thường gặp', tag: 'h2' }), B('accordion', { items: 'Tôi có mất phí khi đăng ký không? | Gói Cơ bản miễn phí.\nTôi hủy được không? | Bạn hủy bất kỳ lúc nào.' })]),
    SEC('', 24, [B('pb-cta', { title: 'Sẵn sàng bắt đầu?', text: 'Để lại thông tin, chúng tôi liên hệ lại.', btn: 'Liên hệ', url: '/lien-he', look: 'brand', align: 'center' }, X({}, { anchor: 'dang-ky' }))])] },
  { id: 'p-bang-gia', name: 'Trang bảng giá dịch vụ', kind: 'page', category: 'landing', desc: 'Tiêu đề, bảng giá 3 gói, hỏi đáp', make: () => [B('heading', { text: 'Bảng giá', tag: 'h1', sub: 'Chọn gói phù hợp với nhu cầu của bạn.' }, { al: 'center' }), B('pb-pricing', {}), B('accordion', { items: 'Thanh toán thế nào? | Chuyển khoản hoặc liên hệ để được hướng dẫn.' })] },

  { id: 'b-hero', name: 'Hero thị trường', kind: 'block', category: 'trang-chu', desc: 'Nền tối, tiêu đề, thẻ chỉ số', make: () => [hero('Tiêu đề lớn của bạn', 'Mô tả ngắn gọn giá trị bạn mang lại.')] },
  { id: 'b-features', name: '4 mục nhanh (biểu tượng)', kind: 'block', category: 'trang-chu', desc: 'Dữ liệu, phân tích, khuyến nghị, tin tức', make: () => [features()] },
  { id: 'b-posts-news', name: 'Bài nổi bật + tin mới', kind: 'block', category: 'tin-tuc', desc: '2 cột: danh sách bài và tin mới', make: () => [COLS('8-4', [[B('posts', { title: 'Bài viết nổi bật', count: 4, layout: 'list' })], [B('pb-latest', { title: 'Tin tức mới nhất', count: 5, sort: 'new', thumb: true, more: '/tin-tuc' })]], 24)] },
  { id: 'b-market', name: 'Thị trường tổng hợp', kind: 'block', category: 'phan-tich', desc: 'Biểu đồ giá + thanh biến động', make: () => [COLS('7-5', [[B('tv-chart', { symbol: 'HOSE:VNINDEX', height: 360 })], [B('pb-market', { title: 'Biến động', src: 'up', count: 6 })]], 24)] },
  { id: 'b-cta', name: 'CTA đăng ký', kind: 'block', category: 'landing', desc: 'Khung kêu gọi hành động', make: () => [B('pb-cta', { title: 'Đồng hành cùng bạn trên hành trình đầu tư thông minh', text: 'Nhận thông báo và phân tích từ chuyên gia.', btn: 'Đăng ký nhận tin', url: '/lien-he', look: 'brand', align: 'left' })] },
  { id: 'b-pricing', name: 'Bảng giá 3 gói', kind: 'block', category: 'landing', desc: 'Cơ bản, Chuyên nghiệp, Doanh nghiệp', make: () => [B('pb-pricing', {})] },
  { id: 'b-faq', name: 'Hỏi đáp', kind: 'block', category: 'khac', desc: 'Danh sách câu hỏi thu gọn', make: () => [B('heading', { text: 'Câu hỏi thường gặp', tag: 'h2' }), B('accordion', { items: 'Câu hỏi 1 | Trả lời 1\nCâu hỏi 2 | Trả lời 2' })] },
  { id: 'b-testi', name: '2 đánh giá khách hàng', kind: 'block', category: 'gioi-thieu', desc: 'Hai lời nhận xét cạnh nhau', make: () => [COLS('6-6', [[B('testimonial', { quote: 'Nội dung rõ ràng, dễ hiểu.', name: 'Khách hàng A', role: 'Nhà đầu tư' })], [B('testimonial', { quote: 'Dữ liệu cập nhật nhanh.', name: 'Khách hàng B', role: 'Nhà đầu tư' })]], 16)] },
];
export const seedList = () => SEED.map((t) => ({ id: 's:' + t.id, name: t.name, kind: t.kind, category: t.category, desc: t.desc, builtin: true, blocks: t.make() }));
