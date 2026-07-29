import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

const materialsSource = readFileSync(join(root, "lib", "actions", "materials.ts"), "utf8");
const fieldsSource = readFileSync(join(root, "components", "question-fields.tsx"), "utf8");

function block(source: string, header: string, close: string): string {
  const start = source.indexOf(header);
  expect(start, `không tìm thấy "${header}"`).toBeGreaterThanOrEqual(0);

  const end = source.indexOf(close, start);
  expect(end, `không tìm thấy đoạn kết "${close}"`).toBeGreaterThan(start);

  return source.slice(start, end);
}

// Nguồn sự thật: z.enum(questionTypes) trong action lưu câu hỏi.
const questionTypes = Array.from(
  block(materialsSource, "const questionTypes = [", "] as const;").matchAll(/"([a-z_]+)"/g)
).map((match) => match[1]);

// Ô select "Dạng câu" ở form sửa câu hỏi.
const optionsBlock = block(fieldsSource, "const questionTypeOptions = [", "\n];");
const optionValues = Array.from(optionsBlock.matchAll(/value:\s*"([a-z_]+)"/g)).map(
  (match) => match[1]
);

// Metadata mô tả từng dạng (ẩn/hiện ô Lựa chọn, gợi ý nhập liệu).
const metaBlock = block(fieldsSource, "const typeMeta: Record<string, TypeMeta> = {", "\n};");
const metaKeys = Array.from(metaBlock.matchAll(/^ {2}([a-z_]+):\s*\{/gm)).map((match) => match[1]);

describe("select Dạng câu phủ hết questionTypes", () => {
  it("đọc được cả ba danh sách", () => {
    expect(questionTypes.length).toBeGreaterThan(5);
    expect(optionValues.length).toBeGreaterThan(5);
    expect(metaKeys.length).toBeGreaterThan(5);
  });

  // Thiếu một dạng ở đây là bug âm thầm: select không có option khớp giá trị đang
  // lưu nên DOM rơi về option đầu tiên (multiple_choice), bấm Lưu là câu bị đổi
  // dạng — bài Viết mất khung soạn thảo và chuyển từ chấm tay sang tự chấm.
  it.each(questionTypes)("dạng %s có trong questionTypeOptions", (type) => {
    expect(optionValues).toContain(type);
  });

  it.each(questionTypes)("dạng %s có mục trong typeMeta", (type) => {
    expect(metaKeys).toContain(type);
  });

  it("không có option lạ ngoài questionTypes", () => {
    for (const value of optionValues) {
      expect(questionTypes).toContain(value);
    }
  });

  it("writing_task và speaking_task không hiện ô Lựa chọn", () => {
    for (const type of ["writing_task", "speaking_task"]) {
      const entry = block(metaBlock, `  ${type}: {`, "\n  }");

      expect(entry).toContain("showOptions: false");
    }
  });
});
