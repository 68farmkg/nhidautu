-- ĐỢT 2-4: người dùng & phân quyền, chat khách hàng, hộp thư có trạng thái.
-- Chạy MỘT LẦN trong D1 Console (dán cả khối, bấm Execute). An toàn nếu chạy lại.
-- (Khối lồng khối ở Đợt 2 không cần bảng mới.) Cần đã chạy nang-cap-2.sql trước.
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  name TEXT DEFAULT '',
  pass TEXT NOT NULL,
  role TEXT DEFAULT 'editor',
  active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  last_login TEXT
);
CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT UNIQUE NOT NULL,
  name TEXT DEFAULT '',
  email TEXT DEFAULT '',
  page TEXT DEFAULT '',
  status TEXT DEFAULT 'new',
  note TEXT DEFAULT '',
  unread_admin INTEGER DEFAULT 0,
  last_at TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS chat_msgs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conv_id INTEGER NOT NULL,
  role TEXT NOT NULL,
  body TEXT NOT NULL,
  by TEXT DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chat_conv ON chat_msgs (conv_id, id);
CREATE TABLE IF NOT EXISTS inbox_state (
  msg_id INTEGER PRIMARY KEY,
  status TEXT DEFAULT 'new',
  note TEXT DEFAULT '',
  updated_at TEXT
);
