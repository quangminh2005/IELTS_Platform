import {
  buildHeatmapGrid,
  heatmapStartKey,
  pickActivityMessage,
  summarizeActivity,
  type ActivitySummary,
  type HeatmapWeek
} from "@/lib/activity-heatmap";
import { loadActivityDays, loadRestoreRows, restoredDaysOf } from "@/lib/day-streak-data";
import { vietnamDateKey } from "@/lib/vocab-day";

export type ActivityHeatmapData = {
  weeks: HeatmapWeek[];
  summary: ActivitySummary;
  message: string;
};

// Dữ liệu bảng ô vuông 53 tuần — dùng chung cho trang Tiến bộ (HS) và trang
// học viên (GV). Không có bảng riêng: suy ra từ giờ nộp bài + ngày ôn Sổ từ.
export async function getActivityHeatmap(
  studentId: string,
  now = new Date()
): Promise<ActivityHeatmapData> {
  const today = vietnamDateKey(now);

  const [days, restores] = await Promise.all([
    loadActivityDays(studentId, heatmapStartKey(today)),
    loadRestoreRows(studentId)
  ]);

  const summary = summarizeActivity({ days, today, restoredDays: restoredDaysOf(restores) });

  return {
    weeks: buildHeatmapGrid({ days, today }),
    summary,
    message: pickActivityMessage(summary)
  };
}
