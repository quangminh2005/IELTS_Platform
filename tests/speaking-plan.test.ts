import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  SPEAKING_PLAN_GRACE_SECONDS,
  canEditSpeakingPlan,
  formatPlanClock,
  parseSpeakingPrepMinutes,
  speakingPlanRemainingSeconds,
  speakingPlanUsedSeconds
} from "@/lib/speaking-plan";

const start = new Date("2026-09-25T10:00:00.000Z");
const at = (seconds: number) => new Date(start.getTime() + seconds * 1000);

describe("parseSpeakingPrepMinutes", () => {
  it("không tick = tắt", () => {
    expect(parseSpeakingPrepMinutes(null, "2")).toBeNull();
    expect(parseSpeakingPrepMinutes("", "2")).toBeNull();
  });

  it("tick mà số phút trống/sai thì lấy mặc định 1", () => {
    expect(parseSpeakingPrepMinutes("on", "")).toBe(1);
    expect(parseSpeakingPrepMinutes("on", null)).toBe(1);
    expect(parseSpeakingPrepMinutes("on", "abc")).toBe(1);
  });

  it("kẹp trong 1–10 phút", () => {
    expect(parseSpeakingPrepMinutes("on", "3")).toBe(3);
    expect(parseSpeakingPrepMinutes("on", "2.7")).toBe(2);
    expect(parseSpeakingPrepMinutes("on", "99")).toBe(10);
  });
});

describe("đồng hồ chuẩn bị", () => {
  const plan = { startedAt: start, lockedAt: null };

  it("đếm ngược theo giờ thật từ lúc bắt đầu", () => {
    expect(speakingPlanRemainingSeconds(plan, 1, at(0))).toBe(60);
    expect(speakingPlanRemainingSeconds(plan, 1, at(45))).toBe(15);
    expect(speakingPlanRemainingSeconds(plan, 1, at(90))).toBe(0);
  });

  it("đã khoá thì không còn giây nào", () => {
    expect(speakingPlanRemainingSeconds({ startedAt: start, lockedAt: at(20) }, 1, at(21))).toBe(0);
  });

  it("server còn nhận chữ trong thời gian ân hạn, quá thì thôi", () => {
    expect(canEditSpeakingPlan(plan, 1, at(59))).toBe(true);
    expect(canEditSpeakingPlan(plan, 1, at(60 + SPEAKING_PLAN_GRACE_SECONDS))).toBe(true);
    expect(canEditSpeakingPlan(plan, 1, at(61 + SPEAKING_PLAN_GRACE_SECONDS))).toBe(false);
  });

  it("đã khoá thì không nhận chữ nữa dù còn giờ", () => {
    expect(canEditSpeakingPlan({ startedAt: start, lockedAt: at(10) }, 1, at(11))).toBe(false);
  });

  it("thời gian đã dùng tính tới lúc khoá, không vượt quá số phút", () => {
    expect(speakingPlanUsedSeconds({ startedAt: start, lockedAt: at(48) }, 1)).toBe(48);
    expect(speakingPlanUsedSeconds(plan, 1, at(600))).toBe(60);
    expect(speakingPlanUsedSeconds(plan, 2, at(30))).toBe(30);
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
    expect(ensureDb).toContain('CREATE TABLE IF NOT EXISTS "SpeakingPlan"');
  });
});
