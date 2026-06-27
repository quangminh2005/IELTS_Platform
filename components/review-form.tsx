import { saveTeacherReview } from "@/lib/actions/reviews";

type ReviewFormProps = {
  attemptId: string;
  review?: {
    overallBand: number | null;
    criteriaScoresJson: string | null;
    summaryFeedback: string | null;
    detailedFeedback: string | null;
  } | null;
};

export function ReviewForm({ attemptId, review }: ReviewFormProps) {
  return (
    <form action={saveTeacherReview} className="grid gap-4">
      <input type="hidden" name="attemptId" value={attemptId} />

      <label className="grid gap-2 text-sm">
        <span className="font-medium">Band điểm tổng</span>
        <input
          name="overallBand"
          type="number"
          min="0"
          max="9"
          step="0.5"
          required
          defaultValue={review?.overallBand ?? ""}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary"
        />
      </label>

      <label className="grid gap-2 text-sm">
        <span className="font-medium">Điểm từng tiêu chí (JSON)</span>
        <textarea
          name="criteriaScoresJson"
          rows={3}
          defaultValue={review?.criteriaScoresJson ?? ""}
          placeholder='{"taskAchievement":7,"coherence":7,"lexicalResource":6.5,"grammar":6.5}'
          className="resize-y rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm outline-none transition focus:border-primary"
        />
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
          defaultValue={review?.detailedFeedback ?? ""}
          className="resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary"
        />
      </label>

      <button
        type="submit"
        className="inline-flex w-fit rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-card transition hover:bg-primary/90"
      >
        Lưu nhận xét
      </button>
    </form>
  );
}
