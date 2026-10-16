// Cài đặt hiển thị ở màn làm bài (ý tưởng từ YouPass, 16/10/2026): cỡ chữ theo
// mức + màu nền dịu mắt. Chỉ lưu localStorage trên máy học viên — không cần DB.
//
// Module thuần: không đụng Prisma, không đụng React.

export const FONT_SCALE_STORAGE_KEY = "attemptFontScale";
export const READING_TONE_STORAGE_KEY = "attemptReadingTone";

// scale là hệ số CSS zoom áp lên vùng đề + câu hỏi (SplitPane).
export const FONT_PRESETS = [
  { key: "s", label: "Nhỏ", scale: 0.95 },
  { key: "m", label: "Vừa", scale: 1.1 },
  { key: "l", label: "Lớn", scale: 1.25 },
  { key: "xl", label: "Rất lớn", scale: 1.45 }
] as const;

export const DEFAULT_FONT_SCALE = 1.1;

// Giá trị đọc từ localStorage -> mức gần nhất. Trước đây nút A−/A+ lưu số tự do
// 0.9–1.6 bước 0.1, nên học viên cũ vẫn giữ được cỡ gần đúng như đã chọn.
export function snapFontScale(raw: unknown): number {
  const value = Number(raw);
  if (raw === null || raw === undefined || !Number.isFinite(value) || value <= 0) {
    return DEFAULT_FONT_SCALE;
  }

  let best: number = DEFAULT_FONT_SCALE;
  let bestDistance = Infinity;
  for (const preset of FONT_PRESETS) {
    const distance = Math.abs(preset.scale - value);
    if (distance < bestDistance - 1e-9) {
      best = preset.scale;
      bestDistance = distance;
    }
  }
  return best;
}

// "default" = màu theo giao diện sáng thường. Màu nền chỉ có tác dụng ở chế độ
// sáng (xem app/globals.css); chế độ tối là lựa chọn thứ tư trong bảng cài đặt.
export const READING_TONES = ["default", "sepia", "green"] as const;
export type ReadingTone = (typeof READING_TONES)[number];

export function parseReadingTone(raw: unknown): ReadingTone {
  return READING_TONES.includes(raw as ReadingTone) ? (raw as ReadingTone) : "default";
}
