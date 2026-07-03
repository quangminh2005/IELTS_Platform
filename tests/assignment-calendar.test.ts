import { describe, expect, it } from "vitest";
import {
  vnDayKey,
  bucketAssignmentsByDay,
  buildMonthGrid,
  type CalendarAssignment
} from "../lib/assignment-calendar";

function fakeAssignment(
  id: string,
  createdAt: string,
  deadline: string | null
): CalendarAssignment {
  return { id, title: id, createdAt, deadline, unitCount: 1, recipients: [] };
}

describe("vnDayKey", () => {
  it("chuyển mốc UTC sang ngày theo lịch Việt Nam (UTC+7)", () => {
    // 18:00Z ngày 02/07 => 01:00 ngày 03/07 giờ VN
    expect(vnDayKey("2026-07-02T18:00:00.000Z")).toBe("2026-07-03");
  });
});

describe("bucketAssignmentsByDay", () => {
  const a = fakeAssignment("a", "2026-07-02T18:00:00.000Z", "2026-07-05T16:59:00.000Z");
  const b = fakeAssignment("b", "2026-07-03T02:00:00.000Z", null);

  it("xếp theo ngày giao (giờ VN)", () => {
    const map = bucketAssignmentsByDay([a, b], "assigned");
    expect(map.get("2026-07-03")?.map((x) => x.id)).toEqual(["a", "b"]);
  });

  it("xếp theo hạn nộp và bỏ bài không có hạn", () => {
    const map = bucketAssignmentsByDay([a, b], "deadline");
    expect(map.get("2026-07-05")?.map((x) => x.id)).toEqual(["a"]);
    expect([...map.values()].flat().map((x) => x.id)).toEqual(["a"]);
  });
});

describe("buildMonthGrid", () => {
  it("chèn ô trống đầu tháng theo tuần bắt đầu Thứ Hai", () => {
    // Tháng 7/2026: ngày 1 là Thứ Tư => 2 ô trống đầu
    const cells = buildMonthGrid(2026, 6);
    expect(cells.slice(0, 4)).toEqual([null, null, "2026-07-01", "2026-07-02"]);
    expect(cells).toContain("2026-07-31");
    expect(cells.length % 7).toBe(0);
  });
});

import {
  isSubmissionLate,
  countGradedAnswers,
  studentsGroupedByClass,
  formatAttemptResult,
  type CalendarRecipient
} from "../lib/assignment-calendar";

function recip(studentId: string, classIds: string[]): CalendarRecipient {
  return {
    studentId,
    displayName: studentId,
    email: `${studentId}@x.com`,
    classIds,
    status: "assigned",
    attempt: null
  };
}

describe("isSubmissionLate", () => {
  it("trễ khi nộp sau hạn", () => {
    expect(isSubmissionLate("2026-07-05T17:00:00Z", "2026-07-05T16:59:00Z")).toBe(true);
  });
  it("không trễ khi nộp trước hạn", () => {
    expect(isSubmissionLate("2026-07-05T10:00:00Z", "2026-07-05T16:59:00Z")).toBe(false);
  });
  it("không trễ khi thiếu hạn hoặc chưa nộp", () => {
    expect(isSubmissionLate(null, "2026-07-05T16:59:00Z")).toBe(false);
    expect(isSubmissionLate("2026-07-05T10:00:00Z", null)).toBe(false);
  });
});

describe("countGradedAnswers", () => {
  it("chỉ đếm câu đã chấm tự động (isCorrect khác null)", () => {
    const answers = [
      { isCorrect: true },
      { isCorrect: false },
      { isCorrect: true },
      { isCorrect: null } // Writing/Speaking chờ chấm
    ];
    expect(countGradedAnswers(answers)).toEqual({ correct: 2, total: 3 });
  });
});

describe("studentsGroupedByClass", () => {
  const classes = [
    { id: "c1", name: "Lớp 1" },
    { id: "c2", name: "Lớp 2" }
  ];
  const recipients = [recip("a", ["c1"]), recip("b", ["c1", "c2"]), recip("c", [])];

  it("gom theo từng lớp, học viên nhiều lớp xuất hiện ở mỗi lớp", () => {
    const groups = studentsGroupedByClass(recipients, classes, null);
    expect(groups.map((g) => g.className)).toEqual(["Lớp 1", "Lớp 2", "Chưa xếp lớp"]);
    expect(groups[0].students.map((s) => s.studentId)).toEqual(["a", "b"]);
    expect(groups[1].students.map((s) => s.studentId)).toEqual(["b"]);
    expect(groups[2].students.map((s) => s.studentId)).toEqual(["c"]);
  });

  it("lọc theo một lớp thì chỉ trả về học viên lớp đó", () => {
    const groups = studentsGroupedByClass(recipients, classes, "c2");
    expect(groups).toHaveLength(1);
    expect(groups[0].students.map((s) => s.studentId)).toEqual(["b"]);
  });
});

describe("formatAttemptResult", () => {
  const base = { scorePercent: null, hasPendingManual: false, status: "submitted" };
  it("bài đủ 40 câu: band + số câu đúng", () => {
    expect(
      formatAttemptResult({ ...base, band: 8, correct: 35, total: 40 })
    ).toBe("8.0 · 35/40");
  });
  it("bài lẻ không có band: phần trăm + số câu đúng", () => {
    expect(
      formatAttemptResult({ ...base, band: null, correct: 8, total: 10, scorePercent: 80 })
    ).toBe("80% · 8/10");
  });
  it("chỉ có bài chấm tay chưa chấm: Chờ chấm", () => {
    expect(
      formatAttemptResult({ ...base, band: null, correct: 0, total: 0, hasPendingManual: true })
    ).toBe("Chờ chấm");
  });
  it("có phần tự chấm và phần chờ chấm tay", () => {
    expect(
      formatAttemptResult({ ...base, band: 7, correct: 30, total: 40, hasPendingManual: true })
    ).toBe("7.0 · 30/40 · Chờ chấm");
  });
});
