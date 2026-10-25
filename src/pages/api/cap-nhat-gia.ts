import { refreshIfStale } from '../../lib/market';

export const prerender = false;

// Gọi tự động khi có người mở web; tối đa 5 phút mới làm mới giá một lần.
export async function POST({ locals }: any) {
  try {
    const r = await refreshIfStale(locals.runtime.env.DB, 5);
    return new Response(JSON.stringify(r), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
  } catch {
    return new Response(JSON.stringify({ updated: false }), { headers: { 'content-type': 'application/json' } });
  }
}
