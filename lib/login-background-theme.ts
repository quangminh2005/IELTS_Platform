// Bảng màu cho nền động của trang đăng nhập.
// Bám theo --background và --primary trong app/globals.css.

export type LoginBackgroundTheme = "light" | "dark";

export type LoginBackgroundPalette = {
  /** Màu đậm — chiếm phần lớn diện tích, dồn về phía dưới trái. */
  color1: string;
  /** Màu nhạt — hửng lên ở góc trên phải. */
  color2: string;
  /** Màu loang ở góc dưới trái; phải trùng nền trang để không lộ vệt. */
  fade: string;
};

export const LOGIN_BACKGROUND_PALETTES: Record<
  LoginBackgroundTheme,
  LoginBackgroundPalette
> = {
  // Theme sáng: chuyển từ xanh --primary sang xanh rất nhạt, giữ tinh thần nền sáng sạch.
  light: {
    color1: "#2563EB",
    color2: "#EFF6FF",
    fade: "#F2F6FA"
  },
  // Theme tối: phần lớn là navy gần trùng nền, chỉ hửng xanh ở góc trên phải.
  dark: {
    color1: "#0C1220",
    color2: "#2E62C4",
    fade: "#0C1220"
  }
};

export function getLoginBackgroundPalette(
  theme: string | undefined
): LoginBackgroundPalette {
  return theme === "dark"
    ? LOGIN_BACKGROUND_PALETTES.dark
    : LOGIN_BACKGROUND_PALETTES.light;
}
