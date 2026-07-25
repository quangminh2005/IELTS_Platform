# Nghe lại bài nghe ở trang kết quả

Ngày: 2026-07-25

## Vấn đề

Trang kết quả (`/student/results/[attemptId]`, `/teacher/results/[attemptId]`) hiện chỉ
cho xem transcript, không nghe lại được audio. Chin.edu.vn có thanh phát dính đáy màn
hình để học sinh vừa dò transcript vừa nghe lại đoạn mình sai.

## Phạm vi

Thêm một thanh phát dính đáy màn hình cho **phần Listening đang xem** ở trang kết quả.
Áp dụng cho cả trang học viên và trang giáo viên (dùng chung `ResultReview`), và cả
phòng xem trước của giáo viên (`attempt-workspace.tsx` → `previewResult`).

**Không** làm: nút ▶ nhỏ cạnh từng đáp án để nhảy tới đúng giây câu đó (chin có). Việc
đó cần dữ liệu mốc thời gian căn theo transcript mà DB không có — muốn làm phải thêm
dữ liệu trước, là một việc riêng.

## Luồng dữ liệu

`AssignableUnit.audioUrl` (đã có sẵn, **không đổi schema, không migration**)

1. Hai trang kết quả thêm `audioUrl: true` vào `select` của `answers.assignableUnit`.
2. `result-review.tsx` gom vào `ResultPart.audioUrl`, chỉ gán khi `skill === "listening"`.
3. `result-answers.tsx` (đã là client component, đang giữ state tab) render thanh phát
   cho part đang xem.

Vì không thêm cột nào, `scripts/ensure-db.mjs` không cần sửa.

## Thanh phát

Dùng lại `components/audio-player.tsx` thay vì viết player thứ hai — thêm 2 prop **tùy
chọn**, mặc định tắt nên luồng làm bài giữ nguyên hành vi:

- `showSpeed` — nút tốc độ. Lúc thi thật không được cho đổi tốc độ nên mặc định `false`.
- `label` — nhãn "đang nghe phần nào", ẩn dưới breakpoint `lg`.

Vòng lặp tốc độ tách ra hàm thuần `lib/playback-rate.ts`:
`1x → 1.25x → 1.5x → 0.75x → 1x`, giá trị lạ thì về `1x`.

### Hành vi

- Chỉ hiện khi part đang xem là listening **và** có `audioUrl`. Sang tab Đọc → biến mất.
  Part listening chưa upload audio → không hiện gì (không báo lỗi).
- `key={part.unitId}` → đổi tab thì player **remount**: audio cũ bị unmount nên dừng
  hẳn, thanh về `0:00` và tốc độ về `1x` của file mới. Không phát chồng hai phần.
- Khung `fixed inset-x-0 bottom-0 z-20`; `ResultReview` thêm `pb-24` khi bài có ít nhất
  một part listening có audio, để thanh không che mục "Đoạn đã tô" ở cuối trang.
- Nhãn ghép từ nhãn tab + khoảng số câu: `Nghe · Phần 1 · Câu 1–10`.

## Kiểm thử

- `tests/playback-rate.test.ts` — vòng lặp tốc độ + `formatPlaybackRate`.
- `tests/result-audio.test.ts` — structural: hai trang đều select `audioUrl`;
  `ResultPart` có `audioUrl`; `ResultReview` chỉ gán cho listening; có `key={part.unitId}`;
  `showSpeed` mặc định tắt và trang làm bài không bật nó.
- Kiểm thật trên dev server + DB test: bấm phát, đổi tốc độ (áp đúng vào
  `audio.playbackRate`), tua ±5s, đổi tab Nghe→Đọc (thanh mất, audio unmount và dừng),
  Đọc→Nghe (thanh về, `0:00`, `1x`).
