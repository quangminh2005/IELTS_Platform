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

function formatStatus(status: string) {
  return status.replaceAll("_", " ");
}

function formatSkillList(attempt: ReviewAttempt) {
  const skills = new Set(
    attempt.assignmentRecipient.assignment.units.map((unit) => unit.assignableUnit.skill)
  );

  return Array.from(skills)
    .map((skill) => skill.charAt(0).toUpperCase() + skill.slice(1))
    .join(", ");
}

function formatDate(value: Date | null) {
  if (!value) {
    return "Not reviewed";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
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
        <p className="text-sm font-medium uppercase tracking-wide text-primary">Manual review</p>
        <h2 className="mt-2 text-3xl font-semibold">Writing and Speaking reviews</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Score submitted Writing and Speaking attempts, or update feedback that has already been
          sent back to students.
        </p>
      </header>

      <section className="space-y-5">
        {attempts.length > 0 ? (
          attempts.map((attempt) => (
            <article key={attempt.id} className="rounded-md border border-border bg-muted/35">
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
              <div className="px-5 py-5">
                <ReviewForm attemptId={attempt.id} review={attempt.review} />
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-md border border-border bg-muted/35 px-5 py-8">
            <p className="text-sm text-muted-foreground">
              No submitted Writing or Speaking attempts are waiting for review.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
