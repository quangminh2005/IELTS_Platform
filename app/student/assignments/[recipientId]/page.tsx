import { notFound, redirect } from "next/navigation";
import { AttemptWorkspace } from "@/components/attempt-workspace";
import { startAttempt } from "@/lib/actions/attempts";
import { auth } from "@/lib/auth";
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
          }
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

  return (
    <AttemptWorkspace
      recipientId={recipient.id}
      attempt={activeAttempt}
      assignment={recipient.assignment}
      highlights={activeAttempt.highlights}
      savedAnswers={savedAnswers}
    />
  );
}
