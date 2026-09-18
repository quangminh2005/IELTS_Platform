# Từ vựng mỗi ngày — quiz 3 dạng + phát âm + chữa bài

Ngày: 2026-09-18. Trạng thái: đã ship prod 18/9 (commit 02e53142), kiểm tay trên tài khoản học viên.

## Vì sao

Số liệu prod 18/9: 19/31 học viên từng làm quiz nhưng đa số bỏ sau 1–5 ngày.
Quiz hiện chỉ có một dạng (nhìn từ → chọn nghĩa Việt, 4 lựa chọn), sau khi nộp
không có gì để học lại, thẻ trên trang chủ không có phát âm dù đã có phiên âm.

## Phạm vi

1. **Thẻ "Từ vựng hôm nay"** (`components/vocab-card.tsx`): nút 🔊 đọc từ bằng
   `speechSynthesis` của trình duyệt (giọng `en-GB`, ẩn nút nếu máy không hỗ trợ);
   hiện thêm `definitionEn` chữ nhỏ dưới nghĩa Việt.
2. **Quiz 5 câu, 3 dạng** (`lib/vocab-quiz.ts`):
   - `meaning`: từ → chọn nghĩa Việt (4 lựa chọn) — như cũ.
   - `reverse`: nghĩa Việt → chọn từ Anh (4 lựa chọn, nhiễu là từ khác trong rổ).
   - `cloze`: che từ trong `exampleEn`, hiện gợi ý nghĩa Việt, học viên **gõ**.
     Không gợi ý chữ cái đầu. Che được cả dạng biến thể (academy → academies)
     bằng cách khớp tiền tố; câu không tìm thấy từ thì rơi về dạng `meaning`.
   - Mẫu 5 câu cố định `[meaning, cloze, reverse, cloze, meaning]`, xoay theo
     seed để từ nào rơi vào dạng nào đổi mỗi lượt.
   - Chấm: `checkVocabAnswer(kind, word, chosen)` dùng chung cho server và
     client; so sánh sau `normalizeAnswer` (bỏ hoa/thường, gộp khoảng trắng).
     Cloze chấp nhận dạng trong câu **hoặc** dạng gốc (`display`).
3. **Chữa bài** (`components/vocab-quiz-form.tsx`): sau khi nộp, mỗi câu mở
   dòng chữa: từ + phiên âm + 🔊 + nghĩa Việt + câu ví dụ in đậm từ. Câu sai ghi
   "Bạn chọn/gõ: …".
4. **Server** (`lib/actions/vocab.ts`): payload thêm `kind`; chấm lại từ DB
   (display/meaningVi/exampleEn), không tin client. `VocabProgress` và
   `VocabQuizDay` giữ nguyên cách đếm.

## Không đổi

Schema DB, cách chọn từ của ngày, chuỗi ngày, xếp hạng (quiz vẫn tách riêng),
trang giáo viên.

## Kiểm thử

`tests/vocab-quiz.test.ts`: đủ 5 câu đúng tỉ lệ 2/1/2; cloze che đúng từ kể cả
biến thể; câu không che được rơi về `meaning`; `checkVocabAnswer` từng dạng;
reverse có 4 từ khác nhau và đáp án đúng ở `correctIndex`.
