# Chỉ tiêu tự luyện hàng tuần — thiết kế

Ngày: 11/10/2026 · Người chốt: thầy Anh Vũ

## Vấn đề

Ở `/teacher/practice` rất ít em chủ động tự luyện. Hiện tự luyện chỉ có thưởng
(Xu/XP lượt đầu, giữ chuỗi ngày, +50% khi ẩn audio) nhưng:

- Điểm xếp hạng lớp không tính tự luyện — bỏ tự luyện không mất gì.
- Không có mục tiêu cụ thể: em không biết bao nhiêu là "đủ", chỉ thầy thấy ai lười.

## Mục tiêu

Mỗi học viên có **chỉ tiêu tự luyện mỗi tuần** do thầy đặt riêng (mặc định 1).
Đạt thì được thưởng, không đạt thì bị trừ Xu và tụt điểm xếp hạng, phụ huynh thấy,
chuông nhắc trước khi hết tuần, bạn cùng lớp thấy huy hiệu.

Thành công = số em có lượt tự luyện mỗi tuần ở `/teacher/practice` tăng rõ so với
trước 12/10/2026.

## Quyết định thầy đã chốt

| Câu hỏi | Chốt |
|---|---|
| Chỉ tiêu đặt theo | Từng học viên, mặc định **1**; 0 = miễn |
| "1 bài" là | **1 phần kỹ năng** (1 passage / 1 part / 1 task) |
| Làm thật | Nghe/Đọc trả lời ≥ 50% câu · Viết ≥ 50 từ · Nói có ghi âm ≥ 50% câu · **và** ≥ 3 phút làm thực của phần đó |
| Thưởng | **+30 Xu** khi đạt, ghi ngay lúc đạt, mỗi tuần một lần |
| Trừ Xu | **−30 Xu** khi tuần kết thúc mà chưa đạt, **không để số dư âm** |
| Xếp hạng | Thêm thành phần **Tự luyện 10%**: Điểm TB 60% + Hoàn thành 20% + Tự luyện 10% + Hoạt động 10% |
| Áp dụng | Từ **thứ Hai 12/10/2026**, không hồi tố |

## Cách tiếp cận

**Suy ra từ dữ liệu**, như chuông, Lịch chăm học, chuỗi ngày: không có bảng "tuần".
Mỗi lần cần, đọc các lượt tự luyện đã nộp → tính tuần đạt/trượt. Chỉ hai thứ được
ghi xuống DB: cột chỉ tiêu và hai loại dòng sổ Xu (thưởng/trừ). Thầy đổi chỉ tiêu
giữa tuần thì áp dụng ngay, không cần chạy lại gì.

## Luật tính (logic thuần `lib/practice-goal.ts`, không import prisma)

### Tuần

- Thứ Hai 00:00 → Chủ nhật 23:59 **giờ VN** (dùng `VN_OFFSET_MS` của `lib/streak.ts`).
- Khoá tuần = ngày thứ Hai dạng `YYYY-MM-DD`.
- `PRACTICE_GOAL_START = "2026-10-12"` — tuần trước mốc này không tồn tại với mọi luật dưới đây.

### Một phần được tính ("phần đạt")

Một cặp (lượt tự luyện, AssignableUnit) được tính khi đủ cả:

1. Lượt thuộc bài tự luyện (`onlyPracticeAssignment`), **mọi lượt** kể cả luyện lại.
2. Kỹ năng chứa phần đó đã nộp (`AttemptSkill.submittedAt`); tuần của phần = tuần của mốc nộp này.
3. Thời gian làm phần ≥ 180 giây: lấy `partTimesJson[unitId]`; lượt thiếu `partTimesJson` thì
   lấy `AttemptSkill.elapsedSeconds` chia đều cho số phần của kỹ năng đó trong lượt.
4. Đủ nửa bài:
   - Nghe/Đọc (và Viết điền chỗ trống tự chấm): số câu có `Answer.value` không rỗng ≥ 50% số câu của phần.
   - Viết tự luận: tổng số từ các câu trả lời của phần ≥ 50.
   - Nói: số câu có ghi âm (value không rỗng) ≥ 50% số câu của phần.

Mỗi phần không đạt mang một lý do (`too_short` | `too_few_answers`) để hiện cho học viên.

### Tuần đạt

`đạt(tuần) = số phần đạt trong tuần ≥ chỉ tiêu`. Chỉ tiêu dùng giá trị **hiện tại** của
`StudentProfile.practiceWeeklyGoal` (không lưu lịch sử chỉ tiêu — YAGNI). Chỉ tiêu 0 → luôn đạt
nhưng **không** ra thưởng/trừ.

### Thành phần xếp hạng "Tự luyện" (0–100)

- Xét 4 tuần gần nhất (tuần hiện tại + 3 tuần trước), bỏ tuần trước `PRACTICE_GOAL_START`.
- Tuần đã kết thúc: luôn được xét. Tuần hiện tại: chỉ được xét **khi đã đạt** (chỉ cộng, không trừ giữa tuần).
- Giá trị = tuần đạt / tuần được xét × 100. Không có tuần nào được xét, hoặc chỉ tiêu 0 → 100.
- Hàm nhận `asOf` để ảnh chụp "7 ngày trước" của bảng xếp hạng (mũi tên lên/xuống hạng) tính đúng.

`lib/ranking.ts`: `0.6 × Điểm TB + 0.2 × Hoàn thành + 0.1 × Tự luyện + 0.1 × Hoạt động`.
`RankingScoreInput` thêm `practiceGoalPercent`. Mọi nơi gọi `studentRankingScore` /
`rankingScoreFromRecipientsAndAttempts` / `class-ranking.ts` phải truyền thêm dữ liệu tự luyện.

## Sổ Xu

Hai kind mới trong `CoinKind` (`lib/coins.ts`), **không** thuộc `XP_EARN_KINDS` → không cộng/trừ XP,
hạng đấu, bảng tin, Tổng kết tháng:

| Kind | Key | Số tiền | Khi nào |
|---|---|---|---|
| `practice_goal` | `practice-goal:<thứ Hai>` | +30 | Lần đầu thấy tuần đó đạt (chỉ tiêu ≥ 1) |
| `practice_miss` | `practice-miss:<thứ Hai>` | −min(30, số dư lúc ghi) | Tuần đã kết thúc, chưa đạt, chỉ tiêu ≥ 1, chưa có dòng `practice-goal` cùng tuần |

- Ghi qua `lib/wallet.ts` theo đúng khuôn: khoá dòng `FOR UPDATE`, chèn dòng (unique studentId+key
  chống trùng), `recomputeCoins`. Số tiền trừ tính **dưới khoá** từ số dư lúc đó → không âm.
  Số dư 0 → vẫn ghi dòng amount 0 (để chuông có mốc và không xét lại).
- Đã có `practice-goal` của tuần thì không bao giờ ghi `practice-miss` cho tuần đó (thầy nâng chỉ tiêu
  sau khi em nhận thưởng không làm em bị trừ).
- `practice-miss` đã ghi thì không hoàn lại kể cả khi thầy hạ chỉ tiêu sau đó.
- Học viên `hiddenFromBoards` (tài khoản thử của thầy) vẫn áp dụng như thường — không có lý do miễn.

### Ai ghi, khi nào

Hàm `syncPracticeGoal(studentId, now)` (idempotent) trong `lib/practice-goal-data.ts`:

- Sau `submitSkill` của lượt tự luyện (cùng chỗ đang gọi `syncWallet`, bọc try/catch) → thưởng ngay.
- Đầu trang `/student` và `/student/practice` → ghi trừ cho các tuần đã qua.
- Cron trưa `/api/cron/reminders` → chạy cho mọi học viên có chỉ tiêu ≥ 1 (sau `warmUpDatabase()`),
  để em không mở web vẫn bị trừ.

Chỉ xét các tuần từ `PRACTICE_GOAL_START` đến tuần hiện tại.

## Schema

- `StudentProfile.practiceWeeklyGoal Int @default(1)` — thêm vào `scripts/ensure-db.mjs`
  (`ADD COLUMN IF NOT EXISTS "practiceWeeklyGoal" INTEGER NOT NULL DEFAULT 1`).
- Thêm `practice_goal | practice_miss` vào comment `enum CoinKind` đầu `schema.prisma` (dòng 27) và comment cột `CoinTransaction.kind`.

## Hiển thị

### Học viên

- **Trang chủ `/student`** — thẻ "🎯 Tự luyện tuần này":
  thanh `x/N phần`, dòng "Đạt +30 Xu · Không đạt −30 Xu", hạn "Chủ nhật", nút "Luyện ngay"
  → `/student/practice`; đạt rồi thì xanh "Đã đạt ✓ +30 Xu"; 4 chấm ✓/✗ (tuần chưa áp dụng không vẽ);
  dòng nhỏ khi có lượt bị loại ("1 lượt chưa tính: làm dưới 3 phút"). Chỉ tiêu 0 → ẩn thẻ.
- **`/student/practice`** — một dòng tiến độ ngắn ở đầu trang.
- **Chuông** (suy ra, thêm vào `StudentNotificationType` + `lib/notifications-feed.ts`):
  - `practice_reminder`: tuần hiện tại chưa đạt, từ thứ Sáu 12:00 VN; mốc `createdAt` = thứ Sáu 12:00;
    nội dung "Còn N phần tự luyện để đạt chỉ tiêu tuần — hạn Chủ nhật".
  - `practice_goal_met`: từ dòng sổ `practice_goal` — "Em đạt chỉ tiêu tự luyện tuần, +30 Xu".
  - `practice_missed`: từ dòng sổ `practice_miss` — "Tuần dd/mm–dd/mm em chưa đạt chỉ tiêu tự luyện, −N Xu".
- **Bảng xếp hạng lớp** — huy hiệu 🎯 cạnh tên em đã đạt tuần này; phần chi tiết điểm thêm dòng
  "Tự luyện: a/b tuần".

### Phụ huynh `/ph/[token]`

Khối "Tự luyện ở nhà": "Tuần này: x/N phần (đã đạt / chưa đạt)", 4 tuần gần nhất ✓/✗,
câu giải thích "Thầy giao N phần/tuần, mỗi phần khoảng 15–20 phút". Không nhắc Xu.
Chỉ tiêu 0 → ẩn khối.

### Thầy

- **`/teacher/practice`** — cột **Chỉ tiêu** (ô số 0–20, lưu khi rời ô, action `setPracticeGoal`
  với `requireTeacher()` + kiểm học viên thuộc lớp của thầy) và cột **Tuần này** (`1/1 ✓` xanh /
  `0/2` đỏ). Sắp "cần nhắc": chưa đạt tuần này lên đầu. Nút **"Đặt cho cả lớp"** khi đang lọc một lớp
  (action `setClassPracticeGoal`).
- **Trang chi tiết học viên** — khối Tự luyện hiện chỉ tiêu (sửa được) + 4 tuần ✓/✗.
- **Banner "Tính năng mới"** — 2 slide (`audience` học viên và thầy), `shippedAt` = ngày ship.

## Kiểm thử

- `tests/practice-goal.test.ts` (thuần): ranh giới tuần giờ VN (CN 23:59 vs T2 00:00), mốc 12/10,
  điều kiện làm thật từng kỹ năng + fallback thời gian không có `partTimesJson`, luyện lại cùng phần
  vẫn tính, tuần hiện tại chỉ cộng, chỉ tiêu 0, tính `asOf`, kế hoạch sổ (không thưởng hai lần,
  không trừ khi đã thưởng, trừ không âm).
- Cập nhật `tests/class-ranking.test.ts`, `tests/student-score.test.ts` theo trọng số mới.
- Test cấu trúc: kind mới không nằm trong `XP_EARN_KINDS`; cột có trong `ensure-db.mjs`;
  slide banner hợp lệ.
- Kiểm local vai HS (JWT tự ký) + vai GV; sau push kiểm prod bằng Chrome.

## Ngoài phạm vi

- Lưu lịch sử chỉ tiêu theo tuần (đổi chỉ tiêu áp ngược cho 4 tuần gần nhất — chấp nhận).
- Mail nhắc / mail phụ huynh.
- Thưởng tăng dần theo chuỗi tuần.
