import { describe, expect, it } from "vitest";
import { calculateRankingScore } from "../lib/ranking";

describe("calculateRankingScore", () => {
  it("trọng số: điểm TB 60%, hoàn thành 20%, tự luyện 10%, hoạt động 10%", () => {
    expect(
      calculateRankingScore({
        averageScorePercent: 80,
        completionRate: 90,
        practiceGoalPercent: 100,
        recentActivityPercent: 50,
      }),
      // 48 + 18 + 10 + 5
    ).toBe(81);
  });
});
