import type { CSSProperties, ReactNode } from "react";

// Hình khung avatar của Cửa hàng (lib/shop-catalog.ts). SVG viewBox 0..100, tâm
// (50,50). Lớp bọc phủ -inset-[18%] quanh avatar → avatar chiếm vòng tròn bán kính
// ≈ 36,8; vòng khung nằm ngay bên ngoài (r 37–45). Trang trí (cánh, vương miện,
// lửa…) được tràn ra ngoài viewBox (overflow visible), giữ trong khoảng x −28..128
// để hàng danh sách không bị cánh đè lên chữ.
//
// Khung càng đắt càng cầu kỳ, kiểu chin.edu.vn: Thường = vòng + chi tiết nhỏ;
// Hiếm = thêm cánh kim loại, đá quý; Sử thi = cánh lông vũ lớn, vương miện, hào
// quang; Huyền thoại = cánh lửa, lửa bập bùng, tàn lửa bay.
//
// LUẬT: không dùng thẻ defs, không id, không gradient SVG — AppShell vẽ avatar hai lần
// (một bản display:none), tham chiếu theo id sẽ hỏng. Khối "bóng" làm bằng các lớp
// nét chồng nhau có độ trong. Hiệu ứng động chỉ trong motion-safe (tắt khi máy bật
// giảm chuyển động); keyframes frame-* ở tailwind.config.ts.
//
// `lite`: avatar nhỏ (sm/list ở bảng xếp hạng) — bỏ tia sao, tàn lửa và quầng
// sáng cho đỡ rối mắt và đỡ tốn máy khi cả danh sách cùng chạy hiệu ứng.

type Palette = { main: string; light: string; dark: string };

const CENTER = 50;

function polar(radius: number, degrees: number): [number, number] {
  const radians = (degrees * Math.PI) / 180;
  return [CENTER + radius * Math.cos(radians), CENTER + radius * Math.sin(radians)];
}

function fixed(value: number): string {
  return value.toFixed(2);
}

// Cung tròn quanh tâm, góc tính theo SVG (0° = bên phải, 90° = dưới).
function arcPath(radius: number, from: number, to: number): string {
  const [x1, y1] = polar(radius, from);
  const [x2, y2] = polar(radius, to);
  const large = Math.abs(to - from) > 180 ? 1 : 0;
  return `M ${fixed(x1)} ${fixed(y1)} A ${radius} ${radius} 0 ${large} 1 ${fixed(x2)} ${fixed(y2)}`;
}

function starPath(cx: number, cy: number, outer: number, inner: number, points = 5): string {
  const parts: string[] = [];
  for (let index = 0; index < points * 2; index += 1) {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = (Math.PI / points) * index - Math.PI / 2;
    parts.push(`${fixed(cx + radius * Math.cos(angle))} ${fixed(cy + radius * Math.sin(angle))}`);
  }
  return `M ${parts.join(" L ")} Z`;
}

// Tia sáng 4 cánh lõm (kiểu lấp lánh).
function sparklePath(cx: number, cy: number, size: number): string {
  const s = size;
  return `M ${cx} ${cy - s} Q ${cx} ${cy} ${cx + s} ${cy} Q ${cx} ${cy} ${cx} ${cy + s} Q ${cx} ${cy} ${cx - s} ${cy} Q ${cx} ${cy} ${cx} ${cy - s} Z`;
}

// Một chiếc lông vũ từ gốc (rx, ry) chĩa theo góc `angle`, dài `length`, bầu rộng
// `width` (âm = lật bầu sang phía kia, dùng cho cánh phải).
function featherPath(rx: number, ry: number, angle: number, length: number, width: number): string {
  const radians = (angle * Math.PI) / 180;
  const dx = Math.cos(radians);
  const dy = Math.sin(radians);
  const px = -dy;
  const py = dx;
  const at = (along: number, side: number) =>
    `${fixed(rx + dx * length * along + px * width * side)} ${fixed(ry + dy * length * along + py * width * side)}`;
  return `M ${fixed(rx)} ${fixed(ry)} C ${at(0.3, 1)} ${at(0.85, 0.7)} ${at(1, 0)} C ${at(0.85, -0.35)} ${at(0.3, -0.55)} ${fixed(rx)} ${fixed(ry)} Z`;
}

// Bản lật gương qua trục dọc x = 50 của một góc.
function mirrorAngle(angle: number): number {
  return 180 - angle;
}

// Hoạt ảnh xoay/phóng quanh chính tâm hình (không phải tâm khung).
const SELF_CENTER: CSSProperties = {
  transformBox: "fill-box",
  transformOrigin: "center"
};
const SELF_BOTTOM: CSSProperties = {
  transformBox: "fill-box",
  transformOrigin: "50% 100%"
};

function delay(seconds: number, base: CSSProperties = {}): CSSProperties {
  return { ...base, animationDelay: `${seconds}s` };
}

// ---------------------------------------------------------------------------
// Khối dựng chung
// ---------------------------------------------------------------------------

function Ring({ main, light, dark }: Palette) {
  return (
    <>
      <circle cx={CENTER} cy={CENTER} r="41" fill="none" stroke={main} strokeWidth="8" />
      {/* Nửa dưới tối hơn, nửa trên sáng hơn → vòng có khối như kim loại đúc. */}
      <path d={arcPath(42, 15, 165)} fill="none" stroke={dark} strokeOpacity="0.45" strokeWidth="5" />
      <path d={arcPath(40, 195, 345)} fill="none" stroke={light} strokeOpacity="0.55" strokeWidth="3" />
      <circle cx={CENTER} cy={CENTER} r="37.2" fill="none" stroke={dark} strokeWidth="1.3" />
      <circle cx={CENTER} cy={CENTER} r="38.3" fill="none" stroke={light} strokeOpacity="0.6" strokeWidth="0.7" />
      <circle cx={CENTER} cy={CENTER} r="45.3" fill="none" stroke={dark} strokeWidth="1.3" />
      {/* Vệt bóng cố định góc trên-trái. */}
      <path
        d={arcPath(41, 205, 245)}
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.55"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </>
  );
}

// Viền kép: vòng mảnh màu `rim` ở mép trong/ngoài (vàng viền đá quý).
function Rim({ color }: { color: string }) {
  return (
    <>
      <circle cx={CENTER} cy={CENTER} r="37.4" fill="none" stroke={color} strokeWidth="1.6" />
      <circle cx={CENTER} cy={CENTER} r="44.8" fill="none" stroke={color} strokeWidth="1.8" />
    </>
  );
}

// Vệt sáng chạy quanh viền.
function Shine({ opacity = 0.85 }: { opacity?: number }) {
  return (
    <circle
      cx={CENTER}
      cy={CENTER}
      r="41"
      fill="none"
      stroke="#ffffff"
      strokeOpacity={opacity}
      strokeWidth="3.4"
      strokeLinecap="round"
      strokeDasharray="22 235.6"
      opacity="0"
      className="motion-safe:animate-frame-shine"
    />
  );
}

type SparkleSpec = [x: number, y: number, size: number, delaySeconds: number];

function Sparkles({ items, color = "#ffffff" }: { items: SparkleSpec[]; color?: string }) {
  return (
    <>
      {items.map(([x, y, size, wait]) => (
        <path
          key={`${x}-${y}`}
          d={sparklePath(x, y, size)}
          fill={color}
          className="motion-safe:animate-frame-twinkle"
          style={delay(wait, SELF_CENTER)}
        />
      ))}
    </>
  );
}

// Đá quý tròn có ổ gắn + chấm bóng.
function Gem({
  cx,
  cy,
  r,
  fill,
  dark,
  setting
}: {
  cx: number;
  cy: number;
  r: number;
  fill: string;
  dark: string;
  setting: string;
}) {
  return (
    <>
      <circle cx={cx} cy={cy} r={r + 1.1} fill={setting} stroke={dark} strokeWidth="0.4" />
      <circle cx={cx} cy={cy} r={r} fill={fill} stroke={dark} strokeWidth="0.6" />
      <circle cx={cx} cy={cy + r * 0.35} r={r * 0.55} fill={dark} fillOpacity="0.35" />
      <ellipse cx={cx - r * 0.35} cy={cy - r * 0.38} rx={r * 0.38} ry={r * 0.24} fill="#ffffff" fillOpacity="0.85" />
    </>
  );
}

// Đá quý cắt hình thoi (đính đỉnh khung).
function DiamondGem({
  cx,
  cy,
  w,
  h,
  fill,
  light,
  dark
}: {
  cx: number;
  cy: number;
  w: number;
  h: number;
  fill: string;
  light: string;
  dark: string;
}) {
  return (
    <>
      <polygon
        points={`${cx},${cy - h} ${cx + w},${cy} ${cx},${cy + h} ${cx - w},${cy}`}
        fill={fill}
        stroke={dark}
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
      <polygon points={`${cx},${cy - h} ${cx + w},${cy} ${cx},${cy}`} fill={light} fillOpacity="0.7" />
      <polygon points={`${cx},${cy + h} ${cx - w},${cy} ${cx},${cy}`} fill={dark} fillOpacity="0.4" />
    </>
  );
}

type FeatherSpec = [angle: number, length: number, width: number];
type WingLayer = {
  feathers: FeatherSpec[];
  fill: string;
  stroke: string;
  vein?: string;
};

// Đôi cánh đối xứng; gốc cánh trái tại (rootX, rootY), phải nằm GIỮA dải vòng
// khung (r ≈ 41) — gốc lấn vào trong r 37 thì chân lông vũ lòi lên mặt avatar.
// Mỗi bên là một nhóm riêng xoay quanh gốc của chính nó (không dùng transform lật
// ở nhóm cha, để transform-origin tính đúng).
function Wings({
  rootX,
  rootY,
  layers,
  flap,
  lite
}: {
  rootX: number;
  rootY: number;
  layers: WingLayer[];
  flap: boolean;
  lite: boolean;
}) {
  // Avatar nhỏ ở danh sách chỉ cách tên 12px — thu cánh còn một nửa (quanh gốc
  // cánh) để cánh không đè lên chữ.
  const scale = lite ? 0.5 : 1;
  return (
    <>
      {(["left", "right"] as const).map((side) => {
        const mirrored = side === "right";
        const x = mirrored ? 100 - rootX : rootX;
        return (
          <g key={side} transform={`translate(${x} ${rootY}) scale(${scale}) translate(${-x} ${-rootY})`}>
            <g
              className={
                flap ? (mirrored ? "motion-safe:animate-frame-flap-r" : "motion-safe:animate-frame-flap-l") : undefined
              }
              style={{ transformOrigin: `${x}px ${rootY}px` }}
            >
              {layers.map((layer, layerIndex) =>
                layer.feathers.map(([angle, length, width]) => {
                  const a = mirrored ? mirrorAngle(angle) : angle;
                  const w = mirrored ? -width : width;
                  const [tipX, tipY] = [
                    x + Math.cos((a * Math.PI) / 180) * length * 0.8,
                    rootY + Math.sin((a * Math.PI) / 180) * length * 0.8
                  ];
                  return (
                    <g key={`${layerIndex}-${angle}`}>
                      <path
                        d={featherPath(x, rootY, a, length, w)}
                        fill={layer.fill}
                        stroke={layer.stroke}
                        strokeWidth="0.6"
                        strokeLinejoin="round"
                      />
                      {layer.vein ? (
                        <path
                          d={`M ${fixed(x)} ${fixed(rootY)} L ${fixed(tipX)} ${fixed(tipY)}`}
                          stroke={layer.vein}
                          strokeOpacity="0.7"
                          strokeWidth="0.6"
                          strokeLinecap="round"
                        />
                      ) : null}
                    </g>
                  );
                })
              )}
            </g>
          </g>
        );
      })}
    </>
  );
}

// Vòng nguyệt quế hai bên, từ đáy vòng lên quá nửa.
function Laurel({ fill, stroke, from = 100, to = 165 }: { fill: string; stroke: string; from?: number; to?: number }) {
  const steps = Math.round((to - from) / 11) + 1;
  const angles = Array.from({ length: steps }, (_, index) => from + ((to - from) * index) / (steps - 1));
  return (
    <>
      {[false, true].map((mirrored) => (
        <g key={String(mirrored)}>
          <path
            d={arcPath(48.5, mirrored ? 180 - to : from, mirrored ? 180 - from : to)}
            fill="none"
            stroke={stroke}
            strokeWidth="0.9"
          />
          {angles.map((base, index) => {
            const angle = mirrored ? 180 - base : base;
            const radius = index % 2 === 0 ? 50.5 : 47.5;
            const [x, y] = polar(radius, angle);
            // Lá nhọn mọc dọc theo cành (tiếp tuyến), lá ngoài/lá trong chĩa lệch hai phía.
            const tilt = index % 2 === 0 ? -22 : 22;
            const direction = base + 90 + tilt;
            return (
              <path
                key={base}
                d={featherPath(x, y, mirrored ? mirrorAngle(direction) : direction, 10.5, mirrored ? -3.4 : 3.4)}
                fill={fill}
                stroke={stroke}
                strokeWidth="0.5"
                strokeLinejoin="round"
              />
            );
          })}
        </g>
      ))}
    </>
  );
}

// Hào quang toả nhịp phía sau khung.
function Halo({ color, lite }: { color: string; lite: boolean }) {
  if (lite) {
    return null;
  }
  return (
    <circle
      cx={CENTER}
      cy={CENTER}
      r="47.6"
      fill="none"
      stroke={color}
      strokeWidth="3"
      opacity="0.3"
      className="motion-safe:animate-frame-pulse"
    />
  );
}

// Ba ngôi sao vàng ở đáy (kiểu khung Cấp 3 của chin).
function BottomStars({ fill, stroke }: { fill: string; stroke: string }) {
  return (
    <>
      {[
        [38.5, 92.5, 4.6],
        [61.5, 92.5, 4.6],
        [50, 96, 6.4]
      ].map(([x, y, size]) => (
        <path
          key={`${x}`}
          d={starPath(x, y, size, size * 0.45)}
          fill={fill}
          stroke={stroke}
          strokeWidth="0.8"
          strokeLinejoin="round"
        />
      ))}
    </>
  );
}

// Vương miện 3 mũi đính đá ở đỉnh khung.
function Crown({ gold, goldDark, gem, gemDark }: { gold: string; goldDark: string; gem: string; gemDark: string }) {
  return (
    <>
      <path
        d="M 35 10.5 L 34 -1 L 42.5 4.5 L 50 -7 L 57.5 4.5 L 66 -1 L 65 10.5 Z"
        fill={gold}
        stroke={goldDark}
        strokeWidth="0.9"
        strokeLinejoin="round"
      />
      <path d="M 36 8.6 H 64" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="0.8" />
      <circle cx="34" cy="-1.4" r="1.6" fill={gold} stroke={goldDark} strokeWidth="0.6" />
      <circle cx="66" cy="-1.4" r="1.6" fill={gold} stroke={goldDark} strokeWidth="0.6" />
      <circle cx="50" cy="-7.6" r="1.9" fill={gold} stroke={goldDark} strokeWidth="0.6" />
      <Gem cx={42.5} cy={7} r={1.7} fill={gem} dark={gemDark} setting={gold} />
      <Gem cx={57.5} cy={7} r={1.7} fill={gem} dark={gemDark} setting={gold} />
      <DiamondGem cx={50} cy={4.5} w={3.4} h={4.4} fill={gem} light="#ffffff" dark={gemDark} />
    </>
  );
}

// Ngọn lửa (gốc tại x, y; cao h).
function flamePath(x: number, y: number, h: number, w: number): string {
  return `M ${x} ${y} C ${x - w} ${y - h * 0.2}, ${x - w * 0.55} ${y - h * 0.62}, ${x} ${y - h} C ${x + w * 0.2} ${y - h * 0.62}, ${x + w * 1.05} ${y - h * 0.38}, ${x} ${y} Z`;
}

// ---------------------------------------------------------------------------
// Bộ cánh
// ---------------------------------------------------------------------------

const BRONZE_WING: WingLayer[] = [
  {
    feathers: [
      [192, 19, 4.2],
      [210, 23, 4.8],
      [228, 22, 4.6],
      [246, 17, 4]
    ],
    fill: "#c98544",
    stroke: "#6e4220",
    vein: "#f3c08a"
  },
  {
    feathers: [
      [202, 13, 3.2],
      [222, 14, 3.2]
    ],
    fill: "#e8a96b",
    stroke: "#8a5428"
  }
];

const SILVER_WING: WingLayer[] = [
  {
    feathers: [
      [186, 25, 5],
      [203, 30, 5.6],
      [220, 31, 5.8],
      [237, 28, 5.4],
      [254, 21, 4.6]
    ],
    fill: "#c4ccd6",
    stroke: "#5f6874",
    vein: "#ffffff"
  },
  {
    feathers: [
      [196, 18, 4],
      [215, 21, 4.4],
      [235, 19, 4]
    ],
    fill: "#eef2f7",
    stroke: "#7a838f"
  }
];

// Cánh lông vũ lớn (đồ Sử thi): sải gần gấp rưỡi đường kính khung, như chin.
function featherWing(
  outer: string,
  outerStroke: string,
  inner: string,
  innerStroke: string,
  vein: string
): WingLayer[] {
  return [
    {
      feathers: [
        [170, 26, 5.2],
        [185, 34, 6],
        [200, 39, 6.6],
        [215, 40, 6.8],
        [230, 37, 6.4],
        [245, 30, 5.6],
        [259, 21, 4.6]
      ],
      fill: outer,
      stroke: outerStroke,
      vein
    },
    {
      feathers: [
        [180, 21, 4.4],
        [197, 27, 5],
        [214, 28, 5],
        [232, 24, 4.6],
        [249, 17, 3.8]
      ],
      fill: inner,
      stroke: innerStroke,
      vein
    }
  ];
}

const EMERALD_WING = featherWing("#0f9f75", "#064e3b", "#5eead4", "#0f766e", "#d1fae5");
const RUBY_WING = featherWing("#f43f5e", "#881337", "#fda4af", "#be123c", "#fff1f2");

const PHOENIX_WING: WingLayer[] = [
  {
    feathers: [
      [166, 28, 6],
      [183, 38, 7],
      [200, 44, 7.6],
      [217, 44, 7.4],
      [234, 38, 6.8],
      [251, 29, 5.8],
      [266, 19, 4.6]
    ],
    fill: "#ff5a0a",
    stroke: "#9a2a05"
  },
  {
    feathers: [
      [176, 28, 5.2],
      [194, 33, 5.8],
      [212, 34, 5.8],
      [230, 30, 5.2],
      [248, 21, 4.2]
    ],
    fill: "#ffa21f",
    stroke: "#c2410c"
  },
  {
    feathers: [
      [190, 19, 3.8],
      [210, 22, 4],
      [230, 18, 3.6]
    ],
    fill: "#ffe27a",
    stroke: "#f59e0b"
  }
];

// ---------------------------------------------------------------------------
// Hình từng khung
// ---------------------------------------------------------------------------

const WOOD_GRAIN = [10, 55, 100, 145, 190, 235, 280, 325];
const RIVETS = [45, 135, 225, 315];
const SILVER_STUDS = Array.from({ length: 16 }, (_, index) => index * 22.5 + 11.25);
const GOLD_GEMS = [30, 150];
const RING_GEMS = [45, 135, 225, 315];

type Draw = (lite: boolean) => ReactNode;

const ART: Record<string, Draw> = {
  "frame:wood": () => (
    <>
      {/* Chồi lá non mọc hai bên đáy. */}
      {[false, true].map((mirrored) => {
        const flip = (x: number) => (mirrored ? 100 - x : x);
        return (
          <g key={String(mirrored)}>
            <path
              d={featherPath(flip(16), 80, mirrored ? mirrorAngle(200) : 200, 13, mirrored ? -4 : 4)}
              fill="#6aa84f"
              stroke="#2f5f1f"
              strokeWidth="0.6"
            />
            <path
              d={featherPath(flip(20), 84, mirrored ? mirrorAngle(160) : 160, 11, mirrored ? 3.4 : -3.4)}
              fill="#8bc34a"
              stroke="#2f5f1f"
              strokeWidth="0.6"
            />
          </g>
        );
      })}
      <Ring main="#9a6b3f" light="#d7a978" dark="#5e3d20" />
      {WOOD_GRAIN.map((angle, index) => (
        <path
          key={angle}
          d={arcPath(index % 2 === 0 ? 39.6 : 42.4, angle, angle + 16)}
          fill="none"
          stroke="#6b4626"
          strokeWidth="1.1"
          strokeLinecap="round"
        />
      ))}
      <circle cx="50" cy="5" r="3" fill="#d4a24c" stroke="#5e3d20" strokeWidth="0.8" />
      <circle cx="49" cy="4" r="1" fill="#ffffff" fillOpacity="0.7" />
      <Shine opacity={0.6} />
    </>
  ),
  "frame:bronze": (lite) => (
    <>
      <Wings rootX={9} rootY={50} layers={BRONZE_WING} flap={false} lite={lite} />
      <Ring main="#b87333" light="#f0b67a" dark="#6e4220" />
      {RIVETS.map((angle) => {
        const [x, y] = polar(41, angle);
        return (
          <g key={angle}>
            <circle cx={fixed(x)} cy={fixed(y)} r="2.5" fill="#f3c08a" stroke="#6e4220" strokeWidth="0.6" />
            <circle cx={fixed(x - 0.7)} cy={fixed(y - 0.7)} r="0.8" fill="#ffffff" fillOpacity="0.8" />
          </g>
        );
      })}
      <path d={starPath(50, 4.5, 6, 2.7)} fill="#e8a96b" stroke="#6e4220" strokeWidth="0.9" strokeLinejoin="round" />
      <Shine />
    </>
  ),
  "frame:silver": (lite) => (
    <>
      <Wings rootX={9} rootY={52} layers={SILVER_WING} flap lite={lite} />
      {SILVER_STUDS.map((angle) => {
        const [x, y] = polar(45.6, angle);
        return (
          <circle key={angle} cx={fixed(x)} cy={fixed(y)} r="1.5" fill="#dfe5ec" stroke="#5f6874" strokeWidth="0.5" />
        );
      })}
      <Ring main="#aeb6c2" light="#f7f9fc" dark="#5f6874" />
      {RING_GEMS.map((angle) => {
        const [x, y] = polar(41, angle);
        return <Gem key={angle} cx={x} cy={y} r={1.9} fill="#3b82f6" dark="#1e3a8a" setting="#e5e9ef" />;
      })}
      <path d={starPath(50, 4, 7, 3)} fill="#f1f5f9" stroke="#5f6874" strokeWidth="0.9" strokeLinejoin="round" />
      <Shine />
      {lite ? null : (
        <Sparkles
          items={[
            [50, -5, 3.2, 0],
            [8, 22, 2.4, 0.9],
            [92, 22, 2.4, 1.6]
          ]}
        />
      )}
    </>
  ),
  "frame:gold": (lite) => (
    <>
      <Laurel fill="#e0ad2b" stroke="#7a5208" from={100} to={204} />
      <Ring main="#e2b23a" light="#fff3b0" dark="#8a5f08" />
      {GOLD_GEMS.map((angle) => {
        const [x, y] = polar(41, angle);
        return <Gem key={angle} cx={x} cy={y} r={2.1} fill="#dc2626" dark="#7f1d1d" setting="#f5d36b" />;
      })}
      <BottomStars fill="#ffd54a" stroke="#8a5f08" />
      {/* Ổ đá đỉnh: hai lá vàng ôm viên hồng ngọc. */}
      <path d={featherPath(48, 6, 200, 10, 2.6)} fill="#e2b23a" stroke="#8a5f08" strokeWidth="0.6" />
      <path d={featherPath(52, 6, -20, 10, -2.6)} fill="#e2b23a" stroke="#8a5f08" strokeWidth="0.6" />
      <DiamondGem cx={50} cy={4} w={4.2} h={5.4} fill="#dc2626" light="#fecaca" dark="#7f1d1d" />
      <Shine />
      {lite ? null : (
        <Sparkles
          items={[
            [50, -6, 3.4, 0],
            [11, 30, 2.6, 0.8],
            [89, 30, 2.6, 1.5],
            [26, 88, 2.2, 2]
          ]}
          color="#fff8d6"
        />
      )}
    </>
  ),
  "frame:emerald": (lite) => (
    <>
      <Halo color="#34d399" lite={lite} />
      <Wings rootX={9} rootY={56} layers={EMERALD_WING} flap lite={lite} />
      <Ring main="#0f9f75" light="#86efcf" dark="#064e3b" />
      <Rim color="#e6b93c" />
      {SILVER_STUDS.filter((_, index) => index % 2 === 0).map((angle) => {
        const [x, y] = polar(41, angle);
        return <Gem key={angle} cx={x} cy={y} r={1.6} fill="#34d399" dark="#065f46" setting="#f5d36b" />;
      })}
      <Crown gold="#f5c542" goldDark="#8a5f08" gem="#10b981" gemDark="#064e3b" />
      <path d={starPath(50, 95, 5.6, 2.5)} fill="#f5c542" stroke="#8a5f08" strokeWidth="0.8" strokeLinejoin="round" />
      <Shine />
      {lite ? null : (
        <Sparkles
          items={[
            [50, -13, 3.2, 0.3],
            [-4, 32, 2.8, 1],
            [104, 32, 2.8, 1.7],
            [14, 86, 2.2, 0.6],
            [86, 86, 2.2, 1.9]
          ]}
          color="#ecfdf5"
        />
      )}
    </>
  ),
  "frame:ruby": (lite) => (
    <>
      <Halo color="#fb7185" lite={lite} />
      <Wings rootX={9} rootY={56} layers={RUBY_WING} flap lite={lite} />
      <Ring main="#d0213f" light="#ffb3c1" dark="#6b0a1d" />
      <Rim color="#e6b93c" />
      {RING_GEMS.map((angle) => {
        const [x, y] = polar(41, angle);
        return <Gem key={angle} cx={x} cy={y} r={2} fill="#fb7185" dark="#881337" setting="#f5d36b" />;
      })}
      <Crown gold="#f5c542" goldDark="#8a5f08" gem="#e11d48" gemDark="#6b0a1d" />
      <BottomStars fill="#ffd54a" stroke="#8a5f08" />
      <Shine />
      {lite ? null : (
        <Sparkles
          items={[
            [50, -13, 3.2, 0],
            [-5, 30, 2.8, 0.7],
            [105, 30, 2.8, 1.4],
            [12, 84, 2.2, 2],
            [88, 84, 2.2, 1.1]
          ]}
          color="#fff1f2"
        />
      )}
    </>
  ),
  "frame:phoenix": (lite) => (
    <>
      <Halo color="#ff8a00" lite={lite} />
      <Wings rootX={10} rootY={58} layers={PHOENIX_WING} flap lite={lite} />
      {/* Đuôi lửa rủ dưới đáy — gốc nằm trong dải vòng (y 92), không lấn mặt avatar. */}
      {[-1, 0, 1].map((step) => (
        <path
          key={step}
          d={flamePath(50 + step * 7, 92, -(step === 0 ? 16 : 11), step === 0 ? 5 : 4)}
          fill={step === 0 ? "#ff7a1a" : "#ffa21f"}
          stroke="#9a2a05"
          strokeWidth="0.5"
        />
      ))}
      <Ring main="#e2471b" light="#ffd36b" dark="#6b1804" />
      <Rim color="#ffb340" />
      <circle
        cx={CENTER}
        cy={CENTER}
        r="41"
        fill="none"
        stroke="#ffd36b"
        strokeWidth="3"
        strokeDasharray="6 7"
        strokeLinecap="round"
        className="motion-safe:animate-spin-slow"
        style={SELF_CENTER}
      />
      {/* Mào lửa trên đỉnh, bập bùng. */}
      {[
        [40, 9, 13, 4.5, 0.2],
        [60, 9, 13, 4.5, 0.5],
        [50, 8, 20, 6.5, 0]
      ].map(([x, y, h, w, wait]) => (
        <g key={x} className="motion-safe:animate-frame-flicker" style={delay(wait, SELF_BOTTOM)}>
          <path d={flamePath(x, y, h, w)} fill="#ff5a0a" stroke="#9a2a05" strokeWidth="0.6" />
          <path d={flamePath(x, y - 1, h * 0.62, w * 0.55)} fill="#ffe27a" />
        </g>
      ))}
      <DiamondGem cx={50} cy={7} w={3} h={3.8} fill="#ffb340" light="#fff7d6" dark="#9a2a05" />
      <Shine />
      {lite
        ? null
        : [
            [22, 20, 1.4, 0],
            [78, 18, 1.2, 0.7],
            [35, 8, 1, 1.3],
            [66, 6, 1.3, 1.9],
            [10, 44, 1.1, 0.4],
            [90, 46, 1.2, 1.6]
          ].map(([x, y, r, wait]) => (
            <circle
              key={`${x}-${y}`}
              cx={x}
              cy={y}
              r={r}
              fill="#ffd36b"
              opacity="0"
              className="motion-safe:animate-frame-ember"
              style={delay(wait)}
            />
          ))}
    </>
  ),
  "frame:champion": (lite) => (
    <>
      {/* Tia sáng vàng mảnh toả sau lưng, xoay chậm. Tia bắt đầu từ ngoài vòng
          khung (r 46) — tia không được đè lên mặt avatar. */}
      <g className="motion-safe:animate-spin-slower" style={{ transformOrigin: "50px 50px" }}>
        {Array.from({ length: 24 }, (_, index) => {
          const angle = index * 15;
          const long = index % 2 === 0;
          const [a1, b1] = polar(46, angle - 1);
          const [a2, b2] = polar(46, angle + 1);
          const [tipX, tipY] = polar(long ? 62 : 55, angle);
          return (
            <polygon
              key={angle}
              points={`${fixed(a1)},${fixed(b1)} ${fixed(tipX)},${fixed(tipY)} ${fixed(a2)},${fixed(b2)}`}
              fill="#fde68a"
              opacity={long ? 0.75 : 0.45}
            />
          );
        })}
      </g>
      <Halo color="#a855f7" lite={lite} />
      <Laurel fill="#f5c542" stroke="#8a5f08" from={100} to={190} />
      <Ring main="#7c3aed" light="#e9d5ff" dark="#2e0657" />
      <Rim color="#f5c542" />
      {RING_GEMS.map((angle) => {
        const [x, y] = polar(41, angle);
        return <Gem key={angle} cx={x} cy={y} r={1.9} fill="#c084fc" dark="#3b0764" setting="#f5d36b" />;
      })}
      {/* Cúp ở đáy */}
      <path d="M 42.5 85.5 H 57.5 V 89 A 7.5 7.5 0 0 1 42.5 89 Z" fill="#f5c542" stroke="#8a5f08" strokeWidth="0.8" />
      <path d="M 44.5 87 V 90" stroke="#ffffff" strokeOpacity="0.7" strokeWidth="1.1" strokeLinecap="round" />
      <path d="M 42.5 87.5 Q 38.5 87.5 39.5 91 Q 40.5 93 43.5 92.5" fill="none" stroke="#8a5f08" strokeWidth="1" />
      <path d="M 57.5 87.5 Q 61.5 87.5 60.5 91 Q 59.5 93 56.5 92.5" fill="none" stroke="#8a5f08" strokeWidth="1" />
      <rect x="48.6" y="96" width="2.8" height="2.5" fill="#d4a017" />
      <rect x="44.5" y="98.5" width="11" height="3" rx="1" fill="#8a5f08" />
      {/* Ruy-băng số 1 ở đỉnh */}
      <path d="M 40 6 L 36 14 L 40 12.5 L 42 15.5 L 44 8 Z" fill="#b91c1c" />
      <path d="M 60 6 L 64 14 L 60 12.5 L 58 15.5 L 56 8 Z" fill="#b91c1c" />
      <rect x="41" y="-3" width="18" height="13" rx="3.5" fill="#dc2626" stroke="#7f1d1d" strokeWidth="0.8" />
      <path d="M 43 -1 H 57" stroke="#ffffff" strokeOpacity="0.45" strokeWidth="1" strokeLinecap="round" />
      <text
        x="50"
        y="7.4"
        textAnchor="middle"
        fontSize="9.5"
        fontWeight="800"
        fill="#ffffff"
        fontFamily="system-ui, sans-serif"
      >
        1
      </text>
      <Shine />
      {lite ? null : (
        <Sparkles
          items={[
            [32, -4, 3, 0],
            [68, -4, 3, 1.2],
            [2, 40, 2.6, 0.6],
            [98, 40, 2.6, 1.8]
          ]}
          color="#fef9c3"
        />
      )}
    </>
  )
};

// Quầng sáng quanh cả khung (CSS drop-shadow trên thẻ <svg> — chạy được mọi trình
// duyệt, không cần filter có id). Chỉ đồ Sử thi trở lên, và không ở bản lite.
const GLOW: Record<string, string> = {
  "frame:emerald": "#34d39999",
  "frame:ruby": "#fb718599",
  "frame:phoenix": "#ff8a00aa",
  "frame:champion": "#a855f799"
};

export function FrameArt({
  artKey,
  className = "",
  lite = false
}: {
  artKey: string;
  className?: string;
  lite?: boolean;
}) {
  const draw = ART[artKey];

  if (!draw) {
    return null;
  }

  const glow = lite ? undefined : GLOW[artKey];

  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={{
        overflow: "visible",
        filter: glow ? `drop-shadow(0 0 3px ${glow})` : undefined
      }}
    >
      {draw(lite)}
    </svg>
  );
}
