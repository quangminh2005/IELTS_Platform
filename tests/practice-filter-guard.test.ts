import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

// Bài tự luyện được dựng thành Assignment.mode = "practice". Mọi nơi liệt kê bài
// GIAO phải loại chúng ra, nếu không danh sách của giáo viên sẽ ngập bài ảo.
const mustExcludePractice = [
  "app/teacher/assignments/page.tsx",
  "app/teacher/calendar/page.tsx",
  "app/student/page.tsx",
  "lib/actions/assignments.ts",
  "app/teacher/students/[studentId]/page.tsx",
  "app/teacher/page.tsx"
];

function read(relative: string): string {
  return readFileSync(join(root, ...relative.split("/")), "utf8");
}

describe("lọc bài tự luyện khỏi danh sách bài giao", () => {
  it.each(mustExcludePractice)("%s dùng mảnh lọc từ lib/practice", (relative) => {
    const source = read(relative);

    expect(source).toContain('from "@/lib/practice"');
    expect(source).toContain("excludePracticeAssignment");
  });

  // Chuỗi "practice" chỉ được viết ở đúng một chỗ, để đổi giá trị không sót nơi nào.
  it.each(mustExcludePractice)("%s không tự viết chuỗi practice", (relative) => {
    expect(read(relative)).not.toMatch(/mode:\s*["']practice["']/);
  });

  // Cron nhắc hạn không cần lọc mode vì nó chỉ lấy bài CÓ hạn nộp, mà bài giao ảo
  // luôn deadline = null. Test này khoá lại điều kiện đó: bỏ nó đi là học viên sẽ
  // nhận mail nhắc cho chính bài mình tự luyện.
  it("cron nhắc hạn vẫn lọc theo deadline", () => {
    const source = read("app/api/cron/reminders/route.ts");

    expect(source).toMatch(/assignment:\s*\{\s*deadline:/);
  });
});
