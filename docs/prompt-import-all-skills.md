# Prompt mẫu — nhờ AI khác chuyển đề IELTS sang JSON (Listening / Reading / Writing / Speaking)

Dùng để giảm token Claude khi cần import nhiều đề. Đưa prompt dưới đây + file PDF (hoặc ảnh đề + ảnh answer key)
cho ChatGPT / Gemini / DeepSeek… rồi lưu kết quả thành `<ten>_<skill>.json` và import qua trang **Tài liệu**
(`/teacher/materials` → khối **Import JSON**).

> Mỗi lần chỉ làm **MỘT kỹ năng** cho ra **MỘT file JSON**. Ở đầu prompt, xoá phần "PHẦN RIÊNG..."
> của 3 kỹ năng còn lại để AI khỏi lẫn.

---

## Prompt

```
Bạn là trợ lý chuyển đề IELTS từ PDF/ảnh sang JSON để import vào hệ thống học IELTS của tôi.

NHIỆM VỤ:
- Đọc tài liệu đính kèm (đề + answer key nếu có).
- Xuất ra MỘT file JSON DUY NHẤT cho ĐÚNG MỘT kỹ năng: <listening | reading | writing | speaking>.
- Transcribe CHÍNH XÁC từng từ đề bài và câu hỏi (không tóm tắt, không paraphrase).
- Đáp án lấy từ trang "Answer key". Writing/Speaking không có đáp án (chấm tay).
- KHÔNG thêm bình luận, KHÔNG bọc trong dấu ```json — chỉ JSON thuần, parse được.

SCHEMA CHUNG:
{
  "title": "<Tên bộ đề> – <Skill>",
  "skill": "<listening | reading | writing | speaking>",
  "sourceLabel": "<Nguồn, vd: Cambridge IELTS 20 – Test 1>",
  "description": "<mô tả ngắn tiếng Việt>",
  "units": [ { ...unit... } ]
}

MỖI UNIT (một part / một passage / một task):
{
  "unitType": "<listening_part | reading_passage | writing_task | speaking_part>",
  "unitNumber": <1,2,3,...>,
  "title": "<tiêu đề part/passage>",
  "instructions": "<hướng dẫn ngắn tiếng Việt cho học sinh>",
  "content": "<nội dung part/passage — xem quy tắc từng kỹ năng>",
  "defaultTimeLimitMinutes": <số phút>,
  "metadata": {
    "groupTitles": { "<order câu đầu nhóm>": "<TIÊU ĐỀ in giữa của nhóm, vd 'New city developments'>" },
    "groupInstructions": { "<order câu đầu nhóm>": "<hướng dẫn NGUYÊN VĂN của nhóm>" }
  },
  "questions": [ { ...câu hỏi... } ]
}

QUY TẮC VỀ TIÊU ĐỀ (groupTitles) — BẮT BUỘC:
- Đề gốc thường có TIÊU ĐỀ in đậm/canh giữa phía trên một nhóm câu, vd "New city developments",
  "Transport Survey", "THE FUTURE OF MANAGEMENT", "The later life of Thor Heyerdahl". PHẢI giữ lại
  đầy đủ, KHÔNG bỏ sót.
- Đặt tiêu đề vào metadata.groupTitles, key = order của câu ĐẦU nhóm nằm dưới tiêu đề đó,
  value = chép NGUYÊN VĂN tiêu đề. Hệ thống sẽ hiện canh giữa, in đậm phía trên nhóm.
- LƯU Ý: nếu tiêu đề đã nằm sẵn trong "content" của phần (dạng note/table completion chép cả đoạn),
  thì KHÔNG thêm lại vào groupTitles (tránh lặp). groupTitles chủ yếu dùng cho nhóm trắc nghiệm
  mà content không chứa đoạn văn.

MỖI CÂU HỎI:
{
  "order": <số thứ tự TOÀN BÀI, KHÔNG reset giữa các part>,
  "questionType": "<xem bảng bên dưới>",
  "prompt": "<đề câu hỏi — với dạng điền chỗ trống chỉ ghi 'Câu N'>",
  "options": ["A. ...", "B. ...", ...],   // chỉ cho dạng có lựa chọn
  "answer": "<đáp án>",                    // hoặc mảng ["...","..."]; bỏ trống với writing/speaking
  "points": 1
}

BẢNG questionType hợp lệ (dùng đúng chuỗi này):
  multiple_choice | true_false_not_given | note_completion | table_completion |
  short_answer | matching | writing_task | speaking_task

QUY TẮC CHỌN questionType:
- MC A/B/C/D (mỗi câu có bộ lựa chọn riêng), Matching headings (A–G) → "multiple_choice".
  options = danh sách ĐẦY ĐỦ dạng "A. nội dung", "B. nội dung"...; answer là MỘT phần tử y hệt trong options.
- GHÉP TỪ MỘT HỘP DÙNG CHUNG (dạng "Choose SIX answers from the box and write the correct letter
  A–I next to questions 15–20", vd "Areas of the world" ↔ hộp "Features"; hoặc ghép người/nơi/năm…)
  → "matching". Hệ thống hiện 2 CỘT: danh sách câu bên trái (mỗi câu có ô trống), HỘP lựa chọn dùng
  chung bên phải để học sinh kéo/điền chữ cái vào ô trống — GIỐNG HỆT đề gốc.
    • prompt = CHỈ tên mục cần ghép (vd "Asia", "Antarctica"…), KHÔNG viết lại cả câu hỏi.
    • options = TOÀN BỘ hộp, giống nhau cho mọi câu trong nhóm, dạng "A. ancient forts", "B. waterways"…
    • answer = phần tử đúng trong options (vd "E. local animals").
    • Câu dẫn ("Which feature is related to…") + "Choose SIX…" đặt vào groupInstructions.
  TUYỆT ĐỐI KHÔNG dùng "multiple_choice" cho dạng có HỘP chung này (sẽ ra radio A–I lặp lại, sai layout).
- TRUE/FALSE/NOT GIVEN hoặc YES/NO/NOT GIVEN → "true_false_not_given",
  options = ["TRUE","FALSE","NOT GIVEN"] hoặc ["YES","NO","NOT GIVEN"], answer khớp y hệt.
- "Choose TWO letters" (chọn 2 đáp án cho 1 nhóm) → TÁCH thành 2 câu multiple_choice liên tiếp
  (vd order 21 và 22). CẢ HAI câu: options giống nhau, answer = MẢNG gồm CẢ HAI đáp án đúng.
  (Hệ thống chấm đúng nếu học sinh chọn 1 trong 2 cho mỗi ô.)
- Summary / Note / Table / Flow-chart / Sentence completion (điền TỪ vào đoạn văn/bảng cho sẵn)
  → "note_completion" (dạng ghi chú/đoạn) hoặc "table_completion" (dạng bảng).
  KHÔNG có options. Đây là MỘT đoạn liền mạch, ô trống nằm trong dòng chữ (giống chin.edu.vn):
    • Chép NGUYÊN VĂN đoạn/ghi chú/bảng vào "content", đặt "[[order]]" tại mỗi chỗ trống.
      (Bảng dùng cú pháp Markdown table; ghi chú dùng dòng "- " cho gạch đầu dòng.)
    • Mỗi chỗ trống là MỘT câu hỏi: questionType = "note_completion"/"table_completion",
      prompt = "Câu N", answer = từ/số chính xác. Nếu chấp nhận nhiều cách viết → answer là mảng,
      vd ["30","thirty"].
    • Hướng dẫn nhóm ("Complete the notes... Write ONE WORD ONLY") đặt vào groupInstructions,
      key = order câu đầu nhóm.
- Short answer THẬT (câu có "?" trả lời vài từ, KHÔNG điền vào đoạn) → "short_answer".
  prompt = câu hỏi đầy đủ, answer = từ/số.

============================================================
PHẦN RIÊNG THEO KỸ NĂNG — chỉ giữ lại phần đúng với kỹ năng đang làm:
============================================================

[ LISTENING ]  skill="listening", unitType="listening_part"
- 4 part, tổng 40 câu (order 1→40). defaultTimeLimitMinutes = 10 mỗi part.
- Part chỉ có câu hỏi trắc nghiệm (không phải điền đoạn): content = "Nghe audio ở đầu trang và trả lời các câu hỏi bên dưới."
- Part dạng note/table/form completion: chép form vào content với [[order]] như quy tắc trên.
- description nhắc: "Nhớ upload 4 file audio MP3 cho từng part sau khi import."

[ READING ]  skill="reading", unitType="reading_passage"
- 3 passage, tổng 40 câu (order 1→40). defaultTimeLimitMinutes = 20 mỗi passage.
- content = TOÀN BỘ passage (giữ nguyên xuống dòng giữa các đoạn).
- Với summary/note completion trong Reading: có thể để đoạn tóm tắt trong metadata.noteBody (thay vì content)
  và đặt [[order]] trong đó — hệ thống chấp nhận cả content lẫn noteBody.

[ WRITING ]  skill="writing", unitType="writing_task"
- 2 task: Task 1 và Task 2. defaultTimeLimitMinutes: Task 1 = 20, Task 2 = 40.
- content = ĐỀ BÀI đầy đủ (Task 1 mô tả biểu đồ/bảng/quy trình; Task 2 câu hỏi luận + "Write at least 250 words").
  Nếu Task 1 có hình (biểu đồ), mô tả bằng chữ trong content (vd bảng số liệu) vì hệ thống chưa gắn ảnh trong đề.
- MỖI task có ĐÚNG 1 câu hỏi: questionType = "writing_task", KHÔNG có options, KHÔNG có answer,
  prompt = "Viết bài của bạn vào ô soạn thảo bên phải." , points = 9.
- instructions nhắc học sinh gõ bài vào ô soạn thảo; giáo viên chấm tay.

[ SPEAKING ]  skill="speaking", unitType="speaking_part"
- 3 part. content = danh sách câu hỏi/cue card của part đó.
- MỖI part có ĐÚNG 1 câu hỏi: questionType = "speaking_task", KHÔNG options, KHÔNG answer,
  prompt = "Ghi âm phần trả lời của bạn cho Part N.", points = 9.
- instructions nhắc học sinh bấm "Bắt đầu ghi âm" → "Dừng & nộp"; giáo viên nghe và chấm tay.

============================================================
KIỂM TRA TRƯỚC KHI XUẤT:
1. Listening/Reading: đủ 40 câu, order 1→40 không trùng, không nhảy số.
2. Mọi câu multiple_choice / true_false_not_given: answer nằm trong options (không phân biệt hoa thường/khoảng trắng).
3. Mọi câu note_completion/table_completion: có đúng một [[order]] tương ứng trong content (hoặc noteBody),
   và mọi [[n]] đều có câu hỏi order n.
4. Writing/Speaking: mỗi task/part đúng 1 câu, KHÔNG có answer.
5. JSON parse được, không ký tự lạ, không bọc ```json.
```

---

## Quy trình

1. Chọn kỹ năng → xoá 3 khối "PHẦN RIÊNG" thừa trong prompt → đưa prompt + PDF/ảnh cho AI bên ngoài.
2. Lưu output thành `tmp/<ten>_<skill>.json`.
3. Trang **Tài liệu** (`/teacher/materials`) → **Import JSON** → dán → Import.
4. Listening: sau khi import, **upload MP3 cho từng part**. Writing Task 1 có biểu đồ: kiểm tra lại đề mô tả đủ chưa.
5. Nếu import báo lỗi (vd *"đáp án X không nằm trong options"*), copy nguyên lỗi gửi lại cho AI sửa rồi import lại.
6. Tạo Assignment, chọn unit, đặt thời gian, giao cho lớp.

## Lưu ý

- Reading dùng riêng file [prompt-import-reading.md](prompt-import-reading.md) nếu chỉ làm Reading (chi tiết hơn về summary/noteBody).
- Sau khi có JSON từ AI khác, có thể nhờ Claude **validate nhanh** trước khi import — đỡ sửa đi sửa lại trên web.
```
