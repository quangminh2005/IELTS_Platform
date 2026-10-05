import { formatBand } from "@/lib/band-score";
import type { AiGradingResult } from "@/lib/ai-grading/types";
import { aiOverallBand, aiTaskBand } from "@/lib/ai-grading/validate";
import { SPEAKING_CRITERIA, WRITING_CRITERIA } from "@/lib/writing-review";

const CRITERION_LABELS = new Map(
  [...WRITING_CRITERIA, ...SPEAKING_CRITERIA].map((criterion) => [criterion.key, criterion.label])
);

// Band từng tiêu chí + lý do + nhận xét của một lượt AI chấm (không có hook — dùng
// được ở cả server component).
export function AiScoreCard({
  result,
  audience
}: {
  result: AiGradingResult;
  audience: "teacher" | "student";
}) {
  const overall = aiOverallBand(result);
  const multi = result.tasks.length > 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-sm font-medium text-muted-foreground">
          {audience === "student" ? "Band ước lượng" : "Band AI đề xuất"}
        </span>
        <span className="text-2xl font-bold tabular-nums text-primary">{formatBand(overall)}</span>
        {result.skill === "speaking" ? (
          <span className="text-xs text-muted-foreground">
            (chưa tính Pronunciation; Fluency chỉ ước lượng từ bản chép lời)
          </span>
        ) : null}
      </div>

      {audience === "student" ? (
        <p className="text-xs italic text-muted-foreground">
          Điểm do AI ước lượng, chỉ để tham khảo — điểm chính thức do thầy chấm.
        </p>
      ) : null}

      {result.tasks.map((task) => (
        <section
          key={task.unitId || "speaking"}
          className="space-y-3 rounded-lg border border-border bg-background p-3"
        >
          {multi ? (
            <p className="text-sm font-semibold">
              {task.label} · band {formatBand(aiTaskBand(task))}
            </p>
          ) : null}
          <ul className="space-y-2">
            {task.criteria.map((criterion) => (
              <li key={criterion.key} className="text-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">{CRITERION_LABELS.get(criterion.key) ?? criterion.key}</span>
                  <span className="font-semibold tabular-nums">{formatBand(criterion.band)}</span>
                </div>
                {criterion.reason ? (
                  <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{criterion.reason}</p>
                ) : null}
              </li>
            ))}
          </ul>
          {task.summary ? <p className="whitespace-pre-wrap text-sm leading-6">{task.summary}</p> : null}
        </section>
      ))}
    </div>
  );
}
