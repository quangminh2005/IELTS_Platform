import type { Prisma } from "@prisma/client";
import { monthKeyOf, monthRange } from "@/lib/monthly-recap";
import { prisma } from "@/lib/prisma";
import {
  calculateWeekStreak,
  restoredWeekOf,
  streakRestoreOffer,
  streakRestorePrice,
  type StreakRestoreOffer,
  type StreakResult
} from "@/lib/streak";

// Lớp chưa đặt chỉ tiêu tuần thì mặc định 3 bài/tuần.
export const DEFAULT_WEEKLY_GOAL = 3;

export type WeekStreakData = {
  streak: StreakResult;
  offer: StreakRestoreOffer | null; // null = không có tuần nào cứu được
  price: number; // giá cứu lần kế tiếp trong tháng này
  coins: number;
};

// Một nguồn duy nhất cho chuỗi tuần: trang chủ, trang Hồ sơ và action khôi phục đều
// gọi hàm này để không tính lệch nhau. Đếm MỌI lượt đã nộp (kể cả luyện lại).
// `db` = tx khi gọi trong transaction đã khoá dòng học viên.
export async function getWeekStreak(
  studentId: string,
  now: Date = new Date(),
  db: Prisma.TransactionClient = prisma
): Promise<WeekStreakData> {
  const [attempts, membership, restores, profile] = await Promise.all([
    db.attempt.findMany({
      where: { studentId, status: { in: ["submitted", "reviewed"] }, submittedAt: { not: null } },
      select: { submittedAt: true }
    }),
    db.classStudent.findFirst({
      where: { studentId },
      orderBy: { joinedAt: "desc" },
      select: { class: { select: { weeklyGoal: true } } }
    }),
    db.coinTransaction.findMany({
      where: { studentId, kind: "streak_restore" },
      select: { key: true, createdAt: true }
    }),
    db.studentProfile.findUnique({ where: { id: studentId }, select: { coins: true } })
  ]);

  const submittedAt = attempts
    .map((attempt) => attempt.submittedAt)
    .filter((date): date is Date => date !== null);
  const weeklyGoal = membership?.class.weeklyGoal ?? DEFAULT_WEEKLY_GOAL;
  const restoredWeeks = restores
    .map((row) => restoredWeekOf(row.key))
    .filter((week): week is string => week !== null);

  // Giá tính theo số lần đã cứu trong THÁNG HIỆN TẠI (giờ VN, theo lúc bấm cứu).
  const month = monthRange(monthKeyOf(now));
  const usedThisMonth = restores.filter(
    (row) => row.createdAt >= month.start && row.createdAt < month.end
  ).length;

  return {
    streak: calculateWeekStreak({ submittedAt, weeklyGoal, now, restoredWeeks }),
    offer: streakRestoreOffer({ submittedAt, weeklyGoal, now, restoredWeeks }),
    price: streakRestorePrice(usedThisMonth),
    coins: profile?.coins ?? 0
  };
}
