# Mạng xã hội Đợt 1 — Bảng xếp hạng kiểu chin + hồ sơ mở toàn trường (5/10/2026)

## 1. Bối cảnh

Thầy muốn học viên xem được hồ sơ của nhau, có bảng xếp hạng cả lớp lẫn toàn trường,
có các tính năng tương tác như chin.edu.vn để các em ganh đua với nhau.

Đã xem chin.edu.vn ngày 5/10/2026. Họ có:
- hồ sơ công khai `/u/<tên>`;
- hai bảng: "Học Bá Hall" (XP tháng) và "Hội Nhóm Củi" (chuỗi ngày), mỗi bảng chia
  phạm vi Bạn bè / Cơ sở / Thế giới;
- theo dõi bạn bè và thả cảm xúc 👏 🔥 🎯;
- bảng tin hoạt động bạn bè, có thả tim và bình luận;
- giải đấu tuần.

**Thầy chốt chia 3 đợt**, mỗi đợt ship riêng:
- **Đợt 1 (spec này):** hồ sơ mở toàn trường, bảng xếp hạng kiểu chin, bảng thu nhỏ ở
  trang chủ, thưởng Xu cho Top 10 tháng.
- **Đợt 2:** theo dõi bạn bè, tab "Bạn bè" trên bảng xếp hạng, tìm bạn, thả cảm xúc
  lên hồ sơ (báo qua chuông).
- **Đợt 3:** bảng tin hoạt động bạn bè, thả tim, bình luận, công cụ cho thầy gỡ bình
  luận.
- **Để sau:** giải đấu tuần, huy hiệu.

**Thầy chốt cho Đợt 1:**
- Hồ sơ giống chin: hiện số XP, chuỗi và lịch chăm học; vẫn giấu điểm, band và bài làm.
- Có 3 bảng: Học Bá, Chuỗi, Điểm lớp.
- Thưởng Xu cho Top 10 Học Bá toàn trường.
- Ai cũng công khai, không có công tắc ẩn.

## 2. Phạm vi

**Làm:**
- trang `/student/ranking` mới gồm 3 bảng;
- hồ sơ `/student/profile/[studentId]` mở cho mọi học viên;
- lịch trên hồ sơ của mình đổi sang cùng nguồn với chuỗi 🔥;
- khối bảng xếp hạng thu nhỏ ở `/student`;
- thưởng Xu tháng kèm chuông báo;
- tab Chuỗi ở `/teacher/ranking`.

**Không làm (đợt sau):** theo dõi / bạn bè, cảm xúc, bảng tin, bình luận, giải đấu
tuần, huy hiệu, công tắc ẩn khỏi bảng.

**Không đổi schema.** Chỉ thêm giá trị `monthly_prize` vào comment `enum CoinKind`
ở đầu `prisma/schema.prisma`. Không cần sửa `scripts/ensure-db.mjs`.

## 3. Dữ liệu

Cách đã chọn là **tính thẳng từ dữ liệu có sẵn và cache ngắn**. Không thêm bảng
xếp hạng lưu sẵn, cũng không thêm cột "chuỗi hiện tại", vì cả hai đều dễ lệch số. Trường
chỉ khoảng 40 học viên nên tính trực tiếp vẫn đủ nhanh.

### 3.1 Học Bá (XP tháng)

- Nguồn là `getMonthlyRecap(monthKey)` (`lib/monthly-recap-data.ts`), lấy `xpBoard`.
  Cùng công thức với Tổng kết tháng: mọi lượt đều tính, lượt làm lại được nửa XP, ôn
  2 thẻ được 1 XP. Nhờ vậy bảng lúc cuối tháng khớp đúng với popup Tổng kết.
- Tháng đã qua vẫn dùng cache 1 ngày như hiện nay. **Tháng hiện tại** thêm cache
  `unstable_cache`, `revalidate: 300`, tag `leaderboard`:
  - `submitSkill` gọi `revalidateTag("leaderboard")` sau khi chấm xong, bọc
    try/catch để lỗi cache không làm hỏng việc nộp bài;
  - ôn thẻ Sổ từ **không** xoá cache (mỗi thẻ một lần sẽ quá dày); XP từ thẻ hiện lên
    bảng chậm tối đa 5 phút.
  - Cache này đặt ngay trong `getMonthlyRecap`, nên trang `/student/recap` và
    `/teacher/ranking?view=month` khi xem tháng hiện tại cũng có thể chậm tối đa 5 phút.
    Mức chậm này chấp nhận được.
- Phạm vi **Lớp**: lọc `entries` theo danh sách `ClassStudent` của lớp, rồi xếp hạng
  lại trong lớp theo cùng quy tắc đồng hạng (1, 2, 2, 4).
- Chip hạng đấu trên từng dòng lấy qua `getLifetimeXpMap(ids)`.
- Xem lại được các tháng cũ qua `recentMonthKeys`, tối đa 6 tháng gần nhất.

### 3.2 Chuỗi 🔥

- Hàm mới `loadSchoolDayStreaks(now)` đặt trong `lib/day-streak-data.ts`, chạy một lượt
  cho **cả trường**. Có 4 truy vấn, mỗi truy vấn chỉ lấy `studentId` và ngày:
  `AttemptSkill.submittedAt`, `Attempt` cũ không có giờ từng kỹ năng, `VocabQuizDay`,
  và `CoinTransaction` kind `streak_restore`.
- Dữ liệu được gom theo học viên. Sau đó gọi đúng các hàm thuần đang có:
  `buildActivityDays`, `activeDayKeys`, `restoredDaysOf`, `calculateDayStreak`.
  Cửa sổ lùi là 400 ngày, bằng `STREAK_LOOKBACK_DAYS`.
- Kết quả của mỗi em gồm `{ days, activeToday }`. Bảng chỉ lấy các em có `days > 0`.
- Dùng chung cache tag `leaderboard` với Học Bá.
- **Bất biến:** chuỗi tính gộp phải trùng với `getDayStreak` tính riêng từng em. Có test
  cho phần gom nhóm thuần.

### 3.3 Điểm lớp

Giữ nguyên `getClassRanking` + `ClassRankingBoard`.

## 4. Logic thuần — `lib/leaderboard.ts` (mới)

**Cấp lửa:**
- `STREAK_TIERS`: Nhen 1 · Bén 3 · Cháy 7 · Đuốc 14 · Lửa Trại 30 · Hải Đăng 60 ·
  Bất Diệt 100 (đơn vị: ngày).
- `streakTier(days)` trả về null khi `days = 0`.
- `streakTierProgress(days)` trả về `{ current, next, daysToNext }`.

**Bảng:**
- `rankBoard(rows, value)`: sắp giảm dần, đồng giá trị thì đồng hạng, đồng nữa thì xếp
  theo tên (`localeCompare` "vi").
- `scopeBoard(rows, memberIds)`: lọc theo lớp rồi xếp hạng lại.
- `boardWindow(rows, myId, topN)`: trả về top N cộng dòng của mình (nếu mình ngoài top),
  dùng cho khối trang chủ.

**Đếm ngược:**
- `monthEndsIn(now)`: số ngày, giờ, phút còn lại tới hết tháng theo giờ VN, hiển thị
  dạng "Kết thúc sau 26n 07g". Tính lúc render, không cần đồng hồ chạy.

**Thưởng:**
- `MONTHLY_PRIZES`: #1 300 · #2 200 · #3 150 · #4–10 mỗi em 50 Xu.
- `monthlyPrizeFor(rank)` trả về 0 khi ngoài top 10.
- `PRIZE_START_MONTH = "2026-10"`: không hồi tố các tháng trước, vì lúc đó các em
  chưa biết có giải.
- Đồng hạng thì nhận cùng mức thưởng, kể cả khi số em được thưởng vượt quá 10.
- `monthlyPrizeEntries(recap)` tính danh sách thưởng từ `xpBoard` toàn trường:
  kind `monthly_prize`, key `prize:xp:<YYYY-MM>`,
  note "Hạng #3 Học Bá tháng 10/2026".

## 5. Trang Xếp hạng — `/student/ranking`

Tham số URL (tên tiếng Anh, theo quy ước `app/student/*`):
- `?board=xp|streak|class`, mặc định `xp`;
- `?scope=school|class`, mặc định `school`;
- `?classId=`, mặc định lớp tham gia gần nhất;
- `?month=YYYY-MM`, chỉ dùng cho bảng Học Bá.

Giá trị lạ thì về mặc định. `classId` không thuộc lớp của mình cũng về lớp mặc định,
để không lộ dữ liệu lớp khác qua URL.

**Thanh chọn trên cùng:** Học Bá · Chuỗi 🔥 · Điểm lớp. Hai bảng đầu có thêm thanh
Lớp / Toàn trường. Em học nhiều lớp thì hiện ô chọn lớp. Em chưa có lớp thì phạm vi
Lớp hiện "Bạn chưa thuộc lớp nào".

**Học Bá:**
- Phần đầu bảng có tiêu đề "Học Bá tháng 10", dòng đếm ngược (chỉ tháng hiện tại), các
  ô giải thưởng ("#1 300 Xu + khung Quán quân", "#2 200 Xu", "#3 150 Xu", "#4–10 50 Xu")
  và nút ‹ › chuyển tháng.
- Thân bảng: bục Top 3, rồi đến danh sách. Mỗi dòng gồm avatar kèm khung, tên (link
  hồ sơ), chip hạng đấu, "N ngày học" và XP tháng.

**Chuỗi:**
- Phần đầu bảng có dải 7 cấp lửa, cấp của mình được tô sáng, kèm dòng "Còn N ngày nữa
  lên Đuốc".
- Mỗi dòng gồm avatar, tên, chip cấp lửa, "Chưa học hôm nay" (khi `!activeToday`) và
  "N ngày".

**Điểm lớp:** `ClassRankingBoard` như hiện nay.

**Dòng của mình** luôn được tô nổi. Nếu mình không có trong bảng thì có một dòng ghim ở
cuối: "Bạn · chưa có XP tháng này" (Học Bá) hoặc "Bạn · chưa có chuỗi" (Chuỗi).

**Component** đặt trong `components/leaderboard/`:
- `leaderboard-board.tsx`: bục + danh sách dùng chung, nhận các dòng đã chuẩn hoá
  `{ studentId, displayName, avatar…, frame, rank, valueText, subText, chip }`;
- `xp-board-header.tsx`, `streak-board-header.tsx`;
- `streak-tier-chip.tsx`.

Trang này dùng bố cục rộng như hồ sơ (`max-w-[1400px]`), bảng nằm giữa, rộng tối đa
khoảng 720px như chin.

## 6. Hồ sơ mở toàn trường — `/student/profile/[studentId]`

**Chốt quyền:**
- Người xem phải là học viên đã đăng nhập.
- Hồ sơ đích chỉ cần tồn tại, **bỏ điều kiện chung lớp**.
- Không tìm thấy thì `notFound()`.
- Mở đúng id của chính mình thì chuyển hướng về `/student/profile`.

**Hiện:**
- bìa, khung, avatar, tên, bio (text thuần), ngày tham gia;
- tên các lớp đang học;
- chuỗi 🔥 và chip cấp lửa;
- **số XP** cùng `RankCard showXp`, có tiến trình "còn X XP lên Bạc IV";
- **lịch chăm học theo tháng**: `AttendanceCalendar` với nút ‹ › (`?month=`) và 4 số:
  - tỉ lệ ngày học = số ngày học / số ngày đã trôi qua trong tháng, hoặc / số ngày của
    tháng nếu là tháng đã qua;
  - tổng số ngày học trong tháng;
  - chuỗi hiện tại;
  - "Ngày cày trâu nhất": ngày có `count` lớn nhất, ghi dạng "Thứ 6 (02/10): 3 phần
    bài · 20 thẻ";
- linh vật.

**Vẫn giấu:** điểm/band từng bài, band trung bình, mục tiêu band, bài làm, chi tiết
từng câu (`Answer`), số dư Xu.

**Nguồn lịch:** `loadActivityDays`, cùng nguồn với chuỗi 🔥. `buildAttendanceMonth`
được sửa để nhận danh sách khoá ngày thay cho `Date[]`. Hồ sơ của mình cũng chuyển
sang nguồn này. Trước đây hồ sơ của mình chỉ đếm lượt `countsForStats`, nên có lúc ô
lịch tắt trong khi chuỗi vẫn tính ngày đó.

**Liên kết vào hồ sơ:** từ cả 3 bảng, khối trang chủ và Tổng kết tháng.

`tests/profile-visibility.test.ts` được viết lại theo quy tắc mới:
- vẫn cấm `bandsBySkill`, `targetBand`, `answers:`, `attemptSkill:` và số dư Xu;
- cho phép số XP và lịch;
- bỏ yêu cầu `classes: { some` trong `where`.

## 7. Khối trang chủ — `/student`

- Đặt sau hàng thẻ Chuỗi / Hạng / Tiến độ, trước thẻ Từ vựng. Khối "Bài được giao" vẫn
  ở đầu trang.
- Là client component, có 2 tab **Học Bá / Chuỗi**, phạm vi Toàn trường. Mỗi tab hiện
  `boardWindow(top 5 + mình)`. Server truyền sẵn cả 2 danh sách, nên đổi tab không cần
  tải lại. Có link "Xem tất cả →" tới `/student/ranking?board=…`.
- Phần đọc dữ liệu bọc try/catch. Nếu lỗi thì không hiện khối, trang chủ vẫn chạy.
- Học Bá ở đây dùng chung cache tháng hiện tại (mục 3.1).

## 8. Thưởng Xu tháng

- `CoinKind` thêm `"monthly_prize"` ở `lib/coins.ts` và trong comment schema.
  **`XP_EARN_KINDS` giữ nguyên**: Xu thưởng không cộng vào XP hạng đấu (có test ép).
- Hàm `grantMonthlyPrizes(now)` đặt trong `lib/wallet.ts`:
  - với mỗi tháng đã khép từ `PRIZE_START_MONTH` trở đi, lấy recap tháng đó qua cache 1
    ngày rồi tính `monthlyPrizeEntries`;
  - mỗi học viên được ghi trong transaction riêng: khoá dòng, `createMany skipDuplicates`,
    rồi `recomputeCoins`. Cách này dùng lại đúng khuôn của `applyWalletChanges`;
  - idempotent nhờ `@@unique(studentId, key)`.
- **Ai gọi hàm này:**
  1. Cron `/api/cron/reminders` (12h trưa mỗi ngày): gọi sau `topUpClassSessions`,
     trước bước kiểm cấu hình mail, bọc try/catch. Lần trả đầu tiên là trưa
     **1/11/2026**.
  2. `syncWallet` chế độ đầy đủ (lúc vào trang Cửa hàng, hoặc khi chạy script hồi tố):
     chỉ cộng phần của em đó, để dự phòng khi cron trượt.
- **Chuông:** `lib/notifications-feed.ts` đọc các dòng `monthly_prize` của học viên,
  bọc try/catch như BugReport, và hiện "🏆 Bạn đứng hạng #3 Học Bá tháng 10 — +150 Xu".
  Bấm vào sẽ mở `/student/ranking?board=xp&month=2026-10`.
- Khung "Quán quân" và nền "Chuyên cần" (Top 1) giữ nguyên cơ chế cũ. Chip giải #1
  ghi cả Xu lẫn khung.

## 9. Phía giáo viên

- `/teacher/ranking` thêm tab **Chuỗi 🔥** (`?view=streak`), dùng `LeaderboardBoard`
  cùng dữ liệu `loadSchoolDayStreaks`. Có ô chọn "Toàn trường" hoặc từng lớp của thầy.
  Dòng của học viên link sang trang học viên của thầy.
- Tab tháng và tab lớp hiện có giữ nguyên. Trang học viên của thầy không đổi.

## 10. Lỗi và hiệu năng

- Tham số URL sai thì về mặc định, không trả 500.
- Khối trang chủ lỗi thì ẩn khối.
- Thưởng Xu lỗi trong cron thì ghi log rồi chạy tiếp các việc sau. Ngày hôm sau cron
  thử lại, và không có nguy cơ cộng trùng.
- Trước khi ship phải đo trên dữ liệu prod: `loadSchoolDayStreaks` và Học Bá tháng hiện
  tại khi chưa có cache. Mục tiêu dưới 1,5 giây khi Neon đang lạnh. Nếu chậm hơn thì
  rút cửa sổ lùi của chuỗi xuống bằng chuỗi dài nhất thực tế cộng thêm khoảng đệm.

## 11. Kiểm thử

**Vitest, logic thuần:**
- `streakTier` / `streakTierProgress` ở các ngưỡng 0, 1, 2, 3, 99, 100, 500;
- `rankBoard` với trường hợp đồng hạng;
- `scopeBoard` xếp hạng lại trong lớp;
- `boardWindow` khi mình trong top, ngoài top, hoặc không có trong bảng;
- `monthEndsIn` ở ranh giới cuối tháng theo giờ VN;
- `monthlyPrizeFor` / `monthlyPrizeEntries`: đồng hạng ở hạng 10, tháng trước
  `PRIZE_START_MONTH` không ra thưởng;
- gom nhóm chuỗi toàn trường cho kết quả trùng với tính riêng từng em.

**Vitest, cấu trúc:**
- `profile-visibility` (viết lại);
- `monthly_prize` có trong schema comment và trong `CoinKind`, nhưng không có trong
  `XP_EARN_KINDS`;
- `submitSkill` gọi `revalidateTag("leaderboard")`.

**Thủ công:**
- Local: vào vai học viên bằng JWT tự ký, xem 3 bảng × 2 phạm vi, hồ sơ một em khác lớp,
  khối trang chủ ở khổ điện thoại, và thưởng Xu bằng tháng giả.
- Prod: dùng Chrome với tài khoản Minh, sau khi deploy.
