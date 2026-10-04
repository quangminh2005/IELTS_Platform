# Xu — Đợt 4: Chuỗi ngày + Linh vật

Ngày: 4/10/2026 · Tiếp nối [Đợt 1](2026-10-03-xu-cua-hang-dot-1-design.md), [Đợt 2](2026-10-03-xu-dot-2-khoi-phuc-chuoi-design.md), [Đợt 3](2026-10-04-xu-dot-3-doi-qua-design.md).

Hai phần, làm theo thứ tự: Phần 1 (chuỗi ngày) là nền cho điều kiện "hoặc chuỗi N ngày" của linh vật ở Phần 2.

---

## Phần 1 — Chuỗi ngày thay chuỗi tuần

### Luật (thầy đã chốt)

- **Một chuỗi duy nhất** cho cả trường: chuỗi ngày 🔥. Bỏ chuỗi tuần, bỏ chuỗi riêng "ôn liên tiếp" ở phía học viên (trang chủ thẻ Từ vựng, trang Từ vựng).
- **Ngày có học** (giờ VN, 0h–24h) = nộp ≥ 1 phần kỹ năng (bài giao hoặc tự luyện, mọi lượt kể cả luyện lại) **hoặc** ôn ≥ 1 thẻ Sổ từ. Đúng định nghĩa "Lịch chăm học" (`lib/activity-heatmap.ts` `buildActivityDays`).
- **Chuỗi** = số ngày có học liên tiếp tính lùi từ hôm nay. Hôm nay chưa học → không tính đứt (grace), đếm từ hôm qua.
- Tính **hồi tố** từ dữ liệu sẵn có — không có bảng/cột mới.
- **Khôi phục**: chỉ cứu **hôm qua**, chỉ trong **hôm nay**; điều kiện hôm qua chưa học + chưa cứu, hôm kia có học (hoặc đã cứu). Giá `100 × 2^(k−1)` theo số lần cứu trong tháng VN (đếm mọi dòng `streak_restore`, kể cả các lần cứu tuần cũ). Ngày đã cứu tính là "có học" **cho chuỗi** (cả 🔥 lẫn số "ngày liền hiện tại" ở Lịch chăm học), nhưng không tô ô Lịch chăm học, không ra XP/Xu.
- Phía thầy: ẩn ô chỉ tiêu bài/tuần ở thẻ lớp. Cột `Class.weeklyGoal` + action giữ nguyên (không xoá dữ liệu). Bảng thống kê Từ vựng của thầy giữ cột chuỗi ôn từ như cũ (là số đo riêng của Sổ từ).

### Lưu trữ

Mỗi lần cứu = một dòng `CoinTransaction` `kind = streak_restore`, `key = restore-day:<YYYY-MM-DD>` (ngày được cứu), `amount = -giá`, `note = "Khôi phục chuỗi ngày 3/10"`. Prefix mới để khoá tuần cũ `restore:<Thứ 2>` không bị đọc nhầm thành ngày. `@@unique([studentId, key])` chặn trừ hai lần.

### Code

- **`lib/day-streak.ts` (thuần)** — thay phần chuỗi tuần trong `lib/streak.ts`:
  - `calculateDayStreak({ activeDays: string[], restoredDays: string[], today })` → `{ days, activeToday }`.
  - `dayStreakRestoreOffer({ activeDays, restoredDays, today })` → `{ dayKey, lostDays } | null`.
  - `streakRestorePrice(used)` (giữ), `dayRestoreKey(dateKey)`, `restoredDayOf(key)`, `formatDayShort("2026-10-03") → "3/10"`.
- **`lib/day-streak-data.ts`** `getDayStreak(studentId, now, db)` → `{ streak, offer, price, coins }` — MỘT nguồn cho trang chủ, Hồ sơ, trang Từ vựng, action khôi phục, action mở tư thế. Đọc `AttemptSkill.submittedAt` + `Attempt.submittedAt` (bài cũ không có giờ từng kỹ năng) + `VocabQuizDay` (total ≥ 1) trong 400 ngày gần nhất + các dòng `streak_restore`.
- Hàm dựng tập ngày có học dùng chung với Lịch chăm học (tách `activeDayKeys` từ `buildActivityDays`). `summarizeActivity` nhận thêm `restoredDays` chỉ để tính `currentStreak`.
- `lib/actions/streak.ts` `restoreStreak()` dùng `getDayStreak(student.id, now, tx)` sau `lockStudent`.
- `components/streak-badge.tsx` viết lại cho ngày: "Chuỗi N ngày" + "Hôm nay đã học ✓" / "Hôm nay chưa học — nộp 1 bài hoặc ôn 1 thẻ để giữ chuỗi"; khi có offer: "Chuỗi N ngày đã đứt — hôm qua (3/10) chưa học. Khôi phục trước 24h hôm nay." Nhận thêm slot linh vật (Phần 2).
- Hồ sơ: "Chuỗi tuần" → "Chuỗi ngày". `getVocabSidebar` bỏ `streakDays`; trang chủ + trang Từ vựng lấy số từ `getDayStreak`.
- Xoá `calculateWeekStreak`, `streakRestoreOffer` tuần, `lib/streak-data.ts`; `lib/streak.ts` chỉ còn tiện ích tuần mà nơi khác còn dùng (`VN_OFFSET_MS`, `vnWeekStart`).
- Thẻ lớp phía thầy: bỏ form chỉ tiêu tuần.

---

## Phần 2 — Linh vật

### Luật (thầy đã chốt)

- Kiểu chin: **mua con** bằng Xu (kèm sẵn tư thế "Đứng yên"), rồi **mở từng tư thế** bằng Xu; tư thế cao có thêm đường **"hoặc chuỗi N ngày"** (chuỗi **hiện tại** ≥ N lúc bấm mở; mở rồi giữ mãi). Phải có con mới mở được tư thế (kể cả đường chuỗi). Học viên **tự chọn** tư thế trang bị (một linh vật + một tư thế tại một thời điểm).
- 4 con × 6 tư thế:

| Con | Mã | Giá | Độ hiếm | Tư thế đinh |
|---|---|---|---|---|
| Cú Thông Thái | `owl` | 600 | Hiếm | Tốt nghiệp (mũ + cuộn bằng) |
| Mèo Cam | `cat` | 600 | Hiếm | Đeo tai nghe |
| Cáo Lanh Lợi | `fox` | 1.000 | Sử thi | Thám tử (kính lúp) |
| Rồng Con | `dragon` | 2.000 | Huyền thoại | Phun lửa |

| Tư thế | Mã | Giá | Hoặc chuỗi |
|---|---|---|---|
| Đứng yên | `idle` | kèm con | — |
| Vẫy tay | `wave` | 100 | — |
| Đọc sách | `read` | 150 | — |
| Nhảy mừng | `cheer` | 250 | — |
| Ngủ gật | `sleep` | 400 | 15 ngày |
| (tư thế đinh) | `signature` | 800 | 30 ngày |

- Mỗi tư thế có hoạt ảnh CSS lặp nhẹ (chỉ trong `motion-safe`).
- Hiện ở: **bìa hồ sơ** (góc phải dưới, cả khi bạn xem), **thẻ 🔥 trang chủ** (con nhỏ bên phải), **trang học viên phía thầy** (khối Xu & trang trí, chỉ xem). Chưa trang bị → không hiện gì.

### Lưu trữ

- `StudentItem`: `mascot:<id>` (source `purchase`), `pose:<id>:<pose>` (source `purchase` | `streak`). Tư thế `idle` không có dòng — có con là có. Thêm `streak` vào comment `enum ItemSource`.
- Sổ Xu: mua con `buy:mascot:owl`, mở tư thế bằng Xu `buy:pose:owl:wave` (`kind = purchase`). Mở bằng chuỗi không ghi sổ.
- Cột mới **`StudentProfile.equippedMascot String?`** = mã tư thế đang dùng (`pose:owl:wave`, `pose:owl:idle`). Thêm vào `scripts/ensure-db.mjs`.

### Code

- **`lib/mascots.ts` (thuần)**: `MASCOTS`, `MASCOT_POSES`, `mascotKey(id)`, `poseKey(id, pose)`, `resolvePose(key)`, `poseName(mascot, pose)` (tư thế đinh lấy tên riêng của con), `ownsPose(owned, key)` (idle = có con).
- **`lib/actions/mascot.ts`**: `buyMascot`, `unlockPose` (`via: coins | streak`), `equipMascot` (chuỗi rỗng = tháo). Mỗi action `requireStudent()` đầu tiên; mua/mở trong `$transaction` + `lockStudent` + `recomputeCoins` (không increment).
- **`components/shop/mascot-art.tsx`**: `<MascotArt mascot pose className animate? />` — SVG viewBox 200×200, mỗi con vẽ thành bộ phận rời (thân, đầu, mắt theo biểu cảm, tay/cánh, đuôi, chân); tư thế = xoay/dịch bộ phận + đạo cụ + biểu cảm; hoạt ảnh gắn class `animate-mascot-*` (keyframes trong `tailwind.config.ts`) lên từng bộ phận. Không `defs`/`id` (nhiều bản trên một trang).
- **`components/shop/mascot-section.tsx`** (client): khối một con trong tab Linh vật — xem trước to bên trái, hàng "Chọn tư thế (6)" bên phải (vuốt ngang trên điện thoại); bấm ô = xem thử; nút 2 bước Mua con / Mở khoá (Xu hoặc chuỗi) / Trang bị / Tháo.
- Cửa hàng: tab `mascot` "Linh vật" (giữa Khung và Quà). `ProfileHero` nhận `mascotKey`; `StreakBadge` nhận `mascotKey`; `StudentWalletSummary` hiện linh vật.

### Kiểm thử

- `tests/day-streak.test.ts`: chuỗi ngày (grace hôm nay, ngày cứu nối chuỗi, ranh giới giờ VN), offer (chỉ hôm qua, cần hôm kia), giá.
- `tests/mascots.test.ts`: 4 con × 6 tư thế, giá theo bảng, `resolvePose` từ chối mã lạ, idle sở hữu ngầm, art có đủ mọi con + tư thế.
- `tests/wallet-guard.test.ts`: restoreStreak dùng `getDayStreak`; action linh vật `requireStudent` trước + `lockStudent` + không increment; `equippedMascot` có trong ensure-db; `streak` trong comment ItemSource.
- Kiểm thật local vai học viên (JWT tự ký), cả khổ điện thoại; rồi push và kiểm prod.
