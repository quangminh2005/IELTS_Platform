import { describe, expect, it } from "vitest";
import { calculateRankingScore } from "../lib/ranking";

describe("calculateRankingScore", () => {
  it("weights average score, completion, and recent activity", () => {
    expect(
      calculateRankingScore({
        averageScorePercent: 80,
        completionRate: 90,
        recentActivityPercent: 50,
      }),
    ).toBe(79);
  });
});
