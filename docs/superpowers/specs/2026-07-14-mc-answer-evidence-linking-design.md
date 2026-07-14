# Thiết kế: Mở rộng liên kết Câu hỏi ↔ Transcript cho câu trắc nghiệm

Ngày: 2026-07-14
Nhánh: `feature/ielts-platform-mvp`

## Mục tiêu

Trang kết quả hiện đã cho **click câu điền từ** để tô câu dẫn chứng trong transcript
(tính năng ngày 2026-07-13). Mở rộng để **câu trắc nghiệm cũng bấm được** khi **từ khóa
đáp án đúng** xuất hiện nguyên văn trong transcript — vì hiện các part toàn trắc nghiệm
(vd Listening Part 3) không câu nào bấm được, gây khó đối chiếu.

## Bối cảnh (đã khảo sát)

- Đáp án đúng câu trắc nghiệm được lưu **kèm nhãn phương án**: `correctAnswerJson` =
  `["B. climbing", "C. collecting"]` → `correctAnswerSnapshot` = `"B. climbing | C. collecting"`
  (đã có sẵn trong `PartAnswer`, không cần đổi truy vấn). Xác nhận từ `tmp/ielts_master_listening.json`
  (Part 3 – Thor Heyerdahl) và luồng `answerSnapshot` trong `lib/attempt-grading.ts`.
- `evidenceSnapshot` (câu dẫn chứng) chỉ **khác null** cho câu điền từ (`deriveAnswerEvidence`
  gate theo `LITERAL_ANSWER_TYPES`) hoặc do giáo viên tự nhập. Câu trắc nghiệm → `null`.
  Vì vậy gate hiện tại của UI ("có evidenceSnapshot") loại hết câu trắc nghiệm.
- `components/result-answers.tsx` dựng `targets` (mảng `EvidenceTarget`) tại
  `result-answers.tsx:215-221` bằng cách lọc `answer.evidenceSnapshot`, rồi gọi
  `buildEvidenceSegments(filledSource, targets, part.answersByOrder)` (Task trước, không đổi).
- `lib/answer-evidence.ts` đã có: `deriveAnswerEvidence` (tách câu + tìm câu chứa đáp án),
  `answerRegExp`, `buildEvidenceSegments`, `EvidenceTarget`/`EvidenceSegment`.

## Quyết định thiết kế (đã thống nhất với người dùng)

1. Tìm dẫn chứng câu trắc nghiệm bằng **từ khóa đáp án**: bóc bỏ nhãn phương án
   (`"B. climbing"` → `"climbing"`) rồi tìm câu chứa nó trong transcript.
2. Câu "chọn NHIỀU đáp án" (vd 21/22 lưu cả hai `climbing`+`collecting`): click tô
   **tất cả** các câu chứa từng đáp án tìm được.
3. Câu **không tìm được** dẫn chứng (đáp án diễn giải lại như 23/24; True/False/NG;
   matching chỉ có chữ cái) → **không bấm được** (giữ nguyên). Không tô bừa.
4. **Ưu tiên nguồn dẫn chứng để không hồi quy:** còn `evidenceSnapshot` thì dùng nó
   (câu điền từ tự sinh, hoặc giáo viên nhập); chưa có mới thử bóc từ khóa đáp án.
5. **Không đổi** schema / truy vấn / chấm điểm. Chạy được ngay với bài đã nộp cũ.

## Kiến trúc

### 1. Helper thuần mới/refactor — `lib/answer-evidence.ts`

**a. Tách `findEvidenceSentence`** (rút lõi của `deriveAnswerEvidence`, bỏ gate loại câu):

```ts
// Trả câu trong sourceText chứa (nguyên văn, ranh giới từ, không phân biệt hoa/thường)
// một trong các answers; ưu tiên answer dài nhất. Không thấy -> null.
export function findEvidenceSentence(sourceText: string | null, answers: string[]): string | null;
```

`deriveAnswerEvidence` giữ nguyên chữ ký + hành vi, chỉ gọi lại helper này:

```ts
export function deriveAnswerEvidence(questionType, correctAnswers, sourceText) {
  if (!sourceText || !LITERAL_ANSWER_TYPES.has(questionType)) return null;
  return findEvidenceSentence(sourceText, correctAnswers);
}
```

**b. Bóc từ khóa đáp án:**

```ts
// Tách "correctAnswerSnapshot" ("a | b") thành từng đáp án, bỏ nhãn phương án đầu
// ("A. "/"b) ") và khoảng trắng thừa. Dùng để tô đậm & làm mồi tìm kiếm.
export function answerKeywords(correctAnswerSnapshot: string | null): string[];
```

- Tách theo `" | "`; mỗi phần `replace(/^[A-Za-z][.)]\s+/, "")` để bỏ nhãn; `trim`; bỏ rỗng.
- `"B. climbing | C. collecting"` → `["climbing", "collecting"]`; `"power companies"` →
  `["power companies"]`; `"12"` → `["12"]`.

**c. Dựng danh sách đích cho một part:**

```ts
export type EvidenceTargetInput = {
  order: number | null;
  evidenceSnapshot: string | null;
  correctAnswerSnapshot: string | null;
};

export function buildEvidenceTargets(
  items: EvidenceTargetInput[],
  filledSource: string
): EvidenceTarget[];
```

Với mỗi item (`order !== null`):
- `keywords = answerKeywords(correctAnswerSnapshot)`.
- **Có `evidenceSnapshot` (trim khác rỗng):** đẩy 1 đích `{ order, evidence: evidenceSnapshot,
  answers: keywords }`. (Câu điền từ + câu giáo viên nhập — như cũ; `keywords` để tô đậm.)
- **Chưa có:** với **mỗi** từ khóa **tìm-kiếm-được** (loại token nhãn đúng/sai
  `true/false/not given/yes/no/ng` và token < 2 ký tự chữ-số — tránh tô bừa), tìm
  `findEvidenceSentence(filledSource, [keyword])`; thấy thì đẩy đích
  `{ order, evidence: câu-đó, answers: [keyword] }`. Không thấy → bỏ.

`buildEvidenceSegments` **không đổi**: nó điền `[[n]]` (no-op ở đây), định vị câu dẫn
chứng bằng `indexOf` trong `filledSource` (câu vừa tìm chính là chuỗi con của
`filledSource` nên chắc chắn khớp), và tô đậm từ khóa bên trong. Nhiều đích cùng `order`
→ nhiều câu cùng badge (thoả mãn câu "chọn nhiều đáp án").

### 2. `components/result-answers.tsx`

Thay khối dựng `targets` (`result-answers.tsx:215-221`) bằng một dòng:

```ts
const targets = buildEvidenceTargets(part.answers, filledSource);
```

`part.answers` (kiểu `PartAnswer`) đã có `order`, `evidenceSnapshot`, `correctAnswerSnapshot`
— khớp `EvidenceTargetInput`. Mọi thứ khác (render, tô, cuộn, badge, gate `linkedSet`,
thẻ bấm được) **giữ nguyên**. Import thêm `buildEvidenceTargets`.

## Phạm vi loại trừ (YAGNI)

- Không khớp mờ/ngữ nghĩa cho đáp án diễn giải lại (23/24) — chấp nhận không bấm được;
  giáo viên có thể nhập ô "Dẫn chứng" cho câu đó để nó bấm được (cơ chế sẵn có).
- Không đổi `deriveAnswerEvidence` grade-time (không sinh evidenceSnapshot cho trắc nghiệm)
  — chỉ dò phía client để bài cũ cũng chạy; tránh phải chấm lại.
- Không đổi schema/truy vấn/chấm/import; không đụng Writing/Speaking.

## Kiểm thử

`tests/answer-evidence.test.ts` bổ sung:
- `findEvidenceSentence`: tìm được câu; ưu tiên answer dài nhất; không thấy → null; nguồn null → null.
- `deriveAnswerEvidence`: các test cũ vẫn xanh (không hồi quy sau refactor).
- `answerKeywords`: bóc nhãn `"B. climbing | C. collecting"` → `["climbing","collecting"]`;
  giữ `"power companies"`; snapshot null → `[]`.
- `buildEvidenceTargets`:
  - Câu điền từ có `evidenceSnapshot` → 1 đích dùng đúng câu đó.
  - Câu trắc nghiệm không có `evidenceSnapshot`, từ khóa nằm trong nguồn → đích với câu
    chứa từ khóa; nhiều từ khóa → nhiều đích cùng `order`.
  - Câu trắc nghiệm đáp án không có trong nguồn (diễn giải) → không đích.
  - Đáp án `"TRUE"`/`"NOT GIVEN"` → bị loại, không đích (dù nguồn có chữ "given").
  - `order === null` → bỏ.

`pnpm test` + `pnpm build` xanh. Kiểm thử trình duyệt (người dùng, trên bản deploy): mở
lại bài kết quả có Listening Part 3, click Câu 21/22 → tô câu chứa "climbing" và
"collecting" + badge + cuộn; Câu 23/24 → không bấm được. Câu điền từ ở part khác vẫn chạy.

## Ảnh hưởng dữ liệu cũ

- Bài đã nộp cũ: chạy được ngay (dò phía client, không cần evidenceSnapshot).
- Không hồi quy câu điền từ: nhánh `evidenceSnapshot` giữ nguyên hành vi.
