import { notFound, redirect } from "next/navigation";
import { StudentAvatar } from "@/components/student-avatar";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { coverClassName } from "@/lib/student-avatar";

export const dynamic = "force-dynamic";

// Hồ sơ RÚT GỌN của bạn cùng lớp: chỉ phần trang trí. Điểm số, mục tiêu band và
// lịch chuyên cần là chuyện riêng, không hiện ở đây.
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
          <p className="mt-3 text-sm text-muted-foreground">Tham gia từ {joined}</p>
        </div>
      </section>
    </div>
  );
}
