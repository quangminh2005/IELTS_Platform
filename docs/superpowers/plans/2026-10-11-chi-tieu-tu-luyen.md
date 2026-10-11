# Chỉ tiêu tự luyện hàng tuần — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mỗi học viên có chỉ tiêu tự luyện mỗi tuần (thầy đặt, mặc định 1 phần); đạt +30 Xu, trượt −30 Xu (không âm) và mất điểm thành phần "Tự luyện 10%" trong xếp hạng lớp; hiện ở trang chủ HS, chuông, bảng xếp hạng, báo cáo phụ huynh, trang thầy.

**Architecture:** Luật thuần ở `lib/practice-goal.ts` (tuần VN, điều kiện "làm thật", trạng thái tuần, % xếp hạng, kế hoạch sổ Xu). Đọc DB ở `lib/practice-goal-data.ts` (gom "phần" tự luyện từ Attempt/Answer, ghi sổ Xu dưới khoá dòng). Mọi chỗ hiển thị gọi hai module này — không chỗ nào tự tính lại. Không có bảng tuần; chỉ thêm cột `StudentProfile.practiceWeeklyGoal` + hai kind sổ Xu.

**Tech Stack:** Next.js 14 App Router, Prisma/PostgreSQL (Neon), vitest, Tailwind.

**Spec:** `docs/superpowers/specs/2026-10-11-chi-tieu-tu-luyen-design.md`

## Global Constraints

- Chữ hiển thị + comment code bằng **tiếng Việt có dấu**.
- `PRACTICE_GOAL_START = "2026-10-12"` (thứ Hai); tuần = T2 00:00 → CN 23:59 **giờ VN** (UTC+7).
- Chỉ tiêu mặc định **1**, khoảng **0–20**; 0 = miễn (không thưởng, không trừ, % xếp hạng = 100).
- Phần "làm thật": ≥ **180 giây** VÀ (Nghe/Đọc/Viết điền chỗ trống/Nói: ≥ **50%** câu có trả lời; Viết luận: ≥ **50 từ**).
- Thưởng **+30 Xu** kind `practice_goal` key `practice-goal:<thứ Hai>`; trừ **−min(30, số dư)** kind `practice_miss` key `practice-miss:<thứ Hai>`; cả hai KHÔNG thuộc `XP_EARN_KINDS`.
- Xếp hạng: `0.6 × Điểm TB + 0.2 × Hoàn thành + 0.1 × Tự luyện + 0.1 × Hoạt động`.
- Cột mới phải có trong `scripts/ensure-db.mjs` (build tự áp lên prod).
- Server action bắt đầu bằng `requireTeacher()`; trang `app/teacher/**/page.tsx` dùng `requireTeacherPage()`.
- Ghi sổ Xu: `lockStudent` → ghi → `recomputeCoins` trong một `$transaction` (không `increment`).
- Ship tính năng → thêm slide vào `FEATURE_ANNOUNCEMENTS`.

## Review Focus

1. Lượt tự luyện nộp CN 23:59 VN vs T2 00:00 VN phải rơi đúng tuần — test ranh giới trong Task 1.
2. Học viên 0 Xu trượt tuần → dòng `practice_miss` amount 0, số dư vẫn 0, không âm — test trong Task 1 (`missAmount`) + kiểm tay Task 4.
3. Thầy nâng chỉ tiêu sau khi em đã nhận thưởng tuần đó → không bị trừ tuần đó — test `planPracticeGoalLedger` Task 1.
4. Luyện lại cùng một phần hai lần trong tuần → tính 2 phần — test `practiceWeeks` Task 1.
5. Lượt chỉ mở rồi nộp trắng / nộp sau 1 phút → không tính, thẻ HS báo lý do — test `judgePart` Task 1 + kiểm tay Task 6.

---

## File Structure

| File | Trách nhiệm |
|---|---|
| `lib/practice-goal.ts` (mới) | Luật thuần: tuần VN, `judgePart`, `practiceWeeks`, `practiceGoalPercent`, kế hoạch sổ, nhãn |
| `lib/practice-goal-data.ts` (mới) | Đọc phần tự luyện từ DB, `getPracticeGoalStatus(es)`, `syncPracticeGoal` |
| `lib/ranking.ts`, `lib/student-score.ts`, `lib/class-ranking.ts` | Thêm thành phần Tự luyện |
| `lib/coins.ts`, `prisma/schema.prisma`, `scripts/ensure-db.mjs` | Kind sổ mới + cột chỉ tiêu |
| `lib/actions/practice-goal.ts` (mới) | `setPracticeGoal`, `setClassPracticeGoal` |
| `components/practice-goal-card.tsx` (mới) | Thẻ "🎯 Tự luyện tuần này" (HS) |
| `components/practice-goal-weeks.tsx` (mới) | Dải 4 chấm ✓/✗ dùng chung HS/thầy/phụ huynh |
| `components/practice-goal-input.tsx` (mới) | Ô số chỉ tiêu cho thầy (client) |
| `lib/notifications.ts`, `lib/notifications-feed.ts`, `components/notification-list.tsx` | 3 loại chuông |
| `components/class-ranking-board.tsx` | Huy hiệu 🎯 + dòng "Tự luyện a/b tuần" |
| `app/ph/[token]/page.tsx` | Khối "Tự luyện ở nhà" |
| `app/teacher/practice/page.tsx`, `components/practice-progress-table.tsx`, `lib/practice-progress.ts` | Cột Chỉ tiêu + Tuần này, sắp xếp |
| `app/teacher/students/[studentId]/page.tsx` | Khối chỉ tiêu |
| `app/student/page.tsx`, `app/student/practice/page.tsx` | Thẻ + dòng tiến độ |
| `app/api/cron/reminders/route.ts`, `lib/actions/attempts.ts` | Gọi `syncPracticeGoal` |
| `lib/feature-announcements.ts` | 2 slide |

---

### Task 1: Luật thuần `lib/practice-goal.ts`

**Files:**
- Create: `lib/practice-goal.ts`
- Test: `tests/practice-goal.test.ts`

**Interfaces:**
- Consumes: `vietnamDateKey(now: Date): string` (`lib/vocab-day.ts`), `shiftDateKey(key: string, deltaDays: number): string` (`lib/vocab-streak.ts`), `VN_OFFSET_MS` (`lib/streak.ts`).
- Produces (mọi task sau dùng đúng tên này):
  - hằng `PRACTICE_GOAL_START`, `DEFAULT_PRACTICE_GOAL`, `MAX_PRACTICE_GOAL`, `PRACTICE_GOAL_REWARD`, `PRACTICE_GOAL_PENALTY`, `MIN_PART_SECONDS`, `MIN_WRITING_WORDS`, `RECENT_WEEKS`
  - `vnWeekKey(at: Date): string`, `weekEndsAt(weekKey: string): Date`, `weekLabel(weekKey: string): string`
  - `type PracticePart`, `type PartVerdict`, `judgePart(part: PracticePart): PartVerdict`
  - `type WeekStatus`, `practiceWeeks(parts: PracticePart[], goal: number, now: Date): WeekStatus[]` (mới nhất trước, từ tuần START tới tuần hiện tại), `recentWeeks(weeks: WeekStatus[]): WeekStatus[]`
  - `practiceGoalPercent(weeks: WeekStatus[], goal: number): number`
  - `practiceGoalKey(weekKey)`, `practiceMissKey(weekKey)`, `type GoalLedgerStep`, `planPracticeGoalLedger(weeks, goal, existingKeys: Set<string>): GoalLedgerStep[]`, `missAmount(balance: number): number`
  - `countWords(text: string): number`

- [ ] **Step 1: Viết test hỏng**

```ts
// tests/practice-goal.test.ts
import { describe, expect, it } from "vitest";
import {
  countWords,
  judgePart,
  missAmount,
  planPracticeGoalLedger,
  practiceGoalPercent,
  practiceWeeks,
  recentWeeks,
  vnWeekKey,
  weekEndsAt,
  weekLabel,
  type PracticePart
} from "@/lib/practice-goal";

const vn = (iso: string) => new Date(`${iso}+07:00`);

function part(over: Partial<PracticePart> = {}): PracticePart {
  return {
    skill: "reading",
    submittedAt: vn("2026-10-13T20:00:00"),
    seconds: 600,
    questionCount: 13,
    answeredCount: 13,
    isEssay: false,
    writingWords: 0,
    ...over
  };
}

describe("tuần giờ VN", () => {
  it("CN 23:59 VN thuộc tuần trước, T2 00:00 VN thuộc tuần mới", () => {
    expect(vnWeekKey(vn("2026-10-18T23:59:00"))).toBe("2026-10-12");
    expect(vnWeekKey(vn("2026-10-19T00:00:00"))).toBe("2026-10-19");
  });
  it("tuần kết thúc lúc T2 00:00 VN tuần sau", () => {
    expect(weekEndsAt("2026-10-12").toISOString()).toBe("2026-10-18T17:00:00.000Z");
  });
  it("nhãn tuần", () => {
    expect(weekLabel("2026-10-12")).toBe("12/10–18/10");
  });
});

describe("judgePart — làm thật", () => {
  it("dưới 3 phút → too_short", () => {
    expect(judgePart(part({ seconds: 179 }))).toBe("too_short");
  });
  it("trả lời dưới 50% → too_few_answers", () => {
    expect(judgePart(part({ questionCount: 13, answeredCount: 6 }))).toBe("too_few_answers");
  });
  it("đúng 50% → ok", () => {
    expect(judgePart(part({ questionCount: 10, answeredCount: 5 }))).toBe("ok");
  });
  it("Viết luận dưới 50 từ → too_few_answers, đủ 50 → ok", () => {
    const essay = { skill: "writing", isEssay: true, questionCount: 1, answeredCount: 1 };
    expect(judgePart(part({ ...essay, writingWords: 49 }))).toBe("too_few_answers");
    expect(judgePart(part({ ...essay, writingWords: 50 }))).toBe("ok");
  });
  it("phần không có câu nào → too_few_answers", () => {
    expect(judgePart(part({ questionCount: 0, answeredCount: 0 }))).toBe("too_few_answers");
  });
});

describe("countWords", () => {
  it("đếm theo khoảng trắng, bỏ rỗng", () => {
    expect(countWords("  Hello   world\nthis is\tme ")).toBe(5);
    expect(countWords("")).toBe(0);
  });
});

describe("practiceWeeks", () => {
  const now = vn("2026-10-21T10:00:00"); // thứ Tư tuần 19/10

  it("chỉ từ tuần 12/10, mới nhất trước, tuần hiện tại chưa kết thúc", () => {
    const weeks = practiceWeeks([], 1, now);
    expect(weeks.map((w) => w.weekKey)).toEqual(["2026-10-19", "2026-10-12"]);
    expect(weeks[0].ended).toBe(false);
    expect(weeks[1].ended).toBe(true);
  });
  it("trước mốc áp dụng thì không có tuần nào", () => {
    expect(practiceWeeks([], 1, vn("2026-10-11T10:00:00"))).toEqual([]);
  });
  it("luyện lại cùng phần 2 lần → 2 phần; phần không đạt đếm theo lý do", () => {
    const weeks = practiceWeeks(
      [part(), part(), part({ seconds: 30 }), part({ answeredCount: 0 })],
      2,
      now
    );
    const w = weeks.find((x) => x.weekKey === "2026-10-12")!;
    expect(w.done).toBe(2);
    expect(w.met).toBe(true);
    expect(w.rejected).toEqual({ too_short: 1, too_few_answers: 1 });
  });
  it("bỏ phần nộp sau `now` và trước mốc áp dụng", () => {
    const weeks = practiceWeeks(
      [part({ submittedAt: vn("2026-10-22T10:00:00") }), part({ submittedAt: vn("2026-10-05T10:00:00") })],
      1,
      now
    );
    expect(weeks.every((w) => w.done === 0)).toBe(true);
  });
  it("chỉ tiêu 0 → mọi tuần met", () => {
    expect(practiceWeeks([], 0, now).every((w) => w.met)).toBe(true);
  });
  it("recentWeeks lấy tối đa 4 tuần mới nhất", () => {
    const weeks = practiceWeeks([], 1, vn("2026-11-20T10:00:00"));
    expect(recentWeeks(weeks).map((w) => w.weekKey)).toEqual([
      "2026-11-16",
      "2026-11-09",
      "2026-11-02",
      "2026-10-26"
    ]);
  });
});

describe("practiceGoalPercent", () => {
  const now = vn("2026-10-28T10:00:00"); // tuần 26/10 đang chạy
  it("chưa có tuần nào được xét → 100", () => {
    expect(practiceGoalPercent(practiceWeeks([], 1, vn("2026-10-14T10:00:00")), 1)).toBe(100);
  });
  it("tuần hiện tại chưa đạt không bị xét; tuần đã qua trượt bị xét", () => {
    // 12/10 đạt, 19/10 trượt, 26/10 (đang chạy) chưa đạt → 1/2 = 50
    const weeks = practiceWeeks([part()], 1, now);
    expect(practiceGoalPercent(weeks, 1)).toBe(50);
  });
  it("tuần hiện tại đã đạt thì được xét", () => {
    const weeks = practiceWeeks([part(), part({ submittedAt: vn("2026-10-27T09:00:00") })], 1, now);
    expect(practiceGoalPercent(weeks, 1)).toBe(67);
  });
  it("chỉ tiêu 0 → 100", () => {
    expect(practiceGoalPercent(practiceWeeks([], 0, now), 0)).toBe(100);
  });
});

describe("planPracticeGoalLedger", () => {
  const now = vn("2026-10-21T10:00:00");
  it("tuần đạt chưa thưởng → goal; tuần đã qua trượt → miss; tuần đang chạy chưa đạt → không gì", () => {
    const weeks = practiceWeeks([], 1, now);
    expect(planPracticeGoalLedger(weeks, 1, new Set())).toEqual([
      { kind: "practice_miss", key: "practice-miss:2026-10-12", weekKey: "2026-10-12" }
    ]);
  });
  it("đã có thưởng tuần đó → không trừ dù giờ không còn đạt (thầy nâng chỉ tiêu)", () => {
    const weeks = practiceWeeks([part()], 3, now);
    expect(planPracticeGoalLedger(weeks, 3, new Set(["practice-goal:2026-10-12"]))).toEqual([]);
  });
  it("không ghi trùng", () => {
    const weeks = practiceWeeks([part()], 1, now);
    expect(planPracticeGoalLedger(weeks, 1, new Set(["practice-goal:2026-10-12"]))).toEqual([]);
  });
  it("thứ tự cũ → mới để trừ tính theo số dư lần lượt", () => {
    const weeks = practiceWeeks([part({ submittedAt: vn("2026-10-20T10:00:00") })], 1, vn("2026-11-04T10:00:00"));
    expect(planPracticeGoalLedger(weeks, 1, new Set()).map((s) => s.key)).toEqual([
      "practice-miss:2026-10-12",
      "practice-goal:2026-10-19",
      "practice-miss:2026-10-26"
    ]);
  });
  it("chỉ tiêu 0 → không gì", () => {
    expect(planPracticeGoalLedger(practiceWeeks([], 0, now), 0, new Set())).toEqual([]);
  });
});

describe("missAmount", () => {
  it("không để âm", () => {
    expect(missAmount(100)).toBe(-30);
    expect(missAmount(12)).toBe(-12);
    expect(missAmount(0)).toBe(0);
    expect(missAmount(-5)).toBe(0);
  });
});
```

- [ ] **Step 2: Chạy test, phải hỏng**

Run: `npx vitest run tests/practice-goal.test.ts`
Expected: FAIL — `Cannot find module '@/lib/practice-goal'`.

- [ ] **Step 3: Viết `lib/practice-goal.ts`**

```ts
import { VN_OFFSET_MS } from "@/lib/streak";
import { vietnamDateKey } from "@/lib/vocab-day";
import { shiftDateKey } from "@/lib/vocab-streak";

// Chỉ tiêu tự luyện hàng tuần (spec docs/superpowers/specs/2026-10-11-chi-tieu-tu-luyen-design.md).
// Module thuần: không import prisma. Phần đọc/ghi DB ở lib/practice-goal-data.ts.
//
// Tuần = thứ Hai 00:00 → Chủ nhật 23:59 giờ VN, khoá tuần = ngày thứ Hai "YYYY-MM-DD".
// Tuần trước PRACTICE_GOAL_START không tồn tại với mọi luật ở đây (không hồi tố).

export const PRACTICE_GOAL_START = "2026-10-12";
export const DEFAULT_PRACTICE_GOAL = 1;
export const MAX_PRACTICE_GOAL = 20;
export const PRACTICE_GOAL_REWARD = 30;
export const PRACTICE_GOAL_PENALTY = 30;
export const MIN_PART_SECONDS = 180;
export const MIN_WRITING_WORDS = 50;
export const MIN_ANSWERED_RATIO = 0.5;
// Số tuần xét cho thành phần "Tự luyện" của điểm xếp hạng.
export const RECENT_WEEKS = 4;

export function vnWeekKey(at: Date): string {
  const dayKey = vietnamDateKey(at);
  const weekday = new Date(`${dayKey}T00:00:00Z`).getUTCDay(); // 0 = CN
  return shiftDateKey(dayKey, -((weekday + 6) % 7));
}

// Mốc tuần kết thúc = thứ Hai tuần sau 00:00 giờ VN.
export function weekEndsAt(weekKey: string): Date {
  return new Date(Date.parse(`${shiftDateKey(weekKey, 7)}T00:00:00Z`) - VN_OFFSET_MS);
}

function dayMonth(key: string): string {
  const [, month, day] = key.split("-").map(Number);
  return `${day}/${month}`;
}

export function weekLabel(weekKey: string): string {
  return `${dayMonth(weekKey)}–${dayMonth(shiftDateKey(weekKey, 6))}`;
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

// Một phần kỹ năng (AssignableUnit) trong một lượt tự luyện ĐÃ NỘP — mọi lượt, kể cả luyện lại.
export type PracticePart = {
  skill: string;
  submittedAt: Date; // giờ nộp kỹ năng chứa phần này
  seconds: number; // thời gian làm thực của phần
  questionCount: number;
  answeredCount: number; // câu có trả lời (Nói: có ghi âm)
  isEssay: boolean; // phần có câu writing_task → xét số từ
  writingWords: number;
};

export type PartVerdict = "ok" | "too_short" | "too_few_answers";

export function judgePart(part: PracticePart): PartVerdict {
  if (part.seconds < MIN_PART_SECONDS) return "too_short";

  if (part.isEssay && part.skill === "writing") {
    return part.writingWords >= MIN_WRITING_WORDS ? "ok" : "too_few_answers";
  }

  if (part.questionCount <= 0) return "too_few_answers";

  return part.answeredCount / part.questionCount >= MIN_ANSWERED_RATIO ? "ok" : "too_few_answers";
}

export type WeekStatus = {
  weekKey: string;
  done: number; // số phần đạt
  goal: number;
  met: boolean;
  ended: boolean; // tuần đã kết thúc tại `now`
  rejected: { too_short: number; too_few_answers: number };
};

// Mọi tuần từ PRACTICE_GOAL_START tới tuần chứa `now`, MỚI NHẤT TRƯỚC.
export function practiceWeeks(parts: PracticePart[], goal: number, now: Date): WeekStatus[] {
  const current = vnWeekKey(now);
  if (current < PRACTICE_GOAL_START) return [];

  const byWeek = new Map<string, WeekStatus>();
  for (let key = PRACTICE_GOAL_START; key <= current; key = shiftDateKey(key, 7)) {
    byWeek.set(key, {
      weekKey: key,
      done: 0,
      goal,
      met: false,
      ended: weekEndsAt(key).getTime() <= now.getTime(),
      rejected: { too_short: 0, too_few_answers: 0 }
    });
  }

  for (const part of parts) {
    if (part.submittedAt.getTime() > now.getTime()) continue;
    const week = byWeek.get(vnWeekKey(part.submittedAt));
    if (!week) continue;

    const verdict = judgePart(part);
    if (verdict === "ok") week.done += 1;
    else week.rejected[verdict] += 1;
  }

  const weeks = Array.from(byWeek.values());
  for (const week of weeks) week.met = week.done >= goal;

  return weeks.reverse();
}

export function recentWeeks(weeks: WeekStatus[]): WeekStatus[] {
  return weeks.slice(0, RECENT_WEEKS);
}

// Thành phần "Tự luyện" của điểm xếp hạng (0–100). Tuần đang chạy chỉ được xét khi đã
// đạt — chỉ cộng, không trừ giữa tuần. Không có tuần nào được xét → 100.
export function practiceGoalPercent(weeks: WeekStatus[], goal: number): number {
  if (goal <= 0) return 100;

  const considered = recentWeeks(weeks).filter((week) => week.ended || week.met);
  if (considered.length === 0) return 100;

  const met = considered.filter((week) => week.met).length;
  return Math.round((met / considered.length) * 100);
}

export function practiceGoalKey(weekKey: string): string {
  return `practice-goal:${weekKey}`;
}

export function practiceMissKey(weekKey: string): string {
  return `practice-miss:${weekKey}`;
}

export type GoalLedgerStep = {
  kind: "practice_goal" | "practice_miss";
  key: string;
  weekKey: string;
};

// Kế hoạch ghi sổ Xu, CŨ → MỚI (số tiền trừ phụ thuộc số dư lần lượt). Đã thưởng tuần nào
// thì không bao giờ trừ tuần đó; đã trừ thì không thưởng bù.
export function planPracticeGoalLedger(
  weeks: WeekStatus[],
  goal: number,
  existingKeys: Set<string>
): GoalLedgerStep[] {
  if (goal <= 0) return [];

  const steps: GoalLedgerStep[] = [];
  for (const week of [...weeks].reverse()) {
    const goalKey = practiceGoalKey(week.weekKey);
    const missKey = practiceMissKey(week.weekKey);
    if (existingKeys.has(goalKey) || existingKeys.has(missKey)) continue;

    if (week.met) steps.push({ kind: "practice_goal", key: goalKey, weekKey: week.weekKey });
    else if (week.ended) steps.push({ kind: "practice_miss", key: missKey, weekKey: week.weekKey });
  }
  return steps;
}

// Trừ tối đa PRACTICE_GOAL_PENALTY, không để số dư âm. Kết quả ≤ 0.
export function missAmount(balance: number): number {
  return -Math.min(PRACTICE_GOAL_PENALTY, Math.max(0, balance));
}

```

- [ ] **Step 4: Chạy test, phải xanh**

Run: `npx vitest run tests/practice-goal.test.ts`
Expected: PASS toàn bộ. Nếu `practiceGoalPercent` "tuần hiện tại đã đạt" ra 67 không khớp: 12/10 đạt, 19/10 trượt, 26/10 đạt → 2/3 = 66.67 → `Math.round` = 67.

- [ ] **Step 5: Commit**

```bash
git add lib/practice-goal.ts tests/practice-goal.test.ts
git commit -m "feat(tu-luyen): luat thuan chi tieu tu luyen hang tuan"
```

---

### Task 2: Công thức xếp hạng có thành phần Tự luyện

**Files:**
- Modify: `lib/ranking.ts`, `lib/student-score.ts`, `lib/class-ranking.ts`
- Test: `tests/student-score.test.ts`, `tests/class-ranking.test.ts`

**Interfaces:**
- Consumes: `practiceWeeks`, `practiceGoalPercent`, `type PracticePart` (Task 1).
- Produces:
  - `RankingScoreInput.practiceGoalPercent: number`
  - `studentRankingScore({..., practiceGoalPercent?: number})` — thiếu = 100; `StudentScore.practiceGoalPercent: number`
  - `ClassmateRow.practiceGoal?: number` (thiếu = 0 → 100%) và `ClassmateRow.practiceParts?: PracticePart[]`
  - `RankedClassStudent.practiceGoalPercent: number`, `practiceWeeksMet: number`, `practiceWeeksConsidered: number`, `practiceMetThisWeek: boolean`, `practiceGoal: number`

- [ ] **Step 1: Sửa test theo trọng số mới (test hỏng)**

Trong `tests/student-score.test.ts` dòng ~112 (avg 90, hoàn thành 50, hoạt động 100, không truyền tự luyện → 100):
`0.6×90 + 0.2×50 + 0.1×100 + 0.1×100 = 54 + 10 + 10 + 10 = 84`

```ts
    expect(s.rankingScore).toBe(84);
```

Thêm test:

```ts
  it("thành phần Tự luyện 10%", () => {
    const s = studentRankingScore({
      scorePercents: [90],
      completions: [],
      attemptTimes: [],
      practiceGoalPercent: 0,
      now: new Date("2026-10-20T00:00:00Z")
    });
    // 0.6×90 + 0 + 0 + 0 = 54
    expect(s.rankingScore).toBe(54);
    expect(s.practiceGoalPercent).toBe(0);
  });
```

Trong `tests/class-ranking.test.ts`: comment dòng 42 → `rankingScore = scorePercent * 0.6 + 20 + 10` (classmate không có `practiceGoal` → 100%). Dòng 95: `90*0.6 + 100*0.2 + 100*0.1 + 0*0.1 = 54 + 20 + 10 = 84` và sửa mọi `toBe(...)` điểm tuyệt đối theo công thức mới (chạy test để thấy giá trị cũ, tính lại tay theo 0.6/0.2/0.1/0.1 — không chép giá trị thực tế vào test mà không kiểm). Thêm test:

```ts
  it("em trượt chỉ tiêu tự luyện tuần trước tụt dưới em đạt", () => {
    const now = new Date("2026-10-21T10:00:00+07:00");
    const part = {
      skill: "reading",
      submittedAt: new Date("2026-10-14T20:00:00+07:00"),
      seconds: 600,
      questionCount: 13,
      answeredCount: 13,
      isEssay: false,
      writingWords: 0
    };
    const lazy = { ...classmate("a", "An", 80), practiceGoal: 1, practiceParts: [] };
    const busy = { ...classmate("b", "Bình", 80), practiceGoal: 1, practiceParts: [part] };
    const ranked = rankClassmates([lazy, busy], now);
    expect(ranked.map((s) => s.id)).toEqual(["b", "a"]);
    expect(ranked[1].practiceGoalPercent).toBe(0);
    expect(ranked[0].practiceWeeksMet).toBe(1);
    expect(ranked[0].practiceWeeksConsidered).toBe(1);
  });
```

Run: `npx vitest run tests/student-score.test.ts tests/class-ranking.test.ts` → FAIL.

- [ ] **Step 2: `lib/ranking.ts`**

```ts
export type RankingScoreInput = {
  averageScorePercent: number;
  completionRate: number;
  // Thành phần chỉ tiêu tự luyện (lib/practice-goal.ts), 0–100.
  practiceGoalPercent: number;
  recentActivityPercent: number;
};

export function calculateRankingScore(input: RankingScoreInput): number {
  return Math.round(
    input.averageScorePercent * 0.6 +
      input.completionRate * 0.2 +
      input.practiceGoalPercent * 0.1 +
      input.recentActivityPercent * 0.1,
  );
}
```

- [ ] **Step 3: `lib/student-score.ts`**

Thêm `practiceGoalPercent: number;` vào `StudentScore`. Trong `studentRankingScore` thêm tham số `practiceGoalPercent?: number;`, rồi:

```ts
  // Thiếu dữ liệu chỉ tiêu (chỗ gọi cũ) = coi như đạt, không phạt oan.
  const practiceGoalPercent = input.practiceGoalPercent ?? 100;
  const rankingScore = calculateRankingScore({
    averageScorePercent,
    completionRate,
    practiceGoalPercent,
    recentActivityPercent,
  });

  return {
    averageScorePercent,
    completionRate,
    practiceGoalPercent,
    recentActivityPercent,
    rankingScore,
    daysSinceLastActivity
  };
```

`rankingScoreFromRecipientsAndAttempts` không có chỗ gọi nào ngoài file — để nguyên (mặc định 100).

- [ ] **Step 4: `lib/class-ranking.ts`**

Import `practiceGoalPercent, practiceWeeks, recentWeeks, type PracticePart` từ `@/lib/practice-goal`. Thêm vào `ClassmateRow`:

```ts
  // Chỉ tiêu tự luyện/tuần (StudentProfile.practiceWeeklyGoal). Thiếu = 0 → thành phần Tự luyện 100%.
  practiceGoal?: number;
  // Các phần tự luyện đã nộp từ PRACTICE_GOAL_START (lib/practice-goal-data.ts).
  practiceParts?: PracticePart[];
```

Thêm vào `RankedClassStudent`:

```ts
  practiceGoal: number;
  practiceGoalPercent: number;
  // Số tuần đạt / số tuần được xét trong 4 tuần gần nhất — để bảng giải thích con số.
  practiceWeeksMet: number;
  practiceWeeksConsidered: number;
  practiceMetThisWeek: boolean;
```

Trong `scoreAt`, trước `studentRankingScore`:

```ts
  const goal = row.practiceGoal ?? 0;
  const weeks = practiceWeeks(row.practiceParts ?? [], goal, cutoff);
```

truyền `practiceGoalPercent: practiceGoalPercent(weeks, goal)` vào `studentRankingScore`, và trả thêm `weeks` từ `scoreAt`: `return { score, submittedCount: submitted.length, lateCount, weeks };`.

Trong `rankClassmates`, lấy `weeks` từ `scoreAt(row, today, null)` và thêm vào object:

```ts
        practiceGoal: row.practiceGoal ?? 0,
        practiceGoalPercent: score.practiceGoalPercent,
        practiceWeeksMet: considered.filter((week) => week.met).length,
        practiceWeeksConsidered: considered.length,
        practiceMetThisWeek: (row.practiceGoal ?? 0) > 0 && (weeks[0]?.met ?? false),
```

với `const considered = recentWeeks(weeks).filter((week) => week.ended || week.met);` (khi `practiceGoal` = 0 thì `considered` vẫn đúng vì mọi tuần `met`, nhưng UI ẩn dòng này khi goal = 0).

(`getClassRanking` nạp `practiceParts` ở Task 4.)

- [ ] **Step 5: Chạy test**

Run: `npx vitest run tests/student-score.test.ts tests/class-ranking.test.ts tests/practice-goal.test.ts`
Expected: PASS.
Run: `npx tsc --noEmit -p .` → không lỗi kiểu mới (chỗ dựng `RankedClassStudent` bằng tay trong test/component phải thêm field — sửa theo lỗi tsc).

- [ ] **Step 6: Commit**

```bash
git add lib/ranking.ts lib/student-score.ts lib/class-ranking.ts tests/student-score.test.ts tests/class-ranking.test.ts
git commit -m "feat(xep-hang): them thanh phan Tu luyen 10% vao diem xep hang"
```

---

### Task 3: Schema + kind sổ Xu

**Files:**
- Modify: `prisma/schema.prisma` (dòng 27 comment `enum CoinKind`; model `StudentProfile`; comment cột `CoinTransaction.kind` dòng ~731)
- Modify: `scripts/ensure-db.mjs`
- Modify: `lib/coins.ts` (`CoinKind`)
- Test: `tests/practice-goal-schema.test.ts` (mới)

**Interfaces:**
- Produces: cột `StudentProfile.practiceWeeklyGoal Int @default(1)`; `CoinKind` có `"practice_goal" | "practice_miss"`.

- [ ] **Step 1: Test cấu trúc hỏng**

```ts
// tests/practice-goal-schema.test.ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { XP_EARN_KINDS } from "@/lib/xp-rank";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const ensureDb = readFileSync("scripts/ensure-db.mjs", "utf8");

describe("chỉ tiêu tự luyện — schema", () => {
  it("StudentProfile có practiceWeeklyGoal mặc định 1", () => {
    expect(schema).toMatch(/practiceWeeklyGoal\s+Int\s+@default\(1\)/);
  });
  it("ensure-db thêm cột cho prod", () => {
    expect(ensureDb).toContain('"practiceWeeklyGoal" INTEGER NOT NULL DEFAULT 1');
  });
  it("comment CoinKind liệt kê kind mới", () => {
    expect(schema).toMatch(/enum CoinKind.*practice_goal \| practice_miss/);
  });
  it("thưởng/trừ chỉ tiêu không tính XP", () => {
    expect(XP_EARN_KINDS).not.toContain("practice_goal");
    expect(XP_EARN_KINDS).not.toContain("practice_miss");
  });
});
```

Run: `npx vitest run tests/practice-goal-schema.test.ts` → FAIL.

- [ ] **Step 2: Sửa schema**

Dòng 27:

```prisma
// enum CoinKind (CoinTransaction.kind): earn_unit | earn_vocab | purchase | streak_restore | reward_redeem | reward_refund | monthly_prize | practice_goal | practice_miss
```

Comment cột `kind` trong `CoinTransaction` sửa tương tự. Trong `StudentProfile`, sau `hiddenFromBoards`:

```prisma
  // Chỉ tiêu tự luyện mỗi tuần (số PHẦN kỹ năng làm thật) — lib/practice-goal.ts.
  // 0 = miễn: không thưởng/trừ Xu, thành phần Tự luyện của điểm xếp hạng luôn 100.
  practiceWeeklyGoal  Int                   @default(1)
```

- [ ] **Step 3: `scripts/ensure-db.mjs`** — thêm vào mảng câu lệnh (cạnh các `ALTER TABLE "StudentProfile"` khác):

```js
  'ALTER TABLE "StudentProfile" ADD COLUMN IF NOT EXISTS "practiceWeeklyGoal" INTEGER NOT NULL DEFAULT 1;',
```

- [ ] **Step 4: `lib/coins.ts`** — thêm `| "practice_goal" | "practice_miss"` vào `CoinKind`.

- [ ] **Step 5: Áp schema local + test**

Run: `npx prisma db push` (DB local "ielts-test" — xem memory local-db-test-workflow) rồi `npx prisma generate`.
Run: `npx vitest run tests/practice-goal-schema.test.ts tests/foundation.test.ts` → PASS.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma scripts/ensure-db.mjs lib/coins.ts tests/practice-goal-schema.test.ts
git commit -m "feat(tu-luyen): cot practiceWeeklyGoal + kind so Xu practice_goal/practice_miss"
```

---

### Task 4: Tầng dữ liệu `lib/practice-goal-data.ts` + nối vào nộp bài, cron, xếp hạng

**Files:**
- Create: `lib/practice-goal-data.ts`
- Modify: `lib/actions/attempts.ts:478-485` (sau `syncWallet`), `app/api/cron/reminders/route.ts`, `lib/class-ranking.ts` (`getClassRanking`)
- Test: kiểm tay bằng script `tmp/_practice-goal-check.mjs` (DB local) — tầng này là truy vấn, logic đã test ở Task 1.

**Interfaces:**
- Consumes: Task 1 (toàn bộ), `lockStudent`, `recomputeCoins` (`lib/wallet.ts`), `onlyPracticeRecipient` (`lib/practice.ts`), `parsePartTimes` (`lib/skill-times.ts`), `MANUAL_QUESTION_TYPES` (`lib/manual-grading.ts`).
- Produces:
  - `loadPracticeParts(studentIds: string[]): Promise<Map<string, PracticePart[]>>`
  - `type PracticeGoalStatus = { goal: number; weeks: WeekStatus[]; current: WeekStatus | null; percent: number }`
  - `getPracticeGoalStatuses(students: Array<{ id: string; practiceWeeklyGoal: number }>, now?: Date): Promise<Map<string, PracticeGoalStatus>>`
  - `getPracticeGoalStatus(studentId: string, now?: Date): Promise<PracticeGoalStatus>`
  - `syncPracticeGoal(studentId: string, now?: Date): Promise<number>` (số dòng sổ đã ghi)
  - `syncAllPracticeGoals(now?: Date): Promise<number>`

- [ ] **Step 1: Viết `lib/practice-goal-data.ts`**

```ts
import { prisma } from "@/lib/prisma";
import { MANUAL_QUESTION_TYPES } from "@/lib/manual-grading";
import { onlyPracticeRecipient } from "@/lib/practice";
import {
  PRACTICE_GOAL_REWARD,
  PRACTICE_GOAL_START,
  countWords,
  missAmount,
  planPracticeGoalLedger,
  practiceGoalPercent,
  practiceWeeks,
  weekLabel,
  type PracticePart,
  type WeekStatus
} from "@/lib/practice-goal";
import { parsePartTimes } from "@/lib/skill-times";
import { lockStudent, recomputeCoins } from "@/lib/wallet";

// Đọc DB cho chỉ tiêu tự luyện. Luật nằm hết ở lib/practice-goal.ts.

const START_AT = new Date(`${PRACTICE_GOAL_START}T00:00:00+07:00`);

// Mọi phần tự luyện ĐÃ NỘP (mọi lượt) từ mốc áp dụng, gom theo học viên.
export async function loadPracticeParts(studentIds: string[]): Promise<Map<string, PracticePart[]>> {
  const result = new Map<string, PracticePart[]>(studentIds.map((id) => [id, []]));
  if (studentIds.length === 0) return result;

  const attempts = await prisma.attempt.findMany({
    where: {
      studentId: { in: studentIds },
      assignmentRecipient: onlyPracticeRecipient,
      skills: { some: { submittedAt: { gte: START_AT } } }
    },
    select: {
      id: true,
      studentId: true,
      partTimesJson: true,
      skills: { select: { skill: true, submittedAt: true, elapsedSeconds: true } }
    }
  });
  if (attempts.length === 0) return result;

  const attemptIds = attempts.map((attempt) => attempt.id);

  // Sau khi nộp, mỗi câu của phần có đúng một dòng Answer (submitSkill xoá rồi tạo lại đủ).
  const [allGroups, answeredGroups, essays] = await Promise.all([
    prisma.answer.groupBy({
      by: ["attemptId", "assignableUnitId"],
      where: { attemptId: { in: attemptIds } },
      _count: { _all: true }
    }),
    prisma.answer.groupBy({
      by: ["attemptId", "assignableUnitId"],
      where: { attemptId: { in: attemptIds }, value: { not: "" } },
      _count: { _all: true }
    }),
    prisma.answer.findMany({
      where: { attemptId: { in: attemptIds }, question: { questionType: "writing_task" } },
      select: { attemptId: true, assignableUnitId: true, value: true }
    })
  ]);

  const unitIds = Array.from(new Set(allGroups.map((group) => group.assignableUnitId)));
  const units = new Map(
    (
      await prisma.assignableUnit.findMany({
        where: { id: { in: unitIds } },
        select: {
          id: true,
          skill: true,
          questions: {
            where: { questionType: { in: [...MANUAL_QUESTION_TYPES] } },
            select: { id: true },
            take: 1
          }
        }
      })
    ).map((unit) => [unit.id, { skill: unit.skill, isEssay: unit.questions.length > 0 }])
  );

  const answered = new Map(
    answeredGroups.map((group) => [`${group.attemptId}:${group.assignableUnitId}`, group._count._all])
  );
  const words = new Map<string, number>();
  for (const essay of essays) {
    const key = `${essay.attemptId}:${essay.assignableUnitId}`;
    words.set(key, (words.get(key) ?? 0) + countWords(essay.value));
  }

  const attemptById = new Map(attempts.map((attempt) => [attempt.id, attempt]));
  // Số phần mỗi kỹ năng trong một lượt — chia đều thời gian khi thiếu partTimesJson.
  const unitsPerSkill = new Map<string, number>();
  for (const group of allGroups) {
    const unit = units.get(group.assignableUnitId);
    if (!unit) continue;
    const key = `${group.attemptId}:${unit.skill}`;
    unitsPerSkill.set(key, (unitsPerSkill.get(key) ?? 0) + 1);
  }

  for (const group of allGroups) {
    const attempt = attemptById.get(group.attemptId);
    const unit = units.get(group.assignableUnitId);
    if (!attempt || !unit) continue;

    const skill = attempt.skills.find((row) => row.skill === unit.skill);
    // Kỹ năng chưa nộp: dòng Answer chỉ là nháp tự lưu.
    if (!skill?.submittedAt || skill.submittedAt < START_AT) continue;

    const partTimes = parsePartTimes(attempt.partTimesJson);
    const share = unitsPerSkill.get(`${attempt.id}:${unit.skill}`) ?? 1;
    const seconds = partTimes[group.assignableUnitId] ?? Math.floor(skill.elapsedSeconds / share);
    const key = `${group.attemptId}:${group.assignableUnitId}`;

    result.get(attempt.studentId)?.push({
      skill: unit.skill,
      submittedAt: skill.submittedAt,
      seconds,
      questionCount: group._count._all,
      answeredCount: answered.get(key) ?? 0,
      isEssay: unit.isEssay,
      writingWords: words.get(key) ?? 0
    });
  }

  return result;
}

export type PracticeGoalStatus = {
  goal: number;
  weeks: WeekStatus[]; // mới nhất trước, từ PRACTICE_GOAL_START
  current: WeekStatus | null; // tuần đang chạy; null trước mốc áp dụng
  percent: number; // thành phần Tự luyện của điểm xếp hạng
};

export async function getPracticeGoalStatuses(
  students: Array<{ id: string; practiceWeeklyGoal: number }>,
  now = new Date()
): Promise<Map<string, PracticeGoalStatus>> {
  const parts = await loadPracticeParts(students.map((student) => student.id));
  return new Map(
    students.map((student) => {
      const goal = student.practiceWeeklyGoal;
      const weeks = practiceWeeks(parts.get(student.id) ?? [], goal, now);
      return [student.id, { goal, weeks, current: weeks[0] ?? null, percent: practiceGoalPercent(weeks, goal) }];
    })
  );
}

export async function getPracticeGoalStatus(studentId: string, now = new Date()): Promise<PracticeGoalStatus> {
  const student = await prisma.studentProfile.findUniqueOrThrow({
    where: { id: studentId },
    select: { id: true, practiceWeeklyGoal: true }
  });
  const statuses = await getPracticeGoalStatuses([student], now);
  return statuses.get(studentId)!;
}

// Ghi thưởng/trừ còn thiếu. Idempotent: khoá dòng + kiểm key trong transaction.
export async function syncPracticeGoal(studentId: string, now = new Date()): Promise<number> {
  const status = await getPracticeGoalStatus(studentId, now);
  if (status.goal <= 0 || status.weeks.length === 0) return 0;

  return prisma.$transaction(async (tx) => {
    await lockStudent(tx, studentId);
    const existing = await tx.coinTransaction.findMany({
      where: { studentId, kind: { in: ["practice_goal", "practice_miss"] } },
      select: { key: true }
    });
    const steps = planPracticeGoalLedger(status.weeks, status.goal, new Set(existing.map((row) => row.key)));
    if (steps.length === 0) return 0;

    let balance = (await tx.studentProfile.findUniqueOrThrow({ where: { id: studentId }, select: { coins: true } }))
      .coins;
    for (const step of steps) {
      const amount = step.kind === "practice_goal" ? PRACTICE_GOAL_REWARD : missAmount(balance);
      await tx.coinTransaction.create({
        data: {
          studentId,
          kind: step.kind,
          key: step.key,
          amount,
          note:
            step.kind === "practice_goal"
              ? `Đạt chỉ tiêu tự luyện tuần ${weekLabel(step.weekKey)}`
              : `Chưa đạt chỉ tiêu tự luyện tuần ${weekLabel(step.weekKey)}`
        }
      });
      balance = await recomputeCoins(tx, studentId);
    }
    return steps.length;
  });
}

// Cron trưa: mọi học viên có chỉ tiêu ≥ 1. Lỗi một em không chặn các em khác.
export async function syncAllPracticeGoals(now = new Date()): Promise<number> {
  const students = await prisma.studentProfile.findMany({
    where: { practiceWeeklyGoal: { gt: 0 } },
    select: { id: true }
  });
  let written = 0;
  for (const student of students) {
    try {
      written += await syncPracticeGoal(student.id, now);
    } catch (error) {
      console.error("[chi-tieu-tu-luyen] không ghi được sổ Xu", student.id, error);
    }
  }
  return written;
}
```

Lưu ý: kiểm `lib/wallet.ts` không import ngược `practice-goal-data` (tránh vòng). `recomputeCoins` trả số dư mới — dùng làm `balance` cho bước trừ kế tiếp.

- [ ] **Step 2: Nối vào `submitSkill`** (`lib/actions/attempts.ts`, ngay sau khối try `syncWallet`):

```ts
  // Chỉ tiêu tự luyện tuần: đạt thì +30 Xu ngay. Lỗi không chặn nộp bài.
  try {
    await syncPracticeGoal(student.id);
  } catch (error) {
    console.error("[chi-tieu-tu-luyen] không đồng bộ được sau khi nộp", error);
  }
```

Import `syncPracticeGoal` từ `@/lib/practice-goal-data`.

- [ ] **Step 3: Nối vào cron** (`app/api/cron/reminders/route.ts`, sau khối `grantMonthlyPrizes` hiện có, cùng kiểu try/catch):

```ts
  let practiceGoalRows = 0;
  try {
    practiceGoalRows = await syncAllPracticeGoals();
  } catch (error) {
    console.error("[cron/reminders] chỉ tiêu tự luyện:", error);
  }
```

và thêm `practiceGoalRows` vào JSON trả về. Import `syncAllPracticeGoals`.

- [ ] **Step 4: `getClassRanking` nạp dữ liệu tự luyện** (`lib/class-ranking.ts`)

Sau `skillCounts`:

```ts
  const practiceParts = await loadPracticeParts(classmates.map((classmate) => classmate.student.id));
```

Trong map dựng `ClassmateRow` thêm:

```ts
      practiceGoal: classmate.student.practiceWeeklyGoal,
      practiceParts: practiceParts.get(classmate.student.id) ?? [],
```

(`include` của student đã mang mọi cột vô hướng nên có sẵn `practiceWeeklyGoal`.)

- [ ] **Step 5: Kiểm tay trên DB local**

Viết `tmp/_practice-goal-check.mjs` chạy bằng `npx tsx --env-file=.env tmp/_practice-goal-check.mjs` (tsx để import TS):

```js
import { getPracticeGoalStatus, syncPracticeGoal } from "../lib/practice-goal-data.ts";
import { prisma } from "../lib/prisma.ts";

const student = await prisma.studentProfile.findFirst({ where: { email: "student@example.com" } });
console.log(JSON.stringify(await getPracticeGoalStatus(student.id), null, 2));
console.log("ghi", await syncPracticeGoal(student.id, new Date("2026-10-20T10:00:00+07:00")));
console.log("ghi lại", await syncPracticeGoal(student.id, new Date("2026-10-20T10:00:00+07:00")));
console.log(await prisma.coinTransaction.findMany({ where: { studentId: student.id, kind: { startsWith: "practice_" } } }));
await prisma.$disconnect();
```

Expected: lần 1 ghi 1 dòng `practice-miss:2026-10-12` (seed chưa có lượt tự luyện) với amount = −min(30, số dư); lần 2 ghi 0. Sau đó xoá dòng thử: `DELETE FROM "CoinTransaction" WHERE key LIKE 'practice-%'` + tính lại coins (hoặc chạy `syncWallet` đầy đủ không đổi coins — dùng `recomputeCoins` qua script). Xoá script sau khi xong.

- [ ] **Step 6: Test + commit**

Run: `pnpm test` → PASS. `npx tsc --noEmit -p .` → sạch.

```bash
git add lib/practice-goal-data.ts lib/actions/attempts.ts app/api/cron/reminders/route.ts lib/class-ranking.ts
git commit -m "feat(tu-luyen): doc phan tu luyen tu DB, ghi thuong/tru Xu, noi vao nop bai + cron + xep hang"
```

---

### Task 5: Thầy đặt chỉ tiêu — action + cột ở `/teacher/practice` + khối trang học viên

**Files:**
- Create: `lib/actions/practice-goal.ts`, `components/practice-goal-input.tsx`, `components/practice-goal-weeks.tsx`
- Modify: `app/teacher/practice/page.tsx`, `components/practice-progress-table.tsx`, `lib/practice-progress.ts`, `app/teacher/students/[studentId]/page.tsx`
- Test: `tests/practice-progress.test.ts` (đã có — thêm case sắp xếp), `tests/practice-goal-actions.test.ts` (mới, cấu trúc)

**Interfaces:**
- Consumes: `getPracticeGoalStatuses`, `PracticeGoalStatus` (Task 4); `MAX_PRACTICE_GOAL`, `weekLabel`, `WeekStatus` (Task 1).
- Produces:
  - `setPracticeGoal(formData: FormData): Promise<ActionResult>` (fields `studentId`, `goal`)
  - `setClassPracticeGoal(formData: FormData): Promise<ActionResult>` (fields `classId`, `goal`)
  - `<PracticeGoalInput studentId goal />`, `<PracticeGoalWeeks weeks={WeekStatus[]} />`
  - `PracticeStudentRow` thêm `goal?: { goal: number; done: number; met: boolean }`

- [ ] **Step 1: Test hỏng**

```ts
// tests/practice-goal-actions.test.ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("lib/actions/practice-goal.ts", "utf8");

describe("actions chỉ tiêu tự luyện", () => {
  it("bắt đầu bằng requireTeacher và giới hạn 0–20", () => {
    expect(source).toContain('"use server"');
    expect(source.match(/await requireTeacher\(\)/g)?.length).toBe(2);
    expect(source).toContain("MAX_PRACTICE_GOAL");
  });
  it("chỉ sửa học viên thuộc lớp của thầy", () => {
    expect(source).toMatch(/classes:\s*\{\s*some:\s*\{\s*class:\s*\{\s*teacherId/);
  });
});
```

Trong `tests/practice-progress.test.ts` thêm (đọc file trước để dùng đúng helper dựng dòng đã có):

```ts
  it("sắp 'cần nhắc': em chưa đạt chỉ tiêu tuần này lên trước em đã đạt", () => {
    // hai em cùng daysSinceLastPractice; em A goal.met=false, em B goal.met=true
    // → buildPracticeStudentRows(..., "attention") trả A trước B
  });
```

(viết đầy đủ theo helper của file — dựng 2 student + attempts giống nhau, truyền map goal `{A:{goal:1,done:0,met:false}, B:{goal:1,done:1,met:true}}`.)

- [ ] **Step 2: `lib/actions/practice-goal.ts`**

Đọc `lib/actions/classes.ts` để lấy đúng import `requireTeacher` và kiểu `ActionResult` (memory toast-action-result-pattern: cơ chế A `ActionResult` + `ActionForm`).

```ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTeacher } from "@/lib/actions/classes";
import type { ActionResult } from "@/lib/action-result";
import { MAX_PRACTICE_GOAL } from "@/lib/practice-goal";
import { prisma } from "@/lib/prisma";

const goalSchema = z.coerce.number().int().min(0).max(MAX_PRACTICE_GOAL);

export async function setPracticeGoal(formData: FormData): Promise<ActionResult> {
  const teacher = await requireTeacher();
  const studentId = z.string().min(1).safeParse(formData.get("studentId"));
  const goal = goalSchema.safeParse(formData.get("goal"));
  if (!studentId.success || !goal.success) {
    return { ok: false, message: `Chỉ tiêu phải là số từ 0 đến ${MAX_PRACTICE_GOAL}.` };
  }

  const updated = await prisma.studentProfile.updateMany({
    where: { id: studentId.data, classes: { some: { class: { teacherId: teacher.id } } } },
    data: { practiceWeeklyGoal: goal.data }
  });
  if (updated.count === 0) return { ok: false, message: "Không tìm thấy học viên." };

  revalidatePath("/teacher/practice");
  revalidatePath(`/teacher/students/${studentId.data}`);
  return { ok: true, message: goal.data === 0 ? "Đã miễn chỉ tiêu." : `Đã đặt ${goal.data} phần/tuần.` };
}

export async function setClassPracticeGoal(formData: FormData): Promise<ActionResult> {
  const teacher = await requireTeacher();
  const classId = z.string().min(1).safeParse(formData.get("classId"));
  const goal = goalSchema.safeParse(formData.get("goal"));
  if (!classId.success || !goal.success) {
    return { ok: false, message: `Chỉ tiêu phải là số từ 0 đến ${MAX_PRACTICE_GOAL}.` };
  }

  const updated = await prisma.studentProfile.updateMany({
    where: { classes: { some: { class: { id: classId.data, teacherId: teacher.id } } } },
    data: { practiceWeeklyGoal: goal.data }
  });

  revalidatePath("/teacher/practice");
  return { ok: true, message: `Đã đặt ${goal.data} phần/tuần cho ${updated.count} học viên.` };
}
```

Nếu `ActionResult` sống ở file khác hoặc có hình dạng khác (`{ status, message }`…), dùng đúng hình dạng có sẵn — grep `export type ActionResult`.

- [ ] **Step 3: `components/practice-goal-input.tsx`** (client; lưu khi rời ô, toast qua cơ chế đang có)

```tsx
"use client";

import { useRef, useTransition } from "react";
import { setPracticeGoal } from "@/lib/actions/practice-goal";
import { MAX_PRACTICE_GOAL } from "@/lib/practice-goal";
import { showToast } from "@/lib/toast"; // dùng đúng hàm toast dự án đang dùng — grep "toast" trong components/action-form.tsx

export function PracticeGoalInput({ studentId, goal }: { studentId: string; goal: number }) {
  const [pending, startTransition] = useTransition();
  const last = useRef(goal);

  function save(value: string) {
    const next = Number(value);
    if (!Number.isInteger(next) || next === last.current) return;
    startTransition(async () => {
      const formData = new FormData();
      formData.set("studentId", studentId);
      formData.set("goal", String(next));
      const result = await setPracticeGoal(formData);
      if (result.ok) last.current = next;
      showToast(result);
    });
  }

  return (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      max={MAX_PRACTICE_GOAL}
      defaultValue={goal}
      disabled={pending}
      aria-label="Chỉ tiêu tự luyện mỗi tuần"
      onBlur={(event) => save(event.currentTarget.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
      className="w-14 rounded-md border border-border bg-background px-2 py-1 text-center text-sm tabular-nums"
    />
  );
}
```

- [ ] **Step 4: `components/practice-goal-weeks.tsx`** (server-safe, dùng chung HS/thầy/phụ huynh)

```tsx
import { weekLabel, type WeekStatus } from "@/lib/practice-goal";

// Dải chấm 4 tuần gần nhất, CŨ bên trái → MỚI bên phải. Tuần đang chạy chưa đạt = chấm rỗng.
export function PracticeGoalWeeks({ weeks }: { weeks: WeekStatus[] }) {
  const shown = weeks.slice(0, 4).reverse();
  if (shown.length === 0) return null;

  return (
    <ol className="flex gap-1.5" aria-label="Chỉ tiêu tự luyện 4 tuần gần nhất">
      {shown.map((week) => {
        const state = week.met ? "met" : week.ended ? "missed" : "running";
        const label = `${weekLabel(week.weekKey)}: ${week.done}/${week.goal} phần — ${
          state === "met" ? "đạt" : state === "missed" ? "chưa đạt" : "đang làm"
        }`;
        return (
          <li
            key={week.weekKey}
            title={label}
            aria-label={label}
            className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
              state === "met"
                ? "bg-emerald-500 text-white"
                : state === "missed"
                  ? "bg-rose-500 text-white"
                  : "border-2 border-dashed border-border text-muted-foreground"
            }`}
          >
            {state === "met" ? "✓" : state === "missed" ? "✗" : ""}
          </li>
        );
      })}
    </ol>
  );
}
```

- [ ] **Step 5: `/teacher/practice`**

- `app/teacher/practice/page.tsx`: thêm `practiceWeeklyGoal: true` vào `select` học viên; sau khi có `students`: `const goalStatuses = await getPracticeGoalStatuses(students, now);` và truyền `goalByStudent` (Map id → `{ goal, done: current?.done ?? 0, met: current?.met ?? false }`) vào `buildPracticeStudentRows`.
- `lib/practice-progress.ts`: `PracticeStudentRow` thêm `goal?: { goal: number; done: number; met: boolean }`; `buildPracticeStudentRows` nhận tham số tuỳ chọn `goals?: Map<string, {goal;done;met}>` gắn vào từng dòng; comparator `"attention"` đặt **trước** luật cũ: em có `goal.goal > 0 && !goal.met` lên trên em đã đạt/miễn.
- `components/practice-progress-table.tsx`: thêm 2 cột ở đầu phần cột phụ — "Chỉ tiêu" (`<PracticeGoalInput>`) và "Tuần này" (`{done}/{goal}` + ✓ xanh khi met, chữ đỏ khi chưa; goal 0 → "Miễn"). Mở rộng `COLUMN_CLASS`: `md:grid-cols-[minmax(0,1fr)_3.5rem_4.5rem_6.5rem_3.5rem_6rem_7rem_4.5rem]`; trên điện thoại hiện "Chỉ tiêu"+"Tuần này" trong khối gộp dưới tên (giữ ô input). Bảng đang bó ~730px: nếu tên bị cắt quá ngắn thì ẩn cột "Số đề" ở md, chỉ hiện từ `xl:`.
- Khi đang lọc một lớp (`selectedClassId`), trên bảng hiện form "Đặt cho cả lớp: [ô số] [Áp dụng]" dùng `ActionForm` + `setClassPracticeGoal` với `<input type="hidden" name="classId">`.

- [ ] **Step 6: Trang chi tiết học viên** (`app/teacher/students/[studentId]/page.tsx`) — ngay trên `<StudentPracticeHistory>`:

```tsx
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-5 py-4 shadow-card">
        <div>
          <h3 className="text-base font-semibold">🎯 Chỉ tiêu tự luyện</h3>
          <p className="text-sm text-muted-foreground">
            {goalStatus.goal === 0
              ? "Đang miễn chỉ tiêu."
              : `Tuần này ${goalStatus.current?.done ?? 0}/${goalStatus.goal} phần · đạt +30 Xu, không đạt −30 Xu`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <PracticeGoalWeeks weeks={goalStatus.weeks} />
          <label className="flex items-center gap-2 text-sm">
            Phần/tuần <PracticeGoalInput studentId={student.id} goal={goalStatus.goal} />
          </label>
        </div>
      </section>
```

với `const goalStatus = await getPracticeGoalStatus(student.id);` (thêm vào `Promise.all` có sẵn của trang).

- [ ] **Step 7: Test + kiểm tay + commit**

Run: `pnpm test` → PASS; `pnpm lint` → sạch.
Kiểm tay (`pnpm dev`, vai GV — memory: ký JWT local): `/teacher/practice` đổi chỉ tiêu 1 em → toast "Đã đặt …", reload giữ giá trị; lọc 1 lớp → "Đặt cho cả lớp" đổi tất cả; khổ 375px không cuộn ngang.

```bash
git add lib/actions/practice-goal.ts components/practice-goal-input.tsx components/practice-goal-weeks.tsx app/teacher/practice/page.tsx components/practice-progress-table.tsx lib/practice-progress.ts "app/teacher/students/[studentId]/page.tsx" tests/practice-goal-actions.test.ts tests/practice-progress.test.ts
git commit -m "feat(tu-luyen): thay dat chi tieu tung hoc vien / ca lop, cot Tuan nay"
```

---

### Task 6: Thẻ học viên ở `/student` + dòng tiến độ ở `/student/practice`

**Files:**
- Create: `components/practice-goal-card.tsx`
- Modify: `app/student/page.tsx`, `app/student/practice/page.tsx`

**Interfaces:**
- Consumes: `getPracticeGoalStatus`, `syncPracticeGoal` (Task 4); `PracticeGoalWeeks` (Task 5); `PRACTICE_GOAL_REWARD`, `PRACTICE_GOAL_PENALTY` (Task 1).
- Produces: `<PracticeGoalCard status={PracticeGoalStatus} />`

- [ ] **Step 1: `components/practice-goal-card.tsx`**

```tsx
import Link from "next/link";
import { PracticeGoalWeeks } from "@/components/practice-goal-weeks";
import { PRACTICE_GOAL_PENALTY, PRACTICE_GOAL_REWARD } from "@/lib/practice-goal";
import type { PracticeGoalStatus } from "@/lib/practice-goal-data";

export function PracticeGoalCard({ status }: { status: PracticeGoalStatus }) {
  const week = status.current;
  if (status.goal === 0 || !week) return null;

  const done = Math.min(week.done, status.goal);
  const percent = Math.round((done / status.goal) * 100);
  const rejected = week.rejected.too_short + week.rejected.too_few_answers;

  return (
    <section
      className={`rounded-xl border p-5 shadow-card ${
        week.met ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40" : "border-border bg-card"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">🎯 Tự luyện tuần này</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {week.met
              ? `Đã đạt ✓ +${PRACTICE_GOAL_REWARD} Xu`
              : `Đạt +${PRACTICE_GOAL_REWARD} Xu · Không đạt −${PRACTICE_GOAL_PENALTY} Xu · hạn Chủ nhật`}
          </p>
        </div>
        <PracticeGoalWeeks weeks={status.weeks} />
      </div>

      <div className="mt-4 flex items-center gap-3">
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full ${week.met ? "bg-emerald-500" : "bg-primary"}`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className="text-sm font-semibold tabular-nums">
          {week.done}/{status.goal} phần
        </span>
      </div>

      {rejected > 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {rejected} lượt chưa tính
          {week.rejected.too_short > 0 ? ` · ${week.rejected.too_short} lượt làm dưới 3 phút` : ""}
          {week.rejected.too_few_answers > 0 ? ` · ${week.rejected.too_few_answers} lượt trả lời chưa tới một nửa` : ""}
        </p>
      ) : null}

      {!week.met ? (
        <Link
          href="/student/practice"
          className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          Luyện ngay
        </Link>
      ) : null}
    </section>
  );
}
```

- [ ] **Step 2: Trang chủ `/student`** — trước `Promise.all` lớn, gọi trừ cho tuần đã qua (lỗi không làm hỏng trang):

```ts
  try {
    await syncPracticeGoal(student.id);
  } catch (error) {
    console.error("[chi-tieu-tu-luyen] trang chủ", error);
  }
```

Thêm `getPracticeGoalStatus(student.id).catch(() => null)` vào `Promise.all`, đặt `<PracticeGoalCard status={practiceGoal} />` (khi khác null) ngay dưới thẻ chuỗi ngày 🔥 / trên `VocabCard`. Kiểm khổ 375px.

- [ ] **Step 3: `/student/practice`** — cùng `syncPracticeGoal` + `getPracticeGoalStatus`; ở đầu trang (dưới tiêu đề) một dòng:

```tsx
{practiceGoal && practiceGoal.goal > 0 && practiceGoal.current ? (
  <p className="rounded-lg border border-border bg-card px-4 py-2 text-sm">
    🎯 Tuần này: <strong className="tabular-nums">{practiceGoal.current.done}/{practiceGoal.goal}</strong> phần
    {practiceGoal.current.met ? " — đã đạt ✓" : " — mỗi phần làm ít nhất 3 phút và trả lời từ một nửa số câu"}
  </p>
) : null}
```

- [ ] **Step 4: Kiểm tay + commit**

`pnpm dev`, vai HS (JWT tự ký): thẻ hiện 0/1; làm 1 passage Reading trả lời đủ, ≥ 3 phút (hoặc sửa tạm `elapsedSeconds`/`partTimesJson` trong DB local) → thẻ xanh "+30 Xu", số Xu ở chip tăng 30; lượt nộp trắng → dòng "1 lượt chưa tính · … chưa tới một nửa". Khổ 375px.

```bash
git add components/practice-goal-card.tsx app/student/page.tsx app/student/practice/page.tsx
git commit -m "feat(tu-luyen): the Tu luyen tuan nay o trang chu hoc vien"
```

---

### Task 7: Chuông thông báo

**Files:**
- Modify: `lib/notifications.ts`, `lib/notifications-feed.ts`, `components/notification-list.tsx`
- Test: `tests/notifications.test.ts`

**Interfaces:**
- Consumes: `getPracticeGoalStatus` (Task 4), `weekEndsAt`, `weekLabel`, `PRACTICE_GOAL_START` (Task 1).
- Produces: `StudentNotificationType` thêm `"practice_reminder" | "practice_goal_met" | "practice_missed"`; types `PracticeReminderSource = { weekKey: string; remaining: number; createdAt: Date }`, `PracticeLedgerSource = { key: string; kind: "practice_goal" | "practice_miss"; amount: number; createdAt: Date }`; `buildStudentNotifications` tham số thứ 10 `practice: { reminder?: PracticeReminderSource | null; ledger?: PracticeLedgerSource[] } = {}`; hàm thuần `practiceReminderAt(weekKey: string): Date` (thứ Sáu 12:00 VN).

- [ ] **Step 1: Test hỏng** (thêm vào `tests/notifications.test.ts`, theo kiểu gọi sẵn có — truyền `[]`/`{}` cho tham số 4–9):

```ts
  it("chuông chỉ tiêu tự luyện", () => {
    const items = buildStudentNotifications([], [], null, [], {}, [], [], [], {}, {
      reminder: { weekKey: "2026-10-12", remaining: 1, createdAt: new Date("2026-10-16T05:00:00Z") },
      ledger: [
        { key: "practice-goal:2026-10-05", kind: "practice_goal", amount: 30, createdAt: new Date("2026-10-10T05:00:00Z") },
        { key: "practice-miss:2026-09-28", kind: "practice_miss", amount: -12, createdAt: new Date("2026-10-06T05:00:00Z") }
      ]
    });
    expect(items.map((item) => item.type)).toEqual(["practice_reminder", "practice_goal_met", "practice_missed"]);
    expect(items[0].title).toBe("Còn 1 phần tự luyện để đạt chỉ tiêu tuần — hạn Chủ nhật");
    expect(items[1].title).toBe("Em đạt chỉ tiêu tự luyện tuần 5/10–11/10, +30 Xu");
    expect(items[2].title).toBe("Tuần 28/9–4/10 em chưa đạt chỉ tiêu tự luyện, −12 Xu");
    expect(items.every((item) => item.href === "/student/practice")).toBe(true);
  });

  it("practiceReminderAt = thứ Sáu 12:00 VN", () => {
    expect(practiceReminderAt("2026-10-12").toISOString()).toBe("2026-10-16T05:00:00.000Z");
  });
```

Run: `npx vitest run tests/notifications.test.ts` → FAIL.

- [ ] **Step 2: `lib/notifications.ts`** — thêm 3 type vào union, 2 source type, `practiceReminderAt`, tham số thứ 10 và các mục:

```ts
// Chuông nhắc chỉ tiêu tự luyện hiện từ thứ Sáu 12:00 VN của tuần chưa đạt.
export function practiceReminderAt(weekKey: string): Date {
  return new Date(Date.parse(`${weekKey}T12:00:00+07:00`) + 4 * 24 * 60 * 60 * 1000);
}
```

(`lib/notifications.ts` không được import prisma — `practice-goal.ts` thuần nên import `weekLabel` được.)

```ts
    ...(practice.reminder
      ? [
          {
            id: `practice_reminder:${practice.reminder.weekKey}`,
            type: "practice_reminder" as const,
            title: `Còn ${practice.reminder.remaining} phần tự luyện để đạt chỉ tiêu tuần — hạn Chủ nhật`,
            detail: null,
            href: "/student/practice",
            createdAt: practice.reminder.createdAt,
            unread: isUnread(practice.reminder.createdAt, readAt)
          }
        ]
      : []),
    ...(practice.ledger ?? []).map((item) => {
      const week = weekLabel(item.key.slice(item.key.indexOf(":") + 1));
      return {
        id: item.key,
        type: item.kind === "practice_goal" ? ("practice_goal_met" as const) : ("practice_missed" as const),
        title:
          item.kind === "practice_goal"
            ? `Em đạt chỉ tiêu tự luyện tuần ${week}, +${item.amount} Xu`
            : `Tuần ${week} em chưa đạt chỉ tiêu tự luyện, −${Math.abs(item.amount)} Xu`,
        detail: null,
        href: "/student/practice",
        createdAt: item.createdAt,
        unread: isUnread(item.createdAt, readAt)
      };
    }),
```

- [ ] **Step 3: `lib/notifications-feed.ts`** — trong `getStudentNotifications`, bọc try/catch như các nguồn khác:

```ts
  let practiceSources: { reminder?: PracticeReminderSource | null; ledger?: PracticeLedgerSource[] } = {};
  try {
    const [status, ledger] = await Promise.all([
      getPracticeGoalStatus(studentId),
      prisma.coinTransaction.findMany({
        where: { studentId, kind: { in: ["practice_goal", "practice_miss"] } },
        orderBy: { createdAt: "desc" },
        take: NOTIFICATION_LIMIT,
        select: { key: true, kind: true, amount: true, createdAt: true }
      })
    ]);
    const week = status.current;
    const reminderAt = week ? practiceReminderAt(week.weekKey) : null;
    practiceSources = {
      reminder:
        week && status.goal > 0 && !week.met && reminderAt && reminderAt <= new Date()
          ? { weekKey: week.weekKey, remaining: status.goal - week.done, createdAt: reminderAt }
          : null,
      ledger: ledger.map((row) => ({ ...row, kind: row.kind as "practice_goal" | "practice_miss" }))
    };
  } catch (error) {
    console.error("[thong-bao] Không đọc được chỉ tiêu tự luyện:", error);
  }
```

và truyền `practiceSources` làm tham số thứ 10.

- [ ] **Step 4: `components/notification-list.tsx`** — thêm nhãn cho 3 type vào map (cạnh `monthly_prize: "Thưởng Học Bá"`): `practice_reminder: "Nhắc tự luyện"`, `practice_goal_met: "Chỉ tiêu tự luyện"`, `practice_missed: "Chỉ tiêu tự luyện"`. Nếu có map icon/màu theo type, thêm tương ứng (tsc sẽ báo nếu `Record<StudentNotificationType, …>` thiếu).

- [ ] **Step 5: Test + commit**

Run: `pnpm test`, `npx tsc --noEmit -p .` → PASS.

```bash
git add lib/notifications.ts lib/notifications-feed.ts components/notification-list.tsx tests/notifications.test.ts
git commit -m "feat(tu-luyen): chuong nhac chi tieu + bao thuong/tru Xu"
```

---

### Task 8: Bảng xếp hạng lớp — huy hiệu 🎯 + dòng Tự luyện

**Files:**
- Modify: `components/class-ranking-board.tsx`

**Interfaces:**
- Consumes: `RankedClassStudent.practiceGoal`, `practiceMetThisWeek`, `practiceWeeksMet`, `practiceWeeksConsidered` (Task 2).

- [ ] **Step 1: Huy hiệu cạnh tên** — ở mọi chỗ hiện `displayName` (bục 3 hạng đầu + danh sách):

```tsx
{rankedStudent.practiceMetThisWeek ? (
  <span title="Đã đạt chỉ tiêu tự luyện tuần này" aria-label="Đạt chỉ tiêu tự luyện tuần này"> 🎯</span>
) : null}
```

- [ ] **Step 2: Dòng giải thích** — ngay sau "Hoàn thành {…}%" (dòng ~191 và các chỗ tương tự ~265, ~289):

```tsx
{rankedStudent.practiceGoal > 0 && rankedStudent.practiceWeeksConsidered > 0 ? (
  <>
    <br />
    Tự luyện {rankedStudent.practiceWeeksMet}/{rankedStudent.practiceWeeksConsidered} tuần
  </>
) : null}
```

(chỗ dạng bảng: thêm cùng nội dung vào cột/tooltip chi tiết điểm, không thêm cột mới để bảng không chật hơn.) Nếu bảng có chú thích công thức điểm (grep "Điểm TB" / "Hoàn thành" trong file + `app/student/ranking/page.tsx` + `app/teacher/ranking/page.tsx`), sửa thành "Điểm TB 60% · Hoàn thành 20% · Tự luyện 10% · Hoạt động 10%".

- [ ] **Step 3: Kiểm tay + commit**

`/student/ranking` và `/teacher/ranking`: em đạt có 🎯; khổ 375px không vỡ bục.

```bash
git add components/class-ranking-board.tsx app/student/ranking/page.tsx app/teacher/ranking/page.tsx
git commit -m "feat(xep-hang): huy hieu dat chi tieu tu luyen + dong Tu luyen a/b tuan"
```

---

### Task 9: Báo cáo phụ huynh

**Files:**
- Modify: `app/ph/[token]/page.tsx`
- Modify: `lib/parent-report-query.ts` (nếu `ParentStudent` cần `practiceWeeklyGoal` — không; dùng `getPracticeGoalStatus(student.id)`)

**Interfaces:**
- Consumes: `getPracticeGoalStatus` (Task 4), `PracticeGoalWeeks` (Task 5).

- [ ] **Step 1:** Trong page, thêm `getPracticeGoalStatus(student.id).catch(() => null)` vào chỗ nạp dữ liệu song song. Đặt khối sau lưới số liệu tổng (`<section className="grid grid-cols-2 gap-3">`, dòng ~137):

```tsx
{practiceGoal && practiceGoal.goal > 0 && practiceGoal.current ? (
  <section className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
    <div className="border-b border-border px-5 py-4">
      <h2 className="text-base font-semibold">Tự luyện ở nhà</h2>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
      <div>
        <p className="font-semibold">
          Tuần này: {practiceGoal.current.done}/{practiceGoal.goal} phần{" "}
          <span className={practiceGoal.current.met ? "text-emerald-600" : "text-rose-600"}>
            ({practiceGoal.current.met ? "đã đạt" : "chưa đạt"})
          </span>
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Thầy giao {practiceGoal.goal} phần/tuần, mỗi phần khoảng 15–20 phút.
        </p>
      </div>
      <PracticeGoalWeeks weeks={practiceGoal.weeks} />
    </div>
  </section>
) : null}
```

Không nhắc Xu (spec).

- [ ] **Step 2: Kiểm tay + commit** — mở `/ph/<token>` của HS seed local (lấy token từ trang học viên GV), kiểm khổ 375px.

```bash
git add "app/ph/[token]/page.tsx"
git commit -m "feat(phu-huynh): khoi Tu luyen o nha trong bao cao"
```

---

### Task 10: Banner tính năng mới + kiểm toàn bộ + push + kiểm prod

**Files:**
- Modify: `lib/feature-announcements.ts`
- Test: `tests/feature-announcements.test.ts` (đã có, tự kiểm slide)

- [ ] **Step 1:** Thêm lên đầu nhóm Học viên và nhóm Thầy (`shippedAt` = ngày push thật, giờ VN; dùng mascot/pose/theme có trong `lib/mascots.ts` — chạy test để chắc hợp lệ):

```ts
  {
    id: "student-practice-goal",
    audience: "student",
    title: ["Chỉ tiêu tự luyện", "Đạt tuần +30 Xu"],
    description:
      "Mỗi tuần làm đủ số phần tự luyện thầy giao để nhận +30 Xu — không đạt sẽ bị trừ Xu và tụt điểm lớp.",
    cta: "Luyện ngay",
    href: "/student/practice",
    mascot: "fox",
    pose: "cheer",
    theme: "forest",
    shippedAt: "2026-10-12"
  },
```

```ts
  {
    id: "teacher-practice-goal",
    audience: "teacher",
    title: ["Chỉ tiêu tự luyện", "Đặt riêng từng em"],
    description:
      "Đặt số phần tự luyện mỗi tuần cho từng học viên hoặc cả lớp; em không đạt bị trừ Xu và tụt điểm xếp hạng.",
    cta: "Đặt chỉ tiêu",
    href: "/teacher/practice",
    mascot: "owl",
    pose: "read",
    theme: "forest",
    shippedAt: "2026-10-12"
  },
```

- [ ] **Step 2: Kiểm toàn bộ**

Run: `pnpm test` → PASS. `pnpm lint` → sạch. `pnpm build` → thành công (build chạy `ensure-db` lên DB `.env` local).

- [ ] **Step 3: Commit + push** (memory git-push-workflow: Claude push `feature/ielts-platform-mvp`, Vercel tự deploy)

```bash
git add lib/feature-announcements.ts
git commit -m "feat(banner): slide chi tieu tu luyen cho hoc vien va thay"
git push origin feature/ielts-platform-mvp
```

- [ ] **Step 4: Kiểm prod** (Chrome đã đăng nhập vai HS Minh — memory verify-prod-in-chrome): sau deploy xong, `/student` có thẻ 🎯 0/1; `/student/ranking` không lỗi; kiểm runtime logs Vercel không có lỗi `practiceWeeklyGoal`. Xác nhận cột đã có trên prod Neon (`IELTS_Platform`): `SELECT "practiceWeeklyGoal" FROM "StudentProfile" LIMIT 1`. Nhắc thầy: trước 19/10 không ai bị trừ; muốn miễn em nào (VD tài khoản Test) thì đặt 0 ở `/teacher/practice`.

- [ ] **Step 5: Cập nhật memory** — file mới `practice-goal-shipped.md` (luật, mốc 12/10, key sổ, chỗ sửa) + dòng trong `MEMORY.md`; cập nhật `teacher-practice-tracking.md` (cột Chỉ tiêu/Tuần này) và `gamification-status`/`xp-rank-system` nếu nhắc công thức 70/20/10.
