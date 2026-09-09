import { redirect } from "next/navigation";
import { AttendanceCalendar } from "@/components/attendance-calendar";
import { ProfileEditor } from "@/components/profile-editor";
import { RankTierBadge } from "@/components/rank-tier-badge";
import { StudentAvatar } from "@/components/student-avatar";
import { updateMyProfile } from "@/lib/actions/profile";
import { auth } from "@/lib/auth";
import { buildAttendanceMonth } from "@/lib/attendance";
import { averageBandsBySkillAcrossAttempts, formatBand, SKILL_SHORT_LABELS } from "@/lib/band-score";
import { countsForStats, excludePracticeAssignment } from "@/lib/practice";
import { prisma } from "@/lib/prisma";
import { getTierProgress } from "@/lib/rank-tier";
import { calculateWeekStreak, VN_OFFSET_MS } from "@/lib/streak";
import { coverClassName } from "@/lib/student-avatar";
import { rankingScoreFromRecipientsAndAttempts } from "@/lib/student-score";

export const dynamic = "force-dynamic";

// Đọc/kẹp tham số điều hướng lịch chuyên cần trên URL, dạng "?month=YYYY-MM".
// Tên tham số để tiếng Anh (month) cho khớp quy ước ĐANG CÓ của app/student/*
// (tab, skill, classId, page, q — toàn bộ đều là tên tiếng Anh dù chữ hiển thị
// tiếng Việt; không có route nào trong app/ dùng tên tham số tiếng Việt).
//
// Chặn tham số gõ tay bừa bãi: năm phải nằm trong khoảng hợp lý và tháng không
// được vượt quá tháng hiện tại (giờ Việt Nam) — sai định dạng hoặc ngoài
// khoảng thì coi như không truyền, quay về tháng hiện tại thay vì lỗi trang.
function resolveRequestedMonth(
  raw: string | undefined,
  currentYear: number,
  currentMonth: number
): { year: number; month: number } {
  const match = raw?.match(/^(\d{4})-(\d{2})$/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const inRange = year >= 2000 && year <= currentYear && month >= 1 && month <= 12;
    const notFuture = year < currentYear || month <= currentMonth;
    if (inRange && notFuture) {
      return { year, month };
    }
  }
  return { year: currentYear, month: currentMonth };
}

function formatMonthParam(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

// Cộng/trừ n tháng, tự cuốn qua năm.
function shiftMonth(year: number, month: number, delta: number) {
  const total = year * 12 + (month - 1) + delta;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

export default async function StudentProfilePage({
  searchParams
}: {
  searchParams?: { month?: string };
}) {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "student") {
    redirect("/login");
  }

  const student = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      displayName: true,
      bio: true,
      avatarUrl: true,
      avatarPreset: true,
      coverColor: true,
      targetBand: true,
      createdAt: true,
      user: { select: { image: true } },
      classes: {
        orderBy: { joinedAt: "desc" },
        take: 1,
        select: { class: { select: { weeklyGoal: true } } }
      }
    }
  });

  if (!student) {
    redirect("/waiting");
  }

  // Sáu truy vấn dưới đây độc lập với nhau, chỉ phụ thuộc student.id đã có ở
  // trên — gộp Promise.all để chạy song song thay vì nối đuôi tuần tự.
  const [attempts, vocabDays, vocabWordCount, recipients, rankingAttempts] = await Promise.all([
    prisma.attempt.findMany({
      where: { studentId: student.id, submittedAt: { not: null }, ...countsForStats },
      select: {
        submittedAt: true,
        // Answer KHÔNG có cột skill — kỹ năng nằm ở phần bài (assignableUnit).
        // Mọi nơi gọi bandsBySkill đều phải tự ánh xạ như dưới đây.
        answers: {
          select: { isCorrect: true, assignableUnit: { select: { skill: true } } }
        }
      }
    }),
    prisma.vocabQuizDay.findMany({
      where: { studentId: student.id },
      select: { date: true }
    }),
    prisma.vocabProgress.count({
      where: { studentId: student.id }
    }),
    // Dữ liệu cho chip hạng ở header — cùng cách trang Tổng quan (app/student/page.tsx)
    // tính điểm xếp hạng, qua helper dùng chung rankingScoreFromRecipientsAndAttempts.
    prisma.assignmentRecipient.findMany({
      where: { studentId: student.id, assignment: excludePracticeAssignment },
      // Mốc nộp + hạn nộp để biết bài nào nộp trễ (chỉ được nửa suất hoàn thành).
      select: {
        status: true,
        submittedAt: true,
        assignment: { select: { deadline: true } }
      }
    }),
    prisma.attempt.findMany({
      where: { studentId: student.id, ...countsForStats },
      select: {
        scorePercent: true,
        startedAt: true,
        submittedAt: true,
        attemptRound: true,
        review: { select: { overallBand: true } }
      }
    })
  ]);

  const submittedAt = attempts
    .map((attempt) => attempt.submittedAt)
    .filter((date): date is Date => date !== null);

  // Band trung bình theo từng kỹ năng — quy đổi RIÊNG cho mỗi lần làm rồi mới lấy
  // trung bình, không gộp câu trả lời của nhiều lần làm lại (xem lib/band-score.ts).
  const bands = averageBandsBySkillAcrossAttempts(
    attempts.map((attempt) =>
      attempt.answers.map((answer) => ({
        isCorrect: answer.isCorrect,
        skill: answer.assignableUnit.skill
      }))
    )
  );

  const rankingScore = rankingScoreFromRecipientsAndAttempts({
    recipients: recipients.map((recipient) => ({
      status: recipient.status,
      submittedAt: recipient.submittedAt,
      deadline: recipient.assignment.deadline
    })),
    attempts: rankingAttempts.map((attempt) => ({
      scorePercent: attempt.scorePercent,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
      attemptRound: attempt.attemptRound,
      overallBand: attempt.review?.overallBand ?? null
    }))
  });

  const tierProgress = getTierProgress(rankingScore.rankingScore);

  const streak = calculateWeekStreak({
    submittedAt,
    weeklyGoal: student.classes[0]?.class.weeklyGoal ?? 1,
    now: new Date()
  });

  const now = new Date();
  const nowVN = new Date(now.getTime() + VN_OFFSET_MS);
  const currentYear = nowVN.getUTCFullYear();
  const currentMonth = nowVN.getUTCMonth() + 1;

  const requestedMonth = resolveRequestedMonth(searchParams?.month, currentYear, currentMonth);
  const isCurrentMonth =
    requestedMonth.year === currentYear && requestedMonth.month === currentMonth;

  const attendance = buildAttendanceMonth({
    submittedAt,
    vocabDays: vocabDays.map((row) => row.date),
    // Neo giữa tháng, giữa trưa: đủ xa hai đầu tháng để cộng VN_OFFSET_MS bên
    // trong buildAttendanceMonth không lỡ tay đẩy sang tháng kế cận.
    month: new Date(
      Date.UTC(requestedMonth.year, requestedMonth.month - 1, 15, 12, 0, 0)
    )
  });

  const prevMonth = shiftMonth(requestedMonth.year, requestedMonth.month, -1);
  const prevMonthHref = `/student/profile?month=${formatMonthParam(prevMonth.year, prevMonth.month)}`;
  const nextMonth = shiftMonth(requestedMonth.year, requestedMonth.month, 1);
  // Không cho xem tháng "tương lai" — nút tới tháng biến mất khi đang ở tháng hiện tại.
  const nextMonthHref = isCurrentMonth
    ? null
    : `/student/profile?month=${formatMonthParam(nextMonth.year, nextMonth.month)}`;

  const joined = new Intl.DateTimeFormat("vi-VN", {
    day: "numeric",
    month: "numeric",
    year: "numeric"
  }).format(student.createdAt);

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <div className={`h-32 ${coverClassName(student.coverColor)}`} />
        <div className="-mt-12 px-5 pb-5">
          <StudentAvatar
            avatarUrl={student.avatarUrl}
            avatarPreset={student.avatarPreset}
            userImage={student.user?.image ?? null}
            displayName={student.displayName}
            size="xl"
            className="ring-4 ring-card"
          />
          <h2 className="mt-3 text-2xl font-bold tracking-tight">
            {student.displayName}
          </h2>
          {/* Bio là chữ do học viên nhập — render text thuần, không bao giờ HTML. */}
          {student.bio ? (
            <p className="mt-2 max-w-prose whitespace-pre-line text-sm text-muted-foreground">
              {student.bio}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-muted-foreground">
            <span>Tham gia từ {joined}</span>
            <span aria-hidden="true">·</span>
            <RankTierBadge tier={tierProgress.tier} />
            {student.targetBand !== null ? (
              <>
                <span aria-hidden="true">·</span>
                <span>Mục tiêu {formatBand(student.targetBand)}</span>
              </>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Bài đã nộp" value={String(submittedAt.length)} />
        <StatCard label="Từ vựng đã học" value={String(vocabWordCount)} />
        <StatCard label="Chuỗi tuần" value={`${streak.weeks} tuần`} />
        <StatCard
          label="Band trung bình"
          value={
            bands.length > 0
              ? bands
                  .map(
                    (band) =>
                      `${SKILL_SHORT_LABELS[band.skill] ?? band.skill} ${formatBand(band.band)}`
                  )
                  .join(" · ")
              : "Chưa có"
          }
        />
      </section>

      <AttendanceCalendar data={attendance} prevHref={prevMonthHref} nextHref={nextMonthHref} />

      <section className="rounded-xl border border-border bg-card p-5 shadow-card">
        <h3 className="text-sm font-semibold">Chỉnh sửa hồ sơ</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Tên và email do giáo viên quản lý.
        </p>
        <div className="mt-4">
          <ProfileEditor
            action={updateMyProfile}
            initial={{
              displayName: student.displayName,
              bio: student.bio,
              avatarUrl: student.avatarUrl,
              avatarPreset: student.avatarPreset,
              userImage: student.user?.image ?? null,
              coverColor: student.coverColor,
              targetBand: student.targetBand
            }}
          />
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-card">
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}
