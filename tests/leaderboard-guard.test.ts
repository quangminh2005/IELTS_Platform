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

  it("phạm vi Bạn bè (Đợt 2) = mình + người mình theo dõi, chưa theo dõi ai thì mời tìm bạn", () => {
    expect(page).toContain("getFollowingIds(student.id)");
    expect(page).toContain("friendScope(student.id, friendIds)");
    expect(page).toContain('href="/student/profile#ban-be"');
    expect(read("components/leaderboard/ranking-switcher.tsx")).toContain('scope: "friends"');
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

describe("tab Chuỗi của giáo viên", () => {
  const page = read("app/teacher/ranking/page.tsx");

  it("có tab view=streak, link tên sang trang học viên của thầy", () => {
    expect(page).toContain('href="/teacher/ranking?view=streak"');
    expect(page).toMatch(/<LeaderboardBoard[^>]*linkTarget="teacher"/);
    expect(page).not.toContain('linkTarget="student"');
  });

  it("chọn lớp chỉ trong lớp của thầy (lọc teacherId)", () => {
    expect(page).toMatch(/async function StreakView[\s\S]*?where: \{ teacherId \}/);
  });
});

describe("ẩn tài khoản thử khỏi bảng xếp hạng", () => {
  it("cột hiddenFromBoards có trong schema và ensure-db (tự lên prod khi build)", () => {
    expect(read("prisma/schema.prisma")).toMatch(/hiddenFromBoards\s+Boolean\s+@default\(false\)/);
    expect(read("scripts/ensure-db.mjs")).toContain(
      'ALTER TABLE "StudentProfile" ADD COLUMN IF NOT EXISTS "hiddenFromBoards" BOOLEAN NOT NULL DEFAULT false;'
    );
  });

  it.each(["lib/monthly-recap-data.ts", "lib/leaderboard-data.ts", "lib/class-ranking.ts"])(
    "%s lọc bỏ học viên đã ẩn",
    (path) => {
      expect(read(path)).toContain("hiddenFromBoards: false");
    }
  );

  it("action bật/tắt: requireTeacher trước, chỉ học viên lớp của thầy, làm mới cache bảng", () => {
    const source = read("lib/actions/profile.ts");
    const action = source.slice(source.indexOf("export async function setHiddenFromBoards"));
    expect(action).toMatch(/^export async function setHiddenFromBoards\(formData: FormData\): Promise<ActionResult> \{\s*const teacher = await requireTeacher\(\);/);
    expect(action).toMatch(/classes: \{ some: \{ class: \{ teacherId: teacher\.id \} \} \}/);
    expect(action).toContain("revalidateTag(LEADERBOARD_CACHE_TAG)");
  });

  it("trang học viên phía thầy có công tắc", () => {
    expect(read("app/teacher/students/[studentId]/page.tsx")).toContain("<BoardVisibilityToggle");
  });
});
