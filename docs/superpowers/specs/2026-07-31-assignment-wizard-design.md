# Form "Tạo bài giao" dạng stepper — thiết kế

Ngày: 2026-07-31
Trang liên quan: `/teacher/assignments`

## Vấn đề

Form tạo bài giao hiện nằm ở cột phải rộng 25rem, chứa 6 nhóm nội dung xếp dọc:
tiêu đề / hướng dẫn / hạn nộp ở khối cố định trên đầu, rồi Các phần → Thời gian mỗi
kỹ năng → Chế độ thi thật → Học viên trong một vùng cuộn riêng. Hệ quả:

- Cây chọn đề (54 đề IELTS Master + các bộ khác) và danh sách học viên đều bị nhét
  vào cột hẹp, phải cuộn nhiều.
- Không có bước nào rõ ràng: dễ bấm "Tạo bài tập" khi mới tích đề mà quên học viên.
- Ô "Thời gian mỗi kỹ năng" phụ thuộc phần đã chọn nhưng lại nằm cách xa cây chọn đề.

## Mục tiêu

Chuyển việc **tạo mới** bài giao sang modal dạng stepper 3 bước, rộng rãi hơn, có
điều hướng rõ ràng. Không đổi dữ liệu, không đổi server action, không đổi form
**Sửa bài giao**.

## Ngoài phạm vi (đã chốt)

- Form "Sửa bài giao" trong từng thẻ ở danh sách: **giữ nguyên** dạng một trang như
  hiện tại. Sửa thường chỉ động 1 ô (đổi hạn nộp, thêm 1 học viên) nên bắt đi qua 3
  bước sẽ chậm hơn.
- **Không** tự gợi ý tiêu đề từ đề đã chọn.
- **Không** tự điền thời gian mặc định cho từng kỹ năng.
  Hai ô này vẫn trống mặc định, đúng như hành vi hiện tại.
- Không đụng `prisma/schema.prisma`, không đụng `lib/actions/assignments.ts`.

## Bố cục trang

`app/teacher/assignments/page.tsx`:

- Bỏ lưới `xl:grid-cols-[minmax(0,1fr)_25rem]`. `AssignmentList` chiếm trọn chiều rộng.
- Nút **+ Tạo bài giao** đặt ở góc phải header của thẻ "Bài đã giao".
- Nút bị khoá kèm dòng lý do khi `materials` chưa có phần nào hoặc chưa có học viên
  nào (thay cho nút submit mờ ở đáy form hiện nay).

## Modal

- Rộng tối đa ~880px, cao tối đa 85vh, 3 tầng cố định:
  1. **Thanh bước** (header): tên modal, 3 chặng "Chọn đề · Học viên · Cài đặt",
     thanh tiến trình mảnh, nút đóng.
  2. **Nội dung bước** (chỉ vùng này cuộn).
  3. **Thanh chân**: bên trái là tóm tắt trực tiếp ("2 phần · 8 học viên"), bên phải
     là nút Quay lại / Tiếp tục (hoặc nút giao bài ở bước cuối).
- Điều hướng: nút **Tiếp tục** bị khoá khi bước hiện tại chưa hợp lệ, kèm dòng lý do
  nhỏ ("Chọn ít nhất 1 phần"). Bước đã hoàn thành bấm được để quay lại; bước chưa tới
  thì mờ và không bấm được.
- Đóng bằng nút X, phím Esc, hoặc bấm nền. Nếu đã tích chọn phần/học viên thì hỏi lại
  "Bỏ bài giao đang tạo?" trước khi đóng.
- Màn hẹp: modal chiếm full màn hình, thanh bước rút gọn thành "Bước 1/3 · Chọn đề".
- A11y: `role="dialog"`, `aria-modal="true"`, focus chuyển vào modal khi mở và trả về
  nút "+ Tạo bài giao" khi đóng, Esc đóng.

## Nội dung từng bước

### Bước 1 — Chọn đề

- Giữ nguyên cây Bộ đề → Kỹ năng → Test của `UnitPicker`.
- Modal rộng nên các phần trong một test xếp 2 cột thay vì một cột dọc.
- Thêm ô tìm kiếm lọc cây theo tên bộ đề / test / phần.
- Dải chip các phần đã chọn nằm trên cây, bấm × để bỏ mà không phải tìm lại trong cây.
- Hợp lệ khi: có ít nhất 1 `input[name="unitIds"]` được tick.

### Bước 2 — Học viên

- Hàng chip tên lớp thay cho ô select "+ Tích nhanh theo lớp…": bấm chọn cả lớp, bấm
  lại bỏ cả lớp.
- Danh sách học viên xếp 2 cột, thêm ô tìm theo tên, giữ nút "Chọn tất cả" và bộ đếm
  "Đã chọn 8/24".
- Hợp lệ khi: có ít nhất 1 `input[name="studentIds"]` được tick.

### Bước 3 — Cài đặt & xuất bản

Hai cột:

- Trái: Tiêu đề (bắt buộc, `minLength=2` như hiện tại), Hướng dẫn, Hạn nộp (ngày +
  giờ như cũ, thêm chip nhanh "Hôm nay 23:59 · Ngày mai · +3 ngày").
- Phải: Thời gian mỗi kỹ năng (`SkillTimeInputs`, chỉ hiện kỹ năng thực sự có trong
  các phần đã chọn — giữ nguyên logic hiện có); ô "Ẩn thanh audio" **chỉ hiện khi
  trong các phần đã chọn có Listening**; hộp tóm tắt liệt kê tên từng phần và số học
  viên để soát lần cuối.
- Nút submit ghi rõ việc sẽ làm: **Giao bài cho 8 học viên**.

## Kỹ thuật

### Thành phần mới

`components/assignment-wizard.tsx` (client) — vỏ modal:

- Nhận 3 khối nội dung dưới dạng `ReactNode` (slot) để `AssignmentBuilder` vẫn dựng
  chúng ở phía server.
- Quản lý: `open`, `step` (1–3).
- Đếm số phần / số học viên đã tick bằng cách nghe sự kiện `change` trên `<form>` bao
  quanh — đúng thủ thuật `components/skill-time-inputs.tsx` đang dùng (neo bằng ref
  rồi `closest("form")`, vì trang có nhiều form). Không nâng state của hai picker lên.

### Ràng buộc quan trọng: một form duy nhất

Cả 3 bước nằm trong **một** `<form action={createAssignment}>`. Bước không hiển thị
chỉ bị ẩn bằng CSS (`hidden`), **không** unmount. Nhờ vậy mọi checkbox vẫn nằm trong
DOM và `FormData` gửi lên vẫn đủ — không cần input ẩn hay state trung gian.

Hệ quả cần xử lý:

- Nút "Tiếp tục" / "Quay lại" phải là `type="button"`.
- Nút submit thật chỉ render ở bước 3.
- Chặn phím Enter submit sớm khi đang ở bước 1–2.

### Thay đổi ở thành phần có sẵn

- `components/assignment-builder.tsx` (giữ là server component): đổi vai thành nơi
  dựng sẵn 3 khối nội dung rồi truyền vào wizard. `ResetOnToken` giữ nguyên → sau khi
  tạo bài, trang redirect với `assignmentsReset` mới, wizard remount, modal tự đóng và
  form sạch.
- `components/unit-picker.tsx`: giữ là server component (không đẩy 54 đề sang trình
  duyệt). Thêm thuộc tính `data-search` trên các node để lớp bọc client lọc hiển thị.
  Ô tìm kiếm và bố cục 2 cột nằm sau prop mới, **mặc định tắt**.
- `components/student-picker.tsx`: chip lớp, ô tìm theo tên, bố cục 2 cột đều nằm sau
  prop mới, **mặc định tắt**.

Nhờ để mặc định tắt, form "Sửa bài giao" trong `components/assignment-list.tsx` giữ
nguyên giao diện hiện tại.

### Không đổi

`lib/actions/assignments.ts` (`createAssignment`), `prisma/schema.prisma`, tên các
trường trong `FormData` (`title`, `instructions`, `dueDate`, `dueTime`, `unitIds`,
`studentIds`, `skillTime_*`, `lockAudio`).

## Kiểm thử

Thêm một test cấu trúc theo phong cách `tests/` hiện có, xác nhận:

- Wizard có đủ 3 bước và các nhãn bước.
- Nút submit chỉ nằm ở bước cuối; nút điều hướng là `type="button"`.
- Các bước bị ẩn vẫn còn input trong DOM (ẩn bằng class, không phải render có điều kiện).
- `createAssignment` vẫn là action của form.

Chạy `pnpm test` và `pnpm build` sau khi sửa. Kiểm mắt trên Vercel sau khi push:
tạo thử một bài giao đủ 3 bước và xác nhận bài xuất hiện đúng trong danh sách.

## Rủi ro

- Rủi ro chính là **mất input khi chuyển bước** nếu lỡ render có điều kiện thay vì ẩn
  bằng CSS. Test cấu trúc ở trên canh đúng điểm này.
- Rủi ro phụ: bấm Enter trong ô Tiêu đề gây submit sớm — đã chặn ở phần kỹ thuật.
