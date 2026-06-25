import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ResultReview } from "@/components/result-review";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type ResultPageProps = {
  params: {
    attemptId: string;
  };
};

export default async function StudentResultPage({ params }: ResultPageProps) {
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

  const attempt = await prisma.attempt.findFirst({
    where: {
      id: params.attemptId,
      studentId: student.id
    },
    include: {
      assignmentRecipient: {
        include: {
          assignment: {
            select: {
              title: true
            }
          }
        }
      },
      answers: {
        orderBy: { createdAt: "asc" },
        include: {
          question: {
            select: {
              order: true,
              prompt: true,
              points: true
            }
          },
          assignableUnit: {
            select: {
              title: true
            }
          }
        }
      },
      highlights: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          selectedText: true,
          color: true,
          note: true,
          sourceType: true
        }
      }
    }
  });

  if (!attempt) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-primary">Result</p>
          <h2 className="mt-2 text-3xl font-semibold">
            {attempt.assignmentRecipient.assignment.title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Review your answers, scoring snapshot, explanations, and saved highlights.
          </p>
        </div>
        <Link href="/student/history" className="text-sm font-medium text-primary">
          Back to history
        </Link>
      </header>

      <ResultReview attempt={attempt} />
    </div>
  );
}
