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

  it("không lấy dữ liệu điểm — band là chuyện riêng", () => {
    expect(source).not.toContain("bandsBySkill");
    expect(source).not.toContain("scorePercent");
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
});
