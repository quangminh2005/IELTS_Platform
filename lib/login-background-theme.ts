// Bảng màu cho nền động của trang đăng nhập.
// Bám theo --background và --primary trong app/globals.css.

export type LoginBackgroundTheme = "light" | "dark";

// Đo thật trên trình duyệt: shader chia 4 bậc rồi tán điểm, và bậc sáng nhất (color2)
// ăn khoảng 80% diện tích, còn color1 chỉ đọng lại một góc. Đặt tên theo đúng vai trò
// đó, đừng theo tên uColor1/uColor2 của bản gốc.
export type LoginBackgroundPalette = {
  /** Màu nhấn — chỉ đọng ở một góc, khoảng 10-20% diện tích. */
  color1: string;
  /** Màu phủ phần lớn màn hình; đây mới là màu quyết định tông của trang. */
  color2: string;
  /** Màu loang ở góc; phải trùng color2 để không lộ vệt. */
  fade: string;
};

export const LOGIN_BACKGROUND_PALETTES: Record<
  LoginBackgroundTheme,
  LoginBackgroundPalette
> = {
  // Theme sáng: phủ xanh rất nhạt, đọng xanh --primary ở một góc.
  light: {
    color1: "#2563EB",
    color2: "#EFF6FF",
    fade: "#EFF6FF"
  },
  // Theme tối: phủ navy gần trùng nền trang, chỉ hửng xanh ở một góc.
  dark: {
    color1: "#2E62C4",
    color2: "#0C1220",
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
