# Xu Đợt 2 — Khôi phục chuỗi tuần Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Học viên lỡ tuần liền trước được bỏ Xu (100/200/400… trong tháng) để giữ chuỗi tuần 🔥.

**Architecture:** Tuần đã cứu = dòng `CoinTransaction` kind `streak_restore`, key `restore:<Thứ 2 YYYY-MM-DD>` — không đổi schema. Logic thuần ở `lib/streak.ts`; `lib/streak-data.ts` đọc DB cho trang chủ, Hồ sơ và action; `lib/actions/streak.ts` trừ Xu dưới khoá dòng như `buyItem`.

**Tech Stack:** Next.js 14 server actions, Prisma/Postgres, vitest.

**Spec:** `docs/superpowers/specs/2026-10-03-xu-dot-2-khoi-phuc-chuoi-design.md`

## Global Constraints

- Chuỗi/comment/UI bằng tiếng Việt.
- Không đổi schema (chỉ comment `enum CoinKind`). Không `increment`/`decrement` cột `coins`.
- Action mở đầu bằng `requireStudent()`; client không gửi tuần cần cứu.
- Giá lần thứ k trong tháng VN = `100 × 2^(k−1)`.
- Không `window.confirm` (xác nhận 2 bước trên nút).

---

### Task 1: Logic thuần trong `lib/streak.ts`

**Files:** Modify `lib/streak.ts`, `lib/coins.ts` (type `CoinKind`), `prisma/schema.prisma` (comment). Test `tests/streak.test.ts`.

**Produces:**
- `weekKeyToDateKey(weekKey: number): string`
- `calculateWeekStreak({ submittedAt, weeklyGoal, now, restoredWeeks?: string[] }): StreakResult`
- `type StreakRestoreOffer = { weekKey: string; lostWeeks: number }`
- `streakRestoreOffer({ submittedAt, weeklyGoal, now, restoredWeeks }): StreakRestoreOffer | null`
- `streakRestorePrice(usedThisMonth: number): number`
- `restoreKey(dateKey: string): string`, `restoredWeekOf(key: string): string | null`
- `formatWeekRange(dateKey: string): string` → `"22/9–28/9"`

- [ ] Step 1: viết test (now = Thứ 4 08/07/2026, goal 2):
  - tuần trước có trong `restoredWeeks` (`"2026-06-29"`) được tính đạt → chuỗi nối tiếp;
  - offer: T−1 thiếu, T−2 + T−3 đạt → `{ weekKey: "2026-06-29", lostWeeks: 2 }`;
  - offer null khi T−1 đạt, khi T−2 không đạt, khi T−1 đã cứu;
  - T−2 là tuần đã cứu vẫn cho offer (cứu liên tiếp);
  - `streakRestorePrice(0/1/2)` = 100/200/400;
  - `formatWeekRange("2026-09-22")` = `"22/9–28/9"`, qua tháng `"2026-09-29"` = `"29/9–5/10"`;
  - `restoredWeekOf("restore:2026-09-22")` = `"2026-09-22"`, `restoredWeekOf("buy:x")` = null.
- [ ] Step 2: `npx vitest run tests/streak.test.ts` → FAIL.
- [ ] Step 3: cài đặt (xem code thật trong commit).
- [ ] Step 4: test PASS; thêm `streak_restore` vào `CoinKind` + comment schema.
- [ ] Step 5: commit `feat(xu): logic khoi phuc chuoi tuan`.

### Task 2: `lib/streak-data.ts` + action `restoreStreak`

**Files:** Create `lib/streak-data.ts`, `lib/actions/streak.ts`. Test `tests/wallet-guard.test.ts`.

**Produces:**
- `getWeekStreak(studentId: string, now?: Date, db?: Prisma.TransactionClient): Promise<WeekStreakData>` với `WeekStreakData = { streak: StreakResult; offer: StreakRestoreOffer | null; price: number; coins: number }`.
- `restoreStreak(): Promise<ActionResult>`.

- [ ] Step 1: test cấu trúc: action mở đầu `try { const student = await requireStudent();`, có `lockStudent(tx, student.id)`, `recomputeCoins(tx, student.id)`, `getWeekStreak(student.id, now, tx)`, không đọc `formData`; schema có `streak_restore`.
- [ ] Step 2: FAIL. Step 3: cài đặt. Step 4: PASS. Step 5: commit.

### Task 3: Giao diện + nối trang

**Files:** Create `components/streak-restore-button.tsx`; modify `components/streak-badge.tsx`, `app/student/page.tsx`, `app/student/profile/page.tsx`.

- [ ] Trang chủ + Hồ sơ gọi `getWeekStreak` (bỏ truy vấn `weeklyGoal` riêng); thẻ 🔥 nhận `restore`.
- [ ] `pnpm test`, `npx tsc --noEmit`, `pnpm lint`, `pnpm build` xanh.
- [ ] Kiểm local bằng học viên giả lỡ tuần (seed dữ liệu qua script tmp), bấm cứu, xem số dư + chuỗi.
- [ ] Commit, push, kiểm prod bằng Chrome.
