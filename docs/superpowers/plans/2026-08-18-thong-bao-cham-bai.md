# Thông báo chấm bài xong — Kế hoạch thực thi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Học viên thấy chuông thông báo báo "bài đã chấm xong" / "có bài mới", bấm vào là mở thẳng trang kết quả để đọc feedback.

**Architecture:** Không có bảng thông báo. Danh sách được suy ra lúc đọc từ `TeacherReview.reviewedAt` và `AssignmentRecipient.assignedAt`; một cột mới `StudentProfile.notificationsReadAt` làm mốc "đã đọc". Chuông là client component tự lấy số đếm qua một route API và tự làm mới mỗi 60 giây.

**Tech Stack:** Next.js 14 App Router, Prisma + Postgres (Neon), NextAuth v4, Tailwind, vitest.

Spec: [docs/superpowers/specs/2026-08-18-thong-bao-cham-bai-design.md](../specs/2026-08-18-thong-bao-cham-bai-design.md)

## Global Constraints

- Mọi chữ hiện ra cho người dùng và mọi comment trong code viết bằng **tiếng Việt**.
- Server action bắt đầu bằng `requireStudent()` (`lib/actions/attempts.ts`); không tin id từ `FormData`.
- Cột mới thêm vào DB phải có câu `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` trong `scripts/ensure-db.mjs`, nếu không prod sẽ 500.
- Không sửa `lib/actions/reviews.ts` — đường ghi dữ liệu giữ nguyên.
- Chuỗi `"practice"` chỉ được dùng qua helper trong `lib/practice.ts`.
- Lệnh chạy: `pnpm test`, `pnpm build`, `npx vitest run tests/<file>` cho một tệp.

---

### Task 1: Cột `notificationsReadAt`

**Files:**
- Modify: `prisma/schema.prisma` (model `StudentProfile`)
- Modify: `scripts/ensure-db.mjs` (mảng `statements`)
- Test: `tests/notifications.test.ts` (tạo mới, phần "lược đồ")

**Interfaces:**
- Consumes: không
- Produces: cột `StudentProfile.notificationsReadAt: DateTime?` cho Task 2 và Task 3.

- [ ] **Step 1: Viết test cấu trúc (sẽ hỏng)**

Tạo `tests/notifications.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("lược đồ thông báo", () => {
  it("StudentProfile có cột notificationsReadAt", () => {
    const schema = readFileSync("prisma/schema.prisma", "utf8");
    const model = schema.slice(
      schema.indexOf("model StudentProfile"),
      schema.indexOf("model Class")
    );
    expect(model).toContain("notificationsReadAt");
  });

  // Quên câu này là prod 500 rải rác: Prisma Client không kiểm schema lúc chạy,
  // lỗi chỉ lộ khi có request đụng đúng cột thiếu.
  it("ensure-db.mjs có câu thêm cột notificationsReadAt", () => {
    const script = readFileSync("scripts/ensure-db.mjs", "utf8");
    expect(script).toContain('"StudentProfile" ADD COLUMN IF NOT EXISTS "notificationsReadAt"');
  });
});
```

- [ ] **Step 2: Chạy để chắc chắn nó hỏng**

Run: `npx vitest run tests/notifications.test.ts`
Expected: FAIL, cả hai `expect(...).toContain` đều không thấy chuỗi.

- [ ] **Step 3: Thêm cột vào schema**

Trong `prisma/schema.prisma`, model `StudentProfile`, thêm ngay dưới `createdAt`:

```prisma
  // Mốc thời gian học viên xem chuông thông báo lần gần nhất. Mục nào mới hơn mốc
  // này thì tính là chưa đọc. Null = coi như đã đọc hết (học viên tạo trước khi có
  // cột này), để người mới không bị dội cả chục thông báo cũ.
  notificationsReadAt DateTime?
```

- [ ] **Step 4: Thêm câu ALTER vào ensure-db.mjs**

Thêm vào cuối mảng `statements` trong `scripts/ensure-db.mjs`:

```js
  // Chuông thông báo cho học viên: mốc "đã xem lần cuối".
  // DEFAULT NOW() là có chủ ý — học viên đang có bắt đầu ở trạng thái đã đọc hết,
  // tránh việc vừa deploy là chuông đỏ với hàng chục thông báo cũ.
  'ALTER TABLE "StudentProfile" ADD COLUMN IF NOT EXISTS "notificationsReadAt" TIMESTAMP(3) DEFAULT NOW();',
```

- [ ] **Step 5: Sinh lại Prisma Client và đẩy schema xuống DB local**

Run: `npx prisma db push`
Expected: `Your database is now in sync with your Prisma schema.` và `Generated Prisma Client`.

- [ ] **Step 6: Chạy lại test**

Run: `npx vitest run tests/notifications.test.ts`
Expected: PASS (2 test).

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma scripts/ensure-db.mjs tests/notifications.test.ts
git commit -m "feat(thong-bao): them cot notificationsReadAt cho hoc vien"
```

---

### Task 2: Logic thuần `lib/notifications.ts`

Tệp này **không được import prisma** — chuông là client component và sẽ import `formatRelativeTime` từ đây.

**Files:**
- Create: `lib/notifications.ts`
- Test: `tests/notifications.test.ts` (thêm vào tệp đã có ở Task 1)

**Interfaces:**
- Consumes: không
- Produces:
  - `type StudentNotification = { id, type, title, detail, href, createdAt: Date, unread }`
  - `buildStudentNotifications(reviews, assignments, readAt): StudentNotification[]`
  - `countUnread(items: StudentNotification[]): number`
  - `formatRelativeTime(value: Date, now?: Date): string`
  - `NOTIFICATION_LIMIT = 30`

- [ ] **Step 1: Viết test (sẽ hỏng)**

Thêm vào `tests/notifications.test.ts`:

```ts
import {
  buildStudentNotifications,
  countUnread,
  formatRelativeTime,
  NOTIFICATION_LIMIT,
} from "../lib/notifications";

const review = (attemptId: string, iso: string, band: number | null = 6.5) => ({
  attemptId,
  title: `Bài ${attemptId}`,
  overallBand: band,
  reviewedAt: new Date(iso),
});

const assigned = (recipientId: string, iso: string) => ({
  recipientId,
  title: `Bài giao ${recipientId}`,
  assignedAt: new Date(iso),
});

describe("buildStudentNotifications", () => {
  it("gộp hai nguồn và sắp xếp mới nhất lên đầu", () => {
    const items = buildStudentNotifications(
      [review("a1", "2026-08-10T10:00:00Z")],
      [assigned("r1", "2026-08-12T10:00:00Z")],
      null
    );

    expect(items.map((item) => item.id)).toEqual(["assignment:r1", "review:a1"]);
    expect(items[1].href).toBe("/student/results/a1");
    expect(items[0].href).toBe("/student/assignments/r1");
  });

  it("thông báo chấm bài kèm band, bài mới giao thì không", () => {
    const items = buildStudentNotifications(
      [review("a1", "2026-08-10T10:00:00Z", 7)],
      [assigned("r1", "2026-08-09T10:00:00Z")],
      null
    );

    expect(items[0].detail).toBe("Band 7");
    expect(items[1].detail).toBeNull();
  });

  it("bài chấm chưa có band tổng thì không hiện chữ Band", () => {
    const items = buildStudentNotifications([review("a1", "2026-08-10T10:00:00Z", null)], [], null);
    expect(items[0].detail).toBeNull();
  });

  it("mục mới hơn mốc đã đọc thì tính là chưa đọc", () => {
    const items = buildStudentNotifications(
      [review("moi", "2026-08-12T10:00:00Z")],
      [assigned("cu", "2026-08-01T10:00:00Z")],
      new Date("2026-08-10T00:00:00Z")
    );

    expect(items[0].unread).toBe(true);
    expect(items[1].unread).toBe(false);
    expect(countUnread(items)).toBe(1);
  });

  it("mốc null = đã đọc hết, không dội thông báo vào học viên mới", () => {
    const items = buildStudentNotifications(
      [review("a1", "2026-08-12T10:00:00Z")],
      [assigned("r1", "2026-08-12T10:00:00Z")],
      null
    );

    expect(countUnread(items)).toBe(0);
  });

  it("mục đúng bằng mốc đã đọc thì KHÔNG tính là chưa đọc", () => {
    const at = "2026-08-12T10:00:00Z";
    const items = buildStudentNotifications([review("a1", at)], [], new Date(at));
    expect(items[0].unread).toBe(false);
  });

  it("cắt còn tối đa NOTIFICATION_LIMIT mục", () => {
    const many = Array.from({ length: 25 }, (_, i) =>
      review(`a${i}`, new Date(Date.UTC(2026, 7, 1, i)).toISOString())
    );
    const more = Array.from({ length: 25 }, (_, i) =>
      assigned(`r${i}`, new Date(Date.UTC(2026, 6, 1, i)).toISOString())
    );

    expect(buildStudentNotifications(many, more, null)).toHaveLength(NOTIFICATION_LIMIT);
  });
});

describe("formatRelativeTime", () => {
  const now = new Date("2026-08-18T12:00:00+07:00");

  it("dưới một phút", () => {
    expect(formatRelativeTime(new Date("2026-08-18T11:59:40+07:00"), now)).toBe("Vừa xong");
  });

  it("theo phút, giờ, ngày", () => {
    expect(formatRelativeTime(new Date("2026-08-18T11:30:00+07:00"), now)).toBe("30 phút trước");
    expect(formatRelativeTime(new Date("2026-08-18T09:00:00+07:00"), now)).toBe("3 giờ trước");
    expect(formatRelativeTime(new Date("2026-08-16T12:00:00+07:00"), now)).toBe("2 ngày trước");
  });

  it("quá một tuần thì hiện ngày tháng", () => {
    expect(formatRelativeTime(new Date("2026-08-01T12:00:00+07:00"), now)).toBe("01/08/2026");
  });
});
```

- [ ] **Step 2: Chạy để chắc chắn nó hỏng**

Run: `npx vitest run tests/notifications.test.ts`
Expected: FAIL — `Failed to load ../lib/notifications`.

- [ ] **Step 3: Viết `lib/notifications.ts`**

```ts
// Thông báo cho học viên KHÔNG có bảng riêng: danh sách được suy ra lúc đọc từ
// TeacherReview (đã chấm xong) và AssignmentRecipient (bài mới giao). Nhờ vậy
// không phải sửa đường ghi khi chấm/giao bài — không có nguy cơ "chấm xong mà
// quên báo" — và bài cũ tự có mặt, khỏi script vá dữ liệu.
//
// Tệp này KHÔNG được import prisma: chuông là client component và import
// formatRelativeTime từ đây. Phần truy vấn nằm ở lib/notifications-feed.ts.

export const NOTIFICATION_LIMIT = 30;

export type StudentNotificationType = "review_done" | "assignment_new";

export type StudentNotification = {
  // "review:<attemptId>" | "assignment:<recipientId>" — đủ để làm key React và
  // để nhớ mục nào vừa xem, không cần id thật trong DB.
  id: string;
  type: StudentNotificationType;
  title: string;
  detail: string | null;
  href: string;
  createdAt: Date;
  unread: boolean;
};

export type ReviewNotificationSource = {
  attemptId: string;
  title: string;
  overallBand: number | null;
  reviewedAt: Date;
};

export type AssignmentNotificationSource = {
  recipientId: string;
  title: string;
  assignedAt: Date;
};

// readAt null = chưa từng có mốc. Coi như đã đọc hết thay vì chưa đọc hết, để
// học viên mới (hoặc DB chưa kịp có cột) không bị dội cả chục thông báo cũ.
function isUnread(createdAt: Date, readAt: Date | null): boolean {
  if (!readAt) {
    return false;
  }

  return createdAt.getTime() > readAt.getTime();
}

export function buildStudentNotifications(
  reviews: ReviewNotificationSource[],
  assignments: AssignmentNotificationSource[],
  readAt: Date | null
): StudentNotification[] {
  const items: StudentNotification[] = [
    ...reviews.map((item) => ({
      id: `review:${item.attemptId}`,
      type: "review_done" as const,
      title: item.title,
      detail: item.overallBand === null ? null : `Band ${item.overallBand}`,
      href: `/student/results/${item.attemptId}`,
      createdAt: item.reviewedAt,
      unread: isUnread(item.reviewedAt, readAt)
    })),
    ...assignments.map((item) => ({
      id: `assignment:${item.recipientId}`,
      type: "assignment_new" as const,
      title: item.title,
      detail: null,
      href: `/student/assignments/${item.recipientId}`,
      createdAt: item.assignedAt,
      unread: isUnread(item.assignedAt, readAt)
    }))
  ];

  items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return items.slice(0, NOTIFICATION_LIMIT);
}

export function countUnread(items: StudentNotification[]): number {
  return items.filter((item) => item.unread).length;
}

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Asia/Ho_Chi_Minh"
});

export function formatRelativeTime(value: Date, now: Date = new Date()): string {
  const minutes = Math.floor((now.getTime() - value.getTime()) / 60_000);

  if (minutes < 1) {
    return "Vừa xong";
  }

  if (minutes < 60) {
    return `${minutes} phút trước`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours} giờ trước`;
  }

  const days = Math.floor(hours / 24);

  if (days < 7) {
    return `${days} ngày trước`;
  }

  return dateFormatter.format(value);
}
```

- [ ] **Step 4: Chạy lại test**

Run: `npx vitest run tests/notifications.test.ts`
Expected: PASS toàn bộ.

- [ ] **Step 5: Commit**

```bash
git add lib/notifications.ts tests/notifications.test.ts
git commit -m "feat(thong-bao): logic gop va dem thong bao chua doc"
```

---

### Task 3: Đọc dữ liệu + đánh dấu đã đọc + route API

**Files:**
- Create: `lib/notifications-feed.ts`
- Create: `lib/actions/notifications.ts`
- Create: `app/api/student/notifications/route.ts`

**Interfaces:**
- Consumes: `buildStudentNotifications`, `countUnread`, `NOTIFICATION_LIMIT`, `StudentNotification` (Task 2); `requireStudent()` từ `lib/actions/attempts.ts` (trả về bản ghi `StudentProfile`, dùng `.id`); `warmUpDatabase(ping)` từ `lib/db-warmup.ts`; `excludePracticeAssignment`, `excludePracticeRecipient` từ `lib/practice.ts`.
- Produces:
  - `getStudentNotifications(studentId: string): Promise<{ items: StudentNotification[]; unreadCount: number }>`
  - `markNotificationsRead(): Promise<void>` (server action)
  - `GET /api/student/notifications` → `{ items, unreadCount }`

- [ ] **Step 1: Viết `lib/notifications-feed.ts`**

```ts
import {
  buildStudentNotifications,
  countUnread,
  NOTIFICATION_LIMIT,
  type StudentNotification
} from "@/lib/notifications";
import { excludePracticeAssignment, excludePracticeRecipient } from "@/lib/practice";
import { prisma } from "@/lib/prisma";

export type StudentNotificationFeed = {
  items: StudentNotification[];
  unreadCount: number;
};

// Bài tự luyện bị loại ở CẢ HAI nguồn: học viên tự bấm luyện thì không cần ai báo
// là "có bài mới", và bản thân bài luyện cũng không ai chấm tay.
export async function getStudentNotifications(
  studentId: string
): Promise<StudentNotificationFeed> {
  const [student, reviews, recipients] = await Promise.all([
    prisma.studentProfile.findUnique({
      where: { id: studentId },
      select: { notificationsReadAt: true }
    }),
    prisma.teacherReview.findMany({
      where: { studentId, attempt: { assignmentRecipient: excludePracticeRecipient } },
      orderBy: { reviewedAt: "desc" },
      take: NOTIFICATION_LIMIT,
      select: {
        attemptId: true,
        overallBand: true,
        reviewedAt: true,
        attempt: {
          select: {
            assignmentRecipient: { select: { assignment: { select: { title: true } } } }
          }
        }
      }
    }),
    prisma.assignmentRecipient.findMany({
      where: { studentId, assignment: excludePracticeAssignment },
      orderBy: { assignedAt: "desc" },
      take: NOTIFICATION_LIMIT,
      select: {
        id: true,
        assignedAt: true,
        assignment: { select: { title: true } }
      }
    })
  ]);

  const items = buildStudentNotifications(
    reviews.map((review) => ({
      attemptId: review.attemptId,
      title: review.attempt.assignmentRecipient.assignment.title,
      overallBand: review.overallBand,
      reviewedAt: review.reviewedAt
    })),
    recipients.map((recipient) => ({
      recipientId: recipient.id,
      title: recipient.assignment.title,
      assignedAt: recipient.assignedAt
    })),
    student?.notificationsReadAt ?? null
  );

  return { items, unreadCount: countUnread(items) };
}

// Dùng chung cho chuông (qua server action) và cho trang danh sách (gọi thẳng khi
// render, vì mở trang cũng tính là đã xem).
export async function touchNotificationsRead(studentId: string): Promise<void> {
  await prisma.studentProfile.update({
    where: { id: studentId },
    data: { notificationsReadAt: new Date() }
  });
}
```

- [ ] **Step 2: Viết server action `lib/actions/notifications.ts`**

```ts
"use server";

import { requireStudent } from "@/lib/actions/attempts";
import { touchNotificationsRead } from "@/lib/notifications-feed";

// Học viên mở chuông = đã xem. Không revalidatePath: số đếm do chuông tự lấy qua
// API, revalidate chỉ làm trang đang xem nhấp nháy vô ích.
export async function markNotificationsRead(): Promise<void> {
  const student = await requireStudent();

  await touchNotificationsRead(student.id);
}
```

- [ ] **Step 3: Viết route API `app/api/student/notifications/route.ts`**

```ts
import { NextResponse } from "next/server";
import { requireStudent } from "@/lib/actions/attempts";
import { warmUpDatabase } from "@/lib/db-warmup";
import { getStudentNotifications } from "@/lib/notifications-feed";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Chuông hỏng KHÔNG được phép làm vỡ giao diện học viên: mọi lỗi đều trả về
// "không có thông báo nào" kèm HTTP 200, lỗi thật thì ghi log để còn dò.
const EMPTY = { items: [], unreadCount: 0 };

export async function GET(): Promise<NextResponse> {
  // Đánh thức Neon TRƯỚC khi kiểm đăng nhập: requireStudent cũng truy vấn DB,
  // để nó chết vì DB đang ngủ thì học viên đang đăng nhập hẳn hoi lại bị 401.
  try {
    await warmUpDatabase(() => prisma.$queryRaw`SELECT 1`);
  } catch (error) {
    console.error("[thong-bao] DB chưa sẵn sàng:", error);
    return NextResponse.json(EMPTY);
  }

  let studentId: string;

  try {
    studentId = (await requireStudent()).id;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json(await getStudentNotifications(studentId));
  } catch (error) {
    console.error("[thong-bao] Không lấy được danh sách:", error);
    return NextResponse.json(EMPTY);
  }
}
```

- [ ] **Step 4: Kiểm biên dịch**

Run: `npx tsc --noEmit`
Expected: không có lỗi. (Nếu Prisma báo không biết `notificationsReadAt`, chạy lại `npx prisma generate`.)

- [ ] **Step 5: Commit**

```bash
git add lib/notifications-feed.ts lib/actions/notifications.ts app/api/student/notifications/route.ts
git commit -m "feat(thong-bao): truy van danh sach + route API cho hoc vien"
```

---

### Task 4: Chuông + bảng thả xuống

**Files:**
- Create: `components/notification-list.tsx` (một dòng thông báo, dùng lại ở Task 5)
- Create: `components/notification-bell.tsx`
- Modify: `components/app-shell.tsx`

**Interfaces:**
- Consumes: `formatRelativeTime`, `StudentNotificationType` (Task 2); `markNotificationsRead` (Task 3); `GET /api/student/notifications` (Task 3).
- Produces:
  - `type NotificationFeedItem` — bản JSON của `StudentNotification` (`createdAt` là chuỗi ISO)
  - `<NotificationRow item onNavigate? />`
  - `<NotificationBell />`

- [ ] **Step 1: Viết `components/notification-list.tsx`**

```tsx
"use client";

import Link from "next/link";
import { formatRelativeTime, type StudentNotificationType } from "@/lib/notifications";

// Bản đi qua JSON của StudentNotification: createdAt thành chuỗi ISO.
export type NotificationFeedItem = {
  id: string;
  type: StudentNotificationType;
  title: string;
  detail: string | null;
  href: string;
  createdAt: string;
  unread: boolean;
};

const LABELS: Record<StudentNotificationType, string> = {
  review_done: "Đã chấm xong",
  assignment_new: "Bài mới"
};

export function NotificationRow({
  item,
  onNavigate
}: {
  item: NotificationFeedItem;
  onNavigate?: () => void;
}) {
  const createdAt = new Date(item.createdAt);

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={
        item.unread
          ? "flex gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5 transition hover:border-primary"
          : "flex gap-3 rounded-lg border border-transparent px-3 py-2.5 transition hover:border-border hover:bg-muted"
      }
    >
      <span
        aria-hidden="true"
        className={
          item.unread
            ? "mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary"
            : "mt-1.5 h-2 w-2 shrink-0 rounded-full bg-transparent"
        }
      />
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {LABELS[item.type]}
          {item.detail ? ` · ${item.detail}` : ""}
        </span>
        <span
          className={
            item.unread
              ? "mt-0.5 block truncate text-sm font-semibold text-foreground"
              : "mt-0.5 block truncate text-sm text-foreground"
          }
        >
          {item.title}
        </span>
        {/* Giờ tương đối tính ở server rồi tính lại ở client — lệch một nhịp phút
            là chuyện bình thường, không phải lỗi hydrate cần cảnh báo. */}
        <span className="mt-0.5 block text-xs text-muted-foreground" suppressHydrationWarning>
          {formatRelativeTime(createdAt)}
        </span>
      </span>
    </Link>
  );
}

export function NotificationEmpty() {
  return (
    <p className="px-3 py-6 text-center text-sm text-muted-foreground">Chưa có thông báo nào.</p>
  );
}
```

- [ ] **Step 2: Viết `components/notification-bell.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { markNotificationsRead } from "@/lib/actions/notifications";
import {
  NotificationEmpty,
  NotificationRow,
  type NotificationFeedItem
} from "@/components/notification-list";

const POLL_MS = 60_000;
const PANEL_LIMIT = 8;

export function NotificationBell() {
  const pathname = usePathname();
  const [items, setItems] = useState<NotificationFeedItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Mục đang chưa đọc lúc mở chuông: giữ dấu "mới" cho tới khi tải lại trang, để
  // học viên không mất dấu thứ vừa bấm vào xem.
  const stickyUnread = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/student/notifications", { cache: "no-store" });

      if (!response.ok) {
        return;
      }

      const data = (await response.json()) as {
        items?: NotificationFeedItem[];
        unreadCount?: number;
      };

      setItems(Array.isArray(data.items) ? data.items : []);
      setUnreadCount(Number(data.unreadCount) || 0);
    } catch {
      // Mất mạng: giữ nguyên số cũ, 60 giây nữa thử lại.
    }
  }, []);

  // Tải lại mỗi khi chuyển trang — layout của Next không dựng lại khi điều hướng
  // nên chuông phải tự làm việc này.
  useEffect(() => {
    void load();
  }, [load, pathname]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      // Tab bị ẩn thì thôi, đỡ đánh thức Neon vô ích.
      if (document.visibilityState === "visible") {
        void load();
      }
    }, POLL_MS);

    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function toggle() {
    const next = !open;
    setOpen(next);

    if (!next || unreadCount === 0) {
      return;
    }

    for (const item of items) {
      if (item.unread) {
        stickyUnread.current.add(item.id);
      }
    }

    setUnreadCount(0);
    // Lỗi thì bỏ qua: lần mở chuông sau sẽ thử lại.
    void markNotificationsRead().catch(() => {});
  }

  const panelItems = items.slice(0, PANEL_LIMIT).map((item) => ({
    ...item,
    unread: item.unread || stickyUnread.current.has(item.id)
  }));

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={unreadCount > 0 ? `Thông báo (${unreadCount} chưa đọc)` : "Thông báo"}
        aria-expanded={open}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-foreground transition hover:border-primary hover:text-primary"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
          aria-hidden="true"
        >
          <path d="M18 8.5a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16s-2-1.5-2-6.5" />
          <path d="M10.5 19a2 2 0 0 0 3 0" />
        </svg>
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-[18px] text-destructive-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-border bg-card p-2 shadow-pop">
          <p className="px-3 pb-2 pt-1 text-sm font-semibold">Thông báo</p>

          {panelItems.length > 0 ? (
            <div className="grid max-h-80 gap-1 overflow-y-auto">
              {panelItems.map((item) => (
                <NotificationRow key={item.id} item={item} onNavigate={() => setOpen(false)} />
              ))}
            </div>
          ) : (
            <NotificationEmpty />
          )}

          <Link
            href="/student/notifications"
            onClick={() => setOpen(false)}
            className="mt-1 block rounded-lg px-3 py-2 text-center text-sm font-semibold text-primary transition hover:bg-primary/10"
          >
            Xem tất cả
          </Link>
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 3: Gắn chuông vào `components/app-shell.tsx`**

Thêm import ở đầu tệp:

```tsx
import { NotificationBell } from "@/components/notification-bell";
```

Trong thanh trên cùng cho điện thoại, thay:

```tsx
        <Brand role={role} />
        <AnimatedThemeToggle />
      </header>
```

bằng:

```tsx
        <Brand role={role} />
        <div className="flex items-center gap-2">
          {role === "student" ? <NotificationBell /> : null}
          <AnimatedThemeToggle />
        </div>
      </header>
```

Trong sidebar máy tính, thay:

```tsx
            <Brand role={role} />
            <AnimatedThemeToggle />
          </div>
```

bằng:

```tsx
            <Brand role={role} />
            <div className="flex items-center gap-2">
              {role === "student" ? <NotificationBell /> : null}
              <AnimatedThemeToggle />
            </div>
          </div>
```

Lưu ý: chỉ sửa hai chỗ này. Khối `Brand` trong drawer điện thoại giữ nguyên — drawer đã có menu đầy đủ, nhét thêm chuông vào đó là thừa.

- [ ] **Step 4: Kiểm biên dịch và lint**

Run: `npx tsc --noEmit && pnpm lint`
Expected: không lỗi.

- [ ] **Step 5: Commit**

```bash
git add components/notification-list.tsx components/notification-bell.tsx components/app-shell.tsx
git commit -m "feat(thong-bao): chuong thong bao + bang tha xuong cho hoc vien"
```

---

### Task 5: Trang `/student/notifications`

**Files:**
- Create: `app/student/notifications/page.tsx`

**Interfaces:**
- Consumes: `getStudentNotifications`, `touchNotificationsRead` (Task 3); `NotificationRow`, `NotificationEmpty`, `NotificationFeedItem` (Task 4); `auth()` từ `lib/auth.ts`.
- Produces: không có gì cho task sau.

- [ ] **Step 1: Viết trang**

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStudentNotifications, touchNotificationsRead } from "@/lib/notifications-feed";
import {
  NotificationEmpty,
  NotificationRow,
  type NotificationFeedItem
} from "@/components/notification-list";

export const dynamic = "force-dynamic";

export default async function StudentNotificationsPage() {
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

  const { items } = await getStudentNotifications(student.id);

  // Mở trang này cũng tính là đã xem. Phải đặt SAU khi đã lấy items, nếu không
  // mọi mục đều thành "đã đọc" ngay trong lần hiển thị đầu tiên.
  await touchNotificationsRead(student.id);

  const feedItems: NotificationFeedItem[] = items.map((item) => ({
    ...item,
    createdAt: item.createdAt.toISOString()
  }));

  return (
    <div className="grid gap-5">
      <header className="grid gap-1">
        <h1 className="text-2xl font-semibold">Thông báo</h1>
        <p className="text-sm text-muted-foreground">
          Bài đã chấm xong và bài mới được giao, mới nhất lên đầu.
        </p>
      </header>

      <section className="rounded-xl border border-border bg-card p-2">
        {feedItems.length > 0 ? (
          <div className="grid gap-1">
            {feedItems.map((item) => (
              <NotificationRow key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <NotificationEmpty />
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Chạy toàn bộ test và build**

Run: `pnpm test`
Expected: PASS toàn bộ, kể cả `tests/notifications.test.ts`.

Run: `pnpm build`
Expected: build xanh, route `/student/notifications` và `/api/student/notifications` có trong bảng tổng kết.

- [ ] **Step 3: Commit**

```bash
git add app/student/notifications/page.tsx
git commit -m "feat(thong-bao): trang danh sach thong bao cho hoc vien"
```

- [ ] **Step 4: Đẩy lên để Vercel deploy**

```bash
git push origin feature/ielts-platform-mvp
```

- [ ] **Step 5: Kiểm trên bản deploy**

Chờ deploy xong, rồi kiểm:
1. Đăng nhập học viên (cần người dùng đăng nhập hộ — Claude không gõ được mật khẩu).
2. Xem chuông có xuất hiện ở sidebar và ở thanh trên cùng khi thu nhỏ cửa sổ không.
3. Bấm chuông: bảng thả xuống hiện danh sách, "Xem tất cả" mở đúng `/student/notifications`.
4. Giáo viên chấm một bài Writing/Speaking → chờ tối đa 60 giây → chuông của học viên đỏ lên mà không cần F5.
5. Bấm vào thông báo → mở đúng `/student/results/<attemptId>` và thấy nhận xét.
