import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(process.cwd(), "lib", "actions", "social.ts"), "utf8");
const data = readFileSync(join(process.cwd(), "lib", "social-data.ts"), "utf8");

// Mạng xã hội Đợt 2: id người gửi/người theo dõi luôn lấy từ phiên đăng nhập.
describe("action theo dõi / cảm xúc", () => {
  it("là server action", () => {
    expect(source.startsWith('"use server"')).toBe(true);
  });

  it("mọi action gọi requireStudent đầu tiên", () => {
    const bodies = source.split(/export async function /).slice(1);
    expect(bodies.length).toBe(2);
    for (const body of bodies) {
      expect(body.match(/await\s+([A-Za-z]+)/)?.[1]).toBe("requireStudent");
    }
  });

  it("không tự theo dõi / tự thả cảm xúc cho chính mình", () => {
    expect(source.match(/targetId === student\.id/g)?.length).toBe(2);
  });

  it("bấm trùng (P2002) coi như thành công; cảm xúc không cộng Xu", () => {
    expect(source).toContain("P2002");
    expect(source).not.toMatch(/coinTransaction|grantCoins|syncWallet/);
  });

  it("kind đi qua zod enum", () => {
    expect(source).toMatch(/z\.enum\(\["cheer", "fire", "target"\]\)/);
  });
});

describe("đọc dữ liệu bạn bè", () => {
  it("ô tìm và gợi ý bỏ tài khoản thử đã ẩn", () => {
    expect(data.match(/hiddenFromBoards: false/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("bọc try/catch để trang không sập khi bảng chưa có", () => {
    expect(data.match(/catch \(error\)/g)?.length ?? 0).toBeGreaterThanOrEqual(6);
  });
});
