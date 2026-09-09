# Xử lý nộp bài trễ hạn

Ngày: 2026-09-09

## Vấn đề

Hạn nộp (`Assignment.deadline`) hiện chỉ để hiển thị. Không có chỗ nào trong
code chặn hay ghi nhận việc nộp muộn:

- `startAttempt` / `submitSkill` (`lib/actions/attempts.ts`) không đọc `deadline`.
- Công thức xếp hạng (`lib/ranking.ts`) chỉ nhìn điểm trung bình, tỉ lệ hoàn
  thành và hoạt động gần đây — nộp trễ vẫn được tính là `submitted`, cộng đủ
  vào tỉ lệ hoàn thành.
- Học viên không thấy dấu hiệu nào cho biết mình đang làm bài quá hạn.

Chỗ duy nhất đang ghi nhận là hàng đợi Chấm bài của giáo viên
(`isSubmissionLate` ở `lib/assignment-calendar.ts`).

## Phạm vi

Ba mức, làm cả ba:

1. Cảnh báo quá hạn cho học viên (không chặn).
2. Đánh dấu lượt nộp trễ ở trang kết quả và lịch sử.
3. Trừ điểm xếp hạng: bài nộp trễ chỉ được nửa điểm hoàn thành.

Không đụng schema. "Nộp trễ" suy ra từ dữ liệu sẵn có: có `deadline` **và**
`submittedAt > deadline`. Không cần migration, không đụng `scripts/ensure-db.mjs`.

## Nền tảng chung: `lib/late-submission.ts`

Tách `isSubmissionLate` khỏi `lib/assignment-calendar.ts` (module lịch của giáo
viên, 600+ dòng, kéo theo `band-score` và `skills`) sang một file logic thuần
nhỏ, để `lib/student-score.ts` dùng được mà không kéo cả module lịch vào đường
tính điểm xếp hạng. `assignment-calendar.ts` import lại từ file mới và
re-export, nên trang Chấm bài của giáo viên không phải sửa gì.

File giữ hai hàm:

```ts
// Nộp trễ hạn? Chỉ đúng khi có cả mốc nộp lẫn hạn và nộp sau hạn.
isSubmissionLate(submittedAt: string | Date | null, deadline: string | Date | null): boolean

// Trọng số của một bài giao trong Tỉ lệ hoàn thành.
// Đúng hạn (hoặc bài không đặt hạn) = 1, nộp trễ = 0.5, chưa nộp = 0.
completionWeight(input: {
  status: string;
  submittedAt: Date | null;
  deadline: Date | null;
}): number
```

Hằng số `LATE_COMPLETION_WEIGHT = 0.5` đặt ở đây — muốn đổi mức phạt chỉ sửa
đúng một chỗ.

## Mức 1 — Cảnh báo quá hạn

Không có màn hình "trước khi bắt đầu": bấm vào bài là `startAttempt` chạy ngay
và vào thẳng phòng thi. Nên cảnh báo đặt ở **thẻ bài** trên trang Tổng quan
(`app/student/page.tsx`), đúng chỗ có nút Bắt đầu.

- Bài **chưa nộp + đã quá hạn**: chip trạng thái đổi từ "Chưa làm" (xám) thành
  **"Quá hạn"** (đỏ).
- Dòng "Hạn nộp: …" chuyển sang chữ đỏ, kèm dòng phụ:
  *"Đã quá hạn — nộp bây giờ sẽ tính là nộp trễ và chỉ được nửa điểm hoàn thành."*
- Bài **đã nộp trễ**: chip **"Đã nộp (trễ)"** màu hổ phách.

Không chặn, không hộp xác nhận. Lịch giao bài đã có `deadlineState()` nên
không sửa.

## Mức 2 — Đánh dấu lượt nộp trễ

- `app/student/results/[attemptId]/page.tsx`: chip "Nộp trễ" cạnh tên bài. Phải
  thêm `assignment.deadline` vào query.
- `app/student/history/page.tsx`: chip "Nộp trễ" trên từng dòng lịch sử. Phải
  thêm `assignment.deadline` vào query.
- Phía giáo viên không sửa — hàng đợi Chấm bài đã có nhãn và bộ lọc "Nộp trễ".

Chip dùng chung một component nhỏ để hai trang không lệch màu/chữ.

## Mức 3 — Trừ điểm xếp hạng

`completionRateOf` (`lib/student-score.ts`) đang đếm đầu người:
`submitted`/`reviewed` = 1, còn lại = 0. Đổi sang cộng trọng số qua
`completionWeight`:

| Tình huống | Trọng số |
| --- | --- |
| Nộp đúng hạn, hoặc bài không đặt hạn nộp | 1.0 |
| Nộp sau hạn | 0.5 |
| Chưa nộp | 0 |

Điểm bài làm (70%) và hoạt động gần đây (10%) giữ nguyên. Chỉ Tỉ lệ hoàn thành
(20%) bị ảnh hưởng, nên mức phạt tối đa là 10 điểm xếp hạng khi trễ toàn bộ.

Ví dụ: điểm trung bình 78%, làm đủ 10/10 bài, học đều.

| | Tỉ lệ hoàn thành | Điểm xếp hạng | Bậc |
| --- | --- | --- | --- |
| Đúng hạn cả 10 bài | 100% | 85 | Kim Cương |
| Trễ 4 bài | 80% | 81 | Bạch Kim |
| Trễ cả 10 bài | 50% | 75 | Bạch Kim |

### Đổi kiểu dữ liệu kéo theo

`studentRankingScore` nhận `statuses: string[]`, nay cần thêm mốc nộp và hạn:

```ts
export type CompletionInput = {
  status: string;
  submittedAt: Date | null;
  deadline: Date | null;
};
```

Các nơi phải sửa:

- `lib/student-score.ts`: `studentRankingScore` (`statuses` -> `completions`),
  `rankingScoreFromRecipientsAndAttempts` (`recipientStatuses` -> `recipients`).
- `lib/class-ranking.ts`: `ClassmateRow.recipients` thêm `deadline`; `scoreAt`
  dựng `CompletionInput`; truy vấn `recipients` trong `getClassRanking` select
  thêm `assignment: { select: { deadline: true } }`.
- `app/student/page.tsx`: đã có sẵn `deadline` và `submittedAt` (dùng `include`),
  chỉ đổi cách truyền.
- `app/student/profile/page.tsx` và `app/student/profile/[studentId]/page.tsx`:
  select thêm `submittedAt` và `assignment.deadline`.

Ảnh chụp 7 ngày trước (`positionsAt`) dùng đúng luật này, nên mũi tên tăng/giảm
hạng vẫn nhất quán: lúc dựng lại trạng thái cũ, bài nộp sau mốc `cutoff` coi
như chưa nộp; bài đã nộp trước `cutoff` vẫn so `submittedAt` với `deadline` như
thường.

### Bảng xếp hạng

`RankedClassStudent` thêm `lateCount: number`. Phần chi tiết của
`components/class-ranking-board.tsx` hiện thêm dòng *"trong đó N bài nộp trễ"*
dưới Tỉ lệ hoàn thành, để học viên hiểu vì sao con số không tròn. Không hiện gì
khi `lateCount = 0`.

## Kiểm thử

- `tests/late-submission.test.ts` (mới): `isSubmissionLate` (thiếu mốc, đúng
  hạn, đúng khoảnh khắc hạn, trễ) và `completionWeight` (4 nhánh).
- `tests/student-score.test.ts`: thêm ca nộp trễ được 0.5; sửa các ca hiện có
  sang kiểu `CompletionInput`.
- `tests/class-ranking.test.ts`: thêm `deadline` vào fixture; thêm ca hai học
  viên cùng điểm nhưng một người nộp trễ thì xếp dưới.
- `tests/ranking.test.ts`: không đổi — công thức 70/20/10 giữ nguyên.

## Rủi ro

Luật có **hiệu lực hồi tố**: tính từ dữ liệu cũ chứ không phải cờ lưu sẵn. Ngay
khi deploy, học viên từng nộp trễ sẽ tụt điểm xếp hạng và có thể tụt bậc. Đây
là lựa chọn có chủ ý — muốn chỉ áp dụng từ nay trở đi thì phải thêm mốc ngày
vào `completionWeight`.
