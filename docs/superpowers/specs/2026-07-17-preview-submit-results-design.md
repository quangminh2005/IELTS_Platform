# Thiết kế: "Nộp & xem đáp án" trong phòng Xem trước của giáo viên

Ngày: 2026-07-17
Nhánh: `feature/ielts-platform-mvp`

## Mục tiêu

Ở phòng **Xem trước** (`/teacher/materials/[materialId]/preview`), giáo viên muốn
làm thử đề rồi **xem phần giải thích đáp án y như bên học viên**. Hiện tại phòng
xem trước chỉ là phòng làm bài trống: nút dưới cùng ("Thoát xem trước") chỉ đóng
lại, không chấm, không hiện đáp án/giải thích.

Mong muốn (đã chốt với người dùng): làm thử → bấm **Nộp** → **chấm ngay tại chỗ
(không lưu DB)** → hiện đúng **trang kết quả của học viên** kèm đáp án đúng + Giải
thích + transcript tô câu chứa đáp án.

## Bối cảnh (đã khảo sát)

- **Phòng xem trước tái dùng `AttemptWorkspace` ở `previewMode`.**
  `app/teacher/materials/[materialId]/preview/page.tsx` dựng `assignment` từ
  `Material` và render `<AttemptWorkspace previewMode ... />`. Truy vấn Prisma dùng
  `include` nên **đã nạp đủ mọi trường câu hỏi** (`correctAnswerJson`, `explanation`,
  `answerEvidence`, `points`), nhưng hàm map hiện chỉ truyền `optionsJson`.
- **`AttemptWorkspace` (`components/attempt-workspace.tsx`)** ở `previewMode`:
  hiện **tất cả các phần** cùng lúc (`activeUnits = assignment.units`), không lưu
  nháp, không ghi highlight. Nút nộp (`type="button"`) chỉ hỏi rồi `window.location`
  về Kho tài liệu (dòng ~2647). Kiểu `Question` của component **chỉ khai báo**
  `{ id, order, questionType, prompt, optionsJson }`.
- **Trang kết quả học viên** = `components/result-review.tsx` (`ResultReview`) →
  `components/result-answers.tsx` (`ResultAnswers`). Nhận `attempt.answers[]` với các
  trường `value`, `isCorrect`, `pointsAwarded`, `correctAnswerSnapshot`,
  `explanationSnapshot`, `evidenceSnapshot`, `annotations`, `question`, `assignableUnit`.
  Mỗi câu hiện "Bạn trả lời / Đáp án đúng / Giải thích"; Listening/Reading có cột
  transcript-bài đọc tô câu dẫn chứng. Không có "use server"/import server → **chạy
  được ở client**.
- **Logic chấm sẵn có, thuần, dùng lại được ở client:**
  - `lib/attempt-grading.ts` → `gradeUnits(units, getValue)` trả `answerRows`
    (đúng hình dạng snapshot mà `ResultReview` cần: `correctAnswerSnapshot`,
    `explanationSnapshot`, `evidenceSnapshot`, `isCorrect`, `pointsAwarded`) + `gradeItems`.
    Writing/Speaking → `isCorrect: null` (chờ chấm), vẫn set `explanationSnapshot`.
  - `lib/grading.ts` → `gradeAttempt(gradeItems)` gộp điểm.
  - Đã kiểm: `attempt-grading`, `answer-evidence`, `multi-select`, `question-interactions`,
    `band-score` **không** import server-only → import vào client component an toàn.
- **An toàn/rò rỉ đáp án:** trang làm bài THẬT của học viên
  (`app/student/assignments/[recipientId]/page.tsx`) cũng truyền cả object câu hỏi
  (kể cả `correctAnswerJson`) vào `AttemptWorkspace` — nên việc lộ đáp án cho client
  là **đã có sẵn**, không phải do thay đổi này. Chấm ở client CHỈ chạy khi
  `previewMode` (trang giáo viên, đã `requireTeacher`); học viên vẫn chấm ở server.

## Quyết định thiết kế (đã thống nhất với người dùng)

Chấm **hoàn toàn trong trình duyệt** bằng chính hàm chấm của server, và tái dùng
**đúng component `ResultReview`** của học viên. Không server action, không ghi DB.
Ưu điểm: kết quả không lệch với server, giao diện đúng y bên học viên, sửa nhỏ gọn
trong 2 file.

(Đã cân nhắc và loại: (2) server action `gradePreview` — thừa một vòng gọi mạng, phòng
xem trước là của chính giáo viên nên không cần giấu đáp án; (3) route kết quả riêng —
mất đáp án đang điền khi chuyển trang, phức tạp hơn.)

## Chi tiết thay đổi

### 1. `preview/page.tsx` — truyền thêm trường chấm điểm

Trong hàm map `questions`, bổ sung 4 trường (chỉ ở phòng xem trước):
`correctAnswerJson`, `explanation`, `answerEvidence`, `points`. `content`,
`transcript`, `skill`, `title` của phần đã có sẵn trong `assignableUnit`.

### 2. `attempt-workspace.tsx` — chấm client + màn kết quả xem trước

- Mở rộng kiểu `Question`: thêm `correctAnswerJson?`, `explanation?`,
  `answerEvidence?`, `points?` (đều **tùy chọn** → không ảnh hưởng caller khác;
  chỉ đọc khi `previewMode`).
- Thêm state `previewResult: PreviewResult | null` (đối tượng có hình dạng
  `attempt` mà `ResultReview` mong đợi).
- Hàm `gradePreview()` (chỉ gọi ở `previewMode`):
  1. Dựng `UnitForGrading[]` từ `activeUnits` (đủ 4 trường + `content`/`transcript`/`skill`).
  2. `const { answerRows, gradeItems } = gradeUnits(units, (id) => answers[id] ?? "")`.
  3. `const grade = gradeAttempt(gradeItems)`.
  4. Ghép `answerRows` với dữ liệu câu/phần (order, prompt, points, answerEvidence,
     title, skill, content, transcript) → `attempt.answers[]`; `annotations: []`,
     `highlights: []`, `review: null`, `status: "submitted"`,
     `score/scorePercent` từ `grade`. Đặt vào `previewResult`.
- Nút dưới cùng ở `previewMode`: đổi nhãn thành **"Nộp & xem đáp án"**, `onClick`
  gọi `gradePreview()` (bỏ hộp thoại xác nhận thoát). Lối thoát vẫn là link
  "‹ Kho tài liệu" ở header.
- Render: trước `return createPortal(content, ...)`, nếu `previewMode && previewResult`
  → `createPortal(previewResultsContent, document.body)`. `previewResultsContent` là
  màn full-screen `fixed inset-0 z-50 flex flex-col bg-background`:
  - Header: tiêu đề "Kết quả xem trước" + nút **"‹ Làm lại"** (`setPreviewResult(null)`,
    giữ nguyên đáp án) + link "‹ Kho tài liệu".
  - Thân cuộn `overflow-y-auto`, bọc `<ResultReview attempt={previewResult} />`
    trong `mx-auto max-w-6xl p-5`.

## Không nằm trong phạm vi (YAGNI)

- Không đổi hành vi trang làm bài/kết quả THẬT của học viên.
- Không lưu kết quả xem trước vào DB; không nút chia sẻ/xuất.
- Không chấm Writing/Speaking (giữ "chờ chấm" như học viên) — chỉ hiện đáp án mẫu
  (`explanation`) nếu có.

## Kiểm thử

- `pnpm lint` + `pnpm build` xanh.
- Thủ công trên dev server với chính đề Reading trong yêu cầu: làm vài câu đúng/sai,
  bỏ trống vài câu → **Nộp & xem đáp án** → kiểm: điểm/tỉ lệ đúng khớp; mỗi câu hiện
  đáp án đúng + Giải thích; transcript/bài đọc tô câu chứa đáp án khi bấm vào câu;
  bấm **Làm lại** quay về giữ nguyên đáp án; **Kho tài liệu** thoát được.
- (Tùy chọn) nếu tách hàm dựng `attempt.answers` ra file thuần → thêm 1 unit test nhỏ.
