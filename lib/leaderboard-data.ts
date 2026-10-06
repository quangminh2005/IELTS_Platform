import { unstable_cache } from "next/cache";
import { loadSchoolStreakInput } from "@/lib/day-streak-data";
import {
  LEADERBOARD_CACHE_TAG,
  boardWindow,
  schoolDayStreaks,
  streakBoardEntries,
  xpBoardEntries,
  type BoardPerson,
  type HomeBoardView,
  type HomeLeaderboardData,
  type LeaderboardEntry,
  type StreakBoardSource
} from "@/lib/leaderboard";
import { monthKeyOf } from "@/lib/monthly-recap";
import { getMonthlyRecap } from "@/lib/monthly-recap-data";
import { prisma } from "@/lib/prisma";
import { vietnamDateKey } from "@/lib/vocab-day";
import { getLifetimeXpMap } from "@/lib/xp-rank-data";

// Đọc DB cho bảng xếp hạng (Mạng xã hội Đợt 1). Logic thuần ở lib/leaderboard.ts.

export async function loadBoardPeople(ids: string[]): Promise<Map<string, BoardPerson>> {
  if (ids.length === 0) return new Map();

  const rows = await prisma.studentProfile.findMany({
    // Tài khoản thử thầy đã ẩn không lên bảng.
    where: { id: { in: ids }, hiddenFromBoards: false },
    select: {
      id: true,
      displayName: true,
      avatarUrl: true,
      avatarPreset: true,
      equippedFrame: true,
      user: { select: { image: true } }
    }
  });

  return new Map(
    rows.map((row) => [
      row.id,
      {
        studentId: row.id,
        displayName: row.displayName,
        avatarUrl: row.avatarUrl,
        avatarPreset: row.avatarPreset,
        userImage: row.user?.image ?? null,
        equippedFrame: row.equippedFrame
      }
    ])
  );
}

// Trả mảng JSON thuần (đi qua unstable_cache): chỉ em có chuỗi > 0, chưa xếp hạng.
async function loadStreakBoard(today: string): Promise<StreakBoardSource[]> {
  const streaks = schoolDayStreaks(await loadSchoolStreakInput(today), today);
  const ids = Array.from(streaks.entries())
    .filter(([, streak]) => streak.days > 0)
    .map(([id]) => id);
  const people = await loadBoardPeople(ids);

  return ids.flatMap((id) => {
    const person = people.get(id);
    const streak = streaks.get(id);
    // Hồ sơ đã bị xoá → bỏ qua.
    return person && streak ? [{ ...person, days: streak.days, activeToday: streak.activeToday }] : [];
  });
}

// Khoá theo NGÀY VN (chuỗi) để cache trúng cả ngày; làm mới sau 5 phút hoặc khi có
// bài nộp (submitSkill gọi revalidateTag). Ôn thẻ không xoá cache → trễ tối đa 5 phút.
const cachedStreakBoard = unstable_cache(loadStreakBoard, ["leaderboard-streak-v1"], {
  revalidate: 300,
  tags: [LEADERBOARD_CACHE_TAG]
});

export async function getStreakBoard(now: Date = new Date()): Promise<StreakBoardSource[]> {
  return cachedStreakBoard(vietnamDateKey(now));
}

export async function classMemberIds(classId: string): Promise<Set<string>> {
  const rows = await prisma.classStudent.findMany({ where: { classId }, select: { studentId: true } });
  return new Set(rows.map((row) => row.studentId));
}

const HOME_TOP = 5;

function homeView(entries: LeaderboardEntry[], studentId: string, href: string): HomeBoardView {
  return {
    ...boardWindow(entries, studentId, HOME_TOP),
    inBoard: entries.some((entry) => entry.studentId === studentId),
    href
  };
}

// Khối Top 5 + mình ở trang chủ (toàn trường). Lỗi → null, trang chủ vẫn chạy.
export async function getHomeLeaderboard(
  studentId: string,
  now: Date = new Date()
): Promise<HomeLeaderboardData | null> {
  try {
    const monthKey = monthKeyOf(now);
    const [recap, streakRows] = await Promise.all([getMonthlyRecap(monthKey, now), getStreakBoard(now)]);
    // Chip hạng đấu chỉ cần cho những dòng sẽ hiện: top 5 + chính mình.
    const lifetimeXp = await getLifetimeXpMap(
      recap.xpBoard
        .slice(0, HOME_TOP)
        .map((entry) => entry.studentId)
        .concat(studentId)
    );

    return {
      monthKey,
      xp: homeView(xpBoardEntries(recap.xpBoard, null, lifetimeXp), studentId, "/student/ranking"),
      streak: homeView(streakBoardEntries(streakRows, null), studentId, "/student/ranking?board=streak")
    };
  } catch (error) {
    console.error("[bang-xep-hang] không tính được khối trang chủ", error);
    return null;
  }
}
