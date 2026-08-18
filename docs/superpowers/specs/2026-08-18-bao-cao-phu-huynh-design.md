# Báo cáo học tập cho phụ huynh

Ngày: 2026-08-18

## Mục tiêu

Phụ huynh nắm được tình hình học tập và điểm số của con mà **không cần tài khoản,
không cần đăng nhập**, và không nhìn thấy đề bài hay đáp án.

Hai kênh, dùng chung một nguồn số liệu:

1. **Mail tóm tắt hàng tuần** — tự gửi trưa Chủ nhật, cô có thể bấm gửi thêm bất cứ lúc nào.
2. **Trang chỉ-đọc** tại `/ph/<token>` — link cố định, cô thu hồi được.

## Ngoài phạm vi (YAGNI)

- Không thêm vai trò `parent` vào hệ thống đăng nhập.
- Không cho phụ huynh xem bài làm, câu hỏi, đáp án, hay ghi chú chấm từng câu.
- Không có nhắn tin hai chiều giữa phụ huynh và giáo viên.
- Mỗi học viên chỉ một liên hệ phụ huynh (một email, một tên).

## 1. Dữ liệu

Thêm 4 cột vào `StudentProfile` (`prisma/schema.prisma`), tất cả đều cho phép null:

| Cột | Kiểu | Ý nghĩa |
| --- | --- | --- |
| `parentEmail` | `String?` | Email phụ huynh. Null/rỗng = học viên này không có báo cáo. |
| `parentName` | `String?` | Tên phụ huynh, dùng để xưng hô trong mail. |
| `parentToken` | `String? @unique` | Mã bí mật 32 ký tự (`crypto.randomBytes(24).toString("base64url")`), sinh khi cô lưu email lần đầu. |
| `parentReportSentAt` | `DateTime?` | Lần cron gửi mail gần nhất. Chống gửi trùng. Nút gửi tay KHÔNG cập nhật cột này. |

Ràng buộc bắt buộc: **cả 4 cột phải được khai báo trong `scripts/ensure-db.mjs`**
để build trên Vercel tự áp lên prod. Bỏ qua bước này thì prod sập ngay khi deploy.

`parentToken` để `@unique` nên không cần `@@index` riêng. Nhưng trong `ensure-db.mjs`
phải có **hai** câu lệnh cho cột này: `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
và `CREATE UNIQUE INDEX IF NOT EXISTS "StudentProfile_parentToken_key" ON "StudentProfile"("parentToken");`
— `ALTER TABLE` không tự tạo ràng buộc unique.

## 2. Logic dùng chung — `lib/parent-report.ts`

Một module **hàm thuần**, không import Prisma, để test bằng vitest mà không cần DB.
Đây là nguồn duy nhất sinh số liệu cho cả trang web lẫn mail, đảm bảo hai nơi
không bao giờ lệch nhau.

Đầu vào: mảng các lượt làm bài đã được nạp sẵn (kiểu tự định nghĩa trong file, KHÔNG
dùng kiểu của Prisma), cùng mốc thời gian `now` và khoảng thống kê.

Đầu ra `ParentSummary`:

- `assignedCount`, `submittedCount`, `lateOrMissingCount`
- `averageBand` (chỉ tính bài đủ 40 câu Nghe/Đọc, theo `lib/band-score.ts`) và `averageScorePercent`
- `trend`: `"up" | "down" | "flat"` — so kỳ này với kỳ trước
- `headline`: câu tiếng Việt tóm tắt, ví dụ `"Tuần qua con đã hoàn thành 3/4 bài, điểm Đọc tăng so với tuần trước."`
- `perAssignment[]`: tên bài, kỹ năng, ngày nộp, điểm, trạng thái chấm
- `strengths[]` / `weaknesses[]`: 2–3 nhóm dạng câu tốt nhất / kém nhất, lấy qua `lib/question-stats.ts`
- `latestComments[]`: nhận xét chung + band từng tiêu chí của các bài Viết/Nói đã chấm

Hàm `shouldSendWeeklyReport(summary)` trả `false` khi trong kỳ không có hoạt động
nào **và** không có bài nợ — để không gửi mail rỗng.

Quy ước điểm: bài Viết/Nói chưa chấm có `isCorrect: null`, KHÔNG được tính là 0.
Tái dùng `rankingScorePercent` trong `lib/student-score.ts`.

## 3. Truy vấn — `lib/parent-report-query.ts`

Cửa duy nhất đọc DB cho tính năng này. Hàm `loadParentReportData(studentId, range)`
`select` đúng các trường cần thiết và **tuyệt đối không chạm** tới `Question`,
`Answer.value`, `correctAnswerJson`, `AnswerAnnotation`, `Material.content`.

Theo `prisma-select-not-include-teacher-pages`: dùng `select`, không dùng `include`.

## 4. Server actions — `lib/actions/parents.ts`

Ba action, mỗi cái mở đầu bằng `requireTeacher()` rồi truy vấn học viên **có ràng buộc
thuộc lớp của giáo viên đó** (không tin `studentId` từ `FormData`):

| Action | Việc |
| --- | --- |
| `saveParentContact` | Lưu tên + email (zod validate email). Nếu chưa có `parentToken` thì sinh mới. Xoá trống email = tắt báo cáo (giữ nguyên token). |
| `regenerateParentToken` | Sinh token mới, link cũ chết ngay. |
| `sendParentReportNow` | Soạn và gửi mail ngay theo kỳ cô chọn (tuần / tháng). Không đụng `parentReportSentAt`. |

Cả ba trả `ActionResult`, form dùng `ActionForm` để hiện toast — theo đúng cơ chế A
trong `toast-action-result-pattern`.

## 5. Giao diện cho giáo viên

Thêm khối **"Phụ huynh"** vào `app/teacher/students/[studentId]/page.tsx`:

- Form: ô Tên phụ huynh, ô Email, nút **Lưu**.
- Khi đã có email: hiện link `/ph/<token>` (bấm để copy), ngày gửi mail gần nhất,
  nút **Gửi báo cáo ngay** (kèm chọn kỳ), nút **Tạo lại link** (có `window.confirm`).
- Khi chưa có email: một dòng giải thích ngắn rằng để trống thì không gửi gì.

## 6. Trang phụ huynh — `app/ph/[token]/page.tsx`

Route công khai, nằm ngoài mọi route group hiện có, không gọi `auth()`.

- Tra `StudentProfile` theo `parentToken`. Không thấy → `notFound()`, không gợi ý gì thêm.
- Chỉ nhận token có `parentEmail` khác rỗng (tắt báo cáo thì link cũng ngưng hoạt động).
- Gắn `robots: { index: false, follow: false }` qua `metadata`.
- Thiết kế một cột, chữ to, đọc trên điện thoại là chính.

Bố cục theo thứ tự: đầu trang (tên con, lớp, mục tiêu band, mốc cập nhật) → 4 ô tóm tắt
+ câu `headline` → biểu đồ tiến bộ (tái dùng `ProgressLineChart` + `buildProgressSeries`)
→ bảng từng bài (không có link vào bài) → nhận xét của cô → điểm mạnh/điểm yếu.

Toàn bộ chữ tiếng Việt.

## 7. Cron — `app/api/cron/parent-reports/route.ts`

Lịch trong `vercel.json`: `{ "path": "/api/cron/parent-reports", "schedule": "0 5 * * 0" }`
(12h trưa Chủ nhật giờ VN).

Khuôn giống `app/api/cron/reminders/route.ts`:

1. Kiểm `authorization: Bearer <CRON_SECRET>`; chưa đặt `CRON_SECRET` thì chặn hết.
2. `warmUpDatabase()` trước mọi truy vấn (chống lỗi 500 do Neon ngủ).
3. `isEmailConfigured()` — chưa cấu hình thì trả về ghi chú, không ném lỗi.
4. `export const runtime = "nodejs"`, `dynamic = "force-dynamic"`, `maxDuration = 60`.

Lọc: học viên có `parentEmail`, `parentReportSentAt` không nằm trong 6 ngày gần đây,
và `shouldSendWeeklyReport()` trả `true`. Gửi xong mới ghi `parentReportSentAt`.
Một học viên lỗi thì ghi log và đi tiếp, không làm hỏng cả lượt chạy.

**Giới hạn hạ tầng đã biết:** gói Vercel Hobby cho tối đa 2 cron. Sau thay đổi này là
2/2. Muốn thêm cron thứ ba thì phải gộp nhiều việc vào một route.

## 8. Mail — `lib/parent-report-email.ts`

Hàm thuần `buildParentReportEmail(summary, link)` trả `{ subject, text, html }`,
song song bản chữ thuần và bản HTML như `lib/reminders.ts`.

Nội dung: lời chào theo `parentName` → câu `headline` → bảng bài đã làm và điểm →
danh sách bài chưa nộp → nhận xét mới nhất của cô → nút **Xem chi tiết tình hình học tập**
trỏ tới `/ph/<token>`.

Gửi qua `sendEmail()` sẵn có (Gmail App Password của cô, hạn mức 500 mail/ngày —
thừa sức cho quy mô lớp hiện tại).

## 9. Kiểm thử

`tests/parent-report.test.ts` (vitest, không cần DB):

- Số liệu tóm tắt tính đúng: bài Viết chưa chấm không bị tính 0; band chỉ tính bài đủ 40 câu.
- `shouldSendWeeklyReport` trả `false` khi kỳ đó không hoạt động và không nợ bài.
- `shouldSendWeeklyReport` trả `true` khi có bài quá hạn chưa làm dù con không nộp gì.
- `buildParentReportEmail` có đủ link và không chứa nội dung câu hỏi/đáp án.
- Bổ sung `tests/foundation.test.ts`: `schema.prisma` có đủ 4 cột mới và `ensure-db.mjs` nhắc tới cả 4.

Sau khi đẩy lên: kiểm trực tiếp trên Vercel + Neon — mở một link `/ph/<token>` thật,
kiểm token sai trả 404, và gọi cron bằng `CRON_SECRET` để xem mail có tới không.

## 10. Thứ tự thực thi đề xuất

1. Schema + `ensure-db.mjs` + test cấu trúc.
2. `lib/parent-report.ts` (hàm thuần) + test.
3. `lib/parent-report-query.ts`.
4. `lib/actions/parents.ts` + khối giao diện trong trang học viên.
5. Trang `/ph/[token]`.
6. `lib/parent-report-email.ts` + nút gửi tay.
7. Cron + `vercel.json`.
