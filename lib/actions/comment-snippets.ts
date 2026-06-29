"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTeacher } from "@/lib/actions/classes";
import { prisma } from "@/lib/prisma";

const snippetSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Nội dung nhận xét không được để trống.")
    .max(2000, "Nhận xét mẫu quá dài.")
});

function revalidateReview(formData: FormData) {
  revalidatePath("/teacher/review");
  const attemptId = String(formData.get("attemptId") ?? "").trim();
  if (attemptId) {
    revalidatePath(`/teacher/review/${attemptId}`);
  }
}

export async function createCommentSnippet(formData: FormData) {
  const teacher = await requireTeacher();
  const parsed = snippetSchema.safeParse({ text: formData.get("text") });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid snippet.");
  }

  await prisma.commentSnippet.create({
    data: { teacherId: teacher.id, text: parsed.data.text }
  });

  revalidateReview(formData);
}

export async function deleteCommentSnippet(formData: FormData) {
  const teacher = await requireTeacher();
  const snippetId = String(formData.get("snippetId") ?? "").trim();

  if (!snippetId) {
    throw new Error("Missing snippet id.");
  }

  // deleteMany + teacherId: chỉ xoá được câu mẫu của chính giáo viên này.
  await prisma.commentSnippet.deleteMany({
    where: { id: snippetId, teacherId: teacher.id }
  });

  revalidateReview(formData);
}
