"use client";

import { useMemo, useState } from "react";
import { ActionForm, ActionSubmitButton } from "@/components/action-form";
import { CommentBank, type Snippet } from "@/components/comment-bank";
import { saveTeacherReview } from "@/lib/actions/reviews";

type ReviewFormProps = {
  attemptId: string;
  skill: string;
  // Khi có bài kế tiếp chưa chấm, hiện thêm nút "Lưu & chấm bài tiếp".
  nextAttemptId?: string | null;
  snippets?: Snippet[];
  review?: {
    overallBand: number | null;
    criteriaScoresJson: string | null;
    summaryFeedback: string | null;
    detailedFeedback: string | null;
  } | null;
};

type Criterion = {
  key: string;
  label: string;
};

// Bốn tiêu chí chấm của IELTS, khác nhau giữa Writing và Speaking.
const WRITING_CRITERIA: Criterion[] = [
  { key: "taskAchievement", label: "Task Achievement / Response" },
  { key: "coherence", label: "Coherence & Cohesion" },
  { key: "lexicalResource", label: "Lexical Resource" },
  { key: "grammar", label: "Grammatical Range & Accuracy" }
];

const SPEAKING_CRITERIA: Criterion[] = [
  { key: "fluency", label: "Fluency & Coherence" },
  { key: "lexicalResource", label: "Lexical Resource" },
  { key: "grammar", label: "Grammatical Range & Accuracy" },
  { key: "pronunciation", label: "Pronunciation" }
];

// Các mức band hợp lệ: 0 → 9, bước 0.5.
const BAND_OPTIONS = Array.from({ length: 19 }, (_, index) => index * 0.5);

function criteriaForSkill(skill: string): Criterion[] {
  return skill === "speaking" ? SPEAKING_CRITERIA : WRITING_CRITERIA;
}

function parseCriteria(json: string | null): Record<string, number> {
  if (!json) {
    return {};
  }

  try {
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const result: Record<string, number> = {};

    for (const [key, value] of Object.entries(parsed)) {
      const num = Number(value);
      if (Number.isFinite(num)) {
        result[key] = num;
      }
    }

    return result;
  } catch {
    return {};
  }
}

// Quy tắc IELTS: band tổng = trung bình 4 tiêu chí, làm tròn về 0.5 gần nhất.
function roundToHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

export function ReviewForm({
  attemptId,
  skill,
  nextAttemptId,
  snippets = [],
  review
}: ReviewFormProps) {
  const criteria = criteriaForSkill(skill);
  const [detailed, setDetailed] = useState(review?.detailedFeedback ?? "");

  function insertSnippet(text: string) {
    setDetailed((current) => (current.trim() ? `${current}\n${text}` : text));
  }
  const initialScores = useMemo(
    () => parseCriteria(review?.criteriaScoresJson ?? null),
    [review?.criteriaScoresJson]
  );

  const [scores, setScores] = useState<Record<string, string>>(() => {
    const seed: Record<string, string> = {};
    for (const criterion of criteria) {
      const value = initialScores[criterion.key];
      seed[criterion.key] = value === undefined ? "" : String(value);
    }
    return seed;
  });

  const numericValues = criteria
    .map((criterion) => scores[criterion.key])
    .filter((value) => value !== "")
    .map((value) => Number(value));

  const autoOverall =
    numericValues.length === criteria.length && criteria.length > 0
      ? roundToHalf(
          numericValues.reduce((total, value) => total + value, 0) / criteria.length
        )
      : null;

  const criteriaJson = useMemo(() => {
    const payload: Record<string, number> = {};
    for (const criterion of criteria) {
      const raw = scores[criterion.key];
      if (raw !== "") {
        payload[criterion.key] = Number(raw);
      }
    }
    return Object.keys(payload).length > 0 ? JSON.stringify(payload) : "";
  }, [criteria, scores]);

  function updateScore(key: string, value: string) {
    setScores((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="grid gap-5">
      <ActionForm action={saveTeacherReview} className="grid gap-5">
      <input type="hidden" name="attemptId" value={attemptId} />
      <input type="hidden" name="criteriaScoresJson" value={criteriaJson} />
      {nextAttemptId ? (
        <input type="hidden" name="nextAttemptId" value={nextAttemptId} />
      ) : null}

      <fieldset className="grid gap-3">
        <legend className="text-sm font-medium">Điểm từng tiêu chí</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {criteria.map((criterion) => (
            <label key={criterion.key} className="grid gap-1.5 text-sm">
              <span className="text-xs font-medium text-muted-foreground">
                {criterion.label}
              </span>
              <select
                value={scores[criterion.key] ?? ""}
                onChange={(event) => updateScore(criterion.key, event.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary"
              >
                <option value="">—</option>
                {BAND_OPTIONS.map((band) => (
                  <option key={band} value={band}>
                    {band.toFixed(1)}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Chọn band cho từng tiêu chí. Band tổng sẽ tự tính theo trung bình (làm tròn 0.5).
        </p>
      </fieldset>

      <label className="grid gap-2 text-sm">
        <span className="font-medium">Band điểm tổng</span>
        <input
          name="overallBand"
          type="number"
          min="0"
          max="9"
          step="0.5"
          required
          key={autoOverall ?? "manual"}
          defaultValue={
            autoOverall !== null
              ? autoOverall
              : review?.overallBand ?? ""
          }
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary"
        />
        <span className="text-xs text-muted-foreground">
          {autoOverall !== null
            ? `Tự tính từ 4 tiêu chí: ${autoOverall.toFixed(1)}. Bạn có thể chỉnh tay nếu muốn.`
            : "Điền đủ 4 tiêu chí để tự tính, hoặc nhập tay band tổng."}
        </span>
      </label>

      <label className="grid gap-2 text-sm">
        <span className="font-medium">Nhận xét tổng quan</span>
        <textarea
          name="summaryFeedback"
          rows={3}
          required
          defaultValue={review?.summaryFeedback ?? ""}
          className="resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary"
        />
      </label>

      <label className="grid gap-2 text-sm">
        <span className="font-medium">Nhận xét chi tiết</span>
        <textarea
          name="detailedFeedback"
          rows={5}
          value={detailed}
          onChange={(event) => setDetailed(event.target.value)}
          className="resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary"
        />
      </label>

      <div className="flex flex-wrap gap-3">
        <ActionSubmitButton className="inline-flex rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-card transition hover:bg-primary/90">
          Lưu nhận xét
        </ActionSubmitButton>
        {nextAttemptId ? (
          <button
            type="submit"
            name="goNext"
            value="1"
            className="inline-flex rounded-lg border border-primary px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary hover:text-primary-foreground"
          >
            Lưu &amp; chấm bài tiếp →
          </button>
        ) : null}
      </div>
      </ActionForm>

      <CommentBank snippets={snippets} attemptId={attemptId} onInsert={insertSnippet} />
    </div>
  );
}
