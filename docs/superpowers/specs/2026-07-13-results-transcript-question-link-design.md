# Thiết kế: Liên kết tương tác Câu hỏi ↔ Transcript trên trang kết quả

Ngày: 2026-07-13
Nhánh: `feature/ielts-platform-mvp`

## Mục tiêu

Trên trang xem lại kết quả Listening/Reading (bài đã nộp), khi người dùng **click vào
một thẻ câu hỏi** ở cột phải:

1. Câu văn chứa đáp án trong cột transcript/bài đọc (bên trái) được **tô nền xanh nhạt**
   (cho ngữ cảnh), đồng thời **đúng từ/cụm đáp án** bên trong được **tô đậm + gạch chân**.
2. Ở **đầu câu văn** được tô hiện một **badge nhỏ `[số câu]`** (vd `[2]`, `[3]`) để đối chiếu.
3. Nếu câu văn đang nằm ngoài tầm nhìn (transcript dài), cột trái **tự cuộn** để đưa nó
   vào giữa khung nhìn.

## Quyết định thiết kế (đã thống nhất với người dùng)

1. **Mặc định transcript KHÔNG tô gì** — bỏ kiểu tô-sẵn-tất-cả đáp án hiện tại. Chỉ tô
   khi click vào một câu, và **mỗi lần chỉ một câu**.
2. **Bấm cả thẻ câu hỏi** để kích hoạt (không cần một nút nhỏ riêng).
3. **Câu không có dẫn chứng** trong transcript (MC / True-False-NG / Matching, hoặc đáp
   án không xuất hiện nguyên văn): **thẻ không tương tác** — không con trỏ tay, click
   không làm gì. Không có gì để cuộn tới nên không cần trạng thái chọn.
4. Phạm vi: **chỉ trang kết quả/chấm bài** (dùng chung component `ResultReview` nên áp
   dụng cho cả trang học viên lẫn giáo viên). Trang làm bài thật **không** đụng tới —
   transcript bị ẩn để không lộ đáp án.
5. **Không đổi schema, không đổi truy vấn, không chấm lại** — mọi dữ liệu cần đã có sẵn.

## Bối cảnh hiện trạng (đã khảo sát)

- `components/result-answers.tsx` (`"use client"`) là component chính: tab theo part,
  mỗi part hai cột. Cột trái render `fillSourceBlanks(sourceText, answersByOrder)` rồi
  `splitByAnswerMatches(..., part.answerStrings)` để **tô sẵn mọi đáp án** bằng `<mark>`.
  Cột phải là các thẻ câu (`AnswerCard`) read-only.
- `components/result-review.tsx` (server) gom `attempt.answers` theo `assignableUnitId`
  thành `ResultPart[]`. **Đã bỏ** `evidenceSnapshot` khi dựng `PartAnswer` (hiện không
  truyền xuống UI), nhưng vẫn có sẵn ở tầng `Answer`.
- `evidenceSnapshot` mỗi đáp án được sinh lúc chấm (`lib/attempt-grading.ts` →
  `deriveAnswerEvidence`): **là câu văn trong nguồn chứa đáp án**, chỉ có với câu điền
  từ (`note_completion`/`table_completion`/`short_answer`) hoặc do giáo viên tự nhập;
  câu nhãn (MC/TF-NG/matching) → `null`. Đây chính là "cổng lọc" tự nhiên: chỉ câu có
  `evidenceSnapshot` mới liên kết được.
- Cả hai trang kết quả truy vấn `answers` bằng `include` → **mọi cột scalar (gồm
  `evidenceSnapshot`) đã có sẵn**; `question.select` đã có `order`. Không cần sửa truy vấn.
- `lib/answer-evidence.ts` đã có: `splitByAnswerMatches`, `fillSourceBlanks`,
  `answerPatterns` (regex khớp đáp án linh hoạt khoảng trắng + đọc đánh vần),
  `deriveAnswerEvidence`. Có bộ test `tests/answer-evidence.test.ts`.
- Cột trái desktop là khung cuộn riêng (`lg:sticky lg:max-h-[75vh] lg:overflow-auto`);
  mobile là khối `<details>` gấp-mở.

## Kiến trúc

### 1. Helper thuần mới — `lib/answer-evidence.ts`

Thêm một hàm thuần (có unit test), **không đổi các hàm cũ**:

```ts
export type EvidenceTarget = {
  order: number;      // số thứ tự câu
  evidence: string;   // evidenceSnapshot (câu văn, có thể còn [[n]])
  answers: string[];  // các biến thể đáp án đúng (correctAnswerSnapshot.split(" | "))
};

export type EvidenceSegment = {
  text: string;
  sentenceOrders: number[]; // order có "câu dẫn chứng" phủ đoạn text này
  answerOrders: number[];   // order có "đúng từ đáp án" là đoạn text này
};

export function buildEvidenceSegments(
  filledSource: string,                    // nguồn đã fillSourceBlanks
  targets: EvidenceTarget[],
  answersByOrder: Record<number, string>   // để fill [[n]] trong evidence cho khớp nguồn
): { segments: EvidenceSegment[]; linkedOrders: number[] };
```

**Thuật toán (tô khoảng — interval painting trên chuỗi):**

1. Với mỗi target: `filledEvidence = fillSourceBlanks(evidence, answersByOrder)`. (Listening
   không có `[[n]]` → giữ nguyên; Reading có `[[n]]` → điền để trùng `filledSource`.)
2. Tìm vị trí câu: `start = filledSource.indexOf(filledEvidence)` — ưu tiên tìm từ con
   trỏ chạy tăng dần (theo thứ tự `order`) để phân biệt câu trùng lặp; không thấy thì
   `indexOf` từ 0. **Không tìm thấy → bỏ target này** (không liên kết được — chấp nhận).
   `end = start + filledEvidence.length`. Ghi khoảng câu `{start, end, order}`.
3. Trong `[start, end)`: dựng regex gộp từ `answerPatterns(answers)` (đã có sẵn), tìm
   lần khớp đầu tiên → ghi khoảng đáp án `{ansStart, ansEnd, order}` (đổi về toạ độ
   `filledSource`). Không khớp → chỉ có khoảng câu, không có khoảng đáp án (fallback:
   tô cả câu, không đậm từ).
4. Gộp mọi điểm ranh giới (start/end của câu và của đáp án) → cắt `filledSource` thành
   các `EvidenceSegment` liền kề, mỗi đoạn gắn `sentenceOrders` / `answerOrders` là tập
   order phủ nó. Overlap (2 câu cùng một câu văn) → đoạn mang cả hai order.
5. `linkedOrders` = các order định vị được (dùng để bật/tắt tương tác thẻ).

Hàm **không** phụ thuộc "câu đang chọn" — component tự quyết định tô đoạn nào theo
`activeOrder`. Điều này giữ hàm thuần, dễ test, và cho phép đổi câu chọn tức thì.

### 2. `components/result-review.tsx`

- Thêm `evidenceSnapshot: string | null` vào type `PartAnswer` và **truyền nó khi
  `part.answers.push(...)`** (hiện đang bỏ). Không đổi gì khác ở đây.
- Không đụng: gom part, `answerStrings`, `answersByOrder`, band/điểm, "Đoạn đã tô".

### 3. `components/result-answers.tsx` (`"use client"`)

- Thêm `evidenceSnapshot` vào `PartAnswer`.
- Thêm state `const [activeOrder, setActiveOrder] = useState<number | null>(null)`.
  **Reset về `null` khi đổi tab part** (câu dẫn chứng thuộc về part đang xem).
- Tính (memo theo part):
  - `targets` = `part.answers` có `order != null` **và** `evidenceSnapshot` (đã trim) →
    `{ order, evidence, answers: correctAnswerSnapshot.split(" | ") }`.
  - `{ segments, linkedOrders }` = `buildEvidenceSegments(filledSource, targets, answersByOrder)`.
- **Cột trái** đổi từ `HighlightedSource` (tô-sẵn) sang render theo `segments`:
  - `activeOrder === null` → text thuần (không tô, không badge).
  - `activeOrder === N`:
    - Đoạn có `N ∈ sentenceOrders` → nền xanh nhạt (`bg-emerald-…/15`).
    - Đoạn có `N ∈ answerOrders` → đậm + gạch chân (`font-semibold underline`).
    - Ngay trước đoạn **đầu tiên** thuộc câu N → chèn badge `[N]` (pill nhỏ) và đặt
      thuộc tính neo `data-evidence-order={N}` để cuộn tới.
  - Áp cho **cả** khối desktop (khung cuộn) lẫn mobile (`<details>`).
- **Cột phải — thẻ câu (`AnswerCard`)**:
  - Nhận thêm props: `isLinked` (order ∈ linkedOrders), `isActive` (order === activeOrder),
    `onSelect`.
  - `isLinked` → `<article>` thành nút bấm được: `role="button"`, `cursor-pointer`,
    hover đổi viền; click → `onSelect(order)` (toggle: đang chọn thì bỏ chọn).
  - `isActive` → viền/nền nổi bật (`ring-2 ring-primary`).
  - `!isLinked` → giữ nguyên như hiện tại, không con trỏ tay, không onClick.
- **Tự cuộn** khi `activeOrder` đổi (`useEffect`): trong ref của khung cuộn cột trái,
  tìm `[data-evidence-order="${activeOrder}"]`, cuộn **trong khung** (tính `offsetTop`
  tương đối rồi set `scrollTop`, không dùng `scrollIntoView` để tránh cuộn cả trang),
  đưa câu vào giữa. Mobile: mở `<details>` (state controlled `open`) trước khi cuộn.

## Phạm vi loại trừ (YAGNI)

- **Không** liên kết ngược (click câu văn/badge bên trái → cuộn tới thẻ bên phải). Chỉ
  một chiều câu hỏi → transcript như yêu cầu. Có thể mở rộng sau.
- **Không** đổi schema, truy vấn, chấm điểm, import, hay ô "Dẫn chứng" của giáo viên.
- **Không** đụng Writing/Speaking (không có transcript, giữ thẻ một cột).
- Câu có đáp án đánh vần/không định vị được → thẻ không tương tác. Chấp nhận cho v1.

## Kiểm thử

- `tests/answer-evidence.test.ts` (bổ sung `describe("buildEvidenceSegments")`):
  - 1 câu, định vị được câu văn + gắn đúng từ đáp án; `linkedOrders` chứa order đó.
  - evidence không có trong nguồn → bỏ qua, không vào `linkedOrders`.
  - 2 câu cùng một câu văn → đoạn mang cả hai order trong `sentenceOrders`.
  - Reading có `[[n]]`: fill xong định vị được câu văn.
  - Đáp án không khớp nguyên văn trong câu (đánh vần lệch) → có `sentenceOrders`,
    trống `answerOrders`.
- `pnpm test` + `pnpm build` xanh.
- Kiểm thử trình duyệt (dev server + preview): mở một bài kết quả Listening có
  transcript. Click câu 1 → câu chứa "Hardie" tô xanh, từ `H-A-R-D-I-E` đậm/gạch chân,
  badge `[1]` ở đầu câu, cột trái cuộn tới. Click một câu MC → không có gì xảy ra (thẻ
  không bấm được). Đổi tab part → highlight reset. Thu nhỏ về mobile → mở transcript +
  cuộn. Chụp ảnh làm bằng chứng.

## Ảnh hưởng dữ liệu cũ

- Bài cũ vẫn có `evidenceSnapshot` (đã sinh khi chấm) → tính năng chạy được ngay.
- Bài không có transcript/content phù hợp → part rơi về một cột như hiện tại; không có
  câu nào `linkedOrders` → không thẻ nào bấm được, không lỗi.
- Thay đổi hành vi nhìn thấy: transcript **không còn tô-sẵn** mọi đáp án; chỉ tô khi
  click (đúng quyết định đã thống nhất).
