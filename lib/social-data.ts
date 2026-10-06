import type { BoardPerson } from "@/lib/leaderboard";
import { prisma } from "@/lib/prisma";
import { emptyReactionTotals, isReactionKind, type ReactionKind } from "@/lib/social";
import { vietnamDateKey } from "@/lib/vocab-day";

// Đọc DB cho theo dõi + cảm xúc (Mạng xã hội Đợt 2). Logic thuần ở lib/social.ts.
//
// MỌI hàm bọc try/catch và rơi về rỗng: hai bảng Follow/ProfileReaction do ensure-db
// tạo lúc build — nếu câu lệnh đó lỡ hỏng thì hồ sơ, xếp hạng vẫn phải mở được.

const LIST_LIMIT = 200;
const SUGGESTION_LIMIT = 6;

const personSelect = {
  id: true,
  displayName: true,
  avatarUrl: true,
  avatarPreset: true,
  equippedFrame: true,
  user: { select: { image: true } }
} as const;

type PersonRow = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  avatarPreset: string | null;
  equippedFrame: string | null;
  user: { image: string | null } | null;
};

function toPerson(row: PersonRow): BoardPerson {
  return {
    studentId: row.id,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
    avatarPreset: row.avatarPreset,
    userImage: row.user?.image ?? null,
    equippedFrame: row.equippedFrame
  };
}

export async function getFollowCounts(studentId: string): Promise<{ following: number; followers: number }> {
  try {
    const [following, followers] = await Promise.all([
      prisma.follow.count({ where: { followerId: studentId } }),
      prisma.follow.count({ where: { followingId: studentId } })
    ]);
    return { following, followers };
  } catch (error) {
    console.error("[xa-hoi] Không đếm được lượt theo dõi:", error);
    return { following: 0, followers: 0 };
  }
}

// Hai danh sách trên hồ sơ, người mới theo dõi đứng trước.
export async function getFollowLists(
  studentId: string
): Promise<{ following: BoardPerson[]; followers: BoardPerson[] }> {
  try {
    const [following, followers] = await Promise.all([
      prisma.follow.findMany({
        where: { followerId: studentId },
        orderBy: { createdAt: "desc" },
        take: LIST_LIMIT,
        select: { following: { select: personSelect } }
      }),
      prisma.follow.findMany({
        where: { followingId: studentId },
        orderBy: { createdAt: "desc" },
        take: LIST_LIMIT,
        select: { follower: { select: personSelect } }
      })
    ]);
    return {
      following: following.map((row) => toPerson(row.following)),
      followers: followers.map((row) => toPerson(row.follower))
    };
  } catch (error) {
    console.error("[xa-hoi] Không đọc được danh sách theo dõi:", error);
    return { following: [], followers: [] };
  }
}

// Tổng cảm xúc đã nhận từ trước tới nay, theo từng loại.
export async function getReactionTotals(studentId: string): Promise<Record<ReactionKind, number>> {
  const totals = emptyReactionTotals();
  try {
    const rows = await prisma.profileReaction.groupBy({
      by: ["kind"],
      where: { toId: studentId },
      _count: { _all: true }
    });
    for (const row of rows) {
      if (isReactionKind(row.kind)) totals[row.kind] = row._count._all;
    }
  } catch (error) {
    console.error("[xa-hoi] Không đếm được cảm xúc:", error);
  }
  return totals;
}

// Các loại mình đã gửi cho người này HÔM NAY (giờ VN) — nút đó khoá tới mai.
export async function getMyReactionsToday(
  fromId: string,
  toId: string,
  now: Date = new Date()
): Promise<ReactionKind[]> {
  try {
    const rows = await prisma.profileReaction.findMany({
      where: { fromId, toId, dayKey: vietnamDateKey(now) },
      select: { kind: true }
    });
    return rows.map((row) => row.kind).filter(isReactionKind);
  } catch (error) {
    console.error("[xa-hoi] Không đọc được cảm xúc hôm nay:", error);
    return [];
  }
}

export async function isFollowing(meId: string, targetId: string): Promise<boolean> {
  try {
    const row = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: meId, followingId: targetId } },
      select: { followerId: true }
    });
    return row !== null;
  } catch (error) {
    console.error("[xa-hoi] Không kiểm được trạng thái theo dõi:", error);
    return false;
  }
}

export async function getFollowingIds(meId: string): Promise<string[]> {
  try {
    const rows = await prisma.follow.findMany({ where: { followerId: meId }, select: { followingId: true } });
    return rows.map((row) => row.followingId);
  } catch (error) {
    console.error("[xa-hoi] Không đọc được danh sách đang theo dõi:", error);
    return [];
  }
}

// Danh bạ cả trường cho ô "Tìm bạn" (lọc ngay trên trình duyệt — trường chỉ vài chục
// em). Bỏ chính mình, tài khoản thử đã ẩn và hồ sơ chưa từng đăng nhập.
export async function getSchoolDirectory(excludeId: string): Promise<BoardPerson[]> {
  try {
    const rows = await prisma.studentProfile.findMany({
      where: { id: { not: excludeId }, hiddenFromBoards: false, userId: { not: null } },
      orderBy: { displayName: "asc" },
      select: personSelect
    });
    return rows.map(toPerson);
  } catch (error) {
    console.error("[xa-hoi] Không đọc được danh bạ trường:", error);
    return [];
  }
}

// Gợi ý: bạn cùng lớp mà mình chưa theo dõi.
export async function getClassmateSuggestions(meId: string, followingIds: string[]): Promise<BoardPerson[]> {
  try {
    const rows = await prisma.studentProfile.findMany({
      where: {
        id: { notIn: [meId, ...followingIds] },
        hiddenFromBoards: false,
        userId: { not: null },
        classes: { some: { class: { students: { some: { studentId: meId } } } } }
      },
      orderBy: { displayName: "asc" },
      take: SUGGESTION_LIMIT,
      select: personSelect
    });
    return rows.map(toPerson);
  } catch (error) {
    console.error("[xa-hoi] Không đọc được gợi ý bạn cùng lớp:", error);
    return [];
  }
}
