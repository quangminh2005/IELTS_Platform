"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { requireStudent } from "@/lib/actions/attempts";
import { requireTeacher } from "@/lib/actions/classes";
import { runAiGrading } from "@/lib/ai-grading/grade-attempt";
import { isAiGradingEnabled } from "@/lib/ai-grading/openai";
import { effectiveDailyLimit, MAX_AI_DAILY_LIMIT, vnDayStart } from "@/lib/ai-grading/quota";
import { AI_REVIEW_VIEW_SELECT, improvedTextFor, toAiReviewView } from "@/lib/ai-grading/views";
import { onlyPracticeRecipient } from "@/lib/practice";
import { prisma } from "@/lib/prisma";

export type AiActionResult = { ok: boolean; message: string };

const NOT_CONFIGURED = "Chưa cấu hình OPENAI_API_KEY trên máy chủ.";

// Thầy bấm "AI chấm nháp" ở trang chấm. Không giới hạn lượt; kết quả chỉ là nháp.
export async function requestTeacherAiReview(attemptId: string): Promise<AiActionResult> {
  const teacher = await requireTeacher();

  if (!isAiGradingEnabled()) {
    return { ok: false, message: NOT_CONFIGURED };
  }

  const attempt = await prisma.attempt.findFirst({
    where: {
      id: String(attemptId),
      status: { in: ["submitted", "reviewed"] },
      assignmentRecipient: { assignment: { teacherId: teacher.id } }
    },
    select: { id: true, studentId: true }
  });

  if (!attempt) {
    return { ok: false, message: "Không tìm thấy bài làm này." };
  }

  const result = await runAiGrading({
    attemptId: attempt.id,
    studentId: attempt.studentId,
    requestedBy: "teacher"
  });

  revalidatePath(`/teacher/review/${attempt.id}`);
  revalidatePath("/teacher/review");

  return result.ok
    ? { ok: true, message: "AI đã chấm xong bản nháp." }
    : { ok: false, message: result.message };
}

// Thầy bấm "Gửi cho học viên" / "Thu hồi" bản nâng cấp AI của một bài viết. Gửi =
// chép bản nâng cấp của lượt AI xong GẦN NHẤT vào Answer.aiImprovedText (bản chụp),
// học viên thấy ngay ở trang Kết quả.
export async function shareAiImprovedText(answerId: string, share: boolean): Promise<AiActionResult> {
  const teacher = await requireTeacher();

  const answer = await prisma.answer.findFirst({
    where: {
      id: String(answerId),
      isCorrect: null,
      assignableUnit: { skill: "writing" },
      attempt: {
        status: { in: ["submitted", "reviewed"] },
        assignmentRecipient: { assignment: { teacherId: teacher.id } }
      }
    },
    select: { id: true, attemptId: true }
  });

  if (!answer) {
    return { ok: false, message: "Không tìm thấy bài viết này." };
  }

  let text: string | null = null;
  if (share) {
    const row = await prisma.aiReview.findFirst({
      where: { attemptId: answer.attemptId, status: "done" },
      orderBy: { createdAt: "desc" },
      select: AI_REVIEW_VIEW_SELECT
    });
    text = row ? improvedTextFor(toAiReviewView(row, new Date()).result, answer.id) : null;
    if (!text) {
      return { ok: false, message: "Lượt AI chấm gần nhất không có bản nâng cấp cho bài này." };
    }
  }

  await prisma.answer.update({ where: { id: answer.id }, data: { aiImprovedText: text } });

  revalidatePath(`/teacher/review/${answer.attemptId}`);
  revalidatePath(`/student/results/${answer.attemptId}`);

  return { ok: true, message: share ? "Đã gửi bản nâng cấp cho học viên." : "Đã thu hồi bản nâng cấp." };
}

// Học viên bấm "Nhờ AI chấm" ở trang Kết quả — CHỈ bài tự luyện, mỗi bài một lần,
// có giới hạn lượt/ngày theo thầy sở hữu bài.
export async function requestStudentAiReview(attemptId: string): Promise<AiActionResult> {
  const student = await requireStudent();

  if (!isAiGradingEnabled()) {
    return { ok: false, message: NOT_CONFIGURED };
  }

  const attempt = await prisma.attempt.findFirst({
    where: {
      id: String(attemptId),
      studentId: student.id,
      status: { in: ["submitted", "reviewed"] },
      assignmentRecipient: onlyPracticeRecipient
    },
    select: {
      id: true,
      assignmentRecipient: { select: { assignment: { select: { teacherId: true } } } }
    }
  });

  if (!attempt) {
    return { ok: false, message: "Chỉ bài tự luyện đã nộp mới nhờ AI chấm được." };
  }

  const already = await prisma.aiReview.findFirst({
    where: { attemptId: attempt.id, requestedBy: "student", status: "done" },
    select: { id: true }
  });
  if (already) {
    return { ok: false, message: "Bài này đã được AI chấm rồi." };
  }

  const owner = await prisma.teacherProfile.findUnique({
    where: { id: attempt.assignmentRecipient.assignment.teacherId },
    select: { aiDailyLimit: true }
  });
  const limit = effectiveDailyLimit(owner?.aiDailyLimit);
  const usedToday = await prisma.aiReview.count({
    where: {
      studentId: student.id,
      requestedBy: "student",
      status: "done",
      createdAt: { gte: vnDayStart(new Date()) }
    }
  });

  if (usedToday >= limit) {
    return { ok: false, message: `Hôm nay em đã dùng hết ${limit} lượt AI chấm, mai quay lại nhé.` };
  }

  const result = await runAiGrading({
    attemptId: attempt.id,
    studentId: student.id,
    requestedBy: "student"
  });

  revalidatePath(`/student/results/${attempt.id}`);
  revalidatePath("/teacher/review");

  return result.ok
    ? { ok: true, message: "AI đã chấm xong." }
    : { ok: false, message: result.message };
}

const limitSchema = z.object({
  aiDailyLimit: z.coerce
    .number({ error: "Nhập số lượt." })
    .int("Số lượt phải là số nguyên.")
    .min(0, "Số lượt không được âm.")
    .max(MAX_AI_DAILY_LIMIT, `Tối đa ${MAX_AI_DAILY_LIMIT} lượt mỗi ngày.`)
});

// Thầy đặt số lượt AI chấm mỗi học viên được dùng mỗi ngày (0 = tắt cho học viên).
export async function updateAiDailyLimit(formData: FormData): Promise<ActionResult> {
  const teacher = await requireTeacher();

  try {
    const parsed = limitSchema.safeParse({ aiDailyLimit: formData.get("aiDailyLimit") });
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Số lượt không hợp lệ.");
    }

    await prisma.teacherProfile.update({
      where: { id: teacher.id },
      data: { aiDailyLimit: parsed.data.aiDailyLimit }
    });

    revalidatePath("/teacher/practice");
    return actionOk(`Đã đặt ${parsed.data.aiDailyLimit} lượt AI chấm mỗi ngày cho mỗi học viên.`);
  } catch (error) {
    return actionFail(error, "Lưu giới hạn lượt AI");
  }
}
