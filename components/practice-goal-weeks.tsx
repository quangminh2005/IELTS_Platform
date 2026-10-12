import { weekLabel, type WeekStatus } from "@/lib/practice-goal";

// Dải chấm 4 tuần gần nhất của chỉ tiêu tự luyện, CŨ bên trái → MỚI bên phải. Tuần
// đang chạy chưa đạt = chấm viền đứt. Dùng chung cho học viên, thầy và phụ huynh.
export function PracticeGoalWeeks({ weeks }: { weeks: WeekStatus[] }) {
  const shown = weeks.slice(0, 4).reverse();
  if (shown.length === 0) return null;

  return (
    <ol className="flex shrink-0 gap-1.5" aria-label="Chỉ tiêu tự luyện 4 tuần gần nhất">
      {shown.map((week) => {
        const state = week.met ? "met" : week.ended ? "missed" : "running";
        const label = `${weekLabel(week.weekKey)}: ${week.done}/${week.goal} phần — ${
          state === "met" ? "đạt" : state === "missed" ? "chưa đạt" : "đang làm"
        }`;

        return (
          <li
            key={week.weekKey}
            title={label}
            aria-label={label}
            className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
              state === "met"
                ? "bg-emerald-500 text-white"
                : state === "missed"
                  ? "bg-rose-500 text-white"
                  : "border-2 border-dashed border-border text-muted-foreground"
            }`}
          >
            {state === "met" ? "✓" : state === "missed" ? "✗" : ""}
          </li>
        );
      })}
    </ol>
  );
}
