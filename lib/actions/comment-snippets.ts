"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { requireTeacher } from "@/lib/actions/classes";
import { DEFAULT_COMMENT_SNIPPETS } from "@/lib/default-comment-snippets";
import { prisma } from "@/lib/prisma";

// Giữ đồng bộ với ReviewCriterion ở đầu prisma/schema.prisma và các key tiêu chí
// trong lib/writing-review.ts.
const CRITERION_KEYS = [
  "taskAchievement",
  "coherence",
  "fluency",
  "lexicalResource",
  "grammar",
  "pronunciation"
] as const;

const snippetSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Nội dung nhận xét không được để trống.")
    .max(2000, "Nhận xét mẫu quá dài."),
  // Ô trống trong form = câu nhận xét chung, không gắn tiêu chí.
  criterion: z
    .union([z.enum(CRITERION_KEYS), z.literal("")])
    .optional()
    .transform((value) => (value ? value : null))
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
    const parsed = snippetSchema.safeParse({
      text: formData.get("text"),
      criterion: formData.get("criterion") ?? ""
    });

    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Nội dung nhận xét chưa hợp lệ.");
    }

    await prisma.commentSnippet.create({
      data: {
        teacherId: teacher.id,
        text: parsed.data.text,
        criterion: parsed.data.criterion
      }
    });

    revalidateReview(formData);
    return actionOk("Đã thêm câu nhận xét mẫu.");
  } catch (error) {
    return actionFail(error, "Thêm câu mẫu");
  }
}

// Nạp bộ câu mẫu gợi ý. Bỏ qua câu nào giáo viên đã có (so theo nội dung) nên
// bấm nhiều lần không sinh trùng.
export async function seedDefaultCommentSnippets(
  formData: FormData
): Promise<ActionResult> {
  const teacher = await requireTeacher(); // NGOÀI try: lỗi phân quyền ném ra như cũ

  try {
    const existing = await prisma.commentSnippet.findMany({
      where: { teacherId: teacher.id },
      select: { text: true }
    });
    const already = new Set(existing.map((row) => row.text.trim()));
    const missing = DEFAULT_COMMENT_SNIPPETS.filter(
      (snippet) => !already.has(snippet.text)
    );

    if (missing.length === 0) {
      revalidateReview(formData);
      return actionOk("Bộ câu mẫu gợi ý đã có sẵn đủ.");
    }

    await prisma.commentSnippet.createMany({
      data: missing.map((snippet) => ({
        teacherId: teacher.id,
        text: snippet.text,
        criterion: snippet.criterion
      }))
    });

    revalidateReview(formData);
    return actionOk(`Đã thêm ${missing.length} câu mẫu gợi ý.`);
  } catch (error) {
    return actionFail(error, "Thêm bộ câu mẫu");
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
