# Bảng ô vuông 52 tuần (lịch chăm học kiểu GitHub) — thiết kế

Ngày: 1/10/2026 · Trạng thái: thầy đã duyệt (cách A)

## Vì sao

Mục 2 trong danh sách ý tưởng lấy từ easyenglisheveryday.vercel.app. Biểu đồ % đúng
ở trang Tiến bộ chỉ cho thấy *kết quả*; bảng ô vuông cho thấy *độ đều đặn* — HS nhìn
cả năm kín ô xanh thì có động lực giữ, thầy nhìn một cái biết em nào học dồn sát hạn.

## Quyết định đã chốt với thầy

1. Một ô tô theo **mọi việc học**: nộp bài giao + tự luyện (kể cả lượt làm lại) + ôn Sổ từ.
2. Hiện ở **cả hai phía**: trang Tiến bộ của HS và trang chi tiết học viên của GV.
3. Dòng nhận xét **vui nhẹ, không chê**, luôn kèm một việc cụ thể nên làm.
4. Điện thoại: **bảng đủ 53 cột, vuốt ngang**, mở ra tự cuộn tới tuần hiện tại (cách A).

**Không đổi schema** — mọi thứ suy ra từ `AttemptSkill`, `Attempt`, `VocabQuizDay`.

## Cách tính một ngày (giờ VN)

Khoá ngày `YYYY-MM-DD` theo giờ VN (`vietnamDateKey` trong `lib/vocab-day.ts`).

- **Bài làm**: mỗi `AttemptSkill` có `submittedAt` = 1 việc vào ngày đó. Attempt đã nộp
  (`submittedAt` khác null) mà **không** có `AttemptSkill.submittedAt` nào (dữ liệu cũ
  được backfill chỉ có status) = 1 việc vào ngày `Attempt.submittedAt`. Tính mọi lượt
  (cả tự luyện lượt ≥ 2) — khác thống kê năng lực.
- **Ôn Sổ từ**: dòng `VocabQuizDay` có `total ≥ 1` = 1 việc; `total ≥ 20` = 2 việc.
- **Mức màu** theo tổng việc: 0 = trống, 1 → mức 1, 2 → mức 2, 3–4 → mức 3, ≥ 5 → mức 4.

## Lưới

- 53 cột tuần (Thứ 2 → Chủ nhật, khớp `vnWeekStart`), cột cuối là tuần chứa hôm nay;
  ô sau hôm nay không vẽ. Cửa sổ bắt đầu từ Thứ 2 của tuần cách đây 52 tuần.
- Nhãn tháng phía trên (cột đầu tiên chứa ngày 1 của tháng: "Th1"…"Th12"), nhãn
  T2 / T4 / T6 bên trái.
- Ô 12px, khe 3px; khung `overflow-x-auto`, sau khi gắn vào trang cuộn hết sang phải
  (một `useEffect` nhỏ). Máy tính rộng thì thấy trọn bảng.
- Chạm/rê vào ô hiện dòng chi tiết ngay dưới bảng (không dùng tooltip nổi — dễ tràn
  khỏi màn điện thoại), ví dụ "Thứ Ba 30/9 · 2 bài · ôn 14 thẻ". Ô cũng có `title`
  và `aria-label` cùng nội dung.
- Chú thích "Ít ▢▢▢▢▢ Nhiều" bên dưới.

## Số liệu phía trên bảng

- **Ngày có học** trong cửa sổ 53 tuần.
- **Chuỗi hiện tại**: ngày học liền nhau tính lùi; hôm nay chưa học thì không tính đứt
  (dùng lại `calculateVocabStreak` của `lib/vocab-streak.ts`).
- **Chuỗi dài nhất** trong cửa sổ.

## Dòng nhận xét (chỉ phía HS)

Chọn câu đầu tiên khớp, theo thứ tự:

1. Chưa có ngày học nào → "Bảng còn trắng tinh — ô xanh đầu tiên đang chờ bạn 🌱"
2. Chuỗi hiện tại ≥ 7 → "{n} ngày liền không nghỉ — phong độ quá! 🔥"
3. Lần học gần nhất cách hôm nay ≥ 3 ngày → "Đã {n} ngày chưa mở sách — ôn 10 thẻ cho ấm tay nhé 🙂"
4. Học dồn: 28 ngày gần nhất có ≤ 4 ngày học và có ngày ≥ 4 việc →
   "Bạn hay học dồn một hôm — chia nhỏ mỗi ngày một chút sẽ nhớ lâu hơn"
5. Chuỗi hiện tại ≥ 3 → "Chuỗi {n} ngày — giữ lửa nhé!"
6. Hôm nay đã học → "Hôm nay đã có ô xanh rồi 👍"
7. Còn lại → "Hôm nay chưa có ô xanh — ôn vài thẻ là có ngay"

Phía GV không hiện câu này (câu viết cho HS, xưng "bạn").

## Code

- `lib/activity-heatmap.ts` — logic thuần, có unit test:
  - `buildActivityDays({ skillSubmits, attemptSubmits, vocabDays })` → `Map<dateKey, { submits, vocabCards, count }>`
  - `buildHeatmapGrid({ days, today })` → cột tuần, nhãn tháng, mức màu từng ô
  - `summarizeActivity({ days, today })` → ngày có học, chuỗi hiện tại, chuỗi dài nhất, số ngày từ lần học gần nhất
  - `pickActivityMessage(summary + days)` → câu nhận xét
- `lib/activity-heatmap-data.ts` — `getActivityHeatmap(studentId, now)` đọc DB
  (3 truy vấn `select` gọn, lọc từ đầu cửa sổ) rồi gọi các hàm trên. Dùng chung 2 trang.
- `components/activity-heatmap.tsx` — client component (cuộn phải + ô đang chọn).
- `app/student/stats/page.tsx` — khối đặt trên cùng; HS chưa nộp bài vẫn thấy bảng
  (có thể đã ôn từ), trạng thái rỗng cũ chỉ còn thay cho 2 biểu đồ điểm.
- `app/teacher/students/[studentId]/page.tsx` — khối đặt trước "Tiến bộ & điểm yếu".
- Màu: dùng token `primary` với các độ đậm (`bg-primary/20`, `/45`, `/70`, `bg-primary`),
  ô trống `bg-muted` — tự hợp chế độ tối.
- Không dùng API mới nào ngoài danh sách browserslist.

## Kiểm thử

- Unit test `tests/activity-heatmap.test.ts`: gộp việc theo ngày giờ VN (ranh giới
  17:00 UTC), fallback Attempt không có skill, mức màu, lưới 53 cột bắt đầu Thứ 2,
  nhãn tháng, chuỗi hiện tại/dài nhất, từng nhánh câu nhận xét.
- Kiểm giao diện ở khung trình duyệt (HS đăng nhập Google), cả khổ điện thoại.
