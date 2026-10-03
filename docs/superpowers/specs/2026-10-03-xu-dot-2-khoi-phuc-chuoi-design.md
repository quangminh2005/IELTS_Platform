# Xu — Đợt 2: Khôi phục chuỗi tuần bằng Xu

Ngày: 3/10/2026 · Tiếp nối [Đợt 1](2026-10-03-xu-cua-hang-dot-1-design.md).

## Mục tiêu

Học viên lỡ một tuần (không đủ chỉ tiêu `Class.weeklyGoal`) có thể bỏ Xu ra "cứu" tuần đó để chuỗi tuần 🔥 không đứt — giống "Khôi phục chuỗi" của chin.edu.vn. Chỉ áp dụng cho **chuỗi tuần**, không cho chuỗi ngày Từ vựng.

## Luật (thầy đã chốt)

- **Chỉ cứu tuần liền trước** (T−1), và chỉ trong **tuần hiện tại** (T2–CN giờ VN). Lỡ tuần 22–28/9 → cứu được tới 23:59 CN 5/10.
- **Chỉ khi có chuỗi để cứu**: T−1 chưa đạt và chưa được cứu, đồng thời T−2 đạt (học thật hoặc đã cứu). Lỡ ≥ 2 tuần liền → mất chuỗi, không cứu được.
- Tuần đã cứu được coi là **đạt** vĩnh viễn (kể cả khi thầy đổi chỉ tiêu tuần sau đó).
- **Giá tăng dần trong tháng**: lần cứu thứ k trong tháng (giờ VN, theo thời điểm bấm cứu) giá `100 × 2^(k−1)` → 100 / 200 / 400 / 800… Ngày 1 mỗi tháng quay về 100. Không giới hạn cứng.
- Phía thầy: chỉ xem (dòng sổ tự hiện ở "Sổ Xu" trang học viên). Không có nút cứu miễn phí.

## Lưu trữ — dùng chính sổ Xu, không đổi schema

Mỗi lần cứu = một dòng `CoinTransaction`:

| cột | giá trị |
|---|---|
| `kind` | `streak_restore` (thêm vào comment `enum CoinKind` đầu schema + type `CoinKind` ở `lib/coins.ts`) |
| `key` | `restore:<YYYY-MM-DD>` — ngày Thứ 2 (giờ VN) của tuần được cứu |
| `amount` | `-giá` |
| `note` | `Khôi phục chuỗi tuần 22/9–28/9` |

- Tuần đã cứu = các dòng có key `restore:` của học viên.
- Số lần cứu trong tháng = số dòng `kind = streak_restore` có `createdAt` thuộc tháng VN hiện tại.
- `@@unique([studentId, key])` chặn trừ hai lần cho cùng một tuần. Sổ không bao giờ bị xoá dòng nên dữ liệu bền.

## Code

**`lib/streak.ts` (thuần)**
- `weekKeyToDateKey(weekKey: number): string` — khoá tuần → `"YYYY-MM-DD"` (khoá là nửa đêm UTC của ngày Thứ 2 VN nên `toISOString().slice(0,10)` là đúng).
- `calculateWeekStreak` nhận thêm `restoredWeeks?: string[]` (dateKey); tuần có trong đó coi như đạt.
- `streakRestoreOffer({ submittedAt, weeklyGoal, restoredWeeks, now })` → `{ weekKey: string; lostWeeks: number } | null`. `lostWeeks` = độ dài chuỗi kết thúc ở T−2 (số tuần sẽ được giữ).
- `streakRestorePrice(usedThisMonth: number)` → `100 * 2 ** used`.
- `restoreKey(dateKey)` → `"restore:" + dateKey`; `formatWeekRange(dateKey)` → `"22/9–28/9"`.

**`lib/streak-data.ts` (mới)** — `getWeekStreak(studentId, now)`, một nguồn cho trang chủ, trang Hồ sơ và action:
- lượt nộp: mọi lượt (mọi vòng) có `submittedAt` khác null, status `submitted|reviewed`;
- chỉ tiêu: lớp mới vào nhất, null → 3;
- tuần đã cứu + số lần cứu trong tháng từ `CoinTransaction`;
- trả về `{ streak, offer, price, coins }`.
- Sửa lệch hiện có: trang Hồ sơ đang chỉ đếm lượt 1 và mặc định chỉ tiêu 1 → chuyển sang dùng hàm này.

**`lib/actions/streak.ts` (mới)** — `restoreStreak(formData): Promise<ActionResult>`:
- `requireStudent()` đầu tiên; client KHÔNG gửi tuần — server tự tính offer;
- trong `$transaction`: `lockStudent` → đọc lại dữ liệu → không có offer thì báo lỗi → tính giá → thiếu Xu thì báo lỗi → tạo dòng sổ → `recomputeCoins`;
- `revalidatePath` trang chủ, hồ sơ, layout học viên (chip Xu).

**`components/streak-badge.tsx`** — thêm props `restore?: { lostWeeks; weekLabel; price; coins }`. Khi có: thẻ viền cam, "Chuỗi N tuần đã đứt tuần 22/9–28/9", nút "Khôi phục · 🪙 100" → bấm lần 2 xác nhận (kiểu `ShopItemCard`, không `window.confirm`); thiếu Xu → nút mờ + "Thiếu N Xu". Phần nút là client component nhỏ `components/streak-restore-button.tsx`.

## Kiểm thử

- `tests/streak.test.ts`: tuần đã cứu được đếm; offer null khi T−1 đạt / T−2 không đạt / T−1 đã cứu; `lostWeeks` đúng; giá 100/200/400; ranh giới tuần giờ VN.
- `tests/wallet-guard.test.ts`: `restoreStreak` mở đầu bằng `requireStudent`, có `lockStudent` + `recomputeCoins`, không nhận tuần từ form; schema comment có `streak_restore`.
- Local: tạo dữ liệu học viên giả lỡ tuần, bấm cứu, kiểm số dư + chuỗi. Prod: kiểm bằng Chrome.
