const DAY_MS = 24 * 60 * 60 * 1000;

// Khoá ngày dạng "YYYY-MM-DD" (giờ VN, do lib/vocab-day.ts sinh ra).
function shiftKey(key: string, deltaDays: number): string {
  const [year, month, day] = key.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day) + deltaDays * DAY_MS);

  return [
    shifted.getUTCFullYear(),
    String(shifted.getUTCMonth() + 1).padStart(2, "0"),
    String(shifted.getUTCDate()).padStart(2, "0")
  ].join("-");
}

// Chuỗi = số ngày liên tiếp có làm quiz. Hôm nay chưa làm thì KHÔNG tính đứt —
// vẫn còn cả ngày để làm (giống grace của chuỗi tuần trong lib/streak.ts).
export function calculateVocabStreak(input: {
  days: string[];
  today: string;
}): { days: number; activeToday: boolean } {
  const done = new Set(input.days);
  const activeToday = done.has(input.today);

  let cursor = activeToday ? input.today : shiftKey(input.today, -1);
  let streak = 0;

  while (done.has(cursor)) {
    streak += 1;
    cursor = shiftKey(cursor, -1);
  }

  return { days: streak, activeToday };
}
