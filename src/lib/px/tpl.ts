// Template an toàn cho plugin dạng gói: chỉ có {{ten}} (luôn được thoát HTML). Không có logic, không có mã thô.
import { esc } from '../esc';
export function tpl(src: string, vars: Record<string, any>): string {
  return String(src || '').replace(/\{\{\s*([\w.-]{1,60})\s*\}\}/g, (_, k: string) => {
    const v = vars[k];
    return v === undefined || v === null ? '' : esc(String(v));
  });
}
// CSS của plugin được đóng phạm vi: mọi selector bị gắn tiền tố .px-<id>; chặn @import, url(), expression, behavior.
export function scopeCss(css: string, scope: string): string {
  const c = String(css || '').slice(0, 20000);
  if (/@import|expression\s*\(|behavior\s*:|-moz-binding|javascript:|url\s*\(/i.test(c)) return '';
  if (/[<>]/.test(c)) return '';
  return c.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\})\s*([^{}@][^{}]*)\{/g, (_m, pre: string, sel: string) =>
    `${pre}${sel.split(',').map((s) => `${scope} ${s.trim().replace(/^(html|body|:root)\s*/i, '')}`.trim()).join(',')}{`);
}
