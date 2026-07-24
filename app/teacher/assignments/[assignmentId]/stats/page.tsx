import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTeacher } from "@/lib/actions/classes";
import { prisma } from "@/lib/prisma";
import { SKILL_SHORT_LABELS } from "@/lib/band-score";
import {
  assignmentQuestionStats,
  type QuestionMissStat
} from "@/lib/question-stats";

type StatsPageProps = {
  params: {
    assignmentId: string;
  };
};

// Rút gọn câu hỏi để hiện trong bảng (prompt có thể rất dài).
function shorten(text: string, max = 80) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

function wrongValuesLabel(question: QuestionMissStat) {
  if (question.wrongValues.length === 0) {
    return "—";
  }

  return question.wrongValues
    .map((row) => (row.value ? `"${row.value}" ×${row.count}` : `bỏ trống ×${row.count}`))
    .join(" · ");
}

export default async function AssignmentStatsPage({ params }: StatsPageProps) {
  const teacher = await requireTeacher();

  const assignment = await prisma.assignment.findFirst({
    where: { id: params.assignmentId, teacherId: teacher.id },
    include: {
      units: {
        orderBy: { order: "asc" },
        include: {
          assignableUnit: {
            select: {
              id: true,
              title: true,
              skill: true,
              questions: {
                orderBy: { order: "asc" },
                select: {
                  id: true,
                  order: true,
                  prompt: true,
                  correctAnswerJson: true
                }
              }
            }
          }
        }
      },
      recipients: {
        include: {
          attempts: {
            where: { status: { in: ["submitted", "reviewed"] } },
            select: {
              answers: {
                select: {
                  questionId: true,
                  isCorrect: true,
                  value: true,
                  correctAnswerSnapshot: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (!assignment) {
    notFound();
  }

  const submittedAttempts = assignment.recipients.flatMap(
    (recipient) => recipient.attempts
  );
  const submittedCount = submittedAttempts.length;

  const stats = assignmentQuestionStats(
    assignment.units.map((unit) => ({
      id: unit.assignableUnit.id,
      title: unit.assignableUnit.title,
      skill: unit.assignableUnit.skill,
      questions: unit.assignableUnit.questions
    })),
    submittedAttempts.flatMap((attempt) => attempt.answers),
    submittedCount
  );

  // Nhãn phần cho danh sách "Top câu sai": số câu tính theo từng phần nên có thể
  // trùng "Câu 1" ở hai phần khác nhau — kèm nhãn Nghe/Đọc · tên phần cho rõ.
  const unitOfQuestion = new Map<string, { skill: string; title: string }>();
  for (const unit of stats.units) {
    for (const question of unit.questions) {
      unitOfQuestion.set(question.questionId, { skill: unit.skill, title: unit.unitTitle });
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <Link
          href="/teacher/assignments"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary transition hover:underline"
        >
          ← Về danh sách bài giao
        </Link>
        <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
          Thống kê: {assignment.title}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {submittedCount}/{assignment.recipients.length} học sinh đã nộp. Số liệu chỉ
          tính các bài đã nộp.
        </p>
      </header>

      {submittedCount === 0 ? (
        <section className="rounded-xl border border-border bg-card px-5 py-12 text-center shadow-card">
          <p className="text-sm font-medium">Chưa có học sinh nào nộp bài</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Khi có bài nộp, thống kê câu sai sẽ hiển thị ở đây.
          </p>
        </section>
      ) : (
        <>
          {stats.top.length > 0 ? (
            <section className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
              <div className="border-b border-border px-5 py-4">
                <h3 className="text-base font-semibold">Top câu sai nhiều nhất</h3>
              </div>
              <div className="divide-y divide-border">
                {stats.top.map((question) => {
                  const unit = unitOfQuestion.get(question.questionId);
                  return (
                    <div
                      key={question.questionId}
                      className="flex items-center justify-between gap-4 px-5 py-3"
                    >
                      <div className="min-w-0">
                        {unit ? (
                          <p className="text-xs font-medium text-muted-foreground">
                            {SKILL_SHORT_LABELS[unit.skill] ?? unit.skill} · {unit.title}
                          </p>
                        ) : null}
                        <p className="text-sm">
                          <span className="font-semibold">Câu {question.order}.</span>{" "}
                          {shorten(question.prompt)}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full border border-red-400/50 bg-red-500/10 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-red-600 dark:text-red-300">
                        {question.wrongCount}/{question.totalCount} sai · {question.percentWrong}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          {stats.units.map((unit) => (
            <section
              key={unit.unitId}
              className="overflow-hidden rounded-xl border border-border bg-card shadow-card"
            >
              <div className="border-b border-border px-5 py-4">
                <h3 className="text-base font-semibold">
                  {SKILL_SHORT_LABELS[unit.skill] ?? unit.skill} · {unit.unitTitle}
                </h3>
              </div>
              {unit.manual ? (
                <p className="px-5 py-6 text-sm text-muted-foreground">
                  Phần chấm tay — không có thống kê đúng/sai theo câu.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-5 py-3 font-semibold">Câu hỏi</th>
                        <th className="px-3 py-3 font-semibold">Đáp án đúng</th>
                        <th className="px-3 py-3 font-semibold">Sai</th>
                        <th className="px-5 py-3 font-semibold">Đáp án sai phổ biến</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {unit.questions.map((question) => (
                        <tr
                          key={question.questionId}
                          className={
                            question.percentWrong >= 50 ? "bg-red-500/10" : undefined
                          }
                        >
                          <td className="px-5 py-3">
                            <span className="font-semibold">Câu {question.order}.</span>{" "}
                            {shorten(question.prompt)}
                          </td>
                          <td className="px-3 py-3 font-medium">
                            {question.correctAnswer ?? "—"}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 tabular-nums">
                            {question.wrongCount}/{question.totalCount} · {question.percentWrong}%
                          </td>
                          <td className="px-5 py-3 text-muted-foreground">
                            {wrongValuesLabel(question)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ))}
        </>
      )}
    </div>
  );
}
