import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(relative: string): string {
  return readFileSync(join(process.cwd(), ...relative.split("/")), "utf8");
}

const schema = read("prisma/schema.prisma");
const ensureDb = read("scripts/ensure-db.mjs");

function modelBlock(name: string): string {
  return schema.split(`model ${name} {`)[1]?.split("\n}")[0] ?? "";
}

const CLASS_COLUMNS: Array<[string, string]> = [
  ["scheduleStartDate", "TIMESTAMP(3)"],
  ["totalSessions", "INTEGER"],
  ["scheduleEndDate", "TIMESTAMP(3)"],
  ["location", "TEXT"],
  ["scheduleAppliesFrom", "TIMESTAMP(3)"],
  ["scheduleChangedAt", "TIMESTAMP(3)"]
];

describe("lược đồ lịch học", () => {
  it.each(CLASS_COLUMNS)("Class có cột %s", (column) => {
    expect(modelBlock("Class")).toMatch(new RegExp(`\\n\\s*${column}\\s+\\w+\\?`));
  });

  // Dự án dùng db push, không có migrations: thiếu dòng này là prod 500 ngay lần deploy đầu.
  it.each(CLASS_COLUMNS)("ensure-db thêm cột Class.%s", (column, type) => {
    expect(ensureDb).toContain(`ALTER TABLE "Class" ADD COLUMN IF NOT EXISTS "${column}" ${type};`);
  });

  it("có model ClassScheduleSlot và ClassSession", () => {
    expect(modelBlock("ClassScheduleSlot")).toContain("weekday");
    expect(modelBlock("ClassSession")).toContain("originalStartsAt");
    expect(modelBlock("ClassSession")).toContain("@@index([classId, startsAt])");
  });

  it("ensure-db tạo 2 bảng mới kèm khoá ngoại và index", () => {
    expect(ensureDb).toContain('CREATE TABLE IF NOT EXISTS "ClassScheduleSlot"');
    expect(ensureDb).toContain('CREATE TABLE IF NOT EXISTS "ClassSession"');
    expect(ensureDb).toContain("ClassScheduleSlot_classId_fkey");
    expect(ensureDb).toContain("ClassSession_classId_fkey");
    expect(ensureDb).toContain('"ClassScheduleSlot_classId_idx"');
    expect(ensureDb).toContain('"ClassSession_classId_startsAt_idx"');
  });

  it("chú thích enum khớp giá trị", () => {
    expect(schema).toContain("// enum SessionStatus (ClassSession.status): scheduled | cancelled");
    expect(schema).toContain("// enum SessionMode (ClassSession.mode): offline | online");
    expect(schema).toContain("// enum SessionKind (ClassSession.kind): regular | makeup | extra");
    expect(schema).toContain(
      "// enum SessionChangeKind (ClassSession.changeKind): cancelled | restored | moved | online | offline | added"
    );
  });
});
