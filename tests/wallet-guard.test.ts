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

describe("Xu — móc ví không chặn nộp bài", () => {
  it("submitSkill đồng bộ ví theo attempt, bọc try/catch", () => {
    expect(read("lib/actions/attempts.ts")).toMatch(
      /try\s*\{\s*await syncWallet\(student\.id, \{ attemptId: attempt\.id \}\);?\s*\}\s*catch/
    );
  });

  it("answerVocabCard đồng bộ Xu ôn từ hôm nay, bọc try/catch", () => {
    expect(read("lib/actions/vocab-deck.ts")).toMatch(
      /try\s*\{\s*await syncVocabToday\(student\.id, now\);?\s*\}\s*catch/
    );
  });

  it("mọi lần ghi ví khoá dòng học viên và đặt lại số dư bằng tổng sổ", () => {
    const wallet = read("lib/wallet.ts");
    expect(wallet).toContain("FOR UPDATE");
    expect(wallet).toContain("_sum: { amount: true }");
    expect(wallet).not.toMatch(/coins:\s*\{\s*(increment|decrement)/);
  });
});

describe("Xu — action cửa hàng", () => {
  it("mọi action gọi requireStudent đầu tiên", () => {
    const bodies = read("lib/actions/shop.ts").split("export async function").slice(1);
    expect(bodies.length).toBe(2);
    for (const body of bodies) {
      expect(body).toMatch(
        /^\s*\w+\(formData: FormData\): Promise<ActionResult> \{\s*try \{\s*const student = await requireStudent\(\);/
      );
    }
  });

  it("mua: không bán đồ không có giá, khoá dòng, đặt lại số dư trong transaction", () => {
    const shop = read("lib/actions/shop.ts");
    expect(shop).toContain("item.price === null");
    expect(shop).toContain("lockStudent(tx, student.id)");
    expect(shop).toContain("recomputeCoins(tx, student.id)");
  });
});

describe("Xu — trang Cửa hàng", () => {
  it("trang shop đồng bộ ví trong try/catch trước khi đọc số dư", () => {
    expect(read("app/student/shop/page.tsx")).toMatch(/try\s*\{\s*await syncWallet\(student\.id\);?\s*\}\s*catch/);
  });

  it("menu học viên có Cửa hàng; AppShell hiện chip Xu", () => {
    const shell = read("components/app-shell.tsx");
    expect(shell).toContain('href: "/student/shop"');
    expect(shell).toContain("CoinChip");
  });
});

describe("Xu — đồ hiện khắp nơi", () => {
  it.each([
    "app/student/profile/page.tsx",
    "app/student/profile/[studentId]/page.tsx",
    "components/student-wallet-summary.tsx"
  ])("%s dùng ProfileCover", (path) => {
    expect(read(path)).toContain("<ProfileCover");
  });

  it("trang học viên phía thầy có khối Xu", () => {
    expect(read("app/teacher/students/[studentId]/page.tsx")).toContain("<StudentWalletSummary");
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
