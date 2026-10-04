# Xu — Đợt 3: Đổi quà ngoài đời

Ngày: 4/10/2026 · Tiếp nối [Đợt 1](2026-10-03-xu-cua-hang-dot-1-design.md), [Đợt 2](2026-10-03-xu-dot-2-khoi-phuc-chuoi-design.md).

## Mục tiêu

Thầy tạo các món quà ngoài đời (trà sữa, bút, miễn 1 bài tập…); học viên bỏ Xu ra đổi; thầy trao quà rồi đánh dấu "Đã trao", hoặc từ chối và hệ thống tự hoàn Xu.

## Luật (thầy đã chốt)

- **Trừ Xu ngay khi đổi.** Phiếu ở trạng thái `pending` ("Chờ thầy trao"). Thầy bấm **Đã trao** (`delivered`) hoặc **Từ chối** (`rejected`, hoàn Xu, ghi chú tuỳ chọn). Phiếu còn `pending` thì học viên tự **Huỷ** được (`cancelled`, hoàn Xu).
- **Giới hạn** (đặt riêng cho từng món, đều tuỳ chọn):
  - `stock` = tổng số lượng; còn lại = stock − số phiếu `pending|delivered`. Trống = không giới hạn.
  - `limitPerStudent` + `limitPeriod` (`month` theo tháng giờ VN, tính theo thời điểm đổi | `ever`). Đếm phiếu `pending|delivered` của em đó.
- **Hình**: emoji bắt buộc; ảnh thật tuỳ chọn (có ảnh thì hiện ảnh).
- **Báo tin trong app**: menu thầy "Đổi quà" có số đỏ đếm phiếu chờ; chuông học viên báo phiếu đã trao / bị từ chối. Không gửi mail.

## Dữ liệu (2 bảng mới — thêm vào `scripts/ensure-db.mjs`)

```prisma
model Reward {
  id              String   @id @default(cuid())
  teacherId       String
  emoji           String
  imageUrl        String?
  name            String
  description     String?
  price           Int
  stock           Int?      // null = không giới hạn
  limitPerStudent Int?      // null = không giới hạn
  limitPeriod     String    @default("month") // month | ever
  active          Boolean   @default(true)
  sortOrder       Int       @default(0)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  teacher         TeacherProfile     @relation(...)
  redemptions     RewardRedemption[]
}

model RewardRedemption {
  id          String    @id @default(cuid())
  rewardId    String
  studentId   String
  rewardName  String    // chụp lại lúc đổi
  rewardEmoji String
  price       Int
  status      String    @default("pending") // pending | delivered | rejected | cancelled
  teacherNote String?
  resolvedAt  DateTime?
  createdAt   DateTime  @default(now())
  @@index([status, createdAt])
  @@index([studentId, createdAt])
  @@index([rewardId, status])
}
```

- Xoá `Reward` bị chặn khi đã có phiếu (FK `RESTRICT`); món chưa ai đổi thì xoá được, đã có phiếu thì chỉ ẩn.
- Comment enum đầu schema: `CoinKind` thêm `reward_redeem | reward_refund`; thêm `RewardLimitPeriod`, `RedemptionStatus`.
- Sổ Xu: đổi = `reward_redeem`, key `reward:<redemptionId>`, `-price`, note "Đổi quà <tên>"; hoàn = `reward_refund`, key `refund:<redemptionId>`, `+price`, note "Hoàn Xu — <tên> (thầy từ chối | em huỷ)".
- `Reward.imageUrl` thêm vào `scripts/blob-orphans.mjs`.

## Code

- `lib/rewards.ts` (thuần): `remainingStock`, `studentLimitReached`, `rewardCardState` (`redeemable | short | sold_out | limit | inactive`), nhãn trạng thái phiếu, khoá sổ `redeemKey/refundKey`, `REWARD_EMOJI_SUGGESTIONS`.
- `lib/actions/rewards.ts`:
  - HS: `redeemReward(formData)`, `cancelRedemption(formData)` — `requireStudent()` đầu tiên.
  - GV: `saveReward(formData)` (tạo/sửa), `toggleRewardActive`, `deleteReward` (chỉ khi chưa có phiếu), `deliverRedemption`, `rejectRedemption` — `requireTeacher()` đầu tiên, món phải thuộc thầy.
  - Đổi: `$transaction` → `lockStudent` + khoá `Reward FOR UPDATE` → kiểm active / còn hàng / giới hạn / đủ Xu → tạo phiếu + dòng sổ → `recomputeCoins`.
  - Hoàn: cập nhật phiếu bằng `updateMany where status = "pending"`; `count === 0` thì báo "Phiếu đã được xử lý" → không hoàn hai lần.
- Học viên: tab **"Quà"** ở `/student/shop?tab=reward` (thẻ `components/shop/reward-card.tsx`), mục "Phiếu đổi quà của em" có nút Huỷ phiếu chờ.
- Thầy: trang `/teacher/rewards` (`requireTeacherPage`) gồm Phiếu chờ trao · Món quà (form thêm/sửa, ảnh nén webp ~600px trên trình duyệt rồi tải qua `/api/image/direct-upload`) · Lịch sử 50 phiếu gần nhất. Menu "Đổi quà" + số đỏ: `app/teacher/layout.tsx` đếm phiếu `pending` truyền vào `AppShell` (`navBadges`).
- Chuông HS: thêm loại `reward_delivered | reward_rejected` vào `lib/notifications.ts` + truy vấn ở `lib/notifications-feed.ts` (bọc try/catch như nguồn khác).

## Kiểm thử

- `tests/rewards.test.ts`: còn hàng, giới hạn tháng/mãi mãi (biên tháng giờ VN), trạng thái thẻ, khoá sổ.
- Cấu trúc: action mở đầu `requireStudent`/`requireTeacher`; đổi có `lockStudent` + `FOR UPDATE` + `recomputeCoins`; hoàn dùng `status: "pending"` làm điều kiện; ensure-db có 2 bảng; blob-orphans có `Reward`; trang thầy dùng `requireTeacherPage` (test sẵn có).
- Local hai vai, prod bằng Chrome.
