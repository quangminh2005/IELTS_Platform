# Xu Đợt 3 — Đổi quà ngoài đời Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thầy tạo quà, học viên đổi bằng Xu (trừ ngay), thầy trao hoặc từ chối (hoàn Xu).

**Architecture:** Hai bảng `Reward` + `RewardRedemption`; mọi biến động Xu đi qua sổ `CoinTransaction` (`reward_redeem` / `reward_refund`) dưới khoá dòng như Cửa hàng. Logic thuần ở `lib/rewards.ts`, mutation ở `lib/actions/rewards.ts`.

**Tech Stack:** Next.js 14 server actions, Prisma/Postgres, vitest.

**Spec:** `docs/superpowers/specs/2026-10-04-xu-dot-3-doi-qua-design.md`

## Global Constraints

- Chuỗi giao diện + comment tiếng Việt.
- Bảng mới PHẢI có trong `scripts/ensure-db.mjs` (build tự tạo trên prod).
- Cột Blob mới PHẢI có trong `scripts/blob-orphans.mjs`.
- Action HS mở đầu `requireStudent()`, action GV mở đầu `requireTeacher()`; trang GV dùng `requireTeacherPage()`.
- Không `increment/decrement` cột `coins`; số dư = `recomputeCoins` sau khi ghi sổ.
- Không `window.confirm`.

---

### Task 1: Schema + ensure-db + blob-orphans + logic thuần

**Files:** `prisma/schema.prisma`, `scripts/ensure-db.mjs`, `scripts/blob-orphans.mjs`, `lib/coins.ts` (CoinKind), Create `lib/rewards.ts`, Test `tests/rewards.test.ts`.

**Produces (`lib/rewards.ts`):**
- `ACTIVE_REDEMPTION_STATUSES = ["pending","delivered"]`
- `remainingStock(stock: number | null, activeCount: number): number | null`
- `studentLimitReached(input: { limitPerStudent: number|null; limitPeriod: string; redemptionDates: Date[]; now: Date }): boolean` (redemptionDates = phiếu pending|delivered của em với món này)
- `rewardCardState(input: { active: boolean; price: number; coins: number; remaining: number|null; limitReached: boolean }): RewardCardState`
- `redeemKey(id)`, `refundKey(id)`, `REDEMPTION_STATUS_LABELS`, `REWARD_EMOJI_SUGGESTIONS`

- [ ] Viết test → FAIL → cài đặt → PASS → `npx prisma db push` lên DB local → commit.

### Task 2: Actions

**Files:** Create `lib/actions/rewards.ts`; Test `tests/rewards-guard.test.ts`.

**Produces:** `redeemReward(formData)`, `cancelRedemption(formData)`, `saveReward(formData)`, `toggleRewardActive(formData)`, `deleteReward(formData)`, `deliverRedemption(formData)`, `rejectRedemption(formData)` — đều `Promise<ActionResult>`.

- [ ] Test cấu trúc → FAIL → cài đặt → PASS → tsc → commit.

### Task 3: Giao diện học viên

**Files:** Create `components/shop/reward-card.tsx`; Modify `app/student/shop/page.tsx` (tab `reward`, mục "Phiếu đổi quà của em").

### Task 4: Giao diện thầy + menu + chuông

**Files:** Create `app/teacher/rewards/page.tsx`, `components/reward-editor.tsx`, `components/reward-redemption-row.tsx`; Modify `components/app-shell.tsx` (mục "Đổi quà" + `navBadges`), `app/teacher/layout.tsx` (đếm pending), `lib/notifications.ts`, `lib/notifications-feed.ts`.

### Task 5: Kiểm tra

- [ ] `pnpm test`, `npx tsc --noEmit`, `pnpm lint`, `pnpm build`.
- [ ] Local: GV tạo món (có giới hạn) → HS đổi → huỷ → đổi lại → GV từ chối → kiểm sổ + số dư; GV trao → chuông HS.
- [ ] Dọn dữ liệu thử, commit, push, kiểm prod (bảng tạo qua ensure-db, trang `/teacher/rewards` + tab Quà chạy).
