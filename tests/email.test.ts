import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isEmailConfigured, sendEmail } from "../lib/email";

const saved = {
  user: process.env.GMAIL_USER,
  pass: process.env.GMAIL_APP_PASSWORD,
};

beforeEach(() => {
  delete process.env.GMAIL_USER;
  delete process.env.GMAIL_APP_PASSWORD;
});

afterEach(() => {
  if (saved.user === undefined) {
    delete process.env.GMAIL_USER;
  } else {
    process.env.GMAIL_USER = saved.user;
  }

  if (saved.pass === undefined) {
    delete process.env.GMAIL_APP_PASSWORD;
  } else {
    process.env.GMAIL_APP_PASSWORD = saved.pass;
  }
});

describe("isEmailConfigured", () => {
  it("false khi thiếu cả hai biến", () => {
    expect(isEmailConfigured()).toBe(false);
  });

  it("false khi chỉ có địa chỉ gửi", () => {
    process.env.GMAIL_USER = "co@gmail.com";
    expect(isEmailConfigured()).toBe(false);
  });

  it("false khi chỉ có mật khẩu ứng dụng", () => {
    process.env.GMAIL_APP_PASSWORD = "abcd efgh ijkl mnop";
    expect(isEmailConfigured()).toBe(false);
  });

  it("false khi biến chỉ chứa khoảng trắng", () => {
    process.env.GMAIL_USER = "   ";
    process.env.GMAIL_APP_PASSWORD = "abcd efgh ijkl mnop";
    expect(isEmailConfigured()).toBe(false);
  });

  it("true khi có đủ cả hai", () => {
    process.env.GMAIL_USER = "co@gmail.com";
    process.env.GMAIL_APP_PASSWORD = "abcd efgh ijkl mnop";
    expect(isEmailConfigured()).toBe(true);
  });
});

describe("sendEmail", () => {
  it("báo lỗi rõ ràng khi chưa cấu hình, không cố kết nối SMTP", async () => {
    await expect(
      sendEmail("hs@example.com", "Tiêu đề", "<p>html</p>", "text")
    ).rejects.toThrow("Chưa cấu hình GMAIL_USER / GMAIL_APP_PASSWORD.");
  });
});
