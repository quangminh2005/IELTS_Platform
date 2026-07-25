// Vòng lặp tốc độ phát cho thanh nghe lại ở trang kết quả (nút "1x" giống chin.edu.vn).
// Hàm thuần, không phụ thuộc React/DOM để test được.

// Các mức tốc độ theo đúng thứ tự bấm: 1x → 1.25x → 1.5x → 0.75x → 1x.
export const PLAYBACK_RATES = [1, 1.25, 1.5, 0.75] as const;

// Trả về mức tốc độ kế tiếp. Giá trị không nằm trong danh sách (dữ liệu lạ) → về 1x.
export function nextPlaybackRate(current: number): number {
  const index = PLAYBACK_RATES.indexOf(current as (typeof PLAYBACK_RATES)[number]);
  if (index === -1) {
    return PLAYBACK_RATES[0];
  }
  return PLAYBACK_RATES[(index + 1) % PLAYBACK_RATES.length];
}

// Nhãn hiển thị trên nút: bỏ số 0 vô nghĩa (1 → "1x", 1.25 → "1.25x").
export function formatPlaybackRate(rate: number): string {
  return `${Number(rate.toFixed(2))}x`;
}
