/* NHIP · Chữ trên biểu đồ KLineChart luôn đủ sáng/tương phản theo chủ đề (Time/Open/High/Low/Close/Volume, MACD, trục giá).
   Bọc klinecharts.init: mọi lần setStyles (kể cả setStyles("dark")) đều được áp lại màu chữ rõ nét. Không đổi dữ liệu. */
(function () {
  try {
    var K = window.klinecharts; if (!K || !K.init) return;
    var css = function (n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); };
    var extra = function () {
      var t = css("--text") || "#e6edf4", t3 = css("--text2") || t, small = innerWidth <= 700;
      return {
        candle: { tooltip: { text: { size: small ? 12 : 13, weight: "700", color: t, marginTop: 5, marginRight: 10 } } },
        indicator: { tooltip: { text: { size: small ? 11 : 12, weight: "700", color: t } } },
        xAxis: { tickText: { color: t3, size: 11, weight: "600" } },
        yAxis: { tickText: { color: t3, size: 11, weight: "600" } }
      };
    };
    var orig = K.init;
    K.init = function () {
      var c = orig.apply(this, arguments);
      if (c && c.setStyles) {
        var raw = c.setStyles.bind(c);
        c.setStyles = function (v) { var r = raw(v); try { raw(extra()); } catch (e) {} return r; };
        try { raw(extra()); } catch (e) {}
      }
      return c;
    };
  } catch (e) { console.warn("chartfix", e); }
})();
