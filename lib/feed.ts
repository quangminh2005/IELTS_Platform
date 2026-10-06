import { activeDayKeys, buildActivityDays } from "@/lib/activity-heatmap";
import { restoredDayOf, runEndingAt } from "@/lib/day-streak";
import { STREAK_TIERS, type SchoolStreakInput } from "@/lib/leaderboard";
import { resolvePose } from "@/lib/mascots";
import { resolveItem } from "@/lib/shop-catalog";
import { skillRank } from "@/lib/skills";
import { vietnamDateKey } from "@/lib/vocab-day";
import { shiftDateKey } from "@/lib/vocab-streak";
import { ALL_LEVELS, levelName } from "@/lib/xp-rank";

// Bảng tin hoạt động (Mạng xã hội Đợt 3, spec
// docs/superpowers/specs/2026-10-06-xa-hoi-dot-3-bang-tin-design.md).
//
// Hoạt động KHÔNG có bảng riêng: dựng lúc đọc từ dữ liệu học tập có sẵn, như chuông.
// Mỗi hoạt động có `key` cố định "<loại>:<studentId>:…" — tim và bình luận gắn vào key.
// Logic thuần (không Prisma). Đọc DB ở lib/feed-data.ts.
//
// RIÊNG TƯ: câu mô tả chỉ dựng từ tên bài, tên kỹ năng, số thẻ, tên hạng, tên đồ —
// tuyệt đối không đưa điểm hay số Xu vào (tests/feed-guard.test.ts ép).

export const FEED_WINDOW_DAYS = 14;
// Ôn Sổ từ chỉ lên bảng tin khi ôn từ chừng này thẻ trong ngày.
export const VOCAB_FEED_MIN = 10;

export type FeedKind = "work" | "streak" | "rank" | "vocab" | "item" | "prize";

const FEED_KINDS: readonly FeedKind[] = ["work", "streak", "rank", "vocab", "item", "prize"];

export type FeedEvent = {
  key: string;
  kind: FeedKind;
  studentId: string;
  emoji: string;
  text: string;
  at: Date;
};

export function parseEventKey(key: string): { kind: FeedKind; studentId: string } | null {
  const [kind, studentId] = key.split(":");
  if (!studentId || !FEED_KINDS.includes(kind as FeedKind)) return null;
  return { kind: kind as FeedKind, studentId };
}

function newestFirst(events: FeedEvent[]): FeedEvent[] {
  return events.sort((a, b) => b.at.getTime() - a.at.getTime() || a.key.localeCompare(b.key));
}

// ---- Hoàn thành bài ----

// Tên kỹ năng để tiếng Anh như đề thi (học viên quen gọi "Listening", "Reading").
const SKILL_NAMES: Record<string, string> = {
  listening: "Listening",
  reading: "Reading",
  writing: "Writing",
  speaking: "Speaking"
};

export type WorkSource = {
  studentId: string;
  attemptId: string;
  title: string;
  practice: boolean;
  // null = lượt cũ chưa tách kỹ năng (chỉ có Attempt.submittedAt)
  skill: string | null;
  submittedAt: Date;
};

// Gộp các kỹ năng nộp trong CÙNG lượt, CÙNG ngày VN thành một hoạt động.
export function workEvents(rows: WorkSource[]): FeedEvent[] {
  const groups = new Map<string, { row: WorkSource; skills: Set<string>; latest: Date; day: string }>();

  for (const row of rows) {
    const day = vietnamDateKey(row.submittedAt);
    const key = `work:${row.studentId}:${row.attemptId}:${day}`;
    let group = groups.get(key);
    if (!group) {
      group = { row, skills: new Set(), latest: row.submittedAt, day };
      groups.set(key, group);
    }
    if (row.skill) group.skills.add(row.skill);
    if (row.submittedAt.getTime() > group.latest.getTime()) group.latest = row.submittedAt;
  }

  const events: FeedEvent[] = [];
  groups.forEach((group, key) => {
    const skills = Array.from(group.skills)
      .sort((a, b) => skillRank(a) - skillRank(b))
      .map((skill) => SKILL_NAMES[skill] ?? skill);
    const what = skills.length > 0 ? `${skills.join(" + ")} · ${group.row.title}` : group.row.title;
    events.push({
      key,
      kind: "work",
      studentId: group.row.studentId,
      emoji: "📝",
      text: `hoàn thành ${what}${group.row.practice ? " (tự luyện)" : ""}`,
      at: group.latest
    });
  });

  return newestFirst(events);
}

// ---- Mốc chuỗi 🔥 ----

const NOON_VN_UTC_HOUR = 5; // 12h trưa giờ VN

function dayFallbackTime(day: string): Date {
  return new Date(`${day}T${String(NOON_VN_UTC_HOUR).padStart(2, "0")}:00:00Z`);
}

// Ngày D có học mà chuỗi kết thúc ở D dài đúng minDays của một cấp lửa → một mốc.
// Ngày cứu bằng Xu tính vào độ dài chuỗi nhưng KHÔNG tự sinh mốc (không có học thật).
export function streakMilestoneEvents(
  input: SchoolStreakInput,
  opts: { fromDay: string; toDay: string; vocabTimes?: ReadonlyMap<string, Date> }
): FeedEvent[] {
  const submits = new Map<string, Date[]>();
  const vocab = new Map<string, { date: string; total: number }[]>();
  const restored = new Map<string, string[]>();

  const push = <V>(map: Map<string, V[]>, id: string, value: V) => {
    const list = map.get(id);
    if (list) list.push(value);
    else map.set(id, [value]);
  };
  for (const row of input.submits) push(submits, row.studentId, row.submittedAt);
  for (const row of input.vocabDays) push(vocab, row.studentId, { date: row.date, total: row.total });
  for (const row of input.restoreKeys) {
    const day = restoredDayOf(row.key);
    if (day) push(restored, row.studentId, day);
  }

  const ids = new Set([...Array.from(submits.keys()), ...Array.from(vocab.keys())]);
  const events: FeedEvent[] = [];

  ids.forEach((studentId) => {
    const studentSubmits = submits.get(studentId) ?? [];
    const activeDays = activeDayKeys(buildActivityDays({ submits: studentSubmits, vocabDays: vocab.get(studentId) ?? [] }));
    const done = new Set([...activeDays, ...(restored.get(studentId) ?? [])]);

    for (const day of activeDays) {
      if (day < opts.fromDay || day > opts.toDay) continue;
      const run = runEndingAt(done, day);
      const tier = STREAK_TIERS.find((candidate) => candidate.minDays === run);
      if (!tier) continue;

      // Thời điểm: lần nộp đầu tiên trong ngày; ngày chỉ ôn thẻ → giờ ôn; không có → trưa.
      let first: Date | null = null;
      for (const submittedAt of studentSubmits) {
        if (vietnamDateKey(submittedAt) === day && (!first || submittedAt.getTime() < first.getTime())) {
          first = submittedAt;
        }
      }
      events.push({
        key: `streak:${studentId}:${day}`,
        kind: "streak",
        studentId,
        emoji: "🔥",
        text: `đạt chuỗi ${run} ngày — cấp ${tier.name} 🔥`,
        at: first ?? opts.vocabTimes?.get(`${studentId}|${day}`) ?? dayFallbackTime(day)
      });
    }
  });

  return newestFirst(events);
}

// Khoảng ngày [fromDay, toDay] của cửa sổ bảng tin tính tới hôm nay (giờ VN).
export function feedDayRange(now: Date): { fromDay: string; toDay: string; since: Date } {
  const toDay = vietnamDateKey(now);
  return {
    fromDay: shiftDateKey(toDay, -FEED_WINDOW_DAYS),
    toDay,
    since: new Date(now.getTime() - FEED_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  };
}

// ---- Lên hạng XP ----

export type XpLedgerSource = { studentId: string; amount: number; createdAt: Date };

function levelIndexOf(xp: number): number {
  let index = 0;
  for (let i = 0; i < ALL_LEVELS.length; i += 1) {
    if (xp >= ALL_LEVELS[i].min) index = i;
  }
  return index;
}

// Cộng dồn sổ XP theo thời gian; dòng làm tổng vượt mốc cấp → một sự kiện với cấp
// CAO NHẤT vượt ở dòng đó. Dòng trước `since` vẫn cộng nhưng không sinh sự kiện.
export function rankUpEvents(rows: XpLedgerSource[], since: Date): FeedEvent[] {
  const byStudent = new Map<string, XpLedgerSource[]>();
  for (const row of rows) {
    const list = byStudent.get(row.studentId);
    if (list) list.push(row);
    else byStudent.set(row.studentId, [row]);
  }

  const events: FeedEvent[] = [];
  byStudent.forEach((list, studentId) => {
    list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    let total = 0;
    let level = 0;
    for (const row of list) {
      total = Math.max(0, total + row.amount);
      const next = levelIndexOf(total);
      if (next > level && row.createdAt.getTime() >= since.getTime()) {
        events.push({
          key: `rank:${studentId}:${next}`,
          kind: "rank",
          studentId,
          emoji: ALL_LEVELS[next].rank.icon,
          text: `lên hạng ${levelName(ALL_LEVELS[next])}`,
          at: row.createdAt
        });
      }
      level = Math.max(level, next);
    }
  });

  return newestFirst(events);
}

// ---- Ôn Sổ từ ----

export function vocabEvents(rows: { studentId: string; date: string; total: number; updatedAt: Date }[]): FeedEvent[] {
  return newestFirst(
    rows
      .filter((row) => row.total >= VOCAB_FEED_MIN)
      .map((row) => ({
        key: `vocab:${row.studentId}:${row.date}`,
        kind: "vocab" as const,
        studentId: row.studentId,
        emoji: "📚",
        text: `ôn ${row.total} thẻ Sổ từ`,
        at: row.updatedAt
      }))
  );
}

// ---- Thành tích (đồ nhận bằng thành tích / mở bằng chuỗi) ----

const ITEM_FEED_SOURCES = new Set(["achievement", "streak"]);

function itemText(itemKey: string): string | null {
  const pose = resolvePose(itemKey);
  if (pose) return `mở tư thế ${pose.name} của ${pose.mascot.name}`;
  const item = resolveItem(itemKey);
  return item ? `nhận ${item.name}` : null;
}

export function itemEvents(
  rows: { id: string; studentId: string; itemKey: string; source: string; createdAt: Date }[]
): FeedEvent[] {
  return newestFirst(
    rows.flatMap((row) => {
      if (!ITEM_FEED_SOURCES.has(row.source)) return [];
      const text = itemText(row.itemKey);
      return text
        ? [{ key: `item:${row.studentId}:${row.id}`, kind: "item" as const, studentId: row.studentId, emoji: "🎁", text, at: row.createdAt }]
        : [];
    })
  );
}

// ---- Thưởng Học Bá tháng ----

export function prizeEvents(
  rows: { studentId: string; key: string; note: string | null; createdAt: Date }[]
): FeedEvent[] {
  return newestFirst(
    rows.map((row) => {
      const monthKey = row.key.slice(row.key.lastIndexOf(":") + 1);
      return {
        key: `prize:${row.studentId}:${monthKey}`,
        kind: "prize" as const,
        studentId: row.studentId,
        emoji: "🏆",
        text: `${row.note ?? "Đạt giải Học Bá tháng"} 🏆`,
        at: row.createdAt
      };
    })
  );
}

// ---- Gộp ----

export function mergeFeed(events: FeedEvent[], opts: { since: Date; hiddenIds: ReadonlySet<string> }): FeedEvent[] {
  const seen = new Set<string>();
  return newestFirst(
    events.filter((event) => {
      if (event.at.getTime() < opts.since.getTime() || opts.hiddenIds.has(event.studentId) || seen.has(event.key)) {
        return false;
      }
      seen.add(event.key);
      return true;
    })
  );
}
