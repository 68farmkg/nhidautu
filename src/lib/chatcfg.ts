// Cấu hình chat nâng cao: lưu một khối JSON trong bảng kv (khóa "chat.cfg").
// Mọi trường đều có giá trị mặc định, thiếu trường nào tự bù để không bao giờ lỗi.
import { all, run } from './util';
import { getEntry } from './px/registry';

export const DEFCFG = {
  ui: {
    theme: 'nhip', pos: 'right', ox: 18, oy: 18, scale: 100, font: 'theme',
    launcher: 'circle', launcher_icon: 'chat', launcher_label: 'Chat với chúng tôi',
    pulse: true, teaser: 'Cần hỗ trợ? Chat ngay 👋', teaser_delay: 6, anim: 'pop', sound: true,
    sub: 'Thường trả lời trong vài phút', footer: 'Thông tin chỉ mang tính tham khảo, không phải khuyến nghị đầu tư.',
    hide_mobile: false, hide_paths: '/admin', auto_open: 0, placeholder: 'Nhập tin nhắn…',
    custom: {
      p: '#12b76a', p2: '#0b8a50', pt: '#ffffff', hbg: '#0a2a2f', ht: '#ffffff', bg: '#f3f6f5', box: '#ffffff',
      vb: '#12b76a', vt: '#ffffff', ab: '#ffffff', at: '#13292b', aib: '#eaf3ff', ait: '#13292b', inp: '#ffffff', bd: '#e2e9e7',
      br: 16, bubr: 14, head: 'solid', bubble: 'round', shadow: 'md', font: 'system', blur: 0, hgrad: false, vgrad: false,
    },
  },
  show: {
    layout: 'bubble', names: true, time: true, vis_label: 'Bạn', vis_avatar: false,
    agent_name: 'Nhân viên', agent_icon: 'headset', agent_img: '', agent_badge: 'Nhân viên',
    ai_name: 'Trợ lý AI', ai_icon: 'bot', ai_img: '', ai_badge: 'AI',
    typing: true, status_dot: true,
  },
  gate: {
    on: false, name: 'required', phone: 'optional', email: 'optional', either: true,
    title: 'Xin chào! 👋', desc: 'Vui lòng cho biết thông tin để chúng tôi hỗ trợ bạn tốt hơn.',
    btn: 'Bắt đầu chat', consent: '', consent_req: false,
  },
  notify: {
    tg: true, on_start: true, each: false, email: '', mailbox: 0, webhook: '',
    confirm_visitor: true, confirm_subject: 'Chúng tôi đã nhận được tin nhắn của bạn',
    confirm_text: 'Cảm ơn bạn đã liên hệ. Chúng tôi đã nhận được thông tin và sẽ phản hồi sớm nhất có thể.',
    in_chat: true, in_chat_text: 'Cảm ơn bạn! Chúng tôi đã nhận được thông tin và sẽ phản hồi trong ít phút.',
  },
  ai: {
    mode: 'off', delay: 90, use_presence: true, outside_hours: true, away_after: 10,
    hours: { from: '08:30', to: '17:30', days: [1, 2, 3, 4, 5] },
    provider: 'auto', name: 'Trợ lý AI',
    persona: 'Bạn là chuyên viên tư vấn thông tin thị trường chứng khoán Việt Nam, nói chuyện lịch sự, dễ hiểu, trung lập.',
    rules: '',
    use_quotes: true, use_posts: true, posts_n: 6, use_kb: true,
    handoff_kw: 'gặp nhân viên, gặp người, nói chuyện với người, tư vấn viên, nhân viên tư vấn, khiếu nại',
    handoff_msg: 'Mình đã chuyển cuộc trò chuyện cho nhân viên. Bạn vui lòng chờ trong giây lát nhé.',
    fallback_msg: 'Hiện mình chưa trả lời được câu này. Nhân viên sẽ phản hồi bạn sớm nhất có thể.',
    stop_on_human: true, suggest: true, max_replies: 40, greeting: '',
  },
  chips: ['Nhận định VN-Index hôm nay', 'Tin nóng thị trường', 'Cổ phiếu nào đáng chú ý?', 'Hướng dẫn mở tài khoản'],
  handoff: { btn: true, label: 'Gặp nhân viên' },
};
export type ChatCfg = typeof DEFCFG;

const isObj = (x: any) => x && typeof x === 'object' && !Array.isArray(x);
// Trộn sâu: giữ kiểu của giá trị mặc định (chuỗi/số/bool/mảng) để dữ liệu hỏng không làm sập chat.
export function merge(def: any, src: any): any {
  if (!isObj(def)) {
    if (Array.isArray(def)) return Array.isArray(src) ? src : def;
    if (src === undefined || src === null) return def;
    if (typeof def === 'number') { const n = Number(src); return isNaN(n) ? def : n; }
    if (typeof def === 'boolean') return src === true || src === 1 || src === '1' || src === 'true';
    return String(src);
  }
  const o: any = {};
  for (const k of Object.keys(def)) o[k] = merge(def[k], isObj(src) ? src[k] : undefined);
  return o;
}

// Plugin "Hộp thư & Chat Pro" chỉ có hiệu lực khi đã cài và bật trong Admin > Tiện ích & plugin (hệ plugin px).
// Chưa bật: chat chạy như bản cơ bản (không form bắt buộc, không AI, giao diện mặc định).
export async function pluginOn(db: any, id: string) {
  try { return !!(await getEntry(db, id))?.active; } catch { return false; }
}
export async function getCfg(db: any): Promise<ChatCfg> {
  try {
    if (!(await pluginOn(db, 'chat-pro'))) return merge(DEFCFG, {});
    const rows = await all(db, "SELECT k,v FROM kv WHERE k='chat.cfg'");
    return merge(DEFCFG, rows[0] ? JSON.parse(rows[0].v) : {});
  } catch { return merge(DEFCFG, {}); }
}
export async function saveCfg(db: any, c: any) {
  const clean = merge(DEFCFG, c);
  clean.ai.hours.days = (clean.ai.hours.days || []).map(Number).filter((n: number) => n >= 0 && n <= 6);
  clean.chips = (clean.chips || []).map((s: any) => String(s).trim().slice(0, 80)).filter(Boolean).slice(0, 8);
  await run(db, 'INSERT INTO kv (k,v) VALUES (?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v', 'chat.cfg', JSON.stringify(clean));
  return clean as ChatCfg;
}

// Phần cấu hình gửi ra trình duyệt khách: KHÔNG chứa luật/persona nội bộ của AI.
export function publicCfg(c: ChatCfg, site: { chat_title: string; chat_welcome: string }) {
  return {
    ui: c.ui, show: c.show, chips: c.chips, handoff: c.handoff,
    gate: c.gate,
    ai: { on: c.ai.mode !== 'off', name: c.show.ai_name || c.ai.name },
    title: site.chat_title, welcome: site.chat_welcome,
  };
}

export const kvGet = async (db: any, k: string) => { try { return (await all(db, 'SELECT v FROM kv WHERE k=?', k))[0]?.v ?? ''; } catch { return ''; } };
export const kvSet = (db: any, k: string, v: string) => run(db, 'INSERT INTO kv (k,v) VALUES (?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v', k, v);

// Trạng thái "chủ đang online hay vắng": đặt tay (online/away) hoặc tự động theo lần cuối mở trang quản lý chat.
export async function touchAdmin(db: any) {
  try {
    const now = Math.floor(Date.now() / 1000);
    const last = Number(await kvGet(db, 'chat.seen')) || 0;
    if (now - last > 40) await kvSet(db, 'chat.seen', String(now));
  } catch { /* bỏ */ }
}
export async function isAway(db: any, cfg: ChatCfg) {
  const p = (await kvGet(db, 'chat.presence')) || 'auto';
  if (p === 'away') return true;
  if (p === 'online') return false;
  const last = Number(await kvGet(db, 'chat.seen')) || 0;
  return Math.floor(Date.now() / 1000) - last > Math.max(1, cfg.ai.away_after) * 60;
}
// Có đang trong giờ làm việc (giờ Việt Nam) không
export function inHours(cfg: ChatCfg, now = new Date()) {
  const vn = new Date(now.getTime() + 7 * 3600 * 1000);
  const day = vn.getUTCDay(), mins = vn.getUTCHours() * 60 + vn.getUTCMinutes();
  const t = (s: string) => { const [h, m] = String(s).split(':').map(Number); return (h || 0) * 60 + (m || 0); };
  if (!cfg.ai.hours.days.includes(day)) return false;
  return mins >= t(cfg.ai.hours.from) && mins < t(cfg.ai.hours.to);
}
