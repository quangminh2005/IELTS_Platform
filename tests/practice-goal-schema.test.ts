import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { XP_EARN_KINDS } from "@/lib/xp-rank";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const ensureDb = readFileSync("scripts/ensure-db.mjs", "utf8");

describe("chỉ tiêu tự luyện — schema", () => {
  it("StudentProfile có practiceWeeklyGoal mặc định 1", () => {
    expect(schema).toMatch(/practiceWeeklyGoal\s+Int\s+@default\(1\)/);
  });
  it("ensure-db thêm cột cho prod", () => {
    expect(ensureDb).toContain('"practiceWeeklyGoal" INTEGER NOT NULL DEFAULT 1');
  });
  it("có mốc practiceGoalSince (bật lại chỉ tiêu sau khi miễn) + ensure-db", () => {
    expect(schema).toMatch(/practiceGoalSince\s+DateTime\?/);
    expect(ensureDb).toContain('"practiceGoalSince" TIMESTAMP(3)');
  });
  it("comment CoinKind liệt kê kind mới", () => {
    expect(schema).toMatch(/enum CoinKind.*practice_goal \| practice_miss/);
  });
  it("thưởng/trừ chỉ tiêu không tính XP", () => {
    expect(XP_EARN_KINDS).not.toContain("practice_goal");
    expect(XP_EARN_KINDS).not.toContain("practice_miss");
  });
});
