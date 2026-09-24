# Lịch học cho học viên — Kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Học viên có trang Lịch học (buổi học + hạn nộp theo tháng), thẻ "Buổi học tới", chuông báo đổi lịch; giáo viên đặt lịch cố định từng lớp, sửa từng buổi, và có chip hạn nộp "Trước buổi tới".

**Architecture:** Lịch cố định (`ClassScheduleSlot`) được "đồng bộ" thành từng dòng `ClassSession` bằng hàm thuần `planRegularSessions` (`lib/class-schedule.ts`). Server action chỉ đọc DB → gọi hàm thuần → ghi kết quả trong `$transaction`. Mọi hiển thị (lưới tháng, số buổi, nhãn giờ, câu thông báo) cũng là hàm thuần có test. Thông báo vẫn suy ra từ dữ liệu, không có bảng Notification.

**Tech Stack:** Next.js 14 App Router, React 18, Prisma + PostgreSQL (Neon), zod 4, Tailwind 3.4, vitest.

**Spec:** `docs/superpowers/specs/2026-09-24-lich-hoc-hoc-vien-design.md`

## Global Constraints

- Chữ hiển thị và comment code bằng **tiếng Việt** (có dấu), giống các file hiện có.
- Giờ VN = UTC+7 cố định; lưu `DateTime` UTC, đổi giờ bằng `VN_OFFSET_MS` (`lib/streak.ts`) / `vnDateKey` (`lib/attendance.ts`). Không dùng `Intl` timeZone trong hàm thuần mới.
- Chạy được trên **iOS Safari 15.6 / Chrome 90**: code phía client không dùng `toSorted`, `toReversed`, `findLast`, `structuredClone`, `Array.prototype.at`.
- Enum là cột `String`: giữ khớp 3 chỗ — chú thích đầu `schema.prisma`, `z.enum(...)` trong action, test cấu trúc.
- Mọi server action gọi `await requireTeacher()` **đầu tiên** và lọc truy vấn theo `teacherId: teacher.id`.
- Mọi cột/bảng mới phải có câu tương ứng trong `scripts/ensure-db.mjs` (tự áp lên prod lúc build).
- Truy vấn bảng mới ở trang học viên / chuông phải bọc `try/catch` (DB prod có thể chưa kịp có bảng).
- Ghi chú buổi học là văn bản thuần — không `dangerouslySetInnerHTML`.
- Overlay `fixed` phải `createPortal` ra `document.body` (bẫy `animate-fade-in`).
- Test chạy: `npx vitest run <file>`; cả bộ: `pnpm test`. Lint: `pnpm lint`. Kiểu: `npx tsc --noEmit`.
- Commit message tiếng Việt không dấu theo kiểu repo (`feat(lich-hoc): ...`), kết thúc bằng dòng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Không `git add` các file rác đang có sẵn trong `tmp/`, `pnpm-workspace.yaml`, `tsconfig.tsbuildinfo` — chỉ add đúng file của task.

## File Structure

| File | Trách nhiệm |
| --- | --- |
| `prisma/schema.prisma` (sửa) | 6 cột lịch trên `Class`, model `ClassScheduleSlot`, `ClassSession`, chú thích enum |
| `scripts/ensure-db.mjs` (sửa) | ALTER/CREATE cho prod |
| `lib/class-schedule.ts` (mới) | Hàm thuần miền "lịch học": giờ VN, đọc khung giờ, đồng bộ buổi, đánh số, buổi tới, nhãn giờ, phát hiện thay đổi, câu thông báo, chip hạn nộp |
| `lib/student-calendar.ts` (mới) | Hàm thuần của trang Lịch học học viên: sự kiện, lưới tháng, trạng thái hạn nộp, tham số URL |
| `lib/class-schedule-sync.ts` (mới) | Prisma: `syncClassSessions`, `topUpClassSessions` |
| `lib/class-schedule-query.ts` (mới) | Prisma: đọc lịch cho học viên / giáo viên (bọc try/catch) |
| `lib/actions/class-schedule.ts` (mới) | 4 server action của giáo viên |
| `components/session-badges.tsx` (mới) | Nhãn Nghỉ / Online / Trực tiếp / Học bù / Tăng cường |
| `components/class-schedule-form.tsx` (mới) | Form lịch cố định (GV) |
| `components/class-session-list.tsx` (mới) | Danh sách buổi (GV) |
| `components/class-session-editor.tsx` (mới) | Modal sửa/thêm buổi (GV) |
| `components/student-calendar.tsx` (mới) | Lưới tháng + danh sách ngày (HS) |
| `components/next-session-card.tsx` (mới) | Thẻ "Buổi học tới" (HS) |
| `components/due-date-time-inputs.tsx` (mới) | Cụm Ngày/Giờ hạn nộp có chip "Trước buổi tới" |
| `app/student/calendar/page.tsx` (mới) | Trang Lịch học |
| `app/teacher/classes/[classId]/page.tsx` (sửa) | Thêm khối Lịch học |
| `app/student/page.tsx` (sửa) | Thẻ Buổi học tới |
| `app/teacher/assignments/page.tsx`, `components/assignment-builder.tsx`, `components/due-date-field.tsx` (sửa) | Chip hạn nộp |
| `lib/notifications.ts`, `lib/notifications-feed.ts`, `components/notification-list.tsx` (sửa) | 2 loại thông báo mới |
| `app/api/cron/reminders/route.ts` (sửa) | Nối buổi cho lớp học liên tục |
| `components/app-shell.tsx`, `components/action-form.tsx` (sửa) | Mục menu "Lịch học"; `onResult` cho `ActionDeleteButton` |

---

### Task 1: Schema + ensure-db

**Files:**
- Modify: `prisma/schema.prisma` (khối chú thích enum dòng 10–19; `model Class` dòng 108–121)
- Modify: `scripts/ensure-db.mjs` (cuối mảng `statements`, trước dòng 222 `];`)
- Test: `tests/class-schedule-schema.test.ts`

**Interfaces:**
- Produces: Prisma models `ClassScheduleSlot { id, classId, weekday, startMinute, endMinute }`, `ClassSession { id, classId, startsAt, endsAt, status, mode, kind, meetingUrl, note, originalStartsAt, edited, changeKind, changedAt, createdAt, updatedAt }`; `Class` thêm `scheduleStartDate, totalSessions, scheduleEndDate, location, scheduleAppliesFrom, scheduleChangedAt, scheduleSlots, sessions`.

- [ ] **Step 1: Viết test cấu trúc (fail)**

`tests/class-schedule-schema.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(relative: string): string {
  return readFileSync(join(process.cwd(), ...relative.split("/")), "utf8");
}

const schema = read("prisma/schema.prisma");
const ensureDb = read("scripts/ensure-db.mjs");

function modelBlock(name: string): string {
  return schema.split(`model ${name} {`)[1]?.split("\n}")[0] ?? "";
}

const CLASS_COLUMNS: Array<[string, string]> = [
  ["scheduleStartDate", "TIMESTAMP(3)"],
  ["totalSessions", "INTEGER"],
  ["scheduleEndDate", "TIMESTAMP(3)"],
  ["location", "TEXT"],
  ["scheduleAppliesFrom", "TIMESTAMP(3)"],
  ["scheduleChangedAt", "TIMESTAMP(3)"]
];

describe("lược đồ lịch học", () => {
  it.each(CLASS_COLUMNS)("Class có cột %s", (column) => {
    expect(modelBlock("Class")).toMatch(new RegExp(`\\n\\s*${column}\\s+\\w+\\?`));
  });

  // Dự án dùng db push, không có migrations: thiếu dòng này là prod 500 ngay lần deploy đầu.
  it.each(CLASS_COLUMNS)("ensure-db thêm cột Class.%s", (column, type) => {
    expect(ensureDb).toContain(`ALTER TABLE "Class" ADD COLUMN IF NOT EXISTS "${column}" ${type};`);
  });

  it("có model ClassScheduleSlot và ClassSession", () => {
    expect(modelBlock("ClassScheduleSlot")).toContain("weekday");
    expect(modelBlock("ClassSession")).toContain("originalStartsAt");
    expect(modelBlock("ClassSession")).toContain("@@index([classId, startsAt])");
  });

  it("ensure-db tạo 2 bảng mới kèm khoá ngoại và index", () => {
    expect(ensureDb).toContain('CREATE TABLE IF NOT EXISTS "ClassScheduleSlot"');
    expect(ensureDb).toContain('CREATE TABLE IF NOT EXISTS "ClassSession"');
    expect(ensureDb).toContain("ClassScheduleSlot_classId_fkey");
    expect(ensureDb).toContain("ClassSession_classId_fkey");
    expect(ensureDb).toContain('"ClassScheduleSlot_classId_idx"');
    expect(ensureDb).toContain('"ClassSession_classId_startsAt_idx"');
  });

  it("chú thích enum khớp giá trị", () => {
    expect(schema).toContain("// enum SessionStatus (ClassSession.status): scheduled | cancelled");
    expect(schema).toContain("// enum SessionMode (ClassSession.mode): offline | online");
    expect(schema).toContain("// enum SessionKind (ClassSession.kind): regular | makeup | extra");
    expect(schema).toContain(
      "// enum SessionChangeKind (ClassSession.changeKind): cancelled | restored | moved | online | offline | added"
    );
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run tests/class-schedule-schema.test.ts`
Expected: FAIL (thiếu cột / model / câu ensure-db).

- [ ] **Step 3: Sửa `prisma/schema.prisma`**

Thêm vào cuối khối chú thích enum (sau dòng `// enum BugStatus (BugReport.status): open | resolved`):

```prisma
// enum SessionStatus (ClassSession.status): scheduled | cancelled
// enum SessionMode (ClassSession.mode): offline | online
// enum SessionKind (ClassSession.kind): regular | makeup | extra
// enum SessionChangeKind (ClassSession.changeKind): cancelled | restored | moved | online | offline | added
```

Thay `model Class { ... }` bằng:

```prisma
model Class {
  id          String         @id @default(cuid())
  teacherId   String
  name        String
  description String?
  weeklyGoal  Int?
  // ---- Lịch học (tuỳ chọn) ----
  // Ngày khai giảng, lưu mốc 00:00 giờ VN của ngày đó.
  scheduleStartDate   DateTime?
  // Số buổi của khoá. Có giá trị -> hiện "Buổi X/Y" và giữ đủ Y buổi có học.
  totalSessions       Int?
  // Ngày kết thúc (00:00 giờ VN, tính cả ngày đó). Dùng khi không đặt số buổi.
  scheduleEndDate     DateTime?
  // Địa điểm mặc định cho buổi trực tiếp (phòng/địa chỉ), văn bản thuần.
  location            String?
  // Lịch cố định áp dụng từ mốc này. Buổi trước mốc không bao giờ bị tạo lại tự động.
  scheduleAppliesFrom DateTime?
  // Lần gần nhất lịch cố định thực sự đổi -> thông báo "Lịch học lớp X vừa được cập nhật".
  scheduleChangedAt   DateTime?
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt
  teacher     TeacherProfile @relation(fields: [teacherId], references: [id], onDelete: Cascade)
  students    ClassStudent[]
  assignments Assignment[]
  scheduleSlots ClassScheduleSlot[]
  sessions      ClassSession[]

  @@index([teacherId])
}

// Một khung giờ trong lịch cố định hàng tuần của lớp.
model ClassScheduleSlot {
  id          String @id @default(cuid())
  classId     String
  weekday     Int // 1 = Thứ 2 … 6 = Thứ 7, 7 = Chủ nhật (ISO)
  startMinute Int // phút tính từ 00:00 giờ VN, vd 20:15 = 1215
  endMinute   Int
  class       Class  @relation(fields: [classId], references: [id], onDelete: Cascade)

  @@index([classId])
}

// Một buổi học cụ thể. Buổi theo lịch cố định do lib/class-schedule-sync.ts tạo;
// giáo viên sửa tay từng buổi (nghỉ, dời, online, ghi chú) hoặc thêm buổi bù.
model ClassSession {
  id               String    @id @default(cuid())
  classId          String
  startsAt         DateTime
  endsAt           DateTime
  status           String    @default("scheduled") // SessionStatus
  mode             String    @default("offline") // SessionMode
  kind             String    @default("regular") // SessionKind
  meetingUrl       String?
  note             String?
  // Giờ gốc trước khi dời. Null = chưa từng dời. Dùng để hiện "Dời từ T4 23/9"
  // và để khung giờ gốc không bị tạo lại thành một buổi trùng.
  originalStartsAt DateTime?
  // Giáo viên đã sửa tay -> không bị xoá/tạo lại khi đổi lịch cố định.
  edited           Boolean   @default(false)
  // Lần sửa tay gần nhất đáng báo cho học viên (SessionChangeKind) + thời điểm.
  changeKind       String?
  changedAt        DateTime?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
  class            Class     @relation(fields: [classId], references: [id], onDelete: Cascade)

  @@index([classId, startsAt])
}
```

- [ ] **Step 4: Thêm câu lệnh vào `scripts/ensure-db.mjs`**

Chèn ngay trước dòng `];` (dòng 222):

```js
  // Lịch học của lớp: 6 cột tuỳ chọn trên Class + bảng lịch cố định + bảng từng buổi.
  'ALTER TABLE "Class" ADD COLUMN IF NOT EXISTS "scheduleStartDate" TIMESTAMP(3);',
  'ALTER TABLE "Class" ADD COLUMN IF NOT EXISTS "totalSessions" INTEGER;',
  'ALTER TABLE "Class" ADD COLUMN IF NOT EXISTS "scheduleEndDate" TIMESTAMP(3);',
  'ALTER TABLE "Class" ADD COLUMN IF NOT EXISTS "location" TEXT;',
  'ALTER TABLE "Class" ADD COLUMN IF NOT EXISTS "scheduleAppliesFrom" TIMESTAMP(3);',
  'ALTER TABLE "Class" ADD COLUMN IF NOT EXISTS "scheduleChangedAt" TIMESTAMP(3);',
  `CREATE TABLE IF NOT EXISTS "ClassScheduleSlot" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    CONSTRAINT "ClassScheduleSlot_pkey" PRIMARY KEY ("id")
  );`,
  'CREATE INDEX IF NOT EXISTS "ClassScheduleSlot_classId_idx" ON "ClassScheduleSlot"("classId");',
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ClassScheduleSlot_classId_fkey') THEN
      ALTER TABLE "ClassScheduleSlot" ADD CONSTRAINT "ClassScheduleSlot_classId_fkey"
      FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END $$;`,
  `CREATE TABLE IF NOT EXISTS "ClassSession" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "mode" TEXT NOT NULL DEFAULT 'offline',
    "kind" TEXT NOT NULL DEFAULT 'regular',
    "meetingUrl" TEXT,
    "note" TEXT,
    "originalStartsAt" TIMESTAMP(3),
    "edited" BOOLEAN NOT NULL DEFAULT false,
    "changeKind" TEXT,
    "changedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ClassSession_pkey" PRIMARY KEY ("id")
  );`,
  'CREATE INDEX IF NOT EXISTS "ClassSession_classId_startsAt_idx" ON "ClassSession"("classId", "startsAt");',
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ClassSession_classId_fkey') THEN
      ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_classId_fkey"
      FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END $$;`,
```

- [ ] **Step 5: Chạy test, xác nhận pass**

Run: `npx vitest run tests/class-schedule-schema.test.ts`
Expected: PASS.

- [ ] **Step 6: Đẩy schema lên DB test local + sinh Prisma Client**

Trước hết xác nhận `.env` trỏ DB test "ielts-test" (KHÔNG phải prod "IELTS_Platform"): `node -e "require('dotenv').config(); console.log(new URL(process.env.DATABASE_URL).host)"` rồi so với host đã ghi trong memory `neon-prod-vs-local-db`. Sau đó:

Run: `npx prisma db push`
Expected: "Your database is now in sync with your Prisma schema" + "Generated Prisma Client". (Nếu `EPERM` khi rename engine vì dev server đang chạy: dừng dev server rồi chạy lại.)

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma scripts/ensure-db.mjs tests/class-schedule-schema.test.ts
git commit -m "feat(lich-hoc): schema lich co dinh + tung buoi hoc, ensure-db cho prod"
```

---

### Task 2: `lib/class-schedule.ts` — giờ VN, khung giờ, đồng bộ buổi, đánh số

**Files:**
- Create: `lib/class-schedule.ts`
- Test: `tests/class-schedule.test.ts`

**Interfaces:**
- Consumes: `VN_OFFSET_MS` (`lib/streak.ts`), `vnDateKey(date: Date): string` (`lib/attendance.ts`).
- Produces (dùng ở Task 3–11):
  - `type ScheduleSlot = { weekday: number; startMinute: number; endMinute: number }`
  - `type SessionForPlan = { id: string; startsAt: Date; endsAt: Date; status: string; kind: string; edited: boolean; originalStartsAt: Date | null }`
  - `type PlannedSession = { startsAt: Date; endsAt: Date }`
  - `WEEKDAY_SHORT`, `WEEKDAY_LONG` (mảng, chỉ số 1..7), `CONTINUOUS_HORIZON_DAYS = 84`, `MAX_PLAN_DAYS = 730`
  - `parseHm(value: string): number | null`, `formatHm(minute: number): string`
  - `vnMidnight(ymd: string): Date`, `vnDateTime(ymd: string, minute: number): Date`, `vnIsoWeekday(date: Date): number`, `vnMinuteOfDay(date: Date): number`, `formatVnTime(date: Date): string`, `formatShortDate(date: Date): string`
  - `parseScheduleSlots(raw: unknown): ScheduleSlot[]` (ném `Error` tiếng Việt)
  - `scheduleSignature(input: { slots: ScheduleSlot[]; startDate: Date | null; totalSessions: number | null; endDate: Date | null; location: string | null }): string`
  - `isCountedSession(s: { status: string; kind: string }): boolean`
  - `planRegularSessions(input: { slots: ScheduleSlot[]; scheduleStartDate: Date | null; scheduleEndDate: Date | null; totalSessions: number | null; existing: SessionForPlan[]; applyFrom: Date; now: Date }): { create: PlannedSession[]; deleteIds: string[] }`
  - `numberSessions(sessions: Array<{ id: string; startsAt: Date; status: string; kind: string }>): Map<string, number>`
  - `sessionNumberText(number: number | null, total: number | null): string | null`

- [ ] **Step 1: Viết test (fail)**

`tests/class-schedule.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  formatHm,
  formatShortDate,
  numberSessions,
  parseHm,
  parseScheduleSlots,
  planRegularSessions,
  scheduleSignature,
  sessionNumberText,
  vnDateTime,
  vnIsoWeekday,
  vnMidnight,
  type ScheduleSlot,
  type SessionForPlan
} from "../lib/class-schedule";

const at = (ymd: string, hm: string) => vnDateTime(ymd, parseHm(hm) as number);

function row(id: string, startsAt: Date, endsAt: Date, extra: Partial<SessionForPlan> = {}): SessionForPlan {
  return { id, startsAt, endsAt, status: "scheduled", kind: "regular", edited: false, originalStartsAt: null, ...extra };
}

// Lịch thật của lớp PĐ K2: tối Thứ 3 20:15–21:45, sáng Thứ 7 9:00–10:30.
const PD_K2: ScheduleSlot[] = [
  { weekday: 2, startMinute: 1215, endMinute: 1305 },
  { weekday: 6, startMinute: 540, endMinute: 630 }
];

// 4 buổi đầu của PĐ K2 khi khai giảng 1/9/2026 (Thứ 3).
function pdK2Rows(): SessionForPlan[] {
  return [
    row("s1", at("2026-09-01", "20:15"), at("2026-09-01", "21:45")),
    row("s2", at("2026-09-05", "09:00"), at("2026-09-05", "10:30")),
    row("s3", at("2026-09-08", "20:15"), at("2026-09-08", "21:45")),
    row("s4", at("2026-09-12", "09:00"), at("2026-09-12", "10:30"))
  ];
}

const BASE = {
  slots: PD_K2,
  scheduleStartDate: vnMidnight("2026-09-01"),
  scheduleEndDate: null,
  totalSessions: 4,
  applyFrom: vnMidnight("2026-09-01"),
  now: vnMidnight("2026-08-25")
};

const starts = (items: Array<{ startsAt: Date }>) => items.map((item) => item.startsAt.toISOString());

describe("giờ VN", () => {
  it("parseHm / formatHm", () => {
    expect(parseHm("20:15")).toBe(1215);
    expect(parseHm("9:00")).toBe(540);
    expect(parseHm("24:00")).toBeNull();
    expect(parseHm("abc")).toBeNull();
    expect(formatHm(540)).toBe("09:00");
    expect(formatHm(1215)).toBe("20:15");
  });

  it("vnDateTime đổi giờ VN sang UTC", () => {
    expect(at("2026-09-01", "20:15").toISOString()).toBe("2026-09-01T13:15:00.000Z");
    expect(at("2026-09-05", "06:00").toISOString()).toBe("2026-09-04T23:00:00.000Z");
  });

  it("vnIsoWeekday tính theo giờ VN (1 = Thứ 2, 7 = CN)", () => {
    expect(vnIsoWeekday(at("2026-09-01", "20:15"))).toBe(2);
    expect(vnIsoWeekday(at("2026-09-27", "00:30"))).toBe(7);
  });

  it("formatShortDate", () => {
    expect(formatShortDate(at("2026-09-26", "20:15"))).toBe("T7 26/9");
    expect(formatShortDate(at("2026-09-27", "20:00"))).toBe("CN 27/9");
  });
});

describe("parseScheduleSlots", () => {
  it("đọc và sắp theo thứ rồi giờ", () => {
    expect(
      parseScheduleSlots([
        { weekday: 6, start: "09:00", end: "10:30" },
        { weekday: 2, start: "20:15", end: "21:45" }
      ])
    ).toEqual([
      { weekday: 2, startMinute: 1215, endMinute: 1305 },
      { weekday: 6, startMinute: 540, endMinute: 630 }
    ]);
  });

  it("từ chối giờ kết thúc không sau giờ bắt đầu", () => {
    expect(() => parseScheduleSlots([{ weekday: 2, start: "20:15", end: "20:15" }])).toThrow(/giờ kết thúc/);
  });

  it("từ chối khung giờ trùng", () => {
    expect(() =>
      parseScheduleSlots([
        { weekday: 2, start: "20:15", end: "21:45" },
        { weekday: 2, start: "20:15", end: "21:30" }
      ])
    ).toThrow(/trùng/);
  });

  it("từ chối thứ không hợp lệ, dữ liệu không phải mảng, quá 14 khung", () => {
    expect(() => parseScheduleSlots([{ weekday: 8, start: "20:15", end: "21:45" }])).toThrow();
    expect(() => parseScheduleSlots("x")).toThrow();
    const many = Array.from({ length: 15 }, (_, i) => ({ weekday: 1, start: `${String(i + 6).padStart(2, "0")}:00`, end: `${String(i + 6).padStart(2, "0")}:30` }));
    expect(() => parseScheduleSlots(many)).toThrow(/14/);
  });
});

describe("scheduleSignature", () => {
  const base = { slots: PD_K2, startDate: vnMidnight("2026-09-01"), totalSessions: 24, endDate: null, location: null };

  it("không phụ thuộc thứ tự khung giờ", () => {
    expect(scheduleSignature(base)).toBe(scheduleSignature({ ...base, slots: [PD_K2[1], PD_K2[0]] }));
  });

  it("đổi địa điểm hoặc số buổi là khác", () => {
    expect(scheduleSignature(base)).not.toBe(scheduleSignature({ ...base, location: "Phòng 2" }));
    expect(scheduleSignature(base)).not.toBe(scheduleSignature({ ...base, totalSessions: 20 }));
  });
});

describe("planRegularSessions", () => {
  it("lớp PĐ K2 24 buổi: sinh đúng ngày giờ và dừng ở buổi thứ N", () => {
    const plan = planRegularSessions({ ...BASE, existing: [] });
    expect(starts(plan.create)).toEqual(starts(pdK2Rows()));
    expect(plan.create[0].endsAt.toISOString()).toBe("2026-09-01T14:45:00.000Z");
    expect(plan.deleteIds).toEqual([]);
  });

  it("chạy lại lần hai không đổi gì", () => {
    const plan = planRegularSessions({ ...BASE, existing: pdK2Rows() });
    expect(plan).toEqual({ create: [], deleteIds: [] });
  });

  it("cho nghỉ 1 buổi -> cuối khoá thêm 1 buổi, buổi nghỉ không mọc lại", () => {
    const rows = pdK2Rows();
    rows[1] = { ...rows[1], status: "cancelled", edited: true };
    const plan = planRegularSessions({ ...BASE, existing: rows });
    expect(starts(plan.create)).toEqual([at("2026-09-15", "20:15").toISOString()]);
    expect(plan.deleteIds).toEqual([]);
  });

  it("thêm học bù -> buổi cuối khoá tự rút đi", () => {
    const makeup = row("m1", at("2026-09-06", "20:15"), at("2026-09-06", "21:45"), { kind: "makeup", edited: true });
    const plan = planRegularSessions({ ...BASE, existing: [...pdK2Rows(), makeup] });
    expect(plan).toEqual({ create: [], deleteIds: ["s4"] });
  });

  it("buổi tăng cường không ảnh hưởng số buổi", () => {
    const extra = row("x1", at("2026-09-06", "20:15"), at("2026-09-06", "21:45"), { kind: "extra", edited: true });
    const plan = planRegularSessions({ ...BASE, existing: [...pdK2Rows(), extra] });
    expect(plan).toEqual({ create: [], deleteIds: [] });
  });

  it("buổi đã dời không mọc lại ở giờ gốc", () => {
    const rows = pdK2Rows();
    rows[2] = {
      ...rows[2],
      startsAt: at("2026-09-09", "20:15"),
      endsAt: at("2026-09-09", "21:45"),
      originalStartsAt: at("2026-09-08", "20:15"),
      edited: true
    };
    const plan = planRegularSessions({ ...BASE, existing: rows });
    expect(plan).toEqual({ create: [], deleteIds: [] });
  });

  it("đổi lịch cố định: giữ buổi trước applyFrom và buổi đã sửa tay, tạo lại phần còn lại", () => {
    const rows = pdK2Rows();
    rows[2] = { ...rows[2], edited: true };
    const plan = planRegularSessions({
      ...BASE,
      slots: [{ weekday: 3, startMinute: 1080, endMinute: 1170 }],
      existing: rows,
      applyFrom: vnMidnight("2026-09-06"),
      now: vnMidnight("2026-09-06")
    });
    expect(plan.deleteIds).toEqual(["s4"]);
    expect(starts(plan.create)).toEqual([at("2026-09-09", "18:00").toISOString()]);
  });

  it("bỏ hết khung giờ -> xoá các buổi thay được", () => {
    const plan = planRegularSessions({ ...BASE, slots: [], existing: pdK2Rows(), applyFrom: vnMidnight("2026-09-06") });
    expect(plan).toEqual({ create: [], deleteIds: ["s3", "s4"] });
  });

  it("lớp học liên tục: giữ sẵn 12 tuần kể từ now", () => {
    const now = at("2026-09-24", "10:00");
    const plan = planRegularSessions({
      slots: [
        { weekday: 4, startMinute: 1200, endMinute: 1290 },
        { weekday: 7, startMinute: 1200, endMinute: 1290 }
      ],
      scheduleStartDate: vnMidnight("2026-09-24"),
      scheduleEndDate: null,
      totalSessions: null,
      existing: [],
      applyFrom: now,
      now
    });
    expect(plan.create).toHaveLength(24);
    expect(plan.create[0].startsAt.toISOString()).toBe(at("2026-09-24", "20:00").toISOString());
    expect(plan.create[23].startsAt.toISOString()).toBe(at("2026-12-13", "20:00").toISOString());
  });

  it("lớp có ngày kết thúc: tính cả ngày kết thúc", () => {
    const plan = planRegularSessions({
      slots: [{ weekday: 4, startMinute: 1200, endMinute: 1290 }],
      scheduleStartDate: vnMidnight("2026-09-24"),
      scheduleEndDate: vnMidnight("2026-10-08"),
      totalSessions: null,
      existing: [],
      applyFrom: vnMidnight("2026-09-24"),
      now: vnMidnight("2026-09-20")
    });
    expect(starts(plan.create)).toEqual([
      at("2026-09-24", "20:00").toISOString(),
      at("2026-10-01", "20:00").toISOString(),
      at("2026-10-08", "20:00").toISOString()
    ]);
  });

  it("ngày khai giảng sau applyFrom -> bắt đầu từ ngày khai giảng", () => {
    const plan = planRegularSessions({
      slots: [{ weekday: 4, startMinute: 1200, endMinute: 1290 }],
      scheduleStartDate: vnMidnight("2026-10-01"),
      scheduleEndDate: null,
      totalSessions: 2,
      existing: [],
      applyFrom: vnMidnight("2026-09-24"),
      now: vnMidnight("2026-09-24")
    });
    expect(starts(plan.create)).toEqual([
      at("2026-10-01", "20:00").toISOString(),
      at("2026-10-08", "20:00").toISOString()
    ]);
  });
});

describe("numberSessions", () => {
  it("bỏ qua buổi nghỉ và tăng cường, đếm học bù", () => {
    const numbers = numberSessions([
      row("e", at("2026-09-08", "20:15"), at("2026-09-08", "21:45")),
      row("a", at("2026-09-01", "20:15"), at("2026-09-01", "21:45")),
      row("b", at("2026-09-05", "09:00"), at("2026-09-05", "10:30"), { status: "cancelled" }),
      row("c", at("2026-09-06", "20:15"), at("2026-09-06", "21:45"), { kind: "extra" }),
      row("d", at("2026-09-07", "20:15"), at("2026-09-07", "21:45"), { kind: "makeup" })
    ]);
    expect(Object.fromEntries(numbers)).toEqual({ a: 1, d: 2, e: 3 });
  });

  it("sessionNumberText", () => {
    expect(sessionNumberText(5, 24)).toBe("Buổi 5/24");
    expect(sessionNumberText(5, null)).toBe("Buổi 5");
    expect(sessionNumberText(null, 24)).toBeNull();
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run tests/class-schedule.test.ts`
Expected: FAIL — "Failed to resolve import ../lib/class-schedule".

- [ ] **Step 3: Viết `lib/class-schedule.ts`**

```ts
// Lịch học của lớp: lịch cố định hàng tuần -> từng buổi học cụ thể (ClassSession).
// Module thuần: không đụng Prisma, không đụng React — test được và dùng được ở cả
// server lẫn client component. Giờ VN cố định UTC+7 (không có giờ mùa hè).

import { vnDateKey } from "@/lib/attendance";
import { VN_OFFSET_MS } from "@/lib/streak";

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

// Lớp học liên tục (không đặt số buổi / ngày kết thúc): luôn có sẵn buổi cho 12 tuần tới.
export const CONTINUOUS_HORIZON_DAYS = 84;
// Giới hạn an toàn cho một lần tạo buổi, phòng lịch sai sinh vô hạn dòng.
export const MAX_PLAN_DAYS = 730;
const MAX_SLOTS = 14;

// Chỉ số theo thứ ISO: 1 = Thứ 2 … 7 = Chủ nhật. Ô 0 bỏ trống cho dễ tra.
export const WEEKDAY_SHORT = ["", "T2", "T3", "T4", "T5", "T6", "T7", "CN"] as const;
export const WEEKDAY_LONG = ["", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"] as const;

export type ScheduleSlot = { weekday: number; startMinute: number; endMinute: number };

export type SessionForPlan = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  status: string;
  kind: string;
  edited: boolean;
  originalStartsAt: Date | null;
};

export type PlannedSession = { startsAt: Date; endsAt: Date };

// ---- Giờ giấc ----

// "20:15" -> 1215 (phút từ 00:00). Sai định dạng -> null.
export function parseHm(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) {
    return null;
  }
  return hours * 60 + minutes;
}

// 540 -> "09:00". Luôn 2 chữ số để dùng thẳng làm value của <input type="time">.
export function formatHm(minute: number): string {
  const hours = Math.floor(minute / 60);
  const minutes = minute % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

// Mốc 00:00 giờ VN của ngày "YYYY-MM-DD".
export function vnMidnight(ymd: string): Date {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day) - VN_OFFSET_MS);
}

export function vnDateTime(ymd: string, minute: number): Date {
  return new Date(vnMidnight(ymd).getTime() + minute * MINUTE_MS);
}

// Thứ ISO (1 = Thứ 2 … 7 = CN) của một mốc, tính theo giờ VN.
export function vnIsoWeekday(date: Date): number {
  const day = new Date(date.getTime() + VN_OFFSET_MS).getUTCDay(); // 0 = CN
  return day === 0 ? 7 : day;
}

// Số phút tính từ 00:00 giờ VN.
export function vnMinuteOfDay(date: Date): number {
  const shifted = new Date(date.getTime() + VN_OFFSET_MS);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

export function formatVnTime(date: Date): string {
  return formatHm(vnMinuteOfDay(date));
}

// "T6 26/9"
export function formatShortDate(date: Date): string {
  const shifted = new Date(date.getTime() + VN_OFFSET_MS);
  return `${WEEKDAY_SHORT[vnIsoWeekday(date)]} ${shifted.getUTCDate()}/${shifted.getUTCMonth() + 1}`;
}

// ---- Lịch cố định ----

// Đọc danh sách khung giờ từ form (JSON đã parse). Không dùng zod để module này
// còn nhẹ khi client component import. Lỗi ném ra là câu tiếng Việt cho toast.
export function parseScheduleSlots(raw: unknown): ScheduleSlot[] {
  if (!Array.isArray(raw)) {
    throw new Error("Lịch cố định không hợp lệ.");
  }
  if (raw.length > MAX_SLOTS) {
    throw new Error(`Tối đa ${MAX_SLOTS} khung giờ mỗi tuần.`);
  }

  const slots: ScheduleSlot[] = [];
  const seen = new Set<string>();

  for (const item of raw as Array<Record<string, unknown>>) {
    const weekday = Number(item?.weekday);
    if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) {
      throw new Error("Thứ trong tuần không hợp lệ.");
    }
    const startMinute = typeof item?.start === "string" ? parseHm(item.start) : null;
    const endMinute = typeof item?.end === "string" ? parseHm(item.end) : null;
    if (startMinute === null || endMinute === null) {
      throw new Error(`${WEEKDAY_LONG[weekday]}: giờ học không hợp lệ.`);
    }
    if (endMinute <= startMinute) {
      throw new Error(`${WEEKDAY_LONG[weekday]}: giờ kết thúc phải sau giờ bắt đầu.`);
    }
    const key = `${weekday}-${startMinute}`;
    if (seen.has(key)) {
      throw new Error(`${WEEKDAY_LONG[weekday]} bị trùng khung giờ ${formatHm(startMinute)}.`);
    }
    seen.add(key);
    slots.push({ weekday, startMinute, endMinute });
  }

  return slots.sort((a, b) => a.weekday - b.weekday || a.startMinute - b.startMinute);
}

// Chuỗi đại diện cho lịch cố định — so trước/sau khi lưu để chỉ báo chuông
// "lịch vừa cập nhật" khi có thay đổi thật, không phải mỗi lần bấm Lưu.
export function scheduleSignature(input: {
  slots: ScheduleSlot[];
  startDate: Date | null;
  totalSessions: number | null;
  endDate: Date | null;
  location: string | null;
}): string {
  const slots = input.slots
    .map((slot) => `${slot.weekday}@${slot.startMinute}-${slot.endMinute}`)
    .sort()
    .join(",");
  return JSON.stringify([
    slots,
    input.startDate?.getTime() ?? null,
    input.totalSessions,
    input.endDate?.getTime() ?? null,
    input.location ?? null
  ]);
}

// ---- Đồng bộ lịch cố định -> từng buổi ----

// Buổi được tính vào "Buổi X/Y": có học, và là buổi thường hoặc học bù.
export function isCountedSession(session: { status: string; kind: string }): boolean {
  return session.status === "scheduled" && (session.kind === "regular" || session.kind === "makeup");
}

// Xem spec mục 3. Tóm tắt:
// - Buổi đóng băng (trước applyFrom, đã sửa tay, học bù/tăng cường) không bị đụng tới
//   và chiếm khung giờ gốc của nó.
// - Sinh buổi mong muốn từ max(applyFrom, ngày khai giảng) theo lịch cố định, dừng khi
//   đủ số buổi / qua ngày kết thúc / hết 12 tuần (lớp học liên tục) / quá 2 năm.
// - Buổi thay được trùng giờ với buổi mong muốn thì giữ (giữ id), còn lại xoá; buổi
//   mong muốn còn thiếu thì tạo.
export function planRegularSessions(input: {
  slots: ScheduleSlot[];
  scheduleStartDate: Date | null;
  scheduleEndDate: Date | null;
  totalSessions: number | null;
  existing: SessionForPlan[];
  applyFrom: Date;
  now: Date;
}): { create: PlannedSession[]; deleteIds: string[] } {
  const applyFromMs = input.applyFrom.getTime();
  const isReplaceable = (session: SessionForPlan) =>
    session.kind === "regular" && !session.edited && session.startsAt.getTime() >= applyFromMs;
  const frozen = input.existing.filter((session) => !isReplaceable(session));
  const replaceable = input.existing.filter(isReplaceable);

  const desired: PlannedSession[] = [];

  if (input.slots.length > 0) {
    const startMs = Math.max(applyFromMs, input.scheduleStartDate?.getTime() ?? applyFromMs);
    let limitMs = startMs + MAX_PLAN_DAYS * DAY_MS;
    if (input.scheduleEndDate) {
      limitMs = Math.min(limitMs, input.scheduleEndDate.getTime() + DAY_MS);
    } else if (input.totalSessions === null) {
      limitMs = Math.min(limitMs, input.now.getTime() + CONTINUOUS_HORIZON_DAYS * DAY_MS);
    }

    const occupied = new Set(
      frozen.map((session) => (session.originalStartsAt ?? session.startsAt).getTime())
    );
    let quota =
      input.totalSessions === null
        ? Number.POSITIVE_INFINITY
        : input.totalSessions - frozen.filter(isCountedSession).length;

    const slots = [...input.slots].sort((a, b) => a.startMinute - b.startMinute);
    let dayMs = vnMidnight(vnDateKey(new Date(startMs))).getTime();

    while (quota > 0 && dayMs < limitMs) {
      const weekday = vnIsoWeekday(new Date(dayMs));
      for (const slot of slots) {
        if (quota <= 0) {
          break;
        }
        if (slot.weekday !== weekday) {
          continue;
        }
        const startsAtMs = dayMs + slot.startMinute * MINUTE_MS;
        if (startsAtMs < startMs || startsAtMs >= limitMs || occupied.has(startsAtMs)) {
          continue;
        }
        desired.push({
          startsAt: new Date(startsAtMs),
          endsAt: new Date(dayMs + slot.endMinute * MINUTE_MS)
        });
        quota -= 1;
      }
      dayMs += DAY_MS;
    }
  }

  const keyOf = (startsAt: Date, endsAt: Date) => `${startsAt.getTime()}-${endsAt.getTime()}`;
  const desiredKeys = new Set(desired.map((session) => keyOf(session.startsAt, session.endsAt)));
  const keptKeys = new Set<string>();
  const deleteIds: string[] = [];

  for (const session of replaceable) {
    const key = keyOf(session.startsAt, session.endsAt);
    if (desiredKeys.has(key) && !keptKeys.has(key)) {
      keptKeys.add(key);
    } else {
      deleteIds.push(session.id);
    }
  }

  const create = desired.filter((session) => !keptKeys.has(keyOf(session.startsAt, session.endsAt)));

  return { create, deleteIds };
}

// Số thứ tự buổi (1, 2, 3…) trong MỘT lớp: chỉ buổi được đếm, theo giờ bắt đầu.
export function numberSessions(
  sessions: Array<{ id: string; startsAt: Date; status: string; kind: string }>
): Map<string, number> {
  const counted = sessions
    .filter(isCountedSession)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  return new Map(counted.map((session, index) => [session.id, index + 1]));
}

export function sessionNumberText(number: number | null, total: number | null): string | null {
  if (number === null) {
    return null;
  }
  return total ? `Buổi ${number}/${total}` : `Buổi ${number}`;
}
```

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `npx vitest run tests/class-schedule.test.ts`
Expected: PASS toàn bộ.

- [ ] **Step 5: Commit**

```bash
git add lib/class-schedule.ts tests/class-schedule.test.ts
git commit -m "feat(lich-hoc): ham thuan dong bo lich co dinh thanh tung buoi + danh so buoi"
```

---

### Task 3: `lib/class-schedule.ts` — buổi tới, nhãn giờ, phát hiện thay đổi, câu thông báo, chip hạn nộp

**Files:**
- Modify: `lib/class-schedule.ts` (thêm vào cuối file)
- Test: `tests/class-schedule-display.test.ts`

**Interfaces:**
- Consumes: các hàm của Task 2.
- Produces:
  - `findNextSession<T extends { startsAt: Date; endsAt: Date; status: string }>(sessions: T[], now: Date): T | null`
  - `relativeSessionLabel(startsAt: Date, now: Date): string`
  - `type SessionChangeKind = "cancelled" | "restored" | "moved" | "online" | "offline" | "added"`
  - `detectChangeKind(before: { status: string; mode: string; startsAt: Date; endsAt: Date }, after: { status: string; mode: string; startsAt: Date; endsAt: Date }, now: Date): SessionChangeKind | null`
  - `sessionChangeText(input: { changeKind: string; kind: string; startsAt: Date; originalStartsAt: Date | null; className: string }): string`
  - `isValidMeetingUrl(value: string): boolean`
  - `type SessionPick = { key: string; label: string; date: string; time: string }`
  - `buildSessionPicks(sessions: Array<{ classId: string; className: string; startsAt: Date }>): SessionPick[]`

- [ ] **Step 1: Viết test (fail)**

`tests/class-schedule-display.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  buildSessionPicks,
  detectChangeKind,
  findNextSession,
  isValidMeetingUrl,
  parseHm,
  relativeSessionLabel,
  sessionChangeText,
  vnDateTime
} from "../lib/class-schedule";

const at = (ymd: string, hm: string) => vnDateTime(ymd, parseHm(hm) as number);

describe("findNextSession", () => {
  const sessions = [
    { id: "a", startsAt: at("2026-09-08", "20:15"), endsAt: at("2026-09-08", "21:45"), status: "scheduled" },
    { id: "b", startsAt: at("2026-09-10", "20:15"), endsAt: at("2026-09-10", "21:45"), status: "cancelled" },
    { id: "c", startsAt: at("2026-09-12", "09:00"), endsAt: at("2026-09-12", "10:30"), status: "scheduled" }
  ];

  it("buổi đang diễn ra vẫn là buổi tới", () => {
    expect(findNextSession(sessions, at("2026-09-08", "20:30"))?.id).toBe("a");
  });

  it("bỏ qua buổi nghỉ", () => {
    expect(findNextSession(sessions, at("2026-09-09", "08:00"))?.id).toBe("c");
  });

  it("không còn buổi nào -> null", () => {
    expect(findNextSession(sessions, at("2026-09-12", "11:00"))).toBeNull();
  });
});

describe("relativeSessionLabel", () => {
  const now = at("2026-09-24", "10:00"); // Thứ 5

  it("trong ngày: sáng/chiều/tối nay", () => {
    expect(relativeSessionLabel(at("2026-09-24", "08:00"), now)).toBe("Sáng nay 08:00");
    expect(relativeSessionLabel(at("2026-09-24", "14:00"), now)).toBe("Chiều nay 14:00");
    expect(relativeSessionLabel(at("2026-09-24", "20:15"), now)).toBe("Tối nay 20:15");
  });

  it("ngày mai, trong tuần, xa hơn", () => {
    expect(relativeSessionLabel(at("2026-09-25", "09:00"), now)).toBe("Ngày mai 09:00");
    expect(relativeSessionLabel(at("2026-09-26", "09:00"), now)).toBe("Thứ 7 26/9 09:00");
    expect(relativeSessionLabel(at("2026-09-30", "20:15"), now)).toBe("Thứ 4 30/9 20:15");
    expect(relativeSessionLabel(at("2026-10-01", "20:15"), now)).toBe("T5 1/10 20:15");
  });

  it("đổi ngày theo giờ VN, không theo UTC", () => {
    expect(relativeSessionLabel(at("2026-09-25", "00:30"), at("2026-09-24", "23:30"))).toBe("Ngày mai 00:30");
  });
});

describe("detectChangeKind", () => {
  const now = at("2026-09-20", "10:00");
  const before = { status: "scheduled", mode: "offline", startsAt: at("2026-09-26", "20:15"), endsAt: at("2026-09-26", "21:45") };

  it("nghỉ / học lại", () => {
    expect(detectChangeKind(before, { ...before, status: "cancelled" }, now)).toBe("cancelled");
    expect(detectChangeKind({ ...before, status: "cancelled" }, before, now)).toBe("restored");
  });

  it("dời giờ", () => {
    expect(detectChangeKind(before, { ...before, startsAt: at("2026-09-27", "20:15"), endsAt: at("2026-09-27", "21:45") }, now)).toBe("moved");
  });

  it("đổi hình thức", () => {
    expect(detectChangeKind(before, { ...before, mode: "online" }, now)).toBe("online");
    expect(detectChangeKind({ ...before, mode: "online" }, before, now)).toBe("offline");
  });

  it("nghỉ quan trọng hơn dời", () => {
    expect(detectChangeKind(before, { ...before, status: "cancelled", startsAt: at("2026-09-27", "20:15") }, now)).toBe("cancelled");
  });

  it("không đổi gì đáng báo, hoặc buổi đã diễn ra -> null", () => {
    expect(detectChangeKind(before, { ...before }, now)).toBeNull();
    expect(detectChangeKind(before, { ...before, status: "cancelled" }, at("2026-09-26", "20:30"))).toBeNull();
    expect(detectChangeKind({ ...before, status: "cancelled" }, { ...before, status: "cancelled", mode: "online" }, now)).toBeNull();
  });
});

describe("sessionChangeText", () => {
  const base = { kind: "regular", startsAt: at("2026-09-26", "20:15"), originalStartsAt: null, className: "PĐ K1" };

  it("từng loại thay đổi", () => {
    expect(sessionChangeText({ ...base, changeKind: "cancelled" })).toBe("Nghỉ học buổi T7 26/9 (PĐ K1)");
    expect(sessionChangeText({ ...base, changeKind: "restored" })).toBe("Buổi T7 26/9 (PĐ K1) học lại như lịch");
    expect(sessionChangeText({ ...base, changeKind: "online" })).toBe("Buổi T7 26/9 (PĐ K1) chuyển học online");
    expect(sessionChangeText({ ...base, changeKind: "offline" })).toBe("Buổi T7 26/9 (PĐ K1) chuyển về học trực tiếp");
    expect(
      sessionChangeText({ ...base, changeKind: "moved", originalStartsAt: at("2026-09-25", "20:15") })
    ).toBe("Buổi T6 25/9 (PĐ K1) dời sang T7 26/9 20:15");
  });

  it("thêm buổi: học bù / tăng cường", () => {
    const added = { ...base, changeKind: "added", startsAt: at("2026-09-28", "20:15") };
    expect(sessionChangeText({ ...added, kind: "makeup" })).toBe("Thêm buổi học bù T2 28/9 20:15 (PĐ K1)");
    expect(sessionChangeText({ ...added, kind: "extra" })).toBe("Thêm buổi tăng cường T2 28/9 20:15 (PĐ K1)");
  });
});

describe("isValidMeetingUrl", () => {
  it("chỉ nhận http(s)", () => {
    expect(isValidMeetingUrl("https://meet.google.com/abc-defg-hij")).toBe(true);
    expect(isValidMeetingUrl("http://zoom.us/j/1")).toBe(true);
    expect(isValidMeetingUrl("javascript:alert(1)")).toBe(false);
    expect(isValidMeetingUrl("meet.google.com/abc")).toBe(false);
    expect(isValidMeetingUrl("")).toBe(false);
  });
});

describe("buildSessionPicks", () => {
  it("mỗi lớp lấy buổi sớm nhất", () => {
    const picks = buildSessionPicks([
      { classId: "k1", className: "PĐ K1", startsAt: at("2026-09-25", "20:15") },
      { classId: "cb", className: "CB K1", startsAt: at("2026-09-24", "20:00") },
      { classId: "k1", className: "PĐ K1", startsAt: at("2026-09-24", "20:15") }
    ]);
    expect(picks).toEqual([
      { key: "cb", label: "Trước buổi CB K1 · T5 24/9 20:00", date: "2026-09-24", time: "20:00" },
      { key: "k1", label: "Trước buổi PĐ K1 · T5 24/9 20:15", date: "2026-09-24", time: "20:15" }
    ]);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run tests/class-schedule-display.test.ts`
Expected: FAIL — các export chưa có.

- [ ] **Step 3: Thêm vào cuối `lib/class-schedule.ts`**

```ts
// ---- Hiển thị cho học viên ----

// Buổi học tới: buổi có học đầu tiên chưa kết thúc (đang diễn ra cũng tính).
export function findNextSession<T extends { startsAt: Date; endsAt: Date; status: string }>(
  sessions: T[],
  now: Date
): T | null {
  let best: T | null = null;
  for (const session of sessions) {
    if (session.status !== "scheduled" || session.endsAt.getTime() <= now.getTime()) {
      continue;
    }
    if (!best || session.startsAt.getTime() < best.startsAt.getTime()) {
      best = session;
    }
  }
  return best;
}

// "Tối nay 20:15" · "Ngày mai 09:00" · "Thứ 6 26/9 20:15" (trong 6 ngày tới) · "T6 3/10 20:15".
export function relativeSessionLabel(startsAt: Date, now: Date): string {
  const dayDiff = Math.round(
    (vnMidnight(vnDateKey(startsAt)).getTime() - vnMidnight(vnDateKey(now)).getTime()) / DAY_MS
  );
  const time = formatVnTime(startsAt);

  if (dayDiff === 0) {
    const minute = vnMinuteOfDay(startsAt);
    const part = minute < 12 * 60 ? "Sáng nay" : minute < 18 * 60 ? "Chiều nay" : "Tối nay";
    return `${part} ${time}`;
  }
  if (dayDiff === 1) {
    return `Ngày mai ${time}`;
  }
  if (dayDiff > 1 && dayDiff <= 6) {
    const shifted = new Date(startsAt.getTime() + VN_OFFSET_MS);
    return `${WEEKDAY_LONG[vnIsoWeekday(startsAt)]} ${shifted.getUTCDate()}/${shifted.getUTCMonth() + 1} ${time}`;
  }
  return `${formatShortDate(startsAt)} ${time}`;
}

// ---- Thay đổi từng buổi -> thông báo cho học viên ----

export type SessionChangeKind = "cancelled" | "restored" | "moved" | "online" | "offline" | "added";

type SessionState = { status: string; mode: string; startsAt: Date; endsAt: Date };

// Thay đổi đáng báo nhất khi giáo viên sửa một buổi. Buổi đã bắt đầu thì không báo.
// Ưu tiên: nghỉ > học lại > dời > đổi hình thức. Chỉ đổi ghi chú/link -> null.
export function detectChangeKind(
  before: SessionState,
  after: SessionState,
  now: Date
): SessionChangeKind | null {
  if (before.startsAt.getTime() <= now.getTime()) {
    return null;
  }
  if (before.status !== "cancelled" && after.status === "cancelled") {
    return "cancelled";
  }
  if (before.status === "cancelled" && after.status !== "cancelled") {
    return "restored";
  }
  if (after.status === "cancelled") {
    return null;
  }
  if (
    before.startsAt.getTime() !== after.startsAt.getTime() ||
    before.endsAt.getTime() !== after.endsAt.getTime()
  ) {
    return "moved";
  }
  if (before.mode !== after.mode) {
    return after.mode === "online" ? "online" : "offline";
  }
  return null;
}

export function sessionChangeText(input: {
  changeKind: string;
  kind: string;
  startsAt: Date;
  originalStartsAt: Date | null;
  className: string;
}): string {
  const day = formatShortDate(input.startsAt);
  const time = formatVnTime(input.startsAt);
  const cls = input.className;

  switch (input.changeKind) {
    case "cancelled":
      return `Nghỉ học buổi ${day} (${cls})`;
    case "restored":
      return `Buổi ${day} (${cls}) học lại như lịch`;
    case "moved":
      return `Buổi ${formatShortDate(input.originalStartsAt ?? input.startsAt)} (${cls}) dời sang ${day} ${time}`;
    case "online":
      return `Buổi ${day} (${cls}) chuyển học online`;
    case "offline":
      return `Buổi ${day} (${cls}) chuyển về học trực tiếp`;
    default:
      return input.kind === "extra"
        ? `Thêm buổi tăng cường ${day} ${time} (${cls})`
        : `Thêm buổi học bù ${day} ${time} (${cls})`;
  }
}

export function isValidMeetingUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

// ---- Chip hạn nộp "Trước buổi học tới" ----

export type SessionPick = { key: string; label: string; date: string; time: string };

export function buildSessionPicks(
  sessions: Array<{ classId: string; className: string; startsAt: Date }>
): SessionPick[] {
  const firstByClass = new Map<string, { classId: string; className: string; startsAt: Date }>();
  for (const session of sessions) {
    const current = firstByClass.get(session.classId);
    if (!current || session.startsAt.getTime() < current.startsAt.getTime()) {
      firstByClass.set(session.classId, session);
    }
  }
  return Array.from(firstByClass.values())
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
    .map((session) => ({
      key: session.classId,
      label: `Trước buổi ${session.className} · ${formatShortDate(session.startsAt)} ${formatVnTime(session.startsAt)}`,
      date: vnDateKey(session.startsAt),
      time: formatVnTime(session.startsAt)
    }));
}
```

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `npx vitest run tests/class-schedule-display.test.ts tests/class-schedule.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/class-schedule.ts tests/class-schedule-display.test.ts
git commit -m "feat(lich-hoc): buoi toi, nhan gio tuong doi, phat hien doi lich, cau thong bao, chip han nop"
```

---

### Task 4: `lib/student-calendar.ts` — sự kiện, lưới tháng, trạng thái hạn nộp

**Files:**
- Create: `lib/student-calendar.ts`
- Test: `tests/student-calendar.test.ts`

**Interfaces:**
- Consumes: `numberSessions`, `vnMidnight`, `vnIsoWeekday`, `WEEKDAY_LONG` (Task 2); `vnDateKey`; `isSubmissionLate` (`lib/late-submission.ts`); `VN_OFFSET_MS`.
- Produces:
  - `type CalendarSessionEvent = { type: "session"; id; classId; className; startsAt: string; endsAt: string; status; mode; kind; meetingUrl: string | null; note: string | null; originalStartsAt: string | null; location: string | null; number: number | null; total: number | null }`
  - `type DeadlineState = "pending" | "overdue" | "done" | "late"`
  - `type CalendarDeadlineEvent = { type: "deadline"; id: string; title: string; deadline: string; skills: string[]; status: string; state: DeadlineState; href: string }`
  - `type CalendarEvent`, `type DotKind = "session" | "session-cancelled" | "overdue" | "pending" | "done"`
  - `type CalendarDay = { key: string; day: number; events: CalendarEvent[]; dots: DotKind[] }`, `type CalendarMonth = { year: number; month: number; leadingBlanks: number; days: CalendarDay[] }`
  - `type ScheduleClassInfo = { id: string; name: string; location: string | null; totalSessions: number | null }`
  - `type ScheduleSessionRow = { id; classId; startsAt: Date; endsAt: Date; status; mode; kind; meetingUrl: string | null; note: string | null; originalStartsAt: Date | null }`
  - `toSessionEvents(classes: ScheduleClassInfo[], sessions: ScheduleSessionRow[]): CalendarSessionEvent[]`
  - `deadlineState(input: { status: string; deadline: Date; submittedAt: Date | null; now: Date }): DeadlineState`
  - `toDeadlineEvents(rows: Array<{ id: string; status: string; submittedAt: Date | null; deadline: Date; title: string; skills: string[]; latestAttemptId: string | null }>, now: Date): CalendarDeadlineEvent[]`
  - `buildCalendarMonth(year: number, month: number, events: CalendarEvent[]): CalendarMonth`
  - `monthParam(year, month): string`, `shiftMonth(year, month, delta): { year; month }`, `resolveCalendarMonth(raw: string | undefined, now: Date): { year; month }`, `resolveSelectedDay(raw: string | undefined, year: number, month: number, now: Date): string`, `formatDayHeading(key: string): string`
  - `pendingBeforeSession(recipients: Array<{ status: string; deadline: Date | null }>, startsAt: Date, now: Date): number`

- [ ] **Step 1: Viết test (fail)**

`tests/student-calendar.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseHm, vnDateTime } from "../lib/class-schedule";
import {
  buildCalendarMonth,
  deadlineState,
  formatDayHeading,
  monthParam,
  pendingBeforeSession,
  resolveCalendarMonth,
  resolveSelectedDay,
  shiftMonth,
  toDeadlineEvents,
  toSessionEvents,
  type CalendarEvent,
  type ScheduleSessionRow
} from "../lib/student-calendar";

const at = (ymd: string, hm: string) => vnDateTime(ymd, parseHm(hm) as number);
const NOW = at("2026-09-24", "10:00");

function session(id: string, classId: string, startsAt: Date, extra: Partial<ScheduleSessionRow> = {}): ScheduleSessionRow {
  return {
    id,
    classId,
    startsAt,
    endsAt: new Date(startsAt.getTime() + 90 * 60 * 1000),
    status: "scheduled",
    mode: "offline",
    kind: "regular",
    meetingUrl: null,
    note: null,
    originalStartsAt: null,
    ...extra
  };
}

describe("tham số tháng/ngày", () => {
  it("monthParam, shiftMonth", () => {
    expect(monthParam(2026, 9)).toBe("2026-09");
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
  });

  it("resolveCalendarMonth: hợp lệ thì dùng, sai thì về tháng hiện tại", () => {
    expect(resolveCalendarMonth("2026-10", NOW)).toEqual({ year: 2026, month: 10 });
    expect(resolveCalendarMonth("2026-13", NOW)).toEqual({ year: 2026, month: 9 });
    expect(resolveCalendarMonth("1999-01", NOW)).toEqual({ year: 2026, month: 9 });
    expect(resolveCalendarMonth(undefined, NOW)).toEqual({ year: 2026, month: 9 });
  });

  it("resolveSelectedDay", () => {
    expect(resolveSelectedDay("2026-09-05", 2026, 9, NOW)).toBe("2026-09-05");
    expect(resolveSelectedDay("2026-10-05", 2026, 9, NOW)).toBe("2026-09-24");
    expect(resolveSelectedDay("2026-09-31", 2026, 9, NOW)).toBe("2026-09-24");
    expect(resolveSelectedDay(undefined, 2026, 10, NOW)).toBe("2026-10-01");
  });

  it("formatDayHeading", () => {
    expect(formatDayHeading("2026-09-23")).toBe("Thứ 4, 23/9");
    expect(formatDayHeading("2026-09-27")).toBe("Chủ nhật, 27/9");
  });
});

describe("deadlineState", () => {
  const deadline = at("2026-09-20", "23:59");
  it("các trạng thái", () => {
    expect(deadlineState({ status: "submitted", deadline, submittedAt: at("2026-09-20", "10:00"), now: NOW })).toBe("done");
    expect(deadlineState({ status: "reviewed", deadline, submittedAt: at("2026-09-21", "10:00"), now: NOW })).toBe("late");
    expect(deadlineState({ status: "assigned", deadline, submittedAt: null, now: NOW })).toBe("overdue");
    expect(deadlineState({ status: "in_progress", deadline: at("2026-09-30", "23:59"), submittedAt: null, now: NOW })).toBe("pending");
  });
});

describe("toSessionEvents", () => {
  it("đánh số theo từng lớp, gắn tên lớp + địa điểm + tổng số buổi", () => {
    const events = toSessionEvents(
      [
        { id: "k1", name: "PĐ K1", location: "Phòng 2", totalSessions: 24 },
        { id: "cb", name: "CB K1", location: null, totalSessions: null }
      ],
      [
        session("a", "k1", at("2026-09-23", "20:15")),
        session("b", "cb", at("2026-09-24", "20:00")),
        session("c", "k1", at("2026-09-25", "20:15"))
      ]
    );
    expect(events.map((e) => [e.id, e.className, e.number, e.total])).toEqual([
      ["a", "PĐ K1", 1, 24],
      ["b", "CB K1", 1, null],
      ["c", "PĐ K1", 2, 24]
    ]);
    expect(events[0].startsAt).toBe(at("2026-09-23", "20:15").toISOString());
    expect(events[0].location).toBe("Phòng 2");
  });

  it("bỏ buổi của lớp không có trong danh sách", () => {
    expect(toSessionEvents([], [session("a", "k1", at("2026-09-23", "20:15"))])).toEqual([]);
  });
});

describe("toDeadlineEvents", () => {
  it("bài đã nộp dẫn tới trang kết quả, chưa nộp dẫn tới trang làm bài", () => {
    const [done, pending] = toDeadlineEvents(
      [
        { id: "r1", status: "submitted", submittedAt: at("2026-09-20", "09:00"), deadline: at("2026-09-20", "23:59"), title: "Cam 18 T1", skills: ["reading"], latestAttemptId: "at1" },
        { id: "r2", status: "assigned", submittedAt: null, deadline: at("2026-09-30", "23:59"), title: "Cam 18 T2", skills: ["listening"], latestAttemptId: null }
      ],
      NOW
    );
    expect(done).toMatchObject({ type: "deadline", state: "done", href: "/student/results/at1" });
    expect(pending).toMatchObject({ state: "pending", href: "/student/assignments/r2" });
  });
});

describe("buildCalendarMonth", () => {
  const events: CalendarEvent[] = [
    ...toSessionEvents(
      [{ id: "k1", name: "PĐ K1", location: null, totalSessions: null }],
      [
        session("s1", "k1", at("2026-09-23", "20:15")),
        session("s2", "k1", at("2026-09-25", "20:15"), { status: "cancelled" }),
        session("s3", "k1", at("2026-10-02", "20:15"))
      ]
    ),
    ...toDeadlineEvents(
      [
        { id: "r1", status: "assigned", submittedAt: null, deadline: at("2026-09-23", "18:00"), title: "Bài A", skills: [], latestAttemptId: null },
        { id: "r2", status: "assigned", submittedAt: null, deadline: at("2026-09-25", "23:59"), title: "Bài B", skills: [], latestAttemptId: null }
      ],
      NOW
    )
  ];

  it("lưới tháng 9/2026 bắt đầu Thứ 2, ô trống đầu tháng đúng", () => {
    const month = buildCalendarMonth(2026, 9, events);
    expect(month.leadingBlanks).toBe(1); // 1/9/2026 là Thứ 3
    expect(month.days).toHaveLength(30);
    expect(month.days[0].key).toBe("2026-09-01");
  });

  it("sự kiện vào đúng ngày, sắp theo giờ; bỏ sự kiện tháng khác", () => {
    const month = buildCalendarMonth(2026, 9, events);
    const day23 = month.days[22];
    expect(day23.events.map((e) => e.id)).toEqual(["r1", "s1"]);
    // r1 hạn 18:00 ngày 23/9 < NOW (24/9) -> quá hạn.
    expect(day23.dots).toEqual(["session", "overdue"]);
    expect(month.days[24].dots).toEqual(["session-cancelled", "pending"]);
    expect(month.days.every((day) => day.events.every((e) => e.id !== "s3"))).toBe(true);
  });
});

describe("pendingBeforeSession", () => {
  it("đếm bài chưa nộp có hạn nằm giữa bây giờ và giờ học", () => {
    const startsAt = at("2026-09-24", "20:15");
    expect(
      pendingBeforeSession(
        [
          { status: "assigned", deadline: at("2026-09-24", "20:15") },
          { status: "in_progress", deadline: at("2026-09-24", "18:00") },
          { status: "submitted", deadline: at("2026-09-24", "18:00") },
          { status: "assigned", deadline: at("2026-09-23", "23:59") },
          { status: "assigned", deadline: at("2026-09-25", "23:59") },
          { status: "assigned", deadline: null }
        ],
        startsAt,
        NOW
      )
    ).toBe(2);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run tests/student-calendar.test.ts`
Expected: FAIL — không tìm thấy `../lib/student-calendar`.

- [ ] **Step 3: Viết `lib/student-calendar.ts`**

```ts
// Trang "Lịch học" của học viên: gom buổi học + hạn nộp thành sự kiện theo ngày
// (giờ VN) và dựng lưới tháng. Module thuần — không Prisma, không React.

import { vnDateKey } from "@/lib/attendance";
import { numberSessions, vnIsoWeekday, vnMidnight, WEEKDAY_LONG } from "@/lib/class-schedule";
import { isSubmissionLate } from "@/lib/late-submission";
import { VN_OFFSET_MS } from "@/lib/streak";

export type CalendarSessionEvent = {
  type: "session";
  id: string;
  classId: string;
  className: string;
  startsAt: string; // ISO
  endsAt: string; // ISO
  status: string;
  mode: string;
  kind: string;
  meetingUrl: string | null;
  note: string | null;
  originalStartsAt: string | null; // ISO
  location: string | null;
  number: number | null;
  total: number | null;
};

export type DeadlineState = "pending" | "overdue" | "done" | "late";

export type CalendarDeadlineEvent = {
  type: "deadline";
  id: string; // AssignmentRecipient.id
  title: string;
  deadline: string; // ISO
  skills: string[];
  status: string; // RecipientStatus
  state: DeadlineState;
  href: string;
};

export type CalendarEvent = CalendarSessionEvent | CalendarDeadlineEvent;

export type DotKind = "session" | "session-cancelled" | "overdue" | "pending" | "done";

export type CalendarDay = { key: string; day: number; events: CalendarEvent[]; dots: DotKind[] };

export type CalendarMonth = { year: number; month: number; leadingBlanks: number; days: CalendarDay[] };

export type ScheduleClassInfo = { id: string; name: string; location: string | null; totalSessions: number | null };

export type ScheduleSessionRow = {
  id: string;
  classId: string;
  startsAt: Date;
  endsAt: Date;
  status: string;
  mode: string;
  kind: string;
  meetingUrl: string | null;
  note: string | null;
  originalStartsAt: Date | null;
};

const DONE_STATUSES = new Set(["submitted", "reviewed"]);
const PENDING_STATUSES = new Set(["assigned", "in_progress"]);
const DOT_ORDER: DotKind[] = ["session", "session-cancelled", "overdue", "pending", "done"];
const MAX_DOTS = 3;

// ---- Tham số URL ----

export function monthParam(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function shiftMonth(year: number, month: number, delta: number) {
  const total = year * 12 + (month - 1) + delta;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

function currentVnMonth(now: Date) {
  const shifted = new Date(now.getTime() + VN_OFFSET_MS);
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1 };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

// "?m=YYYY-MM" — sai định dạng hoặc ngoài khoảng 2020–2100 thì về tháng hiện tại.
export function resolveCalendarMonth(raw: string | undefined, now: Date) {
  const match = raw?.match(/^(\d{4})-(\d{2})$/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (year >= 2020 && year <= 2100 && month >= 1 && month <= 12) {
      return { year, month };
    }
  }
  return currentVnMonth(now);
}

// "?d=YYYY-MM-DD" phải thuộc tháng đang xem; không thì chọn hôm nay (nếu hôm nay
// thuộc tháng đó) hoặc ngày 1.
export function resolveSelectedDay(raw: string | undefined, year: number, month: number, now: Date): string {
  const prefix = monthParam(year, month);
  const match = raw?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match && raw?.startsWith(prefix)) {
    const day = Number(match[3]);
    if (day >= 1 && day <= daysInMonth(year, month)) {
      return raw;
    }
  }
  const today = vnDateKey(now);
  return today.startsWith(prefix) ? today : `${prefix}-01`;
}

// "2026-09-23" -> "Thứ 4, 23/9"
export function formatDayHeading(key: string): string {
  const [, month, day] = key.split("-").map(Number);
  return `${WEEKDAY_LONG[vnIsoWeekday(vnMidnight(key))]}, ${day}/${month}`;
}

// ---- Sự kiện ----

export function toSessionEvents(
  classes: ScheduleClassInfo[],
  sessions: ScheduleSessionRow[]
): CalendarSessionEvent[] {
  const numbers = new Map<string, number>();
  for (const classItem of classes) {
    numberSessions(sessions.filter((session) => session.classId === classItem.id)).forEach(
      (number, id) => numbers.set(id, number)
    );
  }
  const byId = new Map(classes.map((classItem) => [classItem.id, classItem]));

  return sessions.flatMap((session) => {
    const classItem = byId.get(session.classId);
    if (!classItem) {
      return [];
    }
    return [
      {
        type: "session" as const,
        id: session.id,
        classId: classItem.id,
        className: classItem.name,
        startsAt: session.startsAt.toISOString(),
        endsAt: session.endsAt.toISOString(),
        status: session.status,
        mode: session.mode,
        kind: session.kind,
        meetingUrl: session.meetingUrl,
        note: session.note,
        originalStartsAt: session.originalStartsAt?.toISOString() ?? null,
        location: classItem.location,
        number: numbers.get(session.id) ?? null,
        total: classItem.totalSessions
      }
    ];
  });
}

export function deadlineState(input: {
  status: string;
  deadline: Date;
  submittedAt: Date | null;
  now: Date;
}): DeadlineState {
  if (DONE_STATUSES.has(input.status)) {
    return isSubmissionLate(input.submittedAt, input.deadline) ? "late" : "done";
  }
  return input.deadline.getTime() < input.now.getTime() ? "overdue" : "pending";
}

export function toDeadlineEvents(
  rows: Array<{
    id: string;
    status: string;
    submittedAt: Date | null;
    deadline: Date;
    title: string;
    skills: string[];
    latestAttemptId: string | null;
  }>,
  now: Date
): CalendarDeadlineEvent[] {
  return rows.map((row) => {
    const state = deadlineState({ status: row.status, deadline: row.deadline, submittedAt: row.submittedAt, now });
    const done = state === "done" || state === "late";
    return {
      type: "deadline" as const,
      id: row.id,
      title: row.title,
      deadline: row.deadline.toISOString(),
      skills: row.skills,
      status: row.status,
      state,
      href:
        done && row.latestAttemptId
          ? `/student/results/${row.latestAttemptId}`
          : `/student/assignments/${row.id}`
    };
  });
}

export function eventTime(event: CalendarEvent): string {
  return event.type === "session" ? event.startsAt : event.deadline;
}

function dotOf(event: CalendarEvent): DotKind {
  if (event.type === "session") {
    return event.status === "cancelled" ? "session-cancelled" : "session";
  }
  if (event.state === "overdue") {
    return "overdue";
  }
  return event.state === "pending" ? "pending" : "done";
}

// ---- Lưới tháng ----

export function buildCalendarMonth(year: number, month: number, events: CalendarEvent[]): CalendarMonth {
  const prefix = monthParam(year, month);
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay(); // 0 = CN
  const leadingBlanks = (firstWeekday + 6) % 7;

  const byDay = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const key = vnDateKey(new Date(eventTime(event)));
    if (!key.startsWith(prefix)) {
      continue;
    }
    const list = byDay.get(key) ?? [];
    list.push(event);
    byDay.set(key, list);
  }

  const days = Array.from({ length: daysInMonth(year, month) }, (_, index) => {
    const day = index + 1;
    const key = `${prefix}-${String(day).padStart(2, "0")}`;
    const dayEvents = (byDay.get(key) ?? []).sort((a, b) => eventTime(a).localeCompare(eventTime(b)));
    const kinds = new Set(dayEvents.map(dotOf));
    const dots = DOT_ORDER.filter((kind) => kinds.has(kind)).slice(0, MAX_DOTS);
    return { key, day, events: dayEvents, dots };
  });

  return { year, month, leadingBlanks, days };
}

// ---- Thẻ "Buổi học tới" ----

export function pendingBeforeSession(
  recipients: Array<{ status: string; deadline: Date | null }>,
  startsAt: Date,
  now: Date
): number {
  return recipients.filter(
    (recipient) =>
      PENDING_STATUSES.has(recipient.status) &&
      recipient.deadline !== null &&
      recipient.deadline.getTime() > now.getTime() &&
      recipient.deadline.getTime() <= startsAt.getTime()
  ).length;
}
```

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `npx vitest run tests/student-calendar.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/student-calendar.ts tests/student-calendar.test.ts
git commit -m "feat(lich-hoc): ham thuan trang lich hoc vien - su kien, luoi thang, trang thai han nop"
```

---

### Task 5: Đồng bộ lịch (Prisma) + 4 server action của giáo viên

**Files:**
- Create: `lib/class-schedule-sync.ts`
- Create: `lib/actions/class-schedule.ts`
- Modify: `components/action-form.tsx` (thêm `onResult` cho `ActionDeleteButton`, dòng 107–136)
- Test: `tests/class-schedule-guard.test.ts`

**Interfaces:**
- Consumes: `planRegularSessions`, `parseScheduleSlots`, `scheduleSignature`, `detectChangeKind`, `isValidMeetingUrl`, `parseHm`, `vnDateTime`, `vnMidnight` (Task 2–3); `requireTeacher` (`lib/actions/classes.ts`); `actionOk`, `actionFail`, `ActionResult`.
- Produces:
  - `syncClassSessions(db: Prisma.TransactionClient, classId: string, now: Date, applyFrom?: Date): Promise<{ create: PlannedSession[]; deleteIds: string[] } | null>`
  - `topUpClassSessions(now?: Date): Promise<number>` (số buổi vừa tạo)
  - Server actions (FormData → `Promise<ActionResult>`): `saveClassSchedule` (fields `classId, slotsJson, startDate, limitType, totalSessions, endDate, location, applyFrom`), `updateClassSession` (`sessionId, status, date, start, end, mode, meetingUrl, note`), `addClassSession` (`classId, kind, date, start, end, mode, meetingUrl, note`), `deleteClassSession` (`sessionId`).
  - `ActionDeleteButton` nhận thêm `onResult?: (result: ActionResult) => void`.

- [ ] **Step 1: Viết test cấu trúc (fail)**

`tests/class-schedule-guard.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const actions = readFileSync("lib/actions/class-schedule.ts", "utf8");
const EXPORTED = ["saveClassSchedule", "updateClassSession", "addClassSession", "deleteClassSession"];

describe("action lịch học của giáo viên", () => {
  it("là file server action", () => {
    expect(actions.startsWith('"use server";')).toBe(true);
  });

  it.each(EXPORTED)("%s gọi requireTeacher() đầu tiên", (name) => {
    const body = actions.split(`export async function ${name}(`)[1] ?? "";
    const firstLine = body.slice(body.indexOf("{") + 1).trim().split("\n")[0];
    expect(firstLine).toContain("await requireTeacher()");
  });

  it("mọi truy vấn lớp/buổi đều lọc theo giáo viên đang đăng nhập", () => {
    expect(actions.match(/teacherId: teacher\.id/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
  });

  it("z.enum khớp chú thích enum trong schema", () => {
    expect(actions).toContain('z.enum(["offline", "online"])');
    expect(actions).toContain('z.enum(["scheduled", "cancelled"])');
    expect(actions).toContain('z.enum(["makeup", "extra"])');
  });

  it("buổi theo lịch cố định không xoá được", () => {
    expect(actions).toContain('existing.kind === "regular"');
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run tests/class-schedule-guard.test.ts`
Expected: FAIL — ENOENT `lib/actions/class-schedule.ts`.

- [ ] **Step 3: Viết `lib/class-schedule-sync.ts`**

```ts
// Ghi kết quả của planRegularSessions xuống DB. Luôn chạy trong $transaction do
// nơi gọi mở (action của giáo viên hoặc cron), để đọc-tính-ghi không bị chen ngang.

import type { Prisma } from "@prisma/client";
import { planRegularSessions } from "@/lib/class-schedule";
import { prisma } from "@/lib/prisma";

// applyFrom bỏ trống = max(now, scheduleAppliesFrom): không bao giờ tạo lại buổi
// đã qua, cũng không đè các buổi nằm trước mốc áp dụng lịch mới.
export async function syncClassSessions(
  db: Prisma.TransactionClient,
  classId: string,
  now: Date,
  applyFrom?: Date
) {
  const classItem = await db.class.findUnique({
    where: { id: classId },
    select: {
      scheduleStartDate: true,
      scheduleEndDate: true,
      totalSessions: true,
      scheduleAppliesFrom: true,
      scheduleSlots: { select: { weekday: true, startMinute: true, endMinute: true } },
      sessions: {
        select: { id: true, startsAt: true, endsAt: true, status: true, kind: true, edited: true, originalStartsAt: true }
      }
    }
  });

  if (!classItem) {
    return null;
  }

  const from =
    applyFrom ?? new Date(Math.max(now.getTime(), classItem.scheduleAppliesFrom?.getTime() ?? 0));

  const plan = planRegularSessions({
    slots: classItem.scheduleSlots,
    scheduleStartDate: classItem.scheduleStartDate,
    scheduleEndDate: classItem.scheduleEndDate,
    totalSessions: classItem.totalSessions,
    existing: classItem.sessions,
    applyFrom: from,
    now
  });

  if (plan.deleteIds.length > 0) {
    await db.classSession.deleteMany({ where: { id: { in: plan.deleteIds } } });
  }
  if (plan.create.length > 0) {
    await db.classSession.createMany({
      data: plan.create.map((session) => ({ classId, startsAt: session.startsAt, endsAt: session.endsAt }))
    });
  }

  return plan;
}

// Cron hằng ngày: lớp học liên tục (không số buổi, không ngày kết thúc) luôn được
// nối thêm để có sẵn 12 tuần. Không tạo thông báo — buổi mới theo đúng lịch cố định.
export async function topUpClassSessions(now: Date = new Date()): Promise<number> {
  const classes = await prisma.class.findMany({
    where: { totalSessions: null, scheduleEndDate: null, scheduleSlots: { some: {} } },
    select: { id: true }
  });

  let created = 0;
  for (const classItem of classes) {
    const plan = await prisma.$transaction((tx) => syncClassSessions(tx, classItem.id, now));
    created += plan?.create.length ?? 0;
  }
  return created;
}
```

- [ ] **Step 4: Viết `lib/actions/class-schedule.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { requireTeacher } from "@/lib/actions/classes";
import { vnDateKey } from "@/lib/attendance";
import {
  detectChangeKind,
  isValidMeetingUrl,
  parseHm,
  parseScheduleSlots,
  scheduleSignature,
  vnDateTime,
  vnMidnight
} from "@/lib/class-schedule";
import { syncClassSessions } from "@/lib/class-schedule-sync";
import { prisma } from "@/lib/prisma";

const ymd = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày không hợp lệ.");
const optionalYmd = z.union([ymd, z.literal("")]).optional();

const scheduleSchema = z.object({
  classId: z.string().trim().min(1, "Thiếu mã lớp."),
  slotsJson: z.string(),
  startDate: optionalYmd,
  limitType: z.enum(["sessions", "endDate", "none"]),
  totalSessions: z.string().optional(),
  endDate: optionalYmd,
  location: z.string().trim().max(200, "Địa điểm tối đa 200 ký tự.").optional(),
  applyFrom: optionalYmd
});

// Khớp chú thích enum SessionMode / SessionStatus / SessionKind trong schema.prisma.
const sessionFieldsSchema = z.object({
  date: ymd,
  start: z.string(),
  end: z.string(),
  mode: z.enum(["offline", "online"]),
  meetingUrl: z.string().trim().optional(),
  note: z.string().trim().max(500, "Ghi chú tối đa 500 ký tự.").optional()
});
const statusSchema = z.enum(["scheduled", "cancelled"]);
const addKindSchema = z.enum(["makeup", "extra"]);

function field(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  return typeof value === "string" ? value : undefined;
}

function firstIssue(error: z.ZodError, fallback: string): string {
  return error.issues[0]?.message ?? fallback;
}

function parseSessionFields(formData: FormData) {
  const parsed = sessionFieldsSchema.safeParse({
    date: field(formData, "date"),
    start: field(formData, "start"),
    end: field(formData, "end"),
    mode: field(formData, "mode"),
    meetingUrl: field(formData, "meetingUrl"),
    note: field(formData, "note")
  });
  if (!parsed.success) {
    throw new Error(firstIssue(parsed.error, "Thông tin buổi học chưa hợp lệ."));
  }
  const startMinute = parseHm(parsed.data.start);
  const endMinute = parseHm(parsed.data.end);
  if (startMinute === null || endMinute === null) {
    throw new Error("Giờ học không hợp lệ.");
  }
  if (endMinute <= startMinute) {
    throw new Error("Giờ kết thúc phải sau giờ bắt đầu.");
  }
  const meetingUrl = parsed.data.meetingUrl ?? "";
  if (parsed.data.mode === "online" && !isValidMeetingUrl(meetingUrl)) {
    throw new Error("Buổi online cần link phòng học bắt đầu bằng https://");
  }
  return {
    startsAt: vnDateTime(parsed.data.date, startMinute),
    endsAt: vnDateTime(parsed.data.date, endMinute),
    mode: parsed.data.mode,
    meetingUrl: parsed.data.mode === "online" ? meetingUrl : null,
    note: parsed.data.note ? parsed.data.note : null
  };
}

function revalidateSchedule(classId: string) {
  revalidatePath(`/teacher/classes/${classId}`);
  revalidatePath("/teacher/assignments");
  revalidatePath("/student");
  revalidatePath("/student/calendar");
}

export async function saveClassSchedule(formData: FormData): Promise<ActionResult> {
  const teacher = await requireTeacher(); // NGOÀI try: lỗi phân quyền ném ra như cũ

  try {
    const parsed = scheduleSchema.safeParse({
      classId: field(formData, "classId"),
      slotsJson: field(formData, "slotsJson") ?? "[]",
      startDate: field(formData, "startDate"),
      limitType: field(formData, "limitType"),
      totalSessions: field(formData, "totalSessions"),
      endDate: field(formData, "endDate"),
      location: field(formData, "location"),
      applyFrom: field(formData, "applyFrom")
    });
    if (!parsed.success) {
      throw new Error(firstIssue(parsed.error, "Lịch học chưa hợp lệ."));
    }
    const data = parsed.data;

    const classItem = await prisma.class.findFirst({
      where: { id: data.classId, teacherId: teacher.id },
      select: {
        id: true,
        name: true,
        scheduleStartDate: true,
        scheduleEndDate: true,
        totalSessions: true,
        location: true,
        scheduleSlots: { select: { weekday: true, startMinute: true, endMinute: true } }
      }
    });
    if (!classItem) {
      throw new Error("Không tìm thấy lớp.");
    }

    let rawSlots: unknown;
    try {
      rawSlots = JSON.parse(data.slotsJson);
    } catch {
      throw new Error("Lịch cố định không hợp lệ.");
    }
    const slots = parseScheduleSlots(rawSlots);

    if (slots.length > 0 && !data.startDate) {
      throw new Error("Chọn ngày khai giảng.");
    }

    let totalSessions: number | null = null;
    let endDate: Date | null = null;
    if (data.limitType === "sessions") {
      const count = Number(data.totalSessions);
      if (!Number.isInteger(count) || count < 1 || count > 500) {
        throw new Error("Số buổi phải từ 1 đến 500.");
      }
      totalSessions = count;
    }
    if (data.limitType === "endDate") {
      if (!data.endDate) {
        throw new Error("Chọn ngày kết thúc.");
      }
      if (data.startDate && data.endDate < data.startDate) {
        throw new Error("Ngày kết thúc phải sau ngày khai giảng.");
      }
      endDate = vnMidnight(data.endDate);
    }

    const startDate = data.startDate ? vnMidnight(data.startDate) : null;
    const location = data.location ? data.location : null;
    const now = new Date();
    const applyFrom = vnMidnight(data.applyFrom || data.startDate || vnDateKey(now));

    const changed =
      scheduleSignature({
        slots: classItem.scheduleSlots,
        startDate: classItem.scheduleStartDate,
        totalSessions: classItem.totalSessions,
        endDate: classItem.scheduleEndDate,
        location: classItem.location
      }) !== scheduleSignature({ slots, startDate, totalSessions, endDate, location });

    await prisma.$transaction(async (tx) => {
      await tx.classScheduleSlot.deleteMany({ where: { classId: classItem.id } });
      if (slots.length > 0) {
        await tx.classScheduleSlot.createMany({
          data: slots.map((slot) => ({ classId: classItem.id, ...slot }))
        });
      }
      await tx.class.update({
        where: { id: classItem.id },
        data: {
          scheduleStartDate: startDate,
          totalSessions,
          scheduleEndDate: endDate,
          location,
          scheduleAppliesFrom: applyFrom,
          ...(changed ? { scheduleChangedAt: now } : {})
        }
      });
      await syncClassSessions(tx, classItem.id, now, applyFrom);
    });

    revalidateSchedule(classItem.id);
    return actionOk(`Đã lưu lịch học lớp "${classItem.name}".`);
  } catch (error) {
    return actionFail(error, "Lưu lịch học");
  }
}

export async function updateClassSession(formData: FormData): Promise<ActionResult> {
  const teacher = await requireTeacher();

  try {
    const sessionId = field(formData, "sessionId") ?? "";
    const status = statusSchema.safeParse(field(formData, "status"));
    if (!status.success) {
      throw new Error("Chọn có học hay nghỉ.");
    }

    const existing = await prisma.classSession.findFirst({
      where: { id: sessionId, class: { teacherId: teacher.id } },
      select: { id: true, classId: true, startsAt: true, endsAt: true, status: true, mode: true, originalStartsAt: true }
    });
    if (!existing) {
      throw new Error("Không tìm thấy buổi học.");
    }

    const fields = parseSessionFields(formData);
    const now = new Date();
    const changeKind = detectChangeKind(
      existing,
      { status: status.data, mode: fields.mode, startsAt: fields.startsAt, endsAt: fields.endsAt },
      now
    );
    const moved = fields.startsAt.getTime() !== existing.startsAt.getTime();

    await prisma.$transaction(async (tx) => {
      await tx.classSession.update({
        where: { id: existing.id },
        data: {
          status: status.data,
          mode: fields.mode,
          meetingUrl: fields.meetingUrl,
          note: fields.note,
          startsAt: fields.startsAt,
          endsAt: fields.endsAt,
          edited: true,
          // Giữ giờ GỐC qua nhiều lần dời để khung đó không bị tạo lại.
          originalStartsAt: moved ? existing.originalStartsAt ?? existing.startsAt : existing.originalStartsAt,
          ...(changeKind ? { changeKind, changedAt: now } : {})
        }
      });
      // Nghỉ / học lại làm đổi số buổi được đếm -> cuối khoá phải co giãn theo.
      if (status.data !== existing.status) {
        await syncClassSessions(tx, existing.classId, now);
      }
    });

    revalidateSchedule(existing.classId);
    return actionOk(status.data === "cancelled" ? "Đã cho nghỉ buổi học." : "Đã lưu buổi học.");
  } catch (error) {
    return actionFail(error, "Lưu buổi học");
  }
}

export async function addClassSession(formData: FormData): Promise<ActionResult> {
  const teacher = await requireTeacher();

  try {
    const kind = addKindSchema.safeParse(field(formData, "kind"));
    if (!kind.success) {
      throw new Error("Chọn loại buổi: học bù hoặc tăng cường.");
    }

    const classItem = await prisma.class.findFirst({
      where: { id: field(formData, "classId") ?? "", teacherId: teacher.id },
      select: { id: true }
    });
    if (!classItem) {
      throw new Error("Không tìm thấy lớp.");
    }

    const fields = parseSessionFields(formData);
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.classSession.create({
        data: {
          classId: classItem.id,
          kind: kind.data,
          status: "scheduled",
          mode: fields.mode,
          meetingUrl: fields.meetingUrl,
          note: fields.note,
          startsAt: fields.startsAt,
          endsAt: fields.endsAt,
          edited: true,
          ...(fields.startsAt.getTime() > now.getTime() ? { changeKind: "added", changedAt: now } : {})
        }
      });
      // Học bù được đếm vào số buổi -> buổi cuối khoá tự rút đi.
      if (kind.data === "makeup") {
        await syncClassSessions(tx, classItem.id, now);
      }
    });

    revalidateSchedule(classItem.id);
    return actionOk(kind.data === "makeup" ? "Đã thêm buổi học bù." : "Đã thêm buổi tăng cường.");
  } catch (error) {
    return actionFail(error, "Thêm buổi học");
  }
}

export async function deleteClassSession(formData: FormData): Promise<ActionResult> {
  const teacher = await requireTeacher();

  try {
    const existing = await prisma.classSession.findFirst({
      where: { id: field(formData, "sessionId") ?? "", class: { teacherId: teacher.id } },
      select: { id: true, classId: true, kind: true }
    });
    if (!existing) {
      throw new Error("Không tìm thấy buổi học.");
    }
    if (existing.kind === "regular") {
      throw new Error("Buổi theo lịch cố định chỉ cho nghỉ, không xoá được.");
    }

    await prisma.$transaction(async (tx) => {
      await tx.classSession.delete({ where: { id: existing.id } });
      if (existing.kind === "makeup") {
        await syncClassSessions(tx, existing.classId, new Date());
      }
    });

    revalidateSchedule(existing.classId);
    return actionOk("Đã xoá buổi học.");
  } catch (error) {
    return actionFail(error, "Xoá buổi học");
  }
}
```

Lưu ý: `requireTeacher` ở `saveClassSchedule` có comment cùng dòng — test Step 1 chỉ kiểm dòng đầu **chứa** `await requireTeacher()` nên vẫn pass.

- [ ] **Step 5: Thêm `onResult` cho `ActionDeleteButton`** (`components/action-form.tsx`)

Thay chữ ký và `formAction` của `ActionDeleteButton`:

```tsx
export function ActionDeleteButton({
  action,
  confirmMessage,
  className,
  onResult,
  children
}: {
  action: ServerAction;
  confirmMessage: string;
  className?: string;
  // Như ActionForm: cho nơi gọi đóng modal sau khi xoá xong.
  onResult?: (result: ActionResult) => void;
  children: ReactNode;
}) {
```

và dòng `formAction`:

```tsx
      formAction={(formData) => runAndNotify(action, formData, notify, onResult)}
```

- [ ] **Step 6: Chạy test + kiểm kiểu**

Run: `npx vitest run tests/class-schedule-guard.test.ts && npx tsc --noEmit`
Expected: test PASS; tsc không lỗi mới (nếu `tx` báo không gán được cho `Prisma.TransactionClient`, đó là lỗi thật — kiểm lại `prisma generate` đã chạy ở Task 1).

- [ ] **Step 7: Commit**

```bash
git add lib/class-schedule-sync.ts lib/actions/class-schedule.ts components/action-form.tsx tests/class-schedule-guard.test.ts
git commit -m "feat(lich-hoc): dong bo lich xuong DB + 4 server action cua giao vien"
```

---

### Task 6: Giao diện giáo viên — khối "Lịch học" trong trang lớp

**Files:**
- Create: `components/session-badges.tsx`, `components/class-schedule-form.tsx`, `components/class-session-editor.tsx`, `components/class-session-list.tsx`, `lib/class-schedule-query.ts`
- Modify: `app/teacher/classes/[classId]/page.tsx`

**Interfaces:**
- Consumes: action Task 5; `formatHm, formatShortDate, formatVnTime, numberSessions, sessionNumberText, WEEKDAY_LONG` (Task 2–3); `vnDateKey`.
- Produces:
  - `getClassScheduleForTeacher(classId: string): Promise<{ scheduleStartDate: Date | null; scheduleEndDate: Date | null; totalSessions: number | null; location: string | null; slots: ScheduleSlot[]; sessions: ScheduleSessionRow[] } | null>`
  - `getStudentSchedule(studentId: string): Promise<{ classes: Array<ScheduleClassInfo & { joinedAt: Date; scheduleChangedAt: Date | null }>; sessions: ScheduleSessionRow[] }>` (dùng ở Task 7–9)
  - `<SessionBadges status mode kind />`

- [ ] **Step 1: Viết `lib/class-schedule-query.ts`**

```ts
// Đọc lịch học. Bọc try/catch: bảng lịch mới thêm, nếu ensure-db chưa kịp chạy
// trên prod thì trang vẫn hiện (chỉ thiếu lịch) thay vì màn hình lỗi.

import type { ScheduleSlot } from "@/lib/class-schedule";
import { prisma } from "@/lib/prisma";
import type { ScheduleClassInfo, ScheduleSessionRow } from "@/lib/student-calendar";

const sessionSelect = {
  id: true,
  classId: true,
  startsAt: true,
  endsAt: true,
  status: true,
  mode: true,
  kind: true,
  meetingUrl: true,
  note: true,
  originalStartsAt: true
} as const;

export type StudentScheduleClass = ScheduleClassInfo & { joinedAt: Date; scheduleChangedAt: Date | null };

export async function getStudentSchedule(
  studentId: string
): Promise<{ classes: StudentScheduleClass[]; sessions: ScheduleSessionRow[] }> {
  try {
    const memberships = await prisma.classStudent.findMany({
      where: { studentId },
      select: {
        joinedAt: true,
        class: { select: { id: true, name: true, location: true, totalSessions: true, scheduleChangedAt: true } }
      }
    });
    const classes = memberships.map((membership) => ({ ...membership.class, joinedAt: membership.joinedAt }));
    if (classes.length === 0) {
      return { classes, sessions: [] };
    }
    // Lấy TOÀN BỘ buổi của các lớp (cột nhẹ): cần đủ để đánh số "Buổi X/Y".
    const sessions = await prisma.classSession.findMany({
      where: { classId: { in: classes.map((classItem) => classItem.id) } },
      orderBy: { startsAt: "asc" },
      select: sessionSelect
    });
    return { classes, sessions };
  } catch (error) {
    console.error("[lich-hoc] Không đọc được lịch học của học viên:", error);
    return { classes: [], sessions: [] };
  }
}

// Nơi gọi đã kiểm lớp thuộc giáo viên (findFirst theo teacherId) trước khi gọi.
export async function getClassScheduleForTeacher(classId: string): Promise<{
  scheduleStartDate: Date | null;
  scheduleEndDate: Date | null;
  totalSessions: number | null;
  location: string | null;
  slots: ScheduleSlot[];
  sessions: ScheduleSessionRow[];
} | null> {
  try {
    const classItem = await prisma.class.findUnique({
      where: { id: classId },
      select: {
        scheduleStartDate: true,
        scheduleEndDate: true,
        totalSessions: true,
        location: true,
        scheduleSlots: {
          orderBy: [{ weekday: "asc" }, { startMinute: "asc" }],
          select: { weekday: true, startMinute: true, endMinute: true }
        },
        sessions: { orderBy: { startsAt: "asc" }, select: sessionSelect }
      }
    });
    if (!classItem) {
      return null;
    }
    const { scheduleSlots, ...rest } = classItem;
    return { ...rest, slots: scheduleSlots };
  } catch (error) {
    console.error("[lich-hoc] Không đọc được lịch học của lớp:", error);
    return null;
  }
}
```

- [ ] **Step 2: Viết `components/session-badges.tsx`**

```tsx
// Nhãn trạng thái một buổi học, dùng chung cho trang giáo viên và học viên.
const BASE = "rounded-full border px-2 py-0.5 text-xs font-semibold";

export function SessionBadges({ status, mode, kind }: { status: string; mode: string; kind: string }) {
  return (
    <>
      {status === "cancelled" ? (
        <span className={`${BASE} border-red-400/50 bg-red-500/10 text-red-600 dark:text-red-300`}>Nghỉ</span>
      ) : mode === "online" ? (
        <span className={`${BASE} border-sky-400/50 bg-sky-500/10 text-sky-700 dark:text-sky-300`}>Online</span>
      ) : (
        <span className={`${BASE} border-border bg-muted text-muted-foreground`}>Trực tiếp</span>
      )}
      {kind === "makeup" ? (
        <span className={`${BASE} border-violet-400/50 bg-violet-500/10 text-violet-700 dark:text-violet-300`}>Học bù</span>
      ) : null}
      {kind === "extra" ? (
        <span className={`${BASE} border-emerald-400/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300`}>Tăng cường</span>
      ) : null}
    </>
  );
}
```

- [ ] **Step 3: Viết `components/class-schedule-form.tsx`**

```tsx
"use client";

import { useState } from "react";
import { ActionForm, ActionSubmitButton } from "@/components/action-form";
import { saveClassSchedule } from "@/lib/actions/class-schedule";
import { WEEKDAY_LONG } from "@/lib/class-schedule";

export type ScheduleSlotInput = { weekday: number; start: string; end: string };
type LimitType = "sessions" | "endDate" | "none";

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];
const fieldClass =
  "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/40 focus:border-primary focus:ring-2";
const smallField =
  "rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none ring-primary/40 focus:border-primary focus:ring-2";

export function ClassScheduleForm({
  classId,
  initialSlots,
  startDate,
  totalSessions,
  endDate,
  location,
  hasSessions,
  todayKey
}: {
  classId: string;
  initialSlots: ScheduleSlotInput[];
  startDate: string; // YYYY-MM-DD hoặc ""
  totalSessions: number | null;
  endDate: string;
  location: string;
  hasSessions: boolean;
  todayKey: string;
}) {
  const [slots, setSlots] = useState<ScheduleSlotInput[]>(
    initialSlots.length > 0 ? initialSlots : [{ weekday: 1, start: "20:00", end: "21:30" }]
  );
  const [limitType, setLimitType] = useState<LimitType>(
    totalSessions ? "sessions" : endDate ? "endDate" : "none"
  );
  const [start, setStart] = useState(startDate || todayKey);

  function updateSlot(index: number, patch: Partial<ScheduleSlotInput>) {
    setSlots((current) => current.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)));
  }

  return (
    <ActionForm
      action={saveClassSchedule}
      className="h-fit space-y-4 rounded-xl border border-border bg-card p-5 shadow-card"
    >
      <div>
        <h4 className="text-sm font-semibold">Lịch cố định hàng tuần</h4>
        <p className="mt-1 text-xs text-muted-foreground">
          Mỗi dòng là một buổi trong tuần. Lưu xong hệ thống tự tạo các buổi học.
        </p>
      </div>
      <input type="hidden" name="classId" value={classId} />
      <input type="hidden" name="slotsJson" value={JSON.stringify(slots)} />

      <div className="space-y-2">
        {slots.map((slot, index) => (
          <div key={index} className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Thứ"
              value={slot.weekday}
              onChange={(event) => updateSlot(index, { weekday: Number(event.target.value) })}
              className={smallField}
            >
              {WEEKDAYS.map((day) => (
                <option key={day} value={day}>
                  {WEEKDAY_LONG[day]}
                </option>
              ))}
            </select>
            <input
              type="time"
              aria-label="Giờ bắt đầu"
              value={slot.start}
              onChange={(event) => updateSlot(index, { start: event.target.value })}
              className={smallField}
            />
            <span aria-hidden="true" className="text-muted-foreground">→</span>
            <input
              type="time"
              aria-label="Giờ kết thúc"
              value={slot.end}
              onChange={(event) => updateSlot(index, { end: event.target.value })}
              className={smallField}
            />
            <button
              type="button"
              aria-label="Xoá khung giờ"
              onClick={() => setSlots((current) => current.filter((_, i) => i !== index))}
              className="rounded-lg border border-border px-2 py-1.5 text-sm text-muted-foreground transition hover:border-red-400 hover:text-red-500"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setSlots((current) => [
              ...current,
              current.length > 0 ? { ...current[current.length - 1] } : { weekday: 1, start: "20:00", end: "21:30" }
            ])
          }
          className="text-sm font-semibold text-primary hover:underline"
        >
          + Thêm khung giờ
        </button>
      </div>

      <label className="block text-sm font-medium">
        Ngày khai giảng
        <input
          type="date"
          name="startDate"
          value={start}
          onChange={(event) => setStart(event.target.value)}
          required={slots.length > 0}
          className={fieldClass}
        />
      </label>

      <fieldset>
        <legend className="text-sm font-medium">Kết thúc khoá</legend>
        <div className="mt-2 flex flex-wrap gap-3 text-sm">
          {(
            [
              ["sessions", "Theo số buổi"],
              ["endDate", "Theo ngày kết thúc"],
              ["none", "Học liên tục"]
            ] as Array<[LimitType, string]>
          ).map(([value, label]) => (
            <label key={value} className="flex items-center gap-1.5">
              <input
                type="radio"
                name="limitType"
                value={value}
                checked={limitType === value}
                onChange={() => setLimitType(value)}
                className="accent-primary"
              />
              {label}
            </label>
          ))}
        </div>
        {limitType === "sessions" ? (
          <input
            type="number"
            name="totalSessions"
            aria-label="Số buổi"
            min={1}
            max={500}
            defaultValue={totalSessions ?? 24}
            required
            className={fieldClass}
          />
        ) : null}
        {limitType === "endDate" ? (
          <input
            type="date"
            name="endDate"
            aria-label="Ngày kết thúc"
            defaultValue={endDate}
            min={start}
            required
            className={fieldClass}
          />
        ) : null}
      </fieldset>

      <label className="block text-sm font-medium">
        Địa điểm mặc định <span className="font-normal text-muted-foreground">(tuỳ chọn)</span>
        <input
          name="location"
          defaultValue={location}
          maxLength={200}
          placeholder="Vd: Phòng 2, 12 Lê Lợi"
          className={fieldClass}
        />
      </label>

      {hasSessions ? (
        <label className="block text-sm font-medium">
          Áp dụng từ
          <input type="date" name="applyFrom" defaultValue={todayKey} required className={fieldClass} />
          <span className="mt-1 block text-xs font-normal text-muted-foreground">
            Buổi trước ngày này và buổi đã sửa tay được giữ nguyên.
          </span>
        </label>
      ) : (
        <input type="hidden" name="applyFrom" value={start} />
      )}

      <ActionSubmitButton className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-card transition hover:bg-primary/90">
        Lưu lịch
      </ActionSubmitButton>
    </ActionForm>
  );
}
```

- [ ] **Step 4: Viết `components/class-session-editor.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ActionDeleteButton, ActionForm, ActionSubmitButton } from "@/components/action-form";
import { addClassSession, deleteClassSession, updateClassSession } from "@/lib/actions/class-schedule";
import { vnDateKey } from "@/lib/attendance";
import { formatVnTime } from "@/lib/class-schedule";

export type EditableSession = {
  id: string;
  startsAt: string; // ISO
  endsAt: string;
  status: string;
  mode: string;
  kind: string;
  meetingUrl: string | null;
  note: string | null;
  originalStartsAt: string | null;
};

const fieldClass =
  "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/40 focus:border-primary focus:ring-2";

// Modal sửa một buổi (session != null) hoặc thêm buổi mới (session == null).
// Portal ra body: overlay fixed nằm trong phần tử có animate-fade-in sẽ bị kẹt.
export function ClassSessionEditor({
  classId,
  session,
  todayKey,
  onClose
}: {
  classId: string;
  session: EditableSession | null;
  todayKey: string;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState(session?.mode ?? "offline");
  const isNew = session === null;

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!mounted) {
    return null;
  }

  const startsAt = session ? new Date(session.startsAt) : null;
  const endsAt = session ? new Date(session.endsAt) : null;
  const closeOnOk = (result: { ok: boolean }) => {
    if (result.ok) {
      onClose();
    }
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isNew ? "Thêm buổi học" : "Sửa buổi học"}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <ActionForm
        action={isNew ? addClassSession : updateClassSession}
        onResult={closeOnOk}
        className="max-h-[90vh] w-full space-y-4 overflow-y-auto rounded-t-2xl border border-border bg-card p-5 shadow-card sm:max-w-md sm:rounded-2xl"
      >
        <h4 className="text-base font-semibold">{isNew ? "Thêm buổi học" : "Sửa buổi học"}</h4>
        {isNew ? (
          <input type="hidden" name="classId" value={classId} />
        ) : (
          <input type="hidden" name="sessionId" value={session.id} />
        )}

        {isNew ? (
          <fieldset className="flex flex-wrap gap-4 text-sm">
            <legend className="sr-only">Loại buổi</legend>
            <label className="flex items-center gap-1.5">
              <input type="radio" name="kind" value="makeup" defaultChecked className="accent-primary" />
              Học bù <span className="text-xs text-muted-foreground">(tính vào số buổi)</span>
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" name="kind" value="extra" className="accent-primary" />
              Tăng cường <span className="text-xs text-muted-foreground">(không tính)</span>
            </label>
          </fieldset>
        ) : (
          <fieldset className="flex flex-wrap gap-4 text-sm">
            <legend className="sr-only">Trạng thái</legend>
            <label className="flex items-center gap-1.5">
              <input type="radio" name="status" value="scheduled" defaultChecked={session.status !== "cancelled"} className="accent-primary" />
              Có học
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" name="status" value="cancelled" defaultChecked={session.status === "cancelled"} className="accent-primary" />
              Nghỉ
            </label>
          </fieldset>
        )}

        <div className="grid grid-cols-3 gap-2">
          <label className="col-span-3 block text-sm font-medium sm:col-span-1">
            Ngày
            <input type="date" name="date" required defaultValue={startsAt ? vnDateKey(startsAt) : todayKey} className={fieldClass} />
          </label>
          <label className="block text-sm font-medium">
            Bắt đầu
            <input type="time" name="start" required defaultValue={startsAt ? formatVnTime(startsAt) : "20:00"} className={fieldClass} />
          </label>
          <label className="block text-sm font-medium">
            Kết thúc
            <input type="time" name="end" required defaultValue={endsAt ? formatVnTime(endsAt) : "21:30"} className={fieldClass} />
          </label>
        </div>

        <fieldset className="text-sm">
          <legend className="font-medium">Hình thức</legend>
          <div className="mt-1 flex gap-4">
            {[
              ["offline", "Trực tiếp"],
              ["online", "Online"]
            ].map(([value, label]) => (
              <label key={value} className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="mode"
                  value={value}
                  checked={mode === value}
                  onChange={() => setMode(value)}
                  className="accent-primary"
                />
                {label}
              </label>
            ))}
          </div>
          {mode === "online" ? (
            <input
              type="url"
              name="meetingUrl"
              required
              placeholder="https://meet.google.com/…"
              defaultValue={session?.meetingUrl ?? ""}
              className={fieldClass}
            />
          ) : null}
        </fieldset>

        <label className="block text-sm font-medium">
          Ghi chú <span className="font-normal text-muted-foreground">(học gì, cần chuẩn bị gì, lý do nghỉ…)</span>
          <textarea name="note" rows={3} maxLength={500} defaultValue={session?.note ?? ""} className={fieldClass} />
        </label>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {!isNew && session.kind !== "regular" ? (
            <ActionDeleteButton
              action={deleteClassSession}
              onResult={closeOnOk}
              confirmMessage="Xoá buổi này? Học viên sẽ không còn thấy buổi này trên lịch."
              className="mr-auto rounded-lg border border-border px-3 py-2 text-sm font-semibold text-red-600 transition hover:border-red-400 dark:text-red-400"
            >
              Xoá buổi
            </ActionDeleteButton>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-muted"
          >
            Huỷ
          </button>
          <ActionSubmitButton className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-card transition hover:bg-primary/90">
            {isNew ? "Thêm buổi" : "Lưu"}
          </ActionSubmitButton>
        </div>
      </ActionForm>
    </div>,
    document.body
  );
}
```

- [ ] **Step 5: Viết `components/class-session-list.tsx`**

```tsx
"use client";

import { useState } from "react";
import { ClassSessionEditor, type EditableSession } from "@/components/class-session-editor";
import { SessionBadges } from "@/components/session-badges";
import { formatShortDate, formatVnTime, sessionNumberText } from "@/lib/class-schedule";

export type TeacherSessionRow = EditableSession & { number: number | null };

const UPCOMING_LIMIT = 8;

export function ClassSessionList({
  classId,
  sessions,
  total,
  nowIso,
  todayKey
}: {
  classId: string;
  sessions: TeacherSessionRow[];
  total: number | null;
  nowIso: string;
  todayKey: string;
}) {
  const [showAll, setShowAll] = useState(false);
  const [editing, setEditing] = useState<TeacherSessionRow | "new" | null>(null);
  const nowMs = new Date(nowIso).getTime();
  const upcoming = sessions.filter((session) => new Date(session.endsAt).getTime() > nowMs);
  const past = sessions.filter((session) => new Date(session.endsAt).getTime() <= nowMs).reverse();
  const visible = showAll ? upcoming : upcoming.slice(0, UPCOMING_LIMIT);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h4 className="text-sm font-semibold">Các buổi học</h4>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-primary transition hover:border-primary"
        >
          + Thêm buổi
        </button>
      </div>

      {sessions.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted-foreground">
          Chưa có buổi nào. Đặt lịch cố định ở khung bên cạnh hoặc bấm “+ Thêm buổi”.
        </p>
      ) : null}

      {upcoming.length > 0 ? (
        <ul className="divide-y divide-border">
          {visible.map((session) => (
            <SessionRow key={session.id} session={session} total={total} onEdit={() => setEditing(session)} />
          ))}
        </ul>
      ) : null}

      {upcoming.length > UPCOMING_LIMIT ? (
        <button
          type="button"
          onClick={() => setShowAll((value) => !value)}
          className="w-full border-t border-border px-5 py-3 text-sm font-semibold text-primary hover:bg-muted"
        >
          {showAll ? "Thu gọn" : `Xem thêm ${upcoming.length - UPCOMING_LIMIT} buổi`}
        </button>
      ) : null}

      {past.length > 0 ? (
        <details className="border-t border-border">
          <summary className="cursor-pointer px-5 py-3 text-sm font-semibold text-muted-foreground">
            Đã qua ({past.length} buổi)
          </summary>
          <ul className="divide-y divide-border">
            {past.map((session) => (
              <SessionRow key={session.id} session={session} total={total} onEdit={() => setEditing(session)} />
            ))}
          </ul>
        </details>
      ) : null}

      {editing ? (
        <ClassSessionEditor
          classId={classId}
          session={editing === "new" ? null : editing}
          todayKey={todayKey}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}

function SessionRow({
  session,
  total,
  onEdit
}: {
  session: TeacherSessionRow;
  total: number | null;
  onEdit: () => void;
}) {
  const startsAt = new Date(session.startsAt);
  const endsAt = new Date(session.endsAt);
  const cancelled = session.status === "cancelled";
  const numberText = sessionNumberText(session.number, total);

  return (
    <li className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className={`text-sm font-semibold ${cancelled ? "text-muted-foreground line-through" : ""}`}>
          {formatShortDate(startsAt)} · {formatVnTime(startsAt)}–{formatVnTime(endsAt)}
          {numberText ? ` · ${numberText}` : ""}
        </p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          <SessionBadges status={session.status} mode={session.mode} kind={session.kind} />
        </div>
        {session.note ? <p className="mt-1 truncate text-xs text-muted-foreground">{session.note}</p> : null}
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-foreground transition hover:border-primary hover:text-primary"
      >
        Sửa
      </button>
    </li>
  );
}
```

- [ ] **Step 6: Nối vào `app/teacher/classes/[classId]/page.tsx`**

Thêm import:

```tsx
import { ClassScheduleForm } from "@/components/class-schedule-form";
import { ClassSessionList } from "@/components/class-session-list";
import { vnDateKey } from "@/lib/attendance";
import { formatHm, numberSessions } from "@/lib/class-schedule";
import { getClassScheduleForTeacher } from "@/lib/class-schedule-query";
```

Ngay sau khối `if (!classItem) { notFound(); }`:

```tsx
  const schedule = await getClassScheduleForTeacher(classItem.id);
  const now = new Date();
  const todayKey = vnDateKey(now);
  const sessionNumbers = schedule ? numberSessions(schedule.sessions) : new Map<string, number>();
```

Chèn trước `</div>` cuối cùng của JSX (sau `</section>` hiện có):

```tsx
      <section className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold">Lịch học</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Học viên của lớp thấy lịch này ở trang Lịch học và nhận chuông khi có buổi nghỉ, dời, chuyển
            online hay học bù.
          </p>
        </div>
        {schedule ? (
          <div className="grid gap-5 lg:grid-cols-[24rem_minmax(0,1fr)]">
            <ClassScheduleForm
              classId={classItem.id}
              initialSlots={schedule.slots.map((slot) => ({
                weekday: slot.weekday,
                start: formatHm(slot.startMinute),
                end: formatHm(slot.endMinute)
              }))}
              startDate={schedule.scheduleStartDate ? vnDateKey(schedule.scheduleStartDate) : ""}
              totalSessions={schedule.totalSessions}
              endDate={schedule.scheduleEndDate ? vnDateKey(schedule.scheduleEndDate) : ""}
              location={schedule.location ?? ""}
              hasSessions={schedule.sessions.length > 0}
              todayKey={todayKey}
            />
            <ClassSessionList
              classId={classItem.id}
              total={schedule.totalSessions}
              nowIso={now.toISOString()}
              todayKey={todayKey}
              sessions={schedule.sessions.map((session) => ({
                id: session.id,
                startsAt: session.startsAt.toISOString(),
                endsAt: session.endsAt.toISOString(),
                status: session.status,
                mode: session.mode,
                kind: session.kind,
                meetingUrl: session.meetingUrl,
                note: session.note,
                originalStartsAt: session.originalStartsAt?.toISOString() ?? null,
                number: sessionNumbers.get(session.id) ?? null
              }))}
            />
          </div>
        ) : (
          <p className="rounded-xl border border-border bg-card px-5 py-4 text-sm text-muted-foreground">
            Chưa tải được lịch học. Tải lại trang sau ít phút.
          </p>
        )}
      </section>
```

- [ ] **Step 7: Kiểm kiểu + lint + test**

Run: `npx tsc --noEmit && pnpm lint && pnpm test`
Expected: không lỗi; `tests/teacher-page-guard.test.ts` vẫn pass (trang vẫn dùng `requireTeacherPage`).

- [ ] **Step 8: Commit**

```bash
git add lib/class-schedule-query.ts components/session-badges.tsx components/class-schedule-form.tsx components/class-session-editor.tsx components/class-session-list.tsx "app/teacher/classes/[classId]/page.tsx"
git commit -m "feat(lich-hoc): khoi Lich hoc trong trang lop - dat lich co dinh, sua/them/xoa tung buoi"
```

---

### Task 7: Trang "Lịch học" của học viên + mục menu

**Files:**
- Create: `app/student/calendar/page.tsx`, `components/student-calendar.tsx`
- Modify: `components/app-shell.tsx` (dòng 41–47, `navByRole.student`)
- Modify: `tests/practice-filter-guard.test.ts` (thêm trang mới vào `mustExcludePractice`)

**Interfaces:**
- Consumes: `getStudentSchedule` (Task 6); các hàm `lib/student-calendar.ts` (Task 4); `SessionBadges`; `formatShortDate`, `formatVnTime`, `sessionNumberText`, `vnMidnight`.
- Produces: route `/student/calendar?m=YYYY-MM&d=YYYY-MM-DD`.

- [ ] **Step 1: Thêm trang mới vào test lọc bài tự luyện (fail)**

Trong `tests/practice-filter-guard.test.ts`, thêm `"app/student/calendar/page.tsx"` vào mảng `mustExcludePractice`.

Run: `npx vitest run tests/practice-filter-guard.test.ts`
Expected: FAIL — ENOENT `app/student/calendar/page.tsx`.

- [ ] **Step 2: Viết `components/student-calendar.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { LateBadge, OverdueBadge } from "@/components/late-badge";
import { SessionBadges } from "@/components/session-badges";
import { SkillTags } from "@/components/skill-tags";
import { formatShortDate, formatVnTime, sessionNumberText } from "@/lib/class-schedule";
import { statusBadgeClasses } from "@/lib/status-badge";
import {
  formatDayHeading,
  type CalendarDay,
  type CalendarDeadlineEvent,
  type CalendarEvent,
  type CalendarMonth,
  type CalendarSessionEvent,
  type DotKind
} from "@/lib/student-calendar";

const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const NAV_BUTTON_CLASS =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border text-lg font-semibold text-foreground transition hover:bg-muted active:bg-muted";
const JOIN_EARLY_MS = 15 * 60 * 1000;

const DOT_CLASS: Record<DotKind, string> = {
  session: "bg-primary",
  "session-cancelled": "border border-primary bg-transparent",
  overdue: "bg-red-500",
  pending: "bg-amber-500",
  done: "bg-emerald-500"
};

const LEGEND: Array<[DotKind, string]> = [
  ["session", "Buổi học"],
  ["session-cancelled", "Buổi nghỉ"],
  ["pending", "Hạn nộp"],
  ["overdue", "Quá hạn"],
  ["done", "Đã nộp"]
];

const STATUS_LABELS: Record<string, string> = {
  reviewed: "Đã chấm",
  submitted: "Đã nộp",
  in_progress: "Đang làm",
  assigned: "Chưa làm"
};

function shortLabel(event: CalendarEvent): string {
  return event.type === "session"
    ? `${formatVnTime(new Date(event.startsAt))} ${event.className}`
    : `Hạn: ${event.title}`;
}

function chipClass(event: CalendarEvent): string {
  if (event.type === "session") {
    return event.status === "cancelled"
      ? "bg-muted text-muted-foreground line-through"
      : "bg-primary/10 text-primary";
  }
  if (event.state === "overdue") {
    return "bg-red-500/10 text-red-600 dark:text-red-300";
  }
  return event.state === "pending"
    ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
    : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
}

function dayAriaLabel(day: CalendarDay): string {
  const sessions = day.events.filter((event) => event.type === "session").length;
  const deadlines = day.events.length - sessions;
  const parts = [
    sessions > 0 ? `${sessions} buổi học` : "",
    deadlines > 0 ? `${deadlines} hạn nộp` : ""
  ].filter(Boolean);
  return `Ngày ${day.day}: ${parts.length > 0 ? parts.join(", ") : "không có gì"}`;
}

export function StudentCalendar({
  calendar,
  todayKey,
  initialSelected,
  nowIso,
  prevHref,
  nextHref,
  todayHref
}: {
  calendar: CalendarMonth;
  todayKey: string;
  initialSelected: string;
  nowIso: string;
  prevHref: string;
  nextHref: string;
  todayHref: string | null;
}) {
  const [selected, setSelected] = useState(initialSelected);
  const nowMs = new Date(nowIso).getTime();
  const selectedDay = calendar.days.find((day) => day.key === selected) ?? null;

  function select(key: string) {
    setSelected(key);
    try {
      window.history.replaceState(window.history.state, "", `?m=${key.slice(0, 7)}&d=${key}`);
    } catch {
      // Không đổi được URL cũng không sao — chỉ để tải lại trang vẫn đúng ngày.
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="rounded-xl border border-border bg-card p-4 shadow-card sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <Link href={prevHref} aria-label="Xem tháng trước" className={NAV_BUTTON_CLASS}>
            <span aria-hidden="true">‹</span>
          </Link>
          <div className="text-center">
            <h3 className="text-base font-semibold">
              Tháng {calendar.month}, {calendar.year}
            </h3>
            {todayHref ? (
              <Link href={todayHref} className="text-xs font-semibold text-primary hover:underline">
                Về hôm nay
              </Link>
            ) : null}
          </div>
          <Link href={nextHref} aria-label="Xem tháng sau" className={NAV_BUTTON_CLASS}>
            <span aria-hidden="true">›</span>
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS.map((label) => (
            <span key={label} className="pb-1 text-xs font-medium text-muted-foreground">
              {label}
            </span>
          ))}
          {Array.from({ length: calendar.leadingBlanks }, (_, index) => (
            <span key={`blank-${index}`} aria-hidden="true" />
          ))}
          {calendar.days.map((day) => {
            const isToday = day.key === todayKey;
            const isSelected = day.key === selected;
            return (
              <button
                key={day.key}
                type="button"
                onClick={() => select(day.key)}
                aria-pressed={isSelected}
                aria-label={dayAriaLabel(day)}
                className={`flex min-h-[3rem] flex-col items-center rounded-lg px-0.5 py-1 text-xs transition sm:min-h-[5.5rem] sm:items-stretch sm:px-1 ${
                  isSelected ? "bg-primary/15 ring-1 ring-primary" : "hover:bg-muted"
                }`}
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center self-center rounded-full ${
                    isToday ? "bg-primary font-semibold text-primary-foreground" : ""
                  }`}
                >
                  {day.day}
                </span>
                <span className="mt-1 flex gap-0.5 sm:hidden" aria-hidden="true">
                  {day.dots.map((dot) => (
                    <span key={dot} className={`h-1.5 w-1.5 rounded-full ${DOT_CLASS[dot]}`} />
                  ))}
                </span>
                <span className="mt-1 hidden w-full space-y-0.5 sm:block" aria-hidden="true">
                  {day.events.slice(0, 2).map((event) => (
                    <span
                      key={`${event.type}-${event.id}`}
                      className={`block truncate rounded px-1 text-left text-[11px] leading-4 ${chipClass(event)}`}
                    >
                      {shortLabel(event)}
                    </span>
                  ))}
                  {day.events.length > 2 ? (
                    <span className="block text-left text-[11px] text-muted-foreground">
                      +{day.events.length - 2}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>

        {/* Điện thoại không có hover — màu chấm phải có chú giải ngay trên trang. */}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {LEGEND.map(([kind, label]) => (
            <span key={kind} className="flex items-center gap-1.5">
              <span aria-hidden="true" className={`h-2 w-2 rounded-full ${DOT_CLASS[kind]}`} />
              {label}
            </span>
          ))}
        </div>
      </section>

      <section className="h-fit rounded-xl border border-border bg-card shadow-card">
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-base font-semibold">{formatDayHeading(selected)}</h3>
        </div>
        <div className="space-y-3 p-4">
          {selectedDay && selectedDay.events.length > 0 ? (
            selectedDay.events.map((event) =>
              event.type === "session" ? (
                <SessionCard key={`session-${event.id}`} event={event} nowMs={nowMs} />
              ) : (
                <DeadlineCard key={`deadline-${event.id}`} event={event} />
              )
            )
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Không có buổi học hay hạn nộp nào.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function SessionCard({ event, nowMs }: { event: CalendarSessionEvent; nowMs: number }) {
  const startsAt = new Date(event.startsAt);
  const endsAt = new Date(event.endsAt);
  const cancelled = event.status === "cancelled";
  const online = event.mode === "online";
  const joinNow = nowMs >= startsAt.getTime() - JOIN_EARLY_MS && nowMs <= endsAt.getTime();
  const movedFrom =
    event.originalStartsAt && event.originalStartsAt !== event.startsAt ? new Date(event.originalStartsAt) : null;
  const numberText = sessionNumberText(event.number, event.total);

  return (
    <article className="rounded-lg border border-border bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={`font-semibold ${cancelled ? "text-muted-foreground line-through" : ""}`}>
            {formatVnTime(startsAt)}–{formatVnTime(endsAt)} · {event.className}
          </p>
          {numberText ? <p className="mt-0.5 text-sm text-muted-foreground">{numberText}</p> : null}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <SessionBadges status={event.status} mode={event.mode} kind={event.kind} />
        </div>
      </div>
      {!cancelled && !online && event.location ? (
        <p className="mt-2 text-sm text-muted-foreground">📍 {event.location}</p>
      ) : null}
      {movedFrom ? (
        <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
          Dời từ {formatShortDate(movedFrom)} {formatVnTime(movedFrom)}
        </p>
      ) : null}
      {event.note ? (
        <p className="mt-2 whitespace-pre-line rounded-md bg-muted px-3 py-2 text-sm">{event.note}</p>
      ) : null}
      {online && !cancelled && event.meetingUrl ? (
        <a
          href={event.meetingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`mt-3 inline-flex rounded-lg px-4 py-2 text-sm font-semibold transition ${
            joinNow
              ? "bg-primary text-primary-foreground shadow-card hover:bg-primary/90"
              : "border border-border text-primary hover:border-primary"
          }`}
        >
          Vào lớp
        </a>
      ) : null}
    </article>
  );
}

function DeadlineCard({ event }: { event: CalendarDeadlineEvent }) {
  const done = event.state === "done" || event.state === "late";

  return (
    <article className="rounded-lg border border-border bg-background p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Hạn nộp {formatVnTime(new Date(event.deadline))}
      </p>
      <p className="mt-1 font-semibold">{event.title}</p>
      <div className="mt-2">
        <SkillTags skills={event.skills} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {event.state === "overdue" ? (
          <OverdueBadge className="px-3 py-1" />
        ) : (
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusBadgeClasses(event.status)}`}>
            {STATUS_LABELS[event.status] ?? "Chưa làm"}
          </span>
        )}
        {event.state === "late" ? <LateBadge className="px-3 py-1" /> : null}
        <Link
          href={event.href}
          className={`ml-auto rounded-lg px-4 py-2 text-sm font-semibold transition ${
            done
              ? "border border-border bg-card text-foreground hover:border-primary hover:text-primary"
              : "bg-primary text-primary-foreground shadow-card hover:bg-primary/90"
          }`}
        >
          {done ? "Xem lại" : "Làm bài"}
        </Link>
      </div>
    </article>
  );
}
```

- [ ] **Step 3: Viết `app/student/calendar/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { StudentCalendar } from "@/components/student-calendar";
import { vnDateKey } from "@/lib/attendance";
import { auth } from "@/lib/auth";
import { vnMidnight } from "@/lib/class-schedule";
import { getStudentSchedule } from "@/lib/class-schedule-query";
import { excludePracticeAssignment } from "@/lib/practice";
import { prisma } from "@/lib/prisma";
import {
  buildCalendarMonth,
  monthParam,
  resolveCalendarMonth,
  resolveSelectedDay,
  shiftMonth,
  toDeadlineEvents,
  toSessionEvents
} from "@/lib/student-calendar";

export const dynamic = "force-dynamic";

export default async function StudentCalendarPage({
  searchParams
}: {
  searchParams?: { m?: string; d?: string };
}) {
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

  const now = new Date();
  const { year, month } = resolveCalendarMonth(searchParams?.m, now);
  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);
  const monthStart = vnMidnight(`${monthParam(year, month)}-01`);
  const monthEnd = vnMidnight(`${monthParam(next.year, next.month)}-01`);

  const [schedule, recipients] = await Promise.all([
    getStudentSchedule(student.id),
    prisma.assignmentRecipient.findMany({
      // Bài tự luyện không có hạn nộp, nhưng vẫn lọc rõ ràng như mọi danh sách bài giao.
      where: {
        studentId: student.id,
        assignment: { ...excludePracticeAssignment, deadline: { gte: monthStart, lt: monthEnd } }
      },
      select: {
        id: true,
        status: true,
        submittedAt: true,
        assignment: {
          select: {
            title: true,
            deadline: true,
            units: { select: { assignableUnit: { select: { skill: true } } } }
          }
        },
        attempts: { orderBy: { startedAt: "desc" }, take: 1, select: { id: true } }
      }
    })
  ]);

  const events = [
    ...toSessionEvents(schedule.classes, schedule.sessions),
    ...toDeadlineEvents(
      recipients.flatMap((recipient) =>
        recipient.assignment.deadline
          ? [
              {
                id: recipient.id,
                status: recipient.status,
                submittedAt: recipient.submittedAt,
                deadline: recipient.assignment.deadline,
                title: recipient.assignment.title,
                skills: recipient.assignment.units.map((unit) => unit.assignableUnit.skill),
                latestAttemptId: recipient.attempts[0]?.id ?? null
              }
            ]
          : []
      ),
      now
    )
  ];

  const current = resolveCalendarMonth(undefined, now);
  const isCurrentMonth = current.year === year && current.month === month;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold text-primary">Trang học viên</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Lịch học</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Buổi học của lớp và hạn nộp bài trong tháng. Bấm vào một ngày để xem chi tiết.
        </p>
      </header>

      {schedule.sessions.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-card px-5 py-4 text-sm text-muted-foreground">
          Lớp của bạn chưa có lịch học — giáo viên sẽ cập nhật sớm. Hạn nộp bài vẫn hiện trên lịch.
        </p>
      ) : null}

      {/* key theo tháng: đổi tháng thì dựng lại component để ngày đang chọn không kẹt ở tháng cũ. */}
      <StudentCalendar
        key={monthParam(year, month)}
        calendar={buildCalendarMonth(year, month, events)}
        todayKey={vnDateKey(now)}
        initialSelected={resolveSelectedDay(searchParams?.d, year, month, now)}
        nowIso={now.toISOString()}
        prevHref={`/student/calendar?m=${monthParam(prev.year, prev.month)}`}
        nextHref={`/student/calendar?m=${monthParam(next.year, next.month)}`}
        todayHref={isCurrentMonth ? null : "/student/calendar"}
      />
    </div>
  );
}
```

- [ ] **Step 4: Thêm mục menu** (`components/app-shell.tsx`, trong `navByRole.student`, ngay sau dòng "Tổng quan"):

```tsx
    { href: "/student/calendar", label: "Lịch học", hint: "Buổi học & hạn nộp", icon: "calendar" },
```

- [ ] **Step 5: Chạy test + kiểu + lint**

Run: `npx vitest run tests/practice-filter-guard.test.ts && npx tsc --noEmit && pnpm lint`
Expected: PASS, không lỗi.

- [ ] **Step 6: Commit**

```bash
git add app/student/calendar/page.tsx components/student-calendar.tsx components/app-shell.tsx tests/practice-filter-guard.test.ts
git commit -m "feat(lich-hoc): trang Lich hoc cho hoc vien - luoi thang, buoi hoc + han nop theo ngay"
```

---

### Task 8: Thẻ "Buổi học tới" trên Tổng quan

**Files:**
- Create: `components/next-session-card.tsx`
- Modify: `app/student/page.tsx`

**Interfaces:**
- Consumes: `getStudentSchedule`; `findNextSession`, `numberSessions`, `relativeSessionLabel`, `sessionNumberText` (Task 2–3); `pendingBeforeSession` (Task 4); `vnDateKey`.

- [ ] **Step 1: Viết `components/next-session-card.tsx`**

```tsx
import Link from "next/link";

// Một dòng gọn trên trang Tổng quan: buổi học tới (hoặc đang diễn ra) + số bài
// cần nộp trước buổi đó. Nằm TRÊN khối "Bài được giao" nhưng thấp để không đẩy
// danh sách bài xuống xa trên điện thoại.
export function NextSessionCard({
  label,
  classLabel,
  numberText,
  ongoing,
  pendingCount,
  meetingUrl,
  calendarHref
}: {
  label: string;
  classLabel: string;
  numberText: string | null;
  ongoing: boolean;
  pendingCount: number;
  meetingUrl: string | null;
  calendarHref: string;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 px-5 py-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          {ongoing ? "Đang diễn ra" : "Buổi học tới"}
        </p>
        <p className="mt-1 font-semibold">
          <span aria-hidden="true">📅 </span>
          {label} · {classLabel}
          {numberText ? ` · ${numberText}` : ""}
        </p>
        {pendingCount > 0 ? (
          <p className="mt-1 text-sm font-medium text-amber-700 dark:text-amber-300">
            {pendingCount} bài cần nộp trước buổi này
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 gap-2">
        {meetingUrl ? (
          <a
            href={meetingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-card transition hover:bg-primary/90"
          >
            Vào lớp
          </a>
        ) : null}
        <Link
          href={calendarHref}
          className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition hover:border-primary hover:text-primary"
        >
          Xem lịch
        </Link>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Sửa `app/student/page.tsx`**

Thêm import:

```tsx
import { NextSessionCard } from "@/components/next-session-card";
import { vnDateKey } from "@/lib/attendance";
import { findNextSession, numberSessions, relativeSessionLabel, sessionNumberText } from "@/lib/class-schedule";
import { getStudentSchedule } from "@/lib/class-schedule-query";
import { pendingBeforeSession } from "@/lib/student-calendar";
```

Trong `Promise.all`: đổi destructuring thành `const [recipients, attempts, membership, wordOfDay, vocabSidebar, schedule] = await Promise.all([` và thêm phần tử cuối `getStudentSchedule(student.id)` (sau `getVocabSidebar(student.id)`). Sửa comment phía trên thành "Các truy vấn dưới đây không phụ thuộc nhau…".

Ngay sau dòng `const now = new Date();` (dòng 122):

```tsx
  // Buổi học sắp tới (hoặc đang diễn ra) trong mọi lớp học viên đang theo.
  const nextSession = findNextSession(schedule.sessions, now);
  const nextSessionClass = nextSession
    ? schedule.classes.find((classItem) => classItem.id === nextSession.classId) ?? null
    : null;
  const nextSessionKey = nextSession ? vnDateKey(nextSession.startsAt) : null;
```

Chèn ngay trước comment `{/* Việc chính của học viên đứng đầu trang: ...`:

```tsx
      {nextSession && nextSessionClass && nextSessionKey ? (
        <NextSessionCard
          label={relativeSessionLabel(nextSession.startsAt, now)}
          classLabel={nextSessionClass.name}
          numberText={sessionNumberText(
            numberSessions(
              schedule.sessions.filter((item) => item.classId === nextSession.classId)
            ).get(nextSession.id) ?? null,
            nextSessionClass.totalSessions
          )}
          ongoing={nextSession.startsAt.getTime() <= now.getTime()}
          pendingCount={pendingBeforeSession(
            recipients.map((recipient) => ({
              status: recipient.status,
              deadline: recipient.assignment.deadline
            })),
            nextSession.startsAt,
            now
          )}
          meetingUrl={nextSession.mode === "online" ? nextSession.meetingUrl : null}
          calendarHref={`/student/calendar?m=${nextSessionKey.slice(0, 7)}&d=${nextSessionKey}`}
        />
      ) : null}
```

- [ ] **Step 3: Kiểu + lint + test**

Run: `npx tsc --noEmit && pnpm lint && pnpm test`
Expected: không lỗi.

- [ ] **Step 4: Commit**

```bash
git add components/next-session-card.tsx app/student/page.tsx
git commit -m "feat(lich-hoc): the Buoi hoc toi tren Tong quan hoc vien"
```

---

### Task 9: Chuông thông báo đổi lịch

**Files:**
- Modify: `lib/notifications.ts`, `lib/notifications-feed.ts`, `components/notification-list.tsx`, `lib/class-schedule.ts`
- Test: `tests/notifications.test.ts` (thêm), `tests/class-schedule-display.test.ts` (thêm)

**Interfaces:**
- Consumes: `sessionChangeText` (Task 3), `vnDateKey`.
- Produces:
  - `StudentNotificationType` thêm `"session_change" | "schedule_update"`
  - `type SessionChangeNotificationSource = { sessionId: string; text: string; dayKey: string; changedAt: Date }`
  - `type ScheduleUpdateNotificationSource = { classId: string; className: string; changedAt: Date }`
  - `buildStudentNotifications(reviews, assignments, readAt, bugs = [], schedule: { sessions?: SessionChangeNotificationSource[]; schedules?: ScheduleUpdateNotificationSource[] } = {})`
  - `buildScheduleNotificationSources(input: { memberships: Array<{ classId: string; className: string; joinedAt: Date; scheduleChangedAt: Date | null }>; sessions: Array<{ id: string; classId: string; startsAt: Date; originalStartsAt: Date | null; kind: string; changeKind: string | null; changedAt: Date | null }> }): { sessions: SessionChangeNotificationSource[]; schedules: ScheduleUpdateNotificationSource[] }` (trong `lib/class-schedule.ts`)

- [ ] **Step 1: Viết test (fail)**

Thêm vào cuối `tests/notifications.test.ts`:

```ts
describe("thông báo lịch học", () => {
  const readAt = new Date("2026-09-20T00:00:00Z");

  it("đổi buổi học và cập nhật lịch cố định thành mục chuông", () => {
    const items = buildStudentNotifications([], [], readAt, [], {
      sessions: [
        { sessionId: "s1", text: "Nghỉ học buổi T7 26/9 (PĐ K1)", dayKey: "2026-09-26", changedAt: new Date("2026-09-21T03:00:00Z") }
      ],
      schedules: [{ classId: "k1", className: "PĐ K1", changedAt: new Date("2026-09-19T03:00:00Z") }]
    });

    expect(items[0]).toMatchObject({
      type: "session_change",
      title: "Nghỉ học buổi T7 26/9 (PĐ K1)",
      href: "/student/calendar?m=2026-09&d=2026-09-26",
      unread: true
    });
    expect(items[1]).toMatchObject({
      type: "schedule_update",
      title: "Lịch học lớp PĐ K1 vừa được cập nhật",
      href: "/student/calendar",
      unread: false
    });
  });

  it("feed đọc lịch học trong try/catch (bảng mới có thể chưa có trên prod)", () => {
    const feed = readFileSync("lib/notifications-feed.ts", "utf8");
    expect(feed).toMatch(/try\s*\{[\s\S]*prisma\.classSession\.findMany[\s\S]*\}\s*catch/);
  });
});
```

Thêm vào cuối `tests/class-schedule-display.test.ts` (thêm `buildScheduleNotificationSources` vào import):

```ts
describe("buildScheduleNotificationSources", () => {
  const memberships = [
    { classId: "k1", className: "PĐ K1", joinedAt: at("2026-09-10", "10:00"), scheduleChangedAt: at("2026-09-15", "10:00") },
    { classId: "k2", className: "PĐ K2", joinedAt: at("2026-09-20", "10:00"), scheduleChangedAt: at("2026-09-15", "10:00") }
  ];

  it("chỉ báo thay đổi xảy ra sau khi học viên vào lớp", () => {
    const result = buildScheduleNotificationSources({
      memberships,
      sessions: [
        { id: "a", classId: "k1", startsAt: at("2026-09-26", "20:15"), originalStartsAt: null, kind: "regular", changeKind: "cancelled", changedAt: at("2026-09-21", "09:00") },
        { id: "b", classId: "k2", startsAt: at("2026-09-26", "09:00"), originalStartsAt: null, kind: "regular", changeKind: "online", changedAt: at("2026-09-18", "09:00") },
        { id: "c", classId: "k9", startsAt: at("2026-09-26", "09:00"), originalStartsAt: null, kind: "regular", changeKind: "online", changedAt: at("2026-09-21", "09:00") }
      ]
    });
    expect(result.sessions).toEqual([
      { sessionId: "a", text: "Nghỉ học buổi T7 26/9 (PĐ K1)", dayKey: "2026-09-26", changedAt: at("2026-09-21", "09:00") }
    ]);
    expect(result.schedules).toEqual([{ classId: "k1", className: "PĐ K1", changedAt: at("2026-09-15", "10:00") }]);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run tests/notifications.test.ts tests/class-schedule-display.test.ts`
Expected: FAIL — kiểu thông báo / hàm chưa có.

- [ ] **Step 3: Sửa `lib/notifications.ts`**

Đổi dòng type:

```ts
export type StudentNotificationType =
  | "review_done"
  | "assignment_new"
  | "bug_resolved"
  | "session_change"
  | "schedule_update";
```

Thêm sau `BugResolvedNotificationSource`:

```ts
// Giáo viên sửa tay một buổi chưa diễn ra (nghỉ, học lại, dời, đổi hình thức, thêm buổi).
export type SessionChangeNotificationSource = {
  sessionId: string;
  text: string; // câu đã dựng sẵn bằng sessionChangeText
  dayKey: string; // "YYYY-MM-DD" ngày của buổi học (giờ VN)
  changedAt: Date;
};

// Giáo viên đổi lịch cố định của lớp.
export type ScheduleUpdateNotificationSource = {
  classId: string;
  className: string;
  changedAt: Date;
};
```

Đổi chữ ký `buildStudentNotifications` (thêm tham số thứ 5) và thêm 2 nguồn vào mảng `items` (sau `...bugs.map(...)`):

```ts
  // Tham số thứ 4 tuỳ chọn: chỗ gọi cũ và test cũ không phải sửa.
  bugs: BugResolvedNotificationSource[] = [],
  // Tham số thứ 5 tuỳ chọn: nguồn lịch học.
  schedule: {
    sessions?: SessionChangeNotificationSource[];
    schedules?: ScheduleUpdateNotificationSource[];
  } = {}
): StudentNotification[] {
```

```ts
    ...(schedule.sessions ?? []).map((item) => ({
      id: `session:${item.sessionId}:${item.changedAt.getTime()}`,
      type: "session_change" as const,
      title: item.text,
      detail: null,
      href: `/student/calendar?m=${item.dayKey.slice(0, 7)}&d=${item.dayKey}`,
      createdAt: item.changedAt,
      unread: isUnread(item.changedAt, readAt)
    })),
    ...(schedule.schedules ?? []).map((item) => ({
      id: `schedule:${item.classId}:${item.changedAt.getTime()}`,
      type: "schedule_update" as const,
      title: `Lịch học lớp ${item.className} vừa được cập nhật`,
      detail: null,
      href: "/student/calendar",
      createdAt: item.changedAt,
      unread: isUnread(item.changedAt, readAt)
    }))
```

- [ ] **Step 4: Thêm `buildScheduleNotificationSources` vào cuối `lib/class-schedule.ts`**

Thêm import type ở đầu file:

```ts
import type {
  ScheduleUpdateNotificationSource,
  SessionChangeNotificationSource
} from "@/lib/notifications";
```

Hàm:

```ts
// Nguồn chuông "lịch học" cho một học viên. Chỉ báo thay đổi xảy ra SAU khi học
// viên vào lớp, để người mới không bị dội thông báo cũ.
export function buildScheduleNotificationSources(input: {
  memberships: Array<{ classId: string; className: string; joinedAt: Date; scheduleChangedAt: Date | null }>;
  sessions: Array<{
    id: string;
    classId: string;
    startsAt: Date;
    originalStartsAt: Date | null;
    kind: string;
    changeKind: string | null;
    changedAt: Date | null;
  }>;
}): { sessions: SessionChangeNotificationSource[]; schedules: ScheduleUpdateNotificationSource[] } {
  const byClass = new Map(input.memberships.map((membership) => [membership.classId, membership]));

  const sessions = input.sessions.flatMap((session) => {
    const membership = byClass.get(session.classId);
    if (
      !membership ||
      !session.changeKind ||
      !session.changedAt ||
      session.changedAt.getTime() <= membership.joinedAt.getTime()
    ) {
      return [];
    }
    return [
      {
        sessionId: session.id,
        text: sessionChangeText({
          changeKind: session.changeKind,
          kind: session.kind,
          startsAt: session.startsAt,
          originalStartsAt: session.originalStartsAt,
          className: membership.className
        }),
        dayKey: vnDateKey(session.startsAt),
        changedAt: session.changedAt
      }
    ];
  });

  const schedules = input.memberships.flatMap((membership) =>
    membership.scheduleChangedAt && membership.scheduleChangedAt.getTime() > membership.joinedAt.getTime()
      ? [{ classId: membership.classId, className: membership.className, changedAt: membership.scheduleChangedAt }]
      : []
  );

  return { sessions, schedules };
}
```

- [ ] **Step 5: Sửa `lib/notifications-feed.ts`**

Thêm import:

```ts
import { buildScheduleNotificationSources } from "@/lib/class-schedule";
```

Sau khối try/catch của `bugs`, thêm:

```ts
  // Lịch học (bảng mới) — bọc try/catch như BugReport để chuông không sập theo.
  let scheduleSources: ReturnType<typeof buildScheduleNotificationSources> = { sessions: [], schedules: [] };
  try {
    const memberships = await prisma.classStudent.findMany({
      where: { studentId },
      select: { classId: true, joinedAt: true, class: { select: { name: true, scheduleChangedAt: true } } }
    });
    const changedSessions =
      memberships.length === 0
        ? []
        : await prisma.classSession.findMany({
            where: {
              classId: { in: memberships.map((membership) => membership.classId) },
              changeKind: { not: null }
            },
            orderBy: { changedAt: "desc" },
            take: NOTIFICATION_LIMIT,
            select: {
              id: true,
              classId: true,
              startsAt: true,
              originalStartsAt: true,
              kind: true,
              changeKind: true,
              changedAt: true
            }
          });
    scheduleSources = buildScheduleNotificationSources({
      memberships: memberships.map((membership) => ({
        classId: membership.classId,
        className: membership.class.name,
        joinedAt: membership.joinedAt,
        scheduleChangedAt: membership.class.scheduleChangedAt
      })),
      sessions: changedSessions
    });
  } catch (error) {
    console.error("[thong-bao] Không đọc được lịch học:", error);
  }
```

Và truyền tham số thứ 5 vào `buildStudentNotifications(..., bugs, scheduleSources)`.

- [ ] **Step 6: Thêm nhãn trong `components/notification-list.tsx`**

```tsx
const LABELS: Record<StudentNotificationType, string> = {
  review_done: "Đã chấm xong",
  assignment_new: "Bài mới",
  bug_resolved: "Báo lỗi",
  session_change: "Đổi lịch học",
  schedule_update: "Lịch học"
};
```

- [ ] **Step 7: Chạy test + kiểu**

Run: `npx vitest run tests/notifications.test.ts tests/class-schedule-display.test.ts && npx tsc --noEmit`
Expected: PASS, không lỗi kiểu.

- [ ] **Step 8: Commit**

```bash
git add lib/notifications.ts lib/notifications-feed.ts components/notification-list.tsx lib/class-schedule.ts tests/notifications.test.ts tests/class-schedule-display.test.ts
git commit -m "feat(lich-hoc): chuong bao doi buoi hoc va cap nhat lich co dinh"
```

---

### Task 10: Chip hạn nộp "Trước buổi học tới"

**Files:**
- Create: `components/due-date-time-inputs.tsx`
- Modify: `components/due-date-field.tsx`, `components/assignment-builder.tsx` (dòng 81–107), `app/teacher/assignments/page.tsx`

**Interfaces:**
- Consumes: `buildSessionPicks`, `type SessionPick` (Task 3).
- Produces: `DueDateField` nhận thêm `sessionPicks?: SessionPick[]`, `onPickTime?: (time: string) => void`; `<DueDateTimeInputs fieldClass sessionPicks />`; `AssignmentBuilder` nhận thêm prop tuỳ chọn `sessionPicks?: SessionPick[]` (mặc định `[]`).

- [ ] **Step 1: Sửa `components/due-date-field.tsx`**

Thêm import `import type { SessionPick } from "@/lib/class-schedule";`. Thêm vào `DueDateFieldProps`:

```ts
  // Chip "Trước buổi <lớp> · T4 23/9 20:15": đặt ngày ở đây, báo giờ ra ngoài qua onPickTime.
  sessionPicks?: SessionPick[];
  onPickTime?: (time: string) => void;
```

Nhận thêm 2 prop trong destructuring (`sessionPicks, onPickTime`). Ngay sau khối `{quickPicks ? (...) : null}` thêm:

```tsx
      {sessionPicks && sessionPicks.length > 0 ? (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {sessionPicks.map((pick) => (
            <button
              key={pick.key}
              type="button"
              onClick={() => {
                setSelected(parseYmd(pick.date));
                onPickTime?.(pick.time);
              }}
              className="rounded-full border border-primary/40 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary transition hover:border-primary"
            >
              {pick.label}
            </button>
          ))}
        </div>
      ) : null}
```

- [ ] **Step 2: Viết `components/due-date-time-inputs.tsx`**

```tsx
"use client";

import { useState } from "react";
import { DueDateField } from "@/components/due-date-field";
import type { SessionPick } from "@/lib/class-schedule";

// Cụm "Ngày / Giờ" hạn nộp của modal giao bài. Giờ là state có kiểm soát để chip
// "Trước buổi học tới" điền được cả giờ, không chỉ ngày.
export function DueDateTimeInputs({
  fieldClass,
  sessionPicks
}: {
  fieldClass: string;
  sessionPicks: SessionPick[];
}) {
  const [time, setTime] = useState("23:59");

  return (
    <div className="mt-2 grid gap-3 sm:grid-cols-2">
      <div>
        <label className="block text-xs font-medium text-muted-foreground" htmlFor="dueDate">
          Ngày
        </label>
        <DueDateField id="dueDate" name="dueDate" quickPicks sessionPicks={sessionPicks} onPickTime={setTime} />
      </div>
      <div>
        <label className="block text-xs font-medium text-muted-foreground" htmlFor="dueTime">
          Giờ
        </label>
        <input
          id="dueTime"
          name="dueTime"
          type="time"
          value={time}
          onChange={(event) => setTime(event.target.value)}
          className={fieldClass}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Sửa `components/assignment-builder.tsx`**

- Import: bỏ `import { DueDateField } from "@/components/due-date-field";`, thêm `import { DueDateTimeInputs } from "@/components/due-date-time-inputs";` và `import type { SessionPick } from "@/lib/class-schedule";`.
- `AssignmentBuilderProps` thêm `sessionPicks?: SessionPick[];` (tuỳ chọn, để nơi khác dùng `AssignmentBuilder` không vỡ) và destructure `sessionPicks = []`.
- Thay toàn bộ khối `<div className="mt-2 grid gap-3 sm:grid-cols-2"> ... </div>` ngay dưới `<legend className="text-sm font-medium">Hạn nộp</legend>` (hai cột Ngày/Giờ, dòng 82–107) bằng:

```tsx
              <DueDateTimeInputs fieldClass={fieldClass} sessionPicks={sessionPicks} />
```

- [ ] **Step 4: Sửa `app/teacher/assignments/page.tsx`**

Import:

```tsx
import { buildSessionPicks, type SessionPick } from "@/lib/class-schedule";
```

Sau khối `Promise.all` (sau `const classOptions = ...`):

```tsx
  // Buổi học sắp tới của từng lớp -> chip hạn nộp "Trước buổi học tới". Bọc
  // try/catch: bảng lịch học mới thêm, thiếu bảng thì chỉ mất chip.
  let sessionPicks: SessionPick[] = [];
  try {
    const upcoming = await prisma.classSession.findMany({
      where: { class: { teacherId: teacher.id }, status: "scheduled", startsAt: { gt: new Date() } },
      orderBy: { startsAt: "asc" },
      take: 60,
      select: { classId: true, startsAt: true, class: { select: { name: true } } }
    });
    sessionPicks = buildSessionPicks(
      upcoming.map((session) => ({
        classId: session.classId,
        className: session.class.name,
        startsAt: session.startsAt
      }))
    );
  } catch (error) {
    console.error("[giao-bai] Không đọc được buổi học sắp tới:", error);
  }
```

Truyền `sessionPicks={sessionPicks}` vào `<AssignmentBuilder ... />`.

- [ ] **Step 5: Kiểu + lint + test**

Run: `npx tsc --noEmit && pnpm lint && pnpm test`
Expected: không lỗi (form sửa bài `assignment-edit-form.tsx` vẫn dùng `DueDateField` như cũ).

- [ ] **Step 6: Commit**

```bash
git add components/due-date-field.tsx components/due-date-time-inputs.tsx components/assignment-builder.tsx app/teacher/assignments/page.tsx
git commit -m "feat(lich-hoc): chip han nop Truoc buoi hoc toi trong modal giao bai"
```

---

### Task 11: Cron nối buổi cho lớp học liên tục

**Files:**
- Modify: `app/api/cron/reminders/route.ts`
- Test: `tests/class-schedule-guard.test.ts` (thêm)

**Interfaces:**
- Consumes: `topUpClassSessions` (Task 5).

- [ ] **Step 1: Viết test (fail)** — thêm vào cuối `tests/class-schedule-guard.test.ts`:

```ts
describe("cron nối buổi học", () => {
  const cron = readFileSync("app/api/cron/reminders/route.ts", "utf8");

  it("gọi topUpClassSessions trong try/catch riêng", () => {
    expect(cron).toMatch(/try\s*\{\s*sessionsCreated = await topUpClassSessions\(\);\s*\}\s*catch/);
  });

  // Chỗ kiểm cấu hình mail return sớm — nối buổi phải chạy trước nó.
  it("nối buổi chạy trước khi kiểm cấu hình mail, sau khi đánh thức DB", () => {
    const warm = cron.indexOf("warmUpDatabase(");
    const topUp = cron.indexOf("await topUpClassSessions()");
    const email = cron.indexOf("isEmailConfigured()");
    expect(warm).toBeGreaterThan(-1);
    expect(warm).toBeLessThan(topUp);
    expect(topUp).toBeLessThan(email);
  });
});
```

Run: `npx vitest run tests/class-schedule-guard.test.ts`
Expected: FAIL.

- [ ] **Step 2: Sửa route**

Import `import { topUpClassSessions } from "@/lib/class-schedule-sync";`.

Đổi thứ tự: di chuyển toàn bộ khối `// Đánh thức Neon trước ... try { ... } catch { ... return 503 }` lên **trước** khối `if (!isEmailConfigured()) { ... }`. Ngay sau khối đánh thức DB, trước `if (!isEmailConfigured())`, thêm:

```ts
  // Nối thêm buổi học cho lớp học liên tục (luôn có sẵn 12 tuần). Làm TRƯỚC khi
  // kiểm cấu hình mail vì việc này không cần mail; lỗi ở đây không chặn nhắc bài.
  let sessionsCreated = 0;
  try {
    sessionsCreated = await topUpClassSessions();
  } catch (error) {
    console.error("[cron/reminders] Không nối được buổi học:", error);
  }
```

Trong `return NextResponse.json({ skipped: "email_not_configured" })` đổi thành `NextResponse.json({ skipped: "email_not_configured", sessionsCreated })`; trong `return` cuối cùng thêm trường `sessionsCreated,`.

- [ ] **Step 3: Chạy test + kiểu**

Run: `npx vitest run tests/class-schedule-guard.test.ts tests/practice-filter-guard.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/api/cron/reminders/route.ts tests/class-schedule-guard.test.ts
git commit -m "feat(lich-hoc): cron hang ngay noi them buoi cho lop hoc lien tuc"
```

---

### Task 12: Kiểm tra toàn bộ, kiểm trên trình duyệt, tài liệu, push

**Files:**
- Modify: `CLAUDE.md` (thêm mục kiến trúc "Lịch học"), `docs/superpowers/specs/2026-09-24-lich-hoc-hoc-vien-design.md` (Trạng thái → đã ship)

- [ ] **Step 1: Chạy toàn bộ kiểm tra tĩnh**

Run: `pnpm test && pnpm lint && npx tsc --noEmit && pnpm build`
Expected: tất cả xanh. `pnpm build` chạy `ensure-db` trên DB test local — log "[ensure-db] OK". Sau đó `git checkout tsconfig.tsbuildinfo` nếu tsc làm bẩn nó.

- [ ] **Step 2: Kiểm trên trình duyệt (DB test local)**

1. `preview_start` với `ielts-dev`.
2. Nhờ người dùng đăng nhập tài khoản **giáo viên** trong khung trình duyệt (Claude không gõ mật khẩu).
3. Vào `/teacher/classes` → mở một lớp → khối Lịch học: nhập lịch PĐ K2 (Thứ 3 20:15–21:45, Thứ 7 09:00–10:30), khai giảng 01/09/2026, 24 buổi → Lưu. Kiểm: toast "Đã lưu lịch học…", danh sách có "Buổi 1/24"…, "Đã qua" có các buổi từ 1/9.
4. Sửa một buổi sắp tới → Nghỉ → kiểm cuối danh sách có thêm 1 buổi (vẫn "Buổi 24/24" ở cuối). Thêm buổi Học bù → buổi cuối rút đi. Chuyển một buổi sang Online với link `https://meet.google.com/abc-defg-hij`. Trước khi bấm Xoá buổi: chạy `window.confirm = () => true` (bẫy CDP).
5. `/teacher/assignments` → mở giao bài → ô Hạn nộp có chip "Trước buổi … · T3 …" → bấm → ngày + giờ đổi đúng.
6. Nhờ người dùng đăng nhập tài khoản **học viên** thuộc lớp đó (hoặc thêm học viên demo vào lớp trước).
7. `/student` → thẻ "Buổi học tới" hiện đúng; `/student/calendar` → chấm màu, bấm ngày có buổi online → nút "Vào lớp"; chuông có "Nghỉ học buổi…", "Buổi … chuyển học online", "Lịch học lớp … vừa được cập nhật".
8. `resize_window` preset `mobile` → tải lại `/student/calendar`: lưới 7 cột không tràn ngang (`document.documentElement.scrollWidth <= innerWidth`), chỉ có chấm; danh sách ngày nằm dưới lưới. Kiểm thêm `colorScheme: "dark"`. Trả về `preset: "desktop"` khi xong.
9. `read_console_messages` onlyErrors → không có lỗi mới (bỏ qua lỗi dev-mode "Invalid hook call" ở /teacher đã biết).
10. Chụp màn hình trang Lịch học (mobile + desktop) làm bằng chứng. `preview_stop`.

- [ ] **Step 3: Cập nhật `CLAUDE.md`** — thêm mục con dưới `## Architecture` (sau "### Media upload"):

```markdown
### Lịch học (`lib/class-schedule.ts`, `lib/class-schedule-sync.ts`)
Mỗi lớp có lịch cố định hàng tuần (`ClassScheduleSlot`) được đồng bộ thành từng dòng `ClassSession` bằng hàm thuần `planRegularSessions` — action chỉ đọc → tính → ghi trong `$transaction`. Buổi đã sửa tay (`edited`), buổi học bù/tăng cường và buổi trước `scheduleAppliesFrom` không bao giờ bị tạo lại; lớp có `totalSessions` luôn giữ đủ số buổi có học (nghỉ → cuối khoá thêm buổi, học bù → cuối khoá rút buổi). Lớp học liên tục được cron `/api/cron/reminders` nối thêm để luôn có 12 tuần. Học viên xem ở `/student/calendar` (+ thẻ "Buổi học tới" ở `/student`); chuông suy ra từ `ClassSession.changeKind/changedAt` và `Class.scheduleChangedAt`.
```

Đổi dòng "Trạng thái" trong spec thành `Trạng thái: đã triển khai (2026-09-24).`

- [ ] **Step 4: Commit + push**

```bash
git add CLAUDE.md docs/superpowers/specs/2026-09-24-lich-hoc-hoc-vien-design.md docs/superpowers/plans/2026-09-24-lich-hoc-hoc-vien.md
git commit -m "docs(lich-hoc): ghi kien truc lich hoc vao CLAUDE.md, danh dau spec da ship"
git push origin feature/ielts-platform-mvp
```

Sau push: Vercel tự deploy; `ensure-db` trong build tạo cột/bảng trên prod. Kiểm deployment READY và runtime log không có lỗi Prisma về `ClassSession` (dùng công cụ Vercel nếu đã xác thực; nếu chưa, nhờ người dùng mở trang lớp trên prod).

- [ ] **Step 5: Ghi memory** — file `lich-hoc-shipped.md` (type project): đã ship 24/9/2026, giáo viên cần tự nhập lịch 3 lớp (PĐ K1 T4+T6 20:15–21:45; PĐ K2 T3 20:15–21:45 + T7 09:00–10:30; CB K1 T5+CN 20:00–21:30); bản sau: điểm danh, iCal, mail nhắc giờ học, buổi học trên Lịch giao bài GV. Thêm dòng vào `MEMORY.md`.
