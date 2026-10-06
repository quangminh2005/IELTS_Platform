# Đo độ trôi chảy Speaking từ mốc thời gian (AI chấm Fluency)

Ngày: 6/10/2026 · Thầy duyệt: cách "AI tham khảo" + "thầy thấy số đo, học viên không" + "cách B (đánh dấu chỗ ngừng trong bản phiên âm)".

## Vấn đề

AI chấm Speaking chỉ đọc bản phiên âm Groq. Whisper bỏ hết tiếng ngập ngừng ("um, uh"),
khoảng lặng, câu bỏ dở → bản phiên âm đọc trôi chảy hơn thực tế → Fluency & Coherence bị
chấm cao (bài thử 5/10: AI 7.0 rồi 6.0, thầy 5.5). Dặn "thận trọng" trong prompt chỉ đỡ một phần.

## Đã kiểm

Groq `whisper-large-v3-turbo` với `response_format=verbose_json` +
`timestamp_granularities[]=word` trả mốc từng từ. Đoạn TTS chèn ngừng 3 s / 2 s / 1,2 s →
khoảng hở giữa các từ đo được 3,74 / 2,06 / 1,80 s (gồm cả ngắt tự nhiên cuối câu). Mốc theo
**segment** bỏ sót chỗ ngừng 2 s giữa câu → phải dùng mốc **từng từ**. Hạn mức Groq tính theo
giây âm thanh nên kiểu kết quả không tốn thêm.

## Thiết kế

### 1. Lấy & lưu mốc thời gian
- `lib/groq-transcribe.ts`: `transcribeAudioUrl` chuyển sang `verbose_json` + word timestamps;
  kết quả thêm `words: { w: string; s: number; e: number }[]` (s/e làm tròn 2 chữ số thập phân).
  Chữ `transcript` vẫn lấy từ `text` của Groq như cũ.
- Cột mới `Answer.speechTimingJson String?` = JSON `{ v: 1, words: [...] }`. Thêm vào
  `prisma/schema.prisma` + `scripts/ensure-db.mjs` (`ADD COLUMN IF NOT EXISTS`).
- Cả hai nơi gọi lưu cột này cùng `transcript`: nút "Phiên âm" (`lib/actions/transcribe.ts`) và
  `ensureSpeakingTranscripts` (`lib/ai-grading/grade-attempt.ts`).
- `ensureSpeakingTranscripts`: câu đã có `transcript` nhưng **chưa có** `speechTimingJson`
  (bài cũ) → phiên âm lại một lần, ghi đè cả hai cột. Bản ghi rỗng → bỏ qua câu như hiện nay.
- `transcript` vẫn là chữ sạch → trang Kết quả học viên không đổi.

### 2. Tính số đo — `lib/speech-fluency.ts` (hàm thuần)
- `parseSpeechTiming(json)` → words hoặc null (JSON hỏng/sai phiên bản → null, không ném lỗi).
- `computeFluencyStats(words)` →
  - `wordCount`, `speakingSeconds` = từ đầu `s` → từ cuối `e` (bỏ lặng đầu/cuối);
  - `wordsPerMinute` (null nếu `speakingSeconds` < 3 hoặc < 5 từ — quá ngắn để kết luận);
  - các lần ngừng = khoảng hở `words[i].s − words[i−1].e` ≥ 1,0 s; mỗi lần ghi `seconds`,
    `midPhrase` (từ trước KHÔNG kết thúc bằng `. , ? ! ; :`);
  - `pausesOver1s`, `pausesOver2s`, `midPhrasePausesOver1s`, `longestPause`.
- `combineFluencyStats(list)` → dòng tổng cả bài (cộng từ/giây/lần ngừng, wpm tính lại từ tổng).
- `annotatePauses(words)` → chuỗi chữ chèn `(pause 2.1s)` ở mỗi khoảng hở ≥ 1,0 s; dùng làm nội dung
  `<response>` gửi AI khi có mốc (không có mốc → dùng `transcript` như cũ).
- Ngưỡng (1,0 s, 2,0 s, mức tham khảo wpm) gom thành hằng số đầu file để chỉnh sau.

### 3. Đưa cho AI — `lib/ai-grading/input.ts`, `prompt.ts`
- `GradingAnswer` thêm `fluency?: FluencyStats` và `promptText?: string` (bản chèn dấu ngừng,
  chỉ dùng trong prompt). `text` giữ nguyên là `transcript` sạch → `validate.ts` (`locateQuote`
  với `answer.text`) và phần tô lỗi không đổi. Trước khi đối chiếu, bỏ `(pause …)` khỏi quote
  model trả về; prompt cũng dặn không chép dấu ngừng vào quote.
- Mỗi câu thêm dòng `Timing: 112 words/min · pauses ≥1s: 4 (3 mid-phrase) · ≥2s: 1 · longest 2.4s`;
  đầu phần transcript thêm dòng tổng.
- System prompt (Speaking) thay đoạn "Be conservative…" bằng:
  - `(pause Ns)` = khoảng lặng đo từ audio thật; có thể chứa tiếng "um/uh" bị máy bỏ;
  - ngừng **giữa cụm từ** = tìm từ/ngữ pháp → hạ Fluency; ngừng giữa ý = ít nặng hơn;
  - mức tham khảo gần đúng (không phải luật): < ~100 wpm + nhiều ngừng giữa cụm → Fluency
    thường 5–5.5; ~100–120 → 5.5–6; ~120–140, ít ngừng giữa cụm → 6.5–7; nhanh mà vẫn ngừng giữa
    cụm nhiều thì không cho cao;
  - nhận xét được nói bằng lời ("ngập ngừng nhiều giữa câu") nhưng **không trích con số**
    (học viên không được thấy số đo).
  - Phần này vẫn cố định theo kỹ năng → không phá cache tiền tố.

### 4. Thầy xem ở trang chấm — `app/teacher/review/[attemptId]/page.tsx`
- Dưới bản phiên âm mỗi câu Speaking: dòng nhỏ xám
  "Tốc độ ~105 từ/phút · ngừng ≥2 giây: 3 lần (2 giữa cụm từ) · lâu nhất 3,7 giây"
  (wpm null → "câu quá ngắn để đo tốc độ").
- Đầu phần Speaking: dòng tổng cả bài. Câu chưa có mốc → không hiện.
- Sau khi bấm "Phiên âm" ở `TranscribeButton`, dòng số đo hiện theo (action trả kèm stats).
- Không thêm gì ở trang của học viên.

### 5. Chế độ giả & kiểm thử
- `AI_GRADING_FAKE=1`: phiên âm giả kèm mốc giả có vài chỗ ngừng.
- Unit test vitest: `computeFluencyStats` (wpm, ngừng giữa cụm/giữa câu, câu quá ngắn),
  `annotatePauses`, `parseSpeechTiming` (JSON hỏng), parse phản hồi verbose_json của Groq,
  prompt Speaking có dòng Timing.
- Sau deploy: kiểm trên prod (Chrome, vai thầy) bằng bài Speaking đã chấm 5/10 — so Fluency với 5.5.

## Không làm lần này
Chấm Pronunciation; đo độ trễ trước khi trả lời; code tự ép trần điểm; hiện số đo cho học viên.

## Bổ sung 6/10/2026 (chiều): ngừng ngắn + độ dài mạch nói

Kiểm prod bài Đỗ Hoàng Anh Minh: 118 từ/phút, 0 lần ngừng ≥1 s giữa cụm từ → AI vẫn F 6.0
(thầy 5.5). Ngưỡng 1 s bỏ sót các lần ngập ngừng ngắn. Thầy duyệt thêm:
- Đếm ngừng ≥ 0,5 s (`SHORT_PAUSE_SECONDS`), tách giữa cụm từ, quy ra **số lần/phút nói**.
- **Độ dài mạch nói** (mean length of run) = số từ / số mạch (mỗi lần ngừng ≥ 0,5 s mở mạch mới,
  mỗi câu trả lời cũng là một mạch mới) — chỉ số trôi chảy hay dùng nhất trong nghiên cứu.
- `annotatePauses` chèn dấu từ 0,5 s. Mức tham khảo (`FLUENCY_REFERENCE`) viết lại theo mạch nói +
  ngừng giữa cụm/phút; ngừng 0,5–1 s giữa hai câu là bình thường, không trừ.
- Dòng của thầy: "Tốc độ ~118 từ/phút · trung bình ~7 từ mỗi mạch nói · ngừng giữa cụm từ ≥0,5 giây:
  6 lần · ngừng ≥1 giây: 3 lần (≥2 giây: 0) · lâu nhất 1,5 giây".
- Không đổi cột DB: mốc từng từ đã lưu sẵn, số đo tính lại từ đó.

## Sửa 6/10/2026 (tối): số đo chỉ được kéo Fluency XUỐNG

Bài Anh Minh sau bản bổ sung: ~16 từ/mạch, 0 ngừng ≥0,5 s giữa cụm từ, có câu chỉ 95 từ/phút →
AI đẩy F lên **7.0** (thầy 5.5). Nói chậm mà không có khoảng hở = Whisper gộp "ừm/à" và từ kéo
dài vào thời lượng từ → số đo "trôi chảy" KHÔNG đáng tin. Đổi prompt: timing chỉ hạ điểm; khi
timing trông trôi chảy thì chấm thận trọng như cũ và không cho F cao hơn band cao nhất của
Lexical/Grammar; bỏ mốc tham khảo "≥10 từ/mạch → 6.5–7".
