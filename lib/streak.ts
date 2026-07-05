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
