# Gamification Giai đoạn 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm 4 cải tiến gamification thị giác (podium Top 3, tag màu kỹ năng, thanh tiến độ, pop-up chúc mừng khi nộp) dùng hoàn toàn dữ liệu sẵn có.

**Architecture:** Toàn bộ là thay đổi tầng hiển thị (React server/client components) + 2 file logic thuần (`lib/skills.ts`, `lib/celebration.ts`) có unit test. Không đổi schema/seed/dữ liệu. Pop-up nhận biết "vừa nộp" qua query `?submitted=1` do `submitAttempt` gắn vào redirect.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript strict, Tailwind (design tokens), Prisma, vitest.

## Global Constraints

- Không sửa `prisma/schema.prisma`, `prisma/seed.ts`, `lib/seed-data.ts`, `lib/ranking.ts`, hay logic band trong `lib/band-score.ts`.
- Text & comment tiếng Việt. Dùng design tokens Tailwind sẵn có (`bg-card`, `border-border`, `text-primary`, `text-muted-foreground`…) và hỗ trợ dark mode.
- Không thêm dependency mới (pháo hoa/animation viết bằng CSS thuần).
- Path alias `@/*` → repo root. Test import theo kiểu tương đối `../lib/...` như `tests/ranking.test.ts`.
- Skill enum: `listening | reading | writing | speaking`.
- Chạy test 1 file: `npx vitest run tests/<file>.test.ts`. Build đầy đủ: `pnpm build`. Lint: `pnpm lint`.

---

### Task 1: `lib/skills.ts` — nhãn + màu + khử trùng kỹ năng

**Files:**
- Create: `lib/skills.ts`
- Test: `tests/skills.test.ts`

**Interfaces:**
- Consumes: (none)
- Produces:
  - `SKILL_ORDER: readonly ["listening","reading","writing","speaking"]`
  - `SKILL_LABELS: Record<string, string>` (nhãn tiếng Việt)
  - `SKILL_PILL_CLASSES: Record<string, string>` (class Tailwind cho pill)
  - `distinctSkills(skills: string[]): string[]` — khử trùng, sắp theo `SKILL_ORDER`

- [ ] **Step 1: Write the failing test**

Create `tests/skills.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  SKILL_LABELS,
  SKILL_ORDER,
  SKILL_PILL_CLASSES,
  distinctSkills,
} from "../lib/skills";

describe("distinctSkills", () => {
  it("khử trùng và sắp theo thứ tự chuẩn", () => {
    expect(distinctSkills(["reading", "listening", "reading"])).toEqual([
      "listening",
      "reading",
    ]);
  });

  it("bỏ qua giá trị không hợp lệ", () => {
    expect(distinctSkills(["speaking", "xxx", "writing"])).toEqual([
      "writing",
      "speaking",
    ]);
  });

  it("mảng rỗng trả về rỗng", () => {
    expect(distinctSkills([])).toEqual([]);
  });
});

describe("bảng nhãn & màu", () => {
  it("có đủ nhãn tiếng Việt cho 4 kỹ năng", () => {
    for (const skill of SKILL_ORDER) {
      expect(SKILL_LABELS[skill]).toBeTruthy();
      expect(SKILL_PILL_CLASSES[skill]).toBeTruthy();
    }
    expect(SKILL_LABELS.listening).toBe("Nghe");
    expect(SKILL_LABELS.reading).toBe("Đọc");
    expect(SKILL_LABELS.writing).toBe("Viết");
    expect(SKILL_LABELS.speaking).toBe("Nói");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/skills.test.ts`
Expected: FAIL — không import được `../lib/skills`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/skills.ts`:

```ts
// Nguồn dữ liệu duy nhất cho nhãn + màu hiển thị của 4 kỹ năng IELTS.
export const SKILL_ORDER = [
  "listening",
  "reading",
  "writing",
  "speaking",
] as const;

export type Skill = (typeof SKILL_ORDER)[number];

export const SKILL_LABELS: Record<string, string> = {
  listening: "Nghe",
  reading: "Đọc",
  writing: "Viết",
  speaking: "Nói",
};

// Pill: nền nhạt + chữ đậm, hoạt động tốt ở cả light/dark mode.
export const SKILL_PILL_CLASSES: Record<string, string> = {
  listening: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  reading: "bg-sky-500/10 text-sky-600 dark:text-sky-300",
  writing: "bg-orange-500/10 text-orange-600 dark:text-orange-300",
  speaking: "bg-violet-500/10 text-violet-600 dark:text-violet-300",
};

// Khử trùng danh sách kỹ năng và sắp theo thứ tự chuẩn (Nghe→Đọc→Viết→Nói).
// Bỏ qua giá trị không nằm trong SKILL_ORDER.
export function distinctSkills(skills: string[]): string[] {
  const present = new Set(skills);
  return SKILL_ORDER.filter((skill) => present.has(skill));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/skills.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/skills.ts tests/skills.test.ts
git commit -m "feat: lib/skills - nhãn, màu, khử trùng kỹ năng"
```

---

### Task 2: `components/skill-tags.tsx` — component pill kỹ năng

**Files:**
- Create: `components/skill-tags.tsx`

**Interfaces:**
- Consumes: `distinctSkills`, `SKILL_LABELS`, `SKILL_PILL_CLASSES` from `@/lib/skills`
- Produces: `SkillTags({ skills }: { skills: string[] })` — server-safe, không state; trả về `null` khi không có kỹ năng hợp lệ.

- [ ] **Step 1: Create the component**

Create `components/skill-tags.tsx`:

```tsx
import { SKILL_LABELS, SKILL_PILL_CLASSES, distinctSkills } from "@/lib/skills";

// Hiển thị các pill màu theo kỹ năng chứa trong một bài. Bài trộn nhiều kỹ
// năng -> nhiều pill. Không có kỹ năng hợp lệ -> không render gì.
export function SkillTags({ skills }: { skills: string[] }) {
  const ordered = distinctSkills(skills);

  if (ordered.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {ordered.map((skill) => (
        <span
          key={skill}
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            SKILL_PILL_CLASSES[skill] ?? "bg-muted text-muted-foreground"
          }`}
        >
          {SKILL_LABELS[skill] ?? skill}
        </span>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm lint`
Expected: không có lỗi ở `components/skill-tags.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/skill-tags.tsx
git commit -m "feat: component SkillTags hiển thị pill kỹ năng"
```

---

### Task 3: Tag kỹ năng trên trang Tổng quan

**Files:**
- Modify: `app/student/page.tsx`

**Interfaces:**
- Consumes: `SkillTags` from `@/components/skill-tags`

- [ ] **Step 1: Bổ sung truy vấn lấy skill của các phần trong bài**

Trong `app/student/page.tsx`, khối `prisma.assignmentRecipient.findMany`, phần `assignment: { include: { _count: {...} } }` — thêm `units` để lấy skill. Đổi thành:

```ts
      assignment: {
        include: {
          _count: {
            select: { units: true }
          },
          units: {
            select: {
              assignableUnit: { select: { skill: true } }
            }
          }
        }
      },
```

- [ ] **Step 2: Thêm import**

Ở đầu file, thêm dòng import:

```tsx
import { SkillTags } from "@/components/skill-tags";
```

- [ ] **Step 3: Render tag trên mỗi thẻ bài**

Trong `.map((recipient) => {...})`, ngay sau khối `<div className="min-w-0">` hiện có phần mô tả bài (sau đoạn `{latestAttempt ? (...) : null}` và trước khi đóng `</div>` của `min-w-0`), thêm:

```tsx
                    <div className="mt-2">
                      <SkillTags
                        skills={recipient.assignment.units.map(
                          (unit) => unit.assignableUnit.skill
                        )}
                      />
                    </div>
```

- [ ] **Step 4: Verify build & preview**

Run: `pnpm lint`
Expected: không lỗi.
Rồi khởi động preview (`pnpm dev`) và mở `/student` — mỗi thẻ bài hiện pill kỹ năng đúng màu.

- [ ] **Step 5: Commit**

```bash
git add app/student/page.tsx
git commit -m "feat: tag kỹ năng trên thẻ bài trang Tổng quan"
```

---

### Task 4: Tag kỹ năng trên trang Lịch sử

**Files:**
- Modify: `app/student/history/page.tsx`

**Interfaces:**
- Consumes: `SkillTags` from `@/components/skill-tags`

- [ ] **Step 1: Bổ sung units vào truy vấn assignment**

Trong `app/student/history/page.tsx`, khối `assignmentRecipient.include.assignment` hiện là `select: { title: true }`. Thêm `units`:

```ts
          assignment: {
            select: {
              title: true,
              units: {
                select: {
                  assignableUnit: { select: { skill: true } }
                }
              }
            }
          }
```

- [ ] **Step 2: Thêm import**

```tsx
import { SkillTags } from "@/components/skill-tags";
```

- [ ] **Step 3: Render tag dưới tiêu đề bài**

Trong `.map((attempt) => {...})`, khối `<div className="min-w-0">`, ngay sau `<p className="font-semibold">{...title}</p>` và trước dòng `<span ... status ...>`, thêm:

```tsx
                  <div className="mt-2">
                    <SkillTags
                      skills={attempt.assignmentRecipient.assignment.units.map(
                        (unit) => unit.assignableUnit.skill
                      )}
                    />
                  </div>
```

- [ ] **Step 4: Verify**

Run: `pnpm lint`
Expected: không lỗi. Preview `/student/history` — thẻ bài hiện pill kỹ năng.

- [ ] **Step 5: Commit**

```bash
git add app/student/history/page.tsx
git commit -m "feat: tag kỹ năng trên trang Lịch sử"
```

---

### Task 5: Thanh tiến độ (vòng tròn %) trên trang Tổng quan

**Files:**
- Create: `components/progress-ring.tsx`
- Modify: `app/student/page.tsx`

**Interfaces:**
- Consumes: (none)
- Produces: `ProgressRing({ completed, total }: { completed: number; total: number })` — SVG donut server-render; ẩn (trả `null`) khi `total === 0`.

- [ ] **Step 1: Tạo component ProgressRing**

Create `components/progress-ring.tsx`:

```tsx
// Vòng tròn tiến độ (SVG donut) hiển thị % bài được giao đã hoàn thành.
// total === 0 -> không render (chưa có bài nào để đo).
export function ProgressRing({
  completed,
  total,
}: {
  completed: number;
  total: number;
}) {
  if (total === 0) {
    return null;
  }

  const percent = Math.round((completed / total) * 100);
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percent / 100);

  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4 shadow-card">
      <div className="relative shrink-0">
        <svg width="88" height="88" viewBox="0 0 88 88" className="-rotate-90">
          <circle
            cx="44"
            cy="44"
            r={radius}
            fill="none"
            strokeWidth="8"
            className="stroke-muted"
          />
          <circle
            cx="44"
            cy="44"
            r={radius}
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            className="stroke-primary"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-lg font-bold tabular-nums">
          {percent}%
        </span>
      </div>
      <div>
        <p className="text-base font-semibold">Tiến độ tuần luyện tập</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Đã hoàn thành {completed}/{total} bài được giao
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Mount vào trang Tổng quan**

Trong `app/student/page.tsx`:

Thêm import:

```tsx
import { ProgressRing } from "@/components/progress-ring";
```

Đã có sẵn `recipients` và `pendingCount`. Ngay trước `return (`, tính số hoàn thành:

```ts
  const completedCount = recipients.filter(
    (recipient) => recipient.status === "submitted" || recipient.status === "reviewed"
  ).length;
```

Trong JSX, ngay sau `</header>` và trước `<section ...>` đầu tiên, thêm:

```tsx
      <ProgressRing completed={completedCount} total={recipients.length} />
```

- [ ] **Step 3: Verify**

Run: `pnpm lint`
Expected: không lỗi. Preview `/student` — hiện vòng tròn % đúng với số bài hoàn thành/tổng.

- [ ] **Step 4: Commit**

```bash
git add components/progress-ring.tsx app/student/page.tsx
git commit -m "feat: thanh tiến độ vòng tròn trên trang Tổng quan"
```

---

### Task 6: Bục vinh quang Top 3 (Podium) trang Xếp hạng

**Files:**
- Modify: `app/student/ranking/page.tsx`
- Modify: `app/globals.css` (keyframes lấp lánh)

**Interfaces:**
- Consumes: `rankedStudents` (đã tính sẵn trong file, không đổi), `initials`, `avatarColor` (đã có trong file).

- [ ] **Step 1: Thêm keyframes lấp lánh vào globals.css**

Mở `app/globals.css`, thêm vào cuối file:

```css
/* Hiệu ứng lấp lánh cho avatar hạng 1 trên bục vinh quang. */
@keyframes podium-shine {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(250, 204, 21, 0);
  }
  50% {
    box-shadow: 0 0 18px 4px rgba(250, 204, 21, 0.55);
  }
}

.animate-podium-shine {
  animation: podium-shine 2s ease-in-out infinite;
}
```

- [ ] **Step 2: Tách top 3 và phần còn lại, render podium**

Trong `app/student/ranking/page.tsx`, sau dòng `.sort(...)` tạo `rankedStudents` và dòng `const medals = ["🥇", "🥈", "🥉"];`, thêm cấu hình podium:

```tsx
  const topThree = rankedStudents.slice(0, 3);
  const rest = rankedStudents.slice(3);

  // Thứ tự hiển thị trực quan: hạng 2 (trái) - hạng 1 (giữa) - hạng 3 (phải).
  // Chỉ lấy các vị trí thực sự có học viên (lớp ít người sẽ có 1-2 bục).
  const podiumOrder = [1, 0, 2].filter((rankIndex) => topThree[rankIndex]);

  const podiumStyle = [
    { ring: "ring-yellow-400", pedestal: "h-24 bg-yellow-400/20", size: "h-20 w-20", shine: "animate-podium-shine" },
    { ring: "ring-slate-300", pedestal: "h-16 bg-slate-300/20", size: "h-16 w-16", shine: "" },
    { ring: "ring-amber-600", pedestal: "h-12 bg-amber-600/20", size: "h-16 w-16", shine: "" }
  ];
```

- [ ] **Step 3: Chèn khối podium vào JSX**

Trong phần `return`, ngay sau `</header>` và **trước** `<section ...>` chứa bảng danh sách, chèn:

```tsx
      <section className="rounded-xl border border-border bg-card px-4 py-6 shadow-card">
        <div className="flex items-end justify-center gap-3 sm:gap-6">
          {podiumOrder.map((rankIndex) => {
            const rankedStudent = topThree[rankIndex];
            const style = podiumStyle[rankIndex];
            const isCurrentStudent = rankedStudent.id === student.id;

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
                  {isCurrentStudent ? (
                    <span className="ml-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                      Bạn
                    </span>
                  ) : null}
                </p>
                <p className="text-xs font-semibold tabular-nums text-primary">
                  {rankedStudent.rankingScore} điểm
                </p>
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
```

- [ ] **Step 4: Đổi bảng danh sách để chỉ hiện hạng 4 trở đi**

Bảng `<section>` hiện tại đang lặp `rankedStudents`. Đổi để lặp `rest` và ẩn hẳn nếu rỗng. Bọc `<section>` bảng bằng điều kiện, và sửa hai chỗ:

1. Bọc cả section bảng: `{rest.length > 0 ? (` ... `) : null}`.
2. Đổi `{rankedStudents.map((rankedStudent, index) => {` thành `{rest.map((rankedStudent, index) => {` và trong đó thay mọi `index` dùng cho số hạng bằng `index + 4` (tức: `<span ...>{index + 4}</span>` thay cho `{index + 1}`; và bỏ nhánh medal vì rest luôn từ hạng 4). Cụ thể đổi khối hiển thị hạng:

```tsx
                <p className="text-lg font-bold tabular-nums">
                  <span className="text-base text-muted-foreground">{index + 4}</span>
                </p>
```

(Giữ nguyên toàn bộ phần còn lại của mỗi `<article>`: avatar, tên, các cột chỉ số.)

- [ ] **Step 5: Verify với dữ liệu thật**

Run: `pnpm lint`
Expected: không lỗi.
Preview `/student/ranking`: lớp 2 học viên → 2 bục (hạng 1 giữa cao nhất, hạng 2 bên trái), không có bục trống, không có bảng danh sách phía dưới. Avatar hạng 1 có hiệu ứng lấp lánh.

- [ ] **Step 6: Commit**

```bash
git add app/student/ranking/page.tsx app/globals.css
git commit -m "feat: bục vinh quang Top 3 trang Xếp hạng"
```

---

### Task 7: `lib/celebration.ts` — logic bậc chúc mừng

**Files:**
- Create: `lib/celebration.ts`
- Test: `tests/celebration.test.ts`

**Interfaces:**
- Consumes: `SKILL_ORDER` from `@/lib/skills`
- Produces:
  - `type CelebrationTier = "manual" | "encourage" | "good" | "great"`
  - `type CelebrationInput = { scorePercent: number | null; isManualOnly: boolean; dominantSkill: string | null }`
  - `type Celebration = { tier: CelebrationTier; title: string; message: string; confetti: "none" | "medium" | "big" }`
  - `getCelebration(input: CelebrationInput): Celebration`
  - `pickDominantSkill(skills: string[]): string | null` — kỹ năng xuất hiện nhiều nhất; hòa → theo `SKILL_ORDER`; rỗng → `null`.

- [ ] **Step 1: Write the failing test**

Create `tests/celebration.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getCelebration, pickDominantSkill } from "../lib/celebration";

describe("getCelebration", () => {
  it("bài chấm tay -> không pháo hoa, chờ chấm", () => {
    const c = getCelebration({ scorePercent: null, isManualOnly: true, dominantSkill: null });
    expect(c.tier).toBe("manual");
    expect(c.confetti).toBe("none");
  });

  it("điểm < 50 -> động viên, không pháo hoa", () => {
    const c = getCelebration({ scorePercent: 49, isManualOnly: false, dominantSkill: "reading" });
    expect(c.tier).toBe("encourage");
    expect(c.confetti).toBe("none");
  });

  it("điểm 50 -> bậc good, pháo hoa vừa", () => {
    const c = getCelebration({ scorePercent: 50, isManualOnly: false, dominantSkill: "reading" });
    expect(c.tier).toBe("good");
    expect(c.confetti).toBe("medium");
  });

  it("điểm 79 vẫn là good", () => {
    expect(
      getCelebration({ scorePercent: 79, isManualOnly: false, dominantSkill: "reading" }).tier
    ).toBe("good");
  });

  it("điểm 80 -> great, pháo hoa lớn, danh hiệu theo kỹ năng", () => {
    const c = getCelebration({ scorePercent: 80, isManualOnly: false, dominantSkill: "reading" });
    expect(c.tier).toBe("great");
    expect(c.confetti).toBe("big");
    expect(c.title).toContain("Reading");
  });

  it("great không có dominantSkill -> danh hiệu chung", () => {
    const c = getCelebration({ scorePercent: 95, isManualOnly: false, dominantSkill: null });
    expect(c.tier).toBe("great");
    expect(c.title).toBeTruthy();
  });

  it("scorePercent null nhưng không manual -> vẫn xử như manual (an toàn)", () => {
    const c = getCelebration({ scorePercent: null, isManualOnly: false, dominantSkill: null });
    expect(c.tier).toBe("manual");
  });
});

describe("pickDominantSkill", () => {
  it("chọn kỹ năng nhiều câu nhất", () => {
    expect(pickDominantSkill(["reading", "reading", "listening"])).toBe("reading");
  });

  it("hòa -> theo thứ tự chuẩn (listening trước reading)", () => {
    expect(pickDominantSkill(["reading", "listening"])).toBe("listening");
  });

  it("rỗng -> null", () => {
    expect(pickDominantSkill([])).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/celebration.test.ts`
Expected: FAIL — không import được `../lib/celebration`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/celebration.ts`:

```ts
import { SKILL_ORDER } from "@/lib/skills";

export type CelebrationTier = "manual" | "encourage" | "good" | "great";

export type CelebrationInput = {
  scorePercent: number | null;
  isManualOnly: boolean;
  dominantSkill: string | null;
};

export type Celebration = {
  tier: CelebrationTier;
  title: string;
  message: string;
  confetti: "none" | "medium" | "big";
};

// Danh hiệu vui khi đạt điểm cao, theo kỹ năng chiếm ưu thế của bài.
const GREAT_TITLES: Record<string, string> = {
  listening: "Cao thủ Listening",
  reading: "Kẻ hủy diệt Reading",
  writing: "Bậc thầy Writing",
  speaking: "Ngôi sao Speaking",
};

// Quyết định nội dung + độ mạnh pháo hoa của pop-up chúc mừng.
// Bài chấm tay (Viết/Nói) hoặc chưa có điểm -> biến thể "chờ chấm", không pháo hoa.
export function getCelebration(input: CelebrationInput): Celebration {
  if (input.isManualOnly || input.scorePercent === null) {
    return {
      tier: "manual",
      title: "Đã nộp bài!",
      message: "Bài của bạn đang chờ giáo viên chấm.",
      confetti: "none",
    };
  }

  if (input.scorePercent < 50) {
    return {
      tier: "encourage",
      title: "Đã nộp!",
      message: "Lần sau bùng nổ hơn nhé 💪",
      confetti: "none",
    };
  }

  if (input.scorePercent < 80) {
    return {
      tier: "good",
      title: "Làm tốt lắm!",
      message: "Bạn đang tiến bộ đấy, giữ phong độ nhé!",
      confetti: "medium",
    };
  }

  const title =
    (input.dominantSkill && GREAT_TITLES[input.dominantSkill]) || "Xuất sắc!";

  return {
    tier: "great",
    title,
    message: "Điểm số bùng nổ! Tiếp tục phát huy nhé 🎉",
    confetti: "big",
  };
}

// Kỹ năng xuất hiện nhiều nhất trong danh sách (một phần tử / câu đã chấm tự động).
// Hòa -> ưu tiên theo SKILL_ORDER. Rỗng -> null.
export function pickDominantSkill(skills: string[]): string | null {
  const counts = new Map<string, number>();
  for (const skill of skills) {
    counts.set(skill, (counts.get(skill) ?? 0) + 1);
  }

  let best: string | null = null;
  let bestCount = 0;
  for (const skill of SKILL_ORDER) {
    const count = counts.get(skill) ?? 0;
    if (count > bestCount) {
      best = skill;
      bestCount = count;
    }
  }

  return best;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/celebration.test.ts`
Expected: PASS (tất cả).

- [ ] **Step 5: Commit**

```bash
git add lib/celebration.ts tests/celebration.test.ts
git commit -m "feat: lib/celebration - logic bậc chúc mừng + danh hiệu"
```

---

### Task 8: Pop-up chúc mừng khi nộp bài

**Files:**
- Create: `components/submit-celebration.tsx`
- Modify: `app/globals.css` (keyframes pháo hoa)
- Modify: `app/student/results/[attemptId]/page.tsx` (tính props + mount)
- Modify: `lib/actions/attempts.ts` (thêm `?submitted=1` vào redirect sau khi chấm)

**Interfaces:**
- Consumes: `getCelebration`, `pickDominantSkill` from `@/lib/celebration`
- Produces: `SubmitCelebration({ scorePercent, isManualOnly, dominantSkill }: { scorePercent: number | null; isManualOnly: boolean; dominantSkill: string | null })` — client component.

- [ ] **Step 1: Thêm keyframes pháo hoa vào globals.css**

Thêm vào cuối `app/globals.css`:

```css
/* Pháo hoa (confetti) rơi cho pop-up chúc mừng. */
@keyframes confetti-fall {
  0% {
    transform: translateY(-10vh) rotate(0deg);
    opacity: 1;
  }
  100% {
    transform: translateY(110vh) rotate(720deg);
    opacity: 0;
  }
}

.confetti-piece {
  position: absolute;
  top: 0;
  width: 8px;
  height: 14px;
  border-radius: 2px;
  animation-name: confetti-fall;
  animation-timing-function: linear;
  animation-iteration-count: 1;
  animation-fill-mode: forwards;
}
```

- [ ] **Step 2: Tạo component client SubmitCelebration**

Create `components/submit-celebration.tsx`:

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getCelebration } from "@/lib/celebration";

const CONFETTI_COLORS = ["#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ef4444", "#eab308"];

function confettiCount(level: "none" | "medium" | "big") {
  if (level === "big") return 80;
  if (level === "medium") return 40;
  return 0;
}

export function SubmitCelebration({
  scorePercent,
  isManualOnly,
  dominantSkill,
}: {
  scorePercent: number | null;
  isManualOnly: boolean;
  dominantSkill: string | null;
}) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const justSubmitted = params.get("submitted") === "1";

  // Khởi tạo trạng thái mở từ lần render đầu; state giữ nguyên kể cả khi ta
  // xóa query bên dưới, nên pop-up không tự tắt khi param biến mất.
  const [open, setOpen] = useState(justSubmitted);

  useEffect(() => {
    if (justSubmitted) {
      // Xóa dấu hiệu để refresh trang không bật lại pop-up.
      router.replace(pathname, { scroll: false });
    }
    // Chỉ chạy một lần khi mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const celebration = useMemo(
    () => getCelebration({ scorePercent, isManualOnly, dominantSkill }),
    [scorePercent, isManualOnly, dominantSkill]
  );

  const pieces = useMemo(() => {
    const count = confettiCount(celebration.confetti);
    return Array.from({ length: count }, (_, index) => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.6,
      duration: 2 + Math.random() * 1.5,
      color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
    }));
  }, [celebration.confetti]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      {pieces.length > 0 ? (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          {pieces.map((piece, index) => (
            <span
              key={index}
              className="confetti-piece"
              style={{
                left: `${piece.left}%`,
                backgroundColor: piece.color,
                animationDelay: `${piece.delay}s`,
                animationDuration: `${piece.duration}s`,
              }}
            />
          ))}
        </div>
      ) : null}

      <div className="relative w-full max-w-sm rounded-2xl border border-border bg-card px-6 py-8 text-center shadow-card">
        <p className="text-4xl">
          {celebration.confetti === "big" ? "🎉" : celebration.tier === "manual" ? "📝" : "✅"}
        </p>
        <h3 className="mt-3 text-xl font-bold">{celebration.title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{celebration.message}</p>
        {scorePercent !== null && !isManualOnly ? (
          <p className="mt-3 text-2xl font-bold tabular-nums text-primary">
            {Math.round(scorePercent)}%
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="mt-5 w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
        >
          Tuyệt vời!
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Gắn `?submitted=1` vào redirect sau khi chấm**

Trong `lib/actions/attempts.ts`, tìm redirect **sau** các `revalidatePath` (đoạn cuối `submitAttempt`, khoảng dòng 485):

```ts
  redirect(`/student/results/${attempt.id}`);
```

Đổi thành:

```ts
  redirect(`/student/results/${attempt.id}?submitted=1`);
```

**Chỉ đổi redirect này.** Giữ nguyên redirect ở nhánh "đã nộp rồi" (`if (attempt.status === "submitted")`) — đó là trường hợp mở lại, không phải vừa nộp.

- [ ] **Step 4: Tính props và mount vào trang kết quả**

Trong `app/student/results/[attemptId]/page.tsx`:

Thêm import:

```tsx
import { SubmitCelebration } from "@/components/submit-celebration";
import { pickDominantSkill } from "@/lib/celebration";
```

Truy vấn `attempt.answers` **đã có sẵn** `assignableUnit.select.skill` và (qua `include`) toàn bộ scalar gồm `isCorrect` — **không cần đổi truy vấn**. Kiểm tra nhanh để chắc chắn, rồi dùng luôn.

Sau khi có `attempt`, trước `return`, tính:

```ts
  // Các câu đã chấm tự động (Nghe/Đọc) có isCorrect khác null; Viết/Nói = null.
  const autoSkills = attempt.answers
    .filter((answer) => answer.isCorrect !== null)
    .map((answer) => answer.assignableUnit.skill);
  const isManualOnly = autoSkills.length === 0;
  const dominantSkill = pickDominantSkill(autoSkills);
```

Trong JSX trả về (`return ( <div className="space-y-8"> ... )`), thêm component ngay đầu `<div>`, **trước** `<ResultReview attempt={attempt} />`:

```tsx
      <SubmitCelebration
        scorePercent={attempt.scorePercent}
        isManualOnly={isManualOnly}
        dominantSkill={dominantSkill}
      />
```

- [ ] **Step 5: Verify end-to-end**

Run: `pnpm build`
Expected: build thành công, không lỗi type.

Preview: đăng nhập học viên, làm & nộp một bài **Nghe/Đọc** điểm cao → pop-up "Kẻ hủy diệt Reading"/"Cao thủ Listening" + pháo hoa lớn. Nộp bài điểm < 50% → động viên, không pháo hoa. Refresh trang kết quả → pop-up **không** hiện lại (query đã bị xóa). Bài **Viết/Nói** → "Đã nộp bài! … chờ giáo viên chấm", không pháo hoa.

- [ ] **Step 6: Commit**

```bash
git add components/submit-celebration.tsx app/globals.css app/student/results/[attemptId]/page.tsx lib/actions/attempts.ts
git commit -m "feat: pop-up chúc mừng có pháo hoa khi nộp bài"
```

---

### Task 9: Kiểm thử tổng thể & dọn dẹp

**Files:** (không tạo file)

- [ ] **Step 1: Chạy toàn bộ test**

Run: `pnpm test`
Expected: PASS toàn bộ (bao gồm `skills.test.ts`, `celebration.test.ts`; các test cấu trúc cũ không đổi vì không đụng schema/seed).

- [ ] **Step 2: Build production**

Run: `pnpm build`
Expected: thành công.

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: không lỗi.

- [ ] **Step 4: Commit (nếu có chỉnh sửa nhỏ)**

```bash
git add -A
git commit -m "chore: hoàn tất gamification giai đoạn 1"
```

---

## Self-Review

**Spec coverage:**
- Podium Top 3 → Task 6 ✓
- Tag màu kỹ năng (Tổng quan + Lịch sử) → Task 1, 2, 3, 4 ✓
- Thanh tiến độ vòng tròn % → Task 5 ✓
- Pop-up chúc mừng phân bậc + Viết/Nói + không lặp khi refresh → Task 7, 8 ✓
- `lib/skills.ts`, `lib/celebration.ts` có unit test → Task 1, 7 ✓
- Không đụng schema/seed/ranking/band → tuân thủ trong Global Constraints & từng task ✓

**Type consistency:** `getCelebration`/`pickDominantSkill`/`SkillTags`/`ProgressRing`/`SubmitCelebration`/`distinctSkills` dùng nhất quán tên & chữ ký giữa các task (khai báo ở Task 1/5/7/8, tiêu thụ đúng tên).

**Placeholder scan:** không có TBD/TODO; mọi step có code hoặc lệnh cụ thể + kết quả mong đợi.
