import type { BlockDef } from './blocks';
import type { Field } from './px/manifest';

// Plugin mã nguồn = một thư mục src/plugins/<tên>/index.ts có "export default { ... }" (được build cùng website).
// Tương thích ngược: plugin cũ chỉ cần id/name/blocks/admin vẫn chạy; các trường mới đều tùy chọn.
// Trạng thái bật/tắt, cấu hình, nhật ký nằm trong D1 (xem lib/px/registry.ts) và quản lý ở Admin > Tiện ích & plugin.
export type Ctx = { db: any; env: any; url: URL; request: Request; settings: Record<string, string>; user?: any };
export type SlotDef = { id: string; slot: string; label: string; pages?: string; render: (ctx: { db: any; settings: Record<string, string>; url: URL }) => string | Promise<string> };
export type ApiRoute = { path: string; method: 'GET' | 'POST'; public?: boolean; handler: (ctx: Ctx & { params: string[] }) => Response | Promise<Response> };
export type Plugin = {
  id: string; name: string; desc?: string; version?: string; icon?: string;
  author?: string; category?: string;
  defaultOff?: boolean;               // plugin mới: không tự bật, phải cài trong Admin (plugin cũ không có cờ này nên giữ nguyên là đang bật)
  api?: number;                       // phiên bản API plugin cần (mặc định 2)
  requires?: string[];                // id các plugin phải đang bật
  permissions?: string[];             // quyền khai báo (xem PERMS trong px/manifest.ts)
  settings?: Field[];                 // trang cấu hình tự sinh
  migrations?: { id: string; sql: string[] }[]; // chỉ CREATE TABLE/INDEX IF NOT EXISTS với tên bảng bắt đầu px_<id>_
  slots?: SlotDef[];                  // chèn vào vị trí cố định trên website
  hooks?: Record<string, (payload: any, ctx: { db: any; settings: Record<string, string> }) => any>;
  routes?: ApiRoute[];                // API do plugin cung cấp, qua /api/px/<id>/<path>
  blocks?: BlockDef[];
  admin?: (ctx: Ctx) => string | Promise<string>;
  // Plugin có trang quản trị / trang cài đặt riêng (không nằm ở /admin/p/<id>): hiện nút trong Tiện ích & plugin
  open?: string; openLabel?: string; settingsUrl?: string; features?: string[];
};

const mods = import.meta.glob('../plugins/*/index.ts', { eager: true }) as Record<string, { default: Plugin }>;
export const PLUGINS: Plugin[] = Object.values(mods).map((m) => m.default).filter(Boolean);
