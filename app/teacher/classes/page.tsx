import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { addStudent, createClass, requireTeacher } from "@/lib/actions/classes";
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
        <p className="text-sm font-medium uppercase tracking-wide text-primary">Roster</p>
        <h2 className="mt-2 text-3xl font-semibold">Classes and students</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Create classes, enroll students by email, and open student profiles for assignment status.
        </p>
      </header>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          {classes.length > 0 ? (
            classes.map((classItem: (typeof classes)[number]) => (
              <article key={classItem.id} className="rounded-md border border-border bg-muted/35">
                <div className="border-b border-border px-5 py-4">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">{classItem.name}</h3>
                      {classItem.description ? (
                        <p className="mt-1 text-sm text-muted-foreground">{classItem.description}</p>
                      ) : null}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {classItem.students.length} students
                    </p>
                  </div>
                </div>

                <div className="divide-y divide-border">
                  {classItem.students.length > 0 ? (
                    classItem.students.map((membership: (typeof classItem.students)[number]) => (
                      <div
                        key={membership.id}
                        className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="font-medium">{membership.student.displayName}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{membership.student.email}</p>
                        </div>
                        <Link
                          href={`/teacher/students/${membership.student.id}`}
                          className="text-sm font-medium text-primary"
                        >
                          View profile
                        </Link>
                      </div>
                    ))
                  ) : (
                    <p className="px-5 py-6 text-sm text-muted-foreground">
                      No students enrolled yet.
                    </p>
                  )}
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-md border border-border bg-muted/35 px-5 py-8">
              <p className="font-medium">No classes yet</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Create a class, then add students by email.
              </p>
            </div>
          )}
        </div>

        <div className="space-y-5">
          <form action={createClass} className="rounded-md border border-border bg-muted/45 p-5">
            <h3 className="text-lg font-semibold">Create class</h3>
            <label className="mt-4 block text-sm font-medium" htmlFor="name">
              Class name
            </label>
            <input
              id="name"
              name="name"
              minLength={2}
              required
              className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/40 focus:ring-2"
            />
            <label className="mt-4 block text-sm font-medium" htmlFor="description">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/40 focus:ring-2"
            />
            <button className="mt-4 w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
              Create
            </button>
          </form>

          <form action={addStudent} className="rounded-md border border-border bg-muted/45 p-5">
            <h3 className="text-lg font-semibold">Add student</h3>
            <label className="mt-4 block text-sm font-medium" htmlFor="classId">
              Class
            </label>
            <select
              id="classId"
              name="classId"
              required
              className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/40 focus:ring-2"
            >
              <option value="">Choose a class</option>
              {classes.map((classItem: (typeof classes)[number]) => (
                <option key={classItem.id} value={classItem.id}>
                  {classItem.name}
                </option>
              ))}
            </select>
            <label className="mt-4 block text-sm font-medium" htmlFor="displayName">
              Student name
            </label>
            <input
              id="displayName"
              name="displayName"
              required
              className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/40 focus:ring-2"
            />
            <label className="mt-4 block text-sm font-medium" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/40 focus:ring-2"
            />
            <button className="mt-4 w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
              Add student
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
