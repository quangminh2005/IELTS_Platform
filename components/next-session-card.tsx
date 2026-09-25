import Link from "next/link";

// Một dòng gọn trên trang Tổng quan: buổi học tới (hoặc đang diễn ra) + số bài
// cần nộp trước buổi đó. Nằm TRÊN khối "Bài được giao" nhưng thấp để không đẩy
// danh sách bài xuống xa trên điện thoại.
export function NextSessionCard({
  label,
  classLabel,
  numberText,
  ongoing,
  pendingCount,
  meetingUrl,
  calendarHref
}: {
  label: string;
  classLabel: string;
  numberText: string | null;
  ongoing: boolean;
  pendingCount: number;
  meetingUrl: string | null;
  calendarHref: string;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 px-5 py-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          {ongoing ? "Đang diễn ra" : "Buổi học tới"}
        </p>
        <p className="mt-1 font-semibold">
          <span aria-hidden="true">📅 </span>
          {label} · {classLabel}
          {numberText ? ` · ${numberText}` : ""}
        </p>
        {pendingCount > 0 ? (
          <p className="mt-1 text-sm font-medium text-amber-700 dark:text-amber-300">
            {pendingCount} bài cần nộp trước buổi này
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 gap-2">
        {meetingUrl ? (
          <a
            href={meetingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-card transition hover:bg-primary/90"
          >
            Vào lớp
          </a>
        ) : null}
        <Link
          href={calendarHref}
          className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition hover:border-primary hover:text-primary"
        >
          Xem lịch
        </Link>
      </div>
    </section>
  );
}
