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

  it("chip hạng chỉ được tính qua helper dùng chung, không tự chấm điểm riêng", () => {
    // LỊCH SỬ: bài test này trước đây cấm trang chạm tới Attempt/AssignmentRecipient
    // DƯỚI BẤT KỲ HÌNH THỨC NÀO (cấm cả literal "attempts:" và "recipients:").
    // Spec §6 (2026-08-27) đổi luật: bản rút gọn được phép hiện CHIP HẠNG — thứ
    // vốn đã công khai trên bảng xếp hạng lớp (class-ranking-board), không phải
    // dữ liệu riêng tư mới. Để hiện chip hạng, trang buộc phải đọc Attempt +
    // AssignmentRecipient, nên lệnh cấm tuyệt đối cũ giờ chặn nhầm một tính năng
    // đã được duyệt trong spec.
    //
    // Ranh giới mới siết ở đúng chỗ cần bảo vệ: trang này KHÔNG được tự viết công
    // thức chấm điểm của riêng nó — phải đi qua ĐÚNG MỘT helper dùng chung
    // (rankingScoreFromRecipientsAndAttempts + getTierProgress, cùng cặp mà
    // app/student/profile/page.tsx — hồ sơ của chính mình — đang dùng) rồi chỉ
    // render kết quả qua RankTierBadge (chip icon + nhãn bậc, không có con số).
    // Thiếu một trong ba cái tên dưới đây tức là ai đó đã tự chế đường tính điểm
    // riêng — đúng thứ có thể khiến hai trang ra hai bậc khác nhau cho cùng một
    // học viên, hoặc mở đường lộ điểm số thô ra ngoài.
    // Kiểm bằng cú pháp GỌI HÀM (có dấu ngoặc mở) — chỉ import tên rồi không gọi
    // (hoặc tự chế object tier bằng tay) phải lọt qua bài test này.
    expect(source).toMatch(/rankingScoreFromRecipientsAndAttempts\(/);
    expect(source).toMatch(/getTierProgress\(/);
    expect(source).toContain("<RankTierBadge");
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
