import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { ReviewQueue } from "@/components/review-queue";
import { requireTeacherPage } from "@/lib/teacher-page";
import { isSubmissionLate } from "@/lib/assignment-calendar";
import { durationExceedsLimit, formatDuration } from "@/lib/format-duration";
import { manualGradedUnitWhere } from "@/lib/manual-grading";
import { excludePracticeAssignment, onlyPracticeAssignment } from "@/lib/practice";
import { prisma } from "@/lib/prisma";

const tabClass =
  "rounded-full border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:border-primary";
const activeTabClass =
  "rounded-full border border-primary bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary";

// Dựng chung một hình dạng where cho cả truy vấn danh sách lẫn hai truy vấn đếm
// (homeworkCount/practiceCount) của hàng đợi chấm bài — chỉ khác mảnh lọc mode
// (bài giao / tự luyện). Nếu để ba khối where chép tay riêng lẻ, sau này ai thêm
// bộ lọc mới (theo lớp, theo ngày...) vào truy vấn danh sách mà quên sửa hai truy
// vấn đếm thì số hiển thị trên tab sẽ lệch khỏi số dòng thật trong danh sách — sai
// âm thầm, khó phát hiện. Gom về một hàm để chỉ còn một nơi giữ hình dạng điều kiện.
function buildReviewQueueWhere(
  teacherId: string,
  modeFilter: typeof excludePracticeAssignment | typeof onlyPracticeAssignment
): Prisma.AttemptWhereInput {
  return {
    status: { in: ["submitted", "reviewed"] },
    assignmentRecipient: {
      assignment: {
        teacherId,
        ...modeFilter,
        // Chỉ bài THỰC SỰ cần chấm tay (có câu viết luận / ghi âm). Bài Viết dạng
        // điền chỗ trống đã tự chấm nên không vào hàng đợi.
        units: { some: { assignableUnit: manualGradedUnitWhere } }
      }
    }
  };
}

export default async function TeacherReviewPage({
  searchParams
}: {
  searchParams?: { tab?: string };
}) {
  const teacher = await requireTeacherPage();

  // Tab "Tự luyện" tách bài tự luyện ra khỏi hàng đợi chấm bài giao chính;
  // giá trị tab lạ rơi về mặc định (bài giao).
  const isPractice = searchParams?.tab === "practice";

  const [attempts, homeworkCount, practiceCount] = await Promise.all([
    prisma.attempt.findMany({
      where: buildReviewQueueWhere(
        teacher.id,
        isPractice ? onlyPracticeAssignment : excludePracticeAssignment
      ),
      // FIFO: bài nộp trước nằm trên để chấm trước.
      orderBy: [{ submittedAt: "asc" }, { startedAt: "asc" }],
      include: {
        student: {
          select: { displayName: true, email: true }
        },
        review: {
          select: { reviewedAt: true }
        },
        assignmentRecipient: {
          include: {
            assignment: {
              include: {
                class: { select: { name: true } },
                units: {
                  orderBy: { order: "asc" },
                  include: {
                    assignableUnit: { select: { skill: true } }
                  }
                }
              }
            }
          }
        }
      }
    }),
    prisma.attempt.count({
      where: buildReviewQueueWhere(teacher.id, excludePracticeAssignment)
    }),
    prisma.attempt.count({
      where: buildReviewQueueWhere(teacher.id, onlyPracticeAssignment)
    })
  ]);

  const rows = attempts.map((attempt) => {
    const assignment = attempt.assignmentRecipient.assignment;
    const skills = Array.from(
      new Set(assignment.units.map((unit) => unit.assignableUnit.skill))
    )
      .filter((skill) => skill === "writing" || skill === "speaking")
      .map((skill) => skill.charAt(0).toUpperCase() + skill.slice(1))
      .join(", ");

    const isLate = isSubmissionLate(attempt.submittedAt, assignment.deadline);

    return {
      id: attempt.id,
      studentName: attempt.student.displayName,
      studentEmail: attempt.student.email,
      assignmentId: assignment.id,
      assignmentTitle: assignment.title,
      className: assignment.class?.name ?? null,
      skills,
      submittedAt: attempt.submittedAt ? attempt.submittedAt.toISOString() : null,
      status: attempt.status,
      reviewedAt: attempt.review?.reviewedAt
        ? attempt.review.reviewedAt.toISOString()
        : null,
      isLate,
      durationLabel: formatDuration(attempt.elapsedSeconds),
      durationSuspect: durationExceedsLimit(attempt.elapsedSeconds, assignment.timeLimitMinutes),
      tabSwitchCount: attempt.tabSwitchCount,
      findAttemptCount: attempt.findAttemptCount
    };
  });

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-semibold text-primary">Chấm thủ công</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
          Hàng đợi chấm bài
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Danh sách bài Writing &amp; Speaking đã nộp. Lọc theo lớp, bài tập, trạng thái và
          chọn bài để chấm. Bài nộp trước được xếp lên trên.
        </p>
      </header>

      <div className="flex items-center gap-1.5">
        <Link href="/teacher/review" className={!isPractice ? activeTabClass : tabClass}>
          Bài giao ({homeworkCount})
        </Link>
        <Link href="/teacher/review?tab=practice" className={isPractice ? activeTabClass : tabClass}>
          Tự luyện ({practiceCount})
        </Link>
      </div>

      <ReviewQueue rows={rows} />
    </div>
  );
}
