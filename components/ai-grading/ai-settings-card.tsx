import { ActionForm, ActionSubmitButton } from "@/components/action-form";
import { updateAiDailyLimit } from "@/lib/actions/ai-grading";
import { formatVnd } from "@/lib/ai-grading/pricing";
import { MAX_AI_DAILY_LIMIT } from "@/lib/ai-grading/quota";

// Cài đặt AI chấm ở trang Tự luyện của thầy: số lượt/ngày + chi phí tháng này.
export function AiSettingsCard({
  enabled,
  limit,
  monthCount,
  monthCostUsd
}: {
  enabled: boolean;
  limit: number;
  monthCount: number;
  monthCostUsd: number;
}) {
  return (
    <section className="rounded-xl border border-violet-400/40 bg-card p-5 shadow-card">
      <h3 className="text-base font-semibold">🤖 AI chấm Writing & Speaking</h3>
      {enabled ? (
        <>
          <p className="mt-1 text-sm text-muted-foreground">
            AI tháng này: <span className="font-semibold text-foreground">{monthCount} lượt</span> · khoảng{" "}
            <span className="font-semibold text-foreground">{formatVnd(monthCostUsd)}</span> (ước tính)
          </p>
          <ActionForm action={updateAiDailyLimit} className="mt-4 flex flex-wrap items-end gap-3">
            <label className="block text-sm font-medium">
              <span className="mb-2 block">Số lượt mỗi học viên được nhờ AI chấm mỗi ngày (bài tự luyện)</span>
              <input
                type="number"
                name="aiDailyLimit"
                min={0}
                max={MAX_AI_DAILY_LIMIT}
                defaultValue={limit}
                className="w-28 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/40 focus:border-primary focus:ring-2"
              />
            </label>
            <ActionSubmitButton className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-card transition hover:bg-primary/90">
              Lưu
            </ActionSubmitButton>
          </ActionForm>
          <p className="mt-2 text-xs text-muted-foreground">
            Đặt 0 để tắt AI chấm phía học viên. Lượt thầy bấm ở trang chấm không bị giới hạn.
          </p>
        </>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">
          Chưa bật: cần thêm biến môi trường OPENAI_API_KEY trên Vercel.
        </p>
      )}
    </section>
  );
}
