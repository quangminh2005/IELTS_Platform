import { calculateRankingScore } from "@/lib/ranking";

export type StudentScore = {
  averageScorePercent: number;
  completionRate: number;
  recentActivityPercent: number;
  rankingScore: number;
};

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function completionRateOf(statuses: string[]) {
  if (statuses.length === 0) {
    return 0;
  }
  const completed = statuses.filter((status) => status === "submitted" || status === "reviewed");
  return (completed.length / statuses.length) * 100;
}

function hasRecentActivity(
  attempts: Array<{ startedAt: Date; submittedAt: Date | null }>,
  now: Date
) {
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  return attempts.some(
    (attempt) =>
      attempt.startedAt >= sevenDaysAgo ||
      (attempt.submittedAt !== null && attempt.submittedAt >= sevenDaysAgo)
  );
}

// Điểm xếp hạng của MỘT học sinh (tách từ trang Xếp hạng để trang Tổng quan dùng
// chung, tránh lặp logic). Giữ nguyên công thức lib/ranking.ts.
export function studentRankingScore(input: {
  scorePercents: number[];
  statuses: string[];
  attemptTimes: Array<{ startedAt: Date; submittedAt: Date | null }>;
  now?: Date;
}): StudentScore {
  const now = input.now ?? new Date();
  const averageScorePercent = average(input.scorePercents);
  const completionRate = completionRateOf(input.statuses);
  const recentActivityPercent = hasRecentActivity(input.attemptTimes, now) ? 100 : 0;
  const rankingScore = calculateRankingScore({
    averageScorePercent,
    completionRate,
    recentActivityPercent,
  });

  return { averageScorePercent, completionRate, recentActivityPercent, rankingScore };
}
