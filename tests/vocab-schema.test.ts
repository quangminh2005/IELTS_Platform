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

  it("bản dịch câu ví dụ có cột riêng và ensure-db tự thêm lên prod", () => {
    const block = schema.split("model VocabWord {")[1].split("}")[0];
    expect(block).toMatch(/exampleVi\s+String\?/);
    expect(ensureDb).toContain('ALTER TABLE "VocabWord" ADD COLUMN IF NOT EXISTS "exampleVi" TEXT;');
  });

  it("thầy thêm từ tay phải kèm bản dịch câu ví dụ", () => {
    const actions = readFileSync(join(process.cwd(), "lib", "actions", "vocab.ts"), "utf8");
    const createBlock = actions.split("const createSchema")[1].split("});")[0];
    expect(createBlock).toMatch(/exampleVi: z\.string\(\)\.trim\(\)\.min\(1/);
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
