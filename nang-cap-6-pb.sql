-- ĐỢT 7: PAGE BUILDER PRO. Chạy MỘT LẦN trong D1 Console (dán cả khối, Execute). An toàn nếu chạy lại.
-- Không bắt buộc: khi plugin "Page Builder Pro" được cài trong Tiện ích & plugin, hệ plugin tự tạo các bảng này.
-- Dữ liệu trang cũ (bảng pages, revisions) KHÔNG bị đụng tới.
CREATE TABLE IF NOT EXISTS px_page_builder_drafts (page_id INTEGER PRIMARY KEY, doc TEXT NOT NULL, by TEXT DEFAULT '', updated_at TEXT);
CREATE TABLE IF NOT EXISTS px_page_builder_versions (id INTEGER PRIMARY KEY AUTOINCREMENT, page_id INTEGER NOT NULL, doc TEXT NOT NULL, kind TEXT DEFAULT 'publish', note TEXT DEFAULT '', by TEXT DEFAULT '', created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS px_page_builder_idx_ver ON px_page_builder_versions (page_id, id);
CREATE TABLE IF NOT EXISTS px_page_builder_meta (page_id INTEGER PRIMARY KEY, meta TEXT DEFAULT '{}', side TEXT DEFAULT '[]', updated_at TEXT);
CREATE TABLE IF NOT EXISTS px_page_builder_templates (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, kind TEXT DEFAULT 'page', category TEXT DEFAULT 'khac', descr TEXT DEFAULT '', doc TEXT NOT NULL, shared INTEGER DEFAULT 0, owner TEXT DEFAULT '', created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS px_page_builder_reusable (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, block TEXT NOT NULL, owner TEXT DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT);
-- Bản 1.1: Danh mục trang
CREATE TABLE IF NOT EXISTS px_page_builder_cats (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, slug TEXT NOT NULL, descr TEXT DEFAULT '', sort INTEGER DEFAULT 0, created_at TEXT NOT NULL);
