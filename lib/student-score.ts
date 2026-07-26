import { calculateRankingScore } from "@/lib/ranking";

export type StudentScore = {
  averageScorePercent: number;
  completionRate: number;
  recentActivityPercent: number;
  rankingScore: number;
};

// Thang band IELTS 0–9, dùng để quy band về thang 100 cho điểm xếp hạng.
const MAX_BAND = 9;

/**
 * % dùng để tính điểm xếp hạng của MỘT lần làm bài.
 * - Bài có câu tự chấm (Nghe/Đọc): dùng đúng % chấm tự động.
 * - Bài Viết/Nói: không có câu tự chấm nên `scorePercent` là null. Nếu giáo viên
 *   đã chấm thì quy band sang thang 100 (band 9 = 100%); chưa chấm thì trả null
 *   để bài đó KHÔNG bị tính là 0% và kéo tụt điểm trung bình.
 */
export function rankingScorePercent(attempt: {
  scorePercent: number | null;
  overallBand: number | null;
}): number | null {
  if (attempt.scorePercent !== null) {
    return attempt.scorePercent;
  }

  if (attempt.overallBand !== null) {
    return (attempt.overallBand / MAX_BAND) * 100;
  }

  return null;
}

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
