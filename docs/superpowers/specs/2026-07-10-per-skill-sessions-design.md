# Phiên làm bài theo từng kỹ năng (per-skill sessions)

- **Ngày:** 2026-07-10
- **Nhánh:** feature/ielts-platform-mvp
- **Trạng thái:** Đã chốt thiết kế, chờ lập kế hoạch triển khai

## Vấn đề

Hiện tại một `Assignment` gộp nhiều `AssignmentUnit` (mỗi unit là một phần của một kỹ
năng: passage Đọc, part Nghe, task Viết/Nói). Khi học sinh bấm **Làm bài**, TẤT CẢ các
kỹ năng nằm chung trong **một phiên làm bài duy nhất** — một `Attempt`, một đồng hồ
chung, đi tuần tự Phần 1 → 7.

Giáo viên muốn: khi giao bài nhiều kỹ năng, học sinh **tự chọn làm kỹ năng nào trước**,
mỗi kỹ năng là một phiên độc lập giống thi IELTS thật.

## Quyết định (đã hỏi giáo viên)

1. **Mỗi kỹ năng = một phiên riêng**, đồng hồ riêng, nộp/khoá độc lập (giống thi thật).
2. **Nộp xong khoá vĩnh viễn** — không sửa/làm lại; chỉ giáo viên reset được (như hiện tại).
3. **Đồng hồ mỗi kỹ năng do giáo viên đặt riêng** khi giao bài.
4. **Xem kết quả ngay sau mỗi kỹ năng** (nộp Nghe → xem điểm Nghe ngay, rồi mới làm Đọc).

## Nguyên tắc kiến trúc

**Giữ nguyên "một `Attempt` cho mỗi bài (recipient)".** Toàn bộ phần hạ nguồn — lịch sử,
xếp hạng, gamification, chấm bài của giáo viên, lịch — đang bám vào thực thể `Attempt`
làm bản ghi duy nhất cho mỗi bài. Ta thêm một bản ghi con theo kỹ năng để lưu trạng thái
/đồng hồ/khoá/điểm-tức-thời, thay vì tách thành nhiều `Attempt` (blast radius lớn hơn
nhiều, chạm ~20 file). `Attempt` chỉ chuyển sang `submitted` khi kỹ năng **cuối cùng**
được nộp → gamification/xếp hạng vẫn kích hoạt đúng một lần như cũ.

## Mô hình dữ liệu

### Bảng mới: `AttemptSkill`
Một dòng cho mỗi kỹ năng trong một attempt.

```prisma
model AttemptSkill {
  id             String    @id @default(cuid())
  attemptId      String
  skill          String    // "listening" | "reading" | "writing" | "speaking"
  status         String    @default("not_started") // not_started | in_progress | submitted
  startedAt      DateTime?
  submittedAt    DateTime?
  elapsedSeconds Int       @default(0)
  score          Float?
  scorePercent   Float?
  attempt        Attempt   @relation(fields: [attemptId], references: [id], onDelete: Cascade)

  @@unique([attemptId, skill])
}
```
- `startedAt` là mốc để tính đồng hồ đếm ngược của kỹ năng đó (start + giới hạn).
- `status` điều khiển khoá: `submitted` = không cho vào sửa nữa (chỉ xem).
- `score`/`scorePercent` để hiển thị kết quả tức thời của riêng kỹ năng.
- `elapsedSeconds` là tổng thời gian làm kỹ năng đó (nguồn chính cho "thời gian theo kỹ
  năng"). `Attempt.partTimesJson` theo phần vẫn giữ để hiện chi tiết từng phần ở trang
  kết quả (không mâu thuẫn: một cái theo kỹ năng, một cái theo phần).

### Cột mới trên `Assignment`
```prisma
skillTimeLimitsJson String?  // { "listening": 30, "reading": 60 } — phút mỗi kỹ năng
```
- `timeLimitMinutes` cũ giữ lại làm fallback và cho trường hợp một-kỹ-năng.
- Kỹ năng không có giá trị → không đếm ngược (chỉ đếm giờ trôi, như cơ chế
  `partTimesJson` hiện tại).

### Thực thể không đổi
`Attempt`, `Answer`, `Highlight`, `TeacherReview`, `AssignmentRecipient` giữ nguyên.
`Attempt.status` chuyển `submitted` khi kỹ năng cuối được nộp; khi đó mới ghi
`Attempt.score`/`scorePercent` tổng và chạy đường hoàn tất hiện có.

## Server actions (`lib/actions/attempts.ts`)

- `startSkillSession(attemptId, skill)` — kiểm tra quyền học sinh + kỹ năng thuộc bài;
  đặt `AttemptSkill.status = "in_progress"` và đóng dấu `startedAt` (chỉ lần đầu, để mở
  lại không reset đồng hồ). Không tạo lại nếu đã `submitted`.
- `submitSkill(attemptId, skill, FormData)`:
  - Chấm **chỉ các unit của kỹ năng đó** (tách helper dùng chung với đường chấm hiện tại).
  - **Chỉ xoá + ghi lại Answer của các unit thuộc kỹ năng này** — KHÔNG đụng đáp án của
    kỹ năng khác (khác với `submitAttempt` hiện tại đang `deleteMany` toàn bộ).
  - Nghe/Đọc: tự chấm (dùng `gradeAnswer` + nhóm multi-select như cũ). Viết/Nói:
    `isCorrect = null` chờ giáo viên chấm.
  - Đặt `AttemptSkill.status = "submitted"`, `submittedAt`, `elapsedSeconds`, `score`,
    `scorePercent`.
  - Nếu **tất cả** kỹ năng đã `submitted` → hoàn tất `Attempt` (ghi tổng điểm, đặt
    `AssignmentRecipient.status = "submitted"`, `revalidatePath`, đường hoàn tất hiện có).
  - `redirect` → `/student/results/[attemptId]?skill=<skill>`.
- **Auto-timeout vẫn bị từ chối** (giữ chính sách hiện tại): hết giờ chỉ hiện "Hết giờ",
  học sinh tự bấm Nộp — tránh tab cũ tự nộp.
- Tách logic chấm thành helper `gradeUnits(units, formData)` để `submitSkill` và đường
  một-kỹ-năng dùng chung. Giữ `submitAttempt` cho trường hợp một-kỹ-năng.

## Giao diện

### Giáo viên — form giao bài
- Một ô "Thời gian làm bài" → **nhiều ô, mỗi kỹ năng một ô**, dựng từ tập kỹ năng phân
  biệt của các unit đã chọn (ví dụ `Listening: [30]`, `Reading: [60]`). Bỏ trống = kỹ
  năng đó không đếm ngược. Lưu vào `skillTimeLimitsJson`.

### Học sinh — `components/attempt-workspace.tsx`
- **Màn hình chọn kỹ năng (landing)** khi bài có > 1 kỹ năng: mỗi kỹ năng một thẻ hiển
  thị số phần, số câu, thời gian, chip trạng thái `Chưa làm` / `Đang làm` / `Đã nộp`, và
  nút `Bắt đầu` / `Tiếp tục` / `Xem kết quả`. Chọn được **bất kỳ** kỹ năng chưa nộp
  (thứ tự tự do).
- Chọn kỹ năng → gọi `startSkillSession` → vào phiên chỉ hiển thị các phần của kỹ năng
  đó (tái dùng phần render part hiện có), với **đồng hồ riêng** đọc từ `startedAt` + giới
  hạn của kỹ năng.
- Nút **Nộp [Kỹ năng]** → `submitSkill` → chuyển sang kết quả kỹ năng đó.
- **Bài một-kỹ-năng**: bỏ qua màn chọn, vào thẳng như hiện tại.

### Trang kết quả — `app/student/results/[attemptId]/page.tsx`
- Thêm lọc tuỳ chọn `?skill=<skill>`: chỉ hiện đáp án + điểm của kỹ năng đó (dùng cho xem
  kết quả tức thời). Không có tham số → trang gộp toàn bài như hiện tại (Xem lại / khi đã
  nộp hết).
- Band theo kỹ năng: một kỹ năng Nghe/Đọc đủ 40 câu nay có band riêng (cải thiện so với
  hiện tại — bài trộn nhiều kỹ năng trước đây không có band).

## Trường hợp biên

- **Attempt đang làm dở tạo trước tính năng này**: khi tải, nếu chưa có dòng
  `AttemptSkill` → seed: `submitted` nếu attempt đã nộp, ngược lại `not_started`. Không
  mất dữ liệu.
- **Gamification/celebration**: chỉ chạy khi hoàn tất toàn bài (kỹ năng cuối) — không bật
  hiệu ứng lớn sau mỗi kỹ năng. Kết quả tức thời của từng kỹ năng hiển thị gọn.
- **Reset của giáo viên** (`resetRecipientAttempts`): cascade xoá `Attempt` → `AttemptSkill`
  tự xoá theo. Không cần sửa thêm.
- **Chấm tay Viết/Nói**: `TeacherReview` vẫn một-review-mỗi-attempt như hiện tại (giới hạn
  sẵn có, không làm tệ hơn).

## Ảnh hưởng kiểm thử

- `tests/foundation.test.ts` grep `schema.prisma` cho model/field bắt buộc → thêm
  `AttemptSkill` + `skillTimeLimitsJson` sẽ cần cập nhật test có chủ đích.
- Thêm test cho `gradeUnits` (chấm theo tập unit của một kỹ năng) và cho việc `submitSkill`
  không đụng đáp án kỹ năng khác.

## Ngoài phạm vi (YAGNI)

- Không tách thành nhiều `Attempt` mỗi kỹ năng.
- Không tự động nộp khi hết giờ (giữ chính sách hiện tại).
- Không ép thứ tự làm kỹ năng.
- Không làm review riêng theo kỹ năng cho Viết/Nói (giữ một review mỗi attempt).
