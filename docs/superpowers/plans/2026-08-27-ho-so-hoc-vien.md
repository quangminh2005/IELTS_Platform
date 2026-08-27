# Hồ sơ học viên — Kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Học viên có trang hồ sơ riêng (avatar, bio, mục tiêu band, thống kê, lịch chuyên cần), tự sửa được; giáo viên sửa được hồ sơ học viên trong lớp mình; avatar thay chữ cái viết tắt ở mọi nơi hiện tên học viên.

**Architecture:** Bốn cột nullable thêm thẳng vào `StudentProfile`. Toàn bộ logic thuần (chọn nguồn avatar, gộp ngày chuyên cần) nằm trong module không đụng Prisma/React để test bằng vitest. Hai server action tách bạch — action của học viên khoá theo phiên đăng nhập, action của giáo viên lọc theo lớp sở hữu. Ảnh nén sẵn ở trình duyệt rồi mới lên Vercel Blob qua một route riêng.

**Tech Stack:** Next.js 14 App Router, Prisma + PostgreSQL (Neon), zod, Tailwind, Vercel Blob, vitest.

**Đặc tả:** [docs/superpowers/specs/2026-08-27-ho-so-hoc-vien-design.md](../specs/2026-08-27-ho-so-hoc-vien-design.md)

## Global Constraints

Mọi task đều phải tuân thủ, không nhắc lại trong từng task:

- **Tiếng Việt** cho mọi chữ hiện ra màn hình và mọi dòng chú thích trong mã.
- **Mọi server action mở đầu bằng `requireTeacher()` hoặc `requireStudent()`**, và không bao giờ tin id lấy từ `FormData` mà không lọc theo người đang đăng nhập.
- **Trang dưới `app/teacher/` dùng `requireTeacherPage()`** (`lib/teacher-page.ts`), không dùng `requireTeacher()` — `tests/teacher-page-guard.test.ts` bắt lỗi này.
- **Cột mới phải có mặt trong `scripts/ensure-db.mjs`.** Dự án dùng `db push`, không có migrations; script này chạy trong `pnpm build` và là đường duy nhất để cột mới lên production. Bỏ sót = production sập.
- **Truy vấn ở trang giáo viên dùng `select`, không dùng `include`** — tránh kéo theo `content`/`transcript`/`metadataJson` rất nặng.
- **Bio là chữ do học viên nhập** — luôn render bằng text thuần, tuyệt đối không `dangerouslySetInnerHTML`.
- **Học viên chủ yếu dùng điện thoại** — mọi thao tác mới phải chạy được bằng cảm ứng, không chỉ chuột.
- `pnpm test` phải xanh trước mỗi lần commit.

## Bản đồ file

| File | Trách nhiệm |
|---|---|
| `prisma/schema.prisma` | 4 cột mới trên `StudentProfile` |
| `scripts/ensure-db.mjs` | 4 câu `ALTER TABLE` đưa cột lên production |
| `lib/student-avatar.ts` | Nguồn sự thật duy nhất: chọn nguồn avatar, bảng avatar/màu bìa, kiểm link ảnh |
| `lib/attendance.ts` | Gộp ngày chuyên cần theo giờ VN (thuần, không đụng Prisma) |
| `lib/streak.ts` | Chỉ sửa một dòng: `export` hằng `VN_OFFSET_MS` để dùng chung |
| `lib/actions/profile.ts` | `updateMyProfile` (học viên) + `updateStudentProfile` (giáo viên) |
| `app/api/student/avatar/route.ts` | Nhận ảnh đã nén, đẩy lên Blob |
| `components/student-avatar.tsx` | Component hiện avatar dùng chung cho mọi nơi |
| `components/profile-editor.tsx` | Form sửa hồ sơ: bio, chọn avatar/cắt ảnh, màu bìa, mục tiêu band |
| `components/attendance-calendar.tsx` | Heatmap một tháng |
| `app/student/profile/page.tsx` | Hồ sơ của chính mình, sửa được |
| `app/student/profile/[studentId]/page.tsx` | Hồ sơ rút gọn của bạn cùng lớp |
| `app/teacher/students/[studentId]/page.tsx` | Thêm khối "Hồ sơ học viên" cho giáo viên sửa |

---

### Task 1: Cột dữ liệu mới + đường lên production

**Files:**
- Modify: `prisma/schema.prisma` (model `StudentProfile`, dòng 60–85)
- Modify: `scripts/ensure-db.mjs`
- Test: `tests/profile-schema.test.ts`

**Interfaces:**
- Consumes: không có (task đầu tiên)
- Produces: bốn cột `StudentProfile.bio`, `.avatarUrl`, `.avatarPreset`, `.coverColor` — đều `String?`

- [ ] **Step 1: Viết test đỏ**

Test này khoá đúng cái bẫy đã làm sập production trước đây: thêm cột vào schema nhưng quên `ensure-db.mjs`.

`tests/profile-schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(relative: string): string {
  return readFileSync(join(root, ...relative.split("/")), "utf8");
}

const COLUMNS = ["bio", "avatarUrl", "avatarPreset", "coverColor"] as const;

describe("cột hồ sơ học viên", () => {
  const schema = read("prisma/schema.prisma");
  const ensureDb = read("scripts/ensure-db.mjs");

  // Cắt riêng khối model StudentProfile để không ăn nhầm cột trùng tên ở model khác.
  const studentProfileBlock =
    schema.split("model StudentProfile {")[1]?.split("\n}")[0] ?? "";

  it("khối model StudentProfile tồn tại", () => {
    expect(studentProfileBlock.length).toBeGreaterThan(0);
  });

  for (const column of COLUMNS) {
    it(`schema.prisma khai báo ${column} kiểu String?`, () => {
      expect(studentProfileBlock).toMatch(
        new RegExp(`\\n\\s*${column}\\s+String\\?`)
      );
    });

    // Dự án dùng db push, không có migrations. Quên dòng này thì cột không bao giờ
    // xuất hiện trên production và trang hồ sơ sẽ đổ ngay lần deploy đầu.
    it(`ensure-db.mjs có ALTER TABLE cho ${column}`, () => {
      expect(ensureDb).toContain(
        `ALTER TABLE "StudentProfile" ADD COLUMN IF NOT EXISTS "${column}" TEXT;`
      );
    });
  }
});
```

- [ ] **Step 2: Chạy test cho chắc là đỏ**

Run: `npx vitest run tests/profile-schema.test.ts`
Expected: FAIL — 8 test cột đỏ (schema và ensure-db chưa có gì).

- [ ] **Step 3: Thêm cột vào schema**

Trong `prisma/schema.prisma`, model `StudentProfile`, chèn ngay sau dòng `targetBand  Float?`:

```prisma
  // Giới thiệu ngắn học viên tự viết, tối đa 280 ký tự. Văn bản thuần — chỗ hiển
  // thị KHÔNG được dùng dangerouslySetInnerHTML.
  bio          String?
  // Ảnh đại diện học viên tự tải lên (Vercel Blob). Thứ tự ưu tiên khi hiện avatar
  // nằm trong lib/student-avatar.ts: ảnh này -> avatarPreset -> User.image -> chữ cái.
  avatarUrl    String?
  // Mã avatar có sẵn (emoji + màu), giá trị hợp lệ liệt kê trong AVATAR_PRESETS
  // của lib/student-avatar.ts.
  avatarPreset String?
  // Mã màu dải bìa trang hồ sơ, giá trị hợp lệ trong COVER_COLORS của
  // lib/student-avatar.ts. Không nhận mã hex tự do — tránh chữ chìm vào nền.
  coverColor   String?
```

- [ ] **Step 4: Thêm ALTER TABLE vào ensure-db.mjs**

Trong `scripts/ensure-db.mjs`, thêm vào cuối mảng `statements` (cạnh các dòng `StudentProfile` sẵn có ở khoảng dòng 179–187):

```js
  // Hồ sơ học viên: bio, avatar, màu bìa.
  'ALTER TABLE "StudentProfile" ADD COLUMN IF NOT EXISTS "bio" TEXT;',
  'ALTER TABLE "StudentProfile" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;',
  'ALTER TABLE "StudentProfile" ADD COLUMN IF NOT EXISTS "avatarPreset" TEXT;',
  'ALTER TABLE "StudentProfile" ADD COLUMN IF NOT EXISTS "coverColor" TEXT;',
```

- [ ] **Step 5: Sinh lại Prisma Client và đẩy cột xuống DB local**

```bash
pnpm prisma generate
npx prisma db push
```

Expected: `prisma generate` báo "Generated Prisma Client"; `db push` báo "Your database is now in sync with your Prisma schema."

Lưu ý: `.env` đang trỏ tới Neon **"ielts-test"** (DB local dùng để thử) — tên hai DB đặt ngược nhau, `"IELTS_Platform"` mới là production. Kiểm lại `DATABASE_URL` trước khi chạy `db push`.

- [ ] **Step 6: Chạy test cho chắc là xanh**

Run: `npx vitest run tests/profile-schema.test.ts`
Expected: PASS — 9 test xanh.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma scripts/ensure-db.mjs tests/profile-schema.test.ts
git commit -m "feat(ho-so): them cot bio, avatar, mau bia cho StudentProfile"
```

---

### Task 2: `lib/student-avatar.ts` — nguồn sự thật cho avatar

**Files:**
- Create: `lib/student-avatar.ts`
- Test: `tests/student-avatar.test.ts`

**Interfaces:**
- Consumes: Task 1 (bốn cột)
- Produces:
  - `type AvatarSource = { kind: "image"; src: string } | { kind: "preset"; emoji: string; colorClass: string } | { kind: "initials"; text: string; colorClass: string }`
  - `resolveStudentAvatar(input: { avatarUrl: string | null; avatarPreset: string | null; userImage: string | null; displayName: string }): AvatarSource`
  - `isAllowedAvatarUrl(url: string): boolean`
  - `AVATAR_PRESETS: ReadonlyArray<{ key: string; emoji: string; colorClass: string }>`
  - `COVER_COLORS: ReadonlyArray<{ key: string; className: string }>`
  - `AVATAR_PRESET_KEYS: string[]`, `COVER_COLOR_KEYS: string[]`
  - `DEFAULT_COVER_KEY: string`

- [ ] **Step 1: Viết test đỏ**

`tests/student-avatar.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  AVATAR_PRESETS,
  COVER_COLORS,
  isAllowedAvatarUrl,
  resolveStudentAvatar
} from "../lib/student-avatar";

const base = {
  avatarUrl: null,
  avatarPreset: null,
  userImage: null,
  displayName: "Nguyễn Hoàng An"
};

describe("resolveStudentAvatar", () => {
  it("ảnh tự tải thắng tất cả", () => {
    const result = resolveStudentAvatar({
      ...base,
      avatarUrl: "https://abc.public.blob.vercel-storage.com/avatars/x.webp",
      avatarPreset: "cat",
      userImage: "https://lh3.googleusercontent.com/a/anh-google"
    });
    expect(result).toEqual({
      kind: "image",
      src: "https://abc.public.blob.vercel-storage.com/avatars/x.webp"
    });
  });

  it("avatar có sẵn thắng ảnh Google — học viên chọn chủ động thì phải được tôn trọng", () => {
    const result = resolveStudentAvatar({
      ...base,
      avatarPreset: "cat",
      userImage: "https://lh3.googleusercontent.com/a/anh-google"
    });
    expect(result.kind).toBe("preset");
  });

  it("ảnh tự tải nằm ngoài host Blob bị bỏ qua, tụt xuống nguồn kế tiếp", () => {
    // Học viên sửa gói tin gửi lên có thể dán link bất kỳ. Không được để nó hiện
    // trên bảng xếp hạng của cả lớp.
    const result = resolveStudentAvatar({
      ...base,
      avatarUrl: "https://vi-du-doc-hai.com/anh.png",
      userImage: "https://lh3.googleusercontent.com/a/anh-google"
    });
    expect(result).toEqual({
      kind: "image",
      src: "https://lh3.googleusercontent.com/a/anh-google"
    });
  });

  it("mã avatar không có trong bảng thì bỏ qua, không nổ", () => {
    const result = resolveStudentAvatar({ ...base, avatarPreset: "khong-ton-tai" });
    expect(result.kind).toBe("initials");
  });

  it("không có gì thì ra chữ cái viết tắt", () => {
    const result = resolveStudentAvatar(base);
    expect(result).toMatchObject({ kind: "initials", text: "NA" });
  });

  it("tên một chữ lấy hai ký tự đầu", () => {
    const result = resolveStudentAvatar({ ...base, displayName: "An" });
    expect(result).toMatchObject({ kind: "initials", text: "AN" });
  });

  it("tên rỗng ra dấu hỏi thay vì nổ", () => {
    const result = resolveStudentAvatar({ ...base, displayName: "   " });
    expect(result).toMatchObject({ kind: "initials", text: "?" });
  });

  it("cùng một tên luôn ra cùng một màu", () => {
    const a = resolveStudentAvatar({ ...base, displayName: "Trần Bình" });
    const b = resolveStudentAvatar({ ...base, displayName: "Trần Bình" });
    expect(a).toEqual(b);
  });
});

describe("isAllowedAvatarUrl", () => {
  it("nhận host Blob của mình", () => {
    expect(
      isAllowedAvatarUrl("https://abc123.public.blob.vercel-storage.com/avatars/x.webp")
    ).toBe(true);
  });

  it("từ chối host lạ", () => {
    expect(isAllowedAvatarUrl("https://vi-du-doc-hai.com/anh.png")).toBe(false);
  });

  it("từ chối host giả mạo có đuôi giống", () => {
    expect(
      isAllowedAvatarUrl("https://public.blob.vercel-storage.com.doc-hai.com/x.webp")
    ).toBe(false);
  });

  it("từ chối http (không mã hoá)", () => {
    expect(
      isAllowedAvatarUrl("http://abc.public.blob.vercel-storage.com/x.webp")
    ).toBe(false);
  });

  it("từ chối chuỗi không phải link", () => {
    expect(isAllowedAvatarUrl("javascript:alert(1)")).toBe(false);
    expect(isAllowedAvatarUrl("")).toBe(false);
  });
});

describe("bảng hằng số", () => {
  it("mã avatar không trùng nhau", () => {
    const keys = AVATAR_PRESETS.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("mã màu bìa không trùng nhau", () => {
    const keys = COVER_COLORS.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
```

- [ ] **Step 2: Chạy test cho chắc là đỏ**

Run: `npx vitest run tests/student-avatar.test.ts`
Expected: FAIL — "Failed to resolve import ../lib/student-avatar".

- [ ] **Step 3: Viết module**

`lib/student-avatar.ts`:

```ts
// Nguồn sự thật DUY NHẤT cho việc hiện avatar học viên. Mọi nơi (thanh điều hướng,
// bảng xếp hạng, trang giáo viên, báo cáo phụ huynh) đều gọi resolveStudentAvatar
// để không chỗ nào lệch chỗ nào.
//
// Module thuần: không đụng Prisma, không đụng React.

export type AvatarSource =
  | { kind: "image"; src: string }
  | { kind: "preset"; emoji: string; colorClass: string }
  | { kind: "initials"; text: string; colorClass: string };

// Avatar có sẵn cho học viên chọn — emoji + màu nền, không tốn Blob, không phải
// tải gì. Thêm mục mới thì thêm vào cuối, ĐỪNG đổi `key` của mục cũ (mã đang nằm
// trong DB của học viên đã chọn).
export const AVATAR_PRESETS = [
  { key: "cat", emoji: "🐱", colorClass: "bg-rose-500" },
  { key: "dog", emoji: "🐶", colorClass: "bg-amber-500" },
  { key: "fox", emoji: "🦊", colorClass: "bg-orange-500" },
  { key: "panda", emoji: "🐼", colorClass: "bg-slate-500" },
  { key: "owl", emoji: "🦉", colorClass: "bg-yellow-600" },
  { key: "penguin", emoji: "🐧", colorClass: "bg-sky-500" },
  { key: "frog", emoji: "🐸", colorClass: "bg-emerald-500" },
  { key: "bear", emoji: "🐻", colorClass: "bg-amber-700" },
  { key: "rocket", emoji: "🚀", colorClass: "bg-indigo-500" },
  { key: "book", emoji: "📚", colorClass: "bg-teal-500" },
  { key: "star", emoji: "⭐", colorClass: "bg-violet-500" },
  { key: "music", emoji: "🎧", colorClass: "bg-fuchsia-500" }
] as const;

// Dải bìa trang hồ sơ. Chọn từ bảng này chứ không cho nhập mã hex tự do — nhập tự
// do rất dễ ra nền làm chữ chìm mất.
export const COVER_COLORS = [
  { key: "rose", className: "bg-gradient-to-r from-rose-300 to-rose-400" },
  { key: "amber", className: "bg-gradient-to-r from-amber-300 to-orange-400" },
  { key: "emerald", className: "bg-gradient-to-r from-emerald-300 to-teal-400" },
  { key: "sky", className: "bg-gradient-to-r from-sky-300 to-cyan-400" },
  { key: "indigo", className: "bg-gradient-to-r from-indigo-300 to-violet-400" },
  { key: "fuchsia", className: "bg-gradient-to-r from-fuchsia-300 to-pink-400" },
  { key: "slate", className: "bg-gradient-to-r from-slate-300 to-slate-400" },
  { key: "lime", className: "bg-gradient-to-r from-lime-300 to-emerald-400" }
] as const;

export const AVATAR_PRESET_KEYS: string[] = AVATAR_PRESETS.map((p) => p.key);
export const COVER_COLOR_KEYS: string[] = COVER_COLORS.map((c) => c.key);
export const DEFAULT_COVER_KEY = "sky";

export function coverClassName(key: string | null): string {
  return (
    COVER_COLORS.find((c) => c.key === key)?.className ??
    COVER_COLORS.find((c) => c.key === DEFAULT_COVER_KEY)!.className
  );
}

// Chữ cái viết tắt (tối đa 2 ký tự, lấy đầu các từ). Chuyển từ
// components/class-ranking-board.tsx sang đây — GIỮ NGUYÊN thuật toán để avatar
// của học viên cũ không đổi hình dạng sau khi gom về một chỗ.
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return "?";
  }

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

// Màu nền suy từ tên để mỗi học viên có một màu ổn định. Cũng chuyển nguyên từ
// class-ranking-board.tsx — đổi bảng màu hay hàm băm là màu của cả lớp đổi theo.
const INITIALS_COLORS = [
  "bg-rose-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-teal-500",
  "bg-sky-500",
  "bg-indigo-500",
  "bg-violet-500",
  "bg-fuchsia-500"
];

function initialsColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }

  return INITIALS_COLORS[hash % INITIALS_COLORS.length];
}

// Chỉ chấp nhận ảnh nằm trên Blob store của chính mình. Không có chốt này thì học
// viên sửa gói tin gửi lên là dán được ảnh bất kỳ ngoài internet vào hồ sơ, và nó
// sẽ hiện trên bảng xếp hạng của cả lớp.
export function isAllowedAvatarUrl(url: string): boolean {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:") {
    return false;
  }

  // So khớp bằng ĐUÔI có dấu chấm dẫn đầu, không phải endsWith trần — nếu không
  // thì "public.blob.vercel-storage.com.doc-hai.com" cũng lọt.
  return parsed.hostname.endsWith(".public.blob.vercel-storage.com");
}

// Thứ tự ưu tiên: ảnh tự tải -> avatar có sẵn -> ảnh Google -> chữ cái viết tắt.
export function resolveStudentAvatar(input: {
  avatarUrl: string | null;
  avatarPreset: string | null;
  userImage: string | null;
  displayName: string;
}): AvatarSource {
  if (input.avatarUrl && isAllowedAvatarUrl(input.avatarUrl)) {
    return { kind: "image", src: input.avatarUrl };
  }

  const preset = AVATAR_PRESETS.find((p) => p.key === input.avatarPreset);
  if (preset) {
    return { kind: "preset", emoji: preset.emoji, colorClass: preset.colorClass };
  }

  if (input.userImage) {
    return { kind: "image", src: input.userImage };
  }

  return {
    kind: "initials",
    text: initials(input.displayName),
    colorClass: initialsColor(input.displayName)
  };
}
```

- [ ] **Step 4: Chạy test cho chắc là xanh**

Run: `npx vitest run tests/student-avatar.test.ts`
Expected: PASS — 15 test xanh.

- [ ] **Step 5: Commit**

```bash
git add lib/student-avatar.ts tests/student-avatar.test.ts
git commit -m "feat(ho-so): module chon nguon avatar hoc vien"
```

---

### Task 3: `lib/attendance.ts` — lịch chuyên cần theo giờ VN

**Files:**
- Create: `lib/attendance.ts`
- Modify: `lib/streak.ts:1` (thêm `export` cho `VN_OFFSET_MS`)
- Test: `tests/attendance.test.ts`

**Interfaces:**
- Consumes: `VN_OFFSET_MS` từ `lib/streak.ts`
- Produces:
  - `type AttendanceMonth = { year: number; month: number; leadingBlanks: number; days: Array<{ day: number; active: boolean }> }`
  - `buildAttendanceMonth(input: { submittedAt: Date[]; vocabDays: Date[]; month: Date }): AttendanceMonth`
  - `vnDateKey(date: Date): string`

**Ghi chú lệch so với đặc tả:** đặc tả ghi kiểu trả về là `Array<{ day, active }>`. Kế hoạch mở rộng thành object có thêm `year`, `month`, `leadingBlanks`. Lý do: tính "ngày 1 rơi vào thứ mấy" cũng phụ thuộc múi giờ y hệt phần gộp ngày; để nó trong module thuần thì test được, để ở component thì không.

- [ ] **Step 1: Viết test đỏ**

`tests/attendance.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildAttendanceMonth, vnDateKey } from "../lib/attendance";

describe("vnDateKey", () => {
  it("bài nộp 23h30 giờ VN vẫn thuộc ngày hôm đó", () => {
    // Đây là lỗi dễ mắc nhất: 23h30 ngày 15/08 giờ VN = 16h30 ngày 15/08 UTC,
    // nhưng 23h30 ngày 15/08 UTC lại là 06h30 ngày 16/08 giờ VN. Tính nhầm theo
    // UTC là lệch cả một ô trên lịch.
    expect(vnDateKey(new Date("2026-08-15T23:30:00+07:00"))).toBe("2026-08-15");
  });

  it("bài nộp 00h30 giờ VN thuộc ngày mới, không phải ngày hôm trước", () => {
    expect(vnDateKey(new Date("2026-08-16T00:30:00+07:00"))).toBe("2026-08-16");
  });

  it("kiểu @db.Date (nửa đêm UTC) giữ nguyên ngày", () => {
    // VocabQuizDay.date là @db.Date, Prisma trả về Date ở nửa đêm UTC.
    expect(vnDateKey(new Date("2026-08-15T00:00:00Z"))).toBe("2026-08-15");
  });
});

describe("buildAttendanceMonth", () => {
  const month = new Date("2026-08-10T10:00:00+07:00"); // tháng 8/2026

  it("trả đúng số ngày của tháng", () => {
    const result = buildAttendanceMonth({ submittedAt: [], vocabDays: [], month });
    expect(result.year).toBe(2026);
    expect(result.month).toBe(8);
    expect(result.days).toHaveLength(31);
    expect(result.days[0]).toEqual({ day: 1, active: false });
  });

  it("tháng 2 năm không nhuận ra 28 ngày", () => {
    const result = buildAttendanceMonth({
      submittedAt: [],
      vocabDays: [],
      month: new Date("2026-02-10T10:00:00+07:00")
    });
    expect(result.days).toHaveLength(28);
  });

  it("tháng 2 năm nhuận ra 29 ngày", () => {
    const result = buildAttendanceMonth({
      submittedAt: [],
      vocabDays: [],
      month: new Date("2028-02-10T10:00:00+07:00")
    });
    expect(result.days).toHaveLength(29);
  });

  it("ngày có nộp bài thì sáng", () => {
    const result = buildAttendanceMonth({
      submittedAt: [new Date("2026-08-15T09:00:00+07:00")],
      vocabDays: [],
      month
    });
    expect(result.days[14]).toEqual({ day: 15, active: true });
    expect(result.days[13].active).toBe(false);
  });

  it("ngày chỉ học từ vựng cũng sáng", () => {
    const result = buildAttendanceMonth({
      submittedAt: [],
      vocabDays: [new Date("2026-08-20T00:00:00Z")],
      month
    });
    expect(result.days[19]).toEqual({ day: 20, active: true });
  });

  it("cùng ngày vừa nộp bài vừa học từ chỉ tính một ô sáng, không nổ", () => {
    const result = buildAttendanceMonth({
      submittedAt: [
        new Date("2026-08-05T09:00:00+07:00"),
        new Date("2026-08-05T21:00:00+07:00")
      ],
      vocabDays: [new Date("2026-08-05T00:00:00Z")],
      month
    });
    expect(result.days.filter((d) => d.active)).toEqual([{ day: 5, active: true }]);
  });

  it("hoạt động ở tháng khác không lọt vào tháng đang xem", () => {
    const result = buildAttendanceMonth({
      submittedAt: [new Date("2026-07-15T09:00:00+07:00")],
      vocabDays: [new Date("2026-09-15T00:00:00Z")],
      month
    });
    expect(result.days.some((d) => d.active)).toBe(false);
  });

  it("leadingBlanks tính theo tuần bắt đầu Thứ 2", () => {
    // 01/08/2026 là Thứ Bảy -> đứng ở cột thứ 6 -> 5 ô trống trước nó.
    const result = buildAttendanceMonth({ submittedAt: [], vocabDays: [], month });
    expect(result.leadingBlanks).toBe(5);
  });

  it("tháng bắt đầu đúng Thứ 2 thì không có ô trống", () => {
    // 01/06/2026 là Thứ Hai.
    const result = buildAttendanceMonth({
      submittedAt: [],
      vocabDays: [],
      month: new Date("2026-06-10T10:00:00+07:00")
    });
    expect(result.leadingBlanks).toBe(0);
  });
});
```

- [ ] **Step 2: Chạy test cho chắc là đỏ**

Run: `npx vitest run tests/attendance.test.ts`
Expected: FAIL — "Failed to resolve import ../lib/attendance".

- [ ] **Step 3: Xuất hằng múi giờ ra khỏi streak.ts**

Trong `lib/streak.ts`, sửa đúng dòng 1:

```ts
export const VN_OFFSET_MS = 7 * 60 * 60 * 1000; // VN = UTC+7 (không DST)
```

Chỉ thêm chữ `export`, không đổi gì khác. Chép lại hằng số này sang file mới là mầm mống hai chỗ lệch nhau về sau.

- [ ] **Step 4: Viết module**

`lib/attendance.ts`:

```ts
import { VN_OFFSET_MS } from "@/lib/streak";

// Lịch chuyên cần: mỗi ô là một ngày, sáng khi học viên có NỘP BÀI hoặc CÓ LÀM
// QUIZ TỪ VỰNG trong ngày đó.
//
// Chỉ hai mức sáng/tắt, không chia độ đậm nhạt: một học viên hiếm khi nộp quá 2
// bài một ngày, ba mức màu chỉ là nhiễu.
//
// Module thuần: không đụng Prisma, không đụng React.

export type AttendanceMonth = {
  year: number;
  month: number; // 1–12
  // Số ô trống trước ngày 1 khi xếp lưới tuần bắt đầu Thứ 2.
  leadingBlanks: number;
  days: Array<{ day: number; active: boolean }>;
};

// Khoá ngày "YYYY-MM-DD" theo giờ Việt Nam. Cộng offset rồi đọc theo UTC để có
// giờ địa phương VN — cùng cách lib/streak.ts đang làm với tuần.
export function vnDateKey(date: Date): string {
  const shifted = new Date(date.getTime() + VN_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function buildAttendanceMonth(input: {
  submittedAt: Date[];
  vocabDays: Date[];
  month: Date;
}): AttendanceMonth {
  const shifted = new Date(input.month.getTime() + VN_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth() + 1; // 1–12

  // Ngày 0 của tháng sau = ngày cuối của tháng này.
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  // getUTCDay: 0=CN, 1=T2... Lưới bắt đầu Thứ 2 nên CN phải là cột thứ 7.
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const leadingBlanks = (firstWeekday + 6) % 7;

  const activeKeys = new Set<string>();
  for (const date of input.submittedAt) {
    activeKeys.add(vnDateKey(date));
  }
  for (const date of input.vocabDays) {
    activeKeys.add(vnDateKey(date));
  }

  const days = Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return { day, active: activeKeys.has(key) };
  });

  return { year, month, leadingBlanks, days };
}
```

- [ ] **Step 5: Chạy test cho chắc là xanh**

Run: `npx vitest run tests/attendance.test.ts tests/streak.test.ts`
Expected: PASS — cả test mới lẫn test streak cũ đều xanh (chứng minh việc thêm `export` không phá gì).

- [ ] **Step 6: Commit**

```bash
git add lib/attendance.ts lib/streak.ts tests/attendance.test.ts
git commit -m "feat(ho-so): gop ngay chuyen can theo gio VN"
```

---

### Task 4: Server action sửa hồ sơ

**Files:**
- Create: `lib/actions/profile.ts`
- Test: `tests/profile-actions.test.ts`

**Interfaces:**
- Consumes: `AVATAR_PRESET_KEYS`, `COVER_COLOR_KEYS`, `isAllowedAvatarUrl` (Task 2); cột từ Task 1
- Produces:
  - `updateMyProfile(formData: FormData): Promise<ActionResult>`
  - `updateStudentProfile(formData: FormData): Promise<ActionResult>`

- [ ] **Step 1: Viết test đỏ**

Đây là test cấu trúc trên mã nguồn, cùng kiểu với `tests/practice-action-guard.test.ts` — khoá các chốt chặn quyền, thứ mà test hành vi khó với tới vì cần cả DB lẫn phiên đăng nhập.

`tests/profile-actions.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const source = readFileSync(join(root, "lib", "actions", "profile.ts"), "utf8");

// Cắt riêng thân từng action để khẳng định về đúng action đó, không ăn nhầm sang
// action bên cạnh trong cùng file.
function bodyOf(name: string): string {
  const start = source.indexOf(`export async function ${name}(`);
  expect(start).toBeGreaterThanOrEqual(0);
  const rest = source.slice(start + 1);
  const next = rest.indexOf("\nexport async function ");
  return next === -1 ? rest : rest.slice(0, next);
}

describe("chốt chặn quyền của action sửa hồ sơ", () => {
  const mine = bodyOf("updateMyProfile");
  const byTeacher = bodyOf("updateStudentProfile");

  it("updateMyProfile gọi requireStudent", () => {
    expect(mine).toContain("requireStudent()");
  });

  it("updateMyProfile KHÔNG đọc studentId từ FormData", () => {
    // Chốt quan trọng nhất của task: học viên sửa gói tin gửi lên không được
    // chạm tới hồ sơ người khác. Id phải đến từ phiên đăng nhập.
    expect(mine).not.toMatch(/formData\.get\(\s*["']studentId["']\s*\)/);
  });

  it("updateMyProfile KHÔNG chạm displayName hay email", () => {
    // Tên hiện ở bảng xếp hạng và hàng chờ chấm bài — chỉ giáo viên đổi được.
    expect(mine).not.toMatch(/displayName:/);
    expect(mine).not.toMatch(/email:/);
  });

  it("updateStudentProfile gọi requireTeacher", () => {
    expect(byTeacher).toContain("requireTeacher()");
  });

  it("updateStudentProfile lọc theo lớp của giáo viên ngay trong where", () => {
    // Không được lấy học viên rồi mới đối chiếu quyền sau — phải nằm trong where.
    expect(byTeacher).toMatch(/classes:\s*\{\s*some:\s*\{\s*class:\s*\{\s*teacherId/);
  });

  it("updateStudentProfile chặn đổi email khi học viên đã liên kết Google", () => {
    // Email là khoá nối tài khoản Google trong lib/auth.ts. Đổi email của học viên
    // đã đăng nhập = họ mất quyền vào toàn bộ bài cũ.
    expect(byTeacher).toContain("userId");
    expect(byTeacher).toMatch(/Google/);
  });

  it("cả hai action kiểm link ảnh bằng isAllowedAvatarUrl", () => {
    expect(source).toContain("isAllowedAvatarUrl");
  });

  it("đổi avatar thì xoá ảnh cũ trên Blob", () => {
    // Blob store từng bị khoá vì vượt băng thông — không để ảnh mồ côi tích lại.
    expect(source).toMatch(/import \{[^}]*\bdel\b[^}]*\} from "@vercel\/blob"/);
  });
});
```

- [ ] **Step 2: Chạy test cho chắc là đỏ**

Run: `npx vitest run tests/profile-actions.test.ts`
Expected: FAIL — `ENOENT ... lib/actions/profile.ts`.

- [ ] **Step 3: Viết action**

`lib/actions/profile.ts`:

```ts
"use server";

import { del } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { requireStudent } from "@/lib/actions/attempts";
import { requireTeacher } from "@/lib/actions/classes";
import { prisma } from "@/lib/prisma";
import {
  AVATAR_PRESET_KEYS,
  COVER_COLOR_KEYS,
  isAllowedAvatarUrl
} from "@/lib/student-avatar";

// Chuỗi rỗng trên form nghĩa là "bỏ trống", không phải chuỗi "".
function optional(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

const bioSchema = z
  .string()
  .max(280, "Giới thiệu tối đa 280 ký tự.")
  .nullable();

const avatarUrlSchema = z
  .string()
  .refine(isAllowedAvatarUrl, "Ảnh đại diện phải là ảnh tải lên từ trang này.")
  .nullable();

const avatarPresetSchema = z
  .string()
  .refine((v) => AVATAR_PRESET_KEYS.includes(v), "Avatar không hợp lệ.")
  .nullable();

const coverColorSchema = z
  .string()
  .refine((v) => COVER_COLOR_KEYS.includes(v), "Màu bìa không hợp lệ.")
  .nullable();

// Mục tiêu band: 0–9, bước 0.5. Bỏ trống -> null.
const targetBandSchema = z
  .number()
  .min(0, "Mục tiêu band phải từ 0 đến 9.")
  .max(9, "Mục tiêu band phải từ 0 đến 9.")
  .refine((v) => Number.isInteger(v * 2), "Mục tiêu band phải là bội của 0.5.")
  .nullable();

function parseTargetBand(value: FormDataEntryValue | null): number | null {
  const text = optional(value);
  if (text === null) {
    return null;
  }
  const parsed = Number(text);
  if (Number.isNaN(parsed)) {
    throw new Error("Mục tiêu band phải là một con số.");
  }
  return parsed;
}

const decorationSchema = z.object({
  bio: bioSchema,
  avatarUrl: avatarUrlSchema,
  avatarPreset: avatarPresetSchema,
  coverColor: coverColorSchema,
  targetBand: targetBandSchema
});

function readDecoration(formData: FormData) {
  const parsed = decorationSchema.safeParse({
    bio: optional(formData.get("bio")),
    avatarUrl: optional(formData.get("avatarUrl")),
    avatarPreset: optional(formData.get("avatarPreset")),
    coverColor: optional(formData.get("coverColor")),
    targetBand: parseTargetBand(formData.get("targetBand"))
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Thông tin hồ sơ chưa hợp lệ.");
  }

  return parsed.data;
}

// Xoá ảnh cũ trên Blob khi học viên đổi sang ảnh khác. Bọc try/catch: xoá hỏng thì
// chỉ còn một file rác (scripts/blob-orphans.mjs dọn được), không đáng để chặn việc
// lưu hồ sơ.
async function deleteOldAvatar(oldUrl: string | null, newUrl: string | null) {
  if (!oldUrl || oldUrl === newUrl || !isAllowedAvatarUrl(oldUrl)) {
    return;
  }

  try {
    await del(oldUrl);
  } catch {
    // Bỏ qua có chủ ý — xem chú thích trên.
  }
}

// Học viên tự sửa hồ sơ của CHÍNH MÌNH. requireStudent() tra hồ sơ theo phiên đăng
// nhập và trả về bản ghi; id lấy từ đó, TUYỆT ĐỐI không lấy từ FormData.
export async function updateMyProfile(formData: FormData): Promise<ActionResult> {
  const student = await requireStudent(); // NGOÀI try: lỗi phân quyền ném ra như cũ

  try {
    const data = readDecoration(formData);

    await deleteOldAvatar(student.avatarUrl, data.avatarUrl);

    await prisma.studentProfile.update({
      where: { id: student.id },
      data
    });

    revalidatePath("/student/profile");
    revalidatePath("/student");
    revalidatePath("/student/ranking");
    return actionOk("Đã lưu hồ sơ.");
  } catch (error) {
    return actionFail(error, "Lưu hồ sơ");
  }
}

const teacherFieldsSchema = z.object({
  studentId: z.string().min(1, "Thiếu mã học viên."),
  displayName: z.string().min(1, "Tên học viên không được để trống."),
  email: z.string().email("Email không hợp lệ.")
});

// Giáo viên sửa hồ sơ học viên trong lớp mình — sửa được cả tên và email.
export async function updateStudentProfile(formData: FormData): Promise<ActionResult> {
  const teacher = await requireTeacher();

  try {
    const fields = teacherFieldsSchema.safeParse({
      studentId: formData.get("studentId"),
      displayName: String(formData.get("displayName") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim().toLowerCase()
    });

    if (!fields.success) {
      throw new Error(fields.error.issues[0]?.message ?? "Thông tin chưa hợp lệ.");
    }

    const decoration = readDecoration(formData);

    // Chốt chặn quyền: lọc NGAY TRONG where, không lấy ra rồi mới đối chiếu.
    const student = await prisma.studentProfile.findFirst({
      where: {
        id: fields.data.studentId,
        classes: { some: { class: { teacherId: teacher.id } } }
      },
      select: { id: true, email: true, userId: true, avatarUrl: true }
    });

    if (!student) {
      throw new Error("Không tìm thấy học viên này trong lớp của bạn.");
    }

    // Email là khoá nối tài khoản Google (lib/auth.ts). Học viên đã đăng nhập rồi
    // mà đổi email thì họ mất quyền vào toàn bộ bài cũ — chặn hẳn, báo rõ lý do.
    if (fields.data.email !== student.email && student.userId !== null) {
      throw new Error(
        "Học viên này đã đăng nhập bằng Google nên không đổi được email — đổi sẽ làm mất toàn bộ bài đã làm. Hãy xoá học viên rồi thêm lại bằng email mới nếu thật sự cần."
      );
    }

    const duplicate = await prisma.studentProfile.findFirst({
      where: { email: fields.data.email, id: { not: student.id } },
      select: { id: true }
    });

    if (duplicate) {
      throw new Error("Email này đã thuộc về một học viên khác.");
    }

    await deleteOldAvatar(student.avatarUrl, decoration.avatarUrl);

    await prisma.studentProfile.update({
      where: { id: student.id },
      data: {
        displayName: fields.data.displayName,
        email: fields.data.email,
        ...decoration
      }
    });

    revalidatePath(`/teacher/students/${student.id}`);
    revalidatePath("/teacher/classes");
    revalidatePath("/teacher");
    return actionOk(`Đã lưu hồ sơ của "${fields.data.displayName}".`);
  } catch (error) {
    return actionFail(error, "Lưu hồ sơ học viên");
  }
}
```

- [ ] **Step 4: Chạy test cho chắc là xanh**

Run: `npx vitest run tests/profile-actions.test.ts`
Expected: PASS — 8 test xanh.

- [ ] **Step 5: Kiểm kiểu TypeScript**

Run: `npx tsc --noEmit`
Expected: không có lỗi nào liên quan tới `lib/actions/profile.ts`. (Nếu `student.avatarUrl` báo không tồn tại thì Prisma Client chưa sinh lại — chạy `pnpm prisma generate`.)

- [ ] **Step 6: Commit**

```bash
git add lib/actions/profile.ts tests/profile-actions.test.ts
git commit -m "feat(ho-so): server action sua ho so cho hoc vien va giao vien"
```

---

### Task 5: Route tải ảnh đại diện

**Files:**
- Create: `app/api/student/avatar/route.ts`
- Test: `tests/avatar-upload-guard.test.ts`

**Interfaces:**
- Consumes: `auth()` từ `lib/auth`
- Produces: `POST /api/student/avatar` nhận `FormData` khoá `file`, trả `{ url: string }` hoặc `{ error: string }`

- [ ] **Step 1: Viết test đỏ**

`tests/avatar-upload-guard.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const source = readFileSync(
  join(root, "app", "api", "student", "avatar", "route.ts"),
  "utf8"
);

describe("chốt chặn của route tải ảnh đại diện", () => {
  it("kiểm phiên đăng nhập trước khi làm gì khác", () => {
    expect(source).toContain("await auth()");
  });

  it("chỉ cho giáo viên hoặc học viên, chặn khách vãng lai", () => {
    expect(source).toMatch(/role !== "teacher" && .*role !== "student"/);
  });

  it("chặn file quá lớn — ảnh đã nén ở trình duyệt thì không thể vượt 512KB", () => {
    expect(source).toContain("512");
  });

  it("chỉ nhận định dạng ảnh, không nhận SVG", () => {
    // SVG chứa được script; ảnh đại diện thì không cần tới nó.
    expect(source).toContain("image/webp");
    expect(source).not.toContain("image/svg+xml");
  });

  it("đặt ảnh vào thư mục avatars/ để dễ dọn về sau", () => {
    expect(source).toContain("avatars/");
  });

  it("chạy trên runtime nodejs", () => {
    expect(source).toContain('export const runtime = "nodejs"');
  });
});
```

- [ ] **Step 2: Chạy test cho chắc là đỏ**

Run: `npx vitest run tests/avatar-upload-guard.test.ts`
Expected: FAIL — `ENOENT ... app/api/student/avatar/route.ts`.

- [ ] **Step 3: Viết route**

`app/api/student/avatar/route.ts`:

```ts
import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";

// Nhận ảnh đại diện đã được TRÌNH DUYỆT cắt vuông + thu về 256px webp
// (components/profile-editor.tsx). Ảnh tới đây chỉ khoảng 20KB.
//
// Không dùng lại /api/image/direct-upload: route đó dành cho ảnh đề bài và khoá
// cứng vai trò giáo viên. Mở nó cho học viên là nới một cửa rộng hơn mức cần thiết.
const MAX_BYTES = 512 * 1024;

// Cố tình KHÔNG có image/svg+xml: SVG chứa được script, ảnh đại diện không cần tới.
const allowedTypes = new Set(["image/webp", "image/png", "image/jpeg"]);

export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth();
  const role = session?.user?.role;

  if (!session?.user?.id || (role !== "teacher" && role !== "student")) {
    return NextResponse.json({ error: "Cần đăng nhập." }, { status: 403 });
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

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Ảnh quá lớn. Hãy chọn ảnh khác." },
      { status: 413 }
    );
  }

  if (!allowedTypes.has(file.type)) {
    return NextResponse.json(
      { error: "Định dạng ảnh không hỗ trợ (chỉ PNG, JPG, WEBP)." },
      { status: 400 }
    );
  }

  try {
    const blob = await put(`avatars/${session.user.id}.webp`, file, {
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

- [ ] **Step 4: Chạy test cho chắc là xanh**

Run: `npx vitest run tests/avatar-upload-guard.test.ts`
Expected: PASS — 6 test xanh.

- [ ] **Step 5: Commit**

```bash
git add app/api/student/avatar/route.ts tests/avatar-upload-guard.test.ts
git commit -m "feat(ho-so): route tai anh dai dien len Blob"
```

---

### Task 6: `<StudentAvatar>` + gỡ logic trùng khỏi bảng xếp hạng

**Files:**
- Create: `components/student-avatar.tsx`
- Modify: `components/class-ranking-board.tsx` (bỏ `initials`, `AVATAR_COLORS`, `avatarColor`; ba chỗ render avatar ở dòng ~174, ~254, ~332)
- Modify: `lib/class-ranking.ts:284` và kiểu `RankedClassStudent`/`ClassmateRow`

**Interfaces:**
- Consumes: `resolveStudentAvatar`, `AvatarSource` (Task 2)
- Produces: `<StudentAvatar avatarUrl avatarPreset userImage displayName size />` với `size: "sm" | "md" | "lg" | "xl"`

- [ ] **Step 1: Viết test đỏ**

`tests/student-avatar-usage.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(relative: string): string {
  return readFileSync(join(root, ...relative.split("/")), "utf8");
}

describe("bảng xếp hạng dùng chung component avatar", () => {
  const board = read("components/class-ranking-board.tsx");

  it("không còn tự định nghĩa chữ cái viết tắt", () => {
    // Hai bản sao của cùng một thuật toán là hai chỗ để lệch nhau.
    expect(board).not.toContain("function initials(");
    expect(board).not.toContain("function avatarColor(");
  });

  it("dùng component StudentAvatar", () => {
    expect(board).toContain("StudentAvatar");
  });
});

describe("class-ranking mang đủ dữ liệu avatar", () => {
  const ranking = read("lib/class-ranking.ts");

  it("truy vấn lấy cả avatarUrl và avatarPreset của hồ sơ", () => {
    expect(ranking).toContain("avatarPreset");
  });
});
```

- [ ] **Step 2: Chạy test cho chắc là đỏ**

Run: `npx vitest run tests/student-avatar-usage.test.ts`
Expected: FAIL — 3 test đỏ.

- [ ] **Step 3: Viết component**

`components/student-avatar.tsx`:

```tsx
import { resolveStudentAvatar } from "@/lib/student-avatar";

// Component hiện avatar dùng chung cho MỌI nơi: thanh điều hướng, bảng xếp hạng,
// trang giáo viên, báo cáo phụ huynh. Đừng vẽ avatar bằng tay ở chỗ khác.

const SIZES = {
  sm: { box: "h-8 w-8", text: "text-xs", emoji: "text-base" },
  md: { box: "h-12 w-12", text: "text-sm", emoji: "text-xl" },
  lg: { box: "h-16 w-16", text: "text-lg", emoji: "text-2xl" },
  xl: { box: "h-24 w-24", text: "text-2xl", emoji: "text-4xl" }
} as const;

export function StudentAvatar({
  avatarUrl,
  avatarPreset,
  userImage,
  displayName,
  size = "md",
  className = ""
}: {
  avatarUrl: string | null;
  avatarPreset: string | null;
  userImage: string | null;
  displayName: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const source = resolveStudentAvatar({
    avatarUrl,
    avatarPreset,
    userImage,
    displayName
  });
  const dimension = SIZES[size];
  const shared = `${dimension.box} shrink-0 rounded-full object-cover ${className}`;

  if (source.kind === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- ảnh từ Blob/Google,
      // không qua trình tối ưu ảnh của Next để khỏi tốn hạn mức biến đổi ảnh.
      <img
        src={source.src}
        alt={`Ảnh đại diện của ${displayName}`}
        className={shared}
        loading="lazy"
      />
    );
  }

  const content = source.kind === "preset" ? source.emoji : source.text;
  const contentClass = source.kind === "preset" ? dimension.emoji : dimension.text;

  return (
    <span
      aria-label={`Ảnh đại diện của ${displayName}`}
      role="img"
      className={`${dimension.box} shrink-0 rounded-full ${source.colorClass} ${className} inline-flex items-center justify-center font-bold text-white`}
    >
      <span className={contentClass}>{content}</span>
    </span>
  );
}
```

- [ ] **Step 4: Mang dữ liệu avatar vào class-ranking**

Trong `lib/class-ranking.ts`:

Đổi hai kiểu (`RankedClassStudent` khoảng dòng 11–33, `ClassmateRow` khoảng dòng 34–46) — thay trường `avatarUrl: string | null` bằng ba trường:

```ts
  avatarUrl: string | null;
  avatarPreset: string | null;
  userImage: string | null;
```

Trong truy vấn, phần `select` của học viên (khoảng dòng 240–245), thêm `avatarUrl: true, avatarPreset: true` cạnh các cột đang lấy, giữ nguyên `user: { select: { image: true } }`.

Đổi dòng 284 từ:

```ts
      avatarUrl: classmate.student.user?.image ?? null,
```

thành:

```ts
      avatarUrl: classmate.student.avatarUrl,
      avatarPreset: classmate.student.avatarPreset,
      userImage: classmate.student.user?.image ?? null,
```

Và dòng 154 (`avatarUrl: row.avatarUrl,`) thành:

```ts
      avatarUrl: row.avatarUrl,
      avatarPreset: row.avatarPreset,
      userImage: row.userImage,
```

- [ ] **Step 5: Thay ba chỗ render trong bảng xếp hạng**

Trong `components/class-ranking-board.tsx`: xoá `function initials`, hằng `AVATAR_COLORS`, `function avatarColor`; thêm `import { StudentAvatar } from "@/components/student-avatar";`.

Ba khối `{rankedStudent.avatarUrl ? (<img .../>) : (<span>{initials(...)}</span>)}` (khoảng dòng 174, 254, 332) thay bằng một dòng, chỉ khác `size` (bục dùng `lg`, danh sách dùng `md`):

```tsx
<StudentAvatar
  avatarUrl={rankedStudent.avatarUrl}
  avatarPreset={rankedStudent.avatarPreset}
  userImage={rankedStudent.userImage}
  displayName={rankedStudent.displayName}
  size="lg"
/>
```

Giữ nguyên mọi class về vòng ngoài (`ring-*`, `animate-podium-shine`) bằng cách bọc `<StudentAvatar>` trong thẻ cha sẵn có hoặc truyền qua `className`.

- [ ] **Step 6: Chạy test**

Run: `npx vitest run tests/student-avatar-usage.test.ts tests/class-ranking.test.ts && npx tsc --noEmit`
Expected: PASS cả hai file test; `tsc` không báo lỗi. `class-ranking.test.ts` là test cũ — nếu nó đỏ vì thiếu trường mới trong dữ liệu giả, bổ sung `avatarPreset: null, userImage: null` vào các bản ghi mẫu trong test đó.

- [ ] **Step 7: Commit**

```bash
git add components/student-avatar.tsx components/class-ranking-board.tsx lib/class-ranking.ts tests/student-avatar-usage.test.ts tests/class-ranking.test.ts
git commit -m "feat(ho-so): component avatar dung chung, bang xep hang dung anh that"
```

---

### Task 7: Form sửa hồ sơ (bio, avatar, màu bìa, mục tiêu band)

**Files:**
- Create: `components/profile-editor.tsx`

**Interfaces:**
- Consumes: `ActionForm`/`ServerAction` (`components/action-form.tsx`), `AVATAR_PRESETS`, `COVER_COLORS`, `DEFAULT_COVER_KEY` (Task 2), `POST /api/student/avatar` (Task 5)
- Produces: `<ProfileEditor action initial extraFields />` — `extraFields` là các `<input type="hidden">` phía giáo viên cần gửi kèm (`studentId`, `displayName`, `email`)

- [ ] **Step 1: Viết component**

Task này không có test tự động: nó là giao diện và thao tác cắt ảnh, phải kiểm bằng trình duyệt ở Task 8. Viết thẳng.

`components/profile-editor.tsx`:

```tsx
"use client";

import { useRef, useState } from "react";
import { ActionForm, type ServerAction } from "@/components/action-form";
import { StudentAvatar } from "@/components/student-avatar";
import {
  AVATAR_PRESETS,
  COVER_COLORS,
  DEFAULT_COVER_KEY
} from "@/lib/student-avatar";

const BIO_LIMIT = 280;

// Cắt vuông + thu về 256px + xuất webp NGAY TRONG TRÌNH DUYỆT trước khi gửi.
// Ảnh gốc từ điện thoại thường 3–5MB; sau bước này còn khoảng 20KB.
async function shrinkToSquareWebp(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Trình duyệt không xử lý được ảnh này.");
  }

  // Cắt phần vuông ở giữa ảnh gốc rồi vẽ đầy khung 256x256.
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    256,
    256
  );
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Không nén được ảnh.")),
      "image/webp",
      0.85
    );
  });
}

export function ProfileEditor({
  action,
  initial,
  extraFields,
  onDone
}: {
  action: ServerAction;
  initial: {
    displayName: string;
    bio: string | null;
    avatarUrl: string | null;
    avatarPreset: string | null;
    userImage: string | null;
    coverColor: string | null;
    targetBand: number | null;
  };
  extraFields?: React.ReactNode;
  onDone?: () => void;
}) {
  const [bio, setBio] = useState(initial.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState(initial.avatarUrl);
  const [avatarPreset, setAvatarPreset] = useState(initial.avatarPreset);
  const [coverColor, setCoverColor] = useState(initial.coverColor ?? DEFAULT_COVER_KEY);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setUploadError(null);
    setUploading(true);

    try {
      const shrunk = await shrinkToSquareWebp(file);
      const body = new FormData();
      body.append("file", new File([shrunk], "avatar.webp", { type: "image/webp" }));

      const response = await fetch("/api/student/avatar", { method: "POST", body });
      const payload = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !payload.url) {
        throw new Error(payload.error ?? "Tải ảnh không thành công.");
      }

      setAvatarUrl(payload.url);
      setAvatarPreset(null); // ảnh tự tải thắng avatar có sẵn
    } catch (error) {
      setUploadError((error as Error).message);
    } finally {
      setUploading(false);
      if (fileInput.current) {
        fileInput.current.value = "";
      }
    }
  }

  return (
    <ActionForm action={action} className="space-y-5" onResult={() => onDone?.()}>
      {extraFields}
      <input type="hidden" name="bio" value={bio} />
      <input type="hidden" name="avatarUrl" value={avatarUrl ?? ""} />
      <input type="hidden" name="avatarPreset" value={avatarPreset ?? ""} />
      <input type="hidden" name="coverColor" value={coverColor} />

      <div className="flex items-center gap-4">
        <StudentAvatar
          avatarUrl={avatarUrl}
          avatarPreset={avatarPreset}
          userImage={initial.userImage}
          displayName={initial.displayName}
          size="xl"
        />
        <div className="space-y-2">
          {/* Ô chọn file thật bị ẩn bằng class sr-only, KHÔNG dùng thuộc tính hidden
              — thuộc tính hidden thua class Tailwind và ô sẽ hiện lại. */}
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            id="avatar-file"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void handleFile(file);
              }
            }}
          />
          <label
            htmlFor="avatar-file"
            className="inline-flex cursor-pointer items-center rounded-lg border border-border px-3 py-2 text-sm font-medium transition hover:border-primary hover:text-primary"
          >
            {uploading ? "Đang tải ảnh…" : "Tải ảnh lên"}
          </label>
          {avatarUrl ? (
            <button
              type="button"
              onClick={() => setAvatarUrl(null)}
              className="ml-2 text-sm text-muted-foreground underline"
            >
              Xoá ảnh
            </button>
          ) : null}
          {uploadError ? (
            <p className="text-sm text-rose-500">{uploadError}</p>
          ) : null}
        </div>
      </div>

      <fieldset>
        <legend className="text-sm font-semibold">Hoặc chọn avatar có sẵn</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {AVATAR_PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              aria-pressed={avatarPreset === preset.key}
              onClick={() => {
                setAvatarPreset(preset.key);
                setAvatarUrl(null);
              }}
              className={`flex h-11 w-11 items-center justify-center rounded-full text-xl ${preset.colorClass} ${
                avatarPreset === preset.key ? "ring-2 ring-primary ring-offset-2" : ""
              }`}
            >
              {preset.emoji}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-semibold">Màu bìa</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {COVER_COLORS.map((cover) => (
            <button
              key={cover.key}
              type="button"
              aria-pressed={coverColor === cover.key}
              aria-label={`Màu bìa ${cover.key}`}
              onClick={() => setCoverColor(cover.key)}
              className={`h-11 w-16 rounded-lg ${cover.className} ${
                coverColor === cover.key ? "ring-2 ring-primary ring-offset-2" : ""
              }`}
            />
          ))}
        </div>
      </fieldset>

      <label className="block space-y-1">
        <span className="text-sm font-semibold">Giới thiệu</span>
        <textarea
          value={bio}
          maxLength={BIO_LIMIT}
          rows={3}
          onChange={(event) => setBio(event.target.value)}
          placeholder="Vài dòng về bạn…"
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
        />
        <span className="block text-right text-xs text-muted-foreground">
          {bio.length}/{BIO_LIMIT}
        </span>
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-semibold">Mục tiêu band</span>
        <input
          type="number"
          name="targetBand"
          step="0.5"
          min="0"
          max="9"
          defaultValue={initial.targetBand ?? ""}
          className="w-32 rounded-lg border border-border bg-card px-3 py-2 text-sm"
        />
      </label>

      <button
        type="submit"
        disabled={uploading}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        Lưu hồ sơ
      </button>
    </ActionForm>
  );
}
```

- [ ] **Step 2: Kiểm kiểu và lint**

Run: `npx tsc --noEmit && pnpm lint`
Expected: không lỗi.

- [ ] **Step 3: Commit**

```bash
git add components/profile-editor.tsx
git commit -m "feat(ho-so): form sua ho so voi cat anh o trinh duyet"
```

---

### Task 8: Trang `/student/profile` — hồ sơ của chính mình

**Files:**
- Create: `app/student/profile/page.tsx`
- Create: `components/attendance-calendar.tsx`

**Interfaces:**
- Consumes: `updateMyProfile` (Task 4), `<ProfileEditor>` (Task 7), `<StudentAvatar>` (Task 6), `buildAttendanceMonth` (Task 3), `getTierProgress` (`lib/rank-tier.ts`), `calculateWeekStreak` (`lib/streak.ts`), `bandsBySkill` (`lib/band-score.ts`), `countsForStats` (`lib/practice.ts`)
- Produces: route `/student/profile`

- [ ] **Step 1: Viết component lịch**

`components/attendance-calendar.tsx`:

```tsx
import type { AttendanceMonth } from "@/lib/attendance";

const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

// Heatmap chuyên cần một tháng. Ô sáng = ngày đó có nộp bài hoặc có học từ vựng.
export function AttendanceCalendar({ data }: { data: AttendanceMonth }) {
  const activeCount = data.days.filter((day) => day.active).length;

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold">
          Tháng {data.month}/{data.year}
        </h3>
        <p className="text-sm text-muted-foreground">{activeCount} ngày có học</p>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1.5 text-center">
        {WEEKDAYS.map((label) => (
          <span key={label} className="text-xs font-medium text-muted-foreground">
            {label}
          </span>
        ))}

        {Array.from({ length: data.leadingBlanks }, (_, index) => (
          <span key={`blank-${index}`} aria-hidden="true" />
        ))}

        {data.days.map((day) => (
          <span
            key={day.day}
            title={`Ngày ${day.day}: ${day.active ? "có học" : "nghỉ"}`}
            className={`flex aspect-square items-center justify-center rounded-md text-xs ${
              day.active
                ? "bg-primary font-semibold text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {day.day}
          </span>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Viết trang hồ sơ**

`app/student/profile/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { AttendanceCalendar } from "@/components/attendance-calendar";
import { ProfileEditor } from "@/components/profile-editor";
import { RankTierBadge } from "@/components/rank-tier-badge";
import { StudentAvatar } from "@/components/student-avatar";
import { updateMyProfile } from "@/lib/actions/profile";
import { auth } from "@/lib/auth";
import { buildAttendanceMonth } from "@/lib/attendance";
import { bandsBySkill, formatBand, SKILL_SHORT_LABELS } from "@/lib/band-score";
import { countsForStats } from "@/lib/practice";
import { prisma } from "@/lib/prisma";
import { calculateWeekStreak } from "@/lib/streak";
import { coverClassName } from "@/lib/student-avatar";

export const dynamic = "force-dynamic";

export default async function StudentProfilePage() {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "student") {
    redirect("/login");
  }

  const student = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      displayName: true,
      bio: true,
      avatarUrl: true,
      avatarPreset: true,
      coverColor: true,
      targetBand: true,
      createdAt: true,
      user: { select: { image: true } },
      classes: {
        orderBy: { joinedAt: "desc" },
        take: 1,
        select: { class: { select: { weeklyGoal: true } } }
      }
    }
  });

  if (!student) {
    redirect("/waiting");
  }

  const attempts = await prisma.attempt.findMany({
    where: { studentId: student.id, submittedAt: { not: null }, ...countsForStats },
    select: {
      submittedAt: true,
      // Answer KHÔNG có cột skill — kỹ năng nằm ở phần bài (assignableUnit).
      // Mọi nơi gọi bandsBySkill đều phải tự ánh xạ như dưới đây.
      answers: {
        select: { isCorrect: true, assignableUnit: { select: { skill: true } } }
      }
    }
  });

  const vocabDays = await prisma.vocabQuizDay.findMany({
    where: { studentId: student.id },
    select: { date: true }
  });

  const vocabWordCount = await prisma.vocabProgress.count({
    where: { studentId: student.id }
  });

  const submittedAt = attempts
    .map((attempt) => attempt.submittedAt)
    .filter((date): date is Date => date !== null);

  const bands = bandsBySkill(
    attempts.flatMap((attempt) =>
      attempt.answers.map((answer) => ({
        isCorrect: answer.isCorrect,
        skill: answer.assignableUnit.skill
      }))
    )
  ).filter((row) => row.band !== null);

  const streak = calculateWeekStreak({
    submittedAt,
    weeklyGoal: student.classes[0]?.class.weeklyGoal ?? 1,
    now: new Date()
  });

  const attendance = buildAttendanceMonth({
    submittedAt,
    vocabDays: vocabDays.map((row) => row.date),
    month: new Date()
  });

  const joined = new Intl.DateTimeFormat("vi-VN", {
    day: "numeric",
    month: "numeric",
    year: "numeric"
  }).format(student.createdAt);

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <div className={`h-32 ${coverClassName(student.coverColor)}`} />
        <div className="-mt-12 px-5 pb-5">
          <StudentAvatar
            avatarUrl={student.avatarUrl}
            avatarPreset={student.avatarPreset}
            userImage={student.user?.image ?? null}
            displayName={student.displayName}
            size="xl"
            className="ring-4 ring-card"
          />
          <h2 className="mt-3 text-2xl font-bold tracking-tight">
            {student.displayName}
          </h2>
          {/* Bio là chữ do học viên nhập — render text thuần, không bao giờ HTML. */}
          {student.bio ? (
            <p className="mt-2 max-w-prose whitespace-pre-line text-sm text-muted-foreground">
              {student.bio}
            </p>
          ) : null}
          <p className="mt-3 text-sm text-muted-foreground">
            Tham gia từ {joined}
            {student.targetBand !== null
              ? ` · Mục tiêu ${formatBand(student.targetBand)}`
              : ""}
          </p>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Bài đã nộp" value={String(submittedAt.length)} />
        <StatCard label="Từ vựng đã học" value={String(vocabWordCount)} />
        <StatCard label="Chuỗi tuần" value={`${streak.weeks} tuần`} />
        <StatCard
          label="Band trung bình"
          value={
            bands.length > 0
              ? bands
                  .map(
                    (band) =>
                      `${SKILL_SHORT_LABELS[band.skill] ?? band.skill} ${formatBand(band.band)}`
                  )
                  .join(" · ")
              : "Chưa có"
          }
        />
      </section>

      <AttendanceCalendar data={attendance} />

      <section className="rounded-xl border border-border bg-card p-5 shadow-card">
        <h3 className="text-sm font-semibold">Chỉnh sửa hồ sơ</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Tên và email do giáo viên quản lý.
        </p>
        <div className="mt-4">
          <ProfileEditor
            action={updateMyProfile}
            initial={{
              displayName: student.displayName,
              bio: student.bio,
              avatarUrl: student.avatarUrl,
              avatarPreset: student.avatarPreset,
              userImage: student.user?.image ?? null,
              coverColor: student.coverColor,
              targetBand: student.targetBand
            }}
          />
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-card">
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}
```

**Cái bẫy của task này:** `Answer` **không** có cột `skill`. Kỹ năng nằm ở `assignableUnit.skill`, và mọi nơi gọi `bandsBySkill` đều phải tự ánh xạ — xem `app/teacher/students/[studentId]/page.tsx:269` làm mẫu. Viết `answers: { select: { skill: true } }` là hỏng ngay ở bước kiểm kiểu.

- [ ] **Step 3: Kiểm kiểu, lint, chạy toàn bộ test**

Run: `npx tsc --noEmit && pnpm lint && pnpm test`
Expected: tất cả xanh.

- [ ] **Step 4: Kiểm bằng trình duyệt**

Khởi động preview (`preview_start` với `.claude/launch.json`, KHÔNG chạy `pnpm dev` bằng Bash). Nhờ người dùng đăng nhập bằng tài khoản học viên — không tự gõ mật khẩu được. Sau đó vào `/student/profile` và kiểm:

- Đổi màu bìa, chọn avatar có sẵn, bấm Lưu → toast "Đã lưu hồ sơ", tải lại trang thấy đổi thật.
- Tải một ảnh lên → avatar đổi thành ảnh đó.
- Gõ bio 280 ký tự → bộ đếm dừng đúng, không gõ thêm được.
- `resize_window` preset `mobile` → thử lại thao tác chọn avatar bằng cảm ứng.
- `read_console_messages` không có lỗi đỏ.

- [ ] **Step 5: Commit**

```bash
git add app/student/profile/page.tsx components/attendance-calendar.tsx
git commit -m "feat(ho-so): trang ho so hoc vien voi thong ke va lich chuyen can"
```

---

### Task 9: Hồ sơ rút gọn của bạn cùng lớp

**Files:**
- Create: `app/student/profile/[studentId]/page.tsx`
- Test: `tests/profile-visibility.test.ts`

**Interfaces:**
- Consumes: `<StudentAvatar>` (Task 6), `coverClassName` (Task 2)
- Produces: route `/student/profile/[studentId]`

- [ ] **Step 1: Viết test đỏ**

`tests/profile-visibility.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const source = readFileSync(
  join(root, "app", "student", "profile", "[studentId]", "page.tsx"),
  "utf8"
);

describe("hồ sơ rút gọn của bạn cùng lớp", () => {
  it("lọc theo lớp chung ngay trong where của truy vấn", () => {
    // Học viên đoán URL không được xem hồ sơ người khác lớp. Phải nằm trong where,
    // không phải ẩn nút trên giao diện.
    expect(source).toMatch(/classes:\s*\{\s*some:\s*\{/);
  });

  it("không lấy dữ liệu điểm — band là chuyện riêng", () => {
    expect(source).not.toContain("bandsBySkill");
    expect(source).not.toContain("scorePercent");
  });

  it("không lấy mục tiêu band", () => {
    expect(source).not.toContain("targetBand");
  });

  it("không lấy lịch chuyên cần", () => {
    expect(source).not.toContain("buildAttendanceMonth");
  });

  it("gọi notFound khi không tìm thấy, không lộ sự tồn tại của học viên", () => {
    expect(source).toContain("notFound()");
  });
});
```

- [ ] **Step 2: Chạy test cho chắc là đỏ**

Run: `npx vitest run tests/profile-visibility.test.ts`
Expected: FAIL — `ENOENT`.

- [ ] **Step 3: Viết trang**

`app/student/profile/[studentId]/page.tsx`:

```tsx
import { notFound, redirect } from "next/navigation";
import { StudentAvatar } from "@/components/student-avatar";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { coverClassName } from "@/lib/student-avatar";

export const dynamic = "force-dynamic";

// Hồ sơ RÚT GỌN của bạn cùng lớp: chỉ phần trang trí. Điểm số, mục tiêu band và
// lịch chuyên cần là chuyện riêng, không hiện ở đây.
export default async function ClassmateProfilePage({
  params
}: {
  params: { studentId: string };
}) {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "student") {
    redirect("/login");
  }

  const me = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, classes: { select: { classId: true } } }
  });

  if (!me) {
    redirect("/waiting");
  }

  if (me.id === params.studentId) {
    redirect("/student/profile");
  }

  const classIds = me.classes.map((row) => row.classId);

  // Chốt chặn quyền: chỉ thấy được học viên CHUNG ÍT NHẤT MỘT LỚP với mình.
  const classmate = await prisma.studentProfile.findFirst({
    where: {
      id: params.studentId,
      classes: { some: { classId: { in: classIds } } }
    },
    select: {
      displayName: true,
      bio: true,
      avatarUrl: true,
      avatarPreset: true,
      coverColor: true,
      createdAt: true,
      user: { select: { image: true } }
    }
  });

  if (!classmate) {
    notFound();
  }

  const joined = new Intl.DateTimeFormat("vi-VN", {
    day: "numeric",
    month: "numeric",
    year: "numeric"
  }).format(classmate.createdAt);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <div className={`h-32 ${coverClassName(classmate.coverColor)}`} />
        <div className="-mt-12 px-5 pb-5">
          <StudentAvatar
            avatarUrl={classmate.avatarUrl}
            avatarPreset={classmate.avatarPreset}
            userImage={classmate.user?.image ?? null}
            displayName={classmate.displayName}
            size="xl"
            className="ring-4 ring-card"
          />
          <h2 className="mt-3 text-2xl font-bold tracking-tight">
            {classmate.displayName}
          </h2>
          {/* Text thuần — bio do người khác nhập. */}
          {classmate.bio ? (
            <p className="mt-2 max-w-prose whitespace-pre-line text-sm text-muted-foreground">
              {classmate.bio}
            </p>
          ) : null}
          <p className="mt-3 text-sm text-muted-foreground">Tham gia từ {joined}</p>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Chạy test cho chắc là xanh**

Run: `npx vitest run tests/profile-visibility.test.ts && npx tsc --noEmit`
Expected: PASS — 5 test xanh, không lỗi kiểu.

- [ ] **Step 5: Commit**

```bash
git add "app/student/profile/[studentId]/page.tsx" tests/profile-visibility.test.ts
git commit -m "feat(ho-so): ho so rut gon cua ban cung lop"
```

---

### Task 10: Giáo viên sửa hồ sơ học viên

**Files:**
- Modify: `app/teacher/students/[studentId]/page.tsx`

**Interfaces:**
- Consumes: `updateStudentProfile` (Task 4), `<ProfileEditor>` (Task 7), `<StudentAvatar>` (Task 6)
- Produces: khối "Hồ sơ học viên" trên trang chi tiết học viên

- [ ] **Step 1: Mở rộng truy vấn**

Trong `app/teacher/students/[studentId]/page.tsx`, truy vấn `prisma.studentProfile.findFirst` đang có — thêm vào phần `select` (dùng `select`, KHÔNG dùng `include`):

```ts
      bio: true,
      avatarUrl: true,
      avatarPreset: true,
      coverColor: true,
      targetBand: true,
      userId: true,
      user: { select: { image: true } },
```

- [ ] **Step 2: Thêm khối sửa hồ sơ**

Chèn khối này vào trang, đặt ngay sau tiêu đề tên học viên:

```tsx
      <section className="rounded-xl border border-border bg-card p-5 shadow-card">
        <div className="flex items-center gap-4">
          <StudentAvatar
            avatarUrl={student.avatarUrl}
            avatarPreset={student.avatarPreset}
            userImage={student.user?.image ?? null}
            displayName={student.displayName}
            size="lg"
          />
          <div>
            <h3 className="text-sm font-semibold">Hồ sơ học viên</h3>
            <p className="text-sm text-muted-foreground">
              {student.userId
                ? "Học viên đã đăng nhập bằng Google — không đổi được email."
                : "Học viên chưa đăng nhập lần nào — còn đổi được email."}
            </p>
          </div>
        </div>

        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium text-primary">
            Chỉnh sửa
          </summary>
          <div className="mt-4 space-y-4">
            <ProfileEditor
              action={updateStudentProfile}
              initial={{
                displayName: student.displayName,
                bio: student.bio,
                avatarUrl: student.avatarUrl,
                avatarPreset: student.avatarPreset,
                userImage: student.user?.image ?? null,
                coverColor: student.coverColor,
                targetBand: student.targetBand
              }}
              extraFields={
                <>
                  <input type="hidden" name="studentId" value={student.id} />
                  <label className="block space-y-1">
                    <span className="text-sm font-semibold">Tên hiển thị</span>
                    <input
                      name="displayName"
                      defaultValue={student.displayName}
                      required
                      className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-sm font-semibold">Email</span>
                    <input
                      name="email"
                      type="email"
                      defaultValue={student.email}
                      required
                      readOnly={student.userId !== null}
                      className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm read-only:opacity-60"
                    />
                  </label>
                </>
              }
            />
          </div>
        </details>
      </section>
```

Thêm import ở đầu file:

```tsx
import { ProfileEditor } from "@/components/profile-editor";
import { StudentAvatar } from "@/components/student-avatar";
import { updateStudentProfile } from "@/lib/actions/profile";
```

Nếu `email` chưa có trong `select` của truy vấn thì thêm `email: true`.

- [ ] **Step 3: Kiểm kiểu, lint, chạy test**

Run: `npx tsc --noEmit && pnpm lint && npx vitest run tests/teacher-page-guard.test.ts`
Expected: tất cả xanh — trang này vẫn dùng `requireTeacherPage()` như cũ.

- [ ] **Step 4: Kiểm bằng trình duyệt**

Đăng nhập tài khoản giáo viên (nhờ người dùng đăng nhập), vào `/teacher/students/<id>`:

- Mở "Chỉnh sửa", đổi tên và bio, bấm Lưu → toast báo thành công.
- Với học viên **đã** liên kết Google: ô email ở chế độ chỉ đọc.
- Với học viên **chưa** đăng nhập: đổi email được, và nếu nhập trùng email học viên khác thì toast báo lỗi rõ ràng.

- [ ] **Step 5: Commit**

```bash
git add "app/teacher/students/[studentId]/page.tsx"
git commit -m "feat(ho-so): giao vien sua ho so hoc vien trong lop minh"
```

---

### Task 11: Avatar trong thanh điều hướng học viên

**Files:**
- Modify: `app/student/layout.tsx`
- Modify: `components/app-shell.tsx` (hai chỗ đặt `<NotificationBell />`, khoảng dòng 246 và 257)

**Interfaces:**
- Consumes: `<StudentAvatar>` (Task 6)
- Produces: `AppShell` nhận thêm prop `studentAvatar?: { avatarUrl, avatarPreset, userImage, displayName }`

- [ ] **Step 1: Đọc hồ sơ trong layout**

`app/student/layout.tsx` là server component nên đọc DB được. Viết lại:

```tsx
import { AppShell } from "@/components/app-shell";
import { ToastProvider } from "@/components/toast";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function StudentLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  // Chỉ lấy đúng bốn cột cần để vẽ avatar — layout chạy trên MỌI trang của học
  // viên nên truy vấn phải nhẹ.
  const student = session?.user?.id
    ? await prisma.studentProfile.findUnique({
        where: { userId: session.user.id },
        select: {
          displayName: true,
          avatarUrl: true,
          avatarPreset: true,
          user: { select: { image: true } }
        }
      })
    : null;

  return (
    <ToastProvider>
      <AppShell
        role="student"
        studentAvatar={
          student
            ? {
                displayName: student.displayName,
                avatarUrl: student.avatarUrl,
                avatarPreset: student.avatarPreset,
                userImage: student.user?.image ?? null
              }
            : undefined
        }
      >
        {children}
      </AppShell>
    </ToastProvider>
  );
}
```

- [ ] **Step 2: Nhận prop và vẽ trong AppShell**

Trong `components/app-shell.tsx`, thêm prop vào kiểu của `AppShell`:

```tsx
  studentAvatar?: {
    displayName: string;
    avatarUrl: string | null;
    avatarPreset: string | null;
    userImage: string | null;
  };
```

Thêm import `Link` (nếu chưa có) và `StudentAvatar`. Ở **cả hai** chỗ đang render `{role === "student" ? <NotificationBell /> : null}` (khoảng dòng 246 và 257), thêm ngay trước chuông:

```tsx
{role === "student" && studentAvatar ? (
  <Link href="/student/profile" aria-label="Hồ sơ của tôi">
    <StudentAvatar
      avatarUrl={studentAvatar.avatarUrl}
      avatarPreset={studentAvatar.avatarPreset}
      userImage={studentAvatar.userImage}
      displayName={studentAvatar.displayName}
      size="sm"
    />
  </Link>
) : null}
```

- [ ] **Step 3: Kiểm kiểu, lint, test**

Run: `npx tsc --noEmit && pnpm lint && pnpm test`
Expected: tất cả xanh.

- [ ] **Step 4: Kiểm bằng trình duyệt**

Vào bất kỳ trang nào của học viên: avatar nhỏ hiện cạnh chuông thông báo, bấm vào mở `/student/profile`. Thử cả `resize_window` preset `mobile` (thanh trên cùng) lẫn desktop (thanh bên).

- [ ] **Step 5: Commit**

```bash
git add app/student/layout.tsx components/app-shell.tsx
git commit -m "feat(ho-so): avatar tren thanh dieu huong hoc vien"
```

---

### Task 12: Avatar ở trang giáo viên, bảng xếp hạng và báo cáo phụ huynh

**Files:**
- Modify: `components/class-ranking-board.tsx` (tên bấm được → hồ sơ rút gọn)
- Modify: `app/teacher/classes/[classId]/page.tsx`
- Modify: `app/teacher/review/page.tsx`
- Modify: `lib/parent-report-query.ts`
- Modify: `app/ph/[token]/page.tsx`

**Interfaces:**
- Consumes: `<StudentAvatar>` (Task 6), route `/student/profile/[studentId]` (Task 9)
- Produces: không có gì cho task sau — đây là task cuối

- [ ] **Step 1: Cho tên trong bảng xếp hạng bấm được**

Trong `components/class-ranking-board.tsx`, bọc tên học viên trong danh sách bằng `Link` (đã có `import Link from "next/link"` ở đầu file):

```tsx
<Link
  href={`/student/profile/${rankedStudent.id}`}
  className="font-semibold hover:text-primary hover:underline"
>
  {rankedStudent.displayName}
</Link>
```

Bảng xếp hạng cũng hiện cho giáo viên xem. Route `/student/profile/[studentId]` chỉ cho học viên vào, nên giáo viên bấm sẽ bị đẩy về `/login`. Vì vậy chỉ bọc `Link` khi bảng đang hiển thị cho học viên — thêm prop `linkToProfiles?: boolean` vào `ClassRankingBoard`, mặc định `false`, và `app/student/ranking/page.tsx` truyền `linkToProfiles`.

- [ ] **Step 2: Thêm avatar vào hai trang giáo viên**

Trong `app/teacher/classes/[classId]/page.tsx` và `app/teacher/review/page.tsx`: thêm `avatarUrl: true, avatarPreset: true, user: { select: { image: true } }` vào `select` của học viên (dùng `select`, KHÔNG dùng `include`), rồi đặt `<StudentAvatar ... size="sm" />` trước tên học viên trong mỗi dòng danh sách.

- [ ] **Step 3: Thêm avatar vào báo cáo phụ huynh**

Trong `lib/parent-report-query.ts`, hàm `findStudentByParentToken` — thêm vào `select` (khoảng dòng 28):

```ts
      avatarUrl: true,
      avatarPreset: true,
      user: { select: { image: true } },
```

và vào object trả về (khoảng dòng 45):

```ts
    avatarUrl: student.avatarUrl,
    avatarPreset: student.avatarPreset,
    userImage: student.user?.image ?? null,
```

Cập nhật kiểu ở khoảng dòng 14 cho khớp. Trong `app/ph/[token]/page.tsx`, đặt `<StudentAvatar ... size="lg" />` cạnh tên học viên ở đầu báo cáo.

- [ ] **Step 4: Kiểm kiểu, lint, chạy toàn bộ test**

Run: `npx tsc --noEmit && pnpm lint && pnpm test`
Expected: tất cả xanh. `tests/parent-report.test.ts` có thể cần bổ sung ba trường mới vào dữ liệu giả — sửa nếu đỏ.

- [ ] **Step 5: Kiểm bằng trình duyệt**

- `/student/ranking`: avatar thật trên bục và trong danh sách; bấm tên bạn cùng lớp → hồ sơ rút gọn, không thấy band.
- `/teacher/classes/<id>` và `/teacher/review`: avatar hiện đúng.
- `/ph/<token>`: avatar hiện, trang vẫn mở được khi CHƯA đăng nhập (đây là link cho phụ huynh — thử trong tab ẩn danh).

- [ ] **Step 6: Commit và đẩy lên**

```bash
git add -A
git commit -m "feat(ho-so): avatar o trang giao vien, xep hang va bao cao phu huynh"
git push origin feature/ielts-platform-mvp
```

- [ ] **Step 7: Kiểm trên production**

Vercel tự deploy sau khi push. Chờ build xong rồi kiểm thật trên Vercel + Neon, không chỉ suy luận ở máy:

- Log build có dòng `ensure-db` chạy không lỗi (đây là lúc bốn cột mới được thêm vào DB production).
- Mở `/student/profile` trên production bằng tài khoản thật.
- Nếu trang đổ với lỗi kiểu "column does not exist" thì `ensure-db.mjs` chưa chạy hoặc thiếu câu lệnh — quay lại Task 1.

---

## Tự soát kế hoạch

**Phủ đặc tả:** Mục 1 (dữ liệu) → Task 1. Mục 2 (`student-avatar.ts`) → Task 2. Mục 3 (`<StudentAvatar>`) → Task 6. Mục 4 (server action) → Task 4. Mục 5 (route tải ảnh) → Task 5. Mục 6 (trang hồ sơ) → Task 8, 9, 10. Mục 7 (`attendance.ts`) → Task 3. Mục 8 (điểm tích hợp) → Task 11, 12. Mục 9 (kiểm thử) → rải trong từng task. Mục 10 (rủi ro) → đã thành ràng buộc toàn cục và các chốt chặn cụ thể. Không còn mục nào chưa có task.

**Lệch có chủ ý so với đặc tả:** `buildAttendanceMonth` trả về object thay vì mảng — lý do ghi ở Task 3. Thêm `tests/avatar-upload-guard.test.ts` và `tests/student-avatar-usage.test.ts` ngoài ba file test đặc tả nêu.

**Việc phát sinh khi lập kế hoạch, không có trong đặc tả:**

1. Bảng xếp hạng hiện cho cả giáo viên xem, nên link tới hồ sơ rút gọn phải có prop bật/tắt (Task 12 Step 1) — nếu không giáo viên bấm vào sẽ bị đẩy về trang đăng nhập.
2. `Answer` không có cột `skill` (kỹ năng nằm ở `assignableUnit.skill`). Đặc tả nói "dùng `bandsBySkill()` đúng cách trang chi tiết học viên đang tính" mà không nói rõ chỗ này; Task 8 đã ghi thẳng cách ánh xạ.

**Nhất quán kiểu:** `formatBand(band: number | null)` nhận `null` và trả `"—"`, nên `formatBand(band.band)` trong Task 8 hợp lệ dù `SkillBand.band` là `number | null`. Ba trường avatar (`avatarUrl`, `avatarPreset`, `userImage`) giữ đúng tên đó xuyên suốt Task 2, 6, 7, 8, 9, 10, 11, 12.
