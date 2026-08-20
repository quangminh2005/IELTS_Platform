# Chặn dịch bài đọc / bài nghe khi đang làm bài

- **Ngày:** 2026-08-20
- **Nhánh:** feature/ielts-platform-mvp
- **Trạng thái:** Đã chốt thiết kế, chờ lập kế hoạch triển khai

## Vấn đề

Khi làm bài Listening / Reading, học sinh bấm **chuột phải** lên đoạn văn hoặc câu hỏi là
trình duyệt hiện ngay menu có **"Dịch mục đã chọn sang Tiếng Việt"** và **"Tìm trên
Google"**. Chỉ một cú bấm là tra được nghĩa của từ — tức là bài thi đọc hiểu mất phần lớn ý
nghĩa.

Ngoài menu chuột phải còn nhiều "cửa" khác dẫn tới cùng một việc. Bảng dưới là toàn cảnh,
kèm mức độ chặn được:

| Cửa | Chặn được? |
| --- | --- |
| Chuột phải → "Dịch mục đã chọn" / "Tìm trên Google" (máy tính) | Được — chặn sự kiện `contextmenu` |
| Chrome dịch cả trang, tiện ích Google Dịch / Immersive Translate | Được — `translate="no"` + `class="notranslate"` |
| Bôi đen → copy → dán sang tab Google Dịch | Không chặn (xem *Quyết định* mục 3); nhưng rời tab thì cờ ⚠️ sẵn có đã đếm |
| Nhấn giữ trên **điện thoại** → thanh công cụ có nút "Dịch" | **Không** — xem *Giới hạn đã biết* |
| Chụp màn hình, Google Lens, dùng điện thoại thứ hai | Không bao giờ chặn được |

**Nút thắt:** tính năng **tô màu (highlight)** đang dựa vào đúng cơ chế bôi đen gốc của trình
duyệt (`window.getSelection`) — mà đó cũng chính là thứ làm hiện thanh "Dịch" trên điện
thoại. Muốn diệt hẳn thanh đó thì phải bỏ bôi đen gốc và tự viết cơ chế chọn theo từng từ,
tức là viết lại khoảng 860 dòng của
[`highlight-layer.tsx`](../../../components/highlight-layer.tsx) và
[`highlight-region.tsx`](../../../components/highlight-region.tsx). Giáo viên đã cân nhắc và
**không chọn hướng đó**.

## Quyết định (đã hỏi giáo viên)

1. **Mức chặn: vừa phải, giữ nguyên tô màu.** Không đụng vào cơ chế bôi đen đang chạy ổn
   định. Chấp nhận là chỉ chặn được trên máy tính.
2. **Không xoá vùng chọn** sau khi popup chọn màu hiện ra. (Đây là cách duy nhất làm thanh
   "Dịch" trên điện thoại biến mất, nhưng giáo viên đã loại bỏ.)
3. **Không chặn copy.** Học sinh vẫn copy được như hiện nay.
4. **Phạm vi: chỉ khu vực làm bài Listening và Reading** — đoạn văn (bài đọc) và khối câu
   hỏi. **Không** áp cho ô soạn bài Writing, **không** áp cho trang xem lại kết quả, **không**
   áp cho trình phát audio.
5. **Có nhắc nhở.** Bấm chuột phải thì hiện một dòng toast nhẹ, tự tắt — để học sinh hiểu là
   hệ thống cố ý chặn chứ không phải máy lỗi.
6. **Ô điền đáp án: chặn chuột phải và tắt luôn soát chính tả.** Chuột phải trong ô đáp án
   cho ra gợi ý sửa chính tả của trình duyệt, mà IELTS thì sai chính tả là mất điểm. Gạch
   chân đỏ báo từ sai cũng là gợi ý — thi thật không có thứ đó.
7. **Không thêm bảng, không thêm server action, không đụng schema.** Đây là thay đổi thuần
   phía client.
8. **Không ghi nhận vào hệ thống cờ ⚠️** (YAGNI). Nếu sau này thấy cần đếm số lần học sinh
   thử bấm chuột phải thì thêm sau, gửi ké heartbeat như
   [`proctor-signals`](2026-07-17-proctor-signals-design.md) đang làm.

## Nguyên tắc kiến trúc

### Gắn khiên vào thẻ bọc sẵn có, không thêm `div`

`HighlightLayer` và `HighlightRegion` **chỉ được dùng đúng một chỗ** trong toàn bộ mã nguồn:
nhánh không-phải-Writing của [`attempt-workspace.tsx`](../../../components/attempt-workspace.tsx)
(khoảng dòng 3268 và 3313). Nghĩa là gắn khiên vào bên trong hai thành phần đó thì trúng
chính xác phạm vi ở mục 4 — không cần thẻ bọc mới, không cần cờ điều kiện theo kỹ năng.

Đây cũng là cách tránh bẫy đã ghi trong chú thích của
[`highlight-region.tsx`](../../../components/highlight-region.tsx): bọc thêm một tầng `div`
sẽ làm mất selector `> *`, hỏng khoảng cách `space-y-*` mà khối câu hỏi nhận từ thẻ cha.

### Ba lớp khiên, đặt một lần trên thẻ bọc

| Lớp | Thuộc tính | Chặn được gì |
| --- | --- | --- |
| Dịch trang | `translate="no"` + `className="notranslate"` | Chrome dịch cả trang, tiện ích Google Dịch, Immersive Translate |
| Menu chuột phải | `onContextMenu` → `preventDefault()` + toast | "Dịch mục đã chọn", "Tìm trên Google", "Tra cứu" |
| Soát chính tả | `spellCheck={false}` | Gạch chân đỏ báo sai chính tả trong mọi ô đáp án bên trong |

Cả `translate` lẫn `spellcheck` đều **di truyền xuống con cháu** theo chuẩn HTML: đặt một lần
ở thẻ bọc là phủ hết đoạn văn, câu hỏi và cả 6 chỗ `<input>` rải rác trong khối câu hỏi —
không phải sửa từng chỗ, và không sót khi sau này thêm dạng câu hỏi mới.

### Chỉ chặn chuột, không chặn ngón tay

Đây là chi tiết dễ hỏng nhất. Android Chrome **cũng bắn `contextmenu` khi nhấn giữ**. Chặn
bừa là giết luôn thao tác bôi đen tô màu trên điện thoại — đúng tính năng học sinh đang dùng
tốt, theo ghi nhận "học sinh làm bài trên điện thoại".

Cách xử lý: nhớ loại con trỏ (`pointerType`) của cú `pointerdown` gần nhất trên thẻ bọc, rồi:

- `"mouse"` → chặn.
- `"touch"` / `"pen"` → **thả qua**, giữ nguyên hành vi hiện nay.
- Không có `pointerdown` nào trước đó (phím Menu trên bàn phím, `Shift+F10`) → chặn, vì đó
  chắc chắn là máy tính.

## Các tệp đụng tới

### Mới: `lib/no-translate.ts`

Logic thuần, không phụ thuộc React/DOM — cùng lối với
[`lib/proctor-signals.ts`](../../../lib/proctor-signals.ts) để test thẳng bằng vitest (dự án
không cài jsdom).

- `shouldBlockContextMenu(pointerType: string | null): boolean` — trả `true` khi
  `pointerType` là `"mouse"` hoặc `null`; trả `false` với `"touch"` và `"pen"`.
- `NO_TRANSLATE_NOTICE` — câu nhắc: *"Không dùng từ điển hay công cụ dịch khi đang làm bài
  nhé."*
- `NO_TRANSLATE_NOTICE_MS` — thời gian toast tự tắt (3000 ms).

### Mới: `components/no-translate-guard.tsx`

Hook `useNoTranslateGuard()` trả về:

- Bộ props để rải lên thẻ bọc: `translate`, `className` (ghép thêm `notranslate`),
  `spellCheck`, `onPointerDown`, `onContextMenu`.
- Node toast để thành phần gọi render ra.

Toast render bằng `createPortal` thẳng vào `<body>`. Lý do đã ghi trong
[`notice-toast.tsx`](../../../components/notice-toast.tsx): `AppShell` bọc nội dung trong một
`div` có `animate-fade-in` (dùng `transform`), mà `transform` khác `none` biến `div` đó thành
containing block cho `position: fixed` — để toast bên trong thì nó bám cột nội dung chứ không
bám màn hình.

Chống spam: bấm chuột phải liên tục chỉ hiện **một** toast; mỗi lần bấm lại thì đặt lại đồng
hồ 3 giây chứ không xếp chồng thêm toast mới.

### Sửa: `components/highlight-layer.tsx`

Gọi hook, rải props lên thẻ bọc đoạn văn (thẻ mang `containerRef`), render toast. Không đổi
logic bôi đen, không đổi cách cắt chuỗi thành `<mark>`.

### Sửa: `components/highlight-region.tsx`

Tương tự, rải props lên thẻ bọc khối câu hỏi. Lưu ý `className` của thành phần này do thẻ cha
truyền vào (`"space-y-4"`) — phải **ghép thêm** `notranslate` chứ không được ghi đè.

Thành phần này đã có sẵn `onClick` để mở popup sửa màu; `onContextMenu` là sự kiện khác nên
không xung đột.

### Mới: `tests/no-translate.test.ts`

Theo đúng lối test sẵn có của dự án — vừa test logic thuần, vừa test cấu trúc bằng cách đọc
mã nguồn:

- `shouldBlockContextMenu` đúng với `"mouse"`, `"touch"`, `"pen"`, `null`.
- `highlight-layer.tsx` và `highlight-region.tsx` đều gọi `useNoTranslateGuard`.
- `attempt-workspace.tsx` **không** chứa `useNoTranslateGuard` — canh cho tương lai: khiên
  chỉ được sống trong hai thẻ bọc kia, ai đó rải thẳng lên màn làm bài (kéo theo cả ô soạn
  bài Writing) thì test đỏ.

## Luồng chạy

```
Học sinh bấm chuột phải lên đoạn văn Reading
  → pointerdown ghi lại pointerType = "mouse"
  → contextmenu bắn ra
  → shouldBlockContextMenu("mouse") === true
  → preventDefault()  (menu không hiện, mất luôn "Dịch mục đã chọn")
  → toast "Không dùng từ điển hay công cụ dịch khi đang làm bài nhé." (3 giây)

Học sinh nhấn giữ trên điện thoại
  → pointerdown ghi lại pointerType = "touch"
  → contextmenu (nếu có) bắn ra
  → shouldBlockContextMenu("touch") === false
  → không làm gì, bôi đen + popup tô màu chạy y như cũ
```

## Xử lý lỗi

Không có đường mạng, không có server action, nên không có lỗi cần xử lý. Trường hợp xấu nhất
là trình duyệt cũ không hỗ trợ `PointerEvent`: khi đó `pointerdown` không bắn, `pointerType`
giữ nguyên `null`, và theo quy tắc ở trên thì mặc định **chặn** — an toàn về phía chặn, và
trình duyệt cũ đó gần như chắc chắn là máy tính.

## Giới hạn đã biết

- **Điện thoại: không chặn được gì.** Nhấn giữ vẫn ra thanh công cụ có nút "Dịch". Đây là hệ
  quả trực tiếp của quyết định 1 và 2, giáo viên đã biết và chấp nhận.
- **Copy rồi dán sang tab khác vẫn được** (quyết định 3). Bù lại, rời tab quá 2 giây thì
  [`proctor-signals`](2026-07-17-proctor-signals-design.md) đã đếm và bật cờ ⚠️.
- **Chụp màn hình, Google Lens, điện thoại thứ hai:** không có cách nào chặn.
- **Tắt JavaScript** thì mất khiên chuột phải — nhưng cũng mất luôn cả bài thi (toàn bộ màn
  làm bài là client component).
- **Tiện ích dịch có phím tắt riêng** có thể bỏ qua cả `translate="no"` nếu người viết tiện
  ích cố tình. Không xử lý.

Tóm lại: đây là **rào cản để nhắc học sinh giữ luật**, không phải khoá chống gian lận. Cùng
tinh thần với `proctor-signals` — dấu hiệu để hỏi lại, không phải bằng chứng.
