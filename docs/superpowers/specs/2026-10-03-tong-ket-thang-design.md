# Tổng kết tháng (kiểu chin.edu.vn) — thiết kế

Ngày: 3/10/2026 · Thầy đã duyệt trong phiên brainstorm.

## Mục tiêu

Đầu mỗi tháng học viên thấy một popup "Tháng Chín của em": XP tháng của mình, hạng
trong toàn trường, số ngày học, cùng hai bảng Top 10 (XP và chuyên cần). Giáo viên
xem cùng số liệu ở trang Xếp hạng để khen thưởng cuối tháng. Mục đích: tạo cột mốc
tháng, đẩy học viên học đều.

Mẫu tham khảo: popup "Tổng kết tháng · 09/2026" của chin.edu.vn (3 cột: thẻ cá nhân ·
Học Bá Hall · Hội Nhóm Củi).

## Quyết định đã chốt

| Câu hỏi | Chốt |
| --- | --- |
| Bảng Top tháng xếp theo gì | **Điểm XP mới**, suy ra từ dữ liệu có sẵn |
| Phạm vi so hạng | **Toàn trường** (mọi học viên; nền tảng chỉ có một giáo viên) |
| Cột chuyên cần | **Số ngày học trong tháng** (định nghĩa "ngày có học" như bảng ô vuông) |
| Khi nào hiện | Tự bật 7 ngày đầu tháng (1 lần/máy) + xem lại bất cứ lúc nào ở trang Tiến bộ |
| Lượt làm lại tự luyện | Từ lượt 2 trở đi được **nửa XP** |
| Phía giáo viên | Có — chế độ "Tổng kết tháng" ở `/teacher/ranking` |

## 1. Công thức XP

Mọi hệ số nằm ở **`lib/monthly-xp.ts`** (hằng số có tên, một chỗ duy nhất).

Đơn vị tính là **một phần (AssignableUnit) trong một lượt làm (Attempt)**, chỉ khi
kỹ năng của phần đó đã nộp. Tính theo phần chứ không theo câu vì bài chép chính tả
LPTD có 80–200 ô/unit — tính theo câu sẽ cho XP gấp 5–6 lần một passage Reading
13 câu dù thời gian làm tương đương.

- **Phần tự chấm** (mọi câu có `isCorrect` khác null và dạng câu KHÔNG thuộc
  `MANUAL_QUESTION_TYPES`): `10 + round(10 × số đúng / số câu đã chấm)` → 10–20 XP.
- **Phần chấm tay** (có ít nhất một câu `writing_task`/`speaking_task` mà
  `value` khác rỗng): **20 XP**, cộng ngay khi nộp, không phụ thuộc giáo viên đã chấm
  chưa. Một phần vừa có câu tự chấm vừa có câu chấm tay thì được cả hai khoản.
- **Ôn Sổ từ**: mỗi ngày `min(15, floor(VocabQuizDay.total / 2))` XP.
- **Lượt tự luyện thứ 2 trở đi** (`attemptRound ≥ 2`): XP của phần đó × 0,5, làm
  tròn xuống. Ôn Sổ từ không bị giảm.
- Phần nộp nhưng không có câu nào được chấm và không có bài chấm tay → 0 XP.

**Ngày của XP** = `AttemptSkill.submittedAt` của kỹ năng tương ứng (giờ VN). Attempt
cũ không có giờ nộp từng kỹ năng → dùng `Attempt.submittedAt` (như bảng ô vuông).
Câu nháp của kỹ năng chưa nộp không bao giờ được tính.

## 2. Dữ liệu — không đổi schema

Không thêm bảng/cột. Suy ra từ `AttemptSkill`, `Attempt`, `Answer`, `Question`,
`AssignableUnit`, `VocabQuizDay`, `StudentProfile`.

- **`lib/monthly-xp.ts`** — hằng số + hàm thuần tính XP của một phần, một ngày ôn từ.
- **`lib/monthly-recap.ts`** — hàm thuần: khoá tháng (`"2026-09"`), ranh giới tháng
  theo giờ VN, gộp dữ liệu thô thành `MonthlyRecap` (XP/ngày học/số phần theo kỹ năng
  của từng học viên, xếp hạng XP + xếp hạng ngày học, tổng toàn trường), và
  `studentRecapView(recap, studentId, previousRecap)` cắt ra phần của một học viên.
- **`lib/monthly-recap-data.ts`** — đọc DB cho cả trường trong một tháng:
  1. `AttemptSkill` đã nộp trong tháng (+ Attempt cũ không có giờ nộp từng kỹ năng)
     → `(attemptId, skill, submittedAt, attemptRound, studentId)`.
  2. `answer.groupBy` theo `(attemptId, assignableUnitId, isCorrect)` cho câu tự
     chấm, và theo `(attemptId, assignableUnitId)` cho câu chấm tay có `value ≠ ""`
     — không tải `value` về.
  3. `AssignableUnit` → `skill` để ghép phần với giờ nộp kỹ năng.
  4. `VocabQuizDay` trong tháng.
  5. `StudentProfile` (tên + các trường avatar + `user.image`) của học viên có XP.
- **Cache**: tháng đã kết thúc bọc `unstable_cache` (khoá theo tháng, revalidate
  86400 giây). Tháng đang diễn ra không cache (chỉ giáo viên xem).

**Xếp hạng**: chỉ học viên có XP > 0 trong tháng mới vào bảng (giống Chín "361 bạn có
Bá khí tháng này"). Đồng điểm → đồng hạng (1, 2, 2, 4), thứ tự hiển thị trong nhóm
đồng hạng theo tên. Bảng ngày học xếp theo số ngày, đồng ngày thì ai XP cao hơn đứng
trước (vẫn đồng hạng).

## 3. Giao diện học viên

**Component dùng chung `components/monthly-recap-panel.tsx`** (server-renderable,
không state) vẽ toàn bộ nội dung; được bọc bởi popup hoặc trang riêng.

- **Đầu**: nhãn "Tổng kết tháng · 09/2026", tiêu đề "Tháng **Chín** của em", câu
  "Cả trường đã cày **X XP** cùng **N** bạn trong tháng chín."
- **Cột 1 — thẻ cá nhân**: avatar + tên + chip "Top P% toàn trường"; XP tháng; so
  với tháng trước (▲/▼ %, hoặc "Tháng trước chưa có XP"); biểu đồ cột XP cả trường
  từ cao xuống thấp với vạch "Em ở đây"; "Hạng R trên N bạn"; dải ô từng ngày trong
  tháng (ô sáng = có học) + "D/30 ngày học"; số phần đã nộp theo kỹ năng (chip
  Nghe/Đọc/Viết/Nói + Sổ từ); hạng ở hai bảng (hoặc "Chưa có hạng").
- **Cột 2 — "Top XP tháng"**: bục 1-2-3 (vàng/bạc/đồng, không vẽ bục trống khi < 3
  người) + hạng 4–10. Học viên đang xem được tô nổi + nhãn "Em".
- **Cột 3 — "Chăm nhất tháng"**: bục + hạng 4–10 theo số ngày học.
- **Chân**: chú thích cách tính + nút "Học tiếp tháng Mười".
- Màu theo token sáng/tối của app (không bê nguyên nền tối của Chín). Trên điện thoại
  3 cột xếp dọc, popup cuộn bên trong, nút đóng luôn nhìn thấy.

**Popup tự bật** — `components/monthly-recap-dialog.tsx` (client): trang chủ
`/student` trong 7 ngày đầu tháng (giờ VN) tính recap của tháng trước; nếu học viên
có XP > 0 hoặc ít nhất một ngày học thì truyền dữ liệu xuống dialog. Dialog đọc
`localStorage["monthly-recap-seen:2026-09"]`; chưa có thì mở, đóng (nút X, nút chân,
phím Esc, bấm nền) thì ghi khoá. localStorage bọc try/catch — lỗi thì coi như chưa xem
nhưng chỉ mở một lần trong phiên. Overlay **portal ra `document.body`** (bẫy
`transform` của AppShell). Lỗi khi tính recap không được làm hỏng trang chủ: bắt lỗi,
bỏ qua popup.

**Xem lại** — trang `/student/recap?month=2026-09` vẽ `MonthlyRecapPanel` toàn trang,
có ô chọn tháng (6 tháng gần nhất đã kết thúc, form GET). Tháng lạ/sai định dạng/tháng
chưa kết thúc → rơi về tháng trước. Trang Tiến bộ `/student/stats` thêm nút "Tổng kết
tháng" dẫn tới đây.

## 4. Giao diện giáo viên

`/teacher/ranking` thêm hai tab link: "Theo lớp" (như cũ) và "Tổng kết tháng"
(`?view=month&month=2026-10`). Chế độ tháng: ô chọn tháng (tháng hiện tại + 6 tháng
trước), dòng tổng toàn trường, rồi hai bảng **đầy đủ** (không cắt ở 10) — XP và số
ngày học — dùng chung phần vẽ bảng với popup. Tháng hiện tại ghi rõ "đang diễn ra,
số liệu còn thay đổi". Trang vẫn gọi `requireTeacherPage()`.

## 5. Kiểm thử

- `tests/monthly-xp.test.ts`: phần tự chấm 0%/70%/100%, phần chấm tay rỗng/không rỗng,
  phần hỗn hợp, nửa XP lượt ≥ 2, trần 15 XP/ngày ôn từ.
- `tests/monthly-recap.test.ts`: ranh giới tháng giờ VN (23:30 ngày 30/9 VN thuộc
  tháng 9, 00:10 ngày 1/10 VN thuộc tháng 10), câu nháp kỹ năng chưa nộp không tính,
  Attempt cũ dùng giờ nộp cả bài, đồng hạng, chỉ học viên XP > 0 vào bảng, % so tháng
  trước, phân vị "Top P%".
- `tests/teacher-page-guard.test.ts` sẵn có tự phủ trang giáo viên.
- Kiểm tay: phía giáo viên ở local bằng tài khoản seed (khổ 375px + desktop, sáng/tối);
  phía học viên sau deploy trên prod bằng Chrome.

## Ngoài phạm vi

Huy hiệu, kim cương/tiền ảo, thông báo đẩy/mail tổng kết, chia sẻ ảnh tổng kết, bảng
theo lớp trong popup.
