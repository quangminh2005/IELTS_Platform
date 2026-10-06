# Mạng xã hội Đợt 3 — Bảng tin: kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bảng tin hoạt động (Bạn bè / Toàn trường) tự sinh từ dữ liệu học tập, có tim + bình luận cho học viên và thầy, thầy gỡ bình luận, chuông báo tim/bình luận.

**Architecture:** Hoạt động dựng LÚC ĐỌC bằng hàm thuần (`lib/feed.ts`) từ AttemptSkill/VocabQuizDay/CoinTransaction/StudentItem + dữ liệu chuỗi trường; cache 5 phút tag `leaderboard` (`lib/feed-data.ts`). Mỗi hoạt động có `eventKey` `<loại>:<studentId>:…`; tim/bình luận lưu ở 2 bảng mới khoá theo eventKey, tác giả là `User`. Action `lib/actions/feed.ts` đối chiếu eventKey với feed thật.

**Tech Stack:** Next.js 14 App Router, Prisma/Postgres, zod, vitest, Tailwind.

Spec: `docs/superpowers/specs/2026-10-06-xa-hoi-dot-3-bang-tin-design.md`.

## Global Constraints

- Chữ giao diện + comment tiếng Việt có dấu; xưng "thầy".
- Câu mô tả hoạt động KHÔNG chứa điểm, band, số Xu. `lib/feed.ts` + `lib/feed-data.ts` không chứa `score`, `scorePercent`, `overallBand`, `Band`.
- Cửa sổ 14 ngày; bỏ `hiddenFromBoards`; ôn Sổ từ ngưỡng 10 thẻ; StudentItem chỉ `achievement|streak`.
- Bình luận 1–200 ký tự, văn bản thuần, học viên ≤ 30/ngày VN, lọc thô tục không dấu.
- Mọi action gọi `requireFeedUser()` đầu tiên; trang thầy dùng `requireTeacherPage()`.
- Mọi chỗ đọc `FeedHeart`/`FeedComment` trên trang có sẵn (chuông) bọc try/catch.
- Không thưởng Xu/XP. iOS Safari 15.6: không API mới ở client.

---

### Task 1: Schema + ensure-db
**Files:** `prisma/schema.prisma` (2 model + quan hệ ở User/StudentProfile), `scripts/ensure-db.mjs`, test `tests/feed-schema.test.ts`.
- [ ] Test (fail): schema có `model FeedHeart` với `@@id([eventKey, userId])`, `model FeedComment` với `ownerStudentId`, `authorUserId`; ensure-db có `CREATE TABLE IF NOT EXISTS "FeedHeart"`, `"FeedComment"`, FK `FeedComment_ownerStudentId_fkey`, `FeedComment_authorUserId_fkey`, `FeedHeart_userId_fkey`.
- [ ] Thêm model đúng spec §4; User thêm `feedHearts FeedHeart[]`, `feedComments FeedComment[]`; StudentProfile thêm `feedCommentsGot FeedComment[] @relation("FeedCommentOwner")` (FeedComment.owner dùng tên quan hệ này, author dùng `"FeedCommentAuthor"`).
- [ ] ensure-db: CREATE TABLE + index (`FeedHeart_eventKey_idx`, `FeedComment_eventKey_createdAt_idx`, `FeedComment_ownerStudentId_createdAt_idx`, `FeedComment_createdAt_idx`) + 3 FK DO $$.
- [ ] `node scripts/ensure-db.mjs` (local) rồi `npx prisma db push --skip-generate` phải báo "already in sync"; `npx prisma generate`; test PASS; commit.

### Task 2: Logic thuần `lib/feed.ts` + `lib/feed-moderation.ts`
**Produces:**
```ts
export const FEED_WINDOW_DAYS = 14;
export const VOCAB_FEED_MIN = 10;
export type FeedKind = "work" | "streak" | "rank" | "vocab" | "item" | "prize";
export type FeedEvent = { key: string; kind: FeedKind; studentId: string; emoji: string; text: string; at: Date };
export function parseEventKey(key: string): { kind: FeedKind; studentId: string } | null;
export function workEvents(rows: { studentId: string; attemptId: string; title: string; practice: boolean; skill: string | null; submittedAt: Date }[]): FeedEvent[];
export function streakMilestoneEvents(input: { activity: Map<string, { activeDays: string[]; restoredDays: string[]; firstAt: Map<string, Date> }>; fromDay: string; toDay: string }): FeedEvent[];
export function rankUpEvents(rows: { studentId: string; amount: number; createdAt: Date }[], since: Date): FeedEvent[];
export function vocabEvents(rows: { studentId: string; date: string; total: number; updatedAt: Date }[]): FeedEvent[];
export function itemEvents(rows: { id: string; studentId: string; itemKey: string; source: string; createdAt: Date }[]): FeedEvent[];
export function prizeEvents(rows: { studentId: string; key: string; note: string | null; createdAt: Date }[]): FeedEvent[];
export function mergeFeed(events: FeedEvent[], opts: { since: Date; hiddenIds: ReadonlySet<string> }): FeedEvent[];
// lib/feed-moderation.ts
export function containsProfanity(text: string): boolean;
```
Quy tắc (spec §3): work gộp theo `attemptId` + ngày VN, kỹ năng theo thứ tự L/R/W/S (`SKILL_LABELS`), skill null (lượt cũ) → "hoàn thành <tên bài>"; streak: với mỗi ngày D trong [fromDay,toDay] mà D ∈ activeDays, run = độ dài chuỗi kết thúc ở D (đếm cả restored), nếu run == minDays của một STREAK_TIERS → sự kiện `streak:<sid>:<D>`; rank: sắp rows theo createdAt, cộng dồn, khi tổng vượt `ALL_LEVELS[i].min` (i ≥ 1) ở dòng có createdAt ≥ since → một sự kiện với cấp CAO NHẤT vượt ở dòng đó; vocab: total ≥ 10; item: source ∈ achievement/streak, tên qua `resolveItem` (khung/nền) hoặc `resolvePose` ("tư thế <pose> của <con>"); prize: key `prize:xp:YYYY-MM` → `prize:<sid>:YYYY-MM`, text từ note. `runEndingAt` trong `lib/day-streak.ts` được export để dùng lại.
- [ ] Test `tests/feed.test.ts` + `tests/feed-moderation.test.ts` theo spec §8 (fail) → cài đặt → PASS → commit.

### Task 3: Đọc DB `lib/feed-data.ts`
**Produces:**
```ts
export async function getSchoolFeed(now?: Date): Promise<FeedEvent[]>; // unstable_cache theo ngày VN, revalidate 300, tag LEADERBOARD_CACHE_TAG; at đi qua JSON → chuyển lại Date
export type FeedItemView = { key: string; kind: FeedKind; emoji: string; text: string; at: string; owner: BoardPerson; hearts: number; hearted: boolean; comments: number };
export async function getFeedPage(opts: { viewerUserId: string; studentIds: ReadonlySet<string> | null; limit: number; focusKey?: string | null }): Promise<{ items: FeedItemView[]; hasMore: boolean; focusMissing: boolean }>;
export type FeedCommentView = { id: string; body: string; at: string; authorName: string; authorIsTeacher: boolean; authorAvatar: BoardPerson | null; canDelete: boolean };
export async function getComments(eventKey: string, viewer: { userId: string; role: string; studentId: string | null }): Promise<FeedCommentView[]>;
export async function getRecentComments(limit: number): Promise<{ id: string; body: string; at: string; authorName: string; authorIsTeacher: boolean; eventKey: string; eventText: string | null; owner: BoardPerson | null }[]>;
```
- [ ] Test cấu trúc (thêm vào `tests/feed-guard.test.ts`): `lib/feed.ts`/`lib/feed-data.ts` không chứa từ điểm/band; `getSchoolFeed` dùng tag `LEADERBOARD_CACHE_TAG`.
- [ ] Cài đặt; `npx tsc --noEmit`; commit.

### Task 4: Action `lib/actions/feed.ts`
`requireFeedUser()` (không export vì file "use server" — đặt ở `lib/feed-user.ts`), `toggleHeart`, `addComment`, `deleteComment`, `listComments` (đọc, cho client mở bình luận).
- [ ] Guard test: mọi export async function gọi `requireFeedUser` đầu tiên; có `containsProfanity(`; có `P2002`; có giới hạn 30; không đụng `coinTransaction`.
- [ ] Cài đặt; commit.

### Task 5: Component `components/feed/*`
`feed-card.tsx` (client: tim lạc quan, mở bình luận, ô viết đếm ký tự, xoá), `feed-list.tsx` (danh sách + "Xem thêm"), `teacher-comment-list.tsx` (Gỡ). Avatar qua `StudentAvatar`; không `dangerouslySetInnerHTML`.
- [ ] Guard test UI; commit.

### Task 6: Trang `/student/feed` + `/teacher/feed` + menu
- [ ] `app/student/feed/page.tsx`, `app/teacher/feed/page.tsx` (`requireTeacherPage`), thêm 2 mục menu ở `components/app-shell.tsx` (icon có sẵn: học viên `users`? dùng icon mới "feed" nếu cần thêm vào IconName).
- [ ] `tests/teacher-page-guard.test.ts` tự phủ trang thầy; commit.

### Task 7: Chuông
- [ ] `StudentNotificationType` thêm `feed_heart`, `feed_comment`; tham số thứ 9 `feed: { hearts: FeedHeartSource[]; comments: FeedCommentSource[] }`; gộp tim theo ngày (dùng `namesSentence`), mỗi bình luận 1 dòng, trích 80 ký tự; feed đọc 30 ngày try/catch; LABELS. Test trước; commit.

### Task 8: Kiểm tra + phát hành
- [ ] `pnpm test`, `pnpm lint`, `pnpm build`.
- [ ] E2E local (`tmp/_e2e-feed.mjs`): A nộp/ôn sẵn có hoạt động; B tim + bình luận; A thấy chuông; thầy gỡ; lọc thô tục chặn.
- [ ] Push; kiểm prod (bảng đã tạo, Chrome vai Minh xem bảng tin); cập nhật memory.
