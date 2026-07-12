# Tự động nộp khi hết giờ + đồng hồ theo thời gian làm thực — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Khi hết thời gian một kỹ năng, bài tự động nộp (Listening/Reading/Writing, không Speaking); đồng hồ chỉ đếm "thời gian làm thực", tạm dừng khi mất mạng/đóng tab/máy ngủ, mở lại tiếp tục đúng chỗ.

**Architecture:** Repurpose cột sẵn có `AttemptSkill.elapsedSeconds` thành "số giây đã làm thực", cộng dồn ở client bằng vòng lặp 1 giây có chặn-nhảy (mỗi nhịp tối đa 2s), lưu định kỳ ~10s qua `saveAttemptDraft`. Đồng hồ hiển thị `ngân sách − đã làm`; khi về 0 gọi `form.requestSubmit()` với `submitReason="auto_timeout"`. Server đổi chính sách: chấp nhận `auto_timeout` chỉ khi kỹ năng thật sự hết ngân sách. Không thêm cột/bảng Prisma.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript strict, Prisma/PostgreSQL, Vitest.

## Global Constraints

- Text người dùng + comment bằng **tiếng Việt**, đồng bộ file hiện có.
- Mọi server action bắt đầu bằng `requireStudent()` và scope Prisma theo `studentId` — không tin `FormData` id trần.
- **Không** thêm cột/bảng Prisma ⇒ **không** đụng `scripts/ensure-db.mjs`, `prisma/schema.prisma`.
- Kỹ năng tự nộp: **listening, reading, writing**. **Speaking không bao giờ tự nộp.**
- Ngân sách kỹ năng: `skillLimits[skill] ?? (isMultiSkill ? null : timeLimitMinutes)`. `null` = không giới hạn = không tự nộp.
- Path alias `@/*` → repo root. `pnpm test` = `vitest run`. `pnpm build` = `prisma generate && next build`.

---

## File Structure

- **Create** `lib/active-time.ts` — helper thuần (không phụ thuộc React/Prisma): cộng dồn active time, ngân sách kỹ năng, kiểm tra hết giờ, danh sách kỹ năng tự nộp. Dùng chung cho cả client và server.
- **Create** `tests/active-time.test.ts` — unit test cho helper thuần.
- **Modify** `lib/actions/attempts.ts` — (a) `saveAttemptDraft` ghi thêm `AttemptSkill.elapsedSeconds` (heartbeat); (b) `submitSkill` đổi guard `auto_timeout`.
- **Modify** `components/attempt-workspace.tsx` — bộ đếm active time + tự nộp + heartbeat; `CountdownTimer` hiển thị "còn lại".

---

## Task 1: Helper thuần `lib/active-time.ts` (TDD)

**Files:**
- Create: `lib/active-time.ts`
- Test: `tests/active-time.test.ts`

**Interfaces:**
- Produces:
  - `ACTIVE_TICK_CAP_SECONDS: number` (= 2)
  - `AUTO_SUBMIT_SKILLS: Set<string>` (= {"listening","reading","writing"})
  - `accumulateActiveSeconds(current: number, deltaMs: number, capSeconds?: number): number`
  - `skillBudgetSeconds(skill: string, skillLimits: Record<string, number>, isMultiSkill: boolean, fallbackMinutes: number | null): number | null`
  - `isSkillTimeUp(elapsedSeconds: number, budgetSeconds: number, epsilonSeconds?: number): boolean`

- [ ] **Step 1: Write the failing test**

Create `tests/active-time.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  ACTIVE_TICK_CAP_SECONDS,
  AUTO_SUBMIT_SKILLS,
  accumulateActiveSeconds,
  skillBudgetSeconds,
  isSkillTimeUp
} from "@/lib/active-time";

describe("accumulateActiveSeconds", () => {
  it("cộng delta bình thường (~1s)", () => {
    expect(accumulateActiveSeconds(10, 1000)).toBeCloseTo(11);
  });

  it("chặn nhịp nhảy lớn ở mức cap (máy ngủ/tab nền/mất mạng)", () => {
    // delta 10 phút nhưng chỉ cộng tối đa cap giây
    expect(accumulateActiveSeconds(100, 600_000)).toBe(100 + ACTIVE_TICK_CAP_SECONDS);
  });

  it("không cộng khi delta âm (đồng hồ hệ thống lùi)", () => {
    expect(accumulateActiveSeconds(50, -5000)).toBe(50);
  });
});

describe("skillBudgetSeconds", () => {
  it("dùng giới hạn riêng của kỹ năng (đổi ra giây)", () => {
    expect(skillBudgetSeconds("reading", { reading: 30 }, true, null)).toBe(1800);
  });

  it("bài nhiều kỹ năng không đặt giờ kỹ năng đó → null", () => {
    expect(skillBudgetSeconds("writing", {}, true, 60)).toBeNull();
  });

  it("bài một kỹ năng không có giới hạn riêng → dùng giờ chung của bài", () => {
    expect(skillBudgetSeconds("listening", {}, false, 40)).toBe(2400);
  });

  it("không giới hạn nào → null", () => {
    expect(skillBudgetSeconds("listening", {}, false, null)).toBeNull();
  });
});

describe("isSkillTimeUp", () => {
  it("chưa hết giờ", () => {
    expect(isSkillTimeUp(1000, 1800)).toBe(false);
  });

  it("đã hết giờ", () => {
    expect(isSkillTimeUp(1800, 1800)).toBe(true);
  });

  it("còn thiếu trong khoảng epsilon vẫn coi là hết (làm tròn nhịp cuối)", () => {
    expect(isSkillTimeUp(1798, 1800, 3)).toBe(true);
  });
});

describe("AUTO_SUBMIT_SKILLS", () => {
  it("gồm listening/reading/writing, không có speaking", () => {
    expect(AUTO_SUBMIT_SKILLS.has("listening")).toBe(true);
    expect(AUTO_SUBMIT_SKILLS.has("reading")).toBe(true);
    expect(AUTO_SUBMIT_SKILLS.has("writing")).toBe(true);
    expect(AUTO_SUBMIT_SKILLS.has("speaking")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/active-time.test.ts`
Expected: FAIL — không tìm thấy module `@/lib/active-time`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/active-time.ts`:

```ts
// Helper thuần cho đồng hồ "thời gian làm thực" + tự động nộp khi hết giờ.
// Không phụ thuộc React/Prisma để dùng chung cả client lẫn server action.

// Mỗi nhịp đếm chỉ cộng tối đa bấy nhiêu giây. Khi máy ngủ / tab ở nền bị trình
// duyệt throttle / mất mạng làm treo JS thì nhịp giãn rất dài — chặn ở mức này để
// khoảng lặng đó KHÔNG bị tính vào thời gian làm bài.
export const ACTIVE_TICK_CAP_SECONDS = 2;

// Kỹ năng được tự động nộp khi hết giờ. Speaking KHÔNG tự nộp.
export const AUTO_SUBMIT_SKILLS = new Set<string>(["listening", "reading", "writing"]);

// Cộng dồn thời gian làm thực theo từng nhịp, chặn nhịp nhảy và bỏ qua delta âm.
export function accumulateActiveSeconds(
  current: number,
  deltaMs: number,
  capSeconds: number = ACTIVE_TICK_CAP_SECONDS
): number {
  const deltaSeconds = deltaMs / 1000;
  const capped = Math.min(Math.max(deltaSeconds, 0), capSeconds);
  return current + capped;
}

// Ngân sách thời gian (giây) của một kỹ năng; null = không giới hạn.
export function skillBudgetSeconds(
  skill: string,
  skillLimits: Record<string, number>,
  isMultiSkill: boolean,
  fallbackMinutes: number | null
): number | null {
  const minutes = skillLimits[skill] ?? (isMultiSkill ? null : fallbackMinutes);
  return minutes != null ? minutes * 60 : null;
}

// Đã dùng hết ngân sách chưa (chừa epsilon chống lệch làm tròn ở nhịp cuối).
export function isSkillTimeUp(
  elapsedSeconds: number,
  budgetSeconds: number,
  epsilonSeconds: number = 3
): boolean {
  return elapsedSeconds >= budgetSeconds - epsilonSeconds;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/active-time.test.ts`
Expected: PASS (tất cả test).

- [ ] **Step 5: Commit**

```bash
git add lib/active-time.ts tests/active-time.test.ts
git commit -m "feat: helper thuần cho đồng hồ thời-gian-làm-thực + tự nộp"
```

---

## Task 2: Heartbeat — `saveAttemptDraft` ghi `AttemptSkill.elapsedSeconds`

**Files:**
- Modify: `lib/actions/attempts.ts` (hàm `saveAttemptDraft`, hiện ~dòng 345–432)

**Interfaces:**
- Consumes: `FormData` nay có thêm `skill` (string) và `elapsedSeconds` (số giây đã làm thực).
- Produces: `saveAttemptDraft` cập nhật `AttemptSkill.elapsedSeconds = max(cũ, mới)` cho kỹ năng đang mở, bỏ qua kỹ năng đã `submitted`. Chữ ký export không đổi.

- [ ] **Step 1: Thêm cập nhật elapsedSeconds theo kỹ năng**

Trong `saveAttemptDraft`, ngay **trước** khối `await prisma.$transaction([ ... ])` (hiện ~dòng 420) và **sau** khi đã có `partTimesUpdate`, chèn:

```ts
  // Heartbeat thời gian làm thực: ghi vào AttemptSkill.elapsedSeconds của kỹ năng
  // đang mở. Chỉ tăng (max) để nhịp lỗi/nhiều tab không kéo lùi; bỏ qua kỹ năng đã nộp.
  const draftSkill = String(formData.get("skill") ?? "").trim();
  const draftElapsed = Number(formData.get("elapsedSeconds"));
  const skillRowForElapsed =
    draftSkill && Number.isFinite(draftElapsed) && draftElapsed >= 0
      ? await prisma.attemptSkill.findUnique({
          where: { attemptId_skill: { attemptId: attempt.id, skill: draftSkill } },
          select: { elapsedSeconds: true, status: true }
        })
      : null;
  const skillElapsedUpdate =
    skillRowForElapsed && skillRowForElapsed.status !== "submitted"
      ? [
          prisma.attemptSkill.updateMany({
            where: { attemptId: attempt.id, skill: draftSkill, status: { not: "submitted" } },
            data: {
              elapsedSeconds: Math.max(
                skillRowForElapsed.elapsedSeconds,
                Math.floor(draftElapsed)
              )
            }
          })
        ]
      : [];
```

- [ ] **Step 2: Đưa update vào transaction**

Sửa mảng `$transaction` ở cuối `saveAttemptDraft` — thêm `...skillElapsedUpdate` vào cuối:

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
    ...skillElapsedUpdate
  ]);
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: Không có lỗi mới ở `lib/actions/attempts.ts`.

- [ ] **Step 4: Commit**

```bash
git add lib/actions/attempts.ts
git commit -m "feat: saveAttemptDraft lưu thời gian làm thực theo kỹ năng (heartbeat)"
```

---

## Task 3: Server guard — chấp nhận `auto_timeout` khi thật sự hết giờ

**Files:**
- Modify: `lib/actions/attempts.ts` (hàm `submitSkill`: bỏ early-return ~dòng 203–206; thêm guard sau khi có `skillRow` ~dòng 243; thêm import)

**Interfaces:**
- Consumes: `skillBudgetSeconds`, `isSkillTimeUp` từ `@/lib/active-time`; `parseSkillTimeLimits` từ `@/lib/skill-parse`; `orderedSkillsOfAssignment` (đã import).
- Produces: `submitSkill` bỏ qua `auto_timeout` **trừ khi** kỹ năng có giới hạn giờ và `elapsed ≥ ngân sách`. Speaking `auto_timeout` luôn bỏ qua.

- [ ] **Step 1: Thêm import**

Đầu file `lib/actions/attempts.ts`, sau dòng `import { sanitizePartTimesJson } from "@/lib/skill-times";` (dòng 11), thêm:

```ts
import { parseSkillTimeLimits } from "@/lib/skill-parse";
import { isSkillTimeUp, skillBudgetSeconds } from "@/lib/active-time";
```

- [ ] **Step 2: Bỏ early-return auto_timeout cũ**

Xoá khối hiện tại (dòng ~203–206):

```ts
  // Giữ chính sách: bỏ qua auto-timeout.
  if (parsed.data.submitReason === "auto_timeout") {
    return;
  }
```

- [ ] **Step 3: Thêm guard mới sau khi có skillRow**

Ngay **sau** khối kiểm tra `if (skillRow?.status === "submitted") { redirect(...); }` (hiện ~dòng 241–243) và **trước** `const allUnits = ...` (dòng 245), chèn:

```ts
  // Tự động nộp khi hết giờ: chỉ chấp nhận khi kỹ năng THẬT SỰ đã dùng hết ngân
  // sách thời gian (chống nộp non do client lỗi). Speaking không bao giờ tự nộp.
  if (parsed.data.submitReason === "auto_timeout") {
    if (parsed.data.skill === "speaking") {
      return;
    }
    const assignment = attempt.assignmentRecipient.assignment;
    const isMultiSkill = orderedSkillsOfAssignment(assignment.units).length > 1;
    const budget = skillBudgetSeconds(
      parsed.data.skill,
      parseSkillTimeLimits(assignment.skillTimeLimitsJson),
      isMultiSkill,
      assignment.timeLimitMinutes
    );
    if (budget == null) {
      return; // kỹ năng không giới hạn giờ → không tự nộp.
    }
    const elapsed = Math.max(parsed.data.elapsedSeconds, skillRow?.elapsedSeconds ?? 0);
    if (!isSkillTimeUp(elapsed, budget)) {
      return; // client gửi nhầm lúc chưa hết giờ.
    }
  }
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: Không lỗi. (Nếu báo `skillTimeLimitsJson`/`timeLimitMinutes`/`units` thiếu type: xác nhận query `submitSkill` đã `include` `assignmentRecipient.assignment.units` — scalar fields của assignment tự có; không cần sửa query.)

- [ ] **Step 5: Chạy toàn bộ unit test (đảm bảo không vỡ foundation)**

Run: `pnpm test`
Expected: PASS toàn bộ (foundation.test.ts chỉ khẳng định schema có cột `submitReason`, không khoá hành vi cũ).

- [ ] **Step 6: Commit**

```bash
git add lib/actions/attempts.ts
git commit -m "feat: submitSkill chấp nhận tự-nộp khi kỹ năng thật sự hết giờ"
```

---

## Task 4: Client — đồng hồ active-time + tự nộp + heartbeat (`attempt-workspace.tsx`)

**Files:**
- Modify: `components/attempt-workspace.tsx`

**Interfaces:**
- Consumes: `accumulateActiveSeconds`, `AUTO_SUBMIT_SKILLS` từ `@/lib/active-time`; `saveAttemptDraft`, `submitSkill` (đã import); `activeSkillLimit` (số phút, đã có); `activeSkillRow` (đã có, chứa `elapsedSeconds`).
- Produces: `CountdownTimer({ remainingSeconds })`; hành vi tự nộp khi hết giờ cho listening/reading/writing.

- [ ] **Step 1: Thêm import helper**

Đầu `components/attempt-workspace.tsx`, thêm cạnh import `parseSkillTimeLimits`:

```ts
import { accumulateActiveSeconds, AUTO_SUBMIT_SKILLS } from "@/lib/active-time";
```

- [ ] **Step 2: Đổi `CountdownTimer` sang hiển thị "còn lại (giây)"**

Thay toàn bộ hàm `CountdownTimer` (hiện ~dòng 1369–1418) bằng:

```tsx
function CountdownTimer({ remainingSeconds }: { remainingSeconds: number }) {
  const totalSeconds = Math.max(0, Math.floor(remainingSeconds));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const expired = totalSeconds <= 0;
  const low = totalSeconds <= 60;

  return (
    <div
      className={[
        "inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold tabular-nums",
        expired || low
          ? "border-red-400/60 bg-red-500/10 text-red-600 dark:text-red-300"
          : "border-accent/40 bg-accent/10 text-accent-foreground dark:text-accent"
      ].join(" ")}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" strokeLinecap="round" />
      </svg>
      {expired ? (
        <span className="font-semibold uppercase tracking-wide">Hết giờ</span>
      ) : (
        <>
          <span className="hidden text-[11px] font-medium uppercase tracking-wide opacity-80 sm:inline">
            Còn lại
          </span>
          {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Thêm ref bộ đếm cạnh các ref khác**

Sau `const formRef = useRef<HTMLFormElement>(null);` (dòng ~1522), thêm:

```ts
  // Bộ đếm "thời gian làm thực" (giây) của kỹ năng đang mở + cờ chống tự-nộp trùng.
  const consumedRef = useRef(0);
  const autoSubmittedRef = useRef(false);
```

- [ ] **Step 4: Thêm state `remaining`**

Cạnh các `useState` khác (sau `const [activePart, setActivePart] = useState(0);`, dòng ~1601), thêm:

```ts
  // Số giây còn lại của kỹ năng đang mở (null = không giới hạn / chưa mở kỹ năng).
  const [remaining, setRemaining] = useState<number | null>(null);
```

- [ ] **Step 5: Bỏ mốc bắt đầu client cũ (không còn dùng cho đồng hồ)**

Xoá dòng khai báo state override (dòng ~1546):

```ts
  const [skillStartOverrides, setSkillStartOverrides] = useState<Record<string, number>>({});
```

Trong `openSkill` (dòng ~1671–1682), xoá khối set override, để lại:

```ts
  async function openSkill(skill: string) {
    if (!previewMode) {
      const formData = new FormData();
      formData.set("attemptId", attempt.id);
      formData.set("skill", skill);
      await startSkillSession(formData);
    }
    setActiveSkill(skill);
  }
```

Xoá luôn `skillStartOverrideMs` và `skillStartedAtMs` (dòng ~1661–1664):

```ts
  const skillStartOverrideMs = activeSkill ? skillStartOverrides[activeSkill] : undefined;
  const skillStartedAtMs =
    skillStartOverrideMs ??
    (activeSkillRow?.startedAt ? new Date(activeSkillRow.startedAt).getTime() : startedAtMs);
```

Giữ lại `const activeSkillRow = ...` (dòng 1660) và `const activeSkillLimit = ...` (dòng 1665–1667).

- [ ] **Step 6: Thêm hàm `maybeAutoSubmit`**

Ngay **sau** `activeSkillLimit` (dòng ~1667), thêm:

```ts
  // Tự động nộp kỹ năng khi hết giờ: chỉ Listening/Reading/Writing, không xem trước,
  // và chỉ một lần. Gọi requestSubmit() nên KHÔNG đi qua hộp thoại xác nhận của nút Nộp.
  const maybeAutoSubmit = useCallback(() => {
    if (autoSubmittedRef.current || previewMode) return;
    if (!activeSkill || !AUTO_SUBMIT_SKILLS.has(activeSkill)) return;
    autoSubmittedRef.current = true;
    if (submitReasonRef.current) {
      submitReasonRef.current.value = "auto_timeout";
    }
    formRef.current?.requestSubmit();
  }, [activeSkill, previewMode]);
```

- [ ] **Step 7: Thay effect đếm giờ cũ bằng bộ đếm active-time**

Thay toàn bộ effect `updateElapsed` (hiện ~dòng 1752–1769) bằng:

```ts
  // Đếm "thời gian làm thực" cho kỹ năng đang mở: mỗi giây cộng tối đa cap giây (bỏ
  // qua khoảng lặng do máy ngủ/tab nền/mất mạng). Cập nhật đồng hồ + trường ẩn nộp bài;
  // khi hết ngân sách thì tự nộp.
  useEffect(() => {
    if (previewMode || !activeSkill) {
      setRemaining(null);
      return;
    }

    autoSubmittedRef.current = false;
    consumedRef.current = activeSkillRow?.elapsedSeconds ?? 0;
    const budgetSeconds = activeSkillLimit != null ? activeSkillLimit * 60 : null;
    let lastTick = Date.now();

    function tick() {
      const now = Date.now();
      consumedRef.current = accumulateActiveSeconds(consumedRef.current, now - lastTick);
      lastTick = now;

      if (elapsedRef.current) {
        elapsedRef.current.value = String(Math.floor(consumedRef.current));
      }
      if (partTimesInputRef.current) {
        partTimesInputRef.current.value = JSON.stringify(snapshotPartTimes());
      }

      if (budgetSeconds == null) {
        setRemaining(null);
        return;
      }
      const rem = Math.max(0, budgetSeconds - consumedRef.current);
      setRemaining(rem);
      if (rem <= 0) {
        maybeAutoSubmit();
      }
    }

    tick();
    const intervalId = window.setInterval(tick, 1000);
    return () => window.clearInterval(intervalId);
  }, [
    previewMode,
    activeSkill,
    activeSkillLimit,
    activeSkillRow?.elapsedSeconds,
    snapshotPartTimes,
    maybeAutoSubmit
  ]);
```

- [ ] **Step 8: Cập nhật comment "KHÔNG tự động nộp"**

Thay 2 dòng comment (hiện ~dòng 1771–1772) bằng:

```ts
  // Đồng hồ đếm theo "thời gian làm thực": hết ngân sách thì tự nộp (Listening/Reading/
  // Writing) qua maybeAutoSubmit; đồng hồ tạm dừng khi mất mạng/đóng tab/máy ngủ.
```

- [ ] **Step 9: Cho `persistDraft` gửi kèm skill + thời gian làm thực**

Thay hàm `persistDraft` (hiện ~dòng 1684–1700) bằng:

```ts
  const persistDraft = useCallback(async () => {
    if (previewMode || !activeSkill) {
      return;
    }
    setSaveState("saving");

    try {
      const formData = new FormData();
      formData.set("attemptId", attempt.id);
      formData.set("skill", activeSkill);
      formData.set("elapsedSeconds", String(Math.floor(consumedRef.current)));
      Object.entries(answers).forEach(([questionId, value]) => {
        formData.set(`q_${questionId}`, value);
      });
      formData.set("partTimesJson", JSON.stringify(snapshotPartTimes()));

      await saveAttemptDraft(formData);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }, [answers, attempt.id, snapshotPartTimes, activeSkill, previewMode]);
```

- [ ] **Step 10: Thêm heartbeat định kỳ ~10s**

Ngay **sau** effect autosave hiện có (khối `// Autosave answers shortly after they change.`, kết thúc ~dòng 1730), thêm effect mới:

```ts
  // Heartbeat: định kỳ lưu tiến độ (đáp án + thời gian làm thực) kể cả khi học sinh
  // chỉ ngồi đọc không gõ, để mất mạng/đóng tab thì mở lại tiếp tục đúng chỗ.
  useEffect(() => {
    if (previewMode || !activeSkill) {
      return;
    }
    const intervalId = window.setInterval(() => {
      void persistDraft();
    }, 10000);
    return () => window.clearInterval(intervalId);
  }, [previewMode, activeSkill, persistDraft]);
```

- [ ] **Step 11: Cập nhật chỗ render `CountdownTimer`**

Thay (hiện ~dòng 1937–1939):

```tsx
          {activeSkillLimit ? (
            <CountdownTimer startedAtMs={skillStartedAtMs} timeLimitMinutes={activeSkillLimit} />
          ) : null}
```

bằng:

```tsx
          {activeSkillLimit != null && remaining != null ? (
            <CountdownTimer remainingSeconds={remaining} />
          ) : null}
```

- [ ] **Step 12: Typecheck + build (bắt tham chiếu chết)**

Run: `npx tsc --noEmit`
Expected: Không lỗi. Nếu báo `startedAtMs` không dùng đến (dòng ~1523) hoặc còn tham chiếu `skillStartedAtMs`/`skillStartOverrides` sót lại → xoá cho sạch rồi chạy lại.

Run: `pnpm build`
Expected: Build thành công.

- [ ] **Step 13: Verify trên trình duyệt**

Dùng skill `verify` (hoặc thủ công) với server dev:
1. `preview_start` dev server; đăng nhập học viên demo (`student@example.com`), mở một bài có đặt giờ 1 kỹ năng Listening/Reading/Writing với **giới hạn ngắn** (ví dụ đặt tạm 1 phút để thử) — hoặc tạo bài giao thử.
2. Xác nhận đồng hồ đếm ngược "Còn lại"; để chạy hết → bài **tự nộp**, chuyển sang trang kết quả (không hỏi xác nhận).
3. Kiểm tra `read_network_requests`/`read_console_messages`: không lỗi; có gọi `saveAttemptDraft` định kỳ (~10s).
4. Mở lại bài dở (đóng tab giữa chừng rồi vào lại): đáp án còn nguyên, đồng hồ tiếp tục (không chạy lại từ đầu, không nhảy do thời gian đóng tab).
5. (Nếu có bài Speaking đặt giờ) xác nhận Speaking **không** tự nộp khi hết giờ.

- [ ] **Step 14: Commit**

```bash
git add components/attempt-workspace.tsx
git commit -m "feat: tự động nộp khi hết giờ + đồng hồ tính theo thời gian làm thực"
```

---

## Self-Review

**Spec coverage:**
- Tự nộp Listening/Reading/Writing, không Speaking → Task 1 (`AUTO_SUBMIT_SKILLS`), Task 3 (guard speaking), Task 4 (`maybeAutoSubmit`). ✓
- Đồng hồ active-time, tạm dừng khi offline → Task 1 (`accumulateActiveSeconds` cap), Task 4 (tick). ✓
- Heartbeat ~10s lưu tiến độ → Task 2 (server), Task 4 Step 9–10 (client). ✓
- Mở lại giữ đáp án + tiếp tục đúng chỗ → `savedAnswers` sẵn có + Task 4 init `consumedRef` từ `activeSkillRow.elapsedSeconds`. ✓
- Không hộp thoại xác nhận khi tự nộp → `requestSubmit()` bỏ qua onClick nút. ✓
- Server chấp nhận auto_timeout chỉ khi thật sự hết giờ → Task 3. ✓
- Không thêm cột/bảng Prisma, không đụng ensure-db → không có task schema. ✓
- Bỏ ngưỡng ân hạn 5 phút → không hiện diện trong plan (đúng). ✓

**Placeholder scan:** Không có TBD/TODO/"handle edge cases"; mọi step có code cụ thể. ✓

**Type consistency:** `accumulateActiveSeconds`, `skillBudgetSeconds`, `isSkillTimeUp`, `AUTO_SUBMIT_SKILLS` dùng đồng nhất tên/chữ ký giữa Task 1 ↔ 3 ↔ 4. `CountdownTimer({ remainingSeconds })` khớp giữa Step 2 và Step 11. `saveAttemptDraft` nhận `skill`+`elapsedSeconds` khớp giữa Task 2 (đọc) và Task 4 Step 9 (gửi). ✓
