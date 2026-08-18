# Báo cáo học tập cho phụ huynh — Kế hoạch thực thi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phụ huynh nhận mail tóm tắt hàng tuần và xem được một trang chỉ-đọc về tình hình học tập của con, không cần tài khoản và không thấy đề/đáp án.

**Architecture:** Thêm 4 cột vào `StudentProfile` (email + tên phụ huynh + token bí mật + mốc gửi mail). Toàn bộ số liệu sinh ra từ một module hàm thuần `lib/parent-report.ts` để trang web và mail không bao giờ lệch nhau; một module truy vấn `lib/parent-report-query.ts` là cửa duy nhất đọc DB và cố tình không chạm tới câu hỏi/đáp án. Trang công khai `/ph/[token]` tra học viên theo token. Cron Chủ nhật gửi mail, cộng nút gửi tay cho giáo viên.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Prisma + Postgres (Neon), nodemailer (Gmail App Password), vitest, Tailwind.

**Spec:** [docs/superpowers/specs/2026-08-18-bao-cao-phu-huynh-design.md](../specs/2026-08-18-bao-cao-phu-huynh-design.md)

## Global Constraints

- Toàn bộ chữ hiển thị cho người dùng và comment trong code viết bằng **tiếng Việt**.
- Mọi server action mở đầu bằng `requireTeacher()` (import từ `@/lib/actions/classes`) và luôn truy vấn học viên kèm ràng buộc thuộc lớp của giáo viên đó — không tin `studentId` lấy từ `FormData`.
- Mọi cột mới thêm vào schema **bắt buộc** phải có câu lệnh tương ứng trong `scripts/ensure-db.mjs`, nếu không production sẽ sập sau khi deploy.
- Truy vấn Prisma ở khu vực giáo viên dùng `select`, **không** dùng `include` cho các quan hệ nặng (`content`, `transcript`, `metadataJson`).
- Trang phụ huynh **tuyệt đối không** truy vấn `Question`, `Answer.value`, `Question.correctAnswerJson`, `AnswerAnnotation`, `AssignableUnit.content`, `AssignableUnit.transcript`.
- Thống kê chỉ tính lượt làm bài đầu tiên: dùng `countsForStats` từ `@/lib/practice`. Bài tự luyện loại ra bằng `excludePracticeAssignment`.
- Bài Viết/Nói chưa chấm có `scorePercent = null` và `overallBand = null` — **không được** tính thành 0 khi lấy trung bình.
- Chạy test bằng `npx vitest run <file>`. Chạy toàn bộ bằng `pnpm test`.
- Commit trên nhánh `feature/ielts-platform-mvp`.

---

## Cấu trúc file

| File | Trách nhiệm |
| --- | --- |
| `prisma/schema.prisma` (sửa) | 4 cột mới trên `StudentProfile` |
| `scripts/ensure-db.mjs` (sửa) | Áp 4 cột + unique index lên prod lúc build |
| `lib/parent-report.ts` (mới) | Hàm thuần: tính tóm tắt, quyết định có gửi mail, chọn điểm mạnh/yếu |
| `lib/parent-report-query.ts` (mới) | Cửa duy nhất đọc DB cho tính năng này |
| `lib/actions/parents.ts` (mới) | 3 server action của giáo viên |
| `components/parent-contact-block.tsx` (mới) | Khối "Phụ huynh" trong trang học viên (client component) |
| `app/teacher/students/[studentId]/page.tsx` (sửa) | Nạp dữ liệu phụ huynh và render khối trên |
| `app/ph/[token]/page.tsx` (mới) | Trang chỉ-đọc công khai |
| `lib/parent-report-email.ts` (mới) | Hàm thuần soạn mail (subject/text/html) |
| `app/api/cron/parent-reports/route.ts` (mới) | Cron Chủ nhật |
| `vercel.json` (sửa) | Lịch cron |
| `tests/parent-report.test.ts` (mới) | Test logic thuần + soạn mail |
| `tests/foundation.test.ts` (sửa) | Test cấu trúc schema + ensure-db |

---

### Task 1: Schema, ensure-db và test cấu trúc

**Files:**
- Modify: `prisma/schema.prisma` (model `StudentProfile`)
- Modify: `scripts/ensure-db.mjs`
- Test: `tests/foundation.test.ts`

**Interfaces:**
- Consumes: không có (task đầu tiên)
- Produces: 4 cột trên `StudentProfile` — `parentEmail: String?`, `parentName: String?`, `parentToken: String? @unique`, `parentReportSentAt: DateTime?`. Mọi task sau đọc/ghi các cột này qua Prisma Client.

- [ ] **Step 1: Viết test cấu trúc (sẽ fail)**

Mở `tests/foundation.test.ts`, xem cách các test hiện có đọc file schema (chúng dùng `readFileSync` rồi `expect(schema).toContain(...)`). Thêm vào cuối file, **theo đúng cách đọc file mà các test có sẵn trong file đó đang dùng**:

```ts
describe("Cột liên hệ phụ huynh", () => {
  const PARENT_COLUMNS = [
    "parentEmail",
    "parentName",
    "parentToken",
    "parentReportSentAt"
  ];

  it("schema.prisma khai báo đủ 4 cột trên StudentProfile", () => {
    const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
    const start = schema.indexOf("model StudentProfile");
    const model = schema.slice(start, schema.indexOf("\nmodel ", start + 10));

    for (const column of PARENT_COLUMNS) {
      expect(model).toContain(column);
    }

    expect(model).toMatch(/parentToken\s+String\?\s+@unique/);
  });

  it("ensure-db.mjs áp đủ 4 cột và unique index lên production", () => {
    const script = readFileSync(join(process.cwd(), "scripts/ensure-db.mjs"), "utf8");

    for (const column of PARENT_COLUMNS) {
      expect(script).toContain(`"${column}"`);
    }

    expect(script).toContain("StudentProfile_parentToken_key");
  });
});
```

Nếu `readFileSync`/`join`/`describe`/`it`/`expect` chưa được import ở đầu file thì thêm import cho khớp với phần còn lại của file.

- [ ] **Step 2: Chạy test để chắc chắn nó fail**

```bash
npx vitest run tests/foundation.test.ts
```

Expected: FAIL — hai test mới báo không tìm thấy `parentEmail`.

- [ ] **Step 3: Thêm 4 cột vào schema**

Trong `prisma/schema.prisma`, model `StudentProfile`, chèn ngay dưới dòng `notificationsReadAt DateTime?`:

```prisma
  // Liên hệ phụ huynh. Để trống parentEmail = học viên này không có báo cáo,
  // cron bỏ qua và link /ph/<token> cũng ngưng hoạt động.
  parentEmail         String?
  parentName          String?
  // Mã bí mật của link xem báo cáo. Giáo viên bấm "Tạo lại link" -> đổi mã,
  // link cũ chết ngay. Sinh bằng crypto.randomBytes(24).toString("base64url").
  parentToken         String?   @unique
  // Lần cron gửi mail tuần gần nhất. Nút gửi tay KHÔNG cập nhật cột này để
  // không làm lỡ mail Chủ nhật.
  parentReportSentAt  DateTime?
```

- [ ] **Step 4: Thêm câu lệnh vào ensure-db.mjs**

Trong `scripts/ensure-db.mjs`, thêm vào cuối mảng `statements` (trước dấu `];`):

```js
  // Liên hệ phụ huynh + link báo cáo. ALTER TABLE không tự tạo ràng buộc unique
  // nên phải có thêm câu CREATE UNIQUE INDEX riêng cho parentToken.
  'ALTER TABLE "StudentProfile" ADD COLUMN IF NOT EXISTS "parentEmail" TEXT;',
  'ALTER TABLE "StudentProfile" ADD COLUMN IF NOT EXISTS "parentName" TEXT;',
  'ALTER TABLE "StudentProfile" ADD COLUMN IF NOT EXISTS "parentToken" TEXT;',
  'ALTER TABLE "StudentProfile" ADD COLUMN IF NOT EXISTS "parentReportSentAt" TIMESTAMP(3);',
  'CREATE UNIQUE INDEX IF NOT EXISTS "StudentProfile_parentToken_key" ON "StudentProfile"("parentToken");',
```

- [ ] **Step 5: Sinh lại Prisma Client và áp lên DB local**

```bash
npx prisma generate
```

Expected: `Generated Prisma Client`.

```bash
npx prisma db push
```

Expected: `Your database is now in sync with your Prisma schema.` (DB local là Neon "ielts-test" theo `.env` — KHÔNG đụng vào prod.)

- [ ] **Step 6: Chạy lại test**

```bash
npx vitest run tests/foundation.test.ts
```

Expected: PASS toàn bộ.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma scripts/ensure-db.mjs tests/foundation.test.ts
git commit -m "feat(phu-huynh): them cot lien he phu huynh vao StudentProfile"
```

---

### Task 2: Logic thuần — `lib/parent-report.ts`

**Files:**
- Create: `lib/parent-report.ts`
- Test: `tests/parent-report.test.ts`

**Interfaces:**
- Consumes: `rankingScorePercent` từ `@/lib/student-score`; `GroupStat`, `WEAKEST_MIN_ANSWERS` từ `@/lib/question-stats`.
- Produces:
  - `type ParentPeriod = "week" | "month"`
  - `type ParentReportItem` (xem Step 3)
  - `type ParentComment = { assignmentTitle: string; band: number | null; feedback: string; reviewedAt: Date }`
  - `type ParentTrend = "up" | "down" | "flat" | "unknown"`
  - `type ParentSummary` (xem Step 3)
  - `periodRange(now: Date, period: ParentPeriod): { from: Date; to: Date }`
  - `buildParentSummary(items: ParentReportItem[], now: Date, period: ParentPeriod): ParentSummary`
  - `shouldSendReport(summary: ParentSummary): boolean`
  - `pickStrengthsAndWeaknesses(stats: GroupStat[]): { strengths: GroupStat[]; weaknesses: GroupStat[] }`

Module này **không được import Prisma**.

- [ ] **Step 1: Viết test (sẽ fail)**

Tạo `tests/parent-report.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  buildParentSummary,
  pickStrengthsAndWeaknesses,
  periodRange,
  shouldSendReport,
  type ParentReportItem
} from "@/lib/parent-report";

const NOW = new Date("2026-08-16T05:00:00.000Z");

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);
}

function item(overrides: Partial<ParentReportItem> = {}): ParentReportItem {
  return {
    assignmentTitle: "Cam 20 Test 1 — Reading",
    skills: ["reading"],
    assignedAt: daysAgo(3),
    deadline: daysAgo(1),
    status: "submitted",
    submittedAt: daysAgo(2),
    scorePercent: 70,
    overallBand: null,
    reviewedAt: null,
    summaryFeedback: null,
    ...overrides
  };
}

describe("periodRange", () => {
  it("tuần lùi 7 ngày, tháng lùi 30 ngày", () => {
    expect(periodRange(NOW, "week").from).toEqual(daysAgo(7));
    expect(periodRange(NOW, "month").from).toEqual(daysAgo(30));
  });
});

describe("buildParentSummary", () => {
  it("đếm bài đã nộp trong kỳ và tính trung bình %", () => {
    const summary = buildParentSummary(
      [item({ scorePercent: 60 }), item({ scorePercent: 80 })],
      NOW,
      "week"
    );

    expect(summary.submittedCount).toBe(2);
    expect(summary.averagePercent).toBe(70);
  });

  it("bài Viết chưa chấm KHÔNG bị tính thành 0", () => {
    const summary = buildParentSummary(
      [
        item({ scorePercent: 80 }),
        item({ skills: ["writing"], scorePercent: null, overallBand: null })
      ],
      NOW,
      "week"
    );

    expect(summary.averagePercent).toBe(80);
  });

  it("bài Viết đã chấm quy band về thang 100", () => {
    const summary = buildParentSummary(
      [item({ skills: ["writing"], scorePercent: null, overallBand: 6.3 })],
      NOW,
      "week"
    );

    expect(summary.averageBand).toBe(6.3);
    expect(summary.averagePercent).toBeCloseTo(70, 0);
  });

  it("bài nộp ngoài kỳ không được tính", () => {
    const summary = buildParentSummary([item({ submittedAt: daysAgo(20) })], NOW, "week");

    expect(summary.submittedCount).toBe(0);
  });

  it("đếm bài quá hạn chưa làm", () => {
    const summary = buildParentSummary(
      [item({ status: "assigned", submittedAt: null, deadline: daysAgo(1) })],
      NOW,
      "week"
    );

    expect(summary.lateOrMissingCount).toBe(1);
    expect(summary.pending).toHaveLength(1);
  });

  it("bài chưa tới hạn không tính là nợ", () => {
    const summary = buildParentSummary(
      [
        item({
          status: "assigned",
          submittedAt: null,
          deadline: new Date(NOW.getTime() + 86_400_000)
        })
      ],
      NOW,
      "week"
    );

    expect(summary.lateOrMissingCount).toBe(0);
  });

  it("xu hướng tăng khi kỳ này khá hơn kỳ trước", () => {
    const summary = buildParentSummary(
      [
        item({ submittedAt: daysAgo(2), scorePercent: 80 }),
        item({ submittedAt: daysAgo(10), scorePercent: 60 })
      ],
      NOW,
      "week"
    );

    expect(summary.trend).toBe("up");
  });

  it("thiếu dữ liệu kỳ trước thì xu hướng là unknown", () => {
    const summary = buildParentSummary([item({ scorePercent: 80 })], NOW, "week");

    expect(summary.trend).toBe("unknown");
  });

  it("gom nhận xét của cô trong kỳ", () => {
    const summary = buildParentSummary(
      [
        item({
          skills: ["writing"],
          scorePercent: null,
          overallBand: 6,
          status: "reviewed",
          reviewedAt: daysAgo(1),
          summaryFeedback: "Bố cục tốt, cần thêm ví dụ."
        })
      ],
      NOW,
      "week"
    );

    expect(summary.comments).toHaveLength(1);
    expect(summary.comments[0].feedback).toBe("Bố cục tốt, cần thêm ví dụ.");
  });

  it("headline nói rõ chưa hoàn thành bài nào", () => {
    const summary = buildParentSummary([], NOW, "week");

    expect(summary.headline).toContain("chưa hoàn thành bài nào");
  });
});

describe("shouldSendReport", () => {
  it("không gửi khi kỳ đó trống trơn", () => {
    expect(shouldSendReport(buildParentSummary([], NOW, "week"))).toBe(false);
  });

  it("gửi khi có bài đã nộp", () => {
    expect(shouldSendReport(buildParentSummary([item()], NOW, "week"))).toBe(true);
  });

  it("gửi khi con đang nợ bài dù không nộp gì", () => {
    const summary = buildParentSummary(
      [item({ status: "assigned", submittedAt: null, deadline: daysAgo(1) })],
      NOW,
      "week"
    );

    expect(shouldSendReport(summary)).toBe(true);
  });
});

describe("pickStrengthsAndWeaknesses", () => {
  it("lấy 2 nhóm tốt nhất và 2 nhóm kém nhất, không trùng nhau", () => {
    const stats = [
      { key: "mc", label: "Trắc nghiệm", correct: 18, total: 20, percent: 90 },
      { key: "tfng", label: "True/False", correct: 12, total: 20, percent: 60 },
      { key: "matching", label: "Nối", correct: 8, total: 20, percent: 40 },
      { key: "gapfill", label: "Điền từ", correct: 16, total: 20, percent: 80 }
    ] as unknown as Parameters<typeof pickStrengthsAndWeaknesses>[0];

    const result = pickStrengthsAndWeaknesses(stats);

    expect(result.strengths.map((s) => s.percent)).toEqual([90, 80]);
    expect(result.weaknesses.map((s) => s.percent)).toEqual([40, 60]);
  });

  it("bỏ qua nhóm quá ít câu", () => {
    const stats = [
      { key: "mc", label: "Trắc nghiệm", correct: 2, total: 3, percent: 67 }
    ] as unknown as Parameters<typeof pickStrengthsAndWeaknesses>[0];

    const result = pickStrengthsAndWeaknesses(stats);

    expect(result.strengths).toHaveLength(0);
    expect(result.weaknesses).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Chạy test để chắc chắn nó fail**

```bash
npx vitest run tests/parent-report.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/parent-report'`.

- [ ] **Step 3: Viết `lib/parent-report.ts`**

```ts
import { WEAKEST_MIN_ANSWERS, type GroupStat } from "@/lib/question-stats";
import { rankingScorePercent } from "@/lib/student-score";

// Tóm tắt tình hình học tập gửi cho phụ huynh. Cố tình KHÔNG phụ thuộc kiểu của
// Prisma để test được mà không cần DB, và để mail với trang web dùng chung đúng
// một bộ số liệu — không bao giờ lệch nhau.

export type ParentPeriod = "week" | "month";

const DAY_MS = 24 * 60 * 60 * 1000;
const PERIOD_DAYS: Record<ParentPeriod, number> = { week: 7, month: 30 };
const PERIOD_LABELS: Record<ParentPeriod, string> = { week: "7 ngày", month: "30 ngày" };

// Trạng thái coi là chưa nộp — khớp RecipientStatus trong schema.
const PENDING_STATUSES = new Set(["assigned", "in_progress"]);

// Chênh lệch tối thiểu (điểm %) để dám nói là "tăng"/"giảm". Dưới mức này coi như
// đi ngang, tránh báo phụ huynh những dao động vô nghĩa.
const TREND_MARGIN = 3;

const MAX_COMMENTS = 3;
const TOP_GROUPS = 2;

export type ParentReportItem = {
  assignmentTitle: string;
  skills: string[];
  assignedAt: Date;
  deadline: Date | null;
  status: string;
  submittedAt: Date | null;
  scorePercent: number | null;
  overallBand: number | null;
  reviewedAt: Date | null;
  summaryFeedback: string | null;
};

export type ParentComment = {
  assignmentTitle: string;
  band: number | null;
  feedback: string;
  reviewedAt: Date;
};

export type ParentTrend = "up" | "down" | "flat" | "unknown";

export type ParentSummary = {
  period: ParentPeriod;
  from: Date;
  to: Date;
  submittedCount: number;
  lateOrMissingCount: number;
  averagePercent: number | null;
  averageBand: number | null;
  trend: ParentTrend;
  headline: string;
  // Bài đã nộp trong kỳ, mới nhất trước.
  done: ParentReportItem[];
  // Bài chưa nộp và đã quá hạn, hạn gần nhất trước.
  pending: ParentReportItem[];
  comments: ParentComment[];
};

export function periodRange(now: Date, period: ParentPeriod): { from: Date; to: Date } {
  return {
    from: new Date(now.getTime() - PERIOD_DAYS[period] * DAY_MS),
    to: now
  };
}

function within(value: Date | null, from: Date, to: Date): boolean {
  if (!value) {
    return false;
  }

  const time = value.getTime();
  return time >= from.getTime() && time <= to.getTime();
}

// % đại diện cho một bài: Nghe/Đọc lấy điểm tự chấm, Viết/Nói quy band sang thang
// 100. Bài chưa chấm trả null để KHÔNG bị tính thành 0 kéo tụt trung bình.
function percentOf(item: ParentReportItem): number | null {
  return rankingScorePercent({
    scorePercent: item.scorePercent,
    overallBand: item.overallBand
  });
}

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function averagePercentIn(items: ParentReportItem[], from: Date, to: Date): number | null {
  const values: number[] = [];

  for (const item of items) {
    if (!within(item.submittedAt, from, to)) {
      continue;
    }

    const percent = percentOf(item);

    if (percent !== null) {
      values.push(percent);
    }
  }

  return average(values);
}

function computeTrend(current: number | null, previous: number | null): ParentTrend {
  if (current === null || previous === null) {
    return "unknown";
  }

  if (current - previous >= TREND_MARGIN) {
    return "up";
  }

  if (previous - current >= TREND_MARGIN) {
    return "down";
  }

  return "flat";
}

function buildHeadline(
  period: ParentPeriod,
  submittedCount: number,
  averagePercent: number | null,
  trend: ParentTrend,
  lateOrMissingCount: number
): string {
  const label = PERIOD_LABELS[period];
  let headline: string;

  if (submittedCount === 0) {
    headline = `Trong ${label} qua, con chưa hoàn thành bài nào.`;
  } else {
    const parts = [`Trong ${label} qua, con đã hoàn thành ${submittedCount} bài`];

    if (averagePercent !== null) {
      parts.push(`điểm trung bình ${Math.round(averagePercent)}%`);
    }

    if (trend === "up") {
      parts.push("tăng so với kỳ trước");
    } else if (trend === "down") {
      parts.push("giảm so với kỳ trước");
    }

    headline = `${parts.join(", ")}.`;
  }

  if (lateOrMissingCount > 0) {
    headline += ` Còn ${lateOrMissingCount} bài quá hạn chưa làm.`;
  }

  return headline;
}

export function buildParentSummary(
  items: ParentReportItem[],
  now: Date,
  period: ParentPeriod
): ParentSummary {
  const { from, to } = periodRange(now, period);
  const previousFrom = new Date(from.getTime() - PERIOD_DAYS[period] * DAY_MS);

  const done = items
    .filter((item) => within(item.submittedAt, from, to))
    .sort((a, b) => (b.submittedAt?.getTime() ?? 0) - (a.submittedAt?.getTime() ?? 0));

  // Nợ bài tính theo hiện tại chứ không theo kỳ: bài quá hạn từ tháng trước mà
  // vẫn chưa làm thì phụ huynh vẫn cần biết.
  const pending = items
    .filter(
      (item) =>
        PENDING_STATUSES.has(item.status) &&
        item.deadline !== null &&
        item.deadline.getTime() < now.getTime()
    )
    .sort((a, b) => (a.deadline?.getTime() ?? 0) - (b.deadline?.getTime() ?? 0));

  const averagePercent = averagePercentIn(items, from, to);
  const previousPercent = averagePercentIn(items, previousFrom, from);

  const bands = done
    .map((item) => item.overallBand)
    .filter((band): band is number => band !== null);

  const comments: ParentComment[] = items
    .filter(
      (item) =>
        within(item.reviewedAt, from, to) &&
        typeof item.summaryFeedback === "string" &&
        item.summaryFeedback.trim().length > 0
    )
    .sort((a, b) => (b.reviewedAt?.getTime() ?? 0) - (a.reviewedAt?.getTime() ?? 0))
    .slice(0, MAX_COMMENTS)
    .map((item) => ({
      assignmentTitle: item.assignmentTitle,
      band: item.overallBand,
      feedback: (item.summaryFeedback ?? "").trim(),
      // Đã lọc ở trên nên reviewedAt chắc chắn khác null.
      reviewedAt: item.reviewedAt as Date
    }));

  const trend = computeTrend(averagePercent, previousPercent);

  return {
    period,
    from,
    to,
    submittedCount: done.length,
    lateOrMissingCount: pending.length,
    averagePercent,
    averageBand: average(bands),
    trend,
    headline: buildHeadline(period, done.length, averagePercent, trend, pending.length),
    done,
    pending,
    comments
  };
}

// Kỳ nào con không học gì và cũng không nợ bài thì không gửi mail — phụ huynh
// nhận mail rỗng vài lần là bắt đầu bỏ qua tất cả mail của lớp.
export function shouldSendReport(summary: ParentSummary): boolean {
  return (
    summary.submittedCount > 0 ||
    summary.lateOrMissingCount > 0 ||
    summary.comments.length > 0
  );
}

// Nhóm dạng câu tốt nhất / kém nhất. Chỉ xét nhóm đủ dữ liệu, và không để một
// nhóm vừa là điểm mạnh vừa là điểm yếu khi học viên mới có ít nhóm.
export function pickStrengthsAndWeaknesses(stats: GroupStat[]): {
  strengths: GroupStat[];
  weaknesses: GroupStat[];
} {
  const eligible = stats.filter((stat) => stat.total >= WEAKEST_MIN_ANSWERS);
  const strengths = [...eligible].sort((a, b) => b.percent - a.percent).slice(0, TOP_GROUPS);
  const strongKeys = new Set(strengths.map((stat) => stat.key));
  const weaknesses = eligible
    .filter((stat) => !strongKeys.has(stat.key))
    .sort((a, b) => a.percent - b.percent)
    .slice(0, TOP_GROUPS);

  return { strengths, weaknesses };
}
```

- [ ] **Step 4: Chạy test cho tới khi xanh**

```bash
npx vitest run tests/parent-report.test.ts
```

Expected: PASS toàn bộ. Nếu test "bài Viết đã chấm quy band về thang 100" fail, kiểm lại `rankingScorePercent` trong `lib/student-score.ts` — nó chia band cho 9 rồi nhân 100.

- [ ] **Step 5: Commit**

```bash
git add lib/parent-report.ts tests/parent-report.test.ts
git commit -m "feat(phu-huynh): logic tom tat tinh hinh hoc tap"
```

---

### Task 3: Truy vấn — `lib/parent-report-query.ts`

**Files:**
- Create: `lib/parent-report-query.ts`

**Interfaces:**
- Consumes: `ParentReportItem` từ `@/lib/parent-report`; `StatAnswer`, `AttemptForSeries` từ `@/lib/question-stats`; `excludePracticeAssignment`, `countsForStats` từ `@/lib/practice`.
- Produces:
  - `type ParentStudent = { id: string; displayName: string; targetBand: number | null; className: string | null }`
  - `findStudentByParentToken(token: string): Promise<ParentStudent | null>`
  - `loadParentReportItems(studentId: string): Promise<ParentReportItem[]>`
  - `loadParentStatsData(studentId: string): Promise<{ series: AttemptForSeries[]; answers: StatAnswer[] }>`

Task này không có test riêng (chạm DB thật). Đúng đắn của nó được xác nhận ở Task 5 khi trang phụ huynh hiển thị dữ liệu, và ở bước kiểm trên Vercel cuối cùng.

- [ ] **Step 1: Viết `lib/parent-report-query.ts`**

```ts
import { prisma } from "@/lib/prisma";
import type { ParentReportItem } from "@/lib/parent-report";
import type { AttemptForSeries, StatAnswer } from "@/lib/question-stats";
import { countsForStats, excludePracticeAssignment } from "@/lib/practice";

// CỬA DUY NHẤT đọc DB cho tính năng báo cáo phụ huynh.
//
// QUY TẮC KHÔNG ĐƯỢC PHÁ: không select Question.content, Question.correctAnswerJson,
// Answer.value, AssignableUnit.content/transcript, AnswerAnnotation. Phụ huynh chỉ
// được thấy điểm số và nhận xét — link bị chuyển cho người ngoài cũng không lộ đề.

export type ParentStudent = {
  id: string;
  displayName: string;
  targetBand: number | null;
  className: string | null;
};

export async function findStudentByParentToken(token: string): Promise<ParentStudent | null> {
  if (!token.trim()) {
    return null;
  }

  const student = await prisma.studentProfile.findUnique({
    where: { parentToken: token },
    select: {
      id: true,
      displayName: true,
      targetBand: true,
      parentEmail: true,
      classes: {
        select: { class: { select: { name: true } } },
        orderBy: { joinedAt: "desc" },
        take: 1
      }
    }
  });

  // Xoá email phụ huynh = tắt báo cáo, link cũng ngưng hoạt động luôn.
  if (!student || !student.parentEmail?.trim()) {
    return null;
  }

  return {
    id: student.id,
    displayName: student.displayName,
    targetBand: student.targetBand,
    className: student.classes[0]?.class.name ?? null
  };
}

export async function loadParentReportItems(studentId: string): Promise<ParentReportItem[]> {
  const recipients = await prisma.assignmentRecipient.findMany({
    where: {
      studentId,
      assignment: excludePracticeAssignment
    },
    select: {
      status: true,
      assignedAt: true,
      submittedAt: true,
      assignment: {
        select: {
          title: true,
          deadline: true,
          units: {
            select: { assignableUnit: { select: { skill: true } } }
          }
        }
      },
      attempts: {
        where: countsForStats,
        select: {
          scorePercent: true,
          submittedAt: true,
          review: {
            select: {
              overallBand: true,
              summaryFeedback: true,
              reviewedAt: true
            }
          }
        },
        orderBy: { startedAt: "desc" },
        take: 1
      }
    },
    orderBy: { assignedAt: "desc" }
  });

  return recipients.map((recipient) => {
    const attempt = recipient.attempts[0] ?? null;

    return {
      assignmentTitle: recipient.assignment.title,
      skills: recipient.assignment.units.map((unit) => unit.assignableUnit.skill),
      assignedAt: recipient.assignedAt,
      deadline: recipient.assignment.deadline,
      status: recipient.status,
      submittedAt: recipient.submittedAt ?? attempt?.submittedAt ?? null,
      scorePercent: attempt?.scorePercent ?? null,
      overallBand: attempt?.review?.overallBand ?? null,
      reviewedAt: attempt?.review?.reviewedAt ?? null,
      summaryFeedback: attempt?.review?.summaryFeedback ?? null
    };
  });
}

export async function loadParentStatsData(studentId: string): Promise<{
  series: AttemptForSeries[];
  answers: StatAnswer[];
}> {
  // Cùng bộ lọc với trang "Tiến bộ" của học viên: chỉ bài đã nộp, chỉ lượt đầu.
  const attempts = await prisma.attempt.findMany({
    where: {
      studentId,
      status: { in: ["submitted", "reviewed"] },
      ...countsForStats
    },
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

  const series: AttemptForSeries[] = attempts.map((attempt) => ({
    title: attempt.assignmentRecipient.assignment.title,
    submittedAt: attempt.submittedAt ?? attempt.startedAt,
    answers: attempt.answers.map((answer) => ({
      isCorrect: answer.isCorrect,
      skill: answer.assignableUnit.skill
    }))
  }));

  const answers: StatAnswer[] = attempts.flatMap((attempt) =>
    attempt.answers.map((answer) => ({
      isCorrect: answer.isCorrect,
      skill: answer.assignableUnit.skill,
      questionType: answer.question?.questionType ?? null
    }))
  );

  return { series, answers };
}
```

- [ ] **Step 2: Kiểm biên dịch**

```bash
npx tsc --noEmit
```

Expected: không có lỗi trong `lib/parent-report-query.ts`. (Nếu báo `parentToken` không tồn tại trên `StudentProfileWhereUniqueInput`, chạy lại `npx prisma generate` — Task 1 Step 5.)

- [ ] **Step 3: Commit**

```bash
git add lib/parent-report-query.ts
git commit -m "feat(phu-huynh): truy van du lieu bao cao (khong cham de/dap an)"
```

---

### Task 4: Server action và khối "Phụ huynh" trong trang học viên

**Files:**
- Create: `lib/app-url.ts`
- Create: `lib/actions/parents.ts`
- Create: `components/parent-contact-block.tsx`
- Modify: `app/teacher/students/[studentId]/page.tsx`

**Interfaces:**
- Consumes: `requireTeacher` từ `@/lib/actions/classes`; `actionOk`/`actionFail`/`ActionResult` từ `@/lib/action-result`; `ActionForm`/`ActionSubmitButton` từ `@/components/action-form`.
- Produces:
  - `resolveAppUrl(): string` trong `lib/app-url.ts` — Task 6 và Task 7 dùng lại
  - `newParentToken(): string`
  - `saveParentContact(formData: FormData): Promise<ActionResult>` — nhận `studentId`, `parentName`, `parentEmail`
  - `regenerateParentToken(formData: FormData): Promise<ActionResult>` — nhận `studentId`
  - Component `ParentContactBlock` với props `{ studentId: string; parentName: string; parentEmail: string; parentLink: string | null; lastSentAt: Date | null }`

`sendParentReportNow` sẽ được thêm ở Task 6 — task này chưa có nút gửi.

- [ ] **Step 1: Viết `lib/app-url.ts`**

```ts
// Địa chỉ web thật, dùng để dựng link phụ huynh. Một chỗ duy nhất, để trang giáo
// viên, nút gửi tay và cron không sinh ra ba kiểu link khác nhau.
export function resolveAppUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3000";
}
```

- [ ] **Step 2: Viết `lib/actions/parents.ts`**

```ts
"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTeacher } from "@/lib/actions/classes";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { prisma } from "@/lib/prisma";

// Mã bí mật của link báo cáo. 24 byte ngẫu nhiên -> 32 ký tự base64url, đủ dài để
// không ai dò được bằng cách thử.
export function newParentToken(): string {
  return randomBytes(24).toString("base64url");
}

const contactSchema = z.object({
  studentId: z.string().min(1, "Thiếu mã học viên."),
  parentName: z.string().trim().max(120, "Tên phụ huynh quá dài."),
  parentEmail: z
    .string()
    .trim()
    .max(200, "Email quá dài.")
    .refine(
      (value) => value === "" || z.string().email().safeParse(value).success,
      "Email phụ huynh chưa hợp lệ."
    )
});

// Chỉ tìm học viên NẰM TRONG lớp của chính giáo viên đang đăng nhập — không tin
// studentId gửi lên từ form.
async function findOwnedStudent(teacherId: string, studentId: string) {
  const student = await prisma.studentProfile.findFirst({
    where: {
      id: studentId,
      classes: { some: { class: { teacherId } } }
    },
    select: { id: true, displayName: true, parentToken: true }
  });

  if (!student) {
    throw new Error("Không tìm thấy học viên trong lớp của bạn.");
  }

  return student;
}

export async function saveParentContact(formData: FormData): Promise<ActionResult> {
  const teacher = await requireTeacher(); // NGOÀI try: lỗi phân quyền ném ra như cũ

  try {
    const parsed = contactSchema.safeParse({
      studentId: formData.get("studentId"),
      parentName: formData.get("parentName") ?? "",
      parentEmail: formData.get("parentEmail") ?? ""
    });

    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Thông tin phụ huynh chưa hợp lệ.");
    }

    const student = await findOwnedStudent(teacher.id, parsed.data.studentId);
    const email = parsed.data.parentEmail;
    const name = parsed.data.parentName;

    await prisma.studentProfile.update({
      where: { id: student.id },
      data: {
        parentEmail: email === "" ? null : email,
        parentName: name === "" ? null : name,
        // Có email mà chưa có link thì sinh link luôn. Xoá email KHÔNG xoá token,
        // để nhập lại email là link cũ dùng tiếp được.
        parentToken:
          student.parentToken ?? (email === "" ? null : newParentToken())
      }
    });

    revalidatePath(`/teacher/students/${student.id}`);

    return actionOk(
      email === "" ? "Đã tắt báo cáo cho phụ huynh." : "Đã lưu liên hệ phụ huynh."
    );
  } catch (error) {
    return actionFail(error, "Lưu liên hệ phụ huynh");
  }
}

export async function regenerateParentToken(formData: FormData): Promise<ActionResult> {
  const teacher = await requireTeacher();

  try {
    const studentId = String(formData.get("studentId") ?? "").trim();

    if (!studentId) {
      throw new Error("Thiếu mã học viên.");
    }

    const student = await findOwnedStudent(teacher.id, studentId);

    await prisma.studentProfile.update({
      where: { id: student.id },
      data: { parentToken: newParentToken() }
    });

    revalidatePath(`/teacher/students/${student.id}`);

    return actionOk("Đã tạo link mới. Link cũ không dùng được nữa.");
  } catch (error) {
    return actionFail(error, "Tạo lại link");
  }
}
```

- [ ] **Step 3: Đọc `components/action-form.tsx` trước khi viết giao diện**

Mở file và ghi lại `ActionSubmitButton` nhận đúng những prop nào. Bước sau cần biết nó có nhận `onClick` hay không. Nếu KHÔNG nhận, dùng `ConfirmSubmitButton` (`@/components/confirm-submit-button`) cho nút "Tạo lại link" — component này đã được dùng sẵn trong `app/teacher/students/[studentId]/page.tsx` cho nút reset bài, xem cách nó nhận prop rồi làm theo.

- [ ] **Step 4: Viết `components/parent-contact-block.tsx`**

```tsx
"use client";

import { useState } from "react";
import { ActionForm, ActionSubmitButton } from "@/components/action-form";
import { regenerateParentToken, saveParentContact } from "@/lib/actions/parents";

type ParentContactBlockProps = {
  studentId: string;
  parentName: string;
  parentEmail: string;
  // Link đầy đủ để copy. Null khi chưa có email phụ huynh.
  parentLink: string | null;
  lastSentAt: Date | null;
};

function formatSentAt(value: Date | null): string {
  if (!value) {
    return "Chưa gửi lần nào";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    day: "numeric",
    month: "numeric",
    year: "numeric"
  }).format(value);
}

export function ParentContactBlock({
  studentId,
  parentName,
  parentEmail,
  parentLink,
  lastSentAt
}: ParentContactBlockProps) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    if (!parentLink) {
      return;
    }

    await navigator.clipboard.writeText(parentLink);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
      <div className="border-b border-border px-5 py-4">
        <h3 className="text-base font-semibold">Phụ huynh</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Có email thì mỗi trưa Chủ nhật hệ thống tự gửi báo cáo tình hình học tập.
          Để trống email là không gửi gì cả.
        </p>
      </div>

      <div className="space-y-4 px-5 py-4">
        <ActionForm action={saveParentContact} className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="studentId" value={studentId} />
          <label className="text-sm font-medium">
            Tên phụ huynh
            <input
              name="parentName"
              defaultValue={parentName}
              placeholder="VD: chị Lan"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm font-medium">
            Email phụ huynh
            <input
              name="parentEmail"
              type="email"
              defaultValue={parentEmail}
              placeholder="phuhuynh@gmail.com"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <div className="sm:col-span-2">
            <ActionSubmitButton>Lưu</ActionSubmitButton>
          </div>
        </ActionForm>

        {parentLink ? (
          <div className="space-y-3 rounded-lg border border-border bg-background px-4 py-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Link phụ huynh xem báo cáo
              </p>
              <p className="mt-1 break-all font-mono text-xs">{parentLink}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={copyLink}
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold transition hover:border-primary"
              >
                {copied ? "Đã chép" : "Chép link"}
              </button>
              <ActionForm action={regenerateParentToken}>
                <input type="hidden" name="studentId" value={studentId} />
                <ActionSubmitButton>Tạo lại link</ActionSubmitButton>
              </ActionForm>
            </div>
            <p className="text-xs text-muted-foreground">
              Mail gần nhất: {formatSentAt(lastSentAt)}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
```

Nút "Tạo lại link" phải hỏi xác nhận trước khi chạy. Dùng đúng component xác nhận đã ghi nhận ở Step 2: nếu `ActionSubmitButton` nhận `onClick`, truyền vào

```tsx
onClick={(event) => {
  if (
    !window.confirm(
      "Tạo link mới? Link cũ sẽ ngừng hoạt động ngay, phụ huynh phải dùng link mới."
    )
  ) {
    event.preventDefault();
  }
}}
```

còn nếu không thì thay `ActionSubmitButton` bằng `ConfirmSubmitButton` với đúng câu hỏi trên.

- [ ] **Step 5: Nối vào trang học viên**

Trong `app/teacher/students/[studentId]/page.tsx`:

1. Thêm import:

```ts
import { ParentContactBlock } from "@/components/parent-contact-block";
```

2. Truy vấn `prisma.studentProfile.findFirst` hiện dùng `include` nên các cột vô hướng (`parentEmail`, `parentName`, `parentToken`, `parentReportSentAt`) đã tự có sẵn trong kết quả — không cần sửa truy vấn.

3. Ngay trước `return`, tính link:

```ts
const parentLink =
  student.parentEmail && student.parentToken
    ? `${resolveAppUrl()}/ph/${student.parentToken}`
    : null;
```

kèm import `import { resolveAppUrl } from "@/lib/app-url";` ở đầu file.

4. Chèn component vào JSX, đặt ngay sau khối thông tin chung của học viên và trước bảng "bài tập & lần làm bài":

```tsx
<ParentContactBlock
  studentId={student.id}
  parentName={student.parentName ?? ""}
  parentEmail={student.parentEmail ?? ""}
  parentLink={parentLink}
  lastSentAt={student.parentReportSentAt}
/>
```

- [ ] **Step 6: Kiểm biên dịch và lint**

```bash
npx tsc --noEmit
```

Expected: không lỗi.

```bash
pnpm lint
```

Expected: không lỗi mới.

- [ ] **Step 7: Kiểm bằng mắt trên máy**

Khởi động preview qua công cụ preview (KHÔNG dùng `pnpm dev` trong terminal), đăng nhập `teacher@example.com` / `teacher123`, vào một trang học viên. Kiểm:
- Nhập tên + email rồi bấm Lưu → hiện toast xanh, link xuất hiện.
- Bấm "Chép link" → chữ đổi thành "Đã chép".
- Bấm "Tạo lại link" → hộp thoại xác nhận, đồng ý xong link đổi.
- Xoá trắng email rồi Lưu → toast "Đã tắt báo cáo", khối link biến mất.

Hai cái bẫy khi kiểm bằng công cụ trình duyệt: `window.confirm` gốc làm treo phiên điều khiển — ghi đè `window.confirm = () => true` trước khi bấm; và phải bấm rồi đọc DOM **trong cùng một lần chạy javascript_tool**, không thì toast đã tắt và kết luận sai là hỏng.

- [ ] **Step 8: Commit**

```bash
git add lib/app-url.ts lib/actions/parents.ts components/parent-contact-block.tsx "app/teacher/students/[studentId]/page.tsx"
git commit -m "feat(phu-huynh): nhap lien he phu huynh va sinh link bao cao"
```

---

### Task 5: Trang phụ huynh `/ph/[token]`

**Files:**
- Create: `app/ph/[token]/page.tsx`

**Interfaces:**
- Consumes: `findStudentByParentToken`, `loadParentReportItems`, `loadParentStatsData` từ `@/lib/parent-report-query`; `buildParentSummary`, `pickStrengthsAndWeaknesses`, `ParentReportItem` từ `@/lib/parent-report`; `buildProgressSeries`, `questionTypeStatsBySkill` từ `@/lib/question-stats`; `ProgressLineChart` từ `@/components/progress-line-chart`; `formatBand` từ `@/lib/band-score`; `SKILL_LABELS`, `distinctSkills` từ `@/lib/skills`.
- Produces: route công khai `/ph/<token>`. Không có export nào cho task khác dùng.

- [ ] **Step 1: Kiểm trang không dính guard đăng nhập**

Xem có `middleware.ts` ở gốc repo không:

```bash
ls middleware.ts
```

Nếu có, đọc `config.matcher` của nó. Nếu matcher chặn theo kiểu "chặn hết trừ vài đường dẫn", thêm `ph` vào danh sách loại trừ. Nếu nó chỉ liệt kê `/teacher`, `/student` thì không phải sửa gì.

- [ ] **Step 2: Viết trang**

Tạo `app/ph/[token]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProgressLineChart } from "@/components/progress-line-chart";
import { formatBand } from "@/lib/band-score";
import {
  buildParentSummary,
  pickStrengthsAndWeaknesses,
  type ParentReportItem
} from "@/lib/parent-report";
import {
  findStudentByParentToken,
  loadParentReportItems,
  loadParentStatsData
} from "@/lib/parent-report-query";
import { buildProgressSeries, questionTypeStatsBySkill } from "@/lib/question-stats";
import { distinctSkills, SKILL_LABELS } from "@/lib/skills";

// Trang công khai theo link bí mật — không được để công cụ tìm kiếm đánh chỉ mục.
export const metadata: Metadata = {
  robots: { index: false, follow: false }
};

// Dữ liệu thay đổi mỗi khi cô chấm bài; không cache.
export const dynamic = "force-dynamic";

type ParentPageProps = {
  params: { token: string };
};

const DATE_FORMAT = new Intl.DateTimeFormat("vi-VN", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  timeZone: "Asia/Ho_Chi_Minh"
});

function formatDate(value: Date | null): string {
  return value ? DATE_FORMAT.format(value) : "—";
}

function skillsLabel(skills: string[]): string {
  return distinctSkills(skills)
    .map((skill) => SKILL_LABELS[skill] ?? skill)
    .join(", ");
}

// Điểm hiển thị cho một bài: Nghe/Đọc ra %, Viết/Nói ra band, chưa chấm ghi rõ.
function scoreLabel(item: ParentReportItem): string {
  if (item.scorePercent !== null) {
    return `${Math.round(item.scorePercent)}%`;
  }

  if (item.overallBand !== null) {
    return `Band ${formatBand(item.overallBand)}`;
  }

  return "Chờ cô chấm";
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-card">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
    </div>
  );
}

export default async function ParentReportPage({ params }: ParentPageProps) {
  const student = await findStudentByParentToken(params.token);

  if (!student) {
    notFound();
  }

  const [items, stats] = await Promise.all([
    loadParentReportItems(student.id),
    loadParentStatsData(student.id)
  ]);

  const summary = buildParentSummary(items, new Date(), "month");
  const series = buildProgressSeries(stats.series);
  const groups = questionTypeStatsBySkill(stats.answers);
  const { strengths, weaknesses } = pickStrengthsAndWeaknesses(groups.all);

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 text-[15px]">
      <header>
        <p className="text-sm font-semibold text-primary">Báo cáo học tập</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
          {student.displayName}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {student.className ? `Lớp ${student.className}` : "Chưa xếp lớp"}
          {student.targetBand !== null
            ? ` · Mục tiêu band ${formatBand(student.targetBand)}`
            : ""}
        </p>
        <p className="mt-3 rounded-lg bg-muted px-4 py-3 text-sm leading-6">{summary.headline}</p>
      </header>

      <section className="grid grid-cols-2 gap-3">
        <StatCard label="Bài đã hoàn thành (30 ngày)" value={String(summary.submittedCount)} />
        <StatCard label="Bài quá hạn chưa làm" value={String(summary.lateOrMissingCount)} />
        <StatCard
          label="Điểm trung bình"
          value={summary.averagePercent === null ? "—" : `${Math.round(summary.averagePercent)}%`}
        />
        <StatCard
          label="Band Viết/Nói gần đây"
          value={summary.averageBand === null ? "—" : formatBand(summary.averageBand)}
        />
      </section>

      {series.listening.length > 0 || series.reading.length > 0 ? (
        <section className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-base font-semibold">Tiến bộ theo thời gian</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Tỷ lệ câu đúng của các bài Nghe và Đọc đã nộp.
            </p>
          </div>
          <ProgressLineChart listening={series.listening} reading={series.reading} />
        </section>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold">Các bài đã làm</h2>
        </div>
        {summary.done.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">
            Chưa có bài nào được nộp trong 30 ngày qua.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {summary.done.map((item, index) => (
              <li key={`${item.assignmentTitle}-${index}`} className="px-5 py-3">
                <p className="font-medium">{item.assignmentTitle}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {skillsLabel(item.skills)} · nộp {formatDate(item.submittedAt)} ·{" "}
                  <span className="font-semibold text-foreground">{scoreLabel(item)}</span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {summary.pending.length > 0 ? (
        <section className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-base font-semibold">Bài quá hạn chưa làm</h2>
          </div>
          <ul className="divide-y divide-border">
            {summary.pending.map((item, index) => (
              <li key={`${item.assignmentTitle}-${index}`} className="px-5 py-3">
                <p className="font-medium">{item.assignmentTitle}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {skillsLabel(item.skills)} · hạn {formatDate(item.deadline)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {summary.comments.length > 0 ? (
        <section className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-base font-semibold">Nhận xét của giáo viên</h2>
          </div>
          <ul className="divide-y divide-border">
            {summary.comments.map((comment, index) => (
              <li key={`${comment.assignmentTitle}-${index}`} className="px-5 py-4">
                <p className="text-sm font-medium">
                  {comment.assignmentTitle}
                  {comment.band !== null ? ` · Band ${formatBand(comment.band)}` : ""}
                </p>
                <p className="mt-1 whitespace-pre-line text-sm leading-6">{comment.feedback}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {strengths.length > 0 || weaknesses.length > 0 ? (
        <section className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-base font-semibold">Dạng câu làm tốt và cần luyện thêm</h2>
          </div>
          <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Làm tốt
              </p>
              <ul className="mt-2 space-y-1 text-sm">
                {strengths.map((stat) => (
                  <li key={stat.key}>
                    {stat.label} — {stat.percent}%
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Cần luyện thêm
              </p>
              <ul className="mt-2 space-y-1 text-sm">
                {weaknesses.map((stat) => (
                  <li key={stat.key}>
                    {stat.label} — {stat.percent}%
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      ) : null}

      <footer className="pb-8 text-center text-xs text-muted-foreground">
        Trang này chỉ dành riêng cho phụ huynh, vui lòng không chia sẻ đường link.
      </footer>
    </main>
  );
}
```

- [ ] **Step 3: Kiểm biên dịch**

```bash
npx tsc --noEmit
```

Expected: không lỗi.

- [ ] **Step 4: Kiểm bằng mắt**

Lấy link ở trang học viên (Task 4), mở trong cửa sổ ẩn danh (không có phiên đăng nhập). Kiểm:
- Trang hiện đúng tên học viên, có số liệu.
- Sửa một ký tự trong token → ra trang 404.
- Xoá email phụ huynh ở trang giáo viên → mở lại link cũ ra 404.
- Thu nhỏ cửa sổ về khổ điện thoại (375px) → không bị tràn ngang.

- [ ] **Step 5: Commit**

```bash
git add "app/ph/[token]/page.tsx"
git commit -m "feat(phu-huynh): trang bao cao chi-doc theo link bi mat"
```

---

### Task 6: Soạn mail và nút gửi tay

**Files:**
- Create: `lib/parent-report-email.ts`
- Modify: `lib/actions/parents.ts`
- Modify: `components/parent-contact-block.tsx`
- Test: `tests/parent-report.test.ts`

**Interfaces:**
- Consumes: `resolveAppUrl` từ `@/lib/app-url` (đã tạo ở Task 4); `ParentSummary`, `ParentReportItem` từ `@/lib/parent-report`; `sendEmail`, `isEmailConfigured` từ `@/lib/email`; `formatBand` từ `@/lib/band-score`; `SKILL_LABELS`, `distinctSkills` từ `@/lib/skills`.
- Produces:
  - `type ParentEmailInput = { studentName: string; parentName: string | null; summary: ParentSummary; link: string }`
  - `buildParentReportEmail(input: ParentEmailInput): { subject: string; text: string; html: string }`
  - `sendParentReportNow(formData: FormData): Promise<ActionResult>` — nhận `studentId`, `period` (`"week"` | `"month"`)

`resolveAppUrl` cố tình nằm ở `lib/app-url.ts` chứ không ở `lib/actions/parents.ts`, vì Task 7 (route handler) cũng cần nó mà file kia là `"use server"` — chỉ được export hàm async từ đó.

- [ ] **Step 1: Thêm test soạn mail (sẽ fail)**

Thêm `buildParentReportEmail` vào cụm import ở đầu `tests/parent-report.test.ts`:

```ts
import { buildParentReportEmail } from "@/lib/parent-report-email";
```

rồi thêm vào cuối file:

```ts
describe("buildParentReportEmail", () => {
  const summary = buildParentSummary(
    [
      item({ assignmentTitle: "Cam 20 Test 1 — Reading", scorePercent: 75 }),
      item({
        assignmentTitle: "Writing Task 2 tuần 3",
        skills: ["writing"],
        scorePercent: null,
        overallBand: 6,
        status: "reviewed",
        reviewedAt: daysAgo(1),
        summaryFeedback: "Ý tốt, cần chú ý ngữ pháp thì."
      })
    ],
    NOW,
    "week"
  );

  const mail = buildParentReportEmail({
    studentName: "Minh Anh",
    parentName: "chị Lan",
    summary,
    link: "https://example.com/ph/abc123"
  });

  it("tiêu đề nhắc tên học sinh", () => {
    expect(mail.subject).toContain("Minh Anh");
  });

  it("bản chữ thuần có link xem chi tiết", () => {
    expect(mail.text).toContain("https://example.com/ph/abc123");
  });

  it("bản HTML có nút xem chi tiết", () => {
    expect(mail.html).toContain("https://example.com/ph/abc123");
    expect(mail.html).toContain("Xem chi tiết");
  });

  it("liệt kê bài đã làm kèm điểm", () => {
    expect(mail.text).toContain("Cam 20 Test 1 — Reading");
    expect(mail.text).toContain("75%");
  });

  it("có nhận xét của cô", () => {
    expect(mail.text).toContain("Ý tốt, cần chú ý ngữ pháp thì.");
  });

  it("xưng hô theo tên phụ huynh", () => {
    expect(mail.text).toContain("chị Lan");
  });

  it("không có tên phụ huynh thì dùng câu chào chung", () => {
    const anonymous = buildParentReportEmail({
      studentName: "Minh Anh",
      parentName: null,
      summary,
      link: "https://example.com/ph/abc123"
    });

    expect(anonymous.text).toContain("Kính gửi phụ huynh");
  });

  it("escape ký tự HTML trong tên bài", () => {
    const risky = buildParentReportEmail({
      studentName: "Minh Anh",
      parentName: null,
      summary: buildParentSummary(
        [item({ assignmentTitle: "Bài <b>1</b> & 2", scorePercent: 50 })],
        NOW,
        "week"
      ),
      link: "https://example.com/ph/abc123"
    });

    expect(risky.html).toContain("&lt;b&gt;");
    expect(risky.html).toContain("&amp;");
  });
});
```

- [ ] **Step 2: Chạy test để chắc chắn nó fail**

```bash
npx vitest run tests/parent-report.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/parent-report-email'`.

- [ ] **Step 3: Viết `lib/parent-report-email.ts`**

```ts
import { formatBand } from "@/lib/band-score";
import type { ParentReportItem, ParentSummary } from "@/lib/parent-report";
import { distinctSkills, SKILL_LABELS } from "@/lib/skills";

// Soạn mail báo cáo gửi phụ huynh. Hàm thuần — số liệu đã được tính sẵn ở
// lib/parent-report.ts, ở đây chỉ lo diễn đạt.

export type ParentEmailInput = {
  studentName: string;
  parentName: string | null;
  summary: ParentSummary;
  link: string;
};

// Tên bài do giáo viên tự đặt nên có thể chứa <, &, " — phải escape trước khi
// nhúng vào HTML, không thì mail vỡ cấu trúc.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const DATE_FORMAT = new Intl.DateTimeFormat("vi-VN", {
  day: "numeric",
  month: "numeric",
  timeZone: "Asia/Ho_Chi_Minh"
});

function skillsLabel(skills: string[]): string {
  return distinctSkills(skills)
    .map((skill) => SKILL_LABELS[skill] ?? skill)
    .join(", ");
}

function scoreLabel(item: ParentReportItem): string {
  if (item.scorePercent !== null) {
    return `${Math.round(item.scorePercent)}%`;
  }

  if (item.overallBand !== null) {
    return `Band ${formatBand(item.overallBand)}`;
  }

  return "chờ cô chấm";
}

function greeting(parentName: string | null): string {
  const name = parentName?.trim();
  return name ? `Kính gửi ${name},` : "Kính gửi phụ huynh,";
}

function htmlList(lines: string[]): string {
  return `<ul style="padding-left:20px;margin:0">${lines
    .map((line) => `<li style="margin:0 0 8px">${escapeHtml(line)}</li>`)
    .join("")}</ul>`;
}

function htmlSection(title: string, lines: string[]): string {
  if (lines.length === 0) {
    return "";
  }

  return `<h3 style="margin:24px 0 8px;font-size:15px">${escapeHtml(title)}</h3>${htmlList(lines)}`;
}

export function buildParentReportEmail(input: ParentEmailInput): {
  subject: string;
  text: string;
  html: string;
} {
  const { studentName, parentName, summary, link } = input;
  const periodLabel = summary.period === "week" ? "tuần" : "tháng";
  const subject = `Báo cáo học tập ${periodLabel} của ${studentName}`;

  const doneLines = summary.done.map(
    (item) => `${item.assignmentTitle} (${skillsLabel(item.skills)}) — ${scoreLabel(item)}`
  );

  const pendingLines = summary.pending.map(
    (item) =>
      `${item.assignmentTitle} — hạn ${item.deadline ? DATE_FORMAT.format(item.deadline) : "không rõ"}`
  );

  const commentLines = summary.comments.map(
    (comment) =>
      `${comment.assignmentTitle}${comment.band !== null ? ` (Band ${formatBand(comment.band)})` : ""}: ${comment.feedback}`
  );

  function textSection(title: string, lines: string[]): string[] {
    return lines.length === 0 ? [] : ["", `${title}:`, ...lines.map((line) => `• ${line}`)];
  }

  const text = [
    greeting(parentName),
    "",
    summary.headline,
    ...textSection("Các bài đã làm", doneLines),
    ...textSection("Bài quá hạn chưa làm", pendingLines),
    ...textSection("Nhận xét của giáo viên", commentLines),
    "",
    `Xem chi tiết: ${link}`,
    "",
    "Mail này được gửi tự động từ lớp IELTS. Phụ huynh có thể trả lời mail này để liên hệ với giáo viên."
  ].join("\n");

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#0f172a">
  <p>${escapeHtml(greeting(parentName))}</p>
  <p>${escapeHtml(summary.headline)}</p>
  ${htmlSection("Các bài đã làm", doneLines)}
  ${htmlSection("Bài quá hạn chưa làm", pendingLines)}
  ${htmlSection("Nhận xét của giáo viên", commentLines)}
  <p style="margin:24px 0"><a href="${escapeHtml(link)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:8px">Xem chi tiết tình hình học tập</a></p>
  <p style="color:#64748b;font-size:13px">Mail này được gửi tự động từ lớp IELTS. Phụ huynh có thể trả lời mail này để liên hệ với giáo viên.</p>
</div>`;

  return { subject, text, html };
}
```

- [ ] **Step 4: Chạy test cho tới khi xanh**

```bash
npx vitest run tests/parent-report.test.ts
```

Expected: PASS toàn bộ.

- [ ] **Step 5: Thêm action `sendParentReportNow`**

Bổ sung import ở đầu `lib/actions/parents.ts`:

```ts
import { resolveAppUrl } from "@/lib/app-url";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { buildParentSummary, type ParentPeriod } from "@/lib/parent-report";
import { loadParentReportItems } from "@/lib/parent-report-query";
import { buildParentReportEmail } from "@/lib/parent-report-email";
```

rồi thêm vào cuối file:

```ts
export async function sendParentReportNow(formData: FormData): Promise<ActionResult> {
  const teacher = await requireTeacher();

  try {
    if (!isEmailConfigured()) {
      throw new Error("Chưa cấu hình GMAIL_USER / GMAIL_APP_PASSWORD.");
    }

    const studentId = String(formData.get("studentId") ?? "").trim();
    const period: ParentPeriod = formData.get("period") === "month" ? "month" : "week";

    if (!studentId) {
      throw new Error("Thiếu mã học viên.");
    }

    // Chặn quyền trước, rồi mới đọc thêm các cột cần cho mail.
    await findOwnedStudent(teacher.id, studentId);

    const student = await prisma.studentProfile.findUnique({
      where: { id: studentId },
      select: {
        displayName: true,
        parentEmail: true,
        parentName: true,
        parentToken: true
      }
    });

    if (!student?.parentEmail?.trim() || !student.parentToken) {
      throw new Error("Học viên này chưa có email phụ huynh.");
    }

    const items = await loadParentReportItems(studentId);
    const summary = buildParentSummary(items, new Date(), period);
    const mail = buildParentReportEmail({
      studentName: student.displayName,
      parentName: student.parentName,
      summary,
      link: `${resolveAppUrl()}/ph/${student.parentToken}`
    });

    await sendEmail(student.parentEmail, mail.subject, mail.html, mail.text);

    // CỐ TÌNH không cập nhật parentReportSentAt: gửi tay không được làm lỡ mail
    // tự động trưa Chủ nhật.
    return actionOk(`Đã gửi báo cáo tới ${student.parentEmail}.`);
  } catch (error) {
    return actionFail(error, "Gửi báo cáo");
  }
}
```

- [ ] **Step 6: Thêm nút gửi vào khối phụ huynh**

Trong `components/parent-contact-block.tsx`, thêm `sendParentReportNow` vào dòng import từ `@/lib/actions/parents`, rồi chèn form này vào trong nhánh `parentLink ? (...)`, ngay dưới hàng nút "Chép link" / "Tạo lại link":

```tsx
<ActionForm action={sendParentReportNow} className="flex flex-wrap items-center gap-2">
  <input type="hidden" name="studentId" value={studentId} />
  <select
    name="period"
    defaultValue="week"
    className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
  >
    <option value="week">7 ngày qua</option>
    <option value="month">30 ngày qua</option>
  </select>
  <ActionSubmitButton>Gửi báo cáo ngay</ActionSubmitButton>
</ActionForm>
```

- [ ] **Step 7: Kiểm biên dịch và chạy toàn bộ test**

```bash
npx tsc --noEmit
```

Expected: không lỗi.

```bash
pnpm test
```

Expected: PASS toàn bộ.

- [ ] **Step 8: Commit**

```bash
git add lib/parent-report-email.ts lib/actions/parents.ts components/parent-contact-block.tsx tests/parent-report.test.ts
git commit -m "feat(phu-huynh): soan mail bao cao va nut gui tay"
```

---

### Task 7: Cron gửi mail Chủ nhật

**Files:**
- Create: `app/api/cron/parent-reports/route.ts`
- Modify: `vercel.json`

**Interfaces:**
- Consumes: `resolveAppUrl` từ `@/lib/app-url`; `warmUpDatabase` từ `@/lib/db-warmup`; `isEmailConfigured`, `sendEmail` từ `@/lib/email`; `buildParentSummary`, `shouldSendReport` từ `@/lib/parent-report`; `loadParentReportItems` từ `@/lib/parent-report-query`; `buildParentReportEmail` từ `@/lib/parent-report-email`.
- Produces: endpoint `GET /api/cron/parent-reports`.

- [ ] **Step 1: Viết route**

Tạo `app/api/cron/parent-reports/route.ts`:

```ts
import { NextResponse } from "next/server";
import { resolveAppUrl } from "@/lib/app-url";
import { warmUpDatabase } from "@/lib/db-warmup";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { buildParentSummary, shouldSendReport } from "@/lib/parent-report";
import { buildParentReportEmail } from "@/lib/parent-report-email";
import { loadParentReportItems } from "@/lib/parent-report-query";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Đủ chỗ cho vài lần chờ DB Neon tỉnh dậy (xem warmUpDatabase).
export const maxDuration = 60;

// Chạy 12h trưa Chủ nhật giờ VN (0 5 * * 0 UTC). Vercel có thể gọi lặp, nên phải
// dựa vào parentReportSentAt để không gửi hai lần trong cùng một tuần.
const RESEND_GUARD_MS = 6 * 24 * 60 * 60 * 1000;

export async function GET(request: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;

  // Mặc định đóng: chưa đặt CRON_SECRET thì không ai gọi được, kể cả Vercel.
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isEmailConfigured()) {
    return NextResponse.json({ skipped: "Chưa cấu hình email." });
  }

  await warmUpDatabase();

  const now = new Date();
  const guard = new Date(now.getTime() - RESEND_GUARD_MS);

  const students = await prisma.studentProfile.findMany({
    where: {
      parentEmail: { not: null },
      parentToken: { not: null },
      OR: [{ parentReportSentAt: null }, { parentReportSentAt: { lt: guard } }]
    },
    select: {
      id: true,
      displayName: true,
      parentEmail: true,
      parentName: true,
      parentToken: true
    }
  });

  const appUrl = resolveAppUrl();
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const student of students) {
    if (!student.parentEmail || !student.parentToken) {
      skipped += 1;
      continue;
    }

    try {
      const items = await loadParentReportItems(student.id);
      const summary = buildParentSummary(items, now, "week");

      // Tuần không học gì và cũng không nợ bài -> không gửi mail rỗng.
      if (!shouldSendReport(summary)) {
        skipped += 1;
        continue;
      }

      const mail = buildParentReportEmail({
        studentName: student.displayName,
        parentName: student.parentName,
        summary,
        link: `${appUrl}/ph/${student.parentToken}`
      });

      await sendEmail(student.parentEmail, mail.subject, mail.html, mail.text);

      // Chỉ ghi mốc SAU khi gửi thành công, để lần chạy sau còn thử lại.
      await prisma.studentProfile.update({
        where: { id: student.id },
        data: { parentReportSentAt: new Date() }
      });

      sent += 1;
    } catch (error) {
      // Một học viên lỗi không được làm hỏng cả lượt chạy.
      failed += 1;
      console.error(
        "[cron/parent-reports] Gửi thất bại cho học viên",
        student.id,
        String(error instanceof Error ? error.message : error)
      );
    }
  }

  return NextResponse.json({ sent, skipped, failed, total: students.length });
}
```

- [ ] **Step 2: Thêm lịch cron**

Sửa `vercel.json` thành:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "regions": ["sin1"],
  "crons": [
    { "path": "/api/cron/reminders", "schedule": "0 5 * * *" },
    { "path": "/api/cron/parent-reports", "schedule": "0 5 * * 0" }
  ]
}
```

Gói Vercel Hobby cho tối đa 2 cron — sau thay đổi này là 2/2, đã kịch trần.

- [ ] **Step 3: Kiểm biên dịch và build**

```bash
npx tsc --noEmit
```

Expected: không lỗi.

```bash
pnpm build
```

Expected: build thành công, log có dòng `[ensure-db] OK`.

- [ ] **Step 4: Gọi thử cron trên máy**

Đọc `CRON_SECRET` trong `.env`, khởi động preview, rồi gọi (thay `<secret>` bằng giá trị thật):

```bash
curl -s -H "Authorization: Bearer <secret>" http://localhost:3000/api/cron/parent-reports
```

Expected: JSON dạng `{"sent":0,"skipped":N,"failed":0,"total":N}`.

Gọi lại không kèm header:

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/cron/parent-reports
```

Expected: `401`.

- [ ] **Step 5: Commit và đẩy lên**

```bash
git add "app/api/cron/parent-reports/route.ts" vercel.json
git commit -m "feat(phu-huynh): cron gui mail bao cao hang tuan"
git push origin feature/ielts-platform-mvp
```

- [ ] **Step 6: Kiểm trên production**

Sau khi Vercel deploy xong:
1. Vào trang một học viên thật trên prod, nhập email phụ huynh (dùng email của chính cô để thử), bấm **Gửi báo cáo ngay**.
2. Kiểm hộp thư: mail có tới không, nút "Xem chi tiết" bấm có ra đúng trang không.
3. Mở link trong cửa sổ ẩn danh — phải xem được mà không cần đăng nhập.
4. Đổi một ký tự trong link — phải ra 404.
5. Trên Neon prod, kiểm 4 cột mới đã tồn tại trên bảng `StudentProfile` và có unique index `StudentProfile_parentToken_key`.

---

## Kiểm lại kế hoạch so với đặc tả

| Mục trong spec | Task |
| --- | --- |
| 4 cột `StudentProfile` + `ensure-db` + unique index | 1 |
| `lib/parent-report.ts` hàm thuần, `shouldSendReport`, điểm mạnh/yếu | 2 |
| `lib/parent-report-query.ts` là cửa duy nhất đọc DB, không chạm đề/đáp án | 3 |
| 3 server action + giao diện giáo viên | 4 (2 action) và 6 (`sendParentReportNow`) |
| Trang `/ph/[token]` chỉ-đọc, noindex, 404 khi sai token | 5 |
| `lib/parent-report-email.ts` + nút gửi tay | 6 |
| Cron + `vercel.json` + `CRON_SECRET` + `warmUpDatabase` | 7 |
| Test vitest (logic, mail, cấu trúc schema) | 1, 2, 6 |
