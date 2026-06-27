import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const STATUS_LABELS: Record<string, string> = {
  reviewed: "Đã chấm",
  submitted: "Đã nộp",
  in_progress: "Đang làm",
  not_started: "Chưa làm"
};

function formatStatus(status: string) {
  return STATUS_LABELS[status] ?? status.replaceAll("_", " ");
}

function statusClasses(status: string) {
  if (status === "reviewed") {
    return "border-primary/40 bg-primary/10 text-primary";
  }

  if (status === "submitted") {
    return "border-accent/50 bg-accent/10 text-accent-foreground dark:text-accent";
  }

  return "border-border bg-muted text-muted-foreground";
}

function formatScore(score: number | null, scorePercent: number | null) {
  if (score === null && scorePercent === null) {
    return "Chờ chấm";
  }

  if (score !== null && scorePercent !== null) {
    return `${score} · ${Math.round(scorePercent)}%`;
  }

  return score !== null ? `${score}` : `${Math.round(scorePercent ?? 0)}%`;
}

export default async function StudentHistoryPage() {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "student") {
    redirect("/login");
  }

  const student = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true }
  });

  if (!student) {
    redirect("/waiting");
  }

  const attempts = await prisma.attempt.findMany({
    where: { studentId: student.id },
    orderBy: { startedAt: "desc" },
    include: {
      assignmentRecipient: {
        include: {
          assignment: {
            select: {
              title: true
            }
          }
        }
      }
    }
  });

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-semibold text-primary">Nhật ký luyện tập</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Lịch sử làm bài</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Các bài đã nộp và đang làm dở được lưu tại đây để bạn xem lại.
        </p>
      </header>

      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <div className="divide-y divide-border">
          {attempts.length > 0 ? (
            attempts.map((attempt) => (
              <article
                key={attempt.id}
                className="flex flex-col gap-3 px-5 py-4 transition hover:bg-muted/60 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-semibold">{attempt.assignmentRecipient.assignment.title}</p>
                  <span
                    className={`mt-2 inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusClasses(
                      attempt.status
                    )}`}
                  >
                    {formatStatus(attempt.status)}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <span className="text-sm font-semibold tabular-nums text-foreground">
                    {formatScore(attempt.score, attempt.scorePercent)}
                  </span>
                  <Link
                    href={`/student/results/${attempt.id}`}
                    className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-primary transition hover:border-primary"
                  >
                    Xem kết quả
                  </Link>
                </div>
              </article>
            ))
          ) : (
            <div className="px-5 py-12 text-center">
              <p className="text-sm font-medium">Chưa có lần làm bài nào</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Khi bạn bắt đầu làm bài, lịch sử sẽ hiển thị ở đây.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
