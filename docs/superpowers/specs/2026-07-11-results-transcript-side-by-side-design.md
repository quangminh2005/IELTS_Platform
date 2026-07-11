# Thiết kế: Trang kết quả — transcript/bài đọc song song với đáp án (kiểu chin.edu.vn)

Ngày: 2026-07-11
Nhánh: `feature/ielts-platform-mvp`

## Mục tiêu

Trang xem lại kết quả Listening/Reading hiển thị **hai cột theo từng part** (giống
chin.edu.vn):

- **Cột trái:** transcript (Listening) hoặc bài đọc (Reading) của part, **tô sáng**
  các đáp án đúng ngay trong đó.
- **Cột phải:** danh sách câu hỏi của part, mỗi câu gọn gồm *đề, bạn trả lời, đáp án
  đúng, (giải thích nếu có)*, nhãn Đúng/Sai.
- **Thanh tab** chuyển giữa các part (Phần 1/2/3/4 · dải câu).

Giải quyết hai phản hồi thực tế của người dùng:
1. Transcript hiện nằm tít cuối trang, phải cuộn xa mới thấy.
2. Ô "Dẫn chứng" chỗ có chỗ không (do khớp nguyên văn thất bại) trông thiếu nhất
   quán — thay bằng tô sáng trong cột trái, nhất quán cho mọi câu điền từ.

## Bối cảnh hiện trạng (đã khảo sát)

- `components/result-review.tsx` (server component, không có `"use client"`) render:
  điểm/band/tỷ lệ → nhận xét giáo viên → **một danh sách phẳng** tất cả `answers`
  (mỗi câu một thẻ, có ô "Dẫn chứng" và "Giải thích") → **một section Transcript**
  gấp-mở ở cuối (thêm ngày 2026-07-10) → phần "Đoạn đã tô".
- Mỗi `answer` (từ truy vấn 2 trang kết quả, dùng `include` nên có mọi cột scalar):
  `value`, `isCorrect`, `correctAnswerSnapshot` (dạng `"a | b"`),
  `explanationSnapshot`, `evidenceSnapshot`, `question {order, prompt, points}`,
  `assignableUnit {title, skill, transcript}` (đang `select`, **chưa có** `content`).
- Bài đọc/transcript render lúc làm bài nằm trong `attempt-workspace.tsx` (client,
  ~2600 dòng) — gắn chặt với ô nhập điền chỗ trống, **không tái dùng** cho trang
  kết quả. Cột trái dùng bộ render read-only riêng, đơn giản.
- `lib/answer-evidence.ts` đã có `splitByAnswerMatches(text, answers)` khớp nguyên
  văn theo ranh giới từ.
- Reading `content` phần lớn là văn xuôi passage sạch; một số unit điền từ có `[[n]]`
  trong content hoặc trong `metadataJson.noteBody`.

## Quyết định thiết kế (đã thống nhất)

1. Phạm vi: **cả Listening (transcript) và Reading (content)**.
2. Bố cục: **tab theo part**, mỗi part hai cột.
3. Cột phải kiểu chin: đề + bạn trả lời + đáp án đúng + (giải thích nếu có).
   **Bỏ ô "Dẫn chứng" riêng** — bằng chứng = chỗ tô sáng cột trái.
4. Khớp tô sáng: **linh hoạt khoảng trắng** + không phân biệt hoa/thường + nhiều
   biến thể đáp án. Ca không xuất hiện nguyên văn (vd "Hardie" bị đánh vần) thì
   không tô — chấp nhận.
5. Mobile: hai cột **xếp dọc** (transcript/bài đọc ở khối gấp-mở trên, câu hỏi dưới).
6. Writing/Speaking (nếu có trong bài): **giữ nguyên** thẻ một cột như hiện tại.
7. Giữ cột `evidenceSnapshot` trong DB (chỉ bỏ hiển thị) — **không đổi schema**.

## Kiến trúc

### 1. Bổ sung dữ liệu truy vấn (2 trang kết quả)

`app/student/results/[attemptId]/page.tsx` và `app/teacher/results/[attemptId]/page.tsx`:
thêm `content: true` vào `assignableUnit.select` (đã có `title, skill, transcript`).

### 2. Helper thuần — `lib/answer-evidence.ts`

Nâng cấp khớp để tô sáng bền hơn (giữ chữ ký cũ, chỉ đổi nội dung regex):

- `splitByAnswerMatches(text, answers)`: khi dựng regex, cho phép **khoảng trắng
  linh hoạt** bên trong đáp án — mỗi khoảng trắng trong đáp án khớp `\s+`, và cũng
  khớp bản **bỏ hết khoảng trắng** (để `"GT82LC"` khớp `"GT8 2LC"` và ngược lại).
  Vẫn ranh giới từ, không phân biệt hoa/thường, ưu tiên đáp án dài nhất.

Thêm helper mới cho cột trái Reading có `[[n]]`:

```ts
// Thay [[n]] trong nguồn bằng đáp án đúng của câu order=n (để đọc liền mạch),
// trả về chuỗi đã ghép; các đáp án thay vào sẽ được tô sáng bởi splitByAnswerMatches.
export function fillSourceBlanks(
  source: string,
  answersByOrder: Record<number, string> // order -> đáp án đúng (1 chuỗi)
): string
```

- Không có `[[n]]` (transcript Listening, passage sạch) → trả nguyên `source`.
- `[[n]]` không có đáp án tương ứng → thay bằng `"____"`.

### 3. Component mới — `components/result-answers.tsx` (`"use client"`)

`ResultAnswers({ parts })` — nhận danh sách part đã gom sẵn, tự quản state tab.

Kiểu dữ liệu:

```ts
type PartAnswer = {
  id: string;
  order: number | null;
  prompt: string | null;
  points: number | null;
  value: string;
  isCorrect: boolean | null;
  correctAnswerSnapshot: string | null;
  explanationSnapshot: string | null;
  annotations: Annotation[];
};
type ResultPart = {
  unitId: string;
  title: string;
  skill: string;                 // listening | reading | writing | speaking
  sourceText: string | null;     // transcript (listening) | content (reading) | null
  answers: PartAnswer[];
  answerStrings: string[];        // mọi đáp án đúng của part (để tô sáng cột trái)
  answersByOrder: Record<number, string>; // order -> đáp án đúng đầu tiên (điền [[n]])
  minOrder: number | null;
  maxOrder: number | null;
};
```

Hành vi:
- **Tab bar**: một nút mỗi part, nhãn `Phần {i}` + phụ đề `Câu {minOrder}–{maxOrder}`
  (bỏ phụ đề nếu thiếu order). Part đang chọn nổi bật. Mặc định chọn part đầu.
- **Part đang chọn**:
  - Có `sourceText` và skill ∈ {listening, reading}: **grid 2 cột** (`lg:grid-cols-2`).
    - Trái: khối cuộn (`lg:sticky lg:top-4 lg:max-h-[75vh] overflow-auto`) render
      `fillSourceBlanks(sourceText, answersByOrder)` bằng
      `splitByAnswerMatches(..., answerStrings)`, phần khớp bọc `<mark>`/`<u>` tô xanh.
      `whitespace-pre-wrap`. Mobile: nằm trong `<details>` mở sẵn phía trên.
    - Phải: danh sách thẻ câu (đề, bạn trả lời, đáp án đúng, giải thích nếu có, nhãn).
  - Không có `sourceText` (Writing/Speaking, hoặc Listening/Reading bài cũ chưa có
    transcript): **một cột** — chỉ danh sách thẻ câu như cũ (bao gồm audio speaking +
    `AnnotatedAnswer` cho writing).
- Thẻ câu (cột phải) tái dùng phần render hiện có nhưng **bỏ khối `evidenceSnapshot`**.

### 4. `components/result-review.tsx`

- Gom `attempt.answers` theo `assignableUnitId` (giữ thứ tự xuất hiện) thành
  `ResultPart[]`: lấy `title/skill` từ `assignableUnit`; `sourceText` =
  `skill==="listening" ? transcript : skill==="reading" ? content : null`;
  `answerStrings` = gộp mọi `correctAnswerSnapshot.split(" | ")`; `answersByOrder` =
  map `question.order -> đáp án đúng đầu tiên`.
- Thay **section "Đáp án" phẳng** + **section "Transcript" ở cuối** bằng một
  `<ResultAnswers parts={parts} />`.
- Giữ nguyên: điểm/band/tỷ lệ, nhận xét giáo viên, "Đoạn đã tô".
- Kiểu `Answer` thêm `assignableUnit.content?: string | null`.

## Phạm vi loại trừ (YAGNI)

- Không tái dùng renderer phức tạp của `attempt-workspace.tsx` (fence `:::flow/:::map`,
  bảng tương tác…). Cột trái là văn bản thuần + tô sáng + thay `[[n]]`. Fence hiếm gặp
  hiển thị dạng chữ — chấp nhận cho v1.
- Không đổi schema, không đụng chấm điểm, import, hay ô soạn "Dẫn chứng" của giáo viên.
- Không đụng Writing/Speaking (giữ thẻ một cột).

## Kiểm thử

- `tests/answer-evidence.test.ts` (bổ sung): `splitByAnswerMatches` khớp linh hoạt
  khoảng trắng (`"GT82LC"` ↔ `"GT8 2LC"`); nhiều biến thể; câu nhãn/không xuất hiện →
  không có phần match. `fillSourceBlanks`: thay `[[n]]` bằng đáp án; thiếu đáp án →
  `"____"`; không có blank → nguyên văn.
- `pnpm test` + `pnpm build` xanh.
- Kiểm thử trình duyệt: mở lại bài kết quả Listening Test 1 (đã có transcript), xác
  nhận tab từng part, cột trái tô sáng đáp án, cột phải gọn, mobile xếp dọc. Chụp ảnh.

## Ảnh hưởng dữ liệu cũ

- Bài Listening/Reading cũ chưa có transcript/content phù hợp: part đó rơi về **một
  cột** (chỉ câu hỏi) — không lỗi.
- `evidenceSnapshot` cũ vẫn nằm trong DB, chỉ không hiển thị nữa.
