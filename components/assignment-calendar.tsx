"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatDuration } from "@/lib/format-duration";
import {
  bucketAssignmentsByDay,
  buildMonthGrid,
  formatAttemptResult,
  isSubmissionLate,
  studentsGroupedByClass,
  vnDayKey,
  type CalendarAssignment,
  type CalendarClass,
  type CalendarMode,
  type CalendarRecipient
} from "@/lib/assignment-calendar";

const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const MONTH_LABEL = (year: number, month: number) => `Tháng ${month + 1}, ${year}`;
const SUBMITTED = new Set(["submitted", "reviewed"]);

type Props = {
  assignments: CalendarAssignment[];
  classes: CalendarClass[];
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh"
  });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh"
  });
}

function statusLabel(recipient: CalendarRecipient) {
  if (SUBMITTED.has(recipient.status)) {
    return "Đã nộp";
  }
  if (recipient.attempt?.status === "in_progress") {
    return "Đang làm dở";
  }
  return "Chưa làm";
}

function initials(name: string) {
  return name.trim().slice(0, 2) || "?";
}

export function AssignmentCalendar({ assignments, classes }: Props) {
  const todayKey = vnDayKey(new Date().toISOString());
  const [todayYear, todayMonth] = todayKey.split("-").map(Number);

  const [cursor, setCursor] = useState({ year: todayYear, month: todayMonth - 1 });
  const [mode, setMode] = useState<CalendarMode>("assigned");
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!selectedClassId) {
      return assignments;
    }
    return assignments.filter((a) =>
      a.recipients.some((r) => r.classIds.includes(selectedClassId))
    );
  }, [assignments, selectedClassId]);

  const buckets = useMemo(() => bucketAssignmentsByDay(filtered, mode), [filtered, mode]);
  const grid = useMemo(() => buildMonthGrid(cursor.year, cursor.month), [cursor]);

  const noDeadlineCount = useMemo(
    () => (mode === "deadline" ? filtered.filter((a) => !a.deadline).length : 0),
    [filtered, mode]
  );

  const selected = useMemo(
    () => assignments.find((a) => a.id === selectedId) ?? null,
    [assignments, selectedId]
  );

  const visibleRecipients = (assignment: CalendarAssignment) =>
    selectedClassId
      ? assignment.recipients.filter((r) => r.classIds.includes(selectedClassId))
      : assignment.recipients;

  const shiftMonth = (delta: number) => {
    setCursor((prev) => {
      const next = new Date(Date.UTC(prev.year, prev.month + delta, 1));
      return { year: next.getUTCFullYear(), month: next.getUTCMonth() };
    });
  };

  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_28rem]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex overflow-hidden rounded-lg border border-border text-sm">
            <button
              type="button"
              onClick={() => setMode("assigned")}
              className={
                mode === "assigned"
                  ? "bg-primary px-3 py-1.5 font-semibold text-primary-foreground"
                  : "px-3 py-1.5 text-muted-foreground"
              }
            >
              Theo ngày giao
            </button>
            <button
              type="button"
              onClick={() => setMode("deadline")}
              className={
                mode === "deadline"
                  ? "bg-primary px-3 py-1.5 font-semibold text-primary-foreground"
                  : "px-3 py-1.5 text-muted-foreground"
              }
            >
              Theo hạn nộp
            </button>
          </div>

          <select
            value={selectedClassId ?? ""}
            onChange={(event) => setSelectedClassId(event.target.value || null)}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm"
          >
            <option value="">Tất cả lớp</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="rounded-md border border-border px-2 py-1 text-sm hover:border-primary"
              aria-label="Tháng trước"
            >
              ‹
            </button>
            <span className="text-sm font-semibold">{MONTH_LABEL(cursor.year, cursor.month)}</span>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="rounded-md border border-border px-2 py-1 text-sm hover:border-primary"
              aria-label="Tháng sau"
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
            {WEEKDAYS.map((day) => (
              <span key={day} className="py-1">
                {day}
              </span>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-1">
            {grid.map((key, index) => {
              if (!key) {
                return <div key={`blank-${index}`} className="min-h-[64px]" />;
              }
              const dayItems = buckets.get(key) ?? [];
              const dayNumber = Number(key.slice(8, 10));
              const isToday = key === todayKey;

              return (
                <div
                  key={key}
                  className="min-h-[64px] rounded-md border border-border p-1"
                >
                  <div
                    className={
                      isToday
                        ? "mb-1 flex h-5 w-5 items-center justify-center rounded-full border border-primary text-[11px] font-semibold text-primary"
                        : "mb-1 text-[11px] text-muted-foreground"
                    }
                  >
                    {dayNumber}
                  </div>
                  <div className="space-y-1">
                    {dayItems.slice(0, 2).map((assignment) => {
                      const shown = visibleRecipients(assignment);
                      const submitted = shown.filter((r) => SUBMITTED.has(r.status)).length;
                      const active = assignment.id === selectedId;
                      return (
                        <button
                          key={assignment.id}
                          type="button"
                          onClick={() => setSelectedId(assignment.id)}
                          title={assignment.title}
                          className={
                            active
                              ? "block w-full truncate rounded bg-primary px-1 py-0.5 text-left text-[11px] font-semibold text-primary-foreground"
                              : "block w-full truncate rounded bg-primary/10 px-1 py-0.5 text-left text-[11px] text-primary"
                          }
                        >
                          {submitted}/{shown.length} · {assignment.title}
                        </button>
                      );
                    })}
                    {dayItems.length > 2 ? (
                      <span className="block px-1 text-[10px] text-muted-foreground">
                        +{dayItems.length - 2} bài
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          {noDeadlineCount > 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">
              {noDeadlineCount} bài chưa đặt hạn nên không hiển thị ở chế độ này.
            </p>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-card">
        {selected ? (
          <DetailPanel
            assignment={selected}
            classes={classes}
            selectedClassId={selectedClassId}
          />
        ) : (
          <div className="flex h-full min-h-[200px] items-center justify-center text-center text-sm text-muted-foreground">
            Chọn một bài trên lịch để xem ai đã nộp, đúng/trễ hạn, thời gian làm và kết quả.
          </div>
        )}
      </div>
    </section>
  );
}

function DetailPanel({
  assignment,
  classes,
  selectedClassId
}: {
  assignment: CalendarAssignment;
  classes: CalendarClass[];
  selectedClassId: string | null;
}) {
  const shown = selectedClassId
    ? assignment.recipients.filter((r) => r.classIds.includes(selectedClassId))
    : assignment.recipients;
  const submitted = shown.filter((r) => SUBMITTED.has(r.status)).length;
  const groups = studentsGroupedByClass(assignment.recipients, classes, selectedClassId);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold">{assignment.title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Giao {fmtDate(assignment.createdAt)} ·{" "}
            {assignment.deadline
              ? `Hạn nộp ${fmtDateTime(assignment.deadline)}`
              : "Không đặt hạn"}{" "}
            · {assignment.unitCount} phần
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
          {submitted}/{shown.length} đã nộp
        </span>
      </div>

      {groups.map((group) => (
        <div key={group.classId ?? "none"} className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {group.className}
          </p>
          {group.students.map((recipient) => (
            <StudentRow key={recipient.studentId} recipient={recipient} assignment={assignment} />
          ))}
        </div>
      ))}
    </div>
  );
}

function StudentRow({
  recipient,
  assignment
}: {
  recipient: CalendarRecipient;
  assignment: CalendarAssignment;
}) {
  const attempt = recipient.attempt;
  const done = SUBMITTED.has(recipient.status) && attempt !== null;
  const late = done && attempt ? isSubmissionLate(attempt.submittedAt, assignment.deadline) : false;

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {initials(recipient.displayName)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{recipient.displayName}</p>
            <p className="truncate text-[11px] text-muted-foreground">{recipient.email}</p>
          </div>
        </div>
        {done && attempt ? (
          <Link
            href={`/teacher/review/${attempt.id}`}
            className="shrink-0 text-xs font-semibold text-primary hover:underline"
          >
            Xem bài →
          </Link>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
        {done && attempt ? (
          <>
            <span
              className={
                late
                  ? "rounded-full bg-red-500/10 px-2 py-0.5 font-medium text-red-600 dark:text-red-300"
                  : "rounded-full bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-600 dark:text-emerald-300"
              }
            >
              {late ? "Trễ hạn" : "Đúng hạn"}
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
              {formatDuration(attempt.elapsedSeconds)}
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
              {formatAttemptResult(attempt)}
            </span>
          </>
        ) : (
          <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
            {statusLabel(recipient)}
          </span>
        )}
      </div>
    </div>
  );
}
