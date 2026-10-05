import { AiHighlightedEssay } from "@/components/ai-grading/ai-highlighted-essay";
import { AiRequestButton } from "@/components/ai-grading/ai-request-button";
import { AiScoreCard } from "@/components/ai-grading/ai-score-card";
import { requestStudentAiReview } from "@/lib/actions/ai-grading";
import { AI_ERROR_CATEGORY_LABELS, type AiError } from "@/lib/ai-grading/types";
import type { AiReviewView } from "@/lib/ai-grading/views";

export type StudentAiEssay = { answerId: string; label: string; text: string };

function SpeakingErrorList({ label, errors }: { label: string; errors: AiError[] }) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-semibold">{label}</p>
      <ul className="space-y-1.5">
        {errors.map((error) => (
          <li key={error.id} className="rounded-md border border-border bg-card p-2 text-sm">
            <span className="rounded bg-red-500/10 px-1 text-red-700 line-through decoration-red-500/60 dark:text-red-300">
              {error.quote}
            </span>{" "}
            → <span className="font-medium text-emerald-700 dark:text-emerald-300">{error.correction}</span>
            <span className="ml-2 rounded-full border border-border px-1.5 text-[11px] text-muted-foreground">
              {AI_ERROR_CATEGORY_LABELS[error.category]}
            </span>
            <span className="mt-1 block text-xs leading-5 text-muted-foreground">{error.explanation}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Khối "Nhận xét AI" ở trang Kết quả — CHỈ bài tự luyện (trang gọi đã lọc).
export function StudentAiFeedback({
  attemptId,
  enabled,
  view,
  remaining,
  limit,
  teacherReviewed,
  essays
}: {
  attemptId: string;
  enabled: boolean;
  // Lượt học viên nhờ gần nhất của bài này (null = chưa nhờ).
  view: AiReviewView | null;
  remaining: number;
  limit: number;
  teacherReviewed: boolean;
  essays: StudentAiEssay[];
}) {
  const result = view?.status === "done" ? view.result : null;

  if (!result && (!enabled || limit === 0)) return null;

  const allErrors = result ? result.tasks.flatMap((task) => task.errors) : [];

  const body = result ? (
    <div className="space-y-5">
      <AiScoreCard result={result} audience="student" />
      {result.skill === "writing"
        ? essays.map((essay) => (
            <div key={essay.answerId} className="space-y-2">
              <p className="text-sm font-semibold">{essay.label}</p>
              <AiHighlightedEssay
                text={essay.text}
                errors={allErrors.filter((error) => error.answerId === essay.answerId)}
              />
            </div>
          ))
        : essays.map((essay) => {
            const errors = allErrors.filter((error) => error.answerId === essay.answerId);
            return errors.length > 0 ? (
              <SpeakingErrorList key={essay.answerId} label={essay.label} errors={errors} />
            ) : null;
          })}
    </div>
  ) : (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        AI chấm bài theo thang band IELTS chính thức, chỉ ra lỗi sai và cách sửa. Mỗi bài chỉ nhờ AI chấm
        được một lần.
      </p>
      {view?.status === "pending" ? (
        <p className="text-sm font-medium text-primary">AI đang chấm bài này… tải lại trang sau ít phút.</p>
      ) : (
        <AiRequestButton
          attemptId={attemptId}
          action={requestStudentAiReview}
          label={
            remaining > 0
              ? `Nhờ AI chấm bài này (còn ${remaining}/${limit} lượt hôm nay)`
              : "Hết lượt hôm nay, mai quay lại nhé"
          }
          pendingLabel="AI đang chấm… (khoảng 30 giây)"
          disabled={remaining === 0}
        />
      )}
      {view?.status === "failed" && view.errorMessage ? (
        <p className="text-sm text-red-600 dark:text-red-400">Lần trước bị lỗi: {view.errorMessage}</p>
      ) : null}
    </div>
  );

  return (
    <section className="mb-6 rounded-xl border border-violet-400/40 bg-card p-5 shadow-card">
      {teacherReviewed && result ? (
        <details>
          <summary className="cursor-pointer text-sm font-semibold">🤖 Nhận xét AI (bấm để xem)</summary>
          <div className="mt-4">{body}</div>
        </details>
      ) : (
        <>
          <h3 className="mb-3 text-base font-semibold">🤖 Nhận xét AI</h3>
          {body}
        </>
      )}
    </section>
  );
}
