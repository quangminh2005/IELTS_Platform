# Xu Đợt 4 — Chuỗi ngày + Linh vật Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đổi chuỗi tuần thành chuỗi ngày (một chuỗi cho cả trường, có khôi phục), rồi thêm 4 linh vật SVG × 6 tư thế mua/mở bằng Xu hoặc chuỗi ngày.

**Architecture:** Chuỗi ngày suy ra từ dữ liệu sẵn có (AttemptSkill/Attempt/VocabQuizDay + dòng sổ `restore-day:`), logic thuần `lib/day-streak.ts`, một nguồn `getDayStreak`. Linh vật: danh mục thuần `lib/mascots.ts`, sở hữu = `StudentItem`, trang bị = cột `StudentProfile.equippedMascot`, hình = SVG ghép bộ phận `components/shop/mascot-art.tsx`.

**Tech Stack:** Next.js 14 server actions, Prisma/Postgres, Tailwind keyframes, vitest.

**Spec:** `docs/superpowers/specs/2026-10-04-xu-dot-4-chuoi-ngay-linh-vat-design.md`

## Global Constraints

- Chuỗi giao diện + comment tiếng Việt.
- Cột mới PHẢI có trong `scripts/ensure-db.mjs` (`equippedMascot`).
- Action HS mở đầu `requireStudent()`; mua/mở trong `$transaction` + `lockStudent` + `recomputeCoins`; không `increment/decrement` `coins`.
- Không `window.confirm`; nút 2 bước.
- SVG không dùng `defs`/`id`; hoạt ảnh chỉ trong `motion-safe:`.
- Ngày theo giờ VN: `vietnamDateKey` (`lib/vocab-day.ts`), `shiftDateKey` (`lib/vocab-streak.ts`).

---

### Task 1: Logic thuần chuỗi ngày

**Files:** Create `lib/day-streak.ts`, `tests/day-streak.test.ts`.

**Produces:**
- `calculateDayStreak({ activeDays: string[]; restoredDays: string[]; today: string }): { days: number; activeToday: boolean }`
- `dayStreakRestoreOffer({ activeDays; restoredDays; today }): { dayKey: string; lostDays: number } | null`
- `streakRestorePrice(used: number): number` (chuyển từ `lib/streak.ts`)
- `dayRestoreKey(dateKey) → "restore-day:"+dateKey`, `restoredDayOf(key): string | null`, `formatDayShort("2026-10-03") → "3/10"`

- [ ] Test: grace hôm nay; ngày cứu nối chuỗi; offer chỉ khi hôm qua lỡ + hôm kia có học; hôm qua đã cứu → null; lỡ 2 ngày → null; giá 100/200/400; khoá `restore:` tuần cũ không bị `restoredDayOf` đọc.
- [ ] FAIL → cài đặt → PASS → commit.

### Task 2: Nguồn dữ liệu + thay chuỗi tuần ở mọi nơi

**Files:** Create `lib/day-streak-data.ts`; Modify `lib/activity-heatmap.ts` (tách `activeDayKeys(days)`, `summarizeActivity` nhận `restoredDays?`), `lib/activity-heatmap-data.ts` (đọc dòng restore), `lib/actions/streak.ts`, `components/streak-badge.tsx`, `app/student/page.tsx`, `app/student/profile/page.tsx`, `app/student/vocab/page.tsx`, `lib/vocab-daily.ts` (bỏ `streakDays`), `components/vocab-card.tsx`, `components/teacher-class-card.tsx` (bỏ form chỉ tiêu), `lib/streak.ts` (bỏ phần tuần), delete `lib/streak-data.ts`; Tests `tests/streak.test.ts` (bỏ phần tuần), `tests/wallet-guard.test.ts`.

**Produces:** `getDayStreak(studentId, now?, db?) → { streak: { days; activeToday }; offer: { dayKey; lostDays } | null; price: number; coins: number }`.

- [ ] Sửa test guard (restoreStreak dùng `getDayStreak(student.id, now, tx)`, các trang gọi `getDayStreak(`) → FAIL → cài đặt → PASS → tsc → commit.

### Task 3: Danh mục linh vật + schema + actions

**Files:** Create `lib/mascots.ts`, `lib/actions/mascot.ts`, `tests/mascots.test.ts`; Modify `prisma/schema.prisma` (`equippedMascot`, comment ItemSource `streak`), `scripts/ensure-db.mjs`, `tests/wallet-guard.test.ts`.

**Produces (`lib/mascots.ts`):** `MascotId = "owl"|"cat"|"fox"|"dragon"`, `PoseId = "idle"|"wave"|"read"|"cheer"|"sleep"|"signature"`, `MASCOTS`, `MASCOT_POSES`, `mascotKey(id)`, `poseKey(id, pose)`, `resolvePose(key) → { mascot; pose; key; name } | null`, `ownsPose(owned: Set<string>, key): boolean`.
**Produces (actions):** `buyMascot(formData)`, `unlockPose(formData)` (`poseKey`, `via`), `equipMascot(formData)` (`poseKey` hoặc rỗng) — `Promise<ActionResult>`.

- [ ] Test → FAIL → cài đặt → `npx prisma db push` (DB local) → PASS → tsc → commit.

### Task 4: Hình vẽ linh vật

**Files:** Create `components/shop/mascot-art.tsx`; Modify `tailwind.config.ts` (keyframes `mascot-*`); Test bổ sung `tests/mascots.test.ts` (art có đủ mã con + tư thế).

**Produces:** `<MascotArt mascot={MascotId} pose={PoseId} className? still? />`, `<EquippedMascot poseKey={string|null} className? />` (null/mã lạ → không vẽ).

- [ ] Vẽ 4 con (bộ phận rời) + 6 tư thế; xem thật trên trang tạm dev, chỉnh tới khi đẹp → commit.

### Task 5: Giao diện

**Files:** Create `components/shop/mascot-section.tsx`; Modify `app/student/shop/page.tsx` (tab `mascot`), `components/profile-hero.tsx` (`mascotKey`), `app/student/profile/page.tsx`, `app/student/profile/[studentId]/page.tsx`, `components/streak-badge.tsx` (`mascotKey`), `app/student/page.tsx`, `components/student-wallet-summary.tsx` (+ trang GV học viên).

- [ ] tsc + lint → commit.

### Task 6: Kiểm tra + ship

- [ ] `pnpm test`, `npx tsc --noEmit`, `pnpm lint`, `pnpm build`.
- [ ] Local vai HS (JWT tự ký): thẻ 🔥 ngày, khôi phục; Cửa hàng tab Linh vật: mua con → mở tư thế bằng Xu → mở bằng chuỗi (đủ/không đủ) → trang bị → hồ sơ + trang chủ; khổ điện thoại.
- [ ] Dọn dữ liệu thử + route tạm, commit, push, kiểm prod (cột tạo qua ensure-db, trang chủ/hồ sơ/cửa hàng chạy).
