import { AnnotatedAnswer, type Annotation } from "@/components/annotated-answer";
import { bandsBySkill, formatBand } from "@/lib/band-score";
import { formatDuration } from "@/lib/format-duration";
import { isAudioUrl } from "@/lib/question-interactions";

type Highlight = {
  id: string;
  selectedText: string;
  color: string;
  note: string | null;
  sourceType: string;
};

type Answer = {
  id: string;
  value: string;
  isCorrect: boolean | null;
  pointsAwarded: number | null;
  correctAnswerSnapshot: string | null;
  explanationSnapshot: string | null;
  annotations: Annotation[];
  question: {
    order: number;
    prompt: string;
    points: number;
  } | null;
  assignableUnit: {
    title: string;
    skill: string;
  };
};

const SKILL_LABELS: Record<string, string> = {
  listening: "Nghe (Listening)",
  reading: "Đọc (Reading)"
};

type TeacherReview = {
  overallBand: number | null;
  criteriaScoresJson: string | null;
  summaryFeedback: string | null;
  detailedFeedback: string | null;
} | null;

type ResultReviewProps = {
  attempt: {
    score: number | null;
    scorePercent: number | null;
    status: string;
    answers: Answer[];
    highlights: Highlight[];
    review?: TeacherReview;
  };
  // Thời gian làm bài theo kỹ năng (skill -> số giây). Bài cũ không có dữ liệu này.
  skillTimes?: Record<string, number>;
};

const CRITERIA_LABELS: Record<string, string> = {
  taskAchievement: "Task Achievement / Response",
  coherence: "Coherence & Cohesion",
  fluency: "Fluency & Coherence",
  lexicalResource: "Lexical Resource",
  grammar: "Grammatical Range & Accuracy",
  pronunciation: "Pronunciation"
};

function parseCriteria(json: string | null): Array<{ label: string; value: number }> {
  if (!json) {
    return [];
  }
  try {
    const parsed = JSON.parse(json) as Record<string, unknown>;
    return Object.entries(parsed)
      .map(([key, value]) => ({ label: CRITERIA_LABELS[key] ?? key, value: Number(value) }))
      .filter((row) => Number.isFinite(row.value));
  } catch {
    return [];
  }
}

function correctnessLabel(value: boolean | null) {
  if (value === true) {
    return "Đúng";
  }

  if (value === false) {
    return "Sai";
  }

  return "Chờ chấm";
}

function correctnessClass(value: boolean | null) {
  if (value === true) {
    return "border-emerald-400/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300";
  }

  if (value === false) {
    return "border-red-400/50 bg-red-500/10 text-red-600 dark:text-red-300";
  }

  return "border-accent/50 bg-accent/10 text-accent-foreground dark:text-accent";
}

const STATUS_LABELS: Record<string, string> = {
  reviewed: "Đã chấm",
  submitted: "Đã nộp",
  in_progress: "Đang làm",
  not_started: "Chưa làm"
};

export function ResultReview({ attempt, skillTimes }: ResultReviewProps) {
  const percentage =
    attempt.scorePercent !== null ? `${Math.round(attempt.scorePercent)}%` : "—";
  const statusLabel =
    STATUS_LABELS[attempt.status] ?? attempt.status.replaceAll("_", " ");
  // Chỉ hiện band cho bài thi đủ 40 câu (band null = không đủ điều kiện quy đổi).
  const bands = bandsBySkill(
    attempt.answers.map((answer) => ({
      isCorrect: answer.isCorrect,
      skill: answer.assignableUnit.skill
    }))
  ).filter((row) => row.band !== null);

  // Số câu đúng / tổng số câu chấm tự động (Nghe/Đọc). Câu chờ chấm (Viết/Nói)
  // có isCorrect = null nên không tính vào đây.
  const gradedAnswers = attempt.answers.filter((answer) => answer.isCorrect !== null);
  const correctCount = gradedAnswers.filter((answer) => answer.isCorrect === true).length;
  const gradedTotal = gradedAnswers.length;
  const correctLabel = gradedTotal > 0 ? `${correctCount}/${gradedTotal}` : "—";

  const review = attempt.review;
  const criteriaRows = parseCriteria(review?.criteriaScoresJson ?? null);

  return (
    <div className="space-y-6">
      {review ? (
        <section className="rounded-xl border border-primary/30 bg-primary/5 p-5 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-primary">Nhận xét của giáo viên</h3>
            {review.overallBand !== null ? (
              <span className="rounded-lg bg-primary px-3 py-1.5 text-lg font-bold tabular-nums text-primary-foreground">
                Band {formatBand(review.overallBand)}
              </span>
            ) : null}
          </div>

          {criteriaRows.length > 0 ? (
            <dl className="mt-4 grid gap-2 sm:grid-cols-2">
              {criteriaRows.map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm"
                >
                  <dt className="text-muted-foreground">{row.label}</dt>
                  <dd className="font-semibold tabular-nums">{row.value.toFixed(1)}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          {review.summaryFeedback ? (
            <div className="mt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Nhận xét tổng quan
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{review.summaryFeedback}</p>
            </div>
          ) : null}

          {review.detailedFeedback ? (
            <div className="mt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Nhận xét chi tiết
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{review.detailedFeedback}</p>
            </div>
          ) : null}
        </section>
      ) : null}

      {bands.length > 0 ? (
        <section className="grid gap-4 sm:grid-cols-2">
          {bands.map((row) => (
            <article
              key={row.skill}
              className="rounded-xl border border-primary/30 bg-primary/5 p-5 shadow-card"
            >
              <p className="text-sm font-semibold text-primary">
                Band {SKILL_LABELS[row.skill] ?? row.skill}
              </p>
              <p className="mt-2 text-4xl font-bold tabular-nums text-primary">
                {formatBand(row.band)}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {row.correct}/{row.total} câu đúng
              </p>
              {skillTimes?.[row.skill] !== undefined ? (
                <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                  <span aria-hidden="true">⏱</span>
                  {formatDuration(skillTimes[row.skill])}
                </p>
              ) : null}
            </article>
          ))}
        </section>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-xl border border-border bg-card p-5 shadow-card">
          <p className="text-sm text-muted-foreground">Số câu đúng</p>
          <p className="mt-2 text-3xl font-bold tabular-nums">{correctLabel}</p>
        </article>
        <article className="rounded-xl border border-border bg-card p-5 shadow-card">
          <p className="text-sm text-muted-foreground">Tỷ lệ đúng</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-primary">{percentage}</p>
        </article>
        <article className="rounded-xl border border-border bg-card p-5 shadow-card">
          <p className="text-sm text-muted-foreground">Trạng thái</p>
          <p className="mt-2 text-3xl font-bold">{statusLabel}</p>
        </article>
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-base font-semibold">Đáp án</h3>
        </div>
        <div className="divide-y divide-border">
          {attempt.answers.length > 0 ? (
            attempt.answers.map((answer) => (
              <article key={answer.id} className="px-5 py-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{answer.assignableUnit.title}</p>
                    <h4 className="mt-1 font-semibold">
                      {answer.question ? `Câu ${answer.question.order}` : "Câu chưa liên kết"}
                    </h4>
                    {answer.question ? (
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {answer.question.prompt}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${correctnessClass(
                      answer.isCorrect
                    )}`}
                  >
                    {correctnessLabel(answer.isCorrect)}
                  </span>
                </div>

                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div className="rounded-lg border border-border bg-muted/60 p-3">
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Bạn trả lời
                    </dt>
                    <dd className="mt-2">
                      {answer.value ? (
                        isAudioUrl(answer.value) ? (
                          <audio controls src={answer.value} className="w-full" preload="metadata">
                            <track kind="captions" />
                          </audio>
                        ) : (
                          <AnnotatedAnswer text={answer.value} annotations={answer.annotations} />
                        )
                      ) : (
                        <span className="whitespace-pre-wrap">Bỏ trống</span>
                      )}
                    </dd>
                  </div>
                  <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/5 p-3">
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Đáp án đúng
                    </dt>
                    <dd className="mt-2 whitespace-pre-wrap">
                      {answer.correctAnswerSnapshot || "Không có"}
                    </dd>
                  </div>
                </dl>

                {answer.explanationSnapshot ? (
                  <div className="mt-3 rounded-lg border border-border bg-muted/60 p-3 text-sm">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Giải thích
                    </p>
                    <p className="mt-2 leading-6">{answer.explanationSnapshot}</p>
                  </div>
                ) : null}

                <p className="mt-3 text-sm text-muted-foreground">
                  {answer.isCorrect === null ? (
                    "Chờ giáo viên chấm"
                  ) : (
                    <>
                      Điểm: {answer.pointsAwarded ?? 0}
                      {answer.question ? ` / ${answer.question.points}` : ""}
                    </>
                  )}
                </p>
              </article>
            ))
          ) : (
            <p className="px-5 py-8 text-sm text-muted-foreground">
              Chưa có đáp án nào cho lần làm bài này.
            </p>
          )}
        </div>
      </section>

      {attempt.highlights.length > 0 ? (
        <section className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
          <div className="border-b border-border px-5 py-4">
            <h3 className="text-base font-semibold">Đoạn đã tô</h3>
          </div>
          <div className="divide-y divide-border">
            {attempt.highlights.map((highlight) => (
              <article key={highlight.id} className="px-5 py-4">
                <p className="text-sm capitalize text-muted-foreground">
                  {highlight.sourceType} | {highlight.color}
                </p>
                <p className="mt-2 whitespace-pre-wrap font-medium">{highlight.selectedText}</p>
                {highlight.note ? (
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{highlight.note}</p>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
