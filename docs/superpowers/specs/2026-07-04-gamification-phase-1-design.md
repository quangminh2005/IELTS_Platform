# Gamification Giai đoạn 1 — Đánh bóng giao diện

**Ngày:** 2026-07-04
**Phạm vi:** Nhóm A — các cải tiến thị giác/động lực **không cần đổi schema, seed, hay dữ liệu**. Streak, phân hạng (tier), huy hiệu (badge) để dành Giai đoạn 2.

## Mục tiêu

Tăng độ thu hút và động lực làm bài cho học sinh cấp 3 bằng 4 cải tiến trực quan, dùng hoàn toàn dữ liệu đã có:

1. Bục vinh quang Top 3 (podium) ở trang Xếp hạng.
2. Tag màu theo kỹ năng (Nghe/Đọc/Viết/Nói) trên thẻ bài.
3. Thanh tiến độ (vòng tròn %) ở trang Tổng quan.
4. Pop-up chúc mừng có pháo hoa khi nộp bài.

## Nguyên tắc chung

- **Không đổi `prisma/schema.prisma`, `prisma/seed.ts`, `lib/seed-data.ts`** → các test cấu trúc hiện có (`foundation.test.ts`…) không bị ảnh hưởng.
- Giữ text và comment **tiếng Việt**, dùng design tokens Tailwind sẵn có (`bg-card`, `border-border`, `text-primary`, hỗ trợ dark mode).
- **Không thêm thư viện** cho pháo hoa/animation — dùng CSS/canvas tự viết nhẹ.
- Tách logic thuần (chọn bậc chúc mừng, map kỹ năng) ra file riêng để test bằng vitest.

---

## 1. Bục vinh quang Top 3 (Podium)

**File:** `app/student/ranking/page.tsx` (chỉ đổi phần render, giữ nguyên phần tính `rankedStudents`).

- Top 3 (index 0,1,2) hiển thị dạng **podium** phía trên bảng:
  - Thứ tự trái→phải: **hạng 2 – hạng 1 – hạng 3**.
  - Hạng 1 ở giữa, bục cao nhất; avatar lớn hơn.
  - Viền avatar theo màu: **Vàng** (hạng 1), **Bạc** (hạng 2), **Đồng** (hạng 3) + medal 🥇🥈🥉.
  - Hiệu ứng **lấp lánh bằng CSS** (keyframes shimmer/glow) — không cần JS/thư viện, giữ được server component.
- Từ hạng 4 trở đi: **giữ nguyên** bảng danh sách hiện tại, đặt ngay dưới podium. (Nếu lớp ≤ 3 người thì không có phần danh sách này.)
- **Lớp ít người**: chỉ dựng đúng số bục = số học viên hiện có (1 hoặc 2 bục), **không** render bục trống.
- Học viên hiện tại (`isCurrentStudent`) vẫn được đánh dấu "Bạn" trên podium.
- Đánh dấu hiển thị "Band X.X" hoặc "%"/điểm giữ **đúng logic hiện tại** (`averageBandValue !== null ? Band : %`).

**Không đổi:** `lib/ranking.ts`, công thức điểm, truy vấn Prisma.

**Kiểm thử:** chủ yếu là trình bày → không thêm unit test. Kiểm tra thủ công qua preview với lớp 2 học viên (dữ liệu thật).

---

## 2. Tag màu theo kỹ năng

**File mới:**
- `lib/skills.ts` — nguồn dữ liệu duy nhất cho nhãn + màu kỹ năng.
- `components/skill-tags.tsx` — component hiển thị danh sách pill (server-safe, không state).

**`lib/skills.ts`:**
- Map nhãn tiếng Việt đầy đủ: `listening: "Nghe"`, `reading: "Đọc"`, `writing: "Viết"`, `speaking: "Nói"`.
- Map class màu pill cho từng kỹ năng: Nghe = xanh lá (emerald), Đọc = xanh dương (sky/blue), Viết = cam (orange), Nói = tím (violet). Dùng biến thể nền nhạt + chữ đậm hợp dark mode (ví dụ `bg-emerald-500/10 text-emerald-600 dark:text-emerald-300`).
- Hàm `distinctSkills(skills: string[]): string[]` trả về danh sách kỹ năng **không trùng**, theo thứ tự cố định listening→reading→writing→speaking.
- (Lưu ý dọn dẹp: `SKILL_SHORT_LABELS` trong `lib/band-score.ts` chỉ có listening/reading và phục vụ mục đích khác — **giữ nguyên**, không gộp để tránh phá logic band.)

**`components/skill-tags.tsx`:**
- Nhận `skills: string[]`, gọi `distinctSkills`, render mỗi kỹ năng thành 1 pill nhỏ dùng nhãn + màu từ `lib/skills.ts`.
- Bài trộn nhiều kỹ năng → nhiều pill.

**Chỗ hiển thị & truy vấn cần bổ sung:**
- **Tổng quan** (`app/student/page.tsx`): truy vấn `recipients` hiện chỉ lấy `_count.units`. Bổ sung lấy `skill` của các phần trong bài (qua `assignment.units` → `AssignableUnit.skill`). Render `<SkillTags>` trên mỗi thẻ bài.
- **Lịch sử** (`app/student/history/page.tsx`): đã có `answers[].assignableUnit.skill`; suy ra danh sách kỹ năng của bài từ đó (hoặc lấy trực tiếp từ `assignment.units` cho nhất quán). Render `<SkillTags>` trên mỗi thẻ.

**Kiểm thử:** unit test cho `distinctSkills` (khử trùng + thứ tự) và tính đầy đủ của map nhãn/màu 4 kỹ năng.

---

## 3. Thanh tiến độ (Tổng quan)

**File:** `app/student/page.tsx` (thêm widget, dùng dữ liệu `recipients` đã có).

- Widget đặt ở đầu trang, dưới lời chào.
- **Vòng tròn %** (SVG donut, server-render) + dòng chữ "Đã hoàn thành X/Y bài được giao".
- Định nghĩa hoàn thành: `status === "submitted" || status === "reviewed"` (nhất quán với logic `done`/`pendingCount` hiện có).
- Màu vòng tròn nổi bật (`primary`/emerald). Trường hợp chưa có bài giao (Y = 0): ẩn widget hoặc hiện trạng thái rỗng nhẹ nhàng.
- Không cần client component (SVG tĩnh). Có thể thêm animation "đổ đầy" bằng CSS nếu đơn giản.

**Kiểm thử:** thủ công qua preview (logic đếm quá đơn giản, không cần unit test riêng).

---

## 4. Pop-up chúc mừng khi nộp bài

**Luồng:**
- `lib/actions/attempts.ts` `submitAttempt`: đổi redirect từ `/student/results/${attempt.id}` → `/student/results/${attempt.id}?submitted=1` (dấu hiệu vừa nộp). *Chỉ* nhánh submit của học viên thêm dấu hiệu này; các redirect khác giữ nguyên.
- `app/student/results/[attemptId]/page.tsx`: truyền dữ liệu cần thiết (scorePercent/band, danh sách kỹ năng đã chấm tự động, có phải bài chấm tay không) xuống một **component client mới** `components/submit-celebration.tsx`.
- `components/submit-celebration.tsx`:
  - Đọc `?submitted=1` (qua `useSearchParams`). Nếu không có → không render gì.
  - Hiện pop-up **một lần**, sau đó dùng `router.replace` xóa query để refresh không bật lại.
  - Cho phép đóng (nút "Tuyệt vời!"/X, hoặc click nền).

**File logic thuần:** `lib/celebration.ts` — quyết định bậc + nội dung, **không phụ thuộc React** để test được.
- Input: `{ scorePercent: number | null, isManualOnly: boolean, dominantSkill: string | null }`.
- Output: `{ tier: "manual" | "encourage" | "good" | "great", title: string, confetti: "none" | "medium" | "big" }`.
- Quy tắc:
  - `isManualOnly` (Viết/Nói, chưa có điểm): `tier = "manual"`, title "Đã nộp — chờ giáo viên chấm", `confetti = "none"`.
  - `scorePercent < 50`: `encourage`, động viên, `confetti = "none"` ("Đã nộp! Lần sau bùng nổ hơn nhé 💪").
  - `50 ≤ scorePercent < 80`: `good`, lời khen, `confetti = "medium"`.
  - `scorePercent ≥ 80`: `great`, **danh hiệu vui theo `dominantSkill`** (vd "Kẻ hủy diệt Reading", "Cao thủ Listening"), `confetti = "big"`.
- `dominantSkill`: kỹ năng chiếm nhiều câu nhất trong các phần **chấm tự động** của bài (Nghe/Đọc). Nếu không xác định → dùng danh hiệu chung.

**Pháo hoa:** component/CSS tự viết (canvas hoặc CSS keyframes), độ mạnh theo `confetti`. **Không thêm thư viện.**

**Kiểm thử:** unit test cho `lib/celebration.ts` phủ 4 bậc + chọn danh hiệu theo kỹ năng + biên (49/50/79/80, scorePercent null).

---

## Tóm tắt file thay đổi

**Mới:**
- `lib/skills.ts`
- `lib/celebration.ts`
- `components/skill-tags.tsx`
- `components/submit-celebration.tsx`
- `tests/skills.test.ts`, `tests/celebration.test.ts`

**Sửa:**
- `app/student/ranking/page.tsx` (podium)
- `app/student/page.tsx` (thanh tiến độ + tag kỹ năng + bổ sung truy vấn skill)
- `app/student/history/page.tsx` (tag kỹ năng)
- `app/student/results/[attemptId]/page.tsx` (gắn celebration + truyền props)
- `lib/actions/attempts.ts` (thêm `?submitted=1` vào redirect nhánh submit)

**Không đụng:** `prisma/schema.prisma`, `prisma/seed.ts`, `lib/seed-data.ts`, `lib/ranking.ts`, công thức band.

## Ngoài phạm vi (Giai đoạn 2)

Streak (chuỗi ngày học), phân hạng Đồng→Kim Cương (điểm tích lũy), huy hiệu mở khóa — đều cần thêm bảng dữ liệu/logic theo dõi, làm ở spec riêng sau.
