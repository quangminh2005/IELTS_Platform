"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTeacher } from "@/lib/actions/classes";
import { prisma } from "@/lib/prisma";

const assignmentSchema = z.object({
  title: z.string().trim().min(2, "Assignment title must be at least 2 characters."),
  instructions: z.string().trim().optional(),
  timeLimitMinutes: z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    z.coerce.number().int().min(1, "Time limit must be at least 1 minute.").optional()
  ),
  unitIds: z.array(z.string().trim().min(1)).min(1, "Choose at least one unit."),
  studentIds: z.array(z.string().trim().min(1)).min(1, "Choose at least one student.")
});

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
    unitIds: formData.getAll("unitIds"),
    studentIds: formData.getAll("studentIds")
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid assignment details.");
  }

  const unitIds = uniqueInOrder(parsed.data.unitIds);
  const studentIds = uniqueInOrder(parsed.data.studentIds);

  const [units, students] = await Promise.all([
    prisma.assignableUnit.findMany({
      where: {
        id: { in: unitIds },
        material: { teacherId: teacher.id }
      },
      select: { id: true }
    }),
    prisma.studentProfile.findMany({
      where: {
        id: { in: studentIds },
        classes: {
          some: {
            class: { teacherId: teacher.id }
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

  await prisma.assignment.create({
    data: {
      teacherId: teacher.id,
      title: parsed.data.title,
      instructions: optionalText(parsed.data.instructions),
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

  revalidatePath("/teacher");
  revalidatePath("/teacher/assignments");
  revalidatePath("/student");
  revalidatePath("/student/history");
}
