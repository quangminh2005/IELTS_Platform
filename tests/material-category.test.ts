import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeCategoryFields, UNNAMED_SHELF } from "../lib/material-category";

const root = join(__dirname, "..");

describe("normalizeCategoryFields", () => {
  it("book giữ tên sách đã gọn khoảng trắng", () => {
    expect(
      normalizeCategoryFields({ category: "book", bookName: "  IELTS  Master –  Listening " })
    ).toEqual({ category: "book", bookName: "IELTS Master – Listening" });
  });

  it("homework luôn bỏ tên sách", () => {
    expect(normalizeCategoryFields({ category: "homework", bookName: "Cambridge 20" })).toEqual({
      category: "homework",
      bookName: null
    });
  });

  it("giá trị lạ / thiếu -> homework", () => {
    expect(normalizeCategoryFields({ category: null, bookName: null })).toEqual({
      category: "homework",
      bookName: null
    });
    expect(normalizeCategoryFields({ category: "sach", bookName: "x" }).category).toBe("homework");
  });

  it("book mà tên rỗng -> bookName null", () => {
    expect(normalizeCategoryFields({ category: "book", bookName: "   " })).toEqual({
      category: "book",
      bookName: null
    });
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

  // Dự án không dùng migrations: cột mới chỉ lên được prod qua ensure-db.mjs.
  it("ensure-db.mjs", () => {
    expect(ensureDb).toContain(
      `"Material" ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'homework'`
    );
    expect(ensureDb).toContain(`"Material" ADD COLUMN IF NOT EXISTS "bookName" TEXT`);
  });
});

describe("action lưu category/bookName", () => {
  const src = readFileSync(join(root, "lib", "actions", "materials.ts"), "utf8");

  it("dùng normalizeCategoryFields ở create/update/import", () => {
    expect(src.match(/normalizeCategoryFields\(/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
  });

  it("import schema nhận category/bookName", () => {
    expect(src).toMatch(
      /importMaterialSchema = z\.object\(\{[\s\S]*category: z\.string\(\)\.optional\(\)/
    );
  });
});
