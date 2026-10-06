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

describe("trang Xếp hạng học viên", () => {
  const page = read("app/student/ranking/page.tsx");

  it("có đủ 3 bảng và lấy tham số qua resolveRankingParams", () => {
    expect(page).toContain("resolveRankingParams(");
    expect(page).toContain("<XpBoardHeader");
    expect(page).toContain("<StreakBoardHeader");
    expect(page).toContain("<ClassRankingBoard");
  });

  it("bảng Học Bá/Chuỗi link sang hồ sơ học viên, không sang trang giáo viên", () => {
    expect(page).toMatch(/<LeaderboardBoard[^>]*linkTarget="student"/);
    expect(page).not.toContain('linkTarget="teacher"');
  });

  it("Tổng kết tháng của học viên link tên sang hồ sơ", () => {
    expect(read("components/monthly-recap-panel.tsx")).toContain('profileLinkTarget="student"');
  });
});

describe("khối bảng xếp hạng ở trang chủ", () => {
  it("getHomeLeaderboard tự nuốt lỗi — trang chủ không bao giờ sập vì bảng", () => {
    const source = read("lib/leaderboard-data.ts");
    expect(source).toMatch(/export async function getHomeLeaderboard[\s\S]*?try \{[\s\S]*?catch \(error\)/);
  });

  it("trang chủ hiện khối sau hàng thẻ chuỗi/hạng, trước thẻ Từ vựng", () => {
    const page = read("app/student/page.tsx");
    expect(page).toContain("getHomeLeaderboard(student.id)");
    const card = page.indexOf("<HomeLeaderboardCard");
    expect(card).toBeGreaterThan(page.indexOf("<ProgressRing"));
    expect(card).toBeLessThan(page.indexOf("<VocabCard"));
  });
});
