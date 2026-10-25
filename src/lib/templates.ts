import { uid, STYLE_DEF, type Block } from './blocks';
const B = (type: string, props: any, style: any = {}, extra: { children?: Block[]; cols?: Block[][] } = {}): Block => ({ id: uid(), type, props, style: { ...STYLE_DEF, ...style }, ...extra });
export const TEMPLATES: Record<string, { name: string; desc: string; make: () => Block[] }> = {
  trong: { name: 'Trang trống', desc: 'Bắt đầu từ đầu', make: () => [] },
  'gioi-thieu': { name: 'Giới thiệu', desc: 'Tiêu đề, giới thiệu, 3 điểm mạnh', make: () => [
    B('heading', { text: 'Về chúng tôi', tag: 'h1' }), B('text', { text: 'Viết vài dòng giới thiệu về website và đội ngũ của bạn tại đây.' }),
    B('columns', { layout: '4-4-4', gap: 16, mobile: 'stack', valign: 'start' }, {}, { cols: [
      [B('iconbox', { icon: 'shield', title: 'Đáng tin cậy', text: 'Thông tin kiểm chứng, minh bạch.' })],
      [B('iconbox', { icon: 'chart', title: 'Cập nhật nhanh', text: 'Số liệu thị trường theo thời gian thực.' })],
      [B('iconbox', { icon: 'book', title: 'Dễ hiểu', text: 'Kiến thức viết cho người mới.' })]] })] },
  landing: { name: 'Trang chủ giới thiệu', desc: 'Banner, chỉ số, bài mới, kêu gọi', make: () => [
    B('banner', { title: 'Đầu tư thông minh hơn mỗi ngày', text: 'Tin tức, phân tích và dữ liệu thị trường trong một nơi.', btn: 'Đọc tin mới', btn_url: '/tin-tuc', bg: '#0c4a43', dark: 30, height: 380, align: 'left' }, { full: true }),
    B('indexes', {}), B('heading', { text: 'Bài viết mới', tag: 'h2' }), B('posts', { count: 6, layout: 'grid' }),
    B('columns', { layout: '6-6', gap: 16, mobile: 'stack', valign: 'start' }, {}, { cols: [
      [B('stocks', { count: 8, sort: 'up', title: 'Cổ phiếu nổi bật' })], [B('top-views', { count: 5, title: 'Đọc nhiều nhất' })]] }),
    B('button', { label: 'Liên hệ chúng tôi', url: '/lien-he' }, { al: 'center' })] },
  'landing-nhieu-phan': { name: 'Trang chủ nhiều phần (Section › Cột)', desc: 'Slider, các vùng nền, 2 cột, khung thẻ, liên hệ', make: () => [
    B('slider', { slides: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1600 | Đầu tư thông minh hơn | Tin tức, phân tích và số liệu thị trường mỗi ngày | Xem thị trường | /thi-truong\nhttps://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=1600 | Kiến thức cho người mới | Hiểu rủi ro trước khi đầu tư | Đọc ngay | /chuyen-muc/kien-thuc', height: 400, auto: 6, dark: 40 }, { full: true }),
    B('section', { bg: '#ffffff', py: 28, light: false, inner: 'wide', dark: 0, minh: 0 }, { full: true }, { children: [B('indexes', {})] }),
    B('section', { bg: '#f3f6f5', py: 40, inner: 'wide', dark: 0, minh: 0 }, { full: true }, { children: [
      B('heading', { text: 'Vì sao chọn chúng tôi', tag: 'h2' }, { al: 'center' }),
      B('columns', { layout: '4-4-4', gap: 16, mobile: 'stack', valign: 'start' }, {}, { cols: [
        [B('iconbox', { icon: 'shield', title: 'Đáng tin cậy', text: 'Thông tin kiểm chứng, minh bạch.' })],
        [B('iconbox', { icon: 'chart', title: 'Số liệu nhanh', text: 'Giá và chỉ số cập nhật liên tục.' })],
        [B('iconbox', { icon: 'book', title: 'Dễ hiểu', text: 'Kiến thức viết cho người mới.' })]] })] }),
    B('section', { bg: '#ffffff', py: 36, inner: 'wide', dark: 0, minh: 0 }, { full: true }, { children: [
      B('columns', { layout: '8-4', gap: 24, mobile: 'stack', valign: 'start' }, {}, { cols: [
        [B('heading', { text: 'Bài viết mới', tag: 'h2' }), B('posts', { count: 6, layout: 'list' })],
        [B('card', { bg: '#ffffff', pad: 16, radius: 12, border: true, shadow: false }, {}, { children: [B('stocks', { count: 6, sort: 'up', title: 'Cổ phiếu nổi bật' }), B('spacer', { h: 12, line: true }), B('top-views', { count: 5, title: 'Đọc nhiều nhất' })] })]] })] }),
    B('section', { bg: '#0a2a2f', py: 48, light: true, inner: 'wide', dark: 0, minh: 0 }, { full: true }, { children: [
      B('columns', { layout: '6-6', gap: 32, mobile: 'stack', valign: 'center' }, {}, { cols: [
        [B('heading', { text: 'Cần tư vấn?', tag: 'h2', sub: 'Để lại thông tin hoặc chat trực tiếp, chúng tôi phản hồi trong ngày.' }), B('chatbtn', { label: 'Chat với chúng tôi' })],
        [B('contactform', { title: 'Gửi liên hệ', btn: 'Gửi liên hệ' })]] })] })] },
  'lien-he': { name: 'Trang liên hệ', desc: 'Thông tin, biểu mẫu và nút chat', make: () => [
    B('heading', { text: 'Liên hệ', tag: 'h1' }),
    B('columns', { layout: '6-6', gap: 24, mobile: 'stack', valign: 'start' }, {}, { cols: [
      [B('contactform', { title: 'Gửi liên hệ cho chúng tôi', btn: 'Gửi liên hệ' })],
      [B('card', { bg: '#ffffff', pad: 18, radius: 12, border: true, shadow: false }, {}, { children: [B('heading', { text: 'Thông tin', tag: 'h3' }), B('text', { text: 'Hotline, email và địa chỉ của bạn ghi ở đây.' }), B('chatbtn', { label: 'Chat ngay' })] })]] })] },
  faq: { name: 'Hỏi đáp', desc: 'Tiêu đề và danh sách câu hỏi', make: () => [
    B('heading', { text: 'Câu hỏi thường gặp', tag: 'h1' }), B('accordion', { items: 'Website này dùng để làm gì? | Cập nhật tin tức và dữ liệu thị trường.\nTôi liên hệ bằng cách nào? | Dùng trang Liên hệ.' })] },
};
