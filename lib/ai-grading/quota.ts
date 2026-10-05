import { VN_OFFSET_MS } from "@/lib/streak";

// Giới hạn lượt học viên tự nhờ AI chấm bài tự luyện (thầy chỉnh ở /teacher/practice).
export const DEFAULT_AI_DAILY_LIMIT = 3;
export const MAX_AI_DAILY_LIMIT = 20;
// Lượt "pending" lâu hơn mức này coi như hàm máy chủ đã chết giữa chừng.
export const PENDING_STALE_MS = 5 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

export function vnDayStart(now: Date): Date {
  const shifted = now.getTime() + VN_OFFSET_MS;
  return new Date(Math.floor(shifted / DAY_MS) * DAY_MS - VN_OFFSET_MS);
}

export function vnMonthStart(now: Date): Date {
  const shifted = new Date(now.getTime() + VN_OFFSET_MS);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), 1) - VN_OFFSET_MS);
}

export function effectiveDailyLimit(limit: number | null | undefined): number {
  const value = limit ?? DEFAULT_AI_DAILY_LIMIT;
  return Math.min(MAX_AI_DAILY_LIMIT, Math.max(0, Math.round(value)));
}

export function remainingAiQuota(limit: number, usedToday: number): number {
  return Math.max(0, limit - usedToday);
}

export function isStalePending(createdAt: Date, now: Date): boolean {
  return now.getTime() - createdAt.getTime() > PENDING_STALE_MS;
}
