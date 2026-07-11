# Trang kết quả — transcript/bài đọc song song đáp án — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trang xem kết quả Listening/Reading hiển thị hai cột theo từng part (tab): transcript/bài đọc bên trái tô sáng đáp án, câu hỏi + đáp án bên phải — kiểu chin.edu.vn.

**Architecture:** Nâng helper khớp chuỗi (linh hoạt khoảng trắng) + thêm `fillSourceBlanks`. Tạo client component `ResultAnswers` (tab + hai cột). `result-review.tsx` gom `answers` theo part rồi render `ResultAnswers`, bỏ danh sách phẳng và section transcript cuối trang.

**Tech Stack:** Next.js 14 App Router, React 18 client component (`useState`), TypeScript strict, Tailwind, vitest. pnpm.

## Global Constraints

- Text hiển thị/comment bằng **tiếng Việt**.
- Không đổi schema, không đụng chấm điểm/import/Writing-Speaking. Cột `evidenceSnapshot` giữ trong DB, chỉ **bỏ hiển thị**.
- Cột trái là **văn bản thuần + tô sáng + thay `[[n]]`**; không tái dùng renderer của `attempt-workspace.tsx`.
- Bố cục: tab theo part; hai cột trên `lg`, xếp dọc trên mobile (nguồn nằm trong `<details>` gấp-mở ở mobile).
- Nguồn cột trái: Listening → `transcript`, Reading → `content`, còn lại → không có (một cột).

---

### Task 1: Nâng helper khớp chuỗi + `fillSourceBlanks`

**Files:**
- Modify: `lib/answer-evidence.ts` (`splitByAnswerMatches` ~dòng 50-85; thêm `fillSourceBlanks`)
- Test: `tests/answer-evidence.test.ts` (bổ sung)

**Interfaces:**
- Consumes: `escapeRegExp` (đã có trong file).
- Produces:
  - `splitByAnswerMatches(text: string, answers: string[]): Array<{ text: string; match: boolean }>` — khớp linh hoạt khoảng trắng.
  - `fillSourceBlanks(source: string, answersByOrder: Record<number, string>): string`.

- [ ] **Step 1: Thêm test thất bại** — nối thêm vào `tests/answer-evidence.test.ts` (trong `describe("splitByAnswerMatches", ...)` thêm 2 `it`, và thêm `describe` mới cho `fillSourceBlanks`; nhớ thêm `fillSourceBlanks` vào dòng import đầu file):

Sửa dòng import đầu file thành:

```ts
import { deriveAnswerEvidence, splitByAnswerMatches, fillSourceBlanks } from "@/lib/answer-evidence";
```

Thêm vào trong `describe("splitByAnswerMatches", () => {` (trước dấu `});` đóng của nó):

```ts
  it("khớp linh hoạt khoảng trắng: đáp án không cách khớp bản có cách", () => {
    const parts = splitByAnswerMatches("Postcode GT8 2LC here.", ["GT82LC"]);
    expect(parts).toEqual([
      { text: "Postcode ", match: false },
      { text: "GT8 2LC", match: true },
      { text: " here.", match: false }
    ]);
  });

  it("khớp linh hoạt khoảng trắng: đáp án có cách khớp bản không cách", () => {
    const parts = splitByAnswerMatches("Code GT82LC done.", ["GT8 2LC"]);
    expect(parts).toEqual([
      { text: "Code ", match: false },
      { text: "GT82LC", match: true },
      { text: " done.", match: false }
    ]);
  });

  it("chọn biến thể đáp án xuất hiện trong text", () => {
    const parts = splitByAnswerMatches("I am John Peterson here.", ["John Petterson", "John Peterson"]);
    expect(parts.some((p) => p.match && p.text === "John Peterson")).toBe(true);
  });
```

Thêm `describe` mới ở cuối file:

```ts
describe("fillSourceBlanks", () => {
  it("thay [[n]] bằng đáp án đúng của câu order n", () => {
    expect(fillSourceBlanks("The [[1]] is hot.", { 1: "core" })).toBe("The core is hot.");
  });

  it("thiếu đáp án -> ____", () => {
    expect(fillSourceBlanks("A [[2]] b", {})).toBe("A ____ b");
  });

  it("không có blank -> giữ nguyên", () => {
    expect(fillSourceBlanks("No blanks here", { 1: "x" })).toBe("No blanks here");
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận fail**

Run: `npx vitest run tests/answer-evidence.test.ts`
Expected: FAIL — `fillSourceBlanks` không tồn tại và/hoặc "GT8 2LC" không khớp.

- [ ] **Step 3: Sửa `splitByAnswerMatches` + thêm `fillSourceBlanks`** — trong `lib/answer-evidence.ts`.

Thay TOÀN BỘ hàm `splitByAnswerMatches` hiện có bằng:

```ts
// Ghép mẫu regex khớp đáp án linh hoạt khoảng trắng: bỏ khoảng trắng trong đáp án,
// nối từng ký tự bằng \s* để khớp cả bản có cách lẫn không cách ("GT82LC" ↔ "GT8 2LC").
function flexiblePattern(answer: string): string {
  const chars = answer.replace(/\s+/g, "").split("").map(escapeRegExp);
  if (chars.length === 0) {
    return "";
  }
  return `\\b${chars.join("\\s*")}\\b`;
}

// Tách text thành các đoạn { text, match } — phần match=true là chỗ trùng đáp án
// (khớp linh hoạt khoảng trắng, không phân biệt hoa/thường). Không có đáp án nào
// khớp -> trả nguyên text (match=false).
export function splitByAnswerMatches(
  text: string,
  answers: string[]
): Array<{ text: string; match: boolean }> {
  const candidates = answers
    .map((answer) => answer.trim())
    .filter(Boolean)
    // Ưu tiên đáp án dài hơn (tính theo số ký tự không kể khoảng trắng).
    .sort((a, b) => b.replace(/\s+/g, "").length - a.replace(/\s+/g, "").length);

  const patterns = candidates.map(flexiblePattern).filter(Boolean);
  if (patterns.length === 0) {
    return [{ text, match: false }];
  }

  const combined = new RegExp(patterns.join("|"), "gi");
  const parts: Array<{ text: string; match: boolean }> = [];
  let lastIndex = 0;
  let found: RegExpExecArray | null;

  while ((found = combined.exec(text)) !== null) {
    if (found.index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, found.index), match: false });
    }
    parts.push({ text: found[0], match: true });
    lastIndex = found.index + found[0].length;
    if (found[0].length === 0) {
      combined.lastIndex += 1; // tránh vòng lặp vô hạn
    }
  }

  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), match: false });
  }

  return parts.length > 0 ? parts : [{ text, match: false }];
}

// Thay [[n]] trong nguồn (bài đọc/transcript) bằng đáp án đúng của câu order=n để đọc
// liền mạch; thiếu đáp án -> "____". Không có [[n]] -> trả nguyên nguồn.
export function fillSourceBlanks(
  source: string,
  answersByOrder: Record<number, string>
): string {
  return source.replace(/\[\[(\d+)\]\]/g, (_match, n) => {
    const answer = answersByOrder[Number(n)];
    return answer && answer.trim() ? answer : "____";
  });
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npx vitest run tests/answer-evidence.test.ts`
Expected: PASS (toàn bộ, gồm các test cũ + mới).

- [ ] **Step 5: Commit**

```bash
git add lib/answer-evidence.ts tests/answer-evidence.test.ts
git commit -m "feat: khớp tô sáng linh hoạt khoảng trắng + fillSourceBlanks"
```

---

### Task 2: Component hai cột + tab, và nối vào trang kết quả

**Files:**
- Create: `components/result-answers.tsx`
- Modify: `components/result-review.tsx`
- Modify: `app/student/results/[attemptId]/page.tsx` (select `assignableUnit`)
- Modify: `app/teacher/results/[attemptId]/page.tsx` (select `assignableUnit`)

**Interfaces:**
- Consumes: `splitByAnswerMatches`, `fillSourceBlanks` (Task 1); `AnnotatedAnswer`/`Annotation`, `isAudioUrl`.
- Produces: `ResultAnswers({ parts: ResultPart[] })`; export `type ResultPart`, `type PartAnswer`.

- [ ] **Step 1: Thêm `content` vào truy vấn (2 trang)**

`app/student/results/[attemptId]/page.tsx` — sửa select `assignableUnit`:

```ts
          assignableUnit: {
            select: { title: true, skill: true, transcript: true, content: true }
          },
```

`app/teacher/results/[attemptId]/page.tsx` — sửa tương tự:

```ts
          assignableUnit: {
            select: { title: true, skill: true, transcript: true, content: true }
          },
```

- [ ] **Step 2: Tạo component `components/result-answers.tsx`**

```tsx
"use client";

import { useState } from "react";
import { AnnotatedAnswer, type Annotation } from "@/components/annotated-answer";
import { fillSourceBlanks, splitByAnswerMatches } from "@/lib/answer-evidence";
import { isAudioUrl } from "@/lib/question-interactions";

export type PartAnswer = {
  id: string;
  order: number | null;
  prompt: string | null;
  points: number | null;
  value: string;
  isCorrect: boolean | null;
  pointsAwarded: number | null;
  correctAnswerSnapshot: string | null;
  explanationSnapshot: string | null;
  annotations: Annotation[];
};

export type ResultPart = {
  unitId: string;
  title: string;
  skill: string;
  sourceText: string | null;
  answers: PartAnswer[];
  answerStrings: string[];
  answersByOrder: Record<number, string>;
  minOrder: number | null;
  maxOrder: number | null;
};

function correctnessLabel(value: boolean | null) {
  if (value === true) return "Đúng";
  if (value === false) return "Sai";
  return "Chờ chấm";
}

function correctnessClass(value: boolean | null) {
  if (value === true)
    return "border-emerald-400/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300";
  if (value === false)
    return "border-red-400/50 bg-red-500/10 text-red-600 dark:text-red-300";
  return "border-accent/50 bg-accent/10 text-accent-foreground dark:text-accent";
}

// Văn bản nguồn với các đáp án đúng được tô sáng.
function HighlightedSource({ text, answers }: { text: string; answers: string[] }) {
  const parts = splitByAnswerMatches(text, answers);
  return (
    <>
      {parts.map((part, index) =>
        part.match ? (
          <mark
            key={index}
            className="rounded bg-emerald-500/25 px-0.5 font-semibold text-emerald-800 dark:bg-emerald-400/25 dark:text-emerald-200"
          >
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        )
      )}
    </>
  );
}

function AnswerCard({ answer }: { answer: PartAnswer }) {
  return (
    <article className="rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <h4 className="font-semibold">
          {answer.order !== null ? `Câu ${answer.order}` : "Câu chưa liên kết"}
        </h4>
        <span
          className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${correctnessClass(
            answer.isCorrect
          )}`}
        >
          {correctnessLabel(answer.isCorrect)}
        </span>
      </div>
      {answer.prompt ? (
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{answer.prompt}</p>
      ) : null}
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-muted/60 p-3">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Bạn trả lời
          </dt>
          <dd className="mt-2">
            {answer.value ? (
              isAudioUrl(answer.value) ? (
                <audio controls src={answer.value} className="w-full" preload="metadata">
                  <track kind="captions" />
                </audio>
              ) : (
                <AnnotatedAnswer text={answer.value} annotations={answer.annotations} />
              )
            ) : (
              <span className="whitespace-pre-wrap">Bỏ trống</span>
            )}
          </dd>
        </div>
        <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/5 p-3">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Đáp án đúng
          </dt>
          <dd className="mt-2 whitespace-pre-wrap">{answer.correctAnswerSnapshot || "Không có"}</dd>
        </div>
      </dl>
      {answer.explanationSnapshot ? (
        <div className="mt-3 rounded-lg border border-border bg-muted/60 p-3 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Giải thích
          </p>
          <p className="mt-2 leading-6">{answer.explanationSnapshot}</p>
        </div>
      ) : null}
      <p className="mt-3 text-sm text-muted-foreground">
        {answer.isCorrect === null ? (
          "Chờ giáo viên chấm"
        ) : (
          <>
            Điểm: {answer.pointsAwarded ?? 0}
            {answer.points !== null ? ` / ${answer.points}` : ""}
          </>
        )}
      </p>
    </article>
  );
}

export function ResultAnswers({ parts }: { parts: ResultPart[] }) {
  const [active, setActive] = useState(0);

  if (parts.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground shadow-card">
        Chưa có đáp án nào cho lần làm bài này.
      </section>
    );
  }

  const part = parts[Math.min(active, parts.length - 1)];
  const showSource = !!part.sourceText && (part.skill === "listening" || part.skill === "reading");
  const sourceLabel = part.skill === "listening" ? "Transcript" : "Bài đọc";
  const filledSource = showSource
    ? fillSourceBlanks(part.sourceText as string, part.answersByOrder)
    : "";

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {parts.map((p, index) => (
          <button
            key={p.unitId}
            type="button"
            onClick={() => setActive(index)}
            className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
              index === active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:border-primary"
            }`}
          >
            Phần {index + 1}
            {p.minOrder !== null && p.maxOrder !== null ? (
              <span className="ml-1 font-normal opacity-80">
                · Câu {p.minOrder}–{p.maxOrder}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <p className="text-sm font-semibold text-primary">{part.title}</p>

      <div className={showSource ? "grid gap-4 lg:grid-cols-2" : ""}>
        {showSource ? (
          <>
            {/* Mobile: gấp-mở, để câu hỏi ở ngay dưới */}
            <details className="rounded-xl border border-border bg-card shadow-card lg:hidden">
              <summary className="cursor-pointer px-5 py-3 text-sm font-semibold">
                {sourceLabel}
              </summary>
              <p className="whitespace-pre-wrap px-5 pb-4 text-sm leading-7">
                <HighlightedSource text={filledSource} answers={part.answerStrings} />
              </p>
            </details>
            {/* Desktop: cột trái dính, cuộn riêng */}
            <div className="hidden overflow-hidden rounded-xl border border-border bg-card shadow-card lg:block lg:sticky lg:top-4 lg:max-h-[75vh] lg:self-start lg:overflow-auto">
              <div className="border-b border-border px-5 py-3 text-sm font-semibold">
                {sourceLabel}
              </div>
              <p className="whitespace-pre-wrap px-5 py-4 text-sm leading-7">
                <HighlightedSource text={filledSource} answers={part.answerStrings} />
              </p>
            </div>
          </>
        ) : null}

        <div className="space-y-4">
          {part.answers.map((answer) => (
            <AnswerCard key={answer.id} answer={answer} />
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Nối vào `components/result-review.tsx` — sửa imports + type**

Thay 5 dòng import đầu file bằng:

```tsx
import { type Annotation } from "@/components/annotated-answer";
import { ResultAnswers, type ResultPart } from "@/components/result-answers";
import { bandsBySkill, formatBand } from "@/lib/band-score";
import { formatDuration } from "@/lib/format-duration";
```

Trong `type Answer`, thêm `assignableUnitId` và `content`:

```tsx
type Answer = {
  id: string;
  assignableUnitId: string;
  value: string;
  isCorrect: boolean | null;
  pointsAwarded: number | null;
  correctAnswerSnapshot: string | null;
  explanationSnapshot: string | null;
  evidenceSnapshot: string | null;
  annotations: Annotation[];
  question: {
    order: number;
    prompt: string;
    points: number;
  } | null;
  assignableUnit: {
    title: string;
    skill: string;
    transcript?: string | null;
    content?: string | null;
  };
};
```

- [ ] **Step 4: Xoá helper/thành phần không còn dùng trong `result-review.tsx`**

Xoá toàn bộ 3 hàm `correctnessLabel`, `correctnessClass` (~dòng 81-103) và hàm component `UnderlinedEvidence` (~ngay trước `export function ResultReview`). (Chúng đã chuyển sang `result-answers.tsx`.)

- [ ] **Step 5: Gom parts + thay phần render trong `ResultReview`**

Trong thân `export function ResultReview(...)`, ngay trước `return (`, thêm đoạn gom parts:

```tsx
  // Gom đáp án theo từng part (assignableUnit), giữ thứ tự xuất hiện. Nguồn cột trái:
  // Listening = transcript, Reading = content, còn lại = null (hiện một cột).
  const partMap = new Map<string, ResultPart>();
  for (const answer of attempt.answers) {
    const unit = answer.assignableUnit;
    let part = partMap.get(answer.assignableUnitId);
    if (!part) {
      const sourceText =
        unit.skill === "listening"
          ? unit.transcript ?? null
          : unit.skill === "reading"
            ? unit.content ?? null
            : null;
      part = {
        unitId: answer.assignableUnitId,
        title: unit.title,
        skill: unit.skill,
        sourceText,
        answers: [],
        answerStrings: [],
        answersByOrder: {},
        minOrder: null,
        maxOrder: null
      };
      partMap.set(answer.assignableUnitId, part);
    }
    part.answers.push({
      id: answer.id,
      order: answer.question?.order ?? null,
      prompt: answer.question?.prompt ?? null,
      points: answer.question?.points ?? null,
      value: answer.value,
      isCorrect: answer.isCorrect,
      pointsAwarded: answer.pointsAwarded,
      correctAnswerSnapshot: answer.correctAnswerSnapshot,
      explanationSnapshot: answer.explanationSnapshot,
      annotations: answer.annotations
    });
    const corrects = answer.correctAnswerSnapshot
      ? answer.correctAnswerSnapshot.split(" | ")
      : [];
    part.answerStrings.push(...corrects);
    if (answer.question) {
      const order = answer.question.order;
      if (corrects[0]) {
        part.answersByOrder[order] = corrects[0];
      }
      part.minOrder = part.minOrder === null ? order : Math.min(part.minOrder, order);
      part.maxOrder = part.maxOrder === null ? order : Math.max(part.maxOrder, order);
    }
  }
  const parts = [...partMap.values()];
```

Thay khối JSX từ `<section ...>` chứa `<h3>Đáp án</h3>` (mở ở ~dòng 245) cho tới hết IIFE transcript `})()}` (đóng ở ~dòng 405, ngay trước `{attempt.highlights.length > 0 ? (`) bằng đúng một dòng:

```tsx
      <ResultAnswers parts={parts} />
```

(Giữ nguyên phần `{attempt.highlights.length > 0 ? (...) : null}` phía sau và mọi phần phía trên section "Đáp án".)

- [ ] **Step 6: Build kiểm tra biên dịch**

Run: `pnpm build`
Expected: `✓ Compiled successfully`, không lỗi TypeScript (các import đã xoá không còn được tham chiếu; `isAudioUrl`/`AnnotatedAnswer`/`splitByAnswerMatches` giờ chỉ dùng trong `result-answers.tsx`).

- [ ] **Step 7: Verify trình duyệt bằng dữ liệu tổng hợp**

Tạo file `tmp/_verify_sbs.ts` với nội dung dưới (một bài Listening có transcript + [[n]] và một passage Reading), chạy `npx tsx tmp/_verify_sbs.ts` để lấy `ATTEMPT_ID`:

```ts
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const TAG = "__VERIFY_SBS__";
async function main() {
  const teacher = await prisma.teacherProfile.findFirstOrThrow();
  const student = await prisma.studentProfile.findFirstOrThrow();
  const material = await prisma.material.create({
    data: {
      teacherId: teacher.id, skill: "listening", title: `${TAG} Material`,
      units: { create: [
        { skill: "listening", unitType: "listening_part", unitNumber: 1, title: "Verify Listening Part 1",
          content: "Nghe và điền [[1]] và [[2]].",
          transcript: "Hello, my name is John Peterson. The postcode is GT8 2LC and the tour is at 12 o'clock.",
          questions: { create: [
            { order: 1, questionType: "note_completion", prompt: "Câu 1", correctAnswerJson: JSON.stringify(["John Peterson"]), points: 1 },
            { order: 2, questionType: "note_completion", prompt: "Câu 2", correctAnswerJson: JSON.stringify(["GT82LC"]), points: 1 }
          ] } },
        { skill: "reading", unitType: "reading_passage", unitNumber: 2, title: "Verify Reading Part 2",
          content: "Power companies use solar energy. The core is extremely hot in summer.",
          questions: { create: [
            { order: 3, questionType: "short_answer", prompt: "Who uses solar?", correctAnswerJson: JSON.stringify(["Power companies"]), points: 1 },
            { order: 4, questionType: "multiple_choice", prompt: "The core is:", optionsJson: JSON.stringify(["A","B","C"]), correctAnswerJson: JSON.stringify(["B"]), points: 1 }
          ] } }
      ] }
    },
    include: { units: { include: { questions: true } } }
  });
  const assignment = await prisma.assignment.create({
    data: { teacherId: teacher.id, title: `${TAG} Assignment`,
      units: { create: material.units.map((u, i) => ({ assignableUnitId: u.id, order: i + 1 })) },
      recipients: { create: [{ studentId: student.id, status: "submitted", submittedAt: new Date() }] } },
    include: { recipients: true }
  });
  const attempt = await prisma.attempt.create({
    data: { assignmentRecipientId: assignment.recipients[0].id, studentId: student.id,
      status: "submitted", submittedAt: new Date(), scorePercent: 50, score: 2 }
  });
  const vals: Record<number, string> = { 1: "John Peterson", 2: "GT8 2LC", 3: "power companies", 4: "A" };
  for (const unit of material.units) {
    for (const q of unit.questions) {
      const corr = JSON.parse(q.correctAnswerJson!) as string[];
      const v = vals[q.order] ?? "";
      const ok = corr.some((c) => c.toLowerCase().replace(/\s+/g, "") === v.toLowerCase().replace(/\s+/g, ""));
      await prisma.answer.create({ data: {
        attemptId: attempt.id, studentId: student.id, questionId: q.id, assignableUnitId: unit.id,
        value: v, isCorrect: ok, pointsAwarded: ok ? 1 : 0, correctAnswerSnapshot: corr.join(" | ")
      } });
    }
  }
  console.log("ATTEMPT_ID=" + attempt.id);
  await prisma.$disconnect();
}
main();
```

Mở dev server (`preview_start` name `ielts-dev`), đăng nhập giáo viên (`teacher@example.com` / `teacher123`), vào `/teacher/results/<ATTEMPT_ID>`. Xác nhận: có tab Phần 1 / Phần 2; Part 1 (Listening) cột trái là transcript, tô sáng "John Peterson" và "GT8 2LC"; Part 2 (Reading) cột trái là passage, tô sáng "Power companies"; cột phải gọn, câu trắc nghiệm không tô. Thu nhỏ cửa sổ (mobile) xác nhận nguồn nằm trong khối gấp-mở phía trên. Chụp ảnh.

Dọn dữ liệu + file tạm:

```ts
// tmp/_verify_sbs_cleanup.ts
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
await p.assignment.deleteMany({ where: { title: { startsWith: "__VERIFY_SBS__" } } });
await p.material.deleteMany({ where: { title: { startsWith: "__VERIFY_SBS__" } } });
console.log("cleaned");
await p.$disconnect();
```

Run: `npx tsx tmp/_verify_sbs_cleanup.ts && rm -f tmp/_verify_sbs.ts tmp/_verify_sbs_cleanup.ts`

- [ ] **Step 8: Commit**

```bash
git add components/result-answers.tsx components/result-review.tsx "app/student/results/[attemptId]/page.tsx" "app/teacher/results/[attemptId]/page.tsx"
git commit -m "feat: trang kết quả hai cột transcript/bài đọc song song đáp án theo part"
```

---

### Task 3: Kiểm thử toàn bộ + đẩy lên + kiểm tra prod

**Files:** không sửa code.

- [ ] **Step 1: Chạy toàn bộ test**

Run: `pnpm test`
Expected: tất cả xanh.

- [ ] **Step 2: Build production**

Run: `pnpm build`
Expected: thành công.

- [ ] **Step 3: Push (Vercel auto-deploy)**

```bash
git push origin feature/ielts-platform-mvp
```

- [ ] **Step 4: Kiểm tra prod** — sau deploy, mở prod, đăng nhập giáo viên, vào lại bài kết quả Listening Test 1 (attempt `cmrfvukek0002jpken629qudf` mà người dùng đã làm) xác nhận bố cục tab + hai cột + tô sáng transcript hiển thị đúng.

---

## Ghi chú thực thi

- `ResultAnswers` là client component (`"use client"`) vì có tab (`useState`); `result-review.tsx` vẫn là server component, chỉ gom dữ liệu rồi truyền xuống.
- Bài Listening/Reading cũ chưa có transcript/content: part đó rơi về một cột (chỉ câu hỏi) — không lỗi.
- `evidenceSnapshot` vẫn nằm trong DB, chỉ không hiển thị. Không đổi schema.
- `correctAnswerSnapshot` lưu dạng join `" | "` (xem `answerSnapshot` trong `lib/attempt-grading.ts`) — tách bằng `.split(" | ")`.
