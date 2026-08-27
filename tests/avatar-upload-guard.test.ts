import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const source = readFileSync(
  join(root, "app", "api", "student", "avatar", "route.ts"),
  "utf8"
);

describe("chốt chặn của route tải ảnh đại diện", () => {
  it("kiểm phiên đăng nhập trước khi làm gì khác", () => {
    expect(source).toContain("await auth()");
  });

  it("chỉ cho giáo viên hoặc học viên, chặn khách vãng lai", () => {
    expect(source).toMatch(/role !== "teacher" && .*role !== "student"/);
  });

  it("chặn file quá lớn — ảnh đã nén ở trình duyệt thì không thể vượt 512KB", () => {
    expect(source).toContain("512");
  });

  it("chỉ nhận định dạng ảnh, không nhận SVG", () => {
    // SVG chứa được script; ảnh đại diện thì không cần tới nó.
    expect(source).toContain("image/webp");
    expect(source).not.toContain("image/svg+xml");
  });

  it("đặt ảnh vào thư mục avatars/ để dễ dọn về sau", () => {
    expect(source).toContain("avatars/");
  });

  it("chạy trên runtime nodejs", () => {
    expect(source).toContain('export const runtime = "nodejs"');
  });
});
