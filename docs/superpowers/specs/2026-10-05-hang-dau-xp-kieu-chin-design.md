# Hạng đấu theo XP tích luỹ + trang chi tiết kiểu chin (5/10/2026)

Thầy chốt: chuyển hạng sang kiểu chin — **XP tích luỹ trọn đời, không bao giờ tụt**, 7 hạng × 27 cấp, trang chi tiết `/student/ranks`.

## Hệ thống
- XP trọn đời = SUM(`CoinTransaction.amount`) với kind `earn_unit` | `earn_vocab` (sổ Xu, đã hồi tố từ 7/2026, chỉ lượt đầu mỗi phần). Mua đồ / cứu chuỗi / đổi quà KHÔNG trừ XP. Không đổi schema.
- Ngưỡng đặt theo phân bố prod 5/10/2026 (3 tháng: trung vị 405, p75 646, max 2.625):
  Đồng 0 (I–V: 0·60·150·250·370) · Bạc 500 (500·750·1.000·1.250) · Vàng 1.500 (1.500·2.000·2.500·3.000) · Bạch Kim 3.500 (3.500·4.400·5.300·6.200) · Kim Cương 7.000 (7.000·8.250·9.500·10.750) · Cao Thủ 12.000 (12.000·14.700·17.300) · Thách Đấu 20.000 (20.000·25.000·30.000).
- Logic thuần `lib/xp-rank.ts`; dữ liệu `lib/xp-rank-data.ts` (`getLifetimeXp`, `getLifetimeXpMap`). `lib/rank-tier.ts` (10 bậc theo điểm xếp hạng) bị xoá.

## Hiển thị
- `/student/ranks`: thẻ "Bạn đang ở" (huy hiệu, cấp, tổng XP, tiến trình lên cấp kế), lưới 7 hạng bấm chọn ("BẠN Ở ĐÂY"), chi tiết hạng (mô tả, khoảng XP, ô từng cấp ✓/🔒/"Bạn"), "Cách kiếm XP" đọc thẳng hằng số `lib/monthly-xp.ts`.
- Huy hiệu SVG tự vẽ `components/rank-medal.tsx` (không defs/id), 3 hạng cao có cánh/vương miện.
- Chip `RankTierBadge` (prop `xp`) ở trang chủ, hồ sơ, hồ sơ bạn cùng lớp, bảng xếp hạng lớp (cả phía thầy). Thứ tự bảng xếp hạng lớp VẪN theo điểm xếp hạng.
- Hồ sơ bạn cùng lớp: chỉ tên hạng, không số XP.
- XP Tổng kết tháng (mọi lượt, lượt lại ½) khác XP hạng (lượt đầu) — giữ nguyên có chủ ý để hạng đi cùng sổ Xu.
