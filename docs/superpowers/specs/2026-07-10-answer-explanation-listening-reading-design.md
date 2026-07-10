# Thiết kế: Giải thích / dẫn chứng đáp án cho Listening & Reading

Ngày: 2026-07-10
Nhánh: `feature/ielts-platform-mvp`

## Mục tiêu

Khi học sinh xem lại kết quả một bài Listening/Reading, mỗi câu hiển thị **đoạn
chứa đáp án đúng ("dẫn chứng")**:

- **Reading:** trích nguyên văn câu/đoạn trong bài đọc chứa đáp án.
- **Listening:** hiển thị đoạn transcript chứa đáp án, **gạch chân** đúng chỗ;
  và cho phép mở xem **toàn bộ transcript** của part.

Mục tiêu là giúp học sinh tự hiểu vì sao đáp án đúng mà không cần giáo viên gõ
tay từng câu.

## Bối cảnh hiện trạng (đã khảo sát)

- `Question.explanation` (String?) **đã tồn tại** và **đã được hiển thị** trong
  `components/result-review.tsx` (dùng chung cho cả trang kết quả học sinh và
  giáo viên) qua `Answer.explanationSnapshot`. Đây là phần "Giải thích" (lý do),
  khác với "dẫn chứng" (đoạn trích) mà tính năng này bổ sung.
- Import JSON (`lib/actions/materials.ts`) đã hỗ trợ `explanation` cho mỗi câu.
- Phân bố loại câu trong `tmp/` (~800 câu): note/table/short-answer (~50%) có đáp
  án **nằm nguyên văn** trong bài; multiple_choice/true_false_not_given/matching
  (~50%) có đáp án là **nhãn** (chữ cái / TRUE-FALSE) nên bằng chứng **không**
  nằm nguyên văn → không tự dò được.
- **Các file Listening hiện tại KHÔNG có `transcript`.** Muốn hiện transcript +
  gạch chân, prompt import phải bổ sung transcript. Tính năng áp dụng cho **bài
  import mới**; bài cũ chưa có transcript sẽ không hiện phần này cho tới khi
  import lại (các file nguồn nằm sẵn trong `tmp/`).
- Đã có sẵn pattern gọi AI ngoài (Groq) trong `lib/actions/transcribe.ts`, nhưng
  tính năng này **không gọi AI trong app** — AI làm ở bước tạo file import.

## Quyết định thiết kế (đã thống nhất với người dùng)

1. Ngôn ngữ giải thích: **tiếng Việt** (dẫn chứng trích tiếng Anh nguyên văn).
2. Nguồn dẫn chứng: **AI ở bước tạo file import** (mở rộng prompt) cho mọi loại
   câu; **không** thêm nút gọi AI trong app, **không** thêm chi phí/rate-limit.
3. Phủ **tất cả loại câu**: câu điền từ có thể **tự dò miễn phí** (fallback),
   câu còn lại lấy từ trường `evidence` do AI xuất ra.
4. Listening hiển thị **cả hai**: đoạn dẫn chứng ngắn theo từng câu **và** nút
   "Xem full transcript" cho cả part.

## Kiến trúc

Luồng: prompt AI (ngoài app) → file JSON có `evidence` + `transcript` → import →
`Question.answerEvidence` + `AssignableUnit.transcript` → lúc chấm chụp vào
`Answer.evidenceSnapshot` (kèm fallback tự dò) → `ResultReview` hiển thị.

### 1. Thay đổi schema (`prisma/schema.prisma`, dùng `db push`)

- `Question.answerEvidence String?` — đoạn chứa đáp án (dẫn chứng).
- `Answer.evidenceSnapshot String?` — chụp lại lúc chấm để kết quả ổn định.
- `AssignableUnit.transcript` đã có sẵn (không đổi), chỉ bắt đầu được điền cho
  Listening.

Cập nhật khối comment enum ở đầu schema nếu cần (không thêm enum mới).

### 2. Import (`lib/actions/materials.ts`)

- `importQuestionSchema`: thêm `evidence: z.string().trim().optional()`.
- `importUnitSchema`: `transcript` đã có sẵn (giữ nguyên).
- Phần `questions.create`: map `answerEvidence: optionalText(question.evidence)`.
- Không thêm ràng buộc validate mới bắt buộc (evidence là tùy chọn).

### 3. Tự dò dẫn chứng (fallback, miễn phí) — helper thuần

Tạo `lib/answer-evidence.ts`:

```ts
// Trả về câu/đoạn trong sourceText chứa đáp án nguyên văn, hoặc null.
export function deriveAnswerEvidence(
  questionType: string,
  correctAnswers: string[],   // các đáp án chấp nhận
  sourceText: string | null   // content (Reading) hoặc transcript (Listening)
): string | null
```

- Chỉ áp dụng cho loại "điền từ": `note_completion`, `table_completion`,
  `short_answer`. Các loại khác trả `null`.
- Tách `sourceText` thành câu (theo dấu `.?!` và xuống dòng), trả về câu đầu tiên
  chứa đáp án nguyên văn (so khớp không phân biệt hoa/thường, ưu tiên đáp án dài
  nhất trong danh sách). Không tìm thấy → `null`.
- Là hàm thuần, có unit test (`tests/answer-evidence.test.ts`) theo phong cách
  test hiện có.

### 4. Chấm bài (`lib/attempt-grading.ts`)

- Khi tạo `Answer`, đặt `evidenceSnapshot` theo thứ tự ưu tiên:
  1. `question.answerEvidence` nếu có.
  2. `deriveAnswerEvidence(...)` với source = `unit.content` (Reading) hoặc
     `unit.transcript` (Listening).
  3. `null`.
- Cần nạp thêm `answerEvidence`, `assignableUnit.{skill, content, transcript}`
  vào truy vấn câu hỏi phục vụ chấm. Cập nhật kiểu dữ liệu tương ứng và test
  `tests/attempt-grading.test.ts`.

### 5. Soạn/sửa thủ công (`components/question-fields.tsx`)

- Thêm ô textarea **"Dẫn chứng (đoạn chứa đáp án)"** (`name="answerEvidence"`),
  ngay dưới ô "Giải thích", mirror y hệt.
- `lib/actions/materials.ts` (`createQuestion` / `updateQuestion`): thêm
  `answerEvidence` vào zod schema + đọc `formData.get("answerEvidence")` + lưu.
- `app/teacher/materials/page.tsx`: truyền `answerEvidence` vào defaults khi sửa.

### 6. Hiển thị kết quả (`components/result-review.tsx`)

- Kiểu `Answer` thêm `evidenceSnapshot: string | null`; `assignableUnit` thêm
  `transcript?: string | null` (đọc từ unit).
- Dưới mỗi câu, thêm khối **"Dẫn chứng"** khi có `evidenceSnapshot`:
  - Hiện đoạn trích; nếu `correctAnswerSnapshot` là từ nguyên văn xuất hiện trong
    đoạn, bọc `<u>`/tô đậm phần đó (hàm nhỏ underline literal match). Câu
    MC/TF-NG/matching không có từ nguyên văn → hiện cả đoạn, không gạch chân.
- **Listening (skill === "listening")**: mỗi part (nhóm theo
  `assignableUnitId`) có `<details>` **"Xem full transcript"** hiển thị toàn
  bộ `transcript`, gạch chân các đáp án nguyên văn trong đó. Chỉ hiện khi unit có
  transcript.
- Cập nhật truy vấn ở `app/student/results/[attemptId]/page.tsx` và
  `app/teacher/results/[attemptId]/page.tsx` để `select` thêm
  `evidenceSnapshot` và `assignableUnit.transcript`.

### 7. Prompt import (`docs/prompt-import-reading.md`)

- Bổ sung yêu cầu: mỗi câu xuất thêm `evidence` = **trích nguyên văn** câu/đoạn
  ngắn trong bài chứa đáp án đúng (không diễn giải, giữ đúng tiếng Anh gốc).
- Với đề **Listening**: mỗi unit xuất thêm `transcript` = toàn bộ lời thoại, và
  `evidence` mỗi câu là đoạn transcript chứa đáp án.
- Ghi rõ `evidence` là tùy chọn nhưng khuyến khích; câu điền từ nếu bỏ trống thì
  app tự dò.

## Phạm vi loại trừ (YAGNI)

- Không thêm nút gọi AI trong app (không backfill tự động bài cũ).
- Không sinh "lý do" bằng AI — chỉ trích dẫn chứng. Ô "Giải thích" thủ công vẫn
  giữ nguyên như cũ.
- Không đụng tới Writing/Speaking.

## Kiểm thử

- `tests/answer-evidence.test.ts` (mới): dò đúng câu chứa đáp án; loại câu nhãn
  trả `null`; không phân biệt hoa/thường; nhiều đáp án chấp nhận.
- Cập nhật `tests/attempt-grading.test.ts`: `evidenceSnapshot` được đặt đúng theo
  thứ tự ưu tiên (evidence có sẵn > tự dò > null).
- `pnpm build` + `pnpm test` xanh; kiểm tra thực tế trên trang kết quả sau khi
  import một bài mới có `evidence`/`transcript`.

## Ảnh hưởng dữ liệu cũ

- Bài Listening/Reading đã nộp trước đây: `evidenceSnapshot` = null → không hiện
  khối dẫn chứng (không lỗi, chỉ là không có). Chấp nhận được.
- Bài import cũ chưa có `answerEvidence`/`transcript`: câu điền từ vẫn tự dò được
  từ `content`; Listening không có transcript nên chưa hiện — import lại để có.
