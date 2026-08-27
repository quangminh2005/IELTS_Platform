# Hồ sơ học viên — bản thiết kế

Ngày: 2026-08-27
Trạng thái: chờ duyệt

## Mục tiêu

Học viên có một trang hồ sơ của riêng mình, tự đổi được avatar, bio và mục tiêu
band. Giáo viên sửa được hồ sơ của học viên trong lớp mình. Avatar thay chỗ chữ
cái viết tắt ở mọi nơi đang hiện tên học viên.

Tham khảo bố cục: trang `/me` của chin.edu.vn (ảnh bìa + avatar tròn + tên +
ngày tham gia + hạng, lịch chuyên cần dạng heatmap, thẻ thống kê).

## Ngoài phạm vi đợt này

Cố ý bỏ, không phải quên:

- **Huy hiệu / thành tích** — tách thành đợt 2, cần bộ điều kiện + bảng lưu +
  thời điểm xét trao riêng.
- **Theo dõi bạn bè, bảng tin hoạt động, linh vật, cửa hàng, kim cương, XP** —
  cơ chế giữ chân của app đại trà. Lớp nhỏ một giáo viên không cần; học viên
  trong lớp vốn đã biết nhau.
- **Học viên tự đổi tên hiển thị và email** — chỉ giáo viên đổi được. Tên này
  hiện ở bảng xếp hạng, danh sách lớp và hàng chờ chấm bài; để học viên đổi
  thành biệt danh thì giáo viên không nhận ra ai.

## 1. Dữ liệu

### Cột mới trên `StudentProfile`

| Cột | Kiểu | Ý nghĩa |
|---|---|---|
| `bio` | `String?` | Giới thiệu ngắn, tối đa 280 ký tự, văn bản thuần |
| `avatarUrl` | `String?` | Link ảnh học viên tự tải lên (Vercel Blob) |
| `avatarPreset` | `String?` | Mã avatar có sẵn, ví dụ `"cat"` |
| `coverColor` | `String?` | Mã màu bìa, ví dụ `"pink"` |

Cả bốn đều nullable. `targetBand` và `createdAt` (= ngày tham gia) đã có sẵn,
dùng lại, không thêm cột.

Vì sao là cột phẳng chứ không phải bảng phụ hay một cột JSON: `targetBand`,
`parentToken`, `notificationsReadAt` đều đang là cột phẳng trên chính bảng này.
Avatar phải hiện ở bốn nơi, tách bảng nghĩa là thêm `include` ở khoảng sáu truy
vấn mà chẳng đổi lại được gì. JSON thì không lọc/sắp xếp được và đi ngược quy
ước của repo (JSON chỉ dùng cho nội dung đề bài: `optionsJson`, `metadataJson`).

### Đồng bộ lên production

Thêm bốn câu vào `scripts/ensure-db.mjs` — dự án dùng `db push`, không có
migrations, script này chạy trong lúc build nên là đường duy nhất để cột mới
xuất hiện trên production:

```
ALTER TABLE "StudentProfile" ADD COLUMN IF NOT EXISTS "bio" TEXT;
ALTER TABLE "StudentProfile" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;
ALTER TABLE "StudentProfile" ADD COLUMN IF NOT EXISTS "avatarPreset" TEXT;
ALTER TABLE "StudentProfile" ADD COLUMN IF NOT EXISTS "coverColor" TEXT;
```

Bỏ sót bước này = production sập ngay lần deploy kế tiếp.

## 2. `lib/student-avatar.ts` — nguồn sự thật duy nhất cho avatar

Một module thuần, không đụng Prisma, không đụng React.

```ts
export type AvatarSource =
  | { kind: "image"; src: string }
  | { kind: "preset"; emoji: string; colorClass: string }
  | { kind: "initials"; text: string; colorClass: string };

export function resolveStudentAvatar(input: {
  avatarUrl: string | null;
  avatarPreset: string | null;
  userImage: string | null;
  displayName: string;
}): AvatarSource;
```

Thứ tự ưu tiên: **ảnh tự tải → avatar có sẵn → ảnh Google (`User.image`) → chữ
cái viết tắt**. Học viên chọn avatar có sẵn thì nó thắng ảnh Google, vì đó là
lựa chọn chủ động.

Module này cũng giữ hai bảng hằng số:

- `AVATAR_PRESETS` — 12 mục, mỗi mục `{ key, emoji, colorClass }`. Không tốn
  Blob, không phải tải gì.
- `COVER_COLORS` — 8 mục, mỗi mục `{ key, className }` (gradient Tailwind, hợp
  cả chế độ sáng lẫn tối).

Logic chữ cái viết tắt và bảng màu suy từ tên hiện đang nằm trong
`components/class-ranking-board.tsx` (`initials()`, `AVATAR_COLORS`,
`avatarColor()`) — chuyển vào đây, board gọi lại. Giữ nguyên thuật toán băm tên
để màu của mỗi học viên không đổi so với hiện tại.

Thêm một hàm kiểm tra link ảnh:

```ts
export function isAllowedAvatarUrl(url: string): boolean;
```

Chỉ chấp nhận `https` trên host `*.public.blob.vercel-storage.com`. Không có
chốt này thì học viên sửa gói tin gửi lên là dán được ảnh bất kỳ ngoài internet
vào hồ sơ, và nó sẽ hiện trên bảng xếp hạng của cả lớp.

## 3. Component `<StudentAvatar>`

`components/student-avatar.tsx`, client component nhẹ. Nhận đúng bốn trường
`resolveStudentAvatar` cần, cộng `size: "sm" | "md" | "lg"`. Render `<img>` cho
ảnh, hoặc vòng tròn màu chứa emoji / chữ cái. Mọi nơi hiện avatar đều dùng
component này để không chỗ nào lệch chỗ nào.

## 4. Server action — `lib/actions/profile.ts`

Hai action tách bạch, không dùng chung đường ghi.

### `updateMyProfile(formData): Promise<ActionResult>`

- Mở đầu bằng `requireStudent()`.
- Chỉ chạm `bio`, `avatarUrl`, `avatarPreset`, `coverColor`, `targetBand`.
- Truy vấn khoá theo `userId` lấy từ phiên đăng nhập:
  `prisma.studentProfile.update({ where: { userId } })`. **Không đọc `studentId`
  từ FormData** — kể cả học viên tự sửa gói tin cũng không đụng được hồ sơ người
  khác.
- Zod: `bio` ≤ 280 ký tự (chuỗi rỗng → `null`), `avatarPreset` phải thuộc
  `AVATAR_PRESETS`, `coverColor` phải thuộc `COVER_COLORS`, `targetBand` là bội
  của 0.5 trong khoảng 0–9 hoặc `null`, `avatarUrl` phải qua
  `isAllowedAvatarUrl`.
- Đặt `avatarUrl` mới thì xoá ảnh cũ trên Blob bằng `del()`. Blob store từng bị
  khoá vì vượt băng thông — không để rác tích lại.

### `updateStudentProfile(formData): Promise<ActionResult>`

- Mở đầu bằng `requireTeacher()`.
- Chạm được mọi thứ `updateMyProfile` chạm, cộng `displayName` và `email`.
- Lọc theo quyền sở hữu như trang chi tiết học viên đang làm:
  `where: { id, classes: { some: { class: { teacherId } } } }`. Giáo viên chỉ
  sửa được học viên trong lớp mình.
- **Chốt đổi email**: nếu `studentProfile.userId != null` (học viên đã đăng nhập
  Google ít nhất một lần) thì từ chối đổi email, trả thông báo giải thích rằng
  đổi sẽ làm học viên mất quyền vào toàn bộ bài cũ. Email là khoá nối tài khoản
  Google trong `lib/auth.ts`. Học viên chưa từng đăng nhập thì đổi thoải mái.

Cả hai trả `ActionResult` để hiện toast theo cơ chế A (`ActionForm`) đang dùng
sẵn trong repo, và `revalidatePath` các trang liên quan.

## 5. Tải ảnh — `app/api/student/avatar/route.ts`

Route mới, `runtime = "nodejs"`. Cho cả giáo viên và học viên (giáo viên cần để
đặt ảnh hộ học viên chưa biết làm).

- Trình duyệt cắt vuông + thu về 256px + xuất webp bằng canvas **trước khi
  gửi**. Khoảng 20KB một ảnh; 100 học viên ≈ 2MB, không đáng lo với Blob store
  đang dùng ~721MB.
- Server chặn file > 512KB và loại MIME không phải ảnh.
- `put()` với `addRandomSuffix: true`, tiền tố đường dẫn `avatars/`.

Không dùng lại `/api/image/direct-upload`: route đó dành cho ảnh đề bài, đang
khoá cứng vai trò giáo viên. Mở nó cho học viên là nới một cửa rộng hơn mức cần
thiết.

Thao tác cắt ảnh phải chạy được bằng **cảm ứng**, không chỉ chuột — học viên chủ
yếu dùng điện thoại.

## 6. Trang hồ sơ

### `/student/profile` — của mình, sửa được

- Dải bìa màu + avatar tròn đè lên + tên + bio bên dưới. Nút bút chì góc phải mở
  form sửa (bio, avatar, màu bìa, mục tiêu band).
- Dòng phụ: `Tham gia từ dd/mm/yyyy · <chip hạng> · Mục tiêu <band>`. Chip hạng
  lấy từ `lib/rank-tier.ts` (5 bậc Đồng → Kim Cương, chấm theo điểm xếp hạng
  0–100). Không hiện mục tiêu nếu `targetBand` rỗng.
- **Thẻ thống kê nhanh**, bốn số:
  - Số bài đã nộp — đếm `Attempt` đã nộp, áp `countsForStats` của
    `lib/practice.ts` để lượt luyện lại không thổi phồng con số.
  - Band trung bình từng kỹ năng — `bandsBySkill()` của `lib/band-score.ts`,
    đúng cách trang chi tiết học viên đang tính.
  - Số từ vựng đã học — đếm số bản ghi `VocabProgress` của học viên. Định nghĩa
    rõ: **số từ đã từng trả lời**, không phải "số từ đã thuộc". Repo hiện chưa
    có ngưỡng "thuộc" nào, và đợt này không đặt ra một ngưỡng mới.
  - Chuỗi tuần hiện tại — `calculateWeekStreak()` của `lib/streak.ts`.
- **Lịch chuyên cần** — heatmap một tháng, có nút lùi/tới tháng.

### `/student/profile/[studentId]` — bản rút gọn của bạn cùng lớp

- Guard **ở server**: chỉ trả nội dung nếu người xem và học viên đó chung ít
  nhất một lớp. Không phải ẩn nút trên giao diện.
- Hiện: bìa, avatar, tên, bio, ngày tham gia, chip hạng.
- Ẩn: band từng kỹ năng, mục tiêu band, lịch chuyên cần, thẻ thống kê. Đó là
  chuyện riêng.
- Vào `/student/profile/<id của chính mình>` thì chuyển hướng sang
  `/student/profile`.

### Giáo viên

Thêm một khối "Hồ sơ học viên" gập/mở vào
`app/teacher/students/[studentId]/page.tsx` đã có — form sửa tên, email, mục
tiêu band, bio, avatar, màu bìa. Không tạo trang mới. Trang này dùng
`requireTeacherPage()`, giữ nguyên.

Giáo viên xem được bio của mọi học viên trong lớp và xoá được — cần chỗ xử lý
nếu có em viết bậy.

### Khối huy hiệu

Không dựng sẵn hộp rỗng "Chưa có thành tích". Một ô trống nằm đó nhiều tháng
trông như tính năng hỏng hơn là tính năng sắp có. Đợt 2 chèn vào sau.

## 7. `lib/attendance.ts` — lịch chuyên cần

Module thuần, không đụng Prisma.

```ts
export function buildAttendanceMonth(input: {
  submittedAt: Date[];      // Attempt.submittedAt
  vocabDays: Date[];        // VocabQuizDay.date
  month: Date;              // tháng cần vẽ
}): Array<{ day: number; active: boolean }>;
```

Một ngày sáng khi có **nộp bài hoặc làm quiz từ vựng**. Chỉ hai mức (có / không)
— không chia độ đậm nhạt, vì một học viên hiếm khi nộp quá 2 bài một ngày, ba
mức màu sẽ chỉ là nhiễu.

**Chỗ dễ sai nhất**: gộp ngày phải theo giờ Việt Nam. Bài nộp lúc 23h30 giờ VN
mà tính theo UTC sẽ nhảy sang ngày hôm sau, làm lệch một ô. Dùng lại đúng mốc
`VN_OFFSET_MS` mà `lib/streak.ts` đang dùng — xuất nó ra từ `streak.ts` thay vì
chép lại hằng số.

Lưu ý `VocabQuizDay.date` là kiểu `@db.Date` (đã là ngày, không có giờ), còn
`Attempt.submittedAt` là timestamp — hai nguồn phải quy về cùng một dạng khoá
ngày trước khi gộp.

## 8. Điểm tích hợp

| Nơi | Việc phải làm |
|---|---|
| Thanh điều hướng học viên | `app/student/layout.tsx` (server component) đọc hồ sơ, truyền prop xuống `AppShell`; avatar bấm được → `/student/profile`. Đặt cạnh chuông thông báo. |
| Bảng xếp hạng lớp | Đổi nguồn `avatarUrl` ở `lib/class-ranking.ts:284` (hiện chỉ lấy `user.image`) sang `resolveStudentAvatar`; ba chỗ render trong `class-ranking-board.tsx` đổi sang `<StudentAvatar>`; tên bấm được → hồ sơ rút gọn. |
| Trang giáo viên | Danh sách lớp (`app/teacher/classes/[classId]/page.tsx`), chi tiết học viên, hàng chờ chấm bài (`app/teacher/review/page.tsx`). |
| Báo cáo phụ huynh | `app/ph/[token]/page.tsx` + thêm cột vào `select` trong `lib/parent-report-query.ts`. |

Mọi truy vấn ở trang giáo viên dùng `select` liệt kê cột, **không** dùng
`include` — quy ước sẵn có để tránh kéo theo `content`/`transcript`/`metadata`
rất nặng.

## 9. Kiểm thử

Ba file vitest mới, đúng kiểu logic thuần đang dùng trong `tests/`:

- `tests/student-avatar.test.ts` — thứ tự ưu tiên bốn nguồn ảnh; chữ cái viết
  tắt giữ nguyên kết quả so với thuật toán cũ trong board; `isAllowedAvatarUrl`
  chặn host lạ, chặn `http`, chấp nhận host Blob.
- `tests/attendance.test.ts` — bài nộp 23h30 giờ VN rơi đúng ngày đó; gộp hai
  nguồn không đếm trùng; tháng thiếu ngày (tháng 2) ra đúng số ô.
- `tests/profile-actions.test.ts` — kiểm cấu trúc trên mã nguồn:
  `lib/actions/profile.ts` mở đầu bằng `requireStudent()`/`requireTeacher()`, và
  `updateMyProfile` không đọc `studentId` từ FormData.

Sau khi deploy, kiểm thật trên Vercel + Neon, không chỉ suy luận ở máy.

## 10. Rủi ro

1. **Bio là chữ do học viên nhập.** Luôn render bằng text thuần, tuyệt đối không
   `dangerouslySetInnerHTML`.
2. **Học viên chủ yếu làm bài trên điện thoại.** Form sửa hồ sơ và thao tác cắt
   ảnh phải chạy bằng cảm ứng.
3. **Đổi email phá liên kết Google.** Đã chặn ở mục 4, nhưng cần thông báo nói
   rõ lý do chứ không chỉ báo lỗi cụt.
4. **Ảnh Blob mồ côi.** Đổi avatar phải xoá ảnh cũ. Nếu sót, `scripts/blob-orphans.mjs`
   đã có sẵn để dọn.
