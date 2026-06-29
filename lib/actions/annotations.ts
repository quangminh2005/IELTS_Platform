"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTeacher } from "@/lib/actions/classes";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  answerId: z.string().trim().min(1),
  startOffset: z.coerce.number().int().min(0),
  endOffset: z.coerce.number().int().min(0),
  quote: z.string().min(1, "Chưa chọn đoạn văn bản."),
  note: z.string().trim().min(1, "Nhập nội dung ghi chú.").max(2000)
});

function revalidateForAttempt(attemptId: string) {
  revalidatePath(`/teacher/review/${attemptId}`);
  revalidatePath(`/student/results/${attemptId}`);
}

export async function createAnswerAnnotation(formData: FormData) {
  const teacher = await requireTeacher();
  const parsed = createSchema.safeParse({
    answerId: formData.get("answerId"),
    startOffset: formData.get("startOffset"),
    endOffset: formData.get("endOffset"),
    quote: formData.get("quote"),
    note: formData.get("note")
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Ghi chú không hợp lệ.");
  }

  if (parsed.data.endOffset <= parsed.data.startOffset) {
    throw new Error("Đoạn bôi đen không hợp lệ.");
  }

  // Chỉ cho phép ghi chú trên bài thuộc lớp/bài tập của chính giáo viên này.
  const answer = await prisma.answer.findFirst({
    where: {
      id: parsed.data.answerId,
      attempt: {
        assignmentRecipient: {
          assignment: { teacherId: teacher.id }
        }
      }
    },
    select: { id: true, attemptId: true }
  });

  if (!answer) {
    throw new Error("Không tìm thấy bài làm phù hợp.");
  }

  await prisma.answerAnnotation.create({
    data: {
      answerId: answer.id,
      teacherId: teacher.id,
      startOffset: parsed.data.startOffset,
      endOffset: parsed.data.endOffset,
      quote: parsed.data.quote,
      note: parsed.data.note
    }
  });

  revalidateForAttempt(answer.attemptId);
}

export async function deleteAnswerAnnotation(formData: FormData) {
  const teacher = await requireTeacher();
  const annotationId = String(formData.get("annotationId") ?? "").trim();
  const attemptId = String(formData.get("attemptId") ?? "").trim();

  if (!annotationId) {
    throw new Error("Thiếu mã ghi chú.");
  }

  await prisma.answerAnnotation.deleteMany({
    where: { id: annotationId, teacherId: teacher.id }
  });

  if (attemptId) {
    revalidateForAttempt(attemptId);
  }
}
