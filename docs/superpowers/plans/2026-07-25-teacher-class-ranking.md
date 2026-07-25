# Bảng xếp hạng lớp cho giáo viên — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Giáo viên mở được `/teacher/ranking`, chọn lớp và thấy đúng bảng xếp hạng mà học viên lớp đó đang thấy.

**Architecture:** Tách phần truy vấn + tính xếp hạng đang nằm inline trong `app/student/ranking/page.tsx` ra `lib/class-ranking.ts`, tách phần vẽ (bục top 3 + bảng) ra `components/class-ranking-board.tsx`. Trang học viên và trang giáo viên mới đều gọi hai module này, nên hai bên không thể lệch nhau. Chọn lớp bằng form GET thuần (`?classId=`), không cần client component.

**Tech Stack:** Next.js 14 App Router (server components), Prisma, TypeScript strict, Tailwind, vitest.

## Global Constraints

- Chuỗi hiển thị cho người dùng và comment trong code viết bằng **tiếng Việt**.
- Không đổi `prisma/schema.prisma`, không tạo migration.
- Không đổi công thức tính điểm (`lib/ranking.ts`, `lib/student-score.ts`, `lib/band-score.ts`).
- Giao diện trang `/student/ranking` phải giữ nguyên hệt như trước.
- Mọi trang trong `app/teacher/` bắt đầu bằng `requireTeacher()` từ `@/lib/actions/classes`.
- Path alias `@/*` trỏ về gốc repo; test import bằng đường dẫn tương đối (`../lib/...`) theo đúng kiểu các file trong `tests/`.
- Chạy lệnh bằng **pnpm**.

---

### Task 1: `lib/class-ranking.ts` — logic xếp hạng dùng chung

**Files:**
- Create: `lib/class-ranking.ts`
- Test: `tests/class-ranking.test.ts`

**Interfaces:**
- Consumes: `studentRankingScore` từ `@/lib/student-score`; `attemptBand`, `averageBand` từ `@/lib/band-score`; `prisma` từ `@/lib/prisma`.
- Produces:
  - `type RankedClassStudent = { id: string; displayName: string; avatarUrl: string | null; averageScorePercent: number; averageBandValue: number | null; completionRate: number; recentActivityPercent: number; rankingScore: number }`
  - `type ClassmateRow = { id: string; displayName: string; avatarUrl: string | null; attempts: Array<{ scorePercent: number | null; startedAt: Date; submittedAt: Date | null; overallBand: number | null; answers: Array<{ isCorrect: boolean | null; skill: string }> }>; statuses: string[] }`
  - `function rankClassmates(rows: ClassmateRow[], now?: Date): RankedClassStudent[]`
  - `async function getClassRanking(classId: string): Promise<RankedClassStudent[]>`

- [ ] **Step 1: Viết test thất bại**

Tạo `tests/class-ranking.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { rankClassmates, type ClassmateRow } from "../lib/class-ranking";

const now = new Date("2026-07-25T10:00:00+07:00");

// Học viên chỉ có 1 lần làm bài cũ (ngoài 7 ngày) -> recentActivityPercent = 0,
// completionRate = 100, nên rankingScore = scorePercent * 0.7 + 20.
function classmate(id: string, displayName: string, scorePercent: number): ClassmateRow {
  return {
    id,
    displayName,
    avatarUrl: null,
    attempts: [
      {
        scorePercent,
        startedAt: new Date("2026-06-01T08:00:00+07:00"),
        submittedAt: new Date("2026-06-01T09:00:00+07:00"),
        overallBand: null,
        answers: []
      }
    ],
    statuses: ["submitted"]
  };
}

describe("rankClassmates", () => {
  it("sắp xếp giảm dần theo điểm xếp hạng", () => {
    const ranked = rankClassmates(
      [classmate("a", "An", 50), classmate("b", "Bảo", 90), classmate("c", "Cường", 70)],
      now
    );

    expect(ranked.map((student) => student.displayName)).toEqual(["Bảo", "Cường", "An"]);
    // 90*0.7 + 100*0.2 + 0*0.1 = 63 + 20 = 83
    expect(ranked[0].rankingScore).toBe(83);
    expect(ranked[0].completionRate).toBe(100);
    expect(ranked[0].recentActivityPercent).toBe(0);
  });

  it("hoà điểm thì xếp theo tên", () => {
    const ranked = rankClassmates(
      [classmate("y", "Yến", 80), classmate("a", "An", 80)],
      now
    );

    expect(ranked.map((student) => student.displayName)).toEqual(["An", "Yến"]);
  });

  it("không đủ điều kiện quy đổi band -> averageBandValue null, vẫn giữ %", () => {
    const ranked = rankClassmates([classmate("a", "An", 60)], now);

    expect(ranked[0].averageBandValue).toBeNull();
    expect(ranked[0].averageScorePercent).toBe(60);
  });

  it("dùng band giáo viên chấm khi có", () => {
    const rows: ClassmateRow[] = [
      {
        id: "a",
        displayName: "An",
        avatarUrl: null,
        attempts: [
          {
            scorePercent: null,
            startedAt: new Date("2026-06-01T08:00:00+07:00"),
            submittedAt: new Date("2026-06-01T09:00:00+07:00"),
            overallBand: 6.5,
            answers: []
          }
        ],
        statuses: ["reviewed"]
      }
    ];

    expect(rankClassmates(rows, now)[0].averageBandValue).toBe(6.5);
  });

  it("lớp rỗng -> mảng rỗng", () => {
    expect(rankClassmates([], now)).toEqual([]);
  });
});
```

- [ ] **Step 2: Chạy test cho thất bại**

```bash
pnpm vitest run tests/class-ranking.test.ts
```

Expected: FAIL — không resolve được `../lib/class-ranking` (`Failed to load url ... lib/class-ranking`).

- [ ] **Step 3: Viết `lib/class-ranking.ts`**

Phần `rankClassmates` bê nguyên phép tính đang có ở `app/student/ranking/page.tsx:126-165`; phần `getClassRanking` bê nguyên truy vấn ở `app/student/ranking/page.tsx:91-124`.

```ts
import { prisma } from "@/lib/prisma";
import { attemptBand, averageBand } from "@/lib/band-score";
import { studentRankingScore } from "@/lib/student-score";

export type RankedClassStudent = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  averageScorePercent: number;
  averageBandValue: number | null;
  completionRate: number;
  recentActivityPercent: number;
  rankingScore: number;
};

// Dữ liệu thô của một học viên trong lớp, đã gỡ khỏi hình dạng Prisma để
// phần tính toán thuần tuý test được mà không cần database.
export type ClassmateRow = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  attempts: Array<{
    scorePercent: number | null;
    startedAt: Date;
    submittedAt: Date | null;
    overallBand: number | null;
    answers: Array<{ isCorrect: boolean | null; skill: string }>;
  }>;
  statuses: string[];
};

// Quy đổi + xếp hạng. Giữ nguyên công thức của trang Xếp hạng học viên.
export function rankClassmates(rows: ClassmateRow[], now?: Date): RankedClassStudent[] {
  return rows
    .map((row) => {
      const scorePercents = row.attempts
        .map((attempt) => attempt.scorePercent)
        .filter((scorePercent): scorePercent is number => scorePercent !== null);
      // Band trung bình: gộp band của từng lần làm (band giáo viên chấm hoặc
      // band tự động bài đủ 40 câu). Không có band nào -> null (hiển thị % thay thế).
      const attemptBands = row.attempts
        .map((attempt) => attemptBand(attempt.overallBand, attempt.answers))
        .filter((band): band is number => band !== null);
      const score = studentRankingScore({
        scorePercents,
        statuses: row.statuses,
        attemptTimes: row.attempts.map((attempt) => ({
          startedAt: attempt.startedAt,
          submittedAt: attempt.submittedAt
        })),
        now
      });

      return {
        id: row.id,
        displayName: row.displayName,
        avatarUrl: row.avatarUrl,
        averageScorePercent: score.averageScorePercent,
        averageBandValue: averageBand(attemptBands),
        completionRate: score.completionRate,
        recentActivityPercent: score.recentActivityPercent,
        rankingScore: score.rankingScore
      };
    })
    .sort((a, b) => b.rankingScore - a.rankingScore || a.displayName.localeCompare(b.displayName));
}

// Nguồn sự thật duy nhất cho bảng xếp hạng, dùng chung cho cả trang học viên
// lẫn trang giáo viên. KHÔNG kiểm tra quyền — trang gọi phải tự kiểm tra.
export async function getClassRanking(classId: string): Promise<RankedClassStudent[]> {
  const classmates = await prisma.classStudent.findMany({
    where: { classId },
    orderBy: { joinedAt: "asc" },
    include: {
      student: {
        include: {
          user: {
            select: { image: true }
          },
          attempts: {
            select: {
              scorePercent: true,
              startedAt: true,
              submittedAt: true,
              review: {
                select: { overallBand: true }
              },
              answers: {
                select: {
                  isCorrect: true,
                  assignableUnit: { select: { skill: true } }
                }
              }
            }
          },
          recipients: {
            select: {
              status: true
            }
          }
        }
      }
    }
  });

  return rankClassmates(
    classmates.map((classmate) => ({
      id: classmate.student.id,
      displayName: classmate.student.displayName,
      avatarUrl: classmate.student.user?.image ?? null,
      attempts: classmate.student.attempts.map((attempt) => ({
        scorePercent: attempt.scorePercent,
        startedAt: attempt.startedAt,
        submittedAt: attempt.submittedAt,
        overallBand: attempt.review?.overallBand ?? null,
        answers: attempt.answers.map((answer) => ({
          isCorrect: answer.isCorrect,
          skill: answer.assignableUnit.skill
        }))
      })),
      statuses: classmate.student.recipients.map((recipient) => recipient.status)
    }))
  );
}
```

- [ ] **Step 4: Chạy test cho xanh**

```bash
pnpm vitest run tests/class-ranking.test.ts
```

Expected: PASS — 5 passed.

- [ ] **Step 5: Commit**

```bash
git add lib/class-ranking.ts tests/class-ranking.test.ts
git commit -m "feat: tach logic xep hang lop ra lib dung chung"
```

---

### Task 2: `components/class-ranking-board.tsx` + rút gọn trang học viên

**Files:**
- Create: `components/class-ranking-board.tsx`
- Modify: `app/student/ranking/page.tsx` (viết lại toàn bộ)

**Interfaces:**
- Consumes: `RankedClassStudent` từ `@/lib/class-ranking` (Task 1); `getClassRanking` (Task 1); `formatBand` từ `@/lib/band-score`; `RankTierBadge` từ `@/components/rank-tier-badge`.
- Produces: `function ClassRankingBoard(props: { students: RankedClassStudent[]; highlightStudentId?: string | null }): JSX.Element` — Task 3 dùng lại, không truyền `highlightStudentId`.

- [ ] **Step 1: Tạo `components/class-ranking-board.tsx`**

Bê nguyên `initials`, `avatarColor`, `AVATAR_COLORS` và toàn bộ JSX bục + bảng từ `app/student/ranking/page.tsx`. Chỉ có hai thay đổi: `student.id` đổi thành prop `highlightStudentId`, và thêm khối lớp rỗng.

```tsx
import { formatBand } from "@/lib/band-score";
import { RankTierBadge } from "@/components/rank-tier-badge";
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

  const topThree = students.slice(0, 3);
  const rest = students.slice(3);

  // Thứ tự hiển thị trực quan: hạng 2 (trái) - hạng 1 (giữa) - hạng 3 (phải).
  // Chỉ lấy các vị trí thực sự có học viên (lớp ít người sẽ có 1-2 bục).
  const podiumOrder = [1, 0, 2].filter((rankIndex) => topThree[rankIndex]);

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
          <div className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-3 border-b border-border bg-muted/50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid-cols-[3.5rem_minmax(0,1fr)_6rem_6rem_6rem_6rem]">
            <span>Hạng</span>
            <span>Học viên</span>
            <span className="hidden md:block">Điểm TB</span>
            <span className="hidden md:block">Hoàn thành</span>
            <span className="hidden md:block">Gần đây</span>
            <span className="hidden md:block">Tổng</span>
          </div>
          <div className="divide-y divide-border">
            {rest.map((rankedStudent, index) => {
              const isHighlighted = rankedStudent.id === highlightStudentId;

              return (
                <article
                  key={rankedStudent.id}
                  className={`grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-3 px-5 py-4 md:grid-cols-[3.5rem_minmax(0,1fr)_6rem_6rem_6rem_6rem] ${
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
                        <span>Hoàn thành: {Math.round(rankedStudent.completionRate)}%</span>
                        <span>Gần đây: {rankedStudent.recentActivityPercent}%</span>
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
                    {Math.round(rankedStudent.completionRate)}%
                  </p>
                  <p className="hidden text-sm tabular-nums md:block">
                    {rankedStudent.recentActivityPercent}%
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
    </>
  );
}
```

- [ ] **Step 2: Viết lại `app/student/ranking/page.tsx`**

Thay toàn bộ nội dung file bằng:

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getClassRanking } from "@/lib/class-ranking";
import { ClassRankingBoard } from "@/components/class-ranking-board";

export default async function StudentRankingPage() {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "student") {
    redirect("/login");
  }

  const student = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, displayName: true }
  });

  if (!student) {
    redirect("/waiting");
  }

  const membership = await prisma.classStudent.findFirst({
    where: { studentId: student.id },
    orderBy: { joinedAt: "desc" },
    include: {
      class: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });

  if (!membership) {
    return (
      <div className="space-y-8">
        <header>
          <p className="text-sm font-semibold text-primary">Bảng xếp hạng lớp</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Xếp hạng</h2>
        </header>
        <div className="rounded-xl border border-border bg-card px-5 py-12 text-center shadow-card">
          <p className="text-sm font-medium">Bạn chưa thuộc lớp nào</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Tham gia một lớp để so sánh tiến độ với các bạn cùng lớp.
          </p>
        </div>
      </div>
    );
  }

  const rankedStudents = await getClassRanking(membership.classId);

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-semibold text-primary">Bảng xếp hạng lớp</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Xếp hạng</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          So sánh tiến độ trong lớp <span className="font-medium text-foreground">{membership.class.name}</span>.
          Điểm xếp hạng kết hợp điểm trung bình, mức độ hoàn thành và hoạt động gần đây.
        </p>
      </header>

      <ClassRankingBoard students={rankedStudents} highlightStudentId={student.id} />
    </div>
  );
}
```

- [ ] **Step 3: Kiểm tra biên dịch + lint**

```bash
pnpm lint
```

Expected: không có lỗi mới. Cảnh báo `@next/next/no-img-element` đã được tắt bằng comment sẵn có trong component.

- [ ] **Step 4: Chạy toàn bộ test**

```bash
pnpm test
```

Expected: PASS toàn bộ. Nếu có test cấu trúc nào grep vào `app/student/ranking/page.tsx` và fail, đọc test đó rồi cập nhật cho trỏ sang file mới — đây là thay đổi có chủ ý.

- [ ] **Step 5: Commit**

```bash
git add components/class-ranking-board.tsx app/student/ranking/page.tsx
git commit -m "refactor: tach bang xep hang thanh component dung chung"
```

---

### Task 3: Trang `/teacher/ranking` + mục trên sidebar

**Files:**
- Create: `app/teacher/ranking/page.tsx`
- Modify: `components/app-shell.tsx:14-21` (mảng `navByRole.teacher`)

**Interfaces:**
- Consumes: `requireTeacher` từ `@/lib/actions/classes`; `getClassRanking` từ `@/lib/class-ranking` (Task 1); `ClassRankingBoard` từ `@/components/class-ranking-board` (Task 2); `prisma` từ `@/lib/prisma`.
- Produces: route `/teacher/ranking?classId=<id>`.

- [ ] **Step 1: Thêm mục "Xếp hạng" vào sidebar giáo viên**

Trong `components/app-shell.tsx`, mảng `navByRole.teacher`, chèn một dòng ngay sau mục *Lớp học*:

```ts
  teacher: [
    { href: "/teacher", label: "Tổng quan", hint: "Bảng điều khiển", icon: "home" },
    { href: "/teacher/classes", label: "Lớp học", hint: "Quản lý học viên", icon: "users" },
    { href: "/teacher/ranking", label: "Xếp hạng", hint: "Bảng xếp hạng lớp", icon: "trophy" },
    { href: "/teacher/materials", label: "Tài liệu", hint: "Kho đề & bài", icon: "book" },
    { href: "/teacher/assignments", label: "Giao bài", hint: "Bài tập về nhà", icon: "clipboard" },
    { href: "/teacher/calendar", label: "Lịch giao bài", hint: "Theo dõi nộp bài", icon: "calendar" },
    { href: "/teacher/review", label: "Chấm bài", hint: "Writing & Speaking", icon: "check" }
  ],
```

Icon `trophy` đã có trong `IconName` và trong hàm `Icon` — không cần sửa gì thêm.

- [ ] **Step 2: Tạo `app/teacher/ranking/page.tsx`**

```tsx
import Link from "next/link";
import { requireTeacher } from "@/lib/actions/classes";
import { prisma } from "@/lib/prisma";
import { getClassRanking } from "@/lib/class-ranking";
import { ClassRankingBoard } from "@/components/class-ranking-board";

type TeacherRankingPageProps = {
  searchParams?: {
    classId?: string;
  };
};

export default async function TeacherRankingPage({ searchParams }: TeacherRankingPageProps) {
  const teacher = await requireTeacher();

  const classes = await prisma.class.findMany({
    where: { teacherId: teacher.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true }
  });

  if (classes.length === 0) {
    return (
      <div className="space-y-8">
        <header>
          <p className="text-sm font-semibold text-primary">Bảng xếp hạng lớp</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Xếp hạng</h2>
        </header>
        <div className="rounded-xl border border-border bg-card px-5 py-12 text-center shadow-card">
          <p className="text-sm font-medium">Chưa có lớp học nào</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Tạo lớp và thêm học viên để xem bảng xếp hạng.
          </p>
          <Link
            href="/teacher/classes"
            className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-card transition hover:bg-primary/90"
          >
            Tới trang Lớp học
          </Link>
        </div>
      </div>
    );
  }

  // Chỉ chọn trong danh sách đã lọc theo teacherId, nên id lạ hoặc lớp của giáo
  // viên khác đều rơi về lớp đầu tiên — không có đường xem lớp người khác.
  const selectedClass =
    classes.find((classItem) => classItem.id === searchParams?.classId) ?? classes[0];

  const rankedStudents = await getClassRanking(selectedClass.id);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-primary">Bảng xếp hạng lớp</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Xếp hạng</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Đây là bảng xếp hạng mà học viên lớp{" "}
            <span className="font-medium text-foreground">{selectedClass.name}</span> đang nhìn thấy.
            Điểm xếp hạng kết hợp điểm trung bình, mức độ hoàn thành và hoạt động gần đây.
          </p>
        </div>

        <form method="get" className="flex shrink-0 items-end gap-2">
          <label className="block text-sm font-medium">
            <span className="mb-2 block">Chọn lớp</span>
            <select
              name="classId"
              defaultValue={selectedClass.id}
              className="w-56 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/40 focus:border-primary focus:ring-2"
            >
              {classes.map((classItem) => (
                <option key={classItem.id} value={classItem.id}>
                  {classItem.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-card transition hover:bg-primary/90"
          >
            Xem
          </button>
        </form>
      </header>

      <ClassRankingBoard students={rankedStudents} />
    </div>
  );
}
```

- [ ] **Step 3: Lint + test**

```bash
pnpm lint
```

Expected: không lỗi mới.

```bash
pnpm test
```

Expected: PASS toàn bộ.

- [ ] **Step 4: Commit**

```bash
git add app/teacher/ranking/page.tsx components/app-shell.tsx
git commit -m "feat: trang xep hang lop cho giao vien"
```

---

### Task 4: Kiểm chứng trên trình duyệt rồi push

**Files:** không sửa file nào (trừ khi phát hiện lỗi).

**Interfaces:**
- Consumes: toàn bộ Task 1-3.
- Produces: bằng chứng hai trang khớp nhau, và commit đã lên nhánh `feature/ielts-platform-mvp`.

- [ ] **Step 1: Build thật**

```bash
pnpm build
```

Expected: build thành công, trong danh sách route có `/teacher/ranking`.

- [ ] **Step 2: Chạy dev server và mở trang giáo viên**

Dùng `preview_start` với `.claude/launch.json` (KHÔNG chạy dev server bằng Bash). Mở `/teacher/ranking`.

Trang giáo viên cần đăng nhập bằng tài khoản giáo viên. Claude không tự nhập được mật khẩu — nhờ thầy/cô đăng nhập giúp rồi mới thao tác tiếp (xem memory `browser-verify-needs-user-login`).

- [ ] **Step 3: Đối chiếu với trang học viên**

Mở `/teacher/ranking` chọn lớp *test*, ghi lại thứ tự tên và số điểm của từng học viên. So với ảnh chụp `/student/ranking` của lớp đó (lớp *test*: Minh 43 điểm hạng 1, Linh 20 điểm hạng 2).

Expected: cùng thứ tự, cùng số điểm, cùng bậc huy hiệu. Khác biệt duy nhất được phép: bên giáo viên không có nhãn "Bạn" và không có dòng nào bị tô nền.

- [ ] **Step 4: Kiểm lỗi console**

Dùng `read_console_messages` với `onlyErrors: true`.

Expected: không có lỗi.

- [ ] **Step 5: Kiểm chọn lớp và id lạ**

Đổi lớp trong ô chọn rồi bấm "Xem" — URL thành `/teacher/ranking?classId=<id>`, bảng đổi theo. Sau đó mở thẳng `/teacher/ranking?classId=khong-ton-tai`.

Expected: không lỗi 500, hiện lớp đầu danh sách.

- [ ] **Step 6: Chụp màn hình cho thầy/cô xem**

`computer` với `action: "screenshot"`.

- [ ] **Step 7: Push**

```bash
git push origin feature/ielts-platform-mvp
```

Vercel tự động deploy nhánh này. Sau khi deploy xong, mở lại `/teacher/ranking` trên bản production để chắc chắn (xem memory `use-vercel-neon-to-verify`).

---

## Ghi chú khi thực thi

- Không có thay đổi schema, nên **không cần** đụng tới `scripts/ensure-db.mjs`.
- Nếu bước nào phát hiện trang học viên trông khác trước, dừng lại và đối chiếu với bản gốc trong git (`git show d7b71b53:app/student/ranking/page.tsx` — commit spec, ngay trước khi đụng code) — mục tiêu là bê nguyên văn, không phải sửa đẹp thêm.
