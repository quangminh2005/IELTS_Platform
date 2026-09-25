# Thiết kế: Lịch học cho học viên (buổi học + hạn nộp)

Ngày: 2026-09-24
Trạng thái: đã triển khai (2026-09-25), kiểm trên DB test + trình duyệt (giáo viên + học viên, điện thoại, sáng/tối).

## 1. Mục tiêu

Học viên có một trang **Lịch học** xem theo tháng: hôm nào có **buổi học** và hôm nào
có **bài hết hạn nộp**. Giáo viên đặt lịch cố định hàng tuần cho từng lớp, rồi sửa
từng buổi khi cần (nghỉ, dời, chuyển online, ghi chú, thêm buổi bù/tăng cường).

Lịch thực tế hiện tại (dùng làm dữ liệu kiểm thử):

| Lớp | Lịch |
| --- | --- |
| PĐ K1 | tối Thứ 4 + Thứ 6, 20:15–21:45 |
| PĐ K2 | tối Thứ 3 20:15–21:45, sáng Thứ 7 9:00–10:30 |
| CB K1 | tối Thứ 5 + Chủ nhật, 20:00–21:30 |

Những gì đã chốt với người dùng:

- Mỗi lớp có **lịch lặp hàng tuần**, mỗi thứ trong tuần có thể có giờ khác nhau (vd PĐ K2).
- Mặc định **học trực tiếp**. Chỉ một số buổi (thời tiết xấu, học tăng cường) chuyển
  **online**, nên "online + link" là thuộc tính **của từng buổi**, không phải của lớp.
- Số buổi / ngày khai giảng / ngày kết thúc là **tuỳ chọn theo từng lớp**. Có số buổi
  thì hiện "Buổi 5/24", không có thì lịch lặp mãi.
- Bản đầu gồm cả 4 phần đi kèm: thẻ "Buổi học tới", nút hạn nộp "Trước buổi tới",
  ghi chú từng buổi, chuông báo đổi lịch.
- Đổi **lịch cố định** cũng báo chuông (một thông báo gộp cho mỗi lớp).

## 2. Cách tổ chức dữ liệu

Chọn **lịch mẫu + tạo sẵn từng buổi thành một dòng** (thay vì tính buổi "ảo" lúc hiển
thị). Lý do: sửa từng buổi chỉ là sửa đúng một dòng; số thứ tự buổi luôn đúng kể cả khi
đổi lịch giữa khoá; sau này điểm danh thì gắn thẳng vào buổi. Quy mô rất nhỏ (3 lớp ×
2 buổi/tuần), nên việc lưu vài trăm dòng không đáng kể.

### 2.1 Schema (`prisma/schema.prisma`)

Thêm vào `Class` (tất cả đều tuỳ chọn):

```prisma
  // ---- Lịch học (tuỳ chọn) ----
  // Ngày khai giảng, lưu mốc 00:00 giờ VN của ngày đó.
  scheduleStartDate   DateTime?
  // Số buổi của khoá. Có giá trị -> hiện "Buổi X/Y" và giữ đủ Y buổi có học.
  totalSessions       Int?
  // Ngày kết thúc (00:00 giờ VN, tính cả ngày đó). Dùng khi không đặt số buổi.
  scheduleEndDate     DateTime?
  // Địa điểm mặc định cho buổi trực tiếp (phòng/địa chỉ), văn bản thuần.
  location            String?
  // Lịch cố định áp dụng từ mốc này. Buổi trước mốc không bao giờ bị tạo lại tự động.
  scheduleAppliesFrom DateTime?
  // Lần gần nhất GV lưu lịch cố định -> thông báo "Lịch học lớp X vừa được cập nhật".
  scheduleChangedAt   DateTime?
  scheduleSlots       ClassScheduleSlot[]
  sessions            ClassSession[]
```

Hai bảng mới:

```prisma
// Một khung giờ trong lịch cố định hàng tuần của lớp.
model ClassScheduleSlot {
  id          String @id @default(cuid())
  classId     String
  weekday     Int    // 1 = Thứ 2 … 6 = Thứ 7, 7 = Chủ nhật (ISO)
  startMinute Int    // phút tính từ 00:00 giờ VN, vd 20:15 = 1215
  endMinute   Int
  class       Class  @relation(fields: [classId], references: [id], onDelete: Cascade)

  @@index([classId])
}

// Một buổi học cụ thể. Buổi theo lịch cố định được tạo tự động; GV sửa tay từng buổi.
model ClassSession {
  id               String    @id @default(cuid())
  classId          String
  startsAt         DateTime
  endsAt           DateTime
  status           String    @default("scheduled") // SessionStatus
  mode             String    @default("offline")   // SessionMode
  kind             String    @default("regular")   // SessionKind
  meetingUrl       String?
  note             String?
  // Giờ gốc trước khi dời. Null = chưa từng dời. Dùng để hiện "Dời từ T4 23/9"
  // và để khung giờ gốc không bị tạo lại thành một buổi trùng.
  originalStartsAt DateTime?
  // GV đã sửa tay -> không bị xoá/tạo lại khi đổi lịch cố định.
  edited           Boolean   @default(false)
  // Lần sửa tay gần nhất đáng báo cho học viên (SessionChangeKind) + thời điểm.
  changeKind       String?
  changedAt        DateTime?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
  class            Class     @relation(fields: [classId], references: [id], onDelete: Cascade)

  @@index([classId, startsAt])
}
```

Cập nhật khối chú thích enum ở đầu schema:

```
// enum SessionStatus (ClassSession.status): scheduled | cancelled
// enum SessionMode (ClassSession.mode): offline | online
// enum SessionKind (ClassSession.kind): regular | makeup | extra
// enum SessionChangeKind (ClassSession.changeKind): cancelled | restored | moved | online | offline | added
```

Các `z.enum(...)` trong action phải khớp những giá trị này.

### 2.2 Đưa lên prod

Thêm vào `scripts/ensure-db.mjs` (chạy lúc build, tự áp dụng lên prod): 6 câu
`ALTER TABLE "Class" ADD COLUMN IF NOT EXISTS …`, `CREATE TABLE IF NOT EXISTS` cho 2
bảng mới kèm khoá ngoại (`ON DELETE CASCADE`) và index, theo đúng mẫu `AttemptSkill`
đã có trong file.

### 2.3 Giờ giấc

Việt Nam cố định UTC+7, không có giờ mùa hè. Lưu `DateTime` theo UTC, đổi qua giờ VN
bằng `VN_OFFSET_MS` (`lib/streak.ts`) giống các trang hiện có. Khoá ngày dùng
`vnDateKey` (`lib/attendance.ts`).

## 3. Quy tắc tạo buổi ("đồng bộ lịch")

Toàn bộ nằm trong hàm thuần `planRegularSessions` ở `lib/class-schedule.ts`. Hàm nhận
lịch cố định, thông số lớp, danh sách buổi hiện có, mốc `applyFrom` và `now`, rồi trả
về `{ create, deleteIds }`. Server action chỉ việc thực thi kết quả trong một
`$transaction`.

1. **Buổi đóng băng** (không bao giờ bị hàm này xoá hay tạo lại):
   - buổi có `startsAt < applyFrom`,
   - buổi `edited = true`,
   - buổi `kind` là `makeup` hoặc `extra`.
2. **Buổi thay được** = buổi `regular`, chưa sửa tay, và `startsAt >= applyFrom`.
3. **Khung giờ bị chiếm**: buổi đóng băng chiếm khung giờ gốc của nó (`originalStartsAt`
   nếu đã dời, không thì `startsAt`). Hàm không tạo buổi mới vào khung đã bị chiếm, nhờ
   vậy buổi đã nghỉ hoặc đã dời không "mọc lại" thêm một bản ở giờ cũ.
4. **Buổi được đếm** = `status = scheduled` và `kind` là `regular` hoặc `makeup`.
   Buổi nghỉ và buổi `extra` (tăng cường) không được đếm.
5. **Sinh buổi mong muốn**: đi từng ngày từ `max(applyFrom, scheduleStartDate)`, mỗi
   khung giờ khớp thứ trong tuần sinh một buổi, bỏ qua khung đã bị chiếm, và dừng ở
   điều kiện đến trước trong số sau:
   - lớp có `totalSessions`: số buổi được đếm (buổi đóng băng được đếm + buổi vừa sinh)
     đạt `totalSessions`;
   - lớp có `scheduleEndDate`: qua hết ngày kết thúc;
   - lớp học liên tục (không đặt cả hai): `now + 84 ngày` (12 tuần);
   - giới hạn an toàn: tối đa 2 năm kể từ `applyFrom`.
6. **So khớp**: buổi thay được nào trùng đúng `startsAt/endsAt` với một buổi mong muốn
   thì giữ nguyên (giữ id). Buổi thay được còn thừa thì xoá, buổi mong muốn còn thiếu thì
   tạo mới.

Hệ quả (đã thống nhất với người dùng), áp dụng cho lớp có đặt số buổi:

- Cho **nghỉ** một buổi thì buổi đó không còn được đếm, nên cuối khoá tự có thêm 1 buổi.
- Thêm một buổi **học bù** (`makeup`) thì buổi đó được đếm, nên buổi cuối khoá tự rút đi.
  Nghỉ một buổi rồi dạy bù thì khoá vẫn kết thúc đúng ngày cũ.
- Buổi **tăng cường** (`extra`) không ảnh hưởng số buổi và không có số thứ tự.

**Chạy đồng bộ lúc nào** — lần nào cũng dùng `applyFrom = max(now, scheduleAppliesFrom)`,
trừ lúc lưu lịch cố định (xem mục 5.1):

- sau khi lưu lịch cố định;
- sau khi cho nghỉ, hoặc cho học lại, một buổi;
- sau khi thêm hoặc xoá buổi học bù;
- trong cron hằng ngày, để nối thêm buổi cho lớp học liên tục.

**Đánh số buổi** (`numberSessions`): sắp các buổi được đếm theo `startsAt`, đánh số
1, 2, 3… Kết quả hiện ra là "Buổi X/Y" khi lớp có `totalSessions`, và "Buổi X" khi không có.

## 4. Giao diện học viên

### 4.1 Trang `/student/calendar` (mục menu mới "Lịch học")

- Thêm vào `navByRole.student` trong `components/app-shell.tsx`, ngay dưới "Tổng quan",
  icon `calendar` (đã có sẵn). Nhãn "Lịch học", gợi ý "Buổi học & hạn nộp".
- Server component. Tham số `?m=YYYY-MM` (tháng đang xem, mặc định tháng hiện tại theo
  giờ VN) và `?d=YYYY-MM-DD` (ngày đang chọn, mặc định hôm nay nếu thuộc tháng đang
  xem, không thì ngày 1). Chuyển tháng bằng link ◀ ▶ và nút "Hôm nay", giống lịch
  chuyên cần ở Hồ sơ.
- **Lưới tháng** bắt đầu Thứ 2. Trên điện thoại, mỗi ô chỉ hiện số ngày và tối đa 3 chấm:
  - xanh dương = buổi học (chấm rỗng nếu buổi đó nghỉ);
  - cam = hạn nộp, chưa nộp;
  - đỏ = đã quá hạn mà chưa nộp;
  - xanh lá = hạn nộp, đã nộp.

  Trên màn `sm` trở lên, ô rộng hơn nên thay chấm bằng chữ ngắn ("20:15 PĐ K1",
  "Hạn: Cam 18…"). Ô hôm nay có viền tròn, ô đang chọn được tô nền nhấn. Có chú thích
  màu ở dưới lưới.
- **Danh sách việc của ngày đang chọn**: nằm dưới lưới trên điện thoại, cột phải trên
  máy tính. Sắp theo giờ. Bấm ngày khác chỉ đổi trạng thái phía client (component
  client nhận toàn bộ sự kiện của tháng), rồi cập nhật `?d=` bằng `history.replaceState`.
- **Thẻ buổi học**:
  - giờ bắt đầu–kết thúc · tên lớp · "Buổi X/Y";
  - nhãn *Trực tiếp* kèm `location` của lớp (nếu có), hoặc nhãn *Online* kèm nút
    **Vào lớp** (`target="_blank" rel="noopener noreferrer"`). Nút này luôn hiện; từ
    15 phút trước giờ học đến lúc kết thúc thì đổi sang kiểu nhấn mạnh;
  - buổi nghỉ: gạch ngang giờ, nhãn "Nghỉ", ghi chú hiện như lý do nghỉ;
  - buổi đã dời: có dòng "Dời từ T4 23/9 20:15";
  - buổi `makeup` có nhãn "Học bù", buổi `extra` có nhãn "Tăng cường";
  - ghi chú là văn bản thuần (`whitespace-pre-line`), không dùng `dangerouslySetInnerHTML`.
- **Thẻ hạn nộp**: giờ hạn · tên bài · `SkillTags` · trạng thái (Chưa làm / Đang làm /
  Đã nộp / Nộp trễ / Quá hạn) · nút Làm bài / Xem lại. Dùng lại đúng logic của
  `app/student/page.tsx` (`isSubmissionLate`, `OverdueBadge`/`LateBadge`,
  `statusBadgeClasses`). Loại bài tự luyện bằng `excludePracticeAssignment`.
- Học viên ở nhiều lớp thấy buổi của tất cả các lớp; mỗi thẻ đều ghi tên lớp.
- Trường hợp trống:
  - lớp chưa đặt lịch: hiện dòng "Lớp của bạn chưa có lịch học — giáo viên sẽ cập nhật
    sớm", lịch vẫn hiện hạn nộp;
  - ngày không có việc gì: "Không có buổi học hay hạn nộp nào."

**Dữ liệu cần lấy**: các lớp của học viên (`ClassStudent`); **toàn bộ** buổi của những
lớp đó (chỉ `select` cột nhẹ; cần đủ để đánh số buổi, quy mô vài trăm dòng); các
`AssignmentRecipient` có `deadline` nằm trong khoảng của lưới đang hiện.

### 4.2 Thẻ "Buổi học tới" trên `/student`

- Một dòng gọn đặt **trên** khối "Bài được giao".
  Ví dụ: `📅 Tối nay 20:15 · PĐ K1 · Buổi 6/24 — 2 bài cần nộp trước buổi này · [Xem lịch]`.
- Chọn buổi bằng `findNextSession`: buổi `scheduled` đầu tiên có `endsAt > now`. Nếu
  `startsAt <= now` thì hiện "Đang diễn ra".
- Nhãn ngày:
  - cùng ngày: "Sáng nay" (trước 12:00), "Chiều nay" (trước 18:00), "Tối nay" (còn lại);
  - ngày hôm sau: "Ngày mai";
  - trong 6 ngày tới: "Thứ 6 26/9";
  - xa hơn: "T6 26/9".
- "Bài cần nộp trước buổi này" = bài chưa nộp có `now < deadline <= startsAt`. Bằng 0
  thì bỏ đoạn đó.
- Buổi online thì có nút **Vào lớp** ngay trên thẻ.
- Học viên không có buổi nào sắp tới thì ẩn thẻ.

### 4.3 Chuông thông báo

Thêm 2 loại vào `StudentNotificationType` (`lib/notifications.ts`), vẫn **suy ra từ dữ
liệu**, không thêm bảng Notification:

- `session_change` — nguồn là `ClassSession` có `changeKind` khác null. Id
  `session:<id>`, `createdAt = changedAt`, bấm vào mở `/student/calendar?m=…&d=<ngày buổi học>`.
  - `cancelled`: "Nghỉ học buổi T6 26/9 (PĐ K1)"
  - `moved`: "Buổi T6 26/9 (PĐ K1) dời sang T7 27/9 20:15"
  - `restored`: "Buổi T6 26/9 (PĐ K1) học lại như lịch" (đã báo nghỉ rồi cho học lại)
  - `online`: "Buổi T6 26/9 (PĐ K1) chuyển học online"
  - `offline`: "Buổi T6 26/9 (PĐ K1) chuyển về học trực tiếp"
  - `added`: "Thêm buổi học bù T2 29/9 20:15 (PĐ K1)" (với `extra`: "Thêm buổi tăng cường…")
- `schedule_update` — nguồn là `Class.scheduleChangedAt`. Id
  `schedule:<classId>:<ms>`, nội dung "Lịch học lớp PĐ K1 vừa được cập nhật", bấm vào
  mở `/student/calendar`.
- Chỉ báo những thay đổi xảy ra **sau** `ClassStudent.joinedAt` của học viên.
- Đọc / chưa đọc dùng `notificationsReadAt` như các loại hiện có. Mỗi nguồn lấy tối đa
  `NOTIFICATION_LIMIT` bản ghi mới nhất.
- `components/notification-list.tsx` thêm icon/màu cho 2 loại mới theo mẫu các loại đang có.

## 5. Phía giáo viên

### 5.1 Khối "Lịch học" trong `/teacher/classes/[classId]`

Thêm một khối mới dưới danh sách học viên, gồm 2 phần.

**a. Lịch cố định** — client component `components/class-schedule-form.tsx`, gửi qua
`ActionForm` (cơ chế toast A):

- Danh sách khung giờ: [Thứ ▾] [giờ bắt đầu] → [giờ kết thúc] [✕], cùng nút "+ Thêm khung giờ".
- Ngày khai giảng; **Số buổi** hoặc **Ngày kết thúc** (chọn một trong hai; bỏ trống cả
  hai nghĩa là học liên tục); địa điểm mặc định.
- **Áp dụng từ**:
  - lớp chưa có buổi nào: mặc định là ngày khai giảng, để các buổi đã qua từ lúc khai
    giảng cũng được tạo (cần cho số thứ tự buổi);
  - lớp đã có buổi: mặc định là hôm nay.
- Nút **Lưu lịch**. Action `saveClassSchedule` làm các việc sau:
  1. thay toàn bộ `ClassScheduleSlot` của lớp;
  2. cập nhật các cột lịch của `Class`, đặt `scheduleAppliesFrom` = mốc 00:00 giờ VN của
     ngày "Áp dụng từ" và `scheduleChangedAt = now`;
  3. chạy `planRegularSessions` với `applyFrom` bằng chính mốc đó (mốc này có thể nằm
     trong quá khứ; nếu vậy, buổi quá khứ chưa sửa tay được tạo lại theo lịch mới, còn
     buổi đã sửa tay vẫn đóng băng như thường);
  4. làm tất cả trong một `$transaction`.

**b. Danh sách buổi**:

- "Sắp tới" hiện 8 buổi, có nút "Xem thêm"; "Đã qua" thu gọn mặc định.
- Mỗi dòng: `T4 23/9 · 20:15–21:45 · Buổi 5/24 · Trực tiếp` + ghi chú rút gọn + nút **Sửa**.
- **Sửa** mở khung sửa (overlay portal ra `body`, xem bẫy `animate-fade-in`) với các ô:
  - Có học / Nghỉ;
  - ngày + giờ bắt đầu/kết thúc;
  - Trực tiếp / Online + link;
  - ghi chú.

  Action `updateClassSession`:
  - validate bằng zod:
    - `meetingUrl` phải là `http(s)://` và bắt buộc khi `mode = online`;
    - ghi chú tối đa 500 ký tự;
    - `endsAt > startsAt`;
  - đặt `edited = true`;
  - lần đầu đổi giờ thì ghi `originalStartsAt` (lần dời sau giữ nguyên giá trị gốc);
  - nếu buổi **chưa diễn ra** (`startsAt` cũ `> now`), ghi `changeKind` theo thay đổi
    quan trọng nhất (`cancelled` > `restored` > `moved` > `online` > `offline`) và
    `changedAt = now`:
    - `cancelled`: có học → nghỉ; `restored`: nghỉ → có học;
    - `moved`: đổi ngày/giờ;
    - `online` / `offline`: đổi hình thức;
    - chỉ đổi ghi chú hoặc link thì không ghi `changeKind`;
  - nếu trạng thái có học/nghỉ thay đổi thì chạy lại đồng bộ lịch.
- **+ Thêm buổi**: ngày, giờ, loại (**Học bù** / **Tăng cường**), hình thức, link, ghi
  chú. Action `addClassSession`:
  - tạo buổi `makeup` hoặc `extra` với `edited = true`;
  - buổi trong tương lai thì ghi `changeKind = added`;
  - loại `makeup` thì chạy lại đồng bộ lịch.
- **Xoá** chỉ có cho buổi `makeup` / `extra`, qua action `deleteClassSession`, có hộp
  xác nhận. Buổi theo lịch cố định thì chỉ cho "Nghỉ", không cho xoá.

Mọi action nằm trong `lib/actions/class-schedule.ts`:

- gọi `requireTeacher()` trước tiên;
- mọi truy vấn đều lọc `class.teacherId = teacher.id`;
- sau khi ghi thì `revalidatePath` các trang `/teacher/classes/[id]`, `/student`,
  `/student/calendar`.

### 5.2 Chip hạn nộp "Trước buổi học tới"

- `app/teacher/assignments/page.tsx` lấy buổi `scheduled` sớm nhất có `startsAt > now`
  của **mỗi lớp**, rồi truyền xuống `AssignmentBuilder`. Builder chuyển tiếp cho
  `DueDateField`.
- `DueDateField` nhận thêm prop `sessionPicks`. Mỗi lớp một chip:
  `Trước buổi PĐ K1 · T4 23/9 20:15`.
- Bấm chip thì điền **cả ngày lẫn giờ** hạn nộp bằng giờ bắt đầu buổi đó. Hiện ô giờ
  `dueTime` là input không kiểm soát nằm ngay trong `AssignmentBuilder` (không phải
  client component). Cách làm: tạo client component mới `DueDateTimeInputs` thay cho
  cụm hai ô "Ngày / Giờ" trong builder. Component này giữ giờ bằng state có kiểm soát
  và render `DueDateField`. `DueDateField` nhận thêm `sessionPicks` và callback
  `onPickTime`: bấm chip thì nó tự đặt ngày, rồi gọi `onPickTime(giờ)`. Form sửa bài
  không truyền các prop này nên giữ nguyên như cũ.
- Hiện chip của **mọi lớp**, không lọc theo học viên đang chọn: với 3 lớp thì gọn, và
  không phải nối trạng thái giữa các bước của trình giao bài.

### 5.3 Cron hằng ngày

Trong `app/api/cron/reminders/route.ts`:

- gọi `topUpClassSessions()` ngay sau `warmUpDatabase`, **trước** chỗ kiểm tra cấu hình
  email (chỗ đó `return` sớm);
- bọc trong try/catch riêng để lỗi nối lịch không chặn việc gửi mail nhắc bài.

`topUpClassSessions` chạy đồng bộ lịch cho các lớp học liên tục có lịch cố định. Việc
nối thêm này không tạo thông báo.

## 6. Các hàm thuần (`lib/class-schedule.ts`)

File này không phụ thuộc Prisma/React và được test đầy đủ:

- `parseHm("20:15") → 1215`, `formatHm(1215) → "20:15"`
- `vnDateTime(ymd, minute) → Date` (UTC)
- `planRegularSessions(input) → { create, deleteIds }` — mục 3
- `numberSessions(sessions) → Map<id, number>`
- `findNextSession(sessions, now)`
- `relativeSessionLabel(startsAt, now)` — "Tối nay 20:15", "Ngày mai 09:00", "Thứ 6 26/9 20:15" (giờ luôn 2 chữ số)
- `buildMonthGrid(monthKey, sessions, deadlines)` — ô lưới, sự kiện theo ngày, chấm màu
- `sessionChangeText(session, className)` — câu thông báo cho `session_change`
- `isValidMeetingUrl(url)`
- `WEEKDAY_LABELS` (T2…CN / Thứ 2…Chủ nhật)

Để chạy được trên trình duyệt cũ (iOS 15.6, xem `browserslist`), không dùng
`toSorted`/`toReversed`/`Array.prototype.findLast`… trong code chạy phía client.

## 7. Kiểm thử

Viết test vitest **trước** (TDD), trong `tests/class-schedule.test.ts`:

- `planRegularSessions`:
  - lịch PĐ K2 (T3 tối + T7 sáng) từ 1/9 sinh đúng ngày/giờ UTC;
  - lớp 24 buổi dừng đúng ở buổi thứ 24;
  - cho nghỉ 1 buổi → cuối khoá thêm 1 buổi;
  - thêm học bù → cuối khoá bớt 1 buổi;
  - buổi `extra` không đổi số buổi;
  - buổi đã dời không mọc lại ở giờ gốc;
  - buổi đã sửa tay và buổi trước `applyFrom` không bị xoá khi đổi lịch;
  - lớp học liên tục dừng ở `now + 84 ngày`;
  - lớp có `scheduleEndDate` gồm cả ngày kết thúc;
  - chạy lại lần hai không đổi gì (idempotent: `create` và `deleteIds` đều rỗng).
- `numberSessions`: bỏ qua buổi nghỉ và buổi `extra`, đếm buổi `makeup`.
- `findNextSession`: buổi đang diễn ra, bỏ qua buổi nghỉ, không có buổi nào.
- `relativeSessionLabel`: Sáng/Chiều/Tối nay, Ngày mai, thứ trong tuần, xa hơn; chuyển
  ngày theo giờ VN (vd 23:30 UTC).
- `buildMonthGrid`: số ô trống đầu tháng, chấm đúng màu theo trạng thái bài, buổi nghỉ.
- Thông báo: `buildStudentNotifications` có thêm 2 nguồn mới, lọc theo `joinedAt`, trạng
  thái đọc/chưa đọc, nội dung câu.
- Test cấu trúc: `schema.prisma` có 2 model mới cùng các dòng chú thích enum.

Kiểm thủ công trên trình duyệt trong app (DB test local):

- nhập lịch 3 lớp như bảng ở mục 1;
- cho nghỉ / dời / chuyển online / thêm học bù một buổi;
- xem Lịch học, thẻ Buổi học tới và chuông ở khổ điện thoại 375px (mẹo zoom), giao
  diện sáng và tối;
- giao bài bằng chip "Trước buổi tới".

## 8. Ngoài phạm vi bản này

- Điểm danh từng buổi (sau này gắn vào `ClassSession.id`).
- Hiện buổi học trên trang "Lịch giao bài" của giáo viên.
- Đồng bộ vào lịch điện thoại (link iCal / Google Calendar). Đây là việc nên làm tiếp
  theo: điện thoại tự nhắc giờ học và hạn nộp mà học viên không cần mở web.
- Mail nhắc giờ học.
- Chip "Trước buổi tới" trong form **sửa** bài giao (bản này chỉ có ở form tạo bài).
