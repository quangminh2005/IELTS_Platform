import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(process.cwd(), "components", "feed");
const read = (name: string) => readFileSync(join(dir, name), "utf8");

// Mạng xã hội Đợt 3: bình luận và tên là chữ người dùng nhập.
describe("component bảng tin", () => {
  it("không render HTML thô", () => {
    for (const name of readdirSync(dir).filter((file) => file.endsWith(".tsx"))) {
      expect(read(name)).not.toContain("dangerouslySetInnerHTML");
    }
  });

  it("ô bình luận giới hạn 200 ký tự", () => {
    expect(read("feed-card.tsx")).toMatch(/COMMENT_MAX = 200/);
    expect(read("feed-card.tsx")).toContain("maxLength={COMMENT_MAX}");
  });

  it("không tự tim hoạt động của mình", () => {
    expect(read("feed-card.tsx")).toMatch(/disabled=\{isOwn\}/);
  });

  it("gỡ bình luận phải bấm 2 lần, không dùng window.confirm", () => {
    const list = read("teacher-comment-list.tsx");
    expect(list).toContain("Chắc chắn gỡ?");
    expect(list).not.toMatch(/confirm\(/);
  });
});
