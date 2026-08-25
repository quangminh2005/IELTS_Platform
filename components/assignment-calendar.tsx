"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatDuration } from "@/lib/format-duration";
import { ProctorFlag } from "@/components/proctor-flag";
import {
  BookOpenIcon,
  CalendarDaysIcon,
  CheckIcon,
  ChevronRightIcon,
  ClipboardCheckIcon,
  ClockIcon,
  HeadphonesIcon,
  LayersIcon,
  MicIcon,
  NotebookIcon,
  PenToolIcon,
  TriangleAlertIcon
} from "@/components/icons";
import {
  assignmentSkillTags,
  deadlineState,
  formatAttemptResult,
  groupAssignmentsByDayDescending,
  isMockTestAssignment,
  isSubmissionLate,
  skillChipText,
  studentsGroupedByClass,
  submissionProgress,
  type CalendarAssignment,
  type CalendarClass,
  type CalendarMode,
  type CalendarRecipient,
  type CalendarSkillProgress,
  type SubmissionLevel
} from "@/lib/assignment-calendar";
import {
  MOCK_TEST_BADGE_CLASSES,
  SKILL_BADGE_CLASSES,
  SKILL_LABELS
} from "@/lib/skills";

const SUBMITTED = new Set(["submitted", "reviewed"]);

type Props = {
  assignments: CalendarAssignment[];
  classes: CalendarClass[];
};

type IconComponent = (props: { className?: string }) => JSX.Element;

// Icon đại diện cho từng kỹ năng IELTS.
const SKILL_ICONS: Record<string, IconComponent> = {
  listening: HeadphonesIcon,
  reading: BookOpenIcon,
  writing: PenToolIcon,
  speaking: MicIcon
};

// Badge tiến độ nộp bài: xong hết / đang nộp dở / còn ít người nộp.
const SUBMISSION_BADGE_CLASSES: Record<SubmissionLevel, string> = {
  done: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300",
  progress:
    "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300",
  low: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
};

const SUBMISSION_BAR_CLASSES: Record<SubmissionLevel, string> = {
  done: "bg-emerald-500",
  progress: "bg-blue-500",
  low: "bg-amber-500"
};

const BADGE_BASE =
  "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold";

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

// Badge kỹ năng đứng trước tiêu đề bài.
function SkillBadge({ skill }: { skill: string }) {
  const SkillIcon = SKILL_ICONS[skill] ?? NotebookIcon;

  return (
    <span
      className={`${BADGE_BASE} ${
        SKILL_BADGE_CLASSES[skill] ?? "border-border bg-muted text-muted-foreground"
      }`}
    >
      <SkillIcon className="h-3.5 w-3.5" />
      {SKILL_LABELS[skill] ?? skill}
    </span>
  );
}

// Cụm bên phải thẻ bài: badge tỷ lệ nộp + thanh tiến độ mảnh cùng màu.
function SubmissionProgress({ submitted, total }: { submitted: number; total: number }) {
  const { percent, level } = submissionProgress(submitted, total);

  return (
    <div className="flex shrink-0 flex-col items-end gap-1.5">
      <span className={`${BADGE_BASE} ${SUBMISSION_BADGE_CLASSES[level]}`}>
        {level === "done" ? <CheckIcon className="h-3.5 w-3.5" /> : null}
        {level === "low" ? <TriangleAlertIcon className="h-3.5 w-3.5" /> : null}
        {submitted}/{total} đã nộp
      </span>
      <span
        className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100 dark:bg-muted sm:w-24"
        role="presentation"
      >
        <span
          className={`block h-full rounded-full transition-all duration-300 ${SUBMISSION_BAR_CLASSES[level]}`}
          style={{ width: `${percent}%` }}
        />
      </span>
    </div>
  );
}

export function AssignmentCalendar({ assignments, classes }: Props) {
  const [mode, setMode] = useState<CalendarMode>("assigned");
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  // Mốc "bây giờ" chỉ lấy sau khi gắn ở trình duyệt, để lần render đầu của
  // server và client giống hệt nhau (tránh lệch hydration).
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    setNowMs(Date.now());
  }, []);

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
                : "px-3 py-1.5 text-muted-foreground transition hover:bg-muted/50"
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
                : "px-3 py-1.5 text-muted-foreground transition hover:bg-muted/50"
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
            <div key={day.dayKey} className="space-y-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm dark:border-border dark:bg-card dark:text-foreground">
                  <CalendarDaysIcon className="h-3.5 w-3.5 text-primary" />
                  {fmtDayHeading(day.dayKey)}
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {day.assignments.length} bài
                </span>
              </div>
              <div className="space-y-2.5">
                {day.assignments.map((assignment) => (
                  <AssignmentCard
                    key={assignment.id}
                    assignment={assignment}
                    classes={classes}
                    selectedClassId={selectedClassId}
                    recipients={visibleRecipients(assignment)}
                    nowMs={nowMs}
                    open={openIds.has(assignment.id)}
                    onToggle={() => toggle(assignment.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function AssignmentCard({
  assignment,
  classes,
  selectedClassId,
  recipients,
  nowMs,
  open,
  onToggle
}: {
  assignment: CalendarAssignment;
  classes: CalendarClass[];
  selectedClassId: string | null;
  recipients: CalendarRecipient[];
  nowMs: number | null;
  open: boolean;
  onToggle: () => void;
}) {
  const submitted = recipients.filter((r) => SUBMITTED.has(r.status)).length;
  const skills = assignmentSkillTags(assignment);
  const isMockTest = isMockTestAssignment(assignment.title);
  const leadSkill = skills[0] ?? "";
  const LeadIcon = isMockTest
    ? ClipboardCheckIcon
    : (SKILL_ICONS[leadSkill] ?? NotebookIcon);
  const leadTone = isMockTest
    ? MOCK_TEST_BADGE_CLASSES
    : (SKILL_BADGE_CLASSES[leadSkill] ?? "border-border bg-muted text-muted-foreground");
  const dueState = deadlineState(assignment.deadline, nowMs);

  return (
    <div className="group cursor-pointer overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm transition-all duration-200 hover:border-slate-300 hover:shadow-md dark:border-border dark:bg-card dark:hover:border-slate-600">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-3.5 py-3 text-left sm:gap-4 sm:px-4"
      >
        <span
          className={`hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl border sm:flex ${leadTone}`}
        >
          <LeadIcon className="h-5 w-5" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {isMockTest ? (
              <span className={`${BADGE_BASE} ${MOCK_TEST_BADGE_CLASSES}`}>
                <ClipboardCheckIcon className="h-3.5 w-3.5" />
                Kiểm tra định kỳ
              </span>
            ) : null}
            {skills.map((skill) => (
              <SkillBadge key={skill} skill={skill} />
            ))}
            <span className="min-w-0 truncate font-semibold">{assignment.title}</span>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
            <span
              className={`inline-flex items-center gap-1 ${
                dueState === "overdue"
                  ? "font-medium text-rose-600 dark:text-rose-300"
                  : dueState === "none"
                    ? "text-muted-foreground/60"
                    : "text-muted-foreground"
              }`}
            >
              <ClockIcon className="h-3.5 w-3.5" />
              {assignment.deadline
                ? `${dueState === "overdue" ? "Quá hạn" : "Hạn nộp"}: ${fmtDeadline(assignment.deadline)}`
                : "Không đặt hạn"}
            </span>
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <LayersIcon className="h-3.5 w-3.5" />
              {assignment.unitCount} phần
            </span>
          </div>
        </div>

        <SubmissionProgress submitted={submitted} total={recipients.length} />

        <ChevronRightIcon
          className={`h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform duration-200 ${
            open ? "rotate-90" : "group-hover:translate-x-1"
          }`}
        />
      </button>

      {open ? (
        <div className="border-t border-slate-200/80 px-4 py-3 dark:border-border">
          <AssignmentDetail
            assignment={assignment}
            classes={classes}
            selectedClassId={selectedClassId}
          />
        </div>
      ) : null}
    </div>
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
    <div className="rounded-lg border border-slate-200/80 p-3 transition-colors hover:border-slate-300 dark:border-border dark:hover:border-slate-600">
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
            className="inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold text-primary hover:underline"
          >
            Xem bài
            <ChevronRightIcon className="h-3.5 w-3.5" />
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
            <ProctorFlag counts={attempt} className="self-center" />
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
