# Hồ sơ học viên: bảng "Chỉnh sửa hồ sơ" + bố cục 2 cột kiểu chin (5/10/2026)

Thầy chốt: cho HS **tải ảnh nền riêng miễn phí**, cho HS **tự đổi tên hiển thị**, bố cục **2 cột kiểu chin**.

## Bố cục
- `/student/profile` và `/student/profile/[id]` là "trang rộng" trong AppShell, tự bó `max-w-[1400px]`.
- Từ `xl`: lưới `[1fr_340px]`. Cột chính: thẻ bìa (bút chì ✏️ góc phải trên, chỉ hồ sơ của mình) + dòng thông tin + bio; lịch chăm học (chỉ của mình). Cột phụ: thẻ Hạng đấu (của mình có thanh tiến độ + "Còn N điểm để lên X"; bạn cùng lớp chỉ tên bậc, không con số), thẻ thống kê (chỉ của mình), thẻ Linh vật (linh vật chuyển từ góc bìa sang thẻ này ở 2 trang hồ sơ).
- Dưới `xl`: xếp chồng.

## Bảng chỉnh sửa
- Trượt từ phải (`createPortal` ra body), điện thoại toàn màn hình; Esc / nền mờ / "Hủy" để đóng, bỏ bản nháp.
- Bản nháp hiện xem trước NGAY trên bìa phía sau; chỉ ghi khi "Lưu thay đổi".
- Mục: Ảnh đại diện (tải ảnh / emoji có sẵn / xoá ảnh, xem kèm khung) · Nền (xem trước lớn, hàng màu bìa, "Tải ảnh riêng", lưới "Nền đã mở khóa" = Ảnh của bạn + nền sở hữu) · Khung đã mở khóa (kèm "Không khung") · Tên hiển thị (≤ 40) · Giới thiệu (≤ 280) · Mục tiêu band.

## Dữ liệu
- Cột mới `StudentProfile.coverImageUrl` (ensure-db + blob-orphans).
- `equippedBackground` nhận thêm giá trị đặc biệt `custom:image` = dùng `coverImageUrl`. Thứ tự hiển thị bìa: mã nền Cửa hàng → ảnh riêng (khi chọn `custom:image` và URL hợp lệ) → màu bìa. Chọn màu = `equippedBackground` null, ảnh vẫn giữ để chọn lại.
- Ảnh nền: nén trên trình duyệt (cạnh dài ≤ 1600px, webp, rơi về jpeg nếu trình duyệt không xuất được webp) → `POST /api/student/cover` (chỉ HS, ≤ 1MB, không SVG) → `covers/<userId>.webp`. URL phải nằm trong `covers/` (cùng chốt như avatar), không trùng của HS khác; ảnh cũ xoá SAU khi ghi DB.
- `updateMyProfile` ghi thêm `displayName`, `coverImageUrl`, `equippedBackground`, `equippedFrame` (nền/khung phải sở hữu; `custom:image` cần có ảnh). `decorationSchema` 5 trường giữ nguyên — các trường mới đọc ở `readSelfExtras`, giáo viên không đi qua đường này.
- Giáo viên: nút "Gỡ ảnh nền" ở khối Xu & đồ trang trí trang học viên (`removeStudentCoverImage`, lọc theo lớp của thầy).
