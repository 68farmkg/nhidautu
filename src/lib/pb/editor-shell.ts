// Khung HTML của trình dựng (không chứa dữ liệu; dữ liệu nằm trong <script id="pb-boot">). Dùng chung cho trang Astro và bộ kiểm thử trình duyệt.
export const editorShell = (): string => `
<div class="pbx" id="pbx">
  <div class="pbx-top">
    <a class="pbx-back" href="/admin/trang" title="Quay lại danh sách">←</a><b class="pbx-h">Chỉnh sửa trang</b><span id="pb-state" class="meta"></span>
    <span class="pbx-sp"></span>
    <button type="button" class="btn ghost sm" id="pb-save">Lưu nháp</button>
    <button type="button" class="btn ghost sm" id="pb-prev">Xem trước</button>
    <span class="pbx-pub"><button type="button" class="btn sm" id="pb-pub">Xuất bản</button><button type="button" class="btn sm" id="pb-pubm" aria-label="Thêm tùy chọn">▾</button>
      <div class="pbx-menu" id="pb-pubmenu" hidden>
        <button type="button" data-m="tab">Mở bản xem trước ở tab mới</button><button type="button" data-m="unpub">Hủy xuất bản (về nháp)</button><button type="button" data-m="tpl">Lưu trang này làm mẫu</button>
        <button type="button" data-m="export">Xuất trang (JSON)</button><button type="button" data-m="import">Nhập trang từ JSON</button><button type="button" data-m="dup">Nhân bản trang</button><button type="button" data-m="live">Xem trang thật</button>
        <input type="file" id="pb-file" accept="application/json,.json" hidden></div></span>
  </div>
  <div id="pb-banner" class="pbx-banner" hidden></div>
  <div class="pbx-title"><input id="pb-title" type="text" placeholder="Tên trang" maxlength="200" aria-label="Tên trang">
    <div class="meta pbx-slug">Đường dẫn: <span id="pb-url"></span> <button type="button" class="btn ghost sm" id="pb-slug-edit">Chỉnh sửa</button><input id="pb-slug" type="text" hidden aria-label="Đường dẫn"></div></div>
  <div class="pbx-tabs" id="pb-tabs"><button type="button" data-tab="content" class="on">Nội dung</button><button type="button" data-tab="seo">SEO</button><button type="button" data-tab="settings">Cài đặt</button><button type="button" data-tab="history">Lịch sử</button></div>
  <section data-tab="content" class="pbx-main">
    <aside class="pbx-left" id="pb-left">
      <div class="pbx-ltabs"><button type="button" data-l="tpl" class="on">Mẫu trang</button><button type="button" data-l="blocks">Khối</button><button type="button" data-l="tree">Cấu trúc</button></div>
      <div class="pbx-lbody" id="pb-lbody"></div>
    </aside>
    <div class="pbx-center">
      <div class="pbx-tool">
        <button type="button" class="btn sm" id="pb-add">＋ Thêm khối</button>
        <button type="button" class="btn ghost sm pbx-narrow" id="pb-lt">☰ Thư viện</button>
        <button type="button" class="pbx-ic" id="pb-undo" title="Hoàn tác (Ctrl+Z)" disabled>↶ <span>Hoàn tác</span></button>
        <button type="button" class="pbx-ic" id="pb-redo" title="Làm lại (Ctrl+Shift+Z)" disabled>↷ <span>Làm lại</span></button>
        <span class="pbx-sp"></span>
        <span class="pbx-seg" id="pb-area" hidden><button type="button" data-a="main" class="on">Nội dung chính</button><button type="button" data-a="side">Thanh bên</button></span>
        <span class="pbx-seg" id="pb-dev"><button type="button" data-d="desktop" class="on">Máy tính</button><button type="button" data-d="tablet">Tablet</button><button type="button" data-d="mobile">Điện thoại</button></span>
        <button type="button" class="btn ghost sm pbx-narrow" id="pb-rt">⚙ Cài đặt</button>
      </div>
      <div class="pbx-stage" id="pb-stage"><div class="pbx-frame" id="pb-frame"><iframe id="pb-canvas" title="Trang đang soạn" sandbox="allow-scripts allow-same-origin allow-popups"></iframe></div><div class="pbx-load" id="pb-load" hidden>Đang dựng…</div></div>
    </div>
    <aside class="pbx-right" id="pb-right"></aside>
  </section>
  <section data-tab="seo" class="pbx-pane" hidden></section>
  <section data-tab="settings" class="pbx-pane" hidden></section>
  <section data-tab="history" class="pbx-pane" hidden></section>
  <div class="pbx-toast" id="pb-toast" role="status" aria-live="polite"></div>
  <datalist id="pb-links"></datalist>
</div>`;
