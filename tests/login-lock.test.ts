import { describe, expect, it } from "vitest";
import {
  clientIpFromHeaders,
  lockFromFailures,
  LOGIN_LOCKED_ERROR,
  LOGIN_WINDOW_MINUTES,
  loginErrorMessage,
  MAX_FAILS_PER_EMAIL,
  MAX_FAILS_PER_IP,
  minutesUntilUnlock
} from "../lib/login-lock";

const NOW = new Date("2026-08-14T10:00:00.000Z");

function minutesAgo(minutes: number): Date {
  return new Date(NOW.getTime() - minutes * 60_000);
}

describe("clientIpFromHeaders", () => {
  it("lấy IP đầu tiên trong x-forwarded-for", () => {
    expect(clientIpFromHeaders({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" })).toBe("203.0.113.7");
  });

  it("đọc được cả object thường lẫn Headers", () => {
    expect(clientIpFromHeaders(new Headers({ "x-forwarded-for": "203.0.113.7" }))).toBe(
      "203.0.113.7"
    );
  });

  it("lùi về x-real-ip rồi mới tới 'unknown'", () => {
    expect(clientIpFromHeaders({ "x-real-ip": "198.51.100.4" })).toBe("198.51.100.4");
    expect(clientIpFromHeaders({})).toBe("unknown");
    expect(clientIpFromHeaders(null)).toBe("unknown");
  });
});

describe("minutesUntilUnlock", () => {
  it("đếm ngược từ lần sai cũ nhất còn trong cửa sổ", () => {
    // Sai lần đầu cách đây 5 phút -> còn 10 phút nữa mới rơi khỏi cửa sổ 15 phút.
    expect(minutesUntilUnlock(minutesAgo(5), NOW)).toBe(10);
  });

  it("không bao giờ hiện 0 phút", () => {
    expect(minutesUntilUnlock(minutesAgo(LOGIN_WINDOW_MINUTES), NOW)).toBe(1);
    expect(minutesUntilUnlock(minutesAgo(120), NOW)).toBe(1);
  });
});

describe("lockFromFailures", () => {
  it("chưa chạm ngưỡng thì không khoá", () => {
    const fails = Array.from({ length: MAX_FAILS_PER_EMAIL - 1 }, () => minutesAgo(1));

    expect(lockFromFailures(fails, [], NOW)).toEqual({ locked: false, minutes: 0 });
  });

  it("khoá khi một email sai đủ ngưỡng", () => {
    const fails = [minutesAgo(6), ...Array.from({ length: MAX_FAILS_PER_EMAIL - 1 }, () => minutesAgo(1))];

    expect(lockFromFailures(fails, [], NOW)).toEqual({ locked: true, minutes: 9 });
  });

  it("khoá khi một IP rải nhiều email khác nhau", () => {
    const ipFails = [minutesAgo(3), ...Array.from({ length: MAX_FAILS_PER_IP - 1 }, () => minutesAgo(1))];

    expect(lockFromFailures([], ipFails, NOW)).toEqual({ locked: true, minutes: 12 });
  });
});

describe("loginErrorMessage", () => {
  it("nói rõ còn phải chờ bao lâu khi đang bị khoá", () => {
    expect(loginErrorMessage(`${LOGIN_LOCKED_ERROR}:9`)).toContain("9 phút");
  });

  it("thiếu số phút thì lấy trọn cửa sổ", () => {
    expect(loginErrorMessage(LOGIN_LOCKED_ERROR)).toContain(`${LOGIN_WINDOW_MINUTES} phút`);
  });

  it("mọi lỗi khác đều là câu chung chung, không lộ email có tồn tại hay không", () => {
    expect(loginErrorMessage("CredentialsSignin")).toBe("Email hoặc mật khẩu không đúng.");
  });
});
