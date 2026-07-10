import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ResultReview } from "@/components/result-review";
import { SkillTimeSummary } from "@/components/skill-time-summary";
import { SubmitCelebration } from "@/components/submit-celebration";
import { auth } from "@/lib/auth";
import { pickDominantSkill } from "@/lib/celebration";
import { prisma } from "@/lib/prisma";
import { SKILL_TIME_LABELS, skillTimesFromParts } from "@/lib/skill-times";

type ResultPageProps = {
  params: {
    attemptId: string;
  };
  searchParams: {
    skill?: string;
  };
};

export default async function StudentResultPage({ params, searchParams }: ResultPageProps) {
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
              skill: true,
              transcript: true
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
      },
      skills: {
        select: {
          skill: true,
          score: true,
          scorePercent: true
        }
      }
    }
  });

  if (!attempt) {
    notFound();
  }

  // Xem theo kỹ năng (?skill=): dùng khi học sinh vừa nộp một kỹ năng và muốn xem
  // kết quả ngay, không phải chờ nộp hết bài. Không có param -> giữ trang gộp như cũ.
  const skillFilter = searchParams.skill;
  const skillLabel = skillFilter ? SKILL_TIME_LABELS[skillFilter] ?? skillFilter : null;
  const skillResult = skillFilter
    ? attempt.skills.find((row) => row.skill === skillFilter) ?? null
    : null;

  // Các câu đã chấm tự động (Nghe/Đọc) có isCorrect khác null; Viết/Nói = null.
  const autoSkills = attempt.answers
    .filter((answer) => answer.isCorrect !== null)
    .map((answer) => answer.assignableUnit.skill);
  const isManualOnly = autoSkills.length === 0;
  const dominantSkill = pickDominantSkill(autoSkills);

  // Gộp thời gian làm bài theo kỹ năng từ partTimesJson (tra kỹ năng của từng phần).
  const unitSkills: Record<string, string> = {};
  attempt.answers.forEach((answer) => {
    unitSkills[answer.assignableUnitId] = answer.assignableUnit.skill;
  });
  const skillTimes = skillTimesFromParts(attempt.partTimesJson, unitSkills);

  // Lọc đáp án theo kỹ năng khi xem tức thời (?skill=). Không có param -> giữ nguyên.
  const answers = skillFilter
    ? attempt.answers.filter((answer) => answer.assignableUnit?.skill === skillFilter)
    : attempt.answers;

  // Khi xem theo kỹ năng, điểm/% hiển thị lấy từ AttemptSkill của đúng kỹ năng đó
  // (thay vì điểm gộp cả bài).
  const reviewAttempt = skillFilter
    ? {
        ...attempt,
        answers,
        score: skillResult?.score ?? null,
        scorePercent: skillResult?.scorePercent ?? null
      }
    : attempt;

  return (
    <div className="space-y-8">
      {!skillFilter ? (
        <SubmitCelebration
          scorePercent={attempt.scorePercent}
          isManualOnly={isManualOnly}
          dominantSkill={dominantSkill}
        />
      ) : null}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-primary">
            {skillFilter ? `Kết quả kỹ năng ${skillLabel}` : "Kết quả"}
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            {attempt.assignmentRecipient.assignment.title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Xem lại đáp án của bạn, điểm số, lời giải thích và các đoạn đã tô.
          </p>
          <SkillTimeSummary skillTimes={skillTimes} className="mt-2 text-sm text-muted-foreground" />
        </div>
        <div className="flex w-fit flex-col items-end gap-2">
          {skillFilter ? (
            <Link
              href={`/student/assignments/${attempt.assignmentRecipientId}`}
              className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-primary transition hover:border-primary"
            >
              ‹ Về chọn kỹ năng
            </Link>
          ) : null}
          <Link
            href="/student/history"
            className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-primary transition hover:border-primary"
          >
            ← Về lịch sử
          </Link>
        </div>
      </header>

      <ResultReview attempt={reviewAttempt} skillTimes={skillTimes} />
    </div>
  );
}
