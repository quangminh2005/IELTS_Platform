import { getTier, type Tier } from "@/lib/rank-tier";

// Chip bậc dùng lại ở trang Xếp hạng (truyền `score`) và Tổng quan (truyền `tier`).
export function RankTierBadge({
  score,
  tier,
  className = "",
}: {
  score?: number;
  tier?: Tier;
  className?: string;
}) {
  const resolved = tier ?? (score !== undefined ? getTier(score) : null);

  if (!resolved) {
    return null;
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${resolved.badgeClass} ${className}`}
    >
      <span aria-hidden="true">{resolved.icon}</span>
      {resolved.label}
    </span>
  );
}
