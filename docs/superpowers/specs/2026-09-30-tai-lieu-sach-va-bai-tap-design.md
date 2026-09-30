# Tài liệu: tách "Sách / bộ đề" và "Bài tập hàng tuần"

Ngày: 30/9/2026 · Trạng thái: đã duyệt

## Mục tiêu
Trang `/teacher/materials` đang là một danh sách phẳng 149 tài liệu. Tách thành 2 mục:
- **Sách / bộ đề** (`book`): đề in sẵn theo bộ sách (IELTS Master, Cambridge 20, Official Cambridge Guide, LPTD, Hackers…).
- **Bài tập hàng tuần** (`homework`): mọi thứ còn lại — homework, bài viết trên lớp, kiểm tra định kỳ, placement test, đề Speaking/Writing lẻ.

Chỉ 2 mục, không có mục thứ ba (thầy đã chọn).

## Dữ liệu
Thêm 2 cột vào `Material` (additive, phải thêm vào `scripts/ensure-db.mjs`):
- `category String @default("homework")` — `"book" | "homework"`; ghi vào khối comment enum đầu `schema.prisma`.
- `bookName String?` — tên kệ sách; chỉ có nghĩa khi `category = "book"`.

Backfill prod một lần bằng script `tmp/backfill-material-category.mjs` (chạy tay, có chế độ xem trước `--dry`):

| Điều kiện (title/sourceLabel) | category | bookName |
|---|---|---|
| IELTS Master + Listening | book | IELTS Master – Listening |
| IELTS Master + Reading | book | IELTS Master – Reading |
| Cambridge IELTS 20 | book | Cambridge IELTS 20 |
| The Official Cambridge Guide | book | The Official Cambridge Guide to IELTS |
| Listening Practice Through Dictation | book | Listening Practice Through Dictation |
| Hackers IELTS Listening | book | Hackers IELTS Listening |
| còn lại | homework | null |

Chỉ đổi những dòng khớp luật `book`; dòng khác giữ mặc định `homework`.

## Giao diện `/teacher/materials`
- Header giữ nguyên (thống kê + nút Tạo / Nhập).
- Hai tab: **Sách / bộ đề (n)** · **Bài tập hàng tuần (n)**. Tab đang chọn lưu ở query `?tab=book|homework` (mặc định `book`), đổi tab bằng `router.replace` không reload.
- Thanh lọc dùng chung: tìm kiếm + kỹ năng + trạng thái + tự luyện + sắp xếp (bỏ ô "bộ sách" vì kệ sách thay thế).
- **Tab Sách:**
  - Kệ sách: lưới ô (2 cột ≥ sm, 3 cột ≥ lg). Mỗi ô: tên sách, tag kỹ năng có trong sách, "N đề", "M đang mở tự luyện" nếu M > 0. Ô đang mở được viền primary.
  - Bấm ô → hiện thẻ đề của sách đó bên dưới kệ (áp bộ lọc + sắp xếp). Bấm lại → đóng. Sách không có `bookName` gom vào ô "Chưa đặt tên sách".
  - Khi ô tìm kiếm có chữ: ẩn kệ, hiện thẳng mọi thẻ đề khớp trong tab.
  - Kệ chỉ hiện ô còn ít nhất 1 đề khớp bộ lọc kỹ năng/trạng thái/tự luyện.
- **Tab Bài tập hàng tuần:** danh sách thẻ như hiện nay, mặc định mới nhất trên cùng.
- Thẻ đề giữ nguyên (Xem trước, Cho tự luyện, Sửa, Xem N phần). Vẫn giữ mọi thẻ mounted, ẩn/hiện bằng `hidden` + CSS `order` như `MaterialsBrowser` hiện tại.

## Đổi loại / tạo mới
- "Sửa tài liệu": thêm ô **Loại** (select 2 giá trị) và **Tên sách** (input + `<datalist>` gợi ý tên sách đã có).
- `updateMaterial` / `createMaterial` / `importMaterial`: nhận `category` (zod `z.enum(["book","homework"])`, mặc định `homework`) và `bookName` (tuỳ chọn). Nếu `category = homework` thì lưu `bookName = null`.
- Form tạo tay (`material-editor.tsx`) và khối Nhập JSON (`material-import.tsx`) có 2 ô tương tự; JSON import chấp nhận thêm trường `category`, `bookName` ở cấp material.

## Logic thuần (`lib/materials-filter.ts`)
- `MaterialMeta` thêm `category`, `bookName`.
- `groupBookShelves(metas)` → `[{ name, skills, count, practiceOpenCount }]`, sắp theo tên (vi), "Chưa đặt tên sách" cuối cùng.
- `MaterialFilters` thêm `category`, `book` (`"all"` hoặc tên sách); `filterMaterials` lọc thêm theo 2 trường này.

## Không làm
Trang Giao bài (unit picker), thư viện Tự luyện học viên, trang học viên — không đổi.

## Kiểm thử
- `tests/materials-filter.test.ts`: `groupBookShelves`, lọc theo category/book.
- Test cấu trúc: `schema.prisma` có `category`, `bookName`; `ensure-db.mjs` có 2 câu `ALTER TABLE`.
- Kiểm trên trình duyệt local: đổi tab, mở/đóng kệ, tìm kiếm, sửa loại một đề.
