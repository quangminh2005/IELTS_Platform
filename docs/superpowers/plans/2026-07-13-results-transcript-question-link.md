# Liên kết tương tác Câu hỏi ↔ Transcript — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trên trang kết quả, click một thẻ câu hỏi sẽ tô sáng câu dẫn chứng trong transcript (nền xanh + từ đáp án đậm/gạch chân), hiện badge `[số câu]`, và tự cuộn cột trái tới đó.

**Architecture:** Thêm một hàm thuần `buildEvidenceSegments` (có test) trong `lib/answer-evidence.ts` để cắt transcript thành các đoạn gắn số câu, dựa trên `evidenceSnapshot` đã lưu sẵn. Component `result-answers.tsx` giữ state `activeOrder`, render các đoạn theo câu đang chọn, và cuộn trong khung cột trái. `result-review.tsx` chỉ truyền thêm `evidenceSnapshot` (đã có sẵn trong dữ liệu) xuống UI.

**Tech Stack:** Next.js 14 App Router (React 18, TypeScript strict), Tailwind, Vitest.

## Global Constraints

- Ngôn ngữ UI + comment: **tiếng Việt** (theo repo).
- **Không đổi** Prisma schema, truy vấn DB, logic chấm điểm, hay import.
- `evidenceSnapshot` và `question.order` đã có sẵn trong dữ liệu 2 trang kết quả (answers dùng `include`) — không sửa truy vấn.
- Tính năng chỉ trên trang kết quả (dùng chung component `ResultReview`), không đụng trang làm bài.
- TypeScript `strict`; path alias `@/*` → repo root.
- Test là logic thuần (theo quy ước `tests/`); component xác minh bằng `pnpm build` + trình duyệt.

---

### Task 1: Hàm thuần `buildEvidenceSegments`

**Files:**
- Modify: `lib/answer-evidence.ts` (thêm types + hàm ở cuối file; không đổi hàm cũ)
- Test: `tests/answer-evidence.test.ts` (thêm một `describe`)

**Interfaces:**
- Consumes: `fillSourceBlanks`, `answerPatterns` (đã có trong cùng file).
- Produces:
  ```ts
  export type EvidenceTarget = { order: number; evidence: string; answers: string[] };
  export type EvidenceSegment = { text: string; sentenceOrders: number[]; answerOrders: number[] };
  export function buildEvidenceSegments(
    filledSource: string,
    targets: EvidenceTarget[],
    answersByOrder: Record<number, string>
  ): { segments: EvidenceSegment[]; linkedOrders: number[] };
  ```

- [ ] **Step 1: Viết test thất bại**

Thêm vào cuối `tests/answer-evidence.test.ts`. Cập nhật dòng import đầu file thành:

```ts
import {
  deriveAnswerEvidence,
  splitByAnswerMatches,
  fillSourceBlanks,
  buildEvidenceSegments
} from "@/lib/answer-evidence";
```

Rồi thêm khối:

```ts
describe("buildEvidenceSegments", () => {
  it("định vị câu dẫn chứng và gắn từ đáp án cho câu", () => {
    const source = "Man: What is your name? Louisa: It's Hardie. Man: Thanks.";
    const { segments, linkedOrders } = buildEvidenceSegments(
      source,
      [{ order: 1, evidence: "Louisa: It's Hardie.", answers: ["Hardie"] }],
      {}
    );
    expect(linkedOrders).toEqual([1]);
    expect(segments.some((s) => s.sentenceOrders.includes(1))).toBe(true);
    const ans = segments.find((s) => s.answerOrders.includes(1));
    expect(ans?.text).toBe("Hardie");
    // Ghép lại phải đúng nguyên văn nguồn (không mất/không thừa ký tự).
    expect(segments.map((s) => s.text).join("")).toBe(source);
  });

  it("bỏ qua câu có evidence không nằm trong nguồn", () => {
    const { segments, linkedOrders } = buildEvidenceSegments(
      "No such sentence here.",
      [{ order: 2, evidence: "Completely different text.", answers: ["x"] }],
      {}
    );
    expect(linkedOrders).toEqual([]);
    expect(segments).toEqual([
      { text: "No such sentence here.", sentenceOrders: [], answerOrders: [] }
    ]);
  });

  it("hai câu cùng một câu văn -> đoạn mang cả hai order", () => {
    const source = "The core and the mantle are hot layers.";
    const { segments } = buildEvidenceSegments(
      source,
      [
        { order: 1, evidence: "The core and the mantle are hot layers.", answers: ["core"] },
        { order: 2, evidence: "The core and the mantle are hot layers.", answers: ["mantle"] }
      ],
      {}
    );
    expect(
      segments.some((s) => s.sentenceOrders.includes(1) && s.sentenceOrders.includes(2))
    ).toBe(true);
    expect(segments.some((s) => s.answerOrders.includes(1) && s.text === "core")).toBe(true);
    expect(segments.some((s) => s.answerOrders.includes(2) && s.text === "mantle")).toBe(true);
  });

  it("điền [[n]] trong evidence để khớp nguồn đã điền", () => {
    const filled = "The summary says the answer is photosynthesis clearly.";
    const { segments, linkedOrders } = buildEvidenceSegments(
      filled,
      [
        {
          order: 3,
          evidence: "The summary says the answer is [[3]] clearly.",
          answers: ["photosynthesis"]
        }
      ],
      { 3: "photosynthesis" }
    );
    expect(linkedOrders).toEqual([3]);
    expect(
      segments.some((s) => s.answerOrders.includes(3) && s.text === "photosynthesis")
    ).toBe(true);
  });

  it("đáp án không khớp nguyên văn -> có câu, trống từ đáp án", () => {
    const source = "Yes, it's Hardy spelled differently.";
    const { segments } = buildEvidenceSegments(
      source,
      [{ order: 1, evidence: "Yes, it's Hardy spelled differently.", answers: ["Hardie"] }],
      {}
    );
    expect(segments.some((s) => s.sentenceOrders.includes(1))).toBe(true);
    expect(segments.every((s) => s.answerOrders.length === 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Chạy test để chắc chắn nó fail**

Run: `npx vitest run tests/answer-evidence.test.ts`
Expected: FAIL — `buildEvidenceSegments is not a function` / không export.

- [ ] **Step 3: Viết hàm (minimal, đủ để pass)**

Thêm vào **cuối** `lib/answer-evidence.ts` (sau `fillSourceBlanks`):

```ts
export type EvidenceTarget = {
  order: number; // số thứ tự câu
  evidence: string; // evidenceSnapshot (câu văn, có thể còn [[n]])
  answers: string[]; // các biến thể đáp án đúng
};

export type EvidenceSegment = {
  text: string;
  sentenceOrders: number[]; // order có "câu dẫn chứng" phủ đoạn này
  answerOrders: number[]; // order có "đúng từ đáp án" là đoạn này
};

// Cắt filledSource thành các đoạn, mỗi đoạn biết thuộc câu dẫn chứng nào và có phải
// đúng từ đáp án của câu nào. Định vị câu dẫn chứng bằng cách điền [[n]] cho evidence
// rồi tìm chuỗi con trong filledSource (con trỏ chạy tăng theo order để phân biệt câu
// trùng). Không định vị được -> bỏ câu đó (không liên kết).
export function buildEvidenceSegments(
  filledSource: string,
  targets: EvidenceTarget[],
  answersByOrder: Record<number, string>
): { segments: EvidenceSegment[]; linkedOrders: number[] } {
  type Interval = { start: number; end: number; order: number; kind: "sentence" | "answer" };
  const intervals: Interval[] = [];
  const linkedOrders: number[] = [];

  const sorted = [...targets].sort((a, b) => a.order - b.order);
  let cursor = 0;

  for (const target of sorted) {
    const filledEvidence = fillSourceBlanks(target.evidence, answersByOrder).trim();
    if (!filledEvidence) continue;

    let start = filledSource.indexOf(filledEvidence, cursor);
    if (start === -1) start = filledSource.indexOf(filledEvidence);
    if (start === -1) continue; // không định vị được -> bỏ

    const end = start + filledEvidence.length;
    cursor = end;
    linkedOrders.push(target.order);
    intervals.push({ start, end, order: target.order, kind: "sentence" });

    // Tìm đúng từ/cụm đáp án trong khoảng câu (ưu tiên đáp án dài, khớp linh hoạt).
    const patterns = target.answers
      .map((a) => a.trim())
      .filter(Boolean)
      .sort((a, b) => b.replace(/\s+/g, "").length - a.replace(/\s+/g, "").length)
      .flatMap(answerPatterns)
      .filter(Boolean);
    if (patterns.length > 0) {
      const re = new RegExp(patterns.join("|"), "gi");
      const sentence = filledSource.slice(start, end);
      const m = re.exec(sentence);
      if (m && m[0].length > 0) {
        intervals.push({
          start: start + m.index,
          end: start + m.index + m[0].length,
          order: target.order,
          kind: "answer"
        });
      }
    }
  }

  if (intervals.length === 0) {
    return {
      segments: [{ text: filledSource, sentenceOrders: [], answerOrders: [] }],
      linkedOrders
    };
  }

  // Tô khoảng: gộp mọi điểm ranh giới, cắt chuỗi thành đoạn liền kề.
  const points = new Set<number>([0, filledSource.length]);
  for (const iv of intervals) {
    points.add(iv.start);
    points.add(iv.end);
  }
  const bounds = [...points].sort((a, b) => a - b);

  const segments: EvidenceSegment[] = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    const segStart = bounds[i];
    const segEnd = bounds[i + 1];
    if (segStart >= segEnd) continue;
    const sentenceOrders: number[] = [];
    const answerOrders: number[] = [];
    for (const iv of intervals) {
      if (iv.start <= segStart && segEnd <= iv.end) {
        if (iv.kind === "sentence" && !sentenceOrders.includes(iv.order)) {
          sentenceOrders.push(iv.order);
        }
        if (iv.kind === "answer" && !answerOrders.includes(iv.order)) {
          answerOrders.push(iv.order);
        }
      }
    }
    segments.push({ text: filledSource.slice(segStart, segEnd), sentenceOrders, answerOrders });
  }

  return { segments, linkedOrders };
}
```

- [ ] **Step 4: Chạy test để chắc chắn pass**

Run: `npx vitest run tests/answer-evidence.test.ts`
Expected: PASS (toàn bộ, gồm 5 case mới của `buildEvidenceSegments`).

- [ ] **Step 5: Commit**

```bash
git add lib/answer-evidence.ts tests/answer-evidence.test.ts
git commit -m "feat: buildEvidenceSegments — cắt transcript theo câu dẫn chứng"
```

---

### Task 2: Tương tác Câu hỏi ↔ Transcript trên trang kết quả

**Files:**
- Modify: `components/result-review.tsx` (truyền `evidenceSnapshot` vào `PartAnswer`)
- Modify: `components/result-answers.tsx` (state `activeOrder`, render đoạn, thẻ bấm được, cuộn)
- (Không tạo file test — xác minh bằng `pnpm build` + trình duyệt)

**Interfaces:**
- Consumes từ Task 1: `buildEvidenceSegments`, type `EvidenceSegment`.
- Consumes có sẵn: `fillSourceBlanks`; `PartAnswer` (đã có các field `order`, `correctAnswerSnapshot`, `annotations`, ...); `part.answersByOrder`, `part.answerStrings`.

- [ ] **Step 1: Truyền `evidenceSnapshot` xuống UI**

Trong `components/result-answers.tsx`, thêm field vào type `PartAnswer` (ngay dưới `correctAnswerSnapshot`):

```ts
export type PartAnswer = {
  id: string;
  order: number | null;
  prompt: string | null;
  points: number | null;
  value: string;
  isCorrect: boolean | null;
  pointsAwarded: number | null;
  correctAnswerSnapshot: string | null;
  evidenceSnapshot: string | null;
  explanationSnapshot: string | null;
  annotations: Annotation[];
};
```

Trong `components/result-review.tsx`, tại chỗ `part.answers.push({ ... })` (đang có `correctAnswerSnapshot: answer.correctAnswerSnapshot,`), thêm ngay dưới dòng đó:

```ts
      evidenceSnapshot: answer.evidenceSnapshot,
```

- [ ] **Step 2: Chạy build để chắc chắn kiểu khớp**

Run: `pnpm build`
Expected: PASS (không lỗi TypeScript). Nếu lỗi "property evidenceSnapshot missing" ở nơi khác dựng `PartAnswer` thì bổ sung field ở đó — hiện chỉ có `result-review.tsx`.

- [ ] **Step 3: Sửa import + bỏ `HighlightedSource`, thêm `EvidenceTranscript`**

Trong `components/result-answers.tsx`, đổi 2 dòng import đầu:

```ts
import { useEffect, useMemo, useRef, useState } from "react";
import { AnnotatedAnswer, type Annotation } from "@/components/annotated-answer";
import { buildEvidenceSegments, fillSourceBlanks, type EvidenceSegment } from "@/lib/answer-evidence";
```

(Bỏ `splitByAnswerMatches` khỏi import — không dùng nữa.)

Xoá **toàn bộ** hàm `HighlightedSource` (từ comment `// Văn bản nguồn...` đến hết hàm) và thay bằng:

```tsx
// Render transcript theo các đoạn đã gắn số câu. Chỉ tô khi có activeOrder: câu văn
// chứa đáp án (nền xanh) + đúng từ đáp án (đậm/gạch chân) + badge [n] ở đầu câu.
function EvidenceTranscript({
  segments,
  activeOrder
}: {
  segments: EvidenceSegment[];
  activeOrder: number | null;
}) {
  let badgeShown = false;
  return (
    <>
      {segments.map((seg, index) => {
        const inSentence = activeOrder !== null && seg.sentenceOrders.includes(activeOrder);
        const isAnswer = activeOrder !== null && seg.answerOrders.includes(activeOrder);
        const showBadge = inSentence && !badgeShown;
        if (showBadge) badgeShown = true;
        const markClass = [
          inSentence ? "rounded bg-emerald-500/15 dark:bg-emerald-400/15" : "",
          isAnswer
            ? "font-semibold text-emerald-800 underline decoration-emerald-500 dark:text-emerald-200"
            : ""
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <span key={index}>
            {showBadge ? (
              <span
                data-evidence-order={activeOrder as number}
                className="mx-0.5 inline-flex items-center rounded-full bg-emerald-600 px-1.5 py-0.5 align-middle text-[11px] font-bold leading-none text-white"
              >
                [{activeOrder}]
              </span>
            ) : null}
            <span className={markClass || undefined}>{seg.text}</span>
          </span>
        );
      })}
    </>
  );
}
```

- [ ] **Step 4: Cho thẻ câu bấm được**

Trong `components/result-answers.tsx`, thay chữ ký + phần bọc `<article>` của `AnswerCard`. Đổi dòng `function AnswerCard({ answer }: { answer: PartAnswer }) {` và `<article ...>` mở đầu thành:

```tsx
function AnswerCard({
  answer,
  isLinked,
  isActive,
  onSelect
}: {
  answer: PartAnswer;
  isLinked: boolean;
  isActive: boolean;
  onSelect: (order: number) => void;
}) {
  const interactive = isLinked && answer.order !== null;
  const activate = () => {
    if (answer.order !== null) onSelect(answer.order);
  };
  return (
    <article
      className={`rounded-xl border bg-card p-4 shadow-card transition ${
        isActive ? "border-primary ring-2 ring-primary" : "border-border"
      } ${interactive ? "cursor-pointer hover:border-primary" : ""}`}
      {...(interactive
        ? {
            role: "button",
            tabIndex: 0,
            "aria-pressed": isActive,
            onClick: activate,
            onKeyDown: (event: React.KeyboardEvent) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                activate();
              }
            }
          }
        : {})}
    >
```

(Giữ nguyên toàn bộ phần thân bên trong `<article>` và thẻ đóng `</article>`.)

- [ ] **Step 5: Nối state + render + cuộn trong `ResultAnswers`**

Trong `components/result-answers.tsx`, ngay sau `const [active, setActive] = useState(0);` thêm:

```tsx
  const [activeOrder, setActiveOrder] = useState<number | null>(null);
  const desktopScrollRef = useRef<HTMLDivElement | null>(null);
  const mobileDetailsRef = useRef<HTMLDetailsElement | null>(null);
```

Sau khối tính `filledSource` (ngay trước `return (`), thêm:

```tsx
  // Cắt transcript theo câu dẫn chứng của part đang xem (dựa trên evidenceSnapshot).
  const { segments, linkedOrders } = useMemo(() => {
    if (!showSource) return { segments: [] as EvidenceSegment[], linkedOrders: [] as number[] };
    const targets = part.answers
      .filter((answer) => answer.order !== null && answer.evidenceSnapshot?.trim())
      .map((answer) => ({
        order: answer.order as number,
        evidence: answer.evidenceSnapshot as string,
        answers: answer.correctAnswerSnapshot ? answer.correctAnswerSnapshot.split(" | ") : []
      }));
    return buildEvidenceSegments(filledSource, targets, part.answersByOrder);
  }, [showSource, filledSource, part]);
  const linkedSet = useMemo(() => new Set(linkedOrders), [linkedOrders]);

  // Cuộn cột trái tới câu dẫn chứng đang chọn (cuộn trong khung, không cuộn cả trang).
  useEffect(() => {
    if (activeOrder === null) return;
    const box = desktopScrollRef.current;
    if (box) {
      const anchor = box.querySelector<HTMLElement>(`[data-evidence-order="${activeOrder}"]`);
      if (anchor) {
        const delta = anchor.getBoundingClientRect().top - box.getBoundingClientRect().top;
        box.scrollTo({ top: box.scrollTop + delta - box.clientHeight / 2, behavior: "smooth" });
      }
    }
    const details = mobileDetailsRef.current;
    if (details) {
      details.open = true;
      const anchor = details.querySelector<HTMLElement>(`[data-evidence-order="${activeOrder}"]`);
      anchor?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeOrder]);
```

Đổi nút tab (đang là `onClick={() => setActive(index)}`) thành reset câu chọn khi đổi part:

```tsx
            onClick={() => {
              setActive(index);
              setActiveOrder(null);
            }}
```

Trong khối mobile `<details>`: thêm `ref={mobileDetailsRef}` vào thẻ `<details ...>`, và thay
`<HighlightedSource text={filledSource} answers={part.answerStrings} />` bằng
`<EvidenceTranscript segments={segments} activeOrder={activeOrder} />`.

Trong khối desktop `<div ...>` (khối `lg:overflow-auto`): thêm `ref={desktopScrollRef}` vào thẻ `<div ...>`, và thay `<HighlightedSource ... />` bằng
`<EvidenceTranscript segments={segments} activeOrder={activeOrder} />`.

Thay vòng render thẻ câu:

```tsx
        <div className="space-y-4">
          {part.answers.map((answer) => (
            <AnswerCard
              key={answer.id}
              answer={answer}
              isLinked={answer.order !== null && linkedSet.has(answer.order)}
              isActive={answer.order !== null && answer.order === activeOrder}
              onSelect={(order) => setActiveOrder((current) => (current === order ? null : order))}
            />
          ))}
        </div>
```

- [ ] **Step 6: Chạy test + build**

Run: `pnpm test`
Expected: PASS (không hồi quy).
Run: `pnpm build`
Expected: PASS (không lỗi TypeScript/ESLint — chú ý biến/ import không dùng như `splitByAnswerMatches`, `part.answerStrings`).

Ghi chú: `part.answerStrings` giờ có thể không còn dùng trong `result-answers.tsx`. Nếu ESLint/TS báo, **không** xoá field khỏi type/`ResultPart` (còn nơi khác có thể dùng), chỉ cần không tham chiếu tới nó là đủ — field không dùng không gây lỗi build. Nếu có cảnh báo import thừa, xoá đúng import đó.

- [ ] **Step 7: Kiểm thử trình duyệt**

Khởi động dev server bằng preview tool (đừng dùng Bash chạy server). Cấu hình dev: `pnpm dev`, cổng 3000.

Đăng nhập tài khoản demo học viên (`student@example.com` / Google demo) — hoặc mở một `attemptId` kết quả Listening đã có transcript (vd link trong ảnh: `/student/results/<attemptId>`). Kiểm tra:
1. Mặc định transcript **không tô gì**.
2. Click thẻ **Câu 1** → câu chứa "Hardie" nền xanh, `H-A-R-D-I-E` đậm/gạch chân, badge `[1]` ở đầu câu; cột trái cuộn tới; thẻ Câu 1 có viền nổi bật.
3. Click **Câu 1** lần nữa → tắt highlight.
4. Click một câu **MC/TF/matching** (không có dẫn chứng) → không có gì xảy ra, thẻ không có con trỏ tay.
5. Đổi sang **Phần 2** → highlight reset về không.
6. `resize_window` mobile → click một câu: transcript (khối gấp-mở) tự mở và cuộn tới.

Dùng `read_page` / `read_console_messages` để xác nhận không lỗi console; chụp `screenshot` cảnh Câu 1 đang được tô làm bằng chứng.

- [ ] **Step 8: Commit**

```bash
git add components/result-answers.tsx components/result-review.tsx
git commit -m "feat: click câu hỏi -> tô câu dẫn chứng + badge + cuộn transcript"
```

---

## Self-Review (đã rà)

**Spec coverage:**
- Tô câu + đậm từ đáp án khi click → Task 2 Step 3 (`EvidenceTranscript`), dữ liệu từ Task 1.
- Badge `[n]` ở đầu câu → Task 2 Step 3 (`showBadge`).
- Tự cuộn cột trái (không cuộn cả trang) → Task 2 Step 5 (`useEffect`, cuộn trong khung).
- Mặc định không tô, chỉ tô khi click, mỗi lần một câu → `activeOrder` state (Task 2 Step 5), render theo `activeOrder`.
- Bấm cả thẻ; câu không có dẫn chứng thì thẻ trơ → Task 2 Step 4 (`interactive`) + `linkedSet` (Step 5).
- Reset khi đổi part → Task 2 Step 5 (tab onClick).
- Áp dụng cả trang học viên + giáo viên → dùng chung `ResultReview`/`ResultAnswers`, không cần đụng riêng.
- Không đổi schema/truy vấn/chấm → chỉ sửa 3 file (1 lib + 2 component), Task 2 Step 1 dùng `evidenceSnapshot` đã có.
- Mobile mở details + cuộn → Task 2 Step 5.

**Placeholder scan:** không có TODO/TBD; mọi step có code/lệnh cụ thể.

**Type consistency:** `buildEvidenceSegments` / `EvidenceSegment` / `EvidenceTarget` dùng nhất quán giữa Task 1 (định nghĩa) và Task 2 (tiêu thụ). `PartAnswer.evidenceSnapshot: string | null` khớp giữa `result-answers.tsx` (type) và `result-review.tsx` (push). Props `AnswerCard` (`isLinked`, `isActive`, `onSelect`) khớp với nơi gọi trong `ResultAnswers`.
