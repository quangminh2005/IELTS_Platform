import { notFound, redirect } from "next/navigation";
import { RankTierBadge } from "@/components/rank-tier-badge";
import { StudentAvatar } from "@/components/student-avatar";
import { auth } from "@/lib/auth";
import { countsForStats, excludePracticeAssignment } from "@/lib/practice";
import { prisma } from "@/lib/prisma";
import { getTierProgress } from "@/lib/rank-tier";
import { coverClassName } from "@/lib/student-avatar";
import { rankingScoreFromRecipientsAndAttempts } from "@/lib/student-score";

export const dynamic = "force-dynamic";

// Hồ sơ RÚT GỌN của bạn cùng lớp: trang trí + chip hạng (đã công khai trên bảng
// xếp hạng lớp — spec §6). Band từng kỹ năng, mục tiêu band và lịch chuyên cần
// vẫn là chuyện riêng, KHÔNG bao giờ hiện ở đây — xem tests/profile-visibility.test.ts.
export default async function ClassmateProfilePage({
  params
}: {
  params: { studentId: string };
}) {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "student") {
    redirect("/login");
  }

  const me = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, classes: { select: { classId: true } } }
  });

  if (!me) {
    redirect("/waiting");
  }

  if (me.id === params.studentId) {
    redirect("/student/profile");
  }

  const classIds = me.classes.map((row) => row.classId);

  // Chốt chặn quyền: chỉ thấy được học viên CHUNG ÍT NHẤT MỘT LỚP với mình.
  const classmate = await prisma.studentProfile.findFirst({
    where: {
      id: params.studentId,
      classes: { some: { classId: { in: classIds } } }
    },
    select: {
      id: true,
      displayName: true,
      bio: true,
      avatarUrl: true,
      avatarPreset: true,
      coverColor: true,
      createdAt: true,
      user: { select: { image: true } }
    }
  });

  if (!classmate) {
    notFound();
  }

  // Chip hạng: tính ĐÚNG MỘT CÁCH DUY NHẤT trong cả app, qua helper dùng chung
  // rankingScoreFromRecipientsAndAttempts — cùng cách app/student/profile/page.tsx
  // (hồ sơ của chính mình) đang tính. Không tự chấm điểm riêng ở đây, để tránh
  // hai bậc khác nhau cho cùng một học viên ở hai trang.
  const recipients = await prisma.assignmentRecipient.findMany({
    where: { studentId: classmate.id, assignment: excludePracticeAssignment },
    select: { status: true }
  });

  const rankingAttempts = await prisma.attempt.findMany({
    where: { studentId: classmate.id, ...countsForStats },
    select: {
      scorePercent: true,
      startedAt: true,
      submittedAt: true,
      attemptRound: true,
      review: { select: { overallBand: true } }
    }
  });

  const rankingScore = rankingScoreFromRecipientsAndAttempts({
    recipientStatuses: recipients.map((recipient) => recipient.status),
    attempts: rankingAttempts.map((attempt) => ({
      scorePercent: attempt.scorePercent,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
      attemptRound: attempt.attemptRound,
      overallBand: attempt.review?.overallBand ?? null
    }))
  });

  // Chỉ lấy TÊN BẬC (tier) để render chip — không có con số điểm xếp hạng thô
  // nào chảy tới JSX bên dưới.
  const tierProgress = getTierProgress(rankingScore.rankingScore);

  const joined = new Intl.DateTimeFormat("vi-VN", {
    day: "numeric",
    month: "numeric",
    year: "numeric"
  }).format(classmate.createdAt);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <div className={`h-32 ${coverClassName(classmate.coverColor)}`} />
        <div className="-mt-12 px-5 pb-5">
          <StudentAvatar
            avatarUrl={classmate.avatarUrl}
            avatarPreset={classmate.avatarPreset}
            userImage={classmate.user?.image ?? null}
            displayName={classmate.displayName}
            size="xl"
            className="ring-4 ring-card"
          />
          <h2 className="mt-3 text-2xl font-bold tracking-tight">
            {classmate.displayName}
          </h2>
          {/* Text thuần — bio do người khác nhập. */}
          {classmate.bio ? (
            <p className="mt-2 max-w-prose whitespace-pre-line text-sm text-muted-foreground">
              {classmate.bio}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-muted-foreground">
            <span>Tham gia từ {joined}</span>
            <span aria-hidden="true">·</span>
            <RankTierBadge tier={tierProgress.tier} />
          </div>
        </div>
      </section>
    </div>
  );
}
