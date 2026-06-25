"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { gradeAnswer, gradeAttempt } from "@/lib/grading";
import { prisma } from "@/lib/prisma";

const highlightSchema = z.object({
  attemptId: z.string().trim().min(1),
  assignableUnitId: z.string().trim().min(1),
  sourceType: z.string().trim().min(1),
  selectedText: z.string().trim().min(1),
  startOffset: z.coerce.number().int().min(0),
  endOffset: z.coerce.number().int().min(0),
  color: z.string().trim().min(1).default("yellow"),
  note: z.string().trim().optional()
});

const submitSchema = z.object({
  attemptId: z.string().trim().min(1),
  submitReason: z.enum(["manual", "auto_timeout"]).default("manual"),
  elapsedSeconds: z.coerce.number().int().min(0).default(0),
  tabSwitchCount: z.coerce.number().int().min(0).default(0)
});

export async function requireStudent() {
  const session = await auth();
  const user = session?.user;

  if (!user?.id || user.role !== "student") {
    throw new Error("Student access required.");
  }

  const student = await prisma.studentProfile.findUnique({
    where: { userId: user.id }
  });

  if (!student) {
    throw new Error("Student profile required.");
  }

  return student;
}

function parseCorrectAnswers(value: string | null): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);

    if (Array.isArray(parsed)) {
      return parsed.map((answer) => String(answer));
    }

    if (typeof parsed === "string" || typeof parsed === "number" || typeof parsed === "boolean") {
      return [String(parsed)];
    }
  } catch {
    return [value];
  }

  return [];
}

function answerSnapshot(value: string | null) {
  const answers = parseCorrectAnswers(value);

  return answers.length > 0 ? answers.join(" | ") : value;
}

function optionalText(value?: string) {
  return value ? value : null;
}

export async function startAttempt(recipientId: string) {
  const student = await requireStudent();
  const recipient = await prisma.assignmentRecipient.findFirst({
    where: {
      id: recipientId,
      studentId: student.id
    },
    select: {
      id: true,
      status: true
    }
  });

  if (!recipient) {
    throw new Error("Assignment not found for this student.");
  }

  const existingAttempt = await prisma.attempt.findFirst({
    where: {
      assignmentRecipientId: recipient.id,
      studentId: student.id,
      status: "in_progress"
    },
    orderBy: { startedAt: "desc" }
  });

  if (existingAttempt) {
    if (recipient.status !== "in_progress") {
      await prisma.assignmentRecipient.update({
        where: { id: recipient.id },
        data: { status: "in_progress" }
      });
    }

    return existingAttempt;
  }

  return prisma.$transaction(async (tx) => {
    const attempt = await tx.attempt.create({
      data: {
        assignmentRecipientId: recipient.id,
        studentId: student.id,
        status: "in_progress"
      }
    });

    await tx.assignmentRecipient.update({
      where: { id: recipient.id },
      data: { status: "in_progress" }
    });

    return attempt;
  });
}

export async function saveHighlight(formData: FormData) {
  const student = await requireStudent();
  const parsed = highlightSchema.safeParse({
    attemptId: formData.get("attemptId"),
    assignableUnitId: formData.get("assignableUnitId"),
    sourceType: formData.get("sourceType"),
    selectedText: formData.get("selectedText"),
    startOffset: formData.get("startOffset"),
    endOffset: formData.get("endOffset"),
    color: formData.get("color") ?? "yellow",
    note: formData.get("note")
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid highlight details.");
  }

  const attempt = await prisma.attempt.findFirst({
    where: {
      id: parsed.data.attemptId,
      studentId: student.id,
      status: "in_progress"
    },
    include: {
      assignmentRecipient: {
        select: { assignmentId: true }
      }
    }
  });

  if (!attempt) {
    throw new Error("Attempt not found for this student.");
  }

  const assignmentUnit = await prisma.assignmentUnit.findFirst({
    where: {
      assignmentId: attempt.assignmentRecipient.assignmentId,
      assignableUnitId: parsed.data.assignableUnitId
    },
    select: { id: true }
  });

  if (!assignmentUnit) {
    throw new Error("Unit is not part of this assignment.");
  }

  if (parsed.data.endOffset < parsed.data.startOffset) {
    throw new Error("Highlight offsets are invalid.");
  }

  await prisma.highlight.create({
    data: {
      attemptId: attempt.id,
      studentId: student.id,
      assignableUnitId: parsed.data.assignableUnitId,
      sourceType: parsed.data.sourceType,
      selectedText: parsed.data.selectedText,
      startOffset: parsed.data.startOffset,
      endOffset: parsed.data.endOffset,
      color: parsed.data.color,
      note: optionalText(parsed.data.note)
    }
  });

  revalidatePath(`/student/assignments/${attempt.assignmentRecipientId}`);
}

export async function submitAttempt(formData: FormData) {
  const student = await requireStudent();
  const parsed = submitSchema.safeParse({
    attemptId: formData.get("attemptId"),
    submitReason: formData.get("submitReason") ?? "manual",
    elapsedSeconds: formData.get("elapsedSeconds") ?? 0,
    tabSwitchCount: formData.get("tabSwitchCount") ?? 0
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid attempt submission.");
  }

  const attempt = await prisma.attempt.findFirst({
    where: {
      id: parsed.data.attemptId,
      studentId: student.id
    },
    include: {
      assignmentRecipient: {
        include: {
          assignment: {
            include: {
              units: {
                orderBy: { order: "asc" },
                include: {
                  assignableUnit: {
                    include: {
                      questions: {
                        orderBy: { order: "asc" }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  });

  if (!attempt) {
    throw new Error("Attempt not found for this student.");
  }

  if (attempt.status === "submitted") {
    redirect(`/student/results/${attempt.id}`);
  }

  const gradedAnswers = attempt.assignmentRecipient.assignment.units.flatMap((assignmentUnit) =>
    assignmentUnit.assignableUnit.questions.map((question) => {
      const value = String(formData.get(`q_${question.id}`) ?? "").trim();
      const correctAnswers = parseCorrectAnswers(question.correctAnswerJson);
      const grade = gradeAnswer(value, correctAnswers, question.points);

      return {
        answerRow: {
          attemptId: attempt.id,
          studentId: student.id,
          questionId: question.id,
          assignableUnitId: assignmentUnit.assignableUnitId,
          value,
          isCorrect: grade.isCorrect,
          pointsAwarded: grade.pointsAwarded,
          correctAnswerSnapshot: answerSnapshot(question.correctAnswerJson),
          explanationSnapshot: question.explanation
        },
        gradeItem: {
          value,
          correctAnswers,
          points: question.points
        }
      };
    })
  );
  const answerRows = gradedAnswers.map((answer) => answer.answerRow);

  const attemptGrade = gradeAttempt(gradedAnswers.map((answer) => answer.gradeItem));

  const submittedAt = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.answer.deleteMany({
      where: { attemptId: attempt.id }
    });

    if (answerRows.length > 0) {
      await tx.answer.createMany({
        data: answerRows
      });
    }

    await tx.attempt.update({
      where: { id: attempt.id },
      data: {
        status: "submitted",
        submittedAt,
        submitReason: parsed.data.submitReason,
        elapsedSeconds: parsed.data.elapsedSeconds,
        tabSwitchCount: parsed.data.tabSwitchCount,
        score: attemptGrade.score,
        scorePercent: attemptGrade.scorePercent,
        autoGradedAt: submittedAt
      }
    });

    await tx.assignmentRecipient.update({
      where: { id: attempt.assignmentRecipientId },
      data: {
        status: "submitted",
        submittedAt
      }
    });
  });

  revalidatePath("/student");
  revalidatePath("/student/history");
  revalidatePath(`/student/assignments/${attempt.assignmentRecipientId}`);
  redirect(`/student/results/${attempt.id}`);
}
