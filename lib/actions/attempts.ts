"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireTeacher } from "@/lib/actions/classes";
import { auth } from "@/lib/auth";
import { gradeAttempt } from "@/lib/grading";
import { gradeUnits } from "@/lib/attempt-grading";
import { sanitizePartTimesJson } from "@/lib/skill-times";
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
  // Thời gian theo phần (JSON). Là dữ liệu phụ nên không bắt buộc/không chặn nộp.
  partTimesJson: z.string().optional()
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

  // Mỗi bài chỉ làm MỘT lần: nếu đã có lần làm nào (đang làm hoặc đã nộp) thì
  // trả về lần đó — KHÔNG tạo lần làm mới. Lần đang làm thì tiếp tục; lần đã nộp
  // thì trang sẽ tự chuyển sang xem kết quả (không cho làm lại).
  const latestAttempt = await prisma.attempt.findFirst({
    where: {
      assignmentRecipientId: recipient.id,
      studentId: student.id
    },
    orderBy: { startedAt: "desc" }
  });

  if (latestAttempt) {
    if (latestAttempt.status === "in_progress" && recipient.status !== "in_progress") {
      await prisma.assignmentRecipient.update({
        where: { id: recipient.id },
        data: { status: "in_progress" }
      });
    }

    return latestAttempt;
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

export async function saveAttemptDraft(formData: FormData) {
  const student = await requireStudent();
  const attemptId = String(formData.get("attemptId") ?? "").trim();

  if (!attemptId) {
    throw new Error("Attempt id is required.");
  }

  const attempt = await prisma.attempt.findFirst({
    where: {
      id: attemptId,
      studentId: student.id,
      status: "in_progress"
    },
    include: {
      assignmentRecipient: {
        include: {
          assignment: {
            include: {
              units: {
                include: {
                  assignableUnit: {
                    include: {
                      questions: {
                        select: { id: true }
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

  const draftRows = attempt.assignmentRecipient.assignment.units
    .flatMap((assignmentUnit) =>
      assignmentUnit.assignableUnit.questions.map((question) => ({
        attemptId: attempt.id,
        studentId: student.id,
        questionId: question.id,
        assignableUnitId: assignmentUnit.assignableUnitId,
        value: String(formData.get(`q_${question.id}`) ?? "").trim()
      }))
    )
    .filter((row) => row.value !== "");

  // Lưu kèm thời gian theo phần (nếu client gửi) để đóng/mở lại bài không bị mất.
  // Chỉ cập nhật khi form thực sự có trường này — tránh ghi đè null mất dữ liệu cũ.
  const rawPartTimes = formData.get("partTimesJson");
  const partTimesUpdate =
    rawPartTimes !== null
      ? [
          prisma.attempt.update({
            where: { id: attempt.id },
            data: { partTimesJson: sanitizePartTimesJson(String(rawPartTimes)) }
          })
        ]
      : [];

  await prisma.$transaction([
    prisma.answer.deleteMany({
      where: { attemptId: attempt.id }
    }),
    ...(draftRows.length > 0
      ? [prisma.answer.createMany({ data: draftRows })]
      : []),
    ...partTimesUpdate
  ]);
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

  const created = await prisma.highlight.create({
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
    },
    select: { id: true }
  });

  // Không revalidate ở đây: phòng làm bài quản lý highlight phía client để tô
  // màu ngay lập tức, tránh refresh server giữa lúc đang làm bài.
  return { id: created.id };
}

export async function deleteHighlight(formData: FormData) {
  const student = await requireStudent();
  const highlightId = String(formData.get("highlightId") ?? "").trim();

  if (!highlightId) {
    throw new Error("Missing highlight id.");
  }

  await prisma.highlight.deleteMany({
    where: {
      id: highlightId,
      studentId: student.id,
      attempt: { status: "in_progress" }
    }
  });
}

export async function submitAttempt(formData: FormData) {
  const student = await requireStudent();
  const parsed = submitSchema.safeParse({
    attemptId: formData.get("attemptId"),
    submitReason: formData.get("submitReason") ?? "manual",
    elapsedSeconds: formData.get("elapsedSeconds") ?? 0,
    partTimesJson: formData.get("partTimesJson") ?? undefined
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid attempt submission.");
  }

  // LÁ CHẮN: từ chối mọi yêu cầu tự động nộp khi hết giờ. Tính năng auto-nộp đã
  // bị gỡ ở client, nhưng các tab cũ còn cache code cũ vẫn có thể gửi
  // submitReason="auto_timeout" khi đồng hồ về 0. Bỏ qua chúng — bài chỉ được nộp
  // khi học sinh tự bấm "Nộp bài" (submitReason="manual").
  if (parsed.data.submitReason === "auto_timeout") {
    return;
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

  const graded = gradeUnits(
    attempt.assignmentRecipient.assignment.units.map((assignmentUnit) => ({
      assignableUnitId: assignmentUnit.assignableUnitId,
      skill: assignmentUnit.assignableUnit.skill,
      questions: assignmentUnit.assignableUnit.questions
    })),
    (questionId) => String(formData.get(`q_${questionId}`) ?? "")
  );
  const answerRows = graded.answerRows.map((row) => ({
    ...row,
    attemptId: attempt.id,
    studentId: student.id
  }));

  const attemptGrade = gradeAttempt(graded.gradeItems);

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
        partTimesJson: sanitizePartTimesJson(parsed.data.partTimesJson),
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
  redirect(`/student/results/${attempt.id}?submitted=1`);
}

// Giáo viên cho học sinh làm lại một bài: xoá các lần làm của bài đó (kèm đáp án,
// highlight... theo cascade) và đặt lại trạng thái "chưa làm". Sau đó học sinh mở
// bài sẽ bắt đầu một lần làm mới.
export async function resetRecipientAttempts(formData: FormData) {
  const teacher = await requireTeacher();
  const recipientId = String(formData.get("recipientId") ?? "").trim();

  if (!recipientId) {
    throw new Error("Missing recipient id.");
  }

  // Chỉ cho phép thao tác trên bài thuộc lớp/bài tập của chính giáo viên này.
  const recipient = await prisma.assignmentRecipient.findFirst({
    where: {
      id: recipientId,
      assignment: { teacherId: teacher.id }
    },
    select: { id: true, studentId: true }
  });

  if (!recipient) {
    throw new Error("Assignment not found for this teacher.");
  }

  await prisma.$transaction([
    prisma.attempt.deleteMany({ where: { assignmentRecipientId: recipient.id } }),
    prisma.assignmentRecipient.update({
      where: { id: recipient.id },
      data: { status: "assigned", submittedAt: null }
    })
  ]);

  revalidatePath("/student");
  revalidatePath(`/teacher/students/${recipient.studentId}`);
}
