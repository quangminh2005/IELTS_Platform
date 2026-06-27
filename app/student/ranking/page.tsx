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
          <p className="text-sm font-semibold text-primary">Bảng xếp hạng lớp</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Xếp hạng</h2>
        </header>
        <div className="rounded-xl border border-border bg-card px-5 py-12 text-center shadow-card">
          <p className="text-sm font-medium">Bạn chưa thuộc lớp nào</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Tham gia một lớp để so sánh tiến độ với các bạn cùng lớp.
          </p>
        </div>
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

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-semibold text-primary">Bảng xếp hạng lớp</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Xếp hạng</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          So sánh tiến độ trong lớp <span className="font-medium text-foreground">{membership.class.name}</span>.
          Điểm xếp hạng kết hợp điểm trung bình, mức độ hoàn thành và hoạt động gần đây.
        </p>
      </header>

      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <div className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-3 border-b border-border bg-muted/50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid-cols-[3.5rem_minmax(0,1fr)_6rem_6rem_6rem_6rem]">
          <span>Hạng</span>
          <span>Học viên</span>
          <span className="hidden md:block">Điểm TB</span>
          <span className="hidden md:block">Hoàn thành</span>
          <span className="hidden md:block">Gần đây</span>
          <span className="hidden md:block">Tổng</span>
        </div>
        <div className="divide-y divide-border">
          {rankedStudents.map((rankedStudent, index) => {
            const isCurrentStudent = rankedStudent.id === student.id;

            return (
              <article
                key={rankedStudent.id}
                className={`grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-3 px-5 py-4 md:grid-cols-[3.5rem_minmax(0,1fr)_6rem_6rem_6rem_6rem] ${
                  isCurrentStudent ? "bg-primary/10" : ""
                }`}
              >
                <p className="text-lg font-bold tabular-nums">
                  {index < 3 ? medals[index] : <span className="text-base text-muted-foreground">{index + 1}</span>}
                </p>
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    {rankedStudent.displayName}
                    {isCurrentStudent ? (
                      <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
                        Bạn
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-2 grid gap-1 text-sm text-muted-foreground md:hidden">
                    <span>Điểm TB: {Math.round(rankedStudent.averageScorePercent)}%</span>
                    <span>Hoàn thành: {Math.round(rankedStudent.completionRate)}%</span>
                    <span>Gần đây: {rankedStudent.recentActivityPercent}%</span>
                    <span className="font-semibold text-foreground">
                      Tổng: {rankedStudent.rankingScore}
                    </span>
                  </p>
                </div>
                <p className="hidden text-sm tabular-nums md:block">
                  {Math.round(rankedStudent.averageScorePercent)}%
                </p>
                <p className="hidden text-sm tabular-nums md:block">
                  {Math.round(rankedStudent.completionRate)}%
                </p>
                <p className="hidden text-sm tabular-nums md:block">
                  {rankedStudent.recentActivityPercent}%
                </p>
                <p className="hidden font-semibold tabular-nums text-primary md:block">
                  {rankedStudent.rankingScore}
                </p>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
