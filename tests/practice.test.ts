import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  countsForStats,
  decideAttemptStart,
  excludePracticeAssignment,
  onlyPracticeAssignment,
  practiceScopeKey,
  practiceSkillTimeLimits
} from "@/lib/practice";

const root = process.cwd();

describe("practiceScopeKey", () => {
  it("gộp học viên + đề + phần thành khoá", () => {
    expect(practiceScopeKey("hv1", "de1", "phan1")).toBe("hv1:de1:phan1");
  });

  it("luyện cả đề dùng hậu tố all", () => {
    expect(practiceScopeKey("hv1", "de1", null)).toBe("hv1:de1:all");
  });

  it("luyện cả đề và luyện một phần là hai khoá khác nhau", () => {
    expect(practiceScopeKey("hv1", "de1", null)).not.toBe(
      practiceScopeKey("hv1", "de1", "phan1")
    );
  });
});

describe("mảnh điều kiện lọc", () => {
  it("loại bài tự luyện", () => {
    expect(excludePracticeAssignment).toEqual({ mode: { not: "practice" } });
  });

  it("chỉ lấy bài tự luyện", () => {
    expect(onlyPracticeAssignment).toEqual({ mode: "practice" });
  });

  it("thống kê chỉ tính lượt đầu", () => {
    expect(countsForStats).toEqual({ attemptRound: 1 });
  });
});

describe("practiceSkillTimeLimits", () => {
  it("chọn không tính giờ thì trả về null", () => {
    const units = [{ skill: "reading", defaultTimeLimitMinutes: 20 }];
    expect(practiceSkillTimeLimits(units, false)).toBeNull();
  });

  it("cộng dồn thời gian mặc định theo kỹ năng", () => {
    const units = [
      { skill: "reading", defaultTimeLimitMinutes: 20 },
      { skill: "reading", defaultTimeLimitMinutes: 20 },
      { skill: "listening", defaultTimeLimitMinutes: 10 }
    ];
    expect(practiceSkillTimeLimits(units, true)).toBe(
      JSON.stringify({ reading: 40, listening: 10 })
    );
  });

  it("phần không đặt thời gian thì bị bỏ qua", () => {
    const units = [
      { skill: "reading", defaultTimeLimitMinutes: null },
      { skill: "reading", defaultTimeLimitMinutes: 20 }
    ];
    expect(practiceSkillTimeLimits(units, true)).toBe(JSON.stringify({ reading: 20 }));
  });

  it("không phần nào có thời gian thì trả về null", () => {
    const units = [{ skill: "writing", defaultTimeLimitMinutes: null }];
    expect(practiceSkillTimeLimits(units, true)).toBeNull();
  });
});

describe("decideAttemptStart", () => {
  it("chưa có lượt nào thì tạo lượt 1", () => {
    expect(decideAttemptStart("homework", null)).toEqual({ kind: "new", attemptRound: 1 });
  });

  it("đang làm dở thì tiếp tục lượt đó, kể cả bài tự luyện", () => {
    const latest = { id: "a1", status: "in_progress", attemptRound: 2 };
    expect(decideAttemptStart("practice", latest)).toEqual({ kind: "resume", attemptId: "a1" });
  });

  it("bài giao đã nộp thì KHÔNG tạo lượt mới", () => {
    const latest = { id: "a1", status: "submitted", attemptRound: 1 };
    expect(decideAttemptStart("homework", latest)).toEqual({ kind: "resume", attemptId: "a1" });
  });

  it("bài tự luyện đã nộp thì tạo lượt kế tiếp", () => {
    const latest = { id: "a1", status: "submitted", attemptRound: 2 };
    expect(decideAttemptStart("practice", latest)).toEqual({ kind: "new", attemptRound: 3 });
  });
});

describe("cột mới đã khai báo đủ chỗ", () => {
  const schema = readFileSync(join(root, "prisma", "schema.prisma"), "utf8");
  const ensureDb = readFileSync(join(root, "scripts", "ensure-db.mjs"), "utf8");

  it("schema có ba cột mới", () => {
    expect(schema).toMatch(/practiceOpen\s+Boolean\s+@default\(false\)/);
    expect(schema).toMatch(/practiceScopeKey\s+String\?\s+@unique/);
    expect(schema).toMatch(/attemptRound\s+Int\s+@default\(1\)/);
  });

  // Dự án không dùng migrations: cột mới chỉ lên được prod qua ensure-db.mjs.
  it("ensure-db.mjs áp đủ ba cột lên prod", () => {
    expect(ensureDb).toContain('"Material" ADD COLUMN IF NOT EXISTS "practiceOpen"');
    expect(ensureDb).toContain('"Assignment" ADD COLUMN IF NOT EXISTS "practiceScopeKey"');
    expect(ensureDb).toContain('"Attempt" ADD COLUMN IF NOT EXISTS "attemptRound"');
    expect(ensureDb).toContain('"Assignment_practiceScopeKey_key"');
  });
});
