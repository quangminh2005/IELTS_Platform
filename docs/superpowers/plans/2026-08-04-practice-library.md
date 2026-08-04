# Thư viện tự luyện — kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Học viên tự chọn đề trong một thư viện dùng chung do giáo viên mở, làm lại không giới hạn, xem kết quả và giải thích ngay sau khi nộp.

**Architecture:** Tái dùng nguyên đường ống `Assignment → AssignmentRecipient → Attempt`. Mỗi lần học viên luyện một đề, hệ thống tạo ngầm một "bài giao ảo" (`Assignment.mode = "practice"`, `classId = null`, `deadline = null`) cho riêng em đó, rồi chuyển vào đúng phòng làm bài hiện có. Chi phí đổi lại là phải lọc bài giao ảo khỏi các trang liệt kê bài giao — việc này được gom vào một file dùng chung và khoá bằng test cấu trúc.

**Tech Stack:** Next.js 14 App Router, Prisma + PostgreSQL (Neon), TypeScript strict, zod, Tailwind, vitest.

**Spec:** [docs/superpowers/specs/2026-08-04-practice-library-design.md](../specs/2026-08-04-practice-library-design.md)

## Global Constraints

- Mọi chuỗi hiển thị cho người dùng và mọi comment trong code viết bằng **tiếng Việt**, khớp với các file hiện có.
- Server action luôn bắt đầu bằng `requireTeacher()` hoặc `requireStudent()`; page dưới `app/teacher/` dùng `requireTeacherPage()`.
- Không nơi nào ngoài `lib/practice.ts` được viết chuỗi `"practice"` cho `Assignment.mode`.
- Ba cột mới **bắt buộc** phải có trong `scripts/ensure-db.mjs`, nếu không bản deploy prod sẽ sập.
- Dùng `select` (không dùng `include`) khi truy vấn `Material.units` ở trang giáo viên — `content`/`transcript`/`metadataJson` rất nặng.
- Chạy test bằng `npx vitest run <file>`; chạy toàn bộ bằng `pnpm test`.

---

### Task 1: Nền dữ liệu và `lib/practice.ts`

**Files:**
- Create: `lib/practice.ts`
- Create: `tests/practice.test.ts`
- Modify: `prisma/schema.prisma` (model `Material`, `Assignment`, `Attempt`)
- Modify: `scripts/ensure-db.mjs` (mảng `statements`)

**Interfaces:**
- Consumes: không có (task đầu tiên)
- Produces:
  - `PRACTICE_MODE: "practice"`
  - `practiceScopeKey(studentId: string, materialId: string, unitId: string | null): string`
  - `excludePracticeAssignment` / `onlyPracticeAssignment` — mảnh `Prisma.AssignmentWhereInput`
  - `excludePracticeRecipient` / `onlyPracticeRecipient` — mảnh where lồng `{ assignment: ... }`
  - `countsForStats: { attemptRound: 1 }`
  - `practiceSkillTimeLimits(units: PracticeUnitTime[], timed: boolean): string | null`
  - `decideAttemptStart(mode: string, latest: LatestAttempt): StartDecision`
  - Cột DB mới: `Material.practiceOpen`, `Assignment.practiceScopeKey`, `Attempt.attemptRound`

- [ ] **Step 1: Viết test thất bại**

Tạo `tests/practice.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  countsForStats,
  decideAttemptStart,
  excludePracticeAssignment,
  onlyPracticeAssignment,
  practiceScopeKey,
  practiceSkillTimeLimits
} from "@/lib/practice";

const root = process.cwd();

describe("practiceScopeKey", () => {
  it("gộp học viên + đề + phần thành khoá", () => {
    expect(practiceScopeKey("hv1", "de1", "phan1")).toBe("hv1:de1:phan1");
  });

  it("luyện cả đề dùng hậu tố all", () => {
    expect(practiceScopeKey("hv1", "de1", null)).toBe("hv1:de1:all");
  });

  it("luyện cả đề và luyện một phần là hai khoá khác nhau", () => {
    expect(practiceScopeKey("hv1", "de1", null)).not.toBe(
      practiceScopeKey("hv1", "de1", "phan1")
    );
  });
});

describe("mảnh điều kiện lọc", () => {
  it("loại bài tự luyện", () => {
    expect(excludePracticeAssignment).toEqual({ mode: { not: "practice" } });
  });

  it("chỉ lấy bài tự luyện", () => {
    expect(onlyPracticeAssignment).toEqual({ mode: "practice" });
  });

  it("thống kê chỉ tính lượt đầu", () => {
    expect(countsForStats).toEqual({ attemptRound: 1 });
  });
});

describe("practiceSkillTimeLimits", () => {
  it("chọn không tính giờ thì trả về null", () => {
    const units = [{ skill: "reading", defaultTimeLimitMinutes: 20 }];
    expect(practiceSkillTimeLimits(units, false)).toBeNull();
  });

  it("cộng dồn thời gian mặc định theo kỹ năng", () => {
    const units = [
      { skill: "reading", defaultTimeLimitMinutes: 20 },
      { skill: "reading", defaultTimeLimitMinutes: 20 },
      { skill: "listening", defaultTimeLimitMinutes: 10 }
    ];
    expect(practiceSkillTimeLimits(units, true)).toBe(
      JSON.stringify({ reading: 40, listening: 10 })
    );
  });

  it("phần không đặt thời gian thì bị bỏ qua", () => {
    const units = [
      { skill: "reading", defaultTimeLimitMinutes: null },
      { skill: "reading", defaultTimeLimitMinutes: 20 }
    ];
    expect(practiceSkillTimeLimits(units, true)).toBe(JSON.stringify({ reading: 20 }));
  });

  it("không phần nào có thời gian thì trả về null", () => {
    const units = [{ skill: "writing", defaultTimeLimitMinutes: null }];
    expect(practiceSkillTimeLimits(units, true)).toBeNull();
  });
});

describe("decideAttemptStart", () => {
  it("chưa có lượt nào thì tạo lượt 1", () => {
    expect(decideAttemptStart("homework", null)).toEqual({ kind: "new", attemptRound: 1 });
  });

  it("đang làm dở thì tiếp tục lượt đó, kể cả bài tự luyện", () => {
    const latest = { id: "a1", status: "in_progress", attemptRound: 2 };
    expect(decideAttemptStart("practice", latest)).toEqual({ kind: "resume", attemptId: "a1" });
  });

  it("bài giao đã nộp thì KHÔNG tạo lượt mới", () => {
    const latest = { id: "a1", status: "submitted", attemptRound: 1 };
    expect(decideAttemptStart("homework", latest)).toEqual({ kind: "resume", attemptId: "a1" });
  });

  it("bài tự luyện đã nộp thì tạo lượt kế tiếp", () => {
    const latest = { id: "a1", status: "submitted", attemptRound: 2 };
    expect(decideAttemptStart("practice", latest)).toEqual({ kind: "new", attemptRound: 3 });
  });
});

describe("cột mới đã khai báo đủ chỗ", () => {
  const schema = readFileSync(join(root, "prisma", "schema.prisma"), "utf8");
  const ensureDb = readFileSync(join(root, "scripts", "ensure-db.mjs"), "utf8");

  it("schema có ba cột mới", () => {
    expect(schema).toMatch(/practiceOpen\s+Boolean\s+@default\(false\)/);
    expect(schema).toMatch(/practiceScopeKey\s+String\?\s+@unique/);
    expect(schema).toMatch(/attemptRound\s+Int\s+@default\(1\)/);
  });

  // Dự án không dùng migrations: cột mới chỉ lên được prod qua ensure-db.mjs.
  it("ensure-db.mjs áp đủ ba cột lên prod", () => {
    expect(ensureDb).toContain('"Material" ADD COLUMN IF NOT EXISTS "practiceOpen"');
    expect(ensureDb).toContain('"Assignment" ADD COLUMN IF NOT EXISTS "practiceScopeKey"');
    expect(ensureDb).toContain('"Attempt" ADD COLUMN IF NOT EXISTS "attemptRound"');
    expect(ensureDb).toContain('"Assignment_practiceScopeKey_key"');
  });
});
```

- [ ] **Step 2: Chạy test để chắc chắn nó đỏ**

```bash
npx vitest run tests/practice.test.ts
```

Kỳ vọng: FAIL — `Failed to resolve import "@/lib/practice"`.

- [ ] **Step 3: Tạo `lib/practice.ts`**

```ts
import type { Prisma } from "@prisma/client";

// Bài tự luyện được dựng thành "bài giao ảo" (Assignment.mode = "practice") để tái
// dùng nguyên đường ống chấm/kết quả của bài giao. MỌI điều kiện lọc liên quan nằm ở
// file này — không nơi nào khác được viết chuỗi "practice" bằng tay.
export const PRACTICE_MODE = "practice";

// Khoá định danh một bộ luyện: mỗi (học viên × đề × phạm vi) chỉ có một Assignment.
// unitId = null nghĩa là luyện cả đề.
export function practiceScopeKey(
  studentId: string,
  materialId: string,
  unitId: string | null
): string {
  return `${studentId}:${materialId}:${unitId ?? "all"}`;
}

// Dùng ở where của Assignment.
export const excludePracticeAssignment = {
  mode: { not: PRACTICE_MODE }
} satisfies Prisma.AssignmentWhereInput;

export const onlyPracticeAssignment = {
  mode: PRACTICE_MODE
} satisfies Prisma.AssignmentWhereInput;

// Dùng ở where của AssignmentRecipient, hoặc lồng dưới attempt.assignmentRecipient.
export const excludePracticeRecipient = { assignment: excludePracticeAssignment };
export const onlyPracticeRecipient = { assignment: onlyPracticeAssignment };

// Lượt được tính vào xếp hạng và thống kê điểm yếu: bài giao (luôn là lượt 1) và
// lượt tự luyện ĐẦU TIÊN của mỗi đề. Các lượt luyện lại chỉ để học, không đẩy hạng.
export const countsForStats = { attemptRound: 1 } satisfies Prisma.AttemptWhereInput;

export type PracticeUnitTime = {
  skill: string;
  defaultTimeLimitMinutes: number | null;
};

// Gộp thời gian mặc định của các phần thành JSON theo kỹ năng cho
// Assignment.skillTimeLimitsJson. Trả về null khi học viên chọn "không tính giờ"
// hoặc không phần nào đặt thời gian — kỹ năng vắng mặt = không đếm ngược.
export function practiceSkillTimeLimits(
  units: PracticeUnitTime[],
  timed: boolean
): string | null {
  if (!timed) {
    return null;
  }

  const totals = new Map<string, number>();

  for (const unit of units) {
    if (unit.defaultTimeLimitMinutes === null) {
      continue;
    }

    totals.set(unit.skill, (totals.get(unit.skill) ?? 0) + unit.defaultTimeLimitMinutes);
  }

  if (totals.size === 0) {
    return null;
  }

  return JSON.stringify(Object.fromEntries(totals));
}

export type LatestAttempt = {
  id: string;
  status: string;
  attemptRound: number;
} | null;

export type StartDecision =
  | { kind: "resume"; attemptId: string }
  | { kind: "new"; attemptRound: number };

// Bài giao: một lần duy nhất (đã nộp thì trang tự chuyển sang xem kết quả).
// Bài tự luyện: nộp xong bấm lại là mở lượt mới. Lượt đang làm dở luôn được tiếp tục.
export function decideAttemptStart(mode: string, latest: LatestAttempt): StartDecision {
  if (latest === null) {
    return { kind: "new", attemptRound: 1 };
  }

  if (latest.status === "in_progress") {
    return { kind: "resume", attemptId: latest.id };
  }

  if (mode === PRACTICE_MODE) {
    return { kind: "new", attemptRound: latest.attemptRound + 1 };
  }

  return { kind: "resume", attemptId: latest.id };
}
```

- [ ] **Step 4: Thêm ba cột vào `prisma/schema.prisma`**

Trong `model Material`, thêm ngay dưới `sourceLabel`:

```prisma
  // Đề có nằm trong thư viện tự luyện của học viên không (mở là mở cho MỌI học viên).
  practiceOpen Boolean @default(false)
```

Trong `model Assignment`, thêm ngay dưới `mode`:

```prisma
  // Chỉ có ở "bài giao ảo" của thư viện tự luyện: khoá studentId:materialId:unitId|all.
  // Đảm bảo mỗi (học viên × đề × phạm vi) chỉ sinh đúng một bài giao ảo.
  practiceScopeKey String? @unique
```

Trong `model Attempt`, thêm ngay dưới `submitReason`:

```prisma
  // Lượt thứ mấy của bài này. Bài giao luôn = 1. Lượt tự luyện thứ hai trở đi = 2, 3...
  // Xếp hạng và thống kê chỉ tính lượt 1 (xem lib/practice.ts).
  attemptRound Int @default(1)
```

- [ ] **Step 5: Thêm bốn câu lệnh vào `scripts/ensure-db.mjs`**

Chèn vào cuối mảng `statements`, ngay trước dấu `];`:

```js
  // Thư viện tự luyện: cờ mở đề, khoá bộ luyện, số thứ tự lượt làm
  'ALTER TABLE "Material" ADD COLUMN IF NOT EXISTS "practiceOpen" BOOLEAN NOT NULL DEFAULT false;',
  'ALTER TABLE "Assignment" ADD COLUMN IF NOT EXISTS "practiceScopeKey" TEXT;',
  'CREATE UNIQUE INDEX IF NOT EXISTS "Assignment_practiceScopeKey_key" ON "Assignment"("practiceScopeKey");',
  'ALTER TABLE "Attempt" ADD COLUMN IF NOT EXISTS "attemptRound" INTEGER NOT NULL DEFAULT 1;',
```

- [ ] **Step 6: Chạy test để xác nhận xanh**

```bash
npx vitest run tests/practice.test.ts
```

Kỳ vọng: PASS, 16 test.

- [ ] **Step 7: Sinh client và đẩy schema lên DB local**

```bash
pnpm prisma generate
npx prisma db push
```

Kỳ vọng: `Your database is now in sync with your Prisma schema.` Lưu ý `.env` đang trỏ tới DB **local** tên `ielts-test` (KHÔNG phải prod `IELTS_Platform`).

- [ ] **Step 8: Commit**

```bash
git add lib/practice.ts tests/practice.test.ts prisma/schema.prisma scripts/ensure-db.mjs
git commit -m "feat(tu-luyen): them cot du lieu va lib/practice.ts"
```

---

### Task 2: Lọc bài giao ảo khỏi mọi danh sách bài giao

Làm task này **trước** khi có bất kỳ bài giao ảo nào tồn tại, để không bao giờ lọt ra giao diện.

**Files:**
- Create: `tests/practice-filter-guard.test.ts`
- Modify: `app/teacher/assignments/page.tsx` (query `prisma.assignment.findMany`, ~dòng 140)
- Modify: `app/teacher/calendar/page.tsx` (query `prisma.assignment.findMany`, ~dòng 26)
- Modify: `app/student/page.tsx` (query `prisma.assignmentRecipient.findMany`, ~dòng 72)
- Modify: `lib/actions/assignments.ts` (hai `prisma.assignment.findFirst`, ~dòng 204 và ~291)

**Interfaces:**
- Consumes: `excludePracticeAssignment`, `PRACTICE_MODE` từ `lib/practice.ts` (Task 1)
- Produces: không có API mới; đảm bảo bốn file trên không bao giờ hiện bài giao ảo

- [ ] **Step 1: Viết test cấu trúc thất bại**

Tạo `tests/practice-filter-guard.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

// Bài tự luyện được dựng thành Assignment.mode = "practice". Mọi nơi liệt kê bài
// GIAO phải loại chúng ra, nếu không danh sách của giáo viên sẽ ngập bài ảo.
const mustExcludePractice = [
  "app/teacher/assignments/page.tsx",
  "app/teacher/calendar/page.tsx",
  "app/student/page.tsx",
  "lib/actions/assignments.ts"
];

function read(relative: string): string {
  return readFileSync(join(root, ...relative.split("/")), "utf8");
}

describe("lọc bài tự luyện khỏi danh sách bài giao", () => {
  it.each(mustExcludePractice)("%s dùng mảnh lọc từ lib/practice", (relative) => {
    const source = read(relative);

    expect(source).toContain('from "@/lib/practice"');
    expect(source).toContain("excludePracticeAssignment");
  });

  // Chuỗi "practice" chỉ được viết ở đúng một chỗ, để đổi giá trị không sót nơi nào.
  it.each(mustExcludePractice)("%s không tự viết chuỗi practice", (relative) => {
    expect(read(relative)).not.toMatch(/mode:\s*["']practice["']/);
  });

  // Cron nhắc hạn không cần lọc mode vì nó chỉ lấy bài CÓ hạn nộp, mà bài giao ảo
  // luôn deadline = null. Test này khoá lại điều kiện đó: bỏ nó đi là học viên sẽ
  // nhận mail nhắc cho chính bài mình tự luyện.
  it("cron nhắc hạn vẫn lọc theo deadline", () => {
    const source = read("app/api/cron/reminders/route.ts");

    expect(source).toMatch(/assignment:\s*\{\s*deadline:/);
  });
});
```

- [ ] **Step 2: Chạy test để chắc chắn nó đỏ**

```bash
npx vitest run tests/practice-filter-guard.test.ts
```

Kỳ vọng: FAIL — 4 test đầu báo không tìm thấy `from "@/lib/practice"`.

- [ ] **Step 3: Sửa `app/teacher/assignments/page.tsx`**

Thêm import cạnh các import `@/lib/...` hiện có:

```ts
import { excludePracticeAssignment } from "@/lib/practice";
```

Đổi query (~dòng 140):

```ts
      prisma.assignment.findMany({
        // Bài giao ảo của thư viện tự luyện không phải bài giáo viên giao — ẩn đi.
        where: { teacherId: teacher.id, ...excludePracticeAssignment },
        orderBy: { createdAt: "desc" },
        select: assignmentSelect
      })
```

- [ ] **Step 4: Sửa `app/teacher/calendar/page.tsx`**

Thêm import:

```ts
import { excludePracticeAssignment } from "@/lib/practice";
```

Đổi query (~dòng 26):

```ts
    prisma.assignment.findMany({
      // Lịch chỉ theo dõi bài giáo viên giao, không có bài tự luyện.
      where: { teacherId: teacher.id, ...excludePracticeAssignment },
      orderBy: { createdAt: "desc" },
```

- [ ] **Step 5: Sửa `app/student/page.tsx`**

Thêm import:

```ts
import { excludePracticeAssignment } from "@/lib/practice";
```

Đổi query (~dòng 72):

```ts
    prisma.assignmentRecipient.findMany({
      // Trang chủ chỉ liệt kê bài được giao; bài tự luyện nằm ở /student/practice.
      where: { studentId: student.id, assignment: excludePracticeAssignment },
      orderBy: { assignedAt: "desc" },
```

- [ ] **Step 6: Sửa `lib/actions/assignments.ts`**

Thêm import:

```ts
import { excludePracticeAssignment } from "@/lib/practice";
```

Ở **cả hai** `prisma.assignment.findFirst` (~dòng 204 và ~291), đổi `where`:

```ts
    where: {
      id,
      teacherId: teacher.id,
      // Phòng thân: bài giao ảo của thư viện tự luyện không được sửa/xoá qua đây.
      ...excludePracticeAssignment
    },
```

- [ ] **Step 7: Chạy test để xác nhận xanh**

```bash
npx vitest run tests/practice-filter-guard.test.ts
```

Kỳ vọng: PASS, 8 test.

- [ ] **Step 8: Chạy toàn bộ test và kiểm kiểu**

```bash
pnpm test
npx tsc --noEmit
```

Kỳ vọng: tất cả xanh, `tsc` không báo lỗi.

- [ ] **Step 9: Commit**

```bash
git add tests/practice-filter-guard.test.ts app/teacher/assignments/page.tsx app/teacher/calendar/page.tsx app/student/page.tsx lib/actions/assignments.ts
git commit -m "feat(tu-luyen): loc bai giao ao khoi cac danh sach bai giao"
```

---

### Task 3: Công tắc "Cho tự luyện" phía giáo viên

**Files:**
- Modify: `lib/materials-filter.ts` (thêm `practiceOpen` vào `MaterialMeta`, thêm `practice` vào `MaterialFilters`)
- Modify: `tests/materials-filter.test.ts`
- Modify: `lib/actions/materials.ts` (thêm `setPracticeOpen`)
- Modify: `app/teacher/materials/page.tsx` (`materialSelect` + truyền cờ + form công tắc)
- Modify: `components/materials-browser.tsx` (chip lọc "Đang mở tự luyện")

**Interfaces:**
- Consumes: `MaterialMeta`, `MaterialFilters`, `filterMaterials` từ `lib/materials-filter.ts`; `actionOk`/`actionFail`/`ActionResult` từ `lib/action-result.ts`; `ActionForm`/`ActionSubmitButton` từ `components/action-form.tsx`
- Produces: `setPracticeOpen(_prev: ActionResult | null, formData: FormData): Promise<ActionResult>` — đọc `materialId` và `practiceOpen` (`"1"` hoặc `"0"`) từ `FormData`

- [ ] **Step 1: Viết test thất bại cho bộ lọc**

Thêm vào cuối `tests/materials-filter.test.ts`:

```ts
describe("lọc theo thư viện tự luyện", () => {
  const base = {
    skill: "reading",
    series: "Cambridge",
    unitCount: 3,
    questionCount: 40,
    createdAtMs: 0,
    lastAssignedAtMs: null,
    status: {
      isEmpty: false,
      missingAudio: false,
      missingQuestions: false,
      isComplete: true
    }
  };

  const metas = [
    { ...base, id: "m1", title: "Đề mở", searchText: "đề mở", practiceOpen: true },
    { ...base, id: "m2", title: "Đề đóng", searchText: "đề đóng", practiceOpen: false }
  ];

  it("mặc định hiện cả đề mở lẫn đề đóng", () => {
    const result = filterMaterials(metas, defaultMaterialFilters);
    expect(result.map((meta) => meta.id)).toEqual(["m1", "m2"]);
  });

  it('chọn "open" thì chỉ còn đề đang mở tự luyện', () => {
    const result = filterMaterials(metas, { ...defaultMaterialFilters, practice: "open" });
    expect(result.map((meta) => meta.id)).toEqual(["m1"]);
  });
});
```

Bảo đảm dòng import ở đầu file đã có `defaultMaterialFilters` và `filterMaterials`.

- [ ] **Step 2: Chạy test để chắc chắn nó đỏ**

```bash
npx vitest run tests/materials-filter.test.ts
```

Kỳ vọng: FAIL — TypeScript/vitest báo `practice` không có trong `MaterialFilters`.

- [ ] **Step 3: Sửa `lib/materials-filter.ts`**

Thêm vào `MaterialMeta` (sau `status`):

```ts
  // Đề có đang nằm trong thư viện tự luyện của học viên không.
  practiceOpen: boolean;
```

Thêm vào `MaterialFilters` (sau `status`):

```ts
  practice: PracticeFilter; // "all" hoặc "open"
```

Thêm kiểu và giá trị mặc định:

```ts
export type PracticeFilter = "all" | "open";
```

```ts
export const defaultMaterialFilters: MaterialFilters = {
  search: "",
  skill: "all",
  series: "all",
  status: "all",
  practice: "all",
  sort: "newest"
};
```

Thêm một dòng vào `filterMaterials`, ngay trước `if (!matchesStatus(...))`:

```ts
    if (filters.practice === "open" && !meta.practiceOpen) return false;
```

- [ ] **Step 4: Chạy test để xác nhận xanh**

```bash
npx vitest run tests/materials-filter.test.ts
```

Kỳ vọng: PASS.

- [ ] **Step 5: Thêm server action `setPracticeOpen`**

Thêm vào cuối `lib/actions/materials.ts`:

```ts
const practiceOpenSchema = z.object({
  materialId: z.string().trim().min(1, "Thiếu tài liệu."),
  practiceOpen: z.enum(["0", "1"], "Giá trị không hợp lệ.")
});

// Bật/tắt việc đưa một đề vào thư viện tự luyện. Mở là mở cho MỌI học viên.
// Tắt chỉ khiến đề biến khỏi thư viện — lượt đã làm và kết quả giữ nguyên.
export async function setPracticeOpen(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const teacher = await requireTeacher();
  const parsed = practiceOpenSchema.safeParse({
    materialId: formData.get("materialId"),
    practiceOpen: formData.get("practiceOpen")
  });

  if (!parsed.success) {
    return actionFail(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ.");
  }

  const material = await prisma.material.findFirst({
    where: { id: parsed.data.materialId, teacherId: teacher.id },
    select: { id: true, title: true }
  });

  if (!material) {
    return actionFail("Không tìm thấy tài liệu.");
  }

  const practiceOpen = parsed.data.practiceOpen === "1";

  await prisma.material.update({
    where: { id: material.id },
    data: { practiceOpen }
  });

  revalidatePath("/teacher/materials");

  return actionOk(
    practiceOpen
      ? `Đã mở "${material.title}" cho học viên tự luyện.`
      : `Đã gỡ "${material.title}" khỏi thư viện tự luyện.`
  );
}
```

- [ ] **Step 6: Truyền cờ ra trang Tài liệu**

Trong `app/teacher/materials/page.tsx`, thêm `practiceOpen: true,` vào `materialSelect` (ngay sau `sourceLabel: true,`).

Thêm `setPracticeOpen` vào khối import từ `@/lib/actions/materials`.

Ở chỗ dựng `MaterialBrowserItem` (nơi đang gọi `computeStatus` và `deriveSeries`), thêm `practiceOpen: material.practiceOpen` vào object meta.

Trong phần render mỗi thẻ tài liệu, thêm form công tắc cạnh các nút hành động sẵn có:

```tsx
<ActionForm action={setPracticeOpen}>
  <input type="hidden" name="materialId" value={material.id} />
  <input type="hidden" name="practiceOpen" value={material.practiceOpen ? "0" : "1"} />
  <ActionSubmitButton
    className={
      material.practiceOpen
        ? "rounded-md border border-primary/50 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary"
        : secondaryButtonClass
    }
  >
    {material.practiceOpen ? "Đang cho tự luyện" : "Cho tự luyện"}
  </ActionSubmitButton>
</ActionForm>
```

- [ ] **Step 7: Thêm bộ lọc vào `components/materials-browser.tsx`**

File này lọc bằng `<select>` với `controlClass`, không dùng chip — làm đúng theo dạng đó.

Thêm `PracticeFilter` vào khối import từ `@/lib/materials-filter` (cạnh `StatusFilter`).

Thêm mảng lựa chọn cạnh `statusOptions` (dòng ~25):

```tsx
const practiceOptions: { value: PracticeFilter; label: string }[] = [
  { value: "all", label: "Mọi đề" },
  { value: "open", label: "Đang mở tự luyện" }
];
```

Thêm một `<select>` ngay sau `<select>` lọc trạng thái (dòng ~132-143):

```tsx
          <select
            value={filters.practice}
            onChange={(event) =>
              update({ practice: event.target.value as PracticeFilter })
            }
            className={controlClass}
            aria-label="Lọc theo thư viện tự luyện"
          >
            {practiceOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
```

Không cần sửa `MaterialBrowserItem` — `practiceOpen` nằm trong `meta` (`MaterialMeta`) đã mở rộng ở Step 3.

- [ ] **Step 8: Chạy test và kiểm kiểu**

```bash
pnpm test
npx tsc --noEmit
```

Kỳ vọng: tất cả xanh.

- [ ] **Step 9: Commit**

```bash
git add lib/materials-filter.ts tests/materials-filter.test.ts lib/actions/materials.ts app/teacher/materials/page.tsx components/materials-browser.tsx
git commit -m "feat(tu-luyen): cong tac cho tu luyen o trang Tai lieu"
```

---

### Task 4: `startPractice` và nhánh làm lại trong `startAttempt`

**Files:**
- Create: `lib/actions/practice.ts`
- Modify: `lib/actions/attempts.ts` (hàm `startAttempt`, dòng 53-108)

**Interfaces:**
- Consumes: `practiceScopeKey`, `practiceSkillTimeLimits`, `decideAttemptStart`, `PRACTICE_MODE` từ `lib/practice.ts`; `requireStudent` từ `lib/actions/attempts.ts`
- Produces: `startPractice(formData: FormData): Promise<never>` — đọc `materialId`, `unitId` (rỗng = cả đề), `timed` (`"1"`/`"0"`); kết thúc bằng `redirect("/student/assignments/<recipientId>")`

- [ ] **Step 1: Sửa `startAttempt` để dùng `decideAttemptStart`**

Trong `lib/actions/attempts.ts`, thêm import:

```ts
import { decideAttemptStart } from "@/lib/practice";
```

Thay toàn bộ thân hàm `startAttempt` (dòng 53-108) bằng:

```ts
export async function startAttempt(recipientId: string) {
  const student = await requireStudent();
  const recipient = await prisma.assignmentRecipient.findFirst({
    where: {
      id: recipientId,
      studentId: student.id
    },
    select: {
      id: true,
      status: true,
      assignment: { select: { mode: true } }
    }
  });

  if (!recipient) {
    throw new Error("Assignment not found for this student.");
  }

  // Bài giao chỉ làm MỘT lần: đã nộp thì trang tự chuyển sang xem kết quả.
  // Bài tự luyện thì nộp xong bấm lại là mở lượt mới (xem lib/practice.ts).
  const latestAttempt = await prisma.attempt.findFirst({
    where: {
      assignmentRecipientId: recipient.id,
      studentId: student.id
    },
    orderBy: { startedAt: "desc" }
  });

  const decision = decideAttemptStart(
    recipient.assignment.mode,
    latestAttempt
      ? {
          id: latestAttempt.id,
          status: latestAttempt.status,
          attemptRound: latestAttempt.attemptRound
        }
      : null
  );

  if (decision.kind === "resume" && latestAttempt) {
    if (latestAttempt.status === "in_progress" && recipient.status !== "in_progress") {
      await prisma.assignmentRecipient.update({
        where: { id: recipient.id },
        data: { status: "in_progress" }
      });
    }

    return latestAttempt;
  }

  const attemptRound = decision.kind === "new" ? decision.attemptRound : 1;

  return prisma.$transaction(async (tx) => {
    const attempt = await tx.attempt.create({
      data: {
        assignmentRecipientId: recipient.id,
        studentId: student.id,
        status: "in_progress",
        attemptRound
      }
    });

    await tx.assignmentRecipient.update({
      where: { id: recipient.id },
      data: { status: "in_progress" }
    });

    return attempt;
  });
}
```

- [ ] **Step 2: Tạo `lib/actions/practice.ts`**

```ts
"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStudent } from "@/lib/actions/attempts";
import { PRACTICE_MODE, practiceScopeKey, practiceSkillTimeLimits } from "@/lib/practice";
import { prisma } from "@/lib/prisma";

const startPracticeSchema = z.object({
  materialId: z.string().trim().min(1, "Thiếu đề luyện."),
  // Rỗng = luyện cả đề.
  unitId: z.string().trim().optional(),
  timed: z.enum(["0", "1"])
});

// Học viên bấm luyện một đề (hoặc một phần). Tạo ngầm "bài giao ảo" cho riêng em đó
// rồi chuyển thẳng vào phòng làm bài quen thuộc. Gọi lại lần sau sẽ dùng lại đúng bài
// giao ảo cũ — startAttempt lo việc mở lượt mới.
export async function startPractice(formData: FormData): Promise<never> {
  const student = await requireStudent();
  const parsed = startPracticeSchema.safeParse({
    materialId: formData.get("materialId"),
    unitId: formData.get("unitId") ?? undefined,
    timed: formData.get("timed")
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ.");
  }

  const unitId = parsed.data.unitId && parsed.data.unitId.length > 0 ? parsed.data.unitId : null;

  // Chặn học viên đoán URL để mở đề giáo viên đang để dành làm bài kiểm tra.
  const material = await prisma.material.findFirst({
    where: { id: parsed.data.materialId, practiceOpen: true },
    select: {
      id: true,
      title: true,
      teacherId: true,
      units: {
        orderBy: [{ unitNumber: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          title: true,
          skill: true,
          defaultTimeLimitMinutes: true
        }
      }
    }
  });

  if (!material) {
    throw new Error("Đề này không có trong thư viện tự luyện.");
  }

  const units = unitId ? material.units.filter((unit) => unit.id === unitId) : material.units;

  if (units.length === 0) {
    throw new Error("Không tìm thấy phần cần luyện.");
  }

  const scopeKey = practiceScopeKey(student.id, material.id, unitId);
  const skillTimeLimitsJson = practiceSkillTimeLimits(units, parsed.data.timed === "1");
  const title = unitId ? `${material.title} — ${units[0].title}` : material.title;

  const existing = await prisma.assignment.findUnique({
    where: { practiceScopeKey: scopeKey },
    select: { id: true, recipients: { where: { studentId: student.id }, select: { id: true } } }
  });

  if (existing && existing.recipients[0]) {
    // Lượt luyện mới có thể chọn chế độ giờ khác lượt trước — cập nhật lại.
    await prisma.assignment.update({
      where: { id: existing.id },
      data: { skillTimeLimitsJson }
    });

    redirect(`/student/assignments/${existing.recipients[0].id}`);
  }

  const recipientId = await prisma.$transaction(async (tx) => {
    const assignment = await tx.assignment.create({
      data: {
        teacherId: material.teacherId,
        classId: null,
        title,
        deadline: null,
        skillTimeLimitsJson,
        mode: PRACTICE_MODE,
        practiceScopeKey: scopeKey,
        units: {
          create: units.map((unit, index) => ({
            assignableUnitId: unit.id,
            order: index
          }))
        }
      },
      select: { id: true }
    });

    const recipient = await tx.assignmentRecipient.create({
      data: {
        assignmentId: assignment.id,
        studentId: student.id
      },
      select: { id: true }
    });

    return recipient.id;
  });

  redirect(`/student/assignments/${recipientId}`);
}
```

- [ ] **Step 3: Chạy test và kiểm kiểu**

```bash
pnpm test
npx tsc --noEmit
```

Kỳ vọng: tất cả xanh. Nếu `tsc` báo `attemptRound` không tồn tại trên `Attempt`, chạy lại `pnpm prisma generate`.

- [ ] **Step 4: Commit**

```bash
git add lib/actions/practice.ts lib/actions/attempts.ts
git commit -m "feat(tu-luyen): action startPractice va cho lam lai nhieu luot"
```

---

### Task 5: Trang `/student/practice` và mục điều hướng

**Files:**
- Create: `lib/practice-library.ts`
- Create: `tests/practice-library.test.ts`
- Create: `app/student/practice/page.tsx`
- Create: `components/practice-library.tsx`
- Modify: `components/app-shell.tsx` (mảng `navByRole.student`, dòng 23-28)

**Interfaces:**
- Consumes: `startPractice` từ `lib/actions/practice.ts` (Task 4)
- Produces:
  - `practiceProgressLabel(rounds: number, bestCorrect: number | null, totalQuestions: number): string`
  - Type `PracticeMaterialItem` dùng chung giữa page và component

- [ ] **Step 1: Viết test thất bại**

Tạo `tests/practice-library.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { practiceProgressLabel } from "@/lib/practice-library";

describe("practiceProgressLabel", () => {
  it("chưa luyện lần nào", () => {
    expect(practiceProgressLabel(0, null, 40)).toBe("Chưa luyện");
  });

  it("đã luyện và có điểm cao nhất", () => {
    expect(practiceProgressLabel(3, 32, 40)).toBe("Đã luyện 3 lần · cao nhất 32/40");
  });

  it("đã luyện nhưng chưa có điểm (bài chờ chấm)", () => {
    expect(practiceProgressLabel(1, null, 2)).toBe("Đã luyện 1 lần · chờ chấm");
  });
});
```

- [ ] **Step 2: Chạy test để chắc chắn nó đỏ**

```bash
npx vitest run tests/practice-library.test.ts
```

Kỳ vọng: FAIL — `Failed to resolve import "@/lib/practice-library"`.

- [ ] **Step 3: Tạo `lib/practice-library.ts`**

```ts
// Nhãn tiến độ tự luyện hiện trên mỗi thẻ đề. Tách khỏi UI để test được.
export function practiceProgressLabel(
  rounds: number,
  bestCorrect: number | null,
  totalQuestions: number
): string {
  if (rounds === 0) {
    return "Chưa luyện";
  }

  const lan = `Đã luyện ${rounds} lần`;

  if (bestCorrect === null) {
    return `${lan} · chờ chấm`;
  }

  return `${lan} · cao nhất ${bestCorrect}/${totalQuestions}`;
}

export type PracticeUnitItem = {
  id: string;
  title: string;
  questionCount: number;
};

export type PracticeMaterialItem = {
  id: string;
  title: string;
  skill: string;
  sourceLabel: string | null;
  unitCount: number;
  questionCount: number;
  progressLabel: string;
  units: PracticeUnitItem[];
};
```

- [ ] **Step 4: Chạy test để xác nhận xanh**

```bash
npx vitest run tests/practice-library.test.ts
```

Kỳ vọng: PASS, 3 test.

- [ ] **Step 5: Tạo `app/student/practice/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { PracticeLibrary } from "@/components/practice-library";
import { auth } from "@/lib/auth";
import { onlyPracticeRecipient } from "@/lib/practice";
import { practiceProgressLabel, type PracticeMaterialItem } from "@/lib/practice-library";
import { prisma } from "@/lib/prisma";

export default async function StudentPracticePage() {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "student") {
    redirect("/login");
  }

  const student = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true }
  });

  if (!student) {
    redirect("/waiting");
  }

  // select (KHÔNG include): content/transcript/metadataJson của unit rất nặng.
  const [materials, attempts] = await Promise.all([
    prisma.material.findMany({
      where: { practiceOpen: true },
      orderBy: [{ skill: "asc" }, { title: "asc" }],
      select: {
        id: true,
        title: true,
        skill: true,
        sourceLabel: true,
        units: {
          orderBy: [{ unitNumber: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            title: true,
            _count: { select: { questions: true } }
          }
        }
      }
    }),
    prisma.attempt.findMany({
      where: {
        studentId: student.id,
        status: { in: ["submitted", "reviewed"] },
        assignmentRecipient: onlyPracticeRecipient
      },
      select: {
        score: true,
        assignmentRecipient: {
          select: { assignment: { select: { practiceScopeKey: true } } }
        }
      }
    })
  ]);

  // Gộp số lượt và điểm cao nhất theo từng đề (mọi phạm vi của đề đó).
  const rounds = new Map<string, number>();
  const best = new Map<string, number>();

  for (const attempt of attempts) {
    const key = attempt.assignmentRecipient.assignment.practiceScopeKey;
    if (!key) continue;
    // Khoá có dạng studentId:materialId:unitId|all
    const materialId = key.split(":")[1];
    if (!materialId) continue;

    rounds.set(materialId, (rounds.get(materialId) ?? 0) + 1);

    // score là Float (điểm có thể lẻ ở bài chấm tay) — làm tròn để nhãn đọc gọn.
    if (attempt.score !== null) {
      best.set(materialId, Math.max(best.get(materialId) ?? 0, Math.round(attempt.score)));
    }
  }

  const items: PracticeMaterialItem[] = materials.map((material) => {
    const questionCount = material.units.reduce(
      (total, unit) => total + unit._count.questions,
      0
    );

    return {
      id: material.id,
      title: material.title,
      skill: material.skill,
      sourceLabel: material.sourceLabel,
      unitCount: material.units.length,
      questionCount,
      progressLabel: practiceProgressLabel(
        rounds.get(material.id) ?? 0,
        best.get(material.id) ?? null,
        questionCount
      ),
      units: material.units.map((unit) => ({
        id: unit.id,
        title: unit.title,
        questionCount: unit._count.questions
      }))
    };
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Tự luyện</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Chọn một đề để luyện thêm. Làm lại bao nhiêu lần cũng được — mỗi lần đều có
          kết quả và giải thích ngay sau khi nộp.
        </p>
      </header>
      <PracticeLibrary items={items} />
    </div>
  );
}
```

- [ ] **Step 6: Tạo `components/practice-library.tsx`**

```tsx
"use client";

import { useMemo, useState } from "react";
import { startPractice } from "@/lib/actions/practice";
import type { PracticeMaterialItem } from "@/lib/practice-library";

const SKILL_LABELS: Record<string, string> = {
  all: "Tất cả",
  listening: "Listening",
  reading: "Reading",
  writing: "Writing",
  speaking: "Speaking"
};

const chipClass =
  "rounded-full border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:border-primary";
const activeChipClass =
  "rounded-full border border-primary bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary";

type PracticeTarget = {
  materialId: string;
  unitId: string | null;
  label: string;
};

export function PracticeLibrary({ items }: { items: PracticeMaterialItem[] }) {
  const [search, setSearch] = useState("");
  const [skill, setSkill] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [target, setTarget] = useState<PracticeTarget | null>(null);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();

    return items.filter((item) => {
      if (skill !== "all" && item.skill !== skill) return false;
      if (!query) return true;
      return `${item.title} ${item.sourceLabel ?? ""}`.toLowerCase().includes(query);
    });
  }, [items, search, skill]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Tìm đề..."
          className="w-64 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/40 focus:ring-2"
        />
        <div className="flex flex-wrap items-center gap-1.5">
          {Object.keys(SKILL_LABELS).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setSkill(key)}
              className={skill === key ? activeChipClass : chipClass}
            >
              {SKILL_LABELS[key]}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Chưa có đề nào trong thư viện tự luyện. Hãy nhắc giáo viên mở thêm đề nhé.
        </p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {visible.map((item) => (
            <li key={item.id} className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm font-semibold">{item.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {item.sourceLabel ? `${item.sourceLabel} · ` : ""}
                {item.unitCount} phần · {item.questionCount} câu
              </p>
              <p className="mt-1 text-xs font-medium text-primary">{item.progressLabel}</p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setTarget({ materialId: item.id, unitId: null, label: item.title })
                  }
                  className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
                >
                  Luyện cả đề
                </button>
                <button
                  type="button"
                  onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                  className="rounded-md border border-border px-3 py-2 text-sm font-semibold hover:border-primary"
                >
                  {expanded === item.id ? "Ẩn các phần" : "Luyện từng phần"}
                </button>
              </div>

              {expanded === item.id ? (
                <ul className="mt-3 space-y-1.5 border-t border-border pt-3">
                  {item.units.map((unit) => (
                    <li key={unit.id} className="flex items-center justify-between gap-2">
                      <span className="text-sm">
                        {unit.title}{" "}
                        <span className="text-xs text-muted-foreground">
                          ({unit.questionCount} câu)
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setTarget({
                            materialId: item.id,
                            unitId: unit.id,
                            label: `${item.title} — ${unit.title}`
                          })
                        }
                        className="rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold hover:border-primary"
                      >
                        Luyện phần này
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {target ? <TimeChoiceDialog target={target} onClose={() => setTarget(null)} /> : null}
    </div>
  );
}

function TimeChoiceDialog({
  target,
  onClose
}: {
  target: PracticeTarget;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-lg">
        <p className="text-sm font-semibold">{target.label}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Em muốn làm bài này thế nào?
        </p>

        <div className="mt-4 space-y-2">
          <form action={startPractice}>
            <input type="hidden" name="materialId" value={target.materialId} />
            <input type="hidden" name="unitId" value={target.unitId ?? ""} />
            <input type="hidden" name="timed" value="1" />
            <button
              type="submit"
              className="w-full rounded-md bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Tính giờ như thi thật
            </button>
          </form>

          <form action={startPractice}>
            <input type="hidden" name="materialId" value={target.materialId} />
            <input type="hidden" name="unitId" value={target.unitId ?? ""} />
            <input type="hidden" name="timed" value="0" />
            <button
              type="submit"
              className="w-full rounded-md border border-border px-3 py-2.5 text-sm font-semibold hover:border-primary"
            >
              Không tính giờ
            </button>
          </form>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Huỷ
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Thêm mục điều hướng**

Trong `components/app-shell.tsx`, thêm vào mảng `student` (sau mục `/student`):

```ts
    { href: "/student/practice", label: "Tự luyện", hint: "Thư viện đề luyện thêm", icon: "book" },
```

- [ ] **Step 8: Chạy test và kiểm kiểu**

```bash
pnpm test
npx tsc --noEmit
```

Kỳ vọng: tất cả xanh.

- [ ] **Step 9: Commit**

```bash
git add lib/practice-library.ts tests/practice-library.test.ts app/student/practice/page.tsx components/practice-library.tsx components/app-shell.tsx
git commit -m "feat(tu-luyen): trang thu vien tu luyen cho hoc vien"
```

---

### Task 6: Tách tab Tự luyện ở Lịch sử và Chấm bài

**Files:**
- Modify: `app/student/history/page.tsx`
- Modify: `app/teacher/review/page.tsx`
- Modify: `app/teacher/page.tsx` (nhãn "Tự luyện" ở danh sách gần đây)

**Interfaces:**
- Consumes: `excludePracticeRecipient`, `onlyPracticeRecipient` từ `lib/practice.ts` (Task 1)
- Produces: cả hai trang nhận `searchParams.tab` với giá trị `"practice"` (mặc định là bài giao)

- [ ] **Step 1: Tách tab ở `app/student/history/page.tsx`**

Thêm import:

```ts
import { excludePracticeRecipient, onlyPracticeRecipient } from "@/lib/practice";
```

Đổi chữ ký hàm để nhận `searchParams`:

```tsx
export default async function StudentHistoryPage({
  searchParams
}: {
  searchParams?: { tab?: string };
}) {
```

Ngay sau khi có `student`, tính tab và ghép vào `where` của `prisma.attempt.findMany`:

```ts
  const isPractice = searchParams?.tab === "practice";
  const recipientFilter = isPractice ? onlyPracticeRecipient : excludePracticeRecipient;
```

Trong query `prisma.attempt.findMany`, thêm vào `where`:

```ts
      assignmentRecipient: recipientFilter,
```

Thêm hai link tab ngay trên bảng kết quả:

```tsx
<div className="flex items-center gap-1.5">
  <Link
    href="/student/history"
    className={!isPractice ? activeTabClass : tabClass}
  >
    Bài giao
  </Link>
  <Link
    href="/student/history?tab=practice"
    className={isPractice ? activeTabClass : tabClass}
  >
    Tự luyện
  </Link>
</div>
```

Khai báo hai class cạnh các hằng class hiện có trong file:

```ts
const tabClass =
  "rounded-full border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:border-primary";
const activeTabClass =
  "rounded-full border border-primary bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary";
```

- [ ] **Step 2: Tách tab ở `app/teacher/review/page.tsx`**

Thêm import:

```ts
import { excludePracticeRecipient, onlyPracticeRecipient } from "@/lib/practice";
```

Nhận `searchParams` giống Step 1 (`const isPractice = searchParams?.tab === "practice";`), rồi trong query `prisma.attempt.findMany` (dòng ~10) đổi `where`:

```ts
    where: {
      status: { in: ["submitted", "reviewed"] },
      assignmentRecipient: {
        assignment: {
          teacherId: teacher.id,
          ...(isPractice ? onlyPracticeAssignment : excludePracticeAssignment),
          // Chỉ bài THỰC SỰ cần chấm tay (có câu viết luận / ghi âm). Bài Viết dạng
          // điền chỗ trống đã tự chấm nên không vào hàng đợi.
          units: { some: { assignableUnit: manualGradedUnitWhere } }
        }
      }
    },
```

Thêm hai link tab `/teacher/review` và `/teacher/review?tab=practice` kèm số đếm, dùng cùng class tab như Step 1. File này hiện chưa import `Link` — thêm `import Link from "next/link";`.

Số đếm lấy bằng hai `prisma.attempt.count` chạy song song với query trên:

```ts
  const [homeworkCount, practiceCount] = await Promise.all([
    prisma.attempt.count({
      where: {
        status: { in: ["submitted", "reviewed"] },
        assignmentRecipient: {
          assignment: {
            teacherId: teacher.id,
            ...excludePracticeAssignment,
            units: { some: { assignableUnit: manualGradedUnitWhere } }
          }
        }
      }
    }),
    prisma.attempt.count({
      where: {
        status: { in: ["submitted", "reviewed"] },
        assignmentRecipient: {
          assignment: {
            teacherId: teacher.id,
            ...onlyPracticeAssignment,
            units: { some: { assignableUnit: manualGradedUnitWhere } }
          }
        }
      }
    })
  ]);
```

- [ ] **Step 3: Thêm nhãn "Tự luyện" ở trang chủ giáo viên**

Trong `app/teacher/page.tsx`, ở query `prisma.attempt.findMany` (dòng ~55), thêm vào `select`:

```ts
        assignmentRecipient: {
          select: { assignment: { select: { title: true, mode: true } } }
        },
```

Nếu `select` đã có `assignmentRecipient`, chỉ cần bổ sung `mode: true` vào phần `assignment`.

Trong phần render mỗi dòng, thêm nhãn:

```tsx
{attempt.assignmentRecipient.assignment.mode === PRACTICE_MODE ? (
  <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
    Tự luyện
  </span>
) : null}
```

Thêm import `import { PRACTICE_MODE } from "@/lib/practice";`.

- [ ] **Step 4: Chạy test và kiểm kiểu**

```bash
pnpm test
npx tsc --noEmit
```

Kỳ vọng: tất cả xanh.

- [ ] **Step 5: Commit**

```bash
git add app/student/history/page.tsx app/teacher/review/page.tsx app/teacher/page.tsx
git commit -m "feat(tu-luyen): tach tab Tu luyen o Lich su va Cham bai"
```

---

### Task 7: Xếp hạng và thống kê chỉ tính lượt đầu

**Files:**
- Modify: `lib/class-ranking.ts` (biến `ofThisClass`, dòng ~221; query `attempts`, dòng ~232)
- Modify: `app/student/stats/page.tsx` (query `prisma.attempt.findMany`, dòng ~28)
- Modify: `app/student/page.tsx` (query `prisma.attempt.findMany`, dòng ~99)
- Modify: `tests/class-ranking.test.ts`

**Interfaces:**
- Consumes: `countsForStats`, `excludePracticeAssignment`, `onlyPracticeAssignment`, `PRACTICE_MODE` từ `lib/practice.ts` (Task 1)
- Produces: không có API mới

- [ ] **Step 1: Viết test thất bại cho `lib/class-ranking.ts`**

Thêm vào `tests/class-ranking.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("xếp hạng và bài tự luyện", () => {
  const source = readFileSync(join(process.cwd(), "lib", "class-ranking.ts"), "utf8");

  // Bài giao ảo có classId = null nên rơi đúng vào nhánh "bài chung" của
  // ofThisClass — không chặn thì mọi lượt luyện đều đẩy hạng.
  it("chặn bài tự luyện lọt vào nhánh classId null", () => {
    expect(source).toContain('from "@/lib/practice"');
    expect(source).toContain("excludePracticeAssignment");
  });

  // Làm lại không giới hạn nhưng chỉ lượt ĐẦU của mỗi đề được tính điểm.
  it("chỉ lấy lượt đầu của bài tự luyện", () => {
    expect(source).toContain("countsForStats");
  });

  // Tỉ lệ hoàn thành đo việc nộp bài GIAO, không dính tự luyện.
  it("tỉ lệ hoàn thành không đếm recipient của bài tự luyện", () => {
    expect(source).toContain("excludePracticeAssignment");
  });
});
```

- [ ] **Step 2: Chạy test để chắc chắn nó đỏ**

```bash
npx vitest run tests/class-ranking.test.ts
```

Kỳ vọng: FAIL — không tìm thấy `from "@/lib/practice"`.

- [ ] **Step 3: Sửa `lib/class-ranking.ts`**

Thêm import:

```ts
import {
  countsForStats,
  excludePracticeAssignment,
  onlyPracticeAssignment
} from "@/lib/practice";
```

Thay khối `ofThisClass` và query (dòng ~221-255):

```ts
  // Chỉ tính bài giao của chính lớp này. classId null = bài giao chung cho nhiều
  // lớp (hoặc bài cũ chưa gắn được lớp) -> vẫn tính, để không mất dữ liệu.
  const ofThisClass = {
    assignment: { OR: [{ classId }, { classId: null }], ...excludePracticeAssignment }
  };

  // Bài tự luyện không thuộc lớp nào nhưng vẫn tính vào điểm — chỉ LƯỢT ĐẦU của mỗi
  // đề, để làm lại nhiều lần không đẩy được hạng.
  const firstPracticeRound = { assignment: onlyPracticeAssignment };

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
            where: {
              OR: [
                { assignmentRecipient: ofThisClass },
                { assignmentRecipient: firstPracticeRound, ...countsForStats }
              ]
            },
            select: {
              id: true,
              scorePercent: true,
              startedAt: true,
              submittedAt: true,
              review: {
                select: { overallBand: true, reviewedAt: true }
              }
            }
          },
          // Tỉ lệ hoàn thành chỉ đo việc nộp bài GIAO — không đếm bài tự luyện.
          recipients: {
            where: ofThisClass,
            select: {
              status: true,
              assignedAt: true,
              submittedAt: true
            }
          }
        }
      }
    }
  });
```

- [ ] **Step 4: Chạy test để xác nhận xanh**

```bash
npx vitest run tests/class-ranking.test.ts
```

Kỳ vọng: PASS.

- [ ] **Step 5: Sửa `app/student/stats/page.tsx`**

Thêm import:

```ts
import { countsForStats } from "@/lib/practice";
```

Đổi `where` của query (dòng ~29):

```ts
    // Lượt luyện lại (round ≥ 2) không phản ánh năng lực thật -> không vào thống kê.
    where: {
      studentId: student.id,
      status: { in: ["submitted", "reviewed"] },
      ...countsForStats
    },
```

- [ ] **Step 6: Sửa `app/student/page.tsx`**

Query `prisma.attempt.findMany` (dòng ~99) đang nuôi **cả** chuỗi hoạt động (tính mọi lượt) lẫn điểm xếp hạng (chỉ lượt đầu). Giữ nguyên `where`, chỉ thêm `attemptRound` vào `select`:

```ts
      select: {
        scorePercent: true,
        startedAt: true,
        submittedAt: true,
        status: true,
        attemptRound: true,
        review: { select: { overallBand: true } }
      }
```

Ở chỗ tính điểm xếp hạng (nơi gọi `studentRankingScore`), lọc trước khi truyền vào:

```ts
  // Chuỗi hoạt động tính MỌI lượt (kể cả luyện lại); điểm xếp hạng chỉ lượt đầu.
  const scoringAttempts = attempts.filter((attempt) => attempt.attemptRound === 1);
```

Truyền `scoringAttempts` cho `studentRankingScore`, giữ `attempts` cho `calculateWeekStreak`.

- [ ] **Step 7: Chạy toàn bộ test và kiểm kiểu**

```bash
pnpm test
npx tsc --noEmit
```

Kỳ vọng: tất cả xanh.

- [ ] **Step 8: Commit**

```bash
git add lib/class-ranking.ts app/student/stats/page.tsx app/student/page.tsx tests/class-ranking.test.ts
git commit -m "feat(tu-luyen): xep hang va thong ke chi tinh luot dau"
```

---

### Task 8: Kiểm chứng trên trình duyệt và build

**Files:**
- Không sửa file nào (trừ khi phát hiện lỗi)

**Interfaces:**
- Consumes: toàn bộ Task 1-7
- Produces: xác nhận luồng chạy thật

- [ ] **Step 1: Chạy đủ test và build**

```bash
pnpm test
pnpm build
```

Kỳ vọng: test xanh, build thành công. Nếu build báo thiếu cột, chạy lại `npx prisma db push`.

- [ ] **Step 2: Mở dev server**

Dùng `preview_start` với `.claude/launch.json` (đừng chạy `pnpm dev` qua Bash).

- [ ] **Step 3: Nhờ người dùng đăng nhập**

Không tự nhập mật khẩu. Nhắn người dùng đăng nhập tài khoản giáo viên rồi báo lại, sau đó mới thao tác tiếp.

- [ ] **Step 4: Kiểm phía giáo viên**

- Vào `/teacher/materials`, bấm **Cho tự luyện** trên một đề Reading → nút đổi thành "Đang cho tự luyện", có toast.
- Bấm chip **Đang mở tự luyện** → chỉ còn đề vừa mở.
- Vào `/teacher/assignments` và `/teacher/calendar` → **không** thấy bài giao ảo nào.

- [ ] **Step 5: Kiểm phía học viên**

Nhờ người dùng đăng nhập tài khoản học viên, rồi:

- Vào `/student/practice` → thấy đề vừa mở.
- Bấm **Luyện từng phần** → chọn một phần → chọn **Không tính giờ** → vào phòng làm bài, không có đồng hồ.
- Làm vài câu, bấm Nộp bài (ghi đè `window.confirm = () => true` trước khi bấm, nếu không CDP sẽ đơ).
- Xem trang kết quả: có điểm, có giải thích.
- Quay lại `/student/practice` → nhãn đổi thành "Đã luyện 1 lần · cao nhất N/M".
- Bấm luyện lại đề đó, lần này chọn **Tính giờ như thi thật** → có đồng hồ đếm ngược.
- Vào `/student/history?tab=practice` → thấy đủ hai lượt.
- Vào `/student` → **không** thấy bài tự luyện trong danh sách bài được giao.

- [ ] **Step 6: Chụp màn hình làm bằng chứng**

Dùng `computer {action: "screenshot"}` cho trang `/student/practice` và trang kết quả một lượt luyện.

- [ ] **Step 7: Commit nếu có sửa gì trong lúc kiểm**

Liệt kê từng file đã sửa — **tuyệt đối không dùng `git add -A` hay `git add .`**: cây làm việc đang có hàng chục file `tmp/*.json` và `tsconfig.tsbuildinfo` chưa commit, không thuộc tính năng này.

```bash
git add <đường-dẫn-từng-file-đã-sửa>
git commit -m "fix(tu-luyen): sua loi phat hien khi kiem tren trinh duyet"
```

---

## Ghi chú khi triển khai xong

- Chưa push là chưa lên prod. Push lên `feature/ielts-platform-mvp` sẽ tự deploy Vercel; `scripts/ensure-db.mjs` chạy trong bước build nên ba cột mới tự lên DB prod.
- Sau khi deploy, mở lại `/teacher/materials` trên prod và bật "Cho tự luyện" cho vài đề — mặc định mọi đề đều đóng nên thư viện sẽ trống.
