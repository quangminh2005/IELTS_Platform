"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ActionForm, ActionSubmitButton } from "@/components/action-form";
import { BandPicker } from "@/components/band-picker";
import { CommentBankChips, CommentBankManager, type Snippet } from "@/components/comment-bank";
import { saveTeacherReview } from "@/lib/actions/reviews";
import {
  draftFingerprint,
  parseReviewDraft,
  reviewDraftKey,
  shouldRestoreDraft
} from "@/lib/review-draft";
import {
  criteriaForSkill,
  hasLowBand,
  overallBandFromTasks,
  parseReviewCriteria,
  serializeReviewCriteria,
  taskBand,
  type Criterion,
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
    reviewedAt?: Date | string | null;
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

function toReviewTasks(tasks: ReviewTaskInput[], scores: ScoreState): ReviewTask[] {
  return tasks.map((task) => ({
    unitId: task.unitId,
    label: task.label,
    taskNumber: task.taskNumber,
    scores: toNumericScores(scores[task.unitId])
  }));
}

function autoBandOf(
  tasks: ReviewTaskInput[],
  scores: ScoreState,
  criteria: Criterion[]
): number | null {
  return overallBandFromTasks(toReviewTasks(tasks, scores), criteria).band;
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

  const storedTasks = useMemo(
    () => parseReviewCriteria(review?.criteriaScoresJson ?? null),
    [review?.criteriaScoresJson]
  );

  const initialScores = useMemo(() => seedScores(tasks, storedTasks), [tasks, storedTasks]);

  const initialOverallBand =
    review?.overallBand !== null && review?.overallBand !== undefined
      ? String(review.overallBand)
      : "";

  const [scores, setScores] = useState<ScoreState>(initialScores);
  const [summary, setSummary] = useState(review?.summaryFeedback ?? "");
  const [detailed, setDetailed] = useState(review?.detailedFeedback ?? "");
  const [overallBand, setOverallBand] = useState(initialOverallBand);

  // Nội dung đang có trên máy chủ. Nháp chỉ được ghi khi phiếu chấm KHÁC bản này
  // — nếu không thì chỉ mở bài ra xem cũng sinh nháp, rồi lần sau mở lại bị báo
  // "đã khôi phục bản nháp" dù chưa sửa gì.
  const baselineFingerprint = useMemo(
    () =>
      draftFingerprint({
        scores: initialScores,
        overallBand: initialOverallBand,
        summaryFeedback: review?.summaryFeedback ?? "",
        detailedFeedback: review?.detailedFeedback ?? ""
      }),
    [initialScores, initialOverallBand, review?.summaryFeedback, review?.detailedFeedback]
  );

  // Band tổng bám theo 4 tiêu chí, TRỪ KHI giáo viên tự gõ đè. Bài cũ đã lưu band
  // lệch với trung bình tiêu chí thì coi như đã gõ tay, không tự sửa lại.
  const [manualBand, setManualBand] = useState(() => {
    const seededAuto = autoBandOf(tasks, initialScores, criteria);
    return (
      review?.overallBand !== null &&
      review?.overallBand !== undefined &&
      seededAuto !== null &&
      review.overallBand !== seededAuto
    );
  });

  // Dải band dưới 4.0 chỉ mở khi bài đang có điểm thấp hoặc giáo viên tự mở.
  const [lowRange, setLowRange] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const task of tasks) {
      initial[task.unitId] = hasLowBand(toNumericScores(initialScores[task.unitId]));
    }
    return initial;
  });

  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  const [restoredDraft, setRestoredDraft] = useState(false);
  // Chỉ bắt đầu ghi nháp SAU khi đã thử khôi phục, nếu không lần ghi đầu tiên
  // (state rỗng) sẽ đè mất bản nháp đang có trong máy.
  const readyToSave = useRef(false);

  const draftKey = reviewDraftKey(attemptId);

  // Khôi phục nháp: chạy sau khi mount để không lệch nội dung so với bản render
  // từ máy chủ (localStorage không tồn tại lúc SSR).
  useEffect(() => {
    let draft = null;
    try {
      draft = parseReviewDraft(window.localStorage.getItem(draftKey));
    } catch {
      draft = null;
    }

    if (draft && shouldRestoreDraft(draft, review?.reviewedAt ?? null)) {
      setScores(draft.scores);
      setSummary(draft.summaryFeedback);
      setDetailed(draft.detailedFeedback);
      setOverallBand(draft.overallBand);
      setManualBand(
        draft.overallBand !== "" &&
          Number(draft.overallBand) !== autoBandOf(tasks, draft.scores, criteria)
      );
      setRestoredDraft(true);
    } else if (draft) {
      try {
        window.localStorage.removeItem(draftKey);
      } catch {
        // bỏ qua: chế độ riêng tư có thể chặn localStorage
      }
    }

    readyToSave.current = true;
    // Chỉ chạy một lần cho mỗi bài làm.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  const reviewTasks = useMemo(() => toReviewTasks(tasks, scores), [tasks, scores]);
  const { band: autoOverall, weighted } = overallBandFromTasks(reviewTasks, criteria);
  const criteriaJson = useMemo(() => serializeReviewCriteria(reviewTasks), [reviewTasks]);

  // Chấm đủ 4 tiêu chí thì tự điền band tổng.
  useEffect(() => {
    if (!manualBand && autoOverall !== null) {
      setOverallBand(String(autoOverall));
    }
  }, [autoOverall, manualBand]);

  // Ghi nháp sau mỗi thay đổi, gộp lại trong 600ms cho đỡ ghi liên tục khi gõ.
  useEffect(() => {
    if (!readyToSave.current) {
      return;
    }

    const payload = { scores, overallBand, summaryFeedback: summary, detailedFeedback: detailed };

    // Trùng khớp bản đã lưu (hoặc chưa gõ gì) → không cần nháp, dọn luôn nháp cũ.
    if (draftFingerprint(payload) === baselineFingerprint) {
      try {
        window.localStorage.removeItem(draftKey);
      } catch {
        // bỏ qua
      }
      setDraftSavedAt(null);
      return;
    }

    const timer = window.setTimeout(() => {
      const savedAt = Date.now();
      try {
        window.localStorage.setItem(draftKey, JSON.stringify({ ...payload, savedAt }));
        setDraftSavedAt(savedAt);
      } catch {
        // bỏ qua: hết dung lượng hoặc bị chặn thì vẫn chấm bình thường
      }
    }, 600);

    return () => window.clearTimeout(timer);
  }, [scores, overallBand, summary, detailed, draftKey, baselineFingerprint]);

  function discardDraft() {
    try {
      window.localStorage.removeItem(draftKey);
    } catch {
      // bỏ qua
    }
    setScores(initialScores);
    setSummary(review?.summaryFeedback ?? "");
    setDetailed(review?.detailedFeedback ?? "");
    setOverallBand(initialOverallBand);
    setRestoredDraft(false);
    setDraftSavedAt(null);
  }

  function updateScore(unitId: string, key: string, value: string) {
    setScores((current) => ({
      ...current,
      [unitId]: { ...(current[unitId] ?? {}), [key]: value }
    }));
  }

  function insertSnippet(text: string) {
    setDetailed((current) => (current.trim() ? `${current}\n${text}` : text));
  }

  const multiTask = tasks.length > 1;

  const overallHint =
    autoOverall !== null
      ? weighted
        ? `Tự tính theo IELTS: (Task 1 + Task 2 × 2) ÷ 3 = ${autoOverall.toFixed(1)}.`
        : multiTask
          ? `Tự tính: trung bình band của ${tasks.length} phần = ${autoOverall.toFixed(1)}.`
          : `Tự tính từ 4 tiêu chí: ${autoOverall.toFixed(1)}.`
      : multiTask
        ? "Chấm đủ 4 tiêu chí cho từng phần để tự tính, hoặc nhập tay band tổng."
        : "Điền đủ 4 tiêu chí để tự tính, hoặc nhập tay band tổng.";

  return (
    <div className="grid gap-4">
      {restoredDraft ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-400/50 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          <span>Đã khôi phục bản nháp chưa lưu.</span>
          <button
            type="button"
            onClick={discardDraft}
            className="font-semibold underline underline-offset-2"
          >
            Bỏ nháp
          </button>
        </div>
      ) : null}

      {/* Cột chấm rộng thì tách đôi: tiêu chí bên trái, nhận xét bên phải. Vừa
          dùng hết chỗ trống vừa rút ngắn phiếu chấm còn một nửa nên đỡ phải cuộn
          trong panel dính — rõ nhất khi bài có 2 task (8 hàng band). Chia theo
          container query, xem .review-form-split trong app/globals.css. */}
      <ActionForm action={saveTeacherReview} className="review-form-split grid gap-5">
        <input type="hidden" name="attemptId" value={attemptId} />
        <input type="hidden" name="criteriaScoresJson" value={criteriaJson} />
        {nextAttemptId ? (
          <input type="hidden" name="nextAttemptId" value={nextAttemptId} />
        ) : null}

        <div className="grid content-start gap-5">
        {tasks.map((task) => {
          const band = taskBand(toNumericScores(scores[task.unitId]), criteria);
          const showLow = lowRange[task.unitId] ?? false;

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

              <div className="grid gap-3">
                {criteria.map((criterion) => (
                  <BandPicker
                    key={criterion.key}
                    label={criterion.label}
                    value={scores[task.unitId]?.[criterion.key] ?? ""}
                    onChange={(value) => updateScore(task.unitId, criterion.key, value)}
                    showLow={showLow}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={() =>
                  setLowRange((current) => ({ ...current, [task.unitId]: !showLow }))
                }
                className="justify-self-start text-[11px] text-muted-foreground underline underline-offset-2 transition hover:text-foreground"
              >
                {showLow ? "Ẩn band dưới 4.0" : "Hiện band dưới 4.0"}
              </button>
            </fieldset>
          );
        })}

        <label className="grid gap-2 text-sm">
          <span className="font-medium">Band điểm tổng</span>
          <input
            name="overallBand"
            type="number"
            min="0"
            max="9"
            step="0.5"
            required
            value={overallBand}
            onChange={(event) => {
              setManualBand(true);
              setOverallBand(event.target.value);
            }}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary"
          />
          <span className="text-xs text-muted-foreground">
            {overallHint}
            {manualBand && autoOverall !== null ? (
              <>
                {" "}
                <button
                  type="button"
                  onClick={() => {
                    setManualBand(false);
                    setOverallBand(String(autoOverall));
                  }}
                  className="underline underline-offset-2 transition hover:text-foreground"
                >
                  Dùng lại band tự tính
                </button>
              </>
            ) : null}
          </span>
        </label>
        </div>

        <div className="grid content-start gap-5">
        <label className="grid gap-2 text-sm">
          <span className="font-medium">Nhận xét tổng quan</span>
          <textarea
            name="summaryFeedback"
            rows={3}
            required
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            className="resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary"
          />
        </label>

        <div className="grid gap-2 text-sm">
          <label className="grid gap-2">
            <span className="font-medium">Nhận xét chi tiết</span>
            <textarea
              name="detailedFeedback"
              rows={5}
              value={detailed}
              onChange={(event) => setDetailed(event.target.value)}
              className="resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary"
            />
          </label>
          <CommentBankChips snippets={snippets} criteria={criteria} onInsert={insertSnippet} />
        </div>

        <div className="grid gap-2">
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
          {draftSavedAt ? (
            <p className="text-[11px] text-muted-foreground">
              Đã lưu nháp lúc{" "}
              {new Date(draftSavedAt).toLocaleTimeString("vi-VN", {
                hour: "2-digit",
                minute: "2-digit"
              })}{" "}
              — nháp chỉ nằm trên máy này, vẫn phải bấm Lưu để học viên thấy.
            </p>
          ) : null}
        </div>
        </div>
      </ActionForm>

      <CommentBankManager snippets={snippets} criteria={criteria} attemptId={attemptId} />
    </div>
  );
}
