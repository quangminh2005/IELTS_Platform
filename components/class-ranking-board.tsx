import { formatBand } from "@/lib/band-score";
import { RankTierBadge } from "@/components/rank-tier-badge";
import { daysAgoLabel } from "@/lib/student-score";
import type { RankedClassStudent } from "@/lib/class-ranking";

// Chữ cái viết tắt cho avatar (tối đa 2 ký tự, lấy từ đầu các từ trong tên).
function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return "?";
  }

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

// Màu nền avatar suy ra từ tên để mỗi học viên có một màu ổn định, dễ phân biệt.
const AVATAR_COLORS = [
  "bg-rose-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-teal-500",
  "bg-sky-500",
  "bg-indigo-500",
  "bg-violet-500",
  "bg-fuchsia-500"
];

function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }

  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

const medals = ["🥇", "🥈", "🥉"];

const podiumStyle = [
  { ring: "ring-yellow-400", pedestal: "h-24 bg-yellow-400/20", size: "h-20 w-20", shine: "animate-podium-shine" },
  { ring: "ring-slate-300", pedestal: "h-16 bg-slate-300/20", size: "h-16 w-16", shine: "" },
  { ring: "ring-amber-600", pedestal: "h-12 bg-amber-600/20", size: "h-16 w-16", shine: "" }
];

// Bục top 3 + bảng từ hạng 4. Dùng chung cho trang Xếp hạng của học viên và
// của giáo viên; chỉ khác ở chỗ có gắn nhãn "Bạn" hay không.
export function ClassRankingBoard({
  students,
  highlightStudentId = null
}: {
  students: RankedClassStudent[];
  highlightStudentId?: string | null;
}) {
  if (students.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card px-5 py-12 text-center shadow-card">
        <p className="text-sm font-medium">Lớp chưa có học viên nào</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Thêm học viên vào lớp để bảng xếp hạng có dữ liệu.
        </p>
      </div>
    );
  }

  // Chưa nộp bài nào thì chưa có gì để xếp hạng: tách hẳn xuống nhóm riêng, không
  // gắn hạng và không gắn bậc (tránh cảnh học viên mới đứng bét với 0 điểm).
  const ranked = students.filter((student) => student.hasSubmitted);
  const notStarted = students.filter((student) => !student.hasSubmitted);

  const topThree = ranked.slice(0, 3);
  const rest = ranked.slice(3);

  // Thứ tự hiển thị trực quan: hạng 2 (trái) - hạng 1 (giữa) - hạng 3 (phải).
  // Chỉ lấy các vị trí thực sự có học viên (lớp ít người sẽ có 1-2 bục).
  const podiumOrder = [1, 0, 2].filter((rankIndex) => topThree[rankIndex]);

  if (ranked.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card px-5 py-12 text-center shadow-card">
        <p className="text-sm font-medium">Chưa có ai nộp bài</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Bảng xếp hạng sẽ xuất hiện sau bài nộp đầu tiên của lớp.
        </p>
      </div>
    );
  }

  return (
    <>
      <section className="rounded-xl border border-border bg-card px-4 py-6 shadow-card">
        <div className="flex items-end justify-center gap-3 sm:gap-6">
          {podiumOrder.map((rankIndex) => {
            const rankedStudent = topThree[rankIndex];
            const style = podiumStyle[rankIndex];
            const isHighlighted = rankedStudent.id === highlightStudentId;

            return (
              <div key={rankedStudent.id} className="flex w-24 flex-col items-center sm:w-28">
                <span className="mb-1 text-2xl">{medals[rankIndex]}</span>
                {rankedStudent.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={rankedStudent.avatarUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    className={`${style.size} rounded-full object-cover ring-4 ${style.ring} ${style.shine}`}
                  />
                ) : (
                  <span
                    className={`flex ${style.size} items-center justify-center rounded-full text-lg font-bold text-white ring-4 ${style.ring} ${style.shine} ${avatarColor(
                      rankedStudent.displayName
                    )}`}
                    aria-hidden="true"
                  >
                    {initials(rankedStudent.displayName)}
                  </span>
                )}
                <p className="mt-2 max-w-full truncate text-center text-sm font-semibold">
                  {rankedStudent.displayName}
                  {isHighlighted ? (
                    <span className="ml-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                      Bạn
                    </span>
                  ) : null}
                </p>
                <p className="text-xs font-semibold tabular-nums text-primary">
                  {rankedStudent.rankingScore} điểm
                </p>
                <div className="mt-1">
                  <RankTierBadge score={rankedStudent.rankingScore} />
                </div>
                <p className="mt-1 text-center text-[11px] leading-4 text-muted-foreground">
                  {rankedStudent.submittedCount} bài
                  <br />
                  {daysAgoLabel(rankedStudent.daysSinceLastActivity)}
                </p>
                <div
                  className={`mt-2 flex w-full items-start justify-center rounded-t-lg ${style.pedestal}`}
                >
                  <span className="mt-1 text-sm font-bold tabular-nums text-foreground">
                    {rankIndex + 1}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {rest.length > 0 ? (
        <section className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
          <div className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-3 border-b border-border bg-muted/50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid-cols-[3.5rem_minmax(0,1fr)_6rem_4.5rem_6rem_7.5rem_4.5rem]">
            <span>Hạng</span>
            <span>Học viên</span>
            <span className="hidden md:block">Điểm TB</span>
            <span className="hidden md:block">Số bài</span>
            <span className="hidden md:block">Hoàn thành</span>
            <span className="hidden md:block">Làm gần nhất</span>
            <span className="hidden md:block">Tổng</span>
          </div>
          <div className="divide-y divide-border">
            {rest.map((rankedStudent, index) => {
              const isHighlighted = rankedStudent.id === highlightStudentId;

              return (
                <article
                  key={rankedStudent.id}
                  className={`grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-3 px-5 py-4 md:grid-cols-[3.5rem_minmax(0,1fr)_6rem_4.5rem_6rem_7.5rem_4.5rem] ${
                    isHighlighted ? "bg-primary/10" : ""
                  }`}
                >
                  <p className="text-lg font-bold tabular-nums">
                    <span className="text-base text-muted-foreground">{index + 4}</span>
                  </p>
                  <div className="flex min-w-0 items-center gap-3">
                    {rankedStudent.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={rankedStudent.avatarUrl}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="h-9 w-9 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${avatarColor(
                          rankedStudent.displayName
                        )}`}
                        aria-hidden="true"
                      >
                        {initials(rankedStudent.displayName)}
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-semibold">
                        {rankedStudent.displayName}
                        {isHighlighted ? (
                          <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
                            Bạn
                          </span>
                        ) : null}
                      </p>
                      <div className="mt-1">
                        <RankTierBadge score={rankedStudent.rankingScore} />
                      </div>
                      <p className="mt-2 grid gap-1 text-sm text-muted-foreground md:hidden">
                        <span>
                          Điểm TB:{" "}
                          {rankedStudent.averageBandValue !== null
                            ? `Band ${formatBand(rankedStudent.averageBandValue)}`
                            : `${Math.round(rankedStudent.averageScorePercent)}%`}
                        </span>
                        <span>Số bài: {rankedStudent.submittedCount}</span>
                        <span>Hoàn thành: {Math.round(rankedStudent.completionRate)}%</span>
                        <span>
                          Làm gần nhất: {daysAgoLabel(rankedStudent.daysSinceLastActivity)}
                        </span>
                        <span className="font-semibold text-foreground">
                          Tổng: {rankedStudent.rankingScore}
                        </span>
                      </p>
                    </div>
                  </div>
                  <p className="hidden text-sm tabular-nums md:block">
                    {rankedStudent.averageBandValue !== null
                      ? `Band ${formatBand(rankedStudent.averageBandValue)}`
                      : `${Math.round(rankedStudent.averageScorePercent)}%`}
                  </p>
                  <p className="hidden text-sm tabular-nums md:block">
                    {rankedStudent.submittedCount}
                  </p>
                  <p className="hidden text-sm tabular-nums md:block">
                    {Math.round(rankedStudent.completionRate)}%
                  </p>
                  <p className="hidden text-sm tabular-nums md:block">
                    {daysAgoLabel(rankedStudent.daysSinceLastActivity)}
                  </p>
                  <p className="hidden font-semibold tabular-nums text-primary md:block">
                    {rankedStudent.rankingScore}
                  </p>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {notStarted.length > 0 ? (
        <section className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
          <div className="border-b border-border bg-muted/50 px-5 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Chưa có bài nào
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Vào bảng xếp hạng ngay sau bài nộp đầu tiên.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-3 px-5 py-4">
            {notStarted.map((rankedStudent) => (
              <div key={rankedStudent.id} className="flex min-w-0 items-center gap-3">
                {rankedStudent.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={rankedStudent.avatarUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="h-9 w-9 shrink-0 rounded-full object-cover opacity-70"
                  />
                ) : (
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white opacity-70 ${avatarColor(
                      rankedStudent.displayName
                    )}`}
                    aria-hidden="true"
                  >
                    {initials(rankedStudent.displayName)}
                  </span>
                )}
                <p className="truncate text-sm font-medium text-muted-foreground">
                  {rankedStudent.displayName}
                  {rankedStudent.id === highlightStudentId ? (
                    <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
                      Bạn
                    </span>
                  ) : null}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
