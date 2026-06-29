import type { Prisma } from "@prisma/client";
import { AssignmentBuilder } from "@/components/assignment-builder";
import { AssignmentList, type AssignmentItem } from "@/components/assignment-list";
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
  },
  recipients: {
    select: {
      studentId: true,
      status: true
    }
  }
} satisfies Prisma.AssignmentInclude;

type TeacherMaterial = Prisma.MaterialGetPayload<{ include: typeof materialInclude }>;
type TeacherClass = Prisma.ClassGetPayload<{ include: typeof classInclude }>;
type RecentAssignment = Prisma.AssignmentGetPayload<{ include: typeof assignmentInclude }>;

function flattenStudents(classes: TeacherClass[]) {
  const students = new Map<
    string,
    { id: string; displayName: string; email: string; classNames: string[]; classIds: string[] }
  >();

  classes.forEach((classItem) => {
    classItem.students.forEach((membership) => {
      const existing = students.get(membership.student.id);

      if (existing) {
        existing.classNames.push(classItem.name);
        existing.classIds.push(classItem.id);
        return;
      }

      students.set(membership.student.id, {
        id: membership.student.id,
        displayName: membership.student.displayName,
        email: membership.student.email,
        classNames: [classItem.name],
        classIds: [classItem.id]
      });
    });
  });

  return Array.from(students.values()).sort((a, b) => a.displayName.localeCompare(b.displayName));
}

const SUBMITTED_STATUSES = new Set(["submitted", "reviewed"]);

type TeacherAssignmentsPageProps = {
  searchParams?: {
    assignmentsMessage?: string;
    assignmentsStatus?: string;
  };
};

export default async function TeacherAssignmentsPage({ searchParams }: TeacherAssignmentsPageProps) {
  const teacher = await requireTeacher();
  const assignmentsMessage = searchParams?.assignmentsMessage;
  const assignmentsStatus = searchParams?.assignmentsStatus === "success" ? "success" : "error";

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
  const classOptions = classes.map((classItem) => ({ id: classItem.id, name: classItem.name }));

  const assignmentItems: AssignmentItem[] = assignments.map((assignment) => ({
    id: assignment.id,
    title: assignment.title,
    instructions: assignment.instructions,
    deadline: assignment.deadline,
    timeLimitMinutes: assignment.timeLimitMinutes,
    mode: assignment.mode,
    unitCount: assignment._count.units,
    recipientCount: assignment._count.recipients,
    submittedCount: assignment.recipients.filter((recipient) =>
      SUBMITTED_STATUSES.has(recipient.status)
    ).length,
    unitIds: assignment.units.map((unit) => unit.assignableUnitId),
    unitTitles: assignment.units.map((unit) => unit.assignableUnit.title),
    studentIds: assignment.recipients.map((recipient) => recipient.studentId)
  }));

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-semibold text-primary">Bài tập về nhà</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Giao bài</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Tạo bài tập từ các phần tài liệu có sẵn rồi gửi cho học viên trong lớp của bạn.
        </p>
      </header>

      {assignmentsMessage ? (
        <div
          className={
            assignmentsStatus === "success"
              ? "rounded-md border border-primary/40 bg-primary/10 px-4 py-3 text-sm font-medium text-primary"
              : "rounded-md border border-red-400/60 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-700 dark:text-red-300"
          }
        >
          {assignmentsMessage}
        </div>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_25rem]">
        <AssignmentList
          assignments={assignmentItems}
          materials={materials}
          students={students}
          classOptions={classOptions}
        />

        <AssignmentBuilder
          materials={materials}
          students={students}
          classOptions={classOptions}
        />
      </section>
    </div>
  );
}
