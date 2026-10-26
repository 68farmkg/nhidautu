// Cấu hình + trạng thái bật/tắt của plugin Page Builder Pro (đọc từ hệ plugin, có đệm 10 giây trong registry).
import { getEntry, getSettings } from '../px/registry';
export type PbCfg = { on: boolean; autosave: number; cache: number };
export async function pbCfg(db: any): Promise<PbCfg> {
  try {
    const e = await getEntry(db, 'page-builder'); if (!e || !e.active) return { on: false, autosave: 30, cache: 0 };
    const s = await getSettings(db, e), n = (v: any, d: number, a: number, b: number) => { const x = Number(v); return Number.isFinite(x) && String(v ?? '') !== '' ? Math.min(b, Math.max(a, x)) : d; };
    return { on: true, autosave: n(s.autosave, 30, 0, 600), cache: n(s.cache, 30, 0, 600) };
  } catch { return { on: false, autosave: 30, cache: 0 }; }
}
