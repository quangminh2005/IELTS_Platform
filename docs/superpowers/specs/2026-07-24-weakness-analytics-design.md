# Phân tích tiến bộ & điểm yếu theo dạng câu — Thiết kế

**Ngày:** 2026-07-24
**Trạng thái:** Đã duyệt thiết kế với giáo viên (chờ triển khai)

## Mục tiêu

Biến dữ liệu đúng/sai đã có sẵn trong bảng `Answer` thành hai màn hình phân tích:

1. **Học sinh** tự thấy tiến bộ theo thời gian và dạng câu mình yếu nhất.
2. **Giáo viên** thấy câu cả lớp sai nhiều nhất trong từng bài giao, và điểm yếu
   của từng học sinh — để biết cần chữa gì trên lớp.

Không đổi schema, không thêm dependency. Mọi số liệu tính trực tiếp lúc render
(quy mô lớp nhỏ, truy vấn tức thì), biểu đồ vẽ bằng SVG tự viết (cùng nếp với
`progress-ring.tsx`).

## Quyết định thiết kế đã chốt

| Câu hỏi | Quyết định |
|---|---|
| Phạm vi | Làm cả phía học sinh lẫn giáo viên trong một đợt |
| Nhóm dạng câu | Gộp 9 dạng auto-grade thành **5 nhóm lớn** (bảng dưới) |
| Chỉ số biểu đồ tiến bộ | **% đúng** theo thời gian, tách 2 đường Nghe/Đọc; band chỉ hiện trong tooltip khi bài đủ 40 câu |
| Kiến trúc | Tính trực tiếp khi render, không bảng tổng hợp, không thư viện chart |

### Bảng quy đổi 5 nhóm dạng câu

| Nhóm (nhãn hiển thị) | Gồm các `questionType` |
|---|---|
| Trắc nghiệm | `multiple_choice` |
| True/False/Not Given | `true_false_not_given` |
| Nối (matching) | `matching`, `drag_drop_matching` |
| Điền từ | `gap_fill`, `inline_gap_fill`, `note_completion`, `table_completion` |
| Trả lời ngắn | `short_answer` |

`writing_task` / `speaking_task` chấm tay (`isCorrect = null`) — không vào thống kê.

## Phần 1 — Học sinh: trang "Tiến bộ" (`/student/stats`)

Thêm mục **"Tiến bộ"** vào menu học sinh trong `app-shell.tsx`
(cạnh Tổng quan / Lịch sử / Xếp hạng). Trang gồm 2 khối:

### Khối 1 — Biểu đồ tiến bộ theo thời gian

- Biểu đồ đường SVG: trục ngang = ngày nộp, trục dọc = % đúng (0–100).
- 2 đường: **Nghe** và **Đọc** (bài có cả 2 kỹ năng → 2 điểm cùng ngày).
- Mỗi điểm = một attempt đã nộp; % của kỹ năng = số câu đúng / tổng số câu của
  kỹ năng đó trong bài (tính từ `Answer`, dùng lại `bandsBySkill`).
- Tooltip khi chạm/hover: tên bài, ngày nộp, số câu đúng (vd 32/40), band nếu
  là đề đủ 40 câu (`bandScore` trả khác null).
- Chỉ tính attempt `status ∈ {submitted, reviewed}`. Mỗi kỹ năng lấy tối đa
  **20 bài gần nhất**.

### Khối 2 — Tỷ lệ đúng theo dạng câu

- 3 tab: **Tất cả · Nghe · Đọc**.
- Mỗi nhóm trong 5 nhóm là một thanh ngang: % đúng + chi tiết
  (vd "68% · đúng 34/50 câu").
- **Nhóm yếu nhất**: % thấp nhất trong các nhóm có **≥ 10 câu** dữ liệu; nếu
  hòa % thì chọn nhóm nhiều câu hơn. Tô nổi bật kèm lời nhắn
  *"Bạn đang yếu nhất ở dạng … — nên luyện thêm"*.
- Nhóm **< 5 câu** dữ liệu: hiển thị mờ + chữ "chưa đủ dữ liệu".
- Không có dữ liệu nào (tab rỗng): dòng "Chưa có bài nào ở kỹ năng này".

### Trạng thái trống

Chưa nộp bài nào → thay cả trang bằng lời mời "Nộp bài đầu tiên để xem tiến bộ
của bạn" + link về Tổng quan.

## Phần 2 — Giáo viên

### 2a. Thống kê theo bài giao — `/teacher/assignments/[assignmentId]/stats`

Vào từ nút **"Thống kê"** trên từng bài ở `assignment-list.tsx`.

- **Đầu trang**: tên bài + tiến độ nộp ("12/15 học sinh đã nộp"). Mọi số liệu
  chỉ tính attempt đã nộp (`submitted`/`reviewed`).
- **Top 5 câu sai nhiều nhất** (toàn bài): số thứ tự câu, trích đầu câu hỏi,
  % học sinh sai.
- **Bảng chi tiết theo từng phần** (unit — passage/part): nguồn danh sách câu
  là `Question` của các unit trong bài (không phải từ `Answer`), ghép answers
  theo `questionId` — câu chưa ai trả lời vẫn hiện dòng với "0/12 sai". Câu
  theo thứ tự `Question.order`:
  - Số câu + trích câu hỏi (rút gọn ~80 ký tự)
  - Đáp án đúng (từ `correctAnswerSnapshot` của answer, fallback
    `correctAnswerJson`)
  - **% sai** dạng "9/12 sai · 75%" — dòng ≥ 50% sai tô nền đỏ nhạt
  - **Đáp án sai phổ biến**: gom `Answer.value` sai giống nhau
    (case-insensitive, trim), hiện tối đa 3 loại kèm số người
    (vd `"B" ×5 · "D" ×2 · bỏ trống ×2`). Giá trị rỗng hiển thị "bỏ trống".
- Unit Viết/Nói: không vào bảng, chỉ ghi chú "chấm tay".
- Chưa ai nộp: trang vẫn mở, hiện "Chưa có học sinh nào nộp bài".

### 2b. Điểm yếu từng học sinh — thêm vào `/teacher/students/[studentId]`

Nhúng lại **đúng 2 component** của trang Tiến bộ học sinh (biểu đồ đường +
khối 5 nhóm dạng câu) vào trang hồ sơ học sinh hiện có, phía trên danh sách
bài làm. Giáo viên thấy đúng cái học sinh thấy.

### Bảo mật

- `/teacher/assignments/[id]/stats`: `requireTeacher()` + scoping
  `assignment.teacherId = teacher.id` (404 nếu không phải bài của mình).
- Trang hồ sơ học sinh đã scoping sẵn theo lớp của giáo viên — giữ nguyên.
- `/student/stats`: chỉ đọc dữ liệu của chính học sinh đang đăng nhập
  (qua `StudentProfile.userId = session.user.id`, giống trang Lịch sử).

## Kiến trúc & luồng dữ liệu

| File | Vai trò |
|---|---|
| `lib/question-stats.ts` *(mới)* | Logic thuần: map 9 dạng → 5 nhóm (nhãn tiếng Việt); tính % đúng theo nhóm/kỹ năng; chọn nhóm yếu nhất; dựng chuỗi điểm biểu đồ từ danh sách attempt+answers (dùng lại `bandsBySkill`/`bandScore`); gom đáp án sai phổ biến theo câu |
| `components/progress-line-chart.tsx` *(mới)* | Client component: biểu đồ đường SVG 2 kỹ năng, tooltip |
| `components/question-type-stats.tsx` *(mới)* | Client component: 3 tab + 5 thanh nhóm dạng câu, nhãn yếu nhất |
| `app/student/stats/page.tsx` *(mới)* | Server component: auth student → truy vấn Prisma → gọi lib → render |
| `app/teacher/assignments/[assignmentId]/stats/page.tsx` *(mới)* | Server component: requireTeacher + scoping → truy vấn → render bảng (server-render thuần, không cần client) |
| `components/app-shell.tsx` *(sửa)* | Thêm menu "Tiến bộ" cho học sinh |
| `components/assignment-list.tsx` *(sửa)* | Thêm nút "Thống kê" mỗi bài |
| `app/teacher/students/[studentId]/page.tsx` *(sửa)* | Truy vấn thêm answers + nhúng 2 component |

Luồng: server component truy vấn Prisma (`Answer` kèm `isCorrect`,
`question.questionType`, `question.order`, `question.prompt`,
`assignableUnit.skill`, attempt `submittedAt`/`status`) → hàm thuần trong
`lib/question-stats.ts` → truyền số liệu đã tính xuống component qua props.
Không API route mới, không migration, không đụng `ensure-db.mjs`.

## Ca biên

- **Câu hỏi đã bị xóa** (re-import tài liệu → `Answer.questionId = null`):
  vẫn tính vào % biểu đồ tiến bộ (dựa `isCorrect`), bỏ qua ở thống kê theo
  dạng (không biết dạng).
- **Bài chỉ có Viết/Nói**: không có câu auto-grade → không tạo điểm trên biểu
  đồ, không lỗi chia 0.
- **Reset bài làm** (`resetRecipientAttempts`): answers bị xóa cascade → số
  liệu tự đúng lại vì tính trực tiếp.
- **Bỏ trống**: `Answer.value = ""` đã được tạo cho mọi câu khi nộp
  (xem `gradeUnits`) → tính là sai, hiển thị "bỏ trống" ở cột đáp án phổ biến.
- **Hai bảng quy đổi phải khớp import**: 5 nhóm phủ đủ 9 dạng auto-grade trong
  `questionTypes` (`lib/actions/materials.ts`). Khi thêm dạng câu mới phải thêm
  vào map — có unit test ép điều này.

## Kiểm thử

Unit test vitest mới `tests/question-stats.test.ts` cho `lib/question-stats.ts`:

1. **Phủ đủ dạng**: mọi phần tử của `questionTypes` (trừ `writing_task`,
   `speaking_task`) đều map ra một trong 5 nhóm — import trực tiếp danh sách
   từ `lib/actions/materials.ts` để không lệch khi thêm dạng mới.
2. Tính % đúng theo nhóm và theo kỹ năng (kể cả answer thiếu `questionType`).
3. Chọn nhóm yếu nhất: ngưỡng ≥ 10 câu, hòa % → nhóm nhiều câu hơn, không nhóm
   nào đủ → null.
4. Ngưỡng "chưa đủ dữ liệu" (< 5 câu).
5. Dựng chuỗi biểu đồ: lọc đúng status, cắt 20 bài gần nhất mỗi kỹ năng, band
   chỉ có ở bài 40 câu.
6. Gom đáp án sai phổ biến: gộp case-insensitive, "bỏ trống" cho value rỗng,
   cắt top 3.

Không đổi schema/seed nên các structural test hiện có không bị ảnh hưởng.

## Ngoài phạm vi (đợt sau)

- Thư viện tự luyện, badges (các mục khác của roadmap).
- Thống kê cho Viết/Nói (band do giáo viên chấm theo thời gian).
- Bảng tổng hợp trong DB (chỉ cần khi dữ liệu lớn hơn nhiều).
- Lọc theo khoảng thời gian / theo lớp.
