"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
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

export async function createCommentSnippet(formData: FormData): Promise<ActionResult> {
  const teacher = await requireTeacher(); // NGOÀI try: lỗi phân quyền ném ra như cũ

  try {
    const parsed = snippetSchema.safeParse({ text: formData.get("text") });

    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Nội dung nhận xét chưa hợp lệ.");
    }

    await prisma.commentSnippet.create({
      data: { teacherId: teacher.id, text: parsed.data.text }
    });

    revalidateReview(formData);
    return actionOk("Đã thêm câu nhận xét mẫu.");
  } catch (error) {
    return actionFail(error, "Thêm câu mẫu");
  }
}

export async function deleteCommentSnippet(formData: FormData): Promise<ActionResult> {
  const teacher = await requireTeacher(); // NGOÀI try: lỗi phân quyền ném ra như cũ

  try {
    const snippetId = String(formData.get("snippetId") ?? "").trim();

    if (!snippetId) {
      throw new Error("Thiếu mã câu mẫu.");
    }

    // deleteMany + teacherId: chỉ xoá được câu mẫu của chính giáo viên này.
    await prisma.commentSnippet.deleteMany({
      where: { id: snippetId, teacherId: teacher.id }
    });

    revalidateReview(formData);
    return actionOk("Đã xoá câu mẫu.");
  } catch (error) {
    return actionFail(error, "Xoá câu mẫu");
  }
}
