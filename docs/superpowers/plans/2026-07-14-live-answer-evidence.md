# Dẫn chứng đọc "live" từ câu hỏi — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Giáo viên nhập ô "Dẫn chứng" của một câu → bài **đã nộp** hiện ngay chỗ tô tương ứng, không cần làm lại bài.

**Architecture:** Trang kết quả đọc thẳng `Question.answerEvidence` (live) thay vì chỉ dựa vào `Answer.evidenceSnapshot` (đông cứng lúc chấm). `buildEvidenceTargets` đổi thành 3 tầng ưu tiên — dẫn chứng giáo viên → snapshot → dò từ khóa — và **chỉ chọn tầng nào định vị được nguyên văn** trong transcript, không thì lùi tầng sau.

**Tech Stack:** Next.js 14 App Router (React 18, TypeScript strict), Prisma, Vitest.

## Global Constraints

- Ngôn ngữ UI + comment: **tiếng Việt** (theo repo).
- **Không đổi** Prisma schema, logic chấm điểm (`lib/attempt-grading.ts`), import, `buildEvidenceSegments`, và toàn bộ phần render/tô/badge/cuộn trong `result-answers.tsx`.
- Thay đổi truy vấn **duy nhất**: thêm `answerEvidence: true` vào `question.select` của 2 trang kết quả. Không đụng `app/teacher/review/[attemptId]/page.tsx` (giao diện chấm bài, component khác).
- **Không hồi quy:** câu không có `answerEvidence` (đa số hiện nay) phải rơi tầng 2/3 và cho kết quả y hệt hiện tại.
- Giáo viên nhập dẫn chứng sai khớp → **lùi tầng sau**, không để thẻ trơ.
- TypeScript `strict`; ESLint next/core-web-vitals phải qua (`pnpm build` chạy lint).

---

### Task 1: Ba tầng dẫn chứng + đọc live `answerEvidence`

**Files:**
- Modify: `lib/answer-evidence.ts` (`EvidenceTargetInput`, `buildEvidenceTargets`)
- Modify: `tests/answer-evidence.test.ts:238-310` (cập nhật `describe("buildEvidenceTargets")`)
- Modify: `app/student/results/[attemptId]/page.tsx:61-67` (query)
- Modify: `app/teacher/results/[attemptId]/page.tsx:47-49` (query)
- Modify: `components/result-review.tsx` (type `Answer.question` + `part.answers.push`)
- Modify: `components/result-answers.tsx` (`PartAnswer` + chỗ gọi `buildEvidenceTargets`)
- Modify: `components/question-fields.tsx:398-409` (dòng gợi ý)

**Interfaces:**
- Consumes (đã có trong `lib/answer-evidence.ts`): `answerKeywords(correctAnswerSnapshot: string | null): string[]`, `isSearchableKeyword(keyword: string): boolean` (module-private), `findEvidenceSentence(sourceText: string | null, answers: string[]): string | null`, `fillSourceBlanks(source: string, answersByOrder: Record<number, string>): string`, `type EvidenceTarget = { order: number; evidence: string; answers: string[] }`.
- Produces:
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
    answersByOrder: Record<number, string>   // MỚI — để fill [[n]] khi kiểm tra định vị
  ): EvidenceTarget[];
  ```

- [ ] **Step 1: Cập nhật + thêm test (RED)**

Trong `tests/answer-evidence.test.ts`, thay **toàn bộ** khối `describe("buildEvidenceTargets", ...)` hiện tại (dòng 238–310) bằng khối dưới. Có 2 thay đổi hệ thống với 5 case cũ: mỗi item thêm `questionEvidence: null`, và mỗi lời gọi thêm tham số thứ 3 `{}`.

```ts
describe("buildEvidenceTargets", () => {
  const transcript =
    "Olivia: Why don't you begin with describing his passion for collecting things? Victor: No, it was climbing that he spent his time on. Victor: They decided to live on a small island with harsh weather.";

  it("có evidenceSnapshot -> dùng đúng câu đó", () => {
    const targets = buildEvidenceTargets(
      [
        {
          order: 5,
          questionEvidence: null,
          evidenceSnapshot: "Victor: No, it was climbing that he spent his time on.",
          correctAnswerSnapshot: "climbing"
        }
      ],
      transcript,
      {}
    );
    expect(targets).toEqual([
      {
        order: 5,
        evidence: "Victor: No, it was climbing that he spent his time on.",
        answers: ["climbing"]
      }
    ]);
  });

  it("trắc nghiệm chưa có evidenceSnapshot -> dò từ khóa; nhiều đáp án -> nhiều đích cùng order", () => {
    const targets = buildEvidenceTargets(
      [
        {
          order: 21,
          questionEvidence: null,
          evidenceSnapshot: null,
          correctAnswerSnapshot: "B. climbing | C. collecting"
        }
      ],
      transcript,
      {}
    );
    expect(targets).toHaveLength(2);
    expect(targets.every((target) => target.order === 21)).toBe(true);
    expect(targets.map((target) => target.answers)).toEqual([["climbing"], ["collecting"]]);
    expect(targets[0].evidence).toContain("climbing");
    expect(targets[1].evidence).toContain("collecting");
  });

  it("đáp án diễn giải lại, không có trong nguồn -> không đích", () => {
    expect(
      buildEvidenceTargets(
        [
          {
            order: 23,
            questionEvidence: null,
            evidenceSnapshot: null,
            correctAnswerSnapshot: "B. to experience an isolated place"
          }
        ],
        transcript,
        {}
      )
    ).toEqual([]);
  });

  it("loại nhãn đúng/sai và chữ cái lẻ -> không đích", () => {
    expect(
      buildEvidenceTargets(
        [
          { order: 1, questionEvidence: null, evidenceSnapshot: null, correctAnswerSnapshot: "TRUE" },
          { order: 2, questionEvidence: null, evidenceSnapshot: null, correctAnswerSnapshot: "NOT GIVEN" },
          { order: 3, questionEvidence: null, evidenceSnapshot: null, correctAnswerSnapshot: "C" }
        ],
        "It is true that nothing is given here. C is a letter.",
        {}
      )
    ).toEqual([]);
  });

  it("order null -> bỏ", () => {
    expect(
      buildEvidenceTargets(
        [{ order: null, questionEvidence: null, evidenceSnapshot: "x", correctAnswerSnapshot: "y" }],
        transcript,
        {}
      )
    ).toEqual([]);
  });

  it("questionEvidence (giáo viên nhập) thắng evidenceSnapshot", () => {
    const targets = buildEvidenceTargets(
      [
        {
          order: 7,
          questionEvidence: "Victor: They decided to live on a small island with harsh weather.",
          evidenceSnapshot: "Victor: No, it was climbing that he spent his time on.",
          correctAnswerSnapshot: "climbing"
        }
      ],
      transcript,
      {}
    );
    expect(targets).toEqual([
      {
        order: 7,
        evidence: "Victor: They decided to live on a small island with harsh weather.",
        answers: ["climbing"]
      }
    ]);
  });

  it("questionEvidence không khớp nguyên văn -> lùi về evidenceSnapshot", () => {
    const targets = buildEvidenceTargets(
      [
        {
          order: 8,
          questionEvidence: "Giáo viên gõ tay một câu không có trong transcript.",
          evidenceSnapshot: "Victor: No, it was climbing that he spent his time on.",
          correctAnswerSnapshot: "climbing"
        }
      ],
      transcript,
      {}
    );
    expect(targets).toEqual([
      {
        order: 8,
        evidence: "Victor: No, it was climbing that he spent his time on.",
        answers: ["climbing"]
      }
    ]);
  });

  it("cả hai dẫn chứng đều không khớp -> lùi về dò từ khóa", () => {
    const targets = buildEvidenceTargets(
      [
        {
          order: 9,
          questionEvidence: "Câu không có thật.",
          evidenceSnapshot: "Câu chụp cũng không có thật.",
          correctAnswerSnapshot: "climbing"
        }
      ],
      transcript,
      {}
    );
    expect(targets).toHaveLength(1);
    expect(targets[0].order).toBe(9);
    expect(targets[0].evidence).toContain("climbing");
    expect(targets[0].answers).toEqual(["climbing"]);
  });

  it("dẫn chứng không khớp và từ khóa cũng không dò ra -> không đích", () => {
    expect(
      buildEvidenceTargets(
        [
          {
            order: 10,
            questionEvidence: "Không có thật.",
            evidenceSnapshot: null,
            correctAnswerSnapshot: "B. to experience an isolated place"
          }
        ],
        transcript,
        {}
      )
    ).toEqual([]);
  });

  it("evidenceSnapshot còn [[n]] -> điền đáp án vào rồi vẫn khớp nguồn", () => {
    const targets = buildEvidenceTargets(
      [
        {
          order: 4,
          questionEvidence: null,
          evidenceSnapshot: "The [[4]] is hot.",
          correctAnswerSnapshot: "core"
        }
      ],
      "The core is hot. Nothing else matters.",
      { 4: "core" }
    );
    expect(targets).toEqual([{ order: 4, evidence: "The [[4]] is hot.", answers: ["core"] }]);
  });
});
```

- [ ] **Step 2: Chạy test để chắc chắn nó fail**

Run: `npx vitest run tests/answer-evidence.test.ts`
Expected: FAIL — TypeScript/runtime báo `questionEvidence` không có trong `EvidenceTargetInput` và `buildEvidenceTargets` chỉ nhận 2 tham số; các case mới về ưu tiên tầng cũng fail.

- [ ] **Step 3: Đổi `EvidenceTargetInput` + `buildEvidenceTargets`**

Trong `lib/answer-evidence.ts`, thay **toàn bộ** `EvidenceTargetInput` và `buildEvidenceTargets` hiện tại (kèm block comment ngay trên `buildEvidenceTargets`) bằng:

```ts
export type EvidenceTargetInput = {
  order: number | null;
  questionEvidence: string | null; // live từ Question.answerEvidence (giáo viên nhập)
  evidenceSnapshot: string | null; // bản chụp lúc chấm
  correctAnswerSnapshot: string | null;
};

// Dựng danh sách đích dẫn chứng cho một part, theo 3 tầng ưu tiên — lấy tầng ĐẦU TIÊN
// định vị được nguyên văn trong filledSource:
//  1. questionEvidence: giáo viên nhập, đọc live -> sửa là bài cũ đổi theo ngay.
//  2. evidenceSnapshot: chụp lúc chấm (câu điền từ tự sinh) -> giữ để không hồi quy.
//  3. Dò từ khóa đáp án: mỗi từ khóa dò được câu chứa nó tạo một đích cùng order (câu
//     "chọn nhiều đáp án" nhờ vậy tô được nhiều chỗ).
// Bắt buộc "định vị được" mới chọn: giáo viên gõ sai khớp thì lùi tầng sau thay vì mất
// hẳn highlight. Không tầng nào ra -> không đích -> thẻ trơ.
export function buildEvidenceTargets(
  items: EvidenceTargetInput[],
  filledSource: string,
  answersByOrder: Record<number, string>
): EvidenceTarget[] {
  const targets: EvidenceTarget[] = [];

  for (const item of items) {
    if (item.order === null) {
      continue;
    }
    const keywords = answerKeywords(item.correctAnswerSnapshot);

    const located = [item.questionEvidence, item.evidenceSnapshot]
      .map((candidate) => candidate?.trim())
      .find(
        (candidate) =>
          !!candidate &&
          filledSource.includes(fillSourceBlanks(candidate, answersByOrder).trim())
      );

    if (located) {
      targets.push({ order: item.order, evidence: located, answers: keywords });
      continue;
    }

    for (const keyword of keywords.filter(isSearchableKeyword)) {
      const sentence = findEvidenceSentence(filledSource, [keyword]);
      if (sentence) {
        targets.push({ order: item.order, evidence: sentence, answers: [keyword] });
      }
    }
  }

  return targets;
}
```

Ghi chú: đẩy `evidence: located` là chuỗi **thô** (còn `[[n]]` nếu có) — `buildEvidenceSegments` tự `fillSourceBlanks` rồi `indexOf`. Vì ta kiểm tra `includes` bằng đúng phép fill đó nên chắc chắn nó định vị được.

- [ ] **Step 4: Chạy test để chắc chắn pass**

Run: `npx vitest run tests/answer-evidence.test.ts`
Expected: PASS toàn bộ (10 case `buildEvidenceTargets` + các describe khác không đổi).

- [ ] **Step 5: Lấy `answerEvidence` về từ DB (2 truy vấn)**

Trong `app/student/results/[attemptId]/page.tsx`, khối `question` (dòng 61–67) hiện là:

```ts
          question: {
            select: {
              order: true,
              prompt: true,
              points: true
            }
          },
```

đổi thành:

```ts
          question: {
            select: {
              order: true,
              prompt: true,
              points: true,
              answerEvidence: true
            }
          },
```

Trong `app/teacher/results/[attemptId]/page.tsx` (dòng 47–49), đổi:

```ts
          question: {
            select: { order: true, prompt: true, points: true }
          },
```

thành:

```ts
          question: {
            select: { order: true, prompt: true, points: true, answerEvidence: true }
          },
```

- [ ] **Step 6: Truyền xuống UI**

Trong `components/result-review.tsx`, type `Answer` có khối:

```ts
  question: {
    order: number;
    prompt: string;
    points: number;
  } | null;
```

đổi thành:

```ts
  question: {
    order: number;
    prompt: string;
    points: number;
    answerEvidence: string | null;
  } | null;
```

Vẫn trong file đó, tại `part.answers.push({ ... })`, thêm dòng ngay dưới `correctAnswerSnapshot: answer.correctAnswerSnapshot,`:

```ts
      questionEvidence: answer.question?.answerEvidence ?? null,
```

Trong `components/result-answers.tsx`, type `PartAnswer` thêm field ngay dưới `correctAnswerSnapshot: string | null;`:

```ts
  questionEvidence: string | null;
```

Vẫn trong file đó, đổi lời gọi:

```ts
    const targets = buildEvidenceTargets(part.answers, filledSource);
```

thành:

```ts
    const targets = buildEvidenceTargets(part.answers, filledSource, part.answersByOrder);
```

- [ ] **Step 7: Thêm gợi ý dưới ô "Dẫn chứng"**

Trong `components/question-fields.tsx`, khối hiện tại (dòng 398–409):

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

đổi thành (chỉ thêm thẻ `<p>`):

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
        <p className="mt-1 text-xs text-muted-foreground">
          Dán nguyên văn một câu từ transcript/bài đọc để hệ thống tô đúng chỗ.
        </p>
      </div>
```

- [ ] **Step 8: Chạy test + build**

Run: `pnpm test`
Expected: PASS toàn bộ, không hồi quy.
Run: `pnpm build`
Expected: PASS — không lỗi TypeScript/ESLint. (Cảnh báo `<img>` ở trang login có sẵn từ trước, không liên quan.)

Nếu build báo thiếu `questionEvidence` ở chỗ nào khác dựng `PartAnswer`, bổ sung ở đó — hiện chỉ `result-review.tsx` dựng kiểu này.

- [ ] **Step 9: Commit**

```bash
git add lib/answer-evidence.ts tests/answer-evidence.test.ts components/result-review.tsx components/result-answers.tsx components/question-fields.tsx "app/student/results/[attemptId]/page.tsx" "app/teacher/results/[attemptId]/page.tsx"
git commit -m "feat: dẫn chứng đọc live từ câu hỏi, 3 tầng ưu tiên"
```

---

## Self-Review (đã rà)

**Spec coverage:**
- 3 tầng ưu tiên, lấy tầng đầu tiên định vị được → Step 3 (`located` + fallback vòng từ khóa).
- Giáo viên nhập sai khớp → lùi tầng sau → Step 3; test "questionEvidence không khớp -> lùi về evidenceSnapshot" + "cả hai đều không khớp -> lùi về dò từ khóa" (Step 1).
- Sửa dẫn chứng → bài cũ hiện bản mới → đọc live qua query (Step 5) + threading (Step 6); tầng 1 thắng tầng 2 → test "questionEvidence thắng evidenceSnapshot".
- Thêm `answerEvidence` vào `question.select` 2 trang kết quả, không đụng trang chấm bài → Step 5.
- `PartAnswer.questionEvidence` + `Answer.question.answerEvidence` → Step 6.
- Fill `[[n]]` trước khi kiểm tra định vị → Step 3; test "evidenceSnapshot còn [[n]]".
- Dòng gợi ý dưới ô nhập → Step 7.
- Không hồi quy (không có answerEvidence → tầng 2/3 y như cũ) → 5 case cũ giữ nguyên kỳ vọng (Step 1).
- Không đổi schema/chấm/import/`buildEvidenceSegments`/render → không step nào đụng tới.
- Không cần sửa test cấu trúc (đã kiểm: không test nào grep `question.select` trang kết quả).

**Placeholder scan:** không có TODO/TBD; mọi step có code hoặc lệnh cụ thể.

**Type consistency:** `EvidenceTargetInput` (Step 3) khớp field `PartAnswer` dùng ở Step 6 (`order: number | null`, `questionEvidence: string | null`, `evidenceSnapshot: string | null`, `correctAnswerSnapshot: string | null`). `buildEvidenceTargets(items, filledSource, answersByOrder)` — tham số 3 là `part.answersByOrder` kiểu `Record<number, string>`, đúng kiểu `fillSourceBlanks` nhận. Trả `EvidenceTarget[]`, đúng tham số 2 của `buildEvidenceSegments`.
