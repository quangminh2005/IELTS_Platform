# Tự động nộp khi hết giờ + đồng hồ theo thời gian làm thực

- **Ngày:** 2026-07-12
- **Nhánh:** feature/ielts-platform-mvp
- **Trạng thái:** Đã chốt thiết kế, chờ lập kế hoạch triển khai

## Vấn đề

Hiện tại đồng hồ đếm ngược của mỗi kỹ năng ([`CountdownTimer`](../../../components/attempt-workspace.tsx)) chỉ
đếm về 0 rồi hiện chữ **"Hết giờ"** và **dừng ở đó** — bài **không tự nộp**. Server còn
chủ động **từ chối** mọi lượt nộp `auto_timeout` ([`submitSkill`](../../../lib/actions/attempts.ts),
`if (submitReason === "auto_timeout") return;`). Chỉ khi học viên tự bấm **"Nộp bài"**
(`submitReason: "manual"`) bài mới được nộp.

Giáo viên muốn: **hết giờ thì bài tự động nộp** (giống phòng thi thật), áp dụng cho
**Listening, Reading, Writing** (không áp dụng Speaking).

Ngoài ra, đồng hồ hiện tính theo **giờ thực (wall-clock)**: `startedAt + giới hạn`. Nếu
học viên mất mạng / tắt nhầm tab / máy ngủ, đồng hồ **vẫn chạy** trong lúc offline, ăn mất
thời gian làm bài một cách oan uổng.

## Quyết định (đã hỏi giáo viên)

1. **Tự động nộp khi hết giờ** cho **Listening, Reading, Writing**. **Không** áp dụng
   Speaking.
2. **Đồng hồ chỉ tính thời gian đang làm bài thực sự** (active time): tạm dừng khi đóng
   tab / mất mạng / máy ngủ / chuyển sang tab khác. Học viên chấp nhận đánh đổi: đóng bài
   giữa chừng sẽ tạm dừng đồng hồ (về lý thuyết có thể "câu giờ", nhưng rủi ro và giáo viên
   thấy được thời gian nộp).
3. **Mở lại sau sự cố phải giữ nguyên đáp án đã làm và tiếp tục đúng chỗ** (đồng hồ không
   chạy lại từ đầu, không ăn mất thời gian offline).
4. **Không cần hộp thoại xác nhận** khi tự nộp; trang kết quả hiện ra sau khi nộp.
5. **Không xây thông báo "nộp trễ" riêng cho giáo viên** (YAGNI) — giáo viên đã thấy giờ nộp
   trong trang chấm.

## Nguyên tắc kiến trúc

Giữ nguyên mô hình hiện có: **một `Attempt` cho mỗi bài, một `AttemptSkill` cho mỗi kỹ
năng**, đồng hồ theo kỹ năng, nộp/khoá độc lập. Thay đổi nằm gọn ở **cách tính giờ** và
**bổ sung nhánh tự-nộp**, không đụng mô hình dữ liệu (không thêm cột/bảng mới).

Tận dụng cột sẵn có `AttemptSkill.elapsedSeconds` (Int, mặc định 0) làm **nguồn sự thật cho
"thời gian đã làm thực"** của kỹ năng đó. Hiện `elapsedSeconds` chỉ được ghi **một lần lúc
nộp** (giá trị wall-clock); thiết kế này chuyển nó thành giá trị **được cập nhật liên tục
qua heartbeat** trong lúc làm, và mang nghĩa "active time".

## Mô hình tính giờ mới (active time)

Với mỗi kỹ năng đang mở:

- `budgetSeconds` = (giới hạn phút của kỹ năng) × 60. Giới hạn lấy như logic hiện tại:
  `skillLimits[skill] ?? (bài-nhiều-kỹ-năng ? null : timeLimitMinutes)`. `null` (không đặt
  giờ) ⇒ **không giới hạn, không tự nộp** (giữ nguyên hành vi cũ).
- `consumedSeconds` = số giây đã thực sự làm. Khởi tạo bằng `AttemptSkill.elapsedSeconds`
  (đã lưu từ các phiên trước / heartbeat gần nhất).
- **Còn lại** hiển thị = `budgetSeconds − consumedSeconds`.

### Cách cộng dồn `consumedSeconds` (client)

Dùng vòng lặp 1 giây (mở rộng interval đồng hồ đang có). Mỗi nhịp cộng thêm
`min(deltaThực, CAP)` với `CAP ≈ 2` giây:

- Hoạt động bình thường: `deltaThực ≈ 1s` ⇒ cộng 1s.
- Máy ngủ / tab bị trình duyệt throttle khi ở nền / mất mạng làm treo JS: `deltaThực` rất
  lớn ⇒ chỉ cộng tối đa `CAP` ⇒ **đồng hồ gần như tạm dừng** trong lúc không thực sự làm
  bài. Đây là cơ chế "chỉ tính thời gian đang làm".

> Hệ quả: chuyển sang tab khác hoặc đóng bài ≈ tạm dừng đồng hồ. Đã được giáo viên chấp
> nhận (mục Quyết định #2).

### Đồng hồ hiển thị

`CountdownTimer` chuyển từ "đếm tới mốc `startedAt + giới hạn`" sang "hiển thị
`budgetSeconds − consumedSeconds`", cập nhật mỗi giây theo bộ đếm active ở trên. Giữ
nguyên giao diện: đổi màu đỏ khi ≤ 60 giây, hiện **"Hết giờ"** ở 0.

Trường ẩn `elapsedSeconds` của form (hiện do `elapsedRef` ghi giá trị wall-clock) đổi sang
mang **`consumedSeconds`** (active time), để mọi lượt nộp — cả `manual` lẫn `auto_timeout`
— gửi đúng thời gian đã làm thực; server dùng giá trị này cho guard tự-nộp và lưu vào
`AttemptSkill.elapsedSeconds`.

## Lưu tiến độ (heartbeat)

Thêm nhịp lưu định kỳ **~10 giây/lần** trong khi một kỹ năng đang mở (và khi rời kỹ năng /
trước khi đóng trang nếu bắt được), gửi `consumedSeconds` hiện tại lên server để ghi vào
`AttemptSkill.elapsedSeconds`. Piggyback luôn việc lưu nháp đáp án + `partTimesJson` để lúc
đọc-yên-tĩnh (không gõ gì) tiến độ vẫn được lưu.

- Cơ chế autosave hiện tại chỉ chạy **1,2 giây sau khi đáp án THAY ĐỔI** → không đủ cho
  trường hợp ngồi đọc mà không gõ. Heartbeat định kỳ bù cho khoảng này.
- Khi sự cố xảy ra, mất tối đa ~10 giây tiến độ đồng hồ (chấp nhận được, và có lợi cho học
  viên vì phần chưa lưu coi như chưa tính giờ).

**Server action:** mở rộng `saveAttemptDraft` (hoặc thêm action nhẹ chuyên cho heartbeat)
để nhận thêm trường `skill` + `elapsedSeconds` và cập nhật đúng dòng `AttemptSkill`. Vẫn
gate `requireStudent()` + scope theo `studentId`; **không** ghi đè kỹ năng đã `submitted`;
`elapsedSeconds` chỉ **tăng, không giảm** (dùng `max(cũ, mới)` để tránh nhịp lỗi kéo lùi).

## Mở lại sau sự cố (tình huống chính)

Trang [`app/student/assignments/[recipientId]/page.tsx`](../../../app/student/assignments/%5BrecipientId%5D/page.tsx)
đã tải sẵn `savedAnswers` từ DB và truyền `attemptSkills` (có `elapsedSeconds`) vào
workspace. Nên khi mở lại:

- **Đáp án đã làm** → điền lại từ `savedAnswers` (đã hoạt động sẵn).
- **Đồng hồ** → khởi tạo `consumedSeconds = AttemptSkill.elapsedSeconds`, "còn lại =
  budget − consumed". Khoảng thời gian offline **không** bị cộng (heartbeat đã ngừng trong
  lúc đó). Tiếp tục đếm từ đúng chỗ.

Ví dụ: budget 40 phút, làm 20 phút rồi mất mạng → `elapsedSeconds ≈ 1200`. Mở lại: còn
~20 phút, làm tiếp tới hết.

## Nhánh tự động nộp (client)

Ở cấp `AttemptWorkspace` (nơi có `formRef`, kỹ năng đang mở, bộ đếm):

- Khi `consumedSeconds ≥ budgetSeconds` **và** kỹ năng ∈ {`listening`, `reading`,
  `writing`} **và** không phải `previewMode` **và** kỹ năng chưa `submitted`:
  1. Đặt `submitReasonRef.current.value = "auto_timeout"`.
  2. Gọi `formRef.current.requestSubmit()` — **không** đi qua `onClick` của nút "Nộp bài"
     nên **không** hiện hộp thoại xác nhận.
- Vì mọi ô đáp án là field `q_<id>` trong form, lượt nộp bắt đúng đáp án **hiện tại** (kể
  cả vừa gõ), không chỉ bản autosave gần nhất.
- Dùng cờ chống nộp trùng (submit một lần) để interval không bắn nhiều lần.
- Kỹ năng **Speaking**: không có nhánh tự nộp (đồng hồ vẫn hiển thị "Hết giờ" như cũ nếu có
  đặt giờ).

### Trường hợp "mở lại mà đã dùng hết ngân sách"

Nếu học viên đã chủ động dùng hết budget ở phiên trước (`elapsedSeconds ≥ budget`), khi mở
lại "còn lại ≤ 0" ⇒ **tự nộp ngay khi mở**. Đây là hành vi đúng (đã hết giờ thật sự). Vì
đồng hồ tạm dừng khi offline nên **không còn** tình huống "quá giờ oan do mất mạng" ⇒
**bỏ hoàn toàn** ý tưởng "ngưỡng ân hạn 5 phút" đã bàn trước đó (không cần nữa).

## Thay đổi phía server (an toàn 2 lớp)

Trong `submitSkill`, thay chính sách "bỏ qua mọi `auto_timeout`" bằng: **chấp nhận
`auto_timeout` chỉ khi kỹ năng thật sự đã dùng hết ngân sách.**

- Sau khi đã lấy `skillRow` và biết `assignment` (có `skillTimeLimitsJson`,
  `timeLimitMinutes`, `units`):
  - Nếu `submitReason === "auto_timeout"`:
    - Speaking ⇒ `return` (không bao giờ tự nộp).
    - Tính `budgetSeconds` cho kỹ năng (cùng logic client: `skillLimits[skill] ??
      (isMultiSkill ? null : timeLimitMinutes)`; `isMultiSkill` suy từ
      `orderedSkillsOfAssignment(units)`).
    - Không có giới hạn (`budget == null`) ⇒ `return`.
    - Lấy `elapsed` = `max(AttemptSkill.elapsedSeconds, elapsedSeconds gửi kèm form)`.
    - Nếu `elapsed < budgetSeconds − EPSILON` (ví dụ EPSILON ≈ 3s) ⇒ `return` (client gửi
      nhầm lúc chưa hết giờ — chống nộp non do lỗi client).
    - Ngược lại ⇒ tiến hành nộp như `manual`.
- Nhánh `manual` giữ nguyên hoàn toàn.

## Các file dự kiến chạm

- `components/attempt-workspace.tsx` — bộ đếm active time + heartbeat interval + nhánh
  tự-nộp; đổi `CountdownTimer` sang hiển thị "còn lại = budget − consumed".
- `lib/actions/attempts.ts` — mở rộng `saveAttemptDraft`/heartbeat để ghi
  `AttemptSkill.elapsedSeconds`; đổi guard `auto_timeout` trong `submitSkill`.
- (Có thể) `app/student/assignments/[recipientId]/page.tsx` — đảm bảo truyền đủ
  `elapsedSeconds` mỗi kỹ năng (hiện đã truyền `attemptSkills`).

## Không thay đổi (giữ nguyên)

- Không thêm cột/bảng Prisma mới ⇒ **không cần** cập nhật `scripts/ensure-db.mjs`.
- Không đụng chấm điểm, band score, gamification, lịch sử, xếp hạng.
- Speaking: không tự nộp.
- Xem trước (preview) của giáo viên: không lưu, không nộp, không đếm giờ tự nộp.

## Kiểm thử

- Test cấu trúc hiện có ([`tests/foundation.test.ts`](../../../tests/foundation.test.ts))
  chỉ khẳng định schema có cột `submitReason` — **không** khoá hành vi "từ chối
  auto_timeout", nên đổi policy không làm hỏng test này.
- Bổ sung test cho logic thuần nếu tách được (ví dụ hàm tính "còn lại"/ "đã hết budget" và
  guard server), theo phong cách test hiện tại.

## Rủi ro / lưu ý

- **Câu giờ bằng đóng tab**: đã chấp nhận (Quyết định #2).
- **Trình duyệt throttle interval ở tab nền**: là cơ chế mong muốn (tạm dừng khi không làm),
  nhưng cần chọn `CAP` hợp lý (~2s) để không đếm nhảy.
- **Đồng bộ nhiều tab cùng lúc**: nếu học viên mở 2 tab cùng một kỹ năng, heartbeat có thể
  ghi đè nhau; dùng `max(cũ, mới)` giảm rủi ro kéo lùi. Đây là ca hiếm, không tối ưu sâu.
