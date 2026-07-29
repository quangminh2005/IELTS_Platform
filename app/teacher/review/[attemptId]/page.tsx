import Link from "next/link";
import { requireTeacherPage } from "@/lib/teacher-page";
import { notFound } from "next/navigation";
import { AnnotatedAnswer } from "@/components/annotated-answer";
import { ReviewForm, type ReviewTaskInput } from "@/components/review-form";
import { TranscribeButton } from "@/components/transcribe-button";
import { isAudioUrl, parseWritingBrief } from "@/lib/question-interactions";
import { durationExceedsLimit, formatDuration } from "@/lib/format-duration";
import { formatBand } from "@/lib/band-score";
import { resolveWritingTaskNumber } from "@/lib/writing-review";
import { prisma } from "@/lib/prisma";

type DetailPageProps = {
  params: {
    attemptId: string;
  };
};

function countWords(text: string): number {
  const trimmed = text.trim();

  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function reviewSkill(skills: string[]): string {
  return skills.includes("speaking") ? "speaking" : "writing";
}

// Nhãn của một phần trong khung chấm. Đề Cambridge đã ghi sẵn "Task 1/2" trong
// tên phần thì không thêm tiền tố nữa cho khỏi lặp.
function reviewTaskLabel(title: string, taskNumber: number | null): string {
  if (taskNumber === null || /\btask\s*[12]\b/i.test(title)) {
    return title;
  }

  return `Task ${taskNumber} · ${title}`;
}

export default async function ReviewDetailPage({ params }: DetailPageProps) {
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
      review: {
        select: {
          overallBand: true,
          criteriaScoresJson: true,
          summaryFeedback: true,
          detailedFeedback: true,
          reviewedAt: true
        }
      },
      assignmentRecipient: {
        include: {
          assignment: {
            select: { id: true, title: true, timeLimitMinutes: true }
          }
        }
      },
      answers: {
        where: {
          assignableUnit: { skill: { in: ["writing", "speaking"] } }
        },
        orderBy: { createdAt: "asc" },
        include: {
          question: { select: { order: true, prompt: true } },
          assignableUnit: {
            select: {
              id: true,
              title: true,
              skill: true,
              unitNumber: true,
              metadataJson: true
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
      }
    }
  });

  if (!attempt) {
    notFound();
  }

  const assignmentId = attempt.assignmentRecipient.assignment.id;

  // Các bạn cùng bài tập (đã nộp) để điều hướng nhanh giữa các học sinh.
  const siblings = await prisma.attempt.findMany({
    where: {
      status: { in: ["submitted", "reviewed"] },
      assignmentRecipient: {
        assignmentId,
        assignment: { teacherId: teacher.id }
      }
    },
    orderBy: [{ submittedAt: "asc" }, { startedAt: "asc" }],
    select: {
      id: true,
      status: true,
      student: { select: { displayName: true } }
    }
  });

  const currentIndex = siblings.findIndex((sibling) => sibling.id === attempt.id);
  const prev = currentIndex > 0 ? siblings[currentIndex - 1] : null;
  const next = currentIndex < siblings.length - 1 ? siblings[currentIndex + 1] : null;
  const nextUngraded = siblings.find(
    (sibling) => sibling.status !== "reviewed" && sibling.id !== attempt.id
  );

  const skills = Array.from(
    new Set(attempt.answers.map((answer) => answer.assignableUnit.skill))
  );
  const skill = reviewSkill(skills);

  // Tách hai loại câu trong bài Viết/Nói:
  //   - isCorrect === null  → bài luận / ghi âm, phải chấm tay (xem lib/attempt-grading.ts)
  //   - isCorrect !== null  → câu điền chỗ trống trong bài Viết, ĐÃ tự chấm
  // Câu tự chấm chỉ cần liệt kê gọn thành bảng, không chiếm chỗ của bài luận.
  type ReviewAnswer = (typeof attempt.answers)[number];

  const unitOrder: string[] = [];
  const unitById = new Map<string, ReviewAnswer["assignableUnit"]>();
  const essayByUnit = new Map<string, ReviewAnswer[]>();
  const autoByUnit = new Map<string, ReviewAnswer[]>();

  for (const answer of attempt.answers) {
    const unit = answer.assignableUnit;

    if (!unitById.has(unit.id)) {
      unitById.set(unit.id, unit);
      unitOrder.push(unit.id);
    }

    const bucket = answer.isCorrect === null ? essayByUnit : autoByUnit;
    const list = bucket.get(unit.id) ?? [];
    list.push(answer);
    bucket.set(unit.id, list);
  }

  const essayUnits = unitOrder
    .filter((unitId) => (essayByUnit.get(unitId)?.length ?? 0) > 0)
    .map((unitId) => {
      const unit = unitById.get(unitId)!;

      return {
        unit,
        brief: parseWritingBrief(unit.metadataJson),
        taskNumber:
          unit.skill === "writing"
            ? resolveWritingTaskNumber(unit.title, unit.unitNumber)
            : null,
        answers: essayByUnit.get(unitId)!
      };
    })
    // Task 1 luôn đứng trước Task 2 để khớp với thứ tự tính band có trọng số.
    .sort(
      (a, b) =>
        (a.taskNumber ?? 99) - (b.taskNumber ?? 99) || a.unit.unitNumber - b.unit.unitNumber
    );

  const gapFillUnits = unitOrder
    .filter((unitId) => (autoByUnit.get(unitId)?.length ?? 0) > 0)
    .map((unitId) => {
      const answers = [...autoByUnit.get(unitId)!].sort(
        (a, b) => (a.question?.order ?? 0) - (b.question?.order ?? 0)
      );

      return {
        unit: unitById.get(unitId)!,
        answers,
        correctCount: answers.filter((answer) => answer.isCorrect === true).length
      };
    });

  // Speaking chấm MỘT bộ tiêu chí cho cả 3 part; Writing chấm riêng từng task.
  const reviewTasks: ReviewTaskInput[] =
    skill === "speaking" || essayUnits.length === 0
      ? [{ unitId: "", label: "", taskNumber: null }]
      : essayUnits.map((entry) => ({
          unitId: entry.unit.id,
          label: reviewTaskLabel(entry.unit.title, entry.taskNumber),
          taskNumber: entry.taskNumber
        }));

  // Vài band gần nhất CÙNG KỸ NĂNG của học viên này, để canh điểm cho đều tay —
  // chấm mà không nhớ lần trước cho mấy thì rất dễ lệch.
  const pastBands = await prisma.teacherReview.findMany({
    where: {
      studentId: attempt.studentId,
      teacherId: teacher.id,
      attemptId: { not: attempt.id },
      overallBand: { not: null },
      attempt: {
        answers: { some: { assignableUnit: { skill } } }
      }
    },
    orderBy: { reviewedAt: "desc" },
    take: 3,
    select: {
      overallBand: true,
      reviewedAt: true,
      attempt: {
        select: {
          assignmentRecipient: {
            select: { assignment: { select: { title: true } } }
          }
        }
      }
    }
  });

  // Comment Bank không được phép làm sập trang chấm: nếu bảng/cột chưa có trên DB
  // (vd production chưa chạy migration) thì coi như danh sách rỗng.
  let snippets: Array<{ id: string; text: string }> = [];
  try {
    snippets = await prisma.commentSnippet.findMany({
      where: { teacherId: teacher.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, text: true }
    });
  } catch (error) {
    console.error("commentSnippet query failed (bảng chưa tồn tại?):", error);
    snippets = [];
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <Link
          href="/teacher/review"
          className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-primary transition hover:border-primary"
        >
          ← Về hàng đợi
        </Link>

        {siblings.length > 1 ? (
          <div className="flex items-center gap-2 text-sm">
            {prev ? (
              <Link
                href={`/teacher/review/${prev.id}`}
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-2 font-medium transition hover:border-primary"
              >
                ← Bài trước
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-2 font-medium text-muted-foreground opacity-50">
                ← Bài trước
              </span>
            )}
            <span className="rounded-lg border border-border bg-muted/40 px-3 py-2 font-medium text-muted-foreground">
              Học sinh {currentIndex + 1} / {siblings.length}
            </span>
            {next ? (
              <Link
                href={`/teacher/review/${next.id}`}
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-2 font-medium transition hover:border-primary"
              >
                Bài tiếp →
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-2 font-medium text-muted-foreground opacity-50">
                Bài tiếp →
              </span>
            )}
          </div>
        ) : null}
      </div>

      <header className="rounded-xl border border-border bg-card px-5 py-4 shadow-card">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight">
              {attempt.assignmentRecipient.assignment.title}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {attempt.student.displayName} ({attempt.student.email})
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              ⏱ Thời gian làm bài: {formatDuration(attempt.elapsedSeconds)}
              {durationExceedsLimit(
                attempt.elapsedSeconds,
                attempt.assignmentRecipient.assignment.timeLimitMinutes
              ) ? (
                <span className="ml-1 italic opacity-70">(có thể đã tạm dừng)</span>
              ) : null}
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 lg:items-end">
            <span
              className={`h-fit rounded-full border px-3 py-1 text-xs font-medium ${
                attempt.status === "reviewed"
                  ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                  : "border-amber-400/50 bg-amber-500/10 text-amber-600 dark:text-amber-300"
              }`}
            >
              {attempt.status === "reviewed" ? "Đã chấm" : "Chưa chấm"}
            </span>

            {pastBands.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <span>Band {skill === "speaking" ? "Nói" : "Viết"} gần đây:</span>
                {pastBands.map((row, index) => (
                  <span
                    key={index}
                    title={`${row.attempt.assignmentRecipient.assignment.title} · ${row.reviewedAt.toLocaleDateString("vi-VN")}`}
                    className="rounded-md border border-border bg-muted/40 px-2 py-0.5 font-semibold tabular-nums text-foreground"
                  >
                    {formatBand(row.overallBand)}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-6 xl:flex-row">
        <div className="min-w-0 flex-1">
          {/* Bề ngang có trần: dòng chữ bài luận giữ khoảng 70 ký tự — rộng hơn
              nữa thì mắt khó bắt đầu dòng kế. Khung chấm chặn ở 400px cho vừa 2
              cột select. Nhờ vậy bài có 1 hay 10 học viên đều dàn giống nhau. */}
          <div className="grid max-w-[1040px] gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(340px,400px)]">
            <div className="min-w-0 space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Bài làm của học viên
              </h3>

              {essayUnits.length === 0 && gapFillUnits.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                  Không tìm thấy bài làm Writing/Speaking cho lần nộp này.
                </p>
              ) : null}

              {essayUnits.map((entry) =>
                entry.answers.map((answer) => {
                  const words = answer.value ? countWords(answer.value) : 0;
                  const minWords = entry.brief.minWords;
                  const tooShort = minWords !== null && words < minWords;

                  return (
                    <article
                      key={answer.id}
                      className="rounded-lg border border-border bg-muted/40 p-4"
                    >
                      <p className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
                        <span>
                          {reviewTaskLabel(entry.unit.title, entry.taskNumber)}
                          {answer.question ? ` · Câu ${answer.question.order}` : ""}
                        </span>
                        {entry.brief.taskTag ? (
                          <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[11px] uppercase tracking-wide">
                            {entry.brief.taskTag}
                          </span>
                        ) : null}
                      </p>
                      {answer.question ? (
                        <p className="mt-1 text-sm leading-7 text-muted-foreground">
                          {answer.question.prompt}
                        </p>
                      ) : null}
                      <div className="mt-3 rounded-md border border-border bg-background p-4">
                        {answer.value ? (
                          isAudioUrl(answer.value) ? (
                            <div className="space-y-2">
                              <p className="text-xs font-medium text-primary">Bài ghi âm của học viên</p>
                              <audio controls src={answer.value} className="w-full" preload="metadata">
                                <track kind="captions" />
                              </audio>
                              <a
                                href={answer.value}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                              >
                                Mở/tải file trong tab mới
                              </a>
                              <TranscribeButton
                                answerId={answer.id}
                                initialTranscript={answer.transcript}
                              />
                            </div>
                          ) : (
                            <>
                              <AnnotatedAnswer
                                text={answer.value}
                                annotations={answer.annotations}
                                editable
                                answerId={answer.id}
                                attemptId={attempt.id}
                              />
                              {/* Đối chiếu luôn với số từ tối thiểu của đề — viết
                                  thiếu từ là bị trừ Task Achievement. */}
                              <p
                                className={`mt-4 text-xs ${
                                  tooShort
                                    ? "font-semibold text-red-600 dark:text-red-400"
                                    : "text-muted-foreground"
                                }`}
                              >
                                {minWords !== null ? `${words} / ${minWords} từ` : `${words} từ`}
                                {tooShort ? ` · thiếu ${minWords - words} từ` : ""}
                              </p>
                            </>
                          )
                        ) : (
                          <p className="text-sm italic text-muted-foreground">
                            Học viên bỏ trống câu này.
                          </p>
                        )}
                      </div>
                    </article>
                  );
                })
              )}

              {/* Câu điền chỗ trống đã tự chấm: gộp thành bảng gọn để không đẩy
                  bài luận xuống dưới màn hình. */}
              {gapFillUnits.map((entry) => (
                <section
                  key={entry.unit.id}
                  className="overflow-hidden rounded-lg border border-border bg-muted/40"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                    <p className="text-xs font-medium text-muted-foreground">
                      {entry.unit.title} · phần điền chỗ trống (đã tự chấm)
                    </p>
                    <span className="rounded-full border border-border bg-card px-2 py-0.5 text-xs font-semibold tabular-nums">
                      {entry.correctCount}/{entry.answers.length} đúng
                    </span>
                  </div>
                  <div className="overflow-x-auto border-t border-border bg-background">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                          <th className="px-3 py-2 font-medium">Câu</th>
                          <th className="px-3 py-2 font-medium">Học viên trả lời</th>
                          <th className="px-3 py-2 font-medium">Đáp án</th>
                          <th className="px-3 py-2 text-center font-medium">Kết quả</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entry.answers.map((answer) => (
                          <tr key={answer.id} className="border-b border-border last:border-b-0">
                            <td className="px-3 py-2 tabular-nums text-muted-foreground">
                              {answer.question?.order ?? "—"}
                            </td>
                            <td
                              className={`px-3 py-2 ${
                                answer.isCorrect ? "" : "text-red-600 dark:text-red-400"
                              }`}
                            >
                              {answer.value.trim() || (
                                <span className="italic text-muted-foreground">bỏ trống</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {answer.correctAnswerSnapshot?.split(" | ").join(" / ") ?? "—"}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {answer.isCorrect ? (
                                <span className="text-emerald-600 dark:text-emerald-400">✓</span>
                              ) : (
                                <span className="text-red-600 dark:text-red-400">✕</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}
            </div>

            {/* Khung chấm dính theo màn hình: đọc tới đâu cho điểm tới đó, không
                phải cuộn ngược lên tìm nút Lưu. */}
            <div className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start lg:overflow-y-auto lg:pr-1">
              <ReviewForm
                attemptId={attempt.id}
                skill={skill}
                tasks={reviewTasks}
                nextAttemptId={nextUngraded?.id ?? null}
                snippets={snippets}
                review={attempt.review}
              />
            </div>
          </div>
        </div>

        {siblings.length > 1 ? (
          <aside className="shrink-0 xl:w-64">
            <div className="rounded-xl border border-border bg-card shadow-card">
              <div className="border-b border-border px-4 py-3">
                <h3 className="text-sm font-semibold">Học sinh trong bài tập</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Chấm đỏ = chưa chấm
                </p>
              </div>
              <ul className="max-h-[28rem] divide-y divide-border overflow-y-auto">
                {siblings.map((sibling, index) => {
                  const isCurrent = sibling.id === attempt.id;
                  const ungraded = sibling.status !== "reviewed";
                  return (
                    <li key={sibling.id}>
                      <Link
                        href={`/teacher/review/${sibling.id}`}
                        className={`flex items-center gap-2 px-4 py-2.5 text-sm transition ${
                          isCurrent
                            ? "bg-primary/10 font-semibold text-primary"
                            : "hover:bg-muted/40"
                        }`}
                      >
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${
                            ungraded ? "bg-red-500" : "bg-emerald-500"
                          }`}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1 truncate">
                          {index + 1}. {sibling.student.displayName}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
