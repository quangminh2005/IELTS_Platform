# Phiên làm bài theo từng kỹ năng — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho phép học sinh tự chọn làm kỹ năng nào trước khi một bài giao có nhiều kỹ năng; mỗi kỹ năng là một phiên riêng có đồng hồ riêng, nộp/khoá độc lập, và xem kết quả ngay sau khi nộp.

**Architecture:** Giữ nguyên "một `Attempt` cho mỗi bài (recipient)". Thêm bảng con `AttemptSkill` lưu trạng thái/đồng hồ/khoá/điểm theo từng kỹ năng, và cột `Assignment.skillTimeLimitsJson` cho giáo viên đặt thời gian mỗi kỹ năng. `Attempt` chỉ chuyển `submitted` (và ghi điểm tổng) khi kỹ năng cuối được nộp → gamification/xếp hạng/lịch sử chạy đúng một lần như cũ.

**Tech Stack:** Next.js 14 App Router, Prisma + PostgreSQL (Neon), TypeScript strict, zod, Vitest. Package manager: pnpm.

## Global Constraints

- Chuỗi hiển thị và comment code bằng **tiếng Việt**; rubric đề thi (TRUE/FALSE/NG…) giữ tiếng Anh.
- Enum lưu dưới dạng cột `String` (không dùng Prisma enum). Giá trị hợp lệ ghi ở comment đầu `schema.prisma` + zod tương ứng + test cấu trúc — giữ 3 nơi đồng bộ.
- Mọi server action bắt đầu bằng `requireTeacher()` / `requireStudent()`; luôn scope truy vấn Prisma theo người dùng đã đăng nhập.
- **Auto-timeout luôn bị từ chối**: hết giờ chỉ hiển thị "Hết giờ", học sinh tự bấm Nộp.
- Skill values: `"listening" | "reading" | "writing" | "speaking"`. Thứ tự hiển thị: dùng `SKILL_TIME_ORDER` trong `lib/skill-times.ts`.
- Chạy `pnpm build` (gồm `prisma generate`) và `pnpm test` để xác minh; chạy migrate trên DB local Neon (không lật schema provider).

---

## File Structure

**Tạo mới:**
- `lib/attempt-grading.ts` — helper `gradeUnits(...)` chấm một tập unit (tách từ `submitAttempt`).
- `lib/skill-sessions.ts` — helper thuần: gom unit theo kỹ năng, thứ tự kỹ năng, seed danh sách kỹ năng của một bài.
- `components/skill-time-inputs.tsx` — client component: ô nhập thời gian mỗi kỹ năng theo unit đang chọn.
- `components/skill-picker.tsx` — màn chọn kỹ năng (landing) trong phòng làm bài.
- `tests/attempt-grading.test.ts`, `tests/skill-sessions.test.ts` — unit test cho helper mới.

**Sửa:**
- `prisma/schema.prisma` — model `AttemptSkill`; cột `Assignment.skillTimeLimitsJson`; quan hệ `Attempt.skills`.
- `tests/foundation.test.ts` — thêm `AttemptSkill`, `skillTimeLimitsJson` vào danh sách bắt buộc.
- `lib/actions/assignments.ts` — đọc/ghi `skillTimeLimitsJson` (create + update).
- `lib/actions/attempts.ts` — `startSkillSession`, `submitSkill`, seed `AttemptSkill`; refactor `submitAttempt` dùng `gradeUnits`.
- `components/assignment-builder.tsx` + `components/assignment-list.tsx` (form sửa bài) — chèn `SkillTimeInputs`.
- `components/attempt-workspace.tsx` — picker + phiên theo kỹ năng + đồng hồ/nộp/khoá theo kỹ năng.
- `app/student/assignments/[recipientId]/page.tsx` — nạp `attempt.skills` + `skillTimeLimitsJson`; seed AttemptSkill.
- `app/student/results/[attemptId]/page.tsx` — lọc `?skill=` cho xem kết quả tức thời.
- `lib/skill-parse.ts` (mới, nhỏ) — parse `skillTimeLimitsJson` an toàn (giống `parsePartTimes`).

---

## Task 1: Schema — `AttemptSkill` + `Assignment.skillTimeLimitsJson`

**Files:**
- Modify: `prisma/schema.prisma` (model `Assignment` ~133-148; model `Attempt` ~176-197; thêm model mới sau `Attempt`)
- Modify: `tests/foundation.test.ts:35` (danh sách model) và `:43-54` (danh sách field)

**Interfaces:**
- Produces: model `AttemptSkill { id, attemptId, skill, status, startedAt, submittedAt, elapsedSeconds, score, scorePercent }` với `@@unique([attemptId, skill])`; `Attempt.skills AttemptSkill[]`; `Assignment.skillTimeLimitsJson String?`.

- [ ] **Step 1: Cập nhật test cấu trúc trước (đỏ)**

Trong `tests/foundation.test.ts`, thêm `"AttemptSkill"` vào mảng model (sau `"Attempt",` dòng 35) và `"skillTimeLimitsJson"` vào mảng field (sau `"criteriaScoresJson",` dòng ~52):

```typescript
      "Attempt",
      "AttemptSkill",
      "Answer",
```
```typescript
      "criteriaScoresJson",
      "skillTimeLimitsJson",
      "@@unique([attemptId])",
```

- [ ] **Step 2: Chạy test để thấy đỏ**

Run: `pnpm test -- tests/foundation.test.ts`
Expected: FAIL — schema chưa chứa `model AttemptSkill` / `skillTimeLimitsJson`.

- [ ] **Step 3: Thêm cột vào `Assignment`**

Trong `model Assignment`, ngay dưới `timeLimitMinutes Int?` (dòng 140):

```prisma
  timeLimitMinutes Int?
  // Thời gian làm bài theo từng kỹ năng: JSON { "listening": 30, "reading": 60 } (phút).
  // Kỹ năng không có khóa = không đếm ngược. timeLimitMinutes giữ làm fallback/1 kỹ năng.
  skillTimeLimitsJson String?
```

- [ ] **Step 4: Thêm quan hệ vào `Attempt` và model `AttemptSkill`**

Trong `model Attempt`, thêm dòng quan hệ cạnh `answers`/`highlights` (sau `highlights Highlight[]`):

```prisma
  answers               Answer[]
  highlights            Highlight[]
  skills                AttemptSkill[]
  review                TeacherReview?
```

Thêm model mới ngay sau khối `model Attempt { ... }` (sau dòng 197):

```prisma
// Trạng thái làm bài theo từng kỹ năng trong một Attempt. Mỗi kỹ năng là một phiên
// riêng: đồng hồ riêng (startedAt + giới hạn), khoá khi nộp, điểm tức thời của kỹ năng.
// status: "not_started" | "in_progress" | "submitted".
model AttemptSkill {
  id             String    @id @default(cuid())
  attemptId      String
  skill          String
  status         String    @default("not_started")
  startedAt      DateTime?
  submittedAt    DateTime?
  elapsedSeconds Int       @default(0)
  score          Float?
  scorePercent   Float?
  attempt        Attempt   @relation(fields: [attemptId], references: [id], onDelete: Cascade)

  @@unique([attemptId, skill])
}
```

- [ ] **Step 5: Đồng bộ schema (dự án dùng `db push`, KHÔNG có migrations)**

Repo này không có thư mục `prisma/migrations` — đồng bộ schema bằng `db push`, và prod
đồng bộ qua `scripts/ensure-db.mjs` (chỉ file này chạy khi deploy, không chạy `db push`).

1. Local: `npx prisma db push` (thêm cột nullable + bảng mới là additive — không được
   hỏi reset/không mất dữ liệu; nếu bị cảnh báo mất dữ liệu thì DỪNG).
2. Prod parity: thêm vào mảng `statements` của `scripts/ensure-db.mjs` (idempotent):
   `ALTER TABLE "Assignment" ADD COLUMN IF NOT EXISTS "skillTimeLimitsJson" TEXT;`, một
   `CREATE TABLE IF NOT EXISTS "AttemptSkill" (...)` (đủ cột + `AttemptSkill_pkey`), một
   `CREATE UNIQUE INDEX IF NOT EXISTS "AttemptSkill_attemptId_skill_key"`, và một khối
   `DO $$ ... $$` thêm FK `AttemptSkill_attemptId_fkey → Attempt(id) ON DELETE CASCADE`
   có kiểm tra `pg_constraint` để không trùng.
3. Chạy `node scripts/ensure-db.mjs` một lần để xác nhận idempotent (in dòng OK).
Expected: bảng `AttemptSkill` + cột `skillTimeLimitsJson` có trên DB local; `ensure-db.mjs`
chạy sạch lỗi.

- [ ] **Step 6: Chạy lại test cấu trúc (xanh)**

Run: `pnpm test -- tests/foundation.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma scripts/ensure-db.mjs tests/foundation.test.ts
git commit -m "feat: schema AttemptSkill + Assignment.skillTimeLimitsJson"
```

---

## Task 2: Parse helper `skillTimeLimitsJson`

**Files:**
- Create: `lib/skill-parse.ts`
- Create test: `tests/skill-parse.test.ts`

**Interfaces:**
- Produces: `parseSkillTimeLimits(json: string | null | undefined): Record<string, number>` — map `skill -> phút`, bỏ giá trị không hợp lệ (≤0, không phải số). `serializeSkillTimeLimits(map: Record<string, number>): string | null` — trả `null` nếu rỗng.

- [ ] **Step 1: Viết test (đỏ)**

`tests/skill-parse.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { parseSkillTimeLimits, serializeSkillTimeLimits } from "@/lib/skill-parse";

describe("skill time limits", () => {
  it("parses valid minutes and drops bad values", () => {
    expect(parseSkillTimeLimits('{"listening":30,"reading":0,"writing":"x"}')).toEqual({
      listening: 30
    });
  });

  it("returns {} for null/broken json", () => {
    expect(parseSkillTimeLimits(null)).toEqual({});
    expect(parseSkillTimeLimits("not json")).toEqual({});
  });

  it("serializes to null when empty", () => {
    expect(serializeSkillTimeLimits({})).toBeNull();
    expect(serializeSkillTimeLimits({ reading: 60 })).toBe('{"reading":60}');
  });
});
```

- [ ] **Step 2: Chạy test (đỏ)**

Run: `pnpm test -- tests/skill-parse.test.ts`
Expected: FAIL — module chưa tồn tại.

- [ ] **Step 3: Viết `lib/skill-parse.ts`**

```typescript
// Parse/serialize Assignment.skillTimeLimitsJson: map kỹ năng -> số phút giới hạn.
// Bỏ qua giá trị không hợp lệ; JSON hỏng/null -> {}.
export function parseSkillTimeLimits(
  json: string | null | undefined
): Record<string, number> {
  if (!json) {
    return {};
  }

  try {
    const parsed = JSON.parse(json) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    const result: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      const minutes = Number(value);
      if (key && Number.isFinite(minutes) && minutes > 0) {
        result[key] = Math.floor(minutes);
      }
    }
    return result;
  } catch {
    return {};
  }
}

export function serializeSkillTimeLimits(
  map: Record<string, number>
): string | null {
  const clean: Record<string, number> = {};
  for (const [skill, minutes] of Object.entries(map)) {
    if (Number.isFinite(minutes) && minutes > 0) {
      clean[skill] = Math.floor(minutes);
    }
  }
  return Object.keys(clean).length > 0 ? JSON.stringify(clean) : null;
}
```

- [ ] **Step 4: Chạy test (xanh)**

Run: `pnpm test -- tests/skill-parse.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/skill-parse.ts tests/skill-parse.test.ts
git commit -m "feat: parse/serialize skillTimeLimitsJson"
```

---

## Task 3: Giáo viên đặt thời gian mỗi kỹ năng (form + action)

**Files:**
- Create: `components/skill-time-inputs.tsx`
- Modify: `components/assignment-builder.tsx` (chèn dưới fieldset "Các phần", ~85)
- Modify: `components/assignment-list.tsx` (form sửa bài — chèn tương tự; xem Step 5)
- Modify: `lib/actions/assignments.ts` (`assignmentSchema`, `createAssignment`, `updateAssignment`)

**Interfaces:**
- Consumes: `parseSkillTimeLimits`, `serializeSkillTimeLimits` (Task 2); `UnitPickerMaterial` (`components/unit-picker.tsx`).
- Produces: form field ẩn `skillTime_<skill>` (số phút) đọc bởi action; `SkillTimeInputs` component nhận `unitSkills: Record<string,string>` và `defaultValues?: Record<string,number>`.

- [ ] **Step 1: Viết `components/skill-time-inputs.tsx`**

Client component: theo dõi checkbox `name="unitIds"` trong cùng `<form>`, suy ra tập kỹ năng đang chọn, render một ô số cho mỗi kỹ năng.

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { SKILL_TIME_LABELS, SKILL_TIME_ORDER } from "@/lib/skill-times";

type SkillTimeInputsProps = {
  // unitId -> skill, để suy ra kỹ năng từ các unit đang được tick.
  unitSkills: Record<string, string>;
  // Giá trị phút mặc định theo kỹ năng (khi sửa bài đã giao).
  defaultValues?: Record<string, number>;
};

export function SkillTimeInputs({ unitSkills, defaultValues = {} }: SkillTimeInputsProps) {
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);

  useEffect(() => {
    const form = document.querySelector<HTMLFormElement>("form");
    if (!form) return;

    const recompute = () => {
      const checked = form.querySelectorAll<HTMLInputElement>(
        'input[name="unitIds"]:checked'
      );
      const skills = new Set<string>();
      checked.forEach((input) => {
        const skill = unitSkills[input.value];
        if (skill) skills.add(skill);
      });
      const ordered = SKILL_TIME_ORDER.filter((s) => skills.has(s)).concat(
        Array.from(skills).filter(
          (s) => !SKILL_TIME_ORDER.includes(s as (typeof SKILL_TIME_ORDER)[number])
        )
      );
      setSelectedSkills(ordered);
    };

    recompute();
    form.addEventListener("change", recompute);
    return () => form.removeEventListener("change", recompute);
  }, [unitSkills]);

  const label = useMemo(
    () => (skill: string) => SKILL_TIME_LABELS[skill] ?? skill,
    []
  );

  if (selectedSkills.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
        Chọn phần ở trên để đặt thời gian cho từng kỹ năng.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {selectedSkills.map((skill) => (
        <div key={skill} className="flex items-center gap-3">
          <span className="w-24 text-sm font-medium">{label(skill)}</span>
          <input
            name={`skillTime_${skill}`}
            type="number"
            min={1}
            defaultValue={defaultValues[skill] ?? ""}
            placeholder="phút"
            className="w-28 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/40 focus:border-primary focus:ring-2"
          />
          <span className="text-xs text-muted-foreground">phút</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Chèn vào `assignment-builder.tsx`**

`AssignmentBuilder` là server component. Dựng `unitSkills` từ `materials` và render `SkillTimeInputs` ngay sau fieldset "Các phần" (sau dòng 85, trước fieldset "Học viên"). Thêm import ở đầu file:

```tsx
import { SkillTimeInputs } from "@/components/skill-time-inputs";
```

Trong thân component, trước `return`:

```tsx
  const unitSkills: Record<string, string> = {};
  materials.forEach((material) =>
    material.units.forEach((unit) => {
      unitSkills[unit.id] = unit.skill;
    })
  );
```

Chèn fieldset mới:

```tsx
        <fieldset>
          <legend className="text-sm font-semibold">Thời gian mỗi kỹ năng</legend>
          <p className="mt-1 text-xs text-muted-foreground">
            Mỗi kỹ năng là một phiên riêng, có đồng hồ riêng. Bỏ trống = không giới hạn.
          </p>
          <div className="mt-3">
            <SkillTimeInputs unitSkills={unitSkills} />
          </div>
        </fieldset>
```

- [ ] **Step 3: Đọc field trong `assignmentSchema` + `createAssignment`**

Trong `lib/actions/assignments.ts`, thêm import:

```typescript
import { serializeSkillTimeLimits } from "@/lib/skill-parse";
import { SKILL_TIME_ORDER } from "@/lib/skill-times";
```

Thêm helper đọc thời-gian-theo-kỹ-năng từ `FormData` (đặt cạnh `uniqueInOrder`):

```typescript
// Đọc các ô skillTime_<skill> thành map { skill: phút }. Bỏ ô trống/không hợp lệ.
function readSkillTimeLimits(formData: FormData): Record<string, number> {
  const map: Record<string, number> = {};
  for (const skill of SKILL_TIME_ORDER) {
    const raw = formData.get(`skillTime_${skill}`);
    const minutes = Number(raw);
    if (raw != null && String(raw).trim() !== "" && Number.isFinite(minutes) && minutes > 0) {
      map[skill] = Math.floor(minutes);
    }
  }
  return map;
}
```

Trong `createAssignment`, sau `await verifyUnitsAndStudents(...)`, tính giá trị và truyền vào `data`:

```typescript
  const skillTimeLimitsJson = serializeSkillTimeLimits(readSkillTimeLimits(formData));
```
Trong `prisma.assignment.create({ data: { ... } })`, thêm cạnh `timeLimitMinutes`:
```typescript
      timeLimitMinutes: parsed.data.timeLimitMinutes ?? null,
      skillTimeLimitsJson,
```

- [ ] **Step 4: Cập nhật `updateAssignment`**

Trong `updateAssignment`, tính `skillTimeLimitsJson` tương tự (sau `verifyUnitsAndStudents`), rồi thêm vào `prisma.assignment.update({ data: { ... } })` cạnh `timeLimitMinutes`:

```typescript
        timeLimitMinutes: parsed.data.timeLimitMinutes ?? null,
        skillTimeLimitsJson: serializeSkillTimeLimits(readSkillTimeLimits(formData)),
```

- [ ] **Step 5: Chèn `SkillTimeInputs` vào form sửa bài (`assignment-list.tsx`)**

Mở `components/assignment-list.tsx`, tìm form dùng `updateAssignment` (nơi render `UnitPicker` với `selectedUnitIds={assignment.unitIds}`, ~224). Dựng `unitSkills` từ `materials` (đã có sẵn trong props của component đó — nếu chưa, truyền xuống từ trang teacher). Render:

```tsx
import { SkillTimeInputs } from "@/components/skill-time-inputs";
// ...
<SkillTimeInputs
  unitSkills={unitSkills}
  defaultValues={parseSkillTimeLimits(assignment.skillTimeLimitsJson)}
/>
```

Bổ sung `skillTimeLimitsJson: string | null` vào type của assignment và vào truy vấn trang `app/teacher/assignments/page.tsx` (select thêm `skillTimeLimitsJson: true`). Import `parseSkillTimeLimits` từ `@/lib/skill-parse`.

- [ ] **Step 6: Build + kiểm tra tay**

Run: `pnpm build`
Expected: build thành công (TypeScript pass).
Kiểm tra tay: mở `/teacher/assignments`, chọn phần Listening + Reading → thấy 2 ô "Listening"/"Reading"; tạo bài; kiểm DB có `skillTimeLimitsJson`.

- [ ] **Step 7: Commit**

```bash
git add components/skill-time-inputs.tsx components/assignment-builder.tsx components/assignment-list.tsx lib/actions/assignments.ts app/teacher/assignments/page.tsx
git commit -m "feat: giáo viên đặt thời gian mỗi kỹ năng khi giao bài"
```

---

## Task 4: Tách helper chấm điểm `gradeUnits`

**Files:**
- Create: `lib/attempt-grading.ts`
- Create test: `tests/attempt-grading.test.ts`
- Modify: `lib/actions/attempts.ts` (`submitAttempt` dùng helper)

**Interfaces:**
- Consumes: `gradeAnswer`, `gradeAttempt`, `AttemptItem` (`lib/grading.ts`); `detectMultiSelectGroups`, `gradeMultiSelectGroup` (`lib/multi-select.ts`); `parseQuestionOptions` (`lib/question-interactions.ts`).
- Produces:
  ```typescript
  type GradedUnit = {
    answerRows: Array<{
      questionId: string; assignableUnitId: string; value: string;
      isCorrect: boolean | null; pointsAwarded: number | null;
      correctAnswerSnapshot: string | null; explanationSnapshot: string | null;
    }>;
    gradeItems: AttemptItem[]; // để gộp điểm bằng gradeAttempt
  };
  function gradeUnits(
    units: Array<{ assignableUnitId: string; skill: string; questions: QuestionForGrading[] }>,
    getValue: (questionId: string) => string
  ): GradedUnit;
  ```
  với `QuestionForGrading = { id, order, questionType, optionsJson, correctAnswerJson, explanation, points }`.

- [ ] **Step 1: Viết test (đỏ)**

`tests/attempt-grading.test.ts` — chấm một unit Reading (tự chấm) và một unit Writing (chờ chấm):

```typescript
import { describe, expect, it } from "vitest";
import { gradeUnits } from "@/lib/attempt-grading";

const readingUnit = {
  assignableUnitId: "u1",
  skill: "reading",
  questions: [
    { id: "q1", order: 1, questionType: "short_answer", optionsJson: null,
      correctAnswerJson: JSON.stringify(["Paris"]), explanation: null, points: 1 }
  ]
};

const writingUnit = {
  assignableUnitId: "u2",
  skill: "writing",
  questions: [
    { id: "q2", order: 1, questionType: "essay", optionsJson: null,
      correctAnswerJson: null, explanation: null, points: 1 }
  ]
};

describe("gradeUnits", () => {
  it("auto-grades reading answers", () => {
    const values: Record<string, string> = { q1: "paris" };
    const result = gradeUnits([readingUnit], (id) => values[id] ?? "");
    expect(result.answerRows[0].isCorrect).toBe(true);
    expect(result.answerRows[0].pointsAwarded).toBe(1);
    expect(result.gradeItems).toHaveLength(1);
  });

  it("leaves writing answers ungraded (chờ chấm)", () => {
    const values: Record<string, string> = { q2: "My essay" };
    const result = gradeUnits([writingUnit], (id) => values[id] ?? "");
    expect(result.answerRows[0].isCorrect).toBeNull();
    expect(result.answerRows[0].pointsAwarded).toBeNull();
    expect(result.gradeItems).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Chạy test (đỏ)**

Run: `pnpm test -- tests/attempt-grading.test.ts`
Expected: FAIL — `lib/attempt-grading.ts` chưa tồn tại.

- [ ] **Step 3: Viết `lib/attempt-grading.ts`**

Chuyển nguyên logic chấm hiện có trong `submitAttempt` (lib/actions/attempts.ts:368-456) thành hàm thuần. Sao chép logic: nhóm multi-select, chấm Writing/Speaking = null, chấm còn lại bằng `gradeAnswer`. Dùng lại `parseCorrectAnswers` (export nó từ đây hoặc copy). Đầy đủ:

```typescript
import { gradeAnswer, type AttemptItem } from "@/lib/grading";
import { detectMultiSelectGroups, gradeMultiSelectGroup } from "@/lib/multi-select";
import { parseQuestionOptions } from "@/lib/question-interactions";

export type QuestionForGrading = {
  id: string;
  order: number;
  questionType: string;
  optionsJson: string | null;
  correctAnswerJson: string | null;
  explanation: string | null;
  points: number;
};

export type UnitForGrading = {
  assignableUnitId: string;
  skill: string;
  questions: QuestionForGrading[];
};

export type GradedAnswerRow = {
  questionId: string;
  assignableUnitId: string;
  value: string;
  isCorrect: boolean | null;
  pointsAwarded: number | null;
  correctAnswerSnapshot: string | null;
  explanationSnapshot: string | null;
};

export type GradedUnits = {
  answerRows: GradedAnswerRow[];
  gradeItems: AttemptItem[];
};

export function parseCorrectAnswers(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map((a) => String(a));
    if (["string", "number", "boolean"].includes(typeof parsed)) return [String(parsed)];
  } catch {
    return [value];
  }
  return [];
}

function answerSnapshot(value: string | null): string | null {
  const answers = parseCorrectAnswers(value);
  return answers.length > 0 ? answers.join(" | ") : value;
}

function isManualGradedSkill(skill: string): boolean {
  return skill === "writing" || skill === "speaking";
}

// Chấm một tập unit (cùng hoặc khác kỹ năng). getValue trả giá trị học sinh nhập
// theo questionId. Trả về answerRows (ghi DB) + gradeItems (gộp điểm bằng gradeAttempt).
export function gradeUnits(
  units: UnitForGrading[],
  getValue: (questionId: string) => string
): GradedUnits {
  const answerRows: GradedAnswerRow[] = [];
  const gradeItems: AttemptItem[] = [];

  for (const unit of units) {
    const questions = unit.questions;
    const isManualSkill = isManualGradedSkill(unit.skill);

    const groupResult = new Map<string, { isCorrect: boolean; pointsAwarded: number }>();
    if (!isManualSkill) {
      const groups = detectMultiSelectGroups(
        questions.map((q) => ({
          id: q.id,
          questionType: q.questionType,
          options: parseQuestionOptions(q.optionsJson),
          correctAnswers: parseCorrectAnswers(q.correctAnswerJson)
        }))
      );

      for (const group of groups) {
        const slotValues = group.questionIds.map((id) => getValue(id).trim());
        const firstMember = questions.find((q) => q.id === group.questionIds[0]);
        const correctSet = parseCorrectAnswers(firstMember?.correctAnswerJson ?? null);
        const marks = gradeMultiSelectGroup(slotValues, correctSet);
        group.questionIds.forEach((id, index) => {
          const points = questions.find((q) => q.id === id)?.points ?? 1;
          groupResult.set(id, {
            isCorrect: marks[index],
            pointsAwarded: marks[index] ? points : 0
          });
        });
      }
    }

    for (const question of questions) {
      const value = getValue(question.id).trim();

      if (isManualSkill) {
        answerRows.push({
          questionId: question.id,
          assignableUnitId: unit.assignableUnitId,
          value,
          isCorrect: null,
          pointsAwarded: null,
          correctAnswerSnapshot: null,
          explanationSnapshot: question.explanation
        });
        continue;
      }

      const correctAnswers = parseCorrectAnswers(question.correctAnswerJson);
      const group = groupResult.get(question.id);
      const grade = group ?? gradeAnswer(value, correctAnswers, question.points);

      answerRows.push({
        questionId: question.id,
        assignableUnitId: unit.assignableUnitId,
        value,
        isCorrect: grade.isCorrect,
        pointsAwarded: grade.pointsAwarded,
        correctAnswerSnapshot: answerSnapshot(question.correctAnswerJson),
        explanationSnapshot: question.explanation
      });

      gradeItems.push(
        group
          ? {
              value: group.isCorrect ? value || "1" : "",
              correctAnswers: group.isCorrect ? [value || "1"] : [],
              points: question.points
            }
          : { value, correctAnswers, points: question.points }
      );
    }
  }

  return { answerRows, gradeItems };
}
```

- [ ] **Step 4: Chạy test (xanh)**

Run: `pnpm test -- tests/attempt-grading.test.ts`
Expected: PASS.

- [ ] **Step 5: Refactor `submitAttempt` dùng `gradeUnits`**

Trong `lib/actions/attempts.ts`, thay khối `const gradedAnswers = ... ` (368-463) bằng lời gọi helper. Giữ nguyên phần ghi DB nhưng bổ sung `attemptId`/`studentId` vào answerRows khi createMany:

```typescript
  const graded = gradeUnits(
    attempt.assignmentRecipient.assignment.units.map((au) => ({
      assignableUnitId: au.assignableUnitId,
      skill: au.assignableUnit.skill,
      questions: au.assignableUnit.questions
    })),
    (questionId) => String(formData.get(`q_${questionId}`) ?? "")
  );
  const answerRows = graded.answerRows.map((row) => ({
    ...row,
    attemptId: attempt.id,
    studentId: student.id
  }));
  const attemptGrade = gradeAttempt(graded.gradeItems);
```

Thêm import `import { gradeUnits } from "@/lib/attempt-grading";` và `import { gradeAttempt } from "@/lib/grading";` (đã có gradeAttempt). Có thể thay `parseCorrectAnswers` cục bộ bằng bản export từ helper (tuỳ, không bắt buộc).

- [ ] **Step 6: Chạy toàn bộ test + build**

Run: `pnpm test && pnpm build`
Expected: PASS — hành vi chấm không đổi.

- [ ] **Step 7: Commit**

```bash
git add lib/attempt-grading.ts tests/attempt-grading.test.ts lib/actions/attempts.ts
git commit -m "refactor: tách gradeUnits để chấm theo tập unit"
```

---

## Task 5: Helper phiên kỹ năng + seed `AttemptSkill`

**Files:**
- Create: `lib/skill-sessions.ts`
- Create test: `tests/skill-sessions.test.ts`

**Interfaces:**
- Consumes: `SKILL_TIME_ORDER` (`lib/skill-times.ts`).
- Produces:
  - `orderedSkillsOfAssignment(units: Array<{ assignableUnit: { skill: string } }>): string[]` — danh sách kỹ năng phân biệt theo thứ tự IELTS.
  - `unitsForSkill<T extends { assignableUnit: { skill: string } }>(units: T[], skill: string): T[]`.
  - `allSkillsSubmitted(skills: Array<{ status: string }>): boolean`.

- [ ] **Step 1: Viết test (đỏ)**

`tests/skill-sessions.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { allSkillsSubmitted, orderedSkillsOfAssignment, unitsForSkill } from "@/lib/skill-sessions";

const units = [
  { assignableUnit: { skill: "reading" } },
  { assignableUnit: { skill: "listening" } },
  { assignableUnit: { skill: "reading" } }
];

describe("skill sessions", () => {
  it("lists distinct skills in IELTS order", () => {
    expect(orderedSkillsOfAssignment(units)).toEqual(["listening", "reading"]);
  });

  it("filters units for a skill", () => {
    expect(unitsForSkill(units, "reading")).toHaveLength(2);
  });

  it("detects all submitted", () => {
    expect(allSkillsSubmitted([{ status: "submitted" }, { status: "submitted" }])).toBe(true);
    expect(allSkillsSubmitted([{ status: "submitted" }, { status: "in_progress" }])).toBe(false);
    expect(allSkillsSubmitted([])).toBe(false);
  });
});
```

- [ ] **Step 2: Chạy test (đỏ)**

Run: `pnpm test -- tests/skill-sessions.test.ts`
Expected: FAIL.

- [ ] **Step 3: Viết `lib/skill-sessions.ts`**

```typescript
import { SKILL_TIME_ORDER } from "@/lib/skill-times";

type HasSkill = { assignableUnit: { skill: string } };

// Danh sách kỹ năng phân biệt của một bài, theo thứ tự IELTS (kỹ năng lạ xếp cuối).
export function orderedSkillsOfAssignment(units: HasSkill[]): string[] {
  const set = new Set(units.map((u) => u.assignableUnit.skill));
  const known = SKILL_TIME_ORDER.filter((s) => set.has(s));
  const extra = Array.from(set).filter(
    (s) => !SKILL_TIME_ORDER.includes(s as (typeof SKILL_TIME_ORDER)[number])
  );
  return [...known, ...extra];
}

export function unitsForSkill<T extends HasSkill>(units: T[], skill: string): T[] {
  return units.filter((u) => u.assignableUnit.skill === skill);
}

// Đã nộp hết khi có ít nhất 1 kỹ năng và tất cả đều "submitted".
export function allSkillsSubmitted(skills: Array<{ status: string }>): boolean {
  return skills.length > 0 && skills.every((s) => s.status === "submitted");
}
```

- [ ] **Step 4: Chạy test (xanh)**

Run: `pnpm test -- tests/skill-sessions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/skill-sessions.ts tests/skill-sessions.test.ts
git commit -m "feat: helper phiên làm bài theo kỹ năng"
```

---

## Task 6: Server actions `startSkillSession` + `submitSkill` + seed AttemptSkill

**Files:**
- Modify: `lib/actions/attempts.ts`

**Interfaces:**
- Consumes: `gradeUnits` (Task 4); `orderedSkillsOfAssignment`, `unitsForSkill`, `allSkillsSubmitted` (Task 5); `gradeAttempt` (`lib/grading.ts`).
- Produces:
  - `ensureAttemptSkills(attemptId: string): Promise<void>` — tạo dòng `AttemptSkill` còn thiếu cho mọi kỹ năng của bài (idempotent). Trạng thái khởi tạo: `submitted` nếu Attempt đã submitted, ngược lại `not_started`.
  - `startSkillSession(formData: FormData)` — đọc `attemptId`, `skill`; đặt `in_progress` + `startedAt` (chỉ khi chưa có). Bỏ qua nếu đã `submitted`.
  - `submitSkill(formData: FormData)` — chấm + ghi đáp án của riêng kỹ năng, khoá kỹ năng, finalize Attempt nếu xong hết, redirect `/student/results/[attemptId]?skill=<skill>`.

- [ ] **Step 1: Thêm `ensureAttemptSkills`**

Thêm import ở đầu `lib/actions/attempts.ts`:
```typescript
import { gradeUnits } from "@/lib/attempt-grading";
import { allSkillsSubmitted, orderedSkillsOfAssignment, unitsForSkill } from "@/lib/skill-sessions";
```

Hàm (đặt sau `startAttempt`):

```typescript
// Tạo các dòng AttemptSkill còn thiếu cho mọi kỹ năng của bài. Idempotent — gọi
// mỗi lần mở phòng làm bài để bài cũ (tạo trước tính năng) cũng có bản ghi kỹ năng.
export async function ensureAttemptSkills(attemptId: string): Promise<void> {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    select: {
      status: true,
      skills: { select: { skill: true } },
      assignmentRecipient: {
        select: {
          assignment: {
            select: { units: { select: { assignableUnit: { select: { skill: true } } } } }
          }
        }
      }
    }
  });
  if (!attempt) return;

  const skills = orderedSkillsOfAssignment(attempt.assignmentRecipient.assignment.units);
  const existing = new Set(attempt.skills.map((s) => s.skill));
  const missing = skills.filter((s) => !existing.has(s));
  if (missing.length === 0) return;

  await prisma.attemptSkill.createMany({
    data: missing.map((skill) => ({
      attemptId,
      skill,
      status: attempt.status === "submitted" ? "submitted" : "not_started"
    })),
    skipDuplicates: true
  });
}
```

- [ ] **Step 2: Thêm `startSkillSession`**

```typescript
const skillSessionSchema = z.object({
  attemptId: z.string().trim().min(1),
  skill: z.enum(["listening", "reading", "writing", "speaking"])
});

export async function startSkillSession(formData: FormData) {
  const student = await requireStudent();
  const parsed = skillSessionSchema.safeParse({
    attemptId: formData.get("attemptId"),
    skill: formData.get("skill")
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Kỹ năng không hợp lệ.");
  }

  const attempt = await prisma.attempt.findFirst({
    where: { id: parsed.data.attemptId, studentId: student.id, status: "in_progress" },
    select: { id: true }
  });
  if (!attempt) {
    throw new Error("Không tìm thấy lần làm bài đang mở.");
  }

  await ensureAttemptSkills(attempt.id);

  const skillRow = await prisma.attemptSkill.findUnique({
    where: { attemptId_skill: { attemptId: attempt.id, skill: parsed.data.skill } }
  });
  if (!skillRow || skillRow.status === "submitted") {
    return; // đã khoá hoặc không thuộc bài — không làm gì.
  }

  if (skillRow.status === "not_started") {
    await prisma.attemptSkill.update({
      where: { id: skillRow.id },
      data: { status: "in_progress", startedAt: new Date() }
    });
  }
}
```

- [ ] **Step 3: Thêm `submitSkill`**

Đọc lại đầy đủ units của bài, lọc units của kỹ năng, chấm bằng `gradeUnits`, **chỉ xoá Answer của các unit thuộc kỹ năng này** rồi ghi lại, khoá kỹ năng, finalize nếu xong hết.

```typescript
const submitSkillSchema = z.object({
  attemptId: z.string().trim().min(1),
  skill: z.enum(["listening", "reading", "writing", "speaking"]),
  submitReason: z.enum(["manual", "auto_timeout"]).default("manual"),
  elapsedSeconds: z.coerce.number().int().min(0).default(0)
});

export async function submitSkill(formData: FormData) {
  const student = await requireStudent();
  const parsed = submitSkillSchema.safeParse({
    attemptId: formData.get("attemptId"),
    skill: formData.get("skill"),
    submitReason: formData.get("submitReason") ?? "manual",
    elapsedSeconds: formData.get("elapsedSeconds") ?? 0
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Dữ liệu nộp không hợp lệ.");
  }
  // Giữ chính sách: bỏ qua auto-timeout.
  if (parsed.data.submitReason === "auto_timeout") {
    return;
  }

  const attempt = await prisma.attempt.findFirst({
    where: { id: parsed.data.attemptId, studentId: student.id },
    include: {
      skills: true,
      assignmentRecipient: {
        include: {
          assignment: {
            include: {
              units: {
                orderBy: { order: "asc" },
                include: {
                  assignableUnit: {
                    include: { questions: { orderBy: { order: "asc" } } }
                  }
                }
              }
            }
          }
        }
      }
    }
  });
  if (!attempt) {
    throw new Error("Không tìm thấy lần làm bài.");
  }

  await ensureAttemptSkills(attempt.id);

  const skillRow =
    attempt.skills.find((s) => s.skill === parsed.data.skill) ??
    (await prisma.attemptSkill.findUnique({
      where: { attemptId_skill: { attemptId: attempt.id, skill: parsed.data.skill } }
    }));
  if (skillRow?.status === "submitted") {
    redirect(`/student/results/${attempt.id}?skill=${parsed.data.skill}`);
  }

  const allUnits = attempt.assignmentRecipient.assignment.units;
  const skillUnits = unitsForSkill(allUnits, parsed.data.skill);
  const skillUnitIds = skillUnits.map((u) => u.assignableUnitId);

  const graded = gradeUnits(
    skillUnits.map((au) => ({
      assignableUnitId: au.assignableUnitId,
      skill: au.assignableUnit.skill,
      questions: au.assignableUnit.questions
    })),
    (questionId) => String(formData.get(`q_${questionId}`) ?? "")
  );
  const answerRows = graded.answerRows.map((row) => ({
    ...row,
    attemptId: attempt.id,
    studentId: student.id
  }));
  const skillGrade = gradeAttempt(graded.gradeItems);

  const submittedAt = new Date();

  await prisma.$transaction(async (tx) => {
    // Chỉ xoá đáp án của các unit thuộc kỹ năng này — không đụng kỹ năng khác.
    await tx.answer.deleteMany({
      where: { attemptId: attempt.id, assignableUnitId: { in: skillUnitIds } }
    });
    if (answerRows.length > 0) {
      await tx.answer.createMany({ data: answerRows });
    }
    await tx.attemptSkill.update({
      where: { attemptId_skill: { attemptId: attempt.id, skill: parsed.data.skill } },
      data: {
        status: "submitted",
        submittedAt,
        elapsedSeconds: parsed.data.elapsedSeconds,
        score: skillGrade.score,
        scorePercent: skillGrade.scorePercent
      }
    });

    // Kiểm tra đã nộp hết chưa (đọc lại trong transaction cho chắc).
    const skills = await tx.attemptSkill.findMany({ where: { attemptId: attempt.id } });
    if (allSkillsSubmitted(skills)) {
      const allGraded = gradeUnits(
        allUnits.map((au) => ({
          assignableUnitId: au.assignableUnitId,
          skill: au.assignableUnit.skill,
          questions: au.assignableUnit.questions
        })),
        (questionId) => String(formData.get(`q_${questionId}`) ?? "")
      );
      // Điểm tổng lấy từ toàn bộ đáp án đã lưu là chuẩn hơn formData (formData chỉ
      // có kỹ năng vừa nộp). Gộp điểm các kỹ năng đã lưu:
      const savedTotals = skills.reduce(
        (acc, s) => {
          acc.score += s.score ?? 0;
          return acc;
        },
        { score: 0 }
      );
      // scorePercent tổng tính lại từ Answer đã lưu để không lệ thuộc formData:
      const savedAnswers = await tx.answer.findMany({
        where: { attemptId: attempt.id },
        select: { pointsAwarded: true, isCorrect: true }
      });
      const gradedRows = savedAnswers.filter((a) => a.isCorrect !== null);
      const totalScore = gradedRows.reduce((sum, a) => sum + (a.pointsAwarded ?? 0), 0);
      const maxScore = gradedRows.length; // mỗi câu tự chấm points mặc định 1
      void allGraded;
      void savedTotals;

      await tx.attempt.update({
        where: { id: attempt.id },
        data: {
          status: "submitted",
          submittedAt,
          submitReason: "manual",
          score: totalScore,
          scorePercent: maxScore === 0 ? 0 : Math.round((totalScore / maxScore) * 100),
          autoGradedAt: submittedAt
        }
      });
      await tx.assignmentRecipient.update({
        where: { id: attempt.assignmentRecipientId },
        data: { status: "submitted", submittedAt }
      });
    }
  });

  revalidatePath("/student");
  revalidatePath("/student/history");
  revalidatePath(`/student/assignments/${attempt.assignmentRecipientId}`);
  redirect(`/student/results/${attempt.id}?skill=${parsed.data.skill}`);
}
```

> **Lưu ý cho người triển khai:** đoạn tính điểm tổng ở trên tính `maxScore` = số câu đã-tự-chấm (points mặc định = 1 theo schema). Nếu về sau có câu `points > 1`, thay `maxScore` bằng tổng `points` của các câu tự chấm (join `Answer.questionId -> Question.points`). Với dữ liệu hiện tại (points = 1) kết quả đúng. Xoá `void allGraded/savedTotals` khi dọn code — chúng chỉ là chốt chặn lint trong bản nháp.

- [ ] **Step 4: Build**

Run: `pnpm build`
Expected: build thành công. `prisma` client có `attemptSkill` + quan hệ `attemptId_skill`.

- [ ] **Step 5: Commit**

```bash
git add lib/actions/attempts.ts
git commit -m "feat: server actions startSkillSession + submitSkill"
```

---

## Task 7: Trang kết quả — lọc `?skill=`

**Files:**
- Modify: `app/student/results/[attemptId]/page.tsx`

**Interfaces:**
- Consumes: query param `skill`.
- Produces: khi có `?skill=<skill>`, trang chỉ hiển thị đáp án + điểm của kỹ năng đó (lọc `answers` theo `assignableUnit.skill`), tiêu đề ghi rõ kỹ năng, và nút "‹ Về chọn kỹ năng" quay lại phòng làm bài (`/student/assignments/[recipientId]`). Không có param → giữ trang gộp như cũ.

- [ ] **Step 1: Đọc searchParams + lọc**

Thêm `searchParams` vào props và lọc answers. Tại đầu component, sau khi lấy `attempt`:

```typescript
type ResultPageProps = {
  params: { attemptId: string };
  searchParams: { skill?: string };
};
```
Sau khi có `attempt`, nếu có `searchParams.skill`:
```typescript
  const skillFilter = searchParams.skill;
  const answers = skillFilter
    ? attempt.answers.filter((a) => a.assignableUnit?.skill === skillFilter)
    : attempt.answers;
```
Dùng `answers` (đã lọc) thay cho `attempt.answers` khi truyền xuống `ResultReview`. Nếu `skillFilter` có: hiện tiêu đề phụ "Kết quả kỹ năng {label}" và link quay lại
`/student/assignments/${attempt.assignmentRecipientId}` (đọc `assignmentRecipientId` — thêm vào `select`/`include` nếu chưa có). Điểm/% hiển thị lấy từ `AttemptSkill` tương ứng (query thêm `skills: { where: { skill: skillFilter } }` hoặc lấy tất cả rồi tìm).

- [ ] **Step 2: Không bật celebration khi xem theo kỹ năng**

`SubmitCelebration` chỉ nên chạy khi xem kết quả toàn bài (không có `?skill=`). Bọc điều kiện: chỉ render `<SubmitCelebration/>` khi `!skillFilter`.

- [ ] **Step 3: Build + kiểm tra tay**

Run: `pnpm build`
Kiểm tra tay: mở `/student/results/<id>?skill=listening` → chỉ thấy câu Nghe; mở không param → thấy toàn bài.

- [ ] **Step 4: Commit**

```bash
git add app/student/results/[attemptId]/page.tsx
git commit -m "feat: trang kết quả lọc theo kỹ năng cho xem tức thời"
```

---

## Task 8: Phòng làm bài — màn chọn kỹ năng + phiên theo kỹ năng

**Files:**
- Create: `components/skill-picker.tsx`
- Modify: `components/attempt-workspace.tsx`
- Modify: `app/student/assignments/[recipientId]/page.tsx` (nạp `attempt.skills` + `assignment.skillTimeLimitsJson`; gọi `ensureAttemptSkills`)

**Interfaces:**
- Consumes: `startSkillSession`, `submitSkill` (Task 6); `orderedSkillsOfAssignment`, `unitsForSkill` (Task 5); `parseSkillTimeLimits` (Task 2); `SKILL_TIME_LABELS` (`lib/skill-times.ts`).
- Produces: luồng picker → phiên 1 kỹ năng → nộp kỹ năng.

- [ ] **Step 1: Nạp dữ liệu ở trang assignment**

Trong `app/student/assignments/[recipientId]/page.tsx`:
- Sau `const attempt = await startAttempt(...)`, gọi `await ensureAttemptSkills(attempt.id);` (import từ `@/lib/actions/attempts`).
- Trong truy vấn `recipient`, thêm `skillTimeLimitsJson: true` vào `select` của `assignment` và include `skills` của attempt:
```typescript
      attempts: {
        where: { id: attempt.id },
        include: {
          highlights: { orderBy: { createdAt: "desc" } },
          skills: true
        }
      }
```
Và `assignment.select`/`include` cần có `skillTimeLimitsJson`. Truyền `attempt.skills` + `assignment.skillTimeLimitsJson` xuống `AttemptWorkspace` qua props mới (`attemptSkills`, và `skillTimeLimitsJson` đã nằm trong `assignment`).

- [ ] **Step 2: Viết `components/skill-picker.tsx`**

Client component nhận danh sách kỹ năng + trạng thái + số phần/câu + thời gian, render thẻ + nút. Bấm nút gọi `startSkillSession` (form) rồi báo cho workspace mở phiên.

```tsx
"use client";

import { SKILL_TIME_LABELS } from "@/lib/skill-times";

export type SkillPickerItem = {
  skill: string;
  status: string; // not_started | in_progress | submitted
  partCount: number;
  questionCount: number;
  minutes: number | null;
};

type SkillPickerProps = {
  title: string;
  items: SkillPickerItem[];
  onOpen: (skill: string) => void;
  onViewResult: (skill: string) => void;
  onExit: () => void;
};

const STATUS_LABEL: Record<string, string> = {
  not_started: "Chưa làm",
  in_progress: "Đang làm",
  submitted: "Đã nộp"
};

export function SkillPicker({ title, items, onOpen, onViewResult, onExit }: SkillPickerProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <button
          type="button"
          onClick={onExit}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-primary hover:border-primary"
        >
          ‹ Bảng điều khiển
        </button>
        <h2 className="truncate text-base font-bold sm:text-lg">{title}</h2>
        <span className="w-24" />
      </header>

      <div className="mx-auto w-full max-w-2xl flex-1 space-y-3 overflow-y-auto p-5">
        <p className="text-sm text-muted-foreground">
          Chọn kỹ năng để bắt đầu. Mỗi kỹ năng là một phiên riêng, nộp xong sẽ khoá lại.
        </p>
        {items.map((item) => {
          const label = SKILL_TIME_LABELS[item.skill] ?? item.skill;
          const submitted = item.status === "submitted";
          return (
            <div
              key={item.skill}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-card"
            >
              <div className="min-w-0">
                <p className="text-base font-semibold">{label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {item.partCount} phần · {item.questionCount} câu
                  {item.minutes ? ` · ${item.minutes} phút` : " · không giới hạn"}
                </p>
                <span
                  className={[
                    "mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    submitted
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                      : item.status === "in_progress"
                        ? "bg-amber-400/15 text-amber-600 dark:text-amber-300"
                        : "bg-muted text-muted-foreground"
                  ].join(" ")}
                >
                  {STATUS_LABEL[item.status] ?? item.status}
                </span>
              </div>
              {submitted ? (
                <button
                  type="button"
                  onClick={() => onViewResult(item.skill)}
                  className="shrink-0 rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold hover:border-primary"
                >
                  Xem kết quả
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onOpen(item.skill)}
                  className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                >
                  {item.status === "in_progress" ? "Tiếp tục" : "Bắt đầu"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Thêm state phiên vào `attempt-workspace.tsx`**

Mở rộng props `AttemptWorkspace` để nhận `attemptSkills: Array<{ skill: string; status: string; startedAt: string | Date | null }>`. Thêm state chọn kỹ năng đang mở:

```tsx
  // Kỹ năng đang mở phiên; null = đang ở màn chọn kỹ năng.
  const [activeSkill, setActiveSkill] = useState<string | null>(null);
```

Tính danh sách kỹ năng + có > 1 hay không:

```tsx
  const skillOrder = useMemo(
    () => orderedSkillsOfAssignment(assignment.units),
    [assignment.units]
  );
  const isMultiSkill = skillOrder.length > 1;
  const skillLimits = useMemo(
    () => parseSkillTimeLimits(assignment.skillTimeLimitsJson ?? null),
    [assignment.skillTimeLimitsJson]
  );
```

Bài 1 kỹ năng: auto mở luôn (giữ hành vi cũ):

```tsx
  useEffect(() => {
    if (!isMultiSkill && activeSkill === null) {
      setActiveSkill(skillOrder[0] ?? null);
    }
  }, [isMultiSkill, activeSkill, skillOrder]);
```

- [ ] **Step 4: Lọc `parts` + units render theo `activeSkill`**

Chỗ dựng `parts` (dòng ~1750) và vòng `assignment.units.map(...)` (dòng ~1851) render theo kỹ năng đang mở. Thêm biến:

```tsx
  const activeUnits = activeSkill
    ? unitsForSkill(assignment.units, activeSkill)
    : [];
```

Thay `assignment.units.map((assignmentUnit, partIndex) => {` bằng `activeUnits.map((assignmentUnit, partIndex) => {`, và `const parts = assignment.units.map(...)` thành `const parts = activeUnits.map(...)`. `totalQuestions`/`answeredCount` cũng tính theo `activeUnits`. (Câu palette/điều hướng phần vẫn chạy vì đều bám `parts`.)

- [ ] **Step 5: Đồng hồ theo kỹ năng**

`startedAtMs` hiện dựng từ attempt. Thay bằng mốc theo kỹ năng: dùng `startedAt` của `AttemptSkill` đang mở; giới hạn = `skillLimits[activeSkill]`. Countdown chỉ render khi có giới hạn:

```tsx
  const activeSkillRow = attemptSkills.find((s) => s.skill === activeSkill);
  const skillStartedAtMs = activeSkillRow?.startedAt
    ? new Date(activeSkillRow.startedAt).getTime()
    : startedAtMs;
  const activeSkillLimit = activeSkill ? skillLimits[activeSkill] ?? null : null;
```
Trong header, thay `timeLimitMinutes` bằng `activeSkillLimit` và `startedAtMs` bằng `skillStartedAtMs` cho `<CountdownTimer/>`.

- [ ] **Step 6: Nút Nộp → `submitSkill`; form action theo kỹ năng**

Đổi `form action={submitAttempt}` → `action={submitSkill}` khi multi-skill (giữ `submitAttempt` cho 1-kỹ-năng nếu muốn; đơn giản nhất: luôn dùng `submitSkill`). Thêm hidden `skill`:

```tsx
      <input type="hidden" name="skill" value={activeSkill ?? ""} />
```
Nút Nộp đổi nhãn `Nộp {SKILL_TIME_LABELS[activeSkill] ?? ""}` và confirm "Nộp kỹ năng này? Bạn sẽ không sửa được sau khi nộp." `submitSkill` tự redirect sang kết quả kỹ năng.

- [ ] **Step 7: Render picker khi `activeSkill === null`**

Trước khối `content`, khi multi-skill và chưa chọn kỹ năng, render `<SkillPicker/>` thay vì form. `onOpen` gọi server action `startSkillSession` rồi `setActiveSkill(skill)`; `onViewResult` điều hướng `/student/results/${attempt.id}?skill=${skill}`; `onExit` về `/student`.

```tsx
  async function openSkill(skill: string) {
    const fd = new FormData();
    fd.set("attemptId", attempt.id);
    fd.set("skill", skill);
    await startSkillSession(fd);
    setActiveSkill(skill);
  }
```
```tsx
  if (mounted && isMultiSkill && activeSkill === null) {
    return createPortal(
      <SkillPicker
        title={assignment.title}
        items={skillOrder.map((skill) => {
          const units = unitsForSkill(assignment.units, skill);
          const row = attemptSkills.find((s) => s.skill === skill);
          return {
            skill,
            status: row?.status ?? "not_started",
            partCount: units.length,
            questionCount: units.reduce((n, u) => n + u.assignableUnit.questions.length, 0),
            minutes: skillLimits[skill] ?? null
          };
        })}
        onOpen={openSkill}
        onViewResult={(skill) => {
          window.location.href = `/student/results/${attempt.id}?skill=${skill}`;
        }}
        onExit={() => {
          window.location.href = "/student";
        }}
      />,
      document.body
    );
  }
```

Thêm nút "‹ Kỹ năng" trong header phiên để quay lại picker (`setActiveSkill(null)`) khi multi-skill — cho phép đổi kỹ năng khác giữa chừng (kỹ năng đang mở vẫn `in_progress`, đồng hồ tiếp tục theo `startedAt`).

- [ ] **Step 8: Imports**

Thêm ở đầu `attempt-workspace.tsx`:
```tsx
import { startSkillSession, submitSkill } from "@/lib/actions/attempts";
import { SkillPicker } from "@/components/skill-picker";
import { orderedSkillsOfAssignment, unitsForSkill } from "@/lib/skill-sessions";
import { parseSkillTimeLimits } from "@/lib/skill-parse";
import { SKILL_TIME_LABELS } from "@/lib/skill-times";
```

- [ ] **Step 9: Build**

Run: `pnpm build`
Expected: TypeScript pass. (Preview mode của giáo viên: nếu `previewMode`, bỏ qua picker — vào thẳng kỹ năng đầu, không gọi server action; kiểm tra nhánh `previewMode` không gọi `startSkillSession`/`submitSkill`.)

- [ ] **Step 10: Commit**

```bash
git add components/skill-picker.tsx components/attempt-workspace.tsx app/student/assignments/[recipientId]/page.tsx
git commit -m "feat: màn chọn kỹ năng + phiên làm bài theo kỹ năng"
```

---

## Task 9: Xác minh đầu-cuối trên DB local + dashboard trạng thái

**Files:**
- Modify (nếu cần): `app/student/page.tsx` (thẻ bài hiện "Đã nộp x/y kỹ năng"); `components/student-*` liên quan.

- [ ] **Step 1: Seed + chạy dev**

Run: `pnpm prisma:seed` rồi `pnpm dev`.
Đăng nhập học sinh demo, mở một bài nhiều kỹ năng (tạo bài Listening+Reading từ tài khoản giáo viên trước nếu seed chưa có).

- [ ] **Step 2: Kịch bản kiểm tra tay**

Xác minh lần lượt:
1. Bấm Làm bài (bài ≥2 kỹ năng) → thấy màn chọn kỹ năng với đúng số phần/câu/thời gian.
2. Chọn Reading → chỉ thấy các passage Reading; đồng hồ đúng giới hạn Reading.
3. Nộp Reading → chuyển sang kết quả Reading (chỉ câu Reading), có band nếu đủ 40 câu.
4. Quay lại → Reading = "Đã nộp" (khoá), chọn Listening làm tiếp.
5. Nộp Listening (kỹ năng cuối) → Attempt `submitted`; `/student` hiện "Đã nộp"; gamification/celebration chạy đúng một lần khi xem kết quả toàn bài (mở `/student/results/<id>` không param).
6. Bài 1 kỹ năng → vào thẳng, không có picker (hành vi cũ).
7. Giáo viên reset bài → mở lại thấy các kỹ năng về "Chưa làm".

- [ ] **Step 3: (Nếu cần) cập nhật thẻ trạng thái dashboard**

Nếu muốn hiện tiến độ theo kỹ năng ở `/student`, đọc `attempt.skills` và hiển thị "Đã nộp x/y kỹ năng". Tối thiểu: đảm bảo bài đang làm dở (một số kỹ năng đã nộp) không hiển thị nhầm "Đã nộp" toàn bài — chỉ `AssignmentRecipient.status === "submitted"` mới là đã nộp hết. Kiểm tra `app/student/page.tsx` dùng đúng `recipient.status`.

- [ ] **Step 4: Chạy toàn bộ test + build**

Run: `pnpm test && pnpm build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test: xác minh luồng phiên theo kỹ năng + trạng thái dashboard"
```

---

## Self-Review (đã rà)

- **Spec coverage:** picker (T8), lock vĩnh viễn (T6 status submitted, T8 không cho vào lại), đồng hồ theo kỹ năng do GV đặt (T3 + T8 Step 5), kết quả tức thời (T6 redirect + T7), một-Attempt giữ nguyên + finalize khi xong hết (T6), seed bài cũ (T6 `ensureAttemptSkills` + T8 Step 1), band theo kỹ năng (T7), bài 1 kỹ năng vào thẳng (T8 Step 3), test cấu trúc (T1). Đủ.
- **Placeholder scan:** không còn "TBD/TODO"; ghi chú `void allGraded/savedTotals` là chốt lint có chủ đích, có hướng dẫn dọn.
- **Type consistency:** `gradeUnits` (T4) ↔ dùng ở T6; `orderedSkillsOfAssignment`/`unitsForSkill`/`allSkillsSubmitted` (T5) ↔ T6/T8; `attemptId_skill` composite key khớp `@@unique([attemptId, skill])` (T1); `parseSkillTimeLimits` (T2) ↔ T3/T8; `SkillPickerItem` khớp dữ liệu T8 Step 7.
- **Rủi ro cần lưu:** điểm tổng khi finalize (T6 Step 3) hiện giả định `points = 1`; đã ghi chú cách mở rộng nếu có `points > 1`.
