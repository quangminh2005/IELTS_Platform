import { RankMedal } from "@/components/rank-medal";
import { getXpProgress, levelName } from "@/lib/xp-rank";

// Chip hạng đấu (huy hiệu nhỏ + "Bạc II") — hạng theo XP tích luỹ (lib/xp-rank.ts).
// Dùng ở bảng xếp hạng lớp, trang chủ, hồ sơ. Chỉ in TÊN cấp, không in số XP —
// an toàn cho cả hồ sơ bạn cùng lớp.
export function RankTierBadge({ xp, className = "" }: { xp: number; className?: string }) {
  const { current } = getXpProgress(xp);

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full py-0.5 pl-0.5 pr-2 text-xs font-semibold ${current.rank.badgeClass} ${className}`}
    >
      <RankMedal rankKey={current.rank.key} level={current.levelIndex} className="h-5 w-5" />
      {levelName(current)}
    </span>
  );
}
