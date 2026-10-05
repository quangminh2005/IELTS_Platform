import Link from "next/link";
import { EquippedMascot } from "@/components/shop/mascot-art";
import { resolvePose } from "@/lib/mascots";
import { RankMedal } from "@/components/rank-medal";
import { getXpProgress, levelName } from "@/lib/xp-rank";

// Các thẻ cột phải của trang hồ sơ (bố cục 2 cột kiểu chin, 5/10/2026).

const xpFormat = new Intl.NumberFormat("vi-VN");

// Thẻ Hạng đấu (XP tích luỹ, lib/xp-rank.ts). `showXp` chỉ bật ở hồ sơ CỦA MÌNH —
// hồ sơ bạn cùng lớp chỉ hiện huy hiệu + tên cấp, không con số nào.
export function RankCard({ xp, showXp }: { xp: number; showXp: boolean }) {
  const { current, next, xpToNext, percent } = getXpProgress(xp);

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-card">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Hạng đấu</p>
      <div className="mt-2 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-3xl font-extrabold tracking-tight ${current.rank.textClass}`}>{levelName(current)}</p>
          {showXp ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Tổng <span className="font-semibold tabular-nums text-foreground">{xpFormat.format(xp)}</span> XP
            </p>
          ) : null}
        </div>
        <RankMedal rankKey={current.rank.key} level={current.levelIndex} className="h-20 w-20 shrink-0 drop-shadow-lg" />
      </div>

      {showXp ? (
        <>
          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {next && xpToNext !== null
              ? `Còn ${xpFormat.format(xpToNext)} XP để lên ${levelName(next)}.`
              : "Bạn đã ở cấp cao nhất!"}
          </p>
          <Link href="/student/ranks" className="mt-2 inline-block text-sm text-primary hover:underline">
            Xem chi tiết hạng đấu →
          </Link>
        </>
      ) : null}
    </section>
  );
}

export function StatGrid({ stats }: { stats: { label: string; value: string }[] }) {
  return (
    <section className="grid grid-cols-2 gap-3">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-xl border border-border bg-card p-4 shadow-card">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{stat.label}</p>
          <p className="mt-1 text-lg font-bold leading-snug">{stat.value}</p>
        </div>
      ))}
    </section>
  );
}

// Thẻ Linh vật. Hồ sơ của mình mà chưa có linh vật thì mời sang Cửa hàng; hồ sơ
// bạn cùng lớp chưa có thì không hiện thẻ.
export function MascotCard({ poseKey, own }: { poseKey: string | null; own: boolean }) {
  const resolved = resolvePose(poseKey);

  if (!resolved && !own) return null;

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-card">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Linh vật</p>
      {resolved ? (
        <div className="mt-2 flex flex-col items-center">
          <EquippedMascot poseKey={poseKey} className="h-44 w-44 drop-shadow-lg" />
          <p className="mt-1 font-semibold">{resolved.mascot.name}</p>
          <p className="text-sm text-muted-foreground">{resolved.name}</p>
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">Chưa có linh vật nào đi cùng bạn.</p>
      )}
      {own ? (
        <Link href="/student/shop?tab=mascot" className="mt-3 inline-block text-sm text-primary hover:underline">
          {resolved ? "Đổi tư thế ở Cửa hàng →" : "Nhận linh vật ở Cửa hàng →"}
        </Link>
      ) : null}
    </section>
  );
}
