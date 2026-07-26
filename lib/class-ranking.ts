import { prisma } from "@/lib/prisma";
import { attemptBand, averageBand } from "@/lib/band-score";
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
    answers: Array<{ isCorrect: boolean | null; skill: string }>;
  }>;
  statuses: string[];
};

// Quy đổi + xếp hạng. Giữ nguyên công thức của trang Xếp hạng học viên.
export function rankClassmates(rows: ClassmateRow[], now?: Date): RankedClassStudent[] {
  return rows
    .map((row) => {
      const scorePercents = row.attempts
        .map((attempt) => rankingScorePercent(attempt))
        .filter((scorePercent): scorePercent is number => scorePercent !== null);
      const submittedCount = row.attempts.filter((attempt) => attempt.submittedAt !== null).length;
      // Band trung bình: gộp band của từng lần làm (band giáo viên chấm hoặc
      // band tự động bài đủ 40 câu). Không có band nào -> null (hiển thị % thay thế).
      const attemptBands = row.attempts
        .map((attempt) => attemptBand(attempt.overallBand, attempt.answers))
        .filter((band): band is number => band !== null);
      const score = studentRankingScore({
        scorePercents,
        statuses: row.statuses,
        attemptTimes: row.attempts.map((attempt) => ({
          startedAt: attempt.startedAt,
          submittedAt: attempt.submittedAt
        })),
        now
      });

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
        daysSinceLastActivity: score.daysSinceLastActivity
      };
    })
    .sort(
      (a, b) =>
        // Chưa nộp bài nào thì luôn xuống cuối, kể cả khi điểm "hoạt động gần đây"
        // đang cho họ vài điểm lẻ — chưa có bài thì chưa có gì để xếp hạng.
        Number(b.hasSubmitted) - Number(a.hasSubmitted) ||
        b.rankingScore - a.rankingScore ||
        a.displayName.localeCompare(b.displayName)
    );
}

// Nguồn sự thật duy nhất cho bảng xếp hạng, dùng chung cho cả trang học viên
// lẫn trang giáo viên. KHÔNG kiểm tra quyền — trang gọi phải tự kiểm tra.
export async function getClassRanking(classId: string): Promise<RankedClassStudent[]> {
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
            select: {
              scorePercent: true,
              startedAt: true,
              submittedAt: true,
              review: {
                select: { overallBand: true }
              },
              answers: {
                select: {
                  isCorrect: true,
                  assignableUnit: { select: { skill: true } }
                }
              }
            }
          },
          recipients: {
            select: {
              status: true
            }
          }
        }
      }
    }
  });

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
        answers: attempt.answers.map((answer) => ({
          isCorrect: answer.isCorrect,
          skill: answer.assignableUnit.skill
        }))
      })),
      statuses: classmate.student.recipients.map((recipient) => recipient.status)
    }))
  );
}
