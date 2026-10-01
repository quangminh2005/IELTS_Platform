"use client";

import { useEffect, useRef, useState } from "react";
import {
  describeActivityDay,
  type ActivityLevel,
  type ActivitySummary,
  type HeatmapCell,
  type HeatmapWeek
} from "@/lib/activity-heatmap";

// --muted ở chế độ sáng trùng màu nền thẻ → ô trống dùng màu viền cho thấy rõ.
const LEVEL_CLASSES: Record<ActivityLevel, string> = {
  0: "bg-border/60",
  1: "bg-primary/25",
  2: "bg-primary/50",
  3: "bg-primary/75",
  4: "bg-primary"
};

// Nhãn thứ ở cột trái — chỉ ghi hàng xen kẽ cho đỡ rối (như GitHub).
const ROW_LABELS = ["T2", "", "T4", "", "T6", "", ""];

function lastCell(weeks: HeatmapWeek[]): HeatmapCell | null {
  for (let week = weeks.length - 1; week >= 0; week -= 1) {
    const cells = weeks[week].cells;
    for (let dow = cells.length - 1; dow >= 0; dow -= 1) {
      const cell = cells[dow];
      if (cell) return cell;
    }
  }
  return null;
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xl font-bold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

// Bảng ô vuông 53 tuần: mỗi ô = 1 ngày, càng đậm càng học nhiều. Trên điện thoại
// bảng rộng hơn màn hình → khung vuốt ngang, mở ra tự cuộn tới tuần hiện tại.
// message chỉ truyền ở phía học viên (câu viết cho HS, xưng "bạn").
export function ActivityHeatmap({
  weeks,
  summary,
  message
}: {
  weeks: HeatmapWeek[];
  summary: ActivitySummary;
  message?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<HeatmapCell | null>(() => lastCell(weeks));

  useEffect(() => {
    const node = scrollRef.current;
    if (node) {
      node.scrollLeft = node.scrollWidth;
    }
  }, []);

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
      <div className="border-b border-border px-5 py-4">
        <h3 className="text-base font-semibold">Lịch chăm học</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Mỗi ô là một ngày — nộp bài và ôn Sổ từ đều được tính. Càng đậm càng học nhiều.
        </p>
      </div>

      <div className="space-y-4 px-5 py-4">
        <div className="grid grid-cols-3 gap-3">
          <Stat value={summary.activeDays} label="ngày có học trong năm" />
          <Stat value={summary.currentStreak} label="ngày liền hiện tại" />
          <Stat value={summary.longestStreak} label="ngày liền dài nhất" />
        </div>

        {message ? (
          <p className="rounded-lg bg-primary/5 px-3 py-2 text-sm text-foreground">{message}</p>
        ) : null}

        <div ref={scrollRef} className="-mx-1 overflow-x-auto px-1 pb-1">
          <div className="flex w-max gap-[3px]">
            <div className="mr-1 flex flex-col gap-[3px]" aria-hidden="true">
              <div className="h-4" />
              {ROW_LABELS.map((label, row) => (
                <div
                  key={row}
                  className="flex h-3 items-center text-[10px] leading-none text-muted-foreground"
                >
                  {label}
                </div>
              ))}
            </div>

            {weeks.map((week, index) => (
              <div key={index} className="flex flex-col gap-[3px]">
                <div className="relative h-4">
                  {week.monthLabel ? (
                    <span className="absolute left-0 top-0 whitespace-nowrap text-[10px] leading-none text-muted-foreground">
                      {week.monthLabel}
                    </span>
                  ) : null}
                </div>
                {week.cells.map((cell, dow) => {
                  if (!cell) {
                    return <div key={dow} className="h-3 w-3" />;
                  }
                  const label = describeActivityDay(cell);
                  const isSelected = selected?.date === cell.date;
                  return (
                    <button
                      key={dow}
                      type="button"
                      title={label}
                      aria-label={label}
                      onClick={() => setSelected(cell)}
                      onMouseEnter={() => setSelected(cell)}
                      className={`h-3 w-3 rounded-[3px] ${LEVEL_CLASSES[cell.level]} ${
                        isSelected ? "ring-2 ring-foreground/60 ring-offset-1 ring-offset-card" : ""
                      } focus:outline-none focus-visible:ring-2 focus-visible:ring-primary`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <p className="min-h-[1rem] font-medium text-foreground" aria-live="polite">
            {selected ? describeActivityDay(selected) : ""}
          </p>
          <div className="flex items-center gap-1" aria-hidden="true">
            <span className="mr-1">Ít</span>
            {([0, 1, 2, 3, 4] as const).map((level) => (
              <span key={level} className={`h-3 w-3 rounded-[3px] ${LEVEL_CLASSES[level]}`} />
            ))}
            <span className="ml-1">Nhiều</span>
          </div>
        </div>
      </div>
    </section>
  );
}
