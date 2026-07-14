# Thiết kế: Dẫn chứng đọc "live" từ câu hỏi (giáo viên sửa là bài cũ đổi theo)

Ngày: 2026-07-14
Nhánh: `feature/ielts-platform-mvp`

## Mục tiêu

Cho giáo viên nhập ô **"Dẫn chứng (đoạn chứa đáp án)"** rồi **bài đã nộp cũ hiện ngay**
chỗ tô tương ứng — không phải cho học sinh làm lại. Giải quyết ca thực tế: câu trắc
nghiệm đáp án diễn giải lại (vd Listening Part 3, Câu 23/24 "to experience an isolated
place" trong khi transcript nói "a small island... harsh weather") — không dò tự động
được, chỉ giáo viên mới chỉ đúng câu dẫn chứng.

## Bối cảnh (đã khảo sát)

- **Ô nhập đã tồn tại sẵn**, không cần làm mới: `components/question-fields.tsx:398-409`
  có textarea `name="answerEvidence"` nhãn "Dẫn chứng (đoạn chứa đáp án)", hiện cho **mọi
  loại câu**. Luồng lưu đủ: zod `lib/actions/materials.ts:73` → đọc form `:439`/`:491` →
  lưu `:472`/`:532`. Sửa câu tự điền lại: `app/teacher/materials/page.tsx:609`.
  Import JSON cũng nhận `question.evidence` (`materials.ts:583` → `:798`).
- **Vấn đề:** dẫn chứng bị **đông cứng lúc chấm**. `lib/attempt-grading.ts:77-83`:
  `evidenceFor = question.answerEvidence ?? deriveAnswerEvidence(...)` → chụp vào
  `Answer.evidenceSnapshot` ngay lúc học sinh nộp. Điền `answerEvidence` sau đó **không**
  tác động tới bài đã nộp.
- **Transcript cột trái vốn đã đọc live**: `components/result-review.tsx` lấy
  `unit.transcript`/`unit.content` từ `assignableUnit` (không phải bản chụp). Nên để dẫn
  chứng cũng live là **nhất quán hơn** hiện tại, không phải lệch chuẩn.
- Truy vấn 2 trang kết quả **chưa** lấy `answerEvidence`:
  - `app/student/results/[attemptId]/page.tsx:61-67` — `question: { select: { order, prompt, points } }`
  - `app/teacher/results/[attemptId]/page.tsx:47-49` — `question: { select: { order: true, prompt: true, points: true } }`
- `lib/answer-evidence.ts` đã có `buildEvidenceTargets(items, filledSource)` với 2 nhánh:
  có `evidenceSnapshot` → dùng; chưa có → dò từ khóa đáp án. `buildEvidenceSegments` định
  vị câu dẫn chứng bằng `filledSource.indexOf(fillSourceBlanks(evidence, answersByOrder))`
  — **khớp nguyên văn**; không khớp thì âm thầm bỏ đích (thẻ trơ, không báo gì).

## Quyết định thiết kế (đã thống nhất với người dùng)

1. **Ba tầng ưu tiên**, lấy tầng đầu tiên **định vị được nguyên văn** trong transcript:
   1. `question.answerEvidence` (live, giáo viên nhập)
   2. `Answer.evidenceSnapshot` (chụp lúc chấm — giữ để không hồi quy câu điền từ)
   3. Dò từ khóa đáp án (cơ chế hiện có cho trắc nghiệm)
   Không tầng nào ra → thẻ trơ (như hiện tại).
2. **Giáo viên nhập sai khớp → tự lùi tầng sau** (không phải thẻ trơ ngay). Nhờ vậy tính
   năng không bao giờ tệ hơn hiện tại. Kèm **dòng gợi ý** dưới ô nhập để phòng lỗi.
3. **Sửa dẫn chứng → kết quả cũ hiện bản mới nhất** (không phải bản lúc chấm) — nhất quán
   với transcript vốn đã live.
4. Chấp nhận **thêm 1 field vào `question.select`** ở 2 trang kết quả (thay đổi truy vấn
   duy nhất). Không đổi schema, chấm điểm, `buildEvidenceSegments`, render/cuộn/badge.

## Kiến trúc

### 1. Truy vấn — 2 trang kết quả

Thêm `answerEvidence: true` vào `question.select`:
- `app/student/results/[attemptId]/page.tsx` → `select: { order, prompt, points, answerEvidence }`
- `app/teacher/results/[attemptId]/page.tsx` → `select: { order: true, prompt: true, points: true, answerEvidence: true }`

(Trang `app/teacher/review/[attemptId]/page.tsx` là giao diện **chấm bài**, dùng component
khác và không có transcript → **không đụng**.)

### 2. `components/result-review.tsx`

- Type `Answer.question` thêm `answerEvidence: string | null`.
- Khi `part.answers.push({...})` thêm: `questionEvidence: answer.question?.answerEvidence ?? null`.

### 3. `components/result-answers.tsx`

- `PartAnswer` thêm `questionEvidence: string | null` (tách bạch với `evidenceSnapshot`
  sẵn có: một cái live, một cái chụp).
- Chỗ gọi đổi thành `buildEvidenceTargets(part.answers, filledSource, part.answersByOrder)`.
- Không đổi gì khác.

### 4. `lib/answer-evidence.ts` — `buildEvidenceTargets`

Đổi chữ ký (thêm `answersByOrder` để fill `[[n]]` khi kiểm tra định vị):

```ts
export type EvidenceTargetInput = {
  order: number | null;
  questionEvidence: string | null;   // MỚI — live từ Question.answerEvidence
  evidenceSnapshot: string | null;
  correctAnswerSnapshot: string | null;
};

export function buildEvidenceTargets(
  items: EvidenceTargetInput[],
  filledSource: string,
  answersByOrder: Record<number, string>
): EvidenceTarget[];
```

Logic mỗi item (`order !== null`):
- `keywords = answerKeywords(correctAnswerSnapshot)`.
- Duyệt ứng viên `[questionEvidence, evidenceSnapshot]` theo thứ tự; với mỗi cái khác rỗng:
  `filled = fillSourceBlanks(candidate, answersByOrder).trim()`; nếu
  `filledSource.includes(filled)` → đẩy đích `{ order, evidence: candidate, answers: keywords }`
  rồi **dừng** item này.
- Không ứng viên nào định vị được → **dò từ khóa** như hiện tại: mỗi keyword
  `isSearchableKeyword` mà `findEvidenceSentence(filledSource, [keyword])` ra câu → đẩy
  một đích cùng `order`.

Điểm mới then chốt: **kiểm tra `includes` trước khi chọn tầng** — trước đây nhánh
`evidenceSnapshot` chọn xong là `continue`, nên snapshot không khớp = mất luôn cơ hội dò
từ khóa. Giờ mọi tầng đều phải "định vị được" mới thắng.

### 5. `components/question-fields.tsx`

Dưới textarea `answerEvidence`, thêm dòng gợi ý (chỉ hiển thị, không đổi form):

> Dán nguyên văn một câu từ transcript/bài đọc để hệ thống tô đúng chỗ.

## Phạm vi loại trừ (YAGNI)

- Không đổi `lib/attempt-grading.ts` (vẫn chụp `evidenceSnapshot` lúc chấm — tầng 2 vẫn
  hữu ích, và không đụng chấm điểm).
- Không khớp mờ/chuẩn hoá khoảng trắng cho câu giáo viên nhập — sai khớp thì lùi tầng.
- Không báo lỗi/không phản hồi trong giao diện soạn bài khi dẫn chứng không khớp — chỉ có
  dòng gợi ý phòng ngừa.
- Không đụng trang chấm bài của giáo viên, Writing/Speaking, import.

## Kiểm thử

`tests/answer-evidence.test.ts` — cập nhật các case `buildEvidenceTargets` sẵn có cho chữ
ký mới, và bổ sung:
- `questionEvidence` định vị được → thắng `evidenceSnapshot` (đích dùng câu của giáo viên).
- `questionEvidence` **không** khớp nguyên văn → lùi sang `evidenceSnapshot` nếu cái này khớp.
- Cả `questionEvidence` lẫn `evidenceSnapshot` đều không khớp → lùi về dò từ khóa (vẫn ra đích).
- Không có ứng viên nào + từ khóa không dò ra → không đích.
- `evidenceSnapshot` chứa `[[n]]`, `answersByOrder` điền vào thì khớp → vẫn chọn tầng 2
  (chứng minh việc fill trước khi `includes`).

Không cần đụng test cấu trúc: đã kiểm, không test nào grep `question.select` của trang
kết quả (`tests/teacher-calendar.test.ts:21` chỉ assert file tồn tại).

`pnpm test` + `pnpm build` xanh. Kiểm thử thật (người dùng, trên bản deploy): mở bài
Listening Part 3 → Câu 23 chưa bấm được; vào soạn bài dán nguyên văn câu
*"Olivia: Oh right. After university, he married a classmate, and together they decided to
experience living on a small island to find out how harsh weather conditions shaped
people's lifestyles."* vào ô "Dẫn chứng" của Câu 23 → quay lại đúng trang kết quả cũ (không
làm lại bài) → Câu 23 bấm được, tô đúng câu đó.

## Ảnh hưởng dữ liệu cũ

- Không có `answerEvidence` (đa số câu hiện tại) → rơi tầng 2/3 → **y hệt hành vi hiện tại**.
- Câu điền từ: `answerEvidence` thường trống → tầng 2 (`evidenceSnapshot`) → không hồi quy.
- Bài đã nộp: hưởng lợi ngay khi giáo viên điền dẫn chứng, không cần chấm lại.
