import { all, run, nowIso, slugify, CATS, fmtNum, fmtPct } from './util';
import { ask } from './ai';

// Nhờ AI viết bản nháp và lưu vào mục "Chờ duyệt". Trả về id bài viết và tên AI đã dùng.
export async function generateDraft(env: any, db: any, o: { topic: string; cat: string; note?: string; provider?: string; sourceUrl?: string; sourceName?: string; rewrite?: boolean }) {
  const q = await all(db, 'SELECT symbol,name,price,change_pct FROM quotes ORDER BY kind, symbol');
  const data = q.map((x) => `${x.symbol} (${x.name}): ${fmtNum(x.price)}, ${fmtPct(x.change_pct)}`).join('\n');
  const system = 'Bạn là biên tập viên tài chính chứng khoán Việt Nam. Viết tiếng Việt, rõ ràng, khách quan, không hứa hẹn lợi nhuận, không khuyến nghị mua bán chắc chắn. Chỉ dùng số liệu có trong phần DỮ LIỆU hoặc do biên tập viên cung cấp; không bịa số liệu, ngày tháng hay trích dẫn. Nếu thiếu số liệu, hãy viết nhận định định tính. Không dùng định dạng markdown nào ngoài các quy ước được yêu cầu.'
    + (o.rewrite ? ' Bạn đang viết lại tin từ một nguồn báo: chỉ dùng các sự kiện có trong phần nguồn, diễn đạt hoàn toàn bằng lời văn mới, không sao chép câu chữ gốc, không thêm sự kiện không có trong nguồn.' : '');
  const user = `Chủ đề: ${o.topic}\nChuyên mục: ${CATS[o.cat] || o.cat}\n${o.rewrite ? 'Nguồn tin gốc' : 'Ghi chú/nguồn từ biên tập viên'}:\n${o.note || '(không có)'}\n\nDỮ LIỆU:\n${data}\n\nTrả lời đúng định dạng sau, mỗi nhãn nằm ở đầu một dòng, không thêm gì khác:\nTIEU DE: <tiêu đề ngắn gọn>\nTOM TAT: <1-2 câu>\nMA: <các mã liên quan, cách nhau dấu phẩy, có thể để trống>\nTU KHOA ANH: <2-4 từ khóa TIẾNG ANH để tìm ảnh minh họa trên kho ảnh miễn phí, ví dụ: stock market chart>\nGOI Y ANH: <mô tả ngắn ảnh đại diện nên dùng, bằng tiếng Việt>\nNOI DUNG:\n<bài viết ${o.rewrite ? '250-450' : '400-700'} từ; đề mục dùng "## ", gạch đầu dòng dùng "- ", các đoạn cách nhau một dòng trống. Ở 1-2 vị trí phù hợp, chèn một dòng riêng dạng [ẢNH CẦN: mô tả ảnh nên đặt ở đây] để biên tập viên thay bằng ảnh thật>`;
  const r = await ask(env, db, { system, user, provider: o.provider });
  const text = r.text;
  const pick = (label: string) => (text.match(new RegExp('^' + label + ':\\s*(.+)$', 'mi')) || [])[1]?.trim().replace(/\*\*/g, '') || '';
  const title = pick('TIEU DE') || o.topic;
  const content = (text.split(/^NOI DUNG:\s*/mi)[1] || text).trim();
  const slug = slugify(title) + '-' + Date.now().toString(36);
  const ins = await run(db, "INSERT INTO posts (slug,title,summary,content,category,tickers,image_kw,image_hint,source_url,source_name,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,'pending',?)",
    slug, title, pick('TOM TAT'), content, o.cat, pick('MA').toUpperCase(), pick('TU KHOA ANH'), pick('GOI Y ANH'), o.sourceUrl || '', o.sourceName || '', nowIso());
  return { id: ins.meta.last_row_id as number, via: r.via };
}
