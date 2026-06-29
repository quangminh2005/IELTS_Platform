import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { createClass, requireTeacher } from "@/lib/actions/classes";
import { prisma } from "@/lib/prisma";

const classInclude = {
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
          Tạo lớp rồi mở từng lớp để thêm học viên và xem tình trạng bài tập.
        </p>
      </header>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          {classes.length > 0 ? (
            classes.map((classItem) => (
              <Link
                key={classItem.id}
                href={`/teacher/classes/${classItem.id}`}
                className="block rounded-xl border border-border bg-card px-5 py-4 shadow-card transition hover:border-primary/50 hover:bg-muted/40"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold">{classItem.name}</h3>
                    {classItem.description ? (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {classItem.description}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="inline-flex w-fit rounded-full border border-border bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
                      {classItem._count.students} học viên
                    </span>
                    <span className="text-sm font-semibold text-primary">Mở →</span>
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="rounded-xl border border-border bg-card px-5 py-12 text-center shadow-card">
              <p className="font-semibold">Chưa có lớp học nào</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Tạo một lớp ở khung bên cạnh, sau đó mở lớp để thêm học viên.
              </p>
            </div>
          )}
        </div>

        <form action={createClass} className="h-fit rounded-xl border border-border bg-card p-5 shadow-card">
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
      </section>
    </div>
  );
}
