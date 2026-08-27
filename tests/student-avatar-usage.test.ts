import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(relative: string): string {
  return readFileSync(join(root, ...relative.split("/")), "utf8");
}

describe("bảng xếp hạng dùng chung component avatar", () => {
  const board = read("components/class-ranking-board.tsx");

  it("không còn tự định nghĩa chữ cái viết tắt", () => {
    // Hai bản sao của cùng một thuật toán là hai chỗ để lệch nhau.
    expect(board).not.toContain("function initials(");
    expect(board).not.toContain("function avatarColor(");
  });

  it("dùng component StudentAvatar", () => {
    expect(board).toContain("StudentAvatar");
  });
});

describe("class-ranking mang đủ dữ liệu avatar", () => {
  const ranking = read("lib/class-ranking.ts");

  it("truy vấn lấy cả avatarUrl và avatarPreset của hồ sơ", () => {
    expect(ranking).toContain("avatarPreset");
  });
});
