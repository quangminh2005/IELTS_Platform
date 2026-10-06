import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function read(relative: string): string {
  return readFileSync(join(process.cwd(), ...relative.split("/")), "utf8").replace(/\r\n/g, "\n");
}

describe("bảng xếp hạng — cache", () => {
  it("submitSkill xoá cache bảng xếp hạng sau khi nộp", () => {
    const source = read("lib/actions/attempts.ts");
    expect(source).toContain("revalidateTag(LEADERBOARD_CACHE_TAG)");
  });

  it("Học Bá tháng hiện tại có cache gắn tag, vẫn giữ khoá tháng cũ v2", () => {
    const source = read("lib/monthly-recap-data.ts");
    expect(source).toContain('"monthly-recap-v2"');
    expect(source).toContain('"monthly-recap-live-v1"');
    expect(source).toContain("tags: [LEADERBOARD_CACHE_TAG]");
  });

  it("bảng Chuỗi cache theo khoá NGÀY (chuỗi), không theo Date", () => {
    const source = read("lib/leaderboard-data.ts");
    expect(source).toContain("cachedStreakBoard(vietnamDateKey(now))");
    expect(source).toContain("tags: [LEADERBOARD_CACHE_TAG]");
  });
});
