import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveAppUrl } from "@/lib/app-url";

// Link phụ huynh nằm trong mail nên sai địa chỉ là hỏng cả tính năng: phụ huynh
// bấm vào chỉ thấy màn hình đòi đăng nhập Vercel.
const KEYS = ["NEXT_PUBLIC_APP_URL", "VERCEL_PROJECT_PRODUCTION_URL", "VERCEL_URL"] as const;

let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = {};
  for (const key of KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = saved[key];
    }
  }
});

describe("resolveAppUrl", () => {
  it("ưu tiên NEXT_PUBLIC_APP_URL và cắt dấu / thừa", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://lop-ielts.com/";
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "abc.vercel.app";

    expect(resolveAppUrl()).toBe("https://lop-ielts.com");
  });

  it("thiếu NEXT_PUBLIC_APP_URL thì dùng tên miền công khai của project", () => {
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "ielts-platform-psi.vercel.app";
    process.env.VERCEL_URL = "ielts-platform-od55d4bt1-abc.vercel.app";

    expect(resolveAppUrl()).toBe("https://ielts-platform-psi.vercel.app");
  });

  it("chỉ dùng VERCEL_URL khi không còn lựa chọn nào khác", () => {
    process.env.VERCEL_URL = "ielts-platform-od55d4bt1-abc.vercel.app";

    expect(resolveAppUrl()).toBe("https://ielts-platform-od55d4bt1-abc.vercel.app");
  });

  it("chạy máy cá nhân thì trả localhost", () => {
    expect(resolveAppUrl()).toBe("http://localhost:3000");
  });
});
