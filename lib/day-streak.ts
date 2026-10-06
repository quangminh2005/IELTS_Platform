import { shiftDateKey } from "@/lib/vocab-streak";

// Chuỗi ngày 🔥 (Đợt 4) — một chuỗi duy nhất cho cả trường, thay chuỗi tuần.
// Logic thuần, khoá ngày "YYYY-MM-DD" theo giờ VN. Phần đọc DB ở lib/day-streak-data.ts.
// Ngày có học = nộp ≥ 1 phần kỹ năng hoặc ôn ≥ 1 thẻ Sổ từ (lib/activity-heatmap.ts).

export type DayStreak = { days: number; activeToday: boolean };

export type DayRestoreOffer = {
  dayKey: string; // ngày bị lỡ (hôm qua)
  lostDays: number; // độ dài chuỗi kết thúc ở hôm kia — số ngày sẽ giữ được
};

// Độ dài chuỗi kết thúc ở ngày `start` (đếm lùi). Bảng tin (lib/feed.ts) dùng để tìm mốc chuỗi.
export function runEndingAt(done: Set<string>, start: string): number {
  let cursor = start;
  let count = 0;
  while (done.has(cursor)) {
    count += 1;
    cursor = shiftDateKey(cursor, -1);
  }
  return count;
}

// Hôm nay chưa học thì KHÔNG tính đứt — còn cả ngày để học (grace), đếm từ hôm qua.
// Ngày đã cứu bằng Xu được coi như có học.
export function calculateDayStreak(input: {
  activeDays: string[];
  restoredDays: string[];
  today: string;
}): DayStreak {
  const active = new Set(input.activeDays);
  const done = new Set([...input.activeDays, ...input.restoredDays]);
  const activeToday = active.has(input.today);
  const start = activeToday ? input.today : shiftDateKey(input.today, -1);

  return { days: runEndingAt(done, start), activeToday };
}

// ---- Khôi phục chuỗi bằng Xu ----
// Chỉ cứu được HÔM QUA, và chỉ trong hôm nay. Phải còn chuỗi để cứu: hôm kia có học
// (hoặc đã cứu). Ngày đã cứu ghi ở sổ Xu, key "restore-day:<ngày>".

const RESTORE_BASE_PRICE = 100;
const DAY_RESTORE_PREFIX = "restore-day:";

export function dayStreakRestoreOffer(input: {
  activeDays: string[];
  restoredDays: string[];
  today: string;
}): DayRestoreOffer | null {
  const done = new Set([...input.activeDays, ...input.restoredDays]);
  const missed = shiftDateKey(input.today, -1);

  if (done.has(missed)) return null;

  const lostDays = runEndingAt(done, shiftDateKey(missed, -1));
  return lostDays > 0 ? { dayKey: missed, lostDays } : null;
}

// Lần thứ k trong tháng (giờ VN) giá 100 × 2^(k−1): 100 / 200 / 400 / 800…
export function streakRestorePrice(usedThisMonth: number): number {
  return RESTORE_BASE_PRICE * 2 ** Math.max(0, Math.floor(usedThisMonth));
}

export function dayRestoreKey(dateKey: string): string {
  return `${DAY_RESTORE_PREFIX}${dateKey}`;
}

// Khoá tuần cũ "restore:<Thứ 2>" (Đợt 2) không phải ngày cứu → null.
export function restoredDayOf(key: string): string | null {
  return key.startsWith(DAY_RESTORE_PREFIX) ? key.slice(DAY_RESTORE_PREFIX.length) : null;
}

// "2026-10-03" → "3/10"
export function formatDayShort(dateKey: string): string {
  const [, month, day] = dateKey.split("-").map(Number);
  return `${day}/${month}`;
}
