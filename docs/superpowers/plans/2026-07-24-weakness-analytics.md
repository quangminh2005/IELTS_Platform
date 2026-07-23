# Phân tích tiến bộ & điểm yếu theo dạng câu — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trang "Tiến bộ" cho học sinh (biểu đồ % đúng theo thời gian + tỷ lệ đúng theo 5 nhóm dạng câu) và thống kê cho giáo viên (câu cả lớp sai nhiều nhất theo bài giao + điểm yếu từng học sinh).

**Architecture:** Toàn bộ logic tính toán là hàm thuần trong `lib/question-stats.ts` (test được bằng vitest, không cần DB). Server components truy vấn Prisma rồi truyền số liệu đã tính xuống 2 client components (biểu đồ SVG tự vẽ + khối tab dạng câu). Không đổi schema, không migration, không dependency mới.

**Tech Stack:** Next.js 14 App Router, Prisma, Tailwind, vitest. Spec đã duyệt: `docs/superpowers/specs/2026-07-24-weakness-analytics-design.md`.

## Global Constraints

- Chữ hiển thị và comment trong code: **tiếng Việt** (khớp codebase).
- Commit message: tiếng Việt **không dấu**, tiền tố `feat:`/`docs:` (khớp lịch sử git), kết bằng dòng `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- KHÔNG sửa `prisma/schema.prisma`, KHÔNG thêm package mới.
- Không tạo API route mới — chỉ server components + client components.
- Package manager: `pnpm`. Test đơn lẻ: `npx vitest run tests/question-stats.test.ts`.
- Nhánh làm việc: `feature/ielts-platform-mvp` (commit thẳng, KHÔNG push cho tới Task 8).
- Các hằng nghiệp vụ: 5 nhóm dạng câu; ngưỡng "chưa đủ dữ liệu" < 5 câu; nhóm yếu nhất cần ≥ 10 câu; biểu đồ tối đa 20 bài gần nhất mỗi kỹ năng; top 5 câu sai nhiều nhất; tô đỏ hàng ≥ 50% sai; đáp án sai phổ biến: top 3.

---

### Task 1: `lib/question-stats.ts` — nhóm dạng câu + tỷ lệ đúng theo nhóm

**Files:**
- Create: `lib/question-stats.ts`
- Test: `tests/question-stats.test.ts`

**Interfaces:**
- Consumes: `bandsBySkill` từ `@/lib/band-score` (đã có — Task 2 mới dùng, Task 1 chưa cần import).
- Produces (Task 3/4/5/7 dùng):
  - `QUESTION_GROUPS: readonly {key, label}[]` — 5 nhóm, đúng thứ tự hiển thị
  - `groupForQuestionType(questionType: string): QuestionGroupKey | null`
  - `LOW_DATA_THRESHOLD = 5`, `WEAKEST_MIN_ANSWERS = 10`
  - `type StatAnswer = { isCorrect: boolean | null; skill: string; questionType: string | null }`
  - `type GroupStat = { key; label; correct; total; percent }`
  - `type SkillFilter = "all" | "listening" | "reading"`
  - `questionTypeStatsBySkill(answers: StatAnswer[]): Record<SkillFilter, GroupStat[]>`
  - `weakestGroup(stats: GroupStat[]): GroupStat | null`

- [ ] **Step 1: Viết test (fail trước)**

Tạo `tests/question-stats.test.ts`:

```ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  groupForQuestionType,
  LOW_DATA_THRESHOLD,
  QUESTION_GROUPS,
  questionTypeStatsBySkill,
  weakestGroup,
  WEAKEST_MIN_ANSWERS,
  type GroupStat,
  type QuestionGroupKey
} from "../lib/question-stats";

function answer(skill: string, questionType: string | null, isCorrect: boolean | null) {
  return { skill, questionType, isCorrect };
}

describe("groupForQuestionType", () => {
  it("phủ đủ mọi dạng auto-grade khai báo trong materials.ts", () => {
    // Đọc thẳng nguồn để danh sách dạng câu không bao giờ lệch với import:
    // thêm questionType mới mà quên thêm nhóm -> test này fail.
    const source = readFileSync(
      path.join(process.cwd(), "lib", "actions", "materials.ts"),
      "utf8"
    );
    const match = source.match(/const questionTypes = \[([^\]]+)\]/);
    expect(match).not.toBeNull();
    const declared = [...match![1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    expect(declared.length).toBeGreaterThanOrEqual(11);

    const manual = new Set(["writing_task", "speaking_task"]);
    for (const type of declared) {
      if (manual.has(type)) {
        expect(groupForQuestionType(type)).toBeNull();
      } else {
        expect(groupForQuestionType(type)).not.toBeNull();
      }
    }
  });

  it("dạng không quen biết -> null", () => {
    expect(groupForQuestionType("mystery_type")).toBeNull();
  });
});

describe("questionTypeStatsBySkill", () => {
  it("tính đúng/tổng theo nhóm và theo kỹ năng", () => {
    const stats = questionTypeStatsBySkill([
      answer("listening", "multiple_choice", true),
      answer("listening", "multiple_choice", false),
      answer("reading", "multiple_choice", true),
      answer("reading", "note_completion", false),
      answer("reading", "gap_fill", true)
    ]);

    const mcAll = stats.all.find((s) => s.key === "multiple_choice")!;
    expect(mcAll).toMatchObject({ correct: 2, total: 3, percent: 67 });

    const mcListening = stats.listening.find((s) => s.key === "multiple_choice")!;
    expect(mcListening).toMatchObject({ correct: 1, total: 2, percent: 50 });

    // gap_fill + note_completion gộp chung nhóm "Điền từ".
    const completion = stats.reading.find((s) => s.key === "completion")!;
    expect(completion).toMatchObject({ correct: 1, total: 2, percent: 50 });
  });

  it("bỏ qua câu chấm tay (isCorrect null) và câu mất liên kết dạng", () => {
    const stats = questionTypeStatsBySkill([
      answer("writing", "writing_task", null),
      answer("reading", null, true)
    ]);
    for (const stat of stats.all) {
      expect(stat.total).toBe(0);
    }
  });

  it("luôn trả đủ 5 nhóm theo đúng thứ tự khai báo", () => {
    const stats = questionTypeStatsBySkill([]);
    expect(stats.all.map((s) => s.key)).toEqual(QUESTION_GROUPS.map((g) => g.key));
  });
});

describe("weakestGroup", () => {
  const make = (key: QuestionGroupKey, percent: number, total: number): GroupStat => ({
    key,
    label: key,
    correct: Math.round((percent / 100) * total),
    total,
    percent
  });

  it("chọn nhóm % thấp nhất trong các nhóm đủ dữ liệu", () => {
    const weakest = weakestGroup([
      make("multiple_choice", 40, WEAKEST_MIN_ANSWERS),
      make("completion", 30, 4), // dưới ngưỡng -> bỏ qua dù % thấp hơn
      make("matching", 80, 30)
    ]);
    expect(weakest?.key).toBe("multiple_choice");
  });

  it("hòa % -> chọn nhóm nhiều câu hơn", () => {
    const weakest = weakestGroup([
      make("multiple_choice", 50, 10),
      make("completion", 50, 20)
    ]);
    expect(weakest?.key).toBe("completion");
  });

  it("không nhóm nào đủ ngưỡng -> null", () => {
    expect(weakestGroup([make("multiple_choice", 10, WEAKEST_MIN_ANSWERS - 1)])).toBeNull();
  });
});

describe("ngưỡng nghiệp vụ", () => {
  // Ghim 2 con số đã chốt trong spec — đổi ngưỡng là phải sửa test có chủ đích.
  it("chưa đủ dữ liệu < 5 câu; nhóm yếu nhất cần >= 10 câu", () => {
    expect(LOW_DATA_THRESHOLD).toBe(5);
    expect(WEAKEST_MIN_ANSWERS).toBe(10);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `npx vitest run tests/question-stats.test.ts`
Expected: FAIL — `Cannot find module '../lib/question-stats'` (hoặc tương đương).

- [ ] **Step 3: Viết implementation**

Tạo `lib/question-stats.ts`:

```ts
// Thống kê tiến bộ & điểm yếu theo dạng câu — logic thuần, dùng chung cho
// trang "Tiến bộ" của học sinh và khu vực giáo viên. Không truy cập DB nên
// import được ở cả server lẫn client component.

// ===== Nhóm dạng câu =====

// 5 nhóm hiển thị. Thứ tự trong mảng = thứ tự hiển thị trên giao diện.
export const QUESTION_GROUPS = [
  { key: "multiple_choice", label: "Trắc nghiệm" },
  { key: "true_false", label: "True/False/Not Given" },
  { key: "matching", label: "Nối (matching)" },
  { key: "completion", label: "Điền từ" },
  { key: "short_answer", label: "Trả lời ngắn" }
] as const;

export type QuestionGroupKey = (typeof QUESTION_GROUPS)[number]["key"];

// Map dạng câu kỹ thuật -> nhóm hiển thị. writing_task/speaking_task chấm tay
// (isCorrect = null) nên không có nhóm. Khi thêm questionType mới vào
// lib/actions/materials.ts PHẢI bổ sung tại đây — tests/question-stats.test.ts
// đọc thẳng nguồn materials.ts để ép điều này.
const TYPE_TO_GROUP: Record<string, QuestionGroupKey> = {
  multiple_choice: "multiple_choice",
  true_false_not_given: "true_false",
  matching: "matching",
  drag_drop_matching: "matching",
  gap_fill: "completion",
  inline_gap_fill: "completion",
  note_completion: "completion",
  table_completion: "completion",
  short_answer: "short_answer"
};

export function groupForQuestionType(questionType: string): QuestionGroupKey | null {
  return TYPE_TO_GROUP[questionType] ?? null;
}

// ===== Tỷ lệ đúng theo nhóm =====

// Ngưỡng dữ liệu: dưới 5 câu -> hiển thị mờ "chưa đủ dữ liệu";
// nhóm yếu nhất chỉ chọn trong các nhóm có >= 10 câu.
export const LOW_DATA_THRESHOLD = 5;
export const WEAKEST_MIN_ANSWERS = 10;

export type StatAnswer = {
  isCorrect: boolean | null;
  skill: string;
  // null khi câu gốc đã bị xóa (re-import tài liệu) -> bỏ qua ở thống kê nhóm.
  questionType: string | null;
};

export type GroupStat = {
  key: QuestionGroupKey;
  label: string;
  correct: number;
  total: number;
  percent: number; // 0-100, làm tròn; total = 0 -> 0
};

export type SkillFilter = "all" | "listening" | "reading";

export type TypeStatsBySkill = Record<SkillFilter, GroupStat[]>;

function statsForFilter(answers: StatAnswer[], filter: SkillFilter): GroupStat[] {
  const tally = new Map<QuestionGroupKey, { correct: number; total: number }>();

  for (const answer of answers) {
    if (answer.isCorrect === null) continue;
    if (filter !== "all" && answer.skill !== filter) continue;
    const group = answer.questionType ? groupForQuestionType(answer.questionType) : null;
    if (!group) continue;
    const row = tally.get(group) ?? { correct: 0, total: 0 };
    row.total += 1;
    if (answer.isCorrect) row.correct += 1;
    tally.set(group, row);
  }

  return QUESTION_GROUPS.map(({ key, label }) => {
    const row = tally.get(key) ?? { correct: 0, total: 0 };
    return {
      key,
      label,
      correct: row.correct,
      total: row.total,
      percent: row.total === 0 ? 0 : Math.round((row.correct / row.total) * 100)
    };
  });
}

export function questionTypeStatsBySkill(answers: StatAnswer[]): TypeStatsBySkill {
  return {
    all: statsForFilter(answers, "all"),
    listening: statsForFilter(answers, "listening"),
    reading: statsForFilter(answers, "reading")
  };
}

// Nhóm yếu nhất: % thấp nhất trong các nhóm đủ dữ liệu (>= WEAKEST_MIN_ANSWERS).
// Hòa % -> chọn nhóm nhiều câu hơn. Không nhóm nào đủ -> null.
export function weakestGroup(stats: GroupStat[]): GroupStat | null {
  let weakest: GroupStat | null = null;

  for (const stat of stats) {
    if (stat.total < WEAKEST_MIN_ANSWERS) continue;
    if (
      weakest === null ||
      stat.percent < weakest.percent ||
      (stat.percent === weakest.percent && stat.total > weakest.total)
    ) {
      weakest = stat;
    }
  }

  return weakest;
}
```

- [ ] **Step 4: Chạy test, xác nhận PASS**

Run: `npx vitest run tests/question-stats.test.ts`
Expected: PASS toàn bộ (4 describe, 9 it).

- [ ] **Step 5: Commit**

```bash
git add lib/question-stats.ts tests/question-stats.test.ts
git commit -m "feat: logic nhom dang cau va ty le dung theo nhom

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: `lib/question-stats.ts` — chuỗi biểu đồ + đáp án sai phổ biến

**Files:**
- Modify: `lib/question-stats.ts` (nối thêm cuối file)
- Test: `tests/question-stats.test.ts` (nối thêm cuối file)

**Interfaces:**
- Consumes: `bandsBySkill` từ `@/lib/band-score`; `parseCorrectAnswers` từ `@/lib/attempt-grading` (cả hai đã có sẵn, hàm thuần).
- Produces (Task 3/5/6/7 dùng):
  - `MAX_POINTS_PER_SKILL = 20`, `TOP_MISSED_LIMIT = 5`
  - `type AttemptForSeries = { title: string; submittedAt: Date; answers: Array<{ isCorrect: boolean | null; skill: string }> }`
  - `type SeriesPoint = { timeMs; dateLabel; label; percent; correct; total; band }`
  - `buildProgressSeries(attempts: AttemptForSeries[]): { listening: SeriesPoint[]; reading: SeriesPoint[] }`
  - `type WrongAnswerCount = { value: string; count: number }`
  - `tallyWrongAnswers(values: string[], limit = 3): WrongAnswerCount[]`
  - `type QuestionMissStat = { questionId; order; prompt; correctAnswer; wrongCount; totalCount; percentWrong; wrongValues }`
  - `type UnitQuestionStats = { unitId; unitTitle; skill; manual: boolean; questions: QuestionMissStat[] }`
  - `assignmentQuestionStats(units, answers, submittedCount): { units: UnitQuestionStats[]; top: QuestionMissStat[] }`

- [ ] **Step 1: Nối thêm test (fail trước)**

Thêm vào cuối `tests/question-stats.test.ts` — sửa dòng import đầu file thành:

```ts
import {
  assignmentQuestionStats,
  buildProgressSeries,
  groupForQuestionType,
  LOW_DATA_THRESHOLD,
  MAX_POINTS_PER_SKILL,
  QUESTION_GROUPS,
  questionTypeStatsBySkill,
  tallyWrongAnswers,
  weakestGroup,
  WEAKEST_MIN_ANSWERS,
  type GroupStat,
  type QuestionGroupKey
} from "../lib/question-stats";
```

và thêm các describe mới:

```ts
describe("buildProgressSeries", () => {
  const attempt = (
    title: string,
    iso: string,
    rows: Array<[skill: string, isCorrect: boolean]>
  ) => ({
    title,
    submittedAt: new Date(iso),
    answers: rows.map(([skill, isCorrect]) => ({ skill, isCorrect }))
  });

  it("mỗi kỹ năng một chuỗi, sắp theo thời gian tăng dần", () => {
    const series = buildProgressSeries([
      attempt("Bài 2", "2026-07-20T10:00:00Z", [
        ["listening", true],
        ["listening", false]
      ]),
      attempt("Bài 1", "2026-07-10T10:00:00Z", [
        ["listening", true],
        ["reading", false]
      ])
    ]);

    expect(series.listening.map((p) => p.label)).toEqual(["Bài 1", "Bài 2"]);
    expect(series.listening[1]).toMatchObject({
      percent: 50,
      correct: 1,
      total: 2,
      band: null
    });
    expect(series.reading).toHaveLength(1);
    expect(series.reading[0].percent).toBe(0);
  });

  it("band chỉ có ở bài đủ 40 câu", () => {
    const answers40 = Array.from(
      { length: 40 },
      (_, i) => ["listening", i < 30] as [string, boolean]
    );
    const series = buildProgressSeries([
      attempt("Full test", "2026-07-01T00:00:00Z", answers40)
    ]);
    // 30/40 câu Nghe -> band 7 theo bảng quy đổi.
    expect(series.listening[0].band).toBe(7);
  });

  it("cắt còn 20 bài gần nhất mỗi kỹ năng", () => {
    const attempts = Array.from({ length: 25 }, (_, i) =>
      attempt(
        `Bài ${i + 1}`,
        `2026-06-${String(i + 1).padStart(2, "0")}T00:00:00Z`,
        [["reading", true]]
      )
    );
    const series = buildProgressSeries(attempts);
    expect(series.reading).toHaveLength(MAX_POINTS_PER_SKILL);
    expect(series.reading[0].label).toBe("Bài 6");
  });
});

describe("tallyWrongAnswers", () => {
  it("gộp không phân biệt hoa thường, giữ nhãn đầu tiên, cắt top 3", () => {
    expect(tallyWrongAnswers(["B", "b", "D", "", "", "x", "B ", "y"])).toEqual([
      { value: "B", count: 3 },
      { value: "", count: 2 },
      { value: "D", count: 1 }
    ]);
  });
});

describe("assignmentQuestionStats", () => {
  const units = [
    {
      id: "u1",
      title: "Passage 1",
      skill: "reading",
      questions: [
        { id: "q1", order: 1, prompt: "Câu 1?", correctAnswerJson: '["TRUE"]' },
        { id: "q2", order: 2, prompt: "Câu 2?", correctAnswerJson: '["cat"]' }
      ]
    },
    {
      id: "u2",
      title: "Task 1",
      skill: "writing",
      questions: [{ id: "w1", order: 1, prompt: "Viết", correctAnswerJson: null }]
    }
  ];

  it("đếm % sai theo câu; câu không ai trả lời vẫn có dòng 0/N", () => {
    const stats = assignmentQuestionStats(
      units,
      [
        { questionId: "q1", isCorrect: false, value: "FALSE", correctAnswerSnapshot: "TRUE" },
        { questionId: "q1", isCorrect: true, value: "TRUE", correctAnswerSnapshot: "TRUE" },
        { questionId: "q1", isCorrect: false, value: "false", correctAnswerSnapshot: "TRUE" }
      ],
      3
    );

    const [passage, writing] = stats.units;
    expect(writing.manual).toBe(true);
    expect(writing.questions).toHaveLength(0);

    const q1 = passage.questions[0];
    expect(q1).toMatchObject({
      wrongCount: 2,
      totalCount: 3,
      percentWrong: 67,
      correctAnswer: "TRUE"
    });
    expect(q1.wrongValues).toEqual([{ value: "FALSE", count: 2 }]);

    expect(passage.questions[1]).toMatchObject({
      wrongCount: 0,
      totalCount: 3,
      percentWrong: 0,
      correctAnswer: "cat"
    });
  });

  it("top chỉ gồm câu có người sai, đáp án đúng fallback từ correctAnswerJson", () => {
    const stats = assignmentQuestionStats(
      units,
      [{ questionId: "q1", isCorrect: false, value: "", correctAnswerSnapshot: null }],
      1
    );
    expect(stats.top.map((q) => q.questionId)).toEqual(["q1"]);
    expect(stats.top[0].correctAnswer).toBe("TRUE");
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `npx vitest run tests/question-stats.test.ts`
Expected: FAIL — các export `buildProgressSeries`, `tallyWrongAnswers`, `assignmentQuestionStats` chưa tồn tại. Các test Task 1 vẫn PASS.

- [ ] **Step 3: Viết implementation**

Thêm 2 dòng import lên ĐẦU `lib/question-stats.ts` (trên comment mở đầu giữ nguyên):

```ts
import { bandsBySkill } from "@/lib/band-score";
import { parseCorrectAnswers } from "@/lib/attempt-grading";
```

Nối vào CUỐI `lib/question-stats.ts`:

```ts
// ===== Chuỗi điểm cho biểu đồ tiến bộ =====

export const MAX_POINTS_PER_SKILL = 20;

export type AttemptForSeries = {
  title: string;
  submittedAt: Date;
  answers: Array<{ isCorrect: boolean | null; skill: string }>;
};

export type SeriesPoint = {
  timeMs: number;
  dateLabel: string; // vd "24/7" — dùng cho tooltip & nhãn trục
  label: string; // tên bài giao
  percent: number;
  correct: number;
  total: number;
  band: number | null; // chỉ khác null với bài đủ 40 câu (bandScore)
};

export type ProgressSeries = {
  listening: SeriesPoint[];
  reading: SeriesPoint[];
};

const DATE_LABEL = new Intl.DateTimeFormat("vi-VN", {
  day: "numeric",
  month: "numeric",
  timeZone: "Asia/Ho_Chi_Minh"
});

// attempts: đã lọc submitted/reviewed từ phía truy vấn. Mỗi kỹ năng lấy tối đa
// MAX_POINTS_PER_SKILL bài gần nhất, trả về theo thứ tự thời gian tăng dần.
export function buildProgressSeries(attempts: AttemptForSeries[]): ProgressSeries {
  const sorted = [...attempts].sort(
    (a, b) => a.submittedAt.getTime() - b.submittedAt.getTime()
  );
  const series: ProgressSeries = { listening: [], reading: [] };

  for (const attempt of sorted) {
    for (const row of bandsBySkill(attempt.answers)) {
      if (row.total === 0) continue;
      if (row.skill !== "listening" && row.skill !== "reading") continue;
      series[row.skill].push({
        timeMs: attempt.submittedAt.getTime(),
        dateLabel: DATE_LABEL.format(attempt.submittedAt),
        label: attempt.title,
        percent: Math.round((row.correct / row.total) * 100),
        correct: row.correct,
        total: row.total,
        band: row.band
      });
    }
  }

  return {
    listening: series.listening.slice(-MAX_POINTS_PER_SKILL),
    reading: series.reading.slice(-MAX_POINTS_PER_SKILL)
  };
}

// ===== Đáp án sai phổ biến (khu vực giáo viên) =====

export type WrongAnswerCount = {
  value: string; // "" = bỏ trống (phía hiển thị tự thay nhãn)
  count: number;
};

// Gộp các giá trị sai giống nhau (trim + không phân biệt hoa thường, lấy bản
// đầu tiên gặp làm nhãn hiển thị), xếp giảm dần theo số lần, cắt top `limit`.
export function tallyWrongAnswers(values: string[], limit = 3): WrongAnswerCount[] {
  const counts = new Map<string, WrongAnswerCount>();

  for (const raw of values) {
    const display = raw.trim();
    const key = display.toLowerCase();
    const row = counts.get(key);
    if (row) {
      row.count += 1;
    } else {
      counts.set(key, { value: display, count: 1 });
    }
  }

  return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}

// ===== Thống kê theo câu của một bài giao =====

export const TOP_MISSED_LIMIT = 5;

export type QuestionMissStat = {
  questionId: string;
  order: number;
  prompt: string;
  correctAnswer: string | null;
  wrongCount: number;
  totalCount: number; // số học sinh đã nộp
  percentWrong: number;
  wrongValues: WrongAnswerCount[];
};

export type UnitQuestionStats = {
  unitId: string;
  unitTitle: string;
  skill: string;
  manual: boolean; // Viết/Nói -> chấm tay, không có bảng câu
  questions: QuestionMissStat[];
};

export type AssignmentStats = {
  units: UnitQuestionStats[];
  top: QuestionMissStat[];
};

type UnitInput = {
  id: string;
  title: string;
  skill: string;
  questions: Array<{
    id: string;
    order: number;
    prompt: string;
    correctAnswerJson: string | null;
  }>;
};

type AnswerInput = {
  questionId: string | null;
  isCorrect: boolean | null;
  value: string;
  correctAnswerSnapshot: string | null;
};

// units: câu hỏi lấy từ ĐỀ GỐC (không phải từ bài nộp) — câu chưa ai trả lời
// vẫn có dòng "0/N sai". answers: gộp từ mọi attempt đã nộp của bài giao.
export function assignmentQuestionStats(
  units: UnitInput[],
  answers: AnswerInput[],
  submittedCount: number
): AssignmentStats {
  const byQuestion = new Map<string, AnswerInput[]>();
  for (const answer of answers) {
    if (!answer.questionId) continue;
    const list = byQuestion.get(answer.questionId) ?? [];
    list.push(answer);
    byQuestion.set(answer.questionId, list);
  }

  const unitStats: UnitQuestionStats[] = units.map((unit) => {
    const manual = unit.skill === "writing" || unit.skill === "speaking";
    const questions = manual
      ? []
      : unit.questions.map((question) => {
          const answered = byQuestion.get(question.id) ?? [];
          const wrong = answered.filter((a) => a.isCorrect === false);
          const correctAnswer =
            answered.find((a) => a.correctAnswerSnapshot)?.correctAnswerSnapshot ??
            (parseCorrectAnswers(question.correctAnswerJson).join(" | ") || null);

          return {
            questionId: question.id,
            order: question.order,
            prompt: question.prompt,
            correctAnswer,
            wrongCount: wrong.length,
            totalCount: submittedCount,
            percentWrong:
              submittedCount === 0
                ? 0
                : Math.round((wrong.length / submittedCount) * 100),
            wrongValues: tallyWrongAnswers(wrong.map((a) => a.value))
          };
        });

    return {
      unitId: unit.id,
      unitTitle: unit.title,
      skill: unit.skill,
      manual,
      questions
    };
  });

  const top = unitStats
    .flatMap((unit) => unit.questions)
    .filter((question) => question.wrongCount > 0)
    .sort((a, b) => b.percentWrong - a.percentWrong || b.wrongCount - a.wrongCount)
    .slice(0, TOP_MISSED_LIMIT);

  return { units: unitStats, top };
}
```

- [ ] **Step 4: Chạy test, xác nhận PASS**

Run: `npx vitest run tests/question-stats.test.ts`
Expected: PASS toàn bộ (7 describe).

- [ ] **Step 5: Commit**

```bash
git add lib/question-stats.ts tests/question-stats.test.ts
git commit -m "feat: chuoi bieu do tien bo va thong ke cau sai theo bai giao

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Component biểu đồ đường `progress-line-chart.tsx`

**Files:**
- Create: `components/progress-line-chart.tsx`

**Interfaces:**
- Consumes: `type SeriesPoint` từ `@/lib/question-stats` (Task 2).
- Produces: `<ProgressLineChart listening={SeriesPoint[]} reading={SeriesPoint[]} />` — client component, Task 5/7 nhúng.

Không có unit test (component thuần hiển thị — repo không test component); kiểm bằng typecheck ở Step 2 và browser ở Task 8.

- [ ] **Step 1: Viết component**

Tạo `components/progress-line-chart.tsx`:

```tsx
"use client";

// Biểu đồ đường % đúng theo thời gian, 2 kỹ năng Nghe/Đọc. SVG tự vẽ (không
// thư viện) — cùng nếp với progress-ring. Trục X co giãn theo thời gian thật
// (bài cùng ngày của 2 kỹ năng thẳng hàng nhau), trục Y cố định 0-100%.
import { useState } from "react";
import type { SeriesPoint } from "@/lib/question-stats";

type SkillKey = "listening" | "reading";

const SKILL_META: Record<SkillKey, { label: string; stroke: string; fill: string; dot: string }> = {
  listening: {
    label: "Nghe",
    stroke: "stroke-primary",
    fill: "fill-primary",
    dot: "bg-primary"
  },
  reading: {
    label: "Đọc",
    stroke: "stroke-emerald-500",
    fill: "fill-emerald-500",
    dot: "bg-emerald-500"
  }
};

const WIDTH = 640;
const HEIGHT = 240;
const PAD_X = 36;
const PAD_TOP = 14;
const PAD_BOTTOM = 26;

function scaleX(timeMs: number, minMs: number, maxMs: number) {
  if (maxMs === minMs) return WIDTH / 2;
  return PAD_X + ((timeMs - minMs) / (maxMs - minMs)) * (WIDTH - PAD_X * 2);
}

function scaleY(percent: number) {
  return HEIGHT - PAD_BOTTOM - (percent / 100) * (HEIGHT - PAD_TOP - PAD_BOTTOM);
}

export function ProgressLineChart({
  listening,
  reading
}: {
  listening: SeriesPoint[];
  reading: SeriesPoint[];
}) {
  const [active, setActive] = useState<{ skill: SkillKey; index: number } | null>(null);

  const allPoints = [...listening, ...reading];
  if (allPoints.length === 0) {
    return (
      <p className="px-5 py-8 text-sm text-muted-foreground">
        Chưa có bài Nghe/Đọc nào được nộp.
      </p>
    );
  }

  const minMs = Math.min(...allPoints.map((p) => p.timeMs));
  const maxMs = Math.max(...allPoints.map((p) => p.timeMs));
  const byTime = [...allPoints].sort((a, b) => a.timeMs - b.timeMs);
  const firstLabel = byTime[0].dateLabel;
  const lastLabel = byTime[byTime.length - 1].dateLabel;

  const series: Array<{ skill: SkillKey; points: SeriesPoint[] }> = [
    { skill: "listening", points: listening },
    { skill: "reading", points: reading }
  ];

  const activePoint =
    active === null
      ? null
      : ((active.skill === "listening" ? listening : reading)[active.index] ?? null);

  return (
    <div>
      <div className="flex items-center gap-4 px-5 pt-4 text-xs font-semibold">
        {series
          .filter((s) => s.points.length > 0)
          .map((s) => (
            <span key={s.skill} className="inline-flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-full ${SKILL_META[s.skill].dot}`} />
              {SKILL_META[s.skill].label}
            </span>
          ))}
      </div>
      <div className="relative px-2 pb-4">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full"
          role="img"
          aria-label="Biểu đồ % đúng theo thời gian"
        >
          {[0, 25, 50, 75, 100].map((tick) => (
            <g key={tick}>
              <line
                x1={PAD_X}
                x2={WIDTH - PAD_X}
                y1={scaleY(tick)}
                y2={scaleY(tick)}
                className="stroke-border"
                strokeWidth={1}
                strokeDasharray={tick === 0 ? undefined : "3 4"}
              />
              <text
                x={PAD_X - 8}
                y={scaleY(tick) + 3.5}
                textAnchor="end"
                className="fill-muted-foreground text-[10px] tabular-nums"
              >
                {tick}
              </text>
            </g>
          ))}
          <text
            x={PAD_X}
            y={HEIGHT - 6}
            className="fill-muted-foreground text-[10px] tabular-nums"
          >
            {firstLabel}
          </text>
          {lastLabel !== firstLabel ? (
            <text
              x={WIDTH - PAD_X}
              y={HEIGHT - 6}
              textAnchor="end"
              className="fill-muted-foreground text-[10px] tabular-nums"
            >
              {lastLabel}
            </text>
          ) : null}
          {series.map(({ skill, points }) =>
            points.length > 1 ? (
              <polyline
                key={skill}
                fill="none"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={SKILL_META[skill].stroke}
                points={points
                  .map((p) => `${scaleX(p.timeMs, minMs, maxMs)},${scaleY(p.percent)}`)
                  .join(" ")}
              />
            ) : null
          )}
          {series.map(({ skill, points }) =>
            points.map((point, index) => (
              <circle
                key={`${skill}-${index}`}
                cx={scaleX(point.timeMs, minMs, maxMs)}
                cy={scaleY(point.percent)}
                r={active?.skill === skill && active.index === index ? 6 : 4}
                strokeWidth={1.5}
                className={`${SKILL_META[skill].fill} cursor-pointer stroke-card`}
                onPointerEnter={() => setActive({ skill, index })}
                onClick={() => setActive({ skill, index })}
              />
            ))
          )}
        </svg>
        {active && activePoint ? (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-pop"
            style={{
              left: `${(scaleX(activePoint.timeMs, minMs, maxMs) / WIDTH) * 100}%`,
              top: `${(scaleY(activePoint.percent) / HEIGHT) * 100}%`
            }}
          >
            <p className="font-semibold">{activePoint.label}</p>
            <p className="mt-0.5 text-muted-foreground">
              {SKILL_META[active.skill].label} · ngày {activePoint.dateLabel} · đúng{" "}
              {activePoint.correct}/{activePoint.total}
              {activePoint.band !== null ? ` · Band ${activePoint.band.toFixed(1)}` : ""}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0, không lỗi.

- [ ] **Step 3: Commit**

```bash
git add components/progress-line-chart.tsx
git commit -m "feat: bieu do duong % dung theo thoi gian (SVG tu ve)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Component tỷ lệ đúng theo dạng câu `question-type-stats.tsx`

**Files:**
- Create: `components/question-type-stats.tsx`

**Interfaces:**
- Consumes: `LOW_DATA_THRESHOLD`, `weakestGroup`, `type SkillFilter`, `type TypeStatsBySkill` từ `@/lib/question-stats` (Task 1).
- Produces: `<QuestionTypeStats stats={TypeStatsBySkill} subject?="Bạn" />` — client component; `subject` là chủ ngữ câu nhắn nhóm yếu nhất (trang giáo viên truyền tên học sinh).

- [ ] **Step 1: Viết component**

Tạo `components/question-type-stats.tsx`:

```tsx
"use client";

// Khối "Tỷ lệ đúng theo dạng câu": 3 tab Tất cả/Nghe/Đọc, mỗi nhóm dạng câu
// một thanh ngang. Nhóm yếu nhất (đủ dữ liệu) tô vàng kèm lời nhắn.
import { useState } from "react";
import {
  LOW_DATA_THRESHOLD,
  weakestGroup,
  type SkillFilter,
  type TypeStatsBySkill
} from "@/lib/question-stats";

const TABS: Array<{ key: SkillFilter; label: string }> = [
  { key: "all", label: "Tất cả" },
  { key: "listening", label: "Nghe" },
  { key: "reading", label: "Đọc" }
];

export function QuestionTypeStats({
  stats,
  subject = "Bạn"
}: {
  stats: TypeStatsBySkill;
  subject?: string;
}) {
  const [filter, setFilter] = useState<SkillFilter>("all");
  const rows = stats[filter];
  const weakest = weakestGroup(rows);
  const hasData = rows.some((row) => row.total > 0);

  return (
    <div className="px-5 py-4">
      <div className="flex gap-1.5">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilter(tab.key)}
            className={
              filter === tab.key
                ? "rounded-full border border-primary/40 bg-primary/10 px-3.5 py-1.5 text-xs font-semibold text-primary"
                : "rounded-full border border-border px-3.5 py-1.5 text-xs font-semibold text-muted-foreground transition hover:border-primary hover:text-primary"
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {hasData ? (
        <div className="mt-4 grid gap-3">
          {rows.map((row) => {
            const isWeakest = weakest !== null && row.key === weakest.key;
            const lowData = row.total > 0 && row.total < LOW_DATA_THRESHOLD;
            const empty = row.total === 0;

            return (
              <div
                key={row.key}
                className={`rounded-lg border px-4 py-3 ${
                  isWeakest
                    ? "border-amber-400/60 bg-amber-500/10"
                    : "border-border bg-background"
                } ${empty || lowData ? "opacity-60" : ""}`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-semibold">{row.label}</p>
                  <p className="text-xs tabular-nums text-muted-foreground">
                    {empty
                      ? "Chưa có dữ liệu"
                      : `${row.percent}% · đúng ${row.correct}/${row.total} câu${
                          lowData ? " · chưa đủ dữ liệu" : ""
                        }`}
                  </p>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${
                      isWeakest ? "bg-amber-500" : "bg-primary"
                    }`}
                    style={{ width: `${row.percent}%` }}
                  />
                </div>
              </div>
            );
          })}
          {weakest ? (
            <p className="text-sm font-medium text-amber-600 dark:text-amber-300">
              {subject} đang yếu nhất ở dạng {weakest.label} — nên luyện thêm.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          Chưa có bài nào ở kỹ năng này.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add components/question-type-stats.tsx
git commit -m "feat: khoi ty le dung theo dang cau voi tab ky nang

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Trang "Tiến bộ" của học sinh + menu

**Files:**
- Create: `app/student/stats/page.tsx`
- Modify: `components/app-shell.tsx` (thêm icon `chart` + mục menu)

**Interfaces:**
- Consumes: `buildProgressSeries`, `questionTypeStatsBySkill` (Task 2/1); `ProgressLineChart` (Task 3); `QuestionTypeStats` (Task 4).
- Produces: route `/student/stats`.

- [ ] **Step 1: Thêm icon + menu vào `components/app-shell.tsx`**

Sửa dòng khai báo `IconName` (dòng ~29) thành:

```tsx
type IconName = "home" | "users" | "book" | "clipboard" | "check" | "clock" | "trophy" | "menu" | "close" | "calendar" | "chart";
```

Thêm case mới vào `switch (name)` trong `Icon` (trước `case "menu":`):

```tsx
    case "chart":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M4 19.5h16" />
          <path d="M5 15.5l4.5-4.5 3.5 3 5.5-6.5" />
        </svg>
      );
```

Sửa mảng `student` trong `navByRole` thành:

```tsx
  student: [
    { href: "/student", label: "Tổng quan", hint: "Bài được giao", icon: "home" },
    { href: "/student/history", label: "Lịch sử", hint: "Kết quả & bài đã làm", icon: "clock" },
    { href: "/student/stats", label: "Tiến bộ", hint: "Biểu đồ & điểm yếu", icon: "chart" },
    { href: "/student/ranking", label: "Xếp hạng", hint: "So với bạn cùng lớp", icon: "trophy" }
  ]
```

- [ ] **Step 2: Tạo `app/student/stats/page.tsx`**

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProgressLineChart } from "@/components/progress-line-chart";
import { QuestionTypeStats } from "@/components/question-type-stats";
import {
  buildProgressSeries,
  questionTypeStatsBySkill
} from "@/lib/question-stats";

export default async function StudentStatsPage() {
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

  const attempts = await prisma.attempt.findMany({
    where: { studentId: student.id, status: { in: ["submitted", "reviewed"] } },
    select: {
      submittedAt: true,
      startedAt: true,
      assignmentRecipient: {
        select: { assignment: { select: { title: true } } }
      },
      answers: {
        select: {
          isCorrect: true,
          assignableUnit: { select: { skill: true } },
          question: { select: { questionType: true } }
        }
      }
    }
  });

  const header = (
    <header>
      <p className="text-sm font-semibold text-primary">Nhìn lại chặng đường</p>
      <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Tiến bộ</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
        Điểm các bài đã nộp theo thời gian và dạng câu bạn làm tốt / cần luyện thêm.
      </p>
    </header>
  );

  if (attempts.length === 0) {
    return (
      <div className="space-y-8">
        {header}
        <section className="rounded-xl border border-border bg-card px-5 py-12 text-center shadow-card">
          <p className="text-sm font-medium">Chưa có dữ liệu tiến bộ</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Nộp bài đầu tiên để xem tiến bộ của bạn.
          </p>
          <Link
            href="/student"
            className="mt-4 inline-flex rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-primary transition hover:border-primary"
          >
            Về trang Tổng quan
          </Link>
        </section>
      </div>
    );
  }

  const series = buildProgressSeries(
    attempts.map((attempt) => ({
      title: attempt.assignmentRecipient.assignment.title,
      // submittedAt luôn có với bài đã nộp; startedAt chỉ là lưới an toàn.
      submittedAt: attempt.submittedAt ?? attempt.startedAt,
      answers: attempt.answers.map((answer) => ({
        isCorrect: answer.isCorrect,
        skill: answer.assignableUnit.skill
      }))
    }))
  );

  const stats = questionTypeStatsBySkill(
    attempts.flatMap((attempt) =>
      attempt.answers.map((answer) => ({
        isCorrect: answer.isCorrect,
        skill: answer.assignableUnit.skill,
        questionType: answer.question?.questionType ?? null
      }))
    )
  );

  return (
    <div className="space-y-8">
      {header}

      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-base font-semibold">% đúng theo thời gian</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Chạm vào một điểm để xem chi tiết bài. Bài đủ 40 câu sẽ hiện kèm band.
          </p>
        </div>
        <ProgressLineChart listening={series.listening} reading={series.reading} />
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-base font-semibold">Tỷ lệ đúng theo dạng câu</h3>
        </div>
        <QuestionTypeStats stats={stats} />
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add app/student/stats/page.tsx components/app-shell.tsx
git commit -m "feat: trang Tien bo cua hoc sinh (bieu do + dang cau yeu)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Thống kê bài giao cho giáo viên

**Files:**
- Create: `app/teacher/assignments/[assignmentId]/stats/page.tsx`
- Modify: `components/assignment-list.tsx` (thêm nút "Thống kê")

**Interfaces:**
- Consumes: `assignmentQuestionStats`, `type QuestionMissStat` (Task 2); `requireTeacher` từ `@/lib/actions/classes`; `SKILL_SHORT_LABELS` từ `@/lib/band-score`.
- Produces: route `/teacher/assignments/[assignmentId]/stats`.

- [ ] **Step 1: Thêm nút "Thống kê" vào `components/assignment-list.tsx`**

Thêm import ở đầu file (sau dòng import đầu tiên):

```tsx
import Link from "next/link";
```

Trong JSX, tìm khối cột phải của mỗi bài:

```tsx
                  <div className="flex flex-col items-start gap-1.5 sm:items-end">
                    <span
```

và thêm nút NGAY TRƯỚC thẻ `<span` (con đầu tiên của div đó):

```tsx
                    <Link
                      href={`/teacher/assignments/${assignment.id}/stats`}
                      className="inline-flex items-center rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-primary transition hover:border-primary"
                    >
                      Thống kê
                    </Link>
```

- [ ] **Step 2: Tạo `app/teacher/assignments/[assignmentId]/stats/page.tsx`**

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTeacher } from "@/lib/actions/classes";
import { prisma } from "@/lib/prisma";
import { SKILL_SHORT_LABELS } from "@/lib/band-score";
import {
  assignmentQuestionStats,
  type QuestionMissStat
} from "@/lib/question-stats";

type StatsPageProps = {
  params: {
    assignmentId: string;
  };
};

// Rút gọn câu hỏi để hiện trong bảng (prompt có thể rất dài).
function shorten(text: string, max = 80) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

function wrongValuesLabel(question: QuestionMissStat) {
  if (question.wrongValues.length === 0) {
    return "—";
  }

  return question.wrongValues
    .map((row) => (row.value ? `"${row.value}" ×${row.count}` : `bỏ trống ×${row.count}`))
    .join(" · ");
}

export default async function AssignmentStatsPage({ params }: StatsPageProps) {
  const teacher = await requireTeacher();

  const assignment = await prisma.assignment.findFirst({
    where: { id: params.assignmentId, teacherId: teacher.id },
    include: {
      units: {
        orderBy: { order: "asc" },
        include: {
          assignableUnit: {
            select: {
              id: true,
              title: true,
              skill: true,
              questions: {
                orderBy: { order: "asc" },
                select: {
                  id: true,
                  order: true,
                  prompt: true,
                  correctAnswerJson: true
                }
              }
            }
          }
        }
      },
      recipients: {
        include: {
          attempts: {
            where: { status: { in: ["submitted", "reviewed"] } },
            select: {
              answers: {
                select: {
                  questionId: true,
                  isCorrect: true,
                  value: true,
                  correctAnswerSnapshot: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (!assignment) {
    notFound();
  }

  const submittedAttempts = assignment.recipients.flatMap(
    (recipient) => recipient.attempts
  );
  const submittedCount = submittedAttempts.length;

  const stats = assignmentQuestionStats(
    assignment.units.map((unit) => ({
      id: unit.assignableUnit.id,
      title: unit.assignableUnit.title,
      skill: unit.assignableUnit.skill,
      questions: unit.assignableUnit.questions
    })),
    submittedAttempts.flatMap((attempt) => attempt.answers),
    submittedCount
  );

  return (
    <div className="space-y-8">
      <header>
        <Link
          href="/teacher/assignments"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary transition hover:underline"
        >
          ← Về danh sách bài giao
        </Link>
        <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
          Thống kê: {assignment.title}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {submittedCount}/{assignment.recipients.length} học sinh đã nộp. Số liệu chỉ
          tính các bài đã nộp.
        </p>
      </header>

      {submittedCount === 0 ? (
        <section className="rounded-xl border border-border bg-card px-5 py-12 text-center shadow-card">
          <p className="text-sm font-medium">Chưa có học sinh nào nộp bài</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Khi có bài nộp, thống kê câu sai sẽ hiển thị ở đây.
          </p>
        </section>
      ) : (
        <>
          {stats.top.length > 0 ? (
            <section className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
              <div className="border-b border-border px-5 py-4">
                <h3 className="text-base font-semibold">Top câu sai nhiều nhất</h3>
              </div>
              <div className="divide-y divide-border">
                {stats.top.map((question) => (
                  <div
                    key={question.questionId}
                    className="flex items-center justify-between gap-4 px-5 py-3"
                  >
                    <p className="min-w-0 text-sm">
                      <span className="font-semibold">Câu {question.order}.</span>{" "}
                      {shorten(question.prompt)}
                    </p>
                    <span className="shrink-0 rounded-full border border-red-400/50 bg-red-500/10 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-red-600 dark:text-red-300">
                      {question.wrongCount}/{question.totalCount} sai · {question.percentWrong}%
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {stats.units.map((unit) => (
            <section
              key={unit.unitId}
              className="overflow-hidden rounded-xl border border-border bg-card shadow-card"
            >
              <div className="border-b border-border px-5 py-4">
                <h3 className="text-base font-semibold">
                  {SKILL_SHORT_LABELS[unit.skill] ?? unit.skill} · {unit.unitTitle}
                </h3>
              </div>
              {unit.manual ? (
                <p className="px-5 py-6 text-sm text-muted-foreground">
                  Phần chấm tay — không có thống kê đúng/sai theo câu.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-5 py-3 font-semibold">Câu hỏi</th>
                        <th className="px-3 py-3 font-semibold">Đáp án đúng</th>
                        <th className="px-3 py-3 font-semibold">Sai</th>
                        <th className="px-5 py-3 font-semibold">Đáp án sai phổ biến</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {unit.questions.map((question) => (
                        <tr
                          key={question.questionId}
                          className={
                            question.percentWrong >= 50 ? "bg-red-500/10" : undefined
                          }
                        >
                          <td className="px-5 py-3">
                            <span className="font-semibold">Câu {question.order}.</span>{" "}
                            {shorten(question.prompt)}
                          </td>
                          <td className="px-3 py-3 font-medium">
                            {question.correctAnswer ?? "—"}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 tabular-nums">
                            {question.wrongCount}/{question.totalCount} · {question.percentWrong}%
                          </td>
                          <td className="px-5 py-3 text-muted-foreground">
                            {wrongValuesLabel(question)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ))}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add "app/teacher/assignments/[assignmentId]/stats/page.tsx" components/assignment-list.tsx
git commit -m "feat: trang thong ke cau sai theo bai giao cho giao vien

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Nhúng tiến bộ & điểm yếu vào hồ sơ học sinh

**Files:**
- Modify: `app/teacher/students/[studentId]/page.tsx`

**Interfaces:**
- Consumes: `buildProgressSeries`, `questionTypeStatsBySkill` (Task 1/2); `ProgressLineChart` (Task 3); `QuestionTypeStats` (Task 4).

- [ ] **Step 1: Sửa truy vấn + thêm section**

Trong `app/teacher/students/[studentId]/page.tsx`:

1. Thêm import (cạnh các import hiện có):

```tsx
import { ProgressLineChart } from "@/components/progress-line-chart";
import { QuestionTypeStats } from "@/components/question-type-stats";
import {
  buildProgressSeries,
  questionTypeStatsBySkill
} from "@/lib/question-stats";
```

2. Trong truy vấn `prisma.studentProfile.findFirst`, khối `attempts.include.answers.select` hiện là:

```tsx
              answers: {
                select: {
                  isCorrect: true,
                  assignableUnit: {
                    select: { skill: true }
                  }
                }
              }
```

sửa thành (thêm `question`):

```tsx
              answers: {
                select: {
                  isCorrect: true,
                  assignableUnit: {
                    select: { skill: true }
                  },
                  question: {
                    select: { questionType: true }
                  }
                }
              }
```

3. Sau khối `if (!student) { notFound(); }`, thêm phần tính toán:

```tsx
  // Gom các lần làm đã nộp của học sinh này (mọi bài giao) cho biểu đồ tiến bộ
  // và thống kê dạng câu — dùng lại đúng logic của trang "Tiến bộ" học sinh.
  const submittedAttempts = student.recipients.flatMap((recipient) =>
    recipient.attempts
      .filter(
        (attempt) => attempt.status === "submitted" || attempt.status === "reviewed"
      )
      .map((attempt) => ({
        title: recipient.assignment.title,
        submittedAt: attempt.submittedAt ?? attempt.startedAt,
        answers: attempt.answers.map((answer) => ({
          isCorrect: answer.isCorrect,
          skill: answer.assignableUnit.skill,
          questionType: answer.question?.questionType ?? null
        }))
      }))
  );

  const progressSeries = buildProgressSeries(submittedAttempts);
  const typeStats = questionTypeStatsBySkill(
    submittedAttempts.flatMap((attempt) => attempt.answers)
  );
```

4. Trong JSX, NGAY TRƯỚC section `<h3 className="text-base font-semibold">Bài tập & lần làm bài</h3>` (section bọc ngoài của nó), thêm:

```tsx
      {submittedAttempts.length > 0 ? (
        <section className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
          <div className="border-b border-border px-5 py-4">
            <h3 className="text-base font-semibold">Tiến bộ & điểm yếu</h3>
          </div>
          <ProgressLineChart
            listening={progressSeries.listening}
            reading={progressSeries.reading}
          />
          <div className="border-t border-border">
            <QuestionTypeStats stats={typeStats} subject={student.displayName} />
          </div>
        </section>
      ) : null}
```

Lưu ý: nếu `student.displayName` có kiểu `string | null` trong schema thì truyền `subject={student.displayName ?? "Học sinh"}` (kiểm tra khi typecheck báo lỗi).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add "app/teacher/students/[studentId]/page.tsx"
git commit -m "feat: tien bo va diem yeu trong ho so hoc sinh (giao vien)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: Kiểm tra tổng thể, xác minh trên trình duyệt, push

**Files:** không tạo file mới.

- [ ] **Step 1: Chạy toàn bộ unit test**

Run: `pnpm test`
Expected: PASS toàn bộ (kể cả các structural test cũ — không đổi schema/seed nên không được fail).

- [ ] **Step 2: Lint + build production**

Run: `pnpm lint` rồi `pnpm build`
Expected: cả hai exit 0. Build phải liệt kê route mới `/student/stats` và `/teacher/assignments/[assignmentId]/stats`.

- [ ] **Step 3: Xác minh trên trình duyệt (dev server qua preview)**

1. Mở preview bằng cấu hình `ielts-dev` có sẵn trong `.claude/launch.json` (KHÔNG chạy `pnpm dev` bằng Bash). DB local là Neon "ielts-test" theo `.env` — không đổi schema nên không cần chuẩn bị gì thêm.
2. **Nhờ giáo viên (user) đăng nhập hộ** — Claude không được phép gõ mật khẩu. Sau khi user đăng nhập tài khoản học sinh: mở `/student/stats`, kiểm tra menu "Tiến bộ", biểu đồ, tab dạng câu, tooltip khi bấm điểm.
3. Với tài khoản giáo viên: mở `/teacher/assignments`, bấm "Thống kê" một bài đã có người nộp — kiểm tra top câu sai, bảng chi tiết, cột đáp án sai phổ biến; mở một hồ sơ học sinh — kiểm tra section "Tiến bộ & điểm yếu".
4. Kiểm tra cả dark mode (nút đổi theme có sẵn) và bề rộng mobile (resize preset `mobile`).
5. Có lỗi -> sửa tại chỗ, chạy lại `npx tsc --noEmit` + test liên quan, commit fix.

- [ ] **Step 4: Push và xác minh deploy**

```bash
git push origin feature/ielts-platform-mvp
```

Vercel tự deploy. Sau khi deploy xong, mở bản prod xác nhận trang mới chạy (nhờ user đăng nhập nếu cần).
