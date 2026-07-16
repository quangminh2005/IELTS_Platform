"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { requireTeacher } from "@/lib/actions/classes";
import { prisma } from "@/lib/prisma";

const reviewSchema = z.object({
  attemptId: z.string().trim().min(1, "Thiếu bài làm."),
  overallBand: z.coerce
    .number({ error: "Cần nhập band tổng." })
    .min(0, "Band tổng phải từ 0 trở lên.")
    .max(9, "Band tổng không được quá 9."),
  criteriaScoresJson: z.string().trim().optional(),
  summaryFeedback: z.string().trim().min(1, "Cần nhập nhận xét tổng quan."),
  detailedFeedback: z.string().trim().optional()
});

function optionalText(value?: string) {
  return value ? value : null;
}

function validateCriteriaScoresJson(value?: string) {
  if (!value) {
    return null;
  }

  try {
    JSON.parse(value);
  } catch {
    throw new Error("Điểm tiêu chí phải là JSON hợp lệ.");
  }

  return value;
}

export async function saveTeacherReview(formData: FormData): Promise<ActionResult> {
  const teacher = await requireTeacher(); // NGOÀI try: lỗi phân quyền ném ra như cũ

  let savedBand: number;

  try {
    const parsed = reviewSchema.safeParse({
      attemptId: formData.get("attemptId"),
      overallBand: formData.get("overallBand"),
      criteriaScoresJson: formData.get("criteriaScoresJson"),
      summaryFeedback: formData.get("summaryFeedback"),
      detailedFeedback: formData.get("detailedFeedback")
    });

    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Thông tin nhận xét chưa hợp lệ.");
    }

    const criteriaScoresJson = validateCriteriaScoresJson(parsed.data.criteriaScoresJson);
    const attempt = await prisma.attempt.findFirst({
      where: {
        id: parsed.data.attemptId,
        assignmentRecipient: {
          assignment: {
            teacherId: teacher.id
          }
        }
      },
      select: {
        id: true,
        studentId: true,
        assignmentRecipientId: true
      }
    });

    if (!attempt) {
      throw new Error("Không tìm thấy bài làm này.");
    }

    const reviewedAt = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.teacherReview.upsert({
        where: { attemptId: attempt.id },
        update: {
          teacherId: teacher.id,
          studentId: attempt.studentId,
          overallBand: parsed.data.overallBand,
          criteriaScoresJson,
          summaryFeedback: parsed.data.summaryFeedback,
          detailedFeedback: optionalText(parsed.data.detailedFeedback),
          reviewedAt
        },
        create: {
          attemptId: attempt.id,
          teacherId: teacher.id,
          studentId: attempt.studentId,
          overallBand: parsed.data.overallBand,
          criteriaScoresJson,
          summaryFeedback: parsed.data.summaryFeedback,
          detailedFeedback: optionalText(parsed.data.detailedFeedback),
          reviewedAt
        }
      });

      await tx.attempt.update({
        where: { id: attempt.id },
        data: { status: "reviewed" }
      });

      await tx.assignmentRecipient.update({
        where: { id: attempt.assignmentRecipientId },
        data: { status: "reviewed" }
      });
    });

    revalidatePath("/teacher");
    revalidatePath("/teacher/review");
    revalidatePath(`/teacher/review/${attempt.id}`);
    revalidatePath("/student");
    revalidatePath("/student/history");
    revalidatePath("/student/ranking");
    revalidatePath(`/student/results/${attempt.id}`);

    savedBand = parsed.data.overallBand;
  } catch (error) {
    return actionFail(error, "Lưu nhận xét");
  }

  // "Lưu & chấm bài tiếp": sau khi lưu xong thì nhảy thẳng sang bài kế tiếp trong
  // hàng đợi (do trang chi tiết truyền vào), giúp chấm liên tục. Đặt NGOÀI try để
  // redirect() (ném NEXT_REDIRECT) không bị catch nuốt mất — ActionForm cho lỗi này
  // đi qua để Next điều hướng.
  const goNext = String(formData.get("goNext") ?? "");
  const nextAttemptId = String(formData.get("nextAttemptId") ?? "").trim();

  if (goNext === "1" && nextAttemptId) {
    redirect(`/teacher/review/${nextAttemptId}`);
  }

  return actionOk(`Đã lưu nhận xét (band ${savedBand}).`);
}
