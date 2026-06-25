"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const classSchema = z.object({
  name: z.string().trim().min(2, "Class name must be at least 2 characters."),
  description: z.string().trim().optional()
});

const studentSchema = z.object({
  classId: z.string().trim().min(1, "Choose a class."),
  email: z.string().trim().email("Enter a valid email address.").toLowerCase(),
  displayName: z.string().trim().min(1, "Student name is required.")
});

export async function requireTeacher() {
  const session = await auth();
  const user = session?.user;

  if (!user?.id || user.role !== "teacher") {
    throw new Error("Teacher access required.");
  }

  return prisma.teacherProfile.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      displayName: "Teacher"
    }
  });
}

export async function createClass(formData: FormData) {
  const teacher = await requireTeacher();
  const parsed = classSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description")
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid class details.");
  }

  await prisma.class.create({
    data: {
      teacherId: teacher.id,
      name: parsed.data.name,
      description: parsed.data.description || null
    }
  });

  revalidatePath("/teacher");
  revalidatePath("/teacher/classes");
}

export async function addStudent(formData: FormData) {
  const teacher = await requireTeacher();
  const parsed = studentSchema.safeParse({
    classId: formData.get("classId"),
    email: formData.get("email"),
    displayName: formData.get("displayName")
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid student details.");
  }

  const targetClass = await prisma.class.findFirst({
    where: {
      id: parsed.data.classId,
      teacherId: teacher.id
    },
    select: { id: true }
  });

  if (!targetClass) {
    throw new Error("Class not found for this teacher.");
  }

  const student = await prisma.studentProfile.upsert({
    where: { email: parsed.data.email },
    update: {
      displayName: parsed.data.displayName
    },
    create: {
      email: parsed.data.email,
      displayName: parsed.data.displayName
    }
  });

  await prisma.classStudent.upsert({
    where: {
      classId_studentId: {
        classId: targetClass.id,
        studentId: student.id
      }
    },
    update: {},
    create: {
      classId: targetClass.id,
      studentId: student.id
    }
  });

  revalidatePath("/teacher");
  revalidatePath("/teacher/classes");
  revalidatePath(`/teacher/students/${student.id}`);
}
