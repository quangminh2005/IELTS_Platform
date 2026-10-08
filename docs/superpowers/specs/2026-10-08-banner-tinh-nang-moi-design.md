# Banner "Tính năng mới" kiểu chin — thiết kế

Ngày: 2026-10-08 · Thầy đã duyệt trong chat.

## Mục tiêu
Mỗi khi web có tính năng mới, trang chủ hiện một carousel "✦ TÍNH NĂNG MỚI" giống
chin.edu.vn (khối "Marketing TV"): mỗi slide = linh vật + tiêu đề 2 dòng + 1 câu mô
tả + nút dẫn tới tính năng; tự chuyển, có ‹ ›, tạm dừng, dãy gạch tiến độ.

## Quyết định
- **Ai thêm slide:** Claude, trong cùng lần push với tính năng. Không có trang quản
  lý, không có bảng DB.
- **Hiện cho ai:** cả học viên (`/student`) lẫn thầy (`/teacher`), mỗi bên chỉ thấy
  slide của mình.
- **Ảnh:** linh vật SVG có sẵn (`MascotArt`, 4 con × 6 tư thế) trên nền chuyển màu
  riêng từng slide.

## Dữ liệu — `lib/feature-announcements.ts`
```ts
type FeatureAnnouncement = {
  id: string;                 // không trùng
  audience: "student" | "teacher";
  title: [string, string];    // 2 dòng
  description: string;        // 1 câu
  cta: string;                // chữ trên nút
  href: string;               // /student/... hoặc /teacher/... theo audience
  mascot: MascotId; pose: PoseId;
  theme: BannerTheme;         // khoá bảng màu nền
  shippedAt: string;          // "YYYY-MM-DD" (giờ VN)
};
```
Hàm thuần `activeAnnouncements(list, audience, now)`: giữ slide đúng audience,
`shippedAt` trong 30 ngày gần nhất (tính theo ngày VN, không hiện slide ngày tương
lai), mới nhất trước, tối đa 6. Rỗng → trang không render banner.

## Giao diện — `components/feature-banner.tsx` (client)
- Nền tối chuyển màu theo theme, linh vật trái, chữ phải (căn phải trên máy tính).
- Tự chuyển 7 giây; dừng khi rê chuột, khi bấm nút tạm dừng, khi tab ẩn, và khi máy
  bật "giảm chuyển động".
- ‹ › + dãy gạch (gạch đang chạy có thanh tiến độ) — `role="tablist"`/`tab`.
- Điện thoại: vuốt trái/phải (touch events), cao ~180px, linh vật nhỏ ở góc phải.
- Chỉ 1 slide thì ẩn ‹ ›, gạch và tạm dừng.
- Không dùng API ngoài danh sách browserslist (iOS 15.6), không thêm thư viện.

## Vị trí
- Học viên: dưới lời chào, trên "Buổi học tới"/"Bài được giao".
- Thầy: dưới header "Tổng quan".

## Slide ban đầu
Học viên: Bảng tin & bạn bè (6/10) · Hạng đấu XP (5/10) · Nhờ AI chấm (5/10) · Tự
luyện ẩn audio +50% XP (5/10) · Linh vật & chuỗi ngày (4/10).
Thầy: Tốc độ nói ở trang chấm Speaking (6/10) · AI chấm nháp (5/10) · Tab Lịch học
(30/9).

## Kiểm thử
- `tests/feature-announcements.test.ts`: lọc 30 ngày, audience, sắp xếp, tối đa 6;
  kiểm cấu trúc danh sách thật (id không trùng, href khớp audience, ngày hợp lệ,
  linh vật/tư thế tồn tại, theme tồn tại); hai trang chủ có gắn banner.
- Kiểm bằng trình duyệt ở khổ máy tính và điện thoại.

## Quy trình về sau
Ghi vào `CLAUDE.md`: ship tính năng người dùng nhìn thấy → thêm slide vào
`lib/feature-announcements.ts` trong cùng commit/push.
