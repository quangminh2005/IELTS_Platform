import { prisma } from "@/lib/prisma";
import {
  buildActivityDays,
  buildHeatmapGrid,
  heatmapStartKey,
  pickActivityMessage,
  summarizeActivity,
  type ActivitySummary,
  type HeatmapWeek
} from "@/lib/activity-heatmap";
import { vietnamDateKey } from "@/lib/vocab-day";
import { dateKeyToUtcDate } from "@/lib/vocab-daily";

const DAY_MS = 24 * 60 * 60 * 1000;

export type ActivityHeatmapData = {
  weeks: HeatmapWeek[];
  summary: ActivitySummary;
  message: string;
};

// Dữ liệu bảng ô vuông 53 tuần — dùng chung cho trang Tiến bộ (HS) và trang
// học viên (GV). Không có bảng riêng: suy ra từ giờ nộp bài + ngày ôn Sổ từ.
export async function getActivityHeatmap(
  studentId: string,
  now = new Date()
): Promise<ActivityHeatmapData> {
  const today = vietnamDateKey(now);
  const startKey = heatmapStartKey(today);
  // Lùi thêm 1 ngày cho chắc qua ranh giới giờ VN; ngày ngoài cửa sổ bị logic bỏ qua.
  const since = new Date(dateKeyToUtcDate(startKey).getTime() - DAY_MS);

  const [skillSubmits, legacyAttempts, vocabDays] = await Promise.all([
    // Mỗi phần kỹ năng nộp (bài giao + tự luyện, mọi lượt) = 1 việc.
    prisma.attemptSkill.findMany({
      where: { submittedAt: { gte: since }, attempt: { studentId } },
      select: { submittedAt: true }
    }),
    // Bài nộp cũ được backfill AttemptSkill chỉ có status, không có giờ nộp
    // từng kỹ năng → tính 1 việc theo giờ nộp của cả bài.
    prisma.attempt.findMany({
      where: {
        studentId,
        submittedAt: { gte: since },
        skills: { none: { submittedAt: { not: null } } }
      },
      select: { submittedAt: true }
    }),
    prisma.vocabQuizDay.findMany({
      where: { studentId, date: { gte: dateKeyToUtcDate(startKey) } },
      select: { date: true, total: true }
    })
  ]);

  const submits: Date[] = [];
  for (const row of [...skillSubmits, ...legacyAttempts]) {
    if (row.submittedAt) {
      submits.push(row.submittedAt);
    }
  }

  const days = buildActivityDays({
    submits,
    // VocabQuizDay.date lưu nửa đêm UTC của ngày VN → cắt chuỗi là ra khoá ngày.
    vocabDays: vocabDays.map((row) => ({
      date: row.date.toISOString().slice(0, 10),
      total: row.total
    }))
  });

  const summary = summarizeActivity({ days, today });

  return {
    weeks: buildHeatmapGrid({ days, today }),
    summary,
    message: pickActivityMessage(summary)
  };
}
