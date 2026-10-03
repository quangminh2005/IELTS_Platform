# Xu & Cửa hàng trang trí (Đợt 1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Học viên kiếm Xu 🪙 khi học (1 XP = 1 Xu, chỉ lượt đầu, hồi tố), mua nền bìa + khung avatar vẽ bằng SVG ở `/student/shop`, nhận đồ thành tích tháng; đồ hiện ở hồ sơ, xếp hạng, Tổng kết tháng.

**Architecture:** Sổ giao dịch `CoinTransaction` (khoá chống trùng unique theo HS) + số dư lưu sẵn `StudentProfile.coins` luôn đặt lại = SUM(sổ) trong transaction có khoá dòng `FOR UPDATE`. Logic thuần ở `lib/coins.ts` + `lib/shop-catalog.ts` (có unit test); đọc/ghi DB ở `lib/wallet.ts`; `syncWallet` idempotent được gọi sau nộp bài, sau ôn thẻ, đầu trang Cửa hàng và trong script hồi tố.

**Tech Stack:** Next.js 14 App Router, Prisma + Postgres (Neon), Tailwind, vitest. Không thêm thư viện.

**Spec:** `docs/superpowers/specs/2026-10-03-xu-cua-hang-dot-1-design.md`

## Global Constraints

- Chữ giao diện + comment code bằng **tiếng Việt**; gọi giáo viên là "thầy".
- Tên tiền: **"Xu"**, biểu tượng 🪙. Không dùng chữ "Kim cương" cho tiền.
- `COINS_PER_XP = 1`; Xu theo phần = `unitXp` của `lib/monthly-xp.ts` với `attemptRound = 1`; Sổ từ = `vocabDayXp`.
- Chỉ `attemptRound = 1` ra Xu. Khoá: `unit:<assignmentId>:<unitId>`, `practice:<unitId>`, `vocab:<YYYY-MM-DD>`, `buy:<itemKey>`.
- Mọi server action bắt đầu bằng `requireStudent()`.
- Bảng/cột mới PHẢI có trong `scripts/ensure-db.mjs` (thiếu = prod sập).
- Hình đồ: SVG/CSS trong code, **không `<defs>`, không thuộc tính `id=`** (AppShell vẽ avatar 2 lần, một bản `display:none` — gradient theo id sẽ hỏng). Màu chuyển dùng CSS `linear-gradient` trên thẻ bọc. Hiệu ứng động chỉ trong `motion-safe:`.
- Hỗ trợ iOS Safari ≥ 15.6: không dùng CSS/JS mới (không `:has`, không `color-mix`, không container query).
- Lỗi ví khi nộp bài / ôn thẻ **không bao giờ** chặn việc nộp: bọc try/catch + `console.error("[wallet] …")`.

## File map

| File | Trách nhiệm |
| --- | --- |
| `prisma/schema.prisma` | model `CoinTransaction`, `StudentItem`; 3 cột mới ở `StudentProfile`; comment enum |
| `scripts/ensure-db.mjs` | SQL tạo bảng/cột trên prod |
| `lib/coins.ts` | Thuần: số Xu theo phần/ngày ôn, khoá, lập kế hoạch dòng sổ |
| `lib/shop-catalog.ts` | Thuần: danh mục đồ, độ hiếm, `resolveItem`, đồ thành tích tháng |
| `lib/wallet.ts` | DB: `syncWallet`, `syncVocabToday`, `lockStudent`, `recomputeCoins`, `loadAchievementItems` |
| `lib/actions/shop.ts` | Server actions `buyItem`, `equipItem` |
| `components/shop/frame-art.tsx` | Hình khung avatar theo `artKey` |
| `components/shop/background-art.tsx` | Hình nền theo `artKey` |
| `components/profile-cover.tsx` | Dải bìa hồ sơ: nền đã trang bị hoặc màu bìa cũ |
| `components/student-avatar.tsx` | Thêm prop `frame` |
| `components/shop/shop-item-card.tsx` | Thẻ đồ (client): mua 2 bước / trang bị / tháo |
| `app/student/shop/page.tsx` | Trang Cửa hàng + tab Lịch sử Xu |
| `components/app-shell.tsx`, `app/student/layout.tsx` | Chip 🪙, mục menu "Cửa hàng", khung ở avatar thanh trên |
| Trang hồ sơ, xếp hạng, Tổng kết tháng, trang HS phía thầy, popup chúc mừng | Hiển thị đồ + Xu |
| `scripts/coins-backfill.ts` | Hồi tố một lần |
| `tests/coins.test.ts`, `tests/shop-catalog.test.ts`, `tests/wallet-guard.test.ts` | Test |

---

### Task 1: Schema + ensure-db

**Files:**
- Modify: `prisma/schema.prisma` (comment enum đầu file; `StudentProfile`; thêm 2 model cuối file)
- Modify: `scripts/ensure-db.mjs` (cuối mảng `statements`)
- Test: `tests/wallet-guard.test.ts`

**Interfaces — Produces:** Prisma models `coinTransaction` (`studentId, kind, key, amount, note, attemptId, createdAt`, unique `studentId_key`), `studentItem` (`studentId, itemKey, source, createdAt`, unique `studentId_itemKey`); `StudentProfile.coins: number`, `equippedBackground: string | null`, `equippedFrame: string | null`.

- [ ] **Step 1: Viết test cấu trúc (fail)**

```ts
// tests/wallet-guard.test.ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

describe("Xu — schema + ensure-db", () => {
  const schema = read("prisma/schema.prisma");
  const ensureDb = read("scripts/ensure-db.mjs");

  it("schema có 2 model mới và 3 cột hồ sơ", () => {
    expect(schema).toContain("model CoinTransaction {");
    expect(schema).toContain("model StudentItem {");
    expect(schema).toMatch(/coins\s+Int\s+@default\(0\)/);
    expect(schema).toMatch(/equippedBackground\s+String\?/);
    expect(schema).toMatch(/equippedFrame\s+String\?/);
    expect(schema).toContain("@@unique([studentId, key])");
    expect(schema).toContain("@@unique([studentId, itemKey])");
    expect(schema).toContain("// enum CoinKind");
    expect(schema).toContain("// enum ItemSource");
  });

  it("ensure-db tạo bảng + cột (thiếu là prod sập)", () => {
    expect(ensureDb).toContain('CREATE TABLE IF NOT EXISTS "CoinTransaction"');
    expect(ensureDb).toContain('CREATE TABLE IF NOT EXISTS "StudentItem"');
    expect(ensureDb).toContain('"CoinTransaction_studentId_key_key"');
    expect(ensureDb).toContain('"StudentItem_studentId_itemKey_key"');
    expect(ensureDb).toContain('ADD COLUMN IF NOT EXISTS "coins" INTEGER NOT NULL DEFAULT 0');
    expect(ensureDb).toContain('ADD COLUMN IF NOT EXISTS "equippedBackground" TEXT');
    expect(ensureDb).toContain('ADD COLUMN IF NOT EXISTS "equippedFrame" TEXT');
  });
});
```

- [ ] **Step 2: Chạy `npx vitest run tests/wallet-guard.test.ts` — FAIL**

- [ ] **Step 3: Sửa schema**

Thêm vào khối comment enum đầu file (sau dòng `MaterialCategory`):

```prisma
// enum CoinKind (CoinTransaction.kind): earn_unit | earn_vocab | purchase
// enum ItemSource (StudentItem.source): purchase | achievement
```

Trong `model StudentProfile`, sau `parentToken`:

```prisma
  // Số dư Xu lưu sẵn — LUÔN bằng SUM(CoinTransaction.amount) của học viên, chỉ được
  // ghi qua lib/wallet.ts (khoá dòng FOR UPDATE rồi đặt lại bằng tổng sổ).
  coins               Int       @default(0)
  // Mã đồ đang trang bị (lib/shop-catalog.ts). Null = không trang bị: bìa dùng
  // coverColor như cũ, avatar không khung.
  equippedBackground  String?
  equippedFrame       String?
```

và trong danh sách quan hệ của `StudentProfile` thêm:

```prisma
  coinTransactions CoinTransaction[]
  items            StudentItem[]
```

Cuối file:

```prisma
// Một dòng sổ Xu. amount > 0 là cộng, < 0 là trừ. key chống cộng trùng (xem
// lib/coins.ts). KHÔNG có khoá ngoại tới Attempt/Assignment: thầy reset lượt (xoá
// cascade) thì dòng sổ vẫn còn → làm lại không cày thêm Xu được.
model CoinTransaction {
  id        String   @id @default(cuid())
  studentId String
  kind      String
  key       String
  amount    Int
  note      String?
  // Lượt làm sinh ra dòng này (để popup chúc mừng hiện "+N Xu"). Chuỗi trơn.
  attemptId String?
  createdAt DateTime @default(now())

  student StudentProfile @relation(fields: [studentId], references: [id], onDelete: Cascade)

  @@unique([studentId, key])
}

// Đồ học viên đang sở hữu. itemKey là mã trong lib/shop-catalog.ts; đồ thành
// tích kèm tháng, vd "frame:champion@2026-09".
model StudentItem {
  id        String   @id @default(cuid())
  studentId String
  itemKey   String
  source    String
  createdAt DateTime @default(now())

  student StudentProfile @relation(fields: [studentId], references: [id], onDelete: Cascade)

  @@unique([studentId, itemKey])
}
```

- [ ] **Step 4: Thêm vào cuối mảng `statements` của `scripts/ensure-db.mjs`**

```js
  // Xu & Cửa hàng (Đợt 1): sổ Xu, đồ sở hữu, số dư + đồ đang trang bị.
  'ALTER TABLE "StudentProfile" ADD COLUMN IF NOT EXISTS "coins" INTEGER NOT NULL DEFAULT 0;',
  'ALTER TABLE "StudentProfile" ADD COLUMN IF NOT EXISTS "equippedBackground" TEXT;',
  'ALTER TABLE "StudentProfile" ADD COLUMN IF NOT EXISTS "equippedFrame" TEXT;',
  `CREATE TABLE IF NOT EXISTS "CoinTransaction" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "note" TEXT,
    "attemptId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CoinTransaction_pkey" PRIMARY KEY ("id")
  );`,
  'CREATE UNIQUE INDEX IF NOT EXISTS "CoinTransaction_studentId_key_key" ON "CoinTransaction"("studentId", "key");',
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CoinTransaction_studentId_fkey') THEN
      ALTER TABLE "CoinTransaction" ADD CONSTRAINT "CoinTransaction_studentId_fkey"
      FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END $$;`,
  `CREATE TABLE IF NOT EXISTS "StudentItem" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudentItem_pkey" PRIMARY KEY ("id")
  );`,
  'CREATE UNIQUE INDEX IF NOT EXISTS "StudentItem_studentId_itemKey_key" ON "StudentItem"("studentId", "itemKey");',
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudentItem_studentId_fkey') THEN
      ALTER TABLE "StudentItem" ADD CONSTRAINT "StudentItem_studentId_fkey"
      FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END $$;`,
```

- [ ] **Step 5: `npx prisma generate` rồi `npx prisma db push` (DB test local trong `.env`), chạy lại test → PASS**

- [ ] **Step 6: Commit** — `git add prisma/schema.prisma scripts/ensure-db.mjs tests/wallet-guard.test.ts && git commit -m "feat(xu): schema so Xu + do so huu"`

---

### Task 2: `lib/coins.ts` — logic thuần kiếm Xu

**Files:** Create `lib/coins.ts`; Test `tests/coins.test.ts`

**Interfaces — Consumes:** `unitXp`, `vocabDayXp` từ `lib/monthly-xp.ts`.
**Produces:**
```ts
export const COINS_PER_XP = 1;
export type CoinKind = "earn_unit" | "earn_vocab" | "purchase";
export type CoinUnitRow = { attemptId: string; assignmentId: string; isPractice: boolean; unitId: string;
  submittedAt: Date | null; gradedCount: number; correctCount: number; manualAnswered: boolean; note: string };
export type CoinEntryDraft = { kind: CoinKind; key: string; amount: number; note: string; attemptId: string | null; createdAt: Date };
export function unitCoins(row: Pick<CoinUnitRow,"gradedCount"|"correctCount"|"manualAnswered">): number;
export function unitCoinKey(row: Pick<CoinUnitRow,"isPractice"|"assignmentId"|"unitId">): string;
export function earnedUnitIds(keys: Iterable<string>): Set<string>;
export function planUnitEntries(rows: CoinUnitRow[], existingKeys: Set<string>): CoinEntryDraft[];
export function vocabCoins(total: number): number;
export function vocabKey(dateKey: string): string;
export function planVocabEntries(days: { date: string; total: number }[], existing: Map<string, number>):
  { create: CoinEntryDraft[]; raise: { key: string; amount: number }[] };
export function purchaseKey(itemKey: string): string;
```

- [ ] **Step 1: Viết test (fail)**

```ts
// tests/coins.test.ts
import { describe, expect, it } from "vitest";
import {
  earnedUnitIds, planUnitEntries, planVocabEntries, purchaseKey, unitCoinKey, unitCoins,
  vocabCoins, vocabKey, type CoinUnitRow
} from "../lib/coins";

function row(extra: Partial<CoinUnitRow> = {}): CoinUnitRow {
  return {
    attemptId: "a1", assignmentId: "as1", isPractice: false, unitId: "u1",
    submittedAt: new Date("2026-10-01T03:00:00Z"),
    gradedCount: 10, correctCount: 5, manualAnswered: false, note: "Đề 1 – Passage 1",
    ...extra
  };
}

describe("unitCoins", () => {
  it("bằng XP của phần: 10 + round(10 × %đúng)", () => {
    expect(unitCoins(row())).toBe(15);
    expect(unitCoins(row({ correctCount: 10 }))).toBe(20);
  });
  it("Viết/Nói có bài làm +20, phần trống = 0", () => {
    expect(unitCoins(row({ gradedCount: 0, correctCount: 0, manualAnswered: true }))).toBe(20);
    expect(unitCoins(row({ gradedCount: 0, correctCount: 0 }))).toBe(0);
  });
});

describe("khoá", () => {
  it("bài giao và tự luyện khác dạng khoá", () => {
    expect(unitCoinKey(row())).toBe("unit:as1:u1");
    expect(unitCoinKey(row({ isPractice: true }))).toBe("practice:u1");
    expect(vocabKey("2026-10-03")).toBe("vocab:2026-10-03");
    expect(purchaseKey("bg:aurora")).toBe("buy:bg:aurora");
  });
  it("earnedUnitIds đọc được unitId từ cả hai dạng khoá", () => {
    expect([...earnedUnitIds(["unit:as1:u1", "practice:u2", "vocab:2026-10-01", "buy:bg:x"])].sort())
      .toEqual(["u1", "u2"]);
  });
});

describe("planUnitEntries", () => {
  it("tạo dòng theo giờ nộp, ghi attemptId + note", () => {
    const [entry] = planUnitEntries([row()], new Set());
    expect(entry).toMatchObject({ kind: "earn_unit", key: "unit:as1:u1", amount: 15, attemptId: "a1", note: "Đề 1 – Passage 1" });
    expect(entry.createdAt.toISOString()).toBe("2026-10-01T03:00:00.000Z");
  });
  it("bỏ phần chưa nộp và phần 0 Xu", () => {
    expect(planUnitEntries([row({ submittedAt: null }), row({ unitId: "u2", gradedCount: 0, correctCount: 0 })], new Set())).toEqual([]);
  });
  it("khoá đã có (reset lượt rồi làm lại) → không cộng lần 2", () => {
    expect(planUnitEntries([row({ attemptId: "a2" })], new Set(["unit:as1:u1"]))).toEqual([]);
  });
  it("tự luyện phần đã có Xu từ bài giao → bỏ qua", () => {
    expect(planUnitEntries([row({ isPractice: true, assignmentId: "p1" })], new Set(["unit:as1:u1"]))).toEqual([]);
  });
  it("tự luyện cả đề rồi luyện lẻ phần đó → chỉ 1 lần", () => {
    const plan = planUnitEntries([
      row({ isPractice: true, assignmentId: "p-full", attemptId: "a1" }),
      row({ isPractice: true, assignmentId: "p-part", attemptId: "a2", submittedAt: new Date("2026-10-02T03:00:00Z") })
    ], new Set());
    expect(plan.map((e) => e.key)).toEqual(["practice:u1"]);
  });
  it("bài giao SAU khi đã tự luyện phần đó vẫn ra Xu", () => {
    const plan = planUnitEntries([row({ isPractice: false })], new Set(["practice:u1"]));
    expect(plan.map((e) => e.key)).toEqual(["unit:as1:u1"]);
  });
  it("xét theo thứ tự thời gian: tự luyện sau bài giao trong cùng lần quét bị bỏ", () => {
    const plan = planUnitEntries([
      row({ isPractice: true, assignmentId: "p1", attemptId: "a2", submittedAt: new Date("2026-10-05T00:00:00Z") }),
      row({ attemptId: "a1", submittedAt: new Date("2026-10-01T00:00:00Z") })
    ], new Set());
    expect(plan.map((e) => e.key)).toEqual(["unit:as1:u1"]);
  });
});

describe("Sổ từ", () => {
  it("2 thẻ = 1 Xu, trần 15", () => {
    expect(vocabCoins(1)).toBe(0);
    expect(vocabCoins(9)).toBe(4);
    expect(vocabCoins(100)).toBe(15);
  });
  it("ngày mới → create; ngày đã có và tăng → raise; không bao giờ giảm", () => {
    const plan = planVocabEntries(
      [{ date: "2026-10-01", total: 10 }, { date: "2026-10-02", total: 20 }, { date: "2026-10-03", total: 2 }, { date: "2026-10-04", total: 1 }],
      new Map([["vocab:2026-10-02", 6], ["vocab:2026-10-03", 5]])
    );
    expect(plan.create.map((e) => [e.key, e.amount])).toEqual([["vocab:2026-10-01", 5]]);
    expect(plan.create[0]).toMatchObject({ kind: "earn_vocab", note: "Ôn 10 thẻ Sổ từ", attemptId: null });
    expect(plan.raise).toEqual([{ key: "vocab:2026-10-02", amount: 10 }]);
  });
});
```

- [ ] **Step 2: Chạy `npx vitest run tests/coins.test.ts` — FAIL (module chưa có)**

- [ ] **Step 3: Viết `lib/coins.ts`**

```ts
import { unitXp, vocabDayXp } from "@/lib/monthly-xp";

// Quy tắc kiếm Xu (Cửa hàng trang trí). Xu ăn theo XP của Tổng kết tháng — muốn
// đổi tỉ lệ thì sửa COINS_PER_XP; dòng sổ đã ghi không bị ảnh hưởng.
export const COINS_PER_XP = 1;

export type CoinKind = "earn_unit" | "earn_vocab" | "purchase";

// Một phần (AssignableUnit) trong một lượt làm LƯỢT ĐẦU (attemptRound = 1).
export type CoinUnitRow = {
  attemptId: string;
  assignmentId: string;
  isPractice: boolean;
  unitId: string;
  submittedAt: Date | null; // null = kỹ năng chứa phần này chưa nộp
  gradedCount: number;
  correctCount: number;
  manualAnswered: boolean;
  note: string; // "Tên đề – Tên phần"
};

export type CoinEntryDraft = {
  kind: CoinKind;
  key: string;
  amount: number;
  note: string;
  attemptId: string | null;
  createdAt: Date;
};

export function unitCoins(row: Pick<CoinUnitRow, "gradedCount" | "correctCount" | "manualAnswered">): number {
  return Math.floor(unitXp({ ...row, attemptRound: 1 }) * COINS_PER_XP);
}

// Bài giao: mỗi (bài giao, phần) một lần — thầy reset lượt cũng không cộng lại.
// Tự luyện: mỗi phần một lần cho mọi phạm vi luyện (cả đề hay lẻ phần).
export function unitCoinKey(row: Pick<CoinUnitRow, "isPractice" | "assignmentId" | "unitId">): string {
  return row.isPractice ? `practice:${row.unitId}` : `unit:${row.assignmentId}:${row.unitId}`;
}

export function vocabKey(dateKey: string): string {
  return `vocab:${dateKey}`;
}

export function purchaseKey(itemKey: string): string {
  return `buy:${itemKey}`;
}

// Các phần đã từng ra Xu (bài giao hoặc tự luyện).
export function earnedUnitIds(keys: Iterable<string>): Set<string> {
  const ids = new Set<string>();
  for (const key of keys) {
    if (key.startsWith("unit:")) {
      ids.add(key.slice(key.lastIndexOf(":") + 1));
    } else if (key.startsWith("practice:")) {
      ids.add(key.slice("practice:".length));
    }
  }
  return ids;
}

export function planUnitEntries(rows: CoinUnitRow[], existingKeys: Set<string>): CoinEntryDraft[] {
  const taken = new Set(existingKeys);
  const earned = earnedUnitIds(existingKeys);
  const plan: CoinEntryDraft[] = [];

  // Theo thứ tự nộp: phần làm ở bài giao trước rồi mới tự luyện thì tự luyện bị bỏ.
  const submitted = rows
    .filter((row): row is CoinUnitRow & { submittedAt: Date } => row.submittedAt !== null)
    .sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime());

  for (const row of submitted) {
    const amount = unitCoins(row);
    const key = unitCoinKey(row);
    if (amount <= 0 || taken.has(key)) continue;
    if (row.isPractice && earned.has(row.unitId)) continue;

    plan.push({ kind: "earn_unit", key, amount, note: row.note, attemptId: row.attemptId, createdAt: row.submittedAt });
    taken.add(key);
    earned.add(row.unitId);
  }

  return plan;
}

export function vocabCoins(total: number): number {
  return Math.floor(vocabDayXp(total) * COINS_PER_XP);
}

// Dòng sổ của một ngày ôn được nâng dần trong ngày, không bao giờ hạ.
export function planVocabEntries(
  days: { date: string; total: number }[],
  existing: Map<string, number>
): { create: CoinEntryDraft[]; raise: { key: string; amount: number }[] } {
  const create: CoinEntryDraft[] = [];
  const raise: { key: string; amount: number }[] = [];

  for (const day of days) {
    const amount = vocabCoins(day.total);
    if (amount <= 0) continue;
    const key = vocabKey(day.date);
    const current = existing.get(key);
    if (current === undefined) {
      create.push({
        kind: "earn_vocab",
        key,
        amount,
        note: `Ôn ${day.total} thẻ Sổ từ`,
        attemptId: null,
        // Giữa trưa giờ VN của ngày đó — lịch sử Xu xếp đúng ngày.
        createdAt: new Date(`${day.date}T12:00:00+07:00`)
      });
    } else if (amount > current) {
      raise.push({ key, amount });
    }
  }

  return { create, raise };
}
```

- [ ] **Step 4: Chạy test → PASS**
- [ ] **Step 5: Commit** — `git add lib/coins.ts tests/coins.test.ts && git commit -m "feat(xu): logic thuan tinh Xu theo phan va So tu"`

---

### Task 3: `lib/shop-catalog.ts` — danh mục đồ + đồ thành tích

**Files:** Create `lib/shop-catalog.ts`; Test `tests/shop-catalog.test.ts`

**Interfaces — Consumes:** `monthKeyOf`, `shiftMonthKey`, `type MonthlyRecap` từ `lib/monthly-recap.ts`.
**Produces:**
```ts
export type ItemCategory = "background" | "frame";
export type ItemRarity = "common" | "rare" | "epic" | "legendary" | "achievement";
export type CatalogItem = { key: string; name: string; category: ItemCategory; rarity: ItemRarity; price: number | null; description?: string };
export type ResolvedItem = CatalogItem & { artKey: string; monthKey: string | null };
export const SHOP_ITEMS: CatalogItem[];
export const ACHIEVEMENT_TEMPLATES: { baseKey: string; category: ItemCategory; namePrefix: string; description: string; board: "xp" | "days" }[];
export const ART_KEYS: string[];
export const RARITY_LABELS: Record<ItemRarity, string>;
export const RARITY_ORDER: ItemRarity[];
export const ACHIEVEMENT_START_MONTH = "2026-07";
export function resolveItem(itemKey: string | null | undefined): ResolvedItem | null;
export function closedMonthKeys(now: Date): string[];
export type AchievementItem = { studentId: string; itemKey: string };
export function achievementItemsFor(recap: MonthlyRecap): AchievementItem[];
```

- [ ] **Step 1: Viết test (fail)**

```ts
// tests/shop-catalog.test.ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  ACHIEVEMENT_TEMPLATES, ART_KEYS, SHOP_ITEMS, achievementItemsFor, closedMonthKeys, resolveItem
} from "../lib/shop-catalog";
import type { MonthlyRecap, RecapEntry } from "../lib/monthly-recap";

describe("danh mục đồ", () => {
  it("không trùng mã, mã có tiền tố đúng loại", () => {
    const keys = SHOP_ITEMS.map((i) => i.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const item of SHOP_ITEMS) {
      expect(item.key.startsWith(item.category === "frame" ? "frame:" : "bg:")).toBe(true);
      expect(item.key).not.toContain("@");
    }
  });
  it("đồ bán có giá > 0; không có đồ thành tích trong danh sách bán", () => {
    for (const item of SHOP_ITEMS) {
      expect(item.rarity).not.toBe("achievement");
      expect(item.price).toBeGreaterThan(0);
    }
  });
  it("đủ 11 nền + 7 khung", () => {
    expect(SHOP_ITEMS.filter((i) => i.category === "background")).toHaveLength(11);
    expect(SHOP_ITEMS.filter((i) => i.category === "frame")).toHaveLength(7);
  });
});

describe("resolveItem", () => {
  it("đồ thường", () => {
    expect(resolveItem("bg:aurora")).toMatchObject({ name: "Cực quang", artKey: "bg:aurora", monthKey: null, price: 1200 });
  });
  it("đồ thành tích kèm tháng: không giá, tên có tháng", () => {
    expect(resolveItem("frame:champion@2026-09")).toMatchObject({
      name: "Quán quân tháng 9/2026", category: "frame", rarity: "achievement", price: null,
      artKey: "frame:champion", monthKey: "2026-09"
    });
  });
  it("mã lạ / sai định dạng → null", () => {
    expect(resolveItem("bg:khong-co")).toBeNull();
    expect(resolveItem("frame:champion@2026-9")).toBeNull();
    expect(resolveItem("frame:wood@2026-09")).toBeNull();
    expect(resolveItem(null)).toBeNull();
  });
});

describe("đồ thành tích tháng", () => {
  it("closedMonthKeys: từ 2026-07 tới tháng trước", () => {
    expect(closedMonthKeys(new Date("2026-10-03T05:00:00Z"))).toEqual(["2026-07", "2026-08", "2026-09"]);
    expect(closedMonthKeys(new Date("2026-07-15T05:00:00Z"))).toEqual([]);
  });

  function entry(studentId: string, xpRank: number | null, daysRank: number | null): RecapEntry {
    return { studentId, displayName: studentId, avatarUrl: null, avatarPreset: null, userImage: null,
      xp: 1, activeDays: 1, activeDayKeys: [], unitsBySkill: {}, vocabCards: 0, xpRank, daysRank };
  }
  function recap(entries: RecapEntry[]): MonthlyRecap {
    return { monthKey: "2026-09", daysInMonth: 30, totalXp: 0, participantCount: 0, entries, xpBoard: [], daysBoard: [] };
  }

  it("hạng 1 mỗi bảng nhận đồ; đồng hạng nhất đều nhận", () => {
    const items = achievementItemsFor(recap([entry("a", 1, 2), entry("b", 2, 1), entry("c", 3, 1)]));
    expect(items).toEqual([
      { studentId: "a", itemKey: "frame:champion@2026-09" },
      { studentId: "b", itemKey: "bg:diligent@2026-09" },
      { studentId: "c", itemKey: "bg:diligent@2026-09" }
    ]);
  });
  it("bảng rỗng → không ai", () => {
    expect(achievementItemsFor(recap([]))).toEqual([]);
  });
});

describe("mọi đồ đều có hình, hình không dùng id", () => {
  const frameArt = readFileSync("components/shop/frame-art.tsx", "utf8");
  const bgArt = readFileSync("components/shop/background-art.tsx", "utf8");

  it.each(ART_KEYS)("có hình cho %s", (key) => {
    expect(frameArt + bgArt).toContain(`"${key}":`);
  });
  it("không <defs>, không id= (avatar vẽ 2 lần trong AppShell)", () => {
    for (const source of [frameArt, bgArt]) {
      expect(source).not.toContain("<defs");
      expect(source).not.toMatch(/\sid=/);
    }
  });
  it("hiệu ứng động chỉ trong motion-safe", () => {
    for (const source of [frameArt, bgArt]) {
      expect(source).not.toMatch(/(^|[\s"'`])animate-/);
    }
  });
  it("ART_KEYS gồm cả mẫu đồ thành tích", () => {
    for (const template of ACHIEVEMENT_TEMPLATES) expect(ART_KEYS).toContain(template.baseKey);
  });
});
```

(Khối "mọi đồ đều có hình" sẽ còn FAIL tới Task 6 — chấp nhận; chạy riêng các khối khác bằng `-t`.)

- [ ] **Step 2: Chạy `npx vitest run tests/shop-catalog.test.ts -t "danh mục|resolveItem|thành tích tháng"` — FAIL**

- [ ] **Step 3: Viết `lib/shop-catalog.ts`**

```ts
import { monthKeyOf, shiftMonthKey, type MonthlyRecap } from "@/lib/monthly-recap";

// Danh mục đồ trang trí của Cửa hàng. Hình vẽ nằm ở components/shop/*-art.tsx
// theo artKey — thêm đồ = thêm một dòng ở đây + một hình ở đó (test ép đủ cặp).

export type ItemCategory = "background" | "frame";
export type ItemRarity = "common" | "rare" | "epic" | "legendary" | "achievement";

export type CatalogItem = {
  key: string;
  name: string;
  category: ItemCategory;
  rarity: ItemRarity;
  price: number | null; // null = không bán (đồ thành tích)
  description?: string;
};

export type ResolvedItem = CatalogItem & { artKey: string; monthKey: string | null };

export const RARITY_ORDER: ItemRarity[] = ["common", "rare", "epic", "legendary", "achievement"];

export const RARITY_LABELS: Record<ItemRarity, string> = {
  common: "Thường",
  rare: "Hiếm",
  epic: "Sử thi",
  legendary: "Huyền thoại",
  achievement: "Thành tích"
};

export const SHOP_ITEMS: CatalogItem[] = [
  { key: "bg:starry-night", name: "Trời sao", category: "background", rarity: "common", price: 150 },
  { key: "bg:meadow", name: "Đồng cỏ", category: "background", rarity: "common", price: 150 },
  { key: "bg:ocean", name: "Sóng biển", category: "background", rarity: "common", price: 150 },
  { key: "bg:pink-clouds", name: "Mây hồng", category: "background", rarity: "common", price: 150 },
  { key: "bg:sunset", name: "Hoàng hôn", category: "background", rarity: "rare", price: 500 },
  { key: "bg:bamboo", name: "Rừng tre", category: "background", rarity: "rare", price: 500 },
  { key: "bg:city-night", name: "Thành phố đêm", category: "background", rarity: "rare", price: 500 },
  { key: "bg:aurora", name: "Cực quang", category: "background", rarity: "epic", price: 1200 },
  { key: "bg:snow-peaks", name: "Núi tuyết", category: "background", rarity: "epic", price: 1200 },
  { key: "bg:old-library", name: "Thư viện cổ", category: "background", rarity: "epic", price: 1200 },
  { key: "bg:galaxy", name: "Thiên hà", category: "background", rarity: "legendary", price: 3000 },
  { key: "frame:wood", name: "Khung gỗ", category: "frame", rarity: "common", price: 200 },
  { key: "frame:bronze", name: "Khung đồng", category: "frame", rarity: "common", price: 300 },
  { key: "frame:silver", name: "Khung bạc", category: "frame", rarity: "rare", price: 700 },
  { key: "frame:gold", name: "Khung vàng", category: "frame", rarity: "rare", price: 1000 },
  { key: "frame:emerald", name: "Ngọc lục bảo", category: "frame", rarity: "epic", price: 1500 },
  { key: "frame:ruby", name: "Hồng ngọc", category: "frame", rarity: "epic", price: 2000 },
  { key: "frame:phoenix", name: "Phượng hoàng lửa", category: "frame", rarity: "legendary", price: 3500 }
];

// Đồ thành tích: một món riêng cho MỖI tháng, mã dạng "<baseKey>@YYYY-MM".
export const ACHIEVEMENT_TEMPLATES: {
  baseKey: string;
  category: ItemCategory;
  namePrefix: string;
  description: string;
  board: "xp" | "days";
}[] = [
  {
    baseKey: "frame:champion",
    category: "frame",
    namePrefix: "Quán quân tháng",
    description: "Hạng 1 XP trong Tổng kết tháng",
    board: "xp"
  },
  {
    baseKey: "bg:diligent",
    category: "background",
    namePrefix: "Chuyên cần tháng",
    description: "Hạng 1 số ngày học trong Tổng kết tháng",
    board: "days"
  }
];

export const ART_KEYS: string[] = [
  ...SHOP_ITEMS.map((item) => item.key),
  ...ACHIEVEMENT_TEMPLATES.map((template) => template.baseKey)
];

// Tháng đầu tiên có bài nộp trên nền tảng — đồ thành tích tính hồi tố từ đây.
export const ACHIEVEMENT_START_MONTH = "2026-07";

export function resolveItem(itemKey: string | null | undefined): ResolvedItem | null {
  if (!itemKey) return null;

  const at = itemKey.indexOf("@");
  if (at === -1) {
    const item = SHOP_ITEMS.find((candidate) => candidate.key === itemKey);
    return item ? { ...item, artKey: item.key, monthKey: null } : null;
  }

  const baseKey = itemKey.slice(0, at);
  const monthKey = itemKey.slice(at + 1);
  const template = ACHIEVEMENT_TEMPLATES.find((candidate) => candidate.baseKey === baseKey);
  if (!template || !/^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey)) return null;

  const [year, month] = monthKey.split("-");
  return {
    key: itemKey,
    name: `${template.namePrefix} ${Number(month)}/${year}`,
    category: template.category,
    rarity: "achievement",
    price: null,
    description: template.description,
    artKey: template.baseKey,
    monthKey
  };
}

// Các tháng đã khép (từ tháng đầu tới tháng trước tháng hiện tại, giờ VN).
export function closedMonthKeys(now: Date): string[] {
  const current = monthKeyOf(now);
  const keys: string[] = [];
  for (let key = ACHIEVEMENT_START_MONTH; key < current; key = shiftMonthKey(key, 1)) {
    keys.push(key);
  }
  return keys;
}

export type AchievementItem = { studentId: string; itemKey: string };

export function achievementItemsFor(recap: MonthlyRecap): AchievementItem[] {
  const items: AchievementItem[] = [];
  for (const template of ACHIEVEMENT_TEMPLATES) {
    for (const entry of recap.entries) {
      const rank = template.board === "xp" ? entry.xpRank : entry.daysRank;
      if (rank === 1) {
        items.push({ studentId: entry.studentId, itemKey: `${template.baseKey}@${recap.monthKey}` });
      }
    }
  }
  return items;
}
```

- [ ] **Step 4: Chạy lại lệnh Step 2 → PASS**
- [ ] **Step 5: Commit** — `git add lib/shop-catalog.ts tests/shop-catalog.test.ts && git commit -m "feat(xu): danh muc do + do thanh tich thang"`

---

### Task 4: `lib/wallet.ts` + móc vào nộp bài & ôn thẻ

**Files:**
- Create: `lib/wallet.ts`
- Modify: `lib/monthly-recap-data.ts` (export `loadMonthlyRecap`)
- Modify: `lib/actions/attempts.ts` (`submitSkill`, sau `await prisma.$transaction(...)`, trước `revalidatePath`)
- Modify: `lib/actions/vocab-deck.ts` (`answerVocabCard`, sau upsert `vocabQuizDay`)
- Test: `tests/wallet-guard.test.ts` (thêm khối)

**Interfaces — Consumes:** Task 1 models; `planUnitEntries`, `planVocabEntries`, `CoinUnitRow`, `CoinEntryDraft` (Task 2); `achievementItemsFor`, `closedMonthKeys`, `AchievementItem` (Task 3); `getMonthlyRecap`, `loadMonthlyRecap`.
**Produces:**
```ts
export type RecapLoader = (monthKey: string) => Promise<MonthlyRecap>;
export async function loadAchievementItems(loadRecap: RecapLoader, now?: Date): Promise<AchievementItem[]>;
export async function syncWallet(studentId: string, options?: { attemptId?: string; achievements?: AchievementItem[]; now?: Date }): Promise<{ created: number; raised: number; items: number }>;
export async function syncVocabToday(studentId: string, now?: Date): Promise<void>;
export async function lockStudent(tx: Prisma.TransactionClient, studentId: string): Promise<void>;
export async function recomputeCoins(tx: Prisma.TransactionClient, studentId: string): Promise<number>;
```

- [ ] **Step 1: Thêm test cấu trúc (fail)**

```ts
// nối vào tests/wallet-guard.test.ts
describe("Xu — móc ví không chặn nộp bài", () => {
  const attempts = read("lib/actions/attempts.ts");
  const vocab = read("lib/actions/vocab-deck.ts");
  const wallet = read("lib/wallet.ts");

  it("submitSkill đồng bộ ví theo attempt, bọc try/catch", () => {
    expect(attempts).toMatch(/try\s*\{\s*await syncWallet\(student\.id, \{ attemptId: attempt\.id \}\);?\s*\}\s*catch/);
  });
  it("answerVocabCard đồng bộ Xu ôn từ hôm nay, bọc try/catch", () => {
    expect(vocab).toMatch(/try\s*\{\s*await syncVocabToday\(student\.id, now\);?\s*\}\s*catch/);
  });
  it("mọi lần ghi ví khoá dòng học viên và đặt lại số dư bằng tổng sổ", () => {
    expect(wallet).toContain('FOR UPDATE');
    expect(wallet).toContain("_sum: { amount: true }");
    expect(wallet).not.toMatch(/coins:\s*\{\s*(increment|decrement)/);
  });
});
```

- [ ] **Step 2: Chạy → FAIL**

- [ ] **Step 3: Export loader** — trong `lib/monthly-recap-data.ts` đổi `async function loadMonthlyRecap(` thành `export async function loadMonthlyRecap(` và thêm comment phía trên: `// Export để script hồi tố Xu (chạy ngoài Next, không dùng được unstable_cache) gọi thẳng.`

- [ ] **Step 4: Viết `lib/wallet.ts`**

```ts
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { MANUAL_QUESTION_TYPES } from "@/lib/manual-grading";
import { getMonthlyRecap } from "@/lib/monthly-recap-data";
import type { MonthlyRecap } from "@/lib/monthly-recap";
import { PRACTICE_MODE } from "@/lib/practice";
import { vietnamDateKey } from "@/lib/vocab-day";
import { dateKeyToUtcDate } from "@/lib/vocab-daily";
import { planUnitEntries, planVocabEntries, type CoinEntryDraft, type CoinUnitRow } from "@/lib/coins";
import { achievementItemsFor, closedMonthKeys, type AchievementItem } from "@/lib/shop-catalog";

// Ví Xu: ĐỌC dữ liệu học → lập kế hoạch (lib/coins.ts, thuần) → GHI trong một
// transaction có khoá dòng học viên. Idempotent: chạy lại bao nhiêu lần cũng không
// cộng trùng nhờ @@unique([studentId, key]).

export type RecapLoader = (monthKey: string) => Promise<MonthlyRecap>;

// Khoá dòng StudentProfile tới hết transaction: hai thao tác ví song song của cùng
// một học viên (nộp bài + bấm Mua) chạy lần lượt, số dư không lệch, không âm.
export async function lockStudent(tx: Prisma.TransactionClient, studentId: string): Promise<void> {
  await tx.$queryRaw`SELECT "id" FROM "StudentProfile" WHERE "id" = ${studentId} FOR UPDATE`;
}

// Số dư luôn = tổng sổ. Gọi SAU khi đã ghi sổ, trong cùng transaction đã khoá.
export async function recomputeCoins(tx: Prisma.TransactionClient, studentId: string): Promise<number> {
  const sum = await tx.coinTransaction.aggregate({ where: { studentId }, _sum: { amount: true } });
  const coins = sum._sum.amount ?? 0;
  await tx.studentProfile.update({ where: { id: studentId }, data: { coins } });
  return coins;
}

async function loadUnitRows(studentId: string, attemptId?: string): Promise<CoinUnitRow[]> {
  const attempts = await prisma.attempt.findMany({
    where: { studentId, attemptRound: 1, ...(attemptId ? { id: attemptId } : {}) },
    select: {
      id: true,
      submittedAt: true,
      skills: { select: { skill: true, submittedAt: true } },
      assignmentRecipient: { select: { assignment: { select: { id: true, mode: true } } } }
    }
  });
  if (attempts.length === 0) return [];
  const attemptIds = attempts.map((attempt) => attempt.id);

  // Đếm đúng/sai theo phần, không tải value (cùng cách lib/monthly-recap-data.ts).
  const [gradedGroups, manualGroups] = await Promise.all([
    prisma.answer.groupBy({
      by: ["attemptId", "assignableUnitId", "isCorrect"],
      where: {
        attemptId: { in: attemptIds },
        isCorrect: { not: null },
        question: { questionType: { notIn: [...MANUAL_QUESTION_TYPES] } }
      },
      _count: { _all: true }
    }),
    prisma.answer.groupBy({
      by: ["attemptId", "assignableUnitId"],
      where: {
        attemptId: { in: attemptIds },
        value: { not: "" },
        question: { questionType: { in: [...MANUAL_QUESTION_TYPES] } }
      },
      _count: { _all: true }
    })
  ]);

  type Counts = { attemptId: string; unitId: string; graded: number; correct: number; manual: boolean };
  const counts = new Map<string, Counts>();
  const countsOf = (attemptKey: string, unitId: string) => {
    const key = `${attemptKey}:${unitId}`;
    let row = counts.get(key);
    if (!row) {
      row = { attemptId: attemptKey, unitId, graded: 0, correct: 0, manual: false };
      counts.set(key, row);
    }
    return row;
  };
  for (const group of gradedGroups) {
    const row = countsOf(group.attemptId, group.assignableUnitId);
    row.graded += group._count._all;
    if (group.isCorrect) row.correct += group._count._all;
  }
  for (const group of manualGroups) {
    countsOf(group.attemptId, group.assignableUnitId).manual = true;
  }

  const unitIds = Array.from(new Set(Array.from(counts.values(), (row) => row.unitId)));
  const units = new Map(
    (
      await prisma.assignableUnit.findMany({
        where: { id: { in: unitIds } },
        select: { id: true, skill: true, title: true, material: { select: { title: true } } }
      })
    ).map((unit) => [unit.id, unit])
  );
  const attemptById = new Map(attempts.map((attempt) => [attempt.id, attempt]));

  const rows: CoinUnitRow[] = [];
  counts.forEach((row) => {
    const attempt = attemptById.get(row.attemptId);
    const unit = units.get(row.unitId);
    if (!attempt || !unit) return;
    // Giờ nộp của kỹ năng chứa phần này; Attempt cũ không có giờ từng kỹ năng thì
    // lấy giờ nộp cả bài.
    const hasSkillTimes = attempt.skills.some((skill) => skill.submittedAt);
    const submittedAt = hasSkillTimes
      ? attempt.skills.find((skill) => skill.skill === unit.skill)?.submittedAt ?? null
      : attempt.submittedAt;
    const assignment = attempt.assignmentRecipient.assignment;
    rows.push({
      attemptId: attempt.id,
      assignmentId: assignment.id,
      isPractice: assignment.mode === PRACTICE_MODE,
      unitId: unit.id,
      submittedAt,
      gradedCount: row.graded,
      correctCount: row.correct,
      manualAnswered: row.manual,
      note: `${unit.material.title} – ${unit.title}`
    });
  });
  return rows;
}

// Đồ thành tích của mọi tháng đã khép, cả trường. Script hồi tố gọi một lần rồi
// truyền vào syncWallet cho từng học viên (khỏi tính lại Tổng kết tháng 29 lần).
export async function loadAchievementItems(loadRecap: RecapLoader, now = new Date()): Promise<AchievementItem[]> {
  const recaps = await Promise.all(closedMonthKeys(now).map((monthKey) => loadRecap(monthKey)));
  return recaps.flatMap(achievementItemsFor);
}

async function applyWalletChanges(
  studentId: string,
  create: CoinEntryDraft[],
  raise: { key: string; amount: number }[],
  items: string[]
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await lockStudent(tx, studentId);
    if (create.length > 0) {
      await tx.coinTransaction.createMany({
        data: create.map((entry) => ({ ...entry, studentId })),
        skipDuplicates: true
      });
    }
    for (const entry of raise) {
      await tx.coinTransaction.updateMany({
        where: { studentId, key: entry.key, amount: { lt: entry.amount } },
        data: { amount: entry.amount }
      });
    }
    if (items.length > 0) {
      await tx.studentItem.createMany({
        data: items.map((itemKey) => ({ studentId, itemKey, source: "achievement" })),
        skipDuplicates: true
      });
    }
    await recomputeCoins(tx, studentId);
  });
}

// attemptId: chỉ quét một lượt (ngay sau khi nộp — nhanh). Không truyền: đồng bộ
// đầy đủ (bài, Sổ từ, đồ thành tích) — dùng ở trang Cửa hàng và script hồi tố.
export async function syncWallet(
  studentId: string,
  options: { attemptId?: string; achievements?: AchievementItem[]; now?: Date } = {}
): Promise<{ created: number; raised: number; items: number }> {
  const full = !options.attemptId;
  const now = options.now ?? new Date();

  const [existingRows, unitRows, vocabDays, ownedItems] = await Promise.all([
    prisma.coinTransaction.findMany({ where: { studentId }, select: { key: true, amount: true } }),
    loadUnitRows(studentId, options.attemptId),
    full
      ? prisma.vocabQuizDay.findMany({ where: { studentId }, select: { date: true, total: true } })
      : Promise.resolve([]),
    full ? prisma.studentItem.findMany({ where: { studentId }, select: { itemKey: true } }) : Promise.resolve([])
  ]);

  const existingKeys = new Set(existingRows.map((row) => row.key));
  const create = planUnitEntries(unitRows, existingKeys);
  const vocabPlan = planVocabEntries(
    vocabDays.map((day) => ({ date: day.date.toISOString().slice(0, 10), total: day.total })),
    new Map(existingRows.map((row) => [row.key, row.amount]))
  );
  create.push(...vocabPlan.create);

  let items: string[] = [];
  if (full) {
    const achievements =
      options.achievements ?? (await loadAchievementItems(getMonthlyRecap, now));
    const owned = new Set(ownedItems.map((item) => item.itemKey));
    items = achievements
      .filter((item) => item.studentId === studentId && !owned.has(item.itemKey))
      .map((item) => item.itemKey);
  }

  if (create.length === 0 && vocabPlan.raise.length === 0 && items.length === 0) {
    return { created: 0, raised: 0, items: 0 };
  }

  await applyWalletChanges(studentId, create, vocabPlan.raise, items);
  return { created: create.length, raised: vocabPlan.raise.length, items: items.length };
}

// Gọi sau mỗi câu ôn thẻ: chỉ ngày hôm nay, rẻ.
export async function syncVocabToday(studentId: string, now = new Date()): Promise<void> {
  const today = vietnamDateKey(now);
  const [day, existing] = await Promise.all([
    prisma.vocabQuizDay.findUnique({
      where: { studentId_date: { studentId, date: dateKeyToUtcDate(today) } },
      select: { total: true }
    }),
    prisma.coinTransaction.findUnique({
      where: { studentId_key: { studentId, key: `vocab:${today}` } },
      select: { key: true, amount: true }
    })
  ]);
  if (!day) return;

  const plan = planVocabEntries(
    [{ date: today, total: day.total }],
    new Map(existing ? [[existing.key, existing.amount]] : [])
  );
  if (plan.create.length === 0 && plan.raise.length === 0) return;
  await applyWalletChanges(studentId, plan.create, plan.raise, []);
}
```

- [ ] **Step 5: Móc vào `submitSkill`** — `lib/actions/attempts.ts`: thêm `import { syncWallet } from "@/lib/wallet";` và ngay sau khối `await prisma.$transaction(async (tx) => { ... });` (trước `revalidatePath("/student");`):

```ts
  // Cộng Xu cho các phần vừa nộp. Lỗi ví KHÔNG được chặn nộp bài — lần mở Cửa
  // hàng sau sẽ tự bù (syncWallet idempotent).
  try {
    await syncWallet(student.id, { attemptId: attempt.id });
  } catch (error) {
    console.error("[wallet] không cộng được Xu sau khi nộp", error);
  }
```

- [ ] **Step 6: Móc vào `answerVocabCard`** — `lib/actions/vocab-deck.ts`: thêm `import { syncVocabToday } from "@/lib/wallet";` và ngay sau `await prisma.vocabQuizDay.upsert({...});`:

```ts
    // Xu ôn từ hôm nay (2 thẻ = 1 Xu, trần 15). Lỗi ví không làm mất câu đã ôn.
    try {
      await syncVocabToday(student.id, now);
    } catch (error) {
      console.error("[wallet] không cộng được Xu ôn từ", error);
    }
```

- [ ] **Step 7: `npx vitest run tests/wallet-guard.test.ts` → PASS; `npx tsc --noEmit` → không lỗi**
- [ ] **Step 8: Commit** — `git add lib/wallet.ts lib/monthly-recap-data.ts lib/actions/attempts.ts lib/actions/vocab-deck.ts tests/wallet-guard.test.ts && git commit -m "feat(xu): vi Xu dong bo idempotent, cong Xu khi nop bai va on the"`

---

### Task 5: Server actions mua / trang bị

**Files:** Create `lib/actions/shop.ts`; Test thêm vào `tests/wallet-guard.test.ts`

**Interfaces — Consumes:** `requireStudent` (`lib/actions/attempts.ts`), `lockStudent`, `recomputeCoins` (Task 4), `resolveItem` (Task 3), `purchaseKey` (Task 2), `actionOk/actionFail/ActionResult`.
**Produces:** `buyItem(formData: FormData): Promise<ActionResult>` (field `itemKey`); `equipItem(formData: FormData): Promise<ActionResult>` (fields `category` = `background|frame`, `itemKey` — chuỗi rỗng = tháo).

- [ ] **Step 1: Test cấu trúc (fail)**

```ts
describe("Xu — action cửa hàng", () => {
  const shop = read("lib/actions/shop.ts");
  it("mọi action gọi requireStudent đầu tiên", () => {
    const bodies = shop.split("export async function").slice(1);
    expect(bodies.length).toBe(2);
    for (const body of bodies) {
      expect(body).toMatch(/^\s*\w+\(formData: FormData\): Promise<ActionResult> \{\s*try \{\s*const student = await requireStudent\(\);/);
    }
  });
  it("mua: không bán đồ không có giá, khoá dòng, kiểm số dư trong transaction", () => {
    expect(shop).toContain("item.price === null");
    expect(shop).toContain("lockStudent(tx, student.id)");
    expect(shop).toContain("recomputeCoins(tx, student.id)");
  });
});
```

- [ ] **Step 2: Chạy → FAIL**

- [ ] **Step 3: Viết `lib/actions/shop.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStudent } from "@/lib/actions/attempts";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { purchaseKey } from "@/lib/coins";
import { prisma } from "@/lib/prisma";
import { resolveItem } from "@/lib/shop-catalog";
import { lockStudent, recomputeCoins } from "@/lib/wallet";

const numberFormat = new Intl.NumberFormat("vi-VN");

function revalidateShopPages() {
  revalidatePath("/student/shop");
  revalidatePath("/student/profile");
  revalidatePath("/student/ranking");
  revalidatePath("/student", "layout");
}

export async function buyItem(formData: FormData): Promise<ActionResult> {
  try {
    const student = await requireStudent();
    const itemKey = z.string().min(1).max(80).parse(formData.get("itemKey"));
    const item = resolveItem(itemKey);
    if (!item) throw new Error("Không tìm thấy món này.");
    // Đồ thành tích không bán — chỉ mở bằng Tổng kết tháng.
    if (item.price === null) throw new Error("Món này chỉ mở được bằng thành tích.");
    const price = item.price;

    await prisma.$transaction(async (tx) => {
      await lockStudent(tx, student.id);
      const [owned, profile] = await Promise.all([
        tx.studentItem.findUnique({ where: { studentId_itemKey: { studentId: student.id, itemKey } } }),
        tx.studentProfile.findUniqueOrThrow({ where: { id: student.id }, select: { coins: true } })
      ]);
      if (owned) throw new Error("Bạn đã có món này rồi.");
      if (profile.coins < price) {
        throw new Error(`Không đủ Xu — còn thiếu ${numberFormat.format(price - profile.coins)} Xu.`);
      }
      await tx.coinTransaction.create({
        data: {
          studentId: student.id,
          kind: "purchase",
          key: purchaseKey(itemKey),
          amount: -price,
          note: `Mua ${item.name}`
        }
      });
      await tx.studentItem.create({ data: { studentId: student.id, itemKey, source: "purchase" } });
      await recomputeCoins(tx, student.id);
    });

    revalidateShopPages();
    return actionOk(`Đã mua ${item.name}!`);
  } catch (error) {
    return actionFail(error, "Mua đồ");
  }
}

const equipSchema = z.object({
  category: z.enum(["background", "frame"]),
  itemKey: z.string().max(80)
});

export async function equipItem(formData: FormData): Promise<ActionResult> {
  try {
    const student = await requireStudent();
    const parsed = equipSchema.parse({
      category: formData.get("category"),
      itemKey: formData.get("itemKey") ?? ""
    });
    const field = parsed.category === "background" ? "equippedBackground" : "equippedFrame";

    if (parsed.itemKey === "") {
      await prisma.studentProfile.update({ where: { id: student.id }, data: { [field]: null } });
      revalidateShopPages();
      return actionOk(parsed.category === "background" ? "Đã tháo nền." : "Đã tháo khung.");
    }

    const item = resolveItem(parsed.itemKey);
    if (!item || item.category !== parsed.category) throw new Error("Món này không hợp lệ.");
    const owned = await prisma.studentItem.findUnique({
      where: { studentId_itemKey: { studentId: student.id, itemKey: parsed.itemKey } }
    });
    if (!owned) throw new Error("Bạn chưa có món này.");

    await prisma.studentProfile.update({ where: { id: student.id }, data: { [field]: parsed.itemKey } });
    revalidateShopPages();
    return actionOk(`Đã trang bị ${item.name}.`);
  } catch (error) {
    return actionFail(error, "Trang bị");
  }
}
```

- [ ] **Step 4: Test → PASS; `npx tsc --noEmit` sạch**
- [ ] **Step 5: Commit** — `git commit -m "feat(xu): action mua va trang bi do"` (kèm 2 file)

---

### Task 6: Hình đồ (SVG) + `StudentAvatar` có khung + `ProfileCover`

**Files:**
- Create: `components/shop/frame-art.tsx`, `components/shop/background-art.tsx`, `components/profile-cover.tsx`
- Modify: `components/student-avatar.tsx`
- Test: khối "mọi đồ đều có hình" trong `tests/shop-catalog.test.ts` (đã viết ở Task 3)

**Interfaces — Consumes:** `resolveItem`, `ART_KEYS`.
**Produces:**
```tsx
export function FrameArt({ artKey, className }: { artKey: string; className?: string }): JSX.Element | null;
export function BackgroundArt({ artKey, className }: { artKey: string; className?: string }): JSX.Element | null;
export function ProfileCover({ backgroundKey, coverColor, className }: { backgroundKey: string | null; coverColor: string | null; className?: string }): JSX.Element;
// StudentAvatar: thêm prop `frame?: string | null` (mã đồ khung; mã lạ/không phải khung → bỏ qua)
```

**Quy ước vẽ (bắt buộc):**
- Không `<defs>`, không `id=`, không gradient SVG. Chuyển màu = CSS `linear-gradient` (inline `style`) trên thẻ bọc.
- Animation: `motion-safe:animate-[...]` (arbitrary Tailwind, không sửa config), `style={{ transformBox: "fill-box", transformOrigin: "center" }}` khi xoay phần tử SVG.
- Mỗi file có một object map `const ART: Record<string, (props) => JSX.Element> = { "frame:wood": ..., ... }` — khoá viết dạng `"frame:wood":` để test tìm thấy.

**Khung — `FrameArt`:** SVG `viewBox="0 0 100 100"`, tâm (50,50). Avatar chiếm vòng tròn bán kính ≈ 36.8 (vì lớp bọc phủ `-inset-[18%]` → hộp 136%). Vòng chính: `<circle r="41" fill="none" strokeWidth="8">`, viền sáng trong `r="37.2" strokeWidth="1.4"`, viền tối ngoài `r="45.3" strokeWidth="1.2"`. Trang trí riêng:

| artKey | Màu vòng (chính / sáng / tối) | Trang trí |
| --- | --- | --- |
| `frame:wood` | `#9a6b3f` / `#c89a68` / `#5e3d20` | 8 vân gỗ: đoạn cung ngắn `stroke="#7a5230"` rải quanh vòng |
| `frame:bronze` | `#b87333` / `#e8a96b` / `#6e4220` | 4 đinh tán tròn r=2.4 ở 0°/90°/180°/270° màu `#f3c08a` |
| `frame:silver` | `#aeb6c2` / `#f1f4f8` / `#6b7480` | Ngôi sao 5 cánh nhỏ ở đỉnh (y≈6) màu `#e9eef5` viền `#6b7480` |
| `frame:gold` | `#e2b23a` / `#fff0a6` / `#9a6d0c` | Ngôi sao đỉnh + 2 nhành nguyệt quế (5 lá elip mỗi bên) ở đáy, màu `#c99a1d` |
| `frame:emerald` | `#10a36f` / `#7ef0c2` / `#06603f` | 3 viên ngọc hình thoi ở đỉnh (giữa to hơn), màu `#34d399` viền `#065f46` |
| `frame:ruby` | `#d0213f` / `#ff9fb0` / `#7a0d22` | Vương miện 3 chóp ở đỉnh màu `#f5c542` có 3 hạt `#d0213f` |
| `frame:phoenix` | `#e2471b` / `#ffd36b` / `#7a1d05` | Vòng lửa: thêm `circle r="41" strokeDasharray="6 7" stroke="#ffb340"` xoay `motion-safe:animate-[spin_9s_linear_infinite]`; 2 cánh lửa (path cong) hai bên dưới màu `#ff7a1a`/`#ffd36b` |
| `frame:champion` | `#7c3aed` / `#e9d5ff` / `#3b0764` | Cúp vàng nhỏ ở đáy (thân + 2 quai) màu `#f5c542`, dải ruy-băng đỏ `#dc2626` có chữ "1" trắng ở đỉnh |

**Nền — `BackgroundArt`:** thẻ bọc `div` `relative overflow-hidden` + `style={{ backgroundImage: "linear-gradient(...)" }}`, bên trong SVG `viewBox="0 0 400 140" preserveAspectRatio="xMidYMid slice"` `className="absolute inset-0 h-full w-full"` gồm hình đặc (có `opacity`).

| artKey | Gradient nền (trên → dưới) | Hình SVG |
| --- | --- | --- |
| `bg:starry-night` | `#0f1d4a → #2b3a7a` | ~30 chấm sao r 0.6–1.6 trắng opacity 0.5–1 (toạ độ cố định, viết tay — không random lúc render), trăng lưỡi liềm (2 circle chồng) |
| `bg:meadow` | `#bfe6ff → #e9f8ff` | 2 đồi xanh (`#7cc96b`, `#5fae55`) path cong, vài bông hoa chấm trắng/vàng, mây trắng |
| `bg:ocean` | `#7dd3fc → #e0f2fe` | 3 lớp sóng path (`#38bdf8`, `#0ea5e9`, `#0369a1`) + mặt trời tròn `#fde68a` |
| `bg:pink-clouds` | `#fbcfe8 → #fdf2f8` | 5 cụm mây (nhiều circle chồng) trắng/hồng nhạt, vài trái tim nhỏ `#f472b6` |
| `bg:sunset` | `#f97316 → #fde68a` | Mặt trời lớn `#fff7ad` nửa dưới đường chân trời, dãy núi tím `#7c2d12` opacity .6, 2 cây dừa path đen nhạt |
| `bg:bamboo` | `#d9f99d → #f7fee7` | 7 thân tre (rect bo + đốt), lá tre (path hình lá) xanh `#4d7c0f`/`#65a30d` |
| `bg:city-night` | `#1e1b4b → #4338ca` | Dãy nhà rect `#111827` cao thấp, cửa sổ vàng `#fde047` rect nhỏ, trăng tròn |
| `bg:aurora` | `#0b1530 → #1b2b55` | 3 dải cực quang path cong lượn màu `#34d399`/`#22d3ee`/`#a78bfa` opacity .55, núi tuyết dưới đáy, sao |
| `bg:snow-peaks` | `#bae6fd → #f0f9ff` | 3 đỉnh núi (polygon `#64748b`/`#94a3b8`) chỏm tuyết trắng, bông tuyết chấm |
| `bg:old-library` | `#78350f → #b45309` | Giá sách: 3 tầng rect `#451a03`, gáy sách nhiều màu rect hẹp, ngọn nến `#fde68a` |
| `bg:galaxy` | `#0a0420 → #2e1065` | Tinh vân: 3 ellipse lớn `#a855f7`/`#ec4899`/`#3b82f6` opacity .35, nhóm sao lấp lánh bọc `<g className="motion-safe:animate-pulse">`, sao lớn 4 cánh |
| `bg:diligent` | `#fde68a → #f59e0b` | Huy chương giữa (circle `#fbbf24` viền `#b45309`) + ngọn lửa chuyên cần `#ef4444`, tia sáng rect xoay quanh opacity .25 |

- [ ] **Step 1: Viết `components/shop/frame-art.tsx`** theo bảng trên (component server-safe, không `"use client"`), export `FrameArt` trả `null` khi `artKey` không có trong `ART`. SVG có `aria-hidden="true"`.
- [ ] **Step 2: Viết `components/shop/background-art.tsx`** theo bảng, export `BackgroundArt` (null khi không có).
- [ ] **Step 3: Sửa `components/student-avatar.tsx`** — thêm prop và bọc khi có khung:

```tsx
import { FrameArt } from "@/components/shop/frame-art";
import { resolveItem } from "@/lib/shop-catalog";
// ...props thêm:
  frame = null
// ...type thêm:
  // Mã khung avatar đang trang bị (lib/shop-catalog.ts). Mã lạ / không phải khung → bỏ.
  frame?: string | null;
```

Đổi hai nhánh `return` thành gán vào biến `avatar`, cuối hàm:

```tsx
  const frameItem = resolveItem(frame);
  if (!frameItem || frameItem.category !== "frame") {
    return avatar;
  }

  // Khung tràn ra ngoài hộp avatar bằng định vị tuyệt đối → kích thước hộp giữ
  // nguyên, hàng danh sách / bục xếp hạng không bị xô lệch.
  return (
    <span className={`relative inline-flex shrink-0 rounded-full ${dimension.box}`}>
      {avatar}
      <FrameArt artKey={frameItem.artKey} className="pointer-events-none absolute -inset-[18%] h-[136%] w-[136%]" />
    </span>
  );
```

- [ ] **Step 4: Viết `components/profile-cover.tsx`**

```tsx
import { BackgroundArt } from "@/components/shop/background-art";
import { resolveItem } from "@/lib/shop-catalog";
import { coverClassName } from "@/lib/student-avatar";

// Dải bìa trang hồ sơ: nền mua ở Cửa hàng nếu đang trang bị, không thì màu bìa
// miễn phí như cũ.
export function ProfileCover({
  backgroundKey,
  coverColor,
  className = "h-32"
}: {
  backgroundKey: string | null;
  coverColor: string | null;
  className?: string;
}) {
  const item = resolveItem(backgroundKey);
  if (item?.category === "background") {
    return <BackgroundArt artKey={item.artKey} className={className} />;
  }
  return <div className={`${className} ${coverClassName(coverColor)}`} />;
}
```

- [ ] **Step 5: `npx vitest run tests/shop-catalog.test.ts tests/student-avatar*.test.ts` → PASS toàn bộ; `npx tsc --noEmit` sạch**
- [ ] **Step 6: Commit** — `git commit -m "feat(xu): hinh nen + khung SVG, avatar co khung, bia ho so"`

---

### Task 7: Trang Cửa hàng + chip Xu + menu

**Files:**
- Create: `app/student/shop/page.tsx`, `components/shop/shop-item-card.tsx`
- Modify: `components/app-shell.tsx`, `app/student/layout.tsx`
- Test: thêm vào `tests/wallet-guard.test.ts`

**Interfaces — Consumes:** `syncWallet`, `buyItem`, `equipItem`, `SHOP_ITEMS`, `ACHIEVEMENT_TEMPLATES`, `RARITY_LABELS`, `RARITY_ORDER`, `resolveItem`, `FrameArt`, `BackgroundArt`, `StudentAvatar`, `ActionForm`, `ActionSubmitButton`.

- [ ] **Step 1: Test cấu trúc (fail)**

```ts
describe("Xu — trang Cửa hàng", () => {
  it("trang shop đồng bộ ví trong try/catch trước khi đọc số dư", () => {
    const page = read("app/student/shop/page.tsx");
    expect(page).toMatch(/try\s*\{\s*await syncWallet\(student\.id\);?\s*\}\s*catch/);
  });
  it("menu học viên có Cửa hàng; AppShell hiện chip Xu", () => {
    const shell = read("components/app-shell.tsx");
    expect(shell).toContain('href: "/student/shop"');
    expect(shell).toContain("CoinChip");
  });
});
```

- [ ] **Step 2: Chạy → FAIL**

- [ ] **Step 3: `app/student/layout.tsx`** — select thêm `coins: true, equippedFrame: true`; truyền `coins: student.coins, frame: student.equippedFrame` vào `studentAvatar`. Sửa comment "Chỉ lấy đúng bốn cột" → "Chỉ lấy đúng các cột cần cho avatar + chip Xu".

- [ ] **Step 4: `components/app-shell.tsx`**
  - `StudentAvatarInfo` thêm `coins: number; frame: string | null;`
  - `navByRole.student` chèn sau "Xếp hạng": `{ href: "/student/shop", label: "Cửa hàng", hint: "Đổi Xu lấy đồ trang trí", icon: "shop" }`; thêm `"shop"` vào `IconName` và nhánh `case "shop"` (túi mua hàng: `<path d="M5 8h14l-1.2 11.2a1.5 1.5 0 0 1-1.5 1.3H7.7a1.5 1.5 0 0 1-1.5-1.3z" /><path d="M9 8V6.5a3 3 0 0 1 6 0V8" />`).
  - `HeaderActions` truyền `frame={studentAvatar.frame}` vào `StudentAvatar`.
  - Thêm component:

```tsx
const coinFormat = new Intl.NumberFormat("vi-VN");

// Chip số dư Xu — thay nhãn "Học viên" ở sidebar và drawer (thanh trên cùng của
// điện thoại không đủ chỗ ở khổ 375px).
function CoinChip({ coins, onNavigate }: { coins: number; onNavigate?: () => void }) {
  return (
    <Link
      href="/student/shop"
      onClick={onNavigate}
      aria-label={`Số dư ${coinFormat.format(coins)} Xu — mở Cửa hàng`}
      className="inline-flex w-fit items-center gap-1.5 rounded-full border border-amber-400/50 bg-amber-400/15 px-3 py-1 text-xs font-bold tabular-nums text-amber-700 transition hover:bg-amber-400/25 dark:text-amber-300"
    >
      <span aria-hidden="true">🪙</span>
      {coinFormat.format(coins)}
    </Link>
  );
}
```

  - Ở sidebar và drawer: nếu `role === "student" && studentAvatar` thì render `<CoinChip coins={studentAvatar.coins} />` (drawer: kèm `onNavigate={() => setMobileOpen(false)}`) thay cho `<span>` nhãn vai trò; ngược lại giữ nhãn cũ.

- [ ] **Step 5: `components/shop/shop-item-card.tsx`** (client)

```tsx
"use client";

import { useState, type ReactNode } from "react";
import { ActionForm, ActionSubmitButton } from "@/components/action-form";
import { buyItem, equipItem } from "@/lib/actions/shop";
import type { ItemCategory, ItemRarity } from "@/lib/shop-catalog";

const RARITY_BADGE: Record<ItemRarity, string> = {
  common: "bg-slate-600/80 text-white",
  rare: "bg-sky-600/85 text-white",
  epic: "bg-violet-600/85 text-white",
  legendary: "bg-amber-500/90 text-white",
  achievement: "bg-rose-600/85 text-white"
};

const numberFormat = new Intl.NumberFormat("vi-VN");

export type ShopCardState = "owned" | "equipped" | "buyable" | "short" | "locked";

// Mua 2 bước ngay trên thẻ (không dùng window.confirm — trên điện thoại hộp thoại
// gốc dễ bấm nhầm và chặn công cụ kiểm thử).
export function ShopItemCard({
  itemKey, name, category, rarity, rarityLabel, price, description, coins, state, preview
}: {
  itemKey: string; name: string; category: ItemCategory; rarity: ItemRarity; rarityLabel: string;
  price: number | null; description?: string; coins: number; state: ShopCardState; preview: ReactNode;
}) {
  const [confirming, setConfirming] = useState(false);
  const button = "w-full rounded-lg px-3 py-2 text-sm font-semibold transition";

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-card">
      <div className="relative">
        {preview}
        <span className={`absolute left-2 top-2 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${RARITY_BADGE[rarity]}`}>
          {rarityLabel}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <p className="text-sm font-semibold leading-tight">{name}</p>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        <div className="mt-auto">
          {state === "equipped" ? (
            <ActionForm action={equipItem}>
              <input type="hidden" name="category" value={category} />
              <input type="hidden" name="itemKey" value="" />
              <ActionSubmitButton pendingLabel="Đang tháo…" className={`${button} border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20`}>
                ✓ Đang dùng · Tháo
              </ActionSubmitButton>
            </ActionForm>
          ) : state === "owned" ? (
            <ActionForm action={equipItem}>
              <input type="hidden" name="category" value={category} />
              <input type="hidden" name="itemKey" value={itemKey} />
              <ActionSubmitButton pendingLabel="Đang trang bị…" className={`${button} bg-primary text-primary-foreground hover:bg-primary/90`}>
                Trang bị
              </ActionSubmitButton>
            </ActionForm>
          ) : state === "locked" ? (
            <p className={`${button} cursor-default border border-border text-center text-muted-foreground`}>🔒 Thành tích</p>
          ) : state === "short" ? (
            <p className={`${button} cursor-default border border-border text-center text-muted-foreground`}>
              🪙 {numberFormat.format(price ?? 0)} · thiếu {numberFormat.format((price ?? 0) - coins)}
            </p>
          ) : confirming ? (
            <ActionForm action={buyItem} onResult={() => setConfirming(false)} className="flex gap-2">
              <input type="hidden" name="itemKey" value={itemKey} />
              <button type="button" onClick={() => setConfirming(false)} className={`${button} border border-border hover:bg-muted`}>Huỷ</button>
              <ActionSubmitButton pendingLabel="Đang mua…" className={`${button} bg-amber-500 text-white hover:bg-amber-600`}>Xác nhận</ActionSubmitButton>
            </ActionForm>
          ) : (
            <button type="button" onClick={() => setConfirming(true)} className={`${button} bg-amber-500 text-white hover:bg-amber-600`}>
              Mua 🪙 {numberFormat.format(price ?? 0)}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: `app/student/shop/page.tsx`** (server, `export const dynamic = "force-dynamic"`)
  - Auth giống `app/student/profile/page.tsx` (session → `studentProfile.findUnique` theo `userId`; không có → `redirect("/login")` / `redirect("/waiting")`).
  - `try { await syncWallet(student.id); } catch (error) { console.error("[wallet] đồng bộ ở Cửa hàng lỗi", error); }`
  - Đọc song song: profile (`coins, equippedBackground, equippedFrame, displayName, avatarUrl, avatarPreset, coverColor, user.image`), `studentItem.findMany({ where: { studentId }, select: { itemKey: true } })`, và nếu `tab === "history"`: `coinTransaction.findMany({ where: { studentId }, orderBy: { createdAt: "desc" }, take: 100, select: { amount, note, createdAt } })`.
  - `searchParams`: `tab` ∈ `background|frame|history` (mặc định `background`), `rarity` ∈ `RARITY_ORDER` hoặc bỏ trống. Lọc bằng link GET (không state client).
  - Danh sách thẻ của tab = `SHOP_ITEMS` cùng category + đồ thành tích: với mỗi template cùng category, các món HS sở hữu (`resolveItem(ownedKey)` có `artKey === template.baseKey`), nếu HS chưa có món nào của template đó thì 1 thẻ mẫu khoá (`state = "locked"`, `name = template.namePrefix`, `description = template.description`). Sắp theo `RARITY_ORDER`, rồi giá.
  - `state`: equipped (mã = equipped của loại) · owned · buyable (`coins >= price`) · short · locked.
  - Preview: nền → `<BackgroundArt artKey className="aspect-[5/2] w-full" />`; khung → khung ô vuông `bg-muted/40` chứa `<StudentAvatar … size="xl" frame={item.key} />` của chính HS ở giữa (padding đủ cho khung tràn ~18%: `py-8`).
  - Bố cục: `grid gap-6 lg:grid-cols-[220px_1fr]`. Cột trái: thẻ số dư lớn "🪙 1.234 Xu" + dòng nhỏ "Kiếm Xu bằng cách làm bài (lượt đầu) và ôn Sổ từ.", 3 link tab (Nền · Khung · Lịch sử Xu), nhóm chip lọc độ hiếm (ẩn ở tab history), link "← Về hồ sơ". Cột phải: tiêu đề tab + lưới `grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4`.
  - Tab history: danh sách `divide-y`, mỗi dòng: số `+16` xanh (`text-emerald-600`) / `−300` đỏ, ghi chú, ngày `dd/mm/yyyy` (Intl vi-VN, timeZone "Asia/Ho_Chi_Minh"). Trống → "Chưa có giao dịch nào — làm bài đầu tiên để nhận Xu nhé!".

- [ ] **Step 7: Test → PASS; `npx tsc --noEmit`; `pnpm lint`**
- [ ] **Step 8: Commit** — `git commit -m "feat(xu): trang Cua hang, chip Xu, muc menu"`

---

### Task 8: Hiện đồ khắp nơi + Xu ở popup chúc mừng + phía thầy

**Files (Modify):** `app/student/profile/page.tsx`, `app/student/profile/[studentId]/page.tsx`, `lib/class-ranking.ts`, `components/class-ranking-board.tsx`, `lib/monthly-recap.ts`, `lib/monthly-recap-data.ts`, `components/monthly-recap-board.tsx`, `components/monthly-recap-panel.tsx`, `app/teacher/students/[studentId]/page.tsx`, `components/submit-celebration.tsx`, `app/student/results/[attemptId]/page.tsx`
**Test:** thêm vào `tests/wallet-guard.test.ts`

- [ ] **Step 1: Test cấu trúc (fail)**

```ts
describe("Xu — đồ hiện khắp nơi", () => {
  it.each([
    "app/student/profile/page.tsx",
    "app/student/profile/[studentId]/page.tsx",
    "app/teacher/students/[studentId]/page.tsx"
  ])("%s dùng ProfileCover", (path) => {
    expect(read(path)).toContain("<ProfileCover");
  });
  it.each([
    "components/class-ranking-board.tsx",
    "components/monthly-recap-board.tsx",
    "components/monthly-recap-panel.tsx",
    "app/student/profile/page.tsx",
    "app/student/profile/[studentId]/page.tsx"
  ])("%s truyền frame cho avatar", (path) => {
    expect(read(path)).toMatch(/frame=\{/);
  });
  it("Tổng kết tháng đổi khoá cache khi thêm khung", () => {
    expect(read("lib/monthly-recap-data.ts")).toContain('"monthly-recap-v2"');
  });
  it("popup chúc mừng nhận số Xu", () => {
    expect(read("components/submit-celebration.tsx")).toContain("coinsEarned");
  });
});
```

- [ ] **Step 2: Chạy → FAIL**

- [ ] **Step 3: Hồ sơ của mình** (`app/student/profile/page.tsx`): select thêm `equippedBackground: true, equippedFrame: true`; thay `<div className={`h-32 ${coverClassName(student.coverColor)}`} />` bằng `<ProfileCover backgroundKey={student.equippedBackground} coverColor={student.coverColor} />` (bỏ import `coverClassName` nếu không còn dùng); `StudentAvatar` thêm `frame={student.equippedFrame}`. Dưới hàng chip (sau mục tiêu band) thêm link nhỏ: `<Link href="/student/shop" className="text-primary hover:underline">Đổi nền & khung ở Cửa hàng →</Link>` (đặt trong cùng `div` chip, có dấu `·` trước).

- [ ] **Step 4: Hồ sơ bạn cùng lớp** (`app/student/profile/[studentId]/page.tsx`): select thêm 2 cột; `ProfileCover` + `frame={classmate.equippedFrame}` tương tự.

- [ ] **Step 5: Xếp hạng** — `lib/class-ranking.ts`: thêm `equippedFrame?: string | null;` vào `RankedClassStudent` và `ClassmateRow` (tuỳ chọn → fixture test cũ không vỡ); `rankClassmates` map `equippedFrame: row.equippedFrame ?? null`; `getClassRanking` map `equippedFrame: classmate.student.equippedFrame` (include đã mang mọi cột vô hướng). `components/class-ranking-board.tsx`: cả 3 `<StudentAvatar` thêm `frame={rankedStudent.equippedFrame}`.

- [ ] **Step 6: Tổng kết tháng** — `lib/monthly-recap.ts`: `RecapStudentInfo` và `RecapEntry` thêm `equippedFrame?: string | null;`; trong `buildMonthlyRecap` entry thêm `equippedFrame: info.equippedFrame ?? null`. `lib/monthly-recap-data.ts`: select học viên thêm `equippedFrame: true`, map `equippedFrame: student.equippedFrame`; đổi khoá cache `["monthly-recap-v1"]` → `["monthly-recap-v2"]` kèm comment "v2: thêm khung avatar (Xu & Cửa hàng)". Các `<StudentAvatar` trong `monthly-recap-board.tsx` (2 chỗ) và `monthly-recap-panel.tsx` (1 chỗ) thêm `frame={entry.equippedFrame}`. Ghi chú trong comment: tháng đã khép cache 1 ngày → khung mới đổi có thể trễ tới 1 ngày ở bảng tháng cũ (chấp nhận).

- [ ] **Step 7: Trang học viên phía thầy** (`app/teacher/students/[studentId]/page.tsx`): select thêm `coins, equippedBackground, equippedFrame`; trong section "Hồ sơ học viên" chèn `<ProfileCover … className="h-20 rounded-lg" />` lên đầu section; avatar ở đó giữ trơn (trang làm việc). Thêm section mới sau section hồ sơ:

```tsx
<section className="rounded-xl border border-border bg-card p-5 shadow-card">
  <h3 className="text-sm font-semibold">Xu & đồ trang trí</h3>
  <p className="mt-1 text-2xl font-bold tabular-nums">🪙 {coinFormat.format(student.coins)} Xu</p>
  {/* đồ đang có: tên qua resolveItem, đồ đang trang bị gắn chữ "(đang dùng)" */}
  {/* 20 dòng sổ gần nhất: +N/−N · note · ngày */}
</section>
```

  Dữ liệu: `prisma.studentItem.findMany({ where: { studentId: student.id }, orderBy: { createdAt: "asc" }, select: { itemKey: true } })` và `prisma.coinTransaction.findMany({ where: { studentId: student.id }, orderBy: { createdAt: "desc" }, take: 20, select: { amount: true, note: true, createdAt: true } })` — gộp vào `Promise.all` sẵn có của trang nếu có, không thì Promise.all riêng. Chỉ xem, không nút sửa.

- [ ] **Step 8: Popup chúc mừng** — `app/student/results/[attemptId]/page.tsx`: khi `!skillFilter`, đọc `prisma.coinTransaction.aggregate({ where: { studentId: attempt.studentId, attemptId: attempt.id }, _sum: { amount: true } })` và `attemptRound` của attempt (thêm vào select/query hiện có, hoặc `prisma.attempt.findUnique({ where: { id }, select: { attemptRound: true } })`); truyền `coinsEarned={sum ?? 0}` và `isRetry={attemptRound >= 2}`. `components/submit-celebration.tsx`: thêm 2 prop, dưới dòng % hiện:

```tsx
{isRetry ? (
  <p className="mt-2 text-xs text-muted-foreground">Lượt làm lại không cộng Xu.</p>
) : coinsEarned > 0 ? (
  <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-3 py-1 text-sm font-bold text-amber-700 dark:text-amber-300">
    +{coinsEarned} 🪙 Xu
  </p>
) : null}
```

- [ ] **Step 9: `pnpm test` (toàn bộ) → PASS; `npx tsc --noEmit`; `pnpm lint`**
- [ ] **Step 10: Commit** — `git commit -m "feat(xu): hien nen/khung o ho so, xep hang, tong ket thang; Xu o popup va trang thay"`

---

### Task 9: Script hồi tố + chạy trên DB test

**Files:** Create `scripts/coins-backfill.ts`

- [ ] **Step 1: Viết script**

```ts
// Hồi tố Xu cho MỌI học viên (một lần khi ra mắt Cửa hàng). Idempotent — chạy lại
// vô hại. Mặc định chỉ IN bảng số Xu sẽ có; thêm --apply mới ghi.
//   npx tsx scripts/coins-backfill.ts            (xem trước, DB trong .env)
//   npx tsx scripts/coins-backfill.ts --apply
// Chạy trên prod: đặt DATABASE_URL = chuỗi prod cho riêng lệnh này.
import { prisma } from "@/lib/prisma";
import { loadMonthlyRecap } from "@/lib/monthly-recap-data";
import { loadAchievementItems, syncWallet } from "@/lib/wallet";

async function main() {
  const apply = process.argv.includes("--apply");
  // Ngoài Next không có unstable_cache → gọi thẳng loader, tính MỘT lần cho cả trường.
  const achievements = await loadAchievementItems(loadMonthlyRecap);
  console.log(`Đồ thành tích: ${achievements.map((a) => `${a.itemKey}→${a.studentId}`).join(", ") || "(không có)"}`);

  const students = await prisma.studentProfile.findMany({ select: { id: true, displayName: true }, orderBy: { displayName: "asc" } });
  if (!apply) {
    console.log("XEM TRƯỚC — chưa ghi gì. Thêm --apply để ghi.");
    return;
  }
  for (const student of students) {
    const result = await syncWallet(student.id, { achievements });
    const profile = await prisma.studentProfile.findUniqueOrThrow({ where: { id: student.id }, select: { coins: true } });
    console.log(`${student.displayName.padEnd(28)} +${result.created} dòng, ${result.items} đồ → ${profile.coins} Xu`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
```

(Xem trước chỉ in đồ thành tích + danh sách; số Xu dự kiến đã có từ `tmp/_coin-estimate.mjs`.)

- [ ] **Step 2: Chạy trên DB test:** `npx tsx scripts/coins-backfill.ts` rồi `--apply`. Kỳ vọng: không lỗi, mỗi HS có số Xu ≥ 0; chạy `--apply` lần 2 → mọi dòng `+0 dòng, 0 đồ` và số Xu không đổi (idempotent).
- [ ] **Step 3: Kiểm tổng:** truy vấn `SELECT "studentId", SUM(amount) FROM "CoinTransaction" GROUP BY 1` so với `StudentProfile.coins` — khớp 100%.
- [ ] **Step 4: Commit** — `git add scripts/coins-backfill.ts && git commit -m "feat(xu): script hoi to Xu"`

---

### Task 10: Kiểm thật ở local

- [ ] `pnpm test`, `pnpm lint`, `pnpm build` — tất cả xanh.
- [ ] `preview_start` dev server; đăng nhập GV seed (`teacher@example.com`) → trang học viên: thấy khối "Xu & đồ trang trí", bìa có nền nếu HS đã trang bị.
- [ ] Phía HS (đăng nhập Google — không làm được ở local): dùng script tạm `tmp/_xu-local.mjs` gán `equippedFrame`/`equippedBackground` + `StudentItem` cho HS seed trên DB test để xem khung/nền ở bảng xếp hạng phía GV (`/teacher/ranking`) và trang HS phía GV. Chụp khổ 375px sáng/tối.
- [ ] Kiểm khung không làm xô hàng ở bảng xếp hạng (avatar 36px) và bục.

### Task 11: Ra mắt

- [ ] `git push` lên `feature/ielts-platform-mvp` → Vercel build chạy `ensure-db` (tạo bảng/cột trên prod).
- [ ] Xác minh cột/bảng có trên Neon `IELTS_Platform` (prod).
- [ ] Chạy hồi tố trên prod: `DATABASE_URL=<prod> npx tsx scripts/coins-backfill.ts` (xem trước) rồi `--apply`. Nếu lệnh ghi prod bị chặn → đưa thầy đúng lệnh để tự chạy.
- [ ] Mở prod trong Chrome (tài khoản HS thầy đã đăng nhập): `/student/shop` thấy số dư, mua 1 món rẻ? — **KHÔNG tự mua bằng tài khoản HS thật**; chỉ xem, nhờ thầy bấm thử. Xem hồ sơ, xếp hạng, popup sau nộp.
- [ ] Cập nhật memory (gamification-status / file mới về Xu).
