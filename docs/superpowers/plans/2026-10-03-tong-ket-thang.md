# Tổng kết tháng — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Popup "Tổng kết tháng" kiểu chin.edu.vn cho học viên (XP tháng, hạng toàn trường, ngày học, Top 10 XP + Top 10 chuyên cần) và chế độ "Tổng kết tháng" ở trang Xếp hạng của giáo viên.

**Architecture:** Không đổi schema. `lib/monthly-xp.ts` (hệ số + hàm XP thuần) → `lib/monthly-recap.ts` (khoá tháng giờ VN, gộp dữ liệu thô thành `MonthlyRecap` JSON-thuần, cắt phần một học viên) → `lib/monthly-recap-data.ts` (Prisma + `unstable_cache` cho tháng đã qua). UI: `MonthlyRecapBoard` (bục + danh sách), `MonthlyRecapPanel` (toàn bộ nội dung, server component), `MonthlyRecapDialog` (client, portal, localStorage). Gắn vào `/student` (tự bật), `/student/recap` (xem lại), `/student/stats` (nút), `/teacher/ranking?view=month`.

**Tech Stack:** Next.js 14 App Router, React 18, Prisma/Postgres, Tailwind, vitest.

Spec: `docs/superpowers/specs/2026-10-03-tong-ket-thang-design.md`.

## Global Constraints

- Chữ hiển thị + comment code bằng **tiếng Việt có dấu**.
- Không thêm bảng/cột Prisma, không thêm dependency.
- Trình duyệt hỗ trợ: iOS/Safari ≥ 15.6 — không dùng API mới hơn.
- Overlay `fixed` phải **portal ra `document.body`** (AppShell có `transform`).
- Ô trống dùng `bg-border/60 dark:bg-border/40` (không dùng `bg-muted` — trùng nền thẻ ở chế độ sáng).
- Trang dưới `app/teacher/` gọi `requireTeacherPage()`.
- Ngày/tháng tính theo giờ VN (UTC+7 cố định) qua `vietnamDateKey` của `lib/vocab-day.ts`.
- Kết quả `MonthlyRecap` không được chứa `Date`/`Map` (đi qua `unstable_cache` = JSON).

---

### Task 1: Công thức XP — `lib/monthly-xp.ts`

**Files:**
- Create: `lib/monthly-xp.ts`
- Test: `tests/monthly-xp.test.ts`

**Interfaces:**
- Produces: `unitXp(input: UnitXpInput): number`, `vocabDayXp(cards: number): number`, type `UnitXpInput = { gradedCount: number; correctCount: number; manualAnswered: boolean; attemptRound: number }`, hằng số `XP_UNIT_BASE`, `XP_UNIT_ACCURACY_MAX`, `XP_MANUAL_UNIT`, `XP_VOCAB_CARDS_PER_POINT`, `XP_VOCAB_DAILY_CAP`, `XP_RETRY_FACTOR`.

- [ ] **Step 1: Viết test**

```ts
import { describe, expect, it } from "vitest";
import { unitXp, vocabDayXp } from "../lib/monthly-xp";

const base = { gradedCount: 0, correctCount: 0, manualAnswered: false, attemptRound: 1 };

describe("unitXp", () => {
  it("phần tự chấm: 10 XP nền + tối đa 10 XP theo % đúng", () => {
    expect(unitXp({ ...base, gradedCount: 10, correctCount: 0 })).toBe(10);
    expect(unitXp({ ...base, gradedCount: 10, correctCount: 7 })).toBe(17);
    expect(unitXp({ ...base, gradedCount: 13, correctCount: 13 })).toBe(20);
  });

  it("bài chép chính tả 200 ô không được nhiều XP hơn passage 13 câu", () => {
    expect(unitXp({ ...base, gradedCount: 200, correctCount: 200 })).toBe(
      unitXp({ ...base, gradedCount: 13, correctCount: 13 })
    );
  });

  it("phần chấm tay có bài làm: 20 XP, không cần đợi chấm", () => {
    expect(unitXp({ ...base, manualAnswered: true })).toBe(20);
  });

  it("phần vừa tự chấm vừa chấm tay được cả hai khoản", () => {
    expect(unitXp({ ...base, gradedCount: 4, correctCount: 2, manualAnswered: true })).toBe(35);
  });

  it("không có câu chấm được và không có bài chấm tay → 0", () => {
    expect(unitXp(base)).toBe(0);
  });

  it("lượt tự luyện thứ 2 trở đi được nửa XP, làm tròn xuống", () => {
    expect(unitXp({ ...base, gradedCount: 10, correctCount: 7, attemptRound: 2 })).toBe(8);
    expect(unitXp({ ...base, manualAnswered: true, attemptRound: 3 })).toBe(10);
  });
});

describe("vocabDayXp", () => {
  it("1 XP mỗi 2 thẻ, tối đa 15 XP/ngày", () => {
    expect(vocabDayXp(0)).toBe(0);
    expect(vocabDayXp(1)).toBe(0);
    expect(vocabDayXp(7)).toBe(3);
    expect(vocabDayXp(30)).toBe(15);
    expect(vocabDayXp(200)).toBe(15);
  });
});
```

- [ ] **Step 2: Chạy test, thấy FAIL** — `npx vitest run tests/monthly-xp.test.ts` → lỗi không tìm thấy module.

- [ ] **Step 3: Viết `lib/monthly-xp.ts`**

```ts
// Công thức XP của Tổng kết tháng (kiểu "Bá khí" của chin.edu.vn). Mọi hệ số
// nằm ở đây — muốn chỉnh XP thì chỉ sửa file này.
//
// Tính theo PHẦN (AssignableUnit) chứ không theo câu: bài chép chính tả LPTD có
// 80–200 ô/unit, tính theo câu sẽ cho XP gấp nhiều lần một passage 13 câu dù
// thời gian làm tương đương.

// Phần tự chấm: XP nền khi nộp + tối đa chừng này XP theo % đúng.
export const XP_UNIT_BASE = 10;
export const XP_UNIT_ACCURACY_MAX = 10;
// Phần chấm tay (Writing task / Speaking) có bài làm — cộng ngay khi nộp.
export const XP_MANUAL_UNIT = 20;
// Ôn Sổ từ: 1 XP cho mỗi chừng này thẻ, trần mỗi ngày.
export const XP_VOCAB_CARDS_PER_POINT = 2;
export const XP_VOCAB_DAILY_CAP = 15;
// Lượt tự luyện thứ 2 trở đi (đã biết đáp án) chỉ được một phần XP.
export const XP_RETRY_FACTOR = 0.5;

export type UnitXpInput = {
  gradedCount: number; // số câu tự chấm đã có kết quả đúng/sai
  correctCount: number;
  manualAnswered: boolean; // có ít nhất một câu chấm tay không để trống
  attemptRound: number;
};

export function unitXp(input: UnitXpInput): number {
  let xp = 0;

  if (input.gradedCount > 0) {
    xp += XP_UNIT_BASE + Math.round((XP_UNIT_ACCURACY_MAX * input.correctCount) / input.gradedCount);
  }

  if (input.manualAnswered) {
    xp += XP_MANUAL_UNIT;
  }

  return input.attemptRound >= 2 ? Math.floor(xp * XP_RETRY_FACTOR) : xp;
}

export function vocabDayXp(cards: number): number {
  return Math.min(XP_VOCAB_DAILY_CAP, Math.floor(Math.max(0, cards) / XP_VOCAB_CARDS_PER_POINT));
}
```

- [ ] **Step 4: Chạy test, thấy PASS** — `npx vitest run tests/monthly-xp.test.ts`.

- [ ] **Step 5: Commit** — `git add lib/monthly-xp.ts tests/monthly-xp.test.ts && git commit -m "feat(tong-ket-thang): cong thuc XP"`.

---

### Task 2: Logic tổng kết — `lib/monthly-recap.ts`

**Files:**
- Create: `lib/monthly-recap.ts`
- Test: `tests/monthly-recap.test.ts`

**Interfaces:**
- Consumes: `unitXp`, `vocabDayXp` (Task 1); `vietnamDateKey(now: Date): string` (`lib/vocab-day.ts`).
- Produces:
  - `monthKeyOf(date: Date): string` ("YYYY-MM" giờ VN), `isMonthKey(v: unknown): v is string`, `shiftMonthKey(key, delta): string`, `monthRange(key): { start: Date; end: Date }`, `daysInMonth(key): number`, `monthName(key): string` ("Chín"), `monthNumberLabel(key): string` ("09/2026"), `recentMonthKeys(latest, count): string[]`, `resolveMonthKey(param, latest, count): string`, `recapMonthToShow(now): string | null`, `RECAP_POPUP_DAYS = 7`.
  - Types `RecapUnitRow`, `RecapSubmitRow`, `RecapVocabRow`, `RecapStudentInfo`, `RecapEntry`, `MonthlyRecap`, `StudentRecapView`.
  - `buildMonthlyRecap(input): MonthlyRecap`, `studentRecapView(recap, studentId, previous): StudentRecapView`, `buildXpBars(values, highlightIndex, maxBars?): { heights: number[]; highlight: number | null }`.

- [ ] **Step 1: Viết test**

```ts
import { describe, expect, it } from "vitest";
import {
  buildMonthlyRecap,
  buildXpBars,
  daysInMonth,
  monthKeyOf,
  monthName,
  monthNumberLabel,
  monthRange,
  recapMonthToShow,
  recentMonthKeys,
  resolveMonthKey,
  shiftMonthKey,
  studentRecapView,
  type RecapStudentInfo,
  type RecapUnitRow
} from "../lib/monthly-recap";

function student(id: string, displayName = id): RecapStudentInfo {
  return { id, displayName, avatarUrl: null, avatarPreset: null, userImage: null };
}

function unit(studentId: string, iso: string, extra: Partial<RecapUnitRow> = {}): RecapUnitRow {
  return {
    studentId,
    skill: "reading",
    submittedAt: new Date(iso),
    attemptRound: 1,
    gradedCount: 10,
    correctCount: 10,
    manualAnswered: false,
    ...extra
  };
}

describe("khoá tháng giờ VN", () => {
  it("23:30 ngày 30/9 VN thuộc tháng 9, 00:10 ngày 1/10 VN thuộc tháng 10", () => {
    expect(monthKeyOf(new Date("2026-09-30T16:30:00Z"))).toBe("2026-09");
    expect(monthKeyOf(new Date("2026-09-30T17:10:00Z"))).toBe("2026-10");
  });

  it("ranh giới tháng là nửa đêm giờ VN", () => {
    const { start, end } = monthRange("2026-09");
    expect(start.toISOString()).toBe("2026-08-31T17:00:00.000Z");
    expect(end.toISOString()).toBe("2026-09-30T17:00:00.000Z");
    expect(monthRange("2026-12").end.toISOString()).toBe("2026-12-31T17:00:00.000Z");
  });

  it("dịch tháng qua năm, số ngày, tên tháng", () => {
    expect(shiftMonthKey("2026-01", -1)).toBe("2025-12");
    expect(shiftMonthKey("2026-12", 1)).toBe("2027-01");
    expect(daysInMonth("2026-09")).toBe(30);
    expect(daysInMonth("2028-02")).toBe(29);
    expect(monthName("2026-09")).toBe("Chín");
    expect(monthName("2026-11")).toBe("Mười Một");
    expect(monthNumberLabel("2026-09")).toBe("09/2026");
  });

  it("chọn tháng: chỉ nhận tháng trong danh sách, còn lại rơi về tháng mới nhất", () => {
    expect(recentMonthKeys("2026-09", 3)).toEqual(["2026-09", "2026-08", "2026-07"]);
    expect(resolveMonthKey("2026-08", "2026-09", 6)).toBe("2026-08");
    expect(resolveMonthKey("2026-10", "2026-09", 6)).toBe("2026-09");
    expect(resolveMonthKey("abc", "2026-09", 6)).toBe("2026-09");
    expect(resolveMonthKey(undefined, "2026-09", 6)).toBe("2026-09");
  });

  it("popup chỉ bật trong 7 ngày đầu tháng, cho tháng trước", () => {
    expect(recapMonthToShow(new Date("2026-10-03T05:00:00Z"))).toBe("2026-09");
    expect(recapMonthToShow(new Date("2026-10-07T16:00:00Z"))).toBe("2026-09"); // 23:00 ngày 7 VN
    expect(recapMonthToShow(new Date("2026-10-07T17:30:00Z"))).toBeNull(); // 00:30 ngày 8 VN
  });
});

describe("buildMonthlyRecap", () => {
  it("cộng XP theo phần + ôn từ, đếm ngày học và số phần theo kỹ năng", () => {
    const recap = buildMonthlyRecap({
      monthKey: "2026-09",
      units: [
        unit("a", "2026-09-02T03:00:00Z"), // 20 XP
        unit("a", "2026-09-02T04:00:00Z", { skill: "writing", gradedCount: 0, correctCount: 0, manualAnswered: true }) // 20 XP
      ],
      submits: [
        { studentId: "a", submittedAt: new Date("2026-09-02T03:00:00Z") },
        { studentId: "a", submittedAt: new Date("2026-09-05T03:00:00Z") }
      ],
      vocab: [{ studentId: "a", date: "2026-09-10", total: 10 }], // 5 XP
      students: [student("a")]
    });

    const entry = recap.entries[0];
    expect(entry.xp).toBe(45);
    expect(entry.activeDayKeys).toEqual(["2026-09-02", "2026-09-05", "2026-09-10"]);
    expect(entry.activeDays).toBe(3);
    expect(entry.unitsBySkill).toEqual({ reading: 1, writing: 1 });
    expect(entry.vocabCards).toBe(10);
    expect(recap.totalXp).toBe(45);
    expect(recap.participantCount).toBe(1);
    expect(recap.daysInMonth).toBe(30);
  });

  it("bỏ dữ liệu ngoài tháng (theo giờ VN)", () => {
    const recap = buildMonthlyRecap({
      monthKey: "2026-09",
      units: [unit("a", "2026-09-30T17:10:00Z")], // 00:10 ngày 1/10 VN
      submits: [{ studentId: "a", submittedAt: new Date("2026-09-30T17:10:00Z") }],
      vocab: [{ studentId: "a", date: "2026-10-01", total: 30 }],
      students: [student("a")]
    });

    expect(recap.entries).toEqual([]);
    expect(recap.totalXp).toBe(0);
  });

  it("đồng điểm thì đồng hạng (1, 2, 2, 4); chỉ học viên có XP vào bảng XP", () => {
    const recap = buildMonthlyRecap({
      monthKey: "2026-09",
      units: [
        unit("a", "2026-09-02T03:00:00Z"),
        unit("a", "2026-09-03T03:00:00Z"),
        unit("b", "2026-09-02T03:00:00Z"),
        unit("c", "2026-09-02T03:00:00Z"),
        unit("d", "2026-09-02T03:00:00Z", { correctCount: 0 })
      ],
      submits: [],
      vocab: [{ studentId: "e", date: "2026-09-04", total: 1 }], // có ngày học, 0 XP
      students: ["a", "b", "c", "d", "e"].map((id) => student(id))
    });

    expect(recap.xpBoard.map((e) => [e.studentId, e.xpRank])).toEqual([
      ["a", 1],
      ["b", 2],
      ["c", 2],
      ["d", 4]
    ]);
    expect(recap.participantCount).toBe(4);
    expect(recap.daysBoard.map((e) => e.studentId)).toContain("e");
    expect(recap.entries.find((e) => e.studentId === "e")?.xpRank).toBeNull();
  });

  it("bảng ngày học: nhiều ngày đứng trước, đồng ngày thì XP cao đứng trước nhưng vẫn đồng hạng", () => {
    const recap = buildMonthlyRecap({
      monthKey: "2026-09",
      units: [unit("b", "2026-09-02T03:00:00Z")],
      submits: [
        { studentId: "a", submittedAt: new Date("2026-09-02T03:00:00Z") },
        { studentId: "b", submittedAt: new Date("2026-09-02T03:00:00Z") },
        { studentId: "c", submittedAt: new Date("2026-09-02T03:00:00Z") },
        { studentId: "c", submittedAt: new Date("2026-09-03T03:00:00Z") }
      ],
      vocab: [],
      students: ["a", "b", "c"].map((id) => student(id))
    });

    expect(recap.daysBoard.map((e) => [e.studentId, e.daysRank])).toEqual([
      ["c", 1],
      ["b", 2],
      ["a", 2]
    ]);
  });

  it("bỏ học viên không còn hồ sơ", () => {
    const recap = buildMonthlyRecap({
      monthKey: "2026-09",
      units: [unit("ghost", "2026-09-02T03:00:00Z")],
      submits: [],
      vocab: [],
      students: []
    });

    expect(recap.entries).toEqual([]);
  });

  it("kết quả là JSON thuần (đi qua unstable_cache)", () => {
    const recap = buildMonthlyRecap({
      monthKey: "2026-09",
      units: [unit("a", "2026-09-02T03:00:00Z")],
      submits: [],
      vocab: [],
      students: [student("a")]
    });

    expect(JSON.parse(JSON.stringify(recap))).toEqual(recap);
  });
});

describe("studentRecapView", () => {
  const recapOf = (xpByStudent: Record<string, number>, monthKey = "2026-09") =>
    buildMonthlyRecap({
      monthKey,
      units: Object.entries(xpByStudent).flatMap(([id, count]) =>
        Array.from({ length: count }, () => unit(id, `${monthKey}-02T03:00:00Z`))
      ),
      submits: [],
      vocab: [],
      students: Object.keys(xpByStudent).map((id) => student(id))
    });

  it("% so tháng trước và Top P%", () => {
    const current = recapOf({ a: 3, b: 2, c: 1, d: 1 });
    const previous = recapOf({ a: 1 }, "2026-08");
    const view = studentRecapView(current, "b", previous);

    expect(view.entry?.xp).toBe(40);
    expect(view.previousXp).toBeNull();
    expect(view.topPercent).toBe(50); // hạng 2/4

    const viewA = studentRecapView(current, "a", previous);
    expect(viewA.previousXp).toBe(20);
    expect(viewA.changePercent).toBe(200);
    expect(viewA.topPercent).toBe(25);
  });

  it("học viên không có dữ liệu tháng → entry null", () => {
    const view = studentRecapView(recapOf({ a: 1 }), "zzz", null);
    expect(view.entry).toBeNull();
    expect(view.topPercent).toBeNull();
    expect(view.changePercent).toBeNull();
  });
});

describe("buildXpBars", () => {
  it("ít người: mỗi người một cột, cột cao nhất = 1", () => {
    const bars = buildXpBars([100, 50, 25], 1);
    expect(bars.heights).toEqual([1, 0.5, 0.25]);
    expect(bars.highlight).toBe(1);
  });

  it("đông người: gộp còn tối đa maxBars cột, vạch rơi đúng nhóm", () => {
    const values = Array.from({ length: 100 }, (_, i) => 100 - i);
    const bars = buildXpBars(values, 99, 10);
    expect(bars.heights).toHaveLength(10);
    expect(bars.highlight).toBe(9);
  });

  it("không có ai → rỗng", () => {
    expect(buildXpBars([], null)).toEqual({ heights: [], highlight: null });
  });
});
```

- [ ] **Step 2: Chạy test, thấy FAIL** — `npx vitest run tests/monthly-recap.test.ts`.

- [ ] **Step 3: Viết `lib/monthly-recap.ts`**

```ts
import { vietnamDateKey } from "@/lib/vocab-day";
import { unitXp, vocabDayXp } from "@/lib/monthly-xp";

// Tổng kết tháng (ý tưởng từ popup "Tổng kết tháng" của chin.edu.vn). Logic
// thuần — phần đọc DB ở lib/monthly-recap-data.ts. Khoá tháng "YYYY-MM" theo
// giờ VN. Kết quả MonthlyRecap chỉ gồm chuỗi/số vì đi qua unstable_cache (JSON).

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
export const RECAP_POPUP_DAYS = 7;

const MONTH_NAMES = [
  "Một", "Hai", "Ba", "Tư", "Năm", "Sáu",
  "Bảy", "Tám", "Chín", "Mười", "Mười Một", "Mười Hai"
];

const MONTH_KEY_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

function splitKey(key: string): { year: number; month: number } {
  const [year, month] = key.split("-").map(Number);
  return { year, month };
}

function joinKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function isMonthKey(value: unknown): value is string {
  return typeof value === "string" && MONTH_KEY_PATTERN.test(value);
}

export function monthKeyOf(date: Date): string {
  return vietnamDateKey(date).slice(0, 7);
}

export function shiftMonthKey(key: string, delta: number): string {
  const { year, month } = splitKey(key);
  const index = year * 12 + (month - 1) + delta;
  return joinKey(Math.floor(index / 12), (index % 12) + 1);
}

// [start, end) là hai thời điểm UTC ứng với nửa đêm giờ VN đầu tháng và đầu tháng sau.
export function monthRange(key: string): { start: Date; end: Date } {
  const { year, month } = splitKey(key);
  return {
    start: new Date(Date.UTC(year, month - 1, 1) - VN_OFFSET_MS),
    end: new Date(Date.UTC(year, month, 1) - VN_OFFSET_MS)
  };
}

export function daysInMonth(key: string): number {
  const { year, month } = splitKey(key);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function monthName(key: string): string {
  return MONTH_NAMES[splitKey(key).month - 1];
}

export function monthNumberLabel(key: string): string {
  const { year, month } = splitKey(key);
  return `${String(month).padStart(2, "0")}/${year}`;
}

// Danh sách tháng cho ô chọn: tháng mới nhất trước.
export function recentMonthKeys(latest: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => shiftMonthKey(latest, -index));
}

// Tháng lạ / sai định dạng / ngoài danh sách → rơi về tháng mới nhất.
export function resolveMonthKey(param: unknown, latest: string, count: number): string {
  return isMonthKey(param) && recentMonthKeys(latest, count).includes(param) ? param : latest;
}

// Tháng cần tự bật popup lúc này (tháng trước), hoặc null nếu đã qua 7 ngày đầu tháng.
export function recapMonthToShow(now: Date): string | null {
  const day = Number(vietnamDateKey(now).slice(8, 10));
  return day <= RECAP_POPUP_DAYS ? shiftMonthKey(monthKeyOf(now), -1) : null;
}

// Một phần (AssignableUnit) trong một lượt làm, kỹ năng của phần đã nộp.
export type RecapUnitRow = {
  studentId: string;
  skill: string;
  submittedAt: Date;
  attemptRound: number;
  gradedCount: number;
  correctCount: number;
  manualAnswered: boolean;
};

// Một lần nộp kỹ năng (hoặc cả bài với Attempt cũ) — chỉ để đếm ngày học.
export type RecapSubmitRow = { studentId: string; submittedAt: Date };

export type RecapVocabRow = { studentId: string; date: string; total: number };

export type RecapStudentInfo = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  avatarPreset: string | null;
  userImage: string | null;
};

export type RecapEntry = {
  studentId: string;
  displayName: string;
  avatarUrl: string | null;
  avatarPreset: string | null;
  userImage: string | null;
  xp: number;
  activeDays: number;
  activeDayKeys: string[]; // "YYYY-MM-DD", tăng dần
  unitsBySkill: Record<string, number>;
  vocabCards: number;
  xpRank: number | null; // null = 0 XP, không vào bảng XP
  daysRank: number | null;
};

export type MonthlyRecap = {
  monthKey: string;
  daysInMonth: number;
  totalXp: number;
  participantCount: number; // số học viên có XP > 0
  entries: RecapEntry[];
  xpBoard: RecapEntry[];
  daysBoard: RecapEntry[];
};

export type StudentRecapView = {
  entry: RecapEntry | null;
  previousXp: number | null; // null = tháng trước không có XP
  changePercent: number | null;
  topPercent: number | null; // "Top P% toàn trường"
};

function compareNames(a: RecapEntry, b: RecapEntry): number {
  return a.displayName.localeCompare(b.displayName, "vi");
}

// Xếp hạng kiểu thi đấu: đồng giá trị → đồng hạng, hạng sau nhảy cóc (1, 2, 2, 4).
function assignRanks(
  list: RecapEntry[],
  value: (entry: RecapEntry) => number,
  set: (entry: RecapEntry, rank: number) => void
) {
  let previousValue: number | null = null;
  let previousRank = 0;

  list.forEach((entry, index) => {
    const current = value(entry);
    const rank = index > 0 && current === previousValue ? previousRank : index + 1;
    set(entry, rank);
    previousValue = current;
    previousRank = rank;
  });
}

export function buildMonthlyRecap(input: {
  monthKey: string;
  units: RecapUnitRow[];
  submits: RecapSubmitRow[];
  vocab: RecapVocabRow[];
  students: RecapStudentInfo[];
}): MonthlyRecap {
  const prefix = `${input.monthKey}-`;
  const totals = new Map<
    string,
    { xp: number; days: Set<string>; unitsBySkill: Record<string, number>; vocabCards: number }
  >();

  function totalsOf(studentId: string) {
    let row = totals.get(studentId);
    if (!row) {
      row = { xp: 0, days: new Set(), unitsBySkill: {}, vocabCards: 0 };
      totals.set(studentId, row);
    }
    return row;
  }

  for (const unit of input.units) {
    const key = vietnamDateKey(unit.submittedAt);
    if (!key.startsWith(prefix)) {
      continue;
    }
    const row = totalsOf(unit.studentId);
    row.xp += unitXp(unit);
    row.unitsBySkill[unit.skill] = (row.unitsBySkill[unit.skill] ?? 0) + 1;
    row.days.add(key);
  }

  for (const submit of input.submits) {
    const key = vietnamDateKey(submit.submittedAt);
    if (key.startsWith(prefix)) {
      totalsOf(submit.studentId).days.add(key);
    }
  }

  for (const vocab of input.vocab) {
    if (!vocab.date.startsWith(prefix) || vocab.total < 1) {
      continue;
    }
    const row = totalsOf(vocab.studentId);
    row.xp += vocabDayXp(vocab.total);
    row.vocabCards += vocab.total;
    row.days.add(vocab.date);
  }

  const infoById = new Map(input.students.map((student) => [student.id, student]));
  const entries: RecapEntry[] = [];

  totals.forEach((row, studentId) => {
    const info = infoById.get(studentId);
    // Học viên đã bị xoá hồ sơ → bỏ qua.
    if (!info) {
      return;
    }
    const activeDayKeys = Array.from(row.days).sort();
    entries.push({
      studentId,
      displayName: info.displayName,
      avatarUrl: info.avatarUrl,
      avatarPreset: info.avatarPreset,
      userImage: info.userImage,
      xp: row.xp,
      activeDays: activeDayKeys.length,
      activeDayKeys,
      unitsBySkill: row.unitsBySkill,
      vocabCards: row.vocabCards,
      xpRank: null,
      daysRank: null
    });
  });

  const xpBoard = entries
    .filter((entry) => entry.xp > 0)
    .sort((a, b) => b.xp - a.xp || compareNames(a, b));
  assignRanks(xpBoard, (entry) => entry.xp, (entry, rank) => {
    entry.xpRank = rank;
  });

  const daysBoard = entries
    .filter((entry) => entry.activeDays > 0)
    .sort((a, b) => b.activeDays - a.activeDays || b.xp - a.xp || compareNames(a, b));
  assignRanks(daysBoard, (entry) => entry.activeDays, (entry, rank) => {
    entry.daysRank = rank;
  });

  entries.sort((a, b) => b.xp - a.xp || compareNames(a, b));

  return {
    monthKey: input.monthKey,
    daysInMonth: daysInMonth(input.monthKey),
    totalXp: entries.reduce((sum, entry) => sum + entry.xp, 0),
    participantCount: xpBoard.length,
    entries,
    xpBoard,
    daysBoard
  };
}

export function studentRecapView(
  recap: MonthlyRecap,
  studentId: string,
  previous: MonthlyRecap | null
): StudentRecapView {
  const entry = recap.entries.find((row) => row.studentId === studentId) ?? null;
  const previousEntry = previous?.entries.find((row) => row.studentId === studentId) ?? null;
  const previousXp = previousEntry && previousEntry.xp > 0 ? previousEntry.xp : null;
  const xp = entry?.xp ?? 0;

  return {
    entry,
    previousXp,
    changePercent:
      entry && previousXp !== null ? Math.round(((xp - previousXp) / previousXp) * 100) : null,
    topPercent:
      entry?.xpRank && recap.participantCount > 0
        ? Math.max(1, Math.ceil((entry.xpRank / recap.participantCount) * 100))
        : null
  };
}

// Biểu đồ cột XP cả trường (đã xếp giảm dần). Đông người thì gộp nhóm liền nhau
// thành tối đa maxBars cột (lấy trung bình) để cột không mỏng như sợi chỉ.
export function buildXpBars(
  values: number[],
  highlightIndex: number | null,
  maxBars = 40
): { heights: number[]; highlight: number | null } {
  if (values.length === 0) {
    return { heights: [], highlight: null };
  }

  const max = values[0] > 0 ? values[0] : 1;
  const barCount = Math.min(maxBars, values.length);
  const heights = Array.from({ length: barCount }, (_, bar) => {
    const from = Math.floor((bar * values.length) / barCount);
    const to = Math.floor(((bar + 1) * values.length) / barCount);
    const group = values.slice(from, to);
    const average = group.reduce((sum, value) => sum + value, 0) / group.length;
    return Math.round((average / max) * 1000) / 1000;
  });

  return {
    heights,
    highlight:
      highlightIndex === null
        ? null
        : Math.min(barCount - 1, Math.floor((highlightIndex * barCount) / values.length))
  };
}
```

- [ ] **Step 4: Chạy test, thấy PASS** — `npx vitest run tests/monthly-recap.test.ts`.

- [ ] **Step 5: Commit** — `git add lib/monthly-recap.ts tests/monthly-recap.test.ts && git commit -m "feat(tong-ket-thang): logic tong ket thang"`.

---

### Task 3: Đọc DB — `lib/monthly-recap-data.ts`

**Files:**
- Create: `lib/monthly-recap-data.ts`

**Interfaces:**
- Consumes: Task 2 (`buildMonthlyRecap`, `monthRange`, `monthKeyOf`, `shiftMonthKey`, `studentRecapView`, `recapMonthToShow`, types); `MANUAL_QUESTION_TYPES` (`lib/manual-grading.ts`); `dateKeyToUtcDate` (`lib/vocab-daily.ts`).
- Produces: `getMonthlyRecap(monthKey: string, now?: Date): Promise<MonthlyRecap>`, `getStudentRecap(studentId: string, monthKey: string, now?: Date): Promise<{ recap: MonthlyRecap; view: StudentRecapView }>`, `getStudentRecapPopup(studentId: string, now?: Date): Promise<{ recap: MonthlyRecap; view: StudentRecapView } | null>`.

- [ ] **Step 1: Viết `lib/monthly-recap-data.ts`**

```ts
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { MANUAL_QUESTION_TYPES } from "@/lib/manual-grading";
import { dateKeyToUtcDate } from "@/lib/vocab-daily";
import {
  buildMonthlyRecap,
  monthKeyOf,
  monthRange,
  recapMonthToShow,
  shiftMonthKey,
  studentRecapView,
  type MonthlyRecap,
  type RecapStudentInfo,
  type RecapSubmitRow,
  type RecapUnitRow,
  type StudentRecapView
} from "@/lib/monthly-recap";

// Đọc dữ liệu Tổng kết tháng cho CẢ TRƯỜNG. Không có bảng riêng: suy ra từ giờ
// nộp từng kỹ năng, kết quả chấm từng câu và ngày ôn Sổ từ.
async function loadMonthlyRecap(monthKey: string): Promise<MonthlyRecap> {
  const { start, end } = monthRange(monthKey);

  const [skillRows, legacyAttempts, vocabRows] = await Promise.all([
    prisma.attemptSkill.findMany({
      where: { submittedAt: { gte: start, lt: end } },
      select: {
        attemptId: true,
        skill: true,
        submittedAt: true,
        attempt: { select: { studentId: true, attemptRound: true } }
      }
    }),
    // Bài nộp cũ không có giờ nộp từng kỹ năng → mọi phần lấy giờ nộp cả bài
    // (cùng quy ước với lib/activity-heatmap-data.ts).
    prisma.attempt.findMany({
      where: {
        submittedAt: { gte: start, lt: end },
        skills: { none: { submittedAt: { not: null } } }
      },
      select: { id: true, studentId: true, attemptRound: true, submittedAt: true }
    }),
    prisma.vocabQuizDay.findMany({
      where: {
        date: {
          gte: dateKeyToUtcDate(`${monthKey}-01`),
          lt: dateKeyToUtcDate(`${shiftMonthKey(monthKey, 1)}-01`)
        }
      },
      select: { studentId: true, date: true, total: true }
    })
  ]);

  type Submit = { studentId: string; attemptRound: number; submittedAt: Date };
  // Khoá "attemptId:skill" → giờ nộp kỹ năng đó trong tháng.
  const skillSubmits = new Map<string, Submit>();
  const legacySubmits = new Map<string, Submit>();
  const submits: RecapSubmitRow[] = [];

  for (const row of skillRows) {
    if (!row.submittedAt) continue;
    const submit = {
      studentId: row.attempt.studentId,
      attemptRound: row.attempt.attemptRound,
      submittedAt: row.submittedAt
    };
    skillSubmits.set(`${row.attemptId}:${row.skill}`, submit);
    submits.push(submit);
  }

  for (const row of legacyAttempts) {
    if (!row.submittedAt) continue;
    const submit = { studentId: row.studentId, attemptRound: row.attemptRound, submittedAt: row.submittedAt };
    legacySubmits.set(row.id, submit);
    submits.push(submit);
  }

  const attemptIds = Array.from(
    new Set([...skillRows.map((row) => row.attemptId), ...legacyAttempts.map((row) => row.id)])
  );

  const [gradedGroups, manualGroups] = attemptIds.length
    ? await Promise.all([
        // Câu tự chấm đã có kết quả — đếm đúng/sai theo từng phần, không tải value.
        prisma.answer.groupBy({
          by: ["attemptId", "assignableUnitId", "isCorrect"],
          where: {
            attemptId: { in: attemptIds },
            isCorrect: { not: null },
            question: { questionType: { notIn: [...MANUAL_QUESTION_TYPES] } }
          },
          _count: { _all: true }
        }),
        // Câu chấm tay (Writing task / Speaking) có bài làm.
        prisma.answer.groupBy({
          by: ["attemptId", "assignableUnitId"],
          where: {
            attemptId: { in: attemptIds },
            value: { not: "" },
            question: { questionType: { in: [...MANUAL_QUESTION_TYPES] } }
          },
          _count: { _all: true }
        })
      ])
    : [[], []];

  type UnitCounts = { attemptId: string; unitId: string; graded: number; correct: number; manual: boolean };
  const unitCounts = new Map<string, UnitCounts>();

  function countsOf(attemptId: string, unitId: string): UnitCounts {
    const key = `${attemptId}:${unitId}`;
    let row = unitCounts.get(key);
    if (!row) {
      row = { attemptId, unitId, graded: 0, correct: 0, manual: false };
      unitCounts.set(key, row);
    }
    return row;
  }

  for (const group of gradedGroups) {
    const row = countsOf(group.attemptId, group.assignableUnitId);
    row.graded += group._count._all;
    if (group.isCorrect) {
      row.correct += group._count._all;
    }
  }

  for (const group of manualGroups) {
    countsOf(group.attemptId, group.assignableUnitId).manual = true;
  }

  const unitIds = Array.from(new Set(Array.from(unitCounts.values(), (row) => row.unitId)));
  const unitSkills = new Map(
    (unitIds.length
      ? await prisma.assignableUnit.findMany({
          where: { id: { in: unitIds } },
          select: { id: true, skill: true }
        })
      : []
    ).map((unit) => [unit.id, unit.skill])
  );

  const units: RecapUnitRow[] = [];
  unitCounts.forEach((row) => {
    const skill = unitSkills.get(row.unitId);
    if (!skill) return;
    // Kỹ năng chưa nộp (câu nháp) hoặc nộp ở tháng khác → không có trong map.
    const submit = skillSubmits.get(`${row.attemptId}:${skill}`) ?? legacySubmits.get(row.attemptId);
    if (!submit) return;
    units.push({
      studentId: submit.studentId,
      skill,
      submittedAt: submit.submittedAt,
      attemptRound: submit.attemptRound,
      gradedCount: row.graded,
      correctCount: row.correct,
      manualAnswered: row.manual
    });
  });

  const vocab = vocabRows.map((row) => ({
    studentId: row.studentId,
    // VocabQuizDay.date lưu nửa đêm UTC của ngày VN → cắt chuỗi là ra khoá ngày.
    date: row.date.toISOString().slice(0, 10),
    total: row.total
  }));

  const studentIds = Array.from(
    new Set([...submits.map((row) => row.studentId), ...vocab.map((row) => row.studentId)])
  );
  const students: RecapStudentInfo[] = studentIds.length
    ? (
        await prisma.studentProfile.findMany({
          where: { id: { in: studentIds } },
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
            avatarPreset: true,
            user: { select: { image: true } }
          }
        })
      ).map((student) => ({
        id: student.id,
        displayName: student.displayName,
        avatarUrl: student.avatarUrl,
        avatarPreset: student.avatarPreset,
        userImage: student.user?.image ?? null
      }))
    : [];

  return buildMonthlyRecap({ monthKey, units, submits, vocab, students });
}

// Tháng đã kết thúc gần như không đổi → cache 1 ngày cho nhẹ Neon.
const loadClosedMonthRecap = unstable_cache(loadMonthlyRecap, ["monthly-recap-v1"], {
  revalidate: 86400
});

export async function getMonthlyRecap(monthKey: string, now = new Date()): Promise<MonthlyRecap> {
  return monthKey < monthKeyOf(now) ? loadClosedMonthRecap(monthKey) : loadMonthlyRecap(monthKey);
}

export async function getStudentRecap(
  studentId: string,
  monthKey: string,
  now = new Date()
): Promise<{ recap: MonthlyRecap; view: StudentRecapView }> {
  const [recap, previous] = await Promise.all([
    getMonthlyRecap(monthKey, now),
    getMonthlyRecap(shiftMonthKey(monthKey, -1), now)
  ]);

  return { recap, view: studentRecapView(recap, studentId, previous) };
}

// Popup ở trang chủ: chỉ 7 ngày đầu tháng, chỉ khi tháng trước học viên có học.
// Lỗi ở đây KHÔNG được làm hỏng trang chủ → nuốt lỗi, bỏ popup.
export async function getStudentRecapPopup(
  studentId: string,
  now = new Date()
): Promise<{ recap: MonthlyRecap; view: StudentRecapView } | null> {
  const monthKey = recapMonthToShow(now);
  if (!monthKey) return null;

  try {
    const result = await getStudentRecap(studentId, monthKey, now);
    return result.view.entry ? result : null;
  } catch (error) {
    console.error("[monthly-recap] không tính được tổng kết tháng", error);
    return null;
  }
}
```

- [ ] **Step 2: Kiểm kiểu** — `npx tsc --noEmit -p .` → không lỗi ở file mới.

- [ ] **Step 3: Chạy thử với DB local** — script `tmp/_recap-local.mjs` không dùng được TS alias, nên kiểm bằng trang ở Task 6 (giáo viên, local). Bỏ qua bước riêng.

- [ ] **Step 4: Commit** — `git add lib/monthly-recap-data.ts && git commit -m "feat(tong-ket-thang): doc du lieu ca truong"`.

---

### Task 4: Component bảng + panel — `components/monthly-recap-board.tsx`, `components/monthly-recap-panel.tsx`

**Files:**
- Create: `components/monthly-recap-board.tsx`
- Create: `components/monthly-recap-panel.tsx`

**Interfaces:**
- Consumes: types + `buildXpBars`, `monthName`, `monthNumberLabel`, `shiftMonthKey` (Task 2); `StudentAvatar`; `SKILL_ORDER`, `SKILL_LABELS`, `SKILL_PILL_CLASSES`.
- Produces:
  - `MonthlyRecapBoard({ title, eyebrow, entries, metric: "xp" | "days", limit?, highlightStudentId?, profileLinkTarget?: "teacher", emptyText })`
  - `formatXp(value: number): string`
  - `MonthlyRecapPanel({ recap, view, closeMode: "dialog" | "link" })` — nút chân có `data-recap-close` khi `closeMode="dialog"`, là `<Link href="/student">` khi `"link"`.

- [ ] **Step 1: Viết `components/monthly-recap-board.tsx`**

Bục 1-2-3 (thứ tự hiển thị 2-1-3, chỉ vẽ người có thật) + danh sách hạng 4..limit; dòng của học viên đang xem `ring-1 ring-primary bg-primary/10` + chip "Em"; giá trị `★ 1.234 XP` hoặc `🔥 18 ngày`. Giáo viên: tên là link `/teacher/students/[id]`. Code đầy đủ ở commit của task (component trình bày, không logic).

- [ ] **Step 2: Viết `components/monthly-recap-panel.tsx`**

Đầu (nhãn tháng, "Tháng **Chín** của em", câu tổng toàn trường, số "09" mờ trang trí) · lưới `lg:grid-cols-3` gồm thẻ cá nhân (XP, so tháng trước, `buildXpBars` + vạch "Em ở đây", hạng, dải ô ngày, chip kỹ năng, hạng hai bảng) + 2 `MonthlyRecapBoard` (limit 10) · chân (chú thích + nút "Học tiếp tháng Mười").

- [ ] **Step 3: Kiểm kiểu** — `npx tsc --noEmit -p .`.

- [ ] **Step 4: Commit** — `git commit -m "feat(tong-ket-thang): component bang va panel"`.

---

### Task 5: Popup + trang xem lại phía học viên

**Files:**
- Create: `components/monthly-recap-dialog.tsx`
- Create: `app/student/recap/page.tsx`
- Modify: `app/student/page.tsx` (thêm `getStudentRecapPopup` vào `Promise.all`, render dialog)
- Modify: `app/student/stats/page.tsx` (nút "Tổng kết tháng")

**Interfaces:**
- Consumes: `getStudentRecap`, `getStudentRecapPopup` (Task 3); `MonthlyRecapPanel` (Task 4); `recentMonthKeys`, `resolveMonthKey`, `monthKeyOf`, `shiftMonthKey`, `monthName`, `monthNumberLabel` (Task 2).
- Produces: `MonthlyRecapDialog({ monthKey, children })`.

- [ ] **Step 1: Viết dialog** — client; `useEffect` đọc `localStorage["monthly-recap-seen:<month>"]` (try/catch), chưa xem thì mở; biến module `shownThisSession` chặn mở lại khi localStorage hỏng; đóng bằng nút X / Esc / bấm nền / click phần tử `[data-recap-close]` (event delegation) → ghi khoá; khoá cuộn `body` khi mở; `createPortal(…, document.body)`; `role="dialog" aria-modal="true"`.
- [ ] **Step 2: Trang `/student/recap`** — auth như `/student/stats`; `latest = shiftMonthKey(monthKeyOf(now), -1)`; `month = resolveMonthKey(searchParams.month, latest, 6)`; form GET chọn tháng; `MonthlyRecapPanel closeMode="link"`.
- [ ] **Step 3: Gắn popup vào `/student`** — thêm `getStudentRecapPopup(student.id)` vào `Promise.all` sẵn có; có kết quả thì render `<MonthlyRecapDialog monthKey=…><MonthlyRecapPanel … closeMode="dialog" /></MonthlyRecapDialog>` đầu trang.
- [ ] **Step 4: Nút ở `/student/stats`** — link "Tổng kết tháng" ở header tới `/student/recap`.
- [ ] **Step 5: `npx tsc --noEmit -p .` + `pnpm test`** → xanh.
- [ ] **Step 6: Commit** — `git commit -m "feat(tong-ket-thang): popup va trang xem lai cho hoc vien"`.

---

### Task 6: Chế độ "Tổng kết tháng" ở `/teacher/ranking`

**Files:**
- Modify: `app/teacher/ranking/page.tsx`

**Interfaces:**
- Consumes: `getMonthlyRecap` (Task 3); `MonthlyRecapBoard`, `formatXp` (Task 4); `recentMonthKeys`, `resolveMonthKey`, `monthKeyOf`, `monthName`, `monthNumberLabel` (Task 2).

- [ ] **Step 1:** Thêm `searchParams.view`/`searchParams.month`; hai tab link "Theo lớp" (`/teacher/ranking`) và "Tổng kết tháng" (`?view=month`), hiện ở cả hai chế độ. Chế độ tháng xử lý TRƯỚC nhánh "chưa có lớp". `latest = monthKeyOf(now)`, `month = resolveMonthKey(param, latest, 7)`; form GET (hidden `view=month` + select tháng); dòng tổng; ghi chú "đang diễn ra" khi `month === latest`; hai `MonthlyRecapBoard` đầy đủ (không `limit`) với `profileLinkTarget="teacher"`. Vẫn gọi `requireTeacherPage()` đầu trang.
- [ ] **Step 2:** `npx tsc --noEmit -p .` + `pnpm test` (gồm `teacher-page-guard`) → xanh.
- [ ] **Step 3: Kiểm tay ở local** — `preview_start`, đăng nhập GV seed (thầy đăng nhập hộ nếu cần), mở `/teacher/ranking?view=month`, khổ 375px + desktop, sáng/tối; kiểm `/student/recap` không có cách vào bằng GV (redirect).
- [ ] **Step 4: Commit** — `git commit -m "feat(tong-ket-thang): che do tong ket thang o trang xep hang giao vien"`.

---

### Task 7: Hoàn tất

- [ ] `pnpm lint`, `pnpm test`, `pnpm build` → xanh.
- [ ] Push `feature/ielts-platform-mvp` (Vercel tự deploy), kiểm prod bằng Chrome: `/teacher/ranking?view=month&month=2026-09` khớp số liệu hợp lý; xem nhanh truy vấn có chậm không (runtime logs).
- [ ] Ghi memory: tính năng đã ship + công thức XP + chỗ chỉnh hệ số.
