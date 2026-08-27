import Link from "next/link";
import { formatBand } from "@/lib/band-score";
import { RankTierBadge } from "@/components/rank-tier-badge";
import { StudentAvatar } from "@/components/student-avatar";
import { daysAgoLabel } from "@/lib/student-score";
import type { RankedClassStudent } from "@/lib/class-ranking";

const medals = ["🥇", "🥈", "🥉"];

// Hạng nhất avatar to hơn hẳn (80px) so với hạng nhì/ba (64px) — sự chênh lệch
// kích thước này là một phần cách bục "đọc" được, nên giữ field size riêng cho
// từng hạng và truyền vào StudentAvatar thay vì dùng chung một size.
const podiumStyle = [
  {
    ring: "ring-yellow-400",
    pedestal: "h-24 bg-yellow-400/20",
    size: "podium" as const,
    shine: "animate-podium-shine"
  },
  { ring: "ring-slate-300", pedestal: "h-16 bg-slate-300/20", size: "lg" as const, shine: "" },
  { ring: "ring-amber-600", pedestal: "h-12 bg-amber-600/20", size: "lg" as const, shine: "" }
];

// Điểm trung bình hiển thị: ưu tiên band, không quy đổi được thì giữ %.
function averageLabel(student: RankedClassStudent) {
  return student.averageBandValue !== null
    ? `Band ${formatBand(student.averageBandValue)}`
    : `${Math.round(student.averageScorePercent)}%`;
}

// Mũi tên lên/xuống so với ảnh chụp 7 ngày trước. Tuần trước chưa có mặt trong
// bảng -> gắn nhãn "mới" thay vì mũi tên (không có gì để so).
function RankChange({ change, showNew }: { change: number | null; showNew: boolean }) {
  if (change === null) {
    // Khi cả lớp đều chưa có dữ liệu tuần trước (bảng vừa mới có bài đầu tiên)
    // thì không gắn nhãn gì cho đỡ nhiễu — chờ đủ một tuần mới có cái để so.
    if (!showNew) {
      return null;
    }

    return (
      <span className="text-[11px] font-semibold text-muted-foreground" title="Tuần trước chưa có bài nào">
        mới
      </span>
    );
  }

  if (change === 0) {
    return (
      <span className="text-[11px] font-semibold text-muted-foreground" title="Giữ nguyên hạng so với tuần trước">
        –
      </span>
    );
  }

  const up = change > 0;

  return (
    <span
      className={`text-[11px] font-semibold tabular-nums ${
        up ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
      }`}
      title={`${up ? "Tăng" : "Giảm"} ${Math.abs(change)} hạng so với tuần trước`}
    >
      {up ? "▲" : "▼"} {Math.abs(change)}
    </span>
  );
}

// Bục top 3 + bảng từ hạng 4. Dùng chung cho trang Xếp hạng của học viên và
// của giáo viên; chỉ khác ở nhãn "Bạn" và ở chỗ giáo viên bấm được vào tên để
// mở hồ sơ học viên.
export function ClassRankingBoard({
  students,
  highlightStudentId = null,
  linkToProfile = false
}: {
  students: RankedClassStudent[];
  highlightStudentId?: string | null;
  linkToProfile?: boolean;
}) {
  // Chỉ khu vực giáo viên mới có trang hồ sơ học viên.
  function StudentName({ student, className = "" }: { student: RankedClassStudent; className?: string }) {
    if (!linkToProfile) {
      return <span className={className}>{student.displayName}</span>;
    }

    return (
      <Link
        href={`/teacher/students/${student.id}`}
        className={`${className} rounded transition hover:text-primary hover:underline`}
      >
        {student.displayName}
      </Link>
    );
  }

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
  // Có ai đó đã có mặt trong bảng từ tuần trước thì mới đáng gắn nhãn "mới".
  const hasTrendData = ranked.some((student) => student.rankChange !== null);

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
              <div key={rankedStudent.id} className="flex w-28 flex-col items-center sm:w-36">
                <span className="mb-1 text-2xl">{medals[rankIndex]}</span>
                <StudentAvatar
                  avatarUrl={rankedStudent.avatarUrl}
                  avatarPreset={rankedStudent.avatarPreset}
                  userImage={rankedStudent.userImage}
                  displayName={rankedStudent.displayName}
                  size={style.size}
                  className={`ring-4 ${style.ring} ${style.shine}`}
                />
                <p className="mt-2 max-w-full truncate text-center text-sm font-semibold">
                  <StudentName student={rankedStudent} />
                  {isHighlighted ? (
                    <span className="ml-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                      Bạn
                    </span>
                  ) : null}
                </p>
                <p className="flex items-center gap-1.5 text-xs font-semibold tabular-nums text-primary">
                  {rankedStudent.rankingScore} điểm
                  <RankChange change={rankedStudent.rankChange} showNew={hasTrendData} />
                </p>
                <div className="mt-1">
                  <RankTierBadge score={rankedStudent.rankingScore} />
                </div>
                <p className="mt-1 text-center text-[11px] leading-4 text-muted-foreground">
                  {averageLabel(rankedStudent)}
                  <br />
                  {rankedStudent.submittedCount} bài · {daysAgoLabel(rankedStudent.daysSinceLastActivity)}
                  <br />
                  Hoàn thành {Math.round(rankedStudent.completionRate)}%
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
                  <p className="flex flex-col items-start text-lg font-bold tabular-nums">
                    <span className="text-base text-muted-foreground">{index + 4}</span>
                    <RankChange change={rankedStudent.rankChange} showNew={hasTrendData} />
                  </p>
                  <div className="flex min-w-0 items-center gap-3">
                    <StudentAvatar
                      avatarUrl={rankedStudent.avatarUrl}
                      avatarPreset={rankedStudent.avatarPreset}
                      userImage={rankedStudent.userImage}
                      displayName={rankedStudent.displayName}
                      size="list"
                    />
                    <div className="min-w-0">
                      <p className="truncate font-semibold">
                        <StudentName student={rankedStudent} />
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
                        <span>Điểm TB: {averageLabel(rankedStudent)}</span>
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
                    {averageLabel(rankedStudent)}
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
                <StudentAvatar
                  avatarUrl={rankedStudent.avatarUrl}
                  avatarPreset={rankedStudent.avatarPreset}
                  userImage={rankedStudent.userImage}
                  displayName={rankedStudent.displayName}
                  size="list"
                  className="opacity-70"
                />
                <p className="truncate text-sm font-medium text-muted-foreground">
                  <StudentName student={rankedStudent} />
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
