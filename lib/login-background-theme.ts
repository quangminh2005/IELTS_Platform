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

/**
 * Bề rộng màn hình tối thiểu để nạp nền động.
 *
 * Dưới ngưỡng này (điện thoại, tablet dựng đứng) dùng nền tĩnh. Hai lý do:
 * three.js nặng ~731KB, tải qua 4G thì chậm và tốn dung lượng của học viên;
 * và chính nó là thủ phạm làm trắng trang đăng nhập trên máy đời cũ — bản
 * 0.185 dùng cú pháp `static { ... }`, chỉ chạy từ iOS Safari 16.4 / Chrome 94
 * trở lên, máy cũ hơn báo lỗi cú pháp ngay lúc đọc file.
 */
export const LOGIN_SHADER_MIN_WIDTH = 1024;

export type LoginShaderConditions = {
  /** Người dùng bật "giảm chuyển động" trong cài đặt hệ thống. */
  reducedMotion: boolean;
  /** Máy tạo được ngữ cảnh WebGL. */
  hasWebgl: boolean;
  /** Bề rộng khung nhìn, tính bằng px. */
  viewportWidth: number;
};

/** Có nạp nền động hay không. Phải qua CẢ BA điều kiện. */
export function shouldLoadLoginShader({
  reducedMotion,
  hasWebgl,
  viewportWidth
}: LoginShaderConditions): boolean {
  if (reducedMotion || !hasWebgl) {
    return false;
  }

  return viewportWidth >= LOGIN_SHADER_MIN_WIDTH;
}
