import { describe, expect, it } from "vitest";
import {
  formatHm,
  formatShortDate,
  numberSessions,
  parseHm,
  parseScheduleSlots,
  planRegularSessions,
  scheduleSignature,
  sessionNumberText,
  vnDateTime,
  vnIsoWeekday,
  vnMidnight,
  type ScheduleSlot,
  type SessionForPlan
} from "../lib/class-schedule";

const at = (ymd: string, hm: string) => vnDateTime(ymd, parseHm(hm) as number);

function row(id: string, startsAt: Date, endsAt: Date, extra: Partial<SessionForPlan> = {}): SessionForPlan {
  return { id, startsAt, endsAt, status: "scheduled", kind: "regular", edited: false, originalStartsAt: null, ...extra };
}

// Lịch thật của lớp PĐ K2: tối Thứ 3 20:15–21:45, sáng Thứ 7 9:00–10:30.
const PD_K2: ScheduleSlot[] = [
  { weekday: 2, startMinute: 1215, endMinute: 1305 },
  { weekday: 6, startMinute: 540, endMinute: 630 }
];

// 4 buổi đầu của PĐ K2 khi khai giảng 1/9/2026 (Thứ 3).
function pdK2Rows(): SessionForPlan[] {
  return [
    row("s1", at("2026-09-01", "20:15"), at("2026-09-01", "21:45")),
    row("s2", at("2026-09-05", "09:00"), at("2026-09-05", "10:30")),
    row("s3", at("2026-09-08", "20:15"), at("2026-09-08", "21:45")),
    row("s4", at("2026-09-12", "09:00"), at("2026-09-12", "10:30"))
  ];
}

const BASE = {
  slots: PD_K2,
  scheduleStartDate: vnMidnight("2026-09-01"),
  scheduleEndDate: null,
  totalSessions: 4,
  applyFrom: vnMidnight("2026-09-01"),
  now: vnMidnight("2026-08-25")
};

const starts = (items: Array<{ startsAt: Date }>) => items.map((item) => item.startsAt.toISOString());

describe("giờ VN", () => {
  it("parseHm / formatHm", () => {
    expect(parseHm("20:15")).toBe(1215);
    expect(parseHm("9:00")).toBe(540);
    expect(parseHm("24:00")).toBeNull();
    expect(parseHm("abc")).toBeNull();
    expect(formatHm(540)).toBe("09:00");
    expect(formatHm(1215)).toBe("20:15");
  });

  it("vnDateTime đổi giờ VN sang UTC", () => {
    expect(at("2026-09-01", "20:15").toISOString()).toBe("2026-09-01T13:15:00.000Z");
    expect(at("2026-09-05", "06:00").toISOString()).toBe("2026-09-04T23:00:00.000Z");
  });

  it("vnIsoWeekday tính theo giờ VN (1 = Thứ 2, 7 = CN)", () => {
    expect(vnIsoWeekday(at("2026-09-01", "20:15"))).toBe(2);
    expect(vnIsoWeekday(at("2026-09-27", "00:30"))).toBe(7);
  });

  it("formatShortDate", () => {
    expect(formatShortDate(at("2026-09-26", "20:15"))).toBe("T7 26/9");
    expect(formatShortDate(at("2026-09-27", "20:00"))).toBe("CN 27/9");
  });
});

describe("parseScheduleSlots", () => {
  it("đọc và sắp theo thứ rồi giờ", () => {
    expect(
      parseScheduleSlots([
        { weekday: 6, start: "09:00", end: "10:30" },
        { weekday: 2, start: "20:15", end: "21:45" }
      ])
    ).toEqual([
      { weekday: 2, startMinute: 1215, endMinute: 1305 },
      { weekday: 6, startMinute: 540, endMinute: 630 }
    ]);
  });

  it("từ chối giờ kết thúc không sau giờ bắt đầu", () => {
    expect(() => parseScheduleSlots([{ weekday: 2, start: "20:15", end: "20:15" }])).toThrow(/giờ kết thúc/);
  });

  it("từ chối khung giờ trùng", () => {
    expect(() =>
      parseScheduleSlots([
        { weekday: 2, start: "20:15", end: "21:45" },
        { weekday: 2, start: "20:15", end: "21:30" }
      ])
    ).toThrow(/trùng/);
  });

  it("từ chối thứ không hợp lệ, dữ liệu không phải mảng, quá 14 khung", () => {
    expect(() => parseScheduleSlots([{ weekday: 8, start: "20:15", end: "21:45" }])).toThrow();
    expect(() => parseScheduleSlots("x")).toThrow();
    const many = Array.from({ length: 15 }, (_, i) => ({
      weekday: 1,
      start: `${String(i + 6).padStart(2, "0")}:00`,
      end: `${String(i + 6).padStart(2, "0")}:30`
    }));
    expect(() => parseScheduleSlots(many)).toThrow(/14/);
  });
});

describe("scheduleSignature", () => {
  const base = { slots: PD_K2, startDate: vnMidnight("2026-09-01"), totalSessions: 24, endDate: null, location: null };

  it("không phụ thuộc thứ tự khung giờ", () => {
    expect(scheduleSignature(base)).toBe(scheduleSignature({ ...base, slots: [PD_K2[1], PD_K2[0]] }));
  });

  it("đổi địa điểm hoặc số buổi là khác", () => {
    expect(scheduleSignature(base)).not.toBe(scheduleSignature({ ...base, location: "Phòng 2" }));
    expect(scheduleSignature(base)).not.toBe(scheduleSignature({ ...base, totalSessions: 20 }));
  });
});

describe("planRegularSessions", () => {
  it("lớp PĐ K2 có số buổi: sinh đúng ngày giờ và dừng ở buổi thứ N", () => {
    const plan = planRegularSessions({ ...BASE, existing: [] });
    expect(starts(plan.create)).toEqual(starts(pdK2Rows()));
    expect(plan.create[0].endsAt.toISOString()).toBe("2026-09-01T14:45:00.000Z");
    expect(plan.deleteIds).toEqual([]);
  });

  it("chạy lại lần hai không đổi gì", () => {
    const plan = planRegularSessions({ ...BASE, existing: pdK2Rows() });
    expect(plan).toEqual({ create: [], deleteIds: [] });
  });

  it("cho nghỉ 1 buổi -> cuối khoá thêm 1 buổi, buổi nghỉ không mọc lại", () => {
    const rows = pdK2Rows();
    rows[1] = { ...rows[1], status: "cancelled", edited: true };
    const plan = planRegularSessions({ ...BASE, existing: rows });
    expect(starts(plan.create)).toEqual([at("2026-09-15", "20:15").toISOString()]);
    expect(plan.deleteIds).toEqual([]);
  });

  it("thêm học bù -> buổi cuối khoá tự rút đi", () => {
    const makeup = row("m1", at("2026-09-06", "20:15"), at("2026-09-06", "21:45"), { kind: "makeup", edited: true });
    const plan = planRegularSessions({ ...BASE, existing: [...pdK2Rows(), makeup] });
    expect(plan).toEqual({ create: [], deleteIds: ["s4"] });
  });

  it("buổi tăng cường không ảnh hưởng số buổi", () => {
    const extra = row("x1", at("2026-09-06", "20:15"), at("2026-09-06", "21:45"), { kind: "extra", edited: true });
    const plan = planRegularSessions({ ...BASE, existing: [...pdK2Rows(), extra] });
    expect(plan).toEqual({ create: [], deleteIds: [] });
  });

  it("buổi đã dời không mọc lại ở giờ gốc", () => {
    const rows = pdK2Rows();
    rows[2] = {
      ...rows[2],
      startsAt: at("2026-09-09", "20:15"),
      endsAt: at("2026-09-09", "21:45"),
      originalStartsAt: at("2026-09-08", "20:15"),
      edited: true
    };
    const plan = planRegularSessions({ ...BASE, existing: rows });
    expect(plan).toEqual({ create: [], deleteIds: [] });
  });

  it("đổi lịch cố định: giữ buổi trước applyFrom và buổi đã sửa tay, tạo lại phần còn lại", () => {
    const rows = pdK2Rows();
    rows[2] = { ...rows[2], edited: true };
    const plan = planRegularSessions({
      ...BASE,
      slots: [{ weekday: 3, startMinute: 1080, endMinute: 1170 }],
      existing: rows,
      applyFrom: vnMidnight("2026-09-06"),
      now: vnMidnight("2026-09-06")
    });
    expect(plan.deleteIds).toEqual(["s4"]);
    expect(starts(plan.create)).toEqual([at("2026-09-09", "18:00").toISOString()]);
  });

  it("bỏ hết khung giờ -> xoá các buổi thay được", () => {
    const plan = planRegularSessions({ ...BASE, slots: [], existing: pdK2Rows(), applyFrom: vnMidnight("2026-09-06") });
    expect(plan).toEqual({ create: [], deleteIds: ["s3", "s4"] });
  });

  it("lớp học liên tục: giữ sẵn 12 tuần kể từ now", () => {
    const now = at("2026-09-24", "10:00");
    const plan = planRegularSessions({
      slots: [
        { weekday: 4, startMinute: 1200, endMinute: 1290 },
        { weekday: 7, startMinute: 1200, endMinute: 1290 }
      ],
      scheduleStartDate: vnMidnight("2026-09-24"),
      scheduleEndDate: null,
      totalSessions: null,
      existing: [],
      applyFrom: now,
      now
    });
    expect(plan.create).toHaveLength(24);
    expect(plan.create[0].startsAt.toISOString()).toBe(at("2026-09-24", "20:00").toISOString());
    expect(plan.create[23].startsAt.toISOString()).toBe(at("2026-12-13", "20:00").toISOString());
  });

  it("lớp có ngày kết thúc: tính cả ngày kết thúc", () => {
    const plan = planRegularSessions({
      slots: [{ weekday: 4, startMinute: 1200, endMinute: 1290 }],
      scheduleStartDate: vnMidnight("2026-09-24"),
      scheduleEndDate: vnMidnight("2026-10-08"),
      totalSessions: null,
      existing: [],
      applyFrom: vnMidnight("2026-09-24"),
      now: vnMidnight("2026-09-20")
    });
    expect(starts(plan.create)).toEqual([
      at("2026-09-24", "20:00").toISOString(),
      at("2026-10-01", "20:00").toISOString(),
      at("2026-10-08", "20:00").toISOString()
    ]);
  });

  it("ngày khai giảng sau applyFrom -> bắt đầu từ ngày khai giảng", () => {
    const plan = planRegularSessions({
      slots: [{ weekday: 4, startMinute: 1200, endMinute: 1290 }],
      scheduleStartDate: vnMidnight("2026-10-01"),
      scheduleEndDate: null,
      totalSessions: 2,
      existing: [],
      applyFrom: vnMidnight("2026-09-24"),
      now: vnMidnight("2026-09-24")
    });
    expect(starts(plan.create)).toEqual([
      at("2026-10-01", "20:00").toISOString(),
      at("2026-10-08", "20:00").toISOString()
    ]);
  });
});

describe("numberSessions", () => {
  it("bỏ qua buổi nghỉ và tăng cường, đếm học bù", () => {
    const numbers = numberSessions([
      row("e", at("2026-09-08", "20:15"), at("2026-09-08", "21:45")),
      row("a", at("2026-09-01", "20:15"), at("2026-09-01", "21:45")),
      row("b", at("2026-09-05", "09:00"), at("2026-09-05", "10:30"), { status: "cancelled" }),
      row("c", at("2026-09-06", "20:15"), at("2026-09-06", "21:45"), { kind: "extra" }),
      row("d", at("2026-09-07", "20:15"), at("2026-09-07", "21:45"), { kind: "makeup" })
    ]);
    expect(Object.fromEntries(numbers)).toEqual({ a: 1, d: 2, e: 3 });
  });

  it("sessionNumberText", () => {
    expect(sessionNumberText(5, 24)).toBe("Buổi 5/24");
    expect(sessionNumberText(5, null)).toBe("Buổi 5");
    expect(sessionNumberText(null, 24)).toBeNull();
  });
});
