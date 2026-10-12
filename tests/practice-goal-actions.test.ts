import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("lib/actions/practice-goal.ts", "utf8");

describe("actions chỉ tiêu tự luyện", () => {
  it("bắt đầu bằng requireTeacher và giới hạn 0–20", () => {
    expect(source).toContain('"use server"');
    expect(source.match(/await requireTeacher\(\)/g)?.length).toBe(2);
    expect(source).toContain("MAX_PRACTICE_GOAL");
  });
  it("chỉ sửa học viên thuộc lớp của thầy", () => {
    expect(source).toMatch(/classes:\s*\{\s*some:\s*\{\s*class:\s*\{\s*(id:[^,]+,\s*)?teacherId/);
  });
});
