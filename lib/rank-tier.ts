// Phân hạng dựa trên "điểm xếp hạng" 0–100 (lib/ranking.ts). Có thể tụt khi
// điểm giảm. 5 bậc, sắp TĂNG dần theo ngưỡng `min`.
export type Tier = {
  key: string;
  label: string;
  min: number;
  badgeClass: string; // class Tailwind cho chip (nền + chữ, hợp dark mode)
  icon: string;
};

export const TIERS: Tier[] = [
  { key: "bronze", label: "Đồng", min: 0, badgeClass: "bg-amber-700/15 text-amber-700 dark:text-amber-500", icon: "🥉" },
  { key: "silver", label: "Bạc", min: 40, badgeClass: "bg-slate-400/20 text-slate-600 dark:text-slate-300", icon: "🥈" },
  { key: "gold", label: "Vàng", min: 55, badgeClass: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400", icon: "🥇" },
  { key: "platinum", label: "Bạch Kim", min: 70, badgeClass: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-300", icon: "🏆" },
  { key: "diamond", label: "Kim Cương", min: 85, badgeClass: "bg-sky-500/15 text-sky-600 dark:text-sky-300", icon: "💎" },
];

// Bậc cao nhất có min <= score. Sàn là Đồng.
export function getTier(rankingScore: number): Tier {
  let result = TIERS[0];
  for (const tier of TIERS) {
    if (rankingScore >= tier.min) {
      result = tier;
    }
  }
  return result;
}

export type TierProgress = {
  tier: Tier;
  next: Tier | null;
  pointsToNext: number | null;
  pointsToDrop: number | null;
};

export function getTierProgress(rankingScore: number): TierProgress {
  const tier = getTier(rankingScore);
  const index = TIERS.findIndex((t) => t.key === tier.key);
  const next = index < TIERS.length - 1 ? TIERS[index + 1] : null;

  return {
    tier,
    next,
    pointsToNext: next ? Math.max(0, Math.ceil(next.min - rankingScore)) : null,
    pointsToDrop: index > 0 ? Math.max(0, Math.ceil(rankingScore - tier.min)) : null,
  };
}
