export type RankingScoreInput = {
  averageScorePercent: number;
  completionRate: number;
  // Thành phần chỉ tiêu tự luyện (lib/practice-goal.ts), 0–100.
  practiceGoalPercent: number;
  recentActivityPercent: number;
};

export function calculateRankingScore(input: RankingScoreInput): number {
  return Math.round(
    input.averageScorePercent * 0.6 +
      input.completionRate * 0.2 +
      input.practiceGoalPercent * 0.1 +
      input.recentActivityPercent * 0.1,
  );
}
