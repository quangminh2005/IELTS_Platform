export const VN_OFFSET_MS = 7 * 60 * 60 * 1000; // VN = UTC+7 (không DST)
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

// Đếm số bài đã nộp theo từng tuần VN.
function weeklyCounts(submittedAt: Date[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const date of submittedAt) {
    const key = vnWeekStart(date);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

// Khoá tuần → ngày Thứ 2 "YYYY-MM-DD" (giờ VN). Khoá là nửa đêm UTC của chính ngày
// Thứ 2 giờ VN (đã cộng offset), nên đọc ISO theo UTC là ra đúng ngày.
export function weekKeyToDateKey(weekKey: number): string {
  return new Date(weekKey).toISOString().slice(0, 10);
}

function dateKeyToWeekKey(dateKey: string): number {
  const [year, month, day] = dateKey.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

// Hàm "tuần này đạt chưa": đủ chỉ tiêu HOẶC đã được cứu bằng Xu.
function weekMet(input: { submittedAt: Date[]; weeklyGoal: number; restoredWeeks?: string[] }) {
  const goal = Math.max(1, Math.floor(input.weeklyGoal));
  const counts = weeklyCounts(input.submittedAt);
  const restored = new Set((input.restoredWeeks ?? []).map(dateKeyToWeekKey));
  return {
    goal,
    counts,
    met: (key: number) => (counts.get(key) ?? 0) >= goal || restored.has(key)
  };
}

// Streak = số tuần liên tiếp có >= weeklyGoal bài đã nộp (hoặc đã cứu bằng Xu),
// tính lùi từ tuần hiện tại. Tuần hiện tại chưa đủ N thì KHÔNG tính đứt (grace) —
// vẫn đếm chuỗi từ tuần trước.
export function calculateWeekStreak(input: {
  submittedAt: Date[];
  weeklyGoal: number;
  now: Date;
  restoredWeeks?: string[];
}): StreakResult {
  const { goal, counts, met } = weekMet(input);

  const currentWeek = vnWeekStart(input.now);
  const currentWeekCount = counts.get(currentWeek) ?? 0;
  const atRisk = currentWeekCount < goal;

  // Nếu tuần hiện tại đã đủ N thì đếm từ tuần hiện tại; nếu chưa (còn thời gian)
  // thì bắt đầu đếm từ tuần liền trước (grace).
  let cursor = currentWeekCount >= goal ? currentWeek : currentWeek - WEEK_MS;
  let weeks = 0;
  while (met(cursor)) {
    weeks += 1;
    cursor -= WEEK_MS;
  }

  return { weeks, weeklyGoal: goal, currentWeekCount, atRisk };
}

// ---- Khôi phục chuỗi bằng Xu (Đợt 2) ----
// Chỉ cứu được tuần liền trước (T−1), và chỉ trong tuần hiện tại. Phải còn chuỗi để
// cứu: T−2 đạt (học thật hoặc đã cứu). Tuần đã cứu ghi ở sổ Xu, key "restore:<Thứ 2>".

const RESTORE_BASE_PRICE = 100;
const RESTORE_KEY_PREFIX = "restore:";

export type StreakRestoreOffer = {
  weekKey: string; // Thứ 2 của tuần lỡ, "YYYY-MM-DD"
  lostWeeks: number; // số tuần chuỗi sẽ giữ được (chuỗi kết thúc ở T−2)
};

export function streakRestoreOffer(input: {
  submittedAt: Date[];
  weeklyGoal: number;
  now: Date;
  restoredWeeks: string[];
}): StreakRestoreOffer | null {
  const { met } = weekMet(input);
  const missedWeek = vnWeekStart(input.now) - WEEK_MS;

  if (met(missedWeek)) return null;

  let cursor = missedWeek - WEEK_MS;
  let lostWeeks = 0;
  while (met(cursor)) {
    lostWeeks += 1;
    cursor -= WEEK_MS;
  }

  return lostWeeks > 0 ? { weekKey: weekKeyToDateKey(missedWeek), lostWeeks } : null;
}

// Lần thứ k trong tháng (giờ VN) giá 100 × 2^(k−1): 100 / 200 / 400 / 800…
export function streakRestorePrice(usedThisMonth: number): number {
  return RESTORE_BASE_PRICE * 2 ** Math.max(0, Math.floor(usedThisMonth));
}

export function restoreKey(dateKey: string): string {
  return `${RESTORE_KEY_PREFIX}${dateKey}`;
}

export function restoredWeekOf(key: string): string | null {
  return key.startsWith(RESTORE_KEY_PREFIX) ? key.slice(RESTORE_KEY_PREFIX.length) : null;
}

// "22/9–28/9" — Thứ 2 tới Chủ nhật của tuần.
export function formatWeekRange(dateKey: string): string {
  const monday = new Date(dateKeyToWeekKey(dateKey));
  const sunday = new Date(monday.getTime() + 6 * DAY_MS);
  const short = (date: Date) => `${date.getUTCDate()}/${date.getUTCMonth() + 1}`;
  return `${short(monday)}–${short(sunday)}`;
}
