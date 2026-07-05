import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SkillTags } from "@/components/skill-tags";
import { ProgressRing } from "@/components/progress-ring";
import { calculateWeekStreak } from "@/lib/streak";
import { studentRankingScore } from "@/lib/student-score";
import { getTierProgress } from "@/lib/rank-tier";
import { StreakBadge } from "@/components/streak-badge";

function statusClasses(status: string) {
  if (status === "reviewed") {
    return "border-primary/40 bg-primary/10 text-primary";
  }

  if (status === "submitted") {
    return "border-accent/50 bg-accent/10 text-accent-foreground dark:text-accent";
  }

  if (status === "in_progress") {
    return "border-blue-400/40 bg-blue-500/10 text-blue-600 dark:text-blue-300";
  }

  return "border-border bg-muted text-muted-foreground";
}

const STATUS_LABELS: Record<string, string> = {
  reviewed: "Đã chấm",
  submitted: "Đã nộp",
  in_progress: "Đang làm",
  not_started: "Chưa làm",
  assigned: "Chưa làm",
  pending: "Chưa làm"
};

function formatStatus(status: string) {
  return STATUS_LABELS[status] ?? status.replaceAll("_", " ");
}

function formatDeadline(value: Date | null) {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh"
  }).format(value);
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
          },
          units: {
            select: {
              assignableUnit: { select: { skill: true } }
            }
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

  const pendingCount = recipients.filter(
    (recipient) => recipient.status !== "submitted" && recipient.status !== "reviewed"
  ).length;

  const completedCount = recipients.filter(
    (recipient) => recipient.status === "submitted" || recipient.status === "reviewed"
  ).length;

  const attempts = await prisma.attempt.findMany({
    where: { studentId: student.id },
    select: { scorePercent: true, startedAt: true, submittedAt: true, status: true }
  });

  const membership = await prisma.classStudent.findFirst({
    where: { studentId: student.id },
    orderBy: { joinedAt: "desc" },
    include: { class: { select: { weeklyGoal: true } } }
  });

  const weeklyGoal = membership?.class.weeklyGoal ?? 3;

  const now = new Date();

  const submittedDates = attempts
    .filter(
      (attempt) =>
        (attempt.status === "submitted" || attempt.status === "reviewed") &&
        attempt.submittedAt !== null
    )
    .map((attempt) => attempt.submittedAt as Date);

  const streak = calculateWeekStreak({ submittedAt: submittedDates, weeklyGoal, now });

  const score = studentRankingScore({
    scorePercents: attempts
      .map((attempt) => attempt.scorePercent)
      .filter((value): value is number => value !== null),
    statuses: recipients.map((recipient) => recipient.status),
    attemptTimes: attempts.map((attempt) => ({
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt
    })),
    now
  });

  const tierProgress = getTierProgress(score.rankingScore);

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-semibold text-primary">Trang học viên</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
          Chào {student.displayName} 👋
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          {recipients.length > 0
            ? `Bạn có ${recipients.length} bài được giao${
                pendingCount > 0 ? `, trong đó ${pendingCount} bài chưa hoàn thành.` : "."
              }`
            : "Hiện chưa có bài tập nào được giao. Hãy quay lại sau nhé."}
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <StreakBadge
          weeks={streak.weeks}
          currentWeekCount={streak.currentWeekCount}
          weeklyGoal={streak.weeklyGoal}
          atRisk={streak.atRisk}
        />
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-card">
          <span className="text-3xl" aria-hidden="true">
            {tierProgress.tier.icon}
          </span>
          <div className="min-w-0">
            <p className="text-base font-semibold">Hạng {tierProgress.tier.label}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {tierProgress.next
                ? `Còn ${tierProgress.pointsToNext} điểm nữa lên ${tierProgress.next.label}`
                : "Bạn đang ở đỉnh cao nhất! 💎"}
            </p>
          </div>
        </div>
      </div>

      <ProgressRing completed={completedCount} total={recipients.length} />

      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="text-base font-semibold">Bài được giao</h3>
          <span className="text-sm text-muted-foreground">{recipients.length} bài</span>
        </div>
        <div className="divide-y divide-border">
          {recipients.length > 0 ? (
            recipients.map((recipient) => {
              const latestAttempt = recipient.attempts[0];
              const done =
                recipient.status === "submitted" || recipient.status === "reviewed";

              return (
                <article
                  key={recipient.id}
                  className="flex flex-col gap-3 px-5 py-4 transition hover:bg-muted/60 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-semibold">{recipient.assignment.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {recipient.assignment._count.units} phần
                      {recipient.assignment.timeLimitMinutes
                        ? ` · ${recipient.assignment.timeLimitMinutes} phút`
                        : ""}
                    </p>
                    {recipient.assignment.deadline ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        Hạn nộp: {formatDeadline(recipient.assignment.deadline)}
                      </p>
                    ) : null}
                    {latestAttempt ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        Lần làm gần nhất: {formatStatus(latestAttempt.status)}
                        {latestAttempt.scorePercent !== null
                          ? ` · ${Math.round(latestAttempt.scorePercent)}%`
                          : ""}
                      </p>
                    ) : null}
                    <div className="mt-2">
                      <SkillTags
                        skills={recipient.assignment.units.map(
                          (unit) => unit.assignableUnit.skill
                        )}
                      />
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-3">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClasses(
                        recipient.status
                      )}`}
                    >
                      {formatStatus(recipient.status)}
                    </span>
                    <Link
                      href={
                        done && latestAttempt
                          ? `/student/results/${latestAttempt.id}`
                          : `/student/assignments/${recipient.id}`
                      }
                      className={
                        done
                          ? "rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition hover:border-primary hover:text-primary"
                          : "rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-card transition hover:bg-primary/90"
                      }
                    >
                      {done ? "Xem lại" : "Làm bài"}
                    </Link>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="px-5 py-12 text-center">
              <p className="text-sm font-medium">Chưa có bài tập nào</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Bài tập do giáo viên giao sẽ xuất hiện ở đây.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
