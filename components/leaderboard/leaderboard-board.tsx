import Link from "next/link";
import { StreakTierChip } from "@/components/leaderboard/streak-tier-chip";
import { RankTierBadge } from "@/components/rank-tier-badge";
import { StudentAvatar } from "@/components/student-avatar";
import type { BoardPerson, LeaderboardChip, LeaderboardEntry } from "@/lib/leaderboard";

// Bục Top 3 + danh sách cho bảng Học Bá / Chuỗi (Mạng xã hội Đợt 1). Dùng chung cho
// trang Xếp hạng của học viên, khối trang chủ (chỉ LeaderboardRow) và tab Chuỗi của
// giáo viên. Không có hook → import được cả từ client component.

export type LeaderboardLinkTarget = "student" | "teacher";

// Hạng 1 đứng giữa và cao nhất; avatar to hơn hạng 2/3 một bậc (giống bảng Tổng kết tháng).
const podiumStyle = [
  { ring: "ring-yellow-400", pedestal: "h-14 bg-yellow-400/25", size: "lg" as const, shine: "animate-podium-shine" },
  { ring: "ring-slate-300", pedestal: "h-10 bg-slate-300/25", size: "md" as const, shine: "" },
  { ring: "ring-amber-600", pedestal: "h-8 bg-amber-600/25", size: "md" as const, shine: "" }
];

function profileHref(studentId: string, target: LeaderboardLinkTarget): string {
  return target === "teacher" ? `/teacher/students/${studentId}` : `/student/profile/${studentId}`;
}

function ProfileLink({
  entry,
  linkTarget,
  className = ""
}: {
  entry: LeaderboardEntry;
  linkTarget: LeaderboardLinkTarget;
  className?: string;
}) {
  return (
    <Link
      href={profileHref(entry.studentId, linkTarget)}
      className={`${className} rounded transition hover:text-primary hover:underline`}
    >
      {entry.displayName}
    </Link>
  );
}

function YouChip() {
  return (
    <span className="ml-1 shrink-0 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
      Bạn
    </span>
  );
}

export function LeaderboardChipView({ chip }: { chip: LeaderboardChip }) {
  return chip.kind === "rank" ? <RankTierBadge xp={chip.xp} /> : <StreakTierChip days={chip.days} />;
}

export function LeaderboardRow({
  entry,
  isYou,
  linkTarget
}: {
  entry: LeaderboardEntry;
  isYou: boolean;
  linkTarget: LeaderboardLinkTarget;
}) {
  return (
    <li
      className={`flex items-center gap-3 rounded-xl px-3 py-2 ${
        isYou ? "bg-primary/10 ring-1 ring-primary" : "bg-border/30 dark:bg-border/20"
      }`}
    >
      <span className="w-7 shrink-0 text-center text-sm font-bold tabular-nums text-muted-foreground">
        {entry.rank}
      </span>
      <StudentAvatar
        avatarUrl={entry.avatarUrl}
        avatarPreset={entry.avatarPreset}
        userImage={entry.userImage}
        frame={entry.equippedFrame ?? null}
        displayName={entry.displayName}
        size="sm"
      />
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-center text-sm font-semibold">
          <ProfileLink entry={entry} linkTarget={linkTarget} className="truncate" />
          {isYou ? <YouChip /> : null}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <LeaderboardChipView chip={entry.chip} />
          {entry.subText ? <span className="text-[11px] text-muted-foreground">{entry.subText}</span> : null}
        </div>
      </div>
      <span className="shrink-0 text-sm font-bold tabular-nums text-primary">{entry.valueText}</span>
    </li>
  );
}

function MissingSelfRow({ person, text }: { person: BoardPerson; text: string }) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-dashed border-primary/50 px-3 py-2">
      <span className="w-7 shrink-0 text-center text-sm font-bold text-muted-foreground">–</span>
      <StudentAvatar
        avatarUrl={person.avatarUrl}
        avatarPreset={person.avatarPreset}
        userImage={person.userImage}
        frame={person.equippedFrame ?? null}
        displayName={person.displayName}
        size="sm"
      />
      <p className="flex min-w-0 flex-1 items-center text-sm font-semibold">
        <span className="truncate">{person.displayName}</span>
        <YouChip />
      </p>
      <span className="shrink-0 text-xs text-muted-foreground">{text}</span>
    </li>
  );
}

export function LeaderboardBoard({
  entries,
  highlightStudentId = null,
  linkTarget,
  emptyText,
  self = null
}: {
  entries: LeaderboardEntry[];
  highlightStudentId?: string | null;
  linkTarget: LeaderboardLinkTarget;
  emptyText: string;
  // Học viên đang xem — không có trong bảng thì ghim một dòng "Bạn" ở cuối.
  self?: { person: BoardPerson; missingText: string } | null;
}) {
  const topThree = entries.slice(0, 3);
  const rest = entries.slice(3);
  // Thứ tự hiển thị 2 - 1 - 3, chỉ lấy các bục có người.
  const podiumOrder = [1, 0, 2].filter((index) => topThree[index]);
  const selfMissing = self && !entries.some((entry) => entry.studentId === self.person.studentId);

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5">
      {entries.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <>
          <div className="flex items-end justify-center gap-2 sm:gap-4">
            {podiumOrder.map((index) => {
              const entry = topThree[index];
              const style = podiumStyle[index];
              const isYou = entry.studentId === highlightStudentId;

              return (
                <div key={entry.studentId} className="flex w-1/3 min-w-0 max-w-[9rem] flex-col items-center">
                  {index === 0 ? (
                    <span aria-hidden="true" className="text-lg leading-none">
                      👑
                    </span>
                  ) : null}
                  <StudentAvatar
                    avatarUrl={entry.avatarUrl}
                    avatarPreset={entry.avatarPreset}
                    userImage={entry.userImage}
                    frame={entry.equippedFrame ?? null}
                    displayName={entry.displayName}
                    size={style.size}
                    className={`mt-1 ring-4 ${style.ring} ${style.shine}`}
                  />
                  {/* Tên trên bục cho xuống tối đa 2 dòng — tên Việt dài. */}
                  <p className="mt-2 line-clamp-2 max-w-full break-words text-center text-xs font-semibold leading-4">
                    <ProfileLink entry={entry} linkTarget={linkTarget} />
                    {isYou ? <YouChip /> : null}
                  </p>
                  <p className="text-xs font-bold tabular-nums text-primary">{entry.valueText}</p>
                  <div className="mt-1">
                    <LeaderboardChipView chip={entry.chip} />
                  </div>
                  {entry.subText ? (
                    <p className="mt-0.5 text-center text-[11px] text-muted-foreground">{entry.subText}</p>
                  ) : null}
                  <div
                    className={`mt-1.5 flex w-full items-start justify-center rounded-t-lg ${style.pedestal}`}
                  >
                    <span className="mt-1 text-sm font-bold tabular-nums">{entry.rank}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {rest.length > 0 ? (
            <ol className="mt-4 space-y-1.5">
              {rest.map((entry) => (
                <LeaderboardRow
                  key={entry.studentId}
                  entry={entry}
                  isYou={entry.studentId === highlightStudentId}
                  linkTarget={linkTarget}
                />
              ))}
            </ol>
          ) : null}
        </>
      )}

      {self && selfMissing ? (
        <ol className="mt-3">
          <MissingSelfRow person={self.person} text={self.missingText} />
        </ol>
      ) : null}
    </section>
  );
}
