# Thư viện tự luyện cho học viên — thiết kế

Ngày: 2026-08-04
Trang liên quan: `/student/practice` (mới), `/teacher/materials`, `/teacher/review`,
`/student/history`, `/student/stats`, `/student/ranking`

## Vấn đề

Học viên chỉ làm được đúng những bài giáo viên giao. Ngoài khoảng thời gian đó thì
không có gì để làm trên web, dù kho đề đã có hàng chục bộ Cambridge/IELTS Master đầy
đủ giải thích, dẫn chứng và transcript. Kho đề đang bị dùng dưới công suất, còn học
viên không có lý do vào web mỗi ngày.

## Mục tiêu

Một **thư viện tự luyện dùng chung cho toàn bộ học viên** (không chia theo lớp), gồm
những đề giáo viên chủ động mở. Học viên tự chọn đề, làm bao nhiêu lần tuỳ thích, xem
kết quả và giải thích ngay sau khi nộp.

## Đã chốt trong lúc brainstorm

- Thư viện **riêng**, mở chung cho mọi lớp, mọi học viên — không phải mở toàn bộ kho đề.
- **Làm lại không giới hạn**, lưu lại mọi lượt (xem được tiến bộ qua từng lần).
- Kết quả tự luyện **có** tính vào: chuỗi hoạt động (streak), thống kê điểm yếu, bảng
  xếp hạng lớp.
- Để tránh cày điểm: xếp hạng và thống kê **chỉ lấy lượt đầu tiên của mỗi đề**.
- Học viên chọn được **cả đề** hoặc **từng phần**.
- Mở **cả 4 kỹ năng**; bài Writing/Speaking tự luyện vẫn vào hàng đợi chấm của giáo
  viên, nhưng nằm ở tab riêng.

## Ngoài phạm vi

- **Sổ câu sai / flashcard từ vựng / luyện lại câu sai** — đã bàn nhưng tạm gác, làm
  thư viện trước.
- Không đụng logic chấm tự động, quy đổi band, trang kết quả, phòng làm bài.
- Không thêm quyền mở đề theo lớp — mở là mở cho tất cả.

## Hướng kỹ thuật: "bài giao ảo"

Mọi thứ downstream (chấm tự động, trang kết quả, giải thích, transcript, tô màu, band)
đều bám vào chuỗi `Assignment → AssignmentRecipient → Attempt`. Thay vì tách lượt tự
luyện thành mô hình riêng (phải xử lý nhánh null ở khắp nơi), ta **tái dùng nguyên
đường ống đó**: khi học viên bấm luyện, hệ thống tạo ngầm một `Assignment` gắn cờ
`mode = "practice"` cùng một `AssignmentRecipient` cho riêng em đó.

Đánh đổi đã chấp nhận: phải thêm bộ lọc "bỏ bài tự luyện" ở các trang liệt kê bài
giao. Đây là việc cơ học, kiểm chứng được bằng test cấu trúc — rẻ hơn nhiều so với
việc sửa logic chấm và hiển thị vốn đã chạy ổn.

## Thay đổi dữ liệu

| Bảng | Cột mới | Ý nghĩa |
|---|---|---|
| `Material` | `practiceOpen Boolean @default(false)` | Đề có nằm trong thư viện tự luyện không |
| `Assignment` | `practiceScopeKey String? @unique` | Khoá `studentId:materialId:unitId∣all` — mỗi (học viên × đề × phạm vi) chỉ một bài giao ảo |
| `Attempt` | `attemptRound Int @default(1)` | Lượt thứ mấy của đề đó. Bài giao luôn = 1 |

`Assignment.mode = "practice"` đã có sẵn trong khối chú thích enum đầu
`prisma/schema.prisma` (`AssignmentMode: homework | practice | mock_test`), chưa dùng
tới — không phải sửa chú thích.

Bài giao ảo luôn có `classId = null`, `deadline = null`, `teacherId` = chủ của đề.
`title` đặt theo tên đề (kèm tên phần khi luyện lẻ) để trang kết quả và trang chấm
vẫn hiện đúng tên — các trang đó đang đọc `assignment.title`.

**Bắt buộc:** thêm cả ba cột vào `scripts/ensure-db.mjs`. Script này chạy trong bước
build nên đây là cách schema mới được áp lên prod; quên là bản deploy sập.

## Phía giáo viên

Không có màn hình mới.

- **Trang Tài liệu**: mỗi đề có công tắc **"Cho tự luyện"**, bật/tắt tức thì kèm toast
  theo cơ chế `ActionResult` sẵn có. Thêm bộ lọc **"Đang mở tự luyện"** vào thanh lọc
  hiện tại để rà lại đã mở những đề nào.
- **Trang Chấm bài**: tách hai tab — **Bài giao** (mặc định) và **Tự luyện**, kèm số
  đếm, để bài Writing/Speaking tự luyện không làm loãng hàng đợi chính.

Tắt công tắc chỉ khiến đề biến khỏi thư viện; lượt đã làm và kết quả giữ nguyên.

## Phía học viên

**Điều hướng:** thêm mục **"Tự luyện"** vào thanh của học viên → `/student/practice`.

**Trang thư viện:** ô tìm kiếm + chip lọc kỹ năng. Mỗi đề là một thẻ gồm:

- Tiêu đề, nhãn nguồn (`sourceLabel`), số phần, tổng số câu
- Trạng thái của riêng em đó: *"Chưa luyện"* hoặc *"Đã luyện 3 lần · cao nhất 32/40"*
- Nút chính **Luyện cả đề**; mũi tên mở danh sách phần, mỗi phần có nút **Luyện phần này**

**Server action `startPractice(materialId, unitId?)`:**

1. `requireStudent()`
2. Kiểm `Material.practiceOpen === true` — chặn học viên đoán URL để mở đề đang để
   dành làm bài kiểm tra
3. Tìm `Assignment` theo `practiceScopeKey`; chưa có thì tạo Assignment +
   AssignmentUnit + AssignmentRecipient trong một `$transaction`
4. `redirect` sang `/student/assignments/[recipientId]` — đúng phòng làm bài hiện tại,
   không thêm route mới

**Làm lại nhiều lần:** `startAttempt` thêm một nhánh — nếu `assignment.mode ===
"practice"` và lượt gần nhất đã nộp thì tạo lượt mới với `attemptRound = số lượt + 1`.
Lượt đang làm dở vẫn được trả về như cũ (không đẻ lượt mới). Bài giao giữ nguyên hành
vi "một lần duy nhất".

**Trước khi vào làm:** hộp chọn nhanh **"Tính giờ như thi thật"** / **"Không tính
giờ"**.

- Tính giờ: dùng `defaultTimeLimitMinutes` của phần, vẫn tự nộp khi hết giờ.
- Không tính giờ: tắt cả đồng hồ lẫn tự nộp.

Audio Listening luôn cho tua (không bật `lockAudio`).

**Nộp xong:** vào thẳng trang kết quả sẵn có — đủ giải thích, dẫn chứng, transcript
bấm-tua.

**Lịch sử:** trang Lịch sử thêm tab **"Tự luyện"**, liệt kê từng lượt kèm ngày và
điểm, bấm vào xem lại kết quả lượt đó.

## Số liệu

| Chỉ số | Cách tính |
|---|---|
| Chuỗi hoạt động (streak) | **Mọi** lượt tự luyện đã nộp đều tính là ngày có hoạt động |
| Điểm trung bình trong xếp hạng lớp | Chỉ lượt `attemptRound = 1` |
| "Hoạt động gần đây" trong xếp hạng | Chỉ lượt `attemptRound = 1` |
| Tỉ lệ hoàn thành trong xếp hạng | **Không** tính tự luyện — chỉ số này đo việc nộp bài giao |
| Thống kê điểm yếu (trang Tiến bộ) | Chỉ lượt `attemptRound = 1` |

**Bẫy đã phát hiện:** `lib/class-ranking.ts` hiện lấy bài có `classId ∈ {lớp này,
null}` (dòng ~221, biến `ofThisClass`), mà bài giao ảo đúng là `classId = null` — nên
nó sẽ **tự động lọt vào xếp hạng** nếu không thêm điều kiện `mode`. Phải xử lý ngay từ
bước đầu.

## Nơi phải lọc

Một file dùng chung `lib/practice.ts` giữ toàn bộ mảnh điều kiện, không nơi nào tự
viết `mode: "practice"` bằng tay:

```ts
practiceScopeKey(studentId, materialId, unitId)   // sinh khoá
excludePractice        // { assignment: { mode: { not: "practice" } } }
onlyPractice           // ngược lại
countsForStats         // { attemptRound: 1 }
```

**Phải loại bài tự luyện ra**

- `app/teacher/assignments/page.tsx` — danh sách bài giao
- `app/teacher/calendar/page.tsx` — lịch
- `app/student/page.tsx` — danh sách bài được giao của học viên
- `lib/actions/assignments.ts` — sửa/xoá phải từ chối nếu là bài giao ảo (phòng thân)

**Phải tách hai luồng**

- `app/teacher/review/page.tsx` — hai tab Bài giao / Tự luyện
- `app/student/history/page.tsx` — hai tab tương tự

**Chỉ lấy lượt đầu (`attemptRound = 1`)**

- `lib/class-ranking.ts` — kèm việc chặn `classId = null` nói trên
- `lib/question-stats.ts` và `app/student/stats/page.tsx`

**Không phải sửa** (đã kiểm tra từng chỗ)

- `app/api/cron/reminders/route.ts` lọc theo `assignment.deadline` khác null, mà bài
  giao ảo luôn `deadline = null` → tự động nằm ngoài. Vẫn viết test khoá hành vi này.
- `app/teacher/page.tsx` đếm "chờ chấm" theo unit chấm tay — bài Writing/Speaking tự
  luyện **sẽ** vào đó, đúng ý; danh sách gần đây chỉ thêm nhãn *"Tự luyện"*.
- Phòng làm bài, trang kết quả, trang chấm chi tiết, chấm tự động, quy đổi band.

## Kiểm thử

- Logic thuần: `practiceScopeKey` sinh khoá đúng và ổn định; `attemptRound` tăng
  1→2→3; lượt đang làm dở thì bấm luyện lại trả về đúng lượt đó.
- Test cấu trúc (theo kiểu `tests/teacher-page-guard.test.ts`): mọi trang liệt kê bài
  giao phải dùng mảnh điều kiện từ `lib/practice.ts` — thêm trang mới mà quên lọc là
  test đỏ.
- Xếp hạng: hai lượt luyện cùng một đề chỉ đóng góp một lần vào điểm trung bình, và
  không làm đổi tỉ lệ hoàn thành.
- Cron nhắc hạn: bài giao ảo không bao giờ lọt vào danh sách gửi mail.
- E2E ngắn: mở thư viện → luyện một phần → nộp → xem kết quả → luyện lại lần hai →
  lịch sử hiện hai lượt.

## Tình huống biên

- Tắt "Cho tự luyện": đề biến khỏi thư viện, lượt đã làm và kết quả giữ nguyên.
- Học viên đoán URL đề chưa mở: `startPractice` kiểm `practiceOpen` nên trả lỗi.
- Xoá đề đang mở tự luyện: cascade như hiện tại, không phát sinh hành vi mới.
- Cùng một đề, luyện "cả đề" và luyện "một phần" là hai `practiceScopeKey` khác nhau
  → hai bài giao ảo riêng, đếm lượt riêng.
- `AssignmentRecipient.status` của bài giao ảo dao động qua lại giữa `submitted` và
  `in_progress` mỗi khi học viên luyện lại. Chấp nhận được vì trạng thái này chỉ dùng
  cho danh sách bài giao — nơi đã lọc bỏ bài tự luyện.
