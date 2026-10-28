/* NHIP · Thư viện chỉ báo kỹ thuật mở rộng (v1.7)
   Bổ sung cho KLineChart ~30 chỉ báo phổ biến trên TradingView / Investing / AmiBroker / Stockbiz…:
   - Tự cài đặt (công thức chuẩn, tính từ nến thật, không dữ liệu giả): Ichimoku, Supertrend, Keltner, Donchian, WMA, HMA, VWAP cuộn,
     Kênh hồi quy, ATR, ADX (+DI/−DI), Stochastic, Stoch RSI, MFI, CMF, A/D, Aroon, Ultimate Osc., TSI, Force Index, HV, PPO, Choppiness.
   - Có sẵn trong KLineChart (chỉ bổ sung vào menu): BBI, BIAS, DMI, PSY, TRIX, MTM, ROC, AO, EMV, DMA, VR, BRAR, CR, PVT.
   Các hàm tính toán là hàm thuần (không đụng DOM) nên kiểm thử được trong Node: module.exports.calc. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.NHIPIndicators = api; try { api.install(root.klinecharts, root.NHIPChartsCore); } catch (e) { console.warn("indicators", e); } }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var isNum = function (v) { return typeof v === "number" && isFinite(v); };
  var nulls = function (n) { var a = new Array(n); for (var i = 0; i < n; i++) a[i] = null; return a; };
  var col = function (d, k) { return d.map(function (x) { return x[k]; }); };

  /* ---------- Các khối tính toán cơ bản (null = chưa đủ dữ liệu) ---------- */
  function firstValid(a) { for (var i = 0; i < a.length; i++) if (isNum(a[i])) return i; return -1; }
  function sma(a, n) {
    var out = nulls(a.length), s = 0, c = 0;
    for (var i = 0; i < a.length; i++) {
      if (isNum(a[i])) { s += a[i]; c++; } else { s = 0; c = 0; continue; }
      if (c > n) { s -= a[i - n]; c = n; }
      if (c === n) out[i] = s / n;
    }
    return out;
  }
  function ema(a, n) {
    var out = nulls(a.length), st = firstValid(a); if (st < 0 || a.length - st < n) return out;
    var k = 2 / (n + 1), s = 0, i;
    for (i = st; i < st + n; i++) s += a[i];
    var prev = s / n; out[st + n - 1] = prev;
    for (i = st + n; i < a.length; i++) { if (!isNum(a[i])) continue; prev = a[i] * k + prev * (1 - k); out[i] = prev; }
    return out;
  }
  function rma(a, n) { /* trung bình Wilder */
    var out = nulls(a.length), st = firstValid(a); if (st < 0 || a.length - st < n) return out;
    var s = 0, i;
    for (i = st; i < st + n; i++) s += a[i];
    var prev = s / n; out[st + n - 1] = prev;
    for (i = st + n; i < a.length; i++) { if (!isNum(a[i])) continue; prev = (prev * (n - 1) + a[i]) / n; out[i] = prev; }
    return out;
  }
  function wma(a, n) {
    var out = nulls(a.length), den = n * (n + 1) / 2;
    for (var i = n - 1; i < a.length; i++) {
      var s = 0, ok = true;
      for (var j = 0; j < n; j++) { var v = a[i - n + 1 + j]; if (!isNum(v)) { ok = false; break; } s += v * (j + 1); }
      if (ok) out[i] = s / den;
    }
    return out;
  }
  function stdev(a, n) {
    var out = nulls(a.length);
    for (var i = n - 1; i < a.length; i++) {
      var s = 0, ok = true, j;
      for (j = 0; j < n; j++) { if (!isNum(a[i - j])) { ok = false; break; } s += a[i - j]; }
      if (!ok) continue;
      var m = s / n, q = 0;
      for (j = 0; j < n; j++) q += Math.pow(a[i - j] - m, 2);
      out[i] = Math.sqrt(q / n);
    }
    return out;
  }
  function highest(a, n) {
    var out = nulls(a.length);
    for (var i = n - 1; i < a.length; i++) { var m = -Infinity, ok = true; for (var j = 0; j < n; j++) { var v = a[i - j]; if (!isNum(v)) { ok = false; break; } if (v > m) m = v; } if (ok) out[i] = m; }
    return out;
  }
  function lowest(a, n) {
    var out = nulls(a.length);
    for (var i = n - 1; i < a.length; i++) { var m = Infinity, ok = true; for (var j = 0; j < n; j++) { var v = a[i - j]; if (!isNum(v)) { ok = false; break; } if (v < m) m = v; } if (ok) out[i] = m; }
    return out;
  }
  function sumN(a, n) {
    var out = nulls(a.length), s = 0, c = 0;
    for (var i = 0; i < a.length; i++) {
      if (isNum(a[i])) { s += a[i]; c++; } else { s = 0; c = 0; continue; }
      if (c > n) { s -= a[i - n]; c = n; }
      if (c === n) out[i] = s;
    }
    return out;
  }
  function trueRange(d) {
    return d.map(function (x, i) { return i === 0 ? x.high - x.low : Math.max(x.high - x.low, Math.abs(x.high - d[i - 1].close), Math.abs(x.low - d[i - 1].close)); });
  }
  function rsiArr(close, n) {
    var up = nulls(close.length), dn = nulls(close.length);
    for (var i = 1; i < close.length; i++) { var ch = close[i] - close[i - 1]; up[i] = ch > 0 ? ch : 0; dn[i] = ch < 0 ? -ch : 0; }
    var au = rma(up, n), ad = rma(dn, n);
    return au.map(function (u, i) { return u == null || ad[i] == null ? null : (ad[i] === 0 ? 100 : 100 - 100 / (1 + u / ad[i])); });
  }
  var mapN = function (n, f) { var o = nulls(n); for (var i = 0; i < n; i++) o[i] = f(i); return o; };
  var rowsOf = function (n, keys, arrs) { var out = new Array(n); for (var i = 0; i < n; i++) { var o = {}; for (var k = 0; k < keys.length; k++) if (isNum(arrs[k][i])) o[keys[k]] = arrs[k][i]; out[i] = o; } return out; };

  /* ---------- Công thức từng chỉ báo: calc(dữ liệu nến, tham số) → mảng đối tượng {khóa: giá trị} ---------- */
  var calc = {};

  calc.WMA = function (d, p) {
    var c = col(d, "close"); return rowsOf(d.length, p.map(function (_, i) { return "w" + (i + 1); }), p.map(function (n) { return wma(c, n); }));
  };
  calc.HMA = function (d, p) {
    var n = p[0], c = col(d, "close"), h = Math.max(1, Math.floor(n / 2)), s = Math.max(1, Math.round(Math.sqrt(n)));
    var a = wma(c, h), b = wma(c, n), diff = a.map(function (v, i) { return v == null || b[i] == null ? null : 2 * v - b[i]; });
    return rowsOf(d.length, ["hma"], [wma(diff, s)]);
  };
  calc.VWAPN = function (d, p) {
    var n = p[0], pv = d.map(function (x) { return isNum(x.volume) ? (x.high + x.low + x.close) / 3 * x.volume : null; }), v = d.map(function (x) { return isNum(x.volume) ? x.volume : null; });
    var a = sumN(pv, n), b = sumN(v, n);
    return rowsOf(d.length, ["vwap"], [a.map(function (x, i) { return x == null || !b[i] ? null : x / b[i]; })]);
  };
  calc.ICHIMOKU = function (d, p) {
    var t = p[0], k = p[1], s = p[2], disp = k, n = d.length, hi = col(d, "high"), lo = col(d, "low");
    var mid = function (len) { var h = highest(hi, len), l = lowest(lo, len); return h.map(function (v, i) { return v == null || l[i] == null ? null : (v + l[i]) / 2; }); };
    var ten = mid(t), kij = mid(k), sb = mid(s);
    var spanA = mapN(n, function (i) { var j = i - disp; return j >= 0 && ten[j] != null && kij[j] != null ? (ten[j] + kij[j]) / 2 : null; });
    var spanB = mapN(n, function (i) { var j = i - disp; return j >= 0 ? sb[j] : null; });
    var chik = mapN(n, function (i) { var j = i + disp; return j < n ? d[j].close : null; });
    return rowsOf(n, ["tenkan", "kijun", "spanA", "spanB", "chikou"], [ten, kij, spanA, spanB, chik]);
  };
  calc.SUPERTREND = function (d, p) {
    var n = d.length, per = p[0], mult = p[1], atr = rma(trueRange(d), per), up = nulls(n), dn = nulls(n);
    var fu = nulls(n), fl = nulls(n), trend = 1;
    for (var i = 0; i < n; i++) {
      if (atr[i] == null) continue;
      var hl2 = (d[i].high + d[i].low) / 2, bu = hl2 + mult * atr[i], bl = hl2 - mult * atr[i];
      if (fu[i - 1] == null) { fu[i] = bu; fl[i] = bl; }
      else {
        fu[i] = bu < fu[i - 1] || d[i - 1].close > fu[i - 1] ? bu : fu[i - 1];
        fl[i] = bl > fl[i - 1] || d[i - 1].close < fl[i - 1] ? bl : fl[i - 1];
        if (d[i].close > fu[i - 1]) trend = 1; else if (d[i].close < fl[i - 1]) trend = -1;
      }
      if (trend === 1) up[i] = fl[i]; else dn[i] = fu[i];
    }
    return rowsOf(n, ["up", "down"], [up, dn]);
  };
  calc.KELTNER = function (d, p) {
    var n = p[0], an = p[1], m = p[2], mid = ema(col(d, "close"), n), atr = rma(trueRange(d), an);
    var u = mid.map(function (v, i) { return v == null || atr[i] == null ? null : v + m * atr[i]; });
    var l = mid.map(function (v, i) { return v == null || atr[i] == null ? null : v - m * atr[i]; });
    return rowsOf(d.length, ["up", "mid", "low"], [u, mid, l]);
  };
  calc.DONCHIAN = function (d, p) {
    var h = highest(col(d, "high"), p[0]), l = lowest(col(d, "low"), p[0]);
    return rowsOf(d.length, ["up", "mid", "low"], [h, h.map(function (v, i) { return v == null || l[i] == null ? null : (v + l[i]) / 2; }), l]);
  };
  calc.LRC = function (d, p) { /* kênh hồi quy tuyến tính: đường hồi quy ± k·độ lệch chuẩn phần dư */
    var n = p[0], k = p[1], len = d.length, mid = nulls(len), up = nulls(len), lo = nulls(len);
    for (var i = n - 1; i < len; i++) {
      var sx = 0, sy = 0, sxy = 0, sxx = 0, j;
      for (j = 0; j < n; j++) { var y = d[i - n + 1 + j].close; sx += j; sy += y; sxy += j * y; sxx += j * j; }
      var den = n * sxx - sx * sx, slope = den ? (n * sxy - sx * sy) / den : 0, ic = (sy - slope * sx) / n, rs = 0;
      for (j = 0; j < n; j++) rs += Math.pow(d[i - n + 1 + j].close - (ic + slope * j), 2);
      var sd = Math.sqrt(rs / n), end = ic + slope * (n - 1);
      mid[i] = end; up[i] = end + k * sd; lo[i] = end - k * sd;
    }
    return rowsOf(len, ["up", "mid", "low"], [up, mid, lo]);
  };
  calc.ATR = function (d, p) { return rowsOf(d.length, ["atr"], [rma(trueRange(d), p[0])]); };
  calc.ADX = function (d, p) {
    var n = p[0], len = d.length, tr = trueRange(d), pdm = nulls(len), mdm = nulls(len);
    for (var i = 1; i < len; i++) {
      var up = d[i].high - d[i - 1].high, dn = d[i - 1].low - d[i].low;
      pdm[i] = up > dn && up > 0 ? up : 0; mdm[i] = dn > up && dn > 0 ? dn : 0;
    }
    tr[0] = null;
    var atr = rma(tr, n), ps = rma(pdm, n), ms = rma(mdm, n);
    var pdi = ps.map(function (v, i) { return v == null || !atr[i] ? null : 100 * v / atr[i]; });
    var mdi = ms.map(function (v, i) { return v == null || !atr[i] ? null : 100 * v / atr[i]; });
    var dx = pdi.map(function (v, i) { return v == null || mdi[i] == null ? null : (v + mdi[i] === 0 ? 0 : 100 * Math.abs(v - mdi[i]) / (v + mdi[i])); });
    return rowsOf(len, ["adx", "pdi", "mdi"], [rma(dx, n), pdi, mdi]);
  };
  calc.STOCH = function (d, p) {
    var n = p[0], hh = highest(col(d, "high"), n), ll = lowest(col(d, "low"), n);
    var raw = d.map(function (x, i) { return hh[i] == null ? null : (hh[i] === ll[i] ? 50 : (x.close - ll[i]) / (hh[i] - ll[i]) * 100); });
    var k = sma(raw, p[1]); return rowsOf(d.length, ["k", "d"], [k, sma(k, p[2])]);
  };
  calc.STOCHRSI = function (d, p) {
    var r = rsiArr(col(d, "close"), p[0]), hh = highest(r, p[1]), ll = lowest(r, p[1]);
    var raw = r.map(function (v, i) { return hh[i] == null || v == null ? null : (hh[i] === ll[i] ? 50 : (v - ll[i]) / (hh[i] - ll[i]) * 100); });
    var k = sma(raw, p[2]); return rowsOf(d.length, ["k", "d"], [k, sma(k, p[3])]);
  };
  calc.MFI = function (d, p) {
    var n = p[0], len = d.length, tp = d.map(function (x) { return (x.high + x.low + x.close) / 3; });
    var pos = nulls(len), neg = nulls(len);
    for (var i = 1; i < len; i++) { var f = tp[i] * (d[i].volume || 0); pos[i] = tp[i] > tp[i - 1] ? f : 0; neg[i] = tp[i] < tp[i - 1] ? f : 0; }
    var sp = sumN(pos, n), sn = sumN(neg, n);
    return rowsOf(len, ["mfi"], [sp.map(function (v, i) { return v == null ? null : (sn[i] === 0 ? 100 : 100 - 100 / (1 + v / sn[i])); })]);
  };
  var mfv = function (d) { return d.map(function (x) { var r = x.high - x.low; return r === 0 ? 0 : ((x.close - x.low) - (x.high - x.close)) / r * (x.volume || 0); }); };
  calc.CMF = function (d, p) {
    var a = sumN(mfv(d), p[0]), b = sumN(d.map(function (x) { return x.volume || 0; }), p[0]);
    return rowsOf(d.length, ["cmf"], [a.map(function (v, i) { return v == null || !b[i] ? null : v / b[i]; })]);
  };
  calc.AD = function (d) { var s = 0; return rowsOf(d.length, ["ad"], [mfv(d).map(function (v) { s += v; return s; })]); };
  calc.AROON = function (d, p) {
    var n = p[0], len = d.length, up = nulls(len), dn = nulls(len);
    for (var i = n; i < len; i++) {
      var hi = -Infinity, lo = Infinity, hi_i = i, lo_i = i;
      for (var j = i - n; j <= i; j++) { if (d[j].high >= hi) { hi = d[j].high; hi_i = j; } if (d[j].low <= lo) { lo = d[j].low; lo_i = j; } }
      up[i] = 100 * (n - (i - hi_i)) / n; dn[i] = 100 * (n - (i - lo_i)) / n;
    }
    return rowsOf(len, ["up", "down"], [up, dn]);
  };
  calc.UO = function (d, p) {
    var len = d.length, bp = nulls(len), tr = nulls(len);
    for (var i = 1; i < len; i++) { var pc = d[i - 1].close, lo = Math.min(d[i].low, pc), hi = Math.max(d[i].high, pc); bp[i] = d[i].close - lo; tr[i] = hi - lo; }
    var avg = function (n) { var a = sumN(bp, n), b = sumN(tr, n); return a.map(function (v, i) { return v == null || !b[i] ? null : v / b[i]; }); };
    var a1 = avg(p[0]), a2 = avg(p[1]), a3 = avg(p[2]);
    return rowsOf(len, ["uo"], [a1.map(function (v, i) { return v == null || a2[i] == null || a3[i] == null ? null : 100 * (4 * v + 2 * a2[i] + a3[i]) / 7; })]);
  };
  calc.TSI = function (d, p) {
    var c = col(d, "close"), pc = c.map(function (v, i) { return i ? v - c[i - 1] : null; }), ap = pc.map(function (v) { return v == null ? null : Math.abs(v); });
    var num = ema(ema(pc, p[0]), p[1]), den = ema(ema(ap, p[0]), p[1]);
    var t = num.map(function (v, i) { return v == null || !den[i] ? null : 100 * v / den[i]; });
    return rowsOf(d.length, ["tsi", "sig"], [t, ema(t, p[2])]);
  };
  calc.FORCE = function (d, p) {
    return rowsOf(d.length, ["fi"], [ema(d.map(function (x, i) { return i ? (x.close - d[i - 1].close) * (x.volume || 0) : null; }), p[0])]);
  };
  calc.HV = function (d, p) {
    var r = d.map(function (x, i) { return i && d[i - 1].close > 0 && x.close > 0 ? Math.log(x.close / d[i - 1].close) : null; });
    return rowsOf(d.length, ["hv"], [stdev(r, p[0]).map(function (v) { return v == null ? null : v * Math.sqrt(252) * 100; })]);
  };
  calc.PPO = function (d, p) {
    var c = col(d, "close"), f = ema(c, p[0]), s = ema(c, p[1]);
    var ppo = f.map(function (v, i) { return v == null || !s[i] ? null : (v - s[i]) / s[i] * 100; }), sig = ema(ppo, p[2]);
    return rowsOf(d.length, ["ppo", "sig", "hist"], [ppo, sig, ppo.map(function (v, i) { return v == null || sig[i] == null ? null : v - sig[i]; })]);
  };
  calc.CHOP = function (d, p) {
    var n = p[0], s = sumN(trueRange(d), n), hh = highest(col(d, "high"), n), ll = lowest(col(d, "low"), n);
    return rowsOf(d.length, ["chop"], [s.map(function (v, i) { return v == null || hh[i] === ll[i] ? null : 100 * Math.log10(v / (hh[i] - ll[i])) / Math.log10(n); })]);
  };

  /* ---------- Khai báo: figures + metadata cho KLineChart & menu ---------- */
  var L = function (key, title) { return { key: key, title: title, type: "line" }; };
  var fig = {
    WMA: function (p) { return p.map(function (n, i) { return L("w" + (i + 1), "WMA" + n + ": "); }); },
    HMA: function () { return [L("hma", "HMA: ")]; },
    VWAPN: function () { return [L("vwap", "VWAP: ")]; },
    ICHIMOKU: function () { return [L("tenkan", "Tenkan: "), L("kijun", "Kijun: "), L("spanA", "Senkou A: "), L("spanB", "Senkou B: "), L("chikou", "Chikou: ")]; },
    SUPERTREND: function () { return [L("up", "Tăng: "), L("down", "Giảm: ")]; },
    KELTNER: function () { return [L("up", "Trên: "), L("mid", "Giữa: "), L("low", "Dưới: ")]; },
    DONCHIAN: function () { return [L("up", "Cao nhất: "), L("mid", "Giữa: "), L("low", "Thấp nhất: ")]; },
    LRC: function () { return [L("up", "Trên: "), L("mid", "HQ: "), L("low", "Dưới: ")]; },
    ATR: function () { return [L("atr", "ATR: ")]; },
    ADX: function () { return [L("adx", "ADX: "), L("pdi", "+DI: "), L("mdi", "-DI: ")]; },
    STOCH: function () { return [L("k", "%K: "), L("d", "%D: ")]; },
    STOCHRSI: function () { return [L("k", "%K: "), L("d", "%D: ")]; },
    MFI: function () { return [L("mfi", "MFI: ")]; },
    CMF: function () { return [L("cmf", "CMF: ")]; },
    AD: function () { return [L("ad", "A/D: ")]; },
    AROON: function () { return [L("up", "Aroon Up: "), L("down", "Aroon Down: ")]; },
    UO: function () { return [L("uo", "UO: ")]; },
    TSI: function () { return [L("tsi", "TSI: "), L("sig", "Tín hiệu: ")]; },
    FORCE: function () { return [L("fi", "Force: ")]; },
    HV: function () { return [L("hv", "HV%: ")]; },
    PPO: function () { return [L("ppo", "PPO: "), L("sig", "Tín hiệu: "), { key: "hist", title: "Hist: ", type: "bar", baseValue: 0 }]; },
    CHOP: function () { return [L("chop", "CHOP: ")]; }
  };

  /* [mã, nhãn, mô tả, nhóm vẽ, nhóm chức năng, tham số mặc định, số tham số tối đa, tối thiểu, giới hạn trên, cố định số lượng?, precision] */
  var CUSTOM = [
    ["ICHIMOKU", "Ichimoku", "Ichimoku Kinko Hyo (chuyển đổi, cơ sở, Senkou B)", "price", "Xu hướng", [9, 26, 52], 3, 3, 200, true, 2],
    ["SUPERTREND", "Supertrend", "Supertrend (chu kỳ ATR, hệ số)", "price", "Xu hướng", [10, 3], 2, 2, 100, true, 2],
    ["WMA", "WMA", "Trung bình động có trọng số", "price", "Xu hướng", [10, 20], 4, 1, 500, false, 2],
    ["HMA", "HMA", "Hull Moving Average", "price", "Xu hướng", [21], 1, 1, 300, true, 2],
    ["VWAPN", "VWAP cuộn", "VWAP theo N nến gần nhất", "price", "Khối lượng", [20], 1, 1, 300, true, 2],
    ["KELTNER", "Keltner", "Kênh Keltner (EMA, ATR, hệ số)", "price", "Biến động", [20, 10, 2], 3, 3, 100, true, 2],
    ["DONCHIAN", "Donchian", "Kênh Donchian (cao/thấp N nến)", "price", "Biến động", [20], 1, 1, 300, true, 2],
    ["LRC", "Kênh hồi quy", "Kênh hồi quy tuyến tính (N nến, k·σ)", "price", "Xu hướng", [50, 2], 2, 2, 500, true, 2],
    ["ATR", "ATR", "Biên độ thực trung bình (Wilder)", "pane", "Biến động", [14], 1, 1, 200, true, 2],
    ["ADX", "ADX", "ADX + DI+ / DI− (độ mạnh xu hướng)", "pane", "Xu hướng", [14], 1, 1, 100, true, 2],
    ["STOCH", "Stochastic", "Stochastic %K/%D (chu kỳ, làm mượt K, D)", "pane", "Động lượng", [14, 3, 3], 3, 3, 100, true, 2],
    ["STOCHRSI", "Stoch RSI", "Stochastic của RSI (RSI, Stoch, K, D)", "pane", "Động lượng", [14, 14, 3, 3], 4, 4, 100, true, 2],
    ["MFI", "MFI", "Money Flow Index (RSI có khối lượng)", "pane", "Khối lượng", [14], 1, 1, 100, true, 2],
    ["CMF", "CMF", "Chaikin Money Flow", "pane", "Khối lượng", [20], 1, 1, 100, true, 3],
    ["AD", "A/D", "Đường tích lũy/phân phối", "pane", "Khối lượng", [], 0, 0, 0, true, 0],
    ["FORCE", "Force Index", "Elder Force Index (EMA)", "pane", "Khối lượng", [13], 1, 1, 100, true, 0],
    ["AROON", "Aroon", "Aroon Up/Down", "pane", "Xu hướng", [25], 1, 1, 200, true, 2],
    ["UO", "Ultimate Osc.", "Ultimate Oscillator (7, 14, 28)", "pane", "Động lượng", [7, 14, 28], 3, 3, 100, true, 2],
    ["TSI", "TSI", "True Strength Index (dài, ngắn, tín hiệu)", "pane", "Động lượng", [25, 13, 7], 3, 3, 100, true, 2],
    ["PPO", "PPO", "Percentage Price Oscillator", "pane", "Động lượng", [12, 26, 9], 3, 3, 100, true, 2],
    ["HV", "HV", "Biến động lịch sử (năm hóa %)", "pane", "Biến động", [20], 1, 1, 250, true, 2],
    ["CHOP", "Choppiness", "Choppiness Index (xu hướng hay đi ngang)", "pane", "Biến động", [14], 1, 1, 100, true, 2]
  ];
  /* Có sẵn trong KLineChart 9.x — chỉ thêm vào menu. */
  var BUILTIN = [
    ["BBI", "BBI", "Bull and Bear Index (4 đường MA)", "price", "Xu hướng", [3, 6, 12, 24], 4, 4, 100, true],
    ["BIAS", "BIAS", "Độ lệch so với MA (%)", "pane", "Động lượng", [6, 12, 24], 3, 3, 100, true],
    ["DMI", "DMI", "Directional Movement Index (cũ)", "pane", "Xu hướng", [14, 6], 2, 2, 100, true],
    ["PSY", "PSY", "Chỉ số tâm lý", "pane", "Động lượng", [12, 6], 2, 2, 100, true],
    ["TRIX", "TRIX", "Triple EMA Oscillator", "pane", "Động lượng", [12, 20], 2, 2, 100, true],
    ["MTM", "Momentum", "Động lượng (MTM)", "pane", "Động lượng", [6, 10], 2, 2, 100, true],
    ["ROC", "ROC", "Tốc độ thay đổi giá", "pane", "Động lượng", [12, 6], 2, 2, 100, true],
    ["AO", "Awesome Osc.", "Awesome Oscillator (Bill Williams)", "pane", "Động lượng", [5, 34], 2, 2, 100, true],
    ["EMV", "EMV", "Ease of Movement", "pane", "Khối lượng", [14, 9], 2, 2, 100, true],
    ["DMA", "DMA", "Different of Moving Average", "pane", "Xu hướng", [10, 50, 10], 3, 3, 200, true],
    ["VR", "VR", "Volume Ratio", "pane", "Khối lượng", [26, 6], 2, 2, 100, true],
    ["BRAR", "BRAR", "BR / AR (ý chí mua – lực mua)", "pane", "Động lượng", [26], 1, 1, 100, true],
    ["CR", "CR", "CR (năng lượng trung gian)", "pane", "Động lượng", [26, 10, 20, 40, 60], 5, 5, 100, true],
    ["PVT", "PVT", "Price Volume Trend", "pane", "Khối lượng", [], 0, 0, 0, true]
  ];

  function install(K, C) {
    if (!K || !C || !K.registerIndicator || C.__nhipExtraInd) return false;
    C.__nhipExtraInd = true;
    var supported = null;
    try { supported = K.getSupportedIndicators ? K.getSupportedIndicators() : null; } catch (e) { }
    CUSTOM.forEach(function (c) {
      var name = c[0], f = fig[name];
      try {
        K.registerIndicator({
          name: name, shortName: c[1], calcParams: c[5].slice(), precision: c[10],
          figures: f(c[5]),
          regenerateFigures: name === "WMA" ? function (p) { return f(p); } : undefined,
          calc: function (dataList, ind) {
            var p = (ind && ind.calcParams && ind.calcParams.length ? ind.calcParams : c[5]).map(Number);
            try { return calc[name](dataList, p); } catch (e) { console.warn("indicator", name, e); return dataList.map(function () { return {}; }); }
          }
        });
      } catch (e) { console.warn("Không đăng ký được chỉ báo", name, e); return; }
      add(c);
    });
    BUILTIN.forEach(function (b) { if (!supported || supported.indexOf(b[0]) >= 0) add(b); });
    return true;

    function add(c) {
      if (C.IND[c[0]]) return;
      var g = { n: c[0], label: c[1], full: c[2], group: c[3], cat: c[4], def: c[5].slice(), max: c[6], min: c[7], hi: c[8], exact: c[9] };
      C.INDICATORS.push(g); C.IND[g.n] = g;
    }
  }

  return { install: install, calc: calc, CUSTOM: CUSTOM, BUILTIN: BUILTIN, _h: { sma: sma, ema: ema, rma: rma, wma: wma } };
});
