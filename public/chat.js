/* NHỊP CHAT v2: cửa sổ chat cho khách (nhiều giao diện, form thông tin, AI, chuyển nhân viên).
   Nhúng tự động bởi website: <script src="/chat.js" data-cfg='{...}' defer>. Trang cài đặt dùng data-lib="1" để vẽ bản xem trước. */
(function () {
  'use strict';
  if (window.NhipChat) return;

  var IC = {
    chat: '<path d="M21 12a8 8 0 01-11.6 7.1L4 20l1-4.6A8 8 0 1121 12z"/>',
    headset: '<path d="M4 14v-2a8 8 0 0116 0v2"/><rect x="3" y="14" width="4" height="6" rx="2"/><rect x="17" y="14" width="4" height="6" rx="2"/><path d="M19 20c0 1.5-2 2-5 2"/>',
    bot: '<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 4v4M9 14h.01M15 14h.01M2 13v3M22 13v3"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>',
    spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>',
    send: '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    min: '<path d="M6 12h12"/>',
    uplus: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0114 0M19 8v6M16 11h6"/>',
    star: '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>',
    shield: '<path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z"/>',
    heart: '<path d="M12 21s-8-5.5-8-11a4.5 4.5 0 018-2.8A4.5 4.5 0 0120 10c0 5.5-8 11-8 11z"/>',
    chip: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
    msgs: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>'
  };
  function svg(n, s) { return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (IC[n] || IC.chat) + '</svg>'; }

  var FONTS = {
    system: 'system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif',
    inter: 'Inter,system-ui,-apple-system,"Segoe UI",sans-serif',
    serif: 'Georgia,"Times New Roman",serif',
    mono: 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace',
    round: '"Nunito","Quicksand","Segoe UI",system-ui,sans-serif'
  };
  var SH = {
    none: 'none', sm: '0 4px 14px rgba(0,0,0,.12)', md: '0 12px 36px rgba(0,0,0,.22)', lg: '0 22px 64px rgba(0,0,0,.34)',
    glow: '0 16px 48px color-mix(in srgb,var(--p) 42%,transparent),0 4px 14px rgba(0,0,0,.14)', hard: '6px 6px 0 #111'
  };
  function T(label, desc, o) { o.label = label; o.desc = desc; return o; }
  var THEMES = {
    nhip: T('Nhịp Xanh', 'Mặc định, xanh lá - navy', { p: '#12b76a', p2: '#0b8a50', pt: '#ffffff', hbg: 'linear-gradient(135deg,#0a2a2f,#0f3b3f)', ht: '#ffffff', bg: '#f3f6f5', box: '#ffffff', vb: 'linear-gradient(135deg,#12b76a,#0b8a50)', vt: '#ffffff', ab: '#ffffff', at: '#13292b', aib: '#e8f5ff', ait: '#0f2b3d', inp: '#ffffff', bd: '#e2e9e7', br: 16, bubr: 16, head: 'solid', bubble: 'tail', shadow: 'md', font: 'system', blur: 0 }),
    navy: T('Fintech Navy', 'Xanh dương tài chính, chuyên nghiệp', { p: '#0ea5e9', p2: '#2563eb', pt: '#ffffff', hbg: 'linear-gradient(135deg,#0b1f3a,#16417a)', ht: '#ffffff', bg: '#f4f8fc', box: '#ffffff', vb: 'linear-gradient(135deg,#0ea5e9,#2563eb)', vt: '#ffffff', ab: '#ffffff', at: '#0f2742', aib: '#eef4ff', ait: '#0f2742', inp: '#ffffff', bd: '#dbe6f3', br: 18, bubr: 16, head: 'solid', bubble: 'round', shadow: 'lg', font: 'inter', blur: 0 }),
    aurora: T('Aurora', 'Gradient tím - hồng, bo cong, phát sáng', { p: '#8b5cf6', p2: '#ec4899', pt: '#ffffff', hbg: 'linear-gradient(135deg,#6366f1,#8b5cf6 55%,#ec4899)', ht: '#ffffff', bg: '#faf7ff', box: '#ffffff', vb: 'linear-gradient(135deg,#8b5cf6,#ec4899)', vt: '#ffffff', ab: '#ffffff', at: '#2b1b4a', aib: '#f3ecff', ait: '#2b1b4a', inp: '#ffffff', bd: '#eadffd', br: 26, bubr: 20, head: 'curve', bubble: 'round', shadow: 'glow', font: 'round', blur: 0 }),
    terminal: T('Terminal Dark', 'Nền đen, chữ xanh kiểu bảng giao dịch', { dark: 1, p: '#22c55e', p2: '#16a34a', pt: '#04120a', hbg: '#07110d', ht: '#22c55e', bg: '#0b1512', box: '#0b1512', vb: '#16a34a', vt: '#04120a', ab: '#12211b', at: '#d1fae5', aib: '#0f2a22', ait: '#a7f3d0', inp: '#0f1b17', bd: '#1d3b30', br: 6, bubr: 4, head: 'solid', bubble: 'sharp', shadow: 'glow', font: 'mono', blur: 0 }),
    gold: T('Gold Premium', 'Đen - vàng sang trọng, phông serif', { dark: 1, p: '#d4a017', p2: '#f5d061', pt: '#1a1405', hbg: 'linear-gradient(135deg,#0d0b07,#2a2110)', ht: '#f5d061', bg: '#14110b', box: '#14110b', vb: 'linear-gradient(135deg,#d4a017,#f5d061)', vt: '#1a1405', ab: '#221c10', at: '#f3e7c6', aib: '#2b2314', ait: '#f3e7c6', inp: '#1b160c', bd: '#3a2f17', br: 14, bubr: 14, head: 'solid', bubble: 'round', shadow: 'lg', font: 'serif', blur: 0 }),
    glass: T('Kính mờ (Glass)', 'Trong suốt, làm mờ nền trang web', { p: '#6366f1', p2: '#06b6d4', pt: '#ffffff', hbg: 'rgba(255,255,255,.35)', ht: '#0f172a', bg: 'rgba(255,255,255,.12)', box: 'rgba(255,255,255,.62)', vb: 'linear-gradient(135deg,#6366f1,#06b6d4)', vt: '#ffffff', ab: 'rgba(255,255,255,.85)', at: '#0f172a', aib: 'rgba(224,242,254,.9)', ait: '#0f172a', inp: 'rgba(255,255,255,.9)', bd: 'rgba(255,255,255,.6)', br: 26, bubr: 18, head: 'glass', bubble: 'round', shadow: 'lg', font: 'inter', blur: 22 }),
    minimal: T('Tối giản', 'Trắng - đen, phẳng, thanh lịch', { p: '#111827', p2: '#374151', pt: '#ffffff', hbg: '#ffffff', ht: '#111827', bg: '#ffffff', box: '#ffffff', vb: '#111827', vt: '#ffffff', ab: '#f3f4f6', at: '#111827', aib: '#f3f4f6', ait: '#111827', inp: '#ffffff', bd: '#e5e7eb', br: 12, bubr: 12, head: 'solid', bubble: 'round', shadow: 'sm', font: 'inter', blur: 0 }),
    imessage: T('Tin nhắn (iMessage)', 'Bong bóng xanh có đuôi, quen thuộc', { p: '#0a84ff', p2: '#0a84ff', pt: '#ffffff', hbg: 'rgba(247,247,247,.9)', ht: '#111111', bg: '#ffffff', box: '#ffffff', vb: '#0a84ff', vt: '#ffffff', ab: '#e9e9eb', at: '#000000', aib: '#e9e9eb', ait: '#000000', inp: '#ffffff', bd: '#e5e5ea', br: 20, bubr: 18, head: 'glass', bubble: 'tail', shadow: 'md', font: 'system', blur: 0 }),
    sunset: T('Hoàng hôn', 'Cam - hồng ấm áp, năng động', { p: '#f97316', p2: '#ec4899', pt: '#ffffff', hbg: 'linear-gradient(135deg,#f97316,#ec4899)', ht: '#ffffff', bg: '#fff7ed', box: '#ffffff', vb: 'linear-gradient(135deg,#f97316,#ec4899)', vt: '#ffffff', ab: '#ffffff', at: '#431407', aib: '#ffe9d6', ait: '#431407', inp: '#ffffff', bd: '#fde3cc', br: 22, bubr: 20, head: 'curve', bubble: 'round', shadow: 'glow', font: 'round', blur: 0 }),
    sage: T('Xanh lá dịu (Sage)', 'Nhẹ nhàng, dễ chịu, tin cậy', { p: '#5b8a72', p2: '#3f6b55', pt: '#ffffff', hbg: 'linear-gradient(135deg,#2f4f43,#3f6b55)', ht: '#ffffff', bg: '#f1f5f2', box: '#ffffff', vb: '#5b8a72', vt: '#ffffff', ab: '#ffffff', at: '#1f2f27', aib: '#e4efe8', ait: '#1f2f27', inp: '#ffffff', bd: '#dbe6df', br: 20, bubr: 18, head: 'curve', bubble: 'round', shadow: 'md', font: 'round', blur: 0 }),
    brutal: T('Neo-Brutalism', 'Viền đen dày, bóng cứng, màu vàng nổi', { p: '#ffd43b', p2: '#ffd43b', pt: '#111111', hbg: '#ffd43b', ht: '#111111', bg: '#fffbe6', box: '#ffffff', vb: '#ffd43b', vt: '#111111', ab: '#ffffff', at: '#111111', aib: '#c7f0ff', ait: '#111111', inp: '#ffffff', bd: '#111111', br: 8, bubr: 6, head: 'solid', bubble: 'brutal', shadow: 'hard', font: 'system', blur: 0 }),
    ocean: T('Đại dương', 'Xanh ngọc mát mắt', { p: '#06b6d4', p2: '#0e7490', pt: '#ffffff', hbg: 'linear-gradient(135deg,#0e7490,#06b6d4)', ht: '#ffffff', bg: '#ecfeff', box: '#ffffff', vb: 'linear-gradient(135deg,#06b6d4,#0e7490)', vt: '#ffffff', ab: '#ffffff', at: '#083344', aib: '#cffafe', ait: '#083344', inp: '#ffffff', bd: '#c8eef4', br: 20, bubr: 18, head: 'curve', bubble: 'round', shadow: 'md', font: 'system', blur: 0 }),
    amber: T('Bloomberg Amber', 'Đen - cam hổ phách như phần mềm chứng khoán', { dark: 1, p: '#ff9f1c', p2: '#ff7b00', pt: '#111111', hbg: '#000000', ht: '#ff9f1c', bg: '#0a0a0a', box: '#0a0a0a', vb: '#ff9f1c', vt: '#111111', ab: '#161616', at: '#f5f5f5', aib: '#1d1a12', ait: '#ffd9a0', inp: '#111111', bd: '#2a2a2a', br: 4, bubr: 3, head: 'solid', bubble: 'sharp', shadow: 'lg', font: 'mono', blur: 0 }),
    rose: T('Hồng Pastel', 'Dịu dàng, thân thiện', { p: '#f43f5e', p2: '#fb7185', pt: '#ffffff', hbg: 'linear-gradient(135deg,#fb7185,#f43f5e)', ht: '#ffffff', bg: '#fff1f2', box: '#ffffff', vb: 'linear-gradient(135deg,#fb7185,#f43f5e)', vt: '#ffffff', ab: '#ffffff', at: '#4c0519', aib: '#ffe4e6', ait: '#4c0519', inp: '#ffffff', bd: '#fecdd3', br: 24, bubr: 22, head: 'curve', bubble: 'round', shadow: 'md', font: 'round', blur: 0 })
  };

  var CSS = [
    '.nx{font-family:var(--font);font-size:14px;line-height:1.45;color:var(--at);-webkit-font-smoothing:antialiased}',
    '.nx *,.nx *::before,.nx *::after{box-sizing:border-box}',
    '.nx button,.nx input,.nx textarea{font:inherit;color:inherit;margin:0}.nx button{cursor:pointer}',
    '.nx-btn{position:fixed;bottom:var(--oy);z-index:2147482000;display:flex;align-items:center;justify-content:center;gap:8px;border:0;background:linear-gradient(135deg,var(--p),var(--p2));color:var(--pt);height:calc(58px*var(--sc));min-width:calc(58px*var(--sc));padding:0;box-shadow:var(--sh);transition:transform .2s}',
    '.nx-pr .nx-btn{right:var(--ox)}.nx-pl .nx-btn{left:var(--ox)}.nx-btn:hover{transform:translateY(-2px) scale(1.05)}',
    '.nx-lc .nx-btn{border-radius:50%}.nx-lr .nx-btn{border-radius:18px}.nx-lp .nx-btn{border-radius:40px;padding:0 20px 0 16px;font-weight:700}',
    '.nx-bl{display:none}.nx-lp .nx-bl{display:inline}',
    '.nx-btn.pulse::after{content:"";position:absolute;inset:0;border-radius:inherit;border:2px solid var(--p);animation:nxp 2.2s infinite;pointer-events:none}',
    '@keyframes nxp{0%{transform:scale(1);opacity:.7}100%{transform:scale(1.55);opacity:0}}',
    '.nx-n{position:absolute;top:-5px;right:-5px;min-width:20px;height:20px;padding:0 5px;border-radius:10px;background:#ef4444;color:#fff;font-size:12px;font-weight:700;display:none;place-items:center}.nx-n.on{display:grid}',
    '.nx-tz{position:fixed;bottom:calc(var(--oy) + 72px*var(--sc));z-index:2147482000;max-width:240px;background:var(--box);color:var(--at);border:1px solid var(--bd);border-radius:14px;padding:10px 28px 10px 14px;box-shadow:var(--sh);display:none;cursor:pointer;animation:nxu .35s}',
    '.nx-pr .nx-tz{right:var(--ox)}.nx-pl .nx-tz{left:var(--ox)}.nx-tz.on{display:block}.nx-tz i{position:absolute;top:4px;right:9px;font-style:normal;opacity:.5;font-size:17px}',
    '.nx-box{position:fixed;bottom:calc(var(--oy) + 74px*var(--sc));z-index:2147482001;width:calc(380px*var(--sc));height:calc(580px*var(--sc));max-width:calc(100vw - 20px);max-height:calc(100vh - var(--oy) - 90px*var(--sc));background:var(--box);border:1px solid var(--bd);border-radius:var(--br);box-shadow:var(--sh);display:none;flex-direction:column;overflow:hidden;backdrop-filter:blur(var(--blur));-webkit-backdrop-filter:blur(var(--blur))}',
    '.nx-pr .nx-box{right:var(--ox)}.nx-pl .nx-box{left:var(--ox)}.nx-box.on{display:flex}',
    '.nx-ap .nx-box.on{animation:nxpop .26s cubic-bezier(.2,.9,.3,1.15)}.nx-as .nx-box.on{animation:nxu .3s}.nx-af .nx-box.on{animation:nxf .25s}',
    '@keyframes nxpop{from{opacity:0;transform:scale(.86) translateY(18px)}}@keyframes nxu{from{opacity:0;transform:translateY(16px)}}@keyframes nxf{from{opacity:0}}',
    '.nx-h{background:var(--hbg);color:var(--ht);padding:14px;display:flex;align-items:center;gap:12px;flex:none;position:relative;border-bottom:1px solid var(--bd)}',
    '.nx-hc .nx-h{border-radius:0 0 26px 26px;padding-bottom:20px;z-index:1;border-bottom:0}.nx-hg .nx-h{backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px)}',
    '.nx-av{width:40px;height:40px;border-radius:50%;background:color-mix(in srgb,currentColor 16%,transparent);display:grid;place-items:center;flex:none;position:relative}',
    '.nx-av img,.nx-ma img{width:100%;height:100%;object-fit:cover;border-radius:50%}',
    '.nx-dt{position:absolute;right:-1px;bottom:-1px;width:12px;height:12px;border-radius:50%;background:#22c55e;border:2px solid var(--box)}',
    '.nx-ht{flex:1;min-width:0}.nx-ht b{display:block;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.nx-ht small{display:block;opacity:.82;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.nx-hb{background:color-mix(in srgb,currentColor 14%,transparent);border:0;width:34px;height:34px;border-radius:50%;display:grid;place-items:center;flex:none}.nx-hb:hover{background:color-mix(in srgb,currentColor 26%,transparent)}',
    '.nx-ls{flex:1;overflow:auto;padding:14px 12px;background:var(--bg);display:flex;flex-direction:column;gap:10px;scroll-behavior:smooth}',
    '.nx-hc .nx-ls{margin-top:-14px;padding-top:26px}',
    '.nx-m{display:flex;gap:8px;align-items:flex-end;max-width:100%}.nx-m.v{flex-direction:row-reverse}',
    '.nx-ma{width:30px;height:30px;border-radius:50%;flex:none;display:grid;place-items:center;background:color-mix(in srgb,var(--p) 18%,var(--box));color:var(--p);overflow:hidden}',
    '.nx-m.i .nx-ma{background:color-mix(in srgb,var(--p2) 22%,var(--box));color:var(--p2)}.nx-m.v .nx-ma{background:var(--bd);color:var(--at)}',
    '.nx-mb{max-width:80%;min-width:0}.nx-m.v .nx-mb{display:flex;flex-direction:column;align-items:flex-end}',
    '.nx-nm{font-size:11px;opacity:.72;margin:0 6px 3px;display:flex;gap:6px;align-items:center;font-weight:600}',
    '.nx-bd{font-size:9px;font-weight:700;letter-spacing:.04em;padding:1px 6px;border-radius:8px;background:var(--p);color:var(--pt);text-transform:uppercase}',
    '.nx-bb{padding:9px 13px;white-space:pre-wrap;word-break:break-word;border-radius:var(--bubr);overflow-wrap:anywhere}',
    '.nx-m.v .nx-bb{background:var(--vb);color:var(--vt)}',
    '.nx-m.a .nx-bb{background:var(--ab);color:var(--at);border:1px solid var(--bd)}',
    '.nx-m.i .nx-bb{background:var(--aib);color:var(--ait);border:1px solid var(--bd)}',
    '.nx-bt-tail .nx-m.v .nx-bb{border-bottom-right-radius:4px}.nx-bt-tail .nx-m.a .nx-bb,.nx-bt-tail .nx-m.i .nx-bb{border-bottom-left-radius:4px}',
    '.nx-bt-sharp .nx-bb{border-radius:3px}',
    '.nx-bt-brutal .nx-bb{border:2px solid #111!important;box-shadow:3px 3px 0 #111;border-radius:6px}',
    '.nx-bt-flat .nx-bb{border-radius:8px}',
    '.nx-tm{font-size:10px;opacity:.55;margin:3px 6px 0}',
    '.nx-sy{align-self:center;text-align:center;font-size:12px;opacity:.7;max-width:92%;background:color-mix(in srgb,var(--at) 7%,transparent);padding:5px 12px;border-radius:12px}',
    '.nx-ly-flat .nx-m,.nx-ly-flat .nx-m.v{flex-direction:row;align-items:flex-start}.nx-ly-flat .nx-mb,.nx-ly-flat .nx-m.v .nx-mb{max-width:100%;align-items:flex-start}',
    '.nx-ly-flat .nx-bb{background:none!important;border:0!important;box-shadow:none!important;padding:0 6px;color:var(--at)!important}',
    '.nx-ly-flat .nx-m.v .nx-ma{display:grid}',
    '.nx-cap{font-size:11px;opacity:.6;padding-left:44px;margin-bottom:-4px}',
    '.nx-ch{display:flex;flex-wrap:wrap;gap:6px;padding-left:44px}.nx-nav .nx-ch,.nx-nav .nx-cap{padding-left:0}',
    '.nx-ch button{border:1px solid var(--p);color:var(--at);background:transparent;border-radius:999px;padding:6px 12px;font-size:13px;text-align:left;transition:.15s}',
    '.nx-ch button:hover{background:var(--p);color:var(--pt)}',
    '.nx-ty{display:flex;gap:4px;padding:11px 14px;background:var(--aib);border:1px solid var(--bd);border-radius:var(--bubr);width:max-content}',
    '.nx-ty i{width:7px;height:7px;border-radius:50%;background:var(--p2);opacity:.5;animation:nxd 1.1s infinite}.nx-ty i:nth-child(2){animation-delay:.18s}.nx-ty i:nth-child(3){animation-delay:.36s}',
    '@keyframes nxd{0%,60%,100%{transform:translateY(0);opacity:.4}30%{transform:translateY(-5px);opacity:1}}',
    '.nx-f{padding:8px 10px 8px;background:var(--box);border-top:1px solid var(--bd);flex:none}',
    '.nx-hf{display:flex;margin:0 0 7px}.nx-hf button{border:1px dashed var(--bd);background:transparent;border-radius:999px;padding:4px 11px;font-size:12px;display:inline-flex;gap:6px;align-items:center;opacity:.85}.nx-hf button:hover{border-color:var(--p);color:var(--p);opacity:1}',
    '.nx-row{display:flex;gap:8px;align-items:flex-end}',
    '.nx-in{flex:1;min-height:42px;max-height:110px;resize:none;border:1px solid var(--bd);background:var(--inp);color:var(--at);border-radius:calc(var(--br)*.75);padding:10px 12px;outline:0;line-height:1.4;display:block}',
    '.nx-in::placeholder{color:var(--at);opacity:.45}.nx-in:focus{border-color:var(--p);box-shadow:0 0 0 3px color-mix(in srgb,var(--p) 22%,transparent)}',
    '.nx-sd{width:42px;height:42px;border-radius:50%;border:0;background:linear-gradient(135deg,var(--p),var(--p2));color:var(--pt);display:grid;place-items:center;flex:none;transition:.15s}.nx-sd:disabled{opacity:.5}.nx-sd:not(:disabled):hover{transform:scale(1.07)}',
    '.nx-bt-brutal .nx-sd,.nx-bt-brutal .nx-go{border:2px solid #111;box-shadow:2px 2px 0 #111}',
    '.nx-ft{text-align:center;font-size:10.5px;opacity:.5;margin-top:6px}',
    '.nx-g{display:none;flex:1;overflow:auto;padding:24px 20px;background:var(--bg);flex-direction:column;gap:12px}.nx-gating .nx-g{display:flex}.nx-gating .nx-ls,.nx-gating .nx-f{display:none}',
    '.nx-hc .nx-g{margin-top:-14px;padding-top:34px}',
    '.nx-g h3{margin:0;font-size:20px;line-height:1.25}.nx-g p{margin:0;opacity:.75}',
    '.nx-g label{font-size:12px;font-weight:700;opacity:.85;display:block;margin-bottom:4px}.nx-g label em{color:#ef4444;font-style:normal}',
    '.nx-g input[type=text],.nx-g input[type=tel],.nx-g input[type=email]{width:100%;height:44px;border:1px solid var(--bd);background:var(--inp);color:var(--at);border-radius:calc(var(--br)*.7);padding:0 12px;outline:0}',
    '.nx-g input:focus{border-color:var(--p);box-shadow:0 0 0 3px color-mix(in srgb,var(--p) 22%,transparent)}',
    '.nx-er{color:#ef4444;font-size:12.5px;min-height:18px}.nx-ck{display:flex;gap:8px;font-size:12px;align-items:flex-start;opacity:.85}.nx-ck input{margin-top:2px}',
    '.nx-go{height:46px;border:0;border-radius:calc(var(--br)*.75);background:linear-gradient(135deg,var(--p),var(--p2));color:var(--pt);font-weight:700;font-size:15px}.nx-go:disabled{opacity:.6}',
    '.nx-note{font-size:11.5px;opacity:.6}',
    '@media(max-width:860px){body.hasbar .nx-btn{bottom:calc(var(--oy) + 62px + env(safe-area-inset-bottom))}body.hasbar .nx-tz{bottom:calc(var(--oy) + 136px + env(safe-area-inset-bottom))}}',
    '@media(max-width:560px){.nx:not(.nx-prev) .nx-box{top:0!important;left:0!important;right:0!important;bottom:0!important;width:auto!important;height:auto!important;max-width:none!important;max-height:none!important;border-radius:0!important;border:0!important;padding-top:env(safe-area-inset-top)}.nx:not(.nx-prev) .nx-f{padding-bottom:max(8px,env(safe-area-inset-bottom))}.nx-in{font-size:16px}}',
    '.nx-prev{display:flex;flex-direction:column;align-items:flex-end;gap:12px;width:100%}.nx-prev.nx-pl{align-items:flex-start}',
    '.nx-prev .nx-box{position:relative!important;display:flex!important;inset:auto!important;width:calc(380px*var(--sc))!important;max-width:100%!important;height:560px!important;max-height:none!important;animation:none!important}',
    '.nx-prev .nx-btn,.nx-prev .nx-tz{position:relative!important;inset:auto!important}.nx-prev .nx-tz{display:block}',
    '.nx-prev.nx-vgate .nx-tz,.nx-prev.nx-vchat .nx-tz{display:none}.nx-prev.nx-vclosed .nx-box{display:none!important}'
  ].join('\n');

  function injectCss() {
    if (document.getElementById('nx-css')) return;
    var s = document.createElement('style'); s.id = 'nx-css'; s.textContent = CSS; (document.head || document.documentElement).appendChild(s);
  }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function safeImg(u) { return /^(https:\/\/|\/)[^\s"'<>]+$/i.test(u || '') ? u : ''; }
  function fmtTime(iso) { try { var d = iso ? new Date(iso) : new Date(); if (isNaN(d)) d = new Date(); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); } catch (e) { return ''; } }

  function resolveTheme(ui) {
    var t;
    if (ui.theme === 'custom') {
      t = Object.assign({}, THEMES.nhip, ui.custom || {});
      if (t.hgrad) t.hbg = 'linear-gradient(135deg,' + t.p + ',' + t.p2 + ')';
      if (t.vgrad) t.vb = 'linear-gradient(135deg,' + t.p + ',' + t.p2 + ')';
    } else t = Object.assign({}, THEMES[ui.theme] || THEMES.nhip);
    return t;
  }
  function styleVars(t, ui) {
    var fk = ui.font && ui.font !== 'theme' ? ui.font : t.font;
    var v = { '--p': t.p, '--p2': t.p2 || t.p, '--pt': t.pt, '--hbg': t.hbg, '--ht': t.ht, '--bg': t.bg, '--box': t.box, '--vb': t.vb, '--vt': t.vt, '--ab': t.ab, '--at': t.at, '--aib': t.aib, '--ait': t.ait, '--inp': t.inp, '--bd': t.bd, '--br': t.br + 'px', '--bubr': t.bubr + 'px', '--font': FONTS[fk] || FONTS.system, '--sh': SH[t.shadow] || SH.md, '--blur': (t.blur || 0) + 'px', '--sc': (ui.scale || 100) / 100, '--ox': (ui.ox == null ? 18 : ui.ox) + 'px', '--oy': (ui.oy == null ? 18 : ui.oy) + 'px' };
    var s = ''; for (var k in v) s += k + ':' + v[k] + ';';
    return s + 'color-scheme:' + (t.dark ? 'dark' : 'light') + ';';
  }

  function mount(host, cfg, opts) {
    opts = opts || {};
    var preview = !!opts.preview, view = opts.view || 'chat';
    var ui = cfg.ui, sh = cfg.show, gate = cfg.gate || {}, aiOn = !!(cfg.ai && cfg.ai.on);
    injectCss();
    var t = resolveTheme(ui);
    var lk = { circle: 'lc', rounded: 'lr', pill: 'lp' }[ui.launcher] || 'lc';
    var root = el('div', 'nx nx-' + (ui.pos === 'left' ? 'pl' : 'pr') + ' nx-a' + (ui.anim === 'slide' ? 's' : ui.anim === 'fade' ? 'f' : 'p') + ' nx-' + lk + ' nx-h' + (t.head === 'curve' ? 'c' : t.head === 'glass' ? 'g' : 's') + ' nx-bt-' + (t.bubble || 'round') + ' nx-ly-' + (sh.layout === 'flat' ? 'flat' : 'bubble') + (sh.vis_avatar || sh.layout === 'flat' ? '' : ' nx-nav') + (preview ? ' nx-prev nx-v' + view : ''));
    root.setAttribute('style', styleVars(t, ui));
    var S = { g: function (k) { if (preview) return ''; try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }, s: function (k, v) { if (preview) return; try { localStorage.setItem(k, v); } catch (e) { } } };

    var token = S.g('nc_t');
    if (!/^[a-z0-9]{24,48}$/.test(token)) {
      var a = new Uint8Array(16); (window.crypto || window.msCrypto).getRandomValues(a);
      token = Array.prototype.map.call(a, function (x) { return ('0' + x.toString(36)).slice(-2); }).join('').slice(0, 32);
      if (token.length < 24) token = (token + 'abcdefghijklmnopqrstuvwx').slice(0, 24);
      S.s('nc_t', token);
    }
    var last = Number(S.g('nc_l')) || 0, unread = 0, open = !!opts.open || preview, sending = false, seen = {}, typingOn = false, typingUntil = 0;
    var mode = 'auto', registered = S.g('nc_reg') === '1', regAt = 0, chipSig = '', timer = null, chipsEl = null, capEl = null, tyEl = null, hasVisitor = false, destroyed = false, loaded = false;

    // ---- nút mở, bong bóng gợi ý
    var btn = el('button', 'nx-btn' + (ui.pulse ? ' pulse' : '')); btn.type = 'button'; btn.setAttribute('aria-label', ui.launcher_label || 'Chat');
    btn.innerHTML = svg(ui.launcher_icon || 'chat', Math.round(26 * (ui.scale || 100) / 100));
    var bl = el('span', 'nx-bl', ui.launcher_label || 'Chat'); btn.appendChild(bl);
    var badge = el('span', 'nx-n'); btn.appendChild(badge);
    var tz = el('div', 'nx-tz'); tz.appendChild(el('span', '', ui.teaser || '')); var tzx = el('i', '', '×'); tz.appendChild(tzx);

    // ---- khung chat
    var box = el('div', 'nx-box' + (preview ? '' : '')); box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', cfg.title || 'Chat');
    var hd = el('div', 'nx-h'), hav = el('div', 'nx-av'), hdot = el('span', 'nx-dt'), ht = el('div', 'nx-ht'), htt = el('b', '', cfg.title || 'Hỗ trợ trực tuyến'), hts = el('small', '', ui.sub || '');
    ht.appendChild(htt); ht.appendChild(hts);
    var hx = el('button', 'nx-hb'); hx.type = 'button'; hx.setAttribute('aria-label', 'Đóng'); hx.innerHTML = svg('min', 18);
    hd.appendChild(hav); hd.appendChild(ht); hd.appendChild(hx);
    var list = el('div', 'nx-ls'); list.setAttribute('aria-live', 'polite');
    var g = el('div', 'nx-g');
    var f = el('div', 'nx-f'), hfRow = el('div', 'nx-hf'), hfBtn = el('button', ''); hfBtn.type = 'button'; var hfIc = el('span'); hfIc.innerHTML = svg('uplus', 14); hfBtn.appendChild(hfIc); hfBtn.appendChild(el('span', '', (cfg.handoff && cfg.handoff.label) || 'Gặp nhân viên')); hfRow.appendChild(hfBtn);
    var row = el('div', 'nx-row'), ta = el('textarea', 'nx-in'); ta.rows = 1; ta.maxLength = 1000; ta.placeholder = ui.placeholder || 'Nhập tin nhắn…'; ta.setAttribute('aria-label', 'Nội dung tin nhắn');
    var send = el('button', 'nx-sd'); send.type = 'button'; send.setAttribute('aria-label', 'Gửi'); send.innerHTML = svg('send', 18);
    row.appendChild(ta); row.appendChild(send); f.appendChild(hfRow); f.appendChild(row);
    if (ui.footer) f.appendChild(el('div', 'nx-ft', ui.footer));
    box.appendChild(hd); box.appendChild(list); box.appendChild(g); box.appendChild(f);
    root.appendChild(tz); root.appendChild(box); root.appendChild(btn);

    // ---- avatar
    function avIcon(kind) {
      if (kind === 'v') return svg('user', 16);
      if (kind === 'i') { var im = safeImg(sh.ai_img); return im ? '<img alt="" src="' + im + '">' : svg(sh.ai_icon || 'bot', 17); }
      var im2 = safeImg(sh.agent_img); return im2 ? '<img alt="" src="' + im2 + '">' : svg(sh.agent_icon || 'headset', 17);
    }
    function mkAv(kind) { var a = el('div', 'nx-ma'); a.innerHTML = avIcon(kind); return a; }
    function nameOf(kind, by) { return kind === 'v' ? (sh.vis_label || 'Bạn') : kind === 'i' ? (sh.ai_name || 'Trợ lý AI') : (by || sh.agent_name || 'Nhân viên'); }
    function scroll() { setTimeout(function () { list.scrollTop = list.scrollHeight; }, 20); }

    function clearChips() { if (chipsEl) { chipsEl.remove(); chipsEl = null; } if (capEl) { capEl.remove(); capEl = null; } }
    function showChips(arr, caption) {
      clearChips(); if (!arr || !arr.length || (gate.on && !registered)) return;
      if (caption) { capEl = el('div', 'nx-cap', caption); list.appendChild(capEl); }
      var c = el('div', 'nx-ch');
      arr.slice(0, 5).forEach(function (q) { var b = el('button', '', q); b.type = 'button'; b.addEventListener('click', function () { clearChips(); submit(q); }); c.appendChild(b); });
      list.appendChild(c); chipsEl = c; scroll();
    }
    function setTyping(on, secs) {
      if (on) { typingOn = true; typingUntil = Date.now() + (secs || 45) * 1000; if (tyEl) return; } else typingOn = false;
      if (tyEl) { tyEl.remove(); tyEl = null; }
      if (typingOn && sh.typing !== false) {
        var kind = mode === 'human' ? 'a' : 'i', m = el('div', 'nx-m ' + kind); if (kind !== 'v') m.appendChild(mkAv(kind));
        var tt = el('div', 'nx-ty'); tt.innerHTML = '<i></i><i></i><i></i>'; m.appendChild(tt); list.appendChild(m); tyEl = m; scroll();
      }
    }
    function addMsg(role, body, id, at, by) {
      if (id) { if (seen[id]) return false; seen[id] = 1; }
      clearChips(); if (tyEl) { tyEl.remove(); tyEl = null; }
      if (role === 'sys') { list.appendChild(el('div', 'nx-sy', body)); scroll(); return true; }
      var kind = role === 'visitor' ? 'v' : role === 'ai' ? 'i' : 'a';
      var m = el('div', 'nx-m ' + kind);
      if (kind !== 'v' || sh.vis_avatar || sh.layout === 'flat') m.appendChild(mkAv(kind));
      var mb = el('div', 'nx-mb');
      if (sh.names) {
        var n = el('div', 'nx-nm'); n.appendChild(el('span', '', nameOf(kind, by)));
        var bg = kind === 'i' ? sh.ai_badge : kind === 'a' ? sh.agent_badge : ''; if (bg) n.appendChild(el('span', 'nx-bd', bg));
        mb.appendChild(n);
      }
      mb.appendChild(el('div', 'nx-bb', body));
      if (sh.time) mb.appendChild(el('div', 'nx-tm', fmtTime(at)));
      m.appendChild(mb); list.appendChild(m); scroll();
      if (typingOn) setTyping(true, Math.max(1, (typingUntil - Date.now()) / 1000));
      return true;
    }

    // ---- tiêu đề theo trạng thái
    function updateHead() {
      var kind = mode === 'human' ? 'a' : (aiOn ? 'i' : 'a');
      hav.innerHTML = avIcon(kind); if (sh.status_dot !== false) hav.appendChild(hdot);
      hts.textContent = mode === 'human' ? 'Nhân viên đang hỗ trợ bạn' : (aiOn ? (sh.ai_name || 'Trợ lý AI') + ' đang trực · ' + (ui.sub || '') : (ui.sub || ''));
      hfRow.style.display = (cfg.handoff && cfg.handoff.btn && aiOn && mode !== 'human') ? 'flex' : 'none';
    }

    // ---- form thông tin
    var gName, gPhone, gEmail, gConsent, gErr, gGo;
    function buildGate() {
      g.innerHTML = '';
      g.appendChild(el('h3', '', gate.title || 'Xin chào!')); if (gate.desc) g.appendChild(el('p', '', gate.desc));
      function field(key, label, type, ph, mode_) {
        if (mode_ === 'off') return null;
        var w = el('div'), l = el('label'); l.textContent = label; if (mode_ === 'required' || (gate.either && (key === 'phone' || key === 'email') && gate.phone !== 'off' && gate.email !== 'off')) { }
        if (mode_ === 'required') { var em = el('em', '', ' *'); l.appendChild(em); }
        var i = el('input'); i.type = type; i.placeholder = ph; i.autocomplete = key === 'name' ? 'name' : key === 'phone' ? 'tel' : 'email'; i.maxLength = 120; i.value = S.g('nc_' + key);
        w.appendChild(l); w.appendChild(i); g.appendChild(w); return i;
      }
      gName = field('name', 'Họ và tên', 'text', 'Nguyễn Văn A', gate.name);
      gPhone = field('phone', 'Số điện thoại', 'tel', '0912 345 678', gate.phone);
      gEmail = field('email', 'Email', 'email', 'ban@email.com', gate.email);
      if (gate.either && gate.phone !== 'off' && gate.email !== 'off') g.appendChild(el('div', 'nx-note', 'Chỉ cần điền số điện thoại hoặc email (một trong hai).'));
      gConsent = null;
      if (gate.consent) { var ck = el('label', 'nx-ck'); gConsent = el('input'); gConsent.type = 'checkbox'; ck.appendChild(gConsent); ck.appendChild(el('span', '', gate.consent)); g.appendChild(ck); }
      var hp = el('input'); hp.type = 'text'; hp.tabIndex = -1; hp.name = 'website'; hp.autocomplete = 'off'; hp.setAttribute('aria-hidden', 'true'); hp.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;opacity:0'; g.appendChild(hp); gate._hp = hp;
      gErr = el('div', 'nx-er'); g.appendChild(gErr);
      gGo = el('button', 'nx-go', gate.btn || 'Bắt đầu chat'); gGo.type = 'button'; g.appendChild(gGo);
      gGo.addEventListener('click', startChat);
      g.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') { e.preventDefault(); startChat(); } });
    }
    var ERR = { name: 'Vui lòng nhập họ tên (từ 2 ký tự).', phone: 'Số điện thoại chưa đúng (ví dụ 0912345678).', email: 'Email chưa đúng định dạng.', either: 'Vui lòng điền số điện thoại hoặc email.', consent: 'Vui lòng đồng ý để tiếp tục.', slow: 'Bạn thao tác hơi nhanh, hãy thử lại sau ít phút.', off: 'Chat đang tạm tắt.', db: 'Có lỗi kết nối, vui lòng thử lại.' };
    function validate() {
      var n = gName ? gName.value.trim() : '', p = gPhone ? gPhone.value.replace(/[\s.\-()]/g, '') : '', e = gEmail ? gEmail.value.trim() : '';
      if (gName && (gate.name === 'required' ? n.length < 2 : (n && n.length < 2))) return 'name';
      if (gPhone && p && !/^(\+?84|0)\d{9,10}$/.test(p)) return 'phone';
      if (gEmail && e && !/^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]{2,}$/.test(e)) return 'email';
      if (gate.either && gPhone && gEmail) { if (!p && !e) return 'either'; }
      else { if (gPhone && gate.phone === 'required' && !p) return 'phone'; if (gEmail && gate.email === 'required' && !e) return 'email'; }
      if (gConsent && gate.consent_req && !gConsent.checked) return 'consent';
      return '';
    }
    function startChat() {
      if (preview) return;
      var er = validate(); if (er) { gErr.textContent = ERR[er]; return; }
      gErr.textContent = ''; gGo.disabled = true;
      var d = { act: 'start', token: token, page: location.pathname, name: gName ? gName.value.trim() : '', phone: gPhone ? gPhone.value.trim() : '', email: gEmail ? gEmail.value.trim() : '', consent: gConsent ? gConsent.checked : false, website: gate._hp ? gate._hp.value : '' };
      post(d).then(function (a) {
        if (a[1] && a[1].ok) {
          S.s('nc_reg', '1'); regAt = Date.now(); S.s('nc_name', d.name); S.s('nc_phone', d.phone); S.s('nc_email', d.email); registered = true; applyGate(); pollOnce(); setTimeout(function () { ta.focus(); }, 80);
        } else gErr.textContent = ERR[(a[1] && a[1].error) || 'db'] || ERR.db;
      }).catch(function () { gErr.textContent = ERR.db; }).then(function () { gGo.disabled = false; });
    }
    function applyGate() {
      var need = !!gate.on && !registered && (view !== 'chat' || !preview);
      if (preview) need = view === 'gate';
      box.classList.toggle('nx-gating', need);
      if (need && !g.firstChild) buildGate();
      if (!need) showInitialChips();
    }
    function showInitialChips() { if (!hasVisitor && cfg.chips && cfg.chips.length && loaded) showChips(cfg.chips, ''); }

    // ---- mạng
    function post(d) { return fetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(d) }).then(function (r) { return r.json().then(function (j) { return [r.status, j]; }); }); }
    function beep() {
      if (!ui.sound || preview) return;
      try { var C = window.AudioContext || window.webkitAudioContext; if (!C) return; var ac = beep.a || (beep.a = new C()), o = ac.createOscillator(), gn = ac.createGain(); o.type = 'sine'; o.frequency.value = 880; gn.gain.value = 0.05; o.connect(gn); gn.connect(ac.destination); o.start(); o.stop(ac.currentTime + 0.12); } catch (e) { }
    }
    function setBadge() { badge.textContent = unread > 9 ? '9+' : String(unread); badge.className = 'nx-n' + (unread ? ' on' : ''); }
    function handle(d, first) {
      if (!d || !d.ok) return;
      var wasHuman = mode === 'human'; mode = d.mode || 'auto';
      if (gate.on && d.registered === false && registered && Date.now() - regAt > 6000) { registered = false; S.s('nc_reg', ''); }
      if (d.registered) { registered = true; S.s('nc_reg', '1'); }
      var got = false, fromTeam = false;
      (d.msgs || []).forEach(function (m) {
        if (m.id > last) { last = m.id; S.s('nc_l', String(last)); }
        if (m.role === 'visitor') hasVisitor = true;
        if (addMsg(m.role, m.body, m.id, m.at, m.by)) { got = true; if (m.role === 'admin' || m.role === 'ai') { fromTeam = true; } }
      });
      if (!first && fromTeam) { if (!open) { unread++; setBadge(); } if (!open || document.hidden) beep(); }
      if (d.typing) setTyping(true, 20); else if (typingOn && Date.now() > typingUntil) setTyping(false);
      else if (typingOn && fromTeam) setTyping(false);
      if (!d.suggest || !d.suggest.length) chipSig = '';
      else if (!d.typing && JSON.stringify(d.suggest) !== chipSig) { chipSig = JSON.stringify(d.suggest); showChips(d.suggest, 'Câu hỏi liên quan'); }
      if (mode !== (wasHuman ? 'human' : 'auto') || first) updateHead();
      if (first) { loaded = true; if (!d.msgs || !d.msgs.length) welcome(); applyGate(); if (!hasVisitor && !(d.suggest && d.suggest.length)) showInitialChips(); }
    }
    function pollOnce() {
      if (preview || destroyed) return Promise.resolve();
      return fetch('/api/chat?token=' + token + '&after=' + last, { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (d) { handle(d, false); }).catch(function () { });
    }
    function loop() {
      clearTimeout(timer); if (preview || destroyed) return;
      timer = setTimeout(function () { (document.hidden ? Promise.resolve() : pollOnce()).then(loop); }, open ? (typingOn ? 1600 : 3200) : 25000);
    }
    function welcome() {
      var w = cfg.welcome || ''; if (!w) return;
      if (aiOn) addMsg('ai', w, 0, null); else addMsg('admin', w, 0, null, '');
    }

    // ---- gửi tin
    function autosize() { ta.style.height = '42px'; ta.style.height = Math.min(110, ta.scrollHeight) + 'px'; }
    function submit(txt) {
      var body = (txt != null ? txt : ta.value).trim(); if (!body || sending) return;
      if (preview) return;
      sending = true; send.disabled = true;
      post({ act: 'send', token: token, body: body, page: location.pathname, name: S.g('nc_name'), email: S.g('nc_email') }).then(function (a) {
        var st = a[0], d = a[1];
        if (d && d.ok) { ta.value = ''; autosize(); hasVisitor = true; if (d.id) { seen[d.id] = 1; if (d.id > last) { last = d.id; S.s('nc_l', String(last)); } } addMsg('visitor', body, 0, null); if (d.ai) setTyping(true, 45); setTimeout(pollOnce, 900); }
        else if (d && d.error === 'gate') { registered = false; S.s('nc_reg', ''); applyGate(); }
        else addMsg('sys', st === 429 ? 'Bạn gửi hơi nhanh, vui lòng đợi một chút.' : 'Chưa gửi được tin. Vui lòng thử lại.');
      }).catch(function () { addMsg('sys', 'Mất kết nối. Vui lòng thử lại.'); }).then(function () { sending = false; send.disabled = false; });
    }
    function handoff() {
      if (preview) return; hfBtn.disabled = true;
      post({ act: 'handoff', token: token }).then(function (a) { if (a[1] && a[1].ok) { mode = 'human'; updateHead(); pollOnce(); } else if (a[1] && a[1].error === 'gate') { registered = false; applyGate(); } }).catch(function () { }).then(function () { hfBtn.disabled = false; });
    }

    // ---- mở/đóng
    function toggle(on) {
      open = on; box.classList.toggle('on', on); tz.classList.remove('on');
      if (on) { unread = 0; setBadge(); if (!preview) { pollOnce(); setTimeout(function () { if (!box.classList.contains('nx-gating')) ta.focus(); }, 60); } if (window.innerWidth <= 560 && !preview) document.body.style.overflow = 'hidden'; }
      else if (!preview) document.body.style.overflow = '';
      loop();
    }
    btn.addEventListener('click', function () { toggle(!open); try { sessionStorage.setItem('nx_tz', '1'); } catch (e) { } });
    hx.addEventListener('click', function () { toggle(false); });
    tz.addEventListener('click', function (e) { if (e.target === tzx) { tz.classList.remove('on'); try { sessionStorage.setItem('nx_tz', '1'); } catch (x) { } } else toggle(true); });
    send.addEventListener('click', function () { submit(); });
    hfBtn.addEventListener('click', handoff);
    ta.addEventListener('input', autosize);
    ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } });
    function onClick(e) { var x = e.target; while (x && x !== document) { if (x.hasAttribute && x.hasAttribute('data-open-chat')) { e.preventDefault(); toggle(true); return; } x = x.parentNode; } }
    function onKey(e) { if (e.key === 'Escape' && open && !preview) toggle(false); }
    function onVis() { if (!document.hidden) pollOnce(); }
    if (!preview) { document.addEventListener('click', onClick); document.addEventListener('keydown', onKey); document.addEventListener('visibilitychange', onVis); }

    host.appendChild(root);
    box.classList.toggle('on', open);
    updateHead(); setBadge();

    // ---- xem trước: dữ liệu mẫu
    if (preview) {
      loaded = true;
      var demo = [
        ['ai', cfg.welcome || 'Xin chào! Mình có thể giúp gì cho bạn?', ''],
        ['visitor', 'Cho mình hỏi VN-Index hôm nay thế nào?', ''],
        ['ai', 'VN-Index đang ở khoảng 1.265 điểm, tăng nhẹ so với phiên trước. Thanh khoản cải thiện, dòng tiền tập trung nhóm vốn hóa lớn.', ''],
        ['visitor', 'Mình muốn gặp nhân viên tư vấn', ''],
        ['sys', cfg.ai && cfg.ai.on ? 'Mình đã chuyển cuộc trò chuyện cho nhân viên. Bạn vui lòng chờ trong giây lát nhé.' : 'Cảm ơn bạn! Chúng tôi đã nhận được thông tin.', ''],
        ['admin', 'Chào bạn, mình là nhân viên tư vấn. Mình hỗ trợ bạn ngay nhé!', sh.agent_name]
      ];
      if (!aiOn) demo.splice(0, 1, ['admin', cfg.welcome || 'Xin chào! Bạn cần hỗ trợ gì?', sh.agent_name]);
      demo.forEach(function (m, i) { addMsg(m[0], m[1], 0, new Date(Date.now() - (6 - i) * 60000).toISOString(), m[2]); });
      if (view === 'chat' && cfg.chips && cfg.chips.length) showChips(cfg.chips.slice(0, 3), 'Câu hỏi liên quan');
      applyGate();
      if (view === 'closed') { root.classList.add('nx-vclosed'); }
      return { el: root, destroy: function () { root.remove(); } };
    }

    // ---- khởi động thật
    if (gate.on && !registered) { box.classList.add('nx-gating'); buildGate(); }
    fetch('/api/chat?token=' + token + '&after=0', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (d) { handle(d, true); }).catch(function () { loaded = true; welcome(); applyGate(); });
    loop();
    var seenTz = ''; try { seenTz = sessionStorage.getItem('nx_tz') || ''; } catch (e) { }
    if (ui.teaser && !seenTz) setTimeout(function () { if (!open && !destroyed) tz.classList.add('on'); }, Math.max(1, ui.teaser_delay || 6) * 1000);
    if (ui.auto_open > 0 && !seenTz && window.innerWidth > 860) setTimeout(function () { if (!open && !destroyed) toggle(true); }, ui.auto_open * 1000);
    return {
      el: root, open: toggle,
      destroy: function () { destroyed = true; clearTimeout(timer); document.removeEventListener('click', onClick); document.removeEventListener('keydown', onKey); document.removeEventListener('visibilitychange', onVis); root.remove(); }
    };
  }

  window.NhipChat = { THEMES: THEMES, FONTS: FONTS, ICONS: IC, svg: svg, mount: mount, resolveTheme: resolveTheme };

  var me = document.currentScript;
  if (me && !me.getAttribute('data-lib')) {
    var cfg = null; try { cfg = JSON.parse(me.getAttribute('data-cfg') || 'null'); } catch (e) { }
    if (cfg && cfg.ui) {
      var path = location.pathname, hidden = String(cfg.ui.hide_paths || '').split(',').some(function (p) { p = p.trim(); return p && path.indexOf(p) === 0; });
      if (!hidden && !(cfg.ui.hide_mobile && window.innerWidth <= 860)) {
        var run = function () { if (window.__nc) return; window.__nc = mount(document.body, cfg, {}); };
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
      }
    }
  }
})();
