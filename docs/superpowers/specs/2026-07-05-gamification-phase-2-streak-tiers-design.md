# Gamification Giai đoạn B — Streak tuần + Phân hạng

**Ngày:** 2026-07-05
**Phạm vi:** Streak theo tuần + Phân hạng Đồng→Kim Cương. **Huy hiệu (badges) KHÔNG thuộc spec này** — để một spec riêng sau.

## Mục tiêu

Tăng động lực duy trì đều đặn (streak) và cảm giác thăng tiến/cạnh tranh (phân hạng) cho học sinh. Suy ra từ dữ liệu làm bài sẵn có, chỉ thêm **một** cấu hình nhỏ (chỉ tiêu tuần của lớp).

## Nguyên tắc chung

- Giữ text & comment **tiếng Việt**; dùng design tokens Tailwind + hỗ trợ dark mode.
- **Không thêm dependency mới.**
- Migration duy nhất: thêm cột **nullable** `Class.weeklyGoal` qua cơ chế `scripts/ensure-db.mjs` (idempotent, không mất dữ liệu). Không thêm bảng mới.
- Tách logic thuần ra `lib/streak.ts`, `lib/rank-tier.ts` (không phụ thuộc React) để test bằng vitest.
- **Không** đổi công thức trong `lib/ranking.ts` — chỉ *đọc* điểm xếp hạng để chia bậc.

---

## Phần 1 — Streak theo tuần 🔥

### Định nghĩa
- **Tuần** = Thứ 2 đến Chủ Nhật, theo giờ Việt Nam (**UTC+7 cố định**, không DST).
- **Chỉ tiêu N bài/tuần**: giá trị `Class.weeklyGoal` của lớp học sinh. Nếu null → mặc định **3**.
- **Đếm tuần**: số bài **đã nộp** (attempt có `status` ∈ {`submitted`, `reviewed`}) mà `submittedAt` rơi vào tuần đó. **Mọi loại bài đều tính** (homework + practice + mock) — nhờ vậy "gỡ streak bằng bài luyện tập" tự động đúng, không cần xử lý riêng theo mode.
- Một tuần **"đạt"** khi số bài đã nộp trong tuần ≥ N.
- **Streak** = số tuần "đạt" **liên tiếp** tính lùi từ tuần hiện tại.

### Quy tắc tuần hiện tại (grace)
- Tuần hiện tại nếu **chưa đủ N** thì **KHÔNG tính là đứt** (vẫn còn thời gian trong tuần). Streak = chuỗi các tuần đã kết thúc + "đạt" liên tiếp; nếu tuần hiện tại đã đủ N thì cộng thêm tuần hiện tại vào chuỗi.
- Chỉ khi **một tuần đã kết thúc** mà không đủ N thì chuỗi mới dừng ở đó (về 0 nếu tuần liền trước không đạt).
- Cờ `atRisk` = true khi tuần hiện tại **chưa** đủ N (để hiện nhắc "sắp mất chuỗi").

### Logic thuần — `lib/streak.ts`
Hàm chính:
```ts
export type StreakResult = {
  weeks: number;            // số tuần đạt liên tiếp
  weeklyGoal: number;       // N đang áp dụng
  currentWeekCount: number; // số bài đã nộp trong tuần hiện tại
  atRisk: boolean;          // tuần hiện tại chưa đủ N
};

export function calculateWeekStreak(input: {
  submittedAt: Date[];   // ngày nộp của các attempt đã nộp
  weeklyGoal: number;    // N (đã resolve, > 0)
  now: Date;             // thời điểm hiện tại
}): StreakResult;
```
Cài đặt:
- Chuyển mỗi `Date` sang "mốc đầu tuần VN" (Thứ 2 00:00 giờ VN) bằng cách cộng offset +7h rồi lùi về Thứ 2 theo UTC-day; trả về một khóa tuần so sánh được (timestamp mốc đầu tuần). Helper nội bộ `vnWeekStart(date: Date): number`.
- Đếm số bài theo từng khóa tuần (Map).
- `currentWeekKey = vnWeekStart(now)`; `currentWeekCount = counts.get(currentWeekKey) ?? 0`; `atRisk = currentWeekCount < weeklyGoal`.
- Đếm chuỗi: bắt đầu con trỏ tại tuần hiện tại nếu tuần hiện tại đạt, ngược lại tại tuần liền trước. Lùi từng tuần (trừ 7 ngày theo khóa tuần): mỗi tuần `count >= weeklyGoal` thì `weeks++` và lùi tiếp; gặp tuần không đạt thì dừng.
- `weeklyGoal <= 0` được chuẩn hóa về 1 ở tầng gọi (không xảy ra vì default 3, nhưng phòng thủ).

### Hiển thị
- `components/streak-badge.tsx` (server-safe, nhận `weeks`, `currentWeekCount`, `weeklyGoal`, `atRisk`): 🔥 + "**{weeks} tuần**" cạnh lời chào; dòng phụ "Tuần này: {currentWeekCount}/{weeklyGoal} bài"; khi `atRisk` và `weeks > 0` đổi màu nhắc (amber) "Làm thêm {weeklyGoal - currentWeekCount} bài để giữ chuỗi". Khi `weeks === 0` hiện thông điệp khởi đầu nhẹ nhàng (không có lửa tắt kiểu trách móc).
- Gắn ở đầu trang **Tổng quan** ([app/student/page.tsx](app/student/page.tsx)), cạnh/îndưới "Chào {tên} 👋", cùng khu với thanh tiến độ đã có.

### Dữ liệu cần truy vấn (Tổng quan)
- Điểm tiêu thụ: các attempt đã nộp của học sinh (`status` ∈ {submitted, reviewed}, chọn `submittedAt`). Có thể lấy từ `prisma.attempt.findMany({ where: { studentId, status: { in: [...] }, submittedAt: { not: null } }, select: { submittedAt: true } })`.
- Chỉ tiêu N: lấy `weeklyGoal` từ lớp của học sinh — dùng `ClassStudent` mới nhất (giống trang Xếp hạng lấy `membership`). Null → 3.

### Cấu hình phía giáo viên
- Trang Lớp ([app/teacher/classes/page.tsx](app/teacher/classes/page.tsx)): mỗi lớp có ô nhập **"Chỉ tiêu bài/tuần"** (number, min 1) + nút Lưu, POST tới server action mới `updateClassWeeklyGoal` trong [lib/actions/classes.ts](lib/actions/classes.ts).
- `updateClassWeeklyGoal(formData)`: `requireTeacher()`, zod validate (`classId`, `weeklyGoal` int 1–50), cập nhật `class.updateMany({ where: { id, teacherId }, data: { weeklyGoal } })` (scope theo giáo viên sở hữu), `revalidatePath("/teacher/classes")`.

---

## Phần 2 — Phân hạng Đồng→Kim Cương

### Thước đo
- Dùng **Điểm xếp hạng 0–100 hiện có** (`calculateRankingScore` trong [lib/ranking.ts](lib/ranking.ts) — đã trộn điểm TB + mức hoàn thành + hoạt động gần đây). Cùng con số đang hiển thị cột "Tổng" trên trang Xếp hạng. Có thể **tụt** khi lơ là/điểm giảm.
- Bài Viết/Nói không có điểm tự động → như hiện tại, điểm này chủ yếu phản ánh Nghe/Đọc (hạn chế đã chấp nhận, giống điểm xếp hạng hiện có).

### 5 bậc (ngưỡng đã duyệt)
| Bậc | Điểm xếp hạng | Màu gợi ý |
|-----|---------------|-----------|
| Đồng | < 40 | amber-700 |
| Bạc | 40–54 | slate-400 |
| Vàng | 55–69 | yellow-500 |
| Bạch Kim | 70–84 | cyan-400 |
| Kim Cương | ≥ 85 | sky-400 / gradient |

### Logic thuần — `lib/rank-tier.ts`
```ts
export type Tier = { key: string; label: string; min: number; badgeClass: string };

export const TIERS: Tier[]; // 5 bậc, sắp tăng dần theo min

export function getTier(rankingScore: number): Tier; // bậc cao nhất có min <= score

export function getTierProgress(rankingScore: number): {
  tier: Tier;
  next: Tier | null;       // bậc kế trên (null nếu đã Kim Cương)
  pointsToNext: number | null;   // next.min - score (null nếu Kim Cương)
  pointsToDrop: number | null;   // score - tier.min (null nếu Đồng) — khoảng cách kẻo tụt
};
```
- `getTier`: quét `TIERS` (giảm dần) lấy bậc đầu tiên có `min <= score`; sàn là Đồng.
- Ngưỡng biên: score = 40 → Bạc; 85 → Kim Cương (dùng `>=`).

### Hiển thị
- `components/rank-tier-badge.tsx` (server-safe, nhận `tier`, optional `size`): chip màu + biểu tượng + nhãn bậc. Dùng lại ở cả 2 chỗ.
- Trang **Xếp hạng** ([app/student/ranking/page.tsx](app/student/ranking/page.tsx)): chip bậc cạnh mỗi học viên trong bảng (và nhỏ hơn trên podium). Tính `getTier(rankingScore)` cho từng người (đã có sẵn `rankingScore` mỗi người trong file).
- Trang **Tổng quan** ([app/student/page.tsx](app/student/page.tsx)): huy hiệu bậc hiện tại của học sinh + thanh nhỏ dùng `getTierProgress`: nếu chưa Kim Cương → "Còn {pointsToNext} điểm nữa lên {next.label}"; nếu đã Kim Cương → thông điệp đỉnh cao. (Điểm xếp hạng của chính học sinh phải được tính ở trang Tổng quan — xem Dữ liệu bên dưới.)

### Dữ liệu cần truy vấn (Tổng quan)
- Điểm xếp hạng của học sinh hiện tại: tái sử dụng cùng công thức trang Xếp hạng đang dùng (`calculateRankingScore` với `averageScorePercent`, `completionRate`, `recentActivityPercent`). Trang Tổng quan cần tính 3 thành phần này cho **riêng học sinh đang đăng nhập** từ attempts + recipients của họ. Để tránh lặp code giữa Xếp hạng và Tổng quan, **tách hàm tính 3 thành phần + điểm** của một học sinh vào một helper dùng chung (ví dụ `lib/student-score.ts` với `studentRankingScore(input)` nhận attempts/recipients đã select), rồi cả hai trang gọi helper này.

---

## Phần 3 — Cấu trúc & kiểm thử

### File mới
- `lib/streak.ts` + `tests/streak.test.ts`
- `lib/rank-tier.ts` + `tests/rank-tier.test.ts`
- `lib/student-score.ts` (helper điểm xếp hạng của 1 học sinh, tách từ logic trang Xếp hạng) + `tests/student-score.test.ts`
- `components/streak-badge.tsx`
- `components/rank-tier-badge.tsx`

### File sửa
- `prisma/schema.prisma` — thêm `weeklyGoal Int?` vào model `Class`.
- `scripts/ensure-db.mjs` — thêm câu `ALTER TABLE "Class" ADD COLUMN IF NOT EXISTS "weeklyGoal" INTEGER;`.
- `lib/actions/classes.ts` — action `updateClassWeeklyGoal`.
- `app/teacher/classes/page.tsx` — ô cấu hình chỉ tiêu tuần mỗi lớp.
- `app/student/page.tsx` — truy vấn ngày nộp + lớp; render streak-badge + rank-tier-badge + thanh tiến tới bậc kế.
- `app/student/ranking/page.tsx` — refactor dùng `lib/student-score.ts`; thêm chip bậc mỗi người (bảng + podium).

### Kiểm thử (vitest)
- `streak.test.ts`: gom tuần VN đúng mốc Thứ 2; đếm chuỗi liên tiếp; tuần hiện tại đủ N (cộng chuỗi) vs chưa đủ (grace, atRisk); đứt khi tuần đã qua thiếu N; bài luyện tập cũng tính (mọi attempt đã nộp đều đếm); mảng rỗng → weeks 0.
- `rank-tier.test.ts`: `getTier` cho các mốc biên (39/40/54/55/69/70/84/85, 0, 100); `getTierProgress` (pointsToNext/pointsToDrop, biên Đồng và Kim Cương → null đúng chỗ).
- `student-score.test.ts`: helper trả cùng kết quả như logic cũ trang Xếp hạng cho một bộ dữ liệu mẫu (bảo đảm refactor không đổi hành vi).
- Các test cấu trúc hiện có: thêm cột `weeklyGoal` là *thêm*, không xóa → `foundation.test.ts` vẫn xanh.

## Ngoài phạm vi (spec sau)
- Huy hiệu (badges) mở khóa + trang trưng bày.
- Kho "đề tự luyện" tự phục vụ cho học sinh (hiện gỡ streak bằng bài luyện tập do giáo viên giao).
