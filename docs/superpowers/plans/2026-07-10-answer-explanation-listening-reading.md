# Giải thích / dẫn chứng đáp án cho Listening & Reading — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hiển thị "đoạn chứa đáp án" (dẫn chứng) cho mỗi câu Listening/Reading trên trang kết quả — Reading trích đoạn, Listening gạch chân trong transcript + nút xem full transcript.

**Architecture:** Dẫn chứng đến từ hai nguồn đổ về cùng một trường `Question.answerEvidence`: (a) AI xuất `evidence`/`transcript` ở bước tạo file import (không gọi AI trong app), (b) code tự dò câu chứa đáp án nguyên văn cho câu điền từ. Lúc chấm, dẫn chứng được chụp vào `Answer.evidenceSnapshot`, rồi `components/result-review.tsx` hiển thị.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Prisma + PostgreSQL (Neon), vitest. Package manager pnpm.

## Global Constraints

- Text hiển thị và comment code bằng **tiếng Việt**; dẫn chứng trích **nguyên văn tiếng Anh** trong bài.
- Prisma "enum" là cột `String`, không dùng Prisma enum. Không thêm enum mới.
- Áp dụng cột schema bằng `pnpm prisma db push` (không dùng `migrate`).
- Mọi server action bắt đầu bằng `requireTeacher()`/`requireStudent()` và scope Prisma theo user — task này không thêm action mới nhưng khi sửa action cũ phải giữ nguyên check này.
- Không gọi AI trong app; không đụng Writing/Speaking; giữ nguyên trường "Giải thích" (`explanation`) sẵn có.
- Loại câu "điền từ" (tự dò được) = `note_completion`, `table_completion`, `short_answer`. Còn lại (`multiple_choice`, `true_false_not_given`, `matching`, ...) không tự dò.

---

### Task 1: Helper thuần `lib/answer-evidence.ts` (dò dẫn chứng + tách đoạn để gạch chân)

**Files:**
- Create: `lib/answer-evidence.ts`
- Test: `tests/answer-evidence.test.ts`

**Interfaces:**
- Consumes: không có (thuần).
- Produces:
  - `deriveAnswerEvidence(questionType: string, correctAnswers: string[], sourceText: string | null): string | null`
  - `splitByAnswerMatches(text: string, answers: string[]): Array<{ text: string; match: boolean }>`

- [ ] **Step 1: Viết test thất bại** — `tests/answer-evidence.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { deriveAnswerEvidence, splitByAnswerMatches } from "@/lib/answer-evidence";

describe("deriveAnswerEvidence", () => {
  const passage =
    "Lightning is dangerous. Power companies lose money every year. Atoms split apart.";

  it("trả câu chứa đáp án nguyên văn cho câu điền từ", () => {
    expect(deriveAnswerEvidence("short_answer", ["power companies"], passage)).toBe(
      "Power companies lose money every year."
    );
  });

  it("không phân biệt hoa/thường", () => {
    expect(deriveAnswerEvidence("note_completion", ["ATOMS"], passage)).toBe(
      "Atoms split apart."
    );
  });

  it("khớp theo ranh giới từ, không lọt số con", () => {
    const src = "The room holds 120 people. Bus number 12 leaves at noon.";
    expect(deriveAnswerEvidence("note_completion", ["12"], src)).toBe(
      "Bus number 12 leaves at noon."
    );
  });

  it("ưu tiên đáp án dài nhất trong danh sách chấp nhận", () => {
    expect(deriveAnswerEvidence("short_answer", ["companies", "power companies"], passage)).toBe(
      "Power companies lose money every year."
    );
  });

  it("trả null với loại câu nhãn (MC/TF-NG/matching)", () => {
    expect(deriveAnswerEvidence("multiple_choice", ["B"], passage)).toBeNull();
    expect(deriveAnswerEvidence("true_false_not_given", ["TRUE"], passage)).toBeNull();
  });

  it("trả null khi thiếu nguồn hoặc không tìm thấy", () => {
    expect(deriveAnswerEvidence("short_answer", ["x"], null)).toBeNull();
    expect(deriveAnswerEvidence("short_answer", ["zzz"], passage)).toBeNull();
  });
});

describe("splitByAnswerMatches", () => {
  it("tách phần khớp đáp án để gạch chân", () => {
    const parts = splitByAnswerMatches("Bus number 12 leaves.", ["12"]);
    expect(parts).toEqual([
      { text: "Bus number ", match: false },
      { text: "12", match: true },
      { text: " leaves.", match: false }
    ]);
  });

  it("không có đáp án nguyên văn -> một phần không khớp", () => {
    expect(splitByAnswerMatches("See paragraph B.", ["B a laser technique"])).toEqual([
      { text: "See paragraph B.", match: false }
    ]);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận fail**

Run: `npx vitest run tests/answer-evidence.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/answer-evidence"`.

- [ ] **Step 3: Viết implementation** — `lib/answer-evidence.ts`

```ts
// Dò "đoạn chứa đáp án" (dẫn chứng) từ bài đọc/transcript và tách phần khớp
// đáp án để gạch chân khi hiển thị. Chỉ dùng cho các câu điền từ có đáp án nằm
// nguyên văn trong nguồn; câu nhãn (MC/TF-NG/matching) trả null.

// Loại câu có đáp án là từ/cụm nguyên văn trong bài.
const LITERAL_ANSWER_TYPES = new Set(["note_completion", "table_completion", "short_answer"]);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Regex khớp đáp án theo ranh giới từ, không phân biệt hoa/thường.
function answerRegExp(answer: string): RegExp {
  return new RegExp(`\\b${escapeRegExp(answer)}\\b`, "i");
}

// Trả câu trong sourceText chứa đáp án nguyên văn, hoặc null.
export function deriveAnswerEvidence(
  questionType: string,
  correctAnswers: string[],
  sourceText: string | null
): string | null {
  if (!sourceText || !LITERAL_ANSWER_TYPES.has(questionType)) {
    return null;
  }

  const sentences = sourceText
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  // Ưu tiên đáp án dài nhất để khớp cụm chính xác hơn từ đơn.
  const candidates = correctAnswers
    .map((answer) => answer.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  for (const answer of candidates) {
    const pattern = answerRegExp(answer);
    const hit = sentences.find((sentence) => pattern.test(sentence));
    if (hit) {
      return hit;
    }
  }

  return null;
}

// Tách text thành các đoạn { text, match } — phần match=true là chỗ trùng đáp án
// nguyên văn (để bọc gạch chân). Không tìm thấy -> trả nguyên text (match=false).
export function splitByAnswerMatches(
  text: string,
  answers: string[]
): Array<{ text: string; match: boolean }> {
  const candidates = answers
    .map((answer) => answer.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  if (candidates.length === 0) {
    return [{ text, match: false }];
  }

  const combined = new RegExp(
    `\\b(${candidates.map(escapeRegExp).join("|")})\\b`,
    "gi"
  );

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
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npx vitest run tests/answer-evidence.test.ts`
Expected: PASS (8 test).

- [ ] **Step 5: Commit**

```bash
git add lib/answer-evidence.ts tests/answer-evidence.test.ts
git commit -m "feat: helper dò dẫn chứng đáp án + tách đoạn gạch chân"
```

---

### Task 2: Cột schema `answerEvidence` / `evidenceSnapshot`

**Files:**
- Modify: `prisma/schema.prisma` (model `Question` ~dòng 119-131, model `Answer` ~dòng 221-240)
- Modify: `tests/foundation.test.ts` (thêm assertion cột mới)

**Interfaces:**
- Consumes: không.
- Produces: cột `Question.answerEvidence String?`, `Answer.evidenceSnapshot String?` (các task sau dựa vào).

- [ ] **Step 1: Thêm assertion test thất bại** — trong `tests/foundation.test.ts`, tìm khối `it("...schema...")` chứa các `expect(schema).toContain(...)` (gần dòng 15-21) và thêm ngay sau dòng `expect(schema).toContain("submitReason          String?");`:

```ts
    expect(schema).toContain("answerEvidence    String?");
    expect(schema).toContain("evidenceSnapshot      String?");
```

- [ ] **Step 2: Chạy test để xác nhận fail**

Run: `npx vitest run tests/foundation.test.ts`
Expected: FAIL — không tìm thấy chuỗi `answerEvidence`.

- [ ] **Step 3: Thêm cột vào schema** — `prisma/schema.prisma`

Trong `model Question`, ngay sau dòng `explanation       String?`:

```prisma
  answerEvidence    String?
```

Trong `model Answer`, ngay sau dòng `explanationSnapshot   String?`:

```prisma
  evidenceSnapshot      String?
```

- [ ] **Step 4: Generate client + push cột lên DB**

Run: `pnpm prisma generate && pnpm prisma db push`
Expected: `generate` xong; `db push` báo "Your database is now in sync" (thêm 2 cột, không mất dữ liệu).

- [ ] **Step 5: Chạy test để xác nhận pass**

Run: `npx vitest run tests/foundation.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma tests/foundation.test.ts
git commit -m "feat: cột answerEvidence (Question) + evidenceSnapshot (Answer)"
```

---

### Task 3: Chụp dẫn chứng vào `evidenceSnapshot` khi chấm

**Files:**
- Modify: `lib/attempt-grading.ts` (type ~dòng 5-34; hàm `gradeUnits` ~dòng 59-139)
- Modify: `lib/actions/attempts.ts` (map truyền vào `gradeUnits` ~dòng 249-256)
- Modify: `tests/attempt-grading.test.ts`

**Interfaces:**
- Consumes: `deriveAnswerEvidence` (Task 1); cột `answerEvidence` (Task 2).
- Produces: `GradedAnswerRow.evidenceSnapshot: string | null`; `QuestionForGrading.answerEvidence: string | null`; `UnitForGrading.content: string | null`, `UnitForGrading.transcript: string | null`.

- [ ] **Step 1: Cập nhật test thất bại** — thay toàn bộ nội dung `tests/attempt-grading.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { gradeUnits } from "@/lib/attempt-grading";

const readingUnit = {
  assignableUnitId: "u1",
  skill: "reading",
  content: "The capital of France is Paris, a large city.",
  transcript: null,
  questions: [
    { id: "q1", order: 1, questionType: "short_answer", optionsJson: null,
      correctAnswerJson: JSON.stringify(["Paris"]), explanation: null,
      answerEvidence: null, points: 1 }
  ]
};

const writingUnit = {
  assignableUnitId: "u2",
  skill: "writing",
  content: null,
  transcript: null,
  questions: [
    { id: "q2", order: 1, questionType: "essay", optionsJson: null,
      correctAnswerJson: null, explanation: null, answerEvidence: null, points: 1 }
  ]
};

describe("gradeUnits", () => {
  it("auto-grades reading answers", () => {
    const values: Record<string, string> = { q1: "paris" };
    const result = gradeUnits([readingUnit], (id) => values[id] ?? "");
    expect(result.answerRows[0].isCorrect).toBe(true);
    expect(result.answerRows[0].pointsAwarded).toBe(1);
    expect(result.gradeItems).toHaveLength(1);
  });

  it("leaves writing answers ungraded (chờ chấm)", () => {
    const values: Record<string, string> = { q2: "My essay" };
    const result = gradeUnits([writingUnit], (id) => values[id] ?? "");
    expect(result.answerRows[0].isCorrect).toBeNull();
    expect(result.answerRows[0].pointsAwarded).toBeNull();
    expect(result.gradeItems).toHaveLength(0);
  });

  it("tự dò dẫn chứng từ content khi answerEvidence trống", () => {
    const result = gradeUnits([readingUnit], () => "paris");
    expect(result.answerRows[0].evidenceSnapshot).toBe(
      "The capital of France is Paris, a large city."
    );
  });

  it("ưu tiên answerEvidence có sẵn hơn tự dò", () => {
    const unit = {
      ...readingUnit,
      questions: [{ ...readingUnit.questions[0], answerEvidence: "Dẫn chứng do AI cung cấp." }]
    };
    const result = gradeUnits([unit], () => "paris");
    expect(result.answerRows[0].evidenceSnapshot).toBe("Dẫn chứng do AI cung cấp.");
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận fail**

Run: `npx vitest run tests/attempt-grading.test.ts`
Expected: FAIL — `evidenceSnapshot` undefined (chưa có trong answerRows) và/hoặc lỗi kiểu.

- [ ] **Step 3: Cập nhật types + import** — `lib/attempt-grading.ts`

Thêm một dòng import ngay dưới các import sẵn có ở đầu file (dòng 1-3):

```ts
import { deriveAnswerEvidence } from "@/lib/answer-evidence";
```

Trong `QuestionForGrading` thêm sau `explanation`:

```ts
  answerEvidence: string | null;
```

Trong `UnitForGrading` thêm sau `skill`:

```ts
  content: string | null;
  transcript: string | null;
```

Trong `GradedAnswerRow` thêm sau `explanationSnapshot`:

```ts
  evidenceSnapshot: string | null;
```

- [ ] **Step 4: Tính evidenceSnapshot trong `gradeUnits`** — `lib/attempt-grading.ts`

Ngay đầu vòng `for (const unit of units) {` (sau dòng `const isManualSkill = ...`), thêm helper cục bộ:

```ts
    // Nguồn dò dẫn chứng: bài đọc (Reading) hoặc transcript (Listening).
    const evidenceSource = unit.transcript ?? unit.content ?? null;
    const evidenceFor = (question: QuestionForGrading): string | null =>
      question.answerEvidence ??
      deriveAnswerEvidence(
        question.questionType,
        parseCorrectAnswers(question.correctAnswerJson),
        evidenceSource
      );
```

Trong nhánh `isManualSkill` (khối `answerRows.push({...})` dòng ~100-108), thêm field:

```ts
          evidenceSnapshot: evidenceFor(question)
```

Trong nhánh chấm tự động (khối `answerRows.push({...})` dòng ~116-124), thêm field:

```ts
        evidenceSnapshot: evidenceFor(question)
```

- [ ] **Step 5: Truyền content/transcript ở caller** — `lib/actions/attempts.ts` dòng 249-256, sửa map:

```ts
  const graded = gradeUnits(
    skillUnits.map((au) => ({
      assignableUnitId: au.assignableUnitId,
      skill: au.assignableUnit.skill,
      content: au.assignableUnit.content,
      transcript: au.assignableUnit.transcript,
      questions: au.assignableUnit.questions
    })),
    (questionId) => String(formData.get(`q_${questionId}`) ?? "")
  );
```

(Truy vấn ở dòng 208-229 dùng `include` cho `assignableUnit` nên `content`, `transcript`, `skill`, và `questions.answerEvidence` đã tự có — không cần sửa truy vấn.)

- [ ] **Step 6: Chạy test để xác nhận pass**

Run: `npx vitest run tests/attempt-grading.test.ts`
Expected: PASS (4 test).

- [ ] **Step 7: Commit**

```bash
git add lib/attempt-grading.ts lib/actions/attempts.ts tests/attempt-grading.test.ts
git commit -m "feat: chụp dẫn chứng đáp án vào evidenceSnapshot khi chấm"
```

---

### Task 4: Import nhận `evidence` + cập nhật prompt

**Files:**
- Modify: `lib/actions/materials.ts` (`importQuestionSchema` ~dòng 571-579; map `questions.create` ~dòng 781-793)
- Modify: `docs/prompt-import-reading.md`
- Modify: `tests/foundation.test.ts` (assertion nhẹ để chốt wiring)

**Interfaces:**
- Consumes: cột `answerEvidence` (Task 2).
- Produces: import chấp nhận `question.evidence` -> lưu `Question.answerEvidence`. (`unit.transcript` đã có sẵn trong `importUnitSchema` và map, không đổi.)

- [ ] **Step 1: Thêm assertion test thất bại** — ở cuối `tests/foundation.test.ts` thêm một `describe` mới, dùng helper `readProjectFile` đã khai báo sẵn ở đầu file (không import gì thêm):

```ts
describe("import dẫn chứng", () => {
  it("import map evidence -> answerEvidence", () => {
    const src = readProjectFile("lib/actions/materials.ts");
    expect(src).toContain("evidence: z.string().trim().optional()");
    expect(src).toContain("answerEvidence: optionalText(question.evidence)");
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận fail**

Run: `npx vitest run tests/foundation.test.ts`
Expected: FAIL — không tìm thấy `answerEvidence: optionalText(question.evidence)`.

- [ ] **Step 3: Thêm `evidence` vào schema import** — `lib/actions/materials.ts`, trong `importQuestionSchema` (sau dòng `explanation: z.string().trim().optional(),`):

```ts
  evidence: z.string().trim().optional(),
```

- [ ] **Step 4: Map khi tạo Question** — `lib/actions/materials.ts`, trong `questions.create` (sau dòng `explanation: optionalText(question.explanation),`):

```ts
              answerEvidence: optionalText(question.evidence),
```

- [ ] **Step 5: Cập nhật prompt** — `docs/prompt-import-reading.md`, thêm vào phần mô tả trường mỗi câu (khối "## Prompt") và phần "## Lưu ý":

```markdown
- `evidence` (tùy chọn nhưng khuyến khích): trích **nguyên văn** một câu/đoạn ngắn
  trong bài chứa đáp án đúng. Giữ đúng tiếng Anh gốc, KHÔNG diễn giải. Với câu điền
  từ, nếu bỏ trống thì hệ thống tự dò; với câu multiple_choice / true_false_not_given
  / matching thì HÃY luôn cung cấp vì hệ thống không tự dò được.

Với đề **Listening**: mỗi `unit` bắt buộc có trường `transcript` = toàn bộ lời thoại
audio (tiếng Anh, nguyên văn). `evidence` mỗi câu là đoạn transcript chứa đáp án.
```

- [ ] **Step 6: Chạy test để xác nhận pass**

Run: `npx vitest run tests/foundation.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/actions/materials.ts docs/prompt-import-reading.md tests/foundation.test.ts
git commit -m "feat: import nhận evidence cho từng câu + cập nhật prompt (transcript listening)"
```

---

### Task 5: Ô soạn "Dẫn chứng" thủ công

**Files:**
- Modify: `components/question-fields.tsx` (type `defaults` ~dòng 14-20; khối "Giải thích" ~dòng 384-395)
- Modify: `lib/actions/materials.ts` (`questionSchema` ~dòng 65-74; `createQuestion` parse ~dòng 430-439 + data ~dòng 461-471; `updateQuestion` parse ~dòng 484-489 + data ~dòng 520-528)
- Modify: `app/teacher/materials/page.tsx` (defaults truyền cho `QuestionFields` ~dòng 604-609)

**Interfaces:**
- Consumes: cột `answerEvidence` (Task 2).
- Produces: giáo viên soạn/sửa `answerEvidence` qua form (không có test tự động — verify bằng build + preview).

- [ ] **Step 1: Thêm field vào type + UI** — `components/question-fields.tsx`

Trong type `defaults` (khối có `explanation?: string | null;`), thêm:

```tsx
  answerEvidence?: string | null;
```

Ngay sau khối `<div>` chứa textarea "Giải thích" (kết thúc ở dòng ~395), thêm:

```tsx
      <div>
        <label className="text-sm font-medium" htmlFor={`${idPrefix}-answerEvidence`}>
          Dẫn chứng (đoạn chứa đáp án)
        </label>
        <textarea
          id={`${idPrefix}-answerEvidence`}
          name="answerEvidence"
          rows={2}
          defaultValue={defaults?.answerEvidence ?? ""}
          className={fieldClass}
        />
      </div>
```

- [ ] **Step 2: Zod + parse + lưu (create & update)** — `lib/actions/materials.ts`

Trong `questionSchema` (sau `explanation: z.string().trim().optional(),`):

```ts
  answerEvidence: z.string().trim().optional(),
```

Trong `createQuestion` khối `safeParse({...})` (sau `explanation: formData.get("explanation"),`):

```ts
    answerEvidence: formData.get("answerEvidence"),
```

Trong `createQuestion` khối `prisma.question.create({ data: {...} })` (sau `explanation: optionalText(parsed.data.explanation),`):

```ts
      answerEvidence: optionalText(parsed.data.answerEvidence),
```

Trong `updateQuestion` khối `safeParse({...})` (sau `explanation: formData.get("explanation"),`):

```ts
    answerEvidence: formData.get("answerEvidence"),
```

Trong `updateQuestion` khối `data: {...}` (sau `explanation: optionalText(parsed.data.explanation),`):

```ts
      answerEvidence: optionalText(parsed.data.answerEvidence),
```

- [ ] **Step 3: Truyền defaults khi sửa** — `app/teacher/materials/page.tsx`, trong object `defaults={{...}}` truyền cho `QuestionFields` (khối chứa `explanation: question.explanation`), thêm:

```tsx
                                  answerEvidence: question.answerEvidence
```

(`materialInclude` ở đầu file dùng `include: { questions: { orderBy } }` nên `question.answerEvidence` đã tự có — KHÔNG cần sửa truy vấn.)

- [ ] **Step 4: Build kiểm tra biên dịch**

Run: `pnpm build`
Expected: build thành công, không lỗi TypeScript.

- [ ] **Step 5: Verify UI bằng preview** — mở form thêm câu hỏi ở `/teacher/materials`, xác nhận có ô "Dẫn chứng (đoạn chứa đáp án)"; nhập thử và lưu, mở lại thấy giữ giá trị.

- [ ] **Step 6: Commit**

```bash
git add components/question-fields.tsx lib/actions/materials.ts app/teacher/materials/page.tsx
git commit -m "feat: ô soạn Dẫn chứng đáp án khi thêm/sửa câu hỏi"
```

---

### Task 6: Hiển thị dẫn chứng + full transcript trên trang kết quả

**Files:**
- Modify: `components/result-review.tsx` (type `Answer` ~dòng 14-31; khối render câu ~dòng 230-301)
- Modify: `app/student/results/[attemptId]/page.tsx` (select `assignableUnit` ~dòng 69-74)
- Modify: `app/teacher/results/[attemptId]/page.tsx` (select `assignableUnit` ~dòng 50-52)

**Interfaces:**
- Consumes: `evidenceSnapshot` (Task 3, tự có trong include Answer); `splitByAnswerMatches` (Task 1).
- Produces: giao diện kết quả hiển thị dẫn chứng (không test tự động — verify build + preview).

- [ ] **Step 1: Bổ sung transcript vào truy vấn (2 trang)**

`app/student/results/[attemptId]/page.tsx` — trong `assignableUnit: { select: { title: true, skill: true } }` sửa thành:

```ts
          assignableUnit: {
            select: { title: true, skill: true, transcript: true }
          },
```

`app/teacher/results/[attemptId]/page.tsx` — sửa tương tự:

```ts
          assignableUnit: {
            select: { title: true, skill: true, transcript: true }
          },
```

- [ ] **Step 2: Cập nhật type + import trong `components/result-review.tsx`**

Thêm import ở đầu file (cạnh các import lib khác):

```tsx
import { splitByAnswerMatches } from "@/lib/answer-evidence";
```

Trong type `Answer`, thêm sau `explanationSnapshot: string | null;`:

```tsx
  evidenceSnapshot: string | null;
```

Sửa `assignableUnit` trong type `Answer` thành:

```tsx
  assignableUnit: {
    title: string;
    skill: string;
    transcript?: string | null;
  };
```

- [ ] **Step 3: Component gạch chân + render dẫn chứng** — trong `components/result-review.tsx`, ngay trước `export function ResultReview`, thêm:

```tsx
// Hiển thị text và gạch chân phần trùng đáp án nguyên văn.
function UnderlinedEvidence({ text, answers }: { text: string; answers: string[] }) {
  const parts = splitByAnswerMatches(text, answers);
  return (
    <>
      {parts.map((part, index) =>
        part.match ? (
          <u key={index} className="font-semibold decoration-emerald-500 decoration-2">
            {part.text}
          </u>
        ) : (
          <span key={index}>{part.text}</span>
        )
      )}
    </>
  );
}
```

Trong khối render mỗi câu, ngay sau khối `{answer.explanationSnapshot ? (...) : null}` (dòng ~289), thêm:

```tsx
                {answer.evidenceSnapshot ? (
                  <div className="mt-3 rounded-lg border border-emerald-400/30 bg-emerald-500/5 p-3 text-sm">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Dẫn chứng (đoạn chứa đáp án)
                    </p>
                    <p className="mt-2 leading-6">
                      <UnderlinedEvidence
                        text={answer.evidenceSnapshot}
                        answers={
                          answer.correctAnswerSnapshot
                            ? answer.correctAnswerSnapshot.split(" | ")
                            : []
                        }
                      />
                    </p>
                  </div>
                ) : null}
```

(Ghi chú: `answer.correctAnswerSnapshot` lưu dạng join `"a | b"` — xem `answerSnapshot` trong `lib/attempt-grading.ts` — nên tách bằng `.split(" | ")` để lấy danh sách đáp án gạch chân.)

- [ ] **Step 4: Nút "Xem full transcript" cho Listening** — trong `components/result-review.tsx`, ngay sau section "Đáp án" (thẻ `</section>` đóng khối đáp án, dòng ~309), thêm:

```tsx
      {(() => {
        // Gom transcript theo từng part Listening (unit có transcript). Mỗi part
        // hiện 1 lần, gạch chân các đáp án nguyên văn trong toàn bộ transcript.
        const listeningUnits = new Map<string, { title: string; transcript: string; answers: string[] }>();
        attempt.answers.forEach((answer) => {
          if (answer.assignableUnit.skill !== "listening" || !answer.assignableUnit.transcript) {
            return;
          }
          const key = answer.assignableUnit.title;
          const entry =
            listeningUnits.get(key) ??
            { title: answer.assignableUnit.title, transcript: answer.assignableUnit.transcript, answers: [] };
          if (answer.correctAnswerSnapshot) {
            entry.answers.push(...answer.correctAnswerSnapshot.split(" | "));
          }
          listeningUnits.set(key, entry);
        });
        const units = [...listeningUnits.values()];
        if (units.length === 0) {
          return null;
        }
        return (
          <section className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
            <div className="border-b border-border px-5 py-4">
              <h3 className="text-base font-semibold">Transcript</h3>
            </div>
            <div className="divide-y divide-border">
              {units.map((unit) => (
                <details key={unit.title} className="px-5 py-4">
                  <summary className="cursor-pointer text-sm font-semibold text-primary">
                    Xem full transcript — {unit.title}
                  </summary>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7">
                    <UnderlinedEvidence text={unit.transcript} answers={unit.answers} />
                  </p>
                </details>
              ))}
            </div>
          </section>
        );
      })()}
```

- [ ] **Step 5: Build kiểm tra biên dịch**

Run: `pnpm build`
Expected: build thành công, không lỗi TypeScript/lint.

- [ ] **Step 6: Verify bằng preview** — import một bài mẫu có `evidence`/`transcript`, làm thử và nộp, mở trang kết quả: xác nhận mỗi câu có khối "Dẫn chứng" (đáp án gạch chân với câu điền từ), và phần Listening có `<details>` "Xem full transcript". Chụp screenshot.

- [ ] **Step 7: Commit**

```bash
git add components/result-review.tsx "app/student/results/[attemptId]/page.tsx" "app/teacher/results/[attemptId]/page.tsx"
git commit -m "feat: hiển thị dẫn chứng đáp án + full transcript trên trang kết quả"
```

---

### Task 7: Kiểm thử toàn bộ + đẩy lên

**Files:** không sửa code.

- [ ] **Step 1: Chạy toàn bộ test**

Run: `pnpm test`
Expected: tất cả xanh (gồm `answer-evidence`, `attempt-grading`, `foundation`).

- [ ] **Step 2: Build production**

Run: `pnpm build`
Expected: thành công.

- [ ] **Step 3: Push (Vercel auto-deploy)**

```bash
git push origin feature/ielts-platform-mvp
```

- [ ] **Step 4: Kiểm tra trên Vercel** — sau deploy, mở một bài Listening/Reading mới import trên môi trường live, xác nhận dẫn chứng + transcript hiển thị đúng.

---

## Ghi chú thực thi

- Bài Listening/Reading đã nộp trước đây: `evidenceSnapshot = null` → không hiện khối dẫn chứng (không lỗi). Chấp nhận.
- Bài import cũ chưa có transcript: câu điền từ vẫn tự dò từ `content`; Listening chưa hiện transcript cho tới khi import lại (file nguồn trong `tmp/`).
- `answer.correctAnswerSnapshot` lưu dạng join `" | "` (xem `answerSnapshot` trong `lib/attempt-grading.ts`) — dùng `.split(" | ")` khi cần danh sách đáp án để gạch chân.
