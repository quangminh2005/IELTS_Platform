# Xu & Cửa hàng trang trí (Đợt 1) — thiết kế

Ngày: 3/10/2026 · Thầy đã duyệt trong phiên brainstorm.

## Mục tiêu

Học viên kiếm **Xu 🪙** khi học, dùng Xu mua đồ trang trí hồ sơ (nền bìa, khung
avatar). Mục đích: thêm một phần thưởng "cầm nắm được" cho việc học đều, giống hệ
thống Kim cương + Cửa hàng của chin.edu.vn.

Mẫu tham khảo (đã xem trực tiếp 3/10/2026): chin.edu.vn `/shop` (Nền · Khung · Linh
vật, độ hiếm Thường/Hiếm/Sử thi/Huyền thoại/Theo mùa, đồ thành tích không bán) và
`/me` (nền làm bìa, khung bọc avatar). Bên chin mỗi bài xong được Kim cương ≈ ¼ XP.

## Lộ trình cả hệ thống (mỗi đợt một spec riêng)

1. **Đợt 1 (spec này):** ví Xu, kiếm Xu, hồi tố, Cửa hàng Nền + Khung, đồ thành tích tháng.
2. Đợt 2: Khôi phục chuỗi tuần bằng Xu.
3. Đợt 3: Phần thưởng ngoài đời (thầy tạo món, HS đổi, thầy duyệt/trao/hoàn tiền).
4. Đợt 4: Linh vật SVG có nhiều tư thế.

Đợt 1 phải để sẵn chỗ cho đợt sau: loại giao dịch là chuỗi mở rộng được, danh mục đồ
có trường `category` (sau thêm `mascot`).

## Quyết định đã chốt

| Câu hỏi | Chốt |
| --- | --- |
| Tên tiền | **Xu 🪙** — không dùng "Kim cương" vì trùng tên bậc xếp hạng Kim Cương |
| Nguồn hình | Em tự vẽ bằng **SVG/CSS trong code** — không ảnh, không Blob, không thư viện |
| Cách kiếm | **Ăn theo XP**, tỉ lệ 1 XP = 1 Xu |
| Số dư ban đầu | **Hồi tố toàn bộ** (từ bài đầu tiên 7/7/2026) |
| Làm lại | **Chỉ lượt đầu ra Xu**; lượt tự luyện ≥2 / làm lại sau reset = 0 Xu |
| Kiến trúc | **Sổ giao dịch** (ledger) + số dư lưu sẵn, không suy ra mỗi lần |
| Đồ thành tích | Có ngay Đợt 1, gắn **Tổng kết tháng**: Top 1 XP + Top 1 chuyên cần mỗi tháng |

Số liệu prod 3/10/2026 (dùng để đặt giá): 29 HS có XP lũy kế, tổng 13.716; trung vị
~400, đa số 200–700, cao nhất 2.625. HS chăm kiếm ~300–500 XP/tháng.

## 1. Kiếm Xu

Mọi hệ số nằm ở **`lib/coins.ts`**, tái dùng `unitXp` / `vocabDayXp` của
`lib/monthly-xp.ts` rồi nhân `COINS_PER_XP = 1`. Đổi tỉ lệ chỉ ảnh hưởng các lần cộng
sau đó — tiền đã ghi sổ không đổi.

- **Một phần (AssignableUnit) được nộp, lượt đầu** (`attemptRound = 1`): đúng bằng XP
  của phần đó — tự chấm `10 + round(10 × %đúng)`, Viết/Nói có bài làm `+20`.
  Lượt `attemptRound ≥ 2` → 0 Xu (không ghi sổ).
- **Ôn Sổ từ:** mỗi ngày VN `min(15, floor(thẻ/2))`. Dòng sổ của ngày được cập nhật
  **tăng dần** trong ngày (không bao giờ giảm).
- "Đã nộp" theo quy ước sẵn có: `AttemptSkill.submittedAt` của kỹ năng chứa phần đó;
  Attempt cũ không có giờ nộp từng kỹ năng thì dùng `Attempt.submittedAt` (giống
  `lib/monthly-recap-data.ts`).

### Khoá chống trùng (`CoinTransaction.key`, unique theo học viên)

| Nguồn | Khoá | Ghi chú |
| --- | --- | --- |
| Phần của bài giao (homework/mock) | `unit:<assignmentId>:<unitId>` | Thầy reset lượt rồi HS làm lại → trùng khoá → không cộng lần 2 |
| Phần tự luyện | `practice:<unitId>` | Tự luyện cả đề rồi luyện lẻ phần đó → vẫn chỉ 1 lần. **Bỏ qua** nếu HS đã có bất kỳ dòng `unit:*:<unitId>` hoặc `practice:<unitId>` |
| Ôn Sổ từ | `vocab:<YYYY-MM-DD>` | Ngày theo giờ VN |
| Mua đồ | `buy:<itemKey>` | Mỗi món chỉ mua 1 lần |

Bài giao thầy giao **sau** khi HS đã tự luyện phần đó vẫn ra Xu (khoá `unit:` khác,
thầy chủ động giao). Sổ **không có khoá ngoại** tới Attempt/Assignment — reset lượt
(xoá cascade) không xoá dòng sổ, nên không thể cày lại bằng reset.

## 2. Dữ liệu

```prisma
// Một dòng sổ Xu. amount > 0 là cộng, < 0 là trừ.
model CoinTransaction {
  id        String   @id @default(cuid())
  studentId String
  kind      String   // earn_unit | earn_vocab | purchase  (đợt sau thêm streak_restore, reward_redeem, refund)
  key       String   // khoá chống trùng, xem bảng trên
  amount    Int
  note      String?  // "Reading Test 3 – Passage 2", "Ôn 24 thẻ", "Mua nền Cực quang"
  attemptId String?  // lượt sinh ra dòng (popup chúc mừng hiện "+N Xu"); chuỗi trơn, không khoá ngoại
  createdAt DateTime @default(now())
  student   StudentProfile @relation(fields: [studentId], references: [id], onDelete: Cascade)
  @@unique([studentId, key])
}

// Đồ học viên đang sở hữu.
model StudentItem {
  id        String   @id @default(cuid())
  studentId String
  itemKey   String   // mã trong lib/shop-catalog.ts; đồ thành tích kèm tháng: "frame:champion@2026-09"
  source    String   // purchase | achievement
  createdAt DateTime @default(now())
  student   StudentProfile @relation(fields: [studentId], references: [id], onDelete: Cascade)
  @@unique([studentId, itemKey])
}
```

`StudentProfile` thêm: `coins Int @default(0)`, `equippedBackground String?`,
`equippedFrame String?`. Cả hai `@@unique` có `studentId` đứng đầu → không cần
`@@index` riêng. Comment enum đầu schema thêm `CoinKind` và `ItemSource`.

Bảng/cột mới thêm vào **`scripts/ensure-db.mjs`** (tự áp lên prod khi build).

### Tính nhất quán số dư

Mọi thao tác ví (đồng bộ, mua) chạy trong `prisma.$transaction` tương tác và **khoá
dòng học viên trước tiên**: `SELECT id FROM "StudentProfile" WHERE id = $1 FOR UPDATE`.
Sau khi ghi sổ, đặt `coins = SUM(amount)` của học viên. Nhờ khoá dòng, hai thao tác
song song của cùng một HS chạy lần lượt → số dư luôn bằng tổng sổ, không bao giờ âm.

## 3. Đồng bộ ví (`lib/wallet.ts`)

`syncWallet(studentId, scope?)`:

1. Thu ứng viên: các phần đã nộp lượt đầu (groupBy Answer như `monthly-recap-data`,
   không tải `value`) + các ngày `VocabQuizDay` + đồ thành tích (mục 5).
   `scope = { attemptId }` chỉ quét một lượt (dùng ngay sau khi nộp cho nhanh).
2. Phần tính toán ứng viên → dòng sổ là **hàm thuần** `planCoinEntries(...)` trong
   `lib/coins.ts` (có unit test): nhận dữ liệu thô + khoá đã có, trả danh sách dòng
   cần tạo/cập nhật.
3. Transaction khoá dòng → `createMany({ skipDuplicates: true })` dòng mới, cập nhật
   tăng dòng `vocab:` của hôm nay, cấp `StudentItem` thành tích → đặt lại `coins`.

Gọi ở đâu:
- Cuối `submitSkill` (sau khi chấm xong, scope theo attempt), **bọc try/catch**: lỗi ví
  chỉ ghi log, không bao giờ chặn nộp bài.
- Cuối `answerVocabCard` (chỉ phần vocab của hôm nay), cũng try/catch.
- Đầu trang `/student/shop` (đồng bộ đầy đủ) — lưới an toàn bù mọi chỗ sót.
- Script hồi tố `scripts/coins-backfill.mjs` (hoặc `.ts` qua tsx): chạy đồng bộ đầy đủ
  cho mọi HS, in bảng số dư trước khi ghi; chạy trên DB test trước, rồi prod.

## 4. Danh mục đồ (`lib/shop-catalog.ts`)

Mỗi món: `key`, `name`, `category` (`background` | `frame`), `rarity`
(`common` | `rare` | `epic` | `legendary` | `achievement`), `price` (null = không
bán), `description?`. Hình vẽ ở component riêng theo `key`
(`components/shop/background-art.tsx`, `components/shop/frame-art.tsx`).

| Độ hiếm | Nền | Giá nền | Khung | Giá khung |
| --- | --- | --- | --- | --- |
| Thường | Trời sao · Đồng cỏ · Sóng biển · Mây hồng | 150 | Gỗ · Đồng | 200 · 300 |
| Hiếm | Hoàng hôn · Rừng tre · Thành phố đêm | 500 | Bạc · Vàng | 700 · 1.000 |
| Sử thi | Cực quang · Núi tuyết · Thư viện cổ | 1.200 | Ngọc lục bảo · Hồng ngọc | 1.500 · 2.000 |
| Huyền thoại | Thiên hà (sao lấp lánh động) | 3.000 | Phượng hoàng lửa (viền chuyển động) | 3.500 |
| Thành tích | Chuyên cần tháng M/YYYY | không bán | Quán quân tháng M/YYYY | không bán |

8 màu bìa cũ (`COVER_COLORS`) **vẫn miễn phí** như hiện nay. Khi có
`equippedBackground` thì nền thay cho màu bìa; tháo nền thì quay về màu bìa.

Hiệu ứng động chỉ bằng CSS animation, bọc `motion-safe:` (tắt khi máy bật giảm
chuyển động). SVG phải vẽ đúng trên iOS Safari 15.6 (tránh tính năng CSS mới).

## 5. Đồ thành tích tháng

- Với mỗi tháng **đã khép** từ 2026-07 tới tháng trước: lấy `getMonthlyRecap(month)`
  (tháng đã qua có cache 1 ngày). Mọi HS có `xpRank = 1` nhận
  `frame:champion@YYYY-MM`; mọi HS có `daysRank = 1` nhận `bg:diligent@YYYY-MM`.
  Đồng hạng nhất → tất cả cùng nhận. Bảng rỗng → không ai nhận.
- Cấp trong `syncWallet` (nguồn `achievement`, không ghi sổ Xu). Hàm thuần
  `achievementItemsFor(recap)` có unit test.
- Tên hiển thị kèm tháng: "Quán quân tháng 9/2026". Mỗi tháng là một món riêng, sưu
  tầm được.

## 6. Giao diện

**Học viên**
- **Chip "🪙 420"** thay nhãn "Học viên" ở sidebar (máy tính) và drawer menu (điện
  thoại) → link `/student/shop`. Thanh trên cùng của điện thoại không đủ chỗ ở khổ
  375px nên không đặt ở đó. Thêm mục "Cửa hàng" vào menu học viên. Layout HS đọc thêm
  cột `coins`, `equippedFrame`.
- **`/student/shop`** (trang server, đồng bộ ví trước khi render): cột trái = số dư,
  mục Nền / Khung / Lịch sử Xu, lọc độ hiếm; phải = lưới thẻ (điện thoại 2 cột, máy
  tính 4–5 cột). Thẻ khung xem thử ngay quanh avatar của chính HS. Nút theo trạng
  thái: **Mua 🪙 300** (hộp xác nhận) · **Trang bị** · **✓ Đang dùng** (bấm để tháo) ·
  **Thiếu 120 Xu** (mờ) · **🔒 Thành tích** (mô tả cách mở). Mua xong: hiệu ứng nhỏ +
  nút "Trang bị ngay". Kết quả hành động báo bằng toast (cơ chế ActionResult có sẵn).
- **Lịch sử Xu**: danh sách dòng sổ mới nhất trước, "+16 · Reading Test 3 – Passage 2 · 2/10".
- **Popup chúc mừng sau nộp** (`submit-celebration`) thêm dòng "+18 🪙 Xu"; lượt làm
  lại hiện "Lượt làm lại không cộng Xu". Số Xu lấy từ sổ theo attempt vừa nộp.
- **Trang bị/tháo chỉ làm ở Cửa hàng** (đơn giản hơn ô chọn trong "Sửa hồ sơ"); trang
  hồ sơ có link "Đổi nền & khung ở Cửa hàng →".

**Hiển thị đồ**
- `StudentAvatar` thêm prop tuỳ chọn `frame?: string | null` → vẽ khung SVG đè quanh
  avatar, giữ nguyên kích thước hộp (khung tràn ra ngoài bằng định vị tuyệt đối, không
  làm xô lệch hàng). Truyền `frame` ở: hồ sơ của mình + bạn cùng lớp, bảng xếp hạng
  (`class-ranking-board`, cả bục và danh sách), Tổng kết tháng (`monthly-recap-board`,
  `monthly-recap-panel`), avatar trên thanh trên cùng. Các trang làm việc của thầy
  (chấm bài, lớp, báo lỗi…) giữ avatar trơn.
- Nền thay dải bìa ở `/student/profile`, `/student/profile/[studentId]`, và trang học
  viên phía thầy.

**Giáo viên**
- Trang học viên `/teacher/students/[id]`: số dư Xu, đồ đang có, 20 dòng sổ gần nhất.
  Chỉ xem.

## 7. Server actions (`lib/actions/shop.ts`)

Mọi action bắt đầu bằng `requireStudent()`, chỉ thao tác trên chính HS đó.
- `buyItem(itemKey)`: món phải tồn tại và có `price` (đồ thành tích không mua được),
  chưa sở hữu, đủ tiền → trong transaction khoá dòng: ghi sổ `buy:<itemKey>` = −price,
  tạo `StudentItem`, đặt lại `coins`. Trả ActionResult (lỗi: "Không đủ Xu", "Đã có món
  này"…).
- `equipItem(category, itemKey | null)`: chỉ trang bị món mình sở hữu đúng loại; `null` = tháo.
- `revalidatePath` các trang hồ sơ/cửa hàng/xếp hạng liên quan.

## 8. Kiểm thử

- Unit (vitest, hàm thuần): Xu theo phần; lượt ≥2 = 0; khoá homework vs practice; bỏ
  qua practice khi đã có Xu cho phần đó; reset lượt không cộng lần 2; trần Sổ từ và
  cập nhật tăng dần; đồ thành tích (đồng hạng, bảng rỗng, chỉ tháng đã khép).
- Cấu trúc: danh mục không trùng `key`; món có giá thì giá > 0; đồ `achievement` không
  có giá; mọi `key` có hình trong component vẽ; `lib/actions/shop.ts` gọi
  `requireStudent()`; schema có model/cột mới và `ensure-db.mjs` có câu lệnh tương ứng.
- Chạy thật ở local (DB test): mua, trang bị, tháo, thiếu tiền, mua trùng; chạy script
  hồi tố trên DB test rồi mới chạy prod. Kiểm khổ 375px sáng/tối.

## Ngoài phạm vi Đợt 1

Khôi phục chuỗi, phần thưởng ngoài đời, linh vật, thầy cộng/trừ Xu tay, tặng đồ cho
bạn, bán lại đồ, đồ theo mùa có hạn bán.
