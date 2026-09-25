"use server";

import { z } from "zod";

import { requireStudent } from "@/lib/actions/attempts";
import { prisma } from "@/lib/prisma";
import {
  SPEAKING_PLAN_MAX_LENGTH,
  canEditSpeakingPlan,
  speakingPlanDeadline,
  speakingPlanRemainingSeconds
} from "@/lib/speaking-plan";

// Dàn ý chuẩn bị trước khi nói — xem lib/speaking-plan.ts và
// docs/superpowers/specs/2026-09-25-speaking-plan-design.md.

export type SpeakingPlanResult =
  | { ok: true; text: string; locked: boolean; remainingSeconds: number }
  | { ok: false; message: string };

const targetSchema = z.object({
  attemptId: z.string().trim().min(1),
  questionId: z.string().trim().min(1)
});

const saveSchema = targetSchema.extend({
  text: z.string().max(SPEAKING_PLAN_MAX_LENGTH, "Dàn ý dài quá."),
  lock: z.boolean().default(false)
});

// Kiểm: lượt làm bài của đúng học viên, đang mở, phần Nói chưa nộp, bài giao có bật
// lập dàn ý, và câu hỏi là câu Nói thuộc chính bài giao đó. Trả số phút chuẩn bị.
async function loadPlanContext(
  studentId: string,
  attemptId: string,
  questionId: string
): Promise<{ prepMinutes: number } | { error: string }> {
  const attempt = await prisma.attempt.findFirst({
    where: { id: attemptId, studentId, status: "in_progress" },
    select: {
      skills: { where: { skill: "speaking" }, select: { status: true } },
      assignmentRecipient: {
        select: { assignment: { select: { id: true, speakingPrepMinutes: true } } }
      }
    }
  });
  if (!attempt) {
    return { error: "Không tìm thấy lượt làm bài đang mở." };
  }
  if (attempt.skills[0]?.status === "submitted") {
    return { error: "Phần Nói đã nộp rồi." };
  }
  const { assignment } = attempt.assignmentRecipient;
  if (!assignment.speakingPrepMinutes) {
    return { error: "Bài này không có phần lập dàn ý." };
  }

  const question = await prisma.question.findFirst({
    where: {
      id: questionId,
      assignableUnit: {
        skill: "speaking",
        assignmentUnits: { some: { assignmentId: assignment.id } }
      }
    },
    select: { id: true }
  });
  if (!question) {
    return { error: "Câu hỏi không thuộc bài này." };
  }

  return { prepMinutes: assignment.speakingPrepMinutes };
}

// Học viên bấm "Bắt đầu chuẩn bị". Gọi lại nhiều lần (bấm đúp, tải lại trang) vẫn
// giữ nguyên mốc bắt đầu cũ — không có cách nào xin thêm giờ.
export async function startSpeakingPlan(input: {
  attemptId: string;
  questionId: string;
}): Promise<SpeakingPlanResult> {
  const student = await requireStudent();
  const parsed = targetSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Dữ liệu không hợp lệ." };
  }
  const { attemptId, questionId } = parsed.data;

  const context = await loadPlanContext(student.id, attemptId, questionId);
  if ("error" in context) {
    return { ok: false, message: context.error };
  }

  const plan = await prisma.speakingPlan.upsert({
    where: { attemptId_questionId: { attemptId, questionId } },
    create: { attemptId, questionId },
    update: {},
    select: { text: true, startedAt: true, lockedAt: true }
  });

  const remainingSeconds = speakingPlanRemainingSeconds(plan, context.prepMinutes);
  return { ok: true, text: plan.text, locked: remainingSeconds === 0, remainingSeconds };
}

// Tự lưu dàn ý (vài giây một lần) và lần lưu cuối khi khoá. Server tự quyết còn nhận
// chữ không theo giờ bắt đầu đã lưu — client gửi muộn/sửa code cũng không viết thêm được.
export async function saveSpeakingPlan(input: {
  attemptId: string;
  questionId: string;
  text: string;
  lock?: boolean;
}): Promise<SpeakingPlanResult> {
  const student = await requireStudent();
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  }
  const { attemptId, questionId, text, lock } = parsed.data;

  const context = await loadPlanContext(student.id, attemptId, questionId);
  if ("error" in context) {
    return { ok: false, message: context.error };
  }

  const plan = await prisma.speakingPlan.findUnique({
    where: { attemptId_questionId: { attemptId, questionId } },
    select: { id: true, text: true, startedAt: true, lockedAt: true }
  });
  if (!plan) {
    return { ok: false, message: "Em chưa bấm bắt đầu chuẩn bị." };
  }

  const now = new Date();
  if (canEditSpeakingPlan(plan, context.prepMinutes, now)) {
    const saved = await prisma.speakingPlan.update({
      where: { id: plan.id },
      data: { text, ...(lock ? { lockedAt: now } : {}) },
      select: { text: true, startedAt: true, lockedAt: true }
    });
    const remainingSeconds = speakingPlanRemainingSeconds(saved, context.prepMinutes, now);
    return { ok: true, text: saved.text, locked: remainingSeconds === 0, remainingSeconds };
  }

  // Quá giờ: bỏ chữ mới, chốt khoá tại hạn chót (nếu chưa khoá) và trả lại bản đã lưu.
  if (!plan.lockedAt) {
    await prisma.speakingPlan.update({
      where: { id: plan.id },
      data: { lockedAt: speakingPlanDeadline(plan.startedAt, context.prepMinutes) }
    });
  }
  return { ok: true, text: plan.text, locked: true, remainingSeconds: 0 };
}
