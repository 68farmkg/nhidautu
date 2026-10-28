import { nhipFetch } from '../../lib/nhip-data';

export const prerender = false;

// Mọi /proxy/* mà giao diện NHỊP (public/nhip) gọi: rss, dchart, stocks, market, bctc, finfo, gnews, bing, article, linkcheck, ai, tts...
// Chạy chung mã với nhip-19, ưu tiên dữ liệu có sẵn từ hub (nhip-18).
const handle = ({ request, locals }: any) => nhipFetch(new URL(request.url).pathname + new URL(request.url).search, {
  method: request.method, headers: request.headers, body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
} as any, locals?.runtime?.env);
export const GET = handle, POST = handle, OPTIONS = handle;
