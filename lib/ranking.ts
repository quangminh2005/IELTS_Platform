export type RankingScoreInput = {
  averageScorePercent: number;
  completionRate: number;
  recentActivityPercent: number;
};

export function calculateRankingScore(input: RankingScoreInput): number {
  return Math.round(
    input.averageScorePercent * 0.7 +
      input.completionRate * 0.2 +
      input.recentActivityPercent * 0.1,
  );
}
