import Link from "next/link";
import { StudentAvatar } from "@/components/student-avatar";
import { MonthlyRecapBoard, formatXp } from "@/components/monthly-recap-board";
import { SKILL_LABELS, SKILL_ORDER, SKILL_PILL_CLASSES } from "@/lib/skills";
import {
  buildXpBars,
  monthName,
  monthNumberLabel,
  shiftMonthKey,
  type MonthlyRecap,
  type StudentRecapView
} from "@/lib/monthly-recap";

// Toàn bộ nội dung Tổng kết tháng của một học viên (ý tưởng từ chin.edu.vn).
// Không có state — được bọc bởi popup (MonthlyRecapDialog) ở trang chủ hoặc vẽ
// thẳng ở trang /student/recap.
//   closeMode "dialog" → nút chân mang data-recap-close, popup tự bắt để đóng.
//   closeMode "link"   → nút chân là link về trang chủ.

function ChangeLine({ view, previousMonth }: { view: StudentRecapView; previousMonth: string }) {
  const label = `tháng ${Number(previousMonth.slice(5))}`;

  if (view.previousXp === null || view.changePercent === null) {
    return <p className="text-xs text-muted-foreground">{label} chưa có XP — tháng này là khởi đầu!</p>;
  }

  const up = view.changePercent >= 0;

  return (
    <p className="text-xs text-muted-foreground">
      <span
        className={`font-bold ${
          up ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
        }`}
      >
        {up ? "▲" : "▼"} {Math.abs(view.changePercent)}%
      </span>{" "}
      so với {label} ({formatXp(view.previousXp)} XP)
    </p>
  );
}

function XpBars({ recap, rank }: { recap: MonthlyRecap; rank: number | null }) {
  const values = recap.xpBoard.map((entry) => entry.xp);
  const bars = buildXpBars(values, rank === null ? null : rank - 1);

  if (bars.heights.length < 2) {
    return null;
  }

  const markerLeft =
    bars.highlight === null ? null : ((bars.highlight + 0.5) / bars.heights.length) * 100;

  return (
    <div className="mt-4">
      <div
        role="img"
        aria-label={`XP tháng của ${recap.participantCount} bạn, xếp từ cao xuống thấp.${
          rank ? ` Em hạng ${rank}.` : ""
        }`}
        className="relative pt-7"
      >
        {markerLeft !== null ? (
          <div
            className="pointer-events-none absolute bottom-0 top-0 flex -translate-x-1/2 flex-col items-center"
            style={{ left: `${markerLeft}%` }}
          >
            <span className="whitespace-nowrap rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
              Em ở đây
            </span>
            <span className="w-px flex-1 bg-primary" />
          </div>
        ) : null}
        <div className="flex h-16 items-end gap-[2px]">
          {bars.heights.map((height, index) => (
            <span
              key={index}
              className={`flex-1 rounded-t-sm ${
                index === bars.highlight ? "bg-primary" : "bg-muted-foreground/30"
              }`}
              style={{ height: `${Math.max(4, height * 100)}%` }}
            />
          ))}
        </div>
      </div>
      <div className="mt-1 flex justify-between text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        <span>Nhiều XP nhất</span>
        <span>Ít nhất</span>
      </div>
    </div>
  );
}

function DayStrip({ monthKey, days, activeKeys }: { monthKey: string; days: number; activeKeys: string[] }) {
  const active = new Set(activeKeys);
  const month = Number(monthKey.slice(5));

  return (
    <div className="mt-4">
      <p className="text-sm">
        📅 <span className="font-bold tabular-nums">{activeKeys.length}/{days}</span> ngày học
      </p>
      <div className="mt-2 flex gap-[3px]">
        {Array.from({ length: days }, (_, index) => {
          const key = `${monthKey}-${String(index + 1).padStart(2, "0")}`;
          const on = active.has(key);
          return (
            <span
              key={key}
              title={`${index + 1}/${month}${on ? " · có học" : ""}`}
              className={`h-5 flex-1 rounded-sm ${on ? "bg-primary" : "bg-border/60 dark:bg-border/40"}`}
            />
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>1/{month}</span>
        <span>
          {days}/{month}
        </span>
      </div>
    </div>
  );
}

function PersonalCard({
  recap,
  view,
  className = ""
}: {
  recap: MonthlyRecap;
  view: StudentRecapView;
  className?: string;
}) {
  const entry = view.entry;
  const month = Number(recap.monthKey.slice(5));

  if (!entry) {
    return (
      <section
        className={`flex flex-col items-center justify-center rounded-2xl border border-primary/40 bg-card p-6 text-center shadow-card ${className}`}
      >
        <span aria-hidden="true" className="text-4xl">
          🌱
        </span>
        <p className="mt-3 font-semibold">Tháng {month} em chưa có XP nào</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Làm bài, tự luyện hoặc ôn Sổ từ là có XP ngay. Tháng sau bảng sẽ có tên em!
        </p>
      </section>
    );
  }

  const skillChips = SKILL_ORDER.filter((skill) => (entry.unitsBySkill[skill] ?? 0) > 0);

  return (
    <section className={`flex min-w-0 flex-col rounded-2xl border border-primary/40 bg-card p-4 shadow-card ${className}`}>
      <div className="flex items-center gap-3">
        <StudentAvatar
          avatarUrl={entry.avatarUrl}
          avatarPreset={entry.avatarPreset}
          userImage={entry.userImage}
          displayName={entry.displayName}
          size="md"
          className="ring-2 ring-primary"
        />
        <div className="min-w-0">
          <p className="truncate text-lg font-bold">{entry.displayName}</p>
          {view.topPercent !== null ? (
            <span className="inline-flex rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">
              ✦ Top {view.topPercent}% toàn trường
            </span>
          ) : null}
        </div>
      </div>

      <p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        XP tháng {month}
      </p>
      <p className="text-5xl font-extrabold tabular-nums leading-tight">{formatXp(entry.xp)}</p>
      <ChangeLine view={view} previousMonth={shiftMonthKey(recap.monthKey, -1)} />

      <XpBars recap={recap} rank={entry.xpRank} />
      {entry.xpRank !== null ? (
        <p className="mt-2 text-sm">
          Hạng <span className="font-bold tabular-nums">{entry.xpRank}</span> trên{" "}
          <span className="font-bold tabular-nums">{recap.participantCount}</span> bạn có XP tháng này
        </p>
      ) : null}

      <DayStrip monthKey={recap.monthKey} days={recap.daysInMonth} activeKeys={entry.activeDayKeys} />

      {skillChips.length > 0 || entry.vocabCards > 0 ? (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {skillChips.map((skill) => (
            <span
              key={skill}
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${SKILL_PILL_CLASSES[skill]}`}
            >
              {SKILL_LABELS[skill]} · {entry.unitsBySkill[skill]} phần
            </span>
          ))}
          {entry.vocabCards > 0 ? (
            <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
              Sổ từ · {formatXp(entry.vocabCards)} thẻ
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-border px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Top XP</p>
          <p className="text-sm font-semibold">{entry.xpRank !== null ? `Hạng ${entry.xpRank}` : "Chưa có hạng"}</p>
        </div>
        <div className="rounded-xl border border-border px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Chăm nhất</p>
          <p className="text-sm font-semibold">
            {entry.daysRank !== null ? `Hạng ${entry.daysRank}` : "Chưa có hạng"}
          </p>
        </div>
      </div>
    </section>
  );
}

export function MonthlyRecapPanel({
  recap,
  view,
  closeMode
}: {
  recap: MonthlyRecap;
  view: StudentRecapView;
  closeMode: "dialog" | "link";
}) {
  const name = monthName(recap.monthKey);
  const nextName = monthName(shiftMonthKey(recap.monthKey, 1));
  const studentId = view.entry?.studentId ?? null;
  const footerButtonClass =
    "inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-card transition hover:bg-primary/90";

  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-4 right-0 select-none text-[7rem] font-black leading-none text-foreground/[0.04] sm:text-[11rem]"
      >
        {recap.monthKey.slice(5)}
      </span>

      <header className="relative pr-10">
        <p className="text-xs font-bold uppercase tracking-wider text-primary">
          ✦ Tổng kết tháng · {monthNumberLabel(recap.monthKey)}
        </p>
        <h2 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">
          Tháng <span className="text-primary">{name}</span> của em
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Cả trường đã cày <span className="font-bold text-foreground">{formatXp(recap.totalXp)} XP</span> cùng{" "}
          <span className="font-bold text-foreground">{recap.participantCount}</span> bạn trong tháng{" "}
          {name.toLowerCase()}. Đây là dữ liệu của em và những bạn chăm nhất tháng.
        </p>
      </header>

      {/* Popup rộng (max-w-6xl) → 3 cột. Trang /student/recap nằm trong khung
          max-w-5xl có sidebar nên hẹp hơn nhiều → thẻ cá nhân một hàng, hai bảng
          cạnh nhau, kẻo tên học viên bị cắt cụt. */}
      <div className={`relative mt-5 grid gap-4 ${closeMode === "dialog" ? "lg:grid-cols-3" : "md:grid-cols-2"}`}>
        <PersonalCard recap={recap} view={view} className={closeMode === "dialog" ? "" : "md:col-span-2"} />
        <MonthlyRecapBoard
          eyebrow={`Top 10 · tháng ${Number(recap.monthKey.slice(5))}`}
          title="Top XP tháng"
          icon="👑"
          entries={recap.xpBoard}
          metric="xp"
          limit={10}
          highlightStudentId={studentId}
          emptyText="Tháng này chưa ai có XP."
        />
        <MonthlyRecapBoard
          eyebrow={`Top 10 · tháng ${Number(recap.monthKey.slice(5))}`}
          title="Chăm nhất tháng"
          icon="🔥"
          entries={recap.daysBoard}
          metric="days"
          limit={10}
          highlightStudentId={studentId}
          emptyText="Tháng này chưa ai học."
        />
      </div>

      <footer className="relative mt-5 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-5 text-muted-foreground">
          XP: mỗi phần nộp 10–20 XP theo % đúng, bài Viết/Nói 20 XP, ôn 2 thẻ Sổ từ = 1 XP (tối đa 15/ngày), làm
          lại tự luyện được nửa XP. Chăm nhất tính theo số ngày có học trong tháng.
        </p>
        {closeMode === "dialog" ? (
          <button type="button" data-recap-close className={`${footerButtonClass} shrink-0 justify-center`}>
            🔥 Học tiếp tháng {nextName}
          </button>
        ) : (
          <Link href="/student" className={`${footerButtonClass} shrink-0 justify-center`}>
            🔥 Học tiếp tháng {nextName}
          </Link>
        )}
      </footer>
    </div>
  );
}
