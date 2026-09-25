// Trang "Lịch học" của học viên: gom buổi học + hạn nộp thành sự kiện theo ngày
// (giờ VN) và dựng lưới tháng. Module thuần — không Prisma, không React.

import { vnDateKey } from "@/lib/attendance";
import { numberSessions, vnIsoWeekday, vnMidnight, WEEKDAY_LONG } from "@/lib/class-schedule";
import { isSubmissionLate } from "@/lib/late-submission";
import { VN_OFFSET_MS } from "@/lib/streak";

export type CalendarSessionEvent = {
  type: "session";
  id: string;
  classId: string;
  className: string;
  startsAt: string; // ISO
  endsAt: string; // ISO
  status: string;
  mode: string;
  kind: string;
  meetingUrl: string | null;
  note: string | null;
  originalStartsAt: string | null; // ISO
  location: string | null;
  number: number | null;
  total: number | null;
};

export type DeadlineState = "pending" | "overdue" | "done" | "late";

export type CalendarDeadlineEvent = {
  type: "deadline";
  id: string; // AssignmentRecipient.id
  title: string;
  deadline: string; // ISO
  skills: string[];
  status: string; // RecipientStatus
  state: DeadlineState;
  href: string;
};

export type CalendarEvent = CalendarSessionEvent | CalendarDeadlineEvent;

export type DotKind = "session" | "session-cancelled" | "overdue" | "pending" | "done";

export type CalendarDay = { key: string; day: number; events: CalendarEvent[]; dots: DotKind[] };

export type CalendarMonth = { year: number; month: number; leadingBlanks: number; days: CalendarDay[] };

export type ScheduleClassInfo = {
  id: string;
  name: string;
  location: string | null;
  totalSessions: number | null;
};

export type ScheduleSessionRow = {
  id: string;
  classId: string;
  startsAt: Date;
  endsAt: Date;
  status: string;
  mode: string;
  kind: string;
  meetingUrl: string | null;
  note: string | null;
  originalStartsAt: Date | null;
};

const DONE_STATUSES = new Set(["submitted", "reviewed"]);
const PENDING_STATUSES = new Set(["assigned", "in_progress"]);
const DOT_ORDER: DotKind[] = ["session", "session-cancelled", "overdue", "pending", "done"];
const MAX_DOTS = 3;

// ---- Tham số URL ----

export function monthParam(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

// Cộng/trừ n tháng, tự cuốn qua năm.
export function shiftMonth(year: number, month: number, delta: number) {
  const total = year * 12 + (month - 1) + delta;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

function currentVnMonth(now: Date) {
  const shifted = new Date(now.getTime() + VN_OFFSET_MS);
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1 };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

// "?m=YYYY-MM" — sai định dạng hoặc ngoài khoảng 2020–2100 thì về tháng hiện tại.
export function resolveCalendarMonth(raw: string | undefined, now: Date) {
  const match = raw?.match(/^(\d{4})-(\d{2})$/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (year >= 2020 && year <= 2100 && month >= 1 && month <= 12) {
      return { year, month };
    }
  }
  return currentVnMonth(now);
}

// "?d=YYYY-MM-DD" phải thuộc tháng đang xem; không thì chọn hôm nay (nếu hôm nay
// thuộc tháng đó) hoặc ngày 1.
export function resolveSelectedDay(raw: string | undefined, year: number, month: number, now: Date): string {
  const prefix = monthParam(year, month);
  const match = raw?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (raw && match && raw.startsWith(prefix)) {
    const day = Number(match[3]);
    if (day >= 1 && day <= daysInMonth(year, month)) {
      return raw;
    }
  }
  const today = vnDateKey(now);
  return today.startsWith(prefix) ? today : `${prefix}-01`;
}

// "2026-09-23" -> "Thứ 4, 23/9"
export function formatDayHeading(key: string): string {
  const [, month, day] = key.split("-").map(Number);
  return `${WEEKDAY_LONG[vnIsoWeekday(vnMidnight(key))]}, ${day}/${month}`;
}

// ---- Sự kiện ----

export function toSessionEvents(
  classes: ScheduleClassInfo[],
  sessions: ScheduleSessionRow[]
): CalendarSessionEvent[] {
  const numbers = new Map<string, number>();
  for (const classItem of classes) {
    numberSessions(sessions.filter((session) => session.classId === classItem.id)).forEach(
      (number, id) => numbers.set(id, number)
    );
  }
  const byId = new Map(classes.map((classItem) => [classItem.id, classItem]));

  return sessions.flatMap((session) => {
    const classItem = byId.get(session.classId);
    if (!classItem) {
      return [];
    }
    return [
      {
        type: "session" as const,
        id: session.id,
        classId: classItem.id,
        className: classItem.name,
        startsAt: session.startsAt.toISOString(),
        endsAt: session.endsAt.toISOString(),
        status: session.status,
        mode: session.mode,
        kind: session.kind,
        meetingUrl: session.meetingUrl,
        note: session.note,
        originalStartsAt: session.originalStartsAt?.toISOString() ?? null,
        location: classItem.location,
        number: numbers.get(session.id) ?? null,
        total: classItem.totalSessions
      }
    ];
  });
}

export function deadlineState(input: {
  status: string;
  deadline: Date;
  submittedAt: Date | null;
  now: Date;
}): DeadlineState {
  if (DONE_STATUSES.has(input.status)) {
    return isSubmissionLate(input.submittedAt, input.deadline) ? "late" : "done";
  }
  return input.deadline.getTime() < input.now.getTime() ? "overdue" : "pending";
}

export function toDeadlineEvents(
  rows: Array<{
    id: string;
    status: string;
    submittedAt: Date | null;
    deadline: Date;
    title: string;
    skills: string[];
    latestAttemptId: string | null;
  }>,
  now: Date
): CalendarDeadlineEvent[] {
  return rows.map((row) => {
    const state = deadlineState({ status: row.status, deadline: row.deadline, submittedAt: row.submittedAt, now });
    const done = state === "done" || state === "late";
    return {
      type: "deadline" as const,
      id: row.id,
      title: row.title,
      deadline: row.deadline.toISOString(),
      skills: row.skills,
      status: row.status,
      state,
      href:
        done && row.latestAttemptId
          ? `/student/results/${row.latestAttemptId}`
          : `/student/assignments/${row.id}`
    };
  });
}

export function eventTime(event: CalendarEvent): string {
  return event.type === "session" ? event.startsAt : event.deadline;
}

function dotOf(event: CalendarEvent): DotKind {
  if (event.type === "session") {
    return event.status === "cancelled" ? "session-cancelled" : "session";
  }
  if (event.state === "overdue") {
    return "overdue";
  }
  return event.state === "pending" ? "pending" : "done";
}

// ---- Lưới tháng ----

export function buildCalendarMonth(year: number, month: number, events: CalendarEvent[]): CalendarMonth {
  const prefix = monthParam(year, month);
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay(); // 0 = CN
  // Lưới bắt đầu Thứ 2 nên CN phải là cột thứ 7.
  const leadingBlanks = (firstWeekday + 6) % 7;

  const byDay = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const key = vnDateKey(new Date(eventTime(event)));
    if (!key.startsWith(prefix)) {
      continue;
    }
    const list = byDay.get(key) ?? [];
    list.push(event);
    byDay.set(key, list);
  }

  const days = Array.from({ length: daysInMonth(year, month) }, (_, index) => {
    const day = index + 1;
    const key = `${prefix}-${String(day).padStart(2, "0")}`;
    // ISO cùng định dạng nên so chuỗi là so thời gian.
    const dayEvents = (byDay.get(key) ?? []).sort((a, b) => eventTime(a).localeCompare(eventTime(b)));
    const kinds = new Set(dayEvents.map(dotOf));
    const dots = DOT_ORDER.filter((kind) => kinds.has(kind)).slice(0, MAX_DOTS);
    return { key, day, events: dayEvents, dots };
  });

  return { year, month, leadingBlanks, days };
}

// ---- Thẻ "Buổi học tới" ----

// Số bài chưa nộp có hạn nằm trong (bây giờ, giờ bắt đầu buổi].
export function pendingBeforeSession(
  recipients: Array<{ status: string; deadline: Date | null }>,
  startsAt: Date,
  now: Date
): number {
  return recipients.filter(
    (recipient) =>
      PENDING_STATUSES.has(recipient.status) &&
      recipient.deadline !== null &&
      recipient.deadline.getTime() > now.getTime() &&
      recipient.deadline.getTime() <= startsAt.getTime()
  ).length;
}
