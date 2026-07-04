// Vòng tròn tiến độ (SVG donut) hiển thị % bài được giao đã hoàn thành.
// total === 0 -> không render (chưa có bài nào để đo).
export function ProgressRing({
  completed,
  total,
}: {
  completed: number;
  total: number;
}) {
  if (total === 0) {
    return null;
  }

  const percent = Math.round((completed / total) * 100);
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percent / 100);

  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4 shadow-card">
      <div className="relative shrink-0">
        <svg width="88" height="88" viewBox="0 0 88 88" className="-rotate-90">
          <circle
            cx="44"
            cy="44"
            r={radius}
            fill="none"
            strokeWidth="8"
            className="stroke-muted"
          />
          <circle
            cx="44"
            cy="44"
            r={radius}
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            className="stroke-primary"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-lg font-bold tabular-nums">
          {percent}%
        </span>
      </div>
      <div>
        <p className="text-base font-semibold">Tiến độ tuần luyện tập</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Đã hoàn thành {completed}/{total} bài được giao
        </p>
      </div>
    </div>
  );
}
