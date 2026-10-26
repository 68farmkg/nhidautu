// Đường xu hướng nhỏ (sparkline) minh họa hướng tăng/giảm theo % thay đổi trong ngày.
// Lưu ý: bảng quotes chỉ có giá mới nhất, nên hình dạng đường là MINH HỌA (sinh cố định theo mã), không phải dữ liệu trong phiên.
const hash = (s: string) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

export function sparkPath(seed: string, pct: number, w = 110, h = 34, n = 22) {
  let x = hash(seed) || 1;
  const rnd = () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
  const drift = Math.max(-1, Math.min(1, pct / 3));
  let v = 0;
  const ys: number[] = [];
  for (let i = 0; i < n; i++) { v += drift * 0.12 + (rnd() - 0.5) * 0.5; ys.push(v); }
  if ((pct >= 0) !== (ys[n - 1] >= ys[0])) ys.reverse();
  const min = Math.min(...ys), max = Math.max(...ys), r = max - min || 1;
  const pts = ys.map((y, i) => [(i / (n - 1)) * w, h - 2 - ((y - min) / r) * (h - 4)]);
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('');
  return { line, area: `${line}L${w} ${h}L0 ${h}Z` };
}
