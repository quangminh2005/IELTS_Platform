import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(relative: string): string {
  return readFileSync(join(root, ...relative.split("/")), "utf8");
}

// Lỗi A (đã xảy ra thật): startAttempt được gọi trong lúc render trang GET, nên nếu
// NÓ tự quyết định mở lượt mới thì nút Back / link "‹ Về chọn kỹ năng" sẽ âm thầm tạo
// một lượt tự luyện trắng thay vì cho xem lại kết quả. Việc mở lượt mới chỉ được phép
// nằm ở startPractice (một request POST do học viên bấm nút, ý định rõ ràng). Các test
// dưới đây khoá đúng ranh giới này — gỡ bất kỳ dòng nào bị khẳng định là test phải đỏ.
describe("chốt chặn quyền + ranh giới mở lượt mới của thư viện tự luyện", () => {
  const practiceSource = read("lib/actions/practice.ts");
  const attemptsSource = read("lib/actions/attempts.ts");

  it("startPractice lọc Material theo practiceOpen: true ngay trong where", () => {
    // Chốt chặn quyền duy nhất của task: học viên đoán URL không được mở đề chưa mở
    // tự luyện. Phải nằm TRONG where của truy vấn, không lọc sau khi đã lấy dữ liệu.
    expect(practiceSource).toMatch(/where:\s*\{[^}]*practiceOpen:\s*true/);
  });

  it("startPractice gọi requireStudent", () => {
    expect(practiceSource).toContain("requireStudent()");
  });

  it("startPractice dùng decideAttemptStart để quyết định mở lượt mới", () => {
    expect(practiceSource).toContain("decideAttemptStart");
  });

  it("attempts.ts KHÔNG dùng decideAttemptStart — startAttempt không tự mở lượt mới", () => {
    // Khoá lại lỗi A: nếu ai đó đưa decideAttemptStart trở lại startAttempt (gọi
    // trong lúc render trang GET), test này phải đỏ ngay.
    expect(attemptsSource).not.toContain("decideAttemptStart");
  });

  // Lỗi B (đã xảy ra thật, phát hiện khi kiểm bằng trình duyệt): practice.ts tạo
  // AssignmentUnit với order: index (bắt đầu từ 0), lệch với quy ước order: index + 1
  // dùng ở assignments.ts (cả hàm tạo bài giao lẫn hàm sửa bài giao). Phòng làm bài
  // (components/attempt-workspace.tsx) render thẳng giá trị order này ra nhãn "Phần
  // {order}", nên lệch 1 khiến học viên tự luyện thấy "PHẦN 0" thay vì "PHẦN 1" trong
  // khi bài giao thật (qua assignments.ts) vẫn đúng "PHẦN 1".
  it("practice.ts đánh số order bắt đầu từ 1, khớp quy ước index + 1 của assignments.ts", () => {
    const assignmentsSource = read("lib/actions/assignments.ts");
    expect(practiceSource).toContain("order: index + 1");
    expect(assignmentsSource).toContain("order: index + 1");
  });
});
