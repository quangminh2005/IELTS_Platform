# Ôn Sổ từ theo lịch (thẻ ôn lặp lại ngắt quãng) — thiết kế

Ngày: 29/9/2026 · Trạng thái: thầy đã duyệt (cách A)

## Vì sao

Từ vựng mỗi ngày chỉ phát 1 từ/ngày (~50 từ đã phát / kho 518), quiz 5 câu bốc
ngẫu nhiên nên không có lý do để quay lại mỗi ngày — số liệu 18/9: đa số HS bỏ
sau 1–5 ngày. Ý tưởng lấy từ easyenglisheveryday.vercel.app: mỗi HS có một bộ
thẻ, mỗi thẻ có ngày ôn tiếp; nhớ thì giãn ra, quên thì ôn lại sớm.

## Quyết định đã chốt với thầy

1. Nguồn thẻ: **cả kho** (5 thẻ mới/ngày, có nút "Học thêm 5 từ") **+ HS tự thêm từ**.
2. Từ HS tự thêm: web tra từ điển miễn phí (phiên âm + nghĩa Anh), **HS tự gõ nghĩa
   Việt**, câu ví dụ lấy câu trong bài. Từ đã có trong kho thì dùng nghĩa của thầy.
3. Cách ôn: **phải trả lời, máy chấm** (không tự chấm kiểu lật thẻ).
4. Lưu trữ: **một bảng mới `VocabDeckCard`** (không nhét vào kho, không mở rộng
   `VocabProgress`).

## Dữ liệu

Bảng mới `VocabDeckCard` — mỗi dòng là một thẻ của một học viên:

| cột | ý nghĩa |
|---|---|
| `studentId` | chủ thẻ (cascade khi xoá HS) |
| `wordKey` | từ chuẩn hoá chữ thường — `@@unique([studentId, wordKey])` chặn trùng |
| `source` | `bank` (từ kho) \| `student` (HS tự thêm) — ghi vào comment đầu schema |
| `wordId` | trỏ `VocabWord` khi `source = bank` (nội dung đọc từ kho → thầy sửa nghĩa là thẻ đổi theo) |
| `display`, `phonetic`, `partOfSpeech`, `meaningVi`, `definitionEn`, `exampleEn` | chỉ dùng khi `source = student`; null với thẻ kho |
| `sourceAttemptId` | bài làm nơi HS bôi đen từ (không khoá ngoại — bài có thể bị reset) |
| `box` | 0 = mới chưa ôn lần nào, 1..6 |
| `dueDate` | `@db.Date`, ngày ôn tiếp theo giờ VN (quy ước nửa đêm UTC như `VocabDaily`) |
| `reviewCount`, `lapseCount`, `lastReviewedAt`, `createdAt` | thống kê |

Bảng tạo trên prod qua `scripts/ensure-db.mjs` (CREATE TABLE IF NOT EXISTS + index + FK),
đúng cách các bảng trước.

`VocabProgress` và `VocabQuizDay` **giữ nguyên và vẫn được ghi** (thẻ kho) để bảng
"Ôn từ vựng" của thầy và chuỗi ngày ôn chạy tiếp. `VocabQuizDay.correct/total` đổi
nghĩa từ "kết quả tốt nhất" sang "tổng số câu trong ngày" (cộng dồn) — cập nhật comment.

## Lịch ôn (hàm thuần `lib/vocab-srs.ts`)

- Khoảng cách theo hộp sau khi trả lời: hộp 1 = 1 ngày, 2 = 3, 3 = 7, 4 = 14, 5 = 30, 6 = 60.
- Đúng → lên 1 hộp (tối đa 6). Sai → về hộp 1 (ôn lại ngày mai), `lapseCount + 1`.
- **Chỉ lần trả lời đầu tiên trong ngày (giờ VN) của một thẻ mới đổi lịch.** Câu hỏi
  lại cuối buổi (sau khi sai) chỉ để luyện, client không gửi lên server.
- "Đã thuộc" = hộp ≥ 5.
- Dạng câu theo hộp: 0–1 chọn nghĩa · 2–3 chọn từ (Việt→Anh) · ≥4 điền từ vào câu
  (không đục lỗ được thì chọn từ). Dùng lại `maskWordInSentence` / `checkVocabAnswer`
  / câu trắc nghiệm của `lib/vocab-quiz.ts`; đáp án nhiễu lấy từ cả kho.

## Trang "Ôn thẻ hôm nay" (`/student/vocab`, thay quiz 5 câu cũ)

- Đầu trang: "Hôm nay: N thẻ đến hạn · M thẻ mới" + chuỗi ngày ôn + link Sổ từ.
- Một buổi tối đa **20 thẻ**: thẻ đến hạn trước (hạn sớm nhất, hộp thấp nhất), rồi thẻ mới.
- Thẻ mới/ngày: **5**, trừ số thẻ kho đã tạo hôm nay. Thứ tự lấy: Từ của ngày → từ đã
  phát (cũ trước) → phần còn lại của kho. Không lấy từ bị ẩn hay từ thầy ghim cho
  ngày tương lai. `?more=1` ("Học thêm 5 từ") cho thêm 5.
- Thẻ mới hiện **thẻ giới thiệu** (từ, IPA, 🔊, nghĩa, câu ví dụ) → bấm "Đã hiểu" → hỏi.
- Mỗi câu trả lời gọi server action ngay (`answerVocabCard`); server chấm lại bằng dữ
  liệu DB. Lỗi mạng → toast "Chưa lưu được", HS vẫn đi tiếp được.
- Thẻ kho mới được **tạo lúc trả lời câu đầu tiên** (upsert theo `studentId+wordKey`),
  không cần action riêng cho "Đã hiểu".
- Hết buổi: tóm tắt đúng/sai + nút "Ôn tiếp" (nếu còn thẻ đến hạn) / "Học thêm 5 từ".
- HS cũ: từ trong `VocabProgress` chưa có thẻ được tự tạo thẻ khi vào trang (hộp 2 nếu
  đúng > sai, ngược lại hộp 1; đến hạn hôm nay) — `createMany skipDuplicates`.

## Tự thêm từ ở trang Kết quả (`/student/results/[attemptId]`)

- Chỉ trang kết quả của học viên (sau khi nộp); không có trong lúc làm bài, không có ở
  trang kết quả phía giáo viên.
- Bôi đen 1–3 từ tiếng Anh (chỉ chữ cái, `-`, `'`, ≤ 40 ký tự) → nút nổi "➕ Sổ từ"
  (portal ra `body`, ghim trong viewport). Dùng `useSelectionCapture` sẵn có → chạy cả
  điện thoại.
- Bấm → khung thêm từ: Từ (sửa được) · phiên âm · nghĩa Anh (tự điền từ
  `lookupVocabWord`) · **Nghĩa tiếng Việt (bắt buộc)** · câu ví dụ (câu chứa từ, sửa được).
- `lookupVocabWord` (server action): từ có trong kho → trả nghĩa của thầy + cờ
  `inBank`; không thì gọi `api.dictionaryapi.dev` (timeout 4 giây). Lỗi/không thấy →
  trả rỗng, HS tự gõ.
- `addStudentVocabWord`: từ có trong kho → tạo thẻ `bank` (bỏ qua nghĩa HS gõ); không thì
  thẻ `student`. Đã có thẻ → báo "Từ này đã có trong Sổ từ". Thẻ mới đến hạn hôm nay, hộp 0,
  **không tính vào hạn mức 5 thẻ mới**.
- Tách câu bằng hàm thuần tự viết, **không dùng regex lookbehind** (iOS < 16.4 chết khi parse).

## Sổ từ (`/student/vocab/words`)

- Gồm: mọi thẻ của HS + các từ đã phát mà HS chưa có thẻ ("Chưa học").
- Mỗi từ có nhãn *Chưa học / Mới / Đang học / Đã thuộc* và "Ôn tiếp: dd/mm"; thẻ tự thêm
  có nhãn "Tự thêm".
- Nhóm theo ngày (ngày thêm thẻ, hoặc ngày phát với từ chưa học); tìm kiếm như cũ.
- Thẻ tự thêm: sửa nghĩa Việt + câu ví dụ, xoá (bấm 2 lần xác nhận, không `window.confirm`).

## Phía thầy

- Bảng "Ôn từ vựng" (`/teacher/practice`) thêm cột **Đã thuộc** và **Quá hạn**
  (thẻ có `dueDate` < hôm nay).
- Thẻ trang chủ học viên: nút "Ôn 5 từ cũ" → "Ôn thẻ hôm nay (N)".

## Dọn dẹp

Bỏ `submitVocabQuiz`, `components/vocab-quiz-form.tsx`, `buildQuiz` (và test của nó)
vì trang mới thay thế hoàn toàn.

## Kiểm thử

- Unit (vitest): `nextSchedule`, `questionKindForBox`, `isMastered`,
  `buildReviewSession` (thứ tự, trần 20, hạn mức thẻ mới), `pickNewWords`,
  `sentenceAround`, `normalizeWordKey`, `isAddableSelection`, cột mới của
  `buildVocabStudentRows`.
- `pnpm test`, `pnpm lint`, `pnpm build` xanh; chạy thử trên DB local bằng tài khoản học viên.

## Ngoài phạm vi

Bộ collocation soạn sẵn; thẻ lật tự chấm; thêm từ trong lúc làm bài tự luyện.
