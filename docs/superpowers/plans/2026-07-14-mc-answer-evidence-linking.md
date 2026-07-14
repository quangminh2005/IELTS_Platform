# Mở rộng liên kết Transcript cho câu trắc nghiệm — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Câu trắc nghiệm trên trang kết quả cũng bấm được để tô câu dẫn chứng, khi từ khóa đáp án đúng (đã bóc nhãn `"B. climbing"` → `"climbing"`) xuất hiện nguyên văn trong transcript.

**Architecture:** Thêm 3 hàm thuần vào `lib/answer-evidence.ts` — `findEvidenceSentence` (rút lõi của `deriveAnswerEvidence`, bỏ gate loại câu), `answerKeywords` (bóc nhãn phương án), `buildEvidenceTargets` (dựng danh sách đích: ưu tiên `evidenceSnapshot` sẵn có, chưa có thì dò từ khóa). Component chỉ đổi 1 dòng để gọi `buildEvidenceTargets`; toàn bộ render/tô/badge/cuộn (`buildEvidenceSegments`) giữ nguyên.

**Tech Stack:** Next.js 14 App Router (React 18, TypeScript strict), Vitest.

## Global Constraints

- Ngôn ngữ UI + comment: **tiếng Việt** (theo repo).
- **Không đổi** Prisma schema, truy vấn DB, logic chấm điểm, import. Tính năng dò phía client để bài đã nộp cũ cũng chạy (không chấm lại).
- **Không đổi** `buildEvidenceSegments` và phần render/tô/badge/cuộn trong `result-answers.tsx`.
- **Không hồi quy câu điền từ:** còn `evidenceSnapshot` thì dùng nó; chưa có mới dò từ khóa.
- `deriveAnswerEvidence` giữ **nguyên chữ ký và hành vi** sau refactor (các test cũ phải xanh).
- Câu không dò ra dẫn chứng (đáp án diễn giải lại, True/False/NG, matching chỉ có chữ cái) → **không tạo đích** → thẻ không bấm được. Không tô bừa.
- TypeScript `strict`; ESLint next/core-web-vitals phải qua (`pnpm build` chạy lint).

---

### Task 1: Dò dẫn chứng theo từ khóa đáp án + nối vào trang kết quả

**Files:**
- Modify: `lib/answer-evidence.ts` (refactor `deriveAnswerEvidence`; thêm `findEvidenceSentence`, `answerKeywords`, `isSearchableKeyword`, `LABEL_ANSWER_TOKENS`, `EvidenceTargetInput`, `buildEvidenceTargets`)
- Modify: `components/result-answers.tsx:212-223` (đổi khối dựng `targets` + import)
- Test: `tests/answer-evidence.test.ts` (thêm 3 `describe`)

**Interfaces:**
- Consumes (đã có sẵn trong `lib/answer-evidence.ts`): `answerRegExp(answer: string): RegExp` (module-private), `LITERAL_ANSWER_TYPES: Set<string>`, `type EvidenceTarget = { order: number; evidence: string; answers: string[] }`, `buildEvidenceSegments(filledSource, targets, answersByOrder)`.
- Produces:
  ```ts
  export function findEvidenceSentence(sourceText: string | null, answers: string[]): string | null;
  export function answerKeywords(correctAnswerSnapshot: string | null): string[];
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

- [ ] **Step 1: Viết test thất bại**

Cập nhật dòng import đầu `tests/answer-evidence.test.ts` thành:

```ts
import {
  deriveAnswerEvidence,
  splitByAnswerMatches,
  fillSourceBlanks,
  buildEvidenceSegments,
  findEvidenceSentence,
  answerKeywords,
  buildEvidenceTargets
} from "@/lib/answer-evidence";
```

Thêm vào **cuối file**:

```ts
describe("findEvidenceSentence", () => {
  const passage =
    "Lightning is dangerous. Power companies lose money every year. Atoms split apart.";

  it("trả câu chứa đáp án nguyên văn", () => {
    expect(findEvidenceSentence(passage, ["power companies"])).toBe(
      "Power companies lose money every year."
    );
  });

  it("ưu tiên đáp án dài nhất", () => {
    expect(findEvidenceSentence(passage, ["companies", "power companies"])).toBe(
      "Power companies lose money every year."
    );
  });

  it("không thấy -> null; nguồn null -> null", () => {
    expect(findEvidenceSentence(passage, ["zzz"])).toBeNull();
    expect(findEvidenceSentence(null, ["x"])).toBeNull();
  });
});

describe("answerKeywords", () => {
  it("bóc nhãn phương án", () => {
    expect(answerKeywords("B. climbing | C. collecting")).toEqual(["climbing", "collecting"]);
  });

  it("giữ nguyên đáp án không có nhãn", () => {
    expect(answerKeywords("power companies")).toEqual(["power companies"]);
  });

  it("snapshot null -> mảng rỗng", () => {
    expect(answerKeywords(null)).toEqual([]);
  });
});

describe("buildEvidenceTargets", () => {
  const transcript =
    "Olivia: Why don't you begin with describing his passion for collecting things? Victor: No, it was climbing that he spent his time on. Victor: They decided to live on a small island with harsh weather.";

  it("có evidenceSnapshot -> dùng đúng câu đó", () => {
    const targets = buildEvidenceTargets(
      [
        {
          order: 5,
          evidenceSnapshot: "Victor: No, it was climbing that he spent his time on.",
          correctAnswerSnapshot: "climbing"
        }
      ],
      transcript
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
      [{ order: 21, evidenceSnapshot: null, correctAnswerSnapshot: "B. climbing | C. collecting" }],
      transcript
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
            evidenceSnapshot: null,
            correctAnswerSnapshot: "B. to experience an isolated place"
          }
        ],
        transcript
      )
    ).toEqual([]);
  });

  it("loại nhãn đúng/sai và chữ cái lẻ -> không đích", () => {
    expect(
      buildEvidenceTargets(
        [
          { order: 1, evidenceSnapshot: null, correctAnswerSnapshot: "TRUE" },
          { order: 2, evidenceSnapshot: null, correctAnswerSnapshot: "NOT GIVEN" },
          { order: 3, evidenceSnapshot: null, correctAnswerSnapshot: "C" }
        ],
        "It is true that nothing is given here. C is a letter."
      )
    ).toEqual([]);
  });

  it("order null -> bỏ", () => {
    expect(
      buildEvidenceTargets(
        [{ order: null, evidenceSnapshot: "x", correctAnswerSnapshot: "y" }],
        transcript
      )
    ).toEqual([]);
  });
});
```

- [ ] **Step 2: Chạy test để chắc chắn nó fail**

Run: `npx vitest run tests/answer-evidence.test.ts`
Expected: FAIL — `findEvidenceSentence` / `answerKeywords` / `buildEvidenceTargets` chưa export (not a function).

- [ ] **Step 3: Refactor `deriveAnswerEvidence` — tách `findEvidenceSentence`**

Trong `lib/answer-evidence.ts`, thay **toàn bộ** hàm `deriveAnswerEvidence` hiện tại (kèm comment `// Trả câu trong sourceText chứa đáp án nguyên văn, hoặc null.` ngay trên nó) bằng:

```ts
// Trả câu trong sourceText chứa nguyên văn một trong các answers (ranh giới từ, không
// phân biệt hoa/thường); ưu tiên answer dài nhất. Không thấy -> null.
export function findEvidenceSentence(
  sourceText: string | null,
  answers: string[]
): string | null {
  if (!sourceText) {
    return null;
  }

  const sentences = sourceText
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  // Ưu tiên đáp án dài nhất để khớp cụm chính xác hơn từ đơn.
  const candidates = answers
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

// Trả câu trong sourceText chứa đáp án nguyên văn, hoặc null. Chỉ dùng cho câu điền từ
// (đáp án nằm nguyên văn trong bài); câu nhãn (MC/TF-NG/matching) trả null.
export function deriveAnswerEvidence(
  questionType: string,
  correctAnswers: string[],
  sourceText: string | null
): string | null {
  if (!LITERAL_ANSWER_TYPES.has(questionType)) {
    return null;
  }
  return findEvidenceSentence(sourceText, correctAnswers);
}
```

- [ ] **Step 4: Thêm `answerKeywords` + `buildEvidenceTargets`**

Thêm vào **cuối** `lib/answer-evidence.ts` (sau `buildEvidenceSegments`):

```ts
// Nhãn đáp án đúng/sai — không phải từ khóa dò được trong bài ("yes"/"no" còn xuất hiện
// nhan nhản trong hội thoại nên dò sẽ tô bừa).
const LABEL_ANSWER_TOKENS = new Set(["true", "false", "not given", "yes", "no", "ng"]);

// Tách correctAnswerSnapshot ("a | b") thành từng đáp án, bỏ nhãn phương án đầu
// ("A. " / "b) ") để lấy từ khóa dùng tô đậm và dò trong nguồn.
export function answerKeywords(correctAnswerSnapshot: string | null): string[] {
  if (!correctAnswerSnapshot) {
    return [];
  }
  return correctAnswerSnapshot
    .split(" | ")
    .map((answer) => answer.replace(/^[A-Za-z][.)]\s+/, "").trim())
    .filter(Boolean);
}

// Từ khóa đủ "chắc" để đi dò trong nguồn: bỏ nhãn đúng/sai và token quá ngắn (chữ cái lẻ
// của câu matching) — tránh tô bừa.
function isSearchableKeyword(keyword: string): boolean {
  if (LABEL_ANSWER_TOKENS.has(keyword.toLowerCase())) {
    return false;
  }
  return keyword.replace(/[^\p{L}\p{N}]/gu, "").length >= 2;
}

export type EvidenceTargetInput = {
  order: number | null;
  evidenceSnapshot: string | null;
  correctAnswerSnapshot: string | null;
};

// Dựng danh sách đích dẫn chứng cho một part:
//  - Đã có evidenceSnapshot (câu điền từ tự sinh khi chấm, hoặc giáo viên nhập) -> dùng
//    câu đó; từ khóa đáp án chỉ để tô đậm bên trong.
//  - Chưa có (câu trắc nghiệm...) -> với MỖI từ khóa dò được câu chứa nó, tạo một đích
//    cùng order; nhờ vậy câu "chọn nhiều đáp án" tô được nhiều chỗ. Không dò ra -> bỏ.
export function buildEvidenceTargets(
  items: EvidenceTargetInput[],
  filledSource: string
): EvidenceTarget[] {
  const targets: EvidenceTarget[] = [];

  for (const item of items) {
    if (item.order === null) {
      continue;
    }
    const keywords = answerKeywords(item.correctAnswerSnapshot);
    const evidence = item.evidenceSnapshot?.trim();

    if (evidence) {
      targets.push({ order: item.order, evidence, answers: keywords });
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

- [ ] **Step 5: Chạy test để chắc chắn pass**

Run: `npx vitest run tests/answer-evidence.test.ts`
Expected: PASS toàn bộ — gồm 11 case mới **và** các case `deriveAnswerEvidence` cũ (chứng minh refactor không đổi hành vi).

- [ ] **Step 6: Nối vào trang kết quả**

Trong `components/result-answers.tsx`, đổi import `@/lib/answer-evidence` thành:

```ts
import {
  buildEvidenceSegments,
  buildEvidenceTargets,
  fillSourceBlanks,
  type EvidenceSegment
} from "@/lib/answer-evidence";
```

Rồi thay khối `useMemo` dựng `targets` (hiện ở `result-answers.tsx:212-223`) — nguyên văn hiện tại là:

```tsx
  // Cắt transcript theo câu dẫn chứng của part đang xem (dựa trên evidenceSnapshot).
  const { segments, linkedOrders } = useMemo(() => {
    if (!showSource || !part) return { segments: [] as EvidenceSegment[], linkedOrders: [] as number[] };
    const targets = part.answers
      .filter((answer) => answer.order !== null && answer.evidenceSnapshot?.trim())
      .map((answer) => ({
        order: answer.order as number,
        evidence: answer.evidenceSnapshot as string,
        answers: answer.correctAnswerSnapshot ? answer.correctAnswerSnapshot.split(" | ") : []
      }));
    return buildEvidenceSegments(filledSource, targets, part.answersByOrder);
  }, [showSource, filledSource, part]);
```

bằng:

```tsx
  // Cắt transcript theo câu dẫn chứng của part đang xem: câu điền từ dùng evidenceSnapshot
  // sẵn có, câu trắc nghiệm dò theo từ khóa đáp án.
  const { segments, linkedOrders } = useMemo(() => {
    if (!showSource || !part) return { segments: [] as EvidenceSegment[], linkedOrders: [] as number[] };
    const targets = buildEvidenceTargets(part.answers, filledSource);
    return buildEvidenceSegments(filledSource, targets, part.answersByOrder);
  }, [showSource, filledSource, part]);
```

(`PartAnswer` đã có `order`, `evidenceSnapshot`, `correctAnswerSnapshot` nên khớp `EvidenceTargetInput` — không cần đổi type.)

- [ ] **Step 7: Chạy test + build**

Run: `pnpm test`
Expected: PASS toàn bộ, không hồi quy.
Run: `pnpm build`
Expected: PASS — không lỗi TypeScript/ESLint. (Cảnh báo `<img>` ở trang login là có sẵn từ trước, không liên quan.)

- [ ] **Step 8: Commit**

```bash
git add lib/answer-evidence.ts tests/answer-evidence.test.ts components/result-answers.tsx
git commit -m "feat: câu trắc nghiệm dò dẫn chứng theo từ khóa đáp án"
```

---

## Self-Review (đã rà)

**Spec coverage:**
- Dò từ khóa đáp án, bóc nhãn phương án → `answerKeywords` (Step 4), test Step 1.
- Câu "chọn nhiều đáp án" tô nhiều chỗ → vòng `for (const keyword of ...)` tạo nhiều đích cùng `order` (Step 4), test "nhiều đích cùng order".
- Không dò ra → không đích → thẻ trơ → test "diễn giải lại" + "loại nhãn đúng/sai và chữ cái lẻ".
- Ưu tiên `evidenceSnapshot`, không hồi quy câu điền từ → nhánh `if (evidence)` (Step 4), test "có evidenceSnapshot".
- `findEvidenceSentence` rút lõi, `deriveAnswerEvidence` giữ hành vi → Step 3, chứng minh bằng test cũ vẫn xanh (Step 5).
- Component chỉ đổi chỗ dựng đích, `buildEvidenceSegments` không đổi → Step 6.
- Không đổi schema/truy vấn/chấm → không có step nào đụng tới.

**Placeholder scan:** không có TODO/TBD; mọi step có code hoặc lệnh cụ thể.

**Type consistency:** `EvidenceTargetInput` (Step 4) khớp các field của `PartAnswer` dùng ở Step 6 (`order: number | null`, `evidenceSnapshot: string | null`, `correctAnswerSnapshot: string | null`). `buildEvidenceTargets` trả `EvidenceTarget[]` — đúng kiểu tham số 2 của `buildEvidenceSegments`. `findEvidenceSentence` dùng chung bởi `deriveAnswerEvidence` (Step 3) và `buildEvidenceTargets` (Step 4), cùng chữ ký.
