/* NHIP · V2.56 — MỘT MÃ DÙNG CHUNG: Biểu đồ · Phân tích · Giao dịch · Phân tích AI · AI nổi
   Trước đây: Biểu đồ chỉ ghi sessionStorage.sym, còn Phân tích đọc analysisSym (mã cũ) trước, Giao dịch đọc nhip.trade.lastsym → đổi mã ở Biểu đồ nhưng các mục kia vẫn giữ mã cũ.
   Nay: mỗi lần một trang nạp mã (sự kiện nhip:chart-symbol do Biểu đồ/Phân tích/Giao dịch phát ra) → ghi đồng bộ cả sym + analysisSym + mã Giao dịch gần nhất + __nhipChartSymbol (AI đọc từ đây).
   Không ghi đè khi chuyển route: các nút Mua/Bán, Danh mục, Theo dõi… tự đặt mã mới rồi mới chuyển trang, nên mã họ chọn luôn được giữ. Mã thuộc sàn khác sàn đang mở không được kéo chéo sàn.
   Chỉ số (VNINDEX, VN30…) đồng bộ cho Biểu đồ/Phân tích, KHÔNG ghi vào mã Giao dịch (không đặt lệnh chỉ số). */
(function () {
  "use strict";
  var W = window, D = document, LSK = "nhip.trade.lastsym", cur = "";
  var IDX = /^(VNINDEX|VN30|VN100|VNALL|VNMID|VNSML|HNX\w*|UPCOM\w*)$/;
  function norm(s) { return String(s || "").toUpperCase().replace(/[^A-Z0-9.]/g, ""); }
  function houseOk(s) {
    try { if (IDX.test(s)) return true; var H = W.NHIPHouse; if (H && H.houseOf && H.cur) { var h = H.houseOf(s); return !h || h === H.cur(); } } catch (e) { }
    return true;
  }
  function write(s) {
    try {
      W.__nhipChartSymbol = s;
      W.sessionStorage.setItem("sym", s); W.sessionStorage.setItem("analysisSym", s);
      if (!IDX.test(s)) W.localStorage.setItem(LSK, s);
    } catch (e) { }
  }
  function take(s) { s = norm(s); if (!s || s.length < 2 || !houseOk(s)) return; cur = s; write(s); }

  /* 1) Bất kỳ trang nào nạp mã (Biểu đồ, Phân tích, Giao dịch dùng chung bộ biểu đồ) */
  W.addEventListener("nhip:chart-symbol", function (e) { take(e && e.detail && e.detail.sym); });

  /* 2) Trang Phân tích dạng form cũ (#an-form / #an-symbol) không phát sự kiện trên → bắt khi gửi form */
  D.addEventListener("submit", function (e) {
    var f = e.target; if (!f || f.id !== "an-form") return;
    setTimeout(function () { var i = D.getElementById("an-symbol"); if (i) { var s = norm(i.value); if (s && houseOk(s)) { take(s); try { W.dispatchEvent(new CustomEvent("nhip:chart-symbol", { detail: { sym: s } })); } catch (x) { } } } }, 60);
  }, true);

  /* khởi động: nhớ mã đang có để lần chuyển trang đầu tiên không bị lệch */
  try { var s0 = norm(W.__nhipChartSymbol || W.sessionStorage.getItem("sym")); if (s0 && houseOk(s0)) cur = s0; } catch (e) { }
  W.NHIPSymSync = { cur: function () { return cur; }, set: take };
})();
