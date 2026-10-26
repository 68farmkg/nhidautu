import type { APIRoute } from 'astro';
import { buildBackup, PARTS } from '../../../lib/backup';
export const GET: APIRoute = async ({ locals, url }) => {
  const L: any = locals, db = L.runtime.env.DB, ok = PARTS.map((p) => p[0]);
  const parts = url.searchParams.getAll('p').filter((p) => ok.includes(p)); if (!parts.length) parts.push(...ok);
  const b = await buildBackup(db, parts);
  await L.log?.('backup.export', 'backup', parts.join(','));
  const name = `nhip-sao-luu-${new Date().toISOString().slice(0, 10)}.json`;
  return new Response(JSON.stringify(b, null, 1), { headers: { 'content-type': 'application/json; charset=utf-8', 'content-disposition': `attachment; filename="${name}"`, 'cache-control': 'no-store' } });
};
