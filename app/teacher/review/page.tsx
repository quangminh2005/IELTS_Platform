import type { Prisma } from "@prisma/client";
import { ReviewForm } from "@/components/review-form";
import { requireTeacher } from "@/lib/actions/classes";
import { prisma } from "@/lib/prisma";

const attemptInclude = {
  student: {
    select: {
      displayName: true,
      email: true
    }
  },
  answers: {
    where: {
      assignableUnit: {
        skill: { in: ["writing", "speaking"] }
      }
    },
    orderBy: { createdAt: "asc" },
    include: {
      question: {
        select: {
          order: true,
          prompt: true,
          points: true
        }
      },
      assignableUnit: {
        select: {
          title: true,
          skill: true
        }
      }
    }
  },
  review: {
    select: {
      overallBand: true,
      criteriaScoresJson: true,
      summaryFeedback: true,
      detailedFeedback: true,
      reviewedAt: true
    }
  },
  assignmentRecipient: {
    include: {
      assignment: {
        include: {
          units: {
            orderBy: { order: "asc" },
            include: {
              assignableUnit: {
                select: {
                  skill: true,
                  title: true
                }
              }
            }
          }
        }
      }
    }
  }
} satisfies Prisma.AttemptInclude;

type ReviewAttempt = Prisma.AttemptGetPayload<{ include: typeof attemptInclude }>;

const STATUS_LABELS: Record<string, string> = {
  reviewed: "Đã chấm",
  submitted: "Đã nộp"
};

function formatStatus(status: string) {
  return STATUS_LABELS[status] ?? status.replaceAll("_", " ");
}

function formatSkillList(attempt: ReviewAttempt) {
  const skills = new Set(
    attempt.assignmentRecipient.assignment.units.map((unit) => unit.assignableUnit.skill)
  );

  return Array.from(skills)
    .map((skill) => skill.charAt(0).toUpperCase() + skill.slice(1))
    .join(", ");
}

// Kỹ năng chính của lần nộp để chọn bộ tiêu chí chấm (ưu tiên Speaking nếu có).
function reviewSkill(attempt: ReviewAttempt): string {
  const skills = attempt.assignmentRecipient.assignment.units.map(
    (unit) => unit.assignableUnit.skill
  );

  return skills.includes("speaking") ? "speaking" : "writing";
}

function countWords(text: string): number {
  const trimmed = text.trim();

  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function formatDate(value: Date | null) {
  if (!value) {
    return "Chưa chấm";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(value);
}

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
    orderBy: [{ submittedAt: "desc" }, { startedAt: "desc" }],
    include: attemptInclude
  });

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-semibold text-primary">Chấm thủ công</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Chấm Writing & Speaking</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Chấm điểm các bài Writing và Speaking đã nộp, hoặc cập nhật nhận xét đã gửi cho học viên.
        </p>
      </header>

      <section className="space-y-5">
        {attempts.length > 0 ? (
          attempts.map((attempt) => (
            <article
              key={attempt.id}
              className="overflow-hidden rounded-xl border border-border bg-card shadow-card"
            >
              <div className="border-b border-border px-5 py-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-lg font-semibold">
                      {attempt.assignmentRecipient.assignment.title}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {attempt.student.displayName} ({attempt.student.email})
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatSkillList(attempt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs font-medium">
                    <span className="rounded-full border border-border px-3 py-1 capitalize text-muted-foreground">
                      {formatStatus(attempt.status)}
                    </span>
                    <span className="rounded-full border border-primary/40 px-3 py-1 text-primary">
                      {formatDate(attempt.review?.reviewedAt ?? null)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="grid gap-6 px-5 py-5 lg:grid-cols-2">
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Bài làm của học viên
                  </h3>
                  {attempt.answers.length > 0 ? (
                    attempt.answers.map((answer) => (
                      <article
                        key={answer.id}
                        className="rounded-lg border border-border bg-muted/40 p-4"
                      >
                        <p className="text-xs font-medium text-muted-foreground">
                          {answer.assignableUnit.title}
                          {answer.question ? ` · Câu ${answer.question.order}` : ""}
                        </p>
                        {answer.question ? (
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">
                            {answer.question.prompt}
                          </p>
                        ) : null}
                        <div className="mt-3 rounded-md border border-border bg-background p-3">
                          {answer.value ? (
                            <>
                              <p className="whitespace-pre-wrap text-sm leading-7">
                                {answer.value}
                              </p>
                              <p className="mt-3 text-xs text-muted-foreground">
                                {countWords(answer.value)} từ
                              </p>
                            </>
                          ) : (
                            <p className="text-sm italic text-muted-foreground">
                              Học viên bỏ trống câu này.
                            </p>
                          )}
                        </div>
                      </article>
                    ))
                  ) : (
                    <p className="rounded-lg border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                      Không tìm thấy bài làm Writing/Speaking cho lần nộp này.
                    </p>
                  )}
                </div>
                <div>
                  <ReviewForm
                    attemptId={attempt.id}
                    skill={reviewSkill(attempt)}
                    review={attempt.review}
                  />
                </div>
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-xl border border-border bg-card px-5 py-12 text-center shadow-card">
            <p className="text-sm text-muted-foreground">
              Hiện không có bài Writing hay Speaking nào đang chờ chấm.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
