import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateRankingScore } from "@/lib/ranking";

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function completionRate(statuses: string[]) {
  if (statuses.length === 0) {
    return 0;
  }

  const completed = statuses.filter((status) => status === "submitted" || status === "reviewed");

  return (completed.length / statuses.length) * 100;
}

function hasRecentAttempt(attempts: Array<{ startedAt: Date; submittedAt: Date | null }>) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  return attempts.some(
    (attempt) =>
      attempt.startedAt >= sevenDaysAgo ||
      (attempt.submittedAt !== null && attempt.submittedAt >= sevenDaysAgo)
  );
}

export default async function StudentRankingPage() {
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

  const membership = await prisma.classStudent.findFirst({
    where: { studentId: student.id },
    orderBy: { joinedAt: "desc" },
    include: {
      class: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });

  if (!membership) {
    return (
      <div className="space-y-8">
        <header>
          <p className="text-sm font-medium uppercase tracking-wide text-primary">Class ranking</p>
          <h2 className="mt-2 text-3xl font-semibold">Ranking</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Join a class to compare your progress with classmates.
          </p>
        </header>
      </div>
    );
  }

  const classmates = await prisma.classStudent.findMany({
    where: { classId: membership.classId },
    orderBy: { joinedAt: "asc" },
    include: {
      student: {
        include: {
          attempts: {
            select: {
              scorePercent: true,
              startedAt: true,
              submittedAt: true
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

  const rankedStudents = classmates
    .map((classmate) => {
      const scoredAttempts = classmate.student.attempts
        .map((attempt) => attempt.scorePercent)
        .filter((scorePercent): scorePercent is number => scorePercent !== null);
      const averageScorePercent = average(scoredAttempts);
      const completion = completionRate(
        classmate.student.recipients.map((recipient) => recipient.status)
      );
      const recentActivityPercent = hasRecentAttempt(classmate.student.attempts) ? 100 : 0;
      const rankingScore = calculateRankingScore({
        averageScorePercent,
        completionRate: completion,
        recentActivityPercent
      });

      return {
        id: classmate.student.id,
        displayName: classmate.student.displayName,
        averageScorePercent,
        completionRate: completion,
        recentActivityPercent,
        rankingScore
      };
    })
    .sort((a, b) => b.rankingScore - a.rankingScore || a.displayName.localeCompare(b.displayName));

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-medium uppercase tracking-wide text-primary">Class ranking</p>
        <h2 className="mt-2 text-3xl font-semibold">Ranking</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Compare progress in {membership.class.name}. Ranking combines score average, completion,
          and recent activity.
        </p>
      </header>

      <section className="rounded-md border border-border bg-muted/35">
        <div className="grid grid-cols-[4rem_minmax(0,1fr)] gap-3 border-b border-border px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid-cols-[4rem_minmax(0,1fr)_7rem_7rem_7rem_7rem]">
          <span>Rank</span>
          <span>Student</span>
          <span className="hidden md:block">Score</span>
          <span className="hidden md:block">Complete</span>
          <span className="hidden md:block">Recent</span>
          <span className="hidden md:block">Total</span>
        </div>
        <div className="divide-y divide-border">
          {rankedStudents.map((rankedStudent, index) => {
            const isCurrentStudent = rankedStudent.id === student.id;

            return (
              <article
                key={rankedStudent.id}
                className={`grid grid-cols-[4rem_minmax(0,1fr)] gap-3 px-5 py-4 md:grid-cols-[4rem_minmax(0,1fr)_7rem_7rem_7rem_7rem] ${
                  isCurrentStudent ? "bg-primary/10" : ""
                }`}
              >
                <p className="font-semibold">#{index + 1}</p>
                <div>
                  <p className="font-medium">
                    {rankedStudent.displayName}
                    {isCurrentStudent ? " (You)" : ""}
                  </p>
                  <p className="mt-2 grid gap-1 text-sm text-muted-foreground md:hidden">
                    <span>Score: {Math.round(rankedStudent.averageScorePercent)}%</span>
                    <span>Completion: {Math.round(rankedStudent.completionRate)}%</span>
                    <span>Recent: {rankedStudent.recentActivityPercent}%</span>
                    <span>Total: {rankedStudent.rankingScore}</span>
                  </p>
                </div>
                <p className="hidden text-sm md:block">
                  {Math.round(rankedStudent.averageScorePercent)}%
                </p>
                <p className="hidden text-sm md:block">{Math.round(rankedStudent.completionRate)}%</p>
                <p className="hidden text-sm md:block">{rankedStudent.recentActivityPercent}%</p>
                <p className="hidden font-semibold md:block">{rankedStudent.rankingScore}</p>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
