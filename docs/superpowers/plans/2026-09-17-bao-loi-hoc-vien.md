# Nút báo lỗi cho học viên — Kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Học viên bấm một nút trên mọi trang (kể cả màn làm bài) để báo lỗi kèm ảnh + ngữ cảnh tự động; giáo viên nhận mail, xem/đánh dấu đã xử lý ở `/teacher/bugs`; học viên thấy trạng thái qua chuông + `/student/bugs`.

**Architecture:** Bảng mới `BugReport` (Prisma, tự tạo trên prod qua `scripts/ensure-db.mjs`). Logic thuần ở `lib/bug-report.ts`; server actions ở `lib/actions/bug-reports.ts`; ảnh lên Vercel Blob qua route `app/api/student/bug-image`. UI học viên = React context nhỏ + hộp thoại portal trong `AppShell`; màn làm bài đăng ký ngữ cảnh (attemptId/part/bước) và tự đặt nút trong header của nó. Chuông thông báo thêm nguồn thứ 3 `bug_resolved` theo cơ chế suy-ra-từ-dữ-liệu sẵn có.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript strict, Prisma + Postgres (Neon), zod, Tailwind, Vercel Blob, nodemailer (Gmail) qua `lib/email.ts`, vitest.

Spec: `docs/superpowers/specs/2026-09-17-bao-loi-hoc-vien-design.md`

## Global Constraints

- Mọi chuỗi hiện cho người dùng và mọi comment trong code viết **tiếng Việt có dấu**.
- Server action: student bắt đầu bằng `requireStudent()` (`lib/actions/attempts.ts`), teacher bằng `requireTeacher()` (`lib/actions/classes.ts`). Trang `app/teacher/**/page.tsx` dùng `requireTeacherPage()`.
- String-enum mới (`category`, `status`) phải có mặt ở 3 nơi: comment đầu `prisma/schema.prisma`, `z.enum` trong action, test cấu trúc.
- Bảng mới phải có câu `CREATE TABLE IF NOT EXISTS` trong `scripts/ensure-db.mjs` (quên = prod crash).
- Truy vấn bảng mới ở trang/route đã có phải bọc `try/catch` để thiếu bảng trên prod không làm vỡ trang.
- Không thêm dependency. Không dùng API mới hơn browserslist (iOS/Safari ≥ 15.6, Chrome ≥ 90).
- Trang giáo viên dùng `select`, không `include`.
- Mô tả/phản hồi render dạng text (`whitespace-pre-wrap`), không `dangerouslySetInnerHTML`; mail escape HTML.
- Giới hạn: mô tả ≤ 1000 ký tự, phản hồi GV ≤ 500, ảnh ≤ 1MB (PNG/JPG/WEBP, không SVG), 10 báo lỗi / học viên / 24h.
- Commit sau mỗi task, message tiếng Việt không dấu theo kiểu repo (`feat(bao-loi): ...`), kết thúc bằng dòng `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Sau khi sửa `prisma/schema.prisma`: chạy `npx prisma db push` (áp lên DB dev Neon trong `.env`, KHÔNG phải prod). Nếu `prisma generate` báo `EPERM` vì dev server đang chạy thì dừng server (`preview_stop`) rồi chạy lại.

---

## Cấu trúc file

| File | Trách nhiệm |
|---|---|
| `prisma/schema.prisma` (sửa) | model `BugReport`, quan hệ `StudentProfile.bugReports`, comment enum |
| `scripts/ensure-db.mjs` (sửa) | tạo bảng + index + FK trên prod |
| `lib/bug-report.ts` (mới) | hằng số, nhãn loại lỗi, `describeDevice`, `parseBugContext`/`formatBugContext`, `isOverDailyLimit`, `isAllowedBugImageUrl`, `buildBugReportEmail` — **không import prisma** |
| `lib/notifications.ts` (sửa) | thêm loại `bug_resolved` + nguồn thứ 3 |
| `lib/notifications-feed.ts` (sửa) | query `BugReport` đã xử lý (try/catch) |
| `components/notification-list.tsx` (sửa) | nhãn loại mới |
| `app/api/student/bug-image/route.ts` (mới) | upload ảnh chụp màn hình (student) |
| `lib/actions/bug-reports.ts` (mới) | `createBugReport`, `resolveBugReport`, `reopenBugReport` + gửi mail |
| `components/bug-report-context.tsx` (mới) | context: ngữ cảnh bài làm + trạng thái mở/đóng hộp thoại; hook an toàn khi không có provider |
| `components/bug-report-dialog.tsx` (mới) | hộp thoại (portal), thu nhỏ + upload ảnh, gọi action |
| `components/bug-report-button.tsx` (mới) | `BugReportFloatingButton` (nút nổi) + `BugReportInlineTrigger` (nút trong header màn làm bài) + `BugIcon` |
| `components/app-shell.tsx` (sửa) | bọc provider + nút nổi + hộp thoại cho student; mục menu "Báo lỗi" cho teacher; icon `bug` |
| `components/attempt-workspace.tsx` (sửa) | đăng ký ngữ cảnh + nút inline trong header |
| `app/student/bugs/page.tsx` (mới) | danh sách báo lỗi của học viên |
| `app/teacher/bugs/page.tsx` (mới) | danh sách + xử lý |
| `components/bug-report-teacher-row.tsx` (mới) | một dòng báo lỗi phía GV (client, dùng `ActionForm`) |
| `app/teacher/page.tsx` (sửa) | thẻ "Báo lỗi mới" |
| `tests/bug-report.test.ts` (mới) | logic thuần + cấu trúc schema/ensure-db |
| `tests/notifications.test.ts` (sửa) | nguồn `bug_resolved` |

---

### Task 1: Bảng `BugReport` (schema + ensure-db + test cấu trúc)

**Files:**
- Modify: `prisma/schema.prisma` (khối comment dòng 10–17; model `StudentProfile` ~dòng 60–97; thêm model cuối file)
- Modify: `scripts/ensure-db.mjs` (sau dòng `'ALTER TABLE "CommentSnippet" ADD COLUMN IF NOT EXISTS "criterion" TEXT;'`)
- Test: `tests/bug-report.test.ts`

**Interfaces:**
- Produces: Prisma model `prisma.bugReport` với các cột `id, studentId, category, description, imageUrl, pageUrl, userAgent, viewport, attemptId, contextJson, status, teacherNote, resolvedAt, createdAt`; quan hệ `student`.

- [ ] **Step 1: Viết test cấu trúc (fail)**

Tạo `tests/bug-report.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("lược đồ BugReport", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");

  it("có model BugReport với đủ cột", () => {
    const start = schema.indexOf("model BugReport");
    expect(start).toBeGreaterThan(-1);
    const model = schema.slice(start);
    for (const column of [
      "studentId",
      "category",
      "description",
      "imageUrl",
      "pageUrl",
      "userAgent",
      "viewport",
      "attemptId",
      "contextJson",
      "teacherNote",
      "resolvedAt",
      "createdAt"
    ]) {
      expect(model).toContain(column);
    }
    expect(model).toMatch(/status\s+String\s+@default\("open"\)/);
    expect(model).toContain("onDelete: Cascade");
  });

  it("StudentProfile có quan hệ bugReports", () => {
    const model = schema.slice(
      schema.indexOf("model StudentProfile"),
      schema.indexOf("model Class")
    );
    expect(model).toMatch(/bugReports\s+BugReport\[\]/);
  });

  it("comment đầu schema liệt kê giá trị category và status", () => {
    expect(schema).toContain("audio | answer | display | other");
    expect(schema).toContain("open | resolved");
  });

  // Quên câu này là prod 500: Prisma Client không kiểm schema lúc chạy, lỗi chỉ
  // lộ khi có request đụng đúng bảng còn thiếu.
  it("ensure-db.mjs tạo bảng BugReport", () => {
    const script = readFileSync("scripts/ensure-db.mjs", "utf8");
    expect(script).toContain('CREATE TABLE IF NOT EXISTS "BugReport"');
    expect(script).toContain('"BugReport_studentId_createdAt_idx"');
    expect(script).toContain('"BugReport_status_createdAt_idx"');
    expect(script).toContain("BugReport_studentId_fkey");
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run tests/bug-report.test.ts`
Expected: FAIL — "model BugReport" không tìm thấy (`expect(start).toBeGreaterThan(-1)`).

- [ ] **Step 3: Sửa schema**

Trong khối comment đầu `prisma/schema.prisma`, thêm sau dòng `ReviewCriterion`:

```prisma
// enum BugCategory (BugReport.category): audio | answer | display | other
// enum BugStatus (BugReport.status): open | resolved
```

Trong `model StudentProfile`, thêm sau `vocabQuizDays VocabQuizDay[]`:

```prisma
  bugReports    BugReport[]
```

Thêm model ở cuối file:

```prisma
// Báo lỗi học viên gửi cho giáo viên ngay trên web (nút con bọ ở góc màn hình).
// Mọi cột "ngữ cảnh" (pageUrl/userAgent/viewport/attemptId/contextJson) do trình
// duyệt tự điền lúc gửi, học viên chỉ chọn loại + gõ mô tả + (tuỳ chọn) ảnh.
model BugReport {
  id          String    @id @default(cuid())
  studentId   String
  // audio | answer | display | other — xem comment đầu schema
  category    String
  description String
  imageUrl    String?
  pageUrl     String
  userAgent   String?
  viewport    String?
  // KHÔNG khoá ngoại: bài làm có thể bị giáo viên reset xoá, báo lỗi vẫn giữ.
  attemptId   String?
  // JSON { unitTitle?: string, step?: number } — part/bước đang mở lúc báo
  contextJson String?
  // open | resolved
  status      String    @default("open")
  teacherNote String?
  resolvedAt  DateTime?
  createdAt   DateTime  @default(now())
  student     StudentProfile @relation(fields: [studentId], references: [id], onDelete: Cascade)

  @@index([studentId, createdAt])
  @@index([status, createdAt])
}
```

- [ ] **Step 4: Sửa `scripts/ensure-db.mjs`**

Chèn ngay sau dòng `'ALTER TABLE "CommentSnippet" ADD COLUMN IF NOT EXISTS "criterion" TEXT;',`:

```js
  // Báo lỗi học viên gửi giáo viên: bảng mới, không đụng dữ liệu cũ.
  `CREATE TABLE IF NOT EXISTS "BugReport" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT,
    "pageUrl" TEXT NOT NULL,
    "userAgent" TEXT,
    "viewport" TEXT,
    "attemptId" TEXT,
    "contextJson" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "teacherNote" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BugReport_pkey" PRIMARY KEY ("id")
  );`,
  'CREATE INDEX IF NOT EXISTS "BugReport_studentId_createdAt_idx" ON "BugReport"("studentId", "createdAt");',
  'CREATE INDEX IF NOT EXISTS "BugReport_status_createdAt_idx" ON "BugReport"("status", "createdAt");',
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BugReport_studentId_fkey') THEN
      ALTER TABLE "BugReport" ADD CONSTRAINT "BugReport_studentId_fkey"
      FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END $$;`,
```

- [ ] **Step 5: Áp schema lên DB dev + sinh client**

Run: `npx prisma db push`
Expected: "Your database is now in sync with your Prisma schema" và "Generated Prisma Client". Nếu báo `EPERM ... query_engine-windows.dll.node`: dừng dev server rồi chạy `npx prisma generate` lại.

- [ ] **Step 6: Chạy test, xác nhận pass**

Run: `npx vitest run tests/bug-report.test.ts tests/foundation.test.ts`
Expected: PASS toàn bộ.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma scripts/ensure-db.mjs tests/bug-report.test.ts
git commit -m "feat(bao-loi): bang BugReport + ensure-db

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Logic thuần `lib/bug-report.ts`

**Files:**
- Create: `lib/bug-report.ts`
- Test: `tests/bug-report.test.ts` (thêm describe)

**Interfaces:**
- Produces:
  - `BUG_CATEGORY_VALUES: readonly ["audio","answer","display","other"]`, `type BugCategory`
  - `BUG_CATEGORIES: { value: BugCategory; label: string; hint: string }[]`
  - `bugCategoryLabel(value: string): string`
  - `BUG_STATUS_VALUES: readonly ["open","resolved"]`
  - `BUG_DESCRIPTION_MAX = 1000`, `BUG_TEACHER_NOTE_MAX = 500`, `BUG_DAILY_LIMIT = 10`, `BUG_IMAGE_MAX_BYTES = 1048576`
  - `isOverDailyLimit(countLast24h: number): boolean`
  - `type BugContext = { unitTitle?: string; step?: number }`; `parseBugContext(json: string | null | undefined): BugContext`; `formatBugContext(context: BugContext): string | null`
  - `describeDevice(userAgent: string | null | undefined): string`
  - `isAllowedBugImageUrl(url: string): boolean` (https, host đuôi `.public.blob.vercel-storage.com`, path bắt đầu `/bug-reports/`)
  - `escapeHtml(value: string): string`
  - `buildBugReportEmail(input: BugReportEmailInput): { subject: string; html: string; text: string }` với `BugReportEmailInput = { studentName; categoryLabel; description; createdAt: Date; pageUrl; device; viewport: string | null; contextLine: string | null; imageUrl: string | null; appUrl: string }`

- [ ] **Step 1: Viết test logic (fail)**

Thêm vào cuối `tests/bug-report.test.ts`:

```ts
import {
  BUG_CATEGORIES,
  BUG_DAILY_LIMIT,
  bugCategoryLabel,
  buildBugReportEmail,
  describeDevice,
  formatBugContext,
  isAllowedBugImageUrl,
  isOverDailyLimit,
  parseBugContext
} from "../lib/bug-report";

describe("loại lỗi", () => {
  it("có đúng 4 loại theo thứ tự", () => {
    expect(BUG_CATEGORIES.map((c) => c.value)).toEqual(["audio", "answer", "display", "other"]);
  });

  it("nhãn của loại lạ thì trả về 'Khác'", () => {
    expect(bugCategoryLabel("audio")).toBe("Audio không chạy");
    expect(bugCategoryLabel("xyz")).toBe("Khác");
  });
});

describe("describeDevice", () => {
  it("iPhone Safari 15", () => {
    expect(
      describeDevice(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 15_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Mobile/15E148 Safari/604.1"
      )
    ).toBe("iPhone · Safari 15");
  });

  it("Android Chrome 120", () => {
    expect(
      describeDevice(
        "Mozilla/5.0 (Linux; Android 13; SM-A515F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
      )
    ).toBe("Android · Chrome 120");
  });

  it("Windows Edge 125 (UA có cả chữ Chrome)", () => {
    expect(
      describeDevice(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0"
      )
    ).toBe("Windows · Edge 125");
  });

  it("iPhone Chrome (CriOS) không bị nhận nhầm là Safari", () => {
    expect(
      describeDevice(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1"
      )
    ).toBe("iPhone · Chrome 120");
  });

  it("chuỗi lạ hoặc rỗng -> Không rõ", () => {
    expect(describeDevice("curl/8.0")).toBe("Không rõ");
    expect(describeDevice(null)).toBe("Không rõ");
    expect(describeDevice("")).toBe("Không rõ");
  });
});

describe("giới hạn & ngữ cảnh", () => {
  it("đủ 10 báo lỗi trong 24h thì chặn", () => {
    expect(isOverDailyLimit(BUG_DAILY_LIMIT - 1)).toBe(false);
    expect(isOverDailyLimit(BUG_DAILY_LIMIT)).toBe(true);
  });

  it("parseBugContext chịu được JSON hỏng", () => {
    expect(parseBugContext(null)).toEqual({});
    expect(parseBugContext("{oops")).toEqual({});
    expect(parseBugContext('{"unitTitle":"Part 2","step":3}')).toEqual({ unitTitle: "Part 2", step: 3 });
    expect(parseBugContext('{"unitTitle":5,"step":"x"}')).toEqual({});
  });

  it("formatBugContext ghép part + bước", () => {
    expect(formatBugContext({})).toBeNull();
    expect(formatBugContext({ unitTitle: "Part 2" })).toBe("Part 2");
    expect(formatBugContext({ unitTitle: "Part 2", step: 2 })).toBe("Part 2 · Bước 3");
  });

  it("chỉ nhận ảnh Blob của chính tính năng này", () => {
    expect(isAllowedBugImageUrl("https://abc.public.blob.vercel-storage.com/bug-reports/x-1.webp")).toBe(true);
    expect(isAllowedBugImageUrl("https://abc.public.blob.vercel-storage.com/avatars/x.webp")).toBe(false);
    expect(isAllowedBugImageUrl("https://evil.com/bug-reports/x.webp")).toBe(false);
    expect(isAllowedBugImageUrl("http://abc.public.blob.vercel-storage.com/bug-reports/x.webp")).toBe(false);
    expect(isAllowedBugImageUrl("không phải url")).toBe(false);
  });
});

describe("buildBugReportEmail", () => {
  const input = {
    studentName: "Nguyễn Văn A",
    categoryLabel: "Audio không chạy",
    description: "Bấm play <script>alert(1)</script> không được",
    createdAt: new Date("2026-09-17T03:00:00Z"),
    pageUrl: "/student/assignments/abc",
    device: "iPhone · Safari 15",
    viewport: "390x844",
    contextLine: "Part 2 · Bước 1",
    imageUrl: "https://abc.public.blob.vercel-storage.com/bug-reports/x.webp",
    appUrl: "https://example.vercel.app"
  };

  it("tiêu đề có tên học viên và loại lỗi", () => {
    expect(buildBugReportEmail(input).subject).toBe("[IELTS] Báo lỗi mới – Nguyễn Văn A: Audio không chạy");
  });

  it("html escape nội dung học viên nhập, có link web và ảnh", () => {
    const { html, text } = buildBugReportEmail(input);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("https://example.vercel.app/teacher/bugs");
    expect(html).toContain(input.imageUrl);
    expect(text).toContain("Part 2 · Bước 1");
    expect(text).toContain("390x844");
  });

  it("không có ảnh/ngữ cảnh thì không in dòng đó", () => {
    const { html } = buildBugReportEmail({ ...input, imageUrl: null, contextLine: null, viewport: null });
    expect(html).not.toContain("Ảnh chụp");
    expect(html).not.toContain("Vị trí");
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run tests/bug-report.test.ts`
Expected: FAIL — không resolve được `../lib/bug-report`.

- [ ] **Step 3: Viết `lib/bug-report.ts`**

```ts
// Logic thuần cho tính năng báo lỗi. KHÔNG import prisma: hộp thoại (client
// component) và trang giáo viên (server) đều dùng chung file này.

export const BUG_CATEGORY_VALUES = ["audio", "answer", "display", "other"] as const;
export type BugCategory = (typeof BUG_CATEGORY_VALUES)[number];

export const BUG_CATEGORIES: { value: BugCategory; label: string; hint: string }[] = [
  { value: "audio", label: "Audio không chạy", hint: "Không nghe được, bị đứng, không tua được" },
  { value: "answer", label: "Đáp án / chấm sai", hint: "Trả lời đúng mà bị chấm sai, giải thích sai" },
  { value: "display", label: "Hiển thị lỗi", hint: "Vỡ giao diện, thiếu chữ, ảnh không hiện" },
  { value: "other", label: "Khác", hint: "Lỗi khác không thuộc ba loại trên" }
];

export function bugCategoryLabel(value: string): string {
  return BUG_CATEGORIES.find((category) => category.value === value)?.label ?? "Khác";
}

export const BUG_STATUS_VALUES = ["open", "resolved"] as const;
export type BugStatus = (typeof BUG_STATUS_VALUES)[number];

export const BUG_DESCRIPTION_MAX = 1000;
export const BUG_TEACHER_NOTE_MAX = 500;
// Chống spam: quá số này trong 24 giờ thì từ chối.
export const BUG_DAILY_LIMIT = 10;
// Ảnh đã được trình duyệt thu nhỏ (cạnh dài 1280px, webp/jpeg) nên hiếm khi quá 300KB.
export const BUG_IMAGE_MAX_BYTES = 1024 * 1024;

export function isOverDailyLimit(countLast24h: number): boolean {
  return countLast24h >= BUG_DAILY_LIMIT;
}

// Ngữ cảnh màn làm bài gửi kèm: part đang mở + bước (chế độ làm từng bước, 0-based).
export type BugContext = { unitTitle?: string; step?: number };

export function parseBugContext(json: string | null | undefined): BugContext {
  if (!json) {
    return {};
  }

  try {
    const raw = JSON.parse(json) as unknown;
    if (!raw || typeof raw !== "object") {
      return {};
    }
    const record = raw as Record<string, unknown>;
    const context: BugContext = {};
    if (typeof record.unitTitle === "string" && record.unitTitle.trim()) {
      context.unitTitle = record.unitTitle.trim();
    }
    if (typeof record.step === "number" && Number.isInteger(record.step) && record.step >= 0) {
      context.step = record.step;
    }
    return context;
  } catch {
    return {};
  }
}

export function formatBugContext(context: BugContext): string | null {
  const parts: string[] = [];
  if (context.unitTitle) {
    parts.push(context.unitTitle);
  }
  if (typeof context.step === "number") {
    // Học viên thấy "Bước 1, 2, 3…" nên hiện 1-based.
    parts.push(`Bước ${context.step + 1}`);
  }
  return parts.length ? parts.join(" · ") : null;
}

// Rút gọn userAgent thành "iPhone · Safari 15" để giáo viên đọc được. Thứ tự dò
// có chủ ý: Edge trước Chrome (UA Edge chứa cả "Chrome/"), CriOS/FxiOS trước
// Safari (mọi trình duyệt iOS đều mang chữ "Safari/").
export function describeDevice(userAgent: string | null | undefined): string {
  const ua = (userAgent ?? "").trim();
  if (!ua) {
    return "Không rõ";
  }

  let os = "";
  if (/iPhone/.test(ua)) {
    os = "iPhone";
  } else if (/iPad/.test(ua)) {
    os = "iPad";
  } else if (/Android/.test(ua)) {
    os = "Android";
  } else if (/Windows/.test(ua)) {
    os = "Windows";
  } else if (/Macintosh/.test(ua)) {
    os = "Mac";
  } else if (/Linux/.test(ua)) {
    os = "Linux";
  }

  let browser = "";
  let match: RegExpMatchArray | null;
  if ((match = ua.match(/Edg(?:e|A|iOS)?\/(\d+)/))) {
    browser = `Edge ${match[1]}`;
  } else if ((match = ua.match(/SamsungBrowser\/(\d+)/))) {
    browser = `Samsung ${match[1]}`;
  } else if ((match = ua.match(/(?:CriOS|Chrome)\/(\d+)/))) {
    browser = `Chrome ${match[1]}`;
  } else if ((match = ua.match(/(?:FxiOS|Firefox)\/(\d+)/))) {
    browser = `Firefox ${match[1]}`;
  } else if (/Safari\//.test(ua) && (match = ua.match(/Version\/(\d+)/))) {
    browser = `Safari ${match[1]}`;
  }

  const parts = [os, browser].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Không rõ";
}

// Chỉ nhận ảnh do chính route /api/student/bug-image tải lên (tiền tố bug-reports/).
// So khớp host bằng đuôi có dấu chấm dẫn đầu để "…vercel-storage.com.evil.com" không lọt.
export function isAllowedBugImageUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") {
    return false;
  }
  if (!parsed.hostname.endsWith(".public.blob.vercel-storage.com")) {
    return false;
  }
  return parsed.pathname.startsWith("/bug-reports/");
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type BugReportEmailInput = {
  studentName: string;
  categoryLabel: string;
  description: string;
  createdAt: Date;
  pageUrl: string;
  device: string;
  viewport: string | null;
  contextLine: string | null;
  imageUrl: string | null;
  appUrl: string;
};

const emailDateFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Ho_Chi_Minh"
});

export function buildBugReportEmail(input: BugReportEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `[IELTS] Báo lỗi mới – ${input.studentName}: ${input.categoryLabel}`;
  const link = `${input.appUrl}/teacher/bugs`;
  const when = emailDateFormatter.format(input.createdAt);

  const rows: [string, string][] = [
    ["Học viên", input.studentName],
    ["Loại lỗi", input.categoryLabel],
    ["Thời gian", when],
    ["Trang", input.pageUrl],
    ["Thiết bị", input.device]
  ];
  if (input.viewport) {
    rows.push(["Màn hình", input.viewport]);
  }
  if (input.contextLine) {
    rows.push(["Vị trí", input.contextLine]);
  }

  const rowsHtml = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;white-space:nowrap">${escapeHtml(label)}</td><td style="padding:4px 0">${escapeHtml(value)}</td></tr>`
    )
    .join("");
  const imageHtml = input.imageUrl
    ? `<p style="margin:16px 0 4px;color:#6b7280">Ảnh chụp màn hình:</p><a href="${escapeHtml(input.imageUrl)}"><img src="${escapeHtml(input.imageUrl)}" alt="Ảnh chụp màn hình" style="max-width:100%;border:1px solid #e5e7eb;border-radius:8px"></a>`
    : "";

  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.6;color:#111827;max-width:640px">
<p style="margin:0 0 12px;font-weight:600">Học viên vừa gửi một báo lỗi trên IELTS Platform.</p>
<table style="border-collapse:collapse">${rowsHtml}</table>
<p style="margin:16px 0 4px;color:#6b7280">Mô tả:</p>
<blockquote style="margin:0;padding:12px 16px;background:#f3f4f6;border-left:4px solid #6366f1;border-radius:6px;white-space:pre-wrap">${escapeHtml(input.description)}</blockquote>
${imageHtml}
<p style="margin:24px 0 0"><a href="${escapeHtml(link)}" style="display:inline-block;padding:10px 18px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Xem trên web</a></p>
</div>`;

  const textLines = [
    "Học viên vừa gửi một báo lỗi trên IELTS Platform.",
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
    "",
    "Mô tả:",
    input.description,
    ...(input.imageUrl ? ["", `Ảnh chụp màn hình: ${input.imageUrl}`] : []),
    "",
    `Xem trên web: ${link}`
  ];

  return { subject, html, text: textLines.join("\n") };
}
```

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `npx vitest run tests/bug-report.test.ts`
Expected: PASS toàn bộ.

- [ ] **Step 5: Commit**

```bash
git add lib/bug-report.ts tests/bug-report.test.ts
git commit -m "feat(bao-loi): logic thuan (loai loi, thiet bi, mail)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Chuông thông báo — nguồn `bug_resolved`

**Files:**
- Modify: `lib/notifications.ts`
- Modify: `lib/notifications-feed.ts`
- Modify: `components/notification-list.tsx` (hằng `LABELS`)
- Test: `tests/notifications.test.ts`

**Interfaces:**
- Consumes: `bugCategoryLabel` (Task 2).
- Produces: `StudentNotificationType` thêm `"bug_resolved"`; `BugResolvedNotificationSource = { id: string; category: string; teacherNote: string | null; resolvedAt: Date }`; `buildStudentNotifications(reviews, assignments, readAt, bugs = [])` — tham số thứ 4 tuỳ chọn để không phá chỗ gọi cũ.

- [ ] **Step 1: Viết test (fail)**

Thêm vào `tests/notifications.test.ts`, trong `describe("buildStudentNotifications", ...)` sau test "cắt còn tối đa NOTIFICATION_LIMIT mục":

```ts
  it("báo lỗi đã xử lý thành thông báo dẫn tới /student/bugs", () => {
    const items = buildStudentNotifications(
      [review("a1", "2026-09-10T10:00:00Z")],
      [],
      new Date("2026-09-11T00:00:00Z"),
      [
        {
          id: "b1",
          category: "audio",
          teacherNote: "Đã thay file audio.",
          resolvedAt: new Date("2026-09-12T10:00:00Z")
        }
      ]
    );

    expect(items[0].id).toBe("bug:b1");
    expect(items[0].type).toBe("bug_resolved");
    expect(items[0].href).toBe("/student/bugs");
    expect(items[0].title).toBe("Đã xử lý báo lỗi: Audio không chạy");
    expect(items[0].detail).toBe("Đã thay file audio.");
    expect(items[0].unread).toBe(true);
    expect(items[1].id).toBe("review:a1");
  });

  it("báo lỗi xử lý không có phản hồi thì detail null", () => {
    const items = buildStudentNotifications([], [], null, [
      { id: "b2", category: "other", teacherNote: null, resolvedAt: new Date("2026-09-12T10:00:00Z") }
    ]);
    expect(items[0].detail).toBeNull();
  });
```

Và trong `describe("nguồn thông báo lọc đúng bài tự luyện", ...)` thêm:

```ts
  it("nguồn 'báo lỗi đã xử lý' được bọc try/catch (bảng có thể chưa có trên prod)", () => {
    expect(feed).toContain("prisma.bugReport.findMany");
    expect(feed).toMatch(/try\s*\{[\s\S]*prisma\.bugReport\.findMany[\s\S]*\}\s*catch/);
  });
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run tests/notifications.test.ts`
Expected: FAIL — 3 test mới (type "bug_resolved" chưa có; feed chưa có bugReport).

- [ ] **Step 3: Sửa `lib/notifications.ts`**

Đổi type và thêm nguồn:

```ts
export type StudentNotificationType = "review_done" | "assignment_new" | "bug_resolved";
```

Sau `AssignmentNotificationSource` thêm:

```ts
export type BugResolvedNotificationSource = {
  id: string;
  category: string;
  teacherNote: string | null;
  resolvedAt: Date;
};
```

Thêm import đầu file:

```ts
import { bugCategoryLabel } from "@/lib/bug-report";
```

Sửa chữ ký và thân `buildStudentNotifications`:

```ts
export function buildStudentNotifications(
  reviews: ReviewNotificationSource[],
  assignments: AssignmentNotificationSource[],
  readAt: Date | null,
  // Tham số thứ 4 tuỳ chọn: chỗ gọi cũ và test cũ không phải sửa.
  bugs: BugResolvedNotificationSource[] = []
): StudentNotification[] {
  const items: StudentNotification[] = [
    ...reviews.map(/* giữ nguyên */),
    ...assignments.map(/* giữ nguyên */),
    ...bugs.map((item) => ({
      id: `bug:${item.id}`,
      type: "bug_resolved" as const,
      title: `Đã xử lý báo lỗi: ${bugCategoryLabel(item.category)}`,
      detail: item.teacherNote?.trim() ? item.teacherNote.trim() : null,
      href: "/student/bugs",
      createdAt: item.resolvedAt,
      unread: isUnread(item.resolvedAt, readAt)
    }))
  ];
  // phần sort + slice giữ nguyên
```

- [ ] **Step 4: Sửa `lib/notifications-feed.ts`**

Thêm import type:

```ts
import {
  buildStudentNotifications,
  countUnread,
  NOTIFICATION_LIMIT,
  type BugResolvedNotificationSource,
  type StudentNotification
} from "@/lib/notifications";
```

Trong `getStudentNotifications`, sau `Promise.all([...])` thêm truy vấn riêng (bọc try/catch — bảng có thể chưa có trên prod ngay sau deploy):

```ts
  // Báo lỗi đã được giáo viên xử lý. Truy vấn riêng, bọc try/catch: bảng BugReport
  // mới thêm, nếu ensure-db chưa kịp chạy trên prod thì chuông vẫn phải hiện hai
  // nguồn còn lại.
  let bugs: BugResolvedNotificationSource[] = [];
  try {
    bugs = await prisma.bugReport.findMany({
      where: { studentId, status: "resolved", resolvedAt: { not: null } },
      orderBy: { resolvedAt: "desc" },
      take: NOTIFICATION_LIMIT,
      select: { id: true, category: true, teacherNote: true, resolvedAt: true }
    }).then((rows) =>
      rows.flatMap((row) =>
        row.resolvedAt ? [{ ...row, resolvedAt: row.resolvedAt }] : []
      )
    );
  } catch (error) {
    console.error("[thong-bao] Không đọc được BugReport:", error);
  }
```

Và truyền vào `buildStudentNotifications(..., student?.notificationsReadAt ?? null, bugs)`.

- [ ] **Step 5: Sửa `components/notification-list.tsx`**

```ts
const LABELS: Record<StudentNotificationType, string> = {
  review_done: "Đã chấm xong",
  assignment_new: "Bài mới",
  bug_resolved: "Báo lỗi"
};
```

- [ ] **Step 6: Chạy test + tsc**

Run: `npx vitest run tests/notifications.test.ts && npx tsc --noEmit -p tsconfig.json`
Expected: PASS; tsc không lỗi. (Nếu `tsconfig.tsbuildinfo` bị đổi: `git checkout tsconfig.tsbuildinfo`.)

- [ ] **Step 7: Commit**

```bash
git add lib/notifications.ts lib/notifications-feed.ts components/notification-list.tsx tests/notifications.test.ts
git commit -m "feat(bao-loi): chuong thong bao khi bao loi duoc xu ly

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Route upload ảnh `app/api/student/bug-image/route.ts`

**Files:**
- Create: `app/api/student/bug-image/route.ts`

**Interfaces:**
- Consumes: `BUG_IMAGE_MAX_BYTES` (Task 2), `auth()` từ `@/lib/auth`.
- Produces: `POST /api/student/bug-image` (multipart, field `file`) → `{ url }` hoặc `{ error }`; Blob path `bug-reports/<userId>-<timestamp>.<ext>` (khớp `isAllowedBugImageUrl`).

- [ ] **Step 1: Viết route**

```ts
import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { BUG_IMAGE_MAX_BYTES } from "@/lib/bug-report";

export const runtime = "nodejs";

// Ảnh chụp màn hình kèm báo lỗi. Trình duyệt đã thu nhỏ (cạnh dài 1280px, webp/
// jpeg) trước khi gửi — components/bug-report-dialog.tsx — nên ảnh tới đây chỉ vài
// trăm KB. Không dùng lại /api/image/direct-upload (khoá cứng vai trò giáo viên,
// nhận cả SVG). Không nhận SVG: chứa được script, ảnh chụp màn hình không cần.
const allowedTypes = new Map<string, string>([
  ["image/webp", "webp"],
  ["image/jpeg", "jpg"],
  ["image/png", "png"]
]);

export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "student") {
    return NextResponse.json({ error: "Cần đăng nhập học viên." }, { status: 403 });
  }

  let file: FormDataEntryValue | null;

  try {
    const formData = await request.formData();
    file = formData.get("file");
  } catch {
    return NextResponse.json({ error: "Ảnh quá lớn." }, { status: 413 });
  }

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Không nhận được ảnh." }, { status: 400 });
  }

  if (file.size > BUG_IMAGE_MAX_BYTES) {
    return NextResponse.json({ error: "Ảnh quá lớn (tối đa 1MB)." }, { status: 413 });
  }

  const extension = allowedTypes.get(file.type);
  if (!extension) {
    return NextResponse.json(
      { error: "Định dạng ảnh không hỗ trợ (chỉ PNG, JPG, WEBP)." },
      { status: 400 }
    );
  }

  try {
    const blob = await put(`bug-reports/${session.user.id}-${Date.now()}.${extension}`, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type
    });

    return NextResponse.json({ url: blob.url });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
```

- [ ] **Step 2: Kiểm bằng tsc**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: không lỗi.

- [ ] **Step 3: Commit**

```bash
git add app/api/student/bug-image/route.ts
git commit -m "feat(bao-loi): route tai anh chup man hinh cua hoc vien

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Server actions `lib/actions/bug-reports.ts`

**Files:**
- Create: `lib/actions/bug-reports.ts`

**Interfaces:**
- Consumes: `requireStudent` (`@/lib/actions/attempts`), `requireTeacher` (`@/lib/actions/classes`), `actionOk`/`actionFail`/`ActionResult` (`@/lib/action-result`), `isEmailConfigured`/`sendEmail` (`@/lib/email`), `resolveAppUrl` (`@/lib/app-url`), Task 2.
- Produces:
  - `createBugReport(formData: FormData): Promise<ActionResult>` — fields: `category, description, imageUrl?, pageUrl, userAgent?, viewport?, attemptId?, contextJson?`
  - `resolveBugReport(formData: FormData): Promise<ActionResult>` — fields: `id, teacherNote?`
  - `reopenBugReport(formData: FormData): Promise<ActionResult>` — field: `id`

- [ ] **Step 1: Viết file**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { requireStudent } from "@/lib/actions/attempts";
import { requireTeacher } from "@/lib/actions/classes";
import { resolveAppUrl } from "@/lib/app-url";
import {
  BUG_CATEGORY_VALUES,
  BUG_DESCRIPTION_MAX,
  BUG_TEACHER_NOTE_MAX,
  bugCategoryLabel,
  buildBugReportEmail,
  describeDevice,
  formatBugContext,
  isAllowedBugImageUrl,
  isOverDailyLimit,
  parseBugContext
} from "@/lib/bug-report";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";

// Chuỗi rỗng trên form nghĩa là "bỏ trống".
function optional(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

const createSchema = z.object({
  // zod v4: tham số `error` thay cho errorMap cũ.
  category: z.enum(BUG_CATEGORY_VALUES, { error: "Hãy chọn loại lỗi." }),
  description: z
    .string()
    .trim()
    .min(1, "Hãy mô tả lỗi bạn gặp.")
    .max(BUG_DESCRIPTION_MAX, `Mô tả tối đa ${BUG_DESCRIPTION_MAX} ký tự.`),
  imageUrl: z
    .string()
    .refine(isAllowedBugImageUrl, "Ảnh phải là ảnh tải lên từ trang này.")
    .nullable(),
  pageUrl: z.string().trim().min(1).max(500),
  userAgent: z.string().max(500).nullable(),
  viewport: z.string().max(20).nullable(),
  attemptId: z.string().max(40).nullable(),
  contextJson: z.string().max(500).nullable()
});

// Phạm vi của giáo viên: báo lỗi của học viên đang thuộc ít nhất một lớp mình dạy.
function teacherScope(teacherId: string) {
  return { student: { classes: { some: { class: { teacherId } } } } };
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Gửi mail cho (các) giáo viên phụ trách lớp của học viên. Không có lớp -> gửi về
// chính hộp thư GMAIL_USER để báo lỗi không bị rơi. Lỗi mail chỉ ghi log: học viên
// đã lưu xong thì phải thấy "Đã gửi".
async function notifyTeachers(
  studentId: string,
  report: {
    studentName: string;
    category: string;
    description: string;
    createdAt: Date;
    pageUrl: string;
    userAgent: string | null;
    viewport: string | null;
    contextJson: string | null;
    imageUrl: string | null;
  }
): Promise<void> {
  if (!isEmailConfigured()) {
    return;
  }

  const teachers = await prisma.teacherProfile.findMany({
    where: { classes: { some: { students: { some: { studentId } } } } },
    select: { user: { select: { email: true } } }
  });
  const recipients = [...new Set(teachers.map((t) => t.user.email).filter(Boolean))];
  const fallback = process.env.GMAIL_USER?.trim() ?? "";
  const to = recipients.length ? recipients.join(", ") : fallback;
  if (!to) {
    return;
  }

  const mail = buildBugReportEmail({
    studentName: report.studentName,
    categoryLabel: bugCategoryLabel(report.category),
    description: report.description,
    createdAt: report.createdAt,
    pageUrl: report.pageUrl,
    device: describeDevice(report.userAgent),
    viewport: report.viewport,
    contextLine: formatBugContext(parseBugContext(report.contextJson)),
    imageUrl: report.imageUrl,
    appUrl: resolveAppUrl()
  });

  await sendEmail(to, mail.subject, mail.html, mail.text);
}

export async function createBugReport(formData: FormData): Promise<ActionResult> {
  try {
    const student = await requireStudent();

    const parsed = createSchema.safeParse({
      category: optional(formData.get("category")),
      description: String(formData.get("description") ?? ""),
      imageUrl: optional(formData.get("imageUrl")),
      pageUrl: optional(formData.get("pageUrl")) ?? "/student",
      userAgent: optional(formData.get("userAgent")),
      viewport: optional(formData.get("viewport")),
      attemptId: optional(formData.get("attemptId")),
      contextJson: optional(formData.get("contextJson"))
    });

    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Nội dung báo lỗi chưa hợp lệ.");
    }

    const recent = await prisma.bugReport.count({
      where: { studentId: student.id, createdAt: { gte: new Date(Date.now() - DAY_MS) } }
    });
    if (isOverDailyLimit(recent)) {
      throw new Error("Bạn đã gửi quá nhiều báo lỗi trong 24 giờ qua. Hãy chờ rồi gửi lại.");
    }

    const created = await prisma.bugReport.create({
      data: { studentId: student.id, ...parsed.data }
    });

    try {
      await notifyTeachers(student.id, { studentName: student.displayName, ...created });
    } catch (error) {
      console.error("[bao-loi] Không gửi được mail cho giáo viên:", error);
    }

    revalidatePath("/student/bugs");
    revalidatePath("/teacher/bugs");
    revalidatePath("/teacher");

    return actionOk("Đã gửi báo lỗi. Cô/thầy sẽ xem sớm.");
  } catch (error) {
    return actionFail(error, "Gửi báo lỗi");
  }
}

const resolveSchema = z.object({
  id: z.string().min(1),
  teacherNote: z
    .string()
    .trim()
    .max(BUG_TEACHER_NOTE_MAX, `Phản hồi tối đa ${BUG_TEACHER_NOTE_MAX} ký tự.`)
    .nullable()
});

export async function resolveBugReport(formData: FormData): Promise<ActionResult> {
  try {
    const teacher = await requireTeacher();
    const parsed = resolveSchema.safeParse({
      id: optional(formData.get("id")),
      teacherNote: optional(formData.get("teacherNote"))
    });
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Dữ liệu chưa hợp lệ.");
    }

    // updateMany + where có scope: không tìm thấy (hoặc không thuộc lớp mình) thì
    // count = 0, không lộ báo lỗi của học viên lớp khác.
    const result = await prisma.bugReport.updateMany({
      where: { id: parsed.data.id, ...teacherScope(teacher.id) },
      data: { status: "resolved", resolvedAt: new Date(), teacherNote: parsed.data.teacherNote }
    });
    if (result.count === 0) {
      throw new Error("Không tìm thấy báo lỗi này.");
    }

    revalidatePath("/teacher/bugs");
    revalidatePath("/teacher");
    revalidatePath("/student/bugs");

    return actionOk("Đã đánh dấu xử lý.");
  } catch (error) {
    return actionFail(error, "Đánh dấu xử lý");
  }
}

export async function reopenBugReport(formData: FormData): Promise<ActionResult> {
  try {
    const teacher = await requireTeacher();
    const id = optional(formData.get("id"));
    if (!id) {
      throw new Error("Thiếu mã báo lỗi.");
    }

    const result = await prisma.bugReport.updateMany({
      where: { id, ...teacherScope(teacher.id) },
      data: { status: "open", resolvedAt: null }
    });
    if (result.count === 0) {
      throw new Error("Không tìm thấy báo lỗi này.");
    }

    revalidatePath("/teacher/bugs");
    revalidatePath("/teacher");
    revalidatePath("/student/bugs");

    return actionOk("Đã mở lại báo lỗi.");
  } catch (error) {
    return actionFail(error, "Mở lại");
  }
}
```

- [ ] **Step 2: Kiểm tsc**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: không lỗi. (Nếu `created` spread báo lỗi type vì thừa `id`/`status`, đổi thành truyền từng trường: `category, description, createdAt, pageUrl, userAgent, viewport, contextJson, imageUrl` của `created`.)

- [ ] **Step 3: Commit**

```bash
git add lib/actions/bug-reports.ts
git commit -m "feat(bao-loi): server action tao / xu ly / mo lai bao loi + mail GV

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Context + hộp thoại + nút nổi, gắn vào `AppShell`

**Files:**
- Create: `components/bug-report-context.tsx`
- Create: `components/bug-report-dialog.tsx`
- Create: `components/bug-report-button.tsx`
- Modify: `components/app-shell.tsx`

**Interfaces:**
- Consumes: `createBugReport` (Task 5), `useToast` (`@/components/toast`), Task 2 constants.
- Produces:
  - `BugReportProvider({ children })`
  - `useBugReport(): { available: boolean; attemptContext: BugAttemptContext | null; setAttemptContext(ctx | null): void; isOpen: boolean; open(): void; close(): void }` — trả về giá trị no-op (`available: false`) khi không có provider (màn xem trước của giáo viên).
  - `type BugAttemptContext = { attemptId: string; unitTitle: string; step?: number }`
  - `BugReportDialog()` — render null khi đóng.
  - `BugReportFloatingButton()` — ẩn khi `attemptContext !== null` (màn làm bài tự đặt nút inline).
  - `BugReportInlineTrigger()` — nút 36px cho header màn làm bài; null khi `!available`.
  - `BugIcon({ className? })`.

- [ ] **Step 1: Viết `components/bug-report-context.tsx`**

```tsx
"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

// Ngữ cảnh do màn làm bài đăng ký: bài nào, part nào, bước nào đang mở — để hộp
// thoại gửi kèm mà học viên không phải tự mô tả "em đang ở part 2".
export type BugAttemptContext = { attemptId: string; unitTitle: string; step?: number };

type BugReportContextValue = {
  // false = không có provider (vd. giáo viên xem trước đề trong AppShell teacher).
  available: boolean;
  attemptContext: BugAttemptContext | null;
  setAttemptContext: (context: BugAttemptContext | null) => void;
  isOpen: boolean;
  open: () => void;
  close: () => void;
};

const noop = () => {};

const FALLBACK: BugReportContextValue = {
  available: false,
  attemptContext: null,
  setAttemptContext: noop,
  isOpen: false,
  open: noop,
  close: noop
};

const BugReportContext = createContext<BugReportContextValue | null>(null);

// Không ném lỗi khi thiếu provider: attempt-workspace dùng hook này nhưng cũng được
// render trong khu vực giáo viên (xem trước đề), nơi không có nút báo lỗi.
export function useBugReport(): BugReportContextValue {
  return useContext(BugReportContext) ?? FALLBACK;
}

export function BugReportProvider({ children }: { children: ReactNode }) {
  const [attemptContext, setAttemptContextState] = useState<BugAttemptContext | null>(null);
  const [isOpen, setOpen] = useState(false);

  // So sánh từng trường để màn làm bài gọi lại mỗi lần render không gây render vô ích.
  const setAttemptContext = useCallback((next: BugAttemptContext | null) => {
    setAttemptContextState((previous) => {
      if (previous === next) return previous;
      if (
        previous &&
        next &&
        previous.attemptId === next.attemptId &&
        previous.unitTitle === next.unitTitle &&
        previous.step === next.step
      ) {
        return previous;
      }
      return next;
    });
  }, []);

  const open = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);

  const value = useMemo(
    () => ({ available: true, attemptContext, setAttemptContext, isOpen, open, close }),
    [attemptContext, setAttemptContext, isOpen, open, close]
  );

  return <BugReportContext.Provider value={value}>{children}</BugReportContext.Provider>;
}
```

- [ ] **Step 2: Viết `components/bug-report-button.tsx`**

```tsx
"use client";

import { useBugReport } from "@/components/bug-report-context";

export function BugIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M9 9V7a3 3 0 0 1 6 0v2" />
      <rect x="7" y="9" width="10" height="11" rx="5" />
      <path d="M12 12v8M3 13h4M17 13h4M4 19l3-2M20 19l-3-2M5 8l2.5 1.5M19 8l-2.5 1.5" />
    </svg>
  );
}

// Nút nổi góc dưới-phải cho mọi trang học viên. Ẩn khi màn làm bài đã đăng ký ngữ
// cảnh — màn đó tự đặt BugReportInlineTrigger trong header vì thanh nút cuối trang
// (Nộp bài, ‹ ›) của nó chiếm đúng góc này.
export function BugReportFloatingButton() {
  const { available, attemptContext, open } = useBugReport();

  if (!available || attemptContext) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={open}
      aria-label="Báo lỗi cho giáo viên"
      title="Báo lỗi cho giáo viên"
      className="fixed bottom-4 right-4 z-30 inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-pop transition hover:border-primary hover:text-primary"
    >
      <BugIcon />
    </button>
  );
}

// Nút cho header màn làm bài (cùng khuôn 36px với cụm nút cỡ chữ/đồng hồ bên cạnh).
export function BugReportInlineTrigger() {
  const { available, open } = useBugReport();

  if (!available) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={open}
      aria-label="Báo lỗi cho giáo viên"
      title="Báo lỗi cho giáo viên"
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition hover:border-primary hover:text-primary"
    >
      <BugIcon />
    </button>
  );
}
```

- [ ] **Step 3: Viết `components/bug-report-dialog.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useBugReport } from "@/components/bug-report-context";
import { useToast } from "@/components/toast";
import { createBugReport } from "@/lib/actions/bug-reports";
import {
  BUG_CATEGORIES,
  BUG_DESCRIPTION_MAX,
  BUG_IMAGE_MAX_BYTES,
  type BugCategory
} from "@/lib/bug-report";

// Cạnh dài tối đa của ảnh sau khi thu nhỏ trong trình duyệt. Ảnh chụp màn hình
// điện thoại thường 1170x2532 (~1–3MB PNG) -> sau bước này còn vài trăm KB.
const MAX_EDGE = 1280;

async function shrinkScreenshot(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Trình duyệt không xử lý được ảnh này.");
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const toBlob = (type: string) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.8));

  // Safari cũ không xuất được webp: trả về PNG (type khác) hoặc null -> rơi về JPEG.
  let blob = await toBlob("image/webp");
  if (!blob || blob.type !== "image/webp") {
    blob = await toBlob("image/jpeg");
  }
  if (!blob) {
    throw new Error("Không nén được ảnh.");
  }
  return blob;
}

type ImageState =
  | { status: "idle" }
  | { status: "uploading" }
  | { status: "done"; url: string }
  | { status: "error"; message: string };

export function BugReportDialog() {
  const { isOpen, close, attemptContext } = useBugReport();
  const { notify } = useToast();
  const pathname = usePathname();
  const [category, setCategory] = useState<BugCategory | null>(null);
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<ImageState>({ status: "idle" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Portal chỉ dựng được sau khi mount (document chưa có lúc render server).
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Esc để đóng.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, close]);

  if (!mounted || !isOpen) {
    return null;
  }

  const reset = () => {
    setCategory(null);
    setDescription("");
    setImage({ status: "idle" });
    setError(null);
  };

  const onPickImage = async (file: File | undefined) => {
    if (!file) return;
    setImage({ status: "uploading" });
    try {
      const shrunk = await shrinkScreenshot(file);
      if (shrunk.size > BUG_IMAGE_MAX_BYTES) {
        throw new Error("Ảnh quá lớn, hãy chụp lại phần cần báo.");
      }
      const extension = shrunk.type === "image/jpeg" ? "jpg" : "webp";
      const body = new FormData();
      body.append("file", new File([shrunk], `bug.${extension}`, { type: shrunk.type }));
      const response = await fetch("/api/student/bug-image", { method: "POST", body });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) {
        throw new Error(data.error ?? "Không tải được ảnh.");
      }
      setImage({ status: "done", url: data.url });
    } catch (caught) {
      setImage({
        status: "error",
        message: caught instanceof Error ? caught.message : "Không tải được ảnh."
      });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!category) {
      setError("Hãy chọn loại lỗi.");
      return;
    }
    if (!description.trim()) {
      setError("Hãy mô tả lỗi bạn gặp.");
      return;
    }
    if (image.status === "uploading") {
      setError("Ảnh đang tải lên, chờ một chút.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const formData = new FormData();
    formData.set("category", category);
    formData.set("description", description);
    if (image.status === "done") formData.set("imageUrl", image.url);
    formData.set("pageUrl", `${pathname}${window.location.search}`);
    formData.set("userAgent", navigator.userAgent);
    formData.set("viewport", `${window.innerWidth}x${window.innerHeight}`);
    if (attemptContext) {
      formData.set("attemptId", attemptContext.attemptId);
      formData.set(
        "contextJson",
        JSON.stringify({ unitTitle: attemptContext.unitTitle, step: attemptContext.step })
      );
    }

    try {
      const result = await createBugReport(formData);
      if (result.ok) {
        notify(result);
        reset();
        close();
      } else {
        setError(result.message);
      }
    } catch {
      setError("Không gửi được, kiểm tra kết nối rồi thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    // z-[70]: trên màn làm bài (fixed z-50) và hộp xác nhận nộp bài (z-[60]).
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0" onClick={close} aria-hidden="true" />
      <form
        onSubmit={onSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bug-report-title"
        className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-pop sm:rounded-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 id="bug-report-title" className="text-base font-bold">
              Báo lỗi cho giáo viên
            </h2>
            <p className="text-xs text-muted-foreground">
              Trang, thiết bị và bài đang làm sẽ tự gửi kèm.
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Đóng"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-foreground transition hover:border-primary hover:text-primary"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <fieldset>
            <legend className="text-sm font-semibold">Loại lỗi</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {BUG_CATEGORIES.map((item) => {
                const active = category === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setCategory(item.value)}
                    aria-pressed={active}
                    className={
                      active
                        ? "rounded-lg border border-primary bg-primary/10 px-3 py-2 text-left text-sm font-semibold text-primary"
                        : "rounded-lg border border-border bg-background px-3 py-2 text-left text-sm font-medium text-foreground transition hover:border-primary"
                    }
                  >
                    <span className="block">{item.label}</span>
                    <span className="block text-[11px] font-normal text-muted-foreground">
                      {item.hint}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <label className="block">
            <span className="text-sm font-semibold">Mô tả</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value.slice(0, BUG_DESCRIPTION_MAX))}
              rows={4}
              placeholder="Bạn bấm gì, thấy gì, mong đợi gì?"
              className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
            />
            <span className="mt-1 block text-right text-[11px] text-muted-foreground">
              {description.length}/{BUG_DESCRIPTION_MAX}
            </span>
          </label>

          <div>
            <span className="text-sm font-semibold">Ảnh chụp màn hình (tuỳ chọn)</span>
            <div className="mt-2 flex items-center gap-3">
              {image.status === "done" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={image.url}
                  alt="Ảnh đính kèm"
                  className="h-16 w-16 rounded-lg border border-border object-cover"
                />
              ) : null}
              <label className="inline-flex cursor-pointer items-center rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium transition hover:border-primary">
                {image.status === "uploading"
                  ? "Đang tải ảnh…"
                  : image.status === "done"
                    ? "Đổi ảnh"
                    : "Chọn ảnh"}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  disabled={image.status === "uploading"}
                  onChange={(event) => void onPickImage(event.target.files?.[0])}
                />
              </label>
              {image.status === "done" ? (
                <button
                  type="button"
                  onClick={() => setImage({ status: "idle" })}
                  className="text-sm text-muted-foreground hover:text-destructive"
                >
                  Bỏ ảnh
                </button>
              ) : null}
            </div>
            {image.status === "error" ? (
              <p className="mt-1 text-xs text-destructive">{image.message} Bạn vẫn có thể gửi không kèm ảnh.</p>
            ) : null}
          </div>

          {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-4">
          <Link href="/student/bugs" onClick={close} className="text-xs text-muted-foreground hover:text-primary hover:underline">
            Xem các báo lỗi đã gửi
          </Link>
          <button
            type="submit"
            disabled={submitting || image.status === "uploading"}
            className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-card transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Đang gửi…" : "Gửi cho giáo viên"}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}
```

- [ ] **Step 4: Sửa `components/app-shell.tsx`**

Thêm import:

```tsx
import { BugReportProvider } from "@/components/bug-report-context";
import { BugReportDialog } from "@/components/bug-report-dialog";
import { BugIcon, BugReportFloatingButton } from "@/components/bug-report-button";
```

Thêm `"bug"` vào `IconName` và case trong `Icon`:

```tsx
    case "bug":
      return <BugIcon />;
```

Thêm mục menu giáo viên (sau "Chấm bài"):

```tsx
    { href: "/teacher/bugs", label: "Báo lỗi", hint: "Học viên báo trục trặc", icon: "bug" }
```

Trong `AppShell`, đổi hai chỗ `return` để bọc provider + nút + hộp thoại cho student. Tách ra helper ngay trên `AppShell`:

```tsx
// Nút báo lỗi + hộp thoại chỉ có ở khu học viên. Bọc cả hai nhánh return (trang
// kết quả toàn màn hình cũng cần báo lỗi được).
function withBugReport(role: AppShellRole, node: ReactNode) {
  if (role !== "student") {
    return node;
  }
  return (
    <BugReportProvider>
      {node}
      <BugReportFloatingButton />
      <BugReportDialog />
    </BugReportProvider>
  );
}
```

Rồi:

```tsx
  if (isFullScreen) {
    return withBugReport(role, <div className="min-h-screen bg-background">{children}</div>);
  }
  // ...
  return withBugReport(
    role,
    <div className="min-h-screen">
      {/* toàn bộ JSX hiện có giữ nguyên */}
    </div>
  );
```

- [ ] **Step 5: tsc + lint**

Run: `npx tsc --noEmit -p tsconfig.json && pnpm lint`
Expected: không lỗi.

- [ ] **Step 6: Kiểm nhanh trên preview**

`preview_start` (`ielts-dev`). Nhờ người dùng đăng nhập học viên (`student@example.com` / `student123`) hoặc đăng nhập qua `/api/auth/csrf` + POST `/api/auth/callback/credentials` (xem memory `local-db-test-workflow`). Mở `/student`, kiểm bằng `find` "Báo lỗi cho giáo viên" → click → `read_page` thấy hộp thoại; chọn loại, gõ mô tả, gửi → toast "Đã gửi báo lỗi". Kiểm DB: `node tmp/_bug-check.mjs` (script tạm in `prisma.bugReport.findMany()`), xoá script sau.

- [ ] **Step 7: Commit**

```bash
git add components/bug-report-context.tsx components/bug-report-dialog.tsx components/bug-report-button.tsx components/app-shell.tsx
git commit -m "feat(bao-loi): nut noi + hop thoai bao loi cho hoc vien

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Màn làm bài đăng ký ngữ cảnh + nút inline

**Files:**
- Modify: `components/attempt-workspace.tsx` (import đầu file; sau khối `const parts = activeUnits.map(...)` ~dòng 2708–2757; header ~dòng 2851 `<div className="flex shrink-0 items-center gap-2">`)

**Interfaces:**
- Consumes: `useBugReport`, `BugReportInlineTrigger` (Task 6).

- [ ] **Step 1: Thêm import**

```tsx
import { useBugReport } from "@/components/bug-report-context";
import { BugReportInlineTrigger } from "@/components/bug-report-button";
```

- [ ] **Step 2: Đăng ký ngữ cảnh**

Ngay sau khối `const parts = activeUnits.map(...)` (trước `const activeSkillLabel`), thêm:

```tsx
  // Đăng ký ngữ cảnh cho nút báo lỗi: bài nào, part nào, bước nào đang mở. Xem
  // trước (giáo viên) thì không có provider -> setAttemptContext là no-op.
  const { setAttemptContext } = useBugReport();
  const activePartTitle = parts[activePart]?.title ?? "";
  const activePartUnitId = parts[activePart]?.unitId ?? "";
  // unitSteps chỉ có khoá cho phần chạy chế độ từng bước -> phần thường ra undefined.
  const activePartStep = unitSteps[activePartUnitId];
  useEffect(() => {
    if (previewMode) return;
    setAttemptContext({ attemptId: attempt.id, unitTitle: activePartTitle, step: activePartStep });
  }, [previewMode, setAttemptContext, attempt.id, activePartTitle, activePartStep]);
  // Rời màn làm bài thì trả lại nút nổi cho các trang khác.
  useEffect(() => () => setAttemptContext(null), [setAttemptContext]);
```

Lưu ý: `unitSteps` là state đã có (~dòng 2154). KHÔNG dùng `stepInfoByUnit` — nó chỉ được điền trong lúc render JSX (~dòng 3514), lúc hook chạy vẫn rỗng. Hook phải nằm trước `if (!mounted)` ở ~dòng 3986.

- [ ] **Step 3: Nút inline trong header**

Trong header của form chính (~dòng 2851), trong `<div className="flex shrink-0 items-center gap-2">` thêm làm phần tử đầu tiên:

```tsx
          {!previewMode ? <BugReportInlineTrigger /> : null}
```

- [ ] **Step 4: tsc + lint**

Run: `npx tsc --noEmit -p tsconfig.json && pnpm lint`
Expected: không lỗi.

- [ ] **Step 5: Kiểm trên preview**

Mở một bài đang giao (`/student` → "Làm bài"). `find` "Báo lỗi cho giáo viên" phải ra đúng **một** nút (inline; nút nổi ẩn). Bấm, gửi một báo lỗi. Kiểm DB: dòng mới có `attemptId` và `contextJson` chứa `unitTitle` của part đang mở. Chuyển sang part 2 rồi gửi lại → `unitTitle` đổi.

- [ ] **Step 6: Commit**

```bash
git add components/attempt-workspace.tsx
git commit -m "feat(bao-loi): man lam bai gui kem part/buoc dang mo

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Trang học viên `/student/bugs`

**Files:**
- Create: `app/student/bugs/page.tsx`

**Interfaces:**
- Consumes: `bugCategoryLabel`, `parseBugContext`, `formatBugContext` (Task 2); `formatRelativeTime` (`@/lib/notifications`).

- [ ] **Step 1: Viết trang**

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { bugCategoryLabel, formatBugContext, parseBugContext } from "@/lib/bug-report";
import { formatRelativeTime } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function StudentBugsPage() {
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

  const reports = await prisma.bugReport.findMany({
    where: { studentId: student.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      category: true,
      description: true,
      imageUrl: true,
      contextJson: true,
      status: true,
      teacherNote: true,
      resolvedAt: true,
      createdAt: true
    }
  });

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold text-primary">Hỗ trợ</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Báo lỗi đã gửi</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Gặp trục trặc ở bất kỳ trang nào, bấm nút con bọ ở góc màn hình để báo cho cô/thầy.
        </p>
      </header>

      {reports.length === 0 ? (
        <section className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Bạn chưa gửi báo lỗi nào.{" "}
          <Link href="/student" className="font-medium text-primary hover:underline">
            Về tổng quan
          </Link>
        </section>
      ) : (
        <ul className="space-y-3">
          {reports.map((report) => {
            const resolved = report.status === "resolved";
            const contextLine = formatBugContext(parseBugContext(report.contextJson));
            return (
              <li key={report.id} className="rounded-xl border border-border bg-card p-4 shadow-card">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-border px-2.5 py-0.5 text-xs font-semibold">
                    {bugCategoryLabel(report.category)}
                  </span>
                  <span
                    className={
                      resolved
                        ? "rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300"
                        : "rounded-full border border-amber-400/50 bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300"
                    }
                  >
                    {resolved ? "Đã xử lý" : "Đang chờ"}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground" suppressHydrationWarning>
                    {formatRelativeTime(report.createdAt)}
                  </span>
                </div>
                {contextLine ? (
                  <p className="mt-2 text-xs text-muted-foreground">Vị trí: {contextLine}</p>
                ) : null}
                <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{report.description}</p>
                {report.imageUrl ? (
                  <a href={report.imageUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={report.imageUrl}
                      alt="Ảnh đính kèm"
                      className="h-24 w-24 rounded-lg border border-border object-cover"
                    />
                  </a>
                ) : null}
                {resolved ? (
                  <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                      Phản hồi của giáo viên
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-foreground">
                      {report.teacherNote?.trim() ? report.teacherNote : "Đã xử lý, cảm ơn bạn đã báo."}
                    </p>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: tsc + lint + kiểm preview**

Run: `npx tsc --noEmit -p tsconfig.json && pnpm lint`
Mở `/student/bugs` trên preview (đã đăng nhập học viên) → `get_page_text` thấy báo lỗi đã gửi ở Task 6/7 với nhãn "Đang chờ".

- [ ] **Step 3: Commit**

```bash
git add app/student/bugs/page.tsx
git commit -m "feat(bao-loi): trang hoc vien xem bao loi da gui

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: Trang giáo viên `/teacher/bugs` + thẻ Tổng quan

**Files:**
- Create: `components/bug-report-teacher-row.tsx`
- Create: `app/teacher/bugs/page.tsx`
- Modify: `app/teacher/page.tsx` (Promise.all ~dòng 20–100; `cards`/section thẻ ~dòng 100–160)

**Interfaces:**
- Consumes: `resolveBugReport`, `reopenBugReport` (Task 5); `ActionForm`, `ActionSubmitButton` (`@/components/action-form`); `StudentAvatar` (`@/components/student-avatar`); `requireTeacherPage`; Task 2.
- Produces: `BugReportTeacherRow({ report })` với `report: TeacherBugReportRow` (type export từ cùng file).

- [ ] **Step 1: Viết `components/bug-report-teacher-row.tsx`**

```tsx
"use client";

import Link from "next/link";
import { ActionForm, ActionSubmitButton } from "@/components/action-form";
import { StudentAvatar } from "@/components/student-avatar";
import { reopenBugReport, resolveBugReport } from "@/lib/actions/bug-reports";
import { BUG_TEACHER_NOTE_MAX, bugCategoryLabel } from "@/lib/bug-report";
import { formatRelativeTime } from "@/lib/notifications";

// Dữ liệu đã "phẳng hoá" ở server (page.tsx): ngữ cảnh đã format, link bài làm đã
// xác minh. Component này chỉ vẽ + gắn hai action.
export type TeacherBugReportRow = {
  id: string;
  category: string;
  description: string;
  imageUrl: string | null;
  pageUrl: string;
  device: string;
  viewport: string | null;
  contextLine: string | null;
  attemptTitle: string | null;
  attemptHref: string | null;
  status: string;
  teacherNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
  student: {
    displayName: string;
    avatarUrl: string | null;
    avatarPreset: string | null;
    userImage: string | null;
    classNames: string[];
  };
};

export function BugReportTeacherRow({ report }: { report: TeacherBugReportRow }) {
  const resolved = report.status === "resolved";

  return (
    <article className="rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="flex flex-wrap items-center gap-3">
        <StudentAvatar
          avatarUrl={report.student.avatarUrl}
          avatarPreset={report.student.avatarPreset}
          userImage={report.student.userImage}
          displayName={report.student.displayName}
          size="list"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{report.student.displayName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {report.student.classNames.length ? report.student.classNames.join(", ") : "Chưa vào lớp"}
          </p>
        </div>
        <span className="rounded-full border border-border px-2.5 py-0.5 text-xs font-semibold">
          {bugCategoryLabel(report.category)}
        </span>
        <span className="text-xs text-muted-foreground" suppressHydrationWarning>
          {formatRelativeTime(new Date(report.createdAt))}
        </span>
      </div>

      <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">{report.description}</p>

      <dl className="mt-3 grid gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
        <div className="flex gap-2">
          <dt className="shrink-0 font-semibold">Trang</dt>
          <dd className="truncate">{report.pageUrl}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="shrink-0 font-semibold">Thiết bị</dt>
          <dd>
            {report.device}
            {report.viewport ? ` · ${report.viewport}` : ""}
          </dd>
        </div>
        {report.contextLine ? (
          <div className="flex gap-2">
            <dt className="shrink-0 font-semibold">Vị trí</dt>
            <dd>{report.contextLine}</dd>
          </div>
        ) : null}
        {report.attemptTitle ? (
          <div className="flex gap-2">
            <dt className="shrink-0 font-semibold">Bài</dt>
            <dd>
              {report.attemptHref ? (
                <Link href={report.attemptHref} className="text-primary hover:underline">
                  {report.attemptTitle} →
                </Link>
              ) : (
                `${report.attemptTitle} (đang làm)`
              )}
            </dd>
          </div>
        ) : null}
      </dl>

      {report.imageUrl ? (
        <a href={report.imageUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={report.imageUrl}
            alt="Ảnh chụp màn hình"
            className="max-h-48 rounded-lg border border-border object-contain"
          />
        </a>
      ) : null}

      {resolved ? (
        <div className="mt-4 flex flex-wrap items-start justify-between gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2">
          <div className="text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
              Đã xử lý
              {report.resolvedAt ? ` · ${formatRelativeTime(new Date(report.resolvedAt))}` : ""}
            </p>
            <p className="mt-1 whitespace-pre-wrap">{report.teacherNote?.trim() || "(không có phản hồi)"}</p>
          </div>
          <ActionForm action={reopenBugReport}>
            <input type="hidden" name="id" value={report.id} />
            <ActionSubmitButton
              pendingLabel="Đang mở…"
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:border-primary"
            >
              Mở lại
            </ActionSubmitButton>
          </ActionForm>
        </div>
      ) : (
        <ActionForm action={resolveBugReport} className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
          <input type="hidden" name="id" value={report.id} />
          <label className="flex-1 text-xs font-semibold text-muted-foreground">
            Phản hồi cho học viên (tuỳ chọn)
            <input
              name="teacherNote"
              maxLength={BUG_TEACHER_NOTE_MAX}
              placeholder="Ví dụ: Đã thay file audio, em thử lại nhé."
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal text-foreground focus:border-primary focus:outline-none"
            />
          </label>
          <ActionSubmitButton
            pendingLabel="Đang lưu…"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-card hover:bg-primary/90"
          >
            Đã xử lý
          </ActionSubmitButton>
        </ActionForm>
      )}
    </article>
  );
}
```

- [ ] **Step 2: Viết `app/teacher/bugs/page.tsx`**

```tsx
import Link from "next/link";
import { BugReportTeacherRow, type TeacherBugReportRow } from "@/components/bug-report-teacher-row";
import { describeDevice, formatBugContext, parseBugContext } from "@/lib/bug-report";
import { prisma } from "@/lib/prisma";
import { requireTeacherPage } from "@/lib/teacher-page";

export const dynamic = "force-dynamic";

type TeacherBugsPageProps = { searchParams?: { tab?: string } };

const tabClass =
  "rounded-full border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:border-primary";
const activeTabClass =
  "rounded-full border border-primary bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary";

export default async function TeacherBugsPage({ searchParams }: TeacherBugsPageProps) {
  const teacher = await requireTeacherPage();
  const tab = searchParams?.tab === "resolved" ? "resolved" : "open";
  const scope = { student: { classes: { some: { class: { teacherId: teacher.id } } } } };

  // Bọc try/catch: bảng BugReport mới, nếu ensure-db chưa chạy trên prod thì trang
  // hiện rỗng thay vì màn hình lỗi.
  let reports: Awaited<ReturnType<typeof loadReports>> = [];
  let openCount = 0;
  let resolvedCount = 0;
  try {
    [reports, openCount, resolvedCount] = await Promise.all([
      loadReports(tab, scope),
      prisma.bugReport.count({ where: { status: "open", ...scope } }),
      prisma.bugReport.count({ where: { status: "resolved", ...scope } })
    ]);
  } catch (error) {
    console.error("[bao-loi] Không đọc được BugReport:", error);
  }

  // Xác minh bài làm còn tồn tại và đúng học viên; chỉ link khi đã nộp (trang
  // /teacher/results chỉ mở bài submitted/reviewed).
  const attemptIds = reports.flatMap((r) => (r.attemptId ? [r.attemptId] : []));
  const attempts = attemptIds.length
    ? await prisma.attempt.findMany({
        where: { id: { in: attemptIds } },
        select: {
          id: true,
          studentId: true,
          status: true,
          assignmentRecipient: { select: { assignment: { select: { title: true } } } }
        }
      })
    : [];
  const attemptById = new Map(attempts.map((a) => [a.id, a]));

  const rows: TeacherBugReportRow[] = reports.map((report) => {
    const attempt = report.attemptId ? attemptById.get(report.attemptId) : undefined;
    const ownAttempt = attempt && attempt.studentId === report.student.id ? attempt : undefined;
    return {
      id: report.id,
      category: report.category,
      description: report.description,
      imageUrl: report.imageUrl,
      pageUrl: report.pageUrl,
      device: describeDevice(report.userAgent),
      viewport: report.viewport,
      contextLine: formatBugContext(parseBugContext(report.contextJson)),
      attemptTitle: ownAttempt?.assignmentRecipient.assignment.title ?? null,
      attemptHref:
        ownAttempt && (ownAttempt.status === "submitted" || ownAttempt.status === "reviewed")
          ? `/teacher/results/${ownAttempt.id}`
          : null,
      status: report.status,
      teacherNote: report.teacherNote,
      createdAt: report.createdAt.toISOString(),
      resolvedAt: report.resolvedAt?.toISOString() ?? null,
      student: {
        displayName: report.student.displayName,
        avatarUrl: report.student.avatarUrl,
        avatarPreset: report.student.avatarPreset,
        userImage: report.student.user?.image ?? null,
        classNames: report.student.classes.map((c) => c.class.name)
      }
    };
  });

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold text-primary">Hỗ trợ học viên</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Báo lỗi</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Học viên bấm nút con bọ trên web để báo trục trặc. Trang, thiết bị và bài đang làm được gửi kèm tự động.
        </p>
      </header>

      <nav className="flex flex-wrap gap-2">
        <Link href="/teacher/bugs" className={tab === "open" ? activeTabClass : tabClass}>
          Mới ({openCount})
        </Link>
        <Link href="/teacher/bugs?tab=resolved" className={tab === "resolved" ? activeTabClass : tabClass}>
          Đã xử lý ({resolvedCount})
        </Link>
      </nav>

      {rows.length === 0 ? (
        <section className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          {tab === "open" ? "Không có báo lỗi nào đang chờ." : "Chưa có báo lỗi nào được xử lý."}
        </section>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <BugReportTeacherRow key={row.id} report={row} />
          ))}
        </div>
      )}
    </div>
  );
}

function loadReports(
  status: "open" | "resolved",
  scope: { student: { classes: { some: { class: { teacherId: string } } } } }
) {
  return prisma.bugReport.findMany({
    where: { status, ...scope },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      category: true,
      description: true,
      imageUrl: true,
      pageUrl: true,
      userAgent: true,
      viewport: true,
      attemptId: true,
      contextJson: true,
      status: true,
      teacherNote: true,
      resolvedAt: true,
      createdAt: true,
      student: {
        select: {
          id: true,
          displayName: true,
          avatarUrl: true,
          avatarPreset: true,
          user: { select: { image: true } },
          classes: { select: { class: { select: { name: true } } } }
        }
      }
    }
  });
}
```

- [ ] **Step 3: Thẻ "Báo lỗi mới" ở `app/teacher/page.tsx`**

Trong `Promise.all` thêm phần tử cuối (và biến `openBugCount` vào mảng destructuring):

```ts
    // Báo lỗi học viên đang chờ. Bảng mới -> catch để thiếu bảng không vỡ Tổng quan.
    prisma.bugReport
      .count({
        where: { status: "open", student: { classes: { some: { class: { teacherId: teacher.id } } } } }
      })
      .catch(() => 0)
```

Sau thẻ "Bài chờ chấm" (trước `</section>`), thêm:

```tsx
        {openBugCount > 0 ? (
          <Link
            href="/teacher/bugs"
            className="rounded-xl border border-red-400/50 bg-red-500/10 p-5 shadow-card transition hover:border-red-400"
          >
            <p className="text-sm text-muted-foreground">Báo lỗi mới</p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-red-600 dark:text-red-300">{openBugCount}</p>
            <p className="mt-1 text-sm font-medium text-primary">Xem báo lỗi →</p>
          </Link>
        ) : null}
```

- [ ] **Step 4: tsc + lint + test guard**

Run: `npx tsc --noEmit -p tsconfig.json && pnpm lint && npx vitest run tests/teacher-page-guard.test.ts`
Expected: không lỗi; guard test PASS (trang mới dùng `requireTeacherPage`).

- [ ] **Step 5: Kiểm trên preview**

Đăng nhập giáo viên (`teacher@example.com` / `teacher123`). Mở `/teacher` → thấy thẻ "Báo lỗi mới: N". Mở `/teacher/bugs` → thấy các báo lỗi từ Task 6/7 với thiết bị, vị trí. Gõ phản hồi, bấm "Đã xử lý" → toast "Đã đánh dấu xử lý.", dòng chuyển sang tab Đã xử lý. Bấm "Mở lại" → về tab Mới. Đăng nhập lại học viên → chuông có mục "Báo lỗi · Đã xử lý báo lỗi: …"; `/student/bugs` hiện phản hồi.

- [ ] **Step 6: Commit**

```bash
git add components/bug-report-teacher-row.tsx app/teacher/bugs/page.tsx app/teacher/page.tsx
git commit -m "feat(bao-loi): trang giao vien xu ly bao loi + the Tong quan

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: Kiểm toàn bộ, build, đẩy lên Vercel

**Files:** không sửa code (chỉ chạy lệnh).

- [ ] **Step 1: Toàn bộ test + lint + build**

Run: `pnpm test && pnpm lint && pnpm build`
Expected: vitest PASS toàn bộ; lint sạch; build thành công (build chạy `ensure-db.mjs` lên DB dev — vô hại vì idempotent).

- [ ] **Step 2: Dọn**

Run: `git status --short`
Expected: không còn file lạ (xoá `tmp/_bug-check.mjs` nếu có; `git checkout tsconfig.tsbuildinfo` nếu bị đổi).

- [ ] **Step 3: Đẩy lên nhánh deploy**

```bash
git push origin feature/ielts-platform-mvp
```

Vercel tự deploy; build chạy `ensure-db.mjs` tạo bảng `BugReport` trên prod.

- [ ] **Step 4: Kiểm prod**

Sau deploy: mở prod `/teacher/bugs` (nhờ người dùng đăng nhập) → trang hiện "Không có báo lỗi nào đang chờ." (không lỗi 500). Xem log Vercel không có lỗi `bugReport`. Gửi thử một báo lỗi từ tài khoản học viên thật → giáo viên nhận mail.
