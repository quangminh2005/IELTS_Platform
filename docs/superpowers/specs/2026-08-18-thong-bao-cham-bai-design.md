# Thông báo cho học viên khi bài đã chấm xong

Ngày: 2026-08-18

## Vấn đề

Giáo viên chấm xong bài Writing/Speaking thì `Attempt.status` và
`AssignmentRecipient.status` chuyển sang `"reviewed"`, nhưng học viên không hề
biết. Muốn xem nhận xét, học viên phải tự mò vào trang Tổng quan hoặc Lịch sử và
để ý xem nhãn trạng thái có đổi không. Kết quả là nhận xét của giáo viên bị bỏ
phí.

Cần một lớp **thông báo trong web**: học viên nhìn là thấy ngay có bài vừa được
chấm, bấm vào là mở thẳng trang kết quả để đọc feedback.

## Phạm vi

Có làm:

- Chuông thông báo ở khu vực học viên, có chấm đỏ đếm số mục chưa đọc.
- Bảng thả xuống khi bấm chuông + một trang danh sách đầy đủ.
- Hai loại thông báo: **bài đã chấm xong** và **có bài mới được giao**.

Không làm (đã cân nhắc và loại):

- Gửi email khi chấm xong. Giữ nguyên phạm vi "thông báo trong web". Mail nhắc
  hạn nộp hiện có (`app/api/cron/reminders`) không đụng tới.
- Thông báo đẩy của trình duyệt (web push).
- Thông báo "bài sắp đến hạn" trong app.
- Đánh dấu đã đọc / xoá từng thông báo một.

## Hướng tiếp cận: suy ra từ dữ liệu sẵn có

Không tạo bảng `Notification`. Danh sách thông báo được **tính ra tại thời điểm
đọc**, từ hai bảng đã có sẵn dữ liệu.

Lý do chọn hướng này thay vì bảng thông báo thật:

- Không phải sửa `saveTeacherReview` hay hàm giao bài, nên không có nguy cơ
  "chấm xong mà quên ghi thông báo" — một lỗi rất khó phát hiện.
- Toàn bộ bài đã chấm / đã giao từ trước tự động có mặt trong danh sách, không
  cần script vá dữ liệu trên prod.
- Không có bảng phình dần cần dọn.

Đánh đổi chấp nhận được: không đánh dấu đã đọc từng mục (mở chuông là đọc hết),
và nếu giáo viên sửa lại nhận xét cũ thì thông báo đó nổi lên lại như mới — điều
này thực ra đúng với ý "cô vừa cập nhật nhận xét".

Nếu sau này cần đánh dấu đọc từng mục hoặc cần loại thông báo không suy ra được
từ dữ liệu (vd giáo viên nhắn tin riêng), việc chuyển sang bảng thật vẫn dễ vì
toàn bộ phần giao diện và kiểu dữ liệu `StudentNotification` giữ nguyên.

## Thay đổi lược đồ dữ liệu

Thêm đúng một cột vào `StudentProfile`:

```prisma
notificationsReadAt DateTime?
```

Ý nghĩa: mốc thời gian học viên xem chuông lần gần nhất. Mục nào có thời gian
**mới hơn** mốc này thì tính là chưa đọc.

Trên prod, cột được thêm qua `scripts/ensure-db.mjs` (chạy trong lúc build):

```sql
ALTER TABLE "StudentProfile"
  ADD COLUMN IF NOT EXISTS "notificationsReadAt" TIMESTAMP(3) DEFAULT NOW();
```

Dùng `DEFAULT NOW()` là có chủ ý: mọi học viên đang có bắt đầu ở trạng thái "đã
đọc hết", tránh việc vừa lên tính năng là chuông đỏ với hàng chục thông báo cũ.
Bài cũ vẫn nằm trong danh sách để xem lại, chỉ là không tính vào số chưa đọc.

`notificationsReadAt = null` (học viên tạo trước khi có cột, hoặc DB local chưa
có default) được xử lý như "đã đọc hết" — không dội thông báo vào người mới.

## Kiến trúc

### `lib/notifications.ts` + `lib/notifications-feed.ts` — nguồn dữ liệu

Tách làm hai tệp vì chuông là client component: `lib/notifications.ts` giữ kiểu dữ
liệu và logic thuần, **không import prisma** nên client dùng được; phần truy vấn
nằm riêng ở `lib/notifications-feed.ts`.

Kiểu chung cho một thông báo:

```ts
type StudentNotification = {
  id: string;              // "review:<attemptId>" | "assignment:<recipientId>"
  type: "review_done" | "assignment_new";
  title: string;           // tiêu đề bài giao
  detail: string | null;   // vd "Band 6.5"
  href: string;
  createdAt: Date;
  unread: boolean;
};
```

Hai truy vấn chạy song song, mỗi truy vấn lấy 30 mục gần nhất:

| Loại | Nguồn | Sắp xếp theo | Link |
|---|---|---|---|
| `review_done` | `TeacherReview` của học viên | `reviewedAt` desc | `/student/results/{attemptId}` |
| `assignment_new` | `AssignmentRecipient` của học viên | `assignedAt` desc | `/student/assignments/{recipientId}` |

Cả hai đều lọc bỏ bài tự luyện bằng `excludePracticeRecipient` /
`excludePracticeAssignment` trong `lib/practice.ts` — học viên tự bấm luyện thì
không cần ai báo.

Tách rõ hai phần để test được:

- `buildStudentNotifications(reviews, recipients, readAt)` — **hàm thuần**: gộp
  hai nguồn, sắp xếp theo `createdAt` giảm dần, cắt còn 30, đánh dấu `unread`
  cho mục có `createdAt > readAt`. Đây là phần có unit test.
- `getStudentNotifications(studentId)` (ở `notifications-feed.ts`) — chạy truy vấn
  Prisma rồi gọi hàm thuần ở trên. Trả về `{ items, unreadCount }`.
- `touchNotificationsRead(studentId)` (ở `notifications-feed.ts`) — đặt mốc đã đọc,
  dùng chung cho server action và cho trang danh sách.

### `lib/actions/notifications.ts` — đánh dấu đã đọc

Một server action `markNotificationsRead()`:

- Bắt đầu bằng `requireStudent()` (dùng lại từ `lib/actions/attempts.ts`).
- Gọi `touchNotificationsRead(student.id)` cho đúng học viên đang đăng nhập.
- Không `revalidatePath` — số đếm do chuông tự lấy qua API, revalidate chỉ làm
  nhấp nháy trang đang xem.

### `app/api/student/notifications/route.ts`

`GET` trả `{ items, unreadCount }`.

- `requireStudent()` trước tiên; không phải học viên thì trả 401.
- Gọi `warmUpDatabase()` (`lib/db-warmup.ts`) trước truy vấn chính, vì Neon có
  thể đang ngủ và route này bị gọi định kỳ vào giờ vắng.
- Lỗi bất kỳ: log rồi trả `{ items: [], unreadCount: 0 }` với HTTP 200. Chuông
  hỏng không được phép làm vỡ giao diện học viên.
- `export const dynamic = "force-dynamic"` để không bị cache.

### `components/notification-bell.tsx` (client)

- Nút chuông + chấm đỏ hiện `unreadCount`, quá 9 thì hiện `9+`.
- Lấy dữ liệu từ `/api/student/notifications`: lúc gắn vào trang, mỗi khi
  `pathname` đổi, và **60 giây một lần** khi tab đang hiện. Tab bị ẩn thì dừng
  hẹn giờ (nghe `visibilitychange`), tránh đánh thức Neon vô ích.
- Bấm chuông: mở bảng thả xuống, đồng thời gọi `markNotificationsRead()` rồi đặt
  `unreadCount = 0` ở phía client. Các mục vẫn giữ dấu "mới" cho đến lần tải
  trang sau, để học viên không mất dấu thứ vừa mở.
- Bảng thả xuống: 8 mục gần nhất; mục chưa đọc có nền nhạt và chấm màu; mỗi mục
  hiện tiêu đề, chi tiết, và thời gian tương đối ("2 giờ trước"). Cuối bảng có
  liên kết "Xem tất cả" sang `/student/notifications`.
- Rỗng thì hiện "Chưa có thông báo nào."
- Đóng khi bấm ra ngoài hoặc nhấn Esc.

### `app/student/notifications/page.tsx`

Server component: gọi `getStudentNotifications`, render danh sách đầy đủ 30 mục
bằng cùng component hiển thị một dòng thông báo, rồi gọi `markNotificationsRead()`
— việc mở trang này cũng tính là đã xem.

### `components/app-shell.tsx`

Đặt `<NotificationBell />` cạnh `<AnimatedThemeToggle />` ở **hai** chỗ: thanh
trên cùng cho điện thoại và đầu sidebar cho máy tính. Chỉ render khi
`role === "student"`.

Thêm mục "Thông báo" vào `navByRole.student`? **Không** — chuông đã ở ngay trên
đầu sidebar rồi, thêm mục menu nữa là thừa. Trang `/student/notifications` chỉ
vào từ liên kết "Xem tất cả".

## Luồng dữ liệu

```
Giáo viên bấm "Lưu nhận xét"
  → saveTeacherReview ghi TeacherReview.reviewedAt (KHÔNG đổi gì thêm)

Học viên đang mở web
  → NotificationBell hẹn giờ 60s gọi GET /api/student/notifications
  → getStudentNotifications đọc TeacherReview + AssignmentRecipient
  → buildStudentNotifications so với StudentProfile.notificationsReadAt
  → trả unreadCount = 1  →  chấm đỏ hiện lên

Học viên bấm chuông
  → markNotificationsRead() đặt notificationsReadAt = now()
  → bấm vào mục  →  /student/results/{attemptId}  →  đọc feedback
```

## Xử lý lỗi

| Tình huống | Cách xử lý |
|---|---|
| Neon ngủ / truy vấn lỗi | Route trả `{ items: [], unreadCount: 0 }`, ghi log. Chuông im lặng, không vỡ trang. |
| Chưa đăng nhập / không phải học viên | Route trả 401. Chuông không render ở khu vực giáo viên nên không gọi tới. |
| `notificationsReadAt = null` | Coi như đã đọc hết, `unreadCount = 0`. |
| Cột chưa tồn tại trên DB | `ensure-db.mjs` tạo lúc build; nếu vẫn thiếu thì truy vấn lỗi → rơi vào ô đầu bảng này. |
| `markNotificationsRead` lỗi | Bắt lỗi ở client, bỏ qua. Lần sau mở chuông sẽ thử lại. |

## Kiểm chứng

- **Unit test** `tests/notifications.test.ts` cho `buildStudentNotifications`:
  gộp đúng thứ tự thời gian, cắt đúng 30, đánh dấu `unread` đúng theo mốc,
  `readAt = null` cho ra 0 chưa đọc, bài tự luyện không lọt vào (kiểm qua dữ
  liệu đầu vào đã lọc).
- **Test cấu trúc** kiểm `scripts/ensure-db.mjs` có câu lệnh thêm cột
  `notificationsReadAt` — cùng kiểu với các test cấu trúc đang có, để không lặp
  lại lỗi "quên thêm cột vào ensure-db → prod 500".
- `pnpm test` và `pnpm build` phải xanh.
- Kiểm thật trên bản deploy: đăng nhập học viên (cần người dùng đăng nhập hộ),
  giáo viên chấm một bài, xem chuông có đỏ lên trong vòng 1 phút và bấm vào có
  mở đúng trang kết quả không.

## Tệp đụng tới

Thêm mới:

- `lib/notifications.ts`
- `lib/notifications-feed.ts`
- `components/notification-list.tsx`
- `lib/actions/notifications.ts`
- `app/api/student/notifications/route.ts`
- `app/student/notifications/page.tsx`
- `components/notification-bell.tsx`
- `tests/notifications.test.ts`

Sửa:

- `prisma/schema.prisma` — thêm cột `notificationsReadAt`
- `scripts/ensure-db.mjs` — thêm câu `ALTER TABLE` tương ứng
- `components/app-shell.tsx` — gắn chuông cho vai trò học viên
