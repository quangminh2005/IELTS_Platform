import type { ReactNode } from "react";
import { StreakRestoreButton } from "@/components/streak-restore-button";

// Thẻ chuỗi ngày 🔥 ở trang chủ. Nhận số liệu đã tính từ lib/day-streak-data.
// Có `restore` = hôm qua bị lỡ nhưng còn cứu được bằng Xu → thẻ đổi sang mời khôi phục.
// `mascot` = linh vật đang trang bị, đứng bên phải thẻ.
export function StreakBadge({
  days,
  activeToday,
  restore,
  mascot
}: {
  days: number;
  activeToday: boolean;
  restore?: { lostDays: number; dayLabel: string; price: number; coins: number } | null;
  mascot?: ReactNode;
}) {
  if (restore) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-amber-400/70 bg-amber-50 px-4 py-3 shadow-card dark:border-amber-500/50 dark:bg-amber-950/30">
        <span className="text-3xl grayscale" aria-hidden="true">
          🔥
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="text-base font-semibold">Chuỗi {restore.lostDays} ngày đã đứt</p>
            <p className="mt-0.5 text-sm text-amber-700 dark:text-amber-400">
              Hôm qua ({restore.dayLabel}) chưa học. Khôi phục trước 24h hôm nay để giữ chuỗi.
            </p>
          </div>
          <StreakRestoreButton price={restore.price} coins={restore.coins} />
        </div>
        {mascot}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-card">
      <span className="text-3xl" aria-hidden="true">
        {days > 0 ? "🔥" : "✨"}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold">{days > 0 ? `Chuỗi ${days} ngày` : "Bắt đầu chuỗi ngày"}</p>
        <p
          className={`mt-0.5 text-sm ${
            !activeToday && days > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
          }`}
        >
          {activeToday
            ? "Hôm nay đã học ✓ — mai nhớ quay lại nhé"
            : days > 0
              ? "Hôm nay chưa học — nộp 1 bài hoặc ôn 1 thẻ để giữ chuỗi"
              : "Nộp 1 bài hoặc ôn 1 thẻ Sổ từ hôm nay để bắt đầu"}
        </p>
      </div>
      {mascot}
    </div>
  );
}
