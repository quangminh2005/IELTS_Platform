const VN_OFFSET_MS = 7 * 60 * 60 * 1000; // VN = UTC+7 (không có DST)
const DAY_MS = 24 * 60 * 60 * 1000;

// Cộng offset +7h rồi đọc theo UTC — đây là mẹo cũ trong lib/streak.ts, tránh
// phụ thuộc timezone của máy chủ.
function shiftToVietnam(now: Date): Date {
  return new Date(now.getTime() + VN_OFFSET_MS);
}

export function vietnamDateKey(now: Date): string {
  const shifted = shiftToVietnam(now);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function vietnamDayNumber(now: Date): number {
  const shifted = shiftToVietnam(now);
  const midnight = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate()
  );

  return Math.floor(midnight / DAY_MS);
}

// Chọn từ cho hôm nay: ưu tiên từ chưa từng phát. Hết vòng thì xoay lại từ đầu
// thay vì để trang trống.
export function pickNextWord(input: {
  candidates: string[];
  usedIds: string[];
  dayNumber: number;
}): string | null {
  if (input.candidates.length === 0) {
    return null;
  }

  const used = new Set(input.usedIds);
  const unused = input.candidates.filter((id) => !used.has(id));
  const pool = unused.length > 0 ? unused : input.candidates;
  const index = ((input.dayNumber % pool.length) + pool.length) % pool.length;

  return pool[index];
}
