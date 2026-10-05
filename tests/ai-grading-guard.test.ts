import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const read = (path: string) => readFileSync(path, "utf8");

describe("AI chấm — schema", () => {
  const schema = read("prisma/schema.prisma");
  const ensureDb = read("scripts/ensure-db.mjs");

  it("schema có model AiReview và cột aiDailyLimit", () => {
    expect(schema).toMatch(/model AiReview \{/);
    expect(schema).toMatch(/aiDailyLimit\s+Int\?/);
    expect(schema).toContain("aiReviews");
  });

  it("comment enum ghi giá trị requestedBy và status", () => {
    expect(schema).toContain("// enum AiRequester (AiReview.requestedBy): teacher | student");
    expect(schema).toContain("// enum AiReviewStatus (AiReview.status): pending | done | failed");
  });

  it("ensure-db.mjs tạo bảng AiReview và cột aiDailyLimit", () => {
    expect(ensureDb).toContain('CREATE TABLE IF NOT EXISTS "AiReview"');
    expect(ensureDb).toContain('"AiReview_studentId_createdAt_idx"');
    expect(ensureDb).toContain('ALTER TABLE "TeacherProfile" ADD COLUMN IF NOT EXISTS "aiDailyLimit" INTEGER;');
  });
});

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === "node_modules" ? [] : sourceFiles(full);
    return /\.(ts|tsx|mjs)$/.test(name) ? [full] : [];
  });
}

describe("AI chấm — chỉ một nơi gọi OpenAI", () => {
  it("chỉ lib/ai-grading/openai.ts import gói openai", () => {
    const offenders = ["app", "components", "lib", "scripts"]
      .flatMap((dir) => sourceFiles(dir))
      .filter((file) => /from\s+["']openai(\/[^"']*)?["']/.test(readFileSync(file, "utf8")))
      .map((file) => file.split("\\").join("/"));
    expect(offenders).toEqual(["lib/ai-grading/openai.ts"]);
  });
});
