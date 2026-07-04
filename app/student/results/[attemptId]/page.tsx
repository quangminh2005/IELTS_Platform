import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ResultReview } from "@/components/result-review";
import { SubmitCelebration } from "@/components/submit-celebration";
import { auth } from "@/lib/auth";
import { pickDominantSkill } from "@/lib/celebration";
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
      review: {
        select: {
          overallBand: true,
          criteriaScoresJson: true,
          summaryFeedback: true,
          detailedFeedback: true
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
              title: true,
              skill: true
            }
          },
          annotations: {
            orderBy: { startOffset: "asc" },
            select: {
              id: true,
              startOffset: true,
              endOffset: true,
              quote: true,
              note: true
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

  // Các câu đã chấm tự động (Nghe/Đọc) có isCorrect khác null; Viết/Nói = null.
  const autoSkills = attempt.answers
    .filter((answer) => answer.isCorrect !== null)
    .map((answer) => answer.assignableUnit.skill);
  const isManualOnly = autoSkills.length === 0;
  const dominantSkill = pickDominantSkill(autoSkills);

  return (
    <div className="space-y-8">
      <SubmitCelebration
        scorePercent={attempt.scorePercent}
        isManualOnly={isManualOnly}
        dominantSkill={dominantSkill}
      />
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-primary">Kết quả</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            {attempt.assignmentRecipient.assignment.title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Xem lại đáp án của bạn, điểm số, lời giải thích và các đoạn đã tô.
          </p>
        </div>
        <Link
          href="/student/history"
          className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-primary transition hover:border-primary"
        >
          ← Về lịch sử
        </Link>
      </header>

      <ResultReview attempt={attempt} />
    </div>
  );
}
