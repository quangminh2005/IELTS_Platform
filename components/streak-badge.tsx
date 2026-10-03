import { StreakRestoreButton } from "@/components/streak-restore-button";

// Hiển thị chuỗi tuần 🔥 + tiến độ tuần hiện tại. Nhận số liệu đã tính từ lib/streak.
// Có `restore` = tuần trước bị lỡ nhưng còn cứu được bằng Xu → thẻ đổi sang mời khôi phục.
export function StreakBadge({
  weeks,
  currentWeekCount,
  weeklyGoal,
  atRisk,
  restore
}: {
  weeks: number;
  currentWeekCount: number;
  weeklyGoal: number;
  atRisk: boolean;
  restore?: { lostWeeks: number; weekLabel: string; price: number; coins: number } | null;
}) {
  const remaining = Math.max(0, weeklyGoal - currentWeekCount);

  if (restore) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-amber-400/70 bg-amber-50 px-4 py-3 shadow-card dark:border-amber-500/50 dark:bg-amber-950/30">
        <span className="text-3xl grayscale" aria-hidden="true">
          🔥
        </span>
        <div className="min-w-0 space-y-2">
          <div>
            <p className="text-base font-semibold">Chuỗi {restore.lostWeeks} tuần đã đứt</p>
            <p className="mt-0.5 text-sm text-amber-700 dark:text-amber-400">
              Tuần {restore.weekLabel} chưa đủ {weeklyGoal} bài. Khôi phục trước hết Chủ nhật này để giữ chuỗi.
            </p>
          </div>
          <StreakRestoreButton price={restore.price} coins={restore.coins} />
        </div>
      </div>
    );
  }

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
