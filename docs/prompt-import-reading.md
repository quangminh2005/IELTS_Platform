# Prompt mẫu — nhờ AI khác chuyển đề Reading sang JSON

Dùng để giảm tải token Claude khi cần import nhiều bộ đề Cambridge IELTS Reading vào hệ thống.
Đưa prompt dưới đây + file PDF cho ChatGPT / Gemini / NotebookLM / DeepSeek… rồi lưu kết quả thành `cam<NN>_test<Y>_reading.json` và import qua trang Tài liệu.

---

## Prompt

```
Bạn là trợ lý chuyển đề IELTS Cambridge từ PDF sang JSON để import vào hệ thống học IELTS của tôi.

NHIỆM VỤ:
- Đọc PDF đính kèm (Cambridge IELTS – Test X – Reading).
- Xuất ra MỘT file JSON duy nhất theo schema bên dưới.
- Phải transcribe CHÍNH XÁC từng từ của 3 passage và 40 câu hỏi (không tóm tắt, không paraphrase).
- Đáp án lấy từ trang "Answer key" cuối sách / cuối test.
- Không thêm bình luận, không bọc trong ```json — chỉ JSON thuần.

SCHEMA:
{
  "title": "Cambridge IELTS XX – Test Y (Reading)",
  "skill": "reading",
  "sourceLabel": "Cambridge IELTS XX (Academic) – Test Y",
  "description": "...",
  "units": [
    {
      "unitType": "reading_passage",
      "unitNumber": 1,
      "title": "Passage 1 – <tiêu đề>",
      "instructions": "Hướng dẫn ngắn bằng tiếng Việt",
      "content": "<TOÀN BỘ passage 1, giữ nguyên xuống dòng giữa các đoạn>",
      "defaultTimeLimitMinutes": 20,
      "questions": [ ... 13–14 câu ... ]
    },
    { "unitNumber": 2, ... },
    { "unitNumber": 3, ... }
  ]
}

MỖI CÂU HỎI:
{
  "order": <số thứ tự câu 1..40, KHÔNG reset giữa các passage>,
  "questionType": "<một trong: multiple_choice | short_answer | true_false_not_given>",
  "prompt": "<đề câu hỏi>",
  "options": ["A", "B", ...],   // bỏ trường này nếu là short_answer
  "answer": "<đáp án>",
  "points": 1
}

QUY TẮC CHỌN questionType:
- TRUE/FALSE/NOT GIVEN hoặc YES/NO/NOT GIVEN  → "true_false_not_given",
  options = ["TRUE","FALSE","NOT GIVEN"] hoặc ["YES","NO","NOT GIVEN"], answer phải khớp y hệt.
- Multiple choice A/B/C/D, Matching headings (A–G), Matching người (A/B/C), Matching endings (A–G)
  → "multiple_choice". options là danh sách đầy đủ, answer là phần tử trong options.
  Ví dụ matching headings: options = ["A","B","C","D","E","F","G"], answer = "C".
- Gap-fill / Note completion / Summary completion / Sentence completion (điền từ vào chỗ trống)
  → "short_answer". KHÔNG có options. answer là từ/số chính xác từ bài đọc.
  Prompt viết lại thành 1 câu kèm "______" tại chỗ cần điền
  (ví dụ: "Nests are created in ______, where the eggs are laid.").

KIỂM TRA TRƯỚC KHI XUẤT:
1. Tổng 40 câu, order chạy 1→40 không trùng.
2. Mọi câu multiple_choice / true_false_not_given: answer phải nằm trong options
   (so sánh không phân biệt hoa thường, khoảng trắng).
3. JSON parse được, không có ký tự lạ.
```

---

## Quy trình

1. Đưa prompt + PDF (cắt riêng 1 test) cho AI bên ngoài.
2. Lưu output thành `tmp/cam<NN>_test<Y>_reading.json`.
3. Mở trang **Tài liệu** (`/teacher/materials`) → khối **Import JSON** → dán nội dung → bấm Import.
4. Nếu import báo lỗi (vd *"đáp án X không nằm trong options"*), copy nguyên lỗi đó gửi lại cho AI để sửa rồi import lại.
5. Tạo Assignment, chọn 3 unit, đặt thời gian 60 phút, giao cho lớp.

## Lưu ý

- **Chỉ áp dụng cho Reading.** Listening cần audio + nhiều dạng đặc thù (note/table/plan/map completion). Khi cần Listening hoặc Writing, mở Claude làm prompt riêng — sẽ phức tạp hơn.
- Sau khi có file JSON từ AI khác, có thể nhờ Claude **validate nhanh** (đọc file + chạy script kiểm tra schema/đáp án) trước khi import — đỡ phải sửa đi sửa lại trên trang web.
