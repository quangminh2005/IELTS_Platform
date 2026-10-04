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

// ---- Chế độ "Tổng thời gian cả bài" (Assignment.totalTimeLimitMinutes) ----
// Một đồng hồ chung cho mọi kỹ năng tự nộp được (Listening/Reading/Writing):
// thời gian làm thực của các kỹ năng cộng dồn vào cùng một ngân sách. Speaking
// không tính giờ, không đồng hồ trong chế độ này.

function timedElapsedSum(elapsedBySkill: Record<string, number>, exceptSkill?: string): number {
  let sum = 0;
  for (const [skill, seconds] of Object.entries(elapsedBySkill)) {
    if (skill !== exceptSkill && AUTO_SUBMIT_SKILLS.has(skill)) {
      sum += Math.max(0, seconds);
    }
  }
  return sum;
}

// Thời gian còn lại của cả bài (giây), không âm.
export function totalRemainingSeconds(
  totalMinutes: number,
  elapsedBySkill: Record<string, number>
): number {
  return Math.max(0, totalMinutes * 60 - timedElapsedSum(elapsedBySkill));
}

// Ngân sách của kỹ năng đang mở = tổng − thời gian các kỹ năng tính giờ KHÁC (để
// đồng hồ trừ dần theo elapsed của chính kỹ năng này). Speaking → null.
export function totalModeBudgetSeconds(
  skill: string,
  totalMinutes: number,
  elapsedBySkill: Record<string, number>
): number | null {
  if (!AUTO_SUBMIT_SKILLS.has(skill)) {
    return null;
  }
  return Math.max(0, totalMinutes * 60 - timedElapsedSum(elapsedBySkill, skill));
}

// Ngân sách (giây) của một kỹ năng theo cấu hình bài giao: có tổng thời gian thì
// dùng chế độ tổng, không thì giữ giới hạn theo từng kỹ năng như cũ.
export function resolveSkillBudgetSeconds(input: {
  skill: string;
  skillLimits: Record<string, number>;
  isMultiSkill: boolean;
  fallbackMinutes: number | null;
  totalMinutes: number | null;
  elapsedBySkill: Record<string, number>;
}): number | null {
  if (input.totalMinutes != null && input.totalMinutes > 0) {
    return totalModeBudgetSeconds(input.skill, input.totalMinutes, input.elapsedBySkill);
  }
  return skillBudgetSeconds(input.skill, input.skillLimits, input.isMultiSkill, input.fallbackMinutes);
}

// Đã dùng hết ngân sách chưa (chừa epsilon chống lệch làm tròn ở nhịp cuối).
export function isSkillTimeUp(
  elapsedSeconds: number,
  budgetSeconds: number,
  epsilonSeconds: number = 3
): boolean {
  return elapsedSeconds >= budgetSeconds - epsilonSeconds;
}
