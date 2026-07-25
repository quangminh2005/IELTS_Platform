import Link from "next/link";
import { requireTeacherPage } from "@/lib/teacher-page";
import { prisma } from "@/lib/prisma";

const GRADEABLE = ["writing", "speaking"] as const;

function formatDateTime(value: Date | null) {
  if (!value) {
    return "";
  }
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(value);
}

export default async function TeacherDashboardPage() {
  const teacher = await requireTeacherPage();

  const [
    classCount,
    studentMemberships,
    materialCount,
    pendingReviewCount,
    recentClasses,
    recentSubmissions
  ] = await Promise.all([
    prisma.class.count({ where: { teacherId: teacher.id } }),
    prisma.classStudent.findMany({
      where: { class: { teacherId: teacher.id } },
      distinct: ["studentId"],
      select: { studentId: true }
    }),
    prisma.material.count({ where: { teacherId: teacher.id } }),
    // Bài CHỜ chấm: đã nộp, chưa chấm, thuộc kỹ năng giáo viên chấm tay (Writing/Speaking).
    prisma.attempt.count({
      where: {
        status: "submitted",
        assignmentRecipient: {
          assignment: {
            teacherId: teacher.id,
            units: { some: { assignableUnit: { skill: { in: [...GRADEABLE] } } } }
          }
        }
      }
    }),
    prisma.class.findMany({
      where: { teacherId: teacher.id },
      orderBy: { createdAt: "desc" },
      take: 4,
      include: { _count: { select: { students: true } } }
    }),
    // Hoạt động gần đây: các bài Writing/Speaking mới nộp để bấm vào chấm trực tiếp.
    prisma.attempt.findMany({
      where: {
        status: { in: ["submitted", "reviewed"] },
        assignmentRecipient: {
          assignment: {
            teacherId: teacher.id,
            units: { some: { assignableUnit: { skill: { in: [...GRADEABLE] } } } }
          }
        }
      },
      orderBy: [{ submittedAt: "desc" }, { startedAt: "desc" }],
      take: 6,
      select: {
        id: true,
        status: true,
        submittedAt: true,
        student: { select: { displayName: true } },
        assignmentRecipient: {
          select: { assignment: { select: { title: true } } }
        }
      }
    })
  ]);
  const studentCount = studentMemberships.length;

  const cards = [
    { label: "Lớp học", value: classCount, note: "Nhóm đang dạy", accent: "text-blue-600 dark:text-blue-300" },
    { label: "Học viên", value: studentCount, note: "Lượt ghi danh", accent: "text-primary" },
    { label: "Tài liệu", value: materialCount, note: "Nội dung có thể giao", accent: "text-emerald-600 dark:text-emerald-300" }
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
          href="/teacher/review"
          className="inline-flex w-fit items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-card transition hover:bg-primary/90"
        >
          Chấm bài
          {pendingReviewCount > 0 ? (
            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-white/25 px-1.5 text-xs font-bold">
              {pendingReviewCount}
            </span>
          ) : null}
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

        {/* Thẻ "Cần hành động": làm nổi bật số bài đang chờ chấm. */}
        <Link
          href="/teacher/review"
          className={`rounded-xl border p-5 shadow-card transition ${
            pendingReviewCount > 0
              ? "border-amber-400/50 bg-amber-500/10 hover:border-amber-400"
              : "border-border bg-card hover:border-primary/40"
          }`}
        >
          <p className="text-sm text-muted-foreground">Bài chờ chấm</p>
          <p
            className={`mt-2 text-3xl font-bold tabular-nums ${
              pendingReviewCount > 0 ? "text-amber-600 dark:text-amber-300" : "text-muted-foreground"
            }`}
          >
            {pendingReviewCount}
          </p>
          <p className="mt-1 text-sm font-medium text-primary">
            {pendingReviewCount > 0 ? "Vào chấm ngay →" : "Không có bài chờ"}
          </p>
        </Link>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
          <div className="border-b border-border px-5 py-4">
            <h3 className="text-base font-semibold">Hoạt động gần đây</h3>
          </div>
          <div className="divide-y divide-border">
            {recentSubmissions.length > 0 ? (
              recentSubmissions.map((attempt) => (
                <Link
                  key={attempt.id}
                  href={`/teacher/review/${attempt.id}`}
                  className="flex items-center justify-between gap-3 px-5 py-4 transition hover:bg-muted/60"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm">
                      <span className="font-semibold">{attempt.student.displayName}</span> nộp{" "}
                      <span className="text-muted-foreground">
                        {attempt.assignmentRecipient.assignment.title}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDateTime(attempt.submittedAt)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                      attempt.status === "reviewed"
                        ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                        : "border-amber-400/50 bg-amber-500/10 text-amber-600 dark:text-amber-300"
                    }`}
                  >
                    {attempt.status === "reviewed" ? "Đã chấm" : "Chưa chấm"}
                  </span>
                </Link>
              ))
            ) : (
              <div className="px-5 py-12 text-center">
                <p className="text-sm font-medium">Chưa có bài nộp nào</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Khi học viên nộp bài Writing/Speaking, hoạt động sẽ hiện ở đây.
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
          <div className="border-b border-border px-5 py-4">
            <h3 className="text-base font-semibold">Lớp học gần đây</h3>
          </div>
          <div className="divide-y divide-border">
            {recentClasses.length > 0 ? (
              recentClasses.map((classItem) => (
                <Link
                  key={classItem.id}
                  href={`/teacher/classes/${classItem.id}`}
                  className="flex items-center justify-between gap-2 px-5 py-4 transition hover:bg-muted/60"
                >
                  <div>
                    <p className="font-semibold">{classItem.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {classItem._count.students} học viên
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-primary">Mở →</span>
                </Link>
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
    </div>
  );
}
