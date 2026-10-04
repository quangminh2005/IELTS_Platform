import { monthKeyOf } from "@/lib/monthly-recap";

// Quà ngoài đời (Xu Đợt 3) — phần logic thuần, dùng chung cho action, trang học viên
// và trang thầy. KHÔNG import prisma ở đây.

export type RedemptionStatus = "pending" | "delivered" | "rejected" | "cancelled";
export type RewardLimitPeriod = "month" | "ever";

// Phiếu "đang giữ" quà: chiếm một suất trong kho và một lượt trong giới hạn mỗi em.
// Phiếu bị từ chối / em tự huỷ thì trả suất về kho.
export const ACTIVE_REDEMPTION_STATUSES = ["pending", "delivered"] as const;

export const REDEMPTION_STATUS_LABELS: Record<RedemptionStatus, string> = {
  pending: "Chờ thầy trao",
  delivered: "Đã nhận quà",
  rejected: "Bị từ chối · đã hoàn Xu",
  cancelled: "Đã huỷ · đã hoàn Xu"
};

export const REDEMPTION_STATUS_CLASSES: Record<RedemptionStatus, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  delivered: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  rejected: "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300",
  cancelled: "bg-muted text-muted-foreground"
};

export const LIMIT_PERIOD_LABELS: Record<RewardLimitPeriod, string> = {
  month: "mỗi tháng",
  ever: "từ trước tới nay"
};

// Gợi ý emoji cho ô chọn ở trang thầy (thầy vẫn gõ emoji khác được).
export const REWARD_EMOJI_SUGGESTIONS = [
  "🧋", "🍦", "🍫", "🍪", "🖊️", "📓", "📚", "🎟️", "🎧", "🧸", "🎁", "⭐"
];

export function isRedemptionStatus(value: string): value is RedemptionStatus {
  return value in REDEMPTION_STATUS_LABELS;
}

export function redeemKey(redemptionId: string): string {
  return `reward:${redemptionId}`;
}

export function refundKey(redemptionId: string): string {
  return `refund:${redemptionId}`;
}

// null = không giới hạn số lượng.
export function remainingStock(stock: number | null, activeCount: number): number | null {
  if (stock === null) return null;
  return Math.max(0, stock - activeCount);
}

// redemptionDates = thời điểm đổi các phiếu ĐANG GIỮ (pending|delivered) của em với món này.
export function studentLimitReached(input: {
  limitPerStudent: number | null;
  limitPeriod: string;
  redemptionDates: Date[];
  now: Date;
}): boolean {
  if (input.limitPerStudent === null) return false;

  const counted =
    input.limitPeriod === "ever"
      ? input.redemptionDates
      : input.redemptionDates.filter((date) => monthKeyOf(date) === monthKeyOf(input.now));

  return counted.length >= input.limitPerStudent;
}

export type RewardCardState = "redeemable" | "short" | "sold_out" | "limit" | "inactive";

export function rewardCardState(input: {
  active: boolean;
  price: number;
  coins: number;
  remaining: number | null;
  limitReached: boolean;
}): RewardCardState {
  if (!input.active) return "inactive";
  if (input.remaining !== null && input.remaining <= 0) return "sold_out";
  if (input.limitReached) return "limit";
  if (input.coins < input.price) return "short";
  return "redeemable";
}
