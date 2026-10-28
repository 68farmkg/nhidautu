/* NHIP service worker (sinh tự động). Giao diện + toàn bộ "máy chủ" nằm trong file tĩnh nên mở được khi không có mạng.
   /proxy/* (giá, tin): ưu tiên mạng, mất mạng dùng bản đã lưu gần nhất. KLineChart (CDN) được lưu lại sau lần tải đầu. */
const SHELL = "nhip-static-v325-bctc-site", RT = "nhip-proxy", FILES = ["/nhip/","/nhip/nhip-v297f.css","/nhip/account.css","/nhip/nhip-v260.css","/nhip/nhip-v264.css","/nhip/nhip-live.js","/nhip/nhip-live-room.js","/nhip/nhip-live-fx.js","/nhip/nhip-live-cast.js","/nhip/nhip-voice.js","/nhip/nhip-mobile-head.js","/nhip/nhip-mobile-head.css","/nhip/nhip-pc-actions.css","/nhip/nhip-v268-head.css","/nhip/nhip-news-v263.css","/nhip/account.js","/nhip/ai.js","/nhip/ai-export.js","/nhip/ai-compose.js","/nhip/nhip-v290.css","/nhip/nhip-ai-card.css","/nhip/nhip-ai-card.js","/nhip/nhip-news-reader.js","/nhip/nhip-text-clean.js","/nhip/nhip-news-reader.css","/nhip/nhip-news-card.css","/nhip/nhip-v285.css","/nhip/nhip-v285.js","/nhip/analysis-exchange.js","/nhip/analysis-validate.js","/nhip/analysis-score.js","/nhip/analysis-candidates.js","/nhip/analysis-patterns.js","/nhip/analysis-risk.js","/nhip/nhip-strategies.js","/nhip/nhip-vscore.js","/nhip/nhip-fundamentals.js","/nhip/nhip-bctc.js","/nhip/nhip-dividends.js","/nhip/nhip-news-score.js","/nhip/nhip-score-plus.js","/nhip/nhip-chart-tools.js","/nhip/nhip-ai-evidence.js","/nhip/nhip-ai-trade.js","/nhip/nhip-sim-core.js","/nhip/analysis-backtest.js","/nhip/analysis-portfolio.js","/nhip/analysis-backtest-audit.js","/nhip/analysis-strategy-health.js","/nhip/analysis-run-history.js","/nhip/analysis-data-quality.js","/nhip/analysis-mtf.js","/nhip/analysis-view.css","/nhip/alerts.js","/nhip/analysis-plus.js","/nhip/analysis-view.js","/nhip/nhip-custom-select.js","/nhip/nhip-dialog.js","/nhip/nhip-dialog.css","/nhip/nhip-evidence-ui.js","/nhip/app.js","/nhip/apple-touch-icon.png","/nhip/chartfix.js","/nhip/charts-core.js","/nhip/charts-draw.css","/nhip/charts-draw.js","/nhip/charts.css","/nhip/charts.js","/nhip/charts-multi.js","/nhip/trade.js","/nhip/nhip-orders.js","/nhip/nhip-protect.js","/nhip/charts-orders.js","/nhip/charts-nav.js","/nhip/nhip-symbol-picker.js","/nhip/nhip-sym-suggest.js","/nhip/nhip-sym-sync.js","/nhip/nhip-sym-suggest.css","/nhip/nhip-news-chips.css","/nhip/nhip-pc-layout.css","/nhip/nhip-ai-symbol.js","/nhip/nhip-ai-symbol.css","/nhip/nhip-symbol-picker.css","/nhip/charts-orders-multi.js","/nhip/charts-nav.css","/nhip/nhip-chart-tools.css","/nhip/orders.css","/nhip/trading-page.js","/nhip/trade.css","/nhip/extra.css","/nhip/favicon.svg","/nhip/history.js","/nhip/indicators.js","/nhip/icon-192.png","/nhip/icon-512.png","/nhip/logo-full.svg","/nhip/logo.svg","/nhip/manifest.webmanifest","/nhip/nhip-brand.css","/nhip/desktop-enhancements.css","/nhip/desktop-fix.css","/nhip/nats.css","/nhip/nhip-ol-pop.css","/nhip/nhip-pc-fixes.css","/nhip/nhip-mobile-fix.css","/nhip/nhip-pc-fixes.js","/nhip/nhip-house.css","/nhip/nhip-house.js","/nhip/nats.js","/nhip/desktop-fix.js","/nhip/mobile.css","/nhip/mobile.js","/nhip/nhip-runtime.js","/nhip/symbols-vn.js","/nhip/offline.js","/nhip/nhip-responsive.css","/nhip/nhip-compact.css","/nhip/nhip-trade-ui.css","/nhip/nhip-trade-ui.js","/nhip/nhip-slider.js","/nhip/nhip-input-fit.js","/nhip/nhip-btn-fit.js","/nhip/nhip-fold.js","/nhip/nhip-tpsl-sheet.js","/nhip/nhip-tpsl-sheet.css","/nhip/nhip-fold.css","/nhip/styles.css","/nhip/theme.css","/nhip/watch.js"], CDN = "https://cdn.jsdelivr.net/npm/klinecharts@9.8.12/dist/umd/klinecharts.min.js";
const json = (o, s) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json" } });
const tell = m => self.clients.matchAll().then(cs => cs.forEach(c => c.postMessage(m)));
self.addEventListener("install", e => e.waitUntil((async () => {
  const c = await caches.open(SHELL);
  /* cache:"reload" bỏ qua bộ nhớ đệm HTTP/CDN để không lưu nhầm bản JS/CSS cũ vào cache mới */
  await Promise.all(FILES.map(async f => { const res = await fetch(new Request(f, { cache: "reload" })); if (!res.ok) throw new Error(f + " " + res.status); await c.put(f, res); }));
  try { await c.put(CDN, await fetch(new Request(CDN, { mode: "no-cors" }))); } catch { /* sẽ lưu ở lần tải trang có mạng sau */ }
  await self.skipWaiting();
})()));
self.addEventListener("activate", e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith("nhip-static-") && k !== SHELL) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener("fetch", e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET") return;
  if (r.url === CDN) return e.respondWith(caches.match(CDN).then(hit => hit || fetch(r).then(res => { caches.open(SHELL).then(c => c.put(CDN, res.clone())); return res; })));
  if (u.origin !== location.origin) return;
  if (u.pathname === "/proxy/ai") return; // có khóa API: không lưu cache
  if (u.pathname.startsWith("/proxy/tts")) return; // giọng đọc: luôn đi thẳng mạng
  if (u.pathname.startsWith("/proxy/live-sig")) return; // hộp thư ghép đôi phát live: luôn đi thẳng mạng, không lưu cache
  if (u.pathname === "/proxy/dchart" && u.searchParams.get("resolution") === "1" && Number(u.searchParams.get("to")) - Number(u.searchParams.get("from")) < 172800) return; /* v2.64: nhịp giá trực tiếp đi thẳng mạng, không lưu cache */
  if (u.pathname.startsWith("/proxy/")) return e.respondWith(proxy(r));
  if (r.mode === "navigate") return e.respondWith(fetch(r).catch(() => caches.match("/nhip/", { cacheName: SHELL })));
  /* Tệp tĩnh: ưu tiên mạng (luôn nhận bản mới nhất, tránh trộn index mới với JS cũ), mất mạng mới dùng cache. */
  e.respondWith(fetch(r, { cache: "no-cache" }).then(res => { if (res.ok) { const k = u.pathname; caches.open(SHELL).then(c => c.put(k, res.clone())); } return res; })
    .catch(() => caches.match(r, { cacheName: SHELL, ignoreSearch: true }).then(hit => hit || Response.error())));
});
async function proxy(r) {
  try {
    const res = await fetch(r);
    if (res.ok) (await caches.open(RT)).put(r.url, res.clone());
    return res;
  } catch {
    const hit = await caches.match(r.url, { cacheName: RT });
    if (hit) { tell({ t: "offline-hit" }); return hit; }
    return json({ error: "Đang offline và chưa có dữ liệu đã lưu." }, 503);
  }
}
