// Tiện ích dùng chung cho các API quản trị (JSON). Đăng nhập đã được middleware kiểm tra.
export const jres = (o: any, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

// Chặn gửi chéo trang (CSRF): yêu cầu POST phải đến từ chính website này.
export function sameOrigin(req: Request) {
  const o = req.headers.get('origin');
  if (!o) return true;
  try { return new URL(o).host === new URL(req.url).host; } catch { return false; }
}
export async function readJson(req: Request): Promise<any | null> {
  if (!sameOrigin(req)) return null;
  try { return await req.json(); } catch { return null; }
}
// 0 giờ sáng hôm nay theo giờ Việt Nam, đổi sang UTC dạng ISO
export function vnDayStart() {
  const n = new Date(Date.now() + 7 * 3600 * 1000); n.setUTCHours(0, 0, 0, 0);
  return new Date(n.getTime() - 7 * 3600 * 1000).toISOString();
}
