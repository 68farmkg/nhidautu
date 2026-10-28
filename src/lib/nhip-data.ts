// Cầu nối dữ liệu NHỊP: dùng NGUYÊN mã máy chủ của nhip-19 (src/lib/nhip-worker.js) nên nhận dữ liệu y hệt:
//   1) KV chung NHIP_KV với hub (nhip-18)  2) HTTP sang HUB_URL/api/data  3) hub trống/cũ -> tự gọi thẳng nguồn như bản gốc.
// @ts-ignore  (tệp JS thuần, sao nguyên văn từ nhip-19)
import worker from './nhip-worker.js';

let ENV: any = null;
export const setNhipEnv = (e: any) => { if (e) ENV = e; };
export const nhipEnv = () => ENV;

export async function nhipFetch(path: string, init?: RequestInit, env: any = ENV): Promise<Response> {
  const e = Object.assign(Object.create(env || {}), { ASSETS: { fetch: async () => new Response('Not found', { status: 404 }) } });
  return (worker as any).fetch(new Request('https://nhip.internal' + path, init), e);
}
