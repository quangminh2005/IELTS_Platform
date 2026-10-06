import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const schema = readFileSync(join(process.cwd(), "prisma", "schema.prisma"), "utf8");
const ensureDb = readFileSync(join(process.cwd(), "scripts", "ensure-db.mjs"), "utf8");

// Mạng xã hội Đợt 2 (spec 2026-10-06-xa-hoi-dot-2): 2 bảng mới phải có cả trong
// schema lẫn ensure-db — thiếu ensure-db là prod sập khi đọc bảng.
describe("Mạng xã hội Đợt 2 — schema", () => {
  it("có bảng Follow với khoá chính ghép", () => {
    expect(schema).toMatch(/model Follow \{[\s\S]*?@@id\(\[followerId, followingId\]\)/);
  });

  it("ProfileReaction chặn trùng theo ngày", () => {
    expect(schema).toMatch(/model ProfileReaction \{[\s\S]*?@@unique\(\[fromId, toId, kind, dayKey\]\)/);
  });

  it("comment enum liệt kê 3 loại cảm xúc", () => {
    expect(schema).toMatch(/ReactionKind[^\n]*cheer[^\n]*fire[^\n]*target/);
  });

  it("ensure-db tạo cả 2 bảng trên prod", () => {
    expect(ensureDb).toContain('CREATE TABLE IF NOT EXISTS "Follow"');
    expect(ensureDb).toContain('CREATE TABLE IF NOT EXISTS "ProfileReaction"');
    expect(ensureDb).toContain('"ProfileReaction_fromId_toId_kind_dayKey_key"');
    expect(ensureDb).toContain("Follow_followingId_fkey");
    expect(ensureDb).toContain("ProfileReaction_toId_fkey");
  });
});
