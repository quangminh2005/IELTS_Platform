import type { Prisma } from "@prisma/client";
import { requireTeacherPage } from "@/lib/teacher-page";
import { AssignmentBuilder } from "@/components/assignment-builder";
import { AssignmentList, type AssignmentItem } from "@/components/assignment-list";
import { NoticeToast } from "@/components/notice-toast";
import { prisma } from "@/lib/prisma";
import { excludePracticeAssignment } from "@/lib/practice";

// Cây chọn phần chỉ cần vài field ngắn. KHÔNG dùng include (lấy cả content,
// transcript, transcriptTimingJson, metadataJson) — riêng phần đó đã ~5MB và bị
// nhét hết vào payload gửi xuống trình duyệt, làm trang đơ.
const materialSelect = {
  id: true,
  title: true,
  skill: true,
  sourceLabel: true,
  units: {
    orderBy: [{ unitNumber: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      title: true,
      skill: true,
      unitType: true,
      unitNumber: true,
      defaultTimeLimitMinutes: true
    }
  }
} satisfies Prisma.MaterialSelect;

const classSelect = {
  id: true,
  name: true,
  students: {
    orderBy: { joinedAt: "desc" },
    select: {
      student: {
        select: { id: true, displayName: true, email: true }
      }
    }
  }
} satisfies Prisma.ClassSelect;

const assignmentSelect = {
  id: true,
  createdAt: true,
  title: true,
  instructions: true,
  deadline: true,
  timeLimitMinutes: true,
  skillTimeLimitsJson: true,
  lockAudio: true,
  mode: true,
  _count: {
    select: {
      units: true,
      recipients: true
    }
  },
  units: {
    orderBy: { order: "asc" },
    select: {
      assignableUnitId: true,
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
} satisfies Prisma.AssignmentSelect;

type TeacherMaterial = Prisma.MaterialGetPayload<{ select: typeof materialSelect }>;
type TeacherClass = Prisma.ClassGetPayload<{ select: typeof classSelect }>;
type RecentAssignment = Prisma.AssignmentGetPayload<{ select: typeof assignmentSelect }>;

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
    assignmentsReset?: string;
  };
};

export default async function TeacherAssignmentsPage({ searchParams }: TeacherAssignmentsPageProps) {
  const teacher = await requireTeacherPage();
  const assignmentsMessage = searchParams?.assignmentsMessage;
  const assignmentsStatus = searchParams?.assignmentsStatus === "success" ? "success" : "error";
  // Đổi sau mỗi lần tạo bài thành công → truyền cho form để remount, xoá sạch
  // phần/học viên đã tích cho lần giao kế tiếp.
  const builderResetKey = searchParams?.assignmentsReset ?? "builder";

  const [materials, classes, assignments]: [TeacherMaterial[], TeacherClass[], RecentAssignment[]] =
    await Promise.all([
      prisma.material.findMany({
        where: { teacherId: teacher.id },
        orderBy: { createdAt: "desc" },
        select: materialSelect
      }),
      prisma.class.findMany({
        where: { teacherId: teacher.id },
        orderBy: { createdAt: "desc" },
        select: classSelect
      }),
      prisma.assignment.findMany({
        // Bài giao ảo của thư viện tự luyện không phải bài giáo viên giao — ẩn đi.
        where: { teacherId: teacher.id, ...excludePracticeAssignment },
        orderBy: { createdAt: "desc" },
        select: assignmentSelect
      })
    ]);

  const students = flattenStudents(classes);
  const classOptions = classes.map((classItem) => ({ id: classItem.id, name: classItem.name }));

  const assignmentItems: AssignmentItem[] = assignments.map((assignment) => ({
    id: assignment.id,
    createdAt: assignment.createdAt,
    title: assignment.title,
    instructions: assignment.instructions,
    deadline: assignment.deadline,
    timeLimitMinutes: assignment.timeLimitMinutes,
    skillTimeLimitsJson: assignment.skillTimeLimitsJson,
    lockAudio: assignment.lockAudio,
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

      <NoticeToast message={assignmentsMessage} status={assignmentsStatus} />


      <section>
        <AssignmentList
          assignments={assignmentItems}
          materials={materials}
          students={students}
          classOptions={classOptions}
          headerAction={
            <AssignmentBuilder
              resetToken={builderResetKey}
              materials={materials}
              students={students}
              classOptions={classOptions}
            />
          }
        />
      </section>
    </div>
  );
}
