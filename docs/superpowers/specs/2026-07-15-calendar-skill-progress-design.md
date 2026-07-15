# Lịch giao bài: hiện tiến độ theo từng kỹ năng

Ngày: 2026-07-15

## Vấn đề

Trang **Lịch giao bài** chỉ hiện một chữ "Đang làm dở" cho học viên chưa nộp xong,
không cho biết bạn ấy đã xong phần nào. Trang **Chi tiết học viên** lại hiện band
của phần đã nộp (vd "Nghe: Band 5.5 (20/40)"), khiến hai trang trông mâu thuẫn.

Thật ra không trang nào sai. Một `Attempt` bao cả bài tập, nhưng học sinh nộp
**theo từng kỹ năng** (`submitSkill`): mỗi lần nộp một kỹ năng thì đáp án của kỹ
năng đó được chấm và lưu ngay, còn `Attempt.status` chỉ chuyển sang `submitted`
khi kỹ năng cuối cùng được nộp. Nghe đã nộp + Đọc chưa nộp ⇒ attempt vẫn
`in_progress` ⇒ lịch hiện "Đang làm dở", trong khi chi tiết học viên đã có đáp án
Nghe để tính band.

Vậy lỗi thực sự là **trang lịch giấu thông tin**, không phải trạng thái tính sai.

## Phạm vi

Chỉ sửa cách hiển thị của trang Lịch giao bài. Không đổi database, không migration,
không đụng logic nộp/chấm.

## Thiết kế

### Hiển thị

Trong dòng học viên có attempt `in_progress`, sau chip "Đang làm dở" hiện thêm một
chip cho **mỗi kỹ năng của bài tập**, theo thứ tự IELTS (Nghe → Đọc → Viết → Nói):

| Tình trạng kỹ năng | Chip | Màu |
| --- | --- | --- |
| Đã nộp, Nghe/Đọc, đủ 40 câu | `Nghe: 20/40 · Band 5.5` | nhấn (primary) |
| Đã nộp, Nghe/Đọc, bài lẻ | `Nghe: 8/10` (không band) | nhấn (primary) |
| Đã nộp, Viết/Nói | `Viết: đã nộp · chờ chấm` | nhấn (primary) |
| Chưa nộp | `Đọc: chưa nộp` | chìm (muted) |

Dòng học viên đã nộp hết (`submitted` / `reviewed`) giữ nguyên như hiện tại: đúng
hạn/trễ hạn, thời gian làm, kết quả tổng. Badge "n/m đã nộp" ở đầu mỗi bài cũng
giữ nguyên nghĩa "nộp xong cả bài".

### Nguồn dữ liệu

Danh sách kỹ năng của bài lấy từ **các phần đã giao** (`assignment.units` →
`assignableUnit.skill`, qua `orderedSkillsOfAssignment` trong `lib/skill-sessions.ts`),
KHÔNG lấy từ `AttemptSkill`. Lý do: `ensureAttemptSkills` chỉ tạo dòng `AttemptSkill`
khi học sinh mở/nộp một kỹ năng, nên nếu lấy từ đó thì kỹ năng chưa đụng tới sẽ
biến mất khỏi danh sách — đúng chỗ ta cần hiện "chưa nộp".

Trạng thái nộp từng kỹ năng lấy từ `AttemptSkill.status`; kỹ năng không có dòng
tương ứng coi như chưa nộp.

Số câu đúng và band lấy từ `bandsBySkill(answers)` (`lib/band-score.ts`) — chỉ trả
về listening/reading, nên Viết/Nói hiện "chờ chấm".

### Chỗ đặt logic

Thêm hàm thuần `buildSkillProgress` vào `lib/assignment-calendar.ts`, ghép ba nguồn
trên thành danh sách chip:

```ts
export type CalendarSkillProgress = {
  skill: string;
  submitted: boolean;
  correct: number | null; // null = chưa nộp hoặc kỹ năng chấm tay
  total: number | null;
  band: number | null;
};

export function buildSkillProgress(
  assignmentSkills: string[],                       // đã sắp thứ tự IELTS
  attemptSkills: Array<{ skill: string; status: string }>,
  answers: Array<{ isCorrect: boolean | null; skill: string }>
): CalendarSkillProgress[];
```

Đặt ở đây vì file này đã là nơi chứa logic thuần của trang lịch (không phụ thuộc
Prisma/React) và đã có sẵn `tests/assignment-calendar.test.ts`. Component chỉ vẽ.

`CalendarAttempt` nhận thêm trường `skills: CalendarSkillProgress[]`.

### Các file đụng tới

1. `lib/assignment-calendar.ts` — thêm type + `buildSkillProgress`.
2. `lib/band-score.ts` — bổ sung `SKILL_SHORT_LABELS` cho `writing`/`speaking`
   ("Viết"/"Nói"). An toàn: `bandsBySkill` không trả về hai kỹ năng này nên chỗ
   dùng cũ không đổi.
3. `app/teacher/calendar/page.tsx` — query thêm `assignment.units.assignableUnit.skill`
   và `attempt.skills`; gọi `buildSkillProgress`.
4. `components/assignment-calendar.tsx` — vẽ chip trong `StudentRow`.
5. `tests/assignment-calendar.test.ts` — test cho `buildSkillProgress`.

### Test

Viết test trước (TDD) cho `buildSkillProgress`:

- Nghe đã nộp đủ 40 câu + Đọc chưa nộp → chip Nghe có band, chip Đọc `submitted: false`.
- Kỹ năng có trong bài nhưng không có dòng `AttemptSkill` → coi như chưa nộp.
- Nghe bài lẻ 10 câu → `band: null`, vẫn có `correct`/`total`.
- Viết đã nộp → `submitted: true`, `correct`/`total`/`band` đều `null`.
- Thứ tự chip theo thứ tự kỹ năng truyền vào.

## Không làm (YAGNI)

- Không thêm chip theo kỹ năng cho dòng đã nộp hết.
- Không đổi badge "n/m đã nộp".
- Không thêm khái niệm "nộp một phần" vào `Attempt.status` hay `AssignmentRecipient.status`.
