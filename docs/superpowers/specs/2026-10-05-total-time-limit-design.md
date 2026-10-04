# Tổng thời gian cả bài (một đồng hồ chung cho bài nhiều kỹ năng)

Ngày: 5/10/2026 · Người yêu cầu: thầy Anh Vũ

## Vấn đề
Bài giao nhiều kỹ năng (vd Reading + Writing "Task 6") hiện chỉ đặt được giờ **theo từng kỹ năng** — mỗi kỹ năng một phiên, một đồng hồ riêng. Giáo viên muốn đặt **30 phút cho cả bài**.

## Quyết định đã chốt
1. **Chọn một trong hai**: ở bước Cài đặt có nút gạt "Theo từng kỹ năng" / "Tổng cả bài". Chọn tổng thì ẩn các ô từng kỹ năng. Bài chỉ có 1 kỹ năng: không hiện nút gạt.
2. **Hết giờ = nộp cả bài**: kỹ năng đang làm tự nộp, các kỹ năng Listening/Reading/Writing chưa nộp cũng nộp luôn bằng đáp án nháp đã lưu (chưa làm = trống).
3. **Speaking không tính vào tổng**: không đếm, không đồng hồ, không tự nộp (giữ quy tắc Speaking không bao giờ tự nộp).

## Dữ liệu
- Cột mới `Assignment.totalTimeLimitMinutes Int?` (null = không dùng chế độ tổng). Thêm `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` vào `scripts/ensure-db.mjs`.
- Khi lưu ở chế độ tổng: `totalTimeLimitMinutes = n`, `skillTimeLimitsJson = null`. Chế độ từng kỹ năng: `totalTimeLimitMinutes = null`.

## Logic (hàm thuần, `lib/active-time.ts`)
- `TOTAL_TIMED_SKILLS` = Listening/Reading/Writing (= `AUTO_SUBMIT_SKILLS`).
- `totalRemainingSeconds(totalMinutes, elapsedBySkill)` = `total*60 − Σ elapsed` của các kỹ năng tính giờ, không âm.
- `totalModeBudgetSeconds(skill, totalMinutes, elapsedBySkill)` = ngân sách của kỹ năng đang mở = `total*60 − Σ elapsed các kỹ năng tính giờ KHÁC`; Speaking → null.
- `resolveSkillBudgetSeconds(...)`: có `totalMinutes` → dùng chế độ tổng; không thì giữ `skillBudgetSeconds` cũ.
- Đồng hồ vẫn là "thời gian làm thực" (`AttemptSkill.elapsedSeconds`), tạm dừng khi rời phiên / mất mạng.

## Server
- `submitSkill` với `auto_timeout`: kiểm hết giờ bằng `resolveSkillBudgetSeconds` (elapsed các kỹ năng khác đọc từ DB).
- Ở chế độ tổng + `auto_timeout` hợp lệ: chấm và khoá kỹ năng đang nộp **và** mọi kỹ năng tính giờ còn chưa nộp (đáp án lấy từ nháp), trong cùng transaction; nếu thế là đủ mọi kỹ năng thì finalize Attempt như cũ.

## Giao diện
- `SkillTimeInputs`: thêm nút gạt + ô "Tổng thời gian" (trường `timeMode`, `totalTimeMinutes`) khi bài có ≥ 2 kỹ năng; nhận `defaultTotalMinutes` khi sửa bài.
- Phòng làm bài: đồng hồ dùng ngân sách theo chế độ tổng; màn chọn kỹ năng ghi "Tổng thời gian cả bài: N phút · còn mm:ss".
- Mở một kỹ năng khi tổng đã hết → còn 0 giây → tự nộp ngay (lưới an toàn nếu lần nộp dây chuyền trước bị lỗi mạng).

## Kiểm thử
- Unit test cho các hàm thuần mới trong `tests/active-time.test.ts`.
- Thử local: đề Reading + Task 6, tổng 2 phút, học viên seed — đồng hồ nối tiếp sang Writing, hết giờ thì nộp cả bài.

## Ngoài phạm vi
Thư viện tự luyện (practice) giữ nguyên; không có chế độ kết hợp tổng + từng kỹ năng.
