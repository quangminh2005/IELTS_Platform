import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("lược đồ BugReport", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");

  it("có model BugReport với đủ cột", () => {
    const start = schema.indexOf("model BugReport");
    expect(start).toBeGreaterThan(-1);
    const model = schema.slice(start);
    for (const column of [
      "studentId",
      "category",
      "description",
      "imageUrl",
      "pageUrl",
      "userAgent",
      "viewport",
      "attemptId",
      "contextJson",
      "teacherNote",
      "resolvedAt",
      "createdAt"
    ]) {
      expect(model).toContain(column);
    }
    expect(model).toMatch(/status\s+String\s+@default\("open"\)/);
    expect(model).toContain("onDelete: Cascade");
  });

  it("StudentProfile có quan hệ bugReports", () => {
    const model = schema.slice(
      schema.indexOf("model StudentProfile"),
      schema.indexOf("model Class")
    );
    expect(model).toMatch(/bugReports\s+BugReport\[\]/);
  });

  it("comment đầu schema liệt kê giá trị category và status", () => {
    expect(schema).toContain("audio | answer | display | other");
    expect(schema).toContain("open | resolved");
  });

  // Quên câu này là prod 500: Prisma Client không kiểm schema lúc chạy, lỗi chỉ
  // lộ khi có request đụng đúng bảng còn thiếu.
  it("ensure-db.mjs tạo bảng BugReport", () => {
    const script = readFileSync("scripts/ensure-db.mjs", "utf8");
    expect(script).toContain('CREATE TABLE IF NOT EXISTS "BugReport"');
    expect(script).toContain('"BugReport_studentId_createdAt_idx"');
    expect(script).toContain('"BugReport_status_createdAt_idx"');
    expect(script).toContain("BugReport_studentId_fkey");
  });
});
