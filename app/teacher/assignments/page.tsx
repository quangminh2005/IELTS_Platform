import type { Prisma } from "@prisma/client";
import { AssignmentBuilder } from "@/components/assignment-builder";
import { requireTeacher } from "@/lib/actions/classes";
import { prisma } from "@/lib/prisma";

const materialInclude = {
  units: {
    orderBy: [{ unitNumber: "asc" }, { createdAt: "asc" }]
  }
} satisfies Prisma.MaterialInclude;

const classInclude = {
  students: {
    include: {
      student: true
    },
    orderBy: { joinedAt: "desc" }
  }
} satisfies Prisma.ClassInclude;

const assignmentInclude = {
  _count: {
    select: {
      units: true,
      recipients: true
    }
  },
  units: {
    orderBy: { order: "asc" },
    include: {
      assignableUnit: {
        select: {
          title: true
        }
      }
    }
  }
} satisfies Prisma.AssignmentInclude;

type TeacherMaterial = Prisma.MaterialGetPayload<{ include: typeof materialInclude }>;
type TeacherClass = Prisma.ClassGetPayload<{ include: typeof classInclude }>;
type RecentAssignment = Prisma.AssignmentGetPayload<{ include: typeof assignmentInclude }>;

function countLabel(value: number, singular: string, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function flattenStudents(classes: TeacherClass[]) {
  const students = new Map<
    string,
    { id: string; displayName: string; email: string; classes: string[] }
  >();

  classes.forEach((classItem) => {
    classItem.students.forEach((membership) => {
      const existing = students.get(membership.student.id);

      if (existing) {
        existing.classes.push(classItem.name);
        return;
      }

      students.set(membership.student.id, {
        id: membership.student.id,
        displayName: membership.student.displayName,
        email: membership.student.email,
        classes: [classItem.name]
      });
    });
  });

  return Array.from(students.values()).sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export default async function TeacherAssignmentsPage() {
  const teacher = await requireTeacher();

  const [materials, classes, assignments]: [TeacherMaterial[], TeacherClass[], RecentAssignment[]] =
    await Promise.all([
      prisma.material.findMany({
        where: { teacherId: teacher.id },
        orderBy: { createdAt: "desc" },
        include: materialInclude
      }),
      prisma.class.findMany({
        where: { teacherId: teacher.id },
        orderBy: { createdAt: "desc" },
        include: classInclude
      }),
      prisma.assignment.findMany({
        where: { teacherId: teacher.id },
        orderBy: { createdAt: "desc" },
        take: 8,
        include: assignmentInclude
      })
    ]);

  const students = flattenStudents(classes);

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-medium uppercase tracking-wide text-primary">Homework</p>
        <h2 className="mt-2 text-3xl font-semibold">Assignments</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Build homework from existing material units and send it to students in your classes.
        </p>
      </header>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_25rem]">
        <div className="rounded-md border border-border bg-muted/35">
          <div className="border-b border-border px-5 py-4">
            <h3 className="text-lg font-semibold">Recent assignments</h3>
          </div>
          <div className="divide-y divide-border">
            {assignments.length > 0 ? (
              assignments.map((assignment) => (
                <article key={assignment.id} className="px-5 py-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-medium">{assignment.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {countLabel(assignment._count.units, "unit")} |{" "}
                        {countLabel(assignment._count.recipients, "recipient")}
                      </p>
                    </div>
                    <p className="text-sm capitalize text-muted-foreground">{assignment.mode}</p>
                  </div>
                  {assignment.units.length > 0 ? (
                    <p className="mt-3 text-sm text-muted-foreground">
                      {assignment.units
                        .map((unit) => unit.assignableUnit.title)
                        .slice(0, 3)
                        .join(", ")}
                      {assignment.units.length > 3 ? "..." : ""}
                    </p>
                  ) : null}
                </article>
              ))
            ) : (
              <p className="px-5 py-8 text-sm text-muted-foreground">
                No assignments yet. Create homework from the builder.
              </p>
            )}
          </div>
        </div>

        <AssignmentBuilder materials={materials} students={students} />
      </section>
    </div>
  );
}
