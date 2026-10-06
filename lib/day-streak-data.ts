import type { Prisma } from "@prisma/client";
import { activeDayKeys, buildActivityDays, type ActivityDay } from "@/lib/activity-heatmap";
import {
  calculateDayStreak,
  dayStreakRestoreOffer,
  restoredDayOf,
  streakRestorePrice,
  type DayRestoreOffer,
  type DayStreak
} from "@/lib/day-streak";
import type { SchoolStreakInput } from "@/lib/leaderboard";
import { monthKeyOf, monthRange } from "@/lib/monthly-recap";
import { prisma } from "@/lib/prisma";
import { vietnamDateKey } from "@/lib/vocab-day";
import { dateKeyToUtcDate } from "@/lib/vocab-daily";
import { shiftDateKey } from "@/lib/vocab-streak";

type Db = Prisma.TransactionClient;

// Chuỗi dài hơn chừng này ngày thì vẫn đúng tới mốc này — đủ xa cho thực tế.
const STREAK_LOOKBACK_DAYS = 400;
const DAY_MS = 24 * 60 * 60 * 1000;

// Ngày có học từ `sinceKey` (giờ VN) trở đi — dùng chung cho chuỗi 🔥 và Lịch chăm học.
// Không có bảng riêng: suy ra từ giờ nộp bài + ngày ôn Sổ từ.
export async function loadActivityDays(
  studentId: string,
  sinceKey: string,
  db: Db = prisma
): Promise<Map<string, ActivityDay>> {
  // Lùi thêm 1 ngày cho chắc qua ranh giới giờ VN; ngày ngoài cửa sổ bị logic bỏ qua.
  const since = new Date(dateKeyToUtcDate(sinceKey).getTime() - DAY_MS);

  const [skillSubmits, legacyAttempts, vocabDays] = await Promise.all([
    // Mỗi phần kỹ năng nộp (bài giao + tự luyện, mọi lượt) = 1 việc.
    db.attemptSkill.findMany({
      where: { submittedAt: { gte: since }, attempt: { studentId } },
      select: { submittedAt: true }
    }),
    // Bài nộp cũ được backfill AttemptSkill chỉ có status, không có giờ nộp
    // từng kỹ năng → tính 1 việc theo giờ nộp của cả bài.
    db.attempt.findMany({
      where: {
        studentId,
        submittedAt: { gte: since },
        skills: { none: { submittedAt: { not: null } } }
      },
      select: { submittedAt: true }
    }),
    db.vocabQuizDay.findMany({
      where: { studentId, date: { gte: dateKeyToUtcDate(sinceKey) } },
      select: { date: true, total: true }
    })
  ]);

  const submits: Date[] = [];
  for (const row of [...skillSubmits, ...legacyAttempts]) {
    if (row.submittedAt) {
      submits.push(row.submittedAt);
    }
  }

  return buildActivityDays({
    submits,
    // VocabQuizDay.date lưu nửa đêm UTC của ngày VN → cắt chuỗi là ra khoá ngày.
    vocabDays: vocabDays.map((row) => ({
      date: row.date.toISOString().slice(0, 10),
      total: row.total
    }))
  });
}

// Dữ liệu chuỗi ngày của CẢ TRƯỜNG (bảng Chuỗi 🔥) — cùng nguồn, cùng cửa sổ với
// loadActivityDays/getDayStreak, nhưng 4 truy vấn cho mọi học viên thay vì từng em.
export async function loadSchoolStreakInput(today: string): Promise<SchoolStreakInput> {
  const sinceKey = shiftDateKey(today, -STREAK_LOOKBACK_DAYS);
  // Lùi thêm 1 ngày cho chắc qua ranh giới giờ VN (như loadActivityDays).
  const since = new Date(dateKeyToUtcDate(sinceKey).getTime() - DAY_MS);

  const [skillSubmits, legacyAttempts, vocabDays, restores] = await Promise.all([
    prisma.attemptSkill.findMany({
      where: { submittedAt: { gte: since } },
      select: { submittedAt: true, attempt: { select: { studentId: true } } }
    }),
    prisma.attempt.findMany({
      where: { submittedAt: { gte: since }, skills: { none: { submittedAt: { not: null } } } },
      select: { studentId: true, submittedAt: true }
    }),
    prisma.vocabQuizDay.findMany({
      where: { date: { gte: dateKeyToUtcDate(sinceKey) } },
      select: { studentId: true, date: true, total: true }
    }),
    prisma.coinTransaction.findMany({
      where: { kind: "streak_restore" },
      select: { studentId: true, key: true }
    })
  ]);

  const submits: SchoolStreakInput["submits"] = [];
  for (const row of skillSubmits) {
    if (row.submittedAt) submits.push({ studentId: row.attempt.studentId, submittedAt: row.submittedAt });
  }
  for (const row of legacyAttempts) {
    if (row.submittedAt) submits.push({ studentId: row.studentId, submittedAt: row.submittedAt });
  }

  return {
    submits,
    // VocabQuizDay.date lưu nửa đêm UTC của ngày VN → cắt chuỗi là ra khoá ngày.
    vocabDays: vocabDays.map((row) => ({
      studentId: row.studentId,
      date: row.date.toISOString().slice(0, 10),
      total: row.total
    })),
    restoreKeys: restores
  };
}

// Mọi dòng khôi phục chuỗi trong sổ Xu (cả khoá tuần cũ — vẫn tính vào giá trong tháng).
export async function loadRestoreRows(studentId: string, db: Db = prisma) {
  return db.coinTransaction.findMany({
    where: { studentId, kind: "streak_restore" },
    select: { key: true, createdAt: true }
  });
}

export function restoredDaysOf(rows: { key: string }[]): string[] {
  return rows.map((row) => restoredDayOf(row.key)).filter((day): day is string => day !== null);
}

export type DayStreakData = {
  streak: DayStreak;
  offer: DayRestoreOffer | null; // null = không có ngày nào cứu được
  price: number; // giá cứu lần kế tiếp trong tháng này
  coins: number;
};

// Một nguồn duy nhất cho chuỗi ngày: trang chủ, Hồ sơ, trang Từ vựng, action khôi phục
// và action mở tư thế linh vật đều gọi hàm này. `db` = tx khi gọi trong transaction
// đã khoá dòng học viên.
export async function getDayStreak(
  studentId: string,
  now: Date = new Date(),
  db: Db = prisma
): Promise<DayStreakData> {
  const today = vietnamDateKey(now);

  const [days, restores, profile] = await Promise.all([
    loadActivityDays(studentId, shiftDateKey(today, -STREAK_LOOKBACK_DAYS), db),
    loadRestoreRows(studentId, db),
    db.studentProfile.findUnique({ where: { id: studentId }, select: { coins: true } })
  ]);

  const activeDays = activeDayKeys(days);
  const restoredDays = restoredDaysOf(restores);

  // Giá tính theo số lần đã cứu trong THÁNG HIỆN TẠI (giờ VN, theo lúc bấm cứu).
  const month = monthRange(monthKeyOf(now));
  const usedThisMonth = restores.filter(
    (row) => row.createdAt >= month.start && row.createdAt < month.end
  ).length;

  return {
    streak: calculateDayStreak({ activeDays, restoredDays, today }),
    offer: dayStreakRestoreOffer({ activeDays, restoredDays, today }),
    price: streakRestorePrice(usedThisMonth),
    coins: profile?.coins ?? 0
  };
}
