import type { CSSProperties, ReactNode } from "react";
import { MASCOTS, resolvePose, type MascotId, type PoseId } from "@/lib/mascots";

// Hình linh vật (Xu Đợt 4, lib/mascots.ts). SVG viewBox 0..200, mặt đất y≈188.
// Mỗi con vẽ MỘT lần thành bộ phận rời — phía sau (đuôi, cánh), thân, đầu (mặt đổi
// theo biểu cảm), tay trái ở dáng buông thõng từ vai (68,128). Tay phải = tay trái
// lật gương quanh x=100, nên một góc "giơ ra ngoài" dùng chung cho cả hai bên.
// Tư thế = góc tay + biểu cảm + đạo cụ + hoạt ảnh gắn lên từng bộ phận.
//
// LUẬT (như khung avatar): không thẻ defs, không id, không gradient SVG — nhiều bản
// trên một trang. Hoạt ảnh chỉ trong motion-safe; keyframes mascot-* ở
// tailwind.config.ts. `still` = hình tĩnh (ô chọn tư thế, danh sách).
//
// Lưu ý: hoạt ảnh CSS ghi đè thuộc tính transform của chính phần tử, nên góc xoay
// tư thế nằm ở thẻ <g> ngoài, hoạt ảnh ở thẻ <g> trong.

type Expr = "open" | "happy" | "down" | "closed" | "joy" | "fierce";
type Point = [number, number];

const SHOULDER: Point = [68, 128];
const NECK = "100px 126px";
const GROUND = "100px 186px";
const DARK = "#2B2118";
const BLUSH = "#F9A8B8";

// Tên lớp viết đủ chữ để Tailwind JIT nhìn thấy.
const ANIM = {
  bob: "motion-safe:animate-mascot-bob",
  blink: "motion-safe:animate-mascot-blink",
  wave: "motion-safe:animate-mascot-wave",
  nod: "motion-safe:animate-mascot-nod",
  page: "motion-safe:animate-mascot-page",
  hop: "motion-safe:animate-mascot-hop",
  breathe: "motion-safe:animate-mascot-breathe",
  float: "motion-safe:animate-mascot-float",
  swing: "motion-safe:animate-mascot-swing",
  sway: "motion-safe:animate-mascot-sway",
  scan: "motion-safe:animate-mascot-scan",
  flame: "motion-safe:animate-mascot-flame",
  flap: "motion-safe:animate-mascot-flap",
  tail: "motion-safe:animate-mascot-tail",
  twinkle: "motion-safe:animate-frame-twinkle"
} as const;

type AnimKey = keyof typeof ANIM;

function anim(still: boolean, key: AnimKey | undefined): string | undefined {
  return still || !key ? undefined : ANIM[key];
}

function origin(value: string, delay?: number): CSSProperties {
  return delay ? { transformOrigin: value, animationDelay: `${delay}s` } : { transformOrigin: value };
}

const SELF_CENTER: CSSProperties = { transformBox: "fill-box", transformOrigin: "center" };

// Lật gương quanh trục giữa x=100 (tay/cánh/tai bên phải).
const MIRROR = "translate(200 0) scale(-1 1)";

// ---------------------------------------------------------------------------
// Mắt

function ChibiEyes({
  expr,
  still,
  y = 88,
  lx = 79,
  rx = 121,
  w = 7,
  h = 9
}: {
  expr: Expr;
  still: boolean;
  y?: number;
  lx?: number;
  rx?: number;
  w?: number;
  h?: number;
}) {
  const xs = [lx, rx];
  const line = { stroke: DARK, strokeWidth: 3, strokeLinecap: "round" as const, fill: "none" };

  if (expr === "closed") {
    return (
      <g>
        {xs.map((x) => (
          <path key={x} d={`M ${x - 8} ${y} Q ${x} ${y + 6} ${x + 8} ${y}`} {...line} />
        ))}
      </g>
    );
  }

  if (expr === "joy") {
    return (
      <g>
        {xs.map((x) => (
          <path key={x} d={`M ${x - 8} ${y + 3} Q ${x} ${y - 7} ${x + 8} ${y + 3}`} {...line} />
        ))}
      </g>
    );
  }

  if (expr === "down") {
    return (
      <g>
        {xs.map((x) => (
          <g key={x}>
            <ellipse cx={x} cy={y + 3} rx={w} ry={h - 1} fill={DARK} />
            <circle cx={x - 2.2} cy={y + 0.5} r={2.4} fill="#fff" />
          </g>
        ))}
      </g>
    );
  }

  return (
    <g>
      <g className={anim(still, "blink")} style={SELF_CENTER}>
        {xs.map((x) => (
          <g key={x}>
            <ellipse cx={x} cy={y} rx={w} ry={h} fill={DARK} />
            <circle cx={x - 2.5} cy={y - 3.5} r={2.8} fill="#fff" />
            <circle cx={x + 2.4} cy={y + 3.2} r={1.3} fill="#fff" />
          </g>
        ))}
      </g>
      {expr === "fierce" ? (
        <g {...line} strokeWidth={3.5}>
          <path d={`M ${lx - 11} ${y - 16} L ${lx + 8} ${y - 10}`} />
          <path d={`M ${rx + 11} ${y - 16} L ${rx - 8} ${y - 10}`} />
        </g>
      ) : null}
    </g>
  );
}

function Blush({ y = 104, lx = 66, rx = 134 }: { y?: number; lx?: number; rx?: number }) {
  return (
    <g fill={BLUSH} opacity={0.55}>
      <ellipse cx={lx} cy={y} rx={8} ry={4.5} />
      <ellipse cx={rx} cy={y} rx={8} ry={4.5} />
    </g>
  );
}

function mouthOpen(expr: Expr): boolean {
  return expr === "joy" || expr === "fierce";
}

// ---------------------------------------------------------------------------
// Từng con

type Species = {
  back: (still: boolean) => ReactNode;
  body: () => ReactNode;
  head: (expr: Expr, still: boolean) => ReactNode;
  arm: () => ReactNode; // tay trái buông thõng từ vai (68,128)
  hand: Point; // đầu bàn tay ở dáng buông
};

// ---- Cú Thông Thái ----
const OWL = {
  main: "#8A5A3B",
  dark: "#5E3B26",
  light: "#B47C55",
  face: "#EBCB9F",
  belly: "#F3E1C2",
  scallop: "#D6B387",
  beak: "#F59E0B",
  frame: "#3B2416"
};

function OwlEyes({ expr, still }: { expr: Expr; still: boolean }) {
  const xs = [80, 120];
  const y = 88;
  const line = { stroke: OWL.frame, strokeWidth: 3, strokeLinecap: "round" as const, fill: "none" };

  let inner: ReactNode;
  if (expr === "closed" || expr === "joy") {
    inner = xs.map((x) => (
      <path
        key={x}
        d={
          expr === "closed"
            ? `M ${x - 9} ${y} Q ${x} ${y + 7} ${x + 9} ${y}`
            : `M ${x - 9} ${y + 4} Q ${x} ${y - 7} ${x + 9} ${y + 4}`
        }
        {...line}
      />
    ));
  } else if (expr === "down") {
    inner = xs.map((x) => (
      <g key={x}>
        <circle cx={x} cy={y} r={14} fill="#fff" />
        <circle cx={x} cy={y + 5} r={7.5} fill={DARK} />
        <circle cx={x - 2} cy={y + 2.5} r={2.5} fill="#fff" />
      </g>
    ));
  } else {
    inner = (
      <g className={anim(still, "blink")} style={SELF_CENTER}>
        {xs.map((x) => (
          <g key={x}>
            <circle cx={x} cy={y} r={14} fill="#fff" />
            <circle cx={x + 1} cy={y + 1} r={8} fill={DARK} />
            <circle cx={x - 2} cy={y - 3} r={3} fill="#fff" />
            <circle cx={x + 3.5} cy={y + 4} r={1.3} fill="#fff" />
          </g>
        ))}
      </g>
    );
  }

  return (
    <g>
      {inner}
      {/* Kính tròn — dấu hiệu "thông thái", đeo ở mọi tư thế. */}
      <g {...line}>
        <circle cx={80} cy={y} r={17} />
        <circle cx={120} cy={y} r={17} />
        <path d="M 97 86 Q 100 82 103 86" />
        <path d="M 63 85 L 52 80" />
        <path d="M 137 85 L 148 80" />
      </g>
    </g>
  );
}

const owl: Species = {
  hand: [62, 160],
  back: () => null,
  body: () => (
    <g>
      <ellipse cx={100} cy={146} rx={40} ry={36} fill={OWL.main} />
      <ellipse cx={100} cy={152} rx={27} ry={26} fill={OWL.belly} />
      <g stroke={OWL.scallop} strokeWidth={2.2} fill="none" strokeLinecap="round">
        {[
          [92, 140],
          [108, 140],
          [86, 151],
          [100, 151],
          [114, 151],
          [93, 162],
          [107, 162]
        ].map(([x, y]) => (
          <path key={`${x}-${y}`} d={`M ${x - 5} ${y} Q ${x} ${y + 5} ${x + 5} ${y}`} />
        ))}
      </g>
      <g fill={OWL.beak}>
        {[86, 114].map((x) => (
          <g key={x}>
            <ellipse cx={x - 6} cy={183} rx={4} ry={3.2} />
            <ellipse cx={x} cy={184} rx={4} ry={3.2} />
            <ellipse cx={x + 6} cy={183} rx={4} ry={3.2} />
          </g>
        ))}
      </g>
    </g>
  ),
  head: (expr, still) => (
    <g>
      <path d="M 54 64 L 52 26 L 82 46 Z" fill={OWL.dark} />
      <path d="M 146 64 L 148 26 L 118 46 Z" fill={OWL.dark} />
      <ellipse cx={100} cy={84} rx={52} ry={44} fill={OWL.main} />
      <path d="M 90 50 L 100 60 L 110 50" stroke={OWL.light} strokeWidth={3.5} fill="none" strokeLinecap="round" />
      <ellipse cx={80} cy={88} rx={24} ry={23} fill={OWL.face} />
      <ellipse cx={120} cy={88} rx={24} ry={23} fill={OWL.face} />
      <Blush y={112} lx={62} rx={138} />
      <OwlEyes expr={expr} still={still} />
      <path d="M 100 101 L 93 108 L 100 119 L 107 108 Z" fill={OWL.beak} />
      {mouthOpen(expr) ? <path d="M 94.5 110 L 100 117 L 105.5 110 Z" fill="#B45309" /> : null}
    </g>
  ),
  arm: () => (
    <g>
      <path d="M 72 120 C 52 126 48 150 58 168 C 62 162 64 160 68 162 C 70 156 72 156 76 158 C 78 146 80 132 72 120 Z" fill={OWL.dark} />
      <path d="M 70 128 C 58 134 56 148 61 160" stroke={OWL.light} strokeWidth={2.5} fill="none" strokeLinecap="round" />
    </g>
  )
};

// ---- Mèo Cam ----
const CAT = {
  main: "#F4A04A",
  dark: "#D9772B",
  cream: "#FFF1DD",
  pink: "#F7A9B8",
  nose: "#E86F8A"
};

const cat: Species = {
  hand: [66, 156],
  back: (still) => (
    <g className={anim(still, "tail")} style={origin("128px 170px")}>
      <path d="M 126 170 C 160 174 172 150 162 122" stroke={CAT.main} strokeWidth={12} fill="none" strokeLinecap="round" />
      <path d="M 165 136 C 165 130 164 126 162 122" stroke={CAT.dark} strokeWidth={12} fill="none" strokeLinecap="round" />
    </g>
  ),
  body: () => (
    <g>
      <ellipse cx={100} cy={148} rx={37} ry={34} fill={CAT.main} />
      <ellipse cx={100} cy={155} rx={22} ry={22} fill={CAT.cream} />
      <g stroke={CAT.dark} strokeWidth={3.5} strokeLinecap="round">
        <path d="M 66 140 L 75 142" />
        <path d="M 65 151 L 74 152" />
        <path d="M 134 140 L 125 142" />
        <path d="M 135 151 L 126 152" />
      </g>
      <g fill={CAT.cream}>
        <ellipse cx={86} cy={181} rx={12} ry={6.5} />
        <ellipse cx={114} cy={181} rx={12} ry={6.5} />
      </g>
    </g>
  ),
  head: (expr, still) => (
    <g>
      <path d="M 54 70 L 58 26 L 92 50 Z" fill={CAT.main} />
      <path d="M 61 60 L 63 37 L 81 50 Z" fill={CAT.pink} />
      <g transform={MIRROR}>
        <path d="M 54 70 L 58 26 L 92 50 Z" fill={CAT.main} />
        <path d="M 61 60 L 63 37 L 81 50 Z" fill={CAT.pink} />
      </g>
      <ellipse cx={100} cy={88} rx={54} ry={44} fill={CAT.main} />
      <g stroke={CAT.dark} strokeWidth={4} strokeLinecap="round">
        <path d="M 91 48 L 93 58" />
        <path d="M 100 46 L 100 58" />
        <path d="M 109 48 L 107 58" />
        <path d="M 47 86 L 57 88" />
        <path d="M 48 96 L 57 96" />
        <path d="M 153 86 L 143 88" />
        <path d="M 152 96 L 143 96" />
      </g>
      <Blush y={104} lx={68} rx={132} />
      <ChibiEyes expr={expr} still={still} lx={78} rx={122} />
      <ellipse cx={92} cy={107} rx={9} ry={7} fill={CAT.cream} />
      <ellipse cx={108} cy={107} rx={9} ry={7} fill={CAT.cream} />
      <path d="M 95.5 99 L 104.5 99 L 100 104.5 Z" fill={CAT.nose} />
      {mouthOpen(expr) ? (
        <g>
          <ellipse cx={100} cy={111} rx={5} ry={5} fill="#7A1F2B" />
          <ellipse cx={100} cy={113.5} rx={3} ry={2} fill={CAT.nose} />
        </g>
      ) : (
        <path d="M 100 104 Q 97 110 92 107 M 100 104 Q 103 110 108 107" stroke={DARK} strokeWidth={2} fill="none" strokeLinecap="round" />
      )}
      <g stroke="#8A5A3B" strokeWidth={1.6} opacity={0.55} strokeLinecap="round">
        <path d="M 66 102 L 46 98" />
        <path d="M 66 107 L 46 109" />
        <path d="M 134 102 L 154 98" />
        <path d="M 134 107 L 154 109" />
      </g>
    </g>
  ),
  arm: () => (
    <g>
      <path d="M 62 124 C 56 134 56 146 59 154 C 63 160 72 159 73 152 C 74 144 75 134 75 126 Z" fill={CAT.main} stroke={CAT.dark} strokeWidth={2} />
      <ellipse cx={66} cy={156} rx={7.5} ry={5.5} fill={CAT.cream} />
    </g>
  )
};

// ---- Cáo Lanh Lợi ----
const FOX = {
  main: "#EA6B2D",
  dark: "#B4471B",
  white: "#FFF6EC",
  sock: "#3A2A22",
  innerEar: "#FFD9C2"
};

const fox: Species = {
  hand: [66, 156],
  back: (still) => (
    <g className={anim(still, "tail")} style={origin("126px 170px")}>
      <path d="M 122 172 C 168 184 196 150 178 104 C 172 120 160 126 148 122 C 158 142 148 160 124 158 Z" fill={FOX.main} />
      <path d="M 178 104 C 190 122 188 138 178 150 C 174 140 168 134 160 128 C 168 122 175 114 178 104 Z" fill={FOX.white} />
    </g>
  ),
  body: () => (
    <g>
      <ellipse cx={100} cy={148} rx={36} ry={34} fill={FOX.main} />
      <ellipse cx={100} cy={155} rx={20} ry={22} fill={FOX.white} />
      <g fill={FOX.sock}>
        <ellipse cx={86} cy={181} rx={12} ry={6.5} />
        <ellipse cx={114} cy={181} rx={12} ry={6.5} />
      </g>
    </g>
  ),
  head: (expr, still) => (
    <g>
      <path d="M 56 72 L 52 16 L 92 48 Z" fill={FOX.main} />
      <path d="M 61 62 L 58 30 L 82 49 Z" fill={FOX.innerEar} />
      <path d="M 52 16 L 54 33 L 66 27 Z" fill={FOX.sock} />
      <g transform={MIRROR}>
        <path d="M 56 72 L 52 16 L 92 48 Z" fill={FOX.main} />
        <path d="M 61 62 L 58 30 L 82 49 Z" fill={FOX.innerEar} />
        <path d="M 52 16 L 54 33 L 66 27 Z" fill={FOX.sock} />
      </g>
      <ellipse cx={100} cy={88} rx={52} ry={42} fill={FOX.main} />
      <path d="M 49 92 Q 76 92 90 112 Q 100 122 110 112 Q 124 92 151 92 Q 146 126 100 130 Q 54 126 49 92 Z" fill={FOX.white} />
      <Blush y={108} lx={68} rx={132} />
      <ChibiEyes expr={expr} still={still} lx={79} rx={121} y={86} w={6.5} h={8.5} />
      <ellipse cx={100} cy={108} rx={5.5} ry={4} fill={FOX.sock} />
      {mouthOpen(expr) ? (
        <ellipse cx={100} cy={116} rx={5} ry={4.5} fill="#7A1F2B" />
      ) : (
        <path d="M 100 112 Q 97 117 92 115 M 100 112 Q 103 117 108 115" stroke={DARK} strokeWidth={2} fill="none" strokeLinecap="round" />
      )}
    </g>
  ),
  arm: () => (
    <g>
      <path d="M 62 124 C 56 134 56 146 59 154 C 63 160 72 159 73 152 C 74 144 75 134 75 126 Z" fill={FOX.main} stroke={FOX.dark} strokeWidth={2} />
      <ellipse cx={66} cy={156} rx={7.5} ry={5.5} fill={FOX.sock} />
    </g>
  )
};

// ---- Rồng Con ----
const DRAGON = {
  main: "#3FBF8A",
  dark: "#248A60",
  belly: "#FDE7A0",
  plate: "#E3C064",
  horn: "#FFF2D3",
  hornLine: "#D8B66E",
  spike: "#F59E0B",
  wing: "#2E9F72",
  snout: "#8BE0B9"
};

function DragonWing() {
  return (
    <g>
      <path d="M 78 122 L 42 82 Q 46 100 34 108 Q 50 112 44 124 Q 58 120 64 134 Z" fill={DRAGON.wing} />
      <g stroke={DRAGON.dark} strokeWidth={2.2} strokeLinecap="round" fill="none">
        <path d="M 78 122 L 42 82" />
        <path d="M 72 122 L 36 108" />
        <path d="M 70 126 L 46 122" />
      </g>
    </g>
  );
}

const dragon: Species = {
  hand: [66, 154],
  back: (still) => (
    <g>
      <g className={anim(still, "flap")} style={origin("78px 122px")}>
        <DragonWing />
      </g>
      <g transform={MIRROR}>
        <g className={anim(still, "flap")} style={origin("78px 122px")}>
          <DragonWing />
        </g>
      </g>
      <g className={anim(still, "tail")} style={origin("126px 170px")}>
        <path d="M 124 170 C 156 180 174 168 178 148" stroke={DRAGON.main} strokeWidth={12} fill="none" strokeLinecap="round" />
        <path d="M 178 134 L 192 150 L 176 160 L 170 148 Z" fill={DRAGON.spike} />
      </g>
    </g>
  ),
  body: () => (
    <g>
      <ellipse cx={100} cy={148} rx={37} ry={34} fill={DRAGON.main} />
      <ellipse cx={100} cy={154} rx={23} ry={24} fill={DRAGON.belly} />
      <g stroke={DRAGON.plate} strokeWidth={2} fill="none" strokeLinecap="round">
        <path d="M 84 142 Q 100 146 116 142" />
        <path d="M 79 153 Q 100 157 121 153" />
        <path d="M 82 164 Q 100 168 118 164" />
      </g>
      <g fill={DRAGON.main}>
        <ellipse cx={86} cy={181} rx={12} ry={6.5} />
        <ellipse cx={114} cy={181} rx={12} ry={6.5} />
      </g>
      <g fill={DRAGON.horn}>
        {[78, 86, 94, 106, 114, 122].map((x) => (
          <circle key={x} cx={x} cy={185} r={2} />
        ))}
      </g>
    </g>
  ),
  head: (expr, still) => (
    <g>
      <path d="M 70 58 Q 56 36 64 18 Q 74 38 86 50 Z" fill={DRAGON.horn} stroke={DRAGON.hornLine} strokeWidth={1.5} />
      <path d="M 130 58 Q 144 36 136 18 Q 126 38 114 50 Z" fill={DRAGON.horn} stroke={DRAGON.hornLine} strokeWidth={1.5} />
      <path d="M 90 46 L 100 26 L 110 46 Z" fill={DRAGON.spike} />
      <ellipse cx={100} cy={86} rx={52} ry={43} fill={DRAGON.main} />
      <path d="M 52 70 L 42 66 L 50 80 Z" fill={DRAGON.dark} />
      <path d="M 148 70 L 158 66 L 150 80 Z" fill={DRAGON.dark} />
      <Blush y={104} lx={64} rx={136} />
      <ChibiEyes expr={expr} still={still} lx={78} rx={122} y={84} w={8} h={10} />
      <ellipse cx={100} cy={109} rx={22} ry={13} fill={DRAGON.snout} />
      <ellipse cx={93} cy={104} rx={2.2} ry={1.6} fill={DRAGON.dark} />
      <ellipse cx={107} cy={104} rx={2.2} ry={1.6} fill={DRAGON.dark} />
      {mouthOpen(expr) ? (
        <g>
          <ellipse cx={100} cy={115} rx={8} ry={6} fill="#7A1F2B" />
          <ellipse cx={100} cy={118} rx={4.5} ry={2.4} fill="#F87171" />
        </g>
      ) : (
        <g>
          <path d="M 91 113 Q 100 119 109 113" stroke={DARK} strokeWidth={2} fill="none" strokeLinecap="round" />
          <path d="M 104 115.5 L 105.5 119.5 L 107.5 114.3 Z" fill="#fff" />
        </g>
      )}
    </g>
  ),
  arm: () => (
    <g>
      <path d="M 63 124 C 57 134 58 144 61 151 C 65 157 72 156 73 150 C 74 142 75 133 75 126 Z" fill={DRAGON.main} stroke={DRAGON.dark} strokeWidth={2} />
      <g fill={DRAGON.horn}>
        <circle cx={61} cy={153} r={2} />
        <circle cx={66} cy={156} r={2} />
        <circle cx={71} cy={154} r={2} />
      </g>
    </g>
  )
};

const SPECIES: Record<MascotId, Species> = { owl, cat, fox, dragon };

// ---------------------------------------------------------------------------
// Đạo cụ + hiệu ứng

function Book({ still }: { still: boolean }) {
  return (
    <g transform="translate(100 150) scale(1.3) translate(-100 -150)">
      <path d="M 68 133 L 100 139 L 132 133 L 132 163 L 100 169 L 68 163 Z" fill="#3B5BA9" />
      <path d="M 72 134 L 100 139 L 100 165 L 72 160 Z" fill="#fff" />
      <path d="M 128 134 L 100 139 L 100 165 L 128 160 Z" fill="#F8FAFC" />
      <g stroke="#CBD5E1" strokeWidth={1.6} strokeLinecap="round">
        <path d="M 77 142 L 95 145" />
        <path d="M 77 148 L 95 151" />
        <path d="M 77 154 L 92 156.5" />
        <path d="M 105 145 L 123 142" />
        <path d="M 105 151 L 123 148" />
      </g>
      <g className={anim(still, "page")} style={origin("100px 150px")}>
        <path d="M 100 139 L 124 135 L 124 160 L 100 165 Z" fill="#EEF2FF" opacity={still ? 0 : 0.95} />
      </g>
    </g>
  );
}

function sparklePath(cx: number, cy: number, size: number): string {
  const s = size;
  return `M ${cx} ${cy - s} Q ${cx} ${cy} ${cx + s} ${cy} Q ${cx} ${cy} ${cx} ${cy + s} Q ${cx} ${cy} ${cx - s} ${cy} Q ${cx} ${cy} ${cx} ${cy - s} Z`;
}

function Sparkles({ still, points, color = "#FBBF24" }: { still: boolean; points: [number, number, number][]; color?: string }) {
  return (
    <g fill={color}>
      {points.map(([x, y, size], index) => (
        <path
          key={`${x}-${y}`}
          d={sparklePath(x, y, size)}
          className={anim(still, "twinkle")}
          style={{ ...SELF_CENTER, animationDelay: `${index * 0.45}s` }}
        />
      ))}
    </g>
  );
}

function Zzz({ still }: { still: boolean }) {
  const letters: [number, number, number][] = [
    [158, 66, 20],
    [173, 48, 16],
    [186, 32, 12]
  ];
  return (
    <g fill="#7C8DB5" fontWeight={800} fontFamily="ui-rounded, system-ui, sans-serif">
      {letters.map(([x, y, size], index) => (
        <text
          key={x}
          x={x}
          y={y}
          fontSize={size}
          className={anim(still, "float")}
          style={{ animationDelay: `${index * 0.9}s` }}
        >
          Z
        </text>
      ))}
    </g>
  );
}

function Note({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <ellipse cx={x} cy={y} rx={5} ry={3.8} transform={`rotate(-20 ${x} ${y})`} />
      <path d={`M ${x + 4.3} ${y - 1} L ${x + 4.3} ${y - 17}`} stroke="currentColor" strokeWidth={2.2} />
      <path d={`M ${x + 4.3} ${y - 17} Q ${x + 12} ${y - 14} ${x + 11} ${y - 7}`} stroke="currentColor" strokeWidth={2.2} fill="none" />
    </g>
  );
}

function Notes({ still }: { still: boolean }) {
  const notes: [number, number][] = [
    [160, 56],
    [32, 66],
    [170, 100]
  ];
  return (
    <g fill="#8B5CF6" color="#8B5CF6">
      {notes.map(([x, y], index) => (
        <g key={x} className={anim(still, "float")} style={{ animationDelay: `${index * 0.8}s` }}>
          <Note x={x} y={y} />
        </g>
      ))}
    </g>
  );
}

function Mortarboard({ still }: { still: boolean }) {
  return (
    <g>
      <path d="M 76 42 L 76 54 Q 100 62 124 54 L 124 42 Z" fill="#111827" />
      <path d="M 60 40 L 100 26 L 140 40 L 100 54 Z" fill="#1F2937" />
      <path d="M 60 40 L 100 54 L 140 40" stroke="#374151" strokeWidth={1.5} fill="none" />
      <circle cx={100} cy={40} r={3} fill="#FBBF24" />
      <g className={anim(still, "swing")} style={origin("100px 40px")}>
        <path d="M 100 40 L 130 46 L 131 62" stroke="#FBBF24" strokeWidth={2.2} fill="none" strokeLinecap="round" />
        <path d="M 127 60 L 135 60 L 136 70 L 126 70 Z" fill="#FBBF24" />
      </g>
    </g>
  );
}

function Diploma({ hand }: { hand: Point }) {
  const [x, y] = hand;
  return (
    <g>
      <rect x={x - 18} y={y - 5} width={36} height={11} rx={5.5} fill="#FFF7E0" stroke="#E5D3A3" strokeWidth={1.5} />
      <rect x={x - 3} y={y - 6} width={6} height={13} rx={1.5} fill="#DC2626" />
    </g>
  );
}

function Headphones() {
  return (
    <g>
      <path d="M 50 92 C 46 30 154 30 150 92" stroke="#6D28D9" strokeWidth={7} fill="none" strokeLinecap="round" />
      {[40, 144].map((x) => (
        <g key={x}>
          <rect x={x} y={76} width={16} height={30} rx={8} fill="#8B5CF6" />
          <rect x={x + 4} y={81} width={8} height={20} rx={4} fill="#C4B5FD" />
        </g>
      ))}
    </g>
  );
}

function DetectiveCap() {
  return (
    <g>
      <path d="M 70 52 Q 72 26 100 24 Q 128 26 130 52 Z" fill="#8B6B47" />
      <ellipse cx={100} cy={53} rx={36} ry={7} fill="#6B4F33" />
      <path d="M 72 47 Q 100 54 128 47" stroke="#3F2E1E" strokeWidth={4.5} fill="none" />
      <g stroke="#A88560" strokeWidth={1.5} opacity={0.8}>
        <path d="M 84 30 L 80 46" />
        <path d="M 100 25 L 100 46" />
        <path d="M 116 30 L 120 46" />
      </g>
    </g>
  );
}

// Kính lúp cầm tay: cán từ bàn tay đi tiếp theo hướng cánh tay, mắt kính ở cuối.
function Magnifier({ hand }: { hand: Point }) {
  const [x, y] = hand;
  return (
    <g>
      <path d={`M ${x} ${y - 2} L ${x} ${y + 12}`} stroke="#5B3A1E" strokeWidth={6} strokeLinecap="round" />
      <circle cx={x} cy={y + 29} r={16} fill="#BFDBFE" fillOpacity={0.35} stroke="#B7791F" strokeWidth={5} />
      <path d={`M ${x - 9} ${y + 22} Q ${x - 6} ${y + 17} ${x + 1} ${y + 16}`} stroke="#fff" strokeWidth={2.5} fill="none" strokeLinecap="round" />
    </g>
  );
}

function Fire({ still }: { still: boolean }) {
  return (
    <g>
      <g className={anim(still, "flame")} style={origin("110px 114px")}>
        <path d="M 110 112 C 128 94 160 92 196 82 C 178 98 190 108 198 120 C 170 118 142 126 110 118 Z" fill="#F97316" />
        <path d="M 112 113 C 130 102 154 100 182 94 C 170 104 178 110 186 116 C 164 116 140 120 112 117 Z" fill="#FBBF24" />
        <path d="M 114 114 C 128 108 144 107 162 105 C 154 110 158 113 164 115 C 148 115 132 117 114 116 Z" fill="#FEF3C7" />
      </g>
      <Sparkles still={still} color="#FB923C" points={[[176, 72, 5], [190, 132, 4]]} />
    </g>
  );
}

// ---------------------------------------------------------------------------
// Tư thế

type PoseSpec = {
  armL: number; // độ "giơ ra ngoài" của tay trái (0 = buông, 90 = ngang, 180 = thẳng lên)
  armR: number;
  reachL?: number; // kéo dài tay (1 = bình thường) khi giơ cao để thò ra khỏi đầu
  reachR?: number;
  expr: Expr;
  figure?: AnimKey; // cả người
  head?: AnimKey;
  armLAnim?: AnimKey;
  armRAnim?: AnimKey;
  handL?: (hand: Point) => ReactNode;
  handR?: (hand: Point) => ReactNode;
  headwear?: (still: boolean) => ReactNode;
  headFx?: (still: boolean) => ReactNode; // gắn vào đầu (lửa)
  front?: (still: boolean) => ReactNode; // trước thân, sau tay (quyển sách)
  fx?: (still: boolean) => ReactNode; // quanh người, không theo nhịp nhún
  tilt?: number;
};

const SIGNATURES: Record<MascotId, PoseSpec> = {
  owl: {
    armL: 12,
    armR: 140,
    expr: "happy",
    figure: "bob",
    handR: (hand) => <Diploma hand={hand} />,
    headwear: (still) => <Mortarboard still={still} />,
    fx: (still) => <Sparkles still={still} points={[[30, 70, 7], [172, 30, 6], [26, 140, 5]]} />
  },
  cat: {
    armL: 14,
    armR: 14,
    expr: "joy",
    head: "sway",
    headwear: () => <Headphones />,
    fx: (still) => <Notes still={still} />
  },
  fox: {
    armL: -135,
    armR: 12,
    expr: "open",
    figure: "bob",
    armLAnim: "scan",
    handL: (hand) => <Magnifier hand={hand} />,
    headwear: () => <DetectiveCap />
  },
  dragon: {
    armL: 40,
    armR: 40,
    expr: "fierce",
    head: "nod",
    headFx: (still) => <Fire still={still} />
  }
};

const POSES: Record<PoseId, (id: MascotId) => PoseSpec> = {
  idle: () => ({ armL: 12, armR: 12, expr: "open", figure: "bob" }),
  wave: () => ({ armL: 10, armR: 125, reachR: 1.2, expr: "happy", figure: "bob", armRAnim: "wave" }),
  read: () => ({
    armL: -38,
    armR: -38,
    expr: "down",
    head: "nod",
    front: (still) => <Book still={still} />
  }),
  cheer: () => ({
    armL: 145,
    armR: 145,
    reachL: 1.3,
    reachR: 1.3,
    expr: "joy",
    figure: "hop",
    fx: (still) => <Sparkles still={still} points={[[34, 62, 8], [166, 50, 7], [174, 128, 6], [24, 128, 5]]} />
  }),
  sleep: () => ({ armL: 4, armR: 4, expr: "closed", figure: "breathe", tilt: 4, fx: (still) => <Zzz still={still} /> }),
  signature: (id) => SIGNATURES[id]
};

function Arm({
  species,
  angle,
  reach,
  animKey,
  holding,
  mirrored,
  still
}: {
  species: Species;
  angle: number;
  reach?: number;
  animKey?: AnimKey;
  holding?: (hand: Point) => ReactNode;
  mirrored: boolean;
  still: boolean;
}) {
  return (
    <g transform={mirrored ? MIRROR : undefined}>
      <g transform={`rotate(${angle} ${SHOULDER[0]} ${SHOULDER[1]})`}>
        <g className={anim(still, animKey)} style={origin(`${SHOULDER[0]}px ${SHOULDER[1]}px`)}>
          {holding ? holding(species.hand) : null}
          <g transform={reach ? `translate(${SHOULDER[0]} ${SHOULDER[1]}) scale(1 ${reach}) translate(${-SHOULDER[0]} ${-SHOULDER[1]})` : undefined}>
            {species.arm()}
          </g>
        </g>
      </g>
    </g>
  );
}

export function MascotArt({
  mascot,
  pose,
  className,
  still = false
}: {
  mascot: MascotId;
  pose: PoseId;
  className?: string;
  still?: boolean;
}) {
  const species = SPECIES[mascot];
  const spec = POSES[pose](mascot);
  const label = MASCOTS.find((item) => item.id === mascot)?.name ?? "Linh vật";

  return (
    <svg viewBox="0 0 200 200" className={className} overflow="visible" role="img" aria-label={label}>
      <ellipse cx={100} cy={188} rx={46} ry={6} fill="#000" opacity={0.13} />
      <g transform={spec.tilt ? `rotate(${spec.tilt} 100 186)` : undefined}>
        <g className={anim(still, spec.figure)} style={origin(GROUND)}>
          {species.back(still)}
          {species.body()}
          <g className={anim(still, spec.head)} style={origin(NECK)}>
            {species.head(spec.expr, still)}
            {spec.headwear ? spec.headwear(still) : null}
            {spec.headFx ? spec.headFx(still) : null}
          </g>
          {spec.front ? spec.front(still) : null}
          <Arm species={species} angle={spec.armL} reach={spec.reachL} animKey={spec.armLAnim} holding={spec.handL} mirrored={false} still={still} />
          <Arm species={species} angle={spec.armR} reach={spec.reachR} animKey={spec.armRAnim} holding={spec.handR} mirrored still={still} />
        </g>
      </g>
      {spec.fx ? spec.fx(still) : null}
    </svg>
  );
}

// Linh vật đang trang bị theo mã tư thế ("pose:owl:wave"); null/mã lạ → không vẽ gì.
export function EquippedMascot({
  poseKey,
  className,
  still
}: {
  poseKey: string | null | undefined;
  className?: string;
  still?: boolean;
}) {
  const resolved = resolvePose(poseKey);
  if (!resolved) return null;
  return <MascotArt mascot={resolved.mascot.id} pose={resolved.pose.id} className={className} still={still} />;
}
