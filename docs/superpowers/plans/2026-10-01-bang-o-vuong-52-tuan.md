# Bảng ô vuông 52 tuần — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bảng ô vuông 53 tuần (mỗi ô = 1 ngày, đậm theo lượng học) ở trang Tiến bộ HS và trang học viên phía GV.

**Architecture:** Logic thuần ở `lib/activity-heatmap.ts` (gom việc theo ngày VN, dựng lưới, tính chuỗi, chọn câu nhận xét). `lib/activity-heatmap-data.ts` đọc 3 bảng có sẵn rồi gọi logic thuần. `components/activity-heatmap.tsx` (client) vẽ lưới, tự cuộn sang phải, hiện chi tiết ô đang chọn.

**Tech Stack:** Next.js 14 App Router, Prisma, Tailwind, vitest.

## Global Constraints

- Không đổi schema Prisma.
- Chuỗi giao diện + comment tiếng Việt; giọng nhận xét vui nhẹ, không chê, xưng "bạn".
- Ngày tính theo giờ VN (`vietnamDateKey`), tuần bắt đầu Thứ 2.
- Mức màu: 0 → trống, 1 → 1, 2 → 2, 3–4 → 3, ≥5 → 4. Ôn Sổ từ `total ≥ 1` = 1 việc, `total ≥ 20` = 2 việc.
- Không dùng API ngoài browserslist (iOS 15.6): không `Array.prototype.at`, không `structuredClone`, không `findLast`.

---

### Task 1: Logic thuần + unit test

**Files:**
- Create: `lib/activity-heatmap.ts`
- Test: `tests/activity-heatmap.test.ts`

**Interfaces:**
- Consumes: `shiftDateKey`, `calculateVocabStreak` từ `lib/vocab-streak.ts`; `vietnamDateKey` từ `lib/vocab-day.ts`.
- Produces:
  - `type ActivityDay = { submits: number; vocabCards: number; count: number }`
  - `type HeatmapCell = ActivityDay & { date: string; level: 0|1|2|3|4 }`
  - `type HeatmapWeek = { monthLabel: string | null; cells: (HeatmapCell | null)[] }`
  - `type ActivitySummary = { activeDays; currentStreak; activeToday; longestStreak; daysSinceLast: number | null; recentActiveDays; recentMaxCount }`
  - `buildActivityDays({ submits: Date[]; vocabDays: { date: string; total: number }[] }): Map<string, ActivityDay>`
  - `activityLevel(count: number): 0|1|2|3|4`
  - `heatmapStartKey(today: string): string`
  - `buildHeatmapGrid({ days, today }): HeatmapWeek[]`
  - `summarizeActivity({ days, today }): ActivitySummary`
  - `pickActivityMessage(summary): string`
  - `describeActivityDay(cell: HeatmapCell): string`

- [ ] **Step 1:** Viết `tests/activity-heatmap.test.ts` với các ca: ranh giới 17:00 UTC sang ngày VN mới; vocab 1 vs 20 thẻ; `activityLevel` 0..5; lưới 53 cột, cột đầu bắt đầu Thứ 2, ô sau hôm nay = null, nhãn tháng ở cột chứa ngày 1; chuỗi hiện tại (grace hôm nay) và dài nhất; mỗi nhánh của `pickActivityMessage`; `describeActivityDay`.
- [ ] **Step 2:** `npx vitest run tests/activity-heatmap.test.ts` → FAIL (module chưa có).
- [ ] **Step 3:** Viết `lib/activity-heatmap.ts` (xem mã ở commit của task).
- [ ] **Step 4:** Chạy lại → PASS.
- [ ] **Step 5:** Commit `feat(tien-bo): logic bang o vuong 52 tuan`.

### Task 2: Đọc DB + component + gắn vào 2 trang

**Files:**
- Create: `lib/activity-heatmap-data.ts`, `components/activity-heatmap.tsx`
- Modify: `app/student/stats/page.tsx`, `app/teacher/students/[studentId]/page.tsx`

**Interfaces:**
- Consumes: mọi hàm Task 1; `prisma`; `dateKeyToUtcDate` (`lib/vocab-daily.ts`).
- Produces: `getActivityHeatmap(studentId: string, now?: Date): Promise<{ weeks: HeatmapWeek[]; summary: ActivitySummary; message: string }>`; `<ActivityHeatmap weeks summary message? />`.

Truy vấn (lọc từ `since` = nửa đêm VN của ngày đầu cửa sổ, trừ thêm 1 ngày cho chắc):
1. `attemptSkill.findMany({ where: { submittedAt: { gte: since }, attempt: { studentId } }, select: { submittedAt: true } })`
2. `attempt.findMany({ where: { studentId, submittedAt: { gte: since }, skills: { none: { submittedAt: { not: null } } } }, select: { submittedAt: true } })` — dữ liệu cũ không có giờ nộp từng kỹ năng.
3. `vocabQuizDay.findMany({ where: { studentId, date: { gte: dateKeyToUtcDate(startKey) } }, select: { date: true, total: true } })` — khoá ngày = `date.toISOString().slice(0, 10)`.

- [ ] **Step 1:** Viết data + component.
- [ ] **Step 2:** Trang HS: gọi `getActivityHeatmap` song song với truy vấn attempts; khối bảng nằm ngay dưới header, luôn hiện; trạng thái rỗng cũ chỉ thay 2 khối biểu đồ điểm.
- [ ] **Step 3:** Trang GV: khối bảng (không `message`) ngay trước "Tiến bộ & điểm yếu".
- [ ] **Step 4:** `pnpm test`, `npx tsc --noEmit`, `pnpm lint` → sạch.
- [ ] **Step 5:** Commit `feat(tien-bo): bang o vuong 52 tuan o trang Tien bo va trang hoc vien`.

### Task 3: Kiểm giao diện + build + push

- [ ] **Step 1:** `pnpm dev`, HS đăng nhập Google ở khung trình duyệt → `/student/stats`: bảng hiện, cuộn tới tuần hiện tại, chạm ô hiện chi tiết; khổ 375px không tràn ngang trang; chế độ tối.
- [ ] **Step 2:** GV `/teacher/students/<id>`: bảng hiện, không có câu nhận xét.
- [ ] **Step 3:** `pnpm build` → thành công.
- [ ] **Step 4:** Push `feature/ielts-platform-mvp`, kiểm deploy Vercel.
