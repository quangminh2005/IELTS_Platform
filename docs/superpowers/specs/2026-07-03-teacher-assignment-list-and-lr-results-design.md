# Thiết kế: Danh sách bài theo ngày + trang kết quả chi tiết L/R cho giáo viên

Ngày: 2026-07-03
Trạng thái: người dùng đã duyệt thiết kế (mockup danh sách + mở rộng dưới thẻ). Đây là bản lặp trên tính năng "Lịch giao bài" vừa hoàn thành.

## 1. Bối cảnh & vấn đề

Màn "Lịch giao bài" (`/teacher/calendar`) hiện dùng **lịch tháng**. Người dùng thấy không ổn: ô ngày chật, chip bài bị cắt cụt ("1/1 · …", "+1 bài"), nhiều ô trống. Đồng thời, khi bấm "Xem bài" trên một bài **Listening/Reading**, nút trỏ tới `/teacher/review/[attemptId]` — trang này **chỉ lấy câu Writing/Speaking** nên hiện "Không tìm thấy bài làm Writing/Speaking" + form chấm tay (sai với L/R). Giáo viên **không có** chỗ xem kết quả chi tiết L/R, dù học viên có trang kết quả (`ResultReview`).

Hai thay đổi (đã chốt với người dùng):
- **A.** Bỏ lịch tháng, chuyển sang **danh sách bài nhóm theo ngày**, bấm thẻ bài để **mở rộng chi tiết học viên ngay bên dưới** (accordion).
- **B.** Thêm **trang kết quả chi tiết cho giáo viên** cho bài L/R (từng câu đúng/sai, đáp án, giải thích), tái dùng `ResultReview`.

## 2. Phần A — Danh sách theo ngày (thay lịch)

Rework client component `components/assignment-calendar.tsx` (giữ tên file/route để ít xáo trộn; route vẫn `/teacher/calendar`, nav vẫn "Lịch giao bài").

- **Thanh trên** giữ nguyên: toggle *Theo ngày giao ⇄ Theo hạn nộp* + ô lọc lớp ("Tất cả lớp" + từng lớp).
- **Thân**: các bài **nhóm theo ngày**, ngày mới nhất lên đầu. Mỗi ngày có tiêu đề dạng "Thứ Sáu, 3 tháng 7, 2026 · N bài" (định dạng theo `vi-VN`, timeZone `Asia/Ho_Chi_Minh`).
- Mỗi bài là một **thẻ** (accordion): dòng đầu hiện tiêu đề, hạn nộp (hoặc "Không đặt hạn"), số phần, badge `đã nộp/tổng` (đếm theo lớp đang lọc). Bấm thẻ → **mở rộng ngay bên dưới** danh sách học viên nhóm theo lớp: mỗi học viên hiện trạng thái (Đã nộp / Đang làm dở / Chưa làm), Đúng/Trễ hạn, thời gian làm, kết quả (Band + số câu đúng, hoặc % , hoặc "Chờ chấm"), nút "Xem bài".
- Nhiều thẻ có thể mở cùng lúc (mỗi thẻ có state đóng/mở riêng). Mặc định tất cả đóng; hoặc mở sẵn thẻ đầu tiên của ngày mới nhất (tùy chọn nhỏ, quyết định ở plan — mặc định: đóng hết).
- Chế độ "Theo hạn nộp": bài không có hạn không lên danh sách; hiện ghi chú "N bài chưa đặt hạn".
- Bỏ hẳn lịch tháng và side panel. `buildMonthGrid` (và test của nó) không còn dùng → **xóa** để tránh code chết.

### Hàm thuần mới (tách để test)
Trong `lib/assignment-calendar.ts`:
- `groupAssignmentsByDayDescending(assignments: CalendarAssignment[], mode: CalendarMode): Array<{ dayKey: string; assignments: CalendarAssignment[] }>` — gom theo ngày (giờ VN, tái dùng `bucketAssignmentsByDay`), sắp xếp **ngày giảm dần** theo chuỗi `YYYY-MM-DD`.
- Giữ nguyên `bucketAssignmentsByDay`, `vnDayKey`, `isSubmissionLate`, `countGradedAnswers`, `studentsGroupedByClass`, `formatAttemptResult`.
- Xóa `buildMonthGrid` + test tương ứng.

## 3. Phần B — Trang kết quả chi tiết cho giáo viên

Route mới `app/teacher/results/[attemptId]/page.tsx` (server component):
- `requireTeacher()` trước tiên. Query `attempt` theo `id` **và** scope quyền sở hữu: `assignmentRecipient.assignment.teacherId === teacher.id`, `status ∈ {submitted, reviewed}`.
- Include đúng dạng `ResultReview` cần (giống trang kết quả học viên `app/student/results/[attemptId]/page.tsx`): `score`, `scorePercent`, `status`; `answers` **mọi kỹ năng** (không lọc), kèm `question { order, prompt, points }`, `assignableUnit { title, skill }`, `isCorrect`, `pointsAwarded`, `correctAnswerSnapshot`, `explanationSnapshot`, `annotations`; `highlights`; `review { overallBand, criteriaScoresJson, summaryFeedback, detailedFeedback }`.
- Render header giáo viên (tên + email học viên, tiêu đề bài, thời gian làm `formatDuration`, nút quay lại) rồi `<ResultReview attempt={attempt} />`.
- `notFound()` nếu không tìm thấy/không thuộc giáo viên.
- Đây là trang **chỉ đọc**: `ResultReview` hiển thị `AnnotatedAnswer` ở chế độ đọc (không `editable`), không có form chấm. Chấm Writing/Speaking vẫn theo luồng "Chấm bài" hiện có.

### Wiring "Xem bài"
Trong danh sách (Phần A), nút "Xem bài" của mỗi học viên đã nộp trỏ tới `/teacher/results/{attempt.id}` (thay cho `/teacher/review/{attempt.id}`).

## 4. Không đổi

- Không đổi schema Prisma.
- Không đổi luồng chấm Writing/Speaking ("Chấm bài" + `/teacher/review/[attemptId]` giữ nguyên cho việc chấm).
- `deadline` vẫn chỉ hiển thị + đánh dấu trễ (không khóa nộp).
- Server page `/teacher/calendar/page.tsx` (truy vấn dữ liệu) giữ nguyên — chỉ component hiển thị đổi.

## 5. Kiểm thử

- Unit (vitest) cho `groupAssignmentsByDayDescending`: gom đúng ngày theo giờ VN, sắp xếp giảm dần, chế độ hạn nộp loại bài không hạn.
- Xóa test `buildMonthGrid`.
- Structural test: tồn tại `app/teacher/results/[attemptId]/page.tsx`.
- Danh sách + trang kết quả: kiểm chứng bằng build/lint và preview (đăng nhập giáo viên trên bản live).

## 6. Ngoài phạm vi (YAGNI)

- Không thêm nút "Chấm Writing/Speaking" trên trang kết quả (giáo viên dùng "Chấm bài" như cũ) — có thể thêm sau nếu cần.
- Không phân trang/tải theo khoảng thời gian (dữ liệu còn nhỏ).
- Không thêm tìm kiếm/sắp xếp nâng cao trong danh sách.
