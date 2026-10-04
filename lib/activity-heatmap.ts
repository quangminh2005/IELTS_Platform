import { vietnamDateKey } from "@/lib/vocab-day";
import { calculateDayStreak } from "@/lib/day-streak";
import { shiftDateKey } from "@/lib/vocab-streak";

// Bảng ô vuông 53 tuần kiểu GitHub ở trang Tiến bộ (ý tưởng từ EasyEnglish).
// Logic thuần — phần đọc DB nằm ở lib/activity-heatmap-data.ts. Khoá ngày
// "YYYY-MM-DD" theo giờ VN, tuần bắt đầu Thứ 2 (khớp lib/streak.ts).

export const HEATMAP_WEEKS = 53;
// Ôn từ chừng này thẻ trở lên trong ngày thì tính là 2 việc.
export const VOCAB_HEAVY_CARDS = 20;
// Cửa sổ "gần đây" để nhận ra kiểu học dồn.
const RECENT_DAYS = 28;

export type ActivityDay = {
  submits: number; // số lượt nộp một phần kỹ năng (bài giao + tự luyện)
  vocabCards: number; // số câu ôn Sổ từ
  count: number; // tổng "việc" — quyết định độ đậm của ô
};

export type ActivityLevel = 0 | 1 | 2 | 3 | 4;

export type HeatmapCell = ActivityDay & { date: string; level: ActivityLevel };

export type HeatmapWeek = {
  monthLabel: string | null;
  // 7 ô Thứ 2 → Chủ nhật; null = ngày sau hôm nay (không vẽ).
  cells: (HeatmapCell | null)[];
};

export type ActivitySummary = {
  activeDays: number;
  currentStreak: number;
  activeToday: boolean;
  longestStreak: number;
  // Số ngày từ lần học gần nhất tới hôm nay (0 = hôm nay có học); null = chưa học.
  daysSinceLast: number | null;
  recentActiveDays: number;
  recentMaxCount: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_NAMES = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

function keyToUtcMs(key: string): number {
  const [year, month, day] = key.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

// 0 = Chủ nhật ... 6 = Thứ Bảy.
function weekdayOf(key: string): number {
  return new Date(keyToUtcMs(key)).getUTCDay();
}

function dayDiff(from: string, to: string): number {
  return Math.round((keyToUtcMs(to) - keyToUtcMs(from)) / DAY_MS);
}

export function buildActivityDays(input: {
  submits: Date[];
  vocabDays: { date: string; total: number }[];
}): Map<string, ActivityDay> {
  const days = new Map<string, ActivityDay>();

  function bump(key: string): ActivityDay {
    let day = days.get(key);
    if (!day) {
      day = { submits: 0, vocabCards: 0, count: 0 };
      days.set(key, day);
    }
    return day;
  }

  for (const submittedAt of input.submits) {
    const day = bump(vietnamDateKey(submittedAt));
    day.submits += 1;
    day.count += 1;
  }

  for (const vocab of input.vocabDays) {
    if (vocab.total < 1) {
      continue;
    }
    const day = bump(vocab.date);
    day.vocabCards += vocab.total;
    day.count += vocab.total >= VOCAB_HEAVY_CARDS ? 2 : 1;
  }

  return days;
}

// Các ngày "có học" — dùng chung cho chuỗi ngày 🔥 (lib/day-streak-data.ts).
export function activeDayKeys(days: Map<string, ActivityDay>): string[] {
  return Array.from(days.entries())
    .filter(([, day]) => day.count > 0)
    .map(([date]) => date);
}

export function activityLevel(count: number): ActivityLevel {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count <= 4) return 3;
  return 4;
}

// Thứ 2 của tuần cách tuần hiện tại 52 tuần — ô đầu tiên của bảng.
export function heatmapStartKey(today: string): string {
  const daysFromMonday = (weekdayOf(today) + 6) % 7;
  return shiftDateKey(today, -daysFromMonday - 7 * (HEATMAP_WEEKS - 1));
}

export function buildHeatmapGrid(input: {
  days: Map<string, ActivityDay>;
  today: string;
}): HeatmapWeek[] {
  const start = heatmapStartKey(input.today);
  const weeks: HeatmapWeek[] = [];

  for (let week = 0; week < HEATMAP_WEEKS; week += 1) {
    const cells: (HeatmapCell | null)[] = [];
    let monthLabel: string | null = null;

    for (let dow = 0; dow < 7; dow += 1) {
      const date = shiftDateKey(start, week * 7 + dow);

      if (date > input.today) {
        cells.push(null);
        continue;
      }

      if (date.endsWith("-01")) {
        monthLabel = `Th${Number(date.slice(5, 7))}`;
      }

      const day = input.days.get(date) ?? { submits: 0, vocabCards: 0, count: 0 };
      cells.push({ date, ...day, level: activityLevel(day.count) });
    }

    weeks.push({ monthLabel, cells });
  }

  return weeks;
}

export function summarizeActivity(input: {
  days: Map<string, ActivityDay>;
  today: string;
  // Ngày cứu chuỗi bằng Xu: chỉ nối "ngày liền hiện tại" cho khớp thẻ 🔥, không tô ô.
  restoredDays?: string[];
}): ActivitySummary {
  const start = heatmapStartKey(input.today);
  const recentStart = shiftDateKey(input.today, -(RECENT_DAYS - 1));

  const active = Array.from(input.days.entries())
    .filter(([date, day]) => day.count > 0 && date >= start && date <= input.today)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  let longestStreak = 0;
  let run = 0;
  let previous: string | null = null;
  let recentActiveDays = 0;
  let recentMaxCount = 0;

  for (const [date, day] of active) {
    run = previous !== null && dayDiff(previous, date) === 1 ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
    previous = date;

    if (date >= recentStart) {
      recentActiveDays += 1;
      recentMaxCount = Math.max(recentMaxCount, day.count);
    }
  }

  const streak = calculateDayStreak({
    activeDays: active.map(([date]) => date),
    restoredDays: input.restoredDays ?? [],
    today: input.today
  });

  return {
    activeDays: active.length,
    currentStreak: streak.days,
    activeToday: streak.activeToday,
    longestStreak,
    daysSinceLast: previous === null ? null : dayDiff(previous, input.today),
    recentActiveDays,
    recentMaxCount
  };
}

// Câu nhận xét dưới bảng (chỉ phía học viên). Giọng vui nhẹ, không chê, luôn
// kèm một việc cụ thể nên làm. Lấy câu đầu tiên khớp.
export function pickActivityMessage(summary: ActivitySummary): string {
  if (summary.activeDays === 0 || summary.daysSinceLast === null) {
    return "Bảng còn trắng tinh — ô xanh đầu tiên đang chờ bạn 🌱";
  }
  if (summary.currentStreak >= 7) {
    return `${summary.currentStreak} ngày liền không nghỉ — phong độ quá! 🔥`;
  }
  if (summary.daysSinceLast >= 3) {
    return `Đã ${summary.daysSinceLast} ngày chưa mở sách — ôn 10 thẻ cho ấm tay nhé 🙂`;
  }
  if (summary.recentActiveDays <= 4 && summary.recentMaxCount >= 4) {
    return "Bạn hay học dồn một hôm — chia nhỏ mỗi ngày một chút sẽ nhớ lâu hơn";
  }
  if (summary.currentStreak >= 3) {
    return `Chuỗi ${summary.currentStreak} ngày — giữ lửa nhé!`;
  }
  if (summary.activeToday) {
    return "Hôm nay đã có ô xanh rồi 👍";
  }
  return "Hôm nay chưa có ô xanh — ôn vài thẻ là có ngay";
}

// "Thứ Ba 29/9 · 2 bài · ôn 14 thẻ"
export function describeActivityDay(cell: HeatmapCell): string {
  const [, month, day] = cell.date.split("-").map(Number);
  const parts = [`${WEEKDAY_NAMES[weekdayOf(cell.date)]} ${day}/${month}`];

  if (cell.submits > 0) {
    parts.push(`${cell.submits} bài`);
  }
  if (cell.vocabCards > 0) {
    parts.push(`ôn ${cell.vocabCards} thẻ`);
  }
  if (parts.length === 1) {
    parts.push("chưa học");
  }

  return parts.join(" · ");
}
