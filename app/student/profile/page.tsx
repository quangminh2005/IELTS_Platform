import { redirect } from "next/navigation";
import { AttendanceCalendar } from "@/components/attendance-calendar";
import { ProfileEditor } from "@/components/profile-editor";
import { StudentAvatar } from "@/components/student-avatar";
import { updateMyProfile } from "@/lib/actions/profile";
import { auth } from "@/lib/auth";
import { buildAttendanceMonth } from "@/lib/attendance";
import { bandsBySkill, formatBand, SKILL_SHORT_LABELS } from "@/lib/band-score";
import { countsForStats } from "@/lib/practice";
import { prisma } from "@/lib/prisma";
import { calculateWeekStreak } from "@/lib/streak";
import { coverClassName } from "@/lib/student-avatar";

export const dynamic = "force-dynamic";

export default async function StudentProfilePage() {
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

  const attempts = await prisma.attempt.findMany({
    where: { studentId: student.id, submittedAt: { not: null }, ...countsForStats },
    select: {
      submittedAt: true,
      // Answer KHÔNG có cột skill — kỹ năng nằm ở phần bài (assignableUnit).
      // Mọi nơi gọi bandsBySkill đều phải tự ánh xạ như dưới đây.
      answers: {
        select: { isCorrect: true, assignableUnit: { select: { skill: true } } }
      }
    }
  });

  const vocabDays = await prisma.vocabQuizDay.findMany({
    where: { studentId: student.id },
    select: { date: true }
  });

  const vocabWordCount = await prisma.vocabProgress.count({
    where: { studentId: student.id }
  });

  const submittedAt = attempts
    .map((attempt) => attempt.submittedAt)
    .filter((date): date is Date => date !== null);

  const bands = bandsBySkill(
    attempts.flatMap((attempt) =>
      attempt.answers.map((answer) => ({
        isCorrect: answer.isCorrect,
        skill: answer.assignableUnit.skill
      }))
    )
  ).filter((row) => row.band !== null);

  const streak = calculateWeekStreak({
    submittedAt,
    weeklyGoal: student.classes[0]?.class.weeklyGoal ?? 1,
    now: new Date()
  });

  const attendance = buildAttendanceMonth({
    submittedAt,
    vocabDays: vocabDays.map((row) => row.date),
    month: new Date()
  });

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
          <p className="mt-3 text-sm text-muted-foreground">
            Tham gia từ {joined}
            {student.targetBand !== null
              ? ` · Mục tiêu ${formatBand(student.targetBand)}`
              : ""}
          </p>
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

      <AttendanceCalendar data={attendance} />

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
