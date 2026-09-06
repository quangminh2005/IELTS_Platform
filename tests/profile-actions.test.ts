import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

// Các khẳng định dưới đây khớp mẫu có chứa "\n" (ví dụ ";\n" để chốt cuối một khối).
// Git lưu file bằng LF nhưng trên Windows (core.autocrlf=true) bản làm việc lại là
// CRLF, nên đọc thô sẽ khiến ";\n" không bao giờ khớp — test đỏ trên máy Windows dù
// mã nguồn không sai. Chuẩn hoá về LF ngay khi đọc để test chỉ nói về NỘI DUNG.
function readSource(...segments: string[]): string {
  return readFileSync(join(root, ...segments), "utf8").replace(/\r\n/g, "\n");
}

const source = readSource("lib", "actions", "profile.ts");
const editorSource = readSource("components", "profile-editor.tsx");
const teacherPageSource = readSource("app", "teacher", "students", "[studentId]", "page.tsx");

// Cắt riêng thân từng action để khẳng định về đúng action đó, không ăn nhầm sang
// action bên cạnh trong cùng file.
function bodyOf(name: string): string {
  const start = source.indexOf(`export async function ${name}(`);
  expect(start).toBeGreaterThanOrEqual(0);
  const rest = source.slice(start + 1);
  const next = rest.indexOf("\nexport async function ");
  return next === -1 ? rest : rest.slice(0, next);
}

// Cắt thân một hàm/hằng module-level theo tên, không phụ thuộc thứ tự khai báo
// trong file (khác bodyOf ở trên, vốn CỐ Ý dùng vị trí để phân định ranh giới giữa
// hai action). Dùng cho các hàm/schema dùng chung mà updateMyProfile/updateStudentProfile
// gọi tới — kiểm tra invariant thật nằm bên trong thân đó, không phải suy luận từ vị
// trí khai báo.
function blockOf(startPattern: RegExp): string {
  const match = source.match(startPattern);
  expect(match, `Không tìm thấy khối khớp ${startPattern}`).not.toBeNull();
  return match![0];
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

  it("updateMyProfile ghi thẳng object trả về từ readDecoration(formData)", () => {
    // Bản thân object "data" ghi vào Prisma phải đến từ readDecoration(formData).
    // (Trước đây bài kiểm còn thêm expect(mine).not.toMatch(/displayName:/) và
    // /email:/ — hai assertion đó chỉ xanh NHỜ vị trí khai báo teacherFieldsSchema
    // nằm ngoài phần thân bị cắt của updateMyProfile; dời khai báo đó vào giữa
    // hai action (một thay đổi hoàn toàn vô hại) sẽ làm chúng đỏ oan. Chốt thật
    // cho "updateMyProfile không đụng displayName/email" nay nằm ở bài kiểm
    // decorationSchema bên dưới — kiểm đúng invariant, không phụ thuộc bố cục.)
    expect(mine).toMatch(/readDecoration\(formData\)/);
  });

  it("decorationSchema (dùng chung) chỉ có đúng 5 trường trang trí — không có displayName/email", () => {
    // Đây là chốt THẬT đứng sau bài kiểm tra ở trên: decorationSchema định nghĩa
    // toàn bộ những gì updateMyProfile được phép ghi. Ai đó thêm displayName/email
    // vào decorationSchema (một khai báo NẰM NGOÀI phần thân bị cắt của
    // updateMyProfile, nên bài kiểm tra ở trên không thấy được) vẫn phải bị bắt ở
    // đây — bất kể decorationSchema được khai báo ở vị trí nào trong file.
    const block = blockOf(/const decorationSchema = z\.object\(\{([\s\S]*?)\}\);/);
    const keys = [...block.matchAll(/^\s*(\w+):/gm)].map((m) => m[1]).sort();
    expect(keys).toEqual(
      ["avatarPreset", "avatarUrl", "bio", "coverColor", "targetBand"].sort()
    );
  });

  it("updateStudentProfile gọi requireTeacher", () => {
    expect(byTeacher).toContain("requireTeacher()");
  });

  it("updateStudentProfile lọc theo lớp của giáo viên ngay trong where", () => {
    // Không được lấy học viên rồi mới đối chiếu quyền sau — phải nằm trong where.
    expect(byTeacher).toMatch(/classes:\s*\{\s*some:\s*\{\s*class:\s*\{\s*teacherId/);
  });

  it("updateStudentProfile chặn đổi email khi học viên đã liên kết Google", () => {
    // Khớp đúng điều kiện chặn thật sự (student.userId !== null), không phải chỉ
    // chuỗi "userId" xuất hiện đâu đó (vd. trong select: { userId: true } thì luôn
    // đúng dù không hề có chốt chặn) — và câu báo lỗi phải nhắc tới Google.
    expect(byTeacher).toMatch(/student\.userId\s*!==\s*null/);
    expect(byTeacher).toMatch(/Google/);
  });

  it("updateStudentProfile CHỈ ghi trường giáo viên thực sự gửi lên, không hiểu vắng mặt là xoá trắng", () => {
    // Finding 1: form giáo viên có thể chỉ gửi studentId/displayName/email, không
    // gửi đủ 5 trường trang trí như form học viên. Phải dùng readDecorationPatch
    // (dựa trên formData.has) chứ không phải readDecoration (coi vắng mặt = null).
    expect(byTeacher).toMatch(/readDecorationPatch\(formData\)/);
    expect(byTeacher).not.toMatch(/readDecoration\(formData\)/);

    const fn = blockOf(/function readDecorationPatch\([\s\S]*?\n\}/);
    for (const field of ["bio", "avatarUrl", "avatarPreset", "coverColor", "targetBand"]) {
      // Mỗi trường phải được gate bằng formData.has(...) — thiếu gate này thì
      // trường đó lại quay về hành vi "vắng mặt = xoá trắng".
      expect(fn).toMatch(new RegExp(`formData\\.has\\(\\s*["']${field}["']\\s*\\)`));
    }
  });

  it("cả hai action chặn nhận avatarUrl đang thuộc StudentProfile khác (chống cướp ảnh của bạn học)", () => {
    // Finding 2: chỉ kiểm hostname (isAllowedAvatarUrl) là không đủ — một học viên
    // có thể dán đúng URL Blob của bạn học. Phải có một truy vấn loại trừ chính
    // mình (id: { not: ownerId }) để phát hiện URL đó đã thuộc hồ sơ khác.
    const fn = blockOf(/async function assertAvatarUrlNotTaken\([\s\S]*?\n\}/);
    expect(fn).toMatch(/id:\s*\{\s*not:\s*ownerId\s*\}/);
    expect(mine).toMatch(/assertAvatarUrlNotTaken\(/);
    expect(byTeacher).toMatch(/assertAvatarUrlNotTaken\(/);
  });

  it("avatarUrlSchema thật sự dùng isAllowedAvatarUrl để validate (không chỉ import cho có)", () => {
    // Trước đây bài kiểm tra chỉ khớp toContain("isAllowedAvatarUrl"), thứ mà
    // riêng dòng import cũng thoả — xoá hẳn .refine(...) khỏi schema vẫn xanh.
    const block = blockOf(/const avatarUrlSchema = z[\s\S]*?;\n/);
    expect(block).toMatch(/\.refine\(\s*isAllowedAvatarUrl/);
  });

  it("import del từ @vercel/blob và deleteOldAvatar() thật sự gọi del() trên ảnh cũ", () => {
    // Trước đây bài kiểm tra chỉ khớp dòng import — xoá lệnh gọi del(oldUrl) bên
    // trong deleteOldAvatar() (mà vẫn giữ dòng import) trước đây vẫn xanh.
    expect(source).toMatch(/import \{[^}]*\bdel\b[^}]*\} from "@vercel\/blob"/);
    const fn = blockOf(/async function deleteOldAvatar\([\s\S]*?\n\}/);
    expect(fn).toMatch(/\bdel\(\s*oldUrl\s*\)/);
  });

  it("cả hai action xoá ảnh cũ trên Blob SAU KHI ghi DB thành công, không xoá trước", () => {
    // Finding 3: xoá trước mà ghi DB thất bại thì ảnh mất trong khi hồ sơ vẫn trỏ
    // tới nó. Vị trí lệnh gọi TRONG THÂN HÀM ở đây phản ánh đúng thứ tự thực thi —
    // không phải một chi tiết bố cục tình cờ như các trường hợp khác trong file.
    for (const body of [mine, byTeacher]) {
      const updateIndex = body.indexOf("prisma.studentProfile.update(");
      const deleteIndex = body.indexOf("deleteOldAvatar(");
      expect(updateIndex).toBeGreaterThanOrEqual(0);
      expect(deleteIndex).toBeGreaterThanOrEqual(0);
      expect(deleteIndex).toBeGreaterThan(updateIndex);
    }
  });

  it("deleteOldAvatar CHỈ xoá file khớp isAllowedAvatarUrl(oldUrl) — không tự nới lỏng gate riêng (Finding A)", () => {
    // Finding A (security): chốt khiến del() an toàn là isAllowedAvatarUrl (nay đã
    // ràng buộc tiền tố avatars/ ở lib/student-avatar.ts). Nếu ai đó thay điều kiện
    // gate này bằng thứ gì yếu hơn (vd. chỉ kiểm oldUrl !== newUrl) thì audio
    // Listening hay ảnh tài liệu — cùng host Blob — lại có thể bị del() nhầm. Bài
    // kiểm này khoá đúng lệnh gọi isAllowedAvatarUrl(oldUrl) có mặt trong gate.
    const fn = blockOf(/async function deleteOldAvatar\([\s\S]*?\n\}/);
    expect(fn).toMatch(/isAllowedAvatarUrl\(\s*oldUrl\s*\)/);
  });

  it("updateMyProfile ghi update nhắm đúng student.id lấy từ requireStudent(), không phải id nào khác trên FormData", () => {
    // Finding C: chỉ kiểm KHÔNG có formData.get("studentId") là chưa đủ — một
    // dòng where: { id: String(formData.get("sid")) } (đọc id qua khoá khác) vẫn
    // qua được bài kiểm đó trong khi phá vỡ đúng bất biến mà task yêu cầu. Phải
    // khẳng định DƯƠNG rằng where trỏ thẳng tới student.id (biến trả về từ
    // requireStudent()).
    expect(mine).toMatch(
      /prisma\.studentProfile\.update\(\{\s*where:\s*\{\s*id:\s*student\.id\s*\}/
    );
  });

  it("updateStudentProfile ghi update nhắm đúng student.id lấy từ bản ghi đã lọc theo lớp giáo viên", () => {
    // Đối chứng phía giáo viên: id ghi vào where phải là student.id (kết quả
    // findFirst đã lọc theo teacherId trong where ở bài kiểm phía trên), không
    // phải fields.data.studentId đọc thẳng từ FormData chưa qua lọc quyền sở hữu.
    expect(byTeacher).toMatch(
      /prisma\.studentProfile\.update\(\{\s*where:\s*\{\s*id:\s*student\.id\s*\}/
    );
  });

  it("requireStudent()/requireTeacher() nằm NGOÀI khối try — lỗi phân quyền phải ném ra như các action khác trong repo", () => {
    // Finding C: đây là house pattern bắt buộc (xem CLAUDE.md + các action khác
    // trong lib/actions). Đặt lệnh gọi vào TRONG try sẽ khiến lỗi phân quyền bị
    // actionFail() nuốt thành ActionResult thay vì ném ra — hành vi khác hẳn phần
    // còn lại của codebase. Kiểm bằng vị trí là hợp lệ ở đây vì đây chính là điều
    // đang được khẳng định (thứ tự câu lệnh so với ranh giới try).
    for (const [body, callText] of [
      [mine, "requireStudent()"],
      [byTeacher, "requireTeacher()"]
    ] as const) {
      const callIndex = body.indexOf(callText);
      const tryIndex = body.indexOf("try {");
      expect(callIndex).toBeGreaterThanOrEqual(0);
      expect(tryIndex).toBeGreaterThan(0);
      expect(callIndex).toBeLessThan(tryIndex);
    }
  });
});

describe("ProfileEditor không để hai chế độ (self / teacherPatch) sụp thành một", () => {
  // Bối cảnh: readDecorationPatch() ở trên chỉ có tác dụng khi form giáo viên
  // THỰC SỰ bỏ trống những ô chưa chạm tới. Nếu ProfileEditor lại render đủ cả
  // 5 hidden input bất kể mode (như trước khi vá), formData.has(...) phía server
  // luôn đúng và nhánh "để nguyên" không bao giờ được kích hoạt — chốt bảo vệ có
  // tồn tại nhưng không có tác dụng thật. Các bài kiểm dưới đây khoá đúng phần
  // component chịu trách nhiệm không để việc đó xảy ra lại.
  it("cả 5 hidden input trang trí đều render CÓ ĐIỀU KIỆN qua shouldPost(...), không unconditional", () => {
    for (const field of ["bio", "avatarUrl", "avatarPreset", "coverColor", "targetBand"]) {
      const gated = new RegExp(
        `shouldPost\\(\\s*["']${field}["']\\s*\\)[\\s\\S]{0,80}<input type="hidden" name="${field}"`
      );
      expect(editorSource).toMatch(gated);
    }
  });

  it("shouldPost() thật sự phân biệt hai mode, không phải hằng true nguỵ trang", () => {
    const fn = editorSource.match(/function shouldPost\([\s\S]*?\n  \}/);
    expect(fn, "Không tìm thấy thân hàm shouldPost").not.toBeNull();
    // mode="self" luôn gửi (giữ hành vi "vắng mặt = xoá trắng" cho học viên)...
    expect(fn![0]).toMatch(/mode\s*===\s*["']self["']/);
    // ...còn mode khác thì phải tra theo tập các trường đã thực sự bị chạm tới,
    // không phải một điều kiện luôn đúng nào khác.
    expect(fn![0]).toMatch(/touchedFields\.has\(/);
  });

  it("chọn preset / xoá ảnh / tải ảnh thành công đều đánh dấu CẢ avatarUrl lẫn avatarPreset đã chạm", () => {
    // avatarUrl và avatarPreset loại trừ lẫn nhau — chạm một ô mà không đánh dấu
    // ô kia thì giá trị "" cần thiết để xoá ô còn lại sẽ không được gửi lên.
    const touchAvatarFn = editorSource.match(/function touchAvatar\(\)[\s\S]*?\n  \}/);
    expect(touchAvatarFn, "Không tìm thấy thân hàm touchAvatar").not.toBeNull();
    expect(touchAvatarFn![0]).toMatch(/touch\(\s*["']avatarUrl["']\s*,\s*["']avatarPreset["']\s*\)/);

    // Cả 3 hành động (tải ảnh thành công, bấm "Xoá ảnh", chọn preset) đều phải
    // gọi touchAvatar() — thiếu ở bất kỳ đâu thì hành động đó lại "câm" trong
    // mode="teacherPatch" dù người dùng đã thực sự đổi ảnh. Kiểm riêng từng
    // handler (không đếm gộp toàn file) — đếm gộp sẽ vẫn "xanh giả" khi mất
    // đúng 1 lời gọi, vì chuỗi con "touchAvatar()" còn xuất hiện trong chính
    // định nghĩa hàm touchAvatar ở trên.
    expect(editorSource).toMatch(
      /setAvatarPreset\(null\); \/\/ ảnh tự tải thắng avatar có sẵn\s*\n\s*touchAvatar\(\);/
    );
    expect(editorSource).toMatch(
      /setAvatarUrl\(null\);\s*\n\s*setUploadError\(null\);\s*\n\s*setUploading\(false\);\s*\n\s*touchAvatar\(\);\s*\n\s*\}\}\s*\n\s*className="ml-2/
    );
    expect(editorSource).toMatch(
      /setAvatarPreset\(preset\.key\);[\s\S]{0,220}touchAvatar\(\);/
    );
  });

  it("trang giáo viên (teacherPatch) chỉ đọc trường thực sự gửi lên — không tự nới lỏng thành đọc thẳng FormData", () => {
    // Chốt đối chứng phía "gửi": nếu ai đó âm thầm bỏ chế độ teacherPatch khỏi
    // trang giáo viên (quay về mặc định mode="self" của ProfileEditor), form
    // giáo viên lại gửi đủ cả 5 trường mỗi lần lưu — đúng lỗi ban đầu của finding.
    expect(teacherPageSource).toMatch(
      /<ProfileEditor[\s\S]{0,200}mode="teacherPatch"/
    );
  });

  it("trang hồ sơ học viên (self) KHÔNG truyền mode=\"teacherPatch\" — vẫn dùng mặc định mode=\"self\"", () => {
    const studentPageSource = readFileSync(
      join(root, "app", "student", "profile", "page.tsx"),
      "utf8"
    );
    expect(studentPageSource).not.toMatch(/mode="teacherPatch"/);
  });
});
