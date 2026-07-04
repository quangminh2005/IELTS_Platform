import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateRankingScore } from "@/lib/ranking";
import { attemptBand, averageBand, formatBand } from "@/lib/band-score";

// Chữ cái viết tắt cho avatar (tối đa 2 ký tự, lấy từ đầu các từ trong tên).
function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return "?";
  }

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

// Màu nền avatar suy ra từ tên để mỗi học viên có một màu ổn định, dễ phân biệt.
const AVATAR_COLORS = [
  "bg-rose-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-teal-500",
  "bg-sky-500",
  "bg-indigo-500",
  "bg-violet-500",
  "bg-fuchsia-500"
];

function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }

  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

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
          user: {
            select: { image: true }
          },
          attempts: {
            select: {
              scorePercent: true,
              startedAt: true,
              submittedAt: true,
              review: {
                select: { overallBand: true }
              },
              answers: {
                select: {
                  isCorrect: true,
                  assignableUnit: { select: { skill: true } }
                }
              }
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
      // Band trung bình: gộp band của từng lần làm (band giáo viên chấm hoặc
      // band tự động bài đủ 40 câu). Không có band nào -> null (hiển thị % thay thế).
      const attemptBands = classmate.student.attempts
        .map((attempt) =>
          attemptBand(
            attempt.review?.overallBand ?? null,
            attempt.answers.map((answer) => ({
              isCorrect: answer.isCorrect,
              skill: answer.assignableUnit.skill
            }))
          )
        )
        .filter((band): band is number => band !== null);
      const averageBandValue = averageBand(attemptBands);
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
        avatarUrl: classmate.student.user?.image ?? null,
        averageScorePercent,
        averageBandValue,
        completionRate: completion,
        recentActivityPercent,
        rankingScore
      };
    })
    .sort((a, b) => b.rankingScore - a.rankingScore || a.displayName.localeCompare(b.displayName));

  const medals = ["🥇", "🥈", "🥉"];

  const topThree = rankedStudents.slice(0, 3);
  const rest = rankedStudents.slice(3);

  // Thứ tự hiển thị trực quan: hạng 2 (trái) - hạng 1 (giữa) - hạng 3 (phải).
  // Chỉ lấy các vị trí thực sự có học viên (lớp ít người sẽ có 1-2 bục).
  const podiumOrder = [1, 0, 2].filter((rankIndex) => topThree[rankIndex]);

  const podiumStyle = [
    { ring: "ring-yellow-400", pedestal: "h-24 bg-yellow-400/20", size: "h-20 w-20", shine: "animate-podium-shine" },
    { ring: "ring-slate-300", pedestal: "h-16 bg-slate-300/20", size: "h-16 w-16", shine: "" },
    { ring: "ring-amber-600", pedestal: "h-12 bg-amber-600/20", size: "h-16 w-16", shine: "" }
  ];

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

      <section className="rounded-xl border border-border bg-card px-4 py-6 shadow-card">
        <div className="flex items-end justify-center gap-3 sm:gap-6">
          {podiumOrder.map((rankIndex) => {
            const rankedStudent = topThree[rankIndex];
            const style = podiumStyle[rankIndex];
            const isCurrentStudent = rankedStudent.id === student.id;

            return (
              <div key={rankedStudent.id} className="flex w-24 flex-col items-center sm:w-28">
                <span className="mb-1 text-2xl">{medals[rankIndex]}</span>
                {rankedStudent.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={rankedStudent.avatarUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    className={`${style.size} rounded-full object-cover ring-4 ${style.ring} ${style.shine}`}
                  />
                ) : (
                  <span
                    className={`flex ${style.size} items-center justify-center rounded-full text-lg font-bold text-white ring-4 ${style.ring} ${style.shine} ${avatarColor(
                      rankedStudent.displayName
                    )}`}
                    aria-hidden="true"
                  >
                    {initials(rankedStudent.displayName)}
                  </span>
                )}
                <p className="mt-2 max-w-full truncate text-center text-sm font-semibold">
                  {rankedStudent.displayName}
                  {isCurrentStudent ? (
                    <span className="ml-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                      Bạn
                    </span>
                  ) : null}
                </p>
                <p className="text-xs font-semibold tabular-nums text-primary">
                  {rankedStudent.rankingScore} điểm
                </p>
                <div
                  className={`mt-2 flex w-full items-start justify-center rounded-t-lg ${style.pedestal}`}
                >
                  <span className="mt-1 text-sm font-bold tabular-nums text-foreground">
                    {rankIndex + 1}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {rest.length > 0 ? (
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
          {rest.map((rankedStudent, index) => {
            const isCurrentStudent = rankedStudent.id === student.id;

            return (
              <article
                key={rankedStudent.id}
                className={`grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-3 px-5 py-4 md:grid-cols-[3.5rem_minmax(0,1fr)_6rem_6rem_6rem_6rem] ${
                  isCurrentStudent ? "bg-primary/10" : ""
                }`}
              >
                <p className="text-lg font-bold tabular-nums">
                  <span className="text-base text-muted-foreground">{index + 4}</span>
                </p>
                <div className="flex min-w-0 items-center gap-3">
                  {rankedStudent.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={rankedStudent.avatarUrl}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="h-9 w-9 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${avatarColor(
                        rankedStudent.displayName
                      )}`}
                      aria-hidden="true"
                    >
                      {initials(rankedStudent.displayName)}
                    </span>
                  )}
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
                      <span>
                        Điểm TB:{" "}
                        {rankedStudent.averageBandValue !== null
                          ? `Band ${formatBand(rankedStudent.averageBandValue)}`
                          : `${Math.round(rankedStudent.averageScorePercent)}%`}
                      </span>
                      <span>Hoàn thành: {Math.round(rankedStudent.completionRate)}%</span>
                      <span>Gần đây: {rankedStudent.recentActivityPercent}%</span>
                      <span className="font-semibold text-foreground">
                        Tổng: {rankedStudent.rankingScore}
                      </span>
                    </p>
                  </div>
                </div>
                <p className="hidden text-sm tabular-nums md:block">
                  {rankedStudent.averageBandValue !== null
                    ? `Band ${formatBand(rankedStudent.averageBandValue)}`
                    : `${Math.round(rankedStudent.averageScorePercent)}%`}
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
      ) : null}
    </div>
  );
}
