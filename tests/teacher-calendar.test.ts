import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("teacher calendar wiring", () => {
  it("thêm mục nav Lịch giao bài vào app-shell", () => {
    const shell = read("components/app-shell.tsx");
    expect(shell).toContain('href: "/teacher/calendar"');
    expect(shell).toContain("Lịch giao bài");
    expect(shell).toContain('case "calendar"');
  });
});
