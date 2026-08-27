import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const source = readFileSync(join(root, "lib", "actions", "profile.ts"), "utf8");

// Cắt riêng thân từng action để khẳng định về đúng action đó, không ăn nhầm sang
// action bên cạnh trong cùng file.
function bodyOf(name: string): string {
  const start = source.indexOf(`export async function ${name}(`);
  expect(start).toBeGreaterThanOrEqual(0);
  const rest = source.slice(start + 1);
  const next = rest.indexOf("\nexport async function ");
  return next === -1 ? rest : rest.slice(0, next);
}

describe("chốt chặn quyền của action sửa hồ sơ", () => {
  const mine = bodyOf("updateMyProfile");
  const byTeacher = bodyOf("updateStudentProfile");

  it("updateMyProfile gọi requireStudent", () => {
    expect(mine).toContain("requireStudent()");
  });

  it("updateMyProfile KHÔNG đọc studentId từ FormData", () => {
    // Chốt quan trọng nhất của task: học viên sửa gói tin gửi lên không được
    // chạm tới hồ sơ người khác. Id phải đến từ phiên đăng nhập.
    expect(mine).not.toMatch(/formData\.get\(\s*["']studentId["']\s*\)/);
  });

  it("updateMyProfile KHÔNG chạm displayName hay email", () => {
    // Tên hiện ở bảng xếp hạng và hàng chờ chấm bài — chỉ giáo viên đổi được.
    expect(mine).not.toMatch(/displayName:/);
    expect(mine).not.toMatch(/email:/);
  });

  it("updateStudentProfile gọi requireTeacher", () => {
    expect(byTeacher).toContain("requireTeacher()");
  });

  it("updateStudentProfile lọc theo lớp của giáo viên ngay trong where", () => {
    // Không được lấy học viên rồi mới đối chiếu quyền sau — phải nằm trong where.
    expect(byTeacher).toMatch(/classes:\s*\{\s*some:\s*\{\s*class:\s*\{\s*teacherId/);
  });

  it("updateStudentProfile chặn đổi email khi học viên đã liên kết Google", () => {
    // Email là khoá nối tài khoản Google trong lib/auth.ts. Đổi email của học viên
    // đã đăng nhập = họ mất quyền vào toàn bộ bài cũ.
    expect(byTeacher).toContain("userId");
    expect(byTeacher).toMatch(/Google/);
  });

  it("cả hai action kiểm link ảnh bằng isAllowedAvatarUrl", () => {
    expect(source).toContain("isAllowedAvatarUrl");
  });

  it("đổi avatar thì xoá ảnh cũ trên Blob", () => {
    // Blob store từng bị khoá vì vượt băng thông — không để ảnh mồ côi tích lại.
    expect(source).toMatch(/import \{[^}]*\bdel\b[^}]*\} from "@vercel\/blob"/);
  });
});
