# Mail nhắc bài sắp hết hạn — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mỗi 12h trưa (giờ VN), gửi cho mỗi học sinh một mail liệt kê các bài có deadline trong 24h tới mà em đó chưa nộp.

**Architecture:** Ba phần rời nhau — `lib/reminders.ts` chứa toàn bộ logic dưới dạng hàm thuần (chọn ai cần nhắc, gộp theo học sinh, soạn nội dung mail; không chạm DB, không gọi mạng → test được bằng vitest); `lib/email.ts` chỉ lo gửi SMTP qua Gmail; `app/api/cron/reminders/route.ts` điều phối (xác thực cron, query Prisma, đánh dấu đã gửi). Chống gửi trùng bằng một cột nullable mới `AssignmentRecipient.reminderSentAt`.

**Tech Stack:** Next.js 14 App Router (Route Handler, Node runtime), Prisma + PostgreSQL (Neon), `nodemailer` (mới), Vercel Cron, vitest.

## Global Constraints

- Mọi chuỗi hiển thị cho người dùng và mọi comment trong code phải là **tiếng Việt** (nếp sẵn có của repo).
- Import giữa các file trong `lib/` dùng alias `@/lib/...`; import trong `tests/` dùng đường dẫn tương đối `../lib/...`.
- **Không** tạo `prisma/migrations`. Cột mới phải là additive + nullable, và phải thêm câu `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` vào `scripts/ensure-db.mjs` (chạy trong `pnpm build` → tự áp lên prod khi deploy). Quên bước này là prod crash khi Prisma select cột chưa tồn tại.
- Cron chạy `0 5 * * *` (05:00 UTC = **12h trưa VN**, UTC+7). Bản Vercel Hobby: tối đa 2 cron, mỗi cron 1 lần/ngày.
- Cửa sổ nhắc là **24 giờ**, biên: `deadline > now` và `deadline <= now + 24h`.
- Trạng thái được coi là "chưa nộp": `assigned`, `in_progress`.
- Nhãn kỹ năng **phải** lấy từ `SKILL_LABELS` / `distinctSkills` trong `lib/skills.ts` — không tự viết lại chữ Nghe/Đọc/Viết/Nói.
- Route cron mặc định **đóng**: chưa đặt `CRON_SECRET` thì trả `401`, không phải cho chạy tự do.
- Package manager là **pnpm**.

---

### Task 1: Logic thuần trong `lib/reminders.ts`

**Files:**
- Create: `lib/reminders.ts`
- Test: `tests/reminders.test.ts`

**Interfaces:**
- Consumes: `SKILL_LABELS`, `distinctSkills` từ `lib/skills.ts` (đã có sẵn).
- Produces (Task 3 dựa vào đúng các tên và kiểu này):
  - `type ReminderCandidate = { recipientId: string; studentEmail: string; studentName: string; assignmentTitle: string; skills: string[]; deadline: Date | null; status: string; reminderSentAt: Date | null }`
  - `type StudentReminder = { email: string; name: string; items: ReminderCandidate[]; recipientIds: string[] }`
  - `findDueReminders(candidates: ReminderCandidate[], now: Date, windowHours?: number): ReminderCandidate[]`
  - `groupRemindersByStudent(due: ReminderCandidate[]): StudentReminder[]`
  - `formatDeadlineLabel(deadline: Date, now: Date): string`
  - `buildReminderEmail(reminder: StudentReminder, appUrl: string, now: Date): { subject: string; html: string; text: string }`

- [ ] **Step 1: Viết test thất bại cho `findDueReminders`**

Tạo `tests/reminders.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  buildReminderEmail,
  findDueReminders,
  formatDeadlineLabel,
  groupRemindersByStudent,
  type ReminderCandidate,
} from "../lib/reminders";

const now = new Date("2026-07-25T05:00:00.000Z"); // 12h trưa VN ngày 25/07
const hours = (n: number) => new Date(now.getTime() + n * 60 * 60 * 1000);

function candidate(overrides: Partial<ReminderCandidate> = {}): ReminderCandidate {
  return {
    recipientId: "r1",
    studentEmail: "minh@example.com",
    studentName: "Minh",
    assignmentTitle: "Cambridge 20 Test 1 — Reading",
    skills: ["reading"],
    deadline: hours(5),
    status: "assigned",
    reminderSentAt: null,
    ...overrides,
  };
}

describe("findDueReminders", () => {
  it("nhắc bài chưa nộp, chưa nhắc, hết hạn trong 24h", () => {
    const due = findDueReminders([candidate()], now);
    expect(due).toHaveLength(1);
    expect(due[0].recipientId).toBe("r1");
  });

  it("bỏ qua bài không có deadline", () => {
    expect(findDueReminders([candidate({ deadline: null })], now)).toHaveLength(0);
  });

  it("bỏ qua bài đã quá hạn", () => {
    expect(findDueReminders([candidate({ deadline: hours(-1) })], now)).toHaveLength(0);
  });

  it("bỏ qua bài còn hạn xa hơn 24h", () => {
    expect(findDueReminders([candidate({ deadline: hours(25) })], now)).toHaveLength(0);
  });

  it("bỏ qua bài đã nộp", () => {
    expect(findDueReminders([candidate({ status: "submitted" })], now)).toHaveLength(0);
    expect(findDueReminders([candidate({ status: "reviewed" })], now)).toHaveLength(0);
  });

  it("vẫn nhắc bài đang làm dở", () => {
    expect(findDueReminders([candidate({ status: "in_progress" })], now)).toHaveLength(1);
  });

  it("bỏ qua bài đã từng nhắc", () => {
    expect(findDueReminders([candidate({ reminderSentAt: hours(-24) })], now)).toHaveLength(0);
  });

  it("biên: deadline đúng now + 24h thì vẫn nhắc", () => {
    expect(findDueReminders([candidate({ deadline: hours(24) })], now)).toHaveLength(1);
  });

  it("biên: deadline đúng bằng now thì không nhắc", () => {
    expect(findDueReminders([candidate({ deadline: now })], now)).toHaveLength(0);
  });
});

describe("groupRemindersByStudent", () => {
  it("gộp nhiều bài của cùng một em thành một mail, sắp theo hạn gần trước", () => {
    const grouped = groupRemindersByStudent([
      candidate({ recipientId: "r2", deadline: hours(20), assignmentTitle: "Listening Test 4" }),
      candidate({ recipientId: "r1", deadline: hours(6), assignmentTitle: "Reading Test 1" }),
    ]);

    expect(grouped).toHaveLength(1);
    expect(grouped[0].email).toBe("minh@example.com");
    expect(grouped[0].items.map((item) => item.assignmentTitle)).toEqual([
      "Reading Test 1",
      "Listening Test 4",
    ]);
    expect(grouped[0].recipientIds).toEqual(["r1", "r2"]);
  });

  it("hai em khác nhau ra hai mail", () => {
    const grouped = groupRemindersByStudent([
      candidate({ recipientId: "r1", studentEmail: "a@example.com", studentName: "An" }),
      candidate({ recipientId: "r2", studentEmail: "b@example.com", studentName: "Bình" }),
    ]);

    expect(grouped).toHaveLength(2);
    expect(grouped.map((item) => item.email).sort()).toEqual(["a@example.com", "b@example.com"]);
  });

  it("danh sách rỗng ra mảng rỗng", () => {
    expect(groupRemindersByStudent([])).toEqual([]);
  });
});

describe("formatDeadlineLabel", () => {
  it("dùng chữ 'hôm nay' cho hạn trong cùng ngày VN", () => {
    // 16:59 UTC = 23:59 giờ VN cùng ngày 25/07
    expect(formatDeadlineLabel(new Date("2026-07-25T16:59:00.000Z"), now)).toBe("23:59 hôm nay");
  });

  it("dùng chữ 'ngày mai' cho hạn ngày VN kế tiếp", () => {
    // 11:00 UTC ngày 26/07 = 18:00 giờ VN ngày 26/07
    expect(formatDeadlineLabel(new Date("2026-07-26T11:00:00.000Z"), now)).toBe("18:00 ngày mai");
  });

  it("dùng ngày/tháng cho hạn xa hơn", () => {
    expect(formatDeadlineLabel(new Date("2026-07-28T11:00:00.000Z"), now)).toBe("18:00 ngày 28/07");
  });
});

describe("buildReminderEmail", () => {
  it("tiêu đề số ít nêu tên bài", () => {
    const [reminder] = groupRemindersByStudent([candidate()]);
    const mail = buildReminderEmail(reminder, "https://lop.example.com", now);

    expect(mail.subject).toBe('Nhắc bài: "Cambridge 20 Test 1 — Reading" sắp hết hạn');
  });

  it("tiêu đề số nhiều đếm số bài", () => {
    const [reminder] = groupRemindersByStudent([
      candidate({ recipientId: "r1" }),
      candidate({ recipientId: "r2", assignmentTitle: "Listening Test 4", skills: ["listening"] }),
    ]);
    const mail = buildReminderEmail(reminder, "https://lop.example.com", now);

    expect(mail.subject).toBe("Nhắc bài: 2 bài IELTS sắp hết hạn");
  });

  it("thân mail có tên em, tên bài, nhãn kỹ năng tiếng Việt và link vào làm bài", () => {
    const [reminder] = groupRemindersByStudent([candidate()]);
    const mail = buildReminderEmail(reminder, "https://lop.example.com", now);

    expect(mail.text).toContain("Chào Minh,");
    expect(mail.text).toContain("Cambridge 20 Test 1 — Reading");
    expect(mail.text).toContain("(Đọc)");
    expect(mail.text).toContain("https://lop.example.com/student");
    expect(mail.html).toContain("https://lop.example.com/student");
  });

  it("bỏ dấu / thừa ở cuối appUrl không làm link lỗi", () => {
    const [reminder] = groupRemindersByStudent([candidate()]);
    const mail = buildReminderEmail(reminder, "https://lop.example.com/", now);

    expect(mail.text).toContain("https://lop.example.com/student");
    expect(mail.text).not.toContain("//student");
  });

  it("escape HTML trong tên bài để không phá cấu trúc mail", () => {
    const [reminder] = groupRemindersByStudent([
      candidate({ assignmentTitle: 'Bài <b>"khó"</b> & dài' }),
    ]);
    const mail = buildReminderEmail(reminder, "https://lop.example.com", now);

    expect(mail.html).toContain("&lt;b&gt;");
    expect(mail.html).not.toContain("<b>");
    expect(mail.html).toContain("&amp;");
    // text thuần giữ nguyên, không escape
    expect(mail.text).toContain('Bài <b>"khó"</b> & dài');
  });
});
```

- [ ] **Step 2: Chạy test để chắc là nó thất bại**

```bash
npx vitest run tests/reminders.test.ts
```

Expected: FAIL — `Failed to resolve import "../lib/reminders"` (file chưa tồn tại).

- [ ] **Step 3: Viết `lib/reminders.ts`**

```ts
import { SKILL_LABELS, distinctSkills } from "@/lib/skills";

// Một bài đang chờ làm của một học sinh — vừa đủ dữ liệu để quyết định có nhắc
// hay không và để soạn mail. Cố tình KHÔNG phụ thuộc kiểu của Prisma để toàn bộ
// logic dưới đây test được mà không cần DB.
export type ReminderCandidate = {
  recipientId: string;
  studentEmail: string;
  studentName: string;
  assignmentTitle: string;
  skills: string[];
  deadline: Date | null;
  status: string;
  reminderSentAt: Date | null;
};

// Một mail gộp cho một học sinh.
export type StudentReminder = {
  email: string;
  name: string;
  items: ReminderCandidate[];
  recipientIds: string[];
};

const DEFAULT_WINDOW_HOURS = 24;
const HOUR_MS = 60 * 60 * 1000;

// Trạng thái được coi là "chưa nộp" — khớp với RecipientStatus trong schema.
const PENDING_STATUSES = new Set(["assigned", "in_progress"]);

// Nơi DUY NHẤT định nghĩa "thế nào là một bài cần nhắc".
export function findDueReminders(
  candidates: ReminderCandidate[],
  now: Date,
  windowHours: number = DEFAULT_WINDOW_HOURS
): ReminderCandidate[] {
  const from = now.getTime();
  const to = from + windowHours * HOUR_MS;

  return candidates.filter((candidate) => {
    if (!candidate.deadline) {
      return false;
    }

    if (candidate.reminderSentAt) {
      return false;
    }

    if (!PENDING_STATUSES.has(candidate.status)) {
      return false;
    }

    const deadline = candidate.deadline.getTime();
    return deadline > from && deadline <= to;
  });
}

// Gộp theo email học sinh: mỗi em đúng một mail, bài nào gần hết hạn xếp trước.
export function groupRemindersByStudent(due: ReminderCandidate[]): StudentReminder[] {
  const byEmail = new Map<string, StudentReminder>();

  for (const item of due) {
    const existing = byEmail.get(item.studentEmail);

    if (existing) {
      existing.items.push(item);
    } else {
      byEmail.set(item.studentEmail, {
        email: item.studentEmail,
        name: item.studentName,
        items: [item],
        recipientIds: [],
      });
    }
  }

  const reminders = [...byEmail.values()];

  for (const reminder of reminders) {
    reminder.items.sort((a, b) => deadlineTime(a) - deadlineTime(b));
    reminder.recipientIds = reminder.items.map((item) => item.recipientId);
  }

  return reminders;
}

// findDueReminders đã lọc bỏ deadline null, nên ở đây luôn có giá trị.
function deadlineTime(candidate: ReminderCandidate): number {
  return candidate.deadline ? candidate.deadline.getTime() : 0;
}

const VN_OFFSET_MS = 7 * HOUR_MS;

// Dịch mốc thời gian sang giờ VN rồi cắt chuỗi ISO. Kết quả CHỈ dùng để hiển thị
// và để so sánh ngày — không phải mốc UTC thật, đừng new Date() lại.
function vnDateKey(date: Date): string {
  return new Date(date.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);
}

function vnClock(date: Date): string {
  return new Date(date.getTime() + VN_OFFSET_MS).toISOString().slice(11, 16);
}

// "23:59 hôm nay" / "18:00 ngày mai" / "18:00 ngày 28/07" — dễ đọc hơn ngày đầy đủ.
export function formatDeadlineLabel(deadline: Date, now: Date): string {
  const clock = vnClock(deadline);
  const day = vnDateKey(deadline);
  const today = vnDateKey(now);
  const tomorrow = vnDateKey(new Date(now.getTime() + 24 * HOUR_MS));

  if (day === today) {
    return `${clock} hôm nay`;
  }

  if (day === tomorrow) {
    return `${clock} ngày mai`;
  }

  const [, month, dayOfMonth] = day.split("-");
  return `${clock} ngày ${dayOfMonth}/${month}`;
}

// Tên bài do giáo viên tự đặt nên có thể chứa <, &, " — phải escape trước khi
// nhúng vào HTML, không thì mail vỡ cấu trúc.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function skillLabel(skills: string[]): string {
  return distinctSkills(skills)
    .map((skill) => SKILL_LABELS[skill])
    .join(", ");
}

export function buildReminderEmail(
  reminder: StudentReminder,
  appUrl: string,
  now: Date
): { subject: string; html: string; text: string } {
  const count = reminder.items.length;
  const link = `${appUrl.replace(/\/+$/, "")}/student`;

  const subject =
    count === 1
      ? `Nhắc bài: "${reminder.items[0].assignmentTitle}" sắp hết hạn`
      : `Nhắc bài: ${count} bài IELTS sắp hết hạn`;

  const intro =
    count === 1
      ? "Em còn 1 bài chưa làm, sắp hết hạn:"
      : `Em còn ${count} bài chưa làm, sắp hết hạn:`;

  const rows = reminder.items.map((item) => {
    const skills = skillLabel(item.skills);
    const deadline = item.deadline ? formatDeadlineLabel(item.deadline, now) : "";
    return {
      title: item.assignmentTitle,
      skills,
      deadline,
    };
  });

  const text = [
    `Chào ${reminder.name},`,
    "",
    intro,
    "",
    ...rows.map(
      (row) =>
        `• ${row.title}${row.skills ? ` (${row.skills})` : ""} — hết hạn ${row.deadline}`
    ),
    "",
    `Vào làm bài: ${link}`,
    "",
    "Mail này được gửi tự động từ lớp IELTS.",
  ].join("\n");

  const itemsHtml = rows
    .map((row) => {
      const skills = row.skills
        ? ` <span style="color:#64748b">(${escapeHtml(row.skills)})</span>`
        : "";
      return `<li style="margin:0 0 10px"><strong>${escapeHtml(row.title)}</strong>${skills}<br><span style="color:#64748b">hết hạn ${escapeHtml(row.deadline)}</span></li>`;
    })
    .join("");

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#0f172a">
  <p>Chào ${escapeHtml(reminder.name)},</p>
  <p>${escapeHtml(intro)}</p>
  <ul style="padding-left:20px;margin:0">${itemsHtml}</ul>
  <p style="margin:24px 0"><a href="${escapeHtml(link)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:8px">Vào làm bài</a></p>
  <p style="color:#64748b;font-size:13px">Mail này được gửi tự động từ lớp IELTS.</p>
</div>`;

  return { subject, html, text };
}
```

- [ ] **Step 4: Chạy test để chắc là nó pass**

```bash
npx vitest run tests/reminders.test.ts
```

Expected: PASS — 20 test (9 `findDueReminders` + 3 `groupRemindersByStudent` + 3 `formatDeadlineLabel` + 5 `buildReminderEmail`).

- [ ] **Step 5: Chạy cả bộ test để chắc không làm vỡ chỗ khác**

```bash
pnpm test
```

Expected: toàn bộ pass (số test cũ + 16). Nếu có test nào đỏ mà không liên quan tới `reminders`, dừng lại và báo — đừng tự sửa test cũ.

- [ ] **Step 6: Commit**

```bash
git add lib/reminders.ts tests/reminders.test.ts
git commit -m "feat: logic chon bai can nhac va soan noi dung mail"
```

---

### Task 2: Gửi mail qua Gmail trong `lib/email.ts`

**Files:**
- Create: `lib/email.ts`
- Test: `tests/email.test.ts`
- Modify: `package.json` (thêm dependency)

**Interfaces:**
- Consumes: không consume gì từ Task 1.
- Produces (Task 3 dùng đúng hai hàm này):
  - `isEmailConfigured(): boolean`
  - `sendEmail(to: string, subject: string, html: string, text: string): Promise<void>`

- [ ] **Step 1: Cài `nodemailer`**

```bash
pnpm add nodemailer && pnpm add -D @types/nodemailer
```

Expected: `package.json` có `nodemailer` trong `dependencies` và `@types/nodemailer` trong `devDependencies`.

- [ ] **Step 2: Viết test thất bại cho `isEmailConfigured`**

Tạo `tests/email.test.ts`. Chỉ test phần quyết định có cấu hình hay chưa — việc gửi SMTP thật không unit-test được và sẽ kiểm bằng tay ở Task 3.

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isEmailConfigured, sendEmail } from "../lib/email";

const saved = {
  user: process.env.GMAIL_USER,
  pass: process.env.GMAIL_APP_PASSWORD,
};

beforeEach(() => {
  delete process.env.GMAIL_USER;
  delete process.env.GMAIL_APP_PASSWORD;
});

afterEach(() => {
  if (saved.user === undefined) {
    delete process.env.GMAIL_USER;
  } else {
    process.env.GMAIL_USER = saved.user;
  }

  if (saved.pass === undefined) {
    delete process.env.GMAIL_APP_PASSWORD;
  } else {
    process.env.GMAIL_APP_PASSWORD = saved.pass;
  }
});

describe("isEmailConfigured", () => {
  it("false khi thiếu cả hai biến", () => {
    expect(isEmailConfigured()).toBe(false);
  });

  it("false khi chỉ có địa chỉ gửi", () => {
    process.env.GMAIL_USER = "co@gmail.com";
    expect(isEmailConfigured()).toBe(false);
  });

  it("false khi chỉ có mật khẩu ứng dụng", () => {
    process.env.GMAIL_APP_PASSWORD = "abcd efgh ijkl mnop";
    expect(isEmailConfigured()).toBe(false);
  });

  it("false khi biến chỉ chứa khoảng trắng", () => {
    process.env.GMAIL_USER = "   ";
    process.env.GMAIL_APP_PASSWORD = "abcd efgh ijkl mnop";
    expect(isEmailConfigured()).toBe(false);
  });

  it("true khi có đủ cả hai", () => {
    process.env.GMAIL_USER = "co@gmail.com";
    process.env.GMAIL_APP_PASSWORD = "abcd efgh ijkl mnop";
    expect(isEmailConfigured()).toBe(true);
  });
});

describe("sendEmail", () => {
  it("báo lỗi rõ ràng khi chưa cấu hình, không cố kết nối SMTP", async () => {
    await expect(
      sendEmail("hs@example.com", "Tiêu đề", "<p>html</p>", "text")
    ).rejects.toThrow("Chưa cấu hình GMAIL_USER / GMAIL_APP_PASSWORD.");
  });
});
```

- [ ] **Step 3: Chạy test để chắc là nó thất bại**

```bash
npx vitest run tests/email.test.ts
```

Expected: FAIL — `Failed to resolve import "../lib/email"`.

- [ ] **Step 4: Viết `lib/email.ts`**

```ts
import nodemailer, { type Transporter } from "nodemailer";

// Gửi mail bằng chính Gmail của giáo viên (App Password) vì web chưa có tên miền
// riêng — Resend và các dịch vụ tương tự đòi tên miền đã xác thực mới cho gửi tới
// địa chỉ bất kỳ. Cách này còn lợi: học sinh thấy mail đến từ đúng địa chỉ của
// cô/thầy, và bấm Trả lời thì thư về hộp thư đó. Hạn mức Gmail 500 mail/ngày.
// Khi nào có tên miền riêng thì chỉ cần thay file này.

function readEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export function isEmailConfigured(): boolean {
  return Boolean(readEnv("GMAIL_USER") && readEnv("GMAIL_APP_PASSWORD"));
}

let transporter: Transporter | null = null;

function getTransporter(user: string, pass: string): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    });
  }

  return transporter;
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text: string
): Promise<void> {
  const user = readEnv("GMAIL_USER");
  const pass = readEnv("GMAIL_APP_PASSWORD");

  if (!user || !pass) {
    throw new Error("Chưa cấu hình GMAIL_USER / GMAIL_APP_PASSWORD.");
  }

  await getTransporter(user, pass).sendMail({ from: user, to, subject, text, html });
}
```

- [ ] **Step 5: Chạy test để chắc là nó pass**

```bash
npx vitest run tests/email.test.ts
```

Expected: PASS — 6 test.

- [ ] **Step 6: Commit**

```bash
git add lib/email.ts tests/email.test.ts package.json pnpm-lock.yaml
git commit -m "feat: gui mail qua Gmail App Password"
```

---

### Task 3: Cột `reminderSentAt`, route cron và lịch chạy

**Files:**
- Modify: `prisma/schema.prisma` (`model AssignmentRecipient`, quanh dòng 169-181)
- Modify: `scripts/ensure-db.mjs` (thêm vào mảng `statements`, cuối mảng)
- Create: `app/api/cron/reminders/route.ts`
- Modify: `vercel.json`

Repo **không có** `.env.example` — không tạo mới. Biến môi trường được ghi ở cuối plan này để giáo viên tự đặt trên Vercel.

**Interfaces:**
- Consumes: `ReminderCandidate`, `findDueReminders`, `groupRemindersByStudent`, `buildReminderEmail` từ `lib/reminders.ts` (Task 1); `isEmailConfigured`, `sendEmail` từ `lib/email.ts` (Task 2); `prisma` từ `lib/prisma.ts` (đã có).
- Produces: endpoint `GET /api/cron/reminders`, trả `{ checked, students, sent, failed }` hoặc `{ skipped: "email_not_configured" }`.

- [ ] **Step 1: Thêm cột vào `prisma/schema.prisma`**

Trong `model AssignmentRecipient`, thêm ngay dưới dòng `submittedAt  DateTime?`:

```prisma
  // Thời điểm đã gửi mail nhắc "sắp hết hạn" cho bài này. Null = chưa nhắc.
  // Chỉ đặt sau khi gửi thành công, nên gửi lỗi thì hôm sau cron thử lại.
  reminderSentAt DateTime?
```

- [ ] **Step 2: Thêm câu ALTER vào `scripts/ensure-db.mjs`**

Thêm vào **cuối** mảng `statements` (ngay trước dấu `];`):

```js
  // Mail nhắc bài sắp hết hạn: đánh dấu đã nhắc để không gửi trùng
  'ALTER TABLE "AssignmentRecipient" ADD COLUMN IF NOT EXISTS "reminderSentAt" TIMESTAMP(3);',
```

- [ ] **Step 3: Sinh lại Prisma Client và áp cột lên DB test**

```bash
npx prisma generate && node scripts/ensure-db.mjs
```

Expected: `prisma generate` báo `Generated Prisma Client`, rồi `[ensure-db] OK: các cột bổ sung đã sẵn sàng.`

Nếu thấy `[ensure-db] Bỏ qua (DB chưa kết nối được lúc build?)` thì `.env` chưa trỏ tới DB được — dừng lại và báo, đừng đi tiếp vì Step 6 cần DB thật.

- [ ] **Step 4: Viết `app/api/cron/reminders/route.ts`**

```ts
import { NextResponse } from "next/server";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import {
  buildReminderEmail,
  findDueReminders,
  groupRemindersByStudent,
  type ReminderCandidate,
} from "@/lib/reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Nhắc trước 24 giờ. Cron chạy 12h trưa VN mỗi ngày (0 5 * * * UTC) nên bài giao
// sau 12h trưa mà hạn trước 12h trưa hôm sau sẽ không kịp nhắc — hạn chế đã biết
// của việc chỉ chạy 1 cron/ngày (hạn mức Vercel Hobby).
const WINDOW_HOURS = 24;
const PENDING_STATUSES = ["assigned", "in_progress"];

function resolveAppUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (configured) {
    return configured;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3000";
}

export async function GET(request: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;

  // Mặc định đóng: chưa đặt CRON_SECRET thì không ai gọi được, kể cả Vercel.
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isEmailConfigured()) {
    console.warn("[cron/reminders] Bỏ qua: chưa cấu hình GMAIL_USER / GMAIL_APP_PASSWORD.");
    return NextResponse.json({ skipped: "email_not_configured" });
  }

  const now = new Date();
  const until = new Date(now.getTime() + WINDOW_HOURS * 60 * 60 * 1000);

  const rows = await prisma.assignmentRecipient.findMany({
    where: {
      reminderSentAt: null,
      status: { in: PENDING_STATUSES },
      assignment: { deadline: { gt: now, lte: until } },
    },
    select: {
      id: true,
      status: true,
      reminderSentAt: true,
      student: { select: { email: true, displayName: true } },
      assignment: {
        select: {
          title: true,
          deadline: true,
          units: { select: { assignableUnit: { select: { skill: true } } } },
        },
      },
    },
  });

  const candidates: ReminderCandidate[] = rows.map((row) => ({
    recipientId: row.id,
    studentEmail: row.student.email,
    studentName: row.student.displayName,
    assignmentTitle: row.assignment.title,
    skills: row.assignment.units.map((unit) => unit.assignableUnit.skill),
    deadline: row.assignment.deadline,
    status: row.status,
    reminderSentAt: row.reminderSentAt,
  }));

  const reminders = groupRemindersByStudent(findDueReminders(candidates, now, WINDOW_HOURS));
  const appUrl = resolveAppUrl();

  // allSettled: một em gửi lỗi thì các em còn lại vẫn nhận được mail.
  const results = await Promise.allSettled(
    reminders.map(async (reminder) => {
      const { subject, html, text } = buildReminderEmail(reminder, appUrl, now);

      await sendEmail(reminder.email, subject, html, text);

      // Chỉ đánh dấu SAU khi gửi xong — gửi lỗi thì trưa mai thử lại.
      await prisma.assignmentRecipient.updateMany({
        where: { id: { in: reminder.recipientIds } },
        data: { reminderSentAt: new Date() },
      });
    })
  );

  let sent = 0;

  for (const result of results) {
    if (result.status === "fulfilled") {
      sent += 1;
    } else {
      console.error("[cron/reminders] Gửi mail thất bại:", result.reason);
    }
  }

  return NextResponse.json({
    checked: candidates.length,
    students: reminders.length,
    sent,
    failed: results.length - sent,
  });
}
```

- [ ] **Step 5: Thêm cron vào `vercel.json`**

Thay toàn bộ nội dung `vercel.json` bằng:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "regions": ["sin1"],
  "crons": [{ "path": "/api/cron/reminders", "schedule": "0 5 * * *" }]
}
```

- [ ] **Step 6: Kiểm bằng tay trên DB test — trường hợp chặn truy cập**

Khởi động dev server qua preview tool (KHÔNG dùng Bash để chạy `next dev`), rồi:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/cron/reminders
```

Expected: `401` (chưa có header, hoặc chưa đặt `CRON_SECRET`).

- [ ] **Step 7: Kiểm bằng tay — trường hợp chưa cấu hình mail**

Đặt tạm `CRON_SECRET=test-secret` trong `.env` (chưa đặt `GMAIL_USER`/`GMAIL_APP_PASSWORD`), khởi động lại dev server, rồi:

```bash
curl -s -H "Authorization: Bearer test-secret" http://localhost:3000/api/cron/reminders
```

Expected: `{"skipped":"email_not_configured"}` và log server có dòng `[cron/reminders] Bỏ qua: chưa cấu hình...`. Đây chính là hành vi "thoát êm" đã chốt trong spec.

- [ ] **Step 8: Chạy typecheck, lint, test và build**

```bash
npx tsc --noEmit && pnpm lint && pnpm test && pnpm build
```

Expected: tất cả pass. Lưu ý: nếu preview dev server đang chạy thì `pnpm build` có thể làm hỏng `.next` — tắt dev server trước khi build.

- [ ] **Step 9: Commit**

```bash
git add prisma/schema.prisma scripts/ensure-db.mjs app/api/cron/reminders/route.ts vercel.json
git commit -m "feat: cron nhac bai sap het han qua email"
```

---

## Việc giáo viên phải tự làm sau khi deploy

Không thuộc phần code, nhưng thiếu là tính năng im lặng không chạy. Sau khi push, nhắc giáo viên đặt 4 biến trên Vercel (Settings → Environment Variables, môi trường Production):

| Biến | Giá trị |
|---|---|
| `GMAIL_USER` | Gmail của giáo viên, ví dụ `co.minh@gmail.com` |
| `GMAIL_APP_PASSWORD` | App Password 16 ký tự — tài khoản Google **phải đã bật xác minh 2 bước** mới tạo được. Giáo viên tự tạo, tự dán, không đưa cho ai |
| `CRON_SECRET` | Chuỗi ngẫu nhiên dài (ví dụ sinh bằng `openssl rand -hex 32`) |
| `NEXT_PUBLIC_APP_URL` | `https://<tên-project>.vercel.app` |

Sau khi deploy xong, kiểm một lần bằng cách gọi thủ công endpoint trên production với header `Authorization: Bearer <CRON_SECRET>` và xem JSON trả về, hoặc mở Vercel → Cron Jobs để chạy tay.

## Ngoài phạm vi plan này

Đã chốt trong spec, cố ý không làm: mail "có bài mới"/"đã quá hạn"/"đã chấm xong"; thông báo trong web; Web Push/PWA; Telegram; trang cho học sinh tự tắt nhận mail; nhắc cho giáo viên.
