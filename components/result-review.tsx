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
  question: {
    order: number;
    prompt: string;
    points: number;
  } | null;
  assignableUnit: {
    title: string;
  };
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
    return "Correct";
  }

  if (value === false) {
    return "Incorrect";
  }

  return "Pending review";
}

function correctnessClass(value: boolean | null) {
  if (value === true) {
    return "border-primary/50 bg-primary/10 text-primary";
  }

  if (value === false) {
    return "border-red-400/50 bg-red-500/10 text-red-200";
  }

  return "border-accent/50 bg-accent/10 text-accent";
}

export function ResultReview({ attempt }: ResultReviewProps) {
  const percentage =
    attempt.scorePercent !== null ? `${Math.round(attempt.scorePercent)}%` : "Pending";
  const score = attempt.score !== null ? attempt.score : "Pending";

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-md border border-border bg-muted/50 p-5">
          <p className="text-sm text-muted-foreground">Score</p>
          <p className="mt-3 text-3xl font-semibold">{score}</p>
        </article>
        <article className="rounded-md border border-border bg-muted/50 p-5">
          <p className="text-sm text-muted-foreground">Percentage</p>
          <p className="mt-3 text-3xl font-semibold">{percentage}</p>
        </article>
        <article className="rounded-md border border-border bg-muted/50 p-5">
          <p className="text-sm text-muted-foreground">Status</p>
          <p className="mt-3 text-3xl font-semibold capitalize">
            {attempt.status.replaceAll("_", " ")}
          </p>
        </article>
      </section>

      <section className="rounded-md border border-border bg-muted/35">
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-lg font-semibold">Answers</h3>
        </div>
        <div className="divide-y divide-border">
          {attempt.answers.length > 0 ? (
            attempt.answers.map((answer) => (
              <article key={answer.id} className="px-5 py-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{answer.assignableUnit.title}</p>
                    <h4 className="mt-1 font-semibold">
                      {answer.question ? `Question ${answer.question.order}` : "Unlinked question"}
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
                  <div className="rounded-md border border-border bg-background/40 p-3">
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">Answer</dt>
                    <dd className="mt-2 whitespace-pre-wrap">{answer.value || "No answer"}</dd>
                  </div>
                  <div className="rounded-md border border-border bg-background/40 p-3">
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                      Correct answer
                    </dt>
                    <dd className="mt-2 whitespace-pre-wrap">
                      {answer.correctAnswerSnapshot || "Not available"}
                    </dd>
                  </div>
                </dl>

                {answer.explanationSnapshot ? (
                  <div className="mt-3 rounded-md border border-border bg-background/40 p-3 text-sm">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Explanation
                    </p>
                    <p className="mt-2 leading-6">{answer.explanationSnapshot}</p>
                  </div>
                ) : null}

                <p className="mt-3 text-sm text-muted-foreground">
                  Points: {answer.pointsAwarded ?? 0}
                  {answer.question ? ` / ${answer.question.points}` : ""}
                </p>
              </article>
            ))
          ) : (
            <p className="px-5 py-8 text-sm text-muted-foreground">
              No answers are attached to this attempt yet.
            </p>
          )}
        </div>
      </section>

      {attempt.highlights.length > 0 ? (
        <section className="rounded-md border border-border bg-muted/35">
          <div className="border-b border-border px-5 py-4">
            <h3 className="text-lg font-semibold">Highlights</h3>
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
