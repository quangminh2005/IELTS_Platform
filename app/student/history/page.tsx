import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function formatStatus(status: string) {
  return status.replaceAll("_", " ");
}

function formatScore(score: number | null, scorePercent: number | null) {
  if (score === null && scorePercent === null) {
    return "Pending";
  }

  if (score !== null && scorePercent !== null) {
    return `${score} | ${Math.round(scorePercent)}%`;
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
        <p className="text-sm font-medium uppercase tracking-wide text-primary">Practice log</p>
        <h2 className="mt-2 text-3xl font-semibold">History</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Submitted and in-progress attempts stay here for review.
        </p>
      </header>

      <section className="rounded-md border border-border bg-muted/35">
        <div className="divide-y divide-border">
          {attempts.length > 0 ? (
            attempts.map((attempt) => (
              <article
                key={attempt.id}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{attempt.assignmentRecipient.assignment.title}</p>
                  <p className="mt-1 text-sm capitalize text-muted-foreground">
                    {formatStatus(attempt.status)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm text-muted-foreground">
                    {formatScore(attempt.score, attempt.scorePercent)}
                  </span>
                  <Link
                    href={`/student/results/${attempt.id}`}
                    className="text-sm font-medium text-primary"
                  >
                    Result
                  </Link>
                </div>
              </article>
            ))
          ) : (
            <p className="px-5 py-8 text-sm text-muted-foreground">
              No attempts have been started yet.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
