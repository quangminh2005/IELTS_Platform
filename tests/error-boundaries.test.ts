import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(join(root, ...parts), "utf8");

// Bỏ phần chú thích trước khi soi nội dung: chính các comment trong hai file
// đó có nhắc lại câu tiếng Anh của Next và tên file globals.css để giải thích
// bối cảnh — soi cả comment thì test báo hỏng oan.
const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

// Bối cảnh: sự cố 25/8/2026. Một chunk JS lỗi cú pháp trên iPhone đời cũ làm
// trắng trang /login, và vì app/ không có màn hình lỗi nào nên học viên chỉ thấy
// đúng một dòng tiếng Anh của Next ("Application error: a client-side exception
// has occurred") — không hiểu chuyện gì, không biết bấm gì. Các chốt dưới đây
// giữ cho hai màn hình đỡ lỗi luôn còn và luôn dùng được.
describe("màn hình báo lỗi tiếng Việt", () => {
  describe("app/error.tsx — lỗi trong một trang", () => {
    const source = read("app", "error.tsx");
    const code = stripComments(source);

    it("có tồn tại và là client component", () => {
      expect(source).toMatch(/^"use client";/);
    });

    it("có nút Thử lại gọi reset() và đường về trang chủ", () => {
      expect(source).toContain("Thử lại");
      expect(source).toContain("onClick={reset}");
      expect(source).toContain('href="/"');
    });

    it("không để lọt dòng tiếng Anh mặc định của Next ra màn hình", () => {
      expect(code).not.toContain("Application error");
    });
  });

  describe("app/global-error.tsx — lỗi ở khung trang gốc", () => {
    const source = read("app", "global-error.tsx");
    const code = stripComments(source);

    it("tự dựng <html> và <body> vì nó thay thế layout gốc", () => {
      expect(source).toContain("<html");
      expect(source).toContain("<body>");
    });

    it("có nút Thử lại gọi reset() và đường về trang chủ", () => {
      expect(source).toContain("Thử lại");
      expect(source).toContain("onClick={reset}");
      expect(source).toContain('href="/"');
    });

    // Chốt quan trọng nhất của file này: khi layout gốc đã chết thì bảng style
    // của nó có thể chưa kịp nạp, nên màn hình đỡ lỗi phải tự mang màu của mình.
    it("không dựa vào globals.css hay class Tailwind", () => {
      expect(code).not.toContain("globals.css");
      expect(code).toContain("<style");
      // Class Tailwind kiểu bg-*/text-* sẽ vô nghĩa nếu bảng style chưa nạp.
      expect(source).not.toMatch(/className="[^"]*\b(bg|text|border)-(card|foreground|border)\b/);
    });
  });
});

describe("dải trình duyệt được hỗ trợ", () => {
  const pkg = JSON.parse(read("package.json")) as { browserslist?: string[] };

  it("package.json có khai báo browserslist", () => {
    expect(Array.isArray(pkg.browserslist)).toBe(true);
  });

  // Học viên làm bài bằng điện thoại, nhiều máy là iPhone đời cũ.
  it("còn phủ iPhone chạy iOS 15.6", () => {
    expect(pkg.browserslist).toContain("iOS >= 15.6");
  });
});
