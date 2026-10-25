// Báo tin mới qua Telegram (tùy chọn). Cần 2 biến trong Cloudflare: TELEGRAM_BOT_TOKEN và TELEGRAM_CHAT_ID.
export function notify(locals: any, text: string) {
  const env = locals?.runtime?.env;
  if (!env?.TELEGRAM_BOT_TOKEN || !env?.TELEGRAM_CHAT_ID) return;
  const p = fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: text.slice(0, 900), disable_web_page_preview: true }),
  }).catch(() => {});
  try { locals.runtime.ctx.waitUntil(p); } catch { /* bỏ */ }
}
