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
      "metadata": {
        "groupTitles": { "<order câu đầu nhóm>": "<TIÊU ĐỀ in giữa của nhóm nếu đề gốc có>" },
        "groupInstructions": { "<order câu đầu nhóm>": "<hướng dẫn nguyên văn của nhóm>" },
        "noteBody": "<CHỈ khi có summary/note/sentence completion — xem quy tắc bên dưới>"
      },
      "questions": [ ... 13–14 câu ... ]
    },
    { "unitNumber": 2, ... },
    { "unitNumber": 3, ... }
  ]
}

MỖI CÂU HỎI:
{
  "order": <số thứ tự câu 1..40, KHÔNG reset giữa các passage>,
  "questionType": "<một trong: multiple_choice | true_false_not_given | note_completion | short_answer>",
  "prompt": "<đề câu hỏi — với note_completion chỉ ghi ngắn 'Câu N'>",
  "options": ["A", "B", ...],   // chỉ cho multiple_choice / true_false_not_given
  "answer": "<đáp án>",
  "points": 1
}

TIÊU ĐỀ NHÓM: nếu đề gốc có tiêu đề in đậm/canh giữa phía trên một nhóm câu, chép nguyên văn
vào metadata.groupTitles với key = order câu đầu nhóm. KHÔNG bỏ sót tiêu đề.

Ô GHÉP "both ___ and ___": nếu một chỗ điền in thành HAI ô nhưng answer key chỉ đánh MỘT số
(vd note "pictures of both (33)...... and ......", đáp án "33 Jupiter and Saturn") → đặt [[n]]
HAI LẦN trong noteBody: "both [[33]] and [[33]]". Hệ thống hiện 2 ô, chỉ tính ĐÚNG khi CẢ HAI
ô đúng. answer của câu đó = cụm đầy đủ nối bằng " and " ("Jupiter and Saturn"). Giữ tổng 40 câu.

QUY TẮC CHỌN questionType:
- TRUE/FALSE/NOT GIVEN hoặc YES/NO/NOT GIVEN  → "true_false_not_given",
  options = ["TRUE","FALSE","NOT GIVEN"] hoặc ["YES","NO","NOT GIVEN"], answer phải khớp y hệt.
- Multiple choice A/B/C/D, Matching headings (A–G), Matching endings (A–G)
  → "multiple_choice". options là danh sách đầy đủ, answer là phần tử trong options.
  Ví dụ matching headings: options = ["A","B","C","D","E","F","G"], answer = "C".
- GHÉP TỪ MỘT HỘP DÙNG CHUNG (vd "Choose SIX answers from the box, write letter A–I"; ghép
  người/nơi/năm với danh sách cho sẵn trong hộp) → "matching". Hệ thống hiện 2 cột: câu bên trái
  (ô trống), hộp lựa chọn dùng chung bên phải (kéo/điền) — giống đề gốc.
    • prompt = chỉ tên mục cần ghép (vd tên người, "Asia"…), KHÔNG viết lại cả câu.
    • options = toàn bộ hộp, giống nhau cho mọi câu, dạng "A. nội dung"…; answer = phần tử đúng.
    • Câu dẫn + "Choose SIX…" đặt vào groupInstructions.
  KHÔNG dùng "multiple_choice" cho dạng có hộp chung này (sẽ ra radio lặp lại, sai layout).
- Summary / Note / Sentence completion, Flow-chart / Table completion (điền TỪ vào một đoạn văn/ghi chú cho sẵn)
  → "note_completion". KHÔNG có options. Đây là dạng hiển thị thành MỘT đoạn liền mạch,
  ô trống nằm ngay trong dòng chữ (giống chin.edu.vn) — TUYỆT ĐỐI KHÔNG tách mỗi chỗ trống
  thành một "short_answer" riêng.
  Cách làm:
    • Gom cả cụm (vd câu 17–22) vào metadata.noteBody của phần: chép NGUYÊN VĂN đoạn tóm tắt/
      ghi chú, đặt "[[order]]" tại mỗi chỗ trống (vd "...result of [[17]]. Others believe...").
    • Trong noteBody dùng quy ước: dòng "# Tiêu đề" = tiêu đề canh giữa; "## Tiểu mục" = tiểu mục
      in đậm; dòng trống = ngắt đoạn. Summary = các câu chảy liền trong đoạn; Note/Sentence
      completion = mỗi ý/câu một dòng (có thể mở đầu bằng "• ").
    • Mỗi chỗ trống vẫn là MỘT câu hỏi trong "questions": questionType = "note_completion",
      prompt = "Câu N", answer = từ/số chính xác từ bài đọc (KHÔNG lặp lại câu văn trong prompt).
    • Đặt hướng dẫn nhóm ("Complete the summary below. Choose ONE WORD ONLY...") vào
      metadata.groupInstructions với key là order câu đầu nhóm.
- Short answer THẬT SỰ (câu hỏi có dấu "?" trả lời trong vài từ, KHÔNG phải điền vào đoạn)
  → "short_answer". prompt là câu hỏi đầy đủ, answer là từ/số.

DẪN CHỨNG (evidence) — thêm cho MỖI câu:
- Trường "evidence" = trích NGUYÊN VĂN một câu/đoạn ngắn trong bài chứa đáp án đúng.
  Giữ đúng tiếng Anh gốc, KHÔNG diễn giải, KHÔNG dịch.
- Với note_completion / table_completion / short_answer: nếu bỏ trống, hệ thống tự dò
  câu chứa đáp án. Vẫn nên điền để chắc chắn đúng chỗ.
- Với multiple_choice / true_false_not_given / matching: BẮT BUỘC điền "evidence" vì hệ
  thống KHÔNG tự dò được (đáp án chỉ là chữ cái/TRUE-FALSE, không nằm nguyên văn trong bài).

KIỂM TRA TRƯỚC KHI XUẤT:
1. Tổng 40 câu, order chạy 1→40 không trùng.
2. Mọi câu multiple_choice / true_false_not_given: answer phải nằm trong options
   (so sánh không phân biệt hoa thường, khoảng trắng).
3. Mọi câu note_completion: phải có đúng một "[[order]]" tương ứng trong metadata.noteBody
   (và mọi "[[n]]" trong noteBody đều có câu hỏi order n).
4. Mọi câu multiple_choice / true_false_not_given / matching: phải có "evidence".
5. JSON parse được, không có ký tự lạ.
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
- **Với đề Listening:** mỗi `unit` cần thêm trường `transcript` = toàn bộ lời thoại audio (tiếng Anh, nguyên văn) để trang kết quả hiện transcript + gạch chân đáp án. `evidence` mỗi câu là đoạn transcript chứa đáp án.
- Sau khi có file JSON từ AI khác, có thể nhờ Claude **validate nhanh** (đọc file + chạy script kiểm tra schema/đáp án) trước khi import — đỡ phải sửa đi sửa lại trên trang web.
