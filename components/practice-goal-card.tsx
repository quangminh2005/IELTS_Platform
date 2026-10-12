import Link from "next/link";
import { PracticeGoalWeeks } from "@/components/practice-goal-weeks";
import { PRACTICE_GOAL_PENALTY, PRACTICE_GOAL_REWARD } from "@/lib/practice-goal";
import type { PracticeGoalStatus } from "@/lib/practice-goal-data";

export function PracticeGoalCard({ status }: { status: PracticeGoalStatus }) {
  const week = status.current;
  if (status.goal === 0 || !week) return null;

  const done = Math.min(week.done, status.goal);
  const percent = Math.round((done / status.goal) * 100);
  const rejected = week.rejected.too_short + week.rejected.too_few_answers;

  return (
    <section
      className={`rounded-xl border p-5 shadow-card ${
        week.met ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40" : "border-border bg-card"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">🎯 Tự luyện tuần này</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {week.met
              ? `Đã đạt ✓ +${PRACTICE_GOAL_REWARD} Xu`
              : `Đạt +${PRACTICE_GOAL_REWARD} Xu · Không đạt −${PRACTICE_GOAL_PENALTY} Xu · hạn Chủ nhật`}
          </p>
        </div>
        <PracticeGoalWeeks weeks={status.weeks} />
      </div>

      <div className="mt-4 flex items-center gap-3">
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full ${week.met ? "bg-emerald-500" : "bg-primary"}`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className="text-sm font-semibold tabular-nums">
          {week.done}/{status.goal} phần
        </span>
      </div>

      {rejected > 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {rejected} lượt chưa tính
          {week.rejected.too_short > 0 ? ` · ${week.rejected.too_short} lượt làm dưới 3 phút` : ""}
          {week.rejected.too_few_answers > 0 ? ` · ${week.rejected.too_few_answers} lượt trả lời chưa tới một nửa` : ""}
        </p>
      ) : null}

      {!week.met ? (
        <Link
          href="/student/practice"
          className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          Luyện ngay
        </Link>
      ) : null}
    </section>
  );
}
