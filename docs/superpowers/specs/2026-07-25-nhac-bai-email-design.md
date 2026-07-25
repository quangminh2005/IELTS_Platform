# Mail nhắc bài sắp hết hạn — Thiết kế

**Ngày:** 2026-07-25
**Trạng thái:** Đã duyệt thiết kế với giáo viên (chờ triển khai)

## Mục tiêu

Hiện học sinh chỉ biết mình có bài khi tự mở web, và `Assignment.deadline` mới
chỉ để hiển thị — không có gì nhắc. Thêm **một loại mail duy nhất**: mỗi trưa
12h (giờ VN), gửi cho những học sinh còn bài sắp hết hạn mà chưa nộp.

Mục tiêu là tăng tỉ lệ hoàn thành bài, không phải xây hệ thống thông báo tổng
quát. Mọi thứ ngoài phạm vi đó bị loại khỏi đợt này (xem [Ngoài phạm vi](#ngoài-phạm-vi)).

## Quyết định thiết kế đã chốt

| Câu hỏi | Quyết định |
|---|---|
| Kênh gửi | **Chỉ email.** Mọi học sinh đăng nhập bằng Google nên `StudentProfile.email` luôn hợp lệ; không cần xin quyền, không cần học sinh cài gì |
| Loại mail | **Chỉ một loại:** sắp hết hạn mà chưa làm. Không mail "có bài mới", không mail "đã quá hạn", không mail "đã chấm xong" |
| Thời điểm | **12h trưa VN mỗi ngày**, một lần (`0 5 * * *` UTC) |
| Nhà cung cấp | **SMTP Gmail của giáo viên** qua `nodemailer` + App Password — vì web chưa có tên miền riêng, mà Resend cần tên miền đã xác thực mới gửi được tới địa chỉ bất kỳ |
| Gộp mail | **Một mail cho mỗi học sinh**, liệt kê mọi bài sắp hết hạn. Ba bài không thành ba mail |
| Chống gửi trùng | Một cột mới `AssignmentRecipient.reminderSentAt` |

### Vì sao Gmail SMTP thay vì Resend

Resend (và mọi dịch vụ email giao dịch) chỉ cho gửi tới địa chỉ tuỳ ý sau khi đã
xác thực một tên miền. Web đang ở `.vercel.app` nên chưa làm được. Gửi qua Gmail
của giáo viên vừa miễn phí vừa có hai điểm lợi thật:

- Học sinh thấy mail đến từ đúng địa chỉ của cô/thầy → tin ngay, ít vào spam.
- Học sinh bấm Trả lời thì thư về hộp thư của giáo viên, không rơi vào no-reply.

Giới hạn Gmail là 500 mail/ngày; lớp hiện tại dùng dưới 1%. Nếu sau này có tên
miền riêng thì chỉ cần thay phần trong `lib/email.ts`, phần còn lại không đổi.

## Kiến trúc

Ba phần rời nhau, ranh giới rõ để sửa phần này không vỡ phần kia:

```
app/api/cron/reminders/route.ts   ← điều phối: xác thực, query DB, ghi kết quả
  └─ lib/reminders.ts             ← logic thuần: chọn ai, gộp theo em, soạn nội dung
  └─ lib/email.ts                 ← chỉ lo gửi SMTP
```

Logic nằm hết trong `lib/reminders.ts` dưới dạng **hàm thuần** (không chạm DB,
không gọi mạng) nên test được bằng vitest như phần còn lại của repo — cùng nếp
với `lib/band-score.ts`, `lib/streak.ts`, `lib/question-stats.ts`.

### `lib/reminders.ts`

```ts
export type ReminderCandidate = {
  recipientId: string;
  studentEmail: string;
  studentName: string;
  assignmentTitle: string;
  skills: string[];        // để hiện thẻ kỹ năng trong mail
  deadline: Date;
  status: string;
  reminderSentAt: Date | null;
};

export type StudentReminder = {
  email: string;
  name: string;
  items: ReminderCandidate[];   // đã sắp xếp theo deadline tăng dần
  recipientIds: string[];
};

/** Lọc ra các bài cần nhắc tại thời điểm `now`. */
export function findDueReminders(
  candidates: ReminderCandidate[],
  now: Date,
  windowHours?: number,   // mặc định 24
): ReminderCandidate[];

/** Gộp thành một mail cho mỗi học sinh. */
export function groupRemindersByStudent(due: ReminderCandidate[]): StudentReminder[];

/** Soạn tiêu đề + thân mail (HTML và text). */
export function buildReminderEmail(
  reminder: StudentReminder,
  appUrl: string,
): { subject: string; html: string; text: string };
```

**Điều kiện để một bài được nhắc** (`findDueReminders`) — phải thoả tất cả:

1. `deadline` khác null.
2. `deadline > now` và `deadline <= now + 24h`.
3. `status` là `assigned` hoặc `in_progress` (chưa nộp).
4. `reminderSentAt` là null (chưa từng nhắc).

Bài không có hạn thì không bao giờ nhắc — đúng ý nghĩa hiện tại của deadline, vốn
chỉ để hiển thị chứ không chặn nộp.

### `lib/email.ts`

```ts
export function isEmailConfigured(): boolean;
export async function sendEmail(to: string, subject: string, html: string, text: string): Promise<void>;
```

Đọc `GMAIL_USER` + `GMAIL_APP_PASSWORD`. Thiếu bất kỳ biến nào →
`isEmailConfigured()` trả false, route ghi cảnh báo rồi thoát êm (không throw,
không làm đỏ log deploy) — cùng tinh thần "cảnh báo rồi bỏ qua" của
`scripts/ensure-db.mjs`.

Transport: `nodemailer.createTransport({ service: "gmail", auth: { user, pass } })`.
Chạy trên Node runtime của Vercel Function (không phải Edge) vì cần TCP thuần.

### `app/api/cron/reminders/route.ts`

`export const runtime = "nodejs"` và `export const dynamic = "force-dynamic"`.

Xác thực: Vercel Cron tự gắn header `Authorization: Bearer $CRON_SECRET`. Route
so sánh với `process.env.CRON_SECRET`; không khớp → `401`. Chưa đặt `CRON_SECRET`
→ cũng `401` (mặc định đóng, để route không hở khi thiếu cấu hình).

Thân xử lý:

1. Query `AssignmentRecipient` kèm `assignment` (title, deadline, units→skill) và
   `student` (email, displayName), lọc sẵn ở DB: `assignment.deadline` trong
   khoảng `[now, now+24h]`, `status in (assigned, in_progress)`,
   `reminderSentAt: null`.
2. Map sang `ReminderCandidate[]` → `findDueReminders` → `groupRemindersByStudent`.
3. Với mỗi học sinh: `buildReminderEmail` → `sendEmail`. Dùng
   `Promise.allSettled` để một em lỗi không chặn các em còn lại.
4. **Chỉ khi gửi thành công** mới `updateMany` đặt `reminderSentAt = now` cho các
   `recipientIds` của em đó. Em nào gửi lỗi thì không đánh dấu → trưa mai cron
   thử lại, miễn là bài vẫn còn trong cửa sổ 24h.
5. Trả JSON `{ checked, students, sent, failed }` để xem lại trong log Vercel.

Bước 1 lọc ở DB thay vì tải hết rồi lọc trong JS: quy mô lớp nhỏ nên chưa cần,
nhưng lọc sẵn giúp câu query tự mô tả điều kiện và không phình theo số bài cũ.
`findDueReminders` vẫn kiểm lại đủ 4 điều kiện — đó là nơi duy nhất định nghĩa
"thế nào là cần nhắc", và là nơi được test.

### `vercel.json`

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "regions": ["sin1"],
  "crons": [{ "path": "/api/cron/reminders", "schedule": "0 5 * * *" }]
}
```

`0 5 * * *` UTC = **12h trưa giờ VN** (UTC+7). Bản Vercel Hobby cho tối đa 2 cron
và mỗi cron chạy 1 lần/ngày — thiết kế này nằm trong hạn mức miễn phí.

## Thay đổi dữ liệu

Đúng một cột mới, kiểu additive nullable — theo đúng cách dự án vẫn làm (không có
`prisma/migrations`, dùng db-push + `ensure-db.mjs`):

`prisma/schema.prisma`, trong `model AssignmentRecipient`:

```prisma
  // Thời điểm đã gửi mail nhắc sắp hết hạn. Null = chưa nhắc bài này cho em này.
  reminderSentAt DateTime?
```

`scripts/ensure-db.mjs`, thêm vào mảng `statements`:

```js
  // Mail nhắc bài sắp hết hạn: đánh dấu đã nhắc để không gửi trùng
  'ALTER TABLE "AssignmentRecipient" ADD COLUMN IF NOT EXISTS "reminderSentAt" TIMESTAMP(3);',
```

Quên bước `ensure-db.mjs` là prod sẽ lỗi khi Prisma select một cột chưa tồn tại
trên DB thật — `ensure-db.mjs` chạy trong `pnpm build` nên cột tự được thêm khi deploy.

## Nội dung mail

Tiếng Việt, ngắn, không màu mè. Ví dụ với hai bài:

**Tiêu đề:** `Nhắc bài: 2 bài IELTS sắp hết hạn`
(một bài thì `Nhắc bài: "Cambridge 20 Test 1 — Reading" sắp hết hạn`)

**Thân:**

```
Chào Minh,

Em còn 2 bài chưa làm, sắp hết hạn:

• Cambridge 20 Test 1 — Reading   (Đọc)    — hết hạn 23:59 hôm nay
• IELTS Master Listening Test 4   (Nghe)   — hết hạn 18:00 ngày mai

           [ Vào làm bài ]

Mail này được gửi tự động từ lớp IELTS.
```

- Chào bằng `StudentProfile.displayName`.
- Mỗi dòng: tên bài · kỹ năng · hạn. Hạn ghi theo giờ VN, dùng chữ "hôm nay" /
  "ngày mai" cho dễ đọc thay vì ngày tháng đầy đủ.
- Nút dẫn tới `${appUrl}/student` (bảng điều khiển), không deep-link vào từng
  bài — học sinh vào một chỗ rồi tự chọn, tránh chuyện link hỏng nếu bài bị xoá.
- `appUrl` lấy từ `NEXT_PUBLIC_APP_URL`, fallback `https://${process.env.VERCEL_URL}`.
- Gửi kèm cả `text` và `html` (HTML dùng inline style, bảng đơn giản — mail client
  không hiểu CSS ngoài).

Nhãn kỹ năng dùng lại `SKILL_LABELS` trong `lib/skills.ts` để không lệch chữ với
phần còn lại của web.

## Biến môi trường cần thêm trên Vercel

| Biến | Dùng để | Ghi chú |
|---|---|---|
| `GMAIL_USER` | Địa chỉ Gmail gửi mail | Chính Gmail của giáo viên |
| `GMAIL_APP_PASSWORD` | Mật khẩu ứng dụng 16 ký tự | Tài khoản Google **phải bật xác minh 2 bước** mới tạo được App Password. Giáo viên tự tạo và tự dán vào Vercel |
| `CRON_SECRET` | Chặn người ngoài gọi route cron | Chuỗi ngẫu nhiên dài; Vercel tự gắn vào header khi chạy cron |
| `NEXT_PUBLIC_APP_URL` | Tạo link trong mail | Ví dụ `https://<tên-project>.vercel.app` |

## Hạn chế đã biết

Vì cron chỉ chạy một lần vào 12h trưa, **bài giao sau 12h trưa mà hạn trước 12h
trưa hôm sau sẽ không được nhắc** — mốc trưa nay đã qua khi bài chưa tồn tại, còn
mốc trưa mai thì đã hết hạn. Bài có hạn xa hơn khoảng 24 tiếng luôn được nhắc.

Đây là hệ quả trực tiếp của việc chỉ chạy 1 cron/ngày (hạn mức Hobby), không phải
lỗi. Nếu sau này thấy hay bị bỏ sót, cách xử lý là gửi thêm một mail ngay lúc
giao bài cho riêng những bài có hạn gấp — việc đó sẽ là một đợt riêng.

## Kiểm thử

**Unit test** `tests/reminders.test.ts` (không cần DB, không cần mạng):

`findDueReminders` — các trường hợp:

| Trường hợp | Kỳ vọng |
|---|---|
| Không có deadline | không nhắc |
| Deadline đã qua | không nhắc |
| Deadline sau 24h | không nhắc |
| Deadline trong 24h, chưa nộp, chưa nhắc | **nhắc** |
| Deadline trong 24h nhưng `status = submitted` | không nhắc |
| Deadline trong 24h nhưng `reminderSentAt` đã có | không nhắc |
| Đúng biên: deadline = `now + 24h` | nhắc (biên đóng) |
| Đúng biên: deadline = `now` | không nhắc (phải còn thời gian) |

`groupRemindersByStudent` — hai bài của cùng một em ra **một** phần tử; hai em
khác nhau ra hai phần tử; các bài trong một em sắp theo deadline tăng dần.

`buildReminderEmail` — tiêu đề số ít/số nhiều đúng; thân mail chứa tên em, tên
từng bài, và link `appUrl`.

**Kiểm thật:** gọi route trên DB test Neon với header `Authorization: Bearer <CRON_SECRET>`,
xác nhận JSON trả về đúng số lượng và `reminderSentAt` được ghi. Gửi thử một mail
về chính hộp thư của giáo viên trước khi bật cron thật.

Lưu ý khi kiểm trên Neon: DB test là project `ielts-test` (đúng cái mà `.env` trỏ
tới), **không** phải `IELTS_Platform` — `IELTS_Platform` là DB **production**, tên
hai project bị đặt ngược nhau nên rất dễ nhầm.

## Dependency mới

`nodemailer` + `@types/nodemailer`. Không thêm gì khác.

## Ngoài phạm vi

Cố ý không làm trong đợt này:

- Mail "có bài mới được giao", "đã quá hạn", "đã chấm xong bài Writing".
- Thông báo trong web (icon chuông), Web Push / PWA, Telegram bot.
- Trang cho học sinh tự bật/tắt nhận mail. Lớp nhỏ, giáo viên biết từng em; thêm
  bảng cấu hình lúc này là phức tạp hoá vô ích. Nếu có em xin thôi nhận thì xử lý
  bằng tay trước, khi nào cần thật mới làm.
- Nhắc cho giáo viên (kiểu "còn 5 bài chưa chấm").
