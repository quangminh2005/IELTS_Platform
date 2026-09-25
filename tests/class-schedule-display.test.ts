import { describe, expect, it } from "vitest";
import {
  buildScheduleNotificationSources,
  buildSessionPicks,
  detectChangeKind,
  findNextSession,
  isValidMeetingUrl,
  parseHm,
  relativeSessionLabel,
  sessionChangeText,
  vnDateTime
} from "../lib/class-schedule";

const at = (ymd: string, hm: string) => vnDateTime(ymd, parseHm(hm) as number);

describe("findNextSession", () => {
  const sessions = [
    { id: "a", startsAt: at("2026-09-08", "20:15"), endsAt: at("2026-09-08", "21:45"), status: "scheduled" },
    { id: "b", startsAt: at("2026-09-10", "20:15"), endsAt: at("2026-09-10", "21:45"), status: "cancelled" },
    { id: "c", startsAt: at("2026-09-12", "09:00"), endsAt: at("2026-09-12", "10:30"), status: "scheduled" }
  ];

  it("buổi đang diễn ra vẫn là buổi tới", () => {
    expect(findNextSession(sessions, at("2026-09-08", "20:30"))?.id).toBe("a");
  });

  it("bỏ qua buổi nghỉ", () => {
    expect(findNextSession(sessions, at("2026-09-09", "08:00"))?.id).toBe("c");
  });

  it("không còn buổi nào -> null", () => {
    expect(findNextSession(sessions, at("2026-09-12", "11:00"))).toBeNull();
  });
});

describe("relativeSessionLabel", () => {
  const now = at("2026-09-24", "10:00"); // Thứ 5

  it("trong ngày: sáng/chiều/tối nay", () => {
    expect(relativeSessionLabel(at("2026-09-24", "08:00"), now)).toBe("Sáng nay 08:00");
    expect(relativeSessionLabel(at("2026-09-24", "14:00"), now)).toBe("Chiều nay 14:00");
    expect(relativeSessionLabel(at("2026-09-24", "20:15"), now)).toBe("Tối nay 20:15");
  });

  it("ngày mai, trong tuần, xa hơn", () => {
    expect(relativeSessionLabel(at("2026-09-25", "09:00"), now)).toBe("Ngày mai 09:00");
    expect(relativeSessionLabel(at("2026-09-26", "09:00"), now)).toBe("Thứ 7 26/9 09:00");
    expect(relativeSessionLabel(at("2026-09-30", "20:15"), now)).toBe("Thứ 4 30/9 20:15");
    expect(relativeSessionLabel(at("2026-10-01", "20:15"), now)).toBe("T5 1/10 20:15");
  });

  it("đổi ngày theo giờ VN, không theo UTC", () => {
    expect(relativeSessionLabel(at("2026-09-25", "00:30"), at("2026-09-24", "23:30"))).toBe("Ngày mai 00:30");
  });
});

describe("detectChangeKind", () => {
  const now = at("2026-09-20", "10:00");
  const before = {
    status: "scheduled",
    mode: "offline",
    startsAt: at("2026-09-26", "20:15"),
    endsAt: at("2026-09-26", "21:45")
  };

  it("nghỉ / học lại", () => {
    expect(detectChangeKind(before, { ...before, status: "cancelled" }, now)).toBe("cancelled");
    expect(detectChangeKind({ ...before, status: "cancelled" }, before, now)).toBe("restored");
  });

  it("dời giờ", () => {
    expect(
      detectChangeKind(before, { ...before, startsAt: at("2026-09-27", "20:15"), endsAt: at("2026-09-27", "21:45") }, now)
    ).toBe("moved");
  });

  it("đổi hình thức", () => {
    expect(detectChangeKind(before, { ...before, mode: "online" }, now)).toBe("online");
    expect(detectChangeKind({ ...before, mode: "online" }, before, now)).toBe("offline");
  });

  it("nghỉ quan trọng hơn dời", () => {
    expect(
      detectChangeKind(before, { ...before, status: "cancelled", startsAt: at("2026-09-27", "20:15") }, now)
    ).toBe("cancelled");
  });

  it("không đổi gì đáng báo, hoặc buổi đã diễn ra -> null", () => {
    expect(detectChangeKind(before, { ...before }, now)).toBeNull();
    expect(detectChangeKind(before, { ...before, status: "cancelled" }, at("2026-09-26", "20:30"))).toBeNull();
    expect(
      detectChangeKind({ ...before, status: "cancelled" }, { ...before, status: "cancelled", mode: "online" }, now)
    ).toBeNull();
  });
});

describe("sessionChangeText", () => {
  const base = { kind: "regular", startsAt: at("2026-09-26", "20:15"), originalStartsAt: null, className: "PĐ K1" };

  it("từng loại thay đổi", () => {
    expect(sessionChangeText({ ...base, changeKind: "cancelled" })).toBe("Nghỉ học buổi T7 26/9 (PĐ K1)");
    expect(sessionChangeText({ ...base, changeKind: "restored" })).toBe("Buổi T7 26/9 (PĐ K1) học lại như lịch");
    expect(sessionChangeText({ ...base, changeKind: "online" })).toBe("Buổi T7 26/9 (PĐ K1) chuyển học online");
    expect(sessionChangeText({ ...base, changeKind: "offline" })).toBe("Buổi T7 26/9 (PĐ K1) chuyển về học trực tiếp");
    expect(
      sessionChangeText({ ...base, changeKind: "moved", originalStartsAt: at("2026-09-25", "20:15") })
    ).toBe("Buổi T6 25/9 (PĐ K1) dời sang T7 26/9 20:15");
  });

  it("thêm buổi: học bù / tăng cường", () => {
    const added = { ...base, changeKind: "added", startsAt: at("2026-09-28", "20:15") };
    expect(sessionChangeText({ ...added, kind: "makeup" })).toBe("Thêm buổi học bù T2 28/9 20:15 (PĐ K1)");
    expect(sessionChangeText({ ...added, kind: "extra" })).toBe("Thêm buổi tăng cường T2 28/9 20:15 (PĐ K1)");
  });
});

describe("isValidMeetingUrl", () => {
  it("chỉ nhận http(s)", () => {
    expect(isValidMeetingUrl("https://meet.google.com/abc-defg-hij")).toBe(true);
    expect(isValidMeetingUrl("http://zoom.us/j/1")).toBe(true);
    expect(isValidMeetingUrl("javascript:alert(1)")).toBe(false);
    expect(isValidMeetingUrl("meet.google.com/abc")).toBe(false);
    expect(isValidMeetingUrl("")).toBe(false);
  });
});

describe("buildSessionPicks", () => {
  it("mỗi lớp lấy buổi sớm nhất", () => {
    const picks = buildSessionPicks([
      { classId: "k1", className: "PĐ K1", startsAt: at("2026-09-25", "20:15") },
      { classId: "cb", className: "CB K1", startsAt: at("2026-09-24", "20:00") },
      { classId: "k1", className: "PĐ K1", startsAt: at("2026-09-24", "20:15") }
    ]);
    expect(picks).toEqual([
      { key: "cb", label: "Trước buổi CB K1 · T5 24/9 20:00", date: "2026-09-24", time: "20:00" },
      { key: "k1", label: "Trước buổi PĐ K1 · T5 24/9 20:15", date: "2026-09-24", time: "20:15" }
    ]);
  });
});

describe("buildScheduleNotificationSources", () => {
  const memberships = [
    { classId: "k1", className: "PĐ K1", joinedAt: at("2026-09-10", "10:00"), scheduleChangedAt: at("2026-09-15", "10:00") },
    { classId: "k2", className: "PĐ K2", joinedAt: at("2026-09-20", "10:00"), scheduleChangedAt: at("2026-09-15", "10:00") }
  ];

  it("chỉ báo thay đổi xảy ra sau khi học viên vào lớp", () => {
    const result = buildScheduleNotificationSources({
      memberships,
      sessions: [
        { id: "a", classId: "k1", startsAt: at("2026-09-26", "20:15"), originalStartsAt: null, kind: "regular", changeKind: "cancelled", changedAt: at("2026-09-21", "09:00") },
        { id: "b", classId: "k2", startsAt: at("2026-09-26", "09:00"), originalStartsAt: null, kind: "regular", changeKind: "online", changedAt: at("2026-09-18", "09:00") },
        { id: "c", classId: "k9", startsAt: at("2026-09-26", "09:00"), originalStartsAt: null, kind: "regular", changeKind: "online", changedAt: at("2026-09-21", "09:00") }
      ]
    });
    expect(result.sessions).toEqual([
      { sessionId: "a", text: "Nghỉ học buổi T7 26/9 (PĐ K1)", dayKey: "2026-09-26", changedAt: at("2026-09-21", "09:00") }
    ]);
    expect(result.schedules).toEqual([{ classId: "k1", className: "PĐ K1", changedAt: at("2026-09-15", "10:00") }]);
  });
});
