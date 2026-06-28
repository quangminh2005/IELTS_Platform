import Link from "next/link";
import type { Prisma } from "@prisma/client";
import {
  addStudent,
  createClass,
  deleteClass,
  deleteStudent,
  removeStudentFromClass,
  requireTeacher
} from "@/lib/actions/classes";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { prisma } from "@/lib/prisma";

const classInclude = {
  students: {
    orderBy: { joinedAt: "desc" },
    include: {
      student: true
    }
  },
      _count: {
        select: {
          students: true
        }
      }
} satisfies Prisma.ClassInclude;

type TeacherClass = Prisma.ClassGetPayload<{
  include: typeof classInclude;
}>;

export default async function TeacherClassesPage() {
  const teacher = await requireTeacher();
  const classes: TeacherClass[] = await prisma.class.findMany({
    where: { teacherId: teacher.id },
    orderBy: { createdAt: "desc" },
    include: classInclude
  });

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-semibold text-primary">Danh sách lớp</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Lớp học & học viên</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Tạo lớp, thêm học viên bằng email và mở hồ sơ học viên để xem tình trạng bài tập.
        </p>
      </header>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          {classes.length > 0 ? (
            classes.map((classItem: (typeof classes)[number]) => (
              <article
                key={classItem.id}
                className="overflow-hidden rounded-xl border border-border bg-card shadow-card"
              >
                <div className="border-b border-border px-5 py-4">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-base font-semibold">{classItem.name}</h3>
                      {classItem.description ? (
                        <p className="mt-1 text-sm text-muted-foreground">{classItem.description}</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="inline-flex w-fit rounded-full border border-border bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
                        {classItem.students.length} học viên
                      </span>
                      <form action={deleteClass}>
                        <input type="hidden" name="classId" value={classItem.id} />
                        <ConfirmSubmitButton
                          confirmMessage={`Xoá lớp "${classItem.name}"? Học viên sẽ bị gỡ khỏi lớp nhưng hồ sơ và bài làm của họ vẫn được giữ lại.`}
                          className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:border-red-400 hover:bg-red-500/10 dark:text-red-400"
                        >
                          Xoá lớp
                        </ConfirmSubmitButton>
                      </form>
                    </div>
                  </div>
                </div>

                <div className="divide-y divide-border">
                  {classItem.students.length > 0 ? (
                    classItem.students.map((membership: (typeof classItem.students)[number]) => (
                      <div
                        key={membership.id}
                        className="flex flex-col gap-2 px-5 py-4 transition hover:bg-muted/60 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                            {membership.student.displayName.trim().charAt(0).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{membership.student.displayName}</p>
                            <p className="truncate text-sm text-muted-foreground">
                              {membership.student.email}
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Link
                            href={`/teacher/students/${membership.student.id}`}
                            className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-primary transition hover:border-primary"
                          >
                            Xem hồ sơ
                          </Link>
                          <form action={removeStudentFromClass}>
                            <input type="hidden" name="classId" value={classItem.id} />
                            <input type="hidden" name="studentId" value={membership.student.id} />
                            <ConfirmSubmitButton
                              confirmMessage={`Gỡ ${membership.student.displayName} khỏi lớp "${classItem.name}"? Hồ sơ và bài làm của học viên vẫn được giữ lại.`}
                              className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-muted-foreground transition hover:border-red-400 hover:text-red-600 dark:hover:text-red-400"
                            >
                              Gỡ
                            </ConfirmSubmitButton>
                          </form>
                          <form action={deleteStudent}>
                            <input type="hidden" name="studentId" value={membership.student.id} />
                            <ConfirmSubmitButton
                              confirmMessage={`Xoá hẳn học sinh ${membership.student.displayName}? Toàn bộ hồ sơ, bài làm, điểm và lịch sử sẽ bị xoá vĩnh viễn và KHÔNG thể khôi phục.`}
                              className="rounded-lg border border-red-400/60 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-500/20 dark:text-red-400"
                            >
                              Xoá hẳn
                            </ConfirmSubmitButton>
                          </form>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="px-5 py-6 text-sm text-muted-foreground">
                      Chưa có học viên nào trong lớp.
                    </p>
                  )}
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-xl border border-border bg-card px-5 py-12 text-center shadow-card">
              <p className="font-semibold">Chưa có lớp học nào</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Tạo một lớp rồi thêm học viên bằng email.
              </p>
            </div>
          )}
        </div>

        <div className="space-y-5">
          <form action={createClass} className="rounded-xl border border-border bg-card p-5 shadow-card">
            <h3 className="text-base font-semibold">Tạo lớp học</h3>
            <label className="mt-4 block text-sm font-medium" htmlFor="name">
              Tên lớp
            </label>
            <input
              id="name"
              name="name"
              minLength={2}
              required
              className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/40 focus:border-primary focus:ring-2"
            />
            <label className="mt-4 block text-sm font-medium" htmlFor="description">
              Mô tả
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/40 focus:border-primary focus:ring-2"
            />
            <button className="mt-4 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-card transition hover:bg-primary/90">
              Tạo lớp
            </button>
          </form>

          <form action={addStudent} className="rounded-xl border border-border bg-card p-5 shadow-card">
            <h3 className="text-base font-semibold">Thêm học viên</h3>
            <label className="mt-4 block text-sm font-medium" htmlFor="classId">
              Lớp
            </label>
            <select
              id="classId"
              name="classId"
              required
              className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/40 focus:border-primary focus:ring-2"
            >
              <option value="">Chọn lớp</option>
              {classes.map((classItem: (typeof classes)[number]) => (
                <option key={classItem.id} value={classItem.id}>
                  {classItem.name}
                </option>
              ))}
            </select>
            <label className="mt-4 block text-sm font-medium" htmlFor="displayName">
              Tên học viên
            </label>
            <input
              id="displayName"
              name="displayName"
              required
              className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/40 focus:border-primary focus:ring-2"
            />
            <label className="mt-4 block text-sm font-medium" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/40 focus:border-primary focus:ring-2"
            />
            <button className="mt-4 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-card transition hover:bg-primary/90">
              Thêm học viên
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
