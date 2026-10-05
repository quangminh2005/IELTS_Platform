import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const source = readFileSync(
  join(root, "app", "student", "profile", "[studentId]", "page.tsx"),
  "utf8"
);

describe("hồ sơ rút gọn của bạn cùng lớp", () => {
  it("lọc theo lớp chung ngay trong where của truy vấn", () => {
    // Học viên đoán URL không được xem hồ sơ người khác lớp. Phải nằm trong where,
    // không phải ẩn nút trên giao diện.
    expect(source).toMatch(/classes:\s*\{\s*some:\s*\{/);
  });

  it("không tính band từng kỹ năng — band là chuyện riêng", () => {
    expect(source).not.toContain("bandsBySkill");
  });

  it("không lấy mục tiêu band", () => {
    expect(source).not.toContain("targetBand");
  });

  it("không lấy lịch chuyên cần", () => {
    expect(source).not.toContain("buildAttendanceMonth");
  });

  it("gọi notFound khi không tìm thấy, không lộ sự tồn tại của học viên", () => {
    expect(source).toContain("notFound()");
  });

  it("không đụng tới Answer — chi tiết đúng/sai từng câu không bao giờ cần cho chip hạng", () => {
    // Answer (đúng/sai + kỹ năng của TỪNG CÂU) là mức chi tiết nhất của bài làm,
    // sâu hơn hẳn thứ chip hạng cần (chip chỉ cần scorePercent/overallBand của
    // TỪNG LẦN LÀM, qua rankingScoreFromRecipientsAndAttempts). Cấm literal
    // "answers:" (select lồng kiểu Prisma) và "attemptSkill:" để không ai lỡ tay
    // kéo thêm chi tiết khi sửa file này về sau.
    expect(source).not.toContain("answers:");
    expect(source).not.toContain("attemptSkill:");
  });

  it("hạng chỉ lấy qua nguồn XP dùng chung, chỉ in TÊN cấp", () => {
    // LỊCH SỬ: trước 5/10/2026 chip là bậc theo điểm xếp hạng (rankingScore...).
    // Hạng đấu nay là XP tích luỹ (spec 2026-10-05-hang-dau-xp-kieu-chin) — trang
    // này phải đọc XP qua ĐÚNG một helper dùng chung (getLifetimeXp, cùng hồ sơ của
    // mình) và chỉ render qua RankTierBadge / RankCard showXp={false} (chỉ tên cấp).
    expect(source).toMatch(/getLifetimeXp\(/);
    expect(source).toContain("<RankTierBadge");
    expect(source).toMatch(/<RankCard[^>]*showXp=\{false\}/);
    expect(source).not.toMatch(/<RankCard[^>]*showXp(\s|\/|>)(?!=)/);
  });

  it("không in số XP của bạn học ra giao diện", () => {
    // Truyền làm prop (xp={lifetimeXp}) thì được; in thẳng ra JSX ({lifetimeXp}) thì không.
    expect(source).not.toMatch(/(?<!=)\{\s*lifetimeXp\s*\}/);
    expect(source).not.toMatch(/formatXp|xpFormat/);
  });

  it("không in điểm số / band thô ra giao diện — chỉ tier được đưa vào chip", () => {
    // Chốt thêm một lớp: dù gọi đúng helper ở trên, vẫn phải chắc không có chỗ
    // nào đem con số thô (điểm xếp hạng, % bài làm, band) ra hiển thị trực tiếp
    // thay vì đi qua RankTierBadge.
    expect(source).not.toMatch(/\{\s*rankingScore\.rankingScore\s*\}/);
    expect(source).not.toMatch(/\{\s*tierProgress\.pointsToNext\s*\}/);
    expect(source).not.toMatch(/\{\s*tierProgress\.pointsToDrop\s*\}/);
    expect(source).not.toMatch(/scorePercent\s*\}/);
    expect(source).not.toMatch(/overallBand\s*\}/);
  });
});
