import Link from "next/link";
import { bandsBySkill, formatBand, SKILL_SHORT_LABELS } from "@/lib/band-score";
import { formatDuration } from "@/lib/format-duration";
import { isSubmittedAttempt, type PracticeSetGroup } from "@/lib/practice-progress";

type StudentPracticeHistoryProps = {
  groups: PracticeSetGroup[];
  // Đáp án đã gộp thành band sẵn ở phía trang (theo attemptId) để component chỉ lo vẽ.
  bandsByAttempt: Map<string, ReturnType<typeof bandsBySkill>>;
};

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(value);
}

// Nhãn điểm của một lượt: "30/40 câu · 75%". Bài Viết/Nói chờ chấm không có gì để hiện.
function scoreLabel(score: number | null, scorePercent: number | null): string | null {
  if (scorePercent === null) {
    return null;
  }

  const percent = `${scorePercent.toFixed(1)}%`;

  // Ngoặc đơn chứ không phải dấu chấm giữa: "cao nhất 1 câu đúng · 10.0%" đọc như
  // hai thông tin rời, trong khi phần trăm chỉ là cách nói khác của số câu đúng.
  return score === null ? percent : `${Math.round(score)} câu đúng (${percent})`;
}

export function StudentPracticeHistory({ groups, bandsByAttempt }: StudentPracticeHistoryProps) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
      <div className="border-b border-border px-5 py-4">
        <h3 className="text-base font-semibold">Tự luyện</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Các đề học viên tự chọn luyện thêm trong thư viện — không phải bài cô giao.
        </p>
      </div>

      <div className="divide-y divide-border">
        {groups.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            Học viên chưa tự luyện đề nào.
          </p>
        ) : (
          groups.map((group) => {
            const best = scoreLabel(group.bestScore, group.bestPercent);

            return (
              <details key={group.assignmentId} className="px-5 py-4">
                <summary className="cursor-pointer list-none">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-semibold">{group.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {group.submittedCount} lượt đã nộp
                        {best ? ` · cao nhất ${best}` : ""} · gần nhất {formatDate(group.lastAt)}
                      </p>
                    </div>
                    {group.inProgressCount > 0 ? (
                      <span className="inline-flex w-fit shrink-0 rounded-full border border-amber-400/60 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
                        Đang làm dở
                      </span>
                    ) : null}
                  </div>
                </summary>

                <div className="mt-4 grid gap-3">
                  {group.attempts.map((attempt) => {
                    const bands = (bandsByAttempt.get(attempt.id) ?? []).filter(
                      (row) => row.band !== null
                    );
                    const submitted = isSubmittedAttempt(attempt.status);
                    const label = scoreLabel(attempt.score, attempt.scorePercent);

                    return (
                      <div
                        key={attempt.id}
                        className="rounded-lg border border-border bg-muted/60 p-3"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold">
                              Lượt {attempt.attemptRound}
                              {submitted ? "" : " · đang làm dở"}
                              {label ? ` · ${label}` : ""}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {submitted && attempt.submittedAt
                                ? `Nộp ${formatDate(attempt.submittedAt)}`
                                : `Bắt đầu ${formatDate(attempt.startedAt)}`}
                              {" · ⏱ "}
                              {formatDuration(attempt.elapsedSeconds)}
                            </p>
                          </div>
                          {submitted ? (
                            <Link
                              href={`/teacher/results/${attempt.id}`}
                              className="inline-flex w-fit shrink-0 items-center rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-primary transition hover:border-primary"
                            >
                              Xem bài
                            </Link>
                          ) : null}
                        </div>

                        {bands.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {bands.map((row) => (
                              <span
                                key={row.skill}
                                className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary"
                              >
                                {SKILL_SHORT_LABELS[row.skill] ?? row.skill}: Band{" "}
                                {formatBand(row.band)}
                                <span className="font-normal text-muted-foreground">
                                  ({row.correct}/{row.total})
                                </span>
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </details>
            );
          })
        )}
      </div>
    </section>
  );
}
