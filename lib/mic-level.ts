// Đo tín hiệu micro lúc học viên đang ghi âm Speaking.
//
// Lý do có file này: 29/9/2026 một học viên ghi xong cả 5 câu nhưng file nào
// cũng câm tuyệt đối (mẫu = 0) — Chrome vẫn được cấp quyền micro, chỉ là micro
// (bị tắt bằng phím / chọn nhầm thiết bị) trả về toàn số 0. Màn ghi âm chỉ có
// đồng hồ đếm giây nên em không biết gì cho tới khi nộp xong. Giờ màn ghi âm
// hiện thanh âm lượng + cảnh báo khi micro "chết".

// Ngưỡng "không có tín hiệu": dưới 1 bước lượng tử của âm thanh 16-bit (~ -90 dB).
// Micro thật, kể cả phòng rất yên và đã qua lọc ồn, vẫn luôn có nhiễu nền vượt
// ngưỡng này; chỉ micro bị tắt/hỏng mới trả về đúng số 0.
export const DEAD_MIC_PEAK = 1 / 32768;

// Im lặng tuyệt đối liên tục bao lâu thì cảnh báo.
export const DEAD_MIC_WARN_MS = 3000;

// Thang của thanh âm lượng: -60 dB → rỗng, 0 dB → đầy.
const METER_FLOOR_DB = -60;

// Biên độ lớn nhất của một khung mẫu (Float32, -1..1).
export function peakOf(samples: ArrayLike<number>): number {
  let peak = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const value = Math.abs(samples[i]);
    if (value > peak) {
      peak = value;
    }
  }
  return peak;
}

export function hasSignal(peak: number): boolean {
  return peak >= DEAD_MIC_PEAK;
}

// Đổi biên độ ra % độ dài thanh âm lượng (thang dB, giống đồng hồ VU).
export function meterPercent(peak: number): number {
  if (peak <= 0) {
    return 0;
  }
  const db = 20 * Math.log10(peak);
  const percent = ((db - METER_FLOOR_DB) / -METER_FLOOR_DB) * 100;
  return Math.max(0, Math.min(100, Math.round(percent)));
}

// Micro "chết" khi đã im lặng tuyệt đối liên tục đủ lâu kể từ lần cuối có tín hiệu
// (hoặc kể từ lúc bắt đầu ghi, nếu chưa từng có).
export function isMicSilent(lastSignalAt: number, now: number): boolean {
  return now - lastSignalAt >= DEAD_MIC_WARN_MS;
}
