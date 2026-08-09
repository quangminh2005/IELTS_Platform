# Nền động shader cho trang đăng nhập

Ngày: 2026-08-09

## Mục tiêu

Trang đăng nhập hiện tại có nền phẳng, phần lớn diện tích màn hình bỏ trống (rõ nhất ở
theme tối). Thêm một lớp nền động phía sau bố cục sẵn có để màn hình đầu tiên của
nền tảng trông hoàn thiện hơn.

Nguồn: component `hero-geometric` của componentry.dev
(`https://componentry.dev/r/hero-geometric.json`) — nền WebGL vẽ bằng shader,
dùng nhiễu Simplex cộng tán điểm Bayer 4×4.

## Phạm vi

Làm:

- Lấy **riêng lớp nền shader** của component gốc, đặt sau bố cục đăng nhập hiện có.
- Cho màu nền ăn theo cả theme sáng lẫn theme tối.
- Dự phòng đầy đủ khi máy yếu / không hỗ trợ WebGL / người dùng tắt hiệu ứng chuyển động.

Không làm:

- Không đụng tới nội dung cột trái (huy hiệu, tiêu đề, 3 thẻ 01–03) hay thẻ chọn vai trò.
- Không lấy phần tiêu đề `title1` / `title2` / `description` của component gốc.
- Không sửa `app/student/*`, `app/teacher/*`, `app/layout.tsx`.

## Phát hiện khi đọc mã nguồn gốc

Bốn điểm dưới đây quyết định phần lớn khối lượng công việc.

### 1. Registry khai dư thư viện

Registry ghi `three`, `@react-three/fiber`, `@react-three/drei`, `lucide-react`,
`framer-motion`. Mã nguồn thực tế chỉ import `three`, `@react-three/fiber`,
`framer-motion` và `cn`. `@react-three/drei` và `lucide-react` hoàn toàn không dùng.

→ Chỉ cài `three` và `@react-three/fiber` (kèm `@types/three` ở `devDependencies` vì dự án
bật TypeScript `strict`). `framer-motion` đã có sẵn trong dự án.

### 2. Phải ghim `@react-three/fiber` bản 8

`@react-three/fiber` bản 9 yêu cầu React 19; dự án đang React 18.3.1.

→ Cài `@react-three/fiber@^8`. Đồng thời bỏ khối `declare module "react" { namespace JSX ... }`
trong mã gốc — đó là cách khai báo cho React 19, với bản 8 thì thừa và gây lỗi TypeScript
khi bật `strict`.

### 3. Shader gốc được viết cho nền sáng

Trong fragment shader có dòng:

```glsl
color = mix(vec3(1.0), color, fadeMask);
```

Màu trắng này viết cứng, tạo vệt loang trắng ở góc dưới trái. Khung ngoài của component
cũng là `bg-white text-black`, màu mặc định là `#3B82F6` → `#F0F9FF`. Gắn nguyên xi vào
theme tối sẽ ra mảng sáng chói sau chữ.

→ Đổi `vec3(1.0)` thành uniform `uFadeColor`, truyền từ React theo theme đang bật.

### 4. Mật độ điểm ảnh bị khoá ở 1×

Mã gốc đặt `dpr={[1, 1]}`. Phủ toàn màn hình trên laptop 2K sẽ thấy bệt.

→ Nâng lên `dpr={[1, 1.5]}`. Giữ trần 1.5 thay vì 2 để không tăng gấp đôi khối lượng
vẽ trên màn hình Retina.

## Kiến trúc

### Tệp mới: `components/ui/login-shader-background.tsx`

Client component, không nhận prop nào ngoài `className`.

- Khung ngoài `absolute inset-0 -z-10 overflow-hidden pointer-events-none`.
- Bên trong là `<Canvas>` của `@react-three/fiber` chứa đúng một mặt phẳng
  `planeGeometry` phủ khung nhìn, gắn `shaderMaterial`.
- Vertex shader và fragment shader bê nguyên từ mã gốc, sửa duy nhất phần màu loang
  (mục 3 ở trên) — giữ nguyên hàm `snoise`, `bayerDither4x4` và các bậc chuyển màu,
  vì đó chính là thứ tạo ra vẻ ngoài đặc trưng.
- Uniform: `uTime`, `uResolution`, `uColor1`, `uColor2`, `uFadeColor`.

### Đọc theme

Dự án không có context theme. Nút chuyển sáng/tối ghi thẳng vào thuộc tính
`data-theme` trên thẻ `html` (xem `components/ui/animated-theme-toggle.tsx`).

→ Component đọc `document.documentElement.dataset.theme`, và đăng ký `MutationObserver`
theo dõi thuộc tính `data-theme` để đổi màu ngay khi người dùng bấm nút, không cần tải lại trang.

### Bảng màu

Giá trị khởi điểm, bám theo biến CSS trong `app/globals.css`, sẽ tinh chỉnh bằng mắt sau khi dựng:

| Theme | `uColor1` (đậm) | `uColor2` (nhạt) | `uFadeColor` |
|---|---|---|---|
| Sáng | `#2563EB` (`--primary`) | `#EFF6FF` | `#F2F6FA` (`--background`) |
| Tối | `#0C1220` (`--background`) | `#2E62C4` | `#0C1220` |

Ở theme sáng, nền chuyển từ xanh đậm sang xanh rất nhạt — giữ tinh thần bảng màu sáng
sạch hiện có. Ở theme tối, phần lớn diện tích là navy gần trùng nền, chỉ hửng xanh ở
góc trên phải, để chữ và thẻ vẫn nổi.

### Ba lớp dự phòng

1. **Nạp trễ** — import bằng `dynamic(..., { ssr: false })`. `three` không lọt vào
   bundle máy chủ; trang đăng nhập hiện tức thì, nền mờ dần vào sau.
2. **Giảm chuyển động** — nếu `prefers-reduced-motion: reduce`, không dựng `<Canvas>`,
   thay bằng nền tĩnh CSS (`radial-gradient`, tái dùng biến `--body-radial` sẵn có).
3. **Không có WebGL** — bắt lỗi khi khởi tạo canvas, rơi về đúng nền tĩnh ở mục 2.

Cả ba nhánh cùng chia sẻ một component nền tĩnh, để giao diện không lệch nhau.

## Tệp thay đổi

| Tệp | Việc |
|---|---|
| `components/ui/login-shader-background.tsx` | Tạo mới — canvas shader + đọc theme + dự phòng |
| `app/(auth)/login/layout.tsx` | Thêm component nền làm phần tử đầu trong `<main>` |
| `package.json` | Thêm `three`, `@types/three`, `@react-three/fiber@^8` |

Bố cục hiện có trong `layout.tsx` giữ nguyên. Ba thẻ tính năng vốn đã có
`bg-card/90 backdrop-blur` nên hợp với nền động; thẻ chọn vai trò để `bg-card` đục
như hiện tại để chữ dễ đọc.

## Kiểm chứng

- `pnpm lint` và `pnpm build` phải sạch (chú ý lỗi TypeScript từ kiểu của `three`).
- Mở bản deploy thật, soi lần lượt theme sáng và theme tối, bấm nút chuyển qua lại
  để chắc nền đổi màu theo.
- Kiểm cả ba nhánh dự phòng: bật "giảm chuyển động" trong hệ điều hành, và giả lập
  trường hợp không có WebGL.
- Xác nhận `three` không xuất hiện trong gói tải của `/student/*`.

## Rủi ro đã biết

- **Nặng thêm ở trang đăng nhập.** `three` thêm khoảng 150 KB (đã nén) vào riêng chunk
  của route đăng nhập. Đã cân nhắc và chấp nhận: chi phí chỉ phát sinh ở màn hình đăng
  nhập, không theo học viên vào trong ứng dụng, và phiên đăng nhập được giữ nên phần lớn
  lần vào sau học viên không thấy trang này.
- **Bản quyền.** Trang tài liệu của componentry ghi rõ component lấy cảm hứng từ nhiều
  dự án mã nguồn mở khác và khuyến cáo tự kiểm tra giấy phép trước khi dùng cho sản phẩm thật.
