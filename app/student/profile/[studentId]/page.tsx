import { notFound, redirect } from "next/navigation";
import { StreakTierChip } from "@/components/leaderboard/streak-tier-chip";
import { ProfileHero } from "@/components/profile-hero";
import { ProfileMonthActivity } from "@/components/profile-month-activity";
import { MascotCard, RankCard } from "@/components/profile-side-cards";
import { RankTierBadge } from "@/components/rank-tier-badge";
import { auth } from "@/lib/auth";
import { getDayStreak, loadActivityDays } from "@/lib/day-streak-data";
import { monthKeyOf, shiftMonthKey } from "@/lib/monthly-recap";
import { prisma } from "@/lib/prisma";
import { resolveProfileMonth, summarizeMonthActivity } from "@/lib/profile-activity";
import { vietnamDateKey } from "@/lib/vocab-day";
import { getLifetimeXp } from "@/lib/xp-rank-data";

export const dynamic = "force-dynamic";

// Hồ sơ học viên KHÁC — mở cho cả trường (Mạng xã hội Đợt 1, spec
// 2026-10-05-xa-hoi-dot-1): trang trí, lớp, XP + hạng đấu, chuỗi 🔥, lịch chăm học.
// Band từng kỹ năng, mục tiêu band, bài làm và số dư ví vẫn là chuyện riêng, KHÔNG bao
// giờ hiện ở đây — xem tests/profile-visibility.test.ts.
export default async function StudentPublicProfilePage({
  params,
  searchParams
}: {
  params: { studentId: string };
  searchParams?: { month?: string };
}) {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "student") {
    redirect("/login");
  }

  const me = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true }
  });

  if (!me) {
    redirect("/waiting");
  }

  if (me.id === params.studentId) {
    redirect("/student/profile");
  }

  const profile = await prisma.studentProfile.findUnique({
    where: { id: params.studentId },
    select: {
      id: true,
      displayName: true,
      bio: true,
      avatarUrl: true,
      avatarPreset: true,
      coverColor: true,
      coverImageUrl: true,
      equippedBackground: true,
      equippedFrame: true,
      equippedMascot: true,
      createdAt: true,
      user: { select: { image: true } },
      classes: { select: { class: { select: { name: true } } } }
    }
  });

  if (!profile) {
    notFound();
  }

  const now = new Date();
  const latestMonth = monthKeyOf(now);
  const monthKey = resolveProfileMonth(searchParams?.month, latestMonth);

  // XP / chuỗi / ngày có học qua đúng các nguồn dùng chung với hồ sơ của mình.
  const [lifetimeXp, dayStreak, activityDays] = await Promise.all([
    getLifetimeXp(profile.id),
    getDayStreak(profile.id, now),
    loadActivityDays(profile.id, `${monthKey}-01`)
  ]);
  const streakDays = dayStreak.streak.days;
  const summary = summarizeMonthActivity(activityDays, monthKey, vietnamDateKey(now));

  const base = `/student/profile/${profile.id}`;
  const prevHref = `${base}?month=${shiftMonthKey(monthKey, -1)}`;
  const nextHref = monthKey < latestMonth ? `${base}?month=${shiftMonthKey(monthKey, 1)}` : null;
  const classNames = profile.classes.map((row) => row.class.name);

  const joined = new Intl.DateTimeFormat("vi-VN", {
    day: "numeric",
    month: "numeric",
    year: "numeric"
  }).format(profile.createdAt);

  // Bố cục 2 cột như hồ sơ của mình: trái = bìa + lịch, phải = hạng + linh vật. Màn
  // nhỏ: bìa → thẻ phải → lịch (cột trái dùng `contents` + order).
  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6 xl:grid xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
      <div className="contents xl:flex xl:min-w-0 xl:flex-col xl:gap-6">
        <section className="order-1 min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-card">
          <ProfileHero
            backgroundKey={profile.equippedBackground}
            coverColor={profile.coverColor}
            coverImageUrl={profile.coverImageUrl}
            frame={profile.equippedFrame}
            avatarUrl={profile.avatarUrl}
            avatarPreset={profile.avatarPreset}
            userImage={profile.user?.image ?? null}
            displayName={profile.displayName}
          />
          <div className="px-5 pb-5 pt-4 text-center">
            {/* Text thuần — bio do người khác nhập. */}
            {profile.bio ? (
              <p className="mx-auto max-w-prose whitespace-pre-line text-sm text-muted-foreground">
                {profile.bio}
              </p>
            ) : null}
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5 text-sm text-muted-foreground">
              <span>Tham gia từ {joined}</span>
              <span aria-hidden="true">·</span>
              <RankTierBadge xp={lifetimeXp} />
              {streakDays > 0 ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-semibold text-foreground">🔥 {streakDays} ngày</span>
                  <StreakTierChip days={streakDays} />
                </>
              ) : null}
            </div>
            {classNames.length > 0 ? (
              <p className="mt-1.5 text-sm text-muted-foreground">
                Lớp: <span className="font-medium text-foreground">{classNames.join(" · ")}</span>
              </p>
            ) : null}
          </div>
        </section>

        <div className="order-3">
          <ProfileMonthActivity summary={summary} streakDays={streakDays} prevHref={prevHref} nextHref={nextHref} />
        </div>
      </div>

      <aside className="order-2 flex flex-col gap-4">
        <RankCard xp={lifetimeXp} showXp />
        <MascotCard poseKey={profile.equippedMascot} own={false} />
      </aside>
    </div>
  );
}
