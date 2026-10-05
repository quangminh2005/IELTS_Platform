# AI chấm Writing & Speaking (5/10/2026)

## 1. Bối cảnh

Hiện bài Writing/Speaking chấm tay hoàn toàn ở `/teacher/review/[attemptId]` (band từng
task theo 4 tiêu chí, band tổng Writing = (T1 + T2×2)/3, ghi chú tại chỗ
`AnswerAnnotation`, ngân hàng câu nhận xét mẫu). AI duy nhất đang có là nút phiên âm bản
ghi Speaking bằng Groq Whisper (`lib/actions/transcribe.ts`).

Thầy muốn dùng AI để chấm Writing và Speaking. **Thầy chốt:**
- **Bài thầy giao:** AI chỉ chấm **nháp** khi thầy **bấm nút**; thầy sửa rồi lưu, học
  viên chỉ thấy bản thầy lưu.
- **Bài tự luyện:** học viên tự bấm nhờ AI chấm, xem ngay; giới hạn **số lượt/ngày mỗi
  học viên** (mặc định 3, thầy chỉnh được).
- AI tạo ra: **band 4 tiêu chí + lý do + nhận xét tổng** và **lỗi sai trong bài**
  (đoạn trích → cách sửa → giải thích). Không viết lại bài, không "3 việc cần làm".
- Nhà cung cấp: **OpenAI**.
- Chấm dựa trên **IELTS Band Descriptors bản chính thức (cập nhật 5/2023)** thầy cung cấp:
  `E:\IELTS band descriptor\IELTS Writing Band Descriptors.pdf` (Task 1 + Task 2) và
  `E:\IELTS band descriptor\IELTS Speaking Band Descriptors.pdf`.

## 2. Phạm vi

**Làm (đợt 1):**
- bảng `AiReview`, cột `TeacherProfile.aiDailyLimit`;
- bộ máy chấm `lib/ai-grading/` gọi OpenAI, ép JSON theo khuôn;
- dữ liệu band descriptors dựng từ PDF bằng script;
- nút "AI chấm nháp" ở trang chấm của thầy + khung bản nháp + danh sách lỗi Giữ/Bỏ;
- khối "Nhận xét AI" ở trang Kết quả bài tự luyện của học viên;
- giới hạn lượt/ngày + dòng chi phí tháng ở `/teacher/practice`;
- nhãn "AI đã chấm" ở tab Tự luyện của hàng đợi chấm.

**Không làm (để sau):**
- **Đợt 2 — chấm Pronunciation từ audio** (`gpt-audio-mini`): thử trên vài bản ghi thật,
  so với band thầy chấm, đo chi phí thật, rồi viết spec riêng nếu đáng làm.
- Tự chấm ngầm khi nộp, chấm theo lô (Batch API).
- Học viên chấm lại cùng một bài; bài viết lại nâng band; gợi ý lộ trình.
- Dạy AI chấm sát thầy bằng các bài thầy đã chấm (few-shot) — ý tưởng sau khi có dữ liệu so sánh.

## 3. Dữ liệu

### 3.1 Bảng mới `AiReview`

```prisma
// Một lượt AI chấm một bài làm (Writing/Speaking). Tách riêng khỏi TeacherReview:
// điểm AI không bao giờ lẫn vào điểm thầy chấm.
model AiReview {
  id                String         @id @default(cuid())
  attemptId         String
  studentId         String         // chép từ Attempt để đếm lượt/ngày nhanh
  requestedBy       String         // "teacher" | "student"
  status            String         // "pending" | "done" | "failed"
  model             String         // vd "gpt-6.1-sol"
  resultJson        String?        // AiGradingResult (mục 4.4), chỉ có khi done
  errorMessage      String?        // tiếng Việt, khi failed
  inputTokens       Int?
  cachedInputTokens Int?
  outputTokens      Int?
  costUsd           Float?         // null nếu model không có trong bảng giá
  createdAt         DateTime       @default(now())
  updatedAt         DateTime       @updatedAt
  attempt           Attempt        @relation(fields: [attemptId], references: [id], onDelete: Cascade)
  student           StudentProfile @relation(fields: [studentId], references: [id], onDelete: Cascade)

  @@index([attemptId])
  @@index([studentId, createdAt])
}
```

- Thêm `TeacherProfile.aiDailyLimit Int?` (null → 3).
- Cập nhật khối comment String-enum đầu `schema.prisma` với `requestedBy` và `status`.
- **Phải thêm `CREATE TABLE` + `ALTER TABLE` vào `scripts/ensure-db.mjs`** (chạy trong build
  → tự áp lên prod).
- Một lượt `pending` quá 5 phút coi như hỏng (hàm serverless chết giữa chừng): được phép
  mở lượt mới, lượt cũ chuyển `failed`.

### 3.2 Band descriptors

- Script `scripts/build-band-descriptors.py` (pdfplumber) đọc hai PDF → ghi
  `lib/ai-grading/descriptors/writing-task1.json`, `writing-task2.json`, `speaking.json`.
- Khuôn: `{ "source": "...", "criteria": [{ "key", "name" }], "bands": { "9": { "<key>": "..." }, ... "0": {...} } }`.
- Chữ chép **nguyên văn** từ bảng PDF (chỉ nối dòng, bỏ ký tự rác); script tự kiểm: đủ
  band 9→0, đủ 4 tiêu chí, ô nào trống thì báo lỗi (trừ ô PDF vốn gộp chung như band 0/1
  thì ghi rõ trong JSON).
- Key tiêu chí khớp `WRITING_CRITERIA` / `SPEAKING_CRITERIA` ở `lib/writing-review.ts`.
- File JSON được commit; chạy lại script chỉ khi IELTS ra bản descriptors mới.

## 4. Bộ máy chấm `lib/ai-grading/`

| File | Việc | Test |
|---|---|---|
| `descriptors/*.json` | dữ liệu band descriptors | kiểm đủ band/tiêu chí |
| `prompt.ts` | hàm thuần dựng tin nhắn cho model | có |
| `schema.ts` | khuôn JSON (zod) model phải trả về | — |
| `validate.ts` | hàm thuần kiểm + làm sạch kết quả | có |
| `pricing.ts` | bảng giá theo model, quy đổi USD→VND | có |
| `openai.ts` | **file duy nhất** gọi OpenAI | — |
| `grade-attempt.ts` | điều phối: đọc bài → (phiên âm) → gọi → kiểm → lưu | — |

### 4.1 Model & cấu hình
- Thư viện chính thức `openai` (thêm vào `package.json`), Structured Outputs theo khuôn zod.
- `OPENAI_API_KEY` (bắt buộc; thiếu → mọi nút AI ẩn), `OPENAI_GRADING_MODEL` (mặc định
  `gpt-6.1-sol`, $2/$10 mỗi 1 triệu token, cached input $0.10).
- Tham số gọi (reasoning effort, timeout ~120 giây, số lần thử lại) chốt lúc code sau khi
  đọc tài liệu SDK; không đoán.
- Ước tính: ~1.300đ/task Writing, ~2.500đ/bài đủ 2 task. Đo lại bằng số token thật sau
  vài lượt đầu.

### 4.2 Writing — mỗi task một lần gọi
- **Phần cố định đặt đầu** (để OpenAI tự cache tiền tố): vai giám khảo IELTS, quy tắc, và
  **nguyên bảng descriptors của đúng Task 1 hoặc Task 2** (nhận loại task bằng
  `resolveWritingTaskNumber`).
- **Phần thay đổi**: đề bài (prompt/content của unit; Task 1 có ảnh biểu đồ thì gửi kèm
  ảnh), số từ do **code đếm**, bài làm bọc trong khối phân định và dặn model coi là dữ
  liệu, không phải chỉ dẫn.
- Quy tắc trong prompt: chấm từng tiêu chí theo descriptors, lý do phải bám vào mô tả của
  band được chọn; phạt thiếu từ đúng như descriptors; nhận xét + giải thích lỗi bằng
  **tiếng Việt có dấu**, đoạn trích lỗi giữ **nguyên văn tiếng Anh** trong bài.
- Bài chỉ có câu điền chỗ trống (`isCorrect !== null`) thì bỏ qua — chỉ chấm bài luận
  (`isCorrect === null`), giống trang chấm hiện tại.

### 4.3 Speaking — cả bài một lần gọi
- Part nào thiếu `Answer.transcript` → tự phiên âm bằng Groq trước (tách hàm dùng chung từ
  `lib/actions/transcribe.ts`, giữ nguyên kiểm `isAllowedAudioUrl` + `redirect: "error"`).
- Gửi descriptors Speaking (bỏ cột Pronunciation), từng câu hỏi + bản phiên âm.
- Chấm FC/LR/GRA. **Pronunciation = null**, giao diện ghi "AI không nghe được giọng".
- Mỗi lỗi kèm `answerId` để biết thuộc câu nào.

### 4.4 Khuôn kết quả (`AiGradingResult`)
```ts
{
  version: 1,
  skill: "writing" | "speaking",
  tasks: [{                      // Writing: mỗi task một phần tử; Speaking: đúng 1 phần tử
    unitId: string,
    label: string,
    taskNumber: 1 | 2 | null,
    criteria: [{ key: string, band: number | null, reason: string }],
    summary: string,
    errors: [{
      answerId: string,
      quote: string,             // nguyên văn trong bài/bản phiên âm
      correction: string,
      explanation: string,
      category: "grammar" | "vocabulary" | "spelling" | "punctuation" | "coherence"
    }]
  }]
}
```
Band tổng **không** do model tính: dùng `taskBand` / `overallBandFromTasks` có sẵn
(Speaking: trung bình 3 tiêu chí, làm tròn 0,5, ghi chú thiếu Pronunciation).

### 4.5 Kiểm kết quả (`validate.ts`)
- Band phải là bội số 0,5 trong [0, 9]; sai → coi cả lượt là lỗi (không lưu nửa vời).
- Đủ đúng 4 tiêu chí (Speaking: 3 + Pronunciation null), không thừa key lạ.
- Lỗi có `quote` không tìm thấy trong bài/bản phiên âm của đúng `answerId` → **bỏ lỗi đó**
  (model bịa), không làm hỏng lượt.
- Cắt độ dài chữ (lý do, nhận xét) ở mức hợp lý để model không trả cả trang.

## 5. Phía thầy — `/teacher/review/[attemptId]`

- Nút **"AI chấm nháp"** phía trên phiếu chấm (chỉ hiện khi có `OPENAI_API_KEY` và bài có
  phần Writing/Speaking chấm tay). Đang chạy: "AI đang chấm… (khoảng 30 giây)".
- Khung **"Bản nháp của AI"**: band + lý do từng tiêu chí từng task, nhận xét tổng.
  - **"Điền vào phiếu chấm"** → chép band và nhận xét vào `ReviewForm` (state + nháp
    localStorage có sẵn). **Không lưu**; thầy sửa rồi bấm Lưu như cũ.
  - Speaking: ô Pronunciation để trống cho thầy điền.
- Dưới mỗi bài luận Writing: **"Lỗi AI tìm thấy (n)"** — đoạn trích → cách sửa ·
  giải thích, nút **Giữ / Bỏ**, nút "Giữ tất cả".
  - Giữ → tạo `AnswerAnnotation` (teacherId = thầy, offset = lần xuất hiện đầu tiên chưa
    dùng của đoạn trích trong `Answer.value`, note = "→ {sửa}. {giải thích}").
  - Bỏ → chỉ ẩn trên giao diện (lưu id lỗi đã bỏ trong localStorage theo lượt AI).
  - Speaking: lỗi chỉ hiện danh sách (không gắn ghi chú tại chỗ vì `Answer.value` là URL
    audio); "Điền vào phiếu chấm" chép kèm danh sách lỗi vào ô nhận xét chi tiết.
- Bài đã có lượt AI `done` (vd học viên nhờ chấm bài tự luyện) → hiện sẵn, nút đổi thành
  "Chấm lại bằng AI". Thầy chấm lại không giới hạn.
- Hàng đợi `/teacher/review?tab=practice`: nhãn nhỏ "AI đã chấm".

## 6. Phía học viên — `/student/results/[attemptId]` (CHỈ bài tự luyện)

- Khối **"Nhận xét AI"** khi bài tự luyện có phần Writing/Speaking chấm tay:
  - chưa chấm: nút "Nhờ AI chấm bài này (còn 2/3 lượt hôm nay)"; hết lượt → nút mờ +
    "Hết lượt hôm nay, mai quay lại nhé";
  - đã chấm: band từng tiêu chí + band ước lượng, dòng in nghiêng *"Điểm do AI ước lượng,
    chỉ để tham khảo — điểm chính thức do thầy chấm"*, nhận xét tổng, bài làm có tô màu
    các lỗi + danh sách lỗi bên dưới (chạm lỗi → đoạn đó sáng lên; dùng tốt trên điện thoại).
- **Mỗi bài tự luyện học viên chỉ nhờ AI chấm một lần** (không có nút chấm lại).
- Thầy đã chấm bài đó → nhận xét của thầy ở trên, khối AI thu gọn bên dưới.
- **Bài thầy giao: học viên không bao giờ thấy lượt AI**, kể cả khi thầy đã bấm AI chấm nháp
  (truy vấn trang Kết quả lọc `requestedBy = "student"` và chỉ khi bài là tự luyện).

## 7. Giới hạn lượt & chi phí

- Lượt học viên = số `AiReview` `requestedBy = "student"`, `status = "done"` của học viên đó
  trong **ngày giờ Việt Nam** (dùng `VN_OFFSET_MS`). Lỗi không trừ lượt.
- Giới hạn = `aiDailyLimit` của thầy sở hữu bài (null → 3). Thầy chỉnh ở `/teacher/practice`.
- Chặn trùng: đang có lượt `pending` (chưa quá 5 phút) cho bài này → từ chối mở lượt mới.
- `/teacher/practice` có dòng **"AI tháng này: N lượt · khoảng X đ"** (tổng `costUsd`
  tháng VN × tỉ giá hằng số trong `pricing.ts`, ghi rõ là ước tính).

## 8. Bảo mật

- Action thầy: `requireTeacher()` trước tiên, attempt phải thuộc bài giao của thầy.
- Action học viên: `requireStudent()` trước tiên, attempt phải của chính học viên, đã nộp,
  và là bài tự luyện (`lib/practice.ts`, không gõ chuỗi "practice").
- Bài làm là dữ liệu do học viên gõ → bọc khối phân định + dặn model; kết quả bị khuôn JSON
  và `validate.ts` giới hạn nên chèn lệnh vào bài cũng chỉ làm lệch điểm, không làm gì khác.
- `OPENAI_API_KEY` chỉ dùng phía máy chủ.

## 9. Xử lý lỗi

- OpenAI lỗi / quá thời gian / từ chối / JSON sai khuôn → lượt `failed` + `errorMessage`
  tiếng Việt, giao diện hiện lỗi + nút thử lại. Không trừ lượt học viên.
- Phiên âm Groq lỗi → lượt `failed` với lời báo riêng ("Không phiên âm được bản ghi…").
- Không có key → ẩn nút, không lỗi.

## 10. Kiểm thử

- Test thuần: `prompt.ts` (chọn đúng bảng Task 1/2, đếm từ, có khối phân định),
  `validate.ts` (band lẻ, thiếu tiêu chí, đoạn trích bịa bị bỏ), đếm lượt theo ngày VN,
  `pricing.ts`, dữ liệu descriptors đủ ô.
- Test cấu trúc: mọi action AI gọi `requireTeacher`/`requireStudent` đầu tiên (giống
  `teacher-page-guard.test.ts`); chỉ `openai.ts` được import `openai`.
- Kiểm giao diện local: biến môi trường `AI_GRADING_FAKE=1` cho `openai.ts` trả kết quả cố
  định (có cả lỗi đúng và lỗi bịa) — không tốn tiền. Vai học viên dùng JWT tự ký như các
  lần trước.
- Gọi OpenAI thật vài lần trên bài thật ở local để đo token/chi phí và để thầy so band AI
  với band thầy đã chấm trước khi push.
