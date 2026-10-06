import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(process.cwd(), "components", "social");
const files = readdirSync(dir).filter((name) => name.endsWith(".tsx"));
const read = (name: string) => readFileSync(join(dir, name), "utf8");

// Mạng xã hội Đợt 2: tên hiển thị là chữ do học viên nhập.
describe("component mạng xã hội", () => {
  it("không component nào render HTML thô", () => {
    expect(files.length).toBeGreaterThanOrEqual(5);
    for (const name of files) {
      expect(read(name)).not.toContain("dangerouslySetInnerHTML");
    }
  });

  it("ô tìm bạn lọc không dấu qua searchStudents", () => {
    expect(read("friends-card.tsx")).toMatch(/searchStudents\(/);
  });

  it("avatar đi qua component dùng chung", () => {
    expect(read("follow-lists.tsx")).toMatch(/<StudentAvatar\b/);
  });

  it("bỏ theo dõi phải lên cò trước, không lên cò bằng focus", () => {
    const button = read("follow-button.tsx");
    expect(button).toMatch(/if \(following && !armed\)/);
    expect(button).not.toMatch(/onFocus=/);
  });

  it("nút cảm xúc khoá sau khi gửi trong ngày", () => {
    expect(read("reaction-bar.tsx")).toMatch(/disabled=\{done\}/);
  });
});
