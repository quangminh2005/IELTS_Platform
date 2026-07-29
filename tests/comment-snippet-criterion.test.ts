import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_COMMENT_SNIPPETS } from "../lib/default-comment-snippets";
import { SPEAKING_CRITERIA, WRITING_CRITERIA } from "../lib/writing-review";

const root = join(__dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

// Giá trị tiêu chí phải khớp ở BA nơi (quy ước trong CLAUDE.md): comment ở đầu
// schema, z.enum trong action, và các key tiêu chí trong lib/writing-review.ts.
const CRITERION_KEYS = [
  ...WRITING_CRITERIA.map((criterion) => criterion.key),
  ...SPEAKING_CRITERIA.map((criterion) => criterion.key)
];

describe("CommentSnippet.criterion đồng bộ ba nơi", () => {
  it("prisma/schema.prisma khai báo cột criterion và liệt kê giá trị hợp lệ", () => {
    const schema = read("prisma/schema.prisma");

    expect(schema).toMatch(/enum ReviewCriterion/);
    expect(schema).toMatch(/criterion String\?/);

    for (const key of new Set(CRITERION_KEYS)) {
      expect(schema, `thiếu "${key}" trong comment ReviewCriterion`).toContain(key);
    }
  });

  it("zod enum trong action liệt kê đủ các tiêu chí", () => {
    const action = read("lib/actions/comment-snippets.ts");

    for (const key of new Set(CRITERION_KEYS)) {
      expect(action, `thiếu "${key}" trong CRITERION_KEYS của action`).toContain(`"${key}"`);
    }
  });

  it("scripts/ensure-db.mjs có câu lệnh thêm cột (nếu quên, prod sẽ sập)", () => {
    expect(read("scripts/ensure-db.mjs")).toMatch(
      /ALTER TABLE "CommentSnippet" ADD COLUMN IF NOT EXISTS "criterion"/
    );
  });
});

describe("DEFAULT_COMMENT_SNIPPETS", () => {
  it("mọi câu đều gắn tiêu chí hợp lệ hoặc để null (nhận xét chung)", () => {
    for (const snippet of DEFAULT_COMMENT_SNIPPETS) {
      if (snippet.criterion !== null) {
        expect(CRITERION_KEYS, `tiêu chí lạ: ${snippet.criterion}`).toContain(snippet.criterion);
      }
    }
  });

  it("không có câu trùng nhau — action bỏ trùng theo nội dung", () => {
    const texts = DEFAULT_COMMENT_SNIPPETS.map((snippet) => snippet.text);
    expect(new Set(texts).size).toBe(texts.length);
  });

  it("phủ đủ 4 tiêu chí Writing để chấm Writing lúc nào cũng có gợi ý", () => {
    for (const criterion of WRITING_CRITERIA) {
      expect(
        DEFAULT_COMMENT_SNIPPETS.some((snippet) => snippet.criterion === criterion.key),
        `chưa có câu mẫu nào cho ${criterion.label}`
      ).toBe(true);
    }
  });

  it("câu nào cũng có nội dung và không quá dài (giới hạn 2000 của action)", () => {
    for (const snippet of DEFAULT_COMMENT_SNIPPETS) {
      expect(snippet.text.trim().length).toBeGreaterThan(0);
      expect(snippet.text.length).toBeLessThanOrEqual(2000);
      expect(snippet.text).toBe(snippet.text.trim());
    }
  });
});
