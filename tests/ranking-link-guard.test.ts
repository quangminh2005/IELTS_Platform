import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(relative: string): string {
  return readFileSync(join(root, ...relative.split("/")), "utf8");
}

// Trích nguyên thẻ <ClassRankingBoard ... /> đầu tiên trong nguồn, KHÔNG cho
// khớp tràn tới cuối file — nếu không, một prop chỉ nằm trong comment (không
// phải prop thật) vẫn có thể làm test "xanh" giả.
function extractClassRankingBoardTag(source: string): string {
  const match = source.match(/<ClassRankingBoard\b[\s\S]*?\/>/);
  expect(match).not.toBeNull();
  return match![0];
}

// Bảng xếp hạng (ClassRankingBoard) hiện cho CẢ giáo viên lẫn học viên xem.
// Route /student/profile/[studentId] chỉ cho học viên vào — giáo viên bấm vào
// sẽ bị đẩy về /login. Trước đây lối bấm tên dùng hai prop boolean riêng biệt
// (linkToProfile / linkToProfiles) chỉ khác nhau một chữ "s" — rất dễ gõ/copy
// nhầm. Giờ gộp thành một prop duy nhất nêu thẳng ĐÍCH ĐẾN:
//   profileLinkTarget?: "teacher" | "classmate"
// để hai tổ hợp không thể lẫn vào nhau kể cả khi gõ nhầm.
// Bộ test này giữ chắc trang xếp hạng của giáo viên KHÔNG bao giờ bật đích
// dẫn tới route chỉ dành cho học viên.
describe("bảng xếp hạng: lối bấm tên không lẫn giữa hai vai trò", () => {
  it("trang xếp hạng của giáo viên không truyền profileLinkTarget=\"classmate\"", () => {
    const teacherPage = read("app/teacher/ranking/page.tsx");
    const tag = extractClassRankingBoardTag(teacherPage);

    expect(tag).not.toContain("classmate");
  });

  it("trang xếp hạng của giáo viên truyền profileLinkTarget=\"teacher\" (mở hồ sơ quản lý học viên)", () => {
    const teacherPage = read("app/teacher/ranking/page.tsx");
    const tag = extractClassRankingBoardTag(teacherPage);

    expect(tag).toMatch(/profileLinkTarget=["']teacher["']/);
  });

  it("trang xếp hạng của học viên truyền profileLinkTarget=\"classmate\" để mở hồ sơ rút gọn bạn cùng lớp", () => {
    const studentPage = read("app/student/ranking/page.tsx");
    const tag = extractClassRankingBoardTag(studentPage);

    expect(tag).toMatch(/profileLinkTarget=["']classmate["']/);
  });

  it("component: profileLinkTarget === \"teacher\" chỉ trỏ tới /teacher/students, không bao giờ trỏ tới /student/profile", () => {
    const board = read("components/class-ranking-board.tsx");

    // Khối xử lý đích "teacher" phải đứng trước và dẫn tới route quản lý của
    // giáo viên — không được đổi sang route /student/profile chỉ dành cho
    // học viên (đó là lỗi sẽ khiến giáo viên bấm tên bị đẩy về /login).
    const teacherBlock = board.match(
      /if \(profileLinkTarget === "teacher"\) \{[\s\S]*?\n {4}\}/
    );

    expect(teacherBlock).not.toBeNull();
    expect(teacherBlock?.[0]).toContain("/teacher/students/");
    expect(teacherBlock?.[0]).not.toContain("/student/profile/");
  });

  it("component: profileLinkTarget === \"classmate\" chỉ trỏ tới /student/profile", () => {
    const board = read("components/class-ranking-board.tsx");

    const classmateBlock = board.match(
      /if \(profileLinkTarget === "classmate"\) \{[\s\S]*?\n {4}\}/
    );

    expect(classmateBlock).not.toBeNull();
    expect(classmateBlock?.[0]).toContain("/student/profile/");
    expect(classmateBlock?.[0]).not.toContain("/teacher/students/");
  });
});
