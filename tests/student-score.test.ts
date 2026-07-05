import { describe, expect, it } from "vitest";
import { studentRankingScore } from "../lib/student-score";

describe("studentRankingScore", () => {
  const now = new Date("2026-07-08T10:00:00+07:00");

  it("gộp điểm TB + hoàn thành + hoạt động gần đây (0.7/0.2/0.1)", () => {
    const s = studentRankingScore({
      scorePercents: [80, 100], // TB = 90
      statuses: ["submitted", "reviewed", "assigned", "assigned"], // 2/4 = 50%
      attemptTimes: [{ startedAt: new Date("2026-07-07T08:00:00+07:00"), submittedAt: null }], // gần đây -> 100
      now,
    });
    expect(s.averageScorePercent).toBe(90);
    expect(s.completionRate).toBe(50);
    expect(s.recentActivityPercent).toBe(100);
    // 90*0.7 + 50*0.2 + 100*0.1 = 63 + 10 + 10 = 83
    expect(s.rankingScore).toBe(83);
  });

  it("không có dữ liệu → tất cả 0", () => {
    const s = studentRankingScore({ scorePercents: [], statuses: [], attemptTimes: [], now });
    expect(s.averageScorePercent).toBe(0);
    expect(s.completionRate).toBe(0);
    expect(s.recentActivityPercent).toBe(0);
    expect(s.rankingScore).toBe(0);
  });

  it("hoạt động quá 7 ngày → recentActivityPercent 0", () => {
    const s = studentRankingScore({
      scorePercents: [100],
      statuses: ["submitted"],
      attemptTimes: [{ startedAt: new Date("2026-06-01T08:00:00+07:00"), submittedAt: new Date("2026-06-01T09:00:00+07:00") }],
      now,
    });
    expect(s.recentActivityPercent).toBe(0);
  });
});
