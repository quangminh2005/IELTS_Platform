import Link from "next/link";
import { PRIZE_CHIPS, PRIZE_START_MONTH } from "@/lib/leaderboard";
import { monthNumberLabel } from "@/lib/monthly-recap";

const NAV =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border text-lg font-semibold transition hover:bg-muted";
const NAV_OFF = "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg text-muted-foreground/30";

// Phần đầu bảng Học Bá: tên tháng, đếm ngược, giải thưởng, lùi/tới tháng.
export function XpBoardHeader({
  monthKey,
  countdownText,
  prevHref,
  nextHref
}: {
  monthKey: string;
  countdownText: string | null; // null = tháng đã kết thúc
  prevHref: string | null;
  nextHref: string | null;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-lg font-bold">
            <span aria-hidden="true">🏆</span>
            Học Bá tháng {monthNumberLabel(monthKey)}
          </h3>
          <p className="text-sm text-muted-foreground">Tổng XP học tập trong tháng</p>
        </div>
        <p className="shrink-0 rounded-lg bg-muted px-3 py-1.5 text-xs font-semibold tabular-nums">
          {countdownText ? `Kết thúc sau ${countdownText}` : "Đã kết thúc"}
        </p>
      </div>

      {monthKey >= PRIZE_START_MONTH ? (
        <>
          <ul className="mt-3 flex flex-wrap gap-2">
            {PRIZE_CHIPS.map((chip) => (
              <li
                key={chip.label}
                className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
              >
                {chip.label} · {chip.text}
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Giải xét theo bảng Toàn trường, tự cộng Xu ngày đầu tháng sau.
          </p>
        </>
      ) : null}

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
        {prevHref ? (
          <Link href={prevHref} aria-label="Tháng trước" className={NAV}>
            <span aria-hidden="true">‹</span>
          </Link>
        ) : (
          <span aria-hidden="true" className={NAV_OFF}>
            ‹
          </span>
        )}
        <p className="text-sm font-semibold">
          Tháng {monthNumberLabel(monthKey)}
          {countdownText ? <span className="ml-1 text-primary">· hiện tại</span> : null}
        </p>
        {nextHref ? (
          <Link href={nextHref} aria-label="Tháng sau" className={NAV}>
            <span aria-hidden="true">›</span>
          </Link>
        ) : (
          <span aria-hidden="true" className={NAV_OFF}>
            ›
          </span>
        )}
      </div>
    </section>
  );
}
