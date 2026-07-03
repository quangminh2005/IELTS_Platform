# Danh sách theo ngày + trang kết quả chi tiết L/R Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay lịch tháng ở `/teacher/calendar` bằng danh sách bài nhóm theo ngày, bấm thẻ để mở rộng chi tiết học viên ngay dưới thẻ; và thêm trang `/teacher/results/[attemptId]` để giáo viên xem kết quả chi tiết từng câu của bài Listening/Reading (tái dùng `ResultReview`).

**Architecture:** Giữ nguyên server query `app/teacher/calendar/page.tsx` và các type/helper thuần trong `lib/assignment-calendar.ts`; chỉ thêm một helper gom-ngày-giảm-dần và viết lại client component `components/assignment-calendar.tsx` thành danh sách accordion. Thêm một server route đọc-only tái dùng `ResultReview` cho giáo viên. Nút "Xem bài" trỏ sang route kết quả mới.

**Tech Stack:** Next.js 14 App Router (server + client components), TypeScript strict, Prisma/PostgreSQL, Tailwind, vitest.

## Global Constraints

- Chuỗi hiển thị và comment: **tiếng Việt**.
- Route giáo viên gọi `requireTeacher()` (`lib/actions/classes.ts`) đầu tiên; query Prisma scope theo `teacher.id`.
- Không đổi schema Prisma. Không đổi luồng chấm Writing/Speaking (`/teacher/review/*`, "Chấm bài").
- Múi giờ nghiệp vụ Việt Nam **UTC+7** (không DST).
- Tái dùng `lib/band-score.ts` (`formatBand` qua `formatAttemptResult`), `lib/format-duration.ts` (`formatDuration`), và component `components/result-review.tsx` — không viết lại.
- Package manager **pnpm**. Test: `npx vitest run <file>`; build: `pnpm build`; lint: `npx next lint`.
- Mọi commit kết thúc bằng trailer:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- Nhánh `feature/ielts-platform-mvp`. Commit local từng task; **không tự push** trừ khi người dùng yêu cầu.
- Mỗi commit phải build/test xanh (không commit trạng thái đỏ).

## File Structure

- Modify `lib/assignment-calendar.ts` — thêm `groupAssignmentsByDayDescending`; (Task 4) xóa `buildMonthGrid`.
- Modify `tests/assignment-calendar.test.ts` — thêm test cho helper mới; (Task 4) xóa test `buildMonthGrid`.
- Create `app/teacher/results/[attemptId]/page.tsx` — trang kết quả chi tiết cho giáo viên.
- Modify `tests/teacher-calendar.test.ts` — thêm assertion route kết quả tồn tại.
- Modify `components/assignment-calendar.tsx` — viết lại thành danh sách theo ngày + accordion; wire "Xem bài" → `/teacher/results/{id}`.

Thứ tự task giữ mọi commit xanh: helper mới (giữ `buildMonthGrid`) → route kết quả → viết lại component (thôi dùng `buildMonthGrid`) → xóa `buildMonthGrid` (đã hết chỗ dùng).

---

### Task 1: Helper gom bài theo ngày (giảm dần)

**Files:**
- Modify: `lib/assignment-calendar.ts`
- Test: `tests/assignment-calendar.test.ts`

**Interfaces:**
- Consumes: `bucketAssignmentsByDay`, `CalendarAssignment`, `CalendarMode` (đã có).
- Produces: `groupAssignmentsByDayDescending(assignments: CalendarAssignment[], mode: CalendarMode): Array<{ dayKey: string; assignments: CalendarAssignment[] }>` — ngày dạng `'YYYY-MM-DD'`, sắp xếp giảm dần.

- [ ] **Step 1: Viết test thất bại**

Mở `tests/assignment-calendar.test.ts`, thêm import `groupAssignmentsByDayDescending` vào dòng import từ `"../lib/assignment-calendar"` đã có ở đầu file (giữ nguyên các import khác), rồi thêm khối test này vào cuối file:

```ts
describe("groupAssignmentsByDayDescending", () => {
  const a = {
    id: "a",
    title: "a",
    createdAt: "2026-07-02T18:00:00.000Z", // 03/07 giờ VN
    deadline: "2026-07-05T16:59:00.000Z",
    unitCount: 1,
    recipients: []
  };
  const b = {
    id: "b",
    title: "b",
    createdAt: "2026-07-03T20:00:00.000Z", // 04/07 giờ VN
    deadline: null,
    unitCount: 1,
    recipients: []
  };

  it("gom theo ngày giao và sắp xếp ngày giảm dần", () => {
    const days = groupAssignmentsByDayDescending([a, b], "assigned");
    expect(days.map((d) => d.dayKey)).toEqual(["2026-07-04", "2026-07-03"]);
    expect(days[1].assignments.map((x) => x.id)).toEqual(["a"]);
  });

  it("chế độ hạn nộp bỏ bài không có hạn", () => {
    const days = groupAssignmentsByDayDescending([a, b], "deadline");
    expect(days.map((d) => d.dayKey)).toEqual(["2026-07-05"]);
    expect(days[0].assignments.map((x) => x.id)).toEqual(["a"]);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npx vitest run tests/assignment-calendar.test.ts`
Expected: FAIL — `groupAssignmentsByDayDescending` chưa export.

- [ ] **Step 3: Viết cài đặt tối thiểu**

Thêm vào cuối `lib/assignment-calendar.ts`:

```ts
// Gom bài theo ngày rồi trả về danh sách ngày sắp xếp giảm dần (mới nhất trước),
// dùng cho màn danh sách bài theo ngày của giáo viên.
export function groupAssignmentsByDayDescending(
  assignments: CalendarAssignment[],
  mode: CalendarMode
): Array<{ dayKey: string; assignments: CalendarAssignment[] }> {
  const map = bucketAssignmentsByDay(assignments, mode);

  return [...map.keys()]
    .sort((a, b) => b.localeCompare(a))
    .map((dayKey) => ({ dayKey, assignments: map.get(dayKey) ?? [] }));
}
```

- [ ] **Step 4: Chạy test để xác nhận đạt**

Run: `npx vitest run tests/assignment-calendar.test.ts`
Expected: PASS (tất cả describe xanh, gồm cả các test cũ).

- [ ] **Step 5: Commit**

```bash
git add lib/assignment-calendar.ts tests/assignment-calendar.test.ts
git commit -m "feat: ham gom bai theo ngay giam dan cho man danh sach

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Trang kết quả chi tiết cho giáo viên

**Files:**
- Create: `app/teacher/results/[attemptId]/page.tsx`
- Test: `tests/teacher-calendar.test.ts`

**Interfaces:**
- Consumes: `requireTeacher` (`@/lib/actions/classes`), `prisma` (`@/lib/prisma`), `formatDuration` (`@/lib/format-duration`), `ResultReview` (`@/components/result-review`).
- Produces: route `/teacher/results/[attemptId]` (default export server component).

Ghi chú: `ResultReview` nhận prop `attempt` gồm `score`, `scorePercent`, `status`, `answers[]`, `highlights[]`, `review?`. Dùng `include` ở cấp `attempt` (không `select`) nên mọi trường scalar (score/scorePercent/status/elapsedSeconds…) tự có. Query dưới đây sao đúng theo trang kết quả học viên `app/student/results/[attemptId]/page.tsx`, chỉ khác: scope theo `teacherId` và header của giáo viên.

- [ ] **Step 1: Viết test cấu trúc thất bại**

Mở `tests/teacher-calendar.test.ts`. Thêm một `it(...)` mới vào trong `describe("teacher calendar wiring", ...)` (giữ nguyên các test hiện có; `existsSync` đã được import từ task trước):

```ts
  it("có route xem kết quả chi tiết cho giáo viên", () => {
    expect(existsSync(join(root, "app/teacher/results/[attemptId]/page.tsx"))).toBe(true);
  });
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npx vitest run tests/teacher-calendar.test.ts`
Expected: FAIL — route chưa tồn tại.

- [ ] **Step 3: Tạo trang kết quả**

Tạo `app/teacher/results/[attemptId]/page.tsx`:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { ResultReview } from "@/components/result-review";
import { requireTeacher } from "@/lib/actions/classes";
import { formatDuration } from "@/lib/format-duration";
import { prisma } from "@/lib/prisma";

type ResultPageProps = {
  params: {
    attemptId: string;
  };
};

export default async function TeacherResultPage({ params }: ResultPageProps) {
  const teacher = await requireTeacher();

  const attempt = await prisma.attempt.findFirst({
    where: {
      id: params.attemptId,
      status: { in: ["submitted", "reviewed"] },
      assignmentRecipient: {
        assignment: { teacherId: teacher.id }
      }
    },
    include: {
      student: {
        select: { displayName: true, email: true }
      },
      assignmentRecipient: {
        include: {
          assignment: { select: { title: true } }
        }
      },
      review: {
        select: {
          overallBand: true,
          criteriaScoresJson: true,
          summaryFeedback: true,
          detailedFeedback: true
        }
      },
      answers: {
        orderBy: { createdAt: "asc" },
        include: {
          question: {
            select: { order: true, prompt: true, points: true }
          },
          assignableUnit: {
            select: { title: true, skill: true }
          },
          annotations: {
            orderBy: { startOffset: "asc" },
            select: {
              id: true,
              startOffset: true,
              endOffset: true,
              quote: true,
              note: true
            }
          }
        }
      },
      highlights: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          selectedText: true,
          color: true,
          note: true,
          sourceType: true
        }
      }
    }
  });

  if (!attempt) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-primary">Kết quả học viên</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            {attempt.assignmentRecipient.assignment.title}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {attempt.student.displayName} ({attempt.student.email}) · ⏱ Thời gian làm:{" "}
            {formatDuration(attempt.elapsedSeconds)}
          </p>
        </div>
        <Link
          href="/teacher/calendar"
          className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-primary transition hover:border-primary"
        >
          ← Về Lịch giao bài
        </Link>
      </header>

      <ResultReview attempt={attempt} />
    </div>
  );
}
```

- [ ] **Step 4: Chạy test cấu trúc + build**

Run: `npx vitest run tests/teacher-calendar.test.ts`
Expected: PASS (route tồn tại).

Run: `pnpm build`
Expected: build thành công, `/teacher/results/[attemptId]` trong route manifest, không lỗi TypeScript (prop `attempt` khớp `ResultReviewProps` — giống trang kết quả học viên). Nếu TS báo thiếu trường ở prop `attempt`, đối chiếu include với `app/student/results/[attemptId]/page.tsx` và bổ sung cho khớp `ResultReviewProps` trong `components/result-review.tsx` — không đổi `ResultReview`.

- [ ] **Step 5: Commit**

```bash
git add app/teacher/results/[attemptId]/page.tsx tests/teacher-calendar.test.ts
git commit -m "feat: trang xem ket qua chi tiet bai lam cho giao vien

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Viết lại client component thành danh sách theo ngày

**Files:**
- Modify: `components/assignment-calendar.tsx` (thay toàn bộ nội dung)

**Interfaces:**
- Consumes: từ `@/lib/assignment-calendar`: `groupAssignmentsByDayDescending`, `isSubmissionLate`, `studentsGroupedByClass`, `formatAttemptResult`, types `CalendarAssignment`/`CalendarClass`/`CalendarMode`/`CalendarRecipient`; từ `@/lib/format-duration`: `formatDuration`. Route kết quả `/teacher/results/{id}` (Task 2).
- Produces: giữ export `export function AssignmentCalendar({ assignments, classes }: { assignments: CalendarAssignment[]; classes: CalendarClass[] })` (server page `/teacher/calendar/page.tsx` không đổi).

- [ ] **Step 1: Thay toàn bộ nội dung file**

Ghi đè `components/assignment-calendar.tsx` bằng:

```tsx
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatDuration } from "@/lib/format-duration";
import {
  formatAttemptResult,
  groupAssignmentsByDayDescending,
  isSubmissionLate,
  studentsGroupedByClass,
  type CalendarAssignment,
  type CalendarClass,
  type CalendarMode,
  type CalendarRecipient
} from "@/lib/assignment-calendar";

const SUBMITTED = new Set(["submitted", "reviewed"]);

type Props = {
  assignments: CalendarAssignment[];
  classes: CalendarClass[];
};

// dayKey 'YYYY-MM-DD' (giờ VN). Dựng mốc giữa trưa VN để tránh lệch ngày do múi giờ.
function fmtDayHeading(dayKey: string) {
  return new Date(`${dayKey}T12:00:00+07:00`).toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh"
  });
}

function fmtDeadline(iso: string) {
  return new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh"
  });
}

function statusLabel(recipient: CalendarRecipient) {
  if (SUBMITTED.has(recipient.status)) {
    return "Đã nộp";
  }
  if (recipient.attempt?.status === "in_progress") {
    return "Đang làm dở";
  }
  return "Chưa làm";
}

function initials(name: string) {
  return name.trim().slice(0, 2) || "?";
}

export function AssignmentCalendar({ assignments, classes }: Props) {
  const [mode, setMode] = useState<CalendarMode>("assigned");
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    if (!selectedClassId) {
      return assignments;
    }
    return assignments.filter((a) =>
      a.recipients.some((r) => r.classIds.includes(selectedClassId))
    );
  }, [assignments, selectedClassId]);

  const days = useMemo(
    () => groupAssignmentsByDayDescending(filtered, mode),
    [filtered, mode]
  );

  const noDeadlineCount = useMemo(
    () => (mode === "deadline" ? filtered.filter((a) => !a.deadline).length : 0),
    [filtered, mode]
  );

  const toggle = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

  const visibleRecipients = (assignment: CalendarAssignment) =>
    selectedClassId
      ? assignment.recipients.filter((r) => r.classIds.includes(selectedClassId))
      : assignment.recipients;

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex overflow-hidden rounded-lg border border-border text-sm">
          <button
            type="button"
            onClick={() => setMode("assigned")}
            className={
              mode === "assigned"
                ? "bg-primary px-3 py-1.5 font-semibold text-primary-foreground"
                : "px-3 py-1.5 text-muted-foreground"
            }
          >
            Theo ngày giao
          </button>
          <button
            type="button"
            onClick={() => setMode("deadline")}
            className={
              mode === "deadline"
                ? "bg-primary px-3 py-1.5 font-semibold text-primary-foreground"
                : "px-3 py-1.5 text-muted-foreground"
            }
          >
            Theo hạn nộp
          </button>
        </div>

        <select
          value={selectedClassId ?? ""}
          onChange={(event) => setSelectedClassId(event.target.value || null)}
          className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm"
        >
          <option value="">Tất cả lớp</option>
          {classes.map((cls) => (
            <option key={cls.id} value={cls.id}>
              {cls.name}
            </option>
          ))}
        </select>
      </div>

      {noDeadlineCount > 0 ? (
        <p className="text-xs text-muted-foreground">
          {noDeadlineCount} bài chưa đặt hạn nên không hiển thị ở chế độ này.
        </p>
      ) : null}

      {days.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-5 py-12 text-center text-sm text-muted-foreground">
          Chưa có bài nào để hiển thị.
        </div>
      ) : (
        <div className="space-y-6">
          {days.map((day) => (
            <div key={day.dayKey} className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{fmtDayHeading(day.dayKey)}</span>
                <span className="text-xs text-muted-foreground">· {day.assignments.length} bài</span>
              </div>
              <div className="space-y-2">
                {day.assignments.map((assignment) => {
                  const shown = visibleRecipients(assignment);
                  const submitted = shown.filter((r) => SUBMITTED.has(r.status)).length;
                  const open = openIds.has(assignment.id);
                  return (
                    <div
                      key={assignment.id}
                      className="overflow-hidden rounded-xl border border-border bg-card shadow-card"
                    >
                      <button
                        type="button"
                        onClick={() => toggle(assignment.id)}
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-muted/40"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span
                            className={`text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}
                            aria-hidden
                          >
                            ›
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{assignment.title}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {assignment.deadline
                                ? `Hạn nộp ${fmtDeadline(assignment.deadline)}`
                                : "Không đặt hạn"}{" "}
                              · {assignment.unitCount} phần
                            </p>
                          </div>
                        </div>
                        <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                          {submitted}/{shown.length} đã nộp
                        </span>
                      </button>
                      {open ? (
                        <div className="border-t border-border px-4 py-3">
                          <AssignmentDetail
                            assignment={assignment}
                            classes={classes}
                            selectedClassId={selectedClassId}
                          />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function AssignmentDetail({
  assignment,
  classes,
  selectedClassId
}: {
  assignment: CalendarAssignment;
  classes: CalendarClass[];
  selectedClassId: string | null;
}) {
  const groups = studentsGroupedByClass(assignment.recipients, classes, selectedClassId);

  if (groups.length === 0) {
    return <p className="text-sm text-muted-foreground">Không có học viên nào trong lớp đã chọn.</p>;
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.classId ?? "none"} className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {group.className}
          </p>
          {group.students.map((recipient) => (
            <StudentRow key={recipient.studentId} recipient={recipient} assignment={assignment} />
          ))}
        </div>
      ))}
    </div>
  );
}

function StudentRow({
  recipient,
  assignment
}: {
  recipient: CalendarRecipient;
  assignment: CalendarAssignment;
}) {
  const attempt = recipient.attempt;
  const done = SUBMITTED.has(recipient.status) && attempt !== null;
  const late = done && attempt ? isSubmissionLate(attempt.submittedAt, assignment.deadline) : false;

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {initials(recipient.displayName)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{recipient.displayName}</p>
            <p className="truncate text-[11px] text-muted-foreground">{recipient.email}</p>
          </div>
        </div>
        {done && attempt ? (
          <Link
            href={`/teacher/results/${attempt.id}`}
            className="shrink-0 text-xs font-semibold text-primary hover:underline"
          >
            Xem bài →
          </Link>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
        {done && attempt ? (
          <>
            <span
              className={
                late
                  ? "rounded-full bg-red-500/10 px-2 py-0.5 font-medium text-red-600 dark:text-red-300"
                  : "rounded-full bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-600 dark:text-emerald-300"
              }
            >
              {late ? "Trễ hạn" : "Đúng hạn"}
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
              {formatDuration(attempt.elapsedSeconds)}
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
              {formatAttemptResult(attempt)}
            </span>
          </>
        ) : (
          <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
            {statusLabel(recipient)}
          </span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Lint + build**

Run: `npx next lint`
Expected: không lỗi mới trong `components/assignment-calendar.tsx` (không import thừa — đã bỏ `vnDayKey`/`buildMonthGrid`; `attempt` được thu hẹp qua `done && attempt`).

Run: `pnpm build`
Expected: build thành công, không lỗi TypeScript.

- [ ] **Step 3: Commit**

```bash
git add components/assignment-calendar.tsx
git commit -m "feat: doi man lich sang danh sach theo ngay + mo rong chi tiet duoi the

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Xóa `buildMonthGrid` không còn dùng

**Files:**
- Modify: `lib/assignment-calendar.ts` (xóa hàm `buildMonthGrid`)
- Modify: `tests/assignment-calendar.test.ts` (xóa import + test `buildMonthGrid`)

**Interfaces:**
- Sau Task 3, không còn nơi nào import `buildMonthGrid`. Task này dọn code chết.

- [ ] **Step 1: Xác nhận không còn nơi dùng**

Run: `git grep -n buildMonthGrid -- ':!docs' ':!.superpowers'`
Expected: chỉ còn xuất hiện trong `lib/assignment-calendar.ts` (định nghĩa) và `tests/assignment-calendar.test.ts` (import + describe). Không có file `.tsx`/`.ts` nào khác. Nếu còn nơi khác dùng, DỪNG và báo lại (thứ tự task sai).

- [ ] **Step 2: Xóa hàm khỏi lib**

Trong `lib/assignment-calendar.ts`, xóa toàn bộ hàm `buildMonthGrid` (khối `export function buildMonthGrid(year: number, month: number): (string | null)[] { … }` cùng comment ngay trên nó). Giữ nguyên các hàm khác.

- [ ] **Step 3: Xóa test khỏi test file**

Trong `tests/assignment-calendar.test.ts`:
- Bỏ `buildMonthGrid` khỏi danh sách import từ `"../lib/assignment-calendar"` (giữ các import còn lại).
- Xóa nguyên khối `describe("buildMonthGrid", () => { … })`.

- [ ] **Step 4: Chạy test + build**

Run: `npx vitest run tests/assignment-calendar.test.ts`
Expected: PASS, không còn test `buildMonthGrid`, các test khác vẫn xanh.

Run: `pnpm build`
Expected: build thành công (không còn tham chiếu `buildMonthGrid`).

- [ ] **Step 5: Commit**

```bash
git add lib/assignment-calendar.ts tests/assignment-calendar.test.ts
git commit -m "refactor: xoa buildMonthGrid khong con dung sau khi bo lich thang

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Kiểm thử tổng thể & xác minh

**Files:** (không sửa — chỉ xác minh)

- [ ] **Step 1: Toàn bộ test + lint + build**

Run: `pnpm test && npx next lint && pnpm build`
Expected: tất cả test PASS; lint chỉ còn cảnh báo cũ không liên quan (`<img>` ở trang login); build thành công với cả `/teacher/calendar` và `/teacher/results/[attemptId]`.

- [ ] **Step 2: Xác minh preview (đăng nhập giáo viên)**

- Mở "Lịch giao bài": thấy **danh sách nhóm theo ngày**, không còn lịch tháng; tiêu đề ngày tiếng Việt; thẻ bài hiện `đã nộp/tổng`.
- Đổi toggle ngày giao/hạn nộp và lọc lớp → danh sách cập nhật đúng; bài không hạn có ghi chú ở chế độ hạn nộp.
- Bấm một thẻ → mở rộng chi tiết học viên ngay dưới (nhóm theo lớp, gồm "Chưa làm"); bấm lại → đóng; mở nhiều thẻ độc lập.
- Bấm "Xem bài →" trên một bài **Listening/Reading** đã nộp → mở `/teacher/results/{id}` thấy **từng câu đúng/sai, đáp án, giải thích, band theo kỹ năng** (không còn "Không tìm thấy bài làm Writing/Speaking").

Nếu chưa có dữ liệu, seed hoặc để học viên nộp một bài L/R.

- [ ] **Step 3: Commit (chỉ khi phải sửa lúc xác minh)**

```bash
git commit -m "fix: <mo ta> man danh sach/ket qua giao vien

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- Bỏ lịch, danh sách theo ngày + accordion mở dưới thẻ → Task 1 (helper) + Task 3 (component). ✓
- Giữ toggle/lọc lớp/nội dung chi tiết học viên (trạng thái, đúng/trễ, thời gian, kết quả) → Task 3 (tái dùng `isSubmissionLate`/`studentsGroupedByClass`/`formatAttemptResult`/`formatDuration`). ✓
- Ghi chú "N bài chưa đặt hạn" ở chế độ hạn nộp → Task 3. ✓
- Trang kết quả chi tiết L/R cho giáo viên, tái dùng `ResultReview`, scope quyền → Task 2. ✓
- "Xem bài" trỏ `/teacher/results/{id}` → Task 3. ✓
- Xóa `buildMonthGrid` + test → Task 4. ✓
- Không đổi schema; không đổi luồng chấm W/S; server query `/teacher/calendar` giữ nguyên → không task nào đụng. ✓
- Kiểm thử: unit helper mới (Task 1), structural route (Task 2), xóa test cũ (Task 4), preview (Task 5). ✓

**Placeholder scan:** Không có TBD/TODO; mọi step có code/command cụ thể. ✓

**Type consistency:** `groupAssignmentsByDayDescending` trả `Array<{ dayKey: string; assignments: CalendarAssignment[] }>` — Task 3 tiêu thụ đúng (`day.dayKey`, `day.assignments`). Component giữ export `AssignmentCalendar({ assignments, classes })` khớp server page không đổi. `ResultReview` prop `attempt` khớp include của Task 2 (giống trang kết quả học viên). ✓
