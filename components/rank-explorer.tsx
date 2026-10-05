"use client";

import { useEffect, useRef, useState } from "react";
import { RankMedal } from "@/components/rank-medal";
import { ROMAN, XP_RANKS, rankMax, type XpProgress } from "@/lib/xp-rank";

const xpFormat = new Intl.NumberFormat("vi-VN");

function rangeLabel(rankIndex: number): string {
  const min = XP_RANKS[rankIndex].levels[0];
  const max = rankMax(rankIndex);
  return max === null ? `${xpFormat.format(min)}+ XP` : `${xpFormat.format(min)} – ${xpFormat.format(max)} XP`;
}

// Lưới 7 hạng (bấm để chọn) + chi tiết các cấp của hạng đang chọn — kiểu trang
// /ranks của chin.edu.vn. Mặc định mở đúng hạng học viên đang ở.
export function RankExplorer({ progress }: { progress: XpProgress }) {
  const currentRankIndex = progress.current.rankIndex;
  const [selected, setSelected] = useState(currentRankIndex);
  const detailRef = useRef<HTMLElement>(null);
  const rank = XP_RANKS[selected];

  const scrollPending = useRef(false);

  // Điện thoại: lưới 7 hạng dài hơn một màn hình — bấm xong cuộn tới phần chi tiết
  // (sau khi React đã vẽ hạng mới, nên đặt trong effect).
  function choose(index: number) {
    const narrow = window.innerWidth < 1024;
    if (index === selected) {
      // Bấm lại hạng đang mở: không đổi state nên effect không chạy — cuộn luôn.
      if (narrow) detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    scrollPending.current = narrow;
    setSelected(index);
  }

  useEffect(() => {
    if (!scrollPending.current) return;
    scrollPending.current = false;
    detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selected]);

  return (
    <>
      <section>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h3 className="text-xl font-bold">{XP_RANKS.length} Hạng đấu</h3>
          <p className="text-sm text-muted-foreground">Bấm vào một hạng để xem chi tiết các cấp.</p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {XP_RANKS.map((item, index) => {
            const active = index === selected;
            return (
              <button
                key={item.key}
                type="button"
                aria-pressed={active}
                onClick={() => choose(index)}
                className={`relative flex flex-col items-center rounded-xl border bg-card px-2 pb-3 pt-5 text-center shadow-card transition ${
                  active ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50"
                }`}
              >
                {index === currentRankIndex ? (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-lime-400 px-2 py-0.5 text-[10px] font-bold uppercase text-lime-950">
                    Bạn ở đây
                  </span>
                ) : null}
                <RankMedal
                  rankKey={item.key}
                  level={index === currentRankIndex ? progress.current.levelIndex : item.levels.length - 1}
                  className={`h-20 w-20 ${index > currentRankIndex ? "opacity-60 grayscale-[35%]" : ""}`}
                />
                <p className={`mt-2 text-sm font-extrabold uppercase tracking-wide ${item.textClass}`}>{item.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{rangeLabel(index)}</p>
              </button>
            );
          })}
        </div>
      </section>

      <section ref={detailRef} className="scroll-mt-20 rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Hạng {rank.label}</p>
            <p className={`mt-1 text-3xl font-extrabold ${rank.textClass}`}>{rank.label}</p>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">{rank.tagline}</p>
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-semibold">
              {rangeLabel(selected)} <span className="font-normal text-muted-foreground">· {rank.levels.length} cấp</span>
            </p>
          </div>
          <RankMedal rankKey={rank.key} level={rank.levels.length - 1} className="h-24 w-24 shrink-0 drop-shadow-xl sm:h-28 sm:w-28" />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {rank.levels.map((min, levelIndex) => {
            const isCurrent = selected === currentRankIndex && levelIndex === progress.current.levelIndex;
            const reached = progress.xp >= min;
            const nextMin = rank.levels[levelIndex + 1] ?? XP_RANKS[selected + 1]?.levels[0] ?? null;
            const fill = isCurrent ? progress.percent : reached ? 100 : 0;

            return (
              <div
                key={min}
                className={`relative flex flex-col items-center rounded-xl border px-2 pb-3 pt-4 ${
                  isCurrent ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                {isCurrent ? (
                  <span className="absolute -top-2.5 rounded-full bg-lime-400 px-2 py-0.5 text-[10px] font-bold text-lime-950">
                    Bạn
                  </span>
                ) : null}
                <div className="relative">
                  <RankMedal
                    rankKey={rank.key}
                    level={levelIndex}
                    className={`h-14 w-14 ${reached ? "" : "opacity-50 grayscale"}`}
                  />
                  <span
                    className={`absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full text-[11px] text-white ring-2 ring-card ${
                      reached ? "bg-emerald-500" : "bg-slate-500"
                    }`}
                    aria-label={reached ? "Đã đạt" : "Chưa đạt"}
                  >
                    {reached ? "✓" : "🔒"}
                  </span>
                </div>
                <p className={`mt-2 text-sm font-bold ${rank.textClass}`}>{ROMAN[levelIndex]}</p>
                <p className="text-xs text-muted-foreground">{xpFormat.format(min)}+</p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted" title={nextMin ? `Tới ${xpFormat.format(nextMin)} XP` : undefined}>
                  <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500" style={{ width: `${fill}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
