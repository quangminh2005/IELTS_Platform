import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  SPEAKING_PLAN_GRACE_SECONDS,
  canEditSpeakingPlan,
  formatPlanClock,
  assignmentPrepSeconds,
  formatPrepDuration,
  parseSpeakingPrepSeconds,
  splitSpeakingPrep,
  speakingPlanRemainingSeconds,
  speakingPlanUsedSeconds
} from "@/lib/speaking-plan";

const start = new Date("2026-09-25T10:00:00.000Z");
const at = (seconds: number) => new Date(start.getTime() + seconds * 1000);

describe("parseSpeakingPrepSeconds", () => {
  it("không tick = tắt", () => {
    expect(parseSpeakingPrepSeconds(null, "30", "seconds")).toBeNull();
    expect(parseSpeakingPrepSeconds("", "2", "minutes")).toBeNull();
  });

  it("tick mà số trống/sai thì lấy mặc định 1 phút", () => {
    expect(parseSpeakingPrepSeconds("on", "", "minutes")).toBe(60);
    expect(parseSpeakingPrepSeconds("on", null, "seconds")).toBe(60);
    expect(parseSpeakingPrepSeconds("on", "abc", "minutes")).toBe(60);
  });

  it("giữ kiểu nhập phút như cũ", () => {
    expect(parseSpeakingPrepSeconds("on", "3", "minutes")).toBe(180);
    expect(parseSpeakingPrepSeconds("on", "1.5", "minutes")).toBe(90);
    expect(parseSpeakingPrepSeconds("on", "99", "minutes")).toBe(600);
    // Không có đơn vị (form cũ) thì hiểu là phút.
    expect(parseSpeakingPrepSeconds("on", "2", null)).toBe(120);
  });

  it("nhập theo giây: 30 giây cho Part 1, kẹp trong 15–600 giây", () => {
    expect(parseSpeakingPrepSeconds("on", "30", "seconds")).toBe(30);
    expect(parseSpeakingPrepSeconds("on", "5", "seconds")).toBe(15);
    expect(parseSpeakingPrepSeconds("on", "9999", "seconds")).toBe(600);
  });

  it("form sửa bài hiện lại đúng đơn vị", () => {
    expect(splitSpeakingPrep(120)).toEqual({ amount: 2, unit: "minutes" });
    expect(splitSpeakingPrep(30)).toEqual({ amount: 30, unit: "seconds" });
    expect(splitSpeakingPrep(90)).toEqual({ amount: 90, unit: "seconds" });
  });
});

describe("assignmentPrepSeconds", () => {
  it("ưu tiên cột giây, bài giao cũ quy từ phút", () => {
    expect(assignmentPrepSeconds({ speakingPrepSeconds: 30, speakingPrepMinutes: null })).toBe(30);
    expect(assignmentPrepSeconds({ speakingPrepSeconds: null, speakingPrepMinutes: 2 })).toBe(120);
    expect(assignmentPrepSeconds({ speakingPrepSeconds: null, speakingPrepMinutes: null })).toBeNull();
  });

  it("hiện thời lượng dễ đọc", () => {
    expect(formatPrepDuration(30)).toBe("30 giây");
    expect(formatPrepDuration(60)).toBe("1 phút");
    expect(formatPrepDuration(90)).toBe("1 phút 30 giây");
  });
});

describe("đồng hồ chuẩn bị", () => {
  const plan = { startedAt: start, lockedAt: null };

  it("đếm ngược theo giờ thật từ lúc bắt đầu", () => {
    expect(speakingPlanRemainingSeconds(plan, 60, at(0))).toBe(60);
    expect(speakingPlanRemainingSeconds(plan, 60, at(45))).toBe(15);
    expect(speakingPlanRemainingSeconds(plan, 60, at(90))).toBe(0);
  });

  it("đã khoá thì không còn giây nào", () => {
    expect(speakingPlanRemainingSeconds({ startedAt: start, lockedAt: at(20) }, 60, at(21))).toBe(0);
  });

  it("server còn nhận chữ trong thời gian ân hạn, quá thì thôi", () => {
    expect(canEditSpeakingPlan(plan, 60, at(59))).toBe(true);
    expect(canEditSpeakingPlan(plan, 60, at(60 + SPEAKING_PLAN_GRACE_SECONDS))).toBe(true);
    expect(canEditSpeakingPlan(plan, 60, at(61 + SPEAKING_PLAN_GRACE_SECONDS))).toBe(false);
  });

  it("đã khoá thì không nhận chữ nữa dù còn giờ", () => {
    expect(canEditSpeakingPlan({ startedAt: start, lockedAt: at(10) }, 60, at(11))).toBe(false);
  });

  it("30 giây chuẩn bị: hết giờ ở giây 30", () => {
    expect(speakingPlanRemainingSeconds(plan, 30, at(10))).toBe(20);
    expect(speakingPlanRemainingSeconds(plan, 30, at(31))).toBe(0);
    expect(canEditSpeakingPlan(plan, 30, at(30 + SPEAKING_PLAN_GRACE_SECONDS))).toBe(true);
    expect(canEditSpeakingPlan(plan, 30, at(31 + SPEAKING_PLAN_GRACE_SECONDS))).toBe(false);
  });

  it("thời gian đã dùng tính tới lúc khoá, không vượt quá thời gian chuẩn bị", () => {
    expect(speakingPlanUsedSeconds({ startedAt: start, lockedAt: at(48) }, 60)).toBe(48);
    expect(speakingPlanUsedSeconds(plan, 60, at(600))).toBe(60);
    expect(speakingPlanUsedSeconds(plan, 120, at(30))).toBe(30);
  });

  it("định dạng m:ss", () => {
    expect(formatPlanClock(60)).toBe("1:00");
    expect(formatPlanClock(48)).toBe("0:48");
    expect(formatPlanClock(-3)).toBe("0:00");
  });
});

describe("chốt chặn cấu trúc", () => {
  const root = process.cwd();
  const action = readFileSync(join(root, "lib", "actions", "speaking-plan.ts"), "utf8");
  const ensureDb = readFileSync(join(root, "scripts", "ensure-db.mjs"), "utf8");

  it("mọi action dàn ý kiểm quyền học viên trước tiên", () => {
    const bodies = action.split("export async function").slice(1);
    expect(bodies.length).toBeGreaterThanOrEqual(2);
    for (const body of bodies) {
      expect(body).toContain("await requireStudent()");
    }
  });

  it("server tự quyết còn nhận chữ theo giờ, không tin client", () => {
    expect(action).toContain("canEditSpeakingPlan(");
  });

  it("ensure-db đưa cột + bảng mới lên prod", () => {
    expect(ensureDb).toContain('"speakingPrepMinutes"');
    expect(ensureDb).toContain('"speakingPrepSeconds"');
    expect(ensureDb).toContain('CREATE TABLE IF NOT EXISTS "SpeakingPlan"');
  });
});
