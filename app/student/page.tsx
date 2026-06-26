import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function statusClasses(status: string) {
  if (status === "reviewed") {
    return "border-primary/50 text-primary";
  }

  if (status === "submitted") {
    return "border-accent/60 text-accent";
  }

  return "border-border text-muted-foreground";
}

function formatStatus(status: string) {
  return status.replaceAll("_", " ");
}

export default async function StudentDashboardPage() {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "student") {
    redirect("/login");
  }

  const student = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, displayName: true }
  });

  if (!student) {
    redirect("/waiting");
  }

  const recipients = await prisma.assignmentRecipient.findMany({
    where: { studentId: student.id },
    orderBy: { assignedAt: "desc" },
    include: {
      assignment: {
        include: {
          _count: {
            select: { units: true }
          }
        }
      },
      attempts: {
        orderBy: { startedAt: "desc" },
        take: 1,
        select: {
          id: true,
          status: true,
          scorePercent: true
        }
      }
    }
  });

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-medium uppercase tracking-wide text-primary">Student home</p>
        <h2 className="mt-2 text-3xl font-semibold">Dashboard</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Welcome back, {student.displayName}. Review assigned work and submitted results.
        </p>
      </header>

      <section className="rounded-md border border-border bg-muted/35">
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-lg font-semibold">Assigned work</h3>
        </div>
        <div className="divide-y divide-border">
          {recipients.length > 0 ? (
            recipients.map((recipient) => {
              const latestAttempt = recipient.attempts[0];

              return (
                <article
                  key={recipient.id}
                  className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">{recipient.assignment.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {recipient.assignment._count.units} units
                      {recipient.assignment.timeLimitMinutes
                        ? ` | ${recipient.assignment.timeLimitMinutes} minutes`
                        : ""}
                    </p>
                    {latestAttempt ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        Latest attempt: {formatStatus(latestAttempt.status)}
                        {latestAttempt.scorePercent !== null
                          ? ` | ${Math.round(latestAttempt.scorePercent)}%`
                          : ""}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-medium capitalize ${statusClasses(
                        recipient.status
                      )}`}
                    >
                      {formatStatus(recipient.status)}
                    </span>
                    <Link
                      href={`/student/assignments/${recipient.id}`}
                      className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
                    >
                      Làm bài
                    </Link>
                  </div>
                </article>
              );
            })
          ) : (
            <p className="px-5 py-8 text-sm text-muted-foreground">
              No assigned homework yet.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
