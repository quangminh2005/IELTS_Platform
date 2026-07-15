"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatDuration } from "@/lib/format-duration";
import {
  formatAttemptResult,
  groupAssignmentsByDayDescending,
  isSubmissionLate,
  skillChipText,
  studentsGroupedByClass,
  type CalendarAssignment,
  type CalendarClass,
  type CalendarMode,
  type CalendarRecipient,
  type CalendarSkillProgress
} from "@/lib/assignment-calendar";

const SUBMITTED = new Set(["submitted", "reviewed"]);

type Props = {
  assignments: CalendarAssignment[];
  classes: CalendarClass[];
};

// dayKey 'YYYY-MM-DD' (giờ VN). Dựng mốc giữa trưa VN để tránh lệch ngày do múi giờ.
function fmtDayHeading(dayKey: string) {
  return new Date(`${dayKey}T12:00:00+07:00`).toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh"
  });
}

function fmtDeadline(iso: string) {
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

// Chip từng kỹ năng cho học viên đang làm dở: phần đã nộp thì nhấn, phần chưa
// nộp để chìm.
function SkillProgressChips({ skills }: { skills: CalendarSkillProgress[] }) {
  return (
    <>
      {skills.map((progress) => (
        <span
          key={progress.skill}
          className={
            progress.submitted
              ? "rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary"
              : "rounded-full bg-muted px-2 py-0.5 text-muted-foreground/70"
          }
        >
          {skillChipText(progress)}
        </span>
      ))}
    </>
  );
}

export function AssignmentCalendar({ assignments, classes }: Props) {
  const [mode, setMode] = useState<CalendarMode>("assigned");
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    if (!selectedClassId) {
      return assignments;
    }
    return assignments.filter((a) =>
      a.recipients.some((r) => r.classIds.includes(selectedClassId))
    );
  }, [assignments, selectedClassId]);

  const days = useMemo(
    () => groupAssignmentsByDayDescending(filtered, mode),
    [filtered, mode]
  );

  const noDeadlineCount = useMemo(
    () => (mode === "deadline" ? filtered.filter((a) => !a.deadline).length : 0),
    [filtered, mode]
  );

  const toggle = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

  const visibleRecipients = (assignment: CalendarAssignment) =>
    selectedClassId
      ? assignment.recipients.filter((r) => r.classIds.includes(selectedClassId))
      : assignment.recipients;

  return (
    <section className="space-y-5">
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

      {noDeadlineCount > 0 ? (
        <p className="text-xs text-muted-foreground">
          {noDeadlineCount} bài chưa đặt hạn nên không hiển thị ở chế độ này.
        </p>
      ) : null}

      {days.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-5 py-12 text-center text-sm text-muted-foreground">
          Chưa có bài nào để hiển thị.
        </div>
      ) : (
        <div className="space-y-6">
          {days.map((day) => (
            <div key={day.dayKey} className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{fmtDayHeading(day.dayKey)}</span>
                <span className="text-xs text-muted-foreground">· {day.assignments.length} bài</span>
              </div>
              <div className="space-y-2">
                {day.assignments.map((assignment) => {
                  const shown = visibleRecipients(assignment);
                  const submitted = shown.filter((r) => SUBMITTED.has(r.status)).length;
                  const open = openIds.has(assignment.id);
                  return (
                    <div
                      key={assignment.id}
                      className="overflow-hidden rounded-xl border border-border bg-card shadow-card"
                    >
                      <button
                        type="button"
                        onClick={() => toggle(assignment.id)}
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-muted/40"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span
                            className={`text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}
                            aria-hidden
                          >
                            ›
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{assignment.title}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {assignment.deadline
                                ? `Hạn nộp ${fmtDeadline(assignment.deadline)}`
                                : "Không đặt hạn"}{" "}
                              · {assignment.unitCount} phần
                            </p>
                          </div>
                        </div>
                        <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                          {submitted}/{shown.length} đã nộp
                        </span>
                      </button>
                      {open ? (
                        <div className="border-t border-border px-4 py-3">
                          <AssignmentDetail
                            assignment={assignment}
                            classes={classes}
                            selectedClassId={selectedClassId}
                          />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function AssignmentDetail({
  assignment,
  classes,
  selectedClassId
}: {
  assignment: CalendarAssignment;
  classes: CalendarClass[];
  selectedClassId: string | null;
}) {
  const groups = studentsGroupedByClass(assignment.recipients, classes, selectedClassId);

  if (groups.length === 0) {
    return <p className="text-sm text-muted-foreground">Không có học viên nào trong lớp đã chọn.</p>;
  }

  return (
    <div className="space-y-4">
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
            href={`/teacher/results/${attempt.id}`}
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
          <>
            <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
              {statusLabel(recipient)}
            </span>
            {attempt?.status === "in_progress" ? (
              <SkillProgressChips skills={attempt.skills} />
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
