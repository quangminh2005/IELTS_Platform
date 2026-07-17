# Ghi nhận hành vi đáng ngờ khi làm bài (Ctrl+F, rời tab) — Kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đếm số lần học viên nhấn Ctrl+F và rời tab trong lúc làm bài, cho giáo viên thấy số đếm ở trang kết quả và cờ ⚠ ở ba danh sách — chỉ phát hiện, không chặn.

**Architecture:** Logic thuần nằm ở `lib/proctor-signals.ts` (không phụ thuộc React/Prisma/DOM nên test thẳng bằng vitest). Client đếm trong `useRef`, gửi ké qua **heartbeat `saveAttemptDraft` sẵn có** — không thêm server action mới. Server ghi vào hai cột trên `Attempt` bằng `Math.max` nên số đếm chỉ tăng. Giáo viên đọc qua một component `ProctorFlag` dùng chung.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript strict, Prisma + PostgreSQL (Neon), vitest (môi trường `node`, **không có jsdom**), Tailwind.

**Spec:** [docs/superpowers/specs/2026-07-17-proctor-signals-design.md](../specs/2026-07-17-proctor-signals-design.md)

## Global Constraints

- **Chữ hiển thị và comment bằng tiếng Việt** — theo `CLAUDE.md`, khớp các file sẵn có.
- **Chữ phải trung tính**, mô tả hành vi chứ không kết tội: "Thử Ctrl+F", **không** dùng "Gian lận".
- **Chỉ phát hiện, không chặn:** tuyệt đối **không** gọi `event.preventDefault()` trong handler bắt Ctrl+F. Ô tìm kiếm phải mở ra bình thường.
- **Không hiện gì cho học viên** — số đếm nằm trong `useRef` + hidden input, không render lên màn hình, không toast, không cảnh báo.
- **Không gắn listener ở phòng xem trước** của giáo viên — mọi effect phải thoát sớm khi `previewMode === true`.
- **Không thêm server action mới, không thêm bảng mới.**
- **Cột mới BẮT BUỘC phải thêm vào `scripts/ensure-db.mjs`** — dự án dùng `db push` không có migrations; script này chạy lúc build và là cách duy nhất để cột xuất hiện trên DB production. Quên = prod sập.
- **Ngưỡng bật cờ: bất kỳ tín hiệu nào ≥ 1.**
- **Mốc rời tab tối thiểu: 2000ms.**
- Test không có jsdom → mọi hàm thuần phải nhận **object thường**, không nhận `KeyboardEvent` thật.
- Server action luôn bắt đầu bằng `requireStudent()` / `requireTeacher()` (đã có sẵn ở các action được sửa — giữ nguyên).

---

## File Structure

| File | Trách nhiệm |
| --- | --- |
| `lib/proctor-signals.ts` | **Tạo.** Logic thuần: nhận diện phím tắt, mốc 2s, ngưỡng cờ, gộp số đếm, chữ hiển thị. |
| `tests/proctor-signals.test.ts` | **Tạo.** Unit test cho file trên. |
| `prisma/schema.prisma` | **Sửa.** Thêm cột `Attempt.findAttemptCount`. |
| `scripts/ensure-db.mjs` | **Sửa.** SQL additive cho cột mới. |
| `tests/foundation.test.ts` | **Sửa.** Thêm `findAttemptCount` vào danh sách cột của `Attempt`. |
| `lib/actions/attempts.ts` | **Sửa.** `saveAttemptDraft` + `submitSkill` ghi số đếm. |
| `components/attempt-workspace.tsx` | **Sửa.** Bắt tín hiệu, hidden input, gửi qua heartbeat. |
| `components/proctor-flag.tsx` | **Tạo.** Component cờ ⚠ dùng chung cho ba danh sách. |
| `app/teacher/results/[attemptId]/page.tsx` | **Sửa.** Hiện số đếm đầy đủ. |
| `lib/assignment-calendar.ts` | **Sửa.** Thêm hai trường vào type `CalendarAttempt`. |
| `app/teacher/calendar/page.tsx` | **Sửa.** Thêm hai trường vào DTO. |
| `components/assignment-calendar.tsx` | **Sửa.** Cờ trong `StudentRow`. |
| `app/teacher/students/[studentId]/page.tsx` | **Sửa.** Cờ trong danh sách lần làm bài. |
| `app/teacher/review/page.tsx` | **Sửa.** Thêm hai trường vào `rows`. |
| `components/review-queue.tsx` | **Sửa.** Thêm vào type `Row` + cờ cạnh tên. |

---

### Task 1: Logic thuần `lib/proctor-signals.ts`

**Files:**
- Create: `lib/proctor-signals.ts`
- Test: `tests/proctor-signals.test.ts`

**Interfaces:**
- Consumes: không có (task đầu tiên, không phụ thuộc gì).
- Produces:
  - `TAB_AWAY_MIN_MS: number` (= 2000)
  - `type FindShortcutEvent = { key: string; ctrlKey: boolean; metaKey: boolean }`
  - `type ProctorCounts = { tabSwitchCount: number; findAttemptCount: number }`
  - `isFindShortcut(event: FindShortcutEvent): boolean`
  - `shouldCountTabAway(awayMs: number): boolean`
  - `hasProctorFlag(counts: ProctorCounts): boolean`
  - `mergeCount(current: number, incoming: number): number`
  - `proctorSummary(counts: ProctorCounts): string`

- [ ] **Step 1: Viết test thất bại**

Tạo `tests/proctor-signals.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  TAB_AWAY_MIN_MS,
  hasProctorFlag,
  isFindShortcut,
  mergeCount,
  proctorSummary,
  shouldCountTabAway
} from "@/lib/proctor-signals";

describe("isFindShortcut", () => {
  it("nhận diện Ctrl+F (Windows/Linux)", () => {
    expect(isFindShortcut({ key: "f", ctrlKey: true, metaKey: false })).toBe(true);
  });

  it("nhận diện Cmd+F (macOS)", () => {
    expect(isFindShortcut({ key: "f", ctrlKey: false, metaKey: true })).toBe(true);
  });

  it("nhận diện chữ F viết hoa (khi bật Caps Lock / giữ Shift)", () => {
    expect(isFindShortcut({ key: "F", ctrlKey: true, metaKey: false })).toBe(true);
  });

  it("nhận diện F3", () => {
    expect(isFindShortcut({ key: "F3", ctrlKey: false, metaKey: false })).toBe(true);
  });

  it("bỏ qua phím F trần (học viên đang gõ đáp án)", () => {
    expect(isFindShortcut({ key: "f", ctrlKey: false, metaKey: false })).toBe(false);
  });

  it("bỏ qua Ctrl kèm phím khác", () => {
    expect(isFindShortcut({ key: "c", ctrlKey: true, metaKey: false })).toBe(false);
  });
});

describe("shouldCountTabAway", () => {
  it("không tính khi rời tab ngắn hơn mốc", () => {
    expect(shouldCountTabAway(TAB_AWAY_MIN_MS - 1)).toBe(false);
  });

  it("tính khi rời tab đúng bằng mốc", () => {
    expect(shouldCountTabAway(TAB_AWAY_MIN_MS)).toBe(true);
  });

  it("tính khi rời tab lâu hơn mốc", () => {
    expect(shouldCountTabAway(TAB_AWAY_MIN_MS + 1)).toBe(true);
  });

  it("bỏ qua giá trị rác", () => {
    expect(shouldCountTabAway(Number.NaN)).toBe(false);
    expect(shouldCountTabAway(-5000)).toBe(false);
  });
});

describe("hasProctorFlag", () => {
  it("không bật cờ khi cả hai bằng 0", () => {
    expect(hasProctorFlag({ tabSwitchCount: 0, findAttemptCount: 0 })).toBe(false);
  });

  it("bật cờ khi chỉ có rời tab", () => {
    expect(hasProctorFlag({ tabSwitchCount: 1, findAttemptCount: 0 })).toBe(true);
  });

  it("bật cờ khi chỉ có Ctrl+F", () => {
    expect(hasProctorFlag({ tabSwitchCount: 0, findAttemptCount: 1 })).toBe(true);
  });
});

describe("mergeCount", () => {
  it("lấy giá trị lớn hơn", () => {
    expect(mergeCount(3, 7)).toBe(7);
  });

  it("không bao giờ kéo lùi số đã lưu", () => {
    expect(mergeCount(7, 3)).toBe(7);
  });

  it("coi giá trị rác là 0", () => {
    expect(mergeCount(5, Number.NaN)).toBe(5);
    expect(mergeCount(5, -2)).toBe(5);
    expect(mergeCount(Number.NaN, 4)).toBe(4);
  });

  it("làm tròn xuống số lẻ", () => {
    expect(mergeCount(0, 2.9)).toBe(2);
  });
});

describe("proctorSummary", () => {
  it("báo sạch khi không có dấu hiệu", () => {
    expect(proctorSummary({ tabSwitchCount: 0, findAttemptCount: 0 })).toBe(
      "Không ghi nhận dấu hiệu bất thường"
    );
  });

  it("liệt kê số đếm khi có dấu hiệu", () => {
    expect(proctorSummary({ tabSwitchCount: 3, findAttemptCount: 5 })).toBe(
      "Rời tab: 3 lần · Thử Ctrl+F: 5 lần"
    );
  });
});
```

- [ ] **Step 2: Chạy test để chắc chắn nó thất bại**

Run: `npx vitest run tests/proctor-signals.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/proctor-signals"`

- [ ] **Step 3: Viết code tối thiểu cho test xanh**

Tạo `lib/proctor-signals.ts`:

```ts
// Logic thuần cho việc ghi nhận hành vi đáng ngờ khi làm bài (nhấn Ctrl+F, rời tab).
// Không phụ thuộc React/Prisma/DOM để dùng chung cả client lẫn server và test thẳng
// bằng vitest (dự án không cài jsdom).
//
// LƯU Ý: đây chỉ là MANH MỐI để giáo viên hỏi lại học viên, KHÔNG phải bằng chứng
// gian lận — xem mục "Giới hạn đã biết" trong spec.

// Rời tab ngắn hơn mốc này KHÔNG được tính: thông báo nhảy lên rồi tắt trong tích tắc
// là vô tình, còn mở Google tra từ thì chắc chắn lâu hơn 2 giây.
export const TAB_AWAY_MIN_MS = 2000;

// Chỉ cần ba trường này — KeyboardEvent thật thoả mãn cấu trúc, nên test không cần DOM.
export type FindShortcutEvent = {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
};

export type ProctorCounts = {
  tabSwitchCount: number;
  findAttemptCount: number;
};

// Ctrl+F (Windows/Linux), Cmd+F (macOS), F3 (phím "tìm tiếp" của trình duyệt).
export function isFindShortcut(event: FindShortcutEvent): boolean {
  if (event.key === "F3") {
    return true;
  }
  return (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f";
}

export function shouldCountTabAway(awayMs: number): boolean {
  return Number.isFinite(awayMs) && awayMs >= TAB_AWAY_MIN_MS;
}

// Ngưỡng bật cờ: bất kỳ tín hiệu nào ≥ 1 (quyết định của giáo viên trong spec).
export function hasProctorFlag(counts: ProctorCounts): boolean {
  return counts.tabSwitchCount >= 1 || counts.findAttemptCount >= 1;
}

// Số đếm CHỈ ĐƯỢC TĂNG: nhịp heartbeat đến trễ / gửi lại / mở nhiều tab đều không
// được kéo lùi số đã lưu. Cùng nguyên tắc với elapsedSeconds trong attempts.ts.
export function mergeCount(current: number, incoming: number): number {
  const safeCurrent = Number.isFinite(current) && current > 0 ? Math.floor(current) : 0;
  const safeIncoming = Number.isFinite(incoming) && incoming > 0 ? Math.floor(incoming) : 0;
  return Math.max(safeCurrent, safeIncoming);
}

// Chữ hiển thị cho giáo viên — trung tính, mô tả hành vi chứ không kết tội.
export function proctorSummary(counts: ProctorCounts): string {
  if (!hasProctorFlag(counts)) {
    return "Không ghi nhận dấu hiệu bất thường";
  }
  return `Rời tab: ${counts.tabSwitchCount} lần · Thử Ctrl+F: ${counts.findAttemptCount} lần`;
}
```

- [ ] **Step 4: Chạy test để chắc chắn nó xanh**

Run: `npx vitest run tests/proctor-signals.test.ts`
Expected: PASS — 19 test xanh, 0 fail

- [ ] **Step 5: Commit**

```bash
git add lib/proctor-signals.ts tests/proctor-signals.test.ts
git commit -m "feat: logic thuần ghi nhận hành vi đáng ngờ khi làm bài"
```

---

### Task 2: Cột `findAttemptCount` trên `Attempt`

**Files:**
- Modify: `prisma/schema.prisma` (khối `model Attempt`, cạnh dòng 192)
- Modify: `scripts/ensure-db.mjs` (mảng `statements`)
- Test: `tests/foundation.test.ts` (danh sách cột `Attempt`, dòng ~54)

**Interfaces:**
- Consumes: không có.
- Produces: `Attempt.findAttemptCount: Int` (mặc định 0, NOT NULL) — dùng ở Task 3, 4, 6, 7, 8. `Attempt.tabSwitchCount` đã có sẵn từ trước, task này chỉ hồi sinh nó.

- [ ] **Step 1: Viết test thất bại**

Trong `tests/foundation.test.ts`, tìm mảng liệt kê cột của `Attempt` (có `"tabSwitchCount"` ở dòng ~54) và thêm một dòng ngay sau nó:

```ts
      "tabSwitchCount",
      "findAttemptCount",
```

- [ ] **Step 2: Chạy test để chắc chắn nó thất bại**

Run: `npx vitest run tests/foundation.test.ts`
Expected: FAIL — test grep `schema.prisma` không tìm thấy `findAttemptCount`

- [ ] **Step 3: Thêm cột vào schema**

Trong `prisma/schema.prisma`, khối `model Attempt`, thêm ngay dưới dòng `tabSwitchCount`:

```prisma
  tabSwitchCount        Int                 @default(0)
  // Số lần học viên nhấn Ctrl+F / F3 khi làm bài. Chỉ là manh mối để hỏi lại học
  // viên, KHÔNG phải bằng chứng: mở ô tìm kiếm qua menu ⋮ thì không đếm được.
  findAttemptCount      Int                 @default(0)
```

- [ ] **Step 4: Thêm SQL additive vào `scripts/ensure-db.mjs`**

Trong mảng `statements`, thêm vào cuối:

```js
  // Ghi nhận hành vi đáng ngờ khi làm bài (Ctrl+F, rời tab)
  'ALTER TABLE "Attempt" ADD COLUMN IF NOT EXISTS "findAttemptCount" INTEGER NOT NULL DEFAULT 0;',
  // tabSwitchCount đã có trong schema từ đầu nhưng chưa từng được ghi — thêm cho
  // chắc, câu lệnh idempotent nên chạy lại vô hại.
  'ALTER TABLE "Attempt" ADD COLUMN IF NOT EXISTS "tabSwitchCount" INTEGER NOT NULL DEFAULT 0;',
```

- [ ] **Step 5: Đẩy schema xuống DB local + sinh lại Prisma Client**

Run: `npx prisma db push`
Expected: `Your database is now in sync with your Prisma schema.` và `Generated Prisma Client`

- [ ] **Step 6: Chạy test để chắc chắn nó xanh**

Run: `npx vitest run tests/foundation.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma scripts/ensure-db.mjs tests/foundation.test.ts
git commit -m "feat: cột Attempt.findAttemptCount + ensure-db cho prod"
```

---

### Task 3: Server ghi số đếm

**Files:**
- Modify: `lib/actions/attempts.ts` — `submitSkill` (schema zod dòng ~185, thân hàm ~195, transaction ~305) và `saveAttemptDraft` (dòng ~366, transaction ở cuối hàm ~467)

**Interfaces:**
- Consumes: `mergeCount` từ `lib/proctor-signals.ts` (Task 1); cột `findAttemptCount` (Task 2).
- Produces: hai action nhận thêm field `FormData`: `tabSwitchCount`, `findAttemptCount` (chuỗi số). Task 4 gửi đúng hai tên này.

- [ ] **Step 1: Thêm import**

Ở đầu `lib/actions/attempts.ts`, thêm vào khối import:

```ts
import { mergeCount } from "@/lib/proctor-signals";
```

- [ ] **Step 2: Nhận hai field trong `submitSkill`**

Trong `submitSkillSchema` (dòng ~185), thêm hai dòng sau `elapsedSeconds`:

```ts
  elapsedSeconds: z.coerce.number().int().min(0).default(0),
  tabSwitchCount: z.coerce.number().int().min(0).default(0),
  findAttemptCount: z.coerce.number().int().min(0).default(0)
});
```

Trong `safeParse` của `submitSkill` (dòng ~200), thêm hai dòng sau `elapsedSeconds`:

```ts
    elapsedSeconds: formData.get("elapsedSeconds") ?? 0,
    tabSwitchCount: formData.get("tabSwitchCount") ?? 0,
    findAttemptCount: formData.get("findAttemptCount") ?? 0
  });
```

- [ ] **Step 3: Ghi số đếm ở MỌI lượt nộp**

Trong transaction của `submitSkill`, ngay **sau** khối `await tx.attemptSkill.update({...})` (kết thúc ở dòng ~314) và **trước** dòng `const skills = await tx.attemptSkill.findMany(...)`, chèn:

```ts
    // Ghi nhận hành vi đáng ngờ: gắn với cả Attempt (không tách theo kỹ năng). Chạy ở
    // MỌI lượt nộp chứ không chỉ lượt cuối, vì heartbeat gần nhất có thể đã cũ tới 10
    // giây. mergeCount đảm bảo chỉ tăng, không kéo lùi số đã lưu.
    await tx.attempt.update({
      where: { id: attempt.id },
      data: {
        tabSwitchCount: mergeCount(attempt.tabSwitchCount, parsed.data.tabSwitchCount),
        findAttemptCount: mergeCount(attempt.findAttemptCount, parsed.data.findAttemptCount)
      }
    });
```

- [ ] **Step 4: Ghi số đếm trong heartbeat `saveAttemptDraft`**

Trong `saveAttemptDraft`, ngay **trước** `await prisma.$transaction([` (dòng ~467), chèn:

```ts
  // Ghi nhận hành vi đáng ngờ theo nhịp heartbeat. `attempt` query bằng include: nên
  // đã có sẵn hai cột này. mergeCount chặn việc nhịp đến trễ kéo lùi số đã lưu.
  const proctorUpdate = [
    prisma.attempt.update({
      where: { id: attempt.id },
      data: {
        tabSwitchCount: mergeCount(
          attempt.tabSwitchCount,
          Number(formData.get("tabSwitchCount"))
        ),
        findAttemptCount: mergeCount(
          attempt.findAttemptCount,
          Number(formData.get("findAttemptCount"))
        )
      }
    })
  ];
```

Rồi thêm `...proctorUpdate` vào cuối mảng `$transaction`:

```ts
  await prisma.$transaction([
    prisma.answer.deleteMany({
      where: {
        attemptId: attempt.id,
        ...(lockedUnitIds.length > 0 ? { assignableUnitId: { notIn: lockedUnitIds } } : {})
      }
    }),
    ...(draftRows.length > 0
      ? [prisma.answer.createMany({ data: draftRows })]
      : []),
    ...partTimesUpdate,
    ...skillElapsedUpdate,
    ...proctorUpdate
  ]);
```

- [ ] **Step 5: Kiểm tra biên dịch**

Run: `npx tsc --noEmit`
Expected: không lỗi. (Nếu báo `tabSwitchCount` không tồn tại trên `attempt` → Task 2 chưa chạy `npx prisma db push`, chạy lại.)

- [ ] **Step 6: Commit**

```bash
git add lib/actions/attempts.ts
git commit -m "feat: server ghi số đếm hành vi đáng ngờ qua heartbeat và lúc nộp"
```

---

### Task 4: Client bắt tín hiệu

**Files:**
- Modify: `components/attempt-workspace.tsx` — type prop `attempt` (dòng ~95–120), refs (~1553), `persistDraft` (~1723), effect mới (đặt sau effect heartbeat ~1786), hidden inputs (~2040)

**Interfaces:**
- Consumes: `isFindShortcut`, `shouldCountTabAway` từ `lib/proctor-signals.ts` (Task 1); field `FormData` `tabSwitchCount` / `findAttemptCount` mà Task 3 đọc.
- Produces: không có (đây là lớp cuối phía học viên).

- [ ] **Step 1: Thêm import**

```ts
import { isFindShortcut, shouldCountTabAway } from "@/lib/proctor-signals";
```

- [ ] **Step 2: Thêm hai trường vào type prop `attempt`**

Tìm type prop `attempt` (khối có `elapsedSeconds: number;` ở dòng ~98 và ~117 — **kiểm cả hai chỗ**, sửa chỗ mô tả `attempt` được truyền vào `AttemptWorkspace`). Thêm:

```ts
    elapsedSeconds: number;
    tabSwitchCount: number;
    findAttemptCount: number;
```

Nếu TypeScript báo lỗi ở trang truyền props (`app/student/...`), kiểm tra trang đó query Attempt bằng `include:` (tự có mọi cột scalar) — thường không cần sửa gì.

- [ ] **Step 3: Thêm refs**

Cạnh `const elapsedRef = useRef<HTMLInputElement>(null);` (dòng ~1553):

```ts
  const tabSwitchInputRef = useRef<HTMLInputElement>(null);
  const findAttemptInputRef = useRef<HTMLInputElement>(null);
  // Số đếm để trong ref (không phải state): không cần render lại, và tuyệt đối không
  // hiện gì lên màn hình học viên.
  const tabSwitchCountRef = useRef(attempt.tabSwitchCount);
  const findAttemptCountRef = useRef(attempt.findAttemptCount);
```

- [ ] **Step 4: Thêm effect bắt tín hiệu**

Chèn ngay sau effect heartbeat (kết thúc ở dòng ~1786):

```ts
  // Ghi nhận hành vi đáng ngờ: CHỈ ĐẾM, KHÔNG CHẶN. Cố ý không gọi preventDefault để
  // ô tìm kiếm vẫn mở bình thường và học viên không biết mình bị ghi nhận — tính năng
  // này hiệu quả nhất khi học viên không biết nó tồn tại.
  // Không chạy ở phòng xem trước của giáo viên (giáo viên tự xem đề của mình).
  useEffect(() => {
    if (previewMode || !activeSkill) {
      return;
    }

    function bump(
      counter: { current: number },
      input: React.RefObject<HTMLInputElement>
    ) {
      counter.current += 1;
      if (input.current) {
        input.current.value = String(counter.current);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (isFindShortcut(event)) {
        bump(findAttemptCountRef, findAttemptInputRef);
      }
    }

    // Chỉ tính khi rời tab quá TAB_AWAY_MIN_MS: thông báo nhảy lên rồi tắt ngay là vô
    // tình, không phải gian lận.
    let hiddenSince: number | null = null;
    function onVisibilityChange() {
      if (document.hidden) {
        hiddenSince = Date.now();
        return;
      }
      if (hiddenSince !== null && shouldCountTabAway(Date.now() - hiddenSince)) {
        bump(tabSwitchCountRef, tabSwitchInputRef);
      }
      hiddenSince = null;
    }

    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [previewMode, activeSkill]);
```

- [ ] **Step 5: Gửi số đếm qua heartbeat**

Trong `persistDraft` (dòng ~1723), sau dòng `formData.set("partTimesJson", ...)`:

```ts
      formData.set("partTimesJson", JSON.stringify(snapshotPartTimes()));
      formData.set("tabSwitchCount", String(tabSwitchCountRef.current));
      formData.set("findAttemptCount", String(findAttemptCountRef.current));
```

- [ ] **Step 6: Thêm hidden input cho form nộp bài**

Sau hidden input `partTimesJson` (dòng ~2042–2047):

```tsx
      <input
        ref={tabSwitchInputRef}
        type="hidden"
        name="tabSwitchCount"
        defaultValue={attempt.tabSwitchCount}
      />
      <input
        ref={findAttemptInputRef}
        type="hidden"
        name="findAttemptCount"
        defaultValue={attempt.findAttemptCount}
      />
```

- [ ] **Step 7: Kiểm tra biên dịch + lint**

Run: `npx tsc --noEmit && pnpm lint`
Expected: không lỗi

- [ ] **Step 8: Commit**

```bash
git add components/attempt-workspace.tsx
git commit -m "feat: đếm Ctrl+F và rời tab trong phòng làm bài (chỉ đếm, không chặn)"
```

---

### Task 5: Component `ProctorFlag` + số đếm ở trang kết quả

**Files:**
- Create: `components/proctor-flag.tsx`
- Modify: `app/teacher/results/[attemptId]/page.tsx` (dòng ~103–111)

**Interfaces:**
- Consumes: `hasProctorFlag`, `proctorSummary`, `ProctorCounts` từ `lib/proctor-signals.ts` (Task 1).
- Produces: `<ProctorFlag counts={...} className?={...} />` — dùng ở Task 6 và 7. Trả `null` khi không có dấu hiệu.

- [ ] **Step 1: Tạo component**

Tạo `components/proctor-flag.tsx`:

```tsx
import { hasProctorFlag, proctorSummary, type ProctorCounts } from "@/lib/proctor-signals";

// Cờ cảnh báo hành vi đáng ngờ, dùng chung cho lịch giao bài / trang học viên / hàng
// đợi chấm để ba chỗ không bao giờ lệch nhau. Không có dấu hiệu thì không hiện gì.
// Theo đúng kiểu thẻ ⚠️ của durationSuspect sẵn có trong review-queue.tsx.
export function ProctorFlag({
  counts,
  className = ""
}: {
  counts: ProctorCounts;
  className?: string;
}) {
  if (!hasProctorFlag(counts)) {
    return null;
  }
  return (
    <span
      className={`cursor-help ${className}`.trim()}
      title={`${proctorSummary(counts)} — chỉ là dấu hiệu để hỏi lại học viên, không phải bằng chứng gian lận`}
    >
      ⚠️
    </span>
  );
}
```

- [ ] **Step 2: Hiện số đếm ở trang kết quả**

Trong `app/teacher/results/[attemptId]/page.tsx`, thêm import:

```ts
import { proctorSummary } from "@/lib/proctor-signals";
```

Rồi ngay **sau** thẻ `<p>` chứa `formatDuration(attempt.elapsedSeconds)` (kết thúc ở dòng ~111) và **trước** `<SkillTimeSummary`, chèn:

```tsx
            <p className="mt-1 text-xs text-muted-foreground">{proctorSummary(attempt)}</p>
```

(`attempt` từ Prisma đã có sẵn `tabSwitchCount` + `findAttemptCount` nên khớp cấu trúc `ProctorCounts` — không cần map.)

- [ ] **Step 3: Kiểm tra biên dịch**

Run: `npx tsc --noEmit`
Expected: không lỗi

- [ ] **Step 4: Commit**

```bash
git add components/proctor-flag.tsx "app/teacher/results/[attemptId]/page.tsx"
git commit -m "feat: component ProctorFlag + số đếm hành vi ở trang kết quả"
```

---

### Task 6: Cờ ở lịch giao bài

**Quan trọng nhất trong ba danh sách** — đây là chỗ **duy nhất** hiện bài Reading và có link `Xem bài →`.

**Files:**
- Modify: `lib/assignment-calendar.ts` (type `CalendarAttempt`, dòng ~19–31)
- Modify: `app/teacher/calendar/page.tsx` (DTO, dòng ~105–116)
- Modify: `components/assignment-calendar.tsx` (`StudentRow`, hàng thẻ dòng ~303–321)

**Interfaces:**
- Consumes: `<ProctorFlag />` (Task 5).
- Produces: `CalendarAttempt` có thêm `tabSwitchCount: number` và `findAttemptCount: number`.

- [ ] **Step 1: Thêm hai trường vào type**

Trong `lib/assignment-calendar.ts`, khối `export type CalendarAttempt = {` (dòng ~19), thêm cạnh `elapsedSeconds: number;`:

```ts
  elapsedSeconds: number;
  tabSwitchCount: number;
  findAttemptCount: number;
```

- [ ] **Step 2: Chạy tsc để thấy nó bắt lỗi thiếu DTO**

Run: `npx tsc --noEmit`
Expected: FAIL — `app/teacher/calendar/page.tsx` thiếu `tabSwitchCount` / `findAttemptCount` trong object trả về. **Đây chính là lưới an toàn** mà spec nói tới: sửa type trước thì TypeScript ép ta không quên DTO.

- [ ] **Step 3: Thêm hai trường vào DTO**

Trong `app/teacher/calendar/page.tsx`, object `attempt: {` (dòng ~105), thêm cạnh `elapsedSeconds`:

```ts
            elapsedSeconds: attempt.elapsedSeconds,
            tabSwitchCount: attempt.tabSwitchCount,
            findAttemptCount: attempt.findAttemptCount,
```

(Truy vấn dùng `include:` nên Prisma đã trả sẵn hai cột này — **không cần sửa truy vấn**.)

- [ ] **Step 4: Hiện cờ trong `StudentRow`**

Trong `components/assignment-calendar.tsx`, thêm import:

```ts
import { ProctorFlag } from "@/components/proctor-flag";
```

Rồi trong `StudentRow`, hàng thẻ `<div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">`, thêm ngay **sau** thẻ `{formatAttemptResult(attempt)}` (dòng ~320) và **trước** `</>`:

```tsx
            <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
              {formatAttemptResult(attempt)}
            </span>
            <ProctorFlag counts={attempt} className="self-center" />
```

- [ ] **Step 5: Kiểm tra biên dịch**

Run: `npx tsc --noEmit && pnpm lint`
Expected: không lỗi

- [ ] **Step 6: Commit**

```bash
git add lib/assignment-calendar.ts app/teacher/calendar/page.tsx components/assignment-calendar.tsx
git commit -m "feat: cờ hành vi đáng ngờ ở lịch giao bài"
```

---

### Task 7: Cờ ở trang học viên + hàng đợi chấm

**Files:**
- Modify: `app/teacher/students/[studentId]/page.tsx` (danh sách lần làm bài, dòng ~202–210)
- Modify: `app/teacher/review/page.tsx` (`rows`, dòng ~53–70)
- Modify: `components/review-queue.tsx` (type `Row` dòng ~8–20, ô tên dòng ~179–182)

**Interfaces:**
- Consumes: `<ProctorFlag />` (Task 5).
- Produces: không có (lớp hiển thị cuối).

- [ ] **Step 1: Cờ ở trang học viên**

Trong `app/teacher/students/[studentId]/page.tsx`, thêm import:

```ts
import { ProctorFlag } from "@/components/proctor-flag";
```

Trong `recipient.attempts.map(...)`, tìm thẻ hiện `statusLabel(attempt.status)` và điểm (dòng ~203–208) rồi thêm cờ ngay sau nó:

```tsx
                          <ProctorFlag counts={attempt} />
```

(`attempt` từ Prisma query dùng `include:` nên đã có sẵn hai cột — không cần sửa truy vấn.)

- [ ] **Step 2: Thêm hai trường vào type `Row`**

Trong `components/review-queue.tsx`, khối type có `durationSuspect: boolean;` (dòng ~19), thêm:

```ts
  durationSuspect: boolean;
  tabSwitchCount: number;
  findAttemptCount: number;
```

- [ ] **Step 3: Chạy tsc để thấy nó bắt lỗi thiếu `rows`**

Run: `npx tsc --noEmit`
Expected: FAIL — `app/teacher/review/page.tsx` thiếu hai trường trong `rows`

- [ ] **Step 4: Thêm hai trường vào `rows`**

Trong `app/teacher/review/page.tsx`, object trả về của `attempts.map(...)`, thêm sau `durationSuspect`:

```ts
      durationSuspect: durationExceedsLimit(attempt.elapsedSeconds, assignment.timeLimitMinutes),
      tabSwitchCount: attempt.tabSwitchCount,
      findAttemptCount: attempt.findAttemptCount
    };
```

- [ ] **Step 5: Hiện cờ cạnh tên trong hàng đợi**

Trong `components/review-queue.tsx`, thêm import:

```ts
import { ProctorFlag } from "@/components/proctor-flag";
```

Rồi sửa ô tên (dòng ~179–182):

```tsx
                    <td className="px-4 py-3">
                      <p className="flex items-center gap-1 font-medium">
                        {row.studentName}
                        <ProctorFlag counts={row} />
                      </p>
                      <p className="text-xs text-muted-foreground">{row.studentEmail}</p>
                    </td>
```

- [ ] **Step 6: Kiểm tra biên dịch + toàn bộ test**

Run: `npx tsc --noEmit && pnpm lint && pnpm test`
Expected: tsc và lint không lỗi; toàn bộ vitest xanh

- [ ] **Step 7: Commit**

```bash
git add "app/teacher/students/[studentId]/page.tsx" app/teacher/review/page.tsx components/review-queue.tsx
git commit -m "feat: cờ hành vi đáng ngờ ở trang học viên và hàng đợi chấm"
```

---

### Task 8: Kiểm chứng chạy thật trên trình duyệt

Test unit **không phủ được** phần bắt tín hiệu (dự án không có jsdom) — bắt buộc phải chạy thật.

**Files:** không sửa file nào (chỉ kiểm chứng; nếu phát hiện lỗi thì quay lại task tương ứng).

- [ ] **Step 1: Khởi động dev server**

Dùng `preview_start` với `.claude/launch.json` (**không** chạy `pnpm dev` qua Bash). Nếu chưa có file đó, tạo:

```json
{
  "version": "0.0.1",
  "configurations": [
    { "name": "ielts-dev", "runtimeExecutable": "pnpm", "runtimeArgs": ["dev"], "port": 3000 }
  ]
}
```

- [ ] **Step 2: Vào phòng làm bài với tài khoản học viên**

Đăng nhập `student@example.com` / `student123`, mở một bài Reading đã được giao.

- [ ] **Step 3: Kiểm chứng đếm Ctrl+F — và kiểm chứng KHÔNG chặn**

Nhấn Ctrl+F. **Ô tìm kiếm của trình duyệt PHẢI mở ra bình thường** — nếu nó bị chặn là đã vi phạm ràng buộc "chỉ phát hiện, không chặn", quay lại Task 4 xoá `preventDefault`.

Kiểm giá trị hidden input (một lần chạy `javascript_tool` duy nhất — theo bài học trong bộ nhớ, bấm rồi soi DOM phải cùng một lần chạy):

```js
document.querySelector('input[name="findAttemptCount"]')?.value
```
Expected: `"1"` sau một lần nhấn.

- [ ] **Step 4: Kiểm chứng mốc 2 giây của rời tab**

Chuyển sang tab khác **dưới 2 giây** rồi quay lại → `tabSwitchCount` vẫn `"0"`.
Chuyển sang tab khác **quá 3 giây** rồi quay lại → `tabSwitchCount` thành `"1"`.

```js
document.querySelector('input[name="tabSwitchCount"]')?.value
```

- [ ] **Step 5: Kiểm chứng heartbeat đã ghi vào DB**

Đợi >10 giây rồi soi DB bằng MCP Neon (`run_sql`) trên nhánh local:

```sql
SELECT "id", "tabSwitchCount", "findAttemptCount" FROM "Attempt" ORDER BY "startedAt" DESC LIMIT 1;
```
Expected: hai số khớp với hidden input — chứng minh heartbeat gửi được, **không cần nộp bài**.

- [ ] **Step 6: Nộp bài và kiểm trang kết quả**

Nộp bài, rồi vào `/teacher/results/<attemptId>` với tài khoản giáo viên (`teacher@example.com` / `teacher123`).
Expected: hiện dòng `Rời tab: 1 lần · Thử Ctrl+F: 1 lần`.

- [ ] **Step 7: Kiểm cờ ở lịch giao bài**

Vào `/teacher/calendar`, tìm học viên vừa nộp.
Expected: có ⚠️ cạnh các thẻ trạng thái; rê chuột hiện tooltip đúng số đếm.

- [ ] **Step 8: Kiểm chứng phòng xem trước KHÔNG đếm**

Vào `/teacher/materials/<materialId>/preview` với tài khoản giáo viên, nhấn Ctrl+F vài lần.
Expected: **không có** input `findAttemptCount` nào tăng, không có request `saveAttemptDraft` nào (kiểm bằng `read_network_requests`). Đây là ràng buộc `previewMode` trong Task 4.

- [ ] **Step 9: Chụp màn hình làm bằng chứng cho giáo viên**

Dùng `computer {action: "screenshot"}` ở trang kết quả và ở lịch giao bài.

- [ ] **Step 10: Push**

```bash
git push origin feature/ielts-platform-mvp
```

Vercel tự deploy. Sau khi deploy xong, kiểm log build có chạy `ensure-db.mjs` và cột mới đã lên prod (Neon project **"IELTS_Platform"** = prod — xem bộ nhớ, tên hai project bị ngược nhau).

---

## Rủi ro đã biết khi triển khai

| Rủi ro | Dấu hiệu | Cách xử lý |
| --- | --- | --- |
| Quên `ensure-db.mjs` | Prod sập khi mở trang kết quả: `column "findAttemptCount" does not exist` | Task 2 Step 4 — bắt buộc |
| Quên `prisma db push` local | `npx tsc --noEmit` báo `tabSwitchCount` không có trên type `Attempt` | Task 2 Step 5 |
| Lỡ tay `preventDefault` | Ô tìm kiếm không mở ra khi nhấn Ctrl+F | Task 8 Step 3 sẽ bắt được |
| Sót DTO | Cờ **im lặng không hiện**, không báo lỗi | Task 6/7 sửa **type trước** để `tsc` ép — đừng đảo thứ tự |
| Listener chạy ở phòng xem trước | Số đếm tăng khi giáo viên tự xem đề | Task 8 Step 8 |
