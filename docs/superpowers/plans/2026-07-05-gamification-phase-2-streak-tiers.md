# Gamification Giai đoạn B — Streak tuần + Phân hạng Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm streak theo tuần (🔥) và phân hạng Đồng→Kim Cương cho học sinh, suy ra từ dữ liệu làm bài + một cấu hình "chỉ tiêu bài/tuần" của lớp.

**Architecture:** Logic thuần tách ra `lib/streak.ts`, `lib/rank-tier.ts`, `lib/student-score.ts` (có unit test). Hai component hiển thị dùng lại (`streak-badge`, `rank-tier-badge`). Streak/tier suy ra từ attempts + recipients + điểm xếp hạng hiện có; chỉ thêm một cột nullable `Class.weeklyGoal` (qua `scripts/ensure-db.mjs`).

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript strict, Prisma (PostgreSQL), Tailwind, vitest, zod.

## Global Constraints

- Text & comment **tiếng Việt**; dùng design tokens Tailwind (`bg-card`, `border-border`, `text-primary`, `text-muted-foreground`…) + hỗ trợ dark mode.
- **Không thêm dependency mới.**
- **Không đổi** công thức trong `lib/ranking.ts` (chỉ đọc/ tái dùng `calculateRankingScore`).
- Migration duy nhất: cột **nullable** `Class.weeklyGoal Int?` qua `scripts/ensure-db.mjs` (idempotent). Không thêm bảng mới.
- Tuần streak = Thứ 2–Chủ Nhật theo **giờ VN (UTC+7 cố định, không DST)**.
- `weeklyGoal` null → mặc định **3**.
- Streak đếm **mọi** attempt đã nộp (`status` ∈ {`submitted`,`reviewed`}), không phân biệt mode.
- Ngưỡng 5 bậc theo điểm xếp hạng 0–100: Đồng `<40` · Bạc `40–54` · Vàng `55–69` · Bạch Kim `70–84` · Kim Cương `≥85`.
- Path alias `@/*` → repo root. Test import tương đối `../lib/...`.
- Lệnh: 1 file test `npx vitest run tests/<f>.test.ts`; toàn bộ `pnpm test`; build `pnpm build`; lint `pnpm lint`; sinh Prisma client `npx prisma generate`.
- Bối cảnh xác minh: trang học sinh đăng nhập Google-only → không kiểm tra trực quan tự động được; cổng xác minh là `pnpm test` + `npx tsc --noEmit` + `pnpm build` (lint bỏ qua cảnh báo `<img>` có sẵn ở `app/(auth)/login/page.tsx`).

---

### Task 1: `lib/rank-tier.ts` — bậc + tiến độ lên/xuống

**Files:**
- Create: `lib/rank-tier.ts`
- Test: `tests/rank-tier.test.ts`

**Interfaces:**
- Consumes: (none)
- Produces:
  - `type Tier = { key: string; label: string; min: number; badgeClass: string; icon: string }`
  - `TIERS: Tier[]` (sắp tăng dần theo `min`)
  - `getTier(rankingScore: number): Tier`
  - `type TierProgress = { tier: Tier; next: Tier | null; pointsToNext: number | null; pointsToDrop: number | null }`
  - `getTierProgress(rankingScore: number): TierProgress`

- [ ] **Step 1: Write the failing test**

Create `tests/rank-tier.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getTier, getTierProgress, TIERS } from "../lib/rank-tier";

describe("getTier", () => {
  it("map điểm về đúng bậc theo ngưỡng", () => {
    expect(getTier(0).key).toBe("bronze");
    expect(getTier(39).key).toBe("bronze");
    expect(getTier(40).key).toBe("silver");
    expect(getTier(54).key).toBe("silver");
    expect(getTier(55).key).toBe("gold");
    expect(getTier(69).key).toBe("gold");
    expect(getTier(70).key).toBe("platinum");
    expect(getTier(84).key).toBe("platinum");
    expect(getTier(85).key).toBe("diamond");
    expect(getTier(100).key).toBe("diamond");
  });

  it("TIERS có đủ 5 bậc, sắp tăng dần", () => {
    expect(TIERS.map((t) => t.key)).toEqual([
      "bronze",
      "silver",
      "gold",
      "platinum",
      "diamond",
    ]);
    for (let i = 1; i < TIERS.length; i += 1) {
      expect(TIERS[i].min).toBeGreaterThan(TIERS[i - 1].min);
    }
  });
});

describe("getTierProgress", () => {
  it("bậc giữa: có cả điểm lên bậc kế và điểm kẻo tụt", () => {
    const p = getTierProgress(60); // gold (55..69)
    expect(p.tier.key).toBe("gold");
    expect(p.next?.key).toBe("platinum");
    expect(p.pointsToNext).toBe(10); // 70 - 60
    expect(p.pointsToDrop).toBe(5); // 60 - 55
  });

  it("Đồng: không có bậc dưới để tụt", () => {
    const p = getTierProgress(20);
    expect(p.tier.key).toBe("bronze");
    expect(p.pointsToDrop).toBeNull();
    expect(p.next?.key).toBe("silver");
    expect(p.pointsToNext).toBe(20); // 40 - 20
  });

  it("Kim Cương: không có bậc trên", () => {
    const p = getTierProgress(90);
    expect(p.tier.key).toBe("diamond");
    expect(p.next).toBeNull();
    expect(p.pointsToNext).toBeNull();
    expect(p.pointsToDrop).toBe(5); // 90 - 85
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/rank-tier.test.ts`
Expected: FAIL — không import được `../lib/rank-tier`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/rank-tier.ts`:

```ts
// Phân hạng dựa trên "điểm xếp hạng" 0–100 (lib/ranking.ts). Có thể tụt khi
// điểm giảm. 5 bậc, sắp TĂNG dần theo ngưỡng `min`.
export type Tier = {
  key: string;
  label: string;
  min: number;
  badgeClass: string; // class Tailwind cho chip (nền + chữ, hợp dark mode)
  icon: string;
};

export const TIERS: Tier[] = [
  { key: "bronze", label: "Đồng", min: 0, badgeClass: "bg-amber-700/15 text-amber-700 dark:text-amber-500", icon: "🥉" },
  { key: "silver", label: "Bạc", min: 40, badgeClass: "bg-slate-400/20 text-slate-600 dark:text-slate-300", icon: "🥈" },
  { key: "gold", label: "Vàng", min: 55, badgeClass: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400", icon: "🥇" },
  { key: "platinum", label: "Bạch Kim", min: 70, badgeClass: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-300", icon: "🏆" },
  { key: "diamond", label: "Kim Cương", min: 85, badgeClass: "bg-sky-500/15 text-sky-600 dark:text-sky-300", icon: "💎" },
];

// Bậc cao nhất có min <= score. Sàn là Đồng.
export function getTier(rankingScore: number): Tier {
  let result = TIERS[0];
  for (const tier of TIERS) {
    if (rankingScore >= tier.min) {
      result = tier;
    }
  }
  return result;
}

export type TierProgress = {
  tier: Tier;
  next: Tier | null;
  pointsToNext: number | null;
  pointsToDrop: number | null;
};

export function getTierProgress(rankingScore: number): TierProgress {
  const tier = getTier(rankingScore);
  const index = TIERS.findIndex((t) => t.key === tier.key);
  const next = index < TIERS.length - 1 ? TIERS[index + 1] : null;

  return {
    tier,
    next,
    pointsToNext: next ? Math.max(0, Math.ceil(next.min - rankingScore)) : null,
    pointsToDrop: index > 0 ? Math.max(0, Math.ceil(rankingScore - tier.min)) : null,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/rank-tier.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/rank-tier.ts tests/rank-tier.test.ts
git commit -m "feat: lib/rank-tier - phân hạng Đồng→Kim Cương"
```

---

### Task 2: `components/rank-tier-badge.tsx` — chip bậc

**Files:**
- Create: `components/rank-tier-badge.tsx`

**Interfaces:**
- Consumes: `getTier`, `Tier` from `@/lib/rank-tier`
- Produces: `RankTierBadge({ score?, tier?, className? }: { score?: number; tier?: Tier; className?: string })` — server-safe; nhận `score` (tự tính bậc) HOẶC `tier` (bậc đã có); không đủ dữ liệu → `null`.

- [ ] **Step 1: Create the component**

Create `components/rank-tier-badge.tsx`:

```tsx
import { getTier, type Tier } from "@/lib/rank-tier";

// Chip bậc dùng lại ở trang Xếp hạng (truyền `score`) và Tổng quan (truyền `tier`).
export function RankTierBadge({
  score,
  tier,
  className = "",
}: {
  score?: number;
  tier?: Tier;
  className?: string;
}) {
  const resolved = tier ?? (score !== undefined ? getTier(score) : null);

  if (!resolved) {
    return null;
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${resolved.badgeClass} ${className}`}
    >
      <span aria-hidden="true">{resolved.icon}</span>
      {resolved.label}
    </span>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm lint`
Expected: không lỗi ở `components/rank-tier-badge.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/rank-tier-badge.tsx
git commit -m "feat: component RankTierBadge chip bậc"
```

---

### Task 3: `lib/streak.ts` — streak theo tuần (giờ VN)

**Files:**
- Create: `lib/streak.ts`
- Test: `tests/streak.test.ts`

**Interfaces:**
- Consumes: (none)
- Produces:
  - `vnWeekStart(date: Date): number` — khóa số của mốc Thứ 2 00:00 giờ VN.
  - `type StreakResult = { weeks: number; weeklyGoal: number; currentWeekCount: number; atRisk: boolean }`
  - `calculateWeekStreak(input: { submittedAt: Date[]; weeklyGoal: number; now: Date }): StreakResult`

- [ ] **Step 1: Write the failing test**

Create `tests/streak.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { calculateWeekStreak, vnWeekStart } from "../lib/streak";

describe("vnWeekStart", () => {
  it("các ngày trong cùng tuần VN có cùng khóa", () => {
    // Thứ 2 06/07 và Chủ Nhật 12/07 (giờ VN) cùng một tuần
    const mon = new Date("2026-07-06T09:00:00+07:00");
    const sun = new Date("2026-07-12T23:00:00+07:00");
    expect(vnWeekStart(mon)).toBe(vnWeekStart(sun));
  });

  it("xử lý đúng biên timezone (đầu Thứ 2 giờ VN = Chủ Nhật giờ UTC)", () => {
    // 00:30 Thứ 2 06/07 giờ VN == 17:30 Chủ Nhật 05/07 giờ UTC — vẫn phải thuộc tuần bắt đầu 06/07
    const earlyMondayVN = new Date("2026-07-05T17:30:00Z");
    const wedVN = new Date("2026-07-08T10:00:00+07:00");
    expect(vnWeekStart(earlyMondayVN)).toBe(vnWeekStart(wedVN));
  });

  it("tuần khác nhau có khóa khác nhau", () => {
    const thisWeek = new Date("2026-07-08T10:00:00+07:00");
    const lastWeek = new Date("2026-07-01T10:00:00+07:00");
    expect(vnWeekStart(thisWeek)).not.toBe(vnWeekStart(lastWeek));
  });
});

describe("calculateWeekStreak", () => {
  const now = new Date("2026-07-08T10:00:00+07:00"); // Thứ 4, tuần bắt đầu 06/07

  it("tuần hiện tại đủ N + các tuần trước đủ N → đếm cả tuần hiện tại", () => {
    const r = calculateWeekStreak({
      weeklyGoal: 2,
      now,
      submittedAt: [
        new Date("2026-07-07T08:00:00+07:00"), // tuần này
        new Date("2026-07-08T08:00:00+07:00"), // tuần này
        new Date("2026-06-30T08:00:00+07:00"), // tuần trước
        new Date("2026-07-01T08:00:00+07:00"), // tuần trước
        new Date("2026-06-23T08:00:00+07:00"), // 2 tuần trước (chỉ 1 bài)
      ],
    });
    expect(r.currentWeekCount).toBe(2);
    expect(r.atRisk).toBe(false);
    expect(r.weeks).toBe(2); // tuần này + tuần trước; 2-tuần-trước chỉ 1 bài -> dừng
  });

  it("tuần hiện tại CHƯA đủ N → không tính đứt (grace), chuỗi giữ theo tuần trước", () => {
    const r = calculateWeekStreak({
      weeklyGoal: 2,
      now,
      submittedAt: [
        new Date("2026-07-07T08:00:00+07:00"), // tuần này: 1 bài (thiếu)
        new Date("2026-06-30T08:00:00+07:00"), // tuần trước: 2 bài
        new Date("2026-07-01T08:00:00+07:00"),
        new Date("2026-06-23T08:00:00+07:00"), // 2 tuần trước: 2 bài
        new Date("2026-06-24T08:00:00+07:00"),
      ],
    });
    expect(r.currentWeekCount).toBe(1);
    expect(r.atRisk).toBe(true);
    expect(r.weeks).toBe(2); // grace: bỏ qua tuần hiện tại còn dở, đếm 2 tuần trước
  });

  it("tuần đã qua thiếu N → chuỗi đứt (về 0)", () => {
    const r = calculateWeekStreak({
      weeklyGoal: 2,
      now,
      submittedAt: [
        new Date("2026-06-30T08:00:00+07:00"), // tuần trước: chỉ 1 bài
      ],
    });
    expect(r.weeks).toBe(0);
    expect(r.currentWeekCount).toBe(0);
    expect(r.atRisk).toBe(true);
  });

  it("không có bài nào → weeks 0", () => {
    const r = calculateWeekStreak({ weeklyGoal: 3, now, submittedAt: [] });
    expect(r.weeks).toBe(0);
    expect(r.currentWeekCount).toBe(0);
    expect(r.atRisk).toBe(true);
    expect(r.weeklyGoal).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/streak.test.ts`
Expected: FAIL — không import được `../lib/streak`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/streak.ts`:

```ts
const VN_OFFSET_MS = 7 * 60 * 60 * 1000; // VN = UTC+7 (không DST)
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

// Mốc đầu tuần (Thứ 2, 00:00 giờ VN) dưới dạng khóa số so sánh được.
// Cộng offset +7h rồi đọc theo UTC để có "giờ địa phương VN", lùi về Thứ 2.
export function vnWeekStart(date: Date): number {
  const shifted = new Date(date.getTime() + VN_OFFSET_MS);
  const dow = shifted.getUTCDay(); // 0=CN, 1=T2, ... 6=T7
  const daysFromMonday = (dow + 6) % 7;
  const midnight = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate()
  );
  return midnight - daysFromMonday * DAY_MS;
}

export type StreakResult = {
  weeks: number;
  weeklyGoal: number;
  currentWeekCount: number;
  atRisk: boolean;
};

// Streak = số tuần liên tiếp có >= weeklyGoal bài đã nộp, tính lùi từ tuần hiện tại.
// Tuần hiện tại chưa đủ N thì KHÔNG tính đứt (grace) — vẫn đếm chuỗi từ tuần trước.
export function calculateWeekStreak(input: {
  submittedAt: Date[];
  weeklyGoal: number;
  now: Date;
}): StreakResult {
  const goal = Math.max(1, Math.floor(input.weeklyGoal));

  const counts = new Map<number, number>();
  for (const date of input.submittedAt) {
    const key = vnWeekStart(date);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const currentWeek = vnWeekStart(input.now);
  const currentWeekCount = counts.get(currentWeek) ?? 0;
  const atRisk = currentWeekCount < goal;

  // Nếu tuần hiện tại đã đủ N thì đếm từ tuần hiện tại; nếu chưa (còn thời gian)
  // thì bắt đầu đếm từ tuần liền trước (grace).
  let cursor = currentWeekCount >= goal ? currentWeek : currentWeek - WEEK_MS;
  let weeks = 0;
  while ((counts.get(cursor) ?? 0) >= goal) {
    weeks += 1;
    cursor -= WEEK_MS;
  }

  return { weeks, weeklyGoal: goal, currentWeekCount, atRisk };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/streak.test.ts`
Expected: PASS (tất cả).

- [ ] **Step 5: Commit**

```bash
git add lib/streak.ts tests/streak.test.ts
git commit -m "feat: lib/streak - streak theo tuần (giờ VN)"
```

---

### Task 4: `components/streak-badge.tsx` — hiển thị streak

**Files:**
- Create: `components/streak-badge.tsx`

**Interfaces:**
- Consumes: (none — nhận số liệu đã tính)
- Produces: `StreakBadge({ weeks, currentWeekCount, weeklyGoal, atRisk }: { weeks: number; currentWeekCount: number; weeklyGoal: number; atRisk: boolean })` — server-safe.

- [ ] **Step 1: Create the component**

Create `components/streak-badge.tsx`:

```tsx
// Hiển thị chuỗi tuần 🔥 + tiến độ tuần hiện tại. Nhận số liệu đã tính từ lib/streak.
export function StreakBadge({
  weeks,
  currentWeekCount,
  weeklyGoal,
  atRisk,
}: {
  weeks: number;
  currentWeekCount: number;
  weeklyGoal: number;
  atRisk: boolean;
}) {
  const remaining = Math.max(0, weeklyGoal - currentWeekCount);

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-card">
      <span className="text-3xl" aria-hidden="true">
        {weeks > 0 ? "🔥" : "✨"}
      </span>
      <div className="min-w-0">
        <p className="text-base font-semibold">
          {weeks > 0 ? `Chuỗi ${weeks} tuần` : "Bắt đầu chuỗi tuần"}
        </p>
        <p
          className={`mt-0.5 text-sm ${
            atRisk && weeks > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
          }`}
        >
          {remaining > 0
            ? `Tuần này ${currentWeekCount}/${weeklyGoal} bài · làm thêm ${remaining} bài để ${
                weeks > 0 ? "giữ chuỗi" : "có chuỗi"
              }`
            : `Tuần này ${currentWeekCount}/${weeklyGoal} bài · đã đạt 🎉`}
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm lint`
Expected: không lỗi ở `components/streak-badge.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/streak-badge.tsx
git commit -m "feat: component StreakBadge hiển thị chuỗi tuần"
```

---

### Task 5: `lib/student-score.ts` + refactor trang Xếp hạng

**Files:**
- Create: `lib/student-score.ts`
- Test: `tests/student-score.test.ts`
- Modify: `app/student/ranking/page.tsx`

**Interfaces:**
- Consumes: `calculateRankingScore` from `@/lib/ranking`
- Produces:
  - `type StudentScore = { averageScorePercent: number; completionRate: number; recentActivityPercent: number; rankingScore: number }`
  - `studentRankingScore(input: { scorePercents: number[]; statuses: string[]; attemptTimes: Array<{ startedAt: Date; submittedAt: Date | null }>; now?: Date }): StudentScore`

- [ ] **Step 1: Write the failing test**

Create `tests/student-score.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { studentRankingScore } from "../lib/student-score";

describe("studentRankingScore", () => {
  const now = new Date("2026-07-08T10:00:00+07:00");

  it("gộp điểm TB + hoàn thành + hoạt động gần đây (0.7/0.2/0.1)", () => {
    const s = studentRankingScore({
      scorePercents: [80, 100], // TB = 90
      statuses: ["submitted", "reviewed", "assigned", "assigned"], // 2/4 = 50%
      attemptTimes: [{ startedAt: new Date("2026-07-07T08:00:00+07:00"), submittedAt: null }], // gần đây -> 100
      now,
    });
    expect(s.averageScorePercent).toBe(90);
    expect(s.completionRate).toBe(50);
    expect(s.recentActivityPercent).toBe(100);
    // 90*0.7 + 50*0.2 + 100*0.1 = 63 + 10 + 10 = 83
    expect(s.rankingScore).toBe(83);
  });

  it("không có dữ liệu → tất cả 0", () => {
    const s = studentRankingScore({ scorePercents: [], statuses: [], attemptTimes: [], now });
    expect(s.averageScorePercent).toBe(0);
    expect(s.completionRate).toBe(0);
    expect(s.recentActivityPercent).toBe(0);
    expect(s.rankingScore).toBe(0);
  });

  it("hoạt động quá 7 ngày → recentActivityPercent 0", () => {
    const s = studentRankingScore({
      scorePercents: [100],
      statuses: ["submitted"],
      attemptTimes: [{ startedAt: new Date("2026-06-01T08:00:00+07:00"), submittedAt: new Date("2026-06-01T09:00:00+07:00") }],
      now,
    });
    expect(s.recentActivityPercent).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/student-score.test.ts`
Expected: FAIL — không import được `../lib/student-score`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/student-score.ts`:

```ts
import { calculateRankingScore } from "@/lib/ranking";

export type StudentScore = {
  averageScorePercent: number;
  completionRate: number;
  recentActivityPercent: number;
  rankingScore: number;
};

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function completionRateOf(statuses: string[]) {
  if (statuses.length === 0) {
    return 0;
  }
  const completed = statuses.filter((status) => status === "submitted" || status === "reviewed");
  return (completed.length / statuses.length) * 100;
}

function hasRecentActivity(
  attempts: Array<{ startedAt: Date; submittedAt: Date | null }>,
  now: Date
) {
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  return attempts.some(
    (attempt) =>
      attempt.startedAt >= sevenDaysAgo ||
      (attempt.submittedAt !== null && attempt.submittedAt >= sevenDaysAgo)
  );
}

// Điểm xếp hạng của MỘT học sinh (tách từ trang Xếp hạng để trang Tổng quan dùng
// chung, tránh lặp logic). Giữ nguyên công thức lib/ranking.ts.
export function studentRankingScore(input: {
  scorePercents: number[];
  statuses: string[];
  attemptTimes: Array<{ startedAt: Date; submittedAt: Date | null }>;
  now?: Date;
}): StudentScore {
  const now = input.now ?? new Date();
  const averageScorePercent = average(input.scorePercents);
  const completionRate = completionRateOf(input.statuses);
  const recentActivityPercent = hasRecentActivity(input.attemptTimes, now) ? 100 : 0;
  const rankingScore = calculateRankingScore({
    averageScorePercent,
    completionRate,
    recentActivityPercent,
  });

  return { averageScorePercent, completionRate, recentActivityPercent, rankingScore };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/student-score.test.ts`
Expected: PASS.

- [ ] **Step 5: Refactor trang Xếp hạng dùng helper (giữ nguyên hành vi)**

Trong `app/student/ranking/page.tsx`:

1. Thêm import ở đầu: `import { studentRankingScore } from "@/lib/student-score";`
2. **Xóa** ba hàm cục bộ nay đã chuyển vào helper: `function average(...)`, `function completionRate(...)`, `function hasRecentAttempt(...)`. (Giữ nguyên `initials`, `avatarColor`.)
3. Trong `.map((classmate) => {...})`, thay khối tính điểm. Đoạn hiện tại:

```ts
      const averageScorePercent = average(scoredAttempts);
```
… và các dòng `completion`, `recentActivityPercent`, `rankingScore` bên dưới — thay bằng:

```ts
      const score = studentRankingScore({
        scorePercents: scoredAttempts,
        statuses: classmate.student.recipients.map((recipient) => recipient.status),
        attemptTimes: classmate.student.attempts.map((attempt) => ({
          startedAt: attempt.startedAt,
          submittedAt: attempt.submittedAt
        }))
      });
```

4. Trong object `return { ... }` của map, thay các trường điểm để đọc từ `score`:

```ts
        averageScorePercent: score.averageScorePercent,
        completionRate: score.completionRate,
        recentActivityPercent: score.recentActivityPercent,
        rankingScore: score.rankingScore
```

(Giữ nguyên `id`, `displayName`, `avatarUrl`, `averageBandValue` và phần tính band ở trên — không đụng.)

- [ ] **Step 6: Verify refactor không đổi hành vi**

Run: `npx vitest run tests/student-score.test.ts && npx tsc --noEmit`
Expected: test PASS, tsc sạch. (Trang Xếp hạng hiển thị y như trước — chỉ đổi nguồn tính.)

- [ ] **Step 7: Commit**

```bash
git add lib/student-score.ts tests/student-score.test.ts app/student/ranking/page.tsx
git commit -m "refactor: tách lib/student-score dùng chung Xếp hạng + Tổng quan"
```

---

### Task 6: Chip bậc trên trang Xếp hạng

**Files:**
- Modify: `app/student/ranking/page.tsx`

**Interfaces:**
- Consumes: `RankTierBadge` from `@/components/rank-tier-badge` (nhận `score`)

- [ ] **Step 1: Thêm import**

Trong `app/student/ranking/page.tsx`, thêm:

```tsx
import { RankTierBadge } from "@/components/rank-tier-badge";
```

- [ ] **Step 2: Chip bậc trong bảng danh sách (hạng 4+)**

Trong khối `<article>` của mỗi dòng `rest`, ngay sau đoạn `<p className="truncate font-semibold">` chứa tên + badge "Bạn" (đóng `</p>`), thêm chip bậc:

```tsx
                    <div className="mt-1">
                      <RankTierBadge score={rankedStudent.rankingScore} />
                    </div>
```

- [ ] **Step 3: Chip bậc trên podium (Top 3)**

Trong khối podium (`podiumOrder.map(...)`), ngay sau đoạn `<p className="text-xs font-semibold tabular-nums text-primary">{rankedStudent.rankingScore} điểm</p>`, thêm:

```tsx
                <div className="mt-1">
                  <RankTierBadge score={rankedStudent.rankingScore} />
                </div>
```

- [ ] **Step 4: Verify**

Run: `pnpm lint && npx tsc --noEmit`
Expected: không lỗi. (Mỗi học viên hiện chip bậc theo điểm xếp hạng.)

- [ ] **Step 5: Commit**

```bash
git add app/student/ranking/page.tsx
git commit -m "feat: chip bậc trên trang Xếp hạng (bảng + podium)"
```

---

### Task 7: Schema `Class.weeklyGoal` + ensure-db

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `scripts/ensure-db.mjs`

**Interfaces:**
- Produces: cột `Class.weeklyGoal: Int?` (Prisma client type) cho các task sau.

- [ ] **Step 1: Thêm cột vào schema**

Trong `prisma/schema.prisma`, model `Class` (bắt đầu `model Class {`), thêm dòng cột (đặt sau `description String?`):

```prisma
  weeklyGoal  Int?
```

- [ ] **Step 2: Thêm câu ALTER vào ensure-db**

Trong `scripts/ensure-db.mjs`, mảng `statements`, thêm phần tử:

```js
  'ALTER TABLE "Class" ADD COLUMN IF NOT EXISTS "weeklyGoal" INTEGER;',
```

- [ ] **Step 3: Sinh lại Prisma client**

Run: `npx prisma generate`
Expected: "Generated Prisma Client" thành công — type `Class` giờ có `weeklyGoal`.

- [ ] **Step 4: Verify type-check**

Run: `npx tsc --noEmit`
Expected: sạch (chưa nơi nào dùng, nhưng client mới không gây lỗi).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma scripts/ensure-db.mjs
git commit -m "feat: cột Class.weeklyGoal (chỉ tiêu bài/tuần) + ensure-db"
```

---

### Task 8: Cấu hình chỉ tiêu tuần (giáo viên)

**Files:**
- Modify: `lib/actions/classes.ts`
- Modify: `app/teacher/classes/page.tsx`

**Interfaces:**
- Consumes: `Class.weeklyGoal` (Task 7)
- Produces: server action `updateClassWeeklyGoal(formData: FormData)`

- [ ] **Step 1: Thêm server action**

Trong `lib/actions/classes.ts`, sau `createClass` (hoặc bất kỳ vị trí cùng cấp), thêm:

```ts
const weeklyGoalSchema = z.object({
  classId: z.string().min(1),
  weeklyGoal: z.coerce.number().int().min(1).max(50)
});

export async function updateClassWeeklyGoal(formData: FormData) {
  const teacher = await requireTeacher();
  const parsed = weeklyGoalSchema.safeParse({
    classId: formData.get("classId"),
    weeklyGoal: formData.get("weeklyGoal")
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Chỉ tiêu tuần không hợp lệ.");
  }

  await prisma.class.updateMany({
    where: { id: parsed.data.classId, teacherId: teacher.id },
    data: { weeklyGoal: parsed.data.weeklyGoal }
  });

  revalidatePath("/teacher/classes");
}
```

- [ ] **Step 2: Đổi thẻ lớp để chứa form (Link không bọc được form)**

Trong `app/teacher/classes/page.tsx`:

1. Thêm import action + đổi dòng import hiện có:

```tsx
import { createClass, updateClassWeeklyGoal, requireTeacher } from "@/lib/actions/classes";
```

2. Thay toàn bộ khối `classes.map((classItem) => ( <Link ...> ... </Link> ))` bằng phiên bản dùng `<div>` bọc ngoài (giữ Link chỉ cho phần điều hướng, thêm form chỉ tiêu tuần bên dưới):

```tsx
            classes.map((classItem) => (
              <div
                key={classItem.id}
                className="overflow-hidden rounded-xl border border-border bg-card shadow-card"
              >
                <Link
                  href={`/teacher/classes/${classItem.id}`}
                  className="block px-5 py-4 transition hover:bg-muted/40"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-semibold">{classItem.name}</h3>
                      {classItem.description ? (
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {classItem.description}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="inline-flex w-fit rounded-full border border-border bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
                        {classItem._count.students} học viên
                      </span>
                      <span className="text-sm font-semibold text-primary">Mở →</span>
                    </div>
                  </div>
                </Link>
                <form
                  action={updateClassWeeklyGoal}
                  className="flex items-center gap-2 border-t border-border px-5 py-3"
                >
                  <input type="hidden" name="classId" value={classItem.id} />
                  <label className="text-sm text-muted-foreground" htmlFor={`goal-${classItem.id}`}>
                    Chỉ tiêu bài/tuần
                  </label>
                  <input
                    id={`goal-${classItem.id}`}
                    name="weeklyGoal"
                    type="number"
                    min={1}
                    max={50}
                    defaultValue={classItem.weeklyGoal ?? 3}
                    className="w-20 rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none ring-primary/40 focus:border-primary focus:ring-2"
                  />
                  <button className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-semibold text-primary transition hover:border-primary">
                    Lưu
                  </button>
                </form>
              </div>
            ))
```

(Truy vấn `classes` đã trả mọi scalar của `Class` nên `classItem.weeklyGoal` có sẵn — không cần đổi `classInclude`.)

- [ ] **Step 3: Verify**

Run: `pnpm lint && npx tsc --noEmit`
Expected: không lỗi.

- [ ] **Step 4: Commit**

```bash
git add lib/actions/classes.ts app/teacher/classes/page.tsx
git commit -m "feat: giáo viên đặt chỉ tiêu bài/tuần cho lớp"
```

---

### Task 9: Tổng quan — streak + phân hạng

**Files:**
- Modify: `app/student/page.tsx`

**Interfaces:**
- Consumes: `calculateWeekStreak` (`@/lib/streak`), `studentRankingScore` (`@/lib/student-score`), `getTierProgress` (`@/lib/rank-tier`), `StreakBadge` (`@/components/streak-badge`), `RankTierBadge` (`@/components/rank-tier-badge`).

- [ ] **Step 1: Thêm import**

Trong `app/student/page.tsx`, thêm:

```tsx
import { calculateWeekStreak } from "@/lib/streak";
import { studentRankingScore } from "@/lib/student-score";
import { getTierProgress } from "@/lib/rank-tier";
import { StreakBadge } from "@/components/streak-badge";
import { RankTierBadge } from "@/components/rank-tier-badge";
```

- [ ] **Step 2: Truy vấn attempts + chỉ tiêu tuần của lớp**

Sau khi đã có `student` và `recipients` (trước `return`), thêm hai truy vấn + tính toán:

```ts
  const attempts = await prisma.attempt.findMany({
    where: { studentId: student.id },
    select: { scorePercent: true, startedAt: true, submittedAt: true, status: true }
  });

  const membership = await prisma.classStudent.findFirst({
    where: { studentId: student.id },
    orderBy: { joinedAt: "desc" },
    include: { class: { select: { weeklyGoal: true } } }
  });

  const weeklyGoal = membership?.class.weeklyGoal ?? 3;

  const now = new Date();

  const submittedDates = attempts
    .filter(
      (attempt) =>
        (attempt.status === "submitted" || attempt.status === "reviewed") &&
        attempt.submittedAt !== null
    )
    .map((attempt) => attempt.submittedAt as Date);

  const streak = calculateWeekStreak({ submittedAt: submittedDates, weeklyGoal, now });

  const score = studentRankingScore({
    scorePercents: attempts
      .map((attempt) => attempt.scorePercent)
      .filter((value): value is number => value !== null),
    statuses: recipients.map((recipient) => recipient.status),
    attemptTimes: attempts.map((attempt) => ({
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt
    })),
    now
  });

  const tierProgress = getTierProgress(score.rankingScore);
```

- [ ] **Step 3: Render streak + tier ngay dưới lời chào**

Trong JSX, ngay sau `</header>` và **trước** `<ProgressRing ... />` (đã có từ Giai đoạn 1), thêm:

```tsx
      <div className="grid gap-3 sm:grid-cols-2">
        <StreakBadge
          weeks={streak.weeks}
          currentWeekCount={streak.currentWeekCount}
          weeklyGoal={streak.weeklyGoal}
          atRisk={streak.atRisk}
        />
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-card">
          <span className="text-3xl" aria-hidden="true">
            {tierProgress.tier.icon}
          </span>
          <div className="min-w-0">
            <p className="text-base font-semibold">Hạng {tierProgress.tier.label}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {tierProgress.next
                ? `Còn ${tierProgress.pointsToNext} điểm nữa lên ${tierProgress.next.label}`
                : "Bạn đang ở đỉnh cao nhất! 💎"}
            </p>
          </div>
        </div>
      </div>
```

(`RankTierBadge` đã import cho nhất quán; ở đây dùng trực tiếp `tierProgress.tier.icon`/`.label` cho thẻ lớn. Nếu muốn chip nhỏ có thể thêm `<RankTierBadge tier={tierProgress.tier} />` — không bắt buộc.)

- [ ] **Step 4: Verify**

Run: `pnpm lint && npx tsc --noEmit`
Expected: không lỗi.

- [ ] **Step 5: Commit**

```bash
git add app/student/page.tsx
git commit -m "feat: streak + phân hạng trên trang Tổng quan"
```

---

### Task 10: Kiểm thử tổng thể

**Files:** (không tạo file)

- [ ] **Step 1: Toàn bộ test**

Run: `pnpm test`
Expected: PASS toàn bộ (gồm `rank-tier`, `streak`, `student-score`; các test cũ vẫn xanh — cột `weeklyGoal` chỉ thêm).

- [ ] **Step 2: Build production**

Run: `pnpm build`
Expected: thành công (build chạy `prisma generate && ensure-db && next build`).

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: chỉ còn cảnh báo `<img>` có sẵn ở `app/(auth)/login/page.tsx`.

- [ ] **Step 4: Commit (nếu có chỉnh nhỏ)**

```bash
git add -A
git commit -m "chore: hoàn tất gamification giai đoạn B (streak + phân hạng)"
```

---

## Self-Review

**Spec coverage:**
- Streak tuần (đơn vị tuần VN, chỉ tiêu N, đếm mọi bài đã nộp, grace tuần hiện tại, atRisk) → Task 3, 4, 9 ✓
- Chỉ tiêu N của lớp + cấu hình giáo viên + default 3 → Task 7 (cột), Task 8 (UI/action), Task 9 (đọc, default 3) ✓
- Phân hạng theo điểm xếp hạng, 5 bậc, ngưỡng đã duyệt → Task 1 ✓
- Chip bậc trang Xếp hạng (bảng + podium) → Task 6 ✓
- Bậc + tiến tới bậc kế trên Tổng quan → Task 9 ✓
- Helper điểm dùng chung (tránh lặp) + refactor Xếp hạng không đổi hành vi → Task 5 ✓
- Migration 1 cột nullable qua ensure-db → Task 7 ✓
- Unit test cho 3 module logic → Task 1, 3, 5 ✓

**Placeholder scan:** không có TBD/TODO; mọi step có code hoặc lệnh cụ thể + kết quả mong đợi.

**Type consistency:** `Tier`/`getTier`/`getTierProgress`/`TierProgress`, `StreakResult`/`calculateWeekStreak`/`vnWeekStart`, `StudentScore`/`studentRankingScore`, props `StreakBadge`/`RankTierBadge` dùng nhất quán tên & chữ ký giữa các task (khai báo ở Task 1/3/5, tiêu thụ ở Task 6/9). `RankTierBadge` nhận `score` (Xếp hạng) hoặc `tier` (Tổng quan) — cả hai đường đều khớp chữ ký ở Task 2.
