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
