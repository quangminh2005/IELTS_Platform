# Lập dàn ý trước khi nói (Speaking) — thiết kế

Ngày: 25/9/2026 · Trạng thái: đã duyệt

## Mục tiêu
Với bài Nói có thời gian chuẩn bị, học viên viết dàn ý vào một ô trên màn làm bài,
có đồng hồ đếm ngược; hết giờ thì không sửa được nữa. Giáo viên xem dàn ý khi chấm
để biết học viên lên ý tưởng thế nào.

## Quyết định (đã chốt với GV)
- Là **tuỳ chọn khi giao bài**: ô tick "Cho học viên lập dàn ý trước khi nói" + số
  phút chuẩn bị (mặc định 1, cho phép 1–10). Lưu ở `Assignment.speakingPrepMinutes`
  (null = tắt). Bài tự luyện thư viện không bật.
- Áp dụng cho **mọi câu Nói** trong bài giao đã bật.
- **Khoá ghi âm tới khi hết giờ chuẩn bị** (hoặc học viên bấm "Xong, nói luôn").

## Luồng học viên (mỗi câu Nói)
1. Chưa bắt đầu: hiện đề + nút "Bắt đầu chuẩn bị (N phút)". Không có nút ghi âm.
2. Bấm → server ghi `startedAt`. Hiện ô dàn ý + đồng hồ đếm ngược; tự lưu vài giây/lần.
3. Hết giờ hoặc bấm "Xong, nói luôn" → lưu lần cuối + khoá. Ô dàn ý chỉ đọc nhưng vẫn
   hiện để nhìn khi nói; lúc này mới hiện phần ghi âm. "Ghi âm lại" không mở khoá dàn ý.
4. Tải lại trang: đồng hồ tính theo giờ thật từ `startedAt` (server tính số giây còn
   lại khi dựng trang), không chạy lại từ đầu.
5. Câu đã có bản ghi từ trước khi GV bật tuỳ chọn → hiện luôn phần ghi âm, không chặn.

## Lưu trữ
Bảng mới `SpeakingPlan` — tách khỏi `Answer` vì Answer bị xoá/tạo lại mỗi lần lưu nháp
và nộp bài.

```
SpeakingPlan { id, attemptId → Attempt (cascade), questionId → Question (cascade),
               text (default ""), startedAt, lockedAt?, updatedAt
               @@unique([attemptId, questionId]) }
```
Reset lượt làm (`resetRecipientAttempts`) xoá Attempt → dàn ý xoá theo.
Cột/bảng mới thêm vào `scripts/ensure-db.mjs` để build tự áp lên prod.

## Server actions (`lib/actions/speaking-plan.ts`)
Cả hai gọi `requireStudent()` trước, rồi kiểm: attempt của đúng học viên, đang
`in_progress`, kỹ năng speaking chưa nộp, bài giao có `speakingPrepMinutes`, câu hỏi
thuộc unit Nói của bài giao.
- `startSpeakingPlan({attemptId, questionId})` — idempotent: đã có dòng thì trả lại dòng
  cũ (không đặt lại giờ). Trả `{ text, locked, remainingSeconds }`.
- `saveSpeakingPlan({attemptId, questionId, text, lock})` — nhận chữ chỉ khi chưa khoá và
  chưa quá `startedAt + N phút + 10 giây` (trễ mạng). Quá hạn → không ghi chữ, đặt
  `lockedAt` nếu chưa có, trả `locked: true`. `lock: true` → ghi chữ + khoá ngay.
  Chữ tối đa 5000 ký tự.

Logic giờ (hạn chót, số giây còn lại, còn được sửa không, thời gian đã dùng) là hàm
thuần trong `lib/speaking-plan.ts`, có unit test.

## Giáo viên chấm (`/teacher/review/[attemptId]`)
Mỗi câu Nói: phía trên file ghi âm có khung "Dàn ý của học viên" + "viết trong m:ss /
N:00". Bài có bật tuỳ chọn mà học viên không lập → "Học viên không lập dàn ý".

## Kiểm thử
- Unit test hàm thuần `lib/speaking-plan.ts`.
- Test cấu trúc: action gọi `requireStudent()`; `ensure-db.mjs` có bảng + cột mới.
- Kiểm tay trên dev: giao bài có bật → làm bài → đếm ngược → khoá → ghi âm → xem ở trang chấm.
