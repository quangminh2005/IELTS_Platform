import { prisma } from "@/lib/prisma";
import {
  ACTIVE_REDEMPTION_STATUSES,
  isRedemptionStatus,
  remainingStock,
  rewardCardState,
  studentLimitReached,
  type RedemptionStatus,
  type RewardCardState
} from "@/lib/rewards";

// Truy vấn cho tab "Quà" ở Cửa hàng học viên. Logic tính trạng thái nằm ở lib/rewards.ts
// (dùng chung với action redeemReward để thẻ và server luôn nói cùng một điều).

export type StudentRewardCard = {
  id: string;
  emoji: string;
  imageUrl: string | null;
  name: string;
  description: string | null;
  price: number;
  remaining: number | null;
  limitPerStudent: number | null;
  limitPeriod: string;
  state: RewardCardState;
};

export type StudentRedemptionRow = {
  id: string;
  rewardName: string;
  rewardEmoji: string;
  price: number;
  status: RedemptionStatus;
  teacherNote: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
};

export async function getStudentRewards(
  studentId: string,
  coins: number,
  now: Date = new Date()
): Promise<{ cards: StudentRewardCard[]; redemptions: StudentRedemptionRow[] }> {
  const [rewards, activeCounts, redemptions] = await Promise.all([
    prisma.reward.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { price: "asc" }, { createdAt: "asc" }]
    }),
    prisma.rewardRedemption.groupBy({
      by: ["rewardId"],
      where: { status: { in: [...ACTIVE_REDEMPTION_STATUSES] } },
      _count: { _all: true }
    }),
    // 100 phiếu gần nhất là thừa cho cả danh sách lẫn việc tính giới hạn mỗi em
    // (server vẫn kiểm lại đầy đủ khi đổi).
    prisma.rewardRedemption.findMany({
      where: { studentId },
      orderBy: { createdAt: "desc" },
      take: 100
    })
  ]);

  const activeByReward = new Map(activeCounts.map((row) => [row.rewardId, row._count._all]));
  const activeStatuses: readonly string[] = ACTIVE_REDEMPTION_STATUSES;

  const cards = rewards.map((reward): StudentRewardCard => {
    const remaining = remainingStock(reward.stock, activeByReward.get(reward.id) ?? 0);
    const limitReached = studentLimitReached({
      limitPerStudent: reward.limitPerStudent,
      limitPeriod: reward.limitPeriod,
      redemptionDates: redemptions
        .filter((row) => row.rewardId === reward.id && activeStatuses.includes(row.status))
        .map((row) => row.createdAt),
      now
    });

    return {
      id: reward.id,
      emoji: reward.emoji,
      imageUrl: reward.imageUrl,
      name: reward.name,
      description: reward.description,
      price: reward.price,
      remaining,
      limitPerStudent: reward.limitPerStudent,
      limitPeriod: reward.limitPeriod,
      state: rewardCardState({ active: reward.active, price: reward.price, coins, remaining, limitReached })
    };
  });

  return {
    cards,
    redemptions: redemptions.map((row) => ({
      id: row.id,
      rewardName: row.rewardName,
      rewardEmoji: row.rewardEmoji,
      price: row.price,
      status: isRedemptionStatus(row.status) ? row.status : "pending",
      teacherNote: row.teacherNote,
      createdAt: row.createdAt,
      resolvedAt: row.resolvedAt
    }))
  };
}
