-- ĐỢT 1 (LÕI). Chạy MỘT LẦN trong D1 Console (dán cả khối, bấm Execute). An toàn nếu chạy lại.
CREATE TABLE IF NOT EXISTS pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  blocks TEXT DEFAULT '[]',
  status TEXT DEFAULT 'draft',
  is_template INTEGER DEFAULT 0,
  show_header INTEGER DEFAULT 1,
  show_footer INTEGER DEFAULT 1,
  seo_title TEXT DEFAULT '',
  seo_desc TEXT DEFAULT '',
  seo_image TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT
);
CREATE TABLE IF NOT EXISTS nav_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  loc TEXT NOT NULL,
  label TEXT NOT NULL,
  url TEXT DEFAULT '#',
  icon TEXT DEFAULT '',
  parent_id INTEGER DEFAULT 0,
  sort INTEGER DEFAULT 0,
  target TEXT DEFAULT '',
  device TEXT DEFAULT 'all'
);
CREATE TABLE IF NOT EXISTS widgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT DEFAULT '',
  vars TEXT DEFAULT '',
  created_at TEXT
);
CREATE TABLE IF NOT EXISTS revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ref TEXT, ref_id INTEGER, title TEXT, data TEXT, created_at TEXT
);
INSERT INTO nav_items (loc,label,url,icon,sort)
SELECT * FROM (VALUES
 ('header','Trang chủ','/','home',1),('header','Thị trường','/thi-truong','chart',2),
 ('header','Doanh nghiệp','/chuyen-muc/doanh-nghiep','building',3),('header','Phân tích','/chuyen-muc/phan-tich','layers',4),
 ('header','Kiến thức','/chuyen-muc/kien-thuc','book',5),('header','Tin tức','/tin-tuc','news',6),('header','Liên hệ','/lien-he','mail',7),
 ('mobile','Trang chủ','/','home',1),('mobile','Thị trường','/thi-truong','chart',2),('mobile','Doanh nghiệp','/chuyen-muc/doanh-nghiep','building',3),
 ('mobile','Phân tích','/chuyen-muc/phan-tich','layers',4),('mobile','Kiến thức','/chuyen-muc/kien-thuc','book',5),('mobile','Liên hệ','/lien-he','mail',6),
 ('bottom','Trang chủ','/','home',1),('bottom','Thị trường','/thi-truong','chart',2),('bottom','Tin tức','/tin-tuc','news',3),
 ('bottom','Tìm kiếm','/tim-kiem','search',4),('bottom','Liên hệ','/lien-he','mail',5),
 ('footer1','Thị trường','/thi-truong','',1),('footer1','Doanh nghiệp','/chuyen-muc/doanh-nghiep','',2),('footer1','Phân tích','/chuyen-muc/phan-tich','',3),
 ('footer2','Kiến thức','/chuyen-muc/kien-thuc','',1),('footer2','Tin tức','/tin-tuc','',2),('footer2','Liên hệ','/lien-he','',3)
) WHERE NOT EXISTS (SELECT 1 FROM nav_items);
