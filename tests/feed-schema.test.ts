import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const schema = readFileSync(join(process.cwd(), "prisma", "schema.prisma"), "utf8");
const ensureDb = readFileSync(join(process.cwd(), "scripts", "ensure-db.mjs"), "utf8");

// Mạng xã hội Đợt 3 (spec 2026-10-06-xa-hoi-dot-3): tim + bình luận bảng tin.
describe("Mạng xã hội Đợt 3 — schema", () => {
  it("FeedHeart: mỗi người tim một hoạt động một lần", () => {
    expect(schema).toMatch(/model FeedHeart \{[\s\S]*?@@id\(\[eventKey, userId\]\)/);
  });

  it("FeedComment có chủ hoạt động + tác giả là User", () => {
    expect(schema).toMatch(/model FeedComment \{[\s\S]*?ownerStudentId\s+String[\s\S]*?authorUserId\s+String/);
  });

  it("ensure-db tạo cả 2 bảng + khoá ngoại trên prod", () => {
    expect(ensureDb).toContain('CREATE TABLE IF NOT EXISTS "FeedHeart"');
    expect(ensureDb).toContain('CREATE TABLE IF NOT EXISTS "FeedComment"');
    expect(ensureDb).toContain("FeedHeart_userId_fkey");
    expect(ensureDb).toContain("FeedComment_ownerStudentId_fkey");
    expect(ensureDb).toContain("FeedComment_authorUserId_fkey");
  });
});
