import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SkillTags } from "@/components/skill-tags";
import { ProgressRing } from "@/components/progress-ring";
import { formatDayShort } from "@/lib/day-streak";
import { getDayStreak } from "@/lib/day-streak-data";
import { RankMedal } from "@/components/rank-medal";
import { getXpProgress, levelName } from "@/lib/xp-rank";
import { getLifetimeXp } from "@/lib/xp-rank-data";
import { StreakBadge } from "@/components/streak-badge";
import { EquippedMascot } from "@/components/shop/mascot-art";
import { resolvePose } from "@/lib/mascots";
import { excludePracticeAssignment } from "@/lib/practice";
import { VocabCard } from "@/components/vocab-card";
import { LateBadge, OverdueBadge } from "@/components/late-badge";
import { isSubmissionLate } from "@/lib/late-submission";
import { getVocabSidebar, getWordOfTheDay } from "@/lib/vocab-daily";
import { countTodayCards } from "@/lib/vocab-deck";
import { statusBadgeClasses } from "@/lib/status-badge";
import { NextSessionCard } from "@/components/next-session-card";
import { vnDateKey } from "@/lib/attendance";
import {
  findNextSession,
  numberSessions,
  relativeSessionLabel,
  sessionNumberText
} from "@/lib/class-schedule";
import { getStudentSchedule } from "@/lib/class-schedule-query";
import { pendingBeforeSession } from "@/lib/student-calendar";
import { getStudentRecapPopup } from "@/lib/monthly-recap-data";
import { MonthlyRecapDialog } from "@/components/monthly-recap-dialog";
import { MonthlyRecapPanel } from "@/components/monthly-recap-panel";
import { HomeLeaderboardCard } from "@/components/leaderboard/home-leaderboard-card";
import { getHomeLeaderboard } from "@/lib/leaderboard-data";
import { FeatureBanner } from "@/components/feature-banner";
import { FEATURE_ANNOUNCEMENTS, activeAnnouncements } from "@/lib/feature-announcements";

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
    select: { id: true, displayName: true, equippedMascot: true }
  });

  if (!student) {
    redirect("/waiting");
  }

  // Các truy vấn dưới đây không phụ thuộc nhau — chạy song song để trang chỉ tốn
  // một lượt đi/về database thay vì nhiều lượt nối tiếp.
  const [recipients, lifetimeXp, dayStreak, wordOfDay, vocabSidebar, schedule, vocabToday, recapPopup, homeBoard] =
    await Promise.all([
    prisma.assignmentRecipient.findMany({
      // Trang chủ chỉ liệt kê bài được giao; bài tự luyện nằm ở /student/practice.
      where: { studentId: student.id, assignment: excludePracticeAssignment },
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
    }),
    // Hạng đấu = XP tích luỹ trọn đời (lib/xp-rank.ts).
    getLifetimeXp(student.id),
    // Chuỗi ngày + ngày lỡ cứu được bằng Xu (một nguồn với Hồ sơ, Từ vựng).
    getDayStreak(student.id),
    getWordOfTheDay(),
    getVocabSidebar(student.id),
    getStudentSchedule(student.id),
    countTodayCards(student.id),
    // Tổng kết tháng trước — chỉ có trong 7 ngày đầu tháng, lỗi thì trả null.
    getStudentRecapPopup(student.id),
    // Bảng xếp hạng thu nhỏ — lỗi thì trả null, không làm hỏng trang chủ.
    getHomeLeaderboard(student.id)
  ]);

  const pendingCount = recipients.filter(
    (recipient) => recipient.status !== "submitted" && recipient.status !== "reviewed"
  ).length;

  const completedCount = recipients.filter(
    (recipient) => recipient.status === "submitted" || recipient.status === "reviewed"
  ).length;

  const now = new Date();

  // Buổi học sắp tới (hoặc đang diễn ra) trong mọi lớp học viên đang theo.
  const nextSession = findNextSession(schedule.sessions, now);
  const nextSessionClass = nextSession
    ? schedule.classes.find((classItem) => classItem.id === nextSession.classId) ?? null
    : null;
  const nextSessionKey = nextSession ? vnDateKey(nextSession.startsAt) : null;

  // Banner "Tính năng mới" — slide tự ẩn sau 30 ngày, hết slide thì không hiện.
  const announcements = activeAnnouncements(FEATURE_ANNOUNCEMENTS, "student", now);

  const streak = dayStreak.streak;

  const rankProgress = getXpProgress(lifetimeXp);

  // Bài chưa nộp lên trước (mới giao trước), bài đã nộp/đã chấm xuống dưới —
  // danh sách là thứ học viên cần thấy đầu tiên khi mở trang.
  const isDoneStatus = (status: string) => status === "submitted" || status === "reviewed";
  const orderedRecipients = [...recipients].sort(
    (a, b) => Number(isDoneStatus(a.status)) - Number(isDoneStatus(b.status))
  );

  return (
    <div className="space-y-8">
      {recapPopup ? (
        <MonthlyRecapDialog monthKey={recapPopup.recap.monthKey}>
          <MonthlyRecapPanel recap={recapPopup.recap} view={recapPopup.view} closeMode="dialog" />
        </MonthlyRecapDialog>
      ) : null}

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

      {announcements.length > 0 ? <FeatureBanner slides={announcements} /> : null}

      {nextSession && nextSessionClass && nextSessionKey ? (
        <NextSessionCard
          label={relativeSessionLabel(nextSession.startsAt, now)}
          classLabel={nextSessionClass.name}
          numberText={sessionNumberText(
            numberSessions(
              schedule.sessions.filter((item) => item.classId === nextSession.classId)
            ).get(nextSession.id) ?? null,
            nextSessionClass.totalSessions
          )}
          ongoing={nextSession.startsAt.getTime() <= now.getTime()}
          pendingCount={pendingBeforeSession(
            recipients.map((recipient) => ({
              status: recipient.status,
              deadline: recipient.assignment.deadline
            })),
            nextSession.startsAt,
            now
          )}
          meetingUrl={nextSession.mode === "online" ? nextSession.meetingUrl : null}
          calendarHref={`/student/calendar?m=${nextSessionKey.slice(0, 7)}&d=${nextSessionKey}`}
        />
      ) : null}

      {/* Việc chính của học viên đứng đầu trang: trước đây khối này nằm sau
          chuỗi tuần / hạng / từ vựng / vòng tiến độ, trên điện thoại phải cuộn
          ~3 màn mới thấy bài cần làm. */}
      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="text-base font-semibold">Bài được giao</h3>
          <span className="text-sm text-muted-foreground">{recipients.length} bài</span>
        </div>
        <div className="divide-y divide-border">
          {recipients.length > 0 ? (
            orderedRecipients.map((recipient) => {
              const latestAttempt = recipient.attempts[0];
              const done =
                recipient.status === "submitted" || recipient.status === "reviewed";
              const deadline = recipient.assignment.deadline;
              // Chưa nộp mà đã qua hạn -> cảnh báo; đã nộp sau hạn -> nhãn nộp trễ.
              const overdue = !done && deadline !== null && deadline.getTime() < now.getTime();
              const submittedLate = done && isSubmissionLate(recipient.submittedAt, deadline);

              return (
                <article
                  key={recipient.id}
                  className="flex flex-col gap-3 px-5 py-4 transition hover:bg-muted/60 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-semibold">{recipient.assignment.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {recipient.assignment._count.units} phần
                      {recipient.assignment.totalTimeLimitMinutes
                        ? ` · ${recipient.assignment.totalTimeLimitMinutes} phút cả bài`
                        : recipient.assignment.timeLimitMinutes
                          ? ` · ${recipient.assignment.timeLimitMinutes} phút`
                          : ""}
                    </p>
                    {deadline ? (
                      <p
                        className={`mt-1 text-sm ${
                          overdue ? "font-medium text-red-600 dark:text-red-400" : "text-muted-foreground"
                        }`}
                      >
                        Hạn nộp: {formatDeadline(deadline)}
                      </p>
                    ) : null}
                    {overdue ? (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                        Đã quá hạn — nộp bây giờ sẽ tính là nộp trễ và chỉ được nửa điểm hoàn thành.
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
                    {overdue ? (
                      <OverdueBadge className="px-3 py-1" />
                    ) : (
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusBadgeClasses(
                          recipient.status
                        )}`}
                      >
                        {formatStatus(recipient.status)}
                      </span>
                    )}
                    {submittedLate ? <LateBadge className="px-3 py-1" /> : null}
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StreakBadge
          mascot={
            resolvePose(student.equippedMascot) ? (
              <EquippedMascot poseKey={student.equippedMascot} className="-my-2 block h-16 w-16" />
            ) : undefined
          }
          days={streak.days}
          activeToday={streak.activeToday}
          restore={
            dayStreak.offer
              ? {
                  lostDays: dayStreak.offer.lostDays,
                  dayLabel: formatDayShort(dayStreak.offer.dayKey),
                  price: dayStreak.price,
                  coins: dayStreak.coins
                }
              : null
          }
        />
        <Link
          href="/student/ranks"
          className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-card transition hover:border-primary/50"
        >
          <RankMedal
            rankKey={rankProgress.current.rank.key}
            level={rankProgress.current.levelIndex}
            className="h-12 w-12 shrink-0"
          />
          <div className="min-w-0">
            <p className="text-base font-semibold">Hạng {levelName(rankProgress.current)}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {rankProgress.next && rankProgress.xpToNext !== null
                ? `Còn ${rankProgress.xpToNext} XP nữa lên ${levelName(rankProgress.next)}`
                : "Bạn đang ở đỉnh cao nhất! 👑"}
            </p>
          </div>
        </Link>
        <ProgressRing completed={completedCount} total={recipients.length} />
      </div>

      {homeBoard ? <HomeLeaderboardCard data={homeBoard} studentId={student.id} /> : null}

      <VocabCard
        word={wordOfDay}
        canQuiz={vocabSidebar.canQuiz}
        todayCount={vocabToday}
      />
    </div>
  );
}
