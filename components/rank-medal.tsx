import type { ReactNode } from "react";

// Huy hiệu hạng đấu tự vẽ (lib/xp-rank.ts). viewBox 100×100, KHÔNG defs/id (nhiều
// huy hiệu cùng trang sẽ đụng id) — đổ bóng bằng các lớp màu chồng nhau.
// Dáng theo hạng: 3 hạng đầu huy chương răng cưa, Bạch Kim lục giác, Kim Cương viên
// đá, Cao Thủ khiên có cánh, Thách Đấu khiên + cánh + vương miện. Số cấp = số vạch
// trên dải ruy băng phía dưới.

type Palette = { dark: string; mid: string; light: string; shine: string };

const PALETTES: Record<string, Palette> = {
  bronze: { dark: "#9a3412", mid: "#ea580c", light: "#fdba74", shine: "#fff7ed" },
  silver: { dark: "#475569", mid: "#94a3b8", light: "#e2e8f0", shine: "#ffffff" },
  gold: { dark: "#a16207", mid: "#eab308", light: "#fde68a", shine: "#fffbeb" },
  platinum: { dark: "#0e7490", mid: "#22d3ee", light: "#cffafe", shine: "#ffffff" },
  diamond: { dark: "#1d4ed8", mid: "#3b82f6", light: "#bfdbfe", shine: "#eff6ff" },
  master: { dark: "#5b21b6", mid: "#8b5cf6", light: "#ddd6fe", shine: "#f5f3ff" },
  challenger: { dark: "#9f1239", mid: "#f43f5e", light: "#fecdd3", shine: "#fff1f2" }
};

function starPoints(cx: number, cy: number, outer: number, inner: number): string {
  const points: string[] = [];
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    points.push(`${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`);
  }
  return points.join(" ");
}

function polygon(cx: number, cy: number, radius: number, sides: number, rotate = 0): string {
  return Array.from({ length: sides }, (_, i) => {
    const angle = ((Math.PI * 2) / sides) * i + rotate;
    return `${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`;
  }).join(" ");
}

// Cánh trái 3 lớp lông; cánh phải = lật gương quanh x = 50.
function Wing({ color, edge }: { color: string; edge: string }) {
  return (
    <g stroke={edge} strokeWidth="1.6" strokeLinejoin="round">
      <path d="M27 54 C 15 52, 6 58, 4 67 C 12 64, 19 64, 27 63 Z" fill={color} />
      <path d="M26 44 C 12 39, 3 43, 1 52 C 9 51, 17 53, 26 55 Z" fill={color} />
      <path d="M27 33 C 16 21, 4 20, 1 28 C 7 31, 16 36, 26 45 Z" fill={color} />
    </g>
  );
}

// Tia sáng sau lưng (hạng Thách Đấu).
function Rays({ color }: { color: string }) {
  return (
    <g opacity="0.55">
      {Array.from({ length: 12 }, (_, i) => (
        <path key={i} d="M50 46 L47 2 L53 2 Z" fill={color} transform={`rotate(${i * 30} 50 46)`} />
      ))}
    </g>
  );
}

// Lấp lánh (Kim Cương trở lên).
function Sparkle({ x, y, size, color }: { x: number; y: number; size: number; color: string }) {
  return (
    <path
      d={`M${x} ${y - size} Q ${x} ${y}, ${x + size} ${y} Q ${x} ${y}, ${x} ${y + size} Q ${x} ${y}, ${x - size} ${y} Q ${x} ${y}, ${x} ${y - size} Z`}
      fill={color}
    />
  );
}

function Body({ rankKey, p }: { rankKey: string; p: Palette }) {
  if (rankKey === "platinum") {
    return (
      <>
        <polygon points={polygon(50, 46, 40, 6, Math.PI / 6)} fill={p.dark} />
        <polygon points={polygon(50, 46, 35, 6, Math.PI / 6)} fill={p.mid} />
      </>
    );
  }
  if (rankKey === "diamond") {
    return (
      <>
        <path d="M50 4 L88 38 L50 90 L12 38 Z" fill={p.dark} />
        <path d="M50 10 L81 38 L50 82 L19 38 Z" fill={p.mid} />
        <path d="M50 10 L64 38 L50 82 L36 38 Z" fill={p.light} opacity="0.35" />
      </>
    );
  }
  if (rankKey === "master" || rankKey === "challenger") {
    return (
      <>
        <path d="M50 8 L82 20 L79 56 Q 74 78 50 90 Q 26 78 21 56 L18 20 Z" fill={p.dark} />
        <path d="M50 14 L76 24 L73 55 Q 69 73 50 83 Q 31 73 27 55 L24 24 Z" fill={p.mid} />
      </>
    );
  }
  // Huy chương răng cưa (Đồng / Bạc / Vàng).
  const teeth = Array.from({ length: 16 }, (_, i) => {
    const angle = ((Math.PI * 2) / 16) * i;
    return <circle key={i} cx={50 + 37 * Math.cos(angle)} cy={46 + 37 * Math.sin(angle)} r="7.5" fill={p.dark} />;
  });
  return (
    <>
      {teeth}
      <circle cx="50" cy="46" r="38" fill={p.dark} />
      <circle cx="50" cy="46" r="33" fill={p.mid} />
    </>
  );
}

export function RankMedal({
  rankKey,
  level,
  className = "h-12 w-12",
  title
}: {
  rankKey: string;
  level: number; // 0 = cấp I
  className?: string;
  title?: string;
}) {
  const p = PALETTES[rankKey] ?? PALETTES.bronze;
  const winged = rankKey === "master" || rankKey === "challenger";
  const pips: ReactNode[] = Array.from({ length: level + 1 }, (_, i) => {
    const x = 50 + (i - level / 2) * 7;
    return <path key={i} d={`M${x} 85.5 l2.6 3 l-2.6 3 l-2.6 -3 Z`} fill={p.shine} />;
  });

  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label={title} aria-hidden={title ? undefined : true}>
      {title ? <title>{title}</title> : null}
      {rankKey === "challenger" ? <Rays color="#facc15" /> : null}
      {winged ? (
        <>
          <Wing color={p.light} edge={p.dark} />
          <g transform="translate(100 0) scale(-1 1)">
            <Wing color={p.light} edge={p.dark} />
          </g>
        </>
      ) : null}

      <Body rankKey={rankKey} p={p} />
      {/* Khối nổi: nửa trên sáng, nửa dưới tối */}
      <ellipse cx="42" cy="30" rx="20" ry="9" fill="#ffffff" opacity="0.16" transform="rotate(-25 42 30)" />
      <path d="M24 56 Q 50 82, 76 56 Q 50 74, 24 56 Z" fill="#000000" opacity="0.14" />

      {/* Mặt trong + ngôi sao */}
      <circle cx="50" cy="46" r="22" fill={p.dark} />
      <circle cx="50" cy="46" r="19.5" fill={p.light} />
      <circle cx="50" cy="48" r="17" fill={p.mid} opacity="0.25" />
      <polygon points={starPoints(50, 47, 16, 7)} fill={p.dark} />
      <polygon points={starPoints(50, 46, 14, 6)} fill={p.mid} />
      <polygon points={starPoints(49, 45, 8, 3.5)} fill={p.shine} opacity="0.9" />
      {/* Vệt sáng góc trên trái */}
      <path d="M34 36 Q 37 29, 44 26.5" stroke={p.shine} strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.75" />

      {rankKey === "diamond" || winged ? (
        <>
          <Sparkle x={82} y={14} size={5} color={p.shine} />
          <Sparkle x={16} y={78} size={3.5} color={p.shine} />
        </>
      ) : null}

      {rankKey === "challenger" ? (
        <g>
          <path d="M33 18 L36 3 L43 12 L50 0 L57 12 L64 3 L67 18 Z" fill="#b45309" />
          <path d="M35.5 16.5 L37.5 7 L43.5 14.5 L50 4.5 L56.5 14.5 L62.5 7 L64.5 16.5 Z" fill="#facc15" />
          <circle cx="50" cy="11" r="2" fill="#fef3c7" />
        </g>
      ) : null}

      {/* Ruy băng cấp */}
      <path d="M28 80 L72 80 L76 88 L72 96 L28 96 L24 88 Z" fill={p.dark} />
      <path d="M31 82 L69 82 L72 88 L69 94 L31 94 L28 88 Z" fill={p.mid} />
      {pips}
    </svg>
  );
}
