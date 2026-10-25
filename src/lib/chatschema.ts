// Tự sinh từ nang-cap-4.sql. Hệ thống dùng để tự tạo bảng khi mở Chat/Hộp thư lần đầu.
export const SCHEMA: string[] = [
  "CREATE TABLE IF NOT EXISTS conversations (id INTEGER PRIMARY KEY AUTOINCREMENT, token TEXT UNIQUE NOT NULL, name TEXT DEFAULT '', email TEXT DEFAULT '', page TEXT DEFAULT '', status TEXT DEFAULT 'new', note TEXT DEFAULT '', unread_admin INTEGER DEFAULT 0, last_at TEXT, created_at TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS chat_msgs (id INTEGER PRIMARY KEY AUTOINCREMENT, conv_id INTEGER NOT NULL, role TEXT NOT NULL, body TEXT NOT NULL, by TEXT DEFAULT '', created_at TEXT NOT NULL)",
  "CREATE INDEX IF NOT EXISTS idx_chat_conv ON chat_msgs (conv_id, id)",
  "CREATE TABLE IF NOT EXISTS inbox_state (msg_id INTEGER PRIMARY KEY, status TEXT DEFAULT 'new', note TEXT DEFAULT '', updated_at TEXT)",
  "CREATE TABLE IF NOT EXISTS conv_ext (conv_id INTEGER PRIMARY KEY, phone TEXT DEFAULT '', mode TEXT DEFAULT 'auto', registered INTEGER DEFAULT 0, category TEXT DEFAULT '', suggest TEXT DEFAULT '', ai_pending INTEGER DEFAULT 0, ai_count INTEGER DEFAULT 0, handoff_at TEXT, human_at TEXT)",
  "CREATE TABLE IF NOT EXISTS mailboxes (id INTEGER PRIMARY KEY AUTOINCREMENT, label TEXT NOT NULL, provider TEXT DEFAULT 'resend', from_name TEXT DEFAULT '', from_email TEXT DEFAULT '', reply_to TEXT DEFAULT '', api_key TEXT DEFAULT '', domain TEXT DEFAULT '', extra TEXT DEFAULT '', signature TEXT DEFAULT '', is_default INTEGER DEFAULT 0, active INTEGER DEFAULT 1, created_at TEXT)",
  "CREATE TABLE IF NOT EXISTS mail_replies (id INTEGER PRIMARY KEY AUTOINCREMENT, msg_id INTEGER NOT NULL, mailbox_id INTEGER DEFAULT 0, from_email TEXT DEFAULT '', to_email TEXT DEFAULT '', subject TEXT DEFAULT '', body TEXT DEFAULT '', status TEXT DEFAULT 'sent', error TEXT DEFAULT '', by TEXT DEFAULT '', created_at TEXT NOT NULL)",
  "CREATE INDEX IF NOT EXISTS idx_mail_rep ON mail_replies (msg_id, id)",
  "CREATE TABLE IF NOT EXISTS quick_replies (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT DEFAULT 'chat', title TEXT NOT NULL, body TEXT NOT NULL, sort INTEGER DEFAULT 0)",
  "CREATE TABLE IF NOT EXISTS ai_knowledge (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, body TEXT NOT NULL, kind TEXT DEFAULT 'faq', active INTEGER DEFAULT 1, created_at TEXT)"
];

let ready = false;
const SEED_CHAT: [string, string][] = [
  ['Chào mừng', 'Chào bạn, cảm ơn bạn đã liên hệ. Mình có thể hỗ trợ gì cho bạn ạ?'],
  ['Xin SĐT/email', 'Bạn vui lòng để lại số điện thoại hoặc email để bên mình tiện hỗ trợ nhé.'],
  ['Đang kiểm tra', 'Bạn chờ mình một chút để kiểm tra thông tin nhé.'],
  ['Lưu ý rủi ro', 'Thông tin chỉ mang tính tham khảo, không phải khuyến nghị đầu tư. Bạn nên cân nhắc khẩu vị rủi ro của mình trước khi quyết định.'],
  ['Cảm ơn & kết thúc', 'Cảm ơn bạn đã trao đổi. Nếu cần thêm hỗ trợ, bạn cứ nhắn lại bất cứ lúc nào nhé!'],
];
const SEED_MAIL: [string, string][] = [
  ['Đã nhận liên hệ', 'Chào bạn,\n\nChúng tôi đã nhận được nội dung bạn gửi và sẽ phản hồi chi tiết trong thời gian sớm nhất.\n\nTrân trọng.'],
  ['Cần thêm thông tin', 'Chào bạn,\n\nĐể hỗ trợ tốt hơn, bạn vui lòng cung cấp thêm thông tin chi tiết về nhu cầu của mình (mã cổ phiếu, khung thời gian, mục tiêu đầu tư).\n\nTrân trọng.'],
];
// Tạo bảng nếu chưa có (chỉ chạy một lần cho mỗi lần khởi động). An toàn khi chạy lại.
export async function ensureChatSchema(db: any) {
  if (ready || !db) return;
  try {
    await db.batch(SCHEMA.map((s) => db.prepare(s)));
    const n: any = await db.prepare('SELECT COUNT(*) n FROM quick_replies').first();
    if (!n?.n) {
      const st = [...SEED_CHAT.map((x, i) => ['chat', x[0], x[1], i]), ...SEED_MAIL.map((x, i) => ['mail', x[0], x[1], i])];
      await db.batch(st.map((x) => db.prepare('INSERT INTO quick_replies (kind,title,body,sort) VALUES (?,?,?,?)').bind(...x)));
    }
    ready = true;
  } catch { /* để lần sau thử lại */ }
}
