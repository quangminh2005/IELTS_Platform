# Thiết kế: Lịch giao bài & theo dõi nộp bài (khu vực giáo viên)

Ngày: 2026-07-03
Trạng thái: đã được người dùng duyệt bố cục (mockup), chờ duyệt spec.

## 1. Mục tiêu

Cho giáo viên một màn hình trực quan để **xem lại các bài đã giao theo ngày và theo lớp**. Ví dụ: giao bài ngày 3/7, hôm sau 4/7 giao bài khác; khi bấm xem ngày 3/7, giáo viên thấy được bài hôm đó **ai đã nộp, đúng hạn hay trễ hạn, làm trong bao lâu, kết quả ra sao** của từng học viên, tách theo lớp.

Đây là màn hình **chỉ đọc** (read-only) để theo dõi. Không tạo/sửa/xóa bài ở đây (việc đó vẫn ở trang "Giao bài").

## 2. Phát hiện quan trọng về dữ liệu

`createAssignment` **không lưu `Assignment.classId`** — bài chỉ gắn với **từng học viên** qua `AssignmentRecipient`. Học viên thuộc lớp qua `ClassStudent`. Vì vậy:

- "Theo lớp" phải **suy ra từ lớp của học viên nhận bài**, không phải từ `Assignment.classId`.
- Một bài có thể có học viên ở **nhiều lớp** → panel chi tiết nhóm học viên theo lớp.
- Một học viên có thể thuộc **nhiều lớp** → khi lọc theo lớp X, chỉ tính học viên là thành viên lớp X.

Không đổi schema — mọi trường cần thiết đã có: `Attempt.startedAt/submittedAt/elapsedSeconds/score/scorePercent/status`, `AssignmentRecipient.status/submittedAt`, `Assignment.deadline/createdAt`, `Answer.isCorrect`.

## 3. Điều hướng & route

- Thêm mục sidebar giáo viên: **"Lịch giao bài"**, icon lịch mới (`calendar`), đặt giữa "Giao bài" và "Chấm bài" trong `navByRole.teacher` (`components/app-shell.tsx`).
- Thêm biến thể icon `"calendar"` vào `IconName` + hàm `Icon` trong `components/app-shell.tsx`.
- Route mới: `app/teacher/calendar/page.tsx` (server component, gate bằng `requireTeacher()`).

## 4. Bố cục màn hình (đã duyệt qua mockup)

Hai cột: **lịch tháng bên trái**, **panel chi tiết bên phải** (không rời trang). Trên màn nhỏ thì xếp dọc.

### 4.1 Thanh trên cùng
- Nút chuyển đổi hai chế độ: **Theo ngày giao** (mặc định) ⇄ **Theo hạn nộp**.
- Ô chọn lớp: "Tất cả lớp" + từng lớp của giáo viên.

### 4.2 Lịch tháng (trái)
- Điều hướng tháng: ◀ ▶ + nhãn "Tháng M, YYYY". (Tùy chọn: nút "Hôm nay".)
- Mỗi ngày là một ô. Ô có bài giao/hết hạn hiện **chip số đã nộp** dạng `đã nộp/tổng` (ví dụ `2/3`). Nếu một ngày có nhiều bài, hiện tối đa vài chip rồi "+N".
- Ngày hôm nay có dấu hiệu riêng (vòng tròn). Ngày/bài đang chọn được tô nền nhấn.
- Chế độ "Theo ngày giao": xếp bài theo `createdAt` (theo giờ VN, +07:00).
- Chế độ "Theo hạn nộp": xếp bài theo `deadline`. **Bài không có deadline không xuất hiện** ở chế độ này (hiển thị ghi chú nhỏ "N bài chưa đặt hạn").

### 4.3 Panel chi tiết (phải)
Khi chọn một bài (bấm chip):

- **Đầu panel**: tiêu đề bài, "Giao {ngày} · Hạn nộp {ngày giờ hoặc 'Không đặt hạn'} · {số phần} phần", badge `{đã nộp}/{tổng} đã nộp`.
- **Danh sách học viên nhóm theo lớp** (tiêu đề nhóm = tên lớp). Nếu đang lọc theo một lớp thì chỉ hiện lớp đó; nếu "Tất cả lớp" thì hiện tất cả nhóm lớp mà bài đụng tới. Học viên không thuộc lớp nào xếp vào nhóm "Chưa xếp lớp".
- **Hiện tất cả học viên được giao**, kể cả chưa nộp. Mỗi học viên một thẻ:
  - Avatar chữ cái + tên + email.
  - **Trạng thái**: "Đã nộp" / "Đang làm dở" / "Chưa làm" (suy từ `AssignmentRecipient.status` + attempt).
  - **Đúng/Trễ hạn** (chỉ khi đã nộp và bài có deadline): so `attempt.submittedAt` với `deadline`.
  - **Thời gian làm**: từ `attempt.elapsedSeconds`, format "X phút" (hoặc "X phút Y giây" nếu <1 phút).
  - **Kết quả**: **band điểm + số câu đúng** (ví dụ `8.0 · 35/40`).
    - Band lấy từ `attemptBand(attempt.scoreBand?, answers)` (tái dùng `lib/band-score.ts`). Nếu không quy đổi được band (bài lẻ) thì hiện `%` thay cho band (ví dụ `88% · 35/40`).
    - Số câu đúng/tổng: đếm `answers` đã chấm tự động (`isCorrect !== null`), đúng = `isCorrect === true`.
    - Bài Writing/Speaking (chấm tay, `isCorrect === null`) hoặc chưa chấm xong → hiện "Chờ chấm".
  - **Nút "Xem bài"** → `/teacher/review/[attemptId]` (trang xem/chấm chi tiết đã có). Chỉ hiện khi có attempt đã nộp.

## 5. Kiến trúc

### 5.1 Truy vấn dữ liệu (server component)
`app/teacher/calendar/page.tsx`:
- `requireTeacher()` trước tiên.
- Lấy các lớp của giáo viên + thành viên (để dựng ô chọn lớp và ánh xạ học viên → lớp).
- Lấy các assignment của giáo viên kèm: `recipients` → `student` (+ lớp), và attempt mới nhất của mỗi recipient kèm `answers { isCorrect, + skill của unit }` để tính band/số câu đúng. Reuse cách trang kết quả hiện có lấy `skill` cho mỗi answer.
- Truyền dữ liệu đã chuẩn hóa xuống client component.

Cân nhắc phạm vi truy vấn: giới hạn theo khoảng thời gian đang xem (tháng hiện tại ± đệm) nếu dữ liệu lớn; ở giai đoạn đầu có thể lấy toàn bộ assignment của giáo viên rồi lọc phía client (số lượng nhỏ). Quyết định cuối để ở bước viết plan.

### 5.2 Component client
`components/assignment-calendar.tsx` (hoặc tên tương đương):
- State: tháng đang xem, chế độ (ngày giao/hạn nộp), lớp đang lọc, bài đang chọn.
- Nhận dữ liệu bài đã chuẩn hóa (mảng phẳng) + danh sách lớp từ server.
- Dựng lưới lịch, chip, panel chi tiết. Không gọi server action (chỉ đọc).

### 5.3 Hàm thuần (tách riêng để test)
Đặt ở `lib/assignment-calendar.ts` (mới):
- `bucketAssignmentsByDay(assignments, mode)` — gom bài vào ngày theo `createdAt` hoặc `deadline` (theo giờ VN), trả về map "YYYY-MM-DD" → bài.
- `isSubmissionLate(submittedAt, deadline)` — dùng chung, thay cho logic `isLate` đang lặp ở `app/teacher/review/page.tsx` (refactor để tái dùng).
- `formatWorkDuration(elapsedSeconds)` — format thời gian làm.
- `studentsGroupedByClass(recipients, classes, selectedClassId)` — gom học viên theo lớp, áp bộ lọc lớp.
- Kết quả/band tái dùng `lib/band-score.ts` (`attemptBand`, `bandsBySkill`), không viết lại.

## 6. Xử lý các trường hợp biên

- Bài không có deadline: ở chế độ "hạn nộp" không lên lịch; ở panel hiện "Không đặt hạn", và không có nhãn đúng/trễ.
- Học viên chưa có attempt: trạng thái "Chưa làm", không có thời gian/kết quả/nút xem.
- Attempt đang làm dở (`in_progress`): "Đang làm dở", chưa có kết quả.
- Học viên thuộc nhiều lớp: khi lọc theo lớp X chỉ hiện dưới nhóm X; khi "Tất cả lớp" hiện ở nhóm mỗi lớp mà học viên là thành viên (tránh trùng: mỗi thẻ học viên thuộc đúng một nhóm theo lớp đang xét — nếu ở "Tất cả lớp" thì gom theo lớp, một học viên nhiều lớp sẽ xuất hiện ở mỗi nhóm lớp của họ; chấp nhận vì phản ánh đúng "theo lớp").
- Bài đụng học viên không thuộc lớp nào: nhóm "Chưa xếp lớp".
- Ngày có nhiều bài: chip "+N", bấm mở danh sách bài trong ngày để chọn.

## 7. Kiểm thử

Unit test (vitest) cho các hàm thuần trong `lib/assignment-calendar.ts`:
- `bucketAssignmentsByDay`: xếp đúng ngày theo giờ VN cho cả hai chế độ; bài không deadline bị loại ở chế độ hạn nộp.
- `isSubmissionLate`: đúng/trễ/không có deadline.
- `formatWorkDuration`: phút, phút+giây, 0 giây.
- `studentsGroupedByClass`: gom nhóm, lọc lớp, học viên nhiều lớp, "Chưa xếp lớp".

Nếu refactor `isLate` ở trang Chấm bài sang hàm chung, đảm bảo hành vi nhãn "Trễ hạn" ở đó không đổi.

## 8. Ngoài phạm vi (YAGNI)

- Không thêm khóa/chặn nộp sau hạn (deadline vẫn chỉ để hiển thị + đánh dấu trễ, như hiện tại).
- Không xuất Excel/PDF.
- Không sửa bài, không chấm điểm ngay trên màn này (dùng nút "Xem bài" sang trang chấm sẵn có).
- Không thống kê tổng hợp nâng cao (trung bình lớp, biểu đồ) — có thể thêm sau.
