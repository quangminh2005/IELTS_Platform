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

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-primary">
            Student workspace
          </p>
          <h1 className="mt-2 text-3xl font-semibold">{recipient.assignment.title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Work through the assigned units, save highlights, and submit when you are ready.
          </p>
        </div>
        <Link href="/student" className="text-sm font-medium text-primary">
          Back to dashboard
        </Link>
      </header>

      <AttemptWorkspace
        recipientId={recipient.id}
        attempt={activeAttempt}
        assignment={recipient.assignment}
        highlights={activeAttempt.highlights}
      />
    </div>
  );
}
