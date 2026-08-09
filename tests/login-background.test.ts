import { describe, expect, it } from "vitest";
import {
  LOGIN_BACKGROUND_PALETTES,
  getLoginBackgroundPalette
} from "../lib/login-background-theme";

describe("bảng màu nền đăng nhập", () => {
  it("có đúng hai theme", () => {
    expect(Object.keys(LOGIN_BACKGROUND_PALETTES).sort()).toEqual(["dark", "light"]);
  });

  it("trả đúng bảng màu theo data-theme", () => {
    expect(getLoginBackgroundPalette("dark")).toBe(LOGIN_BACKGROUND_PALETTES.dark);
    expect(getLoginBackgroundPalette("light")).toBe(LOGIN_BACKGROUND_PALETTES.light);
  });

  // Script chống nhấp nháy có thể chưa kịp đặt data-theme.
  it("thiếu hoặc sai data-theme thì coi như theme sáng", () => {
    expect(getLoginBackgroundPalette(undefined)).toBe(LOGIN_BACKGROUND_PALETTES.light);
    expect(getLoginBackgroundPalette("")).toBe(LOGIN_BACKGROUND_PALETTES.light);
    expect(getLoginBackgroundPalette("xanh")).toBe(LOGIN_BACKGROUND_PALETTES.light);
  });

  // Màu loang phải trùng nền trang, không thì lộ vệt ở góc dưới trái.
  it("theme tối lấy màu loang trùng màu đậm (nền tối)", () => {
    expect(LOGIN_BACKGROUND_PALETTES.dark.fade).toBe(LOGIN_BACKGROUND_PALETTES.dark.color1);
  });

  it("hai theme không dùng chung màu đậm", () => {
    expect(LOGIN_BACKGROUND_PALETTES.dark.color1).not.toBe(
      LOGIN_BACKGROUND_PALETTES.light.color1
    );
  });

  // THREE.Color nhận nhiều định dạng, nhưng giữ hex 6 chữ số cho dễ soi.
  it("mọi màu là hex 6 chữ số", () => {
    const all = Object.values(LOGIN_BACKGROUND_PALETTES).flatMap((palette) => [
      palette.color1,
      palette.color2,
      palette.fade
    ]);

    expect(all).toHaveLength(6);
    for (const color of all) {
      expect(color).toMatch(/^#[0-9A-F]{6}$/);
    }
  });
});
