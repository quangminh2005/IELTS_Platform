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
              points: true,
              answerEvidence: true
            }
          },
          assignableUnit: {
            select: {
              title: true,
              skill: true,
              transcript: true,
              content: true,
              // Dùng cho thanh nghe lại ở trang kết quả (Listening).
              audioUrl: true,
              // Bấm câu trong transcript -> tua audio tới đoạn đó.
              transcriptTimingJson: true
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
    // Trang kết quả chạy toàn màn hình (giống chin.edu.vn) — AppShell đã bỏ sidebar
    // + khung max-w cho route /results/, ở đây chỉ cần dùng hết chiều ngang.
    <div className="flex min-h-screen flex-col bg-background">
      {!skillFilter ? (
        <SubmitCelebration
          scorePercent={attempt.scorePercent}
          isManualOnly={isManualOnly}
          dominantSkill={dominantSkill}
        />
      ) : null}

      {/* Thanh trên cùng dính, gọn — tiêu đề + thời gian + nút quay lại */}
      <header className="sticky top-0 z-10 border-b border-border bg-card/85 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              {skillFilter ? `Kết quả kỹ năng ${skillLabel}` : "Kết quả"}
            </p>
            <h2 className="mt-0.5 truncate text-lg font-bold tracking-tight sm:text-xl">
              {attempt.assignmentRecipient.assignment.title}
            </h2>
            <SkillTimeSummary
              skillTimes={skillTimes}
              className="mt-1 text-xs text-muted-foreground"
            />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {skillFilter ? (
              <Link
                href={`/student/assignments/${attempt.assignmentRecipientId}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-primary transition hover:border-primary"
              >
                ‹ Về chọn kỹ năng
              </Link>
            ) : null}
            <Link
              href="/student/history"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-primary transition hover:border-primary"
            >
              ← Về lịch sử
            </Link>
          </div>
        </div>
      </header>

      {/* Nội dung dùng hết chiều ngang màn hình */}
      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <ResultReview
          attempt={reviewAttempt}
          skillTimes={skillTimes}
          sourceStickyTopClass="lg:top-[88px]"
        />
      </main>
    </div>
  );
}
