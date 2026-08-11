# Kế hoạch triển khai: Từ vựng mỗi ngày (Word of the Day)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mỗi ngày hiện cho học viên một từ vựng học thuật rút từ chính đề Listening/Reading đang có trên hệ thống, kèm quiz ôn lại các từ đã phát.

**Architecture:** Bốn bảng Prisma mới (không sửa bảng cũ) + năm module logic thuần test được bằng vitest + một script chạy tay gọi Claude API điền nghĩa. Từ của ngày được chọn theo cơ chế "ghi sổ lười": học viên đầu tiên vào trang chủ trong ngày khiến hệ thống bốc một từ chưa dùng và ghi vào `VocabDaily`; cột `date` có `@unique` chống hai người vào cùng lúc.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript strict, Prisma + PostgreSQL (Neon), zod v4, vitest, `@anthropic-ai/sdk` (thêm mới, chỉ dùng trong script chạy tay).

**Spec:** [docs/superpowers/specs/2026-08-11-word-of-the-day-design.md](../specs/2026-08-11-word-of-the-day-design.md)

## Global Constraints

- Mọi chuỗi hiển thị cho người dùng và mọi comment trong code viết bằng **tiếng Việt**. Riêng từ vựng, câu ví dụ và định nghĩa tiếng Anh giữ nguyên tiếng Anh.
- Enum trong Prisma để dạng **`String` thường**, không dùng `enum` của Prisma. Giá trị hợp lệ ghi vào comment ở đầu `prisma/schema.prisma`.
- Mọi server action mở đầu bằng `requireTeacher()` (`lib/actions/classes.ts`) hoặc `requireStudent()` (`lib/actions/attempts.ts`), rồi validate bằng zod.
- Mọi `page.tsx` dưới `app/teacher/` dùng `requireTeacherPage()` (`lib/teacher-page.ts`), **không** dùng `requireTeacher()`. `tests/teacher-page-guard.test.ts` sẽ tự bắt lỗi này.
- Trang teacher truy vấn Prisma bằng `select` tường minh, **không** dùng `include` (tránh kéo theo `content`/`transcript` rất nặng).
- Mọi bảng và cột mới **bắt buộc** phải thêm câu lệnh tương ứng vào `scripts/ensure-db.mjs`. Script này chạy trong `pnpm build` và là đường duy nhất đưa schema lên prod. Quên bước này = prod sập khi deploy.
- Model Claude dùng trong script: đúng chuỗi `claude-opus-5`. Không thêm hậu tố ngày tháng.
- Chạy test: `npx vitest run <đường dẫn file test>`. Chạy toàn bộ: `pnpm test`.
- Không tạo thêm cron job (Vercel Hobby chỉ cho 1 cron/ngày, đã dùng cho `/api/cron/reminders`).

## Thay đổi so với spec (có chủ đích)

1. **Spec ghi 4 tầng lọc từ; kế hoạch này dùng 3.** Tầng "bỏ stopword và 2000 từ phổ thông" bị lược vì thừa — danh sách AWL không chứa từ nào trong đó, nên kiểm tra AWL đã loại sạch chúng rồi. Giữ thêm một tầng là code chết.
2. **Danh sách AWL khởi đầu gồm Sublist 1–2 (120 headword).** Đủ dùng nhiều tháng ở nhịp 1 từ/ngày. Mở rộng sang sublist 3–10 về sau chỉ là thêm chuỗi vào mảng `AWL_HEADWORDS`, **không đụng code và không đụng test**.
3. **Script rút từ viết bằng TypeScript** (`scripts/vocab-extract.ts`, chạy bằng `tsx`) thay vì `.mjs`, để dùng lại được module logic thuần. `tsx` đã có sẵn trong devDependencies.

---

## Cấu trúc file

| File | Trách nhiệm |
| --- | --- |
| `prisma/schema.prisma` (sửa) | 4 model mới + 3 quan hệ ngược |
| `scripts/ensure-db.mjs` (sửa) | Lệnh SQL tạo 4 bảng trên prod |
| `lib/vocab-awl.ts` (mới) | Danh sách từ học thuật + hàm kiểm tra thuộc họ từ |
| `lib/vocab-extract.ts` (mới) | Rút từ ứng viên + câu ví dụ từ một đoạn văn bản |
| `lib/vocab-day.ts` (mới) | Ngày theo giờ VN + chọn từ kế tiếp |
| `lib/vocab-quiz.ts` (mới) | Chọn từ để ôn + sinh đáp án nhiễu |
| `lib/vocab-streak.ts` (mới) | Đếm chuỗi ngày làm quiz |
| `lib/vocab-daily.ts` (mới) | Đọc/ghi `VocabDaily` (chạm Prisma) |
| `lib/actions/vocab.ts` (mới) | 3 server action |
| `scripts/vocab-extract.ts` (mới) | Quét DB → lọc từ → gọi Claude API → ghi `VocabWord` |
| `components/vocab-card.tsx` (mới) | Thẻ từ vựng trên trang chủ học viên |
| `components/vocab-quiz-form.tsx` (mới) | Form quiz phía client |
| `app/student/page.tsx` (sửa) | Chèn thẻ từ vựng |
| `app/student/vocab/page.tsx` (mới) | Trang quiz |
| `app/teacher/vocab/page.tsx` (mới) | Trang quản lý kho từ |
| `components/app-shell.tsx` (sửa) | Thêm mục điều hướng |

---

### Task 1: Schema + ensure-db

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `scripts/ensure-db.mjs`
- Test: `tests/vocab-schema.test.ts`

**Interfaces:**
- Consumes: không có (task đầu tiên)
- Produces: 4 model Prisma — `VocabWord`, `VocabDaily`, `VocabProgress`, `VocabQuizDay`. Các task sau dùng đúng tên trường ghi trong bước 3 dưới đây.

- [ ] **Step 1: Viết test thất bại**

Tạo `tests/vocab-schema.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const schema = readFileSync(join(process.cwd(), "prisma", "schema.prisma"), "utf8");
const ensureDb = readFileSync(join(process.cwd(), "scripts", "ensure-db.mjs"), "utf8");

const TABLES = ["VocabWord", "VocabDaily", "VocabProgress", "VocabQuizDay"];

describe("schema từ vựng", () => {
  it.each(TABLES)("có model %s", (name) => {
    expect(schema).toContain(`model ${name} {`);
  });

  it("VocabWord có đủ các cột nội dung", () => {
    const block = schema.split("model VocabWord {")[1].split("}")[0];
    for (const field of [
      "word",
      "display",
      "phonetic",
      "partOfSpeech",
      "meaningVi",
      "definitionEn",
      "exampleEn",
      "sourceUnitId",
      "sourceSkill",
      "hidden",
    ]) {
      expect(block).toContain(field);
    }
  });

  it("VocabDaily khoá unique theo ngày để chống tạo trùng", () => {
    const block = schema.split("model VocabDaily {")[1].split("}")[0];
    expect(block).toMatch(/date\s+DateTime\s+@unique/);
  });

  it("VocabProgress unique theo cặp học viên + từ", () => {
    const block = schema.split("model VocabProgress {")[1].split("}")[0];
    expect(block).toContain("@@unique([studentId, wordId])");
  });

  it("VocabQuizDay unique theo cặp học viên + ngày", () => {
    const block = schema.split("model VocabQuizDay {")[1].split("}")[0];
    expect(block).toContain("@@unique([studentId, date])");
  });

  // Bảng mới không nằm trong ensure-db.mjs thì sẽ không bao giờ lên tới prod.
  it.each(TABLES)("ensure-db.mjs tạo bảng %s", (name) => {
    expect(ensureDb).toContain(`CREATE TABLE IF NOT EXISTS "${name}"`);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận nó thất bại**

Run: `npx vitest run tests/vocab-schema.test.ts`
Expected: FAIL — mọi assertion `toContain("model VocabWord {")` đều đỏ.

- [ ] **Step 3: Thêm 4 model vào `prisma/schema.prisma`**

Chèn vào cuối file:

```prisma
// ---- TỪ VỰNG MỖI NGÀY ----
// VocabWord.sourceSkill: listening | reading
// VocabWord.partOfSpeech: noun | verb | adjective | adverb

model VocabWord {
  id           String   @id @default(cuid())
  word         String   @unique // dạng chuẩn hoá, chữ thường
  display      String // dạng hiển thị
  phonetic     String? // IPA, vd /səˈsteɪnəbl/
  partOfSpeech String?
  meaningVi    String // nghĩa tiếng Việt
  definitionEn String?
  exampleEn    String // câu ví dụ NGUYÊN VĂN từ đề
  sourceUnitId String?
  sourceSkill  String?
  hidden       Boolean  @default(false)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  sourceUnit AssignableUnit? @relation(fields: [sourceUnitId], references: [id], onDelete: SetNull)
  dailies    VocabDaily[]
  progress   VocabProgress[]

  @@index([hidden])
  @@index([sourceUnitId])
}

model VocabDaily {
  id        String   @id @default(cuid())
  date      DateTime @unique @db.Date // ngày theo giờ VN
  wordId    String
  createdAt DateTime @default(now())

  word VocabWord @relation(fields: [wordId], references: [id], onDelete: Cascade)

  @@index([wordId])
}

model VocabProgress {
  id           String    @id @default(cuid())
  studentId    String
  wordId       String
  correctCount Int       @default(0)
  wrongCount   Int       @default(0)
  lastAnswerAt DateTime?

  student StudentProfile @relation(fields: [studentId], references: [id], onDelete: Cascade)
  word    VocabWord      @relation(fields: [wordId], references: [id], onDelete: Cascade)

  @@unique([studentId, wordId])
  @@index([wordId])
}

model VocabQuizDay {
  id        String   @id @default(cuid())
  studentId String
  date      DateTime @db.Date
  correct   Int // kết quả TỐT NHẤT trong ngày
  total     Int
  updatedAt DateTime @updatedAt

  student StudentProfile @relation(fields: [studentId], references: [id], onDelete: Cascade)

  @@unique([studentId, date])
}
```

Rồi thêm 3 quan hệ ngược. Trong `model AssignableUnit { ... }` thêm một dòng:

```prisma
  vocabWords VocabWord[]
```

Trong `model StudentProfile { ... }` thêm hai dòng:

```prisma
  vocabProgress VocabProgress[]
  vocabQuizDays VocabQuizDay[]
```

- [ ] **Step 4: Thêm lệnh tạo bảng vào `scripts/ensure-db.mjs`**

Thêm vào cuối mảng `statements` (trước dấu `]` đóng mảng):

```js
  // Từ vựng mỗi ngày: 4 bảng mới, không sửa bảng nào đang có.
  `CREATE TABLE IF NOT EXISTS "VocabWord" (
    "id" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "display" TEXT NOT NULL,
    "phonetic" TEXT,
    "partOfSpeech" TEXT,
    "meaningVi" TEXT NOT NULL,
    "definitionEn" TEXT,
    "exampleEn" TEXT NOT NULL,
    "sourceUnitId" TEXT,
    "sourceSkill" TEXT,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VocabWord_pkey" PRIMARY KEY ("id")
  );`,
  'CREATE UNIQUE INDEX IF NOT EXISTS "VocabWord_word_key" ON "VocabWord"("word");',
  'CREATE INDEX IF NOT EXISTS "VocabWord_hidden_idx" ON "VocabWord"("hidden");',
  'CREATE INDEX IF NOT EXISTS "VocabWord_sourceUnitId_idx" ON "VocabWord"("sourceUnitId");',
  `CREATE TABLE IF NOT EXISTS "VocabDaily" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "wordId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VocabDaily_pkey" PRIMARY KEY ("id")
  );`,
  'CREATE UNIQUE INDEX IF NOT EXISTS "VocabDaily_date_key" ON "VocabDaily"("date");',
  'CREATE INDEX IF NOT EXISTS "VocabDaily_wordId_idx" ON "VocabDaily"("wordId");',
  `CREATE TABLE IF NOT EXISTS "VocabProgress" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "wordId" TEXT NOT NULL,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "wrongCount" INTEGER NOT NULL DEFAULT 0,
    "lastAnswerAt" TIMESTAMP(3),
    CONSTRAINT "VocabProgress_pkey" PRIMARY KEY ("id")
  );`,
  'CREATE UNIQUE INDEX IF NOT EXISTS "VocabProgress_studentId_wordId_key" ON "VocabProgress"("studentId", "wordId");',
  'CREATE INDEX IF NOT EXISTS "VocabProgress_wordId_idx" ON "VocabProgress"("wordId");',
  `CREATE TABLE IF NOT EXISTS "VocabQuizDay" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "correct" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VocabQuizDay_pkey" PRIMARY KEY ("id")
  );`,
  'CREATE UNIQUE INDEX IF NOT EXISTS "VocabQuizDay_studentId_date_key" ON "VocabQuizDay"("studentId", "date");',
```

- [ ] **Step 5: Sinh lại Prisma Client và chạy test**

Run: `npx prisma generate`
Expected: `Generated Prisma Client` — không có lỗi quan hệ thiếu chiều ngược.

Run: `npx vitest run tests/vocab-schema.test.ts`
Expected: PASS, 12 test.

- [ ] **Step 6: Áp schema lên DB local**

Run: `npx prisma db push`
Expected: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma scripts/ensure-db.mjs tests/vocab-schema.test.ts && git commit -m "feat(tu-vung): them 4 bang cho tinh nang Tu vung moi ngay"
```

---

### Task 2: Danh sách từ học thuật (`lib/vocab-awl.ts`)

**Files:**
- Create: `lib/vocab-awl.ts`
- Test: `tests/vocab-awl.test.ts`

**Interfaces:**
- Consumes: không có
- Produces:
  - `export const AWL_HEADWORDS: readonly string[]`
  - `export function academicRoot(headword: string): string`
  - `export function isAcademicWord(word: string): boolean` — nhận từ chữ thường, trả `true` nếu thuộc họ từ của một headword.

- [ ] **Step 1: Viết test thất bại**

Tạo `tests/vocab-awl.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { AWL_HEADWORDS, academicRoot, isAcademicWord } from "../lib/vocab-awl";

describe("academicRoot", () => {
  it("bỏ 'e' cuối với từ dài hơn 4 chữ", () => {
    expect(academicRoot("create")).toBe("creat");
    expect(academicRoot("analyse")).toBe("analys");
  });

  it("bỏ 't' cuối ở đuôi -ant/-ent để bắt được dạng -ance/-ence", () => {
    expect(academicRoot("significant")).toBe("significan");
    expect(academicRoot("evident")).toBe("eviden");
  });

  it("giữ nguyên từ 4 chữ trở xuống để không khớp bừa", () => {
    expect(academicRoot("role")).toBe("role");
    expect(academicRoot("data")).toBe("data");
  });
});

describe("isAcademicWord", () => {
  it("nhận chính headword", () => {
    expect(isAcademicWord("significant")).toBe(true);
    expect(isAcademicWord("research")).toBe(true);
  });

  it("nhận các dạng biến thể trong cùng họ từ", () => {
    expect(isAcademicWord("created")).toBe(true);
    expect(isAcademicWord("creating")).toBe(true);
    expect(isAcademicWord("analysis")).toBe(true);
    expect(isAcademicWord("significance")).toBe(true);
    expect(isAcademicWord("assumption")).toBe(true);
  });

  it("loại từ thường ngày không thuộc danh sách", () => {
    expect(isAcademicWord("people")).toBe(false);
    expect(isAcademicWord("because")).toBe(false);
    expect(isAcademicWord("water")).toBe(false);
    expect(isAcademicWord("the")).toBe(false);
  });

  it("không khớp khi phần đuôi dài quá 5 chữ (tránh trùng nhầm)", () => {
    // "roll"/"rolling" không được ăn theo headword "role"
    expect(isAcademicWord("rolling")).toBe(false);
  });

  it("danh sách không có phần tử trùng nhau", () => {
    expect(new Set(AWL_HEADWORDS).size).toBe(AWL_HEADWORDS.length);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận nó thất bại**

Run: `npx vitest run tests/vocab-awl.test.ts`
Expected: FAIL — `Failed to resolve import "../lib/vocab-awl"`.

- [ ] **Step 3: Viết `lib/vocab-awl.ts`**

```ts
// Danh sách từ học thuật (Academic Word List) dùng làm tầng lọc chính khi rút từ
// từ đề Listening/Reading. Đang có Sublist 1-2 (120 headword) — đủ dùng nhiều
// tháng ở nhịp 1 từ/ngày. Muốn mở rộng chỉ cần thêm chuỗi vào mảng dưới đây,
// không phải sửa code cũng không phải sửa test.
export const AWL_HEADWORDS: readonly string[] = [
  // Sublist 1
  "analyse", "approach", "area", "assess", "assume", "authority", "available",
  "benefit", "concept", "consist", "constitute", "context", "contract", "create",
  "data", "define", "derive", "distribute", "economy", "environment", "establish",
  "estimate", "evident", "export", "factor", "finance", "formula", "function",
  "identify", "income", "indicate", "individual", "interpret", "involve", "issue",
  "labour", "legal", "legislate", "major", "method", "occur", "percent", "period",
  "policy", "principle", "proceed", "process", "require", "research", "respond",
  "role", "section", "sector", "significant", "similar", "source", "specific",
  "structure", "theory", "vary",
  // Sublist 2
  "achieve", "acquire", "administrate", "affect", "appropriate", "aspect",
  "assist", "category", "chapter", "commission", "community", "complex",
  "compute", "conclude", "conduct", "consequent", "construct", "consume",
  "credit", "culture", "design", "distinct", "element", "equate", "evaluate",
  "feature", "final", "focus", "impact", "injure", "institute", "invest", "item",
  "journal", "maintain", "normal", "obtain", "participate", "perceive",
  "positive", "potential", "previous", "primary", "purchase", "range", "region",
  "regulate", "relevant", "reside", "resource", "restrict", "secure", "seek",
  "select", "site", "strategy", "survey", "text", "tradition", "transfer"
];

// Gốc từ dùng để so khớp cả họ từ.
// - Bỏ "e" cuối để "create" bắt được "creating", "creation"...
// - Bỏ "t" cuối ở đuôi -ant/-ent để "significant" bắt được "significance".
// - Từ ngắn (<= 4 chữ) giữ nguyên, nếu không "role" sẽ thành "rol" và ăn nhầm
//   sang "rolling".
export function academicRoot(headword: string): string {
  const lower = headword.toLowerCase();

  if (lower.length > 4 && lower.endsWith("e")) {
    return lower.slice(0, -1);
  }

  if (lower.length > 5 && (lower.endsWith("ant") || lower.endsWith("ent"))) {
    return lower.slice(0, -1);
  }

  return lower;
}

const ROOTS = AWL_HEADWORDS.map(academicRoot);

// Đuôi dài quá 5 chữ gần như chắc chắn là từ khác, không phải biến thể.
const MAX_SUFFIX_LENGTH = 5;

export function isAcademicWord(word: string): boolean {
  const lower = word.toLowerCase();

  return ROOTS.some(
    (root) =>
      lower.startsWith(root) && lower.length - root.length <= MAX_SUFFIX_LENGTH
  );
}
```

- [ ] **Step 4: Chạy test để xác nhận nó qua**

Run: `npx vitest run tests/vocab-awl.test.ts`
Expected: PASS, 7 test.

- [ ] **Step 5: Commit**

```bash
git add lib/vocab-awl.ts tests/vocab-awl.test.ts && git commit -m "feat(tu-vung): danh sach tu hoc thuat va ham nhan dien ho tu"
```

---

### Task 3: Rút từ ứng viên (`lib/vocab-extract.ts`)

**Files:**
- Create: `lib/vocab-extract.ts`
- Test: `tests/vocab-extract.test.ts`

**Interfaces:**
- Consumes: `isAcademicWord` từ `lib/vocab-awl`
- Produces:
  - `export type VocabCandidate = { word: string; display: string; sentence: string; unitId: string; skill: string }`
  - `export function cleanExamText(raw: string): string`
  - `export function extractCandidates(input: { text: string; skill: string; unitId: string }): VocabCandidate[]`

- [ ] **Step 1: Viết test thất bại**

Tạo `tests/vocab-extract.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { cleanExamText, extractCandidates } from "../lib/vocab-extract";

const run = (text: string) =>
  extractCandidates({ text, skill: "reading", unitId: "unit-1" });

describe("cleanExamText", () => {
  it("bỏ dòng fence ::: và ô trống [[n]]", () => {
    const raw = ":::box\nA cat\n:::\nThe [[3]] policy was approved.";
    expect(cleanExamText(raw)).toBe("A cat\nThe  policy was approved.");
  });
});

describe("extractCandidates", () => {
  it("giữ từ học thuật và kèm câu chứa nó", () => {
    const result = run(
      "The government approved a new policy last year. Everyone was happy about it."
    );
    const policy = result.find((item) => item.word === "policy");
    expect(policy).toBeDefined();
    expect(policy?.sentence).toBe(
      "The government approved a new policy last year."
    );
    expect(policy?.unitId).toBe("unit-1");
    expect(policy?.skill).toBe("reading");
  });

  it("loại từ thường ngày không thuộc danh sách học thuật", () => {
    const words = run("The water was very cold and the people were tired.").map(
      (item) => item.word
    );
    expect(words).not.toContain("water");
    expect(words).not.toContain("people");
  });

  it("loại tên riêng: từ chỉ xuất hiện dạng viết hoa giữa câu", () => {
    // "Major" ở đây là tên người, luôn viết hoa giữa câu.
    const words = run(
      "We met Major yesterday. Later that evening Major left the building."
    ).map((item) => item.word);
    expect(words).not.toContain("major");
  });

  it("giữ từ viết hoa đầu câu nếu chỗ khác có dạng chữ thường", () => {
    const words = run(
      "Policy matters a lot here. The new policy takes effect soon."
    ).map((item) => item.word);
    expect(words).toContain("policy");
  });

  it("mỗi từ chỉ trả về một lần, lấy câu xuất hiện đầu tiên", () => {
    // Cả hai câu đều phải dài hơn 30 ký tự, nếu không câu đầu bị bỏ qua và test
    // đo nhầm câu thứ hai.
    const result = run(
      "The research team was extremely slow last winter. " +
        "Another research group joined the project later on."
    );
    const hits = result.filter((item) => item.word === "research");
    expect(hits).toHaveLength(1);
    expect(hits[0].sentence).toBe(
      "The research team was extremely slow last winter."
    );
  });

  it("bỏ câu ví dụ quá ngắn hoặc quá dài", () => {
    expect(run("Policy.")).toHaveLength(0);
  });

  it("văn bản rỗng trả về mảng rỗng", () => {
    expect(run("")).toEqual([]);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận nó thất bại**

Run: `npx vitest run tests/vocab-extract.test.ts`
Expected: FAIL — `Failed to resolve import "../lib/vocab-extract"`.

- [ ] **Step 3: Viết `lib/vocab-extract.ts`**

```ts
import { isAcademicWord } from "@/lib/vocab-awl";

export type VocabCandidate = {
  word: string; // dạng chuẩn hoá, chữ thường
  display: string; // dạng như trong đề
  sentence: string; // câu đầu tiên chứa từ, nguyên văn
  unitId: string;
  skill: string;
};

// Câu ví dụ quá ngắn thì không dạy được gì, quá dài thì tràn thẻ trên trang chủ.
const MIN_SENTENCE_LENGTH = 30;
const MAX_SENTENCE_LENGTH = 300;

// Đề nhập vào có fence :::box/:::flow... và ô trống [[3]] — đây là cú pháp dựng
// giao diện, không phải nội dung đọc, nên bỏ trước khi tách từ.
export function cleanExamText(raw: string): string {
  return raw
    .split("\n")
    .filter((line) => !line.trimStart().startsWith(":::"))
    .join("\n")
    .replace(/\[\[\d+\]\]/g, "");
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.replace(/\s+/g, " ").trim())
    .filter((sentence) => sentence.length > 0);
}

export function extractCandidates(input: {
  text: string;
  skill: string;
  unitId: string;
}): VocabCandidate[] {
  const sentences = splitSentences(cleanExamText(input.text));

  // Lượt 1: đếm xem mỗi từ từng xuất hiện ở dạng chữ thường hay chưa, để nhận
  // diện tên riêng (từ LUÔN viết hoa giữa câu).
  const seenLowercase = new Set<string>();
  const seenCapitalMidSentence = new Set<string>();

  for (const sentence of sentences) {
    const tokens = sentence.match(/[A-Za-z]+/g) ?? [];

    tokens.forEach((token, index) => {
      const lower = token.toLowerCase();
      const isCapitalised = token[0] === token[0].toUpperCase();

      if (!isCapitalised) {
        seenLowercase.add(lower);
        return;
      }

      if (index > 0) {
        seenCapitalMidSentence.add(lower);
      }
    });
  }

  // Lượt 2: gom ứng viên, mỗi từ lấy câu xuất hiện đầu tiên.
  const found = new Map<string, VocabCandidate>();

  for (const sentence of sentences) {
    if (
      sentence.length < MIN_SENTENCE_LENGTH ||
      sentence.length > MAX_SENTENCE_LENGTH
    ) {
      continue;
    }

    for (const token of sentence.match(/[A-Za-z]+/g) ?? []) {
      const lower = token.toLowerCase();

      if (found.has(lower) || lower.length < 4) {
        continue;
      }

      if (!isAcademicWord(lower)) {
        continue;
      }

      // Tên riêng: viết hoa giữa câu và không bao giờ xuất hiện dạng chữ thường.
      if (seenCapitalMidSentence.has(lower) && !seenLowercase.has(lower)) {
        continue;
      }

      found.set(lower, {
        word: lower,
        display: lower,
        sentence,
        unitId: input.unitId,
        skill: input.skill
      });
    }
  }

  return [...found.values()];
}
```

- [ ] **Step 4: Chạy test để xác nhận nó qua**

Run: `npx vitest run tests/vocab-extract.test.ts`
Expected: PASS, 8 test.

- [ ] **Step 5: Commit**

```bash
git add lib/vocab-extract.ts tests/vocab-extract.test.ts && git commit -m "feat(tu-vung): rut tu ung vien va cau vi du tu de"
```

---

### Task 4: Ngày VN + chọn từ (`lib/vocab-day.ts`)

**Files:**
- Create: `lib/vocab-day.ts`
- Test: `tests/vocab-day.test.ts`

**Interfaces:**
- Consumes: không có
- Produces:
  - `export function vietnamDateKey(now: Date): string` — `"2026-08-11"`
  - `export function vietnamDayNumber(now: Date): number` — số ngày kể từ 1970-01-01 theo giờ VN
  - `export function pickNextWord(input: { candidates: string[]; usedIds: string[]; dayNumber: number }): string | null`

- [ ] **Step 1: Viết test thất bại**

Tạo `tests/vocab-day.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { pickNextWord, vietnamDateKey, vietnamDayNumber } from "../lib/vocab-day";

describe("vietnamDateKey", () => {
  it("trả về ngày theo giờ VN", () => {
    expect(vietnamDateKey(new Date("2026-08-11T10:00:00+07:00"))).toBe("2026-08-11");
  });

  it("23h30 giờ VN vẫn là ngày hôm đó dù UTC đã lùi sang hôm trước", () => {
    // 23:30 ngày 11/08 giờ VN == 16:30 ngày 11/08 UTC
    expect(vietnamDateKey(new Date("2026-08-11T16:30:00Z"))).toBe("2026-08-11");
  });

  it("00h30 giờ VN đã sang ngày mới dù UTC còn là hôm trước", () => {
    // 00:30 ngày 12/08 giờ VN == 17:30 ngày 11/08 UTC
    expect(vietnamDateKey(new Date("2026-08-11T17:30:00Z"))).toBe("2026-08-12");
  });
});

describe("vietnamDayNumber", () => {
  it("hai thời điểm cùng ngày VN cho cùng số", () => {
    const a = new Date("2026-08-11T00:30:00+07:00");
    const b = new Date("2026-08-11T23:30:00+07:00");
    expect(vietnamDayNumber(a)).toBe(vietnamDayNumber(b));
  });

  it("ngày kế tiếp tăng đúng 1", () => {
    const a = new Date("2026-08-11T10:00:00+07:00");
    const b = new Date("2026-08-12T10:00:00+07:00");
    expect(vietnamDayNumber(b) - vietnamDayNumber(a)).toBe(1);
  });
});

describe("pickNextWord", () => {
  it("kho rỗng trả về null", () => {
    expect(pickNextWord({ candidates: [], usedIds: [], dayNumber: 5 })).toBeNull();
  });

  it("chỉ chọn trong các từ chưa dùng", () => {
    const picked = pickNextWord({
      candidates: ["a", "b", "c"],
      usedIds: ["a", "c"],
      dayNumber: 7
    });
    expect(picked).toBe("b");
  });

  it("cùng dayNumber luôn cho cùng kết quả", () => {
    const input = { candidates: ["a", "b", "c"], usedIds: [], dayNumber: 4 };
    expect(pickNextWord(input)).toBe(pickNextWord(input));
  });

  it("dùng hết vòng thì xoay lại chứ không trả null", () => {
    const picked = pickNextWord({
      candidates: ["a", "b", "c"],
      usedIds: ["a", "b", "c"],
      dayNumber: 4
    });
    expect(["a", "b", "c"]).toContain(picked);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận nó thất bại**

Run: `npx vitest run tests/vocab-day.test.ts`
Expected: FAIL — `Failed to resolve import "../lib/vocab-day"`.

- [ ] **Step 3: Viết `lib/vocab-day.ts`**

```ts
const VN_OFFSET_MS = 7 * 60 * 60 * 1000; // VN = UTC+7 (không có DST)
const DAY_MS = 24 * 60 * 60 * 1000;

// Cộng offset +7h rồi đọc theo UTC — đây là mẹo cũ trong lib/streak.ts, tránh
// phụ thuộc timezone của máy chủ.
function shiftToVietnam(now: Date): Date {
  return new Date(now.getTime() + VN_OFFSET_MS);
}

export function vietnamDateKey(now: Date): string {
  const shifted = shiftToVietnam(now);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function vietnamDayNumber(now: Date): number {
  const shifted = shiftToVietnam(now);
  const midnight = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate()
  );

  return Math.floor(midnight / DAY_MS);
}

// Chọn từ cho hôm nay: ưu tiên từ chưa từng phát. Hết vòng thì xoay lại từ đầu
// thay vì để trang trống.
export function pickNextWord(input: {
  candidates: string[];
  usedIds: string[];
  dayNumber: number;
}): string | null {
  if (input.candidates.length === 0) {
    return null;
  }

  const used = new Set(input.usedIds);
  const unused = input.candidates.filter((id) => !used.has(id));
  const pool = unused.length > 0 ? unused : input.candidates;
  const index = ((input.dayNumber % pool.length) + pool.length) % pool.length;

  return pool[index];
}
```

- [ ] **Step 4: Chạy test để xác nhận nó qua**

Run: `npx vitest run tests/vocab-day.test.ts`
Expected: PASS, 9 test.

- [ ] **Step 5: Commit**

```bash
git add lib/vocab-day.ts tests/vocab-day.test.ts && git commit -m "feat(tu-vung): tinh ngay theo gio VN va chon tu cua ngay"
```

---

### Task 5: Dựng quiz (`lib/vocab-quiz.ts`)

**Files:**
- Create: `lib/vocab-quiz.ts`
- Test: `tests/vocab-quiz.test.ts`

**Interfaces:**
- Consumes: không có
- Produces:
  - `export type QuizWord = { id: string; display: string; meaningVi: string }`
  - `export type ProgressRow = { wordId: string; correctCount: number; wrongCount: number; lastAnswerAt: Date | null }`
  - `export type QuizQuestion = { wordId: string; display: string; options: string[]; correctIndex: number }`
  - `export const QUIZ_SIZE = 5`
  - `export const MIN_POOL_FOR_QUIZ = 4`
  - `export function buildQuiz(input: { pool: QuizWord[]; progress: ProgressRow[]; count: number; seed: number }): QuizQuestion[]`

- [ ] **Step 1: Viết test thất bại**

Tạo `tests/vocab-quiz.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildQuiz, type ProgressRow, type QuizWord } from "../lib/vocab-quiz";

const pool: QuizWord[] = [
  { id: "w1", display: "policy", meaningVi: "chính sách" },
  { id: "w2", display: "research", meaningVi: "nghiên cứu" },
  { id: "w3", display: "impact", meaningVi: "tác động" },
  { id: "w4", display: "region", meaningVi: "khu vực" },
  { id: "w5", display: "resource", meaningVi: "tài nguyên" },
  { id: "w6", display: "strategy", meaningVi: "chiến lược" }
];

const build = (progress: ProgressRow[] = [], seed = 0, count = 3) =>
  buildQuiz({ pool, progress, count, seed });

describe("buildQuiz", () => {
  it("kho dưới 4 từ thì không dựng được quiz", () => {
    expect(
      buildQuiz({ pool: pool.slice(0, 3), progress: [], count: 3, seed: 0 })
    ).toEqual([]);
  });

  it("trả về đúng số câu yêu cầu", () => {
    expect(build()).toHaveLength(3);
  });

  it("mỗi câu có 4 lựa chọn và không lựa chọn nào trùng nhau", () => {
    for (const question of build()) {
      expect(question.options).toHaveLength(4);
      expect(new Set(question.options).size).toBe(4);
    }
  });

  it("đáp án đúng luôn nằm ở correctIndex", () => {
    for (const question of build()) {
      const word = pool.find((item) => item.id === question.wordId);
      expect(question.options[question.correctIndex]).toBe(word?.meaningVi);
    }
  });

  it("không lặp từ trong cùng một lượt", () => {
    const ids = build().map((question) => question.wordId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("ưu tiên từ sai nhiều nhất", () => {
    const progress: ProgressRow[] = [
      { wordId: "w5", correctCount: 0, wrongCount: 9, lastAnswerAt: new Date() }
    ];
    const ids = buildQuiz({ pool, progress, count: 1, seed: 0 }).map(
      (question) => question.wordId
    );
    expect(ids).toContain("w5");
  });

  it("cùng sai bằng nhau thì ưu tiên từ lâu chưa ôn", () => {
    // Mọi từ trong rổ đều phải có tiến độ, nếu không từ "chưa ôn lần nào" sẽ
    // được xếp trước và test đo nhầm.
    const at = (iso: string) => new Date(iso);
    const progress: ProgressRow[] = [
      { wordId: "w1", correctCount: 1, wrongCount: 0, lastAnswerAt: at("2026-08-10T00:00:00Z") },
      { wordId: "w2", correctCount: 1, wrongCount: 0, lastAnswerAt: at("2026-01-01T00:00:00Z") },
      { wordId: "w3", correctCount: 1, wrongCount: 0, lastAnswerAt: at("2026-08-09T00:00:00Z") },
      { wordId: "w4", correctCount: 1, wrongCount: 0, lastAnswerAt: at("2026-08-08T00:00:00Z") }
    ];
    const first = buildQuiz({
      pool: pool.slice(0, 4),
      progress,
      count: 1,
      seed: 0
    })[0];
    expect(first.wordId).toBe("w2");
  });

  it("từ chưa ôn lần nào được ưu tiên trước từ vừa ôn hôm qua", () => {
    const progress: ProgressRow[] = [
      {
        wordId: "w1",
        correctCount: 1,
        wrongCount: 0,
        lastAnswerAt: new Date("2026-08-10T00:00:00Z")
      }
    ];
    const ids = buildQuiz({ pool: pool.slice(0, 4), progress, count: 3, seed: 0 }).map(
      (question) => question.wordId
    );
    expect(ids).not.toContain("w1");
  });

  it("cùng seed cho kết quả giống hệt nhau", () => {
    expect(build([], 3)).toEqual(build([], 3));
  });

  it("đổi seed thì bốc bộ từ khác", () => {
    const a = build([], 0).map((question) => question.wordId).join(",");
    const b = build([], 1).map((question) => question.wordId).join(",");
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận nó thất bại**

Run: `npx vitest run tests/vocab-quiz.test.ts`
Expected: FAIL — `Failed to resolve import "../lib/vocab-quiz"`.

- [ ] **Step 3: Viết `lib/vocab-quiz.ts`**

```ts
export type QuizWord = {
  id: string;
  display: string;
  meaningVi: string;
};

export type ProgressRow = {
  wordId: string;
  correctCount: number;
  wrongCount: number;
  lastAnswerAt: Date | null;
};

export type QuizQuestion = {
  wordId: string;
  display: string;
  options: string[];
  correctIndex: number;
};

export const QUIZ_SIZE = 5;

// Cần 1 đáp án đúng + 3 đáp án nhiễu.
export const MIN_POOL_FOR_QUIZ = 4;

// Lấy sẵn một rổ rộng gấp 3 số câu rồi mới xoay theo seed: vừa giữ được ưu tiên
// "sai nhiều / lâu chưa ôn", vừa cho mỗi lượt làm lại bốc bộ từ khác.
const HOT_POOL_FACTOR = 3;

function rotate<T>(items: T[], offset: number): T[] {
  if (items.length === 0) {
    return items;
  }

  const shift = ((offset % items.length) + items.length) % items.length;

  return [...items.slice(shift), ...items.slice(0, shift)];
}

function priorityOf(word: QuizWord, progress: Map<string, ProgressRow>) {
  const row = progress.get(word.id);

  return {
    wrongCount: row?.wrongCount ?? 0,
    // Chưa ôn lần nào coi như ôn từ rất lâu rồi.
    lastAnswerAt: row?.lastAnswerAt?.getTime() ?? Number.NEGATIVE_INFINITY
  };
}

export function buildQuiz(input: {
  pool: QuizWord[];
  progress: ProgressRow[];
  count: number;
  seed: number;
}): QuizQuestion[] {
  if (input.pool.length < MIN_POOL_FOR_QUIZ || input.count <= 0) {
    return [];
  }

  const progress = new Map(input.progress.map((row) => [row.wordId, row]));

  const ranked = [...input.pool].sort((left, right) => {
    const a = priorityOf(left, progress);
    const b = priorityOf(right, progress);

    if (a.wrongCount !== b.wrongCount) {
      return b.wrongCount - a.wrongCount;
    }

    if (a.lastAnswerAt !== b.lastAnswerAt) {
      return a.lastAnswerAt - b.lastAnswerAt;
    }

    return left.id.localeCompare(right.id);
  });

  const hotPool = ranked.slice(0, Math.max(input.count, input.count * HOT_POOL_FACTOR));
  const selected = rotate(hotPool, input.seed).slice(0, input.count);

  return selected.map((word, questionIndex) => {
    const others = input.pool.filter(
      (item) => item.id !== word.id && item.meaningVi !== word.meaningVi
    );

    const distractors: string[] = [];
    const step = input.seed + questionIndex + 1;

    for (let offset = 0; offset < others.length && distractors.length < 3; offset += 1) {
      const candidate = others[(step * (offset + 1)) % others.length];

      if (!distractors.includes(candidate.meaningVi)) {
        distractors.push(candidate.meaningVi);
      }
    }

    // Rổ nhiễu vẫn thiếu (nhiều từ trùng nghĩa) thì vét nốt theo thứ tự.
    for (const other of others) {
      if (distractors.length >= 3) {
        break;
      }

      if (!distractors.includes(other.meaningVi)) {
        distractors.push(other.meaningVi);
      }
    }

    const correctIndex = (input.seed + questionIndex) % 4;
    const options = [...distractors];
    options.splice(correctIndex, 0, word.meaningVi);

    return {
      wordId: word.id,
      display: word.display,
      options,
      correctIndex
    };
  });
}
```

- [ ] **Step 4: Chạy test để xác nhận nó qua**

Run: `npx vitest run tests/vocab-quiz.test.ts`
Expected: PASS, 10 test.

- [ ] **Step 5: Commit**

```bash
git add lib/vocab-quiz.ts tests/vocab-quiz.test.ts && git commit -m "feat(tu-vung): dung quiz on tap va sinh dap an nhieu"
```

---

### Task 6: Chuỗi ngày ôn từ (`lib/vocab-streak.ts`)

**Files:**
- Create: `lib/vocab-streak.ts`
- Test: `tests/vocab-streak.test.ts`

**Interfaces:**
- Consumes: không có
- Produces: `export function calculateVocabStreak(input: { days: string[]; today: string }): { days: number; activeToday: boolean }`

- [ ] **Step 1: Viết test thất bại**

Tạo `tests/vocab-streak.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { calculateVocabStreak } from "../lib/vocab-streak";

const today = "2026-08-11";

describe("calculateVocabStreak", () => {
  it("chưa làm ngày nào thì chuỗi bằng 0", () => {
    expect(calculateVocabStreak({ days: [], today })).toEqual({
      days: 0,
      activeToday: false
    });
  });

  it("đếm các ngày liên tiếp tính từ hôm nay", () => {
    const result = calculateVocabStreak({
      days: ["2026-08-11", "2026-08-10", "2026-08-09"],
      today
    });
    expect(result).toEqual({ days: 3, activeToday: true });
  });

  it("hôm nay chưa làm nhưng hôm qua có thì chuỗi vẫn giữ", () => {
    const result = calculateVocabStreak({
      days: ["2026-08-10", "2026-08-09"],
      today
    });
    expect(result).toEqual({ days: 2, activeToday: false });
  });

  it("nghỉ một ngày thì chuỗi đứt", () => {
    const result = calculateVocabStreak({
      days: ["2026-08-09", "2026-08-08"],
      today
    });
    expect(result).toEqual({ days: 0, activeToday: false });
  });

  it("ngày trùng nhau chỉ tính một lần", () => {
    const result = calculateVocabStreak({
      days: ["2026-08-11", "2026-08-11", "2026-08-10"],
      today
    });
    expect(result.days).toBe(2);
  });

  it("không phụ thuộc thứ tự mảng đầu vào", () => {
    const result = calculateVocabStreak({
      days: ["2026-08-09", "2026-08-11", "2026-08-10"],
      today
    });
    expect(result.days).toBe(3);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận nó thất bại**

Run: `npx vitest run tests/vocab-streak.test.ts`
Expected: FAIL — `Failed to resolve import "../lib/vocab-streak"`.

- [ ] **Step 3: Viết `lib/vocab-streak.ts`**

```ts
const DAY_MS = 24 * 60 * 60 * 1000;

// Khoá ngày dạng "YYYY-MM-DD" (giờ VN, do lib/vocab-day.ts sinh ra).
function shiftKey(key: string, deltaDays: number): string {
  const [year, month, day] = key.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day) + deltaDays * DAY_MS);

  return [
    shifted.getUTCFullYear(),
    String(shifted.getUTCMonth() + 1).padStart(2, "0"),
    String(shifted.getUTCDate()).padStart(2, "0")
  ].join("-");
}

// Chuỗi = số ngày liên tiếp có làm quiz. Hôm nay chưa làm thì KHÔNG tính đứt —
// vẫn còn cả ngày để làm (giống grace của chuỗi tuần trong lib/streak.ts).
export function calculateVocabStreak(input: {
  days: string[];
  today: string;
}): { days: number; activeToday: boolean } {
  const done = new Set(input.days);
  const activeToday = done.has(input.today);

  let cursor = activeToday ? input.today : shiftKey(input.today, -1);
  let streak = 0;

  while (done.has(cursor)) {
    streak += 1;
    cursor = shiftKey(cursor, -1);
  }

  return { days: streak, activeToday };
}
```

- [ ] **Step 4: Chạy test để xác nhận nó qua**

Run: `npx vitest run tests/vocab-streak.test.ts`
Expected: PASS, 6 test.

- [ ] **Step 5: Chạy toàn bộ test để chắc chưa làm hỏng gì**

Run: `pnpm test`
Expected: PASS toàn bộ, gồm cả các file test cũ.

- [ ] **Step 6: Commit**

```bash
git add lib/vocab-streak.ts tests/vocab-streak.test.ts && git commit -m "feat(tu-vung): dem chuoi ngay on tu"
```

---

### Task 7: Script rút từ + gọi Claude API

**Files:**
- Create: `scripts/vocab-extract.ts`
- Modify: `package.json` (thêm `@anthropic-ai/sdk` vào `devDependencies`)

**Interfaces:**
- Consumes: `extractCandidates`, `cleanExamText` từ `lib/vocab-extract`
- Produces: dữ liệu trong bảng `VocabWord`. Không export gì cho code khác.

- [ ] **Step 1: Cài SDK**

Run: `pnpm add -D @anthropic-ai/sdk`
Expected: `package.json` có `"@anthropic-ai/sdk"` trong `devDependencies`.

- [ ] **Step 2: Viết `scripts/vocab-extract.ts`**

```ts
// Quét transcript Listening + passage Reading đang có trong DB, lọc ra từ học
// thuật, gọi Claude API điền nghĩa/phiên âm rồi ghi vào bảng VocabWord.
//
// Chạy lại được nhiều lần: từ đã có trong DB sẽ bị bỏ qua, nên đứt mạng giữa
// chừng chỉ cần chạy lại.
//
//   npx tsx scripts/vocab-extract.ts --dry-run
//   npx tsx scripts/vocab-extract.ts
//   DATABASE_URL=$DATABASE_URL_PROD npx tsx scripts/vocab-extract.ts
import Anthropic from "@anthropic-ai/sdk";
import { PrismaClient } from "@prisma/client";
import { warmUpDatabase } from "../lib/db-warmup";
import { extractCandidates, type VocabCandidate } from "../lib/vocab-extract";

const BATCH_SIZE = 50;
const MODEL = "claude-opus-5";

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");

type Filled = {
  word: string;
  phonetic: string;
  partOfSpeech: string;
  meaningVi: string;
  definitionEn: string;
};

// Structured output: bắt Claude trả đúng khuôn này, khỏi phải vá lỗi parse.
const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    words: {
      type: "array",
      items: {
        type: "object",
        properties: {
          word: { type: "string" },
          phonetic: { type: "string" },
          partOfSpeech: {
            type: "string",
            enum: ["noun", "verb", "adjective", "adverb"]
          },
          meaningVi: { type: "string" },
          definitionEn: { type: "string" }
        },
        required: ["word", "phonetic", "partOfSpeech", "meaningVi", "definitionEn"],
        additionalProperties: false
      }
    }
  },
  required: ["words"],
  additionalProperties: false
} as const;

async function fillMeanings(
  client: Anthropic,
  batch: VocabCandidate[]
): Promise<Filled[]> {
  const listing = batch
    .map((item) => `- ${item.word} — trong câu: "${item.sentence}"`)
    .join("\n");

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: RESPONSE_SCHEMA }
    },
    system:
      "Bạn giúp một giáo viên IELTS người Việt soạn từ điển cho học viên. " +
      "Với mỗi từ, đưa nghĩa tiếng Việt ngắn gọn ĐÚNG VỚI NGỮ CẢNH của câu ví dụ " +
      "được cung cấp, phiên âm IPA (kèm hai dấu gạch chéo), loại từ, và một định " +
      "nghĩa tiếng Anh ngắn. Giữ nguyên chính tả của từ trong trường word.",
    messages: [
      {
        role: "user",
        content: `Điền thông tin cho ${batch.length} từ sau:\n\n${listing}`
      }
    ]
  });

  const text = response.content.find((block) => block.type === "text");

  if (!text || text.type !== "text") {
    throw new Error("Claude không trả về nội dung văn bản.");
  }

  return (JSON.parse(text.text) as { words: Filled[] }).words;
}

async function main() {
  // Neon ngủ khi vắng người dùng — đánh thức trước, nếu không truy vấn đầu tiên
  // hay chết vì chưa kết nối kịp (xem lib/db-warmup.ts).
  const attempts = await warmUpDatabase(() => prisma.$queryRaw`SELECT 1`);

  if (attempts > 1) {
    console.warn(`DB tỉnh sau ${attempts} lần thử.`);
  }

  const units = await prisma.assignableUnit.findMany({
    where: { skill: { in: ["listening", "reading"] } },
    select: { id: true, skill: true, content: true, transcript: true }
  });

  console.log(`Đọc ${units.length} phần đề.`);

  const candidates = new Map<string, VocabCandidate>();

  for (const unit of units) {
    const text = unit.skill === "listening" ? unit.transcript : unit.content;

    if (!text) {
      continue;
    }

    for (const candidate of extractCandidates({
      text,
      skill: unit.skill,
      unitId: unit.id
    })) {
      if (!candidates.has(candidate.word)) {
        candidates.set(candidate.word, candidate);
      }
    }
  }

  const existing = await prisma.vocabWord.findMany({ select: { word: true } });
  const known = new Set(existing.map((row) => row.word));
  const todo = [...candidates.values()].filter((item) => !known.has(item.word));

  console.log(
    `Lọc được ${candidates.size} từ, trong đó ${todo.length} từ chưa có trong DB.`
  );

  if (dryRun) {
    console.log(todo.slice(0, 30).map((item) => item.word).join(", "));
    return;
  }

  if (todo.length === 0) {
    return;
  }

  const client = new Anthropic();
  let saved = 0;

  for (let start = 0; start < todo.length; start += BATCH_SIZE) {
    const batch = todo.slice(start, start + BATCH_SIZE);
    const bySource = new Map(batch.map((item) => [item.word, item]));

    let filled: Filled[];

    try {
      filled = await fillMeanings(client, batch);
    } catch (error) {
      // Một lô hỏng không được làm chết cả lượt chạy — bỏ qua, lần chạy sau sẽ
      // nhặt lại vì các từ này vẫn chưa có trong DB.
      console.error(`Lô bắt đầu từ ${start} lỗi, bỏ qua:`, error);
      continue;
    }

    for (const item of filled) {
      const source = bySource.get(item.word.toLowerCase());

      if (!source) {
        console.warn(`Bỏ qua "${item.word}": không khớp từ nào đã gửi đi.`);
        continue;
      }

      await prisma.vocabWord.upsert({
        where: { word: source.word },
        update: {},
        create: {
          word: source.word,
          display: item.word,
          phonetic: item.phonetic,
          partOfSpeech: item.partOfSpeech,
          meaningVi: item.meaningVi,
          definitionEn: item.definitionEn,
          exampleEn: source.sentence,
          sourceUnitId: source.unitId,
          sourceSkill: source.skill
        }
      });

      saved += 1;
    }

    console.log(`Đã lưu ${saved}/${todo.length} từ.`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 3: Chạy thử chế độ khô trên DB local**

Run: `npx tsx scripts/vocab-extract.ts --dry-run`
Expected: in ra `Đọc N phần đề.`, `Lọc được X từ, trong đó Y từ chưa có trong DB.` và một danh sách từ. Không ghi gì vào DB, không gọi Claude API.

Nếu số từ lọc được bằng 0: kiểm tra DB local có dữ liệu đề chưa (`npx prisma studio`), vì `--dry-run` chỉ đọc chứ không tạo dữ liệu.

- [ ] **Step 4: Chạy thật trên DB local**

Run: `npx tsx scripts/vocab-extract.ts`
Expected: in tiến độ `Đã lưu .../...` và kết thúc không lỗi. Cần `ANTHROPIC_API_KEY` trong môi trường.

- [ ] **Step 5: Kiểm tra dữ liệu đã vào DB**

Run: `npx tsx -e "import{PrismaClient}from'@prisma/client';const p=new PrismaClient();p.vocabWord.findMany({take:5}).then(r=>{console.log(r);return p.\$disconnect()})"`
Expected: in ra 5 bản ghi có đủ `word`, `phonetic`, `meaningVi`, `exampleEn`.

- [ ] **Step 6: Commit**

```bash
git add scripts/vocab-extract.ts package.json pnpm-lock.yaml && git commit -m "feat(tu-vung): script rut tu tu de va dien nghia bang Claude API"
```

---

### Task 8: Thẻ từ vựng trên trang chủ học viên

**Files:**
- Create: `lib/vocab-daily.ts`
- Create: `components/vocab-card.tsx`
- Modify: `app/student/page.tsx`

**Interfaces:**
- Consumes: `vietnamDateKey`, `vietnamDayNumber`, `pickNextWord` (`lib/vocab-day`); `calculateVocabStreak` (`lib/vocab-streak`)
- Produces:
  - `export type DailyWord = { id: string; display: string; phonetic: string | null; partOfSpeech: string | null; meaningVi: string; exampleEn: string; sourceUnitId: string | null }`
  - `export function dateKeyToUtcDate(key: string): Date`
  - `export async function getWordOfTheDay(now?: Date): Promise<DailyWord | null>`
  - `export async function getVocabSidebar(studentId: string, now?: Date): Promise<{ streakDays: number; learnedCount: number; canQuiz: boolean }>`

- [ ] **Step 1: Viết `lib/vocab-daily.ts`**

```ts
import { prisma } from "@/lib/prisma";
import { pickNextWord, vietnamDateKey, vietnamDayNumber } from "@/lib/vocab-day";
import { calculateVocabStreak } from "@/lib/vocab-streak";
import { MIN_POOL_FOR_QUIZ } from "@/lib/vocab-quiz";

export type DailyWord = {
  id: string;
  display: string;
  phonetic: string | null;
  partOfSpeech: string | null;
  meaningVi: string;
  exampleEn: string;
  sourceUnitId: string | null;
};

// Cột date kiểu DATE — quy ước lưu bằng nửa đêm UTC của đúng ngày VN đó.
export function dateKeyToUtcDate(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

const WORD_FIELDS = {
  id: true,
  display: true,
  phonetic: true,
  partOfSpeech: true,
  meaningVi: true,
  exampleEn: true,
  sourceUnitId: true
} as const;

export async function getWordOfTheDay(now = new Date()): Promise<DailyWord | null> {
  const key = vietnamDateKey(now);
  const date = dateKeyToUtcDate(key);

  const today = await prisma.vocabDaily.findUnique({
    where: { date },
    select: { word: { select: WORD_FIELDS } }
  });

  if (today) {
    return today.word;
  }

  const [pool, used] = await Promise.all([
    prisma.vocabWord.findMany({
      where: { hidden: false },
      orderBy: { id: "asc" },
      select: { id: true }
    }),
    prisma.vocabDaily.findMany({ select: { wordId: true } })
  ]);

  const wordId = pickNextWord({
    candidates: pool.map((row) => row.id),
    usedIds: used.map((row) => row.wordId),
    dayNumber: vietnamDayNumber(now)
  });

  if (!wordId) {
    return null;
  }

  try {
    const created = await prisma.vocabDaily.create({
      data: { date, wordId },
      select: { word: { select: WORD_FIELDS } }
    });

    return created.word;
  } catch {
    // Hai người vào cùng lúc: người thua dính lỗi trùng khoá P2002 — đọc lại
    // bản ghi của người thắng thay vì báo lỗi ra màn hình.
    const existing = await prisma.vocabDaily.findUnique({
      where: { date },
      select: { word: { select: WORD_FIELDS } }
    });

    return existing?.word ?? null;
  }
}

export async function getVocabSidebar(studentId: string, now = new Date()) {
  const [quizDays, learnedCount, poolCount] = await Promise.all([
    prisma.vocabQuizDay.findMany({
      where: { studentId },
      select: { date: true }
    }),
    prisma.vocabProgress.count({ where: { studentId } }),
    prisma.vocabWord.count({ where: { hidden: false } })
  ]);

  const streak = calculateVocabStreak({
    days: quizDays.map((row) => row.date.toISOString().slice(0, 10)),
    today: vietnamDateKey(now)
  });

  return {
    streakDays: streak.days,
    learnedCount,
    canQuiz: poolCount >= MIN_POOL_FOR_QUIZ
  };
}
```

- [ ] **Step 2: Viết `components/vocab-card.tsx`**

```tsx
import Link from "next/link";
import type { DailyWord } from "@/lib/vocab-daily";

export function VocabCard({
  word,
  streakDays,
  canQuiz
}: {
  word: DailyWord | null;
  streakDays: number;
  canQuiz: boolean;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold">Từ vựng hôm nay</h3>
        {streakDays > 0 ? (
          <span className="rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-600 dark:text-amber-300">
            🔥 chuỗi {streakDays} ngày
          </span>
        ) : null}
      </div>

      {word ? (
        <>
          <p className="mt-3 flex flex-wrap items-baseline gap-2">
            <span className="text-xl font-bold tracking-tight">{word.display}</span>
            {word.phonetic ? (
              <span className="text-sm text-muted-foreground">{word.phonetic}</span>
            ) : null}
            {word.partOfSpeech ? (
              <span className="text-sm italic text-muted-foreground">
                ({word.partOfSpeech})
              </span>
            ) : null}
          </p>
          <p className="mt-1 text-sm font-medium">{word.meaningVi}</p>
          <p className="mt-3 border-l-2 border-border pl-3 text-sm italic leading-6 text-muted-foreground">
            “{word.exampleEn}”
          </p>
          {canQuiz ? (
            <Link
              href="/student/vocab"
              className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-card transition hover:bg-primary/90"
            >
              Ôn 5 từ cũ →
            </Link>
          ) : null}
        </>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          Chưa có từ nào. Cô sẽ bổ sung kho từ vựng sớm nhé.
        </p>
      )}
    </section>
  );
}
```

- [ ] **Step 3: Chèn thẻ vào `app/student/page.tsx`**

Thêm import ở đầu file:

```tsx
import { VocabCard } from "@/components/vocab-card";
import { getVocabSidebar, getWordOfTheDay } from "@/lib/vocab-daily";
```

Sửa lời gọi `Promise.all` đang có (khối `const [recipients, attempts, membership] = await Promise.all([...])`) thành dạng lấy thêm hai giá trị — đổi dòng khai báo và thêm hai phần tử vào cuối mảng:

```tsx
  const [recipients, attempts, membership, wordOfDay, vocabSidebar] =
    await Promise.all([
      // ...ba truy vấn cũ giữ nguyên...
      getWordOfTheDay(),
      getVocabSidebar(student.id)
    ]);
```

Rồi chèn thẻ ngay dưới khối `<div className="grid gap-3 sm:grid-cols-2">...</div>` và trên `<ProgressRing ... />`:

```tsx
      <VocabCard
        word={wordOfDay}
        streakDays={vocabSidebar.streakDays}
        canQuiz={vocabSidebar.canQuiz}
      />
```

- [ ] **Step 4: Kiểm tra kiểu và lint**

Run: `npx tsc --noEmit`
Expected: không lỗi.

Run: `pnpm lint`
Expected: `No ESLint warnings or errors`.

- [ ] **Step 5: Xem thật trên trình duyệt**

Mở preview bằng công cụ `preview_start` (dev server `pnpm dev`), đăng nhập tài khoản học viên (`student@example.com`), mở `/student`.
Expected: thấy thẻ "Từ vựng hôm nay" có từ, phiên âm, nghĩa Việt và câu ví dụ. Nếu kho từ rỗng thì thấy dòng "Chưa có từ nào."

Kiểm tra bản ghi đã được ghi sổ:

Run: `npx tsx -e "import{PrismaClient}from'@prisma/client';const p=new PrismaClient();p.vocabDaily.findMany().then(r=>{console.log(r);return p.\$disconnect()})"`
Expected: đúng **một** bản ghi cho ngày hôm nay.

- [ ] **Step 6: Commit**

```bash
git add lib/vocab-daily.ts components/vocab-card.tsx app/student/page.tsx && git commit -m "feat(tu-vung): the tu vung hom nay tren trang chu hoc vien"
```

---

### Task 9: Trang quiz học viên

**Files:**
- Create: `lib/actions/vocab.ts`
- Create: `components/vocab-quiz-form.tsx`
- Create: `app/student/vocab/page.tsx`
- Modify: `components/app-shell.tsx`

**Interfaces:**
- Consumes: `buildQuiz`, `QUIZ_SIZE`, `MIN_POOL_FOR_QUIZ` (`lib/vocab-quiz`); `vietnamDateKey` (`lib/vocab-day`); `dateKeyToUtcDate` (`lib/vocab-daily`); `requireStudent` (`lib/actions/attempts`); `actionOk`, `actionFail` (`lib/action-result`); `ActionForm` (`components/action-form`)
- Produces: `export async function submitVocabQuiz(formData: FormData): Promise<ActionResult>`

- [ ] **Step 1: Viết `lib/actions/vocab.ts` (phần học viên)**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStudent } from "@/lib/actions/attempts";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { prisma } from "@/lib/prisma";
import { vietnamDateKey } from "@/lib/vocab-day";
import { dateKeyToUtcDate } from "@/lib/vocab-daily";

const submitSchema = z.object({
  answers: z
    .array(
      z.object({
        wordId: z.string().min(1),
        chosen: z.string().min(1)
      })
    )
    .min(1)
    .max(20)
});

export async function submitVocabQuiz(formData: FormData): Promise<ActionResult> {
  try {
    const student = await requireStudent();
    const parsed = submitSchema.parse(
      JSON.parse(String(formData.get("answersJson") ?? "{}"))
    );

    // Không tin điểm client gửi lên — chấm lại bằng nghĩa lưu trong DB.
    const words = await prisma.vocabWord.findMany({
      where: { id: { in: parsed.answers.map((item) => item.wordId) } },
      select: { id: true, meaningVi: true }
    });

    const meanings = new Map(words.map((word) => [word.id, word.meaningVi]));
    let correct = 0;

    for (const answer of parsed.answers) {
      const expected = meanings.get(answer.wordId);

      if (!expected) {
        continue;
      }

      const isCorrect = expected === answer.chosen;

      if (isCorrect) {
        correct += 1;
      }

      await prisma.vocabProgress.upsert({
        where: {
          studentId_wordId: { studentId: student.id, wordId: answer.wordId }
        },
        update: {
          correctCount: { increment: isCorrect ? 1 : 0 },
          wrongCount: { increment: isCorrect ? 0 : 1 },
          lastAnswerAt: new Date()
        },
        create: {
          studentId: student.id,
          wordId: answer.wordId,
          correctCount: isCorrect ? 1 : 0,
          wrongCount: isCorrect ? 0 : 1,
          lastAnswerAt: new Date()
        }
      });
    }

    const total = parsed.answers.length;
    const date = dateKeyToUtcDate(vietnamDateKey(new Date()));

    const existing = await prisma.vocabQuizDay.findUnique({
      where: { studentId_date: { studentId: student.id, date } },
      select: { correct: true }
    });

    // Làm lại thoải mái, nhưng chỉ giữ kết quả TỐT NHẤT trong ngày.
    if (!existing) {
      await prisma.vocabQuizDay.create({
        data: { studentId: student.id, date, correct, total }
      });
    } else if (correct > existing.correct) {
      await prisma.vocabQuizDay.update({
        where: { studentId_date: { studentId: student.id, date } },
        data: { correct, total }
      });
    }

    revalidatePath("/student");
    revalidatePath("/student/vocab");

    return actionOk(`Bạn đúng ${correct}/${total} câu.`);
  } catch (error) {
    return actionFail(error, "Nộp bài từ vựng");
  }
}
```

- [ ] **Step 2: Viết `components/vocab-quiz-form.tsx`**

```tsx
"use client";

import { useState } from "react";
import { ActionForm } from "@/components/action-form";
import { submitVocabQuiz } from "@/lib/actions/vocab";
import type { QuizQuestion } from "@/lib/vocab-quiz";

export function VocabQuizForm({ questions }: { questions: QuizQuestion[] }) {
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [graded, setGraded] = useState(false);

  const answered = questions.every((question) => chosen[question.wordId]);

  const answersJson = JSON.stringify({
    answers: questions.map((question) => ({
      wordId: question.wordId,
      chosen: chosen[question.wordId] ?? ""
    }))
  });

  return (
    <ActionForm
      action={submitVocabQuiz}
      className="space-y-5"
      onResult={(result) => {
        if (result.ok) {
          setGraded(true);
        }
      }}
    >
      <input type="hidden" name="answersJson" value={answersJson} />

      {questions.map((question, index) => {
        const picked = chosen[question.wordId];
        const answer = question.options[question.correctIndex];

        return (
          <fieldset
            key={question.wordId}
            className="rounded-xl border border-border bg-card p-4 shadow-card"
          >
            <legend className="px-1 text-sm font-semibold">
              Câu {index + 1}: <span className="font-bold">{question.display}</span>{" "}
              nghĩa là gì?
            </legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {question.options.map((option) => {
                const isPicked = picked === option;
                const showRight = graded && option === answer;
                const showWrong = graded && isPicked && option !== answer;

                return (
                  <label
                    key={option}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                      showRight
                        ? "border-primary bg-primary/10 font-semibold text-primary"
                        : showWrong
                          ? "border-destructive bg-destructive/10 text-destructive"
                          : isPicked
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`q-${question.wordId}`}
                      value={option}
                      checked={isPicked ?? false}
                      disabled={graded}
                      onChange={() =>
                        setChosen((prev) => ({ ...prev, [question.wordId]: option }))
                      }
                    />
                    {option}
                  </label>
                );
              })}
            </div>
          </fieldset>
        );
      })}

      {graded ? (
        <a
          href="/student/vocab"
          className="inline-block rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold transition hover:border-primary hover:text-primary"
        >
          Làm lại với 5 từ khác
        </a>
      ) : (
        <button
          type="submit"
          disabled={!answered}
          className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-card transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Nộp bài
        </button>
      )}
    </ActionForm>
  );
}
```

- [ ] **Step 3: Viết `app/student/vocab/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { VocabQuizForm } from "@/components/vocab-quiz-form";
import { buildQuiz, MIN_POOL_FOR_QUIZ, QUIZ_SIZE } from "@/lib/vocab-quiz";
import { getVocabSidebar } from "@/lib/vocab-daily";

export const dynamic = "force-dynamic";

export default async function StudentVocabPage() {
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

  const [pool, progress, sidebar] = await Promise.all([
    // Chỉ ôn những từ ĐÃ TỪNG được phát ra làm từ của ngày.
    prisma.vocabWord.findMany({
      where: { hidden: false, dailies: { some: {} } },
      select: { id: true, display: true, meaningVi: true }
    }),
    prisma.vocabProgress.findMany({
      where: { studentId: student.id },
      select: {
        wordId: true,
        correctCount: true,
        wrongCount: true,
        lastAnswerAt: true
      }
    }),
    getVocabSidebar(student.id)
  ]);

  // Mỗi lần vào trang bốc một bộ khác — đây chính là nút "làm lại".
  const questions = buildQuiz({
    pool,
    progress,
    count: QUIZ_SIZE,
    seed: Math.floor(Math.random() * 1000)
  });

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold text-primary">Từ vựng</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight">Ôn tập từ đã học</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Chuỗi {sidebar.streakDays} ngày · đã gặp {sidebar.learnedCount} từ. Làm lại
          bao nhiêu lần cũng được, hệ thống giữ kết quả tốt nhất trong ngày.
        </p>
      </header>

      {questions.length > 0 ? (
        <VocabQuizForm questions={questions} />
      ) : (
        <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Cần ít nhất {MIN_POOL_FOR_QUIZ} từ đã phát mới ôn được. Quay lại sau vài
          ngày nhé.
        </p>
      )}

      {reviewed.length > 0 ? (
        <section className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
          <h3 className="border-b border-border px-5 py-3 text-base font-semibold">
            Từ đã ôn
          </h3>
          <ul className="divide-y divide-border">
            {reviewed.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 px-5 py-3 text-sm"
              >
                <span>
                  <span className="font-semibold">{item.display}</span>
                  <span className="text-muted-foreground"> — {item.meaningVi}</span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  đúng {item.correctCount} · sai {item.wrongCount}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
```

Và thêm khối tính `reviewed` ngay sau lời gọi `buildQuiz`:

```tsx
  // Danh sách từ đã ôn, sai nhiều xếp trước để học viên biết chỗ cần luyện.
  const progressById = new Map(progress.map((row) => [row.wordId, row]));

  const reviewed = pool
    .filter((word) => progressById.has(word.id))
    .map((word) => ({
      ...word,
      correctCount: progressById.get(word.id)?.correctCount ?? 0,
      wrongCount: progressById.get(word.id)?.wrongCount ?? 0
    }))
    .sort((left, right) => right.wrongCount - left.wrongCount);
```

- [ ] **Step 4: Thêm mục điều hướng vào `components/app-shell.tsx`**

Trong mảng `student`, chèn sau dòng `/student/practice`:

```tsx
    { href: "/student/vocab", label: "Từ vựng", hint: "Từ mỗi ngày & ôn tập", icon: "book" },
```

- [ ] **Step 5: Kiểm tra kiểu, lint và toàn bộ test**

Run: `npx tsc --noEmit`
Expected: không lỗi.

Run: `pnpm lint`
Expected: `No ESLint warnings or errors`.

Run: `pnpm test`
Expected: PASS toàn bộ.

- [ ] **Step 6: Xem thật trên trình duyệt**

Đăng nhập học viên, mở `/student/vocab`, chọn đủ 5 đáp án rồi bấm **Nộp bài**.
Expected: hiện toast báo `Bạn đúng N/5 câu.`, các lựa chọn đúng tô xanh, lựa chọn sai tô đỏ, hiện nút "Làm lại với 5 từ khác".

Kiểm tra dữ liệu đã ghi:

Run: `npx tsx -e "import{PrismaClient}from'@prisma/client';const p=new PrismaClient();Promise.all([p.vocabProgress.findMany(),p.vocabQuizDay.findMany()]).then(r=>{console.log(r);return p.\$disconnect()})"`
Expected: có bản ghi `VocabProgress` cho từng từ vừa trả lời và đúng một bản ghi `VocabQuizDay` cho hôm nay.

- [ ] **Step 7: Commit**

```bash
git add lib/actions/vocab.ts components/vocab-quiz-form.tsx app/student/vocab/page.tsx components/app-shell.tsx && git commit -m "feat(tu-vung): trang on tap tu vung cho hoc vien"
```

---

### Task 10: Trang quản lý kho từ của giáo viên

**Files:**
- Modify: `lib/actions/vocab.ts`
- Create: `app/teacher/vocab/page.tsx`
- Modify: `components/app-shell.tsx`

**Interfaces:**
- Consumes: `requireTeacher` (`lib/actions/classes`); `requireTeacherPage` (`lib/teacher-page`); `actionOk`, `actionFail` (`lib/action-result`); `ActionForm` (`components/action-form`)
- Produces:
  - `export async function hideVocabWord(formData: FormData): Promise<ActionResult>`
  - `export async function updateVocabWord(formData: FormData): Promise<ActionResult>`

- [ ] **Step 1: Thêm hai action vào `lib/actions/vocab.ts`**

Thêm import ở đầu file:

```ts
import { requireTeacher } from "@/lib/actions/classes";
```

Thêm vào cuối file:

```ts
const hideSchema = z.object({
  wordId: z.string().min(1),
  hidden: z.enum(["true", "false"])
});

export async function hideVocabWord(formData: FormData): Promise<ActionResult> {
  try {
    await requireTeacher();

    const parsed = hideSchema.parse({
      wordId: formData.get("wordId"),
      hidden: formData.get("hidden")
    });

    // Ẩn từ KHÔNG xoá bản ghi VocabDaily cũ — lịch sử ngày nào phát từ nào phải
    // giữ nguyên, nếu không quiz "từ hôm qua" sẽ hỏi sai.
    await prisma.vocabWord.update({
      where: { id: parsed.wordId },
      data: { hidden: parsed.hidden === "true" }
    });

    revalidatePath("/teacher/vocab");

    return actionOk(parsed.hidden === "true" ? "Đã ẩn từ." : "Đã bỏ ẩn từ.");
  } catch (error) {
    return actionFail(error, "Cập nhật từ");
  }
}

const updateSchema = z.object({
  wordId: z.string().min(1),
  meaningVi: z.string().trim().min(1, "Nghĩa tiếng Việt không được để trống."),
  phonetic: z.string().trim(),
  exampleEn: z.string().trim().min(1, "Câu ví dụ không được để trống.")
});

export async function updateVocabWord(formData: FormData): Promise<ActionResult> {
  try {
    await requireTeacher();

    const parsed = updateSchema.parse({
      wordId: formData.get("wordId"),
      meaningVi: formData.get("meaningVi"),
      phonetic: formData.get("phonetic"),
      exampleEn: formData.get("exampleEn")
    });

    await prisma.vocabWord.update({
      where: { id: parsed.wordId },
      data: {
        meaningVi: parsed.meaningVi,
        phonetic: parsed.phonetic.length > 0 ? parsed.phonetic : null,
        exampleEn: parsed.exampleEn
      }
    });

    revalidatePath("/teacher/vocab");
    revalidatePath("/student");

    return actionOk("Đã lưu thay đổi.");
  } catch (error) {
    return actionFail(error, "Lưu từ");
  }
}
```

- [ ] **Step 2: Viết `app/teacher/vocab/page.tsx`**

```tsx
import { requireTeacherPage } from "@/lib/teacher-page";
import { prisma } from "@/lib/prisma";
import { ActionForm } from "@/components/action-form";
import { hideVocabWord, updateVocabWord } from "@/lib/actions/vocab";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

export default async function TeacherVocabPage({
  searchParams
}: {
  searchParams?: { q?: string; page?: string };
}) {
  await requireTeacherPage();

  const query = searchParams?.q?.trim() ?? "";
  const page = Math.max(1, Number(searchParams?.page ?? "1") || 1);

  const where = query
    ? { word: { contains: query.toLowerCase() } }
    : {};

  // select tường minh, không dùng include: bảng nguồn có content/transcript rất nặng.
  const [total, words] = await Promise.all([
    prisma.vocabWord.count({ where }),
    prisma.vocabWord.findMany({
      where,
      orderBy: { word: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        display: true,
        phonetic: true,
        meaningVi: true,
        exampleEn: true,
        sourceSkill: true,
        hidden: true,
        dailies: { select: { date: true }, take: 1, orderBy: { date: "desc" } }
      }
    })
  ]);

  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold text-primary">Trang giáo viên</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight">Kho từ vựng</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {total} từ. Từ được rút tự động từ đề Listening và Reading — cô ẩn từ rác
          hoặc sửa nghĩa ở đây.
        </p>
      </header>

      <form className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Tìm từ…"
          className="w-full max-w-xs rounded-lg border border-border bg-card px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold transition hover:border-primary hover:text-primary"
        >
          Tìm
        </button>
      </form>

      <div className="space-y-3">
        {words.map((word) => (
          <article
            key={word.id}
            className={`rounded-xl border p-4 shadow-card ${
              word.hidden ? "border-border bg-muted/50 opacity-70" : "border-border bg-card"
            }`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-semibold">
                {word.display}
                {word.hidden ? (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    (đang ẩn)
                  </span>
                ) : null}
              </p>
              <p className="text-xs text-muted-foreground">
                {word.sourceSkill ?? "—"}
                {word.dailies[0]
                  ? ` · đã phát ${word.dailies[0].date.toISOString().slice(0, 10)}`
                  : " · chưa phát"}
              </p>
            </div>

            <ActionForm action={updateVocabWord} className="mt-3 grid gap-2">
              <input type="hidden" name="wordId" value={word.id} />
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  name="meaningVi"
                  defaultValue={word.meaningVi}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  aria-label="Nghĩa tiếng Việt"
                />
                <input
                  name="phonetic"
                  defaultValue={word.phonetic ?? ""}
                  placeholder="/phiên âm/"
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  aria-label="Phiên âm"
                />
              </div>
              <textarea
                name="exampleEn"
                defaultValue={word.exampleEn}
                rows={2}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                aria-label="Câu ví dụ"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
                >
                  Lưu
                </button>
              </div>
            </ActionForm>

            <ActionForm action={hideVocabWord} className="mt-2">
              <input type="hidden" name="wordId" value={word.id} />
              <input type="hidden" name="hidden" value={word.hidden ? "false" : "true"} />
              <button
                type="submit"
                className="rounded-lg border border-border px-4 py-1.5 text-sm font-semibold transition hover:border-destructive hover:text-destructive"
              >
                {word.hidden ? "Bỏ ẩn" : "Ẩn từ này"}
              </button>
            </ActionForm>
          </article>
        ))}
      </div>

      <div className="flex items-center justify-between text-sm">
        <a
          href={`/teacher/vocab?q=${encodeURIComponent(query)}&page=${Math.max(1, page - 1)}`}
          className={page <= 1 ? "pointer-events-none opacity-40" : "hover:text-primary"}
        >
          ← Trang trước
        </a>
        <span className="text-muted-foreground">
          Trang {page}/{lastPage}
        </span>
        <a
          href={`/teacher/vocab?q=${encodeURIComponent(query)}&page=${Math.min(lastPage, page + 1)}`}
          className={
            page >= lastPage ? "pointer-events-none opacity-40" : "hover:text-primary"
          }
        >
          Trang sau →
        </a>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Thêm mục điều hướng cho giáo viên**

Trong `components/app-shell.tsx`, mảng `teacher`, chèn sau dòng `/teacher/materials`:

```tsx
    { href: "/teacher/vocab", label: "Từ vựng", hint: "Kho từ mỗi ngày", icon: "book" },
```

- [ ] **Step 4: Chạy toàn bộ test**

Run: `pnpm test`
Expected: PASS toàn bộ. Đặc biệt `tests/teacher-page-guard.test.ts` phải xanh — nó tự kiểm tra trang mới có dùng `requireTeacherPage()` không.

- [ ] **Step 5: Kiểm tra kiểu và lint**

Run: `npx tsc --noEmit`
Expected: không lỗi.

Run: `pnpm lint`
Expected: `No ESLint warnings or errors`.

- [ ] **Step 6: Xem thật trên trình duyệt**

Đăng nhập giáo viên (`teacher@example.com`), mở `/teacher/vocab`.
Expected: thấy danh sách từ, tìm kiếm chạy, bấm **Lưu** hiện toast `Đã lưu thay đổi.`, bấm **Ẩn từ này** hiện toast `Đã ẩn từ.` và dòng chuyển sang mờ.

- [ ] **Step 7: Kiểm tra build production**

Run: `pnpm build`
Expected: build thành công, `scripts/ensure-db.mjs` chạy không lỗi, không có cảnh báo về trang mới.

- [ ] **Step 8: Commit**

```bash
git add lib/actions/vocab.ts app/teacher/vocab/page.tsx components/app-shell.tsx && git commit -m "feat(tu-vung): trang quan ly kho tu vung cho giao vien"
```

---

## Sau khi hoàn tất

1. Push nhánh `feature/ielts-platform-mvp` để Vercel tự deploy. `scripts/ensure-db.mjs` sẽ tạo 4 bảng trên prod trong lúc build.
2. Chạy script rút từ lên prod: `DATABASE_URL=$DATABASE_URL_PROD npx tsx scripts/vocab-extract.ts` (cần `ANTHROPIC_API_KEY`).
3. Mở `/teacher/vocab` trên prod, duyệt qua vài trang đầu và ẩn những từ rác lọt lưới.
