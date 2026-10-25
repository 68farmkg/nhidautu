-- ĐỢT 5: HỆ THỐNG PLUGIN. Chạy MỘT LẦN trong D1 Console (dán cả khối, Execute). An toàn nếu chạy lại.
-- Chưa chạy tệp này thì website vẫn chạy như cũ (mọi plugin trong src/plugins coi như đang bật).
CREATE TABLE IF NOT EXISTS plugin_installs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  prev_version TEXT DEFAULT '',
  runtime TEXT DEFAULT 'builtin',      -- builtin | package
  status TEXT DEFAULT 'inactive',      -- installing|inactive|active|failed|incompatible|uninstalling
  perms TEXT DEFAULT '[]',             -- quyền quản trị viên đã duyệt
  error TEXT DEFAULT '',
  installed_at TEXT, updated_at TEXT
);
CREATE TABLE IF NOT EXISTS plugin_packages (   -- gói ZIP khai báo (chỉ là dữ liệu, không phải mã máy chủ)
  id TEXT NOT NULL, version TEXT NOT NULL,
  manifest TEXT NOT NULL, checksum TEXT DEFAULT '', created_at TEXT,
  PRIMARY KEY (id, version)
);
CREATE TABLE IF NOT EXISTS plugin_settings (
  plugin_id TEXT NOT NULL, k TEXT NOT NULL, v TEXT DEFAULT '',
  PRIMARY KEY (plugin_id, k)
);
CREATE TABLE IF NOT EXISTS plugin_placements ( -- bật/tắt, thứ tự, trang áp dụng của từng vị trí hiển thị
  plugin_id TEXT NOT NULL, slot_id TEXT NOT NULL,
  enabled INTEGER DEFAULT 1, sort INTEGER DEFAULT 0, pages TEXT DEFAULT '',
  PRIMARY KEY (plugin_id, slot_id)
);
CREATE TABLE IF NOT EXISTS plugin_migrations (
  plugin_id TEXT NOT NULL, mig_id TEXT NOT NULL, ok INTEGER DEFAULT 1, err TEXT DEFAULT '', applied_at TEXT,
  PRIMARY KEY (plugin_id, mig_id)
);
CREATE TABLE IF NOT EXISTS plugin_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plugin_id TEXT, action TEXT, detail TEXT DEFAULT '', actor TEXT DEFAULT '', created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_plugin_logs ON plugin_logs (plugin_id, id);
