import { AiRequestButton } from "@/components/ai-grading/ai-request-button";
import { AiScoreCard } from "@/components/ai-grading/ai-score-card";
import { requestTeacherAiReview } from "@/lib/actions/ai-grading";
import type { AiReviewView } from "@/lib/ai-grading/views";

// Khung "Bản nháp của AI" phía trên phiếu chấm. latest = lượt gần nhất (bất kể trạng
// thái), done = lượt xong gần nhất (có thể do học viên nhờ ở bài tự luyện).
export function TeacherAiPanel({
  attemptId,
  enabled,
  latest,
  done
}: {
  attemptId: string;
  enabled: boolean;
  latest: AiReviewView | null;
  done: AiReviewView | null;
}) {
  if (!enabled && !done?.result) return null;

  const pending = latest?.status === "pending";
  const failedMessage =
    latest?.status === "failed" && (!done || latest.createdAt > done.createdAt)
      ? (latest.errorMessage ?? "Không rõ lỗi.")
      : null;

  return (
    <section className="mb-4 rounded-xl border border-violet-400/40 bg-card p-4 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">🤖 Bản nháp của AI</h3>
        {enabled && !pending ? (
          <AiRequestButton
            attemptId={attemptId}
            action={requestTeacherAiReview}
            label={done?.result ? "Chấm lại bằng AI" : "AI chấm nháp"}
            pendingLabel="AI đang chấm… (khoảng 30 giây)"
          />
        ) : null}
      </div>

      {pending ? (
        <p className="mt-2 text-sm text-primary">AI đang chấm bài này… tải lại trang sau ít phút.</p>
      ) : null}
      {failedMessage ? (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">Lần chấm gần nhất lỗi: {failedMessage}</p>
      ) : null}

      {done?.result ? (
        <div className="mt-3 space-y-2">
          {done.requestedBy === "student" ? (
            <p className="text-xs text-muted-foreground">Học viên đã tự nhờ AI chấm bài tự luyện này.</p>
          ) : null}
          <AiScoreCard result={done.result} audience="teacher" />
          <p className="text-xs text-muted-foreground">
            Bấm “Điền từ bản nháp AI” trong phiếu chấm để chép điểm và nhận xét — chưa có gì được lưu cho
            đến khi thầy bấm Lưu.
          </p>
        </div>
      ) : !pending ? (
        <p className="mt-2 text-xs text-muted-foreground">
          AI chấm theo thang band IELTS chính thức và tìm lỗi sai trong bài. Kết quả chỉ là bản nháp để thầy sửa.
        </p>
      ) : null}
    </section>
  );
}
