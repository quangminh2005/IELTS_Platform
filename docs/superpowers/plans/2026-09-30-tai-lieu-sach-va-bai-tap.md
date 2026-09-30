# Tài liệu: Sách / bộ đề và Bài tập hàng tuần — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tách trang `/teacher/materials` thành 2 tab "Sách / bộ đề" (kệ sách, bấm mở từng sách) và "Bài tập hàng tuần" (danh sách), dựa trên 2 cột mới `Material.category` + `Material.bookName`.

**Architecture:** Cột lưu trong DB (additive, lên prod qua `scripts/ensure-db.mjs`). Chuẩn hoá giá trị ở `lib/material-category.ts` (thuần, test được). Logic lọc/gom kệ thuần trong `lib/materials-filter.ts`. `MaterialsBrowser` (client) vẽ tab + kệ + thẻ, vẫn giữ mọi thẻ mounted và bật/tắt `hidden`. Backfill prod một lần bằng script `tmp/`.

**Tech Stack:** Next.js 14 App Router, Prisma/Postgres (Neon), zod, Tailwind, vitest.

**Spec:** `docs/superpowers/specs/2026-09-30-tai-lieu-sach-va-bai-tap-design.md`

## Global Constraints
- Chuỗi hiển thị và comment bằng tiếng Việt có dấu.
- `category` chỉ nhận `"book" | "homework"`, mặc định `"homework"`; `bookName` = `null` khi `homework`.
- Cột mới phải có trong `schema.prisma` (+ comment enum đầu file) VÀ `scripts/ensure-db.mjs`.
- Mọi server action gọi `requireTeacher()` trước tiên (đã có sẵn).
- Tên kệ cho đề `book` không có `bookName`: `"Chưa đặt tên sách"`.

---

### Task 1: Cột DB + chuẩn hoá category

**Files:**
- Modify: `prisma/schema.prisma` (comment enum đầu file; model `Material`)
- Modify: `scripts/ensure-db.mjs` (sau dòng `practiceLockAudio`)
- Create: `lib/material-category.ts`
- Test: `tests/material-category.test.ts`

**Interfaces:**
- Produces: `MATERIAL_CATEGORIES`, `type MaterialCategory`, `UNNAMED_SHELF`, `normalizeCategoryFields({ category, bookName }): { category: MaterialCategory; bookName: string | null }`

- [ ] **Step 1: Viết test hỏng** — `tests/material-category.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeCategoryFields, UNNAMED_SHELF } from "../lib/material-category";

const root = join(__dirname, "..");

describe("normalizeCategoryFields", () => {
  it("book giữ tên sách đã gọn khoảng trắng", () => {
    expect(normalizeCategoryFields({ category: "book", bookName: "  IELTS  Master –  Listening " }))
      .toEqual({ category: "book", bookName: "IELTS Master – Listening" });
  });
  it("homework luôn bỏ tên sách", () => {
    expect(normalizeCategoryFields({ category: "homework", bookName: "Cambridge 20" }))
      .toEqual({ category: "homework", bookName: null });
  });
  it("giá trị lạ / thiếu -> homework", () => {
    expect(normalizeCategoryFields({ category: null, bookName: null }))
      .toEqual({ category: "homework", bookName: null });
    expect(normalizeCategoryFields({ category: "sach", bookName: "x" }).category).toBe("homework");
  });
  it("book mà tên rỗng -> bookName null", () => {
    expect(normalizeCategoryFields({ category: "book", bookName: "   " }))
      .toEqual({ category: "book", bookName: null });
  });
  it("hằng tên kệ chưa đặt", () => {
    expect(UNNAMED_SHELF).toBe("Chưa đặt tên sách");
  });
});

describe("cột category/bookName khai báo đủ chỗ", () => {
  const schema = readFileSync(join(root, "prisma", "schema.prisma"), "utf8");
  const ensureDb = readFileSync(join(root, "scripts", "ensure-db.mjs"), "utf8");
  it("schema", () => {
    expect(schema).toMatch(/category\s+String\s+@default\("homework"\)/);
    expect(schema).toMatch(/bookName\s+String\?/);
    expect(schema).toContain("MaterialCategory (Material.category): book | homework");
  });
  it("ensure-db.mjs", () => {
    expect(ensureDb).toContain(`"Material" ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'homework'`);
    expect(ensureDb).toContain(`"Material" ADD COLUMN IF NOT EXISTS "bookName" TEXT`);
  });
});
```

- [ ] **Step 2:** `npx vitest run tests/material-category.test.ts` → FAIL (module không tồn tại).

- [ ] **Step 3: Cài đặt**

`lib/material-category.ts`:
```ts
import { z } from "zod";

// Loại tài liệu trong Kho: sách/bộ đề in sẵn hoặc bài tập hàng tuần.
export const MATERIAL_CATEGORIES = ["book", "homework"] as const;
export type MaterialCategory = (typeof MATERIAL_CATEGORIES)[number];

// Tên kệ cho đề thuộc loại sách nhưng chưa ghi tên sách.
export const UNNAMED_SHELF = "Chưa đặt tên sách";

const categorySchema = z.enum(MATERIAL_CATEGORIES).catch("homework");

// Chuẩn hoá cặp (loại, tên sách) từ FormData/JSON. Bài tập hàng tuần không có tên sách.
export function normalizeCategoryFields(input: { category?: unknown; bookName?: unknown }): {
  category: MaterialCategory;
  bookName: string | null;
} {
  const category = categorySchema.parse(input.category);
  if (category === "homework") return { category, bookName: null };
  const name = typeof input.bookName === "string" ? input.bookName.replace(/\s+/g, " ").trim() : "";
  return { category, bookName: name || null };
}
```

`prisma/schema.prisma` — thêm dòng comment sau `// enum SpeakingPrepScope ...`:
```
// enum MaterialCategory (Material.category): book | homework
```
và trong `model Material` sau `practiceLockAudio`:
```prisma
  // Loại tài liệu: "book" = sách/bộ đề in sẵn (gom theo bookName thành kệ), "homework" = bài tập hàng tuần.
  category    String           @default("homework")
  // Tên kệ sách (vd "IELTS Master – Listening"); null với bài tập hàng tuần.
  bookName    String?
```

`scripts/ensure-db.mjs` — ngay sau câu `practiceLockAudio`:
```js
  // Kho tài liệu chia 2 mục: sách/bộ đề (gom theo tên sách) và bài tập hàng tuần.
  'ALTER TABLE "Material" ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT \'homework\';',
  'ALTER TABLE "Material" ADD COLUMN IF NOT EXISTS "bookName" TEXT;',
```

- [ ] **Step 4:** `npx prisma db push --skip-generate && npx prisma generate` (DB local ielts-test), rồi `npx vitest run tests/material-category.test.ts` → PASS.
- [ ] **Step 5: Commit** `feat(tai-lieu): them cot Material.category + bookName`.

---

### Task 2: Server actions nhận category/bookName

**Files:**
- Modify: `lib/actions/materials.ts` (`createMaterial`, `updateMaterial`, `importMaterialSchema`, `importMaterial`)
- Test: `tests/material-category.test.ts` (thêm khối cấu trúc)

**Interfaces:**
- Consumes: `normalizeCategoryFields` (Task 1)
- Produces: FormData field names `category`, `bookName` cho 3 action; JSON import nhận thêm `category?`, `bookName?` ở cấp material (ưu tiên JSON, không có thì lấy từ form).

- [ ] **Step 1: Test hỏng** — thêm vào `tests/material-category.test.ts`:
```ts
describe("action lưu category/bookName", () => {
  const src = readFileSync(join(root, "lib", "actions", "materials.ts"), "utf8");
  it("dùng normalizeCategoryFields ở create/update/import", () => {
    expect(src.match(/normalizeCategoryFields\(/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
  });
  it("import schema nhận category/bookName", () => {
    expect(src).toMatch(/importMaterialSchema = z\.object\(\{[\s\S]*category: z\.string\(\)\.optional\(\)/);
  });
});
```
- [ ] **Step 2:** chạy → FAIL.
- [ ] **Step 3: Cài đặt**
  - import `normalizeCategoryFields` từ `@/lib/material-category`.
  - `createMaterial`: sau khi parse, `const categoryFields = normalizeCategoryFields({ category: formData.get("category"), bookName: formData.get("bookName") });` và thêm `...categoryFields` vào `data`.
  - `updateMaterial`: tương tự, thêm `...categoryFields` vào `data` của `updateMany`.
  - `importMaterialSchema`: thêm `category: z.string().optional(), bookName: z.string().optional(),`.
  - `importMaterial`: sau `const data = parsed.data;`:
    ```ts
    // JSON có ghi loại thì theo JSON; không thì theo ô chọn trên form nhập.
    const categoryFields = normalizeCategoryFields({
      category: data.category ?? formData.get("category"),
      bookName: data.bookName ?? formData.get("bookName")
    });
    ```
    và `...categoryFields` trong `prisma.material.create({ data: { ... } })`.
- [ ] **Step 4:** `npx vitest run tests/material-category.test.ts` PASS; `npx tsc --noEmit` sạch.
- [ ] **Step 5: Commit** `feat(tai-lieu): action tao/sua/nhap luu loai tai lieu + ten sach`.

---

### Task 3: Logic lọc + gom kệ sách

**Files:**
- Modify: `lib/materials-filter.ts`
- Modify: `tests/materials-filter.test.ts`

**Interfaces:**
- Produces:
  - `MaterialMeta` thêm `category: MaterialCategory`; `series` với đề `book` = `bookName ?? UNNAMED_SHELF`.
  - `MaterialFilters` thêm `category: "all" | MaterialCategory` (mặc định `"all"`).
  - `SortKey` thêm `"title"` (A→Z, so số tự nhiên: Test 2 < Test 10).
  - `type BookShelf = { name: string; skills: string[]; count: number; practiceOpenCount: number }`
  - `groupBookShelves(metas: MaterialMeta[]): BookShelf[]` — chỉ lấy meta `category === "book"`, gom theo `series`, sắp theo tên (vi), `UNNAMED_SHELF` luôn cuối; `skills` theo thứ tự listening, reading, writing, speaking.

- [ ] **Step 1: Test hỏng** — trong `tests/materials-filter.test.ts`: thêm `category: "book"` vào hàm `meta()` mặc định, `category: "all"` vào `baseFilters`, `category: "book" as const` vào `base` của khối tự luyện; thêm:
```ts
import { groupBookShelves } from "../lib/materials-filter";
import { UNNAMED_SHELF } from "../lib/material-category";

describe("lọc theo loại + sắp theo tên", () => {
  const items = [
    meta({ id: "h", category: "homework", series: "Homework", title: "Homework 1" }),
    meta({ id: "t10", title: "IELTS Master - Reading Test 10" }),
    meta({ id: "t2", title: "IELTS Master - Reading Test 2" })
  ];
  it("category homework chỉ còn bài tập", () => {
    expect(filterAndSortMaterials(items, { ...baseFilters, category: "homework" }).map((m) => m.id)).toEqual(["h"]);
  });
  it("sort title so số tự nhiên", () => {
    expect(filterAndSortMaterials(items, { ...baseFilters, category: "book", sort: "title" }).map((m) => m.id)).toEqual(["t2", "t10"]);
  });
});

describe("groupBookShelves", () => {
  it("gom theo series, bỏ homework, kệ chưa đặt tên xuống cuối", () => {
    const shelves = groupBookShelves([
      meta({ id: "1", series: "IELTS Master – Reading", skill: "reading", practiceOpen: true }),
      meta({ id: "2", series: "IELTS Master – Reading", skill: "reading" }),
      meta({ id: "3", series: UNNAMED_SHELF, skill: "writing" }),
      meta({ id: "4", series: "Cambridge IELTS 20", skill: "speaking" }),
      meta({ id: "5", series: "Cambridge IELTS 20", skill: "listening" }),
      meta({ id: "6", category: "homework", series: "Homework" })
    ]);
    expect(shelves).toEqual([
      { name: "Cambridge IELTS 20", skills: ["listening", "speaking"], count: 2, practiceOpenCount: 0 },
      { name: "IELTS Master – Reading", skills: ["reading"], count: 2, practiceOpenCount: 1 },
      { name: UNNAMED_SHELF, skills: ["writing"], count: 1, practiceOpenCount: 0 }
    ]);
  });
});
```
- [ ] **Step 2:** `npx vitest run tests/materials-filter.test.ts` → FAIL.
- [ ] **Step 3: Cài đặt** trong `lib/materials-filter.ts`:
  - `import { UNNAMED_SHELF, type MaterialCategory } from "@/lib/material-category";` (dùng đường dẫn tương đối `./material-category` để vitest khỏi cần alias — alias `@` đã có trong vitest.config nên cả hai đều chạy).
  - `SortKey = "newest" | "title" | "questions" | "parts" | "assigned"`.
  - `MaterialMeta` thêm `category: MaterialCategory;`.
  - `MaterialFilters` thêm `category: "all" | MaterialCategory;`, default `"all"`.
  - `filterMaterials`: `if (filters.category !== "all" && meta.category !== filters.category) return false;`
  - `sortMaterials` case `"title"`: `sorted.sort((a, b) => a.title.localeCompare(b.title, "vi", { numeric: true }) || byNewest(a, b));`
  - Thêm:
```ts
export type BookShelf = {
  name: string;
  skills: string[];
  count: number;
  practiceOpenCount: number;
};

const SKILL_ORDER = ["listening", "reading", "writing", "speaking"];

// Gom đề loại "sách" thành các kệ theo tên sách (series). Kệ chưa đặt tên xuống cuối.
export function groupBookShelves(metas: MaterialMeta[]): BookShelf[] {
  const shelves = new Map<string, { skills: Set<string>; count: number; practiceOpenCount: number }>();
  for (const meta of metas) {
    if (meta.category !== "book") continue;
    const shelf = shelves.get(meta.series) ?? { skills: new Set<string>(), count: 0, practiceOpenCount: 0 };
    shelf.skills.add(meta.skill);
    shelf.count += 1;
    if (meta.practiceOpen) shelf.practiceOpenCount += 1;
    shelves.set(meta.series, shelf);
  }
  return Array.from(shelves, ([name, shelf]) => ({
    name,
    skills: SKILL_ORDER.filter((skill) => shelf.skills.has(skill)),
    count: shelf.count,
    practiceOpenCount: shelf.practiceOpenCount
  })).sort((a, b) => {
    if (a.name === UNNAMED_SHELF) return 1;
    if (b.name === UNNAMED_SHELF) return -1;
    return a.name.localeCompare(b.name, "vi", { numeric: true });
  });
}
```
- [ ] **Step 4:** test PASS.
- [ ] **Step 5: Commit** `feat(tai-lieu): loc theo loai, sap theo ten, gom ke sach`.

---

### Task 4: Ô nhập Loại + Tên sách ở các form

**Files:**
- Create: `components/material-category-fields.tsx`
- Modify: `app/teacher/materials/page.tsx` (form "Sửa tài liệu"; select thêm `category`, `bookName`)
- Modify: `components/material-editor.tsx` (form "Tài liệu mới"; prop `bookNames`)
- Modify: `components/material-import.tsx` (prop `bookNames`; 2 ô trong form)
- Modify: `app/teacher/materials/create/page.tsx` (truy vấn tên sách, truyền xuống)

**Interfaces:**
- Produces:
  - `BookNameDatalist({ id, bookNames }: { id: string; bookNames: string[] })`
  - `MaterialCategoryFields({ idPrefix, listId, defaultCategory, defaultBookName, fieldClass }: { idPrefix: string; listId: string; defaultCategory?: MaterialCategory; defaultBookName?: string | null; fieldClass: string })` — render `<select name="category">` và `<input name="bookName" list={listId}>` trong lưới 2 cột (`md:grid-cols-2`).

- [ ] **Step 1: Tạo `components/material-category-fields.tsx`:**
```tsx
import type { MaterialCategory } from "@/lib/material-category";

// Một <datalist> dùng chung cả trang — tránh lặp 149 bản cho 149 form sửa.
export function BookNameDatalist({ id, bookNames }: { id: string; bookNames: string[] }) {
  return (
    <datalist id={id}>
      {bookNames.map((name) => (
        <option key={name} value={name} />
      ))}
    </datalist>
  );
}

// Ô "Loại" + "Tên sách" dùng chung cho form tạo, nhập JSON và sửa tài liệu.
export function MaterialCategoryFields({
  idPrefix,
  listId,
  defaultCategory = "homework",
  defaultBookName,
  fieldClass
}: {
  idPrefix: string;
  listId: string;
  defaultCategory?: MaterialCategory;
  defaultBookName?: string | null;
  fieldClass: string;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div>
        <label className="text-sm font-medium" htmlFor={`${idPrefix}-category`}>
          Loại tài liệu
        </label>
        <select
          id={`${idPrefix}-category`}
          name="category"
          defaultValue={defaultCategory}
          className={fieldClass}
        >
          <option value="homework">Bài tập hàng tuần</option>
          <option value="book">Sách / bộ đề</option>
        </select>
      </div>
      <div>
        <label className="text-sm font-medium" htmlFor={`${idPrefix}-book`}>
          Tên sách <span className="text-muted-foreground">(chỉ cần với Sách / bộ đề)</span>
        </label>
        <input
          id={`${idPrefix}-book`}
          name="bookName"
          list={listId}
          defaultValue={defaultBookName ?? ""}
          placeholder="IELTS Master – Listening"
          className={fieldClass}
        />
      </div>
    </div>
  );
}
```
- [ ] **Step 2: `page.tsx`** — `materialSelect` thêm `category: true, bookName: true`. Tính `const bookNames = Array.from(new Set(materials.map((m) => m.bookName).filter((n): n is string => Boolean(n)))).sort((a, b) => a.localeCompare(b, "vi", { numeric: true }));`. Render `<BookNameDatalist id="book-name-options" bookNames={bookNames} />` một lần trong `<section>`. Trong form "Sửa tài liệu", sau lưới Nguồn/Mô tả, chèn:
```tsx
<MaterialCategoryFields
  idPrefix={`material-${material.id}`}
  listId="book-name-options"
  defaultCategory={material.category === "book" ? "book" : "homework"}
  defaultBookName={material.bookName}
  fieldClass={fieldClass}
/>
```
- [ ] **Step 3: `create/page.tsx`** — thêm truy vấn song song:
```ts
prisma.material.findMany({
  where: { teacherId: teacher.id, bookName: { not: null } },
  distinct: ["bookName"],
  select: { bookName: true },
  orderBy: { bookName: "asc" }
})
```
→ `bookNames: string[]`; render `<BookNameDatalist id="book-name-options" bookNames={bookNames} />`; truyền `bookNames` không cần xuống con (con chỉ dùng `listId="book-name-options"`).
- [ ] **Step 4: `material-editor.tsx`** — trong form "Tài liệu mới", sau ô Nguồn, chèn `<div className="mt-4"><MaterialCategoryFields idPrefix="new-material" listId="book-name-options" fieldClass={fieldClass} /></div>`.
- [ ] **Step 5: `material-import.tsx`** — trong `<form>` trước `<textarea>` chèn `<MaterialCategoryFields idPrefix="import" listId="book-name-options" fieldClass={...} />` (dùng class ô thường, không font-mono: `"mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/40 focus:ring-2"`). Thêm 1 dòng vào danh sách giải thích: `<code>category</code> (book | homework) và <code>bookName</code> trong JSON sẽ ưu tiên hơn ô chọn phía trên.`
- [ ] **Step 6:** `npx tsc --noEmit` sạch; `pnpm test` xanh.
- [ ] **Step 7: Commit** `feat(tai-lieu): o Loai + Ten sach o form tao, nhap JSON, sua`.

---

### Task 5: Giao diện tab + kệ sách

**Files:**
- Modify: `components/materials-browser.tsx`
- Modify: `app/teacher/materials/page.tsx` (meta thêm `category`, `series`; prop `initialTab`; searchParams `tab`)

**Interfaces:**
- Consumes: `groupBookShelves`, `BookShelf`, `filterAndSortMaterials`, `MaterialCategory`, `SkillTags` (`components/skill-tags.tsx`).
- Produces: `MaterialsBrowser({ items, initialTab }: { items: MaterialBrowserItem[]; initialTab: MaterialCategory })`.

- [ ] **Step 1: `page.tsx`** — `searchParams` thêm `tab?: string`; `const initialTab = searchParams?.tab === "homework" ? "homework" : "book";`. Trong `meta`:
```ts
category: material.category === "book" ? "book" : "homework",
series:
  material.category === "book"
    ? material.bookName ?? UNNAMED_SHELF
    : deriveSeries(material.sourceLabel, material.title),
```
Truyền `initialTab={initialTab}`.

- [ ] **Step 2: `materials-browser.tsx`** — hành vi:
  - State `tab` (khởi tạo `initialTab`), `openShelf: string | null`, `filters` (bỏ ô chọn "bộ sách"; `series` luôn điều khiển bởi `openShelf`).
  - Sắp xếp mặc định theo tab: `book` → `"title"`, `homework` → `"newest"`; đổi tab thì đặt lại sort mặc định của tab đó và `openShelf = null`, gọi `window.history.replaceState(null, "", \`?tab=${tab}\`)` (không gọi router để khỏi tải lại server component nặng).
  - `sortOptions` thêm `{ value: "title", label: "Tên đề A→Z" }`.
  - Đếm tab: `items.filter((i) => i.meta.category === "book").length` / `"homework"`.
  - `searching = filters.search.trim() !== ""`.
  - `visible`:
    - tab `homework`: `filterAndSortMaterials(metas, { ...filters, category: "homework", series: "all" })`.
    - tab `book` + `searching`: `{ ...filters, category: "book", series: "all" }`.
    - tab `book` + `openShelf`: `{ ...filters, category: "book", series: openShelf }`.
    - tab `book` không tìm, không mở kệ: `[]`.
  - `shelves = groupBookShelves(filterMaterials(metas, { ...filters, search: "", category: "book", series: "all" }))` — kệ chỉ hiện khi tab `book` và không `searching`. Nếu `openShelf` không còn trong `shelves` (bị bộ lọc loại hết) thì coi như đóng.
  - Kệ: `<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">`, mỗi ô là `<button type="button" aria-expanded>`:
```tsx
<button
  key={shelf.name}
  type="button"
  aria-expanded={isOpen}
  onClick={() => setOpenShelf(isOpen ? null : shelf.name)}
  className={`flex flex-col items-start gap-2 rounded-xl border bg-card p-4 text-left shadow-card transition hover:border-primary ${
    isOpen ? "border-primary ring-2 ring-primary/30" : "border-border"
  }`}
>
  <span className="flex w-full items-start justify-between gap-2">
    <span className="font-semibold leading-snug">{shelf.name}</span>
    <span className="text-muted-foreground">{isOpen ? "▾" : "▸"}</span>
  </span>
  <SkillTags skills={shelf.skills} />
  <span className="text-sm text-muted-foreground">
    {shelf.count} đề{shelf.practiceOpenCount > 0 ? ` · ${shelf.practiceOpenCount} đang mở tự luyện` : ""}
  </span>
</button>
```
  - Khi mở kệ: tiêu đề phía trên danh sách thẻ: `<div className="flex items-center justify-between"><h3 className="text-lg font-semibold">{openShelf}</h3><button onClick={() => setOpenShelf(null)} className="text-sm font-semibold text-primary hover:underline">Đóng</button></div>`.
  - Tab bar trên cùng (trong khung lọc hoặc ngay trên): 2 nút kiểu segmented, nút đang chọn `bg-primary text-primary-foreground`, còn lại `border border-border bg-background`; `role="tablist"` / `role="tab"` / `aria-selected`.
  - Dòng đếm: tab `book` chưa mở kệ và không tìm → `"{shelves.length} bộ sách · {n} đề"`; còn lại `"Hiện {visible.length} / {tổng tab} tài liệu"`.
  - Giữ nguyên cơ chế: mọi thẻ mounted, `hidden` + `style.order`. Rỗng: tab `homework`/đang tìm/kệ mở mà `visible.length === 0` → khối "Không có tài liệu khớp bộ lọc" như cũ; tab `book` mà `shelves.length === 0` → cùng khối đó.
  - "Xoá bộ lọc" đặt lại filters về mặc định của tab (giữ `tab`), đóng kệ.
- [ ] **Step 3:** `npx tsc --noEmit`, `pnpm lint`, `pnpm test` đều sạch.
- [ ] **Step 4: Kiểm trên trình duyệt (local)** — `preview_start ielts-dev`, đăng nhập bằng tài khoản seed teacher qua `/api/auth/csrf` + POST `/api/auth/callback/credentials`, mở `/teacher/materials`: 2 tab hiện số; tab Sách thấy kệ; bấm kệ ra thẻ theo Test 1, 2, …; gõ tìm → thẻ hiện thẳng; đổi tab Bài tập → danh sách mới nhất; reload giữ tab; sửa 1 đề sang "Sách / bộ đề" + tên sách → xuất hiện kệ mới; không lỗi console. Chụp màn hình làm bằng chứng.
- [ ] **Step 5: Commit** `feat(tai-lieu): tab Sach/bo de (ke sach) va Bai tap hang tuan`.

---

### Task 6: Backfill + đưa lên prod

**Files:**
- Create: `tmp/backfill-material-category.mjs`

- [ ] **Step 1: Viết script** (mặc định dry-run; `--apply` mới ghi; `--prod` dùng `DATABASE_URL_PROD`, không thì `DATABASE_URL`):
```js
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

const args = new Set(process.argv.slice(2));
const envText = fs.readFileSync(new URL("../.env", import.meta.url), "utf8");
const readEnv = (key) =>
  envText.split(/\r?\n/).find((l) => l.trim().startsWith(`${key}=`))
    ?.slice(key.length + 1).trim().replace(/^["']|["']$/g, "");
const url = readEnv(args.has("--prod") ? "DATABASE_URL_PROD" : "DATABASE_URL");
const prisma = new PrismaClient({ datasources: { db: { url } } });

// Luật xếp kệ: khớp theo title + sourceLabel. Không khớp = bài tập hàng tuần (giữ mặc định).
const RULES = [
  { test: (t) => /ielts master/i.test(t) && /listening/i.test(t), book: "IELTS Master – Listening" },
  { test: (t) => /ielts master/i.test(t) && /reading/i.test(t), book: "IELTS Master – Reading" },
  { test: (t) => /cambridge ielts 20/i.test(t), book: "Cambridge IELTS 20" },
  { test: (t) => /official cambridge guide/i.test(t), book: "The Official Cambridge Guide to IELTS" },
  { test: (t) => /listening practice through dictation/i.test(t), book: "Listening Practice Through Dictation" },
  { test: (t) => /hackers ielts listening/i.test(t), book: "Hackers IELTS Listening" }
];

const mats = await prisma.material.findMany({
  select: { id: true, title: true, sourceLabel: true, category: true, bookName: true }
});
const counts = new Map();
const updates = [];
for (const m of mats) {
  const text = `${m.title} ${m.sourceLabel ?? ""}`;
  const rule = RULES.find((r) => r.test(text));
  if (!rule) continue;
  counts.set(rule.book, (counts.get(rule.book) ?? 0) + 1);
  if (m.category !== "book" || m.bookName !== rule.book) updates.push({ id: m.id, book: rule.book });
}
console.log("Kệ sách:", Object.fromEntries(counts));
console.log(`Sách: ${[...counts.values()].reduce((a, b) => a + b, 0)} · Bài tập: ${mats.length - [...counts.values()].reduce((a, b) => a + b, 0)} · Cần cập nhật: ${updates.length}`);
if (args.has("--apply")) {
  for (const u of updates) {
    await prisma.material.update({ where: { id: u.id }, data: { category: "book", bookName: u.book } });
  }
  console.log("Đã ghi.");
} else {
  console.log("(dry-run — thêm --apply để ghi)");
}
await prisma.$disconnect();
```
- [ ] **Step 2:** Chạy dry-run trên prod (`node tmp/backfill-material-category.mjs --prod`) chỉ sau khi cột đã có trên prod (xem Step 3). Kỳ vọng: IELTS Master – Listening 47, IELTS Master – Reading 49, Cambridge IELTS 20 = 8, Official Guide 3, LPTD 4, Hackers 1 → Sách 112, Bài tập 37.
- [ ] **Step 3: Đưa lên prod** — `git push` nhánh `feature/ielts-platform-mvp` (Vercel build chạy `ensure-db.mjs` → thêm cột). Đợi deploy READY, rồi chạy `node tmp/backfill-material-category.mjs --prod --apply`. Nếu classifier chặn ghi prod: đưa lệnh cho thầy tự chạy.
- [ ] **Step 4:** Kiểm prod: mở `/teacher/materials` (thầy đã đăng nhập), xác nhận 2 tab + kệ đúng số.
