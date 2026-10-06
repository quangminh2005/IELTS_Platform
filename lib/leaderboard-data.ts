import { unstable_cache } from "next/cache";
import { loadSchoolStreakInput } from "@/lib/day-streak-data";
import {
  LEADERBOARD_CACHE_TAG,
  schoolDayStreaks,
  type BoardPerson,
  type StreakBoardSource
} from "@/lib/leaderboard";
import { prisma } from "@/lib/prisma";
import { vietnamDateKey } from "@/lib/vocab-day";

// Đọc DB cho bảng xếp hạng (Mạng xã hội Đợt 1). Logic thuần ở lib/leaderboard.ts.

export async function loadBoardPeople(ids: string[]): Promise<Map<string, BoardPerson>> {
  if (ids.length === 0) return new Map();

  const rows = await prisma.studentProfile.findMany({
    where: { id: { in: ids } },
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
