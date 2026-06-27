import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireTeacher } from "@/lib/actions/classes";

export default async function TeacherDashboardPage() {
  const teacher = await requireTeacher();

  const [classCount, studentMemberships, materialCount, assignmentCount, reviewCount, recentClasses] =
    await Promise.all([
      prisma.class.count({ where: { teacherId: teacher.id } }),
      prisma.classStudent.findMany({
        where: { class: { teacherId: teacher.id } },
        distinct: ["studentId"],
        select: { studentId: true }
      }),
      prisma.material.count({ where: { teacherId: teacher.id } }),
      prisma.assignment.count({ where: { teacherId: teacher.id } }),
      prisma.teacherReview.count({ where: { teacherId: teacher.id } }),
      prisma.class.findMany({
        where: { teacherId: teacher.id },
        orderBy: { createdAt: "desc" },
        take: 4,
        include: {
          _count: {
            select: {
              students: true
            }
          }
        }
      })
    ]);
  const studentCount = studentMemberships.length;

  const cards = [
    { label: "Lớp học", value: classCount, note: "Nhóm đang dạy", accent: "text-blue-600 dark:text-blue-300" },
    { label: "Học viên", value: studentCount, note: "Lượt ghi danh", accent: "text-primary" },
    { label: "Tài liệu", value: materialCount, note: "Nội dung có thể giao", accent: "text-emerald-600 dark:text-emerald-300" },
    { label: "Bài giao", value: assignmentCount, note: `${reviewCount} bài đã chấm`, accent: "text-accent-foreground dark:text-accent" }
  ];

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-primary">Trang giáo viên</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Tổng quan</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Quản lý lớp học và theo dõi khối lượng giao bài, chấm bài.
          </p>
        </div>
        <Link
          href="/teacher/classes"
          className="inline-flex w-fit items-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-card transition hover:bg-primary/90"
        >
          Quản lý lớp học
        </Link>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <article key={card.label} className="rounded-xl border border-border bg-card p-5 shadow-card">
            <p className="text-sm text-muted-foreground">{card.label}</p>
            <p className={`mt-2 text-3xl font-bold tabular-nums ${card.accent}`}>{card.value}</p>
            <p className="mt-1 text-sm text-muted-foreground">{card.note}</p>
          </article>
        ))}
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-base font-semibold">Lớp học gần đây</h3>
        </div>
        <div className="divide-y divide-border">
          {recentClasses.length > 0 ? (
            recentClasses.map((classItem: (typeof recentClasses)[number]) => (
              <div
                key={classItem.id}
                className="flex flex-col gap-2 px-5 py-4 transition hover:bg-muted/60 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold">{classItem.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {classItem._count.students} học viên
                  </p>
                </div>
                <Link
                  href="/teacher/classes"
                  className="text-sm font-semibold text-primary transition hover:underline"
                >
                  Mở →
                </Link>
              </div>
            ))
          ) : (
            <div className="px-5 py-12 text-center">
              <p className="text-sm font-medium">Chưa có lớp học nào</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Tạo lớp đầu tiên để bắt đầu thêm học viên.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
