// Định dạng thời gian làm bài (số giây) sang chuỗi tiếng Việt dễ đọc cho giáo viên.
//   < 60 giây   -> "45 giây"
//   < 60 phút   -> "12 phút 34 giây" (bỏ phần giây nếu tròn phút)
//   >= 60 phút  -> "1 giờ 05 phút"
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));

  if (seconds < 60) {
    return `${seconds} giây`;
  }

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) {
    const remainderSeconds = seconds % 60;
    return remainderSeconds > 0 ? `${minutes} phút ${remainderSeconds} giây` : `${minutes} phút`;
  }

  const hours = Math.floor(minutes / 60);
  const remainderMinutes = minutes % 60;

  return `${hours} giờ ${String(remainderMinutes).padStart(2, "0")} phút`;
}

// Thời gian này có "phóng đại" không? elapsedSeconds là thời gian thực từ lúc bắt
// đầu tới lúc nộp, nên nếu vượt quá giới hạn giờ của bài thì nhiều khả năng học
// sinh đã mở bài rồi tạm dừng, quay lại nộp sau — cần gắn nhãn để giáo viên hiểu đúng.
export function durationExceedsLimit(
  elapsedSeconds: number,
  timeLimitMinutes: number | null
): boolean {
  return timeLimitMinutes !== null && timeLimitMinutes > 0 && elapsedSeconds > timeLimitMinutes * 60;
}
