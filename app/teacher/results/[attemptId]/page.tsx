import Link from "next/link";
import { requireTeacherPage } from "@/lib/teacher-page";
import { notFound } from "next/navigation";
import { ResultReview } from "@/components/result-review";
import { SkillTimeSummary } from "@/components/skill-time-summary";
import { formatDuration } from "@/lib/format-duration";
import { proctorSummary } from "@/lib/proctor-signals";
import { prisma } from "@/lib/prisma";
import { skillTimesFromParts } from "@/lib/skill-times";

type ResultPageProps = {
  params: {
    attemptId: string;
  };
};

export default async function TeacherResultPage({ params }: ResultPageProps) {
  const teacher = await requireTeacherPage();

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
            select: { order: true, prompt: true, points: true, answerEvidence: true }
          },
          assignableUnit: {
            select: { title: true, skill: true, transcript: true, content: true }
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
    // Trang kết quả chạy toàn màn hình (giống chin.edu.vn) — AppShell đã bỏ sidebar
    // + khung max-w cho route /results/, ở đây chỉ cần dùng hết chiều ngang.
    <div className="flex min-h-screen flex-col bg-background">
      {/* Thanh trên cùng dính, gọn — tiêu đề + học viên + nút quay lại */}
      <header className="sticky top-0 z-10 border-b border-border bg-card/85 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              Kết quả học viên
            </p>
            <h2 className="mt-0.5 truncate text-lg font-bold tracking-tight sm:text-xl">
              {attempt.assignmentRecipient.assignment.title}
            </h2>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {attempt.student.displayName} ({attempt.student.email}) · ⏱ Thời gian làm:{" "}
              {formatDuration(attempt.elapsedSeconds)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{proctorSummary(attempt)}</p>
            <SkillTimeSummary
              skillTimes={skillTimes}
              className="mt-1 text-xs text-muted-foreground"
            />
          </div>
          <Link
            href="/teacher/calendar"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-primary transition hover:border-primary"
          >
            ← Về Lịch giao bài
          </Link>
        </div>
      </header>

      {/* Nội dung dùng hết chiều ngang màn hình */}
      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <ResultReview
          attempt={attempt}
          skillTimes={skillTimes}
          sourceStickyTopClass="lg:top-[104px]"
        />
      </main>
    </div>
  );
}
