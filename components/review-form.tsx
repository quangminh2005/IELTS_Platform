"use client";

import { useMemo, useState } from "react";
import { ActionForm, ActionSubmitButton } from "@/components/action-form";
import { CommentBank, type Snippet } from "@/components/comment-bank";
import { saveTeacherReview } from "@/lib/actions/reviews";
import {
  BAND_OPTIONS,
  criteriaForSkill,
  overallBandFromTasks,
  parseReviewCriteria,
  serializeReviewCriteria,
  taskBand,
  type ReviewTask,
  type TaskScores
} from "@/lib/writing-review";

// Một phần cần chấm. Writing có thể có 2 phần (Task 1 + Task 2), Speaking chỉ
// một phần duy nhất cho cả 3 part (unitId rỗng).
export type ReviewTaskInput = {
  unitId: string;
  label: string;
  taskNumber: number | null;
};

type ReviewFormProps = {
  attemptId: string;
  skill: string;
  tasks: ReviewTaskInput[];
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

type ScoreState = Record<string, Record<string, string>>;

// Ghép điểm đã lưu vào đúng phần đang chấm: ưu tiên khớp unitId, còn bản ghi cũ
// (dạng phẳng, không có unitId) thì gán theo thứ tự.
function seedScores(tasks: ReviewTaskInput[], stored: ReviewTask[]): ScoreState {
  const byUnit = new Map(stored.filter((task) => task.unitId).map((task) => [task.unitId, task]));
  const seeded: ScoreState = {};

  tasks.forEach((task, index) => {
    const matched = byUnit.get(task.unitId) ?? (byUnit.size === 0 ? stored[index] : undefined);
    const scores: Record<string, string> = {};

    for (const [key, value] of Object.entries(matched?.scores ?? {})) {
      scores[key] = String(value);
    }

    seeded[task.unitId] = scores;
  });

  return seeded;
}

function toNumericScores(raw: Record<string, string> | undefined): TaskScores {
  const scores: TaskScores = {};

  for (const [key, value] of Object.entries(raw ?? {})) {
    if (value !== "") {
      const number = Number(value);
      if (Number.isFinite(number)) {
        scores[key] = number;
      }
    }
  }

  return scores;
}

export function ReviewForm({
  attemptId,
  skill,
  tasks,
  nextAttemptId,
  snippets = [],
  review
}: ReviewFormProps) {
  const criteria = criteriaForSkill(skill);
  const [detailed, setDetailed] = useState(review?.detailedFeedback ?? "");

  function insertSnippet(text: string) {
    setDetailed((current) => (current.trim() ? `${current}\n${text}` : text));
  }

  const storedTasks = useMemo(
    () => parseReviewCriteria(review?.criteriaScoresJson ?? null),
    [review?.criteriaScoresJson]
  );

  const [scores, setScores] = useState<ScoreState>(() => seedScores(tasks, storedTasks));

  // Dữ liệu chuẩn hoá dùng chung cho: band từng phần, band tổng và ô hidden gửi lên.
  const reviewTasks: ReviewTask[] = useMemo(
    () =>
      tasks.map((task) => ({
        unitId: task.unitId,
        label: task.label,
        taskNumber: task.taskNumber,
        scores: toNumericScores(scores[task.unitId])
      })),
    [tasks, scores]
  );

  const { band: autoOverall, weighted } = overallBandFromTasks(reviewTasks, criteria);
  const criteriaJson = useMemo(() => serializeReviewCriteria(reviewTasks), [reviewTasks]);

  function updateScore(unitId: string, key: string, value: string) {
    setScores((current) => ({
      ...current,
      [unitId]: { ...(current[unitId] ?? {}), [key]: value }
    }));
  }

  const multiTask = tasks.length > 1;

  const overallHint =
    autoOverall !== null
      ? weighted
        ? `Tự tính theo IELTS: (Task 1 + Task 2 × 2) ÷ 3 = ${autoOverall.toFixed(1)}. Bạn có thể chỉnh tay nếu muốn.`
        : multiTask
          ? `Tự tính: trung bình band của ${tasks.length} phần = ${autoOverall.toFixed(1)}. Bạn có thể chỉnh tay nếu muốn.`
          : `Tự tính từ 4 tiêu chí: ${autoOverall.toFixed(1)}. Bạn có thể chỉnh tay nếu muốn.`
      : multiTask
        ? "Chấm đủ 4 tiêu chí cho từng phần để tự tính, hoặc nhập tay band tổng."
        : "Điền đủ 4 tiêu chí để tự tính, hoặc nhập tay band tổng.";

  return (
    <div className="grid gap-5">
      <ActionForm action={saveTeacherReview} className="grid gap-5">
      <input type="hidden" name="attemptId" value={attemptId} />
      <input type="hidden" name="criteriaScoresJson" value={criteriaJson} />
      {nextAttemptId ? (
        <input type="hidden" name="nextAttemptId" value={nextAttemptId} />
      ) : null}

      {tasks.map((task) => {
        const band = taskBand(toNumericScores(scores[task.unitId]), criteria);

        return (
          <fieldset
            key={task.unitId}
            className={
              multiTask
                ? "grid gap-3 rounded-lg border border-border bg-muted/30 p-3"
                : "grid gap-3"
            }
          >
            <legend
              className={
                multiTask
                  ? "flex items-center gap-2 px-1 text-sm font-semibold"
                  : "text-sm font-medium"
              }
            >
              <span>{multiTask ? task.label : "Điểm từng tiêu chí"}</span>
              {multiTask ? (
                <span className="rounded-full border border-border bg-card px-2 py-0.5 text-xs font-semibold tabular-nums text-primary">
                  {band !== null ? band.toFixed(1) : "—"}
                </span>
              ) : null}
            </legend>

            <div className="grid gap-3 sm:grid-cols-2">
              {criteria.map((criterion) => (
                <label key={criterion.key} className="grid gap-1.5 text-sm">
                  <span className="text-xs font-medium text-muted-foreground">
                    {criterion.label}
                  </span>
                  <select
                    value={scores[task.unitId]?.[criterion.key] ?? ""}
                    onChange={(event) =>
                      updateScore(task.unitId, criterion.key, event.target.value)
                    }
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary"
                  >
                    <option value="">—</option>
                    {BAND_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option.toFixed(1)}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </fieldset>
        );
      })}

      {!multiTask ? (
        <p className="-mt-2 text-xs text-muted-foreground">
          Chọn band cho từng tiêu chí. Band tổng sẽ tự tính theo trung bình (làm tròn 0.5).
        </p>
      ) : null}

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
        <span className="text-xs text-muted-foreground">{overallHint}</span>
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
