import { ReviewQueue } from "@/components/review-queue";
import { requireTeacher } from "@/lib/actions/classes";
import { durationExceedsLimit, formatDuration } from "@/lib/format-duration";
import { prisma } from "@/lib/prisma";

export default async function TeacherReviewPage() {
  const teacher = await requireTeacher();
  const attempts = await prisma.attempt.findMany({
    where: {
      status: { in: ["submitted", "reviewed"] },
      assignmentRecipient: {
        assignment: {
          teacherId: teacher.id,
          units: {
            some: {
              assignableUnit: {
                skill: { in: ["writing", "speaking"] }
              }
            }
          }
        }
      }
    },
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
  });

  const rows = attempts.map((attempt) => {
    const assignment = attempt.assignmentRecipient.assignment;
    const skills = Array.from(
      new Set(assignment.units.map((unit) => unit.assignableUnit.skill))
    )
      .filter((skill) => skill === "writing" || skill === "speaking")
      .map((skill) => skill.charAt(0).toUpperCase() + skill.slice(1))
      .join(", ");

    const isLate = Boolean(
      attempt.submittedAt &&
        assignment.deadline &&
        attempt.submittedAt.getTime() > assignment.deadline.getTime()
    );

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
      durationSuspect: durationExceedsLimit(attempt.elapsedSeconds, assignment.timeLimitMinutes)
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

      <ReviewQueue rows={rows} />
    </div>
  );
}
