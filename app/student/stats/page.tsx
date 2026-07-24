import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProgressLineChart } from "@/components/progress-line-chart";
import { QuestionTypeStats } from "@/components/question-type-stats";
import {
  buildProgressSeries,
  questionTypeStatsBySkill
} from "@/lib/question-stats";

export default async function StudentStatsPage() {
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

  const attempts = await prisma.attempt.findMany({
    where: { studentId: student.id, status: { in: ["submitted", "reviewed"] } },
    select: {
      submittedAt: true,
      startedAt: true,
      assignmentRecipient: {
        select: { assignment: { select: { title: true } } }
      },
      answers: {
        select: {
          isCorrect: true,
          assignableUnit: { select: { skill: true } },
          question: { select: { questionType: true } }
        }
      }
    }
  });

  const header = (
    <header>
      <p className="text-sm font-semibold text-primary">Nhìn lại chặng đường</p>
      <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Tiến bộ</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
        Điểm các bài đã nộp theo thời gian và dạng câu bạn làm tốt / cần luyện thêm.
      </p>
    </header>
  );

  if (attempts.length === 0) {
    return (
      <div className="space-y-8">
        {header}
        <section className="rounded-xl border border-border bg-card px-5 py-12 text-center shadow-card">
          <p className="text-sm font-medium">Chưa có dữ liệu tiến bộ</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Nộp bài đầu tiên để xem tiến bộ của bạn.
          </p>
          <Link
            href="/student"
            className="mt-4 inline-flex rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-primary transition hover:border-primary"
          >
            Về trang Tổng quan
          </Link>
        </section>
      </div>
    );
  }

  const series = buildProgressSeries(
    attempts.map((attempt) => ({
      title: attempt.assignmentRecipient.assignment.title,
      // submittedAt luôn có với bài đã nộp; startedAt chỉ là lưới an toàn.
      submittedAt: attempt.submittedAt ?? attempt.startedAt,
      answers: attempt.answers.map((answer) => ({
        isCorrect: answer.isCorrect,
        skill: answer.assignableUnit.skill
      }))
    }))
  );

  const stats = questionTypeStatsBySkill(
    attempts.flatMap((attempt) =>
      attempt.answers.map((answer) => ({
        isCorrect: answer.isCorrect,
        skill: answer.assignableUnit.skill,
        questionType: answer.question?.questionType ?? null
      }))
    )
  );

  return (
    <div className="space-y-8">
      {header}

      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-base font-semibold">% đúng theo thời gian</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Chạm vào một điểm để xem chi tiết bài. Bài đủ 40 câu sẽ hiện kèm band.
          </p>
        </div>
        <ProgressLineChart listening={series.listening} reading={series.reading} />
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-base font-semibold">Tỷ lệ đúng theo dạng câu</h3>
        </div>
        <QuestionTypeStats stats={stats} />
      </section>
    </div>
  );
}
