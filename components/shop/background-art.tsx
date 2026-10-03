import type { CSSProperties, ReactNode } from "react";

// Hình nền bìa hồ sơ của Cửa hàng (lib/shop-catalog.ts). Màu chuyển của bầu trời
// là CSS gradient trên thẻ bọc; cảnh vật là SVG viewBox 800×140 phủ kín (slice).
// Cùng một cảnh phải đẹp ở hai khổ rất khác nhau:
//   - bìa hồ sơ máy tính ≈ 7,5:1 → thấy đủ bề ngang, bị xén trên/dưới còn y ≈ 16–124;
//   - thẻ Cửa hàng 5:2 và bìa hồ sơ điện thoại ≈ 2,7:1 → chỉ thấy khúc giữa x ≈ 225–575.
// Vì vậy: chi tiết chính (mặt trời, trăng, huy chương…) đặt ở GIỮA, trong y 20–120;
// cảnh nền (đồi, sóng, nhà…) trải kín 0–800.
//
// LUẬT: không dùng thẻ defs, không id, không gradient SVG (xem components/shop/frame-art.tsx).
// Toạ độ "ngẫu nhiên" sinh bằng bộ số giả ngẫu nhiên có hạt giống cố định → server
// và trình duyệt vẽ y hệt nhau, không lệch hydration.

const W = 800;
const H = 140;

type Point = { x: number; y: number; r: number; o: number };

function seededPoints(
  seed: number,
  count: number,
  area: { x0: number; x1: number; y0: number; y1: number },
  radius: [number, number]
): Point[] {
  let state = seed;
  const next = () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
  return Array.from({ length: count }, () => ({
    x: area.x0 + next() * (area.x1 - area.x0),
    y: area.y0 + next() * (area.y1 - area.y0),
    r: radius[0] + next() * (radius[1] - radius[0]),
    o: 0.45 + next() * 0.55
  }));
}

function n(value: number): string {
  return value.toFixed(1);
}

// Sóng lặp đều quanh đường y, kín xuống đáy khung, trải hết bề ngang.
function wavePath(y: number, amplitude: number, length: number, phase = 0): string {
  let d = `M ${-length + phase} ${y}`;
  for (let x = -length + phase; x < W + length; x += length) {
    d += ` Q ${n(x + length / 4)} ${n(y - amplitude)} ${n(x + length / 2)} ${y} T ${n(x + length)} ${y}`;
  }
  return `${d} V ${H} H ${-length} Z`;
}

function Cloud({
  x,
  y,
  s = 1,
  fill = "#ffffff",
  opacity = 0.9
}: {
  x: number;
  y: number;
  s?: number;
  fill?: string;
  opacity?: number;
}) {
  return (
    <g fill={fill} opacity={opacity}>
      <ellipse cx={x} cy={y} rx={22 * s} ry={9 * s} />
      <circle cx={x - 9 * s} cy={y - 5 * s} r={9 * s} />
      <circle cx={x + 6 * s} cy={y - 8 * s} r={11 * s} />
    </g>
  );
}

function Stars({ points, fill = "#ffffff" }: { points: Point[]; fill?: string }) {
  return (
    <g fill={fill}>
      {points.map((point, index) => (
        <circle key={index} cx={n(point.x)} cy={n(point.y)} r={n(point.r)} opacity={n(point.o)} />
      ))}
    </g>
  );
}

function sparklePath(cx: number, cy: number, size: number): string {
  const k = size * 0.22;
  return `M ${n(cx)} ${n(cy - size)} Q ${n(cx + k)} ${n(cy - k)} ${n(cx + size)} ${n(cy)} Q ${n(cx + k)} ${n(cy + k)} ${n(cx)} ${n(cy + size)} Q ${n(cx - k)} ${n(cy + k)} ${n(cx - size)} ${n(cy)} Q ${n(cx - k)} ${n(cy - k)} ${n(cx)} ${n(cy - size)} Z`;
}

function heartPath(cx: number, cy: number, s: number): string {
  return `M ${n(cx)} ${n(cy + s)} C ${n(cx - 2 * s)} ${n(cy - 0.2 * s)} ${n(cx - s)} ${n(cy - 1.6 * s)} ${n(cx)} ${n(cy - 0.6 * s)} C ${n(cx + s)} ${n(cy - 1.6 * s)} ${n(cx + 2 * s)} ${n(cy - 0.2 * s)} ${n(cx)} ${n(cy + s)} Z`;
}

// Cây dừa bóng đen: gốc tại (x, bottom), ngọn nghiêng theo lean (âm = sang trái).
function Palm({ x, bottom, height, lean }: { x: number; bottom: number; height: number; lean: number }) {
  const topX = x + lean;
  const topY = bottom - height;
  return (
    <>
      <path d={`M ${x - 3} ${bottom} Q ${x + lean * 0.2} ${bottom - height * 0.5} ${topX} ${topY} L ${topX + 3} ${topY + 1} Q ${x + lean * 0.2 + 3} ${bottom - height * 0.5} ${x + 3} ${bottom} Z`} />
      <path
        d={`M ${topX} ${topY} Q ${topX - 18} ${topY - 10} ${topX - 34} ${topY} Q ${topX - 16} ${topY - 5} ${topX} ${topY + 2} Z M ${topX} ${topY} Q ${topX + 18} ${topY - 14} ${topX + 36} ${topY - 6} Q ${topX + 18} ${topY - 6} ${topX} ${topY + 3} Z M ${topX} ${topY} Q ${topX - 8} ${topY - 18} ${topX - 22} ${topY - 20} Q ${topX - 6} ${topY - 12} ${topX + 1} ${topY + 1} Z M ${topX} ${topY} Q ${topX + 10} ${topY - 20} ${topX + 24} ${topY - 22} Q ${topX + 8} ${topY - 12} ${topX + 2} ${topY + 2} Z`}
      />
    </>
  );
}

const NIGHT_STARS = seededPoints(11, 90, { x0: 0, x1: W, y0: 8, y1: 100 }, [0.5, 1.6]);
const MEADOW_FLOWERS = seededPoints(23, 50, { x0: 0, x1: W, y0: 112, y1: 132 }, [1, 1.8]);
const HEARTS = seededPoints(37, 16, { x0: 10, x1: W - 10, y0: 22, y1: 118 }, [2.5, 4.5]);
const CITY_STARS = seededPoints(41, 40, { x0: 0, x1: W, y0: 10, y1: 60 }, [0.4, 1.1]);
const AURORA_STARS = seededPoints(53, 64, { x0: 0, x1: W, y0: 10, y1: 90 }, [0.4, 1.2]);
const SNOWFLAKES = seededPoints(67, 60, { x0: 0, x1: W, y0: 10, y1: 130 }, [0.8, 1.8]);
const GALAXY_STARS = seededPoints(79, 130, { x0: 0, x1: W, y0: 6, y1: 134 }, [0.4, 1.5]);
const GALAXY_TWINKLE = seededPoints(83, 24, { x0: 0, x1: W, y0: 20, y1: 120 }, [1.2, 2]);

// Toà nhà [x, rộng, cao] trải kín 0–800, toà cao nhất gần giữa.
const BUILDINGS: [number, number, number][] = [
  [0, 34, 58], [36, 26, 82], [64, 40, 50], [106, 22, 96], [130, 44, 70], [176, 30, 104],
  [208, 38, 62], [248, 26, 88], [276, 42, 56], [320, 24, 92], [346, 30, 66], [378, 28, 112],
  [408, 40, 74], [450, 26, 98], [478, 44, 60], [524, 30, 86], [556, 38, 52], [596, 24, 94],
  [622, 42, 68], [666, 30, 100], [698, 40, 58], [740, 26, 84], [768, 32, 64]
];

function cityWindows(): { x: number; y: number }[] {
  const windows: { x: number; y: number }[] = [];
  BUILDINGS.forEach(([x, width, height], building) => {
    for (let row = 0; row * 9 + 8 < height - 6; row += 1) {
      for (let col = 0; col * 7 + 6 < width - 4; col += 1) {
        // Bật/tắt đèn theo công thức cố định, không ngẫu nhiên lúc render.
        if ((building * 7 + row * 3 + col * 5) % 4 !== 0) {
          windows.push({ x: x + 4 + col * 7, y: H - height + 6 + row * 9 });
        }
      }
    }
  });
  return windows;
}

const CITY_WINDOWS = cityWindows();

const BAMBOO_STALKS = [18, 70, 118, 176, 226, 282, 334, 392, 446, 500, 556, 610, 664, 718, 772];
const BAMBOO_LEAVES: [number, number, number][] = [
  [40, 30, -25], [88, 70, 20], [146, 40, -15], [206, 86, 25], [262, 34, -20], [326, 76, 15],
  [380, 44, -30], [430, 96, 18], [470, 36, -22], [530, 80, 12], [584, 30, -18], [640, 72, 22],
  [690, 40, -26], [740, 90, 16], [110, 110, 10], [280, 116, -10], [560, 112, 8]
];

const BOOK_COLORS = ["#b91c1c", "#1d4ed8", "#15803d", "#a16207", "#7e22ce", "#0f766e", "#c2410c", "#334155"];

type Book = { x: number; y: number; w: number; h: number; color: string };

// Gáy sách đứng trên mặt giá ở toạ độ shelfY. gap = khoảng chừa trống (chỗ đặt nến).
function shelfBooks(shelfY: number, seed: number, gap?: [number, number]): Book[] {
  const books: Book[] = [];
  let x = 6;
  let state = seed;
  while (x < W - 10) {
    state = (state * 1103515245 + 12345) % 2147483648;
    // Bit thấp của bộ sinh này lặp chu kỳ rất ngắn → lấy bit cao.
    const bits = Math.floor(state / 65536);
    const w = 6 + (bits % 7);
    const h = 26 + (Math.floor(bits / 7) % 11);
    if (!gap || x + w < gap[0] || x > gap[1]) {
      books.push({ x, y: shelfY - h, w, h, color: BOOK_COLORS[Math.floor(bits / 77) % BOOK_COLORS.length] });
    }
    x += w + 1.5;
  }
  return books;
}

const CANDLE_GAP: [number, number] = [428, 470];
const SHELVES = [
  { y: 44, books: shelfBooks(44, 97) },
  { y: 88, books: shelfBooks(88, 128, CANDLE_GAP) },
  { y: 132, books: shelfBooks(132, 159) }
];

// Cảnh vẽ SVG (draw) hoặc ảnh tranh có sẵn (image, file tĩnh trong public/shop —
// phục vụ qua CDN của Vercel, KHÔNG qua Blob). sky là màu nền lúc ảnh chưa tải xong.
type Scene =
  | { sky: CSSProperties["backgroundImage"]; draw: () => ReactNode }
  | { sky: CSSProperties["backgroundImage"]; image: { src: string; position: string } };

const ART: Record<string, Scene> = {
  "bg:starry-night": {
    sky: "linear-gradient(180deg, #0f1d4a 0%, #2b3a7a 100%)",
    draw: () => (
      <>
        <Stars points={NIGHT_STARS} />
        <circle cx="470" cy="44" r="18" fill="#fef3c7" />
        <circle cx="479" cy="38" r="16" fill="#1b2a5c" />
        <path d={wavePath(116, 9, 140)} fill="#0b1436" opacity="0.85" />
      </>
    )
  },
  "bg:meadow": {
    sky: "linear-gradient(180deg, #bfe6ff 0%, #eaf8ff 100%)",
    draw: () => (
      <>
        <circle cx="320" cy="42" r="16" fill="#fff3b0" />
        <Cloud x={120} y={40} s={0.9} />
        <Cloud x={450} y={38} />
        <Cloud x={560} y={30} s={0.8} />
        <Cloud x={720} y={42} s={0.9} />
        <path d="M 0 96 Q 100 64 200 90 T 400 84 T 600 90 T 800 82 V 140 H 0 Z" fill="#8fd17e" />
        <path d="M 0 110 Q 120 84 240 106 T 480 100 T 720 106 T 960 100 V 140 H 0 Z" fill="#5fae55" />
        {MEADOW_FLOWERS.map((point, index) => (
          <circle
            key={index}
            cx={n(point.x)}
            cy={n(point.y)}
            r={n(point.r)}
            fill={index % 3 === 0 ? "#fde047" : "#ffffff"}
          />
        ))}
      </>
    )
  },
  "bg:ocean": {
    sky: "linear-gradient(180deg, #7dd3fc 0%, #e0f2fe 100%)",
    draw: () => (
      <>
        <circle cx="480" cy="46" r="20" fill="#fde68a" />
        <Cloud x={160} y={36} s={0.9} />
        <Cloud x={640} y={32} s={0.8} />
        <path
          d="M 340 44 q 4 -4 8 0 q 4 -4 8 0 M 372 34 q 3 -3 6 0 q 3 -3 6 0 M 700 50 q 4 -4 8 0 q 4 -4 8 0"
          fill="none"
          stroke="#334155"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
        <path d={wavePath(84, 6, 60)} fill="#38bdf8" opacity="0.8" />
        <path d={wavePath(98, 7, 70, 20)} fill="#0ea5e9" />
        <path d={wavePath(114, 6, 80, 10)} fill="#0369a1" />
      </>
    )
  },
  "bg:pink-clouds": {
    sky: "linear-gradient(180deg, #fbcfe8 0%, #fdf2f8 100%)",
    draw: () => (
      <>
        <Cloud x={70} y={46} s={1.1} />
        <Cloud x={200} y={34} s={0.8} fill="#fce7f3" opacity={1} />
        <Cloud x={330} y={56} s={1.2} />
        <Cloud x={460} y={36} s={0.9} fill="#fce7f3" opacity={1} />
        <Cloud x={590} y={58} s={1.1} />
        <Cloud x={730} y={40} s={0.9} fill="#fce7f3" opacity={1} />
        <Cloud x={140} y={112} s={1.3} fill="#fce7f3" opacity={1} />
        <Cloud x={400} y={116} s={1.1} />
        <Cloud x={660} y={112} s={1.3} fill="#fce7f3" opacity={1} />
        {HEARTS.map((point, index) => (
          <path key={index} d={heartPath(point.x, point.y, point.r)} fill="#f472b6" opacity={n(0.5 + point.o * 0.4)} />
        ))}
      </>
    )
  },
  "bg:sunset": {
    sky: "linear-gradient(180deg, #7c3aed 0%, #f97316 55%, #fde68a 100%)",
    draw: () => (
      <>
        <circle cx="400" cy="98" r="42" fill="#fff7ad" />
        <path
          d="M 0 98 L 60 72 L 120 94 L 190 66 L 260 96 L 330 74 L 400 96 L 470 70 L 540 94 L 610 68 L 680 96 L 750 74 L 800 92 V 140 H 0 Z"
          fill="#7c2d12"
          opacity="0.45"
        />
        <rect x="0" y="100" width={W} height="40" fill="#9a3412" opacity="0.6" />
        {[106, 113, 120].map((y, index) => (
          <rect key={y} x={376 + index * 4} y={y} width={48 - index * 8} height="2" rx="1" fill="#fff7ad" opacity="0.6" />
        ))}
        <g fill="#3b0a1a" opacity="0.82">
          {/* Hai cây sát mặt trời để thẻ Cửa hàng 16:10 (chỉ thấy x ≈ 290–510) vẫn có. */}
          <Palm x={318} bottom={124} height={56} lean={-6} />
          <Palm x={490} bottom={124} height={62} lean={7} />
          <Palm x={140} bottom={124} height={50} lean={5} />
          <Palm x={680} bottom={124} height={52} lean={-5} />
        </g>
      </>
    )
  },
  "bg:bamboo": {
    sky: "linear-gradient(180deg, #d9f99d 0%, #f7fee7 100%)",
    draw: () => (
      <>
        {BAMBOO_STALKS.map((x, index) => (
          <g key={x} opacity={index % 2 === 0 ? 1 : 0.7}>
            <rect x={x} y="0" width="11" height={H} rx="4" fill={index % 2 === 0 ? "#4d7c0f" : "#65a30d"} />
            {[24, 58, 92, 126].map((y) => (
              <rect key={y} x={x - 1} y={y + (index % 3) * 6} width="13" height="2.5" rx="1" fill="#365314" />
            ))}
          </g>
        ))}
        {BAMBOO_LEAVES.map(([x, y, angle]) => (
          <path
            key={`${x}-${y}`}
            d={`M ${x} ${y} Q ${x + 14} ${y - 6} ${x + 30} ${y} Q ${x + 14} ${y + 6} ${x} ${y} Z`}
            fill="#65a30d"
            transform={`rotate(${angle} ${x} ${y})`}
          />
        ))}
      </>
    )
  },
  "bg:city-night": {
    sky: "linear-gradient(180deg, #1e1b4b 0%, #4338ca 100%)",
    draw: () => (
      <>
        <Stars points={CITY_STARS} />
        <circle cx="470" cy="34" r="13" fill="#fef9c3" />
        {BUILDINGS.map(([x, width, height]) => (
          <rect key={x} x={x} y={H - height} width={width} height={height} fill="#111827" />
        ))}
        <g fill="#fde047" opacity="0.9">
          {CITY_WINDOWS.map((window, index) => (
            <rect key={index} x={window.x} y={window.y} width="3.5" height="4.5" />
          ))}
        </g>
      </>
    )
  },
  "bg:aurora": {
    sky: "linear-gradient(180deg, #0b1530 0%, #1b2b55 100%)",
    draw: () => (
      <>
        <Stars points={AURORA_STARS} />
        <path
          d="M 0 58 C 80 18, 160 88, 240 38 S 380 28, 460 52 S 640 20, 800 48 L 800 72 C 700 58, 600 104, 480 72 S 300 60, 180 70 S 60 60, 0 84 Z"
          fill="#34d399"
          opacity="0.45"
        />
        <path
          d="M 0 40 C 90 14, 150 60, 240 26 S 400 16, 480 36 S 660 8, 800 30 L 800 46 C 700 38, 620 70, 520 52 S 340 34, 240 50 S 80 34, 0 58 Z"
          fill="#22d3ee"
          opacity="0.32"
        />
        <path
          d="M 0 74 C 100 52, 180 96, 280 62 S 460 58, 560 78 S 720 56, 800 70 L 800 86 C 700 80, 620 108, 520 92 S 340 80, 240 92 S 80 84, 0 96 Z"
          fill="#a78bfa"
          opacity="0.35"
        />
        <polygon points="-20,140 80,98 180,140" fill="#0f172a" />
        <polygon points="120,140 240,92 360,140" fill="#111c36" />
        <polygon points="280,140 400,84 520,140" fill="#0f172a" />
        <polygon points="440,140 560,94 680,140" fill="#111c36" />
        <polygon points="600,140 720,90 840,140" fill="#0f172a" />
        <polygon points="390,92 400,84 410,92 404,90 398,94" fill="#e2e8f0" />
        <polygon points="710,96 720,90 730,96 725,95 718,98" fill="#e2e8f0" />
        <polygon points="230,98 240,92 250,98 245,97 238,100" fill="#e2e8f0" />
      </>
    )
  },
  "bg:snow-peaks": {
    sky: "linear-gradient(180deg, #bae6fd 0%, #f0f9ff 100%)",
    draw: () => (
      <>
        <polygon points="-40,140 100,58 240,140" fill="#94a3b8" />
        <polygon points="160,140 280,52 400,140" fill="#94a3b8" />
        <polygon points="420,140 540,50 660,140" fill="#94a3b8" />
        <polygon points="580,140 700,60 840,140" fill="#94a3b8" />
        <polygon points="270,140 400,30 530,140" fill="#64748b" />
        <polygon points="100,58 84,72 94,70 102,76 110,69 116,72" fill="#ffffff" />
        <polygon points="280,52 262,68 274,65 282,72 290,64 298,68" fill="#ffffff" />
        <polygon points="540,50 522,66 534,63 542,70 550,62 558,66" fill="#ffffff" />
        <polygon points="700,60 684,74 694,72 702,78 710,71 716,74" fill="#ffffff" />
        <polygon points="400,30 378,52 392,48 400,56 410,47 422,52" fill="#ffffff" />
        <rect x="0" y="122" width={W} height="18" fill="#ffffff" opacity="0.85" />
        <Stars points={SNOWFLAKES} />
      </>
    )
  },
  "bg:old-library": {
    sky: "linear-gradient(180deg, #78350f 0%, #b45309 100%)",
    draw: () => (
      <>
        {SHELVES.map((shelf) => (
          <g key={shelf.y}>
            {shelf.books.map((book, index) => (
              <rect key={index} x={n(book.x)} y={n(book.y)} width={book.w} height={book.h} rx="1" fill={book.color} opacity="0.92" />
            ))}
            <rect x="0" y={shelf.y} width={W} height="5" fill="#451a03" />
          </g>
        ))}
        <circle cx="449" cy="62" r="30" fill="#fde68a" opacity="0.2" />
        <rect x="443" y="62" width="12" height="26" rx="2" fill="#fef3c7" />
        <ellipse cx="449" cy="54" rx="4" ry="8" fill="#fbbf24" />
        <ellipse cx="449" cy="56" rx="2" ry="4" fill="#fff7ad" />
      </>
    )
  },
  "bg:galaxy": {
    sky: "radial-gradient(ellipse at 50% 45%, #6d28d9 0%, #2e1065 45%, #0a0420 100%)",
    draw: () => (
      <>
        <ellipse cx="330" cy="62" rx="160" ry="34" fill="#a855f7" opacity="0.3" transform="rotate(-10 330 62)" />
        <ellipse cx="480" cy="84" rx="170" ry="28" fill="#ec4899" opacity="0.25" transform="rotate(8 480 84)" />
        <ellipse cx="520" cy="44" rx="90" ry="22" fill="#3b82f6" opacity="0.3" />
        <ellipse cx="120" cy="90" rx="110" ry="20" fill="#7c3aed" opacity="0.25" />
        <ellipse cx="700" cy="56" rx="100" ry="22" fill="#db2777" opacity="0.2" />
        <Stars points={GALAXY_STARS} />
        <g className="motion-safe:animate-pulse">
          {GALAXY_TWINKLE.map((point, index) => (
            <path key={index} d={sparklePath(point.x, point.y, point.r * 2.2)} fill="#ffffff" />
          ))}
        </g>
        <path d={sparklePath(470, 56, 9)} fill="#fef9c3" />
      </>
    )
  },
  // "Đêm đầy sao" (Van Gogh, 1889 — phạm vi công cộng). Bìa dài chỉ thấy một dải
  // ngang → neo ở 15% chiều cao để giữ trọn mặt trăng, xoáy mây và các vì sao.
  "bg:starry-van-gogh": {
    sky: "linear-gradient(180deg, #1e3a8a 0%, #1e40af 100%)",
    image: { src: "/shop/starry-night-van-gogh.webp", position: "50% 15%" }
  },
  "bg:diligent": {
    sky: "linear-gradient(180deg, #fde68a 0%, #f59e0b 100%)",
    draw: () => (
      <>
        <g fill="#ffffff" opacity="0.22">
          {Array.from({ length: 16 }, (_, index) => (
            <rect key={index} x="396" y="-330" width="8" height="400" transform={`rotate(${index * 22.5} 400 70)`} />
          ))}
        </g>
        <path d="M 384 92 L 376 126 L 390 119 L 398 130 L 400 96 Z" fill="#dc2626" />
        <path d="M 416 92 L 424 126 L 410 119 L 402 130 L 400 96 Z" fill="#b91c1c" />
        <circle cx="400" cy="68" r="30" fill="#fbbf24" stroke="#b45309" strokeWidth="4" />
        <path
          d="M 400 48 C 388 62, 386 76, 400 86 C 414 76, 412 62, 405 56 C 405 64, 402 68, 398 68 C 402 60, 402 54, 400 48 Z"
          fill="#ef4444"
        />
        <path d="M 400 66 C 394 72, 394 80, 400 84 C 406 80, 406 72, 400 66 Z" fill="#fde047" />
      </>
    )
  }
};

export function BackgroundArt({ artKey, className = "" }: { artKey: string; className?: string }) {
  const scene = ART[artKey];

  if (!scene) {
    return null;
  }

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ backgroundImage: scene.sky }}
      aria-hidden="true"
    >
      {"image" in scene ? (
        // Ảnh tĩnh nhỏ (~260KB), không qua trình tối ưu ảnh của Next để khỏi tốn hạn mức.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={scene.image.src}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: scene.image.position }}
        />
      ) : (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid slice"
          focusable="false"
          className="absolute inset-0 h-full w-full"
        >
          {scene.draw()}
        </svg>
      )}
    </div>
  );
}
