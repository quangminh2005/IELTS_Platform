import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteStudent, requireTeacher } from "@/lib/actions/classes";
import { resetRecipientAttempts } from "@/lib/actions/attempts";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { bandsBySkill, formatBand, SKILL_SHORT_LABELS } from "@/lib/band-score";
import { prisma } from "@/lib/prisma";

type StudentPageProps = {
  params: {
    studentId: string;
  };
};

function formatDate(value: Date | null) {
  if (!value) {
    return "Chưa nộp";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(value);
}

const STATUS_LABELS: Record<string, string> = {
  reviewed: "Đã chấm",
  submitted: "Đã nộp",
  in_progress: "Đang làm",
  not_started: "Chưa làm",
  assigned: "Chưa làm"
};

function statusLabel(status: string) {
  return STATUS_LABELS[status] ?? status.replaceAll("_", " ");
}

export default async function TeacherStudentPage({ params }: StudentPageProps) {
  const teacher = await requireTeacher();
  const student = await prisma.studentProfile.findFirst({
    where: {
      id: params.studentId,
      classes: {
        some: {
          class: {
            teacherId: teacher.id
          }
        }
      }
    },
    include: {
      classes: {
        where: {
          class: {
            teacherId: teacher.id
          }
        },
        include: {
          class: true
        },
        orderBy: {
          joinedAt: "desc"
        }
      },
      recipients: {
        where: {
          assignment: {
            teacherId: teacher.id
          }
        },
        include: {
          assignment: true,
          attempts: {
            orderBy: {
              startedAt: "desc"
            },
            include: {
              answers: {
                select: {
                  isCorrect: true,
                  assignableUnit: {
                    select: { skill: true }
                  }
                }
              }
            }
          }
        },
        orderBy: {
          id: "desc"
        }
      }
    }
  });

  if (!student) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href="/teacher/classes"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary transition hover:underline"
          >
            ← Về danh sách lớp
          </Link>
          <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{student.displayName}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{student.email}</p>
        </div>
        <div className="flex flex-col items-stretch gap-3 sm:items-end">
          <div className="rounded-xl border border-border bg-card px-5 py-3 text-center shadow-card">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Số lớp</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-primary">{student.classes.length}</p>
          </div>
          <form action={deleteStudent}>
            <input type="hidden" name="studentId" value={student.id} />
            <ConfirmSubmitButton
              confirmMessage={`Xoá hẳn học sinh ${student.displayName}? Toàn bộ hồ sơ, bài làm, điểm và lịch sử sẽ bị xoá vĩnh viễn và KHÔNG thể khôi phục.`}
              className="w-full rounded-lg border border-red-400/60 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-500/20 dark:text-red-400 sm:w-auto"
            >
              Xoá hẳn học sinh
            </ConfirmSubmitButton>
          </form>
        </div>
      </header>

      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-base font-semibold">Lớp đang tham gia</h3>
        </div>
        <div className="divide-y divide-border">
          {student.classes.map((membership: (typeof student.classes)[number]) => (
            <div key={membership.id} className="px-5 py-4">
              <p className="font-semibold">{membership.class.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Tham gia ngày {formatDate(membership.joinedAt)}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-base font-semibold">Bài tập & lần làm bài</h3>
        </div>
        <div className="divide-y divide-border">
          {student.recipients.length > 0 ? (
            student.recipients.map((recipient: (typeof student.recipients)[number]) => (
              <article key={recipient.id} className="px-5 py-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold">{recipient.assignment.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Trạng thái: {statusLabel(recipient.status)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="inline-flex w-fit rounded-full border border-border bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
                      {recipient.attempts.length} lần làm
                    </span>
                    {recipient.attempts.length > 0 ? (
                      <form action={resetRecipientAttempts}>
                        <input type="hidden" name="recipientId" value={recipient.id} />
                        <ConfirmSubmitButton
                          confirmMessage={`Cho học sinh làm lại "${recipient.assignment.title}"? Các lần làm hiện tại (kèm đáp án) sẽ bị xoá để bắt đầu lại từ đầu.`}
                          className="inline-flex items-center rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-primary transition hover:border-primary"
                        >
                          Cho làm lại
                        </ConfirmSubmitButton>
                      </form>
                    ) : null}
                  </div>
                </div>
                {recipient.attempts.length > 0 ? (
                  <div className="mt-4 grid gap-3">
                    {recipient.attempts.map((attempt: (typeof recipient.attempts)[number]) => {
                      const bands = bandsBySkill(
                        attempt.answers.map((answer) => ({
                          isCorrect: answer.isCorrect,
                          skill: answer.assignableUnit.skill
                        }))
                      ).filter((row) => row.band !== null);

                      return (
                        <div key={attempt.id} className="rounded-lg border border-border bg-muted/60 p-3">
                          <p className="text-sm font-semibold">
                            {statusLabel(attempt.status)}
                            {typeof attempt.scorePercent === "number"
                              ? ` · ${attempt.scorePercent.toFixed(1)}%`
                              : ""}
                          </p>
                          {bands.length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {bands.map((row) => (
                                <span
                                  key={row.skill}
                                  className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary"
                                >
                                  {SKILL_SHORT_LABELS[row.skill] ?? row.skill}: Band {formatBand(row.band)}
                                  <span className="font-normal text-muted-foreground">
                                    ({row.correct}/{row.total})
                                  </span>
                                </span>
                              ))}
                            </div>
                          ) : null}
                          <p className="mt-1 text-sm text-muted-foreground">
                            Bắt đầu {formatDate(attempt.startedAt)} · {attempt.elapsedSeconds}s
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">Chưa có lần làm bài nào.</p>
                )}
              </article>
            ))
          ) : (
            <p className="px-5 py-8 text-sm text-muted-foreground">
              Học viên này chưa được giao bài nào.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
