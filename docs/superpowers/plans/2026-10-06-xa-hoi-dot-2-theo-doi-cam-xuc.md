# Mạng xã hội Đợt 2 — Theo dõi + cảm xúc: kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Học viên theo dõi nhau (một chiều), thả 👏/🔥/🎯 lên hồ sơ (mỗi loại 1 lần/ngày/người), tìm bạn trong trường, xem tab Bạn bè trên bảng Học Bá/Chuỗi, nhận báo gộp theo ngày ở chuông.

**Architecture:** Hai bảng mới `Follow` + `ProfileReaction` (ensure-db đưa lên prod). Logic thuần ở `lib/social.ts` (không Prisma), đọc DB ở `lib/social-data.ts`, ghi qua server action `lib/actions/social.ts`. Chuông tự suy ra từ 2 bảng (không bảng Notification). Tab Bạn bè lọc bảng có sẵn bằng `Set` id như phạm vi Lớp.

**Tech Stack:** Next.js 14 App Router, Prisma/Postgres (Neon), zod, vitest, Tailwind.

Spec: `docs/superpowers/specs/2026-10-06-xa-hoi-dot-2-theo-doi-cam-xuc-design.md`.

## Global Constraints

- Chữ giao diện + comment tiếng Việt có dấu; xưng "thầy".
- Mọi server action gọi `requireStudent()` ĐẦU TIÊN; `fromId`/`followerId` luôn lấy từ đó, không lấy từ input.
- Mọi chỗ ĐỌC 2 bảng mới trên trang có sẵn bọc try/catch → rỗng (ensure-db có thể chưa chạy).
- Cảm xúc KHÔNG cộng Xu/XP. Không có nút "Mời bạn bè".
- `kind` ∈ `cheer | fire | target`; `dayKey` = `vietnamDateKey(now)`.
- Hồ sơ người khác vẫn không chứa `targetBand`, `formatBand`, `coins`, `answers:` (test `profile-visibility`).
- Tài khoản `hiddenFromBoards` không hiện trong ô tìm / gợi ý.
- Hỗ trợ iOS Safari 15.6: không dùng API mới (`Array.prototype.at`, `structuredClone`…) trong code client.

---

### Task 1: Schema + ensure-db

**Files:**
- Modify: `prisma/schema.prisma` (model StudentProfile thêm 4 quan hệ; thêm 2 model; comment enum đầu file)
- Modify: `scripts/ensure-db.mjs` (thêm block sau AiReview)
- Test: `tests/social-schema.test.ts`

- [ ] **Step 1: Test cấu trúc (fail)**

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const schema = readFileSync(join(process.cwd(), "prisma", "schema.prisma"), "utf8");
const ensureDb = readFileSync(join(process.cwd(), "scripts", "ensure-db.mjs"), "utf8");

describe("Mạng xã hội Đợt 2 — schema", () => {
  it("có bảng Follow với khoá chính ghép", () => {
    expect(schema).toMatch(/model Follow \{[\s\S]*@@id\(\[followerId, followingId\]\)/);
  });
  it("ProfileReaction chặn trùng theo ngày", () => {
    expect(schema).toMatch(/model ProfileReaction \{[\s\S]*@@unique\(\[fromId, toId, kind, dayKey\]\)/);
  });
  it("comment enum liệt kê 3 loại cảm xúc", () => {
    expect(schema).toMatch(/ReactionKind[^\n]*cheer[^\n]*fire[^\n]*target/);
  });
  it("ensure-db tạo cả 2 bảng trên prod", () => {
    expect(ensureDb).toContain('CREATE TABLE IF NOT EXISTS "Follow"');
    expect(ensureDb).toContain('CREATE TABLE IF NOT EXISTS "ProfileReaction"');
    expect(ensureDb).toContain('"ProfileReaction_fromId_toId_kind_dayKey_key"');
  });
});
```

- [ ] **Step 2:** `npx vitest run tests/social-schema.test.ts` → FAIL.
- [ ] **Step 3: Schema**

Comment enum đầu file thêm dòng: `// ReactionKind (ProfileReaction.kind): cheer | fire | target`.
StudentProfile thêm:
```prisma
  following        Follow[]          @relation("FollowFollower")
  followers        Follow[]          @relation("FollowFollowing")
  reactionsSent    ProfileReaction[] @relation("ReactionFrom")
  reactionsGot     ProfileReaction[] @relation("ReactionTo")
```
Model mới đúng như spec §3.1/§3.2.

ensure-db (thêm vào mảng câu lệnh):
```js
  `CREATE TABLE IF NOT EXISTS "Follow" (
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Follow_pkey" PRIMARY KEY ("followerId", "followingId")
  );`,
  'CREATE INDEX IF NOT EXISTS "Follow_followingId_createdAt_idx" ON "Follow"("followingId", "createdAt");',
  // 2 khoá ngoại DO $$ … Follow_followerId_fkey / Follow_followingId_fkey → StudentProfile ON DELETE CASCADE
  `CREATE TABLE IF NOT EXISTS "ProfileReaction" (
    "id" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProfileReaction_pkey" PRIMARY KEY ("id")
  );`,
  'CREATE UNIQUE INDEX IF NOT EXISTS "ProfileReaction_fromId_toId_kind_dayKey_key" ON "ProfileReaction"("fromId", "toId", "kind", "dayKey");',
  'CREATE INDEX IF NOT EXISTS "ProfileReaction_toId_createdAt_idx" ON "ProfileReaction"("toId", "createdAt");',
  // 2 khoá ngoại ProfileReaction_fromId_fkey / ProfileReaction_toId_fkey
```
- [ ] **Step 4:** `npx prisma validate && npx prisma generate && npx prisma db push` (DB local "ielts-test") rồi chạy test → PASS.
- [ ] **Step 5:** Commit `feat(xa-hoi): bang Follow + ProfileReaction, ensure-db dua len prod`.

### Task 2: Logic thuần `lib/social.ts`

**Files:** Create `lib/social.ts`; Test `tests/social.test.ts`

**Interfaces — Produces:**
```ts
export type ReactionKind = "cheer" | "fire" | "target";
export const REACTIONS: readonly { kind: ReactionKind; emoji: string; label: string }[];
export function isReactionKind(value: unknown): value is ReactionKind;
export function foldVietnamese(text: string): string;
export function searchStudents<T extends { displayName: string }>(people: T[], query: string, limit?: number): T[];
export type SocialFollowSource = { name: string; createdAt: Date };
export type SocialReactionSource = { name: string; fromId: string; kind: ReactionKind; createdAt: Date };
export type SocialNotificationGroup = { kind: "follow" | "reaction"; dayKey: string; title: string; createdAt: Date };
export function groupSocialNotifications(follows: SocialFollowSource[], reactions: SocialReactionSource[]): SocialNotificationGroup[];
export function namesSentence(names: string[]): string; // "Linh", "Linh và Minh", "Linh, Minh và 2 bạn khác"
export function friendScope(meId: string, followingIds: Iterable<string>): Set<string>;
```

- [ ] **Step 1: Test (fail)** — các ca:
  - `foldVietnamese("  Nguyễn  Anh Tuấn ")` = `"nguyen anh tuan"`; `foldVietnamese("Đức")` = `"duc"`.
  - `searchStudents([{displayName:"Minh Tuấn"},{displayName:"Tuấn Anh"},{displayName:"Linh"}], "tuan")` → `["Tuấn Anh","Minh Tuấn"]` (cả hai khớp đầu từ → theo tên vi; "Minh Tuấn" < "Tuấn Anh" theo localeCompare → thực tế `["Minh Tuấn","Tuấn Anh"]`). Ca riêng: `"uan"` khớp giữa từ xếp sau ca đầu từ: people `[{displayName:"Quân"},{displayName:"Uanh"}]` query `"uan"` → `["Uanh","Quân"]`. Query rỗng/khoảng trắng → `[]`. `limit` cắt.
  - `namesSentence(["Linh"])`="Linh"; `["Linh","Minh"]`="Linh và Minh"; `["Linh","Minh","An","Bo"]`="Linh, Minh và 2 bạn khác"; `["Linh","Minh","An"]`="Linh, Minh và 1 bạn khác".
  - `groupSocialNotifications`: 2 reaction cùng ngày VN từ 2 người (fire rồi cheer) → 1 mục `title` "Linh và Minh đã gửi 👏🔥 cho bạn", `createdAt` = mới nhất; một người gửi 3 loại → tên 1 lần, "👏🔥🎯"; reaction 23:30 giờ VN ngày 5 và 00:30 ngày 6 → 2 mục; follow 1 người → "Linh đã theo dõi bạn"; kết quả sắp createdAt giảm dần.
  - `friendScope("me", ["a","b"])` có `me,a,b`.
- [ ] **Step 2:** chạy → FAIL.
- [ ] **Step 3: Cài đặt**

```ts
import { vietnamDateKey } from "@/lib/vocab-day";

// Mạng xã hội Đợt 2 (spec 2026-10-06-xa-hoi-dot-2). Logic thuần — không Prisma,
// import được từ client component.

export type ReactionKind = "cheer" | "fire" | "target";

export const REACTIONS: readonly { kind: ReactionKind; emoji: string; label: string }[] = [
  { kind: "cheer", emoji: "👏", label: "Cổ vũ" },
  { kind: "fire", emoji: "🔥", label: "Truyền lửa" },
  { kind: "target", emoji: "🎯", label: "Tiếp mục tiêu" }
];

export function isReactionKind(value: unknown): value is ReactionKind {
  return REACTIONS.some((item) => item.kind === value);
}

// So khớp không dấu: "tuan" khớp "Tuấn", "duc" khớp "Đức".
export function foldVietnamese(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function searchStudents<T extends { displayName: string }>(people: T[], query: string, limit = 8): T[] {
  const needle = foldVietnamese(query);
  if (!needle) return [];
  const scored: { person: T; score: number }[] = [];
  for (const person of people) {
    const name = foldVietnamese(person.displayName);
    const index = name.indexOf(needle);
    if (index < 0) continue;
    const atWordStart = index === 0 || name[index - 1] === " ";
    scored.push({ person, score: atWordStart ? 0 : 1 });
  }
  return scored
    .sort((a, b) => a.score - b.score || a.person.displayName.localeCompare(b.person.displayName, "vi"))
    .slice(0, limit)
    .map((item) => item.person);
}

export function namesSentence(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} và ${names[1]}`;
  return `${names[0]}, ${names[1]} và ${names.length - 2} bạn khác`;
}

// … groupSocialNotifications: gom theo vietnamDateKey(createdAt); tên theo thứ tự
// lần đầu (duyệt nguồn sắp createdAt TĂNG), unique theo fromId (reaction) / tên (follow);
// emoji theo thứ tự REACTIONS; createdAt = max.

export function friendScope(meId: string, followingIds: Iterable<string>): Set<string> {
  const scope = new Set<string>(followingIds);
  scope.add(meId);
  return scope;
}
```
(Follow source cũng mang `followerId` để unique — dùng `SocialFollowSource = { followerId: string; name: string; createdAt: Date }`.)
- [ ] **Step 4:** PASS. **Step 5:** Commit `feat(xa-hoi): logic thuan theo doi/cam xuc - tim khong dau, gop chuong theo ngay`.

### Task 3: Phạm vi `friends` cho trang Xếp hạng (logic)

**Files:** Modify `lib/leaderboard.ts` (RankingScope, resolveRankingParams); Test `tests/leaderboard.test.ts`

- [ ] **Step 1:** Thêm test: `resolveRankingParams({ scope: "friends" }, context).scope === "friends"`; `rankingHref({... scope:"friends"})` chứa `scope=friends`.
- [ ] **Step 2:** FAIL. **Step 3:** `export type RankingScope = "school" | "class" | "friends";` và
```ts
const SCOPES: readonly RankingScope[] = ["school", "class", "friends"];
scope: SCOPES.includes(raw?.scope as RankingScope) ? (raw?.scope as RankingScope) : "school",
```
- [ ] **Step 4:** PASS toàn bộ `tests/leaderboard*.test.ts`. **Step 5:** gộp commit với Task 7.

### Task 4: Đọc/ghi DB — `lib/social-data.ts` + `lib/actions/social.ts`

**Files:** Create cả hai; Test `tests/social-action-guard.test.ts`

**Produces:**
```ts
// lib/social-data.ts
export async function getFollowCounts(studentId: string): Promise<{ following: number; followers: number }>;
export async function getFollowLists(studentId: string): Promise<{ following: BoardPerson[]; followers: BoardPerson[] }>;
export async function getReactionTotals(studentId: string): Promise<Record<ReactionKind, number>>;
export async function getMyReactionsToday(fromId: string, toId: string, now?: Date): Promise<ReactionKind[]>;
export async function isFollowing(meId: string, targetId: string): Promise<boolean>;
export async function getFollowingIds(meId: string): Promise<string[]>;
export async function getSchoolDirectory(excludeId: string): Promise<BoardPerson[]>;
export async function getClassmateSuggestions(meId: string, followingIds: string[]): Promise<BoardPerson[]>;
// lib/actions/social.ts ("use server")
export async function toggleFollow(targetId: string): Promise<ActionResult & { following?: boolean }>;
export async function sendReaction(targetId: string, kind: string): Promise<ActionResult>;
```
Mọi hàm đọc bọc try/catch, lỗi → giá trị rỗng + `console.error("[xa-hoi] …")`.

- [ ] **Step 1: Guard test (fail)**
```ts
const source = readFileSync(join(process.cwd(), "lib", "actions", "social.ts"), "utf8");
it("mọi action gọi requireStudent đầu tiên", () => {
  const bodies = source.split(/export async function /).slice(1);
  expect(bodies.length).toBe(2);
  for (const body of bodies) {
    const firstAwait = body.match(/await\s+([A-Za-z]+)/);
    expect(firstAwait?.[1]).toBe("requireStudent");
  }
});
it("không tự gửi cho chính mình", () => { expect(source).toMatch(/targetId === student\.id/); });
it("chặn trùng bằng P2002, không cộng Xu", () => {
  expect(source).toContain("P2002");
  expect(source).not.toMatch(/coinTransaction|grantCoins|syncWallet/);
});
it("kind đi qua zod enum", () => { expect(source).toMatch(/z\.enum\(\["cheer", "fire", "target"\]\)/); });
```
- [ ] **Step 2:** FAIL. **Step 3:** cài đặt. `toggleFollow`: parse id; tự mình → `{ok:false, message:"Không thể tự theo dõi chính mình."}`; kiểm target tồn tại; `deleteMany({where:{followerId, followingId}})` nếu đang theo dõi, ngược lại `create` (P2002 → coi như thành công); `revalidatePath("/student/profile/"+id)`, `revalidatePath("/student/profile")`, `revalidatePath("/student/ranking")`. `sendReaction`: zod enum, `create({ data: { fromId, toId, kind, dayKey: vietnamDateKey(new Date()) } })`, P2002 → ok.
- [ ] **Step 4:** PASS + `npx tsc --noEmit`. **Step 5:** Commit `feat(xa-hoi): doc/ghi theo doi + cam xuc, action toggleFollow/sendReaction`.

### Task 5: Component giao diện

**Files (create):** `components/social/follow-stats.tsx`, `follow-button.tsx` (client), `reaction-bar.tsx` (client), `follow-lists.tsx` (client, tab), `friends-card.tsx` (client).

- `FollowStats({ following, followers })`: "**N** đang theo dõi · **N** người theo dõi".
- `FollowButton({ targetId, initialFollowing, size?: "md" | "sm" })`: `useTransition`, optimistic, lỗi → khôi phục + toast `useToast().notify` (xem API toast). Đang theo dõi: chữ "Đang theo dõi ✓", hover/focus → "Bỏ theo dõi".
- `ReactionBar({ targetId | null, totals, sentToday })`: `targetId` null = hồ sơ của mình (chỉ hiện số, không nút). Nút `aria-pressed`, disabled khi đã gửi; bấm → tăng 1 + `animate-bounce` một lần (class tạm 600ms).
- `FollowLists({ following, followers, meId })`: 2 tab, `max-h-80 overflow-y-auto`, dòng = `StudentAvatar size="sm"` + tên link (`meId` → `/student/profile`).
- `FriendsCard({ meId, directory, suggestions, followingIds, following, followers })`: ô tìm (`searchStudents`), gợi ý bạn cùng lớp khi ô trống, `FollowLists` bên dưới; `id="ban-be"`.
- Test: `tests/social-ui-guard.test.ts` — không dùng `dangerouslySetInnerHTML` trong `components/social/*`; `friends-card.tsx` dùng `searchStudents(`; avatar qua `<StudentAvatar`.
- [ ] Commit `feat(xa-hoi): component theo doi, cam xuc, danh sach, the Ban be`.

### Task 6: Gắn vào hai trang hồ sơ

**Files:** Modify `app/student/profile/[studentId]/page.tsx`, `app/student/profile/page.tsx`; Test mở rộng `tests/profile-visibility.test.ts`.

- Hồ sơ người khác: `Promise.all` thêm `getFollowCounts`, `isFollowing(me.id, profile.id)`, `getReactionTotals`, `getMyReactionsToday`, `getFollowLists`. Dưới dòng Lớp: `FollowStats` + `FollowButton` + `ReactionBar`. Aside: thêm thẻ `FollowLists` (tiêu đề "Bạn bè của {tên}").
- Hồ sơ mình: thêm `getFollowCounts`, `getReactionTotals`, `getFollowLists`, `getFollowingIds`, `getSchoolDirectory(student.id)`, `getClassmateSuggestions`. Dưới dòng tham gia: `FollowStats` + `ReactionBar targetId={null}`. Aside: `FriendsCard` sau `StatGrid`.
- Test thêm: trang người khác có `getFollowCounts(` và `<FollowButton`; vẫn không `targetBand`.
- [ ] Commit `feat(xa-hoi): ho so hien theo doi + cam xuc, the Ban be o ho so cua minh`.

### Task 7: Tab Bạn bè ở trang Xếp hạng

**Files:** Modify `app/student/ranking/page.tsx`, `components/leaderboard/ranking-switcher.tsx`.

- Switcher: thêm link "Bạn bè" đứng ĐẦU thanh phạm vi.
- Page: `params.scope === "friends"` → `members = friendScope(student.id, await getFollowingIds(student.id))`, `where = "Bạn bè"`. Nếu `members.size === 1` → ô trống "Bạn chưa theo dõi ai" + link `/student/profile#ban-be`.
- Test: `tests/ranking-link-guard.test.ts` hoặc mới — page chứa `friendScope(`.
- [ ] Commit `feat(xa-hoi): tab Ban be tren bang Hoc Ba va Chuoi`.

### Task 8: Chuông

**Files:** Modify `lib/notifications.ts` (type + tham số thứ 8), `lib/notifications-feed.ts`, `components/notification-list.tsx` (LABELS); Test `tests/notifications.test.ts`.

- `StudentNotificationType` thêm `"follow_new" | "reaction_new"`. Tham số thứ 8 `social: SocialNotificationGroup[] = []` → `{ id: \`${kind}:${dayKey}\`, type: kind === "follow" ? "follow_new" : "reaction_new", title, detail: null, href: "/student/profile", createdAt, unread: isUnread(...) }`.
- Feed: try/catch đọc `follow.findMany({ where: { followingId: studentId, createdAt: { gte: 30 ngày } }, take: 200, orderBy createdAt desc, select: { followerId, createdAt, follower: { select: { displayName } } } })` + tương tự `profileReaction` → `groupSocialNotifications`.
- LABELS: `follow_new: "Theo dõi"`, `reaction_new: "Cảm xúc"`.
- Test: build với 1 nhóm reaction → id `reaction:2026-10-06`, type `reaction_new`, unread theo readAt.
- [ ] Commit `feat(xa-hoi): chuong bao theo doi + cam xuc gop theo ngay`.

### Task 9: Kiểm tra + phát hành

- [ ] `pnpm test`, `pnpm lint`, `pnpm build` sạch.
- [ ] Local: 2 học viên (JWT tự ký như [[total-time-limit-shipped]]) — theo dõi, bỏ theo dõi, thả cảm xúc (bấm lại bị khoá), tab Bạn bè, chuông bên nhận, ô tìm "tuan".
- [ ] Push → Vercel; kiểm prod bằng Chrome cả 2 vai; kiểm cột/bảng đã có trên prod.
- [ ] Cập nhật memory `social-features-plan.md`.
