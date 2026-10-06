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
