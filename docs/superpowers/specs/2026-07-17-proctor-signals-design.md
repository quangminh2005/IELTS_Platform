# Ghi nhận hành vi đáng ngờ khi làm bài (Ctrl+F, rời tab)

- **Ngày:** 2026-07-17
- **Nhánh:** feature/ielts-platform-mvp
- **Trạng thái:** Đã chốt thiết kế, chờ lập kế hoạch triển khai

## Vấn đề

Khi làm bài Reading trên web, học viên nhấn **Ctrl+F** để tìm từ khoá trong đoạn văn thay vì
đọc hiểu — một lợi thế lớn ở các dạng câu hỏi chi tiết (sentence completion, matching
features). Đề bài đang được render thành text thật trong `<p>`
([`attempt-workspace.tsx`](../../../components/attempt-workspace.tsx), khoảng dòng 231) nên
ô tìm kiếm của trình duyệt khớp chữ bình thường.

Kỳ thi IELTS trên máy tính thật chặn được việc này vì nó là **phần mềm desktop khoá máy**.
Trên web thì **không thể chặn tuyệt đối** (xem mục *Giới hạn đã biết*). Vì vậy mục tiêu của
tính năng này **không phải chặn**, mà là **cho giáo viên thấy dấu hiệu** để hỏi lại học viên.

## Quyết định (đã hỏi giáo viên)

1. **Chỉ phát hiện, không chặn.** Không gọi `preventDefault`, không hiện cảnh báo cho học
   viên, không đụng vào trải nghiệm làm bài. Ô tìm kiếm vẫn mở ra như thường.
2. **Ghi log hai tín hiệu:** nhấn `Ctrl+F` / `F3`, và rời tab / chuyển cửa sổ.
   *Không* làm phần copy chữ và dán vào ô trả lời (YAGNI — có thể thêm sau nếu cần).
3. **Hiển thị:** số đếm ở trang kết quả của từng bài, **cộng** dấu cờ ⚠ cạnh tên học viên ở
   **cả ba** danh sách: lịch giao bài, trang từng học viên, hàng đợi chấm bài.
4. **Ngưỡng bật cờ:** bất kỳ tín hiệu nào **≥ 1**.
5. **Chống báo động giả:** rời tab chỉ được tính khi **rời quá 2 giây**. Thông báo nhảy lên
   rồi tắt trong tích tắc không bị tính; mở Google tra từ thì chắc chắn lâu hơn 2 giây. Đây
   là cách giữ được ngưỡng ≥ 1 mà vẫn không đếm rác.
6. **Không xây bảng cài đặt ngưỡng** (YAGNI) — ngưỡng cố định trong code.
7. **Không làm dòng thời gian chi tiết** (timeline có mốc giờ + thời lượng) — chỉ hai số đếm.

## Nguyên tắc kiến trúc

Tận dụng tối đa thứ đã có, **không thêm server action mới, không thêm bảng mới**:

- Trang làm bài đã có **heartbeat** [`saveAttemptDraft`](../../../lib/actions/attempts.ts)
  chạy theo nhịp `setInterval` ([`attempt-workspace.tsx`](../../../components/attempt-workspace.tsx),
  khoảng dòng 1782) để lưu `elapsedSeconds`. Số đếm gửi ké vào chính heartbeat đó.
- Schema đã có sẵn cột **`Attempt.tabSwitchCount`** ([`schema.prisma`](../../../prisma/schema.prisma)
  dòng 192) — là **cột chết**: có trong schema, có trong `tests/foundation.test.ts`, nhưng
  **không dòng code nào ghi vào nó** nên luôn bằng 0. Kế hoạch gốc 2026-06-25 có định làm rồi
  bỏ dở. Thiết kế này **hồi sinh** cột đó thay vì tạo cột mới.
- Logic thuần tách ra file riêng để test được, theo đúng kiểu
  [`lib/active-time.ts`](../../../lib/active-time.ts) đang làm.

## Mô hình dữ liệu

Hai cột trên `Attempt` (cấp bài làm, **không** tách theo kỹ năng — khớp với chỗ
`tabSwitchCount` đã nằm sẵn):

| Cột | Kiểu | Ý nghĩa |
| --- | --- | --- |
| `tabSwitchCount` | `Int @default(0)` | Số lần rời tab quá 2 giây. **Đã có sẵn**, không cần đổi schema. |
| `findAttemptCount` | `Int @default(0)` | Số lần nhấn `Ctrl+F` / `Cmd+F` / `F3`. **Cột mới.** |

**Bắt buộc:** thêm cột mới vào [`scripts/ensure-db.mjs`](../../../scripts/ensure-db.mjs) —
dự án dùng `db push` không có migrations, script này chạy lúc build và là **cách duy nhất**
để cột xuất hiện trên DB production. Quên bước này thì prod sập.

```sql
ALTER TABLE "Attempt" ADD COLUMN IF NOT EXISTS "findAttemptCount" INTEGER NOT NULL DEFAULT 0;
-- Thêm cả tabSwitchCount cho chắc: idempotent, phòng trường hợp prod chưa có
ALTER TABLE "Attempt" ADD COLUMN IF NOT EXISTS "tabSwitchCount" INTEGER NOT NULL DEFAULT 0;
```

## Logic thuần: `lib/proctor-signals.ts`

File mới, không phụ thuộc React/Prisma, để vitest test trực tiếp.

- `isFindShortcut(event)` — nhận diện `Ctrl+F`, `Cmd+F` (macOS), `F3`.
- `TAB_AWAY_MIN_MS = 2000` — mốc tối thiểu để tính một lần rời tab.
- `shouldCountTabAway(awayMs)` — `awayMs >= TAB_AWAY_MIN_MS`.
- `hasProctorFlag({ tabSwitchCount, findAttemptCount })` — `true` khi một trong hai `>= 1`.
- `mergeCount(current, incoming)` — `Math.max`, chặn giá trị âm và `NaN`.

## Bắt tín hiệu (client)

Chỉ gắn trong trang làm bài của **học viên**. **Không** gắn ở phòng xem trước của giáo viên
(`/teacher/materials/[materialId]/preview`) — giáo viên tự xem đề của mình, đếm là vô nghĩa.

- **`keydown` trên `window`:** nếu `isFindShortcut(event)` → tăng biến đếm trong `useRef`.
  **Không** `preventDefault` — ô tìm kiếm vẫn mở, học viên không biết mình bị ghi nhận.
- **`visibilitychange` trên `document`:** khi `document.hidden` → ghi mốc `Date.now()`. Khi
  quay lại → nếu `shouldCountTabAway(Date.now() - mốc)` thì tăng biến đếm.
- Hai biến đếm nằm trong `useRef` (không phải `useState`) — không cần render lại, và không
  hiện gì lên màn hình học viên.
- Gửi lên server qua **hidden input** trong form heartbeat sẵn có + form nộp bài, giống hệt
  cách `elapsedSeconds` đang làm (`attempt-workspace.tsx` dòng 1733 và 2040).

## Ghi vào DB (server)

Trong `saveAttemptDraft` và `submitSkill`:

- Zod parse: `z.coerce.number().int().min(0).default(0)` cho cả hai số.
- Ghi bằng **`Math.max(giá trị trong DB, giá trị client gửi lên)`** — giống cách
  `elapsedSeconds` đang xử lý (`attempts.ts` dòng 260, 458). Số đếm **chỉ tăng**, nên
  heartbeat đến trễ / lộn xộn / gửi lại đều không làm mất số.

## Hiển thị cho giáo viên

### Trang kết quả (số đếm đầy đủ)

**[`app/teacher/results/[attemptId]/page.tsx`](../../../app/teacher/results/[attemptId]/page.tsx):**
thêm một dòng gọn cạnh thời gian làm bài — `Rời tab: 3 lần · Thử Ctrl+F: 5 lần`. Khi cả hai
bằng 0 thì hiện `Không ghi nhận dấu hiệu bất thường`.

### Ba danh sách (cờ ⚠)

Cả ba đều hiện ⚠ cạnh tên học viên khi `hasProctorFlag(...)`, kèm `title`/tooltip nói rõ số
đếm để không phải mở bài mới biết. Dùng chung **một component** `ProctorFlag` để ba chỗ không
lệch nhau.

| Trang | Chỗ đặt | Ghi chú |
| --- | --- | --- |
| [`components/assignment-calendar.tsx`](../../../components/assignment-calendar.tsx) | Thêm thẻ vào hàng thẻ sẵn có trong `StudentRow` (khoảng dòng 302, `mt-2 flex flex-wrap gap-1.5`), cạnh thẻ "nộp trễ"/điểm | **Quan trọng nhất** — đây là chỗ **duy nhất** hiện bài Reading và có link `Xem bài →` |
| [`app/teacher/students/[studentId]/page.tsx`](../../../app/teacher/students/[studentId]/page.tsx) | Trong danh sách các lần làm bài (khoảng dòng 202) | Xem một học viên có lặp lại hành vi qua nhiều bài không |
| [`app/teacher/review/page.tsx`](../../../app/teacher/review/page.tsx) → [`components/review-queue.tsx`](../../../components/review-queue.tsx) | Cạnh tên học viên trong hàng đợi | **Chỉ có tác dụng với Writing/Speaking** — trang này lọc `skill: { in: ["writing", "speaking"] }` nên bài Reading thuần không bao giờ xuất hiện ở đây |

**Cạm bẫy — nằm ở tầng DTO, không phải tầng truy vấn.** Cả bốn trang đều query Attempt bằng
`include:` (không phải `select:`), nên Prisma **tự trả về mọi cột scalar** — hai cột mới có
sẵn, **không cần sửa truy vấn**. Chỗ làm rơi dữ liệu là các **lớp map sang DTO**:

- `app/teacher/calendar/page.tsx` map thủ công sang `CalendarAttempt` (khoảng dòng 105–115) →
  phải thêm hai trường, **và** thêm vào type `CalendarAttempt` trong
  [`lib/assignment-calendar.ts`](../../../lib/assignment-calendar.ts) (dòng ~19).
- `app/teacher/review/page.tsx` map thủ công sang `rows` (khoảng dòng 53–70) → phải thêm hai
  trường, **và** thêm vào type `Row` trong [`components/review-queue.tsx`](../../../components/review-queue.tsx) (dòng ~8).
- `app/teacher/students/[studentId]/page.tsx` và `app/teacher/results/[attemptId]/page.tsx`
  dùng thẳng object Prisma, **không có DTO** → không cần đụng gì thêm.

Sót chỗ nào thì cờ ở đó **im lặng không hiện** chứ không báo lỗi (TypeScript sẽ bắt được nếu
type được khai đúng — đó là lý do phải sửa type trước).

### Văn phong

Chữ hiển thị phải **trung tính**, mô tả hành vi chứ không kết tội: "Thử Ctrl+F", không phải
"Gian lận". Xem mục *Giới hạn đã biết* để hiểu vì sao.

## Kiểm thử

- **Unit (vitest, `tests/proctor-signals.test.ts`):** `isFindShortcut` đúng với Ctrl+F/Cmd+F/F3
  và sai với phím khác; `shouldCountTabAway` ở mốc 1999ms / 2000ms / 2001ms; `hasProctorFlag`
  ở 0/0, 1/0, 0/1; `mergeCount` không bao giờ giảm.
- **`tests/foundation.test.ts`:** phải thêm `findAttemptCount` vào danh sách cột của `Attempt`
  (dòng ~54) — test này grep `schema.prisma`, không thêm là fail.

## Giới hạn đã biết

Ba giới hạn dưới đây **không phải thiếu sót cần sửa sau** — chúng là bản chất của việc chấm
thi trên web, và quyết định giáo viên nên tin con số này đến đâu.

1. **Mở Find qua menu ⋮ của trình duyệt thì `findAttemptCount` vẫn là 0.** Trình duyệt không
   phát ra sự kiện nào, JavaScript không có API nào biết ô tìm kiếm đang mở hay đang khớp
   chữ gì. Tính năng bắt được **phản xạ** Ctrl+F (phần lớn học viên), nhưng ai biết mẹo này
   là vô hình. Nghịch lý: tính năng hiệu quả nhất khi học viên **không biết** nó tồn tại.
2. **Học viên mở bài đọc trên điện thoại bên cạnh thì không có tín hiệu gì.** Đây là lỗ hổng
   lớn nhất và không có tính năng web nào bịt được.
3. **Số đếm do trình duyệt học viên tự khai**, nên học viên rành kỹ thuật sửa được (devtools,
   chặn heartbeat). `Math.max` chỉ chống được việc hạ số đã lưu, không chống được việc không
   gửi.

Vì vậy: đây là **manh mối để hỏi lại học viên**, **không phải bằng chứng để kết luận gian
lận**.

Ngoài ra, các bài **đã nộp trước khi có tính năng này** sẽ hiện `0 lần` chứ không phải "không
có dữ liệu" (cột `Int` mặc định 0, không phân biệt được). Giáo viên đã chấp nhận đánh đổi này
để không phải thêm cột nullable.

## Ngoài phạm vi (YAGNI)

- Chặn Ctrl+F, chặn chuột phải, chặn copy.
- Làm chữ không tìm được (chèn ký tự vô hình / tách span) — sẽ phá tính năng highlight
  ([`highlight-layer.tsx`](../../../components/highlight-layer.tsx) định vị bằng
  `startOffset`/`endOffset` trên text thật), phá bôi đen chọn chữ, phá screen reader.
- Ghi log copy chữ và dán vào ô trả lời.
- Dòng thời gian chi tiết có mốc giờ + thời lượng rời tab.
- Bảng cài đặt ngưỡng cho giáo viên.
- Ép toàn màn hình, phát hiện devtools.
