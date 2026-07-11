# Tô sáng đáp án đọc đánh vần — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trang kết quả tô sáng cả đáp án được transcript đọc đánh vần từng chữ cái (vd `Hardie` ↔ `H-A-R-D-I-E`).

**Architecture:** Chỉ sửa `splitByAnswerMatches` trong `lib/answer-evidence.ts`: thêm nhánh regex "đánh vần" (chữ cái nối bằng một dấu ngăn cách bắt buộc `[-.\s]`, chỉ với đáp án ≥ 3 ký tự) song song nhánh khớp linh hoạt khoảng trắng đã có.

**Tech Stack:** TypeScript thuần, vitest.

## Global Constraints

- Chỉ sửa `lib/answer-evidence.ts` và test của nó. Không đổi schema/UI/chấm điểm.
- Không khớp mờ/phiên âm (không coi "Hardy" ≈ "Hardie").
- Đánh vần: dấu ngăn cách **bắt buộc** giữa mỗi cặp chữ cái, thuộc `[-.\s]`; chỉ áp dụng đáp án **≥ 3 ký tự chữ-số**.
- Chữ ký `splitByAnswerMatches(text, answers)` giữ nguyên.

---

### Task 1: Thêm khớp đánh vần vào `splitByAnswerMatches`

**Files:**
- Modify: `lib/answer-evidence.ts` (`splitByAnswerMatches` + thêm `spelledPattern`)
- Test: `tests/answer-evidence.test.ts` (bổ sung)

**Interfaces:**
- Consumes: `escapeRegExp` (đã có trong file). Xoá `flexiblePattern` (gộp vào `answerPatterns`; không dùng nơi khác — `deriveAnswerEvidence` dùng `answerRegExp` riêng).
- Produces: `splitByAnswerMatches(text, answers)` không đổi chữ ký; khớp thêm ca đánh vần, và chặn tô bừa đáp án ngắn.

- [ ] **Step 1: Thêm test thất bại** — nối vào trong `describe("splitByAnswerMatches", ...)` của `tests/answer-evidence.test.ts` (trước `});` đóng của describe đó):

```ts
  it("tô đáp án đọc đánh vần (gạch nối)", () => {
    const parts = splitByAnswerMatches("Yes, it's H-A-R-D-I-E.", ["Hardie"]);
    expect(parts.some((p) => p.match && p.text === "H-A-R-D-I-E")).toBe(true);
  });

  it("tô đáp án đọc đánh vần (khoảng trắng)", () => {
    const parts = splitByAnswerMatches("spelt H A R D I E ok", ["Hardie"]);
    expect(parts.some((p) => p.match && p.text === "H A R D I E")).toBe(true);
  });

  it("không tô cách viết sai gây nhiễu (không khớp mờ)", () => {
    const parts = splitByAnswerMatches("Louisa: Hardy.", ["Hardie"]);
    expect(parts.every((p) => !p.match)).toBe(true);
  });

  it("không tô bừa đáp án 2 ký tự vào chuỗi có dấu ngăn cách", () => {
    const parts = splitByAnswerMatches("wear a t-shirt", ["at"]);
    expect(parts.every((p) => !p.match)).toBe(true);
  });
```

- [ ] **Step 2: Chạy test để xác nhận fail**

Run: `npx vitest run tests/answer-evidence.test.ts`
Expected: FAIL — "H-A-R-D-I-E" / "H A R D I E" chưa được khớp (part match không tồn tại).

- [ ] **Step 3: Thay `flexiblePattern` bằng `answerPatterns` + đưa vào regex tổng** — `lib/answer-evidence.ts`

Xoá hàm `flexiblePattern` hiện có và thay bằng `answerPatterns` (gộp 3 kiểu khớp, mỗi kiểu có điều kiện áp dụng riêng để không tô bừa):

```ts
// Sinh các mẫu regex khớp một đáp án trong text (không phân biệt hoa/thường):
//  1. Khớp thường: nguyên văn, khoảng trắng trong đáp án nới thành \s+.
//  2. Khớp linh hoạt khoảng trắng: CHỈ cho đáp án "mã" (lẫn chữ VÀ số) — nối ký tự
//     bằng \s* để "GT82LC" ↔ "GT8 2LC". Không áp dụng đáp án thuần chữ/thuần số
//     (tránh "at" khớp "a t-shirt").
//  3. Khớp đọc đánh vần: >= 3 ký tự chữ-số, dấu ngăn cách BẮT BUỘC [-.\s] giữa mỗi
//     cặp — "Hardie" ↔ "H-A-R-D-I-E". Không khớp cách viết sai gây nhiễu ("Hardy").
function answerPatterns(answer: string): string[] {
  const alnum = answer.replace(/[^\p{L}\p{N}]/gu, "");
  const patterns: string[] = [];

  // 1. Khớp thường.
  const exact = escapeRegExp(answer).replace(/(?:\\)?\s+/g, "\\s+");
  patterns.push(`\\b${exact}\\b`);

  // 2. Khớp linh hoạt khoảng trắng (chỉ đáp án mã lẫn chữ và số).
  if (/\p{L}/u.test(alnum) && /\p{N}/u.test(alnum)) {
    patterns.push(`\\b${alnum.split("").map(escapeRegExp).join("\\s*")}\\b`);
  }

  // 3. Khớp đọc đánh vần.
  if (alnum.length >= 3) {
    patterns.push(`\\b${alnum.split("").map(escapeRegExp).join("[-.\\s]")}\\b`);
  }

  return patterns;
}
```

Trong `splitByAnswerMatches`, thay dòng dựng `patterns`:

```ts
  const patterns = candidates.map(flexiblePattern).filter(Boolean);
```

bằng:

```ts
  const patterns = candidates.flatMap(answerPatterns).filter(Boolean);
```

(Giữ nguyên phần còn lại của hàm: sort `candidates`, `if (patterns.length === 0) ...`, `combined`, vòng `while ((found = combined.exec(text)) ...)`.)

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npx vitest run tests/answer-evidence.test.ts`
Expected: PASS (toàn bộ, gồm test cũ + 4 test mới).

- [ ] **Step 5: Chạy full test + build**

Run: `pnpm test && pnpm build`
Expected: tất cả test xanh; build `✓ Compiled successfully`.

- [ ] **Step 6: Commit + push**

```bash
git add lib/answer-evidence.ts tests/answer-evidence.test.ts
git commit -m "feat: tô sáng đáp án đọc đánh vần (Hardie ↔ H-A-R-D-I-E)"
git push origin feature/ielts-platform-mvp
```

- [ ] **Step 7: Kiểm tra prod** — sau deploy, mở kết quả Listening Test 1, Part 1 câu 1 xác nhận `"H-A-R-D-I-E"` được tô sáng và `"Hardy"` KHÔNG bị tô.

---

## Ghi chú

- Không đổi schema → không cần chạy gì trên DB.
- `\p{L}\p{N}` cần cờ `u` (đã dùng trong regex `replace`).
