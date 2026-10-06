import { vietnamDateKey } from "@/lib/vocab-day";

// Mạng xã hội Đợt 2 — theo dõi bạn bè + thả cảm xúc (spec
// docs/superpowers/specs/2026-10-06-xa-hoi-dot-2-theo-doi-cam-xuc-design.md).
// Logic thuần — không Prisma, import được từ client component. Đọc DB ở
// lib/social-data.ts, ghi ở lib/actions/social.ts.

export type ReactionKind = "cheer" | "fire" | "target";

// Thứ tự cố định — nút trên hồ sơ và emoji trong chuông đều theo thứ tự này.
export const REACTIONS: readonly { kind: ReactionKind; emoji: string; label: string }[] = [
  { kind: "cheer", emoji: "👏", label: "Cổ vũ" },
  { kind: "fire", emoji: "🔥", label: "Truyền lửa" },
  { kind: "target", emoji: "🎯", label: "Tiếp mục tiêu" }
];

export function isReactionKind(value: unknown): value is ReactionKind {
  return REACTIONS.some((item) => item.kind === value);
}

export function emptyReactionTotals(): Record<ReactionKind, number> {
  return { cheer: 0, fire: 0, target: 0 };
}

// So khớp không dấu: gõ "tuan" ra "Tuấn", "duc" ra "Đức".
export function foldVietnamese(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Tìm bạn theo tên. Khớp ở đầu một từ xếp trước khớp giữa từ, cùng mức thì theo tên.
export function searchStudents<T extends { displayName: string }>(people: T[], query: string, limit = 8): T[] {
  const needle = foldVietnamese(query);
  if (!needle) return [];

  const scored: { person: T; score: number }[] = [];
  for (const person of people) {
    const name = foldVietnamese(person.displayName);
    const index = name.indexOf(needle);
    if (index < 0) continue;
    const atWordStart = index === 0 || name.charAt(index - 1) === " ";
    scored.push({ person, score: atWordStart ? 0 : 1 });
  }

  return scored
    .sort((a, b) => a.score - b.score || a.person.displayName.localeCompare(b.person.displayName, "vi"))
    .slice(0, limit)
    .map((item) => item.person);
}

// "Linh" · "Linh và Minh" · "Linh, Minh và 2 bạn khác"
export function namesSentence(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} và ${names[1]}`;
  return `${names[0]}, ${names[1]} và ${names.length - 2} bạn khác`;
}

// ---- Chuông: gộp theo ngày (giờ VN) ----

export type SocialFollowSource = { followerId: string; name: string; createdAt: Date };
export type SocialReactionSource = { fromId: string; name: string; kind: ReactionKind; createdAt: Date };
export type SocialNotificationGroup = {
  kind: "follow" | "reaction";
  dayKey: string;
  title: string;
  createdAt: Date;
};

type DayBucket = { names: string[]; seen: Set<string>; kinds: Set<ReactionKind>; latest: Date };

// Duyệt theo thời gian TĂNG để tên xếp theo lần gửi đầu tiên trong ngày.
function bucketByDay<T extends { createdAt: Date }>(
  rows: T[],
  personId: (row: T) => string,
  name: (row: T) => string,
  kind?: (row: T) => ReactionKind
): Map<string, DayBucket> {
  const buckets = new Map<string, DayBucket>();
  const sorted = rows.slice().sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  for (const row of sorted) {
    const dayKey = vietnamDateKey(row.createdAt);
    let bucket = buckets.get(dayKey);
    if (!bucket) {
      bucket = { names: [], seen: new Set(), kinds: new Set(), latest: row.createdAt };
      buckets.set(dayKey, bucket);
    }
    const id = personId(row);
    if (!bucket.seen.has(id)) {
      bucket.seen.add(id);
      bucket.names.push(name(row));
    }
    if (kind) bucket.kinds.add(kind(row));
    if (row.createdAt.getTime() > bucket.latest.getTime()) bucket.latest = row.createdAt;
  }

  return buckets;
}

export function groupSocialNotifications(
  follows: SocialFollowSource[],
  reactions: SocialReactionSource[]
): SocialNotificationGroup[] {
  const groups: SocialNotificationGroup[] = [];

  bucketByDay(
    follows,
    (row) => row.followerId,
    (row) => row.name
  ).forEach((bucket, dayKey) => {
    groups.push({
      kind: "follow",
      dayKey,
      title: `${namesSentence(bucket.names)} đã theo dõi bạn`,
      createdAt: bucket.latest
    });
  });

  bucketByDay(
    reactions,
    (row) => row.fromId,
    (row) => row.name,
    (row) => row.kind
  ).forEach((bucket, dayKey) => {
    const emoji = REACTIONS.filter((item) => bucket.kinds.has(item.kind))
      .map((item) => item.emoji)
      .join("");
    groups.push({
      kind: "reaction",
      dayKey,
      title: `${namesSentence(bucket.names)} đã gửi ${emoji} cho bạn`,
      createdAt: bucket.latest
    });
  });

  return groups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

// Phạm vi "Bạn bè" trên bảng xếp hạng: mình + những người mình theo dõi.
export function friendScope(meId: string, followingIds: Iterable<string>): Set<string> {
  const scope = new Set<string>(followingIds);
  scope.add(meId);
  return scope;
}
