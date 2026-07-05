// Hiển thị chuỗi tuần 🔥 + tiến độ tuần hiện tại. Nhận số liệu đã tính từ lib/streak.
export function StreakBadge({
  weeks,
  currentWeekCount,
  weeklyGoal,
  atRisk,
}: {
  weeks: number;
  currentWeekCount: number;
  weeklyGoal: number;
  atRisk: boolean;
}) {
  const remaining = Math.max(0, weeklyGoal - currentWeekCount);

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-card">
      <span className="text-3xl" aria-hidden="true">
        {weeks > 0 ? "🔥" : "✨"}
      </span>
      <div className="min-w-0">
        <p className="text-base font-semibold">
          {weeks > 0 ? `Chuỗi ${weeks} tuần` : "Bắt đầu chuỗi tuần"}
        </p>
        <p
          className={`mt-0.5 text-sm ${
            atRisk && weeks > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
          }`}
        >
          {remaining > 0
            ? `Tuần này ${currentWeekCount}/${weeklyGoal} bài · làm thêm ${remaining} bài để ${
                weeks > 0 ? "giữ chuỗi" : "có chuỗi"
              }`
            : `Tuần này ${currentWeekCount}/${weeklyGoal} bài · đã đạt 🎉`}
        </p>
      </div>
    </div>
  );
}
