import { unstable_cache } from "next/cache";
import { loadSchoolStreakInput } from "@/lib/day-streak-data";
import {
  feedDayRange,
  itemEvents,
  mergeFeed,
  prizeEvents,
  rankUpEvents,
  streakMilestoneEvents,
  vocabEvents,
  workEvents,
  FEED_MAX_LIMIT,
  type FeedEvent,
  type FeedKind,
  type WorkSource
} from "@/lib/feed";
import type { FeedUser } from "@/lib/feed-user";
import { LEADERBOARD_CACHE_TAG, type BoardPerson } from "@/lib/leaderboard";
import { loadBoardPeople } from "@/lib/leaderboard-data";
import { PRACTICE_MODE } from "@/lib/practice";
import { prisma } from "@/lib/prisma";
import { vietnamDateKey } from "@/lib/vocab-day";
import { XP_EARN_KINDS } from "@/lib/xp-rank";

// Đọc DB cho bảng tin (Mạng xã hội Đợt 3). Logic thuần ở lib/feed.ts.
//
// Danh sách hoạt động cả trường được cache 5 phút theo NGÀY VN, gắn tag bảng xếp hạng
// (submitSkill đã xoá tag này sau mỗi lần nộp). Tim + bình luận thì đọc thẳng, không
// cache — bấm xong phải thấy ngay.

async function loadSchoolFeed(today: string): Promise<FeedEvent[]> {
  const now = new Date();
  const { fromDay, toDay, since } = feedDayRange(now);
  const fromDate = new Date(`${fromDay}T00:00:00Z`);

  const [skillRows, legacyRows, vocabRows, items, prizes, hidden, streakInput, earnersSince] = await Promise.all([
    prisma.attemptSkill.findMany({
      where: { submittedAt: { gte: since } },
      select: {
        skill: true,
        submittedAt: true,
        attempt: {
          select: {
            id: true,
            studentId: true,
            assignmentRecipient: { select: { assignment: { select: { title: true, mode: true } } } }
          }
        }
      }
    }),
    // Lượt cũ chưa tách kỹ năng.
    prisma.attempt.findMany({
      where: { submittedAt: { gte: since }, skills: { none: { submittedAt: { not: null } } } },
      select: {
        id: true,
        studentId: true,
        submittedAt: true,
        assignmentRecipient: { select: { assignment: { select: { title: true, mode: true } } } }
      }
    }),
    prisma.vocabQuizDay.findMany({
      where: { date: { gte: fromDate } },
      select: { studentId: true, date: true, total: true, updatedAt: true }
    }),
    prisma.studentItem.findMany({
      where: { createdAt: { gte: since }, source: { in: ["achievement", "streak"] } },
      select: { id: true, studentId: true, itemKey: true, source: true, createdAt: true }
    }),
    prisma.coinTransaction.findMany({
      where: { kind: "monthly_prize", createdAt: { gte: since } },
      select: { studentId: true, key: true, note: true, createdAt: true }
    }),
    prisma.studentProfile.findMany({ where: { hiddenFromBoards: true }, select: { id: true } }),
    loadSchoolStreakInput(today),
    prisma.coinTransaction.findMany({
      where: { kind: { in: [...XP_EARN_KINDS] }, createdAt: { gte: since } },
      distinct: ["studentId"],
      select: { studentId: true }
    })
  ]);

  // Lên hạng cần cộng dồn TRỌN sổ XP của những em có XP mới trong cửa sổ.
  const ledger =
    earnersSince.length === 0
      ? []
      : await prisma.coinTransaction.findMany({
          where: { studentId: { in: earnersSince.map((row) => row.studentId) }, kind: { in: [...XP_EARN_KINDS] } },
          select: { studentId: true, amount: true, createdAt: true }
        });

  const work: WorkSource[] = [];
  for (const row of skillRows) {
    if (!row.submittedAt) continue;
    const assignment = row.attempt.assignmentRecipient.assignment;
    work.push({
      studentId: row.attempt.studentId,
      attemptId: row.attempt.id,
      title: assignment.title,
      practice: assignment.mode === PRACTICE_MODE,
      skill: row.skill,
      submittedAt: row.submittedAt
    });
  }
  for (const row of legacyRows) {
    if (!row.submittedAt) continue;
    const assignment = row.assignmentRecipient.assignment;
    work.push({
      studentId: row.studentId,
      attemptId: row.id,
      title: assignment.title,
      practice: assignment.mode === PRACTICE_MODE,
      skill: null,
      submittedAt: row.submittedAt
    });
  }

  const vocab = vocabRows.map((row) => ({
    studentId: row.studentId,
    // VocabQuizDay.date lưu nửa đêm UTC của ngày VN → cắt chuỗi là ra khoá ngày.
    date: row.date.toISOString().slice(0, 10),
    total: row.total,
    updatedAt: row.updatedAt
  }));

  const events = [
    ...workEvents(work),
    ...streakMilestoneEvents(streakInput, {
      fromDay,
      toDay,
      vocabTimes: new Map(vocab.map((row) => [`${row.studentId}|${row.date}`, row.updatedAt]))
    }),
    ...rankUpEvents(ledger, since),
    ...vocabEvents(vocab),
    ...itemEvents(items),
    ...prizeEvents(prizes)
  ];

  return mergeFeed(events, { since, hiddenIds: new Set(hidden.map((row) => row.id)) });
}

const cachedSchoolFeed = unstable_cache(loadSchoolFeed, ["school-feed-v1"], {
  revalidate: 300,
  tags: [LEADERBOARD_CACHE_TAG]
});

// Qua unstable_cache, Date thành chuỗi ISO → dựng lại.
export async function getSchoolFeed(now: Date = new Date()): Promise<FeedEvent[]> {
  const rows = await cachedSchoolFeed(vietnamDateKey(now));
  return rows.map((row) => ({ ...row, at: new Date(row.at) }));
}

export async function findFeedEvent(eventKey: string): Promise<FeedEvent | null> {
  return (await getSchoolFeed()).find((event) => event.key === eventKey) ?? null;
}

// ---- Trang bảng tin ----

export type FeedItemView = {
  key: string;
  kind: FeedKind;
  emoji: string;
  text: string;
  at: string;
  owner: BoardPerson;
  hearts: number;
  hearted: boolean;
  comments: number;
  // Vài bình luận mới nhất (cũ → mới) hiện sẵn dưới thẻ, khỏi phải bấm 💬 mới thấy.
  previewComments: FeedCommentView[];
};

// Số bình luận hiện sẵn mỗi thẻ; nhiều hơn thì có nút "Xem … bình luận trước".
export const FEED_COMMENT_PREVIEW = 3;

export async function getFeedPage(opts: {
  viewer: FeedUser;
  // null = cả trường; Set = chỉ những học viên này (tab Bạn bè)
  studentIds: ReadonlySet<string> | null;
  limit: number;
  focusKey?: string | null;
}): Promise<{ items: FeedItemView[]; hasMore: boolean; focusMissing: boolean }> {
  const all = await getSchoolFeed();
  const focus = opts.focusKey ? all.find((event) => event.key === opts.focusKey) ?? null : null;
  const scoped = opts.studentIds ? all.filter((event) => opts.studentIds?.has(event.studentId)) : all;
  const ordered = focus ? [focus, ...scoped.filter((event) => event.key !== focus.key)] : scoped;
  const page = ordered.slice(0, opts.limit);
  const keys = page.map((event) => event.key);

  const [people, heartCounts, myHearts, commentCounts] = await Promise.all([
    loadBoardPeople(Array.from(new Set(page.map((event) => event.studentId)))),
    keys.length === 0
      ? []
      : prisma.feedHeart.groupBy({ by: ["eventKey"], where: { eventKey: { in: keys } }, _count: { _all: true } }),
    keys.length === 0
      ? []
      : prisma.feedHeart.findMany({
          where: { eventKey: { in: keys }, userId: opts.viewer.userId },
          select: { eventKey: true }
        }),
    keys.length === 0
      ? []
      : prisma.feedComment.groupBy({ by: ["eventKey"], where: { eventKey: { in: keys } }, _count: { _all: true } })
  ]);

  const hearts = new Map(heartCounts.map((row) => [row.eventKey, row._count._all]));
  const mine = new Set(myHearts.map((row) => row.eventKey));
  const comments = new Map(commentCounts.map((row) => [row.eventKey, row._count._all]));
  const previews = await loadCommentPreviews(Array.from(comments.keys()), opts.viewer);

  const items = page.flatMap((event) => {
    const owner = people.get(event.studentId);
    return owner
      ? [
          {
            key: event.key,
            kind: event.kind,
            emoji: event.emoji,
            text: event.text,
            at: event.at.toISOString(),
            owner,
            hearts: hearts.get(event.key) ?? 0,
            hearted: mine.has(event.key),
            comments: comments.get(event.key) ?? 0,
            previewComments: previews.get(event.key) ?? []
          }
        ]
      : [];
  });

  return { items, hasMore: ordered.length > opts.limit, focusMissing: Boolean(opts.focusKey) && !focus };
}

// ---- Bình luận ----

export type FeedCommentView = {
  id: string;
  body: string;
  at: string;
  authorName: string;
  authorIsTeacher: boolean;
  // null = thầy (vẽ huy hiệu GV thay avatar)
  authorPerson: BoardPerson | null;
  canDelete: boolean;
};

const authorSelect = {
  id: true,
  role: true,
  name: true,
  image: true,
  teacherProfile: { select: { displayName: true } },
  studentProfile: {
    select: { id: true, displayName: true, avatarUrl: true, avatarPreset: true, equippedFrame: true }
  }
} as const;

type AuthorRow = {
  id: string;
  role: string;
  name: string | null;
  image: string | null;
  teacherProfile: { displayName: string | null } | null;
  studentProfile: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    avatarPreset: string | null;
    equippedFrame: string | null;
  } | null;
};

function authorView(author: AuthorRow): { name: string; isTeacher: boolean; person: BoardPerson | null } {
  if (author.role === "teacher" || !author.studentProfile) {
    return { name: author.teacherProfile?.displayName ?? author.name ?? "Thầy", isTeacher: true, person: null };
  }
  const profile = author.studentProfile;
  return {
    name: profile.displayName,
    isTeacher: false,
    person: {
      studentId: profile.id,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      avatarPreset: profile.avatarPreset,
      userImage: author.image,
      equippedFrame: profile.equippedFrame
    }
  };
}

export function canDeleteComment(
  viewer: Pick<FeedUser, "userId" | "role" | "studentId">,
  comment: { authorUserId: string; ownerStudentId: string }
): boolean {
  return (
    viewer.role === "teacher" ||
    comment.authorUserId === viewer.userId ||
    (viewer.studentId !== null && comment.ownerStudentId === viewer.studentId)
  );
}

const commentSelect = {
  id: true,
  eventKey: true,
  body: true,
  createdAt: true,
  authorUserId: true,
  ownerStudentId: true,
  author: { select: authorSelect }
} as const;

function toCommentView(
  row: { id: string; body: string; createdAt: Date; authorUserId: string; ownerStudentId: string; author: AuthorRow },
  viewer: FeedUser
): FeedCommentView {
  const author = authorView(row.author);
  return {
    id: row.id,
    body: row.body,
    at: row.createdAt.toISOString(),
    authorName: author.name,
    authorIsTeacher: author.isTeacher,
    authorPerson: author.person,
    canDelete: canDeleteComment(viewer, row)
  };
}

export async function getComments(eventKey: string, viewer: FeedUser): Promise<FeedCommentView[]> {
  const rows = await prisma.feedComment.findMany({
    where: { eventKey },
    orderBy: { createdAt: "asc" },
    take: FEED_MAX_LIMIT,
    select: commentSelect
  });
  return rows.map((row) => toCommentView(row, viewer));
}

// Bình luận hiện sẵn trên bảng tin: một truy vấn cho cả trang, mỗi thẻ giữ vài cái mới nhất.
async function loadCommentPreviews(eventKeys: string[], viewer: FeedUser): Promise<Map<string, FeedCommentView[]>> {
  const result = new Map<string, FeedCommentView[]>();
  if (eventKeys.length === 0) return result;

  const rows = await prisma.feedComment.findMany({
    where: { eventKey: { in: eventKeys } },
    orderBy: { createdAt: "asc" },
    select: commentSelect
  });
  for (const row of rows) {
    const list = result.get(row.eventKey) ?? [];
    list.push(toCommentView(row, viewer));
    if (list.length > FEED_COMMENT_PREVIEW) list.shift();
    result.set(row.eventKey, list);
  }
  return result;
}

// Tab "Bình luận mới" của thầy.
export type RecentCommentView = {
  id: string;
  body: string;
  at: string;
  authorName: string;
  authorIsTeacher: boolean;
  eventKey: string;
  eventText: string | null; // null = hoạt động đã quá 14 ngày
  owner: { studentId: string; displayName: string };
};

export async function getRecentComments(limit: number): Promise<RecentCommentView[]> {
  const [rows, feed] = await Promise.all([
    prisma.feedComment.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        body: true,
        createdAt: true,
        eventKey: true,
        author: { select: authorSelect },
        owner: { select: { id: true, displayName: true } }
      }
    }),
    getSchoolFeed()
  ]);
  const texts = new Map(feed.map((event) => [event.key, `${event.emoji} ${event.text}`]));

  return rows.map((row) => {
    const author = authorView(row.author);
    return {
      id: row.id,
      body: row.body,
      at: row.createdAt.toISOString(),
      authorName: author.name,
      authorIsTeacher: author.isTeacher,
      eventKey: row.eventKey,
      eventText: texts.get(row.eventKey) ?? null,
      owner: { studentId: row.owner.id, displayName: row.owner.displayName }
    };
  });
}
