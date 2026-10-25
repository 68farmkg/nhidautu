CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  summary TEXT DEFAULT '',
  content TEXT DEFAULT '',
  category TEXT DEFAULT 'thi-truong',
  tickers TEXT DEFAULT '',
  image TEXT DEFAULT '',
  image_kw TEXT DEFAULT '',
  image_hint TEXT DEFAULT '',
  source_url TEXT DEFAULT '',
  source_name TEXT DEFAULT '',
  status TEXT DEFAULT 'draft',
  published_at TEXT,
  created_at TEXT NOT NULL,
  views INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS quotes (
  symbol TEXT PRIMARY KEY,
  name TEXT DEFAULT '',
  kind TEXT DEFAULT 'stock',
  exchange TEXT DEFAULT 'HOSE',
  sector TEXT DEFAULT '',
  price REAL DEFAULT 0,
  change_pct REAL DEFAULT 0,
  volume TEXT DEFAULT '',
  updated_at TEXT
);
CREATE TABLE IF NOT EXISTS ai_settings (
  id TEXT PRIMARY KEY,
  enabled INTEGER DEFAULT 0,
  api_key TEXT DEFAULT '',
  model TEXT DEFAULT '',
  base TEXT DEFAULT '',
  priority INTEGER DEFAULT 100
);
CREATE TABLE IF NOT EXISTS kv (
  k TEXT PRIMARY KEY,
  v TEXT
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT, email TEXT, phone TEXT, body TEXT,
  created_at TEXT NOT NULL
);
INSERT OR IGNORE INTO quotes (symbol,name,kind,exchange,sector,price,change_pct,volume,updated_at) VALUES
('VN-INDEX','VN-Index','index','HOSE','',1265.48,0.98,'',datetime('now')),
('HNX-INDEX','HNX-Index','index','HNX','',232.17,1.01,'',datetime('now')),
('UPCOM-INDEX','UPCoM-Index','index','UPCOM','',92.34,0.95,'',datetime('now')),
('VN30','VN30','index','HOSE','',1330.12,1.16,'',datetime('now')),
('TCB','Techcombank','stock','HOSE','Ngân hàng',45.30,2.98,'8.2 triệu',datetime('now')),
('VIC','Vingroup','stock','HOSE','Bất động sản',68.50,2.10,'5.1 triệu',datetime('now')),
('HPG','Hòa Phát','stock','HOSE','Thép',28.75,1.94,'12.4 triệu',datetime('now')),
('FPT','FPT Corporation','stock','HOSE','Công nghệ',125.60,1.78,'3.3 triệu',datetime('now')),
('MWG','Thế Giới Di Động','stock','HOSE','Bán lẻ',58.20,1.57,'4.0 triệu',datetime('now'));
INSERT OR IGNORE INTO posts (slug,title,summary,content,category,tickers,status,published_at,created_at) VALUES
('vn-index-vuot-moc-1260-diem','VN-Index vượt mốc 1.260 điểm, dòng tiền lan tỏa mạnh ở nhóm cổ phiếu vốn hóa lớn','Thị trường chứng khoán khởi sắc trong phiên giao dịch với thanh khoản cải thiện (bài mẫu, hãy sửa hoặc xóa).','## Diễn biến thị trường

Đây là bài viết mẫu. Hãy vào trang quản trị để sửa hoặc xóa bài này.

## Nhận định

- Dòng tiền tập trung ở nhóm vốn hóa lớn.
- Thanh khoản cải thiện so với phiên trước.','thi-truong','TCB,VIC,FPT','published',datetime('now'),datetime('now')),
('nganh-ngan-hang-trien-vong-2025','Ngành ngân hàng: triển vọng và những thách thức','Bài mẫu về doanh nghiệp, hãy sửa hoặc xóa.','Nội dung bài mẫu.','doanh-nghiep','TCB','published',datetime('now'),datetime('now')),
('5-nguyen-ly-quan-ly-rui-ro','Kiến thức đầu tư: 5 nguyên lý quản lý rủi ro hiệu quả','Bài mẫu về kiến thức, hãy sửa hoặc xóa.','## Nguyên lý 1

Không dồn toàn bộ vốn vào một cổ phiếu.','kien-thuc','','published',datetime('now'),datetime('now'));
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
