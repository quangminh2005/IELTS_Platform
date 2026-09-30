import Link from "next/link";
import { ClassScheduleSection } from "@/components/class-schedule-section";
import { prisma } from "@/lib/prisma";
import { requireTeacherPage } from "@/lib/teacher-page";

export const dynamic = "force-dynamic";

// Tab "Lịch học" của giáo viên: mỗi lớp một tab (?classId=), bấm là thấy ngay lịch
// cố định + danh sách buổi của lớp đó — khỏi phải vào từng lớp rồi kéo xuống cuối.
export default async function TeacherSchedulePage({
  searchParams
}: {
  searchParams?: { classId?: string };
}) {
  const teacher = await requireTeacherPage();

  const classes = await prisma.class.findMany({
    where: { teacherId: teacher.id },
    orderBy: { name: "asc" },
    select: { id: true, name: true, _count: { select: { scheduleSlots: true, sessions: true } } }
  });

  const selected = classes.find((classItem) => classItem.id === searchParams?.classId) ?? classes[0] ?? null;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold text-primary">Lớp học</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Lịch học</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Đặt lịch cố định và sửa từng buổi (nghỉ, dời, học online, học bù). Học viên thấy ở trang Lịch
          học và nhận chuông khi có thay đổi.
        </p>
      </header>

      {selected ? (
        <>
          <nav aria-label="Chọn lớp" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {classes.map((classItem) => {
              const active = classItem.id === selected.id;
              const hasSchedule = classItem._count.scheduleSlots > 0 || classItem._count.sessions > 0;
              return (
                <Link
                  key={classItem.id}
                  href={`/teacher/schedule?classId=${classItem.id}`}
                  aria-current={active ? "page" : undefined}
                  className={`shrink-0 rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                    active
                      ? "border-primary bg-primary text-primary-foreground shadow-card"
                      : "border-border bg-card text-foreground hover:border-primary hover:text-primary"
                  }`}
                >
                  {classItem.name}
                  {hasSchedule ? null : (
                    <span className={`ml-1.5 text-xs font-normal ${active ? "opacity-80" : "text-muted-foreground"}`}>
                      · chưa có lịch
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* key theo lớp: đổi tab thì dựng lại form, không giữ khung giờ của lớp trước. */}
          <ClassScheduleSection key={selected.id} classId={selected.id} />
        </>
      ) : (
        <p className="rounded-xl border border-border bg-card px-5 py-6 text-sm text-muted-foreground">
          Chưa có lớp nào. Tạo lớp ở mục{" "}
          <Link href="/teacher/classes" className="font-semibold text-primary hover:underline">
            Lớp học
          </Link>{" "}
          trước.
        </p>
      )}
    </div>
  );
}
