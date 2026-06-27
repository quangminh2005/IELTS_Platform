import Link from "next/link";
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
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-primary">Phòng làm bài</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            {recipient.assignment.title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Làm lần lượt các phần, tô đánh dấu đoạn quan trọng và nộp bài khi bạn đã sẵn sàng.
          </p>
        </div>
        <Link
          href="/student"
          className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-primary transition hover:border-primary"
        >
          ← Về trang chủ
        </Link>
      </header>

      <AttemptWorkspace
        recipientId={recipient.id}
        attempt={activeAttempt}
        assignment={recipient.assignment}
        highlights={activeAttempt.highlights}
        savedAnswers={savedAnswers}
      />
    </div>
  );
}
