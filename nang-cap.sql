-- CHỈ chạy nếu bạn ĐÃ chạy schema.sql của bản cũ. Chạy TỪNG LỆNH một.
-- Nếu một lệnh báo "duplicate column name" nghĩa là đã có rồi, bỏ qua lệnh đó và chạy lệnh kế tiếp.

-- (A) từ bản đầu tiên:
ALTER TABLE posts ADD COLUMN image_kw TEXT DEFAULT '';
ALTER TABLE posts ADD COLUMN image_hint TEXT DEFAULT '';
CREATE TABLE IF NOT EXISTS ai_settings (
  id TEXT PRIMARY KEY,
  enabled INTEGER DEFAULT 0,
  api_key TEXT DEFAULT '',
  model TEXT DEFAULT '',
  base TEXT DEFAULT '',
  priority INTEGER DEFAULT 100
);

-- (B) bản có giá thị trường và RSS:
ALTER TABLE posts ADD COLUMN source_url TEXT DEFAULT '';
ALTER TABLE posts ADD COLUMN source_name TEXT DEFAULT '';
CREATE TABLE IF NOT EXISTS kv (
  k TEXT PRIMARY KEY,
  v TEXT
);
