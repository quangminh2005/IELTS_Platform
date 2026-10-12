import { PracticeGoalWeeks } from "@/components/practice-goal-weeks";
import type { PracticeGoalStatus } from "@/lib/practice-goal-data";

// Khối "Tự luyện ở nhà" trong báo cáo phụ huynh (/ph/[token]). Cố ý KHÔNG nhắc Xu —
// phụ huynh chỉ cần biết con có làm đủ phần thầy giao hay không.
export function ParentPracticeGoal({ status }: { status: PracticeGoalStatus | null }) {
  const week = status?.current;
  if (!status || status.goal <= 0 || !week) return null;

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-base font-semibold">Tự luyện ở nhà</h2>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div>
          <p className="font-semibold">
            Tuần này: {week.done}/{status.goal} phần{" "}
            <span
              className={
                week.met ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
              }
            >
              ({week.met ? "đã đạt" : "chưa đạt"})
            </span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Thầy giao {status.goal} phần/tuần, mỗi phần khoảng 15–20 phút.
          </p>
        </div>
        <PracticeGoalWeeks weeks={status.weeks} />
      </div>
    </section>
  );
}
