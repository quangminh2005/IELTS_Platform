import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(relative: string): string {
  return readFileSync(join(root, ...relative.split("/")), "utf8");
}

describe("bảng xếp hạng dùng chung component avatar", () => {
  const board = read("components/class-ranking-board.tsx");

  it("không còn tự định nghĩa chữ cái viết tắt", () => {
    // Hai bản sao của cùng một thuật toán là hai chỗ để lệch nhau.
    expect(board).not.toContain("function initials(");
    expect(board).not.toContain("function avatarColor(");
  });

  it("dùng component StudentAvatar ở cả bục và danh sách (không chỉ import suông)", () => {
    // Đếm số lần gọi <StudentAvatar ...> thực sự trong JSX — riêng dòng import
    // cũng chứa chữ "StudentAvatar" nên chỉ kiểm tra "toContain" là không đủ,
    // phải khớp đúng 3 lời gọi component: bục, hàng danh sách "rest", hàng
    // danh sách "notStarted".
    const callSites = board.match(/<StudentAvatar\b/g) ?? [];
    expect(callSites.length).toBe(3);
  });

  it("hạng nhất trên bục vẫn to hơn hạng nhì/ba (không còn dùng chung một size)", () => {
    // Trước đây podiumStyle từng bị làm phẳng về một size="lg" duy nhất cho cả
    // 3 hạng — bug khiến hạng nhất không còn nổi bật. Phải còn ít nhất 2 giá
    // trị size khác nhau được gán trong mảng podiumStyle.
    const podiumStyleBlock = board.match(/const podiumStyle = \[[\s\S]*?\n\];/);
    expect(podiumStyleBlock).not.toBeNull();

    const sizeValues = [...(podiumStyleBlock?.[0].matchAll(/size:\s*"([^"]+)"/g) ?? [])].map(
      (match) => match[1]
    );

    expect(sizeValues.length).toBe(3);
    // Hạng nhất phải là size riêng, khác với hạng nhì/ba.
    expect(sizeValues[0]).not.toBe(sizeValues[1]);
    expect(sizeValues[1]).toBe(sizeValues[2]);
    // Avatar trên bục truyền size động theo từng hạng, không hard-code một size.
    expect(board).toContain("size={style.size}");
  });

  it("avatar hàng danh sách (rest, notStarted) vẫn dùng size 36px như giao diện gốc", () => {
    // Trước đây hai khối "rest" và "notStarted" bị đổi sang size="md" (48px),
    // to hơn hẳn 36px cũ. Cả hai phải dùng cùng một size nhỏ, và size đó
    // không được là "md".
    const listSizeMatches = [...board.matchAll(/size="(list|md)"/g)].map((match) => match[1]);
    expect(listSizeMatches.length).toBe(2);
    expect(listSizeMatches.every((size) => size === "list")).toBe(true);
  });
});

describe("class-ranking mang đủ dữ liệu avatar", () => {
  const ranking = read("lib/class-ranking.ts");

  it("truy vấn lấy cả avatarUrl và avatarPreset của hồ sơ", () => {
    expect(ranking).toContain("avatarPreset");
  });
});

describe("StudentAvatar giữ đúng quy ước hiển thị ảnh Google", () => {
  const component = read("components/student-avatar.tsx");

  it("thẻ <img> có referrerPolicy=\"no-referrer\" (thiếu sẽ khiến một số ảnh Google không tải được)", () => {
    // Phải nằm trong nhánh <img>, không phải chỉ xuất hiện đâu đó trong file.
    const imgTagMatch = component.match(/<img\b[\s\S]*?\/>/);
    expect(imgTagMatch).not.toBeNull();
    expect(imgTagMatch?.[0]).toContain('referrerPolicy="no-referrer"');
  });

  it("bảng SIZES có đủ kích thước 80px (bục hạng nhất) và 36px (hàng danh sách)", () => {
    expect(component).toMatch(/h-20 w-20/);
    expect(component).toMatch(/h-9 w-9/);
  });

  it("bục hạng nhất dùng chung cỡ chữ viết tắt với hạng nhì/ba", () => {
    // Giao diện gốc để cả ba bục cùng "text-lg" dù khung hạng nhất to hơn. Đổi cỡ
    // chữ của riêng hạng nhất là làm khác bản cũ — chỉ lộ ra khi học viên đứng đầu
    // chưa đặt avatar và cũng không có ảnh Google (rơi về chữ viết tắt).
    const podium = component.match(/podium:\s*\{[^}]*\}/)?.[0] ?? "";
    const lg = component.match(/\n\s*lg:\s*\{[^}]*\}/)?.[0] ?? "";
    expect(podium).toContain('text: "text-lg"');
    expect(lg).toContain('text: "text-lg"');
  });
});

describe("avatar trên thanh điều hướng học viên", () => {
  const shell = read("components/app-shell.tsx");

  it("có mặt ở CẢ hai bộ khung: thanh trên (điện thoại) và thanh bên (máy tính)", () => {
    // AppShell dựng khung hai lần cho hai cỡ màn hình. Sửa sót một chỗ thì avatar
    // biến mất ở đúng cỡ màn hình đó mà không ai thấy — học viên chủ yếu dùng điện
    // thoại nên chỗ dễ sót lại là chỗ quan trọng nhất. Cụm avatar/chuông/sáng-tối
    // nay nằm chung trong <HeaderActions> nên đếm số lần gọi component đó.
    const clusters = shell.match(/<HeaderActions /g) ?? [];
    expect(clusters).toHaveLength(2);

    const links = shell.match(/href="\/student\/profile"/g) ?? [];
    expect(links).toHaveLength(1);

    const avatars = shell.match(/<StudentAvatar/g) ?? [];
    expect(avatars).toHaveLength(1);
  });

  it("link vào hồ sơ có tên gọi cho trình đọc màn hình", () => {
    // Chỉ một tấm ảnh thì trình đọc màn hình không biết đọc gì.
    expect(shell).toMatch(/href="\/student\/profile"\s+aria-label=/);
  });
});
