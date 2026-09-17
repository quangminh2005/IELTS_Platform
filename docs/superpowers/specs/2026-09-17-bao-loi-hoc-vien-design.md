# Nút báo lỗi cho học viên

Ngày: 2026-09-17

## Vấn đề

Khi học viên gặp trục trặc (audio không chạy, đáp án chấm sai, giao diện vỡ
trên điện thoại cũ…) hiện không có cách nào báo cho giáo viên ngay trên web.
Học viên phải nhắn tin ngoài, thường thiếu thông tin (đang ở bài nào, máy gì),
giáo viên khó lần ra lỗi.

## Mục tiêu

- Học viên bấm một nút, mô tả ngắn, đính kèm ảnh nếu muốn, gửi trong vài giây.
- Hệ thống tự đính kèm ngữ cảnh: trang đang mở, thiết bị/trình duyệt, kích
  thước màn hình, bài + part đang làm.
- Giáo viên nhận mail ngay, có trang liệt kê để đánh dấu đã xử lý và ghi phản
  hồi; học viên thấy trạng thái qua chuông thông báo.

Không dùng dịch vụ ngoài (Sentry, Google Form): không nạp thêm script cho điện
thoại cũ, và cần biết học viên nào / bài nào.

## 1. Dữ liệu

Bảng mới `BugReport` trong `prisma/schema.prisma`:

```prisma
model BugReport {
  id          String    @id @default(cuid())
  studentId   String
  // audio | answer | display | other — xem comment đầu schema
  category    String
  description String
  imageUrl    String?
  pageUrl     String
  userAgent   String?
  viewport    String?
  // KHÔNG khoá ngoại: bài làm có thể bị giáo viên reset xoá, báo lỗi vẫn giữ.
  attemptId   String?
  // JSON: { unitTitle?: string, step?: number } — part/bước đang mở lúc báo
  contextJson String?
  // open | resolved
  status      String    @default("open")
  teacherNote String?
  resolvedAt  DateTime?
  createdAt   DateTime  @default(now())
  student     StudentProfile @relation(fields: [studentId], references: [id], onDelete: Cascade)

  @@index([studentId, createdAt])
  @@index([status, createdAt])
}
```

- Thêm `bugReports BugReport[]` vào `StudentProfile`.
- Ghi hai giá trị String-enum mới (`category`, `status`) vào khối comment đầu
  schema; zod trong action mirror đúng các giá trị đó.
- `scripts/ensure-db.mjs`: thêm `CREATE TABLE IF NOT EXISTS "BugReport" (...)`
  + hai `CREATE INDEX IF NOT EXISTS` + FK tới `StudentProfile` (mẫu như
  `AttemptSkill`). Đặt sau các câu ALTER, trước các câu UPDATE nặng.
- Chống spam: tối đa **10 báo lỗi / học viên / 24 giờ** (đếm `createdAt` trong
  action, không cần cột).

## 2. Logic thuần: `lib/bug-report.ts`

File không import prisma (client component cũng dùng):

- `BUG_CATEGORIES`: mảng `{ value, label, hint }` cho 4 loại:
  `audio` "Audio không chạy", `answer` "Đáp án / chấm sai",
  `display` "Hiển thị lỗi", `other` "Khác".
- `BUG_DESCRIPTION_MAX = 1000`, `BUG_DAILY_LIMIT = 10`, `BUG_IMAGE_MAX_BYTES = 1MB`.
- `describeDevice(userAgent: string | null): string` — rút gọn thành
  "iPhone · Safari 15", "Android · Chrome 120", "Windows · Edge 125"… Không
  cần thư viện; regex vài dòng, không nhận ra thì trả "Không rõ".
- `isOverDailyLimit(countLast24h: number): boolean`.
- `parseBugContext(json: string | null): { unitTitle?: string; step?: number }`.
- `buildBugReportEmail(input): { subject, html, text }` — escape HTML mọi chuỗi
  học viên nhập.

## 3. Phía học viên

### Nút nổi + hộp thoại: `components/bug-report-button.tsx`

- Render trong `AppShell` khi `role === "student"`. Nút tròn 44px, icon con
  bọ, `fixed bottom-4 right-4`, `z-40`. Ở màn làm bài, thanh nút cuối trang
  (Nộp bài) nằm cao hơn nên không bị che; nếu va chạm thì nâng nút lên
  `bottom-20` chỉ trên route `/student/assignments/*` và `/student/practice/*`.
- Hộp thoại portal ra `document.body` (overlay `fixed` bên trong phần tử có
  `animate-fade-in` sẽ bị kẹt — xem bẫy đã ghi nhận). Đóng bằng nút X, Esc,
  bấm nền.
- Nội dung:
  1. 4 nút chọn loại (bắt buộc, dạng chip 2 cột trên điện thoại).
  2. Ô mô tả (`textarea`, bắt buộc, tối đa 1.000 ký tự, đếm ký tự).
  3. "Đính kèm ảnh chụp màn hình" (tuỳ chọn): `<input type="file" accept="image/*">`.
     Ảnh được thu nhỏ trong trình duyệt bằng canvas (cạnh dài ≤1280px, webp
     0.8, fallback jpeg nếu trình duyệt không xuất webp) rồi POST lên
     `/api/student/bug-image`; hiện thumbnail + nút bỏ ảnh. Upload lỗi thì báo
     và vẫn cho gửi không ảnh.
  4. Nút "Gửi cho giáo viên". Đang gửi thì khoá nút.
- Gửi xong: đóng hộp thoại, toast "Đã gửi báo lỗi. Cô/thầy sẽ xem sớm." kèm
  link "Xem các báo lỗi đã gửi" → `/student/bugs`.
- Ngữ cảnh tự lấy lúc mở hộp thoại: `window.location.pathname + search`,
  `navigator.userAgent`, `${innerWidth}x${innerHeight}`, và
  `attemptId`/`unitTitle`/`step` từ context bên dưới.

### Ngữ cảnh bài làm: `components/bug-report-context.tsx`

- React context nhỏ: `{ context, setContext }` với
  `context: { attemptId: string; unitTitle: string; step?: number } | null`.
- Provider đặt trong `AppShell` (student). `attempt-workspace.tsx` gọi
  `useEffect` cập nhật khi đổi part/bước, và xoá khi unmount.
- Tách file riêng để `attempt-workspace.tsx` (đã rất lớn) chỉ thêm ~10 dòng.

### Upload ảnh: `app/api/student/bug-image/route.ts`

- Bản sao rút gọn của `app/api/student/avatar/route.ts`: yêu cầu đăng nhập vai
  trò student, chỉ nhận `image/webp|png|jpeg`, ≤ `BUG_IMAGE_MAX_BYTES`,
  `put()` lên Blob `access: "public"`, `addRandomSuffix`. Không nhận SVG.
- Không dùng lại `/api/image/direct-upload` (khoá vai trò giáo viên).

### Server action: `lib/actions/bug-reports.ts`

- `createBugReport(formData): Promise<ActionResult>` — `requireStudent()` →
  zod (`category` enum, `description` 1–1000, `imageUrl` URL Blob tuỳ chọn,
  `pageUrl` ≤ 500, `userAgent` ≤ 500, `viewport` ≤ 20, `attemptId` cuid tuỳ
  chọn, `contextJson` ≤ 500) → kiểm tra giới hạn 24h → `prisma.bugReport.create`
  → gửi mail (mục 5, `try/catch`, lỗi chỉ `console.error`) →
  `revalidatePath("/student/bugs")`, `revalidatePath("/teacher/bugs")`,
  `revalidatePath("/teacher")` → trả `{ ok: true }`.
- Không kiểm `attemptId` thuộc học viên tại thời điểm tạo (chỉ để tham chiếu);
  trang giáo viên khi render mới xác minh attempt tồn tại và thuộc học viên đó
  rồi mới hiện link.

### Trang `/student/bugs` (`app/student/bugs/page.tsx`)

- Gate như các trang student khác (`auth()` → không phải student thì
  `redirect("/login")`, chưa có StudentProfile thì `redirect("/waiting")`);
  liệt kê báo lỗi của mình, mới nhất trước, 50 dòng gần nhất.
- Mỗi dòng: thời gian, loại, mô tả, thumbnail ảnh, nhãn trạng thái
  ("Đang chờ" / "Đã xử lý") và phản hồi giáo viên nếu có.
- Không có trong thanh điều hướng (tránh thêm mục); tới bằng link từ toast,
  từ thông báo, và một dòng nhỏ trong hộp thoại báo lỗi.

## 4. Phía giáo viên

### Trang `/teacher/bugs` (`app/teacher/bugs/page.tsx`)

- `requireTeacherPage()`. Tab `?tab=open` (mặc định) / `?tab=resolved`.
- Phạm vi: báo lỗi của học viên đang thuộc ít nhất một lớp của giáo viên
  (`student.classes.some({ class: { teacherId } })`). Nếu học viên không thuộc
  lớp nào thì báo lỗi vẫn được lưu và mail vẫn gửi (mục 5), chỉ không hiện ở
  trang này — trường hợp hiếm, chấp nhận.
- Mỗi dòng: thời gian, avatar + tên + lớp, chip loại, mô tả (giữ xuống dòng,
  render text), ảnh (bấm mở tab mới), khối ngữ cảnh gọn: trang,
  `describeDevice(userAgent)`, viewport, part/bước. Nếu `attemptId` còn tồn
  tại và thuộc đúng học viên → link "Mở bài làm" tới `/teacher/review/<attemptId>`
  (trang chấm/xem bài hiện có).
- Hành động (dùng `ActionForm` + toast, cơ chế A):
  - Tab Mới: ô "Phản hồi cho học viên" (tuỳ chọn, ≤500) + nút **Đã xử lý**.
  - Tab Đã xử lý: nút **Mở lại**.
- Dùng `select`, không `include`, theo quy ước trang giáo viên.

### Actions (cùng file `lib/actions/bug-reports.ts`)

- `resolveBugReport(formData)`: `requireTeacher()` → zod (`id`, `teacherNote`
  tuỳ chọn) → `updateMany` với `where` scope học viên thuộc lớp của giáo viên
  → `status: "resolved"`, `resolvedAt: now`, `teacherNote` → revalidate.
- `reopenBugReport(formData)`: ngược lại (`status: "open"`, `resolvedAt: null`,
  giữ `teacherNote`).

### Điều hướng & Tổng quan

- `components/app-shell.tsx`: thêm mục giáo viên
  `{ href: "/teacher/bugs", label: "Báo lỗi", hint: "Học viên báo trục trặc", icon: "bug" }`
  — thêm icon `bug` vào `Icon`. Cùng icon dùng cho nút nổi của học viên.
- `app/teacher/page.tsx`: đếm `bugReport.count({ status: "open", ...scope })`;
  nếu > 0 hiện thẻ "Báo lỗi mới: N" dẫn tới `/teacher/bugs`.

## 5. Mail & thông báo

### Mail cho giáo viên

- Gửi trong `createBugReport` sau khi lưu, qua `sendEmail` của `lib/email.ts`;
  bỏ qua nếu `!isEmailConfigured()`.
- Người nhận: email (`User.email`) của các giáo viên phụ trách lớp mà học viên
  thuộc về, loại trùng. Không có lớp → gửi tới `GMAIL_USER` (chính hộp thư
  giáo viên) để không mất báo lỗi.
- Tiêu đề: `[IELTS] Báo lỗi mới – <Tên HS>: <nhãn loại>`.
- Nội dung (`buildBugReportEmail`): mô tả, thời gian, trang, thiết bị,
  viewport, part/bước, link ảnh nếu có, nút "Xem trên web" →
  `${appUrl}/teacher/bugs` (dùng `lib/app-url.ts`).

### Chuông thông báo học viên

- `lib/notifications.ts`: thêm `"bug_resolved"` vào `StudentNotificationType`
  và nguồn `BugResolvedNotificationSource = { id, category, resolvedAt, teacherNote }`;
  `buildStudentNotifications` nhận thêm mảng này, sinh mục
  `id: "bug:<id>"`, title "Báo lỗi đã được xử lý", detail = phản hồi giáo viên
  (hoặc nhãn loại), `href: "/student/bugs"`, `createdAt = resolvedAt`.
- `lib/notifications-feed.ts`: query thêm `bugReport.findMany({ studentId,
  status: "resolved" }, orderBy resolvedAt desc, take LIMIT)`.
- `components/notification-list.tsx`: thêm icon/nhãn cho loại mới.

## 6. Kiểm thử

- `tests/bug-report.test.ts` (mới): `describeDevice` với vài userAgent thật
  (iPhone Safari 15, Android Chrome, Windows Edge, chuỗi lạ), `isOverDailyLimit`,
  `parseBugContext` với JSON hỏng, `buildBugReportEmail` escape `<script>`.
- `tests/notifications.test.ts` (đã có, mở rộng):
  `buildStudentNotifications` xếp `bug_resolved` đúng thứ tự thời gian và tính
  unread theo `notificationsReadAt`.
- `tests/foundation.test.ts`: assert schema có `model BugReport`, các cột
  `category/status/teacherNote/resolvedAt`, và `ensure-db.mjs` có
  `CREATE TABLE IF NOT EXISTS "BugReport"`.
- `tests/teacher-page-guard.test.ts` tự phủ `app/teacher/bugs/page.tsx`.
- Kiểm tay trên preview: gửi báo lỗi có ảnh từ màn làm bài → thấy ở
  `/teacher/bugs` với part đúng → Đã xử lý kèm phản hồi → chuông học viên hiện
  mục mới → `/student/bugs` hiện phản hồi.

## 7. An toàn & tương thích

- Mọi action bắt đầu bằng `requireStudent()` / `requireTeacher()`; query
  giáo viên scope theo lớp.
- Mô tả và phản hồi render dạng text (`whitespace-pre-wrap`), không
  `dangerouslySetInnerHTML`; mail escape HTML.
- Upload ảnh: chỉ PNG/JPG/WEBP, ≤1MB sau khi thu nhỏ; SVG bị từ chối.
- Không thêm dependency; canvas/webp có fallback jpeg; toàn bộ code nằm trong
  `app/`, `components/`, `lib/` nên được SWC dịch theo browserslist.
- Cột mới đều nằm trong bảng mới → `ensure-db.mjs` tạo bảng lúc build, không
  ảnh hưởng dữ liệu cũ.

## Ngoài phạm vi

- Trả lời qua lại nhiều lượt (chat) — chỉ một dòng phản hồi.
- Tự bắt lỗi JS (error boundary gửi báo lỗi tự động) — có thể thêm sau bằng
  cách gọi cùng action từ `app/error.tsx`.
- Thống kê báo lỗi theo loại/thời gian.
