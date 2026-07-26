import { describe, expect, it } from "vitest";
import { resolveAssignmentClassId } from "../lib/assignment-class";

describe("resolveAssignmentClassId", () => {
  it("mọi học viên cùng một lớp -> gắn lớp đó cho bài giao", () => {
    expect(resolveAssignmentClassId([["lop-a"], ["lop-a"], ["lop-a"]])).toBe("lop-a");
  });

  it("học viên thuộc nhiều lớp khác nhau -> null (bài giao chung, không của lớp nào)", () => {
    expect(resolveAssignmentClassId([["lop-a"], ["lop-b"]])).toBeNull();
  });

  it("học viên học 2 lớp nhưng cả nhóm chung đúng một lớp -> lấy lớp chung đó", () => {
    expect(resolveAssignmentClassId([["lop-a", "lop-b"], ["lop-a"]])).toBe("lop-a");
  });

  it("cả nhóm chung tới 2 lớp -> không đoán bừa, trả null", () => {
    expect(
      resolveAssignmentClassId([
        ["lop-a", "lop-b"],
        ["lop-a", "lop-b"]
      ])
    ).toBeNull();
  });

  it("có học viên chưa vào lớp nào -> null", () => {
    expect(resolveAssignmentClassId([["lop-a"], []])).toBeNull();
    expect(resolveAssignmentClassId([])).toBeNull();
  });
});
