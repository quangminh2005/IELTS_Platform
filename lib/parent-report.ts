import { WEAKEST_MIN_ANSWERS, type GroupStat } from "@/lib/question-stats";
import { rankingScorePercent } from "@/lib/student-score";

// Tóm tắt tình hình học tập gửi cho phụ huynh. Cố tình KHÔNG phụ thuộc kiểu của
// Prisma để test được mà không cần DB, và để mail với trang web dùng chung đúng
// một bộ số liệu — không bao giờ lệch nhau.

export type ParentPeriod = "week" | "month";

const DAY_MS = 24 * 60 * 60 * 1000;
const PERIOD_DAYS: Record<ParentPeriod, number> = { week: 7, month: 30 };
const PERIOD_LABELS: Record<ParentPeriod, string> = { week: "7 ngày", month: "30 ngày" };

// Trạng thái coi là chưa nộp — khớp RecipientStatus trong schema.
const PENDING_STATUSES = new Set(["assigned", "in_progress"]);

// Chênh lệch tối thiểu (điểm %) để dám nói là "tăng"/"giảm". Dưới mức này coi như
// đi ngang, tránh báo phụ huynh những dao động vô nghĩa.
const TREND_MARGIN = 3;

const MAX_COMMENTS = 3;
const TOP_GROUPS = 2;

export type ParentReportItem = {
  assignmentTitle: string;
  skills: string[];
  assignedAt: Date;
  deadline: Date | null;
  status: string;
  submittedAt: Date | null;
  scorePercent: number | null;
  overallBand: number | null;
  reviewedAt: Date | null;
  summaryFeedback: string | null;
};

export type ParentComment = {
  assignmentTitle: string;
  band: number | null;
  feedback: string;
  reviewedAt: Date;
};

export type ParentTrend = "up" | "down" | "flat" | "unknown";

export type ParentSummary = {
  period: ParentPeriod;
  from: Date;
  to: Date;
  submittedCount: number;
  lateOrMissingCount: number;
  averagePercent: number | null;
  averageBand: number | null;
  trend: ParentTrend;
  headline: string;
  // Bài đã nộp trong kỳ, mới nhất trước.
  done: ParentReportItem[];
  // Bài chưa nộp và đã quá hạn, hạn gần nhất trước.
  pending: ParentReportItem[];
  comments: ParentComment[];
};

export function periodRange(now: Date, period: ParentPeriod): { from: Date; to: Date } {
  return {
    from: new Date(now.getTime() - PERIOD_DAYS[period] * DAY_MS),
    to: now
  };
}

function within(value: Date | null, from: Date, to: Date): boolean {
  if (!value) {
    return false;
  }

  const time = value.getTime();
  return time >= from.getTime() && time <= to.getTime();
}

// % đại diện cho một bài: Nghe/Đọc lấy điểm tự chấm, Viết/Nói quy band sang thang
// 100. Bài chưa chấm trả null để KHÔNG bị tính thành 0 kéo tụt trung bình.
function percentOf(item: ParentReportItem): number | null {
  return rankingScorePercent({
    scorePercent: item.scorePercent,
    overallBand: item.overallBand
  });
}

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function averagePercentIn(items: ParentReportItem[], from: Date, to: Date): number | null {
  const values: number[] = [];

  for (const item of items) {
    if (!within(item.submittedAt, from, to)) {
      continue;
    }

    const percent = percentOf(item);

    if (percent !== null) {
      values.push(percent);
    }
  }

  return average(values);
}

function computeTrend(current: number | null, previous: number | null): ParentTrend {
  if (current === null || previous === null) {
    return "unknown";
  }

  if (current - previous >= TREND_MARGIN) {
    return "up";
  }

  if (previous - current >= TREND_MARGIN) {
    return "down";
  }

  return "flat";
}

function buildHeadline(
  period: ParentPeriod,
  submittedCount: number,
  averagePercent: number | null,
  trend: ParentTrend,
  lateOrMissingCount: number
): string {
  const label = PERIOD_LABELS[period];
  let headline: string;

  if (submittedCount === 0) {
    headline = `Trong ${label} qua, con chưa hoàn thành bài nào.`;
  } else {
    const parts = [`Trong ${label} qua, con đã hoàn thành ${submittedCount} bài`];

    if (averagePercent !== null) {
      parts.push(`điểm trung bình ${Math.round(averagePercent)}%`);
    }

    if (trend === "up") {
      parts.push("tăng so với kỳ trước");
    } else if (trend === "down") {
      parts.push("giảm so với kỳ trước");
    }

    headline = `${parts.join(", ")}.`;
  }

  if (lateOrMissingCount > 0) {
    headline += ` Còn ${lateOrMissingCount} bài quá hạn chưa làm.`;
  }

  return headline;
}

export function buildParentSummary(
  items: ParentReportItem[],
  now: Date,
  period: ParentPeriod
): ParentSummary {
  const { from, to } = periodRange(now, period);
  const previousFrom = new Date(from.getTime() - PERIOD_DAYS[period] * DAY_MS);

  const done = items
    .filter((item) => within(item.submittedAt, from, to))
    .sort((a, b) => (b.submittedAt?.getTime() ?? 0) - (a.submittedAt?.getTime() ?? 0));

  // Nợ bài tính theo hiện tại chứ không theo kỳ: bài quá hạn từ tháng trước mà
  // vẫn chưa làm thì phụ huynh vẫn cần biết.
  const pending = items
    .filter(
      (item) =>
        PENDING_STATUSES.has(item.status) &&
        item.deadline !== null &&
        item.deadline.getTime() < now.getTime()
    )
    .sort((a, b) => (a.deadline?.getTime() ?? 0) - (b.deadline?.getTime() ?? 0));

  const averagePercent = averagePercentIn(items, from, to);
  const previousPercent = averagePercentIn(items, previousFrom, from);

  const bands = done
    .map((item) => item.overallBand)
    .filter((band): band is number => band !== null);

  const comments: ParentComment[] = items
    .filter(
      (item) =>
        within(item.reviewedAt, from, to) &&
        typeof item.summaryFeedback === "string" &&
        item.summaryFeedback.trim().length > 0
    )
    .sort((a, b) => (b.reviewedAt?.getTime() ?? 0) - (a.reviewedAt?.getTime() ?? 0))
    .slice(0, MAX_COMMENTS)
    .map((item) => ({
      assignmentTitle: item.assignmentTitle,
      band: item.overallBand,
      feedback: (item.summaryFeedback ?? "").trim(),
      // Đã lọc ở trên nên reviewedAt chắc chắn khác null.
      reviewedAt: item.reviewedAt as Date
    }));

  const trend = computeTrend(averagePercent, previousPercent);

  return {
    period,
    from,
    to,
    submittedCount: done.length,
    lateOrMissingCount: pending.length,
    averagePercent,
    averageBand: average(bands),
    trend,
    headline: buildHeadline(period, done.length, averagePercent, trend, pending.length),
    done,
    pending,
    comments
  };
}

// Kỳ nào con không học gì và cũng không nợ bài thì không gửi mail — phụ huynh
// nhận mail rỗng vài lần là bắt đầu bỏ qua tất cả mail của lớp.
export function shouldSendReport(summary: ParentSummary): boolean {
  return (
    summary.submittedCount > 0 ||
    summary.lateOrMissingCount > 0 ||
    summary.comments.length > 0
  );
}

// Nhóm dạng câu tốt nhất / kém nhất. Chỉ xét nhóm đủ dữ liệu, và không để một
// nhóm vừa là điểm mạnh vừa là điểm yếu khi học viên mới có ít nhóm.
export function pickStrengthsAndWeaknesses(stats: GroupStat[]): {
  strengths: GroupStat[];
  weaknesses: GroupStat[];
} {
  const eligible = stats.filter((stat) => stat.total >= WEAKEST_MIN_ANSWERS);
  const strengths = [...eligible].sort((a, b) => b.percent - a.percent).slice(0, TOP_GROUPS);
  const strongKeys = new Set(strengths.map((stat) => stat.key));
  const weaknesses = eligible
    .filter((stat) => !strongKeys.has(stat.key))
    .sort((a, b) => a.percent - b.percent)
    .slice(0, TOP_GROUPS);

  return { strengths, weaknesses };
}
