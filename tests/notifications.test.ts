import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("lược đồ thông báo", () => {
  it("StudentProfile có cột notificationsReadAt", () => {
    const schema = readFileSync("prisma/schema.prisma", "utf8");
    const model = schema.slice(
      schema.indexOf("model StudentProfile"),
      schema.indexOf("model Class")
    );
    expect(model).toContain("notificationsReadAt");
  });

  // Quên câu này là prod 500 rải rác: Prisma Client không kiểm schema lúc chạy,
  // lỗi chỉ lộ ra khi có request đụng đúng cột còn thiếu.
  it("ensure-db.mjs có câu thêm cột notificationsReadAt", () => {
    const script = readFileSync("scripts/ensure-db.mjs", "utf8");
    expect(script).toContain(
      '"StudentProfile" ADD COLUMN IF NOT EXISTS "notificationsReadAt"'
    );
  });
});
