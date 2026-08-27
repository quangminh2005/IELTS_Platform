import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(relative: string): string {
  return readFileSync(join(root, ...relative.split("/")), "utf8");
}

// Bảng xếp hạng (ClassRankingBoard) hiện cho CẢ giáo viên lẫn học viên xem.
// Route /student/profile/[studentId] chỉ cho học viên vào — giáo viên bấm vào
// sẽ bị đẩy về /login. Vì vậy hai lối bấm tên phải tách biệt hoàn toàn:
//   - linkToProfile  (giáo viên) -> /teacher/students/[id]
//   - linkToProfiles (học viên)  -> /student/profile/[id]
// Bộ test này giữ chắc trang xếp hạng của giáo viên KHÔNG bao giờ bật cờ dẫn
// tới route chỉ dành cho học viên.
describe("bảng xếp hạng: lối bấm tên không lẫn giữa hai vai trò", () => {
  it("trang xếp hạng của giáo viên không truyền linkToProfiles", () => {
    const teacherPage = read("app/teacher/ranking/page.tsx");

    expect(teacherPage).not.toContain("linkToProfiles");
  });

  it("trang xếp hạng của giáo viên vẫn dùng linkToProfile (mở hồ sơ quản lý học viên)", () => {
    const teacherPage = read("app/teacher/ranking/page.tsx");

    expect(teacherPage).toMatch(/<ClassRankingBoard\b[^>]*\blinkToProfile\b/);
  });

  it("trang xếp hạng của học viên truyền linkToProfiles để mở hồ sơ rút gọn bạn cùng lớp", () => {
    const studentPage = read("app/student/ranking/page.tsx");

    expect(studentPage).toMatch(/<ClassRankingBoard\b[\s\S]*?\blinkToProfiles\b/);
  });

  it("component: linkToProfile (giáo viên) chỉ trỏ tới /teacher/students, không bao giờ trỏ tới /student/profile", () => {
    const board = read("components/class-ranking-board.tsx");

    // Khối xử lý linkToProfile phải đứng trước và dẫn tới route quản lý của
    // giáo viên — không được đổi sang route /student/profile chỉ dành cho
    // học viên (đó là lỗi sẽ khiến giáo viên bấm tên bị đẩy về /login).
    const linkToProfileBlock = board.match(
      /if \(linkToProfile\) \{[\s\S]*?\n {4}\}/
    );

    expect(linkToProfileBlock).not.toBeNull();
    expect(linkToProfileBlock?.[0]).toContain("/teacher/students/");
    expect(linkToProfileBlock?.[0]).not.toContain("/student/profile/");
  });

  it("component: linkToProfiles (học viên) chỉ trỏ tới /student/profile", () => {
    const board = read("components/class-ranking-board.tsx");

    const linkToProfilesBlock = board.match(
      /if \(linkToProfiles\) \{[\s\S]*?\n {4}\}/
    );

    expect(linkToProfilesBlock).not.toBeNull();
    expect(linkToProfilesBlock?.[0]).toContain("/student/profile/");
    expect(linkToProfilesBlock?.[0]).not.toContain("/teacher/students/");
  });
});
