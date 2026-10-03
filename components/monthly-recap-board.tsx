import Link from "next/link";
import { StudentAvatar } from "@/components/student-avatar";
import type { RecapEntry } from "@/lib/monthly-recap";

// Bảng Top của Tổng kết tháng: bục 1-2-3 + danh sách từ hạng 4. Dùng chung cho
// popup học viên (cắt ở 10) và trang Xếp hạng của giáo viên (đầy đủ).

const numberFormat = new Intl.NumberFormat("vi-VN");

export function formatXp(value: number): string {
  return numberFormat.format(value);
}

// Hạng 1 đứng giữa và cao nhất; avatar to hơn hạng 2/3 một bậc.
const podiumStyle = [
  { ring: "ring-yellow-400", pedestal: "h-14 bg-yellow-400/25", size: "lg" as const, shine: "animate-podium-shine" },
  { ring: "ring-slate-300", pedestal: "h-10 bg-slate-300/25", size: "md" as const, shine: "" },
  { ring: "ring-amber-600", pedestal: "h-8 bg-amber-600/25", size: "md" as const, shine: "" }
];

function metricLabel(entry: RecapEntry, metric: "xp" | "days") {
  return metric === "xp" ? `★ ${formatXp(entry.xp)} XP` : `🔥 ${entry.activeDays} ngày`;
}

function rankOf(entry: RecapEntry, metric: "xp" | "days") {
  return (metric === "xp" ? entry.xpRank : entry.daysRank) ?? 0;
}

export function MonthlyRecapBoard({
  eyebrow,
  title,
  icon,
  entries,
  metric,
  limit,
  highlightStudentId = null,
  profileLinkTarget,
  emptyText
}: {
  eyebrow: string;
  title: string;
  icon: string;
  entries: RecapEntry[];
  metric: "xp" | "days";
  limit?: number;
  highlightStudentId?: string | null;
  // Chỉ giáo viên mới bấm được vào tên (mở trang học viên). Học viên xem bảng
  // toàn trường nên không link sang hồ sơ bạn lớp khác.
  profileLinkTarget?: "teacher";
  emptyText: string;
}) {
  const shown = limit ? entries.slice(0, limit) : entries;
  const topThree = shown.slice(0, 3);
  const rest = shown.slice(3);
  // Thứ tự hiển thị 2 - 1 - 3, chỉ lấy các bục có người.
  const podiumOrder = [1, 0, 2].filter((index) => topThree[index]);

  function Name({ entry, className = "" }: { entry: RecapEntry; className?: string }) {
    if (profileLinkTarget === "teacher") {
      return (
        <Link
          href={`/teacher/students/${entry.studentId}`}
          className={`${className} rounded transition hover:text-primary hover:underline`}
        >
          {entry.displayName}
        </Link>
      );
    }
    return <span className={className}>{entry.displayName}</span>;
  }

  function YouChip() {
    return (
      <span className="ml-1 shrink-0 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
        Em
      </span>
    );
  }

  return (
    <section className="flex min-w-0 flex-col rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xl"
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{eyebrow}</p>
          <h3 className="truncate text-lg font-bold leading-tight">{title}</h3>
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="flex flex-1 items-center justify-center py-10 text-center text-sm text-muted-foreground">
          {emptyText}
        </p>
      ) : (
        <>
          <div className="mt-4 flex items-end justify-center gap-2">
            {podiumOrder.map((index) => {
              const entry = topThree[index];
              const style = podiumStyle[index];
              const isYou = entry.studentId === highlightStudentId;

              return (
                <div key={entry.studentId} className="flex w-1/3 min-w-0 max-w-[8.5rem] flex-col items-center">
                  {index === 0 ? (
                    <span aria-hidden="true" className="text-lg leading-none">
                      👑
                    </span>
                  ) : null}
                  <StudentAvatar
                    avatarUrl={entry.avatarUrl}
                    avatarPreset={entry.avatarPreset}
                    userImage={entry.userImage}
                    frame={entry.equippedFrame}
                    displayName={entry.displayName}
                    size={style.size}
                    className={`mt-1 ring-4 ${style.ring} ${style.shine}`}
                  />
                  {/* Tên trên bục cho xuống tối đa 2 dòng — tên Việt dài, cắt 1 dòng mất hết họ tên. */}
                  <p className="mt-2 line-clamp-2 max-w-full break-words text-center text-xs font-semibold leading-4">
                    <Name entry={entry} />
                    {isYou ? <YouChip /> : null}
                  </p>
                  <p className="text-[11px] font-semibold tabular-nums text-primary">
                    {metricLabel(entry, metric)}
                  </p>
                  <div
                    className={`mt-1.5 flex w-full items-start justify-center rounded-t-lg ${style.pedestal}`}
                  >
                    <span className="mt-1 text-sm font-bold tabular-nums">{rankOf(entry, metric)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {rest.length > 0 ? (
            <ol className="mt-3 space-y-1.5">
              {rest.map((entry) => {
                const isYou = entry.studentId === highlightStudentId;

                return (
                  <li
                    key={entry.studentId}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2 ${
                      isYou ? "bg-primary/10 ring-1 ring-primary" : "bg-border/30 dark:bg-border/20"
                    }`}
                  >
                    <span className="w-6 shrink-0 text-center text-sm font-bold tabular-nums text-muted-foreground">
                      {rankOf(entry, metric)}
                    </span>
                    <StudentAvatar
                      avatarUrl={entry.avatarUrl}
                      avatarPreset={entry.avatarPreset}
                      userImage={entry.userImage}
                      frame={entry.equippedFrame}
                      displayName={entry.displayName}
                      size="sm"
                    />
                    <p className="flex min-w-0 flex-1 items-center text-sm font-semibold">
                      <Name entry={entry} className="truncate" />
                      {isYou ? <YouChip /> : null}
                    </p>
                    <span className="shrink-0 text-xs font-semibold tabular-nums text-primary">
                      {metricLabel(entry, metric)}
                    </span>
                  </li>
                );
              })}
            </ol>
          ) : null}
        </>
      )}
    </section>
  );
}
