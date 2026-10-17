import { describe, expect, it } from "vitest";
import {
  buildUnitHistory,
  materialStudentStatus,
  overlapLabel,
  studentOverlap,
  unitStudentCounts,
  type UnitHistoryRow
} from "../lib/unit-history";

function row(patch: Partial<UnitHistoryRow>): UnitHistoryRow {
  return {
    studentId: "s1",
    recipientStatus: "assigned",
    isPractice: false,
    units: [{ id: "u1", skill: "reading" }],
    submittedSkills: [],
    anyAttemptSubmitted: false,
    ...patch
  };
}

describe("buildUnitHistory", () => {
  it("bài giao chưa nộp → assigned, đã nộp/đã chấm → done", () => {
    const history = buildUnitHistory([
      row({ studentId: "a" }),
      row({ studentId: "b", recipientStatus: "submitted" }),
      row({ studentId: "c", recipientStatus: "reviewed" })
    ]);
    expect(history.u1).toEqual({ a: "assigned", b: "done", c: "done" });
  });

  it("tự luyện mở mà chưa nộp thì không tính", () => {
    const history = buildUnitHistory([row({ isPractice: true, recipientStatus: "in_progress" })]);
    expect(history.u1).toBeUndefined();
  });

  it("tự luyện đã nộp (kể cả lượt sau) → done", () => {
    const history = buildUnitHistory([row({ isPractice: true, anyAttemptSubmitted: true })]);
    expect(history.u1).toEqual({ s1: "done" });
  });

  it("nộp riêng một kỹ năng chỉ đánh done cho phần của kỹ năng đó", () => {
    const history = buildUnitHistory([
      row({
        units: [
          { id: "L1", skill: "listening" },
          { id: "R1", skill: "reading" }
        ],
        submittedSkills: ["listening"]
      })
    ]);
    expect(history.L1).toEqual({ s1: "done" });
    expect(history.R1).toEqual({ s1: "assigned" });
  });

  it("done thắng assigned dù thứ tự dòng thế nào", () => {
    const history = buildUnitHistory([
      row({ recipientStatus: "submitted" }),
      row({ recipientStatus: "assigned" })
    ]);
    expect(history.u1).toEqual({ s1: "done" });
  });
});

describe("đếm trùng", () => {
  const history = buildUnitHistory([
    row({ studentId: "a", recipientStatus: "submitted", units: [{ id: "u1", skill: "reading" }, { id: "u2", skill: "reading" }] }),
    row({ studentId: "b", units: [{ id: "u2", skill: "reading" }] })
  ]);

  it("studentOverlap đếm theo các phần đang chọn", () => {
    expect(studentOverlap(history, "a", ["u1", "u2", "u3"])).toEqual({ done: 2, assigned: 0 });
    expect(studentOverlap(history, "b", ["u1", "u2"])).toEqual({ done: 0, assigned: 1 });
    expect(studentOverlap(history, "z", ["u1"])).toEqual({ done: 0, assigned: 0 });
  });

  it("unitStudentCounts đếm học viên của một phần", () => {
    expect(unitStudentCounts(history, "u2")).toEqual({ done: 1, assigned: 1 });
    expect(unitStudentCounts(history, "nope")).toEqual({ done: 0, assigned: 0 });
  });

  it("materialStudentStatus gộp cả tài liệu, done thắng", () => {
    expect(materialStudentStatus(history, ["u1", "u2"])).toEqual({ a: "done", b: "assigned" });
  });

  it("overlapLabel", () => {
    expect(overlapLabel({ done: 2, assigned: 1 }, 4)).toBe("Đã làm 2/4 phần");
    expect(overlapLabel({ done: 1, assigned: 0 }, 1)).toBe("Đã làm phần này");
    expect(overlapLabel({ done: 0, assigned: 1 }, 3)).toBe("Đang được giao 1/3 phần");
    expect(overlapLabel({ done: 0, assigned: 0 }, 3)).toBeNull();
  });
});
