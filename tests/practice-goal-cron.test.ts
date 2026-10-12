import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const route = readFileSync("app/api/cron/reminders/route.ts", "utf8");
const data = readFileSync("lib/practice-goal-data.ts", "utf8");

describe("cron chỉ tiêu tự luyện", () => {
  it("chạy SAU vòng gửi mail nhắc bài — chậm cũng không làm trễ mail", () => {
    const syncAt = route.lastIndexOf("await syncPracticeGoalsSafely(");
    const mailAt = route.indexOf("await sendEmail(");
    expect(syncAt).toBeGreaterThan(-1);
    expect(mailAt).toBeGreaterThan(-1);
    expect(syncAt).toBeGreaterThan(mailAt);
  });

  it("chỉ quét em còn trong lớp (thầy thấy được để miễn)", () => {
    const body = data.slice(data.indexOf("export async function syncAllPracticeGoals"));
    expect(body).toMatch(/classes:\s*\{\s*some:\s*\{\s*\}\s*\}/);
  });

  it("đọc trạng thái cả trường một lần, chỉ mở transaction cho em có việc cần ghi", () => {
    const body = data.slice(data.indexOf("export async function syncAllPracticeGoals"));
    expect(body).toContain("getPracticeGoalStatuses(");
    expect(body).not.toContain("syncPracticeGoal(");
  });
});
