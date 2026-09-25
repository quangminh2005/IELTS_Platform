import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const actions = readFileSync("lib/actions/class-schedule.ts", "utf8");
const EXPORTED = ["saveClassSchedule", "updateClassSession", "addClassSession", "deleteClassSession"];

describe("action lịch học của giáo viên", () => {
  it("là file server action", () => {
    expect(actions.startsWith('"use server";')).toBe(true);
  });

  it.each(EXPORTED)("%s gọi requireTeacher() đầu tiên", (name) => {
    const body = actions.split(`export async function ${name}(`)[1] ?? "";
    const firstLine = body.slice(body.indexOf("{") + 1).trim().split("\n")[0];
    expect(firstLine).toContain("await requireTeacher()");
  });

  it("mọi truy vấn lớp/buổi đều lọc theo giáo viên đang đăng nhập", () => {
    expect(actions.match(/teacherId: teacher\.id/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
  });

  it("z.enum khớp chú thích enum trong schema", () => {
    expect(actions).toContain('z.enum(["offline", "online"])');
    expect(actions).toContain('z.enum(["scheduled", "cancelled"])');
    expect(actions).toContain('z.enum(["makeup", "extra"])');
  });

  it("buổi theo lịch cố định không xoá được", () => {
    expect(actions).toContain('existing.kind === "regular"');
  });
});

describe("cron nối buổi học", () => {
  const cron = readFileSync("app/api/cron/reminders/route.ts", "utf8");

  it("gọi topUpClassSessions trong try/catch riêng", () => {
    expect(cron).toMatch(/try\s*\{\s*sessionsCreated = await topUpClassSessions\(\);\s*\}\s*catch/);
  });

  // Chỗ kiểm cấu hình mail return sớm — nối buổi phải chạy trước nó.
  it("nối buổi chạy trước khi kiểm cấu hình mail, sau khi đánh thức DB", () => {
    const warm = cron.indexOf("warmUpDatabase(");
    const topUp = cron.indexOf("await topUpClassSessions()");
    const email = cron.indexOf("isEmailConfigured()");
    expect(warm).toBeGreaterThan(-1);
    expect(warm).toBeLessThan(topUp);
    expect(topUp).toBeLessThan(email);
  });
});
