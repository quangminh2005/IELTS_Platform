"use client";

import Link from "next/link";
import { useState } from "react";
import { LateBadge, OverdueBadge } from "@/components/late-badge";
import { SessionBadges } from "@/components/session-badges";
import { SkillTags } from "@/components/skill-tags";
import { formatShortDate, formatVnTime, sessionNumberText } from "@/lib/class-schedule";
import { statusBadgeClasses } from "@/lib/status-badge";
import {
  formatDayHeading,
  type CalendarDay,
  type CalendarDeadlineEvent,
  type CalendarEvent,
  type CalendarMonth,
  type CalendarSessionEvent,
  type DotKind
} from "@/lib/student-calendar";

const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
// 44px cho dễ chạm trên điện thoại — cùng cỡ nút lùi/tới tháng của lịch chuyên cần.
const NAV_BUTTON_CLASS =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border text-lg font-semibold text-foreground transition hover:bg-muted active:bg-muted";
// Nút "Vào lớp" được tô nổi từ 15 phút trước giờ học đến lúc tan.
const JOIN_EARLY_MS = 15 * 60 * 1000;

const DOT_CLASS: Record<DotKind, string> = {
  session: "bg-primary",
  "session-cancelled": "border border-primary bg-transparent",
  overdue: "bg-red-500",
  pending: "bg-amber-500",
  done: "bg-emerald-500"
};

const LEGEND: Array<[DotKind, string]> = [
  ["session", "Buổi học"],
  ["session-cancelled", "Buổi nghỉ"],
  ["pending", "Hạn nộp"],
  ["overdue", "Quá hạn"],
  ["done", "Đã nộp"]
];

const STATUS_LABELS: Record<string, string> = {
  reviewed: "Đã chấm",
  submitted: "Đã nộp",
  in_progress: "Đang làm",
  assigned: "Chưa làm"
};

function shortLabel(event: CalendarEvent): string {
  return event.type === "session"
    ? `${formatVnTime(new Date(event.startsAt))} ${event.className}`
    : `Hạn: ${event.title}`;
}

function chipClass(event: CalendarEvent): string {
  if (event.type === "session") {
    return event.status === "cancelled"
      ? "bg-muted text-muted-foreground line-through"
      : "bg-primary/10 text-primary";
  }
  if (event.state === "overdue") {
    return "bg-red-500/10 text-red-600 dark:text-red-300";
  }
  return event.state === "pending"
    ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
    : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
}

function dayAriaLabel(day: CalendarDay): string {
  const sessions = day.events.filter((event) => event.type === "session").length;
  const deadlines = day.events.length - sessions;
  const parts = [
    sessions > 0 ? `${sessions} buổi học` : "",
    deadlines > 0 ? `${deadlines} hạn nộp` : ""
  ].filter(Boolean);
  return `Ngày ${day.day}: ${parts.length > 0 ? parts.join(", ") : "không có gì"}`;
}

export function StudentCalendar({
  calendar,
  todayKey,
  initialSelected,
  nowIso,
  prevHref,
  nextHref,
  todayHref
}: {
  calendar: CalendarMonth;
  todayKey: string;
  initialSelected: string;
  nowIso: string;
  prevHref: string;
  nextHref: string;
  todayHref: string | null;
}) {
  const [selected, setSelected] = useState(initialSelected);
  const nowMs = new Date(nowIso).getTime();
  const selectedDay = calendar.days.find((day) => day.key === selected) ?? null;

  function select(key: string) {
    setSelected(key);
    try {
      window.history.replaceState(window.history.state, "", `?m=${key.slice(0, 7)}&d=${key}`);
    } catch {
      // Không đổi được URL cũng không sao — chỉ để tải lại trang vẫn đúng ngày.
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="rounded-xl border border-border bg-card p-4 shadow-card sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <Link href={prevHref} aria-label="Xem tháng trước" className={NAV_BUTTON_CLASS}>
            <span aria-hidden="true">‹</span>
          </Link>
          <div className="text-center">
            <h3 className="text-base font-semibold">
              Tháng {calendar.month}, {calendar.year}
            </h3>
            {todayHref ? (
              <Link href={todayHref} className="text-xs font-semibold text-primary hover:underline">
                Về hôm nay
              </Link>
            ) : null}
          </div>
          <Link href={nextHref} aria-label="Xem tháng sau" className={NAV_BUTTON_CLASS}>
            <span aria-hidden="true">›</span>
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS.map((label) => (
            <span key={label} className="pb-1 text-xs font-medium text-muted-foreground">
              {label}
            </span>
          ))}
          {Array.from({ length: calendar.leadingBlanks }, (_, index) => (
            <span key={`blank-${index}`} aria-hidden="true" />
          ))}
          {calendar.days.map((day) => {
            const isToday = day.key === todayKey;
            const isSelected = day.key === selected;
            return (
              <button
                key={day.key}
                type="button"
                onClick={() => select(day.key)}
                aria-pressed={isSelected}
                aria-label={dayAriaLabel(day)}
                className={`flex min-h-[3rem] min-w-0 flex-col items-center rounded-lg px-0.5 py-1 text-xs transition sm:min-h-[5.5rem] sm:items-stretch sm:px-1 ${
                  isSelected ? "bg-primary/15 ring-1 ring-primary" : "hover:bg-muted"
                }`}
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center self-center rounded-full ${
                    isToday ? "bg-primary font-semibold text-primary-foreground" : ""
                  }`}
                >
                  {day.day}
                </span>
                <span className="mt-1 flex gap-0.5 sm:hidden" aria-hidden="true">
                  {day.dots.map((dot) => (
                    <span key={dot} className={`h-1.5 w-1.5 rounded-full ${DOT_CLASS[dot]}`} />
                  ))}
                </span>
                <span className="mt-1 hidden w-full space-y-0.5 sm:block" aria-hidden="true">
                  {day.events.slice(0, 2).map((event) => (
                    <span
                      key={`${event.type}-${event.id}`}
                      className={`block truncate rounded px-1 text-left text-[11px] leading-4 ${chipClass(event)}`}
                    >
                      {shortLabel(event)}
                    </span>
                  ))}
                  {day.events.length > 2 ? (
                    <span className="block text-left text-[11px] text-muted-foreground">
                      +{day.events.length - 2}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>

        {/* Điện thoại không có hover — màu chấm phải có chú giải ngay trên trang. */}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {LEGEND.map(([kind, label]) => (
            <span key={kind} className="flex items-center gap-1.5">
              <span aria-hidden="true" className={`h-2 w-2 rounded-full ${DOT_CLASS[kind]}`} />
              {label}
            </span>
          ))}
        </div>
      </section>

      <section className="h-fit rounded-xl border border-border bg-card shadow-card">
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-base font-semibold">{formatDayHeading(selected)}</h3>
        </div>
        <div className="space-y-3 p-4">
          {selectedDay && selectedDay.events.length > 0 ? (
            selectedDay.events.map((event) =>
              event.type === "session" ? (
                <SessionCard key={`session-${event.id}`} event={event} nowMs={nowMs} />
              ) : (
                <DeadlineCard key={`deadline-${event.id}`} event={event} />
              )
            )
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Không có buổi học hay hạn nộp nào.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function SessionCard({ event, nowMs }: { event: CalendarSessionEvent; nowMs: number }) {
  const startsAt = new Date(event.startsAt);
  const endsAt = new Date(event.endsAt);
  const cancelled = event.status === "cancelled";
  const online = event.mode === "online";
  const joinNow = nowMs >= startsAt.getTime() - JOIN_EARLY_MS && nowMs <= endsAt.getTime();
  const movedFrom =
    event.originalStartsAt && event.originalStartsAt !== event.startsAt
      ? new Date(event.originalStartsAt)
      : null;
  const numberText = sessionNumberText(event.number, event.total);

  return (
    <article className="rounded-lg border border-border bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={`font-semibold ${cancelled ? "text-muted-foreground line-through" : ""}`}>
            {formatVnTime(startsAt)}–{formatVnTime(endsAt)} · {event.className}
          </p>
          {numberText ? <p className="mt-0.5 text-sm text-muted-foreground">{numberText}</p> : null}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <SessionBadges status={event.status} mode={event.mode} kind={event.kind} />
        </div>
      </div>
      {!cancelled && !online && event.location ? (
        <p className="mt-2 text-sm text-muted-foreground">📍 {event.location}</p>
      ) : null}
      {movedFrom ? (
        <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
          Dời từ {formatShortDate(movedFrom)} {formatVnTime(movedFrom)}
        </p>
      ) : null}
      {event.note ? (
        <p className="mt-2 whitespace-pre-line rounded-md bg-muted px-3 py-2 text-sm">{event.note}</p>
      ) : null}
      {online && !cancelled && event.meetingUrl ? (
        <a
          href={event.meetingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`mt-3 inline-flex rounded-lg px-4 py-2 text-sm font-semibold transition ${
            joinNow
              ? "bg-primary text-primary-foreground shadow-card hover:bg-primary/90"
              : "border border-border text-primary hover:border-primary"
          }`}
        >
          Vào lớp
        </a>
      ) : null}
    </article>
  );
}

function DeadlineCard({ event }: { event: CalendarDeadlineEvent }) {
  const done = event.state === "done" || event.state === "late";

  return (
    <article className="rounded-lg border border-border bg-background p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Hạn nộp {formatVnTime(new Date(event.deadline))}
      </p>
      <p className="mt-1 font-semibold">{event.title}</p>
      <div className="mt-2">
        <SkillTags skills={event.skills} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {event.state === "overdue" ? (
          <OverdueBadge className="px-3 py-1" />
        ) : (
          <span
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusBadgeClasses(event.status)}`}
          >
            {STATUS_LABELS[event.status] ?? "Chưa làm"}
          </span>
        )}
        {event.state === "late" ? <LateBadge className="px-3 py-1" /> : null}
        <Link
          href={event.href}
          className={`ml-auto rounded-lg px-4 py-2 text-sm font-semibold transition ${
            done
              ? "border border-border bg-card text-foreground hover:border-primary hover:text-primary"
              : "bg-primary text-primary-foreground shadow-card hover:bg-primary/90"
          }`}
        >
          {done ? "Xem lại" : "Làm bài"}
        </Link>
      </div>
    </article>
  );
}
