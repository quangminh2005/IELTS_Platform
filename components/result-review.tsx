import { type Annotation } from "@/components/annotated-answer";
import { ResultAnswers, type ResultPart } from "@/components/result-answers";
import { bandsBySkill, formatBand } from "@/lib/band-score";
import { formatDuration } from "@/lib/format-duration";
import { skillRank } from "@/lib/skills";

type Highlight = {
  id: string;
  selectedText: string;
  color: string;
  note: string | null;
  sourceType: string;
};

type Answer = {
  id: string;
  assignableUnitId: string;
  value: string;
  isCorrect: boolean | null;
  pointsAwarded: number | null;
  correctAnswerSnapshot: string | null;
  explanationSnapshot: string | null;
  evidenceSnapshot: string | null;
  annotations: Annotation[];
  question: {
    order: number;
    prompt: string;
    points: number;
    answerEvidence: string | null;
  } | null;
  assignableUnit: {
    title: string;
    skill: string;
    transcript?: string | null;
    content?: string | null;
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
  // Đẩy sticky của cột transcript xuống dưới thanh trên cùng (trang toàn màn hình).
  sourceStickyTopClass?: string;
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

const STATUS_LABELS: Record<string, string> = {
  reviewed: "Đã chấm",
  submitted: "Đã nộp",
  in_progress: "Đang làm",
  not_started: "Chưa làm"
};

export function ResultReview({ attempt, skillTimes, sourceStickyTopClass }: ResultReviewProps) {
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

  // Gom đáp án theo từng part (assignableUnit), giữ thứ tự xuất hiện. Nguồn cột trái:
  // Listening = transcript, Reading = content, còn lại = null (hiện một cột).
  const partMap = new Map<string, ResultPart>();
  for (const answer of attempt.answers) {
    const unit = answer.assignableUnit;
    let part = partMap.get(answer.assignableUnitId);
    if (!part) {
      const sourceText =
        unit.skill === "listening"
          ? unit.transcript ?? null
          : unit.skill === "reading"
            ? unit.content ?? null
            : null;
      part = {
        unitId: answer.assignableUnitId,
        title: unit.title,
        skill: unit.skill,
        sourceText,
        answers: [],
        answerStrings: [],
        answersByOrder: {},
        minOrder: null,
        maxOrder: null
      };
      partMap.set(answer.assignableUnitId, part);
    }
    part.answers.push({
      id: answer.id,
      order: answer.question?.order ?? null,
      prompt: answer.question?.prompt ?? null,
      points: answer.question?.points ?? null,
      value: answer.value,
      isCorrect: answer.isCorrect,
      pointsAwarded: answer.pointsAwarded,
      correctAnswerSnapshot: answer.correctAnswerSnapshot,
      questionEvidence: answer.question?.answerEvidence ?? null,
      evidenceSnapshot: answer.evidenceSnapshot,
      explanationSnapshot: answer.explanationSnapshot,
      annotations: answer.annotations
    });
    const corrects = answer.correctAnswerSnapshot
      ? answer.correctAnswerSnapshot.split(" | ")
      : [];
    part.answerStrings.push(...corrects);
    if (answer.question) {
      const order = answer.question.order;
      if (corrects[0]) {
        part.answersByOrder[order] = corrects[0];
      }
      part.minOrder = part.minOrder === null ? order : Math.min(part.minOrder, order);
      part.maxOrder = part.maxOrder === null ? order : Math.max(part.maxOrder, order);
    }
  }
  // Answer được lưu theo thứ tự học viên bấm lưu (createdAt) nên phải sắp lại
  // theo số câu; câu không gắn Question (order = null) đẩy xuống cuối. Các part
  // sắp theo kỹ năng trước (Nghe→Đọc→Viết→Nói) rồi mới tới câu nhỏ nhất — vì mỗi
  // kỹ năng đều đánh số từ 1 nên nếu chỉ so số câu thì Nghe và Đọc sẽ xen kẽ nhau.
  const byOrder = (a: number | null, b: number | null) => {
    if (a === null && b === null) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return a - b;
  };
  const parts = [...partMap.values()];
  for (const part of parts) {
    part.answers.sort((a, b) => byOrder(a.order, b.order));
  }
  parts.sort(
    (a, b) => skillRank(a.skill) - skillRank(b.skill) || byOrder(a.minOrder, b.minOrder)
  );

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

      <ResultAnswers parts={parts} stickyTopClass={sourceStickyTopClass} />

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
