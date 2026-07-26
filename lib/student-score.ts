import { calculateRankingScore } from "@/lib/ranking";

export type StudentScore = {
  averageScorePercent: number;
  completionRate: number;
  recentActivityPercent: number;
  rankingScore: number;
  // Số ngày kể từ lần làm bài gần nhất (mở bài hoặc nộp bài). Chưa từng làm -> null.
  daysSinceLastActivity: number | null;
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

// Nhãn tiếng Việt cho cột "Làm gần nhất". Nhận sẵn SỐ NGÀY (thay vì Date) để
// server và trình duyệt không hiển thị lệch nhau vì múi giờ.
export function daysAgoLabel(days: number | null): string {
  if (days === null) {
    return "—";
  }

  if (days === 0) {
    return "Hôm nay";
  }

  if (days === 1) {
    return "Hôm qua";
  }

  return `${days} ngày trước`;
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

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
// Trong 3 ngày đầu vẫn coi như "vừa học"; từ đó tới ngày thứ 14 điểm giảm dần
// rồi về 0. Trước đây chỉ có 0 hoặc 100 nên qua ngày thứ 8 là mất đứt 10 điểm,
// tụt mấy hạng chỉ vì nghỉ thêm một hôm.
const FRESH_DAYS = 3;
const STALE_DAYS = 14;

// Số ngày kể từ lần chạm vào bài gần nhất (mở bài hoặc nộp bài).
function daysSinceLastActivityOf(
  attempts: Array<{ startedAt: Date; submittedAt: Date | null }>,
  now: Date
): number | null {
  const timestamps = attempts.flatMap((attempt) => [
    attempt.startedAt.getTime(),
    ...(attempt.submittedAt !== null ? [attempt.submittedAt.getTime()] : [])
  ]);

  if (timestamps.length === 0) {
    return null;
  }

  const elapsed = now.getTime() - Math.max(...timestamps);

  return Math.max(0, Math.floor(elapsed / MILLISECONDS_PER_DAY));
}

function recentActivityPercentOf(daysSinceLastActivity: number | null) {
  if (daysSinceLastActivity === null || daysSinceLastActivity >= STALE_DAYS) {
    return 0;
  }

  if (daysSinceLastActivity <= FRESH_DAYS) {
    return 100;
  }

  return Math.round(((STALE_DAYS - daysSinceLastActivity) / (STALE_DAYS - FRESH_DAYS)) * 100);
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
  const daysSinceLastActivity = daysSinceLastActivityOf(input.attemptTimes, now);
  const recentActivityPercent = recentActivityPercentOf(daysSinceLastActivity);
  const rankingScore = calculateRankingScore({
    averageScorePercent,
    completionRate,
    recentActivityPercent,
  });

  return {
    averageScorePercent,
    completionRate,
    recentActivityPercent,
    rankingScore,
    daysSinceLastActivity
  };
}
