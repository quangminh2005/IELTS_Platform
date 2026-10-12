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
  const updated = await prisma.studentProfile.updateMany({
    where: { id: studentId.data, classes: { some: { class: { teacherId: teacher.id } } } },
    data: { practiceWeeklyGoal: goal.data }
  });
  if (updated.count === 0) return { ok: false, message: "Không tìm thấy học viên." };

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

  const updated = await prisma.studentProfile.updateMany({
    where: { classes: { some: { class: { id: classId.data, teacherId: teacher.id } } } },
    data: { practiceWeeklyGoal: goal.data }
  });

  revalidatePath("/teacher/practice");
  return { ok: true, message: `Đã đặt ${goal.data} phần/tuần cho ${updated.count} học viên.` };
}
