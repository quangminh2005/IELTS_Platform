import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { attemptBandFromCounts, averageBand, type SkillCount } from "@/lib/band-score";
import { rankingScorePercent, studentRankingScore } from "@/lib/student-score";

export type RankedClassStudent = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  averageScorePercent: number;
  averageBandValue: number | null;
  completionRate: number;
  recentActivityPercent: number;
  rankingScore: number;
  // Đã nộp ít nhất một bài chưa. Chưa nộp -> không có dữ liệu để xếp hạng, luôn
  // đứng cuối và được tách thành nhóm riêng ở bảng.
  hasSubmitted: boolean;
  // Số bài đã nộp — để nhìn ra "cao điểm nhờ làm 1 bài" và "làm đều 10 bài".
  submittedCount: number;
  daysSinceLastActivity: number | null;
  // Số hạng tăng/giảm so với ảnh chụp 7 ngày trước. Dương = đi lên.
  // null = tuần trước chưa có bài nào nên chưa có mặt trong bảng.
  rankChange: number | null;
  previousRankingScore: number | null;
};

// Dữ liệu thô của một học viên trong lớp, đã gỡ khỏi hình dạng Prisma để
// phần tính toán thuần tuý test được mà không cần database.
export type ClassmateRow = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  attempts: Array<{
    scorePercent: number | null;
    startedAt: Date;
    submittedAt: Date | null;
    overallBand: number | null;
    // Thời điểm giáo viên chấm (Viết/Nói) — để ảnh chụp tuần trước không dùng
    // band mới chấm hôm nay.
    reviewedAt: Date | null;
    // Số câu đúng/tổng theo kỹ năng (đã gộp sẵn) để quy band.
    skillCounts: SkillCount[];
  }>;
  recipients: Array<{ assignedAt: Date; submittedAt: Date | null; status: string }>;
};

const TREND_WINDOW_DAYS = 7;

type Snapshot = { rankingScore: number; hasSubmitted: boolean };

// Điểm xếp hạng tại một thời điểm. `asOf` = null nghĩa là "bây giờ" (dùng hết
// dữ liệu); truyền mốc cũ thì chỉ tính những gì đã xảy ra trước mốc đó.
function scoreAt(row: ClassmateRow, now: Date, asOf: Date | null) {
  const cutoff = asOf ?? now;
  const attempts = asOf
    ? row.attempts.filter((attempt) => attempt.startedAt <= cutoff)
    : row.attempts;
  const submitted = attempts.filter(
    (attempt) => attempt.submittedAt !== null && attempt.submittedAt <= cutoff
  );
  const recipients = asOf
    ? row.recipients.filter((recipient) => recipient.assignedAt <= cutoff)
    : row.recipients;

  const scorePercents = submitted
    .map((attempt) =>
      rankingScorePercent({
        scorePercent: attempt.scorePercent,
        // Band chấm sau mốc thì coi như lúc đó chưa có.
        overallBand:
          attempt.reviewedAt !== null && attempt.reviewedAt > cutoff ? null : attempt.overallBand
      })
    )
    .filter((scorePercent): scorePercent is number => scorePercent !== null);

  const score = studentRankingScore({
    scorePercents,
    statuses: recipients.map((recipient) =>
      // Hiện tại thì dùng đúng trạng thái đang lưu; còn ảnh chụp tuần trước phải
      // dựng lại từ mốc nộp, vì trạng thái không lưu lịch sử.
      asOf === null
        ? recipient.status
        : recipient.submittedAt !== null && recipient.submittedAt <= cutoff
          ? "submitted"
          : "assigned"
    ),
    attemptTimes: attempts.map((attempt) => ({
      startedAt: attempt.startedAt,
      submittedAt:
        attempt.submittedAt !== null && attempt.submittedAt <= cutoff ? attempt.submittedAt : null
    })),
    now: cutoff
  });

  return { score, submittedCount: submitted.length };
}

// Thứ hạng (1-based) của từng học viên tại một mốc. Học viên chưa nộp bài nào
// không có mặt trong bảng nên cũng không có thứ hạng.
function positionsAt(rows: ClassmateRow[], now: Date, asOf: Date): Map<string, Snapshot & { position: number }> {
  const snapshots = rows.map((row) => {
    const { score, submittedCount } = scoreAt(row, now, asOf);
    return {
      id: row.id,
      displayName: row.displayName,
      rankingScore: score.rankingScore,
      hasSubmitted: submittedCount > 0
    };
  });

  const positions = new Map<string, Snapshot & { position: number }>();

  snapshots
    .filter((snapshot) => snapshot.hasSubmitted)
    .sort(
      (a, b) => b.rankingScore - a.rankingScore || a.displayName.localeCompare(b.displayName)
    )
    .forEach((snapshot, index) => {
      positions.set(snapshot.id, {
        rankingScore: snapshot.rankingScore,
        hasSubmitted: true,
        position: index + 1
      });
    });

  return positions;
}

// Quy đổi + xếp hạng. Giữ nguyên công thức của trang Xếp hạng học viên.
export function rankClassmates(rows: ClassmateRow[], now?: Date): RankedClassStudent[] {
  const today = now ?? new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - TREND_WINDOW_DAYS);
  const previousPositions = positionsAt(rows, today, weekAgo);

  return rows
    .map((row) => {
      const { score, submittedCount } = scoreAt(row, today, null);
      // Band trung bình: gộp band của từng lần làm (band giáo viên chấm hoặc
      // band tự động bài đủ 40 câu). Không có band nào -> null (hiển thị % thay thế).
      const attemptBands = row.attempts
        .map((attempt) => attemptBandFromCounts(attempt.overallBand, attempt.skillCounts))
        .filter((band): band is number => band !== null);
      const previous = previousPositions.get(row.id) ?? null;

      return {
        id: row.id,
        displayName: row.displayName,
        avatarUrl: row.avatarUrl,
        averageScorePercent: score.averageScorePercent,
        averageBandValue: averageBand(attemptBands),
        completionRate: score.completionRate,
        recentActivityPercent: score.recentActivityPercent,
        rankingScore: score.rankingScore,
        hasSubmitted: submittedCount > 0,
        submittedCount,
        daysSinceLastActivity: score.daysSinceLastActivity,
        previousPosition: previous?.position ?? null,
        previousRankingScore: previous?.rankingScore ?? null,
        rankChange: null as number | null
      };
    })
    .sort(
      (a, b) =>
        // Chưa nộp bài nào thì luôn xuống cuối, kể cả khi điểm "hoạt động gần đây"
        // đang cho họ vài điểm lẻ — chưa có bài thì chưa có gì để xếp hạng.
        Number(b.hasSubmitted) - Number(a.hasSubmitted) ||
        b.rankingScore - a.rankingScore ||
        a.displayName.localeCompare(b.displayName)
    )
    .map((student, index) => {
      // Thứ hạng hiện tại chỉ đếm trong nhóm đã nộp bài, khớp với cách bảng hiển thị.
      const position = index + 1;
      const { previousPosition, ...rest } = student;

      return {
        ...rest,
        rankChange:
          student.hasSubmitted && previousPosition !== null ? previousPosition - position : null
      };
    });
}

// Số câu đúng theo kỹ năng của từng lần làm bài, để database gộp giúp thay vì
// tải hàng nghìn dòng Answer về chỉ để đếm.
async function skillCountsByAttempt(attemptIds: string[]) {
  const byAttempt = new Map<string, SkillCount[]>();

  if (attemptIds.length === 0) {
    return byAttempt;
  }

  const rows = await prisma.$queryRaw<
    Array<{ attemptId: string; skill: string; correct: bigint; total: bigint }>
  >`
    SELECT ans."attemptId",
           unit."skill",
           count(*) FILTER (WHERE ans."isCorrect") AS correct,
           count(*) AS total
      FROM "Answer" ans
      JOIN "AssignableUnit" unit ON unit."id" = ans."assignableUnitId"
     WHERE ans."attemptId" IN (${Prisma.join(attemptIds)})
       AND ans."isCorrect" IS NOT NULL
     GROUP BY ans."attemptId", unit."skill"
  `;

  for (const row of rows) {
    const current = byAttempt.get(row.attemptId) ?? [];
    current.push({ skill: row.skill, correct: Number(row.correct), total: Number(row.total) });
    byAttempt.set(row.attemptId, current);
  }

  return byAttempt;
}

// Nguồn sự thật duy nhất cho bảng xếp hạng, dùng chung cho cả trang học viên
// lẫn trang giáo viên. KHÔNG kiểm tra quyền — trang gọi phải tự kiểm tra.
export async function getClassRanking(classId: string): Promise<RankedClassStudent[]> {
  // Chỉ tính bài giao của chính lớp này. classId null = bài giao chung cho nhiều
  // lớp (hoặc bài cũ chưa gắn được lớp) -> vẫn tính, để không mất dữ liệu.
  const ofThisClass = { assignment: { OR: [{ classId }, { classId: null }] } };

  const classmates = await prisma.classStudent.findMany({
    where: { classId },
    orderBy: { joinedAt: "asc" },
    include: {
      student: {
        include: {
          user: {
            select: { image: true }
          },
          attempts: {
            where: { assignmentRecipient: ofThisClass },
            select: {
              id: true,
              scorePercent: true,
              startedAt: true,
              submittedAt: true,
              review: {
                select: { overallBand: true, reviewedAt: true }
              }
            }
          },
          recipients: {
            where: ofThisClass,
            select: {
              status: true,
              assignedAt: true,
              submittedAt: true
            }
          }
        }
      }
    }
  });

  const skillCounts = await skillCountsByAttempt(
    classmates.flatMap((classmate) => classmate.student.attempts.map((attempt) => attempt.id))
  );

  return rankClassmates(
    classmates.map((classmate) => ({
      id: classmate.student.id,
      displayName: classmate.student.displayName,
      avatarUrl: classmate.student.user?.image ?? null,
      attempts: classmate.student.attempts.map((attempt) => ({
        scorePercent: attempt.scorePercent,
        startedAt: attempt.startedAt,
        submittedAt: attempt.submittedAt,
        overallBand: attempt.review?.overallBand ?? null,
        reviewedAt: attempt.review?.reviewedAt ?? null,
        skillCounts: skillCounts.get(attempt.id) ?? []
      })),
      recipients: classmate.student.recipients.map((recipient) => ({
        assignedAt: recipient.assignedAt,
        submittedAt: recipient.submittedAt,
        status: recipient.status
      }))
    }))
  );
}
