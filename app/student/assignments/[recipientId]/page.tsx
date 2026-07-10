import { notFound, redirect } from "next/navigation";
import { AttemptWorkspace } from "@/components/attempt-workspace";
import { ensureAttemptSkills, startAttempt } from "@/lib/actions/attempts";
import { auth } from "@/lib/auth";
import { detectMultiSelectGroups } from "@/lib/multi-select";
import { parseQuestionOptions } from "@/lib/question-interactions";
import { prisma } from "@/lib/prisma";

type AssignmentAttemptPageProps = {
  params: {
    recipientId: string;
  };
};

export default async function AssignmentAttemptPage({ params }: AssignmentAttemptPageProps) {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "student") {
    redirect("/login");
  }

  const student = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true }
  });

  if (!student) {
    redirect("/waiting");
  }

  const existingRecipient = await prisma.assignmentRecipient.findFirst({
    where: {
      id: params.recipientId,
      studentId: student.id
    },
    select: { id: true }
  });

  if (!existingRecipient) {
    notFound();
  }

  const attempt = await startAttempt(params.recipientId);
  // Đảm bảo có đủ hàng AttemptSkill (một hàng mỗi kỹ năng) trước khi nạp để dựng
  // màn chọn kỹ năng + đồng hồ theo kỹ năng.
  await ensureAttemptSkills(attempt.id);
  const recipient = await prisma.assignmentRecipient.findFirst({
    where: {
      id: params.recipientId,
      studentId: student.id
    },
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
      },
      attempts: {
        where: { id: attempt.id },
        include: {
          highlights: {
            orderBy: { createdAt: "desc" }
          },
          skills: true
        }
      }
    }
  });

  if (!recipient || !recipient.attempts[0]) {
    notFound();
  }

  const activeAttempt = recipient.attempts[0];

  if (activeAttempt.status === "submitted") {
    redirect(`/student/results/${activeAttempt.id}`);
  }

  const savedAnswerRows = await prisma.answer.findMany({
    where: { attemptId: activeAttempt.id },
    select: { questionId: true, value: true }
  });

  const savedAnswers: Record<string, string> = {};
  savedAnswerRows.forEach((row) => {
    if (row.questionId) {
      savedAnswers[row.questionId] = row.value;
    }
  });

  // Nhận diện các nhóm "Choose N" để client gộp thành một khối tick nhiều ô.
  // Tính ở server (chỉ truyền id + số lượng, không lộ đáp án cho client).
  const multiSelectGroups = recipient.assignment.units.flatMap((unit) =>
    detectMultiSelectGroups(
      unit.assignableUnit.questions.map((question) => ({
        id: question.id,
        questionType: question.questionType,
        options: parseQuestionOptions(question.optionsJson),
        correctAnswers: parseQuestionOptions(question.correctAnswerJson)
      }))
    )
  );

  return (
    <AttemptWorkspace
      recipientId={recipient.id}
      attempt={activeAttempt}
      assignment={recipient.assignment}
      highlights={activeAttempt.highlights}
      savedAnswers={savedAnswers}
      multiSelectGroups={multiSelectGroups}
      attemptSkills={activeAttempt.skills}
    />
  );
}
