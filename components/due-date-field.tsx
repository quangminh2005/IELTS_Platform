"use client";

import { useEffect, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";

type DueDateFieldProps = {
  name?: string;
  // Giá trị mặc định dạng yyyy-mm-dd (khớp với <input type="date"> cũ).
  defaultValue?: string;
  id?: string;
  // Chip chọn nhanh Hôm nay / Ngày mai / +3 ngày (chỉ dùng ở modal giao bài).
  quickPicks?: boolean;
};

function parseYmd(value?: string): Date | undefined {
  if (!value) {
    return undefined;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return undefined;
  }
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

function toYmd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toDisplay(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
}

export function DueDateField({
  name = "dueDate",
  defaultValue,
  id,
  quickPicks = false
}: DueDateFieldProps) {
  const [selected, setSelected] = useState<Date | undefined>(() => parseYmd(defaultValue));
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <input type="hidden" name={name} value={selected ? toYmd(selected) : ""} />
      <div className="mt-1 flex items-stretch gap-1">
        <button
          type="button"
          id={id}
          onClick={() => setOpen((value) => !value)}
          className="flex w-full items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-left text-sm outline-none ring-primary/40 focus:border-primary focus:ring-2"
        >
          <span className={selected ? "" : "text-muted-foreground"}>
            {selected ? toDisplay(selected) : "dd/mm/yyyy"}
          </span>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            className="size-4 text-muted-foreground"
            aria-hidden="true"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
        </button>
        {selected ? (
          <button
            type="button"
            aria-label="Xoá ngày"
            onClick={() => setSelected(undefined)}
            className="rounded-lg border border-border bg-background px-2 text-sm text-muted-foreground transition hover:border-red-400 hover:text-red-500"
          >
            ✕
          </button>
        ) : null}
      </div>

      {quickPicks ? (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {[
            { label: "Hôm nay", days: 0 },
            { label: "Ngày mai", days: 1 },
            { label: "+3 ngày", days: 3 }
          ].map((pick) => (
            <button
              key={pick.label}
              type="button"
              onClick={() => {
                const date = new Date();
                date.setDate(date.getDate() + pick.days);
                setSelected(date);
              }}
              className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground transition hover:border-primary hover:text-primary"
            >
              {pick.label}
            </button>
          ))}
        </div>
      ) : null}

      {open ? (
        <div
          className="absolute z-50 mt-2 rounded-lg border border-border bg-card p-2 shadow-card"
          style={
            {
              "--rdp-accent-color": "hsl(var(--primary))",
              "--rdp-accent-background-color": "hsl(var(--primary) / 0.15)",
              "--rdp-day-width": "2.25rem",
              "--rdp-day-height": "2.25rem",
              "--rdp-day_button-width": "2.25rem",
              "--rdp-day_button-height": "2.25rem"
            } as React.CSSProperties
          }
        >
          <DayPicker
            mode="single"
            weekStartsOn={1}
            selected={selected}
            onSelect={(date) => {
              setSelected(date);
              setOpen(false);
            }}
            captionLayout="dropdown"
            defaultMonth={selected ?? new Date()}
          />
        </div>
      ) : null}
    </div>
  );
}
