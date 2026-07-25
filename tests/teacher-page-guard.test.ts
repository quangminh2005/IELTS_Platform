import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

// Liệt kê mọi page.tsx dưới app/teacher.
function teacherPages(dir = join(root, "app", "teacher")): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);

    if (entry.isDirectory()) {
      return teacherPages(full);
    }

    return entry.name === "page.tsx" ? [full] : [];
  });
}

describe("guard của trang giáo viên", () => {
  const pages = teacherPages();

  it("tìm thấy các trang giáo viên", () => {
    expect(pages.length).toBeGreaterThan(10);
  });

  // requireTeacher() NÉM lỗi -> dùng thẳng trong page thì khách chưa đăng nhập
  // gặp màn hình "Application error". Trang phải dùng requireTeacherPage(),
  // nó chuyển hướng về /login. Server action thì vẫn dùng requireTeacher().
  it.each(pages.map((path) => [path.slice(root.length + 1).replace(/\\/g, "/"), path] as const))(
    "%s dùng requireTeacherPage, không gọi thẳng requireTeacher",
    (_label, path) => {
      const source = readFileSync(path, "utf8");

      expect(source).toContain("requireTeacherPage()");
      expect(source).not.toMatch(/\brequireTeacher\(\)/);
    }
  );

  it("requireTeacherPage chuyển hướng về /login", () => {
    const source = readFileSync(join(root, "lib", "teacher-page.ts"), "utf8");

    expect(source).toContain('redirect("/login")');
  });
});
