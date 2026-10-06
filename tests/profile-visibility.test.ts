import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(
  join(process.cwd(), "app", "student", "profile", "[studentId]", "page.tsx"),
  "utf8"
);

// LỊCH SỬ: trước 5/10/2026 trang này chỉ cho xem bạn CHUNG LỚP và chỉ hiện tên hạng.
// Mạng xã hội Đợt 1 (spec 2026-10-05-xa-hoi-dot-1) mở cho cả trường và hiện thêm XP,
// chuỗi, lịch chăm học — nhưng band, mục tiêu, bài làm và số dư ví vẫn là chuyện riêng.
describe("hồ sơ học viên khác (mở toàn trường)", () => {
  it("chỉ học viên đã đăng nhập mới xem được", () => {
    expect(source).toContain('session.user.role !== "student"');
    expect(source).toContain('redirect("/login")');
  });

  it("không còn giới hạn chung lớp", () => {
    expect(source).not.toMatch(/classes:\s*\{\s*some:/);
  });

  it("gọi notFound khi không tìm thấy, mở chính mình thì về /student/profile", () => {
    expect(source).toContain("notFound()");
    expect(source).toContain('redirect("/student/profile")');
  });

  it("không tính band / mục tiêu band", () => {
    expect(source).not.toContain("bandsBySkill");
    expect(source).not.toContain("averageBandsBySkill");
    expect(source).not.toContain("targetBand");
    expect(source).not.toContain("formatBand");
  });

  it("không đụng tới Answer / AttemptSkill — chi tiết bài làm là chuyện riêng", () => {
    expect(source).not.toContain("answers:");
    expect(source).not.toContain("attemptSkill:");
  });

  it("không lộ số dư ví", () => {
    expect(source).not.toMatch(/\bcoins\b/);
    expect(source).not.toContain("StudentWalletSummary");
  });

  it("XP, chuỗi, lịch lấy qua các nguồn dùng chung", () => {
    expect(source).toMatch(/getLifetimeXp\(/);
    expect(source).toMatch(/getDayStreak\(/);
    expect(source).toMatch(/loadActivityDays\(/);
    expect(source).toMatch(/summarizeMonthActivity\(/);
    expect(source).toMatch(/<RankCard[^>]*showXp/);
  });

  it("Đợt 2: có nút Theo dõi, số theo dõi, cảm xúc và danh sách bạn bè", () => {
    expect(source).toMatch(/getFollowCounts\(/);
    expect(source).toMatch(/isFollowing\(me\.id, profile\.id\)/);
    expect(source).toMatch(/getMyReactionsToday\(me\.id, profile\.id/);
    expect(source).toContain("<FollowButton");
    expect(source).toContain("<ReactionBar");
    expect(source).toContain("<FollowListsCard");
  });
});
