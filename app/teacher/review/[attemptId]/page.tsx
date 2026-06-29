import Link from "next/link";
import { notFound } from "next/navigation";
import { ReviewForm } from "@/components/review-form";
import { requireTeacher } from "@/lib/actions/classes";
import { prisma } from "@/lib/prisma";

type DetailPageProps = {
  params: {
    attemptId: string;
  };
};

function countWords(text: string): number {
  const trimmed = text.trim();

  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function reviewSkill(skills: string[]): string {
  return skills.includes("speaking") ? "speaking" : "writing";
}

export default async function ReviewDetailPage({ params }: DetailPageProps) {
  const teacher = await requireTeacher();

  const attempt = await prisma.attempt.findFirst({
    where: {
      id: params.attemptId,
      status: { in: ["submitted", "reviewed"] },
      assignmentRecipient: {
        assignment: { teacherId: teacher.id }
      }
    },
    include: {
      student: {
        select: { displayName: true, email: true }
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
            select: { id: true, title: true }
          }
        }
      },
      answers: {
        where: {
          assignableUnit: { skill: { in: ["writing", "speaking"] } }
        },
        orderBy: { createdAt: "asc" },
        include: {
          question: { select: { order: true, prompt: true } },
          assignableUnit: { select: { title: true, skill: true } }
        }
      }
    }
  });

  if (!attempt) {
    notFound();
  }

  const assignmentId = attempt.assignmentRecipient.assignment.id;

  // Các bạn cùng bài tập (đã nộp) để điều hướng nhanh giữa các học sinh.
  const siblings = await prisma.attempt.findMany({
    where: {
      status: { in: ["submitted", "reviewed"] },
      assignmentRecipient: {
        assignmentId,
        assignment: { teacherId: teacher.id }
      }
    },
    orderBy: [{ submittedAt: "asc" }, { startedAt: "asc" }],
    select: {
      id: true,
      status: true,
      student: { select: { displayName: true } }
    }
  });

  const currentIndex = siblings.findIndex((sibling) => sibling.id === attempt.id);
  const prev = currentIndex > 0 ? siblings[currentIndex - 1] : null;
  const next = currentIndex < siblings.length - 1 ? siblings[currentIndex + 1] : null;
  const nextUngraded = siblings.find(
    (sibling) => sibling.status !== "reviewed" && sibling.id !== attempt.id
  );

  const skills = Array.from(
    new Set(attempt.answers.map((answer) => answer.assignableUnit.skill))
  );
  const skill = reviewSkill(skills);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <Link
          href="/teacher/review"
          className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-primary transition hover:border-primary"
        >
          ← Về hàng đợi
        </Link>

        {siblings.length > 1 ? (
          <div className="flex items-center gap-2 text-sm">
            {prev ? (
              <Link
                href={`/teacher/review/${prev.id}`}
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-2 font-medium transition hover:border-primary"
              >
                ← Bài trước
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-2 font-medium text-muted-foreground opacity-50">
                ← Bài trước
              </span>
            )}
            <span className="rounded-lg border border-border bg-muted/40 px-3 py-2 font-medium text-muted-foreground">
              Học sinh {currentIndex + 1} / {siblings.length}
            </span>
            {next ? (
              <Link
                href={`/teacher/review/${next.id}`}
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-2 font-medium transition hover:border-primary"
              >
                Bài tiếp →
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-2 font-medium text-muted-foreground opacity-50">
                Bài tiếp →
              </span>
            )}
          </div>
        ) : null}
      </div>

      <header className="rounded-xl border border-border bg-card px-5 py-4 shadow-card">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight">
              {attempt.assignmentRecipient.assignment.title}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {attempt.student.displayName} ({attempt.student.email})
            </p>
          </div>
          <span
            className={`h-fit rounded-full border px-3 py-1 text-xs font-medium ${
              attempt.status === "reviewed"
                ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                : "border-amber-400/50 bg-amber-500/10 text-amber-600 dark:text-amber-300"
            }`}
          >
            {attempt.status === "reviewed" ? "Đã chấm" : "Chưa chấm"}
          </span>
        </div>
      </header>

      <div className="flex flex-col gap-6 xl:flex-row">
        <div className="min-w-0 flex-1">
          <div className="grid gap-6 lg:grid-cols-2">
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
                      <p className="mt-1 text-sm leading-7 text-muted-foreground">
                        {answer.question.prompt}
                      </p>
                    ) : null}
                    <div className="mt-3 rounded-md border border-border bg-background p-4">
                      {answer.value ? (
                        <>
                          <p className="whitespace-pre-wrap text-[15px] leading-[1.7]">
                            {answer.value}
                          </p>
                          <p className="mt-4 text-xs text-muted-foreground">
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
                skill={skill}
                nextAttemptId={nextUngraded?.id ?? null}
                review={attempt.review}
              />
            </div>
          </div>
        </div>

        {siblings.length > 1 ? (
          <aside className="shrink-0 xl:w-64">
            <div className="rounded-xl border border-border bg-card shadow-card">
              <div className="border-b border-border px-4 py-3">
                <h3 className="text-sm font-semibold">Học sinh trong bài tập</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Chấm đỏ = chưa chấm
                </p>
              </div>
              <ul className="max-h-[28rem] divide-y divide-border overflow-y-auto">
                {siblings.map((sibling, index) => {
                  const isCurrent = sibling.id === attempt.id;
                  const ungraded = sibling.status !== "reviewed";
                  return (
                    <li key={sibling.id}>
                      <Link
                        href={`/teacher/review/${sibling.id}`}
                        className={`flex items-center gap-2 px-4 py-2.5 text-sm transition ${
                          isCurrent
                            ? "bg-primary/10 font-semibold text-primary"
                            : "hover:bg-muted/40"
                        }`}
                      >
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${
                            ungraded ? "bg-red-500" : "bg-emerald-500"
                          }`}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1 truncate">
                          {index + 1}. {sibling.student.displayName}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
