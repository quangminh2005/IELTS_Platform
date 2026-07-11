# Thiết kế: Tô sáng đáp án được đọc đánh vần (kiểu "Hardie" → "H-A-R-D-I-E")

Ngày: 2026-07-11
Nhánh: `feature/ielts-platform-mvp`

## Mục tiêu

Trang kết quả tô sáng cả các đáp án mà transcript **đọc đánh vần từng chữ cái**,
ví dụ đáp án `Hardie` xuất hiện trong transcript dưới dạng `H-A-R-D-I-E` (hoặc
`H A R D I E`, `H.A.R.D.I.E`).

## Bối cảnh (đã khảo sát dữ liệu thật)

Trong 20 câu điền từ của Listening Test 1, 19 câu đã được tô sáng bởi
`splitByAnswerMatches` (khớp linh hoạt khoảng trắng). Chỉ `Hardie` trượt: transcript
đọc `"Hardy"` (gây nhiễu) rồi đánh vần `"H-A-R-D-I-E"`. Không có ca lệch nào khác.

`splitByAnswerMatches` (trong `lib/answer-evidence.ts`) hiện dựng mỗi đáp án thành
mẫu `flexiblePattern`: các ký tự (bỏ khoảng trắng) nối bằng `\s*`.

## Quyết định thiết kế (đã thống nhất)

- Thêm kiểu khớp **đánh vần**: các chữ cái nối bằng **một dấu ngăn cách bắt buộc**
  thuộc `[-.\s]` (gạch nối / khoảng trắng / dấu chấm).
- **Chỉ áp dụng cho đáp án ≥ 3 ký tự chữ-số** (tránh ca 2 chữ như "at" khớp bừa
  vào "a t-shirt").
- **KHÔNG** khớp mờ/phiên âm (không coi "Hardy" ≈ "Hardie") — tránh tô nhầm cách
  viết sai gây nhiễu.

## Kiến trúc

Chỉ sửa `lib/answer-evidence.ts`, hàm `splitByAnswerMatches`:

- Thêm helper `spelledPattern(answer: string): string` — lấy các ký tự chữ-số của
  đáp án; nếu < 3 ký tự trả `""` (bỏ qua); nếu không, trả
  `\b<c1>[-.\s]<c2>[-.\s]...<cn>\b` (dấu ngăn cách **bắt buộc** giữa mỗi cặp).
- Với mỗi đáp án, đưa **cả hai** mẫu vào regex tổng: `flexiblePattern(a)` và
  `spelledPattern(a)` (bỏ mẫu rỗng). Giữ nguyên phần còn lại (sort theo độ dài,
  cờ `gi`, vòng lặp `exec`, chống vòng lặp vô hạn).
- `flexiblePattern`, `deriveAnswerEvidence`, `fillSourceBlanks` giữ nguyên.

Chữ ký `splitByAnswerMatches(text, answers)` không đổi → `result-answers.tsx` không
cần sửa.

## Kiểm thử

Bổ sung `tests/answer-evidence.test.ts`:

- Đánh vần gạch nối: `splitByAnswerMatches("It's H-A-R-D-I-E.", ["Hardie"])` tô
  `"H-A-R-D-I-E"`.
- Đánh vần khoảng trắng: `["Hardie"]` trên `"spelt H A R D I E ok"` tô `"H A R D I E"`.
- KHÔNG tô mờ: `["Hardie"]` trên `"Louisa: Hardy."` → không có phần match.
- Chặn 2 chữ: `["at"]` trên `"a t-shirt"` → không có phần match (đáp án < 3 ký tự).
- Không hồi quy: các test khớp thường/linh hoạt khoảng trắng cũ vẫn xanh.

`pnpm test` + `pnpm build` xanh; kiểm tra thực tế: mở lại kết quả Listening Test 1,
Part 1 câu 1 tô `"H-A-R-D-I-E"`, không tô `"Hardy"`.

## Loại trừ

Không đổi schema/UI/chấm điểm. Không khớp mờ/phiên âm. Không đụng file khác ngoài
`lib/answer-evidence.ts` và test của nó.
