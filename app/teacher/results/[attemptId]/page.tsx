import Link from "next/link";
import { notFound } from "next/navigation";
import { ResultReview } from "@/components/result-review";
import { SkillTimeSummary } from "@/components/skill-time-summary";
import { requireTeacher } from "@/lib/actions/classes";
import { formatDuration } from "@/lib/format-duration";
import { prisma } from "@/lib/prisma";
import { skillTimesFromParts } from "@/lib/skill-times";

type ResultPageProps = {
  params: {
    attemptId: string;
  };
};

export default async function TeacherResultPage({ params }: ResultPageProps) {
  const teacher = await requireTeacher();

  const attempt = await prisma.attempt.findFirst({
    where: {
      id: params.attemptId,
      status: { in: ["submitted", "reviewed"] },
      assignmentRecipient: {
        assignment: { teacherId: teacher.id }
      }
    },
    include: {
      student: {
        select: { displayName: true, email: true }
      },
      assignmentRecipient: {
        include: {
          assignment: { select: { title: true } }
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
            select: { order: true, prompt: true, points: true }
          },
          assignableUnit: {
            select: { title: true, skill: true, transcript: true }
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

  // Gộp thời gian làm bài theo kỹ năng từ partTimesJson (tra kỹ năng của từng phần).
  const unitSkills: Record<string, string> = {};
  attempt.answers.forEach((answer) => {
    unitSkills[answer.assignableUnitId] = answer.assignableUnit.skill;
  });
  const skillTimes = skillTimesFromParts(attempt.partTimesJson, unitSkills);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-primary">Kết quả học viên</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            {attempt.assignmentRecipient.assignment.title}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {attempt.student.displayName} ({attempt.student.email}) · ⏱ Thời gian làm:{" "}
            {formatDuration(attempt.elapsedSeconds)}
          </p>
          <SkillTimeSummary skillTimes={skillTimes} className="mt-1 text-sm text-muted-foreground" />
        </div>
        <Link
          href="/teacher/calendar"
          className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-primary transition hover:border-primary"
        >
          ← Về Lịch giao bài
        </Link>
      </header>

      <ResultReview attempt={attempt} skillTimes={skillTimes} />
    </div>
  );
}
