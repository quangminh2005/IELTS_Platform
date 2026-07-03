# Lịch giao bài & theo dõi nộp bài Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm màn hình "Lịch giao bài" cho giáo viên để xem lịch tháng các bài đã giao (theo ngày giao hoặc hạn nộp), lọc theo lớp, và bấm vào một bài để xem panel chi tiết từng học viên: ai đã nộp, đúng/trễ hạn, thời gian làm, kết quả (band + số câu đúng).

**Architecture:** Một route server component `app/teacher/calendar/page.tsx` truy vấn Prisma và chuẩn hóa dữ liệu, truyền xuống một client component `components/assignment-calendar.tsx` lo toàn bộ tương tác (chọn tháng, đổi chế độ, lọc lớp, mở panel). Logic thuần (xếp ngày theo giờ VN, dựng lưới lịch, đúng/trễ hạn, đếm câu đúng, gom nhóm theo lớp, format kết quả) tách ra `lib/assignment-calendar.ts` và được test bằng vitest. Không đổi schema Prisma.

**Tech Stack:** Next.js 14 App Router (server + client components), TypeScript strict, Prisma/PostgreSQL, Tailwind, vitest.

## Global Constraints

- Chuỗi hiển thị và comment: **tiếng Việt**, khớp các file hiện có.
- Mọi server action/route giáo viên gọi `requireTeacher()` (`lib/actions/classes.ts`) đầu tiên; query Prisma phải scope theo `teacher.id`.
- Không thêm Prisma enum — enum là cột `String`.
- Múi giờ nghiệp vụ: Việt Nam **UTC+7** (không DST). Hằng số `+07:00`.
- Kết quả tái dùng `lib/band-score.ts` (`attemptBand`, `formatBand`) và `lib/format-duration.ts` (`formatDuration`) — không viết lại logic band/thời gian.
- Package manager: **pnpm**. Chạy test: `npx vitest run <file>`; build: `pnpm build`; lint: `pnpm lint`.
- Mọi commit kết thúc bằng dòng trailer:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- Đang ở nhánh `feature/ielts-platform-mvp`. Commit local từng task; **không tự push** (push sẽ auto-deploy Vercel) trừ khi người dùng yêu cầu.

## File Structure

- Create `lib/assignment-calendar.ts` — kiểu dữ liệu chia sẻ server↔client + hàm thuần: `vnDayKey`, `bucketAssignmentsByDay`, `buildMonthGrid`, `isSubmissionLate`, `countGradedAnswers`, `studentsGroupedByClass`, `formatAttemptResult`.
- Create `tests/assignment-calendar.test.ts` — unit test cho các hàm thuần trên.
- Modify `app/teacher/review/page.tsx` — dùng chung `isSubmissionLate` thay cho logic `isLate` viết tay.
- Modify `components/app-shell.tsx` — thêm icon `"calendar"` và mục nav "Lịch giao bài".
- Create `app/teacher/calendar/page.tsx` — server component: truy vấn + chuẩn hóa + render client component.
- Create `components/assignment-calendar.tsx` — client component: lịch + panel chi tiết.
- Create `tests/teacher-calendar.test.ts` — test cấu trúc: nav item + route tồn tại.

---

### Task 1: Hàm thuần xếp ngày & lưới lịch

**Files:**
- Create: `lib/assignment-calendar.ts`
- Test: `tests/assignment-calendar.test.ts`

**Interfaces:**
- Produces:
  - Types: `CalendarClass`, `CalendarAttempt`, `CalendarRecipient`, `CalendarAssignment`, `CalendarMode` (`"assigned" | "deadline"`), `ClassGroup`.
  - `vnDayKey(iso: string): string` — trả về `'YYYY-MM-DD'` theo lịch VN.
  - `bucketAssignmentsByDay(assignments: CalendarAssignment[], mode: CalendarMode): Map<string, CalendarAssignment[]>`.
  - `buildMonthGrid(year: number, month: number): (string | null)[]` — `month` 0-indexed; ô trống = `null`, ô ngày = `'YYYY-MM-DD'`, tuần bắt đầu Thứ Hai, tổng ô chia hết cho 7.

- [ ] **Step 1: Viết test thất bại**

Tạo `tests/assignment-calendar.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  vnDayKey,
  bucketAssignmentsByDay,
  buildMonthGrid,
  type CalendarAssignment
} from "../lib/assignment-calendar";

function fakeAssignment(
  id: string,
  createdAt: string,
  deadline: string | null
): CalendarAssignment {
  return { id, title: id, createdAt, deadline, unitCount: 1, recipients: [] };
}

describe("vnDayKey", () => {
  it("chuyển mốc UTC sang ngày theo lịch Việt Nam (UTC+7)", () => {
    // 18:00Z ngày 02/07 => 01:00 ngày 03/07 giờ VN
    expect(vnDayKey("2026-07-02T18:00:00.000Z")).toBe("2026-07-03");
  });
});

describe("bucketAssignmentsByDay", () => {
  const a = fakeAssignment("a", "2026-07-02T18:00:00.000Z", "2026-07-05T16:59:00.000Z");
  const b = fakeAssignment("b", "2026-07-03T02:00:00.000Z", null);

  it("xếp theo ngày giao (giờ VN)", () => {
    const map = bucketAssignmentsByDay([a, b], "assigned");
    expect(map.get("2026-07-03")?.map((x) => x.id)).toEqual(["a", "b"]);
  });

  it("xếp theo hạn nộp và bỏ bài không có hạn", () => {
    const map = bucketAssignmentsByDay([a, b], "deadline");
    expect(map.get("2026-07-05")?.map((x) => x.id)).toEqual(["a"]);
    expect([...map.values()].flat().map((x) => x.id)).toEqual(["a"]);
  });
});

describe("buildMonthGrid", () => {
  it("chèn ô trống đầu tháng theo tuần bắt đầu Thứ Hai", () => {
    // Tháng 7/2026: ngày 1 là Thứ Tư => 2 ô trống đầu
    const cells = buildMonthGrid(2026, 6);
    expect(cells.slice(0, 4)).toEqual([null, null, "2026-07-01", "2026-07-02"]);
    expect(cells).toContain("2026-07-31");
    expect(cells.length % 7).toBe(0);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npx vitest run tests/assignment-calendar.test.ts`
Expected: FAIL — không import được từ `../lib/assignment-calendar` (module chưa tồn tại).

- [ ] **Step 3: Viết cài đặt tối thiểu**

Tạo `lib/assignment-calendar.ts`:

```ts
// Kiểu dữ liệu và hàm thuần cho màn hình "Lịch giao bài" của giáo viên.
// Toàn bộ ở đây không phụ thuộc Prisma/React để test được và dùng chung
// cho cả server component lẫn client component.

export type CalendarClass = { id: string; name: string };

export type CalendarAttempt = {
  id: string;
  status: string; // in_progress | submitted | reviewed
  submittedAt: string | null; // ISO
  elapsedSeconds: number;
  band: number | null;
  correct: number;
  total: number;
  scorePercent: number | null;
  hasPendingManual: boolean; // còn câu Writing/Speaking chưa chấm
};

export type CalendarRecipient = {
  studentId: string;
  displayName: string;
  email: string;
  classIds: string[];
  status: string; // assigned | in_progress | submitted | reviewed
  attempt: CalendarAttempt | null;
};

export type CalendarAssignment = {
  id: string;
  title: string;
  createdAt: string; // ISO
  deadline: string | null; // ISO
  unitCount: number;
  recipients: CalendarRecipient[];
};

export type CalendarMode = "assigned" | "deadline";

export type ClassGroup = {
  classId: string | null;
  className: string;
  students: CalendarRecipient[];
};

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

// 'YYYY-MM-DD' theo lịch Việt Nam (UTC+7) từ một mốc ISO.
export function vnDayKey(iso: string): string {
  return new Date(new Date(iso).getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);
}

// Gom bài vào từng ngày. Chế độ "deadline" bỏ qua bài không có hạn nộp.
export function bucketAssignmentsByDay(
  assignments: CalendarAssignment[],
  mode: CalendarMode
): Map<string, CalendarAssignment[]> {
  const map = new Map<string, CalendarAssignment[]>();

  for (const assignment of assignments) {
    const anchor = mode === "deadline" ? assignment.deadline : assignment.createdAt;
    if (!anchor) {
      continue;
    }
    const key = vnDayKey(anchor);
    const list = map.get(key) ?? [];
    list.push(assignment);
    map.set(key, list);
  }

  return map;
}

// Lưới ô cho lịch tháng, tuần bắt đầu Thứ Hai. month 0-indexed.
export function buildMonthGrid(year: number, month: number): (string | null)[] {
  const firstDow = new Date(Date.UTC(year, month, 1)).getUTCDay(); // 0=CN..6=T7
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const leading = (firstDow + 6) % 7; // số ô trống trước ngày 1 (Thứ Hai = 0)

  const cells: (string | null)[] = [];
  for (let i = 0; i < leading; i += 1) {
    cells.push(null);
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    cells.push(key);
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}
```

- [ ] **Step 4: Chạy test để xác nhận đạt**

Run: `npx vitest run tests/assignment-calendar.test.ts`
Expected: PASS (3 describe, tất cả xanh).

- [ ] **Step 5: Commit**

```bash
git add lib/assignment-calendar.ts tests/assignment-calendar.test.ts
git commit -m "feat: ham thuan xep ngay va luoi lich cho man lich giao bai

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Hàm thuần đúng/trễ hạn, đếm câu đúng, gom lớp, format kết quả + refactor trang Chấm bài

**Files:**
- Modify: `lib/assignment-calendar.ts`
- Modify: `app/teacher/review/page.tsx:60-64`
- Test: `tests/assignment-calendar.test.ts`

**Interfaces:**
- Consumes: các type từ Task 1 (`CalendarRecipient`, `CalendarClass`, `ClassGroup`); `formatBand` từ `@/lib/band-score`.
- Produces:
  - `isSubmissionLate(submittedAt: string | Date | null, deadline: string | Date | null): boolean`.
  - `countGradedAnswers(answers: Array<{ isCorrect: boolean | null }>): { correct: number; total: number }`.
  - `studentsGroupedByClass(recipients: CalendarRecipient[], classes: CalendarClass[], selectedClassId: string | null): ClassGroup[]`.
  - `formatAttemptResult(attempt: { band: number | null; correct: number; total: number; scorePercent: number | null; hasPendingManual: boolean; status: string }): string`.

- [ ] **Step 1: Viết test thất bại**

Thêm vào cuối `tests/assignment-calendar.test.ts`:

```ts
import {
  isSubmissionLate,
  countGradedAnswers,
  studentsGroupedByClass,
  formatAttemptResult,
  type CalendarRecipient
} from "../lib/assignment-calendar";

function recip(studentId: string, classIds: string[]): CalendarRecipient {
  return {
    studentId,
    displayName: studentId,
    email: `${studentId}@x.com`,
    classIds,
    status: "assigned",
    attempt: null
  };
}

describe("isSubmissionLate", () => {
  it("trễ khi nộp sau hạn", () => {
    expect(isSubmissionLate("2026-07-05T17:00:00Z", "2026-07-05T16:59:00Z")).toBe(true);
  });
  it("không trễ khi nộp trước hạn", () => {
    expect(isSubmissionLate("2026-07-05T10:00:00Z", "2026-07-05T16:59:00Z")).toBe(false);
  });
  it("không trễ khi thiếu hạn hoặc chưa nộp", () => {
    expect(isSubmissionLate(null, "2026-07-05T16:59:00Z")).toBe(false);
    expect(isSubmissionLate("2026-07-05T10:00:00Z", null)).toBe(false);
  });
});

describe("countGradedAnswers", () => {
  it("chỉ đếm câu đã chấm tự động (isCorrect khác null)", () => {
    const answers = [
      { isCorrect: true },
      { isCorrect: false },
      { isCorrect: true },
      { isCorrect: null } // Writing/Speaking chờ chấm
    ];
    expect(countGradedAnswers(answers)).toEqual({ correct: 2, total: 3 });
  });
});

describe("studentsGroupedByClass", () => {
  const classes = [
    { id: "c1", name: "Lớp 1" },
    { id: "c2", name: "Lớp 2" }
  ];
  const recipients = [recip("a", ["c1"]), recip("b", ["c1", "c2"]), recip("c", [])];

  it("gom theo từng lớp, học viên nhiều lớp xuất hiện ở mỗi lớp", () => {
    const groups = studentsGroupedByClass(recipients, classes, null);
    expect(groups.map((g) => g.className)).toEqual(["Lớp 1", "Lớp 2", "Chưa xếp lớp"]);
    expect(groups[0].students.map((s) => s.studentId)).toEqual(["a", "b"]);
    expect(groups[1].students.map((s) => s.studentId)).toEqual(["b"]);
    expect(groups[2].students.map((s) => s.studentId)).toEqual(["c"]);
  });

  it("lọc theo một lớp thì chỉ trả về học viên lớp đó", () => {
    const groups = studentsGroupedByClass(recipients, classes, "c2");
    expect(groups).toHaveLength(1);
    expect(groups[0].students.map((s) => s.studentId)).toEqual(["b"]);
  });
});

describe("formatAttemptResult", () => {
  const base = { scorePercent: null, hasPendingManual: false, status: "submitted" };
  it("bài đủ 40 câu: band + số câu đúng", () => {
    expect(
      formatAttemptResult({ ...base, band: 8, correct: 35, total: 40 })
    ).toBe("8.0 · 35/40");
  });
  it("bài lẻ không có band: phần trăm + số câu đúng", () => {
    expect(
      formatAttemptResult({ ...base, band: null, correct: 8, total: 10, scorePercent: 80 })
    ).toBe("80% · 8/10");
  });
  it("chỉ có bài chấm tay chưa chấm: Chờ chấm", () => {
    expect(
      formatAttemptResult({ ...base, band: null, correct: 0, total: 0, hasPendingManual: true })
    ).toBe("Chờ chấm");
  });
  it("có phần tự chấm và phần chờ chấm tay", () => {
    expect(
      formatAttemptResult({ ...base, band: 7, correct: 30, total: 40, hasPendingManual: true })
    ).toBe("7.0 · 30/40 · Chờ chấm");
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npx vitest run tests/assignment-calendar.test.ts`
Expected: FAIL — chưa export `isSubmissionLate`, `countGradedAnswers`, `studentsGroupedByClass`, `formatAttemptResult`.

- [ ] **Step 3: Viết cài đặt tối thiểu**

Thêm vào đầu `lib/assignment-calendar.ts` (sau dòng comment mở đầu) import:

```ts
import { formatBand } from "@/lib/band-score";
```

Thêm vào cuối `lib/assignment-calendar.ts`:

```ts
// Nộp trễ hạn? Chỉ đúng khi có cả mốc nộp lẫn hạn và nộp sau hạn.
export function isSubmissionLate(
  submittedAt: string | Date | null,
  deadline: string | Date | null
): boolean {
  if (!submittedAt || !deadline) {
    return false;
  }
  return new Date(submittedAt).getTime() > new Date(deadline).getTime();
}

// Đếm câu đã chấm tự động (Nghe/Đọc). Bỏ câu Writing/Speaking (isCorrect null).
export function countGradedAnswers(
  answers: Array<{ isCorrect: boolean | null }>
): { correct: number; total: number } {
  let correct = 0;
  let total = 0;

  for (const answer of answers) {
    if (answer.isCorrect === null) {
      continue;
    }
    total += 1;
    if (answer.isCorrect) {
      correct += 1;
    }
  }

  return { correct, total };
}

// Gom học viên theo lớp. Lọc theo 1 lớp -> chỉ lớp đó. "Tất cả" -> mỗi lớp có
// học viên nhận bài là một nhóm; học viên không thuộc lớp nào vào "Chưa xếp lớp".
// Học viên thuộc nhiều lớp sẽ xuất hiện ở mỗi nhóm lớp của họ (phản ánh đúng "theo lớp").
export function studentsGroupedByClass(
  recipients: CalendarRecipient[],
  classes: CalendarClass[],
  selectedClassId: string | null
): ClassGroup[] {
  if (selectedClassId) {
    const cls = classes.find((item) => item.id === selectedClassId);
    const students = recipients.filter((r) => r.classIds.includes(selectedClassId));
    return students.length > 0
      ? [{ classId: selectedClassId, className: cls?.name ?? "Lớp", students }]
      : [];
  }

  const groups: ClassGroup[] = [];
  for (const cls of classes) {
    const students = recipients.filter((r) => r.classIds.includes(cls.id));
    if (students.length > 0) {
      groups.push({ classId: cls.id, className: cls.name, students });
    }
  }

  const unassigned = recipients.filter(
    (r) => !classes.some((cls) => r.classIds.includes(cls.id))
  );
  if (unassigned.length > 0) {
    groups.push({ classId: null, className: "Chưa xếp lớp", students: unassigned });
  }

  return groups;
}

// Chuỗi "kết quả" hiển thị: band (hoặc %) + số câu đúng; kèm/hiện "Chờ chấm" cho
// phần chấm tay. Chỉ dùng cho attempt đã nộp/đã chấm.
export function formatAttemptResult(attempt: {
  band: number | null;
  correct: number;
  total: number;
  scorePercent: number | null;
  hasPendingManual: boolean;
  status: string;
}): string {
  if (attempt.status !== "submitted" && attempt.status !== "reviewed") {
    return "—";
  }

  if (attempt.total > 0) {
    const head =
      attempt.band !== null
        ? formatBand(attempt.band)
        : attempt.scorePercent !== null
          ? `${Math.round(attempt.scorePercent)}%`
          : "—";
    const body = `${head} · ${attempt.correct}/${attempt.total}`;
    return attempt.hasPendingManual ? `${body} · Chờ chấm` : body;
  }

  if (attempt.band !== null) {
    return formatBand(attempt.band);
  }
  return "Chờ chấm";
}
```

- [ ] **Step 4: Chạy test để xác nhận đạt**

Run: `npx vitest run tests/assignment-calendar.test.ts`
Expected: PASS (tất cả describe xanh).

- [ ] **Step 5: Refactor trang Chấm bài dùng chung `isSubmissionLate`**

Trong `app/teacher/review/page.tsx`, thêm import ở đầu file (cạnh các import hiện có):

```ts
import { isSubmissionLate } from "@/lib/assignment-calendar";
```

Thay khối tính `isLate` (dòng ~60-64):

```ts
    const isLate = Boolean(
      attempt.submittedAt &&
        assignment.deadline &&
        attempt.submittedAt.getTime() > assignment.deadline.getTime()
    );
```

thành:

```ts
    const isLate = isSubmissionLate(attempt.submittedAt, assignment.deadline);
```

- [ ] **Step 6: Chạy test toàn bộ + typecheck trang Chấm bài**

Run: `npx vitest run tests/assignment-calendar.test.ts && pnpm lint`
Expected: test PASS; lint không lỗi mới ở `app/teacher/review/page.tsx`.

- [ ] **Step 7: Commit**

```bash
git add lib/assignment-calendar.ts tests/assignment-calendar.test.ts app/teacher/review/page.tsx
git commit -m "feat: ham tre han/dem cau dung/gom lop/ket qua + dung chung o trang cham bai

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Thêm icon lịch & mục nav "Lịch giao bài"

**Files:**
- Modify: `components/app-shell.tsx:15-19` (mảng nav teacher), `:28` (type `IconName`), `:41-106` (hàm `Icon`)
- Test: `tests/teacher-calendar.test.ts`

**Interfaces:**
- Produces: route `/teacher/calendar` xuất hiện trong `navByRole.teacher`; biến thể icon `"calendar"`.

- [ ] **Step 1: Viết test cấu trúc thất bại**

Tạo `tests/teacher-calendar.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("teacher calendar wiring", () => {
  it("thêm mục nav Lịch giao bài vào app-shell", () => {
    const shell = read("components/app-shell.tsx");
    expect(shell).toContain('href: "/teacher/calendar"');
    expect(shell).toContain("Lịch giao bài");
    expect(shell).toContain('case "calendar"');
  });

  it("có route server component cho lịch", () => {
    expect(existsSync(join(root, "app/teacher/calendar/page.tsx"))).toBe(true);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npx vitest run tests/teacher-calendar.test.ts`
Expected: FAIL — chưa có nav item, icon, và route.

- [ ] **Step 3: Thêm mục nav**

Trong `components/app-shell.tsx`, sửa mảng nav teacher (thêm dòng giữa "Giao bài" và "Chấm bài"):

```ts
    { href: "/teacher/assignments", label: "Giao bài", hint: "Bài tập về nhà", icon: "clipboard" },
    { href: "/teacher/calendar", label: "Lịch giao bài", hint: "Theo dõi nộp bài", icon: "calendar" },
    { href: "/teacher/review", label: "Chấm bài", hint: "Writing & Speaking", icon: "check" }
```

- [ ] **Step 4: Thêm `"calendar"` vào type `IconName`**

Sửa dòng `type IconName = ...`:

```ts
type IconName = "home" | "users" | "book" | "clipboard" | "check" | "clock" | "trophy" | "menu" | "close" | "calendar";
```

- [ ] **Step 5: Thêm nhánh vẽ icon lịch**

Trong hàm `Icon`, thêm case trước `case "menu":`:

```tsx
    case "calendar":
      return (
        <svg {...common} aria-hidden="true">
          <rect x="3.5" y="5" width="17" height="15" rx="2" />
          <path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" />
        </svg>
      );
```

- [ ] **Step 6: Chạy test cấu trúc**

Run: `npx vitest run tests/teacher-calendar.test.ts`
Expected: test nav PASS; test route vẫn FAIL (route tạo ở Task 5). Chấp nhận — sẽ xanh sau Task 5.

Kiểm tra riêng phần đã làm: chạy lại và xác nhận chỉ còn duy nhất assertion route đỏ.

- [ ] **Step 7: Commit**

```bash
git add components/app-shell.tsx tests/teacher-calendar.test.ts
git commit -m "feat: them muc nav Lich giao bai va icon lich cho giao vien

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Client component lịch + panel chi tiết

**Files:**
- Create: `components/assignment-calendar.tsx`

**Interfaces:**
- Consumes: từ `@/lib/assignment-calendar`: types `CalendarAssignment`, `CalendarClass`, `CalendarMode`, `CalendarRecipient`; hàm `bucketAssignmentsByDay`, `buildMonthGrid`, `vnDayKey`, `isSubmissionLate`, `studentsGroupedByClass`, `formatAttemptResult`. Từ `@/lib/format-duration`: `formatDuration`.
- Produces: export React component `AssignmentCalendar({ assignments, classes }: { assignments: CalendarAssignment[]; classes: CalendarClass[] })` dùng ở Task 5.

- [ ] **Step 1: Tạo client component đầy đủ**

Tạo `components/assignment-calendar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatDuration } from "@/lib/format-duration";
import {
  bucketAssignmentsByDay,
  buildMonthGrid,
  formatAttemptResult,
  isSubmissionLate,
  studentsGroupedByClass,
  vnDayKey,
  type CalendarAssignment,
  type CalendarClass,
  type CalendarMode,
  type CalendarRecipient
} from "@/lib/assignment-calendar";

const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const MONTH_LABEL = (year: number, month: number) => `Tháng ${month + 1}, ${year}`;
const SUBMITTED = new Set(["submitted", "reviewed"]);

type Props = {
  assignments: CalendarAssignment[];
  classes: CalendarClass[];
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh"
  });
}

function fmtDateTime(iso: string) {
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
  const todayKey = vnDayKey(new Date().toISOString());
  const [todayYear, todayMonth] = todayKey.split("-").map(Number);

  const [cursor, setCursor] = useState({ year: todayYear, month: todayMonth - 1 });
  const [mode, setMode] = useState<CalendarMode>("assigned");
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!selectedClassId) {
      return assignments;
    }
    return assignments.filter((a) =>
      a.recipients.some((r) => r.classIds.includes(selectedClassId))
    );
  }, [assignments, selectedClassId]);

  const buckets = useMemo(() => bucketAssignmentsByDay(filtered, mode), [filtered, mode]);
  const grid = useMemo(() => buildMonthGrid(cursor.year, cursor.month), [cursor]);

  const noDeadlineCount = useMemo(
    () => (mode === "deadline" ? filtered.filter((a) => !a.deadline).length : 0),
    [filtered, mode]
  );

  const selected = useMemo(
    () => assignments.find((a) => a.id === selectedId) ?? null,
    [assignments, selectedId]
  );

  const visibleRecipients = (assignment: CalendarAssignment) =>
    selectedClassId
      ? assignment.recipients.filter((r) => r.classIds.includes(selectedClassId))
      : assignment.recipients;

  const shiftMonth = (delta: number) => {
    setCursor((prev) => {
      const next = new Date(Date.UTC(prev.year, prev.month + delta, 1));
      return { year: next.getUTCFullYear(), month: next.getUTCMonth() };
    });
  };

  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_28rem]">
      <div className="space-y-4">
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

        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="rounded-md border border-border px-2 py-1 text-sm hover:border-primary"
              aria-label="Tháng trước"
            >
              ‹
            </button>
            <span className="text-sm font-semibold">{MONTH_LABEL(cursor.year, cursor.month)}</span>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="rounded-md border border-border px-2 py-1 text-sm hover:border-primary"
              aria-label="Tháng sau"
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
            {WEEKDAYS.map((day) => (
              <span key={day} className="py-1">
                {day}
              </span>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-1">
            {grid.map((key, index) => {
              if (!key) {
                return <div key={`blank-${index}`} className="min-h-[64px]" />;
              }
              const dayItems = buckets.get(key) ?? [];
              const dayNumber = Number(key.slice(8, 10));
              const isToday = key === todayKey;

              return (
                <div
                  key={key}
                  className="min-h-[64px] rounded-md border border-border p-1"
                >
                  <div
                    className={
                      isToday
                        ? "mb-1 flex h-5 w-5 items-center justify-center rounded-full border border-primary text-[11px] font-semibold text-primary"
                        : "mb-1 text-[11px] text-muted-foreground"
                    }
                  >
                    {dayNumber}
                  </div>
                  <div className="space-y-1">
                    {dayItems.slice(0, 2).map((assignment) => {
                      const shown = visibleRecipients(assignment);
                      const submitted = shown.filter((r) => SUBMITTED.has(r.status)).length;
                      const active = assignment.id === selectedId;
                      return (
                        <button
                          key={assignment.id}
                          type="button"
                          onClick={() => setSelectedId(assignment.id)}
                          title={assignment.title}
                          className={
                            active
                              ? "block w-full truncate rounded bg-primary px-1 py-0.5 text-left text-[11px] font-semibold text-primary-foreground"
                              : "block w-full truncate rounded bg-primary/10 px-1 py-0.5 text-left text-[11px] text-primary"
                          }
                        >
                          {submitted}/{shown.length} · {assignment.title}
                        </button>
                      );
                    })}
                    {dayItems.length > 2 ? (
                      <span className="block px-1 text-[10px] text-muted-foreground">
                        +{dayItems.length - 2} bài
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          {noDeadlineCount > 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">
              {noDeadlineCount} bài chưa đặt hạn nên không hiển thị ở chế độ này.
            </p>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-card">
        {selected ? (
          <DetailPanel
            assignment={selected}
            classes={classes}
            selectedClassId={selectedClassId}
          />
        ) : (
          <div className="flex h-full min-h-[200px] items-center justify-center text-center text-sm text-muted-foreground">
            Chọn một bài trên lịch để xem ai đã nộp, đúng/trễ hạn, thời gian làm và kết quả.
          </div>
        )}
      </div>
    </section>
  );
}

function DetailPanel({
  assignment,
  classes,
  selectedClassId
}: {
  assignment: CalendarAssignment;
  classes: CalendarClass[];
  selectedClassId: string | null;
}) {
  const shown = selectedClassId
    ? assignment.recipients.filter((r) => r.classIds.includes(selectedClassId))
    : assignment.recipients;
  const submitted = shown.filter((r) => SUBMITTED.has(r.status)).length;
  const groups = studentsGroupedByClass(assignment.recipients, classes, selectedClassId);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold">{assignment.title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Giao {fmtDate(assignment.createdAt)} ·{" "}
            {assignment.deadline
              ? `Hạn nộp ${fmtDateTime(assignment.deadline)}`
              : "Không đặt hạn"}{" "}
            · {assignment.unitCount} phần
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
          {submitted}/{shown.length} đã nộp
        </span>
      </div>

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
  const done = SUBMITTED.has(recipient.status) && attempt;
  const late = done ? isSubmissionLate(attempt.submittedAt, assignment.deadline) : false;

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
        {done ? (
          <Link
            href={`/teacher/review/${attempt.id}`}
            className="shrink-0 text-xs font-semibold text-primary hover:underline"
          >
            Xem bài →
          </Link>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
        {done ? (
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

- [ ] **Step 2: Kiểm tra biên dịch/lint component**

Run: `pnpm lint`
Expected: không lỗi mới trong `components/assignment-calendar.tsx` (đặc biệt: không dùng biến thừa, `attempt` đã được thu hẹp kiểu qua `done`).

Ghi chú: `done` là `attempt` (truthy) nên trong nhánh `done ?` TypeScript hiểu `attempt` khác null. Nếu strict báo lỗi thu hẹp kiểu ở `attempt.id`/`attempt.submittedAt`, đổi điều kiện thành `const done = SUBMITTED.has(recipient.status) && attempt !== null;` và trong JSX dùng `attempt && (...)`.

- [ ] **Step 3: Commit**

```bash
git add components/assignment-calendar.tsx
git commit -m "feat: client component lich giao bai + panel chi tiet hoc vien

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Server page `/teacher/calendar`

**Files:**
- Create: `app/teacher/calendar/page.tsx`

**Interfaces:**
- Consumes: `requireTeacher` (`@/lib/actions/classes`), `prisma` (`@/lib/prisma`), `attemptBand` (`@/lib/band-score`), `countGradedAnswers` + types (`@/lib/assignment-calendar`), `AssignmentCalendar` (`@/components/assignment-calendar`).
- Produces: default export React server component tại route `/teacher/calendar`.

- [ ] **Step 1: Tạo server page đầy đủ**

Tạo `app/teacher/calendar/page.tsx`:

```tsx
import { AssignmentCalendar } from "@/components/assignment-calendar";
import { requireTeacher } from "@/lib/actions/classes";
import {
  countGradedAnswers,
  type CalendarAssignment,
  type CalendarClass
} from "@/lib/assignment-calendar";
import { attemptBand } from "@/lib/band-score";
import { prisma } from "@/lib/prisma";

export default async function TeacherCalendarPage() {
  const teacher = await requireTeacher();

  const [classes, assignments] = await Promise.all([
    prisma.class.findMany({
      where: { teacherId: teacher.id },
      orderBy: { createdAt: "desc" },
      include: {
        students: {
          include: { student: { select: { id: true } } }
        }
      }
    }),
    prisma.assignment.findMany({
      where: { teacherId: teacher.id },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { units: true } },
        recipients: {
          include: {
            student: { select: { id: true, displayName: true, email: true } },
            attempts: {
              orderBy: { startedAt: "desc" },
              take: 1,
              include: {
                review: { select: { overallBand: true } },
                answers: {
                  select: {
                    isCorrect: true,
                    assignableUnit: { select: { skill: true } }
                  }
                }
              }
            }
          }
        }
      }
    })
  ]);

  const classIdsByStudent = new Map<string, string[]>();
  for (const cls of classes) {
    for (const membership of cls.students) {
      const list = classIdsByStudent.get(membership.student.id) ?? [];
      list.push(cls.id);
      classIdsByStudent.set(membership.student.id, list);
    }
  }

  const calendarClasses: CalendarClass[] = classes.map((cls) => ({
    id: cls.id,
    name: cls.name
  }));

  const calendarAssignments: CalendarAssignment[] = assignments.map((assignment) => ({
    id: assignment.id,
    title: assignment.title,
    createdAt: assignment.createdAt.toISOString(),
    deadline: assignment.deadline ? assignment.deadline.toISOString() : null,
    unitCount: assignment._count.units,
    recipients: assignment.recipients.map((recipient) => {
      const attempt = recipient.attempts[0] ?? null;

      if (!attempt) {
        return {
          studentId: recipient.student.id,
          displayName: recipient.student.displayName,
          email: recipient.student.email,
          classIds: classIdsByStudent.get(recipient.student.id) ?? [],
          status: recipient.status,
          attempt: null
        };
      }

      const answers = attempt.answers.map((answer) => ({
        isCorrect: answer.isCorrect,
        skill: answer.assignableUnit.skill
      }));
      const { correct, total } = countGradedAnswers(answers);

      return {
        studentId: recipient.student.id,
        displayName: recipient.student.displayName,
        email: recipient.student.email,
        classIds: classIdsByStudent.get(recipient.student.id) ?? [],
        status: recipient.status,
        attempt: {
          id: attempt.id,
          status: attempt.status,
          submittedAt: attempt.submittedAt ? attempt.submittedAt.toISOString() : null,
          elapsedSeconds: attempt.elapsedSeconds,
          band: attemptBand(attempt.review?.overallBand ?? null, answers),
          correct,
          total,
          scorePercent: attempt.scorePercent,
          hasPendingManual: answers.some((answer) => answer.isCorrect === null)
        }
      };
    })
  }));

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-semibold text-primary">Theo dõi bài tập</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Lịch giao bài</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Xem lại các bài đã giao theo ngày và theo lớp. Bấm vào một bài để biết ai đã nộp, đúng
          hay trễ hạn, làm trong bao lâu và kết quả ra sao.
        </p>
      </header>

      <AssignmentCalendar assignments={calendarAssignments} classes={calendarClasses} />
    </div>
  );
}
```

- [ ] **Step 2: Chạy test cấu trúc (giờ đủ xanh)**

Run: `npx vitest run tests/teacher-calendar.test.ts`
Expected: PASS cả hai assertion (nav + route tồn tại).

- [ ] **Step 3: Build kiểm tra kiểu**

Run: `pnpm build`
Expected: build thành công, không lỗi TypeScript ở route/`components/assignment-calendar.tsx`. (Nếu lỗi thu hẹp kiểu `attempt`, áp dụng ghi chú ở Task 4 Step 2.)

- [ ] **Step 4: Commit**

```bash
git add app/teacher/calendar/page.tsx
git commit -m "feat: route /teacher/calendar truy van va dung du lieu lich giao bai

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Kiểm thử tổng thể & xác minh trên trình duyệt

**Files:** (không sửa file — chỉ xác minh)

- [ ] **Step 1: Chạy toàn bộ test + lint**

Run: `pnpm test && pnpm lint`
Expected: tất cả test PASS (bao gồm `assignment-calendar.test.ts`, `teacher-calendar.test.ts`, và các test cũ không hồi quy); lint sạch.

- [ ] **Step 2: Xác minh trên preview (đăng nhập giáo viên)**

Khởi động dev server và mở khu vực giáo viên:
- Vào menu "Lịch giao bài" → thấy lịch tháng hiện tại.
- Ngày có bài giao hiện chip `đã nộp/tổng`. Đổi "Theo ngày giao ⇄ Theo hạn nộp" → bài dời sang đúng ngày; bài không hạn biến mất ở chế độ hạn nộp và có dòng "N bài chưa đặt hạn".
- Chọn một lớp ở ô lọc → lịch và panel chỉ còn học viên lớp đó.
- Bấm một bài → panel hiện học viên nhóm theo lớp, gồm cả người "Chưa làm"; người đã nộp có nhãn Đúng/Trễ hạn, thời gian làm, kết quả (band + số câu đúng, hoặc % , hoặc "Chờ chấm").
- Bấm "Xem bài →" → sang trang `/teacher/review/{attemptId}` chấm/xem chi tiết.

Dùng dữ liệu seed (`pnpm prisma:seed`) hoặc dữ liệu thật để có ít nhất một bài đã giao và một attempt đã nộp. Nếu chưa có attempt nộp, đăng nhập học viên seed làm & nộp một bài để kiểm tra đầy đủ.

- [ ] **Step 3: Commit (nếu có chỉnh sửa nhỏ khi xác minh)**

Chỉ commit nếu Step 2 phát hiện lỗi và bạn sửa. Thông điệp mô tả đúng nội dung sửa, kèm trailer:

```bash
git commit -m "fix: <mo ta> man lich giao bai

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- Menu mới + route → Task 3, Task 5. ✓
- Lịch tháng, toggle ngày giao/hạn nộp, lọc lớp, chip đã nộp/tổng, "+N", ghi chú bài không hạn → Task 4. ✓
- Panel cạnh lịch, nhóm theo lớp, tất cả học viên (cả chưa nộp), đúng/trễ hạn, thời gian làm, kết quả band+số câu đúng / % / "Chờ chấm", nút "Xem bài" → Task 4 + `formatAttemptResult`/`isSubmissionLate`/`studentsGroupedByClass` (Task 1-2) + query (Task 5). ✓
- Suy lớp từ học viên (classId không lưu trên Assignment) → `classIdsByStudent` ở Task 5 + `studentsGroupedByClass`. ✓
- Không đổi schema → xác nhận, chỉ query/đọc. ✓
- Tách hàm thuần + dùng chung logic trễ hạn ở trang Chấm bài → Task 1, 2 (refactor `review/page.tsx`). ✓
- Kiểm thử unit các hàm thuần → Task 1, 2. ✓
- Ngoài phạm vi (không khóa nộp, không xuất file, không chấm tại chỗ) → không có task nào vi phạm. ✓

**Placeholder scan:** Không có "TBD/TODO"; mọi step có code/command cụ thể. ✓

**Type consistency:** Tên hàm và kiểu khớp giữa các task: `CalendarAssignment/CalendarRecipient/CalendarAttempt/CalendarClass/ClassGroup/CalendarMode`, `bucketAssignmentsByDay`, `buildMonthGrid`, `vnDayKey`, `isSubmissionLate`, `countGradedAnswers`, `studentsGroupedByClass`, `formatAttemptResult` — dùng nhất quán ở Task 4/5. `attemptBand`, `formatBand`, `formatDuration` là API sẵn có. ✓
