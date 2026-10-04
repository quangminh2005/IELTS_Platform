# Khung avatar kiểu chin.edu.vn — vẽ lại + hiệu ứng động (4/10/2026)

**Thầy chốt:** vẽ lại bằng SVG (không dùng ảnh webp động của chin — tài sản của họ,
mỗi file 0,5–2 MB), có hiệu ứng động. Giữ nguyên mã/tên/giá/độ hiếm → không đổi dữ liệu.

## Thiết kế
- Càng đắt càng cầu kỳ: Thường (gỗ, đồng) = vòng có khối + chi tiết nhỏ;
  Hiếm (bạc, vàng) = cánh kim loại / nguyệt quế, đá quý, 3 sao đáy;
  Sử thi (lục bảo, hồng ngọc) = cánh lông vũ lớn, vương miện đính đá, hào quang;
  Huyền thoại (phượng hoàng) = cánh lửa, mào lửa bập bùng, tàn lửa bay, vòng lửa xoay;
  Quán quân = tia sáng vàng xoay sau lưng, nguyệt quế, cúp, ruy-băng số 1.
- Hiệu ứng: keyframes `frame-*` trong `tailwind.config.ts` (vệt sáng chạy quanh viền,
  tia sao nhấp nháy, cánh phập phồng, hào quang toả nhịp, lửa bập bùng, tàn lửa).
  Chỉ trong `motion-safe:`. Quầng sáng = CSS `drop-shadow` trên thẻ `<svg>`.
- Vẫn giữ luật cũ: không `<defs>`, không `id`, không gradient (AppShell vẽ avatar 2 lần).
- `lite` (avatar sm/list ở bảng xếp hạng): bỏ tia sao/tàn lửa/quầng sáng, cánh thu
  còn 50% để không đè lên tên (cách avatar 12px).
- Gốc cánh phải nằm giữa dải vòng (r ≈ 41); trang trí không được lấn vào r < 37
  (mặt avatar).
- Thẻ xem trước trong Cửa hàng thu 75% dưới 640px để cánh không bị cắt ở 2 cột.

## Kiểm
`tests/shop-catalog.test.ts` (có hình cho mọi mã, không id/defs, animate chỉ motion-safe),
`tsc`, xem local ở trang Cửa hàng (sáng + tối) và hàng avatar nhỏ.
