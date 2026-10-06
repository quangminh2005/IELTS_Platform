import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (relative: string) => readFileSync(join(process.cwd(), ...relative.split("/")), "utf8");

// Mạng xã hội Đợt 3 — bảng tin.
describe("bảng tin không lộ điểm", () => {
  for (const file of ["lib/feed.ts", "lib/feed-data.ts"]) {
    it(`${file} không đọc điểm / band`, () => {
      const source = read(file);
      expect(source).not.toMatch(/\bscore\b|scorePercent|overallBand|Band\b/);
    });
  }

  it("danh sách cả trường cache theo tag bảng xếp hạng (submitSkill tự xoá)", () => {
    const source = read("lib/feed-data.ts");
    expect(source).toContain("tags: [LEADERBOARD_CACHE_TAG]");
    expect(source).toContain('"school-feed-v1"');
  });
});

describe("action bảng tin", () => {
  const source = read("lib/actions/feed.ts");

  it("là server action, mọi action gọi requireFeedUser đầu tiên", () => {
    expect(source.startsWith('"use server"')).toBe(true);
    const bodies = source.split(/export async function /).slice(1);
    expect(bodies.length).toBe(4);
    for (const body of bodies) {
      expect(body.match(/await\s+([A-Za-z]+)/)?.[1]).toBe("requireFeedUser");
    }
  });

  it("đối chiếu eventKey với bảng tin thật", () => {
    expect(source.match(/findFeedEvent\(/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("lọc thô tục, giới hạn 30 bình luận/ngày, chặn trùng tim, không cộng Xu", () => {
    expect(source).toContain("containsProfanity(");
    expect(source).toMatch(/COMMENT_DAILY_LIMIT = 30/);
    expect(source).toContain("P2002");
    expect(source).not.toMatch(/coinTransaction|syncWallet/);
  });

  it("xoá bình luận qua canDeleteComment (người viết / chủ hoạt động / thầy)", () => {
    expect(source).toContain("canDeleteComment(");
  });
});
