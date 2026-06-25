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
        <span className="font-medium">Overall band</span>
        <input
          name="overallBand"
          type="number"
          min="0"
          max="9"
          step="0.5"
          required
          defaultValue={review?.overallBand ?? ""}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary"
        />
      </label>

      <label className="grid gap-2 text-sm">
        <span className="font-medium">Criteria scores JSON</span>
        <textarea
          name="criteriaScoresJson"
          rows={3}
          defaultValue={review?.criteriaScoresJson ?? ""}
          placeholder='{"taskAchievement":7,"coherence":7,"lexicalResource":6.5,"grammar":6.5}'
          className="resize-y rounded-md border border-border bg-background px-3 py-2 font-mono text-sm outline-none transition focus:border-primary"
        />
      </label>

      <label className="grid gap-2 text-sm">
        <span className="font-medium">Summary feedback</span>
        <textarea
          name="summaryFeedback"
          rows={3}
          required
          defaultValue={review?.summaryFeedback ?? ""}
          className="resize-y rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary"
        />
      </label>

      <label className="grid gap-2 text-sm">
        <span className="font-medium">Detailed feedback</span>
        <textarea
          name="detailedFeedback"
          rows={5}
          defaultValue={review?.detailedFeedback ?? ""}
          className="resize-y rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary"
        />
      </label>

      <button
        type="submit"
        className="inline-flex w-fit rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
      >
        Save review
      </button>
    </form>
  );
}
