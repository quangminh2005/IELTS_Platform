import type { ReactNode } from "react";

// Hình khung avatar của Cửa hàng (lib/shop-catalog.ts). SVG viewBox 0..100, tâm
// (50,50). Lớp bọc phủ -inset-[18%] quanh avatar → avatar chiếm vòng tròn bán kính
// ≈ 36,8; vòng khung nằm ngay bên ngoài (r 37–45). Trang trí được tràn ra ngoài
// viewBox (overflow visible).
//
// LUẬT: không dùng thẻ defs, không id, không gradient SVG — AppShell vẽ avatar hai lần
// (một bản display:none), tham chiếu theo id sẽ hỏng. Hiệu ứng động chỉ trong
// motion-safe (tắt khi máy bật giảm chuyển động).

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

function Ring({ main, light, dark }: Palette) {
  return (
    <>
      <circle cx={CENTER} cy={CENTER} r="41" fill="none" stroke={main} strokeWidth="8" />
      <circle cx={CENTER} cy={CENTER} r="37.2" fill="none" stroke={light} strokeWidth="1.4" />
      <circle cx={CENTER} cy={CENTER} r="45.3" fill="none" stroke={dark} strokeWidth="1.2" />
      {/* Vệt sáng góc trên-trái cho có khối. */}
      <path d={arcPath(41, 200, 250)} fill="none" stroke="#ffffff" strokeOpacity="0.4" strokeWidth="2.4" strokeLinecap="round" />
    </>
  );
}

const WOOD_GRAIN = [10, 55, 100, 145, 190, 235, 280, 325];
const RIVETS = [0, 90, 180, 270];
const LAUREL_LEFT = [108, 122, 136, 150];
const LAUREL_RIGHT = [72, 58, 44, 30];

function Laurel({ angles, fill, stroke }: { angles: number[]; fill: string; stroke: string }) {
  return (
    <>
      {angles.map((angle) => {
        const [x, y] = polar(47, angle);
        return (
          <ellipse
            key={angle}
            cx={fixed(x)}
            cy={fixed(y)}
            rx="4.2"
            ry="1.9"
            fill={fill}
            stroke={stroke}
            strokeWidth="0.5"
            transform={`rotate(${angle + 90} ${fixed(x)} ${fixed(y)})`}
          />
        );
      })}
    </>
  );
}

const ART: Record<string, () => ReactNode> = {
  "frame:wood": () => (
    <>
      <Ring main="#9a6b3f" light="#c89a68" dark="#5e3d20" />
      {WOOD_GRAIN.map((angle, index) => (
        <path
          key={angle}
          d={arcPath(index % 2 === 0 ? 39.6 : 42.4, angle, angle + 16)}
          fill="none"
          stroke="#7a5230"
          strokeWidth="1.1"
          strokeLinecap="round"
        />
      ))}
    </>
  ),
  "frame:bronze": () => (
    <>
      <Ring main="#b87333" light="#e8a96b" dark="#6e4220" />
      {RIVETS.map((angle) => {
        const [x, y] = polar(41, angle);
        return <circle key={angle} cx={fixed(x)} cy={fixed(y)} r="2.4" fill="#f3c08a" stroke="#6e4220" strokeWidth="0.6" />;
      })}
    </>
  ),
  "frame:silver": () => (
    <>
      <Ring main="#aeb6c2" light="#f1f4f8" dark="#6b7480" />
      <path d={starPath(50, 5, 6.5, 2.8)} fill="#e9eef5" stroke="#6b7480" strokeWidth="0.9" strokeLinejoin="round" />
    </>
  ),
  "frame:gold": () => (
    <>
      <Ring main="#e2b23a" light="#fff0a6" dark="#9a6d0c" />
      <Laurel angles={LAUREL_LEFT} fill="#c99a1d" stroke="#7a5208" />
      <Laurel angles={LAUREL_RIGHT} fill="#c99a1d" stroke="#7a5208" />
      <path d={starPath(50, 4.5, 7.5, 3.2)} fill="#fff0a6" stroke="#9a6d0c" strokeWidth="1" strokeLinejoin="round" />
    </>
  ),
  "frame:emerald": () => (
    <>
      <Ring main="#10a36f" light="#7ef0c2" dark="#06603f" />
      <polygon points="36,9.5 39.5,4.5 43,9.5 39.5,14.5" fill="#34d399" stroke="#065f46" strokeWidth="0.9" />
      <polygon points="57,9.5 60.5,4.5 64,9.5 60.5,14.5" fill="#34d399" stroke="#065f46" strokeWidth="0.9" />
      <polygon points="44.5,6 50,-1.5 55.5,6 50,13.5" fill="#34d399" stroke="#065f46" strokeWidth="1" />
      <polygon points="47.5,4.5 50,1 51.5,4.5 50,6.5" fill="#ffffff" fillOpacity="0.6" />
    </>
  ),
  "frame:ruby": () => (
    <>
      <Ring main="#d0213f" light="#ff9fb0" dark="#7a0d22" />
      <path
        d="M 36 10 L 37.5 -1 L 43.5 4.5 L 50 -4 L 56.5 4.5 L 62.5 -1 L 64 10 Z"
        fill="#f5c542"
        stroke="#9a6d0c"
        strokeWidth="0.9"
        strokeLinejoin="round"
      />
      <circle cx="43.5" cy="6.5" r="1.7" fill="#d0213f" />
      <circle cx="50" cy="5" r="2.1" fill="#d0213f" />
      <circle cx="56.5" cy="6.5" r="1.7" fill="#d0213f" />
    </>
  ),
  "frame:phoenix": () => (
    <>
      {/* Cánh lửa hai bên, cánh phải là bản lật của cánh trái. */}
      {[false, true].map((mirrored) => (
        <g key={String(mirrored)} transform={mirrored ? "translate(100 0) scale(-1 1)" : undefined}>
          <path
            d="M 16 72 C 3 66, -3 50, 3 38 C 7 50, 11 55, 17 57 C 9 48, 9 40, 13 31 C 17 44, 21 51, 26 54 Z"
            fill="#ff7a1a"
          />
          <path d="M 17 68 C 9 63, 6 53, 8 46 C 12 54, 16 58, 22 60 Z" fill="#ffd36b" />
        </g>
      ))}
      <Ring main="#e2471b" light="#ffd36b" dark="#7a1d05" />
      <circle
        cx={CENTER}
        cy={CENTER}
        r="41"
        fill="none"
        stroke="#ffb340"
        strokeWidth="3.6"
        strokeDasharray="6 7"
        strokeLinecap="round"
        className="motion-safe:animate-spin-slow"
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
      />
      <path d="M 50 -6 C 43 3, 45 8, 50 10 C 55 8, 57 3, 50 -6 Z" fill="#ffd36b" stroke="#e2471b" strokeWidth="0.8" />
    </>
  ),
  "frame:champion": () => (
    <>
      <Ring main="#7c3aed" light="#e9d5ff" dark="#3b0764" />
      <Laurel angles={LAUREL_LEFT} fill="#f5c542" stroke="#9a6d0c" />
      <Laurel angles={LAUREL_RIGHT} fill="#f5c542" stroke="#9a6d0c" />
      {/* Cúp ở đáy */}
      <path d="M 43 86 H 57 V 89 A 7 7 0 0 1 43 89 Z" fill="#f5c542" stroke="#9a6d0c" strokeWidth="0.8" />
      <path d="M 43 87.5 Q 39 87.5 40 91 Q 41 93 44 92.5" fill="none" stroke="#9a6d0c" strokeWidth="1" />
      <path d="M 57 87.5 Q 61 87.5 60 91 Q 59 93 56 92.5" fill="none" stroke="#9a6d0c" strokeWidth="1" />
      <rect x="48.6" y="95.5" width="2.8" height="2.5" fill="#d4a017" />
      <rect x="45" y="98" width="10" height="3" rx="1" fill="#9a6d0c" />
      {/* Ruy-băng số 1 ở đỉnh */}
      <rect x="42" y="-2" width="16" height="12" rx="3" fill="#dc2626" stroke="#7f1d1d" strokeWidth="0.8" />
      <text x="50" y="7.6" textAnchor="middle" fontSize="9" fontWeight="800" fill="#ffffff" fontFamily="system-ui, sans-serif">
        1
      </text>
    </>
  )
};

export function FrameArt({ artKey, className = "" }: { artKey: string; className?: string }) {
  const draw = ART[artKey];

  if (!draw) {
    return null;
  }

  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={{ overflow: "visible" }}
    >
      {draw()}
    </svg>
  );
}
