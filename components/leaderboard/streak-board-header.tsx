import { STREAK_TIERS, streakTierProgress } from "@/lib/leaderboard";

// Phần đầu bảng Chuỗi: dải 7 cấp lửa + còn bao nhiêu ngày lên cấp. myDays null = giáo
// viên xem (không có chuỗi riêng → không tô cấp, không có dòng tiến trình).
export function StreakBoardHeader({ myDays }: { myDays: number | null }) {
  const progress = myDays === null ? null : streakTierProgress(myDays);

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5">
      <h3 className="flex items-center gap-2 text-lg font-bold">
        <span aria-hidden="true">🔥</span>
        Chuỗi ngày học
      </h3>
      <p className="text-sm text-muted-foreground">
        Học mỗi ngày để giữ lửa — nộp một phần bài hoặc ôn một thẻ Sổ từ là tính.
      </p>

      <ol className="mt-3 grid grid-cols-7 gap-1 text-center">
        {STREAK_TIERS.map((tier) => {
          const reached = myDays !== null && myDays >= tier.minDays;
          const isCurrent = progress?.current?.key === tier.key;

          return (
            <li
              key={tier.key}
              className={`rounded-lg px-0.5 py-2 ${isCurrent ? "bg-primary/10 ring-1 ring-primary" : ""}`}
            >
              <span
                aria-hidden="true"
                className={`block text-lg leading-none ${reached || myDays === null ? "" : "opacity-30 grayscale"}`}
              >
                🔥
              </span>
              <span className="mt-1 block text-[10px] font-semibold leading-tight sm:text-xs">{tier.name}</span>
              <span className="block text-[10px] text-muted-foreground">{tier.minDays}+</span>
            </li>
          );
        })}
      </ol>

      {progress ? (
        <p className="mt-3 text-sm">
          {progress.next && progress.daysToNext !== null ? (
            <>
              Còn <span className="font-bold">{progress.daysToNext} ngày</span> nữa là lên{" "}
              <span className="font-bold">{progress.next.name}</span>.
            </>
          ) : (
            "Bạn đã ở cấp lửa cao nhất — Bất Diệt! 🏆"
          )}
        </p>
      ) : null}
    </section>
  );
}
