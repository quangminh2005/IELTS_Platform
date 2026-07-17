// Logic thuần cho việc ghi nhận hành vi đáng ngờ khi làm bài (nhấn Ctrl+F, rời tab).
// Không phụ thuộc React/Prisma/DOM để dùng chung cả client lẫn server và test thẳng
// bằng vitest (dự án không cài jsdom).
//
// LƯU Ý: đây chỉ là MANH MỐI để giáo viên hỏi lại học viên, KHÔNG phải bằng chứng
// gian lận — xem mục "Giới hạn đã biết" trong spec.

// Rời tab ngắn hơn mốc này KHÔNG được tính: thông báo nhảy lên rồi tắt trong tích tắc
// là vô tình, còn mở Google tra từ thì chắc chắn lâu hơn 2 giây.
export const TAB_AWAY_MIN_MS = 2000;

// Chỉ cần ba trường này — KeyboardEvent thật thoả mãn cấu trúc, nên test không cần DOM.
export type FindShortcutEvent = {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
};

export type ProctorCounts = {
  tabSwitchCount: number;
  findAttemptCount: number;
};

// Ctrl+F (Windows/Linux), Cmd+F (macOS), F3 (phím "tìm tiếp" của trình duyệt).
export function isFindShortcut(event: FindShortcutEvent): boolean {
  if (event.key === "F3") {
    return true;
  }
  return (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f";
}

export function shouldCountTabAway(awayMs: number): boolean {
  return Number.isFinite(awayMs) && awayMs >= TAB_AWAY_MIN_MS;
}

// Ngưỡng bật cờ: bất kỳ tín hiệu nào ≥ 1 (quyết định của giáo viên trong spec).
export function hasProctorFlag(counts: ProctorCounts): boolean {
  return counts.tabSwitchCount >= 1 || counts.findAttemptCount >= 1;
}

// Số đếm CHỈ ĐƯỢC TĂNG: nhịp heartbeat đến trễ / gửi lại / mở nhiều tab đều không
// được kéo lùi số đã lưu. Cùng nguyên tắc với elapsedSeconds trong attempts.ts.
export function mergeCount(current: number, incoming: number): number {
  const safeCurrent = Number.isFinite(current) && current > 0 ? Math.floor(current) : 0;
  const safeIncoming = Number.isFinite(incoming) && incoming > 0 ? Math.floor(incoming) : 0;
  return Math.max(safeCurrent, safeIncoming);
}

// Chữ hiển thị cho giáo viên — trung tính, mô tả hành vi chứ không kết tội.
export function proctorSummary(counts: ProctorCounts): string {
  if (!hasProctorFlag(counts)) {
    return "Không ghi nhận dấu hiệu bất thường";
  }
  return `Rời tab: ${counts.tabSwitchCount} lần · Thử Ctrl+F: ${counts.findAttemptCount} lần`;
}
