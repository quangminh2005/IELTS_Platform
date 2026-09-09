// Phân hạng dựa trên "điểm xếp hạng" 0–100 (lib/ranking.ts). Có thể tụt khi
// điểm giảm. 10 bậc, sắp TĂNG dần theo ngưỡng `min`.
//
// Ngưỡng KHÔNG chia đều 0–100, vì thang thực dụng hẹp hơn thang danh nghĩa: một
// học viên nộp đủ, đúng hạn, học đều đã được sẵn 30 điểm (20 hoàn thành + 10
// hoạt động), nên với họ điểm xếp hạng = 0,7 × điểm TB + 30. Cột "điểm TB tương
// đương" dưới đây tính theo công thức đó, để thấy mỗi bậc thật sự đòi hỏi gì:
//
//   Nhựa 0        Nhôm 18       Đồng 30 (0%)    Bạc 40 (14%)    Vàng 55 (36%)
//   Bạch Kim 70 (57%)   Kim Cương 85 (79%)   Cao Thủ 90 (86%)
//   Đại Cao Thủ 94 (91%)   Thách Đấu 97 (96%)
//
// Năm bậc Đồng→Kim Cương giữ nguyên ngưỡng cũ để không ai đang xếp hạng bị tụt
// oan; chỉ chèn hai bậc dưới và ba bậc trên.
export type Tier = {
  key: string;
  label: string;
  min: number;
  badgeClass: string; // class Tailwind cho chip (nền + chữ, hợp dark mode)
  icon: string;
};

export const TIERS: Tier[] = [
  { key: "plastic", label: "Nhựa", min: 0, badgeClass: "bg-stone-500/15 text-stone-600 dark:text-stone-400", icon: "🧱" },
  { key: "aluminum", label: "Nhôm", min: 18, badgeClass: "bg-zinc-600/15 text-zinc-700 dark:text-zinc-400", icon: "⚙️" },
  { key: "bronze", label: "Đồng", min: 30, badgeClass: "bg-amber-700/15 text-amber-700 dark:text-amber-500", icon: "🥉" },
  { key: "silver", label: "Bạc", min: 40, badgeClass: "bg-slate-400/20 text-slate-600 dark:text-slate-300", icon: "🥈" },
  { key: "gold", label: "Vàng", min: 55, badgeClass: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400", icon: "🥇" },
  { key: "platinum", label: "Bạch Kim", min: 70, badgeClass: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-300", icon: "🏆" },
  { key: "diamond", label: "Kim Cương", min: 85, badgeClass: "bg-sky-500/15 text-sky-600 dark:text-sky-300", icon: "💎" },
  { key: "master", label: "Cao Thủ", min: 90, badgeClass: "bg-purple-500/15 text-purple-600 dark:text-purple-400", icon: "⚔️" },
  { key: "grandmaster", label: "Đại Cao Thủ", min: 94, badgeClass: "bg-rose-500/15 text-rose-600 dark:text-rose-400", icon: "👑" },
  { key: "challenger", label: "Thách Đấu", min: 97, badgeClass: "bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400", icon: "🔥" },
];

// Bậc cao nhất có min <= score. Sàn là Nhựa.
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
