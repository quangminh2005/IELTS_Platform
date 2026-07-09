# Kho đề — Search / Filter / Sort / Status tags

Ngày: 2026-07-09 · Trang: `/teacher/materials`

## Mục tiêu
Khi kho tài liệu lớn dần (20+ đề, 60+ phần, 650+ câu), danh sách card khó dùng.
Thêm: search theo tên, filter theo kỹ năng, filter theo bộ sách, sort, và tag trạng thái.

## Kiến trúc — lọc phía client (không thêm round-trip DB)
Trang `app/teacher/materials/page.tsx` vốn đã load toàn bộ material + unit + question
(cần cho form sửa inline). Toàn bộ dữ liệu lọc đã có sẵn trong bộ nhớ.

- Server component giữ nguyên phần load Prisma + render từng card `<article>`.
- Thêm 1 query rẻ: ngày "giao gần nhất" cho mỗi material (qua `AssignmentUnit → Assignment.createdAt`).
- Server dựng `items: { meta, card }[]` rồi truyền cho client component mới.
- Client component `components/materials-browser.tsx` giữ state bộ lọc, hiện/ẩn card theo `meta`.
- Module thuần `lib/materials-filter.ts`: `deriveSeries()`, `computeStatus()`, `filterAndSortMaterials()` — unit-test bằng vitest.

## `meta` mỗi material
`id, title, skill, series, sourceLabel, unitCount, questionCount, createdAtMs, lastAssignedAtMs, statusFlags`

## Tag trạng thái (theo kỹ năng, có thể chồng nhau)
- `Chưa có phần` (xám) — 0 phần.
- `Thiếu audio` (hổ phách) — chỉ Listening, có phần thiếu `audioUrl`.
- `Thiếu câu hỏi` (hổ phách) — chỉ Listening/Reading, có phần 0 câu hỏi.
- `Đã hoàn chỉnh` (xanh) — có phần và không dính flag nào. Writing/Speaking có ≥1 phần = hoàn chỉnh (không cần audio/câu hỏi).

## Bộ sách (series)
Suy ra từ `sourceLabel ?? title`: lấy đoạn trước dấu `–`/`—`/`-`/`|` đầu tiên, trim.
Ví dụ "IELTS Master – Reading Test 5" → "IELTS Master". Fallback: cả chuỗi.

## Toolbar
- Search (tên + sourceLabel), tức thì.
- Kỹ năng: All / Listening / Reading / Writing / Speaking (chỉ hiện kỹ năng đang có).
- Bộ sách: dropdown các series suy ra được (distinct).
- Trạng thái: All / Hoàn chỉnh / Thiếu audio / Thiếu câu hỏi / Chưa có phần.
- Sắp xếp: Mới nhất (mặc định) / Nhiều câu nhất / Nhiều phần nhất / Giao gần đây.
- Đếm kết quả ("Hiện N / M tài liệu") + nút "Xoá bộ lọc" khi lọc rỗng.

## Ngoài phạm vi (YAGNI)
Filter lưu vào URL, preset bộ lọc, cột series riêng trong DB. State bộ lọc chỉ nằm trong component.

## Test
Vitest cho `lib/materials-filter.ts`: series edge cases, status theo kỹ năng, thứ tự sort.
