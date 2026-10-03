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
