import { AnnotatedAnswer, type Annotation } from "@/components/annotated-answer";
import { bandsBySkill, formatBand } from "@/lib/band-score";

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

type ResultReviewProps = {
  attempt: {
    score: number | null;
    scorePercent: number | null;
    status: string;
    answers: Answer[];
    highlights: Highlight[];
  };
};

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

export function ResultReview({ attempt }: ResultReviewProps) {
  const percentage =
    attempt.scorePercent !== null ? `${Math.round(attempt.scorePercent)}%` : "—";
  const score = attempt.score !== null ? attempt.score : "—";
  const statusLabel =
    STATUS_LABELS[attempt.status] ?? attempt.status.replaceAll("_", " ");
  // Chỉ hiện band cho bài thi đủ 40 câu (band null = không đủ điều kiện quy đổi).
  const bands = bandsBySkill(
    attempt.answers.map((answer) => ({
      isCorrect: answer.isCorrect,
      skill: answer.assignableUnit.skill
    }))
  ).filter((row) => row.band !== null);

  return (
    <div className="space-y-6">
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
            </article>
          ))}
        </section>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-xl border border-border bg-card p-5 shadow-card">
          <p className="text-sm text-muted-foreground">Điểm</p>
          <p className="mt-2 text-3xl font-bold tabular-nums">{score}</p>
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
                        <AnnotatedAnswer text={answer.value} annotations={answer.annotations} />
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
