import Link from "next/link";
import type { AttendanceMonth } from "@/lib/attendance";

const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

// Class dùng chung cho nút lùi/tới tháng — 44px (w-11/h-11) để chạm thoải mái
// trên điện thoại, không phải mũi tên bé tí chỉ hiện khi hover chuột.
const NAV_BUTTON_CLASS =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border text-lg font-semibold text-foreground transition hover:bg-muted active:bg-muted";

// Heatmap chuyên cần một tháng, có nút lùi/tới tháng. Server component: điều
// hướng bằng link (?month=YYYY-MM) chứ không phải state phía trình duyệt.
export function AttendanceCalendar({
  data,
  prevHref,
  nextHref
}: {
  data: AttendanceMonth;
  prevHref: string;
  // null = đang ở tháng hiện tại, không cho xem tiếp sang tháng "tương lai".
  nextHref: string | null;
}) {
  const activeCount = data.days.filter((day) => day.active).length;

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <Link href={prevHref} aria-label="Xem tháng trước" className={NAV_BUTTON_CLASS}>
          <span aria-hidden="true">‹</span>
        </Link>
        <div className="text-center">
          <h3 className="text-sm font-semibold">
            Tháng {data.month}/{data.year}
          </h3>
          <p className="text-sm text-muted-foreground">{activeCount} ngày có học</p>
        </div>
        {nextHref ? (
          <Link href={nextHref} aria-label="Xem tháng sau" className={NAV_BUTTON_CLASS}>
            <span aria-hidden="true">›</span>
          </Link>
        ) : (
          <span
            aria-hidden="true"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-lg text-muted-foreground/30"
          >
            ›
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1.5 text-center">
        {WEEKDAYS.map((label) => (
          <span key={label} className="text-xs font-medium text-muted-foreground">
            {label}
          </span>
        ))}

        {Array.from({ length: data.leadingBlanks }, (_, index) => (
          <span key={`blank-${index}`} aria-hidden="true" />
        ))}

        {data.days.map((day) => (
          <span
            key={day.day}
            title={`Ngày ${day.day}: ${day.active ? "có học" : "nghỉ"}`}
            aria-label={`Ngày ${day.day} tháng ${data.month}: ${day.active ? "có học" : "nghỉ"}`}
            className={`flex aspect-square items-center justify-center rounded-md text-xs ${
              day.active
                ? "bg-primary font-semibold text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {day.day}
          </span>
        ))}
      </div>

      {/* Chú giải màu — trên điện thoại không có hover nên tooltip title không đủ,
          màu phải kèm chữ giải thích ngay trên trang. */}
      <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm bg-primary" />
          Có học
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm bg-muted" />
          Nghỉ
        </span>
      </div>
    </div>
  );
}
