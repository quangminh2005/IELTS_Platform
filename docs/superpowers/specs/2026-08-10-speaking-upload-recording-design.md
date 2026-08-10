# Học viên tải file ghi âm lên cho bài Speaking

Ngày: 2026-08-10

## Vấn đề

Bài Speaking hiện chỉ có một đường nộp: ghi âm trực tiếp trên web
(`components/audio-recorder-answer.tsx` → `MediaRecorder` → Vercel Blob).

Đường đó hỏng là mất bài. Ngày 9/8/2026 hai học viên nộp Speaking Homework 6/8 mà
**không có bản ghi nào lên tới Blob** — đối chiếu kho Blob với DB prod cho thấy trong
khung giờ làm bài của hai em không hề có file nào được tạo, kể cả sau lúc bấm nộp.
Micro bị chặn quyền, trình duyệt cũ không có `MediaRecorder`, hay đơn giản là học viên
quen thu bằng ứng dụng ghi âm của điện thoại — cả ba trường hợp đều không có lối ra.

## Phạm vi

Thêm đường nộp thứ hai: **chọn file âm thanh có sẵn trong máy và tải lên**, ngang hàng
với nút ghi âm (luôn hiện, không phải chỉ hiện khi ghi âm hỏng).

**Không** làm: cờ bật/tắt theo từng bài giao (kiểu `lockAudio` của Listening). Việc đó
cần thêm cột vào schema, sửa form giao bài và `scripts/ensure-db.mjs` — để dành đến khi
thật sự cần chế độ thi thử nghiêm ngặt cho Speaking.

**Không đổi schema, không migration, không sửa `scripts/ensure-db.mjs`.**

## Đánh đổi đã cân nhắc

Cho tải file lên nghĩa là học viên có thể thu đi thu lại ở nhà rồi tải bản đẹp nhất.
Với bài về nhà thì chấp nhận được, nhưng giáo viên phải **biết** bài nào là bài nào.

Giải pháp không tốn cột DB: nhét nguồn gốc vào **tên file** trên Blob.

- Ghi trực tiếp → `speaking-<questionId>-<ts>.<ext>` (đúng nếp đang chạy)
- Tải file lên → `speaking-upload-<questionId>-<ts>.<ext>`

`Answer.value` vốn là URL Blob, nên đọc ngược tiền tố là ra nguồn gốc. Bài cũ trước
ngày 10/8/2026 đều mang tiền tố `speaking-`, và lúc đó chưa có đường tải file — nên
nhãn "Ghi trực tiếp" cho bài cũ là **đúng sự thật**, không phải phỏng đoán.

## Logic thuần: `lib/speaking-upload.ts`

Tách khỏi component để test được mà không cần trình duyệt.

### `checkSpeakingFile(file)`

Nhận `{ name, type, size }`, trả `{ ok: true, contentType }` hoặc `{ ok: false, message }`.

Hai bẫy thật phải xử:

1. **`file.type` rỗng.** iPhone chọn file từ app Files, và vài trình duyệt Android, trả
   `type` là chuỗi rỗng. Không được tin `file.type` — phải suy ra từ đuôi file.
2. **`type` không nằm trong danh sách server cho phép.** `/api/speaking/upload` chỉ nhận
   `audio/webm`, `video/webm`, `audio/ogg`, `audio/mp4`, `audio/mpeg`, `audio/mp3`,
   `audio/wav`, `audio/aac`, `audio/x-m4a`. Gửi sai là server từ chối sau khi đã tải
   xong — phí băng thông và học viên chỉ thấy lỗi tiếng Anh khó hiểu.

Nên **luôn lấy contentType theo đuôi file**, `file.type` chỉ dùng khi đuôi lạ:

| Đuôi | contentType gửi lên |
|---|---|
| `.m4a`, `.mp4`, `.aac` | `audio/mp4` |
| `.mp3` | `audio/mpeg` |
| `.wav` | `audio/wav` |
| `.ogg`, `.oga` | `audio/ogg` |
| `.webm` | `audio/webm` |
| khác | từ chối |

### Trần dung lượng: 30MB

Mỗi part Speaking là một `AssignableUnit` riêng với đúng 1 câu ghi âm (đúng với cả 7
unit Speaking đang có trên prod), nên trần này áp cho **từng part**.

Căn theo số thật: file lớn nhất trong 10 bản ghi học viên đã nộp là **3,08 MB** cho một
câu Part 2 nói ~2 phút, tức ~1,5 MB/phút.

| Định dạng | Tốc độ | 30MB chứa được |
|---|---|---|
| Ghi trên web (webm/mp4) | ~1,5 MB/phút | ~20 phút |
| Voice Memos iPhone (m4a) | ~0,3 MB/phút | ~90 phút |
| Ghi âm Android (m4a 128kbps) | ~1 MB/phút | ~30 phút |
| WAV không nén | ~5–10 MB/phút | ~3–6 phút |

Part dài nhất (Part 3) khoảng 4–5 phút, nên 30MB phủ hết mọi trường hợp thật, kể cả
WAV mono. Vẫn thấp hơn trần 50MB của route, và vẫn chặn được vụ tải nhầm video.

Chặn ngay ở trình duyệt, **không gọi server** — kho Blob từng bị khoá vì vượt băng
thông, mở cửa cho học viên tự tải file lên thì phải giữ chốt này ở phía rẻ nhất.

Thông báo phải chỉ đường thoát, không chỉ báo lỗi:

> File nặng quá (42MB) — chắc em xuất ra định dạng WAV không nén. Em thu lại bằng ứng
> dụng ghi âm sẵn của điện thoại (ra file m4a, nhẹ hơn khoảng 20 lần) rồi tải lên nhé.

### `speakingUploadName(questionId, source, fileName)` và `speakingAnswerSource(url)`

Đặt tên theo bảng ở mục "Đánh đổi", và đọc ngược ra `"recorded" | "uploaded"`.

`speakingAnswerSource` phải bám vào **tên file trong URL**, không phải toàn chuỗi URL —
host của Blob có thể đổi. Cũng phải chịu được hậu tố ngẫu nhiên mà `addRandomSuffix: true`
chèn vào trước phần đuôi.

## Ô ghi âm: `components/audio-recorder-answer.tsx`

Chưa có bản ghi:

> `[● Bắt đầu ghi âm]` hoặc `[⬆ Tải file ghi âm lên]`

Đã có bản ghi: giữ **Ghi âm lại**, thêm **Tải file khác**.

Nút tải file là `<label>` bọc `<input type="file" accept="audio/*" className="sr-only">`
— input file trần trụi rất xấu và không đồng bộ giữa các trình duyệt.

Cả hai đường đi qua đúng một hàm `uploadRecording(blob, type, source)`. Nhờ vậy **chốt
chặn nộp bài** (`onBusyChange` → `blockingRecorder`, thêm ngày 10/8) tự động bảo vệ luôn
đường tải file: đang tải mà bấm Nộp là bị chặn y hệt đang ghi âm.

Thêm % tiến độ (`onUploadProgress`) cho cả hai đường — file điện thoại thường nặng hơn
bản ghi trên web, không có % thì học viên tưởng treo máy.

Sau mỗi lần chọn file phải xoá `input.value`, không thì chọn lại **đúng file đó** lần
hai sẽ không kích hoạt `onChange`.

## Màn Chấm bài: `app/teacher/review/[attemptId]/page.tsx`

Cạnh dòng "Bài ghi âm của học viên" thêm chip nhỏ:

- **Ghi trực tiếp** — thu ngay trên web
- **Học viên tải file lên** — thu sẵn rồi tải lên

## Kiểm thử

`tests/speaking-upload.test.ts` — logic thuần:

- `.m4a` không có MIME type → nhận, contentType `audio/mp4`
- `.MP3` chữ hoa → nhận
- `.pdf`, `.docx` → từ chối
- 30MB + 1 byte → từ chối, thông báo có nhắc m4a
- đặt tên rồi đọc ngược ra đúng nguồn gốc, cả khi có hậu tố ngẫu nhiên
- URL bài cũ (`speaking-...`) → `"recorded"`

`tests/speaking-submit-guard.test.ts` — bổ sung: đang tải file cũng chặn nộp.
