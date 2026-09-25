import { describe, expect, it } from "vitest";
import { parseHm, vnDateTime } from "../lib/class-schedule";
import {
  buildCalendarMonth,
  deadlineState,
  formatDayHeading,
  monthParam,
  pendingBeforeSession,
  resolveCalendarMonth,
  resolveSelectedDay,
  shiftMonth,
  toDeadlineEvents,
  toSessionEvents,
  type CalendarEvent,
  type ScheduleSessionRow
} from "../lib/student-calendar";

const at = (ymd: string, hm: string) => vnDateTime(ymd, parseHm(hm) as number);
const NOW = at("2026-09-24", "10:00");

function session(id: string, classId: string, startsAt: Date, extra: Partial<ScheduleSessionRow> = {}): ScheduleSessionRow {
  return {
    id,
    classId,
    startsAt,
    endsAt: new Date(startsAt.getTime() + 90 * 60 * 1000),
    status: "scheduled",
    mode: "offline",
    kind: "regular",
    meetingUrl: null,
    note: null,
    originalStartsAt: null,
    ...extra
  };
}

describe("tham số tháng/ngày", () => {
  it("monthParam, shiftMonth", () => {
    expect(monthParam(2026, 9)).toBe("2026-09");
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
  });

  it("resolveCalendarMonth: hợp lệ thì dùng, sai thì về tháng hiện tại", () => {
    expect(resolveCalendarMonth("2026-10", NOW)).toEqual({ year: 2026, month: 10 });
    expect(resolveCalendarMonth("2026-13", NOW)).toEqual({ year: 2026, month: 9 });
    expect(resolveCalendarMonth("1999-01", NOW)).toEqual({ year: 2026, month: 9 });
    expect(resolveCalendarMonth(undefined, NOW)).toEqual({ year: 2026, month: 9 });
  });

  it("resolveSelectedDay", () => {
    expect(resolveSelectedDay("2026-09-05", 2026, 9, NOW)).toBe("2026-09-05");
    expect(resolveSelectedDay("2026-10-05", 2026, 9, NOW)).toBe("2026-09-24");
    expect(resolveSelectedDay("2026-09-31", 2026, 9, NOW)).toBe("2026-09-24");
    expect(resolveSelectedDay(undefined, 2026, 10, NOW)).toBe("2026-10-01");
  });

  it("formatDayHeading", () => {
    expect(formatDayHeading("2026-09-23")).toBe("Thứ 4, 23/9");
    expect(formatDayHeading("2026-09-27")).toBe("Chủ nhật, 27/9");
  });
});

describe("deadlineState", () => {
  const deadline = at("2026-09-20", "23:59");
  it("các trạng thái", () => {
    expect(deadlineState({ status: "submitted", deadline, submittedAt: at("2026-09-20", "10:00"), now: NOW })).toBe("done");
    expect(deadlineState({ status: "reviewed", deadline, submittedAt: at("2026-09-21", "10:00"), now: NOW })).toBe("late");
    expect(deadlineState({ status: "assigned", deadline, submittedAt: null, now: NOW })).toBe("overdue");
    expect(
      deadlineState({ status: "in_progress", deadline: at("2026-09-30", "23:59"), submittedAt: null, now: NOW })
    ).toBe("pending");
  });
});

describe("toSessionEvents", () => {
  it("đánh số theo từng lớp, gắn tên lớp + địa điểm + tổng số buổi", () => {
    const events = toSessionEvents(
      [
        { id: "k1", name: "PĐ K1", location: "Phòng 2", totalSessions: 24 },
        { id: "cb", name: "CB K1", location: null, totalSessions: null }
      ],
      [
        session("a", "k1", at("2026-09-23", "20:15")),
        session("b", "cb", at("2026-09-24", "20:00")),
        session("c", "k1", at("2026-09-25", "20:15"))
      ]
    );
    expect(events.map((e) => [e.id, e.className, e.number, e.total])).toEqual([
      ["a", "PĐ K1", 1, 24],
      ["b", "CB K1", 1, null],
      ["c", "PĐ K1", 2, 24]
    ]);
    expect(events[0].startsAt).toBe(at("2026-09-23", "20:15").toISOString());
    expect(events[0].location).toBe("Phòng 2");
  });

  it("bỏ buổi của lớp không có trong danh sách", () => {
    expect(toSessionEvents([], [session("a", "k1", at("2026-09-23", "20:15"))])).toEqual([]);
  });
});

describe("toDeadlineEvents", () => {
  it("bài đã nộp dẫn tới trang kết quả, chưa nộp dẫn tới trang làm bài", () => {
    const [done, pending] = toDeadlineEvents(
      [
        {
          id: "r1",
          status: "submitted",
          submittedAt: at("2026-09-20", "09:00"),
          deadline: at("2026-09-20", "23:59"),
          title: "Cam 18 T1",
          skills: ["reading"],
          latestAttemptId: "at1"
        },
        {
          id: "r2",
          status: "assigned",
          submittedAt: null,
          deadline: at("2026-09-30", "23:59"),
          title: "Cam 18 T2",
          skills: ["listening"],
          latestAttemptId: null
        }
      ],
      NOW
    );
    expect(done).toMatchObject({ type: "deadline", state: "done", href: "/student/results/at1" });
    expect(pending).toMatchObject({ state: "pending", href: "/student/assignments/r2" });
  });
});

describe("buildCalendarMonth", () => {
  const events: CalendarEvent[] = [
    ...toSessionEvents(
      [{ id: "k1", name: "PĐ K1", location: null, totalSessions: null }],
      [
        session("s1", "k1", at("2026-09-23", "20:15")),
        session("s2", "k1", at("2026-09-25", "20:15"), { status: "cancelled" }),
        session("s3", "k1", at("2026-10-02", "20:15"))
      ]
    ),
    ...toDeadlineEvents(
      [
        { id: "r1", status: "assigned", submittedAt: null, deadline: at("2026-09-23", "18:00"), title: "Bài A", skills: [], latestAttemptId: null },
        { id: "r2", status: "assigned", submittedAt: null, deadline: at("2026-09-25", "23:59"), title: "Bài B", skills: [], latestAttemptId: null }
      ],
      NOW
    )
  ];

  it("lưới tháng 9/2026 bắt đầu Thứ 2, ô trống đầu tháng đúng", () => {
    const month = buildCalendarMonth(2026, 9, events);
    expect(month.leadingBlanks).toBe(1); // 1/9/2026 là Thứ 3
    expect(month.days).toHaveLength(30);
    expect(month.days[0].key).toBe("2026-09-01");
  });

  it("sự kiện vào đúng ngày, sắp theo giờ; bỏ sự kiện tháng khác", () => {
    const month = buildCalendarMonth(2026, 9, events);
    const day23 = month.days[22];
    expect(day23.events.map((e) => e.id)).toEqual(["r1", "s1"]);
    // r1 hạn 18:00 ngày 23/9 < NOW (24/9) -> quá hạn.
    expect(day23.dots).toEqual(["session", "overdue"]);
    expect(month.days[24].dots).toEqual(["session-cancelled", "pending"]);
    expect(month.days.every((day) => day.events.every((e) => e.id !== "s3"))).toBe(true);
  });
});

describe("pendingBeforeSession", () => {
  it("đếm bài chưa nộp có hạn nằm giữa bây giờ và giờ học", () => {
    const startsAt = at("2026-09-24", "20:15");
    expect(
      pendingBeforeSession(
        [
          { status: "assigned", deadline: at("2026-09-24", "20:15") },
          { status: "in_progress", deadline: at("2026-09-24", "18:00") },
          { status: "submitted", deadline: at("2026-09-24", "18:00") },
          { status: "assigned", deadline: at("2026-09-23", "23:59") },
          { status: "assigned", deadline: at("2026-09-25", "23:59") },
          { status: "assigned", deadline: null }
        ],
        startsAt,
        NOW
      )
    ).toBe(2);
  });
});
