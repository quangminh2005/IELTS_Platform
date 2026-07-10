# Thiết kế: Thời gian làm bài theo từng kỹ năng

**Ngày:** 2026-07-10
**Nhánh:** feature/ielts-platform-mvp

## Bối cảnh & vấn đề

Trang kết quả (giáo viên và học sinh) hiện chỉ hiển thị **một** con số tổng thời gian
làm bài — `Attempt.elapsedSeconds`. Con số này là thời gian đồng hồ tính từ
`Attempt.startedAt` đến lúc nộp, không phân biệt học sinh đang làm Reading hay
Listening. Giáo viên muốn xem thời gian làm bài **tách theo từng kỹ năng**
(ví dụ: Reading 45 phút · Listening 30 phút).

Không có cách nào tính ngược thời gian theo kỹ năng cho các bài đã nộp — dữ liệu đó
chưa từng được ghi lại. Vì vậy tính năng chỉ áp dụng cho **bài làm mới từ nay về sau**.

## Ràng buộc đã chốt với người dùng

- Học sinh làm bài **tuần tự** (xong phần nào chuyển phần đó), không nhảy qua lại nhiều.
  Cách bấm giờ chọn ở đây vẫn hoạt động đúng kể cả khi họ quay lại phần cũ.
- Hiển thị ở **cả hai chỗ**: một dòng nhỏ trong mỗi thẻ Band, và một dòng gộp dưới
  tổng thời gian ở header.
- Áp dụng cho **cả trang giáo viên và trang học sinh**.
- Bài đã nộp trước đây: giữ nguyên, chỉ hiện tổng thời gian như cũ.

## Cách tiếp cận

**Bấm giờ theo phần đang mở (active part).** Workspace đã có sẵn state `activePart`
(chỉ số phần đang xem), mỗi phần gắn với một `assignableUnit` có `skill`. Ta cộng dồn
thời gian đồng hồ vào phần đang mở; khi học sinh chuyển phần, thời gian được chốt vào
phần cũ. Lúc nộp lưu một bảng `{ mã-phần → số giây }`.

Đã loại 2 phương án khác:
- *Đoán từ thời điểm trả lời từng câu (`Answer.updatedAt`)* — không đáng tin: học sinh
  ngồi đọc/nghe mà chưa chọn đáp án thì không đo được.
- *Bắt "nộp từng phần" mới sang phần sau* — đúng ý "khóa phần" nhưng thay đổi trải
  nghiệm làm bài nhiều; để dành nếu sau này cần.

Thời gian đo là **thời gian đồng hồ khi phần đó đang mở** (kể cả lúc học sinh ngồi
nghĩ), nhất quán với cách tính tổng `elapsedSeconds` hiện tại.

## Chi tiết kỹ thuật

### 1. Dữ liệu — `prisma/schema.prisma`

Thêm một cột nullable vào model `Attempt`:

```prisma
partTimesJson  String?   // JSON: { [assignableUnitId]: số giây }. Null = bài cũ, không có dữ liệu.
```

- Nullable để bài cũ giữ `null` và code hiển thị tự bỏ qua.
- Chạy `pnpm prisma:migrate` để tạo migration.
- Cập nhật `prisma/seed.ts` nếu seed có tạo Attempt mẫu (kiểm tra; nhiều khả năng không cần).

### 2. Bấm giờ — `components/attempt-workspace.tsx`

Trong `AttemptWorkspace`:

- Giữ một `useRef<Record<string, number>>` (`partSecondsRef`) cộng dồn số giây theo
  `assignableUnitId`, khởi tạo từ `attempt.partTimesJson` (nếu có) để **resume** giữ
  đúng thời gian.
- Giữ một ref mốc thời gian `activeSinceRef` (ms) cho phần đang mở.
- Một hàm `flushActivePart()`: cộng `(Date.now() - activeSinceRef)/1000` vào phần hiện
  tại rồi đặt lại `activeSinceRef = Date.now()`. Gọi khi:
  - `activePart` đổi (hook vào `goToPart` hoặc `useEffect` theo `activePart`),
  - mỗi giây trong cùng interval đang cập nhật `elapsedSeconds` (để hidden input luôn mới),
  - trước khi tự-lưu-nháp và trước khi nộp.
- Map `activePart` (chỉ số trong `parts`) → `assignableUnitId` của phần đó.
- Thêm hidden input `partTimesJson` (JSON.stringify của `partSecondsRef`) song song với
  input `elapsedSeconds` đã có, để gửi kèm khi submit form.
- Gửi kèm `partTimesJson` trong `persistDraft()` để lưu nháp/resume.

### 3. Lưu ở server — actions attempt

- `saveAttemptDraft` (lưu nháp): nhận và ghi `partTimesJson` vào `Attempt`.
- `submitAttempt`: nhận và ghi `partTimesJson` vào `Attempt` khi nộp.
- Validate bằng zod: chuỗi JSON parse được thành `Record<string, number>` (số không âm);
  nếu lỗi thì bỏ qua (không chặn nộp bài — thời gian là dữ liệu phụ).

### 4. Hiển thị

**Component dùng chung — `components/result-review.tsx`:**
- Thêm prop `skillTimes?: Record<string, number>` (map `skill` → tổng số giây).
- Trong mỗi thẻ Band, thêm một dòng nhỏ `⏱ {formatDuration(skillTimes[row.skill])}`
  nếu có dữ liệu cho kỹ năng đó (không có thì không hiện dòng).

**Trang giáo viên & học sinh (`app/teacher/results/[attemptId]/page.tsx`,
`app/student/results/[attemptId]/page.tsx`):**
- Đọc `attempt.partTimesJson`, gộp theo kỹ năng: với mỗi `assignableUnitId` trong map,
  tra `skill` của unit đó (từ `answers[].assignableUnit` — cần thêm `assignableUnitId`
  vào phần `select` của answers, hoặc query units riêng), cộng dồn thành
  `skillTimes: Record<skill, seconds>`.
- Truyền `skillTimes` xuống `ResultReview`.
- Ở header, dưới dòng tổng thời gian, thêm dòng gộp dạng
  `Reading 45p · Listening 30p` — chỉ hiện khi `skillTimes` có dữ liệu. Dùng
  `formatDuration` và nhãn kỹ năng ngắn gọn (Reading / Listening / Writing / Speaking).

Một helper nhỏ chuyển `partTimesJson` (map theo unit) → `skillTimes` (map theo skill)
nên đặt ở `lib/` để hai trang dùng chung, tránh lặp code.

### 5. Kiểm thử — `tests/`

- Test đơn vị cho helper gộp `partTimesJson` → `skillTimes`: nhiều phần cùng kỹ năng
  cộng dồn đúng; input `null`/rỗng trả về map rỗng; JSON hỏng không làm vỡ.
- Nếu có structural test kiểm `schema.prisma`/actions, cập nhật cho khớp cột mới nếu cần.

## Phạm vi KHÔNG làm (YAGNI)

- Không tính ngược thời gian cho bài đã nộp.
- Không khóa/nộp từng phần.
- Không đo "thời gian tập trung thực" (loại trừ thời gian rời tab) — chỉ đo thời gian
  đồng hồ như tổng hiện tại.
- Không thêm biểu đồ; chỉ hiển thị text.

## Tiêu chí hoàn thành

- Bài làm mới sau thay đổi: trang kết quả (cả GV và HS) hiện thời gian từng kỹ năng
  ở cả thẻ Band lẫn dòng gộp header.
- Đóng/mở lại bài giữa chừng không làm mất thời gian đã cộng dồn.
- Bài đã nộp cũ: hiển thị y như trước, không lỗi.
- `pnpm build`, `pnpm lint`, `pnpm test` xanh.
