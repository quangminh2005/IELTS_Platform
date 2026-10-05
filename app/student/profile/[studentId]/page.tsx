import { notFound, redirect } from "next/navigation";
import { ProfileHero } from "@/components/profile-hero";
import { MascotCard, RankCard } from "@/components/profile-side-cards";
import { RankTierBadge } from "@/components/rank-tier-badge";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLifetimeXp } from "@/lib/xp-rank-data";

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
      coverImageUrl: true,
      equippedBackground: true,
      equippedFrame: true,
      equippedMascot: true,
      createdAt: true,
      user: { select: { image: true } }
    }
  });

  if (!classmate) {
    notFound();
  }

  // Hạng đấu: XP tích luỹ qua đúng MỘT nguồn dùng chung (getLifetimeXp, cùng chỗ
  // hồ sơ của mình đọc). Chỉ đưa vào chip/thẻ hạng — các component đó chỉ in TÊN
  // cấp, không in con số XP của bạn học.
  const lifetimeXp = await getLifetimeXp(classmate.id);

  const joined = new Intl.DateTimeFormat("vi-VN", {
    day: "numeric",
    month: "numeric",
    year: "numeric"
  }).format(classmate.createdAt);

  // Cùng bố cục 2 cột với hồ sơ của mình, nhưng không có bút chì, lịch chăm học,
  // thống kê hay con số điểm — chỉ trang trí + tên bậc.
  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6 xl:grid xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
      <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <ProfileHero
          backgroundKey={classmate.equippedBackground}
          coverColor={classmate.coverColor}
          coverImageUrl={classmate.coverImageUrl}
          frame={classmate.equippedFrame}
          avatarUrl={classmate.avatarUrl}
          avatarPreset={classmate.avatarPreset}
          userImage={classmate.user?.image ?? null}
          displayName={classmate.displayName}
        />
        <div className="px-5 pb-5 pt-4 text-center">
          {/* Text thuần — bio do người khác nhập. */}
          {classmate.bio ? (
            <p className="mx-auto max-w-prose whitespace-pre-line text-sm text-muted-foreground">
              {classmate.bio}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5 text-sm text-muted-foreground">
            <span>Tham gia từ {joined}</span>
            <span aria-hidden="true">·</span>
            <RankTierBadge xp={lifetimeXp} />
          </div>
        </div>
      </section>

      <aside className="flex flex-col gap-4">
        <RankCard xp={lifetimeXp} showXp={false} />
        <MascotCard poseKey={classmate.equippedMascot} own={false} />
      </aside>
    </div>
  );
}
