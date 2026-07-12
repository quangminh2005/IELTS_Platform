// Helper thuần cho đồng hồ "thời gian làm thực" + tự động nộp khi hết giờ.
// Không phụ thuộc React/Prisma để dùng chung cả client lẫn server action.

// Mỗi nhịp đếm chỉ cộng tối đa bấy nhiêu giây. Khi máy ngủ / tab ở nền bị trình
// duyệt throttle / mất mạng làm treo JS thì nhịp giãn rất dài — chặn ở mức này để
// khoảng lặng đó KHÔNG bị tính vào thời gian làm bài.
export const ACTIVE_TICK_CAP_SECONDS = 2;

// Kỹ năng được tự động nộp khi hết giờ. Speaking KHÔNG tự nộp.
export const AUTO_SUBMIT_SKILLS = new Set<string>(["listening", "reading", "writing"]);

// Cộng dồn thời gian làm thực theo từng nhịp, chặn nhịp nhảy và bỏ qua delta âm.
export function accumulateActiveSeconds(
  current: number,
  deltaMs: number,
  capSeconds: number = ACTIVE_TICK_CAP_SECONDS
): number {
  const deltaSeconds = deltaMs / 1000;
  const capped = Math.min(Math.max(deltaSeconds, 0), capSeconds);
  return current + capped;
}

// Ngân sách thời gian (giây) của một kỹ năng; null = không giới hạn.
export function skillBudgetSeconds(
  skill: string,
  skillLimits: Record<string, number>,
  isMultiSkill: boolean,
  fallbackMinutes: number | null
): number | null {
  const minutes = skillLimits[skill] ?? (isMultiSkill ? null : fallbackMinutes);
  return minutes != null ? minutes * 60 : null;
}

// Đã dùng hết ngân sách chưa (chừa epsilon chống lệch làm tròn ở nhịp cuối).
export function isSkillTimeUp(
  elapsedSeconds: number,
  budgetSeconds: number,
  epsilonSeconds: number = 3
): boolean {
  return elapsedSeconds >= budgetSeconds - epsilonSeconds;
}
