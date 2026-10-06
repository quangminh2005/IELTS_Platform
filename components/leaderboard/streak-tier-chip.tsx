import { streakTier } from "@/lib/leaderboard";

// Chip cấp lửa của bảng Chuỗi (Nhen → Bất Diệt). Chuỗi 0 ngày → không hiện gì.
export function StreakTierChip({ days, className = "" }: { days: number; className?: string }) {
  const tier = streakTier(days);
  if (!tier) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${tier.chipClass} ${className}`}
    >
      <span aria-hidden="true">🔥</span>
      {tier.name}
    </span>
  );
}
