"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireTeacher } from "@/lib/actions/classes";
import { parseAssignmentDeadline } from "@/lib/assignment-deadline";
import { assignmentNoticePath } from "@/lib/assignment-notices";
import { prisma } from "@/lib/prisma";

const assignmentSchema = z.object({
  title: z.string().trim().min(2, "Assignment title must be at least 2 characters."),
  instructions: z.string().trim().optional(),
  timeLimitMinutes: z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    z.coerce.number().int().min(1, "Time limit must be at least 1 minute.").optional()
  ),
  dueDate: z.string().trim().optional(),
  dueTime: z.string().trim().optional(),
  unitIds: z.array(z.string().trim().min(1)).min(1, "Choose at least one unit."),
  studentIds: z.array(z.string().trim().min(1)).min(1, "Choose at least one student.")
});

const idSchema = z.string().trim().min(1);

async function verifyUnitsAndStudents(
  teacherId: string,
  unitIds: string[],
  studentIds: string[]
) {
  const [units, students] = await Promise.all([
    prisma.assignableUnit.findMany({
      where: {
        id: { in: unitIds },
        material: { teacherId }
      },
      select: { id: true }
    }),
    prisma.studentProfile.findMany({
      where: {
        id: { in: studentIds },
        classes: {
          some: {
            class: { teacherId }
          }
        }
      },
      select: { id: true }
    })
  ]);

  if (units.length !== unitIds.length) {
    throw new Error("One or more selected units are not available to this teacher.");
  }

  if (students.length !== studentIds.length) {
    throw new Error("One or more selected students are not in this teacher's classes.");
  }
}

function uniqueInOrder(values: string[]) {
  const seen = new Set<string>();

  return values.filter((value) => {
    if (seen.has(value)) {
      return false;
    }

    seen.add(value);
    return true;
  });
}

function optionalText(value?: string) {
  return value ? value : null;
}

export async function createAssignment(formData: FormData) {
  const teacher = await requireTeacher();
  const parsed = assignmentSchema.safeParse({
    title: formData.get("title"),
    instructions: formData.get("instructions"),
    timeLimitMinutes: formData.get("timeLimitMinutes"),
    dueDate: formData.get("dueDate"),
    dueTime: formData.get("dueTime"),
    unitIds: formData.getAll("unitIds"),
    studentIds: formData.getAll("studentIds")
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid assignment details.");
  }

  const unitIds = uniqueInOrder(parsed.data.unitIds);
  const studentIds = uniqueInOrder(parsed.data.studentIds);
  const deadline = parseAssignmentDeadline(parsed.data.dueDate, parsed.data.dueTime);

  await verifyUnitsAndStudents(teacher.id, unitIds, studentIds);

  await prisma.assignment.create({
    data: {
      teacherId: teacher.id,
      title: parsed.data.title,
      instructions: optionalText(parsed.data.instructions),
      deadline,
      timeLimitMinutes: parsed.data.timeLimitMinutes ?? null,
      mode: "homework",
      units: {
        create: unitIds.map((unitId, index) => ({
          assignableUnitId: unitId,
          order: index + 1
        }))
      },
      recipients: {
        create: studentIds.map((studentId) => ({
          studentId,
          status: "assigned"
        }))
      }
    }
  });

  revalidateAssignmentPaths();
}

function revalidateAssignmentPaths() {
  revalidatePath("/teacher");
  revalidatePath("/teacher/assignments");
  revalidatePath("/student");
  revalidatePath("/student/history");
}

export async function updateAssignment(formData: FormData) {
  const teacher = await requireTeacher();
  const id = idSchema.parse(formData.get("assignmentId"));
  const parsed = assignmentSchema.safeParse({
    title: formData.get("title"),
    instructions: formData.get("instructions"),
    timeLimitMinutes: formData.get("timeLimitMinutes"),
    dueDate: formData.get("dueDate"),
    dueTime: formData.get("dueTime"),
    unitIds: formData.getAll("unitIds"),
    studentIds: formData.getAll("studentIds")
  });

  if (!parsed.success) {
    redirect(
      assignmentNoticePath("error", parsed.error.issues[0]?.message ?? "Invalid assignment details.")
    );
  }

  const unitIds = uniqueInOrder(parsed.data.unitIds);
  const studentIds = uniqueInOrder(parsed.data.studentIds);
  const deadline = parseAssignmentDeadline(parsed.data.dueDate, parsed.data.dueTime);

  const assignment = await prisma.assignment.findFirst({
    where: {
      id,
      teacherId: teacher.id
    },
    select: {
      id: true,
      recipients: {
        select: {
          studentId: true,
          _count: { select: { attempts: true } }
        }
      }
    }
  });

  if (!assignment) {
    redirect(assignmentNoticePath("error", "Assignment not found for this teacher."));
  }

  await verifyUnitsAndStudents(teacher.id, unitIds, studentIds);

  const nextStudentIds = new Set(studentIds);
  const currentStudentIds = new Set(assignment.recipients.map((recipient) => recipient.studentId));
  const recipientsToRemove = assignment.recipients.filter(
    (recipient) => !nextStudentIds.has(recipient.studentId)
  );

  if (recipientsToRemove.some((recipient) => recipient._count.attempts > 0)) {
    redirect(
      assignmentNoticePath(
        "error",
        "Cannot remove students who have already started or submitted this assignment."
      )
    );
  }

  const studentIdsToRemove = recipientsToRemove.map((recipient) => recipient.studentId);
  const studentIdsToAdd = studentIds.filter((studentId) => !currentStudentIds.has(studentId));

  await prisma.$transaction([
    prisma.assignment.update({
      where: { id: assignment.id },
      data: {
        title: parsed.data.title,
        instructions: optionalText(parsed.data.instructions),
        deadline,
        timeLimitMinutes: parsed.data.timeLimitMinutes ?? null
      }
    }),
    prisma.assignmentUnit.deleteMany({
      where: { assignmentId: assignment.id }
    }),
    prisma.assignmentUnit.createMany({
      data: unitIds.map((unitId, index) => ({
        assignmentId: assignment.id,
        assignableUnitId: unitId,
        order: index + 1
      }))
    }),
    prisma.assignmentRecipient.deleteMany({
      where: {
        assignmentId: assignment.id,
        studentId: { in: studentIdsToRemove }
      }
    }),
    prisma.assignmentRecipient.createMany({
      data: studentIdsToAdd.map((studentId) => ({
        assignmentId: assignment.id,
        studentId,
        status: "assigned"
      }))
    })
  ]);

  revalidateAssignmentPaths();
  redirect(assignmentNoticePath("success", "Assignment updated."));
}

export async function deleteAssignment(formData: FormData) {
  const teacher = await requireTeacher();
  const id = idSchema.parse(formData.get("assignmentId"));

  const assignment = await prisma.assignment.findFirst({
    where: {
      id,
      teacherId: teacher.id
    },
    select: {
      id: true,
      recipients: {
        select: {
          _count: { select: { attempts: true } }
        }
      }
    }
  });

  if (!assignment) {
    redirect(assignmentNoticePath("error", "Assignment not found for this teacher."));
  }

  const hasAttempts = assignment.recipients.some((recipient) => recipient._count.attempts > 0);

  if (hasAttempts) {
    redirect(
      assignmentNoticePath(
        "error",
        "Cannot delete this assignment because students have already started or submitted it."
      )
    );
  }

  await prisma.assignment.delete({
    where: { id: assignment.id }
  });

  revalidateAssignmentPaths();
  redirect(assignmentNoticePath("success", "Assignment deleted."));
}
