import { activeDayKeys, buildActivityDays } from "@/lib/activity-heatmap";
import type { CoinEntryDraft } from "@/lib/coins";
import { calculateDayStreak, restoredDayOf, type DayStreak } from "@/lib/day-streak";
import {
  monthKeyOf,
  monthNumberLabel,
  monthRange,
  recentMonthKeys,
  resolveMonthKey,
  shiftMonthKey,
  type MonthlyRecap
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
