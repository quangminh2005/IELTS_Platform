# Mạng xã hội Đợt 1 — Bảng xếp hạng kiểu chin + hồ sơ mở toàn trường — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trang `/student/ranking` có 3 bảng (Học Bá XP tháng · Chuỗi 🔥 · Điểm lớp) với phạm vi Lớp/Toàn trường, hồ sơ học viên mở cho cả trường kiểu chin, khối Top 5 ở trang chủ, thưởng Xu Top 10 Học Bá mỗi tháng, tab Chuỗi phía giáo viên.

**Architecture:** Không đổi schema. Học Bá đọc `getMonthlyRecap` (công thức Tổng kết tháng), thêm cache 5 phút cho tháng hiện tại gắn tag `leaderboard`. Bảng Chuỗi tính gộp cả trường bằng các hàm thuần đang có (`buildActivityDays` → `calculateDayStreak`), cũng cache 5 phút cùng tag. `submitSkill` xoá tag. Logic thuần nằm ở `lib/leaderboard.ts`, DB ở `lib/leaderboard-data.ts`, giao diện ở `components/leaderboard/`. Thưởng Xu là dòng sổ kind `monthly_prize`, cron hằng ngày cộng, `syncWallet` dự phòng.

**Tech Stack:** Next.js 14 App Router (server components, `unstable_cache`, `revalidateTag`), Prisma + Postgres (Neon), Tailwind, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-05-xa-hoi-dot-1-bang-xep-hang-ho-so-design.md`

## Global Constraints

- Chữ hiển thị và comment code bằng **tiếng Việt có dấu**. Tên tham số URL bằng tiếng Anh (`board`, `scope`, `classId`, `month`).
- **Không đổi schema Prisma.** Chỉ sửa comment `enum CoinKind` (thêm `monthly_prize`). Không sửa `scripts/ensure-db.mjs`.
- Hồ sơ người khác **không bao giờ** hiện: band / điểm từng bài, band trung bình, mục tiêu band, bài làm (`Answer`), số dư ví.
- Thưởng: #1 300 · #2 200 · #3 150 · #4–10 mỗi em 50 Xu; bắt đầu `PRIZE_START_MONTH = "2026-10"`; đồng hạng thì nhận cùng mức thưởng; `XP_EARN_KINDS` giữ nguyên (Xu thưởng không cộng vào XP hạng đấu).
- Cấp lửa: Nhen 1 · Bén 3 · Cháy 7 · Đuốc 14 · Lửa Trại 30 · Hải Đăng 60 · Bất Diệt 100 (ngày).
- Cache: Học Bá tháng hiện tại và bảng Chuỗi đều `revalidate: 300` + tag `leaderboard`. Khoá cache của Chuỗi là **chuỗi ngày** `YYYY-MM-DD`, không bao giờ là `Date`.
- Kết quả trả về từ `unstable_cache` phải là JSON thuần: không có `Map`, `Set` hay `Date`.
- Học sinh dùng điện thoại cũ → không dùng API trình duyệt mới; giao diện phải dùng được ở khổ 375px.
- Lặp qua `Map`/`Set` theo đúng thói quen của repo: dùng `Array.from(...)` hoặc `.forEach`.
- Commit message không dấu, dạng `feat(xa-hoi): ...`, kết thúc bằng dòng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Trước mỗi commit chạy `git diff --cached --stat`. **Không** giấu stderr của `git add` (bài học từ commit ead3565d).

## File Structure

**Tạo mới:**
- `lib/leaderboard.ts` — logic thuần: cấp lửa, xếp hạng/lọc lớp, dựng dòng bảng, cửa sổ top N, đếm ngược, tham số URL, chuỗi cả trường, thưởng tháng, kiểu dữ liệu cho khối trang chủ.
- `lib/leaderboard-data.ts` — đọc DB + cache: `getStreakBoard`, `classMemberIds`, `loadBoardPeople`, `getHomeLeaderboard`.
- `lib/profile-activity.ts` — logic thuần cho lịch chăm học trên hồ sơ: tóm tắt tháng, ngày cày trâu nhất, kẹp tháng.
- `components/leaderboard/streak-tier-chip.tsx`, `leaderboard-board.tsx`, `xp-board-header.tsx`, `streak-board-header.tsx`, `ranking-switcher.tsx`, `home-leaderboard-card.tsx`.
- `components/profile-month-activity.tsx` — lịch tháng + 4 ô số trên hồ sơ.
- Test: `tests/leaderboard.test.ts`, `tests/leaderboard-streak.test.ts`, `tests/leaderboard-guard.test.ts`, `tests/leaderboard-prize.test.ts`, `tests/profile-activity.test.ts`.

**Sửa:**
- `lib/day-streak-data.ts` — thêm `loadSchoolStreakInput`.
- `lib/monthly-recap-data.ts` — cache tháng hiện tại.
- `lib/actions/attempts.ts` — `revalidateTag` sau khi nộp.
- `lib/coins.ts`, `prisma/schema.prisma` (chỉ comment), `lib/wallet.ts`, `scripts/coins-backfill.ts`, `app/api/cron/reminders/route.ts` — thưởng Xu.
- `lib/notifications.ts`, `lib/notifications-feed.ts`, `components/notification-list.tsx` — chuông thưởng.
- `lib/attendance.ts` — thêm `buildAttendanceMonthFromKeys`.
- `app/student/ranking/page.tsx` (viết lại), `app/student/page.tsx`, `app/student/profile/[studentId]/page.tsx` (viết lại), `app/student/profile/page.tsx`, `app/teacher/ranking/page.tsx`.
- `components/monthly-recap-board.tsx`, `components/monthly-recap-panel.tsx`, `components/profile-side-cards.tsx` (comment).
- `tests/profile-visibility.test.ts` (viết lại), `tests/notifications.test.ts`, `tests/attendance.test.ts`.

---

### Task 1: Logic thuần của bảng xếp hạng

**Files:**
- Create: `lib/leaderboard.ts`
- Test: `tests/leaderboard.test.ts`

**Interfaces:**
- Consumes: `monthKeyOf`, `monthRange`, `recentMonthKeys`, `resolveMonthKey`, `shiftMonthKey` từ `lib/monthly-recap.ts`.
- Produces (các task sau dùng đúng tên này):
  - `LEADERBOARD_CACHE_TAG = "leaderboard"`, `RANKING_MONTH_OPTIONS = 6`, `formatCount(n): string`
  - `type StreakTier = { key; name; minDays; chipClass }`, `STREAK_TIERS`, `streakTier(days): StreakTier | null`, `streakTierProgress(days): { current; next; daysToNext: number | null }`
  - `type BoardPerson = { studentId; displayName; avatarUrl: string|null; avatarPreset: string|null; userImage: string|null; equippedFrame?: string|null }`
  - `type XpBoardSource = BoardPerson & { xp: number; activeDays: number }`
  - `type StreakBoardSource = BoardPerson & { days: number; activeToday: boolean }`
  - `type LeaderboardChip = { kind: "rank"; xp: number } | { kind: "fire"; days: number }`
  - `type LeaderboardEntry = BoardPerson & { rank: number; valueText: string; subText: string | null; chip: LeaderboardChip }`
  - `rankBoard(rows, value)`, `scopeBoard(rows, memberIds | null, value)`
  - `xpBoardEntries(rows, memberIds | null, lifetimeXp: ReadonlyMap<string, number>): LeaderboardEntry[]`
  - `streakBoardEntries(rows, memberIds | null): LeaderboardEntry[]`
  - `boardWindow(entries, myId, topN): { top: LeaderboardEntry[]; me: LeaderboardEntry | null }`
  - `monthEndsIn(now): { days; hours; minutes }`, `formatCountdown(left): string`
  - `type RankingBoard = "xp" | "streak" | "class"`, `type RankingScope = "school" | "class"`, `type RankingParams = { board; scope; classId: string | null; monthKey: string }`
  - `resolveRankingParams(raw, { classIds, latestMonth }): RankingParams`
  - `type RankingLinkContext = { latestMonth: string; defaultClassId: string | null }`, `rankingHref(params, context): string`
  - `rankingMonthNav(monthKey, latestMonth): { prev: string | null; next: string | null }`

- [ ] **Step 1: Viết test (sẽ đỏ)**

Tạo `tests/leaderboard.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  STREAK_TIERS,
  boardWindow,
  formatCountdown,
  monthEndsIn,
  rankBoard,
  rankingHref,
  rankingMonthNav,
  resolveRankingParams,
  scopeBoard,
  streakBoardEntries,
  streakTier,
  streakTierProgress,
  xpBoardEntries,
  type StreakBoardSource,
  type XpBoardSource
} from "@/lib/leaderboard";

const person = (studentId: string, displayName = studentId) => ({
  studentId,
  displayName,
  avatarUrl: null,
  avatarPreset: null,
  userImage: null,
  equippedFrame: null
});

describe("cấp lửa của bảng Chuỗi", () => {
  it("7 cấp, ngưỡng đúng như chin", () => {
    expect(STREAK_TIERS.map((tier) => tier.minDays)).toEqual([1, 3, 7, 14, 30, 60, 100]);
    expect(STREAK_TIERS.map((tier) => tier.name)).toEqual([
      "Nhen",
      "Bén",
      "Cháy",
      "Đuốc",
      "Lửa Trại",
      "Hải Đăng",
      "Bất Diệt"
    ]);
  });

  it.each([
    [0, null],
    [1, "Nhen"],
    [2, "Nhen"],
    [3, "Bén"],
    [99, "Hải Đăng"],
    [100, "Bất Diệt"],
    [500, "Bất Diệt"]
  ])("%i ngày → %s", (days, name) => {
    expect(streakTier(days)?.name ?? null).toBe(name);
  });

  it("tiến trình lên cấp kế", () => {
    expect(streakTierProgress(0)).toMatchObject({ current: null, daysToNext: 1 });
    expect(streakTierProgress(0).next?.name).toBe("Nhen");
    expect(streakTierProgress(10).current?.name).toBe("Cháy");
    expect(streakTierProgress(10).next?.name).toBe("Đuốc");
    expect(streakTierProgress(10).daysToNext).toBe(4);
    expect(streakTierProgress(100)).toMatchObject({ next: null, daysToNext: null });
  });
});

describe("rankBoard / scopeBoard", () => {
  const rows = [
    { ...person("a", "An"), v: 50 },
    { ...person("b", "Bình"), v: 80 },
    { ...person("c", "Chi"), v: 50 },
    { ...person("d", "Dũng"), v: 0 },
    { ...person("e", "Én"), v: 20 }
  ];

  it("giảm dần, đồng giá trị đồng hạng, hạng sau nhảy cóc, bỏ giá trị 0", () => {
    const ranked = rankBoard(rows, (row) => row.v);
    expect(ranked.map((row) => [row.studentId, row.rank])).toEqual([
      ["b", 1],
      ["a", 2],
      ["c", 2],
      ["e", 4]
    ]);
  });

  it("lọc theo lớp rồi xếp hạng lại trong lớp", () => {
    const ranked = scopeBoard(rows, new Set(["a", "c", "e"]), (row) => row.v);
    expect(ranked.map((row) => [row.studentId, row.rank])).toEqual([
      ["a", 1],
      ["c", 1],
      ["e", 3]
    ]);
  });

  it("memberIds null = toàn trường", () => {
    expect(scopeBoard(rows, null, (row) => row.v)).toHaveLength(4);
  });
});

describe("dòng bảng", () => {
  it("Học Bá: XP định dạng vi-VN, chip hạng đấu theo XP trọn đời", () => {
    const rows: XpBoardSource[] = [{ ...person("a"), xp: 1234, activeDays: 12 }];
    const [entry] = xpBoardEntries(rows, null, new Map([["a", 600]]));
    expect(entry).toMatchObject({
      rank: 1,
      valueText: "1.234 XP",
      subText: "12 ngày học",
      chip: { kind: "rank", xp: 600 }
    });
  });

  it("Học Bá: không mang field thừa (activeDayKeys…) ra giao diện", () => {
    const rows = [{ ...person("a"), xp: 10, activeDays: 1, activeDayKeys: ["2026-10-01"] }];
    expect(Object.keys(xpBoardEntries(rows, null, new Map())[0])).not.toContain("activeDayKeys");
  });

  it("Chuỗi: nhắc 'Chưa học hôm nay' khi hôm nay chưa học", () => {
    const rows: StreakBoardSource[] = [
      { ...person("a"), days: 5, activeToday: false },
      { ...person("b"), days: 9, activeToday: true }
    ];
    const entries = streakBoardEntries(rows, null);
    expect(entries.map((entry) => [entry.studentId, entry.valueText, entry.subText])).toEqual([
      ["b", "9 ngày", null],
      ["a", "5 ngày", "Chưa học hôm nay"]
    ]);
    expect(entries[0].chip).toEqual({ kind: "fire", days: 9 });
  });
});

describe("boardWindow (khối trang chủ)", () => {
  const entries = streakBoardEntries(
    ["a", "b", "c", "d", "e", "f", "g"].map((id, index) => ({
      ...person(id),
      days: 10 - index,
      activeToday: true
    })),
    null
  );

  it("mình trong top → không ghim thêm", () => {
    const window = boardWindow(entries, "b", 5);
    expect(window.top).toHaveLength(5);
    expect(window.me).toBeNull();
  });

  it("mình ngoài top → ghim dòng của mình", () => {
    expect(boardWindow(entries, "g", 5).me?.studentId).toBe("g");
  });

  it("mình không có trong bảng → me null", () => {
    expect(boardWindow(entries, "zz", 5).me).toBeNull();
  });
});

describe("đếm ngược hết tháng (giờ VN)", () => {
  it("10h sáng 5/10 → còn 26 ngày 14 giờ", () => {
    const left = monthEndsIn(new Date("2026-10-05T10:00:00+07:00"));
    expect(left).toEqual({ days: 26, hours: 14, minutes: 0 });
    expect(formatCountdown(left)).toBe("26 ngày 14 giờ");
  });

  it("23h30 ngày 31/10 giờ VN → còn 30 phút", () => {
    expect(formatCountdown(monthEndsIn(new Date("2026-10-31T23:30:00+07:00")))).toBe("00 giờ 30 phút");
  });
});

describe("tham số trang Xếp hạng", () => {
  const context = { classIds: ["c1", "c2"], latestMonth: "2026-10" };

  it("mặc định: Học Bá, toàn trường, lớp gần nhất, tháng hiện tại", () => {
    expect(resolveRankingParams(undefined, context)).toEqual({
      board: "xp",
      scope: "school",
      classId: "c1",
      monthKey: "2026-10"
    });
  });

  it("giá trị lạ về mặc định; lớp không phải của mình về lớp mặc định", () => {
    expect(
      resolveRankingParams({ board: "hack", scope: "x", classId: "c-khac", month: "2020-01" }, context)
    ).toEqual({ board: "xp", scope: "school", classId: "c1", monthKey: "2026-10" });
  });

  it("nhận đúng giá trị hợp lệ", () => {
    expect(
      resolveRankingParams({ board: "streak", scope: "class", classId: "c2", month: "2026-08" }, context)
    ).toEqual({ board: "streak", scope: "class", classId: "c2", monthKey: "2026-08" });
  });

  it("chưa có lớp → classId null", () => {
    expect(resolveRankingParams(undefined, { classIds: [], latestMonth: "2026-10" }).classId).toBeNull();
  });

  it("link bỏ tham số mặc định, chỉ giữ tháng ở bảng Học Bá", () => {
    const linkContext = { latestMonth: "2026-10", defaultClassId: "c1" };
    expect(
      rankingHref({ board: "xp", scope: "school", classId: "c1", monthKey: "2026-10" }, linkContext)
    ).toBe("/student/ranking");
    expect(
      rankingHref({ board: "streak", scope: "class", classId: "c2", monthKey: "2026-08" }, linkContext)
    ).toBe("/student/ranking?board=streak&scope=class&classId=c2");
    expect(
      rankingHref({ board: "xp", scope: "school", classId: "c1", monthKey: "2026-09" }, linkContext)
    ).toBe("/student/ranking?month=2026-09");
  });

  it("chuyển tháng: lùi tối đa 6 tháng, không tới tương lai", () => {
    expect(rankingMonthNav("2026-10", "2026-10")).toEqual({ prev: "2026-09", next: null });
    expect(rankingMonthNav("2026-05", "2026-10")).toEqual({ prev: null, next: "2026-06" });
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận đỏ**

Run: `npx vitest run tests/leaderboard.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/leaderboard"`.

- [ ] **Step 3: Viết `lib/leaderboard.ts`**

```ts
import {
  monthKeyOf,
  monthRange,
  recentMonthKeys,
  resolveMonthKey,
  shiftMonthKey
} from "@/lib/monthly-recap";

// Bảng xếp hạng kiểu chin.edu.vn (Mạng xã hội Đợt 1, spec
// docs/superpowers/specs/2026-10-05-xa-hoi-dot-1-bang-xep-hang-ho-so-design.md).
// Logic thuần — không Prisma, không next/cache. Phần đọc DB ở lib/leaderboard-data.ts.

// Tag cache dùng chung cho Học Bá tháng hiện tại + bảng Chuỗi; submitSkill xoá tag này.
export const LEADERBOARD_CACHE_TAG = "leaderboard";
// Trang Xếp hạng xem lại được tháng hiện tại + 5 tháng trước.
export const RANKING_MONTH_OPTIONS = 6;

const numberFormat = new Intl.NumberFormat("vi-VN");

export function formatCount(value: number): string {
  return numberFormat.format(value);
}

// ---- Cấp lửa của bảng Chuỗi (tên theo chin) ----

export type StreakTier = { key: string; name: string; minDays: number; chipClass: string };

export const STREAK_TIERS: readonly StreakTier[] = [
  {
    key: "nhen",
    name: "Nhen",
    minDays: 1,
    chipClass: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
  },
  {
    key: "ben",
    name: "Bén",
    minDays: 3,
    chipClass: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300"
  },
  {
    key: "chay",
    name: "Cháy",
    minDays: 7,
    chipClass: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300"
  },
  {
    key: "duoc",
    name: "Đuốc",
    minDays: 14,
    chipClass: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
  },
  {
    key: "lua-trai",
    name: "Lửa Trại",
    minDays: 30,
    chipClass: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-300"
  },
  {
    key: "hai-dang",
    name: "Hải Đăng",
    minDays: 60,
    chipClass: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300"
  },
  {
    key: "bat-diet",
    name: "Bất Diệt",
    minDays: 100,
    chipClass: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"
  }
];

export function streakTier(days: number): StreakTier | null {
  let found: StreakTier | null = null;
  for (const tier of STREAK_TIERS) {
    if (days >= tier.minDays) found = tier;
  }
  return found;
}

export function streakTierProgress(days: number): {
  current: StreakTier | null;
  next: StreakTier | null;
  daysToNext: number | null;
} {
  const next = STREAK_TIERS.find((tier) => tier.minDays > days) ?? null;
  return { current: streakTier(days), next, daysToNext: next ? next.minDays - days : null };
}

// ---- Dòng bảng ----

export type BoardPerson = {
  studentId: string;
  displayName: string;
  avatarUrl: string | null;
  avatarPreset: string | null;
  userImage: string | null;
  equippedFrame?: string | null;
};

export type XpBoardSource = BoardPerson & { xp: number; activeDays: number };
export type StreakBoardSource = BoardPerson & { days: number; activeToday: boolean };

export type LeaderboardChip = { kind: "rank"; xp: number } | { kind: "fire"; days: number };

// Dòng đã chuẩn hoá cho mọi bảng — đi qua được JSON (server → client component).
export type LeaderboardEntry = BoardPerson & {
  rank: number;
  valueText: string;
  subText: string | null;
  chip: LeaderboardChip;
};

// Giảm dần theo value; đồng value → đồng hạng, hạng sau nhảy cóc (1, 2, 2, 4) — cùng
// quy ước Tổng kết tháng. Value ≤ 0 không vào bảng.
export function rankBoard<T extends { displayName: string }>(
  rows: T[],
  value: (row: T) => number
): (T & { rank: number })[] {
  const sorted = rows
    .filter((row) => value(row) > 0)
    .sort((a, b) => value(b) - value(a) || a.displayName.localeCompare(b.displayName, "vi"));

  let previousValue: number | null = null;
  let previousRank = 0;

  return sorted.map((row, index) => {
    const current = value(row);
    const rank = index > 0 && current === previousValue ? previousRank : index + 1;
    previousValue = current;
    previousRank = rank;
    return { ...row, rank };
  });
}

// memberIds null = toàn trường; có Set = chỉ học viên của lớp đó, xếp hạng lại trong lớp.
export function scopeBoard<T extends { studentId: string; displayName: string }>(
  rows: T[],
  memberIds: ReadonlySet<string> | null,
  value: (row: T) => number
): (T & { rank: number })[] {
  return rankBoard(memberIds ? rows.filter((row) => memberIds.has(row.studentId)) : rows, value);
}

// Chỉ giữ các trường cần vẽ avatar — bỏ field thừa (activeDayKeys…) trước khi ra giao diện.
function personOf(row: BoardPerson): BoardPerson {
  return {
    studentId: row.studentId,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
    avatarPreset: row.avatarPreset,
    userImage: row.userImage,
    equippedFrame: row.equippedFrame ?? null
  };
}

export function xpBoardEntries(
  rows: XpBoardSource[],
  memberIds: ReadonlySet<string> | null,
  lifetimeXp: ReadonlyMap<string, number>
): LeaderboardEntry[] {
  return scopeBoard(rows, memberIds, (row) => row.xp).map((row) => ({
    ...personOf(row),
    rank: row.rank,
    valueText: `${formatCount(row.xp)} XP`,
    subText: `${row.activeDays} ngày học`,
    chip: { kind: "rank", xp: lifetimeXp.get(row.studentId) ?? 0 }
  }));
}

export function streakBoardEntries(
  rows: StreakBoardSource[],
  memberIds: ReadonlySet<string> | null
): LeaderboardEntry[] {
  return scopeBoard(rows, memberIds, (row) => row.days).map((row) => ({
    ...personOf(row),
    rank: row.rank,
    valueText: `${row.days} ngày`,
    subText: row.activeToday ? null : "Chưa học hôm nay",
    chip: { kind: "fire", days: row.days }
  }));
}

// Khối trang chủ: top N + dòng của mình nếu mình đứng ngoài top.
export function boardWindow(
  entries: LeaderboardEntry[],
  myId: string,
  topN: number
): { top: LeaderboardEntry[]; me: LeaderboardEntry | null } {
  const top = entries.slice(0, topN);
  if (top.some((entry) => entry.studentId === myId)) {
    return { top, me: null };
  }
  return { top, me: entries.find((entry) => entry.studentId === myId) ?? null };
}

// ---- Đếm ngược hết tháng (giờ VN) ----

export function monthEndsIn(now: Date): { days: number; hours: number; minutes: number } {
  const end = monthRange(monthKeyOf(now)).end.getTime();
  const totalMinutes = Math.max(0, Math.floor((end - now.getTime()) / 60_000));
  return {
    days: Math.floor(totalMinutes / 1440),
    hours: Math.floor((totalMinutes % 1440) / 60),
    minutes: totalMinutes % 60
  };
}

export function formatCountdown(left: { days: number; hours: number; minutes: number }): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return left.days > 0
    ? `${left.days} ngày ${pad(left.hours)} giờ`
    : `${pad(left.hours)} giờ ${pad(left.minutes)} phút`;
}

// ---- Tham số URL của /student/ranking ----

export type RankingBoard = "xp" | "streak" | "class";
export type RankingScope = "school" | "class";
export type RankingParams = {
  board: RankingBoard;
  scope: RankingScope;
  classId: string | null;
  monthKey: string;
};

const BOARDS: readonly RankingBoard[] = ["xp", "streak", "class"];

function isRankingBoard(value: unknown): value is RankingBoard {
  return typeof value === "string" && (BOARDS as readonly string[]).includes(value);
}

// Giá trị lạ → mặc định. classId chỉ nhận lớp của chính học viên (không lộ lớp khác).
export function resolveRankingParams(
  raw: { board?: string; scope?: string; classId?: string; month?: string } | undefined,
  context: { classIds: string[]; latestMonth: string }
): RankingParams {
  const board = raw?.board;
  const classId =
    raw?.classId && context.classIds.includes(raw.classId) ? raw.classId : context.classIds[0] ?? null;

  return {
    board: isRankingBoard(board) ? board : "xp",
    scope: raw?.scope === "class" ? "class" : "school",
    classId,
    monthKey: resolveMonthKey(raw?.month, context.latestMonth, RANKING_MONTH_OPTIONS)
  };
}

export type RankingLinkContext = { latestMonth: string; defaultClassId: string | null };

// Link giữa các tab — bỏ tham số mặc định cho URL gọn; tháng chỉ có nghĩa ở bảng Học Bá.
export function rankingHref(params: RankingParams, context: RankingLinkContext): string {
  const search = new URLSearchParams();
  if (params.board !== "xp") search.set("board", params.board);
  if (params.scope !== "school") search.set("scope", params.scope);
  if (params.classId && params.classId !== context.defaultClassId) search.set("classId", params.classId);
  if (params.board === "xp" && params.monthKey !== context.latestMonth) search.set("month", params.monthKey);
  const query = search.toString();
  return query ? `/student/ranking?${query}` : "/student/ranking";
}

export function rankingMonthNav(
  monthKey: string,
  latestMonth: string
): { prev: string | null; next: string | null } {
  const options = recentMonthKeys(latestMonth, RANKING_MONTH_OPTIONS);
  const prev = shiftMonthKey(monthKey, -1);
  return {
    prev: options.includes(prev) ? prev : null,
    next: monthKey < latestMonth ? shiftMonthKey(monthKey, 1) : null
  };
}
```

- [ ] **Step 4: Chạy test, xác nhận xanh**

Run: `npx vitest run tests/leaderboard.test.ts`
Expected: PASS (toàn bộ).

- [ ] **Step 5: Commit**

```bash
git add lib/leaderboard.ts tests/leaderboard.test.ts
git diff --cached --stat
git commit -m "feat(xa-hoi): logic thuan bang xep hang - cap lua, xep hang, dem nguoc, tham so URL

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Chuỗi cả trường + cache bảng xếp hạng

**Files:**
- Modify: `lib/leaderboard.ts` (thêm `SchoolStreakInput`, `schoolDayStreaks`)
- Modify: `lib/day-streak-data.ts` (thêm `loadSchoolStreakInput`)
- Create: `lib/leaderboard-data.ts`
- Modify: `lib/monthly-recap-data.ts` (cache tháng hiện tại)
- Modify: `lib/actions/attempts.ts` (`revalidateTag` sau khi nộp)
- Test: `tests/leaderboard-streak.test.ts`, `tests/leaderboard-guard.test.ts`

**Interfaces:**
- Consumes: `buildActivityDays`, `activeDayKeys` (`lib/activity-heatmap.ts`); `calculateDayStreak`, `restoredDayOf`, `type DayStreak` (`lib/day-streak.ts`); `LEADERBOARD_CACHE_TAG`, `StreakBoardSource`, `BoardPerson` (Task 1).
- Produces:
  - `type SchoolStreakInput = { submits: { studentId; submittedAt: Date }[]; vocabDays: { studentId; date: string; total: number }[]; restoreKeys: { studentId; key: string }[] }`
  - `schoolDayStreaks(input, today: string): Map<string, DayStreak>`
  - `loadSchoolStreakInput(today: string): Promise<SchoolStreakInput>` (lib/day-streak-data.ts)
  - `loadBoardPeople(ids: string[]): Promise<Map<string, BoardPerson>>`, `getStreakBoard(now?: Date): Promise<StreakBoardSource[]>`, `classMemberIds(classId: string): Promise<Set<string>>` (lib/leaderboard-data.ts)

- [ ] **Step 1: Viết test (sẽ đỏ)**

Tạo `tests/leaderboard-streak.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { activeDayKeys, buildActivityDays } from "@/lib/activity-heatmap";
import { calculateDayStreak, dayRestoreKey, restoredDayOf } from "@/lib/day-streak";
import { schoolDayStreaks } from "@/lib/leaderboard";

const today = "2026-10-05";
const at = (iso: string) => new Date(iso);

const input = {
  submits: [
    { studentId: "a", submittedAt: at("2026-10-05T08:00:00+07:00") },
    { studentId: "a", submittedAt: at("2026-10-04T23:30:00+07:00") },
    { studentId: "a", submittedAt: at("2026-10-03T07:00:00+07:00") },
    { studentId: "b", submittedAt: at("2026-10-04T09:00:00+07:00") },
    { studentId: "b", submittedAt: at("2026-10-02T09:00:00+07:00") }
  ],
  vocabDays: [
    { studentId: "b", date: "2026-10-03", total: 4 },
    { studentId: "c", date: "2026-10-01", total: 2 },
    { studentId: "c", date: "2026-10-04", total: 0 }
  ],
  restoreKeys: [
    { studentId: "c", key: dayRestoreKey("2026-10-04") },
    // Khoá tuần cũ (Đợt 2) không phải ngày cứu — phải bị bỏ qua.
    { studentId: "c", key: "restore:2026-09-28" }
  ]
};

describe("schoolDayStreaks — chuỗi ngày của cả trường tính một lượt", () => {
  it("mỗi em ra đúng chuỗi", () => {
    const result = schoolDayStreaks(input, today);
    expect(result.get("a")).toEqual({ days: 3, activeToday: true });
    expect(result.get("b")).toEqual({ days: 3, activeToday: false });
    // c: ngày 4 đã cứu bằng Xu, ngày 3 không học → chuỗi 1 ngày.
    expect(result.get("c")).toEqual({ days: 1, activeToday: false });
  });

  it("trùng với cách tính riêng từng em (bất biến với getDayStreak)", () => {
    const result = schoolDayStreaks(input, today);

    for (const id of ["a", "b", "c"]) {
      const days = buildActivityDays({
        submits: input.submits.filter((row) => row.studentId === id).map((row) => row.submittedAt),
        vocabDays: input.vocabDays.filter((row) => row.studentId === id)
      });
      const restoredDays = input.restoreKeys
        .filter((row) => row.studentId === id)
        .map((row) => restoredDayOf(row.key))
        .filter((day): day is string => day !== null);

      expect(result.get(id)).toEqual(
        calculateDayStreak({ activeDays: activeDayKeys(days), restoredDays, today })
      );
    }
  });

  it("em không có dữ liệu thì không có trong kết quả", () => {
    expect(schoolDayStreaks(input, today).has("zz")).toBe(false);
  });
});
```

Tạo `tests/leaderboard-guard.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function read(relative: string): string {
  return readFileSync(join(process.cwd(), ...relative.split("/")), "utf8").replace(/\r\n/g, "\n");
}

describe("bảng xếp hạng — cache", () => {
  it("submitSkill xoá cache bảng xếp hạng sau khi nộp", () => {
    const source = read("lib/actions/attempts.ts");
    expect(source).toContain("revalidateTag(LEADERBOARD_CACHE_TAG)");
  });

  it("Học Bá tháng hiện tại có cache gắn tag, vẫn giữ khoá tháng cũ v2", () => {
    const source = read("lib/monthly-recap-data.ts");
    expect(source).toContain('"monthly-recap-v2"');
    expect(source).toContain('"monthly-recap-live-v1"');
    expect(source).toContain("tags: [LEADERBOARD_CACHE_TAG]");
  });

  it("bảng Chuỗi cache theo khoá NGÀY (chuỗi), không theo Date", () => {
    const source = read("lib/leaderboard-data.ts");
    expect(source).toContain("cachedStreakBoard(vietnamDateKey(now))");
    expect(source).toContain("tags: [LEADERBOARD_CACHE_TAG]");
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận đỏ**

Run: `npx vitest run tests/leaderboard-streak.test.ts tests/leaderboard-guard.test.ts`
Expected: FAIL — `schoolDayStreaks is not a function` / `ENOENT lib/leaderboard-data.ts` / chưa có `revalidateTag`.

- [ ] **Step 3: Thêm `schoolDayStreaks` vào `lib/leaderboard.ts`**

Thêm vào khối import ở đầu file:

```ts
import { activeDayKeys, buildActivityDays } from "@/lib/activity-heatmap";
import { calculateDayStreak, restoredDayOf, type DayStreak } from "@/lib/day-streak";
```

Thêm vào cuối file:

```ts
// ---- Chuỗi ngày của CẢ TRƯỜNG (bảng Chuỗi 🔥) ----
// Cùng định nghĩa với getDayStreak (lib/day-streak-data.ts) nhưng gộp một lượt:
// ngày có học = nộp ≥ 1 phần kỹ năng hoặc ôn ≥ 1 thẻ; ngày cứu bằng Xu coi như có học.

export type SchoolStreakInput = {
  submits: { studentId: string; submittedAt: Date }[];
  vocabDays: { studentId: string; date: string; total: number }[];
  restoreKeys: { studentId: string; key: string }[];
};

function pushTo<V>(map: Map<string, V[]>, id: string, value: V) {
  const list = map.get(id);
  if (list) {
    list.push(value);
  } else {
    map.set(id, [value]);
  }
}

export function schoolDayStreaks(input: SchoolStreakInput, today: string): Map<string, DayStreak> {
  const submits = new Map<string, Date[]>();
  const vocab = new Map<string, { date: string; total: number }[]>();
  const restored = new Map<string, string[]>();

  for (const row of input.submits) pushTo(submits, row.studentId, row.submittedAt);
  for (const row of input.vocabDays) pushTo(vocab, row.studentId, { date: row.date, total: row.total });
  for (const row of input.restoreKeys) {
    const day = restoredDayOf(row.key);
    if (day) pushTo(restored, row.studentId, day);
  }

  const ids = new Set([
    ...Array.from(submits.keys()),
    ...Array.from(vocab.keys()),
    ...Array.from(restored.keys())
  ]);
  const result = new Map<string, DayStreak>();

  ids.forEach((id) => {
    const days = buildActivityDays({ submits: submits.get(id) ?? [], vocabDays: vocab.get(id) ?? [] });
    result.set(
      id,
      calculateDayStreak({ activeDays: activeDayKeys(days), restoredDays: restored.get(id) ?? [], today })
    );
  });

  return result;
}
```

- [ ] **Step 4: Thêm `loadSchoolStreakInput` vào `lib/day-streak-data.ts`**

Thêm import (cạnh các import hiện có):

```ts
import type { SchoolStreakInput } from "@/lib/leaderboard";
```

Thêm ngay sau hàm `loadActivityDays`:

```ts
// Dữ liệu chuỗi ngày của CẢ TRƯỜNG (bảng Chuỗi 🔥) — cùng nguồn, cùng cửa sổ với
// loadActivityDays/getDayStreak, nhưng 4 truy vấn cho mọi học viên thay vì từng em.
export async function loadSchoolStreakInput(today: string): Promise<SchoolStreakInput> {
  const sinceKey = shiftDateKey(today, -STREAK_LOOKBACK_DAYS);
  // Lùi thêm 1 ngày cho chắc qua ranh giới giờ VN (như loadActivityDays).
  const since = new Date(dateKeyToUtcDate(sinceKey).getTime() - DAY_MS);

  const [skillSubmits, legacyAttempts, vocabDays, restores] = await Promise.all([
    prisma.attemptSkill.findMany({
      where: { submittedAt: { gte: since } },
      select: { submittedAt: true, attempt: { select: { studentId: true } } }
    }),
    prisma.attempt.findMany({
      where: { submittedAt: { gte: since }, skills: { none: { submittedAt: { not: null } } } },
      select: { studentId: true, submittedAt: true }
    }),
    prisma.vocabQuizDay.findMany({
      where: { date: { gte: dateKeyToUtcDate(sinceKey) } },
      select: { studentId: true, date: true, total: true }
    }),
    prisma.coinTransaction.findMany({
      where: { kind: "streak_restore" },
      select: { studentId: true, key: true }
    })
  ]);

  const submits: SchoolStreakInput["submits"] = [];
  for (const row of skillSubmits) {
    if (row.submittedAt) submits.push({ studentId: row.attempt.studentId, submittedAt: row.submittedAt });
  }
  for (const row of legacyAttempts) {
    if (row.submittedAt) submits.push({ studentId: row.studentId, submittedAt: row.submittedAt });
  }

  return {
    submits,
    // VocabQuizDay.date lưu nửa đêm UTC của ngày VN → cắt chuỗi là ra khoá ngày.
    vocabDays: vocabDays.map((row) => ({
      studentId: row.studentId,
      date: row.date.toISOString().slice(0, 10),
      total: row.total
    })),
    restoreKeys: restores
  };
}
```

(`shiftDateKey`, `STREAK_LOOKBACK_DAYS`, `DAY_MS`, `dateKeyToUtcDate`, `prisma` đã có sẵn trong file.)

- [ ] **Step 5: Tạo `lib/leaderboard-data.ts`**

```ts
import { unstable_cache } from "next/cache";
import { loadSchoolStreakInput } from "@/lib/day-streak-data";
import {
  LEADERBOARD_CACHE_TAG,
  schoolDayStreaks,
  type BoardPerson,
  type StreakBoardSource
} from "@/lib/leaderboard";
import { prisma } from "@/lib/prisma";
import { vietnamDateKey } from "@/lib/vocab-day";

// Đọc DB cho bảng xếp hạng (Mạng xã hội Đợt 1). Logic thuần ở lib/leaderboard.ts.

export async function loadBoardPeople(ids: string[]): Promise<Map<string, BoardPerson>> {
  if (ids.length === 0) return new Map();

  const rows = await prisma.studentProfile.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      displayName: true,
      avatarUrl: true,
      avatarPreset: true,
      equippedFrame: true,
      user: { select: { image: true } }
    }
  });

  return new Map(
    rows.map((row) => [
      row.id,
      {
        studentId: row.id,
        displayName: row.displayName,
        avatarUrl: row.avatarUrl,
        avatarPreset: row.avatarPreset,
        userImage: row.user?.image ?? null,
        equippedFrame: row.equippedFrame
      }
    ])
  );
}

// Trả mảng JSON thuần (đi qua unstable_cache): chỉ em có chuỗi > 0, chưa xếp hạng.
async function loadStreakBoard(today: string): Promise<StreakBoardSource[]> {
  const streaks = schoolDayStreaks(await loadSchoolStreakInput(today), today);
  const ids = Array.from(streaks.entries())
    .filter(([, streak]) => streak.days > 0)
    .map(([id]) => id);
  const people = await loadBoardPeople(ids);

  return ids.flatMap((id) => {
    const person = people.get(id);
    const streak = streaks.get(id);
    // Hồ sơ đã bị xoá → bỏ qua.
    return person && streak ? [{ ...person, days: streak.days, activeToday: streak.activeToday }] : [];
  });
}

// Khoá theo NGÀY VN (chuỗi) để cache trúng cả ngày; làm mới sau 5 phút hoặc khi có
// bài nộp (submitSkill gọi revalidateTag). Ôn thẻ không xoá cache → trễ tối đa 5 phút.
const cachedStreakBoard = unstable_cache(loadStreakBoard, ["leaderboard-streak-v1"], {
  revalidate: 300,
  tags: [LEADERBOARD_CACHE_TAG]
});

export async function getStreakBoard(now: Date = new Date()): Promise<StreakBoardSource[]> {
  return cachedStreakBoard(vietnamDateKey(now));
}

export async function classMemberIds(classId: string): Promise<Set<string>> {
  const rows = await prisma.classStudent.findMany({ where: { classId }, select: { studentId: true } });
  return new Set(rows.map((row) => row.studentId));
}
```

- [ ] **Step 6: Cache Học Bá tháng hiện tại trong `lib/monthly-recap-data.ts`**

Thêm import:

```ts
import { LEADERBOARD_CACHE_TAG } from "@/lib/leaderboard";
```

Thay hàm `getMonthlyRecap` hiện có (ngay dưới `loadClosedMonthRecap`) bằng:

```ts
// Tháng đang diễn ra: cache 5 phút cho bảng Học Bá (trang chủ + trang Xếp hạng), xoá
// ngay khi có bài nộp (submitSkill gọi revalidateTag). Trang Tổng kết xem tháng hiện
// tại cũng đi qua đây nên có thể trễ tối đa 5 phút — chấp nhận được.
const loadCurrentMonthRecap = unstable_cache(loadMonthlyRecap, ["monthly-recap-live-v1"], {
  revalidate: 300,
  tags: [LEADERBOARD_CACHE_TAG]
});

export async function getMonthlyRecap(monthKey: string, now = new Date()): Promise<MonthlyRecap> {
  return monthKey < monthKeyOf(now) ? loadClosedMonthRecap(monthKey) : loadCurrentMonthRecap(monthKey);
}
```

- [ ] **Step 7: Xoá cache sau khi nộp trong `lib/actions/attempts.ts`**

Sửa dòng import đầu file:

```ts
import { revalidatePath, revalidateTag } from "next/cache";
```

Thêm import:

```ts
import { LEADERBOARD_CACHE_TAG } from "@/lib/leaderboard";
```

Trong `submitSkill`, ngay sau khối `try { await syncWallet(...) } catch ...` và trước `revalidatePath("/student");`, thêm:

```ts
  // Bảng xếp hạng (Học Bá tháng + Chuỗi) cache 5 phút — nộp bài thì làm mới ngay.
  try {
    revalidateTag(LEADERBOARD_CACHE_TAG);
  } catch (error) {
    console.error("[bang-xep-hang] không xoá được cache", error);
  }
```

- [ ] **Step 8: Chạy test + kiểm kiểu**

Run: `npx vitest run tests/leaderboard-streak.test.ts tests/leaderboard-guard.test.ts tests/leaderboard.test.ts tests/wallet-guard.test.ts tests/monthly-recap.test.ts`
Expected: PASS.

Run: `npx tsc --noEmit`
Expected: không lỗi.

- [ ] **Step 9: Commit**

```bash
git add lib/leaderboard.ts lib/day-streak-data.ts lib/leaderboard-data.ts lib/monthly-recap-data.ts lib/actions/attempts.ts tests/leaderboard-streak.test.ts tests/leaderboard-guard.test.ts
git diff --cached --stat
git commit -m "feat(xa-hoi): chuoi ngay ca truong + cache bang xep hang 5 phut, xoa khi nop bai

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Thưởng Xu Học Bá tháng + chuông

**Files:**
- Modify: `lib/coins.ts`, `prisma/schema.prisma` (2 dòng comment), `lib/leaderboard.ts`, `lib/wallet.ts`, `scripts/coins-backfill.ts`, `app/api/cron/reminders/route.ts`, `lib/notifications.ts`, `lib/notifications-feed.ts`, `components/notification-list.tsx`
- Test: `tests/leaderboard-prize.test.ts`, `tests/notifications.test.ts`

**Interfaces:**
- Consumes: `type CoinEntryDraft` (`lib/coins.ts`); `type MonthlyRecap`, `monthKeyOf`, `monthNumberLabel`, `shiftMonthKey` (`lib/monthly-recap.ts`); `RecapLoader`, `applyWalletChanges` (nội bộ `lib/wallet.ts`).
- Produces:
  - `PRIZE_START_MONTH`, `PRIZE_TOP_THREE`, `PRIZE_TOP_TEN`, `PRIZE_LAST_RANK`, `PRIZE_CHIPS: { label: string; text: string }[]`
  - `monthlyPrizeFor(rank: number | null): number`, `monthlyPrizeKey(monthKey): string`, `prizeMonthKeys(now): string[]`
  - `type PrizeEntry = { studentId: string; draft: CoinEntryDraft }`, `monthlyPrizeEntries(recap, now): PrizeEntry[]`
  - `loadMonthlyPrizeEntries(loadRecap, now?)`, `grantMonthlyPrizes(loadRecap, now?): Promise<number>` (lib/wallet.ts)
  - `type PrizeNotificationSource = { key: string; amount: number; note: string | null; createdAt: Date }`; tham số thứ 7 `prizes` của `buildStudentNotifications`; loại thông báo `"monthly_prize"`.

- [ ] **Step 1: Viết test (sẽ đỏ)**

Tạo `tests/leaderboard-prize.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PRIZE_START_MONTH,
  monthlyPrizeEntries,
  monthlyPrizeFor,
  prizeMonthKeys
} from "@/lib/leaderboard";
import type { MonthlyRecap, RecapEntry } from "@/lib/monthly-recap";
import { XP_EARN_KINDS } from "@/lib/xp-rank";

function read(relative: string): string {
  return readFileSync(join(process.cwd(), ...relative.split("/")), "utf8").replace(/\r\n/g, "\n");
}

function recapWith(monthKey: string, ranks: number[]): MonthlyRecap {
  const entries: RecapEntry[] = ranks.map((xpRank, index) => ({
    studentId: `s${index}`,
    displayName: `S${index}`,
    avatarUrl: null,
    avatarPreset: null,
    userImage: null,
    xp: 100 - index,
    activeDays: 1,
    activeDayKeys: [],
    unitsBySkill: {},
    vocabCards: 0,
    xpRank,
    daysRank: null
  }));
  return {
    monthKey,
    daysInMonth: 31,
    totalXp: 0,
    participantCount: entries.length,
    entries,
    xpBoard: entries,
    daysBoard: []
  };
}

describe("thưởng Xu Học Bá tháng", () => {
  it.each([
    [1, 300],
    [2, 200],
    [3, 150],
    [4, 50],
    [10, 50],
    [11, 0],
    [0, 0]
  ])("hạng %i → %i Xu", (rank, amount) => {
    expect(monthlyPrizeFor(rank)).toBe(amount);
  });

  it("chưa có hạng (0 XP) → 0 Xu", () => {
    expect(monthlyPrizeFor(null)).toBe(0);
  });

  it("chỉ các tháng ĐÃ KHÉP từ tháng 10/2026", () => {
    expect(PRIZE_START_MONTH).toBe("2026-10");
    expect(prizeMonthKeys(new Date("2026-10-15T12:00:00+07:00"))).toEqual([]);
    expect(prizeMonthKeys(new Date("2026-11-01T12:00:00+07:00"))).toEqual(["2026-10"]);
    expect(prizeMonthKeys(new Date("2027-01-05T12:00:00+07:00"))).toEqual(["2026-10", "2026-11", "2026-12"]);
  });

  it("đồng hạng nhận cùng mức thưởng, có thể quá 10 em", () => {
    const now = new Date("2026-11-01T12:00:00+07:00");
    const entries = monthlyPrizeEntries(recapWith("2026-10", [1, 2, 2, 4, 5, 6, 7, 8, 9, 10, 10, 12]), now);
    expect(entries.map((entry) => entry.draft.amount)).toEqual([300, 200, 200, 50, 50, 50, 50, 50, 50, 50, 50]);
    expect(entries[1]).toEqual({
      studentId: "s1",
      draft: {
        kind: "monthly_prize",
        key: "prize:xp:2026-10",
        amount: 200,
        note: "Hạng #2 Học Bá tháng 10/2026",
        attemptId: null,
        createdAt: now
      }
    });
  });

  it("tháng trước mốc bắt đầu không có thưởng (không hồi tố)", () => {
    expect(monthlyPrizeEntries(recapWith("2026-09", [1, 2, 3]), new Date())).toEqual([]);
  });

  it("Xu thưởng KHÔNG tính vào XP hạng đấu", () => {
    expect(XP_EARN_KINDS as readonly string[]).not.toContain("monthly_prize");
  });

  it("kind monthly_prize có trong schema comment + CoinKind", () => {
    expect(read("prisma/schema.prisma")).toMatch(/\/\/ enum CoinKind[^\n]*monthly_prize/);
    expect(read("lib/coins.ts")).toContain('"monthly_prize"');
  });

  it("cron cộng thưởng, syncWallet dự phòng, script hồi tố truyền sẵn danh sách", () => {
    const cron = read("app/api/cron/reminders/route.ts");
    expect(cron).toContain("grantMonthlyPrizes(getMonthlyRecap)");
    // Chỗ kiểm cấu hình mail return sớm — cộng thưởng phải chạy trước nó.
    expect(cron.indexOf("grantMonthlyPrizes(getMonthlyRecap)")).toBeLessThan(cron.indexOf("isEmailConfigured()"));
    expect(read("lib/wallet.ts")).toContain("loadMonthlyPrizeEntries(getMonthlyRecap, now)");
    expect(read("scripts/coins-backfill.ts")).toContain("loadMonthlyPrizeEntries(loadMonthlyRecap)");
  });
});
```

Thêm vào cuối khối `describe("buildStudentNotifications", ...)` trong `tests/notifications.test.ts` (trước dấu `});` đóng khối đó):

```ts
  it("thưởng Học Bá hiện trong chuông, link về bảng tháng đó", () => {
    const items = buildStudentNotifications([], [], new Date("2026-10-31T00:00:00Z"), [], {}, [], [
      {
        key: "prize:xp:2026-10",
        amount: 150,
        note: "Hạng #3 Học Bá tháng 10/2026",
        createdAt: new Date("2026-11-01T05:00:00Z")
      }
    ]);

    expect(items[0]).toMatchObject({
      id: "prize:xp:2026-10",
      type: "monthly_prize",
      title: "🏆 Hạng #3 Học Bá tháng 10/2026 — +150 Xu",
      href: "/student/ranking?month=2026-10",
      unread: true
    });
  });
```

- [ ] **Step 2: Chạy test, xác nhận đỏ**

Run: `npx vitest run tests/leaderboard-prize.test.ts tests/notifications.test.ts`
Expected: FAIL — `monthlyPrizeFor is not a function`, và test chuông ra 0 mục.

- [ ] **Step 3: Thêm kind `monthly_prize`**

`lib/coins.ts` — thêm vào union `CoinKind` (sau `| "reward_refund"`):

```ts
export type CoinKind =
  | "earn_unit"
  | "earn_vocab"
  | "purchase"
  | "streak_restore"
  | "reward_redeem"
  | "reward_refund"
  | "monthly_prize";
```

`prisma/schema.prisma` — sửa 2 dòng comment:

```
// enum CoinKind (CoinTransaction.kind): earn_unit | earn_vocab | purchase | streak_restore | reward_redeem | reward_refund | monthly_prize
```

và trong `model CoinTransaction`:

```
  // earn_unit | earn_vocab | purchase | streak_restore | reward_redeem | reward_refund | monthly_prize — xem comment đầu schema
```

- [ ] **Step 4: Logic thưởng thuần trong `lib/leaderboard.ts`**

Sửa import từ `@/lib/monthly-recap` thành:

```ts
import {
  monthKeyOf,
  monthNumberLabel,
  monthRange,
  recentMonthKeys,
  resolveMonthKey,
  shiftMonthKey,
  type MonthlyRecap
} from "@/lib/monthly-recap";
```

Thêm import:

```ts
import type { CoinEntryDraft } from "@/lib/coins";
```

Thêm vào cuối file:

```ts
// ---- Thưởng Xu Học Bá tháng (Top 10 TOÀN TRƯỜNG) ----
// Không hồi tố: lúc các tháng trước diễn ra, các em chưa biết có giải.

export const PRIZE_START_MONTH = "2026-10";
export const PRIZE_TOP_THREE = [300, 200, 150] as const;
export const PRIZE_TOP_TEN = 50;
export const PRIZE_LAST_RANK = 10;

export const PRIZE_CHIPS: { label: string; text: string }[] = [
  { label: "#1", text: `${PRIZE_TOP_THREE[0]} Xu + khung Quán quân` },
  { label: "#2", text: `${PRIZE_TOP_THREE[1]} Xu` },
  { label: "#3", text: `${PRIZE_TOP_THREE[2]} Xu` },
  { label: `#4–${PRIZE_LAST_RANK}`, text: `${PRIZE_TOP_TEN} Xu` }
];

export function monthlyPrizeFor(rank: number | null): number {
  if (!rank || rank < 1 || rank > PRIZE_LAST_RANK) return 0;
  return rank <= PRIZE_TOP_THREE.length ? PRIZE_TOP_THREE[rank - 1] : PRIZE_TOP_TEN;
}

export function monthlyPrizeKey(monthKey: string): string {
  return `prize:xp:${monthKey}`;
}

// Các tháng ĐÃ KHÉP có thưởng: từ PRIZE_START_MONTH tới trước tháng hiện tại (giờ VN).
export function prizeMonthKeys(now: Date): string[] {
  const current = monthKeyOf(now);
  const keys: string[] = [];
  for (let key = PRIZE_START_MONTH; key < current; key = shiftMonthKey(key, 1)) {
    keys.push(key);
  }
  return keys;
}

export type PrizeEntry = { studentId: string; draft: CoinEntryDraft };

// Đồng hạng (đồng XP) nhận cùng mức thưởng của hạng đó — có thể hơn 10 em.
export function monthlyPrizeEntries(recap: MonthlyRecap, now: Date): PrizeEntry[] {
  if (recap.monthKey < PRIZE_START_MONTH) return [];

  return recap.xpBoard.flatMap((entry) => {
    const amount = monthlyPrizeFor(entry.xpRank);
    if (amount <= 0) return [];
    return [
      {
        studentId: entry.studentId,
        draft: {
          kind: "monthly_prize" as const,
          key: monthlyPrizeKey(recap.monthKey),
          amount,
          note: `Hạng #${entry.xpRank} Học Bá tháng ${monthNumberLabel(recap.monthKey)}`,
          attemptId: null,
          createdAt: now
        }
      }
    ];
  });
}
```

- [ ] **Step 5: Cộng thưởng trong `lib/wallet.ts`**

Thêm import:

```ts
import { monthlyPrizeEntries, prizeMonthKeys, type PrizeEntry } from "@/lib/leaderboard";
```

Thêm ngay sau hàm `loadAchievementItems`:

```ts
// Thưởng Xu Học Bá (Top 10 toàn trường) của mọi tháng đã khép từ PRIZE_START_MONTH.
// Recap tháng đã khép dùng chung cache 1 ngày với đồ thành tích — không tốn thêm truy vấn.
export async function loadMonthlyPrizeEntries(
  loadRecap: RecapLoader,
  now = new Date()
): Promise<PrizeEntry[]> {
  const recaps = await Promise.all(prizeMonthKeys(now).map((monthKey) => loadRecap(monthKey)));
  return recaps.flatMap((recap) => monthlyPrizeEntries(recap, now));
}
```

Thêm ngay SAU hàm `applyWalletChanges` (cần dùng nó):

```ts
// Cron gọi mỗi trưa: cộng thưởng còn thiếu cho cả trường. Idempotent nhờ
// @@unique([studentId, key]) + skipDuplicates — chạy lại không cộng trùng.
export async function grantMonthlyPrizes(loadRecap: RecapLoader, now = new Date()): Promise<number> {
  const entries = await loadMonthlyPrizeEntries(loadRecap, now);
  if (entries.length === 0) return 0;

  const existing = await prisma.coinTransaction.findMany({
    where: {
      kind: "monthly_prize",
      studentId: { in: Array.from(new Set(entries.map((entry) => entry.studentId))) }
    },
    select: { studentId: true, key: true }
  });
  const granted = new Set(existing.map((row) => `${row.studentId}|${row.key}`));

  const byStudent = new Map<string, CoinEntryDraft[]>();
  for (const entry of entries) {
    if (granted.has(`${entry.studentId}|${entry.draft.key}`)) continue;
    const list = byStudent.get(entry.studentId) ?? [];
    list.push(entry.draft);
    byStudent.set(entry.studentId, list);
  }

  let created = 0;
  for (const [studentId, drafts] of Array.from(byStudent.entries())) {
    await applyWalletChanges(studentId, drafts, [], []);
    created += drafts.length;
  }
  return created;
}
```

Trong `syncWallet`:
- đổi kiểu `options` thành `options: { attemptId?: string; achievements?: AchievementItem[]; prizes?: PrizeEntry[]; now?: Date } = {}`;
- trong khối `if (full) { ... }`, ngay sau đoạn gán `items = achievements...`, thêm:

```ts
    // Thưởng Học Bá tháng — dự phòng khi cron trượt; chỉ phần của em này, chưa có trong sổ.
    const prizes = options.prizes ?? (await loadMonthlyPrizeEntries(getMonthlyRecap, now));
    create.push(
      ...prizes
        .filter((entry) => entry.studentId === studentId && !existingKeys.has(entry.draft.key))
        .map((entry) => entry.draft)
    );
```

- [ ] **Step 6: Script hồi tố truyền sẵn danh sách thưởng**

`scripts/coins-backfill.ts`:

```ts
import { loadAchievementItems, loadMonthlyPrizeEntries, syncWallet } from "@/lib/wallet";
```

Ngay sau dòng `const achievements = await loadAchievementItems(loadMonthlyRecap);` thêm:

```ts
  const prizes = await loadMonthlyPrizeEntries(loadMonthlyRecap);
  console.log(`Thưởng Học Bá tháng: ${prizes.length} dòng`);
```

Đổi lệnh gọi trong vòng lặp thành `const result = await syncWallet(student.id, { achievements, prizes });`.

- [ ] **Step 7: Cron cộng thưởng mỗi trưa**

`app/api/cron/reminders/route.ts` — thêm import:

```ts
import { getMonthlyRecap } from "@/lib/monthly-recap-data";
import { grantMonthlyPrizes } from "@/lib/wallet";
```

Ngay sau khối `try { sessionsCreated = await topUpClassSessions(); } catch ...`, thêm:

```ts
  // Thưởng Xu Học Bá tháng đã khép (lần đầu: trưa 1/11/2026). Idempotent — trượt hôm nay
  // thì mai cộng bù; lỗi ở đây không chặn nhắc bài.
  let prizesGranted = 0;
  try {
    prizesGranted = await grantMonthlyPrizes(getMonthlyRecap);
  } catch (error) {
    console.error("[cron/reminders] Không cộng được thưởng Học Bá:", error);
  }
```

Thêm `prizesGranted` vào cả hai chỗ trả JSON:

```ts
    return NextResponse.json({ skipped: "email_not_configured", sessionsCreated, prizesGranted });
```

và ở cuối hàm:

```ts
    failed: results.length - sent,
    sessionsCreated,
    prizesGranted,
  });
```

- [ ] **Step 8: Chuông thông báo thưởng**

`lib/notifications.ts`:
- thêm `| "monthly_prize"` vào cuối union `StudentNotificationType`;
- thêm kiểu nguồn ngay sau `RewardNotificationSource`:

```ts
// Thưởng Xu Học Bá tháng (Mạng xã hội Đợt 1) — dòng sổ Xu kind monthly_prize.
export type PrizeNotificationSource = {
  key: string; // "prize:xp:YYYY-MM"
  amount: number;
  note: string | null;
  createdAt: Date;
};
```

- thêm tham số thứ 7 cho `buildStudentNotifications` (sau `rewards`):

```ts
  // Tham số thứ 7 tuỳ chọn: thưởng Xu Học Bá tháng.
  prizes: PrizeNotificationSource[] = []
```

- thêm vào cuối mảng `items` (sau khối `...rewards.map(...)`):

```ts
    ...prizes.map((item) => ({
      id: item.key,
      type: "monthly_prize" as const,
      title: `🏆 ${item.note ?? "Thưởng Học Bá tháng"} — +${item.amount} Xu`,
      detail: null,
      href: `/student/ranking?month=${item.key.slice("prize:xp:".length)}`,
      createdAt: item.createdAt,
      unread: isUnread(item.createdAt, readAt)
    }))
```

`lib/notifications-feed.ts`:
- thêm `type PrizeNotificationSource` vào import từ `@/lib/notifications`;
- ngay trước `const items = buildStudentNotifications(`, thêm:

```ts
  // Thưởng Học Bá tháng (sổ Xu) — bọc try/catch như các nguồn trên.
  let prizeSources: PrizeNotificationSource[] = [];
  try {
    prizeSources = await prisma.coinTransaction.findMany({
      where: { studentId, kind: "monthly_prize" },
      orderBy: { createdAt: "desc" },
      take: NOTIFICATION_LIMIT,
      select: { key: true, amount: true, note: true, createdAt: true }
    });
  } catch (error) {
    console.error("[thong-bao] Không đọc được thưởng Học Bá:", error);
  }
```

- truyền thêm `prizeSources` làm tham số cuối của `buildStudentNotifications(...)` (sau `rewardSources`).

`components/notification-list.tsx` — thêm vào `LABELS`:

```ts
  reward_rejected: "Đổi quà",
  monthly_prize: "Thưởng Học Bá"
```

- [ ] **Step 9: Chạy test + kiểm kiểu**

Run: `npx vitest run tests/leaderboard-prize.test.ts tests/notifications.test.ts tests/wallet-guard.test.ts tests/rewards-guard.test.ts tests/xp-rank.test.ts`
Expected: PASS.

Run: `npx tsc --noEmit`
Expected: không lỗi.

- [ ] **Step 10: Commit**

```bash
git add lib/coins.ts prisma/schema.prisma lib/leaderboard.ts lib/wallet.ts scripts/coins-backfill.ts app/api/cron/reminders/route.ts lib/notifications.ts lib/notifications-feed.ts components/notification-list.tsx tests/leaderboard-prize.test.ts tests/notifications.test.ts
git diff --cached --stat
git commit -m "feat(xa-hoi): thuong Xu Top 10 Hoc Ba thang - cron cong, syncWallet du phong, chuong bao

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Component bảng xếp hạng

**Files:**
- Create: `components/leaderboard/streak-tier-chip.tsx`, `components/leaderboard/leaderboard-board.tsx`, `components/leaderboard/xp-board-header.tsx`, `components/leaderboard/streak-board-header.tsx`, `components/leaderboard/ranking-switcher.tsx`

**Interfaces:**
- Consumes: Task 1 (`streakTier`, `STREAK_TIERS`, `streakTierProgress`, `rankingHref`, `RankingParams`, `RankingLinkContext`, `LeaderboardEntry`, `LeaderboardChip`, `BoardPerson`), Task 3 (`PRIZE_CHIPS`, `PRIZE_START_MONTH`); `StudentAvatar`, `RankTierBadge`; `monthNumberLabel`.
- Produces:
  - `StreakTierChip({ days, className? })`
  - `type LeaderboardLinkTarget = "student" | "teacher"`
  - `LeaderboardRow({ entry, isYou, linkTarget })` — một `<li>`
  - `LeaderboardBoard({ entries, highlightStudentId?, linkTarget, emptyText, self? })`, với `self?: { person: BoardPerson; missingText: string } | null`
  - `XpBoardHeader({ monthKey, countdownText, prevHref, nextHref })`
  - `StreakBoardHeader({ myDays: number | null })`
  - `RankingSwitcher({ params, classes, context })`

Đây là component trình bày, không có logic riêng. Kiểm bằng tsc/lint ở task này, kiểm bằng mắt ở Task 9.

- [ ] **Step 1: `components/leaderboard/streak-tier-chip.tsx`**

```tsx
import { streakTier } from "@/lib/leaderboard";

// Chip cấp lửa của bảng Chuỗi (Nhen → Bất Diệt). Chuỗi 0 ngày → không hiện gì.
export function StreakTierChip({ days, className = "" }: { days: number; className?: string }) {
  const tier = streakTier(days);
  if (!tier) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${tier.chipClass} ${className}`}
    >
      <span aria-hidden="true">🔥</span>
      {tier.name}
    </span>
  );
}
```

- [ ] **Step 2: `components/leaderboard/leaderboard-board.tsx`**

```tsx
import Link from "next/link";
import { StreakTierChip } from "@/components/leaderboard/streak-tier-chip";
import { RankTierBadge } from "@/components/rank-tier-badge";
import { StudentAvatar } from "@/components/student-avatar";
import type { BoardPerson, LeaderboardChip, LeaderboardEntry } from "@/lib/leaderboard";

// Bục Top 3 + danh sách cho bảng Học Bá / Chuỗi (Mạng xã hội Đợt 1). Dùng chung cho
// trang Xếp hạng của học viên, khối trang chủ (chỉ LeaderboardRow) và tab Chuỗi của
// giáo viên. Không có hook → import được cả từ client component.

export type LeaderboardLinkTarget = "student" | "teacher";

// Hạng 1 đứng giữa và cao nhất; avatar to hơn hạng 2/3 một bậc (giống bảng Tổng kết tháng).
const podiumStyle = [
  { ring: "ring-yellow-400", pedestal: "h-14 bg-yellow-400/25", size: "lg" as const, shine: "animate-podium-shine" },
  { ring: "ring-slate-300", pedestal: "h-10 bg-slate-300/25", size: "md" as const, shine: "" },
  { ring: "ring-amber-600", pedestal: "h-8 bg-amber-600/25", size: "md" as const, shine: "" }
];

function profileHref(studentId: string, target: LeaderboardLinkTarget): string {
  return target === "teacher" ? `/teacher/students/${studentId}` : `/student/profile/${studentId}`;
}

function ProfileLink({
  entry,
  linkTarget,
  className = ""
}: {
  entry: LeaderboardEntry;
  linkTarget: LeaderboardLinkTarget;
  className?: string;
}) {
  return (
    <Link
      href={profileHref(entry.studentId, linkTarget)}
      className={`${className} rounded transition hover:text-primary hover:underline`}
    >
      {entry.displayName}
    </Link>
  );
}

function YouChip() {
  return (
    <span className="ml-1 shrink-0 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
      Bạn
    </span>
  );
}

export function LeaderboardChipView({ chip }: { chip: LeaderboardChip }) {
  return chip.kind === "rank" ? <RankTierBadge xp={chip.xp} /> : <StreakTierChip days={chip.days} />;
}

export function LeaderboardRow({
  entry,
  isYou,
  linkTarget
}: {
  entry: LeaderboardEntry;
  isYou: boolean;
  linkTarget: LeaderboardLinkTarget;
}) {
  return (
    <li
      className={`flex items-center gap-3 rounded-xl px-3 py-2 ${
        isYou ? "bg-primary/10 ring-1 ring-primary" : "bg-border/30 dark:bg-border/20"
      }`}
    >
      <span className="w-7 shrink-0 text-center text-sm font-bold tabular-nums text-muted-foreground">
        {entry.rank}
      </span>
      <StudentAvatar
        avatarUrl={entry.avatarUrl}
        avatarPreset={entry.avatarPreset}
        userImage={entry.userImage}
        frame={entry.equippedFrame ?? null}
        displayName={entry.displayName}
        size="sm"
      />
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-center text-sm font-semibold">
          <ProfileLink entry={entry} linkTarget={linkTarget} className="truncate" />
          {isYou ? <YouChip /> : null}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <LeaderboardChipView chip={entry.chip} />
          {entry.subText ? <span className="text-[11px] text-muted-foreground">{entry.subText}</span> : null}
        </div>
      </div>
      <span className="shrink-0 text-sm font-bold tabular-nums text-primary">{entry.valueText}</span>
    </li>
  );
}

function MissingSelfRow({ person, text }: { person: BoardPerson; text: string }) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-dashed border-primary/50 px-3 py-2">
      <span className="w-7 shrink-0 text-center text-sm font-bold text-muted-foreground">–</span>
      <StudentAvatar
        avatarUrl={person.avatarUrl}
        avatarPreset={person.avatarPreset}
        userImage={person.userImage}
        frame={person.equippedFrame ?? null}
        displayName={person.displayName}
        size="sm"
      />
      <p className="flex min-w-0 flex-1 items-center text-sm font-semibold">
        <span className="truncate">{person.displayName}</span>
        <YouChip />
      </p>
      <span className="shrink-0 text-xs text-muted-foreground">{text}</span>
    </li>
  );
}

export function LeaderboardBoard({
  entries,
  highlightStudentId = null,
  linkTarget,
  emptyText,
  self = null
}: {
  entries: LeaderboardEntry[];
  highlightStudentId?: string | null;
  linkTarget: LeaderboardLinkTarget;
  emptyText: string;
  // Học viên đang xem — không có trong bảng thì ghim một dòng "Bạn" ở cuối.
  self?: { person: BoardPerson; missingText: string } | null;
}) {
  const topThree = entries.slice(0, 3);
  const rest = entries.slice(3);
  // Thứ tự hiển thị 2 - 1 - 3, chỉ lấy các bục có người.
  const podiumOrder = [1, 0, 2].filter((index) => topThree[index]);
  const selfMissing = self && !entries.some((entry) => entry.studentId === self.person.studentId);

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5">
      {entries.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <>
          <div className="flex items-end justify-center gap-2 sm:gap-4">
            {podiumOrder.map((index) => {
              const entry = topThree[index];
              const style = podiumStyle[index];
              const isYou = entry.studentId === highlightStudentId;

              return (
                <div key={entry.studentId} className="flex w-1/3 min-w-0 max-w-[9rem] flex-col items-center">
                  {index === 0 ? (
                    <span aria-hidden="true" className="text-lg leading-none">
                      👑
                    </span>
                  ) : null}
                  <StudentAvatar
                    avatarUrl={entry.avatarUrl}
                    avatarPreset={entry.avatarPreset}
                    userImage={entry.userImage}
                    frame={entry.equippedFrame ?? null}
                    displayName={entry.displayName}
                    size={style.size}
                    className={`mt-1 ring-4 ${style.ring} ${style.shine}`}
                  />
                  {/* Tên trên bục cho xuống tối đa 2 dòng — tên Việt dài. */}
                  <p className="mt-2 line-clamp-2 max-w-full break-words text-center text-xs font-semibold leading-4">
                    <ProfileLink entry={entry} linkTarget={linkTarget} />
                    {isYou ? <YouChip /> : null}
                  </p>
                  <p className="text-xs font-bold tabular-nums text-primary">{entry.valueText}</p>
                  <div className="mt-1">
                    <LeaderboardChipView chip={entry.chip} />
                  </div>
                  {entry.subText ? (
                    <p className="mt-0.5 text-center text-[11px] text-muted-foreground">{entry.subText}</p>
                  ) : null}
                  <div
                    className={`mt-1.5 flex w-full items-start justify-center rounded-t-lg ${style.pedestal}`}
                  >
                    <span className="mt-1 text-sm font-bold tabular-nums">{entry.rank}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {rest.length > 0 ? (
            <ol className="mt-4 space-y-1.5">
              {rest.map((entry) => (
                <LeaderboardRow
                  key={entry.studentId}
                  entry={entry}
                  isYou={entry.studentId === highlightStudentId}
                  linkTarget={linkTarget}
                />
              ))}
            </ol>
          ) : null}
        </>
      )}

      {self && selfMissing ? (
        <ol className="mt-3">
          <MissingSelfRow person={self.person} text={self.missingText} />
        </ol>
      ) : null}
    </section>
  );
}
```

- [ ] **Step 3: `components/leaderboard/xp-board-header.tsx`**

```tsx
import Link from "next/link";
import { PRIZE_CHIPS, PRIZE_START_MONTH } from "@/lib/leaderboard";
import { monthNumberLabel } from "@/lib/monthly-recap";

const NAV = "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border text-lg font-semibold transition hover:bg-muted";
const NAV_OFF = "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg text-muted-foreground/30";

// Phần đầu bảng Học Bá: tên tháng, đếm ngược, giải thưởng, lùi/tới tháng.
export function XpBoardHeader({
  monthKey,
  countdownText,
  prevHref,
  nextHref
}: {
  monthKey: string;
  countdownText: string | null; // null = tháng đã kết thúc
  prevHref: string | null;
  nextHref: string | null;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-lg font-bold">
            <span aria-hidden="true">🏆</span>
            Học Bá tháng {monthNumberLabel(monthKey)}
          </h3>
          <p className="text-sm text-muted-foreground">Tổng XP học tập trong tháng</p>
        </div>
        <p className="shrink-0 rounded-lg bg-muted px-3 py-1.5 text-xs font-semibold tabular-nums">
          {countdownText ? `Kết thúc sau ${countdownText}` : "Đã kết thúc"}
        </p>
      </div>

      {monthKey >= PRIZE_START_MONTH ? (
        <>
          <ul className="mt-3 flex flex-wrap gap-2">
            {PRIZE_CHIPS.map((chip) => (
              <li
                key={chip.label}
                className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
              >
                {chip.label} · {chip.text}
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Giải xét theo bảng Toàn trường, tự cộng Xu ngày đầu tháng sau.
          </p>
        </>
      ) : null}

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
        {prevHref ? (
          <Link href={prevHref} aria-label="Tháng trước" className={NAV}>
            <span aria-hidden="true">‹</span>
          </Link>
        ) : (
          <span aria-hidden="true" className={NAV_OFF}>
            ‹
          </span>
        )}
        <p className="text-sm font-semibold">
          Tháng {monthNumberLabel(monthKey)}
          {countdownText ? <span className="ml-1 text-primary">· hiện tại</span> : null}
        </p>
        {nextHref ? (
          <Link href={nextHref} aria-label="Tháng sau" className={NAV}>
            <span aria-hidden="true">›</span>
          </Link>
        ) : (
          <span aria-hidden="true" className={NAV_OFF}>
            ›
          </span>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: `components/leaderboard/streak-board-header.tsx`**

```tsx
import { STREAK_TIERS, streakTierProgress } from "@/lib/leaderboard";

// Phần đầu bảng Chuỗi: dải 7 cấp lửa + còn bao nhiêu ngày lên cấp. myDays null = giáo
// viên xem (không có chuỗi riêng → không tô cấp, không có dòng tiến trình).
export function StreakBoardHeader({ myDays }: { myDays: number | null }) {
  const progress = myDays === null ? null : streakTierProgress(myDays);

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5">
      <h3 className="flex items-center gap-2 text-lg font-bold">
        <span aria-hidden="true">🔥</span>
        Chuỗi ngày học
      </h3>
      <p className="text-sm text-muted-foreground">
        Học mỗi ngày để giữ lửa — nộp một phần bài hoặc ôn một thẻ Sổ từ là tính.
      </p>

      <ol className="mt-3 grid grid-cols-7 gap-1 text-center">
        {STREAK_TIERS.map((tier) => {
          const reached = myDays !== null && myDays >= tier.minDays;
          const isCurrent = progress?.current?.key === tier.key;

          return (
            <li key={tier.key} className={`rounded-lg px-0.5 py-2 ${isCurrent ? "bg-primary/10 ring-1 ring-primary" : ""}`}>
              <span
                aria-hidden="true"
                className={`block text-lg leading-none ${reached || myDays === null ? "" : "opacity-30 grayscale"}`}
              >
                🔥
              </span>
              <span className="mt-1 block text-[10px] font-semibold leading-tight sm:text-xs">{tier.name}</span>
              <span className="block text-[10px] text-muted-foreground">{tier.minDays}+</span>
            </li>
          );
        })}
      </ol>

      {progress ? (
        <p className="mt-3 text-sm">
          {progress.next && progress.daysToNext !== null ? (
            <>
              Còn <span className="font-bold">{progress.daysToNext} ngày</span> nữa là lên{" "}
              <span className="font-bold">{progress.next.name}</span>.
            </>
          ) : (
            "Bạn đã ở cấp lửa cao nhất — Bất Diệt! 🏆"
          )}
        </p>
      ) : null}
    </section>
  );
}
```

- [ ] **Step 5: `components/leaderboard/ranking-switcher.tsx`**

```tsx
import Link from "next/link";
import { rankingHref, type RankingLinkContext, type RankingParams } from "@/lib/leaderboard";

const BOARDS = [
  { key: "xp", label: "🏆 Học Bá" },
  { key: "streak", label: "🔥 Chuỗi" },
  { key: "class", label: "📊 Điểm lớp" }
] as const;

function tabClass(active: boolean): string {
  return `rounded-lg px-3 py-2 text-center text-sm font-semibold transition ${
    active ? "bg-card text-foreground shadow-card" : "text-muted-foreground hover:text-foreground"
  }`;
}

// Chọn bảng / phạm vi / lớp — toàn bộ là link (?board=&scope=&classId=), không cần JS.
export function RankingSwitcher({
  params,
  classes,
  context
}: {
  params: RankingParams;
  classes: { id: string; name: string }[];
  context: RankingLinkContext;
}) {
  const showScope = params.board !== "class";
  const showClasses = classes.length > 1 && (params.board === "class" || params.scope === "class");

  return (
    <div className="space-y-3">
      <nav
        aria-label="Chọn bảng xếp hạng"
        className="grid grid-cols-3 rounded-xl border border-border bg-border/30 p-1 dark:bg-border/20"
      >
        {BOARDS.map((board) => (
          <Link
            key={board.key}
            href={rankingHref({ ...params, board: board.key }, context)}
            className={tabClass(params.board === board.key)}
          >
            {board.label}
          </Link>
        ))}
      </nav>

      {showScope ? (
        <nav
          aria-label="Phạm vi"
          className="inline-flex rounded-xl border border-border bg-border/30 p-1 dark:bg-border/20"
        >
          <Link href={rankingHref({ ...params, scope: "class" }, context)} className={tabClass(params.scope === "class")}>
            Lớp
          </Link>
          <Link href={rankingHref({ ...params, scope: "school" }, context)} className={tabClass(params.scope === "school")}>
            Toàn trường
          </Link>
        </nav>
      ) : null}

      {showClasses ? (
        <div className="flex flex-wrap gap-2">
          {classes.map((classItem) => (
            <Link
              key={classItem.id}
              href={rankingHref({ ...params, classId: classItem.id }, context)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                classItem.id === params.classId
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {classItem.name}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 6: Kiểm kiểu + lint**

Run: `npx tsc --noEmit` rồi `pnpm lint`
Expected: không lỗi mới.

- [ ] **Step 7: Commit**

```bash
git add components/leaderboard
git diff --cached --stat
git commit -m "feat(xa-hoi): component bang xep hang - buc, dong, chip cap lua, dau bang Hoc Ba/Chuoi, thanh chon

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Trang `/student/ranking` mới + link hồ sơ ở Tổng kết tháng

**Files:**
- Modify (viết lại): `app/student/ranking/page.tsx`
- Modify: `components/monthly-recap-board.tsx`, `components/monthly-recap-panel.tsx`
- Test: `tests/leaderboard-guard.test.ts` (thêm), `tests/ranking-link-guard.test.ts` (đang có, phải giữ xanh)

**Interfaces:**
- Consumes: Task 1–4; `getClassRanking`, `ClassRankingBoard`, `getMonthlyRecap`, `getLifetimeXpMap`, `monthKeyOf`.
- Produces: trang theo đúng tham số ở Task 1. `MonthlyRecapBoard` nhận `profileLinkTarget?: "teacher" | "student"`.

- [ ] **Step 1: Thêm test cấu trúc (sẽ đỏ)**

Thêm vào cuối `tests/leaderboard-guard.test.ts`:

```ts
describe("trang Xếp hạng học viên", () => {
  const page = read("app/student/ranking/page.tsx");

  it("có đủ 3 bảng và lấy tham số qua resolveRankingParams", () => {
    expect(page).toContain("resolveRankingParams(");
    expect(page).toContain("<XpBoardHeader");
    expect(page).toContain("<StreakBoardHeader");
    expect(page).toContain("<ClassRankingBoard");
  });

  it("bảng Học Bá/Chuỗi link sang hồ sơ học viên, không sang trang giáo viên", () => {
    expect(page).toMatch(/<LeaderboardBoard[^>]*linkTarget="student"/);
    expect(page).not.toContain('linkTarget="teacher"');
  });

  it("Tổng kết tháng của học viên link tên sang hồ sơ", () => {
    expect(read("components/monthly-recap-panel.tsx")).toContain('profileLinkTarget="student"');
  });
});
```

Run: `npx vitest run tests/leaderboard-guard.test.ts`
Expected: FAIL ở 3 test mới.

- [ ] **Step 2: Viết lại `app/student/ranking/page.tsx`**

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { ClassRankingBoard } from "@/components/class-ranking-board";
import { LeaderboardBoard } from "@/components/leaderboard/leaderboard-board";
import { RankingSwitcher } from "@/components/leaderboard/ranking-switcher";
import { StreakBoardHeader } from "@/components/leaderboard/streak-board-header";
import { XpBoardHeader } from "@/components/leaderboard/xp-board-header";
import { auth } from "@/lib/auth";
import { getClassRanking } from "@/lib/class-ranking";
import {
  formatCountdown,
  monthEndsIn,
  rankingHref,
  rankingMonthNav,
  resolveRankingParams,
  streakBoardEntries,
  xpBoardEntries,
  type BoardPerson
} from "@/lib/leaderboard";
import { classMemberIds, getStreakBoard } from "@/lib/leaderboard-data";
import { monthKeyOf } from "@/lib/monthly-recap";
import { getMonthlyRecap } from "@/lib/monthly-recap-data";
import { prisma } from "@/lib/prisma";
import { getLifetimeXpMap } from "@/lib/xp-rank-data";

export const dynamic = "force-dynamic";

const DESCRIPTIONS = {
  xp: "XP cộng từ mọi lần nộp bài và ôn thẻ trong tháng — bảng làm mới vài phút một lần.",
  streak: "Số ngày học liên tiếp tính tới hôm nay. Hôm nay chưa học vẫn chưa mất chuỗi.",
  class: "Điểm xếp hạng kết hợp điểm trung bình, mức độ hoàn thành và hoạt động gần đây — chỉ trong lớp."
} as const;

function NoClass() {
  return (
    <div className="rounded-xl border border-border bg-card px-5 py-12 text-center shadow-card">
      <p className="text-sm font-medium">Bạn chưa thuộc lớp nào</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Chọn “Toàn trường” để so tài với cả trường, hoặc chờ thầy thêm bạn vào lớp.
      </p>
    </div>
  );
}

// Bảng xếp hạng kiểu chin (Mạng xã hội Đợt 1): Học Bá (XP tháng) · Chuỗi 🔥 · Điểm lớp.
export default async function StudentRankingPage({
  searchParams
}: {
  searchParams?: { board?: string; scope?: string; classId?: string; month?: string };
}) {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "student") {
    redirect("/login");
  }

  const student = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      displayName: true,
      avatarUrl: true,
      avatarPreset: true,
      equippedFrame: true,
      user: { select: { image: true } }
    }
  });

  if (!student) {
    redirect("/waiting");
  }

  const memberships = await prisma.classStudent.findMany({
    where: { studentId: student.id },
    orderBy: { joinedAt: "desc" },
    select: { class: { select: { id: true, name: true } } }
  });
  const classes = memberships.map((membership) => membership.class);

  const now = new Date();
  const latestMonth = monthKeyOf(now);
  const context = { latestMonth, defaultClassId: classes[0]?.id ?? null };
  const params = resolveRankingParams(searchParams, {
    classIds: classes.map((classItem) => classItem.id),
    latestMonth
  });
  const selectedClass = classes.find((classItem) => classItem.id === params.classId) ?? null;

  const me: BoardPerson = {
    studentId: student.id,
    displayName: student.displayName,
    avatarUrl: student.avatarUrl,
    avatarPreset: student.avatarPreset,
    userImage: student.user?.image ?? null,
    equippedFrame: student.equippedFrame
  };

  let body: JSX.Element;

  if (params.board === "class") {
    body = selectedClass ? (
      <ClassRankingBoard
        students={await getClassRanking(selectedClass.id)}
        highlightStudentId={student.id}
        profileLinkTarget="classmate"
      />
    ) : (
      <NoClass />
    );
  } else if (params.scope === "class" && !selectedClass) {
    body = <NoClass />;
  } else {
    const members = params.scope === "class" && selectedClass ? await classMemberIds(selectedClass.id) : null;
    const where = members && selectedClass ? `Lớp ${selectedClass.name}` : "Cả trường";

    if (params.board === "xp") {
      const recap = await getMonthlyRecap(params.monthKey, now);
      const lifetimeXp = await getLifetimeXpMap(recap.xpBoard.map((entry) => entry.studentId));
      const nav = rankingMonthNav(params.monthKey, latestMonth);

      body = (
        <>
          <XpBoardHeader
            monthKey={params.monthKey}
            countdownText={params.monthKey === latestMonth ? formatCountdown(monthEndsIn(now)) : null}
            prevHref={nav.prev ? rankingHref({ ...params, monthKey: nav.prev }, context) : null}
            nextHref={nav.next ? rankingHref({ ...params, monthKey: nav.next }, context) : null}
          />
          <LeaderboardBoard
            entries={xpBoardEntries(recap.xpBoard, members, lifetimeXp)}
            highlightStudentId={student.id}
            linkTarget="student"
            emptyText={`${where} chưa ai có XP tháng này.`}
            self={{ person: me, missingText: "chưa có XP tháng này" }}
          />
        </>
      );
    } else {
      const rows = await getStreakBoard(now);
      const myDays = rows.find((row) => row.studentId === student.id)?.days ?? 0;

      body = (
        <>
          <StreakBoardHeader myDays={myDays} />
          <LeaderboardBoard
            entries={streakBoardEntries(rows, members)}
            highlightStudentId={student.id}
            linkTarget="student"
            emptyText={`${where} chưa ai giữ được chuỗi — học hôm nay để nhóm lửa!`}
            self={{ person: me, missingText: "chưa có chuỗi" }}
          />
        </>
      );
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold text-primary">Bảng xếp hạng</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Xếp hạng</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{DESCRIPTIONS[params.board]}</p>
        <Link href="/student/ranks" className="mt-2 inline-block text-sm font-semibold text-primary hover:underline">
          Xem hệ thống hạng đấu →
        </Link>
      </header>

      <div className="mx-auto max-w-3xl space-y-4">
        <RankingSwitcher params={params} classes={classes} context={context} />
        {body}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `MonthlyRecapBoard` cho học viên bấm tên sang hồ sơ**

Trong `components/monthly-recap-board.tsx`, sửa kiểu prop và comment:

```tsx
  // Đích khi bấm tên: giáo viên → trang học viên; học viên → hồ sơ (mở toàn trường từ
  // Mạng xã hội Đợt 1). Không truyền → chỉ là chữ.
  profileLinkTarget?: "teacher" | "student";
```

Trong hàm `Name`, thêm nhánh `student` ngay sau nhánh `teacher`:

```tsx
    if (profileLinkTarget === "student") {
      return (
        <Link
          href={`/student/profile/${entry.studentId}`}
          className={`${className} rounded transition hover:text-primary hover:underline`}
        >
          {entry.displayName}
        </Link>
      );
    }
```

Trong `components/monthly-recap-panel.tsx`, thêm `profileLinkTarget="student"` vào CẢ HAI thẻ `<MonthlyRecapBoard ... />` (bảng XP và bảng Chăm nhất).

- [ ] **Step 4: Chạy test + kiểm kiểu**

Run: `npx vitest run tests/leaderboard-guard.test.ts tests/ranking-link-guard.test.ts tests/wallet-guard.test.ts`
Expected: PASS.

Run: `npx tsc --noEmit`
Expected: không lỗi.

- [ ] **Step 5: Commit**

```bash
git add app/student/ranking/page.tsx components/monthly-recap-board.tsx components/monthly-recap-panel.tsx tests/leaderboard-guard.test.ts
git diff --cached --stat
git commit -m "feat(xa-hoi): trang Xep hang 3 bang Hoc Ba/Chuoi/Diem lop, pham vi Lop/Toan truong

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Khối bảng xếp hạng ở trang chủ

**Files:**
- Modify: `lib/leaderboard.ts` (thêm kiểu `HomeBoardView`, `HomeLeaderboardData`)
- Modify: `lib/leaderboard-data.ts` (thêm `getHomeLeaderboard`)
- Create: `components/leaderboard/home-leaderboard-card.tsx`
- Modify: `app/student/page.tsx`
- Test: `tests/leaderboard-guard.test.ts` (thêm)

**Interfaces:**
- Consumes: `boardWindow`, `xpBoardEntries`, `streakBoardEntries` (Task 1), `getStreakBoard` (Task 2), `getMonthlyRecap`, `getLifetimeXpMap`, `LeaderboardRow` (Task 4).
- Produces: `type HomeBoardView = { top: LeaderboardEntry[]; me: LeaderboardEntry | null; inBoard: boolean; href: string }`, `type HomeLeaderboardData = { monthKey: string; xp: HomeBoardView; streak: HomeBoardView }`, `getHomeLeaderboard(studentId, now?): Promise<HomeLeaderboardData | null>` (tự nuốt lỗi), `HomeLeaderboardCard({ data, studentId })`.

- [ ] **Step 1: Thêm test cấu trúc (sẽ đỏ)**

Thêm vào cuối `tests/leaderboard-guard.test.ts`:

```ts
describe("khối bảng xếp hạng ở trang chủ", () => {
  it("getHomeLeaderboard tự nuốt lỗi — trang chủ không bao giờ sập vì bảng", () => {
    const source = read("lib/leaderboard-data.ts");
    expect(source).toMatch(/export async function getHomeLeaderboard[\s\S]*?try \{[\s\S]*?catch \(error\)/);
  });

  it("trang chủ hiện khối sau hàng thẻ chuỗi/hạng, trước thẻ Từ vựng", () => {
    const page = read("app/student/page.tsx");
    expect(page).toContain("getHomeLeaderboard(student.id)");
    const card = page.indexOf("<HomeLeaderboardCard");
    expect(card).toBeGreaterThan(page.indexOf("<ProgressRing"));
    expect(card).toBeLessThan(page.indexOf("<VocabCard"));
  });
});
```

Run: `npx vitest run tests/leaderboard-guard.test.ts`
Expected: FAIL ở 2 test mới.

- [ ] **Step 2: Kiểu dữ liệu trong `lib/leaderboard.ts`**

Thêm ngay sau hàm `boardWindow`:

```ts
// Dữ liệu khối trang chủ (đi qua JSON tới client component).
export type HomeBoardView = {
  top: LeaderboardEntry[];
  me: LeaderboardEntry | null; // dòng của mình khi đứng ngoài top
  inBoard: boolean; // false = mình chưa có XP / chưa có chuỗi
  href: string;
};

export type HomeLeaderboardData = { monthKey: string; xp: HomeBoardView; streak: HomeBoardView };
```

- [ ] **Step 3: `getHomeLeaderboard` trong `lib/leaderboard-data.ts`**

Sửa import từ `@/lib/leaderboard` thành:

```ts
import {
  LEADERBOARD_CACHE_TAG,
  boardWindow,
  schoolDayStreaks,
  streakBoardEntries,
  xpBoardEntries,
  type BoardPerson,
  type HomeBoardView,
  type HomeLeaderboardData,
  type LeaderboardEntry,
  type StreakBoardSource
} from "@/lib/leaderboard";
```

Thêm import:

```ts
import { monthKeyOf } from "@/lib/monthly-recap";
import { getMonthlyRecap } from "@/lib/monthly-recap-data";
import { getLifetimeXpMap } from "@/lib/xp-rank-data";
```

Thêm vào cuối file:

```ts
const HOME_TOP = 5;

function homeView(entries: LeaderboardEntry[], studentId: string, href: string): HomeBoardView {
  return {
    ...boardWindow(entries, studentId, HOME_TOP),
    inBoard: entries.some((entry) => entry.studentId === studentId),
    href
  };
}

// Khối Top 5 + mình ở trang chủ (toàn trường). Lỗi → null, trang chủ vẫn chạy.
export async function getHomeLeaderboard(
  studentId: string,
  now: Date = new Date()
): Promise<HomeLeaderboardData | null> {
  try {
    const monthKey = monthKeyOf(now);
    const [recap, streakRows] = await Promise.all([getMonthlyRecap(monthKey, now), getStreakBoard(now)]);
    // Chip hạng đấu chỉ cần cho những dòng sẽ hiện: top 5 + chính mình.
    const lifetimeXp = await getLifetimeXpMap(
      recap.xpBoard
        .slice(0, HOME_TOP)
        .map((entry) => entry.studentId)
        .concat(studentId)
    );

    return {
      monthKey,
      xp: homeView(xpBoardEntries(recap.xpBoard, null, lifetimeXp), studentId, "/student/ranking"),
      streak: homeView(streakBoardEntries(streakRows, null), studentId, "/student/ranking?board=streak")
    };
  } catch (error) {
    console.error("[bang-xep-hang] không tính được khối trang chủ", error);
    return null;
  }
}
```

- [ ] **Step 4: `components/leaderboard/home-leaderboard-card.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { LeaderboardRow } from "@/components/leaderboard/leaderboard-board";
import type { HomeLeaderboardData } from "@/lib/leaderboard";

// Khối bảng xếp hạng thu nhỏ ở trang chủ (kiểu chin): 2 tab Học Bá / Chuỗi, toàn
// trường, Top 5 + dòng của mình. Server đưa sẵn cả hai danh sách → đổi tab không tải lại.
export function HomeLeaderboardCard({ data, studentId }: { data: HomeLeaderboardData; studentId: string }) {
  const [tab, setTab] = useState<"xp" | "streak">("xp");
  const view = data[tab];
  const monthNumber = Number(data.monthKey.slice(5));

  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold">Bảng xếp hạng toàn trường</h3>
        <Link href={view.href} className="shrink-0 text-sm font-semibold text-primary hover:underline">
          Xem tất cả →
        </Link>
      </div>

      <div
        role="tablist"
        aria-label="Chọn bảng"
        className="mt-3 grid grid-cols-2 rounded-lg border border-border bg-border/30 p-1 dark:bg-border/20"
      >
        {(["xp", "streak"] as const).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${
              tab === key ? "bg-card text-foreground shadow-card" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {key === "xp" ? `🏆 Học Bá tháng ${monthNumber}` : "🔥 Chuỗi"}
          </button>
        ))}
      </div>

      {view.top.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {tab === "xp"
            ? "Tháng này chưa ai có XP — làm bài đầu tiên để lên bảng!"
            : "Chưa ai giữ được chuỗi — học hôm nay để nhóm lửa!"}
        </p>
      ) : (
        <ol className="mt-3 space-y-1.5">
          {view.top.map((entry) => (
            <LeaderboardRow
              key={entry.studentId}
              entry={entry}
              isYou={entry.studentId === studentId}
              linkTarget="student"
            />
          ))}
          {view.me ? (
            <>
              <li aria-hidden="true" className="text-center text-xs leading-none text-muted-foreground">
                ⋯
              </li>
              <LeaderboardRow entry={view.me} isYou linkTarget="student" />
            </>
          ) : null}
        </ol>
      )}

      {!view.inBoard && view.top.length > 0 ? (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          {tab === "xp" ? "Bạn chưa có XP tháng này." : "Bạn chưa có chuỗi — học hôm nay để bắt đầu."}
        </p>
      ) : null}
    </section>
  );
}
```

- [ ] **Step 5: Gắn vào `app/student/page.tsx`**

Thêm import:

```tsx
import { HomeLeaderboardCard } from "@/components/leaderboard/home-leaderboard-card";
import { getHomeLeaderboard } from "@/lib/leaderboard-data";
```

Trong `Promise.all`, thêm biến `homeBoard` vào cuối danh sách destructure:

```tsx
  const [recipients, lifetimeXp, dayStreak, wordOfDay, vocabSidebar, schedule, vocabToday, recapPopup, homeBoard] =
```

và thêm phần tử cuối vào mảng (sau `getStudentRecapPopup(student.id)`):

```tsx
    getStudentRecapPopup(student.id),
    // Bảng xếp hạng thu nhỏ — lỗi thì trả null, không làm hỏng trang chủ.
    getHomeLeaderboard(student.id)
```

Giữa thẻ đóng `</div>` của lưới `grid gap-3 sm:grid-cols-2 lg:grid-cols-3` (chứa `<ProgressRing ... />`) và `<VocabCard`, chèn:

```tsx
      {homeBoard ? <HomeLeaderboardCard data={homeBoard} studentId={student.id} /> : null}
```

- [ ] **Step 6: Chạy test + kiểm kiểu**

Run: `npx vitest run tests/leaderboard-guard.test.ts tests/wallet-guard.test.ts`
Expected: PASS.

Run: `npx tsc --noEmit`
Expected: không lỗi.

- [ ] **Step 7: Commit**

```bash
git add lib/leaderboard.ts lib/leaderboard-data.ts components/leaderboard/home-leaderboard-card.tsx app/student/page.tsx tests/leaderboard-guard.test.ts
git diff --cached --stat
git commit -m "feat(xa-hoi): khoi bang xep hang toan truong o trang chu - Top 5 + minh, 2 tab

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Hồ sơ mở toàn trường + lịch chăm học chung nguồn

**Files:**
- Modify: `lib/attendance.ts` (thêm `buildAttendanceMonthFromKeys`, `buildAttendanceMonth` gọi lại nó)
- Create: `lib/profile-activity.ts`, `components/profile-month-activity.tsx`
- Modify (viết lại): `app/student/profile/[studentId]/page.tsx`
- Modify: `app/student/profile/page.tsx`, `components/profile-side-cards.tsx` (comment)
- Test: `tests/attendance.test.ts` (thêm), `tests/profile-activity.test.ts` (mới), `tests/profile-visibility.test.ts` (viết lại)

**Interfaces:**
- Consumes: `loadActivityDays`, `getDayStreak` (`lib/day-streak-data.ts`); `ActivityDay`, `activeDayKeys` (`lib/activity-heatmap.ts`); `daysInMonth`, `isMonthKey`, `monthKeyOf`, `shiftMonthKey`; `StreakTierChip` (Task 4); `StatGrid`, `RankCard`, `MascotCard`, `AttendanceCalendar`, `ProfileHero`, `RankTierBadge`.
- Produces:
  - `buildAttendanceMonthFromKeys({ activeKeys: Iterable<string>; monthKey: string }): AttendanceMonth`
  - `type BusiestDay = { dayKey; submits; vocabCards }`, `type MonthActivitySummary = { attendance; activeDays; ratePercent; busiest: BusiestDay | null }`
  - `resolveProfileMonth(param, latest): string`, `summarizeMonthActivity(days, monthKey, today): MonthActivitySummary`, `busiestDayLabel(day): string`
  - `ProfileMonthActivity({ summary, streakDays, prevHref, nextHref })`

- [ ] **Step 1: Viết test (sẽ đỏ)**

Thêm vào cuối `tests/attendance.test.ts`:

```ts
describe("buildAttendanceMonthFromKeys", () => {
  it("nhận thẳng khoá ngày, lưới bắt đầu Thứ 2", () => {
    const result = buildAttendanceMonthFromKeys({ activeKeys: ["2026-10-02", "2026-09-30"], monthKey: "2026-10" });
    expect(result.year).toBe(2026);
    expect(result.month).toBe(10);
    expect(result.days).toHaveLength(31);
    // 1/10/2026 là Thứ 5 → 3 ô trống (T2, T3, T4).
    expect(result.leadingBlanks).toBe(3);
    expect(result.days[1]).toEqual({ day: 2, active: true });
    expect(result.days.filter((day) => day.active)).toHaveLength(1);
  });

  it("buildAttendanceMonth cũ vẫn ra cùng kết quả", () => {
    const viaDates = buildAttendanceMonth({
      submittedAt: [new Date("2026-10-02T09:00:00+07:00")],
      vocabDays: [],
      month: new Date("2026-10-15T12:00:00Z")
    });
    expect(viaDates).toEqual(buildAttendanceMonthFromKeys({ activeKeys: ["2026-10-02"], monthKey: "2026-10" }));
  });
});
```

và đổi dòng import đầu file thành:

```ts
import { buildAttendanceMonth, buildAttendanceMonthFromKeys, vnDateKey } from "../lib/attendance";
```

Tạo `tests/profile-activity.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { ActivityDay } from "@/lib/activity-heatmap";
import { busiestDayLabel, resolveProfileMonth, summarizeMonthActivity } from "@/lib/profile-activity";

const day = (submits: number, vocabCards: number, count: number): ActivityDay => ({ submits, vocabCards, count });

describe("summarizeMonthActivity", () => {
  const days = new Map<string, ActivityDay>([
    ["2026-09-30", day(1, 0, 1)],
    ["2026-10-01", day(1, 0, 1)],
    ["2026-10-02", day(3, 20, 5)],
    ["2026-10-04", day(0, 4, 1)]
  ]);

  it("tháng hiện tại: tỉ lệ = ngày học / số ngày đã qua", () => {
    const summary = summarizeMonthActivity(days, "2026-10", "2026-10-05");
    expect(summary.activeDays).toBe(3);
    expect(summary.ratePercent).toBe(60); // 3/5
    expect(summary.attendance.days.filter((cell) => cell.active).map((cell) => cell.day)).toEqual([1, 2, 4]);
    expect(summary.busiest).toEqual({ dayKey: "2026-10-02", submits: 3, vocabCards: 20 });
  });

  it("tháng đã qua: tỉ lệ = ngày học / số ngày của tháng", () => {
    const summary = summarizeMonthActivity(days, "2026-09", "2026-10-05");
    expect(summary.activeDays).toBe(1);
    expect(summary.ratePercent).toBe(3); // 1/30
  });

  it("tháng không học ngày nào", () => {
    const summary = summarizeMonthActivity(days, "2026-08", "2026-10-05");
    expect(summary).toMatchObject({ activeDays: 0, ratePercent: 0, busiest: null });
  });
});

describe("busiestDayLabel", () => {
  it("ghi thứ, ngày và số việc", () => {
    expect(busiestDayLabel({ dayKey: "2026-10-02", submits: 3, vocabCards: 20 })).toBe(
      "Thứ 6 (02/10): 3 phần bài · 20 thẻ"
    );
    expect(busiestDayLabel({ dayKey: "2026-10-04", submits: 0, vocabCards: 4 })).toBe("Chủ nhật (04/10): 4 thẻ");
  });
});

describe("resolveProfileMonth", () => {
  it("nhận tháng hợp lệ không vượt hiện tại, còn lại về tháng hiện tại", () => {
    expect(resolveProfileMonth("2026-08", "2026-10")).toBe("2026-08");
    expect(resolveProfileMonth("2026-11", "2026-10")).toBe("2026-10");
    expect(resolveProfileMonth("abc", "2026-10")).toBe("2026-10");
    expect(resolveProfileMonth(undefined, "2026-10")).toBe("2026-10");
  });
});
```

Viết lại toàn bộ `tests/profile-visibility.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(
  join(process.cwd(), "app", "student", "profile", "[studentId]", "page.tsx"),
  "utf8"
);

// LỊCH SỬ: trước 5/10/2026 trang này chỉ cho xem bạn CHUNG LỚP và chỉ hiện tên hạng.
// Mạng xã hội Đợt 1 (spec 2026-10-05-xa-hoi-dot-1) mở cho cả trường và hiện thêm XP,
// chuỗi, lịch chăm học — nhưng band, mục tiêu, bài làm và số dư ví vẫn là chuyện riêng.
describe("hồ sơ học viên khác (mở toàn trường)", () => {
  it("chỉ học viên đã đăng nhập mới xem được", () => {
    expect(source).toContain('session.user.role !== "student"');
    expect(source).toContain('redirect("/login")');
  });

  it("không còn giới hạn chung lớp", () => {
    expect(source).not.toMatch(/classes:\s*\{\s*some:/);
  });

  it("gọi notFound khi không tìm thấy, mở chính mình thì về /student/profile", () => {
    expect(source).toContain("notFound()");
    expect(source).toContain('redirect("/student/profile")');
  });

  it("không tính band / mục tiêu band", () => {
    expect(source).not.toContain("bandsBySkill");
    expect(source).not.toContain("averageBandsBySkill");
    expect(source).not.toContain("targetBand");
    expect(source).not.toContain("formatBand");
  });

  it("không đụng tới Answer / AttemptSkill — chi tiết bài làm là chuyện riêng", () => {
    expect(source).not.toContain("answers:");
    expect(source).not.toContain("attemptSkill:");
  });

  it("không lộ số dư ví", () => {
    expect(source).not.toMatch(/\bcoins\b/);
    expect(source).not.toContain("StudentWalletSummary");
  });

  it("XP, chuỗi, lịch lấy qua các nguồn dùng chung", () => {
    expect(source).toMatch(/getLifetimeXp\(/);
    expect(source).toMatch(/getDayStreak\(/);
    expect(source).toMatch(/loadActivityDays\(/);
    expect(source).toMatch(/summarizeMonthActivity\(/);
    expect(source).toMatch(/<RankCard[^>]*showXp/);
  });
});
```

Run: `npx vitest run tests/attendance.test.ts tests/profile-activity.test.ts tests/profile-visibility.test.ts`
Expected: FAIL (thiếu hàm / trang cũ còn `classes: { some`).

- [ ] **Step 2: `buildAttendanceMonthFromKeys` trong `lib/attendance.ts`**

Thay thân hàm `buildAttendanceMonth` bằng phiên bản gọi hàm mới, rồi thêm hàm mới ngay dưới:

```ts
export function buildAttendanceMonth(input: {
  submittedAt: Date[];
  vocabDays: Date[];
  month: Date;
}): AttendanceMonth {
  const shifted = new Date(input.month.getTime() + VN_OFFSET_MS);
  const monthKey = `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;

  const activeKeys = new Set<string>();
  for (const date of input.submittedAt) {
    activeKeys.add(vnDateKey(date));
  }
  for (const date of input.vocabDays) {
    activeKeys.add(vnDateKey(date));
  }

  return buildAttendanceMonthFromKeys({ activeKeys, monthKey });
}

// Cùng lưới tháng, nhận thẳng khoá ngày "YYYY-MM-DD" đã có học — dùng với
// loadActivityDays (cùng nguồn với chuỗi 🔥). monthKey dạng "YYYY-MM".
export function buildAttendanceMonthFromKeys(input: {
  activeKeys: Iterable<string>;
  monthKey: string;
}): AttendanceMonth {
  const [year, month] = input.monthKey.split("-").map(Number);
  // Ngày 0 của tháng sau = ngày cuối của tháng này.
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  // getUTCDay: 0=CN, 1=T2... Lưới bắt đầu Thứ 2 nên CN phải là cột thứ 7.
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const leadingBlanks = (firstWeekday + 6) % 7;
  const active = new Set(input.activeKeys);

  const days = Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    return { day, active: active.has(`${input.monthKey}-${String(day).padStart(2, "0")}`) };
  });

  return { year, month, leadingBlanks, days };
}
```

- [ ] **Step 3: `lib/profile-activity.ts`**

```ts
import type { ActivityDay } from "@/lib/activity-heatmap";
import { buildAttendanceMonthFromKeys, type AttendanceMonth } from "@/lib/attendance";
import { daysInMonth, isMonthKey } from "@/lib/monthly-recap";

// Lịch chăm học theo tháng trên hồ sơ (kiểu "Bảng theo dõi đốt thuyền" của chin).
// Logic thuần — ngày có học lấy từ loadActivityDays (cùng nguồn với chuỗi 🔥).

export type BusiestDay = { dayKey: string; submits: number; vocabCards: number };

export type MonthActivitySummary = {
  attendance: AttendanceMonth;
  activeDays: number;
  ratePercent: number;
  busiest: BusiestDay | null;
};

const WEEKDAYS = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];

// "YYYY-MM" hợp lệ và không vượt tháng hiện tại; sai → tháng hiện tại (không lỗi trang).
export function resolveProfileMonth(param: unknown, latest: string): string {
  return isMonthKey(param) && param <= latest ? param : latest;
}

export function summarizeMonthActivity(
  days: ReadonlyMap<string, ActivityDay>,
  monthKey: string,
  today: string
): MonthActivitySummary {
  const prefix = `${monthKey}-`;
  const inMonth = Array.from(days.entries())
    .filter(([key, day]) => key.startsWith(prefix) && day.count > 0)
    .sort(([a], [b]) => a.localeCompare(b));

  // Tháng đang diễn ra: chia cho số ngày đã qua (kể cả hôm nay); tháng cũ: cả tháng.
  const elapsed = monthKey === today.slice(0, 7) ? Number(today.slice(8, 10)) : daysInMonth(monthKey);

  let busiest: BusiestDay | null = null;
  let bestCount = 0;
  for (const [key, day] of inMonth) {
    if (day.count > bestCount) {
      bestCount = day.count;
      busiest = { dayKey: key, submits: day.submits, vocabCards: day.vocabCards };
    }
  }

  return {
    attendance: buildAttendanceMonthFromKeys({ activeKeys: inMonth.map(([key]) => key), monthKey }),
    activeDays: inMonth.length,
    ratePercent: elapsed > 0 ? Math.round((inMonth.length / elapsed) * 100) : 0,
    busiest
  };
}

// "Thứ 6 (02/10): 3 phần bài · 20 thẻ"
export function busiestDayLabel(day: BusiestDay): string {
  const [year, month, date] = day.dayKey.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, date)).getUTCDay()];
  const parts = [
    day.submits > 0 ? `${day.submits} phần bài` : null,
    day.vocabCards > 0 ? `${day.vocabCards} thẻ` : null
  ].filter((part): part is string => part !== null);

  return `${weekday} (${String(date).padStart(2, "0")}/${String(month).padStart(2, "0")}): ${parts.join(" · ")}`;
}
```

- [ ] **Step 4: `components/profile-month-activity.tsx`**

```tsx
import { AttendanceCalendar } from "@/components/attendance-calendar";
import { StatGrid } from "@/components/profile-side-cards";
import { busiestDayLabel, type MonthActivitySummary } from "@/lib/profile-activity";

// Lịch chăm học tháng + 4 ô số trên hồ sơ học viên khác (kiểu chin).
export function ProfileMonthActivity({
  summary,
  streakDays,
  prevHref,
  nextHref
}: {
  summary: MonthActivitySummary;
  streakDays: number;
  prevHref: string;
  nextHref: string | null;
}) {
  return (
    <section className="space-y-4">
      <AttendanceCalendar data={summary.attendance} prevHref={prevHref} nextHref={nextHref} />
      <StatGrid
        stats={[
          { label: "Tỉ lệ ngày học", value: `${summary.ratePercent}%` },
          { label: "Số ngày học", value: `${summary.activeDays} ngày` },
          { label: "Chuỗi hiện tại", value: `🔥 ${streakDays} ngày` },
          { label: "Ngày cày trâu nhất", value: summary.busiest ? busiestDayLabel(summary.busiest) : "—" }
        ]}
      />
    </section>
  );
}
```

- [ ] **Step 5: Viết lại `app/student/profile/[studentId]/page.tsx`**

```tsx
import { notFound, redirect } from "next/navigation";
import { StreakTierChip } from "@/components/leaderboard/streak-tier-chip";
import { ProfileHero } from "@/components/profile-hero";
import { ProfileMonthActivity } from "@/components/profile-month-activity";
import { MascotCard, RankCard } from "@/components/profile-side-cards";
import { RankTierBadge } from "@/components/rank-tier-badge";
import { auth } from "@/lib/auth";
import { getDayStreak, loadActivityDays } from "@/lib/day-streak-data";
import { monthKeyOf, shiftMonthKey } from "@/lib/monthly-recap";
import { prisma } from "@/lib/prisma";
import { resolveProfileMonth, summarizeMonthActivity } from "@/lib/profile-activity";
import { vietnamDateKey } from "@/lib/vocab-day";
import { getLifetimeXp } from "@/lib/xp-rank-data";

export const dynamic = "force-dynamic";

// Hồ sơ học viên KHÁC — mở cho cả trường (Mạng xã hội Đợt 1, spec
// 2026-10-05-xa-hoi-dot-1): trang trí, lớp, XP + hạng đấu, chuỗi 🔥, lịch chăm học.
// Band từng kỹ năng, mục tiêu band, bài làm và số dư ví vẫn là chuyện riêng, KHÔNG bao
// giờ hiện ở đây — xem tests/profile-visibility.test.ts.
export default async function StudentPublicProfilePage({
  params,
  searchParams
}: {
  params: { studentId: string };
  searchParams?: { month?: string };
}) {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "student") {
    redirect("/login");
  }

  const me = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true }
  });

  if (!me) {
    redirect("/waiting");
  }

  if (me.id === params.studentId) {
    redirect("/student/profile");
  }

  const profile = await prisma.studentProfile.findUnique({
    where: { id: params.studentId },
    select: {
      id: true,
      displayName: true,
      bio: true,
      avatarUrl: true,
      avatarPreset: true,
      coverColor: true,
      coverImageUrl: true,
      equippedBackground: true,
      equippedFrame: true,
      equippedMascot: true,
      createdAt: true,
      user: { select: { image: true } },
      classes: { select: { class: { select: { name: true } } } }
    }
  });

  if (!profile) {
    notFound();
  }

  const now = new Date();
  const latestMonth = monthKeyOf(now);
  const monthKey = resolveProfileMonth(searchParams?.month, latestMonth);

  // XP / chuỗi / ngày có học qua đúng các nguồn dùng chung với hồ sơ của mình.
  const [lifetimeXp, dayStreak, activityDays] = await Promise.all([
    getLifetimeXp(profile.id),
    getDayStreak(profile.id, now),
    loadActivityDays(profile.id, `${monthKey}-01`)
  ]);
  const streakDays = dayStreak.streak.days;
  const summary = summarizeMonthActivity(activityDays, monthKey, vietnamDateKey(now));

  const base = `/student/profile/${profile.id}`;
  const prevHref = `${base}?month=${shiftMonthKey(monthKey, -1)}`;
  const nextHref = monthKey < latestMonth ? `${base}?month=${shiftMonthKey(monthKey, 1)}` : null;
  const classNames = profile.classes.map((row) => row.class.name);

  const joined = new Intl.DateTimeFormat("vi-VN", {
    day: "numeric",
    month: "numeric",
    year: "numeric"
  }).format(profile.createdAt);

  // Bố cục 2 cột như hồ sơ của mình: trái = bìa + lịch, phải = hạng + linh vật. Màn
  // nhỏ: bìa → thẻ phải → lịch (cột trái dùng `contents` + order).
  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6 xl:grid xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
      <div className="contents xl:flex xl:min-w-0 xl:flex-col xl:gap-6">
        <section className="order-1 min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-card">
          <ProfileHero
            backgroundKey={profile.equippedBackground}
            coverColor={profile.coverColor}
            coverImageUrl={profile.coverImageUrl}
            frame={profile.equippedFrame}
            avatarUrl={profile.avatarUrl}
            avatarPreset={profile.avatarPreset}
            userImage={profile.user?.image ?? null}
            displayName={profile.displayName}
          />
          <div className="px-5 pb-5 pt-4 text-center">
            {/* Text thuần — bio do người khác nhập. */}
            {profile.bio ? (
              <p className="mx-auto max-w-prose whitespace-pre-line text-sm text-muted-foreground">
                {profile.bio}
              </p>
            ) : null}
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5 text-sm text-muted-foreground">
              <span>Tham gia từ {joined}</span>
              <span aria-hidden="true">·</span>
              <RankTierBadge xp={lifetimeXp} />
              {streakDays > 0 ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-semibold text-foreground">🔥 {streakDays} ngày</span>
                  <StreakTierChip days={streakDays} />
                </>
              ) : null}
            </div>
            {classNames.length > 0 ? (
              <p className="mt-1.5 text-sm text-muted-foreground">
                Lớp: <span className="font-medium text-foreground">{classNames.join(" · ")}</span>
              </p>
            ) : null}
          </div>
        </section>

        <div className="order-3">
          <ProfileMonthActivity summary={summary} streakDays={streakDays} prevHref={prevHref} nextHref={nextHref} />
        </div>
      </div>

      <aside className="order-2 flex flex-col gap-4">
        <RankCard xp={lifetimeXp} showXp />
        <MascotCard poseKey={profile.equippedMascot} own={false} />
      </aside>
    </div>
  );
}
```

- [ ] **Step 6: Hồ sơ của mình dùng chung nguồn lịch**

Trong `app/student/profile/page.tsx`:
- đổi import `import { buildAttendanceMonth } from "@/lib/attendance";` thành `import { buildAttendanceMonthFromKeys } from "@/lib/attendance";`;
- thêm `import { activeDayKeys } from "@/lib/activity-heatmap";`;
- đổi `import { getDayStreak } from "@/lib/day-streak-data";` thành `import { getDayStreak, loadActivityDays } from "@/lib/day-streak-data";`;
- trong `Promise.all`, bỏ phần tử `prisma.vocabQuizDay.findMany({ where: { studentId: student.id }, select: { date: true } })` và bỏ `vocabDays` khỏi danh sách destructure: `const [attempts, vocabWordCount, lifetimeXp, ownedItems] = await Promise.all([`;
- xoá đoạn `const submittedAt = attempts.map(...).filter(...);`;
- thay khối `const attendance = buildAttendanceMonth({ ... });` (cả comment "Neo giữa tháng…" bên trong) bằng:

```tsx
  const monthKey = formatMonthParam(requestedMonth.year, requestedMonth.month);
  // Cùng nguồn với chuỗi 🔥 (mọi lượt nộp + ôn Sổ từ). Trước 5/10/2026 lịch chỉ đếm
  // lượt countsForStats nên có ngày chuỗi vẫn tính mà ô lịch lại tắt.
  const monthActivity = await loadActivityDays(student.id, `${monthKey}-01`);
  const attendance = buildAttendanceMonthFromKeys({
    activeKeys: activeDayKeys(monthActivity).filter((key) => key.startsWith(`${monthKey}-`)),
    monthKey
  });
```

(`requestedMonth` và `formatMonthParam` đã có sẵn ở trên trong file.)

- [ ] **Step 7: Sửa comment `RankCard`**

Trong `components/profile-side-cards.tsx`, thay comment phía trên `RankCard`:

```tsx
// Thẻ Hạng đấu (XP tích luỹ, lib/xp-rank.ts). Từ Mạng xã hội Đợt 1 (5/10/2026) cả hồ
// sơ của mình lẫn hồ sơ người khác đều bật `showXp` (giống chin); tắt = chỉ huy hiệu + tên cấp.
```

- [ ] **Step 8: Chạy test + kiểm kiểu**

Run: `npx vitest run tests/attendance.test.ts tests/profile-activity.test.ts tests/profile-visibility.test.ts tests/wallet-guard.test.ts tests/ranking-link-guard.test.ts`
Expected: PASS.

Run: `npx tsc --noEmit`
Expected: không lỗi.

- [ ] **Step 9: Commit**

```bash
git add lib/attendance.ts lib/profile-activity.ts components/profile-month-activity.tsx "app/student/profile/[studentId]/page.tsx" app/student/profile/page.tsx components/profile-side-cards.tsx tests/attendance.test.ts tests/profile-activity.test.ts tests/profile-visibility.test.ts
git diff --cached --stat
git commit -m "feat(xa-hoi): ho so mo toan truong - XP, chuoi, lich cham hoc thang; lich chung nguon voi chuoi

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Tab Chuỗi 🔥 ở trang Xếp hạng của giáo viên

**Files:**
- Modify: `app/teacher/ranking/page.tsx`
- Test: `tests/leaderboard-guard.test.ts` (thêm)

**Interfaces:**
- Consumes: `getStreakBoard`, `classMemberIds` (Task 2), `streakBoardEntries` (Task 1), `LeaderboardBoard`, `StreakBoardHeader` (Task 4).
- Produces: `/teacher/ranking?view=streak[&classId=]`.

- [ ] **Step 1: Thêm test cấu trúc (sẽ đỏ)**

Thêm vào cuối `tests/leaderboard-guard.test.ts`:

```ts
describe("tab Chuỗi của giáo viên", () => {
  const page = read("app/teacher/ranking/page.tsx");

  it("có tab view=streak, link tên sang trang học viên của thầy", () => {
    expect(page).toContain('href="/teacher/ranking?view=streak"');
    expect(page).toMatch(/<LeaderboardBoard[^>]*linkTarget="teacher"/);
    expect(page).not.toContain('linkTarget="student"');
  });

  it("chọn lớp chỉ trong lớp của thầy (lọc teacherId)", () => {
    expect(page).toMatch(/async function StreakView[\s\S]*?where: \{ teacherId \}/);
  });
});
```

Run: `npx vitest run tests/leaderboard-guard.test.ts`
Expected: FAIL ở 2 test mới.

- [ ] **Step 2: Sửa `app/teacher/ranking/page.tsx`**

Thêm import:

```tsx
import { LeaderboardBoard } from "@/components/leaderboard/leaderboard-board";
import { StreakBoardHeader } from "@/components/leaderboard/streak-board-header";
import { streakBoardEntries } from "@/lib/leaderboard";
import { classMemberIds, getStreakBoard } from "@/lib/leaderboard-data";
```

Thay hàm `RankingTabs` bằng:

```tsx
function RankingTabs({ active }: { active: "class" | "month" | "streak" }) {
  const tabClass = (isActive: boolean) =>
    `rounded-lg px-4 py-2 text-sm font-semibold transition ${
      isActive ? "bg-card text-foreground shadow-card" : "text-muted-foreground hover:text-foreground"
    }`;

  return (
    <nav className="inline-flex flex-wrap rounded-xl border border-border bg-border/30 p-1 dark:bg-border/20">
      <Link href="/teacher/ranking" className={tabClass(active === "class")}>
        Theo lớp
      </Link>
      <Link href="/teacher/ranking?view=month" className={tabClass(active === "month")}>
        Tổng kết tháng
      </Link>
      <Link href="/teacher/ranking?view=streak" className={tabClass(active === "streak")}>
        Chuỗi 🔥
      </Link>
    </nav>
  );
}
```

Thêm component ngay trước `export default async function TeacherRankingPage`:

```tsx
// Bảng Chuỗi 🔥 — cùng dữ liệu học viên thấy ở /student/ranking?board=streak. Mặc định
// toàn trường; chọn lớp chỉ trong các lớp của thầy (id lạ → toàn trường).
async function StreakView({ teacherId, classId }: { teacherId: string; classId?: string }) {
  const [classes, rows] = await Promise.all([
    prisma.class.findMany({
      where: { teacherId },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true }
    }),
    getStreakBoard()
  ]);
  const selected = classes.find((classItem) => classItem.id === classId) ?? null;
  const members = selected ? await classMemberIds(selected.id) : null;
  const entries = streakBoardEntries(rows, members);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-primary">Bảng xếp hạng</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Chuỗi ngày học</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Số ngày học liên tiếp của từng em (nộp một phần bài hoặc ôn một thẻ là tính). Học viên thấy
            đúng bảng này ở trang Xếp hạng.
          </p>
          <div className="mt-4">
            <RankingTabs active="streak" />
          </div>
        </div>

        <form method="get" className="flex shrink-0 items-end gap-2">
          <input type="hidden" name="view" value="streak" />
          <label className="block text-sm font-medium">
            <span className="mb-2 block">Phạm vi</span>
            <select
              name="classId"
              defaultValue={selected?.id ?? ""}
              className="w-56 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/40 focus:border-primary focus:ring-2"
            >
              <option value="">Toàn trường</option>
              {classes.map((classItem) => (
                <option key={classItem.id} value={classItem.id}>
                  {classItem.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-card transition hover:bg-primary/90"
          >
            Xem
          </button>
        </form>
      </header>

      <div className="mx-auto max-w-3xl space-y-4">
        <StreakBoardHeader myDays={null} />
        <LeaderboardBoard
          entries={entries}
          linkTarget="teacher"
          emptyText={selected ? `Lớp ${selected.name} chưa ai giữ được chuỗi.` : "Chưa học viên nào giữ được chuỗi."}
        />
      </div>
    </div>
  );
}
```

Trong `TeacherRankingPage`, ngay sau khối `if (searchParams?.view === "month") { ... }`, thêm:

```tsx
  if (searchParams?.view === "streak") {
    return <StreakView teacherId={teacher.id} classId={searchParams.classId} />;
  }
```

- [ ] **Step 3: Chạy test + kiểm kiểu**

Run: `npx vitest run tests/leaderboard-guard.test.ts tests/ranking-link-guard.test.ts tests/teacher-page-guard.test.ts`
Expected: PASS.

Run: `npx tsc --noEmit`
Expected: không lỗi.

- [ ] **Step 4: Commit**

```bash
git add app/teacher/ranking/page.tsx tests/leaderboard-guard.test.ts
git diff --cached --stat
git commit -m "feat(xa-hoi): tab Chuoi o trang Xep hang giao vien - toan truong hoac tung lop

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Kiểm toàn bộ, đo trên dữ liệu prod, xem giao diện, ship

**Files:**
- Create rồi XOÁ trước khi commit: `tmp/_leaderboard-perf.ts`, `tmp/_sign-student.mjs`

- [ ] **Step 1: Toàn bộ test + lint + build**

Run: `pnpm test`
Expected: tất cả PASS.

Run: `pnpm lint`
Expected: không lỗi.

Run: `pnpm build`
Expected: build xanh. Kiểm thêm: `/student/ranking` và `/student/profile/[studentId]` vẫn là route động (ƒ), không bị build nhầm thành trang tĩnh.

- [ ] **Step 2: Đo tốc độ và kiểm bất biến trên dữ liệu prod (chỉ đọc)**

Tạo `tmp/_leaderboard-perf.ts`:

```ts
// Đo tốc độ bảng Chuỗi + Học Bá trên DB thật, và so chuỗi tính gộp với getDayStreak
// từng em. CHỈ ĐỌC. Xoá file này sau khi đo.
import { getDayStreak, loadSchoolStreakInput } from "@/lib/day-streak-data";
import { schoolDayStreaks } from "@/lib/leaderboard";
import { loadMonthlyRecap } from "@/lib/monthly-recap-data";
import { prisma } from "@/lib/prisma";
import { vietnamDateKey } from "@/lib/vocab-day";

async function main() {
  const today = vietnamDateKey(new Date());

  let started = Date.now();
  const input = await loadSchoolStreakInput(today);
  console.log(
    `Chuỗi: tải ${Date.now() - started}ms — ${input.submits.length} lượt nộp, ${input.vocabDays.length} ngày ôn thẻ`
  );

  const streaks = schoolDayStreaks(input, today);
  let mismatch = 0;
  for (const [id, streak] of Array.from(streaks.entries())) {
    const single = (await getDayStreak(id)).streak;
    if (single.days !== streak.days || single.activeToday !== streak.activeToday) {
      mismatch += 1;
      console.log("LỆCH", id, streak, single);
    }
  }
  const top = Array.from(streaks.values()).map((streak) => streak.days).sort((a, b) => b - a).slice(0, 5);
  console.log(`Bất biến: lệch ${mismatch}/${streaks.size} em. Chuỗi dài nhất: ${top.join(", ")}`);

  started = Date.now();
  const recap = await loadMonthlyRecap(today.slice(0, 7));
  console.log(`Học Bá: ${Date.now() - started}ms — ${recap.xpBoard.length} em có XP tháng này`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
```

Run (bash):

```bash
DATABASE_URL="$(grep '^DATABASE_URL_PROD=' .env | cut -d= -f2- | tr -d '"')" npx tsx tmp/_leaderboard-perf.ts
```

Expected:
- `lệch 0/N em`;
- thời gian tải chuỗi và Học Bá mỗi phần dưới 1.500ms. Đo hai lần: lần đầu khi Neon còn lạnh, lần hai khi đã tỉnh.

Nếu chuỗi tải quá 1.500ms khi Neon đã tỉnh: đổi `STREAK_LOOKBACK_DAYS` thành "chuỗi dài nhất thực tế + 60", chạy lại cho tới khi đạt, rồi ghi con số vào commit message.

Xoá file: `rm tmp/_leaderboard-perf.ts`

- [ ] **Step 3: Xem giao diện local trong vai học viên**

1. Mở dev server: `preview_start` với `{ name: "ielts-dev" }`.
2. Tạo `tmp/_sign-student.mjs` để ký phiên học viên thử trên DB local. Đây là DB test trong `.env`, KHÔNG phải prod:

```js
// Ký cookie phiên học viên cho dev local. XOÁ sau khi kiểm.
import { encode } from "next-auth/jwt";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const profile = await prisma.studentProfile.findFirst({
  where: { userId: { not: null } },
  include: { user: true }
});
const token = await encode({
  token: { id: profile.user.id, role: "student", email: profile.user.email, name: profile.displayName },
  secret: process.env.NEXTAUTH_SECRET
});
console.log(token);
await prisma.$disconnect();
```

Chạy: `node --env-file=.env tmp/_sign-student.mjs > "<scratchpad>/student-token.txt"`.

3. Trong Browser pane, mở `http://localhost:3000/login`. Nếu đang có phiên khác thì POST `/api/auth/signout` (kèm csrf) trước. Sau đó chạy `document.cookie = "next-auth.session-token=<token>; path=/"`.
4. Kiểm lần lượt:
   - `/student/ranking`: 3 bảng × 2 phạm vi, đổi tháng ‹ › ở Học Bá, dòng "Bạn", dòng ghim khi mình không có trong bảng;
   - bấm một tên → hồ sơ em đó: có XP, chuỗi, lịch, lớp; không có band hay số dư ví; đổi tháng ở lịch;
   - `/student/profile`: lịch vẫn hiện, đổi tháng được;
   - `/student`: khối bảng xếp hạng, đổi tab;
   - `read_console_messages` không có lỗi.
5. `resize_window` preset `mobile`, tải lại, rồi xem lại `/student/ranking`, khối trang chủ và hồ sơ: không tràn ngang, dải 7 cấp lửa đọc được. Sau đó `resize_window` preset `desktop`. Thử thêm `colorScheme: "dark"`.
6. Giáo viên: đăng xuất, ký token vai `teacher` bằng cùng script (đổi `role` và chọn user giáo viên), rồi mở `/teacher/ranking?view=streak`: chọn lớp, bấm tên → `/teacher/students/<id>`.
7. Chụp `screenshot` trang Xếp hạng + hồ sơ để gửi thầy.
8. Xoá `tmp/_sign-student.mjs` và file token trong scratchpad.

- [ ] **Step 4: Push lên nhánh deploy**

```bash
git status --short
git push origin feature/ielts-platform-mvp
```

Expected: `git status` không còn file nào của đợt này chưa commit (các file `tmp/` cũ của thầy giữ nguyên). Push xong, Vercel tự deploy.

- [ ] **Step 5: Kiểm trên prod bằng Chrome (tài khoản HS Minh, đã đăng nhập sẵn)**

Sau khi deploy xong:
- mở `/student/ranking`: bảng Học Bá có số liệu tháng 10 thật, đổi sang Chuỗi, Lớp / Toàn trường;
- mở hồ sơ một em khác lớp: thấy XP, chuỗi, lịch; không thấy band hay Xu;
- mở `/student`: khối bảng xếp hạng hiện;
- kiểm runtime logs Vercel: không có lỗi từ `[bang-xep-hang]`.

- [ ] **Step 6: Ghi nhớ**

Cập nhật memory `social-features-plan.md`: Đợt 1 đã ship (ngày, các commit), số liệu đo được, ngày trả thưởng đầu tiên (trưa 1/11/2026, cần kiểm cron hôm đó), những gì chưa kiểm trên prod.
