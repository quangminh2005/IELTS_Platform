# Bấm transcript để phát audio đúng đoạn (trang kết quả Listening)

Ngày: 2026-07-25

## Vấn đề

Trang kết quả đã có thanh nghe lại (spec 2026-07-25-listening-replay-on-results), nhưng
muốn nghe lại đoạn chứa đáp án thì học sinh phải tự dò tay trên thanh tiến trình. Cần:
bấm vào câu trong transcript → audio tua tới đúng đoạn đó và phát; kèm nút ▶ trên từng
thẻ câu hỏi để nhảy thẳng tới câu dẫn chứng (giống chin.edu.vn).

DB không có mốc thời gian nào nối transcript với audio → phải tạo dữ liệu này trước.

## Dữ liệu

Thêm cột `AssignableUnit.transcriptTimingJson` (`String?`, JSON):

```json
{ "v": 1, "words": [{ "w": "good", "t": 31.2 }, { "w": "evening", "t": 31.5 }] }
```

- Danh sách **từng từ của transcript** (đã chuẩn hóa: thường hóa, bỏ dấu câu) kèm giây
  bắt đầu trong audio. Từ không khớp được với ASR thì nội suy từ hai từ khớp gần nhất.
- Lưu theo từ (không theo câu) vì transcript hiển thị bị điền đáp án vào chỗ trống và
  cắt câu lại theo dẫn chứng → vị trí ký tự không ổn định; khớp theo chuỗi từ thì bền.
- Cột mới phải thêm vào `scripts/ensure-db.mjs` (quy trình additive-column của dự án).

## Bộ đồng bộ (server)

- `lib/transcript-timing.ts` — hàm thuần: nhận (từ + giây từ Whisper) và (transcript
  DB) → khớp hai chuỗi từ bằng so trình tự (DP), tự bỏ qua dòng không được đọc
  (`SECTION n`, tên người nói `Name:`, `(Pause)`, khối Instructions). Trả về
  `words` + tỷ lệ khớp (để backfill cảnh báo part khớp kém, ví dụ audio gộp 4 part).
- `syncTranscriptTiming(unitId)` — server helper: tải audio từ Blob → Groq Whisper
  (`whisper-large-v3-turbo`, `verbose_json`, `timestamp_granularities: ["word"]`,
  mẫu code theo `lib/actions/transcribe.ts`) → chạy hàm khớp → lưu cột mới.
- **Kích hoạt tự động**: sau `importMaterial` (part listening có audio + transcript)
  và sau khi giáo viên lưu part làm đổi `audioUrl`/`transcript`. Lỗi đồng bộ chỉ ghi
  log, không làm hỏng việc lưu — thiếu timing thì UI giữ nguyên hành vi cũ.
- **Backfill**: `scripts/backfill-transcript-timing.mjs` chạy một lần cho các part
  Listening hiện có trên prod; in tỷ lệ khớp từng part.

## Giao diện (`result-answers.tsx`, `audio-player.tsx`)

- Client tra giây bắt đầu của mỗi câu transcript bằng cách dò chuỗi từ của câu trong
  `words` (hai bên cùng thứ tự → dò một lượt hai con trỏ).
- Bấm câu trong transcript → thanh phát tua tới `max(0, t − 1)` giây và phát. Câu bấm
  được có `cursor-pointer` + sáng nhẹ khi hover. Không có timing → như cũ.
- Nút ▶ trên thẻ câu hỏi (chỉ listening, chỉ khi câu có dẫn chứng dò được): tua audio
  tới câu dẫn chứng **và** tô dẫn chứng (setActiveOrder) như khi bấm thẻ.
- `AudioPlayer` thêm prop tùy chọn `controlRef` cho phép bên ngoài gọi
  `seekTo(seconds, { play: true })`. Mặc định không truyền → trang làm bài giữ nguyên.
- Dùng chung cho trang kết quả học viên, giáo viên và phòng xem trước (đều qua
  `ResultAnswers`).

## Kiểm thử

- Vitest cho `lib/transcript-timing.ts`: transcript có tên người nói/(Pause)/khối
  hướng dẫn; ASR nghe sai vài từ vẫn khớp; audio không khớp → tỷ lệ thấp.
- Structural: cột mới trong schema + ensure-db; `AudioPlayer` không nhận controlRef ở
  trang làm bài; hai trang kết quả select cột mới.
- Kiểm thật trên dev server + DB test, rồi trên Vercel + prod sau backfill.

## Rủi ro

- Lệch ~1–2 giây chỗ nhạc nền/nói nhanh — đã trừ hao tua sớm 1 giây.
- Part audio gộp cả bài (sót từ trước khi cắt ffmpeg) → tỷ lệ khớp thấp, backfill báo
  để xử lý riêng.
