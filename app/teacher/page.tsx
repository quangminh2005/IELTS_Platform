import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireTeacher } from "@/lib/actions/classes";

function countLabel(value: number, singular: string, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`;
}

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
    { label: "Classes", value: classCount, note: "Active teaching groups" },
    { label: "Students", value: studentCount, note: "Class enrollments" },
    { label: "Materials", value: materialCount, note: "Assignable IELTS content" },
    { label: "Assignments", value: assignmentCount, note: `${reviewCount} reviewed attempts` }
  ];

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-primary">Teacher home</p>
          <h2 className="mt-2 text-3xl font-semibold">Dashboard</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Manage classes and keep an eye on the assignment and review workload.
          </p>
        </div>
        <Link
          href="/teacher/classes"
          className="inline-flex rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          Manage classes
        </Link>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <article key={card.label} className="rounded-md border border-border bg-muted/50 p-5">
            <p className="text-sm text-muted-foreground">{card.label}</p>
            <p className="mt-3 text-3xl font-semibold">{card.value}</p>
            <p className="mt-2 text-sm text-muted-foreground">{card.note}</p>
          </article>
        ))}
      </section>

      <section className="rounded-md border border-border bg-muted/35">
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-lg font-semibold">Recent classes</h3>
        </div>
        <div className="divide-y divide-border">
          {recentClasses.length > 0 ? (
            recentClasses.map((classItem: (typeof recentClasses)[number]) => (
              <div
                key={classItem.id}
                className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{classItem.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {countLabel(classItem._count.students, "student")}
                  </p>
                </div>
                <Link href="/teacher/classes" className="text-sm font-medium text-primary">
                  Open
                </Link>
              </div>
            ))
          ) : (
            <p className="px-5 py-8 text-sm text-muted-foreground">
              Create your first class to start enrolling students.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
