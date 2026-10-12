"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTeacher } from "@/lib/actions/classes";
import type { ActionResult } from "@/lib/action-result";
import { MAX_PRACTICE_GOAL } from "@/lib/practice-goal";
import { prisma } from "@/lib/prisma";

// Thầy đặt chỉ tiêu tự luyện mỗi tuần (lib/practice-goal.ts) cho một em hoặc cả lớp.
const goalSchema = z.coerce.number().int().min(0).max(MAX_PRACTICE_GOAL);
const invalidGoal: ActionResult = {
  ok: false,
  message: `Chỉ tiêu phải là số nguyên từ 0 đến ${MAX_PRACTICE_GOAL}.`
};

export async function setPracticeGoal(formData: FormData): Promise<ActionResult> {
  const teacher = await requireTeacher();
  const studentId = z.string().min(1).safeParse(formData.get("studentId"));
  const goal = goalSchema.safeParse(formData.get("goal"));
  if (!studentId.success || !goal.success) return invalidGoal;

  // Chỉ học viên thuộc lớp của chính thầy — id lạ không sửa được gì.
  const where = { id: studentId.data, classes: { some: { class: { teacherId: teacher.id } } } };
  const student = await prisma.studentProfile.findFirst({ where, select: { practiceWeeklyGoal: true } });
  if (!student) return { ok: false, message: "Không tìm thấy học viên." };

  await prisma.studentProfile.updateMany({
    where,
    data: {
      practiceWeeklyGoal: goal.data,
      // Bật lại sau khi miễn: tính chỉ tiêu từ tuần sau, tuần đã miễn không bị trừ.
      ...(student.practiceWeeklyGoal === 0 && goal.data > 0 ? { practiceGoalSince: new Date() } : {})
    }
  });

  revalidatePath("/teacher/practice");
  revalidatePath(`/teacher/students/${studentId.data}`);
  return {
    ok: true,
    message: goal.data === 0 ? "Đã miễn chỉ tiêu tự luyện." : `Đã đặt ${goal.data} phần/tuần.`
  };
}

export async function setClassPracticeGoal(formData: FormData): Promise<ActionResult> {
  const teacher = await requireTeacher();
  const classId = z.string().min(1).safeParse(formData.get("classId"));
  const goal = goalSchema.safeParse(formData.get("goal"));
  if (!classId.success || !goal.success) return invalidGoal;

  const students = await prisma.studentProfile.findMany({
    where: { classes: { some: { class: { id: classId.data, teacherId: teacher.id } } } },
    select: { id: true, practiceWeeklyGoal: true }
  });
  // Em đang miễn (0) mà nay được giao chỉ tiêu → ghi mốc bật lại (xem setPracticeGoal).
  const reenabledIds = students
    .filter((student) => student.practiceWeeklyGoal === 0 && goal.data > 0)
    .map((student) => student.id);
  const otherIds = students
    .map((student) => student.id)
    .filter((id) => !reenabledIds.includes(id));

  await prisma.$transaction([
    prisma.studentProfile.updateMany({
      where: { id: { in: reenabledIds } },
      data: { practiceWeeklyGoal: goal.data, practiceGoalSince: new Date() }
    }),
    prisma.studentProfile.updateMany({
      where: { id: { in: otherIds } },
      data: { practiceWeeklyGoal: goal.data }
    })
  ]);
  const updated = { count: students.length };

  revalidatePath("/teacher/practice");
  return { ok: true, message: `Đã đặt ${goal.data} phần/tuần cho ${updated.count} học viên.` };
}
